/* ===== Chart controller (lightweight-charts, attribution logo off) ===== */
(function(){
const {bus, store, money, mmss, signed} = U;
const TZ = -new Date().getTimezoneOffset() * 60; // show local time on axis
let chart, series, el, sym, tf = "tick", sec = 1, last = null, lines = new Map(), offs = [], ro, loadSeq = 0, msgEl;

function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function theme(){
  const dark = document.documentElement.dataset.theme === "dark";
  return {
    layout:{background:{type:"solid", color:"transparent"}, textColor: dark ? "#8E9BB3" : "#6B7A90", fontFamily:"Inter, system-ui, sans-serif", fontSize:11, attributionLogo:false},
    grid:{vertLines:{color: dark ? "rgba(255,255,255,.05)" : "rgba(15,27,45,.06)"}, horzLines:{color: dark ? "rgba(255,255,255,.05)" : "rgba(15,27,45,.06)"}},
    rightPriceScale:{borderVisible:false, scaleMargins:{top:0.15, bottom:0.12}},
    timeScale:{borderVisible:false, timeVisible:true, secondsVisible:true, rightOffset:8, barSpacing:8},
    crosshair:{mode:0, vertLine:{color: dark ? "#3A4B6B" : "#B8C4D6", labelBackgroundColor:"#2F80ED"}, horzLine:{color: dark ? "#3A4B6B" : "#B8C4D6", labelBackgroundColor:"#2F80ED"}},
    handleScroll:{vertTouchDrag:false}, localization:{priceFormatter: v => M.fmtPx(M.get(sym), v)}
  };
}

function mount(container, msg){
  destroy();
  el = container; msgEl = msg;
  chart = LightweightCharts.createChart(el, Object.assign({width: el.clientWidth, height: el.clientHeight}, theme()));
  ro = new ResizeObserver(() => chart && chart.applyOptions({width: el.clientWidth, height: el.clientHeight}));
  ro.observe(el);
  offs.push(bus.on("tick", onTick), bus.on("theme", () => chart?.applyOptions(theme())), bus.on("sec", updateLines), bus.on("positions", syncLines));
  chart.subscribeCrosshairMove(p => bus.emit("crosshair", p?.seriesData?.get(series) || null));
}

function makeSeries(){
  if (series){ chart.removeSeries(series); series = null; lines.clear(); }
  const p = M.get(sym), dp = p?.dp ?? 2;
  const pf = {type:"price", precision:dp, minMove: Math.pow(10, -dp)};
  if (tf === "tick"){
    series = chart.addAreaSeries({lineColor:"#2F80ED", topColor:"rgba(47,128,237,.32)", bottomColor:"rgba(86,204,242,0.02)", lineWidth:2, priceFormat:pf, lastValueVisible:true, priceLineVisible:true, priceLineColor:"#2F80ED", crosshairMarkerRadius:4, lineType:2});
  } else {
    series = chart.addCandlestickSeries({upColor:"#16C784", downColor:"#EA3943", borderVisible:false, wickUpColor:"#16C784", wickDownColor:"#EA3943", priceFormat:pf, priceLineColor:"#2F80ED"});
  }
}

async function load(s, timeframe){
  sym = s; tf = timeframe; sec = M.TF_SEC[tf]; last = null;
  const seq = ++loadSeq;
  makeSeries(); setMsg("Loading chart…");
  chart.applyOptions({timeScale:{secondsVisible: sec < 60, barSpacing: tf === "tick" ? 4 : 8}});
  let bars = [];
  for (let i=0;i<4;i++){
    try { bars = await M.candles(sym, tf); break; }
    catch { if (seq !== loadSeq) return; setMsg("Reconnecting…"); await U.sleep(1000 * 2**i); }
  }
  if (seq !== loadSeq) return;
  const p = M.get(sym);
  if (!bars.length && p?.price){ const t = Math.floor(Date.now()/1000/sec)*sec; bars = [{time:t, open:p.price, high:p.price, low:p.price, close:p.price}]; }
  const shifted = bars.map(b => ({...b, time: b.time + TZ}));
  if (tf === "tick") series.setData(dedupe(shifted.map(b => ({time:b.time, value:b.close}))));
  else series.setData(dedupe(shifted));
  last = shifted[shifted.length-1] ? {...shifted[shifted.length-1]} : null;
  if (tf === "tick" && last) last = {time:last.time, value:last.close};
  chart.timeScale().scrollToRealTime();
  setMsg(bars.length ? "" : "Waiting for live data…");
  syncLines(); markers();
  if (p?.price) onTick(sym, p.price);
}
function dedupe(a){ const out = []; for (const x of a){ if (out.length && out[out.length-1].time >= x.time){ if (out[out.length-1].time === x.time) out[out.length-1] = x; continue; } out.push(x); } return out; }
function setMsg(t){ if (!msgEl) return; msgEl.innerHTML = t ? `<span>${t}</span>` : ""; }

function onTick(s, price){
  if (s !== sym || !series || !price) return;
  const now = Math.floor(Date.now()/1000), b = Math.floor(now/sec)*sec + TZ;
  if (tf === "tick"){
    if (last && b < last.time) return;
    last = {time:b, value:price}; series.update(last);
  } else {
    if (last && b < last.time) return;
    if (last && last.time === b){ last.high = Math.max(last.high, price); last.low = Math.min(last.low, price); last.close = price; }
    else last = {time:b, open: last ? last.close : price, high:price, low:price, close:price};
    series.update({...last});
  }
  setMsg("");
}

/* ---- Entry lines for open positions ---- */
function syncLines(){
  if (!series) return;
  const open = store.s.positions.filter(x => x.sym === sym);
  const ids = new Set(open.map(x => x.id));
  for (const [id, l] of lines){ if (!ids.has(id)){ try{ series.removePriceLine(l); }catch{} lines.delete(id); } }
  open.forEach(pos => { if (!lines.has(pos.id)) lines.set(pos.id, series.createPriceLine({price:pos.entry, color:"#2F80ED", lineWidth:1, lineStyle:2, axisLabelVisible:true, title:""})); });
  updateLines(); markers();
}
function updateLines(){
  if (!series) return;
  const now = Date.now();
  store.s.positions.forEach(pos => {
    const l = lines.get(pos.id); if (!l) return;
    const {win, pnl} = E.livePnl(pos);
    const left = mmss((pos.exp - now)/1000);
    const color = win == null ? "#8A97AB" : win ? "#16C784" : "#EA3943";
    const arrow = pos.dir === "up" ? "▲" : "▼";
    const title = win ? `${arrow} +${money(pnl)} USDT ${left}` : `${arrow} -${money(pos.amount)} USDT ${left}`;
    l.applyOptions({color, title});
  });
}
function markers(){
  if (!series) return;
  const m = store.s.positions.filter(x => x.sym === sym).map(pos => ({
    time: Math.floor(Math.floor(pos.open/1000)/sec)*sec + TZ, position: pos.dir === "up" ? "belowBar" : "aboveBar",
    color: pos.dir === "up" ? "#16C784" : "#EA3943", shape: pos.dir === "up" ? "arrowUp" : "arrowDown"
  })).sort((a,b) => a.time - b.time);
  try { series.setMarkers(m); } catch {}
}

function zoom(f){ if (!chart) return; const ts = chart.timeScale(); const cur = ts.options().barSpacing; ts.applyOptions({barSpacing: U.clamp(cur * f, 1, 50)}); }
function reset(){ chart?.timeScale().scrollToRealTime(); }
function destroy(){ offs.forEach(f => f()); offs = []; ro?.disconnect(); if (chart){ chart.remove(); } chart = series = null; lines.clear(); loadSeq++; }

window.CH = {mount, load, zoom, reset, destroy, get tf(){ return tf; }};
})();
