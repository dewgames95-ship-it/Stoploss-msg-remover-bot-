/* ===== Trading screens: Price/Chart page, USDⓈ-M Futures, Binary Options ===== */
(function(){
const C = window.CONFIG, {esc, ic, t, store, bus, money, signed, pct, mmss, toast, fmt} = U;
const TFS = ["tick","1m","5m","15m","1h","4h","1d","5s","15s","30s"];
const TFL = {tick:"Time", "1d":"1D"};
const INDS_MAIN = ["MA","EMA","BOLL","SAR","VWAP","SUPER"], INDS_SUB = ["VOL","RSI","MACD"];
const S = () => store.s;
const fsym = p => p.type === "crypto" ? p.base + "USDT" : p.sym;

/* ---------------- shared pieces ---------------- */
function resolveSym(params, key){
  let sym = (params[0] || sessionStorage.getItem(key) || "BTCUSDT").toUpperCase();
  if (!M.get(sym) && M.get(sym + "USDT")) sym += "USDT";
  return sym;
}
function loadingPage(title){
  let off;
  return {title:"Loading", html: UI.pageHead(title) + `<div>${Array(8).fill('<div class="skel"></div>').join("")}</div>`, mount(){ off = bus.on("list", () => App.route()); }, unmount(){ off?.(); }};
}
function chartBlock(){
  return `<div class="tfbar"><div class="tfs" id="tfs">${TFS.map(x => `<button data-tf="${x}">${TFL[x] || x}</button>`).join("")}</div>
      <button class="ti" data-ctype aria-label="Chart type">${ic("candle",18)}</button><button class="ti" data-drawt aria-label="Drawing tools">${ic("pen",17)}</button><button class="ti" data-indset aria-label="Indicator settings">${ic("grid",17)}</button></div>
    <div class="drawbar hide" id="drawbar">${[["trend","Trend line"],["ray","Ray"],["hline","Horizontal"],["rect","Rectangle"],["fib","Fib"]].map(([k,n]) => `<button data-tool="${k}">${n}</button>`).join("")}<button data-undo>${ic("reset",13)} Undo</button><button data-clear>${ic("trash",13)} Clear</button></div>
    <div class="cp-chart" id="cc"><div class="fs-head"><button class="icon-btn" data-fsx aria-label="Exit fullscreen">${ic("back",20)}</button><b id="fsl"></b><span class="grow"></span><b class="num" id="fsp"></b></div>
      <div class="chart-wrap"><div id="chart"></div><div class="legend" id="lg"></div><div class="chart-msg" id="cmsg"></div><button class="fs-btn" data-fs aria-label="Fullscreen">${ic("expand",15)}</button></div></div>
    <div class="indbar"><div class="il" id="inds">${INDS_MAIN.map(k => `<button data-ind="${k}">${k}</button>`).join("")}<span style="color:var(--line)">|</span>${INDS_SUB.map(k => `<button data-ind="${k}">${k}</button>`).join("")}</div><button class="ti" data-indinfo aria-label="Indicator guide">${ic("ind",18)}</button></div>`;
}
function bindChart(root, sym, tfKey, defTf, detailCb, opt={}){
  const $ = q => root.querySelector(q), offs = [], on = (q, f) => { const e = $(q); if (e) e.onclick = f; };
  let tf = sessionStorage.getItem(tfKey) || defTf;
  if (opt.tfs && !opt.tfs.includes(tf)) tf = defTf;
  CH.mount($("#chart"), {legend:$("#lg"), msg:$("#cmsg"), mode: tfKey === "tf_binary" ? "bin" : "fut", noInd: !!opt.mini}, detailCb);
  const renderInds = () => root.querySelectorAll("[data-ind]").forEach(b => b.classList.toggle("on", CH.inds.includes(b.dataset.ind)));
  const setTf = x => { tf = x; sessionStorage.setItem(tfKey, tf); root.querySelectorAll("#tfs [data-tf]").forEach(b => b.classList.toggle("on", b.dataset.tf === tf)); CH.load(sym, tf); };
  renderInds(); setTf(tf);
  root.querySelectorAll("#tfs [data-tf]").forEach(b => b.onclick = () => setTf(b.dataset.tf));
  root.querySelectorAll("[data-ind]").forEach(b => b.onclick = () => { const k = b.dataset.ind, l = CH.inds.includes(k) ? CH.inds.filter(x => x !== k) : [...CH.inds, k]; CH.setInds(l); renderInds(); if (l.length >= 3) E.award("ind"); });
  on("[data-indinfo]", () => indGuide(renderInds)); on("[data-indset]", () => indGuide(renderInds));
  on("[data-ctype]", () => { CH.setType(CH.type === "line" ? "candle" : "line"); $("[data-ctype]").classList.toggle("on", CH.type === "line"); });
  $("[data-ctype]")?.classList.toggle("on", CH.type === "line");
  on("[data-drawt]", () => { const bar = $("#drawbar"); bar.classList.toggle("hide"); $("[data-drawt]").classList.toggle("on", !bar.classList.contains("hide")); if (bar.classList.contains("hide")) CH.setTool(null); });
  root.querySelectorAll("[data-tool]").forEach(b => b.onclick = () => { const on = CH.tool === b.dataset.tool; CH.setTool(on ? null : b.dataset.tool); if (!on) toast(b.dataset.tool === "hline" ? "Tap the chart to place the line" : "Tap two points on the chart", "info", 1600); });
  on("[data-undo]", () => CH.undoDraw()); on("[data-clear]", () => { CH.clearDraw(); toast("Drawings cleared", "ok", 1200); });
  offs.push(bus.on("drawtool", t => root.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === t))));
  const fs = on => { const cc = $("#cc"); cc.classList.toggle("fs", on); document.body.classList.toggle("fs-on", on);
    if (on){ try { document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.("landscape").catch(() => {})).catch(() => {}); } catch {} } else if (document.fullscreenElement){ try { document.exitFullscreen(); } catch {} }
    setTimeout(CH.resize, 60); setTimeout(CH.resize, 400); };
  on("[data-fs]", () => fs(!$("#cc").classList.contains("fs"))); on("[data-fsx]", () => fs(false));
  const fsx = () => { if (!document.fullscreenElement && $("#cc")?.classList.contains("fs")) fs(false); };
  document.addEventListener("fullscreenchange", fsx); offs.push(() => document.removeEventListener("fullscreenchange", fsx));
  return () => { offs.forEach(f => f()); CH.destroy(); document.body.classList.remove("fs-on"); if (document.fullscreenElement) try { document.exitFullscreen(); } catch {} };
}
/* Compact chart used inside Futures (like the exchange's in-position chart): no indicator bar */
const MINI_TFS = ["1m","5m","15m","1h","4h","1d"];
function miniChartBlock(sym){
  return `<div class="tfbar mini"><div class="tfs" id="tfs">${MINI_TFS.map(x => `<button data-tf="${x}">${TFL[x] || x}</button>`).join("")}</div>
    <button class="ti" data-ctype aria-label="Line / candles">${ic("candle",16)}</button><a class="ti" href="#/chart/${sym}" aria-label="Full chart">${ic("expand",15)}</a></div>
    <div class="cp-chart" id="cc"><div class="chart-wrap"><div id="chart"></div><div class="legend" id="lg"></div><div class="chart-msg" id="cmsg"></div></div></div>`;
}
function indGuide(cb){
  U.sheet("Indicators", IND.LIST.map(x => `<div class="list-item" style="align-items:flex-start"><div class="grow"><b>${x.name}</b><div class="sub" style="font-size:13px;margin-top:2px">${x.desc}</div></div><button class="switch ${CH.inds.includes(x.k)?"on":""}" data-ik="${x.k}" aria-label="${x.k}"></button></div>`).join("") + `<a class="more-btn" href="#/academy">Learn in Academy ${ic("chev",14)}</a>`, el => {
    el.querySelectorAll("[data-ik]").forEach(b => b.onclick = () => { const k = b.dataset.ik, l = CH.inds.includes(k) ? CH.inds.filter(x => x !== k) : [...CH.inds, k]; CH.setInds(l); b.classList.toggle("on", l.includes(k)); cb && cb(); });
  });
}
function pickSheet(cur, onPick, binaryOnly){
  let q = "", m = binaryOnly ? "binary" : "all";
  const body = () => {
    const qq = q.toUpperCase();
    const list = [...M.pairs.values()].filter(p => (m === "all" || p.tradable) && (!qq || p.sym.includes(qq) || UI.fullName(p).toUpperCase().includes(qq)))
      .sort((a,b) => ((a.type==="crypto"?a.rank||999:500) - (b.type==="crypto"?b.rank||999:500))).slice(0, 160);
    return list.map(p => `<button class="mkt-row" style="width:100%;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)" data-s="${p.sym}"><div class="row" style="gap:10px;min-width:0">${UI.pairIcon(p,26)}<div class="grow" style="text-align:left"><div class="sym">${esc(fsym(p))} <span class="perp">Perp</span></div><div class="sub2">${esc(UI.fullName(p))}${p.qv ? " | " + CH.fmtVol(p.qv) : ""}</div></div></div>
      <div style="text-align:right"><div class="num" style="font-weight:500">${M.fmtPx(p)}</div><div class="num ${p.chg<0?"down":"up"}" style="font-size:12px">${p.closed ? "Closed" : p.chg == null ? "" : pct(p.chg)}</div></div></button>`).join("") || UI.emptyState("search","No results");
  };
  U.sheet("", `<label class="search" style="margin-bottom:6px">${ic("search",16)}<input id="ps" placeholder="Search" autocomplete="off"></label>
    <div class="tabs" style="margin-bottom:4px"><button class="tab ${m==="all"?"on":""}" data-m="all">USDⓈ-M</button><button class="tab ${m==="binary"?"on":""}" data-m="binary">Binary</button></div><div id="pl">${body()}</div>`, el => {
    const pl = el.querySelector("#pl");
    el.querySelector("#ps").addEventListener("input", e => { q = e.target.value; pl.innerHTML = body(); });
    el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { m = b.dataset.m; el.querySelectorAll("[data-m]").forEach(x => x.classList.toggle("on", x===b)); pl.innerHTML = body(); });
    pl.addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b){ U.closeLayer(); if (b.dataset.s !== cur) onPick(b.dataset.s); } });
  });
}
function alertSheet(sym){
  const p = M.get(sym);
  U.sheet("Price alert · " + fsym(p), `<div class="kv" style="margin-bottom:12px"><span>Last price</span><b class="num">${M.fmtPx(p)}</b></div>
    <div class="field"><input id="ap" type="number" inputmode="decimal" value="${p.price ? +(p.price*1.01).toFixed(p.dp) : ""}" aria-label="Alert price"><span class="unit">${esc(p.quote)}</span></div>
    <div class="chips" style="margin:10px 0 14px">${[-5,-2,-1,1,2,5].map(x => `<button data-pc="${x}">${x>0?"+":""}${x}%</button>`).join("")}</div>
    <button class="btn btn-primary btn-block btn-lg" data-ok>Create alert</button><a class="more-btn" href="#/alerts">Manage alerts</a>`, el => {
    el.querySelectorAll("[data-pc]").forEach(b => b.onclick = () => el.querySelector("#ap").value = +(p.price * (1 + b.dataset.pc/100)).toFixed(p.dp));
    el.querySelector("[data-ok]").onclick = () => { const v = parseFloat(el.querySelector("#ap").value); if (!(v > 0)) return toast("Please enter a valid price", "bad");
      S().alerts.unshift({id:U.uid(), sym, price:v, t:Date.now(), last:p.price}); store.save(); E.award("alert"); U.closeLayer(); toast(`Alert set at ${M.fmtPx(p, v)}`, "ok"); };
  });
}
function candleDetail(sym, onAct){ return d => {
  const p = M.get(sym), b = d.bar, f = v => v == null ? "--" : M.fmtPx(p, v), ch = d.prev ? (b.close - d.prev.close) : (b.close - b.open), chp = ch / (d.prev ? d.prev.close : b.open) * 100;
  const bull = b.close >= b.open, body = Math.abs(b.close - b.open), rng = b.high - b.low || 1;
  const kind = body / rng < 0.1 ? "Doji (indecision)" : body / rng > 0.7 ? (bull ? "Strong bullish candle" : "Strong bearish candle") : (bull ? "Bullish candle" : "Bearish candle");
  U.sheet("Candle analysis", `<div class="row" style="gap:10px;margin-bottom:10px"><div class="grow"><b>${esc(fsym(p))} · ${d.tf.toUpperCase()}</b><div class="label">${new Date(b.time*1000).toLocaleString()}</div></div><b class="num ${chp>=0?"up":"down"}" style="font-size:18px">${chp>=0?"+":""}${chp.toFixed(2)}%</b></div>
    <div class="label" style="margin-bottom:8px">${kind}${d.rsiFull != null ? ` · RSI ${d.rsiFull.toFixed(1)} ${d.rsiFull > 70 ? "overbought" : d.rsiFull < 30 ? "oversold" : "neutral"}` : ""}</div>
    <div class="cdetail">${[["Open",f(b.open)],["High",f(b.high)],["Low",f(b.low)],["Close",f(b.close)],["Volume",CH.fmtVol(b.volume||0)],["Body / Range",(body/rng*100).toFixed(0)+"%"],["MA/EMA 7",f(d.ind.e7)],["MA/EMA 25",f(d.ind.e25)],["BOLL mid",f(d.ind.bm)],["SuperTrend",d.ind.st == null ? "--" : f(d.ind.st) + (d.ind.stDir === 1 ? " ▲" : " ▼")]].map(([a,v]) => `<div><span>${a}</span><b class="num">${v}</b></div>`).join("")}</div>
    ${onAct ? `<div class="ud" style="margin-top:14px">${onAct.html}</div>` : ""}`, el => onAct && onAct.bind(el));
};}

/* ---------------- Price / chart page (#/chart/SYM) ---------------- */
Pages.chart = (params) => {
  const sym = resolveSym(params, "lastSym_futures");
  if (!M.get(sym)) return M.cryptoOrder.length ? Pages.notfound() : loadingPage("Chart");
  sessionStorage.setItem("lastSym_futures", sym);
  const p = M.get(sym); let root, unChart, offs = [], obTab = "book", timers = [];
  const html = `
  <header class="cp-head"><button class="icon-btn" data-back aria-label="Back">${ic("back",22)}</button>
    <div class="grow"><button class="nm" data-pick>${esc(fsym(p))} <span class="perp">Perp</span>${ic("chevd",16)}</button><div class="cp-sub">${esc(UI.fullName(p))}</div></div>
    <button class="icon-btn" data-star aria-label="Favorite"></button><button class="icon-btn" data-alert aria-label="Price alert">${ic("bell",22)}</button></header>
  <div class="cp-tabs"><button class="on" data-cpt="price">Price</button><button data-cpt="info">Info</button><button data-cpt="data">Data</button><button data-cpt="binary">Binary</button></div>
  <div id="cpPrice">
    <div class="cp-price"><div><div class="label">Last Price ▾</div><div class="lp" id="lp">--</div><div class="row num" style="gap:6px;font-size:14px"><b id="lusd"></b><span id="lc"></span></div><div class="label" style="margin-top:4px">Mark Price <b class="num" id="mk" style="color:var(--text);font-weight:400"></b></div>${p.closed ? `<div class="brand-c" style="font-size:13px;margin-top:4px">Market closed</div>` : ""}</div>
      <div class="k"><span>24h High</span><b id="hi"></b><span>24h Low</span><b id="lo"></b><span>24h Vol(${esc(p.base)})</span><b id="vb"></b><span>24h Vol(USDT)</span><b id="vq"></b></div></div>
    ${chartBlock()}
    <div class="perf" id="perf">${["Today","7 Days","30 Days","90 Days","180 Days","1 Year"].map(k => `<div>${k}<b>--</b></div>`).join("")}</div>
    <div class="obtabs"><button class="on" data-ob="book">Order Book</button><button data-ob="depth">Depth</button><button data-ob="trades">Trades</button></div>
    <div id="obox"></div>
  </div>
  <div id="cpOther" class="hide" style="padding:14px 0"></div>
  <div class="cp-bottom"><div class="in"><button class="ib" data-more>${ic("more",22,1.6)}More</button><a class="ib" href="#/trade/${sym}">${ic("candle",22,1.6)}Binary</a><button class="ib" data-share>${ic("share",22,1.6)}Share</button><a class="btn btn-primary" href="#/futures/${sym}" data-hap>Trade</a></div></div>`;

  function renderPx(){
    const p = M.get(sym), lp = root.querySelector("#lp"); if (!lp) return;
    lp.textContent = M.fmtPx(p); lp.className = "lp " + (p.dir >= 0 ? "up" : "down");
    root.querySelector("#lusd").textContent = "$" + M.fmtPx(p);
    const lc = root.querySelector("#lc"); lc.className = "num " + ((p.chg||0) < 0 ? "down" : "up"); lc.textContent = p.closed || p.chg == null ? "" : pct(p.chg);
    root.querySelector("#mk").textContent = M.fmtPx(p);
    root.querySelector("#hi").textContent = M.fmtPx(p, p.high); root.querySelector("#lo").textContent = M.fmtPx(p, p.low);
    root.querySelector("#vb").textContent = p.qv && p.price ? CH.fmtVol(p.qv / p.price) : "--"; root.querySelector("#vq").textContent = p.qv ? CH.fmtVol(p.qv) : "--";
    const fs = root.querySelector("#fsp"); if (fs){ fs.textContent = M.fmtPx(p); root.querySelector("#fsl").textContent = fsym(p); }
  }
  function renderStar(){ const on = S().favs.includes(sym); root.querySelector("[data-star]").innerHTML = `<span style="color:${on ? "var(--brand)" : "var(--text)"}">${ic("star",22)}</span>`; root.querySelector("[data-star] svg").setAttribute("fill", on ? "currentColor" : "none"); }
  function renderBook(){
    const box = root.querySelector("#obox"); if (!box) return; const p = M.get(sym);
    if (obTab === "trades"){
      box.innerHTML = `<div class="ob2-h" style="grid-template-columns:1fr 1fr 1fr"><span>Time</span><span style="text-align:center">Price(USDT)</span><span style="text-align:right">Amount(${esc(p.base)})</span></div><div class="trades-l">${M.trades.slice(0,30).map(tr => `<div class="num" style="display:grid;grid-template-columns:1fr 1fr 1fr;padding:3px 0;font-size:12.5px"><span class="label">${U.timeStr(tr.t)}</span><span class="${tr.buy?"up":"down"}" style="text-align:center">${M.fmtPx(p,tr.p)}</span><span style="text-align:right">${fmt(tr.q, tr.q < 1 ? 4 : 3)}</span></div>`).join("") || UI.emptyState("history", p.type === "crypto" ? "Waiting for trades…" : "Trades are available for crypto pairs.")}</div>`;
      return;
    }
    let bids = M.book.bids.slice(0, 20), asks = M.book.asks.slice(0, 20);
    if (p.type !== "crypto" && p.price){ const st = Math.pow(10, -p.dp); bids = [...Array(10)].map((_,i) => [p.price - st*(i+1), 0]); asks = [...Array(10)].map((_,i) => [p.price + st*(i+1), 0]); }
    if (!bids.length){ box.innerHTML = `<div class="skel"></div><div class="skel"></div>`; return; }
    const tb = bids.reduce((a,b) => a + +b[1], 0), ta = asks.reduce((a,b) => a + +b[1], 0), bp = tb + ta ? tb / (tb + ta) * 100 : 50;
    const ratio = `<div class="ratio num"><span class="up">${bp.toFixed(2)}%</span><div class="bar"><i style="width:${bp}%;background:var(--up)"></i><i style="flex:1;background:var(--down)"></i></div><span class="down">${(100-bp).toFixed(2)}%</span></div>`;
    if (obTab === "depth"){
      let cb = 0, ca = 0; const cbs = bids.map(b => cb += +b[1]), cas = asks.map(a => ca += +a[1]), mx = Math.max(cb, ca) || 1, W = 340, H = 160;
      const bx = i => W/2 - (i+1) * (W/2) / bids.length, ax = i => W/2 + (i+1) * (W/2) / asks.length, y = v => H - v / mx * (H - 10);
      box.innerHTML = ratio + `<svg viewBox="0 0 ${W} ${H+16}" style="width:100%;height:auto"><path d="M${W/2} ${H} ${cbs.map((v,i) => `L${bx(i)} ${y(v)}`).join(" ")} L0 ${y(cb)} L0 ${H}Z" fill="rgba(18,184,134,.25)" stroke="var(--up)"/><path d="M${W/2} ${H} ${cas.map((v,i) => `L${ax(i)} ${y(v)}`).join(" ")} L${W} ${y(ca)} L${W} ${H}Z" fill="rgba(240,67,90,.25)" stroke="var(--down)"/>
        <text x="4" y="${H+12}" font-size="9" fill="var(--muted)">${M.fmtPx(p, +bids[bids.length-1][0])}</text><text x="${W/2}" y="${H+12}" font-size="9" text-anchor="middle" fill="var(--muted)">${M.fmtPx(p)}</text><text x="${W-4}" y="${H+12}" font-size="9" text-anchor="end" fill="var(--muted)">${M.fmtPx(p, +asks[asks.length-1][0])}</text></svg>`;
      return;
    }
    const mx = Math.max(...bids.map(b => +b[1]), ...asks.map(a => +a[1])) || 1, q = v => v ? fmt(+v * (p.type === "crypto" ? 1 : 0), +v < 10 ? 4 : 2) : "--";
    box.innerHTML = ratio + `<div class="ob2-h"><span>Bid</span><span style="padding-left:4px">Ask</span></div><div class="ob2">${bids.map((b,i) => { const a = asks[i] || [0,0]; return `<div class="r bid"><i style="width:${+b[1]/mx*100}%"></i><span>${q(b[1])}</span><span class="up">${M.fmtPx(p,+b[0])}</span></div><div class="r ask"><i style="width:${+a[1]/mx*100}%"></i><span class="down">${M.fmtPx(p,+a[0])}</span><span>${q(a[1])}</span></div>`; }).join("")}</div>`;
  }
  async function renderPerf(){ const r = await CH.performance(sym); const el = root?.querySelector("#perf"); if (!el) return;
    el.innerHTML = ["Today","7 Days","30 Days","90 Days","180 Days","1 Year"].map(k => `<div>${k}<b class="num ${r[k] == null ? "" : r[k] >= 0 ? "up" : "down"}">${r[k] == null ? "--" : (r[k]>=0?"":"") + r[k].toFixed(2) + "%"}</b></div>`).join(""); }
  function renderOther(k){
    const box = root.querySelector("#cpOther"), p = M.get(sym);
    if (k === "info") box.innerHTML = `<div class="row" style="gap:10px;margin-bottom:14px">${UI.pairIcon(p,40)}<div><div class="title">${esc(UI.fullName(p))}</div><div class="label">${esc(fsym(p))} Perpetual</div></div></div>
      <div class="cdetail" style="grid-template-columns:1fr">${[["Contract","USDⓈ-M Perpetual"],["Settlement asset","USDT"],["Max leverage", E.maxLev(p) + "x"],["Maintenance margin rate",(C.MMR*100).toFixed(2)+"%"],["Taker / Maker fee",(C.FEE*100).toFixed(3)+"% / 0.020%"],["Funding interval","8h"],["Binary options", p.tradable ? "30s · 1m · 5m · +92%" : "Not available"],["Trading hours", p.type === "crypto" ? "24/7" : "Mon–Fri"],["Price source", p.type === "crypto" ? "Binance spot" : "biquote.io"]].map(([a,b]) => `<div><span>${a}</span><b>${esc(b)}</b></div>`).join("")}</div>`;
    if (k === "data"){
      const t = M.trades.slice(0, 40), buy = t.filter(x => x.buy).reduce((a,x) => a + x.q*x.p, 0), sell = t.filter(x => !x.buy).reduce((a,x) => a + x.q*x.p, 0), bp = buy + sell ? buy/(buy+sell)*100 : 50;
      box.innerHTML = `<div class="title" style="margin-bottom:10px">Taker buy / sell (recent trades)</div><div class="ratio num"><span class="up">${bp.toFixed(1)}%</span><div class="bar"><i style="width:${bp}%;background:var(--up)"></i><i style="flex:1;background:var(--down)"></i></div><span class="down">${(100-bp).toFixed(1)}%</span></div>
        <div class="cdetail" style="grid-template-columns:1fr">${[["24h change", p.chg == null ? "--" : pct(p.chg)],["24h range", M.fmtPx(p,p.low) + " – " + M.fmtPx(p,p.high)],["24h volume (USDT)", p.qv ? CH.fmtVol(p.qv) : "--"],["Momentum (60s)", (M.momentum(sym) * 100).toFixed(0) + "%"],["Funding rate","0.0100%"]].map(([a,b]) => `<div><span>${a}</span><b class="num">${b}</b></div>`).join("")}</div>`;
    }
  }
  return {html, title: fsym(p) + " Perp", mount(r){
    root = r; document.body.classList.add("no-nav");
    renderPx(); renderStar(); renderBook(); renderPerf();
    M.watchTrades(sym);
    unChart = bindChart(root, sym, "tf_chart", "15m", candleDetail(sym));
    root.querySelector("[data-pick]").onclick = () => pickSheet(sym, s => location.hash = "#/chart/" + s);
    root.querySelector("[data-star]").onclick = () => { const i = S().favs.indexOf(sym); if (i >= 0) S().favs.splice(i,1); else S().favs.push(sym); store.save(); renderStar(); toast(i >= 0 ? "Removed from Favorites" : "Added to Favorites", "ok", 1200); };
    root.querySelector("[data-alert]").onclick = () => alertSheet(sym);
    root.querySelector("[data-share]").onclick = () => U.copyText(location.href, "Link copied");
    root.querySelector("[data-more]").onclick = () => U.sheet("More", [["ring","Price alerts","#/alerts"],["book","Academy","#/academy"],["users","Copy Trading","#/copy"],["crown","VIP Signals","#/vip"],["chart","Markets","#/markets"]].map(([i,n,h]) => `<a class="list-item" href="${h}"><span class="ic">${ic(i,18)}</span><span class="grow">${n}</span>${ic("chev",16)}</a>`).join(""));
    root.querySelectorAll("[data-ob]").forEach(b => b.onclick = () => { obTab = b.dataset.ob; root.querySelectorAll("[data-ob]").forEach(x => x.classList.toggle("on", x===b)); renderBook(); });
    root.querySelectorAll("[data-cpt]").forEach(b => b.onclick = () => { const k = b.dataset.cpt; if (k === "binary"){ location.hash = "#/trade/" + sym; return; }
      root.querySelectorAll("[data-cpt]").forEach(x => x.classList.toggle("on", x===b)); root.querySelector("#cpPrice").classList.toggle("hide", k !== "price"); root.querySelector("#cpOther").classList.toggle("hide", k === "price"); if (k !== "price") renderOther(k); else setTimeout(CH.resize, 30); });
    let tT = 0, bT = 0;
    offs.push(bus.on("tick", x => { if (x === sym && performance.now() - tT > 200){ tT = performance.now(); renderPx(); } }), bus.on("meta", x => x === sym && renderPx()),
      bus.on("depth", x => { if (x === sym && obTab !== "trades" && performance.now() - bT > 500){ bT = performance.now(); renderBook(); } }), bus.on("trade", x => { if (x === sym && obTab === "trades" && performance.now() - bT > 400){ bT = performance.now(); renderBook(); } }));
    if (p.type !== "crypto"){ const iv = setInterval(renderBook, 2000); timers.push(() => clearInterval(iv)); }
  }, unmount(){ offs.forEach(f => f()); timers.forEach(f => f()); unChart?.(); M.unwatchTrades(); document.body.classList.remove("no-nav"); }};
};

/* ---------------- USDⓈ-M Futures (#/futures/SYM) ---------------- */
Pages.futures = (params) => {
  const sym = resolveSym(params, "lastSym_futures");
  if (!M.get(sym)) return M.cryptoOrder.length ? Pages.notfound() : loadingPage("Futures");
  sessionStorage.setItem("lastSym_futures", sym);
  const s = S(), P = () => M.get(sym);
  let root, offs = [], timers = [], oc = "open", otype = "market", lev = Math.min(s.settings.lev || 20, E.maxLev(P())), mode = s.settings.marginMode || "cross", tpsl = false, ptab = sessionStorage.getItem("fx_ptab") || "pos", hideOther = false, chartOpen = false, unChart = null, sliderPct = 0;
  const $ = q => root.querySelector(q);
  const html = `
  <div class="tabs" style="gap:20px;margin:0 -16px;padding:4px 16px 0;border:0"><button class="tab on" style="font-size:17px">USDⓈ-M</button><a class="tab" href="#/trade/${sym}" style="font-size:17px">Binary</a><a class="tab" href="#/options" style="font-size:17px">Options</a><a class="tab" href="#/copy" style="font-size:17px">Copy</a><a class="tab" href="#/bots" style="font-size:17px">Bots</a></div>
  <header class="fx-head"><div class="grow"><button class="nm" data-pick>${esc(fsym(P()))} <span class="perp">Perp</span>${ic("chevd",16)}</button><div class="num" id="fchg" style="font-size:13px"></div></div>
    <a class="icon-btn" href="#/chart/${sym}" aria-label="Chart">${ic("candle",22,1.6)}</a><button class="icon-btn" data-menu aria-label="More">${ic("dots",22)}</button></header>
  <div class="fx-grid">
    <div>
      <div class="oc"><button class="on" data-oc="open">Open</button><button data-oc="close">Close</button></div>
      <div class="fx-row" style="grid-template-columns:1fr 1fr"><button data-mode></button><button data-lev></button></div>
      <button class="fsel" data-otype><span id="otl">Market</span>${ic("chevd",14)}</button>
      <div class="famt hide" id="lpf"><input id="lp" type="number" inputmode="decimal" placeholder="Price"><span>USDT</span></div>
      <div class="famt" id="af"><input id="amt" type="number" inputmode="decimal" placeholder="Amount"><span>USDT</span></div>
      <div class="dslider"><div class="tr"></div><div class="fl" id="sfl"></div>${[0,25,50,75,100].map(v => `<i class="nd" style="left:${v}%" data-nd="${v}"></i>`).join("")}<div class="th" id="sth"></div><input type="range" min="0" max="100" step="1" value="0" id="sl" aria-label="Amount percent"></div>
      <div class="fkv"><span>Avbl</span><b><span id="avb"></span> USDT <a href="#/deposit" style="color:var(--brand-2)">${ic("plus",13,3)}</a></b></div>
      <div id="openBox">
        <label class="fchk"><input type="checkbox" id="tpc"> TP/SL</label>
        <div id="tpsl" class="hide"><div class="famt"><input id="tp" type="number" inputmode="decimal" placeholder="Take Profit"><span>Mark</span></div><div class="famt"><input id="sl2" type="number" inputmode="decimal" placeholder="Stop Loss"><span>Mark</span></div></div>
        <div class="fkv"><span>Max Open</span><b id="mxl"></b></div><div class="fkv"><span>Cost</span><b id="cl"></b></div>
        <button class="fbtn2 l" data-go="long">Open Long<small>Buy</small></button>
        <div class="fkv" style="margin-top:10px"><span>Max Open</span><b id="mxs"></b></div><div class="fkv"><span>Cost</span><b id="cs"></b></div>
        <button class="fbtn2 s" data-go="short">Open Short<small>Sell</small></button>
        <div class="fkv"><span>Liq. Price (Long / Short)</span><b id="lqp"></b></div>
      </div>
      <div id="closeBox" class="hide">
        <div class="fkv"><span>Long position</span><b id="clq"></b></div><button class="fbtn2 s" data-cls="long" style="margin-top:6px">Close Long<small>Sell</small></button>
        <div class="fkv" style="margin-top:10px"><span>Short position</span><b id="csq"></b></div><button class="fbtn2 l" data-cls="short" style="margin-top:6px">Close Short<small>Buy</small></button>
      </div>
      <div class="err-msg" id="ferr" role="alert"></div>
    </div>
    <div class="fbook" id="fbook"></div>
  </div>
  <div class="ptabs"><button data-pt="pos">Positions (<span id="pc">0</span>)</button><button data-pt="ord">Open Orders (<span id="oc">0</span>)</button><button data-pt="hist">Position History</button><span class="grow"></span><a href="#/history" aria-label="Trade history">${ic("clockh",22,1.6)}</a></div>
  <div class="ptools" id="ptools"><label class="fchk" style="margin:0"><input type="checkbox" id="hide"> Hide Other Symbols</label><button class="btn btn-ghost btn-sm" data-closeall>Close All</button></div>
  <div id="plist"></div>

  <section class="fxc ${sessionStorage.getItem("fx_chart") === "0" ? "" : "open"}" id="cch"><button class="fxc-bar" data-cch><span>${esc(fsym(P()))} Perp Chart</span><span class="fxc-i">${ic("chevd",16)}</span></button><div class="fxc-body">${miniChartBlock(sym)}</div></section>`;

  /* --- order form --- */
  const inputs = () => { const p = P(), amt = parseFloat($("#amt").value) || 0, px = otype === "limit" ? (parseFloat($("#lp").value) || p.price) : p.price; return {p, amt, px}; };
  function renderForm(){
    const {p, amt, px} = inputs(), avail = s.balance;
    $("[data-mode]").textContent = mode === "cross" ? "Cross" : "Isolated"; $("[data-lev]").textContent = lev + "x";
    $("#avb").textContent = money(avail); $("#otl").textContent = otype === "market" ? "Market" : "Limit";
    $("#lpf").classList.toggle("hide", otype !== "limit");
    const maxNotional = avail / (1/lev + C.FEE);
    $("#mxl").textContent = $("#mxs").textContent = money(maxNotional) + " USDT";
    const cost = amt ? amt / lev + amt * C.FEE : 0; $("#cl").textContent = $("#cs").textContent = money(cost) + " USDT";
    if (amt && px){ const q = amt / px, m = amt / lev; const ll = E.liqPrice("long", px, lev, mode, q, m), ls = E.liqPrice("short", px, lev, mode, q, m); $("#lqp").textContent = `${ll > 0 ? M.fmtPx(p, ll) : "--"} / ${ls > 0 ? M.fmtPx(p, ls) : "--"}`; } else $("#lqp").textContent = "-- / --";
    root.querySelectorAll("[data-go]").forEach(b => b.disabled = p.closed);
    const lp = s.fut.positions.find(x => x.sym === sym && x.side === "long"), sp = s.fut.positions.find(x => x.sym === sym && x.side === "short");
    $("#clq").textContent = lp ? money(lp.qty * p.price) + " USDT" : "--"; $("#csq").textContent = sp ? money(sp.qty * p.price) + " USDT" : "--";
    root.querySelector('[data-cls="long"]').disabled = !lp; root.querySelector('[data-cls="short"]').disabled = !sp;
    $("#openBox").classList.toggle("hide", oc !== "open"); $("#closeBox").classList.toggle("hide", oc !== "close");
    $("#amt").placeholder = oc === "open" ? "Amount" : "Close %";
    $("#af span").textContent = oc === "open" ? "USDT" : "%";
    renderSlider();
  }
  function renderSlider(){ const v = sliderPct; $("#sfl").style.width = v + "%"; $("#sth").style.left = v + "%"; root.querySelectorAll("[data-nd]").forEach(n => n.classList.toggle("on", +n.dataset.nd <= v)); }
  async function submit(side){
    const {p, amt} = inputs(), err = $("#ferr");
    const tp = tpsl ? parseFloat($("#tp").value) || null : null, sl = tpsl ? parseFloat($("#sl2").value) || null : null, lp = otype === "limit" ? parseFloat($("#lp").value) : null;
    if (otype === "limit" && !(lp > 0)){ err.textContent = "Please enter the price."; return toast("Please enter the price", "bad"); }
    if (!(amt > 0)){ err.textContent = "Please enter the amount."; $("#af").classList.add("err"); return toast("Please enter the amount", "bad"); }
    const px = lp || p.price, q = amt / px, liq = E.liqPrice(side, px, lev, mode, q, amt / lev);
    const ok = await U.confirmTrade({kind: otype, title: `${fsym(p)} Perp · ${side === "long" ? "Open Long" : "Open Short"}`, tone: side === "long" ? "up" : "down", okText: side === "long" ? "Confirm Long" : "Confirm Short",
      sub: `<span class="perp">${mode === "cross" ? "Cross" : "Isolated"} ${lev}x</span> <span class="perp">${otype === "market" ? "Market" : "Limit"}</span>`,
      rows: [["Price", otype === "market" ? "Market" : M.fmtPx(p, lp)], ["Amount", money(amt) + " USDT"], ["Quantity", fmt(q, q < 1 ? 5 : 3) + " " + esc(p.base || "")], ["Margin", money(amt / lev) + " USDT"], ["Fee (est.)", money(amt * C.FEE) + " USDT"], ["Est. liq. price", liq > 0 ? M.fmtPx(p, liq) : "--"], ...(tp || sl ? [["TP / SL", `${tp ? M.fmtPx(p, tp) : "--"} / ${sl ? M.fmtPx(p, sl) : "--"}`]] : [])]});
    if (!ok) return;
    const r = E.openFut({sym, side, margin: amt / lev, lev, type:otype, price:lp, tp, sl, mode});
    if (r.err){ err.textContent = r.err; $("#af").classList.toggle("err", /amount|balance|value/i.test(r.err)); return toast(r.err, "bad"); }
    err.textContent = ""; $("#af").classList.remove("err"); if (tp || sl) E.award("tpsl");
    s.settings.lev = lev; store.save(); U.fx("open");
    toast(r.order ? "Order placed" : "Order filled", "ok");
    $("#amt").value = ""; sliderPct = 0; $("#sl").value = 0; renderForm();
    setPtab(r.order ? "ord" : "pos");
  }
  async function closeSide(side){
    const pos = s.fut.positions.find(x => x.sym === sym && x.side === side); if (!pos) return;
    const pctv = parseFloat($("#amt").value) || sliderPct || 100, est = E.futPnl(pos).pnl * U.clamp(pctv, 1, 100) / 100;
    if (!await U.confirmTrade({kind:"close", title:`Close ${side === "long" ? "Long" : "Short"} · ${fsym(P())}`, tone: side === "long" ? "down" : "up", okText:"Confirm Close",
      rows:[["Close", Math.round(U.clamp(pctv,1,100)) + "%"], ["Price", "Market"], ["Est. PNL", `<span class="${est >= 0 ? "up" : "down"}">${signed(est)} USDT</span>`]]})) return;
    const pr = E.closeFut(pos.id, "manual", null, U.clamp(pctv, 1, 100) / 100);
    if (pr != null){ U.fx("close"); toast(`Closed ${Math.round(U.clamp(pctv,1,100))}% · ${signed(pr)} USDT`, pr >= 0 ? "ok" : "bad"); }
    $("#amt").value = ""; sliderPct = 0; renderForm();
  }
  function levSheet(posId){
    const pos = posId ? s.fut.positions.find(x => x.id === posId) : null, mx = E.maxLev(P()); let v = pos ? pos.lev : lev;
    const marks = [1, Math.round(mx*.2), Math.round(mx*.4), Math.round(mx*.6), Math.round(mx*.8), mx];
    U.sheet("Adjust Leverage", `<div class="row" style="justify-content:center;gap:16px;margin:8px 0"><button class="icon-btn boxed" data-m>${ic("minus",16)}</button><span class="num" style="font-size:30px;font-weight:600;min-width:90px;text-align:center" id="lv">${v}x</span><button class="icon-btn boxed" data-p>${ic("plus",16)}</button></div>
      <input type="range" class="slider" id="lr" min="1" max="${mx}" value="${v}"><div class="ticks">${marks.map(m => `<span>${m}x</span>`).join("")}</div>
      <ul class="label" style="margin:14px 0 14px 16px;line-height:1.7"><li>Maximum position at current leverage: <b class="num" id="lmx" style="color:var(--text)"></b></li><li>Selecting higher leverage such as [10x] increases your liquidation risk. Always manage your risk levels.</li></ul>
      <div class="err-msg" id="le"></div><button class="btn btn-primary btn-block btn-lg" data-ok>Confirm</button>`, el => {
      const upd = () => { el.querySelector("#lv").textContent = v + "x"; el.querySelector("#lr").value = v; el.querySelector("#lmx").textContent = money(Math.min(5e6, s.balance * v)) + " USDT"; };
      upd();
      el.querySelector("#lr").oninput = e => { v = +e.target.value; upd();  };
      el.querySelector("[data-m]").onclick = () => { v = Math.max(1, v-1); upd(); }; el.querySelector("[data-p]").onclick = () => { v = Math.min(mx, v+1); upd(); };
      el.querySelector("[data-ok]").onclick = () => { if (pos){ const e = E.setPosLev(pos.id, v); if (e){ el.querySelector("#le").textContent = e; return; } } lev = v; s.settings.lev = v; store.save(); U.closeLayer(); renderForm(); toast(`Leverage changed to ${v}x`, "ok", 1400); };
    });
  }
  function modeSheet(){
    U.sheet("Margin Mode", `<div class="oc" style="margin-bottom:14px"><button data-mm="cross" class="${mode==="cross"?"on":""}">Cross</button><button data-mm="isolated" class="${mode==="isolated"?"on":""}">Isolated</button></div>
      <p class="sub" style="font-size:13px;margin-bottom:8px"><b>Cross margin:</b> all available balance backs your positions, so liquidation is further away — but you can lose your whole balance.</p>
      <p class="sub" style="font-size:13px;margin-bottom:16px"><b>Isolated margin:</b> only the margin of that position is at risk.</p><button class="btn btn-primary btn-block btn-lg" data-ok>Confirm</button>`, el => {
      let v = mode; el.querySelectorAll("[data-mm]").forEach(b => b.onclick = () => { v = b.dataset.mm; el.querySelectorAll("[data-mm]").forEach(x => x.classList.toggle("on", x===b)); });
      el.querySelector("[data-ok]").onclick = () => { mode = v; s.settings.marginMode = v; store.save(); U.closeLayer(); renderForm(); };
    });
  }
  /* --- order book --- */
  let fundEnd = 0;
  function renderBook(){
    const p = P(), box = $("#fbook"); if (!box) return;
    const now = new Date(), h = now.getUTCHours(), next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), (Math.floor(h/8)+1)*8));
    fundEnd = next.getTime(); const left = Math.max(0, (fundEnd - Date.now())/1000);
    let bids = M.book.bids.slice(0, 6), asks = M.book.asks.slice(0, 6).reverse();
    if (p.type !== "crypto" && p.price){ const st = Math.pow(10, -p.dp); bids = [...Array(6)].map((_,i) => [p.price - st*(i+1), 0]); asks = [...Array(6)].map((_,i) => [p.price + st*(6-i), 0]).reverse().reverse(); }
    const val = r => +r[0] * +r[1], mx = Math.max(1, ...bids.map(val), ...asks.map(val)), v = x => x ? CH.fmtVol(x) : "--";
    // mark rows where your own open limit orders sit (bucketed to the nearest visible level)
    const myO = s.fut.orders.filter(o => o.sym === sym).map(o => o.price), all = [...asks, ...bids].map(r => +r[0]);
    const lo = Math.min(...all), hi = Math.max(...all), half = all.length > 1 ? Math.abs(all[0] - all[1]) / 2 : 0;
    const outside = myO.filter(x => !(x >= lo - half && x <= hi + half)).length;
    const marked = new Set(myO.filter(x => x >= lo - half && x <= hi + half).map(x => all.reduce((b, y) => Math.abs(y - x) < Math.abs(b - x) ? y : b, all[0])));
    const mine = r => marked.has(+r[0]);
    const tb = bids.reduce((a,b) => a + val(b), 0), ta = asks.reduce((a,b) => a + val(b), 0), bp = tb + ta ? tb/(tb+ta)*100 : 50;
    box.innerHTML = `<div class="fund">Funding (8h) / Countdown<br><b class="num">0.0100%/${String(Math.floor(left/3600)).padStart(2,"0")}:${String(Math.floor(left%3600/60)).padStart(2,"0")}:${String(Math.floor(left%60)).padStart(2,"0")}</b></div>
      <div class="fh"><span>Price<br>(USDT)</span><span>Amount<br>(USDT)</span></div>
      ${asks.length ? asks.map((a, i) => `<div class="r${mine(a, asks, i, true) ? " me" : ""}" data-bp="${+a[0]}"><i style="width:${val(a)/mx*100}%;background:var(--down)"></i><span class="down">${M.fmtPx(p,+a[0])}</span><span>${v(val(a))}</span></div>`).join("") : '<div class="skel" style="height:110px"></div>'}
      <div class="mid"><b class="num ${p.dir>=0?"up":"down"}">${M.fmtPx(p)}</b><small class="num">${M.fmtPx(p)}</small></div>
      ${bids.map((b, i) => `<div class="r${mine(b, bids, i, false) ? " me" : ""}" data-bp="${+b[0]}"><i style="width:${val(b)/mx*100}%;background:var(--up)"></i><span class="up">${M.fmtPx(p,+b[0])}</span><span>${v(val(b))}</span></div>`).join("")}${outside ? `<div class="ob-out">${ic("info",11)} ${outside} of your orders outside the visible book</div>` : ""}<div class="ob-src">Live order book · Binance</div>
      <div class="ratio num" style="margin:8px 0 0;font-size:11.5px"><span class="up">${bp.toFixed(2)}%</span><div class="bar" style="height:4px"><i style="width:${bp}%;background:var(--up)"></i><i style="flex:1;background:var(--down)"></i></div><span class="down">${(100-bp).toFixed(2)}%</span></div>`;
    const ch = $("#fchg"); ch.textContent = p.closed ? "Market closed" : p.chg == null ? "" : pct(p.chg); ch.className = "num " + (p.closed ? "brand-c" : (p.chg||0) < 0 ? "down" : "up");
  }
  /* --- positions --- */
  function setPtab(k){ ptab = k; sessionStorage.setItem("fx_ptab", k); root.querySelectorAll("[data-pt]").forEach(b => b.classList.toggle("on", b.dataset.pt === k)); $("#ptools").classList.toggle("hide", k === "hist"); renderPositions(); }
  function posCard(pos){
    const p = M.get(pos.sym);
    return `<div class="pc" data-id="${pos.id}"><div class="pc-h"><span class="side-b ${pos.side==="long"?"l":"s"}">${pos.side==="long"?"L":"S"}</span><button class="sym" data-open="${pos.sym}">${esc(fsym(p))}</button><span class="perp">Perp</span><span class="perp">${pos.mode === "isolated" ? "Isolated" : "Cross"} ${pos.lev}x</span><span class="bars-i" data-mrb>||||</span></div>
      <div class="pc-big"><div><span>PNL (USDT) <button data-share="${pos.id}" aria-label="Share">${ic("share",15)}</button></span><b class="num" data-pnl></b></div><div style="text-align:right"><span style="justify-content:flex-end">ROI</span><b class="num" data-roe></b></div></div>
      <div class="pc-g"><div><span>Size (USDT)</span><b class="num" data-size></b></div><div><span>Margin (USDT)</span><b class="num">${money(pos.margin)}</b></div><div><span>Margin Ratio</span><b class="num" data-mr></b></div>
        <div><span>Entry Price (USDT)</span><b class="num">${M.fmtPx(p, pos.entry)}</b></div><div><span>Mark Price (USDT)</span><b class="num" data-mark></b></div><div><span>Liq. Price (USDT)</span><b class="num" style="color:#F7931A">${pos.liq > 0 ? M.fmtPx(p, pos.liq) : "--"}</b></div></div>
      ${pos.tp || pos.sl ? `<div class="fkv" style="margin-top:10px"><span>TP/SL</span><b class="num">${pos.tp ? M.fmtPx(p,pos.tp) : "--"} / ${pos.sl ? M.fmtPx(p,pos.sl) : "--"}</b></div>` : ""}
      <button class="rpnl" data-rz="${pos.id}"><span>Realized PNL (USDT)</span><b class="num ${(pos.realized||0)>=0?"up":"down"}">${signed(pos.realized || 0)} ${ic("chev",13)}</b></button>
      <div class="pc-btns"><button data-plev="${pos.id}">Leverage</button><button data-tpsl="${pos.id}">TP/SL</button><button data-close="${pos.id}">Close</button></div></div>`;
  }
  function renderPositions(){
    const list = $("#plist"); if (!list) return;
    const pos = s.fut.positions.filter(x => !hideOther || x.sym === sym), ord = s.fut.orders.filter(x => !hideOther || x.sym === sym);
    $("#pc").textContent = s.fut.positions.length; $("#oc").textContent = s.fut.orders.length;
    if (ptab === "pos"){ list.innerHTML = pos.length ? pos.slice().reverse().map(posCard).join("") : UI.emptyState("file", "No open positions"); tickPositions(); }
    else if (ptab === "ord") list.innerHTML = ord.length ? ord.map(o => { const p = M.get(o.sym); return `<div class="pc"><div class="pc-h"><span class="side-b ${o.side==="long"?"l":"s"}">${o.side==="long"?"B":"S"}</span><b class="sym">${esc(fsym(p))}</b><span class="perp">Perp</span><span class="perp">Limit</span><span class="grow"></span><button class="btn btn-ghost btn-sm" data-cancel="${o.id}">Cancel</button></div>
      <div class="ph-g"><div><span>Price</span><b class="num">${M.fmtPx(p,o.price)}</b></div><div><span>Amount (USDT)</span><b class="num">${money(o.margin*o.lev)}</b></div><div><span>Leverage</span><b>${o.lev}x</b></div><div><span>TP / SL</span><b class="num">${o.tp?M.fmtPx(p,o.tp):"--"} / ${o.sl?M.fmtPx(p,o.sl):"--"}</b></div><div><span>Side</span><b class="${o.side==="long"?"up":"down"}">${o.side==="long"?"Open Long":"Open Short"}</b></div><div><span>Time</span><b>${U.timeStr(o.t)}</b></div></div></div>`; }).join("") : UI.emptyState("file", "No open orders");
    else list.innerHTML = historyHtml(s.fut.history.slice(0, 60));
  }
  function tickPositions(){
    if (ptab !== "pos" || !root) return;
    s.fut.positions.forEach(pos => {
      const r = root.querySelector(`.pc[data-id="${pos.id}"]`); if (!r) return;
      const {pnl, roe, px, size, mr} = E.futPnl(pos), p = M.get(pos.sym), c = pnl >= 0 ? "up" : "down";
      const a = r.querySelector("[data-pnl]"), b = r.querySelector("[data-roe]"); a.textContent = signed(pnl); b.textContent = signed(roe) + "%"; a.className = b.className = "num " + c;
      r.querySelector("[data-size]").textContent = money(size); r.querySelector("[data-mark]").textContent = M.fmtPx(p, px);
      const m = r.querySelector("[data-mr]"); m.textContent = mr.toFixed(2) + "%"; m.className = "num " + (mr < 50 ? "up" : mr < 80 ? "brand-c" : "down");
      r.querySelector("[data-mrb]").style.color = mr < 50 ? "var(--up)" : mr < 80 ? "var(--brand-2)" : "var(--down)";
    });
  }
  function tpslSheet(id){
    const pos = s.fut.positions.find(x => x.id === id); if (!pos) return; const p = M.get(pos.sym);
    U.sheet("TP/SL for entire position", `<div class="kv"><span>Symbol</span><b>${esc(fsym(p))} Perp · ${pos.side === "long" ? "Long" : "Short"} ${pos.lev}x</b></div><div class="kv"><span>Entry Price</span><b class="num">${M.fmtPx(p,pos.entry)}</b></div><div class="kv"><span>Mark Price</span><b class="num">${M.fmtPx(p)}</b></div><div class="kv" style="margin-bottom:14px"><span>Liq. Price</span><b class="num" style="color:#F7931A">${pos.liq > 0 ? M.fmtPx(p,pos.liq) : "--"}</b></div>
      <div class="form-row"><label>Take Profit · Mark price</label><div class="famt"><input id="t1" type="number" inputmode="decimal" value="${pos.tp||""}" placeholder="TP price"><span>USDT</span></div><div class="label" id="t1e"></div></div>
      <div class="form-row"><label>Stop Loss · Mark price</label><div class="famt"><input id="t2" type="number" inputmode="decimal" value="${pos.sl||""}" placeholder="SL price"><span>USDT</span></div><div class="label" id="t2e"></div></div>
      <div class="err-msg" id="te"></div><button class="btn btn-primary btn-block btn-lg" data-ok>Confirm</button>`, el => {
      const est = (v, k) => { const x = parseFloat(v); el.querySelector("#" + k + "e").innerHTML = x ? `When Mark Price reaches ${M.fmtPx(p, x)}, it will trigger a Market order. Est. PNL: <b class="${E.futPnl(pos, x).pnl>=0?"up":"down"}">${signed(E.futPnl(pos, x).pnl)} USDT</b>` : ""; };
      el.querySelector("#t1").oninput = e => est(e.target.value, "t1"); el.querySelector("#t2").oninput = e => est(e.target.value, "t2"); est(pos.tp, "t1"); est(pos.sl, "t2");
      el.querySelector("[data-ok]").onclick = () => { const e = E.setTpSl(id, parseFloat(el.querySelector("#t1").value) || null, parseFloat(el.querySelector("#t2").value) || null); if (e){ el.querySelector("#te").textContent = e; return; } E.award("tpsl"); U.closeLayer(); toast("TP/SL placed", "ok"); };
    });
  }
  function closeSheet(id){
    const pos = s.fut.positions.find(x => x.id === id); if (!pos) return; const p = M.get(pos.sym); let f = 100;
    U.sheet("Market Close", `<div class="kv"><span>Position</span><b>${esc(fsym(p))} ${pos.side === "long" ? "Long" : "Short"} ${pos.lev}x</b></div><div class="kv"><span>Mark Price</span><b class="num">${M.fmtPx(p)}</b></div><div class="kv" style="margin-bottom:14px"><span>Size</span><b class="num">${money(pos.qty * p.price)} USDT</b></div>
      <div class="chips" style="margin-bottom:10px">${[25,50,75,100].map(v => `<button data-f="${v}" class="${v===100?"on":""}">${v}%</button>`).join("")}</div>
      <div class="kv" style="margin-bottom:16px"><span>Est. PNL</span><b class="num" id="ep"></b></div><button class="btn btn-primary btn-block btn-lg" data-ok>Confirm</button>`, el => {
      const upd = () => { const v = E.futPnl(pos).pnl * f / 100; const e = el.querySelector("#ep"); e.textContent = signed(v) + " USDT"; e.className = "num " + (v >= 0 ? "up" : "down"); }; upd();
      el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { f = +b.dataset.f; el.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x===b)); upd(); });
      el.querySelector("[data-ok]").onclick = () => { U.closeLayer(); const pr = E.closeFut(id, "manual", null, f/100); if (pr != null){ U.fx("close"); toast(`Position closed: ${signed(pr)} USDT`, pr >= 0 ? "ok" : "bad"); } };
    });
  }
  function shareCard(id){
    const pos = s.fut.positions.find(x => x.id === id); if (!pos) return; const p = M.get(pos.sym), {pnl, roe} = E.futPnl(pos);
    U.modal(`<div class="row" style="justify-content:center;margin-bottom:12px">${UI.logo(22)}<b>${esc(C.APP_NAME)}</b></div>
      <div class="row" style="justify-content:center;gap:6px"><span class="side-b ${pos.side==="long"?"l":"s"}">${pos.side==="long"?"L":"S"}</span><b>${esc(fsym(p))} Perp</b><span class="perp">${pos.lev}x</span></div>
      <div class="num ${roe>=0?"up":"down"}" style="font-size:42px;font-weight:700;margin:10px 0">${signed(roe)}%</div><div class="num ${pnl>=0?"up":"down"}" style="margin-bottom:12px">${signed(pnl)} USDT</div>
      <div class="kv"><span>Entry Price</span><b class="num">${M.fmtPx(p,pos.entry)}</b></div><div class="kv" style="margin-bottom:16px"><span>Mark Price</span><b class="num">${M.fmtPx(p)}</b></div>
      <div class="row"><button class="btn btn-ghost grow" data-x>Close</button><button class="btn btn-primary grow" data-c>Copy</button></div>`, el => {
      el.querySelector("[data-x]").onclick = U.closeLayer;
      el.querySelector("[data-c]").onclick = () => U.copyText(`${fsym(p)} Perp ${pos.side === "long" ? "Long" : "Short"} ${pos.lev}x · ROI ${signed(roe)}%`, "Copied");
    });
  }
  function toggleChart(){
    chartOpen = !chartOpen; $("#cch").classList.toggle("open", chartOpen); sessionStorage.setItem("fx_chart", chartOpen ? "1" : "0");
    if (chartOpen && !unChart) unChart = bindChart(root, sym, "tf_fut", "15m", candleDetail(sym), {mini:true, tfs:MINI_TFS});
    else setTimeout(CH.resize, 60);
  }
  /* Realized PnL breakdown: where the money went and how much % of margin */
  function rzSheet(id){
    const pos = s.fut.positions.find(x => x.id === id) || s.fut.history.find(x => x.id === id); if (!pos) return;
    const p = M.get(pos.sym) || {dp:2, base:pos.sym}, rz = pos.rz || {openFee: pos.fee || 0, closeFee:0, closePnl:0, funding:0};
    const total = (pos.realized ?? pos.profit ?? 0), m = pos.margin || 1, pc = v => `<small class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "+" : ""}${(v / m * 100).toFixed(2)}%</small>`;
    const row = (k, d, v) => `<div class="rz-r"><div><b>${k}</b><small>${d}</small></div><div class="num ${v > 0 ? "up" : v < 0 ? "down" : ""}">${signed(v)}${pc(v)}</div></div>`;
    U.sheet("Realized PNL", `<div class="rz-top"><span>Realized PNL (USDT)</span><b class="num ${total >= 0 ? "up" : "down"}">${signed(total)}</b><small class="num">${(total / m * 100).toFixed(2)}% of margin ${money(m)} USDT</small></div>
      ${row("Closing PNL", "Profit / loss from the part of the position you closed", rz.closePnl)}
      ${row("Opening fee", `Taker ${(C.FEE * 100).toFixed(3)}% of opening notional`, -rz.openFee)}
      ${row("Closing fee", `Taker ${(C.FEE * 100).toFixed(3)}% of closing notional`, -rz.closeFee)}
      ${row("Funding fee", "Paid / received every 8h (00:00, 08:00, 16:00 UTC)", rz.funding)}
      <p class="rz-note">${ic("info",13)} Realized PNL = Closing PNL − Trading fees ± Funding fees. Fees are charged on notional value (margin × leverage), so they look large compared with margin at high leverage.</p>`);
  }

  return {html, title: fsym(P()) + " Futures", mount(r){
    root = r; M.watchTrades(sym);
    renderForm(); renderBook(); setPtab(ptab);
    if ($("#cch").classList.contains("open")){ chartOpen = false; toggleChart(); }
    $("[data-pick]").onclick = () => pickSheet(sym, x => location.hash = "#/futures/" + x);
    $("[data-menu]").onclick = () => U.sheet("", [["ring","Price alert", () => alertSheet(sym)],["candle","Chart", () => location.hash = "#/chart/" + sym],["history","Position history", () => location.hash = "#/history"],["percent","Futures calculator", calcSheet]].map(([i,n],k) => `<button class="list-item" style="width:100%" data-k="${k}"><span class="ic">${ic(i,18)}</span><span class="grow">${n}</span>${ic("chev",16)}</button>`).join(""), el => {
      const acts = [() => alertSheet(sym), () => location.hash = "#/chart/" + sym, () => location.hash = "#/history", calcSheet];
      el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { U.closeLayer(); setTimeout(acts[+b.dataset.k], 300); }); });
    root.querySelectorAll("[data-oc]").forEach(b => b.onclick = () => { oc = b.dataset.oc; root.querySelectorAll("[data-oc]").forEach(x => x.classList.toggle("on", x===b)); $("#amt").value = ""; sliderPct = 0; $("#sl").value = 0; renderForm(); });
    $("[data-mode]").onclick = modeSheet; $("[data-lev]").onclick = () => levSheet();
    $("[data-otype]").onclick = () => U.sheet("Order type", [["market","Market","Executes immediately at the best available price."],["limit","Limit","Executes at your price or better."]].map(([k,n,d]) => `<button class="list-item" style="width:100%" data-ot="${k}"><div class="grow"><b>${n}</b><div class="label">${d}</div></div>${otype===k?`<span class="brand-c">${ic("check",18)}</span>`:""}</button>`).join(""), el => el.querySelectorAll("[data-ot]").forEach(b => b.onclick = () => { otype = b.dataset.ot; if (otype === "limit" && !$("#lp").value) $("#lp").value = +P().price.toFixed(P().dp); U.closeLayer(); renderForm(); }));
    const sl = $("#sl");
    sl.oninput = () => { const v = +sl.value, snap = [0,25,50,75,100].find(x => Math.abs(x - v) <= 2); sliderPct = snap ?? v; if (snap != null && snap !== v) sl.value = snap;
      
      $("#amt").value = sliderPct ? (oc === "open" ? Math.floor(s.balance / (1/lev + C.FEE) * sliderPct) / 100 : sliderPct) : ""; renderForm(); };
    $("#amt").addEventListener("input", () => { $("#ferr").textContent = ""; $("#af").classList.remove("err"); const v = parseFloat($("#amt").value) || 0; sliderPct = oc === "open" ? U.clamp(v / (s.balance / (1/lev + C.FEE)) * 100, 0, 100) : U.clamp(v, 0, 100); renderForm(); });
    $("#lp").addEventListener("input", renderForm);
    $("#tpc").onchange = e => { tpsl = e.target.checked; $("#tpsl").classList.toggle("hide", !tpsl); };
    root.querySelectorAll("[data-go]").forEach(b => b.onclick = () => submit(b.dataset.go));
    root.querySelectorAll("[data-cls]").forEach(b => b.onclick = () => closeSide(b.dataset.cls));
    root.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => setPtab(b.dataset.pt));
    $("#hide").onchange = e => { hideOther = e.target.checked; renderPositions(); };
    $("[data-closeall]").onclick = async () => { if (!s.fut.positions.length) return toast("No open positions", "info"); if (await U.confirmTrade({kind:"close", title:"Close All Positions", tone:"down", okText:"Close All", rows:[["Positions", String(s.fut.positions.filter(x => !hideOther || x.sym === sym).length)], ["Price", "Market"], ["Total est. PNL", (() => { const v = s.fut.positions.filter(x => !hideOther || x.sym === sym).reduce((a, x) => a + E.futPnl(x).pnl, 0); return `<span class="${v >= 0 ? "up" : "down"}">${signed(v)} USDT</span>`; })()]]})){ [...s.fut.positions].filter(x => !hideOther || x.sym === sym).forEach(x => E.closeFut(x.id)); U.fx("open"); toast("All positions closed", "ok"); } };
    $("[data-cch]").onclick = toggleChart;
    $("#fbook").addEventListener("click", e => { const r = e.target.closest("[data-bp]"); if (!r) return; otype = "limit"; $("#lp").value = r.dataset.bp; renderForm(); toast("Limit price set to " + M.fmtPx(P(), +r.dataset.bp), "info", 1200); });
    $("#plist").addEventListener("click", e => {
      const g = (k) => e.target.closest(`[data-${k}]`)?.dataset[k];
      if (g("open")) return location.hash = "#/futures/" + g("open");
      if (g("rz")) return rzSheet(g("rz"));
      if (g("close")) return closeSheet(g("close")); if (g("tpsl")) return tpslSheet(g("tpsl")); if (g("plev")) return levSheet(g("plev")); if (g("share")) return shareCard(g("share"));
      if (g("cancel")){ E.cancelOrder(g("cancel")); toast("Order cancelled", "ok"); }
    });
    let tT = 0, bT = 0;
    offs.push(bus.on("tick", x => { if (x === sym && performance.now() - tT > 250){ tT = performance.now(); renderForm(); } }), bus.on("depth", x => { if (x === sym && performance.now() - bT > 400){ bT = performance.now(); renderBook(); } }),
      bus.on("sec", tickPositions), bus.on("balance", renderForm), bus.on("positions", () => { renderPositions(); renderForm(); }), bus.on("history", () => ptab === "hist" && renderPositions()),
      bus.on("futClosed", ({profit, reason}) => { if (reason !== "manual"){ U.fx(profit >= 0 ? "win" : "loss"); toast(`${reason === "liquidated" ? "Liquidated" : reason === "tp" ? "Take profit triggered" : "Stop loss triggered"}: ${signed(profit)} USDT`, profit >= 0 ? "ok" : "bad", 3500); } }));
    const iv = setInterval(renderBook, 1000); timers.push(() => clearInterval(iv));
  }, unmount(){ offs.forEach(f => f()); timers.forEach(f => f()); unChart?.(); M.unwatchTrades(); }};
};
function calcSheet(){
  let side = "long";
  U.sheet("Futures calculator", `<div class="oc" style="margin-bottom:12px"><button class="on" data-cs="long">Long</button><button data-cs="short">Short</button></div>
    ${[["Leverage","clev","20"],["Entry price","cen",""],["Exit price","cex",""],["Margin (USDT)","cmg","100"]].map(([l,id,v]) => `<div class="form-row"><label>${l}</label><div class="famt"><input id="${id}" type="number" inputmode="decimal" value="${v}"></div></div>`).join("")}
    <div class="kv"><span>PNL</span><b class="num" id="cp">--</b></div><div class="kv"><span>ROI</span><b class="num" id="cr">--</b></div><div class="kv"><span>Liq. price (isolated)</span><b class="num" id="cl2">--</b></div>`, el => {
    const g = id => parseFloat(el.querySelector("#" + id).value);
    const upd = () => { const L = g("clev"), en = g("cen"), ex = g("cex"), m = g("cmg"); if (!(L && en && m)) return; const q = m*L/en;
      if (ex){ const pnl = (ex - en) * q * (side === "long" ? 1 : -1); el.querySelector("#cp").textContent = signed(pnl) + " USDT"; el.querySelector("#cr").textContent = signed(pnl/m*100) + "%"; }
      el.querySelector("#cl2").textContent = fmt(E.liqPrice(side, en, L, "isolated"), 4); };
    el.querySelectorAll("input").forEach(i => i.oninput = upd);
    el.querySelectorAll("[data-cs]").forEach(b => b.onclick = () => { side = b.dataset.cs; el.querySelectorAll("[data-cs]").forEach(x => x.classList.toggle("on", x===b)); upd(); });
  });
}
function historyHtml(list){
  if (!list.length) return UI.emptyState("history", "No position history");
  const dur = ms => { const m = Math.floor(ms/60000); return m >= 1440 ? `${Math.floor(m/1440)}d ${Math.floor(m%1440/60)}h` : m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`; };
  const ds = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${d.toTimeString().slice(0,8)}`; };
  return list.map(x => { const p = M.get(x.sym) || {dp:2, type:"crypto", base:x.sym.replace("USDT",""), sym:x.sym}; const roi = x.roi ?? (x.profit / (x.margin || 1) * 100), base = p.type === "crypto" ? p.base : "";
    return `<div class="pc"><div class="pc-h"><span class="side-b ${x.side==="long"?"l":"s"}">${x.side==="long"?"B":"S"}</span><span class="sym">${esc(fsym(p))}</span><span class="perp">Perp</span><span class="perp">${x.mode === "isolated" ? "Isolated" : "Cross"} ${x.lev}x</span><span class="grow"></span><span class="label" style="font-size:13px">${x.reason === "liquidated" ? "Liquidated" : "Closed"}</span></div>
      <div class="ph-g"><div data-rz="${x.id}" class="rz-link"><span>Realized PNL (USDT) ${ic("chev",11)}</span><b class="num ${x.profit>=0?"up":"down"}">${signed(x.profit)}</b></div><div><span>ROI</span><b class="num ${roi>=0?"up":"down"}">${roi.toFixed(2)}%</b></div><div><span>Closed Vol.${base ? ` (${esc(base)})` : ""}</span><b class="num">${fmt(x.closedVol ?? x.qty ?? 0, 3)}</b></div>
        <div><span>Avg. Entry Price</span><b class="num">${M.fmtPx(p, x.entry)}</b></div><div><span>Avg. Close Price</span><b class="num">${M.fmtPx(p, x.exit)}</b></div><div><span>Max OI${base ? ` (${esc(base)})` : ""}</span><b class="num">${fmt(x.maxQty ?? x.qty ?? 0, 3)}</b></div></div>
      <div class="ph-t"><span>Opened</span><b class="num">${ds(x.open)}</b></div><div class="ph-t" style="margin-top:4px"><span>Closed (Lasting ${dur(x.closed - x.open)})</span><b class="num">${ds(x.closed)}</b></div></div>`; }).join("");
}
window.UI.historyHtml = historyHtml;

/* ---------------- Binary Options (#/trade/SYM) ---------------- */
Pages.trade = (params) => {
  let sym = resolveSym(params, "lastSym_binary");
  if (!M.get(sym)) return M.cryptoOrder.length ? Pages.notfound() : loadingPage("Binary");
  sessionStorage.setItem("lastSym_binary", sym);
  const s = S(), P = () => M.get(sym);
  let root, offs = [], timers = [], unChart, exp = s.settings.defExp || 30, ptab = "pos", cdLast = {};
  const $ = q => root.querySelector(q);
  const html = `<div class="bin-page">
  <div class="tabs" style="gap:20px;margin:0 -16px;padding:4px 16px 0;border:0"><a class="tab" href="#/futures/${sym}" style="font-size:17px">USDⓈ-M</a><button class="tab on" style="font-size:17px">Binary</button><a class="tab" href="#/options" style="font-size:17px">Options</a><a class="tab" href="#/copy" style="font-size:17px">Copy</a><a class="tab" href="#/bots" style="font-size:17px">Bots</a></div>
  <header class="fx-head"><div class="grow"><button class="nm" data-pick>${esc(M.label(P()))} ${P().tradable ? `<span class="perp" style="color:var(--brand-2)">+92%</span>` : `<span class="perp">Chart only</span>`}${ic("chevd",16)}</button></div>
    <button class="icon-btn" data-alert aria-label="Price alert">${ic("bell",22)}</button><a class="icon-btn" href="#/chart/${sym}" aria-label="Full chart">${ic("candle",22,1.6)}</a></header>
  <div class="cp-price" style="border:0;padding-top:6px"><div><div class="lp" id="lp">--</div><div class="row num" style="gap:6px;font-size:13px"><b id="lusd"></b><span id="lc"></span></div></div>
    <div class="k"><span>24h High</span><b id="hi"></b><span>24h Low</span><b id="lo"></b><span>Sentiment</span><b id="sen"></b></div></div>
  ${chartBlock()}
  <section class="bx">
    <div class="bx-ctl">
      <div class="bx-amt" id="af"><button class="bx-step" data-minus aria-label="Decrease amount">${ic("minus",16,2.4)}</button>
        <label class="bx-in"><small>Amount (USDT)</small><input id="amt" type="number" inputmode="decimal" min="1" step="1" aria-label="Amount in USDT"></label>
        <button class="bx-step" data-plus aria-label="Increase amount">${ic("plus",16,2.4)}</button></div>
      <div class="bx-time" id="exps">${C.EXPIRIES.map(x => `<button class="exp-chip" data-e="${x}"><b>${x<60?x+"s":x/60+"m"}</b></button>`).join("")}</div>
    </div>
    <div class="ud"><button class="btn btn-up" data-dir="up"><span class="row" style="gap:4px">${ic("up",18,3)} ${esc(t("Up"))}</span><small id="upP"></small></button><button class="btn btn-down" data-dir="down"><span class="row" style="gap:4px">${ic("down",18,3)} ${esc(t("Down"))}</span><small id="dnP"></small></button></div>
    <div class="bx-meta"><span>${esc(t("Payout (if win)"))} <b class="up num" id="po"></b></span><span>Avbl <b class="num" id="ob"></b> USDT <a href="#/deposit" class="brand-c" aria-label="Deposit">${ic("plus",12,3)}</a></span></div>
    <div class="chips bx-q" id="qa">${[10,25,50,100,500].map(v => `<button data-v="${v}">${v}</button>`).join("")}<button data-v="max">Max</button><button data-half>½</button><button data-dbl>2×</button></div>
    <div id="note" style="margin-top:8px"></div><div class="err-msg" id="err" role="alert"></div>
  </section>
  <div class="ptabs" style="margin-top:0"><button class="on" data-pt="pos">Positions (<span id="pc">0</span>)</button><button data-pt="hist">History</button></div>
  <div id="plist"></div></div>`;

  function renderPx(){
    const p = P(), el = $("#lp"); if (!el) return;
    el.textContent = M.fmtPx(p); el.className = "lp " + (p.dir >= 0 ? "up" : "down"); $("#lusd").textContent = "$" + M.fmtPx(p);
    const lc = $("#lc"); lc.className = "num " + ((p.chg||0) < 0 ? "down" : "up"); lc.textContent = p.closed ? t("Market closed") : p.chg == null ? "" : pct(p.chg);
    $("#hi").textContent = M.fmtPx(p, p.high); $("#lo").textContent = M.fmtPx(p, p.low);
    const m = M.momentum(sym, 60000), up = Math.round(U.clamp(50 + m*30 + U.clamp(p.chg||0,-5,5)*2, 6, 94)); $("#sen").innerHTML = `<span class="up">${up}%</span> / <span class="down">${100-up}%</span>`;
    const fs = $("#fsp"); if (fs){ fs.textContent = M.fmtPx(p); $("#fsl").textContent = M.label(p); }
  }
  function renderOrder(){
    const p = P(), a = parseFloat($("#amt").value) || 0;
    $("#ob").textContent = money(s.balance); $("#po").textContent = "+" + money(a * E.RATIO) + " USDT";
    root.querySelectorAll("[data-e]").forEach(b => b.classList.toggle("on", +b.dataset.e === exp));
    $("#upP").textContent = $("#dnP").textContent = "+" + Math.round(C.PAYOUT*100) + "% · " + (exp < 60 ? exp + "s" : exp/60 + "m");
    let note = "";
    if (!p.tradable) note = `<div class="notice">${ic("lock",14)}<span>Binary is not available for ${esc(M.label(p))}. <a href="#/futures/${sym}" style="text-decoration:underline">Trade on USDⓈ-M</a></span></div>`;
    else if (p.closed) note = `<div class="notice">${ic("clock",14)}<span>Market closed. Forex & metals reopen Monday.</span></div>`;
    else if (M.isStale(p)) note = `<div class="notice">${ic("info",14)}<span>Connecting to live prices…</span></div>`;
    $("#note").innerHTML = note; root.querySelectorAll("[data-dir]").forEach(b => b.disabled = !p.tradable || p.closed);
  }
  async function trade(dir, skipConfirm){
    const a = parseFloat($("#amt").value), err = $("#err"), msg = E.validate(sym, a);
    if (msg){ err.textContent = msg; $("#af").classList.add("err"); toast(msg, "bad"); return; }
    if (!skipConfirm && !await U.confirmTrade({kind:"binary", title:`${M.label(P())} · ${dir === "up" ? "Up" : "Down"}`, tone: dir === "up" ? "up" : "down", okText: dir === "up" ? "Confirm Up" : "Confirm Down",
      rows:[["Amount", money(a) + " USDT"], ["Expiry", exp < 60 ? exp + "s" : exp/60 + " min"], ["Entry price", "Market (" + M.fmtPx(P()) + ")"], ["Payout if win", `<span class="up">+${money(a * E.RATIO)} USDT</span>`], ["If lose", `<span class="down">-${money(a)} USDT</span>`]]})) return;
    const r = E.place(sym, dir, a, exp); if (r.err){ err.textContent = r.err; return toast(r.err, "bad"); }
    err.textContent = ""; $("#af").classList.remove("err"); s.settings.defAmt = a; s.settings.defExp = exp; store.save();
    toast("Order placed successfully!", "ok"); U.fx("open"); setPtab("pos");
  }
  function setPtab(k){ ptab = k; root.querySelectorAll("[data-pt]").forEach(b => b.classList.toggle("on", b.dataset.pt === k)); renderPositions(); }
  function renderPositions(){
    const list = $("#plist"); $("#pc").textContent = s.positions.length;
    if (ptab === "pos"){
      list.innerHTML = s.positions.length ? s.positions.slice().reverse().map(pos => { const p = M.get(pos.sym); return `<div class="pc" data-id="${pos.id}"><div class="pc-h"><span class="side-b ${pos.dir==="up"?"l":"s"}">${pos.dir==="up"?"▲":"▼"}</span><button class="sym" data-open="${pos.sym}">${esc(M.label(p))}</button><span class="perp">${pos.dir==="up"?"Up":"Down"}</span><span class="perp">${pos.expiry<60?pos.expiry+"s":pos.expiry/60+"m"}</span>${pos.source==="auto"?'<span class="perp">Auto</span>':""}<span class="grow"></span><b class="num brand-c" data-cd></b></div>
        <div class="pc-g"><div><span>Amount (USDT)</span><b class="num">${money(pos.amount)}</b></div><div><span>Entry Price</span><b class="num">${M.fmtPx(p,pos.entry)}</b></div><div><span>PNL (USDT)</span><b class="num" data-pnl></b></div><div><span>Payout</span><b class="num">${money(pos.amount*E.RATIO)}</b></div><div><span>Mark Price</span><b class="num" data-now></b></div><div><span>Status</span><b data-st></b></div></div><div class="prog"><i data-pg></i></div></div>`; }).join("") : UI.emptyState("file", "No open positions");
      tick();
    } else {
      const h = s.history.slice(0, 60);
      list.innerHTML = h.length ? h.map(x => { const p = M.get(x.sym) || {dp:2, type:"crypto", base:x.sym, quote:""}; return `<div class="pc"><div class="pc-h"><span class="side-b ${x.dir==="up"?"l":"s"}">${x.dir==="up"?"▲":"▼"}</span><span class="sym">${esc(M.label(p))}</span><span class="perp">${x.expiry<60?x.expiry+"s":x.expiry/60+"m"}</span><span class="grow"></span><span class="label">${x.result === "win" ? "Won" : x.result === "loss" ? "Lost" : "Refunded"}</span></div>
        <div class="ph-g"><div><span>PNL (USDT)</span><b class="num ${x.profit>0?"up":x.profit<0?"down":""}">${signed(x.profit)}</b></div><div><span>Entry Price</span><b class="num">${M.fmtPx(p,x.entry)}</b></div><div><span>Close Price</span><b class="num">${M.fmtPx(p,x.exit)}</b></div></div><div class="ph-t"><span>Closed</span><b>${U.dateStr(x.closed)}</b></div></div>`; }).join("") : UI.emptyState("history", "No history");
    }
  }
  function tick(){
    if (ptab !== "pos" || !root) return; const now = Date.now();
    s.positions.forEach(pos => { const r = root.querySelector(`.pc[data-id="${pos.id}"]`); if (!r) return;
      const {win, pnl} = E.livePnl(pos), p = M.get(pos.sym), left = (pos.exp - now)/1000;
      r.querySelector("[data-cd]").textContent = mmss(left); r.querySelector("[data-now]").textContent = M.fmtPx(p);
      const el = r.querySelector("[data-pnl]"); el.textContent = win == null ? "0.00" : win ? "+" + money(pnl) : "-" + money(pos.amount); el.className = "num " + (win == null ? "" : win ? "up" : "down");
      const st = r.querySelector("[data-st]"); st.textContent = win == null ? "Even" : win ? "Winning" : "Losing"; st.className = win == null ? "" : win ? "up" : "down";
      r.querySelector("[data-pg]").style.width = U.clamp((now - pos.open)/(pos.exp - pos.open)*100, 0, 100) + "%";
      const sc = Math.ceil(left); if (sc <= 5 && sc > 0 && cdLast[pos.id] !== sc && pos.sym === sym){ cdLast[pos.id] = sc; U.beep("tick"); } });
  }
  function result(rec){
    const p = M.get(rec.sym), w = rec.result === "win", l = rec.result === "loss";
    if (w){ U.confetti(); U.fx("win"); } else if (l) U.fx("loss");
    U.modal(`<div class="res-ic ${w?"w":l?"l":"d"}">${ic(w?"trophy":l?"x":"reset",32)}</div><div class="h1" style="margin-bottom:4px">${w ? "You won!" : l ? "Trade lost" : "Draw — refunded"}</div>
      <div class="num ${w?"up":l?"down":""}" style="font-size:30px;font-weight:700;margin:8px 0">${signed(rec.profit)} USDT</div>
      <div class="sub" style="margin-bottom:16px;font-size:13px">${esc(M.label(p))} · ${rec.dir==="up"?"Up":"Down"} · ${money(rec.amount)} USDT<br>Entry ${M.fmtPx(p, rec.entry)} → Close ${M.fmtPx(p, rec.exit)}</div>
      <div class="row"><button class="btn btn-ghost grow" data-x>Close</button><button class="btn btn-primary grow" data-again>Trade again</button></div>`, el => {
      el.querySelector("[data-x]").onclick = U.closeLayer; el.querySelector("[data-again]").onclick = () => { U.closeLayer(); if (rec.sym !== sym) location.hash = "#/trade/" + rec.sym; else trade(rec.dir); }; });
  }
  return {html, title: M.label(P()) + " Binary", mount(r){
    root = r; M.watchTrades(sym);
    $("#amt").value = s.settings.defAmt || 10;
    renderPx(); renderOrder(); setPtab("pos");
    unChart = bindChart(root, sym, "tf_binary", "tick", candleDetail(sym, {html:`<button class="btn btn-up" data-q="up">Up</button><button class="btn btn-down" data-q="down">Down</button>`, bind: el => el.querySelectorAll("[data-q]").forEach(x => x.onclick = () => { U.closeLayer(); trade(x.dataset.q); })}));
    const amt = $("#amt");
    amt.addEventListener("input", () => { $("#err").textContent = ""; $("#af").classList.remove("err"); renderOrder(); });
    const stepOf = v => v < 20 ? 1 : v < 100 ? 5 : v < 1000 ? 10 : 100;
    $("[data-minus]").onclick = () => { const v = parseFloat(amt.value) || 0; amt.value = Math.max(1, v - stepOf(v - 0.01)); renderOrder(); };
    $("[data-plus]").onclick = () => { const v = parseFloat(amt.value) || 0; amt.value = Math.min(Math.floor(s.balance), v + stepOf(v)) || 1; renderOrder(); };
    $("[data-half]").onclick = () => { amt.value = Math.max(1, Math.floor((parseFloat(amt.value)||0) / 2 * 100) / 100); renderOrder(); };
    $("[data-dbl]").onclick = () => { amt.value = Math.min(Math.floor(s.balance*100)/100, Math.round((parseFloat(amt.value)||0) * 2 * 100) / 100) || 1; renderOrder(); };
    root.querySelectorAll("#qa [data-v]").forEach(b => b.onclick = () => { amt.value = b.dataset.v === "max" ? Math.floor(Math.min(s.balance, 50000)*100)/100 : b.dataset.v; renderOrder(); });
    root.querySelectorAll("[data-e]").forEach(b => b.onclick = () => { exp = +b.dataset.e; renderOrder(); });
    root.querySelectorAll("[data-dir]").forEach(b => b.onclick = () => trade(b.dataset.dir));
    root.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => setPtab(b.dataset.pt));
    $("[data-pick]").onclick = () => pickSheet(sym, x => location.hash = "#/trade/" + x, true);
    $("[data-alert]").onclick = () => alertSheet(sym);
    $("#plist").addEventListener("click", e => { const o = e.target.closest("[data-open]"); if (o && o.dataset.open !== sym) location.hash = "#/trade/" + o.dataset.open; });
    let tT = 0;
    offs.push(bus.on("tick", x => { if (x === sym && performance.now() - tT > 150){ tT = performance.now(); renderPx(); } }), bus.on("meta", x => { if (x === sym){ renderPx(); renderOrder(); } }),
      bus.on("sec", tick), bus.on("balance", renderOrder), bus.on("positions", renderPositions), bus.on("history", () => ptab === "hist" && renderPositions()), bus.on("settled", result));
    const iv = setInterval(renderOrder, 2000); timers.push(() => clearInterval(iv));
  }, unmount(){ offs.forEach(f => f()); timers.forEach(f => f()); unChart?.(); M.unwatchTrades(); }};
};

/* ---------------- Futures trade history (#/history) ---------------- */
Pages.history = () => {
  let tab = "pos";
  const html = `<header class="page-head"><button class="icon-btn" data-back aria-label="Back">${ic("back",22)}</button><div class="grow" style="text-align:center"><div class="h1" style="font-size:18px">My Trades</div><div class="label">USDⓈ-M Futures</div></div><span style="width:34px"></span></header>
    <div class="ptabs" style="margin-top:0"><button data-ht="ord">Order History</button><button class="on" data-ht="pos">Position History</button><button data-ht="trade">Trade History</button><button data-ht="bin">Binary</button></div>
    <p class="label" style="margin:10px 0">Last updated: <span id="lu"></span></p><div id="hl"></div>`;
  return {html, title:"My Trades", mount(r){
    const render = () => {
      r.querySelector("#lu").textContent = new Date().toLocaleString();
      const f = S().fut, log = (f.log || []).slice().reverse();
      const box = r.querySelector("#hl");
      if (tab === "pos") box.innerHTML = historyHtml(f.history);
      else if (tab === "bin") box.innerHTML = S().history.length ? S().history.slice(0,100).map(x => { const p = M.get(x.sym) || {dp:2,type:"crypto",base:x.sym,quote:""}; return `<div class="pc"><div class="pc-h"><span class="side-b ${x.dir==="up"?"l":"s"}">${x.dir==="up"?"▲":"▼"}</span><span class="sym">${esc(M.label(p))}</span><span class="perp">Binary ${x.expiry<60?x.expiry+"s":x.expiry/60+"m"}</span><span class="grow"></span><b class="num ${x.profit>0?"up":x.profit<0?"down":""}">${signed(x.profit)}</b></div><div class="ph-t"><span>${M.fmtPx(p,x.entry)} → ${M.fmtPx(p,x.exit)}</span><b>${U.dateStr(x.closed)}</b></div></div>`; }).join("") : UI.emptyState("history","No records");
      else box.innerHTML = log.filter(x => tab === "ord" || x.status === "Filled").length ? log.filter(x => tab === "ord" || x.status === "Filled").slice(0,100).map(x => { const p = M.get(x.sym) || {dp:2,type:"crypto",base:x.sym}; return `<div class="pc"><div class="pc-h"><span class="side-b ${x.side==="long"?"l":"s"}">${x.side==="long"?"B":"S"}</span><span class="sym">${esc(fsym(p))}</span><span class="perp">${x.type}</span><span class="grow"></span><span class="label">${x.status}</span></div>
        <div class="ph-g"><div><span>Price</span><b class="num">${M.fmtPx(p,x.price)}</b></div><div><span>Qty</span><b class="num">${fmt(x.qty,4)}</b></div><div><span>${x.pnl != null ? "Realized PNL" : "Fee"}</span><b class="num ${x.pnl != null ? (x.pnl>=0?"up":"down") : ""}">${x.pnl != null ? signed(x.pnl) : fmt(x.fee||0,4)}</b></div></div><div class="ph-t"><span>Time</span><b>${new Date(x.t).toLocaleString()}</b></div></div>`; }).join("") : UI.emptyState("history","No records");
    };
    render();
    r.querySelectorAll("[data-ht]").forEach(b => b.onclick = () => { tab = b.dataset.ht; r.querySelectorAll("[data-ht]").forEach(x => x.classList.toggle("on", x===b)); render(); });
  }};
};
})();
