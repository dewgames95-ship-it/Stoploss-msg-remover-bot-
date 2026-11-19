/* ===== Chart engine: lightweight-charts v5 (logo off), indicators, overlays, long-press details ===== */
(function(){
const LW = window.LightweightCharts, {bus, store, money, mmss} = U;
const TZ = -new Date().getTimezoneOffset() * 60;
const COL = {e7:"#F0B90B", e25:"#E040FB", e99:"#1E80FF", boll:"#8E9BB3", bollMid:"#F0B90B", rsi:"#9B6BFF", macd:"#1E80FF", sig:"#F0B90B"};
let chart, el, sym, tf = "tick", sec = 1, bars = [], S = {}, inds = [], type = "candle", loadSeq = 0, offs = [], ro, ui = {}, dirty = false, newBar = false, raf, lastRender = 0, onDetail = null, hover = null, lines = new Map();

const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const isDark = () => document.documentElement.dataset.theme === "dark";
function opts(){
  const d = isDark(), grid = d ? "rgba(43,49,57,.6)" : "rgba(234,236,239,.9)";
  return {
    layout:{background:{type:"solid", color: d ? "#181A20" : "#FFFFFF"}, textColor: d ? "#848E9C" : "#707A8A", fontFamily:"IBM Plex Sans, system-ui, sans-serif", fontSize:10, attributionLogo:false,
      panes:{separatorColor: d ? "#2B3139" : "#EAECEF", separatorHoverColor:"rgba(240,185,11,.3)", enableResize:true}},
    grid:{vertLines:{color:grid}, horzLines:{color:grid}},
    rightPriceScale:{borderVisible:false, scaleMargins:{top:0.12, bottom:0.08}, minimumWidth:58},
    timeScale:{borderVisible:false, timeVisible:true, secondsVisible: sec < 60, rightOffset:10, barSpacing: tf === "tick" ? 3 : 8, minBarSpacing:1},
    crosshair:{mode:0, vertLine:{color: d ? "#5E6673" : "#B7BDC6", style:2, labelBackgroundColor: d ? "#2B3139" : "#474D57"}, horzLine:{color: d ? "#5E6673" : "#B7BDC6", style:2, labelBackgroundColor: d ? "#2B3139" : "#474D57"}},
    handleScroll:{vertTouchDrag:false, mouseWheel:true, pressedMouseMove:true, horzTouchDrag:true},
    handleScale:{pinch:true, mouseWheel:true, axisPressedMouseMove:{time:true, price:true}, axisDoubleClickReset:true},
    kineticScroll:{touch:true, mouse:false},
    localization:{priceFormatter: v => M.fmtPx(M.get(sym), v)}
  };
}
const fmtVol = v => v >= 1e9 ? (v/1e9).toFixed(2)+"B" : v >= 1e6 ? (v/1e6).toFixed(2)+"M" : v >= 1e3 ? (v/1e3).toFixed(2)+"K" : v.toFixed(v < 10 ? 3 : 0);

function mount(container, parts, detailCb){
  destroy();
  el = container; ui = parts || {}; onDetail = detailCb;
  inds = (store.s.settings.inds || []).slice(); type = store.s.settings.chartType || "candle";
  offs.push(bus.on("tick", onTick), bus.on("trade", onTrade), bus.on("theme", () => { if (chart){ chart.applyOptions(opts()); build(); } }));
  ro = new ResizeObserver(() => chart && chart.applyOptions({width: el.clientWidth, height: el.clientHeight}));
  ro.observe(el);
  bindPress();
  loop();
}

/* ---- Build / rebuild series ---- */
function build(){
  if (chart){ chart.remove(); chart = null; }
  lines.clear();
  chart = LW.createChart(el, Object.assign({width: el.clientWidth, height: el.clientHeight}, opts()));
  const p = M.get(sym), dp = p?.dp ?? 2, pf = {type:"price", precision:dp, minMove: Math.pow(10, -dp)};
  const up = css("--up"), dn = css("--down");
  S = {};
  if (tf === "tick" || type === "line"){
    S.main = chart.addSeries(LW.AreaSeries, {lineColor:"#F0B90B", topColor:"rgba(240,185,11,.28)", bottomColor:"rgba(240,185,11,0)", lineWidth:2, lineType:2, priceFormat:pf, lastPriceAnimation:1, priceLineColor:"#F0B90B", crosshairMarkerRadius:4, crosshairMarkerBackgroundColor:"#F0B90B"});
  } else {
    S.main = chart.addSeries(LW.CandlestickSeries, {upColor:up, downColor:dn, borderVisible:false, wickUpColor:up, wickDownColor:dn, priceFormat:pf, priceLineColor: css("--muted")});
  }
  if (inds.includes("VOL")){
    S.vol = chart.addSeries(LW.HistogramSeries, {priceFormat:{type:"volume"}, priceScaleId:"vol", lastValueVisible:false, priceLineVisible:false});
    chart.priceScale("vol").applyOptions({scaleMargins:{top:0.82, bottom:0}});
  }
  const ln = (color, w=1, pane=0, extra={}) => chart.addSeries(LW.LineSeries, Object.assign({color, lineWidth:w, priceLineVisible:false, lastValueVisible:false, crosshairMarkerVisible:false, priceFormat:pf}, extra), pane);
  if (inds.includes("EMA")){ S.e7 = ln(COL.e7); S.e25 = ln(COL.e25); S.e99 = ln(COL.e99); }
  if (inds.includes("BOLL")){ S.bu = ln(COL.boll, 1, 0, {lineStyle:0}); S.bm = ln(COL.bollMid, 1, 0, {lineStyle:2}); S.bl = ln(COL.boll); }
  if (inds.includes("SUPER")) S.st = ln(up, 2);
  let pane = 1;
  if (inds.includes("RSI")){
    S.rsi = chart.addSeries(LW.LineSeries, {color:COL.rsi, lineWidth:1.5, priceLineVisible:false, lastValueVisible:true, priceFormat:{type:"price", precision:2, minMove:0.01}}, pane);
    S.rsi.createPriceLine({price:70, color:dn, lineStyle:2, lineWidth:1, axisLabelVisible:false});
    S.rsi.createPriceLine({price:30, color:up, lineStyle:2, lineWidth:1, axisLabelVisible:false});
    S.rsiPane = pane++;
  }
  if (inds.includes("MACD")){
    const mf = {type:"price", precision: Math.max(2, dp+1), minMove: Math.pow(10, -(dp+1))};
    S.mh = chart.addSeries(LW.HistogramSeries, {priceLineVisible:false, lastValueVisible:false, priceFormat:mf}, pane);
    S.ml = chart.addSeries(LW.LineSeries, {color:COL.macd, lineWidth:1, priceLineVisible:false, lastValueVisible:false, priceFormat:mf}, pane);
    S.ms = chart.addSeries(LW.LineSeries, {color:COL.sig, lineWidth:1, priceLineVisible:false, lastValueVisible:false, priceFormat:mf}, pane);
    S.macdPane = pane++;
  }
  const h = el.clientHeight, sub = Math.max(70, Math.round(h * 0.2));
  chart.panes().forEach((pn, i) => { if (i > 0) pn.setHeight(sub); });
  chart.subscribeCrosshairMove(prm => {
    if (!prm || prm.time == null || !prm.point){ hover = null; legend(); return; }
    const t = prm.time - TZ; const i = findIdx(t); hover = i >= 0 ? i : null; legend();
  });
  setAll();
  syncLines();
}
function findIdx(t){ let lo = 0, hi = bars.length - 1; while (lo <= hi){ const m = (lo+hi) >> 1; if (bars[m].time === t) return m; if (bars[m].time < t) lo = m+1; else hi = m-1; } return -1; }

/* ---- Data ---- */
const T = t => t + TZ;
function calc(){
  const c = bars.map(b => b.close), r = {};
  if (S.e7){ r.e7 = IND.ema(c,7); r.e25 = IND.ema(c,25); r.e99 = IND.ema(c,99); }
  if (S.bu) r.boll = IND.boll(bars);
  if (S.st) r.st = IND.supertrend(bars.map(b => tf === "tick" ? {...b, high:b.close, low:b.close} : b));
  if (S.rsi) r.rsi = IND.rsi(bars);
  if (S.mh) r.macd = IND.macd(bars);
  return r;
}
let cache = {};
function point(i, r){
  const b = bars[i], t = T(b.time), up = css("--up"), dn = css("--down"), o = {};
  o.main = (tf === "tick" || type === "line") ? {time:t, value:b.close} : {time:t, open:b.open, high:b.high, low:b.low, close:b.close};
  if (S.vol) o.vol = {time:t, value:b.volume || 0, color: b.close >= b.open ? "rgba(14,203,129,.45)" : "rgba(246,70,93,.45)"};
  const lp = (arr) => arr[i] == null ? {time:t} : {time:t, value:arr[i]};
  if (S.e7){ o.e7 = lp(r.e7); o.e25 = lp(r.e25); o.e99 = lp(r.e99); }
  if (S.bu){ o.bu = lp(r.boll.up); o.bm = lp(r.boll.mid); o.bl = lp(r.boll.lo); }
  if (S.st) o.st = r.st.val[i] == null ? {time:t} : {time:t, value:r.st.val[i], color: r.st.dir[i] === 1 ? up : dn};
  if (S.rsi) o.rsi = lp(r.rsi);
  if (S.mh){ o.mh = r.macd.hist[i] == null ? {time:t} : {time:t, value:r.macd.hist[i], color: r.macd.hist[i] >= 0 ? "rgba(14,203,129,.6)" : "rgba(246,70,93,.6)"}; o.ml = lp(r.macd.line); o.ms = lp(r.macd.signal); }
  return o;
}
function setAll(){
  if (!chart) return;
  const r = cache = calc(), keys = Object.keys(S).filter(k => S[k] && typeof S[k] === "object" && S[k].setData);
  const data = {}; keys.forEach(k => data[k] = []);
  for (let i=0;i<bars.length;i++){ const o = point(i, r); keys.forEach(k => o[k] && data[k].push(o[k])); }
  try { keys.forEach(k => S[k].setData(data[k])); } catch(e){ console.warn(e); }
  legend();
}
function renderLast(){
  if (!chart || !bars.length) return;
  const r = cache = calc(), i = bars.length - 1, o = point(i, r);
  try { Object.keys(o).forEach(k => S[k] && S[k].update(o[k])); }
  catch(e){ setAll(); }
  if (hover == null) legend();
}

async function load(s, timeframe){
  sym = s; tf = timeframe; sec = M.TF_SEC[tf];
  const seq = ++loadSeq;
  bars = []; build(); msg("Loading chart…");
  let data = [];
  for (let i=0;i<5;i++){
    try { data = await M.candles(sym, tf); break; }
    catch { if (seq !== loadSeq) return; msg("Reconnecting…"); await U.sleep(800 * 2**i); }
  }
  if (seq !== loadSeq) return;
  const p = M.get(sym);
  // strict ascending, unique times
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
  const now = Math.floor(Date.now()/1000), bt = Math.floor(now/sec)*sec;
  const l = bars[bars.length-1];
  if (l && bt < l.time) return;
  if (l && l.time === bt){ l.high = Math.max(l.high, price); l.low = Math.min(l.low, price); l.close = price; if (M.get(sym).type !== "crypto") l.volume += 1; }
  else { bars.push({time:bt, open: l ? l.close : price, high:price, low:price, close:price, volume: M.get(sym).type !== "crypto" ? 1 : 0}); newBar = true; }
  dirty = true; msg("");
}
function onTrade(s, tr){
  if (s !== sym || !bars.length) return;
  const bt = Math.floor(tr.t/1000/sec)*sec, l = bars[bars.length-1];
  if (l.time === bt) l.volume += tr.q;
}
function loop(){
  raf = requestAnimationFrame(loop);
  const n = performance.now();
  if (n - lastRender < 200) return;
  lastRender = n;
  if (dirty){ dirty = false; renderLast(); }
  overlay();
}

/* ---- Legend ---- */
function legend(){
  if (!ui.legend || !bars.length) return;
  const i = hover ?? bars.length - 1, b = bars[i], p = M.get(sym); if (!b) return;
  const f = v => M.fmtPx(p, v), prev = i ? bars[i-1].close : b.open, ch = (b.close - prev) / prev * 100, amp = (b.high - b.low) / (b.low || 1) * 100;
  const c = b.close >= b.open ? "up" : "down", r = cache;
  let l2 = "";
  if (r.e7) l2 += `<span style="color:${COL.e7}">EMA7 ${f(r.e7[i])}</span><span style="color:${COL.e25}">EMA25 ${f(r.e25[i])}</span><span style="color:${COL.e99}">EMA99 ${f(r.e99[i])}</span>`;
  if (r.boll) l2 += `<span style="color:${COL.bollMid}">BOLL ${f(r.boll.mid[i])}</span>`;
  if (r.st && r.st.val[i] != null) l2 += `<span class="${r.st.dir[i]===1?"up":"down"}">ST ${f(r.st.val[i])}</span>`;
  if (r.rsi && r.rsi[i] != null) l2 += `<span style="color:${COL.rsi}">RSI ${r.rsi[i].toFixed(1)}</span>`;
  if (S.vol) l2 += `<span>VOL ${fmtVol(b.volume||0)}</span>`;
  ui.legend.innerHTML = (tf === "tick" || type === "line")
    ? `<div>${new Date(b.time*1000).toLocaleTimeString()} &nbsp;<b class="${ch>=0?"up":"down"}">${f(b.close)}</b></div><div class="l2">${l2}</div>`
    : `<div>O <b class="${c}">${f(b.open)}</b> H <b class="${c}">${f(b.high)}</b> L <b class="${c}">${f(b.low)}</b> C <b class="${c}">${f(b.close)}</b> <b class="${ch>=0?"up":"down"}">${ch>=0?"+":""}${ch.toFixed(2)}%</b> Amp ${amp.toFixed(2)}%</div><div class="l2">${l2}</div>`;
}

/* ---- Position lines + HTML overlay (binary tags, expiry line) ---- */
function syncLines(){
  if (!S.main) return;
  const want = new Map();
  store.s.positions.filter(x => x.sym === sym).forEach(p => want.set("b"+p.id, {price:p.entry, color:"#F0B90B", lineStyle:2, title:""}));
  store.s.fut.positions.filter(x => x.sym === sym).forEach(p => {
    want.set("f"+p.id, {price:p.entry, color: p.side === "long" ? css("--up") : css("--down"), lineStyle:0, title:(p.side === "long" ? "Long " : "Short ") + p.lev + "x"});
    want.set("l"+p.id, {price:p.liq, color:"#F7931A", lineStyle:3, title:"Liq."});
    if (p.tp) want.set("t"+p.id, {price:p.tp, color:css("--up"), lineStyle:1, title:"TP"});
    if (p.sl) want.set("s"+p.id, {price:p.sl, color:css("--down"), lineStyle:1, title:"SL"});
  });
  store.s.fut.orders.filter(x => x.sym === sym).forEach(o => want.set("o"+o.id, {price:o.price, color:"#1E80FF", lineStyle:2, title:"Limit " + (o.side === "long" ? "Buy" : "Sell")}));
  for (const [k, l] of lines){ if (!want.has(k)){ try { S.main.removePriceLine(l); } catch {} lines.delete(k); } }
  for (const [k, o] of want){
    if (lines.has(k)) lines.get(k).applyOptions({price:o.price, color:o.color, title:o.title});
    else lines.set(k, S.main.createPriceLine({price:o.price, color:o.color, lineStyle:o.lineStyle, lineWidth:1, axisLabelVisible:true, title:o.title}));
  }
}
function overlay(){
  const box = ui.overlay; if (!box || !chart || !S.main) return;
  const now = Date.now(), list = store.s.positions.filter(x => x.sym === sym);
  const ts = chart.timeScale(), L = bars.length - 1, w = el.clientWidth - 64;
  let html = ""; const used = [];
  list.forEach(pos => {
    let y = S.main.priceToCoordinate(pos.entry); if (y == null) return;
    while (used.some(u => Math.abs(u - y) < 20)) y += 20;
    used.push(y);
    const {win, pnl} = E.livePnl(pos), left = (pos.exp - now) / 1000;
    const bg = win == null ? "#5E6673" : win ? css("--up") : css("--down");
    const txt = win ? `+${money(pnl)}` : `-${money(pos.amount)}`;
    const lx = l => { const f = Math.floor(l), a = ts.logicalToCoordinate(f), b = ts.logicalToCoordinate(f + 1); return a == null || b == null ? null : a + (b - a) * (l - f); };
    const xs = lx(L - (now - pos.open)/1000/sec), xe = lx(L + left/sec);
    if (xs != null && xs > 0 && xs < w) html += `<div class="start-line" style="left:${xs}px"></div>`;
    if (xe != null){ const x = Math.min(Math.max(xe, 30), w - 4); html += `<div class="exp-line" style="left:${x}px"><span style="top:${4 + (used.length-1)*18}px">⏱ ${mmss(left)}</span></div>`; }
    html += `<div class="pos-tag" style="top:${y}px;background:${bg}">${pos.dir === "up" ? "▲" : "▼"} ${txt} USDT · ${mmss(left)}</div>`;
  });
  box.innerHTML = html;
}

/* ---- Long press / double click → candle details ---- */
function bindPress(){
  let timer = null, sx = 0, sy = 0;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener("pointerdown", e => {
    sx = e.clientX; sy = e.clientY; cancel();
    timer = setTimeout(() => { timer = null; openDetail(e.clientX); }, 480);
  }, true);
  el.addEventListener("pointermove", e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); }, true);
  ["pointerup","pointercancel","pointerleave"].forEach(ev => el.addEventListener(ev, cancel, true));
  el.addEventListener("touchstart", e => { const t0 = e.touches[0]; if (e.touches.length > 1){ cancel(); return; } sx = t0.clientX; sy = t0.clientY; cancel(); timer = setTimeout(() => { timer = null; openDetail(sx); }, 480); }, {capture:true, passive:true});
  el.addEventListener("touchmove", e => { const t0 = e.touches[0]; if (timer && (e.touches.length > 1 || Math.hypot(t0.clientX - sx, t0.clientY - sy) > 10)) cancel(); }, {capture:true, passive:true});
  el.addEventListener("touchend", cancel, true);
  el.addEventListener("dblclick", e => openDetail(e.clientX), true);
  el.addEventListener("contextmenu", e => e.preventDefault());
}
function openDetail(clientX){
  if (!chart || !bars.length) return;
  const x = clientX - el.getBoundingClientRect().left;
  const lg = chart.timeScale().coordinateToLogical(x); if (lg == null) return;
  const i = Math.max(0, Math.min(bars.length - 1, Math.round(lg)));
  U.buzz(20);
  const r = calc();
  onDetail && onDetail({bar:bars[i], prev: i ? bars[i-1] : null, i, sec, tf, ind:{
    e7:r.e7?.[i], e25:r.e25?.[i], e99:r.e99?.[i], bu:r.boll?.up[i], bm:r.boll?.mid[i], bl:r.boll?.lo[i],
    st:r.st?.val[i], stDir:r.st?.dir[i], rsi:r.rsi?.[i], macd:r.macd?.line[i], sig:r.macd?.signal[i], hist:r.macd?.hist[i]
  }, rsiFull: IND.rsi(bars)[i]});
}

function setInds(list){ inds = list.slice(); store.s.settings.inds = inds; store.save(); const keep = chart ? chart.timeScale().getVisibleLogicalRange() : null; build(); if (keep) chart.timeScale().setVisibleLogicalRange(keep); }
function setType(t){ type = t; store.s.settings.chartType = t; store.save(); build(); chart.timeScale().scrollToRealTime(); }
function zoom(f){ if (!chart) return; const ts = chart.timeScale(), cur = ts.options().barSpacing; ts.applyOptions({barSpacing: U.clamp(cur * f, 1, 60)}); }
function reset(){ chart?.timeScale().scrollToRealTime(); }
function resize(){ if (chart && el) chart.applyOptions({width: el.clientWidth, height: el.clientHeight}); }
function destroy(){ offs.forEach(f => f()); offs = []; ro?.disconnect(); cancelAnimationFrame(raf); if (chart) chart.remove(); chart = null; S = {}; lines.clear(); loadSeq++; bars = []; }

bus.on("positions", () => syncLines());
window.CH = {mount, load, zoom, reset, destroy, setInds, setType, resize, syncLines, get inds(){ return inds; }, get type(){ return type; }, fmtVol};
})();
