/* Bridge to the Android app shell (window.NativeApp exists only inside the APK). */
(function(){
  const N = window.NativeApp;
  window.IS_APP = !!N;
  if (!N) return;
  const sync = () => setTimeout(() => {
    try {
      const dark = document.documentElement.dataset.theme === "dark";
      // the page header colour = theme --bg token (fallback: body background)
      let hex = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      if (!/^#[0-9a-f]{6}$/i.test(hex)){ const bg = (getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [31,38,48]); hex = "#" + bg.slice(0,3).map(v => (+v).toString(16).padStart(2,"0")).join(""); }
      N.setBars(hex, dark);
    } catch(e){}
  }, 30);
  U.bus.on("theme", sync); addEventListener("load", sync); sync(); document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });
})();
