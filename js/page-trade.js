/* ===== Trade screen ===== */
(function(){
const C = window.CONFIG, {esc, ic, t, store, bus, money, signed, pct, mmss, toast} = U;

Pages.trade = (params) => {
  const s = store.s;
  let sym = (params[0] || sessionStorage.getItem("lastSym") || "BTCUSDT").toUpperCase();
  if (!M.get(sym) && !M.cryptoOrder.length){
    let off;
    return {title:"Loading", html: UI.pageHead("Trade") + `<div class="card">${Array(5).fill('<div class="skel"></div>').join("")}<p class="label" style="text-align:center">Connecting to live markets…</p></div>`,
      mount(){ off = bus.on("list", () => App.route()); }, unmount(){ off?.(); }};
  }
  if (!M.get(sym)) sym = M.get(sym + "USDT") ? sym + "USDT" : "BTCUSDT";
  sessionStorage.setItem("lastSym", sym);
  let tf = sessionStorage.getItem("tf") || "tick", exp = s.settings.defExp || 30, amount = s.settings.defAmt || 10, ptab = "live", offs = [], timers = [];
  const TFS = ["tick","5s","15s","30s","1m","5m"], MORE = ["15m","1h","4h"];

  const html = `
  <header class="trade-head">
    <button class="icon-btn" data-back aria-label="Go back">${ic("back",20)}</button>
    <button class="pair-btn" data-pick aria-label="Change pair"><span id="pIcon"></span><span id="pLbl" class="ellipsis"></span>${ic("chevd",16)}</button>
    <span class="grow"></span>
    <button class="icon-btn" data-bell aria-label="Notifications">${ic("bell",20)}<span class="badge-dot hide" id="nb"></span></button>
    <a class="icon-btn" href="#/home" aria-label="Home"><img src="favicon.svg" alt="" width="24" height="24"></a>
  </header>
  <div class="row between" style="flex-wrap:wrap;gap:4px 12px;margin:4px 0 12px">
    <div class="row" style="gap:10px;flex-wrap:wrap"><span class="live-px" id="lp">--</span><span id="lc" class="chg"></span></div>
    <div class="row label" style="gap:12px"><span>H <b class="mono" id="hi" style="color:var(--text-2)">--</b></span><span>L <b class="mono" id="lo" style="color:var(--text-2)">--</b></span></div>
  </div>
  <div class="trade-grid">
      <section class="card chart-card" aria-label="Price chart">
        <div class="row" style="gap:8px;margin-bottom:8px">
          <div class="seg grow" id="tfs">${TFS.map(x => `<button data-tf="${x}">${x==="tick"?"Tick":x}</button>`).join("")}</div>
          <div class="tf-more"><button class="btn btn-ghost btn-sm" data-more aria-haspopup="true"><span id="moreLbl">More</span> ${ic("chevd",14)}</button><div class="dropdown hide" id="dd">${MORE.map(x => `<button data-tf="${x}">${x}</button>`).join("")}</div></div>
        </div>
        <div class="ohlc" id="ohlc"></div>
        <div class="chart-wrap"><div id="chart"></div><div class="chart-msg" id="cmsg"></div>
          <div class="chart-tools"><button data-z="1.25" aria-label="Zoom in">+</button><button data-z="0.8" aria-label="Zoom out">−</button><button data-rt aria-label="Jump to live">${ic("clock",14)}</button></div>
        </div>
        <div class="senti" aria-label="Market sentiment"><i id="sUp" style="height:50%"></i></div>
        <span class="senti-lbl up" style="top:6px" id="sUpL">50%</span><span class="senti-lbl down" style="bottom:6px" id="sDnL">50%</span>
      </section>
    <aside class="trade-side">
      <section class="card" aria-label="Order panel">
        <div class="row between" style="margin-bottom:8px"><span class="label">${esc(t("Amount"))} (USDT)</span><span class="label">${esc(t("Balance"))}: <b class="mono" id="ob" style="color:var(--text)"></b></span></div>
        <div class="field" id="af">${UI.usdt(22)}<input id="amt" type="number" inputmode="decimal" min="1" step="1" aria-label="Amount in USDT">
          <button class="btn btn-ghost btn-sm" data-half style="background:var(--card)">1/2</button><button class="btn btn-ghost btn-sm" data-dbl style="background:var(--card)">2X</button></div>
        <div class="chips" style="margin-top:8px" id="qa">${[10,50,100,500].map(v => `<button data-v="${v}">${v}</button>`).join("")}<button data-v="max">Max</button></div>
        <div class="label" style="margin:16px 0 8px">Time</div>
        <div class="row" id="exps">${C.EXPIRIES.map(x => `<button class="chip" data-e="${x}"><b>${x<60?x+"s":x/60+"m"}</b><small>+${Math.round(C.PAYOUT*100)}%</small></button>`).join("")}</div>
        <div class="row between" style="margin-top:16px"><span class="sub">${esc(t("Payout (if win)"))}</span><b class="up mono" id="po" style="font-size:18px"></b></div>
        <div class="row between" style="margin-top:4px"><span class="sub">${esc(t("Payout Ratio"))}</span><b class="mono">${E.RATIO.toFixed(2)}X</b></div>
        <div id="note" style="margin-top:12px"></div>
        <div class="err-msg" id="err" role="alert"></div>
        <div class="ud" style="margin-top:8px">
          <button class="btn btn-up" data-dir="up">${ic("up",20,3)} ${esc(t("Up"))}</button>
          <button class="btn btn-down" data-dir="down">${ic("down",20,3)} ${esc(t("Down"))}</button>
        </div>
      </section>
      <section class="card" style="margin-top:16px">
        <div class="title" style="font-size:15px;margin-bottom:10px">Your stats</div>
        <div class="stats-mini" id="sm"></div>
      </section>
    </aside>
      <section class="card pos-card">
        <div class="tabs" style="margin:-4px -4px 4px">
          <button class="tab on" data-pt="live">${esc(t("Live Positions"))} (<span id="pc">0</span>)</button><button class="tab" data-pt="hist">${esc(t("History"))}</button>
        </div>
        <div id="plist"></div>
      </section>
  </div>
  ${UI.footer()}`;

  let root;
  const $ = q => root.querySelector(q);
  const P = () => M.get(sym);

  function renderHead(){
    const p = P();
    $("#pIcon").innerHTML = UI.pairIcon(p, 24);
    $("#pLbl").textContent = p.type === "crypto" ? p.base + "/USD" : M.label(p);
    renderPx();
  }
  let lastPx = null;
  function renderPx(){
    const p = P(); const lp = $("#lp");
    lp.textContent = M.fmtPx(p);
    if (lastPx != null && p.price != null && p.price !== lastPx) lp.style.color = p.price > lastPx ? "var(--up)" : "var(--down)";
    lastPx = p.price;
    const lc = $("#lc");
    if (p.closed){ lc.className = "chg closed"; lc.textContent = t("Market closed"); }
    else if (p.chg == null){ lc.className = "hide"; }
    else { lc.className = "chg" + (p.chg < 0 ? " neg" : ""); lc.textContent = pct(p.chg); }
    $("#hi").textContent = M.fmtPx(p, p.high); $("#lo").textContent = M.fmtPx(p, p.low);
  }
  function senti(){
    const m = M.momentum(sym, 60000), chg = P().chg || 0;
    const up = Math.round(U.clamp(50 + m*30 + U.clamp(chg,-5,5)*2, 8, 92));
    $("#sUp").style.height = up + "%"; $("#sUpL").textContent = up + "%"; $("#sDnL").textContent = (100-up) + "%";
  }
  function renderOrder(){
    const p = P();
    $("#ob").textContent = money(s.balance);
    const a = parseFloat($("#amt").value);
    $("#po").textContent = "+$" + money((a > 0 ? a : 0) * E.RATIO);
    root.querySelectorAll("[data-e]").forEach(b => b.classList.toggle("on", +b.dataset.e === exp));
    let note = "";
    if (!p.tradable) note = `${ic("lock",16)}<span>Chart only — binary Up/Down is available on the top 10 crypto pairs, forex and metals.</span>`;
    else if (p.closed) note = `${ic("clock",16)}<span>Market closed for ${esc(M.label(p))}. Forex & metals reopen on weekdays.</span>`;
    else if (M.isStale(p)) note = `${ic("info",16)}<span>Connecting to live market data…</span>`;
    $("#note").innerHTML = note ? `<div class="notice">${note}</div>` : "";
    const dis = !p.tradable || p.closed;
    root.querySelectorAll("[data-dir]").forEach(b => b.disabled = dis);
  }
  function renderStats(){
    const st = E.stats();
    $("#sm").innerHTML = `<div><span class="label">Trades</span><b>${st.trades}</b></div><div><span class="label">Win rate</span><b>${st.winRate.toFixed(0)}%</b></div><div><span class="label">Net PnL</span><b class="${st.net>=0?"up":"down"}">${signed(st.net)}</b></div>`;
  }
  function renderPositions(){
    const list = $("#plist"); const open = s.positions;
    $("#pc").textContent = open.length;
    if (ptab === "live"){
      if (!open.length){ list.innerHTML = UI.emptyState("chart", "No open positions. Pick Up or Down to place a trade."); return; }
      list.innerHTML = open.slice().reverse().map(pos => {
        const p = M.get(pos.sym);
        return `<div class="pos" data-id="${pos.id}">
          <div class="row" style="gap:8px;min-width:0"><button class="row" data-open="${pos.sym}" style="gap:8px;min-width:0">${UI.pairIcon(p,22)}<b class="ellipsis">${esc(M.label(p))}</b></button><span class="ls ${pos.dir==="up"?"long":"short"}">${pos.dir==="up"?"Long ▲":"Short ▼"}</span></div>
          <span class="cd" data-cd>--:--</span>
          <span class="label">Entry <b class="mono" style="color:var(--text-2)">${M.fmtPx(p, pos.entry)}</b> · Now <b class="mono" data-now style="color:var(--text-2)">${M.fmtPx(p)}</b></span>
          <b class="mono" data-pnl style="text-align:right"></b>
          <span class="label">${money(pos.amount)} USDT · ${pos.expiry<60?pos.expiry+"s":pos.expiry/60+"m"}${pos.source==="auto"?" · Auto":""}</span><span></span>
          <div class="prog"><i data-pg style="width:0%"></i></div></div>`;
      }).join("");
      tickPositions();
    } else {
      const h = s.history.slice(0, 50);
      if (!h.length){ list.innerHTML = UI.emptyState("history", "No trade history yet."); return; }
      list.innerHTML = h.map(x => { const p = M.get(x.sym); return `<div class="pos">
        <div class="row" style="gap:8px;min-width:0">${UI.pairIcon(p,22)}<b class="ellipsis">${esc(p?M.label(p):x.sym)}</b><span class="ls ${x.dir==="up"?"long":"short"}">${x.dir==="up"?"Long":"Short"}</span></div>
        <b class="mono ${x.profit>0?"up":x.profit<0?"down":""}">${signed(x.profit)} USDT</b>
        <span class="label">${M.fmtPx(p||{dp:2}, x.entry)} → ${M.fmtPx(p||{dp:2}, x.exit)}</span>
        <span class="label" style="text-align:right">${x.result.toUpperCase()} · ${U.timeStr(x.closed)}</span></div>`; }).join("")
        + `<button class="more-btn" data-clrh>Clear history</button>`;
    }
  }
  function tickPositions(){
    if (ptab !== "live") return;
    const now = Date.now();
    s.positions.forEach(pos => {
      const r = root.querySelector(`.pos[data-id="${pos.id}"]`); if (!r) return;
      const {win, pnl} = E.livePnl(pos); const p = M.get(pos.sym);
      r.querySelector("[data-cd]").textContent = mmss((pos.exp - now)/1000);
      r.querySelector("[data-now]").textContent = M.fmtPx(p);
      const el = r.querySelector("[data-pnl]");
      el.textContent = win == null ? "0.00 USDT" : (win ? "+" + money(pnl) : "-" + money(pos.amount)) + " USDT";
      el.className = "mono " + (win == null ? "" : win ? "up" : "down");
      r.querySelector("[data-pg]").style.width = U.clamp((now - pos.open) / (pos.exp - pos.open) * 100, 0, 100) + "%";
    });
  }
  function setTf(x){
    tf = x; sessionStorage.setItem("tf", tf);
    root.querySelectorAll("#tfs [data-tf]").forEach(b => b.classList.toggle("on", b.dataset.tf === tf));
    root.querySelectorAll("#dd [data-tf]").forEach(b => b.classList.toggle("on", b.dataset.tf === tf));
    $("#moreLbl").textContent = MORE.includes(tf) ? tf : "More";
    CH.load(sym, tf);
  }
  function switchPair(ns){ if (ns === sym) return; location.hash = "#/trade/" + ns; }
  function trade(dir){
    const a = parseFloat($("#amt").value), err = $("#err");
    const msg = E.validate(sym, a);
    if (msg){ err.textContent = msg; $("#af").classList.add("err"); U.buzz(80); toast(msg, "bad"); return; }
    const r = E.place(sym, dir, a, exp);
    if (r.err){ err.textContent = r.err; toast(r.err, "bad"); return; }
    err.textContent = ""; $("#af").classList.remove("err");
    s.settings.defAmt = a; s.settings.defExp = exp; store.save();
    toast("Order placed successfully!", "ok"); U.beep("tick"); U.buzz(30);
    if (ptab !== "live"){ ptab = "live"; root.querySelectorAll("[data-pt]").forEach(b => b.classList.toggle("on", b.dataset.pt === "live")); }
    renderPositions();
  }
  function pickSheet(){
    let q = "", mode = "tradable";
    const body = () => {
      const all = [...M.pairs.values()].filter(p => mode === "all" ? true : p.tradable);
      const qq = q.toUpperCase();
      const list = all.filter(p => !qq || p.sym.includes(qq) || p.name.toUpperCase().includes(qq)).sort((a,b) => (b.tradable-a.tradable) || ((a.type==="crypto"?a.rank||999:500) - (b.type==="crypto"?b.rank||999:500)));
      return list.map(p => `<button class="list-item" style="width:100%" data-s="${p.sym}">${UI.pairIcon(p,30)}<div class="grow" style="text-align:left"><b>${esc(M.label(p))}</b><div class="label">${p.tradable ? (p.closed ? "Market closed" : "Binary · +92%") : "Chart only"}</div></div>
        <div style="text-align:right"><div class="mono" style="font-weight:600">${M.fmtPx(p)}</div><div class="mono ${p.chg<0?"down":"up"}" style="font-size:12px">${p.closed||p.chg==null?"":pct(p.chg)}</div></div></button>`).join("") || UI.emptyState("search","No pairs found.");
    };
    U.sheet("Select pair", `<label class="search" style="box-shadow:none;background:var(--card-2);margin-bottom:12px">${ic("search",18)}<input id="ps" placeholder="Search e.g., SOL" autocomplete="off"></label>
      <div class="seg" style="margin-bottom:8px"><button class="on" data-m="tradable">Tradable</button><button data-m="all">All markets</button></div><div id="pl">${body()}</div>`, el => {
      const pl = el.querySelector("#pl");
      el.querySelector("#ps").addEventListener("input", e => { q = e.target.value; pl.innerHTML = body(); });
      el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { mode = b.dataset.m; el.querySelectorAll("[data-m]").forEach(x => x.classList.toggle("on", x===b)); pl.innerHTML = body(); });
      pl.addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b){ U.closeLayer(); switchPair(b.dataset.s); } });
    });
  }
  function resultPopup(rec){
    if (rec.sym !== sym && document.hidden) return;
    const p = M.get(rec.sym), w = rec.result === "win", l = rec.result === "loss";
    if (w){ U.confetti(); U.beep("win"); U.buzz([40,40,80]); } else if (l){ U.beep("loss"); U.buzz(150); }
    toast(w ? `You won +${money(rec.profit)} USDT!` : l ? `Trade lost -${money(rec.amount)} USDT` : "Trade refunded (draw)", w ? "ok" : l ? "bad" : "info", 3500);
    U.modal(`<div class="res-ic ${w?"w":l?"l":"d"}">${ic(w?"trophy":l?"x":"reset",34)}</div>
      <div class="h1" style="margin-bottom:4px">${w ? "You won!" : l ? "Trade lost" : "Draw — refunded"}</div>
      <div class="mono ${w?"up":l?"down":""}" style="font-size:28px;font-weight:800;margin:8px 0">${signed(rec.profit)} USDT</div>
      <div class="sub" style="margin-bottom:16px">${esc(M.label(p))} · ${rec.dir==="up"?"Up":"Down"} · ${money(rec.amount)} USDT<br>Entry ${M.fmtPx(p, rec.entry)} → Exit ${M.fmtPx(p, rec.exit)}</div>
      <div class="row"><button class="btn btn-ghost grow" data-x>Close</button><button class="btn btn-primary grow" data-again>Trade again</button></div>`, el => {
      el.querySelector("[data-x]").onclick = U.closeLayer;
      el.querySelector("[data-again]").onclick = () => { U.closeLayer(); if (rec.sym !== sym) switchPair(rec.sym); };
    });
  }
  function renderNotif(){ const n = $("#nb"); n.textContent = s.unread > 9 ? "9+" : s.unread; n.classList.toggle("hide", !s.unread); }

  return {html, title: M.label(M.get(sym)) + " Trade", mount(r){
    root = r;
    $("#amt").value = amount;
    renderHead(); renderOrder(); renderStats(); renderPositions(); renderNotif();
    CH.mount($("#chart"), $("#cmsg"));
    M.watchTrades(sym);
    setTf(tf);
    $("[data-pick]").onclick = pickSheet;
    $("[data-bell]").onclick = UI.openNotifs;
    root.querySelectorAll("#tfs [data-tf], #dd [data-tf]").forEach(b => b.onclick = () => { $("#dd").classList.add("hide"); setTf(b.dataset.tf); });
    $("[data-more]").onclick = e => { e.stopPropagation(); $("#dd").classList.toggle("hide"); };
    const closeDd = () => $("#dd")?.classList.add("hide"); document.addEventListener("click", closeDd); timers.push(() => document.removeEventListener("click", closeDd));
    root.querySelectorAll("[data-z]").forEach(b => b.onclick = () => CH.zoom(+b.dataset.z));
    $("[data-rt]").onclick = CH.reset;
    const amt = $("#amt");
    amt.addEventListener("input", () => { $("#err").textContent = ""; $("#af").classList.remove("err"); renderOrder(); });
    $("[data-half]").onclick = () => { amt.value = Math.max(1, Math.floor((parseFloat(amt.value)||0) / 2 * 100) / 100); renderOrder(); };
    $("[data-dbl]").onclick = () => { amt.value = Math.min(Math.floor(s.balance*100)/100, Math.round((parseFloat(amt.value)||0) * 2 * 100) / 100) || 1; renderOrder(); };
    root.querySelectorAll("#qa [data-v]").forEach(b => b.onclick = () => { amt.value = b.dataset.v === "max" ? Math.floor(Math.min(s.balance, 50000)*100)/100 : b.dataset.v; renderOrder(); });
    root.querySelectorAll("[data-e]").forEach(b => b.onclick = () => { exp = +b.dataset.e; renderOrder(); });
    root.querySelectorAll("[data-dir]").forEach(b => b.onclick = () => trade(b.dataset.dir));
    root.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => { ptab = b.dataset.pt; root.querySelectorAll("[data-pt]").forEach(x => x.classList.toggle("on", x===b)); renderPositions(); });
    $("#plist").addEventListener("click", async e => {
      const o = e.target.closest("[data-open]"); if (o) return switchPair(o.dataset.open);
      if (e.target.closest("[data-clrh]") && await U.confirmBox("Clear history?", "This removes all past trades from this device.", "Clear", true)){ s.history = []; store.save(); renderPositions(); renderStats(); toast("History cleared", "ok"); }
    });
    let pxT = 0;
    offs.push(
      bus.on("tick", (x) => { if (x === sym){ const n = performance.now(); if (n - pxT > 150){ pxT = n; renderPx(); } } }),
      bus.on("meta", x => { if (x === sym){ renderPx(); renderOrder(); } }),
      bus.on("sec", tickPositions), bus.on("balance", renderOrder), bus.on("positions", renderPositions),
      bus.on("history", () => { renderStats(); if (ptab === "hist") renderPositions(); }), bus.on("settled", resultPopup), bus.on("notifs", renderNotif),
      bus.on("crosshair", d => { const el = $("#ohlc"); if (!el) return; const p = P();
        el.innerHTML = d && d.open != null ? `<span>O <b>${M.fmtPx(p,d.open)}</b></span><span>H <b>${M.fmtPx(p,d.high)}</b></span><span>L <b>${M.fmtPx(p,d.low)}</b></span><span>C <b>${M.fmtPx(p,d.close)}</b></span>` : d && d.value != null ? `<span>Price <b>${M.fmtPx(p,d.value)}</b></span>` : ""; })
    );
    const st = setInterval(() => { senti(); renderOrder(); }, 2000); senti(); timers.push(() => clearInterval(st));
  }, unmount(){ offs.forEach(f => f()); timers.forEach(f => f()); CH.destroy(); M.unwatchTrades(); }};
};
})();
