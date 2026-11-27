/* NovaTrade service worker: makes the app (and the APK) open instantly and work offline.
   - App shell (index.html): network first with a short timeout, cached copy as fallback.
   - Versioned files (js/css ?v=, vendor libs, coin logos, fonts): cache first — they never change at the same URL.
   - Market data APIs and websockets: never cached (always live). */
const CACHE = "nt-static-v9";
const SHELL = "nt-shell-v9";
const MAX_ENTRIES = 500;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.add(new Request("./", {cache: "reload"}))).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keep = [CACHE, SHELL];
    for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isStatic = u =>
  (u.origin === self.location.origin && /\.(js|css|svg|png|jpg|jpeg|webp|woff2?|json|webmanifest|glb|mp3|wasm)$/i.test(u.pathname)) ||
  u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com" ||
  u.hostname === "flagcdn.com" || u.hostname === "assets.coincap.io" || u.hostname === "cdn.jsdelivr.net" || u.hostname === "unpkg.com";

async function trim(){
  const c = await caches.open(CACHE), keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);

  // App shell: network first (so pushed updates appear right away), cache fallback within 3s / offline
  if (r.mode === "navigate"){
    e.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const net = fetch(r, {cache: "no-cache"}).then(res => { if (res.ok) cache.put("./", res.clone()); return res; });
      const timeout = new Promise(res => setTimeout(res, 3000));
      try {
        const res = await Promise.race([net, timeout]);
        if (res) return res;
        return (await cache.match("./")) || await net;
      } catch {
        return (await cache.match("./")) || Response.error();
      }
    })());
    return;
  }

  if (isStatic(u)){
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(r);
      if (hit) return hit;
      const res = await fetch(r);
      if (res && (res.ok || res.type === "opaque")){ cache.put(r, res.clone()); trim(); }
      return res;
    })());
  }
  // everything else (Binance / biquote / CoinGecko APIs) goes straight to the network
});
