/* ===== Home ===== */
(function(){
const C = window.CONFIG, {esc, ic, t, store, bus, money, signed, pct, spark} = U;
window.Pages = window.Pages || {};

const ROBOT = `<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="rb" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#D8ECFF"/></linearGradient></defs>
<circle cx="60" cy="60" r="54" fill="rgba(255,255,255,.14)"/><path d="M60 14v10" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="12" r="5" fill="#FFD966"/>
<rect x="28" y="26" width="64" height="48" rx="16" fill="url(#rb)"/><rect x="36" y="36" width="48" height="26" rx="10" fill="#1B3A6B"/>
<circle cx="50" cy="49" r="5" fill="#56CCF2"><animate attributeName="r" values="5;3;5" dur="2.4s" repeatCount="indefinite"/></circle><circle cx="70" cy="49" r="5" fill="#56CCF2"><animate attributeName="r" values="5;3;5" dur="2.4s" repeatCount="indefinite"/></circle>
<rect x="20" y="42" width="8" height="18" rx="4" fill="#fff"/><rect x="92" y="42" width="8" height="18" rx="4" fill="#fff"/>
<rect x="38" y="78" width="44" height="26" rx="10" fill="url(#rb)"/><path d="M48 92l8-6 6 4 10-8" stroke="#16C784" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ROCKET = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="rgba(255,255,255,.14)"/>
<g transform="rotate(35 60 60)"><path d="M60 14c14 12 18 32 14 54H46c-4-22 0-42 14-54z" fill="#fff"/><circle cx="60" cy="44" r="8" fill="#56CCF2" stroke="#1B3A6B" stroke-width="3"/>
<path d="M46 60l-12 14 14-2zM74 60l12 14-14-2z" fill="#FFD966"/><path d="M50 70h20l-4 10h-12z" fill="#D8ECFF"/>
<path d="M54 82c2 10 6 16 6 16s4-6 6-16z" fill="#F2994A"><animate attributeName="d" values="M54 82c2 10 6 16 6 16s4-6 6-16z;M54 82c2 14 6 22 6 22s4-8 6-22z;M54 82c2 10 6 16 6 16s4-6 6-16z" dur=".5s" repeatCount="indefinite"/></path></g>
<circle cx="24" cy="30" r="2" fill="#fff"/><circle cx="98" cy="24" r="1.5" fill="#fff"/><circle cx="96" cy="94" r="2" fill="#fff"/></svg>`;
const GIFT = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="rgba(255,255,255,.14)"/><rect x="26" y="52" width="68" height="46" rx="8" fill="#fff"/><rect x="22" y="40" width="76" height="16" rx="6" fill="#D8ECFF"/><rect x="54" y="40" width="12" height="58" fill="#F2994A"/><path d="M60 40c-6-14-24-14-20-2 2 5 12 3 20 2zM60 40c6-14 24-14 20-2-2 5-12 3-20 2z" fill="#FFD966"/></svg>`;

const TILES = [
  ["Deposit","deposit","p1","#/deposit"],["Withdraw","withdraw","p2","#/withdraw"],["Activate Auto Trading","auto","p3","#/auto"],["Refer and Earn","gift","p4","#/referral"],
  ["Get VIP Signals","crown","p5","#/vip"],["Join Community","users","p6","#/community"],["About Us","info","p7","#/about"],["Contact Support","headset","p8","#/support"]
];

Pages.home = () => {
  let tab = sessionStorage.getItem("mktTab") || "popular", q = "", showAll = false, offs = [], timers = [], dirty = new Set(), rows = new Map(), slide = 0;
  const s = store.s;
  const html = `
  <header class="topbar">
    <button class="avatar" data-menu aria-label="Open menu">${esc(s.profile.name[0])}</button>
    <label class="search"><span>${ic("search",18)}</span><span class="sr">Search pairs</span><input id="q" type="search" placeholder="${esc(t("Search e.g., SOL"))}" autocomplete="off" enterkeyhint="search"></label>
    <button class="icon-btn" data-lang aria-label="Language">${ic("globe",20)}</button>
    <button class="icon-btn" data-bell aria-label="Notifications">${ic("bell",20)}<span class="badge-dot hide" id="nb"></span></button>
    <a class="icon-btn" href="#/settings" aria-label="Settings">${ic("gear",20)}</a>
  </header>
  <div class="home-grid">
   <div class="stack">
    <section class="card assets" aria-label="Total assets">
      <div>
        <div class="row label">${esc(t("Total Assets"))} (USDT) <button class="eye" data-eye aria-label="Show or hide balance">${ic(s.settings.hideBal?"eyeoff":"eye",16)}</button></div>
        <div class="bal mono" id="bal"></div>
        <div class="label" id="balUsd" style="margin-bottom:12px"></div>
        <div class="row"><a class="btn btn-primary grow" href="#/deposit">${ic("deposit",18)} ${esc(t("Deposit"))}</a><a class="btn btn-ghost grow" href="#/trade">${ic("chart",18)} ${esc(t("Trade"))}</a></div>
      </div>
      <a class="pnl-mini" href="#/profile" aria-label="Today's profit and loss">
        <div class="grow"><div class="label">${esc(t("Today's PnL"))}</div><div id="tp" style="font-weight:800;font-size:18px" class="mono"></div><div class="label" id="tpn"></div></div>
        <div id="tps"></div>
      </a>
    </section>
    <section class="carousel" aria-label="Promotions">
      <div class="slides" id="slides">
        <div class="slide" data-go="#/bots"><div class="grow"><h3>Future Combo Bot</h3><p>Automate futures strategies with smart hedging.</p><span class="pill">Start now →</span></div>${ROBOT}</div>
        <div class="slide s2" data-go="#/auto"><div class="grow"><h3>Auto Trading</h3><p>Let the engine trade Up/Down on live markets.</p><span class="pill">Activate →</span></div>${ROCKET}</div>
        <div class="slide s3" data-go="#/referral"><div class="grow"><h3>Refer & Earn 20%</h3><p>Invite friends and earn demo commission.</p><span class="pill">Invite →</span></div>${GIFT}</div>
      </div>
      <div class="dots" id="dots"><i class="on"></i><i></i><i></i></div>
    </section>
    <nav class="card tiles" aria-label="Quick actions">
      ${TILES.map(([n,i,c,h]) => `<a class="tile" href="${h}"><span class="ic ${c}">${ic(i,22)}</span><span>${esc(t(n))}</span></a>`).join("")}
    </nav>
   </div>
    <section class="card" aria-label="Markets" style="padding:8px 12px 12px">
      <div class="row between" style="padding:8px 4px 0"><h2 class="title">${esc(t("Markets"))}</h2><span class="label" id="mstat"></span></div>
      <div class="tabs" role="tablist">
        ${["popular","crypto","forex","commodities"].map(k => `<button class="tab ${tab===k?"on":""}" data-tab="${k}" role="tab">${esc(t(k[0].toUpperCase()+k.slice(1)))}</button>`).join("")}
      </div>
      <div class="mkt-head"><span>${esc(t("Name"))}</span><span>${esc(t("Last Price"))}</span><span>${esc(t("24h Chg%"))}</span></div>
      <div id="mlist"></div>
    </section>
  </div>
  ${UI.footer()}`;

  function listFor(){
    const all = [...M.pairs.values()];
    const qq = q.trim().toUpperCase().replace("/","");
    if (qq) return all.filter(p => p.sym.includes(qq) || p.name.toUpperCase().includes(qq) || M.label(p).replace("/","").includes(qq))
      .sort((a,b) => (b.tradable - a.tradable) || ((a.rank||999) - (b.rank||999))).slice(0, 60);
    const crypto = M.cryptoOrder.map(s => M.get(s)).filter(Boolean);
    if (tab === "crypto") return showAll ? crypto : crypto.slice(0, 20);
    if (tab === "forex") return all.filter(p => p.type === "forex");
    if (tab === "commodities") return all.filter(p => p.type === "metal");
    const top = crypto.filter(p => p.tradable);
    return [...top.slice(0, 6), M.get("XAUUSD"), M.get("EURUSD"), ...top.slice(6), M.get("GBPUSD"), M.get("XAGUSD")].filter(Boolean);
  }
  function badge(p){
    if (p.closed) return `<span class="tag t-closed">${esc(t("Market closed"))}</span>`;
    if (p.type === "crypto") return p.tradable ? `<span class="tag t-bin">Binary</span>` : `<span class="tag">${esc(t("Chart only"))}</span>`;
    return `<span class="tag t-bin">${p.type === "forex" ? "Forex" : "Metal"}</span>`;
  }
  function chgHtml(p){
    if (p.closed) return `<span class="chg closed">Closed</span>`;
    if (p.chg == null) return `<span class="chg closed">--</span>`;
    return `<span class="chg ${p.chg < 0 ? "neg" : ""}">${pct(p.chg)}</span>`;
  }
  function renderList(){
    const box = document.getElementById("mlist"); if (!box) return;
    const list = listFor(); rows.clear();
    const loading = (tab === "crypto" || tab === "popular") && !M.cryptoOrder.length && !q;
    if (loading && M.status.crypto !== "live"){ box.innerHTML = Array(6).fill('<div class="skel"></div>').join(""); return; }
    if (!list.length){ box.innerHTML = UI.emptyState("search", q ? `No pairs match “${q}”.` : "Loading markets…"); return; }
    box.innerHTML = list.map(p => `<div class="mkt-row" data-sym="${p.sym}" role="button" tabindex="0" aria-label="Open ${esc(M.label(p))}">
      <div class="row" style="gap:10px;min-width:0">${UI.pairIcon(p)}<div class="grow"><div class="sym ellipsis">${esc(p.base)}<em>/${esc(p.quote)}</em></div>${badge(p)}</div></div>
      <div class="px" data-px>${M.fmtPx(p)}</div><div data-chg>${chgHtml(p)}</div></div>`).join("")
      + (tab === "crypto" && !q && !showAll && M.cryptoOrder.length > 20 ? `<button class="more-btn" data-more>Show all ${M.cryptoOrder.length} pairs ${ic("chevd",14)}</button>` : "");
    box.querySelectorAll(".mkt-row").forEach(r => rows.set(r.dataset.sym, {px:r.querySelector("[data-px]"), chg:r.querySelector("[data-chg]"), tag:r.querySelector(".tag")}));
  }
  function flush(){
    dirty.forEach(sym => {
      const r = rows.get(sym), p = M.get(sym); if (!r || !p) return;
      const txt = M.fmtPx(p);
      if (r.px.textContent !== txt){
        r.px.textContent = txt; r.px.classList.remove("fu","fd"); void r.px.offsetWidth;
        r.px.classList.add(p.dir >= 0 ? "fu" : "fd"); setTimeout(() => r.px.classList.remove("fu","fd"), 350);
      }
      r.chg.innerHTML = chgHtml(p);
    });
    dirty.clear();
  }
  function renderBal(){
    const b = document.getElementById("bal"); if (!b) return;
    const hide = s.settings.hideBal;
    b.innerHTML = hide ? "••••••" : `${money(s.balance)}<small>USDT</small>`;
    document.getElementById("balUsd").textContent = hide ? "≈ $ ••••" : `≈ $${money(s.balance)} · Demo account`;
    const st = E.stats(), tp = document.getElementById("tp");
    tp.textContent = hide ? "••••" : signed(st.todayPnl) + " USDT"; tp.className = "mono " + (st.todayPnl > 0 ? "up" : st.todayPnl < 0 ? "down" : "");
    document.getElementById("tpn").textContent = `${st.today.length} trades today`;
    document.getElementById("tps").innerHTML = spark(E.todaySeries(), 96, 36);
  }
  function renderNotif(){ const n = document.getElementById("nb"); if (!n) return; n.textContent = s.unread > 9 ? "9+" : s.unread; n.classList.toggle("hide", !s.unread); }
  function renderStatus(){
    const el = document.getElementById("mstat"); if (!el) return;
    const ok = M.status.crypto === "live";
    el.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ok?"var(--up)":"var(--warn)"};margin-right:6px"></span>${ok ? "Live" : "Connecting…"}`;
  }

  return {html, title:"Home", mount(root){
    renderBal(); renderList(); renderNotif(); renderStatus();
    const qi = root.querySelector("#q"); qi.value = q;
    qi.addEventListener("input", () => { q = qi.value; renderList(); });
    root.querySelector("[data-menu]").onclick = UI.openMenu;
    root.querySelector("[data-lang]").onclick = UI.openLang;
    root.querySelector("[data-bell]").onclick = UI.openNotifs;
    root.querySelector("[data-eye]").onclick = e => { s.settings.hideBal = !s.settings.hideBal; store.save(); e.currentTarget.innerHTML = ic(s.settings.hideBal?"eyeoff":"eye",16); renderBal(); };
    root.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => {
      tab = b.dataset.tab; sessionStorage.setItem("mktTab", tab); showAll = false;
      root.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x === b)); renderList();
    });
    const ml = root.querySelector("#mlist");
    ml.addEventListener("click", e => {
      if (e.target.closest("[data-more]")){ showAll = true; renderList(); return; }
      const r = e.target.closest(".mkt-row"); if (r) location.hash = "#/trade/" + r.dataset.sym;
    });
    ml.addEventListener("keydown", e => { const r = e.target.closest(".mkt-row"); if (r && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); location.hash = "#/trade/" + r.dataset.sym; } });
    // carousel
    const slides = root.querySelector("#slides"), dots = [...root.querySelectorAll("#dots i")];
    const go = i => { slide = (i + 3) % 3; slides.style.transform = `translateX(-${slide*100}%)`; dots.forEach((d,k) => d.classList.toggle("on", k === slide)); };
    let auto = setInterval(() => go(slide+1), 4000); timers.push(() => clearInterval(auto));
    let sx = null;
    slides.addEventListener("touchstart", e => { sx = e.touches[0].clientX; clearInterval(auto); }, {passive:true});
    slides.addEventListener("touchend", e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(slide + (dx < 0 ? 1 : -1)); sx = null; auto = setInterval(() => go(slide+1), 4000); }, {passive:true});
    slides.querySelectorAll("[data-go]").forEach(sl => sl.onclick = () => location.hash = sl.dataset.go);
    dots.forEach((d,k) => d.onclick = () => go(k));
    offs.push(bus.on("tick", sym => dirty.add(sym)), bus.on("meta", sym => dirty.add(sym)), bus.on("list", renderList), bus.on("balance", renderBal), bus.on("history", renderBal), bus.on("notifs", renderNotif), bus.on("status", renderStatus));
    const f = setInterval(flush, 500); timers.push(() => clearInterval(f));
  }, unmount(){ offs.forEach(f => f()); timers.forEach(f => f()); }};
};
})();
