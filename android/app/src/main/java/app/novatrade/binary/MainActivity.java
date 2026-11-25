package app.novatrade.binary;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Thin WebView shell around the live web app.
 *  - Web changes (pushed to gh-pages) show up automatically: the app always loads the live site.
 *  - Native updates: on start it checks the latest GitHub Release (tag "apk-v<versionCode>");
 *    if newer, "Update" downloads the APK and opens the installer in one tap.
 */
public class MainActivity extends Activity {
    static final String SITE = "https://dewgames95-ship-it.github.io/Stoploss-msg-remover-bot-/";
    static final String HOST = "dewgames95-ship-it.github.io";
    static final String RELEASES = "https://api.github.com/repos/dewgames95-ship-it/Stoploss-msg-remover-bot-/releases/latest";

    WebView web;
    ValueCallback<Uri[]> fileCb;
    long downloadId = -1;
    boolean errorShown = false;
    long lastCheck = 0;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#1F2630"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage = all app data (balance, positions, settings)
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);                    // ignore system font scaling so layouts never overlap
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        s.setUserAgentString(s.getUserAgentString() + " BinaryTradingApp/" + BuildConfigVersion());
        web.addJavascriptInterface(new Bridge(), "NativeApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) showOffline();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try { startActivityForResult(p.createIntent(), 7); } catch (Exception e) { fileCb = null; return false; }
                return true;
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl(SITE);
        checkForUpdate(false);
    }

    int BuildConfigVersion() {
        try { return (int) getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode(); }
        catch (Throwable t) { return 1; }
    }

    void showOffline() {
        if (errorShown) return;
        errorShown = true;
        String html = "<html><body style='margin:0;background:#1F2630;color:#EAECEF;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'>"
            + "<div><div style='font-size:20px;font-weight:700'>No connection</div><div style='color:#848E9C;margin:8px 0 22px'>Check your internet and try again.</div>"
            + "<button onclick='NativeApp.reload()' style='background:#2E6BFF;color:#fff;border:0;border-radius:12px;padding:12px 28px;font-size:16px'>Retry</button></div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    boolean online() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo n = cm == null ? null : cm.getActiveNetworkInfo();
        return n != null && n.isConnected();
    }

    /** JS can call window.NativeApp.* */
    class Bridge {
        @JavascriptInterface public void reload() {
            runOnUiThread(() -> { errorShown = false; web.loadUrl(SITE); });
        }
        /** Match the status/navigation bar to the web theme: NativeApp.setBars("#1F2630", true) */
        @JavascriptInterface public void setBars(String color, boolean dark) {
            runOnUiThread(() -> {
                try {
                    int c = Color.parseColor(color);
                    Window w = getWindow();
                    w.setStatusBarColor(c);
                    w.setNavigationBarColor(c);
                    View d = w.getDecorView();
                    int f = d.getSystemUiVisibility();
                    if (Build.VERSION.SDK_INT >= 23) f = dark ? (f & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR) : (f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
                    if (Build.VERSION.SDK_INT >= 26) f = dark ? (f & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR) : (f | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
                    d.setSystemUiVisibility(f);
                } catch (Exception ignored) {}
            });
        }
        @JavascriptInterface public int version() { return BuildConfigVersion(); }
        @JavascriptInterface public void checkUpdate() { checkForUpdate(true); }
    }

    /* ---------------- native app update (GitHub Releases) ---------------- */
    static final String DL = "https://github.com/dewgames95-ship-it/Stoploss-msg-remover-bot-/releases/latest/download/";

    /** Reads a small text/JSON response; follows the github.com -> CDN redirect. Returns null on any non-200. */
    static String get(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", "BinaryTradingApp");
        c.setRequestProperty("Cache-Control", "no-cache");
        c.setUseCaches(false);
        c.setConnectTimeout(10000); c.setReadTimeout(10000);
        if (c.getResponseCode() != 200) return null;
        BufferedReader br = new BufferedReader(new InputStreamReader(c.getInputStream()));
        StringBuilder sb = new StringBuilder(); String line;
        while ((line = br.readLine()) != null) sb.append(line);
        br.close();
        return sb.toString();
    }

    void checkForUpdate(boolean manual) {
        lastCheck = System.currentTimeMillis();
        new Thread(() -> {
            int latest = 0; String url = DL + "binary-trading.apk";
            try {
                // 1) release asset version.txt: plain download, no GitHub API rate limit (mobile networks share IPs)
                String v = get(DL + "version.txt?t=" + System.currentTimeMillis());
                if (v != null) latest = Integer.parseInt(v.replaceAll("[^0-9]", ""));
            } catch (Exception ignored) {}
            if (latest == 0) {
                try {   // 2) fallback: GitHub API
                    String body = get(RELEASES);
                    if (body != null) {
                        JSONObject j = new JSONObject(body);
                        String n = j.optString("tag_name", "").replaceAll("[^0-9]", "");
                        latest = n.isEmpty() ? 0 : Integer.parseInt(n);
                        JSONArray assets = j.optJSONArray("assets");
                        for (int i = 0; assets != null && i < assets.length(); i++) {
                            JSONObject a = assets.getJSONObject(i);
                            if (a.optString("name").endsWith(".apk")) { url = a.optString("browser_download_url"); break; }
                        }
                    }
                } catch (Exception ignored) {}
            }
            final int lv = latest; final String u = url;
            if (lv > BuildConfigVersion()) runOnUiThread(() -> promptUpdate(u, lv, ""));
            else if (manual) toast(lv == 0 ? "Update check failed. Check internet and try again" : "You have the latest version (build " + BuildConfigVersion() + ")");
        }).start();
    }

    void toast(String m) { runOnUiThread(() -> Toast.makeText(this, m, Toast.LENGTH_SHORT).show()); }

    boolean dialogOpen = false;
    void promptUpdate(String url, int v, String notes) {
        if (isFinishing() || dialogOpen) return;
        dialogOpen = true;
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Update available")
            .setMessage("A new version of the app (build " + v + ") is ready." + (notes.isEmpty() ? "" : "\n\n" + notes))
            .setPositiveButton("Update", (d, w) -> download(url, v))
            .setNegativeButton("Later", null)
            .setOnDismissListener(d -> dialogOpen = false)
            .show();
    }

    void download(String url, int v) {
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            toast("Allow \"Install unknown apps\" for this app, then tap Update again");
            startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
            return;
        }
        DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url))
            .setTitle("Binary Trading update")
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "binary-trading-" + v + ".apk");
        downloadId = dm.enqueue(r);
        toast("Downloading update…");
        BroadcastReceiver rec = new BroadcastReceiver() {
            @Override public void onReceive(Context ctx, Intent i) {
                if (i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != downloadId) return;
                try { unregisterReceiver(this); } catch (Exception ignored) {}
                Uri apk = dm.getUriForDownloadedFile(downloadId);
                if (apk == null) { toast("Download failed"); return; }
                Intent in = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(apk, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                try { startActivity(in); } catch (Exception e) { toast("Open the downloaded file to install"); }
            }
        };
        IntentFilter f = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(rec, f, Context.RECEIVER_EXPORTED);
        else registerReceiver(rec, f);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == 7 && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCb = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (errorShown && online()) { errorShown = false; web.loadUrl(SITE); }
        // re-check for a new APK when the app comes back from background (at most every 30 min)
        if (lastCheck > 0 && System.currentTimeMillis() - lastCheck > 10 * 60 * 1000L) checkForUpdate(false);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }
}
