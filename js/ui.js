/* ===== Shared UI pieces ===== */
(function(){
const C = window.CONFIG, {esc, ic, t, store} = U;

const COLORS = ["#2E6BFF","#12B886","#5AA9FF","#5AA9FF","#F0435A","#14B8C9","#F7931A","#0EA5E9"];
const LG = () => window.LOGOS;
/* monogram fallback: crafted gradient SVG disc (never a plain flat text circle) */
function letter(txt, size=28){
  if (LG()) return LG().mono(txt, size);
  let h = 0; for (const c of txt) h = (h*31 + c.charCodeAt(0)) >>> 0;
  return `<span class="letter" style="width:${size}px;height:${size}px;background:${COLORS[h%COLORS.length]};font-size:${Math.round(size*.38)}px">${esc(txt.slice(0,2))}</span>`;
}
const METAL_SVG = {
  platinum:`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#2A2E36"/><path d="M8 27h11l2-6H10z" fill="#C9CED6"/><path d="M21 27h11l-2-6H23z" fill="#E3E7ED"/><path d="M14 20h12l-2-6h-8z" fill="#F4F6F9"/><path d="M16 14h8l-.6 1.6h-6.8z" fill="#fff" opacity=".8"/></svg>`,
  palladium:`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#2B2A30"/><path d="M8 27h11l2-6H10z" fill="#A9A3B5"/><path d="M21 27h11l-2-6H23z" fill="#C4BFCE"/><path d="M14 20h12l-2-6h-8z" fill="#DCD8E3"/><path d="M16 14h8l-.6 1.6h-6.8z" fill="#fff" opacity=".7"/></svg>`,
  gold:`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#3A3214"/><path d="M8 27h11l2-6H10z" fill="#E8B10E"/><path d="M21 27h11l-2-6H23z" fill="#F5C842"/><path d="M14 20h12l-2-6h-8z" fill="#FFD966"/><path d="M16 14h8l-.6 1.6h-6.8z" fill="#fff" opacity=".6"/></svg>`,
  silver:`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#2B3139"/><path d="M8 27h11l2-6H10z" fill="#9AA5B4"/><path d="M21 27h11l-2-6H23z" fill="#B8C1CD"/><path d="M14 20h12l-2-6h-8z" fill="#D4DAE2"/><path d="M16 14h8l-.6 1.6h-6.8z" fill="#fff" opacity=".7"/></svg>`
};
/* flags: bundled webp for the 8 majors, inline SVG for everything else (and as the error fallback) */
function flagImg(cc, sz, extra=""){
  const L = LG();
  if (L && !L.FLAG_BUNDLED.has(cc)) return L.flag(cc, sz, extra);
  return `<img class="coin" src="assets/flags/${cc}.webp" data-cc="${cc}" data-sz="${sz}" data-x="${esc(extra)}" onerror="UI.flagErr(this)" alt="" loading="lazy" style="width:${sz}px;height:${sz}px;${extra}">`;
}
function flagErr(img){ const L = LG(); if (L) img.outerHTML = L.flag(img.dataset.cc, +img.dataset.sz || 28, img.dataset.x || ""); else img.style.visibility = "hidden"; }
/* stock logos: Financial Modeling Prep CDN -> jsDelivr ticker-icons -> crafted monogram. Names with no public logo skip the network. */
const NOLOGO = new Set(["OPENAI","ANTHROPIC","QNTX","STXX","LYTE","OURA","MOONSHOT","USDEX"]);
const WHITE_LOGO = new Set("ABBV AMZN ANET APP CAT CEG DIS FLNC HIMS HUT IBM IREN MARA MRVL NIO NKE NOK QQQ SECZ SMCI SMH SOXL TMF TSLL UBER UNH V ZM".split(" "));   // logos drawn in white: shown on a dark disc
function stockImg(base, size, p){
  const L = LG(), b = String(base).toUpperCase();
  if (L && (NOLOGO.has(b) || (p && p.region))) return L.ticker(b, size);
  return `<img class="coin st-ic" src="https://financialmodelingprep.com/image-stock/${encodeURIComponent(b)}.png" alt="${esc(b)}" loading="lazy" data-b="${esc(b)}" data-st="0" style="width:${size}px;height:${size}px${WHITE_LOGO.has(b) ? ";background:#1B1F26" : ""}" onerror="UI.stErr(this)">`;
}
function stErr(img){
  const b = img.dataset.b, st = +img.dataset.st, sz = parseInt(img.style.width) || 28;
  if (st === 0){ img.dataset.st = 1; img.src = `https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/${encodeURIComponent(b)}.png`; return; }
  img.outerHTML = LG() ? LG().ticker(b, sz) : letter(b, sz);
}
function pairIcon(p, size=28){
  const L = LG();
  if (!p) return letter("?", size);
  if (p.type === "metal") return L ? L.metal(p.metal, size) : `<span style="width:${size}px;height:${size}px;display:block;flex-shrink:0">${METAL_SVG[p.metal] || METAL_SVG.gold}</span>`;
  if (p.type === "forex") return `<span style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;display:block">${flagImg(p.flags[0], size*.78, "position:absolute;left:0;top:0")}${flagImg(p.flags[1], size*.55, "position:absolute;right:0;bottom:0;border:1.5px solid var(--card)")}</span>`;
  if (p.type === "index") return `<span class="ix-ic" style="width:${size}px;height:${size}px">${flagImg(p.flag || "us", size)}</span>`;
  if (p.type === "commodity") return L ? L.commodity(p.sym, size) : letter(p.base.slice(0,3), size);
  if (p.type === "stock") return stockImg(p.base, size, p);
  return coinImg(p.base, size);
}
/* Official coin logo: bundled file -> CoinCap CDN -> crafted monogram. SOL = official Solana mark (inline SVG). */
const CDN = k => `https://assets.coincap.io/assets/icons/${k}@2x.png`;
function coinImg(base, size=28){
  const k = String(base).toLowerCase(), ext = (window.LOCAL_ICONS || {})[k];
  if (k === "sol" && LG()) return LG().sol(size);
  const src = ext ? `assets/coins/${k}.${ext}` : CDN(k);
  return `<img class="coin" src="${src}" alt="${esc(base)}" loading="lazy" decoding="async" data-k="${esc(k)}" data-st="${ext ? 0 : 1}" style="width:${size}px;height:${size}px" onerror="UI.icoErr(this)">`;
}
function icoErr(img){
  const k = img.dataset.k, st = +img.dataset.st;
  if (st === 0){ img.dataset.st = 1; img.src = CDN(k); return; }
  const sz = parseInt(img.style.width) || 28; img.outerHTML = letter(k.toUpperCase(), sz);
}
/* ---- v6.9 market badges: "Market Open" + 24/7 (Binance TradFi perps) / 24/5 (weekday-only feeds) ---- */
function mktBadges(p){
  if (!p || p.type === "crypto") return "";
  const h247 = !!(p.h247 || p.synthetic);
  const st = p.closed ? `<span class="mk-st cl"><i></i>Market Closed</span>` : `<span class="mk-st"><i></i>Market Open</span>`;
  if (p.type === "stock" && !h247) return st;
  return st + `<span class="mk-bd">${h247 ? "24/7" : "24/5"}</span>`;
}
function mktTag(p, sub){
  if (p.pre) return `<em class="t">Pre-market</em>`;
  if (p.type === "crypto") return sub === "spot" ? "" : `<em>Perp</em>`;
  if (sub === "spot") return p.type === "stock" ? `<em class="t">Stock</em>` : "";
  if (p.h247 || p.synthetic) return `<em class="t">24/7</em>`;
  return p.type === "stock" ? `<em class="t">Stock</em>` : `<em class="t">24/5</em>`;
}
try {
  if (!document.getElementById("mk-css")){
    const st = document.createElement("style"); st.id = "mk-css";
    st.textContent = ".mk-st,.mk-bd{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;line-height:18px;padding:1px 7px;border-radius:6px;white-space:nowrap;vertical-align:middle}"
      + ".mk-st{background:var(--input);color:var(--text-2)}.mk-st i{width:11px;height:11px;border-radius:50%;border:2px solid var(--up);background:radial-gradient(circle,var(--up) 38%,transparent 42%);box-sizing:border-box;flex-shrink:0}"
      + ".mk-st.cl i{border-color:var(--down);background:radial-gradient(circle,var(--down) 38%,transparent 42%)}"
      + ".mk-bd{color:#F7931A;background:rgba(247,147,26,.14)}.fx-sub{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:2px;min-width:0}.fx-sub .fx-nm{font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:36vw}";
    document.head.appendChild(st);
  }
} catch(e){}
const usdt = (s=20) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#26A17B"/><path fill="#fff" d="M17.9 17.4c-.1 0-.7.1-2 .1-1 0-1.7 0-2-.1-3.9-.2-6.8-.9-6.8-1.7s2.9-1.5 6.8-1.7v2.7c.3 0 1 .1 2 .1 1.2 0 1.8-.1 1.9-.1v-2.7c3.9.2 6.8.9 6.8 1.7s-2.9 1.5-6.8 1.7zm0-3.6v-2.4h5.4V7.8H8.7v3.6h5.4v2.4c-4.4.2-7.7 1.1-7.7 2.1s3.3 1.9 7.7 2.1v7.6h3.8V18c4.4-.2 7.7-1.1 7.7-2.1s-3.3-1.9-7.7-2.1z"/></svg>`;
const logo = (s=24) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="nlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2E6BFF"/><stop offset="1" stop-color="#5AA9FF"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#nlg)"/><path d="M15 42l10-11 8 7 15-17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="48" cy="20" r="5" fill="#fff"/></svg>`;

/* End-of-page graphic (replaces footer links) */
const ART = `<svg class="art" viewBox="0 0 340 120" aria-hidden="true">
  <defs><linearGradient id="ea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2E6BFF" stop-opacity=".35"/><stop offset="1" stop-color="#2E6BFF" stop-opacity="0"/></linearGradient></defs>
  <path d="M0 96 L30 84 L55 90 L80 70 L105 76 L130 52 L155 60 L180 40 L205 48 L230 26 L255 34 L280 18 L310 24 L340 8 L340 120 L0 120Z" fill="url(#ea)"/>
  <path d="M0 96 L30 84 L55 90 L80 70 L105 76 L130 52 L155 60 L180 40 L205 48 L230 26 L255 34 L280 18 L310 24 L340 8" fill="none" stroke="#2E6BFF" stroke-width="2.5"/>
  ${[[40,70,12,"#12B886"],[70,62,16,"#F0435A"],[100,58,14,"#12B886"],[130,40,18,"#12B886"],[160,48,12,"#F0435A"],[190,30,16,"#12B886"],[220,22,12,"#12B886"],[250,26,14,"#F0435A"],[280,10,16,"#12B886"]].map(([x,y,h,c]) => `<line x1="${x}" x2="${x}" y1="${y-6}" y2="${y+h+6}" stroke="${c}" stroke-width="1.5" opacity=".7"/><rect x="${x-4}" y="${y}" width="8" height="${h}" rx="1.5" fill="${c}" opacity=".85"/>`).join("")}
  <circle cx="340" cy="8" r="4" fill="#5AA9FF"><animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.4;1" dur="1.6s" repeatCount="indefinite"/></circle>
</svg>`;
function endcap(){
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
function notifCat(n){
  if (n.kind === "game" || n.cat === "game") return "game";
  if (n.kind === "predict" || n.cat === "predict") return "predict";
  if (n.cat === "trade") return "trade";
  const x = (n.title + " " + (n.body || "")).toLowerCase();
  if (/order|trade|position|liquidat|option|spot|copy trading|bot|settled|limit|tp\/sl|funding/.test(x)) return "trade";
  return "system";
}
function openNotifs(){
  const s = store.s; s.unread = 0; store.save(); U.bus.emit("notifs");
  const icn = n => n.cat === "game" ? "car" : n.cat === "predict" ? "predict" : n.kind === "ok" ? "check" : n.kind === "bad" ? "x" : /alert/i.test(n.title) ? "bell" : "info";
  const rel = ts => { const d = Date.now() - ts; if (d < 60e3) return "Just now"; if (d < 3600e3) return Math.floor(d / 60e3) + "m ago"; if (d < 86400e3) return Math.floor(d / 3600e3) + "h ago"; return U.dateStr(ts); };
  const TABS = [["all", "All"], ["trade", "Trades"], ["game", "Money Game"], ["predict", "Prediction"], ["system", "System"]];
  let tab = "all";
  const row = n => `<div class="nt-row ${n.read ? "" : "unread"}"><span class="nt-ic ${n.kind || "info"}">${ic(icn(n), 15, 2.2)}</span>
    <div class="nt-bd"><div class="nt-t">${esc(n.title)}</div><div class="nt-s">${esc(n.body || "")}</div></div><div class="nt-tm">${rel(n.t)}${n.read ? "" : `<i class="nt-dot"></i>`}</div></div>`;
  const body = () => {
    const list = s.notifs.filter(n => tab === "all" || notifCat(n) === tab);
    return list.length ? list.map(row).join("") : `<div class="nt-empty">${ic("bell", 34, 1.4)}<b>No notifications</b><span>${tab === "all" ? "Order fills, alerts and account updates will show up here." : "Nothing in this category yet."}</span></div>`;
  };
  // rows from before this opening count as unread only if newer than the last visit
  const seen = s.notifSeen || 0; s.notifs.forEach(n => { n.read = n.t <= seen; }); s.notifSeen = Date.now(); store.save();
  const html = `<div class="nt-tabs">${TABS.map(([k, l]) => `<button class="${k === tab ? "on" : ""}" data-nt="${k}">${l}</button>`).join("")}</div><div class="nt-list" id="ntl">${body()}</div>${s.notifs.length ? `<button class="nt-clear" data-clear>Clear all</button>` : ""}`;
  U.sheet(t("Notifications"), html, el => {
    const list = el.querySelector("#ntl");
    if (s.notifs.length) el.querySelector(".sheet-h")?.insertAdjacentHTML("beforeend", `<button class="nt-ra" data-allread aria-label="Mark all as read">${ic("check", 13, 2.4)}<span>Read all</span></button>`);
    el.querySelectorAll("[data-nt]").forEach(b => b.onclick = () => { tab = b.dataset.nt; el.querySelectorAll("[data-nt]").forEach(x => x.classList.toggle("on", x === b)); list.innerHTML = body(); });
    el.querySelector("[data-allread]")?.addEventListener("click", () => { s.notifs.forEach(n => n.read = true); list.innerHTML = body(); });
    el.querySelector("[data-clear]")?.addEventListener("click", () => { s.notifs = []; store.save(); U.closeLayer(); U.toast("Notifications cleared", "ok"); });
  });
}
function openLang(){ U.toast("English is the only language", "info"); }
function openMenu(){
  const links = [["home","Home","#/home"],["chart","Markets","#/markets"],["candle","Binary Options","#/trade"],["layers","Futures","#/futures"],["swap","Spot","#/spot"],["target","Options","#/options"],["users","Copy Trading","#/copy"],["wallet","Assets","#/assets"],["gift","Rewards Hub","#/rewards"],["book","Tutorial","#/academy"],["ring","Price Alerts","#/alerts"],["bot","Trading Bots","#/bots"],["users","Referral","#/referral"],["chat","Community","#/community"],["user","Profile","#/profile"],["gear","Settings","#/settings"],["info","About Us","#/about"],["headset","Contact Support","#/support"]];
  const cur = location.hash.split("?")[0], p = store.s.profile, lv = E.level();
  U.drawer(`<div style="padding:20px">
      <a href="#/home" class="logo" style="margin-bottom:16px">${logo(26)}${esc(C.APP_NAME)}</a>
      <a href="#/profile" class="row" style="margin-top:14px"><span class="avatar">${esc(p.name[0])}</span><div class="grow"><b>${esc(p.name)}</b><div class="label">UID ${p.uid} · Lv.${lv.lvl}</div></div></a>
      <div class="xp" style="margin-top:10px"><i style="width:${lv.cur/lv.need*100}%"></i></div>
    </div>
    <nav aria-label="Main menu">${links.map(([i,n,h]) => `<a href="${h}" class="${cur===h?"on":""}">${ic(i,20)}<span>${esc(t(n))}</span></a>`).join("")}</nav>
    <div style="height:24px"></div>`, el => el.querySelectorAll("a").forEach(a => a.addEventListener("click", () => U.closeLayer())));
}

/* v7.1: small centred info popup with an X (for every "?" icon). html may contain inline SVG. */
function tip(title, html){
  const el = U.modal(`<div class="uitip" role="dialog" aria-label="${esc(title)}"><div class="uitip-h"><b>${esc(title)}</b><button class="uitip-x" data-tipx aria-label="Close">${ic("close",16)}</button></div><div class="uitip-b">${html}</div></div>`);
  el.querySelector("[data-tipx]").onclick = () => U.closeLayer();
  return el;
}
window.UI = {tip, pairIcon, coinImg, icoErr, flagErr, stErr, stockImg, mktBadges, mktTag, letter, usdt, logo, endcap, footer: () => "", fullName: p => p.type === "crypto" ? (window.COIN_NAMES[p.base] || p.base) : (p.name || p.base), pageHead, emptyState, openNotifs, openLang, openMenu};
})();
