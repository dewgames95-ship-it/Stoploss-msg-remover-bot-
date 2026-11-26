/* ===== Spot trading (#/spot/SYM): engine + screen ===== */
(function(){
const {esc, ic, store, bus, money, signed, pct, toast, fmt} = U;
const FEE = 0.0002, S = () => store.s;
const spot = () => { const s = S(); if (!s.spot) s.spot = {hold:{}, orders:[], history:[]}; s.spot.hold ||= {}; s.spot.orders ||= []; s.spot.history ||= []; return s.spot; };
const baseOf = sym => sym.replace(/USDT$/, "");
/* holdings key: base for crypto/stock, full sym for forex/metal/index/commodity */
const keyOfP = (p, sym) => !p ? baseOf(sym) : (p.type === "crypto" || p.type === "stock") ? p.base : p.sym;
const keyOf = sym => keyOfP(M.get(sym), sym);
const qdP = (p, px) => p && p.type !== "crypto" ? (p.type === "stock" ? 3 : 2) : (px >= 1000 ? 5 : px >= 10 ? 4 : px >= 1 ? 2 : 0);
const qd = (px, p) => qdP(p, px);
const lbl = (p, sym) => p ? M.label(p) : baseOf(sym) + "/USDT";
const unitOf = (p, sym) => p ? (p.type === "crypto" || p.type === "stock" ? p.base : p.sym) : baseOf(sym);
const rnd = (v, d) => { const k = Math.pow(10, d); return Math.floor(v * k + 1e-9) / k; };
const locked = coin => spot().orders.filter(o => o.side === "sell" && keyOf(o.sym) === coin).reduce((a, o) => a + o.qty, 0);
const avail = coin => Math.max(0, (spot().hold[coin]?.qty || 0) - locked(coin));

/* ---------- engine ---------- */
function applyFill(o, px, fromLimit){
  const sp = spot(), coin = keyOf(o.sym), h = sp.hold[coin] ||= {qty:0, cost:0}, fee = o.qty * px * FEE;
  if (o.side === "buy"){
    h.sym = o.sym; h.qty += o.qty * (1 - FEE); h.cost += o.qty * px;
    if (o.tp) h.tp = o.tp; if (o.sl) h.sl = o.sl;
    if (!fromLimit) store.addWallet("spot", -o.qty * px, "spot");
  } else {
    const ac = h.qty > 0 ? h.cost / h.qty : 0;
    h.cost = Math.max(0, h.cost - ac * o.qty); h.qty = Math.max(0, h.qty - o.qty);
    store.addWallet("spot", o.qty * px * (1 - FEE), "spot");
  }
  if (h.qty < 1e-9){ delete sp.hold[coin]; }
  sp.history.unshift({id:U.uid(), sym:o.sym, side:o.side, price:px, qty:o.qty, fee, ts:Date.now(), type: fromLimit ? "limit" : "market"});
  sp.history = sp.history.slice(0, 200);
  store.save(); U.fx("open");
  const p = M.get(o.sym), t = `${o.side === "buy" ? "Bought" : "Sold"} ${fmt(o.qty, qd(px, p))} ${unitOf(p, o.sym)} @ ${p ? M.fmtPx(p, px) : px}`;
  toast(fromLimit ? "Order filled · " + t : t, "ok");
  if (fromLimit) store.notify("Spot order filled", t, "ok");
  store.notify && !fromLimit && store.notify("Spot order executed", t, "ok");
  bus.emit("spot");
}
function checkOrders(sym, price){
  const sp = spot(), hit = sp.orders.filter(o => o.sym === sym && (o.side === "buy" ? price <= o.price : price >= o.price));
  if (!hit.length) return;
  hit.forEach(o => { sp.orders = sp.orders.filter(x => x.id !== o.id); applyFill(o, o.price, true); });
}
function place({sym, side, type, price, qty, tp, sl}){
  const p = M.get(sym), sp = spot(), coin = keyOf(sym);
  if (!p || !p.price) return {err:"Price unavailable"};
  if (p.closed) return {err:"Market closed — reopens with the next session"};
  if (!(qty > 0)) return {err:"Please enter the amount"};
  const px = type === "market" ? p.price : price;
  if (!(px > 0)) return {err:"Please enter the price"};
  if (qty * px < 1) return {err:"Minimum order value is 1 USDT"};
  if (side === "buy"){
    if (qty * px > store.wb("spot") + 1e-9) return {err:"Insufficient Spot balance"};
  } else if (qty > avail(coin) + 1e-9) return {err:`Insufficient ${unitOf(p, sym)} balance`};
  if (type === "market"){ applyFill({sym, side, qty, tp, sl}, px, false); return {ok:true, filled:true}; }
  const o = {id:U.uid(), sym, side, price:px, qty, ts:Date.now(), tp:tp || null, sl:sl || null};
  if (side === "buy") store.addWallet("spot", -qty * px, "spot");
  sp.orders.push(o); store.save(); bus.emit("spot");
  checkOrders(sym, p.price);
  return {ok:true, order:o, filled: !sp.orders.includes(o)};
}
function cancel(id){
  const sp = spot(), o = sp.orders.find(x => x.id === id); if (!o) return;
  sp.orders = sp.orders.filter(x => x.id !== id);
  if (o.side === "buy") store.addWallet("spot", o.qty * o.price, "spot");
  store.save(); bus.emit("spot");
}
function checkTpSl(sym, price){
  const sp = spot(), coin = keyOf(sym), h = sp.hold[coin];
  if (!h || !(h.qty > 0) || (!h.tp && !h.sl) || (h.sym || coin + "USDT") !== sym) return;
  const tpHit = h.tp && price >= h.tp, slHit = h.sl && price <= h.sl; if (!tpHit && !slHit) return;
  const q = Math.min(h.qty, avail(coin)); if (!(q > 0)) return;
  delete h.tp; delete h.sl; applyFill({sym, side:"sell", qty:q}, price, false);
  toast(tpHit ? "Take profit triggered" : "Stop loss triggered", tpHit ? "ok" : "bad", 3000);
}
if (!window.__spotTick){ window.__spotTick = true; bus.on("tick", (sym, price) => { try{ const sp = S().spot; if (sp?.orders?.length) checkOrders(sym, price); if (sp?.hold) checkTpSl(sym, price); }catch(e){ console.error(e); } }); }

/* ---- Auto Trade Bot (spot grid): real-kline backtest + simulated running bots ---- */
const btCache = {};
async function klines30(sym){
  const c = btCache[sym]; if (c && Date.now() - c.t < 300000) return c.rows;
  let rows = null;
  for (const host of CONFIG.BINANCE_REST){ try { const r = await fetch(`${host}/api/v3/klines?symbol=${sym}&interval=1h&limit=720`); if (r.ok){ rows = await r.json(); break; } } catch {} }
  if (!rows || rows.length < 48) throw new Error("no data");
  rows = rows.map(k => ({t:k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4]})); btCache[sym] = {t:Date.now(), rows}; return rows;
}
function gridPlan(rows, price){
  const days = {}; rows.forEach(r => { const d = Math.floor(r.t / 864e5), x = days[d] ||= {h:r.h, l:r.l}; x.h = Math.max(x.h, r.h); x.l = Math.min(x.l, r.l); });
  const dr = Object.values(days).map(x => (x.h - x.l) / x.l), avgRange = dr.reduce((a, b) => a + b, 0) / dr.length;
  const last = rows.slice(-24), h24 = Math.max(...last.map(r => r.h)), l24 = Math.min(...last.map(r => r.l));
  let lower = Math.max(Math.min(...rows.map(r => r.l)), price * 0.85), upper = Math.min(Math.max(...rows.map(r => r.h)), price * 1.15);
  if (!(lower < price * 0.99)) lower = price * 0.9; if (!(upper > price * 1.01)) upper = price * 1.1;
  const step = U.clamp(avgRange / 4, 0.004, 0.02), grids = U.clamp(Math.round(Math.log(upper / lower) / Math.log(1 + step)), 5, 100);
  return {avgRange, h24, l24, lower, upper, grids, minAmt: Math.max(10, Math.ceil(grids * 5 / 10) * 10)};
}
function backtest(rows, plan, capital = 1000){
  const {lower, upper, grids} = plan, r = Math.pow(upper / lower, 1 / grids), perGrid = capital / grids, FEEr = 0.0002;
  const band = px => U.clamp(Math.floor(Math.log(px / lower) / Math.log(r)), -1, grids);   // -1 below range, grids above
  const held = new Array(grids).fill(false), start = band(rows[0].o); for (let j = 0; j < grids; j++) held[j] = j >= start;
  let b = start, profit = 0, trades = 0; const curve = [capital];
  const move = px => { const nb = band(px);
    while (b < nb){ const j = b; if (j >= 0 && j < grids && held[j]){ held[j] = false; const lo = lower * Math.pow(r, j), hi = lo * r; profit += perGrid * (hi / lo - 1) - perGrid * FEEr * (1 + hi / lo); trades++; } b++; }
    while (b > nb){ const j = b; if (j >= 0 && j < grids) held[j] = true; b--; } };
  rows.forEach(k => { const path = k.c >= k.o ? [k.l, k.h, k.c] : [k.h, k.l, k.c]; path.forEach(move); curve.push(capital + profit); });
  return {profit, roi: profit / capital * 100, trades, curve};
}
function botProfit(b){ return b.invest * b.roiM / 100 * ((Date.now() - b.since) / (30 * 864e5)); }
function lineSvg(curve){
  const W = 320, H = 110, mn = Math.min(...curve), mx = Math.max(...curve), sp = (mx - mn) || 1, n = curve.length;
  const pts = curve.filter((_, i) => i % Math.ceil(n / 160) === 0 || i === n - 1).map((v, i, a) => `${(i / (a.length - 1) * W).toFixed(1)},${(H - 6 - (v - mn) / sp * (H - 14)).toFixed(1)}`);
  return `<svg class="bt-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Backtest equity curve"><defs><linearGradient id="btg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--up)" stop-opacity=".28"/><stop offset="1" stop-color="var(--up)" stop-opacity="0"/></linearGradient></defs><polygon points="0,${H} ${pts.join(" ")} ${W},${H}" fill="url(#btg)"/><polyline points="${pts.join(" ")}" fill="none" stroke="var(--up)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

function holdings(){
  const sp = spot(), out = [];
  for (const coin in sp.hold){
    const h = sp.hold[coin], sym = h.sym || (coin + "USDT"), p = M.get(sym), price = p?.price || 0;
    if (!(h.qty > 0)) continue;
    const value = h.qty * price, avg = h.cost / h.qty, pnl = value - h.cost;
    out.push({coin, sym, label: lbl(p, sym), qty:h.qty, avail:avail(coin), avg, price, value, cost:h.cost, pnl, pct: h.cost ? pnl / h.cost * 100 : 0});
  }
  return out.sort((a, b) => b.value - a.value);
}
window.SPOT = {holdings, valueUSDT: () => holdings().reduce((a, x) => a + x.value, 0)};

/* ---------- screen ---------- */
function loadingPage(){
  let off;
  return {title:"Loading", html: UI.pageHead("Spot") + `<div>${Array(8).fill('<div class="skel"></div>').join("")}</div>`, mount(){ off = bus.on("list", () => App.route()); }, unmount(){ off?.(); }};
}
Pages.spot = (params) => {
  let sym = (params[0] || sessionStorage.getItem("lastSym_spot") || "BTCUSDT").toUpperCase(), quote = "USDT";
  if (/USDC$/.test(sym) && M.get(sym.replace(/USDC$/, "USDT"))){ sym = sym.replace(/USDC$/, "USDT"); quote = "USDC"; }
  else if (!params[0] && sessionStorage.getItem("spotQ") === "USDC") quote = "USDC";
  if (!M.get(sym) && M.get(sym + "USDT")) sym += "USDT";
  try{ sessionStorage.setItem("spotQ", M.get(sym)?.type === "crypto" ? quote : "USDT"); }catch{}
  if (M.get(sym)?.type !== "crypto") quote = "USDT";
  if (!M.get(sym)) return M.cryptoOrder.length ? Pages.notfound() : loadingPage();
  try{ sessionStorage.setItem("lastSym_spot", sym); }catch{}
  const P = () => M.get(sym), coin = keyOf(sym), unit = unitOf(M.get(sym), sym), isCrypto = M.get(sym).type === "crypto", label0 = M.label(M.get(sym)).replace(/\/USDT$/, "/" + quote), s = S(), Q = quote;
  let unitMode = s.settings.spotUnit === "usdt" ? "usdt" : "coin", tsM = "price", lastStep = -1, root, offs = [], timers = [], side = "buy", otype = "limit", sliderPct = 0, ptab = "open", curOnly = false, chartOpen = false, unChart = null, prec = 0;
  const $ = q => root.querySelector(q);
  const side0 = () => unit;
  const html = `<div class="sp">
  <div class="tabs" style="gap:20px;margin:0 -16px;padding:4px 16px 0;border:0"><a class="tab" href="#/futures/${sym}" style="font-size:17px">USDⓈ-M</a><button class="tab on" style="font-size:17px">Spot</button><a class="tab" href="#/trade/${sym}" style="font-size:17px">Binary</a><a class="tab tab-hot" href="#/predict" style="font-size:17px">Prediction</a><a class="tab tab-hot" href="#/racer" style="font-size:17px">Money Game</a><a class="tab" href="#/options" style="font-size:17px">Options</a><a class="tab" href="#/copy" style="font-size:17px">Copy</a></div>
  <header class="sp-head"><div class="grow"><button class="sp-nm" data-pick>${esc(label0)}${ic("chevd",16)}</button><div class="num" id="spchg" style="font-size:13px"></div></div>
    <a class="icon-btn" href="#/chart/${sym}" aria-label="Chart">${ic("candle",22,1.6)}</a></header>
  <div class="sp-grid">
    <div class="sp-form">
      <div class="sp-seg"><button class="b on" data-side="buy">Buy</button><button class="s" data-side="sell">Sell</button></div>
      <button class="sp-sel" data-otype><span id="sotl">Limit</span>${ic("chevd",14)}</button>
      <div class="sp-in" id="spf"><button data-st="-1" aria-label="Decrease price">${ic("minus",16)}</button><input id="spp" type="number" inputmode="decimal" placeholder="Price"><button data-st="1" aria-label="Increase price">${ic("plus",16)}</button></div>
      <div class="sp-in hide" id="spm"><input id="spmk" disabled value="Market price"></div>
      <div class="sp-in" id="spa"><input id="spq" type="number" inputmode="decimal" placeholder="Amount"><button class="sp-un" data-unit type="button"><span id="spun">${esc(unit)}</span>${ic("chevd",11)}</button></div>
      <div class="sp-sl"><div class="tr"></div><div class="fl" id="spfl"></div>${[0,25,50,75,100].map(v => `<i class="nd" style="left:${v}%" data-nd="${v}"></i>`).join("")}<div class="th" id="spth"></div><div class="bub" id="spbub"></div><input type="range" min="0" max="100" step="1" value="0" id="spsl" aria-label="Amount percent"></div>
      <div class="sp-kv"><span id="sptl">Total</span><b id="sptot">-- ${Q}</b></div>
      <div id="sptprow" class="sp-tprow"><label class="fchk" style="margin:0"><input type="checkbox" id="sptpc"> <u data-info="tpsl">TP/SL</u></label><button class="tsm hide" id="sptsm" type="button">⇄ <span>ROI %</span></button></div>
      <div id="sptpsl" class="hide"><div class="tsh" id="sptsh"></div>
        <div class="sp-in"><input id="sptp" type="number" inputmode="decimal" placeholder="Take Profit"><em class="gh" id="sptpg"></em><span class="tpu">${Q}</span></div>
        <div class="sp-in"><input id="spsl2" type="number" inputmode="decimal" placeholder="Stop Loss"><em class="gh" id="spslg"></em><span class="tpu">${Q}</span></div></div>
      <div class="sp-kv"><span>Avbl</span><b><span id="spav"></span> <button class="wl-plus" data-wlto="spot" aria-label="Transfer in">${ic("plus",13,3)}</button></b></div>
      <div class="sp-kv"><span data-info="fee"><u>Est. Fee</u></span><b id="spef">-- ${side0()}</b></div>
      <button class="sp-go b" id="spgo"></button>
      ${TX.feeNote("0.02%", "0.10%")}
      <div class="sp-closed hide" id="spclosed">Market closed — reopens with the next session</div>
      <div class="err-msg" id="sperr" role="alert"></div>
    </div>
    <div class="sp-book" id="spbook"></div>
  </div>
  <div class="sp-ptabs"><button data-pt="open">Open orders (<span id="spoc">0</span>)</button><button data-pt="hold">Holdings</button><button data-pt="hist">History</button><button data-pt="bot">Auto Trade Bot</button></div>
  <div class="sp-tools"><label class="sp-chk"><input type="checkbox" id="spcur"> Current pair</label><button class="btn btn-ghost btn-sm" data-cancelall>Cancel all</button></div>
  <div id="splist"></div>
  <div class="sp-pad"></div>
  <section class="sp-chart" id="spch"><button class="sp-cbar" data-cch><span>${esc(UI.fullName(M.get(sym)))} Chart</span><span class="ci">${ic("chevd",16)}</span></button><div class="sp-cbody">${UI.miniChartBlock(sym)}</div></section>
  </div>`;

  const stepOf = () => Math.pow(10, -(P().dp ?? 2));
  const curPx = () => otype === "limit" ? (parseFloat($("#spp").value) || 0) : P().price;
  const qtyOf = () => { const raw = parseFloat($("#spq").value) || 0; if (unitMode === "coin") return raw; const px = curPx() || P().price; return px ? raw / px : 0; };
  const setQty = q => { if (!(q > 0)){ $("#spq").value = ""; return; } const px = curPx() || P().price; $("#spq").value = unitMode === "coin" ? q : Math.floor(q * px * 100) / 100; };
  function spTsHint(){
    const p = P(), ep = curPx() || p.price, notional = qtyOf() * ep, roiM = tsM === "roi", out = [], gh = {tp:"", sl:""}, fp = v => M.fmtPx(p, v);
    [["tp", "#sptp"], ["sl", "#spsl2"]].forEach(([k, id]) => {
      const raw = Math.abs(parseFloat($(id).value)); if (!(raw > 0)) return;
      const c = TX.tpCalc({k, mode: roiM ? "roi" : "price", val: raw, ep, lev: 1, notional, side:"long"});
      gh[k] = roiM ? fp(c.price) : TX.sgn(c.roi) + "%";
      out.push(`<div>${k.toUpperCase()} ${roiM ? `<b class="${c.roi >= 0 ? "up" : "down"}">${TX.sgn(c.roi)}%</b> ROI` : fp(raw)}${notional ? ` = <b class="num ${c.pnl >= 0 ? "up" : "down"}">${signed(c.pnl)} ${Q}</b>` : ""}</div>`);
    });
    $("#sptsh").innerHTML = out.join(""); $("#sptpg").textContent = gh.tp; $("#spslg").textContent = gh.sl;
  }
  function maxQty(){ const px = curPx() || P().price; return side === "buy" ? store.wb("spot") / px : avail(coin); }
  function renderForm(){
    const p = P(), q = qtyOf(), px = curPx();
    $("#sotl").textContent = otype === "limit" ? "Limit" : "Market";
    $("#spun").textContent = unitMode === "coin" ? unit : Q; $("#spq").placeholder = unitMode === "coin" ? "Amount" : "Total"; $("#sptl").textContent = unitMode === "coin" ? "Total" : "Quantity";
    { const buy = side === "buy"; $("#sptprow").classList.toggle("hide", !buy); if (!buy) $("#sptpsl").classList.add("hide"); else $("#sptpsl").classList.toggle("hide", !$("#sptpc").checked); $("#sptsm").classList.toggle("hide", !buy || !$("#sptpc").checked); if (buy && $("#sptpc").checked) spTsHint(); }
    $("#spf").classList.toggle("hide", otype !== "limit"); $("#spm").classList.toggle("hide", otype === "limit");
    $("#sptot").textContent = q && px ? (unitMode === "coin" ? money(q * px) + " " + Q : fmt(q, qd(px, p)) + " " + unit) : "-- " + (unitMode === "coin" ? Q : unit);
    $("#spef").textContent = q && px ? (side === "buy" ? fmt(q * FEE, 8) + " " + unit : fmt(q * px * FEE, 4) + " " + Q) : "-- " + (side === "buy" ? unit : Q);
    $("#spav").textContent = side === "buy" ? money(store.wb("spot")) + " " + Q : fmt(avail(coin), qd(p.price, p)) + " " + unit;
    const go = $("#spgo"); go.className = "sp-go " + (side === "buy" ? "b" : "s"); go.textContent = (side === "buy" ? "Buy " : "Sell ") + unit; go.disabled = !!p.closed; $("#spclosed").classList.toggle("hide", !p.closed);
    root.querySelectorAll("[data-side]").forEach(b => b.classList.toggle("on", b.dataset.side === side));
    root.querySelector(".sp-seg").dataset.side = side;
    renderSlider();
  }
  function renderSlider(){ const v = sliderPct; $("#spfl").style.width = v + "%"; $("#spth").style.left = v + "%"; $("#spbub").style.left = v + "%"; $("#spbub").textContent = Math.round(v) + "%"; root.querySelectorAll("[data-nd]").forEach(n => n.classList.toggle("on", +n.dataset.nd <= v)); }
  function setPct(v){
    sliderPct = v; const mq = maxQty(), qq = v >= 100 ? rnd(mq, qd(P().price, P())) : rnd(mq * v / 100, qd(P().price, P()));
    setQty(v ? qq : 0); renderForm();
  }
  async function submit(){
    const p = P(), q = qtyOf(), lp = parseFloat($("#spp").value) || 0, px = otype === "limit" ? lp : p.price, err = $("#sperr");
    if (p.closed) return toast("Market closed — reopens with the next session", "bad");
    const chk = (m) => { err.textContent = m; toast(m, "bad"); };
    if (otype === "limit" && !(lp > 0)) return chk("Please enter the price");
    if (!(q > 0)) return chk("Please enter the amount");
    if (q * px < 1) return chk("Minimum order value is 1 USDT");
    if (side === "buy" ? q * px > store.wb("spot") + 1e-9 : q > avail(coin) + 1e-9) return chk(side === "buy" ? "Insufficient Spot balance" : `Insufficient ${unit} balance`);
    err.textContent = "";
    let tp = null, sl = null;
    if (side === "buy" && $("#sptpc").checked){
      const rv = id => Math.abs(parseFloat($(id).value)) || 0, f = (k, id) => { const v = rv(id); if (!v) return null; return tsM === "roi" ? +TX.tpCalc({k, mode:"roi", val:v, ep:px, lev:1, side:"long"}).price.toFixed(p.dp ?? 2) : v; };
      tp = f("tp", "#sptp"); sl = f("sl", "#spsl2");
      if (tp && tp <= px) return chk("TP price must be higher than the buy price"); if (sl && sl >= px) return chk("SL price must be lower than the buy price");
    }
    const ok = await U.confirmTrade({kind: otype === "market" ? "market" : "limit", title: `${side === "buy" ? "Buy" : "Sell"} ${unit}`, tone: side === "buy" ? "up" : "down", okText: side === "buy" ? "Confirm Buy" : "Confirm Sell",
      sub: `<span class="perp">Spot</span> <span class="perp">${otype === "market" ? "Market" : "Limit"}</span>`,
      rows: [["Pair", esc(label0)], ["Price", otype === "market" ? "Market" : M.fmtPx(p, lp)], ["Amount", fmt(q, qd(px, p)) + " " + esc(unit)], ["Total", money(q * px) + " " + Q], ["Fee (0.02%)", money(q * px * FEE) + " " + Q], ...(tp || sl ? [["TP / SL", `${tp ? M.fmtPx(p, tp) : "--"} / ${sl ? M.fmtPx(p, sl) : "--"}`]] : [])]});
    if (!ok) return;
    const r = place({sym, side, type: otype, price: lp, qty: q, tp, sl});
    if (r.err){ chk(r.err); UI.walletErr(r.err); return; }
    if (!r.filled && r.order) toast("Order placed", "ok");
    $("#spq").value = ""; sliderPct = 0; $("#spsl").value = 0; $("#sptp").value = $("#spsl2").value = ""; renderForm();
    if (!r.filled) setPtab("open");
  }

  /* --- order book --- */
  function renderBook(){
    const box = $("#spbook"); if (!box) return; const p = P();
    const PM = [1, 10, 100, 1000], stp = stepOf() * PM[prec] , NR = 7;
    const agg = (rows, isBid) => { if (!prec) return rows; const m = new Map(); rows.forEach(([px, q]) => { const k = (isBid ? Math.floor(+px / stp + 1e-9) : Math.ceil(+px / stp - 1e-9)) * stp; m.set(k, (m.get(k) || 0) + +q); });
      return [...m.entries()].sort((a, b) => isBid ? b[0] - a[0] : a[0] - b[0]); };
    const pad = a => { a = a.slice(0, NR); while (a.length < NR) a.push(null); return a; };
    let bids = pad(agg(M.book.bids, true)), asks = pad(agg(M.book.asks, false)).reverse();
    if (!isCrypto){
      if (!p.price){ bids = []; asks = []; }
      else {
        const st = Math.pow(10, -(p.dp ?? 2)), hs = (i, k) => { const x = Math.sin((sym.length * 131 + sym.charCodeAt(0) * 7 + i * 17 + k * 101) * 12.9898) * 43758.5453; return x - Math.floor(x); };
        const base = p.type === "stock" ? 40 : p.type === "forex" ? 120 : 15, sz = (i, k) => +(base * (0.2 + hs(i, k) * 1.8) * (1 + i * 0.15)).toFixed(2);
        bids = [...Array(7)].map((_, i) => [p.price - st * (i + 1), sz(i, 1)]);
        asks = [...Array(7)].map((_, i) => [p.price + st * (7 - i), sz(6 - i, 2)]);
      }
    }
    const val = r => r ? +r[1] : 0, mx = Math.max(1e-12, ...bids.map(val), ...asks.map(val)), fq = x => x ? fmt(x, x < 1 ? 5 : x < 100 ? 3 : 1) : "--";
    const all = [...asks, ...bids].filter(Boolean).map(r => +r[0]), my = spot().orders.filter(o => o.sym === sym).map(o => o.price);
    let marked = new Set(), outside = 0;
    if (all.length > 1){
      const lo = Math.min(...all), hi = Math.max(...all), half = Math.abs(all[0] - all[1]) / 2;
      outside = my.filter(x => !(x >= lo - half && x <= hi + half)).length;
      marked = new Set(my.filter(x => x >= lo - half && x <= hi + half).map(x => all.reduce((b, y) => Math.abs(y - x) < Math.abs(b - x) ? y : b, all[0])));
    }
    const row = (r, c) => !r ? `<div class="r em"><span class="${c}">--</span><span>--</span></div>` : `<div class="r" data-bp="${+r[0]}"><i style="width:${val(r) / mx * 100}%;background:var(--${c})"></i><span class="${c}">${marked.has(+r[0]) ? '<em class="me"></em>' : ""}${M.fmtPx(p, +r[0])}</span><span>${fq(val(r))}</span></div>`;
    const tb = bids.reduce((a, b) => a + val(b), 0), ta = asks.reduce((a, b) => a + val(b), 0), bp = tb + ta ? tb / (tb + ta) * 100 : 50;
    box.innerHTML = `<div class="fh"><span>Price<br>(${Q})</span><span>Amount<br>(${esc(unit)})</span></div>
      ${asks.some(Boolean) ? asks.map(a => row(a, "down")).join("") : '<div class="skel" style="height:100px"></div>'}
      <div class="mid" data-bp="${p.price}"><b class="num ${p.dir >= 0 ? "up" : "down"}">${M.fmtPx(p)}</b><small class="num">≈ $${money(p.price * (p.quote === "USDT" ? M.usdtUsd() : 1))}</small></div>
      ${bids.map(b => row(b, "up")).join("")}${outside ? `<div class="ob-out">${ic("info",11)} ${outside} of your orders outside the visible book</div>` : ""}
      <div class="sp-ratio num"><span class="up">${bp.toFixed(0)}%</span><div class="bar"><i style="width:${bp}%"></i></div><span class="down">${(100 - bp).toFixed(0)}%</span></div>
      <button class="sp-prec" data-prec type="button"><span class="num">${M.fmtPx(p, stp)}</span>${ic("chevd",13)}</button>`;
    const ch = $("#spchg"); ch.textContent = p.closed ? "Market closed" : p.chg == null ? "" : pct(p.chg); ch.className = "num " + ((p.chg || 0) < 0 ? "down" : "up");
  }

  function precSheet(){ const p = P(), PM = [1, 10, 100, 1000];
    U.sheet("Select Precision", PM.map((m, i) => `<button class="list-item prec-o" style="width:100%" data-pr="${i}"><span class="grow num">${M.fmtPx(p, stepOf() * m)}</span>${i === prec ? ic("check", 18) : ""}</button>`).join(""), el => el.querySelectorAll("[data-pr]").forEach(b => b.onclick = () => { prec = +b.dataset.pr; U.closeLayer(); renderBook(); })); }
  /* --- lists --- */
  const ds = t => { const d = new Date(t); return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${d.toTimeString().slice(0, 8)}`; };
  function setPtab(k){ ptab = k; root.querySelectorAll("[data-pt]").forEach(b => b.classList.toggle("on", b.dataset.pt === k)); $("[data-cancelall]").classList.toggle("hide", k !== "open"); $("#spcur").closest("label").classList.toggle("hide", k === "hold" || k === "bot"); $(".sp-tools").classList.toggle("hide", k === "bot"); renderList(); }
  function renderList(){
    const list = $("#splist"); if (!list) return; const sp = spot(), f = x => !curOnly || x.sym === sym;
    const ords = sp.orders.filter(f); $("#spoc").textContent = sp.orders.length;
    if (ptab === "open") list.innerHTML = ords.length ? ords.slice().reverse().map(o => { const p = M.get(o.sym);
      return `<div class="sp-card"><div class="h"><span class="side-b ${o.side === "buy" ? "l" : "s"}">${o.side === "buy" ? "B" : "S"}</span><b class="sym">${esc(lbl(p, o.sym))}</b><span class="perp">Limit</span><span class="grow"></span><button class="btn btn-ghost btn-sm" data-cancel="${o.id}">Cancel</button></div>
      <div class="g"><div><span>Price</span><b class="num">${M.fmtPx(p, o.price)}</b></div><div><span>Amount (${esc(unitOf(p, o.sym))})</span><b class="num">${fmt(o.qty, qd(o.price, p))}</b></div><div><span>Filled</span><b class="num">0%</b></div><div><span>Side</span><b class="${o.side === "buy" ? "up" : "down"}">${o.side === "buy" ? "Buy" : "Sell"}</b></div><div><span>Total (USDT)</span><b class="num">${money(o.qty * o.price)}</b></div><div><span>Time</span><b class="num">${ds(o.ts)}</b></div>${o.tp || o.sl ? `<div><span>TP / SL</span><b class="num"><em class="up">${o.tp ? M.fmtPx(p, o.tp) : "--"}</em> / <em class="down">${o.sl ? M.fmtPx(p, o.sl) : "--"}</em></b></div>` : ""}</div></div>`; }).join("") : UI.emptyState("file", "No open orders");
    else if (ptab === "bot") renderBot(list);
    else if (ptab === "hold"){ const hs = holdings();
      list.innerHTML = hs.length ? hs.map(h => `<div class="sp-card"><div class="h">${M.get(h.sym) ? UI.pairIcon(M.get(h.sym), 26) : UI.coinImg(h.coin, 26)}<b class="sym">${esc(h.label)}</b><span class="grow"></span><a class="btn btn-ghost btn-sm" href="#/spot/${h.sym}">Trade</a></div>
        <div class="g"><div><span>Amount</span><b class="num">${fmt(h.qty, qd(h.price, M.get(h.sym)))}</b></div><div><span>Avg cost</span><b class="num">${M.fmtPx(M.get(h.sym), h.avg)}</b></div><div><span>Value (USDT)</span><b class="num">${money(h.value)}</b></div>
        <div><span>Unrealized PnL</span><b class="num ${h.pnl >= 0 ? "up" : "down"}">${signed(h.pnl)}</b></div><div><span>PnL %</span><b class="num ${h.pnl >= 0 ? "up" : "down"}">${signed(h.pct)}%</b></div><div><span>Available</span><b class="num">${fmt(h.avail, qd(h.price, M.get(h.sym)))}</b></div>${spot().hold[h.coin]?.tp || spot().hold[h.coin]?.sl ? `<div><span>TP / SL</span><b class="num"><em class="up">${spot().hold[h.coin].tp ? M.fmtPx(M.get(h.sym), spot().hold[h.coin].tp) : "--"}</em> / <em class="down">${spot().hold[h.coin].sl ? M.fmtPx(M.get(h.sym), spot().hold[h.coin].sl) : "--"}</em></b></div>` : ""}</div></div>`).join("") : UI.emptyState("wallet", "No holdings yet");
    } else { const hh = sp.history.filter(f).slice(0, 60);
      list.innerHTML = hh.length ? hh.map(x => { const p = M.get(x.sym);
        return `<div class="sp-card"><div class="h"><span class="side-b ${x.side === "buy" ? "l" : "s"}">${x.side === "buy" ? "B" : "S"}</span><b class="sym">${esc(lbl(p, x.sym))}</b><span class="perp">${x.type === "limit" ? "Limit" : "Market"}</span><span class="grow"></span><span class="label num" style="font-size:12px">${ds(x.ts)}</span></div>
        <div class="g"><div><span>Price</span><b class="num">${M.fmtPx(p, x.price)}</b></div><div><span>Amount (${esc(unitOf(p, x.sym))})</span><b class="num">${fmt(x.qty, qd(x.price, p))}</b></div><div><span>Fee (USDT)</span><b class="num">${fmt(x.fee, 4)}</b></div></div></div>`; }).join("") : UI.emptyState("history", "No trade history");
    }
  }
  let botBusy = false;
  function renderBot(list){
    const p = P(), bots = (spot().bots || []).filter(b => b.running);
    const runHtml = bots.length ? `<div class="bt-h2">Running bots</div>` + bots.map(b => { const bp = M.get(b.sym), pr = botProfit(b);
      return `<div class="sp-card"><div class="h"><b class="sym">${esc(M.label(bp).replace(/\/USDT$/, "/" + (b.q || "USDT")))}</b><span class="perp">Spot Grid</span><span class="grow"></span><button class="oc-cancel" data-botstop="${b.id}">Stop</button></div>
        <div class="g"><div><span>Invested (USDT)</span><b class="num">${money(b.invest)}</b></div><div><span>Grid profit</span><b class="num up">${signed(pr)}</b></div><div><span>Grids</span><b class="num">${b.grids}</b></div><div><span>Range</span><b class="num">${M.fmtPx(bp, b.lower)} - ${M.fmtPx(bp, b.upper)}</b></div><div><span>Est. monthly ROI</span><b class="num up">${signed(b.roiM)}%</b></div><div><span>Running</span><b class="num">${U.mmss ? Math.max(1, Math.floor((Date.now() - b.since) / 60000)) + "m" : ""}</b></div></div></div>`; }).join("") : "";
    if (!isCrypto){ list.innerHTML = runHtml + UI.emptyState("info", "Auto Trade Bot is available for crypto pairs only."); return; }
    list.innerHTML = `<div class="bt-wrap"><div class="bt-skel"><div class="skel" style="height:18px;width:60%"></div><div class="skel" style="height:110px;margin:12px 0"></div><div class="skel" style="height:18px"></div></div></div>` + runHtml;
    const token = ++botBusy;
    klines30(sym).then(rows => {
      if (botBusy !== token || ptab !== "bot" || !root?.isConnected) return;
      const plan = gridPlan(rows, p.price), bt = backtest(rows, plan, 1000), box = list.querySelector(".bt-wrap"); if (!box) return;
      const fp = v => M.fmtPx(p, v);
      box.innerHTML = `<div class="bt-t"><b>Auto Trade Bot</b><span class="perp">Spot Grid</span><span class="grow"></span><span class="label">${esc(label0)}</span></div>
        <div class="bt-g"><div><span>24h high</span><b class="num up">${fp(plan.h24)}</b></div><div><span>24h low</span><b class="num down">${fp(plan.l24)}</b></div><div><span>Avg daily range</span><b class="num">${(plan.avgRange * 100).toFixed(2)}%</b></div>
          <div><span>Suggested range</span><b class="num">${fp(plan.lower)} - ${fp(plan.upper)}</b></div><div><span>Suggested grids</span><b class="num">${plan.grids}</b></div><div><span>Min. amount</span><b class="num">${money(plan.minAmt)} USDT</b></div></div>
        <div class="bt-roi"><div><span>Backtest · last 30 days · $1,000</span><b class="num up">${signed(bt.profit)} USDT</b></div><div style="text-align:right"><span>Monthly ROI</span><b class="num up">${signed(bt.roi)}%</b></div></div>
        ${lineSvg(bt.curve)}<div class="bt-ax"><span>30d ago · $1,000</span><span>${bt.trades} grid trades</span><span>Now · $${money(1000 + bt.profit)}</span></div>
        <button class="btn btn-primary btn-block btn-lg" data-botnew>Create Auto Trade Bot</button>
        <p class="bt-n">Simulated on the last 720 real hourly Binance candles with ${Q === "USDC" ? "USDT" : "USDT"} virtual capital and the 0.02% fee per side. Shows realised grid profit only (price change of held coins is excluded). Past performance does not guarantee future results.</p>`;
      box.querySelector("[data-botnew]").onclick = () => botSheet(plan, bt);
    }).catch(() => { if (botBusy === token && list.querySelector(".bt-wrap")) list.querySelector(".bt-wrap").innerHTML = UI.emptyState("info", "Backtest data is unavailable right now. Check your connection and try again."); });
  }
  function botSheet(plan, bt){
    const p = P();
    U.sheet("Create Auto Trade Bot", `<div class="kv"><span>Pair</span><b>${esc(label0)}</b></div><div class="kv"><span>Grids</span><b class="num">${plan.grids}</b></div><div class="kv"><span>Range</span><b class="num">${M.fmtPx(p, plan.lower)} - ${M.fmtPx(p, plan.upper)}</b></div><div class="kv"><span>Est. monthly ROI</span><b class="num up">${signed(bt.roi)}%</b></div>
      <div class="field" style="margin:12px 0 6px"><input id="btA" type="number" inputmode="decimal" value="${plan.minAmt}" aria-label="Investment"><span class="unit">USDT</span></div>
      <div class="kv" style="margin-bottom:12px"><span>Avbl (Spot)</span><b class="num">${money(store.wb("spot"))} USDT</b></div><div class="err-msg" id="btE"></div>
      <button class="btn btn-primary btn-block btn-lg" data-ok>Create</button>`, el => {
      el.querySelector("[data-ok]").onclick = () => { const a = parseFloat(el.querySelector("#btA").value) || 0, e = el.querySelector("#btE");
        if (a < plan.minAmt) return e.textContent = `Minimum amount is ${money(plan.minAmt)} USDT`;
        if (a > store.wb("spot") + 1e-9){ e.textContent = "Insufficient Spot balance"; UI.walletErr("Insufficient Spot balance"); return; }
        store.addWallet("spot", -a, "bot"); const sp = spot(); sp.bots = sp.bots || [];
        sp.bots.push({id:U.uid(), sym, q:Q, running:true, invest:a, grids:plan.grids, lower:plan.lower, upper:plan.upper, roiM:bt.roi, since:Date.now()}); store.save(); U.closeLayer(); U.fx("open"); toast("Auto Trade Bot started", "ok"); bus.emit("spot"); };
    });
  }
  function toggleChart(){
    chartOpen = !chartOpen; $("#spch").classList.toggle("open", chartOpen);
    if (chartOpen && !unChart) unChart = UI.bindChart(root, sym, "tf_spot", "15m", UI.candleDetail(sym), {mini:true, tfs:UI.MINI_TFS});
    else setTimeout(() => window.CH && CH.resize && CH.resize(), 60);
  }

  return {html, title: label0 + " Spot", mount(r){
    root = r; if (isCrypto) M.watchTrades(sym); spot();
    $("#spp").value = +P().price.toFixed(P().dp ?? 2);
    renderForm(); renderBook(); setPtab(ptab);
    $("[data-pick]").onclick = () => UI.pickSheet(sym, x => location.hash = "#/spot/" + x);
    root.querySelectorAll("[data-side]").forEach(b => b.onclick = () => { side = b.dataset.side; $("#spq").value = ""; sliderPct = 0; $("#spsl").value = 0; $("#sperr").textContent = ""; renderForm(); });
    $("[data-otype]").onclick = () => U.sheet("Order type", [["limit","Limit","Executes at your price or better."],["market","Market","Executes immediately at the best available price."]].map(([k, n, d]) => `<button class="list-item" style="width:100%" data-ot="${k}"><div class="grow"><b>${n}</b><div class="label">${d}</div></div>${otype === k ? ic("check",18) : ""}</button>`).join(""), el => el.querySelectorAll("[data-ot]").forEach(b => b.onclick = () => { otype = b.dataset.ot; if (otype === "limit" && !$("#spp").value) $("#spp").value = +P().price.toFixed(P().dp ?? 2); U.closeLayer(); $("#spq").value = ""; sliderPct = 0; $("#spsl").value = 0; renderForm(); }));
    root.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { const st = stepOf(), v = (parseFloat($("#spp").value) || P().price) + st * +b.dataset.st * Math.pow(10, prec); $("#spp").value = +Math.max(st, v).toFixed(P().dp ?? 2); sliderPct = 0; renderForm(); });
    const sl = $("#spsl"), bub = $("#spbub");
    sl.addEventListener("pointerdown", () => bub.classList.add("on"));
    ["pointerup", "pointercancel", "blur"].forEach(ev => sl.addEventListener(ev, () => bub.classList.remove("on")));
    sl.oninput = () => { const v = +sl.value, snap = [0, 25, 50, 75, 100].find(x => Math.abs(x - v) <= 2); if (snap != null && snap !== v) sl.value = snap; const st = Math.round((snap ?? v) / 5); if (st !== lastStep && (S().settings.layout || {}).slideVib !== false) TX.buzz((snap ?? v) % 25 === 0 ? 12 : 5); lastStep = st; setPct(snap ?? v); };
    $("#spq").addEventListener("input", () => { $("#sperr").textContent = ""; const m = maxQty(); sliderPct = m > 0 ? U.clamp(qtyOf() / m * 100, 0, 100) : 0; $("#spsl").value = sliderPct; renderForm(); });
    $("#spp").addEventListener("input", () => { if (side === "buy" && sliderPct) setPct(sliderPct); else renderForm(); });
    $("#spgo").onclick = submit;
    $("#spbook").addEventListener("click", e => { if (e.target.closest("[data-prec]")) precSheet(); });
    TX.tapPrice($("#spbook"), px => { if (!(px > 0)) return; otype = "limit"; $("#spp").value = +(+px).toFixed(P().dp ?? 2); if (side === "buy" && sliderPct) setPct(sliderPct); else renderForm(); TX.buzz(8); toast("Limit price set to " + M.fmtPx(P(), px), "info", 1200); });
    $("[data-unit]").onclick = () => TX.unitSheet(unit, unitMode, k => { const q = qtyOf(); unitMode = k; s.settings.spotUnit = k; store.save(); setQty(q); renderForm(); });
    $("#sptpc").onchange = renderForm;
    $("#sptsm").onclick = () => { tsM = tsM === "roi" ? "price" : "roi"; $("#sptsm span").textContent = tsM === "roi" ? "Price" : "ROI %"; $("#sptp").placeholder = tsM === "roi" ? "TP ROI %" : "Take Profit"; $("#spsl2").placeholder = tsM === "roi" ? "SL ROI %" : "Stop Loss"; root.querySelectorAll("#sptpsl .tpu").forEach(x => x.textContent = tsM === "roi" ? "%" : Q); $("#sptp").value = $("#spsl2").value = ""; renderForm(); };
    $("#sptp").addEventListener("input", renderForm); $("#spsl2").addEventListener("input", renderForm);
    root.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => setPtab(b.dataset.pt));
    $("#spcur").onchange = e => { curOnly = e.target.checked; renderList(); };
    $("[data-cancelall]").onclick = async () => { const l = spot().orders.filter(o => !curOnly || o.sym === sym); if (!l.length) return toast("No open orders", "info");
      if (await U.confirmBox("Cancel all orders", `Cancel ${l.length} open order${l.length > 1 ? "s" : ""}?`, "Cancel all", true)){ l.forEach(o => cancel(o.id)); toast("Orders cancelled", "ok"); } };
    $("#splist").addEventListener("click", e => { const bs = e.target.closest("[data-botstop]"); if (bs){ const sp = spot(), b = (sp.bots || []).find(x => x.id === bs.dataset.botstop); if (b){ const pr = botProfit(b); b.running = false; store.addWallet("spot", b.invest + pr, "bot"); store.save(); toast(`Bot stopped · ${signed(pr)} USDT profit`, "ok"); bus.emit("spot"); } return; }
      if (e.target.closest("[data-botnew]")) return; const c = e.target.closest("[data-cancel]"); if (c){ cancel(c.dataset.cancel); toast("Order cancelled", "ok"); } });
    $("[data-cch]").onclick = toggleChart;
    let tT = 0, bT = 0;
    offs.push(bus.on("tick", x => { if (x === sym && performance.now() - tT > 250){ tT = performance.now(); renderForm(); if (ptab === "hold") renderList(); if (!isCrypto) renderBook(); } }),
      bus.on("depth", x => { if (x === sym && performance.now() - bT > 400){ bT = performance.now(); renderBook(); } }),
      bus.on("spot", () => { renderForm(); renderBook(); renderList(); }), bus.on("balance", renderForm));
  }, unmount(){ offs.forEach(f => f()); timers.forEach(f => f()); unChart?.(); if (isCrypto) M.unwatchTrades(); }};
};
})();
