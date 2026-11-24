/* ===== Home + Markets (BingX style) ===== */
(function(){
const C = window.CONFIG, {esc, ic, t, store, bus, money, signed, pct} = U;
window.Pages = window.Pages || {};
const S = () => store.s;
/* make sure the stylesheet is present even if index.html was not updated */
if (!document.querySelector('link[href*="css/home.css"]')){ const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "css/home.css?v=5.3"; document.head.appendChild(l); }

/* ---------- Inline art (prefix-local, no dependencies) ---------- */
let gid = 0;
function hash(s){ let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function avatar(name, size = 34){
  const h = hash(name), hue = h % 360, hue2 = (hue + 40 + (h >> 8) % 60) % 360, id = "hav" + (++gid), kind = (h >> 4) % 3;
  const hair = kind === 0 ? `<path d="M30 40c0-12 8-18 20-18s20 6 20 18c-6-6-12-8-20-8s-14 2-20 8z" fill="hsl(${hue2} 30% 22%)"/>` : kind === 1 ? `<circle cx="50" cy="26" r="9" fill="hsl(${hue2} 30% 22%)"/>` : `<path d="M30 44c0-14 8-22 20-22 14 0 20 8 20 22-4-8-8-12-20-12s-16 4-20 12z" fill="hsl(${hue2} 30% 22%)"/>`;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 62%)"/><stop offset="1" stop-color="hsl(${hue2} 70% 48%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#${id})"/><path d="M14 100c2-22 16-30 36-30s34 8 36 30z" fill="rgba(255,255,255,.88)"/><circle cx="50" cy="46" r="17" fill="#FBD9B8"/>${hair}</svg>`;
}
function art(kind, size = 104){
  const i = ++gid, g = n => `${n}${i}`;
  const defs = {
    gold:`<linearGradient id="${g("a")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#E49B13"/></linearGradient>`,
    blue:`<linearGradient id="${g("b")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FA8FF"/><stop offset="1" stop-color="#2E55D8"/></linearGradient>`,
    silver:`<linearGradient id="${g("s")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F6FA"/><stop offset="1" stop-color="#A9B3C6"/></linearGradient>`
  };
  const A = `url(#${g("a")})`, B = `url(#${g("b")})`, Sv = `url(#${g("s")})`;
  const body = {
    trophy:`<ellipse cx="60" cy="108" rx="30" ry="6" fill="rgba(0,0,0,.12)"/><rect x="40" y="92" width="40" height="12" rx="3" fill="${B}"/><rect x="54" y="74" width="12" height="20" fill="${A}"/><path d="M34 22h52v26c0 16-12 28-26 28S34 64 34 48z" fill="${A}"/><path d="M34 30H20c0 14 6 22 18 24M86 30h14c0 14-6 22-18 24" fill="none" stroke="#E49B13" stroke-width="5" stroke-linecap="round"/><path d="M46 28v22c0 8 4 14 10 18" stroke="rgba(255,255,255,.55)" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M60 34l4 8 9 1-6.500 6 2 9-8.500-4.500L51.500 58l2-9-6.500-6 9-1z" fill="#fff" opacity=".85"/>`,
    coins:`<ellipse cx="60" cy="108" rx="40" ry="6" fill="rgba(0,0,0,.12)"/><rect x="22" y="70" width="76" height="30" rx="8" fill="${B}"/><rect x="22" y="70" width="76" height="8" rx="4" fill="rgba(255,255,255,.3)"/><circle cx="60" cy="42" r="26" fill="${A}"/><circle cx="60" cy="42" r="19" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="3"/><text x="60" y="51" text-anchor="middle" font-size="26" font-weight="800" fill="#fff" font-family="Manrope,sans-serif">$</text><circle cx="94" cy="28" r="9" fill="${Sv}"/><circle cx="26" cy="36" r="7" fill="${Sv}"/><rect x="34" y="84" width="52" height="6" rx="3" fill="rgba(255,255,255,.35)"/>`,
    shield:`<ellipse cx="60" cy="110" rx="28" ry="5" fill="rgba(0,0,0,.12)"/><path d="M60 8l38 14v32c0 26-16 44-38 54C38 98 22 80 22 54V22z" fill="${B}"/><path d="M60 8l38 14v32c0 26-16 44-38 54z" fill="rgba(255,255,255,.14)"/><path d="M42 58l13 13 24-26" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
    rocket:`<ellipse cx="60" cy="110" rx="26" ry="5" fill="rgba(0,0,0,.1)"/><path d="M60 8c16 10 24 30 22 54H38C36 38 44 18 60 8z" fill="${Sv}"/><path d="M60 8c16 10 24 30 22 54H60z" fill="rgba(0,0,0,.08)"/><circle cx="60" cy="40" r="9" fill="${B}"/><path d="M38 52L22 72l18-4zM82 52l16 20-18-4z" fill="${B}"/><path d="M48 66h24l-6 24h-12z" fill="${A}"/><path d="M54 70h12l-3 30h-6z" fill="#FFD36B"/>`,
    gift:`<ellipse cx="60" cy="108" rx="34" ry="6" fill="rgba(0,0,0,.12)"/><rect x="24" y="52" width="72" height="52" rx="6" fill="${B}"/><rect x="18" y="36" width="84" height="20" rx="6" fill="${B}"/><rect x="18" y="36" width="84" height="8" rx="4" fill="rgba(255,255,255,.25)"/><rect x="53" y="36" width="14" height="68" fill="${A}"/><path d="M60 36c-8-18-26-18-26-8s16 8 26 8c10 0 26 2 26-8s-18-10-26 8z" fill="none" stroke="#E49B13" stroke-width="5" stroke-linejoin="round"/>`,
    podium:`<ellipse cx="60" cy="108" rx="44" ry="6" fill="rgba(0,0,0,.12)"/><rect x="12" y="70" width="32" height="34" rx="4" fill="${Sv}"/><rect x="44" y="52" width="32" height="52" rx="4" fill="${A}"/><rect x="76" y="80" width="32" height="24" rx="4" fill="${B}"/><g font-family="Manrope,sans-serif" font-weight="800" font-size="18" fill="#fff" text-anchor="middle"><text x="28" y="94">2</text><text x="60" y="84">1</text><text x="92" y="98">3</text></g><path d="M60 14l5 11 12 1.500-9 8 2.500 12L60 40l-10.500 6.500L52 34.500l-9-8 12-1.500z" fill="${A}"/>`
  }[kind];
  const used = kind === "trophy" || kind === "podium" || kind === "coins" || kind === "rocket" || kind === "gift" ? defs.gold + defs.blue + defs.silver : defs.blue + defs.gold + defs.silver;
  return `<svg class="art" viewBox="0 0 120 120" aria-hidden="true"><defs>${used}</defs>${body}</svg>`;
}
window.HM = {avatar, art, hash};

/* ---------- Reusable live market list ---------- */
const CHIPS = [["fav","Favorites"],["hot","Hot"],["gainers","Gainers"],["losers","Losers"],["new","New"],["forex","Forex"],["metals","Metals"]];
function marketList(box, o = {}){
  let chip = o.tab || sessionStorage.getItem("mktChip") || "hot", sub = sessionStorage.getItem("mktSub") || "perp", q = "", limit = o.limit || 0;
  const rows = new Map(), dirty = new Set(), offs = [];
  const crypto = () => M.cryptoOrder.map(s => M.get(s)).filter(Boolean);
  function list(){
    const all = [...M.pairs.values()], qq = q.trim().toUpperCase().replace("/","");
    const moving = () => [...crypto(), ...all.filter(p => p.type !== "crypto" && !p.closed)];
    if (qq) return all.filter(p => p.sym.includes(qq) || p.name.toUpperCase().includes(qq) || M.label(p).replace("/","").includes(qq)).sort((a,b) => (b.tradable - a.tradable) || ((a.rank||999) - (b.rank||999)));
    let l;
    if (chip === "fav") l = S().favs.map(s => M.get(s)).filter(Boolean);
    else if (chip === "gainers") l = moving().filter(p => p.chg > 0).sort((a,b) => b.chg - a.chg);
    else if (chip === "losers") l = moving().filter(p => p.chg < 0).sort((a,b) => a.chg - b.chg);
    else if (chip === "new") l = crypto().slice(-40).reverse();
    else if (chip === "forex") l = all.filter(p => p.type === "forex");
    else if (chip === "metals") l = all.filter(p => p.type === "metal");
    else { const top = crypto(); l = [...top.slice(0,5), M.get("XAUUSD"), M.get("EURUSD"), ...top.slice(5), M.get("GBPUSD"), M.get("XAGUSD")].filter(Boolean); }
    if (sub === "spot") l = l.filter(p => p.type === "crypto");
    return l;
  }
  const vol = p => p.qv ? "Vol " + CH.fmtVol(p.qv) : p.type === "forex" ? "Forex · " + p.quote : "Spot metal";
  const tag = p => p.type === "crypto" ? (sub === "spot" ? "" : `<em>Perp</em>`) : `<em class="t">24/7</em>`;
  const chgHtml = p => p.closed ? `<span class="hm-chg cl">Closed</span>` : p.chg == null ? `<span class="hm-chg cl">--</span>` : `<span class="hm-chg ${p.chg < 0 ? "neg" : ""}">${p.chg >= 0 ? "+" : ""}${p.chg.toFixed(2)}%</span>`;
  const usd = p => "$" + M.fmtPx(p, p.quote === "JPY" ? p.price / (M.get("USDJPY")?.price || 1) : p.price);
  function render(){
    let l = list(); rows.clear();
    const more = limit && l.length > limit; if (limit) l = l.slice(0, limit);
    if (!M.cryptoOrder.length && !q && !["forex","metals","fav"].includes(chip)){ box.innerHTML = Array(6).fill('<div class="skel"></div>').join(""); return; }
    if (!l.length){ box.innerHTML = UI.emptyState(chip === "fav" ? "star" : "search", q ? `No results for “${q}”` : chip === "fav" ? "No favorites yet. Tap the star on a trading screen to add one." : "No markets here right now."); return; }
    box.innerHTML = `<div class="hm-hd"><span>Name / Vol</span><span>Last Price</span><span>24h Chg%</span></div>` + l.map(p => `<div class="hm-row" data-sym="${p.sym}" role="button" tabindex="0" aria-label="Open ${esc(M.label(p))}">
      <div class="hm-nm">${UI.pairIcon(p, 32)}<div style="min-width:0"><div class="hm-sym"><span class="ellipsis">${esc(p.type === "crypto" ? p.base + "USDT" : p.sym)}</span>${tag(p)}</div><div class="hm-s2">${esc(UI.fullName(p))} · ${vol(p)}</div></div></div>
      <div class="hm-px"><b class="num" data-px>${M.fmtPx(p)}</b><span class="num" data-usd>${usd(p)}</span></div><div data-chg>${chgHtml(p)}</div></div>`).join("")
      + (more ? `<a class="hm-more" href="#/markets">View all markets</a>` : "");
    box.querySelectorAll(".hm-row").forEach(r => rows.set(r.dataset.sym, {px:r.querySelector("[data-px]"), usd:r.querySelector("[data-usd]"), chg:r.querySelector("[data-chg]")}));
  }
  function flush(){
    dirty.forEach(sym => { const r = rows.get(sym), p = M.get(sym); if (!r || !p) return;
      const txt = M.fmtPx(p);
      if (r.px.textContent !== txt){ r.px.textContent = txt; r.usd.textContent = usd(p); r.px.classList.remove("fu","fd"); void r.px.offsetWidth; r.px.classList.add(p.dir >= 0 ? "fu" : "fd"); setTimeout(() => r.px.classList.remove("fu","fd"), 300); }
      r.chg.innerHTML = chgHtml(p); });
    dirty.clear();
  }
  box.addEventListener("click", e => { const r = e.target.closest(".hm-row"); if (!r) return;
    const p = M.get(r.dataset.sym); location.hash = (sub === "spot" && p && p.type === "crypto" ? "#/spot/" : "#/futures/") + r.dataset.sym; });
  box.addEventListener("keydown", e => { const r = e.target.closest(".hm-row"); if (r && e.key === "Enter") r.click(); });
  offs.push(bus.on("tick", s => dirty.add(s)), bus.on("meta", s => dirty.add(s)), bus.on("list", render));
  const iv = setInterval(flush, 500);
  render();
  return {render, setTab(k){ chip = k; sessionStorage.setItem("mktChip", k); render(); }, setSub(k){ sub = k; sessionStorage.setItem("mktSub", k); render(); }, setQ(v){ q = v; render(); }, get tab(){ return chip; }, get sub(){ return sub; }, destroy(){ offs.forEach(f => f()); clearInterval(iv); }};
}
window.UI.marketList = marketList;
const curChip = () => sessionStorage.getItem("mktChip") || "hot", curSub = () => sessionStorage.getItem("mktSub") || "perp";
const chipsHtml = () => `<div class="hm-chips" role="tablist">${CHIPS.map(([k,n]) => `<button data-chip="${k}" role="tab" class="${curChip()===k?"on":""}">${esc(n)}</button>`).join("")}</div>
  <div class="hm-sub"><button data-sub="perp" class="${curSub()==="perp"?"on":""}">Perp Futures</button><button data-sub="spot" class="${curSub()==="spot"?"on":""}">Spot</button></div>`;
function bindChips(root, ml){
  root.querySelectorAll("[data-chip]").forEach(b => b.onclick = () => { root.querySelectorAll("[data-chip]").forEach(x => x.classList.toggle("on", x === b)); ml.setTab(b.dataset.chip); });
  root.querySelectorAll("[data-sub]").forEach(b => b.onclick = () => { root.querySelectorAll("[data-sub]").forEach(x => x.classList.toggle("on", x === b)); ml.setSub(b.dataset.sub); });
}

/* ---------- Home ---------- */
const SHORT = [
  ["Copy Trading","users","#/copy"],["Rewards Hub","gift","#/rewards"],["Futures","layers","#/futures"],["Spot","chart","#/spot"],["Options","target","#/options"],
  ["Trading Bots","bot","#/bots"],["Earn","earn","#/earn"],["Refer","share","#/referral"],["More","grid","#more"]
];
const SLIDES = [
  ["Join the Rewards Hub and claim up to 500 USDT","Daily check-in, tasks and badges","#/rewards","trophy"],
  ["Earn up to 12% APR on idle USDT","Flexible and locked Earn products","#/earn","coins"],
  ["Futures Trading Competition: share 100,000 USDT","Trade perpetuals and climb the board","#/futures","podium"],
  ["Copy top traders with a single tap","Follow verified strategies","#/copy","rocket"],
  ["Options are live: calls and puts on BTC, ETH and more","Max loss is limited to the premium","#/options","shield"],
  ["Invite friends and earn up to 40% commission","Both of you receive a bonus","#/referral","gift"]
];
const HOT = ["BTC","SOL","ETH","XRP","DOGE","BNB"];
const STRIP = {
  academy:[["Candlestick patterns for beginners","#/academy","5 min"],["How leverage and liquidation work","#/academy","7 min"],["Risk management: sizing a position","#/academy","6 min"]],
  events:[["Futures Trading Competition: 100,000 USDT pool","#/rewards","Live"],["Daily check-in streak bonus","#/rewards","Daily"],["Invite friends, share 40% fees","#/rewards","Ongoing"]],
  announce:[["Options trading now supports 6 underlying assets","#/options","New"],["Scheduled maintenance for demo servers: none planned","#/home",""],["New: Spot markets available from the Home tabs","#/markets","New"]]
};

Pages.home = () => {
  let offs = [], timers = [], ml;
  const s = S();
  const html = `
  <header class="hm-top">
    <button class="hm-av" data-menu aria-label="Open menu">${avatar(s.profile.name, 34)}</button>
    <label class="hm-search" id="hs">${ic("flame",16)}<span class="hm-rot"><span class="hm-rot-in" id="rot">${[...HOT, HOT[0]].map(x => `<span>${x} Hot Searched</span>`).join("")}</span></span><input id="q" type="search" aria-label="Search markets" autocomplete="off" enterkeyhint="search"></label>
    <a class="hm-ib" href="#/support" aria-label="Support">${ic("headset",21)}<i></i></a>
    <a class="hm-ib" href="#/rewards" aria-label="Rewards">${ic("gift",21)}</a>
    <button class="hm-ib" data-bell aria-label="Notifications">${ic("bell",21)}<b class="hide" id="nb"></b></button>
  </header>
  <section class="hm-assets" aria-label="Total assets">
    <div style="min-width:0">
      <button class="hm-al" data-eye>Total Assets (USDT) <span id="ey">${ic("chevd",14)}</span></button>
      <div class="hm-bal num" id="bal"></div>
      <div class="hm-pnl"><u>Today's PnL</u><b class="num" id="tp"></b></div>
    </div>
    <a class="hm-dep" href="#/deposit">Deposit</a>
  </section>
  <nav class="hm-sc" aria-label="Shortcuts">${SHORT.map(([n,i,h]) => `<a href="${h}" ${h === "#more" ? "data-more" : ""}>${ic(i,22,1.7)}<span>${esc(n).replace(" ", "<br>")}${n.includes(" ") ? "" : "<br>&nbsp;"}</span></a>`).join("")}</nav>
  <section class="hm-ban" aria-label="Featured"><div class="hm-bs" id="bs">${SLIDES.map(([h,p,l,a]) => `<a class="hm-sl" href="${l}"><div class="g"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>${art(a)}</a>`).join("")}</div><span class="hm-cnt" id="cnt">1/${SLIDES.length}</span></section>
  <section aria-label="Markets">${chipsHtml()}<div id="mlist"></div></section>
  <div class="hm-strip-sp"></div><div class="hm-strip" id="strip"><div class="hm-st-t"><button data-st="academy" class="on">Academy</button><button data-st="events">Events</button><button data-st="announce">Announcement</button><span class="x" data-sx role="button" aria-label="Expand">${ic("chevd",16)}</span></div><div class="hm-st-b" id="stb"></div></div>`;

  function renderBal(){
    const b = document.getElementById("bal"); if (!b) return;
    const hide = s.settings.hideBal, total = s.balance + E.earnValue() + s.fut.positions.reduce((a,p) => a + p.margin + E.futPnl(p).pnl, 0) + s.positions.reduce((a,p) => a + p.amount, 0);
    b.textContent = hide ? "******" : money(total);
    const st = E.stats(), fToday = s.fut.history.filter(x => x.closed >= new Date().setHours(0,0,0,0)).reduce((a,x) => a + x.profit, 0), tp = st.todayPnl + fToday;
    const el = document.getElementById("tp"); el.textContent = hide ? "****" : `${signed(tp)} USDT (${signed(tp / (s.balance || 1) * 100 || 0)}%)`; el.className = "num " + (tp > 0 ? "up" : tp < 0 ? "down" : "");
  }
  function renderNotif(){ const n = document.getElementById("nb"); if (!n) return; n.textContent = s.unread > 9 ? "9+" : s.unread; n.classList.toggle("hide", !s.unread); }
  return {html, title:"Home", mount(root){
    renderBal(); renderNotif();
    ml = marketList(root.querySelector("#mlist"), {limit:15});
    bindChips(root, ml);
    const qi = root.querySelector("#q"), hs = root.querySelector("#hs");
    qi.addEventListener("input", () => { hs.classList.toggle("has", !!qi.value); ml.setQ(qi.value); });
    qi.addEventListener("focus", () => hs.classList.add("has"));
    qi.addEventListener("blur", () => hs.classList.toggle("has", !!qi.value));
    qi.addEventListener("keydown", e => { if (e.key === "Enter") root.querySelector("#mlist").scrollIntoView({behavior:"smooth", block:"start"}); });
    /* rotating placeholder */
    const rot = root.querySelector("#rot"); let ri = 0;
    const rv = setInterval(() => { ri++; rot.classList.add("anim"); rot.style.transform = `translateY(-${ri * 36}px)`;
      if (ri === HOT.length) setTimeout(() => { rot.classList.remove("anim"); rot.style.transform = "translateY(0)"; ri = 0; }, 480); }, 3000);
    timers.push(() => clearInterval(rv));
    root.querySelector("[data-menu]").onclick = UI.openMenu;
    root.querySelector("[data-more]").onclick = e => { e.preventDefault(); UI.openMenu(); };
    root.querySelector("[data-bell]").onclick = UI.openNotifs;
    root.querySelector("[data-eye]").onclick = () => { s.settings.hideBal = !s.settings.hideBal; store.save(); root.querySelector("#ey").style.transform = s.settings.hideBal ? "rotate(180deg)" : ""; renderBal(); };
    root.querySelector("#ey").style.display = "inline-flex";
    /* banner */
    const bs = root.querySelector("#bs"), cnt = root.querySelector("#cnt"); let bi = 0, bt;
    const upd = () => { bi = Math.round(bs.scrollLeft / bs.clientWidth); cnt.textContent = `${bi + 1}/${SLIDES.length}`; };
    bs.addEventListener("scroll", upd, {passive:true});
    const auto = () => { clearInterval(bt); bt = setInterval(() => bs.scrollTo({left:((bi + 1) % SLIDES.length) * bs.clientWidth, behavior:"smooth"}), 4500); };
    auto(); timers.push(() => clearInterval(bt));
    ["touchstart","pointerdown"].forEach(ev => bs.addEventListener(ev, () => clearInterval(bt), {passive:true}));
    ["touchend","pointerup"].forEach(ev => bs.addEventListener(ev, auto, {passive:true}));
    /* strip */
    const strip = root.querySelector("#strip"), stb = root.querySelector("#stb"); let stTab = "academy";
    const drawStrip = () => { stb.innerHTML = STRIP[stTab].map(([n,h,tg]) => `<a href="${h}"><span>${esc(n)}</span><small>${esc(tg)}</small>${ic("chev",14)}</a>`).join(""); };
    drawStrip();
    strip.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { stTab = b.dataset.st; strip.querySelectorAll("[data-st]").forEach(x => x.classList.toggle("on", x === b)); drawStrip(); strip.classList.add("open"); });
    strip.querySelector("[data-sx]").onclick = () => strip.classList.toggle("open");
    offs.push(bus.on("balance", renderBal), bus.on("history", renderBal), bus.on("notifs", renderNotif));
    const bv = setInterval(renderBal, 3000); timers.push(() => clearInterval(bv));
  }, unmount(){ offs.forEach(f => f()); timers.forEach(f => f()); ml?.destroy(); }};
};

/* ---------- Markets ---------- */
Pages.markets = () => {
  let ml;
  const html = `<header class="hm-pg"><h1>Markets</h1><a class="hm-ib" href="#/alerts" aria-label="Price alerts">${ic("bell",21)}</a></header>
    <label class="hm-search" id="hs"><span class="hm-sr" style="display:contents">${ic("search",16)}</span><input id="mq" type="search" placeholder="Search coin, forex or metal" aria-label="Search markets" autocomplete="off"></label>
    <div class="hm-kp" id="ov" style="margin-top:12px"></div>
    <section>${chipsHtml()}<div id="ml"></div></section>`;
  return {html, title:"Markets", mount(r){
    ml = marketList(r.querySelector("#ml"));
    bindChips(r, ml);
    r.querySelector("#mq").addEventListener("input", e => ml.setQ(e.target.value));
    const ov = () => {
      const c = M.cryptoOrder.map(x => M.get(x)).filter(Boolean); if (!c.length) return;
      const up = c.filter(p => p.chg > 0).length, vol = c.reduce((a,p) => a + (p.qv||0), 0), btc = M.get("BTCUSDT"), g = M.get("XAUUSD");
      r.querySelector("#ov").innerHTML = `<div><span>24h Volume</span><b class="num">$${CH.fmtVol(vol)}</b></div><div><span>Up / Down</span><b class="num"><span class="up" style="display:inline">${up}</span> / <span class="down" style="display:inline">${c.length-up}</span></b></div>
        <div><span>BTC</span><b class="num ${btc?.chg>=0?"up":"down"}">${M.fmtPx(btc)}</b></div><div><span>Gold</span><b class="num ${g?.chg>=0?"up":"down"}">${M.fmtPx(g)}</b></div>`;
    };
    ov(); const iv = setInterval(ov, 3000); const off = bus.on("list", ov);
    this.unmount = () => { ml.destroy(); clearInterval(iv); off(); };
  }};
};
})();
