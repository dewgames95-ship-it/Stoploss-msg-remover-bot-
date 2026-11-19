/* ===== Trading engine: binary options, bots, auto trading ===== */
(function(){
const C = window.CONFIG, {store, bus, toast, fmt, money, signed, uid} = U;
const S = () => store.s;
const RATIO = 1 + C.PAYOUT;

function validate(sym, amount){
  const p = M.get(sym);
  if (!p) return "Unknown pair.";
  if (!p.tradable) return "This pair is chart only — binary trading is available on top 10 crypto, forex and metals.";
  if (p.closed) return "Market closed for " + M.label(p) + ". Trading resumes when the market opens.";
  if (M.isStale(p)) return "Market data offline. Reconnecting… please try again in a moment.";
  if (!(amount > 0) || isNaN(amount)) return "Enter a valid amount.";
  if (amount < 1) return "Minimum trade amount is 1 USDT.";
  if (amount > 50000) return "Maximum trade amount is 50,000 USDT.";
  if (amount > S().balance) return "Insufficient balance. Top up with a demo deposit.";
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
  store.notify("Bot started", `${def.name} with ${money(invest)} USDT`, "ok");
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

window.E = {validate, place, livePnl, stats, todaySeries, BOTS, botPnl, startBot, stopBot, startAuto, stopAuto, runAuto, RATIO};
})();
