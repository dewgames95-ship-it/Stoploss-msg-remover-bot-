/* ===== v7.1 CFD Trade — Forex / Commodities / Indices / Crypto CFDs against the `cfd` wallet =====
   Routes: #/cfd  ·  #/cfd/<SYM>   (e.g. #/cfd/XAUUSD)      API: window.CFD = {open, data, positions, history, close, modify, quote}
   • Top-5 symbols per category (20 total). Prices come from the app's live feeds (M.get); a closed or stale feed disables trading
     (the last known price is only shown, never traded and never invented).
   • Spread = 20% of a typical broker spread (80% tighter). No fee, no commission, no swap. Market orders only, no confirmation.
   • Margin = notional / leverage. Margin leaves the CFD wallet on open and comes back (+PnL) on close. Stop-out at 20% margin level.
   • State: U.store.s.cfd = {positions:[], history:[]}  (persisted with U.store.save()). The TP/SL + stop-out engine runs globally
     on every price tick, also while the page is not open. Notifications: U.pushNotif("trade", ...). */
(function(){
if (!window.U || !window.M) return;
const {esc, ic, store, fmt, toast, bus} = U;
const W = "cfd", LAST_KEY = "nt_cfd_last", STOP_OUT = 20, MAX_POS = 30;

/* ---------- instruments ---------- */
const CATS = [["forex", "Forex"], ["commodities", "Commodities"], ["indices", "Indices"], ["crypto", "Crypto"]];
const LEV = {forex: [10, 50, 100, 200, 500], commodities: [10, 50, 100, 200, 500], indices: [10, 20, 50, 100], crypto: [2, 5, 10, 20]};
const LEV_DEF = {forex: 100, commodities: 100, indices: 50, crypto: 10};
const LOT_DEF = {forex: .1, commodities: .1, indices: .1, crypto: .01};
const CUT = .2;                        // our spread = 20% of the typical broker spread
const SP = {}, ORDER = {};
/* typ = typical standard-account spread in price units; pt = one pip / point in price units; kind: q = USD is the quote currency, b = USD is the base (USDJPY, USDCAD) */
function def(cat, sym, name, src, dp, size, unit, typ, pt, kind){
  SP[sym] = {sym, cat, name, src, dp, size, unit, typ, pt, kind: kind || "q", sp: +(typ * CUT).toFixed(8)};
  (ORDER[cat] = ORDER[cat] || []).push(sym);
}
def("forex", "EURUSD", "Euro / US Dollar", ["EURUSD"], 5, 100000, "units", 1e-4, 1e-4);
def("forex", "GBPUSD", "British Pound / US Dollar", ["GBPUSD"], 5, 100000, "units", 1.3e-4, 1e-4);
def("forex", "USDJPY", "US Dollar / Japanese Yen", ["USDJPY"], 3, 100000, "units", .012, .01, "b");
def("forex", "AUDUSD", "Australian Dollar / US Dollar", ["AUDUSD"], 5, 100000, "units", 1.2e-4, 1e-4);
def("forex", "USDCAD", "US Dollar / Canadian Dollar", ["USDCAD"], 5, 100000, "units", 1.5e-4, 1e-4, "b");
def("forex", "USDINR", "US Dollar / Indian Rupee", ["USDINR"], 4, 100000, "units", .03, .01, "b");
def("commodities", "XAUUSD", "Gold", ["XAUUSD", "XAUUSDT"], 2, 100, "oz", .3, .01);
def("commodities", "XAGUSD", "Silver", ["XAGUSD", "XAGUSDT"], 3, 5000, "oz", .03, .001);
def("commodities", "USOIL", "WTI Crude Oil", ["USOIL", "CLUSDT"], 3, 1000, "bbl", .03, .01);
def("commodities", "UKOIL", "Brent Crude Oil", ["UKOIL", "BZUSDT"], 3, 1000, "bbl", .04, .01);
def("commodities", "XNGUSD", "Natural Gas", ["XNGUSD", "NATGASUSDT"], 3, 10000, "mmBtu", .005, .001);
def("indices", "US30", "Dow Jones 30", ["US30"], 2, 1, "× index", 3, 1);
def("indices", "US500", "S&P 500", ["US500"], 2, 1, "× index", .6, 1);
def("indices", "NAS100", "Nasdaq 100", ["USTEC", "NAS100"], 2, 1, "× index", 1.5, 1);
def("indices", "GER40", "DAX 40", ["DE30", "GER40"], 2, 1, "× index", 1.5, 1);
def("indices", "UK100", "FTSE 100", ["UK100"], 2, 1, "× index", 1.2, 1);
def("crypto", "BTCUSD", "Bitcoin", ["BTCUSDT"], 2, 1, "BTC", 30, 1);
def("crypto", "ETHUSD", "Ethereum", ["ETHUSDT"], 2, 1, "ETH", 2, .1);
def("crypto", "SOLUSD", "Solana", ["SOLUSDT"], 2, 1, "SOL", .15, .01);
def("crypto", "XRPUSD", "XRP", ["XRPUSDT"], 4, 1, "XRP", .003, .0001);
def("crypto", "BNBUSD", "BNB", ["BNBUSDT"], 2, 1, "BNB", .6, .1);
const ALIAS = {XAUUSDT: "XAUUSD", XAGUSDT: "XAGUSD", WTI: "USOIL", BRENT: "UKOIL", NGAS: "XNGUSD", USTEC: "NAS100", DE30: "GER40", DAX: "GER40", BTCUSDT: "BTCUSD", ETHUSDT: "ETHUSD", SOLUSDT: "SOLUSD", XRPUSDT: "XRPUSD", BNBUSDT: "BNBUSD", SPX500: "US500", DOW: "US30"};
const norm = s => { s = String(s || "").toUpperCase(); s = ALIAS[s] || s; return SP[s] ? s : null; };
const REV = {};      // M symbol -> [cfd symbols]
Object.values(SP).forEach(d => d.src.forEach(m => (REV[m] = REV[m] || []).push(d.sym)));

/* ---------- small helpers ---------- */
const r2 = v => Math.round((+v || 0) * 100) / 100;
const rnd = (v, dp) => { const k = Math.pow(10, dp); return Math.round(v * k) / k; };
const px = (v, dp) => v == null || isNaN(v) ? "--" : fmt(v, dp);
const sg = (v, d = 2) => (v > 0.004 ? "+" : v < -0.004 ? "-" : "") + fmt(Math.abs(v), d);
const cls = v => v > 0.004 ? "up" : v < -0.004 ? "dn" : "";
const trim = v => { let s = String(+(+v).toFixed(5)); if (!s.includes(".")) s += ".00"; else if (s.split(".")[1].length < 2) s += "0"; return s; };
const buzz = p => { try { U.buzz && U.buzz(p); } catch {} };
const tipFn = (t, h) => { try { return (UI.tip || UI.help)(t, h); } catch (e) { console.warn(e); } };
const ni = (el, dp) => { const f = U.numInput || (window.TX && TX.numInput); if (f && el) f(el, {dp}); return el; };
const unitsTxt = (d, lots) => { const u = +(lots * d.size).toFixed(4); const n = u >= 1000 ? fmt(u, 0) : String(+u.toFixed(4)); return d.cat === "indices" ? `${n} × ${d.sym}` : `${n} ${d.unit}`; };
const LK = () => { try { return JSON.parse(localStorage.getItem(LAST_KEY) || "{}") || {}; } catch { return {}; } };
let LAST = null, lastSv = 0;
const remember = (sym, v) => { if (!LAST) LAST = LK(); if (LAST[sym] === v) return; LAST[sym] = v; const t = Date.now(); if (t - lastSv > 5000){ lastSv = t; try { localStorage.setItem(LAST_KEY, JSON.stringify(LAST)); } catch {} } };

/* ---------- prices: live feed -> bid / ask ---------- */
function feed(sym){
  const d = SP[sym]; let best = null;
  for (const s of d.src){
    const p = M.get(s); if (!p || !(p.price > 0)) continue;
    const fresh = !M.isStale(p), closed = !!p.closed;
    const c = {mid: p.price, live: fresh && !closed, closed, p, ms: s, chg: p.chg};
    if (!best || (c.live && !best.live)) best = c;
    if (best.live) break;
  }
  if (best){ remember(sym, best.mid); return best; }
  if (!LAST) LAST = LK();
  return LAST[sym] > 0 ? {mid: LAST[sym], live: false, closed: false, last: true, p: null, ms: d.src[0], chg: null} : null;
}
function quote(sym){
  const f = feed(sym); if (!f) return null;
  const d = SP[sym], bid = rnd(f.mid - d.sp / 2, d.dp), ask = rnd(bid + d.sp, d.dp);
  return {sym, bid, ask, mid: f.mid, live: f.live, closed: f.closed, last: !!f.last, ms: f.ms, chg: f.chg};
}
/* ---------- contract maths ---------- */
const unitsOf = (d, lots) => +(lots * d.size).toFixed(6);
const notionalOf = (d, lots, price) => d.kind === "b" ? unitsOf(d, lots) : unitsOf(d, lots) * price;
const pipVal = (d, lots, price) => unitsOf(d, lots) * d.pt / (d.kind === "b" ? price : 1);     // USDT per pip / point
const spreadCost = (d, lots, price) => unitsOf(d, lots) * d.sp / (d.kind === "b" ? price : 1);
const typCost = (d, lots, price) => unitsOf(d, lots) * d.typ / (d.kind === "b" ? price : 1);
function pnlAt(p, at){ const d = SP[p.sym]; let v = (p.side === "buy" ? 1 : -1) * (at - p.entry) * p.units; if (d.kind === "b") v /= at; return v; }
const closePx = (p, q) => p.side === "buy" ? q.bid : q.ask;
function spTxt(d, v){ return d.cat === "forex" ? fmt(v / d.pt, v / d.pt < 1 ? 2 : 1) + " pips" : d.cat === "indices" ? trim(v) + " pts" : "$" + trim(v); }
const typTxt = d => d.cat === "forex" ? "~" + fmt(d.typ / d.pt, 1) + " pip" + (d.typ / d.pt === 1 ? "" : "s") : d.cat === "indices" ? "~" + trim(d.typ) + " pts" : "~$" + trim(d.typ);

/* ---------- state (U.store.s.cfd) ---------- */
function D(){ const s = store.s; if (!s.cfd || typeof s.cfd !== "object") s.cfd = {}; if (!Array.isArray(s.cfd.positions)) s.cfd.positions = []; if (!Array.isArray(s.cfd.history)) s.cfd.history = []; return s.cfd; }
const bal = () => store.wb(W);
function acct(){
  const ps = D().positions; let used = 0, fl = 0, ok = true;
  for (const p of ps){ used += p.margin; const q = quote(p.sym); if (q) fl += pnlAt(p, closePx(p, q)); else ok = false; }
  const b = bal(), eq = b + used + fl;
  return {bal: b, used: r2(used), fl, eq, free: b + fl, level: used > 0 ? eq / used * 100 : null, ok, n: ps.length};
}
const emit = () => bus.emit("cfd");

/* ---------- trading ---------- */
function openPos(sym, side, lots, lev, tp, sl){
  const d = SP[sym], q = quote(sym);
  if (!q) return {err: "No price yet: Waiting for the live price"};
  if (!q.live) return {err: q.closed ? "Market closed: This market is closed right now" : "Price not live: Waiting for the live price"};
  const P = D().positions; if (P.length >= MAX_POS) return {err: "Limit reached: Close a position first (max " + MAX_POS + ")"};
  lots = r2(lots); if (!(lots >= .01 && lots <= 100)) return {err: "Lot size: Use 0.01 to 100 lots"};
  const entry = side === "buy" ? q.ask : q.bid;
  if (tp && (side === "buy" ? tp <= q.ask : tp >= q.bid)) return {err: "Take profit: Must be " + (side === "buy" ? "above" : "below") + " the " + (side === "buy" ? "buy" : "sell") + " price"};
  if (sl && (side === "buy" ? sl >= q.bid : sl <= q.ask)) return {err: "Stop loss: Must be " + (side === "buy" ? "below" : "above") + " the " + (side === "buy" ? "sell" : "buy") + " price"};
  const margin = r2(notionalOf(d, lots, entry) / lev), a = acct();
  if (margin > bal() + 1e-9 || margin > a.free + 1e-9) return {err: "Not enough margin: Add funds to your CFD wallet", short: r2(Math.max(margin - Math.min(bal(), a.free), .01)), margin};
  store.addWallet(W, -margin, "cfd");
  const pos = {id: U.uid(), sym, side, lots, lev, units: unitsOf(d, lots), entry, margin, tp: tp || 0, sl: sl || 0, t: Date.now()};
  P.push(pos); store.save(); emit();
  return {pos, q};
}
function closePos(id, reason){
  const P = D().positions, i = P.findIndex(x => x.id === id); if (i < 0) return null;
  const p = P[i], q = quote(p.sym);
  if (!q || !q.live) return {err: q && q.closed ? "Market closed: You can close once it reopens" : "Price not live: Try again in a moment"};
  const at = closePx(p, q); let pnl = pnlAt(p, at); if (p.margin + pnl < 0) pnl = -p.margin;      // a position can never lose more than its margin
  pnl = r2(pnl);
  P.splice(i, 1);
  store.addWallet(W, Math.max(0, r2(p.margin + pnl)), "cfd");
  const h = {id: p.id, sym: p.sym, side: p.side, lots: p.lots, lev: p.lev, entry: p.entry, close: at, margin: p.margin, pnl, roi: p.margin > 0 ? pnl / p.margin * 100 : 0, reason: reason || "manual", t: p.t, tc: Date.now(), tp: p.tp, sl: p.sl};
  const H = D().history; H.unshift(h); if (H.length > 200) H.length = 200;
  store.save(); emit(); return {h};
}
const REASON = {manual: "Closed", tp: "Take profit", sl: "Stop loss", stopout: "Stop-out"};
function autoNote(h, reason){
  const d = SP[h.sym], title = reason === "tp" ? "Take profit hit" : reason === "sl" ? "Stop loss hit" : "Stop-out";
  const body = `${d.sym} ${h.side === "buy" ? "Buy" : "Sell"} ${fmt(h.lots, 2)} lot closed at ${px(h.close, d.dp)} · ${sg(h.pnl)} USDT`;
  try { U.pushNotif("trade", title, reason === "stopout" ? body + ". Equity fell to 20% of used margin." : body, h.pnl >= 0 ? "ok" : "bad"); } catch {}
  toast(`${title}: ${d.sym} ${sg(h.pnl)} USDT`, h.pnl >= 0 ? "ok" : "bad");
}
let busy = false;
function check(){
  if (busy) return; busy = true;
  try {
    const P = D().positions; if (!P.length) return;
    for (const p of P.slice()){
      if (!p.tp && !p.sl) continue;
      const q = quote(p.sym); if (!q || !q.live) continue;
      const at = closePx(p, q), buy = p.side === "buy";
      let why = null;
      if (p.tp && (buy ? at >= p.tp : at <= p.tp)) why = "tp"; else if (p.sl && (buy ? at <= p.sl : at >= p.sl)) why = "sl";
      if (why){ const r = closePos(p.id, why); if (r && r.h){ buzz(why === "tp" ? "win" : "loss"); autoNote(r.h, why); } }
    }
    for (let g = 0; g < 40 && D().positions.length; g++){
      const a = acct(); if (!a.ok || a.level == null || a.level > STOP_OUT) break;
      let worst = null, wp = Infinity;
      for (const p of D().positions){ const q = quote(p.sym); if (!q || !q.live) continue; const v = pnlAt(p, closePx(p, q)); if (v < wp){ wp = v; worst = p; } }
      if (!worst) break;
      const r = closePos(worst.id, "stopout"); if (!r || !r.h) break; buzz("alert"); autoNote(r.h, "stopout");
    }
  } finally { busy = false; }
}
/* global engine: runs on every tick of a CFD feed, also while the page is closed */
bus.on("tick", s => { if (REV[s] && D().positions.length) check(); });
setTimeout(check, 4000); setTimeout(check, 12000);

/* ---------- inline graphics for the help popups ---------- */
const SV = {
  cfd: `<svg viewBox="0 0 280 96" width="100%" role="img" aria-label="Price goes up, you profit"><path d="M14 74 L66 62 L108 70 L158 40 L206 46 L262 14" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="2" stroke-linejoin="round"/><circle cx="108" cy="70" r="5" style="fill:var(--brand)"/><circle cx="262" cy="14" r="5" style="fill:var(--up)"/><path d="M108 70 L108 86 M262 14 L262 86" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="3 3"/><text x="108" y="94" text-anchor="middle" font-size="9.5" fill="currentColor">Buy 2,400.06</text><text x="258" y="94" text-anchor="end" font-size="9.5" fill="currentColor">Close 2,410.00</text><text x="14" y="14" font-size="10" font-weight="700" style="fill:var(--up)">+99.40 USDT</text></svg>`,
  lot: `<svg viewBox="0 0 280 70" width="100%" role="img" aria-label="Lots"><rect x="8" y="10" width="64" height="30" rx="6" style="fill:var(--brand)" opacity=".9"/><text x="40" y="29" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">1 lot</text><text x="40" y="58" text-anchor="middle" font-size="9.5" fill="currentColor">100 oz of gold</text><rect x="108" y="18" width="20" height="22" rx="4" style="fill:var(--brand)" opacity=".9"/><text x="118" y="33" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff">.10</text><text x="118" y="58" text-anchor="middle" font-size="9.5" fill="currentColor">0.10 lot = 10 oz</text><rect x="196" y="25" width="8" height="15" rx="3" style="fill:var(--brand)" opacity=".9"/><text x="224" y="58" text-anchor="middle" font-size="9.5" fill="currentColor">0.01 lot = 1 oz</text></svg>`,
  lev: `<svg viewBox="0 0 280 92" width="100%" role="img" aria-label="Leverage and margin"><text x="8" y="14" font-size="9.5" fill="currentColor">Position size (what you trade)</text><rect x="8" y="20" width="264" height="22" rx="5" style="fill:var(--brand)" opacity=".28"/><text x="140" y="35" text-anchor="middle" font-size="10.5" font-weight="700" fill="currentColor">24,000.60 USDT</text><text x="8" y="62" font-size="9.5" fill="currentColor">Margin you lock at 1:100</text><rect x="8" y="68" width="2.64" height="22" rx="1" style="fill:var(--brand)"/><rect x="8" y="68" width="32" height="22" rx="5" style="fill:var(--brand)"/><text x="48" y="83" font-size="10.5" font-weight="700" fill="currentColor">240.01 USDT</text></svg>`,
  spread: `<svg viewBox="0 0 280 100" width="100%" role="img" aria-label="Spread comparison"><text x="8" y="12" font-size="9.5" fill="currentColor">XAUUSD spread, 1 lot = 100 oz</text><rect x="8" y="20" width="264" height="18" rx="5" style="fill:var(--down)" opacity=".25"/><rect x="8" y="20" width="264" height="18" rx="5" fill="none" style="stroke:var(--down)" stroke-opacity=".5"/><text x="14" y="33" font-size="10" fill="currentColor">Typical broker  $0.30</text><rect x="8" y="48" width="52.8" height="18" rx="5" style="fill:var(--up)"/><text x="68" y="61" font-size="10" font-weight="700" style="fill:var(--up)">NovaTrade  $0.06</text><text x="8" y="90" font-size="9.5" fill="currentColor">Bid 2,400.00  |  Ask 2,400.06  (gap = spread)</text></svg>`,
  fee: `<svg viewBox="0 0 280 52" width="100%" role="img" aria-label="No fees"><g font-size="10" font-weight="700" fill="currentColor"><rect x="4" y="8" width="84" height="32" rx="8" style="fill:var(--up-bg);stroke:var(--up)"/><text x="46" y="28" text-anchor="middle">No fee</text><rect x="98" y="8" width="84" height="32" rx="8" style="fill:var(--up-bg);stroke:var(--up)"/><text x="140" y="28" text-anchor="middle">No commission</text><rect x="192" y="8" width="84" height="32" rx="8" style="fill:var(--up-bg);stroke:var(--up)"/><text x="234" y="28" text-anchor="middle">No swap</text></g></svg>`
};
const H = {
  lot: d => ["Lot size", `<p>A <b>lot</b> is the trade size. Pick 0.01 to 100 lots.</p><p><b>1 lot of ${d.sym} = ${d.cat === "indices" ? "1 × the index" : fmt(d.size, 0) + " " + d.unit}.</b> So 0.10 lot = ${unitsTxt(d, .1)}.</p><p>A bigger lot means bigger profit and bigger loss for every price move.</p>${SV.lot}`],
  lev: () => ["Leverage", `<p><b>Leverage</b> lets you control a large position with a small deposit. At 1:100 you lock 1 USDT of margin for every 100 USDT of position.</p><p>Profit and loss are calculated on the full position, so higher leverage means faster gains and faster losses.</p>${SV.lev}`],
  margin: () => ["Margin", `<p><b>Required margin = position size ÷ leverage.</b> It is locked from your CFD wallet while the trade is open and returned (plus or minus PnL) when you close.</p><p><b>Free margin</b> is what stays available for new trades after the margin of the order is taken.</p>`],
  spread: d => ["Spread", `<p>The <b>spread</b> is the gap between the Sell price (Bid) and the Buy price (Ask). It is the only cost of a trade here.</p><p>${d.sym}: <b>${spTxt(d, d.sp)}</b> vs ${typTxt(d)} at typical brokers: <b>80% tighter</b>.</p>${SV.spread}`],
  stop: () => ["Stop-out", `<p><b>Margin level = equity ÷ used margin.</b> If it falls to <b>${STOP_OUT}%</b>, the position with the biggest loss is closed automatically to protect your balance. This repeats until the level is back above ${STOP_OUT}%.</p><p>Use a stop loss and a lower leverage to stay far away from it.</p>`],
  pip: d => [d.cat === "forex" ? "Pip value" : "Point value", `<p>${d.cat === "forex" ? "A <b>pip</b>" : "A <b>point</b>"} is ${trim(d.pt)} in the ${d.sym} price. The value shows what 1 ${d.cat === "forex" ? "pip" : "point"} of price move is worth for your lot size, in USDT.</p>`]
};
function how(){
  tipFn("How CFD Trade works", `
  <p><b>1. What is a CFD?</b> A Contract for Difference lets you trade the price move of gold, forex, an index or a coin without owning it. Price up and you bought: profit. Price down and you sold: profit.</p>${SV.cfd}
  <p><b>2. Lots.</b> 1 lot is a fixed amount: forex 100,000 units, gold 100 oz, silver 5,000 oz, oil 1,000 bbl, indices 1 × index, crypto 1 coin. Start small, from 0.01 lot.</p>${SV.lot}
  <p><b>3. Leverage and margin.</b> Margin = position size ÷ leverage. It is locked while the trade is open and returned when you close.</p>${SV.lev}
  <p><b>4. The spread, your only cost.</b> You Buy at the Ask and Sell at the Bid. Our spread is 80% tighter than typical brokers, so you start every trade closer to break-even.</p>${SV.spread}
  <p><b>5. No fee, no commission, no swap.</b> Nothing is charged to open, hold overnight or close.</p>${SV.fee}
  <p><b>6. 1 USD = 1 USDT.</b> Your balance is in USDT and prices are in USD, so every USD of profit or loss is exactly 1 USDT.</p>
  <p><b>Example: XAUUSD</b><br>Bid 2,400.00 / Ask 2,400.06. The spread is $0.06 (typical brokers ~$0.30).</p>
  <p>&bull; Buy <b>0.10 lot = 10 oz</b> at 2,400.06<br>&bull; Spread cost: 10 × 0.06 = <b>0.60 USDT</b> (vs $3.00 elsewhere)<br>&bull; Leverage 1:100: margin = 24,000.60 ÷ 100 = <b>240.01 USDT</b><br>&bull; Bid rises to 2,410.00: PnL = (2,410.00 − 2,400.06) × 10 = <b style="color:var(--up)">+99.40 USDT</b></p>
  <p><b>Closing and risk.</b> Longs close at the Bid, shorts at the Ask. Set a Take Profit and Stop Loss if you wish. If equity falls to ${STOP_OUT}% of used margin, the worst position is closed (stop-out).</p>`);
}

/* ---------- page ---------- */
const STRIP = `<div class="tabs pd-strip" style="gap:20px;margin:0 -16px;padding:4px 16px 0;border:0"><a class="tab" href="#/futures/BTCUSDT" style="font-size:17px">USDⓈ-M</a></div>`;
const qI = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.3-2.8 4"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/></svg>`;
const hq = k => `<button type="button" class="cf-q" data-h="${k}" aria-label="Help">${qI}</button>`;
function icon(sym, z = 30){
  const d = SP[sym];
  try {
    if (d.cat === "crypto") return UI.coinImg(d.unit, z);
    let p = null; for (const s of d.src){ p = M.get(s); if (p && p.type !== "crypto" && p.type !== "stock") break; p = null; }
    if (d.cat === "indices" && !p) p = M.get(d.src[0]);
    if (p && d.cat !== "commodities") return UI.pairIcon(p, z);
    if (p && (p.type === "metal" || p.type === "commodity")) return UI.pairIcon(p, z);
    return UI.letter(d.sym.slice(0, 3), z);
  } catch { return ""; }
}
const CHART_TF = [["1m", "1m"], ["5m", "5m"], ["15m", "15m"], ["1h", "1h"], ["4h", "4h"], ["1d", "1D"]];

function pageFactory(params){
  const want = norm((params || [])[0]);
  let last = null; try { last = sessionStorage.getItem("cfd_sym"); } catch {}
  const st = {sym: want || norm(last) || "XAUUSD", cat: null, lots: null, lev: null, tab: "pos", tf: "5m", tp: "", sl: ""};
  st.cat = SP[st.sym].cat; st.lots = LOT_DEF[st.cat]; st.lev = LEV_DEF[st.cat];
  let root = null, offs = [], raf = 0, chartOn = false, chartSym = null, posSig = "", histSig = "", dead = false, retry = 0;
  const q$ = s => root && root.querySelector(s);

  const html = `<div class="cf-root">${STRIP}
    <section class="cf-card cf-hd">
      <div class="cf-hd-t"><h1>CFD Trade</h1><button type="button" class="ac-pill ${window.ACCT && ACCT.isReal() ? "real" : "demo"}" data-acct aria-label="Switch account">${window.ACCT ? ACCT.label() : "Demo"}${ic("chevd", 12, 2.4)}</button><button type="button" class="cf-how" data-how>${ic("info", 15, 2)}<span>How it works</span></button></div>
      <div class="cf-hd-b"><div class="cf-bal"><span class="cf-k">CFD wallet</span><b class="num"><span data-bal>0.00</span> <small>USDT</small></b></div><button type="button" class="cf-xf" data-xf aria-label="Transfer to CFD wallet">${ic("plus", 16, 2.4)}<span>Transfer</span></button></div>
    </section>
    <nav class="cf-cats" role="tablist" aria-label="Markets">${CATS.map(([k, l]) => `<button type="button" role="tab" data-cat="${k}">${l}</button>`).join("")}</nav>
    <section class="cf-card cf-list" id="cfList" aria-label="Markets"></section>
    <section class="cf-card cf-chart">
      <div class="cf-qh" id="cfQh"></div>
      <div class="cf-tfs" id="cfTfs">${CHART_TF.map(([k, l]) => `<button type="button" data-tf="${k}">${l}</button>`).join("")}</div>
      <div class="cf-cw chart-wrap"><div id="chart"></div><div class="legend" id="lg"></div><div class="chart-msg" id="cmsg"></div></div>
    </section>
    <section class="cf-card cf-order" id="cfOrder">
      <div class="cf-note"><span class="cf-note-i">${ic("check", 16, 2.6)}</span><div><b>No fees · No commission · No swap</b><span>You only pay the spread.</span><small>1 USD = 1 USDT: balance in USDT, prices in USD. <button type="button" class="cf-lnk" data-how>How it works</button></small></div></div>
      <div class="cf-fld"><div class="cf-lb"><span>Lot size ${hq("lot")}</span><em data-lotinfo></em></div>
        <div class="cf-stp"><button type="button" data-lm aria-label="Decrease lot size"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button><input id="cfLot" type="text" inputmode="decimal" autocomplete="off" aria-label="Lot size" placeholder="0.10"><button type="button" data-lp aria-label="Increase lot size"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>
        <div class="cf-chips" id="cfLots">${[.01, .1, .5, 1, 5].map(v => `<button type="button" data-lot="${v}">${v}</button>`).join("")}</div></div>
      <div class="cf-fld"><div class="cf-lb"><span>Leverage ${hq("lev")}</span><em data-levinfo></em></div><div class="cf-chips cf-lev" id="cfLev"></div></div>
      <div class="cf-fld"><div class="cf-lb"><span>Take profit / Stop loss</span><em>Optional</em></div>
        <div class="cf-tpsl"><label class="cf-in"><span>TP</span><input id="cfTp" type="text" inputmode="decimal" autocomplete="off" placeholder="Price" aria-label="Take profit price"></label><label class="cf-in"><span>SL</span><input id="cfSl" type="text" inputmode="decimal" autocomplete="off" placeholder="Price" aria-label="Stop loss price"></label></div></div>
      <div class="cf-sum">
        <div><span>Position size</span><b class="num" data-s="size">--</b></div>
        <div><span>Required margin ${hq("margin")}</span><b class="num" data-s="margin">--</b></div>
        <div><span>Spread cost ${hq("spread")}</span><b class="num" data-s="scost">--</b></div>
        <div><span data-s="pipl">Pip value ${hq("pip")}</span><b class="num" data-s="pip">--</b></div>
        <div><span>Free margin after trade</span><b class="num" data-s="free">--</b></div>
        <div><span>Fee · Commission · Swap</span><b class="num up">0.00 USDT</b></div>
      </div>
      <div class="cf-btns"><button type="button" class="cf-go sell" data-side="sell"><small>Sell · Bid</small><b class="num" data-px="bid">--</b></button><button type="button" class="cf-go buy" data-side="buy"><small>Buy · Ask</small><b class="num" data-px="ask">--</b></button></div>
      <p class="cf-fine">Market orders fill instantly at Bid (Sell) or Ask (Buy). No confirmation step.</p>
    </section>
    <section class="cf-card cf-acc">
      <div class="cf-eq" id="cfEq"></div>
      <div class="cf-tabs" role="tablist"><button type="button" data-tab="pos"></button><button type="button" data-tab="ord"></button><button type="button" data-tab="his"></button></div>
      <div id="cfBody"></div>
    </section></div>`;

  /* ----- rendering ----- */
  const lotVal = () => { const v = r2(+((q$("#cfLot") || {}).value || 0)); return v >= .01 && v <= 100 ? v : 0; };
  function flash(el, v){
    if (!el) return; const t = String(v); if (el.textContent === t) return;
    const old = +el.dataset.v, nv = parseFloat(String(v).replace(/,/g, ""));
    el.textContent = t; el.dataset.v = nv;
    if (isFinite(old) && isFinite(nv) && old !== nv){ el.classList.remove("cf-fu", "cf-fd"); void el.offsetWidth; el.classList.add(nv > old ? "cf-fu" : "cf-fd"); }
  }
  function listHTML(){
    return `<div class="cf-lh"><span>Market</span><span>Sell (Bid)</span><span>Buy (Ask)</span></div>` + ORDER[st.cat].map(s => { const d = SP[s];
      return `<button type="button" class="cf-row ${s === st.sym ? "on" : ""}" data-sym="${s}" aria-pressed="${s === st.sym}"><span class="cf-ic">${icon(s, 30)}</span><span class="cf-nm"><b>${s}</b><small><i class="cf-sp">Spread ${spTxt(d, d.sp)}</i></small></span><span class="cf-p dn"><span data-lb="${s}">--</span></span><span class="cf-p up"><span data-la="${s}">--</span></span></button>`; }).join("");
  }
  function qhHTML(){
    const d = SP[st.sym];
    return `<div class="cf-qt"><span class="cf-ic">${icon(st.sym, 34)}</span><div class="cf-qn"><b>${d.sym}</b><small>${esc(d.name)}</small></div><div class="cf-qs"><span class="cf-st" data-mst>--</span><span class="cf-chg" data-chg></span></div></div>
    <div class="cf-qp"><div class="cf-pb sell"><small>Sell</small><b class="num" data-qb>--</b></div><div class="cf-spr"><span>Spread ${hq("spread")}</span><b class="num">${spTxt(d, d.sp)}</b></div><div class="cf-pb buy"><small>Buy</small><b class="num" data-qa>--</b></div></div>
    <div class="cf-tag"><span class="cf-80">${ic("check", 11, 3)}80% tighter than typical brokers</span><small>Typical ${typTxt(d)}</small></div>`;
  }
  function levHTML(){ return LEV[st.cat].map(v => `<button type="button" data-lev="${v}">1:${v}</button>`).join(""); }
  function setLevInfo(){ const e = q$("[data-levinfo]"); if (e) e.textContent = "Max 1:" + Math.max(...LEV[st.cat]); }

  function updList(){
    ORDER[st.cat].forEach(s => { const q = quote(s), d = SP[s], b = q$(`[data-lb="${s}"]`), a = q$(`[data-la="${s}"]`);
      if (b) flash(b, q ? px(q.bid, d.dp) : "--"); if (a) flash(a, q ? px(q.ask, d.dp) : "--");
      const row = b && b.closest(".cf-row"); if (row) row.classList.toggle("off", !q || !q.live); });
  }
  function updQuote(){
    const d = SP[st.sym], q = quote(st.sym);
    flash(q$("[data-qb]"), q ? px(q.bid, d.dp) : "--"); flash(q$("[data-qa]"), q ? px(q.ask, d.dp) : "--");
    const s = q$("[data-mst]"); if (s){ const t = !q ? "No price" : q.live ? "Live" : q.closed ? "Market closed" : "Waiting for price"; s.textContent = t; s.className = "cf-st " + (q && q.live ? "on" : "off"); }
    const c = q$("[data-chg]"); if (c){ const v = q && q.chg; c.textContent = v == null || isNaN(v) ? "" : (v > 0 ? "+" : "") + fmt(v, 2) + "%"; c.className = "cf-chg " + cls(v || 0); }
    flash(q$('[data-px="bid"]'), q ? px(q.bid, d.dp) : "--"); flash(q$('[data-px="ask"]'), q ? px(q.ask, d.dp) : "--");
    root.querySelectorAll(".cf-go").forEach(b => b.classList.toggle("off", !q || !q.live));
  }
  function updSum(){
    const d = SP[st.sym], q = quote(st.sym), lots = lotVal(), a = acct(), set = (k, v, c) => { const e = q$(`[data-s="${k}"]`); if (e){ e.textContent = v; e.className = "num" + (c ? " " + c : ""); } };
    const li = q$("[data-lotinfo]"); if (li) li.textContent = lots ? "= " + unitsTxt(d, lots) : "0.01 to 100 lots";
    const pl = q$('[data-s="pipl"]'); if (pl && pl.dataset.k !== d.cat){ pl.dataset.k = d.cat; pl.innerHTML = (d.cat === "forex" ? "Pip value " : "Point value ") + hq("pip"); }
    if (!q || !lots){ ["size", "margin", "scost", "pip", "free"].forEach(k => set(k, "--")); return; }
    const mid = q.ask, margin = r2(notionalOf(d, lots, mid) / st.lev), free = a.free - margin, sc = spreadCost(d, lots, mid), tc = typCost(d, lots, mid);
    set("size", `${unitsTxt(d, lots)} · ${fmt(notionalOf(d, lots, mid), 2)} USDT`);
    set("margin", fmt(margin, 2) + " USDT"); set("scost", `${fmt(sc, sc < .1 ? 4 : 2)} USDT (typical ${fmt(tc, tc < .1 ? 4 : 2)})`, "up");
    set("pip", `1 ${d.cat === "forex" ? "pip" : "point"} = ${fmt(pipVal(d, lots, mid), 2)} USDT`);
    set("free", fmt(free, 2) + " USDT", margin > bal() + 1e-9 || free < -1e-9 ? "dn" : "");
  }
  function updEq(){
    const a = acct(), e = q$("#cfEq"); if (!e) return;
    const lv = a.level == null ? "--" : (a.level >= 1e5 ? ">100,000" : fmt(a.level, 0)) + "%";
    const risk = a.level != null && a.level < 100 ? "dn" : "";
    const set = (k, v, c) => { const x = e.querySelector(`[data-e="${k}"]`); if (x){ x.textContent = v; x.className = "num" + (c ? " " + c : ""); } };
    if (!e.firstChild){
      e.innerHTML = `<div><span>Equity</span><b class="num" data-e="eq"></b></div><div><span>Used margin ${hq("margin")}</span><b class="num" data-e="used"></b></div><div><span>Free margin</span><b class="num" data-e="free"></b></div><div><span>Margin level ${hq("stop")}</span><b class="num" data-e="lv"></b></div>`;
    }
    set("eq", fmt(a.eq, 2)); set("used", fmt(a.used, 2)); set("free", fmt(a.free, 2), a.free < 0 ? "dn" : ""); set("lv", lv, risk);
    const bl = q$("[data-bal]"); if (bl) bl.textContent = fmt(a.bal, 2);
  }
  function posHTML(p){
    const d = SP[p.sym], buy = p.side === "buy";
    return `<article class="cf-pos" data-pid="${p.id}"><header><span class="cf-ic">${icon(p.sym, 26)}</span><div class="cf-pn"><b>${p.sym}</b><small><i class="cf-sd ${buy ? "buy" : "sell"}">${buy ? "BUY" : "SELL"}</i> ${fmt(p.lots, 2)} lot · 1:${p.lev}</small></div><div class="cf-pl"><b class="num" data-f="pnl">--</b><small class="num" data-f="roi">--</small></div></header>
      <div class="cf-g"><div><span>Entry</span><b class="num">${px(p.entry, d.dp)}</b></div><div><span>Price</span><b class="num" data-f="now">--</b></div><div><span>Margin</span><b class="num">${fmt(p.margin, 2)}</b></div>
      <div><span>Take profit</span><b class="num">${p.tp ? px(p.tp, d.dp) : "--"}</b></div><div><span>Stop loss</span><b class="num">${p.sl ? px(p.sl, d.dp) : "--"}</b></div><div><span>Size</span><b class="num">${unitsTxt(d, p.lots)}</b></div></div>
      <footer><button type="button" class="cf-b2" data-edit>Modify TP/SL</button><button type="button" class="cf-b2 cl" data-close>Close</button></footer></article>`;
  }
  function hisHTML(h){
    const d = SP[h.sym] || {dp: 2}, buy = h.side === "buy";
    return `<article class="cf-pos cf-h"><header><div class="cf-pn"><b>${h.sym}</b><small><i class="cf-sd ${buy ? "buy" : "sell"}">${buy ? "BUY" : "SELL"}</i> ${fmt(h.lots, 2)} lot · 1:${h.lev} · ${REASON[h.reason] || "Closed"}</small></div><div class="cf-pl"><b class="num ${cls(h.pnl)}">${sg(h.pnl)} USDT</b><small class="num ${cls(h.pnl)}">${sg(h.roi)}%</small></div></header>
      <div class="cf-g"><div><span>Entry</span><b class="num">${px(h.entry, d.dp)}</b></div><div><span>Close</span><b class="num">${px(h.close, d.dp)}</b></div><div><span>Margin</span><b class="num">${fmt(h.margin, 2)}</b></div></div>
      <div class="cf-tm">${U.dateStr(h.tc)}</div></article>`;
  }
  function renderBody(force){
    const body = q$("#cfBody"); if (!body) return;
    const P = D().positions, Hs = D().history;
    const tabs = root.querySelectorAll("[data-tab]");
    tabs[0].textContent = `Positions (${P.length})`; tabs[1].textContent = "Orders (0)"; tabs[2].textContent = "History";
    tabs.forEach(b => { b.classList.toggle("on", b.dataset.tab === st.tab); b.setAttribute("aria-selected", b.dataset.tab === st.tab); });
    const sig = st.tab + "|" + (st.tab === "pos" ? P.map(p => p.id + ":" + p.tp + ":" + p.sl).join(",") : st.tab === "his" ? Hs.length + ":" + (Hs[0] ? Hs[0].id : "") : "");
    if (!force && sig === posSig) return; posSig = sig;
    if (st.tab === "pos") body.innerHTML = P.length ? P.slice().reverse().map(posHTML).join("") : empty("No open positions", "Tap Buy or Sell above. Your trade opens instantly.");
    else if (st.tab === "his") body.innerHTML = Hs.length ? Hs.slice(0, 60).map(hisHTML).join("") : empty("No closed trades yet", "Closed trades show their close price, PnL and ROI here.");
    else body.innerHTML = empty("No pending orders", "CFD Trade uses market orders only: Buy at the Ask, Sell at the Bid, filled instantly.");
    updPos();
  }
  const empty = (t, s) => `<div class="cf-empty"><div class="cf-empty-i">${ic("candle", 22, 1.6)}</div><b>${t}</b><span>${s}</span></div>`;
  function updPos(){
    if (st.tab !== "pos") return;
    D().positions.forEach(p => { const art = q$(`[data-pid="${p.id}"]`); if (!art) return; const q = quote(p.sym), d = SP[p.sym];
      const pn = art.querySelector('[data-f="pnl"]'), ro = art.querySelector('[data-f="roi"]'), nw = art.querySelector('[data-f="now"]');
      if (!q){ return; }
      const at = closePx(p, q), v = pnlAt(p, at), roi = p.margin > 0 ? v / p.margin * 100 : 0;
      pn.textContent = sg(v) + " USDT"; pn.className = "num " + cls(v); ro.textContent = sg(roi) + "% ROI"; ro.className = "num " + cls(v);
      flash(nw, px(at, d.dp)); art.classList.toggle("off", !q.live); });
  }
  function syncLines(){
    if (!chartOn || !window.CH || !CH.setExtra) return;
    try { CH.setExtra(D().positions.filter(p => p.sym === st.sym).map(p => ({id: p.id, price: p.entry, color: p.side === "buy" ? "#2EBD85" : "#F6465D", text: "#fff", title: (p.side === "buy" ? "Buy " : "Sell ") + fmt(p.lots, 2)}))); } catch {}
  }
  function ensureChart(){
    if (dead || !root || !window.CH) return;
    const f = feed(st.sym), ms = (SP[st.sym].src.find(s => M.get(s)) || (f && f.ms));
    const msg = q$("#cmsg");
    if (!ms || !M.get(ms)){ if (msg) msg.innerHTML = `<span>Chart loading…</span>`; return; }
    try {
      if (!chartOn){ CH.mount(q$("#chart"), {legend: q$("#lg"), msg, mode: "none", noInd: true}); chartOn = true; chartSym = null; }
      const want = (f && f.p && f.ms) || ms;
      if (chartSym !== want + "|" + st.tf){ chartSym = want + "|" + st.tf; CH.load(want, st.tf); }
      syncLines(); setTimeout(() => { try { CH.resize && CH.resize(); } catch {} }, 80);
    } catch (e) { console.warn("cfd chart", e); }
  }
  function tick(){ raf = 0; if (dead || !root) return; updList(); updQuote(); updSum(); updEq(); renderBody(false); updPos(); }
  const sched = () => { if (!raf && !dead) raf = requestAnimationFrame(tick); };

  /* ----- actions ----- */
  function setSym(sym, scroll){
    if (!SP[sym]) return;
    const prevCat = st.cat; st.sym = sym; st.cat = SP[sym].cat;
    try { sessionStorage.setItem("cfd_sym", sym); } catch {}
    if (st.cat !== prevCat){ st.lots = LOT_DEF[st.cat]; if (!LEV[st.cat].includes(st.lev)) st.lev = LEV_DEF[st.cat]; q$("#cfLot").value = String(st.lots); q$("#cfLev").innerHTML = levHTML(); setLevInfo(); }
    q$("#cfList").innerHTML = listHTML(); q$("#cfQh").innerHTML = qhHTML();
    q$("#cfTp").value = ""; q$("#cfSl").value = "";
    root.querySelectorAll("[data-cat]").forEach(b => { b.classList.toggle("on", b.dataset.cat === st.cat); b.setAttribute("aria-selected", b.dataset.cat === st.cat); });
    markChips(); updList(); updQuote(); updSum(); chartSym = null; ensureChart(); syncLines();
    try { if (location.hash !== "#/cfd/" + sym && /^#\/cfd/.test(location.hash)) history.replaceState(history.state, "", "#/cfd/" + sym); } catch {}
  }
  function markChips(){
    const lots = lotVal();
    root.querySelectorAll("[data-lot]").forEach(b => b.classList.toggle("on", +b.dataset.lot === lots));
    root.querySelectorAll("[data-lev]").forEach(b => b.classList.toggle("on", +b.dataset.lev === st.lev));
  }
  function setLots(v, writeBack){
    v = Math.min(100, Math.max(.01, r2(v))); st.lots = v; q$("#cfLot").value = String(v); markChips(); updSum();
  }
  const stepUp = v => v < .1 - 1e-9 ? .01 : v < 1 - 1e-9 ? .1 : v < 10 - 1e-9 ? 1 : 10;
  const stepDn = v => v <= .1 + 1e-9 ? .01 : v <= 1 + 1e-9 ? .1 : v <= 10 + 1e-9 ? 1 : 10;
  function trade(side){
    const lots = lotVal(); if (!lots){ toast("Lot size: Enter 0.01 to 100 lots", "bad"); return; }
    const tp = +q$("#cfTp").value || 0, sl = +q$("#cfSl").value || 0;
    const r = openPos(st.sym, side, lots, st.lev, tp, sl);
    if (r.err){ toast(r.err, "bad"); if (r.short) setTimeout(() => { try { UI.transferSheet({to: W, amount: r.short}); } catch {} }, 400); return; }
    const d = SP[st.sym]; buzz("open");
    toast(`${side === "buy" ? "Buy" : "Sell"} ${fmt(lots, 2)} ${st.sym}: filled at ${px(r.pos.entry, d.dp)}`, "ok");
    q$("#cfTp").value = ""; q$("#cfSl").value = ""; st.tab = "pos"; renderBody(true); syncLines(); updSum(); updEq();
  }
  function doClose(id){
    const r = closePos(id, "manual");
    if (r && r.err){ toast(r.err, "bad"); return; }
    if (!r || !r.h) return; buzz("close");
    toast(`Closed ${r.h.sym}: ${sg(r.h.pnl)} USDT (${sg(r.h.roi)}%)`, r.h.pnl >= 0 ? "ok" : "bad");
    renderBody(true); syncLines(); updEq(); updSum();
  }
  function editTpSl(id){
    const p = D().positions.find(x => x.id === id); if (!p) return; const d = SP[p.sym];
    U.sheet("Modify TP / SL", `<div class="cf-sh"><div class="cf-sh-h"><span class="cf-ic">${icon(p.sym, 28)}</span><div><b>${p.sym} · ${p.side === "buy" ? "Buy" : "Sell"} ${fmt(p.lots, 2)} lot</b><small>Entry ${px(p.entry, d.dp)} · now <span data-n>--</span></small></div></div>
      <label class="cf-in lg"><span>Take profit</span><input id="mtp" type="text" inputmode="decimal" autocomplete="off" placeholder="Not set"></label>
      <label class="cf-in lg"><span>Stop loss</span><input id="msl" type="text" inputmode="decimal" autocomplete="off" placeholder="Not set"></label>
      <p class="cf-fine">Leave a field empty to remove it. ${p.side === "buy" ? "Take profit must be above and stop loss below the current Sell price." : "Take profit must be below and stop loss above the current Buy price."}</p>
      <div class="cf-err" id="merr" role="alert"></div><button type="button" class="cf-save" id="msave">Save</button></div>`, el => {
      const tp = ni(el.querySelector("#mtp"), d.dp), sl = ni(el.querySelector("#msl"), d.dp), err = el.querySelector("#merr");
      if (p.tp) tp.value = String(p.tp); if (p.sl) sl.value = String(p.sl);
      const n = el.querySelector("[data-n]"), q0 = quote(p.sym); if (q0) n.textContent = px(p.side === "buy" ? q0.bid : q0.ask, d.dp);
      el.querySelector("#msave").onclick = () => {
        const r = modifyPos(id, tp.value, sl.value);
        if (r.err){ err.textContent = r.err; return; }
        buzz(10); U.closeLayer(); toast("TP/SL updated: " + p.sym, "ok"); renderBody(true); check();
      };
    });
  }

  function mount(view){
    root = (view || document).querySelector(".cf-root"); dead = false; if (!root) return;
    const lot = ni(q$("#cfLot"), 2); ni(q$("#cfTp"), SP[st.sym].dp); ni(q$("#cfSl"), SP[st.sym].dp);
    lot.value = String(st.lots); q$("#cfLev").innerHTML = levHTML(); setLevInfo();
    root.querySelectorAll("[data-acct]").forEach(b => b.onclick = e => { e.stopPropagation(); if (window.ACCT) ACCT.sheet(); });
    root.addEventListener("click", e => {
      const t = e.target; let b;
      if ((b = t.closest("[data-how]"))){ buzz(6); return how(); }
      if ((b = t.closest("[data-xf]"))){ buzz(10); return UI.transferSheet({to: W}); }
      if ((b = t.closest(".cf-q"))){ const k = b.dataset.h, f = H[k]; if (f){ buzz(6); const r = f(SP[st.sym]); tipFn(r[0], r[1]); } return; }
      if ((b = t.closest("[data-cat]"))){ buzz(6); if (SP[st.sym].cat !== b.dataset.cat) setSym(ORDER[b.dataset.cat][0]); return; }
      if ((b = t.closest("[data-sym]"))){ buzz(6); if (b.dataset.sym !== st.sym) setSym(b.dataset.sym); return; }
      if ((b = t.closest("[data-tf]"))){ st.tf = b.dataset.tf; root.querySelectorAll("[data-tf]").forEach(x => x.classList.toggle("on", x === b)); chartSym = null; ensureChart(); return; }
      if ((b = t.closest("[data-lot]"))){ buzz(6); return setLots(+b.dataset.lot); }
      if ((b = t.closest("[data-lev]"))){ buzz(6); st.lev = +b.dataset.lev; markChips(); return updSum(); }
      if ((b = t.closest("[data-lm]"))){ buzz(6); const v = lotVal() || st.lots; return setLots(v - stepDn(v)); }
      if ((b = t.closest("[data-lp]"))){ buzz(6); const v = lotVal() || st.lots; return setLots(v + stepUp(v)); }
      if ((b = t.closest("[data-side]"))) return trade(b.dataset.side);
      if ((b = t.closest("[data-tab]"))){ st.tab = b.dataset.tab; buzz(6); return renderBody(true); }
      if ((b = t.closest("[data-edit]"))){ buzz(6); return editTpSl(b.closest("[data-pid]").dataset.pid); }
      if ((b = t.closest("[data-close]"))) return doClose(b.closest("[data-pid]").dataset.pid);
    });
    lot.addEventListener("input", () => { const v = lotVal(); if (v) st.lots = v; markChips(); updSum(); });
    lot.addEventListener("blur", () => { const v = +lot.value; setLots(v >= .01 ? v : st.lots); });
    offs.push(bus.on("tick", s => { if (REV[s]) sched(); }));
    offs.push(bus.on("cfd", () => { renderBody(false); syncLines(); sched(); }));
    offs.push(bus.on("balance", sched));
    offs.push(bus.on("list", () => { if (!chartOn) ensureChart(); }));
    offs.push(bus.on("theme", () => { chartSym = null; }));
    setSym(st.sym); root.querySelectorAll("[data-tf]").forEach(x => x.classList.toggle("on", x.dataset.tf === st.tf));
    renderBody(true); updEq();
    const iv = setInterval(() => { sched(); if (!chartOn && ++retry < 30) ensureChart(); }, 1500); offs.push(() => clearInterval(iv));
  }
  function unmount(){
    dead = true; if (raf) cancelAnimationFrame(raf); raf = 0;
    offs.forEach(f => { try { f(); } catch {} }); offs = [];
    if (chartOn && window.CH){ try { CH.setExtra && CH.setExtra([]); CH.destroy(); } catch {} } chartOn = false; root = null;
  }
  return {html, title: "CFD Trade", mount, unmount};
}

if (window.Pages) Pages.cfd = pageFactory;
/* ---- public API (works without the page mounted: reads U.store.s.cfd + live M prices) ---- */
function modifyPos(id, tp, sl){
  const p = D().positions.find(x => x.id === id); if (!p) return {err: "Position not found"};
  const q = quote(p.sym); if (!q) return {err: "No price yet"};
  tp = +tp || 0; sl = +sl || 0; const buy = p.side === "buy";
  if (tp && (buy ? tp <= q.bid : tp >= q.ask)) return {err: "Take profit must be " + (buy ? "above" : "below") + " the current price."};
  if (sl && (buy ? sl >= q.bid : sl <= q.ask)) return {err: "Stop loss must be " + (buy ? "below" : "above") + " the current price."};
  p.tp = tp; p.sl = sl; store.save(); emit(); return {ok: true};
}
window.CFD = {
  open(sym){ const s = norm(sym) || "XAUUSD"; try { sessionStorage.setItem("cfd_sym", s); } catch {} location.hash = "#/cfd/" + s; },
  data(){ const a = acct(); return {balance: a.bal, equity: a.eq, usedMargin: a.used, freeMargin: a.free, upnl: a.fl}; },
  positions(){
    return D().positions.map(p => { const q = quote(p.sym), at = q ? closePx(p, q) : p.entry, v = q ? pnlAt(p, at) : 0;
      return {id: p.id, sym: p.sym, side: p.side, lots: p.lots, entry: p.entry, price: at, pnl: v, roi: p.margin > 0 ? v / p.margin * 100 : 0, margin: p.margin, tp: p.tp, sl: p.sl, time: p.t}; });
  },
  history(){ return D().history.map(h => ({id: h.id, sym: h.sym, side: h.side, lots: h.lots, entry: h.entry, exit: h.close, pnl: h.pnl, roi: h.roi, closed: h.tc})); },
  close(id){
    const r = closePos(id, "manual");
    if (r && r.err){ toast(r.err, "bad"); return null; }
    if (!r || !r.h) return null; buzz("close");
    toast(`Closed ${r.h.sym}: ${sg(r.h.pnl)} USDT (${sg(r.h.roi)}%)`, r.h.pnl >= 0 ? "ok" : "bad");
    return {id: r.h.id, sym: r.h.sym, side: r.h.side, lots: r.h.lots, entry: r.h.entry, exit: r.h.close, pnl: r.h.pnl, roi: r.h.roi, closed: r.h.tc};
  },
  modify(id, o){ o = o || {}; const p = D().positions.find(x => x.id === id); if (!p) return false;
    const r = modifyPos(id, "tp" in o ? o.tp : p.tp, "sl" in o ? o.sl : p.sl); if (r.err){ toast(r.err, "bad"); return false; } check(); return true; },
  quote, account: acct, symbols: SP, check
};
})();
