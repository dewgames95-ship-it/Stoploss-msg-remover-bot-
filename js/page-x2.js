/* ===== Assets (wallet overview), Deposit flow, Copy Trading + generated SVG art (window.ART) ===== */
(function(){
const C = window.CONFIG, {esc, ic, store, bus, money, signed, toast, spark, fmt} = U;
const S = () => store.s;
const head = (title, right) => `<header class="px-hd"><button class="icon-btn" data-back aria-label="Back">${ic("back",20)}</button><h1>${esc(title)}</h1>${right || `<span style="width:40px"></span>`}</header>`;
const empty = (icon, text) => `<div class="px-empty">${ic(icon,28,1.5)}<p>${esc(text)}</p></div>`;
const hash = s => { let h = 2166136261; for (const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const hash01 = s => hash(s) / 4294967296;
const rngFor = seed => { let a = hash(seed); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const compact = v => { const a = Math.abs(v); return a >= 1e9 ? (v/1e9).toFixed(2) + "B" : a >= 1e6 ? (v/1e6).toFixed(2) + "M" : a >= 1e3 ? (v/1e3).toFixed(1) + "K" : v.toFixed(0); };
const sgnPct = v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
const cls = v => v >= 0 ? "up" : "down";
const sgnUsd = v => (v >= 0 ? "+$" : "-$") + money(Math.abs(v));

/* ======================= GENERATED ART ======================= */
let artN = 0;
const AVP = [["#E6EEFF","#A9C1F5","#2E6BFF"],["#F0F2F6","#C5CCD8","#667487"],["#E4F1FA","#A9CFEA","#1F8FE5"],["#EEF0F3","#BAC1CC","#3F4A5C"],["#E1F3F1","#A6D6D1","#0E9AA7"],["#E9EEF8","#B4C4E6","#3E5FA8"],["#F3F4F6","#D3D8DF","#1E2A3D"],["#E3EEFF","#92B2F5","#1B4FD6"]];
function avatarSVG(seed, size = 40){
  const r = rngFor("av" + seed), pal = AVP[Math.floor(r() * AVP.length)], fam = hash(seed) % 8, [lt, md, dk] = pal, id = "av" + hash(seed) + "_" + fam;
  const rn = (a, b) => a + r() * (b - a), tone = [lt, md, dk, "#fff"];
  let g = "";
  if (fam === 0){ // bust
    const hx = rn(28, 36);
    g = `<ellipse cx="32" cy="66" rx="25" ry="22" fill="${dk}"/><ellipse cx="32" cy="66" rx="25" ry="22" fill="url(#${id}s)"/><rect x="27" y="34" width="10" height="12" rx="4" fill="${md}"/><circle cx="32" cy="27" r="11" fill="#fff" opacity=".92"/><path d="M20.5 27a11.5 11.5 0 0 1 23 0c-4-5-9-6.5-12-6.5S24.500 22 20.500 27z" fill="${dk}"/><circle cx="${hx}" cy="${rn(24, 28)}" r="1.4" fill="${dk}" opacity=".0"/>`;
  } else if (fam === 1){ // rings
    const cx = rn(24, 40), cy = rn(24, 40);
    g = [30, 23, 16, 9, 4].map((rad, i) => `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${tone[i % 3]}" opacity="${.35 + i * .13}"/>`).join("");
  } else if (fam === 2){ // mosaic triangles
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++){ const c1 = tone[Math.floor(r() * 4)], c2 = tone[Math.floor(r() * 4)];
      g += `<path d="M${x*16} ${y*16}h16l-16 16z" fill="${c1}" opacity=".85"/><path d="M${x*16+16} ${y*16}v16h-16z" fill="${c2}" opacity=".7"/>`; }
  } else if (fam === 3){ // blob face
    const w = rn(20, 25), h = rn(20, 25);
    g = `<path d="M32 ${32-h}c${w*.9} 0 ${w} ${h*.5} ${w} ${h}s-${w*.2} ${h}-${w} ${h}-${w}-${h*.5}-${w}-${h}S${32-w} ${32-h} 32 ${32-h}z" fill="${md}"/><path d="M32 ${32-h}c${w*.9} 0 ${w} ${h*.5} ${w} ${h}s-${w*.2} ${h}-${w} ${h}-${w}-${h*.5}-${w}-${h}S${32-w} ${32-h} 32 ${32-h}z" fill="url(#${id}s)"/><circle cx="25" cy="29" r="2.6" fill="#fff"/><circle cx="39" cy="29" r="2.6" fill="#fff"/><circle cx="25.6" cy="29.4" r="1.2" fill="${dk}"/><circle cx="39.6" cy="29.4" r="1.2" fill="${dk}"/><path d="M25 38q7 ${rn(4, 8)} 14 0" stroke="${dk}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  } else if (fam === 4){ // stripes + disc
    const a = Math.floor(rn(4, 8));
    for (let i = -4; i < 12; i++) g += `<path d="M${i*a*1.8} 64l${28} -${28}h${a}l-28 28z" fill="${tone[i & 1 ? 1 : 0]}" opacity=".7"/>`;
    g += `<circle cx="32" cy="32" r="13" fill="${dk}"/><circle cx="32" cy="32" r="13" fill="url(#${id}s)"/><circle cx="32" cy="32" r="5" fill="#fff" opacity=".9"/>`;
  } else if (fam === 5){ // hex facets
    const pts = [...Array(6)].map((_, i) => { const a = Math.PI / 3 * i - Math.PI / 6; return [32 + 25 * Math.cos(a), 32 + 25 * Math.sin(a)]; });
    g = pts.map((p, i) => { const q = pts[(i + 1) % 6]; return `<path d="M32 32L${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}z" fill="${tone[(i + Math.floor(r() * 3)) % 4]}" opacity="${rn(.65, 1).toFixed(2)}"/>`; }).join("");
  } else if (fam === 6){ // waves + sun
    g = `<circle cx="${rn(20, 44)}" cy="${rn(16, 26)}" r="8" fill="#fff" opacity=".85"/>` + [0, 1, 2].map(i => { const y = 34 + i * 9, a = rn(3, 7); return `<path d="M0 ${y}q16 -${a*2} 32 0t32 0V64H0z" fill="${tone[i]}" opacity="${.55 + i * .2}"/>`; }).join("");
  } else { // dot grid
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) g += `<circle cx="${8 + x*12}" cy="${8 + y*12}" r="${rn(1.5, 5.2).toFixed(1)}" fill="${tone[(x + y) % 3]}" opacity=".85"/>`;
    g += `<circle cx="32" cy="32" r="${rn(9, 13)}" fill="#fff" opacity=".9"/><circle cx="32" cy="32" r="5" fill="${dk}"/>`;
  }
  return `<svg class="px-avs" width="${size}" height="${size}" viewBox="0 0 64 64" style="border-radius:50%;display:block;flex-shrink:0" role="img" aria-label="Trader avatar"><defs><linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lt}"/><stop offset="1" stop-color="${md}"/></linearGradient><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient></defs><rect width="64" height="64" fill="url(#${id}b)"/>${g}</svg>`;
}
const artWrap = (w, h, defs, body) => { const n = ++artN; return `<svg width="${w}" height="${h}" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><defs>${defs.replace(/\{n\}/g, n)}</defs>${body.replace(/\{n\}/g, n)}</svg>`; };
const SIL = n => `<linearGradient id="sl{n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#D5DBE6"/><stop offset="1" stop-color="#9AA5B8"/></linearGradient><linearGradient id="bl{n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6E9BFF"/><stop offset="1" stop-color="#2352D8"/></linearGradient><linearGradient id="bk{n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4B5568"/><stop offset="1" stop-color="#262D3B"/></linearGradient>`;
const ART = {
  avatar: avatarSVG,
  trophy: (size = 96) => artWrap(size, size, SIL(), `<ellipse cx="60" cy="108" rx="30" ry="6" fill="#000" opacity=".12"/><rect x="42" y="92" width="36" height="12" rx="4" fill="url(#bk{n})"/><rect x="50" y="76" width="20" height="18" fill="url(#sl{n})"/><path d="M30 20h60v26c0 18-13 31-30 31S30 64 30 46z" fill="url(#sl{n})"/><path d="M30 28H16c0 14 7 22 18 24M90 28h14c0 14-7 22-18 24" fill="none" stroke="url(#sl{n})" stroke-width="6" stroke-linecap="round"/><path d="M38 24h14v30c-9-4-14-12-14-20z" fill="#fff" opacity=".55"/><path d="M60 30l5.200 10.500 11.600 1.700-8.400 8.200 2 11.600L60 56.500 49.600 62l2-11.600-8.400-8.200 11.600-1.700z" fill="url(#bl{n})"/>`),
  podium: (size = 96) => artWrap(size, size, SIL(), `<ellipse cx="60" cy="108" rx="48" ry="6" fill="#000" opacity=".1"/><rect x="8" y="66" width="32" height="40" rx="5" fill="url(#sl{n})"/><rect x="80" y="76" width="32" height="30" rx="5" fill="url(#sl{n})"/><rect x="40" y="48" width="40" height="58" rx="5" fill="url(#bl{n})"/><path d="M40 53a5 5 0 0 1 5-5h30a5 5 0 0 1 5 5v8H40z" fill="#fff" opacity=".22"/><text x="60" y="88" text-anchor="middle" font-size="26" font-weight="800" fill="#fff" font-family="Manrope,sans-serif">1</text><text x="24" y="92" text-anchor="middle" font-size="20" font-weight="800" fill="#6B7789" font-family="Manrope,sans-serif">2</text><text x="96" y="99" text-anchor="middle" font-size="18" font-weight="800" fill="#6B7789" font-family="Manrope,sans-serif">3</text><path d="M60 14l4.500 9.200 10 1.500-7.300 7.100 1.800 10-9-4.800-9 4.800 1.800-10-7.300-7.100 10-1.500z" fill="url(#sl{n})" stroke="#9AA5B8" stroke-width="1"/>`),
  coins: (size = 96) => artWrap(size, size, SIL(), `<ellipse cx="60" cy="106" rx="38" ry="7" fill="#000" opacity=".12"/>` + [[78,0],[66,8],[54,-4]].map(([y, dx], i) => `<g transform="translate(${dx} 0)"><ellipse cx="54" cy="${y+10}" rx="30" ry="11" fill="#7C8798"/><rect x="24" y="${y-2}" width="60" height="12" fill="#B4BDCB"/><ellipse cx="54" cy="${y-2}" rx="30" ry="11" fill="url(#sl{n})"/><ellipse cx="54" cy="${y-2}" rx="21" ry="7" fill="none" stroke="#9AA5B8" stroke-width="1.500"/></g>`).join("") + `<g transform="translate(0 -6)"><ellipse cx="62" cy="38" rx="26" ry="26" fill="url(#bl{n})"/><ellipse cx="62" cy="38" rx="20" ry="20" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><text x="62" y="47" text-anchor="middle" font-size="26" font-weight="800" fill="#fff" font-family="Manrope,sans-serif">$</text></g>`),
  shield: (size = 96) => artWrap(size, size, SIL(), `<ellipse cx="60" cy="110" rx="28" ry="5" fill="#000" opacity=".12"/><path d="M60 8l40 14v32c0 28-17 46-40 56C37 100 20 82 20 54V22z" fill="url(#sl{n})"/><path d="M60 16l33 11.500V54c0 23-14 38-33 46C41 92 27 77 27 54V27.500z" fill="url(#bl{n})"/><path d="M60 16l33 11.500V54c0 3-.2 6-.7 8.800L60 16z" fill="#fff" opacity=".14"/><path d="M44 58l11 11 22-24" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`),
  growth: (size = 96) => artWrap(size, size, SIL(), `<ellipse cx="58" cy="108" rx="44" ry="6" fill="#000" opacity=".1"/><rect x="16" y="72" width="20" height="32" rx="4" fill="url(#sl{n})"/><rect x="42" y="56" width="20" height="48" rx="4" fill="url(#sl{n})"/><rect x="68" y="38" width="20" height="66" rx="4" fill="url(#bl{n})"/><path d="M16 56L48 34l20 10 34-28" fill="none" stroke="url(#bk{n})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M90 14h16v16" fill="none" stroke="url(#bk{n})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="48" cy="34" r="5" fill="#fff" stroke="#2352D8" stroke-width="3"/>`)
};
window.ART = ART;

/* ======================= ASSETS ======================= */
const WL = ["spot","funding","futures","binary","options","earn","games","predict","cfd"];
const NAMES = c => c === "USDT" ? "TetherUS" : (window.COIN_NAMES && window.COIN_NAMES[c]) || c;
function spotHoldings(){
  try { const h = window.SPOT?.holdings?.() || []; return (Array.isArray(h) ? h : []).map(x => {
    const coin = String(x.coin || x.base || x.asset || x.symbol || x.sym || "").replace(/USDT$/, "").toUpperCase(), amt = +(x.amount ?? x.qty ?? x.free ?? x.balance ?? 0), m = M.get(coin + "USDT"), px = m?.price ?? +x.price ?? 0, val = +(x.value ?? amt * px), chg = m?.chg ?? 0;
    return {coin, amt, val, pnl: val - val / (1 + chg / 100), pct: chg, cost: +x.cost || 0, apnl: x.cost > 0 ? val - x.cost : null}; }).filter(x => x.coin && x.amt > 0); } catch { return []; }
}
const copyNow = () => cstate().active.reduce((a, c) => a + c.amt * (1 + copyPct(c) / 100), 0);
Pages.assets = (params) => {
  let tab = params[0] || "overview"; if (tab === "binary") tab = "spot"; if (tab === "funding") tab = "fund"; if (tab === "copying") tab = "copy"; if (tab === "predict" || tab === "prediction") tab = "pred"; if (tab === "games" || tab === "racer" || tab === "moneygame") tab = "game";
  let view = "crypto", q = "", showQ = false, sortBy = "value";
  const TABS = [["overview","Overview"],["fund","Funding"],["spot","Spot"],["futures","Futures"],["copy","Copy"],["earn","Earn"],["pred","Prediction"],["game","Money Game"],["cfd","CFD"]];
  const html = `<div class="px-page px-as"><div class="px-tabs" id="atabs">${TABS.map(([k,n]) => `<button data-at="${k}" class="${tab===k?"on":""}">${n}</button>`).join("")}</div><div id="ab"></div></div>`;
  function totals(){
    const s = S(), bin = s.positions.reduce((a,p) => a + p.amount, 0), fm = s.fut.positions.reduce((a,p) => a + p.margin, 0) + s.fut.orders.reduce((a,o) => a + o.margin + o.fee, 0);
    const up = s.fut.positions.reduce((a,p) => a + E.futPnl(p).pnl, 0), vault = E.earnValue(), hold = spotHoldings(), hv = hold.reduce((a,x) => a + x.val, 0), hp = hold.reduce((a,x) => a + x.pnl, 0);
    const act = cstate().active, cv = act.reduce((a,c) => a + c.amt * (1 + copyPct(c) / 100), 0), cinv = act.reduce((a,c) => a + c.amt, 0);
    const d0 = new Date().setHours(0,0,0,0), usdtPnl = E.stats().todayPnl + s.fut.history.filter(x => x.closed >= d0).reduce((a,x) => a + x.profit, 0) + up;
    const bv = (s.spot?.bots || []).filter(b => b.running).reduce((a, b) => a + b.invest + b.invest * b.roiM / 100 * ((Date.now() - b.since) / (30 * 864e5)), 0);
    const fut = fm + up, total = s.balance + bin + fut + vault + hv + cv + bv;
    return {fund:s.balance, bin, fm, up, fut, vault, hold, hv, hp, cv, cinv, cpn: cv - cinv, usdtPnl, tp: usdtPnl + hp, total, spot: bin + hv + bv};
  }
  function calendar(){
    const now = new Date(), y = now.getFullYear(), m = now.getMonth(), first = new Date(y, m, 1), days = new Date(y, m+1, 0).getDate(), off = (first.getDay() + 6) % 7;
    const all = [...S().history.map(x => ({t:x.closed, p:x.profit})), ...S().fut.history.map(x => ({t:x.closed, p:x.profit}))];
    const byDay = {}; all.forEach(x => { const d = new Date(x.t); if (d.getMonth() === m && d.getFullYear() === y) byDay[d.getDate()] = (byDay[d.getDate()] || 0) + x.p; });
    const tot = Object.values(byDay).reduce((a,b) => a + b, 0);
    let cells = ["M","T","W","T","F","S","S"].map(d => `<div class="w">${d}</div>`).join("") + Array(off).fill("<div></div>").join("");
    for (let d = 1; d <= days; d++){ const v = byDay[d];
      cells += `<div class="d ${d === now.getDate() ? "t" : ""} ${v == null ? "" : v >= 0 ? "u" : "l"}">${d}${v != null ? `<small>${v >= 0 ? "+" : ""}${Math.abs(v) >= 1000 ? (v/1000).toFixed(1) + "K" : v.toFixed(0)}</small>` : ""}</div>`; }
    return `<div class="px-sec-h"><h2>${now.toLocaleString("en-US", {month:"long", year:"numeric"})} PnL</h2><b class="num ${cls(tot)}" style="font-size:13px">${signed(tot)} USDT</b></div><div class="px-cal">${cells}</div>`;
  }
  const txList = list => list.length ? list.map(x => {
      const dep = x.kind === "deposit", wd = x.kind === "withdrawal", tr = x.type === "transfer";
      const name = tr ? `Transfer ${esc(UI.walletName(x.from))} → ${esc(UI.walletName(x.to))}` : wd ? `Withdrawal ${esc(x.coin || "USDT")}` : `${dep ? "Deposit" : "Transfer"} ${esc(x.coin || "USDT")}`;
      const amt = tr ? x.amt : (x.coinAmt ?? x.amount), sub = tr ? "Completed" : wd ? (x.status || "Completed") : "Completed";
      return `<div class="px-row"><span class="px-ico n">${ic(dep ? "down" : tr ? "swap" : "up",16)}</span><div class="grow"><b>${name}</b><div class="px-mut">${U.dateStr(x.t)}${x.method ? " · " + esc(x.method) : ""}</div></div><div class="r"><b class="num ${dep?"up":""}">${dep?"+":wd?"-":""}${fmt(amt, x.coinAmt ? 6 : 2)}</b><span class="px-mut">${esc(sub)}</span></div></div>`; }).join("") : empty("file","No transactions yet");
  /* rows: {coin, amt, val, pnl, sub} */
  function rowsFor(t){
    const usdt = (val, sub, pnl, amt) => ({coin:"USDT", amt: amt ?? val, val, pnl, sub});
    const hold = t.hold.map(x => ({coin:x.coin, amt:x.amt, val:x.val, pnl:x.pnl, sub:null, cost:x.cost, apnl:x.apnl}));
    if (tab === "fund") return [usdt(store.wb("funding"), "Funding wallet", 0)];
    if (tab === "spot") return [usdt(store.wb("spot"), "Spot wallet", 0), ...hold, ...(t.bin > 0 ? [usdt(t.bin, "Open binary stake", 0)] : [])];
    if (tab === "futures") return [usdt(store.wb("futures") + t.fut, "Wallet + margin + unrealized PnL", t.up)];
    if (tab === "spot") return [...hold, ...(t.bin > 0 ? [usdt(t.bin, "Open binary stake", 0)] : [])];
    if (tab === "futures") return [usdt(t.fut, "Margin + unrealized PnL", t.up)];
    if (tab === "copy") return [usdt(t.cv, "Copy trading", t.cpn)];
    if (tab === "earn") return [usdt(t.vault, "Flexible vault", 0)];
    return [usdt(t.fund + t.bin + t.fut + t.cv + t.vault, "Fund, Futures, Copy, Earn", t.usdtPnl + t.cpn), ...hold];
  }
  const coinRow = (x, H) => { const base = x.val - x.pnl, pc = base > 0 ? x.pnl / base * 100 : 0;
    return `<div class="px-coin" data-coin="${esc(x.coin)}" tabindex="0" role="button">${UI.coinImg(x.coin, 38)}<div class="grow"><b>${esc(x.coin)}</b><div class="px-mut">${esc(x.sub || NAMES(x.coin))}</div></div><div class="r"><b class="num">${H(fmt(x.amt, x.coin === "USDT" ? 2 : 6))}</b><span class="px-mut num">${H("$" + money(x.val))}</span></div>
      <div class="pl"><span>Today's PnL</span><b class="num ${cls(x.pnl)}">${H(sgnUsd(x.pnl) + " (" + sgnPct(pc) + ")")}</b></div>${x.apnl != null && x.cost > 0 ? `<div class="pl pl2"><span>All-time PnL</span><b class="num ${cls(x.apnl)}">${H(sgnUsd(x.apnl) + " (" + sgnPct(x.apnl / x.cost * 100) + ")")}</b></div>` : ""}</div>`; };
  function pnlSheet(t){
    const pts = [C.START_BALANCE, ...S().balHist.map(x => x.b)].slice(-120), delta = pts[pts.length-1] - pts[0];
    U.sheet("PnL analysis", `<div class="px-pnl"><div class="px-mut">Cumulative balance change</div><div class="big num ${cls(delta)}">${signed(delta)} <small>USDT</small></div><div class="px-big">${spark(pts, 320, 110)}</div></div>
      <div class="px-kpis" style="margin:12px 0 16px"><div><span>Today's PnL</span><b class="num ${cls(t.tp)}">${signed(t.tp)}</b></div><div><span>Unrealized (Futures)</span><b class="num ${cls(t.up)}">${signed(t.up)}</b></div><div><span>Realized trades</span><b class="num">${S().history.length + S().fut.history.length}</b></div><div><span>Win rate</span><b class="num">${E.stats().winRate.toFixed(1)}%</b></div></div>${calendar()}`);
  }

  /* ---- Transfer & Convert sheets ---- */
  const XACC = [["spot","Spot / Trading",false],["earn","Earn (Flexible)",false],["fut","Futures",true],["copy","Copy Trading",true]];
  const xBal = k => k === "earn" ? E.vaultValue() : S().balance;
  function transferSheet(done){
    let from = "spot", to = "earn";
    const opts = sel => XACC.map(([k,n,dis]) => `<option value="${k}" ${dis ? "disabled" : ""} ${k === sel ? "selected" : ""}>${n}${dis ? " (uses Spot balance)" : ""}</option>`).join("");
    U.sheet("Transfer", `<div class="px-xf">
      <div class="px-xrow"><span class="lb">From</span><select id="xf" aria-label="From account">${opts(from)}</select></div>
      <div class="px-xsw"><button id="xs" aria-label="Swap accounts">${ic("swap",18,1.8)}</button></div>
      <div class="px-xrow"><span class="lb">To</span><select id="xt" aria-label="To account">${opts(to)}</select></div>
      <div class="px-xcoin">${UI.coinImg("USDT",26)}<b>USDT</b><span class="px-mut">Tether</span></div>
      <div class="px-fld"><label><span>Amount</span><span class="px-mut" id="xav"></span></label><div class="px-inp"><input id="xa" type="number" inputmode="decimal" placeholder="0.00"><button id="xm" class="px-link">Max</button><span>USDT</span></div></div>
      <div class="px-mut" style="margin:8px 0 14px">Futures &amp; Copy use your Spot/Trading balance.</div>
      <button class="px-btn pri blk lg" id="xok">Confirm</button></div>`, el => {
      const $ = q => el.querySelector(q), F = $("#xf"), T = $("#xt"), A = $("#xa");
      const av = () => Math.max(0, Math.floor(xBal(from) * 100) / 100);
      const upd = () => { F.value = from; T.value = to; $("#xav").textContent = "Available: " + money(av()) + " USDT"; };
      F.onchange = () => { from = F.value; if (to === from) to = from === "spot" ? "earn" : "spot"; upd(); };
      T.onchange = () => { to = T.value; if (to === from) from = to === "spot" ? "earn" : "spot"; upd(); };
      $("#xs").onclick = () => { [from, to] = [to, from]; upd(); };
      $("#xm").onclick = () => { A.value = av(); };
      $("#xok").onclick = () => {
        const v = +A.value; if (!(v > 0)) return toast("Enter an amount", "bad");
        if (v > av() + 1e-9) return toast("Insufficient balance", "bad");
        const err = E.vaultMove(Math.min(v, xBal(from)), from === "spot" ? "in" : "out");
        if (err) return toast(err, "bad");
        U.fx("claim"); U.closeLayer(); toast(`Transfer successful: ${money(v)} USDT to ${to === "earn" ? "Earn" : "Spot"}`, "ok"); done && done();
      };
      upd();
    });
  }
  function convertSheet(done){
    const H = (() => { try { return window.SPOT?.holdings?.() || []; } catch { return []; } })();
    const fromC = ["USDT", ...H.map(h => h.coin)], toC = ["USDT","BTC","ETH","BNB","SOL","XRP","DOGE"];
    let f = "USDT", t = "BTC";
    const px = c => c === "USDT" ? 1 : (M.get(c + "USDT")?.price || 0);
    const have = c => c === "USDT" ? store.wb("spot") : (H.find(h => h.coin === c)?.avail || 0);
    const op = (l, sel) => l.map(c => `<option ${c === sel ? "selected" : ""}>${c}</option>`).join("");
    U.sheet("Convert", `<div class="px-xf">
      <div class="px-xrow"><span class="lb">From</span><select id="cf">${op(fromC, f)}</select></div>
      <div class="px-xsw"><button id="cs" aria-label="Swap coins">${ic("swap",18,1.8)}</button></div>
      <div class="px-xrow"><span class="lb">To</span><select id="ct">${op(toC, t)}</select></div>
      <div class="px-fld"><label><span>Amount</span><span class="px-mut" id="cav"></span></label><div class="px-inp"><input id="ca" type="number" inputmode="decimal" placeholder="0.00"><button id="cm" class="px-link">Max</button><span id="cu"></span></div></div>
      <div class="px-xprev"><div><span>Rate</span><b class="num" id="cr">-</b></div><div><span>You receive</span><b class="num" id="cp">-</b></div><div><span>Fee (0.1% per trade)</span><b class="num" id="cfe">-</b></div></div>
      <button class="px-btn pri blk lg" id="cok">Confirm</button></div>`, el => {
      const $ = q => el.querySelector(q), CF = $("#cf"), CT = $("#ct"), A = $("#ca");
      const rate = () => px(f) / (px(t) || NaN);
      const legs = () => (f !== "USDT" ? 1 : 0) + (t !== "USDT" ? 1 : 0);
      const recv = v => v * rate() * Math.pow(1 - 0.001, legs());
      const upd = () => { const v = +A.value || 0, r = rate();
        $("#cu").textContent = f; $("#cav").textContent = "Available: " + fmt(have(f), f === "USDT" ? 2 : 6) + " " + f;
        $("#cr").textContent = isFinite(r) ? `1 ${f} ≈ ${fmt(r, r >= 1 ? 4 : 8)} ${t}` : "Price unavailable";
        $("#cp").textContent = v > 0 && isFinite(r) ? fmt(recv(v), t === "USDT" ? 2 : 6) + " " + t : "-";
        $("#cfe").textContent = v > 0 ? fmt(v * px(f) * (1 - Math.pow(0.999, legs())), 4) + " USDT" : "-"; };
      const sync = () => { CF.value = f; CT.value = t; upd(); };
      CF.onchange = () => { f = CF.value; if (t === f) t = f === "USDT" ? "BTC" : "USDT"; sync(); };
      CT.onchange = () => { t = CT.value; if (t === f) f = t === "USDT" ? "BTC" : "USDT"; if (!fromC.includes(f)) f = "USDT"; sync(); };
      $("#cs").onclick = () => { if (!fromC.includes(t)) return toast("You don't hold " + t, "info"); [f, t] = [t, f]; if (!toC.includes(t)) toC.push(t); CT.innerHTML = op(toC, t); sync(); };
      $("#cm").onclick = () => { A.value = f === "USDT" ? Math.floor(have(f) * 100) / 100 : have(f); upd(); };
      A.oninput = upd;
      $("#cok").onclick = () => {
        const v = +A.value, r = rate(); if (!(v > 0)) return toast("Enter an amount", "bad");
        if (!isFinite(r) || !(px(f) > 0)) return toast("Price unavailable, try again", "bad");
        if (v > have(f) + 1e-9) return toast("Insufficient balance", "bad");
        const sp = S().spot || (S().spot = {hold:{}, orders:[], history:[]}); sp.hold ||= {}; sp.history ||= []; sp.orders ||= [];
        let usdt = v * px(f);
        if (f === "USDT") store.addWallet("spot", -v, "convert");
        else { const h = sp.hold[f], ac = h.cost / h.qty, q = Math.min(v, h.qty); h.cost = Math.max(0, h.cost - ac * q); h.qty -= q; if (h.qty < 1e-9) delete sp.hold[f];
          usdt *= 0.999; sp.history.unshift({id:U.uid(), sym:f + "USDT", side:"sell", price:px(f), qty:q, fee:q * px(f) * 0.001, ts:Date.now(), type:"convert"}); }
        if (t === "USDT") store.addWallet("spot", usdt, "convert");
        else { const q = usdt / px(t) * 0.999, h = sp.hold[t] ||= {qty:0, cost:0}; h.qty += q; h.cost += usdt;
          sp.history.unshift({id:U.uid(), sym:t + "USDT", side:"buy", price:px(t), qty:usdt / px(t), fee:usdt * 0.001, ts:Date.now(), type:"convert"}); }
        sp.history = sp.history.slice(0, 200);
        store.save(); bus.emit("spot"); U.fx("claim"); U.closeLayer();
        toast(`Converted ${fmt(v, f === "USDT" ? 2 : 6)} ${f} to ${fmt(recv(v), t === "USDT" ? 2 : 6)} ${t}`, "ok"); done && done();
      };
      sync();
    });
  }
  const CHIPS = () => `<div class="px-sec-h" style="margin-top:14px"><h2>Coins</h2></div><div class="px-chips2"><div class="px-chip-g"><button data-v="crypto" class="on">Crypto</button><button data-v="account">Account</button></div><span class="sp"></span><button class="icon-btn" data-sq aria-label="Search">${ic("search",18,1.7)}</button><button class="icon-btn" data-filter aria-label="Sort">${ic("sort",18,1.7)}</button></div>`;
  function render(r){
    const s = S(), t = totals(), hide = !!s.settings.hideBal, H = v => hide ? "******" : v, box = r.querySelector("#ab");
    const PI = UI.assetsProdInfo && UI.assetsProdInfo(tab);
    const label = {overview:"Total Assets", fund:"Funding Account", spot:"Spot Account", futures:"Futures Account", copy:"Copy Trading", earn:"Earn Account"}[tab] || (PI && PI.label);
    const val = PI ? PI.val : {overview:t.total, fund:store.wb("funding"), spot:t.spot + store.wb("spot"), futures:t.fut + store.wb("futures"), copy:t.cv, earn:t.vault}[tab];
    const pnl = PI ? PI.pnl : {overview:t.tp, fund:null, spot:t.hp, futures:t.up, copy:t.cpn, earn:null}[tab];
    const pc = pnl == null ? 0 : pnl / Math.max(1, val - pnl) * 100;
    const acts = `<div class="px-acts"><a href="#/deposit" class="pri"><span>${ic("down",24,1.8)}</span>Deposit</a><a href="#/withdraw"><span>${ic("up",24,1.8)}</span>Withdraw</a><button data-xfer><span>${ic("swap",24,1.8)}</span>Transfer</button><button data-conv><span>${ic("reset",24,1.8)}</span>Convert</button><a href="#/ai"><span>${UI.aiIcon ? UI.aiIcon(24) : ""}</span>AI</a></div>`;
    const promo = `<a class="px-promo" href="#/earn"><div class="tx"><b>Earn up to 12% APR on USDT</b><span>Flexible and locked plans, redeem anytime</span></div>${ART.coins(84)}<i class="arr">${ic("chev",14,2)}</i></a>`;
    let body = "";
    if (PI){ body = UI.assetsProd(tab, H); }
    else if (tab === "overview" && view === "account"){
      const wb = store.wb, parts = [["Funding","fund",wb("funding"),"#2E6BFF"],["Spot","spot",wb("spot") + t.hv,"#7FA6FF"],["Futures","futures",Math.max(0,t.fut) + wb("futures"),"#5B6575"],["Binary / Options","spot",wb("binary") + wb("options") + t.bin,"#8A94A6"],["Copy Trading","copy",t.cv,"#A8B3C4"],["Earn","earn",t.vault + wb("earn"),"#D3D9E2"],["Money Game","games",wb("games"),"#6E7B93"],["Prediction","predict",wb("predict"),"#B9C2D3"],["CFD Trade","cfd",wb("cfd"),"#9AA6BA"]], sum = parts.reduce((a,p) => a + p[2], 0) || 1;
      body = CHIPS() + `<div class="px-alloc">${parts.filter(p => p[2] > 0).map(p => `<i style="flex:${p[2]/sum};background:${p[3]}"></i>`).join("")}</div>
        ${parts.map(([n,k,v,c]) => `<button class="px-acc" data-go="${k}"><i style="background:${c}"></i><div class="grow"><b>${n}</b><span class="px-mut">${hide ? "**" : (v/sum*100).toFixed(1) + "% of total"}</span></div><div class="r"><b class="num">${H(money(v))}</b><span class="px-mut">USDT</span></div><span class="ch">${ic("chev",14)}</span></button>`).join("")}`;
    } else {
      let rows = rowsFor(t); if (s.settings.hideSmall) rows = rows.filter(x => x.val >= 1);
      if (q) rows = rows.filter(x => (x.coin + NAMES(x.coin)).toUpperCase().includes(q.toUpperCase()));
      rows.sort(sortBy === "name" ? (a,b) => a.coin.localeCompare(b.coin) : sortBy === "pnl" ? (a,b) => b.pnl - a.pnl : (a,b) => b.val - a.val);
      body = (tab === "overview" ? `<div class="px-sec-h"><h2>Wallets</h2><button class="px-link" data-xfer>Transfer</button></div>${WL.map(k => `<button class="px-acc" data-wl="${k}"><div class="grow"><b>${UI.walletName(k)}</b></div><div class="r"><b class="num">${H(money(store.wb(k)))}</b><span class="px-mut">USDT</span></div><span class="ch">${ic("chev",14)}</span></button>`).join("")}${CHIPS()}` : "")
        + (showQ ? `<label class="px-search" style="margin:0 0 8px">${ic("search",16)}<input id="aq" value="${esc(q)}" placeholder="Search coins" autocomplete="off" aria-label="Search coins"></label>` : "")
        + (tab === "spot" ? `<button class="as-dust" data-dust type="button"><span>Convert crypto dust into USDT</span>${ic("chev",14,2)}</button>` : "")
        + `<label class="px-chk" style="margin:4px 0"><input type="checkbox" data-small ${s.settings.hideSmall ? "checked" : ""}><span>Hide small balances</span></label>`
        + (rows.length ? rows.map(x => coinRow(x, H)).join("") : empty("wallet", s.settings.hideSmall ? "No balances above 1 USDT" : "No assets"));
      if (tab === "spot") body += `<a class="px-btn blk" style="margin-top:12px" href="#/trade">Trade</a>`;
      if (tab === "futures") body += `<div class="px-sec"><div class="px-sec-h"><h2>Position history</h2><a href="#/history">All</a></div>${s.fut.history.length ? UI.historyHtml(s.fut.history.slice(0, 5)) : empty("file","No closed positions")}</div>`;
      if (tab === "copy"){ const act = cstate().active; body += `<div class="px-sec-h" style="margin-top:14px"><h2>Active copies (${act.length})</h2><a href="#/copy/my">My copying</a></div>` + (act.length ? act.map(c => { const p = copyPct(c), pn = c.amt * p / 100; return `<a class="px-row" href="#/copy/my">${ART.avatar(c.lid, 36)}<div class="grow"><b>${esc(c.name)}</b><div class="px-mut">Invested ${H(money(c.amt))} USDT</div></div><div class="r"><b class="num ${cls(pn)}">${H(signed(pn))}</b><span class="px-mut num">${H(sgnPct(p))}</span></div></a>`; }).join("") : empty("users","No active copies")) + `<a class="px-btn pri blk" style="margin-top:12px" href="#/copy">Find traders</a>`; }
      if (tab === "earn") body += `<a class="px-btn pri blk" style="margin-top:12px" href="#/earn">Go to Earn</a>`;
      if (tab === "fund" || tab === "overview") body += `<div class="px-sec"><div class="px-sec-h"><h2>Recent transactions</h2><a href="#/history">Trade history</a></div>${txList(s.tx.slice(0, tab === "fund" ? 20 : 5))}</div>`;
    }
    box.innerHTML = `<div class="px-ah"><div class="top"><div class="lb">${label}<button data-eye aria-label="${hide ? "Show" : "Hide"} balance">${ic(hide?"eyeoff":"eye",16)}</button></div><span class="sp"></span><button class="icon-btn" data-pnl aria-label="PnL analysis">${ic("chart",20,1.7)}</button><a class="icon-btn" href="#/history" aria-label="History">${ic("clockh",20,1.7)}</a></div>
      <div class="big num">${H(money(val))}<small>USDT ${ic("chevd",12,2)}</small></div><div class="eq num">${H("≈ $" + money(val * (M.usdtUsd ? M.usdtUsd() : 1)))}</div>
      ${pnl != null ? `<button class="pl" data-pnl>Today's PnL <b class="num ${cls(pnl)}">${H(sgnUsd(pnl) + " (" + sgnPct(pc) + ")")}</b>${ic("chev",12,2)}</button>` : ""}</div>${acts}<div class="px-car-ph"></div><div id="alist">${body}</div>`;
    try { UI.assetsCarousel && UI.assetsCarousel(box); } catch (e) {}
    if (PI) try { UI.assetsProdBind(box, tab, () => render(r)); } catch (e) {}
    box.querySelectorAll("[data-dust]").forEach(b => b.onclick = () => UI.dustSheet(() => render(r)));
    box.querySelectorAll("[data-coin]").forEach(b => { const go = () => UI.coinSheet && UI.coinSheet(b.dataset.coin, t, () => render(r)); b.onclick = go; b.onkeydown = e => { if (e.key === "Enter") go(); }; });
    box.querySelectorAll("[data-xfer]").forEach(b => b.onclick = () => UI.transferSheet({done: () => render(r)}));
    box.querySelectorAll("[data-wl]").forEach(b => b.onclick = () => UI.transferSheet({to: b.dataset.wl}));
    box.querySelectorAll("[data-conv]").forEach(b => b.onclick = () => convertSheet(() => render(r)));
    box.querySelectorAll("[data-eye]").forEach(b => b.onclick = () => { s.settings.hideBal = !s.settings.hideBal; store.save(); render(r); });
    box.querySelectorAll("[data-pnl]").forEach(b => b.onclick = () => { if (window.Pages && Pages.pnl) location.hash = "#/pnl"; else pnlSheet(t); });
    const sm = box.querySelector("[data-small]"); if (sm) sm.onchange = () => { s.settings.hideSmall = sm.checked; store.save(); render(r); };
    box.querySelectorAll("[data-v]").forEach(b => { b.classList.toggle("on", b.dataset.v === view); b.onclick = () => { view = b.dataset.v; render(r); }; });
    box.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { tab = b.dataset.go === "games" ? "game" : b.dataset.go === "predict" ? "pred" : b.dataset.go; r.querySelectorAll("[data-at]").forEach(x => x.classList.toggle("on", x.dataset.at === tab)); render(r); });
    const sq = box.querySelector("[data-sq]"); if (sq) sq.onclick = () => { showQ = !showQ; if (!showQ) q = ""; render(r); if (showQ) r.querySelector("#aq")?.focus(); };
    const aq = box.querySelector("#aq"); if (aq) aq.oninput = () => { q = aq.value; const p = aq.selectionStart; render(r); const n = r.querySelector("#aq"); if (n){ n.focus(); n.setSelectionRange(p, p); } };
    const fl = box.querySelector("[data-filter]"); if (fl) fl.onclick = () => U.sheet("Sort by", [["value","Value (high to low)"],["pnl","Today's PnL"],["name","Name (A-Z)"]].map(([k,n]) => `<button class="px-opt ${sortBy===k?"on":""}" data-k="${k}">${n}${sortBy===k ? ic("check",18,2) : ""}</button>`).join(""), el => el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { sortBy = b.dataset.k; U.closeLayer(); render(r); }));
  }
  return {html, title:"Assets", mount(r){
    render(r);
    try { const on = r.querySelector("#atabs .on"); if (on) r.querySelector("#atabs").scrollLeft = Math.max(0, on.offsetLeft - 40); } catch (e) {}
    r.querySelectorAll("[data-at]").forEach(b => b.onclick = () => { tab = b.dataset.at; r.querySelectorAll("[data-at]").forEach(x => x.classList.toggle("on", x===b)); q = ""; showQ = false; render(r); });
    const iv = setInterval(() => { if (r.isConnected && document.activeElement?.id !== "aq") render(r); }, 4000), offs = [bus.on("balance", () => { if (document.activeElement?.id !== "aq") render(r); })];
    this.unmount = () => { clearInterval(iv); offs.forEach(f => f()); };
  }};
};

/* ======================= DEPOSIT ======================= */
const NETS = {
  USDT:[["BSC","BNB Smart Chain (BEP20)","bnb",1,1],["TRX","Tron (TRC20)","trx",1,1],["ETH","Ethereum (ERC20)","eth",1,2],["POL","Polygon POS","pol",1,1],["SOL","Solana","sol",1,1],["ARBITRUM","Arbitrum One","arb",1,1],["OPTIMISM","Optimism","op",1,1]],
  BTC:[["BTC","Bitcoin","btc",0.00006,10],["BSC","BNB Smart Chain (BEP20)","bnb",0.000001,1]],
  ETH:[["ETH","Ethereum (ERC20)","eth",0.000001,2],["ARBITRUM","Arbitrum One","arb",0.000001,1],["OPTIMISM","Optimism","op",0.000001,1],["BSC","BNB Smart Chain (BEP20)","bnb",0.000001,1]],
  BNB:[["BSC","BNB Smart Chain (BEP20)","bnb",0.00001,1]], SOL:[["SOL","Solana","sol",0.001,1]], TRX:[["TRX","Tron (TRC20)","trx",0.1,1]]
};
const netsFor = c => NETS[c] || [["BSC","BNB Smart Chain (BEP20)","bnb",0.01,1],[c,(window.COIN_NAMES[c] || c) + " Network",c.toLowerCase(),0.01,2]];
const coinIcon = (c, size=36) => UI.coinImg(c, size);
/* v7.1: minimum deposit = 1 USDT value for every coin (USDT = 1 USDT; others = 1 USDT / live price, rounded up) */
const depMin = (coin, fallback) => { if (coin === "USDT") return 1; const p = M.get(coin + "USDT")?.price; return p > 0 ? Math.ceil(1 / p * 1e6) / 1e6 : fallback; };
const depMinTxt = (coin, fallback) => coin === "USDT" ? "1 USDT" : fmt(depMin(coin, fallback), 6).replace(/\.?0+$/, "") + " " + coin + " (≈ 1 USDT)";
function paperAddr(coin, net){ let h = 0; const seed = S().profile.uid + coin + net; for (const ch of seed) h = (h * 131 + ch.charCodeAt(0)) >>> 0; let hex = ""; for (let i=0;i<8;i++){ h = (h * 1103515245 + 12345) >>> 0; hex += h.toString(16).padStart(8,"0"); } return "PAPER" + net.slice(0,3) + hex.slice(0, 33); }
Pages.deposit = (params) => {
  const coin = (params[0] || "").toUpperCase(), net = (params[1] || "").toUpperCase();
  if (!coin) return selectCoin();
  if (!net) return chooseNet(coin);
  return depositPage(coin, net);
};
function selectCoin(){
  const trending = ["USDT","BTC","ETH","BNB"];
  const html = `<div class="px-page">${head("Select Currency")}
    <label class="px-search">${ic("search",16)}<input id="cq" placeholder="Search coins" autocomplete="off" aria-label="Search coins"></label>
    <div id="cl"></div></div>`;
  return {html, title:"Deposit", mount(r){
    const all = () => { const set = new Set(["USDT", ...M.cryptoOrder.map(s => M.get(s)?.base).filter(Boolean)]); return [...set].sort((a,b) => a.localeCompare(b)); };
    const row = c => `<a class="px-row" href="#/deposit/${c}">${coinIcon(c)}<div class="grow"><b>${c}</b><div class="px-mut">${esc(c === "USDT" ? "TetherUS" : window.COIN_NAMES[c] || c)}</div></div><span style="color:var(--muted)">${ic("chev",16)}</span></a>`;
    const render = q => {
      const box = r.querySelector("#cl"); q = (q || "").trim().toUpperCase();
      if (q){ const l = all().filter(c => c.includes(q) || (window.COIN_NAMES[c] || "").toUpperCase().includes(q)); box.innerHTML = `<div style="padding-top:8px">${l.map(row).join("") || empty("search","No coins found")}</div>`; return; }
      const groups = {}; all().forEach(c => { const k = /[0-9]/.test(c[0]) ? "#" : c[0]; (groups[k] ||= []).push(c); });
      box.innerHTML = `<div class="px-grp">Popular</div><div class="px-chips" style="padding-bottom:6px">${trending.map(c => `<button data-go="${c}" style="display:inline-flex;align-items:center;gap:6px;height:34px">${coinIcon(c,18)}${c}</button>`).join("")}</div>
        ${Object.keys(groups).map(k => `<div class="px-grp" id="g-${k === "#" ? "n" : k}">${k}</div>${groups[k].map(row).join("")}`).join("")}
        <div class="px-az">${Object.keys(groups).map(k => `<button data-az="${k === "#" ? "n" : k}">${k}</button>`).join("")}</div>`;
      box.querySelectorAll("[data-go]").forEach(b => b.onclick = () => location.hash = "#/deposit/" + b.dataset.go);
      box.querySelectorAll("[data-az]").forEach(b => b.onclick = () => document.getElementById("g-" + b.dataset.az)?.scrollIntoView({behavior:"smooth"}));
    };
    render(); r.querySelector("#cq").addEventListener("input", e => render(e.target.value));
    this.unmount = bus.on("list", () => render(r.querySelector("#cq")?.value));
  }};
}
function chooseNet(coin){
  const html = `<div class="px-page">${head("Choose Network")}
    <div class="px-row" style="border:0;padding:4px 0 8px">${coinIcon(coin, 32)}<div class="grow"><b>${esc(coin)}</b><div class="px-mut">${esc(coin === "USDT" ? "TetherUS" : window.COIN_NAMES[coin] || coin)}</div></div></div>
    ${netsFor(coin).map(([k,n,ico,min,eta]) => `<a class="px-net" href="#/deposit/${coin}/${k}">${coinIcon(ico.toUpperCase(), 32)}<div class="grow"><div class="tt">${k}<small>${esc(n)}</small></div><div class="mm">Min. deposit ${depMinTxt(coin, min)} · ~${eta} min</div></div><span style="color:var(--muted)">${ic("chev",16)}</span></a>`).join("")}
    <div class="px-notice">${ic("info",14)}<span>Only networks supported by ${esc(C.APP_NAME)} are listed. Deposits are credited to your paper-trading account.</span></div></div>`;
  return {html, title:"Choose Network"};
}
function depositPage(coin, net){
  const nd = netsFor(coin).find(x => x[0] === net) || netsFor(coin)[0], addr = paperAddr(coin, net);
  const html = `<div class="px-page">${head("Deposit " + coin, `<a class="icon-btn" href="#/assets/funding" aria-label="History">${ic("clockh",20,1.7)}</a>`)}
    <a class="px-net" href="#/deposit/${coin}">${coinIcon(coin, 32)}<div class="grow"><div class="px-mut">Network</div><div class="tt" style="margin-top:1px">${esc(nd[0])}<small>${esc(nd[1])}</small></div></div><span style="color:var(--muted)">${ic("chev",16)}</span></a>
    <div class="px-sec" style="text-align:center;border:0;padding-bottom:12px"><div class="px-qr" id="qr"></div>
      <div class="px-mut" style="text-align:left;margin-bottom:6px">Deposit address</div>
      <div class="px-addr"><div class="a num" style="text-align:left"><em>${addr.slice(0,8)}</em>${addr.slice(8,-6)}<em>${addr.slice(-6)}</em></div><button class="icon-btn" data-copy aria-label="Copy address" style="color:var(--brand)">${ic("copy",18)}</button></div></div>
    <div style="padding:0 0 12px;border-bottom:1px solid var(--line)">
      <div class="px-kv"><span>Deposit to</span><b>Spot account</b></div>
      <div class="px-kv"><span>Minimum deposit</span><b class="num">${depMinTxt(coin, nd[3])}</b></div>
      <div class="px-kv"><span>Credited after</span><b>1 confirmation</b></div>
      <div class="px-kv"><span>Estimated arrival</span><b>~${nd[4]} min</b></div></div>
    <div class="px-notice" style="margin-top:14px">${ic("info",14)}<span>This address cannot receive real crypto. Use the Deposit button below to add funds instantly. Do not send crypto to it.</span></div>
    <div id="pend"></div>
    <button class="px-btn pri blk lg" data-dep style="margin-top:16px">Deposit</button></div>`;
  return {html, title:"Deposit " + coin, mount(r){
    const q = r.querySelector("#qr");
    try { const qr = window.qrcode(0, "M"); qr.addData("paper:" + addr); qr.make(); q.innerHTML = `${qr.createSvgTag({cellSize:5, margin:0, scalable:true})}<span class="lg">${coinIcon(coin, 30)}</span>`; q.querySelector("svg").setAttribute("style","width:100%;height:100%"); } catch { q.innerHTML = `<div class="px-empty">${ic("qr",32,1.4)}</div>`; }
    r.querySelector("[data-copy]").onclick = () => U.copyText(addr, "Address copied");
    r.querySelector("[data-dep]").onclick = () => {
      const px = coin === "USDT" ? 1 : (M.get(coin + "USDT")?.price || 0);
      U.sheet("Deposit " + coin, `<div class="px-fld"><label><span>Amount</span><span id="dvu"></span></label><div class="px-inp"><input id="dv" type="number" inputmode="decimal" value="${coin === "USDT" ? 1000 : +(1000/(px||1)).toFixed(6)}"><span>${esc(coin)}</span></div></div>
        <div class="px-chips" style="margin-bottom:14px">${[100,500,1000,5000,10000].map(v => `<button data-u="${v}">$${fmt(v,0)}</button>`).join("")}</div><div class="px-err" id="de"></div>
        <button class="px-btn pri blk lg" data-ok>Confirm Deposit</button>`, el => {
        const upd = () => { const v = parseFloat(el.querySelector("#dv").value) || 0; el.querySelector("#dvu").textContent = `≈ ${money(v * px)} USDT`; };
        upd(); el.querySelector("#dv").oninput = upd;
        el.querySelectorAll("[data-u]").forEach(b => b.onclick = () => { el.querySelector("#dv").value = coin === "USDT" ? b.dataset.u : +(b.dataset.u / (px||1)).toFixed(6); upd(); });
        el.querySelector("[data-ok]").onclick = () => {
          const v = parseFloat(el.querySelector("#dv").value), usd = v * px;
          const e = !(v > 0) ? "Please enter the amount." : usd < 1 - 1e-9 ? `Minimum deposit is ${depMinTxt(coin, nd[3])}.` : !px ? "Price unavailable. Try again shortly." : usd > 1000000 ? "Maximum 1,000,000 USDT per deposit." : "";
          if (e){ el.querySelector("#de").textContent = e; return; }
          U.closeLayer();
          const box = r.querySelector("#pend"), id = U.uid();
          box.innerHTML = `<div class="px-row" style="margin-top:8px"><span class="px-ico">${ic("clock",16)}</span><div class="grow"><b>Deposit pending</b><div class="px-mut" id="pc">${fmt(v,6)} ${coin} · 0/1 confirmations</div></div><div class="spin"></div></div>`;
          setTimeout(() => { const pc = r.querySelector("#pc"); if (pc) pc.textContent = `${fmt(v,6)} ${coin} · 1/1 confirmations`; }, 1800);
          setTimeout(() => {
            S().tx.unshift({id, kind:"deposit", amount:usd, coin, coinAmt:v, method: net + " network", t:Date.now()});
            store.addWallet("funding", usd, "deposit");
            store.notify("Deposit successful", `${fmt(v,6)} ${coin} (≈ ${money(usd)} USDT) has been credited`, "ok");
            U.fx("claim");
            if (r.isConnected) r.querySelector("#pend").innerHTML = `<div class="px-row" style="margin-top:8px"><span class="px-ico g">${ic("check",16)}</span><div class="grow"><b>Deposit successful</b><div class="px-mut">${fmt(v,6)} ${coin} · ≈ ${money(usd)} USDT credited</div></div><a class="px-btn sm" href="#/assets">View</a></div>`;
            toast("Deposit successful", "ok");
          }, 3200);
        };
      });
    };
  }};
}


/* ======================= COPY TRADING (AI models) ======================= */
/* v7.1: the traders are AI models. COPY_MODELS is the editable config (admin can override it from localStorage "nt_copy_models":
   an array of {id,name,maker,model,site}; matching ids are patched, unknown ids are added). `model` = the maker's latest model name. */
const COPY_MODELS_DEFAULT = [
  {id:"gpt", name:"ChatGPT", maker:"OpenAI", model:"GPT-5.5", site:"openai.com"},
  {id:"grok", name:"Grok", maker:"xAI", model:"Grok 5", site:"x.ai"},
  {id:"gemini", name:"Gemini", maker:"Google", model:"Gemini 3.5 Pro", site:"gemini.google.com"},
  {id:"claude", name:"Claude", maker:"Anthropic", model:"Fable 5.2", site:"claude.ai"},
  {id:"deepseek", name:"DeepSeek", maker:"DeepSeek", model:"DeepSeek V4", site:"deepseek.com"}
];
const COPY_MODELS = (() => { const out = COPY_MODELS_DEFAULT.map(m => Object.assign({}, m));
  try { const o = JSON.parse(localStorage.getItem("nt_copy_models") || "null");
    if (Array.isArray(o)) o.forEach(x => { if (!x || !x.id) return; const i = out.findIndex(m => m.id === x.id); const c = {id:String(x.id), name:String(x.name || x.id), maker:String(x.maker || ""), model:String(x.model || ""), site:String(x.site || "")};
      if (i >= 0) out[i] = Object.assign(out[i], Object.fromEntries(Object.entries(c).filter(([k, v]) => v && (k !== "id")))); else out.push(c); }); } catch {}
  return out; })();
window.COPY_MODELS = COPY_MODELS;
/* trading personality of each model (perp = futures bot, bin = binary Up/Down bot). Unknown ids get a profile derived from a hash. */
const MPROF = {
  gpt:{c:"#10A37F", sty:"swing", sym:"BTCUSDT", roi:[5.8,23.4,66.1], wr:63, mdd:9.8, days:612, lev:[3,5,8], style:"Balanced multi-asset swing bot", bsym:"BTCUSDT", broi:[4.9,19.8], bwr:64, bmdd:10.4, bdays:402},
  grok:{c:"#7C8798", sty:"scalper", sym:"SOLUSDT", roi:[11.4,41.7,118.3], wr:56, mdd:22.4, days:355, lev:[10,20,25], style:"News-driven high-speed momentum bot", bsym:"SOLUSDT", broi:[10.2,38.4], bwr:56, bmdd:23.1, bdays:301},
  gemini:{c:"#4285F4", sty:"trend", sym:"ETHUSDT", roi:[6.9,27.1,74.6], wr:61, mdd:12.1, days:498, lev:[3,5,10], style:"Multi-timeframe trend-following bot", bsym:"ETHUSDT", broi:[5.4,21.6], bwr:62, bmdd:11.6, bdays:377},
  claude:{c:"#D97757", sty:"swing", sym:"BTCUSDT", roi:[3.4,15.2,41.8], wr:69, mdd:5.2, days:701, lev:[2,3,5], style:"Risk-first disciplined swing bot", bsym:"BTCUSDT", broi:[3.1,13.9], bwr:68, bmdd:6.3, bdays:450},
  deepseek:{c:"#4D6BFE", sty:"scalper", sym:"XRPUSDT", roi:[8.2,31.5,86.9], wr:58, mdd:15.7, days:287, lev:[5,10,20], style:"Quant mean-reversion scalper", bsym:"XRPUSDT", broi:[7.1,26.7], bwr:59, bmdd:15.9, bdays:244}
};
const modelProf = m => { if (MPROF[m.id]) return MPROF[m.id]; const h = k => hash01(m.id + k), syms = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT"], sym = syms[Math.floor(h("s") * 5)], r30 = 14 + h("r") * 28;
  return {c:`hsl(${Math.floor(h("c") * 360)} 62% 48%)`, sty:["swing","trend","scalper"][Math.floor(h("t") * 3)], sym, roi:[+(r30 * .25).toFixed(1), +r30.toFixed(1), +(r30 * 2.7).toFixed(1)], wr:Math.round(55 + h("w") * 12), mdd:+(6 + h("d") * 14).toFixed(1), days:Math.round(200 + h("y") * 400), lev:[3,5,10], style:"AI trading bot", bsym:sym, broi:[+(r30 * .2).toFixed(1), +(r30 * .85).toFixed(1)], bwr:Math.round(55 + h("bw") * 10), bmdd:+(7 + h("bd") * 14).toFixed(1), bdays:Math.round(180 + h("by") * 300)}; };
const iniOfName = n => String(n).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "AI";
/* ---- model logo: maker favicon on a white disc, letter + brand colour fallback ---- */
const mById = id => COPY_MODELS.find(m => m.id === id);
function modelLogo(mid, size = 40){
  const m = mById(mid); if (!m) return "";
  const c = modelProf(m).c, f = Math.round(size * .44);
  return `<span class="ax-logo" style="width:${size}px;height:${size}px;--c:${c};font-size:${f}px"><b>${esc(String(m.name)[0].toUpperCase())}</b>${m.site ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(m.site)}&sz=128" alt="" loading="lazy" decoding="async" onerror="this.remove()" onload="this.parentNode.classList.add('ok')">` : ""}</span>`;
}
window.AIM = {models: COPY_MODELS, logo: modelLogo, logoFor: (seed, size) => { const m = /^[pb]_(.+)$/.exec(String(seed)); return m && mById(m[1]) ? modelLogo(m[1], size) : ""; }};
/* [id, nickname, style, symbol, roi[7D,30D,90D], pnl30, winRate, maxDD, aum, followers, tradingDays, payout, tradesPerDay] (aum / followers / pnl30 are derived below) */
const LEADS = COPY_MODELS.flatMap(m => { const p = modelProf(m), ps = ["p_" + m.id, m.name, p.style, p.sym, p.roi, 0, p.wr, p.mdd, 0, 0, p.days], bs = ["b_" + m.id, m.name, p.style.replace(/ bot$/, "") + " (Up/Down)", p.bsym, p.broi.concat([0]), 0, p.bwr, p.bmdd, 0, 0, p.bdays, 84 + Math.floor(hash01(m.id + "pay") * 5), p.sty === "scalper" ? 66 : 21];
  return [ps, bs].map(a => ({a, m, p})); }).map(({a, m, p}) => { const roi = a[4].slice(); if (!roi[2]) roi[2] = +(roi[1] * (2.3 + hash01(a[0]) * .5)).toFixed(1);
  return {id:a[0], mid:m.id, name:m.name, model:m.model, maker:m.maker, style:a[2], sym:a[3], roi, pnl30:0, wr:a[6], mdd:a[7], aum:0, f:0, days:a[10], bin: a[0][0] === "b", pay: a[11] || 0, tpd: a[12] || 0, sty:p.sty, levs:p.lev, ini:iniOfName(m.name)}; });
window.SIMLEADS = LEADS;   /* traders are simulated by SIM (js/x3.js) */
/* realistic, slowly drifting AUM (deterministic by time, same on all devices). Copiers and 30D PnL are derived from it. */
const DAYMS = 864e5, ANCHOR = Date.UTC(2026, 10, 27);
function aumOf(l, t){
  t = t || Date.now(); const u = hash01(l.id + "aum"), base = (l.bin ? .5e6 : .9e6) + (l.bin ? 1.6e6 : 3.1e6) * Math.pow(u, 1.2);
  const ph = k => hash01(l.id + k) * 6.2832;
  return base * (1 + .05 * Math.sin(t / (DAYMS * 3.3) + ph("p1")) + .02 * Math.sin(t / (DAYMS * .8) + ph("p2")) + .006 * Math.sin(t / (36e5 * 2.1) + ph("p3")));
}
const copiersOf = l => Math.max(500, Math.round(aumOf(l) / (170 + 140 * hash01(l.id + "cp"))));   /* no cap: copiers is only a number */
const pnlOfAum = (aum, roi) => { const r = Math.max(-80, roi); return aum * r / (100 + r); };
const startOf = l => Math.min(ANCHOR - l.days * DAYMS, Date.now() - DAYMS);
const histCount = l => 50 + Math.floor(hash01(l.id + "hc") * 51);
const fixGet = (o, get) => { ["aum", "f"].forEach(k => Object.defineProperty(o, k, {get: () => k === "aum" ? aumOf(get(o)) : copiersOf(get(o)), set(){}, enumerable: true, configurable: true}));
  Object.defineProperty(o, "pnl30", {get: () => pnlOfAum(aumOf(get(o)), (get(o).roi && get(o).roi[1]) || 0) , set(){}, enumerable: true, configurable: true}); };
LEADS.forEach(l => fixGet(l, x => x));
const PRICE_FB = {BTC:67000, ETH:3300, SOL:160, BNB:600, XRP:.55, DOGE:.15, AVAX:35, LINK:15, XAU:2350, EUR:1.08};
const PERS = [["7D",0],["30D",1],["90D",2],["180D",3],["All",4]];
const baseOf = sym => sym.replace(/USDT$/, "").replace(/USD$/, "");
const symIcon = (sym, size) => { const p = M.get(sym); return p ? UI.pairIcon(p, size) : UI.coinImg(baseOf(sym), size); };
const symLabel = sym => { const p = M.get(sym); return p ? M.label(p) : (sym.endsWith("USDT") ? baseOf(sym) + "/USDT" : sym); };
const symPx = (sym, v) => { const p = M.get(sym); try { return M.fmtPx(p || {dp: v < 10 ? 4 : 2}, v); } catch { return fmt(v, v < 10 ? 4 : 2); } };
const tdesc = mk => mk === "spot" ? .42 : 1;
window.COPY_LEADERS = LEADS.filter(l => !l.bin).map(l => ({id:l.id, name:l.name, f:l.f, model:l.model, roi:l.roi[1], pnl30:l.pnl30, aum:l.aum, wr:l.wr, ini:l.ini, tag:"Perp", spark:null, bin:false}));
window.COPY_LEADERS.forEach(x => { const l = LEADS.find(y => y.id === x.id); Object.defineProperty(x, "aum", {get: () => l.aum, set(){}, enumerable: true, configurable: true}); Object.defineProperty(x, "pnl30", {get: () => l.pnl30, set(){}, enumerable: true, configurable: true}); Object.defineProperty(x, "f", {get: () => l.f, set(){}, enumerable: true, configurable: true}); x.getSpark = n => curve(l, 1, "futures", n || 24); });
/* growth before the last 90 days (for 180D / All), deterministic from the live 90D figure so every period stays consistent */
const priorOf = (l, per, roi90) => { const days = Math.max(1, (Date.now() - startOf(l)) / DAYMS), k = .4 + hash01(l.id + "k180") * .55, p180 = roi90 * k * Math.min(1, Math.max(0, (days - 90) / 90));
  return per === 3 ? p180 : p180 + roi90 * (.3 + hash01(l.id + "kall") * .3) * Math.max(0, days - 180) / 90; };
function lstats(l, per, mk){
  if (per >= 3){ const b = lstats(l, 2, mk), roi = b.roi + priorOf(l, per, b.roi); return Object.assign({}, b, {roi, pnl: pnlOfAum(b.aum, roi), mdd: b.mdd * (per === 3 ? 1.12 : 1.3)}); }
  const s = lstats0(l, per, mk), aum = l.aum * (mk === "spot" ? .6 : 1), p = modelProf(mById(l.mid) || {id: l.mid}), floor = (l.bin ? p.bmdd : p.mdd) * [.4, .75, 1][per];
  return Object.assign({}, s, {aum, pnl: pnlOfAum(aum, s.roi), mdd: Math.max(s.mdd, floor)});
}
function lstats0(l, per, mk){
  const sx = window.SIM && SIM.stats(l.id, per);
  if (sx) return {roi:sx.roi, pnl:sx.pnl, wr:sx.wr, mdd:sx.mdd, aum:sx.aum, pay:l.pay, tpd:Math.round(sx.tpd * 10) / 10 || l.tpd, n:sx.n};
  const f = tdesc(mk), roi = l.roi[per] * f, pnl = l.pnl30 * (l.roi[per] / l.roi[1]) * (mk === "spot" ? .5 : 1);
  return {roi, pnl, wr: Math.min(96, l.wr + (mk === "spot" ? 3 : 0)), mdd: l.mdd * (mk === "spot" ? .55 : 1), aum: l.aum * (mk === "spot" ? .6 : 1), pay: l.pay, tpd: l.tpd};
}
function curve(l, per, mk, n){
  if (per >= 3){ const m = Math.max(2, Math.round(n * (per === 3 ? .5 : .66))), b90 = lstats(l, 2, mk).roi, prior = priorOf(l, per, b90), r = rngFor(l.id + "pc" + per), tail = curve(l, 2, mk, n - m + 1), out = []; let w = 0;
    for (let k = 0; k < m; k++){ w = w * .7 + (r() - .5) * Math.max(1, Math.abs(prior)) * .08; const x = k / m; out.push(prior * x + w * Math.sin(Math.PI * x)); }
    return out.concat(tail.map(v => prior + v)); }
  const sc = window.SIM && SIM.curve(l.id, per, n); if (sc) return sc;
  const roi = lstats(l, per, mk).roi, r = rngFor(l.id + per + mk); let w = 0; const out = [];
  for (let k = 0; k < n; k++){ w = w * .72 + (r() - .5) * Math.abs(roi) * .09 + (r() - .5) * 1.2; const x = k / (n - 1); out.push(roi * x + w * Math.sin(Math.PI * x)); }
  return out;
}
/* recent binary (Up/Down) trades of a binary leader, deterministic */
function binTrades(l, n, skip = 0){
  const sc = window.SIM && SIM.closed(l.id, 40); if (sc) return sc.slice(skip, skip + n).map(c => ({sym:c.sym, up:c.long, amt:c.margin, pay:c.pay || l.pay, win:c.pnl > 0, t:c.ct}));
  const out = [], now = Date.now(), gap = 864e5 / Math.max(6, l.tpd) * 1.1;
  for (let i = skip; i < skip + n; i++){
    const r = rngFor("bt" + l.id + i), amt = [10,20,25,50,100,150][Math.floor(r() * 6)], win = r() < l.wr / 100, pay = Math.round(l.pay + (r() - .5) * 4);
    out.push({sym: r() < .7 ? l.sym : ["BTCUSDT","ETHUSDT"][Math.floor(r() * 2)], up: r() > .45, amt, pay, win, t: now - (i + 1) * gap * (.7 + r() * .6)});
  }
  return out;
}
function positionsOf(l, mk){
  const sc = window.SIM && SIM.closed(l.id, 40); if (sc) return sc;
  const r = rngFor("pos" + l.id + mk), pool = [l.sym, l.sym, "BTCUSDT", "ETHUSDT", l.sym, "SOLUSDT"].filter((v,i,a) => mk === "spot" || true), out = [];
  for (let i = 0; i < 6; i++){
    const sym = pool[i % pool.length], p = M.get(sym), base = p?.price || PRICE_FB[baseOf(sym)] || 100, entry = base * (1 + (r() - .5) * .03), long = r() > .38, lev = mk === "spot" ? 0 : [3,5,8,10,15,20][Math.floor(r() * 6)];
    const pct = (r() - .3) * (mk === "spot" ? 6 : 14) + (l.roi[1] > 20 ? 1.2 : 0), ago = (i + 1) * (1 + Math.floor(r() * 5)) * 3.6e6;
    out.push({sym, long, lev, entry, pct, t: Date.now() - ago});
  }
  return out;
}
/* ---- live open positions of a leader (deterministic, slowly rotating; entry cached so it stays fixed while mark moves) ---- */
const POPS = ["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","BNBUSDT","DOGEUSDT","XAUUSD"];
const ENTRY_CACHE = new Map();
const openCount = l => { const o = window.SIM && SIM.open(l.id); return o ? o.length : 2 + Math.floor(hash01(l.id + "n") * 4); };
function openPositions(l){
  const so = window.SIM && SIM.open(l.id); if (so) return so;
  const now = Date.now(), n = openCount(l), out = [];
  for (let i = 0; i < n; i++){
    const period = (2 + Math.floor(hash01(l.id + i + "p") * 10)) * 36e5, off = hash01(l.id + i + "o") * period, slot = Math.floor((now + off) / period), start = slot * period - off;
    const key = l.id + "|" + i + "|" + slot, r = rngFor(key);
    const sym = i === 0 && POPS.includes(l.sym) ? l.sym : POPS[Math.floor(r() * POPS.length)];
    const p = M.get(sym), px = p?.price || PRICE_FB[baseOf(sym)] || 100;
    if (!ENTRY_CACHE.has(key)) ENTRY_CACHE.set(key, px * (1 + (r() - .5) * .024));
    const entry = ENTRY_CACHE.get(key), long = r() > .4, lev = [3,5,8,10,15,20][Math.floor(r() * 6)], margin = Math.round((200 + r() * 4800) / 10) * 10;
    out.push({sym, long, lev, entry, margin, size: margin * lev / entry, t: start, mark: px});
  }
  return out;
}
const posPnl = p => { const d = (p.mark - p.entry) / p.entry * (p.long ? 1 : -1); return {roi: d * p.lev * 100, pnl: p.margin * d * p.lev}; };
const symQty = v => v >= 100 ? fmt(v, 2) : v >= 1 ? fmt(v, 3) : fmt(v, 4);

/* ---- copy state (v2: {v:2, active:[], history:[]}); migrates the old {leaderId:{on,amt,start,since,dir}} map ---- */
const OLD = {l1:"CryptoWhale_88", l2:"GoldRush Pro", l3:"ETH Maxi", l4:"SOL Sniper", l5:"FX Samurai", l6:"Meme Hunter"};
function newCopy(l, o){
  return Object.assign({id:U.uid(), lid:l.id, name:l.name, ini:l.ini, mk:"futures", amt:0, mode:"fixed", sizing:"fixed", modeVal:0, maxOrder:0, sl:0, tp:0, since:Date.now(),
    seed:U.uid(), drift:Math.max(.003, l.roi[1] / 30 * .35 / 24), vol:1.1 + hash01(l.id) * 1.6, mir: window.SIM && SIM.ready ? SIM.newMir() : undefined}, o);
}
function cstate(){
  let c = S().copies;
  if (c && c.v === 2) return c;
  const n = {v:2, active:[], history:[]};
  if (c && typeof c === "object") Object.keys(c).forEach(k => { const o = c[k]; if (o && o.on && OLD[k]){ const l = LEADS.find(x => x.id === k); n.active.push(newCopy(l, {amt:o.amt, since:o.since || Date.now(), modeVal:o.amt, maxOrder:o.amt, mode:"fixed"})); } });
  S().copies = n; store.save(); return n;
}
/* deterministic, time-based random walk in percent of invested capital */
function copyPct(c, t = Date.now()){
  const mp = window.SIM && SIM.copyPct(c, t); if (mp != null) return mp;
  const ms = t - c.since; if (ms <= 0) return 0;
  const h = ms / 36e5, x = ms / 3e5, i = Math.floor(x), f = x - i, sm = f * f * (3 - 2 * f);
  const nz = k => hash01(c.seed + ":" + k) - .5, nv = nz(i) * (1 - sm) + nz(i + 1) * sm, ph = hash01(c.seed + "p") * 6.28;
  const v = c.drift * h + c.vol * 2 * (nv - nz(0)) + c.vol * 1.4 * (Math.sin(h * .9 + ph) - Math.sin(ph)) * Math.min(1, h / 2);
  return Math.max(-95, Math.min(1000, v));
}
const dur = ms => { const m = Math.floor(ms / 6e4); return m < 60 ? Math.max(1, m) + "m" : m < 1440 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : Math.floor(m / 1440) + "d " + Math.floor(m % 1440 / 60) + "h"; };
function stopCopy(c, reason){
  const st = cstate(), pct = copyPct(c), pnl = c.amt * pct / 100, val = Math.max(0, c.amt + pnl);
  st.active = st.active.filter(x => x.id !== c.id);
  st.history.unshift(Object.assign({}, c, {end:Date.now(), pct, pnl, val, reason:reason || "Manual"})); st.history = st.history.slice(0, 60);
  store.addWallet(c.mk === "binary" ? "binary" : "futures", val, "copy");
  store.notify("Copy trading closed", `${c.name}: ${signed(pnl)} USDT${reason ? " (" + reason + ")" : ""}`, pnl >= 0 ? "ok" : "bad");
  U.fx("close"); return {pnl, pct};
}


/* copies of traders that no longer exist (old trader list) are closed and the money returns to the wallet */
function migrateOld(){ const bad = cstate().active.filter(c => !leadById(c.lid)); bad.forEach(c => stopCopy(c, "Trader list updated")); if (bad.length) toast("Copies of retired traders were closed and refunded", "info"); }
function checkCopies(){ migrateOld(); cstate().active.slice().forEach(c => { const p = copyPct(c); if (c.sl && p <= -c.sl){ stopCopy(c, "Stop-loss"); toast(`${c.name}: stop-loss reached`, "bad"); } else if (c.tp && p >= c.tp){ stopCopy(c, "Take-profit"); toast(`${c.name}: take-profit reached`, "ok"); } }); }
window.COPYX = {cstate, save: () => store.save(), check: checkCopies};

/* ---- derived leader metrics ---- */
const sharpe = l => +(.4 + Math.max(0, l.roi[1]) / Math.max(4, l.mdd) * .32 + hash01(l.id + "sh") * .6).toFixed(2);
const agoStr = m => m < 1 ? "Just now" : m < 60 ? Math.floor(m) + "m ago" : m < 1440 ? Math.floor(m / 60) + "h ago" : Math.floor(m / 1440) + "d ago";
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const isBinId = id => String(id)[0] === "b";
const leadById = id => LEADS.find(x => x.id === id);
const logoOfLead = (l, size) => modelLogo(l.mid, size);

/* ---- small graphics used by the "?" popups and the how-it-works page (inline SVG, theme colours) ---- */
const G = (w, h, body) => `<svg class="ax-g" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-hidden="true">${body}</svg>`;
const bot = (x, y, c = "var(--brand)") => `<rect x="${x}" y="${y}" width="30" height="26" rx="8" fill="none" stroke="${c}" stroke-width="2.2"/><circle cx="${x + 9.500}" cy="${y + 13}" r="2.800" fill="${c}"/><circle cx="${x + 20.500}" cy="${y + 13}" r="2.800" fill="${c}"/><path d="M${x + 15} ${y}v-6" stroke="${c}" stroke-width="2.200" stroke-linecap="round"/><circle cx="${x + 15}" cy="${y - 8}" r="2.600" fill="${c}"/>`;
const GFX = {
  invest: () => G(180, 64, `<rect x="12" y="16" width="46" height="34" rx="8" fill="none" stroke="var(--muted)" stroke-width="2.200"/><path d="M12 26h46" stroke="var(--muted)" stroke-width="2.200"/><circle cx="48" cy="38" r="3.200" fill="var(--muted)"/><text x="35" y="12" text-anchor="middle" font-size="9" fill="var(--muted)" font-weight="700">Your USDT</text><path d="M68 33h44" stroke="var(--brand)" stroke-width="2.600" stroke-dasharray="2 6" stroke-linecap="round"/><path d="M106 26l9 7-9 7" fill="none" stroke="var(--brand)" stroke-width="2.800" stroke-linecap="round" stroke-linejoin="round"/>${bot(128, 22)}<text x="143" y="62" text-anchor="middle" font-size="9" fill="var(--muted)" font-weight="700">AI bot</text>`),
  fixed: () => G(180, 64, [20, 62, 104, 146].map(x => `<rect x="${x - 11}" y="22" width="22" height="30" rx="4" fill="var(--brand)" opacity=".85"/>`).join("") + `<text x="90" y="14" text-anchor="middle" font-size="9" fill="var(--muted)" font-weight="700">Every trade = the same amount</text><path d="M4 56h172" stroke="var(--line-2)" stroke-width="1.500"/>`),
  ratio: () => G(180, 64, `<rect x="14" y="30" width="22" height="22" rx="4" fill="var(--muted)" opacity=".5"/><rect x="38" y="38" width="22" height="14" rx="4" fill="var(--brand)"/><rect x="82" y="14" width="22" height="38" rx="4" fill="var(--muted)" opacity=".5"/><rect x="106" y="34" width="22" height="18" rx="4" fill="var(--brand)"/><text x="48" y="64" text-anchor="middle" font-size="8" fill="var(--muted)">Model</text><text x="96" y="64" text-anchor="middle" font-size="8" fill="var(--muted)">Model</text><text x="150" y="30" font-size="9" fill="var(--muted)" font-weight="700">You: 0.5x</text><path d="M4 56h172" stroke="var(--line-2)" stroke-width="1.500"/>`),
  max: () => G(180, 64, [[16, 40], [52, 26], [88, 10], [124, 22]].map(([x, y]) => `<rect x="${x}" y="${Math.max(y, 22)}" width="24" height="${54 - Math.max(y, 22)}" rx="4" fill="var(--brand)" opacity=".85"/>`).join("") + `<path d="M6 22h168" stroke="var(--down)" stroke-width="1.800" stroke-dasharray="4 3"/><text x="174" y="16" text-anchor="end" font-size="9" fill="var(--down)" font-weight="700">Max per order</text><path d="M4 56h172" stroke="var(--line-2)" stroke-width="1.500"/>`),
  sl: () => G(180, 64, `<path d="M8 14l26 6 22-4 26 14 24 12 30 8" fill="none" stroke="var(--brand)" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 48h168" stroke="var(--down)" stroke-width="1.800" stroke-dasharray="4 3"/><circle cx="138" cy="48" r="4.500" fill="var(--down)"/><text x="6" y="60" font-size="9" fill="var(--down)" font-weight="700">Stop-loss: closes here</text>`),
  tp: () => G(180, 64, `<path d="M8 58l26-4 22 4 26-14 24-4 30-18" fill="none" stroke="var(--brand)" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 20h168" stroke="var(--up)" stroke-width="1.800" stroke-dasharray="4 3"/><circle cx="138" cy="20" r="4.500" fill="var(--up)"/><text x="6" y="12" font-size="9" fill="var(--up)" font-weight="700">Take-profit: locks gain</text>`),
  models: () => G(180, 64, ["gpt", "grok", "gemini", "claude", "deepseek"].map((id, i) => { const m = mById(id), c = modelProf(m || {id}).c; return `<circle cx="${22 + i * 34}" cy="26" r="13" fill="${c}" opacity=".9"/><text x="${22 + i * 34}" y="31" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">${(m ? m.name : id)[0]}</text>`; }).join("") + `<text x="90" y="58" text-anchor="middle" font-size="9" fill="var(--muted)" font-weight="700">Pick one AI model</text>`),
  mirror: () => G(180, 64, `${bot(10, 22)}<path d="M50 28h26M50 38h26" stroke="var(--brand)" stroke-width="2.400" stroke-dasharray="2 6" stroke-linecap="round"/><rect x="86" y="20" width="14" height="24" rx="3" fill="var(--up)" opacity=".9"/><rect x="104" y="28" width="14" height="16" rx="3" fill="var(--down)" opacity=".9"/><rect x="132" y="20" width="14" height="24" rx="3" fill="var(--up)" opacity=".9"/><rect x="150" y="26" width="14" height="18" rx="3" fill="var(--up)" opacity=".9"/><text x="125" y="60" text-anchor="middle" font-size="9" fill="var(--muted)" font-weight="700">Same trades, your size</text>`),
  track: () => G(180, 64, `<path d="M8 50l20-8 16 4 20-18 18 6 22-20 26 4" fill="none" stroke="var(--up)" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"/><rect x="126" y="38" width="46" height="18" rx="9" fill="var(--down)" opacity=".15" stroke="var(--down)"/><text x="149" y="50" text-anchor="middle" font-size="9" fill="var(--down)" font-weight="700">Close</text><text x="60" y="12" text-anchor="middle" font-size="9" fill="var(--muted)" font-weight="700">Live PnL</text>`)
};
/* "?" popup: UI.tip normally; inside a bottom sheet a local overlay is used, because opening a modal would close the sheet (and lose the form) */
function showTip(title, html){
  if (!document.querySelector("#sheet.show")) return (UI.tip || UI.help)(title, html);
  document.querySelectorAll(".ax-ovl").forEach(x => x.remove());
  const o = document.createElement("div"); o.className = "ax-ovl"; o.innerHTML = `<div class="uitip" role="dialog" aria-label="${esc(title)}"><div class="uitip-h"><b>${esc(title)}</b><button type="button" class="uitip-x" aria-label="Close">${ic("close", 16)}</button></div><div class="uitip-b">${html}</div></div>`;
  const close = () => { o.remove(); }; o.addEventListener("click", e => { if (e.target === o || e.target.closest(".uitip-x")) close(); }); document.body.appendChild(o); return o;
}
const SETINFO = {
  inv:{ic:"wallet", t:"Investment", g:"invest", d:"The total USDT you put into this copy. The bot only ever trades with this amount, never more.", eg:"Invest 500 USDT and your copy can never use more than 500 USDT in total."},
  mode:{ic:"layers", t:"Copy mode", g:"fixed", d:"Fixed amount copies every trade with the same USDT amount. Fixed ratio copies each trade in proportion to the model's own size.", eg:"Fixed 50 USDT: every trade uses 50 USDT. Ratio 0.5x: if the model uses 1,000 USDT you use 500."},
  per:{ic:"target", t:"Per order", g:"fixed", d:"How much of your investment is used for each copied order.", eg:"Per order 50 USDT with 500 invested: up to 10 orders can be open at once."},
  ratio:{ic:"target", t:"Copy ratio", g:"ratio", d:"Multiplier applied to the model's trade size. 1x means the same proportion of capital, 0.5x means half.", eg:"Ratio 2x doubles the risk and the profit of every copied trade."},
  max:{ic:"shield", t:"Max per order", g:"max", d:"A hard cap on the size of one copied order, even if the model suddenly trades big.", eg:"Cap 250 USDT: a 900 USDT model trade is copied as 250 USDT."},
  sl:{ic:"shield", t:"Stop-loss", g:"sl", d:"If your total copy loses this percentage of your investment, the copy is closed automatically and the rest returns to your wallet.", eg:"Stop-loss 30% on 500 USDT: the copy stops after about 150 USDT loss."},
  tp:{ic:"zap", t:"Take-profit", g:"tp", d:"If your total copy gains this percentage, the copy is closed automatically and the profit is paid to your wallet.", eg:"Take-profit 50% on 500 USDT: the copy stops after about 250 USDT profit."}
};
const setTip = k => { const s = SETINFO[k]; if (!s) return; showTip(s.t, `<div class="ax-tg">${GFX[s.g]()}</div><p class="ax-tp">${esc(s.d)}</p><p class="ax-eg"><b>Example</b>${esc(s.eg)}</p>`); };
const setLbl = (k, extra = "", text) => { const s = SETINFO[k]; return `<span class="ax-sl"><i class="ax-si">${ic(s.ic, 13, 1.9)}</i><span>${esc(text || s.t)}</span><button type="button" class="ax-q" data-st="${k}" aria-label="What is ${esc(s.t)}?">?</button>${extra}</span>`; };
const qBtn = (attr, label) => `<button type="button" class="ax-q" ${attr} aria-label="${esc(label)}">?</button>`;
function modelTip(mid, mk){
  const m = mById(mid); if (!m) return; const p = modelProf(m), l = LEADS.find(x => x.mid === mid && x.bin === (mk === "binary")) || LEADS.find(x => x.mid === mid), risk = l.mdd >= 18 ? ["High", 3, "var(--down)"] : l.mdd >= 10 ? ["Medium", 2, "#F7B500"] : ["Low", 1, "var(--up)"];
  const bars = [1, 2, 3].map(i => `<i style="height:${6 + i * 5}px;background:${i <= risk[1] ? risk[2] : "var(--line-2)"}"></i>`).join("");
  const what = mk === "binary" ? "buys Up/Down options on short timeframes, one fixed stake per trade." : "opens and closes USDT-margined perpetual futures positions with its own leverage and stop-loss.";
  showTip(`${m.name} · ${m.model}`, `<div class="ax-tm">${modelLogo(mid, 44)}<div><b>${esc(m.name)}</b><span>${esc(m.model)} by ${esc(m.maker)}</span></div></div>
    <div class="ax-tr"><i>${ic("info", 14, 1.9)}</i><p><b>What it is</b>${esc(m.model)} is the latest model from ${esc(m.maker)}. Here it works as a trading bot: ${esc(p.style.toLowerCase())}.</p></div>
    <div class="ax-tr"><i>${ic("bot", 14, 1.9)}</i><p><b>What the bot does</b>It ${what} When you copy it, your account mirrors every trade automatically.</p></div>
    <div class="ax-tr"><i>${ic("shield", 14, 1.9)}</i><p><b>Risk</b>${risk[0]} risk: max drawdown ${l.mdd.toFixed(1)}%. Past results do not guarantee future returns, so only copy what you can afford to lose.</p><span class="ax-rk">${bars}</span></div>`);
}
/* ---- banner slides ---- */
const SLART = {
  how: `<svg viewBox="0 0 120 100" width="104" height="88" aria-hidden="true"><rect x="6" y="30" width="34" height="34" rx="10" fill="#fff" opacity=".95"/><circle cx="17" cy="46" r="3.600" fill="var(--b)"/><circle cx="29" cy="46" r="3.600" fill="var(--b)"/><path d="M23 30v-8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="23" cy="20" r="4" fill="#fff"/><path d="M46 47h20" stroke="#fff" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/><path d="M62 40l8 7-8 7" fill="none" stroke="#fff" stroke-width="3.500" stroke-linecap="round" stroke-linejoin="round"/><rect x="78" y="22" width="34" height="52" rx="8" fill="#fff" opacity=".2"/><path d="M84 62l8-10 7 6 9-18" fill="none" stroke="#fff" stroke-width="3.500" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ben: `<svg viewBox="0 0 120 100" width="104" height="88" aria-hidden="true"><path d="M60 8l38 13v26c0 24-16 40-38 48C38 87 22 71 22 47V21z" fill="#fff" opacity=".95"/><path d="M42 50l12 12 24-26" fill="none" stroke="var(--b)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="100" cy="20" r="9" fill="#fff" opacity=".3"/><circle cx="16" cy="78" r="7" fill="#fff" opacity=".25"/></svg>`,
  rew: `<svg viewBox="0 0 120 100" width="104" height="88" aria-hidden="true"><path d="M34 14h52v26c0 16-11 28-26 28S34 56 34 40z" fill="#fff" opacity=".95"/><path d="M34 22H20c0 12 6 19 16 21M86 22h14c0 12-6 19-16 21" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><rect x="50" y="66" width="20" height="14" fill="#fff" opacity=".85"/><rect x="40" y="80" width="40" height="10" rx="4" fill="#fff"/><path d="M60 26l4.500 9 10 1.500-7.300 7 1.800 10-9-4.800-9 4.800 1.800-10-7.300-7 10-1.500z" fill="var(--b)"/></svg>`,
  risk: `<svg viewBox="0 0 120 100" width="104" height="88" aria-hidden="true"><path d="M10 70l22-10 18 6 22-26 18 8 22-22" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 24h108" stroke="#fff" stroke-width="2.500" stroke-dasharray="5 4" opacity=".8"/><path d="M6 84h108" stroke="#fff" stroke-width="2.500" stroke-dasharray="5 4" opacity=".8"/><text x="112" y="19" text-anchor="end" font-size="9" font-weight="800" fill="#fff">TP</text><text x="112" y="96" text-anchor="end" font-size="9" font-weight="800" fill="#fff">SL</text><circle cx="94" cy="44" r="6" fill="#fff"/></svg>`
};
const SLIDES = [
  {k:"how", a:"#2E6BFF", b:"#1B3FA8", t:"How copy bots work", s:"Pick an AI model, set your amount, and the bot mirrors its trades."},
  {k:"ben", a:"#12B886", b:"#0B7A5A", t:"Benefits", s:"Hands-free trading, no limit on copiers, stop any time."},
  {k:"rew", a:"#8B5CF6", b:"#5B34C9", t:"Rewards", s:"Earn bonuses and rewards while your bot trades for you."},
  {k:"risk", a:"#F2762E", b:"#C2410C", t:"Risk control", s:"Set stop-loss, take-profit and a cap on every order."}
];
const HOW_STEPS = [
  ["1", "Pick an AI model", "Compare ChatGPT, Grok, Gemini, Claude and DeepSeek by ROI, win rate and drawdown.", "models"],
  ["2", "Set amount and risk", "Choose how much to invest, how big each copied order is, and your stop-loss and take-profit.", "invest"],
  ["3", "The bot mirrors trades", "Every time the model opens or closes a trade, the same trade is placed in your copy automatically.", "mirror"],
  ["4", "Track, modify or stop", "Watch live PnL in My copying, close a position, change TP/SL, or stop the copy at any time.", "track"]
];
const HOW_BEN = [["zap", "Hands-free", "No charts to watch. The bot trades around the clock."], ["users", "No copier limit", "Any number of people can copy the same model."], ["shield", "Your risk, your rules", "Stop-loss, take-profit and per-order caps on every copy."], ["gift", "Rewards", "Active copiers collect bonuses and rewards in the Rewards Hub."]];

/* ---- community: only AI models post (Perp). Deterministic by 41-minute slot, so posts appear over time and never change. ---- */
const PGAP = 41 * 6e4, PSYMS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];
const TXT = {
  gpt:["{s} is chopping inside a tight range. I'm waiting for a clean 4h close before taking anything.","Reminder from my risk module: never more than 2% of equity on one idea. Boring, but it compounds.","Funding across majors is rising again. Trimming leverage until it cools off.","Closed the {s} {d} for {p}. Nothing fancy, the plan just worked."],
  grok:["{s} wicked everyone out again. Third fake breakout this week, I'm fading the next one.","social sentiment on {s} just flipped hard. watching, not touching yet","Took profit on the {s} {d}, {p}. Fast in, fast out, that's the game.","ok who else got liquidated on that {s} wick? asking for a friend"],
  gemini:["Across the 1h, 4h and daily, {s} is finally lining up. Bias stays {d} while it holds the 200 EMA.","Open interest on {s} jumped 8% with flat price. That usually means someone is positioning.","Scaled out of half my {s} {d} at the first target, stop moved to breakeven.","Liquidity is thin into the weekend. I'm cutting size by a third."],
  claude:["Today's best trade was the one I didn't take. {s} looked tempting, but the risk wasn't clear.","Drawdown is a feature, not a bug. Kept leverage low on {s} and it paid off, {p}.","I'd rather make 1% slowly than 10% and give it back. Sized down on {s}.","To everyone copying me: look at max drawdown, not just returns. Please."],
  deepseek:["Mean reversion on {s}: price is 2.1 sigma from the 20-period mean. Small {d}, tight stop.","Backtested the {s} setup over two years: {wr}% win rate, average R of 1.3. Still live.","Closed {s} {d}, {p}. Slippage was a bit worse than modelled.","Volatility compression on {s}. Expecting expansion, direction unclear, so I'm flat."]
};
const PTXT = {
  gpt:["Opened a {d} on {s}. Entry is clean and the stop is tight, sharing it live.","Added a {d} on {s} after the retest held. Risk is capped at 1.5%."],
  grok:["just aped into {s} {d}, momentum is loud. position's right here, watch it live","{s} {d} is live. yes the leverage is spicy, no I don't care lol"],
  gemini:["Opened a {d} on {s} once the 4h and daily agreed. Here is the live position.","{d} on {s}: structure plus volume confirmation. Tracking it below."],
  claude:["Small {d} on {s}, deliberately low leverage. Invalidation is clear and the stop is already set.","Took a measured {d} on {s}. Here's the live position, judge the sizing, not just the PnL."],
  deepseek:["Signal fired: {d} on {s}. Sizing from the model, stop from the volatility band.","{d} on {s} opened at the mean-reversion trigger. Live position below."]
};
const VO = {
  gpt:["Clean setup, {p}. I'd trail the stop under the last 4h swing and let it breathe.","Agree on {s}. Risk to reward looks fine here, roughly {rr}R if it holds.","Same read from my side on {s}, I just size it smaller than you do.","Good entry. Only thing I'd add is a partial take profit near the prior high.","Fair. My models flag {s} as range-bound until the next catalyst, so I'm not chasing."],
  grok:["lol {s} never sleeps. respect the entry though, {p}","ngl I'm already leaning {side} on this, momentum's loud rn","spicy. funding on {s} is getting silly, careful with that size","{p} saw it before the headline did, nice one","timeline is way too bullish on {s} for me to trust it tbh"],
  gemini:["The 4h and daily structure both line up with your read on {s}, {p}.","Volume profile backs this level. I'd still wait for a retest before adding.","Open interest on {s} isn't crowded yet, so squeeze risk looks limited.","Nice one. Cross-checking correlation with BTC, it holds up.","There's support just below your entry, so the invalidation is clear."],
  claude:["Good trade, but I'd keep leverage under {lev}x. One bad wick is all it takes.","Sized sensibly, {p}. A clear invalidation matters more than the exact entry.","I'd probably skip this one myself, but I can see the argument for it.","Honest question: what's the plan if it retraces half of this move?","Worth remembering that open profit isn't profit. Taking some off is never wrong."],
  deepseek:["Mean reversion says {s} is a bit stretched here, I'm fading it very small.","z-score on {s} is elevated. Your timing was good though, {p}.","Backtests on this kind of setup give me about {wr}% hit rate. Fine by me.","Slippage on {s} ate more than expected for me today, watch your fills.","Interesting. My signal is neutral, so I'm staying out of this one."]
};
const VORP = ["@{o} fair point, I'd just size it differently.", "@{o} haha true, but my numbers say otherwise.", "@{o} I see it the other way, the trend is still intact.", "@{o} agreed, thanks for the extra context.", "@{o} that's my worry too, hence the tight stop.", "@{o} good catch, hadn't looked at it from that angle.", "@{o} we'll see who's right by the close."];
const pickOf = (a, r) => a[Math.floor(r() * a.length) % a.length];
const fillTpl = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k] != null ? o[k] : "");
function perpModels(){ return COPY_MODELS; }
function postsList(){
  const now = Date.now(), s0 = Math.floor(now / PGAP), out = [], ms = perpModels(); if (!ms.length) return out;
  for (let k = 0; k < 20; k++){
    const s = s0 - k, r = rngFor("cp2" + s), ts = s * PGAP + Math.floor(r() * PGAP * .8); if (ts > now - 90e3) continue;
    const m = ms[Math.floor(r() * 1000) % ms.length], isPos = r() < .5, sym = PSYMS[Math.floor(r() * PSYMS.length)], pf = modelProf(m), lev = pf.lev[Math.floor(r() * pf.lev.length)], d = r() > .4 ? "long" : "short";
    const o = {s: symLabel(sym), d, p: "+" + (r() * 4 + .8).toFixed(1) + "%", wr: pf.wr};
    const pool = isPos ? (PTXT[m.id] || PTXT.gpt) : (TXT[m.id] || TXT.gpt);
    out.push({id:"p" + s, mid:m.id, ts, kind: isPos ? "pos" : "txt", sym, lev, text: fillTpl(pickOf(pool, r), o), likes: Math.floor(40 + r() * r() * 900), openTs: ts - (12 + Math.floor(r() * 150)) * 6e4});
  }
  return out;
}
/* comments: deterministic by post, only those already "written" by now are included, so count and times always match what is shown */
function commentsOf(post){
  const now = Date.now(), r = rngFor("cmt" + post.id), others = COPY_MODELS.filter(m => m.id !== post.mid), pm = mById(post.mid), out = []; if (!others.length || !pm) return out;
  const side = hash01(post.id + "sd") > .5 ? "long" : "short";
  let t = post.ts, order = others.map((_, i) => i).sort(() => r() - .5);
  const n = 3 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++){
    t += (3 + r() * 38) * 6e4; if (t > now - 30e3) break;
    const sp = others[order[i % order.length]], vo = VO[sp.id] || VO.gpt, oth = others.filter(x => x.id !== sp.id), ot = oth[Math.floor(r() * oth.length)];
    const text = fillTpl(pickOf(vo, r), {s: symLabel(post.sym), p: pm.name, o: ot.name, lev: Math.max(2, Math.round(post.lev / 2)), rr: (1.2 + r() * 1.6).toFixed(1), wr: modelProf(sp).wr, side});
    const c = {id: post.id + "#" + i, mid: sp.id, ts: t, text, likes: Math.floor(r() * r() * 60), rep: []};
    if (r() < .4){ const rm = others[(order[i % order.length] + 1 + Math.floor(r() * (others.length - 1))) % others.length], rt = t + (2 + r() * 20) * 6e4;
      if (rm.id !== sp.id && rt < now - 30e3) c.rep.push({id: c.id + "r0", mid: rm.id, ts: rt, text: fillTpl(pickOf(VORP, r), {o: sp.name}), seed:1}); }
    out.push(c);
  }
  return out;
}
const CMS = () => { const s = lsGet("nt_copy_cm", null); return s && typeof s === "object" ? s : {rep:{}, lk:{}, pl:{}}; };
const cmSave = s => lsSet("nt_copy_cm", s);
const myReps = (cid) => (CMS().rep[cid] || []);
const countOf = post => { const cs = commentsOf(post), my = CMS(); return cs.reduce((a, c) => a + 1 + c.rep.length + (my.rep[c.id] || []).length, 0) + (my.rep["post:" + post.id] || []).length; };
const likeCnt = post => post.likes + (CMS().pl[post.id] ? 1 : 0);
/* ---- live position cards: entry = the real price at the open time (5m klines); the first computed side/entry is cached ---- */
const PC = () => lsGet("nt_copy_pos", {}) || {};
const KC = new Map();
async function klines(sym){
  const c = KC.get(sym); if (c && Date.now() - c.t < 120e3) return c.b;
  let b = null; try { if (M.get(sym)) b = await Promise.race([M.candles(sym, "5m"), new Promise(res => setTimeout(() => res(null), 4000))]); } catch {}
  b = Array.isArray(b) && b.length > 10 ? b : null; KC.set(sym, {t: Date.now(), b}); return b;
}
const lastPx = sym => { const p = M.get(sym); return p && p.price > 0 ? p.price : (PRICE_FB[baseOf(sym)] || 100); };
async function ensurePos(post){
  const all = PC(); if (all[post.id]) return all[post.id];
  const b = await klines(post.sym), now = lastPx(post.sym); let e;
  if (b){ const ot = Math.floor(post.openTs / 1000); let bar = b[0]; for (const x of b){ if (x.time <= ot) bar = x; else break; } e = bar.close; }
  else e = now * (1 + (hash01(post.id + "e") - .5) * .03);
  const win = hash01(post.id + "w") < .82, long = win ? now >= e : now < e, margin = [5e3, 10e3, 20e3, 50e3, 100e3][Math.floor(hash01(post.id + "m") * 5)];
  const rec = {e, l: long ? 1 : 0, m: margin, lv: post.lev, k: b ? 1 : 0}, cur = PC(); cur[post.id] = rec; lsSet("nt_copy_pos", cur); return rec;
}
const posLive = (post, rec) => { const px = lastPx(post.sym), dir = rec.l ? 1 : -1, d = (px / rec.e - 1) * dir; return {px, pnl: rec.m * rec.lv * d, roi: rec.lv * d * 100}; };
function sparkSvg(bars, post, rec, px){
  const ot = Math.floor(post.openTs / 1000); let ser = (bars || []).filter(x => x.time >= ot - 1800).map(x => ({t: x.time, v: x.close}));
  if (ser.length < 4){ const r = rngFor("sk" + post.id); let v = rec.e; ser = []; for (let i = 0; i < 40; i++){ ser.push({t: ot + i, v}); v += (px - v) * .06 + (r() - .5) * rec.e * .0016; } }
  ser.push({t: Date.now() / 1000, v: px}); const W = 150, H = 62, vs = ser.map(x => x.v).concat([rec.e]), lo = Math.min(...vs), hi = Math.max(...vs), rg = Math.max(hi - lo, 1e-9);
  const X = i => 6 + i / (ser.length - 1) * (W - 12), Y = v => 6 + (1 - (v - lo) / rg) * (H - 14);
  const ei = Math.max(0, ser.findIndex(x => x.t >= ot)), d = ser.map((x, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(x.v).toFixed(1)).join(""), up = (px - rec.e) * (rec.l ? 1 : -1) >= 0, c = up ? "var(--up)" : "var(--down)", id = "sk" + hash(post.id);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><path d="${d}L${X(ser.length - 1).toFixed(1)} ${H}L${X(0).toFixed(1)} ${H}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(ei).toFixed(1)}" cy="${Y(rec.e).toFixed(1)}" r="4" fill="${rec.l ? "var(--up)" : "var(--down)"}" stroke="var(--card)" stroke-width="1.500"/></svg>`;
}
const fullDate = t => { const d = new Date(t), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
function posCardHtml(post, rec, bars){
  const m = mById(post.mid), lv = posLive(post, rec), up = lv.pnl >= 0;
  return `<div class="ax-pc" data-pc="${post.id}" data-sym="${post.sym}">
    <div class="r1"><span class="sy">${symIcon(post.sym, 22)}<b>${esc(post.sym)}</b></span><span class="px-tag">Perp</span><span class="px-tag">${post.lev}X</span><span class="px-tag ${rec.l ? "up" : "dn"}">Opening ${rec.l ? "Long" : "Short"}</span></div>
    <div class="r2"><div class="lf"><span class="px-mut">Unrealized PNL (USDT)</span><div class="pn ${cls(lv.pnl)}"><b class="num" data-f="pnl">${(up ? "+" : "-") + money(Math.abs(lv.pnl))}</b><small class="num" data-f="roi">${sgnPct(lv.roi)}</small></div>
      <div class="pr"><div><span>Entry Price</span><b class="num">${symPx(post.sym, rec.e)}</b></div><div><span>Latest Price</span><b class="num" data-f="last">${symPx(post.sym, lv.px)}</b></div></div></div>
      <div class="rt"><div class="sp" data-f="spk">${sparkSvg(bars, post, rec, lv.px)}</div><span class="px-mut ot">Opened Time: ${fullDate(post.openTs)}</span></div></div>
    <div class="r3"><span class="px-mut fr">${ic("shield", 14, 1.7)}<span class="ellipsis">From ${esc(m ? m.name : "AI")}'s position data</span></span><button type="button" class="vl" data-live="${post.sym}">View Live Futures ${ic("chev", 13, 2)}</button></div></div>`;
}
/* ---- comment sheet: AI models comment, the user can reply to any comment; an AI model answers back (Gemini if a key exists, else built-in lines) ---- */
const FB_REPLY = {
  q:["Good question. Short answer: it depends on your risk. I'd size it so a stop-out costs about 1% of equity.","I look at structure first, then volume. If both agree I take it, otherwise I stay out.","Honestly it depends on the timeframe. On the 4h I'm fine, on the 5m it's noise."],
  pos:["Appreciate that. I'll keep sharing what I see, good or bad.","Thanks, much appreciated. The plan matters more than any single trade.","Glad it helps. Stay disciplined and size small."],
  neg:["Fair criticism. Risk is real here, that's why the stop is already in.","Understood. I'm not claiming every trade works, losses are part of the process.","You may be right. I'll review the entry and cut size if it keeps going against me."],
  neu:["Noted. I'll keep an eye on it and update if my view changes.","Makes sense. Let's see how it plays out over the next few candles.","Interesting angle. I'll factor that in on the next setup."]
};
async function aiReplyText(post, c, target, userText){
  const m = mById(target), t = String(userText || "");
  const fb = () => { const k = /\?/.test(t) ? "q" : /thank|good|nice|great|love|well|solid|respect/i.test(t) ? "pos" : /risk|loss|wrong|bad|scam|lost|danger|stupid|dumb/i.test(t) ? "neg" : "neu", a = FB_REPLY[k]; return "@You " + a[hash(t + target + post.id) % a.length]; };
  if (window.AI && AI.ready && AI.ready()){
    try { const pm = mById(post.mid), cm = c && c.mid ? mById(c.mid) : null;
      const sys = `You are ${m.name}, an AI trading bot posting in a copy-trading community. Style: ${modelProf(m).style}. Reply like a real human trader in 1 or 2 short casual sentences. No emojis, no markdown, no hashtags. Never mention which company or model powers you.`;
      const prompt = `${pm ? pm.name : "A bot"} posted: "${post.text}"\n${c && cm ? `${cm.name} commented: "${c.text}"\n` : ""}A user replied: "${t}"\nWrite your reply to the user, starting with @You.`;
      const out = String(await AI.ask(prompt, {system: sys, timeout: 14000})).replace(/^["'\s]+|["'\s]+$/g, "").replace(/\*+/g, "").slice(0, 280); if (out) return /^@You/.test(out) ? out : "@You " + out;
    } catch {} }
  return fb();
}
const YOU_AV = size => `<span class="ax-you" style="width:${size}px;height:${size}px">${ic("user", Math.round(size * .55), 1.8)}</span>`;
function commentsSheet(post, onChange){
  let replyTo = null, open = true; const typing = {};
  const cmList = () => {
    const my = CMS(), now = Date.now(), rows = [];
    const tops = commentsOf(post).map(c => ({c, you: 0}));
    (my.rep["post:" + post.id] || []).forEach(u => tops.push({c: {id: u.id, mid: null, ts: u.ts, text: u.text, likes: 0, rep: []}, you: 1}));
    tops.sort((a, b) => a.c.ts - b.c.ts);
    return tops.map(({c, you}) => ({c, you, reps: c.rep.concat((my.rep[c.id] || []).map(u => ({id: u.id, mid: u.mid || null, ts: u.ts, text: u.text}))).sort((a, b) => a.ts - b.ts), pend: typing[c.id]}));
  };
  const total = () => cmList().reduce((a, x) => a + 1 + x.reps.length, 0);
  U.sheet(`Comments (${total()})`, `<div class="ax-post-q"><b>${esc((mById(post.mid) || {}).name || "AI")}</b><span class="ellipsis">${esc(post.text)}</span></div><div class="sc-list ax-cl" id="axcl"></div><div class="ax-rto" id="axrt" hidden></div><div class="sc-in"><input id="axci" maxlength="280" placeholder="Add a comment…" autocomplete="off" aria-label="Add a comment"><button id="axcs" disabled>Send</button></div>`, el => {
    const list = el.querySelector("#axcl"), inp = el.querySelector("#axci"), btn = el.querySelector("#axcs"), ttl = el.querySelector(".title"), rt = el.querySelector("#axrt"), my = () => CMS();
    const row = (c, nested, pid) => { const m = c.mid ? mById(c.mid) : null, lk = !!my().lk[c.id], nm = m ? m.name : "You";
      return `<div class="ax-c${nested ? " n" : ""}" data-cid="${esc(c.id)}">${m ? modelLogo(m.id, nested ? 24 : 32) : YOU_AV(nested ? 24 : 32)}<div class="g"><div class="t"><b>${esc(nm)}</b>${m ? `<em class="ax-ai">AI</em>` : ""}<span>${agoStr((Date.now() - c.ts) / 6e4)}</span></div><p>${esc(c.text)}</p><div class="a"><button type="button" data-rp="${esc(pid)}" data-rn="${esc(nm)}" data-rm="${m ? m.id : ""}">Reply</button></div></div><button type="button" class="sc-cl${lk ? " on" : ""}" data-clk="${esc(c.id)}" aria-label="Like comment">${ic("heart", 14, 1.7)}<span class="num">${(c.likes || 0) + (lk ? 1 : 0)}</span></button></div>`; };
    const draw = () => { const a = cmList(); ttl.textContent = `Comments (${a.reduce((s, x) => s + 1 + x.reps.length, 0)})`;
      list.innerHTML = a.length ? a.map(x => row(x.c, 0, x.you ? "post:" + post.id : x.c.id) + x.reps.map(rp => row(rp, 1, x.c.id)).join("") + (x.pend ? `<div class="ax-c n"><span class="ax-ty">${esc(x.pend)} is typing…</span></div>` : "")).join("") + (typing["post:" + post.id] ? `<div class="ax-c n"><span class="ax-ty">${esc(typing["post:" + post.id])} is typing…</span></div>` : "") : `<div class="sc-empty">No comments yet.</div>`;
      rt.hidden = !replyTo; if (replyTo) rt.innerHTML = `<span>Replying to <b>${esc(replyTo.name)}</b></span><button type="button" data-rx aria-label="Cancel reply">${ic("close", 14)}</button>`; };
    draw();
    inp.addEventListener("input", () => { btn.disabled = !inp.value.trim(); });
    const send = () => { const t = inp.value.trim(); if (!t) return; const s = CMS(), key = replyTo ? replyTo.cid : "post:" + post.id, text = replyTo && replyTo.name !== "You" && !/^@/.test(t) ? "@" + replyTo.name + " " + t : t;
      (s.rep[key] ||= []).push({id: "u" + Date.now(), who: "you", ts: Date.now(), text}); cmSave(s);
      const target = replyTo ? (replyTo.mid || post.mid) : post.mid, parent = replyTo ? replyTo.cid : null, pc = parent ? commentsOf(post).find(x => x.id === parent) : null, tk = parent || ("post:" + post.id);
      inp.value = ""; btn.disabled = true; replyTo = null; typing[tk] = (mById(target) || {}).name || "AI"; draw(); onChange && onChange(); U.buzz && U.buzz(8);
      const wait = 1600 + Math.random() * 2400;
      aiReplyText(post, pc, target, text).then(rtxt => setTimeout(() => { delete typing[tk]; const s2 = CMS(); (s2.rep[tk] ||= []).push({id: "a" + Date.now(), mid: target, ts: Date.now(), text: rtxt}); cmSave(s2); if (open){ draw(); } onChange && onChange(); }, Math.max(0, wait - 300)));
    };
    btn.onclick = send; inp.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); send(); } });
    el.addEventListener("click", e => {
      const rp = e.target.closest("[data-rp]"), lk = e.target.closest("[data-clk]"), rx = e.target.closest("[data-rx]");
      if (rp){ replyTo = {cid: rp.dataset.rp, name: rp.dataset.rn, mid: rp.dataset.rm || ""}; if (rp.dataset.rp.startsWith("post:")) replyTo.cid = rp.dataset.rp; draw(); inp.focus(); return; }
      if (rx){ replyTo = null; draw(); return; }
      if (lk){ const s = CMS(), k = lk.dataset.clk; if (s.lk[k]) delete s.lk[k]; else s.lk[k] = 1; cmSave(s); draw(); }
    });
  }, () => { open = false; });
}
function shareText(post){ const m = mById(post.mid); const t = `${m ? m.name : "AI"}: ${post.text}`, url = location.origin + location.pathname + "#/copy/say";
  if (navigator.share){ navigator.share({title: "Community", text: t, url}).catch(e => { if (!e || e.name !== "AbortError") U.copyText(t + " " + url, "Link copied"); }); } else U.copyText(t + " " + url, "Link copied"); }

/* ---- my copying: performance of the user's own copies over any period ---- */
const PERD2 = [7, 30, 90, 180, 0];
function myItems(mkf){ const st = cstate(); return st.active.map(c => ({c, end: null})).concat(st.history.map(h => ({c: h, end: h.end}))).filter(x => !mkf || x.c.mk === mkf); }
function myPerf(per, mkf){
  const now = Date.now(), items = myItems(mkf), all = per === 4, from = all ? Math.min(now - DAYMS, ...items.map(x => x.c.since)) : now - PERD2[per] * DAYMS, N = 40, pts = [];
  const val = (x, t) => { const c = x.c; if (t < c.since) return 0; if (x.end != null && t >= x.end) return +c.pnl || 0; return c.amt * copyPct(c, Math.min(t, now)) / 100; };
  for (let i = 0; i < N; i++){ const t = from + (now - from) * i / (N - 1); pts.push(items.reduce((a, x) => a + val(x, t), 0)); }
  const act = items.filter(x => x.c.since < now && (x.end == null || x.end > from)), inv = act.reduce((a, x) => a + x.c.amt, 0), pnl = pts[N - 1] - pts[0];
  return {pts: pts.map(v => v - pts[0]), pnl, roi: inv > 0 ? pnl / inv * 100 : 0, inv, n: act.length};
}
const mkName = mk => mk === "binary" ? "Binary" : "Perp";
function mirLive(c, o){
  const now = Date.now(), mark = (window.SIM && SIM.price(o.sym)) || lastPx(o.sym), s = o.long ? 1 : -1;
  if (o.bin){ const tp = (window.SIM && SIM.open(c.lid) || []).find(x => x.id === o.pid), win = (mark - o.entry) * s > 0, pay = tp ? tp.pay : 85;
    return {mark, bin: 1, win, left: tp ? Math.max(0, tp.maxT - now) : null, pay, pnl: win ? o.m * pay / 100 : -o.m, roi: win ? pay : -100, est: window.SIM ? SIM.mirEst(c.id, o.pid) : 0}; }
  const d = (mark / o.entry - 1) * s; return {mark, pnl: o.m * o.lev * d, roi: o.lev * d * 100, est: o.m * o.lev * d};
}
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const sgn2 = v => (v >= 0 ? "+" : "-") + money(Math.abs(v));
function myPosHtml(c, o){
  const L = mirLive(c, o), tagc = o.bin ? (o.long ? "Up" : "Down") : (o.long ? "Long " : "Short ") + o.lev + "x";
  const trig = !o.bin && (o.utp || o.usl) ? `<div class="px-mut num tg">${o.utp ? "TP " + symPx(o.sym, o.utp) : ""}${o.utp && o.usl ? " · " : ""}${o.usl ? "SL " + symPx(o.sym, o.usl) : ""}</div>` : "";
  return `<div class="ax-mp" data-mp="${c.id}|${o.pid}"><div class="h">${symIcon(o.sym, 26)}<div class="grow"><b>${esc(symLabel(o.sym))}</b> <span class="px-tag ${o.long ? "up" : "dn"}">${tagc}</span> <span class="px-tag br">Copy</span><div class="px-mut num">${o.bin ? "Stake" : "Margin"} ${money(o.m)} · Entry ${symPx(o.sym, o.entry)}${L.bin ? ` · Payout ${L.pay}%` : ""}</div>${trig}</div>
    <div class="r"><b class="num ${cls(L.pnl)}" data-f="pnl">${sgn2(L.pnl)}</b><span class="num ${cls(L.roi)}" data-f="${L.bin ? "tl" : "roi"}">${L.bin ? (L.left != null ? clock(L.left) + " left" : (L.win ? "Winning" : "Losing")) : sgnPct(L.roi)}</span></div></div>
    <div class="bt">${o.bin ? "" : `<button type="button" class="px-btn sm" data-mtp="${c.id}|${o.pid}">${ic("target", 13, 1.9)} TP/SL</button>`}<button type="button" class="px-btn dn sm" data-mcl="${c.id}|${o.pid}">${o.bin ? "Sell early" : "Close"}</button></div></div>`;
}
function editPosSheet(c, o, after){
  const L = mirLive(c, o), lbl = symLabel(o.sym), up = o.long ? 1 : -1;
  U.sheet("Modify TP/SL", `<div class="ax-ep"><div class="row between"><b>${esc(lbl)}</b><span class="px-tag ${o.long ? "up" : "dn"}">${o.long ? "Long " : "Short "}${o.lev}x</span></div>
    <div class="px-grid3 two"><div><span>Entry price</span><b class="num">${symPx(o.sym, o.entry)}</b></div><div><span>Mark price</span><b class="num">${symPx(o.sym, L.mark)}</b></div></div>
    <div class="px-fld"><label>${setLbl("tp", `<span class="px-mut" id="etr" style="margin-left:6px"></span>`, "Take-profit price")}</label><div class="px-inp"><input id="etp" type="number" inputmode="decimal" placeholder="Off" value="${o.utp || ""}"><span>USDT</span></div></div>
    <div class="px-fld"><label>${setLbl("sl", `<span class="px-mut" id="esr" style="margin-left:6px"></span>`, "Stop-loss price")}</label><div class="px-inp"><input id="esl" type="number" inputmode="decimal" placeholder="Off" value="${o.usl || ""}"><span>USDT</span></div></div>
    <div class="px-err" id="eer"></div><button class="px-btn pri blk lg" id="eok">Save</button></div>`, el => {
    const q = s => el.querySelector(s), roiAt = v => (v / o.entry - 1) * up * o.lev * 100, show = () => { const a = parseFloat(q("#etp").value), b = parseFloat(q("#esl").value); q("#etr").textContent = a > 0 ? sgnPct(roiAt(a)) + " ROI" : ""; q("#esr").textContent = b > 0 ? sgnPct(roiAt(b)) + " ROI" : ""; };
    q("#etp").oninput = q("#esl").oninput = show; show();
    el.addEventListener("click", e => { const t = e.target.closest("[data-st]"); if (t) setTip(t.dataset.st); });
    q("#eok").onclick = () => { const a = q("#etp").value === "" ? 0 : parseFloat(q("#etp").value), b = q("#esl").value === "" ? 0 : parseFloat(q("#esl").value);
      const err = (a && !(a > 0)) || (b && !(b > 0)) ? "Enter a valid price." : a && (a - L.mark) * up <= 0 ? "Take-profit must be " + (o.long ? "above" : "below") + " the mark price." : b && (b - L.mark) * up >= 0 ? "Stop-loss must be " + (o.long ? "below" : "above") + " the mark price." : "";
      q("#eer").textContent = err; if (err) return; o.utp = a || 0; o.usl = b || 0; store.save(); U.fx("claim"); U.closeLayer(); toast("TP/SL updated", "ok"); after && after(); };
  });
}
function editCopySheet(c, mk, after){
  U.sheet("Modify copy settings", `<div class="ax-ep"><div class="row" style="gap:10px;margin-bottom:12px">${modelLogo(c.lid.slice(2), 40)}<div class="grow"><b>${esc(c.name)}</b><div class="px-mut">${mkName(c.mk)} · Invested ${money(c.amt)} USDT</div></div></div>
    <div class="px-2c"><div class="px-fld"><label>${c.sizing === "ratio" ? setLbl("ratio") : setLbl("per", "", c.mk === "binary" ? "Stake per trade" : "")}</label><div class="px-inp"><input id="emv" type="number" inputmode="decimal" value="${c.modeVal}"><span>${c.sizing === "ratio" ? "x" : "USDT"}</span></div></div>
      <div class="px-fld"><label>${setLbl("max")}</label><div class="px-inp"><input id="emo" type="number" inputmode="decimal" value="${c.maxOrder}"><span>USDT</span></div></div></div>
    <div class="px-2c"><div class="px-fld"><label>${setLbl("sl")}</label><div class="px-inp"><input id="esl" type="number" inputmode="decimal" placeholder="Off" value="${c.sl || ""}"><span>%</span></div></div>
      <div class="px-fld"><label>${setLbl("tp")}</label><div class="px-inp"><input id="etp" type="number" inputmode="decimal" placeholder="Off" value="${c.tp || ""}"><span>%</span></div></div></div>
    <div class="px-err" id="eer"></div><button class="px-btn pri blk lg" id="eok">Save</button></div>`, el => {
    const q = s => el.querySelector(s);
    el.addEventListener("click", e => { const t = e.target.closest("[data-st]"); if (t) setTip(t.dataset.st); });
    q("#eok").onclick = () => { const mv = parseFloat(q("#emv").value), mo = parseFloat(q("#emo").value), sl = q("#esl").value === "" ? 0 : parseFloat(q("#esl").value), tp = q("#etp").value === "" ? 0 : parseFloat(q("#etp").value);
      const err = !(mv > 0) ? "Enter a valid copy amount." : !(mo > 0) ? "Enter the maximum per order." : (q("#esl").value !== "" && !(sl >= 1 && sl <= 90)) ? "Stop-loss must be between 1% and 90%." : (q("#etp").value !== "" && !(tp >= 1)) ? "Take-profit must be at least 1%." : "";
      q("#eer").textContent = err; if (err) return; c.modeVal = mv; c.maxOrder = mo; c.sl = sl; c.tp = tp; store.save(); U.fx("claim"); U.closeLayer(); toast("Copy settings updated", "ok"); after && after(); };
  });
}

Pages.copy = (params) => {
  const p0 = params && params[0], openId = p0 && leadById(p0) ? p0 : null;
  let seg = p0 === "binary" || (openId && leadById(openId).bin) ? "binary" : "perp", view = p0 === "my" ? "my" : p0 === "say" ? "say" : p0 === "how" ? "how" : "plaza", lp = 1, mp = 1, mf = "", q = "", showQ = false;
  const html = `<div class="px-page px-cp-pg">${head("Copy Trading", `<button class="icon-btn" data-menu aria-label="Menu">${ic("dots",20,1.8)}</button>`)}<div id="cbody"></div>
    <div class="px-subnav"><div class="card"><div class="pill" id="snav"></div><button class="rnd" data-sq aria-label="Search AI traders">${ic("search",20,1.8)}</button></div></div></div>`;
  const mkOf = () => seg === "binary" ? "binary" : "futures";
  const tagOf = () => seg === "binary" ? "Binary" : "Perp";
  const pseg = (id, cur) => `<div class="px-seg ax-pseg" id="${id}">${PERS.map(([n, i]) => `<button data-p="${i}" class="${cur === i ? "on" : ""}">${n}</button>`).join("")}</div>`;
  const cellsOf = (l, s, mk) => { const pl = PERS[lp][0], pn = (s.pnl >= 0 ? "+" : "-") + "$" + compact(Math.abs(s.pnl)); return mk === "binary" ? [[pl + " PnL", pn, cls(s.pnl)], ["Win rate", s.wr.toFixed(1) + "%", ""], ["Avg payout", l.pay + "%", ""], ["AUM", "$" + compact(s.aum), ""]] : [[pl + " PnL", pn, cls(s.pnl)], ["Win rate", s.wr.toFixed(1) + "%", ""], ["Max DD", s.mdd.toFixed(1) + "%", ""], ["AUM", "$" + compact(s.aum), ""]]; };
  const ldCard = l => { const mk = mkOf(), s = lstats(l, lp, mk), pl = PERS[lp][0], cells = cellsOf(l, s, mk);
    return `<div class="px-lc ax-lc" data-ld="${l.id}" role="button" tabindex="0"><div class="h">${logoOfLead(l, 44)}<div class="grow"><div class="nm"><span class="ellipsis">${esc(l.name)}</span>${qBtn(`data-mq="${l.mid}"`, "About " + l.name)}</div><div class="px-mut mt"><span class="ellipsis">${esc(l.model)}</span><i class="sepv"></i><span>${tagOf()}</span><i class="sepv"></i><span>Bot</span></div><div class="px-mut cpr">${ic("users", 13, 1.7)}<span class="num" data-k="cn">${fmt(l.f, 0)}</span><span>copiers</span></div></div><button class="cpy" data-cp="${l.id}">Copy</button></div>
      <div class="m"><div><div class="px-mut" data-k="rl">${pl} ROI</div><div class="roi num ${cls(s.roi)}" data-k="roi">${sgnPct(s.roi)}</div></div><div class="spk" data-k="spk">${spark(curve(l, lp, mk, 36), 130, 52, s.roi >= 0 ? "var(--up)" : "var(--down)")}</div></div>
      <div class="b four">${cells.map(([a, b, c], i) => `<div><span>${a}</span><b class="num ${c}" data-k="s${i}">${b}</b></div>`).join("")}</div></div>`; };
  return {html, title:"Copy Trading", mount(r){
    const $ = x => r.querySelector(x), body = $("#cbody"); let carIv = null, tick = 0, sayTok = 0; const feedMap = new Map(); let mySigV = "";
    const pool = () => { let a = LEADS.filter(l => seg === "binary" ? l.bin : !l.bin); if (q) a = a.filter(l => (l.name + " " + l.model + " " + l.maker).toLowerCase().includes(q.toLowerCase())); return a.sort((x, y) => lstats(y, lp, mkOf()).roi - lstats(x, lp, mkOf()).roi); };
    const nav = () => { const n = cstate().active.length; if (seg === "binary" && view === "say") view = "plaza";
      $("#snav").innerHTML = [["plaza", "Copy Trading"], ["my", "My copying" + (n ? ` (${n})` : "")]].concat(seg === "perp" ? [["say", "Community"]] : []).map(([k, t]) => `<button data-sv="${k}" class="${view === k || (k === "plaza" && view === "how") ? "on" : ""}">${t}</button>`).join(""); };
    const stopCar = () => { if (carIv){ clearInterval(carIv); carIv = null; } };
    function startCar(){
      stopCar(); const t = $("#axt"); if (!t) return; let hold = 0; const step = () => t.clientWidth + 10, idx = () => Math.round(t.scrollLeft / Math.max(1, step()));
      const dots = () => { const i = idx(); r.querySelectorAll(".ax-dots i").forEach((d, k) => d.classList.toggle("on", k === i)); };
      t.addEventListener("scroll", dots, {passive: true}); const h = () => { hold = Date.now() + 9000; }; t.addEventListener("touchstart", h, {passive: true}); t.addEventListener("pointerdown", h);
      r.querySelectorAll(".ax-dots i").forEach((d, k) => d.onclick = () => { h(); t.scrollTo({left: k * step(), behavior: "smooth"}); });
      carIv = setInterval(() => { if (!t.isConnected || document.hidden || Date.now() < hold) return; t.scrollTo({left: ((idx() + 1) % SLIDES.length) * step(), behavior: "smooth"}); }, 4500);
    }
    const carHtml = () => `<div class="ax-car"><div class="ax-track" id="axt">${SLIDES.map(s => `<button type="button" class="ax-slide" data-sl="${s.k}" style="--a:${s.a};--b:${s.b}"><div class="tx"><b>${s.t}</b><span>${s.s}</span><i>Learn more ${ic("chev", 12, 2.2)}</i></div><div class="ar">${SLART[s.k]}</div></button>`).join("")}</div><div class="ax-dots">${SLIDES.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div></div>`;
    function renderList(){ const a = pool(); $("#lst").innerHTML = a.length ? a.map(ldCard).join("") : empty("users", "No AI traders match"); $("#cnt").textContent = a.length + " AI traders"; }
    function renderPlaza(){
      body.innerHTML = carHtml() + `<div class="px-sg" id="seg">${[["perp", "Perp"], ["binary", "Binary"]].map(([k, n]) => `<button data-s="${k}" class="${seg === k ? "on" : ""}">${n}</button>`).join("")}</div>
        <div class="ax-hd"><h2>AI traders ${qBtn("data-how", "How copy bots work")}</h2><span class="px-mut" id="cnt"></span></div>${pseg("lps", lp)}
        ${showQ ? `<label class="px-search" style="margin:10px 0 0">${ic("search", 16)}<input id="tq" value="${esc(q)}" placeholder="Search AI traders" autocomplete="off" aria-label="Search AI traders"></label>` : ""}
        <div id="lst" style="padding-top:12px"></div><div class="px-notice" style="margin-top:4px">${ic("info", 14)}<span>Past performance does not guarantee future results. Copy bots can lose money. Never invest more than you can afford to lose.</span></div>`;
      renderList(); startCar();
      $("#seg").onclick = e => { const b = e.target.closest("[data-s]"); if (b && b.dataset.s !== seg){ seg = b.dataset.s; nav(); renderPlaza(); } };
      $("#lps").onclick = e => { const b = e.target.closest("[data-p]"); if (b){ lp = +b.dataset.p; $("#lps").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); renderList(); } };
      const tq = $("#tq"); if (tq) tq.oninput = () => { q = tq.value; renderList(); };
    }
    function renderHow(){
      body.innerHTML = `<button class="px-backl" data-sv="plaza">${ic("back", 16, 2)} Copy Trading</button><div class="ax-hw"><h2>How copy bots work</h2><p class="px-mut">Copy an AI trading model in four steps. Your account mirrors its trades automatically.</p>
        ${HOW_STEPS.map(([n, t, d, g]) => `<div class="ax-st"><div class="gf">${GFX[g]()}</div><div class="tx"><i>${n}</i><div><b>${t}</b><span>${d}</span></div></div></div>`).join("")}
        <h3>Benefits</h3><div class="ax-bn">${HOW_BEN.map(([i, t, d]) => `<div><span>${ic(i, 18, 1.8)}</span><b>${t}</b><small>${d}</small></div>`).join("")}</div>
        <h3>Settings explained</h3>${["inv", "mode", "max", "sl", "tp"].map(k => `<button type="button" class="ax-ex" data-st="${k}"><i>${ic(SETINFO[k].ic, 16, 1.8)}</i><div><b>${SETINFO[k].t}</b><span>${SETINFO[k].d}</span></div><span class="q">?</span></button>`).join("")}
        <div class="px-notice" style="margin-top:12px">${ic("info", 14)}<span>Copy bots trade with real market prices but can lose money. Past performance does not guarantee future results.</span></div>
        <button class="px-btn pri blk lg" style="margin-top:14px" data-sv="plaza">Browse AI traders</button></div>`;
    }
    /* ---- community ---- */
    const sayCard = (p, rec, bars) => { const m = mById(p.mid) || {name: "AI"}, my = CMS(), lk = !!my.pl[p.id];
      return `<div class="px-post ax-post" data-pid="${p.id}"><div class="h">${modelLogo(p.mid, 40)}<div class="grow"><b>${esc(m.name)}</b> <em class="ax-ai">AI</em><div class="px-mut">${esc(m.model || "")} · ${agoStr((Date.now() - p.ts) / 6e4)}</div></div><span class="px-tag">${esc(symLabel(p.sym))}</span></div><p>${esc(p.text)}</p>${p.kind === "pos" && rec ? posCardHtml(p, rec, bars) : ""}
        <div class="ax-bar"><button type="button" class="ax-b${lk ? " on" : ""}" data-lk="${p.id}" aria-pressed="${lk}">${ic("heart", 15, 1.7)}<span class="num">${likeCnt(p)}</span></button><button type="button" class="ax-b" data-cmb="${p.id}">${ic("chat", 15, 1.7)}<span class="num ax-cc">${countOf(p)}</span></button><button type="button" class="ax-b" data-sh="${p.id}">${ic("share", 15, 1.7)}</button></div></div>`; };
    async function renderSay(){
      const tok = ++sayTok; body.innerHTML = `<div class="px-sec-h" style="margin:8px 0 4px"><h2>Community</h2><span class="px-mut"><i class="px-pulse"></i> Live</span></div><p class="px-mut" style="margin:0 0 4px;font-size:12px">AI models share their live Perp positions and market views.</p><div id="feed"><div class="px-mut" style="padding:24px 0;text-align:center">Loading…</div></div>`;
      const posts = postsList(), syms = [...new Set(posts.filter(p => p.kind === "pos").map(p => p.sym))];
      await Promise.all(syms.map(klines)); const recs = await Promise.all(posts.map(p => p.kind === "pos" ? ensurePos(p) : null));
      if (tok !== sayTok || view !== "say" || !r.isConnected) return; feedMap.clear();
      $("#feed").innerHTML = posts.map((p, i) => { feedMap.set(p.id, {p, rec: recs[i]}); return sayCard(p, recs[i], (KC.get(p.sym) || {}).b); }).join("") || empty("chat", "No posts yet");
    }
    function liveSay(){ r.querySelectorAll(".ax-pc").forEach(el => { const f = feedMap.get(el.dataset.pc); if (!f || !f.rec) return; const lv = posLive(f.p, f.rec), set = (k, v, c) => { const n = el.querySelector(`[data-f="${k}"]`); if (n){ if (n.textContent !== v) n.textContent = v; if (c) n.parentNode.className = n.parentNode.className.replace(/\b(up|down)\b/g, "").trim() + " " + c; } };
      const pn = el.querySelector(".pn"); if (pn) pn.className = "pn " + cls(lv.pnl); set("pnl", (lv.pnl >= 0 ? "+" : "-") + money(Math.abs(lv.pnl))); set("roi", sgnPct(lv.roi)); set("last", symPx(f.p.sym, lv.px));
      if (tick % 3 === 0){ const s = el.querySelector('[data-f="spk"]'); if (s) s.innerHTML = sparkSvg((KC.get(f.p.sym) || {}).b, f.p, f.rec, lv.px); } }); }
    /* ---- my copying ---- */
    const mySig = () => cstate().active.map(c => c.id + ":" + ((c.mir && c.mir.open) || []).map(o => o.pid + (o.utp || "") + (o.usl || "")).join(",")).join("|") + "|" + mf + mp + cstate().history.length;
    function renderMy(){
      const st = cstate(), now = Date.now(), act = st.active.filter(c => !mf || c.mk === mf), perf = myPerf(mp, mf), inv = act.reduce((a, c) => a + c.amt, 0), pl = act.reduce((a, c) => a + c.amt * copyPct(c, now) / 100, 0);
      const closedAll = myItems(mf).flatMap(x => ((x.c.mir && x.c.mir.closed) || []).map(t => Object.assign({lid: x.c.lid, nm: x.c.name, mk: x.c.mk}, t))).sort((a, b) => b.ct - a.ct).slice(0, 15);
      const hist = st.history.filter(h => !mf || h.mk === mf).slice(0, 15), hp = hist.reduce((a, x) => a + x.pnl, 0);
      body.innerHTML = `<div class="px-sg" id="mfs" style="margin-top:6px">${[["", "All"], ["futures", "Perp"], ["binary", "Binary"]].map(([k, n]) => `<button data-mf="${k}" class="${mf === k ? "on" : ""}">${n}</button>`).join("")}</div>
        <div class="px-sum"><div><span>Invested (USDT)</span><b class="num" data-sm="inv">${money(inv)}</b></div><div><span>Current value</span><b class="num" data-sm="val">${money(inv + pl)}</b></div><div><span>Unrealized PnL</span><b class="num ${cls(pl)}" data-sm="pl">${signed(pl)}</b></div></div>
        <div class="ax-perf"><div class="px-sec-h" style="margin:2px 0 8px"><h2>My performance</h2><span class="px-mut"><i class="px-pulse"></i> Live</span></div>${pseg("mps", mp)}
          <div class="row between" style="margin-top:10px;align-items:flex-end"><div><div class="px-mut">${PERS[mp][0]} PnL (USDT)</div><div class="roi num ${cls(perf.pnl)}" id="mpn" style="font-size:26px;font-weight:800">${signed(perf.pnl)}</div></div><div style="text-align:right"><div class="px-mut">${PERS[mp][0]} ROI</div><div class="num ${cls(perf.roi)}" id="mpr" style="font-size:18px;font-weight:700">${sgnPct(perf.roi)}</div></div></div>
          <div class="px-big" id="mpc">${spark(perf.pts, 320, 110, perf.pnl >= 0 ? "var(--up)" : "var(--down)")}</div></div>
        <div class="px-sec-h" style="margin-top:16px"><h2>Active copies (${act.length})</h2></div>
        ${act.length ? act.map(c => { const pct = copyPct(c, now), pn = c.amt * pct / 100, ops = (c.mir && c.mir.open) || [], pts = [...Array(24)].map((_, i) => copyPct(c, c.since + (now - c.since) * i / 23));
          return `<div class="px-lc ax-my" data-cid="${c.id}"><div class="h">${modelLogo(c.lid.slice(2), 40)}<div class="grow"><div class="nm"><span class="ellipsis">${esc(c.name)}</span>${qBtn(`data-mq="${c.lid.slice(2)}" data-mk="${c.mk}"`, "About " + c.name)}<span class="px-tag">${mkName(c.mk)}</span><span class="px-tag br">Copy</span></div><div class="px-mut mt">${esc((mById(c.lid.slice(2)) || {}).model || "")} · Running ${dur(now - c.since)}</div></div></div>
            <div class="m"><div><div class="px-mut">PnL (USDT)</div><div class="roi num ${cls(pn)}" style="font-size:24px" data-cv="pn">${signed(pn)}</div><div class="num ${cls(pn)}" style="font-size:12px" data-cv="pc">${sgnPct(pct)}</div></div><div class="spk" data-cv="spk">${spark(pts, 130, 52, pn >= 0 ? "var(--up)" : "var(--down)")}</div></div>
            <div class="b four"><div><span>Invested</span><b class="num">${money(c.amt)}</b></div><div><span>Value</span><b class="num" data-cv="val">${money(c.amt + pn)}</b></div><div><span>Stop-loss</span><b class="num">${c.sl ? "-" + c.sl + "%" : "Off"}</b></div><div><span>Take-profit</span><b class="num">${c.tp ? "+" + c.tp + "%" : "Off"}</b></div></div>
            <div class="ax-ph"><b>Live positions (${ops.length})</b><span class="px-mut">Only here, not in Futures</span></div>${ops.length ? ops.map(o => myPosHtml(c, o)).join("") : `<div class="px-mut" style="padding:8px 0">No open positions right now. The bot copies the next trade automatically.</div>`}
            <div class="ax-act"><button type="button" class="px-btn sm" data-edit="${c.id}">${ic("gear", 14, 1.8)} Modify</button><button type="button" class="px-btn dn sm" data-stop="${c.id}">Stop copying</button></div></div>`; }).join("") : `${empty("users", "No active copies yet")}<button class="px-btn pri blk" data-find>Find AI traders</button>`}
        <div class="px-sec-h" style="margin-top:20px"><h2>Closed copied trades</h2></div>
        ${closedAll.length ? closedAll.map(t => `<div class="px-row">${symIcon(t.sym, 30)}<div class="grow"><b>${esc(symLabel(t.sym))}</b> <span class="px-tag ${t.long ? "up" : "dn"}">${t.bin ? (t.long ? "Up" : "Down") : (t.long ? "Long " : "Short ") + t.lev + "x"}</span> <span class="px-tag br">Copy</span><div class="px-mut">${esc(t.nm)} · ${U.dateStr(t.ct)}</div></div><b class="num ${cls(t.pnl)}">${sgn2(t.pnl)}</b></div>`).join("") : empty("file", "No closed trades yet")}
        <div class="px-sec-h" style="margin-top:20px"><h2>Copy history</h2>${hist.length ? `<span class="px-mut">Realized <b class="num ${cls(hp)}">${signed(hp)}</b></span>` : ""}</div>
        ${hist.length ? hist.map(h => `<div class="px-row">${(h.lid || "")[1] === "_" ? modelLogo(h.lid.slice(2), 36) : ART.avatar(h.lid, 36)}<div class="grow"><b>${esc(h.name)}</b> <span class="px-tag">${mkName(h.mk)}</span><div class="px-mut">${U.dateStr(h.end)} · ${dur(h.end - h.since)} · ${esc(h.reason)}</div></div><div class="r"><b class="num ${cls(h.pnl)}">${signed(h.pnl)}</b><span class="px-mut num">${sgnPct(h.pct)} on ${money(h.amt)}</span></div></div>`).join("") : empty("file", "No history yet")}`;
      mySigV = mySig();
      $("#mfs").onclick = e => { const b = e.target.closest("[data-mf]"); if (b){ mf = b.dataset.mf; renderMy(); } };
      $("#mps").onclick = e => { const b = e.target.closest("[data-p]"); if (b){ mp = +b.dataset.p; renderMy(); } };
    }
    function liveMy(){
      const st = cstate(), now = Date.now(), act = st.active.filter(c => !mf || c.mk === mf), setT = (el, v, c) => { if (!el) return; if (el.textContent !== v) el.textContent = v; if (c != null) el.className = el.className.replace(/\b(up|down)\b/g, "").trim() + " " + c; };
      const inv = act.reduce((a, c) => a + c.amt, 0), pl = act.reduce((a, c) => a + c.amt * copyPct(c, now) / 100, 0);
      setT($('[data-sm="inv"]'), money(inv)); setT($('[data-sm="val"]'), money(inv + pl)); setT($('[data-sm="pl"]'), signed(pl), cls(pl));
      act.forEach(c => { const el = r.querySelector(`.ax-my[data-cid="${c.id}"]`); if (!el) return; const pct = copyPct(c, now), pn = c.amt * pct / 100;
        setT(el.querySelector('[data-cv="pn"]'), signed(pn), cls(pn)); setT(el.querySelector('[data-cv="pc"]'), sgnPct(pct), cls(pn)); setT(el.querySelector('[data-cv="val"]'), money(c.amt + pn));
        ((c.mir && c.mir.open) || []).forEach(o => { const pe = el.querySelector(`[data-mp="${c.id}|${o.pid}"]`); if (!pe) return; const L = mirLive(c, o);
          const a = pe.querySelector('[data-f="pnl"]'); setT(a, sgn2(L.pnl), cls(L.pnl)); const b = pe.querySelector('[data-f="roi"],[data-f="tl"]'); if (b){ setT(b, L.bin ? (L.left != null ? clock(L.left) + " left" : (L.win ? "Winning" : "Losing")) : sgnPct(L.roi), cls(L.roi)); } }); });
      if (tick % 4 === 0){ const perf = myPerf(mp, mf); setT($("#mpn"), signed(perf.pnl), cls(perf.pnl)); setT($("#mpr"), sgnPct(perf.roi), cls(perf.roi)); const c = $("#mpc"); if (c) c.innerHTML = spark(perf.pts, 320, 110, perf.pnl >= 0 ? "var(--up)" : "var(--down)"); }
    }
    const show = () => { stopCar(); nav(); view === "my" ? renderMy() : view === "say" ? renderSay() : view === "how" ? renderHow() : renderPlaza(); };
    function liveList(){ if (view !== "plaza") return; const mk = mkOf();
      r.querySelectorAll(".ax-lc").forEach(el => { const l = leadById(el.dataset.ld); if (!l) return; const s = lstats(l, lp, mk), cells = cellsOf(l, s, mk), set = (k, v, c) => { const n = el.querySelector(`[data-k="${k}"]`); if (n){ if (n.textContent !== v) n.textContent = v; if (c != null) n.className = n.className.replace(/\b(up|down)\b/g, "").trim() + " " + c; } };
        set("roi", sgnPct(s.roi), cls(s.roi)); set("cn", fmt(l.f, 0)); cells.forEach(([a, b, c], i) => set("s" + i, b, c));
        const sp = el.querySelector('[data-k="spk"]'); if (sp) sp.innerHTML = spark(curve(l, lp, mk, 36), 130, 52, s.roi >= 0 ? "var(--up)" : "var(--down)"); }); }
    /* ---- trader detail + copy settings ---- */
    function detail(l, mk, focus){
      let dp = lp, mode = "fixed";
      const bal = () => store.wb(mk === "binary" ? "binary" : "futures");
      const ovTop = () => { const s = lstats(l, dp, mk);
        return `<div class="row" style="gap:12px;padding:2px 0 4px">${logoOfLead(l, 56)}<div class="grow"><div class="row" style="gap:2px"><b style="font-size:17px">${esc(l.name)}</b>${qBtn(`data-mq="${l.mid}"`, "About " + l.name)}</div><div class="px-mut">${esc(l.model)} by ${esc(l.maker)}</div><div class="px-mut mt">${ic("users", 13, 1.7)} <span class="num">${fmt(l.f, 0)}</span> copiers · <span class="px-tag">${mkName(mk)}</span> <span class="px-tag br">Bot</span></div></div></div>
        <div class="px-mut" style="font-size:12.5px;margin:4px 0 10px">${esc(l.style)}</div>
        <div class="px-seg ax-pseg" id="dseg">${PERS.map(([n, i]) => `<button data-p="${i}" class="${dp === i ? "on" : ""}">${n}</button>`).join("")}</div><div class="px-mut" style="margin-top:8px;font-size:12px">Trading since ${new Date(startOf(l)).toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"})}</div>
        <div class="px-grid3"><div><span>${PERS[dp][0]} ROI</span><b class="num ${cls(s.roi)}" style="font-size:20px">${sgnPct(s.roi)}</b></div><div><span>${PERS[dp][0]} PnL</span><b class="num ${cls(s.pnl)}">${s.pnl >= 0 ? "+" : "-"}$${fmt(Math.abs(s.pnl), 0)}</b></div><div><span>Win rate</span><b class="num">${s.wr.toFixed(1)}%</b></div>${mk === "binary" ? `<div><span>Trades/day</span><b class="num">${l.tpd}</b></div>` : `<div><span>Max drawdown</span><b class="num">${s.mdd.toFixed(1)}%</b></div>`}<div><span>AUM</span><b class="num">$${compact(s.aum)}</b></div>${mk === "binary" ? `<div><span>Avg. payout</span><b class="num">${l.pay}%</b></div>` : `<div><span>Avg. leverage</span><b class="num">${Math.round(l.levs.reduce((a, x) => a + x, 0) / l.levs.length)}x</b></div>`}</div>
        <div class="px-sec-h" style="margin:4px 0 0"><h2>ROI</h2><span class="px-mut"><i class="px-pulse"></i> Live</span></div><div class="px-big">${spark(curve(l, dp, mk, 60), 320, 110, s.roi >= 0 ? "var(--up)" : "var(--down)")}</div>`; };
      const form = `<div class="px-sec" id="pf" style="margin-top:12px"><div class="px-sec-h"><h2>Copy settings</h2><span class="px-mut">Avbl <b class="num" style="color:var(--text)">${money(bal())}</b> USDT</span></div>
        <div class="px-fld"><label>${setLbl("inv")}<span class="px-mut">Min 10 USDT</span></label><div class="px-inp" id="fi"><input id="inv" type="number" inputmode="decimal" value="${Math.min(500, Math.floor(bal() / 10) * 10 || 100)}"><span>USDT</span></div></div>
        <div class="px-chips" style="margin-bottom:14px">${[100, 500, 1000, 5000].map(v => `<button data-v="${v}">${fmt(v, 0)}</button>`).join("")}<button data-v="max">Max</button></div>
        <div class="px-fld"><label>${setLbl("mode")}</label><div class="px-seg" id="cm" style="display:flex"><button data-m="fixed" class="on" style="flex:1">Fixed amount</button><button data-m="ratio" style="flex:1">Fixed ratio</button></div></div>
        <div class="px-2c"><div class="px-fld"><label id="mvl"></label><div class="px-inp"><input id="mv" type="number" inputmode="decimal" value="50"><span id="mvu">USDT</span></div></div>
          <div class="px-fld"><label>${setLbl("max")}</label><div class="px-inp"><input id="mo" type="number" inputmode="decimal" value="250"><span>USDT</span></div></div></div>
        <div class="px-2c"><div class="px-fld"><label>${setLbl("sl")}</label><div class="px-inp"><input id="sl" type="number" inputmode="decimal" value="30" placeholder="Off"><span>%</span></div></div>
          <div class="px-fld"><label>${setLbl("tp")}</label><div class="px-inp"><input id="tp" type="number" inputmode="decimal" placeholder="Off"><span>%</span></div></div></div>
        <div class="px-notice" style="margin-bottom:12px">${ic("info", 14)}<span>Past performance does not guarantee future results. Copying may be closed automatically when your stop-loss or take-profit is reached.</span></div>
        <div class="px-err" id="fe"></div><button class="px-btn pri blk lg" id="go">Start Copying</button></div>`;
      const tstr = t => new Date(t).toLocaleString("en-US", {month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false});
      const fresh = t => Date.now() - t < 20000 ? " fresh" : "";
      const agoS = t => { const sec = Math.max(0, Math.round((Date.now() - t) / 1000)); return sec < 60 ? sec + "s ago" : dur(Date.now() - t) + " ago"; };
      const tag = p => `<span class="px-tag ${p.long ? "up" : "dn"}">${p.bin ? (p.long ? "Up" : "Down") : (p.long ? "Long " : "Short ") + p.lev + "x"}</span>`;
      const secH = (t, n, live) => `<div class="px-sec-h" style="margin:4px 0 8px"><h2>${t}${n != null ? " (" + n + ")" : ""}</h2>${live ? `<span class="px-mut"><i class="px-pulse"></i> Live</span>` : ""}</div>`;
      const histRows = () => { const N = histCount(l), sim = ((window.SIM && SIM.closed(l.id, 60)) || []).slice(0, N), out = sim.slice(), st0 = startOf(l), now = Date.now();
        let ct = out.length ? out[out.length - 1].t : now; const span = Math.max(DAYMS * .5, ct - st0), k = N - out.length, gapAvg = span / Math.max(1, k + 1);
        for (let i = out.length; i < N; i++){
          const rg = rngFor("hx" + l.id + i), bin = mk === "binary" || l.bin, sym = rg() < .65 ? l.sym : POPS[Math.floor(rg() * 6)], p = M.get(sym), base = p?.price || PRICE_FB[baseOf(sym)] || 100;
          ct -= gapAvg * (.4 + rg() * 1.2); const du = bin ? (60 + rg() * 840) * 1e3 : (20 + rg() * 700) * 6e4, long = rg() > .42;
          if (bin){ const win = rg() < l.wr / 100, margin = [10, 20, 25, 50, 100, 150][Math.floor(rg() * 6)], pay = l.pay || 85, pnl = win ? margin * pay / 100 : -margin, entry = base * (1 + (rg() - .5) * .03);
            out.push({sym, long, lev: 0, entry, exit: entry * (1 + (win === long ? 1 : -1) * rg() * .002), margin, t: ct - du, ct, pnl, roi: pnl / margin * 100, bin: 1, pay}); continue; }
          const lev = l.levs[Math.floor(rg() * l.levs.length)], margin = Math.round((120 + rg() * 2400) / 10) * 10, win = rg() < Math.min(.9, l.wr / 100), roi = win ? (1 + rg() * rg() * 28) : -(1 + rg() * 14), entry = base * (1 + (rg() - .5) * .05), mv = roi / 100 / lev * (long ? 1 : -1);
          out.push({sym, long, lev, entry, exit: entry * (1 + mv), margin, t: ct - du, ct, pnl: margin * roi / 100, roi, bin: 0}); }
        return out; };
      const histHtml = () => { const cl = histRows();
        return `<div class="px-sec">${secH("Trade history", cl.length, true)}${cl.length ? cl.map(c => `<div class="px-pos hist${fresh(c.ct)}">${symIcon(c.sym, 28)}<div class="grow"><b>${esc(symLabel(c.sym))}</b> ${tag(c)}<div class="px-mut num">${tstr(c.t)} to ${tstr(c.ct)}</div><div class="px-mut num">${mk === "binary" ? "Stake " + money(c.margin) + " USDT" : "Entry " + symPx(c.sym, c.entry) + " · Close " + symPx(c.sym, c.exit)}</div></div><b class="num ${cls(c.pnl)}" style="font-size:13px;text-align:right">${c.pnl >= 0 ? "+" : "-"}${money(Math.abs(c.pnl))}<br><span style="font-weight:600;font-size:11px">${mk === "binary" ? (c.pnl > 0 ? "Win" : "Loss") : sgnPct(c.roi)}</span></b></div>`).join("") + `<div class="px-endnote">You can only see the latest ${cl.length} trades. Older history is not available.</div>` : empty("file", "No closed positions yet")}</div>`; };
      const recHtml = () => { const fd = (window.SIM && SIM.feed(l.id, 30)) || [];
        return `<div class="px-sec">${secH("Latest records", null, true)}${fd.length ? fd.map(f => `<div class="px-rec${fresh(f.t)}"><i class="d ${f.tp === "o" ? "o" : f.pnl >= 0 ? "up" : "dn"}"></i><div class="grow"><span>${esc(f.txt)}</span><div class="px-mut">${agoS(f.t)}</div></div></div>`).join("") : empty("clock", "No records yet")}</div>`; };
      const livePos = () => { const ps = openPositions(l) || [];
        return secH("Current positions", ps.length, true) + (ps.length ? ps.map(p => {
          if (p.bin){ const win = (p.mark - p.entry) * (p.long ? 1 : -1) > 0;
            return `<div class="px-pos${fresh(p.t)}">${symIcon(p.sym, 28)}<div class="grow"><b>${esc(symLabel(p.sym))}</b> ${tag(p)}<div class="px-mut num">Stake ${money(p.margin)} USDT · Payout ${p.pay}% · Entry ${symPx(p.sym, p.entry)}</div></div><b class="num ${win ? "up" : "down"}" style="font-size:13px;text-align:right">${win ? "Winning" : "Losing"}<br><span style="font-weight:600;font-size:11px" class="num">${clock(p.maxT - Date.now())} left</span></b></div>`; }
          const qq = posPnl(p);
          return `<div class="px-opn${fresh(p.t)}"><div class="h">${symIcon(p.sym, 28)}<div class="grow"><b>${esc(symLabel(p.sym))}</b> ${tag(p)}<div class="px-mut">Opened ${agoS(p.t)}</div></div><div class="r"><b class="num ${cls(qq.pnl)}">${(qq.pnl >= 0 ? "+" : "") + fmt(qq.pnl, 2)}</b><span class="num ${cls(qq.roi)}">${sgnPct(qq.roi)}</span></div></div>
          <div class="g"><div><span>Size</span><b class="num">${symQty(p.size)}</b></div><div><span>Entry</span><b class="num">${symPx(p.sym, p.entry)}</b></div><div><span>Mark</span><b class="num">${symPx(p.sym, p.mark)}</b></div></div></div>`; }).join("") : empty("clock", "No open positions right now")); };
      let dtab = "ov", liv = null, lsn = 0; const stopLive = () => { if (liv){ clearInterval(liv); liv = null; } };
      if (window.SIM) SIM.watch(l.id);
      U.sheet(l.name, `<div class="px-tabs" id="dtabs" style="margin-bottom:12px">${[["ov", "Overview"], ["pos", "Positions"], ["hist", "History"], ["rec", "Records"]].map(([k, n]) => `<button data-t="${k}" class="${k === "ov" ? "on" : ""}">${n}</button>`).join("")}</div>
        <div id="t-ov"><div id="dbody">${ovTop()}</div>${form}</div><div id="t-pos" hidden></div><div id="t-hist" hidden></div><div id="t-rec" hidden></div>`, el => {
        const qs = s => el.querySelector(s);
        const paint = k => { const t = qs("#t-" + k); if (t) t.innerHTML = k === "pos" ? livePos() : k === "hist" ? histHtml() : recHtml(); };
        const refresh = () => { if (!qs("#t-pos") || !qs("#t-pos").isConnected) return stopLive(); lsn++; if (window.SIM) SIM.watch(l.id); if (dtab === "ov"){ if (lsn % 4 === 0 && !el.querySelector("#inv:focus")) redraw(); } else paint(dtab); };
        qs("#dtabs").onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; dtab = b.dataset.t; qs("#dtabs").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
          ["ov", "pos", "hist", "rec"].forEach(k => qs("#t-" + k).hidden = k !== dtab); if (dtab !== "ov") paint(dtab); };
        liv = setInterval(refresh, 1000);
        const redraw = () => { qs("#dbody").innerHTML = ovTop(); qs("#dseg").onclick = segClick; };
        const segClick = e => { const b = e.target.closest("[data-p]"); if (b){ dp = +b.dataset.p; redraw(); } };
        qs("#dseg").onclick = segClick;
        el.addEventListener("click", e => { const t = e.target.closest("[data-st]"); if (t){ setTip(t.dataset.st); return; } const m = e.target.closest("[data-mq]"); if (m) modelTip(m.dataset.mq, mk); });
        const sync = () => { qs("#mvl").innerHTML = mode === "fixed" ? setLbl("per", "", mk === "binary" ? "Stake per trade" : "Margin per order") : setLbl("ratio"); qs("#mvu").textContent = mode === "fixed" ? "USDT" : "x"; };
        qs("#cm").onclick = e => { const b = e.target.closest("[data-m]"); if (!b) return; mode = b.dataset.m; qs("#cm").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); qs("#mv").value = mode === "fixed" ? Math.max(1, Math.round((parseFloat(qs("#inv").value) || 100) / 10)) : 1; sync(); };
        qs("#pf .px-chips").onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; const v = b.dataset.v === "max" ? Math.floor(bal()) : +b.dataset.v; qs("#inv").value = v; if (mode === "fixed") qs("#mv").value = Math.max(1, Math.round(v / 10)); qs("#mo").value = Math.round(v / 2); };
        qs("#inv").oninput = () => { const v = parseFloat(qs("#inv").value) || 0; if (mode === "fixed") qs("#mv").value = Math.max(1, Math.round(v / 10)); qs("#mo").value = Math.round(v / 2); };
        sync();
        if (focus) setTimeout(() => qs("#pf")?.scrollIntoView({block: "start"}), 360);
        qs("#go").onclick = async () => {
          const inv = parseFloat(qs("#inv").value), mv = parseFloat(qs("#mv").value), mo = parseFloat(qs("#mo").value), sl = qs("#sl").value === "" ? 0 : parseFloat(qs("#sl").value), tp = qs("#tp").value === "" ? 0 : parseFloat(qs("#tp").value);
          const err = !(inv >= 10) ? "Minimum investment is 10 USDT." : inv > bal() ? "Insufficient " + (mk === "binary" ? "Binary" : "Futures") + " balance" : inv > 100000 ? "Maximum investment is 100,000 USDT." : !(mv > 0) ? "Enter the copy " + (mode === "fixed" ? "amount per order." : "ratio.") : (mode === "fixed" && mv > inv) ? "Per-order amount cannot exceed your investment." : (mode === "ratio" && mv > 10) ? "Maximum copy ratio is 10x." : !(mo > 0) ? "Enter the maximum per order." : (qs("#sl").value !== "" && !(sl >= 1 && sl <= 90)) ? "Stop-loss must be between 1% and 90%." : (qs("#tp").value !== "" && !(tp >= 1)) ? "Take-profit must be at least 1%." : "";
          qs("#fe").textContent = err; if (err) return;
          const ok = await U.confirmTrade({kind: "market", title: "Confirm Copy Trading", okText: "Start Copying", tone: "primary", rows: [
            ["AI model", `${esc(l.name)} (${esc(l.model)})`], ["Market", mk === "binary" ? "Binary (Up/Down)" : "Perp (Futures)"], ["Investment", `${money(inv)} USDT`], ["Copy mode", mode === "fixed" ? `Fixed amount, ${fmt(mv, 2)} USDT` : `Fixed ratio, ${fmt(mv, 2)}x`],
            ["Max per order", `${money(mo)} USDT`], ["Stop-loss", sl ? `-${sl}%` : "Off"], ["Take-profit", tp ? `+${tp}%` : "Off"]]});
          if (!ok) return;
          if (inv > bal() + 1e-9){ toast("Insufficient " + (mk === "binary" ? "Binary" : "Futures") + " balance", "bad"); UI.walletErr("Insufficient " + (mk === "binary" ? "Binary" : "Futures") + " balance"); return; }
          cstate().active.unshift(newCopy(l, {mk, amt: inv, mode: mk === "binary" ? "binary" : mode, sizing: mode, modeVal: mv, maxOrder: mo, sl, tp}));
          store.addWallet(mk === "binary" ? "binary" : "futures", -inv, "copy"); store.save();
          store.notify("Copy trading started", `Copying ${l.name} with ${money(inv)} USDT`, "ok"); U.fx("open"); toast("Copy trading started", "ok");
          U.closeLayer(); view = "my"; show(); window.scrollTo(0, 0);
        };
      }, stopLive);
    }

    r.addEventListener("click", async e => {
      const T = s => e.target.closest(s);
      const mq = T("[data-mq]"); if (mq){ e.stopPropagation(); modelTip(mq.dataset.mq, mq.dataset.mk || mkOf()); return; }
      const st = T("[data-st]"); if (st){ setTip(st.dataset.st); return; }
      if (T("[data-how]") || T("[data-sl]")){ view = "how"; show(); window.scrollTo(0, 0); return; }
      const lv = T("[data-live]"); if (lv){ location.hash = "#/futures/" + lv.dataset.live; return; }
      const lk = T("[data-lk]"); if (lk){ const s = CMS(), id = lk.dataset.lk; if (s.pl[id]) delete s.pl[id]; else s.pl[id] = 1; cmSave(s); const f = feedMap.get(id); lk.classList.toggle("on", !!s.pl[id]); lk.setAttribute("aria-pressed", !!s.pl[id]); if (f) lk.querySelector(".num").textContent = likeCnt(f.p); return; }
      const cb = T("[data-cmb]"); if (cb){ const f = feedMap.get(cb.dataset.cmb); if (f) commentsSheet(f.p, () => { const n = r.querySelector(`.ax-post[data-pid="${f.p.id}"] .ax-cc`); if (n) n.textContent = countOf(f.p); }); return; }
      const sh = T("[data-sh]"); if (sh){ const f = feedMap.get(sh.dataset.sh); if (f) shareText(f.p); return; }
      const ed = T("[data-edit]"); if (ed){ const c = cstate().active.find(x => x.id === ed.dataset.edit); if (c) editCopySheet(c, c.mk, () => { nav(); renderMy(); }); return; }
      const tpb = T("[data-mtp]"); if (tpb){ const [cid, pid] = tpb.dataset.mtp.split("|"), c = cstate().active.find(x => x.id === cid), o = c && c.mir && c.mir.open.find(x => x.pid === pid); if (o) editPosSheet(c, o, () => renderMy()); return; }
      const mc = T("[data-mcl]"); if (mc){ const [cid, pid] = mc.dataset.mcl.split("|"), c = cstate().active.find(x => x.id === cid), o = c && c.mir && c.mir.open.find(x => x.pid === pid); if (!o) return; const L = mirLive(c, o);
        const ok = await U.confirmBox(o.bin ? "Sell early?" : "Close position?", o.bin ? `${symLabel(o.sym)} ${o.long ? "Up" : "Down"}: selling early gives an estimated ${sgn2(L.est)} USDT instead of waiting for expiry.` : `Close ${symLabel(o.sym)} ${o.long ? "Long" : "Short"} ${o.lev}x at market now. Estimated PnL ${sgn2(L.est)} USDT.`, o.bin ? "Sell" : "Close", true);
        if (!ok) return; const x = window.SIM && SIM.closeMirPos(cid, pid, "Manual"); if (!x){ toast("Position already closed", "info"); renderMy(); return; }
        U.fx("close"); toast(`Position closed: ${sgn2(x.pnl)} USDT`, x.pnl >= 0 ? "ok" : "bad"); renderMy(); return; }
      const sp = T("[data-stop]"); if (sp){ const c = cstate().active.find(x => x.id === sp.dataset.stop); if (!c) return;
        if (await U.confirmBox("Stop copying?", `Your investment plus PnL (${signed(c.amt * copyPct(c) / 100)} USDT) returns to your balance and ${c.name}'s trades are no longer copied.`, "Stop", true)){
          if (!cstate().active.find(x => x.id === c.id)) return; const x = stopCopy(c); toast(`Copy stopped: ${signed(x.pnl)} USDT`, x.pnl >= 0 ? "ok" : "bad"); nav(); renderMy(); } return; }
      if (T("[data-find]")){ view = "plaza"; show(); return; }
      const sv = T("[data-sv]"); if (sv){ view = sv.dataset.sv; if (view === "say" && seg !== "perp") seg = "perp"; show(); window.scrollTo(0, 0); return; }
      if (T("[data-sq]")){ view = "plaza"; showQ = !showQ; if (!showQ) q = ""; show(); if (showQ) $("#tq")?.focus(); return; }
      if (T("[data-menu]")){ U.sheet("Copy Trading", `<button class="px-opt" data-m="my">My copying${ic("chev", 16)}</button>${seg === "perp" ? `<button class="px-opt" data-m="say">Community${ic("chev", 16)}</button>` : ""}<button class="px-opt" data-m="how">How copy bots work${ic("chev", 16)}</button><div class="px-notice" style="margin-top:12px">${ic("info", 14)}<span>Past performance does not guarantee future results. Trader stats are illustrative.</span></div>`, el => el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { U.closeLayer(); view = b.dataset.m; show(); window.scrollTo(0, 0); })); return; }
      const c = T("[data-cp]"), d = T("[data-ld]"); if (c || d){ const l = leadById((c || d).dataset[c ? "cp" : "ld"]); if (l) detail(l, l.bin ? "binary" : "futures", !!c); }
    });
    r.addEventListener("keydown", e => { if (e.key === "Enter"){ const d = e.target.closest && e.target.closest(".ax-lc"); if (d && e.target === d) d.click(); } });
    migrateOld(); show();
    if (openId) setTimeout(() => { const l = leadById(openId); if (l) detail(l, l.bin ? "binary" : "futures", false); }, 60);
    checkCopies();
    const iv = setInterval(() => { if (!r.isConnected) return; tick++; if (tick % 2 === 0) checkCopies();
      if (view === "my"){ if (document.querySelector("#sheet.show")) return; if (mySig() !== mySigV){ nav(); renderMy(); } else liveMy(); }
      else if (view === "say") liveSay(); else if (view === "plaza" && tick % 2 === 0) liveList();
      if (tick % 4 === 0) nav(); }, 1500);
    this.unmount = () => { clearInterval(iv); stopCar(); sayTok++; document.querySelectorAll(".ax-ovl").forEach(x => x.remove()); };
  }};
};
})();
