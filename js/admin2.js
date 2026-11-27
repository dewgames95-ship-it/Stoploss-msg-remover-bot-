/* v7.1 Admin panel (core): always-dark shell in the main app's style. Routes: #/admin, /users, /user/<id>, /trading[/tab], /finance, /requests, /notifs, /brand, /ai, /hdw, /settings.
   This file = shell, data adapter (demo/real store of this device), overview, users list, finance, requests, notifications, branding, settings.
   js/admin3.js (loads after) adds V.user, V.trading, V.hdw, V.ai through window.Admin2.V. */
(function(){
if (!window.U || !window.Pages || !window.Auth) return;
const {esc, store, toast} = U;
const A = window.Auth;

/* ---------- data adapter: the Demo / Real stores of this device ---------- */
const curMode = () => (window.ACCT ? ACCT.mode() : "demo");
const WK = ["spot", "funding", "futures", "binary", "options", "earn", "games", "predict", "cfd"];
const WN = {spot:"Spot", funding:"Funding", futures:"Futures", binary:"Binary", options:"Options", earn:"Earn", games:"Money Game", predict:"Prediction", cfd:"CFD Trade"};
const WI = {spot:"chart", funding:"wallet", futures:"layers", binary:"clock", options:"target", earn:"earn", games:"car", predict:"predict", cfd:"candle"};
const wname = k => (window.UI && UI.walletName ? UI.walletName(k) : WN[k] || k);
let VIEW = (() => { try { return sessionStorage.getItem("nt_admview") || "real"; } catch { return "real"; } })();
const setView = v => { VIEW = v; try { sessionStorage.setItem("nt_admview", v); } catch {} RC = {}; };
const live = (m = VIEW) => m === curMode();
const rawKey = m => m === "real" ? "novatrade_real_v1" : "novatrade_v1";
let RC = {};
const skeleton = () => ({balance:0, wallets:{}, positions:[], history:[], tx:[], notifs:[], unread:0, balHist:[], fut:{positions:[], orders:[], history:[]}, spot:{hold:{}, orders:[], history:[]}, opt:{positions:[], history:[]},
  earn:{locked:[]}, vault:{bal:0, since:Date.now()}, rewards:{checkins:[], claimed:{}, xp:0, used:{}}, settings:JSON.parse(JSON.stringify(store.s.settings || {})), alerts:[], bots:{}, profile:{}});
function fill(o){
  const d = skeleton(), r = Object.assign(d, o || {});
  ["fut", "spot", "opt", "earn", "vault", "rewards"].forEach(k => { r[k] = Object.assign(skeleton()[k], (o && o[k]) || {}); });
  ["positions", "history", "tx", "notifs", "balHist"].forEach(k => { if (!Array.isArray(r[k])) r[k] = []; });
  r.wallets = Object.assign({}, o && o.wallets);
  return r;
}
function readS(m = VIEW){
  if (live(m)) return store.s;
  if (!RC[m]){ let o = {}; try { o = JSON.parse(localStorage.getItem(rawKey(m)) || "{}") || {}; } catch {} RC[m] = fill(o); }
  return RC[m];
}
/* run fn on the account store of the chosen mode. Live mode = the running store. Other mode = the stored copy is swapped into the
   running store for the (synchronous) duration of fn, so the app's own engine functions (E.closeFut, SPOT.place ...) work on it. */
function run(fn, m = VIEW){
  if (live(m)){ const r = fn(); store.save(); RC = {}; return r; }
  const S0 = store.s, snap = Object.assign({}, S0), k = rawKey(m);
  let raw = {}; try { raw = JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch {}
  const base = fill(raw);
  Object.keys(S0).forEach(x => delete S0[x]); Object.assign(S0, base);
  try { return fn(); }
  finally {
    S0.balance = Math.round(WK.reduce((a, w) => a + (+S0.wallets[w] || 0), 0) * 100) / 100;
    const out = Object.assign({}, S0);
    Object.keys(S0).forEach(x => delete S0[x]); Object.assign(S0, snap);
    try { localStorage.setItem(k, JSON.stringify(out)); } catch {}
    RC = {};
  }
}
/* read-only variant of run(): swaps the account in, calls fn, swaps back, writes nothing */
function peek(fn, m = VIEW){
  if (live(m)) return fn();
  const S0 = store.s, snap = Object.assign({}, S0), base = readS(m);
  Object.keys(S0).forEach(x => delete S0[x]); Object.assign(S0, base);
  try { return fn(); } finally { Object.keys(S0).forEach(x => delete S0[x]); Object.assign(S0, snap); }
}
/* wallet / user notification helpers */
function bal(k, m = VIEW){ return +(readS(m).wallets || {})[k] || 0; }
function totalOf(m = VIEW){ const w = readS(m).wallets || {}; return WK.reduce((a, k) => a + (+w[k] || 0), 0); }
function userNotify(title, body, tone = "info"){
  const S = store.s;
  if (live() && U.pushNotif) return U.pushNotif("system", title, body, tone);
  S.notifs.unshift({id:Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t:Date.now(), title, body, kind:tone, cat:"system"}); S.notifs = S.notifs.slice(0, 80); S.unread = (S.unread || 0) + 1;
}
/* add / deduct on a wallet and tell the user. Returns error text or "" */
function adjust(k, delta, note, m = VIEW){
  if (!(Math.abs(delta) > 0)) return "Enter an amount";
  if (delta < 0 && -delta > bal(k, m) + 1e-9) return "Amount exceeds the wallet balance";
  run(() => {
    store.addWallet(k, delta, "admin");
    const a = n2(Math.abs(delta)) + " USDT";
    (store.s.tx ||= []).unshift({id:U.uid(), kind:delta > 0 ? "admin-credit" : "admin-debit", amount:Math.abs(delta), coin:"USDT", method:"System · " + wname(k), t:Date.now(), status:"Completed"});
    userNotify(delta > 0 ? "Balance added by system" : "Balance deducted by system", delta > 0 ? `Balance added by system: +${a}${note ? " · " + note : ""} (${wname(k)})` : `Balance deducted by system: -${a}${note ? " · " + note : ""} (${wname(k)})`, delta > 0 ? "ok" : "info");
  }, m);
  return "";
}

/* ---------- finance settings (shared with js/admin0.js) ---------- */
const KF = "nt_adm_fin";
const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const fin = () => Object.assign({autoPay:true, autoCredit:true}, rd(KF, {}) || {});
const setFin = o => wr(KF, Object.assign(fin(), o));
/* deposit gate: with Auto-credit OFF a real-account deposit is kept "Pending" (no credit) until the admin approves it */
let gateFlag = false;
{
  const aw = store.addWallet, nf = store.notify;
  store.addWallet = function(k, d, reason){
    if (reason === "deposit" && curMode() === "real" && fin().autoCredit === false){
      const tx = (store.s.tx || []).find(x => x.kind === "deposit" && !x.status && x.coin && Date.now() - x.t < 4000 && Math.abs((+x.amount || 0) - d) < 1e-6);
      if (tx){ tx.status = "Pending"; gateFlag = true; store.save(); return; }
    }
    return aw.apply(this, arguments);
  };
  store.notify = function(title, body, kind){
    if (gateFlag && /^Deposit successful/i.test(title)){ gateFlag = false; title = "Deposit received"; body = "Your deposit is awaiting confirmation and will be credited soon."; kind = "info"; }
    return nf.call(this, title, body, kind);
  };
}

/* ---------- formatting + icons ---------- */
const n2 = v => (+v || 0).toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2});
const n0 = v => (+v || 0).toLocaleString("en-US", {maximumFractionDigits:0});
const dstr = t => new Date(t).toLocaleDateString("en-US", {year:"numeric", month:"short", day:"numeric"});
const tstr = t => new Date(t).toLocaleString("en-US", {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", hour12:false});
const dayStart = () => new Date().setHours(0, 0, 0, 0);
const sgn = v => (v >= 0 ? "+" : "-") + n2(Math.abs(v));
const ok = () => A.isAdmin() || A.bypass();
const P = {
  dash:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  trade:'<path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/>',
  fin:'<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
  wallet:'<rect x="2.5" y="6" width="19" height="14" rx="2.5"/><path d="M16 13h2.5M5.5 6V5a2 2 0 0 1 2-2H17"/>',
  cog:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  swap:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>', out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  back:'<path d="m15 18-6-6 6-6"/>', chev:'<path d="m9 6 6 6-6 6"/>', search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/>',
  pulse:'<path d="M3 12h4l3-8 4 16 3-8h4"/>', flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', chip:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', close:'<path d="M6 6l12 12M18 6 6 18"/>',
  check:'<path d="m5 12 5 5 9-10"/>', copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>', key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',
  ai:'<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2 2 .8-2 .8L19 21l-.8-2.4-2-.8 2-.8z"/>',
  brand:'<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/><circle cx="16" cy="10" r="1" fill="currentColor"/><path d="M12 21a2.5 2.5 0 0 1 0-5h1.5a2 2 0 0 0 0-4"/>',
  inbox:'<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1 3h6l1-3h5"/>', help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>', plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>', list:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', chart:'<path d="M5 20V10M11 20V4M17 20v-8M2 20h20"/>', target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>', down:'<path d="M12 5v14M6 13l6 6 6-6"/>', eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
};
const I = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;
const wic = (k, z = 18) => U.ic ? U.ic(WI[k] || "wallet", z, 1.8) : I("wallet", z);

/* ---------- "?" help ---------- */
const TIPS = {
  overview:["Overview", "<p>Live numbers for the account you are viewing: users, balances, deposits, withdrawals and open positions.</p><p>Use the <b>Demo / Real</b> switch under the header to look at either account on this device.</p>"],
  users:["Users", "<p>Every registered account. Tap a user to open their dashboard: wallets, open positions, orders and history for every product. You can modify or close positions and add or deduct balance.</p>"],
  finance:["Wallets and finance", "<p>Money overview: totals per wallet, deposits and withdrawals, and the switches that decide whether deposits are credited automatically and withdrawals are paid automatically.</p>"],
  trading:["Trading", "<p>Positions, orders and history for each product (Futures, Spot, Binary, Options, Earn, Money Game, Prediction, CFD) plus the product limits you can change.</p>"],
  requests:["Requests", "<p>Real-account withdrawal requests and deposits waiting for approval. <b>Pay manually</b> after you send the funds and save the transaction hash. <b>Reject</b> refunds the user.</p>"],
  notifs:["Notifications", "<p>Activity on the Real account: deposits, withdrawals and withdrawal requests. The red badge counts items you have not opened yet.</p>"],
  brand:["Branding", "<p>Change the app name and logo. They are updated everywhere: header, login, browser title and icon, and all text that shows the app name.</p>"],
  ai:["AI assistant", "<p>The key, default model, custom instructions and rules used by the in-app assistant. Rules are always added to the system prompt, so the assistant keeps to them.</p>"],
  hdw:["HD wallet", "<p>Generates a unique deposit address for each user from one master seed or xpub. A watch-only xpub is the safest option because no private key is stored.</p>"],
  settings:["Settings", "<p>Banner, maintenance mode, announcements and app information.</p>"],
  autopay:["Auto-pay", "<p>ON: withdrawal requests complete by themselves. OFF: they stay <b>Processing</b> until you pay them manually in Requests.</p>"],
  autocredit:["Auto-credit deposits", "<p>ON: real deposits are credited to the Funding wallet immediately. OFF: deposits wait as <b>Pending</b> until you approve them.</p>"]
};
const tipBtn = k => `<button class="a2-q" type="button" data-tip="${k}" aria-label="What is this?">?</button>`;
const showTip = (t, h) => (UI.tip || UI.help)(t, h);

/* ---------- shared building blocks ---------- */
const empty = t => `<div class="a2-empty">${t}</div>`;
const secH = (ic, title, tip, right) => `<h2 class="a2-h"><span class="a2-hi">${ic}</span><span class="a2-ht">${esc(title)}</span>${tip ? tipBtn(tip) : ""}${right ? `<span class="a2-x">${right}</span>` : ""}</h2>`;
const card = (head, body, cls = "") => `<section class="a2-card ${cls}">${head}${body}</section>`;
const kpi = (l, v, ic, tone, href) => `<${href ? `a href="${href}"` : "div"} class="a2-k ${tone || ""}"><span class="a2-ki">${I(ic, 18)}</span><b class="num">${v}</b><small>${l}</small></${href ? "a" : "div"}>`;
const field = (l, id, v, o = {}) => `<label class="a2-f"><span>${l}</span><input id="${id}" ${o.type ? `type="${o.type}"` : 'type="number"'} ${o.min != null ? `min="${o.min}"` : ""} ${o.step ? `step="${o.step}"` : ""} ${o.ph ? `placeholder="${o.ph}"` : ""} ${o.max != null ? `maxlength="${o.max}"` : ""} inputmode="${o.type === "text" || o.type === "password" ? "text" : "decimal"}" autocomplete="off" value="${esc(v ?? "")}"></label>`;
const tog = (id, on, l, s, tip) => `<label class="a2-tg"><span><b>${l}${tip ? tipBtn(tip) : ""}</b>${s ? `<small>${s}</small>` : ""}</span><input type="checkbox" id="${id}" ${on ? "checked" : ""}><i></i></label>`;
const kv = (a, b) => `<div class="a2-kv"><span>${a}</span><b>${b}</b></div>`;
const chips = (id, opts, cur, cls = "") => `<div class="a2-chips ${cls}" id="${id}" role="radiogroup">${opts.map(o => `<button type="button" role="radio" aria-checked="${String(o.v) === String(cur)}" class="a2-chip ${String(o.v) === String(cur) ? "on" : ""}" data-v="${esc(o.v)}">${o.ic || ""}<span>${esc(o.l)}</span>${o.s ? `<small>${o.s}</small>` : ""}</button>`).join("")}</div>`;
function bindChips(root, id, cb){ const g = root.querySelector("#" + id); if (!g) return; g.querySelectorAll(".a2-chip").forEach(b => b.onclick = () => { g.querySelectorAll(".a2-chip").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); U.buzz && U.buzz(8); cb(b.dataset.v); }); }
const walletChips = (id, cur, showBal = true) => chips(id, WK.map(k => ({v:k, l:wname(k), ic:`<span class="a2-wi">${wic(k, 17)}</span>`, s:showBal ? n2(bal(k)) : ""})), cur);
function bars(arr){
  const mx = Math.max(1, ...arr.map(x => x.v));
  return `<div class="a2-bars" role="img" aria-label="Trades in the last 7 days">${arr.map(x => `<div><i style="height:${Math.max(4, Math.round(x.v / mx * 70))}px" class="${x.v ? "" : "z"}"></i><em class="num">${x.v}</em><small>${x.l}</small></div>`).join("")}</div>`;
}
function hbars(rows){
  const mx = Math.max(1e-9, ...rows.map(r => r[1]));
  return rows.map(([l, v, ic]) => `<div class="a2-hb"><span>${ic || ""}${esc(l)}</span><div><i style="width:${Math.max(2, v / mx * 100)}%"></i></div><b class="num">${n2(v)}</b></div>`).join("");
}
const actRow = (ic, a, b, r, cls) => `<div class="a2-ac"><span class="a2-ai ${cls || ""}">${I(ic, 16)}</span><div><b>${a}</b><small>${b}</small></div><em class="${cls === "dn" ? "down" : cls === "upc" ? "up" : ""}">${r}</em></div>`;

/* ---------- activity / events ---------- */
const txOf = m => (readS(m).tx || []);
const isWd = x => x.kind === "withdrawal";
const isDep = x => x.kind === "deposit" && !/^Earn/.test(x.method || "");
function events(){
  const s = readS("real"), out = [];
  txOf("real").forEach(x => {
    if (isWd(x)) out.push({k:"wd", id:x.id, t:x.t, ic:"out", a:`Withdrawal request ${n2(x.amount)} ${esc(x.coin || "USDT")}`, b:`${esc(x.method || "")} · ${esc(x.status || "")}`, st:x.status});
    else if (isDep(x)) out.push({k:"dep", id:x.id, t:x.t, ic:"fin", a:`Deposit ${n2(x.amount)} USDT`, b:`${esc(x.method || "")}${x.status ? " · " + esc(x.status) : ""}`, st:x.status});
  });
  (s.fut.history || []).slice(0, 30).forEach(h => out.push({k:"trade", id:h.id, t:h.closed, ic:"trade", a:`Futures ${esc(h.sym || "")} ${esc(h.side || "")} closed`, b:`${n2(h.margin)} USDT margin`, r:sgn(h.profit || 0), up:(h.profit || 0) >= 0}));
  (s.history || []).slice(0, 30).forEach(h => out.push({k:"trade", id:h.id, t:h.closed || h.open, ic:"clock", a:`Binary ${esc(h.sym || "")} ${esc(h.result || "")}`, b:`${n2(h.amount)} USDT`, r:sgn(h.profit || 0), up:(h.profit || 0) >= 0}));
  return out.filter(x => x.t).sort((a, b) => b.t - a.t).slice(0, 80);
}
const KSEEN = "nt_adm_seen";
const seenT = () => +rd(KSEEN, 0) || 0;
const markSeen = () => wr(KSEEN, Date.now());
const unread = () => events().filter(e => e.k !== "trade" && e.t > seenT()).length;
const pendWd = () => txOf("real").filter(x => isWd(x) && x.status === "Processing");
const pendDep = () => txOf("real").filter(x => isDep(x) && x.status === "Pending");
const pendCount = () => pendWd().length + pendDep().length;

function activity(){
  const s = readS(), out = [];
  A.logins().slice(0, 12).forEach(l => { const u = A.accounts().find(x => x.id === l.uid); out.push({t:l.t, ic:"users", a:`${esc(u ? u.name : "User")} logged in`, b:esc(l.dev || "")}); });
  (s.tx || []).slice(0, 12).forEach(x => out.push({t:x.t, ic:"fin", a:`${esc(x.kind || x.type || "tx")} ${n2(x.amount ?? x.amt)} USDT`, b:esc(x.method || (x.from ? x.from + " to " + x.to : ""))}));
  (s.history || []).slice(0, 12).forEach(h => out.push({t:h.closed || h.open, ic:"trade", a:`Binary ${esc(h.sym || "")} ${esc(h.result || "")}`, b:`${n2(h.profit)} USDT`}));
  return out.filter(x => x.t).sort((a, b) => b.t - a.t).slice(0, 8);
}
function days7(){
  const s = readS(), out = [], d0 = dayStart(), all = [...(s.history || []), ...((s.fut && s.fut.history) || [])];
  for (let i = 6; i >= 0; i--){ const a = d0 - i * 864e5, b = a + 864e5; out.push({l:new Date(a).toLocaleDateString("en-US", {weekday:"short"}).slice(0, 2), v:all.filter(h => { const t = h.closed || h.open || 0; return t >= a && t < b; }).length}); }
  return out;
}
const sumKind = (re, m = VIEW) => txOf(m).filter(x => re.test(x.kind || "") && !/^Earn/.test(x.method || "")).reduce((x, y) => x + (+y.amount || 0), 0);
function stats(){
  const s = readS(), acc = A.accounts(), today = dayStart(), lg = A.logins();
  const act = new Set(lg.filter(l => l.t >= today && l.uid).map(l => l.uid)).size;
  const tdy = (s.history || []).filter(h => (h.closed || h.open || 0) >= today).length + (s.positions || []).filter(p => p.open >= today).length + ((s.fut.history) || []).filter(h => (h.closed || h.open || 0) >= today).length;
  const openPos = (s.positions || []).length + s.fut.positions.length + s.fut.orders.length + (s.opt.positions || []).length + Object.keys(s.spot.hold || {}).length;
  return {users:acc.length, active:Math.max(act, A.me() ? 1 : 0), total:totalOf(), dep:sumKind(/^deposit$/), wd:sumKind(/^withdrawal$/), tdy, openPos};
}

/* ---------- shell ---------- */
const SECS = [
  {k:"", t:"Overview", i:"dash", d:"Key numbers and shortcuts", tip:"overview"},
  {k:"users", t:"Users", i:"users", d:"Accounts, wallets, positions", tip:"users"},
  {k:"finance", t:"Wallets and Finance", i:"wallet", d:"Balances, deposits, withdrawals", tip:"finance"},
  {k:"trading", t:"Trading", i:"trade", d:"Futures, Spot, Binary, Options and more", tip:"trading"},
  {k:"requests", t:"Requests", i:"inbox", d:"Pay withdrawals, approve deposits", tip:"requests"},
  {k:"notifs", t:"Notifications", i:"bell", d:"Real-account activity", tip:"notifs"},
  {k:"hdw", t:"HD Wallet", i:"key", d:"Deposit addresses from a seed", tip:"hdw"},
  {k:"brand", t:"Branding", i:"brand", d:"App name and logo", tip:"brand"},
  {k:"ai", t:"AI Assistant", i:"ai", d:"API key, model, rules", tip:"ai"},
  {k:"settings", t:"Settings", i:"cog", d:"Banner, maintenance, announcement", tip:"settings"}
];
const NAVI = [["", "Overview", "dash"], ["users", "Users", "users"], ["trading", "Trading", "trade"], ["finance", "Finance", "wallet"], ["requests", "Requests", "inbox"]];
const secOf = p => p[0] === "user" ? "users" : (p[0] === "games" || p[0] === "predict") ? "trading" : (p[0] || "");
const logoHtml = () => { const b = window.Brand ? Brand.get() : {}; return b.logo && Brand.safeLogo(b.logo) ? `<img src="${esc(b.logo)}" alt="" width="30" height="30" class="a2-lg">` : `<span class="a2-lg a2-lgi">${I("shield", 18)}</span>`; };
const appName = () => esc((window.CONFIG && CONFIG.APP_NAME) || "NovaTrade");
function navEl(){ let n = document.getElementById("a2nav"); if (!n){ n = document.createElement("nav"); n.id = "a2nav"; n.className = "a2-nav"; n.setAttribute("aria-label", "Admin"); document.body.appendChild(n); } return n; }
function drawNav(sec){
  const pc = pendCount();
  navEl().innerHTML = `<div class="a2-nav-in">${NAVI.map(([k, n, i]) => `<a href="#/admin${k ? "/" + k : ""}" class="${sec === k ? "on" : ""}" ${sec === k ? 'aria-current="page"' : ""}><span class="a2-ni">${I(i, 22)}${k === "requests" && pc ? `<em class="a2-bd" data-pcount>${pc > 9 ? "9+" : pc}</em>` : ""}</span><span>${n}</span></a>`).join("")}</div>`;
}
function toApp(){ try { localStorage.setItem("nt_adminmode", "app"); } catch {} location.hash = "#/home"; }
function toAdmin(){ try { localStorage.setItem("nt_adminmode", "admin"); } catch {} location.hash = "#/admin"; }
const modeBar = () => `<div class="a2-mode"><span>Viewing <b>${VIEW === "real" ? "Real" : "Demo"}</b> account</span><div class="a2-mseg" role="group" aria-label="Account view"><button data-view="demo" class="${VIEW === "demo" ? "on" : ""}">Demo</button><button data-view="real" class="${VIEW === "real" ? "on" : ""}">Real</button></div></div>`;
function head(title, back){
  const un = unread();
  return `<header class="a2-top"><button class="a2-ib" data-menu aria-label="Open menu">${I("menu", 22)}</button>${back ? `<a class="a2-ib" href="${back}" aria-label="Back">${I("back", 20)}</a>` : logoHtml()}
    <div class="a2-ttl"><b>${esc(title)}</b><small>${appName()} Admin</small></div>
    <a class="a2-ib a2-bell" href="#/admin/notifs" aria-label="Notifications">${I("bell", 20)}${un ? `<em class="a2-bd" data-ucount>${un > 9 ? "9+" : un}</em>` : ""}</a>
    <button class="a2-ib" data-toapp aria-label="Switch to app">${I("swap", 18)}</button></header>`;
}
function drawer(){
  const f = fin();
  return `<div class="a2-dscrim" data-dclose></div><aside class="a2-drawer" role="dialog" aria-label="Admin menu"><div class="a2-dh">${logoHtml()}<div><b>${appName()}</b><small>Admin panel</small></div><button class="a2-ib" data-dclose aria-label="Close menu">${I("close", 18)}</button></div>
    <div class="a2-dl">${SECS.map(s => `<a href="#/admin${s.k ? "/" + s.k : ""}" data-dclose class="a2-di"><span class="a2-hi">${I(s.i, 18)}</span><span><b>${s.t}</b><small>${s.d}</small></span>${I("chev", 14)}</a>`).join("")}</div>
    <div class="a2-dsec">Advanced</div>
    <div class="a2-dadv">${tog("a2dap", f.autoPay, "Auto-pay withdrawals", "Off = pay each one manually", "autopay")}${tog("a2dac", f.autoCredit, "Auto-credit deposits", "Off = approve each one", "autocredit")}</div>
    <div class="a2-dbtns"><button class="a2-b" data-toapp>${I("swap", 16)} Switch to app</button><button class="a2-b dng" data-nt-logout>${I("out", 16)} Log out</button></div></aside>`;
}
function setFinAutoPay(on){
  setFin({autoPay:on});
  if (on){ run(() => { (store.s.tx || []).forEach(x => { if (isWd(x) && x.status === "Processing") x.done = Date.now(); }); }, "real"); }
  toast(on ? "Auto-pay on" : "Auto-pay off: pay requests manually", "ok");
}

/* ---------- screens ---------- */
const V = {};
const secCard = s => `<a class="a2-sc" href="#/admin${s.k ? "/" + s.k : ""}"><span class="a2-hi">${I(s.i, 20)}</span><span class="a2-sct"><b>${s.t}</b><small>${s.d}</small></span><button class="a2-q" type="button" data-tip="${s.tip}" aria-label="What is ${esc(s.t)}?">?</button></a>`;
V.dash = () => {
  const k = stats(), w = readS().wallets || {}, pc = pendCount();
  const html = card(secH(I("dash", 18), "Overview", "overview"), `<div class="a2-kpis">
    ${kpi("Users", n0(k.users), "users", "", "#/admin/users")}${kpi("Active today", n0(k.active), "pulse", "", "#/admin/users")}
    ${kpi("Total balance (USDT)", n2(k.total), "wallet", "wide", "#/admin/finance")}
    ${kpi("Deposits (USDT)", n2(k.dep), "fin", "up", "#/admin/finance")}${kpi("Withdrawals (USDT)", n2(k.wd), "out", "down", "#/admin/finance")}
    ${kpi("Trades today", n0(k.tdy), "trade", "", "#/admin/trading")}${kpi("Open positions", n0(k.openPos), "chip", "", "#/admin/trading")}
    ${kpi("Pending requests", n0(pc), "inbox", pc ? "warn" : "", "#/admin/requests")}${kpi("Unread alerts", n0(unread()), "bell", "", "#/admin/notifs")}</div>`, "flush0") +
    card(secH(I("list", 18), "Sections"), `<div class="a2-secs">${SECS.filter(s => s.k !== "").map(secCard).join("")}</div>`) +
    card(secH(I("trade", 18), "Trades, last 7 days"), bars(days7())) +
    card(secH(I("wallet", 18), "Balance by wallet"), hbars(WK.map(x => [wname(x), +w[x] || 0, `<i class="a2-wi s">${wic(x, 14)}</i>`]))) +
    card(secH(I("pulse", 18), "Recent activity"), activity().length ? activity().map(x => actRow(x.ic, x.a, x.b, tstr(x.t))).join("") : empty("No activity yet."));
  return {title:"Overview", html};
};

function userRow(u){
  return `<a class="a2-u" href="#/admin/user/${esc(u.id)}"><span class="a2-av">${esc((u.name || "?")[0].toUpperCase())}</span><span class="a2-um"><b>${esc(u.name)}${u.blocked ? ' <em class="a2-bl">Blocked</em>' : ""}</b><small>${esc(u.email)}</small></span><span class="a2-role ${esc(u.role)}">${esc(u.role)}</span>${I("chev", 16)}</a>`;
}
V.users = () => {
  const html = card(secH(I("users", 18), "Users", "users"), `<label class="a2-search">${I("search", 18)}<input id="a2q" placeholder="Search name or email" aria-label="Search users" autocomplete="off"></label><div id="a2ul" class="a2-ul"></div>`);
  return {title:"Users", html, mount(r){
    const list = r.querySelector("#a2ul"), q = r.querySelector("#a2q");
    const draw = () => { const t = q.value.trim().toLowerCase(), l = A.accounts().filter(u => !t || (u.name + " " + u.email).toLowerCase().includes(t)); list.innerHTML = l.length ? l.map(userRow).join("") : empty("No users found."); };
    q.oninput = draw; draw();
  }};
};

/* adjust-balance sheet: app-style wallet chips, amount, note */
function adjustSheet(defWallet){
  let wk = defWallet || "spot", sign = 1;
  U.sheet("Add or deduct balance", `<div class="a2-sh">${chips("a2sgn", [{v:"1", l:"Add", ic:I("plus", 16)}, {v:"-1", l:"Deduct", ic:I("minus", 16)}], "1", "c2")}
    <div class="a2-lbl">Wallet</div>${walletChips("a2wk", wk)}
    ${field("Amount (USDT)", "a2am", "", {step:"any", min:0, ph:"0.00"})}${field("Note for the user (optional)", "a2nt", "", {type:"text", max:60, ph:"e.g. Bonus"})}
    <p class="a2-hint">The user gets a notification: "Balance added by system".</p><button class="a2-b pri" id="a2go">Confirm</button></div>`, el => {
    bindChips(el, "a2sgn", v => sign = +v); bindChips(el, "a2wk", v => wk = v);
    el.querySelector("#a2go").onclick = () => {
      const v = parseFloat(el.querySelector("#a2am").value); if (!(v > 0)) return toast("Enter an amount", "bad");
      const e = adjust(wk, sign * v, el.querySelector("#a2nt").value.trim()); if (e) return toast(e, "bad");
      U.fx && U.fx("claim"); U.closeLayer(); toast(`${sign > 0 ? "Added" : "Deducted"} ${n2(v)} USDT`, "ok"); App.route();
    };
  });
}

/* ---------- finance ---------- */
const wdCard = x => `<div class="a2-pw"><div class="a2-ac"><span class="a2-ai dn">${I("out", 16)}</span><div><b>${n2(x.amount)} ${esc(x.coin || "USDT")} <span class="a2-st">${esc(x.status || "")}</span></b><small>${esc(x.method || "")} · ${tstr(x.t)}</small></div></div>
  <div class="a2-addr"><span>${esc(x.addr || "No address")}</span>${x.addr ? `<button class="a2-ib sm" data-copy="${esc(x.addr)}" aria-label="Copy address">${I("copy", 14)}</button>` : ""}</div>
  ${x.receive != null ? `<div class="a2-hint">Receive ${n2(x.receive)} ${esc(x.coin || "USDT")} after fee ${n2(x.fee)}</div>` : ""}
  ${x.status === "Processing" ? `<div class="a2-btns"><button class="a2-b pri" data-pay="${esc(x.id)}">Pay manually</button><button class="a2-b dng" data-rj="${esc(x.id)}">Reject</button></div>` : x.txHash ? `<div class="a2-hint">Tx ${esc(x.txHash)}</div>` : ""}</div>`;
const depCard = x => `<div class="a2-pw"><div class="a2-ac"><span class="a2-ai upc">${I("fin", 16)}</span><div><b>+${n2(x.amount)} ${esc(x.coin || "USDT")} <span class="a2-st">${esc(x.status || "")}</span></b><small>${esc(x.method || "")} · ${tstr(x.t)}</small></div></div>
  ${x.status === "Pending" ? `<div class="a2-btns"><button class="a2-b pri" data-dap="${esc(x.id)}">Approve and credit</button><button class="a2-b dng" data-drj="${esc(x.id)}">Reject</button></div>` : ""}</div>`;
function wdActions(r){
  r.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => U.copyText ? U.copyText(b.dataset.copy, "Address copied") : toast("Copied", "ok"));
  r.querySelectorAll("[data-pay]").forEach(b => b.onclick = () => payWd(b.dataset.pay));
  r.querySelectorAll("[data-rj]").forEach(b => b.onclick = async () => { if (!await U.confirmBox("Reject withdrawal?", "The amount is refunded to the user's Funding wallet.", "Reject", true)) return; rejectWd(b.dataset.rj); });
  r.querySelectorAll("[data-dap]").forEach(b => b.onclick = () => approveDep(b.dataset.dap));
  r.querySelectorAll("[data-drj]").forEach(b => b.onclick = async () => { if (!await U.confirmBox("Reject deposit?", "The deposit stays uncredited and is marked Rejected.", "Reject", true)) return; run(() => { const x = store.s.tx.find(z => z.id === b.dataset.drj); if (x){ x.status = "Rejected"; userNotify("Deposit rejected", `Your deposit of ${n2(x.amount)} USDT was rejected.`, "bad"); } }, "real"); toast("Deposit rejected", "ok"); App.route(); });
}
function payWd(id){
  const x = txOf("real").find(z => z.id === id); if (!x) return;
  U.sheet("Pay manually", `<div class="a2-sh"><div class="a2-box">${kv("Amount", `${n2(x.amount)} ${esc(x.coin || "USDT")}`)}${kv("Receive", `${n2(x.receive != null ? x.receive : x.amount)} ${esc(x.coin || "USDT")}`)}${kv("Network", esc(x.method || ""))}${kv("Address", `<span class="mono a2-brk">${esc(x.addr || "")}</span>`)}</div>
    <p class="a2-hint">Send the funds from your wallet, then paste the transaction hash and confirm.</p>${field("Transaction hash", "a2tx", "", {type:"text", max:120, ph:"0x..."})}<button class="a2-b pri" id="a2go">Mark as paid</button></div>`, el => {
    el.querySelector("#a2go").onclick = () => { const h = el.querySelector("#a2tx").value.trim();
      run(() => { const y = store.s.tx.find(z => z.id === id); if (!y) return; y.status = "Completed"; y.txHash = h; y.paidAt = Date.now(); userNotify("Withdrawal completed", `${n2(y.receive != null ? y.receive : y.amount)} ${y.coin || "USDT"} sent via ${y.method}${h ? " · Tx " + h.slice(0, 10) + "..." : ""}`, "ok"); }, "real");
      U.fx && U.fx("claim"); U.closeLayer(); toast("Withdrawal marked as paid", "ok"); App.route(); };
  });
}
function rejectWd(id){
  run(() => { const y = store.s.tx.find(z => z.id === id); if (!y || y.status !== "Processing") return; y.status = "Rejected"; store.addWallet("funding", +y.amount || 0, "refund"); userNotify("Withdrawal rejected", `${n2(y.amount)} ${y.coin || "USDT"} was returned to your Funding wallet.`, "bad"); }, "real");
  toast("Withdrawal rejected and refunded", "ok"); App.route();
}
function approveDep(id){
  run(() => { const y = store.s.tx.find(z => z.id === id); if (!y || y.status !== "Pending") return; y.status = "Completed"; store.addWallet("funding", +y.amount || 0, "deposit-approved"); userNotify("Deposit successful", `${n2(y.amount)} USDT has been credited to your Funding wallet.`, "ok"); }, "real");
  U.fx && U.fx("claim"); toast("Deposit credited", "ok"); App.route();
}
function finToggles(r){
  const ap = r.querySelector("#a2ap"), ac = r.querySelector("#a2ac");
  if (ap) ap.onchange = () => { setFinAutoPay(ap.checked); App.route(); };
  if (ac) ac.onchange = () => { setFin({autoCredit:ac.checked}); toast(ac.checked ? "Deposits are credited automatically" : "Deposits wait for your approval", "ok"); };
}
V.finance = () => {
  const f = fin(), tx = txOf().filter(x => isDep(x) || isWd(x) || /^admin-/.test(x.kind || "")), w = readS().wallets || {};
  const item = x => { const w2 = isWd(x), adm = /^admin-/.test(x.kind); return `<div class="a2-ac"><span class="a2-ai ${w2 || x.kind === "admin-debit" ? "dn" : "upc"}">${I(w2 ? "out" : adm ? "cog" : "fin", 16)}</span><div><b>${adm ? "Admin " + (x.kind === "admin-debit" ? "deduct" : "credit") : w2 ? "Withdrawal" : "Deposit"} ${esc(x.coin || "USDT")}</b><small>${esc(x.method || "")}${x.status ? " · " + esc(x.status) : ""} · ${tstr(x.t)}</small></div><em class="${w2 || x.kind === "admin-debit" ? "down" : "up"}">${w2 || x.kind === "admin-debit" ? "-" : "+"}${n2(x.amount)}</em></div>`; };
  const html = card(secH(I("wallet", 18), "Wallets and finance", "finance"), `<div class="a2-kpis">${kpi("Total balance (USDT)", n2(totalOf()), "wallet", "wide")}${kpi("Deposits (USDT)", n2(sumKind(/^deposit$/)), "fin", "up")}${kpi("Withdrawals (USDT)", n2(sumKind(/^withdrawal$/)), "out", "down")}</div><button class="a2-b pri" data-adj style="margin-top:12px">${I("plus", 16)} Add or deduct balance</button>`) +
    card(secH(I("chip", 18), "Wallets"), hbars(WK.map(x => [wname(x), +w[x] || 0, `<i class="a2-wi s">${wic(x, 14)}</i>`]))) +
    card(secH(I("cog", 18), "Payment mode"), tog("a2ap", f.autoPay, "Auto-pay withdrawals", "Off: requests wait for you to pay them", "autopay") + tog("a2ac", f.autoCredit, "Auto-credit deposits", "Off: deposits wait for your approval", "autocredit") +
      `<a class="a2-link" href="#/admin/hdw">${I("key", 16)}<span>HD wallet: deposit addresses</span>${I("chev", 14)}</a><a class="a2-link" href="#/admin/requests">${I("inbox", 16)}<span>Open requests${pendCount() ? ` (${pendCount()})` : ""}</span>${I("chev", 14)}</a>`) +
    card(secH(I("list", 18), "Transactions"), tx.length ? tx.slice(0, 30).map(item).join("") : empty("No transactions yet."));
  return {title:"Finance", html, mount(r){ finToggles(r); r.querySelector("[data-adj]").onclick = () => adjustSheet(); }};
};

V.requests = () => {
  const wd = txOf("real").filter(isWd), dp = txOf("real").filter(x => isDep(x) && x.status), f = fin();
  const html = card(secH(I("inbox", 18), "Withdraw requests", "requests"), tog("a2ap", f.autoPay, "Auto-pay", f.autoPay ? "Requests complete by themselves" : "Pay each request manually", "autopay") + (wd.length ? wd.slice(0, 30).map(wdCard).join("") : empty("No withdrawal requests."))) +
    card(secH(I("fin", 18), "Deposits", null), tog("a2ac", f.autoCredit, "Auto-credit deposits", f.autoCredit ? "Credited instantly" : "Approve each deposit below", "autocredit") + (dp.length ? dp.slice(0, 30).map(depCard).join("") : empty("No deposits waiting. Deposits show here when Auto-credit is off.")));
  return {title:"Requests", noMode:true, html, mount(r){ finToggles(r); wdActions(r); markSeen(); }};
};

V.notifs = () => {
  let flt = "all"; const ev = events();
  const row = e => `<div class="a2-ac ${e.t > seenT0 ? "unr" : ""}"><span class="a2-ai ${e.k === "wd" ? "dn" : e.k === "dep" ? "upc" : ""}">${I(e.ic, 16)}</span><div><b>${e.a}</b><small>${e.b}</small></div><em class="${e.up === false ? "down" : e.up ? "up" : ""}">${e.r || tstr(e.t)}</em></div>`;
  const seenT0 = seenT();
  const html = card(secH(I("bell", 18), "Real-account activity", "notifs", `<button class="a2-b sm" data-readall>Mark all read</button>`), chips("a2f", [{v:"all", l:"All"}, {v:"dep", l:"Deposits"}, {v:"wd", l:"Withdrawals"}, {v:"trade", l:"Trades"}], "all") + `<div id="a2nl"></div>`) +
    (pendCount() ? card(secH(I("inbox", 18), "Needs action"), `<a class="a2-link" href="#/admin/requests">${I("inbox", 16)}<span>${pendCount()} request${pendCount() > 1 ? "s" : ""} waiting</span>${I("chev", 14)}</a>`) : "");
  return {title:"Notifications", noMode:true, html, mount(r){
    const draw = () => { const l = ev.filter(e => flt === "all" || e.k === flt); r.querySelector("#a2nl").innerHTML = l.length ? l.map(row).join("") : empty("No activity yet. Real-account deposits and withdrawals appear here."); };
    bindChips(r, "a2f", v => { flt = v; draw(); }); draw();
    r.querySelector("[data-readall]").onclick = () => { markSeen(); toast("All marked as read", "ok"); App.route(); };
  }};
};

/* ---------- branding ---------- */
const MAXLOGO = 192;
function fileToLogo(file){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { try {
      const c = document.createElement("canvas"); c.width = c.height = MAXLOGO; const x = c.getContext("2d"), s = Math.min(im.width, im.height) || 1;
      x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, MAXLOGO, MAXLOGO); URL.revokeObjectURL(url); res(c.toDataURL("image/png"));
    } catch (e) { rej(e); } };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Could not read that image")); }; im.src = url;
  });
}
V.brand = () => {
  const b = window.Brand ? Brand.get() : {name:"", logo:""};
  const html = card(secH(I("brand", 18), "App name and logo", "brand"), `<div class="a2-bp"><div class="a2-bpl" id="a2pv">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : I("shield", 30)}</div><div><b id="a2pn">${esc(b.name || (window.Brand && Brand.orig) || "NovaTrade")}</b><small>Preview</small></div></div>
    ${field("App name", "a2bn", b.name, {type:"text", max:24, ph:(window.Brand && Brand.orig) || "NovaTrade"})}
    <div class="a2-lbl">Logo</div><div class="a2-btns"><button class="a2-b" id="a2up">${I("plus", 16)} Upload image</button><button class="a2-b" id="a2rl">Remove logo</button></div><input type="file" id="a2file" accept="image/*" hidden>
    ${field("or paste an image URL (https)", "a2lu", /^https:/.test(b.logo) ? b.logo : "", {type:"text", ph:"https://..."})}
    <p class="a2-hint">The name and logo replace the old ones everywhere after you save (header, login, browser tab, favicon). The page reloads once.</p>
    <div class="a2-btns"><button class="a2-b pri" id="a2sv">Save branding</button><button class="a2-b dng" id="a2rs">Reset to default</button></div>`);
  return {title:"Branding", noMode:true, html, mount(r){
    const q = x => r.querySelector(x); let logo = b.logo || "";
    const pv = () => { q("#a2pv").innerHTML = logo ? `<img src="${esc(logo)}" alt="">` : I("shield", 30); q("#a2pn").textContent = q("#a2bn").value.trim() || ((window.Brand && Brand.orig) || "NovaTrade"); };
    q("#a2bn").oninput = pv;
    q("#a2up").onclick = () => q("#a2file").click();
    q("#a2file").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { logo = await fileToLogo(f); q("#a2lu").value = ""; pv(); toast("Logo ready, tap Save", "ok"); } catch (er) { toast(er.message, "bad"); } };
    q("#a2lu").oninput = () => { const v = q("#a2lu").value.trim(); if (!v) return; if (window.Brand && Brand.safeLogo(v)){ logo = v; pv(); } };
    q("#a2rl").onclick = () => { logo = ""; q("#a2lu").value = ""; pv(); };
    q("#a2sv").onclick = () => { const name = q("#a2bn").value.trim(); if (logo && !Brand.safeLogo(logo)) return toast("Logo URL must start with https://", "bad"); Brand.set({name, logo}); toast("Saved. Reloading...", "ok"); setTimeout(() => location.reload(), 500); };
    q("#a2rs").onclick = async () => { if (!await U.confirmBox("Reset branding?", "The original name and logo come back.", "Reset", true)) return; Brand.reset(); toast("Reset. Reloading...", "ok"); setTimeout(() => location.reload(), 500); };
  }};
};

/* ---------- settings ---------- */
const API_ST = () => { const u = window.CONFIG && CONFIG.API_URL; return u ? esc(u) : "Local (device only)"; };
V.settings = () => {
  const a = A.adminSettings(), maint = !!(a.banner || "").trim();
  const html = card(secH(I("cog", 18), "Content", "settings"), field("Banner text", "a2ban", a.banner, {type:"text", max:140, ph:"Shown at the top of the app"}) + tog("a2mt", maint, "Maintenance mode", "Shows a maintenance banner to all users") + `<button class="a2-b pri" id="a2sv">Save content</button>`) +
    card(secH(I("bell", 18), "Announcement"), field("Message", "a2an", "", {type:"text", max:200, ph:"Sent to every user's notifications"}) + `<button class="a2-b" id="a2sd">Send announcement</button>${a.announce ? `<p class="a2-hint">Last: ${esc(a.announce)}</p>` : ""}`) +
    card(secH(I("chip", 18), "Backend"), kv("API", API_ST()) + kv("Running account", curMode() === "real" ? "Real" : "Demo") + kv("Stored data", "Demo and Real stores on this device") + `<p class="a2-hint">Set CONFIG.API_URL to route Real account actions to the server.</p>`) +
    card(secH(I("info", 18), "App"), kv("Version", esc((window.CONFIG && CONFIG.APP_VERSION) || "7.1")) + kv("Signed in as", esc(A.me()?.email || "admin")) + kv("Settings updated", a.updated ? tstr(a.updated) : "Never") + `<div class="a2-btns col"><button class="a2-b pri" data-toapp>${I("swap", 16)} Switch to app</button><button class="a2-b dng" data-nt-logout>${I("out", 16)} Log out</button></div>`);
  return {title:"Settings", noMode:true, html, mount(r){
    const q = x => r.querySelector(x);
    q("#a2mt").onchange = e => { const b = q("#a2ban"); if (e.target.checked && !b.value.trim()) b.value = "Scheduled maintenance in progress. Some features may be unavailable."; if (!e.target.checked) b.value = ""; };
    q("#a2sv").onclick = () => { A.saveAdmin({...A.adminSettings(), banner:q("#a2ban").value.trim()}); toast("Content saved", "ok"); };
    q("#a2sd").onclick = () => { const t = q("#a2an").value.trim(); if (!t) return toast("Write an announcement first", "bad"); store.notify("Announcement", t, "info"); A.saveAdmin({...A.adminSettings(), announce:t}); q("#a2an").value = ""; toast("Announcement sent", "ok"); };
  }};
};

/* ---------- router ---------- */
let forced = null, pollT = 0, lastEv = 0;
function setAdminBody(on){
  document.body.classList.toggle("adm-mode", !!on);
  const el = document.documentElement;
  if (on){ if (forced == null) forced = el.dataset.theme || "dark"; el.dataset.theme = "dark"; const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = "#1F2630"; }
  else { if (forced != null){ el.dataset.theme = forced; forced = null; const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = forced === "light" ? "#F5F7FB" : "#1F2630"; } document.getElementById("a2nav")?.remove(); }
}
const ROUTES = {"": "dash", users:"users", user:"user", trading:"trading", games:"trading", predict:"trading", finance:"finance", requests:"requests", notifs:"notifs", brand:"brand", ai:"ai", hdw:"hdw", settings:"settings"};
Pages.admin = (p = []) => {
  if (!ok()){ setTimeout(() => { location.hash = "#/home"; }, 0); return {html:"", title:"Admin"}; }
  RC = {};
  const a = p[0] || "", key = ROUTES[a] || "dash", f = V[key];
  const sc = f ? f(key === "user" ? p[1] : key === "trading" ? (a === "games" ? "game" : a === "predict" ? "predict" : p[1]) : p[1]) : {title:"Admin", html:empty("This section is not loaded.")};
  const html = `<div class="a2">${head(sc.title, sc.back)}${sc.noMode ? "" : modeBar()}<div class="a2-body">${sc.html}</div><div class="a2-dr" hidden>${drawer()}</div></div>`;
  return {html, title:"Admin · " + sc.title, mount(r){
    setAdminBody(true); try { localStorage.setItem("nt_adminmode", "admin"); } catch {} drawNav(secOf(p));
    document.getElementById("ntBanner")?.remove();
    r.querySelectorAll("[data-view]").forEach(x => x.onclick = () => { setView(x.dataset.view); App.route(); });
    r.querySelectorAll("[data-toapp]").forEach(x => x.onclick = toApp);
    const dr = r.querySelector(".a2-dr"), openD = on => { if (on){ dr.hidden = false; requestAnimationFrame(() => dr.classList.add("show")); } else { dr.classList.remove("show"); setTimeout(() => { dr.hidden = true; }, 220); } };
    r.querySelector("[data-menu]").onclick = () => openD(true);
    dr.querySelectorAll("[data-dclose]").forEach(x => x.addEventListener("click", () => openD(false)));
    const dap = dr.querySelector("#a2dap"), dac = dr.querySelector("#a2dac");
    dap.onchange = () => { setFinAutoPay(dap.checked); }; dac.onchange = () => { setFin({autoCredit:dac.checked}); toast(dac.checked ? "Deposits are credited automatically" : "Deposits wait for your approval", "ok"); };
    r.addEventListener("click", e => { const t = e.target.closest("[data-tip]"); if (!t) return; e.preventDefault(); e.stopPropagation(); const d = TIPS[t.dataset.tip]; if (d) showTip(d[0], d[1]); }, true);
    /* live badge + toast for new real-account activity */
    lastEv = Math.max(seenT(), Date.now());
    clearInterval(pollT); pollT = setInterval(() => {
      try {
        const ev = events().filter(e => e.k !== "trade" && e.t > lastEv); if (ev.length){ lastEv = Math.max(...ev.map(e => e.t)); const e = ev[0]; U.buzz && U.buzz(14); toast(e.k === "wd" ? "New withdrawal request" : "New deposit", "info"); }
        const un = unread(), pc = pendCount(), b = r.querySelector("[data-ucount]"), bell = r.querySelector(".a2-bell");
        if (bell){ if (un && !b) bell.insertAdjacentHTML("beforeend", `<em class="a2-bd" data-ucount>${un > 9 ? "9+" : un}</em>`); else if (b){ if (un) b.textContent = un > 9 ? "9+" : un; else b.remove(); } }
        const pn = document.querySelector("[data-pcount]"); if (pn && !pc) pn.remove(); else if (pn) pn.textContent = pc > 9 ? "9+" : pc; else if (pc) drawNav(secOf(p));
      } catch {}
    }, 4000);
    sc.mount && sc.mount(r);
    if (p[0] === "notifs") markSeen();
  }, unmount(){ clearInterval(pollT); setAdminBody(false); try { sc.unmount && sc.unmount(); } catch {} }};
};
addEventListener("hashchange", () => { const n = location.hash.replace(/^#\/?/, "").split("/")[0]; if (n !== "admin") setAdminBody(false); });

/* ---------- entry points in the normal app ---------- */
const swRow = `<section class="pm-sec a2-swrow"><button class="pm-row tap" data-toadmin><span class="pm-main"><span class="pm-t">Admin panel</span><span class="pm-s" style="display:block">Switch to the ${appName()} Admin app</span></span><span class="chev">${I("chev", 16)}</span></button></section>`;
function wrapSettings(){
  const f = Pages.settings; if (!f) return;
  Pages.settings = (...args) => { const p = f(...args); if (!A.isAdmin()) return p; const mt = p.mount;
    p.mount = function(r){ const out = mt && mt.apply(this, arguments); try { const pg = r.querySelector(".pm-page") || r.firstElementChild; if (pg){ pg.insertAdjacentHTML("afterbegin", swRow); r.querySelectorAll("[data-toadmin]").forEach(b => b.onclick = toAdmin); } } catch (e) { console.error(e); } return out; }; return p; };
}
wrapSettings();
/* "Switch to Admin Panel" (profile bottom): admins go straight in, others sign in as admin first */
function openAdmin(){
  if (A.isAdmin() || A.bypass()) return toAdmin();
  U.sheet("Admin sign-in", `<div class="a2-sh"><p class="a2-hint">Sign in with the admin account to open the admin panel.</p>${field("Admin email", "a2e", "", {type:"text", ph:"admin email"})}${field("Password", "a2p", "", {type:"password", ph:"Password"})}<div class="a2-err" id="a2er"></div><button class="a2-b pri" id="a2go">Open admin panel</button></div>`, el => {
    const go = async () => {
      const e = el.querySelector("#a2e").value.trim().toLowerCase(), pw = el.querySelector("#a2p").value, er = el.querySelector("#a2er");
      const acc = A.accounts().find(x => String(x.email).toLowerCase() === e && x.role === "admin");
      if (!acc || acc.passHash !== await A.hash(e, pw)){ er.textContent = "Incorrect admin email or password."; U.buzz && U.buzz("err"); return; }
      try { localStorage.setItem("nt_session", JSON.stringify({id:acc.id, t:Date.now()})); } catch {}
      U.closeLayer(); toAdmin(); setTimeout(() => App.route(), 30);
    };
    el.querySelector("#a2go").onclick = go; el.querySelector("#a2p").onkeydown = ev => { if (ev.key === "Enter") go(); };
  });
}
document.addEventListener("click", e => { const b = e.target.closest("[data-adm-switch]"); if (b){ e.preventDefault(); openAdmin(); } });

if (A.isAdmin()){
  const h = location.hash.replace(/^#\/?/, "");
  let m = "admin"; try { m = localStorage.getItem("nt_adminmode") || "admin"; } catch {}
  if ((!h || h === "home") && m === "admin") history.replaceState(null, "", "#/admin");
}
window.Admin2 = {V, A, I, P, esc, n2, n0, dstr, tstr, sgn, card, secH, kpi, empty, field, tog, kv, chips, bindChips, walletChips, tipBtn, showTip, TIPS, hbars, actRow, wic, wname, WK, WN, WI,
  get view(){ return VIEW; }, setView, live, curMode, readS, run, peek, bal, totalOf, adjust, adjustSheet, userNotify, fin, setFin, toApp, toAdmin, open:openAdmin, stats, rd, wr, events};
})();
