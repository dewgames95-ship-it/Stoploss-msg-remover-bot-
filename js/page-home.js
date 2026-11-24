/* ===== Home + Markets ===== */
(function(){
const C = window.CONFIG, {esc, ic, t, store, bus, money, signed, pct, spark} = U;
window.Pages = window.Pages || {};
const S = () => store.s;

/* ---------- Reusable live market list ---------- */
const TABS = [["fav","Favorites"],["popular","Popular"],["gainers","Gainers"],["losers","Losers"],["crypto","Crypto"],["forex","Forex"],["commodities","Commodities"]];
function marketList(box, o = {}){
  let tab = o.tab || sessionStorage.getItem("mktTab") || "popular", q = "", limit = o.limit || 0, sort = null, rows = new Map(), dirty = new Set();
  const offs = [];
  const crypto = () => M.cryptoOrder.map(s => M.get(s)).filter(Boolean);
  function list(){
    const all = [...M.pairs.values()];
    const qq = q.trim().toUpperCase().replace("/","");
    let l;
    if (qq) l = all.filter(p => p.sym.includes(qq) || p.name.toUpperCase().includes(qq) || M.label(p).replace("/","").includes(qq)).sort((a,b) => (b.tradable - a.tradable) || ((a.rank||999) - (b.rank||999)));
    else if (tab === "fav") l = S().favs.map(s => M.get(s)).filter(Boolean);
    else if (tab === "crypto") l = crypto();
    else if (tab === "gainers") l = [...crypto(), ...all.filter(p => p.type !== "crypto" && !p.closed)].filter(p => p.chg > 0).sort((a,b) => b.chg - a.chg);
    else if (tab === "losers") l = [...crypto(), ...all.filter(p => p.type !== "crypto" && !p.closed)].filter(p => p.chg < 0).sort((a,b) => a.chg - b.chg);
    else if (tab === "forex") l = all.filter(p => p.type === "forex");
    else if (tab === "commodities") l = all.filter(p => p.type === "metal");
    else { const top = crypto().filter(p => p.tradable); l = [...top.slice(0,5), M.get("XAUUSD"), M.get("EURUSD"), ...top.slice(5), M.get("GBPUSD"), M.get("XAGUSD")].filter(Boolean); }
    if (sort){ const [k, d] = sort; l = l.slice().sort((a,b) => ((a[k] ?? -1e18) - (b[k] ?? -1e18)) * d); }
    return l;
  }
  const vol = p => p.qv ? "Vol " + CH.fmtVol(p.qv) : p.type === "forex" ? "Forex · " + p.quote : "Spot metal";
  function badge(p){
    if (p.closed) return `<span class="tag">Closed</span>`;
    if (p.type === "crypto") return p.tradable ? `<span class="tag t-y">Binary</span>` : `<span class="tag">Perp</span>`;
    return `<span class="tag t-y">${p.type === "forex" ? "FX" : "Metal"}</span>`;
  }
  const chgTxt = p => p.closed ? '<span class="label">Closed</span>' : p.chg == null ? "--" : `<span class="${p.chg < 0 ? "down" : "up"}">${pct(p.chg)}</span>`;
  const chgHtml = p => p.closed ? `<span class="chg closed">Closed</span>` : p.chg == null ? `<span class="chg closed">--</span>` : `<span class="chg ${p.chg < 0 ? "neg" : ""}">${pct(p.chg)}</span>`;
  function render(){
    let l = list(); rows.clear();
    const more = limit && l.length > limit; if (limit) l = l.slice(0, limit);
    if (!M.cryptoOrder.length && ["popular","crypto","gainers","losers"].includes(tab) && !q){ box.innerHTML = Array(6).fill('<div class="skel"></div>').join(""); return; }
    if (!l.length){ box.innerHTML = UI.emptyState(tab === "fav" ? "star" : "search", q ? `No results for “${q}”` : tab === "fav" ? "No favorites yet. Tap ☆ on a trading screen to add one." : "No markets here right now."); return; }
    box.innerHTML = l.map(p => o.plain ? `<div class="mkt-row" data-sym="${p.sym}" role="button" tabindex="0" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">
      <div class="row" style="gap:10px;min-width:0"><button class="star ${S().favs.includes(p.sym)?"on":""}" data-fav="${p.sym}" aria-label="Favorite">${ic("star",16)}</button>${UI.pairIcon(p,30)}<div class="grow"><div class="sym ellipsis">${esc(p.type === "crypto" ? p.base + "USDT" : p.sym)} <span class="perp">Perp</span></div><div class="sub2"><span class="ellipsis">${esc(UI.fullName(p))}</span>${p.qv ? `<span style="color:var(--line)">|</span>${CH.fmtVol(p.qv)}` : ""}</div></div></div>
      <div style="text-align:right;min-width:0"><div class="px num" data-px>${M.fmtPx(p)}</div><div data-chg class="num" style="font-size:13px;font-weight:500">${chgTxt(p)}</div></div></div>`
    : `<div class="mkt-row" data-sym="${p.sym}" role="button" tabindex="0" aria-label="Open ${esc(M.label(p))}">
      <div class="row" style="gap:10px;min-width:0">${UI.pairIcon(p)}<div class="grow"><div class="sym ellipsis">${esc(p.type === "crypto" ? p.base + "USDT" : p.sym)}</div><div class="sub2"><span class="ellipsis">${esc(UI.fullName(p))}</span></div></div></div>
      <div style="min-width:0"><div class="px num" data-px>${M.fmtPx(p)}</div><div class="sub2 num" style="justify-content:flex-end">$${M.fmtPx(p, p.quote === "JPY" ? p.price/ (M.get("USDJPY")?.price||1) : p.price)}</div></div><div data-chg>${chgHtml(p)}</div></div>`).join("")
      + (more ? `<a class="more-btn" href="#/markets">View all markets ${ic("chev",14)}</a>` : "");
    box.querySelectorAll(".mkt-row").forEach(r => rows.set(r.dataset.sym, {px:r.querySelector("[data-px]"), chg:r.querySelector("[data-chg]")}));
  }
  function flush(){
    dirty.forEach(sym => {
      const r = rows.get(sym), p = M.get(sym); if (!r || !p) return;
      const txt = M.fmtPx(p);
      if (r.px.textContent !== txt){ r.px.textContent = txt; r.px.classList.remove("fu","fd"); void r.px.offsetWidth; r.px.classList.add(p.dir >= 0 ? "fu" : "fd"); setTimeout(() => r.px.classList.remove("fu","fd"), 300); }
      r.chg.innerHTML = o.plain ? chgTxt(p) : chgHtml(p);
    });
    dirty.clear();
  }
  box.addEventListener("click", e => {
    const f = e.target.closest("[data-fav]"); if (f){ e.stopPropagation(); const i = S().favs.indexOf(f.dataset.fav); if (i >= 0) S().favs.splice(i,1); else S().favs.push(f.dataset.fav); store.save(); f.classList.toggle("on", i < 0); if (tab === "fav") render(); return; }
    const r = e.target.closest(".mkt-row"); if (r) location.hash = "#/chart/" + r.dataset.sym; });
  box.addEventListener("keydown", e => { const r = e.target.closest(".mkt-row"); if (r && e.key === "Enter") r.click(); });
  offs.push(bus.on("tick", s => dirty.add(s)), bus.on("meta", s => dirty.add(s)), bus.on("list", render));
  const iv = setInterval(flush, 500);
  render();
  return {render, setTab(k){ tab = k; sessionStorage.setItem("mktTab", k); render(); }, setQ(v){ q = v; render(); }, setSort(s){ sort = s; render(); }, get tab(){ return tab; }, destroy(){ offs.forEach(f => f()); clearInterval(iv); }};
}
window.UI.marketList = marketList;
const tabsHtml = cur => `<div class="tabs" role="tablist">${TABS.map(([k,n]) => `<button class="tab ${cur===k?"on":""}" data-tab="${k}" role="tab">${esc(t(n))}</button>`).join("")}</div>`;
function bindTabs(root, ml){ root.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { root.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x===b)); ml.setTab(b.dataset.tab); }); }
function sortHead(){ return `<div class="mkt-head"><span>Name / Vol</span><button data-sort="price">Last Price ⇅</button><button data-sort="chg" style="text-align:right">24h Chg% ⇅</button></div>`; }
function bindSort(root, ml){ let st = {}; root.querySelectorAll("[data-sort]").forEach(b => b.onclick = () => { const k = b.dataset.sort; st[k] = st[k] === -1 ? 1 : st[k] === 1 ? 0 : -1; Object.keys(st).forEach(x => x !== k && (st[x] = 0)); ml.setSort(st[k] ? [k, st[k]] : null); }); }

/* ---------- Illustrations ---------- */
const ROBOT = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="rgba(46,107,255,.12)"/><path d="M60 14v10" stroke="#2E6BFF" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="12" r="5" fill="#5AA9FF"/>
<rect x="28" y="26" width="64" height="48" rx="16" fill="#5AA9FF"/><rect x="36" y="36" width="48" height="26" rx="10" fill="#0F172A"/>
<circle cx="50" cy="49" r="5" fill="#12B886"><animate attributeName="r" values="5;3;5" dur="2.4s" repeatCount="indefinite"/></circle><circle cx="70" cy="49" r="5" fill="#12B886"><animate attributeName="r" values="5;3;5" dur="2.4s" repeatCount="indefinite"/></circle>
<rect x="20" y="42" width="8" height="18" rx="4" fill="#2E6BFF"/><rect x="92" y="42" width="8" height="18" rx="4" fill="#2E6BFF"/>
<rect x="38" y="78" width="44" height="26" rx="10" fill="#2E6BFF"/><path d="M48 92l8-6 6 4 10-8" stroke="#0F172A" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ROCKET = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="rgba(14,203,129,.14)"/>
<g transform="rotate(35 60 60)"><path d="M60 14c14 12 18 32 14 54H46c-4-22 0-42 14-54z" fill="#EAECEF"/><circle cx="60" cy="44" r="8" fill="#12B886" stroke="#0F172A" stroke-width="3"/>
<path d="M46 60l-12 14 14-2zM74 60l12 14-14-2z" fill="#5AA9FF"/><path d="M50 70h20l-4 10h-12z" fill="#B7BDC6"/>
<path d="M54 82c2 10 6 16 6 16s4-6 6-16z" fill="#F7931A"><animate attributeName="d" values="M54 82c2 10 6 16 6 16s4-6 6-16z;M54 82c2 14 6 22 6 22s4-8 6-22z;M54 82c2 10 6 16 6 16s4-6 6-16z" dur=".5s" repeatCount="indefinite"/></path></g></svg>`;
const LEV = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="rgba(46,107,255,.16)"/><text x="60" y="72" text-anchor="middle" font-size="40" font-weight="800" fill="#5AA9FF" font-family="IBM Plex Sans">125x</text><path d="M22 92h76" stroke="#5AA9FF" stroke-width="3" stroke-linecap="round"/><path d="M30 86l14-10 12 6 18-16 16 6" fill="none" stroke="#12B886" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const TILES = [
  ["Deposit","deposit","ic-b","#/deposit"],["Withdraw","withdraw","ic-b","#/withdraw"],["Futures","layers","ic-b","#/futures","125x"],["Options","target","ic-b","#/options","NEW"],
  ["Copy Trading","users","ic-b","#/copy"],["Trading Bots","bot","ic-b","#/bots"],["Earn","earn","ic-b","#/withdraw"],["More","grid","ic-b","#more"]
];

/* ---------- Home ---------- */
Pages.home = () => {
  let offs = [], timers = [], ml, slide = 0;
  const s = S();
  const html = `
  <header class="topbar">
    <button class="avatar" data-menu aria-label="Open menu">${esc(s.profile.name[0])}</button>
    <label class="search"><span>${ic("search",16)}</span><span class="sr">Search markets</span><input id="q" type="search" placeholder="${esc(t("Search e.g., SOL"))}" autocomplete="off" enterkeyhint="search"></label>
    <button class="icon-btn" data-lang aria-label="Language">${ic("globe",20)}</button>
    <button class="icon-btn" data-bell aria-label="Notifications">${ic("bell",20)}<span class="badge-dot hide" id="nb"></span></button>
    <a class="icon-btn" href="#/settings" aria-label="Settings">${ic("gear",20)}</a>
  </header>
  <div class="home-grid">
   <div class="stack">
    <section class="card" aria-label="Total assets">
      <div class="assets-top">
        <div>
          <div class="row label">Est. ${esc(t("Total Assets"))} <button class="eye" data-eye aria-label="Show or hide balance">${ic(s.settings.hideBal?"eyeoff":"eye",14)}</button></div>
          <div class="bal num" id="bal"></div>
          <div class="row label" style="gap:6px">${esc(t("Today's PnL"))} <b id="tp" class="num"></b> <a href="#/assets" class="chev">${ic("chev",14)}</a></div>
        </div>
        <a class="pnl-mini" href="#/assets" aria-label="Assets overview"><div class="grow"><div class="label">Balance trend</div><div class="label" id="tpn"></div></div><div id="tps"></div></a>
      </div>
      <div class="row" style="margin-top:14px"><a class="btn btn-primary grow" href="#/deposit">${esc(t("Deposit"))}</a><a class="btn btn-ghost grow" href="#/trade">${esc(t("Trade"))}</a><a class="btn btn-ghost grow" href="#/futures">Futures</a></div>
    </section>
    <a class="annc" href="#/options">${ic("volume",15)}<span class="annc-t"><span>Options trading is now live — BTC, ETH, BNB, SOL, XRP & DOGE calls and puts, cash-settled in USDT.</span></span>${ic("chev",14)}</a>
    <section class="card row" id="ck" style="padding:12px 14px"></section>
    <section class="carousel" aria-label="Featured">
      <div class="slides" id="slides">
        <div class="slide" data-go="#/bots"><div class="grow"><h3>Future Combo Bot</h3><p>Automate futures strategies with smart hedging.</p><span class="pill">Start now</span></div>${ROBOT}</div>
        <div class="slide s2" data-go="#/options"><div class="grow"><h3>Options are live</h3><p>Buy calls & puts on BTC, ETH and more. Max loss = premium.</p><span class="pill">Trade options</span></div>${ROCKET}</div>
        <div class="slide s3" data-go="#/futures"><div class="grow"><h3>Futures up to 125x</h3><p>Long or short with TP/SL and live liquidation price.</p><span class="pill">Trade futures</span></div>${LEV}</div>
      </div>
      <div class="dots" id="dots"><i class="on"></i><i></i><i></i></div>
    </section>
    <nav class="card tiles" aria-label="Quick actions">
      ${TILES.map(([n,i,c,h,b]) => `<a class="tile" href="${h}" ${h === "#more" ? "data-more" : ""}><span class="ic ${c}">${ic(i,22)}${b?`<b>${b}</b>`:""}</span><span>${esc(t(n))}</span></a>`).join("")}
    </nav>
    <div>
      <div class="sec-h"><span class="title">Top movers</span><a href="#/markets">More ${ic("chev",12)}</a></div>
      <div class="movers" id="mv"></div>
    </div>
   </div>
    <section class="card" aria-label="Markets" style="padding:6px 14px 10px">
      <div class="sec-h" style="margin:8px 0 0"><h2 class="title">${esc(t("Markets"))}</h2><span class="label" id="mstat"></span></div>
      ${tabsHtml(sessionStorage.getItem("mktTab") || "popular")}
      ${sortHead()}
      <div id="mlist"></div>
    </section>
  </div>`;

  function renderBal(){
    const b = document.getElementById("bal"); if (!b) return;
    const hide = s.settings.hideBal, total = s.balance + E.vaultValue() + s.fut.positions.reduce((a,p) => a + p.margin + E.futPnl(p).pnl, 0) + s.positions.reduce((a,p) => a + p.amount, 0);
    b.innerHTML = hide ? "******" : `${money(total)}<small>USDT</small>`;
    const st = E.stats(), fToday = s.fut.history.filter(x => x.closed >= new Date().setHours(0,0,0,0)).reduce((a,x) => a + x.profit, 0), tp = st.todayPnl + fToday;
    const el = document.getElementById("tp"); el.textContent = hide ? "****" : `${signed(tp)} (${signed(tp / U.store.s.balance * 100 || 0)}%)`; el.className = "num " + (tp > 0 ? "up" : tp < 0 ? "down" : "");
    document.getElementById("tpn").textContent = `${st.today.length} trades today`;
    document.getElementById("tps").innerHTML = spark([C.START_BALANCE, ...s.balHist.map(x => x.b)].slice(-60), 96, 34);
  }
  function renderCheck(){
    const el = document.getElementById("ck"); if (!el) return;
    const done = s.rewards.checkins.includes(E.dayKey()), st = E.streak(), amt = E.CHECKIN[st % 7];
    el.innerHTML = `<span class="ic ic-y" style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--brand-soft)">${ic("flame",18)}</span>
      <div class="grow"><b style="font-size:14px">${done ? `Checked in · ${st}-day streak` : "Daily check-in"}</b><div class="label">${done ? "Come back tomorrow for a bigger reward" : `Claim +${amt} USDT · Day ${st % 7 + 1} of 7`}</div></div>
      ${done ? `<a class="btn btn-ghost btn-sm" href="#/rewards">Rewards</a>` : `<button class="btn btn-primary btn-sm" data-ci>Check in</button>`}`;
    el.querySelector("[data-ci]")?.addEventListener("click", () => { const r = E.checkIn(); if (r){ U.toast(`Checked in! +${r.amt} USDT`, "ok"); U.fx("claim"); U.confetti(); renderCheck(); } });
  }
  async function renderMovers(){
    const box = document.getElementById("mv"); if (!box) return;
    const c = M.cryptoOrder.map(x => M.get(x)).filter(p => p && p.chg != null);
    if (!c.length){ box.innerHTML = Array(3).fill('<div class="skel" style="height:96px"></div>').join(""); return; }
    const pick = [...c.slice().sort((a,b) => b.chg - a.chg).slice(0,3), ...c.slice().sort((a,b) => a.chg - b.chg).slice(0,3)];
    box.innerHTML = pick.map(p => `<div class="mover" data-s="${p.sym}"><div class="row">${UI.pairIcon(p,20)}<b style="font-size:13px" class="ellipsis">${esc(p.base)}<span class="label">/USDT</span></b></div>
      <div class="num" style="font-weight:600;font-size:15px;margin-top:6px">${M.fmtPx(p)}</div><b class="num ${p.chg>=0?"up":"down"}" style="font-size:12px">${pct(p.chg)}</b><div data-sp></div></div>`).join("");
    box.querySelectorAll("[data-s]").forEach(m => m.onclick = () => location.hash = "#/chart/" + m.dataset.s);
    for (const p of pick){
      try {
        const key = "spk_" + p.sym; let v = JSON.parse(sessionStorage.getItem(key) || "null");
        if (!v){ const k = await M.candles(p.sym, "15m"); v = k.slice(-48).map(b => b.close); sessionStorage.setItem(key, JSON.stringify(v)); }
        const el = box.querySelector(`[data-s="${p.sym}"] [data-sp]`); if (el) el.innerHTML = spark(v, 140, 32);
      } catch {}
    }
  }
  function renderNotif(){ const n = document.getElementById("nb"); if (!n) return; n.textContent = s.unread > 9 ? "9+" : s.unread; n.classList.toggle("hide", !s.unread); }
  function renderStatus(){ const el = document.getElementById("mstat"); if (!el) return; const ok = M.status.crypto === "live"; el.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${ok?"var(--up)":"var(--warn)"};margin-right:5px;vertical-align:middle"></span>${ok ? "Live" : "Connecting"}`; }

  return {html, title:"Home", mount(root){
    renderBal(); renderCheck(); renderNotif(); renderStatus(); renderMovers();
    ml = marketList(root.querySelector("#mlist"), {limit:15});
    bindTabs(root, ml); bindSort(root, ml);
    const qi = root.querySelector("#q");
    qi.addEventListener("input", () => ml.setQ(qi.value));
    root.querySelector("[data-menu]").onclick = UI.openMenu;
    root.querySelector("[data-more]").onclick = e => { e.preventDefault(); UI.openMenu(); };
    root.querySelector("[data-lang]").onclick = UI.openLang;
    root.querySelector("[data-bell]").onclick = UI.openNotifs;
    root.querySelector("[data-eye]").onclick = e => { s.settings.hideBal = !s.settings.hideBal; store.save(); e.currentTarget.innerHTML = ic(s.settings.hideBal?"eyeoff":"eye",14); renderBal(); };
    const slides = root.querySelector("#slides"), dots = [...root.querySelectorAll("#dots i")];
    const go = i => { slide = (i + 3) % 3; slides.style.transform = `translateX(-${slide*100}%)`; dots.forEach((d,k) => d.classList.toggle("on", k === slide)); };
    let auto = setInterval(() => go(slide+1), 4500); timers.push(() => clearInterval(auto));
    let sx = null;
    slides.addEventListener("touchstart", e => { sx = e.touches[0].clientX; clearInterval(auto); }, {passive:true});
    slides.addEventListener("touchend", e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(slide + (dx < 0 ? 1 : -1)); sx = null; auto = setInterval(() => go(slide+1), 4500); }, {passive:true});
    slides.querySelectorAll("[data-go]").forEach(sl => sl.onclick = () => location.hash = sl.dataset.go);
    offs.push(bus.on("balance", renderBal), bus.on("history", renderBal), bus.on("notifs", renderNotif), bus.on("status", renderStatus), bus.on("rewards", renderCheck), bus.on("list", renderMovers));
    const bi = setInterval(renderBal, 3000); timers.push(() => clearInterval(bi));
  }, unmount(){ offs.forEach(f => f()); timers.forEach(f => f()); ml?.destroy(); }};
};

/* ---------- Markets ---------- */
Pages.markets = () => {
  let ml;
  const html = `<header class="page-head"><h1 class="h1">Markets</h1><a class="icon-btn" href="#/alerts" aria-label="Price alerts">${ic("bell",20)}</a></header>
    <label class="search" style="margin-bottom:8px"><span>${ic("search",16)}</span><span class="sr">Search</span><input id="mq" type="search" placeholder="Search coin, forex or metal" autocomplete="off"></label>
    <div class="kpis" id="ov" style="margin:12px 0"></div>
    <div>${tabsHtml(sessionStorage.getItem("mktTab") || "popular")}<div class="mkt-head" style="grid-template-columns:1fr auto"><span>Name / Vol</span><span><button data-sort="price">Last Price ⇅</button> / <button data-sort="chg">24h Chg ⇅</button></span></div><div id="ml"></div></div>`;
  return {html, title:"Markets", mount(r){
    ml = marketList(r.querySelector("#ml"), {plain:true});
    bindTabs(r, ml); bindSort(r, ml);
    r.querySelector("#mq").addEventListener("input", e => ml.setQ(e.target.value));
    const ov = () => {
      const c = M.cryptoOrder.map(x => M.get(x)).filter(Boolean); if (!c.length) return;
      const up = c.filter(p => p.chg > 0).length, vol = c.reduce((a,p) => a + (p.qv||0), 0), btc = M.get("BTCUSDT"), g = M.get("XAUUSD");
      r.querySelector("#ov").innerHTML = `<div class="kpi"><span class="label">24h Volume (Top 100)</span><b class="num">$${CH.fmtVol(vol)}</b></div><div class="kpi"><span class="label">Advancers / Decliners</span><b class="num"><span class="up">${up}</span> / <span class="down">${c.length-up}</span></b></div>
        <div class="kpi"><span class="label">BTC</span><b class="num ${btc?.chg>=0?"up":"down"}">${M.fmtPx(btc)}</b></div><div class="kpi"><span class="label">Gold (XAU)</span><b class="num ${g?.chg>=0?"up":"down"}">${M.fmtPx(g)}</b></div>`;
    };
    ov(); const iv = setInterval(ov, 3000); const off = bus.on("list", ov);
    this.unmount = () => { ml.destroy(); clearInterval(iv); off(); };
  }};
};
})();
