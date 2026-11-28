/* ===== Trading engine: binary options, bots, auto trading ===== */
(function(){
const C = window.CONFIG, {store, bus, toast, fmt, money, signed, uid} = U;
const S = () => store.s;
const RATIO = 1 + C.PAYOUT;
/* Per-pair, per-expiry payout like real binary brokers: 80%–95%. Majors pay more, longer expiries pay slightly more. */
function payoutOf(sym, expiry=30){
  const p = M.get(sym); if (!p) return C.PAYOUT;
  let h = 0; for (const c of sym) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const base = ["BTCUSDT","ETHUSDT","XAUUSD","EURUSD"].includes(sym) ? 0.92 : p.type === "crypto" && (p.rank || 99) <= 10 ? 0.90 : p.type === "forex" || p.type === "metal" ? 0.88 : 0.82 + (h % 7) / 100;
  return Math.min(0.95, Math.max(0.80, Math.round(base * 100) / 100));   // same payout for every period
}

function validate(sym, amount){
  const p = M.get(sym);
  if (!p) return "Unknown pair.";
  if (!p.tradable) return "Binary options are not available for this pair. Switch to Futures or pick a popular crypto, forex or metal pair.";
  if (p.closed) return "Market closed for " + M.label(p) + ". Trading resumes when the market opens.";
  if (M.isStale(p)) return "Market data offline. Reconnecting… please try again in a moment.";
  if (!(amount > 0) || isNaN(amount)) return "Enter a valid amount.";
  if (amount < 0.1) return "Minimum trade amount is 0.1 USDT.";
  if (amount > 5000) return "Maximum trade amount is 5,000 USDT.";
  if (amount > store.wb("binary") + 1e-9) return "Insufficient Binary balance";
  if (S().positions.length >= C.MAX_OPEN) return `Maximum ${C.MAX_OPEN} open positions reached.`;
  return null;
}

/* Expiry = entry time + the selected duration, exactly (a "1 min" trade lasts 60 s even if the 1-minute candle closes sooner) */
function alignedExpiry(expiry, now=Date.now()){ return now + expiry * 1000; }
function place(sym, dir, amount, expiry, source="manual", meta=null){
  amount = Math.round(amount * 100) / 100;
  const err = validate(sym, amount);
  if (err) return {err};
  const p = M.get(sym), now = Date.now();
  const pos = {id:uid(), sym, dir, amount, entry:p.price, open:now, exp:alignedExpiry(expiry, now), expiry, payout:payoutOf(sym, expiry), source};
  if (meta) Object.assign(pos, meta);
  S().positions.push(pos);
  store.addWallet("binary", -amount, "trade");
  bus.emit("positions"); bus.emit("placed", pos);
  if (!S().rewards.used.first){ S().rewards.used.first = now; bus.emit("rewards"); }
  return {pos};
}

function livePnl(pos){
  const p = M.get(pos.sym); if (!p?.price) return {win:null, pnl:0};
  const diff = p.price - pos.entry;
  const win = pos.dir === "up" ? diff > 0 : diff < 0;
  if (diff === 0) return {win:null, pnl:0};
  return {win, pnl: win ? pos.amount * pos.payout : -pos.amount};
}

function settle(pos){
  const p = M.get(pos.sym);
  let exit = p?.price;
  const now = Date.now();
  if ((exit == null || M.isStale(p)) && now - pos.exp < 10000) return false; // wait briefly for fresh data
  let result, credit = 0;
  if (exit == null){ result = "refund"; credit = pos.amount; exit = pos.entry; }
  else {
    const diff = exit - pos.entry;
    if (diff === 0){ result = "draw"; credit = pos.amount; }
    else if ((pos.dir === "up") === (diff > 0)){ result = "win"; credit = Math.round(pos.amount * (1 + (pos.payout ?? C.PAYOUT)) * 100) / 100; }
    else result = "loss";
  }
  const profit = Math.round((credit - pos.amount) * 100) / 100;
  S().positions = S().positions.filter(x => x.id !== pos.id);
  const rec = Object.assign({}, pos, {exit, result, profit, credit, closed: now});
  S().history.unshift(rec); S().history = S().history.slice(0, 500);
  store.addWallet("binary", credit, "settle");
  const lbl = M.label(p || {type:"crypto", base:pos.sym});
  store.notify(result === "win" ? "Trade won 🎉" : result === "loss" ? "Trade lost" : "Trade refunded",
    `${lbl} ${pos.dir === "up" ? "Up" : "Down"} ${money(pos.amount)} USDT → ${signed(profit)} USDT`, result === "win" ? "ok" : result === "loss" ? "bad" : "info");
  bus.emit("positions"); bus.emit("history"); bus.emit("settled", rec);
  return true;
}

setInterval(() => {
  const now = Date.now();
  [...S().positions].forEach(pos => { if (now >= pos.exp) settle(pos); });
  fundingTick(now);
  bus.emit("sec");
}, 250);
/* Funding every 8h (00:00 / 08:00 / 16:00 UTC): longs pay shorts at FUND_RATE of notional */
const FUND_MS = 8 * 3600e3, FUND_RATE = 0.0001;
function fundingTick(now){
  const ep = Math.floor(now / FUND_MS); let any = false;
  (S().fut?.positions || []).forEach(pos => {
    if (pos.fEp == null){ pos.fEp = ep; return; }
    if (pos.fEp >= ep) return;
    const px = M.get(pos.sym)?.price || pos.entry, pay = r2(pos.qty * px * FUND_RATE * (pos.side === "long" ? 1 : -1) * (ep - pos.fEp));
    pos.fEp = ep; pos.realized = (pos.realized || 0) - pay;
    pos.rz = pos.rz || {openFee:pos.fee || 0, closeFee:0, closePnl:0, funding:0}; pos.rz.funding -= pay;
    store.addWallet("futures", -pay, "funding"); any = true;
  });
  if (any){ store.save(); bus.emit("positions"); }
}

/* ---- Stats ---- */
function stats(){
  const h = S().history.filter(x => x.result === "win" || x.result === "loss");
  const wins = h.filter(x => x.result === "win");
  const net = S().history.reduce((a, x) => a + (x.profit || 0), 0);
  const vol = S().history.reduce((a, x) => a + x.amount, 0);
  const best = h.reduce((a, x) => Math.max(a, x.profit), 0);
  const startDay = new Date(); startDay.setHours(0,0,0,0);
  const today = S().history.filter(x => x.closed >= startDay.getTime());
  const todayPnl = today.reduce((a, x) => a + (x.profit || 0), 0);
  let streak = 0; for (const x of h){ if (x.result === "win") streak++; else break; }
  return {trades: S().history.length, wins: wins.length, losses: h.length - wins.length, winRate: h.length ? wins.length / h.length * 100 : 0, net, vol, best, todayPnl, today, streak};
}
function todaySeries(){
  const st = stats(); const arr = [0]; let acc = 0;
  [...st.today].reverse().forEach(x => { acc += x.profit || 0; arr.push(acc); });
  if (arr.length < 2) arr.push(0);
  return arr;
}

/* ---- Bots (simulated, driven by real price moves) ---- */
const BOTS = [
  {id:"combo", wallet:"futures", name:"Future Combo Bot", pair:"BTCUSDT", desc:"Long BTC with a hedge — trend-following futures combo.", mult:3, grid:0.00004, risk:"Medium", apy:"38–64%"},
  {id:"grid", wallet:"spot", name:"Spot Grid Bot", pair:"ETHUSDT", desc:"Buys low and sells high inside a price range, 24/7.", mult:1, grid:0.00008, risk:"Low", apy:"12–28%"},
  {id:"dca", wallet:"spot", name:"Smart DCA Bot", pair:"SOLUSDT", desc:"Dollar-cost averages into dips with safety orders.", mult:1.5, grid:0.00003, risk:"Low", apy:"15–35%"},
  {id:"gold", wallet:"futures", name:"Gold Trend Bot", pair:"XAUUSD", desc:"Follows the gold trend on biquote live prices.", mult:5, grid:0.00002, risk:"Medium", apy:"20–45%"},
  {id:"fx", wallet:"futures", name:"Forex Scalper", pair:"EURUSD", desc:"High-frequency EUR/USD scalping on short swings.", mult:20, grid:0.00002, risk:"High", apy:"25–80%"}
];
function botPnl(id){
  const b = S().bots[id]; if (!b?.running) return b?.pnl || 0;
  const def = BOTS.find(x => x.id === id), p = M.get(def.pair);
  if (def.kind === "ugrid") return window.BOTX && BOTX.ugPnl ? BOTX.ugPnl(b) : 0;   // USDC/USDT grid: live grid fills, 0 fee
  const px = p?.price || b.start;
  const move = (px - b.start) / b.start * def.mult * b.invest;
  const mins = (Date.now() - b.since) / 60000;
  const grid = b.invest * def.grid * mins * 60 / 60; // small accrual per minute
  return Math.max(-b.invest * 0.95, move + grid);
}
function startBot(id, invest){
  const def = BOTS.find(x => x.id === id), p = M.get(def.pair);
  if (!(invest >= 10)) return "Minimum investment is 10 USDT.";
  const w = def.wallet || "futures";
  if (invest > store.wb(w) + 1e-9) return "Insufficient " + w[0].toUpperCase() + w.slice(1) + " balance";
  if (!p?.price || M.isStale(p)) return "Market data offline for " + def.pair + ". Try again shortly.";
  if (p.closed) return "Market closed for this pair right now.";
  S().bots[id] = {running:true, w, invest, start:p.price, since:Date.now(), series:[0], pnl:0};
  store.addWallet(w, -invest, "bot");
  store.notify("Bot started", `${def.name} with ${money(invest)} USDT`, "ok"); E.award("bot");
  bus.emit("bots"); return null;
}
function stopBot(id){
  const b = S().bots[id]; if (!b?.running) return;
  const pnl = Math.round(botPnl(id) * 100) / 100;
  b.running = false; b.pnl = pnl; b.stopped = Date.now();
  store.addWallet(b.w || BOTS.find(x => x.id === id)?.wallet || "futures", b.invest + pnl, "bot");
  const def = BOTS.find(x => x.id === id);
  store.notify("Bot stopped", `${def.name}: ${signed(pnl)} USDT returned with your ${money(b.invest)} USDT`, pnl >= 0 ? "ok" : "bad");
  bus.emit("bots");
  return pnl;
}
setInterval(() => {
  let any = false;
  Object.entries(S().bots).forEach(([id, b]) => { if (b.running){ any = true; b.series.push(botPnl(id)); if (b.series.length > 120) b.series.shift(); } });
  if (any){ store.save(); bus.emit("bots"); }
}, 5000);

/* ---- Binary bots (Auto Trade, Binary Martingale, Trend Follower) ----
   One trade at a time per bot: a new trade is only opened after the previous one has closed AND the cooldown ("interval", seconds) has passed. */
const BIN_KINDS = {
  auto: {name:"Auto Trade", strategy:"trend", expiry:30, desc:"Places binary trades for you from momentum signals."},
  bmart: {name:"Binary Martingale", strategy:"reversal", expiry:60, martingale:true, desc:"Counter-trend entries; the stake doubles (up to 3 steps) after a loss to recover it."},
  trend: {name:"Trend Follower", strategy:"trend", expiry:30, desc:"Follows momentum and trades in the direction of the trend."}
};
const binTimers = {};
const binCfg = id => id === "auto" ? S().auto : (S().binBots || {})[id];
const botOpen = id => S().positions.some(x => x.botId === id || (id === "auto" && x.source === "auto" && !x.botId));
function binBots(){ return Object.keys(BIN_KINDS).map(id => ({id, kind:BIN_KINDS[id], cfg:binCfg(id)})).filter(x => x.cfg && (x.cfg.created || x.cfg.on || x.cfg.count > 0)); }
function autoDecide(sym, strat){
  const m = M.momentum(sym, 45000);
  if (strat === "trend") return m >= 0 ? "up" : "down";
  if (strat === "reversal") return m >= 0 ? "down" : "up";
  return Math.random() < 0.5 ? "up" : "down";
}
function autoLog(msg, id="auto"){ const a = binCfg(id); if (!a) return; a.log = a.log || []; a.log.unshift({t:Date.now(), msg}); a.log = a.log.slice(0, 40); store.save(); bus.emit("auto"); }
function autoTick(id="auto"){
  const a = binCfg(id);
  if (!a?.on){ clearInterval(binTimers[id]); delete binTimers[id]; return; }
  if (a.count >= a.max){ stopAuto("Reached max trades (" + a.max + ").", id); return; }
  if (botOpen(id)) return;                                                   // never 2 trades at once
  if (a.lastEnd && Date.now() - a.lastEnd < (a.interval || 10) * 1000) return;  // cooldown after the last trade ended
  const dir = autoDecide(a.pair, a.strategy), name = a.name || BIN_KINDS[id].name;
  const stake = Math.round(a.amount * Math.pow(2, BIN_KINDS[id].martingale ? (a.step || 0) : 0) * 100) / 100;
  const r = place(a.pair, dir, stake, a.expiry, "auto", {botId:id, bot:name, strat:a.strategy});
  if (r.err){
    if (!a.lastSkip || a.lastSkip.msg !== r.err || Date.now() - a.lastSkip.t > 30000){ a.lastSkip = {msg:r.err, t:Date.now()}; autoLog("Skipped: " + r.err, id); }
    if (/Insufficient/.test(r.err)) stopAuto("Insufficient balance.", id); return; }
  a.count++; autoLog(`#${a.count} ${dir.toUpperCase()} ${M.label(M.get(a.pair))} ${money(stake)} USDT @ ${M.fmtPx(M.get(a.pair))}`, id);
}
bus.on("settled", rec => {
  if (!rec.botId) return; const a = binCfg(rec.botId); if (!a) return;
  a.lastEnd = rec.closed || Date.now(); a.pnl = Math.round(((a.pnl || 0) + (rec.profit || 0)) * 100) / 100;
  if (rec.result === "win") a.wins = (a.wins || 0) + 1; else if (rec.result === "loss") a.losses = (a.losses || 0) + 1;
  if (BIN_KINDS[rec.botId]?.martingale) a.step = rec.result === "loss" ? Math.min(3, (a.step || 0) + 1) : 0;
  store.save(); bus.emit("auto");
});
function startAuto(cfg, id="auto"){
  const kind = BIN_KINDS[id] || BIN_KINDS.auto; S().binBots = S().binBots || {};
  const a = id === "auto" ? S().auto : (S().binBots[id] = S().binBots[id] || {log:[]});
  Object.assign(a, {name:kind.name}, cfg, {on:true, count:0, created:true, step:0, lastEnd:0, pnl:0, wins:0, losses:0, started:Date.now(), lastSkip:null});
  autoLog("Bot started — " + a.strategy + " strategy, " + (a.expiry < 60 ? a.expiry + "s" : a.expiry / 60 + "m") + " expiry.", id);
  store.notify(kind.name + " started", `${M.label(M.get(a.pair))} · ${money(a.amount)} USDT · ${a.expiry < 60 ? a.expiry + "s" : a.expiry / 60 + "m"} expiry · ${a.interval}s wait between trades`, "ok");
  runAuto(id);
}
/* edit a bot's settings (works while it is running; the new values apply from its next trade) */
function updateBinBot(id, cfg){ const a = binCfg(id) || (S().binBots = S().binBots || {}, S().binBots[id] = {log:[], name:BIN_KINDS[id]?.name}); Object.assign(a, cfg, {created:true}); store.save(); bus.emit("auto"); return a; }
function runAuto(only){
  const ids = only ? [only] : Object.keys(BIN_KINDS);
  ids.forEach(id => { clearInterval(binTimers[id]); delete binTimers[id]; const a = binCfg(id); if (!a?.on) return;
    binTimers[id] = setInterval(() => autoTick(id), 1000); setTimeout(() => autoTick(id), 1500); });
  bus.emit("auto");
}
function stopAuto(reason="Stopped by you.", id="auto"){ const a = binCfg(id); if (!a) return; a.on = false; clearInterval(binTimers[id]); delete binTimers[id]; autoLog("Bot stopped. " + reason, id); bus.emit("auto"); }


/* ---- Futures (USDT-M perpetual, cross or isolated) ---- */
const F = () => S().fut;
const r2 = v => Math.round(v * 100) / 100;
const r6 = v => Math.round(v * 1e6) / 1e6;   /* fees keep 6 decimals (small orders must not round to 0) */
function maxLev(p){ return C.LEVERAGE_MAX[p?.type] || 125; }
function crossAvail(){ return store.wb("futures"); }
// Liquidation: margin balance (margin [+ free balance for cross]) + uPnL = maintenance margin
function liqPrice(side, entry, lev, mode="cross", qty=null, margin=null){
  const mmr = C.MMR;
  if (mode !== "cross" && qty != null && margin > 0 && entry > 0) lev = qty * entry / margin;   // isolated: effective leverage follows the margin actually assigned (add / remove margin)
  if (mode !== "cross" || qty == null) return side === "long" ? entry * (1 - 1/lev + mmr) : entry * (1 + 1/lev - mmr);
  const eq = margin + crossAvail();
  const lp = side === "long" ? (entry * qty - eq) / (qty * (1 - mmr)) : (entry * qty + eq) / (qty * (1 + mmr));
  return lp > 0 ? lp : 0;
}
function refreshLiq(){ F().positions.forEach(p => { if (p.mode === "cross") p.liq = liqPrice(p.side, p.entry, p.lev, "cross", p.qty, p.margin); }); }
function futValidate(sym, margin, lev, price){
  const p = M.get(sym);
  if (!p) return "Unknown pair.";
  if (p.closed) return "Market closed for " + M.label(p) + ".";
  if (M.isStale(p)) return "Market data offline. Reconnecting…";
  if (!(margin > 0)) return "Please enter the amount.";
  if (margin * lev < 5) return "Order value must be at least 5 USDT.";
  const fee = margin * lev * C.FEE;
  if (margin + fee > store.wb("futures") + 1e-9) return "Insufficient Futures balance";
  if (lev < 1 || lev > maxLev(p)) return `Leverage must be 1x–${maxLev(p)}x.`;
  if (margin * lev > 5000000) return "Max position size is 5,000,000 USDT.";
  if (price != null && !(price > 0)) return "Please enter the price.";
  return null;
}
function tpslCheck(side, ref, tp, sl, liq){
  if (tp && (side === "long" ? tp <= ref : tp >= ref)) return "TP price must be " + (side === "long" ? "higher" : "lower") + " than the " + "current price.";
  if (sl && (side === "long" ? sl >= ref : sl <= ref)) return "SL price must be " + (side === "long" ? "lower" : "higher") + " than the current price.";
  if (sl && liq && (side === "long" ? sl <= liq : sl >= liq)) return "SL price is beyond the liquidation price.";
  return null;
}
function addToPosition(sym, side, margin, lev, entry, fee, mode, tp, sl){
  let pos = F().positions.find(p => p.sym === sym && p.side === side);
  const qty = margin * lev / entry;
  if (pos){
    const nq = pos.qty + qty; pos.entry = (pos.entry * pos.qty + entry * qty) / nq; pos.qty = nq; pos.margin += margin; pos.fee += fee; pos.maxQty = Math.max(pos.maxQty || 0, nq);
    pos.realized = (pos.realized || 0) - fee; pos.lev = Math.round(pos.qty * pos.entry / pos.margin);
    pos.rz = pos.rz || {openFee:pos.fee - fee, closeFee:0, closePnl:0, funding:0}; pos.rz.openFee += fee;
    if (tp) pos.tp = tp; if (sl) pos.sl = sl;
  } else {
    pos = {id:uid(), sym, side, margin, lev, entry, qty, maxQty:qty, tp, sl, fee, realized:-fee, mode, open:Date.now(), fEp: Math.floor(Date.now() / FUND_MS), rz:{openFee:fee, closeFee:0, closePnl:0, funding:0}};
    F().positions.push(pos);
  }
  pos.liq = liqPrice(side, pos.entry, pos.lev, mode, pos.qty, pos.margin);
  return pos;
}
function openFut({sym, side, margin, lev, type="market", price=null, tp=null, sl=null, mode=null, tif="GTC"}){
  mode = mode || S().settings.marginMode || "cross";
  margin = r2(margin);
  const err = futValidate(sym, margin, lev, type === "limit" ? price : null); if (err) return {err};
  const p = M.get(sym);
  let fee = r6(margin * lev * C.FEE * (type === "limit" ? 0.4 : 1));   // maker (limit) fee = 0.4 x taker
  if (type === "limit"){
    if (side === "long" ? price >= p.price : price <= p.price){ type = "market"; fee = r6(margin * lev * C.FEE); }
    else {
      if (tif === "IOC" || tif === "FOK") return {err:`${tif} order cannot be filled immediately at this price.`};
      const e2 = tpslCheck(side, price, tp, sl, null); if (e2) return {err:e2};
      const o = {id:uid(), sym, side, margin, lev, price, tp, sl, fee, mode, tif, t:Date.now()};
      F().orders.push(o); store.addWallet("futures", -margin - fee, "order");
      F().log = (F().log || []).concat({t:Date.now(), sym, side, type:"Limit", price, qty: margin*lev/price, fee, status:"New"}).slice(-200);
      bus.emit("positions"); store.save(); return {order:o};
    }
  }
  const e2 = tpslCheck(side, p.price, tp, sl, liqPrice(side, p.price, lev, mode, margin*lev/p.price, margin)); if (e2) return {err:e2};
  store.addWallet("futures", -margin - fee, "futures");
  const pos = addToPosition(sym, side, margin, lev, p.price, fee, mode, tp, sl);
  F().log = (F().log || []).concat({t:Date.now(), sym, side, type:"Market", price:p.price, qty: margin*lev/p.price, fee, status:"Filled"}).slice(-200);
  refreshLiq(); award("futures"); bus.emit("positions"); store.save();
  return {pos};
}
function futPnl(pos, px){
  px = px ?? M.get(pos.sym)?.price ?? pos.entry;
  const pnl = (px - pos.entry) * pos.qty * (pos.side === "long" ? 1 : -1);
  const mm = pos.qty * px * C.MMR, bal = pos.margin + (pos.mode === "cross" ? crossAvail() : 0) + pnl;
  return {pnl, roe: pnl / pos.margin * 100, px, size: pos.qty * px, mr: bal > 0 ? mm / bal * 100 : 100};
}
// Close fraction (0..1] of a position at market (or a given price)
function closeFut(id, reason="manual", atPx, frac=1){
  const pos = F().positions.find(x => x.id === id); if (!pos) return null;
  const px = atPx ?? M.get(pos.sym)?.price ?? pos.entry;
  frac = U.clamp(frac, 0, 1);
  const q = pos.qty * frac, m = pos.margin * frac;
  let pnl = (px - pos.entry) * q * (pos.side === "long" ? 1 : -1);
  const fee = r6(q * px * C.FEE);
  if (reason === "liquidated") pnl = -m;
  const back = Math.max(0, m + pnl - (reason === "liquidated" ? 0 : fee));
  pos.realized = (pos.realized || 0) + pnl - (reason === "liquidated" ? 0 : fee);
  pos.rz = pos.rz || {openFee:pos.fee || 0, closeFee:0, closePnl:0, funding:0}; pos.rz.closePnl += pnl; pos.rz.closeFee += reason === "liquidated" ? 0 : fee;
  pos.closedQty = (pos.closedQty || 0) + q; pos.closeNotional = (pos.closeNotional || 0) + q * px;
  store.addWallet("futures", back, "futures");
  F().log = (F().log || []).concat({t:Date.now(), sym:pos.sym, side: pos.side === "long" ? "short" : "long", type: reason === "manual" ? "Market" : reason.toUpperCase(), price:px, qty:q, fee, pnl, status:"Filled"}).slice(-200);
  let profit = r2(pnl - fee);
  if (frac >= 0.9999 || reason === "liquidated"){
    F().positions = F().positions.filter(x => x.id !== id);
    const avgClose = pos.closeNotional / pos.closedQty;
    F().history.unshift({id:pos.id, sym:pos.sym, side:pos.side, lev:pos.lev, mode:pos.mode || "isolated", entry:pos.entry, exit:avgClose, closedVol:pos.closedQty, maxQty:pos.maxQty || pos.closedQty,
      margin:pos.margin, open:pos.open, closed:Date.now(), profit:r2(pos.realized), roi: pos.realized / (pos.margin || 1) * 100, reason, fee:pos.fee, rz:pos.rz});
    F().history = F().history.slice(0, 300);
    profit = r2(pos.realized);
  } else { pos.qty -= q; pos.margin -= m; }
  refreshLiq();
  const lbl = M.label(M.get(pos.sym));
  const title = reason === "liquidated" ? "Position liquidated" : reason === "tp" ? "Take profit triggered 🎯" : reason === "sl" ? "Stop loss triggered" : frac < 0.9999 ? "Position partially closed" : "Position closed";
  store.notify(title, `${lbl} ${pos.side === "long" ? "Long" : "Short"} ${pos.lev}x · ${signed(profit)} USDT`, profit >= 0 ? "ok" : "bad");
  bus.emit("positions"); bus.emit("history"); bus.emit("futClosed", {pos, profit, reason, px});
  return profit;
}
function cancelOrder(id){
  const o = F().orders.find(x => x.id === id); if (!o) return;
  F().orders = F().orders.filter(x => x.id !== id);
  store.addWallet("futures", o.margin + o.fee, "order"); bus.emit("positions");
}
function setTpSl(id, tp, sl){
  const pos = F().positions.find(x => x.id === id); if (!pos) return "Position not found.";
  const e = tpslCheck(pos.side, M.get(pos.sym)?.price ?? pos.entry, tp, sl, pos.liq); if (e) return e;
  pos.tp = tp || null; pos.sl = sl || null; store.save(); bus.emit("positions"); return null;
}
function setPosLev(id, lev){
  const pos = F().positions.find(x => x.id === id); if (!pos) return "Position not found.";
  const need = pos.qty * pos.entry / lev, diff = need - pos.margin;
  if (diff > store.wb("futures") + 1e-9) return "Insufficient Futures balance";
  store.addWallet("futures", -diff, "futures"); pos.margin = need; pos.lev = lev;
  pos.liq = liqPrice(pos.side, pos.entry, lev, pos.mode, pos.qty, pos.margin); refreshLiq(); store.save(); bus.emit("positions"); return null;
}
/* Isolated margin: info for the Add / Remove Margin sheet and the adjustment itself */
const fl2 = v => Math.floor(Math.max(0, v) * 100 + 1e-9) / 100;
function marginInfo(pos){
  const px = M.get(pos.sym)?.price ?? pos.entry, L = pos.side === "long", pnl = (px - pos.entry) * pos.qty * (L ? 1 : -1), init = pos.qty * pos.entry / pos.lev;
  const safe = x => { const l = liqPrice(pos.side, pos.entry, pos.lev, "isolated", pos.qty, pos.margin - x); return L ? l < px * 0.999 : l > px * 1.001; };
  let rem = Math.max(0, pos.margin - init + Math.min(0, pnl));
  if (!safe(rem)){ let lo = 0, hi = rem; for (let i = 0; i < 30; i++){ const mid = (lo + hi) / 2; if (safe(mid)) lo = mid; else hi = mid; } rem = lo; }
  const liqAt = delta => { const l = liqPrice(pos.side, pos.entry, pos.lev, "isolated", pos.qty, pos.margin + delta); return l > 0 ? l : 0; };
  return {margin: pos.margin, maxAdd: fl2(store.wb("futures")), maxRem: fl2(rem), liqAt, pnl, px};
}
function adjustMargin(id, delta){
  const pos = F().positions.find(x => x.id === id); if (!pos) return "Position not found.";
  if (pos.mode !== "isolated") return "Margin can only be adjusted on isolated positions.";
  delta = r2(delta); if (!(Math.abs(delta) > 0)) return "Please enter the amount.";
  const mi = marginInfo(pos);
  if (delta > 0){ if (delta > mi.maxAdd + 1e-9) return "Insufficient Futures balance"; }
  else if (-delta > mi.maxRem + 1e-9) return "Amount exceeds the maximum removable margin.";
  store.addWallet("futures", -delta, "margin"); pos.margin = r2(pos.margin + delta);
  pos.liq = liqPrice(pos.side, pos.entry, pos.lev, "isolated", pos.qty, pos.margin);
  store.save(); bus.emit("positions"); return null;
}
bus.on("tick", (sym, px) => {
  F().orders.filter(o => o.sym === sym).forEach(o => {
    if (o.side === "long" ? px <= o.price : px >= o.price){
      F().orders = F().orders.filter(x => x.id !== o.id);
      addToPosition(sym, o.side, o.margin, o.lev, o.price, o.fee, o.mode || "cross", o.tp, o.sl); refreshLiq();
      F().log = (F().log || []).concat({t:Date.now(), sym, side:o.side, type:"Limit", price:o.price, qty:o.margin*o.lev/o.price, fee:o.fee, status:"Filled"}).slice(-200);
      store.notify("Limit order filled", `${M.label(M.get(sym))} ${o.side === "long" ? "Open Long" : "Open Short"} @ ${M.fmtPx(M.get(sym), o.price)}`, "ok");
      U.toast("Limit order filled", "ok"); U.fx("open"); bus.emit("positions");
    }
  });
  F().positions.filter(p => p.sym === sym).forEach(p => {
    const L = p.side === "long";
    if (p.liq > 0 && (L ? px <= p.liq : px >= p.liq)) closeFut(p.id, "liquidated", p.liq);
    else if (p.tp && (L ? px >= p.tp : px <= p.tp)) closeFut(p.id, "tp", px);
    else if (p.sl && (L ? px <= p.sl : px >= p.sl)) closeFut(p.id, "sl", px);
  });
  // price alerts
  const al = S().alerts.filter(a => a.sym === sym && !a.done);
  al.forEach(a => {
    if (a.last == null){ a.last = px; return; }
    if ((a.last < a.price && px >= a.price) || (a.last > a.price && px <= a.price)){
      a.done = true; a.hit = Date.now();
      const lbl = M.label(M.get(sym));
      store.notify("Price alert 🔔", `${lbl} reached ${M.fmtPx(M.get(sym), a.price)}`, "info");
      U.toast(`${lbl} hit ${M.fmtPx(M.get(sym), a.price)}`, "info", 4000); U.fx("alert");
      store.save(); bus.emit("alerts");
    }
    a.last = px;
  });
});

bus.on("balance", () => refreshLiq());

/* ---- Rewards / XP ---- */
const TASKS = [
  {k:"first", n:"Place your first binary trade", xp:50, reward:20},
  {k:"win3", n:"Win 3 binary trades", xp:80, reward:30},
  {k:"futures", n:"Open a futures position", xp:60, reward:25},
  {k:"tpsl", n:"Use Take Profit / Stop Loss", xp:40, reward:15},
  {k:"ind", n:"Add 3 chart indicators", xp:30, reward:10},
  {k:"alert", n:"Create a price alert", xp:30, reward:10},
  {k:"bot", n:"Start a trading bot", xp:50, reward:20},
  {k:"learn", n:"Read 2 Academy lessons", xp:40, reward:15}
];
const BADGES = [
  {k:"first", e:"🚀", n:"First Trade"}, {k:"win3", e:"🏆", n:"Hat-trick"}, {k:"futures", e:"⚡", n:"Leverage"}, {k:"tpsl", e:"🛡️", n:"Risk Pro"},
  {k:"ind", e:"📊", n:"Analyst"}, {k:"alert", e:"🔔", n:"Watcher"}, {k:"bot", e:"🤖", n:"Automator"}, {k:"streak", e:"🔥", n:"7-day Streak"}
];
function award(k){ const r = S().rewards; if (r.used[k]) return; r.used[k] = Date.now(); store.save(); bus.emit("rewards"); U.pushNotif ? U.pushNotif("system", "Task complete", "Claim your reward in Rewards Hub", "ok") : U.toast("Task complete! Claim your reward in Rewards Hub", "ok", 3000); }
function taskDone(k){
  const r = S().rewards, h = S().history;
  if (k === "first") return h.length > 0 || S().positions.length > 0;
  if (k === "win3") return h.filter(x => x.result === "win").length >= 3;
  if (k === "ind") return (S().settings.inds || []).length >= 3 || !!r.used.ind;
  if (k === "learn") return Object.keys(r.used).filter(x => x.startsWith("lesson:")).length >= 2;
  if (k === "streak") return streak() >= 7;
  return !!r.used[k];
}
function claim(k){
  const t = TASKS.find(x => x.k === k), r = S().rewards;
  if (!t || r.claimed[k] || !taskDone(k)) return false;
  r.claimed[k] = Date.now(); r.xp += t.xp; store.addWallet("spot", t.reward, "reward");
  store.notify("Reward claimed", `+${t.reward} USDT · +${t.xp} XP`, "ok"); bus.emit("rewards"); return t;
}
const dayKey = (d=new Date()) => d.toISOString().slice(0,10);
function streak(){
  const set = new Set(S().rewards.checkins); let n = 0, d = new Date();
  if (!set.has(dayKey(d))) d.setDate(d.getDate()-1);
  while (set.has(dayKey(d))){ n++; d.setDate(d.getDate()-1); }
  return n;
}
const CHECKIN = [5,10,15,20,30,40,80];
function checkIn(){
  const r = S().rewards, k = dayKey(); if (r.checkins.includes(k)) return null;
  const st = streak(), amt = CHECKIN[st % 7];
  r.checkins.push(k); r.checkins = r.checkins.slice(-60); r.xp += 10;
  store.addWallet("spot", amt, "checkin");
  store.notify("Daily check-in", `+${amt} USDT · Day ${st % 7 + 1} streak`, "ok"); bus.emit("rewards");
  return {amt, day: st % 7 + 1};
}
const level = () => { const xp = S().rewards.xp; return {lvl: Math.floor(xp/200) + 1, cur: xp % 200, need:200, xp}; };

/* ---- Vault (Earn) ---- */
const APR = 0.08;
/* Earn total = flexible vault + locked products (principal + accrued simple interest) */
function earnValue(){ const L = (S().earn?.locked || []), now = Date.now(); return vaultValue() + L.reduce((a, x) => a + x.amount * (1 + x.apr * Math.min(now - x.start, x.days * 864e5) / 31536e6), 0); }
function vaultValue(){ const v = S().vault; return v.bal * (1 + APR * (Date.now() - v.since) / 31536e6); }
function vaultMove(amount, dir){
  const v = S().vault, cur = vaultValue();
  if (dir === "in"){ if (amount > store.wb("earn") + 1e-9) return "Insufficient Earn balance"; v.bal = cur + amount; v.since = Date.now(); store.addWallet("earn", -amount, "vault"); }
  else { if (amount > cur + 1e-9) return "Amount exceeds your Vault balance."; v.bal = cur - amount; v.since = Date.now(); store.addWallet("earn", amount, "vault"); }
  store.save(); bus.emit("vault"); return null;
}

window.E = {alignedExpiry, payoutOf, earnValue, marginInfo, adjustMargin, setPosLev, refreshLiq, liqPrice, maxLev, futValidate, openFut, futPnl, closeFut, cancelOrder, setTpSl, TASKS, BADGES, award, taskDone, claim, streak, checkIn, CHECKIN, level, dayKey, vaultValue, vaultMove, APR, validate, place, livePnl, stats, todaySeries, BOTS, botPnl, startBot, stopBot, startAuto, stopAuto, runAuto, RATIO};
/* ---- Binary early close (like Quotex / Olymp): allowed during the first half of the period, priced like an option. No slippage: uses the live mark price. ---- */
function earlyValue(pos, now=Date.now()){
  const total = pos.exp - pos.open, left = pos.exp - now, f = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const open = f >= 0.5 && left > 0;                                   // first 50% of the duration only
  const {win} = livePnl(pos);
  let value;
  if (win === true) value = pos.amount * (1 + pos.payout * f * 0.8);      // stake + reduced profit (shrinks as time runs out)
  else { const lossFactor = win === false ? 0.4 + 0.4 * (1 - f) * 2 : 0.1; value = pos.amount * (1 - lossFactor); }   // lose 40-60%
  value = Math.round(value * 100) / 100;
  return {open, left, f, win, value, profit: Math.round((value - pos.amount) * 100) / 100, lockIn: Math.max(0, left - total * 0.5) / 1000};
}
function closeBinaryEarly(id){
  const pos = S().positions.find(x => x.id === id); if (!pos) return {err:"Position not found."};
  const ev = earlyValue(pos), p = M.get(pos.sym);
  if (!ev.open) return {err:"Early close is only available during the first half of the trade."};
  if (!p?.price || M.isStale(p)) return {err:"Market data offline. Try again in a moment."};
  const exit = p.price, credit = ev.value, profit = ev.profit, now = Date.now();
  const result = profit > 0 ? "win" : profit < 0 ? "loss" : "draw";
  S().positions = S().positions.filter(x => x.id !== pos.id);
  const rec = Object.assign({}, pos, {exit, result, profit, credit, closed: now, early:true});
  S().history.unshift(rec); S().history = S().history.slice(0, 500);
  store.addWallet("binary", credit, "settle");
  store.notify("Trade closed early", `${M.label(p)} ${pos.dir === "up" ? "Up" : "Down"} ${money(pos.amount)} USDT → ${signed(profit)} USDT`, profit >= 0 ? "ok" : "bad");
  bus.emit("positions"); bus.emit("history"); bus.emit("settled", rec);
  return {rec};
}
Object.assign(window.E, {earlyValue, closeBinaryEarly, binBots, updateBinBot, BIN_KINDS, binCfg});
setTimeout(() => { try { runAuto(); } catch {} }, 2500);   // resume every binary bot that was running when the app closed
})();
