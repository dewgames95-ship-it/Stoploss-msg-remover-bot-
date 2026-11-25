/* v6.7 — Copy trading: generated trader avatars (ART.avatar) + live trader simulation engine (SIM) + copy mirroring.
   Real copy-trading data has no public Binance API (private / CORS-blocked), so traders are simulated on top of REAL live prices
   (entry/mark = live price, history backfilled from real klines when reachable, else a seeded walk). Persisted in localStorage. */
(function(){
"use strict";
if (!window.U || !window.ART) return;
const DAY = 864e5, HR = 36e5, MIN = 6e4, EQS = 2 * HR, CLOSED_CAP = 60, FEED_CAP = 40;
const hash = s => { let h = 2166136261; for (const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const hash01 = s => hash(s) / 4294967296;
const rngFor = seed => { let a = hash(seed); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = v => Math.round(v * 100) / 100, r6 = v => +(+v).toPrecision(7);

/* ============================ AVATARS ============================ */
const leadIdx = id => { const a = window.SIMLEADS; return a ? a.findIndex(l => l.id === id) : -1; };
const iniOf = seed => { const a = window.SIMLEADS, l = a && a.find(x => x.id === seed); if (l) return l.ini;
  const w = String(seed).replace(/^c_/, "").replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+|(?=[A-Z])/).filter(Boolean); return ((w[0] || "?")[0] + ((w[1] || w[0] || "?")[w[1] ? 0 : 1] || "")).toUpperCase().slice(0, 2); };
function mascot(k, F, D, A, W){
  switch (k % 8){
    case 0: return `<path d="M12 15c-3 9 2 17 11 18l3-9zM52 15c3 9-2 17-11 18l-3-9z" fill="${F}"/><ellipse cx="32" cy="37" rx="17" ry="18" fill="${F}"/><ellipse cx="32" cy="47" rx="10" ry="7" fill="${A}" opacity=".4"/><circle cx="27" cy="47" r="1.8" fill="${D}"/><circle cx="37" cy="47" r="1.8" fill="${D}"/><circle cx="25" cy="33" r="2.7" fill="${D}"/><circle cx="39" cy="33" r="2.7" fill="${D}"/><path d="M26 54q6 2.6 12 0" stroke="${A}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    case 1: return `<circle cx="18" cy="21" r="7.5" fill="${F}"/><circle cx="46" cy="21" r="7.5" fill="${F}"/><circle cx="18" cy="21" r="3.6" fill="${A}" opacity=".5"/><circle cx="46" cy="21" r="3.6" fill="${A}" opacity=".5"/><circle cx="32" cy="36" r="19" fill="${F}"/><ellipse cx="32" cy="43" rx="8.5" ry="6.5" fill="${A}" opacity=".35"/><ellipse cx="32" cy="40.5" rx="3.2" ry="2.3" fill="${D}"/><circle cx="24" cy="32" r="2.5" fill="${D}"/><circle cx="40" cy="32" r="2.5" fill="${D}"/>`;
    case 2: return `<path d="M14 31L16 10l13 10zM50 31L48 10L35 20z" fill="${F}"/><path d="M18 26l.8-9 6 5zM46 26l-.8-9-6 5z" fill="${A}" opacity=".5"/><ellipse cx="32" cy="37" rx="19" ry="17" fill="${F}"/><ellipse cx="25" cy="35" rx="2.2" ry="3.2" fill="${D}"/><ellipse cx="39" cy="35" rx="2.2" ry="3.2" fill="${D}"/><path d="M29.8 41h4.4L32 43.8z" fill="${A}"/><path d="M32 43.8v2.4M27.5 47q4.5 3 9 0" stroke="${D}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M11 40h9M12 45l8-2.4M53 40h-9M52 45l-8-2.4" stroke="${F}" stroke-width="1.4" stroke-linecap="round" opacity=".85"/>`;
    case 3: return `<path d="M11 36L13 9l17 13zM53 36L51 9L34 22z" fill="${F}"/><path d="M16 30l.8-12 8 6zM48 30l-.8-12-8 6z" fill="${A}" opacity=".6"/><path d="M11 33Q32 19 53 33Q51 53 32 58Q13 53 11 33z" fill="${F}"/><path d="M11 33Q22 44 32 58Q13 53 11 33zM53 33Q42 44 32 58Q51 53 53 33z" fill="${W}"/><circle cx="32" cy="52.5" r="2.6" fill="${D}"/><ellipse cx="24" cy="37" rx="2.2" ry="2.8" fill="${D}"/><ellipse cx="40" cy="37" rx="2.2" ry="2.8" fill="${D}"/>`;
    case 4: return `<rect x="30" y="8" width="4" height="9" rx="2" fill="${F}"/><circle cx="32" cy="8" r="3.6" fill="${A}"/><rect x="9" y="29" width="6" height="12" rx="3" fill="${F}"/><rect x="49" y="29" width="6" height="12" rx="3" fill="${F}"/><rect x="14" y="16" width="36" height="34" rx="10" fill="${F}"/><rect x="19" y="26" width="26" height="12" rx="6" fill="${D}"/><circle cx="27" cy="32" r="3" fill="${A}"/><circle cx="37" cy="32" r="3" fill="${A}"/><path d="M25 44h14" stroke="${D}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 5: return `<path d="M15 22L18 8l12 9zM49 22L46 8L34 17z" fill="${F}"/><ellipse cx="32" cy="37" rx="20" ry="19" fill="${F}"/><circle cx="23.5" cy="33" r="9" fill="${W}"/><circle cx="40.5" cy="33" r="9" fill="${W}"/><circle cx="24.5" cy="33" r="4.2" fill="${D}"/><circle cx="39.5" cy="33" r="4.2" fill="${D}"/><circle cx="26" cy="31.5" r="1.4" fill="#fff"/><circle cx="41" cy="31.5" r="1.4" fill="#fff"/><path d="M28.4 41h7.2L32 48z" fill="${A}"/>`;
    case 6: return `<circle cx="17" cy="20" r="7.5" fill="${D}"/><circle cx="47" cy="20" r="7.5" fill="${D}"/><circle cx="32" cy="36" r="19.5" fill="${W}"/><ellipse cx="23.5" cy="34" rx="5.2" ry="6.8" fill="${D}" transform="rotate(18 23.5 34)"/><ellipse cx="40.5" cy="34" rx="5.2" ry="6.8" fill="${D}" transform="rotate(-18 40.5 34)"/><circle cx="24.5" cy="33" r="1.7" fill="#fff"/><circle cx="39.5" cy="33" r="1.7" fill="#fff"/><ellipse cx="32" cy="43" rx="3.4" ry="2.4" fill="${D}"/><path d="M28 47q4 3 8 0" stroke="${D}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
    default: return `<path d="M32 9C18 9 11 24 15 37c3 10 11 16 17 16s14-6 17-16C53 24 46 9 32 9z" fill="${F}"/><ellipse cx="23.5" cy="33" rx="6" ry="9.5" fill="${D}" transform="rotate(-24 23.5 33)"/><ellipse cx="40.5" cy="33" rx="6" ry="9.5" fill="${D}" transform="rotate(24 40.5 33)"/><circle cx="22" cy="29" r="1.8" fill="#fff" opacity=".9"/><circle cx="42" cy="29" r="1.8" fill="#fff" opacity=".9"/><path d="M28 46q4 2.6 8 0" stroke="${D}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  }
}
function avatar(seed, size){
  size = size || 40; seed = String(seed);
  const li = leadIdx(seed), n = li >= 0 ? li : hash(seed), r = rngFor("av7" + seed);
  const kind = n % 4, sub = li >= 0 ? Math.floor(li / 4) : hash(seed + "s") % 8;
  const h1 = li >= 0 ? (li * 137.508 + 18) % 360 : hash(seed) % 360, h2 = (h1 + 28 + r() * 52) % 360, ang = Math.floor(r() * 360);
  const c1 = `hsl(${h1.toFixed(0)} 74% 60%)`, c2 = `hsl(${h2.toFixed(0)} 72% 34%)`, F = "#FFF7EC", W = "#FFFFFF", D = `hsl(${h2.toFixed(0)} 55% 15%)`, A = `hsl(${((h1 + 180) % 360).toFixed(0)} 85% 62%)`, id = "ax" + hash(seed);
  let body = "";
  if (kind === 0) body = mascot(sub, F, D, A, W);
  else if (kind === 1){
    const shp = sub % 4, o = ".14";
    const sh = shp === 0 ? `<circle cx="50" cy="14" r="28" fill="#fff" opacity="${o}"/>` : shp === 1 ? `<path d="M-4 52L52-4h20L-4 72z" fill="#fff" opacity="${o}"/>` : shp === 2 ? `<circle cx="32" cy="32" r="26" fill="none" stroke="#fff" stroke-width="5" opacity="${o}"/>` : `<path d="M0 64L64 64 64 20z" fill="#fff" opacity="${o}"/>`;
    const ini = iniOf(seed);
    body = sh + `<text x="32" y="41.5" text-anchor="middle" font-size="${ini.length > 1 ? 25 : 30}" font-weight="800" fill="#fff" font-family="Manrope,system-ui,sans-serif" letter-spacing="-1">${ini.replace(/&/g, "")}</text>`;
  } else if (kind === 2){
    let g; let on = 0; do { g = []; on = 0; for (let y = 0; y < 5; y++){ const row = []; for (let x = 0; x < 3; x++){ const v = r() > .46; row.push(v); on += v ? (x === 2 ? 1 : 2) : 0; } g.push(row); } } while (on < 9 || on > 19);
    const cs = 8.4, ox = 32 - 2.5 * cs; body = g.map((row, y) => row.map((v, x) => v ? [x, 4 - x].filter((q, i, a) => a.indexOf(q) === i).map(q => `<rect x="${(ox + q * cs + .6).toFixed(1)}" y="${(ox + y * cs + .6).toFixed(1)}" width="${cs - 1.2}" height="${cs - 1.2}" rx="2.2" fill="#fff" opacity=".94"/>`).join("") : "").join("")).join("");
  } else {
    const nb = 5, bw = 6.2, gap = 3.4, tot = nb * bw + (nb - 1) * gap, x0 = (64 - tot) / 2; let p = 30 + r() * 10; const up = r() > .35;
    body = `<path d="M8 50H56" stroke="#fff" stroke-width="1.2" opacity=".35"/>` + [...Array(nb)].map((_, i) => { const d = (up ? -1 : .2) * (2 + r() * 6) + (r() - .5) * 8; const o = p, c = p + d; p = c; const hi = Math.min(o, c) - 2 - r() * 5, lo = Math.max(o, c) + 2 + r() * 5, bull = c <= o, x = x0 + i * (bw + gap);
      return `<path d="M${(x + bw / 2).toFixed(1)} ${hi.toFixed(1)}V${lo.toFixed(1)}" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><rect x="${x.toFixed(1)}" y="${Math.min(o, c).toFixed(1)}" width="${bw}" height="${Math.max(3, Math.abs(c - o)).toFixed(1)}" rx="1.6" fill="${bull ? "#fff" : A}"/>`; }).join("");
  }
  return `<svg class="px-avs" width="${size}" height="${size}" viewBox="0 0 64 64" style="border-radius:50%;display:block;flex-shrink:0" role="img" aria-label="Trader avatar"><defs><linearGradient id="${id}" gradientTransform="rotate(${ang} .5 .5)"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="64" height="64" fill="url(#${id})"/><circle cx="${(10 + r() * 36).toFixed(0)}" cy="${(-6 + r() * 12).toFixed(0)}" r="${(20 + r() * 12).toFixed(0)}" fill="#fff" opacity=".11"/>${body}</svg>`;
}
ART.avatar = avatar;
window.TRADER_AVATAR = avatar;

/* ============================ SIMULATION ============================ */
const KEY = "nt_sim_v2", FEE = .0001;
const PFB = {BTC:67000, ETH:3300, SOL:160, BNB:600, XRP:.55, DOGE:.15, AVAX:35, LINK:15, XAU:2350, EUR:1.08};
const VOLH = {BTC:.0045, ETH:.006, SOL:.009, BNB:.005, XRP:.008, DOGE:.011, AVAX:.009, LINK:.009, XAU:.0018, EUR:.0006};
const baseOf = sym => sym.replace(/USDT$/, "").replace(/USD$/, "");
const TYPE = {l1:"trend", l2:"scalper", l3:"swing", l4:"scalper", l5:"scalper", l6:"trend", l7:"swing", l8:"scalper", l9:"swing", l10:"swing", l11:"trend", l12:"swing", l13:"swing", l14:"scalper", l15:"swing", l16:"scalper", l17:"swing", l18:"scalper", l19:"scalper", l20:"trend", b1:"scalper", b2:"scalper", b3:"swing", b4:"swing", b5:"scalper", b6:"scalper", b7:"swing"};
const TP = {
  scalper:{hold:[3 * MIN, 40 * MIN], gap:[2 * MIN, 8 * MIN], bgap:40 * MIN, levs:[10, 20, 25, 50], alloc:.045, sl:.0032, spd:.3, cap:5},
  swing:{hold:[4 * HR, 36 * HR], gap:[25 * MIN, 90 * MIN], bgap:7 * HR, levs:[3, 5, 8, 10], alloc:.1, sl:.014, spd:.06, cap:4},
  trend:{hold:[12 * HR, 72 * HR], gap:[60 * MIN, 180 * MIN], bgap:14 * HR, levs:[3, 5, 10, 15], alloc:.12, sl:.03, spd:.04, cap:3}
};
const LEV_OV = {l1:[3, 5, 8], l9:[1, 2, 3], l12:[2, 3, 5], l5:[10, 20, 30], l2:[10, 20, 25], l14:[10, 20, 30], l17:[3, 5], l15:[3, 5, 8], l4:[10, 20, 25]};
const profOf = l => { const t = TYPE[l.id] || "swing"; return Object.assign({type:t}, TP[t], {levs: LEV_OV[l.id] || TP[t].levs}); };
const MAJ = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
const pickSym = (l, rng) => { const k = rng(); if (l.bin) return k < .75 ? l.sym : ["BTCUSDT", "ETHUSDT"][Math.floor(rng() * 2)];
  if (!/USDT$/.test(l.sym)) return l.sym;
  if (k < .6) return l.sym; const ex = MAJ.filter(s => s !== l.sym); return ex[Math.floor(rng() * ex.length)]; };

let ST = null, LD = [], BYID = {}, SER = {}, FB = {}, FBT = {}, PH = {}, dirty = false, lastSave = 0, booted = false, ready = false, readyCbs = [], watched = {}, lastCurve = 0;
const lsGet = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.v === 2 ? v : null; } catch { return null; } };
function save(force){
  if (!ST || (!dirty && !force)) return; const now = Date.now(); if (!force && now - lastSave < 15000) return; lastSave = now; dirty = false;
  const put = () => { try { localStorage.setItem(KEY, JSON.stringify(ST)); return true; } catch { return false; } };
  if (!put()){ Object.values(ST.T).forEach(t => { t.closed = t.closed.slice(0, 25); t.feed = t.feed.slice(0, 15); }); put(); }
}
addEventListener("pagehide", () => save(true)); document.addEventListener("visibilitychange", () => { if (document.hidden) save(true); });

const fmtPx = (sym, v) => { const p = window.M && M.get(sym); try { return M.fmtPx(p || {dp: v < 10 ? 4 : 2}, v); } catch { return v.toFixed(v < 10 ? 4 : 2); } };
function price(sym){
  const p = window.M && M.get(sym); if (p && p.price > 0){ FB[sym] = p.price; return p.price; }
  return FB[sym] || (FB[sym] = PFB[baseOf(sym)] || 100);
}
function walkFallback(now){   // symbols without a live feed (offline / blocked) keep a gentle random walk
  Object.keys(FB).forEach(s => { const p = window.M && M.get(s); if (p && p.price > 0) return; if (now - (FBT[s] || 0) < 1500) return; FBT[s] = now; FB[s] *= 1 + (Math.random() - .5) * (VOLH[baseOf(s)] || .006) * .05; });
}
function samplePH(now){ [...new Set(LD.map(l => l.sym).concat(MAJ))].forEach(s => { const a = PH[s] ||= [], p = price(s); a.push([now, p]); if (a.length > 90) a.shift(); }); }
const mom = sym => { const a = PH[sym]; return a && a.length > 8 ? a[a.length - 1][1] / a[0][1] - 1 : 0; };

/* ---- price history (backfill) ---- */
async function getK(sym, iv, st){
  const hosts = (window.CONFIG && CONFIG.BINANCE_REST) || ["https://data-api.binance.vision", "https://api.binance.com"], ord = [hosts.find(h => /vision/.test(h)) || hosts[1] || hosts[0], ...hosts];
  for (const h of ord){
    try { const c = new AbortController(), to = setTimeout(() => c.abort(), 6000);
      const r = await fetch(`${h}/api/v3/klines?symbol=${sym}&interval=${iv}&startTime=${Math.floor(st)}&limit=1000`, {signal: c.signal}); clearTimeout(to);
      if (!r.ok) continue; const a = await r.json(); if (!Array.isArray(a) || !a.length) continue;
      const ms = {"5m": 5 * MIN, "1h": HR, "4h": 4 * HR}[iv];
      return a.map(k => ({t:k[0], ms, o:+k[1], h:+k[2], l:+k[3], c:+k[4]}));
    } catch {}
  }
  return null;
}
function synth(sym, from, to){
  const P0 = price(sym), vol = VOLH[baseOf(sym)] || .006, r = rngFor("syn" + sym), n = Math.ceil((to - from) / HR) + 2, w = [0];
  for (let i = 1; i <= n; i++) w.push(w[i - 1] + (r() + r() + r() - 1.5) * 2 * vol);
  const last = w[n], out = []; for (let i = 0; i < n; i++){ const o = P0 * Math.exp(w[i] - last), c = P0 * Math.exp(w[i + 1] - last), x = vol * .5 * r(); out.push({t: to - (n - i) * HR, ms: HR, o, c, h: Math.max(o, c) * (1 + x), l: Math.min(o, c) * (1 - x)}); }
  return out;
}
async function loadSeries(syms, from){
  const now = Date.now();
  await Promise.all(syms.map(async sym => {
    let bars = null;
    if (/USDT$/.test(sym)){
      const parts = []; if (from < now - 41 * DAY) parts.push(["4h", from]); if (from < now - 3 * DAY) parts.push(["1h", Math.max(from, now - 41 * DAY)]); parts.push(["5m", Math.max(from, now - 3 * DAY)]);
      const res = await Promise.all(parts.map(([iv, st]) => getK(sym, iv, st)));
      if (res.every(Boolean)){ bars = []; res.forEach((b, i) => { const nx = res[i + 1], cut = nx ? nx[0].t : Infinity; b.forEach(x => { if (x.t + x.ms <= cut) bars.push(x); }); }); }
    }
    SER[sym] = bars && bars.length > 5 ? bars : synth(sym, from, now);
  }));
}
function pxAt(sym, t){
  const s = SER[sym]; if (!s || !s.length) return price(sym);
  const L = s.length - 1; if (t >= s[L].t + s[L].ms) return s[L].c; if (t <= s[0].t) return s[0].o;
  let lo = 0, hi = L; while (lo < hi){ const m = (lo + hi + 1) >> 1; if (s[m].t <= t) lo = m; else hi = m - 1; }
  const b = s[lo], f = Math.min(1, (t - b.t) / b.ms), base = b.o + (b.c - b.o) * f, nz = (hash01(sym + Math.floor(t / MIN)) - .5) * (b.h - b.l) * .5 * Math.sin(Math.PI * f);
  return clamp(base + nz, b.l, b.h);
}

/* ---- per-trader state ---- */
function newTr(l, now){
  const o = l.o, e0 = Math.max(2000, o.pnl30 / Math.max(1, o.roi[1]) * 100), d0 = Math.floor((now - 92 * DAY) / DAY) * DAY;
  return {id:l.id, e0, k:1, t0: now - Math.min(90, o.days) * DAY, d0, dn:[], dw:[], dp:[], eq0:d0, eq:[], cum:0, open:[], closed:[], feed:[], nextAt:0, f:o.f, lastT:now, fa:0};
}
const dIdx = (tr, t) => Math.max(0, Math.floor((t - tr.d0) / DAY));
function addAgg(tr, t, pnl){ const i = dIdx(tr, t); while (tr.dn.length <= i){ tr.dn.push(0); tr.dw.push(0); tr.dp.push(0); } tr.dn[i]++; if (pnl > 0) tr.dw[i]++; tr.dp[i] = r2(tr.dp[i] + pnl); }
function trim(tr){ if (tr.dn.length > 130){ tr.dn.splice(0, 30); tr.dw.splice(0, 30); tr.dp.splice(0, 30); tr.eq.splice(0, 360); tr.d0 += 30 * DAY; tr.eq0 += 30 * DAY; } }
const sideTxt = p => p.bin ? (p.long ? "UP" : "DOWN") : (p.long ? "Long" : "Short");
function feedOpen(p){ return {t:p.t, tp:"o", sym:p.sym, txt: p.bin ? `Bought ${sideTxt(p)} ${p.sym}, ${r2(p.margin)} USDT, ${Math.max(1, Math.round((p.maxT - p.t) / MIN))}m` : `Opened ${sideTxt(p)} ${p.sym} ${p.lev}x at ${fmtPx(p.sym, p.entry)}`}; }
function feedClose(c){ return {t:c.ct, tp:"c", sym:c.sym, pnl:c.pnl, txt: c.bin ? `${c.sym} ${sideTxt(c)} ${c.pnl > 0 ? "won" : "lost"} ${c.pnl >= 0 ? "+" : "-"}${Math.abs(c.pnl).toFixed(2)} USDT` : `Closed ${sideTxt(c)} ${c.sym} ${c.lev}x at ${fmtPx(c.sym, c.exit)}, ${c.pnl >= 0 ? "+" : "-"}${Math.abs(c.roi).toFixed(1)}% ROI`}; }
const mkClosed = e => { const roi = e.margin ? e.pnl / e.margin * 100 : 0; return {id:e.id, sym:e.sym, long:e.long, lev:e.lev, entry:r6(e.entry), exit:r6(e.exit), margin:r2(e.margin), t:e.t, ct:e.ct, pnl:r2(e.pnl), roi:r2(roi), bin:e.bin || 0, pay:e.pay || 0}; };

/* hindsight generator over a real price path: sides are chosen so the win rate matches the trader's profile */
function genRange(l, tr, from, to, k){
  const pr = profOf(l), o = l.o, bin = l.bin, rng = rngFor("g" + l.id + Math.floor(from / MIN)), wr = clamp(o.wr / 100, .4, .9);
  const rr = wr >= .7 ? 1 : wr >= .62 ? 1.12 : wr >= .55 ? 1.35 : 1.8;
  const gm = bin ? DAY / Math.max(4, l.tpd) : pr.bgap, hr = bin ? (pr.type === "scalper" ? [MIN, 6 * MIN] : [10 * MIN, 45 * MIN]) : pr.hold, ev = [], tail = [];
  let t = from + rng() * gm;
  while (t < to){
    const hold = hr[0] + rng() * (hr[1] - hr[0]), ct = t + hold, sym = pickSym(l, rng), p0 = pxAt(sym, t);
    if (ct > to){ if (tail.length < pr.cap) tail.push({t, hold, sym, p0, rn: rng()}); }
    else {
      const p1 = pxAt(sym, ct), r = p1 / p0 - 1, win = rng() < wr, long = r === 0 ? rng() > .5 : (r > 0) === win, lev = bin ? 1 : pr.levs[Math.floor(rng() * pr.levs.length)];
      let margin, pnl;
      if (bin){ const st = [10, 20, 25, 50, 100, 150, 200], tgt = tr.e0 * .001 * (.5 + rng()); let stake = st[0]; st.forEach(s => { if (Math.abs(s - tgt) < Math.abs(stake - tgt)) stake = s; }); margin = stake * k; pnl = win ? margin * l.pay / 100 : -margin; }
      else { margin = tr.e0 * pr.alloc * k * (.6 + .8 * rng()); pnl = margin * lev * (Math.abs(r) * (win ? rr : -1)) - margin * lev * FEE; }
      ev.push({id:"h" + ev.length + t, sym, long, lev, entry:p0, exit:p1, margin, t, ct, pnl, bin:bin ? 1 : 0, pay:l.pay});
    }
    t += Math.max(2 * MIN, -Math.log(1 - rng()) * gm);
  }
  return {ev, tail};
}
function applyEvs(tr, evs, now){
  evs.sort((a, b) => a.ct - b.ct); let cum = tr.cum, p = 0, bt = tr.eq0 + tr.eq.length * EQS;
  while (bt <= now){ while (p < evs.length && evs[p].ct < bt) cum += evs[p++].pnl; tr.eq.push(Math.round(cum)); bt += EQS; }
  while (p < evs.length) cum += evs[p++].pnl; tr.cum = cum;
  evs.forEach(e => addAgg(tr, e.ct, e.pnl));
  tr.closed = evs.slice(-CLOSED_CAP).reverse().map(mkClosed).concat(tr.closed).slice(0, CLOSED_CAP);
  const fd = []; evs.slice(-8).forEach(e => { const c = mkClosed(e); fd.push(feedClose(c), feedOpen({t:e.t, bin:e.bin, long:e.long, sym:e.sym, lev:e.lev, entry:e.entry, margin:e.margin, maxT:e.ct})); });
  tr.feed = fd.concat(tr.feed).sort((a, b) => b.t - a.t).slice(0, FEED_CAP);
}
function mkOpen(l, tr, t, hold, sym, p0, rn, k){
  const pr = profOf(l), bin = l.bin, lev = bin ? 1 : pr.levs[Math.floor(rn * pr.levs.length)], long = rn > .42;
  let margin; if (bin){ const st = [10, 20, 25, 50, 100]; margin = st[Math.floor(rn * 4999) % st.length]; } else margin = tr.e0 * pr.alloc * (tr.k || k || 1) * (.6 + .8 * ((rn * 97) % 1));
  const wr = clamp(l.o.wr / 100, .45, .85), slP = pr.sl * (.7 + .6 * ((rn * 31) % 1)), tpP = Math.max(slP * .15, slP * (1 - wr) / wr), dir = long ? 1 : -1;
  return {id:U.uid(), sym, long, lev, entry:p0, margin:r2(margin), t, maxT:t + hold, bin:bin ? 1 : 0, pay:l.pay, tp: r6(p0 * (1 + dir * tpP)), sl: r6(p0 * (1 - dir * slP))};
}
async function boot(){
  if (booted) return; booted = true;
  LD = window.SIMLEADS || []; LD.forEach(l => { if (!l.o) l.o = {roi:l.roi.slice(), pnl30:l.pnl30, wr:l.wr, mdd:l.mdd, aum:l.aum, f:l.f, days:l.days}; BYID[l.id] = l; });
  ST = lsGet() || {v:2, T:{}};
  const now = Date.now(); for (let i = 0; i < 30 && !(window.M && M.get("BTCUSDT") && M.get("BTCUSDT").price > 0); i++) await new Promise(r => setTimeout(r, 300));
  const missing = LD.filter(l => !ST.T[l.id]), catchup = LD.filter(l => ST.T[l.id] && now - ST.T[l.id].lastT > 10 * MIN);
  if (missing.length || catchup.length){
    const from = missing.length ? now - 92 * DAY : Math.min(...catchup.map(l => ST.T[l.id].lastT)) - HR, syms = new Set();
    missing.concat(catchup).forEach(l => { syms.add(l.sym); if (!l.bin && /USDT$/.test(l.sym)) MAJ.forEach(s => syms.add(s)); if (l.bin){ syms.add("BTCUSDT"); syms.add("ETHUSDT"); } });
    await loadSeries([...syms], from);
  }
  const t1 = Date.now();
  missing.forEach(l => { try {
    const tr = newTr(l, t1), from = t1 - Math.min(90, l.o.days) * DAY, g = genRange(l, tr, from, t1, 1), wd = Math.min(30, l.o.days);
    const raw = g.ev.filter(e => e.ct > t1 - wd * DAY).reduce((a, e) => a + e.pnl, 0) / tr.e0 * 100, tgt = l.o.roi[1] * wd / 30;
    tr.k = raw > .05 && tgt > 0 ? clamp(tgt / raw, .2, 3) : 1; g.ev.forEach(e => { e.margin *= tr.k; e.pnl *= tr.k; });
    applyEvs(tr, g.ev, t1); g.tail.forEach(x => tr.open.push(mkOpen(l, tr, x.t, x.hold, x.sym, x.p0, x.rn))); tr.nextAt = t1 + 20e3 + Math.random() * 120e3; ST.T[l.id] = tr;
  } catch (e) { console.warn("sim backfill", l.id, e); } });
  catchup.forEach(l => { try {
    const tr = ST.T[l.id]; l.bin; const stale = tr.open.filter(p => p.maxT <= t1); tr.open = tr.open.filter(p => p.maxT > t1);
    const evs = stale.map(p => { const ex = pxAt(p.sym, p.maxT), s = p.long ? 1 : -1, ret = p.bin ? 0 : (ex / p.entry - 1) * s, win = p.bin ? (ex - p.entry) * s > 0 : ret > 0; return {id:p.id, sym:p.sym, long:p.long, lev:p.lev, entry:p.entry, exit:ex, margin:p.margin, t:p.t, ct:p.maxT, bin:p.bin, pay:p.pay, pnl: p.bin ? (win ? p.margin * p.pay / 100 : -p.margin) : p.margin * p.lev * ret - p.margin * p.lev * FEE}; });
    const g = genRange(l, tr, tr.lastT, t1, tr.k); applyEvs(tr, evs.concat(g.ev), t1); g.tail.forEach(x => { if (tr.open.length < 3) tr.open.push(mkOpen(l, tr, x.t, x.hold, x.sym, x.p0, x.rn)); }); tr.lastT = t1; tr.nextAt = t1 + 15e3 + Math.random() * 90e3; trim(tr);
  } catch (e) { console.warn("sim catchup", l.id, e); } });
  dirty = true; save(true); SER = {};
  ready = true; refresh(); readyCbs.splice(0).forEach(f => { try { f(); } catch {} }); emit("ready");
}

/* ---- stats ---- */
const PERD = [7, 30, 90];
const markOf = p => price(p.sym);
function pnlOf(p, mark){
  mark = mark || markOf(p); const s = p.long ? 1 : -1, d = (mark / p.entry - 1) * s;
  if (p.bin) return {pnl: 0, roi: 0};
  return {pnl: p.margin * p.lev * d - p.margin * p.lev * FEE, roi: p.lev * d * 100};
}
const unreal = tr => tr.open.reduce((a, p) => a + pnlOf(p).pnl, 0);
function stats(id, per){
  const tr = ST && ST.T[id], l = BYID[id]; if (!tr || !l) return null; per = per == null ? 1 : per;
  const now = Date.now(), len = tr.eq.length; if (!len) return null;
  const st = Math.max(now - PERD[per] * DAY, tr.t0), i0 = clamp(Math.floor((st - tr.eq0) / EQS), 0, len - 1), eq0 = tr.eq[i0], end = tr.cum + unreal(tr), base = tr.e0 + eq0;
  let peak = base, mdd = 0; for (let i = i0; i <= len; i++){ const v = tr.e0 + (i === len ? end : tr.eq[i]); if (v > peak) peak = v; mdd = Math.max(mdd, (peak - v) / peak * 100); }
  let n = 0, w = 0; for (let d = dIdx(tr, st); d < tr.dn.length; d++){ n += tr.dn[d]; w += tr.dw[d]; }
  const days = Math.max(1, Math.min(PERD[per], (now - tr.t0) / DAY)), roi30 = per === 1 ? (end - eq0) / base * 100 : null;
  const aumK = 1 + clamp((l.roi[1] || 0) / 100, -.4, .8) * .15;
  return {roi: (end - eq0) / base * 100, pnl: end - eq0, wr: n ? w / n * 100 : l.o.wr, mdd: Math.min(99, mdd), n, tpd: n / days, f: tr.f, aum: l.o.aum * (tr.f / l.o.f) * aumK, e0: tr.e0, roi30};
}
function curve(id, per, n){
  const tr = ST && ST.T[id]; if (!tr || !tr.eq.length) return null; n = n || 36;
  const now = Date.now(), len = tr.eq.length, st = Math.max(now - PERD[per] * DAY, tr.t0), i0 = clamp(Math.floor((st - tr.eq0) / EQS), 0, len - 1), a = tr.eq.slice(i0).concat([tr.cum + unreal(tr)]), base = tr.e0 + a[0], out = [];
  for (let i = 0; i < n; i++){ const x = i / (n - 1) * (a.length - 1), j = Math.floor(x), f = x - j, v = a[j] + ((a[Math.min(j + 1, a.length - 1)] - a[j]) * f); out.push((v - a[0]) / base * 100); }
  return out;
}
function refresh(){
  if (!ST) return;
  LD.forEach(l => { const s = [0, 1, 2].map(p => stats(l.id, p)); if (!s[0]) return;
    l.roi = s.map(x => +x.roi.toFixed(2)); l.pnl30 = Math.round(s[1].pnl); l.wr = +s[1].wr.toFixed(1); l.mdd = +s[1].mdd.toFixed(2); l.aum = Math.round(s[1].aum); l.f = s[1].f; });
  (window.COPY_LEADERS || []).forEach(x => { const l = BYID[x.id]; if (l){ x.roi = l.roi[1]; x.pnl30 = l.pnl30; x.aum = l.aum; x.wr = l.wr; x.f = l.f; } });
}

/* ---- live loop ---- */
const L_ = {};
function on(ev, f){ (L_[ev] ||= []).push(f); return () => { L_[ev] = L_[ev].filter(x => x !== f); }; }
function emit(ev, a, b){ (L_[ev] || []).slice().forEach(f => { try { f(a, b); } catch (e) { console.warn(e); } }); }
function closeLive(l, tr, p, mark, why, now){
  const bin = !!p.bin, s = p.long ? 1 : -1; let pnl;
  if (bin){ const win = (mark - p.entry) * s > 0; pnl = win ? p.margin * p.pay / 100 : -p.margin; } else pnl = pnlOf(p, mark).pnl;
  tr.open = tr.open.filter(x => x.id !== p.id); tr.cum += pnl; addAgg(tr, now, pnl);
  const c = mkClosed({id:p.id, sym:p.sym, long:p.long, lev:p.lev, entry:p.entry, exit:mark, margin:p.margin, t:p.t, ct:now, pnl, bin:p.bin, pay:p.pay}); c.why = why;
  tr.closed.unshift(c); tr.closed.length = Math.min(tr.closed.length, CLOSED_CAP); tr.feed.unshift(feedClose(c)); tr.feed.length = Math.min(tr.feed.length, FEED_CAP);
  dirty = true; emit("close", l.id, Object.assign({}, p, {exit: mark, ct: now, pnl, roi: c.roi, why}));
}
function openLive(l, tr, now, hot){
  const pr = profOf(l), sym = pickSym(l, Math.random), px = price(sym); if (!(px > 0)) return;
  const m = mom(sym), t = pr.type; let long;
  if (t === "trend") long = Math.random() < .65 ? m >= 0 : m < 0; else if (t === "scalper") long = Math.random() < .55 ? m < 0 : m >= 0; else long = Math.random() < .55;
  const lev = l.bin ? 1 : pr.levs[Math.floor(Math.random() * pr.levs.length)];
  const hr = l.bin ? (t === "scalper" ? [MIN, 6 * MIN] : [10 * MIN, 45 * MIN]) : pr.hold, spd = hot ? (l.bin ? .25 : pr.spd) : 1, hold = Math.max(hot ? 45e3 : 60e3, (hr[0] + Math.random() * (hr[1] - hr[0])) * spd);
  const p = mkOpen(l, tr, now, hold, sym, px, Math.random(), tr.k); p.long = long; p.lev = lev;
  if (!l.bin){ const dir = long ? 1 : -1, wr = clamp(l.o.wr / 100, .45, .85), slP = pr.sl * (.7 + .6 * Math.random()); p.sl = r6(px * (1 - dir * slP)); p.tp = r6(px * (1 + dir * Math.max(slP * .15, slP * (1 - wr) / wr))); }
  tr.open.push(p); tr.feed.unshift(feedOpen(p)); tr.feed.length = Math.min(tr.feed.length, FEED_CAP); dirty = true; emit("open", l.id, p);
}
let tickN = 0;
function tick(){
  if (!ready || !ST) return; const now = Date.now(); tickN++; walkFallback(now); if (tickN % 10 === 1) samplePH(now);
  LD.forEach(l => { const tr = ST.T[l.id]; if (!tr) return; const hot = (watched[l.id] || 0) > now, pr = profOf(l);
    if (tr.eq0 + tr.eq.length * EQS <= now){ tr.eq.push(Math.round(tr.cum)); trim(tr); dirty = true; }
    tr.open.slice().forEach(p => { const mark = markOf(p); if (!(mark > 0)) return; const s = p.long ? 1 : -1;
      if (now >= p.maxT) return closeLive(l, tr, p, mark, p.bin ? "Expired" : "Time", now);
      if (!p.bin){ if ((mark - p.tp) * s >= 0) return closeLive(l, tr, p, mark, "Take profit", now); if ((mark - p.sl) * s <= 0) return closeLive(l, tr, p, mark, "Stop loss", now); } });
    const cap = (l.bin ? 8 : pr.cap) + (hot ? 2 : 0);
    if (now >= tr.nextAt){ if (tr.open.length < cap) openLive(l, tr, now, hot);
      const g = hot ? [20e3, 90e3] : l.bin ? [Math.max(MIN, DAY / Math.max(4, l.tpd) * .5), DAY / Math.max(4, l.tpd) * 1.5] : pr.gap; tr.nextAt = now + g[0] + Math.random() * (g[1] - g[0]); }
    if (now - tr.fa > 25e3){ tr.fa = now + Math.random() * 20e3; const r30 = (l.roi[1] || 0); if (Math.random() < .6) tr.f = clamp(tr.f + (Math.random() < .52 + clamp(r30 / 300, -.1, .15) ? 1 : -1), 20, 2000); dirty = true; }
    tr.lastT = now; });
  if (now - lastCurve > 5000){ lastCurve = now; try { mirrorCurve(now); } catch (e) { console.warn(e); } if (tickN % 3 === 0){ refresh(); emit("refresh"); } }
  save();
}
U.bus.on("sec", tick);

/* ============================ COPY MIRRORING ============================ */
const mirrorOf = c => c.mir || null;
function userMargin(c, tr, p){
  let um = c.sizing === "ratio" ? p.margin * c.modeVal * (c.amt / Math.max(1, tr.e0 + tr.cum)) : c.modeVal;
  if (c.maxOrder > 0) um = Math.min(um, c.maxOrder);
  const m = c.mir, used = m.open.reduce((a, x) => a + x.m, 0), free = c.amt + m.realized - used;
  return Math.min(um, free);
}
on("open", (tid, p) => { const X = window.COPYX; if (!X) return; const l = BYID[tid], tr = ST.T[tid];
  X.cstate().active.forEach(c => { if (c.lid !== tid || !c.mir) return; const um = userMargin(c, tr, p); if (!(um >= 1)) return;
    c.mir.open.push({pid:p.id, m:r2(um), sym:p.sym, long:p.long, lev:p.lev, entry:p.entry, t:p.t, bin:p.bin}); dirty = true; X.save(); }); });
on("close", (tid, p) => { const X = window.COPYX; if (!X) return;
  X.cstate().active.forEach(c => { if (c.lid !== tid || !c.mir) return; const i = c.mir.open.findIndex(x => x.pid === p.id); if (i < 0) return; const o = c.mir.open.splice(i, 1)[0], pnl = o.m * (p.pnl / p.margin);
    c.mir.realized += pnl; c.mir.closed.unshift({sym:o.sym, long:o.long, lev:o.lev, entry:o.entry, exit:p.exit, m:o.m, pnl:r2(pnl), t:o.t, ct:p.ct, bin:o.bin}); c.mir.closed.length = Math.min(c.mir.closed.length, 40); X.save(); }); });
function mirrorPct(c){
  const m = c.mir, tr = ST && ST.T[c.lid]; let un = 0;
  if (tr) m.open.forEach(o => { const p = tr.open.find(x => x.id === o.pid); if (p && !p.bin) un += o.m * pnlOf(p).pnl / p.margin; });
  return (m.realized + un) / c.amt * 100;
}
function mirrorCurve(now){ const X = window.COPYX; if (!X) return; X.cstate().active.forEach(c => { if (!c.mir) return; const a = c.mir.curve ||= []; a.push([now, +mirrorPct(c).toFixed(3)]); if (a.length > 360){ const k = []; a.forEach((x, i) => { if (i % 2 === 0 || i === a.length - 1) k.push(x); }); c.mir.curve = k; } }); }
function copyPct(c, t){
  if (!c.mir || !ST) return null; const now = Date.now(); t = t == null ? now : t; if (t >= now - 2500) return clamp(mirrorPct(c), -95, 1000);
  const a = c.mir.curve || []; if (!a.length || t <= c.since) return 0; if (t <= a[0][0]) return a[0][1] * Math.max(0, (t - c.since) / Math.max(1, a[0][0] - c.since));
  let lo = 0, hi = a.length - 1; if (t >= a[hi][0]) return a[hi][1]; while (lo < hi - 1){ const m = (lo + hi) >> 1; if (a[m][0] <= t) lo = m; else hi = m; }
  return a[lo][1] + (a[hi][1] - a[lo][1]) * (t - a[lo][0]) / Math.max(1, a[hi][0] - a[lo][0]);
}
const newMir = () => ({open:[], closed:[], realized:0, curve:[]});

/* ============================ PUBLIC API ============================ */
window.SIM = {
  boot, on, stats, curve, refresh, copyPct, newMir, price, pnlOf, fmtPx,
  get ready(){ return ready; }, get started(){ return booted; },
  whenReady(cb, ms){ if (ready) return cb(); let done = false; const f = () => { if (!done){ done = true; cb(); } }; readyCbs.push(f); setTimeout(f, ms || 4500); boot(); },
  open(id){ const tr = ST && ST.T[id]; return tr ? tr.open.map(p => Object.assign({mark: markOf(p), size: p.margin * p.lev / p.entry}, p)).sort((a, b) => b.t - a.t) : null; },
  closed(id, n){ const tr = ST && ST.T[id]; return tr ? tr.closed.slice(0, n || 30) : null; },
  feed(id, n){ const tr = ST && ST.T[id]; return tr ? tr.feed.slice(0, n || 20) : null; },
  watch(id){ const now = Date.now(); const was = (watched[id] || 0) > now; watched[id] = now + 3 * MIN; const tr = ST && ST.T[id]; if (!was && tr) tr.nextAt = Math.min(tr.nextAt, now + 6e3 + Math.random() * 14e3); },
  mirror(c){ return c.mir || null; },
  reset(){ try { localStorage.removeItem(KEY); } catch {} }
};
setTimeout(boot, 2500);

/* the copy page waits (briefly) for the simulation, so the first list render already uses simulated data */
(function wrap(){
  if (!window.Pages || !Pages.copy || Pages.copy.__sim) return; const orig = Pages.copy;
  Pages.copy = function(){ const pg = orig.apply(this, arguments), m = pg.mount; let gone = false, un = pg.unmount;
    pg.mount = function(r){ const self = this; SIM.whenReady(() => { if (gone || !r.isConnected) return; m.call(self, r); }, 5000); };
    pg.unmount = function(){ gone = true; return un && un.apply(this, arguments); };
    return pg; };
  Pages.copy.__sim = 1;
})();
})();
