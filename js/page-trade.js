/* ===== Trade screen: Binary Options + Futures ===== */
(function(){
const C = window.CONFIG, {esc, ic, t, store, bus, money, signed, pct, mmss, toast, fmt} = U;
const TFS = ["tick","5s","15s","30s","1m","5m","15m","1h","4h","1d"];

function makeTrade(mode){
  return (params) => {
    const s = store.s;
    let sym = (params[0] || sessionStorage.getItem("lastSym_" + mode) || (mode === "futures" ? "BTCUSDT" : "BTCUSDT")).toUpperCase();
    if (!M.get(sym) && !M.cryptoOrder.length){
      let off;
      return {title:"Loading", html: UI.pageHead(mode === "futures" ? "Futures" : "Trade") + `<div class="card">${Array(6).fill('<div class="skel"></div>').join("")}</div>`,
        mount(){ off = bus.on("list", () => App.route()); }, unmount(){ off?.(); }};
    }
    if (!M.get(sym)) sym = M.get(sym + "USDT") ? sym + "USDT" : "BTCUSDT";
    sessionStorage.setItem("lastSym_" + mode, sym);
    const P = () => M.get(sym);
    let tf = sessionStorage.getItem("tf_" + mode) || (mode === "futures" ? "15m" : "tick");
    let exp = s.settings.defExp || 30, ptab = "pos", side = "long", otype = "market", lev = Math.min(s.settings.lev || 20, E.maxLev(P())), tpsl = false, ctab = "chart", offs = [], timers = [], root, cdLast = {};
    const $ = q => root.querySelector(q);
    const isBin = mode === "binary";

    /* ----- Templates ----- */
    const chartCard = `
      <section class="card chart-card" id="cc">
        <div class="fs-head"><button class="icon-btn" data-fsx aria-label="Exit fullscreen">${ic("back",20)}</button><b id="fsl"></b><span class="grow"></span><b class="num" id="fsp"></b></div>
        <div class="tabs" style="padding:0 12px;gap:18px" id="ctabs">
          <button class="tab on" data-ct="chart">Chart</button>${P().type === "crypto" ? `<button class="tab" data-ct="book">Order Book</button><button class="tab" data-ct="trades">Trades</button>` : `<button class="tab" data-ct="book">Quotes</button>`}<button class="tab" data-ct="info">Info</button>
        </div>
        <div id="cpChart">
          <div class="tf-row" id="tfs">${TFS.map(x => `<button data-tf="${x}">${x === "tick" ? "Tick" : x === "1d" ? "1D" : x}</button>`).join("")}<span class="sp"></span>
            <button data-ctype aria-label="Chart type" title="Line / Candles">${ic("candle",16)}</button><button data-fs aria-label="Fullscreen">${ic("expand",15)}</button></div>
          <div class="chart-wrap"><div id="chart"></div><div class="ovl" id="ovl"></div><div class="legend" id="lg"></div><div class="chart-msg" id="cmsg"></div>
            <div class="chart-tools"><button data-z="1.3" aria-label="Zoom in">${ic("plus",14)}</button><button data-z="0.77" aria-label="Zoom out">${ic("minus",14)}</button><button data-rt aria-label="Go to latest">${ic("chev",14)}</button></div></div>
          <div class="ind-row" id="inds">${IND.LIST.map(x => `<button data-ind="${x.k}">${x.k === "SUPER" ? "SuperTrend" : x.k}</button>`).join("")}<button data-indinfo aria-label="Indicator guide">${ic("info",13)}</button></div>
          <div class="senti"><span class="up" id="sU">50%</span><div class="bar"><i id="sB" style="width:50%"></i></div><span class="down" id="sD">50%</span></div>
        </div>
        <div id="cpOther" class="hide" style="padding:12px 14px;min-height:300px"></div>
        <p class="label" style="padding:0 12px 8px;text-align:center">Long-press any candle for details · Pinch or scroll to zoom</p>
      </section>`;

    const binaryForm = `
      <section class="card" aria-label="Order panel">
        <div class="row between" style="margin-bottom:8px"><span class="label">Amount</span><span class="label">Avbl <b class="num" id="ob" style="color:var(--text)"></b> USDT <a href="#/deposit" class="brand-c">${ic("plus",12,3)}</a></span></div>
        <div class="field" id="af">${UI.usdt(20)}<input id="amt" type="number" inputmode="decimal" min="1" step="1" aria-label="Amount in USDT"><button class="fbtn" data-half>1/2</button><button class="fbtn" data-dbl>2X</button></div>
        <div class="chips" style="margin-top:8px" id="qa">${[10,25,50,100,500].map(v => `<button data-v="${v}">${v}</button>`).join("")}<button data-v="max">Max</button></div>
        <div class="label" style="margin:14px 0 6px">Expiry time</div>
        <div class="row" id="exps">${C.EXPIRIES.map(x => `<button class="exp-chip" data-e="${x}"><b>${x<60?x+"s":x/60+"m"}</b><small>+${Math.round(C.PAYOUT*100)}%</small></button>`).join("")}</div>
        <div class="kv" style="margin-top:12px"><span>${esc(t("Payout (if win)"))}</span><b class="up num" id="po" style="font-size:15px"></b></div>
        <div class="kv"><span>${esc(t("Payout Ratio"))}</span><b class="num">${E.RATIO.toFixed(2)}X</b></div>
        <div class="kv"><span>Profit</span><b class="up num" id="pf"></b></div>
        <div id="note" style="margin-top:10px"></div>
        <div class="err-msg" id="err" role="alert"></div>
        <div class="ud" style="margin-top:12px">
          <button class="btn btn-up" data-dir="up"><span class="row" style="gap:4px">${ic("up",18,3)} ${esc(t("Up"))}</span><small id="upP"></small></button>
          <button class="btn btn-down" data-dir="down"><span class="row" style="gap:4px">${ic("down",18,3)} ${esc(t("Down"))}</span><small id="dnP"></small></button>
        </div>
      </section>`;

    const futForm = `
      <section class="card" aria-label="Futures order">
        <div class="fut-grid">
          <div>
            <div class="row" style="gap:6px;margin-bottom:8px"><button class="btn btn-ghost btn-sm grow" data-margin>Isolated</button><button class="btn btn-ghost btn-sm grow" data-lev><span id="levL"></span></button></div>
            <div class="seg" style="margin-bottom:8px"><button data-side="long" class="on">Buy</button><button data-side="short">Sell</button></div>
            <div class="row" style="gap:12px;margin-bottom:8px;font-size:13px"><button data-ot="market" class="brand-c" style="font-weight:600">Market</button><button data-ot="limit" style="color:var(--muted)">Limit</button></div>
            <div class="field hide" id="lpf" style="margin-bottom:8px;height:40px"><input id="lp" type="number" inputmode="decimal" placeholder="Price" aria-label="Limit price"><span class="unit">USDT</span></div>
            <div class="field" id="mf" style="height:40px"><input id="mg" type="number" inputmode="decimal" placeholder="Margin" aria-label="Margin"><span class="unit">USDT</span></div>
            <input type="range" class="slider" id="sl" min="0" max="100" step="1" value="0" aria-label="Percent of balance"><div class="ticks"><span>0</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
            <label class="row" style="margin:10px 0 4px;font-size:12px;color:var(--text-2)"><input type="checkbox" id="tpc" style="accent-color:var(--brand-2)"> TP/SL</label>
            <div id="tpsl" class="hide"><div class="field" style="height:36px;margin-bottom:6px"><input id="tp" type="number" inputmode="decimal" placeholder="Take profit" style="font-size:13px"></div><div class="field" style="height:36px"><input id="sl2" type="number" inputmode="decimal" placeholder="Stop loss" style="font-size:13px"></div></div>
            <div class="kv"><span>Avbl</span><b class="num"><span id="fav"></span> USDT</b></div>
            <div class="kv"><span>Size</span><b class="num" id="fsz">--</b></div>
            <div class="kv"><span>Est. liq. price</span><b class="num" id="fliq" style="color:#F7931A">--</b></div>
            <div class="kv"><span>Fee (0.05%)</span><b class="num" id="ffee">--</b></div>
            <div class="err-msg" id="ferr" role="alert"></div>
            <button class="btn btn-up btn-block" id="fgo" style="margin-top:10px;height:42px">Buy / Long</button>
          </div>
          <div class="book" id="mbook"></div>
        </div>
      </section>`;

    const html = `
    <header class="trade-head">
      <button class="icon-btn" data-back aria-label="Go back">${ic("back",22)}</button>
      <div class="mode-sw"><button data-mode="binary" class="${isBin?"on":""}">Binary</button><button data-mode="futures" class="${!isBin?"on":""}">Futures</button></div>
      <span class="grow"></span>
      <button class="icon-btn" data-star aria-label="Favorite">${ic("star",20)}</button>
      <button class="icon-btn" data-alert aria-label="Price alert">${ic("ring",20)}</button>
      <button class="icon-btn" data-bell aria-label="Notifications">${ic("bell",20)}<span class="badge-dot hide" id="nb"></span></button>
    </header>
    <button class="pair-btn" data-pick aria-label="Change pair"><span id="pIcon"></span><span id="pLbl" class="ellipsis"></span>${ic("chevd",16)}<span id="pTag"></span></button>
    <div class="tstat">
      <div><div class="live-px num" id="lp0">--</div><div class="row label num" style="gap:6px"><span id="lusd"></span><b id="lc" class="num"></b></div></div>
      <div class="tstat-r"><span>24h High</span><b class="num" id="hi">--</b><span>24h Low</span><b class="num" id="lo">--</b><span id="vlab">24h Vol</span><b class="num" id="vo">--</b></div>
    </div>
    <div class="trade-grid">
      ${chartCard}
      <aside class="trade-side">${isBin ? binaryForm : futForm}
        <section class="card" style="margin-top:12px"><div class="row between" style="margin-bottom:10px"><span class="title" style="font-size:14px">${isBin ? "Binary stats" : "Futures stats"}</span><a href="#/assets" class="link">Assets</a></div><div class="stats-mini" id="sm"></div></section>
      </aside>
      <section class="card pos-card">
        <div class="tabs" style="margin:-6px 0 4px" id="ptabs">
          <button class="tab on" data-pt="pos">Positions (<span id="pc">0</span>)</button>${isBin ? "" : `<button class="tab" data-pt="ord">Open Orders (<span id="oc">0</span>)</button>`}<button class="tab" data-pt="hist">History</button>
        </div>
        <div id="plist"></div>
      </section>
    </div>
    ${UI.footer()}`;

    /* ----- Header / price ----- */
    let lastPx = null;
    function renderHead(){
      const p = P();
      $("#pIcon").innerHTML = UI.pairIcon(p, 22);
      $("#pLbl").textContent = isBin ? M.label(p) : (p.type === "crypto" ? p.base + "USDT" : p.sym);
      $("#pTag").innerHTML = isBin ? (p.tradable ? `<span class="tag t-y">+92%</span>` : `<span class="tag">Chart only</span>`) : `<span class="tag">Perp</span>`;
      $("[data-star]").innerHTML = s.favs.includes(sym) ? `<span class="brand-c">${ic("star",20)}</span>` : ic("star",20);
      $("[data-star] svg")?.setAttribute("fill", s.favs.includes(sym) ? "currentColor" : "none");
      renderPx();
    }
    function renderPx(){
      const p = P(), el = $("#lp0"); if (!el) return;
      el.textContent = M.fmtPx(p);
      if (lastPx != null && p.price != null && p.price !== lastPx) el.style.color = p.price > lastPx ? "var(--up)" : "var(--down)";
      lastPx = p.price;
      $("#lusd").textContent = "≈ $" + M.fmtPx(p);
      const lc = $("#lc");
      if (p.closed){ lc.className = "brand-c"; lc.textContent = t("Market closed"); }
      else if (p.chg == null) lc.textContent = "";
      else { lc.className = "num " + (p.chg < 0 ? "down" : "up"); lc.textContent = pct(p.chg); }
      $("#hi").textContent = M.fmtPx(p, p.high); $("#lo").textContent = M.fmtPx(p, p.low);
      if (p.qv){ $("#vo").textContent = CH.fmtVol(p.qv); $("#vlab").textContent = "24h Vol(USDT)"; } else { $("#vo").textContent = p.type === "forex" ? "Spread" : "--"; $("#vlab").textContent = "Type"; }
      const fs = $("#fsp"); if (fs){ fs.textContent = M.fmtPx(p); fs.className = "num " + (p.chg < 0 ? "down" : "up"); $("#fsl").textContent = M.label(p); }
    }
    function senti(){
      const m = M.momentum(sym, 60000), chg = P().chg || 0;
      const up = Math.round(U.clamp(50 + m*30 + U.clamp(chg,-5,5)*2, 6, 94));
      $("#sB").style.width = up + "%"; $("#sU").textContent = "Buy " + up + "%"; $("#sD").textContent = (100-up) + "% Sell";
    }

    /* ----- Chart side tabs ----- */
    function renderOther(){
      const box = $("#cpOther"), p = P();
      if (ctab === "book") box.innerHTML = bookHtml(14, true);
      else if (ctab === "trades"){
        box.innerHTML = `<div class="trades-l"><div class="label"><span>Price</span><span>Amount</span><span>Time</span></div>${M.trades.slice(0,30).map(tr => `<div class="num"><span class="${tr.buy?"up":"down"}">${M.fmtPx(p,tr.p)}</span><span>${fmt(tr.q, tr.q < 1 ? 4 : 2)}</span><span class="label">${U.timeStr(tr.t)}</span></div>`).join("") || UI.emptyState("history","Waiting for trades…")}</div>`;
      } else if (ctab === "info"){
        const lv = E.maxLev(p);
        box.innerHTML = `<div class="row" style="gap:10px;margin-bottom:12px">${UI.pairIcon(p,40)}<div><div class="title">${esc(M.label(p))}</div><div class="label">${esc(p.name)}</div></div></div>
          <div class="cdetail">${[["Market", p.type === "crypto" ? "Crypto spot / perp" : p.type === "forex" ? "Forex" : "Precious metal"],["Rank", p.rank ? "#" + p.rank : "--"],["Last price", M.fmtPx(p)],["24h change", p.chg == null ? "--" : pct(p.chg)],["24h high", M.fmtPx(p,p.high)],["24h low", M.fmtPx(p,p.low)],["24h volume", p.qv ? "$" + CH.fmtVol(p.qv) : "--"],["Binary", p.tradable ? "30s · 1m · 5m (+92%)" : "Not available"],["Max leverage", lv + "x"],["Trading hours", p.type === "crypto" ? "24/7" : "Mon–Fri"],["Status", p.closed ? "Closed" : "Open"],["Data source", p.type === "crypto" ? "Binance" : "biquote.io"]].map(([a,b]) => `<div><span>${a}</span><b>${esc(b)}</b></div>`).join("")}</div>`;
      }
    }
    function bookHtml(n, wide){
      const p = P();
      if (p.type !== "crypto"){
        const sp = p.price ? p.price * (p.type === "metal" ? 0.00008 : 0.00003) : 0;
        return `<div class="book-h"><span>Bid</span><span>Ask</span></div><div class="book-r num"><span class="up">${M.fmtPx(p, p.price - sp/2)}</span><span class="down">${M.fmtPx(p, p.price + sp/2)}</span></div>
          <div class="book-mid num ${p.dir>=0?"up":"down"}">${M.fmtPx(p)}</div><div class="kv"><span>Day range</span><b class="num">${M.fmtPx(p,p.low)} – ${M.fmtPx(p,p.high)}</b></div>`;
      }
      const asks = M.book.asks.slice(0, n).reverse(), bids = M.book.bids.slice(0, n);
      if (!asks.length) return `<div class="skel"></div><div class="skel"></div><div class="label" style="text-align:center">Loading order book…</div>`;
      const mx = Math.max(...asks.map(a => +a[1]), ...bids.map(b => +b[1]));
      const row = (r, c) => `<div class="book-r num"><i style="width:${(+r[1]/mx*100).toFixed(0)}%;background:var(--${c})"></i><span class="${c}">${M.fmtPx(p, +r[0])}</span><span>${fmt(+r[1], +r[1] < 10 ? 4 : 2)}</span></div>`;
      const tb = bids.reduce((a,b) => a + +b[1], 0), ta = asks.reduce((a,b) => a + +b[1], 0), bp = Math.round(tb / (tb + ta) * 100);
      return `<div class="book-h"><span>Price(USDT)</span><span>Amount(${esc(p.base)})</span></div>${asks.map(a => row(a,"down")).join("")}
        <div class="book-mid num ${p.dir>=0?"up":"down"}">${M.fmtPx(p)}</div>${bids.map(b => row(b,"up")).join("")}
        ${wide ? `<div class="senti" style="padding:10px 0 0;border:0"><span class="up">B ${bp}%</span><div class="bar"><i style="width:${bp}%"></i></div><span class="down">${100-bp}% S</span></div>` : ""}`;
    }

    /* ----- Binary order ----- */
    function renderBinary(){
      const p = P(), a = parseFloat($("#amt").value) || 0;
      $("#ob").textContent = money(s.balance);
      $("#po").textContent = "+$" + money(a * E.RATIO); $("#pf").textContent = "+" + money(a * C.PAYOUT) + " USDT";
      root.querySelectorAll("[data-e]").forEach(b => b.classList.toggle("on", +b.dataset.e === exp));
      $("#upP").textContent = $("#dnP").textContent = "+92% · " + (exp < 60 ? exp + "s" : exp/60 + "m");
      let note = "";
      if (!p.tradable) note = `<div class="notice">${ic("lock",14)}<span>Binary not available on ${esc(M.label(p))}. <a href="#/futures/${sym}" style="text-decoration:underline">Trade it on Futures</a> or pick a top-10 pair.</span></div>`;
      else if (p.closed) note = `<div class="notice">${ic("clock",14)}<span>Market closed. Forex & metals reopen Monday.</span></div>`;
      else if (M.isStale(p)) note = `<div class="notice">${ic("info",14)}<span>Connecting to live prices…</span></div>`;
      $("#note").innerHTML = note;
      root.querySelectorAll("[data-dir]").forEach(b => b.disabled = !p.tradable || p.closed);
    }
    function tradeBinary(dir){
      const a = parseFloat($("#amt").value), err = $("#err");
      const msg = E.validate(sym, a);
      if (msg){ err.textContent = msg; $("#af").classList.add("err"); U.buzz([30,40,30]); toast(msg, "bad"); return; }
      const r = E.place(sym, dir, a, exp);
      if (r.err){ err.textContent = r.err; toast(r.err, "bad"); return; }
      err.textContent = ""; $("#af").classList.remove("err");
      s.settings.defAmt = a; s.settings.defExp = exp; store.save();
      toast("Order placed successfully!", "ok"); U.beep("open"); U.buzz(25);
      setPtab("pos");
    }

    /* ----- Futures order ----- */
    function futInputs(){
      const p = P(), mg = parseFloat($("#mg").value) || 0, px = otype === "limit" ? (parseFloat($("#lp").value) || p.price) : p.price;
      return {p, mg, px, notional: mg * lev, qty: px ? mg * lev / px : 0};
    }
    function renderFut(){
      const {p, mg, px, notional, qty} = futInputs();
      $("#levL").textContent = lev + "x";
      $("#fav").textContent = money(s.balance);
      $("#fsz").textContent = mg ? `${fmt(qty, qty < 1 ? 4 : 2)} ${p.type === "crypto" ? p.base : "units"}` : "--";
      $("#fliq").textContent = mg && px ? M.fmtPx(p, E.liqPrice(side, px, lev)) : "--";
      $("#ffee").textContent = mg ? money(notional * C.FEE) + " USDT" : "--";
      root.querySelectorAll("[data-side]").forEach(b => { b.classList.toggle("on", b.dataset.side === side); b.style.color = b.dataset.side === side ? (side === "long" ? "var(--up)" : "var(--down)") : ""; });
      root.querySelectorAll("[data-ot]").forEach(b => { b.style.color = b.dataset.ot === otype ? "var(--brand-2)" : "var(--muted)"; });
      $("#lpf").classList.toggle("hide", otype !== "limit");
      const go = $("#fgo"); go.className = "btn btn-block " + (side === "long" ? "btn-up" : "btn-down"); go.textContent = side === "long" ? "Buy / Long" : "Sell / Short";
      go.disabled = p.closed;
      $("#mbook").innerHTML = bookHtml(7, false);
    }
    function tradeFut(){
      const {p, mg} = futInputs(), err = $("#ferr");
      const tp = tpsl ? parseFloat($("#tp").value) || null : null, sl = tpsl ? parseFloat($("#sl2").value) || null : null;
      const lp = otype === "limit" ? parseFloat($("#lp").value) : null;
      if (otype === "limit" && !(lp > 0)){ err.textContent = "Enter a limit price."; toast("Enter a limit price", "bad"); return; }
      const r = E.openFut({sym, side, margin:mg, lev, type:otype, price:lp, tp, sl});
      if (r.err){ err.textContent = r.err; $("#mf").classList.toggle("err", /margin|balance/i.test(r.err)); U.buzz([30,40,30]); toast(r.err, "bad"); return; }
      err.textContent = ""; $("#mf").classList.remove("err");
      if (tp || sl) E.award("tpsl");
      s.settings.lev = lev; store.save();
      U.beep("open"); U.buzz(25);
      toast(r.order ? `Limit order placed @ ${M.fmtPx(p, lp)}` : `${side === "long" ? "Long" : "Short"} ${lev}x opened @ ${M.fmtPx(p, r.pos.entry)}`, "ok");
      setPtab(r.order ? "ord" : "pos");
    }
    function levSheet(){
      const mx = E.maxLev(P()); let v = lev;
      const marks = [1, Math.round(mx*.2), Math.round(mx*.4), Math.round(mx*.6), Math.round(mx*.8), mx];
      U.sheet("Adjust leverage", `<div style="text-align:center;margin:8px 0 4px"><span class="num" style="font-size:34px;font-weight:600" id="lv">${v}x</span></div>
        <div class="row"><button class="icon-btn boxed" data-m>${ic("minus",16)}</button><input type="range" class="slider grow" id="lr" min="1" max="${mx}" value="${v}"><button class="icon-btn boxed" data-p>${ic("plus",16)}</button></div>
        <div class="chips" style="justify-content:space-between;margin:10px 0 14px">${marks.map(m => `<button data-q="${m}">${m}x</button>`).join("")}</div>
        <div class="notice n-r" id="lw" style="margin-bottom:14px">${ic("info",14)}<span>Higher leverage = higher risk. Liquidation moves closer to your entry.</span></div>
        <div class="kv" style="margin-bottom:14px"><span>Max position at this leverage</span><b class="num" id="lmx"></b></div>
        <button class="btn btn-primary btn-block btn-lg" data-ok>Confirm</button>`, el => {
        const upd = () => { el.querySelector("#lv").textContent = v + "x"; el.querySelector("#lr").value = v; el.querySelector("#lmx").textContent = money(s.balance * v) + " USDT"; };
        upd();
        el.querySelector("#lr").oninput = e => { v = +e.target.value; upd(); if (v % 5 === 0) U.buzz(4); };
        el.querySelector("[data-m]").onclick = () => { v = Math.max(1, v-1); upd(); };
        el.querySelector("[data-p]").onclick = () => { v = Math.min(mx, v+1); upd(); };
        el.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { v = +b.dataset.q; upd(); });
        el.querySelector("[data-ok]").onclick = () => { lev = v; U.closeLayer(); renderFut(); toast(`Leverage set to ${v}x`, "ok", 1500); };
      });
    }

    /* ----- Positions ----- */
    function setPtab(k){ ptab = k; root.querySelectorAll("[data-pt]").forEach(b => b.classList.toggle("on", b.dataset.pt === k)); renderPositions(); }
    function renderStats(){
      if (isBin){ const st = E.stats(); $("#sm").innerHTML = `<div><span class="label">Trades</span><b>${st.trades}</b></div><div><span class="label">Win rate</span><b>${st.winRate.toFixed(0)}%</b></div><div><span class="label">Net PnL</span><b class="${st.net>=0?"up":"down"}">${signed(st.net)}</b></div>`; }
      else { const h = s.fut.history, net = h.reduce((a,x) => a + x.profit, 0), w = h.filter(x => x.profit > 0).length, upnl = s.fut.positions.reduce((a,p) => a + E.futPnl(p).pnl, 0);
        $("#sm").innerHTML = `<div><span class="label">Unrealized</span><b class="${upnl>=0?"up":"down"}">${signed(upnl)}</b></div><div><span class="label">Win rate</span><b>${h.length ? Math.round(w/h.length*100) : 0}%</b></div><div><span class="label">Realized</span><b class="${net>=0?"up":"down"}">${signed(net)}</b></div>`; }
    }
    function renderPositions(){
      const list = $("#plist");
      $("#pc").textContent = isBin ? s.positions.length : s.fut.positions.length;
      if (!isBin) $("#oc").textContent = s.fut.orders.length;
      if (ptab === "pos"){
        const open = isBin ? s.positions : s.fut.positions;
        if (!open.length){ list.innerHTML = UI.emptyState("layers", isBin ? "No open positions. Choose Up or Down to place a trade." : "No open positions. Open a Long or Short above."); return; }
        list.innerHTML = (isBin ? open.slice().reverse().map(pos => { const p = M.get(pos.sym); return `<div class="pos" data-id="${pos.id}">
          <div class="pos-h"><button class="row" data-open="${pos.sym}" style="gap:6px">${UI.pairIcon(p,18)}<b style="font-size:14px">${esc(M.label(p))}</b></button><span class="ls ${pos.dir==="up"?"long":"short"}">${pos.dir==="up"?"Up ▲":"Down ▼"}</span>${pos.source==="auto"?'<span class="tag">Auto</span>':""}<span class="grow"></span><span class="cd num brand-c" data-cd></span></div>
          <div class="pos-g"><div><span>Amount</span><b class="num">${money(pos.amount)}</b></div><div><span>Entry</span><b class="num">${M.fmtPx(p,pos.entry)}</b></div><div><span>PnL (USDT)</span><b class="num" data-pnl></b></div>
          <div><span>Expiry</span><b>${pos.expiry<60?pos.expiry+"s":pos.expiry/60+"m"}</b></div><div><span>Mark</span><b class="num" data-now></b></div><div><span>Payout</span><b class="num">${money(pos.amount*E.RATIO)}</b></div></div>
          <div class="prog"><i data-pg></i></div></div>`; }).join("")
        : open.slice().reverse().map(pos => { const p = M.get(pos.sym); return `<div class="pos" data-id="${pos.id}">
          <div class="pos-h"><span class="ls ${pos.side==="long"?"long":"short"}">${pos.side==="long"?"L":"S"}</span><button data-open="${pos.sym}"><b style="font-size:14px">${esc(p.type==="crypto"?p.base+"USDT":p.sym)}</b></button><span class="tag">Perp</span><span class="tag">Isolated ${pos.lev}x</span><span class="grow"></span><button class="btn btn-ghost btn-sm" data-share="${pos.id}" aria-label="Share PnL">${ic("share",14)}</button></div>
          <div class="pos-g"><div><span>Unrealized PnL</span><b class="num" data-pnl></b></div><div><span>ROE</span><b class="num" data-roe></b></div><div><span>Size</span><b class="num">${money(pos.margin*pos.lev)}</b></div>
          <div><span>Entry</span><b class="num">${M.fmtPx(p,pos.entry)}</b></div><div><span>Mark</span><b class="num" data-now></b></div><div><span>Liq. price</span><b class="num" style="color:#F7931A">${M.fmtPx(p,pos.liq)}</b></div>
          <div><span>Margin</span><b class="num">${money(pos.margin)}</b></div><div><span>TP / SL</span><b class="num">${pos.tp?M.fmtPx(p,pos.tp):"--"} / ${pos.sl?M.fmtPx(p,pos.sl):"--"}</b></div><div></div></div>
          <div class="row" style="margin-top:10px"><button class="btn btn-ghost btn-sm grow" data-tpsl="${pos.id}">TP/SL</button><button class="btn btn-ghost btn-sm grow" data-close="${pos.id}">Close</button></div></div>`; }).join(""))
          + (!isBin && open.length > 1 ? `<button class="more-btn" data-closeall>Close all positions</button>` : "");
        tickPositions();
      } else if (ptab === "ord"){
        const o = s.fut.orders;
        list.innerHTML = o.length ? o.map(x => { const p = M.get(x.sym); return `<div class="pos"><div class="pos-h"><span class="ls ${x.side==="long"?"long":"short"}">Limit ${x.side==="long"?"Buy":"Sell"}</span><b>${esc(M.label(p))}</b><span class="tag">${x.lev}x</span><span class="grow"></span><button class="btn btn-ghost btn-sm" data-cancel="${x.id}">Cancel</button></div>
          <div class="pos-g"><div><span>Price</span><b class="num">${M.fmtPx(p,x.price)}</b></div><div><span>Margin</span><b class="num">${money(x.margin)}</b></div><div><span>Time</span><b>${U.timeStr(x.t)}</b></div></div></div>`; }).join("") : UI.emptyState("file","No open orders.");
      } else {
        const h = isBin ? s.history.slice(0, 50) : s.fut.history.slice(0, 50);
        if (!h.length){ list.innerHTML = UI.emptyState("history", "No history yet."); return; }
        list.innerHTML = h.map(x => { const p = M.get(x.sym) || {dp:2, type:"crypto", base:x.sym, quote:""}; return isBin
          ? `<div class="pos"><div class="pos-h">${UI.pairIcon(M.get(x.sym),18)}<b>${esc(M.label(p))}</b><span class="ls ${x.dir==="up"?"long":"short"}">${x.dir==="up"?"Up":"Down"}</span><span class="grow"></span><b class="num ${x.profit>0?"up":x.profit<0?"down":""}">${signed(x.profit)} USDT</b></div>
             <div class="pos-g"><div><span>Entry</span><b class="num">${M.fmtPx(p,x.entry)}</b></div><div><span>Exit</span><b class="num">${M.fmtPx(p,x.exit)}</b></div><div><span>${x.result.toUpperCase()}</span><b>${U.timeStr(x.closed)}</b></div></div></div>`
          : `<div class="pos"><div class="pos-h"><span class="ls ${x.side==="long"?"long":"short"}">${x.side==="long"?"Long":"Short"} ${x.lev}x</span><b>${esc(M.label(p))}</b><span class="tag">${x.reason === "liquidated" ? "Liquidated" : x.reason.toUpperCase()}</span><span class="grow"></span><b class="num ${x.profit>=0?"up":"down"}">${signed(x.profit)} USDT</b></div>
             <div class="pos-g"><div><span>Entry</span><b class="num">${M.fmtPx(p,x.entry)}</b></div><div><span>Exit</span><b class="num">${M.fmtPx(p,x.exit)}</b></div><div><span>Closed</span><b>${U.timeStr(x.closed)}</b></div></div></div>`; }).join("");
      }
    }
    function tickPositions(){
      if (ptab !== "pos" || !root) return;
      const now = Date.now();
      if (isBin) s.positions.forEach(pos => {
        const r = root.querySelector(`.pos[data-id="${pos.id}"]`); if (!r) return;
        const {win, pnl} = E.livePnl(pos), p = M.get(pos.sym), left = (pos.exp - now)/1000;
        r.querySelector("[data-cd]").textContent = "⏱ " + mmss(left);
        r.querySelector("[data-now]").textContent = M.fmtPx(p);
        const el = r.querySelector("[data-pnl]"); el.textContent = win == null ? "0.00" : win ? "+" + money(pnl) : "-" + money(pos.amount); el.className = "num " + (win == null ? "" : win ? "up" : "down");
        r.querySelector("[data-pg]").style.width = U.clamp((now - pos.open)/(pos.exp - pos.open)*100, 0, 100) + "%";
        const sec = Math.ceil(left); if (sec <= 5 && sec > 0 && cdLast[pos.id] !== sec && pos.sym === sym){ cdLast[pos.id] = sec; U.beep("tick"); }
      });
      else s.fut.positions.forEach(pos => {
        const r = root.querySelector(`.pos[data-id="${pos.id}"]`); if (!r) return;
        const {pnl, roe, px} = E.futPnl(pos), p = M.get(pos.sym);
        r.querySelector("[data-now]").textContent = M.fmtPx(p, px);
        const a = r.querySelector("[data-pnl]"), b = r.querySelector("[data-roe]");
        a.textContent = signed(pnl); b.textContent = signed(roe) + "%"; a.className = b.className = "num " + (pnl >= 0 ? "up" : "down");
      });
    }
    function tpslSheet(id){
      const pos = s.fut.positions.find(x => x.id === id); if (!pos) return; const p = M.get(pos.sym);
      U.sheet("TP / SL", `<div class="kv"><span>Entry</span><b class="num">${M.fmtPx(p,pos.entry)}</b></div><div class="kv"><span>Mark</span><b class="num">${M.fmtPx(p)}</b></div><div class="kv" style="margin-bottom:14px"><span>Liq. price</span><b class="num" style="color:#F7931A">${M.fmtPx(p,pos.liq)}</b></div>
        <div class="form-row"><label>Take profit (${pos.side==="long"?"above":"below"} entry)</label><div class="field"><input id="t1" type="number" inputmode="decimal" value="${pos.tp||""}"></div><div class="label" id="t1e"></div></div>
        <div class="form-row"><label>Stop loss (${pos.side==="long"?"below":"above"} entry)</label><div class="field"><input id="t2" type="number" inputmode="decimal" value="${pos.sl||""}"></div><div class="label" id="t2e"></div></div>
        <div class="err-msg" id="te"></div><button class="btn btn-primary btn-block btn-lg" data-ok>Confirm</button>`, el => {
        const est = (v, k) => { const x = parseFloat(v); el.querySelector("#" + k + "e").textContent = x ? `Est. PnL: ${signed(E.futPnl(pos, x).pnl)} USDT` : ""; };
        el.querySelector("#t1").oninput = e => est(e.target.value, "t1"); el.querySelector("#t2").oninput = e => est(e.target.value, "t2");
        est(pos.tp, "t1"); est(pos.sl, "t2");
        el.querySelector("[data-ok]").onclick = () => { const e = E.setTpSl(id, parseFloat(el.querySelector("#t1").value) || null, parseFloat(el.querySelector("#t2").value) || null); if (e){ el.querySelector("#te").textContent = e; return; } E.award("tpsl"); U.closeLayer(); toast("TP/SL updated", "ok"); };
      });
    }
    function shareCard(id){
      const pos = s.fut.positions.find(x => x.id === id); if (!pos) return; const p = M.get(pos.sym), {pnl, roe} = E.futPnl(pos);
      U.modal(`<div class="row" style="justify-content:center;margin-bottom:12px">${UI.logo(22)}<b>${esc(C.APP_NAME)}</b></div>
        <div class="row" style="justify-content:center;gap:6px"><span class="ls ${pos.side==="long"?"long":"short"}">${pos.side==="long"?"Long":"Short"} ${pos.lev}x</span><b>${esc(M.label(p))}</b></div>
        <div class="num ${roe>=0?"up":"down"}" style="font-size:40px;font-weight:700;margin:10px 0">${signed(roe)}%</div><div class="num ${pnl>=0?"up":"down"}" style="margin-bottom:12px">${signed(pnl)} USDT</div>
        <div class="kv"><span>Entry</span><b class="num">${M.fmtPx(p,pos.entry)}</b></div><div class="kv" style="margin-bottom:16px"><span>Mark</span><b class="num">${M.fmtPx(p)}</b></div>
        <div class="row"><button class="btn btn-ghost grow" data-x>Close</button><button class="btn btn-primary grow" data-c>Copy</button></div>`, el => {
        el.querySelector("[data-x]").onclick = U.closeLayer;
        el.querySelector("[data-c]").onclick = () => U.copyText(`${M.label(p)} ${pos.side} ${pos.lev}x · ROE ${signed(roe)}% on ${C.APP_NAME}`, "PnL copied");
      });
    }

    /* ----- Sheets: pair picker, alert, candle detail, indicator guide ----- */
    function pickSheet(){
      let q = "", m = isBin ? "tradable" : "all";
      const body = () => {
        const qq = q.toUpperCase();
        const list = [...M.pairs.values()].filter(p => (m === "all" || p.tradable) && (!qq || p.sym.includes(qq) || p.name.toUpperCase().includes(qq)))
          .sort((a,b) => (b.tradable-a.tradable) || ((a.type==="crypto"?a.rank||999:500) - (b.type==="crypto"?b.rank||999:500))).slice(0, 150);
        return list.map(p => `<button class="list-item" style="width:100%" data-s="${p.sym}">${UI.pairIcon(p,28)}<div class="grow"><b>${esc(M.label(p))}</b><div class="label">${p.closed ? "Market closed" : isBin ? (p.tradable ? "Binary · +92%" : "Chart only") : "Perp · " + E.maxLev(p) + "x"}</div></div>
          <div style="text-align:right"><div class="num" style="font-weight:500">${M.fmtPx(p)}</div><div class="num ${p.chg<0?"down":"up"}" style="font-size:12px">${p.closed||p.chg==null?"":pct(p.chg)}</div></div></button>`).join("") || UI.emptyState("search","No pairs found.");
      };
      U.sheet("Select market", `<label class="search" style="margin-bottom:10px">${ic("search",16)}<input id="ps" placeholder="Search e.g., SOL" autocomplete="off"></label>
        <div class="seg" style="margin-bottom:6px"><button class="${m==="tradable"?"on":""}" data-m="tradable">Binary pairs</button><button class="${m==="all"?"on":""}" data-m="all">All markets</button></div><div id="pl">${body()}</div>`, el => {
        const pl = el.querySelector("#pl");
        el.querySelector("#ps").addEventListener("input", e => { q = e.target.value; pl.innerHTML = body(); });
        el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { m = b.dataset.m; el.querySelectorAll("[data-m]").forEach(x => x.classList.toggle("on", x===b)); pl.innerHTML = body(); });
        pl.addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b){ U.closeLayer(); switchPair(b.dataset.s); } });
      });
    }
    function alertSheet(){
      const p = P();
      U.sheet("Price alert · " + M.label(p), `<div class="kv" style="margin-bottom:12px"><span>Current price</span><b class="num">${M.fmtPx(p)}</b></div>
        <div class="field"><input id="ap" type="number" inputmode="decimal" value="${p.price ? +(p.price*1.01).toFixed(p.dp) : ""}" aria-label="Alert price"><span class="unit">${esc(p.quote)}</span></div>
        <div class="chips" style="margin:10px 0 14px">${[-5,-2,-1,1,2,5].map(x => `<button data-pc="${x}">${x>0?"+":""}${x}%</button>`).join("")}</div>
        <button class="btn btn-primary btn-block btn-lg" data-ok>Create alert</button><a class="more-btn" href="#/alerts">Manage alerts</a>`, el => {
        el.querySelectorAll("[data-pc]").forEach(b => b.onclick = () => el.querySelector("#ap").value = +(p.price * (1 + b.dataset.pc/100)).toFixed(p.dp));
        el.querySelector("[data-ok]").onclick = () => { const v = parseFloat(el.querySelector("#ap").value); if (!(v > 0)) return toast("Enter a valid price", "bad");
          s.alerts.unshift({id:U.uid(), sym, price:v, t:Date.now(), last:p.price}); store.save(); E.award("alert"); U.closeLayer(); toast(`Alert set at ${M.fmtPx(p, v)}`, "ok"); };
      });
    }
    function candleDetail(d){
      const p = P(), b = d.bar, f = v => v == null ? "--" : M.fmtPx(p, v), ch = d.prev ? (b.close - d.prev.close) : (b.close - b.open), chp = ch / (d.prev ? d.prev.close : b.open) * 100;
      const bull = b.close >= b.open, body = Math.abs(b.close - b.open), rng = b.high - b.low || 1;
      const kind = body / rng < 0.1 ? "Doji (indecision)" : body / rng > 0.7 ? (bull ? "Strong bullish candle" : "Strong bearish candle") : (bull ? "Bullish candle" : "Bearish candle");
      const rsiTxt = d.rsiFull == null ? "" : d.rsiFull > 70 ? "RSI overbought" : d.rsiFull < 30 ? "RSI oversold" : "RSI neutral";
      const start = new Date(b.time*1000), end = new Date((b.time + d.sec)*1000);
      const svgH = 90, sc = v => 8 + (b.high - v) / rng * (svgH - 16), c = bull ? "var(--up)" : "var(--down)";
      U.sheet("Candle details", `<div class="row" style="gap:14px;margin-bottom:10px">
          <svg width="56" height="${svgH}" viewBox="0 0 56 ${svgH}" aria-hidden="true"><line x1="28" x2="28" y1="${sc(b.high)}" y2="${sc(b.low)}" stroke="${c}" stroke-width="2"/><rect x="14" y="${Math.min(sc(b.open),sc(b.close))}" width="28" height="${Math.max(2, Math.abs(sc(b.open)-sc(b.close)))}" rx="2" fill="${c}"/></svg>
          <div class="grow"><b style="font-size:15px">${esc(M.label(p))} · ${d.tf === "tick" ? "Tick" : d.tf.toUpperCase()}</b><div class="label">${start.toLocaleString()} → ${end.toLocaleTimeString()}</div>
          <div class="num ${chp>=0?"up":"down"}" style="font-size:20px;font-weight:600;margin-top:4px">${chp>=0?"+":""}${chp.toFixed(3)}%</div><div class="label">${kind}${rsiTxt ? " · " + rsiTxt : ""}</div></div></div>
        <div class="cdetail">${[["Open",f(b.open)],["High",f(b.high)],["Low",f(b.low)],["Close",f(b.close)],["Change",(ch>=0?"+":"")+M.fmtPx(p,ch)],["Amplitude",((b.high-b.low)/b.low*100).toFixed(3)+"%"],["Volume",CH.fmtVol(b.volume||0)],["Body / Range",(body/rng*100).toFixed(0)+"%"],
          ["EMA 7",f(d.ind.e7)],["EMA 25",f(d.ind.e25)],["EMA 99",f(d.ind.e99)],["BOLL mid",f(d.ind.bm)],["BOLL up",f(d.ind.bu)],["BOLL low",f(d.ind.bl)],["SuperTrend",d.ind.st==null?"--":f(d.ind.st) + (d.ind.stDir===1?" ▲":" ▼")],["RSI 14",d.rsiFull==null?"--":d.rsiFull.toFixed(2)],["MACD",d.ind.macd==null?"--":d.ind.macd.toFixed(p.dp+1)],["Signal",d.ind.sig==null?"--":d.ind.sig.toFixed(p.dp+1)]]
          .map(([a,v]) => `<div><span>${a}</span><b class="num">${v}</b></div>`).join("")}</div>
        <div class="ud" style="margin-top:14px">${isBin ? `<button class="btn btn-up" data-q="up">Up</button><button class="btn btn-down" data-q="down">Down</button>` : `<button class="btn btn-up" data-q="long">Buy / Long</button><button class="btn btn-down" data-q="short">Sell / Short</button>`}</div>`, el => {
        el.querySelectorAll("[data-q]").forEach(x => x.onclick = () => { U.closeLayer(); if (isBin) tradeBinary(x.dataset.q); else { side = x.dataset.q; renderFut(); $("#mg").focus(); } });
      });
    }
    function indGuide(){
      U.sheet("Indicator guide", IND.LIST.map(x => `<div class="list-item" style="align-items:flex-start"><span class="ic ic-y">${ic("trend",16)}</span><div class="grow"><b>${x.name}</b><div class="sub" style="font-size:13px;margin-top:2px">${x.desc}</div></div><button class="switch ${CH.inds.includes(x.k)?"on":""}" data-ik="${x.k}" aria-label="${x.k}"></button></div>`).join("") + `<a class="more-btn" href="#/academy">Learn more in Academy ${ic("chev",14)}</a>`, el => {
        el.querySelectorAll("[data-ik]").forEach(b => b.onclick = () => { toggleInd(b.dataset.ik); b.classList.toggle("on", CH.inds.includes(b.dataset.ik)); });
      });
    }
    function toggleInd(k){
      const l = CH.inds.includes(k) ? CH.inds.filter(x => x !== k) : [...CH.inds, k];
      CH.setInds(l); renderInds(); if (l.length >= 3) E.award("ind");
    }
    function renderInds(){ root.querySelectorAll("[data-ind]").forEach(b => b.classList.toggle("on", CH.inds.includes(b.dataset.ind))); }

    /* ----- Misc ----- */
    function setTf(x){
      tf = x; sessionStorage.setItem("tf_" + mode, tf);
      root.querySelectorAll("#tfs [data-tf]").forEach(b => b.classList.toggle("on", b.dataset.tf === tf));
      root.querySelector(`#tfs [data-tf="${tf}"]`)?.scrollIntoView({inline:"nearest", block:"nearest"});
      CH.load(sym, tf);
    }
    function switchPair(ns){ if (ns !== sym) location.hash = (isBin ? "#/trade/" : "#/futures/") + ns; }
    function fullscreen(on){
      const cc = $("#cc"); cc.classList.toggle("fs", on); document.body.classList.toggle("fs-on", on);
      $("[data-fs]").innerHTML = ic(on ? "shrink" : "expand", 15);
      if (on){ try { document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.("landscape").catch(() => {})).catch(() => {}); } catch {} }
      else if (document.fullscreenElement){ try { document.exitFullscreen(); } catch {} }
      setTimeout(CH.resize, 60); setTimeout(CH.resize, 400); renderPx();
    }
    function resultPopup(rec){
      if (!isBin) return;
      const p = M.get(rec.sym), w = rec.result === "win", l = rec.result === "loss";
      if (w){ U.confetti(); U.beep("win"); U.buzz([40,40,80]); } else if (l){ U.beep("loss"); U.buzz(150); }
      toast(w ? `You won +${money(rec.profit)} USDT!` : l ? `Trade lost -${money(rec.amount)} USDT` : "Draw — amount refunded", w ? "ok" : l ? "bad" : "info", 3500);
      U.modal(`<div class="res-ic ${w?"w":l?"l":"d"}">${ic(w?"trophy":l?"x":"reset",32)}</div>
        <div class="h1" style="margin-bottom:4px">${w ? "You won!" : l ? "Trade lost" : "Draw — refunded"}</div>
        <div class="num ${w?"up":l?"down":""}" style="font-size:30px;font-weight:700;margin:8px 0">${signed(rec.profit)} USDT</div>
        <div class="sub" style="margin-bottom:16px;font-size:13px">${esc(M.label(p))} · ${rec.dir==="up"?"Up":"Down"} · ${money(rec.amount)} USDT<br>Entry ${M.fmtPx(p, rec.entry)} → Exit ${M.fmtPx(p, rec.exit)}</div>
        <div class="row"><button class="btn btn-ghost grow" data-x>Close</button><button class="btn btn-primary grow" data-again>Trade again</button></div>`, el => {
        el.querySelector("[data-x]").onclick = U.closeLayer;
        el.querySelector("[data-again]").onclick = () => { U.closeLayer(); if (rec.sym !== sym) switchPair(rec.sym); else tradeBinary(rec.dir); };
      });
    }
    function futClosed({pos, profit, reason}){
      if (isBin) return;
      U.beep(profit >= 0 ? "win" : "loss"); U.buzz(profit >= 0 ? [40,40,80] : 150);
      toast(`${reason === "liquidated" ? "Liquidated" : reason === "tp" ? "Take profit hit" : reason === "sl" ? "Stop loss hit" : "Position closed"}: ${signed(profit)} USDT`, profit >= 0 ? "ok" : "bad", 3500);
      if (profit > 0 && reason !== "manual") U.confetti();
    }
    function renderNotif(){ const n = $("#nb"); if (!n) return; n.textContent = s.unread > 9 ? "9+" : s.unread; n.classList.toggle("hide", !s.unread); }

    return {html, title: M.label(P()) + (isBin ? " Binary" : " Futures"), mount(r){
      root = r;
      renderHead(); renderStats(); renderPositions(); renderNotif();
      CH.mount($("#chart"), {legend:$("#lg"), overlay:$("#ovl"), msg:$("#cmsg")}, candleDetail);
      renderInds();
      M.watchTrades(sym);
      setTf(tf);
      if (isBin){
        $("#amt").value = s.settings.defAmt || 10;
        renderBinary();
        const amt = $("#amt");
        amt.addEventListener("input", () => { $("#err").textContent = ""; $("#af").classList.remove("err"); renderBinary(); });
        $("[data-half]").onclick = () => { amt.value = Math.max(1, Math.floor((parseFloat(amt.value)||0) / 2 * 100) / 100); renderBinary(); };
        $("[data-dbl]").onclick = () => { amt.value = Math.min(Math.floor(s.balance*100)/100, Math.round((parseFloat(amt.value)||0) * 2 * 100) / 100) || 1; renderBinary(); };
        root.querySelectorAll("#qa [data-v]").forEach(b => b.onclick = () => { amt.value = b.dataset.v === "max" ? Math.floor(Math.min(s.balance, 50000)*100)/100 : b.dataset.v; renderBinary(); });
        root.querySelectorAll("[data-e]").forEach(b => b.onclick = () => { exp = +b.dataset.e; renderBinary(); });
        root.querySelectorAll("[data-dir]").forEach(b => b.onclick = () => tradeBinary(b.dataset.dir));
      } else {
        renderFut();
        root.querySelectorAll("[data-side]").forEach(b => b.onclick = () => { side = b.dataset.side; renderFut(); });
        root.querySelectorAll("[data-ot]").forEach(b => b.onclick = () => { otype = b.dataset.ot; if (otype === "limit" && !$("#lp").value) $("#lp").value = P().price ? +P().price.toFixed(P().dp) : ""; renderFut(); });
        $("[data-lev]").onclick = levSheet;
        $("[data-margin]").onclick = () => toast("Isolated margin: each position has its own margin and liquidation price.", "info", 3500);
        const sl = $("#sl");
        sl.oninput = () => { $("#mg").value = sl.value > 0 ? Math.floor(s.balance / (1 + lev*C.FEE) * sl.value) / 100 : ""; if (sl.value % 25 === 0) U.buzz(5); renderFut(); };
        $("#mg").addEventListener("input", () => { $("#ferr").textContent = ""; $("#mf").classList.remove("err"); sl.value = Math.min(100, (parseFloat($("#mg").value)||0) / s.balance * 100); renderFut(); });
        $("#lp").addEventListener("input", renderFut);
        $("#tpc").onchange = e => { tpsl = e.target.checked; $("#tpsl").classList.toggle("hide", !tpsl); };
        $("#fgo").onclick = tradeFut;
      }
      root.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { if (b.dataset.mode !== mode) location.hash = (b.dataset.mode === "binary" ? "#/trade/" : "#/futures/") + sym; });
      $("[data-pick]").onclick = pickSheet;
      $("[data-bell]").onclick = UI.openNotifs;
      $("[data-alert]").onclick = alertSheet;
      $("[data-star]").onclick = () => { const i = s.favs.indexOf(sym); if (i >= 0) s.favs.splice(i,1); else s.favs.push(sym); store.save(); renderHead(); toast(i >= 0 ? "Removed from favorites" : "Added to favorites", "ok", 1400); };
      root.querySelectorAll("#tfs [data-tf]").forEach(b => b.onclick = () => setTf(b.dataset.tf));
      root.querySelectorAll("[data-ind]").forEach(b => b.onclick = () => toggleInd(b.dataset.ind));
      $("[data-indinfo]").onclick = indGuide;
      $("[data-ctype]").onclick = () => { CH.setType(CH.type === "line" ? "candle" : "line"); toast(CH.type === "line" ? "Line chart" : "Candlestick chart", "info", 1200); };
      $("[data-fs]").onclick = () => fullscreen(!$("#cc").classList.contains("fs"));
      $("[data-fsx]").onclick = () => fullscreen(false);
      const fsx = () => { if (!document.fullscreenElement && $("#cc")?.classList.contains("fs")) fullscreen(false); };
      document.addEventListener("fullscreenchange", fsx); timers.push(() => document.removeEventListener("fullscreenchange", fsx));
      root.querySelectorAll("[data-z]").forEach(b => b.onclick = () => CH.zoom(+b.dataset.z));
      $("[data-rt]").onclick = CH.reset;
      root.querySelectorAll("[data-ct]").forEach(b => b.onclick = () => { ctab = b.dataset.ct; root.querySelectorAll("[data-ct]").forEach(x => x.classList.toggle("on", x===b)); $("#cpChart").classList.toggle("hide", ctab !== "chart"); $("#cpOther").classList.toggle("hide", ctab === "chart"); if (ctab === "chart") setTimeout(CH.resize, 30); else renderOther(); });
      root.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => setPtab(b.dataset.pt));
      $("#plist").addEventListener("click", async e => {
        const o = e.target.closest("[data-open]"); if (o) return switchPair(o.dataset.open);
        const c = e.target.closest("[data-close]"); if (c){ const pr = E.closeFut(c.dataset.close); if (pr != null) toast(`Position closed: ${signed(pr)} USDT`, pr >= 0 ? "ok" : "bad"); return; }
        if (e.target.closest("[data-closeall]") && await U.confirmBox("Close all positions?", "All open futures positions will be closed at market price.", "Close all", true)){ [...s.fut.positions].forEach(p => E.closeFut(p.id)); toast("All positions closed", "ok"); return; }
        const tsl = e.target.closest("[data-tpsl]"); if (tsl) return tpslSheet(tsl.dataset.tpsl);
        const sh = e.target.closest("[data-share]"); if (sh) return shareCard(sh.dataset.share);
        const cn = e.target.closest("[data-cancel]"); if (cn){ E.cancelOrder(cn.dataset.cancel); toast("Order cancelled", "ok"); }
      });
      let pxT = 0;
      offs.push(
        bus.on("tick", x => { if (x === sym){ const n = performance.now(); if (n - pxT > 150){ pxT = n; renderPx(); if (!isBin) renderFut(); } } }),
        bus.on("meta", x => { if (x === sym){ renderPx(); isBin ? renderBinary() : renderFut(); } }),
        bus.on("depth", x => { if (x === sym){ if (ctab === "book") renderOther(); if (!isBin) $("#mbook").innerHTML = bookHtml(7, false); } }),
        bus.on("trade", x => { if (x === sym && ctab === "trades") renderOther(); }),
        bus.on("sec", tickPositions), bus.on("balance", () => { isBin ? renderBinary() : renderFut(); }), bus.on("positions", () => { renderPositions(); renderStats(); }),
        bus.on("history", () => { renderStats(); if (ptab === "hist") renderPositions(); }), bus.on("settled", resultPopup), bus.on("futClosed", futClosed), bus.on("notifs", renderNotif)
      );
      const st = setInterval(() => { senti(); isBin && renderBinary(); renderStats(); }, 2000); senti(); timers.push(() => clearInterval(st));
    }, unmount(){ offs.forEach(f => f()); timers.forEach(f => f()); CH.destroy(); M.unwatchTrades(); document.body.classList.remove("fs-on"); if (document.fullscreenElement) try{ document.exitFullscreen(); }catch{} }};
  };
}
Pages.trade = makeTrade("binary");
Pages.futures = makeTrade("futures");
})();
