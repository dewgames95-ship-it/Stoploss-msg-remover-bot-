/* v7.1 Admin panel part 2 (loads after admin2.js): user dashboard, trading control per product, HD wallet, AI assistant. Registers into Admin2.V. */
(function(){
const X = window.Admin2; if (!X || !window.U) return;
const {V, A, I, esc, n2, n0, tstr, dstr, sgn, card, secH, kpi, empty, field, tog, kv, chips, bindChips, walletChips, tipBtn, wic, wname, WK, readS, run, peek, bal, totalOf, rd, wr} = X;
const {store, toast} = U;
const M_ = () => window.M, E_ = () => window.E;
const mk = sym => { try { return M_() && M_().get(sym); } catch { return null; } };
const px = (sym, d) => { const p = mk(sym); return p && p.price > 0 ? p.price : d; };
const lbl = sym => { const p = mk(sym); try { return p && M_().label ? M_().label(p) : sym; } catch { return sym; } };
const pic = (sym, z = 26) => { const p = mk(sym); try { return p && window.UI && UI.pairIcon ? UI.pairIcon(p, z) : `<span class="a3-ph">${esc(String(sym || "?")[0])}</span>`; } catch { return ""; } };
const fp = v => v == null || !isFinite(v) ? "-" : (+v).toLocaleString("en-US", {maximumFractionDigits: v >= 1000 ? 2 : v >= 1 ? 4 : 8});
const pc = v => (v >= 0 ? "+" : "") + n2(v) + "%";
const cls = v => v > 0 ? "up" : v < 0 ? "down" : "";
const racerD = () => { const d = rd(X.view === "real" ? "nt_racer_real" : "nt_racer", null) || {}; return {bets:Array.isArray(d.bets) ? d.bets : [], races:Array.isArray(d.races) ? d.races : []}; };
const predD = () => { const d = rd(X.view === "real" ? "nt_predict_real" : "nt_predict", null) || {}; const a = k => Array.isArray(d[k]) ? d[k] : []; return {orders:a("orders"), positions:a("positions"), history:a("history")}; };
const amt = o => +(o && (o.amount ?? o.size ?? o.cost ?? o.margin ?? o.stake)) || 0;

/* ================= product panel (shared by Trading and the user dashboard) ================= */
const PRODS = [
  {k:"futures", l:"Futures", ic:"layers", w:"futures", tip:["Futures", "<p>Leveraged long / short positions. You can change TP / SL and leverage, or close a position at market (fully or partly). Limit orders can be cancelled and the margin is refunded.</p>"]},
  {k:"spot", l:"Spot", ic:"chart", w:"spot", tip:["Spot", "<p>Coins the user holds and open limit orders. Sell a holding at market, set TP / SL, or cancel an order.</p>"]},
  {k:"binary", l:"Binary", ic:"clock", w:"binary", tip:["Binary", "<p>Up / Down trades with a fixed expiry. Close a trade now: refund the stake, or settle it at the current price.</p>"]},
  {k:"options", l:"Options", ic:"target", w:"options", tip:["Options", "<p>Call / put contracts. Closing pays the amount you enter (default = premium paid).</p>"]},
  {k:"earn", l:"Earn", ic:"earn", w:"earn", tip:["Earn", "<p>Flexible savings and locked subscriptions. Shown for review.</p>"]},
  {k:"game", l:"Money Game", ic:"car", w:"games", tip:["Money Game", "<p>Bets placed in the racing game, with its limits and win chance.</p>"]},
  {k:"predict", l:"Prediction", ic:"predict", w:"predict", tip:["Prediction", "<p>Prediction-market orders, positions and history, with its limits.</p>"]},
  {k:"cfd", l:"CFD Trade", ic:"candle", w:"cfd", tip:["CFD Trade", "<p>Open CFD positions (forex, gold, indices, crypto). Change TP / SL or close at market.</p>"]}
];
let TAB = "futures", SUB = "open";
const pIc = (k, z = 16) => U.ic ? U.ic(k, z, 1.8) : "";
const subSeg = (opts, cur) => `<div class="a3-sub" role="tablist">${opts.map(([v, l, c]) => `<button role="tab" class="${cur === v ? "on" : ""}" data-sub="${v}">${l}${c != null ? `<em>${c}</em>` : ""}</button>`).join("")}</div>`;
const acts = (...b) => `<div class="a3-ac">${b.join("")}</div>`;
const btn = (a, id, t, c = "") => `<button class="a3-btn ${c}" data-act="${a}" data-id="${esc(id)}">${t}</button>`;
const tile = (l, v, c) => `<div><small>${l}</small><b class="num ${c || ""}">${v}</b></div>`;

/* ----- futures ----- */
function futCard(p){
  const mark = px(p.sym, p.entry), L = p.side === "long", pnl = (mark - p.entry) * p.qty * (L ? 1 : -1), roe = p.margin ? pnl / p.margin * 100 : 0;
  return `<div class="a3-pc"><div class="a3-ph2">${pic(p.sym)}<div class="a3-pt"><b>${esc(lbl(p.sym))}</b><span><i class="a3-tag ${L ? "up" : "down"}">${L ? "Long" : "Short"} ${p.lev}x</i> <i class="a3-tag">${esc(p.mode || "cross")}</i></span></div><div class="a3-pp"><b class="num ${cls(pnl)}">${sgn(pnl)}</b><small class="${cls(roe)}">${pc(roe)}</small></div></div>
    <div class="a3-g">${tile("Size (USDT)", n2(p.qty * mark))}${tile("Margin", n2(p.margin))}${tile("Entry", fp(p.entry))}${tile("Mark", fp(mark))}${tile("Liq. price", p.liq > 0 ? fp(p.liq) : "-")}${tile("TP / SL", `${p.tp ? fp(p.tp) : "-"} / ${p.sl ? fp(p.sl) : "-"}`)}</div>
    ${acts(btn("fmod", p.id, "Modify"), btn("fclose", p.id, "Close", "dn"))}</div>`;
}
function ordCard(o){
  return `<div class="a3-pc"><div class="a3-ph2">${pic(o.sym)}<div class="a3-pt"><b>${esc(lbl(o.sym))}</b><span><i class="a3-tag ${o.side === "long" ? "up" : "down"}">Limit ${o.side === "long" ? "Long" : "Short"} ${o.lev}x</i></span></div><div class="a3-pp"><b class="num">${fp(o.price)}</b><small>${n2(o.margin)} margin</small></div></div>${acts(btn("fcancel", o.id, "Cancel order", "dn"))}</div>`;
}
const histRow = (ic, a, b, r, rc) => `<div class="a2-ac"><span class="a2-ai">${I(ic, 16)}</span><div><b>${a}</b><small>${b}</small></div><em class="${rc || ""}">${r}</em></div>`;
function pFut(s){
  const f = s.fut, sub = SUB === "orders" || SUB === "hist" ? SUB : "open";
  const body = sub === "open" ? (f.positions.length ? f.positions.map(futCard).join("") : empty("No open positions."))
    : sub === "orders" ? (f.orders.length ? f.orders.map(ordCard).join("") : empty("No open orders."))
    : (f.history.length ? f.history.slice(0, 30).map(h => histRow("trade", `${esc(lbl(h.sym))} ${esc(h.side)} ${h.lev || ""}x`, `${esc(h.reason || "closed")} · ${tstr(h.closed)}`, sgn(h.profit || 0), cls(h.profit))).join("") : empty("No history yet."));
  return subSeg([["open", "Positions", f.positions.length], ["orders", "Orders", f.orders.length], ["hist", "History"]], sub) + body;
}
function futModify(id){
  const p = readS().fut.positions.find(x => x.id === id); if (!p) return;
  const ml = (E_() && E_().maxLev ? E_().maxLev(mk(p.sym) || {}) : 125) || 125;
  U.sheet("Modify position", `<div class="a2-sh"><div class="a3-ph2">${pic(p.sym)}<div class="a3-pt"><b>${esc(lbl(p.sym))}</b><span><i class="a3-tag ${p.side === "long" ? "up" : "down"}">${p.side === "long" ? "Long" : "Short"} ${p.lev}x</i> Entry ${fp(p.entry)}</span></div></div>
    <div class="a2-g2">${field("Take profit price", "a3tp", p.tp || "", {step:"any", min:0, ph:"None"})}${field("Stop loss price", "a3sl", p.sl || "", {step:"any", min:0, ph:"None"})}</div>
    ${field(`Leverage (1-${ml}x)`, "a3lv", p.lev, {step:1, min:1})}<div class="a2-chips row">${[1, 5, 10, 20, 50, 100].filter(v => v <= ml).map(v => `<button type="button" class="a2-chip" data-lv="${v}"><span>${v}x</span></button>`).join("")}</div>
    <div class="a2-err" id="a3er"></div><button class="a2-b pri" id="a3go">Save changes</button></div>`, el => {
    el.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { el.querySelector("#a3lv").value = b.dataset.lv; });
    el.querySelector("#a3go").onclick = () => {
      const tp = parseFloat(el.querySelector("#a3tp").value) || null, sl = parseFloat(el.querySelector("#a3sl").value) || null, lv = Math.round(parseFloat(el.querySelector("#a3lv").value));
      if (!(lv >= 1 && lv <= ml)) return (el.querySelector("#a3er").textContent = `Leverage must be 1-${ml}x`);
      const e = run(() => { if (!E_()) return "Engine not ready"; let r = E_().setTpSl(id, tp, sl); if (r) return r; const q = store.s.fut.positions.find(x => x.id === id); if (q && lv !== q.lev) r = E_().setPosLev(id, lv); return r; });
      if (e) return (el.querySelector("#a3er").textContent = e);
      U.fx && U.fx("claim"); U.closeLayer(); toast("Position updated", "ok"); redraw();
    };
  });
}
function futClose(id){
  const p = readS().fut.positions.find(x => x.id === id); if (!p) return; let frac = 1;
  const mark = px(p.sym, p.entry), pnl = (mark - p.entry) * p.qty * (p.side === "long" ? 1 : -1);
  U.sheet("Close position", `<div class="a2-sh"><div class="a2-box">${kv("Pair", esc(lbl(p.sym)))}${kv("Side", `${p.side === "long" ? "Long" : "Short"} ${p.lev}x`)}${kv("Mark price", fp(mark))}${kv("Unrealized PnL", `<span class="${cls(pnl)}">${sgn(pnl)} USDT</span>`)}</div>
    <div class="a2-lbl">Amount to close</div>${chips("a3fr", [25, 50, 75, 100].map(v => ({v:v / 100, l:v + "%"})), 1, "c4")}<p class="a2-hint">Closes at the current market price. The user is notified.</p><button class="a2-b pri" id="a3go">Close position</button></div>`, el => {
    bindChips(el, "a3fr", v => frac = +v);
    el.querySelector("#a3go").onclick = () => { const r = run(() => E_() ? E_().closeFut(id, "manual", undefined, frac) : null); if (r == null) return toast("Could not close", "bad"); U.fx && U.fx("close"); U.closeLayer(); toast(`Closed ${Math.round(frac * 100)}%: ${sgn(r)} USDT`, "ok"); redraw(); };
  });
}
/* ----- spot ----- */
function pSpot(s){
  const hold = Object.entries(s.spot.hold || {}).filter(([, h]) => h && h.qty > 1e-9), ord = s.spot.orders || [], hist = s.spot.history || [], sub = SUB === "orders" || SUB === "hist" ? SUB : "open";
  const hc = ([k, h]) => { const sym = h.sym || k + "USDT", mark = px(sym, 0), val = h.qty * mark, pnl = mark ? val - (h.cost || 0) : 0; return `<div class="a3-pc"><div class="a3-ph2">${pic(sym)}<div class="a3-pt"><b>${esc(k)}</b><span>${fp(h.qty)} held</span></div><div class="a3-pp"><b class="num">${n2(val)}</b><small class="${cls(pnl)}">${mark ? sgn(pnl) : "-"}</small></div></div><div class="a3-g">${tile("Avg cost", h.qty ? fp((h.cost || 0) / h.qty) : "-")}${tile("Mark", mark ? fp(mark) : "-")}${tile("TP / SL", `${h.tp ? fp(h.tp) : "-"} / ${h.sl ? fp(h.sl) : "-"}`)}</div>${acts(btn("stpsl", k, "TP / SL"), btn("ssell", k, "Sell all", "dn"))}</div>`; };
  const oc = o => `<div class="a3-pc"><div class="a3-ph2">${pic(o.sym)}<div class="a3-pt"><b>${esc(lbl(o.sym))}</b><span><i class="a3-tag ${o.side === "buy" ? "up" : "down"}">Limit ${o.side === "buy" ? "Buy" : "Sell"}</i></span></div><div class="a3-pp"><b class="num">${fp(o.price)}</b><small>${fp(o.qty)} qty</small></div></div>${acts(btn("scancel", o.id, "Cancel order", "dn"))}</div>`;
  const body = sub === "open" ? (hold.length ? hold.map(hc).join("") : empty("No holdings.")) : sub === "orders" ? (ord.length ? ord.map(oc).join("") : empty("No open orders.")) :
    (hist.length ? hist.slice(0, 30).map(h => histRow("chart", `${esc(h.side === "buy" ? "Buy" : "Sell")} ${esc(lbl(h.sym))}`, `${fp(h.qty)} @ ${fp(h.price)} · ${tstr(h.ts)}`, n2((h.qty || 0) * (h.price || 0)))).join("") : empty("No history yet."));
  return subSeg([["open", "Holdings", hold.length], ["orders", "Orders", ord.length], ["hist", "History"]], sub) + body;
}
function spotTpSl(k){
  const h = readS().spot.hold[k]; if (!h) return;
  U.sheet("TP / SL", `<div class="a2-sh"><div class="a2-g2">${field("Take profit price", "a3tp", h.tp || "", {step:"any", min:0, ph:"None"})}${field("Stop loss price", "a3sl", h.sl || "", {step:"any", min:0, ph:"None"})}</div><button class="a2-b pri" id="a3go">Save</button></div>`, el => {
    el.querySelector("#a3go").onclick = () => { const tp = parseFloat(el.querySelector("#a3tp").value) || null, sl = parseFloat(el.querySelector("#a3sl").value) || null;
      run(() => { const q = store.s.spot.hold[k]; if (!q) return; q.tp = tp || undefined; q.sl = sl || undefined; q.sym = q.sym || k + "USDT"; }); U.closeLayer(); toast("Updated", "ok"); redraw(); };
  });
}
/* ----- binary ----- */
function pBin(s){
  const pos = s.positions || [], hist = s.history || [], sub = SUB === "hist" ? "hist" : "open";
  const c = p => { const mark = px(p.sym, p.entry), win = p.dir === "up" ? mark > p.entry : mark < p.entry, left = Math.max(0, p.exp - Date.now());
    return `<div class="a3-pc"><div class="a3-ph2">${pic(p.sym)}<div class="a3-pt"><b>${esc(lbl(p.sym))}</b><span><i class="a3-tag ${p.dir === "up" ? "up" : "down"}">${p.dir === "up" ? "Up" : "Down"}</i> ${Math.ceil(left / 1000)}s left</span></div><div class="a3-pp"><b class="num">${n2(p.amount)}</b><small class="${mark === p.entry ? "" : win ? "up" : "down"}">${mark === p.entry ? "Even" : win ? "Winning" : "Losing"}</small></div></div>
      <div class="a3-g">${tile("Entry", fp(p.entry))}${tile("Now", fp(mark))}${tile("Payout", "x" + (1 + (p.payout ?? .92)).toFixed(2))}</div>${acts(btn("bclose", p.id, "Close", "dn"))}</div>`; };
  const body = sub === "open" ? (pos.length ? pos.map(c).join("") : empty("No open trades.")) : (hist.length ? hist.slice(0, 30).map(h => histRow("clock", `${esc(lbl(h.sym))} ${h.dir === "up" ? "Up" : "Down"}`, `${esc(h.result || "")} · ${tstr(h.closed || h.open)}`, sgn(h.profit || 0), cls(h.profit))).join("") : empty("No history yet."));
  return subSeg([["open", "Open", pos.length], ["hist", "History"]], sub) + body;
}
function binClose(id){
  const p = readS().positions.find(x => x.id === id); if (!p) return; let mode = "refund";
  U.sheet("Close binary trade", `<div class="a2-sh"><div class="a2-box">${kv("Pair", esc(lbl(p.sym)))}${kv("Direction", p.dir === "up" ? "Up" : "Down")}${kv("Stake", n2(p.amount) + " USDT")}</div>${chips("a3m", [{v:"refund", l:"Refund stake", s:"Return the stake"}, {v:"market", l:"Settle now", s:"Win or lose at market"}], "refund", "c2")}<button class="a2-b pri" id="a3go">Close trade</button></div>`, el => {
    bindChips(el, "a3m", v => mode = v);
    el.querySelector("#a3go").onclick = () => {
      run(() => { const S = store.s, q = S.positions.find(x => x.id === id); if (!q) return; const now = Date.now(), mark = px(q.sym, q.entry), diff = mark - q.entry;
        let credit = q.amount, result = "refund"; if (mode === "market"){ if (diff === 0) result = "draw"; else if ((q.dir === "up") === (diff > 0)){ result = "win"; credit = Math.round(q.amount * (1 + (q.payout ?? .92)) * 100) / 100; } else { result = "loss"; credit = 0; } }
        S.positions = S.positions.filter(x => x.id !== id); const profit = Math.round((credit - q.amount) * 100) / 100;
        S.history.unshift(Object.assign({}, q, {exit:mark, result, profit, credit, closed:now, early:true})); store.addWallet("binary", credit, "settle");
        store.notify("Trade closed", `${lbl(q.sym)} ${q.dir === "up" ? "Up" : "Down"} ${n2(q.amount)} USDT → ${sgn(profit)} USDT`, profit >= 0 ? "ok" : "bad"); });
      U.fx && U.fx("close"); U.closeLayer(); toast("Trade closed", "ok"); redraw(); };
  });
}
/* ----- options ----- */
function pOpt(s){
  const pos = s.opt.positions || [], hist = s.opt.history || [], sub = SUB === "hist" ? "hist" : "open";
  const nm = p => `${p.base} ${p.strike} ${p.type === "call" ? "Call" : "Put"}`;
  const c = p => `<div class="a3-pc"><div class="a3-ph2">${pic(p.base + "USDT")}<div class="a3-pt"><b>${esc(nm(p))}</b><span><i class="a3-tag ${p.type === "call" ? "up" : "down"}">${p.type === "call" ? "Call" : "Put"}</i> exp ${tstr(p.exp)}</span></div><div class="a3-pp"><b class="num">${n2(p.cost)}</b><small>premium</small></div></div><div class="a3-g">${tile("Quantity", fp(p.qty))}${tile("Strike", fp(p.strike))}${tile("Spot", fp(px(p.base + "USDT", 0)))}</div>${acts(btn("oclose", p.id, "Close", "dn"))}</div>`;
  const body = sub === "open" ? (pos.length ? pos.map(c).join("") : empty("No open options.")) : (hist.length ? hist.slice(0, 30).map(h => histRow("target", esc(nm(h)), `${esc(h.result || "")} · ${tstr(h.closed)}`, sgn(h.pnl || 0), cls(h.pnl))).join("") : empty("No history yet."));
  return subSeg([["open", "Open", pos.length], ["hist", "History"]], sub) + body;
}
function optClose(id){
  const p = readS().opt.positions.find(x => x.id === id); if (!p) return;
  U.sheet("Close option", `<div class="a2-sh"><div class="a2-box">${kv("Contract", esc(`${p.base} ${p.strike} ${p.type}`))}${kv("Premium paid", n2(p.cost) + " USDT")}</div>${field("Payout to user (USDT)", "a3pa", p.cost, {step:"any", min:0})}<button class="a2-b pri" id="a3go">Close option</button></div>`, el => {
    el.querySelector("#a3go").onclick = () => { const v = parseFloat(el.querySelector("#a3pa").value); if (!(v >= 0)) return toast("Enter the payout", "bad");
      run(() => { const o = store.s.opt, q = o.positions.find(x => x.id === id); if (!q) return; o.positions = o.positions.filter(x => x.id !== id); o.history.unshift(Object.assign({}, q, {result:"Closed", payout:v, pnl:v - q.cost, closed:Date.now()})); store.addWallet("options", v, "option");
        store.notify("Option closed", `${q.base} ${q.strike} ${q.type} closed for ${n2(v)} USDT`, "info"); });
      U.closeLayer(); toast("Option closed", "ok"); redraw(); };
  });
}
/* ----- earn ----- */
function pEarn(s){
  const L = (s.earn && s.earn.locked) || [], vb = +(s.vault && s.vault.bal) || 0, now = Date.now();
  return `<div class="a3-g3">${tile("Flexible balance", n2(vb) + " USDT")}${tile("Locked plans", String(L.filter(x => !x.flex).length))}${tile("Wallet", n2(bal("earn")) + " USDT")}</div>` +
    (L.length ? L.map(x => { const acc = x.amount * x.apr * Math.min(now - x.start, x.days * 864e5) / 31536e6; return `<div class="a3-pc"><div class="a3-ph2"><div class="a3-pt"><b>${esc(x.coin || "USDT")} ${x.flex ? "Flexible" : x.days + "D locked"}</b><span>APR ${n2((x.apr || 0) * 100)}% · since ${dstr(x.start)}</span></div><div class="a3-pp"><b class="num">${n2(x.amount)}</b><small class="up">+${n2(acc)}</small></div></div></div>`; }).join("") : empty("No Earn subscriptions."));
}
/* ----- money game / prediction (read) ----- */
function pGame(){
  const d = racerD(), w = d.bets.filter(b => b.win).length;
  return `<div class="a3-g3">${tile("Bets", n0(d.bets.length))}${tile("Wins", n0(w))}${tile("Races", n0(d.races.length))}</div>` +
    (d.bets.length ? d.bets.slice(-15).reverse().map(b => histRow("car", `${n2(b.amount)} USDT, car ${esc(b.car)}/${esc(b.cars)}`, `${esc(b.mode || "")} x${esc(b.mult ?? "")} · ${b.t ? tstr(b.t) : ""}`, b.win ? "+" + n2((+b.payout || 0) - (+b.amount || 0)) : "-" + n2(b.amount), b.win ? "up" : "down")).join("") : empty("No bets yet."));
}
function pPred(){
  const d = predD(), row = (o, ic, t) => histRow(ic, esc(o.title || o.market || o.q || o.sym || o.id || t), esc(o.side || o.dir || o.type || o.status || ""), n2(amt(o)));
  return `<div class="a3-g3">${tile("Orders", n0(d.orders.length))}${tile("Positions", n0(d.positions.length))}${tile("History", n0(d.history.length))}</div>` +
    (d.orders.length ? `<div class="a2-lbl">Open orders</div>` + d.orders.slice(-10).reverse().map(o => row(o, "chip", "Order")).join("") : "") +
    (d.positions.length ? `<div class="a2-lbl">Positions</div>` + d.positions.slice(-10).reverse().map(o => row(o, "trade", "Position")).join("") : "") +
    (d.history.length ? `<div class="a2-lbl">History</div>` + d.history.slice(-10).reverse().map(o => row(o, "flag", "Trade")).join("") : "") + (d.orders.length + d.positions.length + d.history.length ? "" : empty("No prediction activity yet."));
}
function pCfd(){
  if (!window.CFD) return empty("The CFD module is not loaded.");
  const sub = SUB === "hist" ? "hist" : "open"; let pos = [], hist = [];
  try { pos = peek(() => CFD.positions()); hist = peek(() => CFD.history()); } catch {}
  const c = p => `<div class="a3-pc"><div class="a3-ph2">${pic(p.sym)}<div class="a3-pt"><b>${esc(p.sym)}</b><span><i class="a3-tag ${p.side === "buy" ? "up" : "down"}">${p.side === "buy" ? "Buy" : "Sell"} ${fp(p.lots)} lot</i></span></div><div class="a3-pp"><b class="num ${cls(p.pnl)}">${sgn(p.pnl)}</b><small class="${cls(p.roi)}">${pc(p.roi)}</small></div></div>
    <div class="a3-g">${tile("Entry", fp(p.entry))}${tile("Price", fp(p.price))}${tile("Margin", n2(p.margin))}${tile("TP / SL", `${p.tp ? fp(p.tp) : "-"} / ${p.sl ? fp(p.sl) : "-"}`)}</div>${acts(btn("cmod", p.id, "Modify"), btn("cclose", p.id, "Close", "dn"))}</div>`;
  const body = sub === "open" ? (pos.length ? pos.map(c).join("") : empty("No open CFD positions.")) : (hist.length ? hist.slice(0, 30).map(h => histRow("candle", `${esc(h.sym)} ${h.side === "buy" ? "Buy" : "Sell"} ${fp(h.lots)} lot`, tstr(h.closed), sgn(h.pnl || 0), cls(h.pnl))).join("") : empty("No history yet."));
  return subSeg([["open", "Positions", pos.length], ["hist", "History"]], sub) + body;
}
function cfdModify(id){
  const p = peek(() => CFD.positions()).find(x => x.id === id); if (!p) return;
  U.sheet("Modify CFD position", `<div class="a2-sh"><div class="a2-box">${kv("Symbol", esc(p.sym))}${kv("Side", p.side === "buy" ? "Buy" : "Sell")}${kv("Entry", fp(p.entry))}</div><div class="a2-g2">${field("Take profit price", "a3tp", p.tp || "", {step:"any", min:0, ph:"None"})}${field("Stop loss price", "a3sl", p.sl || "", {step:"any", min:0, ph:"None"})}</div><button class="a2-b pri" id="a3go">Save changes</button></div>`, el => {
    el.querySelector("#a3go").onclick = () => { const ok = run(() => CFD.modify(id, {tp:parseFloat(el.querySelector("#a3tp").value) || 0, sl:parseFloat(el.querySelector("#a3sl").value) || 0})); if (!ok) return; U.closeLayer(); toast("Position updated", "ok"); redraw(); };
  });
}
function panelHtml(s){
  const pr = PRODS.find(x => x.k === TAB) || PRODS[0];
  const strip = `<div class="a2-chips row a3-strip" id="a3tabs" role="tablist">${PRODS.map(p => `<button type="button" role="tab" aria-selected="${p.k === TAB}" class="a2-chip ${p.k === TAB ? "on" : ""}" data-v="${p.k}"><i class="a3-ti">${pIc(p.ic)}</i><span>${p.l}</span></button>`).join("")}</div>`;
  const head = `<div class="a3-wb"><span class="a2-hi">${pIc(pr.ic, 18)}</span><div><b>${pr.l} wallet</b><small class="num">${n2(bal(pr.w))} USDT</small></div>${tipBtn("prod")}<button class="a2-b sm" data-adjw="${pr.w}">${I("plus", 14)} Balance</button></div>`;
  const body = TAB === "futures" ? pFut(s) : TAB === "spot" ? pSpot(s) : TAB === "binary" ? pBin(s) : TAB === "options" ? pOpt(s) : TAB === "earn" ? pEarn(s) : TAB === "game" ? pGame() : TAB === "predict" ? pPred() : pCfd();
  return strip + head + `<div class="a3-body">${body}</div>`;
}
let ROOT = null, onChange = null;
function redraw(){ if (!ROOT) return; const el = ROOT.querySelector("#a3p"); if (!el) return; const st = el.scrollLeft; el.innerHTML = panelHtml(readS()); const tb = el.querySelector("#a3tabs"); try { const on = tb.querySelector(".on"); on && on.scrollIntoView({block:"nearest", inline:"center"}); } catch {} bindPanel(); onChange && onChange(); }
function bindPanel(){
  const el = ROOT.querySelector("#a3p");
  el.querySelectorAll("#a3tabs .a2-chip").forEach(b => b.onclick = () => { TAB = b.dataset.v; SUB = "open"; U.buzz && U.buzz(8); redraw(); });
  el.querySelectorAll("[data-sub]").forEach(b => b.onclick = () => { SUB = b.dataset.sub; redraw(); });
  el.querySelectorAll("[data-adjw]").forEach(b => b.onclick = () => X.adjustSheet(b.dataset.adjw));
  el.querySelectorAll("[data-tip=prod]").forEach(b => b.onclick = () => { const p = PRODS.find(x => x.k === TAB); X.showTip(p.tip[0], p.tip[1]); });
  el.querySelectorAll("[data-act]").forEach(b => b.onclick = () => act(b.dataset.act, b.dataset.id));
}
async function act(a, id){
  if (a === "fmod") return futModify(id);
  if (a === "fclose") return futClose(id);
  if (a === "fcancel"){ if (!await U.confirmBox("Cancel order?", "The reserved margin is refunded.", "Cancel order", true)) return; run(() => E_() && E_().cancelOrder(id)); toast("Order cancelled", "ok"); return redraw(); }
  if (a === "stpsl") return spotTpSl(id);
  if (a === "ssell"){
    const h = readS().spot.hold[id]; if (!h) return;
    if (!await U.confirmBox("Sell holding?", `Sell all ${fp(h.qty)} ${id} at market?`, "Sell", true)) return;
    const r = run(() => { if (!window.SPOT) return {err:"Spot is not ready"}; const q = store.s.spot.hold[id]; return SPOT.place({sym:q.sym || id + "USDT", side:"sell", type:"market", qty:q.qty}); });
    if (r && r.err) return toast(r.err, "bad"); toast("Sold at market", "ok"); return redraw();
  }
  if (a === "scancel"){
    if (!await U.confirmBox("Cancel order?", "A buy order's reserved funds are refunded.", "Cancel order", true)) return;
    run(() => { const sp = store.s.spot, o = sp.orders.find(x => x.id === id); if (!o) return; sp.orders = sp.orders.filter(x => x.id !== id); if (o.side === "buy") store.addWallet("spot", o.qty * o.price, "spot"); });
    toast("Order cancelled", "ok"); return redraw();
  }
  if (a === "cmod") return cfdModify(id);
  if (a === "cclose"){ if (!await U.confirmBox("Close CFD position?", "Closes at the current market price.", "Close", true)) return; const r = run(() => CFD.close(id)); if (r) redraw(); return; }
  if (a === "bclose") return binClose(id);
  if (a === "oclose") return optClose(id);
}
function mountPanel(root, change){
  ROOT = root; onChange = change || null;
  root.querySelector("#a3p").innerHTML = panelHtml(readS()); bindPanel();
}
/* live refresh of marks while the panel is open */
let liveT = 0;
const startLive = () => { clearInterval(liveT); liveT = setInterval(() => { if (!ROOT || !ROOT.isConnected || document.querySelector(".sheet.show,#sheet.show")) return; if (["futures", "spot", "binary", "options", "cfd"].includes(TAB)) redraw(); }, 3000); };
const stopLive = () => { clearInterval(liveT); ROOT = null; onChange = null; };
X.TIPS.prod = ["Wallet balance", "<p>The balance of this product's wallet. Use <b>Balance</b> to add or deduct funds. The user receives a notification.</p>"];

/* ================= user dashboard ================= */
V.user = id => {
  const u = A.accounts().find(x => x.id === id);
  if (!u) return {title:"User", back:"#/admin/users", html:empty("User not found.")};
  const lg = A.logins().filter(l => l.uid === u.id).slice(0, 6), kyc = u.kyc || "verified";
  const total = () => totalOf();
  const tiles = () => WK.map(k => `<button class="a3-wt" data-wt="${k}"><span class="a2-wi">${wic(k, 18)}</span><small>${esc(wname(k))}</small><b class="num">${n2(bal(k))}</b></button>`).join("");
  const html = `<div class="a2-card a3-uh"><span class="a2-av big">${esc((u.name || "?")[0].toUpperCase())}</span><div class="a3-un"><b>${esc(u.name)}</b><small>${esc(u.email)}</small><small>Joined ${dstr(u.createdAt)}</small></div><span class="a2-role ${esc(u.role)}">${esc(u.role)}</span></div>
    <section class="a2-card a3-tot"><div class="a3-tt"><small>Total assets (${X.view === "real" ? "Real" : "Demo"})</small><b class="num" id="a3tot">${n2(total())}</b><em>USDT</em></div><div class="a3-wts" id="a3wts">${tiles()}</div><div class="a2-btns"><button class="a2-b pri" data-adj>${I("plus", 16)} Add or deduct balance</button></div></section>
    <section class="a2-card">${secH(I("trade", 18), "Trading control", "usertrade")}<div id="a3p"></div></section>
    ${card(secH(I("shield", 18), "Account", null), `<div class="a2-lbl">KYC status</div>${chips("a3kyc", [{v:"verified", l:"Verified"}, {v:"pending", l:"Pending"}, {v:"rejected", l:"Rejected"}], kyc)}${kv("Referral used", esc(u.ref || "None"))}${kv("Status", `<span class="${u.blocked ? "down" : "up"}">${u.blocked ? "Blocked" : "Active"}</span>`)}
      <div class="a2-btns col">${u.role === "admin" ? "" : `<button class="a2-b ${u.blocked ? "pri" : "dng"}" data-blk>${u.blocked ? "Unblock user" : "Block user"}</button>`}<button class="a2-b" data-pw>Reset password</button><button class="a2-b" data-rst>Reset ${X.view === "real" ? "Real" : "Demo"} account</button></div>`)}
    ${card(secH(I("users", 18), "Login history", null), lg.length ? lg.map(l => X.actRow("users", esc(l.dev || "Browser"), esc(l.how || "Password"), tstr(l.t))).join("") : empty("No logins recorded."))}`;
  X.TIPS.usertrade = ["Trading control", "<p>Everything this account has open in each product. Tap a product tab, then <b>Modify</b> to change TP / SL or leverage, or <b>Close</b> to close it. Changes are saved to the account and the user is notified.</p>"];
  return {title:u.name || "User", back:"#/admin/users", html, mount(r){
    const q = x => r.querySelector(x), sv = fn => { const l = A.accounts(), x = l.find(z => z.id === id); fn(x); A.saveAccounts(l); };
    const upd = () => { q("#a3tot").textContent = n2(total()); q("#a3wts").innerHTML = tiles(); q("#a3wts").querySelectorAll("[data-wt]").forEach(b => b.onclick = () => X.adjustSheet(b.dataset.wt)); };
    mountPanel(r, upd); startLive(); upd();
    q("[data-adj]").onclick = () => X.adjustSheet();
    bindChips(r, "a3kyc", v => { sv(x => x.kyc = v); toast("KYC updated", "ok"); });
    const b = q("[data-blk]"); if (b) b.onclick = () => { sv(x => x.blocked = !x.blocked); toast("Status updated", "ok"); App.route(); };
    q("[data-pw]").onclick = async () => { if (!await U.confirmBox("Reset password?", "The password becomes Temp1234 for this user.", "Reset", true)) return; const h = await A.hash(u.email, "Temp1234"); sv(x => x.passHash = h); toast("Password reset to Temp1234", "ok"); };
    q("[data-rst]").onclick = async () => {
      if (!await U.confirmBox("Reset account?", "Wallets, positions and history of this account are reset.", "Reset", true)) return;
      if (X.live()) store.reset(); else { try { localStorage.removeItem(X.view === "real" ? "novatrade_real_v1" : "novatrade_v1"); } catch {} }
      toast("Account reset", "ok"); App.route();
    };
  }, unmount: stopLive};
};

/* ================= trading section ================= */
const gameForm = () => { const a = A.adminSettings().racer, W = [10, 20, 30, 40, 50, 60, 70, 80], cur = a.playerWinPct == null ? "" : String(a.playerWinPct);
  return tog("a3re", a.enabled, "Game enabled", "Players can open Money Game") + `<div class="a2-g2">${field("Min bet", "a3mn", a.minBet, {min:0, step:"any"})}${field("Max bet", "a3mx", a.maxBet, {min:1, step:"any"})}${field("Odds, 2 cars (x)", "a3o2", a.odds2, {min:1, step:"any"})}${field("Odds, 3 cars (x)", "a3o3", a.odds3, {min:1, step:"any"})}</div>
    <div class="a2-lbl">Player win chance</div>${chips("a3pw", [{v:"", l:"Fair"}, ...W.map(v => ({v:String(v), l:v + "%"})), {v:"custom", l:"Custom"}], W.map(String).includes(cur) || cur === "" ? cur : "custom")}<div id="a3pcw" class="${cur !== "" && !W.map(String).includes(cur) ? "" : "hide"}">${field("Custom win % (0-100)", "a3pc", a.playerWinPct ?? "", {min:0, step:1})}</div><button class="a2-b pri" id="a3sg">Save Money Game settings</button>`; };
const predForm = () => { const a = A.adminSettings().predict; return tog("a3pe", a.enabled, "Prediction enabled", "Players can open Prediction markets") + `<div class="a2-g2">${field("Max bet (USDT)", "a3pm", a.maxBet, {min:1, step:"any"})}${field("Fee %", "a3pf", a.feePct, {min:0, step:"any"})}</div><button class="a2-b pri" id="a3sp">Save Prediction settings</button>`; };
const binForm = () => { const a = A.adminSettings(), pin = (g, l) => field(l + " payout %", "a3p_" + g, a.payout[g] ?? "", {min:0, step:1, ph:"Auto"}); return field("Max bet (USDT per trade)", "a3max", a.maxBet, {min:1, step:1}) + `<p class="a2-hint">Payout override per market type. Leave empty for automatic payout.</p><div class="a2-g3">${pin("crypto", "Crypto")}${pin("forex", "Forex")}${pin("stocks", "Stocks")}</div><button class="a2-b pri" id="a3sb">Save binary settings</button>`; };
V.trading = tab => {
  if (tab && PRODS.some(p => p.k === tab)){ TAB = tab; SUB = "open"; }
  const sets = {binary:["Binary settings", binForm], game:["Money Game settings", gameForm], predict:["Prediction settings", predForm]};
  const html = `<section class="a2-card">${secH(I("trade", 18), "Trading", "trading")}<div class="a3-kp" id="a3kp"></div><div id="a3p"></div></section><div id="a3set"></div>`;
  return {title:"Trading", html, mount(r){
    const q = x => r.querySelector(x);
    const kp = () => { const s = readS(); q("#a3kp").innerHTML = `<div class="a2-kpis">${kpi("Futures open", n0(s.fut.positions.length), "layers")}${kpi("Binary open", n0((s.positions || []).length), "clock")}${kpi("Spot holdings", n0(Object.keys(s.spot.hold || {}).length), "chart")}${kpi("Options open", n0((s.opt.positions || []).length), "target")}</div>`; };
    const drawSet = () => { const d = sets[TAB], box = q("#a3set"); if (!d){ box.innerHTML = ""; return; } box.innerHTML = `<section class="a2-card">${secH(I("cog", 18), d[0], null)}${d[1]()}</section>`; bindSettings(box); };
    mountPanel(r, () => { kp(); }); kp(); drawSet(); startLive();
    /* re-draw the settings card when the product tab changes */
    q("#a3p").addEventListener("click", e => { if (e.target.closest("#a3tabs .a2-chip")) setTimeout(drawSet, 0); });
  }, unmount: stopLive};
};
function bindSettings(box){
  const q = x => box.querySelector(x), cur = () => A.adminSettings();
  const sb = q("#a3sb"); if (sb) sb.onclick = () => { const mx = parseFloat(q("#a3max").value); if (!(mx >= 1)) return toast("Max bet must be at least 1", "bad"); const pay = {}; ["crypto", "forex", "stocks"].forEach(g => { const v = parseFloat(q("#a3p_" + g).value); pay[g] = v > 0 ? Math.min(200, v) : null; }); A.saveAdmin({...cur(), maxBet:mx, payout:pay}); toast("Binary settings saved", "ok"); };
  const sg = q("#a3sg"); if (sg){ let pw = q("#a3pw .on") ? q("#a3pw .on").dataset.v : ""; bindChips(box, "a3pw", v => { pw = v; q("#a3pcw").classList.toggle("hide", v !== "custom"); });
    sg.onclick = () => { const mn = parseFloat(q("#a3mn").value), mx = parseFloat(q("#a3mx").value), o2 = parseFloat(q("#a3o2").value), o3 = parseFloat(q("#a3o3").value);
      if (!(mn >= 0) || !(mx >= 1) || mn > mx) return toast("Check min and max bet", "bad"); if (!(o2 >= 1) || !(o3 >= 1)) return toast("Odds must be at least 1", "bad");
      let w = null; if (pw === "custom"){ w = parseFloat(q("#a3pc").value); if (!(w >= 0 && w <= 100)) return toast("Win % must be 0-100", "bad"); } else if (pw !== "") w = +pw;
      A.saveAdmin({...cur(), racer:{enabled:q("#a3re").checked, minBet:mn, maxBet:mx, odds2:o2, odds3:o3, playerWinPct:w}}); toast("Money Game settings saved", "ok"); }; }
  const sp = q("#a3sp"); if (sp) sp.onclick = () => { const mx = parseFloat(q("#a3pm").value), fee = parseFloat(q("#a3pf").value); if (!(mx >= 1)) return toast("Max bet must be at least 1", "bad"); if (!(fee >= 0 && fee <= 50)) return toast("Fee must be 0-50%", "bad");
    A.saveAdmin({...cur(), predict:{...cur().predict, enabled:q("#a3pe").checked, maxBet:mx, feePct:fee}}); toast("Prediction settings saved", "ok"); };
}

/* ================= HD wallet ================= */
const KH = "nt_hdw", KMAP = "nt_hdw_map", KADR = "nt_hdw_addrs", PBK = 250000;
const b64 = u8 => { let s = ""; u8.forEach(c => s += String.fromCharCode(c)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function pinKey(pin, salt, it){ const m = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]); return crypto.subtle.deriveKey({name:"PBKDF2", salt, iterations:it, hash:"SHA-256"}, m, {name:"AES-GCM", length:256}, false, ["encrypt", "decrypt"]); }
async function seal(seed, pin){ const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), k = await pinKey(pin, salt, PBK);
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM", iv}, k, new TextEncoder().encode(seed))); return {v:1, m:"seed", it:PBK, salt:b64(salt), iv:b64(iv), ct:b64(ct)}; }
async function unseal(rec, pin){ const k = await pinKey(pin, unb64(rec.salt), rec.it || PBK); return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM", iv:unb64(rec.iv)}, k, unb64(rec.ct))); }
let ETH = null;
function loadEthers(){
  if (window.ethers) return Promise.resolve(window.ethers);
  return ETH || (ETH = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.umd.min.js"; s.crossOrigin = "anonymous";
    s.onload = () => window.ethers ? res(window.ethers) : rej(new Error("Wallet library failed to load")); s.onerror = () => { ETH = null; rej(new Error("Could not load the wallet library. Check your connection.")); }; document.head.appendChild(s); }));
}
let SEED = null, lockT = 0;
const lock = () => { SEED = null; clearTimeout(lockT); };
const arm = () => { clearTimeout(lockT); lockT = setTimeout(() => { lock(); if (document.querySelector("[data-hdw]")) V_hdwDraw && V_hdwDraw(); }, 5 * 60 * 1000); };
let V_hdwDraw = null;
const rec = () => rd(KH, null);
const addrs = () => rd(KADR, {}) || {};
const cleanSeed = s => String(s || "").toLowerCase().trim().split(/\s+/).join(" ");
async function nodeFor(){
  const eth = await loadEthers(), r = rec(); if (!r) throw new Error("No wallet set up");
  if (r.m === "xpub"){ let n = eth.HDNodeWallet.fromExtendedKey(r.xpub); if (n.depth === 3) n = n.deriveChild(0); else if (n.depth !== 4) throw new Error("xpub must be at m/44'/60'/0' or m/44'/60'/0'/0"); return n; }
  if (!SEED) throw new Error("Locked");
  return eth.HDNodeWallet.fromPhrase(SEED, undefined, "m/44'/60'/0'/0");
}
async function addrAt(i){ const n = await nodeFor(); return n.deriveChild(i).address; }
function hdwView(root){
  const r = rec(), box = root.querySelector("[data-hdw]"); const q = x => box.querySelector(x);
  const users = A.accounts().filter(u => u.role !== "admin"), map = rd(KMAP, {}) || {}, ad = addrs();
  const unlocked = r && (r.m === "xpub" || !!SEED);
  let h = "";
  if (!r){
    h = `<div class="a2-lbl">Choose how to connect your wallet</div>${chips("a3hm", [{v:"xpub", l:"xpub (watch-only)", s:"Recommended. No private key stored"}, {v:"seed", l:"Seed phrase", s:"Encrypted with your PIN"}], "xpub", "c2")}
      <div id="a3hxp">${field("Extended public key (xpub)", "a3xp", "", {type:"text", ph:"xpub... at m/44'/60'/0'"})}<p class="a2-hint">Create the xpub in your own wallet at path m/44'/60'/0' (or m/44'/60'/0'/0). Addresses are derived from it. Funds can only be moved from your wallet.</p></div>
      <div id="a3hsd" class="hide"><label class="a2-f"><span>Seed phrase (12 or 24 words)</span><textarea id="a3sd" class="a3-sec" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="word1 word2 ..."></textarea></label>
        ${field("Set a PIN (min 6 characters)", "a3pn", "", {type:"password", ph:"PIN"})}${field("Repeat PIN", "a3pn2", "", {type:"password", ph:"PIN"})}</div>
      <div class="a2-err" id="a3er"></div><button class="a2-b pri" id="a3save">${I("lock", 16)} Save wallet</button>`;
  } else if (!unlocked){
    h = `${kv("Mode", "Seed phrase (encrypted)")}${field("PIN", "a3pu", "", {type:"password", ph:"Enter PIN"})}<div class="a2-err" id="a3er"></div><div class="a2-btns"><button class="a2-b pri" id="a3unl">${I("lock", 16)} Unlock</button><button class="a2-b dng" id="a3rm">Remove wallet</button></div>`;
  } else {
    h = `${kv("Mode", r.m === "xpub" ? "xpub (watch-only)" : "Seed phrase, unlocked for 5 min")}${kv("Path", "m/44'/60'/0'/0/<index>")}${kv("Networks", "BEP20 / ERC20 (same address)")}
      <div class="a2-lbl">Users</div>${users.length ? users.map(u => { const a = ad[u.id]; return `<div class="a3-ad"><div class="a3-adh"><b>${esc(u.name)}</b><small>${a ? "Index " + a.i : "No address yet"}</small></div>${a ? `<div class="a2-addr"><span>${esc(a.addr)}</span><button class="a2-ib sm" data-cp="${esc(a.addr)}" aria-label="Copy address">${I("copy", 14)}</button></div>` : `<button class="a2-b sm" data-gen="${esc(u.id)}">Generate address</button>`}</div>`; }).join("") : empty("No user accounts yet.")}
      <div class="a2-lbl">Derive by index</div><div class="a3-der">${field("Index", "a3ix", 0, {step:1, min:0})}<button class="a2-b sm" id="a3dv">Derive</button></div><div class="a2-addr hide" id="a3dr"><span></span><button class="a2-ib sm" data-cp="" aria-label="Copy address">${I("copy", 14)}</button></div>
      <div class="a2-err" id="a3er"></div><div class="a2-btns">${r.m === "seed" ? `<button class="a2-b" id="a3lk">${I("lock", 16)} Lock now</button>` : ""}<button class="a2-b dng" id="a3rm">Remove wallet</button></div>`;
  }
  box.innerHTML = h;
  const err = t => { const e = q("#a3er"); if (e) e.textContent = t || ""; };
  const cps = () => box.querySelectorAll("[data-cp]").forEach(b => b.onclick = () => U.copyText ? U.copyText(b.dataset.cp, "Address copied") : 0);
  cps();
  if (!r){
    bindChips(box, "a3hm", v => { q("#a3hxp").classList.toggle("hide", v !== "xpub"); q("#a3hsd").classList.toggle("hide", v !== "seed"); });
    q("#a3save").onclick = async () => {
      const mode = q("#a3hm .on").dataset.v; err(); const btn = q("#a3save"); btn.disabled = true;
      try {
        const eth = await loadEthers();
        if (mode === "xpub"){ const x = q("#a3xp").value.trim(); let n; try { n = eth.HDNodeWallet.fromExtendedKey(x); } catch { throw new Error("That is not a valid xpub"); } if (n.privateKey) throw new Error("That is a private key. Paste the public key (xpub) only."); if (n.depth !== 3 && n.depth !== 4) throw new Error("xpub must be at m/44'/60'/0' or m/44'/60'/0'/0"); wr(KH, {v:1, m:"xpub", xpub:x}); }
        else {
          const seed = cleanSeed(q("#a3sd").value), pin = q("#a3pn").value; if (!/^(\S+ ){11}\S+$|^(\S+ ){23}\S+$/.test(seed)) throw new Error("Seed must be 12 or 24 words");
          if (!eth.Mnemonic.isValidMnemonic(seed)) throw new Error("Invalid seed phrase (check the words)"); if (pin.length < 6) throw new Error("PIN must be at least 6 characters"); if (pin !== q("#a3pn2").value) throw new Error("PINs do not match");
          if (!(window.crypto && crypto.subtle)) throw new Error("Secure storage is not available here (HTTPS required)");
          wr(KH, await seal(seed, pin)); q("#a3sd").value = ""; q("#a3pn").value = ""; q("#a3pn2").value = ""; SEED = seed; arm();
        }
        toast("Wallet saved", "ok"); hdwView(root);
      } catch (e) { err(e.message || "Could not save"); btn.disabled = false; }
    };
  } else if (!unlocked){
    const go = async () => { err(); const b = q("#a3unl"); b.disabled = true; try { SEED = await unseal(r, q("#a3pu").value); await loadEthers(); arm(); hdwView(root); } catch (e) { SEED = null; err(/ethers|library/i.test(e.message || "") ? e.message : "Wrong PIN"); b.disabled = false; U.buzz && U.buzz("err"); } };
    q("#a3unl").onclick = go; q("#a3pu").onkeydown = e => { if (e.key === "Enter") go(); };
  } else {
    box.querySelectorAll("[data-gen]").forEach(b => b.onclick = async () => { err(); try { const m = rd(KMAP, {}) || {}, used = Object.values(m); const i = used.length ? Math.max(...used) + 1 : 0, addr = await addrAt(i); m[b.dataset.gen] = i; wr(KMAP, m); const a = addrs(); a[b.dataset.gen] = {i, addr}; wr(KADR, a); arm(); hdwView(root); } catch (e) { err(e.message); } });
    q("#a3dv").onclick = async () => { err(); try { const i = Math.max(0, Math.floor(+q("#a3ix").value || 0)), a = await addrAt(i), d = q("#a3dr"); d.classList.remove("hide"); d.querySelector("span").textContent = a; d.querySelector("[data-cp]").dataset.cp = a; cps(); arm(); } catch (e) { err(e.message); } };
    const lk = q("#a3lk"); if (lk) lk.onclick = () => { lock(); toast("Locked", "ok"); hdwView(root); };
  }
  const rm = q("#a3rm"); if (rm) rm.onclick = async () => { if (!await U.confirmBox("Remove wallet?", "The encrypted seed / xpub is deleted from this device. Make sure you have your seed backed up. Generated addresses are kept.", "Remove", true)) return; lock(); try { localStorage.removeItem(KH); } catch {} toast("Wallet removed", "ok"); hdwView(root); };
  V_hdwDraw = () => hdwView(root);
}
V.hdw = () => {
  const html = `<section class="a2-card a3-warn"><div class="a2-h"><span class="a2-hi dn">${I("shield", 18)}</span><span class="a2-ht">Read this first</span></div>
    <ul><li>Anyone with the seed phrase controls <b>all</b> funds in that wallet. Use a dedicated deposit wallet, never your main one.</li><li>The seed is encrypted on this device with your PIN (AES-256-GCM, PBKDF2) and is never sent anywhere or shown again. If you forget the PIN it cannot be recovered, so keep your backup.</li><li>A compromised phone or browser can still be dangerous. <b>xpub (watch-only)</b> is safer: it only creates addresses and holds no private key.</li></ul></section>
    <section class="a2-card">${secH(I("key", 18), "HD wallet", "hdw")}<div data-hdw></div></section>
    <section class="a2-card">${secH(I("info", 18), "How deposits work", null)}<p class="a2-hint">Each user gets one deposit address (EVM: BEP20 / ERC20). When funds arrive, approve the deposit in Requests, or switch Auto-credit on in Finance.</p><a class="a2-link" href="#/admin/requests">${I("inbox", 16)}<span>Open requests</span>${I("chev", 14)}</a></section>`;
  return {title:"HD Wallet", noMode:true, html, mount(r){ hdwView(r); loadEthers().catch(() => {}); }, unmount(){ lock(); V_hdwDraw = null; }};
};

/* ================= AI assistant ================= */
const KAI = "nt_ai_cfg", KUS = "nt_ai_usage";
const MODELS = [{v:"gemini-flash-latest", l:"Flash (latest)", s:"Default"}, {v:"gemini-2.5-flash", l:"2.5 Flash", s:"Fast"}, {v:"gemini-2.5-pro", l:"2.5 Pro", s:"Smartest"}];
const aiCfg = () => Object.assign({key:"", model:"gemini-flash-latest", system:"", rules:"", cap:250}, rd(KAI, {}) || {});
const aiUse = () => { const u = rd(KUS, null), d = new Date().toISOString().slice(0, 10); return u && u.date === d ? u : {date:d, req:0, tok:0}; };
const mask = k => k ? k.slice(0, 4) + "•".repeat(Math.max(4, Math.min(12, k.length - 8))) + k.slice(-4) : "";
X.TIPS.aikey = ["API key", "<p>Your Gemini API key. It is stored only on this device and is never shown to users. Remove it any time and the assistant falls back to built-in answers.</p>"];
X.TIPS.aiuse = ["Usage today", "<p>Requests and tokens used today on this device. Free-tier limits differ by model (requests per minute and per day). Check Google AI Studio, Usage, for the exact remaining quota.</p>"];
X.TIPS.airules = ["Instructions and rules", "<p><b>Instructions</b> shape the tone and role. <b>Rules</b> are hard limits that the assistant must never break; they are sent first in every request.</p>"];
V.ai = () => {
  let editing = false;
  const draw = () => {
    const c = aiCfg(), u = aiUse(), pct = Math.min(100, Math.round(u.req / Math.max(1, c.cap) * 100));
    return card(secH(I("key", 18), "API key", "aikey"), c.key && !editing ? `${kv("Key", `<span class="mono">${esc(mask(c.key))}</span>`)}<div class="a2-btns"><button class="a2-b" id="a3chg">Change</button><button class="a2-b dng" id="a3rmk">Remove</button><button class="a2-b" id="a3tst">Test key</button></div><div class="a2-hint" id="a3tr"></div>`
      : `<p class="a2-hint">No key set. The assistant uses built-in answers until you add one.</p>${field("Gemini API key", "a3k", "", {type:"password", ph:"AIza..."})}<button class="a2-b pri" id="a3sk">Save key</button>${editing ? '<button class="a2-b" id="a3ck">Cancel</button>' : ""}`) +
      card(secH(I("ai", 18), "Default model", null), chips("a3md", MODELS, c.model, "c3")) +
      card(secH(I("pulse", 18), "Usage today", "aiuse"), `<div class="a2-kpis">${kpi("Requests", n0(u.req), "pulse")}${kpi("Tokens", n0(u.tok), "chip")}</div><div class="a3-bar"><i style="width:${pct}%"></i></div><div class="a3-bl"><span>${n0(u.req)} of ${n0(c.cap)} requests (${pct}%)</span></div>${field("Daily request limit for this meter", "a3cap", c.cap, {step:1, min:1})}
        <p class="a2-hint">Free tier: each model has its own limits per minute and per day. The remaining quota is shown in Google AI Studio under Usage, because Google does not return it to apps. Set the limit above to match your plan.</p><a class="a2-link" href="https://aistudio.google.com/usage" target="_blank" rel="noopener noreferrer">${I("eye", 16)}<span>Open AI Studio usage</span>${I("chev", 14)}</a>`) +
      card(secH(I("edit", 18), "Instructions and rules", "airules"), `<label class="a2-f"><span>Custom instructions</span><textarea id="a3sy" maxlength="2000" placeholder="e.g. Answer briefly. Use simple English.">${esc(c.system)}</textarea></label><label class="a2-f"><span>Rules (never to be broken)</span><textarea id="a3ru" maxlength="2000" placeholder="e.g. Never give financial advice. Never promise profit.">${esc(c.rules)}</textarea></label><button class="a2-b pri" id="a3sv">Save instructions and rules</button>`);
  };
  return {title:"AI Assistant", noMode:true, html:`<div id="a3ai">${draw()}</div>`, mount(r){
    const box = r.querySelector("#a3ai"), save = o => { wr(KAI, Object.assign(aiCfg(), o)); };
    const bind = () => {
      const q = x => box.querySelector(x);
      const sk = q("#a3sk"); if (sk) sk.onclick = () => { const k = q("#a3k").value.trim(); if (k.length < 20) return toast("That key looks too short", "bad"); save({key:k}); editing = false; toast("Key saved", "ok"); render(); };
      const ck = q("#a3ck"); if (ck) ck.onclick = () => { editing = false; render(); };
      const ch = q("#a3chg"); if (ch) ch.onclick = () => { editing = true; render(); };
      const rk = q("#a3rmk"); if (rk) rk.onclick = async () => { if (!await U.confirmBox("Remove API key?", "The assistant stops using it right away.", "Remove", true)) return; save({key:""}); toast("Key removed", "ok"); render(); };
      const ts = q("#a3tst"); if (ts) ts.onclick = async () => { const out = q("#a3tr"); if (!window.AI) return (out.textContent = "Assistant module is not loaded."); out.textContent = "Testing..."; ts.disabled = true; const t0 = Date.now();
        try { const a = await AI.ask("Reply OK"); out.innerHTML = `<span class="up">Key works</span> (${Date.now() - t0} ms): ${esc(String(a).slice(0, 60))}`; } catch (e) { out.innerHTML = `<span class="down">Failed:</span> ${esc(String(e.message || e).slice(0, 140))}`; } ts.disabled = false; };
      bindChips(box, "a3md", v => { save({model:v}); toast("Default model updated", "ok"); });
      q("#a3cap").onchange = e => { const v = Math.max(1, Math.round(+e.target.value || 250)); save({cap:v}); render(); };
      q("#a3sv").onclick = () => { save({system:q("#a3sy").value.trim(), rules:q("#a3ru").value.trim()}); toast("Instructions and rules saved", "ok"); };
    };
    const render = () => { box.innerHTML = draw(); bind(); };
    bind();
  }};
};
})();
