/* ===== Technical indicators (pure functions over OHLCV bars) ===== */
(function(){
function ema(vals, n){
  const out = new Array(vals.length).fill(null), k = 2/(n+1);
  let prev = null, sum = 0;
  for (let i=0;i<vals.length;i++){
    const v = vals[i];
    if (i < n-1){ sum += v; continue; }
    if (i === n-1){ sum += v; prev = sum/n; out[i] = prev; continue; }
    prev = v*k + prev*(1-k); out[i] = prev;
  }
  return out;
}
function sma(vals, n){
  const out = new Array(vals.length).fill(null); let s = 0;
  for (let i=0;i<vals.length;i++){ s += vals[i]; if (i >= n) s -= vals[i-n]; if (i >= n-1) out[i] = s/n; }
  return out;
}
function boll(bars, n=20, mult=2){
  const c = bars.map(b => b.close), mid = sma(c, n), up = [], lo = [];
  for (let i=0;i<c.length;i++){
    if (mid[i] == null){ up.push(null); lo.push(null); continue; }
    let v = 0; for (let j=i-n+1;j<=i;j++) v += (c[j]-mid[i])**2;
    const sd = Math.sqrt(v/n); up.push(mid[i] + mult*sd); lo.push(mid[i] - mult*sd);
  }
  return {mid, up, lo};
}
function rsi(bars, n=14){
  const out = new Array(bars.length).fill(null); let g = 0, l = 0;
  for (let i=1;i<bars.length;i++){
    const d = bars[i].close - bars[i-1].close, up = Math.max(d,0), dn = Math.max(-d,0);
    if (i <= n){ g += up; l += dn; if (i === n){ g /= n; l /= n; out[i] = l === 0 ? 100 : 100 - 100/(1+g/l); } continue; }
    g = (g*(n-1) + up)/n; l = (l*(n-1) + dn)/n;
    out[i] = l === 0 ? 100 : 100 - 100/(1+g/l);
  }
  return out;
}
function macd(bars, f=12, s=26, sig=9){
  const c = bars.map(b => b.close), ef = ema(c, f), es = ema(c, s);
  const line = c.map((_,i) => ef[i] != null && es[i] != null ? ef[i]-es[i] : null);
  const start = line.findIndex(v => v != null);
  const sigArr = new Array(c.length).fill(null);
  if (start >= 0){ const e = ema(line.slice(start), sig); e.forEach((v,i) => sigArr[start+i] = v); }
  const hist = line.map((v,i) => v != null && sigArr[i] != null ? v - sigArr[i] : null);
  return {line, signal:sigArr, hist};
}
function atr(bars, n){
  const out = new Array(bars.length).fill(null); let prev = null;
  for (let i=0;i<bars.length;i++){
    const b = bars[i], pc = i ? bars[i-1].close : b.close;
    const tr = Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
    if (i < n){ prev = (prev||0) + tr; if (i === n-1){ prev /= n; out[i] = prev; } continue; }
    prev = (prev*(n-1) + tr)/n; out[i] = prev;
  }
  return out;
}
function supertrend(bars, n=10, mult=3){
  const a = atr(bars, n), val = new Array(bars.length).fill(null), dir = new Array(bars.length).fill(null);
  let fu = null, fl = null, d = 1;
  for (let i=0;i<bars.length;i++){
    if (a[i] == null) continue;
    const b = bars[i], hl2 = (b.high + b.low)/2, bu = hl2 + mult*a[i], bl = hl2 - mult*a[i];
    const pc = i ? bars[i-1].close : b.close;
    fu = fu == null || bu < fu || pc > fu ? bu : fu;
    fl = fl == null || bl > fl || pc < fl ? bl : fl;
    if (val[i-1] != null){ if (d === 1 && b.close < fl) d = -1; else if (d === -1 && b.close > fu) d = 1; }
    val[i] = d === 1 ? fl : fu; dir[i] = d;
  }
  return {val, dir};
}
const LIST = [
  {k:"EMA", name:"EMA (7, 25, 99)", desc:"Exponential moving averages show trend direction. Price above EMA 25 = short-term uptrend; EMA 7 crossing EMA 25 often signals momentum change."},
  {k:"BOLL", name:"Bollinger Bands (20, 2)", desc:"Volatility bands around a 20-period average. Touching the upper band = stretched up, lower band = stretched down. Tight bands often precede big moves."},
  {k:"SUPER", name:"SuperTrend (10, 3)", desc:"ATR-based trend line. Green line below price = uptrend, red line above price = downtrend. A flip is a common entry/exit signal."},
  {k:"VOL", name:"Volume", desc:"Traded volume per candle. Rising volume confirms a move; low volume breakouts often fail."},
  {k:"RSI", name:"RSI (14)", desc:"Momentum oscillator 0–100. Above 70 = overbought, below 30 = oversold. Divergence with price warns of reversals."},
  {k:"MACD", name:"MACD (12, 26, 9)", desc:"Difference between fast and slow EMAs with a signal line. Histogram above zero = bullish momentum; signal-line crosses mark momentum shifts."}
];
window.IND = {ema, sma, boll, rsi, macd, supertrend, LIST};
})();
