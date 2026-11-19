/* ===== Shared UI pieces ===== */
(function(){
const C = window.CONFIG, {esc, ic, t, store} = U;

const COLORS = ["#F0B90B","#0ECB81","#1E80FF","#9B6BFF","#F6465D","#14B8C9","#F7931A","#E040FB"];
function letter(txt, size=28){
  let h = 0; for (const c of txt) h = (h*31 + c.charCodeAt(0)) >>> 0;
  return `<span class="letter" style="width:${size}px;height:${size}px;background:${COLORS[h%COLORS.length]};font-size:${Math.round(size*.38)}px">${esc(txt.slice(0,2))}</span>`;
}
const METAL_SVG = {
  gold:`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#3A3214"/><path d="M8 27h11l2-6H10z" fill="#E8B10E"/><path d="M21 27h11l-2-6H23z" fill="#F5C842"/><path d="M14 20h12l-2-6h-8z" fill="#FFD966"/><path d="M16 14h8l-.6 1.6h-6.8z" fill="#fff" opacity=".6"/></svg>`,
  silver:`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#2B3139"/><path d="M8 27h11l2-6H10z" fill="#9AA5B4"/><path d="M21 27h11l-2-6H23z" fill="#B8C1CD"/><path d="M14 20h12l-2-6h-8z" fill="#D4DAE2"/><path d="M16 14h8l-.6 1.6h-6.8z" fill="#fff" opacity=".7"/></svg>`
};
function pairIcon(p, size=28){
  if (!p) return letter("?", size);
  if (p.type === "metal") return `<span style="width:${size}px;height:${size}px;display:block;flex-shrink:0">${METAL_SVG[p.metal]}</span>`;
  if (p.type === "forex") return `<span style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;display:block">
    <img class="coin" src="assets/flags/${p.flags[0]}.webp" alt="" loading="lazy" style="width:${size*.78}px;height:${size*.78}px;position:absolute;left:0;top:0">
    <img class="coin" src="assets/flags/${p.flags[1]}.webp" alt="" loading="lazy" style="width:${size*.55}px;height:${size*.55}px;position:absolute;right:0;bottom:0;border:1.5px solid var(--card)"></span>`;
  const k = p.base.toLowerCase(), ext = (window.LOCAL_ICONS || {})[k];
  if (ext) return `<img class="coin" src="assets/coins/${k}.${ext}" alt="${esc(p.base)}" loading="lazy" style="width:${size}px;height:${size}px">`;
  return letter(p.base, size);
}
const usdt = (s=20) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#26A17B"/><path fill="#fff" d="M17.9 17.4c-.1 0-.7.1-2 .1-1 0-1.7 0-2-.1-3.9-.2-6.8-.9-6.8-1.7s2.9-1.5 6.8-1.7v2.7c.3 0 1 .1 2 .1 1.2 0 1.8-.1 1.9-.1v-2.7c3.9.2 6.8.9 6.8 1.7s-2.9 1.5-6.8 1.7zm0-3.6v-2.4h5.4V7.8H8.7v3.6h5.4v2.4c-4.4.2-7.7 1.1-7.7 2.1s3.3 1.9 7.7 2.1v7.6h3.8V18c4.4-.2 7.7-1.1 7.7-2.1s-3.3-1.9-7.7-2.1z"/></svg>`;
const logo = (s=24) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#FCD535"/><path d="M14 42l10-12 8 7 16-19" fill="none" stroke="#181A20" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="48" cy="18" r="5" fill="#0ECB81" stroke="#181A20" stroke-width="2"/></svg>`;

/* End-of-page graphic (replaces footer links) */
const ART = `<svg class="art" viewBox="0 0 340 120" aria-hidden="true">
  <defs><linearGradient id="ea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#F0B90B" stop-opacity=".35"/><stop offset="1" stop-color="#F0B90B" stop-opacity="0"/></linearGradient></defs>
  <path d="M0 96 L30 84 L55 90 L80 70 L105 76 L130 52 L155 60 L180 40 L205 48 L230 26 L255 34 L280 18 L310 24 L340 8 L340 120 L0 120Z" fill="url(#ea)"/>
  <path d="M0 96 L30 84 L55 90 L80 70 L105 76 L130 52 L155 60 L180 40 L205 48 L230 26 L255 34 L280 18 L310 24 L340 8" fill="none" stroke="#F0B90B" stroke-width="2.5"/>
  ${[[40,70,12,"#0ECB81"],[70,62,16,"#F6465D"],[100,58,14,"#0ECB81"],[130,40,18,"#0ECB81"],[160,48,12,"#F6465D"],[190,30,16,"#0ECB81"],[220,22,12,"#0ECB81"],[250,26,14,"#F6465D"],[280,10,16,"#0ECB81"]].map(([x,y,h,c]) => `<line x1="${x}" x2="${x}" y1="${y-6}" y2="${y+h+6}" stroke="${c}" stroke-width="1.5" opacity=".7"/><rect x="${x-4}" y="${y}" width="8" height="${h}" rx="1.5" fill="${c}" opacity=".85"/>`).join("")}
  <circle cx="340" cy="8" r="4" fill="#FCD535"><animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.4;1" dur="1.6s" repeatCount="indefinite"/></circle>
</svg>`;
function footer(){
  return `<section class="endcap" aria-label="About ${esc(C.APP_NAME)}">
    ${ART}
    <h4>Trade smarter with ${esc(C.APP_NAME)}</h4>
    <p>Real-time prices, pro charts and instant execution — binary options and futures in one place.</p>
    <div class="feat">
      <div><span>${ic("zap",20)}</span>Instant execution</div>
      <div><span>${ic("chart",20)}</span>Live market data</div>
      <div><span>${ic("shield",20)}</span>Risk controls</div>
      <div><span>${ic("headset",20)}</span>24/7 support</div>
    </div>
    <div class="stats-row"><div><b>120+</b><span>Markets</span></div><div><b>125x</b><span>Max leverage</span></div><div><b>+92%</b><span>Binary payout</span></div></div>
    <div class="row" style="justify-content:center;gap:6px;margin-bottom:4px">${logo(18)}<b style="font-size:13px">${esc(C.APP_NAME)}</b></div>
    <div class="ver">v3.0 · Data: Binance · biquote.io</div>
  </section>`;
}
function pageHead(title, opts={}){
  return `<header class="page-head">
    <button class="icon-btn" data-back aria-label="Go back">${ic("back",22)}</button>
    <h1 class="h1 ellipsis">${esc(t(title))}</h1>
    ${opts.right || `<a class="icon-btn" href="#/home" aria-label="Home">${logo(22)}</a>`}
  </header>`;
}
function emptyState(icon, text){ return `<div class="empty">${ic(icon,32,1.5)}<p>${esc(text)}</p></div>`; }

/* ---- Global sheets ---- */
function openNotifs(){
  const s = store.s; s.unread = 0; store.save(); U.bus.emit("notifs");
  const items = s.notifs.length ? s.notifs.map(n => `<div class="list-item"><span class="ic ${n.kind==="ok"?"ic-g":n.kind==="bad"?"ic-r":"ic-y"}">${ic(n.kind==="ok"?"check":n.kind==="bad"?"x":"bell",16)}</span>
    <div class="grow"><div style="font-weight:500;font-size:14px">${esc(n.title)}</div><div class="sub" style="font-size:12px">${esc(n.body)}</div><div class="label">${U.dateStr(n.t)}</div></div></div>`).join("")
    : emptyState("bell", "No notifications yet.");
  U.sheet(t("Notifications"), items + (s.notifs.length ? `<button class="btn btn-ghost btn-block" data-clear style="margin-top:12px">Clear all</button>` : ""), el => {
    el.querySelector("[data-clear]")?.addEventListener("click", () => { s.notifs = []; store.save(); U.closeLayer(); U.toast("Notifications cleared", "ok"); });
  });
}
function openLang(){
  const cur = store.s.settings.lang;
  U.sheet(t("Language"), [["en","English","🇬🇧"],["hi","हिन्दी (Hindi)","🇮🇳"]].map(([k,n,f]) => `<button class="list-item" style="width:100%" data-l="${k}"><span style="font-size:22px">${f}</span><span class="grow" style="font-weight:500">${n}</span>${cur===k?`<span class="brand-c">${ic("check",20)}</span>`:""}</button>`).join(""), el => {
    el.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { store.s.settings.lang = b.dataset.l; store.save(); U.closeLayer(); U.bus.emit("lang"); U.toast("Language updated", "ok"); });
  });
}
function openMenu(){
  const links = [["home","Home","#/home"],["chart","Markets","#/markets"],["candle","Binary Options","#/trade"],["layers","Futures","#/futures"],["wallet","Assets","#/assets"],["gift","Rewards Hub","#/rewards"],["book","Academy","#/academy"],["ring","Price Alerts","#/alerts"],["bot","Trading Bots","#/bots"],["auto","Auto Trading","#/auto"],["crown","VIP Signals","#/vip"],["users","Referral","#/referral"],["chat","Community","#/community"],["user","Profile","#/profile"],["gear","Settings","#/settings"],["info","About Us","#/about"],["headset","Contact Support","#/support"]];
  const cur = location.hash.split("?")[0], p = store.s.profile, lv = E.level();
  U.drawer(`<div style="padding:20px">
      <a href="#/home" class="logo" style="margin-bottom:16px">${logo(26)}${esc(C.APP_NAME)}</a>
      <a href="#/profile" class="row" style="margin-top:14px"><span class="avatar">${esc(p.name[0])}</span><div class="grow"><b>${esc(p.name)}</b><div class="label">UID ${p.uid} · Lv.${lv.lvl}</div></div></a>
      <div class="xp" style="margin-top:10px"><i style="width:${lv.cur/lv.need*100}%"></i></div>
    </div>
    <nav aria-label="Main menu">${links.map(([i,n,h]) => `<a href="${h}" class="${cur===h?"on":""}">${ic(i,20)}<span>${esc(t(n))}</span></a>`).join("")}</nav>
    <div style="height:24px"></div>`, el => el.querySelectorAll("a").forEach(a => a.addEventListener("click", () => U.closeLayer())));
}

window.UI = {pairIcon, letter, usdt, logo, footer, pageHead, emptyState, openNotifs, openLang, openMenu};
})();
