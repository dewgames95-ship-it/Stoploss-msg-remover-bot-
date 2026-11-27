/* ===== v7.1 Admin runtime (loads EARLY: right after config.js). Two jobs, both tiny:
   1) Branding: admin can change app name + logo (localStorage "nt_brand" = {name, logo}). Applied to CONFIG.APP_NAME, document.title,
      favicon / apple-touch-icon, every inline brand logo (UI.logo svg, img favicon.svg) and every visible "NovaTrade" text node.
   2) Finance guard: when the admin turned Auto-pay OFF ("nt_adm_fin".autoPay === false) withdrawal requests stay "Processing"
      until the admin pays them manually (the app's own 10 s auto-settle is held back).
   Nothing here touches network or secrets. ===== */
(function(){
const KB = "nt_brand", KF = "nt_adm_fin", ORIG = "NovaTrade";
const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
const get = () => { const b = rd(KB, {}) || {}; return {name: String(b.name || "").trim().slice(0, 24), logo: String(b.logo || "")}; };
const safeLogo = s => /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(s) || /^https:\/\/[^\s"'<>]+$/i.test(s);
let B = get(), obs = null, queued = false;
const nameOn = () => !!B.name && B.name !== ORIG, logoOn = () => !!B.logo && safeLogo(B.logo);

function fixText(root){
  if (!nameOn() || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: n => n.nodeValue && n.nodeValue.includes(ORIG) && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode && n.parentNode.nodeName) ? 1 : 3});
  const L = []; while (w.nextNode()) L.push(w.currentNode);
  L.forEach(n => { n.nodeValue = n.nodeValue.split(ORIG).join(B.name); });
  if (root.querySelectorAll) root.querySelectorAll("[aria-label],[placeholder],[alt],[title]").forEach(el => ["aria-label", "placeholder", "alt", "title"].forEach(a => { const v = el.getAttribute(a); if (v && v.includes(ORIG)) el.setAttribute(a, v.split(ORIG).join(B.name)); }));
}
function fixLogos(root){
  if (!logoOn() || !root || !root.querySelectorAll) return;
  root.querySelectorAll("svg").forEach(s => {
    if (s.dataset.nb || !s.querySelector("linearGradient#nlg")) return;
    const w = s.getAttribute("width") || 24, h = s.getAttribute("height") || w;
    const i = document.createElement("img"); i.src = B.logo; i.alt = ""; i.width = +w; i.height = +h; i.className = "nt-brand-logo"; i.dataset.nb = "1";
    i.style.cssText = "border-radius:28%;object-fit:cover;flex:none;display:inline-block;vertical-align:middle"; s.replaceWith(i);
  });
  root.querySelectorAll('img[src$="favicon.svg"]').forEach(i => { i.src = B.logo; i.style.borderRadius = "28%"; i.style.objectFit = "cover"; });
}
function fixHead(){
  if (nameOn()) document.title = document.title.split(ORIG).join(B.name);
  if (logoOn()) document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"],link[rel="shortcut icon"]').forEach(l => { l.removeAttribute("type"); l.href = B.logo; });
}
function pass(root){ try { fixText(root); fixLogos(root); } catch {} }
function apply(){
  B = get();
  if (window.CONFIG && nameOn()) CONFIG.APP_NAME = B.name;
  const go = () => { fixHead(); pass(document.body); if ((nameOn() || logoOn()) && !obs && document.body){
    obs = new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; pass(document.body); if (nameOn()) fixHead(); }); });
    obs.observe(document.body, {childList: true, subtree: true, characterData: false}); } };
  if (document.body) go(); else addEventListener("DOMContentLoaded", go, {once: true});
}
function set(o){ const n = Object.assign(get(), o || {}); try { localStorage.setItem(KB, JSON.stringify(n)); } catch {} B = n; }
function reset(){ try { localStorage.removeItem(KB); } catch {} B = get(); }
window.Brand = {get, set, reset, apply, safeLogo, orig: ORIG};
apply();

/* ---- finance guard (manual withdrawal payout) ---- */
const fin = () => Object.assign({autoPay: true, autoCredit: true}, rd(KF, {}) || {});
window.AdminFin = {get: fin, set: o => { try { localStorage.setItem(KF, JSON.stringify(Object.assign(fin(), o))); } catch {} }};
setInterval(() => {
  try {
    const U = window.U; if (!U || !U.store || fin().autoPay !== false) return;
    const S = U.store.s; if (!S || !Array.isArray(S.tx)) return;
    let ch = 0; S.tx.forEach(x => { if (x && x.kind === "withdrawal" && x.status === "Processing" && x.done < 9e15){ x.done = 9e15; ch++; } });
    if (ch) U.store.save();
  } catch {}
}, 800);
})();
