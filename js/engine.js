/* ===== Trading engine: binary options, bots, auto trading ===== */
(function(){
const C = window.CONFIG, {store, bus, toast, fmt, money, signed, uid} = U;
const S = () => store.s;
const RATIO = 1 + C.PAYOUT;

function validate(sym, amount){
  const p = M.get(sym);
  if (!p) return "Unknown pair.";
  if (!p.tradable) return "Binary options are not available for this pair. Switch to Futures or pick a top-10 crypto, forex or metal pair.";
  if (p.closed) return "Market closed for " + M.label(p) + ". Trading resumes when the market opens.";
  if (M.isStale(p)) return "Market data offline. Reconnecting… please try again in a moment.";
  if (!(amount > 0) || isNaN(amount)) return "Enter a valid amount.";
  if (amount < 1) return "Minimum trade amount is 1 USDT.";
  if (amount > 50000) return "Maximum trade amount is 50,000 USDT.";
  if (amount > S().balance) return "Insufficient balance. Add funds from Deposit.";
  if (S().positions.length >= C.MAX_OPEN) return `Maximum ${C.MAX_OPEN} open positions reached.`;
  return null;
}

function place(sym, dir, amount, expiry, source="manual"){
  amount = Math.round(amount * 100) / 100;
  const err = validate(sym, amount);
  if (err) return {err};
  const p = M.get(sym), now = Date.now();
  const pos = {id:uid(), sym, dir, amount, entry:p.price, open:now, exp:now + expiry*1000, expiry, payout:C.PAYOUT, source};
  S().positions.push(pos);
  store.setBalance(S().balance - amount, "trade");
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
    else if ((pos.dir === "up") === (diff > 0)){ result = "win"; credit = Math.round(pos.amount * RATIO * 100) / 100; }
    else result = "loss";
  }
  const profit = Math.round((credit - pos.amount) * 100) / 100;
  S().positions = S().positions.filter(x => x.id !== pos.id);
  const rec = Object.assign({}, pos, {exit, result, profit, closed: now});
  S().history.unshift(rec); S().history = S().history.slice(0, 500);
  store.setBalance(S().balance + credit, "settle");
  const lbl = M.label(p || {type:"crypto", base:pos.sym});
  store.notify(result === "win" ? "Trade won 🎉" : result === "loss" ? "Trade lost" : "Trade refunded",
    `${lbl} ${pos.dir === "up" ? "Up" : "Down"} ${money(pos.amount)} USDT → ${signed(profit)} USDT`, result === "win" ? "ok" : result === "loss" ? "bad" : "info");
  bus.emit("positions"); bus.emit("history"); bus.emit("settled", rec);
  return true;
}

setInterval(() => {
  const now = Date.now();
  [...S().positions].forEach(pos => { if (now >= pos.exp) settle(pos); });
  bus.emit("sec");
}, 250);

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
  {id:"combo", name:"Future Combo Bot", pair:"BTCUSDT", desc:"Long BTC with a hedge — trend-following futures combo.", mult:3, grid:0.00004, risk:"Medium", apy:"38–64%"},
  {id:"grid", name:"Spot Grid Bot", pair:"ETHUSDT", desc:"Buys low and sells high inside a price range, 24/7.", mult:1, grid:0.00008, risk:"Low", apy:"12–28%"},
  {id:"dca", name:"Smart DCA Bot", pair:"SOLUSDT", desc:"Dollar-cost averages into dips with safety orders.", mult:1.5, grid:0.00003, risk:"Low", apy:"15–35%"},
  {id:"gold", name:"Gold Trend Bot", pair:"XAUUSD", desc:"Follows the gold trend on biquote live prices.", mult:5, grid:0.00002, risk:"Medium", apy:"20–45%"},
  {id:"fx", name:"Forex Scalper", pair:"EURUSD", desc:"High-frequency EUR/USD scalping on short swings.", mult:20, grid:0.00002, risk:"High", apy:"25–80%"}
];
function botPnl(id){
  const b = S().bots[id]; if (!b?.running) return b?.pnl || 0;
  const def = BOTS.find(x => x.id === id), p = M.get(def.pair);
  const px = p?.price || b.start;
  const move = (px - b.start) / b.start * def.mult * b.invest;
  const mins = (Date.now() - b.since) / 60000;
  const grid = b.invest * def.grid * mins * 60 / 60; // small accrual per minute
  return Math.max(-b.invest * 0.95, move + grid);
}
function startBot(id, invest){
  const def = BOTS.find(x => x.id === id), p = M.get(def.pair);
  if (!(invest >= 10)) return "Minimum investment is 10 USDT.";
  if (invest > S().balance) return "Insufficient balance.";
  if (!p?.price || M.isStale(p)) return "Market data offline for " + def.pair + ". Try again shortly.";
  if (p.closed) return "Market closed for this pair right now.";
  S().bots[id] = {running:true, invest, start:p.price, since:Date.now(), series:[0], pnl:0};
  store.setBalance(S().balance - invest, "bot");
  store.notify("Bot started", `${def.name} with ${money(invest)} USDT`, "ok"); E.award("bot");
  bus.emit("bots"); return null;
}
function stopBot(id){
  const b = S().bots[id]; if (!b?.running) return;
  const pnl = Math.round(botPnl(id) * 100) / 100;
  b.running = false; b.pnl = pnl; b.stopped = Date.now();
  store.setBalance(S().balance + b.invest + pnl, "bot");
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

/* ---- Auto trading ---- */
let autoTimer = null;
function autoDecide(sym, strat){
  const m = M.momentum(sym, 45000);
  if (strat === "trend") return m >= 0 ? "up" : "down";
  if (strat === "reversal") return m >= 0 ? "down" : "up";
  return Math.random() < 0.5 ? "up" : "down";
}
function autoLog(msg){ const a = S().auto; a.log.unshift({t:Date.now(), msg}); a.log = a.log.slice(0, 40); store.save(); bus.emit("auto"); }
function autoTick(){
  const a = S().auto; if (!a.on) return;
  if (a.count >= a.max){ stopAuto("Reached max trades (" + a.max + ")."); return; }
  if (S().positions.filter(x => x.source === "auto").length >= 3) return;
  const dir = autoDecide(a.pair, a.strategy);
  const r = place(a.pair, dir, a.amount, a.expiry, "auto");
  if (r.err){ autoLog("Skipped: " + r.err); if (/Insufficient/.test(r.err)) stopAuto("Insufficient balance."); return; }
  a.count++; autoLog(`#${a.count} ${dir.toUpperCase()} ${M.label(M.get(a.pair))} ${money(a.amount)} USDT @ ${M.fmtPx(M.get(a.pair))}`);
}
function startAuto(cfg){
  Object.assign(S().auto, cfg, {on:true, count:0});
  autoLog("Auto trading started — " + cfg.strategy + " strategy.");
  store.notify("Auto trading ON", `${M.label(M.get(cfg.pair))} · ${money(cfg.amount)} USDT · every ${cfg.interval}s`, "ok");
  runAuto();
}
function runAuto(){ clearInterval(autoTimer); if (!S().auto.on) return; autoTimer = setInterval(autoTick, S().auto.interval * 1000); setTimeout(autoTick, 1500); bus.emit("auto"); }
function stopAuto(reason="Stopped by you."){ S().auto.on = false; clearInterval(autoTimer); autoLog("Auto trading stopped. " + reason); bus.emit("auto"); }


/* ---- Futures (isolated margin, USDT-margined) ---- */
const F = () => S().fut;
function liqPrice(side, entry, lev){ return side === "long" ? entry * (1 - 1/lev + C.MMR) : entry * (1 + 1/lev - C.MMR); }
function maxLev(p){ return C.LEVERAGE_MAX[p.type] || 125; }
function futValidate(sym, margin, lev, price){
  const p = M.get(sym);
  if (!p) return "Unknown pair.";
  if (p.closed) return "Market closed for " + M.label(p) + ".";
  if (M.isStale(p)) return "Market data offline. Reconnecting…";
  if (!(margin > 0)) return "Enter a valid margin amount.";
  if (margin < 1) return "Minimum margin is 1 USDT.";
  const fee = margin * lev * C.FEE;
  if (margin + fee > S().balance) return "Insufficient balance for margin + fee.";
  if (lev < 1 || lev > maxLev(p)) return `Leverage must be 1x–${maxLev(p)}x.`;
  if (margin * lev > 2000000) return "Max position size is 2,000,000 USDT.";
  if (price != null && !(price > 0)) return "Enter a valid limit price.";
  return null;
}
function tpslCheck(side, entry, tp, sl, liq){
  if (tp && (side === "long" ? tp <= entry : tp >= entry)) return "Take profit must be " + (side === "long" ? "above" : "below") + " entry price.";
  if (sl && (side === "long" ? sl >= entry : sl <= entry)) return "Stop loss must be " + (side === "long" ? "below" : "above") + " entry price.";
  if (sl && liq && (side === "long" ? sl <= liq : sl >= liq)) return "Stop loss is beyond the liquidation price.";
  return null;
}
function openFut({sym, side, margin, lev, type="market", price=null, tp=null, sl=null}){
  margin = Math.round(margin * 100) / 100;
  const err = futValidate(sym, margin, lev, type === "limit" ? price : null); if (err) return {err};
  const p = M.get(sym), fee = Math.round(margin * lev * C.FEE * 100) / 100;
  if (type === "limit"){
    if (side === "long" ? price >= p.price : price <= p.price) type = "market";
    else {
      const e2 = tpslCheck(side, price, tp, sl, liqPrice(side, price, lev)); if (e2) return {err:e2};
      const o = {id:uid(), sym, side, margin, lev, price, tp, sl, fee, t:Date.now()};
      F().orders.push(o); store.setBalance(S().balance - margin - fee, "order");
      bus.emit("positions"); store.save(); return {order:o};
    }
  }
  const entry = p.price, liq = liqPrice(side, entry, lev);
  const e2 = tpslCheck(side, entry, tp, sl, liq); if (e2) return {err:e2};
  const pos = {id:uid(), sym, side, margin, lev, entry, qty: margin * lev / entry, liq, tp, sl, fee, open:Date.now()};
  F().positions.push(pos); store.setBalance(S().balance - margin - fee, "futures");
  award("futures"); bus.emit("positions"); store.save();
  return {pos};
}
function futPnl(pos, px){ px = px ?? M.get(pos.sym)?.price ?? pos.entry; const pnl = (px - pos.entry) * pos.qty * (pos.side === "long" ? 1 : -1); return {pnl, roe: pnl / pos.margin * 100, px}; }
function closeFut(id, reason="manual", atPx){
  const pos = F().positions.find(x => x.id === id); if (!pos) return null;
  const px = atPx ?? M.get(pos.sym)?.price ?? pos.entry;
  let {pnl} = futPnl(pos, px);
  const fee = Math.round(pos.qty * px * C.FEE * 100) / 100;
  if (reason === "liquidated") pnl = -pos.margin;
  const back = Math.max(0, pos.margin + pnl - (reason === "liquidated" ? 0 : fee));
  const profit = Math.round((back - pos.margin - pos.fee) * 100) / 100;
  F().positions = F().positions.filter(x => x.id !== id);
  F().history.unshift(Object.assign({}, pos, {exit:px, closed:Date.now(), pnl:Math.round(pnl*100)/100, profit, reason}));
  F().history = F().history.slice(0, 300);
  store.setBalance(S().balance + back, "futures");
  const lbl = M.label(M.get(pos.sym));
  const title = reason === "liquidated" ? "Position liquidated" : reason === "tp" ? "Take profit hit 🎯" : reason === "sl" ? "Stop loss hit" : "Position closed";
  store.notify(title, `${lbl} ${pos.side === "long" ? "Long" : "Short"} ${pos.lev}x · ${signed(profit)} USDT`, profit >= 0 ? "ok" : "bad");
  bus.emit("positions"); bus.emit("history"); bus.emit("futClosed", {pos, profit, reason, px});
  return profit;
}
function cancelOrder(id){
  const o = F().orders.find(x => x.id === id); if (!o) return;
  F().orders = F().orders.filter(x => x.id !== id);
  store.setBalance(S().balance + o.margin + o.fee, "order"); bus.emit("positions");
}
function setTpSl(id, tp, sl){
  const pos = F().positions.find(x => x.id === id); if (!pos) return "Position not found.";
  const e = tpslCheck(pos.side, M.get(pos.sym)?.price ?? pos.entry, tp, sl, pos.liq); if (e) return e;
  pos.tp = tp || null; pos.sl = sl || null; store.save(); bus.emit("positions"); return null;
}
bus.on("tick", (sym, px) => {
  F().orders.filter(o => o.sym === sym).forEach(o => {
    if (o.side === "long" ? px <= o.price : px >= o.price){
      F().orders = F().orders.filter(x => x.id !== o.id);
      const liq = liqPrice(o.side, o.price, o.lev);
      F().positions.push({id:o.id, sym, side:o.side, margin:o.margin, lev:o.lev, entry:o.price, qty:o.margin*o.lev/o.price, liq, tp:o.tp, sl:o.sl, fee:o.fee, open:Date.now()});
      store.notify("Limit order filled", `${M.label(M.get(sym))} ${o.side === "long" ? "Buy/Long" : "Sell/Short"} @ ${M.fmtPx(M.get(sym), o.price)}`, "ok");
      U.toast("Limit order filled", "ok"); U.beep("open"); bus.emit("positions");
    }
  });
  F().positions.filter(p => p.sym === sym).forEach(p => {
    const L = p.side === "long";
    if (L ? px <= p.liq : px >= p.liq) closeFut(p.id, "liquidated", p.liq);
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
      U.toast(`${lbl} hit ${M.fmtPx(M.get(sym), a.price)}`, "info", 4000); U.beep("alert"); U.buzz([60,40,60]);
      store.save(); bus.emit("alerts");
    }
    a.last = px;
  });
});

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
function award(k){ const r = S().rewards; if (r.used[k]) return; r.used[k] = Date.now(); store.save(); bus.emit("rewards"); U.toast("Task complete! Claim your reward in Rewards Hub", "ok", 3000); }
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
  r.claimed[k] = Date.now(); r.xp += t.xp; store.setBalance(S().balance + t.reward, "reward");
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
  store.setBalance(S().balance + amt, "checkin");
  store.notify("Daily check-in", `+${amt} USDT · Day ${st % 7 + 1} streak`, "ok"); bus.emit("rewards");
  return {amt, day: st % 7 + 1};
}
const level = () => { const xp = S().rewards.xp; return {lvl: Math.floor(xp/200) + 1, cur: xp % 200, need:200, xp}; };

/* ---- Vault (Earn) ---- */
const APR = 0.08;
function vaultValue(){ const v = S().vault; return v.bal * (1 + APR * (Date.now() - v.since) / 31536e6); }
function vaultMove(amount, dir){
  const v = S().vault, cur = vaultValue();
  if (dir === "in"){ if (amount > S().balance) return "Amount exceeds your trading balance."; v.bal = cur + amount; v.since = Date.now(); store.setBalance(S().balance - amount, "vault"); }
  else { if (amount > cur + 1e-9) return "Amount exceeds your Vault balance."; v.bal = cur - amount; v.since = Date.now(); store.setBalance(S().balance + amount, "vault"); }
  store.save(); bus.emit("vault"); return null;
}

window.E = {liqPrice, maxLev, futValidate, openFut, futPnl, closeFut, cancelOrder, setTpSl, TASKS, BADGES, award, taskDone, claim, streak, checkIn, CHECKIN, level, dayKey, vaultValue, vaultMove, APR, validate, place, livePnl, stats, todaySeries, BOTS, botPnl, startBot, stopBot, startAuto, stopAuto, runAuto, RATIO};
})();
