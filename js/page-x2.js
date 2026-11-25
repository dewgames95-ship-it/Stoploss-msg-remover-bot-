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
const NAMES = c => c === "USDT" ? "TetherUS" : (window.COIN_NAMES && window.COIN_NAMES[c]) || c;
function spotHoldings(){
  try { const h = window.SPOT?.holdings?.() || []; return (Array.isArray(h) ? h : []).map(x => {
    const coin = String(x.coin || x.base || x.asset || x.symbol || x.sym || "").replace(/USDT$/, "").toUpperCase(), amt = +(x.amount ?? x.qty ?? x.free ?? x.balance ?? 0), m = M.get(coin + "USDT"), px = m?.price ?? +x.price ?? 0, val = +(x.value ?? amt * px), chg = m?.chg ?? 0;
    return {coin, amt, val, pnl: val - val / (1 + chg / 100), pct: chg}; }).filter(x => x.coin && x.amt > 0); } catch { return []; }
}
const copyNow = () => cstate().active.reduce((a, c) => a + c.amt * (1 + copyPct(c) / 100), 0);
Pages.assets = (params) => {
  let tab = params[0] || "overview"; if (tab === "binary") tab = "spot"; if (tab === "funding") tab = "fund"; if (tab === "copying") tab = "copy";
  let view = "crypto", q = "", showQ = false, sortBy = "value";
  const TABS = [["overview","Overview"],["fund","Fund"],["spot","Spot"],["futures","Futures"],["copy","Copy"],["earn","Earn"]];
  const html = `<div class="px-page px-as"><div class="px-tabs" id="atabs">${TABS.map(([k,n]) => `<button data-at="${k}" class="${tab===k?"on":""}">${n}</button>`).join("")}</div><div id="ab"></div></div>`;
  function totals(){
    const s = S(), bin = s.positions.reduce((a,p) => a + p.amount, 0), fm = s.fut.positions.reduce((a,p) => a + p.margin, 0) + s.fut.orders.reduce((a,o) => a + o.margin + o.fee, 0);
    const up = s.fut.positions.reduce((a,p) => a + E.futPnl(p).pnl, 0), vault = E.earnValue(), hold = spotHoldings(), hv = hold.reduce((a,x) => a + x.val, 0), hp = hold.reduce((a,x) => a + x.pnl, 0);
    const act = cstate().active, cv = act.reduce((a,c) => a + c.amt * (1 + copyPct(c) / 100), 0), cinv = act.reduce((a,c) => a + c.amt, 0);
    const d0 = new Date().setHours(0,0,0,0), usdtPnl = E.stats().todayPnl + s.fut.history.filter(x => x.closed >= d0).reduce((a,x) => a + x.profit, 0) + up;
    const fut = fm + up, total = s.balance + bin + fut + vault + hv + cv;
    return {fund:s.balance, bin, fm, up, fut, vault, hold, hv, hp, cv, cinv, cpn: cv - cinv, usdtPnl, tp: usdtPnl + hp, total, spot: bin + hv};
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
  const txList = list => list.length ? list.map(x => { const dep = x.kind === "deposit";
      return `<div class="px-row"><span class="px-ico n">${ic(dep ? "down" : "up",16)}</span><div class="grow"><b>${dep ? "Deposit" : "Transfer"} ${esc(x.coin || "USDT")}</b><div class="px-mut">${U.dateStr(x.t)} · ${esc(x.method || "")}</div></div><div class="r"><b class="num ${dep?"up":""}">${dep?"+":""}${fmt(x.coinAmt ?? x.amount, x.coinAmt ? 6 : 2)}</b><span class="px-mut">Completed</span></div></div>`; }).join("") : empty("file","No transactions yet");
  /* rows: {coin, amt, val, pnl, sub} */
  function rowsFor(t){
    const usdt = (val, sub, pnl, amt) => ({coin:"USDT", amt: amt ?? val, val, pnl, sub});
    const hold = t.hold.map(x => ({coin:x.coin, amt:x.amt, val:x.val, pnl:x.pnl, sub:null}));
    if (tab === "fund") return [usdt(t.fund, "Trading balance", 0)];
    if (tab === "spot") return [...hold, ...(t.bin > 0 ? [usdt(t.bin, "Open binary stake", 0)] : [])];
    if (tab === "futures") return [usdt(t.fut, "Margin + unrealized PnL", t.up)];
    if (tab === "copy") return [usdt(t.cv, "Copy trading", t.cpn)];
    if (tab === "earn") return [usdt(t.vault, "Flexible vault", 0)];
    return [usdt(t.fund + t.bin + t.fut + t.cv + t.vault, "Fund, Futures, Copy, Earn", t.usdtPnl + t.cpn), ...hold];
  }
  const coinRow = (x, H) => { const base = x.val - x.pnl, pc = base > 0 ? x.pnl / base * 100 : 0;
    return `<div class="px-coin">${UI.coinImg(x.coin, 38)}<div class="grow"><b>${esc(x.coin)}</b><div class="px-mut">${esc(x.sub || NAMES(x.coin))}</div></div><div class="r"><b class="num">${H(fmt(x.amt, x.coin === "USDT" ? 2 : 6))}</b><span class="px-mut num">${H("$" + money(x.val))}</span></div>
      <div class="pl"><span>Today's PnL</span><b class="num ${cls(x.pnl)}">${H(sgnUsd(x.pnl) + " (" + sgnPct(pc) + ")")}</b></div></div>`; };
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
    const have = c => c === "USDT" ? S().balance : (H.find(h => h.coin === c)?.avail || 0);
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
        if (f === "USDT") store.setBalance(S().balance - v, "convert");
        else { const h = sp.hold[f], ac = h.cost / h.qty, q = Math.min(v, h.qty); h.cost = Math.max(0, h.cost - ac * q); h.qty -= q; if (h.qty < 1e-9) delete sp.hold[f];
          usdt *= 0.999; sp.history.unshift({id:U.uid(), sym:f + "USDT", side:"sell", price:px(f), qty:q, fee:q * px(f) * 0.001, ts:Date.now(), type:"convert"}); }
        if (t === "USDT") store.setBalance(S().balance + usdt, "convert");
        else { const q = usdt / px(t) * 0.999, h = sp.hold[t] ||= {qty:0, cost:0}; h.qty += q; h.cost += usdt;
          sp.history.unshift({id:U.uid(), sym:t + "USDT", side:"buy", price:px(t), qty:usdt / px(t), fee:usdt * 0.001, ts:Date.now(), type:"convert"}); }
        sp.history = sp.history.slice(0, 200);
        store.save(); bus.emit("spot"); U.fx("claim"); U.closeLayer();
        toast(`Converted ${fmt(v, f === "USDT" ? 2 : 6)} ${f} to ${fmt(recv(v), t === "USDT" ? 2 : 6)} ${t}`, "ok"); done && done();
      };
      sync();
    });
  }
  function render(r){
    const s = S(), t = totals(), hide = !!s.settings.hideBal, H = v => hide ? "******" : v, box = r.querySelector("#ab");
    const label = {overview:"Total Assets", fund:"Fund Account", spot:"Spot Account", futures:"Futures Account", copy:"Copy Trading", earn:"Earn Account"}[tab];
    const val = {overview:t.total, fund:t.fund, spot:t.spot, futures:t.fut, copy:t.cv, earn:t.vault}[tab];
    const pnl = {overview:t.tp, fund:null, spot:t.hp, futures:t.up, copy:t.cpn, earn:null}[tab];
    const pc = pnl == null ? 0 : pnl / Math.max(1, val - pnl) * 100;
    const acts = `<div class="px-acts"><a href="#/deposit" class="pri"><span>${ic("down",24,1.8)}</span>Deposit</a><a href="#/withdraw"><span>${ic("up",24,1.8)}</span>Withdraw</a><button data-xfer><span>${ic("swap",24,1.8)}</span>Transfer</button><button data-conv><span>${ic("reset",24,1.8)}</span>Convert</button></div>`;
    const promo = `<a class="px-promo" href="#/earn"><div class="tx"><b>Earn up to 12% APR on USDT</b><span>Flexible and locked plans, redeem anytime</span></div>${ART.coins(84)}<i class="arr">${ic("chev",14,2)}</i></a>`;
    let body = "";
    if (tab === "overview" && view === "account"){
      const parts = [["Fund","fund",t.fund,"#2E6BFF"],["Spot","spot",t.spot,"#7FA6FF"],["Futures","futures",Math.max(0,t.fut),"#5B6575"],["Copy Trading","copy",t.cv,"#A8B3C4"],["Earn","earn",t.vault,"#D3D9E2"]], sum = parts.reduce((a,p) => a + p[2], 0) || 1;
      body = `<div class="px-alloc">${parts.filter(p => p[2] > 0).map(p => `<i style="flex:${p[2]/sum};background:${p[3]}"></i>`).join("")}</div>
        ${parts.map(([n,k,v,c]) => `<button class="px-acc" data-go="${k}"><i style="background:${c}"></i><div class="grow"><b>${n}</b><span class="px-mut">${hide ? "**" : (v/sum*100).toFixed(1) + "% of total"}</span></div><div class="r"><b class="num">${H(money(v))}</b><span class="px-mut">USDT</span></div><span class="ch">${ic("chev",14)}</span></button>`).join("")}`;
    } else {
      let rows = rowsFor(t); if (s.settings.hideSmall) rows = rows.filter(x => x.val >= 1);
      if (q) rows = rows.filter(x => (x.coin + NAMES(x.coin)).toUpperCase().includes(q.toUpperCase()));
      rows.sort(sortBy === "name" ? (a,b) => a.coin.localeCompare(b.coin) : sortBy === "pnl" ? (a,b) => b.pnl - a.pnl : (a,b) => b.val - a.val);
      body = (tab === "overview" ? `<div class="px-chips2"><div class="px-chip-g"><button data-v="crypto" class="on">Crypto</button><button data-v="account">Account</button></div><span class="sp"></span><button class="icon-btn" data-sq aria-label="Search">${ic("search",18,1.7)}</button><button class="icon-btn" data-filter aria-label="Sort">${ic("sort",18,1.7)}</button></div>` : "")
        + (showQ ? `<label class="px-search" style="margin:0 0 8px">${ic("search",16)}<input id="aq" value="${esc(q)}" placeholder="Search coins" autocomplete="off" aria-label="Search coins"></label>` : "")
        + `<label class="px-chk" style="margin:4px 0"><input type="checkbox" data-small ${s.settings.hideSmall ? "checked" : ""}><span>Hide small balances</span></label>`
        + (rows.length ? rows.map(x => coinRow(x, H)).join("") : empty("wallet", s.settings.hideSmall ? "No balances above 1 USDT" : "No assets"));
      if (tab === "spot") body += `<a class="px-btn blk" style="margin-top:12px" href="#/trade">Trade</a>`;
      if (tab === "futures") body += `<div class="px-sec"><div class="px-sec-h"><h2>Position history</h2><a href="#/history">All</a></div>${s.fut.history.length ? UI.historyHtml(s.fut.history.slice(0, 5)) : empty("file","No closed positions")}</div>`;
      if (tab === "copy"){ const act = cstate().active; body += `<div class="px-sec-h" style="margin-top:14px"><h2>Active copies (${act.length})</h2><a href="#/copy/my">My data</a></div>` + (act.length ? act.map(c => { const p = copyPct(c), pn = c.amt * p / 100; return `<a class="px-row" href="#/copy/my">${ART.avatar(c.lid, 36)}<div class="grow"><b>${esc(c.name)}</b><div class="px-mut">Invested ${H(money(c.amt))} USDT</div></div><div class="r"><b class="num ${cls(pn)}">${H(signed(pn))}</b><span class="px-mut num">${H(sgnPct(p))}</span></div></a>`; }).join("") : empty("users","No active copies")) + `<a class="px-btn pri blk" style="margin-top:12px" href="#/copy">Find traders</a>`; }
      if (tab === "earn") body += `<a class="px-btn pri blk" style="margin-top:12px" href="#/earn">Go to Earn</a>`;
      if (tab === "fund" || tab === "overview") body += `<div class="px-sec"><div class="px-sec-h"><h2>Recent transactions</h2><a href="#/history">Trade history</a></div>${txList(s.tx.slice(0, tab === "fund" ? 20 : 5))}</div>`;
    }
    box.innerHTML = `<div class="px-ah"><div class="top"><div class="lb">${label}<button data-eye aria-label="${hide ? "Show" : "Hide"} balance">${ic(hide?"eyeoff":"eye",16)}</button></div><span class="sp"></span><button class="icon-btn" data-pnl aria-label="PnL analysis">${ic("chart",20,1.7)}</button><a class="icon-btn" href="#/history" aria-label="History">${ic("clockh",20,1.7)}</a></div>
      <div class="big num">${H(money(val))}<small>USDT ${ic("chevd",12,2)}</small></div><div class="eq num">${H("≈ $" + money(val))}</div>
      ${pnl != null ? `<button class="pl" data-pnl>Today's PnL <b class="num ${cls(pnl)}">${H(sgnUsd(pnl) + " (" + sgnPct(pc) + ")")}</b>${ic("chev",12,2)}</button>` : ""}</div>${acts}${promo}<div id="alist">${body}</div>`;
    box.querySelectorAll("[data-xfer]").forEach(b => b.onclick = () => transferSheet(() => render(r)));
    box.querySelectorAll("[data-conv]").forEach(b => b.onclick = () => convertSheet(() => render(r)));
    box.querySelectorAll("[data-eye]").forEach(b => b.onclick = () => { s.settings.hideBal = !s.settings.hideBal; store.save(); render(r); });
    box.querySelectorAll("[data-pnl]").forEach(b => b.onclick = () => { if (window.Pages && Pages.pnl) location.hash = "#/pnl"; else pnlSheet(t); });
    const sm = box.querySelector("[data-small]"); if (sm) sm.onchange = () => { s.settings.hideSmall = sm.checked; store.save(); render(r); };
    box.querySelectorAll("[data-v]").forEach(b => { b.classList.toggle("on", b.dataset.v === view); b.onclick = () => { view = b.dataset.v; render(r); }; });
    box.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { tab = b.dataset.go; r.querySelectorAll("[data-at]").forEach(x => x.classList.toggle("on", x.dataset.at === tab)); render(r); });
    const sq = box.querySelector("[data-sq]"); if (sq) sq.onclick = () => { showQ = !showQ; if (!showQ) q = ""; render(r); if (showQ) r.querySelector("#aq")?.focus(); };
    const aq = box.querySelector("#aq"); if (aq) aq.oninput = () => { q = aq.value; const p = aq.selectionStart; render(r); const n = r.querySelector("#aq"); if (n){ n.focus(); n.setSelectionRange(p, p); } };
    const fl = box.querySelector("[data-filter]"); if (fl) fl.onclick = () => U.sheet("Sort by", [["value","Value (high to low)"],["pnl","Today's PnL"],["name","Name (A-Z)"]].map(([k,n]) => `<button class="px-opt ${sortBy===k?"on":""}" data-k="${k}">${n}${sortBy===k ? ic("check",18,2) : ""}</button>`).join(""), el => el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { sortBy = b.dataset.k; U.closeLayer(); render(r); }));
  }
  return {html, title:"Assets", mount(r){
    render(r);
    r.querySelectorAll("[data-at]").forEach(b => b.onclick = () => { tab = b.dataset.at; r.querySelectorAll("[data-at]").forEach(x => x.classList.toggle("on", x===b)); q = ""; showQ = false; render(r); });
    const iv = setInterval(() => { if (r.isConnected && document.activeElement?.id !== "aq") render(r); }, 4000), offs = [bus.on("balance", () => { if (document.activeElement?.id !== "aq") render(r); })];
    this.unmount = () => { clearInterval(iv); offs.forEach(f => f()); };
  }};
};

/* ======================= DEPOSIT ======================= */
const NETS = {
  USDT:[["BSC","BNB Smart Chain (BEP20)","bnb",0.01,1],["TRX","Tron (TRC20)","trx",0.01,1],["ETH","Ethereum (ERC20)","eth",0.001,2],["POL","Polygon POS","pol",0.02,1],["SOL","Solana","sol",0.001,1],["ARBITRUM","Arbitrum One","arb",0.01,1],["OPTIMISM","Optimism","op",0.01,1]],
  BTC:[["BTC","Bitcoin","btc",0.00006,10],["BSC","BNB Smart Chain (BEP20)","bnb",0.000001,1]],
  ETH:[["ETH","Ethereum (ERC20)","eth",0.000001,2],["ARBITRUM","Arbitrum One","arb",0.000001,1],["OPTIMISM","Optimism","op",0.000001,1],["BSC","BNB Smart Chain (BEP20)","bnb",0.000001,1]],
  BNB:[["BSC","BNB Smart Chain (BEP20)","bnb",0.00001,1]], SOL:[["SOL","Solana","sol",0.001,1]], TRX:[["TRX","Tron (TRC20)","trx",0.1,1]]
};
const netsFor = c => NETS[c] || [["BSC","BNB Smart Chain (BEP20)","bnb",0.01,1],[c,(window.COIN_NAMES[c] || c) + " Network",c.toLowerCase(),0.01,2]];
const coinIcon = (c, size=36) => UI.coinImg(c, size);
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
    ${netsFor(coin).map(([k,n,ico,min,eta]) => `<a class="px-net" href="#/deposit/${coin}/${k}">${coinIcon(ico.toUpperCase(), 32)}<div class="grow"><div class="tt">${k}<small>${esc(n)}</small></div><div class="mm">Min. deposit ${min} ${esc(coin)} · ~${eta} min</div></div><span style="color:var(--muted)">${ic("chev",16)}</span></a>`).join("")}
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
      <div class="px-kv"><span>Minimum deposit</span><b class="num">${nd[3]} ${esc(coin)}</b></div>
      <div class="px-kv"><span>Credited after</span><b>1 confirmation</b></div>
      <div class="px-kv"><span>Estimated arrival</span><b>~${nd[4]} min</b></div></div>
    <div class="px-notice" style="margin-top:14px">${ic("info",14)}<span>This is a paper-trading address. Use the Deposit button below to add demo funds instantly. Do not send real crypto to it.</span></div>
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
          const e = !(v > 0) ? "Please enter the amount." : v < nd[3] ? `Minimum deposit is ${nd[3]} ${coin}.` : !px ? "Price unavailable. Try again shortly." : usd > 1000000 ? "Maximum 1,000,000 USDT per deposit." : "";
          if (e){ el.querySelector("#de").textContent = e; return; }
          U.closeLayer();
          const box = r.querySelector("#pend"), id = U.uid();
          box.innerHTML = `<div class="px-row" style="margin-top:8px"><span class="px-ico">${ic("clock",16)}</span><div class="grow"><b>Deposit pending</b><div class="px-mut" id="pc">${fmt(v,6)} ${coin} · 0/1 confirmations</div></div><div class="spin"></div></div>`;
          setTimeout(() => { const pc = r.querySelector("#pc"); if (pc) pc.textContent = `${fmt(v,6)} ${coin} · 1/1 confirmations`; }, 1800);
          setTimeout(() => {
            S().tx.unshift({id, kind:"deposit", amount:usd, coin, coinAmt:v, method: net + " network", t:Date.now()});
            store.setBalance(S().balance + usd, "deposit");
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


/* ======================= COPY TRADING ======================= */
const CAP = 2000;
/* [id, nickname, style, symbol, roi[7D,30D,90D], pnl30, winRate, maxDD, aum, followers, tradingDays] */
const LEADS = [
  ["l1","CryptoWhale_88","BTC trend, low drawdown","BTCUSDT",[11.8,48.2,131.4],92410,68,9.4,1.2e6,872,214],
  ["l2","GoldRush Pro","Gold intraday scalper","XAUUSD",[4.1,19.7,52.3],41280,71,6.1,640e3,932,402],
  ["l3","ETH Maxi","ETH swing, 3x average","ETHUSDT",[9.6,36.9,98.5],58730,61,14.8,880e3,640,177],
  ["l4","SOL Sniper","High frequency SOL","SOLUSDT",[18.2,63.5,171.8],37210,57,21.3,310e3,614,96],
  ["l5","FX Samurai","EUR/USD and USD/JPY","EURUSD",[1.9,8.3,24.6],22150,74,3.7,420e3,388,530],
  ["l6","Meme Hunter","DOGE momentum","DOGEUSDT",[-3.4,41.8,88.2],19870,49,29.6,150e3,998,81],
  ["l7","NorthStar Capital","BNB and majors, hedged","BNBUSDT",[5.2,22.4,61.9],64300,66,7.9,1.9e6,741,356],
  ["l8","Quant Lab","XRP mean reversion","XRPUSDT",[7.3,27.6,74.1],28440,63,11.2,520e3,455,268],
  ["l9","Delta Neutral","BTC basis, market neutral","BTCUSDT",[1.2,6.8,19.9],51200,82,2.4,3.4e6,963,611],
  ["l10","SwingKing","AVAX 4h swing","AVAXUSDT",[-1.8,31.1,84.6],16920,55,18.5,240e3,327,143],
  ["l11","TrendRider","LINK breakout trend","LINKUSDT",[6.4,24.9,66.7],14380,59,13.1,198e3,276,119],
  ["l12","Basis Hunter","ETH funding arbitrage","ETHUSDT",[0.9,5.2,16.4],33660,85,1.9,2.6e6,1000,498],
  ["l13","Aurora Bull","ETH range breakouts","ETHUSDT",[8.4,29.3,0],12840,64,9.8,96e3,194,4],
  ["l14","Lumen FX","Majors, London session","EURUSD",[1.1,6.4,0],8120,72,4.2,140e3,121,9],
  ["l15","BlockSage","BTC macro swing","BTCUSDT",[5.9,22.7,0],17660,60,11.6,310e3,236,12],
  ["l16","Nimbus","SOL momentum scalper","SOLUSDT",[12.5,44.1,0],9930,56,19.4,74e3,158,17],
  ["l17","TokenTamer","BNB grid and swing","BNBUSDT",[3.2,14.8,0],6240,67,6.7,88e3,203,21],
  ["l18","Orbit Quant","XRP statistical arbitrage","XRPUSDT",[4.7,18.2,0],11050,69,8.1,204e3,176,26],
  ["l19","Zen Scalper","DOGE 5m scalping","DOGEUSDT",[6.8,33.5,0],7480,53,23.7,52e3,311,33],
  ["l20","PolarEdge","LINK trend following","LINKUSDT",[2.9,16.9,0],5410,61,10.3,63e3,142,38],
  ["b1","Binary Hawk","BTC 5m Up/Down, momentum","BTCUSDT",[6.1,24.8,0],18420,64,11.2,380e3,611,142,86,38],
  ["b2","Tick Sniper","ETH 1m scalps, tight stakes","ETHUSDT",[9.4,38.6,0],12960,58,17.4,210e3,486,88,84,64],
  ["b3","Gold Oracle","XAU 15m trend Up/Down","XAUUSD",[3.2,14.9,0],9870,67,8.3,260e3,402,203,87,17],
  ["b4","Call Put King","BTC & ETH hourly signals","BTCUSDT",[4.6,19.3,0],15240,62,10.1,540e3,733,266,85,22],
  ["b5","Sol Flash","SOL 3m breakout binaries","SOLUSDT",[12.8,52.4,0],8340,55,24.6,96e3,298,41,83,71],
  ["b6","Parity Pro","EUR/USD 10m mean reversion","EURUSD",[2.1,9.8,0],6710,69,5.9,170e3,244,177,88,29],
  ["b7","Quiet Edge","XRP 30m low-frequency","XRPUSDT",[3.8,15.7,0],5290,66,7.4,88e3,167,59,86,9]
].map(a => { const roi = a[4].slice(); if (!roi[2]) roi[2] = +(roi[1] * (2.2 + hash01(a[0]) * .8)).toFixed(1);
  return {id:a[0], name:a[1], style:a[2], sym:a[3], roi, pnl30:a[5], wr:a[6], mdd:a[7], aum:a[8], f:a[9], days:a[10], ai: hash01(a[0] + "ai") > .5, bin: a[0][0] === "b", pay: a[11] || 0, tpd: a[12] || 0,
    ini:a[1].replace(/[^A-Za-z ]/g," ").split(/\s+|(?=[A-Z])/).filter(Boolean).slice(0,2).map(w => w[0]).join("").toUpperCase() || a[1].slice(0,2).toUpperCase()}; });
const PRICE_FB = {BTC:67000, ETH:3300, SOL:160, BNB:600, XRP:.55, DOGE:.15, AVAX:35, LINK:15, XAU:2350, EUR:1.08};
const PERS = [["7D",0],["30D",1],["90D",2]];
const baseOf = sym => sym.replace(/USDT$/, "").replace(/USD$/, "");
const symIcon = (sym, size) => { const p = M.get(sym); return p ? UI.pairIcon(p, size) : UI.coinImg(baseOf(sym), size); };
const symLabel = sym => { const p = M.get(sym); return p ? M.label(p) : (sym.endsWith("USDT") ? baseOf(sym) + "/USDT" : sym); };
const symPx = (sym, v) => { const p = M.get(sym); try { return M.fmtPx(p || {dp: v < 10 ? 4 : 2}, v); } catch { return fmt(v, v < 10 ? 4 : 2); } };
const tdesc = mk => mk === "spot" ? .42 : 1;
window.COPY_LEADERS = LEADS.filter(l => !l.bin).map(l => ({id:l.id, name:l.name, f:l.f, cap:CAP, roi:l.roi[1], pnl30:l.pnl30, aum:l.aum, wr:l.wr, ini:l.ini, tag:"Perp", spark:null, bin:false}));
window.COPY_LEADERS.forEach(x => { const l = LEADS.find(y => y.id === x.id); x.getSpark = n => curve(l, 1, "futures", n || 24); });
function lstats(l, per, mk){
  const f = tdesc(mk), roi = l.roi[per] * f, pnl = l.pnl30 * (l.roi[per] / l.roi[1]) * (mk === "spot" ? .5 : 1);
  return {roi, pnl, wr: Math.min(96, l.wr + (mk === "spot" ? 3 : 0)), mdd: l.mdd * (mk === "spot" ? .55 : 1), aum: l.aum * (mk === "spot" ? .6 : 1), pay: l.pay, tpd: l.tpd};
}
function curve(l, per, mk, n){
  const roi = lstats(l, per, mk).roi, r = rngFor(l.id + per + mk); let w = 0; const out = [];
  for (let k = 0; k < n; k++){ w = w * .72 + (r() - .5) * Math.abs(roi) * .09 + (r() - .5) * 1.2; const x = k / (n - 1); out.push(roi * x + w * Math.sin(Math.PI * x)); }
  return out;
}
/* recent binary (Up/Down) trades of a binary leader, deterministic */
function binTrades(l, n, skip = 0){
  const out = [], now = Date.now(), gap = 864e5 / Math.max(6, l.tpd) * 1.1;
  for (let i = skip; i < skip + n; i++){
    const r = rngFor("bt" + l.id + i), amt = [10,20,25,50,100,150][Math.floor(r() * 6)], win = r() < l.wr / 100, pay = Math.round(l.pay + (r() - .5) * 4);
    out.push({sym: r() < .7 ? l.sym : ["BTCUSDT","ETHUSDT"][Math.floor(r() * 2)], up: r() > .45, amt, pay, win, t: now - (i + 1) * gap * (.7 + r() * .6)});
  }
  return out;
}
function positionsOf(l, mk){
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
const openCount = l => 2 + Math.floor(hash01(l.id + "n") * 4);
function openPositions(l){
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
    seed:U.uid(), drift:Math.max(.003, l.roi[1] / 30 * .35 / 24), vol:1.1 + hash01(l.id) * 1.6}, o);
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
  store.setBalance(S().balance + val, "copy");
  store.notify("Copy trading closed", `${c.name}: ${signed(pnl)} USDT${reason ? " (" + reason + ")" : ""}`, pnl >= 0 ? "ok" : "bad");
  U.fx("close"); return {pnl, pct};
}


/* ---- derived leader metrics ---- */
const sharpe = l => +(.4 + Math.max(0, l.roi[1]) / Math.max(4, l.mdd) * .32 + hash01(l.id + "sh") * .6).toFixed(2);
const score = l => l.roi[1] * .35 + l.wr * .3 + (30 - l.mdd) * .8 + sharpe(l) * 6;
const favs = () => (S().copyFavs ||= []);
const POSTS = [
  ["Closed {s} {d} for {p}. Stuck to the plan and let the trade breathe.", 1],
  ["Reduced exposure on {s} ahead of the data release. Capital protection first.", 0],
  ["Opened a small {d} on {s}. Risk is capped at 1.5% of the account.", 1],
  ["Funding is turning on {s}. Watching for a clean break before adding.", 0],
  ["Thanks for the support, followers. Month is {p} so far, drawdown still under control.", 1],
  ["Took a stop on {s}. Part of the game, size was small and the plan is intact.", 0],
  ["Scaling into {s} {d}. Entries are laddered, target is above the last swing high.", 1],
  ["Market is choppy. Sitting in cash on most pairs and waiting for a setup.", 0]
];
const PERPS = LEADS.filter(l => !l.bin);
function feed(){
  const r = rngFor("feed"), out = [];
  for (let i = 0; i < 16; i++){
    const l = PERPS[Math.floor(r() * PERPS.length)], [tpl] = POSTS[Math.floor(r() * POSTS.length)], p = (r() * 6 + .6).toFixed(1) + "%";
    out.push({l, text: tpl.replace("{s}", symLabel(l.sym)).replace("{d}", r() > .35 ? "long" : "short").replace("{p}", "+" + p), ago: Math.floor(10 + i * (20 + r() * 40)), likes: Math.floor(r() * 480) + 12, cm: Math.floor(r() * 60) + 1, sym: l.sym});
  }
  return out;
}
const agoStr = m => m < 60 ? m + "m ago" : m < 1440 ? Math.floor(m / 60) + "h ago" : Math.floor(m / 1440) + "d ago";
const SORTS = [["comp","Comprehensive"],["roi","30D ROI"],["pnl","30D PnL"],["wr","Win rate"],["mdd","Lowest drawdown"],["aum","AUM"],["f","Followers"]];
const CHIPS = [["star","Star Traders", l => l.wr >= 66 && l.aum >= 4e5],["soar","Soaring ROI", l => l.roi[1] >= 30],["dd","Low Drawdown", l => l.mdd <= 9],["aum","High AUM", l => l.aum >= 1e6]];

Pages.copy = (params) => {
  const openId = params && LEADS.find(x => x.id === params[0]) ? params[0] : null;
  let seg = params && params[0] === "binary" || (openId && LEADS.find(x => x.id === openId).bin) ? "binary" : "perp", view = params && params[0] === "my" ? "my" : "plaza", ltab = "lead", chip = null, sort = "comp", q = "", showQ = false;
  const html = `<div class="px-page px-cp-pg">${head("Copy Trading", `<button class="icon-btn" data-menu aria-label="Menu">${ic("dots",20,1.8)}</button>`)}<div id="cbody"></div>
    <div class="px-subnav"><div class="pill" id="snav"></div><button class="rnd" data-sq aria-label="Search traders">${ic("search",20,1.8)}</button></div></div>`;
  const mkOf = () => seg === "binary" ? "binary" : "futures";
  const pool = () => LEADS.filter(l => seg === "binary" ? l.bin : !l.bin);
  const tagOf = () => seg === "binary" ? "Binary" : "Perp";
  const ldCard = l => { const mk = mkOf(), s = lstats(l, 1, mk), sh = sharpe(l), full = l.f >= CAP, fav = favs().includes(l.id);
    return `<div class="px-lc" data-ld="${l.id}"><div class="h">${ART.avatar(l.id, 44)}<div class="grow"><div class="nm"><span class="ellipsis">${esc(l.name)}</span><button class="star ${fav ? "on" : ""}" data-fav="${l.id}" aria-label="${fav ? "Unfollow" : "Favourite"}">${ic("star",16,1.7)}</button></div><div class="px-mut mt">${tagOf()} <i class="sepv"></i> ${ic("users",13,1.7)} <span class="num">${l.f} / ${fmt(CAP,0)}</span></div></div><button class="cpy" data-cp="${l.id}" ${full ? "disabled" : ""}>${full ? "Full" : "Copy"}</button></div>
      <div class="m"><div><div class="px-mut">30D PnL</div><div class="roi num ${cls(s.roi)}">${sgnPct(s.roi)}</div></div><div class="spk">${spark(curve(l, 1, mk, 36), 130, 52, s.roi >= 0 ? "var(--up)" : "var(--down)")}</div></div>
      ${mk === "binary" ? `<div class="b four"><div><span>Win rate</span><b class="num">${s.wr.toFixed(1)}%</b></div><div><span>Avg payout</span><b class="num">${l.pay}%</b></div><div><span>Trades/day</span><b class="num">${l.tpd}</b></div><div><span>AUM</span><b class="num">${compact(s.aum)}</b></div></div></div>` : `<div class="b four"><div><span>30D Max DD</span><b class="num">${s.mdd.toFixed(2)}%</b></div><div><span>30D Sharpe</span><b class="num">${sh.toFixed(2)}</b></div><div><span>AUM</span><b class="num">${compact(s.aum)}</b></div><div><span>Open pos.</span><b class="num">${openCount(l)}</b></div></div></div>`}`; };
  return {html, title:"Copy Trading", mount(r){
    const $ = x => r.querySelector(x), body = $("#cbody");
    const nav = () => { const n = cstate().active.length; $("#snav").innerHTML = [["plaza","Copy Trading"],["my","My data" + (n ? ` (${n})` : "")],["say","Traders say"]].map(([k,t]) => `<button data-sv="${k}" class="${view===k?"on":""}">${t}</button>`).join(""); };
    const list = () => { const mk = mkOf(); let a = pool();
      if (ltab === "follow") a = a.filter(l => favs().includes(l.id));
      const ch = CHIPS.find(c => c[0] === chip); if (ch) a = a.filter(ch[2]);
      if (q) a = a.filter(l => l.name.toLowerCase().includes(q.toLowerCase()));
      const key = sort === "comp" ? (ltab === "smart" ? score : l => l.roi[1]) : {roi:l => l.roi[1], pnl:l => l.pnl30, wr:l => l.wr, mdd:l => -l.mdd, aum:l => l.aum, f:l => l.f}[sort];
      return a.sort((x, y) => key(y) - key(x)); };
    function renderList(){
      const a = list();
      $("#lst").innerHTML = `<div class="px-chips2"><div class="chs">${CHIPS.map(([k,n]) => `<button data-c="${k}" class="${chip===k?"on":""}">${n}</button>`).join("")}</div></div>
        <div class="row between" style="padding:2px 0 10px"><span class="px-mut">${a.length} traders</span><button class="px-sortb" data-sort>${SORTS.find(x => x[0] === sort)[1]} ${ic("chevd",12,2)}</button></div>
        ${showQ ? `<label class="px-search" style="margin-bottom:10px">${ic("search",16)}<input id="tq" value="${esc(q)}" placeholder="Search traders" autocomplete="off" aria-label="Search traders"></label>` : ""}
        ${a.length ? a.map(ldCard).join("") : empty(ltab === "follow" ? "star" : "users", ltab === "follow" ? "Tap the star on a trader to follow them here" : "No traders match")}`;
      $("#lst").querySelectorAll("[data-c]").forEach(b => b.onclick = () => { chip = chip === b.dataset.c ? null : b.dataset.c; renderList(); });
      $("#lst [data-sort]").onclick = () => U.sheet("Sort by", SORTS.map(([k,n]) => `<button class="px-opt ${sort===k?"on":""}" data-k="${k}">${n}${sort===k ? ic("check",18,2) : ""}</button>`).join(""), el => el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { sort = b.dataset.k; U.closeLayer(); renderList(); }));
      const tq = $("#tq"); if (tq) tq.oninput = () => { q = tq.value; const p = tq.selectionStart; renderList(); const n = $("#tq"); if (n){ n.focus(); n.setSelectionRange(p, p); } };
    }
    function renderPlaza(){
      const mk = mkOf(), fresh = pool().slice().sort((a, b) => a.days - b.days).slice(0, 8);
      body.innerHTML = `<a class="px-hero" href="#/copy/my"><div class="tx"><b>Copy top traders with one tap</b><span>Mirror proven strategies, stop any time</span><i class="go">${ic("chev",14,2)}</i></div>${ART.trophy(88)}</a>
        <div class="px-sg" id="seg">${[["perp","Perp"],["binary","Binary"]].map(([k,n]) => `<button data-s="${k}" class="${seg===k?"on":""}">${n}</button>`).join("")}</div>
        <div class="px-sec-h" style="margin:16px 0 10px"><h2>New Traders</h2></div>
        <div class="px-newr">${fresh.map(l => { const s = lstats(l, 1, mk); return `<div class="px-nt" data-ld="${l.id}">${ART.avatar(l.id, 56)}<b class="ellipsis">${esc(l.name)}</b><span class="px-mut">Joined ${l.days}d ago</span><span class="roi num ${cls(s.roi)}">${sgnPct(s.roi)}</span><span class="px-mut dot">30D ROI</span></div>`; }).join("")}</div>
        <div class="px-tabs" id="lt" style="margin-top:6px">${[["lead","Leaderboard"],["smart","Smart Ranking"],["follow","Following"]].map(([k,n]) => `<button data-t="${k}" class="${ltab===k?"on":""}">${n}</button>`).join("")}</div>
        <div id="lst" style="padding-top:12px"></div>`;
      $("#seg").onclick = e => { const b = e.target.closest("[data-s]"); if (b){ seg = b.dataset.s; renderPlaza(); } };
      $("#lt").onclick = e => { const b = e.target.closest("[data-t]"); if (b){ ltab = b.dataset.t; renderPlaza(); } };
      renderList();
    }
    function renderSay(){
      body.innerHTML = `<div class="px-sec-h" style="margin:8px 0 4px"><h2>Traders say</h2><span class="px-mut"><i class="px-pulse"></i> Live</span></div>` + feed().map(p => `<div class="px-post" data-ld="${p.l.id}"><div class="h">${ART.avatar(p.l.id, 40)}<div class="grow"><b>${esc(p.l.name)}</b><div class="px-mut">${agoStr(p.ago)}</div></div><span class="px-tag">${esc(symLabel(p.sym))}</span></div><p>${esc(p.text)}</p>${SOCIAL.bar("px:" + p.l.id + ":" + p.ago, p.likes, p.cm, {who:p.l.name, text:p.text})}</div>`).join("");
      SOCIAL.bind(body);
    }
    function renderMy(){
      const st = cstate(), now = Date.now();
      const act = st.active.map(c => ({c, pct:copyPct(c, now)})), inv = act.reduce((a,x) => a + x.c.amt, 0), pl = act.reduce((a,x) => a + x.c.amt * x.pct / 100, 0);
      const histPl = st.history.reduce((a,x) => a + x.pnl, 0);
      body.innerHTML = `<div class="px-sum"><div><span>Invested (USDT)</span><b class="num">${money(inv)}</b></div><div><span>Current value</span><b class="num">${money(inv + pl)}</b></div><div><span>Unrealized PnL</span><b class="num ${cls(pl)}">${signed(pl)}</b></div></div>
        <div class="px-sec-h" style="margin-top:16px"><h2>Active (${act.length})</h2></div>
        ${act.length ? act.map(({c, pct}) => { const pn = c.amt * pct / 100, pts = [...Array(24)].map((_,i) => copyPct(c, c.since + (now - c.since) * i / 23));
          return `<div class="px-lc"><div class="h">${ART.avatar(c.lid, 40)}<div class="grow"><div class="nm"><span class="ellipsis">${esc(c.name)}</span> <span class="px-tag">${c.mk === "binary" ? "Binary" : c.mk === "spot" ? "Spot" : "Perp"}</span></div><div class="px-mut mt">Running ${dur(now - c.since)}</div></div><button class="px-btn dn sm" data-stop="${c.id}">Stop</button></div>
          <div class="m"><div><div class="px-mut">PnL (USDT)</div><div class="roi num ${cls(pn)}" style="font-size:24px">${signed(pn)}</div><div class="num ${cls(pn)}" style="font-size:12px">${sgnPct(pct)}</div></div><div class="spk">${spark(pts, 130, 52, pn >= 0 ? "var(--up)" : "var(--down)")}</div></div>
          <div class="b four"><div><span>Invested</span><b class="num">${money(c.amt)}</b></div><div><span>Value</span><b class="num">${money(c.amt + pn)}</b></div><div><span>Stop-loss</span><b class="num">${c.sl ? "-" + c.sl + "%" : "Off"}</b></div><div><span>Take-profit</span><b class="num">${c.tp ? "+" + c.tp + "%" : "Off"}</b></div></div></div>`; }).join("") : `${empty("users","No active copies yet")}<button class="px-btn pri blk" data-find>Find traders</button>`}
        <div class="px-sec-h" style="margin-top:20px"><h2>History</h2>${st.history.length ? `<span class="px-mut">Realized <b class="num ${cls(histPl)}">${signed(histPl)}</b></span>` : ""}</div>
        ${st.history.length ? st.history.slice(0, 20).map(h => `<div class="px-row">${ART.avatar(h.lid, 36)}<div class="grow"><b>${esc(h.name)}</b><div class="px-mut">${U.dateStr(h.end)} · ${dur(h.end - h.since)} · ${esc(h.reason)}</div></div><div class="r"><b class="num ${cls(h.pnl)}">${signed(h.pnl)}</b><span class="px-mut num">${sgnPct(h.pct)} on ${money(h.amt)}</span></div></div>`).join("") : empty("file","No history yet")}`;
      const f = body.querySelector("[data-find]"); if (f) f.onclick = () => { view = "plaza"; show(); };
      body.querySelectorAll("[data-stop]").forEach(b => b.onclick = async () => {
        const c = cstate().active.find(x => x.id === b.dataset.stop); if (!c) return;
        if (await U.confirmBox("Stop copying?", `Your investment plus PnL (${signed(c.amt * copyPct(c) / 100)} USDT) returns to your balance and ${c.name}'s positions are no longer copied.`, "Stop", true)){
          if (!cstate().active.find(x => x.id === c.id)) return;
          const x = stopCopy(c); toast(`Copy stopped: ${signed(x.pnl)} USDT`, x.pnl >= 0 ? "ok" : "bad"); nav(); renderMy();
        }
      });
    }
    const show = () => { nav(); view === "my" ? renderMy() : view === "say" ? renderSay() : renderPlaza(); };
    function detail(l, mk, focus){
      let dp = 1;
      const full = l.f >= CAP, bal = () => S().balance;
      const body = () => { const s = lstats(l, dp, mk);
        return `<div class="row" style="gap:12px;padding:2px 0 4px">${ART.avatar(l.id, 56)}<div class="grow"><b style="font-size:16px">${esc(l.name)}</b><div class="px-mut">${esc(l.style)}</div><div class="px-mut mt">${ic("users",13,1.7)} <span class="num">${fmt(l.f,0)} / ${fmt(CAP,0)}</span> followers</div></div></div>
        <div class="row between" style="margin-top:10px"><div class="px-seg" id="dseg">${PERS.map(([n,i]) => `<button data-p="${i}" class="${dp===i?"on":""}">${n}</button>`).join("")}</div><span class="px-mut">${l.days} trading days</span></div>
        <div class="px-grid3"><div><span>${PERS[dp][0]} ROI</span><b class="num ${cls(s.roi)}" style="font-size:20px">${sgnPct(s.roi)}</b></div><div><span>${PERS[dp][0]} PnL</span><b class="num ${cls(s.pnl)}">${s.pnl >= 0 ? "+" : "-"}$${fmt(Math.abs(s.pnl),0)}</b></div><div><span>Win rate</span><b class="num">${s.wr.toFixed(1)}%</b></div>${mk === "binary" ? `<div><span>Trades/day</span><b class="num">${l.tpd}</b></div>` : `<div><span>Max drawdown</span><b class="num">${s.mdd.toFixed(1)}%</b></div>`}<div><span>AUM</span><b class="num">$${compact(s.aum)}</b></div>${mk === "binary" ? `<div><span>Avg. payout</span><b class="num">${l.pay}%</b></div>` : `<div><span>Avg. leverage</span><b class="num">${Math.round(3 + hash01(l.id) * 9)}x</b></div>`}</div>
        <div class="px-sec-h" style="margin:4px 0 0"><h2>ROI</h2><span class="px-mut"><i class="px-pulse"></i> Live</span></div><div class="px-big">${spark(curve(l, dp, mk, 60), 320, 110, s.roi >= 0 ? "var(--up)" : "var(--down)")}</div>`; };
      const form = `<div class="px-sec" id="pf" style="margin-top:12px"><div class="px-sec-h"><h2>Copy settings</h2><span class="px-mut">Avbl <b class="num" style="color:var(--text)">${money(bal())}</b> USDT</span></div>
        <div class="px-fld"><label><span>Investment</span><span class="px-mut">Min 10 USDT</span></label><div class="px-inp" id="fi"><input id="inv" type="number" inputmode="decimal" value="${Math.min(500, Math.floor(bal() / 10) * 10 || 100)}"><span>USDT</span></div></div>
        <div class="px-chips" style="margin-bottom:14px">${[100,500,1000,5000].map(v => `<button data-v="${v}">${fmt(v,0)}</button>`).join("")}<button data-v="max">Max</button></div>
        <div class="px-fld"><label><span>Copy mode</span></label><div class="px-seg" id="cm" style="display:flex"><button data-m="fixed" class="on" style="flex:1">Fixed amount</button><button data-m="ratio" style="flex:1">Fixed ratio</button></div></div>
        <div class="px-2c"><div class="px-fld"><label><span id="mvl">Per order</span></label><div class="px-inp"><input id="mv" type="number" inputmode="decimal" value="50"><span id="mvu">USDT</span></div></div>
          <div class="px-fld"><label><span>Max per order</span></label><div class="px-inp"><input id="mo" type="number" inputmode="decimal" value="250"><span>USDT</span></div></div></div>
        <div class="px-2c"><div class="px-fld"><label><span>Stop-loss</span></label><div class="px-inp"><input id="sl" type="number" inputmode="decimal" value="30" placeholder="Off"><span>%</span></div></div>
          <div class="px-fld"><label><span>Take-profit</span></label><div class="px-inp"><input id="tp" type="number" inputmode="decimal" placeholder="Off"><span>%</span></div></div></div>
        <div class="px-notice" style="margin-bottom:12px">${ic("info",14)}<span>Past performance does not guarantee future results. Copying may be closed automatically when your stop-loss or take-profit is reached.</span></div>
        <div class="px-err" id="fe"></div><button class="px-btn pri blk lg" id="go" ${full ? "disabled" : ""}>${full ? "Lead trader is full" : "Start Copying"}</button></div>`;
      const pos = positionsOf(l, mk);
      const binRow = x => `<div class="px-pos">${symIcon(x.sym, 28)}<div class="grow"><b>${esc(symLabel(x.sym))}</b> <span class="px-tag ${x.up ? "up" : "dn"}">${x.up ? "Up" : "Down"}</span><div class="px-mut num">Stake ${money(x.amt)} USDT · Payout ${x.pay}% · ${dur(Date.now() - x.t)} ago</div></div><b class="num ${x.win ? "up" : "down"}" style="font-size:13px">${x.win ? "+" + money(x.amt * x.pay / 100) : "-" + money(x.amt)}<br><span style="font-weight:600;font-size:11px">${x.win ? "Win" : "Loss"}</span></b></div>`;
      const histHtml = `<div class="px-sec"><div class="px-sec-h"><h2>${mk === "binary" ? "Past trades" : "Closed positions"}</h2></div>${mk === "binary" ? binTrades(l, 12, 8).map(binRow).join("") : pos.map(p => `<div class="px-pos">${symIcon(p.sym, 28)}<div class="grow"><b>${esc(symLabel(p.sym))}</b> <span class="px-tag ${p.long ? "up" : "dn"}">${mk === "spot" ? (p.long ? "Buy" : "Sell") : (p.long ? "Long" : "Short") + " " + p.lev + "x"}</span><div class="px-mut num">Entry ${symPx(p.sym, p.entry)} · ${dur(Date.now() - p.t)} ago</div></div><b class="num ${cls(p.pct)}" style="font-size:13px">${sgnPct(p.pct)}</b></div>`).join("")}</div>`;
      const livePos = () => { if (mk === "binary") return `<div class="px-sec-h" style="margin:4px 0"><h2>Recent trades</h2><span class="px-mut"><i class="px-pulse"></i> Live</span></div>` + binTrades(l, 8).map(binRow).join(""); const ps = openPositions(l); return `<div class="px-sec-h" style="margin:4px 0"><h2>Open positions (${ps.length})</h2><span class="px-mut"><i class="px-pulse"></i> Live</span></div>` + ps.map(p => { const q = posPnl(p);
        return `<div class="px-opn"><div class="h">${symIcon(p.sym, 28)}<div class="grow"><b>${esc(symLabel(p.sym))}</b> <span class="px-tag ${p.long ? "up" : "dn"}">${p.long ? "Long" : "Short"} ${p.lev}x</span><div class="px-mut">Opened ${dur(Date.now() - p.t)} ago</div></div><div class="r"><b class="num ${cls(q.pnl)}">${(q.pnl >= 0 ? "+" : "") + fmt(q.pnl, 2)}</b><span class="num ${cls(q.roi)}">${sgnPct(q.roi)}</span></div></div>
          <div class="g"><div><span>Size</span><b class="num">${symQty(p.size)}</b></div><div><span>Entry</span><b class="num">${symPx(p.sym, p.entry)}</b></div><div><span>Mark</span><b class="num">${symPx(p.sym, p.mark)}</b></div></div></div>`; }).join(""); };
      let dtab = "ov", liv = null; const stopLive = () => { if (liv){ clearInterval(liv); liv = null; } };
      U.sheet(l.name, `<div class="px-tabs" id="dtabs" style="margin-bottom:12px">${[["ov","Overview"],["pos",mk === "binary" ? "Trades" : "Positions"],["hist","History"]].map(([k,n]) => `<button data-t="${k}" class="${k==="ov"?"on":""}">${n}</button>`).join("")}</div>
        <div id="t-ov"><div id="dbody">${body()}</div>${form}</div><div id="t-pos" hidden></div><div id="t-hist" hidden>${histHtml}</div>`, el => {
        const q = s => el.querySelector(s);
        const refresh = () => { const t = q("#t-pos"); if (!t || !t.isConnected) return stopLive(); if (dtab === "pos") t.innerHTML = livePos(); };
        q("#dtabs").onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; dtab = b.dataset.t; q("#dtabs").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
          ["ov","pos","hist"].forEach(k => q("#t-" + k).hidden = k !== dtab); stopLive(); if (dtab === "pos"){ refresh(); liv = setInterval(refresh, 1000); } };
        const redraw = () => { q("#dbody").innerHTML = body(); q("#dseg").onclick = segClick; };
        const segClick = e => { const b = e.target.closest("[data-p]"); if (b){ dp = +b.dataset.p; redraw(); } };
        q("#dseg").onclick = segClick;
        let mode = "fixed";
        const sync = () => { const inv = parseFloat(q("#inv").value) || 0; if (mode === "fixed"){ q("#mvl").textContent = mk === "binary" ? "Stake per trade" : "Margin per order"; q("#mvu").textContent = "USDT"; } else { q("#mvl").textContent = "Copy ratio"; q("#mvu").textContent = "x"; } };
        q("#cm").onclick = e => { const b = e.target.closest("[data-m]"); if (!b) return; mode = b.dataset.m; q("#cm").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); q("#mv").value = mode === "fixed" ? Math.max(1, Math.round((parseFloat(q("#inv").value) || 100) / 10)) : 1; sync(); };
        q("#pf .px-chips").onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; const v = b.dataset.v === "max" ? Math.floor(bal()) : +b.dataset.v; q("#inv").value = v; if (mode === "fixed") q("#mv").value = Math.max(1, Math.round(v / 10)); q("#mo").value = Math.round(v / 2); };
        q("#inv").oninput = () => { const v = parseFloat(q("#inv").value) || 0; if (mode === "fixed") q("#mv").value = Math.max(1, Math.round(v / 10)); q("#mo").value = Math.round(v / 2); };
        sync();
        if (focus) setTimeout(() => q("#pf")?.scrollIntoView({block:"start"}), 360);
        q("#go").onclick = async () => {
          const inv = parseFloat(q("#inv").value), mv = parseFloat(q("#mv").value), mo = parseFloat(q("#mo").value), sl = q("#sl").value === "" ? 0 : parseFloat(q("#sl").value), tp = q("#tp").value === "" ? 0 : parseFloat(q("#tp").value);
          const err = !(inv >= 10) ? "Minimum investment is 10 USDT." : inv > bal() ? "Insufficient balance." : inv > 100000 ? "Maximum investment is 100,000 USDT." : !(mv > 0) ? "Enter the copy " + (mode === "fixed" ? "amount per order." : "ratio.") : (mode === "fixed" && mv > inv) ? "Per-order amount cannot exceed your investment." : (mode === "ratio" && mv > 10) ? "Maximum copy ratio is 10x." : !(mo > 0) ? "Enter the maximum per order." : (q("#sl").value !== "" && !(sl >= 1 && sl <= 90)) ? "Stop-loss must be between 1% and 90%." : (q("#tp").value !== "" && !(tp >= 1)) ? "Take-profit must be at least 1%." : "";
          q("#fe").textContent = err; if (err) return;
          const ok = await U.confirmTrade({kind:"market", title:"Confirm Copy Trading", okText:"Start Copying", tone:"primary", rows:[
            ["Lead trader", esc(l.name)], ["Market", mk === "binary" ? "Binary (Up/Down)" : "Futures"], ["Investment", `${money(inv)} USDT`], ["Copy mode", mode === "fixed" ? `Fixed amount, ${fmt(mv, 2)} USDT` : `Fixed ratio, ${fmt(mv, 2)}x`],
            ["Max per order", `${money(mo)} USDT`], ["Stop-loss", sl ? `-${sl}%` : "Off"], ["Take-profit", tp ? `+${tp}%` : "Off"]]});
          if (!ok) return;
          if (inv > S().balance){ toast("Insufficient balance", "bad"); return; }
          cstate().active.unshift(newCopy(l, {mk, mode:mk === "binary" ? "binary" : mode, sizing:mode, modeVal:mv, maxOrder:mo, sl, tp}));
          store.setBalance(S().balance - inv, "copy"); store.save();
          store.notify("Copy trading started", `Copying ${l.name} with ${money(inv)} USDT`, "ok"); U.fx("open"); toast("Copy trading started", "ok");
          view = "my"; show();
        };
      }, stopLive);
    }

    r.addEventListener("click", e => {
      const f = e.target.closest("[data-fav]"), c = e.target.closest("[data-cp]"), d = e.target.closest("[data-ld]"), sv = e.target.closest("[data-sv]");
      if (f){ e.stopPropagation(); const id = f.dataset.fav, a = favs(), i = a.indexOf(id); i < 0 ? a.push(id) : a.splice(i, 1); store.save(); if (ltab === "follow") renderList(); else { f.classList.toggle("on", i < 0); } toast(i < 0 ? "Added to Following" : "Removed from Following", "info", 1500); return; }
      if (sv){ view = sv.dataset.sv; show(); window.scrollTo(0, 0); return; }
      if (e.target.closest("[data-sq]")){ view = "plaza"; showQ = !showQ; if (!showQ) q = ""; show(); if (showQ) $("#tq")?.focus(); return; }
      if (e.target.closest("[data-menu]")){ U.sheet("Copy Trading", `<button class="px-opt" data-m="my">My data${ic("chev",16)}</button><button class="px-opt" data-m="say">Traders say${ic("chev",16)}</button><button class="px-opt" data-m="follow">Following${ic("chev",16)}</button><div class="px-notice" style="margin-top:12px">${ic("info",14)}<span>Past performance does not guarantee future results. Copy trading is simulated with paper funds.</span></div>`, el => el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { U.closeLayer(); if (b.dataset.m === "follow"){ view = "plaza"; ltab = "follow"; } else view = b.dataset.m; show(); })); return; }
      if (c || d){ const l = LEADS.find(x => x.id === (c || d).dataset[c ? "cp" : "ld"]); if (l) detail(l, mkOf(), !!c); }
    });
    show();
    if (openId) setTimeout(() => { const l = LEADS.find(x => x.id === openId); if (l) detail(l, l.bin ? "binary" : "futures", false); }, 60);
    const check = () => { cstate().active.slice().forEach(c => { const p = copyPct(c); if (c.sl && p <= -c.sl){ stopCopy(c, "Stop-loss"); toast(`${c.name}: stop-loss reached`, "bad"); } else if (c.tp && p >= c.tp){ stopCopy(c, "Take-profit"); toast(`${c.name}: take-profit reached`, "ok"); } }); };
    check();
    const iv = setInterval(() => { if (!r.isConnected) return; check(); if (view === "my" && !document.querySelector("#sheet.show")){ nav(); renderMy(); } }, 3000);
    this.unmount = () => clearInterval(iv);
  }};
};
})();
