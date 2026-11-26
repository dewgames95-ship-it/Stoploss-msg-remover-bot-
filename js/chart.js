/* ===== Chart engine (lightweight-charts v5, logo off) — exchange-style UX =====
   price box + countdown, crosshair price/% label + OHLC window, high/low marks, vertical pan + auto-scale,
   % axis toggle, position/TP/SL labels, B/S markers, binary expiry lines, drawing tools, indicators */
(function(){
const LW = window.LightweightCharts, {bus, store, money, mmss, signed} = U;
const TZ = -new Date().getTimezoneOffset() * 60;
let UP = "#2EBD85", DN = "#F6465D";   // Binance app candle colours (both themes)
const COL = {m7:"#F59E0B", m25:"#0EA5E9", m99:"#64748B", e7:"#F59E0B", e25:"#0EA5E9", e99:"#64748B", boll:"#0EA5E9", bollMid:"#F59E0B", rsi:"#2E6BFF", macd:"#2E6BFF", sig:"#F59E0B", sar:"#E6A23C", vwap:"#4FC3F7"};
/* user-editable indicator parameters (store.s.indSettings) — defaults here, edited on the Indicator Settings page */
const IDEF = {
  MA:{p1:7, p2:25, p3:99, c1:"#F59E0B", c2:"#0EA5E9", c3:"#64748B"},
  EMA:{p1:7, p2:25, p3:99, c1:"#F59E0B", c2:"#0EA5E9", c3:"#64748B"},
  BOLL:{n:20, m:2, c:"#0EA5E9", cm:"#F59E0B"},
  SAR:{step:0.02, max:0.2, c:"#E6A23C"},
  SUPER:{n:10, m:3, conf:0.15},
  VWAP:{c:"#4FC3F7"},
  SR:{lv:2, k:4},
  LIQ:{lev:"10,25,50,100", bins:220},
  RSI:{n:14, c:"#2E6BFF"},
  MACD:{f:12, s:26, g:9, c:"#2E6BFF", cs:"#F59E0B"}
};
const IS = k => { const o = Object.assign({}, IDEF[k], store.s.indSettings && store.s.indSettings[k]); for (const f in IDEF[k]) if (typeof IDEF[k][f] === "number"){ o[f] = +o[f]; if (!isFinite(o[f]) || o[f] <= 0) o[f] = IDEF[k][f]; } return o; };
function syncCols(){
  const a = IS("MA"), b = IS("EMA"), bo = IS("BOLL");
  Object.assign(COL, {m7:a.c1, m25:a.c2, m99:a.c3, e7:b.c1, e25:b.c2, e99:b.c3, boll:bo.c, bollMid:bo.cm, rsi:IS("RSI").c, macd:IS("MACD").c, sig:IS("MACD").cs, sar:IS("SAR").c, vwap:IS("VWAP").c});
}
const MAXI = 4, nonVol = l => l.filter(k => k !== "VOL").length;
let chart, el, sym, tf = "15m", sec = 900, bars = [], S = {}, inds = [], type = "candle", loadSeq = 0, offs = [], ro, ui = {}, dirty = false, raf, lastRender = 0, onDetail = null, hover = null, hoverPt = null, lines = new Map(), cache = {}, pctMode = false;
let lineSpec = new Map(), draw = {tool:null, temp:null}, drawEl = null, binExpFn = null, srOn = false, liqOn = false, srLines = [], srZones = [], srKey = "", liqKey = "", liqData = null, stSigs = [], plusUntil = 0, lastHov = null, lastTick = 0;

const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const dark = () => document.documentElement.dataset.theme !== "light";
function opts(){
  const d = dark(), grid = gridCol();
  return {
    // transparent canvas: the chart-wrap paints the Binance chart colour (var(--chart-bg)) and the wide grid canvas sits underneath
    layout:{background:{type:"solid", color:"transparent"}, textColor: d ? "#848E9C" : "#707A8A", fontFamily:"Manrope, system-ui, sans-serif", fontSize:10.5, attributionLogo:false,
      panes:{separatorColor: d ? "#222E45" : "#E4E9F2", separatorHoverColor:"rgba(46,107,255,.25)", enableResize:true}},
    grid:{vertLines:{color:grid}, horzLines:{visible:false}},
    rightPriceScale:{borderVisible:false, scaleMargins:{top:0.03, bottom:0.03}, minimumWidth:62, entireTextOnly:true},
    timeScale:{borderVisible:false, timeVisible:true, secondsVisible: sec < 60, rightOffset:8, barSpacing: tf === "tick" ? 3 : 7, minBarSpacing:0.8, tickMarkFormatter: undefined, tickMarkMaxCharacterLength:15},
    crosshair:{mode:0, vertLine:{color: d ? "#848E9C" : "#707A8A", style:2, width:1, labelBackgroundColor: d ? "#474D57" : "#3B424C"}, horzLine:{color: d ? "#848E9C" : "#707A8A", style:2, width:1, labelVisible:false}},
    handleScroll:{vertTouchDrag:true, mouseWheel:true, pressedMouseMove:true, horzTouchDrag:true},
    handleScale:{pinch:true, mouseWheel:true, axisPressedMouseMove:{time:true, price:true}, axisDoubleClickReset:true},
    kineticScroll:{touch:true, mouse:false},
    trackingMode:{exitMode:1},
    localization:{priceFormatter: v => M.fmtPx(M.get(sym), v), timeFormatter: t => { const d = new Date(t*1000), z = n => String(n).padStart(2,"0"); return `${d.getUTCFullYear()}-${z(d.getUTCMonth()+1)}-${z(d.getUTCDate())} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}${sec < 60 ? ":" + z(d.getUTCSeconds()) : ""}`; }}
  };
}
/* Binance chart grid: same hairline colour as Binance (#333B46 on #1F2630), wide cells (~65 px rows, ~140 px columns) */
function gridCol(){ return dark() ? "rgba(132,142,156,.2)" : "rgba(132,142,156,.15)"; }
/* LWC's own price-tick step (same algorithm as its PriceTickMarkBuilder) → grid rows sit exactly on a price label, every 1st or 2nd label */
function lwcStep(hi, lo, H, fs, minMove){
  const s = (hi - lo) * Math.ceil(2.5 * fs) / H, eps = 1e-14; let best = Infinity;
  for (const seq of [[2, 2.5, 2], [2, 2, 2.5], [2.5, 2, 2]]){
    let e = Math.pow(10, Math.max(0, Math.ceil(Math.log10(hi - lo)))), r = 0, h = seq[0];
    while (e >= minMove - eps && e > minMove + eps && e >= s * h - eps && e >= 1 - eps){ e /= h; h = seq[++r % 3]; }
    if (e <= minMove + eps) e = minMove; e = Math.max(1, e);
    if (Math.abs(e - 1) < eps && minMove < 1){ const za = [2, 2.5, 2]; r = 0; h = za[0]; while (e >= s * h - eps && e > minMove + eps){ e /= h; h = za[++r % 3]; } }
    best = Math.min(best, e);
  }
  return best;
}
function drawGrid(){
  const cv = ui.grid; if (!cv || !chart || !S.main) return;
  let H, W, ps; try { H = chart.panes()[0].getHeight(); W = el.clientWidth; ps = chart.priceScale("right").width(); } catch { return; }
  const top = S.main.coordinateToPrice(0), bot = S.main.coordinateToPrice(H - 1), dpr = Math.min(2, window.devicePixelRatio || 1);
  const key = [W, el.clientHeight, H, top, bot, dark(), dpr, pctMode].join("|"); if (cv._k === key) return; cv._k = key;
  const Hc = el.clientHeight;
  if (cv._w !== W || cv._h !== Hc || cv._d !== dpr){ cv._w = W; cv._h = Hc; cv._d = dpr; cv.width = W * dpr; cv.height = Hc * dpr; cv.style.width = W + "px"; cv.style.height = Hc + "px"; }
  const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, Hc);
  if (top == null || bot == null || !(top > bot) || pctMode) return;
  const dp = M.get(sym)?.dp ?? 2, mm = Math.pow(10, -dp), st = lwcStep(top, bot, H, 10.5, mm), px = st / (top - bot) * H, step = px >= 52 ? st : st * 2;
  c.fillStyle = gridCol();
  for (let v = Math.ceil(bot / step) * step; v <= top; v += step){ const y = S.main.priceToCoordinate(v); if (y == null || y < 4 || y > H - 4) continue; c.fillRect(0, Math.round(y), W, 1); }
}
const fmtVol = v => v >= 1e9 ? (v/1e9).toFixed(2)+"B" : v >= 1e6 ? (v/1e6).toFixed(2)+"M" : v >= 1e3 ? (v/1e3).toFixed(2)+"K" : (+v).toFixed(v < 10 ? 3 : 2);

function mount(container, parts, detailCb){
  destroy();
  el = container; ui = parts || {}; onDetail = detailCb;
  inds = ui.noInd ? [] : (store.s.settings.inds || []).slice(); { let n = 0; inds = inds.filter(k => k === "VOL" || ++n <= MAXI); } type = store.s.settings.chartType || "candle";
  offs.push(bus.on("tick", onTick), bus.on("trade", onTrade), bus.on("theme", () => { if (chart){ build(); } }), bus.on("positions", syncLines), bus.on("history", syncLines), bus.on("settled", binFx));
  ro = new ResizeObserver(() => chart && chart.applyOptions({width: el.clientWidth, height: el.clientHeight}));
  ro.observe(el);
  // overlay layers
  el.insertAdjacentHTML("afterend", `<svg class="draw-svg" id="drawSvg"></svg><canvas class="liq-cv" id="liqCv"></canvas><div class="liq-tip hide" id="liqTip"></div><div class="lqbox hide" id="lqBox"></div><div class="lqpop hide" id="lqPop"></div><div class="ovl2" id="ovl2"></div><div class="cbox hide" id="cbox"></div><button class="auto-btn hide" id="autoBtn" aria-label="Auto scale">A</button>`);
  el.parentElement.querySelector(":scope > .grid-cv")?.remove(); el.insertAdjacentHTML("beforebegin", `<canvas class="grid-cv" aria-hidden="true"></canvas>`); ui.grid = el.previousElementSibling;
  if (getComputedStyle(el).position === "static") el.style.position = "relative"; el.style.zIndex = "1";
  drawEl = el.parentElement.querySelector("#drawSvg");
  ui.ovl2 = el.parentElement.querySelector("#ovl2"); ui.liq = el.parentElement.querySelector("#liqCv"); ui.liqTip = el.parentElement.querySelector("#liqTip"); ui.lqBox = el.parentElement.querySelector("#lqBox"); ui.lqPop = el.parentElement.querySelector("#lqPop"); ui.cbox = el.parentElement.querySelector("#cbox"); ui.auto = el.parentElement.querySelector("#autoBtn");
  ui.auto.onclick = () => { chart?.priceScale("right").applyOptions({autoScale:true}); ui.auto.classList.add("hide"); };
  bindDraw(); bindAxisTap(); bindDrag(); bindMarks(); bindAxisDrag(); bindPbox(); bindLiq();
  loop();
}

/* ---- Auto-fit: the price scale always contains the visible candles' high AND low (+ room for the legend and the High/Low labels).
   Indicator overlays (SuperTrend, BOLL, ...) never stretch the scale, so candles stay full-size on every timeframe (1s ... 1M). ---- */
function fitInfo(base){
  try {
    if (!chart || !bars.length) return base();
    const vr = chart.timeScale().getVisibleLogicalRange(); if (!vr) return base();
    const lineMode = tf === "tick" || type === "line", L = bars.length - 1;
    let hi = -Infinity, lo = Infinity;
    for (let i = Math.max(0, Math.floor(vr.from)), z = Math.min(L, Math.ceil(vr.to)); i <= z; i++){ const b = bars[i]; const h = lineMode ? b.close : b.high, l = lineMode ? b.close : b.low; if (h > hi) hi = h; if (l < lo) lo = l; }
    if (!(hi >= lo) || !isFinite(hi) || !isFinite(lo)) return base();
    const ref = bars[L].close || hi, minR = Math.max(ref * 0.00035, Math.pow(10, -(M.get(sym)?.dp ?? 2)) * 8);
    if (hi - lo < minR){ const m = (hi + lo) / 2; hi = m + minR / 2; lo = m - minR / 2; }
    const lg = ui.legend ? ui.legend.offsetHeight : 0;
    return {priceRange:{minValue:lo, maxValue:hi}, margins:{above: Math.max(26, lg + 18), below: 26}};
  } catch { return base(); }
}

/* ---- Build / rebuild series ---- */
function build(){
  if (chart){ chart.remove(); chart = null; }
  lines.clear();
  UP = "#2EBD85"; DN = "#F6465D"; syncCols();
  chart = LW.createChart(el, Object.assign({width: el.clientWidth, height: el.clientHeight}, opts()));
  const p = M.get(sym), dp = p?.dp ?? 2, pf = {type:"price", precision:dp, minMove: Math.pow(10, -dp)};
  S = {};
  const lineMode = tf === "tick" || type === "line";
  if (lineMode){
    S.main = chart.addSeries(LW.AreaSeries, {lineColor:"#2E6BFF", topColor:"rgba(46,107,255,.30)", bottomColor:"rgba(46,107,255,0)", lineWidth:1.5, lineType: tf === "tick" ? 2 : 0, priceFormat:pf, autoscaleInfoProvider:fitInfo, lastPriceAnimation:1, lastValueVisible:false, priceLineVisible:true, priceLineColor: dark() ? "#B7BDC6" : "#474D57", priceLineStyle:2, crosshairMarkerRadius:3});
  } else {
    S.main = chart.addSeries(LW.CandlestickSeries, {upColor:UP, downColor:DN, borderVisible:false, wickUpColor:UP, wickDownColor:DN, priceFormat:pf, autoscaleInfoProvider:fitInfo, lastValueVisible:false, priceLineVisible:true, priceLineColor: dark() ? "#B7BDC6" : "#474D57", priceLineStyle:2});
  }
  chart.priceScale("right").applyOptions({mode: pctMode ? 2 : 0});
  try { LW.createTextWatermark(chart.panes()[0], {horzAlign:"center", vertAlign:"center", lines:[{text:"NovaTrade", color: dark() ? "rgba(148,163,184,.07)" : "rgba(100,116,139,.07)", fontSize:28, fontStyle:"700"}]}); } catch {}
  const ln = (color, w=1, pane=0, extra={}) => chart.addSeries(LW.LineSeries, Object.assign({color, lineWidth:w, autoscaleInfoProvider:() => null, priceLineVisible:false, lastValueVisible:false, crosshairMarkerVisible:false, priceFormat:pf}, extra), pane);
  if (!lineMode && inds.includes("MA")){ S.m7 = ln(COL.m7); S.m25 = ln(COL.m25); S.m99 = ln(COL.m99); }
  if (!lineMode && inds.includes("EMA")){ S.e7 = ln(COL.e7); S.e25 = ln(COL.e25); S.e99 = ln(COL.e99); }
  if (!lineMode && inds.includes("BOLL")){ S.bu = ln(COL.boll); S.bm = ln(COL.bollMid, 1, 0, {lineStyle:2}); S.bl = ln(COL.boll); }
  if (!lineMode && inds.includes("SAR")) S.sar = ln(COL.sar, 1, 0, {lineVisible:false, pointMarkersVisible:true, pointMarkersRadius:1.6});
  if (!lineMode && inds.includes("VWAP")) S.vw = ln(COL.vwap, 1.3);
  if (!lineMode && inds.includes("SUPER")) S.st = ln(UP, 1.5);
  srOn = !lineMode && inds.includes("SR"); liqOn = !lineMode && inds.includes("LIQ"); srLines = []; liqKey = "";
  let pane = 1;
  // Volume in its own pane under the candles (Binance style): bars never overlap price, no averages on it
  if (inds.includes("VOL")){
    S.vol = chart.addSeries(LW.HistogramSeries, {priceFormat:{type:"volume"}, lastValueVisible:false, priceLineVisible:false}, pane);
    S.vol.priceScale().applyOptions({scaleMargins:{top:0.22, bottom:0}});
    pane++;
  }
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
  if (!ui.vlg){ ui.vlg = document.createElement("div"); ui.vlg.className = "vol-lg"; }
  el.parentElement.appendChild(ui.vlg); ui.vlg.style.display = S.vol ? "" : "none";
  chart.panes().forEach((pn, i) => { if (i > 0) pn.setHeight(sub); });
  chart.subscribeCrosshairMove(prm => {
    if (!prm || !prm.point){ hover = null; hoverPt = null; lastHov = null; legend(); crossBox(); return; }
    if (prm.time == null){ hover = null; lastHov = null; hoverPt = prm.point; legend(); crossBox(); priceLabel(); return; }   // right / empty area: price + % only
    const i = findIdx(prm.time - TZ); hover = i >= 0 ? i : null; hoverPt = prm.point;
    if (hover != null && hover !== lastHov){ const n = performance.now();   // haptics (Binance-strong): long pulse when the crosshair window opens, a hard 20 ms click on EVERY new candle while sliding (U.buzz respects the haptic setting)
      if (lastHov == null) U.buzz(45); else if (n - lastTick > 16) U.buzz(20); lastTick = n; lastHov = hover; }
    legend(); crossBox();
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
  if (S.m7){ const q = IS("MA"); r.m7 = IND.sma(c,q.p1); r.m25 = IND.sma(c,q.p2); r.m99 = IND.sma(c,q.p3); }
  if (S.e7){ const q = IS("EMA"); r.e7 = IND.ema(c,q.p1); r.e25 = IND.ema(c,q.p2); r.e99 = IND.ema(c,q.p3); }
  if (S.bu){ const q = IS("BOLL"); r.boll = IND.boll(bars, Math.round(q.n), q.m); }
  if (S.sar){ const q = IS("SAR"); r.sar = IND.sar(bars, q.step, q.max); }
  if (S.vw) r.vw = IND.vwap(bars);
  if (S.st){ const q = IS("SUPER"); r.st = superTrend(bars, Math.round(q.n), q.m, q.conf); stSigs = r.st.sig; } else stSigs = [];
  if (S.rsi) r.rsi = IND.rsi(bars, Math.round(IS("RSI").n));
  if (S.mh){ const q = IS("MACD"); r.macd = IND.macd(bars, Math.round(q.f), Math.round(q.s), Math.round(q.g)); }
  return r;
}
/* SuperTrend — NON-REPAINTING: the trend only flips on a CLOSED candle that closes beyond the band by conf×ATR (filters wick noise);
   the forming candle never flips the direction or creates a signal. sig = [{i, d}] (d 1 = BUY, -1 = SELL) on closed candles only. */
function superTrend(bs, n, mult, conf){
  const N = bs.length, val = new Array(N).fill(null), dir = new Array(N).fill(null), sig = [], a = new Array(N).fill(null);
  let pr = null;
  for (let i = 0; i < N; i++){ const b = bs[i], pc = i ? bs[i-1].close : b.close, tr = Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
    if (i < n){ pr = (pr || 0) + tr; if (i === n - 1){ pr /= n; a[i] = pr; } continue; } pr = (pr * (n - 1) + tr) / n; a[i] = pr; }
  let fu = null, fl = null, d = 1;
  for (let i = 0; i < N; i++){
    if (a[i] == null) continue;
    const b = bs[i], closed = i < N - 1, hl2 = (b.high + b.low) / 2, bu = hl2 + mult * a[i], bl = hl2 - mult * a[i], pc = i ? bs[i-1].close : b.close;
    const nfu = fu == null || bu < fu || pc > fu ? bu : fu, nfl = fl == null || bl > fl || pc < fl ? bl : fl;
    let nd = d;
    if (closed && val[i-1] != null){ if (d === 1 && b.close < nfl - conf * a[i]) nd = -1; else if (d === -1 && b.close > nfu + conf * a[i]) nd = 1; }
    if (closed){ fu = nfu; fl = nfl; if (nd !== d && val[i-1] != null) sig.push({i, d:nd}); d = nd; }
    val[i] = d === 1 ? nfl : nfu; dir[i] = d;
  }
  return {val, dir, sig};
}
/* Support / Resistance zones — only levels a human would draw: confirmed swing pivots (k bars each side) that price turned at TWICE or more,
   merged into a cluster (one thin zone); max 2-3 per side, spaced apart, nearest-strongest first. If a side has no repeated pivot, the single
   most prominent swing high/low on that side is used instead. Returns zones [{p, lo, hi, n, i0}] — drawn as thin translucent rectangles. */
function calcSR(){
  const q = IS("SR"), lv = Math.max(1, Math.min(3, Math.round(q.lv))), k0 = Math.max(2, Math.round(q.k)), L = bars.length - 1, out = {res:[], sup:[]};
  if (L < 24) return out;
  const last = bars[L].close, from = Math.max(0, L - 700); let atr = 0, cn = 0; for (let i = Math.max(1, L - 30); i < L; i++){ atr += bars[i].high - bars[i].low; cn++; } atr = atr / (cn || 1);
  const tol = Math.max(atr * 0.9, last * 0.0003), far = last * 0.2;
  const pivots = k => { const piv = [];
    for (let i = from + k; i <= L - 1 - k; i++){
      let h = true, l = true; for (let j = 1; j <= k; j++){ if (bars[i-j].high >= bars[i].high || bars[i+j].high > bars[i].high) h = false; if (bars[i-j].low <= bars[i].low || bars[i+j].low < bars[i].low) l = false; if (!h && !l) break; }
      if (h) piv.push({p:bars[i].high, i}); if (l) piv.push({p:bars[i].low, i}); }
    return piv; };
  const cluster = piv => { const cl = []; piv.sort((x, y) => x.p - y.p);
    piv.forEach(v => { const c = cl[cl.length - 1]; if (c && v.p - c.sum / c.n <= tol){ c.sum += v.p; c.n++; c.hi = v.p; c.last = Math.max(c.last, v.i); c.first = Math.min(c.first, v.i); } else cl.push({sum:v.p, n:1, lo:v.p, hi:v.p, last:v.i, first:v.i}); });
    return cl.map(c => { const m = c.sum / c.n, th = Math.min(Math.max(c.hi - c.lo, atr * 0.15), atr * 0.4, last * 0.0028); return {p:m, lo:m - th / 2, hi:m + th / 2, n:c.n, i0:c.first, sc:c.n * 10 + c.last / L * 6 - Math.abs(m - last) / far * 4}; }); };
  const pick = (arr, side) => { const o = []; arr.sort((x, y) => y.sc - x.sc).forEach(z => { if (o.length < lv && !o.some(y => Math.abs(y.p - z.p) < tol * 1.6)) o.push(z); }); return o.sort((x, y) => side === "res" ? x.p - y.p : y.p - x.p); };
  let cand = [];
  for (const k of [k0, 3, 2]){
    cand = cluster(pivots(k)).filter(z => z.n >= 2);
    const r = cand.filter(z => z.p > last + tol * 0.5 && z.p - last < far), sp = cand.filter(z => z.p < last - tol * 0.5 && last - z.p < far);
    out.res = pick(r, "res"); out.sup = pick(sp, "sup");
    if (out.res.length && out.sup.length) break;
  }
  // fallback: the most prominent single swing on a side that has no repeated pivot
  const all = cluster(pivots(Math.max(3, k0)));
  if (!out.res.length){ const z = all.filter(z => z.p > last + tol * 0.5 && z.p - last < far).sort((x, y) => y.p - x.p)[0]; if (z) out.res = [z]; }
  if (!out.sup.length){ const z = all.filter(z => z.p < last - tol * 0.5 && last - z.p < far).sort((x, y) => x.p - y.p)[0]; if (z) out.sup = [z]; }
  return out;
}
function syncSR(){
  if (!S.main) return;
  const lastC = bars.length ? bars[bars.length-1].close : 0;
  const key = srOn ? bars.length + "|" + bars[bars.length-1]?.time + "|" + JSON.stringify(IS("SR")) + "|" + Math.round(lastC / (lastC * 0.0015 || 1)) : "";
  if (key === srKey) return; srKey = key;
  srLines.forEach(l => { try { S.main.removePriceLine(l); } catch {} }); srLines = []; srZones = [];
  if (!srOn || !bars.length) return;
  const r = calcSR();
  srZones = [...r.res.map(z => Object.assign({k:"r"}, z)), ...r.sup.map(z => Object.assign({k:"s"}, z))];
}
/* LIQ — estimated liquidation map (a model built from the chart's own candles, not an exchange order feed).
   Every confirmed swing high / low (and each window extreme) is treated as a place where leveraged positions were opened; for each
   leverage in the settings (10x 25x 50x 100x) the liquidation price is entry x (1 -/+ 0.92/lev), sized by the candle's quote volume x a
   leverage weight x recency. Levels still ahead of the price are OPEN (longs below, shorts above); levels the price already traded through
   are LIQUIDATED at the candle that swept them. Only the big clusters are kept (C6c) and close neighbours are merged (C6f). */
const LEVW = {10:1, 25:.85, 50:.65, 100:.45};
const liqBias = (l, s) => s > l * 1.15 ? "Long" : l > s * 1.15 ? "Short" : "Neutral";
function calcLiq(bs, q){
  q = q || IS("LIQ"); bs = bs || bars;
  const levs = String(q.lev).split(",").map(Number).filter(x => x >= 2 && x <= 200), L = bs.length - 1;
  if (L < 20 || !levs.length) return null;
  const from = Math.max(0, L - 500), k = 3, last = bs[L].close;
  let lo = Infinity, hi = -Infinity; for (let i = from; i <= L; i++){ lo = Math.min(lo, bs[i].low); hi = Math.max(hi, bs[i].high); }
  const pad = Math.max((hi - lo) * 0.25, (hi + lo) / 2 * 0.025), rLo = lo - pad, rHi = hi + pad, nb = Math.max(60, Math.min(600, Math.round(q.bins))), bw = (rHi - rLo) / nb;
  let vmax = 0; for (let i = from; i <= L; i++) vmax = Math.max(vmax, bs[i].volume || 0); const vfb = vmax || 1;
  const minAfter = new Array(L + 2).fill(Infinity), maxAfter = new Array(L + 2).fill(-Infinity);
  for (let i = L; i >= 0; i--){ minAfter[i] = Math.min(minAfter[i+1], bs[i].low); maxAfter[i] = Math.max(maxAfter[i+1], bs[i].high); }
  const bins = Array.from({length:nb}, () => ({usd:0, i0:L})), sweeps = new Map();
  const add = (price, usd, i0, long) => {
    if (price < rLo || price >= rHi) return;
    const hit = long ? minAfter[i0 + 1] <= price : maxAfter[i0 + 1] >= price;
    if (!hit){ const b = bins[Math.floor((price - rLo) / bw)]; b.usd += usd; b.i0 = Math.min(b.i0, i0); return; }
    let j = i0 + 1; while (j <= L && !(long ? bs[j].low <= price : bs[j].high >= price)) j++;   // the candle that liquidated it
    if (j > L) return; const key = j + (long ? "l" : "s"), o = sweeps.get(key) || {j, side: long ? "l" : "s", usd:0, pw:0}; o.usd += usd; o.pw += usd * price; sweeps.set(key, o);
  };
  const piv = (i, kk) => { let h = true, l = true; for (let j = 1; j <= kk; j++){ if (bs[i-j].high >= bs[i].high || bs[i+j].high > bs[i].high) h = false; if (bs[i-j].low <= bs[i].low || bs[i+j].low < bs[i].low) l = false; } return [h, l]; };
  const use = (i, h, l, sw) => {
    const vol = (bs[i].volume || 0) || vfb * 0.2, usd0 = vol * bs[i].close, rec = 0.55 + 0.45 * (i - from) / (L - from);
    levs.forEach(lv => { const wt = (LEVW[lv] ?? 0.5) * rec * sw * 0.9, f = 0.92 / lv;
      if (l) add(bs[i].low * (1 - f), usd0 * wt, i, true);
      if (h) add(bs[i].high * (1 + f), usd0 * wt, i, false);
    });
  };
  for (let i = from + 2; i <= L - 2; i++){
    let [h, l] = i >= from + k && i <= L - k ? piv(i, k) : [false, false], sw = 1;   // strong pivots (3 bars each side) + weaker ones (2 bars, 60% weight)
    if (!h && !l){ [h, l] = piv(i, 2); sw = 0.6; }
    if (h || l) use(i, h, l, sw);
  }
  const win = Math.max(6, Math.round((L - from) / 24));   // window extremes: thin 1s…30s data still gets a map
  for (let w0 = from; w0 <= L - 1; w0 += win){ let hi2 = w0, lo2 = w0; for (let i = w0; i < Math.min(L, w0 + win); i++){ if (bs[i].high > bs[hi2].high) hi2 = i; if (bs[i].low < bs[lo2].low) lo2 = i; } use(hi2, true, false, 0.5); use(lo2, false, true, 0.5); }
  const mid = n => rLo + (n + .5) * bw;
  let totL = 0, totS = 0; bins.forEach((b, n) => { if (b.usd) mid(n) < last ? totL += b.usd : totS += b.usd; });
  // clusters = local peaks (±2 bins), mass = the peak bin + its two neighbours
  const pk = [];
  for (let n = 0; n < nb; n++){ const u = bins[n].usd; if (!u) continue; let top = true;
    for (let d = -2; d <= 2 && top; d++){ if (!d) continue; const v = bins[n + d] ? bins[n + d].usd : 0; if (v > u || (v === u && d < 0)) top = false; }
    if (!top) continue; let m = 0, pw = 0, i0 = L; for (let d = -1; d <= 1; d++){ const b = bins[n + d]; if (b && b.usd){ m += b.usd; pw += b.usd * mid(n + d); i0 = Math.min(i0, b.i0); } }
    pk.push({p:pw / m, usd:m, i0, side: mid(n) < last ? "l" : "s"}); }
  const gmx = pk.reduce((a, v) => Math.max(a, v.usd), 0), groups = [];
  ["l", "s"].forEach(sd => {
    const arr = pk.filter(v => v.side === sd), mx = arr.reduce((a, v) => Math.max(a, v.usd), 0);
    // only the levels that matter: >= 30% of the biggest level on this side and >= 12% of the biggest overall, max 6 → max 4 lines per side
    const sig = arr.filter(v => v.usd >= mx * 0.3 && v.usd >= gmx * 0.12).sort((a, b) => b.usd - a.usd).slice(0, 6).sort((a, b) => Math.abs(a.p - last) - Math.abs(b.p - last));
    const gs = [];
    // a level within ~25% (of its distance to the price) of a nearer one joins it — at most 3 levels in one line
    sig.forEach(v => { const g = gs.find(g => g.m.length < 3 && Math.abs(v.p - g.m[0].p) <= Math.abs(g.m[0].p - last) * 0.25); if (g) g.m.push(v); else gs.push({m:[v]}); });
    gs.forEach(g => { g.usd = g.m.reduce((a, v) => a + v.usd, 0); g.p = g.m.reduce((a, v) => a + v.p * v.usd, 0) / g.usd; g.i0 = Math.min(...g.m.map(v => v.i0)); g.side = sd; g.m.sort((a, b) => b.p - a.p); });
    gs.sort((a, b) => b.usd - a.usd).slice(0, 4).forEach(g => groups.push(g));
  });
  const past = [...sweeps.values()].map(o => ({j:o.j, side:o.side, usd:o.usd, p:o.pw / o.usd})), smx = past.reduce((a, v) => Math.max(a, v.usd), 0);
  return {groups, gmx: groups.reduce((a, g) => Math.max(a, g.usd), 0), past: past.filter(o => o.usd >= smx * 0.18), totL, totS, last, bias: liqBias(totL, totS), n: bs.length,
    chg: (last - bs[Math.max(0, L - 50)].close) / bs[Math.max(0, L - 50)].close * 100};
}
const fmtUsd = v => "$" + (v >= 1e9 ? (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : v.toFixed(0));
const LQC = () => dark() ? {line:"252,213,53", lab:"rgba(24,28,36,.9)", txt:"#FCD535", brd:"rgba(252,213,53,.35)"} : {line:"201,148,0", lab:"rgba(255,255,255,.95)", txt:"#9A6B00", brd:"rgba(201,148,0,.45)"};
const LQ_UP = "#2EBD85", LQ_DN = "#F6465D";
function drawLiq(occ){
  const cv = ui.liq; if (!cv) return;
  if (!liqOn || !chart || !S.main || !bars.length){
    if (cv._on){ cv._on = false; cv._hit = null; const c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height); ui.liqTip?.classList.add("hide"); ui.lqBox?.classList.add("hide"); ui.lqPop?.classList.add("hide"); } return; }
  const key = sym + "|" + tf + "|" + bars.length + "|" + bars[bars.length-1].time + JSON.stringify(IS("LIQ"));
  if (!liqData || liqData._k !== key){ liqData = calcLiq(bars); if (liqData) liqData._k = key; else liqData = {none:true, _k:key}; }
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = el.clientWidth, H = chart.panes()[0].getHeight(), pw = chart.timeScale().width();
  if (cv._w !== W || cv._h !== H || cv._d !== dpr){ cv._w = W; cv._h = H; cv._d = dpr; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px"; }
  const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); cv._on = true; const hits = cv._hit = [];
  liqBoxSync();
  if (liqData.none) return;
  const d = liqData, ts = chart.timeScale(), C = LQC(), px = bars[bars.length - 1].close;
  const X0 = i => { const x = ts.logicalToCoordinate(i); return x == null ? 0 : Math.max(0, Math.min(pw, x)); };
  // 1) open levels: one thin line per (merged) cluster; drawn ONLY while its price is inside the visible price range — no edge pinning
  const vis = [];
  d.groups.forEach(g => { const y = S.main.priceToCoordinate(g.p); if (y == null || y < 4 || y > H - 4) return;
    const x0 = X0(g.i0), t = Math.sqrt(g.usd / (d.gmx || 1)), th = g.m.length > 1 ? 2.5 : 1.25;
    c.fillStyle = `rgba(${C.line},${(0.32 + 0.5 * t).toFixed(2)})`; c.fillRect(x0, Math.round(y) - th / 2, pw - x0, th);
    hits.push({x0, x1:pw, y0:y - 7, y1:y + 7, g, pri:1}); vis.push({g, y}); });
  // 2) amount labels sit ON their own line (right end); the smaller of two touching labels is skipped instead of being moved
  c.font = "700 10px Manrope, system-ui, sans-serif"; c.textBaseline = "middle"; c.textAlign = "left";
  const placed = [];
  vis.sort((a, b) => b.g.usd - a.g.usd).forEach(({g, y}) => {
    if (placed.some(q => Math.abs(q - y) < 15)) return; placed.push(y);
    const tx = fmtUsd(g.usd), n = g.m.length, tw = c.measureText(tx).width + 18 + (n > 1 ? 15 : 0), x = pw - 4 - tw;
    c.fillStyle = C.lab; c.strokeStyle = C.brd; c.lineWidth = 1; c.beginPath(); c.roundRect(x + .5, y - 7.5, tw, 15, 7.5); c.fill(); c.stroke();
    c.fillStyle = g.side === "s" ? LQ_UP : LQ_DN; c.beginPath(); c.arc(x + 8, y, 2.6, 0, 6.3); c.fill();
    c.fillStyle = C.txt; c.fillText(tx, x + 13, y + .5);
    if (n > 1){ const bx = x + tw - 15; c.fillStyle = C.brd; c.beginPath(); c.roundRect(bx, y - 5.5, 11, 11, 3); c.fill(); c.fillStyle = C.txt; c.font = "800 8px Manrope, system-ui, sans-serif"; c.textAlign = "center"; c.fillText(String(n), bx + 5.5, y + .5); c.textAlign = "left"; c.font = "700 10px Manrope, system-ui, sans-serif"; }
    hits.push({x0:x - 4, x1:x + tw + 4, y0:y - 11, y1:y + 11, g, pri:3});
  });
  // 3) liquidations that already happened: amount UNDER the candle that triggered them, arrow pointing up at it, below any B / BUY tag
  const vr = ts.getVisibleLogicalRange();
  if (vr && d.past.length){
    const v0 = Math.max(0, Math.floor(vr.from)), v1 = Math.min(bars.length - 1, Math.ceil(vr.to)), used = [];
    c.font = "700 9px Manrope, system-ui, sans-serif"; c.textAlign = "center";
    d.past.filter(o => o.j >= v0 && o.j <= v1).sort((a, b) => b.usd - a.usd).forEach(o => {
      if (used.length >= 6) return; const x = ts.logicalToCoordinate(o.j), b = bars[o.j]; if (x == null || x < 14 || x > pw - 14) return;
      const yl = S.main.priceToCoordinate(b.low); if (yl == null) return;
      const top = yl + ((occ && occ[o.j]) || 3), tx = fmtUsd(o.usd), tw = c.measureText(tx).width + 10;
      if (top + 20 > H) return; if (used.some(u => Math.abs(u.x - x) < (u.w + tw) / 2 + 3 && Math.abs(u.y - top) < 20)) return;
      used.push({x, y:top, w:tw});
      const col = o.side === "l" ? LQ_DN : LQ_UP;
      c.fillStyle = col; c.beginPath(); c.moveTo(x, top); c.lineTo(x - 3.5, top + 4.5); c.lineTo(x + 3.5, top + 4.5); c.closePath(); c.fill();
      c.globalAlpha = dark() ? .9 : 1; c.fillStyle = dark() ? "rgba(24,28,36,.92)" : "rgba(255,255,255,.95)"; c.beginPath(); c.roundRect(x - tw / 2, top + 4.5, tw, 13, 3); c.fill();
      c.strokeStyle = col; c.lineWidth = 1; c.stroke(); c.globalAlpha = 1;
      c.fillStyle = col; c.fillText(tx, x, top + 11.5);
      hits.push({x0:x - tw / 2 - 3, x1:x + tw / 2 + 3, y0:top - 2, y1:top + 20, o, pri:2});
    });
    c.textAlign = "left";
  }
}
/* fixed data window (top-left): open long / short totals, suggestion with "?" (basis + other timeframes) and "i" (data source) */
const ICN_I = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5v.1"/></svg>`;
function liqBoxSync(){
  const bx = ui.lqBox; if (!bx) return;
  const d = liqData; if (!d || d.none){ bx.classList.add("hide"); return; }
  const top = ui.legend && ui.legend.offsetHeight ? ui.legend.offsetTop + ui.legend.offsetHeight + 4 : 6;
  const cls = d.bias === "Long" ? "up" : d.bias === "Short" ? "down" : "";
  const h = `<div class="lqb-h"><b>Liquidation map</b><button class="lqb-i" data-lqi aria-label="Data source">${ICN_I}</button></div>
    <div class="lqb-r"><i style="background:${LQ_DN}"></i><span>Long liq.</span><b class="num">${fmtUsd(d.totL)}</b></div>
    <div class="lqb-r"><i style="background:${LQ_UP}"></i><span>Short liq.</span><b class="num">${fmtUsd(d.totS)}</b></div>
    <div class="lqb-s"><span>Suggestion</span><b class="${cls}">${d.bias}</b><button class="lqb-q" data-lqq aria-label="How the suggestion works">?</button></div>`;
  if (bx._h !== h){ bx._h = h; bx.innerHTML = h; }
  if (bx._t !== top){ bx._t = top; bx.style.top = top + "px"; }
  bx.classList.remove("hide");
}
function liqPop(title, html){
  const p = ui.lqPop; if (!p) return;
  p.innerHTML = `<div class="lqp-h"><b>${title}</b><button class="lqp-x" data-lqx aria-label="Close">${U.ic("close", 14)}</button></div><div class="lqp-b">${html}</div>`;
  p.classList.remove("hide"); ui.liqTip?.classList.add("hide");
}
const mtfCache = new Map();
async function liqBasis(){
  const d = liqData; if (!d || d.none) return; const s0 = sym, P = M.get(sym), TFN = {"1s":"1s","5s":"5s","30s":"30s","1m":"1m","5m":"5m","15m":"15m","1h":"1H","4h":"4H","1d":"1D","3d":"3D","1w":"1W","1M":"1M"};
  const tfs = [tf, ...["15m", "1h", "4h", "1d"].filter(x => x !== tf)].slice(0, 4);
  const row = (t, x) => !x ? `<tr><td>${TFN[t] || t}</td><td colspan="4" class="lqp-mut">${x === undefined ? "Loading…" : "No data"}</td></tr>` :
    `<tr${t === tf ? ' class="cur"' : ""}><td>${TFN[t] || t}</td><td class="num">${fmtUsd(x.totL)}</td><td class="num">${fmtUsd(x.totS)}</td><td class="num ${x.chg >= 0 ? "up" : "down"}">${x.chg >= 0 ? "+" : ""}${x.chg.toFixed(2)}%</td><td class="${x.bias === "Long" ? "up" : x.bias === "Short" ? "down" : ""}"><b>${x.bias}</b></td></tr>`;
  const near = (sd) => { const g = d.groups.filter(g => g.side === sd).sort((a, b) => Math.abs(a.p - d.last) - Math.abs(b.p - d.last))[0]; return g ? `${M.fmtPx(P, g.p)} (${((g.p - d.last) / d.last * 100).toFixed(2)}%) · ${fmtUsd(g.usd)}` : "--"; };
  const body = list => `<p>The map adds up where leveraged positions opened at recent swing highs and lows would be force-closed. Price is often pulled toward the <b>bigger pool</b> of liquidity, so:</p>
    <ul class="lqp-ul"><li>Short liquidations above &gt; long liquidations below (by 15%+) → <b class="up">Long</b></li><li>Long liquidations below &gt; short above (by 15%+) → <b class="down">Short</b></li><li>Within 15% of each other → <b>Neutral</b></li></ul>
    <div class="lqp-kv"><span>Nearest short cluster</span><b class="num">${near("s")}</b></div><div class="lqp-kv"><span>Nearest long cluster</span><b class="num">${near("l")}</b></div>
    <div class="lqp-sec">Across timeframes</div>
    <table class="lqp-t"><thead><tr><th>TF</th><th>Long liq.</th><th>Short liq.</th><th>Trend*</th><th>Bias</th></tr></thead><tbody>${list.map(([t, x]) => row(t, x)).join("")}</tbody></table>
    ${list.length > 1 && list.every(([, x]) => x !== undefined) ? (() => { const v = list.filter(([, x]) => x), nL = v.filter(([, x]) => x.bias === "Long").length, nS = v.filter(([, x]) => x.bias === "Short").length;
      return `<div class="lqp-sum">${nL > nS ? `<b class="up">${nL} of ${v.length}</b> timeframes lean Long` : nS > nL ? `<b class="down">${nS} of ${v.length}</b> timeframes lean Short` : "Timeframes are mixed"}${nL === v.length || nS === v.length ? " — all aligned" : ""}.</div>`; })() : `<div class="lqp-sum lqp-mut">Loading other timeframes…</div>`}
    <p class="lqp-mut">*Trend = price change over the last 50 candles of that timeframe. Current chart: ${TFN[tf] || tf}. A suggestion is a liquidity read, not a guarantee; always use a stop loss.</p>`;
  const list = tfs.map(t => [t, t === tf ? d : (mtfCache.get(s0 + "|" + t + "|" + Math.floor(Date.now() / 60000)) )]);
  liqPop("Why " + d.bias + "?", body(list));
  const got = await Promise.all(tfs.map(async t => { if (t === tf) return d; const k = s0 + "|" + t + "|" + Math.floor(Date.now() / 60000); if (mtfCache.has(k)) return mtfCache.get(k);
    try { const r = calcLiq(await M.candles(s0, t)); mtfCache.set(k, r); return r; } catch { return null; } }));
  if (s0 !== sym || !ui.lqPop || ui.lqPop.classList.contains("hide") || !ui.lqPop.querySelector(".lqp-t")) return;
  ui.lqPop.querySelector(".lqp-b").innerHTML = body(tfs.map((t, i) => [t, got[i]]));
}
function liqSource(){
  const P = M.get(sym), cr = P && P.type === "crypto", q = IS("LIQ");
  liqPop("Data source", `<div class="lqp-kv"><span>Market data</span><b>${cr ? "Binance (spot klines)" : "NovaTrade market feed"}</b></div>
    <div class="lqp-kv"><span>Pair / interval</span><b>${U.esc(M.label ? M.label(P) : sym)} · ${tf}</b></div>
    <div class="lqp-kv"><span>Inputs</span><b>Open, high, low, close, ${cr ? "traded volume" : "tick volume"}</b></div>
    <div class="lqp-kv"><span>Leverage tiers</span><b>${String(q.lev).split(",").join("x, ")}x</b></div>
    <div class="lqp-kv"><span>Candles used</span><b class="num">${Math.min(500, bars.length).toLocaleString("en-US")}</b></div>
    <p>These are <b>estimated</b> liquidation levels calculated from ${cr ? "Binance price and volume data" : "price and tick-volume data"} — not individual liquidation orders reported by an exchange. Positions are assumed to open at swing highs and lows; their liquidation price is worked out for each leverage tier and sized by the candle's ${cr ? "USDT volume" : "activity (relative units)"}.</p>
    <p>Open levels are still ahead of the price. Once the price trades through a level it counts as liquidated and the amount is shown under that candle. Only the largest clusters are drawn; levels close to each other are merged into one thicker line (tap it for each level).</p>
    <p class="lqp-mut">Impact % = a level's share of all open estimated liquidations on this chart. Updates with every new candle. Positions on other exchanges are not included.</p>`);
}
function liqTipFor(h, x, y){
  const tip = ui.liqTip, P = M.get(sym), d = liqData; if (!tip || !d) return;
  const tot = (d.totL + d.totS) || 1, pc = v => (v / tot * 100).toFixed(v / tot < 0.1 ? 2 : 1) + "%";
  if (h.g){ const g = h.g, side = g.side === "l" ? "Long" : "Short", sideTot = (g.side === "l" ? d.totL : d.totS) || 1, dist = (g.p - d.last) / d.last * 100;
    tip.innerHTML = `<div class="lqt-h"><i style="background:${g.side === "l" ? LQ_DN : LQ_UP}"></i><b>${side} liquidations</b></div>
      <div class="lqt-kv"><span>${g.m.length > 1 ? "Avg. price" : "Price"}</span><b class="num">${M.fmtPx(P, g.p)} <small>${dist >= 0 ? "+" : ""}${dist.toFixed(2)}%</small></b></div>
      <div class="lqt-kv"><span>Amount</span><b class="num">~${fmtUsd(g.usd)}</b></div>
      <div class="lqt-imp"><span>Impact</span><b class="num">${pc(g.usd)}</b><small>${(g.usd / sideTot * 100).toFixed(1)}% of ${side.toLowerCase()} side</small></div>
      ${g.m.length > 1 ? `<div class="lqt-m">${g.m.map(v => `<div><span class="num">${M.fmtPx(P, v.p)}</span><b class="num">${fmtUsd(v.usd)}</b><em class="num">${pc(v.usd)}</em></div>`).join("")}</div>` : ""}`;
  } else { const o = h.o, b = bars[o.j], dt = new Date(b.time * 1000), z = n => String(n).padStart(2, "0");
    tip.innerHTML = `<div class="lqt-h"><i style="background:${o.side === "l" ? LQ_DN : LQ_UP}"></i><b>${o.side === "l" ? "Longs" : "Shorts"} liquidated</b></div>
      <div class="lqt-kv"><span>Candle</span><b class="num">${z(dt.getMonth() + 1)}-${z(dt.getDate())} ${z(dt.getHours())}:${z(dt.getMinutes())}</b></div>
      <div class="lqt-kv"><span>Avg. level</span><b class="num">${M.fmtPx(P, o.p)}</b></div>
      <div class="lqt-kv"><span>Amount</span><b class="num">~${fmtUsd(o.usd)}</b></div>`; }
  tip.classList.remove("hide");
  const W = el.clientWidth, tw = tip.offsetWidth || 170, th = tip.offsetHeight || 80, Hh = el.clientHeight;
  tip.style.left = Math.max(4, Math.min(x - tw / 2, W - tw - 66)) + "px"; tip.style.top = Math.max(4, Math.min(y - th - 12 < 4 ? y + 14 : y - th - 12, Hh - th - 4)) + "px";
}
function bindLiq(){
  const host = el.parentElement; let st = null, tm = 0;
  ui.lqBox?.addEventListener("click", e => { if (e.target.closest("[data-lqq]")){ U.buzz(10); liqBasis(); } else if (e.target.closest("[data-lqi]")){ U.buzz(10); liqSource(); } });
  ui.lqPop?.addEventListener("click", e => { if (e.target.closest("[data-lqx]")) ui.lqPop.classList.add("hide"); });
  host.addEventListener("pointerdown", e => { st = {x:e.clientX, y:e.clientY, t:Date.now()}; }, true);
  host.addEventListener("pointerup", e => {
    if (!st || !liqOn || !liqData || liqData.none || !S.main) { st = null; return; }
    const s0 = st; st = null; if (Math.hypot(e.clientX - s0.x, e.clientY - s0.y) > 8 || Date.now() - s0.t > 450) return;
    if (e.target.closest("[data-drag],[data-mk],.pbox,.lqbox,.lqpop")) return;
    const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, tip = ui.liqTip; if (!tip) return;
    const hs = (ui.liq && ui.liq._hit || []).filter(h => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1).sort((a, b) => b.pri - a.pri);
    if (!hs.length){ tip.classList.add("hide"); return; }
    U.buzz(10); liqTipFor(hs[0], x, y);
    clearTimeout(tm); tm = setTimeout(() => tip.classList.add("hide"), 6000);
  }, true);
}
function point(i, r){
  const b = bars[i], t = T(b.time), o = {};
  o.main = (tf === "tick" || type === "line") ? {time:t, value:b.close} : {time:t, open:b.open, high:b.high, low:b.low, close:b.close};
  if (S.vol) o.vol = {time:t, value:b.volume || 0, color: b.close >= b.open ? "rgba(46,189,133,.7)" : "rgba(246,70,93,.7)"};
  const lp = arr => arr[i] == null ? {time:t} : {time:t, value:arr[i]};
  if (S.m7){ o.m7 = lp(r.m7); o.m25 = lp(r.m25); o.m99 = lp(r.m99); }
  if (S.e7){ o.e7 = lp(r.e7); o.e25 = lp(r.e25); o.e99 = lp(r.e99); }
  if (S.bu){ o.bu = lp(r.boll.up); o.bm = lp(r.boll.mid); o.bl = lp(r.boll.lo); }
  if (S.sar) o.sar = r.sar.val[i] == null ? {time:t} : {time:t, value:r.sar.val[i], color: r.sar.dir[i] === 1 ? UP : DN};
  if (S.vw) o.vw = lp(r.vw);
  if (S.st) o.st = r.st.val[i] == null ? {time:t} : {time:t, value:r.st.val[i], color: r.st.dir[i] === 1 ? UP : DN};
  if (S.rsi) o.rsi = lp(r.rsi);
  if (S.mh){ o.mh = r.macd.hist[i] == null ? {time:t} : {time:t, value:r.macd.hist[i], color: r.macd.hist[i] >= 0 ? "rgba(46,189,133,.7)" : "rgba(246,70,93,.7)"}; o.ml = lp(r.macd.line); o.ms = lp(r.macd.signal); }
  return o;
}
function seriesKeys(){ return Object.keys(S).filter(k => S[k] && typeof S[k].setData === "function"); }
function setAll(){
  if (!chart) return;
  const r = cache = calc(), keys = seriesKeys(), data = {}; keys.forEach(k => data[k] = []);
  for (let i=0;i<bars.length;i++){ const o = point(i, r); keys.forEach(k => o[k] && data[k].push(o[k])); }
  try { keys.forEach(k => S[k].setData(data[k])); } catch(e){ console.warn(e); }
  liqData = null; srKey = ""; syncSR();
  legend();
}
function renderLast(){
  if (!chart || !bars.length) return;
  const r = cache = calc(), o = point(bars.length - 1, r);
  try { Object.keys(o).forEach(k => S[k] && S[k].update(o[k])); } catch(e){ setAll(); }
  if (S.st){ const L = bars.length - 1, st = cache.st; if (st && st.sig.length && st.sig[st.sig.length-1].i >= L - 3){ /* a flip on a just-closed candle repaints colours of earlier points once */ if (renderLast._n !== bars.length){ renderLast._n = bars.length; setAll(); } } }
  syncSR();
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
  const now = Math.floor(Date.now()/1000), l0 = bars[bars.length-1], bt = sec > 86400 && l0 && now < l0.time + sec ? l0.time : Math.floor(now/sec)*sec, l = l0;
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
  overlay(); drawGrid(); renderDraw(); if (CH.frame) CH.frame();   // every frame → HTML labels move in sync with the canvas while panning
}

/* ---- Legend (indicator values, top-left) ---- */
function legend(){
  if (!ui.legend || !bars.length) return;
  const i = hover ?? bars.length - 1, p = M.get(sym), f = v => v == null ? "--" : M.fmtPx(p, v), r = cache;
  let h = "";
  if (r.m7) h += `<div><span>MA(${IS("MA").p1}) <b style="color:${COL.m7}">${f(r.m7[i])}</b></span><span>MA(${IS("MA").p2}) <b style="color:${COL.m25}">${f(r.m25[i])}</b></span><span>MA(${IS("MA").p3}) <b style="color:${COL.m99}">${f(r.m99[i])}</b></span></div>`;
  if (r.e7) h += `<div><span>EMA(${IS("EMA").p1}) <b style="color:${COL.e7}">${f(r.e7[i])}</b></span><span>EMA(${IS("EMA").p2}) <b style="color:${COL.e25}">${f(r.e25[i])}</b></span><span>EMA(${IS("EMA").p3}) <b style="color:${COL.e99}">${f(r.e99[i])}</b></span></div>`;
  if (r.boll) h += `<div><span>BOLL(${IS("BOLL").n},${IS("BOLL").m}) <b style="color:${COL.bollMid}">${f(r.boll.mid[i])}</b></span><span>UB <b style="color:${COL.boll}">${f(r.boll.up[i])}</b></span><span>LB <b style="color:${COL.boll}">${f(r.boll.lo[i])}</b></span></div>`;
  if (r.sar) h += `<div><span>SAR(${IS("SAR").step},${IS("SAR").max}) <b style="color:${COL.sar}">${f(r.sar.val[i])}</b></span></div>`;
  if (r.vw) h += `<div><span>VWAP <b style="color:${COL.vwap}">${f(r.vw[i])}</b></span></div>`;
  if (r.st) h += `<div><span>SUPERTREND(${IS("SUPER").n},${IS("SUPER").m}) <b style="color:${r.st.dir[i] === 1 ? UP : DN}">${f(r.st.val[i])}</b></span></div>`;
  ui.legend.innerHTML = h;
  if (S.vol && ui.vlg && chart){ const b = bars[i] || {}, v = b.volume || 0, q = v * (b.close || 0), k = n => n >= 1e9 ? (n/1e9).toFixed(2) + "B" : n >= 1e6 ? (n/1e6).toFixed(2) + "M" : n >= 1e3 ? (n/1e3).toFixed(2) + "K" : n.toFixed(2);
    try { ui.vlg.style.top = (chart.panes()[0].getHeight() + 3) + "px"; } catch {}
    ui.vlg.innerHTML = `Vol(${U.esc(p.base || "")}): <b>${k(v)}</b>&nbsp;&nbsp;Vol(${U.esc(p.quote || "USDT")}): <b>${k(q)}</b>`; }
}
/* ---- Crosshair window (Time/Open/High/Low/Close/Chg/%Chg/Range/Vol) + price/% label ---- */
function crossBox(){
  const box = ui.cbox; if (!box) return;
  if (hover == null || !hoverPt){ box.classList.add("hide"); if (!hoverPt){ ui.xlab && ui.xlab.remove(); ui.xlab = null; } return; }
  const b = bars[hover], p = M.get(sym), f = v => M.fmtPx(p, v), prev = hover ? bars[hover-1].close : b.open;
  const ch = b.close - prev, chp = ch / prev * 100, rng = (b.high - b.low) / (b.low || 1) * 100, d = new Date(b.time*1000);
  const ts = `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")},${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}${sec < 60 ? ":" + String(d.getSeconds()).padStart(2,"0") : ""}`;
  const c = ch >= 0 ? "up" : "down";
  box.innerHTML = [["Time",ts],["Open",f(b.open)],["High",f(b.high)],["Low",f(b.low)],["Close",f(b.close)],["Chg",`<span class="${c}">${ch>=0?"+":""}${M.fmtPx(p,ch)}</span>`],["%Chg",`<span class="${c}">${chp>=0?"+":""}${chp.toFixed(2)}%</span>`],["Range",rng.toFixed(2)+"%"],["Vol",fmtVol(b.volume||0)]].map(([k,v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
  const bt = lastMarks.filter(m => { const i = barAt(Math.floor(m.t / 1000)); return i === hover; });
  if (bt.length) box.innerHTML += bt.slice(0, 3).map(m => `<div class="cb-t"><span class="${m.s === "B" ? "up" : "down"}">${m.s === "B" ? "Buy" : "Sell"}</span><b>${M.fmtPx(p, m.p)}</b></div>`).join("");
  const w = el.clientWidth; box.classList.remove("hide");
  box.style.left = hoverPt.x > w/2 ? "6px" : ""; box.style.right = hoverPt.x > w/2 ? "" : "70px";
  priceLabel();
}
function priceLabel(){
  if (!hoverPt || !bars.length || !S.main) return; const p = M.get(sym);
  const pr = S.main.coordinateToPrice(hoverPt.y), last = bars[bars.length-1].close;
  if (pr == null) return;
  if (!ui.xlab){ ui.xlab = document.createElement("div"); ui.xlab.className = "xlab"; el.parentElement.appendChild(ui.xlab); }
  const dpc = (pr - last) / last * 100;
  ui.xlab.style.top = hoverPt.y + "px"; ui.xlab.innerHTML = `${M.fmtPx(p, pr)}<br>${dpc>=0?"+":""}${dpc.toFixed(2)}%`;
}

/* ---- Binary result animation: 2 s on the chart (window is already gone), then it removes itself ---- */
function binFx(rec){
  if (ui.mode !== "bin" || !el || rec.sym !== sym) return;
  const host = el.parentElement; if (!host) return;
  const w = rec.result === "win" && rec.profit > 0, l = rec.result === "loss", cls = w ? "g" : l ? "r" : "n";
  const txt = w ? "+" + money(rec.profit) : l ? "-" + money(rec.amount) : "+" + money(rec.amount);
  host.querySelectorAll(".bin-fx").forEach(n => n.remove());
  const d = document.createElement("div"); d.className = "bin-fx " + cls; d.setAttribute("role", "status");
  d.innerHTML = `<div class="bf-ring"></div><div class="bf-t">${w ? "WIN" : l ? "LOSS" : "EVEN"}</div><div class="bf-a num">${txt} USDT</div>`;
  host.appendChild(d); setTimeout(() => d.remove(), 2050);
}
/* ---- Position lines (axis labels) ---- */
function syncLines(){
  if (!S.main) return;
  const want = new Map(), s = store.s; lineSpec = new Map();
  const cp = s.settings.chart || {}, bin = (ui.mode !== "fut" && ui.mode !== "none") && cp.pos !== false, fut = (ui.mode !== "bin" && ui.mode !== "none") && cp.pos !== false, ordOn = (ui.mode !== "bin" && ui.mode !== "none") && cp.ord !== false;
  if (bin) s.positions.filter(x => x.sym === sym).forEach(p => { want.set("b"+p.id, {price:p.entry, color: p.dir === "up" ? UP : DN, lineStyle:2}); lineSpec.set("b"+p.id, {kind:"bin", pos:p}); });
  if (fut) s.fut.positions.filter(x => x.sym === sym).forEach(p => {
    want.set("f"+p.id, {price:p.entry, color: p.side === "long" ? UP : DN, lineStyle:2}); lineSpec.set("f"+p.id, {kind:"fut", pos:p});
    if (p.liq > 0) want.set("l"+p.id, {price:p.liq, color:"#F7931A", lineStyle:2});
    if (p.tp){ want.set("t"+p.id, {price:p.tp, color:UP, lineStyle:2}); lineSpec.set("t"+p.id, {kind:"tp", pos:p}); }
    if (p.sl){ want.set("s"+p.id, {price:p.sl, color:DN, lineStyle:2}); lineSpec.set("s"+p.id, {kind:"sl", pos:p}); }
  });
  if (ordOn) s.fut.orders.filter(x => x.sym === sym).forEach(o => want.set("o"+o.id, {price:o.price, color:"#0EA5E9", lineStyle:2}));
  for (const [k, l] of lines){ if (!want.has(k)){ try { S.main.removePriceLine(l); } catch {} lines.delete(k); } }
  for (const [k, o] of want){
    if (lines.has(k)){ const l = lines.get(k); l._c = o.color; l.applyOptions({price:o.price, color:o.color}); }
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
    const left = tf !== "tick" && cp.cd !== false ? Math.max(0, last.time + sec - now/1000) : null;
    const cd = left == null ? "" : sec < 60 ? mmss(Math.min(left, sec)) : left >= 3600 ? `${Math.floor(left/3600)}:${String(Math.floor(left%3600/60)).padStart(2,"0")}:${String(Math.floor(left%60)).padStart(2,"0")}` : mmss(left);
    h += `<div class="pbox ${last.close >= last.open ? "pu" : "pd"}" style="top:${y}px">${M.fmtPx(p, last.close)}${cd ? `<br>${cd}` : ""}</div>`;
    // "+" next to the live price: drag it up/down to create TP (profit side) or SL (loss side) for the latest position
    const tradeable = ui.mode !== "bin" && ui.mode !== "none", myPos = tradeable ? s.fut.positions.filter(x => x.sym === sym).slice(-1)[0] : null;
    // "+" = tap: quick order sheet (Long/Short or Buy/Sell); with an open futures position it can also be dragged up/down to set TP / SL
    if (tradeable && now < plusUntil && !(dragS && dragS.kind === "new")) h += `<div class="pplus${myPos ? " drag" : ""}" ${myPos ? `data-drag="new:${myPos.id}"` : 'data-qo="1"'} style="top:${y}px" title="${myPos ? "Tap: quick order · drag: TP / SL" : "Quick order"}">+</div>`;
    if (dragS && dragS.kind === "new" && dragS.price != null){ const yy2 = S.main.priceToCoordinate(dragS.price), pos2 = s.fut.positions.find(x => x.id === dragS.id);
      if (yy2 != null && pos2){ const est = E.futPnl(pos2, dragS.price).pnl; h += `<div class="dline ${dragS.as || "tp"}" style="top:${yy2}px"></div><div class="dtag ${est >= 0 ? "g" : "r"}" style="top:${yy2}px">${(dragS.as || "tp").toUpperCase()} ${M.fmtPx(p, dragS.price)} · ${signed(est)} USDT (${(est / (pos2.margin || 1) * 100).toFixed(1)}%)</div>`; } }
  }
  // visible high / low
  const vr = chart.timeScale().getVisibleLogicalRange();
  if (vr && tf !== "tick" && type !== "line" && cp.hilo !== false){
    let hi = -Infinity, lo = Infinity, hiI = -1, loI = -1;
    for (let i = Math.max(0, Math.ceil(vr.from)); i <= Math.min(L, Math.floor(vr.to)); i++){ if (bars[i].high > hi){ hi = bars[i].high; hiI = i; } if (bars[i].low < lo){ lo = bars[i].low; loI = i; } }
    // the small dash ends exactly on the wick tip (x = candle centre, y = high/low price); text sits beside it
    const mark = (i, v, top) => { const x = chart.timeScale().logicalToCoordinate(i), yy = S.main.priceToCoordinate(v); if (x == null || yy == null) return "";
      const right = x < axisX / 2; return `<div class="hl ${right?"r":"l"}" style="left:${Math.round(x * 2) / 2}px;top:${Math.round(yy * 2) / 2}px">${right ? "" : M.fmtPx(p, v)}<i></i>${right ? M.fmtPx(p, v) : ""}</div>`; };
    if (hiI >= 0) h += mark(hiI, hi, true);
    if (loI >= 0) h += mark(loI, lo, false);
  }
  const bin = (ui.mode !== "fut" && ui.mode !== "none") && cp.pos !== false, fut = (ui.mode !== "bin" && ui.mode !== "none") && cp.pos !== false, ordOn = (ui.mode !== "bin" && ui.mode !== "none") && cp.ord !== false;
  // futures: entry label (PnL | size), TP/SL labels, liq
  // futures: entry label (PnL | size) + draggable TP/SL (drag the "TP/SL" handle off the entry line, or drag existing TP/SL labels)
  if (fut) s.fut.positions.filter(x => x.sym === sym).forEach(pos => {
    const {pnl} = E.futPnl(pos), ye = S.main.priceToCoordinate(pos.entry), c = pnl >= 0 ? "g" : "r";
    if (ye != null){
      h += `<div class="plab ${c}" style="top:${ye}px;left:0"><span>PnL ${signed(pnl)}</span><span>${money(pos.qty * pos.entry)}</span></div>`;

    }
    const pv = k => dragS && dragS.id === pos.id && (dragS.kind === k || (dragS.kind === "new" && dragS.as === k)) ? dragS.price : pos[k];
    [["tp","TP"],["sl","SL"]].forEach(([k, n]) => { const v = pv(k); if (!v) return; const yy = S.main.priceToCoordinate(v); if (yy == null) return;
      const est = E.futPnl(pos, v).pnl, roi = est / (pos.margin || 1) * 100, act = dragS && dragS.id === pos.id && (dragS.kind === k || dragS.as === k);
      if (act) h += `<div class="dline ${k}" style="top:${yy}px"></div>`;
      h += `<div class="plab o ${est>=0?"g":"r"} drag${act ? " act" : ""}" data-drag="${k}:${pos.id}" data-ln="${k}${pos.id}" style="top:${yy}px;left:${Math.max(4, axisX/2 - 90)}px"><span>${dragIcon} ${n} ${M.fmtPx(p, v)}</span><span>PnL ${signed(est)} (${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%)</span></div>`; });
  });
  if (ordOn) s.fut.orders.filter(x => x.sym === sym).forEach(o => { const yy = S.main.priceToCoordinate(dragS && dragS.kind === "ord" && dragS.id === o.id ? dragS.price : o.price); if (yy != null) h += `<div class="plab o y drag" data-drag="ord:${o.id}" style="top:${yy}px;left:4px"><span>Limit ${o.side === "long" ? "Buy" : "Sell"} ${M.fmtPx(p, o.price)}</span><span>${money(o.margin * o.lev)}</span></div>`; });
  // B/S markers from trades on this symbol
  const marks = (ui.mode === "bin" || ui.mode === "none") ? [] : [...s.fut.positions.filter(x => x.sym === sym).map(x => ({t:x.open, p:x.entry, s:x.side === "long" ? "B" : "S", k:"fo", r:x})),
    ...s.fut.history.filter(x => x.sym === sym).slice(0, 40).flatMap(x => [{t:x.open, p:x.entry, s:x.side === "long" ? "B" : "S", k:"fo", r:x}, {t:x.closed, p:x.exit, s:x.side === "long" ? "S" : "B", k:"fc", r:x}])];
  if ((ui.mode !== "fut" && ui.mode !== "none")) marks.push(...s.positions.filter(x => x.sym === sym).map(x => ({t:x.open, p:x.entry, s:x.dir === "up" ? "B" : "S", k:"bo", r:x})),
    ...s.history.filter(x => x.sym === sym).slice(0, 40).map(x => ({t:x.open, p:x.entry, s:x.dir === "up" ? "B" : "S", k:"bh", r:x})));
  lastMarks = marks;
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
    h += `<div class="bs ${m.s === "B" ? "b" : "s"}" data-mk="${marks.indexOf(m)}" style="left:${x}px;top:${m.s === "B" ? yy + off : yy - off}px">${m.s}</div>`; });
  // binary: upcoming expiry (aligned to the candle close) for the period the user selected
  if (ui.mode === "bin" && binExpFn){ const te = binExpFn(); if (te){ const xe = timeToX(te / 1000); if (xe != null && xe > 0 && xe < axisX){ h += `<div class="exp-line next" style="left:${xe}px"><span>${mmss((te - now) / 1000)}</span></div>`; } } }
  // binary: start/expiry lines + ONE-line trade window (direction icon in a fixed colour + live result text).
  // The window is placed beside the entry candle (left of the start line, or right of the expiry line) and nudged off the
  // live price line, so the current candle and the live price always stay visible. It is removed the moment the trade settles.
  const used = [], HH = chart.panes()[0].getHeight();
  if (bin) s.positions.filter(x => x.sym === sym).forEach(pos => {
    const ye0 = S.main.priceToCoordinate(pos.entry); if (ye0 == null) return;
    const {win, pnl} = E.livePnl(pos), lft0 = (pos.exp - now) / 1000, okT = isFinite(lft0) && lft0 < 86400, lft = okT ? Math.max(0, lft0) : 0, lineM = tf === "tick" || type === "line";
    // exact candle where the trade was placed: x = centre of that candle, y = the entry price
    const bi = lineM ? -1 : barAt(Math.floor(pos.open / 1000)), xs = bi >= 0 ? chart.timeScale().logicalToCoordinate(bi) : timeToX(pos.open / 1000), xe = timeToX(pos.exp / 1000);
    const cls = win == null ? "n" : win ? "g" : "r", up = pos.dir === "up";
    if (xs != null && xs > 0 && xs < axisX){ h += `<div class="start-line" style="left:${xs}px"></div><div class="bin-dot ${up ? "g" : "r"}" style="left:${xs}px;top:${ye0}px"></div>`; }
    let xex = null; if (xe != null && okT){ xex = Math.min(Math.max(xe, 34), axisX - 38); h += `<div class="exp-line" style="left:${xex}px"><span style="top:${4 + used.length * 18}px">⏱ ${mmss(lft)}</span></div>`; }
    const txt = (win == null ? "+" + money(pos.amount) : win ? "+" + money(pnl) : "-" + money(pos.amount)) + " USDT", pw = Math.round(txt.length * 6.7 + 40);
    let L;
    if (xs != null && xs > 0 && xs < axisX && xs - 8 - pw >= 4) L = xs - 8 - pw;                      // left of the start line
    else if (xex != null && xex + 10 + pw <= axisX - 2) L = xex + 10;                                 // a bit to the side of the expiry line
    else if (xs != null && xs > 0 && xs < axisX) L = Math.min(xs + 8, axisX - pw - 2);
    else L = 6;
    let cy = ye0 + (up ? -19 : 19); if (y != null && Math.abs(cy - y) < 15) cy = ye0 + (up ? 19 : -19);   // keep the live price line free
    while (used.some(u => Math.abs(u - cy) < 26)) cy += 26; used.push(cy);
    cy = Math.max(14, Math.min(HH - 14, cy));
    h += `<div class="bin-card ${cls} ${up ? "u" : "d"}" style="left:${L}px;top:${cy}px" aria-label="${up ? "Up" : "Down"} trade ${txt}"><i class="bc-ic">${up ? '<svg viewBox="0 0 12 12"><path d="M6 1.5l5 8H1z"/></svg>' : '<svg viewBox="0 0 12 12"><path d="M6 10.5l5-8H1z"/></svg>'}</i><b class="num">${txt}</b></div>`;
  });
  // Support / Resistance zones: thin translucent rectangles from the first touch to the price axis
  if (srOn && srZones.length && !(tf === "tick" || type === "line")){
    const Hh = chart.panes()[0].getHeight();
    srZones.forEach(z => { const y1 = S.main.priceToCoordinate(z.hi), y2 = S.main.priceToCoordinate(z.lo); if (y1 == null || y2 == null) return;
      const x0 = Math.max(0, chart.timeScale().logicalToCoordinate(z.i0) ?? 0), hh = Math.max(5, Math.abs(y2 - y1)), top = (y1 + y2) / 2 - hh / 2;
      if (top > Hh || top + hh < 0 || x0 >= axisX) return;
      h += `<div class="srz ${z.k}" style="left:${x0}px;width:${axisX - x0}px;top:${top}px;height:${hh}px"><em>${z.k === "r" ? "Resistance" : "Support"}</em></div>`; });
  }
  // SuperTrend BUY / SELL signals (closed candles only): rounded label + pointer exactly at the candle
  if (S.st && stSigs.length && !(tf === "tick" || type === "line")){
    const v0 = vr ? Math.floor(vr.from) - 1 : 0, v1 = vr ? Math.ceil(vr.to) + 1 : L;
    stSigs.forEach(g => { if (g.i < v0 || g.i > v1 || g.i >= L) return; const b = bars[g.i], x = chart.timeScale().logicalToCoordinate(g.i), yy = S.main.priceToCoordinate(g.d === 1 ? b.low : b.high);
      if (x == null || yy == null || x < 0 || x > axisX) return;
      h += `<div class="stsig ${g.d === 1 ? "b" : "s"}" style="left:${x}px;top:${yy}px"><i>${g.d === 1 ? "BUY" : "SELL"}</i></div>`; });
  }
  liveLines(now);
  // space already taken under each candle (B tags, SuperTrend BUY) → liquidation amounts go below it, never on top
  let occ = null;
  if (liqOn){ occ = {}; for (const k in stack) if (k.endsWith("B")) occ[parseInt(k)] = 7 + 13 + (Math.min(3, stack[k]) - 1) * 16 + 3;
    if (S.st) stSigs.forEach(g => { if (g.d === 1) occ[g.i] = Math.max(occ[g.i] || 0, 26); }); }
  drawLiq(occ);
  if (h !== box._h){ box._h = h; box.innerHTML = h; }
}
/* position / TP / SL price lines (+ their axis labels) follow the live PnL sign: green = profit, red = loss */
function liveLines(now){
  const s = store.s;
  for (const [k, l] of lines){
    const sp = lineSpec.get(k); if (!sp) continue; let c = sp.color;
    if (sp.kind === "bin"){ c = sp.pos.dir === "up" ? UP : DN; }   // fixed by direction: green = Up, red = Down
    else if (sp.kind === "fut"){ c = E.futPnl(sp.pos).pnl >= 0 ? UP : DN; }
    else if (sp.kind === "tp" || sp.kind === "sl"){ const v = sp.pos[sp.kind]; if (v) c = E.futPnl(sp.pos, v).pnl >= 0 ? UP : DN; }
    if (l._c !== c){ l._c = c; try { l.applyOptions({color:c}); } catch {} }
  }
}

/* ---- Tap a B/S marker → trade details ---- */
let lastMarks = [];
function markSheet(m){
  const P = M.get(sym), r = m.r, f = v => v == null ? "--" : M.fmtPx(P, v), dt = t => t ? new Date(t).toLocaleString("en-US") : "--";
  let rows;
  if (m.k === "bo" || m.k === "bh") rows = [["Type", "Binary " + (r.dir === "up" ? "Up" : "Down")], ["Amount", money(r.amount) + " USDT"], ["Entry price", f(r.entry)], ["Close price", f(r.exit)], ["Result", r.result ? `<span class="${r.profit >= 0 ? "up" : "down"}">${r.result === "win" ? "Won" : r.result === "loss" ? "Lost" : "Refunded"} ${signed(r.profit)} USDT</span>` : "Open"], ["Opened", dt(r.open)], ["Expires / closed", dt(r.closed || r.exp)]];
  else rows = [["Type", `Futures ${r.side === "long" ? "Long" : "Short"} ${r.lev}x`], [m.k === "fc" ? "Close price" : "Entry price", f(m.p)], ["Size", money((r.qty || r.closedVol || 0) * r.entry) + " USDT"], ["Margin", money(r.margin) + " USDT"], ...(r.profit != null ? [["Realized PnL", `<span class="${r.profit >= 0 ? "up" : "down"}">${signed(r.profit)} USDT</span>`]] : [["Unrealized PnL", `<span class="${E.futPnl(r).pnl >= 0 ? "up" : "down"}">${signed(E.futPnl(r).pnl)} USDT</span>`]]), ["Time", dt(m.t)]];
  U.sheet(`${m.s === "B" ? "Buy" : "Sell"} · ${M.label(P)}`, `<div class="cf-rows">${rows.map(([a, b]) => `<div><span>${a}</span><b class="num">${b}</b></div>`).join("")}</div>`);
}
function bindMarks(){
  const host = el.parentElement; let st = null;
  host.addEventListener("pointerdown", e => { const t = e.target.closest("[data-mk]"); st = t ? {i:+t.dataset.mk, x:e.clientX, y:e.clientY} : null; }, true);
  host.addEventListener("pointerup", e => { if (!st) return; const m = lastMarks[st.i]; if (m && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 8) markSheet(m); st = null; }, true);
}
/* ---- Drag the right price axis vertically to stretch / squeeze the price scale (touch + mouse) ---- */
function bindAxisDrag(){
  let d = null;
  const inAxis = (x, y) => { const r = el.getBoundingClientRect(); return x - r.left > el.clientWidth - 62 && y - r.top < el.clientHeight - 26; };
  const start = (x, y) => { const ps = chart?.priceScale("right"), vr = ps?.getVisibleRange?.(); if (!vr) return false; d = {y, from:vr.from, to:vr.to, moved:false}; return true; };
  const move = y => { if (!d) return; const dy = y - d.y; if (Math.abs(dy) > 3) d.moved = true; const k = Math.exp(dy * 0.006), mid = (d.from + d.to) / 2, half = (d.to - d.from) / 2 * k;
    try { chart.priceScale("right").applyOptions({autoScale:false}); chart.priceScale("right").setVisibleRange({from: mid - half, to: mid + half}); checkAuto(); } catch {} };
  el.addEventListener("touchstart", e => { if (e.touches.length === 1 && inAxis(e.touches[0].clientX, e.touches[0].clientY) && start(e.touches[0].clientX, e.touches[0].clientY)) e.stopPropagation(); }, {capture:true, passive:true});
  el.addEventListener("touchmove", e => { if (d){ e.stopPropagation(); e.preventDefault(); move(e.touches[0].clientY); } }, {capture:true, passive:false});
  el.addEventListener("touchend", e => { if (d){ if (d.moved) e.stopPropagation(); d = null; } }, true);
  el.addEventListener("mousedown", e => { if (inAxis(e.clientX, e.clientY) && start(e.clientX, e.clientY)){ e.stopPropagation(); const mm = ev => move(ev.clientY), mu = () => { removeEventListener("mousemove", mm); removeEventListener("mouseup", mu); d = null; }; addEventListener("mousemove", mm); addEventListener("mouseup", mu); } }, true);
}

/* ---- Drag TP / SL / limit order lines on the chart ---- */
let dragS = null;
const dragIcon = `<svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0l3 3H2zM5 10l3-3H2z" fill="currentColor"/></svg>`;
function bindDrag(){
  const host = el.parentElement;
  host.addEventListener("pointerdown", e => {
    const t = e.target.closest("[data-drag]"); if (!t || !chart || !S.main) return;
    e.preventDefault(); e.stopPropagation();
    const [kind, id] = t.dataset.drag.split(":"); dragS = {kind, id, price:null, as:null, y0:e.clientY, moved:false};
    const move = ev => {
      if (Math.abs(ev.clientY - dragS.y0) > 6) dragS.moved = true; if (!dragS.moved) return;
      const r = el.getBoundingClientRect(), pr = S.main.coordinateToPrice(ev.clientY - r.top); if (pr == null) return;
      dragS.price = pr;
      if (kind === "new"){ const pos = store.s.fut.positions.find(x => x.id === id); if (pos) dragS.as = (pos.side === "long") === (pr > pos.entry) ? "tp" : "sl"; }
    };
    const up = () => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
      const d = dragS; dragS = null; if (d && d.kind === "new") plusUntil = 0;
      if (d && d.kind === "new" && !d.moved){ U.buzz(14); if (CH.quickOrder) CH.quickOrder(sym); return; }   // plain tap on "+" → quick order
      if (!d || d.price == null) return;
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

/* ---- Long-press / tap the live price box → a "+" appears next to it; drag it to create TP / SL (futures) ---- */
function bindPbox(){
  const host = el.parentElement; let st = null, tm = 0;
  const inBox = (x, y) => { const b = ui.ovl2 && ui.ovl2.querySelector(".pbox"); if (!b) return false; const r = b.getBoundingClientRect(); return x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8; };
  const show = () => {
    if (ui.mode === "bin" || ui.mode === "none") return;
    plusUntil = Date.now() + 6000; U.buzz(20);
  };
  host.addEventListener("pointerdown", e => { clearTimeout(tm); st = null; if (e.target.closest("[data-drag]") || !inBox(e.clientX, e.clientY)) return;
    st = {x:e.clientX, y:e.clientY}; tm = setTimeout(() => { if (st){ show(); st = null; } }, 380); }, true);
  host.addEventListener("pointermove", e => { if (st && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 8){ clearTimeout(tm); st = null; } }, true);
  host.addEventListener("pointerup", e => { clearTimeout(tm); if (st){ st = null; show(); } }, true);
  host.addEventListener("pointercancel", () => { clearTimeout(tm); st = null; }, true);
  // "+" without an open position: plain tap opens the quick order sheet
  let qs = null;
  host.addEventListener("pointerdown", e => { const t = e.target.closest("[data-qo]"); qs = t ? {x:e.clientX, y:e.clientY} : null; if (t){ e.preventDefault(); e.stopPropagation(); } }, true);
  host.addEventListener("pointerup", e => { if (!qs) return; const s0 = qs; qs = null; if (Math.hypot(e.clientX - s0.x, e.clientY - s0.y) < 10){ plusUntil = 0; U.buzz(14); if (CH.quickOrder) CH.quickOrder(sym); } }, true);
}

/* ---- Tap on price axis toggles % scale ---- */
function bindAxisTap(){
  let sx = 0, sy = 0, st = 0;
  el.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; st = Date.now(); }, true);
  el.addEventListener("pointerup", e => {
    const r = el.getBoundingClientRect(), x = e.clientX - r.left;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) < 6 && Date.now() - st < 300 && x > el.clientWidth - 62 && e.clientY - r.top < el.clientHeight - 26){
      /* axis tap no longer toggles % mode (drag the axis to scale, double-tap to reset) */
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
  if (true) return;   // v6.7: replaced by the editable drawing layer in chart3.js
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

function setInds(list){
  const added = list.filter(k => !inds.includes(k));
  if (added.some(k => k !== "VOL") && nonVol(list) > MAXI){ U.toast("Max 4 indicators", "info", 1600); return false; }
  inds = list.slice(); store.s.settings.inds = inds; store.save(); const keep = chart ? chart.timeScale().getVisibleLogicalRange() : null; build(); if (keep) chart.timeScale().setVisibleLogicalRange(keep); return true; }
function refresh(){ if (!chart) return; const keep = chart.timeScale().getVisibleLogicalRange(); srKey = ""; liqData = null; build(); if (keep) chart.timeScale().setVisibleLogicalRange(keep); }
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

window.CH = {geo: () => chart && S.main && bars.length ? {sym, el, tf, sec, pw: chart.timeScale().width(), h: chart.panes()[0].getHeight(), t2x: timeToX, x2t: xToTime, p2y: p => S.main.priceToCoordinate(p), y2p: y => S.main.coordinateToPrice(y)} : null, IDEF, IS, refresh, MAXI, setBinExp: f => { binExpFn = f; }, mount, load, zoom, reset, destroy, setInds, setType, resize, syncLines, setTool, undoDraw, clearDraw, performance: perfStats, get tool(){ return draw.tool; }, get inds(){ return inds; }, get type(){ return type; }, fmtVol};
})();
