/* ===== v7.1 API Trade — connect an exchange API, follow signal channels, trades open automatically (no confirmation) =====
   Route: #/apitrade · #/apitrade/trades · #/apitrade/connect · #/apitrade/ch/<channel id>
   Keys: stored ONLY on this device (localStorage "nt_apitrade"), never sent anywhere. Live exchange connection comes later;
   for now every copied trade runs on the user's NovaTrade Futures wallet through the internal futures engine (E.openFut / E.closeFut).
   State: U.store.s.apitrade = {follow:{[channelId]:settings}, trades:[open], history:[closed], skips:[], sigs:{[signalId]:{entry}}}
   Signals are generated from the clock (same on every device): slot times, pair, side, leverage, TP/SL % and the result come from a
   seeded generator; only the entry price is taken from the live price the first time a device sees the signal.
   One background ticker (1 s) runs while a channel is followed / a copied trade is open / the page is open, and stops otherwise. */
(function(){
const {esc, ic, store, fmt, toast, bus} = U;
const CK = "nt_apitrade";
const S = () => { const s = store.s; s.apitrade = s.apitrade || {}; const a = s.apitrade;
  a.follow = a.follow || {}; a.trades = a.trades || []; a.history = a.history || []; a.skips = a.skips || []; a.sigs = a.sigs || {}; return a; };
const now = () => Date.now();
const hap = (p = 8) => U.buzz && U.buzz(p);
const save = () => { store.save(); bus.emit("apitrade"); };

/* ---------- seeded helpers (same idea as page-x2.js) ---------- */
const hash = s => { let h = 2166136261; for (const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const hash01 = s => hash(s) / 4294967296;
const rngFor = seed => { let a = hash(seed); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

/* ---------- channels ---------- */
const CHANNELS = [
  {id:"nova",  name:"NovaTrade Signals", style:"Futures · Majors",    verified:true,  wr:78, roi:42.6, fol:18420, grow:37, hue:215, g:"star",  pool:["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","BTCUSDT","ETHUSDT"], per:5,   dur:[6, 25],   levs:[5,10,10,20],   tp:[.7, 1.6], sl:[.4, .9]},
  {id:"scalp", name:"Scalp Pro",         style:"Fast scalps · 1–10 min", verified:true,  wr:71, roi:63.8, fol:9210,  grow:21, hue:160, g:"bolt",  pool:["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","DOGEUSDT"],           per:3,   dur:[2, 9],    levs:[10,20,25,50],  tp:[.25,.6],  sl:[.15,.35]},
  {id:"swing", name:"Swing Desk",        style:"Swing · hours to days",  verified:true,  wr:64, roi:28.4, fol:12650, grow:29, hue:265, g:"wave",  pool:["BTCUSDT","ETHUSDT","BNBUSDT","ADAUSDT","LINKUSDT"],          per:11,  dur:[40, 180], levs:[3,5,5,10],     tp:[2.2, 4.8],sl:[1.2, 2.2]},
  {id:"gold",  name:"Gold & FX",         style:"Gold · Forex · Metals",  verified:true,  wr:69, roi:19.7, fol:7380,  grow:14, hue:42,  g:"coin",  pool:["XAUUSD","XAUUSD","EURUSD","GBPUSD","XAGUSD","USDJPY"],        per:7,   dur:[12, 60],  levs:[10,20,25,50],  tp:[.25,.7],  sl:[.15,.4]},
  {id:"alt",   name:"Altcoin Alpha",     style:"Altcoin breakouts",      verified:false, wr:66, roi:51.2, fol:3940,  grow:11, hue:330, g:"rocket",pool:["SOLUSDT","AVAXUSDT","LINKUSDT","DOGEUSDT","ADAUSDT","XRPUSDT"], per:4, dur:[6, 30],   levs:[5,10,10,20],   tp:[1.0, 2.4],sl:[.6, 1.3]},
];
const CHB = Object.fromEntries(CHANNELS.map(c => [c.id, c]));
const followersOf = c => c.fol + Math.floor((now() / 864e5 - 20000) * c.grow);
const lerp = (r, u) => r[0] + (r[1] - r[0]) * u;

/* signals of a channel: newest first, deterministic by time. Entry price is cached the first time this device sees the signal */
function entryFor(c, sg, p){
  const A = S(); let e = A.sigs[sg.id];
  if (!e){
    const live = p.price, age = Math.max(0, now() - sg.t), r = rngFor(sg.id + "e");
    let px = live;
    if (age > 60e3){ const mv = (r() - .5) * 2 * Math.min(.012, .0015 + age / 36e5 * .004); px = live * (1 + mv); }   // older signals: entry near the live price
    e = A.sigs[sg.id] = {entry: +px.toPrecision(7)};
    const ids = Object.keys(A.sigs); if (ids.length > 160) ids.slice(0, ids.length - 120).forEach(k => delete A.sigs[k]);
  }
  return e.entry;
}
function signalsOf(c, n = 14, t = now()){
  const per = c.per * 60e3, off = hash01(c.id + "off") * per, out = [];
  let k = Math.floor((t + off) / per);
  for (let guard = 0; out.length < n && guard < n * 4; guard++, k--){
    const r = rngFor(c.id + "|" + k), jit = r() * .6, st = k * per - off + jit * per;
    if (st > t) continue;
    const sym = c.pool[Math.floor(r() * c.pool.length)], p = window.M && M.get(sym);
    const side = r() < .5 ? "long" : "short", lev = c.levs[Math.floor(r() * c.levs.length)], tpP = lerp(c.tp, r()), slP = lerp(c.sl, r());
    const dur = Math.round(lerp(c.dur, r()) * 60e3), win = r() < c.wr / 100;
    if (!p || !(p.price > 0)) continue;
    const sg = {id: c.id + ":" + k, ch: c.id, t: Math.floor(st), sym, side, lev, tpP: +tpP.toFixed(2), slP: +slP.toFixed(2), dur, win};
    sg.entry = entryFor(c, sg, p);
    const L = side === "long";
    sg.tp = +(sg.entry * (1 + (L ? 1 : -1) * tpP / 100)).toPrecision(7); sg.sl = +(sg.entry * (1 - (L ? 1 : -1) * slP / 100)).toPrecision(7);
    sg.end = sg.t + dur; sg.state = t >= sg.end ? (win ? "tp" : "sl") : "active";
    out.push(sg);
  }
  return out;
}

/* ---------- exchange connection (this device only) ---------- */
const EXS = [
  {id:"binance", name:"Binance", site:"binance.com", pass:false},
  {id:"bybit",   name:"Bybit",   site:"bybit.com",   pass:false},
  {id:"okx",     name:"OKX",     site:"okx.com",     pass:true},
  {id:"bitget",  name:"Bitget",  site:"bitget.com",  pass:true},
  {id:"kucoin",  name:"KuCoin",  site:"kucoin.com",  pass:true},
];
const EXB = Object.fromEntries(EXS.map(x => [x.id, x]));
const conn = () => { try { const c = JSON.parse(localStorage.getItem(CK) || "null"); return c && c.ex && c.key && c.secret ? c : null; } catch { return null; } };
const connSave = c => { try { localStorage.setItem(CK, JSON.stringify(c)); return true; } catch { return false; } };
const connDrop = () => { try { localStorage.removeItem(CK); } catch {} };
const maskKey = k => k.length <= 8 ? "••••••••" : k.slice(0, 4) + "••••••••" + k.slice(-4);
const STATUS = "Connected · Live connection coming soon — trades run on your NovaTrade Futures wallet for now";
const exLogo = (ex, size = 36) => `<span class="at-lg" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .44)}px"><b>${esc(ex.name[0])}</b><img src="https://www.google.com/s2/favicons?domain=${ex.site}&sz=64" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span>`;

/* ---------- formatting ---------- */
const usd = (v, d = 2) => (v < 0 ? "-" : "") + fmt(Math.abs(v || 0), d);
const sg = v => (v > 0.004 ? "+" : v < -0.004 ? "-" : "") + fmt(Math.abs(v || 0), 2);
const pc = v => (v > 0.04 ? "+" : v < -0.04 ? "-" : "") + fmt(Math.abs(v || 0), 1) + "%";
const cls = v => v > 0.004 ? "up" : v < -0.004 ? "down" : "";
const unc = v => String(v == null ? "" : v).replace(/,/g, "");
const cin = v => { v = unc(v); if (v === "") return ""; const k = v.indexOf("."), i = (k < 0 ? v : v.slice(0, k)).replace(/^0+(?=\d)/, ""), d = k < 0 ? null : v.slice(k + 1); return (i === "" ? "0" : i).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (d != null ? "." + d : ""); };
function numInput(el, dec, onCh){
  if (!el) return;
  el.addEventListener("input", () => {
    const pos = el.selectionStart == null ? el.value.length : el.selectionStart, raw = el.value; let before = 0; for (let i = 0; i < pos; i++) if (/[\d.]/.test(raw[i])) before++;
    let v = raw.replace(/[^\d.]/g, ""); const dot = v.indexOf(".");
    if (dec <= 0) v = v.replace(/\./g, ""); else if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, dec);
    const out = cin(v); el.value = out;
    let c = 0, i = 0; while (i < out.length && c < before){ if (/[\d.]/.test(out[i])) c++; i++; }
    try { el.setSelectionRange(i, i); } catch {}
    onCh && onCh(unc(out));
  });
}
const ago = t => { const d = Math.max(0, (now() - t) / 1000); if (d < 60) return Math.max(1, Math.floor(d)) + "s ago"; if (d < 3600) return Math.floor(d / 60) + "m ago"; if (d < 86400) return Math.floor(d / 3600) + "h ago"; return Math.floor(d / 86400) + "d ago"; };
const clock = t => new Date(t).toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit"});
const pairOf = s => window.M && M.get(s);
const labelOf = s => { const p = pairOf(s); return p ? M.label(p) : s; };
const px = (s, v) => { const p = pairOf(s); return p ? M.fmtPx(p, v) : fmt(v, 2); };
const tip = (t, h) => (UI.tip || UI.help)(t, h);
const dayKey = () => new Date().toDateString();

/* ---------- trading logic ---------- */
const openTrades = () => S().trades;
const posOf = id => store.s.fut && store.s.fut.positions.find(p => p.id === id);
const anyFollow = () => Object.values(S().follow).some(f => f.on);
const followOn = id => !!(S().follow[id] && S().follow[id].on);
function todayPnl(chId){ const d0 = new Date(); d0.setHours(0, 0, 0, 0); return S().history.filter(h => (!chId || h.ch === chId) && h.closed >= d0.getTime()).reduce((a, h) => a + h.profit, 0); }
function skip(c, sig, why, notify = true){
  const A = S(); if (A.skips.some(s => s.sid === sig.id)) return;
  A.skips.unshift({sid: sig.id, t: now(), ch: c.id, sym: sig.sym, side: sig.side, why}); A.skips = A.skips.slice(0, 20);
  if (notify) toast("Signal skipped: " + why, "info", 3200);
  save();
}
function copySignal(c, sig, f){
  const A = S();
  if (!window.E || !E.openFut) return;
  if (A.trades.length >= f.maxOpen) return skip(c, sig, "Max open trades reached");
  if (todayPnl(c.id) <= -f.dailyLoss){
    if (f.limitDay !== dayKey()){ f.limitDay = dayKey(); U.pushNotif("trade", "Daily loss limit reached", `${c.name}: new signals are paused until tomorrow.`, "info"); }
    return skip(c, sig, "Daily loss limit reached", false);
  }
  const fut = store.s.fut.positions;
  if (fut.some(p => p.sym === sig.sym && p.side === sig.side)) return skip(c, sig, "Already holding " + labelOf(sig.sym) + " " + (sig.side === "long" ? "Long" : "Short"));
  const p = pairOf(sig.sym); if (!p) return;
  const lev = Math.max(1, Math.min(sig.lev, f.maxLev, E.maxLev ? E.maxLev(p) : 125)), L = sig.side === "long";
  const tp = f.copyTp ? +(p.price * (1 + (L ? 1 : -1) * sig.tpP / 100)).toPrecision(7) : null, sl = f.copyTp ? +(p.price * (1 - (L ? 1 : -1) * sig.slP / 100)).toPrecision(7) : null;
  const r = E.openFut({sym: sig.sym, side: sig.side, margin: f.amount, lev, tp, sl, mode: "isolated"});
  if (r.err) return skip(c, sig, r.err.replace(/\.$/, ""));
  const pos = r.pos;
  A.trades.unshift({id: pos.id, ch: c.id, sid: sig.id, sym: sig.sym, side: sig.side, lev, margin: pos.margin, entry: pos.entry, t: now(), copyTp: !!f.copyTp, res: f.copyTp ? {at: sig.end, win: sig.win} : null, manual: false});
  const L2 = labelOf(sig.sym) + " " + (L ? "Long" : "Short") + " " + lev + "x";
  toast(`Trade opened: ${L2}`, "ok", 3200); U.fx && U.fx("open");
  U.pushNotif("trade", "API trade opened", `${c.name} · ${L2} · ${fmt(pos.margin, 2)} USDT at ${px(sig.sym, pos.entry)}`, "info");
  save();
}
function engine(){
  const A = S(), t = now();
  Object.keys(A.follow).forEach(id => {
    const f = A.follow[id], c = CHB[id]; if (!f.on || !c) return;
    f.done = f.done || [];
    signalsOf(c, 2, t).forEach(s => {
      if (s.state !== "active" || s.t <= f.since || t - s.t > 180e3 || f.done.includes(s.id)) return;
      f.done.push(s.id); f.done = f.done.slice(-30); copySignal(c, s, f);
    });
  });
  /* resolve copied trades at the channel's result time (TP or SL), unless the user took manual control */
  A.trades.slice().forEach(tr => {
    const p = posOf(tr.id);
    if (!p){ finish(tr, null); return; }
    if (tr.res && !tr.manual && t >= tr.res.at && p.tp && p.sl){ E.closeFut(tr.id, tr.res.win ? "tp" : "sl", tr.res.win ? p.tp : p.sl); }
  });
}
/* a copied trade ended (engine TP/SL, liquidation, manual close, forced result): move it to history */
function finish(tr, info){
  const A = S(); if (!A.trades.includes(tr)) return;
  A.trades = A.trades.filter(x => x !== tr);
  if (!info){ const h = store.s.fut.history.find(x => x.id === tr.id); info = h ? {profit: h.profit, reason: h.reason, px: h.exit} : {profit: 0, reason: "manual", px: tr.entry}; }
  A.history.unshift({id: tr.id, ch: tr.ch, sym: tr.sym, side: tr.side, lev: tr.lev, margin: tr.margin, entry: tr.entry, exit: info.px, profit: info.profit, roi: tr.margin ? info.profit / tr.margin * 100 : 0, reason: info.reason, open: tr.t, closed: now()});
  A.history = A.history.slice(0, 100); save();
}
bus.on("futClosed", ({pos, profit, reason, px}) => { const tr = S().trades.find(x => x.id === pos.id); if (tr) finish(tr, {profit, reason, px}); });

/* single ticker */
let T = null; const uiCbs = new Set();
function tick(){ try { engine(); } catch (e){ console.error(e); } uiCbs.forEach(f => { try { f(); } catch {} }); }
function arm(){
  const need = anyFollow() || openTrades().length || uiCbs.size;
  if (need && !T) T = setInterval(tick, 1000); else if (!need && T){ clearInterval(T); T = null; }
}
bus.on("apitrade", arm);

/* ---------- UI helpers ---------- */
const VT = (s = 15) => `<svg class="at-vt" width="${s}" height="${s}" viewBox="0 0 24 24" role="img" aria-label="Verified"><path d="M12 1.8l2.6 1.9 3.2-.1 1 3 2.6 1.9-.9 3.1.9 3.1-2.6 1.9-1 3-3.2-.1L12 22.2l-2.6-1.9-3.2.1-1-3-2.6-1.9.9-3.1-.9-3.1 2.6-1.9 1-3 3.2.1z" fill="#2E8BFF"/><path d="M7.9 12.3l2.9 2.9 5.4-5.8" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const GLY = {
  star:'<path d="M12 3.2l2.6 5.6 6 .7-4.5 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.4 9.5l6-.7z"/>',
  bolt:'<path d="M13.2 2.5L5 13.6h6l-1 7.9 8.2-11.3h-6z"/>',
  wave:'<path d="M3 15c2.5-7 5-7 7.5-.5S16 21 21 9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
  coin:'<circle cx="12" cy="12" r="8.4" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M12 7.6v8.8M9.4 10h3.5a1.6 1.6 0 010 3.2H10a1.6 1.6 0 000 3.2h4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  rocket:'<path d="M12 2.6c3.4 2.2 4.8 6 4.2 10.4l-2.4 1.6h-3.6L7.8 13C7.2 8.6 8.6 4.8 12 2.6z"/><path d="M8.6 15.6L6 18.8l3.2-.4M15.4 15.6l2.6 3.2-3.2-.4M12 16.6v4.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
};
const avatar = (c, size = 44) => `<span class="at-av" style="width:${size}px;height:${size}px;background:linear-gradient(145deg,hsl(${c.hue} 78% 62%),hsl(${(c.hue + 28) % 360} 70% 42%))"><svg viewBox="0 0 24 24" width="${Math.round(size * .56)}" height="${Math.round(size * .56)}" fill="#fff" aria-hidden="true">${GLY[c.g]}</svg></span>`;
function roiSeries(c){
  const r = rngFor(c.id + "sp" + Math.floor(now() / 864e5)), n = 30, raw = []; let v = 0;
  for (let i = 0; i < n; i++){ v += (r() - .36) * 2 + .5; raw.push(v); }
  const k = c.roi / (raw[n - 1] || 1); return raw.map(x => x * k);
}
function spark(c, w = 84, h = 30){
  const s = roiSeries(c), mn = Math.min(0, ...s), mx = Math.max(...s), X = i => i / (s.length - 1) * (w - 2) + 1, Y = v => h - 3 - (v - mn) / (mx - mn || 1) * (h - 6);
  const d = s.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join("");
  return `<svg class="at-sp" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}L${w - 1} ${h}L1 ${h}Z" class="at-sp-a"/><path d="${d}" class="at-sp-l"/></svg>`;
}
const qI = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.3-2.8 4"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/></svg>`;
const linkI = (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>`;
const q = k => `<button type="button" class="at-q" data-q="${k}" aria-label="Help">${qI}</button>`;

/* ---------- help popups ---------- */
const sv = (vb, label, b) => `<svg viewBox="${vb}" class="at-sv" role="img" aria-label="${esc(label)}">${b}</svg>`;
const SVG_STEPS = [
  sv("0 0 300 96", "Your exchange connects to NovaTrade with an API key",
    `<rect class="bx" x="8" y="18" width="96" height="52" rx="10"/><text x="56" y="40" text-anchor="middle" class="tb">Your</text><text x="56" y="55" text-anchor="middle" class="tb">exchange</text>
     <rect class="bx on" x="196" y="18" width="96" height="52" rx="10"/><text x="244" y="40" text-anchor="middle" class="tb">NovaTrade</text><text x="244" y="55" text-anchor="middle" class="tb">API Trade</text>
     <path class="ln" d="M108 44h84"/><path class="fb" d="M192 44l-7-5v10z"/><circle class="fb" cx="150" cy="44" r="12"/><path class="wh" d="M145 47a4 4 0 1 1 3.4-6l7 .1M153 41v3M156 41v3" />
     <text x="150" y="76" text-anchor="middle" class="ts">API key + secret</text><text x="150" y="90" text-anchor="middle" class="ts">saved on this device only</text>`),
  sv("0 0 300 96", "Pick a signal channel and follow it",
    `${[0, 1, 2].map(i => `<g transform="translate(${28 + i * 84} 10)"><circle cx="24" cy="24" r="22" class="${i === 1 ? "bx on" : "bx"}"/><circle cx="24" cy="24" r="13" fill="hsl(${[215, 160, 265][i]} 70% 55%)"/><text x="24" y="63" text-anchor="middle" class="tb">${["Signals", "Scalp", "Swing"][i]}</text></g>`).join("")}
     <circle cx="148" cy="12" r="0"/><rect class="fb" x="122" y="68" width="52" height="20" rx="10"/><text x="148" y="82" text-anchor="middle" class="tw">Follow</text><circle class="up" cx="178" cy="14" r="9"/><path class="wh" d="M173.8 14l3 3 5-5.6"/>`),
  sv("0 0 300 96", "A signal arrives and the trade opens at once with take profit and stop loss",
    `<path class="ln2" d="M10 70L60 62 100 66 140 46 180 52 232 28 290 34"/>
     <line class="tpl" x1="100" x2="290" y1="22" y2="22"/><line class="slh" x1="100" x2="290" y1="82" y2="82"/>
     <text x="292" y="18" text-anchor="end" class="tu">TP</text><text x="292" y="93" text-anchor="end" class="td">SL</text>
     <circle class="fb" cx="100" cy="66" r="6"/><rect class="bx on" x="14" y="8" width="104" height="24" rx="12"/><text x="66" y="24" text-anchor="middle" class="tb">Signal: Long</text><path class="ln" d="M100 34v26"/>`),
  sv("0 0 300 96", "Safety: Read and Trade permission only, Withdraw off",
    `<path class="shd" d="M52 8l34 12v26c0 20-14 34-34 42-20-8-34-22-34-42V20z"/><path class="wh2" d="M36 48l11 11 20-22"/>
     ${[["Read", 1], ["Trade", 1], ["Withdraw", 0]].map(([n, on], i) => `<g transform="translate(112 ${6 + i * 29})"><text x="0" y="17" class="tb">${n}</text><rect x="118" y="2" width="52" height="24" rx="12" class="${on ? "tg on" : "tg off"}"/><circle cx="${on ? 158 : 130}" cy="14" r="9" fill="#fff"/><text x="182" y="18" class="${on ? "tu" : "td"}">${on ? "ON" : "OFF"}</text></g>`).join("")}`),
];
const HIW = [
  ["Connect your exchange API", "Pick your exchange and paste an API key and secret that has Read + Trade permission. Your keys stay on this device only and are never sent anywhere."],
  ["Choose a signal channel", "Each channel shows its win rate, 30-day ROI and followers. Open one to see its recent signals, then set how much you want to risk."],
  ["Trades open automatically", "When the channel posts a new signal your trade opens instantly. There is no confirmation screen. Take profit and stop loss are copied and close the trade for you."],
  ["Stay in control", "Set an amount per trade, a maximum leverage, a limit on open trades and a daily loss limit. You can close or edit any trade, or stop following, at any time."],
];
function hiwPop(){
  tip("How it works", `<p class="at-hw-lead">API Trade follows signal channels for you: when a channel posts a trade, the same trade opens in your account.</p>
    <ol class="at-hws">${HIW.map((h, i) => `<li><div class="at-hws-h"><em>${i + 1}</em><b>${esc(h[0])}</b></div><p>${esc(h[1])}</p>${SVG_STEPS[i]}</li>`).join("")}</ol>
    <p class="at-fine">For now trades run on your NovaTrade Futures wallet. Live trading on your own exchange account is coming soon. Signals are not financial advice and you can lose the money you put in a trade.</p>`);
}
const TIPS = {
  amount: ["Amount per trade", () => `<p>The margin (in USDT) used for every copied trade. A larger amount means bigger profits and bigger losses.</p><p>Position size = amount × leverage. For example 50 USDT at 10x opens a 500 USDT position.</p>`],
  lev: ["Max leverage", () => `<p>The highest leverage a copied trade may use. If a signal asks for more, your trade uses this limit instead.</p>${sv("0 0 260 70", "Leverage multiplies the position size", `<rect class="bx" x="10" y="26" width="50" height="30" rx="6"/><text x="35" y="46" text-anchor="middle" class="tb">50</text><path class="ln" d="M66 41h40"/><path class="fb" d="M106 41l-7-5v10z"/><text x="86" y="32" text-anchor="middle" class="ts">10x</text><rect class="bx on" x="114" y="10" width="136" height="48" rx="8"/><text x="182" y="40" text-anchor="middle" class="tb">500 position</text>`)}<p>Higher leverage moves your profit and loss faster.</p>`],
  open: ["Max open trades", () => `<p>The most copied trades that can be open at the same time. New signals are skipped while you are at the limit.</p>`],
  tpsl: ["Copy TP / SL", () => `<p><b>TP</b> (take profit) closes the trade when it reaches the channel's target. <b>SL</b> (stop loss) closes it if the price goes against you.</p>${sv("0 0 260 90", "Take profit above the entry and stop loss below", `<line class="tpl" x1="10" x2="250" y1="14" y2="14"/><line class="ln" x1="10" x2="250" y1="46" y2="46"/><line class="slh" x1="10" x2="250" y1="78" y2="78"/><text x="14" y="10" class="tu">Take profit</text><text x="14" y="42" class="tb">Entry</text><text x="14" y="90" class="td">Stop loss</text><path class="ln2" d="M120 46L150 38 180 30 210 14"/>`)}<p>Turn it off to manage the exit yourself. Without TP/SL a trade stays open until you close it.</p>`],
  daily: ["Daily loss limit", () => `<p>If the trades you copied from this channel lose this much (in USDT) today, new signals are skipped until tomorrow.</p>${sv("0 0 260 64", "Daily loss limit bar", `<rect class="bx" x="10" y="22" width="240" height="16" rx="8"/><rect class="dnf" x="10" y="22" width="150" height="16" rx="8"/><text x="10" y="14" class="ts">Lost today</text><text x="250" y="14" text-anchor="end" class="td">Limit</text><text x="130" y="56" text-anchor="middle" class="ts">New signals pause at the limit</text>`)}`],
  perm: ["Why Read + Trade only?", () => `<p>An API key can have several permissions. API Trade needs only <b>Read</b> (see balances and positions) and <b>Trade</b> (open and close positions).</p><p><b>Never enable Withdraw.</b> With Withdraw off, nobody can move money out of your exchange account with this key, even if it leaks.</p>`],
};

/* ---------- shared screen parts ---------- */
const head = (title, right = "") => `<header class="at-head"><button type="button" class="at-ib" data-back aria-label="Go back">${ic("back", 22)}</button><h1>${esc(title)}</h1>${right || '<span class="at-ib"></span>'}</header>`;
const isDemo = () => !window.ACCT || ACCT.isDemo();
const balBar = () => `<div class="at-bal"><div class="at-bal-l"><span>Futures wallet</span><b class="num" data-bal>${usd(store.wb("futures"))} <small>USDT</small></b></div>
  <button type="button" class="at-mode ${isDemo() ? "demo" : "real"}" data-acct aria-label="Switch account">${isDemo() ? "Demo" : "Real"}${ic("chevd", 12, 2.4)}</button>
  <button type="button" class="at-xf" data-xf aria-label="Transfer to Futures wallet">${ic("plus", 18, 2.4)}</button></div>`;
const hiwBtn = `<div class="at-hiw-r"><button type="button" class="at-hiw" data-hiw aria-haspopup="dialog">${ic("info", 16)}<span>How it works</span></button></div>`;
const tabs = on => `<nav class="at-sub" aria-label="API Trade sections">${[["", "Channels"], ["trades", "My API trades"], ["connect", "Exchange"]].map(([k, l]) => `<a href="#/apitrade${k ? "/" + k : ""}" class="${on === k ? "on" : ""}" ${on === k ? 'aria-current="page"' : ""}>${l}${k === "trades" && openTrades().length ? `<i>${openTrades().length}</i>` : ""}</a>`).join("")}</nav>`;
function bindCommon(root, offs){
  root.querySelectorAll("[data-acct]").forEach(b => b.onclick = e => { e.stopPropagation(); if (window.ACCT) ACCT.sheet(); });
  root.addEventListener("click", e => {
    const t = e.target;
    if (t.closest("[data-xf]")){ hap(10); UI.transferSheet && UI.transferSheet({to: "futures"}); }
    if (t.closest("[data-hiw]")){ hap(6); hiwPop(); }
    const qb = t.closest("[data-q]"); if (qb){ hap(5); const k = TIPS[qb.dataset.q]; if (k) tip(k[0], k[1]()); }
  });
  const upd = () => root.querySelectorAll("[data-bal]").forEach(b => b.innerHTML = `${usd(store.wb("futures"))} <small>USDT</small>`);
  offs.push(bus.on("balance", upd));
}
const lastSig = c => signalsOf(c, 1)[0];

/* ---------- screen: channels ---------- */
function connCard(){
  const c = conn(), ex = c && EXB[c.ex];
  if (!c || !ex) return `<a class="at-card at-conn off" href="#/apitrade/connect"><span class="at-conn-ic">${linkI(20)}</span><div><b>Connect your exchange</b><small>Add an API key to start auto trading. Keys stay on this device.</small></div><span class="at-go">${ic("chev", 16)}</span></a>`;
  return `<a class="at-card at-conn" href="#/apitrade/connect">${exLogo(ex, 38)}<div><b>${esc(ex.name)} <em class="at-dot"></em><span class="at-ok">Connected</span></b><small>${esc(maskKey(c.key))}</small></div><span class="at-go">${ic("chev", 16)}</span></a>`;
}
function chCard(c){
  const on = followOn(c.id), l = lastSig(c);
  return `<a class="at-card at-ch" href="#/apitrade/ch/${c.id}" data-ch="${c.id}">
    <div class="at-ch-h">${avatar(c, 44)}<div class="at-ch-n"><b>${esc(c.name)}${c.verified ? VT() : ""}</b><small>${esc(c.style)}</small></div><span class="at-fbtn ${on ? "on" : ""}">${on ? "Following" : "Follow"}</span></div>
    <div class="at-ch-s"><div><span>Win rate</span><b class="num">${c.wr}%</b></div><div><span>30D ROI</span><b class="num up">+${fmt(c.roi, 1)}%</b></div><div><span>Followers</span><b class="num">${fmt(followersOf(c), 0)}</b></div>${spark(c)}</div>
    ${l ? `<div class="at-ch-l"><i class="at-pulse"></i><span>Last signal ${ago(l.t)} · ${esc(labelOf(l.sym))} <b class="${l.side === "long" ? "up" : "down"}">${l.side === "long" ? "Long" : "Short"}</b></span></div>` : ""}</a>`;
}
function listScreen(){
  const offs = []; let root;
  const html = `${head("API Trade")}${balBar()}${tabs("")}${hiwBtn}${connCard()}<div class="at-h3">Signal channels<small>${anyFollow() ? Object.values(S().follow).filter(f => f.on).length + " followed" : "pick one to follow"}</small></div><div class="at-list" data-list>${CHANNELS.map(chCard).join("")}</div><p class="at-fine">Signals are shared for information and are not financial advice. Past results do not guarantee future results.</p>`;
  return {html, title: "API Trade", mount(r){ root = r; bindCommon(r, offs);
    const cb = () => { const l = r.querySelector("[data-list]"); if (l) l.innerHTML = CHANNELS.map(chCard).join(""); };
    let k = 0; const slow = () => { if (++k % 15 === 0) cb(); }; uiCbs.add(slow); arm(); offs.push(() => { uiCbs.delete(slow); arm(); });
    offs.push(bus.on("apitrade", () => { const d = r.querySelector("[data-list]"); if (d && !d.matches(":active")) cb(); }));
  }, unmount(){ offs.splice(0).forEach(f => { try { f(); } catch {} }); }};
}

/* ---------- screen: connect exchange ---------- */
const permGfx = `<div class="at-perm" aria-label="Permissions: Read on, Trade on, Withdraw off"><svg viewBox="0 0 40 46" width="38" height="44" aria-hidden="true"><path d="M20 2l15 5.4v11.2c0 10-6.4 17.2-15 21.4C11.4 35.8 5 28.6 5 18.6V7.4z" class="at-sh"/><path d="M12.5 22l5.6 5.6 10-11.4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <div><span class="p on">${ic("check", 12, 3)}Read</span><span class="p on">${ic("check", 12, 3)}Trade</span><span class="p off">${ic("close", 12, 3)}Withdraw</span></div></div>`;
function connectScreen(){
  const offs = []; let sel = (conn() || {}).ex || "binance";
  const c0 = conn(), ex0 = c0 && EXB[c0.ex];
  const html = `${head("API Trade")}${tabs("connect")}${hiwBtn}<div data-conn>${connBody()}</div>`;
  function connBody(){
    const c = conn(), ex = c && EXB[c.ex];
    if (c && ex) return `<div class="at-card at-cd">${exLogo(ex, 44)}<div class="at-cd-n"><b>${esc(ex.name)}</b><small><i class="at-dot"></i>Connected</small></div></div>
      <div class="at-card at-keys"><div><span>API Key</span><b class="num">${esc(maskKey(c.key))}</b></div><div><span>Secret</span><b class="num">••••••••••••••••</b></div>${c.pass ? `<div><span>Passphrase</span><b class="num">••••••••</b></div>` : ""}<div><span>Saved</span><b>${esc(new Date(c.t).toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"}))} · this device only</b></div></div>
      <div class="at-status">${ic("info", 15)}<span>${esc(STATUS)}</span></div>${permNote()}
      <button type="button" class="at-btn ghost danger" data-disc>Disconnect</button>`;
    return `<p class="at-lead">Choose your exchange</p><div class="at-exs" role="radiogroup" aria-label="Exchange">${EXS.map(x => `<button type="button" role="radio" aria-checked="${x.id === sel}" class="at-ex ${x.id === sel ? "on" : ""}" data-ex="${x.id}">${exLogo(x, 36)}<span>${x.name}</span></button>`).join("")}</div>
      <form class="at-card at-form" data-form autocomplete="off" novalidate>
        <label><span>API Key</span><input type="text" data-k="key" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste your API key"></label>
        <label><span>Secret</span><input type="password" data-k="secret" autocomplete="new-password" autocapitalize="off" spellcheck="false" placeholder="Paste your API secret"></label>
        <label data-pass><span>Passphrase <em>(optional)</em></span><input type="password" data-k="pass" autocomplete="new-password" autocapitalize="off" spellcheck="false" placeholder="Only if your exchange asks for one"></label>
        <div class="at-err" data-err role="alert"></div>
        <button type="submit" class="at-btn primary">Connect ${EXB[sel].name}</button>
      </form>${permNote()}
      <p class="at-fine">${ic("lock", 12)} Your keys are stored only on this device and are never sent anywhere. Live connection to your exchange is coming soon.</p>`;
  }
  function permNote(){ return `<div class="at-card at-safe">${permGfx}<div class="at-safe-t"><b>Read + Trade only, never enable Withdraw ${q("perm")}</b><small>Create the key with Read and Trade permission. Leave Withdraw switched off.</small></div></div>`; }
  return {html, title: "API Trade", mount(r){
    bindCommon(r, offs);
    const box = r.querySelector("[data-conn]");
    const bind = () => {
      const form = box.querySelector("[data-form]");
      box.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => { hap(6); sel = b.dataset.ex; box.querySelectorAll("[data-ex]").forEach(x => { const on = x.dataset.ex === sel; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); });
        const pw = box.querySelector("[data-pass]"); if (pw) pw.hidden = !EXB[sel].pass; const sb = box.querySelector(".at-btn.primary"); if (sb) sb.textContent = "Connect " + EXB[sel].name; });
      if (form){
        const pw = box.querySelector("[data-pass]"); if (pw) pw.hidden = !EXB[sel].pass;
        form.onsubmit = e => { e.preventDefault(); const v = k => form.querySelector(`[data-k="${k}"]`).value.trim(), err = form.querySelector("[data-err]");
          const key = v("key"), secret = v("secret"), pass = EXB[sel].pass ? v("pass") : "";
          if (key.length < 8){ err.textContent = "Enter your API key"; return; }
          if (secret.length < 8){ err.textContent = "Enter your API secret"; return; }
          if (!connSave({ex: sel, key, secret, pass, t: now()})){ err.textContent = "Could not save the keys on this device"; return; }
          hap(10); toast("Exchange connected", "ok"); U.fx && U.fx("ok"); save(); box.innerHTML = connBody(); bind(); };
      }
      const d = box.querySelector("[data-disc]");
      if (d) d.onclick = () => { hap(10); connDrop(); const A = S(); Object.values(A.follow).forEach(f => f.on = false); save(); toast("Exchange disconnected. Auto trading stopped", "info"); box.innerHTML = connBody(); bind(); };
    };
    bind();
  }, unmount(){ offs.splice(0).forEach(f => { try { f(); } catch {} }); }};
}

/* ---------- screen: channel detail (stats, settings, signal feed) ---------- */
const DEF = {amount: 50, maxLev: 10, maxOpen: 3, copyTp: true, dailyLoss: 100};
function sigRow(c, s){
  const L = s.side === "long", st = s.state;
  const res = st === "active" ? `<span class="at-res act"><i class="at-pulse"></i>Active</span>` : st === "tp" ? `<span class="at-res win">TP hit +${fmt(s.tpP * s.lev, 1)}%</span>` : `<span class="at-res loss">SL hit -${fmt(s.slP * s.lev, 1)}%</span>`;
  return `<div class="at-card at-sig"><div class="at-sig-h"><span class="at-pi">${UI.pairIcon ? UI.pairIcon(pairOf(s.sym), 26) : ""}</span><b>${esc(labelOf(s.sym))}</b><span class="at-sd ${L ? "up" : "down"}">${L ? "Long" : "Short"}</span><span class="at-lv">${s.lev}x</span><span class="at-sp2"></span>${res}</div>
    <div class="at-sig-g"><div><span>Entry</span><b class="num">${px(s.sym, s.entry)}</b></div><div><span>TP</span><b class="num up">${px(s.sym, s.tp)}</b></div><div><span>SL</span><b class="num down">${px(s.sym, s.sl)}</b></div></div>
    <div class="at-sig-f"><span>${ago(s.t)} · ${clock(s.t)}</span></div></div>`;
}
function chScreen(c){
  const offs = []; let root;
  const A = () => S(), F = () => A().follow[c.id];
  const stats = `<div class="at-card at-hero"><div class="at-hero-h">${avatar(c, 56)}<div class="at-ch-n"><b class="big">${esc(c.name)}${c.verified ? VT(17) : ""}</b><small>${esc(c.style)}</small></div></div>
    <div class="at-stat4"><div><span>Win rate</span><b class="num">${c.wr}%</b></div><div><span>30D ROI</span><b class="num up">+${fmt(c.roi, 1)}%</b></div><div><span>Followers</span><b class="num">${fmt(followersOf(c), 0)}</b></div><div><span>Avg R:R</span><b class="num">1 : ${fmt((c.tp[0] + c.tp[1]) / (c.sl[0] + c.sl[1]), 1)}</b></div></div>
    <div class="at-roi"><span>30-day ROI</span>${spark(c, 300, 54)}</div></div>`;
  const val = () => Object.assign({}, DEF, F() || {});
  function settings(){
    const f = val(), on = followOn(c.id), cn = conn(), bal = store.wb("futures");
    return `<div class="at-card at-set"><div class="at-set-h"><b>Auto trade settings</b>${on ? `<span class="at-badge on"><i class="at-pulse"></i>Following</span>` : `<span class="at-badge">Not following</span>`}</div>
      ${!cn ? `<a class="at-warn" href="#/apitrade/connect">${linkI(15)}<span>Connect your exchange first to follow a channel</span>${ic("chev", 14)}</a>` : ""}
      <div class="at-fld"><label for="atAmt">Amount per trade (USDT) ${q("amount")}</label><div class="at-inp"><input id="atAmt" data-f="amount" inputmode="decimal" autocomplete="off" value="${cin(f.amount)}"><em>USDT</em></div>
        <div class="at-chips">${[10, 25, 50, 100, 250].map(v => `<button type="button" data-amt="${v}" class="${+f.amount === v ? "on" : ""}">${v}</button>`).join("")}</div><small class="at-hint">Futures balance <b class="num" data-bal2>${usd(bal)}</b> USDT</small></div>
      <div class="at-fld"><label>Max leverage ${q("lev")}</label><div class="at-chips lg">${[3, 5, 10, 20, 50].map(v => `<button type="button" data-lev="${v}" class="${+f.maxLev === v ? "on" : ""}">${v}x</button>`).join("")}</div></div>
      <div class="at-fld row"><label>Max open trades ${q("open")}</label><div class="at-step"><button type="button" data-st="-1" aria-label="Decrease">${ic("minus", 16, 2.4)}</button><b class="num" data-mo>${f.maxOpen}</b><button type="button" data-st="1" aria-label="Increase">${ic("plus", 16, 2.4)}</button></div></div>
      <div class="at-fld row"><label>Copy TP / SL ${q("tpsl")}</label><button type="button" class="at-sw ${f.copyTp ? "on" : ""}" role="switch" aria-checked="${!!f.copyTp}" data-sw aria-label="Copy TP and SL"><i></i></button></div>
      <div class="at-fld"><label for="atDl">Daily loss limit (USDT) ${q("daily")}</label><div class="at-inp"><input id="atDl" data-f="dailyLoss" inputmode="decimal" autocomplete="off" value="${cin(f.dailyLoss)}"><em>USDT</em></div></div>
      <div class="at-err" data-err role="alert"></div>
      ${on ? `<div class="at-btns"><button type="button" class="at-btn ghost" data-stop>Stop following</button><button type="button" class="at-btn primary" data-save>Save settings</button></div><p class="at-fine ctr">New signals from this channel open trades automatically, with no confirmation.</p>`
        : `<button type="button" class="at-btn primary" data-start ${cn ? "" : "disabled"}>Start following</button><p class="at-fine ctr">After you start, new signals open trades automatically, with no confirmation.</p>`}</div>`;
  }
  function readF(){
    const st = root.querySelector("[data-set]"), cur = val();
    const amount = parseFloat(unc(st.querySelector('[data-f="amount"]').value)), dl = parseFloat(unc(st.querySelector('[data-f="dailyLoss"]').value));
    return {amount, dailyLoss: dl, maxLev: cur.maxLev, maxOpen: cur.maxOpen, copyTp: cur.copyTp};
  }
  const draft = () => { const st = root.querySelector("[data-set]"); if (!st) return null; try { return readF(); } catch { return null; } };
  let dr = null;
  function renderSet(keep){
    const box = root.querySelector("[data-set]"); if (!box) return;
    if (keep) { const f = F() || (A().follow[c.id] = {on: false}); Object.assign(f, keep); }
    box.innerHTML = settings(); bindSet();
  }
  function bindSet(){
    const box = root.querySelector("[data-set]"), err = box.querySelector("[data-err]");
    numInput(box.querySelector('[data-f="amount"]'), 2, v => { box.querySelectorAll("[data-amt]").forEach(b => b.classList.toggle("on", +b.dataset.amt === parseFloat(v))); });
    numInput(box.querySelector('[data-f="dailyLoss"]'), 2);
    const ed = (patch) => { const d = draft() || {}; const f = A().follow[c.id] || (A().follow[c.id] = {on: false}); Object.assign(f, {amount: isNaN(d.amount) ? f.amount : d.amount, dailyLoss: isNaN(d.dailyLoss) ? f.dailyLoss : d.dailyLoss}, patch); };
    box.querySelectorAll("[data-amt]").forEach(b => b.onclick = () => { hap(4); const i = box.querySelector('[data-f="amount"]'); i.value = cin(b.dataset.amt); box.querySelectorAll("[data-amt]").forEach(x => x.classList.toggle("on", x === b)); });
    box.querySelectorAll("[data-lev]").forEach(b => b.onclick = () => { hap(4); ed({maxLev: +b.dataset.lev}); renderSet(); });
    box.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { hap(4); const cur = val().maxOpen; ed({maxOpen: Math.max(1, Math.min(10, cur + +b.dataset.st))}); renderSet(); });
    const sw = box.querySelector("[data-sw]"); if (sw) sw.onclick = () => { hap(5); ed({copyTp: !val().copyTp}); renderSet(); };
    const validate = () => { const d = readF(); if (!(d.amount >= 1)) return "Enter an amount of at least 1 USDT"; if (!(d.dailyLoss >= 1)) return "Enter a daily loss limit of at least 1 USDT"; return null; };
    const commit = start => { const e = validate(); if (e){ err.textContent = e; return false; } const d = readF(), a = A(); const f = a.follow[c.id] || (a.follow[c.id] = {});
      Object.assign(f, d); if (start){ f.on = true; f.since = now(); f.done = []; f.limitDay = null; } return true; };
    const st = box.querySelector("[data-start]"); if (st) st.onclick = () => { if (!conn()){ location.hash = "#/apitrade/connect"; return; } if (!commit(true)) return; hap(12); U.fx && U.fx("ok"); save(); arm(); toast(`Following ${c.name}. New signals will trade automatically`, "ok", 3200); renderSet(); renderFeed(); };
    const sv2 = box.querySelector("[data-save]"); if (sv2) sv2.onclick = () => { if (!commit(false)) return; hap(8); save(); toast("Settings saved", "ok"); renderSet(); };
    const sp = box.querySelector("[data-stop]"); if (sp) sp.onclick = () => { hap(8); const f = A().follow[c.id]; if (f) f.on = false; save(); arm(); toast("Stopped following " + c.name, "info"); renderSet(); renderFeed(); };
  }
  function feedHtml(){
    const on = followOn(c.id), list = signalsOf(c, 14);
    return `<div class="at-h3">Recent signals<small>${on ? '<i class="at-pulse"></i>Auto trading on' : "live feed"}</small></div>${on ? `<div class="at-wait"><i class="at-pulse"></i><span>Waiting for the next signal. New ones will open a trade automatically.</span></div>` : ""}${list.length ? `<div class="at-list">${list.map(s => sigRow(c, s)).join("")}</div>` : `<div class="at-empty">Loading live prices…</div>`}`;
  }
  function renderFeed(){ const b = root && root.querySelector("[data-feed]"); if (b) b.innerHTML = feedHtml(); }
  const html = `${head(c.name)}${stats}<div data-set></div><div data-feed></div><p class="at-fine">Signals are shared for information and are not financial advice.</p>`;
  return {html, title: c.name, mount(r){ root = r; bindCommon(r, offs);
    renderSet(); renderFeed();
    let k = 0; const f = () => { if (++k % 5 === 0) renderFeed(); }; uiCbs.add(f); arm(); offs.push(() => { uiCbs.delete(f); arm(); });
    offs.push(bus.on("balance", () => r.querySelectorAll("[data-bal2]").forEach(b => b.textContent = usd(store.wb("futures")))));
  }, unmount(){ offs.splice(0).forEach(fn => { try { fn(); } catch {} }); }};
}

/* ---------- screen: my API trades ---------- */
const RSN = {tp: ["Take profit", "up"], sl: ["Stop loss", "down"], manual: ["Closed by you", ""], liquidated: ["Liquidated", "down"]};
function openRow(tr){
  const p = posOf(tr.id), c = CHB[tr.ch], L = tr.side === "long"; if (!p) return "";
  const r = E.futPnl(p);
  return `<div class="at-card at-tr" data-tr="${tr.id}"><div class="at-sig-h"><span class="at-pi">${UI.pairIcon ? UI.pairIcon(pairOf(tr.sym), 26) : ""}</span><b>${esc(labelOf(tr.sym))}</b><span class="at-sd ${L ? "up" : "down"}">${L ? "Long" : "Short"}</span><span class="at-lv">${p.lev}x</span><span class="at-sp2"></span><small class="at-via">${esc(c ? c.name : "Channel")}</small></div>
    <div class="at-pnl"><div><span>Unrealized PnL</span><b class="num ${cls(r.pnl)}" data-lp>${sg(r.pnl)} USDT</b></div><div class="r"><span>ROE</span><b class="num ${cls(r.pnl)}" data-lr>${pc(r.roe)}</b></div></div>
    <div class="at-sig-g four"><div><span>Entry</span><b class="num">${px(tr.sym, p.entry)}</b></div><div><span>Mark</span><b class="num" data-mk>${px(tr.sym, r.px)}</b></div><div><span>Margin</span><b class="num">${fmt(p.margin, 2)}</b></div><div><span>Liq.</span><b class="num">${p.liq > 0 ? px(tr.sym, p.liq) : "--"}</b></div></div>
    <div class="at-tpsl"><span>TP <b class="num up" data-tp>${p.tp ? px(tr.sym, p.tp) : "--"}</b></span><span>SL <b class="num down" data-sl>${p.sl ? px(tr.sym, p.sl) : "--"}</b></span><span class="at-sp2"></span><small>${ago(tr.t)}</small></div>
    <div class="at-btns"><button type="button" class="at-btn ghost sm" data-mod="${tr.id}">Modify TP/SL</button><button type="button" class="at-btn sell sm" data-close="${tr.id}">Close</button></div></div>`;
}
function histRow(h){
  const c = CHB[h.ch], L = h.side === "long", rs = RSN[h.reason] || ["Closed", ""];
  return `<div class="at-card at-hi"><div class="at-sig-h"><span class="at-pi">${UI.pairIcon ? UI.pairIcon(pairOf(h.sym), 24) : ""}</span><b>${esc(labelOf(h.sym))}</b><span class="at-sd ${L ? "up" : "down"}">${L ? "Long" : "Short"}</span><span class="at-lv">${h.lev}x</span><span class="at-sp2"></span><b class="num ${cls(h.profit)}">${sg(h.profit)}</b></div>
    <div class="at-hi-f"><span>${esc(c ? c.name : "Channel")}</span><span class="${rs[1]}">${rs[0]}</span><span>${pc(h.roi)}</span><span>${ago(h.closed)}</span></div></div>`;
}
function modSheet(id){
  const p = posOf(id); if (!p) return;
  const L = p.side === "long", pr = pairOf(p.sym);
  U.sheet("Modify TP/SL", `<div class="at-mod"><p class="at-mod-t">${esc(labelOf(p.sym))} ${L ? "Long" : "Short"} ${p.lev}x · Entry ${px(p.sym, p.entry)} · Mark ${px(p.sym, pr ? pr.price : p.entry)}</p>
    <label class="at-fld"><span>Take profit price</span><div class="at-inp"><input data-m="tp" inputmode="decimal" autocomplete="off" value="${p.tp ? cin(+p.tp.toPrecision(7)) : ""}" placeholder="Not set"></div></label>
    <label class="at-fld"><span>Stop loss price</span><div class="at-inp"><input data-m="sl" inputmode="decimal" autocomplete="off" value="${p.sl ? cin(+p.sl.toPrecision(7)) : ""}" placeholder="Not set"></div></label>
    <div class="at-err" data-err role="alert"></div><button type="button" class="at-btn primary" data-ms>Save</button></div>`, el => {
    el.querySelectorAll("[data-m]").forEach(i => numInput(i, 8));
    el.querySelector("[data-ms]").onclick = () => {
      const g = k => { const v = parseFloat(unc(el.querySelector(`[data-m="${k}"]`).value)); return v > 0 ? v : null; };
      const e = E.setTpSl(id, g("tp"), g("sl")); if (e){ el.querySelector("[data-err]").textContent = e; return; }
      const tr = S().trades.find(x => x.id === id); if (tr) tr.manual = true;
      hap(8); save(); U.closeLayer(); toast("TP/SL updated", "ok");
    };
  });
}
function tradesScreen(){
  const offs = []; let tab = "open", root;
  function summary(){
    const open = openTrades(), pnl = open.reduce((a, t) => { const p = posOf(t.id); return a + (p ? E.futPnl(p).pnl : 0); }, 0), day = todayPnl();
    return `<div class="at-card at-sum"><div><span>Open trades</span><b class="num">${open.length}</b></div><div><span>Live PnL</span><b class="num ${cls(pnl)}" data-spl>${sg(pnl)}</b></div><div><span>Today (closed)</span><b class="num ${cls(day)}">${sg(day)}</b></div></div>`;
  }
  function body(){
    const a = S();
    if (tab === "open"){
      const rows = a.trades.map(openRow).join("");
      return rows ? `<div class="at-list">${rows}</div>` : `<div class="at-empty big"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18l5-6 4 3 7-9"/><path d="M4 21h16"/></svg><b>No API trades open</b><span>${anyFollow() ? "You are following a channel. Trades open here automatically with the next signal." : "Follow a signal channel and its trades will open here automatically."}</span>${anyFollow() ? "" : `<a class="at-btn primary" href="#/apitrade">Browse channels</a>`}</div>`;
    }
    const sk = a.skips.length ? `<div class="at-h3">Skipped signals<small>not traded</small></div><div class="at-list">${a.skips.slice(0, 6).map(s => `<div class="at-card at-sk"><b>${esc(labelOf(s.sym))} ${s.side === "long" ? "Long" : "Short"}</b><span>${esc(s.why)}</span><small>${ago(s.t)}</small></div>`).join("")}</div>` : "";
    return (a.history.length ? `<div class="at-list">${a.history.slice(0, 40).map(histRow).join("")}</div>` : `<div class="at-empty big"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><b>No history yet</b><span>Closed API trades will be listed here.</span></div>`) + sk;
  }
  const html = `${head("API Trade")}${balBar()}${tabs("trades")}${hiwBtn}<div data-sum></div><div class="at-seg" role="tablist"><button type="button" role="tab" data-t="open" class="on">Open</button><button type="button" role="tab" data-t="hist">History</button></div><div data-body></div>`;
  return {html, title: "API Trade", mount(r){ root = r; bindCommon(r, offs);
    const paint = () => { r.querySelector("[data-sum]").innerHTML = summary(); r.querySelector("[data-body]").innerHTML = body(); };
    paint();
    r.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { hap(4); tab = b.dataset.t; r.querySelectorAll("[data-t]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); }); paint(); });
    r.addEventListener("click", e => {
      const cl = e.target.closest("[data-close]"), md = e.target.closest("[data-mod]");
      if (cl){ const id = cl.dataset.close, pos = posOf(id); if (!pos) return; hap(12); cl.disabled = true; E.closeFut(id, "manual"); toast("Trade closed", "ok", 2000); }   // no confirmation (finish() runs from futClosed)
      if (md){ hap(6); modSheet(md.dataset.mod); }
    });
    offs.push(bus.on("apitrade", paint));
    const live = () => {
      let tot = 0;
      r.querySelectorAll("[data-tr]").forEach(card => {
        const p = posOf(card.dataset.tr); if (!p) return; const x = E.futPnl(p); tot += x.pnl;
        const lp = card.querySelector("[data-lp]"), lr = card.querySelector("[data-lr]"), mk = card.querySelector("[data-mk]"), c2 = cls(x.pnl);
        if (lp){ lp.textContent = sg(x.pnl) + " USDT"; lp.className = "num " + c2; } if (lr){ lr.textContent = pc(x.roe); lr.className = "num " + c2; } if (mk) mk.textContent = px(p.sym, x.px);
        const tp = card.querySelector("[data-tp]"), sl = card.querySelector("[data-sl]"); if (tp) tp.textContent = p.tp ? px(p.sym, p.tp) : "--"; if (sl) sl.textContent = p.sl ? px(p.sym, p.sl) : "--";
      });
      const s = r.querySelector("[data-spl]"); if (s){ s.textContent = sg(tot); s.className = "num " + cls(tot); }
    };
    uiCbs.add(live); arm(); offs.push(() => { uiCbs.delete(live); arm(); });
  }, unmount(){ offs.splice(0).forEach(f => { try { f(); } catch {} }); }};
}

/* ---------- route ---------- */
Pages.apitrade = (params = []) => {
  const [a, b] = params;
  const scr = a === "ch" && CHB[b] ? chScreen(CHB[b]) : a === "trades" ? tradesScreen() : a === "connect" ? connectScreen() : listScreen();
  return {html: `<div class="at-root">${scr.html}</div>`, title: scr.title, mount(view){ const r = view.querySelector(".at-root") || view; return scr.mount(r); }, unmount(){ return scr.unmount && scr.unmount(); }};
};
window.APITRADE = {channels: CHANNELS, signals: signalsOf, conn, state: S, tick, arm};

/* re-arm after an app restart: keep copying signals while a channel is followed (guarded, runs once) */
if (!window.__apitradeBoot){ window.__apitradeBoot = true; const boot = () => { try { arm(); } catch {} }; if (document.readyState === "loading") addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0); }
})();
