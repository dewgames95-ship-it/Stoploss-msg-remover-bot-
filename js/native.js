/* Bridge to the Android app shell (window.NativeApp exists only inside the APK). */
(function(){
  const N = window.NativeApp;
  window.IS_APP = !!N;
  if (!N) return;
  const sync = () => setTimeout(() => {
    try {
      const dark = document.documentElement.dataset.theme === "dark";
      const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [31,38,48];
      const hex = "#" + bg.slice(0,3).map(v => (+v).toString(16).padStart(2,"0")).join("");
      N.setBars(hex, dark);
    } catch(e){}
  }, 30);
  U.bus.on("theme", sync); addEventListener("load", sync);
})();
