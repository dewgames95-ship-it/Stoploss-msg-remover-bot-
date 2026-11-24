/* ===== Chart engine (lightweight-charts v5, logo off) — exchange-style UX =====
   price box + countdown, crosshair price/% label + OHLC window, high/low marks, vertical pan + auto-scale,
   % axis toggle, position/TP/SL labels, B/S markers, binary expiry lines, drawing tools, indicators */
(function(){
const LW = window.LightweightCharts, {bus, store, money, mmss, signed} = U;
const TZ = -new Date().getTimezoneOffset() * 60;
let UP = "#12B886", DN = "#F0435A";
const COL = {m7:"#F59E0B", m25:"#0EA5E9", m99:"#64748B", boll:"#0EA5E9", bollMid:"#F59E0B", rsi:"#2E6BFF", macd:"#2E6BFF", sig:"#F59E0B", sar:"#E6A23C", vwap:"#4FC3F7"};
let chart, el, sym, tf = "15m", sec = 900, bars = [], S = {}, inds = [], type = "candle", loadSeq = 0, offs = [], ro, ui = {}, dirty = false, raf, lastRender = 0, onDetail = null, hover = null, hoverPt = null, lines = new Map(), cache = {}, pctMode = false;
let draw = {tool:null, temp:null}, drawEl = null;

const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const dark = () => document.documentElement.dataset.theme !== "light";
function opts(){
  const d = dark(), grid = d ? "rgba(148,163,184,.07)" : "rgba(100,116,139,.08)";
  return {
    layout:{background:{type:"solid", color: css("--chart-bg") || css("--bg")}, textColor: d ? "#7D8BA3" : "#8391A7", fontFamily:"Manrope, system-ui, sans-serif", fontSize:10.5, attributionLogo:false,
      panes:{separatorColor: d ? "#222E45" : "#E4E9F2", separatorHoverColor:"rgba(46,107,255,.25)", enableResize:true}},
    grid:{vertLines:{color:grid}, horzLines:{color:grid}},
    rightPriceScale:{borderVisible:false, scaleMargins:{top:0.1, bottom:0.08}, minimumWidth:62, entireTextOnly:true},
    timeScale:{borderVisible:false, timeVisible:true, secondsVisible: sec < 60, rightOffset:8, barSpacing: tf === "tick" ? 3 : 7, minBarSpacing:0.8, tickMarkFormatter: undefined},
    crosshair:{mode:0, vertLine:{color: d ? "#848E9C" : "#707A8A", style:2, width:1, labelBackgroundColor: d ? "#2E6BFF" : "#0F172A"}, horzLine:{color: d ? "#848E9C" : "#707A8A", style:2, width:1, labelVisible:false}},
    handleScroll:{vertTouchDrag:true, mouseWheel:true, pressedMouseMove:true, horzTouchDrag:true},
    handleScale:{pinch:true, mouseWheel:true, axisPressedMouseMove:{time:true, price:true}, axisDoubleClickReset:true},
    kineticScroll:{touch:true, mouse:false},
    trackingMode:{exitMode:1},
    localization:{priceFormatter: v => M.fmtPx(M.get(sym), v), timeFormatter: t => { const d = new Date(t*1000), z = n => String(n).padStart(2,"0"); return `${d.getUTCFullYear()}-${z(d.getUTCMonth()+1)}-${z(d.getUTCDate())} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}${sec < 60 ? ":" + z(d.getUTCSeconds()) : ""}`; }}
  };
}
const fmtVol = v => v >= 1e9 ? (v/1e9).toFixed(2)+"B" : v >= 1e6 ? (v/1e6).toFixed(2)+"M" : v >= 1e3 ? (v/1e3).toFixed(2)+"K" : (+v).toFixed(v < 10 ? 3 : 2);

function mount(container, parts, detailCb){
  destroy();
  el = container; ui = parts || {}; onDetail = detailCb;
  inds = ui.noInd ? [] : (store.s.settings.inds || []).slice(); type = store.s.settings.chartType || "candle";
  offs.push(bus.on("tick", onTick), bus.on("trade", onTrade), bus.on("theme", () => { if (chart){ build(); } }), bus.on("positions", syncLines), bus.on("history", syncLines));
  ro = new ResizeObserver(() => chart && chart.applyOptions({width: el.clientWidth, height: el.clientHeight}));
  ro.observe(el);
  // overlay layers
  el.insertAdjacentHTML("afterend", `<svg class="draw-svg" id="drawSvg"></svg><div class="ovl2" id="ovl2"></div><div class="cbox hide" id="cbox"></div><button class="auto-btn hide" id="autoBtn" aria-label="Auto scale">A</button>`);
  drawEl = el.parentElement.querySelector("#drawSvg");
  ui.ovl2 = el.parentElement.querySelector("#ovl2"); ui.cbox = el.parentElement.querySelector("#cbox"); ui.auto = el.parentElement.querySelector("#autoBtn");
  ui.auto.onclick = () => { chart?.priceScale("right").applyOptions({autoScale:true}); ui.auto.classList.add("hide"); };
  bindDraw(); bindAxisTap(); bindDrag();
  loop();
}

/* ---- Build / rebuild series ---- */
function build(){
  if (chart){ chart.remove(); chart = null; }
  lines.clear();
  UP = css("--up") || UP; DN = css("--down") || DN;
  chart = LW.createChart(el, Object.assign({width: el.clientWidth, height: el.clientHeight}, opts()));
  const p = M.get(sym), dp = p?.dp ?? 2, pf = {type:"price", precision:dp, minMove: Math.pow(10, -dp)};
  S = {};
  const lineMode = tf === "tick" || type === "line";
  if (lineMode){
    S.main = chart.addSeries(LW.AreaSeries, {lineColor:"#2E6BFF", topColor:"rgba(46,107,255,.30)", bottomColor:"rgba(46,107,255,0)", lineWidth:1.5, lineType: tf === "tick" ? 2 : 0, priceFormat:pf, lastPriceAnimation:1, lastValueVisible:false, priceLineVisible:true, priceLineColor: "#2E6BFF", priceLineStyle:2, crosshairMarkerRadius:3});
  } else {
    S.main = chart.addSeries(LW.CandlestickSeries, {upColor:UP, downColor:DN, borderVisible:false, wickUpColor:UP, wickDownColor:DN, priceFormat:pf, lastValueVisible:false, priceLineVisible:true, priceLineColor: "#2E6BFF", priceLineStyle:2});
  }
  chart.priceScale("right").applyOptions({mode: pctMode ? 2 : 0});
  try { LW.createTextWatermark(chart.panes()[0], {horzAlign:"center", vertAlign:"center", lines:[{text:"NovaTrade", color: dark() ? "rgba(148,163,184,.07)" : "rgba(100,116,139,.07)", fontSize:28, fontStyle:"700"}]}); } catch {}
  if (inds.includes("VOL")){
    S.vol = chart.addSeries(LW.HistogramSeries, {priceFormat:{type:"volume"}, priceScaleId:"vol", lastValueVisible:false, priceLineVisible:false});
    chart.priceScale("vol").applyOptions({scaleMargins:{top:0.84, bottom:0}});
  }
  const ln = (color, w=1, pane=0, extra={}) => chart.addSeries(LW.LineSeries, Object.assign({color, lineWidth:w, priceLineVisible:false, lastValueVisible:false, crosshairMarkerVisible:false, priceFormat:pf}, extra), pane);
  if (!lineMode && inds.includes("MA")){ S.m7 = ln(COL.m7); S.m25 = ln(COL.m25); S.m99 = ln(COL.m99); }
  if (!lineMode && inds.includes("EMA")){ S.e7 = ln(COL.m7); S.e25 = ln(COL.m25); S.e99 = ln(COL.m99); }
  if (!lineMode && inds.includes("BOLL")){ S.bu = ln(COL.boll); S.bm = ln(COL.bollMid, 1, 0, {lineStyle:2}); S.bl = ln(COL.boll); }
  if (!lineMode && inds.includes("SAR")) S.sar = ln(COL.sar, 1, 0, {lineVisible:false, pointMarkersVisible:true, pointMarkersRadius:1.6});
  if (!lineMode && inds.includes("VWAP")) S.vw = ln(COL.vwap, 1.3);
  if (!lineMode && inds.includes("SUPER")) S.st = ln(UP, 1.5);
  let pane = 1;
  if (inds.includes("RSI")){
    S.rsi = chart.addSeries(LW.LineSeries, {color:COL.rsi, lineWidth:1.2, priceLineVisible:false, lastValueVisible:true, priceFormat:{type:"price", precision:2, minMove:0.01}}, pane);
    S.rsi.createPriceLine({price:70, color:"rgba(240,67,90,.6)", lineStyle:2, lineWidth:1, axisLabelVisible:false});
    S.rsi.createPriceLine({price:30, color:"rgba(18,184,134,.6)", lineStyle:2, lineWidth:1, axisLabelVisible:false});
    pane++;
  }
  if (inds.includes("MACD")){
    const mf = {type:"price", precision: Math.max(2, dp+1), minMove: Math.pow(10, -(dp+1))};
    S.mh = chart.addSeries(LW.HistogramSeries, {priceLineVisible:false, lastValueVisible:false, priceFormat:mf}, pane);
    S.ml = chart.addSeries(LW.LineSeries, {color:COL.macd, lineWidth:1, priceLineVisible:false, lastValueVisible:false, priceFormat:mf}, pane);
    S.ms = chart.addSeries(LW.LineSeries, {color:COL.sig, lineWidth:1, priceLineVisible:false, lastValueVisible:false, priceFormat:mf}, pane);
    pane++;
  }
  const sub = Math.max(64, Math.round(el.clientHeight * 0.18));
  chart.panes().forEach((pn, i) => { if (i > 0) pn.setHeight(sub); });
  chart.subscribeCrosshairMove(prm => {
    if (!prm || prm.time == null || !prm.point){ hover = null; hoverPt = null; legend(); crossBox(); return; }
    const i = findIdx(prm.time - TZ); hover = i >= 0 ? i : null; hoverPt = prm.point; legend(); crossBox();
  });
  chart.subscribeClick(() => { if (hover == null) ui.cbox?.classList.add("hide"); });
  chart.timeScale().subscribeVisibleLogicalRangeChange(() => { checkAuto(); });
  setAll();
  syncLines();
}
function findIdx(t){ let lo = 0, hi = bars.length - 1; while (lo <= hi){ const m = (lo+hi) >> 1; if (bars[m].time === t) return m; if (bars[m].time < t) lo = m+1; else hi = m-1; } return -1; }
function checkAuto(){ if (!chart || !ui.auto) return; const a = chart.priceScale("right").options().autoScale; ui.auto.classList.toggle("hide", a); }

/* ---- Data ---- */
const T = t => t + TZ;
function calc(){
  const c = bars.map(b => b.close), r = {};
  if (S.m7){ r.m7 = IND.sma(c,7); r.m25 = IND.sma(c,25); r.m99 = IND.sma(c,99); }
  if (S.e7){ r.e7 = IND.ema(c,7); r.e25 = IND.ema(c,25); r.e99 = IND.ema(c,99); }
  if (S.bu) r.boll = IND.boll(bars);
  if (S.sar) r.sar = IND.sar(bars);
  if (S.vw) r.vw = IND.vwap(bars);
  if (S.st) r.st = IND.supertrend(bars.map(b => tf === "tick" ? {...b, high:b.close, low:b.close} : b));
  if (S.rsi) r.rsi = IND.rsi(bars);
  if (S.mh) r.macd = IND.macd(bars);
  return r;
}
function point(i, r){
  const b = bars[i], t = T(b.time), o = {};
  o.main = (tf === "tick" || type === "line") ? {time:t, value:b.close} : {time:t, open:b.open, high:b.high, low:b.low, close:b.close};
  if (S.vol) o.vol = {time:t, value:b.volume || 0, color: b.close >= b.open ? "rgba(18,184,134,.45)" : "rgba(240,67,90,.45)"};
  const lp = arr => arr[i] == null ? {time:t} : {time:t, value:arr[i]};
  if (S.m7){ o.m7 = lp(r.m7); o.m25 = lp(r.m25); o.m99 = lp(r.m99); }
  if (S.e7){ o.e7 = lp(r.e7); o.e25 = lp(r.e25); o.e99 = lp(r.e99); }
  if (S.bu){ o.bu = lp(r.boll.up); o.bm = lp(r.boll.mid); o.bl = lp(r.boll.lo); }
  if (S.sar) o.sar = r.sar.val[i] == null ? {time:t} : {time:t, value:r.sar.val[i], color: r.sar.dir[i] === 1 ? UP : DN};
  if (S.vw) o.vw = lp(r.vw);
  if (S.st) o.st = r.st.val[i] == null ? {time:t} : {time:t, value:r.st.val[i], color: r.st.dir[i] === 1 ? UP : DN};
  if (S.rsi) o.rsi = lp(r.rsi);
  if (S.mh){ o.mh = r.macd.hist[i] == null ? {time:t} : {time:t, value:r.macd.hist[i], color: r.macd.hist[i] >= 0 ? "rgba(18,184,134,.7)" : "rgba(240,67,90,.7)"}; o.ml = lp(r.macd.line); o.ms = lp(r.macd.signal); }
  return o;
}
function seriesKeys(){ return Object.keys(S).filter(k => S[k] && typeof S[k].setData === "function"); }
function setAll(){
  if (!chart) return;
  const r = cache = calc(), keys = seriesKeys(), data = {}; keys.forEach(k => data[k] = []);
  for (let i=0;i<bars.length;i++){ const o = point(i, r); keys.forEach(k => o[k] && data[k].push(o[k])); }
  try { keys.forEach(k => S[k].setData(data[k])); } catch(e){ console.warn(e); }
  legend();
}
function renderLast(){
  if (!chart || !bars.length) return;
  const r = cache = calc(), o = point(bars.length - 1, r);
  try { Object.keys(o).forEach(k => S[k] && S[k].update(o[k])); } catch(e){ setAll(); }
  if (hover == null) legend();
}

async function load(s, timeframe){
  sym = s; tf = timeframe; sec = M.TF_SEC[tf];
  const seq = ++loadSeq;
  bars = []; build(); msg("Loading…");
  let data = [];
  for (let i=0;i<5;i++){
    try { data = await M.candles(sym, tf); break; }
    catch { if (seq !== loadSeq) return; msg("Reconnecting…"); await U.sleep(800 * 2**i); }
  }
  if (seq !== loadSeq) return;
  const p = M.get(sym);
  bars = []; for (const b of data){ const l = bars[bars.length-1]; if (l && b.time <= l.time){ if (b.time === l.time) bars[bars.length-1] = b; continue; } bars.push(b); }
  if (!bars.length && p?.price){ const t = Math.floor(Date.now()/1000/sec)*sec; bars = [{time:t, open:p.price, high:p.price, low:p.price, close:p.price, volume:0}]; }
  setAll();
  chart.timeScale().scrollToRealTime();
  msg(bars.length ? "" : "Waiting for live data…");
  if (p?.price) onTick(sym, p.price);
}
function msg(t){ if (ui.msg) ui.msg.innerHTML = t ? `<span>${t}</span>` : ""; }

function onTick(s, price){
  if (s !== sym || !price || !chart) return;
  const now = Math.floor(Date.now()/1000), bt = Math.floor(now/sec)*sec, l = bars[bars.length-1];
  if (l && bt < l.time) return;
  const nonC = M.get(sym).type !== "crypto";
  if (l && l.time === bt){ l.high = Math.max(l.high, price); l.low = Math.min(l.low, price); l.close = price; if (nonC) l.volume += 1; }
  else bars.push({time:bt, open: l ? l.close : price, high:price, low:price, close:price, volume: nonC ? 1 : 0});
  dirty = true; msg("");
}
function onTrade(s, tr){ if (s !== sym || !bars.length) return; const bt = Math.floor(tr.t/1000/sec)*sec, l = bars[bars.length-1]; if (l.time === bt) l.volume += tr.q; }
function loop(){
  raf = requestAnimationFrame(loop);
  const n = performance.now();
  if (dirty && n - lastRender >= 120){ dirty = false; lastRender = n; renderLast(); }
  overlay(); renderDraw();   // every frame → HTML labels move in sync with the canvas while panning
}

/* ---- Legend (indicator values, top-left) ---- */
function legend(){
  if (!ui.legend || !bars.length) return;
  const i = hover ?? bars.length - 1, p = M.get(sym), f = v => v == null ? "--" : M.fmtPx(p, v), r = cache;
  let h = "";
  if (r.m7) h += `<div><span>MA(7) <b style="color:${COL.m7}">${f(r.m7[i])}</b></span><span>MA(25) <b style="color:${COL.m25}">${f(r.m25[i])}</b></span><span>MA(99) <b style="color:${COL.m99}">${f(r.m99[i])}</b></span></div>`;
  if (r.e7) h += `<div><span>EMA(7) <b style="color:${COL.m7}">${f(r.e7[i])}</b></span><span>EMA(25) <b style="color:${COL.m25}">${f(r.e25[i])}</b></span><span>EMA(99) <b style="color:${COL.m99}">${f(r.e99[i])}</b></span></div>`;
  if (r.boll) h += `<div><span>BOLL(20,2) <b style="color:${COL.bollMid}">${f(r.boll.mid[i])}</b></span><span>UB <b style="color:${COL.boll}">${f(r.boll.up[i])}</b></span><span>LB <b style="color:${COL.boll}">${f(r.boll.lo[i])}</b></span></div>`;
  if (r.sar) h += `<div><span>SAR(0.02,0.2) <b style="color:${COL.sar}">${f(r.sar.val[i])}</b></span></div>`;
  if (r.vw) h += `<div><span>VWAP <b style="color:${COL.vwap}">${f(r.vw[i])}</b></span></div>`;
  if (r.st) h += `<div><span>SUPERTREND(10,3) <b style="color:${r.st.dir[i] === 1 ? UP : DN}">${f(r.st.val[i])}</b></span></div>`;
  ui.legend.innerHTML = h;
}
/* ---- Crosshair window (Time/Open/High/Low/Close/Chg/%Chg/Range/Vol) + price/% label ---- */
function crossBox(){
  const box = ui.cbox; if (!box) return;
  if (hover == null || !hoverPt){ box.classList.add("hide"); ui.xlab && ui.xlab.remove(); ui.xlab = null; return; }
  const b = bars[hover], p = M.get(sym), f = v => M.fmtPx(p, v), prev = hover ? bars[hover-1].close : b.open;
  const ch = b.close - prev, chp = ch / prev * 100, rng = (b.high - b.low) / (b.low || 1) * 100, d = new Date(b.time*1000);
  const ts = `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")},${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}${sec < 60 ? ":" + String(d.getSeconds()).padStart(2,"0") : ""}`;
  const c = ch >= 0 ? "up" : "down";
  box.innerHTML = [["Time",ts],["Open",f(b.open)],["High",f(b.high)],["Low",f(b.low)],["Close",f(b.close)],["Chg",`<span class="${c}">${ch>=0?"+":""}${M.fmtPx(p,ch)}</span>`],["%Chg",`<span class="${c}">${chp>=0?"+":""}${chp.toFixed(2)}%</span>`],["Range",rng.toFixed(2)+"%"],["Vol",fmtVol(b.volume||0)]].map(([k,v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
  const w = el.clientWidth; box.classList.remove("hide");
  box.style.left = hoverPt.x > w/2 ? "6px" : ""; box.style.right = hoverPt.x > w/2 ? "" : "70px";
  // custom horizontal label on price axis: price + % vs last
  const pr = S.main.coordinateToPrice(hoverPt.y), last = bars[bars.length-1].close;
  if (pr == null) return;
  if (!ui.xlab){ ui.xlab = document.createElement("div"); ui.xlab.className = "xlab"; el.parentElement.appendChild(ui.xlab); }
  const dpc = (pr - last) / last * 100;
  ui.xlab.style.top = hoverPt.y + "px"; ui.xlab.innerHTML = `${M.fmtPx(p, pr)}<br>${dpc>=0?"+":""}${dpc.toFixed(2)}%`;
}

/* ---- Position lines (axis labels) ---- */
function syncLines(){
  if (!S.main) return;
  const want = new Map(), s = store.s;
  const cp = s.settings.chart || {}, bin = ui.mode !== "fut" && cp.pos !== false, fut = ui.mode !== "bin" && cp.pos !== false, ordOn = ui.mode !== "bin" && cp.ord !== false;
  if (bin) s.positions.filter(x => x.sym === sym).forEach(p => want.set("b"+p.id, {price:p.entry, color:"#2E6BFF", lineStyle:2}));
  if (fut) s.fut.positions.filter(x => x.sym === sym).forEach(p => {
    want.set("f"+p.id, {price:p.entry, color: p.side === "long" ? UP : DN, lineStyle:2});
    if (p.liq > 0) want.set("l"+p.id, {price:p.liq, color:"#F7931A", lineStyle:2});
    if (p.tp) want.set("t"+p.id, {price:p.tp, color:DN, lineStyle:2});
    if (p.sl) want.set("s"+p.id, {price:p.sl, color:DN, lineStyle:2});
  });
  if (ordOn) s.fut.orders.filter(x => x.sym === sym).forEach(o => want.set("o"+o.id, {price:o.price, color:"#0EA5E9", lineStyle:2}));
  for (const [k, l] of lines){ if (!want.has(k)){ try { S.main.removePriceLine(l); } catch {} lines.delete(k); } }
  for (const [k, o] of want){
    if (lines.has(k)) lines.get(k).applyOptions({price:o.price, color:o.color});
    else lines.set(k, S.main.createPriceLine({price:o.price, color:o.color, lineStyle:o.lineStyle, lineWidth:1, axisLabelVisible:true, title:""}));
  }
}
/* ---- Time → x (works for future times too) ---- */
function lx(l){ const ts = chart.timeScale(), f = Math.floor(l), a = ts.logicalToCoordinate(f), b = ts.logicalToCoordinate(f + 1); return a == null || b == null ? null : a + (b - a) * (l - f); }
function timeToX(t){
  if (!bars.length) return null;
  const L = bars.length - 1, last = bars[L].time;
  if (t >= last) return lx(L + (t - last) / sec);
  let lo = 0, hi = L; while (lo < hi){ const m = (lo + hi) >> 1; if (bars[m].time < t) lo = m + 1; else hi = m; }
  const i = lo, prevT = i ? bars[i-1].time : bars[0].time - sec, frac = (t - prevT) / Math.max(1, bars[i].time - prevT);
  return lx(i - 1 + frac);
}
function barAt(t){ if (!bars.length) return -1; const L = bars.length - 1; if (t < bars[0].time || t >= bars[L].time + sec) return -1;
  let lo = 0, hi = L; while (lo < hi){ const m = (lo + hi + 1) >> 1; if (bars[m].time <= t) lo = m; else hi = m - 1; } return lo; }
function xToTime(x){ const l = chart.timeScale().coordinateToLogical(x); if (l == null || !bars.length) return null; const L = bars.length - 1, i = Math.floor(l);
  if (i >= L) return bars[L].time + (l - L) * sec; if (i < 0) return bars[0].time + l * sec; return bars[i].time + (l - i) * (bars[i+1].time - bars[i].time); }

/* ---- HTML overlay: price box + countdown, high/low, positions, markers, expiry ---- */
function overlay(){
  const box = ui.ovl2; if (!box || !chart || !S.main || !bars.length) return;
  const s = store.s, p = M.get(sym), now = Date.now(), w = el.clientWidth, axisX = w - 64, L = bars.length - 1, last = bars[L];
  const cp = s.settings.chart || {};
  let h = "";
  // current price box with candle countdown
  const y = S.main.priceToCoordinate(last.close);
  if (y != null){
    const left = sec >= 60 && cp.cd !== false ? Math.max(0, last.time + sec - now/1000) : null;
    const cd = left == null ? "" : left >= 3600 ? `${Math.floor(left/3600)}:${String(Math.floor(left%3600/60)).padStart(2,"0")}:${String(Math.floor(left%60)).padStart(2,"0")}` : mmss(left);
    h += `<div class="pbox" style="top:${y}px">${M.fmtPx(p, last.close)}${cd ? `<br>${cd}` : ""}</div>`;
  }
  // visible high / low
  const vr = chart.timeScale().getVisibleLogicalRange();
  if (vr && tf !== "tick" && type !== "line" && cp.hilo !== false){
    let hi = -Infinity, lo = Infinity, hiI = -1, loI = -1;
    for (let i = Math.max(0, Math.ceil(vr.from)); i <= Math.min(L, Math.floor(vr.to)); i++){ if (bars[i].high > hi){ hi = bars[i].high; hiI = i; } if (bars[i].low < lo){ lo = bars[i].low; loI = i; } }
    const mark = (i, v, top) => { const x = chart.timeScale().logicalToCoordinate(i), yy = S.main.priceToCoordinate(v); if (x == null || yy == null) return "";
      const right = x < axisX / 2; return `<div class="hl ${right?"r":"l"}" style="left:${right ? x : x - 90}px;top:${yy + (top ? -7 : 7)}px">${right ? "" : M.fmtPx(p, v)}<i></i>${right ? M.fmtPx(p, v) : ""}</div>`; };
    if (hiI >= 0) h += mark(hiI, hi, true);
    if (loI >= 0) h += mark(loI, lo, false);
  }
  const bin = ui.mode !== "fut" && cp.pos !== false, fut = ui.mode !== "bin" && cp.pos !== false, ordOn = ui.mode !== "bin" && cp.ord !== false;
  // futures: entry label (PnL | size), TP/SL labels, liq
  // futures: entry label (PnL | size) + draggable TP/SL (drag the "TP/SL" handle off the entry line, or drag existing TP/SL labels)
  if (fut) s.fut.positions.filter(x => x.sym === sym).forEach(pos => {
    const {pnl} = E.futPnl(pos), ye = S.main.priceToCoordinate(pos.entry), c = pnl >= 0 ? "g" : "r";
    if (ye != null){
      h += `<div class="plab ${c}" style="top:${ye}px;left:0"><span>PnL ${signed(pnl)}</span><span>${money(pos.qty * pos.entry)}</span></div>`;
      if (ui.mode !== "bin" && !(dragS && dragS.id === pos.id && dragS.kind === "new")) h += `<div class="dh drag" data-drag="new:${pos.id}" style="top:${ye}px;right:70px">${dragIcon} TP/SL</div>`;
    }
    const pv = k => dragS && dragS.id === pos.id && (dragS.kind === k || (dragS.kind === "new" && dragS.as === k)) ? dragS.price : pos[k];
    [["tp","TP"],["sl","SL"]].forEach(([k, n]) => { const v = pv(k); if (!v) return; const yy = S.main.priceToCoordinate(v); if (yy == null) return;
      const est = E.futPnl(pos, v).pnl, roi = est / (pos.margin || 1) * 100, act = dragS && dragS.id === pos.id && (dragS.kind === k || dragS.as === k);
      if (act) h += `<div class="dline ${k}" style="top:${yy}px"></div>`;
      h += `<div class="plab o ${est>=0?"g":"r"} drag${act ? " act" : ""}" data-drag="${k}:${pos.id}" style="top:${yy}px;left:${Math.max(4, axisX/2 - 90)}px"><span>${dragIcon} ${n} ${M.fmtPx(p, v)}</span><span>PnL ${signed(est)} (${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%)</span></div>`; });
  });
  if (ordOn) s.fut.orders.filter(x => x.sym === sym).forEach(o => { const yy = S.main.priceToCoordinate(dragS && dragS.kind === "ord" && dragS.id === o.id ? dragS.price : o.price); if (yy != null) h += `<div class="plab o y drag" data-drag="ord:${o.id}" style="top:${yy}px;left:4px"><span>Limit ${o.side === "long" ? "Buy" : "Sell"} ${M.fmtPx(p, o.price)}</span><span>${money(o.margin * o.lev)}</span></div>`; });
  // B/S markers from trades on this symbol
  const marks = ui.mode === "bin" ? [] : [...s.fut.positions.filter(x => x.sym === sym).map(x => ({t:x.open, p:x.entry, s:x.side === "long" ? "B" : "S"})),
    ...s.fut.history.filter(x => x.sym === sym).slice(0, 40).flatMap(x => [{t:x.open, p:x.entry, s:x.side === "long" ? "B" : "S"}, {t:x.closed, p:x.exit, s:x.side === "long" ? "S" : "B"}])];
  if (ui.mode !== "fut") marks.push(...s.positions.filter(x => x.sym === sym).map(x => ({t:x.open, p:x.entry, s:x.dir === "up" ? "B" : "S"})),
    ...s.history.filter(x => x.sym === sym).slice(0, 40).map(x => ({t:x.open, p:x.entry, s:x.dir === "up" ? "B" : "S"})));
  // small B/S tags snapped to the candle: Buy below the low, Sell above the high, arrow pointing at the wick
  const lineMode = tf === "tick" || type === "line", stack = {};
  if (cp.bs !== false) marks.forEach(m => {
    const t = Math.floor(m.t/1000); let x, yy, key;
    if (!lineMode){
      const bi = barAt(t); if (bi < 0) return; const b = bars[bi];
      x = chart.timeScale().logicalToCoordinate(bi); yy = S.main.priceToCoordinate(m.s === "B" ? b.low : b.high); key = bi + m.s;
    } else { x = timeToX(t); yy = S.main.priceToCoordinate(m.p); key = Math.round((x || 0) / 6) + m.s; }
    if (x == null || yy == null || x < 0 || x > axisX) return;
    const n = stack[key] = (stack[key] || 0) + 1; if (n > 3) return;
    const off = (n - 1) * 16;
    h += `<div class="bs ${m.s === "B" ? "b" : "s"}" style="left:${x}px;top:${m.s === "B" ? yy + off : yy - off}px">${m.s}</div>`; });
  // binary: tag + start/expiry lines
  const used = [];
  if (bin) s.positions.filter(x => x.sym === sym).forEach(pos => {
    let yy = S.main.priceToCoordinate(pos.entry); if (yy == null) return;
    while (used.some(u => Math.abs(u - yy) < 20)) yy += 20; used.push(yy);
    const {win, pnl} = E.livePnl(pos), lft = (pos.exp - now) / 1000;
    const xs = timeToX(pos.open/1000), xe = timeToX(pos.exp/1000);
    if (xs != null && xs > 0 && xs < axisX) h += `<div class="start-line" style="left:${xs}px"></div>`;
    if (xe != null){ const x = Math.min(Math.max(xe, 30), axisX - 4); h += `<div class="exp-line" style="left:${x}px"><span style="top:${4 + (used.length-1)*18}px">⏱ ${mmss(lft)}</span></div>`; }
    h += `<div class="plab ${win == null ? "n" : win ? "g" : "r"}" style="top:${yy}px;right:66px"><span>${pos.dir === "up" ? "▲ Up" : "▼ Down"}</span><span>${win ? "+" + money(pnl) : "-" + money(pos.amount)} · ${mmss(lft)}</span></div>`;
  });
  if (h !== box._h){ box._h = h; box.innerHTML = h; }
}

/* ---- Drag TP / SL / limit order lines on the chart ---- */
let dragS = null;
const dragIcon = `<svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0l3 3H2zM5 10l3-3H2z" fill="currentColor"/></svg>`;
function bindDrag(){
  const host = el.parentElement;
  host.addEventListener("pointerdown", e => {
    const t = e.target.closest("[data-drag]"); if (!t || !chart || !S.main) return;
    e.preventDefault(); e.stopPropagation();
    const [kind, id] = t.dataset.drag.split(":"); dragS = {kind, id, price:null, as:null, y0:e.clientY};
    const move = ev => {
      const r = el.getBoundingClientRect(), pr = S.main.coordinateToPrice(ev.clientY - r.top); if (pr == null) return;
      dragS.price = pr;
      if (kind === "new"){ const pos = store.s.fut.positions.find(x => x.id === id); if (pos) dragS.as = (pos.side === "long") === (pr > pos.entry) ? "tp" : "sl"; }
    };
    const up = () => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
      const d = dragS; dragS = null; if (!d || d.price == null) return;
      const P = M.get(sym), v = +M.fmtPx(P, d.price).replace(/,/g, "");
      if (d.kind === "ord"){ const o = store.s.fut.orders.find(x => x.id === d.id); if (o){ o.price = v; store.save(); bus.emit("positions"); U.toast(`Limit price moved to ${M.fmtPx(P, v)}`, "ok", 1400); } return; }
      const pos = store.s.fut.positions.find(x => x.id === d.id); if (!pos) return;
      const k = d.kind === "new" ? d.as : d.kind; if (!k) return;
      const err = E.setTpSl(pos.id, k === "tp" ? v : pos.tp || null, k === "sl" ? v : pos.sl || null);
      if (err) return U.toast(err, "bad");
      E.award?.("tpsl"); U.fx("notify"); U.toast(`${k.toUpperCase()} set at ${M.fmtPx(P, v)} · est. PnL ${signed(E.futPnl(pos, v).pnl)} USDT`, "ok", 1800); syncLines();
    };
    addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  }, true);
}

/* ---- Tap on price axis toggles % scale ---- */
function bindAxisTap(){
  let sx = 0, sy = 0, st = 0;
  el.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; st = Date.now(); }, true);
  el.addEventListener("pointerup", e => {
    const r = el.getBoundingClientRect(), x = e.clientX - r.left;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) < 6 && Date.now() - st < 300 && x > el.clientWidth - 62 && e.clientY - r.top < el.clientHeight - 26){
      pctMode = !pctMode; chart.priceScale("right").applyOptions({mode: pctMode ? 2 : 0});
      U.toast(pctMode ? "Price axis: percentage" : "Price axis: price", "info", 1000);
    }
    setTimeout(checkAuto, 50);
  }, true);
  el.addEventListener("dblclick", e => { if (onDetail && hover != null) openDetail(); }, true);
}
function openDetail(){
  if (hover == null) return; const i = hover, r = calc();
  onDetail && onDetail({bar:bars[i], prev: i ? bars[i-1] : null, i, sec, tf, ind:{e7:r.e7?.[i] ?? r.m7?.[i], e25:r.e25?.[i] ?? r.m25?.[i], e99:r.e99?.[i] ?? r.m99?.[i], bu:r.boll?.up[i], bm:r.boll?.mid[i], bl:r.boll?.lo[i], st:r.st?.val[i], stDir:r.st?.dir[i], macd:r.macd?.line[i], sig:r.macd?.signal[i]}, rsiFull: IND.rsi(bars)[i]});
}

/* ---- Drawing tools: trend line, ray, horizontal line, rectangle, fib ---- */
const dKey = () => "draw_" + sym;
let dCache = null, dSym = null;
const drawings = () => { if (dSym !== sym){ dSym = sym; try { dCache = JSON.parse(localStorage.getItem(dKey()) || "[]"); } catch { dCache = []; } } return dCache.slice(); };
const saveDrawings = a => { dCache = a.slice(); dSym = sym; try { localStorage.setItem(dKey(), JSON.stringify(a)); } catch {} };
function setTool(t){ draw.tool = t; draw.temp = null; drawEl.classList.toggle("on", !!t); bus.emit("drawtool", t); }
function bindDraw(){
  const pt = e => { const r = drawEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return {x, y, t:xToTime(x), p:S.main.coordinateToPrice(y)}; };
  drawEl.addEventListener("pointerdown", e => {
    if (!draw.tool || !chart) return; e.preventDefault();
    const q = pt(e); if (q.t == null || q.p == null) return;
    if (draw.tool === "hline"){ const a = drawings(); a.push({k:"hline", p:q.p}); saveDrawings(a); setTool(null); return; }
    if (!draw.temp){ draw.temp = {k:draw.tool, a:{t:q.t, p:q.p}, b:{t:q.t, p:q.p}}; return; }
    draw.temp.b = {t:q.t, p:q.p}; const a = drawings(); a.push(draw.temp); saveDrawings(a); setTool(null);
  });
  drawEl.addEventListener("pointermove", e => { if (draw.temp){ const q = pt(e); if (q.t != null && q.p != null) draw.temp.b = {t:q.t, p:q.p}; } });
}
function renderDraw(){
  if (!drawEl || !chart || !S.main) return;
  const w = el.clientWidth - 62, H = el.clientHeight, list = drawings().concat(draw.temp ? [draw.temp] : []);
  const P = q => ({x: timeToX(q.t), y: S.main.priceToCoordinate(q.p)});
  let h = "";
  list.forEach(d => {
    if (d.k === "hline"){ const y = S.main.priceToCoordinate(d.p); if (y != null) h += `<line x1="0" x2="${w}" y1="${y}" y2="${y}" class="dl"/><text x="${w-4}" y="${y-4}" text-anchor="end" class="dt">${M.fmtPx(M.get(sym), d.p)}</text>`; return; }
    const a = P(d.a), b = P(d.b); if (a.x == null || b.x == null || a.y == null || b.y == null) return;
    if (d.k === "trend") h += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="dl"/><circle cx="${a.x}" cy="${a.y}" r="3" class="dp"/><circle cx="${b.x}" cy="${b.y}" r="3" class="dp"/>`;
    if (d.k === "ray"){ const k = (b.y - a.y) / ((b.x - a.x) || 0.001), x2 = b.x >= a.x ? w : 0; h += `<line x1="${a.x}" y1="${a.y}" x2="${x2}" y2="${a.y + k*(x2 - a.x)}" class="dl"/><circle cx="${a.x}" cy="${a.y}" r="3" class="dp"/>`; }
    if (d.k === "rect") h += `<rect x="${Math.min(a.x,b.x)}" y="${Math.min(a.y,b.y)}" width="${Math.abs(b.x-a.x)}" height="${Math.abs(b.y-a.y)}" class="dr"/>`;
    if (d.k === "fib"){ [0,0.236,0.382,0.5,0.618,0.786,1].forEach(r => { const pr = d.a.p + (d.b.p - d.a.p) * r, y = S.main.priceToCoordinate(pr); if (y == null) return;
      h += `<line x1="${Math.min(a.x,b.x)}" x2="${w}" y1="${y}" y2="${y}" class="df"/><text x="${Math.min(a.x,b.x)+2}" y="${y-3}" class="dt">${r} (${M.fmtPx(M.get(sym), pr)})</text>`; }); }
  });
  const vb = `0 0 ${el.clientWidth} ${H}`;
  if (h !== drawEl._h){ drawEl._h = h; drawEl.innerHTML = h; }
  if (vb !== drawEl._vb){ drawEl._vb = vb; drawEl.setAttribute("viewBox", vb); }
}
function undoDraw(){ const a = drawings(); a.pop(); saveDrawings(a); }
function clearDraw(){ saveDrawings([]); }

function setInds(list){ inds = list.slice(); store.s.settings.inds = inds; store.save(); const keep = chart ? chart.timeScale().getVisibleLogicalRange() : null; build(); if (keep) chart.timeScale().setVisibleLogicalRange(keep); }
function setType(t){ type = t; store.s.settings.chartType = t; store.save(); build(); chart.timeScale().scrollToRealTime(); }
function zoom(f){ if (!chart) return; const ts = chart.timeScale(), cur = ts.options().barSpacing; ts.applyOptions({barSpacing: U.clamp(cur * f, 1, 60)}); }
function reset(){ chart?.timeScale().scrollToRealTime(); chart?.priceScale("right").applyOptions({autoScale:true}); checkAuto(); }
function resize(){ if (chart && el) chart.applyOptions({width: el.clientWidth, height: el.clientHeight}); }
function destroy(){ offs.forEach(f => f()); offs = []; ro?.disconnect(); cancelAnimationFrame(raf); if (chart) chart.remove(); chart = null; S = {}; lines.clear(); loadSeq++; bars = []; draw = {tool:null, temp:null}; ui.xlab?.remove(); }
async function perfStats(s){
  const out = {}; try {
    const d = await M.candles(s, "1d"); if (!d.length) return out; const last = d[d.length-1].close;
    [["Today",1],["7 Days",7],["30 Days",30],["90 Days",90],["180 Days",180],["1 Year",365]].forEach(([k,n]) => { const b = d[d.length - 1 - (k === "Today" ? 0 : n)]; out[k] = b ? (last - (k === "Today" ? b.open : b.close)) / (k === "Today" ? b.open : b.close) * 100 : null; });
  } catch {} return out;
}

window.CH = {mount, load, zoom, reset, destroy, setInds, setType, resize, syncLines, setTool, undoDraw, clearDraw, performance: perfStats, get tool(){ return draw.tool; }, get inds(){ return inds; }, get type(){ return type; }, fmtVol};
})();
