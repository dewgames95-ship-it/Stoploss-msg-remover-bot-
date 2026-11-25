/* ===== Options: buy-side Calls/Puts on crypto, Black-Scholes priced, cash-settled in USDT (demo) ===== */
(function(){
const {esc, ic, store, bus, money, signed, pct, mmss, toast} = U;
const UNDERS = ["BTC","ETH","BNB","SOL","XRP","DOGE"];
const IV0 = {BTC:.50, ETH:.60, BNB:.55, SOL:.75, XRP:.80, DOGE:.90};
const MINQ = {BTC:.01, ETH:.1, BNB:.1, SOL:1, XRP:100, DOGE:1000};
const STEP_PCT = {"15m":.005, "1h":.006, "4h":.0075, "d":.009, "w":.01};
const EXPS = [["15m","15m"],["1h","1H"],["4h","4H"],["d","Daily"],["w","Weekly"]];
const SPREAD = 1.01, FEE = .0003, YEAR = 365*24*3600*1000, CLOSE_HAIRCUT = .99;
const st = () => { const s = U.store.s; s.opt ||= {positions:[], history:[]}; return s.opt; };
const P = base => M.get(base + "USDT");
const spotOf = base => { const p = P(base); return p && p.price > 0 ? p.price : null; };

/* ---------- math ---------- */
function erf(x){ const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1/(1 + .3275911*x);
  return s*(1 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - .284496736)*t + .254829592)*t*Math.exp(-x*x)); }
const N = x => .5*(1 + erf(x/Math.SQRT2)), n = x => Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);
const ivFor = (base, K, S) => IV0[base] * (1 + .8*Math.pow(Math.log(K/S), 2)*10);
function bs(base, type, S, K, expMs, now){
  const T = Math.max(60000, expMs - now) / YEAR, iv = ivFor(base, K, S), sq = iv*Math.sqrt(T);
  const d1 = (Math.log(S/K) + .5*iv*iv*T)/sq, d2 = d1 - sq, call = type === "call";
  const price = call ? S*N(d1) - K*N(d2) : K*N(-d2) - S*N(-d1);
  return {price: Math.max(price, 1e-9), iv, delta: call ? N(d1) : N(d1) - 1, gamma: n(d1)/(S*sq),
    theta: -(S*n(d1)*iv)/(2*Math.sqrt(T))/365, vega: S*n(d1)*Math.sqrt(T)/100};
}
const intrinsic = (type, S, K) => type === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
/* mark value per unit; after expiry falls back to intrinsic */
const markNow = (pos, S) => pos.exp - Date.now() <= 0 ? intrinsic(pos.type, S, pos.strike) : bs(pos.base, pos.type, S, pos.strike, pos.exp, Date.now()).price;

/* ---------- time ---------- */
const pad = v => String(v).padStart(2, "0");
function nextExp(key, now){
  const H = 3600000, D = 86400000;
  const bound = per => { let e = Math.ceil(now/per)*per; if (e - now < 60000) e += per; return e; };
  if (key === "15m") return bound(900000);
  if (key === "1h") return bound(H);
  if (key === "4h") return bound(4*H);
  if (key === "d") return bound(D);
  const d = new Date(now), base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8);
  let e = base + ((5 - d.getUTCDay() + 7) % 7)*D; if (e - now < 60000) e += 7*D; return e;
}
function symName(pos){ const d = new Date(pos.exp);
  return `${pos.base}-${pad(d.getUTCFullYear()%100)}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}-${pos.strike}-${pos.type === "call" ? "C" : "P"}`; }
const expLabel = ms => { const d = new Date(ms); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth()+1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`; };
function cd(ms){ const s = Math.max(0, Math.floor(ms/1000)); if (s >= 86400) return `${Math.floor(s/86400)}d ${Math.floor(s%86400/3600)}h`; if (s >= 3600) return `${Math.floor(s/3600)}h ${pad(Math.floor(s%3600/60))}m`; return mmss(s); }
const dtStr = ms => U.dateStr ? U.dateStr(ms) : new Date(ms).toLocaleString("en-US");

/* ---------- formatting ---------- */
const fp = v => v < 1e-4 ? "<0.0001" : v >= 100 ? money(v) : v >= 1 ? v.toFixed(3) : v >= .01 ? v.toFixed(4) : v.toFixed(6);
const fq = (q, base) => q.toFixed(MINQ[base] < 1 ? 2 : 0).replace(/\.?0+$/, m => m.includes(".") ? "" : m);
function niceStep(raw){ const mag = Math.pow(10, Math.floor(Math.log10(raw))); let best = mag, bd = 1e9;
  [1, 2, 2.5, 5, 10].forEach(m => { const d = Math.abs(Math.log(m*mag/raw)); if (d < bd){ bd = d; best = m*mag; } }); return best; }
const px = (base, v) => { const p = P(base); return p ? M.fmtPx(p, v) : String(v); };
const fnum = (v, dp = 3) => (v < 0 ? "-" : "") + Math.abs(v).toFixed(dp);

/* ---------- global settlement ---------- */
let refresh = null;
function settleDue(){
  const o = st(), now = Date.now(); let any = false;
  for (const pos of o.positions.slice()){
    if (pos.exp > now) continue;
    const S = spotOf(pos.base); if (S == null) continue;
    const payout = intrinsic(pos.type, S, pos.strike) * pos.qty, pnl = payout - pos.cost, itm = payout > 0;
    o.positions = o.positions.filter(x => x.id !== pos.id);
    o.history.unshift({...pos, result: itm ? "Exercised" : "Expired worthless", payout, pnl, settle: S, closed: now});
    o.history = o.history.slice(0, 100);
    if (payout > 0) store.addWallet("options", payout, "option"); else store.save();
    store.notify("Option settled", `${symName(pos)} ${itm ? "exercised" : "expired worthless"}. Payout ${money(payout)} USDT (${signed(pnl)}).`, itm && pnl > 0 ? "ok" : "info");
    U.fx(payout > pos.cost ? "win" : "loss");
    toast(`${symName(pos)} ${itm ? "exercised" : "expired worthless"}: ${signed(pnl)} USDT`, pnl > 0 ? "ok" : "info", 3400);
    any = true;
  }
  if (any) refresh?.();
}
U.bus.on("sec", settleDue);

/* ---------- payoff chart ---------- */
function payoffSvg(type, K, S, cost, qty, w = 320, h = 104){
  const lo = S*.9, hi = S*1.1, steps = 48, pad = {t:8, b:8, l:4, r:4};
  const pnl = x => intrinsic(type, x, K)*qty - cost;
  const pts = []; for (let i = 0; i <= steps; i++){ const x = lo + (hi - lo)*i/steps; pts.push([x, pnl(x)]); }
  const ys = pts.map(p => p[1]), yMax = Math.max(...ys, cost*.2), yMin = Math.min(...ys, -cost);
  const X = x => pad.l + (x - lo)/(hi - lo)*(w - pad.l - pad.r), Y = y => pad.t + (yMax - y)/(yMax - yMin || 1)*(h - pad.t - pad.b);
  const line = pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(""), z = Y(0).toFixed(1);
  const be = type === "call" ? K + cost/qty : K - cost/qty, id = "op" + Math.random().toString(36).slice(2, 7);
  const area = line + `L${X(hi).toFixed(1)} ${z}L${X(lo).toFixed(1)} ${z}Z`;
  const mk = (x, cls) => x >= lo && x <= hi ? `<line class="${cls}" x1="${X(x).toFixed(1)}" x2="${X(x).toFixed(1)}" y1="${pad.t}" y2="${h - pad.b}"/>` : "";
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="op-pay" role="img" aria-label="Payoff at expiry">
    <defs><clipPath id="${id}a"><rect x="0" y="0" width="${w}" height="${z}"/></clipPath><clipPath id="${id}b"><rect x="0" y="${z}" width="${w}" height="${h}"/></clipPath></defs>
    <path d="${area}" class="op-pa-up" clip-path="url(#${id}a)"/><path d="${area}" class="op-pa-dn" clip-path="url(#${id}b)"/>
    <line class="op-pz" x1="0" x2="${w}" y1="${z}" y2="${z}"/>${mk(S, "op-ps")}${mk(be, "op-pb")}
    <path d="${line}" class="op-pl-up" clip-path="url(#${id}a)"/><path d="${line}" class="op-pl-dn" clip-path="url(#${id}b)"/></svg>
    <div class="op-pleg"><span class="num">${(+lo.toPrecision(5))}</span><span class="op-pbe">Breakeven <b class="num">${(+be.toPrecision(5))}</b></span><span class="num">${(+hi.toPrecision(5))}</span></div>`;
}

/* live price history for the mini line (kept across visits) */
const HIST = {};
function sample(){ UNDERS.forEach(b => { const S = spotOf(b); if (S == null) return; const h = HIST[b] ||= []; h.push(S); if (h.length > 90) h.shift(); }); }
let sampN = 0; U.bus.on("sec", () => { if (++sampN % 4 === 0) sample(); });
const TGTS = [["Near", "ATM", 0], ["Moderate", "+1 step", 1], ["Aggressive", "+3 steps", 3]];
const AMTS = [10, 50, 100, 500];
const INFO = ["<b>Pick a direction.</b> Call = you expect the price to go up. Put = you expect it to go down.", "<b>Pay a small premium.</b> That premium is the most you can lose. There are no liquidations and no margin calls.", "<b>Settled at expiry.</b> If the price ends beyond your target (strike), you receive the difference in USDT. Otherwise the option expires worthless.", "<b>Sell early anytime.</b> You can close before expiry at the current mark value, so you do not have to wait."];

/* ---------- page ---------- */
Pages.options = (params) => {
  let base = String(params[0] || sessionStorage.getItem("lastSym_options") || "BTC").toUpperCase().replace(/USDT$/, "");
  if (!UNDERS.includes(base)) base = "BTC";
  try { sessionStorage.setItem("lastSym_options", base); } catch {}
  let root, offs = [], side = "call", expKey = "1h", ptab = "pos", tT = 0, tTimer = 0, closeSheetOff = null, tgt = 0, amt = 50, amtMax = false;
  let mode = "simple"; try { mode = localStorage.getItem("opMode") === "pro" ? "pro" : "simple"; } catch {}
  const $ = q => root.querySelector(q), s = () => store.s;

  const html = `
  <div class="tabs" style="gap:20px;margin:0 -16px;padding:4px 16px 0;border:0"><a class="tab" href="#/futures/BTCUSDT" style="font-size:17px">USDⓈ-M</a><a class="tab" href="#/spot/BTCUSDT" style="font-size:17px">Spot</a><a class="tab" href="#/trade/BTCUSDT" style="font-size:17px">Binary</a><button class="tab on" style="font-size:17px">Options</button><a class="tab" href="#/copy" style="font-size:17px">Copy</a><a class="tab" href="#/bots" style="font-size:17px">Bots</a></div>
  <div class="op-top"><div class="seg op-mode" id="opMode"><button data-mode="simple">Simple</button><button data-mode="pro">Pro</button></div><button class="op-help" id="opHelp" aria-label="How options work">${ic("info",16)}<span>How it works</span></button></div>
  <header class="fx-head" id="opHead"><div class="grow"><button class="nm" data-pick aria-label="Choose underlying">${P(base) ? UI.pairIcon(P(base), 24) : ""}<span>${base}</span><span class="perp">Options</span>${ic("chevd",16)}</button></div>
    <div class="op-hpx"><b class="num" id="opLp">--</b><span class="num" id="opChg"></span></div></header>
  <div class="op-wrap">
    <section class="op-main">
      <div id="opSimple" class="op-simple"></div>
      <div id="opPro">
      <div class="op-exps" id="opExps"></div>
      <div class="op-bar"><div class="seg op-seg" id="opSide"><button data-side="call" class="on">Calls</button><button data-side="put">Puts</button></div></div>
      <div class="op-note">${ic("info",14)}<span>Max loss = premium paid. Cash-settled in USDT at expiry.</span></div>
      <div class="op-chain" id="opChain"></div>
      </div>
    </section>
    <section class="op-side">
      <h3 class="op-h3">My options</h3><div class="ptabs op-ptabs"><button class="on" data-pt="pos">Positions (<span id="opPc">0</span>)</button><button data-pt="hist">History</button></div>
      <div id="opList"></div>
    </section>
  </div>`;

  const expOf = key => nextExp(key, Date.now());
  // strike spacing ≈ 0.35σ of the expected move to expiry (tight for 15m, wide for weekly) → meaningful deltas
  const stepOf = S => { const T = Math.max(60e3, expOf(expKey) - Date.now()) / (365*864e5), sig = S * (IV0[base] || .7) * Math.sqrt(T);
    return niceStep(Math.max(S*0.0004, Math.min(S*STEP_PCT[expKey]*1.6, sig*0.35))); };

  function renderHead(){
    const p = P(base), el = $("#opLp"); if (!el) return;
    if (!p || !(p.price > 0)){ el.textContent = "--"; $("#opChg").textContent = ""; return; }
    el.textContent = M.fmtPx(p); el.className = "num " + (p.dir >= 0 ? "up" : "down");
    const c = $("#opChg"); c.className = "num " + ((p.chg||0) < 0 ? "down" : "up"); c.textContent = p.chg == null ? "" : pct(p.chg);
  }
  function renderExps(){
    $("#opExps").innerHTML = EXPS.map(([k, l]) => `<button class="op-exp ${k === expKey ? "on" : ""}" data-exp="${k}"><b>${l}</b><small class="num" data-ecd="${k}">${cd(expOf(k) - Date.now())}</small></button>`).join("");
  }
  function tickExps(){ root.querySelectorAll("[data-ecd]").forEach(e => e.textContent = cd(expOf(e.dataset.ecd) - Date.now())); }
  function renderChain(){
    const S = spotOf(base), box = $("#opChain"); if (!box) return;
    if (S == null){ box.innerHTML = UI.emptyState("clock", "Connecting to live prices…"); return; }
    const exp = expOf(expKey), step = stepOf(S), atm = Math.round(S/step)*step, now = Date.now(); let rows = "", spotDone = false;
    const spotRow = `<div class="op-spot"><i></i><span>ATM · spot <b class="num">${px(base, S)}</b></span><i></i></div>`;
    for (let i = -5; i <= 5; i++){
      const K = +(atm + i*step).toPrecision(10); if (K <= 0) continue;
      if (!spotDone && K > S){ rows += spotRow; spotDone = true; }
      const g = bs(base, side, S, K, exp, now), itm = side === "call" ? K < S : K > S;
      rows += `<div class="op-row ${itm ? "itm" : ""}"><b class="num op-k">${px(base, K)}</b><span class="num">${fp(g.price)}</span><span class="num op-d">${fnum(g.delta, 2)}</span><button class="btn btn-primary btn-sm op-buy" data-buy="${K}">Buy</button></div>`;
    }
    if (!spotDone) rows += spotRow;
    box.innerHTML = `<div class="op-row op-hd"><span>Strike</span><span>Mark (USDT)</span><span>Delta</span><span></span></div>` + rows;
  }
  function setPtab(k){ ptab = k; root.querySelectorAll("[data-pt]").forEach(b => b.classList.toggle("on", b.dataset.pt === k)); renderList(); }
  function renderList(){
    const o = st(), list = $("#opList"); if (!list) return; $("#opPc").textContent = o.positions.length;
    if (ptab === "pos"){
      list.innerHTML = o.positions.length ? o.positions.slice().reverse().map(pos => `<div class="pc op-pc" data-id="${pos.id}">
        <div class="pc-h"><span class="sym op-sym">${esc(symName(pos))}</span><span class="perp op-${pos.type}">${pos.type === "call" ? "Call" : "Put"}</span><span class="grow"></span><b class="num brand-c" data-cd></b></div>
        <div class="op-hero"><div><span>Unrealized PNL (USDT)</span><b class="num" data-pnl>--</b></div><div class="op-r"><span>ROI</span><b class="num" data-roi>--</b></div></div>
        <div class="pc-g"><div><span>Quantity</span><b class="num">${fq(pos.qty, pos.base)} ${pos.base}</b></div><div><span>Strike</span><b class="num">${px(pos.base, pos.strike)}</b></div><div><span>Cost (USDT)</span><b class="num">${money(pos.cost)}</b></div><div><span>Mark value</span><b class="num" data-val></b></div></div>
        <div class="op-act"><span class="op-exl">Expires ${expLabel(pos.exp)}</span><button class="btn btn-ghost btn-sm" data-close="${pos.id}">Close</button></div></div>`).join("") : UI.emptyState("file", "No open options");
      tickList();
    } else {
      const h = o.history.slice(0, 60);
      list.innerHTML = h.length ? h.map(x => `<div class="pc op-pc"><div class="pc-h"><span class="sym op-sym">${esc(symName(x))}</span><span class="perp op-${x.type}">${x.type === "call" ? "Call" : "Put"}</span><span class="grow"></span><span class="label">${esc(x.result)}</span></div>
        <div class="ph-g"><div><span>PNL (USDT)</span><b class="num ${x.pnl > 0 ? "up" : x.pnl < 0 ? "down" : ""}">${signed(x.pnl)}</b></div><div><span>Payout</span><b class="num">${money(x.payout)}</b></div><div><span>Settle price</span><b class="num">${px(x.base, x.settle)}</b></div></div>
        <div class="ph-t"><span>Closed</span><b>${dtStr(x.closed)}</b></div></div>`).join("") : UI.emptyState("history", "No history");
    }
  }
  function tickList(){
    if (ptab !== "pos" || !root) return; const now = Date.now();
    st().positions.forEach(pos => { const r = root.querySelector(`.op-pc[data-id="${pos.id}"]`); if (!r) return;
      r.querySelector("[data-cd]").textContent = cd(pos.exp - now);
      const S = spotOf(pos.base); if (S == null) return;
      const val = markNow(pos, S)*pos.qty, pnl = val - pos.cost, roi = pnl/pos.cost*100;
      r.querySelector("[data-val]").textContent = money(val);
      const a = r.querySelector("[data-pnl]"), b = r.querySelector("[data-roi]"), c = pnl > 0 ? "up" : pnl < 0 ? "down" : "";
      a.textContent = signed(pnl); b.textContent = pct(roi); a.className = b.className = "num " + c; });
  }
  function renderAll(){ renderHead(); renderChain(); renderList(); }

  function commit(K, exp, qty, c){
    const cost = Math.round(c.cost*100)/100; if (cost > store.wb("options") + 1e-9) return false;
    store.addWallet("options", -cost, "option");
    st().positions.push({id: U.uid(), base, type: side, strike: K, exp, qty, cost, entryMark: c.g.price, iv: c.g.iv, open: Date.now()});
    store.save(); U.fx("open"); toast("Option bought", "ok");
    store.notify("Option bought", `${qty} ${base} ${side} ${px(base, K)} for ${money(cost)} USDT`, "ok");
    setPtab("pos"); renderList(); return true;
  }
  const quote = (sd, K, exp, qty) => { const S = spotOf(base); if (S == null) return null; const g = bs(base, sd, S, K, exp, Date.now());
    const prem = g.price*qty*SPREAD, fee = Math.min(qty*S*FEE, prem*.1), cost = prem + fee;
    return {S, g, prem, fee, cost, be: sd === "call" ? K + cost/qty : K - cost/qty}; };

  /* ---- Simple mode ---- */
  const tgtStrikes = S => { const step = stepOf(S), atm = Math.round(S/step)*step;
    return TGTS.map(([nm, sub, k]) => { const K = +(atm + (side === "call" ? k : -k)*step).toPrecision(10); return {nm, sub, K}; }); };
  function simpleCalc(){
    const S = spotOf(base); if (S == null) return null;
    const exp = expOf(expKey), min = MINQ[base], t = tgtStrikes(S)[tgt], K = t.K;
    const unit = quote(side, K, exp, 1).cost, bal = store.wb("options");
    const spend = amtMax ? bal : amt;
    let qty = Math.floor(spend/unit/min + 1e-9)*min; qty = +qty.toPrecision(8);
    const c = qty > 0 ? quote(side, K, exp, qty) : null;
    return {S, exp, min, K, unit, qty, c, spend, bal};
  }
  function renderSimple(){
    const box = $("#opSimple"); if (!box) return;
    const p = P(base), S = spotOf(base);
    box.innerHTML = `
      <button class="op-und" data-pick2 aria-label="Choose underlying">
        <span class="op-und-l">${p ? UI.pairIcon(p, 36) : ""}<span class="op-und-n"><b>${base}</b><small>${base}/USDT · <i class="op-pulse"></i>Live</small></span></span>
        <span class="op-und-spark" id="sSpark"></span>
        <span class="op-und-r"><b class="num" id="sPx">--</b><span class="num" id="sChg"></span></span></button>
      <div class="op-dir" id="sDir">
        <button class="op-up ${side === "call" ? "on" : ""}" data-side="call"><span class="op-dir-i">${ic("up",18,2)}</span><b>Price will go UP</b><small>Buy Call</small></button>
        <button class="op-dn ${side === "put" ? "on" : ""}" data-side="put"><span class="op-dir-i">${ic("down",18,2)}</span><b>Price will go DOWN</b><small>Buy Put</small></button></div>
      <div class="op-sec">Expiry</div>
      <div class="op-exps op-sexps" id="sExps"></div>
      <div class="op-sec">Target price (strike)</div>
      <div class="op-tgts" id="sTgts"></div>
      <div class="op-sec">Amount <span class="op-avbl">Avbl <b class="num" id="sBal">${money(store.wb("options"))}</b> USDT <button class="wl-plus" data-wlto="options" aria-label="Transfer in">${ic("plus",13,3)}</button></span></div>
      <div class="famt op-amt" id="sF"><input id="sAmt" type="number" inputmode="decimal" min="0" aria-label="Amount in USDT" placeholder="0.00"><span>USDT</span></div>
      <div class="op-amts" id="sAmts">${AMTS.map(a => `<button data-a="${a}">${a}</button>`).join("")}<button data-a="max">Max</button></div>
      <div class="op-qty" id="sQty"></div>
      <div class="op-sum" id="sSum"></div>
      <button class="btn op-go" id="sGo">Buy Call</button>
      <div class="op-note">${ic("info",14)}<span>Max loss = amount paid. Cash-settled in USDT at expiry.</span></div>`;
    $("#sAmt").value = amtMax ? "" : amt; $("#sAmt").placeholder = amtMax ? "Max" : "0.00";
    renderSExps(); renderSLive(); renderSDyn();
  }
  function renderSExps(){
    const b = $("#sExps"); if (!b) return;
    b.innerHTML = EXPS.map(([k, l]) => `<button class="op-exp ${k === expKey ? "on" : ""}" data-exp="${k}"><b>${l}</b><small class="num" data-ecd="${k}">${cd(expOf(k) - Date.now())}</small></button>`).join("");
  }
  function renderSLive(){
    const el = $("#sPx"); if (!el) return; const p = P(base);
    if (!p || !(p.price > 0)){ el.textContent = "--"; $("#sChg").textContent = ""; }
    else { el.textContent = M.fmtPx(p); const c = $("#sChg"); c.className = "num " + ((p.chg||0) < 0 ? "down" : "up"); c.textContent = p.chg == null ? "" : pct(p.chg); }
    const h = HIST[base] || [], sp = $("#sSpark");
    if (sp) sp.innerHTML = h.length >= 2 ? U.spark(h, 90, 34) : `<i class="op-flat"></i>`;
  }
  function renderSDyn(){
    if (mode !== "simple" || !$("#sTgts")) return;
    const S = spotOf(base), isC = side === "call";
    const go = $("#sGo"); go.className = "btn op-go " + (isC ? "btn-up" : "btn-down"); go.textContent = isC ? "Buy Call" : "Buy Put";
    root.querySelectorAll("#sAmts [data-a]").forEach(b => b.classList.toggle("on", amtMax ? b.dataset.a === "max" : +b.dataset.a === amt));
    if (S == null){ $("#sTgts").innerHTML = UI.emptyState("clock", "Connecting to live prices…"); $("#sSum").innerHTML = ""; $("#sQty").innerHTML = ""; return; }
    const exp = expOf(expKey), ts = tgtStrikes(S);
    $("#sTgts").innerHTML = ts.map((t, i) => { const g = quote(side, t.K, exp, 1).g;
      return `<button class="op-tg ${i === tgt ? "on" : ""}" data-t="${i}"><span class="op-tg-n"><b>${t.nm}</b><small>${t.sub === "ATM" ? "ATM" : t.sub}</small></span>
        <span class="op-tg-k"><b class="num">${px(base, t.K)}</b><small>Strike</small></span>
        <span class="op-tg-k"><b class="num">${fp(g.price*SPREAD)}</b><small>Premium / ${base}</small></span>
        <span class="op-tg-k op-tg-p"><b class="num">${Math.round(Math.abs(g.delta)*100)}%</b><small>Probability ≈</small></span></button>`; }).join("");
    const d = simpleCalc(); if (!d) return;
    const aEl = $("#sAmt"); if (amtMax && document.activeElement !== aEl) aEl.value = "";
    $("#sBal").textContent = money(d.bal);
    const q = $("#sQty");
    if (!d.c){ q.innerHTML = `<span>Quantity</span><b class="num">Min ${fq(d.min, base)} ${base} ≈ ${money(d.unit*d.min)} USDT</b>`; $("#sSum").innerHTML = ""; return; }
    const c = d.c; q.innerHTML = `<span>Quantity</span><b class="num">${fq(d.qty, base)} ${base}</b>`;
    const rowsT = (isC ? [2, 5, 10] : [-2, -5, -10]).map(pc => { const T = d.S*(1 + pc/100), pr = intrinsic(side, T, d.K)*d.qty - c.cost, roi = pr/c.cost*100;
      return `<div><span class="num">${pc > 0 ? "+" : ""}${pc}% · ${px(base, T)}</span><b class="num ${pr > 0 ? "up" : "down"}">${signed(pr)}</b><em class="num ${pr > 0 ? "up" : "down"}">${pct(roi)}</em></div>`; }).join("");
    $("#sSum").innerHTML = `
      <div class="op-sum-big"><div><span>You pay (max loss)</span><b class="num">${money(c.cost)} <small>USDT</small></b></div><div class="op-r"><span>Breakeven</span><b class="num">${px(base, c.be)}</b></div></div>
      <div class="op-sum-mid"><span>Max profit</span><b class="num ${""}">${isC ? "Unlimited" : "up to " + money(Math.max(0, d.K*d.qty - c.cost)) + " USDT"}</b></div>
      <div class="op-pw">${payoffSvg(side, d.K, d.S, c.cost, d.qty)}</div>
      <div class="op-sec" style="margin:14px 0 6px">Profit if price reaches</div><div class="op-pi">${rowsT}</div>`;
  }
  async function simpleBuy(){
    const d = simpleCalc(); if (!d) return toast("Waiting for live price", "bad");
    const bad = m => { $("#sF").classList.add("err"); toast(m, "bad"); UI.walletErr(m); };
    if (!d.c) return bad(`Minimum is about ${money(d.unit*d.min)} USDT`);
    if (d.exp - Date.now() < 30000) return toast("This expiry is about to close. Pick another.", "bad");
    if (Math.round(d.c.cost*100)/100 > store.wb("options") + 1e-9) return bad("Insufficient Options balance");
    const isC = side === "call", k = d.c;
    const ok = U.confirmTrade ? await U.confirmTrade({kind: "option", title: isC ? "Confirm Buy Call" : "Confirm Buy Put", sub: `${base}-${isC ? "C" : "P"} ${px(base, d.K)}`,
      rows: [["Expires", expLabel(d.exp)], ["Strike", px(base, d.K)], ["Quantity", `${fq(d.qty, base)} ${base}`], ["Total cost", `${money(k.cost)} USDT`], ["Breakeven", px(base, k.be)]], okText: isC ? "Buy Call" : "Buy Put", tone: isC ? "up" : "down"}) : true;
    if (!ok) return;
    const c = quote(side, d.K, d.exp, d.qty); if (!c) return;
    if (!commit(d.K, d.exp, d.qty, c)) bad("Insufficient Options balance");
  }
  function setMode(m){
    mode = m; try { localStorage.setItem("opMode", m); } catch {}
    root.querySelectorAll("#opMode [data-mode]").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
    $("#opSimple").hidden = m !== "simple"; $("#opPro").hidden = m !== "pro"; $("#opHead").hidden = m !== "pro";
    root.querySelectorAll("#opSide button").forEach(x => x.classList.toggle("on", x.dataset.side === side));
    if (m === "simple") renderSimple(); else renderAll();
  }
  function infoSheet(){ U.sheet("How options work", `<ol class="op-how">${INFO.map((t, i) => `<li><i>${i + 1}</i><span>${t}</span></li>`).join("")}</ol><button class="btn btn-primary btn-block" data-ok style="margin-top:12px;height:46px">Got it</button>`, el => el.querySelector("[data-ok]").onclick = () => U.closeLayer()); }

  /* ---- order sheet ---- */
  function buySheet(K){
    const exp = expOf(expKey), min = MINQ[base]; let qty = min, off = null;
    const body = `<div class="op-os">
      <div class="op-os-h"><span class="perp op-${side}">${side === "call" ? "Call" : "Put"}</span><b class="num">${base}-${side === "call" ? "C" : "P"} ${px(base, K)}</b><span class="grow"></span><span class="op-exl">Expires ${expLabel(exp)}</span></div>
      <div class="op-pw" id="osPay"></div>
      <div class="label" style="margin:12px 0 6px">Quantity (${base})</div>
      <div class="famt" id="osF"><input id="osQ" type="number" inputmode="decimal" min="${min}" step="${min}" aria-label="Quantity"><span>${base}</span></div>
      <div class="chips" id="osC">${[1,2,5,10,25].map(m => `<button data-m="${m}">${fq(min*m, base)}</button>`).join("")}</div>
      <div class="op-grk" id="osG"></div>
      <div class="op-kv" id="osK"></div>
      <button class="btn btn-primary btn-block" id="osGo" style="margin-top:14px;height:46px">Buy ${side === "call" ? "Call" : "Put"}</button>
      <div class="op-note" style="margin-top:10px">${ic("info",14)}<span>Max loss = premium paid. Cash-settled in USDT at expiry.</span></div></div>`;
    const calc = () => { const S = spotOf(base); if (S == null) return null; const g = bs(base, side, S, K, exp, Date.now());
      const prem = g.price*qty*SPREAD, fee = Math.min(qty*S*FEE, prem*.1), cost = prem + fee;
      return {S, g, prem, fee, cost, be: side === "call" ? K + cost/qty : K - cost/qty}; };
    U.sheet("Buy Option", body, el => {
      const q = el.querySelector("#osQ"); q.value = qty;
      const upd = () => { const c = calc(), ok = c && qty > 0; if (!c) return;
        el.querySelector("#osPay").innerHTML = ok ? payoffSvg(side, K, c.S, c.cost, qty) : "";
        el.querySelector("#osG").innerHTML = [["IV", (c.g.iv*100).toFixed(1) + "%"], ["Delta", fnum(c.g.delta)], ["Gamma", c.g.gamma.toExponential(2)], ["Theta/d", fnum(c.g.theta, 2)], ["Vega", fnum(c.g.vega, 2)]].map(([k, v]) => `<div><span>${k}</span><b class="num">${v}</b></div>`).join("");
        el.querySelector("#osK").innerHTML = `<div class="fkv"><span>Mark price</span><b class="num">${fp(c.g.price)} USDT</b></div><div class="fkv"><span>Premium (incl. spread)</span><b class="num">${money(c.prem)}</b></div><div class="fkv"><span>Fee</span><b class="num">${money(c.fee)}</b></div>
          <div class="fkv op-tot"><span>Total cost</span><b class="num">${money(c.cost)} USDT</b></div><div class="fkv"><span>Max loss</span><b class="num down">${money(c.cost)} USDT</b></div><div class="fkv"><span>Breakeven</span><b class="num">${px(base, c.be)}</b></div><div class="fkv"><span>Avbl balance</span><b class="num">${money(store.wb("options"))} USDT</b></div>`; };
      upd();
      q.addEventListener("input", () => { qty = parseFloat(q.value) || 0; el.querySelector("#osF").classList.remove("err"); upd(); });
      el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { qty = +(min*b.dataset.m).toPrecision(8); q.value = qty; upd(); });
      el.querySelector("#osGo").onclick = () => {
        const c = calc(), bad = m => { el.querySelector("#osF").classList.add("err"); toast(m, "bad"); UI.walletErr(m); };
        if (!c) return toast("Waiting for live price", "bad");
        if (!(qty > 0)) return bad("Enter a quantity");
        if (qty < min - 1e-12) return bad(`Minimum quantity is ${fq(min, base)} ${base}`);
        if (exp - Date.now() < 30000) return bad("This expiry is about to close. Pick another.");
        if (!commit(K, exp, qty, c)) return bad("Insufficient Options balance");
        U.closeLayer();
      };
      const t = bus.on("tick", x => { if (x === base && performance.now() - tT > 250){ tT = performance.now(); upd(); } }), sc = bus.on("balance", upd);
      off = () => { t(); sc(); };
    }, () => off?.());
  }
  function closePos(id){
    const o = st(), pos = o.positions.find(x => x.id === id), S = pos && spotOf(pos.base); if (!pos || S == null) return;
    const mark = markNow(pos, S), payout = mark*pos.qty*CLOSE_HAIRCUT, pnl = payout - pos.cost;
    o.positions = o.positions.filter(x => x.id !== id);
    o.history.unshift({...pos, result: "Closed", payout, pnl, settle: S, closed: Date.now()}); o.history = o.history.slice(0, 100);
    store.addWallet("options", payout, "option"); U.fx("close");
    toast(`Closed ${symName(pos)}: ${signed(pnl)} USDT`, pnl >= 0 ? "ok" : "info");
    store.notify("Option closed", `${symName(pos)} sold for ${money(payout)} USDT (${signed(pnl)})`, "info");
    renderList();
  }
  function pickSheet(){
    U.sheet("Underlying", UNDERS.map(b => { const p = P(b); return `<button class="list-item" style="width:100%" data-u="${b}">${p ? UI.pairIcon(p, 32) : ""}<span class="grow" style="font-weight:600;text-align:left">${b}<small class="op-sub"> ${b}/USDT</small></span><span class="num" style="text-align:right">${p?.price ? M.fmtPx(p) : "--"}</span>${b === base ? `<span class="brand-c">${ic("check",18)}</span>` : ""}</button>`; }).join(""), el => {
      el.querySelectorAll("[data-u]").forEach(b => b.onclick = () => { U.closeLayer(); if (b.dataset.u !== base) location.hash = "#/options/" + b.dataset.u; }); });
  }

  return {html, title: base + " Options", mount(r){
    root = r; refresh = () => { renderList(); renderChain(); renderSDyn(); };
    renderExps(); renderAll();
    $("[data-pick]").onclick = pickSheet;
    $("#opMode").onclick = e => { const b = e.target.closest("[data-mode]"); if (b && b.dataset.mode !== mode) setMode(b.dataset.mode); };
    $("#opHelp").onclick = infoSheet;
    const sm = $("#opSimple");
    sm.onclick = e => { const x = e.target;
      if (x.closest("[data-pick2]")) return pickSheet();
      let b;
      if ((b = x.closest("#sDir [data-side]"))){ side = b.dataset.side; root.querySelectorAll("#sDir button").forEach(y => y.classList.toggle("on", y === b)); return renderSDyn(); }
      if ((b = x.closest("[data-exp]"))){ expKey = b.dataset.exp; renderSExps(); return renderSDyn(); }
      if ((b = x.closest("[data-t]"))){ tgt = +b.dataset.t; return renderSDyn(); }
      if ((b = x.closest("#sAmts [data-a]"))){ if (b.dataset.a === "max"){ amtMax = true; } else { amtMax = false; amt = +b.dataset.a; $("#sAmt").value = amt; } $("#sF").classList.remove("err"); return renderSDyn(); }
      if (x.closest("#sGo")) simpleBuy(); };
    sm.addEventListener("input", e => { if (e.target.id !== "sAmt") return; amtMax = false; amt = parseFloat(e.target.value) || 0; $("#sF").classList.remove("err"); renderSDyn(); });
    setMode(mode);
    $("#opExps").onclick = e => { const b = e.target.closest("[data-exp]"); if (!b) return; expKey = b.dataset.exp; renderExps(); renderChain(); };
    $("#opSide").onclick = e => { const b = e.target.closest("[data-side]"); if (!b) return; side = b.dataset.side; root.querySelectorAll("#opSide button").forEach(x => x.classList.toggle("on", x === b)); renderChain(); };
    $("#opChain").onclick = e => { const b = e.target.closest("[data-buy]"); if (b) buySheet(+b.dataset.buy); };
    $("#opList").onclick = e => { const b = e.target.closest("[data-close]"); if (b) closePos(b.dataset.close); };
    root.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => setPtab(b.dataset.pt));
    const onTick = x => { if (x !== base) return; renderHead(); if (tTimer) return;
      const wait = Math.max(0, 250 - (performance.now() - tT)); tTimer = setTimeout(() => { tTimer = 0; tT = performance.now(); if (!root) return; if (mode === "simple"){ renderSLive(); renderSDyn(); } else renderChain(); tickList(); }, wait); };
    let lastExp = EXPS.map(([k]) => expOf(k)).join();
    offs.push(bus.on("tick", onTick), bus.on("list", () => { renderAll(); if (mode === "simple") renderSimple(); }), bus.on("meta", x => x === base && renderHead()), bus.on("balance", () => { if (mode === "simple" && amtMax) renderSDyn(); }),
      bus.on("sec", () => { const cur = EXPS.map(([k]) => expOf(k)).join(); if (cur !== lastExp){ lastExp = cur; renderExps(); renderSExps(); renderChain(); renderSDyn(); } else tickExps(); if (mode === "simple") renderSLive(); tickList(); }));
  }, unmount(){ offs.forEach(f => f()); offs = []; clearTimeout(tTimer); tTimer = 0; refresh = null; root = null; }};
};
})();
