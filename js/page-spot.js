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
    if (!fromLimit) store.setBalance(S().balance - o.qty * px, "spot");
  } else {
    const ac = h.qty > 0 ? h.cost / h.qty : 0;
    h.cost = Math.max(0, h.cost - ac * o.qty); h.qty = Math.max(0, h.qty - o.qty);
    store.setBalance(S().balance + o.qty * px * (1 - FEE), "spot");
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
function place({sym, side, type, price, qty}){
  const p = M.get(sym), sp = spot(), coin = keyOf(sym);
  if (!p || !p.price) return {err:"Price unavailable"};
  if (p.closed) return {err:"Market closed — reopens with the next session"};
  if (!(qty > 0)) return {err:"Please enter the amount"};
  const px = type === "market" ? p.price : price;
  if (!(px > 0)) return {err:"Please enter the price"};
  if (qty * px < 1) return {err:"Minimum order value is 1 USDT"};
  if (side === "buy"){
    if (qty * px > S().balance + 1e-9) return {err:"Insufficient USDT balance"};
  } else if (qty > avail(coin) + 1e-9) return {err:`Insufficient ${unitOf(p, sym)} balance`};
  if (type === "market"){ applyFill({sym, side, qty}, px, false); return {ok:true, filled:true}; }
  const o = {id:U.uid(), sym, side, price:px, qty, ts:Date.now()};
  if (side === "buy") store.setBalance(S().balance - qty * px, "spot");
  sp.orders.push(o); store.save(); bus.emit("spot");
  checkOrders(sym, p.price);
  return {ok:true, order:o, filled: !sp.orders.includes(o)};
}
function cancel(id){
  const sp = spot(), o = sp.orders.find(x => x.id === id); if (!o) return;
  sp.orders = sp.orders.filter(x => x.id !== id);
  if (o.side === "buy") store.setBalance(S().balance + o.qty * o.price, "spot");
  store.save(); bus.emit("spot");
}
if (!window.__spotTick){ window.__spotTick = true; bus.on("tick", (sym, price) => { try{ if (S().spot?.orders?.length) checkOrders(sym, price); }catch(e){ console.error(e); } }); }

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
  let sym = (params[0] || sessionStorage.getItem("lastSym_spot") || "BTCUSDT").toUpperCase();
  if (!M.get(sym) && M.get(sym + "USDT")) sym += "USDT";
  if (!M.get(sym)) return M.cryptoOrder.length ? Pages.notfound() : loadingPage();
  try{ sessionStorage.setItem("lastSym_spot", sym); }catch{}
  const P = () => M.get(sym), coin = keyOf(sym), unit = unitOf(M.get(sym), sym), isCrypto = M.get(sym).type === "crypto", label0 = M.label(M.get(sym)), s = S();
  let root, offs = [], timers = [], side = "buy", otype = "limit", sliderPct = 0, ptab = "open", curOnly = false, chartOpen = false, unChart = null, prec = 0;
  const $ = q => root.querySelector(q);
  const html = `<div class="sp">
  <div class="tabs" style="gap:20px;margin:0 -16px;padding:4px 16px 0;border:0"><a class="tab" href="#/futures/${sym}" style="font-size:17px">USDⓈ-M</a><button class="tab on" style="font-size:17px">Spot</button><a class="tab" href="#/trade/${sym}" style="font-size:17px">Binary</a><a class="tab" href="#/options" style="font-size:17px">Options</a><a class="tab" href="#/copy" style="font-size:17px">Copy</a></div>
  <header class="sp-head"><div class="grow"><button class="sp-nm" data-pick>${esc(label0)}${ic("chevd",16)}</button><div class="num" id="spchg" style="font-size:13px"></div></div>
    <a class="icon-btn" href="#/chart/${sym}" aria-label="Chart">${ic("candle",22,1.6)}</a></header>
  <div class="sp-grid">
    <div class="sp-form">
      <div class="sp-seg"><button class="b on" data-side="buy">Buy</button><button class="s" data-side="sell">Sell</button></div>
      <button class="sp-sel" data-otype><span id="sotl">Limit</span>${ic("chevd",14)}</button>
      <div class="sp-in" id="spf"><button data-st="-1" aria-label="Decrease price">${ic("minus",16)}</button><input id="spp" type="number" inputmode="decimal" placeholder="Price"><button data-st="1" aria-label="Increase price">${ic("plus",16)}</button></div>
      <div class="sp-in hide" id="spm"><input id="spmk" disabled value="Market price"></div>
      <div class="sp-in" id="spa"><input id="spq" type="number" inputmode="decimal" placeholder="Amount"><span>${esc(unit)}</span></div>
      <div class="sp-sl"><div class="tr"></div><div class="fl" id="spfl"></div>${[0,25,50,75,100].map(v => `<i class="nd" style="left:${v}%" data-nd="${v}"></i>`).join("")}<div class="th" id="spth"></div><div class="bub" id="spbub"></div><input type="range" min="0" max="100" step="1" value="0" id="spsl" aria-label="Amount percent"></div>
      <div class="sp-kv"><span>Total</span><b id="sptot">-- USDT</b></div>
      <div class="sp-kv"><span>Avbl</span><b><span id="spav"></span> <a href="#/deposit" aria-label="Deposit">${ic("plus",13,3)}</a></b></div>
      <button class="sp-go b" id="spgo"></button>
      <div class="sp-fee">Fee 0.02% (taker)</div>
      <div class="sp-closed hide" id="spclosed">Market closed — reopens with the next session</div>
      <div class="err-msg" id="sperr" role="alert"></div>
    </div>
    <div class="sp-book" id="spbook"></div>
  </div>
  <div class="sp-ptabs"><button data-pt="open">Open orders (<span id="spoc">0</span>)</button><button data-pt="hold">Holdings</button><button data-pt="hist">History</button></div>
  <div class="sp-tools"><label class="sp-chk"><input type="checkbox" id="spcur"> Current pair</label><button class="btn btn-ghost btn-sm" data-cancelall>Cancel all</button></div>
  <div id="splist"></div>
  <div class="sp-pad"></div>
  <section class="sp-chart" id="spch"><button class="sp-cbar" data-cch><span>${esc(UI.fullName(M.get(sym)))} Chart</span><span class="ci">${ic("chevd",16)}</span></button><div class="sp-cbody">${UI.miniChartBlock(sym)}</div></section>
  </div>`;

  const stepOf = () => Math.pow(10, -(P().dp ?? 2));
  const curPx = () => otype === "limit" ? (parseFloat($("#spp").value) || 0) : P().price;
  function maxQty(){ const px = curPx() || P().price; return side === "buy" ? s.balance / px : avail(coin); }
  function renderForm(){
    const p = P(), q = parseFloat($("#spq").value) || 0, px = curPx();
    $("#sotl").textContent = otype === "limit" ? "Limit" : "Market";
    $("#spf").classList.toggle("hide", otype !== "limit"); $("#spm").classList.toggle("hide", otype === "limit");
    $("#sptot").textContent = q && px ? money(q * px) + " USDT" : "-- USDT";
    $("#spav").textContent = side === "buy" ? money(s.balance) + " USDT" : fmt(avail(coin), qd(p.price, p)) + " " + unit;
    const go = $("#spgo"); go.className = "sp-go " + (side === "buy" ? "b" : "s"); go.textContent = (side === "buy" ? "Buy " : "Sell ") + unit; go.disabled = !!p.closed; $("#spclosed").classList.toggle("hide", !p.closed);
    root.querySelectorAll("[data-side]").forEach(b => b.classList.toggle("on", b.dataset.side === side));
    root.querySelector(".sp-seg").dataset.side = side;
    renderSlider();
  }
  function renderSlider(){ const v = sliderPct; $("#spfl").style.width = v + "%"; $("#spth").style.left = v + "%"; $("#spbub").style.left = v + "%"; $("#spbub").textContent = Math.round(v) + "%"; root.querySelectorAll("[data-nd]").forEach(n => n.classList.toggle("on", +n.dataset.nd <= v)); }
  function setPct(v){
    sliderPct = v; const mq = maxQty(), qq = v >= 100 ? rnd(mq, qd(P().price, P())) : rnd(mq * v / 100, qd(P().price, P()));
    $("#spq").value = v ? qq : ""; renderForm();
  }
  async function submit(){
    const p = P(), q = parseFloat($("#spq").value) || 0, lp = parseFloat($("#spp").value) || 0, px = otype === "limit" ? lp : p.price, err = $("#sperr");
    if (p.closed) return toast("Market closed — reopens with the next session", "bad");
    const chk = (m) => { err.textContent = m; toast(m, "bad"); };
    if (otype === "limit" && !(lp > 0)) return chk("Please enter the price");
    if (!(q > 0)) return chk("Please enter the amount");
    if (q * px < 1) return chk("Minimum order value is 1 USDT");
    if (side === "buy" ? q * px > s.balance + 1e-9 : q > avail(coin) + 1e-9) return chk(side === "buy" ? "Insufficient USDT balance" : `Insufficient ${unit} balance`);
    err.textContent = "";
    const ok = await U.confirmTrade({kind: otype === "market" ? "market" : "limit", title: `${side === "buy" ? "Buy" : "Sell"} ${unit}`, tone: side === "buy" ? "up" : "down", okText: side === "buy" ? "Confirm Buy" : "Confirm Sell",
      sub: `<span class="perp">Spot</span> <span class="perp">${otype === "market" ? "Market" : "Limit"}</span>`,
      rows: [["Pair", esc(label0)], ["Price", otype === "market" ? "Market" : M.fmtPx(p, lp)], ["Amount", fmt(q, qd(px, p)) + " " + esc(unit)], ["Total", money(q * px) + " USDT"], ["Fee (0.1%)", money(q * px * FEE) + " USDT"]]});
    if (!ok) return;
    const r = place({sym, side, type: otype, price: lp, qty: q});
    if (r.err) return chk(r.err);
    if (!r.filled && r.order) toast("Order placed", "ok");
    $("#spq").value = ""; sliderPct = 0; $("#spsl").value = 0; renderForm();
    if (!r.filled) setPtab("open");
  }

  /* --- order book --- */
  function renderBook(){
    const box = $("#spbook"); if (!box) return; const p = P();
    let bids = M.book.bids.slice(0, 7), asks = M.book.asks.slice(0, 7).reverse();
    if (!isCrypto){
      if (!p.price){ bids = []; asks = []; }
      else {
        const st = Math.pow(10, -(p.dp ?? 2)), hs = (i, k) => { const x = Math.sin((sym.length * 131 + sym.charCodeAt(0) * 7 + i * 17 + k * 101) * 12.9898) * 43758.5453; return x - Math.floor(x); };
        const base = p.type === "stock" ? 40 : p.type === "forex" ? 120 : 15, sz = (i, k) => +(base * (0.2 + hs(i, k) * 1.8) * (1 + i * 0.15)).toFixed(2);
        bids = [...Array(7)].map((_, i) => [p.price - st * (i + 1), sz(i, 1)]);
        asks = [...Array(7)].map((_, i) => [p.price + st * (7 - i), sz(6 - i, 2)]);
      }
    }
    const val = r => +r[1], mx = Math.max(1e-12, ...bids.map(val), ...asks.map(val)), fq = x => x ? fmt(x, x < 1 ? 5 : x < 100 ? 3 : 1) : "--";
    const all = [...asks, ...bids].map(r => +r[0]), my = spot().orders.filter(o => o.sym === sym).map(o => o.price);
    let marked = new Set(), outside = 0;
    if (all.length > 1){
      const lo = Math.min(...all), hi = Math.max(...all), half = Math.abs(all[0] - all[1]) / 2;
      outside = my.filter(x => !(x >= lo - half && x <= hi + half)).length;
      marked = new Set(my.filter(x => x >= lo - half && x <= hi + half).map(x => all.reduce((b, y) => Math.abs(y - x) < Math.abs(b - x) ? y : b, all[0])));
    }
    const row = (r, c) => `<div class="r" data-bp="${+r[0]}"><i style="width:${val(r) / mx * 100}%;background:var(--${c})"></i><span class="${c}">${marked.has(+r[0]) ? '<em class="me"></em>' : ""}${M.fmtPx(p, +r[0])}</span><span>${fq(val(r))}</span></div>`;
    const tb = bids.reduce((a, b) => a + val(b), 0), ta = asks.reduce((a, b) => a + val(b), 0), bp = tb + ta ? tb / (tb + ta) * 100 : 50;
    box.innerHTML = `<div class="fh"><span>Price<br>(USDT)</span><span>Amount<br>(${esc(unit)})</span></div>
      ${asks.length ? asks.map(a => row(a, "down")).join("") : '<div class="skel" style="height:100px"></div>'}
      <div class="mid"><b class="num ${p.dir >= 0 ? "up" : "down"}">${M.fmtPx(p)}</b><small class="num">≈ $${money(p.price)}</small></div>
      ${bids.map(b => row(b, "up")).join("")}${outside ? `<div class="ob-out">${ic("info",11)} ${outside} of your orders outside the visible book</div>` : ""}
      <div class="sp-ratio num"><span class="up">${bp.toFixed(0)}%</span><div class="bar"><i style="width:${bp}%"></i></div><span class="down">${(100 - bp).toFixed(0)}%</span></div>
      <select class="sp-prec" id="spprec" aria-label="Precision">${[1, 10, 100].map((m, i) => `<option value="${i}" ${i === prec ? "selected" : ""}>${fmt(stepOf() * m, Math.max(0, (P().dp ?? 2) - Math.log10(m)))}</option>`).join("")}</select>`;
    const sel = $("#spprec"); if (sel) sel.onchange = () => { prec = +sel.value; };
    const ch = $("#spchg"); ch.textContent = p.closed ? "Market closed" : p.chg == null ? "" : pct(p.chg); ch.className = "num " + ((p.chg || 0) < 0 ? "down" : "up");
  }

  /* --- lists --- */
  const ds = t => { const d = new Date(t); return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${d.toTimeString().slice(0, 8)}`; };
  function setPtab(k){ ptab = k; root.querySelectorAll("[data-pt]").forEach(b => b.classList.toggle("on", b.dataset.pt === k)); $("[data-cancelall]").classList.toggle("hide", k !== "open"); $("#spcur").closest("label").classList.toggle("hide", k === "hold"); renderList(); }
  function renderList(){
    const list = $("#splist"); if (!list) return; const sp = spot(), f = x => !curOnly || x.sym === sym;
    const ords = sp.orders.filter(f); $("#spoc").textContent = sp.orders.length;
    if (ptab === "open") list.innerHTML = ords.length ? ords.slice().reverse().map(o => { const p = M.get(o.sym);
      return `<div class="sp-card"><div class="h"><span class="side-b ${o.side === "buy" ? "l" : "s"}">${o.side === "buy" ? "B" : "S"}</span><b class="sym">${esc(lbl(p, o.sym))}</b><span class="perp">Limit</span><span class="grow"></span><button class="btn btn-ghost btn-sm" data-cancel="${o.id}">Cancel</button></div>
      <div class="g"><div><span>Price</span><b class="num">${M.fmtPx(p, o.price)}</b></div><div><span>Amount (${esc(unitOf(p, o.sym))})</span><b class="num">${fmt(o.qty, qd(o.price, p))}</b></div><div><span>Filled</span><b class="num">0%</b></div><div><span>Side</span><b class="${o.side === "buy" ? "up" : "down"}">${o.side === "buy" ? "Buy" : "Sell"}</b></div><div><span>Total (USDT)</span><b class="num">${money(o.qty * o.price)}</b></div><div><span>Time</span><b class="num">${ds(o.ts)}</b></div></div></div>`; }).join("") : UI.emptyState("file", "No open orders");
    else if (ptab === "hold"){ const hs = holdings();
      list.innerHTML = hs.length ? hs.map(h => `<div class="sp-card"><div class="h">${M.get(h.sym) ? UI.pairIcon(M.get(h.sym), 26) : UI.coinImg(h.coin, 26)}<b class="sym">${esc(h.label)}</b><span class="grow"></span><a class="btn btn-ghost btn-sm" href="#/spot/${h.sym}">Trade</a></div>
        <div class="g"><div><span>Amount</span><b class="num">${fmt(h.qty, qd(h.price, M.get(h.sym)))}</b></div><div><span>Avg cost</span><b class="num">${M.fmtPx(M.get(h.sym), h.avg)}</b></div><div><span>Value (USDT)</span><b class="num">${money(h.value)}</b></div>
        <div><span>Unrealized PnL</span><b class="num ${h.pnl >= 0 ? "up" : "down"}">${signed(h.pnl)}</b></div><div><span>PnL %</span><b class="num ${h.pnl >= 0 ? "up" : "down"}">${signed(h.pct)}%</b></div><div><span>Available</span><b class="num">${fmt(h.avail, qd(h.price, M.get(h.sym)))}</b></div></div></div>`).join("") : UI.emptyState("wallet", "No holdings yet");
    } else { const hh = sp.history.filter(f).slice(0, 60);
      list.innerHTML = hh.length ? hh.map(x => { const p = M.get(x.sym);
        return `<div class="sp-card"><div class="h"><span class="side-b ${x.side === "buy" ? "l" : "s"}">${x.side === "buy" ? "B" : "S"}</span><b class="sym">${esc(lbl(p, x.sym))}</b><span class="perp">${x.type === "limit" ? "Limit" : "Market"}</span><span class="grow"></span><span class="label num" style="font-size:12px">${ds(x.ts)}</span></div>
        <div class="g"><div><span>Price</span><b class="num">${M.fmtPx(p, x.price)}</b></div><div><span>Amount (${esc(unitOf(p, x.sym))})</span><b class="num">${fmt(x.qty, qd(x.price, p))}</b></div><div><span>Fee (USDT)</span><b class="num">${fmt(x.fee, 4)}</b></div></div></div>`; }).join("") : UI.emptyState("history", "No trade history");
    }
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
    sl.oninput = () => { const v = +sl.value, snap = [0, 25, 50, 75, 100].find(x => Math.abs(x - v) <= 2); if (snap != null && snap !== v) sl.value = snap; setPct(snap ?? v); };
    $("#spq").addEventListener("input", () => { $("#sperr").textContent = ""; const m = maxQty(); sliderPct = m > 0 ? U.clamp((parseFloat($("#spq").value) || 0) / m * 100, 0, 100) : 0; $("#spsl").value = sliderPct; renderForm(); });
    $("#spp").addEventListener("input", () => { if (side === "buy" && sliderPct) setPct(sliderPct); else renderForm(); });
    $("#spgo").onclick = submit;
    $("#spbook").addEventListener("click", e => { const r = e.target.closest("[data-bp]"); if (!r) return; if (otype !== "limit") otype = "limit"; $("#spp").value = r.dataset.bp; if (side === "buy" && sliderPct) setPct(sliderPct); else renderForm(); toast("Limit price set to " + M.fmtPx(P(), +r.dataset.bp), "info", 1200); });
    root.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => setPtab(b.dataset.pt));
    $("#spcur").onchange = e => { curOnly = e.target.checked; renderList(); };
    $("[data-cancelall]").onclick = async () => { const l = spot().orders.filter(o => !curOnly || o.sym === sym); if (!l.length) return toast("No open orders", "info");
      if (await U.confirmBox("Cancel all orders", `Cancel ${l.length} open order${l.length > 1 ? "s" : ""}?`, "Cancel all", true)){ l.forEach(o => cancel(o.id)); toast("Orders cancelled", "ok"); } };
    $("#splist").addEventListener("click", e => { const c = e.target.closest("[data-cancel]"); if (c){ cancel(c.dataset.cancel); toast("Order cancelled", "ok"); } });
    $("[data-cch]").onclick = toggleChart;
    let tT = 0, bT = 0;
    offs.push(bus.on("tick", x => { if (x === sym && performance.now() - tT > 250){ tT = performance.now(); renderForm(); if (ptab === "hold") renderList(); if (!isCrypto) renderBook(); } }),
      bus.on("depth", x => { if (x === sym && performance.now() - bT > 400){ bT = performance.now(); renderBook(); } }),
      bus.on("spot", () => { renderForm(); renderBook(); renderList(); }), bus.on("balance", renderForm));
  }, unmount(){ offs.forEach(f => f()); timers.forEach(f => f()); unChart?.(); if (isCrypto) M.unwatchTrades(); }};
};
})();
