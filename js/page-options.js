/* ===== Options: buy-side Calls/Puts on crypto, Black-Scholes priced, cash-settled in USDT (demo) ===== */
(function(){
const {esc, ic, store, bus, money, signed, pct, mmss, toast} = U;
const UNDERS = ["BTC","ETH","BNB","SOL","XRP","DOGE"];
const IV0 = {BTC:.50, ETH:.60, BNB:.55, SOL:.75, XRP:.80, DOGE:.90};
const MINQ = {BTC:.01, ETH:.1, BNB:.1, SOL:1, XRP:100, DOGE:1000};
const STEP_PCT = {"15m":.005, "1h":.006, "4h":.0075, "d":.009, "w":.01};
/* K5: sensible % distances per expiry, so a fresh trade is not deep out of the money */
const DIST = {"15m":[.001,.002,.003,.005], "1h":[.002,.005,.01,.015], "4h":[.003,.006,.01,.02], "d":[.005,.01,.02,.03], "w":[.01,.02,.04,.06]};
const ENTRY_C = "#F0B90B";
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


/* ---------- beginner help popups (UI.help is shared: other pages may reuse it) ---------- */
UI.help ||= function(title, html){
  U.sheet(title, `<div class="hp">${html}</div><button class="btn btn-primary btn-block hp-ok" data-ok>Got it</button>`, el => { const b = el.querySelector("[data-ok]"); if (b) b.onclick = () => U.closeLayer(); });
};
const hq = k => `<i class="hq" role="button" tabindex="0" data-help="${k}" aria-label="Help">?</i>`;
const hqx = (k, a) => `<i class="hq" role="button" tabindex="0" data-help="${k}" data-ha="${a}" aria-label="Help">?</i>`;
const sizeTxt = pos => `${money(pos.qty*(pos.entrySpot || pos.strike))} USDT / ${fq(pos.qty, pos.base)} ${pos.base}`;
const hsv = (vb, inner, label) => `<svg class="hp-svg" viewBox="${vb}" role="img" aria-label="${label}">${inner}</svg>`;
const HELP = {
  strike: ["Strike (target price)", () => `<p>The <b>strike</b> is the price you are betting on. It is the line the market price must cross by the expiry time.</p>
    ${hsv("0 0 320 120", `<rect class="hp-win" x="8" y="12" width="304" height="44" rx="6"/><line class="hp-ln" x1="8" y1="56" x2="312" y2="56"/><text class="hp-t hp-b" x="14" y="72">Strike</text><text class="hp-t hp-up" x="16" y="30">Call (UP) wins above this line</text><rect class="hp-lose" x="8" y="57" width="304" height="44" rx="6"/><text class="hp-t hp-dn" x="16" y="94">Put (DOWN) wins below it</text>`, "Strike line with win zones")}
    <p>Call (UP) pays out if the price ends <b>above</b> the strike. Put (DOWN) pays out if it ends <b>below</b>. A strike closer to the current price is more likely to win but costs more.</p>`],
  premium: ["Premium / coin", () => `<p>The <b>premium</b> is the price of the option. It is shown per 1 coin, for example per 1 ETH. You pay it up front.</p>
    ${hsv("0 0 320 100", `<rect class="hp-box" x="12" y="22" width="92" height="52" rx="10"/><text class="hp-t hp-b" x="58" y="44" text-anchor="middle">You pay</text><text class="hp-t" x="58" y="62" text-anchor="middle">premium</text><path class="hp-ar" d="M110 48h44"/><path class="hp-ah" d="M154 48l-7-5v10z"/><rect class="hp-box" x="162" y="22" width="146" height="52" rx="10"/><text class="hp-t hp-b" x="235" y="44" text-anchor="middle">Max loss = premium</text><text class="hp-t" x="235" y="62" text-anchor="middle">No margin calls</text>`, "Premium equals maximum loss")}
    <p><b>Your total cost</b> = premium per coin x quantity. That total is the most you can ever lose. A longer expiry or a closer strike makes the premium higher.</p>`],
  prob: ["Probability (about)", () => `<p><b>Probability</b> is a rough estimate of how likely the option is to finish in profit at expiry, based on the current price, time left and volatility.</p>
    ${hsv("0 0 320 110", `<path class="hp-fill" d="M196 94V58C200 66 204 72 208 78C230 92 260 94 310 94Z" /><path class="hp-curve" d="M10 94 C60 94 90 92 112 78 C134 60 146 18 160 18 C174 18 186 60 208 78 C230 92 260 94 310 94"/><line class="hp-ln" x1="8" y1="94" x2="312" y2="94"/><line class="hp-dash" x1="196" y1="10" x2="196" y2="94"/><text class="hp-t hp-b" x="196" y="106" text-anchor="middle">Strike</text><text class="hp-t" x="160" y="106" text-anchor="middle">Now</text><text class="hp-t hp-up" x="256" y="76" text-anchor="middle">Win area</text>`, "Probability distribution with the win area beyond the strike")}
    <p>Example: <b>40%</b> means about 4 out of 10 similar options would win. Higher probability costs more. Lower probability costs less but pays more when it works. It is an estimate, not a guarantee.</p>`],
  atm: ["ATM (at the money)", () => `<p><b>ATM</b> means the strike is the closest round price to the current market price. It is the middle point.</p>
    ${hsv("0 0 320 110", `<line class="hp-ln" x1="20" y1="60" x2="300" y2="60"/>${[60,110,160,210,260].map((x, i) => `<line class="hp-tk" x1="${x}" y1="52" x2="${x}" y2="68"/><text class="hp-t" x="${x}" y="84" text-anchor="middle">${["-2","-1","ATM","+1","+2"][i]}</text>`).join("")}<circle class="hp-dot" cx="160" cy="60" r="6"/><text class="hp-t hp-b" x="160" y="40" text-anchor="middle">Price is here</text>`, "Strikes around the price, ATM in the middle")}
    <p>ATM options have roughly a 50% chance of finishing in profit. Strikes further from the price are cheaper but less likely to win.</p>`],
  steps: ["Strike steps", () => `<p>Strikes are spaced at fixed gaps called <b>steps</b>. <b>+1 step</b> means one gap further from the current price, <b>+3 steps</b> means three gaps.</p>
    ${hsv("0 0 320 100", `<line class="hp-ln" x1="14" y1="58" x2="306" y2="58"/>${[40,110,180,250].map((x, i) => `<circle class="${i === 0 ? "hp-dot" : "hp-dot2"}" cx="${x}" cy="58" r="${i ? 5 : 6}"/><text class="hp-t ${i ? "" : "hp-b"}" x="${x}" y="82" text-anchor="middle">${["ATM","+1","+2","+3"][i]}</text>`).join("")}<path class="hp-ar" d="M40 38h70M110 38h70M180 38h70"/><text class="hp-t" x="75" y="30" text-anchor="middle">1 step</text>`, "Strike steps from ATM")}
    <p>For Call (UP) steps go above the price. For Put (DOWN) they go below. More steps means a cheaper option with a lower chance, but a bigger potential reward.</p>`],
  expiry: ["Expiry", () => `<p><b>Expiry</b> is the moment your option ends and is settled. Pick from 15 minutes up to a week. The timer under each button shows the time left.</p>
    ${hsv("0 0 320 90", `<line class="hp-ln" x1="20" y1="46" x2="300" y2="46"/><circle class="hp-dot" cx="30" cy="46" r="6"/><text class="hp-t hp-b" x="30" y="72" text-anchor="middle">Buy now</text><circle class="hp-dot3" cx="290" cy="46" r="6"/><text class="hp-t hp-b" x="290" y="72" text-anchor="middle">Expiry</text><text class="hp-t" x="160" y="34" text-anchor="middle">price moves in between</text>`, "Timeline from buy to expiry")}
    <p>At expiry the price is compared with your strike and you are paid automatically in USDT. You can also sell earlier at the current value.</p>`],
  callput: ["Call and Put", () => `<p>Choose what you expect the price to do.</p>
    ${hsv("0 0 320 96", `<rect class="hp-up-b" x="10" y="10" width="146" height="76" rx="12"/><path class="hp-arup" d="M83 66V32M70 44l13-13 13 13"/><text class="hp-t hp-b hp-up" x="83" y="80" text-anchor="middle">Call = UP</text><rect class="hp-dn-b" x="164" y="10" width="146" height="76" rx="12"/><path class="hp-ardn" d="M237 28v34M224 50l13 13 13-13"/><text class="hp-t hp-b hp-dn" x="237" y="80" text-anchor="middle">Put = DOWN</text>`, "Call means up, put means down")}
    <p><b>Call</b>: you profit if the price ends above the strike. <b>Put</b>: you profit if the price ends below it. Either way, you cannot lose more than the premium.</p>`],
  chips: ["Distance from the price", () => `<p>These chips pick a strike by <b>percentage distance</b> from the current price instead of by step.</p>
    ${hsv("0 0 320 100", `<line class="hp-ln" x1="14" y1="60" x2="306" y2="60"/><circle class="hp-dot" cx="60" cy="60" r="6"/><text class="hp-t hp-b" x="60" y="82" text-anchor="middle">Price</text><path class="hp-ar" d="M66 40h160"/><path class="hp-ah" d="M232 40l-7-5v10z"/><line class="hp-dash" x1="232" y1="30" x2="232" y2="66"/><text class="hp-t hp-b" x="232" y="82" text-anchor="middle">Strike +2%</text><text class="hp-t" x="150" y="32" text-anchor="middle">2% away</text>`, "Strike two percent away from the price")}
    <p>The small <b>≈ %</b> under each chip is the estimated probability of finishing in profit. A bigger distance costs less but is less likely to win.</p>`],
  amount: ["Amount and quick trade", () => `<p>Type the amount in USDT, or drag the slider from 0% to 100% of your Options wallet. Then tap <b>Up</b> or <b>Down</b> to buy with the expiry and strike currently selected.</p><p>The amount you enter is your <b>maximum loss</b>. The quantity of coins bought is worked out from it automatically.</p>`]
};
/* K3: payoff picture for the Size help (call: wins above strike + premium, put: the mirror case) */
function sizeSvg(type){
  const put = type === "put", X = x => put ? 320 - x : x, A = put ? "end" : "start", B = put ? "start" : "end";
  return hsv("0 0 320 150", `<rect class="hp-lose" x="${put ? X(196) : 8}" y="74" width="188" height="46" rx="4"/><rect class="hp-win" x="${put ? 8 : 196}" y="26" width="116" height="48" rx="4"/>
    <line class="hp-ln" x1="8" y1="74" x2="312" y2="74"/>
    <path class="hp-pld" d="M${X(12)} 112 L${X(120)} 112"/><path class="hp-plu" d="M${X(120)} 112 L${X(300)} 22"/>
    <line class="hp-dash" x1="${X(120)}" y1="22" x2="${X(120)}" y2="126"/><line class="hp-dash" x1="${X(196)}" y1="22" x2="${X(196)}" y2="126"/>
    <circle class="hp-dot" cx="${X(120)}" cy="112" r="4"/><circle class="hp-dot3" cx="${X(196)}" cy="74" r="4"/>
    <text class="hp-t hp-b" x="${X(120)}" y="140" text-anchor="middle">Strike</text><text class="hp-t hp-b" x="${X(196)}" y="140" text-anchor="middle">Breakeven</text>
    <text class="hp-t hp-dn" x="${X(14)}" y="104" text-anchor="${A}">LOSS: premium only</text>
    <text class="hp-t hp-up" x="${X(306)}" y="68" text-anchor="${B}">PROFIT grows</text>
    <text class="hp-t" x="${X(14)}" y="68" text-anchor="${A}">0</text>`, put ? "Put payoff at expiry" : "Call payoff at expiry");
}
/* the live numbers of the Simple-mode order form, used in the worked example of the "Profit if price reaches" help */
let hctx = null;
const reachLv = isC => (isC ? [.5, 1, 2, 5, 10] : [-.5, -1, -2, -5, -10]);
function reachSvg(rows){
  const mx = Math.max(...rows.map(r => Math.max(0, r.pr)), 1e-9), mn = Math.min(...rows.map(r => Math.min(0, r.pr)), 0), top = 22, bot = 104, z = top + (mx/(mx - mn || 1))*(bot - top), k = (bot - top)/(mx - mn || 1);
  const bars = rows.map((r, i) => { const x = 22 + i*58, h = Math.max(2, Math.abs(r.pr)*k), y = r.pr >= 0 ? z - h : z, c = r.pr > 0 ? "hp-bu" : "hp-bd";
    return `<rect class="${c}" x="${x}" y="${y.toFixed(1)}" width="34" height="${h.toFixed(1)}" rx="3"/><text class="hp-t ${r.pr > 0 ? "hp-up" : "hp-dn"}" x="${x + 17}" y="${(r.pr >= 0 ? y - 4 : y + h + 11).toFixed(1)}" text-anchor="middle">${signed(r.pr)}</text><text class="hp-t hp-b" x="${x + 17}" y="128" text-anchor="middle">${r.l}</text>`; }).join("");
  return hsv("0 0 320 136", `<line class="hp-ln" x1="8" y1="${z.toFixed(1)}" x2="312" y2="${z.toFixed(1)}"/>${bars}`, "Profit or loss at each price level");
}
const HELP2 = {
  size: [type => `Size (${type === "put" ? "Put" : "Call"})`, type => { const put = type === "put"; return `<p><b>Size</b> shows how big your position is: the <b>USDT value</b> of the coins it covers, then the <b>quantity</b> of coins. Example: <b>1,234.56 USDT / 0.02 BTC</b>.</p>
    ${sizeSvg(type)}
    <p><b>1. Filled.</b> Your order is filled the moment you buy. You pay the premium once and the position opens straight away.</p>
    <p><b>2. Expires.</b> At the expiry time the market price is compared with your strike. It settles automatically in USDT. You can also close early at the current value.</p>
    <p><b>3. Profit or loss.</b> ${put ? "A <b>put</b> profits when the price ends <b>below</b> the strike minus the premium paid (the breakeven)." : "A <b>call</b> profits when the price ends <b>above</b> the strike plus the premium paid (the breakeven)."} ${put ? "Above the strike" : "Below the strike"} it expires worthless and you lose the premium, never more. Between the strike and breakeven you get some money back but still lose a little.</p>`; }],
  reach: ["Profit if price reaches", () => {
    const c0 = hctx && hctx(), d = c0 && c0.d, isC = c0 ? c0.side === "call" : true;
    let ex = "", gr = "";
    if (d){
      const qty = c0.qty, cq = c0.cq, base = c0.base;
      if (cq){
        const rows = reachLv(isC).map(pc => { const T = d.S*(1 + pc/100), pr = intrinsic(c0.side, T, d.K)*qty - cq.cost; return {l: (pc > 0 ? "+" : "") + pc + "%", pr}; });
        gr = reachSvg(rows);
        const pc = isC ? 2 : -2, T = d.S*(1 + pc/100), val = intrinsic(c0.side, T, d.K)*qty, pr = val - cq.cost, roi = pr/cq.cost*100;
        ex = `<div class="hp-ex"><b>Worked example (live numbers)</b><ol>
          <li>${base} is now <b>${px(base, d.S)}</b>. You buy a <b>${isC ? "Call" : "Put"}</b> with strike <b>${px(base, d.K)}</b> for <b>${fq(qty, base)} ${base}</b>. You pay <b>${money(cq.cost)} USDT</b>. This is the most you can lose.</li>
          <li>Price moves ${pc > 0 ? "up" : "down"} 2% to <b>${px(base, T)}</b>.</li>
          <li>The option is then worth ${isC ? "(price - strike)" : "(strike - price)"} x quantity = <b>${money(val)} USDT</b>.</li>
          <li>Profit = ${money(val)} - ${money(cq.cost)} = <b class="${pr > 0 ? "up" : "down"}">${signed(pr)} USDT</b>. ROI = <b class="${pr > 0 ? "up" : "down"}">${pct(roi)}</b>.</li></ol></div>`;
      }
    }
    return `<p>This table shows what you would make <b>if the price is at that level when the option expires</b>. Each row gives the price, the profit or loss in USDT, and the return on what you paid (ROI).</p>
      ${gr}<p><b class="up">Green</b> = profit. <b class="down">Red</b> = loss. Small moves such as +0.5% or +1% often show a loss, because the price must first pass your strike <b>and</b> cover the premium you paid. The bar beside each price shows how big the result is compared with the other rows.</p>${ex}
      <p>This is an estimate at expiry. Selling early gives the current value, which can be lower or higher.</p>`;
  }]
};
const helpOpen = (k, a) => { const h2 = HELP2[k]; if (h2) return UI.help(typeof h2[0] === "function" ? h2[0](a) : h2[0], h2[1](a)); const h = HELP[k]; if (h) UI.help(h[0], h[1]()); };

/* ---------- page ---------- */
Pages.options = (params) => {
  let base = String(params[0] || sessionStorage.getItem("lastSym_options") || "BTC").toUpperCase().replace(/USDT$/, "");
  if (!UNDERS.includes(base)) base = "BTC";
  try { sessionStorage.setItem("lastSym_options", base); } catch {}
  let root, offs = [], side = "call", expKey = "1h", ptab = "pos", tT = 0, tTimer = 0, closeSheetOff = null, tgt = 0, amt = 50, amtMax = false, pctSel = null, chartEl = null, chartLive = false, chTf = "1m";
  let chartOpen = true; try { chartOpen = localStorage.getItem("opChart") !== "0"; } catch {}
  let mode = "simple"; try { mode = localStorage.getItem("opMode") === "pro" ? "pro" : "simple"; } catch {}
  const $ = q => root.querySelector(q), s = () => store.s;

  const html = `
  <div class="tabs" style="gap:20px;margin:0 -16px;padding:4px 16px 0;border:0"><a class="tab" href="#/futures/BTCUSDT" style="font-size:17px">USDⓈ-M</a><a class="tab" href="#/spot/BTCUSDT" style="font-size:17px">Spot</a><a class="tab" href="#/trade/BTCUSDT" style="font-size:17px">Binary</a><a class="tab tab-hot" href="#/predict" style="font-size:17px">Prediction</a><a class="tab tab-hot" href="#/racer" style="font-size:17px">Money Game</a><button class="tab on" style="font-size:17px">Options</button><a class="tab" href="#/copy" style="font-size:17px">Copy</a><a class="tab" href="#/bots" style="font-size:17px">Bots</a></div>
  <div class="op-top"><div class="seg op-mode" id="opMode"><button data-mode="simple">Simple</button><button data-mode="pro">Pro</button></div><button class="op-help" id="opHelp" aria-label="How options work">${ic("info",16)}<span>How it works</span></button></div>
  <header class="fx-head" id="opHead"><div class="grow"><button class="nm" data-pick aria-label="Choose underlying">${P(base) ? UI.pairIcon(P(base), 24) : ""}<span>${base}</span><span class="perp">Options</span>${ic("chevd",16)}</button></div>
    <div class="op-hpx"><b class="num" id="opLp">--</b><span class="num" id="opChg"></span></div></header>
  <div id="opChSlotP"></div>
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
    const o = st(), list = $("#opList"); if (!list) return; $("#opPc").textContent = o.positions.length; syncEntry();
    if (ptab === "pos"){
      list.innerHTML = o.positions.length ? o.positions.slice().reverse().map(pos => `<div class="pc op-pc" data-id="${pos.id}">
        <div class="pc-h"><span class="sym op-sym">${esc(symName(pos))}</span><span class="perp op-${pos.type}">${pos.type === "call" ? "Call" : "Put"}</span><span class="grow"></span><b class="num brand-c" data-cd></b></div>
        <div class="op-hero"><div><span>Unrealized PNL (USDT)</span><b class="num" data-pnl>--</b></div><div class="op-r"><span>ROI</span><b class="num" data-roi>--</b></div></div>
        <div class="op-size"><span>Size ${hqx("size", pos.type)}</span><b class="num">${sizeTxt(pos)}</b></div>
        <div class="pc-g"><div><span>Quantity</span><b class="num">${fq(pos.qty, pos.base)} ${pos.base}</b></div><div><span>Strike</span><b class="num">${px(pos.base, pos.strike)}</b></div><div><span>Cost (USDT)</span><b class="num">${money(pos.cost)}</b></div><div><span>Mark value</span><b class="num" data-val></b></div></div>
        <div class="op-act"><span class="op-exl">Expires ${expLabel(pos.exp)}</span><button class="btn btn-ghost btn-sm" data-close="${pos.id}">Close</button></div></div>`).join("") : UI.emptyState("file", "No open options");
      tickList();
    } else {
      const h = o.history.slice(0, 60);
      list.innerHTML = h.length ? h.map(x => `<div class="pc op-pc"><div class="pc-h"><span class="sym op-sym">${esc(symName(x))}</span><span class="perp op-${x.type}">${x.type === "call" ? "Call" : "Put"}</span><span class="grow"></span><span class="label">${esc(x.result)}</span></div>
        <div class="ph-g"><div><span>Invested (USDT)</span><b class="num">${money(x.cost)}</b></div><div class="op-hc"><span>Side</span><b>${x.type === "call" ? "Call" : "Put"} · Buy</b></div><div><span>Margin (USDT)</span><b class="num">${money(x.cost)}</b></div>
          <div><span>PNL (USDT)</span><b class="num ${x.pnl > 0 ? "up" : x.pnl < 0 ? "down" : ""}">${signed(x.pnl)}</b></div><div class="op-hc"><span>ROI</span><b class="num ${x.pnl > 0 ? "up" : x.pnl < 0 ? "down" : ""}">${x.cost > 0 ? pct(x.pnl/x.cost*100) : "--"}</b></div><div><span>Payout</span><b class="num">${money(x.payout)}</b></div></div>
        <div class="op-size"><span>Size ${hqx("size", x.type)}</span><b class="num">${sizeTxt(x)}</b></div>
        <div class="ph-t"><span>Settle price</span><b class="num">${px(x.base, x.settle)}</b></div>
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
    st().positions.push({id: U.uid(), base, type: side, strike: K, exp, qty, cost, entryMark: c.g.price, entrySpot: c.S, iv: c.g.iv, open: Date.now()});
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
  const pctsOf = () => DIST[expKey] || DIST.d;
  const pctK = (S, p) => +(S*(1 + (side === "call" ? p : -p))).toPrecision(4);
  const selK = S => pctSel != null ? pctK(S, pctSel) : tgtStrikes(S)[tgt].K;
  const pctLbl = p => +(p*100).toFixed(1) + "%";
  function simpleCalc(){
    const S = spotOf(base); if (S == null) return null;
    const exp = expOf(expKey), min = MINQ[base], K = selK(S);
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
      <div id="opChSlot"></div>
      <div class="op-q" id="opQ">
        <div class="op-q-t"><b>Quick trade</b>${hq("amount")}<span class="op-q-i">Expiry <b id="qE"></b> · Avbl <b class="num" id="qBal"></b></span></div>
        <div class="op-q-r"><div class="famt op-qf" id="qF"><input id="qAmt" type="text" inputmode="decimal" autocomplete="off" aria-label="Amount in USDT" placeholder="Amount"><span>USDT</span></div></div>
        <div class="op-q-s"><input type="range" id="qRng" min="0" max="100" step="1" value="0" aria-label="Share of Options wallet"><b class="num" id="qPct">0%</b></div>
        <div class="op-q-b"><button class="btn btn-up" data-qside="call" type="button"><span>Up</span><small class="num" id="qKc"></small></button><button class="btn btn-down" data-qside="put" type="button"><span>Down</span><small class="num" id="qKp"></small></button></div>
      </div>
      <div class="op-sec" style="margin:14px 0 0">Your prediction ${hq("callput")}</div>
      <div class="op-dir" id="sDir">
        <button class="op-up ${side === "call" ? "on" : ""}" data-side="call"><span class="op-dir-i">${ic("up",18,2)}</span><b>Price will go UP</b><small>Buy Call</small></button>
        <button class="op-dn ${side === "put" ? "on" : ""}" data-side="put"><span class="op-dir-i">${ic("down",18,2)}</span><b>Price will go DOWN</b><small>Buy Put</small></button></div>
      <div class="op-sec"><span>Expiry ${hq("expiry")}</span></div>
      <div class="op-exps op-sexps" id="sExps"></div>
      <div class="op-sec"><span>Target price (strike) ${hq("strike")}</span></div>
      <div class="op-learn" aria-label="Learn the terms"><span>Learn:</span>${[["strike","Strike"],["premium","Premium"],["prob","Probability"],["atm","ATM"],["steps","Steps"]].map(([k, l]) => `<button type="button" class="op-lk" data-help="${k}">${l}<i class="hq" aria-hidden="true">?</i></button>`).join("")}</div>
      <div class="op-tgts" id="sTgts"></div>
      <div class="op-sec op-sec2"><span>Or pick a distance from the price ${hq("chips")} <small id="sPdir"></small></span></div>
      <div class="op-pcts" id="sPcts"></div><div class="op-tgts" id="sPres"></div>
      <div class="op-sec"><span>Amount ${hq("amount")}</span> <span class="op-avbl">Avbl <b class="num" id="sBal">${money(store.wb("options"))}</b> USDT <button class="wl-plus" data-wlto="options" aria-label="Transfer in">${ic("plus",13,3)}</button></span></div>
      <div class="famt op-amt" id="sF"><input id="sAmt" type="number" inputmode="decimal" min="0" aria-label="Amount in USDT" placeholder="0.00"><span>USDT</span></div>
      <div class="op-amts" id="sAmts">${AMTS.map(a => `<button data-a="${a}">${a}</button>`).join("")}<button data-a="max">Max</button></div>
      <div class="op-qty" id="sQty"></div>
      <div class="op-sum" id="sSum"></div>
      <button class="btn op-go" id="sGo">Buy Call</button>
      <div class="op-note">${ic("info",14)}<span>Max loss = amount paid. Cash-settled in USDT at expiry.</span></div>`;
    $("#sAmt").value = amtMax ? "" : amt; $("#sAmt").placeholder = amtMax ? "Max" : "0.00";
    renderSExps(); renderSLive(); renderSDyn(); placeChart();
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
  const fmtIn = v => v > 0 ? v.toLocaleString("en-US", {maximumFractionDigits: 2}) : "";
  function qSync(){
    const q = $("#qAmt"); if (!q) return; const bal = store.wb("options"), cur = amtMax ? bal : amt, S = spotOf(base);
    if (document.activeElement !== q) q.value = fmtIn(cur);
    const p = bal > 0 ? Math.max(0, Math.min(100, cur/bal*100)) : 0, r = $("#qRng"); r.value = p; r.style.setProperty("--p", p + "%");
    $("#qPct").textContent = Math.round(p) + "%"; $("#qBal").textContent = money(bal);
    $("#qE").textContent = (EXPS.find(x => x[0] === expKey) || [0, expKey])[1];
    if (S != null){ const sd = side; side = "call"; const kc = selK(S); side = "put"; const kp = selK(S); side = sd; $("#qKc").textContent = "@ " + px(base, kc); $("#qKp").textContent = "@ " + px(base, kp); }
  }
  function setAmt(v, max){
    amtMax = !!max; amt = v; const a = $("#sAmt"); if (a) a.value = max ? "" : (v || ""); const f = $("#qF"); if (f) f.classList.remove("err"); renderSDyn();
  }
  function renderSDyn(){
    if (mode !== "simple" || !$("#sTgts")) return;
    const S = spotOf(base), isC = side === "call";
    qSync();
    const go = $("#sGo"); go.className = "btn op-go " + (isC ? "btn-up" : "btn-down"); go.textContent = isC ? "Buy Call" : "Buy Put";
    root.querySelectorAll("#sAmts [data-a]").forEach(b => b.classList.toggle("on", amtMax ? b.dataset.a === "max" : +b.dataset.a === amt));
    if (S == null){ $("#sTgts").innerHTML = UI.emptyState("clock", "Connecting to live prices…"); $("#sSum").innerHTML = ""; $("#sQty").innerHTML = ""; return; }
    const exp = expOf(expKey), ts = tgtStrikes(S);
    const tgCard = (nm, sub, K, on, attr) => { const g = quote(side, K, exp, 1).g;
      return `<button class="op-tg ${on ? "on" : ""}" ${attr}><span class="op-tg-n"><b>${nm}</b><small>${sub}</small></span>
        <span class="op-tg-k"><b class="num">${px(base, K)}</b><small>Strike</small></span>
        <span class="op-tg-k"><b class="num">${fp(g.price*SPREAD)}</b><small>Premium / ${base}</small></span>
        <span class="op-tg-p op-tg-k"><b class="num">${Math.round(Math.abs(g.delta)*100)}%</b><small>Probability ≈</small></span></button>`; };
    $("#sPdir").textContent = isC ? "(above)" : "(below)";
    $("#sPcts").innerHTML = pctsOf().map(p => { const K = pctK(S, p), pr = Math.round(Math.abs(quote(side, K, exp, 1).g.delta)*100);
      return `<button class="op-pch ${pctSel === p ? "on" : ""}" data-pct="${p}"><b>${isC ? "+" : "-"}${pctLbl(p)}</b><small>≈ ${pr}%</small></button>`; }).join("");
    $("#sPres").innerHTML = pctSel != null ? tgCard(`${pctLbl(pctSel)} ${isC ? "above" : "below"}`, "Your pick", pctK(S, pctSel), true, 'data-pct-card="1"') : "";
    $("#sTgts").innerHTML = ts.map((t, i) => { const g = quote(side, t.K, exp, 1).g;
      const h = i === 0;
      return `<button class="op-tg ${pctSel == null && i === tgt ? "on" : ""}" data-t="${i}"><span class="op-tg-n"><b>${t.nm}</b><small>${t.sub}</small></span>
        <span class="op-tg-k"><b class="num">${px(base, t.K)}</b><small>Strike</small></span>
        <span class="op-tg-k"><b class="num">${fp(g.price*SPREAD)}</b><small>Premium / ${base}</small></span>
        <span class="op-tg-k op-tg-p"><b class="num">${Math.round(Math.abs(g.delta)*100)}%</b><small>Probability ≈</small></span></button>`; }).join("");
    const d = simpleCalc(); if (!d) return;
    const aEl = $("#sAmt"); if (amtMax && document.activeElement !== aEl) aEl.value = "";
    $("#sBal").textContent = money(d.bal);
    const q = $("#sQty");
    if (!d.c){ q.innerHTML = `<span>Quantity</span><b class="num">Min ${fq(d.min, base)} ${base} ≈ ${money(d.unit*d.min)} USDT</b>`; $("#sSum").innerHTML = ""; return; }
    const c = d.c; q.innerHTML = `<span>Quantity</span><b class="num">${fq(d.qty, base)} ${base}</b>`;
    const rd = reachLv(isC).map(pc => { const T = d.S*(1 + pc/100), pr = intrinsic(side, T, d.K)*d.qty - c.cost; return {pc, T, pr, roi: pr/c.cost*100}; }), rmx = Math.max(...rd.map(r => Math.abs(r.pr)), 1e-9);
    const rowsT = rd.map(({pc, T, pr, roi}) =>
      `<div><span class="num">${pc > 0 ? "+" : ""}${pc}% · ${px(base, T)}<i class="op-pbar ${pr > 0 ? "up" : "dn"}"><s style="width:${Math.max(3, Math.abs(pr)/rmx*100).toFixed(1)}%"></s></i></span><b class="num ${pr > 0 ? "up" : "down"}">${signed(pr)}</b><em class="num ${pr > 0 ? "up" : "down"}">${pct(roi)}</em></div>`).join("");
    $("#sSum").innerHTML = `
      <div class="op-sum-big"><div><span>You pay (max loss)</span><b class="num">${money(c.cost)} <small>USDT</small></b></div><div class="op-r"><span>Breakeven</span><b class="num">${px(base, c.be)}</b></div></div>
      <div class="op-sum-mid"><span>Max profit</span><b class="num ${""}">${isC ? "Unlimited" : "up to " + money(Math.max(0, d.K*d.qty - c.cost)) + " USDT"}</b></div>
      <div class="op-pw">${payoffSvg(side, d.K, d.S, c.cost, d.qty)}</div>
      <div class="op-sec" style="margin:14px 0 6px"><span>Profit if price reaches ${hq("reach")}</span></div><div class="op-pi">${rowsT}</div>`;
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

  /* ---- live candle chart (CH singleton, mounted lazily, moved between simple / pro slots) ---- */
  const CH_TFS = [["1s","1s"],["5s","5s"],["30s","30s"],["1m","1m"],["5m","5m"],["15m","15m"],["1h","1h"],["4h","4h"],["1d","1D"]], CH_IND = ["MA","EMA","BOLL","|","VOL","RSI","MACD"];
  function buildChart(){
    const el = document.createElement("section"); el.className = "op-chart"; el.id = "opChart";
    el.innerHTML = `<button class="op-ch-h" data-chtog aria-expanded="${chartOpen}" aria-label="Show or hide chart"><span class="op-ch-t">${ic("candle",16)}<b>Chart</b><small>${base}/USDT <i id="opChTf"></i></small></span><span class="op-ch-c">${ic("chevd",16)}</span></button>
      <div class="op-ch-b" ${chartOpen ? "" : "hidden"}>
        <div class="tfbar"><div class="tfs" id="opTfs">${CH_TFS.map(([k, l]) => `<button data-ctf="${k}">${l}</button>`).join("")}</div></div>
        <div class="cp-chart"><div class="chart-wrap"><div id="chart"></div><div class="legend" id="lg"></div><div class="chart-msg" id="cmsg"></div></div></div>
        <div class="indbar"><div class="il" id="inds">${CH_IND.map(k => k === "|" ? `<span style="color:var(--line)">|</span>` : `<button data-ind="${k}">${k}</button>`).join("")}</div></div>
      </div>`;
    el.classList.toggle("shut", !chartOpen);
    return el;
  }
  const chTfLabel = () => (CH_TFS.find(x => x[0] === chTf) || [0, chTf])[1];
  function chSetTf(tf){
    chTf = tf; try { sessionStorage.setItem("tf_options", tf); } catch {}
    chartEl.querySelectorAll("[data-ctf]").forEach(b => b.classList.toggle("on", b.dataset.ctf === tf));
    const i = chartEl.querySelector("#opChTf"); if (i) i.textContent = chTfLabel();
    if (chartLive) CH.load(base + "USDT", tf);
  }
  function chInds(){ chartEl.querySelectorAll("[data-ind]").forEach(b => b.classList.toggle("on", CH.inds.includes(b.dataset.ind))); }
  function ensureChart(){
    if (chartLive || !chartEl || !chartOpen || !window.CH || !P(base)) return;
    try {
      CH.mount(chartEl.querySelector("#chart"), {legend: chartEl.querySelector("#lg"), msg: chartEl.querySelector("#cmsg"), mode: "none"});   // "none" = no futures/binary lines or markers on the options chart
      chartLive = true; syncEntry(); chInds(); CH.load(base + "USDT", chTf); setTimeout(() => CH.resize && CH.resize(), 80);
    } catch (e) { console.warn("options chart", e); }
  }
  /* K1: entry line (yellow) + yellow price box on the axis for every open option on this underlying */
  function syncEntry(){
    if (!chartLive || !window.CH || !CH.setExtra) return;
    try { CH.setExtra(st().positions.filter(x => x.base === base).map(x => ({id: x.id, price: x.entrySpot || x.strike, color: ENTRY_C, text: "#000", title: (x.type === "call" ? "Call" : "Put") + " entry"}))); } catch {}
  }
  function placeChart(){
    if (!chartEl || !root) return;
    const slot = $(mode === "simple" ? "#opChSlot" : "#opChSlotP"); if (!slot) return;
    if (chartEl.parentElement !== slot) slot.appendChild(chartEl);
    if (chartLive) setTimeout(() => CH.resize && CH.resize(), 60); else ensureChart();
  }
  function initChart(){
    try { const t = sessionStorage.getItem("tf_options"); if (t && CH_TFS.some(x => x[0] === t)) chTf = t; } catch {}
    chartEl = buildChart(); chSetTf(chTf);
    chartEl.addEventListener("click", e => {
      let b;
      if (e.target.closest("[data-chtog]")){ chartOpen = !chartOpen; try { localStorage.setItem("opChart", chartOpen ? "1" : "0"); } catch {}
        chartEl.classList.toggle("shut", !chartOpen); chartEl.querySelector(".op-ch-b").hidden = !chartOpen; chartEl.querySelector("[data-chtog]").setAttribute("aria-expanded", chartOpen);
        if (chartOpen){ ensureChart(); setTimeout(() => CH.resize && CH.resize(), 60); } return; }
      if ((b = e.target.closest("[data-ctf]"))) return chSetTf(b.dataset.ctf);
      if ((b = e.target.closest("[data-ind]"))){ const k = b.dataset.ind, l = CH.inds.includes(k) ? CH.inds.filter(x => x !== k) : [...CH.inds, k]; CH.setInds(l); chInds(); }
    });
  }

  /* ---- How it works (inline SVG explainer) ---- */
  function howData(){
    const S = spotOf(base), exp = nextExp("1h", Date.now()), b = base;
    if (S == null) return {b:"BTC", S:60000, K:60300, prem:12, qty:.05, up:61500, pay:48, win:36};
    const K = +(S*1.005).toPrecision(4), unit = bs(b, "call", S, K, exp, Date.now()).price*SPREAD;
    const qty = Math.max(MINQ[b], +(Math.max(5, 12)/unit).toPrecision(2)), cost = unit*qty*1.0003, up = +(S*1.015).toPrecision(4), pay = Math.max(0, up - K)*qty;
    return {b, S, K, prem:cost, qty, up, pay, win:pay - cost};
  }
  const nf = (v, d = 0) => v.toLocaleString("en-US", {minimumFractionDigits:d, maximumFractionDigits:d});
  const svgPath = () => `<svg class="hw-svg" viewBox="0 0 320 156" role="img" aria-label="Price path ending above the strike at expiry">
    <rect class="hw-win" x="8" y="14" width="304" height="52" rx="6"/>
    <text class="hw-zt hw-up" x="16" y="30">WIN ZONE: price ends above strike</text>
    <line class="hw-strike" x1="8" y1="66" x2="312" y2="66"/><text class="hw-lb hw-br" x="14" y="80">Strike (your target)</text>
    <line class="hw-exp" x1="268" y1="10" x2="268" y2="132"/><text class="hw-lb" x="268" y="146" text-anchor="middle">Expiry</text>
    <text class="hw-lb" x="22" y="146" text-anchor="middle">Now</text>
    <path class="hw-path" d="M22 112 C40 104 48 122 66 108 S92 92 108 100 S134 84 150 90 S178 70 194 74 S222 56 240 48 S256 40 268 38"/>
    <circle class="hw-dot" cx="22" cy="112" r="4"/><circle class="hw-dot hw-dotw" cx="268" cy="38" r="5"/>
    <path class="hw-tick" d="M265 38l2.4 2.6 4.6-5"/></svg>`;
  const svgPay = () => `<svg class="hw-svg" viewBox="0 0 320 148" role="img" aria-label="Payoff diagram: loss limited to premium, profit grows past strike">
    <rect class="hw-gain" x="196" y="22" width="108" height="44"/><path class="hw-gainp" d="M196 66 L304 22 L304 66Z"/>
    <rect class="hw-loss" x="16" y="66" width="180" height="30"/>
    <line class="hw-zero" x1="8" y1="66" x2="312" y2="66"/><text class="hw-lb" x="10" y="60">0</text>
    <line class="hw-strike" x1="132" y1="12" x2="132" y2="124"/>
    <line class="hw-be" x1="196" y1="12" x2="196" y2="124"/>
    <path class="hw-pl hw-pld" d="M16 96 L132 96"/><path class="hw-pl hw-plu" d="M132 96 L304 22"/><circle class="hw-dot" cx="132" cy="96" r="3.5"/><circle class="hw-dot hw-dotw" cx="196" cy="66" r="3.5"/>
    <text class="hw-lb hw-dn" x="74" y="114" text-anchor="middle">Max loss = premium</text>
    <text class="hw-lb hw-up" x="258" y="18" text-anchor="middle">Profit grows</text>
    <text class="hw-lb" x="132" y="138" text-anchor="middle">Strike</text><text class="hw-lb" x="196" y="138" text-anchor="middle">Breakeven</text></svg>`;
  function howHtml(){
    const d = howData(), step = (i, ico, t, s) => `<li><span class="hw-ic">${ic(ico, 20, 1.9)}<em>${i}</em></span><div><b>${t}</b><small>${s}</small></div></li>`;
    return `<div class="hw">
      <p class="hw-lead">An option lets you bet on where the price will be at a set time. You pay a small fee up front (the <b>premium</b>). That fee is the <b>most you can lose</b>.</p>
      <ol class="hw-steps">${step(1, "trend", "Pick a direction", "UP (Call) if you think the price will rise. DOWN (Put) if you think it will fall.")}${step(2, "target", "Pick a target and expiry", "The target is the strike price. Expiry is when the bet ends: 15 minutes up to a week.")}${step(3, "wallet", "Pay the premium, settle in USDT", "At expiry, a win pays out in USDT. If not, it expires and you lose only the premium.")}</ol>
      <div class="hw-card"><div class="hw-h"><b>1. Where the price ends</b><span>Call (UP) example</span></div>${svgPath()}<p>You win if the price is <b>above the strike</b> when the time runs out. For a DOWN bet it is the other way round: you win if it ends <b>below</b>.</p></div>
      <div class="hw-card"><div class="hw-h"><b>2. What you can win or lose</b><span>At expiry</span></div>${svgPay()}<p>Below the strike you lose the premium and nothing more. Above the breakeven you are in profit, and it keeps growing as the price moves further.</p></div>
      <div class="hw-card hw-ex"><div class="hw-h"><b>3. A real example</b><span>Live price</span></div>
        <ul><li><span>1</span><div>${d.b} is now <b class="num">${nf(d.S, d.S < 10 ? 4 : 0)}</b> USDT. You expect it to rise, so you buy <b class="hw-up">UP</b> with a target of <b class="num">${nf(d.K, d.K < 10 ? 4 : 0)}</b> (+0.5%), expiring in 1 hour.</div></li>
        <li><span>2</span><div>You pay a premium of <b class="num">${nf(d.prem, 2)} USDT</b> for ${+d.qty.toPrecision(3)} ${d.b}. This is your maximum loss.</div></li>
        <li><span>3</span><div><b class="hw-up">Price ends at ${nf(d.up, d.up < 10 ? 4 : 0)} (+1.5%):</b> you receive <b class="num">${nf(d.pay, 2)} USDT</b>, a profit of <b class="num hw-up">+${nf(d.win, 2)} USDT</b>.</div></li>
        <li><span>4</span><div><b class="hw-dn">Price ends below ${nf(d.K, d.K < 10 ? 4 : 0)}:</b> the option expires worthless and you lose <b class="num hw-dn">-${nf(d.prem, 2)} USDT</b>, never more.</div></li></ul></div>
      <p class="hw-fine">You can also sell an option early at its current value, before expiry.</p>
      <button class="btn btn-primary btn-block" data-ok style="margin-top:12px;height:46px">Got it</button></div>`;
  }

  function setMode(m){
    mode = m; try { localStorage.setItem("opMode", m); } catch {}
    root.querySelectorAll("#opMode [data-mode]").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
    $("#opSimple").hidden = m !== "simple"; $("#opPro").hidden = m !== "pro"; $("#opHead").hidden = m !== "pro";
    root.querySelectorAll("#opSide button").forEach(x => x.classList.toggle("on", x.dataset.side === side));
    if (m === "simple") renderSimple(); else renderAll();
    placeChart();
  }
  function infoSheet(){ U.sheet("How options work", howHtml(), el => el.querySelector("[data-ok]").onclick = () => U.closeLayer()); }

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
  /* K7: confirmation sheet with the exact amount received, updating live while it is open */
  function closeCalc(pos){
    const S = spotOf(pos.base); if (S == null) return null;
    const mark = markNow(pos, S)*pos.qty, payout = mark*CLOSE_HAIRCUT, pnl = payout - pos.cost;
    return {mark, fee: mark - payout, payout, pnl, roi: pos.cost > 0 ? pnl/pos.cost*100 : 0};
  }
  function closePos(id){
    const pos = st().positions.find(x => x.id === id); if (!pos || !closeCalc(pos)) return;
    let tm = 0, done = false, ask = null; const stop = () => { clearInterval(tm); tm = 0; };
    U.sheet("Close option", `<div class="cf-sub"><span class="perp op-${pos.type}">${pos.type === "call" ? "Call" : "Put"}</span><b class="num">${esc(symName(pos))}</b></div>
      <div class="cf-rows op-cf">
        <div><span>Quantity</span><b class="num">${fq(pos.qty, pos.base)} ${pos.base}</b></div>
        <div><span>Cost</span><b class="num">${money(pos.cost)} USDT</b></div>
        <div><span>Mark value</span><b class="num" data-l="mark"></b></div>
        <div><span>Close fee (1%)</span><b class="num" data-l="fee"></b></div>
        <div class="op-cf-r"><span>You receive</span><b class="num" data-l="payout"></b></div>
        <div><span>PNL</span><b class="num" data-l="pnl"></b></div>
        <div><span>ROI</span><b class="num" data-l="roi"></b></div></div>
      <div class="cf-btns"><button class="btn btn-ghost" data-no>Cancel</button><button class="btn btn-primary" data-yes>Close position</button></div>`, el => {
      const upd = () => { const c = closeCalc(pos); if (!c || !el.isConnected) return; const set = (k, v, cls) => { const n = el.querySelector(`[data-l="${k}"]`); if (n){ n.textContent = v; if (cls != null) n.className = "num " + cls; } }, sg = c.pnl > 0 ? "up" : c.pnl < 0 ? "down" : "";
        set("mark", money(c.mark) + " USDT"); set("fee", "-" + money(c.fee) + " USDT"); set("payout", money(c.payout) + " USDT"); set("pnl", signed(c.pnl) + " USDT", sg); set("roi", pct(c.roi), sg); };
      upd(); tm = setInterval(upd, 400);
      const off = bus.on("tick", x => { if (x === pos.base) upd(); }); ask = off;
      el.querySelector("[data-no]").onclick = () => U.closeLayer();
      el.querySelector("[data-yes]").onclick = () => { if (done) return; done = true; upd(); const c = closeCalc(pos); stop(); off(); U.closeLayer(); if (c) doClose(pos.id, c); };
    }, () => { stop(); ask && ask(); });
  }
  function doClose(id, c){
    const o = st(), pos = o.positions.find(x => x.id === id), S = pos && spotOf(pos.base); if (!pos || S == null) return toast("Position already closed", "info");
    const payout = c.payout, pnl = payout - pos.cost;
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
    initChart();
    renderExps(); renderAll();
    $("[data-pick]").onclick = pickSheet;
    $("#opMode").onclick = e => { const b = e.target.closest("[data-mode]"); if (b && b.dataset.mode !== mode) setMode(b.dataset.mode); };
    $("#opHelp").onclick = infoSheet;
    const sm = $("#opSimple");
    sm.onclick = e => { const x = e.target;
      if (x.closest("[data-pick2]")) return pickSheet();
      let b;
      if ((b = x.closest("[data-help]"))){ e.stopPropagation(); return helpOpen(b.dataset.help, b.dataset.ha); }
      if ((b = x.closest("[data-qside]"))){ side = b.dataset.qside; root.querySelectorAll("#sDir button").forEach(y => y.classList.toggle("on", y.dataset.side === side)); renderSDyn(); return simpleBuy(); }
      if ((b = x.closest("#sDir [data-side]"))){ side = b.dataset.side; root.querySelectorAll("#sDir button").forEach(y => y.classList.toggle("on", y === b)); return renderSDyn(); }
      if ((b = x.closest("[data-exp]"))){ expKey = b.dataset.exp; if (pctSel != null && !pctsOf().includes(pctSel)) pctSel = null; renderSExps(); return renderSDyn(); }
      if ((b = x.closest("[data-t]"))){ tgt = +b.dataset.t; pctSel = null; return renderSDyn(); }
      if ((b = x.closest("[data-pct]"))){ const v = +b.dataset.pct; pctSel = pctSel === v ? null : v; return renderSDyn(); }
      if ((b = x.closest("#sAmts [data-a]"))){ if (b.dataset.a === "max"){ amtMax = true; } else { amtMax = false; amt = +b.dataset.a; $("#sAmt").value = amt; } $("#sF").classList.remove("err"); return renderSDyn(); }
      if (x.closest("#sGo")) simpleBuy(); };
    sm.addEventListener("keydown", e => { const h = e.target.closest && e.target.closest("[data-help]"); if (h && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); helpOpen(h.dataset.help, h.dataset.ha); } });
    sm.addEventListener("input", e => {
      if (e.target.id === "qAmt"){ const q = e.target, pos = q.selectionStart, digs = q.value.slice(0, pos).replace(/[^\d.]/g, "").length;
        let raw = q.value.replace(/[^\d.]/g, ""); const dot = raw.indexOf("."); if (dot >= 0) raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, "").slice(0, 2);
        const [ip, dp] = raw.split("."), f = (ip ? (+ip).toLocaleString("en-US") : (dp != null ? "0" : "")) + (dp != null ? "." + dp : "");
        q.value = f; let n = 0, i = 0; for (; i < f.length && n < digs; i++) if (/[\d.]/.test(f[i])) n++; try { q.setSelectionRange(i, i); } catch {}
        return setAmt(parseFloat(raw) || 0, false); }
      if (e.target.id === "qRng"){ const p = +e.target.value, bal = store.wb("options"); if (p >= 100) return setAmt(bal, true); return setAmt(Math.floor(bal*p) / 100, false); }
      if (e.target.id !== "sAmt") return; amtMax = false; amt = parseFloat(e.target.value) || 0; $("#sF").classList.remove("err"); renderSDyn(); });
    setMode(mode);
    $("#opExps").onclick = e => { const b = e.target.closest("[data-exp]"); if (!b) return; expKey = b.dataset.exp; if (pctSel != null && !pctsOf().includes(pctSel)) pctSel = null; renderExps(); renderChain(); };
    $("#opSide").onclick = e => { const b = e.target.closest("[data-side]"); if (!b) return; side = b.dataset.side; root.querySelectorAll("#opSide button").forEach(x => x.classList.toggle("on", x === b)); renderChain(); };
    $("#opChain").onclick = e => { const b = e.target.closest("[data-buy]"); if (b) buySheet(+b.dataset.buy); };
    $("#opList").onclick = e => { let b = e.target.closest("[data-help]"); if (b) return helpOpen(b.dataset.help, b.dataset.ha); b = e.target.closest("[data-close]"); if (b) closePos(b.dataset.close); };
    $("#opList").addEventListener("keydown", e => { const h = e.target.closest && e.target.closest("[data-help]"); if (h && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); helpOpen(h.dataset.help, h.dataset.ha); } });
    hctx = () => { const d = simpleCalc(), qty = d ? (d.qty > 0 ? d.qty : d.min) : 0; return {d, side, qty, base, cq: d ? quote(side, d.K, d.exp, qty) : null}; };
    root.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => setPtab(b.dataset.pt));
    const onTick = x => { if (x !== base) return; renderHead(); if (tTimer) return;
      const wait = Math.max(0, 250 - (performance.now() - tT)); tTimer = setTimeout(() => { tTimer = 0; tT = performance.now(); if (!root) return; if (mode === "simple"){ renderSLive(); renderSDyn(); } else renderChain(); tickList(); }, wait); };
    let lastExp = EXPS.map(([k]) => expOf(k)).join();
    offs.push(bus.on("tick", onTick), bus.on("list", () => { renderAll(); if (mode === "simple") renderSimple(); ensureChart(); }), bus.on("meta", x => x === base && renderHead()), bus.on("balance", () => { if (mode === "simple" && amtMax) renderSDyn(); }),
      bus.on("sec", () => { const cur = EXPS.map(([k]) => expOf(k)).join(); if (cur !== lastExp){ lastExp = cur; renderExps(); renderSExps(); renderChain(); renderSDyn(); } else tickExps(); if (mode === "simple") renderSLive(); tickList(); }));
  }, unmount(){ hctx = null; offs.forEach(f => f()); offs = []; if (chartLive){ try { CH.destroy(); } catch {} } chartLive = false; chartEl = null; clearTimeout(tTimer); tTimer = 0; refresh = null; root = null; }};
};
})();
