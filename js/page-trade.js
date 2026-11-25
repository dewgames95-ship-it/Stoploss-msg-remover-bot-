/* ===== Trading screens: Price/Chart page, USDⓈ-M Futures, Binary Options ===== */
(function(){
const C = window.CONFIG, {esc, ic, t, store, bus, money, signed, pct, mmss, toast, fmt} = U;
const TFS = ["tick","1s","5s","30s","1m","5m","15m","1h","4h","1d","3d","1w","1M"];
const TFL = {tick:"Time", "1d":"1D", "3d":"3D", "1w":"1W", "1M":"1M"};
const INDS_MAIN = ["MA","EMA","BOLL","SAR","VWAP","SUPER"], INDS_SUB = ["VOL","RSI","MACD"];
const S = () => store.s;
const usdPx = p => M.fmtPx(p, p.price != null && M.usdtUsd ? p.price * M.usdtUsd() : p.price);
const fsym = p => p.type === "crypto" ? p.base + "USDT" : p.sym;

/* ---------------- Coin info (CoinGecko, cached per session) ---------------- */
const CG = "https://api.coingecko.com/api/v3";
async function cgCoin(base){
  const key = "cg_" + base; try { const c = JSON.parse(sessionStorage.getItem(key) || "null"); if (c) return c; } catch {}
  const sr = await (await fetch(`${CG}/search?query=${encodeURIComponent(base)}`)).json();
  const hit = (sr.coins || []).find(c => c.symbol?.toUpperCase() === base) || (sr.coins || [])[0]; if (!hit) throw 0;
  const d = await (await fetch(`${CG}/coins/${hit.id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`)).json();
  try { sessionStorage.setItem(key, JSON.stringify(d)); } catch {} return d;
}
async function coinInfo(p, box){
  if (p.type !== "crypto"){ box.innerHTML = `<div class="title" style="margin-bottom:6px">${esc(UI.fullName(p))}</div><p class="sub">${p.type === "forex" ? "Foreign-exchange pair quoted from interbank liquidity. Trades 24/5, closed on weekends." : "Spot precious metal priced in US dollars per troy ounce. Trades 24/5."}</p>`; return; }
  box.innerHTML = `<div class="ci-skel">${Array(8).fill('<div class="skel" style="height:22px"></div>').join("")}</div>`;
  try {
    const d = await cgCoin(p.base), m = d.market_data || {}, u = v => v == null ? "--" : Number(v).toLocaleString("en-US", {maximumFractionDigits: v < 1 ? 6 : 2});
    const sup = v => v == null ? "--" : Math.round(v).toLocaleString("en-US") + " " + esc(p.base), dt = d.genesis_date || (m.ath_date?.usd ? "" : "");
    const desc = (d.description?.en || "").replace(/<[^>]+>/g, "").trim(), web = d.links?.homepage?.find(Boolean), wp = d.links?.whitepaper || "";
    box.innerHTML = `<div class="ci-h">${UI.pairIcon(p, 28)}<b>${esc(d.name || UI.fullName(p))}</b></div>
      <p class="ci-disc">*Data provided by CoinGecko is for information purposes only. It is shown on an "as is" basis and doesn't constitute any form of representation or warranty.</p>
      <div class="ci-t">${[["Market Cap Ranking", d.market_cap_rank ? "#" + d.market_cap_rank : "--"], ["Circulating Market Cap", u(m.market_cap?.usd) + " USDT"], ["Fully Diluted Market Cap", u(m.fully_diluted_valuation?.usd) + " USDT"], ["Circulating Supply", sup(m.circulating_supply)], ["Maximum Supply", sup(m.max_supply)], ["Total Supply", sup(m.total_supply)], ["Issuance Date", d.genesis_date || "--"], ["All Time High", u(m.ath?.usd) + " USDT"], ["All Time Low", u(m.atl?.usd) + " USDT"]].map(([a, b]) => `<div><span>${a}</span><b class="num">${b}</b></div>`).join("")}</div>
      ${web || wp ? `<div class="ci-sec">Link</div><div class="ci-links">${web ? `<a class="btn btn-ghost" href="${esc(web)}" target="_blank" rel="noopener">Official Website</a>` : ""}${wp ? `<a class="btn btn-ghost" href="${esc(wp)}" target="_blank" rel="noopener">White Paper</a>` : ""}</div>` : ""}
      ${desc ? `<div class="ci-sec">Introduction</div><p class="ci-desc clamp" id="ciDesc">${esc(desc)}</p><button class="link" id="ciMore">View More</button>` : ""}`;
    const more = box.querySelector("#ciMore"); if (more) more.onclick = () => { box.querySelector("#ciDesc").classList.toggle("clamp"); more.textContent = more.textContent === "View More" ? "View Less" : "View More"; };
  } catch { box.innerHTML = UI.emptyState("info", "Coin info is unavailable right now. Check your connection and try again."); }
}

/* ---------------- Tap-for-details sheets ---------------- */
const INFO = {
  funding: () => { const now = new Date(), h = now.getUTCHours(), nx = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), (Math.floor(h/8)+1)*8), l = Math.max(0, (nx - Date.now())/1000), z = n => String(Math.floor(n)).padStart(2,"0");
    return ["Funding Rate", `<div class="cf-rows"><div><span>Current Rate / Annualized</span><b class="num">0.0100% / 10.950%</b></div><div><span>Funding Interval</span><b>Every 8 hours</b></div><div><span>Settlement</span><b class="num">${z(l/3600)}:${z(l%3600/60)}:${z(l%60)}</b></div><div><span>Side</span><b><span class="up">Long</span> pays <span class="down">Short</span></b></div><div><span>Funding Floor / Cap</span><b class="num">-2.0000% / 2.0000%</b></div></div><p class="info-p">Funding keeps the perpetual price close to the spot index. It is exchanged between traders every 8 hours (00:00, 08:00, 16:00 UTC) based on position notional — NovaTrade does not keep it.</p>`]; },
  liq: () => ["Est. Liq. Price", `<p class="info-p">The estimated liquidation price is where your margin ratio would reach 100% (maintenance margin ${(C.MMR*100).toFixed(2)}% of notional), assuming other positions and your balance stay the same. For cross margin your whole available balance backs the position, so it is further away. Reference only.</p>`],
  mr: () => ["Margin Ratio", `<p class="info-p">Margin Ratio = Maintenance Margin ÷ Margin Balance. Below 50% is healthy, 50–80% is a warning, and at 100% the position is liquidated. Add margin, reduce size or lower leverage to bring it down.</p>`],
  roi: () => ["ROI", `<p class="info-p">ROI = Unrealized PnL ÷ Initial Margin × 100%. With leverage, a 1% price move changes ROI by about (1% × leverage).</p>`],
  pnl: () => ["Unrealized PnL", `<p class="info-p">Profit or loss of the open position at the current Mark Price: (Mark − Entry) × Size for Long, (Entry − Mark) × Size for Short. Fees and funding are shown in Realized PnL.</p>`],
  mark: () => ["Mark Price", `<p class="info-p">A fair price derived from the index and the live order book. PnL and liquidation use the Mark Price, not the last trade, to avoid manipulation.</p>`],
  entry: () => ["Entry Price", `<p class="info-p">Average price at which this position was opened.</p>`],
  size: () => ["Size", `<p class="info-p">Position notional value in USDT = quantity × mark price. Size = Margin × Leverage at entry.</p>`],
  margin: () => ["Margin", `<p class="info-p">Collateral locked for this position. Isolated: only this margin can be lost. Cross: your available balance is shared across positions.</p>`],
  tpsl: () => ["TP / SL", `<p class="info-p">Take Profit and Stop Loss are trigger orders. When the Mark Price reaches your trigger, a market order closes the position. Use ROI % mode to set them by return instead of price.</p>`],
  fee: () => ["Trading Fees", `<div class="cf-rows"><div><span>Futures (open & close)</span><b class="num">${(C.FEE*100).toFixed(2)}%</b></div><div><span>Spot</span><b class="num">0.02%</b></div><div><span>Binary</span><b>No fee</b></div></div>`]
};
function showInfo(k){ const f = INFO[k]; if (!f) return; const [t, h] = f(); U.sheet(t, h + `<button class="btn btn-primary btn-block" style="margin-top:14px" data-x>OK</button>`, el => el.querySelector("[data-x]").onclick = U.closeLayer); }
document.addEventListener("click", e => { const t = e.target.closest("[data-info]"); if (t){ e.preventDefault(); showInfo(t.dataset.info); } });

/* ---------------- Quick trade sheet (open a futures position without leaving the chart) ---------------- */
function quickTrade(sym, side){
  const s = S(), p = M.get(sym); let lev = Math.min(s.settings.lev || 20, E.maxLev(p)), mode = s.settings.marginMode || "cross", pctv = 0;
  U.sheet("Trade", `<div class="qt-top"><div class="oc" style="margin:0"><button class="${side === "long" ? "on" : ""}" data-sd="long">Open Long</button><button class="${side === "short" ? "on" : ""}" data-sd="short">Open Short</button></div>
      <div class="fx-row" style="grid-template-columns:1fr 1fr;margin:8px 0"><button data-qm>${mode === "cross" ? "Cross" : "Isolated"}</button><button data-ql>${lev}x</button></div></div>
    <div class="famt"><input id="qa" type="number" inputmode="decimal" placeholder="Cost"><span>USDT</span></div>
    <div class="chips" style="margin:6px 0 8px">${[10,25,50,75,100].map(v => `<button data-qp="${v}">${v}%</button>`).join("")}</div>
    <div class="fkv"><span>Avbl</span><b class="num">${money(store.wb("futures"))} USDT <button class="wl-plus" data-wlto="futures" aria-label="Transfer in">${ic("plus",13,3)}</button></b></div><div class="fkv"><span>Position size</span><b class="num" id="qsz">--</b></div><div class="fkv"><span>Est. Liq. Price</span><b class="num" id="qlq">--</b></div>
    <button class="fbtn2 ${side === "long" ? "l" : "s"}" id="qgo" style="margin-top:10px"><span>${side === "long" ? "Open Long" : "Open Short"}</span></button>`.replace(/@\{/g, "${"), el => {
    const upd = () => { const c = parseFloat(el.querySelector("#qa").value) || 0, sz = c * lev, q = sz / (p.price || 1), lq = c ? E.liqPrice(side, p.price, lev, mode, q, c) : 0;
      el.querySelector("#qsz").textContent = c ? money(sz) + " USDT" : "--"; el.querySelector("#qlq").textContent = lq > 0 ? M.fmtPx(p, lq) : "--";
      const g = el.querySelector("#qgo"); g.className = "fbtn2 " + (side === "long" ? "l" : "s"); g.querySelector("span").textContent = side === "long" ? "Open Long" : "Open Short"; };
    el.querySelectorAll("[data-sd]").forEach(b => b.onclick = () => { side = b.dataset.sd; el.querySelectorAll("[data-sd]").forEach(x => x.classList.toggle("on", x === b)); upd(); });
    el.querySelector("[data-qm]").onclick = () => { mode = mode === "cross" ? "isolated" : "cross"; el.querySelector("[data-qm]").textContent = mode === "cross" ? "Cross" : "Isolated"; upd(); };
    el.querySelector("[data-ql]").onclick = () => { const opts = [5, 10, 20, 50, 75, 100, 125].filter(x => x <= E.maxLev(p)); lev = opts[(opts.indexOf(lev) + 1) % opts.length] || opts[0]; el.querySelector("[data-ql]").textContent = lev + "x"; upd(); };
    el.querySelector("#qa").oninput = upd;
    el.querySelectorAll("[data-qp]").forEach(b => b.onclick = () => { el.querySelector("#qa").value = Math.floor(store.wb("futures") / (1 + lev * C.FEE) * +b.dataset.qp) / 100; upd(); });
    el.querySelector("#qgo").onclick = async () => {
      const c = parseFloat(el.querySelector("#qa").value) || 0; if (!(c > 0)) return toast("Please enter the cost", "bad");
      const r = E.openFut({sym, side, margin: c, lev, type:"market", price:null, tp:null, sl:null, mode});
      if (r.err){ toast(r.err, "bad"); UI.walletErr(r.err); return; }
      U.closeLayer(); U.fx("open"); toast(`Order filled: ${side === "long" ? "Long" : "Short"} ${M.label(p)} ${lev}x`, "ok");
    };
  });
}

/* ---------------- shared pieces ---------------- */
function resolveSym(params, key){
  let sym = (params[0] || sessionStorage.getItem(key) || "BTCUSDT").toUpperCase();
  if (!M.get(sym) && M.get(sym + "USDT")) sym += "USDT";
  return sym;
}
function loadingPage(title){
  let off;
  return {title:"Loading", html: UI.pageHead(title) + `<div>${Array(8).fill('<div class="skel"></div>').join("")}</div>`, mount(){ off = bus.on("list", () => { if (M.cryptoOrder.length) setTimeout(App.route, 0); }); }, unmount(){ off?.(); }};
}
function chartBlock(){
  const MAIN = ["tick","1s","5s","30s","1m","15m","1h","4h","1d"];
  return `<div class="tfbar"><div class="tfs" id="tfs">${MAIN.map(x => `<button data-tf="${x}">${TFL[x] || x}</button>`).join("")}<button class="tf-more" data-tfmore><span id="tfml">More</span> ${ic("chevd",10)}</button></div>
      <button class="ti" data-fs aria-label="Fullscreen">${ic("expand",15)}</button><button class="ti" data-drawt aria-label="Drawing tools">${ic("pen",15)}</button><button class="ti" data-indset aria-label="Indicator settings">${ic("grid",15)}</button><button class="ti" data-ctype aria-label="Chart type">${ic("candle",15)}</button></div>
    <div class="drawbar hide" id="drawbar">${[["trend","Trend line"],["ray","Ray"],["hline","Horizontal"],["rect","Rectangle"],["fib","Fib"]].map(([k,n]) => `<button data-tool="${k}">${n}</button>`).join("")}<button data-undo>${ic("reset",13)} Undo</button><button data-clear>${ic("trash",13)} Clear</button></div>
    <div class="cp-chart" id="cc"><div class="fs-head"><button class="icon-btn" data-fsx aria-label="Exit fullscreen">${ic("back",20)}</button><b id="fsl"></b><span class="grow"></span><b class="num" id="fsp"></b></div>
      <div class="chart-wrap"><div id="chart"></div><div class="legend" id="lg"></div><div class="chart-msg" id="cmsg"></div></div></div>
    <div class="indbar"><div class="il" id="inds">${INDS_MAIN.map(k => `<button data-ind="${k}">${k}</button>`).join("")}<span style="color:var(--line)">|</span>${INDS_SUB.map(k => `<button data-ind="${k}">${k}</button>`).join("")}</div><button class="ti" data-indinfo aria-label="Indicator guide">${ic("ind",18)}</button></div>`;
}
function bindChart(root, sym, tfKey, defTf, detailCb, opt={}){
  const $ = q => root.querySelector(q), offs = [], on = (q, f) => { const e = $(q); if (e) e.onclick = f; };
  let tf = sessionStorage.getItem(tfKey) || defTf;
  if (opt.tfs && !opt.tfs.includes(tf)) tf = defTf;
  CH.mount($("#chart"), {legend:$("#lg"), msg:$("#cmsg"), mode: tfKey === "tf_binary" ? "bin" : "fut", noInd: !!opt.mini}, detailCb);
  const renderInds = () => root.querySelectorAll("[data-ind]").forEach(b => b.classList.toggle("on", CH.inds.includes(b.dataset.ind)));
  const setTf = x => { tf = x; sessionStorage.setItem(tfKey, tf); let hit = false; root.querySelectorAll("#tfs [data-tf]").forEach(b => { const on = b.dataset.tf === tf; hit ||= on; b.classList.toggle("on", on); });
    const mb = $("[data-tfmore]"); if (mb){ mb.classList.toggle("on", !hit); $("#tfml").textContent = hit ? "More" : (TFL[tf] || tf); } CH.load(sym, tf); };
  on("[data-tfmore]", () => U.sheet("Interval", `<div class="tf-grid">${TFS.map(x => `<button data-tfp="${x}" class="${x === tf ? "on" : ""}">${TFL[x] || x}</button>`).join("")}</div>`, el => el.querySelectorAll("[data-tfp]").forEach(b => b.onclick = () => { U.closeLayer(); setTf(b.dataset.tfp); })));
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
/* Futures docked chart: intervals, chart, indicators and Today/7D/30D/90D/180D/1Y performance on one screen */
function dockChartBlock(sym){
  return miniChartBlock(sym) + `<div class="indbar"><div class="il" id="inds">${INDS_MAIN.map(k => `<button data-ind="${k}">${k}</button>`).join("")}<span style="color:var(--line)">|</span>${INDS_SUB.map(k => `<button data-ind="${k}">${k}</button>`).join("")}</div><button class="ti" data-indinfo aria-label="Indicator guide">${ic("ind",18)}</button></div><div class="perf dock-perf" id="perf"></div>`;
}
async function dockPerf(root, sym){ const r = await CH.performance(sym); const el = root.querySelector("#perf"); if (!el) return;
  el.innerHTML = ["Today","7 Days","30 Days","90 Days","180 Days","1 Year"].map(k => `<div>${k}<b class="num ${r[k] == null ? "" : r[k] >= 0 ? "up" : "down"}">${r[k] == null ? "--" : (r[k] >= 0 ? "+" : "") + r[k].toFixed(2) + "%"}</b></div>`).join(""); }
/* Compact chart used inside Futures (like the exchange's in-position chart): no indicator bar */
const MINI_TFS = ["1s","5s","30s","1m","5m","15m","1h","4h","1d","3d","1w","1M"];
function miniChartBlock(sym){
  return `<div class="tfbar mini"><div class="tfs" id="tfs">${MINI_TFS.map(x => `<button data-tf="${x}">${TFL[x] || x}</button>`).join("")}</div>
    <button class="ti" data-ctype aria-label="Line / candles">${ic("candle",15)}</button><a class="ti" href="#/chart/${sym}" aria-label="Full chart">${ic("expand",14)}</a></div>
    <div class="cp-chart" id="cc"><div class="chart-wrap"><div id="chart"></div><div class="legend" id="lg"></div><div class="chart-msg" id="cmsg"></div></div></div>`;
}
function indGuide(cb){
  U.sheet("Indicators", IND.LIST.map(x => `<div class="list-item" style="align-items:flex-start"><div class="grow"><b>${x.name}</b><div class="sub" style="font-size:13px;margin-top:2px">${x.desc}</div></div><button class="switch ${CH.inds.includes(x.k)?"on":""}" data-ik="${x.k}" aria-label="${x.k}"></button></div>`).join("") + `<a class="more-btn" href="#/academy">Learn in Academy ${ic("chev",14)}</a>`, el => {
    el.querySelectorAll("[data-ik]").forEach(b => b.onclick = () => { const k = b.dataset.ik, l = CH.inds.includes(k) ? CH.inds.filter(x => x !== k) : [...CH.inds, k]; CH.setInds(l); b.classList.toggle("on", l.includes(k)); cb && cb(); });
  });
}
function pickSheet(cur, onPick, binaryOnly){
  const spot = !binaryOnly && /^#\/spot/.test(location.hash);
  const SPT = [["fav","Favorites"],["usdt","USDT"],["stock","Stocks"],["forex","Forex"],["metal","Metals"],["other","Indices"]];
  const spotOf = (p, k) => k === "usdt" ? p.type === "crypto" : k === "stock" ? p.type === "stock" : k === "forex" ? p.type === "forex" : k === "metal" ? p.type === "metal" : (p.type === "index" || p.type === "commodity");
  let q = "", m = binaryOnly ? "binary" : spot ? (sessionStorage.getItem("pkTabSpot") || "usdt") : (sessionStorage.getItem("pkTab") || "all"), sk = sessionStorage.getItem("pkSort") || "";
  const body = () => {
    const qq = q.toUpperCase();
    const favs = S().favs || [];
    let list = (m === "fav" ? favs.map(x => M.get(x)).filter(Boolean) : [...M.pairs.values()].filter(p => spot ? spotOf(p, m) : (m === "all" || p.tradable)))
      .filter(p => !qq || p.sym.includes(qq) || UI.fullName(p).toUpperCase().includes(qq));
    if (m !== "fav") list.sort((a,b) => ((a.type==="crypto"?a.rank||999:500) - (b.type==="crypto"?b.rank||999:500)));
    const [k, dir] = sk.split(":"), f = dir === "asc" ? 1 : -1;
    if (k === "name") list.sort((a,b) => f * a.sym.localeCompare(b.sym));
    if (k === "vol") list.sort((a,b) => (b.qv != null) - (a.qv != null) || f * ((a.qv||0) - (b.qv||0)));
    if (k === "px") list.sort((a,b) => f * ((a.price||0) - (b.price||0)));
    if (k === "chg") list.sort((a,b) => f * ((a.chg||0) - (b.chg||0)));
    list = list.slice(0, 200);
    const vol = p => p.qv ? CH.fmtVol(p.qv) : "";
    return list.map(p => `<button class="pk-row" data-s="${p.sym}">${UI.pairIcon(p,30)}<div class="pk-n"><b>${esc(fsym(p))}</b><small><span class="pk-fn">${esc(UI.fullName(p))}</span> ${vol(p) ? `<span class="num">${vol(p)}</span>` : ""} ${m === "binary" ? `<span class="pk-pp">${Math.round(E.payoutOf(p.sym) * 100)}%</span>` : spot ? (p.type === "crypto" || p.type === "stock" ? "" : `<span class="perp">24/5</span>`) : `<span class="perp">${p.type === "crypto" ? "Perp" : "24/5"}</span>`}</small></div>
      <div class="pk-p"><b class="num">${M.fmtPx(p)}</b><small class="num">$${usdPx(p)}</small></div><span class="pk-c ${p.closed ? "cl" : (p.chg||0) < 0 ? "dn" : ""}">${p.closed ? "Closed" : p.chg == null ? "--" : pct(p.chg)}</span></button>`).join("") || UI.emptyState(m === "fav" ? "star" : "search", m === "fav" ? "No favorites yet" : "No results");
  };
  U.sheet("", `<label class="search" style="margin-bottom:6px">${ic("search",16)}<input id="ps" placeholder="Search" autocomplete="off"></label>
    <div class="tabs pk-tabs" style="margin-bottom:4px">${spot ? SPT.map(([k, n]) => `<button class="tab ${m===k?"on":""}" data-m="${k}">${n}</button>`).join("") : `<button class="tab ${m==="fav"?"on":""}" data-m="fav">Favorites</button><button class="tab ${m==="all"?"on":""}" data-m="all">Futures</button><button class="tab ${m==="binary"?"on":""}" data-m="binary">Binary</button>`}</div>
    <div class="pk-h"><span><button data-sk="name">Name</button> / <button data-sk="vol">Vol</button></span><button data-sk="px">Last Price</button><button data-sk="chg">24h Chg%</button></div><div id="pl">${body()}</div>`, el => {
    const marks = () => el.querySelectorAll("[data-sk]").forEach(b => { const [k2, d2] = sk.split(":"); b.dataset.st = b.dataset.sk === k2 ? d2 : ""; });
    marks();
    el.querySelectorAll("[data-sk]").forEach(b => b.onclick = () => { const [k2, d2] = sk.split(":"); sk = b.dataset.sk !== k2 ? b.dataset.sk + ":desc" : d2 === "desc" ? k2 + ":asc" : ""; sessionStorage.setItem("pkSort", sk); marks(); el.querySelector("#pl").innerHTML = body(); });
    const pl = el.querySelector("#pl");
    el.querySelector("#ps").addEventListener("input", e => { q = e.target.value; pl.innerHTML = body(); });
    el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { m = b.dataset.m; if (!binaryOnly) sessionStorage.setItem(spot ? "pkTabSpot" : "pkTab", m); el.querySelectorAll("[data-m]").forEach(x => x.classList.toggle("on", x===b)); pl.innerHTML = body(); });
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
  U.sheet("Candle analysis", `<div class="row" style="gap:10px;margin-bottom:10px"><div class="grow"><b>${esc(fsym(p))} · ${d.tf.toUpperCase()}</b><div class="label">${new Date(b.time*1000).toLocaleString("en-US")}</div></div><b class="num ${chp>=0?"up":"down"}" style="font-size:18px">${chp>=0?"+":""}${chp.toFixed(2)}%</b></div>
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
  <header class="cp-head"><button class="icon-btn" data-back aria-label="Back">${ic("back",20)}</button>
    <div class="grow"><button class="nm" data-pick>${p.type === "crypto" ? UI.coinImg(p.base, 18) : ""}<span>${esc(fsym(p))}</span> <span class="perp">Perp</span>${ic("chevd",12)}</button><div class="cp-sub">${esc(UI.fullName(p))}</div></div>
    <button class="icon-btn" data-star aria-label="Favorite"></button><button class="icon-btn" data-alert aria-label="Price alert">${ic("bell",19)}</button></header>
  <div class="cp-tabs"><button class="on" data-cpt="price">Price</button><button data-cpt="info">Info</button><button data-cpt="data">Data</button><button data-cpt="binary">Binary</button></div>
  <div id="cpPrice">
    <div class="cp-price"><div class="pl"><button class="mk-l" data-info="mark">Mark Price ${ic("chevd",9)}</button><div class="lp" id="lp">--</div><div class="row num pl-s"><b id="lusd"></b><span id="lc"></span></div><div class="pl-l">Last Price <b class="num" id="mk"></b>${p.closed ? ` <span class="brand-c">Market closed</span>` : ""}</div></div>
      <div class="k"><span>24h Vol(${esc(p.base)})</span><b id="vb"></b><span>24h Vol(USDT)</span><b id="vq"></b><span>24h High</span><b id="hi"></b><span>24h Low</span><b id="lo"></b></div></div>
    ${chartBlock()}
    <div class="perf" id="perf">${["Today","7 Days","30 Days","90 Days","180 Days","1 Year"].map(k => `<div>${k}<b>--</b></div>`).join("")}</div>
    <div class="obtabs"><button class="on" data-ob="book">Order Book</button><button data-ob="depth">Depth</button><button data-ob="trades">Trades</button></div>
    <div id="obox"></div>
  </div>
  <div id="cpOther" class="hide" style="padding:14px 0"></div>
  <div class="cp-bottom"><div class="in qt"><button class="ib" data-more aria-label="More">${ic("dots",19)}<span>More</span></button><a class="ib" href="#/futures/${sym}" aria-label="Futures">${ic("layers",19)}<span>Futures</span></a><button class="btn btn-up" data-qt="long">Long</button><button class="btn btn-down" data-qt="short">Short</button></div></div>`;

  function renderPx(){
    const p = M.get(sym), lp = root.querySelector("#lp"); if (!lp) return;
    lp.textContent = M.fmtPx(p); lp.className = "lp " + (p.dir >= 0 ? "up" : "down");
    root.querySelector("#lusd").textContent = "$" + usdPx(p);
    const lc = root.querySelector("#lc"); lc.className = "num " + ((p.chg||0) < 0 ? "down" : "up"); lc.textContent = p.closed || p.chg == null ? "" : pct(p.chg);
    root.querySelector("#mk").textContent = M.fmtPx(p);
    root.querySelector("#hi").textContent = M.fmtPx(p, p.high); root.querySelector("#lo").textContent = M.fmtPx(p, p.low);
    root.querySelector("#vb").textContent = p.qv && p.price ? CH.fmtVol(p.qv / p.price) : "--"; root.querySelector("#vq").textContent = p.qv ? CH.fmtVol(p.qv) : "--";
    const fs = root.querySelector("#fsp"); if (fs){ fs.textContent = M.fmtPx(p); root.querySelector("#fsl").textContent = fsym(p); }
  }
  function renderStar(){ const on = S().favs.includes(sym); root.querySelector("[data-star]").innerHTML = `<span style="color:${on ? "#F0B90B" : "var(--text)"}">${ic("star",19)}</span>`; root.querySelector("[data-star] svg").setAttribute("fill", on ? "currentColor" : "none"); }
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
    if (k === "info"){ const cb = document.createElement("div"); cb.className = "cp-coin"; box.appendChild(cb); coinInfo(p, cb); }
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
    root.querySelectorAll("[data-qt]").forEach(b => b.onclick = () => quickTrade(sym, b.dataset.qt === "cost" ? "long" : b.dataset.qt));
    root.querySelector("[data-share]")?.addEventListener("click", () => U.copyText(location.href, "Link copied"));
    if (root.querySelector("[data-more]")) root.querySelector("[data-more]").onclick = () => U.sheet("More", [["ring","Price alerts","#/alerts"],["book","Academy","#/academy"],["users","Copy Trading","#/copy"],["crown","VIP Signals","#/vip"],["chart","Markets","#/markets"]].map(([i,n,h]) => `<a class="list-item" href="${h}"><span class="ic">${ic(i,18)}</span><span class="grow">${n}</span>${ic("chev",16)}</a>`).join(""));
    root.querySelectorAll("[data-ob]").forEach(b => b.onclick = () => { obTab = b.dataset.ob; root.querySelectorAll("[data-ob]").forEach(x => x.classList.toggle("on", x===b)); renderBook(); });
    root.querySelectorAll("[data-cpt]").forEach(b => b.onclick = () => { const k = b.dataset.cpt; if (k === "binary"){ location.hash = "#/trade/" + sym; return; }
      root.querySelectorAll("[data-cpt]").forEach(x => x.classList.toggle("on", x===b)); root.querySelector("#cpPrice").classList.toggle("hide", k !== "price"); root.querySelector("#cpOther").classList.toggle("hide", k === "price"); if (k !== "price") renderOther(k); else setTimeout(CH.resize, 30); });
    let tT = 0, bT = 0;
    offs.push(bus.on("tick", x => { if (x === sym && performance.now() - tT > 200){ tT = performance.now(); renderPx(); } }), bus.on("meta", x => x === sym && renderPx()),
      bus.on("depth", x => { if (x === sym && obTab !== "trades" && performance.now() - bT > 500){ bT = performance.now(); renderBook(); } }), bus.on("trade", x => { if (x === sym && obTab === "trades" && performance.now() - bT > 400){ bT = performance.now(); renderBook(); } }));
    if (p.type !== "crypto"){ const iv = setInterval(renderBook, 2000); timers.push(() => clearInterval(iv)); }
  }, unmount(){ offs.forEach(f => f()); timers.forEach(f => f()); window.TX?.clearFx?.(); unChart?.(); M.unwatchTrades(); document.body.classList.remove("no-nav"); }};
};

/* ---------------- USDⓈ-M Futures (#/futures/SYM) ---------------- */
Pages.futures = (params) => {
  const sym = resolveSym(params, "lastSym_futures");
  if (!M.get(sym)) return M.cryptoOrder.length ? Pages.notfound() : loadingPage("Futures");
  sessionStorage.setItem("lastSym_futures", sym);
  const s = S(), P = () => M.get(sym);
  let tsMode = "price", root, offs = [], timers = [], oc = "open", otype = "market", lev = Math.min(s.settings.lev || 20, E.maxLev(P())), mode = s.settings.marginMode || "cross", tpsl = false, ptab = sessionStorage.getItem("fx_ptab") || "pos", hideOther = sessionStorage.getItem("fx_hide") === "1", chartOpen = false, unChart = null, sliderPct = 0, tif = "GTC", bboSide = "bid";
  const PF = s.settings, LY = PF.layout || {}, FP = PF.futp || {}, kl = LY.kline || "bottom", coinU = FP.unit === "COIN";
  let sortCfg = {by:"default", dir:"desc"}; try { Object.assign(sortCfg, JSON.parse(sessionStorage.getItem("fx_sort") || "{}")); } catch {}
  const unitLbl = () => coinU ? (P().base || "COIN") : "USDT";
  const $ = q => root.querySelector(q);
  const html = `<div class="fxr o-${LY.order === "right" ? "r" : "l"} k-${kl}${LY.bstab === false ? " nobs" : ""}">
  <div class="tabs" style="gap:20px;margin:0 -16px;padding:4px 16px 0;border:0"><button class="tab on" style="font-size:17px">USDⓈ-M</button><a class="tab" href="#/spot/${sym}" style="font-size:17px">Spot</a><a class="tab" href="#/trade/${sym}" style="font-size:17px">Binary</a><a class="tab" href="#/options" style="font-size:17px">Options</a><a class="tab" href="#/copy" style="font-size:17px">Copy</a><a class="tab" href="#/bots" style="font-size:17px">Bots</a></div>
  <header class="fx-head"><div class="grow"><button class="nm" data-pick>${esc(fsym(P()))} <span class="perp">Perp</span>${ic("chevd",16)}</button><div class="num" id="fchg" style="font-size:13px"></div></div>
    <a class="icon-btn" href="#/chart/${sym}" aria-label="Chart">${ic("candle",22,1.6)}</a><button class="icon-btn" data-menu aria-label="More">${ic("dots",22)}</button></header>
  ${kl === "top" ? `<section class="fxc-top" id="cch-top">${miniChartBlock(sym)}</section>` : ""}
  <div class="fx-grid">
    <div>
      <div class="oc"><button class="on" data-oc="open">Open</button><button data-oc="close">Close</button></div>
      <div class="fx-row"><button data-mode></button><button data-lev></button><button data-asset aria-label="Asset mode"></button></div>
      <button class="fsel" data-otype><span id="otl">Market</span><span class="fsel-r"><i class="fi" data-info="otype">${ic("info",13)}</i>${ic("chevd",14)}</span></button>
      <div class="famt hide" id="lpf"><input id="lp" type="number" inputmode="decimal" placeholder="Price"><button class="bbo" data-bbo type="button">BBO</button></div>
      <div class="famt" id="af"><input id="amt" type="number" inputmode="decimal" placeholder="Amount"><span id="unl">USDT</span></div>
      <div class="dslider"><div class="tr"></div><div class="fl" id="sfl"></div>${[0,25,50,75,100].map(v => `<i class="nd" style="left:${v}%" data-nd="${v}"></i>`).join("")}<div class="th" id="sth"></div><input type="range" min="0" max="100" step="1" value="0" id="sl" aria-label="Amount percent"></div>
      <div class="fkv"><span>Avbl</span><b><span id="avb"></span> USDT <button class="wl-plus" data-wlto="futures" aria-label="Transfer in">${ic("plus",13,3)}</button></b></div>
      <div id="openBox">
        <div class="row between"><label class="fchk"><input type="checkbox" id="tpc"> <u data-info="tpsl">TP/SL</u></label><button class="tsm hide" id="tsm" type="button">⇄ <span>ROI %</span></button></div>
        <button class="tifb hide" id="tifb" data-tif type="button"><span id="tifl">GTC</span>${ic("chevd",12)}</button>
        <div id="tpsl" class="hide"><div class="tsh" id="tsh"></div><div class="famt"><input id="tp" type="number" inputmode="decimal" placeholder="Take Profit"><span>Mark</span></div><div class="famt"><input id="sl2" type="number" inputmode="decimal" placeholder="Stop Loss"><span>Mark</span></div></div>
        <div class="fkv"><span data-info="liq"><u>Est. Liq.</u></span><b id="lqp2" class="num"></b></div>
        <button class="fbtn2 l" data-go="long"><span>Open Long</span><small id="cl"></small></button>
        <button class="fbtn2 s" data-go="short" style="margin-top:8px"><span>Open Short</span><small id="cs"></small></button>
        <div class="fkv" style="margin-top:6px"><span>Max</span><b id="mxl" class="num"></b></div><span id="mxs" hidden></span>
        <div class="fkv hide"><span>Liq. Price (Long / Short)</span><b id="lqp"></b></div>
      </div>
      <div id="closeBox" class="hide">
        <div class="fkv"><span>Long position</span><b id="clq"></b></div><button class="fbtn2 s" data-cls="long" style="margin-top:6px">Close Long<small>Sell</small></button>
        <div class="fkv" style="margin-top:10px"><span>Short position</span><b id="csq"></b></div><button class="fbtn2 l" data-cls="short" style="margin-top:6px">Close Short<small>Buy</small></button>
      </div>
      <div class="err-msg" id="ferr" role="alert"></div>
    </div>
    <div class="fbook" id="fbook"></div>
  </div>
  <div class="ptabs"><button data-pt="pos">Positions (<span id="pc">0</span>)</button><button data-pt="ord">Open Orders (<span id="oc">0</span>)</button><a class="ptb-l" href="#/bots">Bots</a><span class="grow"></span><button class="ptb-i" data-pt="hist" aria-label="Position history">${ic("clockh",19,1.7)}</button></div>
  <div class="ptools" id="ptools"><label class="fchk" style="margin:0"><input type="checkbox" id="hide"${hideOther ? " checked" : ""}> Hide Other Symbols</label><span class="grow"></span><button class="ptc" data-closeall>Close All</button><button class="ptb-i" data-sort aria-label="Sort">${ic("sort",18,1.7)}</button></div>
  <div id="plist"></div>

  ${kl === "bottom" ? `<div style="height:64px"></div><section class="fxc ${sessionStorage.getItem("fx_chart") === "1" ? "open" : ""}" id="cch"><button class="fxc-bar" data-cch><span>${esc(fsym(P()))} Perp Chart</span><span class="fxc-i">${ic("chevd",16)}</span></button><div class="fxc-body">${miniChartBlock(sym)}</div></section>` : '<div style="height:24px"></div>'}</div>`;

  /* --- order form --- */
  const inputs = () => { const p = P(), px = otype === "limit" ? (parseFloat($("#lp").value) || p.price) : p.price, raw = parseFloat($("#amt").value) || 0, amt = coinU && oc === "open" ? raw * px : raw; return {p, amt, px}; };
  const fromU = v => coinU && oc === "open" ? +(v / (otype === "limit" ? (parseFloat($("#lp").value) || P().price) : P().price)).toFixed(5) : v;
  function renderForm(){
    const {p, amt, px} = inputs(), avail = store.wb("futures");
    $("[data-mode]").textContent = mode === "cross" ? "Cross" : "Isolated"; $("[data-lev]").textContent = lev + "x"; $("[data-asset]").textContent = (s.settings.futp?.asset || "single") === "multi" ? "M" : "S";
    $("#avb").textContent = money(avail); $("#otl").textContent = otype === "market" ? "Market" : "Limit";
    $("#lpf").classList.toggle("hide", otype !== "limit");
    const maxNotional = avail / (1/lev + C.FEE);
    $("#mxl").textContent = CH.fmtVol(maxNotional) + " / " + CH.fmtVol(maxNotional) + " USDT";
    const cost = amt ? amt / lev + amt * C.FEE : 0; $("#cl").textContent = $("#cs").textContent = cost ? "Cost " + money(cost) + " USDT" : "";
    if (amt && px){ const q = amt / px, m = amt / lev, l1 = E.liqPrice("long", px, lev, mode, q, m), l2 = E.liqPrice("short", px, lev, mode, q, m); $("#lqp2").innerHTML = `<span class="up">${l1 > 0 ? M.fmtPx(p, l1) : "--"}</span> / <span class="down">${l2 > 0 ? M.fmtPx(p, l2) : "--"}</span>`; const ll = E.liqPrice("long", px, lev, mode, q, m), ls = E.liqPrice("short", px, lev, mode, q, m); $("#lqp").textContent = `${ll > 0 ? M.fmtPx(p, ll) : "--"} / ${ls > 0 ? M.fmtPx(p, ls) : "--"}`; } else { $("#lqp").textContent = "-- / --"; $("#lqp2").textContent = "-- / --"; }
    root.querySelectorAll("[data-go]").forEach(b => b.disabled = p.closed);
    const lp = s.fut.positions.find(x => x.sym === sym && x.side === "long"), sp = s.fut.positions.find(x => x.sym === sym && x.side === "short");
    $("#clq").textContent = lp ? money(lp.qty * p.price) + " USDT" : "--"; $("#csq").textContent = sp ? money(sp.qty * p.price) + " USDT" : "--";
    root.querySelector('[data-cls="long"]').disabled = !lp; root.querySelector('[data-cls="short"]').disabled = !sp;
    $("#openBox").classList.toggle("hide", oc !== "open"); $("#closeBox").classList.toggle("hide", oc !== "close");
    $("#amt").placeholder = oc === "open" ? "Amount" : "Close %";
    $("#unl").textContent = oc === "open" ? unitLbl() : "%"; $("#tifb").classList.toggle("hide", otype !== "limit" || oc !== "open"); $("#tifl").textContent = tif;
    renderSlider();
  }
  function renderSlider(){ const v = sliderPct; $("#sfl").style.width = v + "%"; $("#sth").style.left = v + "%"; $("#sth").dataset.v = Math.round(v) + "%"; $("#sth").classList.toggle("bub", v > 0); root.querySelectorAll("[data-nd]").forEach(n => n.classList.toggle("on", +n.dataset.nd <= v)); }
  async function submit(side){
    const {p, amt} = inputs(), err = $("#ferr");
    const lp = otype === "limit" ? parseFloat($("#lp").value) : null, ep = lp || p.price;
    const roiPx = (r, k) => { if (!(r > 0)) return null; const d = r / 100 / lev * ep; return side === "long" ? (k === "tp" ? ep + d : ep - d) : (k === "tp" ? ep - d : ep + d); };
    const tp = tpsl ? (tsMode === "roi" ? roiPx(parseFloat($("#tp").value), "tp") : parseFloat($("#tp").value) || null) : null;
    const sl = tpsl ? (tsMode === "roi" ? roiPx(Math.abs(parseFloat($("#sl2").value)), "sl") : parseFloat($("#sl2").value) || null) : null;
    if (otype === "limit" && !(lp > 0)){ err.textContent = "Please enter the price."; return toast("Please enter the price", "bad"); }
    if (!(amt > 0)){ err.textContent = "Please enter the amount."; $("#af").classList.add("err"); return toast("Please enter the amount", "bad"); }
    const px = lp || p.price, q = amt / px, liq = E.liqPrice(side, px, lev, mode, q, amt / lev);
    const ok = await U.confirmTrade({kind: otype, title: `${fsym(p)} Perp · ${side === "long" ? "Open Long" : "Open Short"}`, tone: side === "long" ? "up" : "down", okText: side === "long" ? "Confirm Long" : "Confirm Short",
      sub: `<span class="perp">${mode === "cross" ? "Cross" : "Isolated"} ${lev}x</span> <span class="perp">${otype === "market" ? "Market" : "Limit · " + tif}</span>`,
      rows: [["Price", otype === "market" ? "Market" : M.fmtPx(p, lp)], ["Amount", money(amt) + " USDT"], ["Quantity", fmt(q, q < 1 ? 5 : 3) + " " + esc(p.base || "")], ["Margin", money(amt / lev) + " USDT"], ["Fee (est.)", money(amt * C.FEE) + " USDT"], ["Est. liq. price", liq > 0 ? M.fmtPx(p, liq) : "--"], ...(tp || sl ? [["TP / SL", `${tp ? M.fmtPx(p, tp) : "--"} / ${sl ? M.fmtPx(p, sl) : "--"}`]] : [])]});
    if (!ok) return;
    const r = E.openFut({sym, side, margin: amt / lev, lev, type:otype, price:lp, tp, sl, mode, tif: otype === "limit" ? tif : undefined});
    if (r.err){ err.textContent = r.err; $("#af").classList.toggle("err", /amount|balance|value/i.test(r.err)); toast(r.err, "bad"); UI.walletErr(r.err); return; }
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
      const upd = () => { el.querySelector("#lv").textContent = v + "x"; el.querySelector("#lr").value = v; el.querySelector("#lmx").textContent = money(Math.min(5e6, store.wb("futures") * v)) + " USDT"; };
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
  function assetSheet(){
    const cur = s.settings.futp?.asset || "single", opt = (k, n, ch, pts) => `<button class="as-o${k === cur ? " on" : ""}" data-as="${k}"><span class="as-c">${ch}</span><div class="grow"><b>${n}</b><ul>${pts.map(x => `<li>${x}</li>`).join("")}</ul></div><i class="as-r"></i></button>`;
    U.sheet("Asset Mode", `${opt("single", "Single-Asset Mode", "S", ["Margin is the contract's own settlement asset", "PnL from one contract does not offset another", "Simple, predictable risk per position"])}
      ${opt("multi", "Multi-Assets Mode", "M", ["Use several assets as shared margin", "Unrealized profit from one position supports others", "Cross margin only, positions are more interdependent"])}
      <p class="rz-n">Switching is only possible while you have no open positions or orders.</p>
      <button class="btn btn-primary btn-block btn-lg" data-ok>Confirm</button>`, el => {
      let v = cur; el.querySelectorAll("[data-as]").forEach(b => b.onclick = () => { v = b.dataset.as; el.querySelectorAll("[data-as]").forEach(x => x.classList.toggle("on", x === b)); });
      el.querySelector("[data-ok]").onclick = () => {
        if (v !== cur && (s.fut.positions.length || s.fut.orders.length)){ toast("Close all positions and orders before switching the asset mode", "bad"); return; }
        s.settings.futp = s.settings.futp || {}; s.settings.futp.asset = v; store.save(); U.closeLayer(); renderForm(); if (v !== cur) toast(v === "multi" ? "Multi-Assets Mode enabled" : "Single-Asset Mode enabled", "ok"); };
    });
  }
  /* --- order book --- */
  let fundEnd = 0;
  let prec = 0;   // 0 = native tick; else aggregation step
  function aggBook(rows, step, isBid){ if (!step) return rows; const m = new Map(); rows.forEach(([px, q]) => { const k = (isBid ? Math.floor(+px / step) : Math.ceil(+px / step)) * step; m.set(k, (m.get(k) || 0) + +q); });
    return [...m.entries()].sort((a, b) => isBid ? b[0] - a[0] : a[0] - b[0]).map(([k, q]) => [k, q]); }
  function precSheet(){ const p = P(), t = Math.pow(10, -(p.dp ?? 2)), opts = [0, t * 10, t * 100, t * 1000];
    U.sheet("Select Precision", opts.map(v => `<button class="list-item prec-o" style="width:100%" data-pr="${v}"><span class="grow num">${v ? M.fmtPx(p, v) : M.fmtPx(p, t)}</span>${v === prec ? ic("check", 18) : ""}</button>`).join(""), el => el.querySelectorAll("[data-pr]").forEach(b => b.onclick = () => { prec = +b.dataset.pr; U.closeLayer(); renderBook(); })); }
  function renderBook(){
    const p = P(), box = $("#fbook"); if (!box) return;
    const now = new Date(), h = now.getUTCHours(), next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), (Math.floor(h/8)+1)*8));
    fundEnd = next.getTime(); const left = Math.max(0, (fundEnd - Date.now())/1000);
    let bids = aggBook(M.book.bids, prec, true).slice(0, 6), asks = aggBook(M.book.asks, prec, false).slice(0, 6).reverse();
    if (p.type !== "crypto" && p.price){ const st = Math.pow(10, -p.dp); bids = [...Array(6)].map((_,i) => [p.price - st*(i+1), 0]); asks = [...Array(6)].map((_,i) => [p.price + st*(6-i), 0]).reverse().reverse(); }
    const val = r => +r[0] * +r[1], mx = Math.max(1, ...bids.map(val), ...asks.map(val)), v = x => x ? CH.fmtVol(x) : "--";
    // mark rows where your own open limit orders sit (bucketed to the nearest visible level)
    const myO = s.fut.orders.filter(o => o.sym === sym).map(o => o.price), all = [...asks, ...bids].map(r => +r[0]);
    const lo = Math.min(...all), hi = Math.max(...all), half = all.length > 1 ? Math.abs(all[0] - all[1]) / 2 : 0;
    const outside = myO.filter(x => !(x >= lo - half && x <= hi + half)).length;
    const marked = new Set(myO.filter(x => x >= lo - half && x <= hi + half).map(x => all.reduce((b, y) => Math.abs(y - x) < Math.abs(b - x) ? y : b, all[0])));
    const mine = r => marked.has(+r[0]);
    const tb = bids.reduce((a,b) => a + val(b), 0), ta = asks.reduce((a,b) => a + val(b), 0), bp = tb + ta ? tb/(tb+ta)*100 : 50;
    box.innerHTML = `<div class="fund" data-info="funding"><u>Funding (8h) / Countdown</u><br><b class="num">0.0100%/${String(Math.floor(left/3600)).padStart(2,"0")}:${String(Math.floor(left%3600/60)).padStart(2,"0")}:${String(Math.floor(left%60)).padStart(2,"0")}</b></div>
      <div class="fh"><span>Price<br>(USDT)</span><span>Amount<br>(USDT)</span></div>
      ${asks.length ? asks.map((a, i) => `<div class="r${mine(a, asks, i, true) ? " me" : ""}" data-bp="${+a[0]}"><i style="width:${val(a)/mx*100}%;background:var(--down)"></i><span class="down">${M.fmtPx(p,+a[0])}</span><span>${v(val(a))}</span></div>`).join("") : '<div class="skel" style="height:110px"></div>'}
      <div class="mid"><b class="num ${p.dir>=0?"up":"down"}">${M.fmtPx(p)}</b><small class="num">${M.fmtPx(p)}</small></div>
      ${bids.map((b, i) => `<div class="r${mine(b, bids, i, false) ? " me" : ""}" data-bp="${+b[0]}"><i style="width:${val(b)/mx*100}%;background:var(--up)"></i><span class="up">${M.fmtPx(p,+b[0])}</span><span>${v(val(b))}</span></div>`).join("")}${outside ? `<div class="ob-out">${ic("info",11)} ${outside} of your orders outside the visible book</div>` : ""}<div class="ob-foot"><button class="ob-prec" data-prec><span class="num">${M.fmtPx(p, prec || Math.pow(10, -(p.dp ?? 2)))}</span>${ic("chevd",13)}</button><span class="ob-src">${p.type === "crypto" ? "Binance" : "Indicative"}</span></div>
      <div class="ratio num" style="margin:8px 0 0;font-size:11.5px"><span class="up">${bp.toFixed(2)}%</span><div class="bar" style="height:4px"><i style="width:${bp}%;background:var(--up)"></i><i style="flex:1;background:var(--down)"></i></div><span class="down">${(100-bp).toFixed(2)}%</span></div>`;
    const ch = $("#fchg"); ch.textContent = p.closed ? "Market closed" : p.chg == null ? "" : pct(p.chg); ch.className = "num " + (p.closed ? "brand-c" : (p.chg||0) < 0 ? "down" : "up");
  }
  /* --- positions --- */
  function setPtab(k){ ptab = k; sessionStorage.setItem("fx_ptab", k); root.querySelectorAll("[data-pt]").forEach(b => b.classList.toggle("on", b.dataset.pt === k)); $("#ptools").classList.toggle("hide", k === "hist"); renderPositions(); }
  function posCard(pos){
    const p = M.get(pos.sym);
    return `<div class="pc" data-id="${pos.id}"><div class="pc-h"><span class="side-b ${pos.side==="long"?"l":"s"}">${pos.side==="long"?"L":"S"}</span><button class="sym" data-open="${pos.sym}">${esc(fsym(p))}</button><span class="perp">Perp</span><span class="perp">${pos.mode === "isolated" ? "Isolated" : "Cross"} ${pos.lev}x</span><span class="bars-i" data-mrb data-lv="1"><i></i><i></i><i></i><i></i></span>${pos.source === "auto" || pos.auto ? '<span class="perp auto">Auto</span>' : ""}</div>
      <div class="pc-big"><div><span><u data-info="pnl">PNL (USDT)</u> <button data-share="${pos.id}" aria-label="Share">${ic("share",15)}</button></span><b class="num" data-pnl></b></div><div style="text-align:right"><span style="justify-content:flex-end"><u data-info="roi">ROI</u></span><b class="num" data-roe></b></div></div>
      <div class="pc-g"><div><span data-info="size"><u>Size (USDT)</u></span><b class="num" data-size></b></div><div><span data-info="margin">Margin (USDT)</span><b class="num">${money(pos.margin)}</b></div><div><span data-info="mr"><u>Margin Ratio</u></span><b class="num" data-mr></b></div>
        <div><span data-info="entry"><u>Entry Price (USDT)</u></span><b class="num">${M.fmtPx(p, pos.entry)}</b></div><div><span data-info="mark"><u>Mark Price (USDT)</u></span><b class="num" data-mark></b></div><div><span data-info="liq"><u>Liq. Price (USDT)</u></span><b class="num ${pos.liq > 0 ? "liq" : "down"}">${pos.liq > 0 ? M.fmtPx(p, pos.liq) : "--"}</b></div></div>
      <div class="pc-tp" data-info="tpsl"><span>TP/SL</span><b class="num"><em class="up">${pos.tp ? M.fmtPx(p,pos.tp) : "--"}</em><i>/</i><em class="down">${pos.sl ? M.fmtPx(p,pos.sl) : "--"}</em></b></div>
      ${FP.showRz === false ? "" : `<button class="rpnl" data-rz="${pos.id}"><span>Realized PNL (USDT)</span><b class="num ${(pos.realized||0)>=0?"up":"down"}">${signed(pos.realized || 0)} ${ic("chev",13)}</b></button>`}
      <div class="pc-btns"><button data-plev="${pos.id}">Leverage</button><button data-tpsl="${pos.id}">TP/SL</button><button data-close="${pos.id}">Close</button></div></div>`;
  }
  function sortPos(arr){
    const a = arr.slice().reverse(), {by, dir} = sortCfg; if (by === "default") return dir === "asc" ? arr.slice() : a;
    const key = { time: x => x.open || 0, symbol: x => x.sym, roi: x => E.futPnl(x).roe, size: x => E.futPnl(x).size, risk: x => E.futPnl(x).mr }[by] || (x => 0);
    return a.sort((x, y) => { const kx = key(x), ky = key(y), c = typeof kx === "string" ? kx.localeCompare(ky) : kx - ky; return dir === "asc" ? c : -c; });
  }
  function sortSheet(){
    const d = {...sortCfg}, by = [["default","Default"],["time","Update Time"],["symbol","Symbol"],["roi","ROI"],["size","Size"],["risk","Risk Ratio"]];
    U.sheet("Sorting", `<div class="srt-l">Sort By</div><div class="srt-g">${by.map(([k,n]) => `<button data-by="${k}">${n}</button>`).join("")}</div>
      <div class="srt-l">Order</div><div class="srt-g two"><button data-dir="asc">Ascending</button><button data-dir="desc">Descending</button></div>
      <div class="srt-f"><button class="btn btn-ghost btn-lg" data-reset>Reset</button><button class="btn btn-primary btn-lg" data-ok>Confirm</button></div>`, el => {
      const paint = () => { el.querySelectorAll("[data-by]").forEach(b => b.classList.toggle("on", b.dataset.by === d.by)); el.querySelectorAll("[data-dir]").forEach(b => b.classList.toggle("on", b.dataset.dir === d.dir)); };
      el.querySelectorAll("[data-by]").forEach(b => b.onclick = () => { d.by = b.dataset.by; paint(); });
      el.querySelectorAll("[data-dir]").forEach(b => b.onclick = () => { d.dir = b.dataset.dir; paint(); });
      el.querySelector("[data-reset]").onclick = () => { d.by = "default"; d.dir = "desc"; paint(); };
      el.querySelector("[data-ok]").onclick = () => { sortCfg = d; try { sessionStorage.setItem("fx_sort", JSON.stringify(d)); } catch {} U.closeLayer(); renderPositions(); };
      paint();
    });
  }
  function tifSheet(){
    const o = [["GTC","Good Till Cancelled"],["IOC","Immediate or Cancel"],["FOK","Fill or Kill"],["GTD","Good Till Date"]];
    U.sheet("Time in Force", `<div class="tif-l">${o.map(([k,n]) => `<button class="tif-c${k === tif ? " on" : ""}" data-tf="${k}"><b>${k}</b><small>${n}</small></button>`).join("")}</div>`, el => el.querySelectorAll("[data-tf]").forEach(b => b.onclick = () => { tif = b.dataset.tf; U.closeLayer(); renderForm(); }));
  }
  function renderPositions(){
    const list = $("#plist"); if (!list) return;
    const pos = s.fut.positions.filter(x => !hideOther || x.sym === sym), ord = s.fut.orders.filter(x => !hideOther || x.sym === sym);
    $("#pc").textContent = s.fut.positions.length; $("#oc").textContent = s.fut.orders.length; { const ca = $("[data-closeall]"); if (ca) ca.textContent = s.fut.positions.length ? `Close All (${s.fut.positions.length})` : "Close All"; }
    if (ptab === "pos"){ list.innerHTML = pos.length ? sortPos(pos).map(posCard).join("") : UI.emptyState("file", "No open positions"); tickPositions(); }
    else if (ptab === "ord") list.innerHTML = ord.length ? ord.map(o => { const p = M.get(o.sym); return `<div class="pc"><div class="pc-h"><span class="side-b ${o.side==="long"?"l":"s"}">${o.side==="long"?"B":"S"}</span><b class="sym">${esc(fsym(p))}</b><span class="perp">Perp</span><span class="perp">Limit</span><span class="perp">${esc(o.tif || "GTC")}</span><span class="grow"></span><button class="btn btn-ghost btn-sm" data-cancel="${o.id}">Cancel</button></div>
      <div class="ph-g"><div><span>Price</span><b class="num">${M.fmtPx(p,o.price)}</b></div><div><span>Amount (USDT)</span><b class="num">${money(o.margin*o.lev)}</b></div><div><span>Leverage</span><b>${o.lev}x</b></div><div><span>TP / SL</span><b class="num">${o.tp?M.fmtPx(p,o.tp):"--"} / ${o.sl?M.fmtPx(p,o.sl):"--"}</b></div><div><span>Side</span><b class="${o.side==="long"?"up":"down"}">${o.side==="long"?"Open Long":"Open Short"}</b></div><div><span>Time in Force</span><b>${esc(o.tif || "GTC")}</b></div><div><span>Time</span><b>${U.timeStr(o.t)}</b></div></div></div>`; }).join("") : UI.emptyState("file", "No open orders");
    else list.innerHTML = historyHtml(s.fut.history.slice(0, 60));
  }
  function tickPositions(){
    if (ptab !== "pos" || !root) return;
    s.fut.positions.forEach(pos => {
      const r = root.querySelector(`.pc[data-id="${pos.id}"]`); if (!r) return;
      const {pnl, roe, px, size, mr} = E.futPnl(pos), p = M.get(pos.sym), c = pnl >= 0 ? "up" : "down";
      const a = r.querySelector("[data-pnl]"), b = r.querySelector("[data-roe]"); a.textContent = signed(pnl); b.textContent = signed(roe) + "%"; a.className = b.className = "num " + c;
      r.querySelector("[data-size]").textContent = money(size); r.querySelector("[data-mark]").textContent = M.fmtPx(p, px);
      const m = r.querySelector("[data-mr]"); m.textContent = mr.toFixed(2) + "%"; m.className = "num " + (mr < 50 ? "up" : mr < 80 ? "warn-c" : "down");
      const mb = r.querySelector("[data-mrb]"); mb.style.color = mr < 50 ? "var(--up)" : mr < 80 ? "var(--warn)" : "var(--down)"; mb.dataset.lv = mr < 25 ? 1 : mr < 50 ? 2 : mr < 80 ? 3 : 4;
    });
  }
  function tpslSheet(id){
    const pos = s.fut.positions.find(x => x.id === id); if (!pos) return; const p = M.get(pos.sym), long = pos.side === "long";
    const roiOf = px => px ? E.futPnl(pos, px).pnl / pos.margin * 100 : 0;
    const pxOf = roi => { const d = roi / 100 * pos.margin / pos.qty; return pos.entry + (long ? d : -d); };
    const blk = (k, n, max) => `<div class="ts-b" data-k="${k}"><div class="ts-h"><b>${n}</b><button class="icon-btn" data-del="${k}" aria-label="Clear ${n}">${ic("trash",16)}</button></div>
      <div class="ts-in"><label><small>Trigger Price</small><input type="number" inputmode="decimal" data-px="${k}" placeholder="--"></label><span class="ts-u">Mark</span>
        <label class="ts-roi"><small>ROI</small><input type="number" inputmode="decimal" data-roi="${k}" placeholder="--"></label><span class="ts-u">%</span></div>
      <div class="dslider ts-sl"><div class="tr"></div><div class="fl" data-fl="${k}"></div>${[0, 20, 100].map(v => `<i class="nd" style="left:${v}%"></i>`).join("")}<div class="th" data-th="${k}"></div><input type="range" min="0" max="${max}" step="1" value="0" data-r="${k}" aria-label="${n} ROI"></div>
      <div class="ts-ticks"><span>0%</span><span style="left:20%">${Math.round(max*.2)}%</span><span>${max}%</span></div>
      <p class="ts-note" data-note="${k}"></p></div>`;
    U.sheet("TP/SL", `<div class="ts-pos"><b>${esc(fsym(p))}</b><span class="ls ${long ? "long" : "short"}">${long ? "Long" : "Short"}</span><span class="perp">${pos.mode === "isolated" ? "Isolated" : "Cross"}</span><span class="perp">${pos.lev}x</span></div>
      <div class="ts-g"><div><small>Amount (USDT)</small><b class="num">${money(pos.qty * pos.entry)}</b></div><div><small>Entry price</small><b class="num">${M.fmtPx(p, pos.entry)}</b></div><div><small>Last price</small><b class="num">${M.fmtPx(p)}</b></div><div><small>Est. liq. price</small><b class="num" style="color:var(--warn)">${pos.liq > 0 ? M.fmtPx(p, pos.liq) : "--"}</b></div></div>
      ${blk("tp", "TP", 150)}${blk("sl", "SL", 75)}
      <div class="err-msg" id="te"></div><button class="btn btn-primary btn-block btn-lg" data-ok>OK</button>`, el => {
      const v = {tp: pos.tp || null, sl: pos.sl || null};
      const paint = (k, from) => {
        const px = v[k], roi = px ? roiOf(px) : null, max = k === "tp" ? 150 : 75, mag = roi == null ? 0 : U.clamp(Math.abs(roi), 0, max);
        if (from !== "px") el.querySelector(`[data-px="${k}"]`).value = px ? M.fmtPx(p, px).replace(/,/g, "") : "";
        if (from !== "roi") el.querySelector(`[data-roi="${k}"]`).value = roi == null ? "" : roi.toFixed(2);
        if (from !== "r") el.querySelector(`[data-r="${k}"]`).value = mag;
        el.querySelector(`[data-fl="${k}"]`).style.width = el.querySelector(`[data-th="${k}"]`).style.left = (mag / max * 100) + "%";
        const est = px ? E.futPnl(pos, px).pnl : null;
        el.querySelector(`[data-note="${k}"]`).innerHTML = px ? `When the Mark Price reaches <b class="num">${M.fmtPx(p, px)}</b>, it will trigger a <u>${k.toUpperCase()} Market Order</u> and the estimated PnL is <b class="num ${est >= 0 ? "up" : "down"}">${signed(est)} USDT (${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%)</b>.` : `Set a trigger price or drag the slider to set ${k === "tp" ? "take profit" : "stop loss"} by ROI.`;
      };
      ["tp","sl"].forEach(k => {
        el.querySelector(`[data-px="${k}"]`).oninput = e => { v[k] = parseFloat(e.target.value) || null; paint(k, "px"); };
        el.querySelector(`[data-roi="${k}"]`).oninput = e => { const r = parseFloat(e.target.value); v[k] = isNaN(r) ? null : pxOf(k === "sl" ? -Math.abs(r) : Math.abs(r)); paint(k, "roi"); };
        el.querySelector(`[data-r="${k}"]`).oninput = e => { const r = +e.target.value; v[k] = r ? pxOf(k === "sl" ? -r : r) : null; paint(k, "r"); };
        el.querySelector(`[data-del="${k}"]`).onclick = () => { v[k] = null; paint(k); };
        paint(k);
      });
      el.querySelector("[data-ok]").onclick = () => { const e = E.setTpSl(id, v.tp ? +(+v.tp).toFixed(p.dp) : null, v.sl ? +(+v.sl).toFixed(p.dp) : null); if (e){ el.querySelector("#te").textContent = e; return toast(e, "bad"); } E.award("tpsl"); U.closeLayer(); U.fx("notify"); toast("TP/SL updated", "ok"); };
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
    if (UI.sharePnl) return UI.sharePnl({sym:pos.sym, label:fsym(p), side:pos.side, lev:pos.lev, mode:pos.mode, roi:roe, pnl, entry:pos.entry, mark:p.price, product:"Futures", time:Date.now()});
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
    if (!$("#cch")) return; chartOpen = !chartOpen; $("#cch").classList.toggle("open", chartOpen); sessionStorage.setItem("fx_chart", chartOpen ? "1" : "0");
    if (chartOpen && !unChart){ unChart = bindChart(root, sym, "tf_fut", "15m", candleDetail(sym), {mini:true, tfs:MINI_TFS}); }
    else setTimeout(CH.resize, 60);
  }
  /* Realized PnL breakdown: where the money went and how much % of margin */
  function rzSheet(id){
    const pos = s.fut.positions.find(x => x.id === id) || s.fut.history.find(x => x.id === id); if (!pos) return;
    const rz = pos.rz || {openFee: pos.fee || 0, closeFee:0, closePnl:0, funding:0}, total = pos.realized ?? pos.profit ?? 0;
    const row = (k, v, cls) => `<div class="rz-r"><span>${k}</span><b class="num ${cls || ""}">${signed(v)} USDT</b></div>`;
    const fee = rz.openFee + rz.closeFee, qty = pos.qty ?? pos.maxQty ?? pos.closedVol ?? 0, px = pos.exit ?? M.get(pos.sym)?.price ?? pos.entry, vol = pos.closeNotional > 0 ? pos.closeNotional : (pos.margin * pos.lev || qty * px), tf = C.FEE * 100;
    const pc = n => (+n).toFixed(3).replace(/0$/, "");
    const cmp = [["Binance", 0.05, 0.02], ["Bybit", 0.055, 0.02], ["OKX", 0.05, 0.02]].map(([n, tk, mk]) => [n, tk, mk, vol * 2 * tk / 100]);
    U.sheet("Realized PNL", `<div class="rz-r big"><span>Realized PNL</span><b class="num ${total >= 0 ? "up" : "down"}">${signed(total)} USDT</b></div>
      ${row("Closing PNL", rz.closePnl)}${row("Funding Fee", rz.funding)}${row("Trading Fee", -fee)}${row("Insurance Clear Fee", 0)}
      <div class="rz-fee"><b>Fee applied</b><p>Trading Fee ${tf.toFixed(2)}% taker on ${money(vol)} size = <b class="num down">${signed(-fee)} USDT</b></p><small>${tf.toFixed(2)}% is charged on the notional value at open and again at close.</small></div>
      <div class="rz-cmp"><b>Fee comparison</b><small>Same round trip (open + close) of ${money(vol)} USDT, taker orders</small>
        <div class="rz-ch"><span>Exchange</span><span>Taker / Maker</span><span>Fee</span></div>
        <div class="rz-cr me"><span>${esc(C.APP_NAME || "NovaTrade")}</span><span class="num">${tf.toFixed(2)}% / 0.02%</span><b class="num">${money(vol * 2 * tf / 100)}</b></div>
        ${cmp.map(([n, tk, mk, f]) => `<div class="rz-cr"><span>${n}</span><span class="num">${pc(tk)}% / ${pc(mk)}%</span><b class="num">${money(f)}</b></div>`).join("")}
      </div>
      <div class="rz-t"><span>Display realized PNL in positions</span><button class="fsw${FP.showRz !== false ? " on" : ""}" role="switch" aria-checked="${FP.showRz !== false}" data-rzt><i></i></button></div>
      <p class="rz-n">* For positions opened before January 1, 2026, the data will be displayed as -. In exceptional circumstances, funding fees charged or paid after a position is closed may not be included. Other exchanges' rates are standard published base tiers, shown for comparison only.</p>`, el => {
      el.querySelector("[data-rzt]").onclick = e => { const b = e.currentTarget, v = !b.classList.contains("on"); b.classList.toggle("on", v); b.setAttribute("aria-checked", v); s.settings.futp.showRz = v; FP.showRz = v; store.save(); renderPositions(); };
    });
  }


  return {html, title: fsym(P()) + " Futures", mount(r){
    root = r; M.watchTrades(sym);
    renderForm(); renderBook(); setPtab(ptab);
    if (kl === "bottom"){ if ($("#cch").classList.contains("open")){ chartOpen = false; toggleChart(); } $("[data-cch]").onclick = toggleChart; }
    else if (kl === "top") unChart = bindChart(root, sym, "tf_fut", "15m", candleDetail(sym), {mini:true, tfs:MINI_TFS});
    $("[data-pick]").onclick = () => pickSheet(sym, x => location.hash = "#/futures/" + x);
    $("[data-menu]").onclick = () => U.sheet("", [["ring","Price alert", () => alertSheet(sym)],["candle","Chart", () => location.hash = "#/chart/" + sym],["history","Position history", () => location.hash = "#/history"],["percent","Futures calculator", calcSheet],["gear","Preferences", () => location.hash = "#/preferences"]].map(([i,n],k) => `<button class="list-item" style="width:100%" data-k="${k}"><span class="ic">${ic(i,18)}</span><span class="grow">${n}</span>${ic("chev",16)}</button>`).join(""), el => {
      const acts = [() => alertSheet(sym), () => location.hash = "#/chart/" + sym, () => location.hash = "#/history", calcSheet, () => location.hash = "#/preferences"];
      el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { U.closeLayer(); setTimeout(acts[+b.dataset.k], 300); }); });
    root.querySelectorAll("[data-oc]").forEach(b => b.onclick = () => { oc = b.dataset.oc; root.querySelectorAll("[data-oc]").forEach(x => x.classList.toggle("on", x===b)); $("#amt").value = ""; sliderPct = 0; $("#sl").value = 0; renderForm(); });
    $("[data-mode]").onclick = modeSheet; $("[data-lev]").onclick = () => levSheet(); $("[data-asset]").onclick = assetSheet;
    $("[data-otype]").onclick = () => U.sheet("Order type", [["market","Market","Executes immediately at the best available price."],["limit","Limit","Executes at your price or better."]].map(([k,n,d]) => `<button class="list-item" style="width:100%" data-ot="${k}"><div class="grow"><b>${n}</b><div class="label">${d}</div></div>${otype===k?`<span class="brand-c">${ic("check",18)}</span>`:""}</button>`).join(""), el => el.querySelectorAll("[data-ot]").forEach(b => b.onclick = () => { otype = b.dataset.ot; if (otype === "limit" && !$("#lp").value) $("#lp").value = +P().price.toFixed(P().dp); U.closeLayer(); renderForm(); }));
    const sl = $("#sl"); let lastSnap = 0;
    sl.oninput = () => { const v = +sl.value, snap = [0,25,50,75,100].find(x => Math.abs(x - v) <= 2); sliderPct = snap ?? v; if (snap != null && snap !== v) sl.value = snap;
      if (snap != null && snap !== lastSnap && LY.slideVib !== false) navigator.vibrate?.(8); lastSnap = snap;
      $("#amt").value = sliderPct ? fromU(oc === "open" ? Math.floor(store.wb("futures") / (1/lev + C.FEE) * sliderPct) / 100 : sliderPct) : ""; renderForm(); };
    $("[data-bbo]").onclick = () => { const p = P(), b = bboSide === "bid" ? M.book.bids?.[0] : M.book.asks?.[0], v = b ? +b[0] : p.price; $("#lp").value = +(+v).toFixed(p.dp ?? 2); toast(`BBO · best ${bboSide} ${M.fmtPx(p, v)}`, "info", 1200); bboSide = bboSide === "bid" ? "ask" : "bid"; renderForm(); };
    $("[data-tif]").onclick = tifSheet; $("[data-sort]").onclick = sortSheet;
    $("#amt").addEventListener("input", () => { $("#ferr").textContent = ""; $("#af").classList.remove("err"); const v = inputs().amt; sliderPct = oc === "open" ? U.clamp(v / (store.wb("futures") / (1/lev + C.FEE)) * 100, 0, 100) : U.clamp(v, 0, 100); renderForm(); });
    $("#lp").addEventListener("input", renderForm);
    $("#tpc").onchange = e => { tpsl = e.target.checked; $("#tpsl").classList.toggle("hide", !tpsl); $("#tsm").classList.toggle("hide", !tpsl); };
    const tsHint = () => { if (tsMode !== "roi"){ $("#tsh").innerHTML = ""; return; } const p = P(), ep = parseFloat($("#lp").value) || p.price, t = parseFloat($("#tp").value), sv = Math.abs(parseFloat($("#sl2").value)), f = (r, up) => r > 0 ? M.fmtPx(p, ep * (1 + (up ? 1 : -1) * r / 100 / lev)) : "--";
      $("#tsh").innerHTML = `<div>Long: TP <b class="up">${f(t, true)}</b> · SL <b class="down">${f(sv, false)}</b></div><div>Short: TP <b class="up">${f(t, false)}</b> · SL <b class="down">${f(sv, true)}</b></div>`; };
    $("#tsm").onclick = () => { tsMode = tsMode === "roi" ? "price" : "roi"; $("#tsm span").textContent = tsMode === "roi" ? "Price" : "ROI %"; $("#tp").placeholder = tsMode === "roi" ? "TP ROI %" : "Take Profit"; $("#sl2").placeholder = tsMode === "roi" ? "SL ROI %" : "Stop Loss"; $("#tpsl").querySelectorAll(".famt span").forEach(x => x.textContent = tsMode === "roi" ? "%" : "Mark"); $("#tp").value = $("#sl2").value = ""; tsHint(); };
    $("#tp").addEventListener("input", tsHint); $("#sl2").addEventListener("input", tsHint);
    root.querySelectorAll("[data-go]").forEach(b => b.onclick = () => submit(b.dataset.go));
    root.querySelectorAll("[data-cls]").forEach(b => b.onclick = () => closeSide(b.dataset.cls));
    root.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => setPtab(b.dataset.pt));
    $("#hide").onchange = e => { hideOther = e.target.checked; try { sessionStorage.setItem("fx_hide", hideOther ? "1" : "0"); } catch {} renderPositions(); };
    $("[data-closeall]").onclick = async () => { if (!s.fut.positions.length) return toast("No open positions", "info"); if (await U.confirmTrade({kind:"close", title:"Close All Positions", tone:"down", okText:"Close All", rows:[["Positions", String(s.fut.positions.filter(x => !hideOther || x.sym === sym).length)], ["Price", "Market"], ["Total est. PNL", (() => { const v = s.fut.positions.filter(x => !hideOther || x.sym === sym).reduce((a, x) => a + E.futPnl(x).pnl, 0); return `<span class="${v >= 0 ? "up" : "down"}">${signed(v)} USDT</span>`; })()]]})){ [...s.fut.positions].filter(x => !hideOther || x.sym === sym).forEach(x => E.closeFut(x.id)); U.fx("open"); toast("All positions closed", "ok"); } };

    $("#fbook").addEventListener("click", e => { if (e.target.closest("[data-prec]")) return precSheet(); const r = e.target.closest("[data-bp]"); if (!r || !FP.tapFill) return; otype = "limit"; $("#lp").value = r.dataset.bp; renderForm(); toast("Limit price set to " + M.fmtPx(P(), +r.dataset.bp), "info", 1200); });
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
Object.assign(window.UI, {bindChart, miniChartBlock, pickSheet, alertSheet, candleDetail, MINI_TFS});

/* ---------------- Binary Options (#/trade/SYM) ---------------- */
Pages.trade = (params) => {
  let sym = resolveSym(params, "lastSym_binary");
  if (!M.get(sym)) return M.cryptoOrder.length ? Pages.notfound() : loadingPage("Binary");
  sessionStorage.setItem("lastSym_binary", sym);
  const s = S(), P = () => M.get(sym);
  let root, offs = [], timers = [], unChart, exp = s.settings.defExp || 30, ptab = "pos", cdLast = {};
  const $ = q => root.querySelector(q);
  const html = `<div class="bin-page">
  <div class="tabs" style="gap:20px;margin:0 -16px;padding:4px 16px 0;border:0"><a class="tab" href="#/futures/${sym}" style="font-size:17px">USDⓈ-M</a><a class="tab" href="#/spot/${sym}" style="font-size:17px">Spot</a><button class="tab on" style="font-size:17px">Binary</button><a class="tab" href="#/options" style="font-size:17px">Options</a><a class="tab" href="#/copy" style="font-size:17px">Copy</a><a class="tab" href="#/bots" style="font-size:17px">Bots</a></div>
  <header class="fx-head"><div class="grow"><button class="nm" data-pick>${esc(M.label(P()))} ${P().tradable ? `<span class="perp" style="color:var(--up)" id="hpp">92%</span>` : `<span class="perp">Chart only</span>`}${ic("chevd",16)}</button></div>
    <button class="icon-btn" data-alert aria-label="Price alert">${ic("bell",22)}</button><a class="icon-btn" href="#/chart/${sym}" aria-label="Full chart">${ic("candle",22,1.6)}</a></header>
  <div class="cp-price" style="border:0;padding-top:6px"><div><div class="lp" id="lp">--</div><div class="row num" style="gap:6px;font-size:13px"><b id="lusd"></b><span id="lc"></span></div></div>
    <div class="k"><span>24h High</span><b id="hi"></b><span>24h Low</span><b id="lo"></b><span>Sentiment</span><b id="sen"></b></div></div>
  ${chartBlock()}
  <section class="bx">
    <div class="bx2">
      <div class="bx-bet" id="af">
        <div class="bb-top"><button class="bx-step" data-minus aria-label="Decrease amount">${ic("minus",15,2.4)}</button>
          <label class="bb-in"><small>Bet amount</small><span class="bb-v"><input id="amt" type="number" inputmode="decimal" min="0.1" step="0.1" aria-label="Amount in USDT"><em>USDT</em></span></label>
          <button class="bx-step" data-plus aria-label="Increase amount">${ic("plus",15,2.4)}</button><button class="bb-max" data-v="max">MAX</button></div>
        <div class="bb-chips" id="qa">${[0.1,0.5,1,2,5,10].map(v => `<button data-v="${v}">${v}</button>`).join("")}</div>
      </div>
      <div class="bx-pay"><small>Payout (win)</small><b class="num" id="po"></b><span class="pp" id="ppct"></span></div>
    </div>
    <div class="bx-trow"><div class="bx-tl">Time period</div>
    <div class="bx-time" id="exps">${C.EXPIRIES.map(x => `<button class="exp-chip" data-e="${x}"><b>${x<60?x+"s":x/60+"m"}</b></button>`).join("")}</div></div>
    <div class="ud"><button class="btn btn-up" data-dir="up"><span class="row" style="gap:4px">${ic("up",18,3)} ${esc(t("Up"))}</span><small id="upP"></small></button><button class="btn btn-down" data-dir="down"><span class="row" style="gap:4px">${ic("down",18,3)} ${esc(t("Down"))}</span><small id="dnP"></small></button></div>
    <div class="bx-meta"><span>Avbl <b class="num" id="ob"></b> USDT <button class="wl-plus" data-wlto="binary" aria-label="Transfer in">${ic("plus",12,3)}</button></span><span class="label">Min 0.1 · Max 5,000 USDT</span></div>
    <div id="note" style="margin-top:8px"></div><div class="err-msg" id="err" role="alert"></div>
  </section>
  <div class="ptabs" style="margin-top:0"><button class="on" data-pt="pos">Positions (<span id="pc">0</span>)</button><button data-pt="hist">History</button></div>
  <div id="plist"></div></div>`;

  function renderPx(){
    const p = P(), el = $("#lp"); if (!el) return;
    el.textContent = M.fmtPx(p); el.className = "lp " + (p.dir >= 0 ? "up" : "down"); $("#lusd").textContent = "$" + usdPx(p);
    const lc = $("#lc"); lc.className = "num " + ((p.chg||0) < 0 ? "down" : "up"); lc.textContent = p.closed ? t("Market closed") : p.chg == null ? "" : pct(p.chg);
    $("#hi").textContent = M.fmtPx(p, p.high); $("#lo").textContent = M.fmtPx(p, p.low);
    const m = M.momentum(sym, 60000), up = Math.round(U.clamp(50 + m*30 + U.clamp(p.chg||0,-5,5)*2, 6, 94)); $("#sen").innerHTML = `<span class="up">${up}%</span> / <span class="down">${100-up}%</span>`;
    const fs = $("#fsp"); if (fs){ fs.textContent = M.fmtPx(p); $("#fsl").textContent = M.label(p); }
  }
  function renderOrder(){
    const p = P(), a = parseFloat($("#amt").value) || 0;
    const pp = E.payoutOf(sym, exp), pct = Math.round(pp * 100) + "%";
    $("#ob").textContent = money(store.wb("binary")); $("#po").textContent = money(a * (1 + pp)) + " USDT"; $("#ppct").textContent = "+" + pct + " profit";
    root.querySelectorAll("[data-e]").forEach(b => b.classList.toggle("on", +b.dataset.e === exp));
    const hp = $("#hpp"); if (hp) hp.textContent = pct;
    root.querySelectorAll("#qa [data-v]").forEach(b => b.classList.toggle("on", +b.dataset.v === a));
    $("#upP").textContent = $("#dnP").textContent = pct + " · " + (exp < 60 ? exp + "s" : exp/60 + "m");
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
      rows:[["Amount", money(a) + " USDT"], ["Expiry", exp < 60 ? exp + "s" : exp/60 + " min"], ["Entry price", "Market (" + M.fmtPx(P()) + ")"], ["Payout if win", `<span class="up">${money(a * (1 + E.payoutOf(sym, exp)))} USDT (${Math.round(E.payoutOf(sym, exp) * 100)}%)</span>`], ["If lose", `<span class="down">-${money(a)} USDT</span>`]]})) return;
    const r = E.place(sym, dir, a, exp); if (r.err){ err.textContent = r.err; toast(r.err, "bad"); UI.walletErr(r.err); return; }
    err.textContent = ""; $("#af").classList.remove("err"); s.settings.defAmt = a; s.settings.defExp = exp; store.save();
    toast("Order placed successfully!", "ok"); U.fx("open"); setPtab("pos");
  }
  function setPtab(k){ ptab = k; root.querySelectorAll("[data-pt]").forEach(b => b.classList.toggle("on", b.dataset.pt === k)); renderPositions(); }
  function renderPositions(){
    const list = $("#plist"); $("#pc").textContent = s.positions.length;
    if (ptab === "pos"){
      list.innerHTML = s.positions.length ? s.positions.slice().reverse().map(pos => { const p = M.get(pos.sym); return `<div class="pc" data-id="${pos.id}"><div class="pc-h"><span class="side-b ${pos.dir==="up"?"l":"s"}">${pos.dir==="up"?"▲":"▼"}</span><button class="sym" data-open="${pos.sym}">${esc(M.label(p))}</button><span class="perp">${pos.dir==="up"?"Up":"Down"}</span><span class="perp">${pos.expiry<60?pos.expiry+"s":pos.expiry/60+"m"}</span>${pos.source==="auto"?'<span class="perp">Auto</span>':""}<span class="grow"></span><b class="num brand-c" data-cd></b></div>
        <div class="pc-g"><div><span>Amount (USDT)</span><b class="num">${money(pos.amount)}</b></div><div><span>Entry Price</span><b class="num">${M.fmtPx(p,pos.entry)}</b></div><div><span>PNL (USDT)</span><b class="num" data-pnl></b></div><div><span>Payout</span><b class="num">${money(pos.amount*E.RATIO)}</b></div><div><span>Mark Price</span><b class="num" data-now></b></div><div><span>Status</span><b data-st></b></div></div><div class="prog"><i data-pg></i></div>
        <div class="bin-ec"><div class="ec-i"><span>Early close</span><small data-ecs></small></div><button class="ec-b" data-ec="${pos.id}" type="button" disabled>Close</button></div></div>`; }).join("") : UI.emptyState("file", "No open positions");
      tick();
    } else {
      const h = s.history.slice(0, 60);
      list.innerHTML = h.length ? h.map(x => { const p = M.get(x.sym) || {dp:2, type:"crypto", base:x.sym, quote:""}; return `<div class="pc"><div class="pc-h"><span class="side-b ${x.dir==="up"?"l":"s"}">${x.dir==="up"?"▲":"▼"}</span><span class="sym">${esc(M.label(p))}</span><span class="perp">${x.expiry<60?x.expiry+"s":x.expiry/60+"m"}</span><span class="grow"></span><span class="label">${x.early ? "Closed early" : x.result === "win" ? "Won" : x.result === "loss" ? "Lost" : "Refunded"}</span></div>
        <div class="ph-g"><div><span>Payout (USDT)</span><b class="num ${x.result==="win"?"up":x.result==="loss"?"down":""}">${money(x.credit ?? (x.result === "win" ? x.amount * (1 + (x.payout ?? C.PAYOUT)) : x.result === "loss" ? 0 : x.amount))}</b></div><div><span>Entry Price</span><b class="num">${M.fmtPx(p,x.entry)}</b></div><div><span>Close Price</span><b class="num">${M.fmtPx(p,x.exit)}</b></div></div><div class="ph-t"><span>Closed</span><b>${U.dateStr(x.closed)}</b></div></div>`; }).join("") : UI.emptyState("history", "No history");
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
      const ev = E.earlyValue(pos, now), eb = r.querySelector("[data-ec]"), es = r.querySelector("[data-ecs]");
      if (eb){ eb.disabled = !ev.open; eb.classList.toggle("lock", !ev.open); eb.classList.toggle("up", ev.open && ev.profit > 0); eb.classList.toggle("down", ev.open && ev.profit < 0);
        eb.textContent = !ev.open ? "Closing locked" : ev.profit > 0 ? "Close for +" + money(ev.profit) : "Close for " + money(ev.value);
        es.textContent = ev.open ? "Closable for " + mmss(ev.lockIn) : "Available in the first half only"; }
      const sc = Math.ceil(left); if (sc <= 5 && sc > 0 && cdLast[pos.id] !== sc && pos.sym === sym){ cdLast[pos.id] = sc; U.beep("tick"); } });
  }
  function showResult(rec){
    const p = M.get(rec.sym), w = rec.result === "win" && rec.profit > 0, l = rec.result === "loss", ttl = rec.early ? "Closed early" : w ? "You won!" : l ? "Trade lost" : "Draw — refunded";
    window.TX?.clearFx?.();
    if (w){ U.confetti(); U.fx("win"); window.TX?.flyMoney?.(); } else if (l) U.fx("loss");
    U.modal(`<div class="rs ${w?"w":l?"l":"d"}" data-rs><button class="rs-x" data-x aria-label="Close">${ic("x",18,2.2)}</button>
      <div class="res-ic ${w?"w":l?"l":"d"}">${ic(w?"trophy":l?"x":"reset",30)}</div><div class="rs-t">${ttl}</div>
      <div class="rs-a num ${w?"up":l?"down":""}">${signed(rec.profit)} USDT</div>
      <div class="rs-d">${esc(M.label(p))} · ${rec.dir==="up"?"Up":"Down"} · ${money(rec.amount)} USDT<br>Entry ${M.fmtPx(p, rec.entry)} → ${rec.early ? "Exit" : "Close"} ${M.fmtPx(p, rec.exit)}</div>
      <div class="rs-bar"><i></i></div><div class="rs-cd">Closing in <b>3</b>s</div></div>`, el => {
      const box = el.querySelector("[data-rs]"), t0 = Date.now(), cd = el.querySelector(".rs-cd b");
      const stop = () => clearInterval(iv), done = () => { stop(); window.TX?.clearFx?.(); rsBusy = false; setTimeout(nextResult, 350); }, iv = setInterval(() => {
        if (!box.isConnected || el.querySelector("[data-rs]") !== box) return done();
        const left = 3000 - (Date.now() - t0); cd.textContent = Math.max(1, Math.ceil(left / 1000));
        if (left <= 0){ U.closeLayer(); done(); } }, 100);
      el.querySelector("[data-x]").onclick = () => { U.closeLayer(); done(); }; });
  }
  let rsQ = [], rsBusy = false;
  function nextResult(){ if (rsBusy || !rsQ.length || !root) return; rsBusy = true; showResult(rsQ.shift()); }
  function result(rec){ rsQ.push(rec); nextResult(); }
  return {html, title: M.label(P()) + " Binary", mount(r){
    root = r; M.watchTrades(sym);
    $("#amt").value = s.settings.defAmt || 10;
    renderPx(); renderOrder(); setPtab("pos");
    CH.setBinExp(() => E.alignedExpiry(exp)); timers.push(() => CH.setBinExp(null));
    unChart = bindChart(root, sym, "tf_binary", "tick", candleDetail(sym, {html:`<button class="btn btn-up" data-q="up">Up</button><button class="btn btn-down" data-q="down">Down</button>`, bind: el => el.querySelectorAll("[data-q]").forEach(x => x.onclick = () => { U.closeLayer(); trade(x.dataset.q); })}));
    const amt = $("#amt");
    amt.addEventListener("input", () => { $("#err").textContent = ""; $("#af").classList.remove("err"); renderOrder(); });
    const stepOf = v => v < 1 ? 0.1 : v < 20 ? 1 : v < 100 ? 5 : v < 1000 ? 10 : 100;
    $("[data-minus]").onclick = () => { const v = parseFloat(amt.value) || 0; amt.value = Math.max(0.1, +(v - stepOf(v - 0.01)).toFixed(2)); renderOrder(); };
    $("[data-plus]").onclick = () => { const v = parseFloat(amt.value) || 0; amt.value = +Math.min(Math.floor(store.wb("binary")), v + stepOf(v)).toFixed(2) || 1; renderOrder(); };
    if ($("[data-half]")) $("[data-half]").onclick = () => { amt.value = Math.max(1, Math.floor((parseFloat(amt.value)||0) / 2 * 100) / 100); renderOrder(); };
    if ($("[data-dbl]")) $("[data-dbl]").onclick = () => { amt.value = Math.min(Math.floor(store.wb("binary")*100)/100, Math.round((parseFloat(amt.value)||0) * 2 * 100) / 100) || 1; renderOrder(); };
    root.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { amt.value = b.dataset.v === "max" ? Math.floor(Math.min(store.wb("binary"), 5000)*100)/100 : b.dataset.v; renderOrder(); });
    root.querySelectorAll("[data-e]").forEach(b => b.onclick = () => { exp = +b.dataset.e; renderOrder(); });
    root.querySelectorAll("[data-dir]").forEach(b => b.onclick = () => trade(b.dataset.dir));
    root.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => setPtab(b.dataset.pt));
    $("[data-pick]").onclick = () => pickSheet(sym, x => location.hash = "#/trade/" + x, true);
    $("[data-alert]").onclick = () => alertSheet(sym);
    $("#plist").addEventListener("click", e => { const ec = e.target.closest("[data-ec]");
      if (ec && !ec.disabled){ ec.disabled = true; const r = E.closeBinaryEarly(ec.dataset.ec); if (r.err){ toast(r.err, "bad"); } return; }
      const o = e.target.closest("[data-open]"); if (o && o.dataset.open !== sym) location.hash = "#/trade/" + o.dataset.open; });
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
      r.querySelector("#lu").textContent = new Date().toLocaleString("en-US");
      const f = S().fut, log = (f.log || []).slice().reverse();
      const box = r.querySelector("#hl");
      if (tab === "pos") box.innerHTML = historyHtml(f.history);
      else if (tab === "bin") box.innerHTML = S().history.length ? S().history.slice(0,100).map(x => { const p = M.get(x.sym) || {dp:2,type:"crypto",base:x.sym,quote:""}; return `<div class="pc"><div class="pc-h"><span class="side-b ${x.dir==="up"?"l":"s"}">${x.dir==="up"?"▲":"▼"}</span><span class="sym">${esc(M.label(p))}</span><span class="perp">Binary ${x.expiry<60?x.expiry+"s":x.expiry/60+"m"}</span><span class="grow"></span><b class="num ${x.profit>0?"up":x.profit<0?"down":""}">${signed(x.profit)}</b></div><div class="ph-t"><span>${M.fmtPx(p,x.entry)} → ${M.fmtPx(p,x.exit)}</span><b>${U.dateStr(x.closed)}</b></div></div>`; }).join("") : UI.emptyState("history","No records");
      else box.innerHTML = log.filter(x => tab === "ord" || x.status === "Filled").length ? log.filter(x => tab === "ord" || x.status === "Filled").slice(0,100).map(x => { const p = M.get(x.sym) || {dp:2,type:"crypto",base:x.sym}; return `<div class="pc"><div class="pc-h"><span class="side-b ${x.side==="long"?"l":"s"}">${x.side==="long"?"B":"S"}</span><span class="sym">${esc(fsym(p))}</span><span class="perp">${x.type}</span><span class="grow"></span><span class="label">${x.status}</span></div>
        <div class="ph-g"><div><span>Price</span><b class="num">${M.fmtPx(p,x.price)}</b></div><div><span>Qty</span><b class="num">${fmt(x.qty,4)}</b></div><div><span>${x.pnl != null ? "Realized PNL" : "Fee"}</span><b class="num ${x.pnl != null ? (x.pnl>=0?"up":"down") : ""}">${x.pnl != null ? signed(x.pnl) : fmt(x.fee||0,4)}</b></div></div><div class="ph-t"><span>Time</span><b>${new Date(x.t).toLocaleString("en-US")}</b></div></div>`; }).join("") : UI.emptyState("history","No records");
    };
    render();
    r.querySelectorAll("[data-ht]").forEach(b => b.onclick = () => { tab = b.dataset.ht; r.querySelectorAll("[data-ht]").forEach(x => x.classList.toggle("on", x===b)); render(); });
  }};
};
})();
