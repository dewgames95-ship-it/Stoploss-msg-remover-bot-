/* Web update notice: when a newer version is deployed, show "Update available" instead of
   silently waiting for the next cold start (the APK WebView often just resumes from background).
   Version = the ?v= on this script tag; compared against the live index.html. */
(() => {
  const me = document.currentScript && document.currentScript.src;
  const CUR = (me && (me.match(/[?&]v=([\d.]+)/) || [])[1]) || "";
  if (!CUR || location.protocol !== "https:") return;
  let last = 0, shown = false;

  async function check(){
    if (shown || Date.now() - last < 60e3) return;
    last = Date.now();
    try {
      const r = await fetch("./?vc=" + Date.now(), {cache: "no-store"});
      if (!r.ok) return;
      const live = ((await r.text()).match(/(?:update|app\.min)\.js\?v=([\d.]+)/) || [])[1];
      if (live && live !== CUR) prompt(live);
    } catch {}
  }

  async function apply(){
    try {
      if ("caches" in window) for (const k of await caches.keys()) if (/^nt-shell/.test(k)) await caches.delete(k);
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
    } catch {}
    location.reload();
  }

  async function prompt(v){
    if (document.querySelector(".tr-ov")) { setTimeout(() => prompt(v), 5000); shown = true; return; }   // wait for the guided tour to finish
    shown = true;
    const ok = await U.confirmBox("Update available", `A new version (${v}) of the app is ready. Update now to get the latest features and fixes.`, "Update now");
    if (ok) apply(); else setTimeout(() => { shown = false; }, 30 * 60e3);
  }

  addEventListener("load", () => setTimeout(check, 4000));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  setInterval(check, 5 * 60e3);
})();
