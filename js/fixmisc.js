/* ===== v6.8 fixmisc: VIP/account level, bot builder + 30d backtest, Share PnL hook, keyboard-close commit ===== */
(function(){
const {esc, ic, store, toast} = U;
const S = () => store.s;
const num = (v, d = 2) => Number(v).toLocaleString("en-US", {minimumFractionDigits: d, maximumFractionDigits: d});
const money = v => num(v, 2);
const compact = v => v >= 1e9 ? num(v / 1e9, 1) + "B" : v >= 1e6 ? num(v / 1e6, v % 1e6 ? 1 : 0) + "M" : v >= 1e3 ? num(v / 1e3, 0) + "K" : String(Math.round(v));
const DAY = 864e5;

/* ================= VIP / account level ================= */
const BASE = {spot: .020, fm: .010, ft: .010, opt: .030};          // matches the engine's real fee rates (%)
const TIERS = [
  {n: "Regular", vol: 0, dep: 0, off: 0},
  {n: "VIP1", vol: 1e5, dep: 1e4, off: 10},
  {n: "VIP2", vol: 5e5, dep: 5e4, off: 20},
  {n: "VIP3", vol: 2e6, dep: 2e5, off: 30},
  {n: "VIP4", vol: 1e7, dep: 1e6, off: 40},
  {n: "VIP5", vol: 5e7, dep: 5e6, off: 50}
];
const fee = (b, off) => (b * (1 - off / 100)).toFixed(4).replace(/0+$/, "").replace(/\.$/, ".0") + "%";
const feeP = (b, off) => { const v = b * (1 - off / 100); return v.toFixed(v < .01 ? 4 : 3) + "%"; };
function stats(){
  const s = S(), now = Date.now(), from = now - 30 * DAY; let vol = 0, dep = 0;
  try { (s.history || []).forEach(x => { if ((x.closed || 0) >= from) vol += Number(x.amount) || 0; }); } catch {}
  try { ((s.fut && s.fut.history) || []).forEach(x => { if ((x.closed || 0) >= from) vol += (Number(x.closedVol) || 0) * (Number(x.exit) || Number(x.entry) || 0) + (Number(x.closedVol) || 0) * (Number(x.entry) || 0); }); } catch {}
  try { ((s.spot && s.spot.history) || []).forEach(x => { if ((x.ts || 0) >= from) vol += (Number(x.qty) || 0) * (Number(x.price) || 0); }); } catch {}
  try { ((s.options && s.options.history) || []).forEach(x => { if ((x.closed || 0) >= from) vol += Number(x.cost || x.premium || 0); }); } catch {}
  try { (s.tx || []).forEach(x => { if (x.kind === "deposit" && !/^Earn/i.test(x.method || "")) dep += Number(x.amount) || 0; }); } catch {}
  return {vol, dep};
}
function tier(){
  const st = stats(); let i = 0;
  TIERS.forEach((t, k) => { if (k && (st.vol >= t.vol || st.dep >= t.dep)) i = k; });
  return Object.assign({i, t: TIERS[i], name: TIERS[i].n, next: TIERS[i + 1] || null}, st);
}
const bar = (v, t) => `<div class="fm-bar"><i style="width:${Math.max(2, Math.min(100, v / t * 100))}%"></i></div>`;
function openVip(){
  const c = tier(), lv = (window.E && E.level) ? E.level() : null, n = c.next;
  const hero = `<div class="vp-hero"><div class="vp-cur"><span class="vp-badge">${esc(c.name)}</span><div><b>${c.i ? "VIP " + c.i : "Regular user"}</b><small>${n ? "Next: " + n.n : "Highest level reached"}</small></div></div>
    <div class="vp-stats"><div><span>30-day volume</span><b class="num">${money(c.vol)} USDT</b></div><div><span>Total deposits</span><b class="num">${money(c.dep)} USDT</b></div></div>
    ${n ? `<div class="vp-prog"><div class="vp-pl"><span>30-day volume</span><b class="num">${compact(c.vol)} / ${compact(n.vol)}</b></div>${bar(c.vol, n.vol)}
      <div class="vp-pl"><span>Total deposits</span><b class="num">${compact(c.dep)} / ${compact(n.dep)}</b></div>${bar(c.dep, n.dep)}
      <p class="vp-note">Reach <b>either</b> requirement to unlock ${n.n} and lower fees.</p></div>` : `<p class="vp-note">You have the best fee rates available.</p>`}</div>`;
  const now = `<h4 class="vp-h">Your fees today</h4><div class="vp-fees">
    <div><span>Spot</span><b class="num">${feeP(BASE.spot, c.t.off)}</b></div>
    <div><span>Futures maker / taker</span><b class="num">${feeP(BASE.fm, c.t.off)} / ${feeP(BASE.ft, c.t.off)}</b></div>
    <div><span>Options</span><b class="num">${feeP(BASE.opt, c.t.off)}</b></div>
    <div><span>Binary</span><b class="up">No fee</b></div></div>`;
  const list = TIERS.map((t, k) => `<div class="vp-t ${k === c.i ? "on" : ""}"><div class="vp-th"><b>${t.n === "Regular" ? "Regular user" : t.n}</b>${k === c.i ? '<span class="pm-pill g">Current</span>' : ""}</div>
    <p class="vp-rq">${k ? `30-day volume ≥ <b>${compact(t.vol)}</b> USDT <u>or</u> total deposits ≥ <b>${compact(t.dep)}</b> USDT` : "Default level for every new account"}</p>
    <div class="vp-g"><div><span>Spot</span><b class="num">${feeP(BASE.spot, t.off)}</b></div><div><span>Futures M/T</span><b class="num">${feeP(BASE.fm, t.off)}/${feeP(BASE.ft, t.off)}</b></div><div><span>Options</span><b class="num">${feeP(BASE.opt, t.off)}</b></div><div><span>Binary</span><b class="up">No fee</b></div></div></div>`).join("");
  U.sheet("Account level", hero + now + `<h4 class="vp-h">All levels</h4><div class="vp-list">${list}</div>` +
    (lv ? `<div class="pm-kv" style="margin-top:6px"><span>Activity level</span><b>Lv.${lv.lvl} · ${Math.max(0, lv.need - lv.cur)} XP to next</b></div>` : "") +
    `<p class="pm-s" style="margin:10px 0 0">Demo account. Volume counts closed binary, futures and spot trades of the last 30 days. Fee rates shown per level; binary trades never carry a fee.</p>`);
}
window.VIPX = {open: openVip, tier, stats, TIERS};

/* ================= Bot builder + backtest ================= */
const kcache = new Map();
function synth(sym, p0){
  let a = 0; for (const ch of sym) a = (a * 31 + ch.charCodeAt(0)) | 0;
  const r = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const out = []; let px = p0 || 100; const t0 = Math.floor(Date.now() / 1000) - 180 * 14400;
  const arr = []; for (let i = 0; i < 180; i++){ const o = px; px = px * (1 + (r() - .5) * .03); arr.push({time: t0 + i * 14400, open: o, high: Math.max(o, px) * (1 + r() * .006), low: Math.min(o, px) * (1 - r() * .006), close: px}); }
  const k = (p0 || 100) / px; arr.forEach(b => { b.open *= k; b.high *= k; b.low *= k; b.close *= k; out.push(b); });
  return out;
}
async function bars(sym){
  if (kcache.has(sym)) return kcache.get(sym);
  const pr = (async () => {
    try { const b = await M.candles(sym, "4h"); const r = (b || []).slice(-180); if (r.length > 60) return {bars: r, live: true}; } catch {}
    const p = M.get(sym); return {bars: synth(sym, p && p.price), live: false};
  })();
  kcache.set(sym, pr); return pr;
}
/* path of a bar: o -> (l|h) -> (h|l) -> c */
const path = b => b.close >= b.open ? [b.open, b.low, b.high, b.close] : [b.open, b.high, b.low, b.close];
const FEE = .0002;
function simGrid(B, inv, lev, lo, hi, N){
  const L = []; for (let i = 0; i <= N; i++) L.push(lo + (hi - lo) * i / N);
  const q = inv * lev / N / ((lo + hi) / 2), p0 = B[0].open, held = [], ent = []; let real = 0, fills = 0, wins = 0;
  for (let i = 0; i < N; i++){ held[i] = L[i] >= p0; ent[i] = p0; }
  const eq = []; let dead = false;
  const seg = (a, b) => {
    if (b < a){ for (let i = 0; i < N; i++) if (L[i] < a && L[i] >= b && !held[i]){ held[i] = true; ent[i] = L[i]; fills++; real -= q * L[i] * FEE; } }
    else { for (let i = 0; i < N; i++) if (L[i + 1] > a && L[i + 1] <= b && held[i]){ held[i] = false; real += q * (L[i + 1] - ent[i]) - q * L[i + 1] * FEE; fills++; if (L[i + 1] > ent[i]) wins++; } }
  };
  B.forEach(bar => { const P = path(bar); for (let k = 0; k < 3; k++) seg(P[k], P[k + 1]);
    const px = bar.close; let un = 0; for (let i = 0; i < N; i++) if (held[i]) un += q * (px - ent[i]);
    let e = inv + real + un; if (e <= 0 || dead){ e = 0; dead = true; } eq.push(e); });
  return {eq, trades: fills, wins, cycles: Math.max(1, fills / 2 | 0)};
}
function simMart(B, inv, lev, step, safety, tp){
  const tot = inv * lev, units = 1 + (Math.pow(2, safety + 1) - 2) + 0; /* base + doubling safeties: 1,1,2,4... */
  let w = 1; const ws = [1]; for (let i = 0; i < safety; i++){ ws.push(w); w *= 2; }
  const sum = ws.reduce((x, y) => x + y, 0), unit = tot / sum;
  let qty = 0, cost = 0, nxt = 0, real = 0, fills = 0, wins = 0, cyc = 0, dead = false, lastEntry = B[0].open, avg = 0;
  const buy = (px, k) => { const q = unit * ws[k] / px; qty += q; cost += q * px; real -= q * px * FEE; fills++; nxt = k + 1; avg = cost / qty; };
  buy(lastEntry, 0);
  const eq = [];
  const seg = (a, b) => {
    if (b < a){ while (nxt <= safety && nxt > 0){ const trig = lastEntryBase * (1 - step / 100 * nxt); if (trig <= a && trig >= b) buy(trig, nxt); else break; } }
    else { const tpx = avg * (1 + tp / 100); if (qty > 0 && tpx > a && tpx <= b){ const pnl = qty * (tpx - avg) - qty * tpx * FEE; real += pnl; fills++; cyc++; if (pnl > 0) wins++; qty = 0; cost = 0; lastEntryBase = tpx; buy(tpx, 0); } }
  };
  let lastEntryBase = lastEntry;
  B.forEach(bar => { const P = path(bar); for (let k = 0; k < 3; k++) seg(P[k], P[k + 1]);
    const un = qty * bar.close - cost; let e = inv + real + un; if (e <= 0 || dead){ e = 0; dead = true; } eq.push(e); });
  return {eq, trades: fills, wins, cycles: cyc};
}
function simDca(B, inv, lev, days, tp){
  const tot = inv * lev, n = 30, per = tot / n, every = Math.max(1, Math.round(days * 6));
  let qty = 0, cost = 0, real = 0, fills = 0, wins = 0, cyc = 0, dead = false; const eq = [];
  B.forEach((bar, i) => {
    if (i % every === 0 && cost + per <= tot){ qty += per / bar.open; cost += per; real -= per * FEE; fills++; }
    const hiPnl = qty * bar.high - cost;
    if (qty > 0 && hiPnl / cost >= tp / 100){ const px = (cost * (1 + tp / 100)) / qty, pnl = qty * px - cost - qty * px * FEE; real += pnl; fills++; cyc++; if (pnl > 0) wins++; qty = 0; cost = 0; }
    let e = inv + real + (qty * bar.close - cost); if (e <= 0 || dead){ e = 0; dead = true; } eq.push(e);
  });
  return {eq, trades: fills, wins, cycles: cyc};
}
function runSim(kind, B, P, inv){
  const r = kind === "fgrid" ? simGrid(B, inv, P.lev, P.lo, P.hi, P.grids) : kind === "fmart" ? simMart(B, inv, P.lev, P.step, P.safety, P.tp) : simDca(B, inv, P.lev, P.days, P.tp);
  const first = B[0].open, hodl = B.map(b => inv * (1 + (b.close / first - 1)));
  let peak = inv, dd = 0; r.eq.forEach(v => { peak = Math.max(peak, v); dd = Math.max(dd, (peak - v) / peak); });
  const end = r.eq[r.eq.length - 1], roi = (end / inv - 1) * 100, days = B.length / 6;
  return {eq: r.eq, hodl, end, roi, dd: dd * 100, trades: r.trades, wins: r.wins, cycles: r.cycles, daily: roi / days, monthly: roi / days * 30, apy: roi / days * 365, days};
}
const AI = {Low: {w: .12, grids: 30, lev: 2, step: 3, safety: 4, tp: 1.2, days: 2}, Medium: {w: .08, grids: 40, lev: 3, step: 2, safety: 5, tp: 1.5, days: 1}, High: {w: .05, grids: 60, lev: 5, step: 1.5, safety: 6, tp: 2, days: 1}};
const STRAT_INFO = {fgrid: {w: "futures"}, fmart: {w: "futures"}, dcap: {w: "futures"}};
function chartSvg(res){
  const W = 340, H = 176, L = 6, R = 6, T = 14, Bt = 22, cw = W - L - R, ch = H - T - Bt, n = res.eq.length;
  const all = res.eq.concat(res.hodl, [1000 * res.eq[0] / res.eq[0]]), base = res.eq[0] > 0 ? Math.round(res.eq[0]) : 1000;
  let mn = Math.min(...all), mx = Math.max(...all); const pad = (mx - mn) * .12 || 10; mn -= pad; mx += pad;
  const X = i => L + cw * i / (n - 1), Y = v => T + ch * (1 - (v - mn) / (mx - mn));
  const line = a => a.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const up = res.end >= base, col = up ? "var(--up)" : "var(--down)", d = line(res.eq);
  const grid = [0, .5, 1].map(f => { const v = mn + (mx - mn) * (1 - f), y = T + ch * f; return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="fm-gl"/><text x="${W - R}" y="${y - 3}" text-anchor="end" class="fm-gt">${num(v, 0)}</text>`; }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="fm-svg" role="img" aria-label="30-day backtest on 1,000 USDT">${grid}<line x1="${L}" x2="${W - R}" y1="${Y(base)}" y2="${Y(base)}" class="fm-base"/>
    <path d="${line(res.hodl)}" class="fm-hodl" fill="none"/><path d="${d} L${X(n - 1)} ${T + ch} L${X(0)} ${T + ch} Z" fill="${col}" opacity=".10"/>
    <path d="${d}" class="fm-ln" fill="none" stroke="${col}" pathLength="1"/><circle cx="${X(n - 1)}" cy="${Y(res.end)}" r="3.6" fill="${col}"/>
    <text x="${L}" y="${H - 6}" class="fm-gt">30d ago</text><text x="${W - R}" y="${H - 6}" text-anchor="end" class="fm-gt">Today</text>
    <g class="fm-tip" style="display:none"><line class="fm-tl" y1="${T}" y2="${T + ch}"/><circle r="4" fill="${col}"/></g><rect x="${L}" y="${T}" width="${cw}" height="${ch}" fill="transparent" class="fm-hit"/></svg>`;
}
function openBot(s, onStart){
  const kind = s.k, defTpl = {fgrid: {tag: "Futures Grid", risk: "Medium"}, fmart: {tag: "Futures Martingale", risk: "Medium"}, dcap: {tag: "DCA Perp", risk: "Medium"}}[kind];
  const pairs = [...M.pairs.values()].filter(p => p.type === "crypto" && p.tradable && /USDT$/.test(p.sym)).slice(0, 40);
  const dflt = {fgrid: "BTCUSDT", fmart: "BTCUSDT", dcap: "ETHUSDT"}[kind];
  const st = {mode: "ai", sym: pairs.find(p => p.sym === dflt) ? dflt : (pairs[0] && pairs[0].sym) || "BTCUSDT", risk: "Medium", P: null, res: null, live: true, token: 0};
  const manual = {lev: 3, grids: 40, lo: 0, hi: 0, step: 2, safety: 5, tp: 1.5, days: 1};
  const px = () => { const p = M.get(st.sym); return p && p.price || 1; };
  const body = `<div class="fm-bot"><div class="seg fm-tabs" role="tablist"><button data-md="ai" class="on" role="tab">AI</button><button data-md="manual" role="tab">Manual</button></div>
    <span class="pm-lbl">Asset</span><select class="pm-sel" id="fmSym" aria-label="Asset">${pairs.map(p => `<option value="${p.sym}" ${p.sym === st.sym ? "selected" : ""}>${esc(M.label(p))}</option>`).join("")}</select>
    <div id="fmAi"><span class="pm-lbl">Risk profile</span><div class="seg fm-risk">${["Low", "Medium", "High"].map(r => `<button data-rk="${r}" class="${r === st.risk ? "on" : ""}">${r}</button>`).join("")}</div></div>
    <div id="fmPar" class="fm-par"></div>
    <span class="pm-lbl">Investment</span><div class="pm-fld" id="fmInvF"><input id="fmInv" type="number" inputmode="decimal" min="10" value="100" aria-label="Investment amount"><span class="u">USDT</span><button type="button" class="mx" data-max>Max</button></div>
    <div class="pm-kv" style="margin-top:6px"><span>Avbl (Futures)</span><b class="num">${money(store.wb("futures"))} USDT <button class="wl-plus" data-wlto="futures" aria-label="Transfer in">${ic("plus", 13, 3)}</button></b></div><div class="pm-kv"><span>Minimum</span><b class="num">10 USDT</b></div>
    <div class="fm-est" id="fmEst"><div><span>Est. APY</span><b class="num">--</b></div><div><span>Monthly</span><b class="num">--</b></div><div><span>Daily</span><b class="num">--</b></div></div>
    <p class="fm-cap">Based on a 30-day backtest, not a promise of future returns.</p>
    <section class="fm-bt" id="fmBt"><div class="fm-bth"><b>30-day backtest</b><span>on 1,000 USDT</span></div><div class="fm-chart" id="fmCh"><div class="fm-sk">Scroll to load the backtest</div></div>
      <div class="fm-leg"><span><i class="a"></i>Bot</span><span><i class="b"></i>Hold</span></div><div class="fm-rs" id="fmRs"></div></section>
    <div class="pm-err" id="fmErr"></div><button class="btn btn-primary pm-cta" data-ok>Start bot</button></div>`;
  U.sheet("Create " + s.name, body, el => {
    const $ = q => el.querySelector(q); let timer = 0, seen = false, io = null, dead = false;
    const params = () => {
      if (st.mode === "ai"){ const a = AI[st.risk], p = px(); return {lev: a.lev, grids: a.grids, lo: p * (1 - a.w), hi: p * (1 + a.w), step: a.step, safety: a.safety, tp: a.tp, days: a.days}; }
      const m = manual; return {lev: m.lev, grids: m.grids, lo: m.lo, hi: m.hi, step: m.step, safety: m.safety, tp: m.tp, days: m.days};
    };
    const fp = v => M.fmtPx ? M.fmtPx(M.get(st.sym) || {price: v}, v) : num(v, 2);
    const parHtml = () => {
      const P = params(), kv = (k, v) => `<div class="pm-kv"><span>${k}</span><b class="num">${v}</b></div>`;
      if (st.mode === "ai") return (kind === "fgrid" ? kv("Price range", fp(P.lo) + " – " + fp(P.hi)) + kv("Grids", P.grids) : kind === "fmart" ? kv("Price step", P.step + "%") + kv("Safety orders", P.safety) + kv("Take profit", P.tp + "%") : kv("Buy every", P.days + (P.days > 1 ? " days" : " day")) + kv("Take profit", P.tp + "%")) + kv("Leverage", P.lev + "x") + `<p class="fm-cap" style="margin:4px 0 0">Parameters are set automatically from the ${esc(st.risk.toLowerCase())}-risk profile and the latest price.</p>`;
      const f = (id, label, val, extra = "") => `<label class="fm-f"><span>${label}</span><div class="fm-in"><input id="${id}" type="number" inputmode="decimal" value="${val}" ${extra} aria-label="${label}"></div></label>`;
      const r = n => Number(n.toPrecision(5));
      return `<div class="fm-g2">${kind === "fgrid" ? f("mLo", "Lower price", r(P.lo)) + f("mHi", "Upper price", r(P.hi)) + f("mGr", "Grids (2-100)", P.grids) : kind === "fmart" ? f("mSt", "Price step %", P.step) + f("mSa", "Safety orders (1-8)", P.safety) + f("mTp", "Take profit %", P.tp) : f("mDa", "Buy every (days)", P.days) + f("mTp", "Take profit %", P.tp)}${f("mLv", "Leverage (1-20x)", P.lev)}</div>`;
    };
    const num2 = id => { const e = $("#" + id); return e ? parseFloat(e.value) : NaN; };
    const readManual = () => {
      const g = (id, d, lo, hi) => { const v = num2(id); return isNaN(v) ? d : Math.min(hi, Math.max(lo, v)); };
      manual.lev = g("mLv", manual.lev, 1, 20);
      if (kind === "fgrid"){ manual.lo = g("mLo", manual.lo, 0, 1e12); manual.hi = g("mHi", manual.hi, 0, 1e12); manual.grids = Math.round(g("mGr", manual.grids, 2, 100)); }
      if (kind === "fmart"){ manual.step = g("mSt", manual.step, .3, 15); manual.safety = Math.round(g("mSa", manual.safety, 1, 8)); manual.tp = g("mTp", manual.tp, .3, 20); }
      if (kind === "dcap"){ manual.days = Math.round(g("mDa", manual.days, 1, 14)); manual.tp = g("mTp", manual.tp, .3, 20); }
    };
    const validate = () => { const P = params(); if (kind === "fgrid" && !(P.lo > 0 && P.hi > P.lo)) return "Upper price must be higher than lower price."; return ""; };
    const renderPar = () => { $("#fmAi").style.display = st.mode === "ai" ? "" : "none"; if (st.mode === "manual" && !manual.lo){ const p = px(); manual.lo = p * .92; manual.hi = p * 1.08; } $("#fmPar").innerHTML = parHtml(); bindManual(); };
    const bindManual = () => el.querySelectorAll("#fmPar input").forEach(i => i.addEventListener("input", () => { readManual(); sched(); }));
    const statsHtml = r => `<div><span>Final value</span><b class="num">${money(r.end)} USDT</b></div><div><span>Return (30d)</span><b class="num ${r.roi >= 0 ? "up" : "down"}">${r.roi >= 0 ? "+" : ""}${num(r.roi)}%</b></div><div><span>Max drawdown</span><b class="num down">-${num(r.dd)}%</b></div><div><span>Orders filled</span><b class="num">${r.trades}</b></div><div><span>Win rate</span><b class="num">${r.cycles ? num(Math.min(100, r.wins / Math.max(1, r.kind === "fgrid" ? r.trades / 2 : r.cycles) * 100), 0) : "--"}%</b></div><div><span>Data</span><b>${st.live ? "Live prices" : "Simulated"}</b></div>`;
    const est = r => { const c = (v, d) => (v >= 0 ? "+" : "") + num(v, d) + "%"; const cl = r.roi >= 0 ? "up" : "down";
      $("#fmEst").innerHTML = `<div><span>Est. APY</span><b class="num ${cl}">${c(r.apy, 1)}</b></div><div><span>Monthly</span><b class="num ${cl}">${c(r.monthly, 2)}</b></div><div><span>Daily</span><b class="num ${cl}">${c(r.daily, 3)}</b></div>`; };
    const compute = async () => {
      const tk = ++st.token, err = validate(); $("#fmErr").textContent = ""; if (err){ $("#fmEst").innerHTML = '<div><span>Est. APY</span><b>--</b></div><div><span>Monthly</span><b>--</b></div><div><span>Daily</span><b>--</b></div>'; $("#fmCh").innerHTML = `<div class="fm-sk">${err}</div>`; $("#fmRs").innerHTML = ""; st.res = null; return; }
      const d = await bars(st.sym); if (dead || tk !== st.token) return; st.live = d.live;
      const P = params(); st.P = P; const r = runSim(kind, d.bars, P, 1000); r.kind = kind; st.res = r; est(r); $("#fmRs").innerHTML = statsHtml(r);
      if (seen) drawChart(); else $("#fmCh").innerHTML = '<div class="fm-sk">Scroll to load the backtest</div>';
    };
    const drawChart = () => { const r = st.res; if (!r) return; const c = $("#fmCh"); c.innerHTML = chartSvg(r); const ln = c.querySelector(".fm-ln"); requestAnimationFrame(() => requestAnimationFrame(() => ln && ln.classList.add("go")));
      const svg = c.querySelector("svg"), tip = svg.querySelector(".fm-tip"), hit = svg.querySelector(".fm-hit"), tl = svg.querySelector(".fm-tl"), dot = tip.querySelector("circle");
      const lab = document.createElement("div"); lab.className = "fm-tt"; lab.style.display = "none"; c.appendChild(lab);
      const mv = e => { const b = svg.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), i = Math.round(f * (r.eq.length - 1)), vb = svg.viewBox.baseVal;
        const x = 6 + (vb.width - 12) * i / (r.eq.length - 1), all = r.eq.concat(r.hodl), mn0 = Math.min(...all, 1000), mx0 = Math.max(...all, 1000); void mn0; void mx0;
        tip.style.display = ""; tl.setAttribute("x1", x); tl.setAttribute("x2", x); dot.setAttribute("cx", x);
        const m = svg.querySelector(".fm-ln"); const len = m.getTotalLength(), pt = m.getPointAtLength(len * i / (r.eq.length - 1)); dot.setAttribute("cy", pt.y);
        const when = new Date(Date.now() - (r.eq.length - 1 - i) * 4 * 3600e3);
        lab.style.display = ""; lab.innerHTML = `${when.toLocaleDateString("en-US", {month: "short", day: "numeric"})} · <b class="num">${money(r.eq[i])}</b>`; lab.style.left = Math.min(b.width - 110, Math.max(0, f * b.width - 55)) + "px"; };
      hit.addEventListener("pointermove", mv); hit.addEventListener("pointerdown", mv); hit.addEventListener("pointerleave", () => { tip.style.display = "none"; lab.style.display = "none"; });
    };
    const sched = () => { clearTimeout(timer); timer = setTimeout(compute, 220); };
    if ("IntersectionObserver" in window){ io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !seen){ seen = true; drawChart(); io.disconnect(); } }, {threshold: .25}); io.observe($("#fmBt")); } else { seen = true; }
    el.addEventListener("click", e => {
      const md = e.target.closest("[data-md]"); if (md){ st.mode = md.dataset.md; el.querySelectorAll("[data-md]").forEach(b => b.classList.toggle("on", b === md)); renderPar(); sched(); return; }
      const rk = e.target.closest("[data-rk]"); if (rk){ st.risk = rk.dataset.rk; el.querySelectorAll("[data-rk]").forEach(b => b.classList.toggle("on", b === rk)); renderPar(); sched(); }
    });
    $("#fmSym").addEventListener("change", e => { st.sym = e.target.value; manual.lo = 0; renderPar(); sched(); });
    $("[data-max]").onclick = () => { $("#fmInv").value = Math.floor(store.wb("futures") * 100) / 100; };
    $("[data-ok]").onclick = () => {
      const inv = parseFloat($("#fmInv").value), err0 = validate(), P = params(), p = M.get(st.sym), id = kind + "~" + st.sym, E_ = window.E, e = $("#fmErr");
      if (err0){ e.textContent = err0; return; }
      if (S().bots[id] && S().bots[id].running){ e.textContent = "A " + s.name + " bot is already running on " + (p ? M.label(p) : st.sym) + "."; return; }
      const r = st.res, daily = r ? r.daily : 0;
      const def = {id, wallet: "futures", name: s.name + " · " + (p ? p.base : st.sym.replace("USDT", "")), tag: s.name, pair: st.sym, desc: s.desc, mult: P.lev, grid: Math.max(0, Math.min(2e-5, daily / 100 / 1440)), risk: st.mode === "ai" ? st.risk : (P.lev >= 10 ? "High" : P.lev >= 4 ? "Medium" : "Low"), apy: r ? num(r.apy, 0) + "%" : "--"};
      const known = E_.BOTS.find(x => x.id === id); if (known) Object.assign(known, def); else E_.BOTS.push(def);
      const er = E_.startBot(id, inv);
      e.textContent = er || ""; $("#fmInvF").classList.toggle("err", !!er); if (er){ if (UI.walletErr) UI.walletErr(er); return; }
      S().bots[id].def = def; store.save(); U.closeLayer(); toast("Bot started", "ok"); onStart && onStart();
    };
    renderPar(); compute();
    el._fmDispose = () => { dead = true; clearTimeout(timer); io && io.disconnect(); };
  }, () => {});
}
window.BOTX = {open: openBot, run: runSim};
/* re-register custom bot definitions saved with running/stopped bots (engine only knows its built-in list) */
try { Object.entries(S().bots || {}).forEach(([id, b]) => { if (b && b.def && !E.BOTS.find(x => x.id === id)) E.BOTS.push(b.def); }); } catch {}

/* ================= Share PnL (PnL analysis page) -> real image card ================= */
(function(){
  const orig = U.sheet;
  U.sheet = function(title, html, mount, close){
    if (title === "Share PnL" && typeof html === "string" && html.includes("pn-card") && UI.sharePnl){
      try {
        const d = document.createElement("div"); d.innerHTML = html;
        const q = s => (d.querySelector(s) || {}).textContent || "";
        const roi = parseFloat(q(".pn-croi").replace(/[+,%\s]/g, "")), pnlTxt = (d.querySelector(".pn-croi").nextElementSibling || {}).textContent || "0";
        const pnl = parseFloat(pnlTxt.replace(/[+,\sA-Za-z]/g, "")) || 0, cg = [...d.querySelectorAll(".pn-cg b")].map(x => x.textContent);
        const meta = q(".pn-ch-h span");
        return UI.sharePnl({summary: true, label: "Trading summary", mode: meta, roi: isFinite(roi) ? roi : 0, pnl, stats: [["Trades", cg[0] || "--"], ["Win rate", cg[1] || "--"], ["Profit factor", cg[2] || "--"]], product: "Demo trading", time: Date.now()});
      } catch (e) { /* fall through to the original sheet */ }
    }
    return orig.apply(this, arguments);
  };
})();

/* ================= keyboard closed -> commit the typed value ================= */
(function(){
  const isTxt = el => el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !/^(checkbox|radio|range|button|submit|file|color)$/i.test(el.type)));
  const commit = el => { try { el.dispatchEvent(new Event("input", {bubbles: true})); el.dispatchEvent(new Event("change", {bubbles: true})); } catch {} };
  let vals = new WeakMap();
  document.addEventListener("focusin", e => { if (isTxt(e.target)) vals.set(e.target, e.target.value); }, true);
  document.addEventListener("focusout", e => { const t = e.target; if (isTxt(t) && vals.get(t) !== t.value){ vals.set(t, t.value); /* native change fires too; dispatch only if the browser did not */ } }, true);
  const vv = window.visualViewport; let h = vv ? vv.height : innerHeight, ih = innerHeight, kb = false;
  const closed = () => { const a = document.activeElement; if (isTxt(a)){ commit(a); a.blur(); } };
  const onRs = () => { const nh = vv ? vv.height : innerHeight, nih = innerHeight;
    if (nh < h - 120 || nih < ih - 120) kb = true;
    else if (kb && (nh > h + 80 || nih > ih + 80 || (vv && nh >= nih - 40 && h < nih - 120))){ kb = false; closed(); }
    h = nh; ih = nih; };
  if (vv) vv.addEventListener("resize", onRs); addEventListener("resize", onRs);
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target && e.target.tagName === "INPUT" && isTxt(e.target) && !e.isComposing){ commit(e.target); e.target.blur(); } }, true);
})();
})();
