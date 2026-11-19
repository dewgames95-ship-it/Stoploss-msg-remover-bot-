/* ===== Shared UI pieces ===== */
(function(){
const C = window.CONFIG, {esc, ic, t, store} = U;

const COLORS = ["#2F80ED","#16C784","#F2994A","#9B51E0","#EB5757","#0EA5C6","#D9A400","#E54878"];
function letter(txt, size=34){
  let h = 0; for (const c of txt) h = (h*31 + c.charCodeAt(0)) >>> 0;
  return `<span class="letter" style="width:${size}px;height:${size}px;background:${COLORS[h%COLORS.length]};font-size:${Math.round(size*.38)}px">${esc(txt.slice(0,2))}</span>`;
}
const METAL_SVG = {
  gold:`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#FFF4D6"/><path d="M8 26h11l2-6H10z" fill="#E8B10E"/><path d="M21 26h11l-2-6H23z" fill="#F5C842"/><path d="M14 19h12l-2-6h-8z" fill="#FFD966"/><path d="M16 13h8l-.6 1.6h-6.8z" fill="#fff" opacity=".6"/></svg>`,
  silver:`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#EEF1F5"/><path d="M8 26h11l2-6H10z" fill="#9AA5B4"/><path d="M21 26h11l-2-6H23z" fill="#B8C1CD"/><path d="M14 19h12l-2-6h-8z" fill="#D4DAE2"/><path d="M16 13h8l-.6 1.6h-6.8z" fill="#fff" opacity=".7"/></svg>`
};
function pairIcon(p, size=34){
  if (!p) return letter("?", size);
  if (p.type === "metal") return `<span style="width:${size}px;height:${size}px;display:block;flex-shrink:0">${METAL_SVG[p.metal]}</span>`;
  if (p.type === "forex") return `<span style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;display:block">
    <img class="coin flag" src="assets/flags/${p.flags[0]}.webp" alt="" width="${size*.8|0}" height="${size*.8|0}" loading="lazy" style="width:${size*.78}px;height:${size*.78}px;position:absolute;left:0;top:0">
    <img class="coin flag" src="assets/flags/${p.flags[1]}.webp" alt="" loading="lazy" style="width:${size*.55}px;height:${size*.55}px;position:absolute;right:0;bottom:0;border:2px solid var(--card)"></span>`;
  const k = p.base.toLowerCase(), ext = (window.LOCAL_ICONS || {})[k];
  if (ext) return `<img class="coin" src="assets/coins/${k}.${ext}" alt="${esc(p.base)}" width="${size}" height="${size}" loading="lazy" style="width:${size}px;height:${size}px">`;
  return letter(p.base, size);
}
const usdt = (s=22) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#26A17B"/><path fill="#fff" d="M17.9 17.4v0c-.1 0-.7.1-2 .1-1 0-1.7 0-2-.1v0c-3.9-.2-6.8-.9-6.8-1.7s2.9-1.5 6.8-1.7v2.7c.3 0 1 .1 2 .1 1.2 0 1.8-.1 1.9-.1v-2.7c3.9.2 6.8.9 6.8 1.7s-2.9 1.5-6.8 1.7zm0-3.6v-2.4h5.4V7.8H8.7v3.6h5.4v2.4c-4.4.2-7.7 1.1-7.7 2.1s3.3 1.9 7.7 2.1v7.6h3.8V18c4.4-.2 7.7-1.1 7.7-2.1s-3.3-1.9-7.7-2.1z"/></svg>`;

function footer(){
  const y = new Date().getFullYear();
  return `<footer class="footer">
    <nav aria-label="Footer"><a href="#/about">About Us</a><a href="#/support">Contact Support</a><a href="#/community">Community</a><a href="#/vip">VIP Signals</a><a href="#/referral">Referral</a><a href="#/settings">Settings</a></nav>
    <div class="row" style="justify-content:center;gap:16px;flex-wrap:wrap;margin-bottom:8px">
      <a href="tel:${C.SUPPORT_PHONE.replace(/\s/g,"")}" class="row" style="gap:6px">${ic("phone",14)} ${esc(C.SUPPORT_PHONE)}</a>
      <a href="mailto:${C.SUPPORT_EMAIL}" class="row" style="gap:6px">${ic("mail",14)} ${esc(C.SUPPORT_EMAIL)}</a>
    </div>
    <p class="disc">⚠️ Demo app for learning only. No real money. Trading involves risk.</p>
    <p>© ${y} ${esc(C.APP_NAME)} Demo · Market data: Binance & biquote.io</p>
  </footer>`;
}
function pageHead(title, opts={}){
  return `<header class="page-head">
    <button class="icon-btn" data-back aria-label="Go back">${ic("back",20)}</button>
    <h1 class="h1 ellipsis">${esc(t(title))}</h1>
    ${opts.right || `<a class="icon-btn" href="#/home" aria-label="Home — ${esc(C.APP_NAME)}"><img src="favicon.svg" alt="" width="24" height="24"></a>`}
  </header>`;
}
function emptyState(icon, text){ return `<div class="empty">${ic(icon,36,1.5)}<p style="margin-top:8px">${esc(text)}</p></div>`; }

/* ---- Global sheets ---- */
function openNotifs(){
  const s = store.s; s.unread = 0; store.save(); U.bus.emit("notifs");
  const items = s.notifs.length ? s.notifs.map(n => `<div class="list-item"><span class="ic ${n.kind==="ok"?"p3":n.kind==="bad"?"p7":"p1"}">${ic(n.kind==="ok"?"check":n.kind==="bad"?"x":"bell",18)}</span>
    <div class="grow"><div style="font-weight:600;font-size:14px">${esc(n.title)}</div><div class="sub" style="font-size:13px">${esc(n.body)}</div><div class="label">${U.dateStr(n.t)}</div></div></div>`).join("")
    : emptyState("bell", "No notifications yet. Place a trade to get started.");
  U.sheet(t("Notifications"), items + (s.notifs.length ? `<button class="btn btn-ghost btn-block" data-clear style="margin-top:12px">Clear all</button>` : ""), el => {
    el.querySelector("[data-clear]")?.addEventListener("click", () => { s.notifs = []; store.save(); U.closeLayer(); U.toast("Notifications cleared", "ok"); });
  });
}
function openLang(){
  const cur = store.s.settings.lang;
  U.sheet(t("Language"), [["en","English","🇬🇧"],["hi","हिन्दी (Hindi)","🇮🇳"]].map(([k,n,f]) => `<button class="list-item" style="width:100%" data-l="${k}"><span style="font-size:24px">${f}</span><span class="grow" style="text-align:left;font-weight:600">${n}</span>${cur===k?`<span class="up">${ic("check",20)}</span>`:""}</button>`).join(""), el => {
    el.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { store.s.settings.lang = b.dataset.l; store.save(); U.closeLayer(); U.bus.emit("lang"); U.toast("Language updated", "ok"); });
  });
}
function openMenu(){
  const links = [["home","Home","#/home"],["chart","Trade","#/trade"],["bot","Bots","#/bots"],["auto","Activate Auto Trading","#/auto"],["crown","Get VIP Signals","#/vip"],["deposit","Deposit","#/deposit"],["withdraw","Withdraw","#/withdraw"],["gift","Referral","#/referral"],["users","Join Community","#/community"],["user","Profile","#/profile"],["gear","Settings","#/settings"],["info","About Us","#/about"],["headset","Contact Support","#/support"]];
  const cur = location.hash.split("?")[0];
  const p = store.s.profile;
  U.drawer(`<div style="padding:24px 20px 16px;background:var(--grad);color:#fff">
      <a href="#/home" class="brand" style="color:#fff;margin-bottom:16px"><img src="favicon.svg" alt="" width="28" height="28">${esc(C.APP_NAME)}</a>
      <div class="row" style="margin-top:12px"><span class="avatar" style="background:rgba(255,255,255,.25)">${esc(p.name[0])}</span><div class="grow"><b>${esc(p.name)}</b><div style="font-size:12px;opacity:.85">UID ${p.uid}</div></div></div>
    </div>
    <nav aria-label="Main menu" style="padding:8px 0">${links.map(([i,n,h]) => `<a href="${h}" class="${cur===h?"on":""}">${ic(i,20)}<span>${esc(t(n))}</span></a>`).join("")}</nav>
    <div style="padding:16px 20px;margin-top:auto" class="label">Demo app for learning only. No real money.</div>`, el => el.querySelectorAll("a").forEach(a => a.addEventListener("click", () => U.closeLayer())));
}

window.UI = {pairIcon, letter, usdt, footer, pageHead, emptyState, openNotifs, openLang, openMenu};
})();
