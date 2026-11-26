/* v6.8 admin app: separate Admin shell (own header + bottom nav), routes #/admin, #/admin/users, #/admin/user/<id>, #/admin/trading, #/admin/games, #/admin/predict, #/admin/finance, #/admin/settings. Demo data is local to this device. */
(function(){
if (!window.U || !window.Pages || !window.Auth) return;
const {esc, store, toast} = U;
const A = window.Auth;
/* Demo / Real data views: the live store is the current account mode; the other mode is read from its localStorage store (read-only) */
const curMode = () => (window.ACCT ? ACCT.mode() : "demo");
let VIEW = (() => { try { return sessionStorage.getItem("nt_admview") || curMode(); } catch { return curMode(); } })();
const setView = v => { VIEW = v; try { sessionStorage.setItem("nt_admview", v); } catch {} };
const live = () => VIEW === curMode();
const dkey = n => n + (VIEW === "real" ? "_real" : "");
let _oc = null;
const S = () => {
  if (live()) return store.s;
  const k = VIEW === "real" ? "novatrade_real_v1" : "novatrade_v1";
  if (!_oc || _oc.k !== k || Date.now() - _oc.t > 1500){ let o = {}; try { o = JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch {} _oc = {k, t:Date.now(), o:Object.assign({wallets:{}, tx:[], history:[], positions:[], fut:{positions:[], history:[]}}, o)}; }
  return _oc.o;
};
const KMODE = "nt_adminmode";
const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
const getMode = () => { try { return localStorage.getItem(KMODE) || "admin"; } catch { return "admin"; } };
const setMode = m => { try { localStorage.setItem(KMODE, m); } catch {} };
const n2 = v => (+v || 0).toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2});
const n0 = v => (+v || 0).toLocaleString("en-US", {maximumFractionDigits:0});
const dstr = t => new Date(t).toLocaleDateString("en-US", {year:"numeric", month:"short", day:"numeric"});
const tstr = t => new Date(t).toLocaleString("en-US", {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", hour12:false});
const dayStart = () => new Date().setHours(0, 0, 0, 0);
const ok = () => A.isAdmin() || A.bypass();

/* ---------- icons (own set, 24px stroke) ---------- */
const P = {
  dash:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.500 5.500"/>',
  trade:'<path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/>',
  game:'<rect x="2.500" y="7" width="19" height="11" rx="4"/><path d="M7 10.500v4M5 12.500h4"/><circle cx="15.500" cy="11.500" r=".9" fill="currentColor"/><circle cx="18" cy="13.500" r=".9" fill="currentColor"/>',
  fin:'<rect x="2.500" y="5" width="19" height="14" rx="2.500"/><path d="M2.500 10h19M6.500 15h4"/>',
  cog:'<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.700 1.700 0 0 0 .3 1.800l.1.1a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.100a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  swap:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  chev:'<path d="m9 6 6 6-6 6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/>',
  pulse:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  chip:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
};
const I = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

/* ---------- data helpers ---------- */
const racerD = () => { const d = rd(dkey("nt_racer"), null) || {}; return {bets:Array.isArray(d.bets) ? d.bets : [], races:Array.isArray(d.races) ? d.races : [], tx:Array.isArray(d.tx) ? d.tx : []}; };
const predD = () => { const d = rd(dkey("nt_predict"), null) || {}; const a = k => Array.isArray(d[k]) ? d[k] : []; return {orders:a("orders"), positions:a("positions"), history:a("history"), perps:a("perps")}; };
const amt = o => +(o && (o.amount ?? o.size ?? o.cost ?? o.margin ?? o.stake)) || 0;
function racerStats(){
  const d = racerD(), real = d.bets.filter(b => b.mode === "real"), all = d.bets;
  const wag = real.reduce((x, b) => x + (+b.amount || 0), 0), pay = real.reduce((x, b) => x + (+b.payout || 0), 0);
  return {bets:all.length, real:real.length, wagered:wag, paid:pay, house:wag - pay, races:d.races.length, wins:all.filter(b => b.win).length};
}
function predStats(){
  const d = predD(), rows = [...d.orders, ...d.positions, ...d.history, ...d.perps];
  return {orders:d.orders.length, open:d.positions.length + d.perps.length, hist:d.history.length, volume:rows.reduce((x, o) => x + amt(o), 0)};
}
const sumKind = (re) => (S().tx || []).filter(x => re.test(x.kind || "")).reduce((x, y) => x + (+y.amount || 0), 0);
function stats(){
  const s = S(), acc = A.accounts(), today = dayStart();
  const lg = A.logins(), act = new Set(lg.filter(l => l.t >= today && l.uid).map(l => l.uid)).size;
  const hist = (s.history || []), fh = ((s.fut && s.fut.history) || []);
  const tdy = hist.filter(h => (h.closed || h.open || 0) >= today).length + (s.positions || []).filter(p => p.open >= today).length + fh.filter(h => (h.closed || h.open || 0) >= today).length;
  const openPos = (s.positions || []).length + ((s.fut && s.fut.positions) || []).length;
  const total = Object.values(s.wallets || {}).reduce((x, y) => x + (+y || 0), 0);
  return {users:acc.length, active:Math.max(act, A.me() ? 1 : 0), total, dep:sumKind(/^deposit$/), wd:sumKind(/^withdraw/), tdy, openPos, race:racerStats(), pred:predStats()};
}
function days7(){
  const s = S(), out = [], d0 = dayStart(), all = [...(s.history || []), ...((s.fut && s.fut.history) || [])];
  for (let i = 6; i >= 0; i--){
    const a = d0 - i * 864e5, b = a + 864e5;
    out.push({l:new Date(a).toLocaleDateString("en-US", {weekday:"short"}).slice(0, 2), v:all.filter(h => { const t = h.closed || h.open || 0; return t >= a && t < b; }).length});
  }
  return out;
}

/* ---------- shell ---------- */
const NAVI = [["", "Dashboard", "dash"], ["users", "Users", "users"], ["trading", "Trading", "trade"], ["games", "Games", "game"], ["finance", "Finance", "fin"], ["settings", "Settings", "cog"]];
const secOf = p => p[0] === "user" ? "users" : p[0] === "predict" ? "games" : (p[0] || "");
function navEl(){
  let n = document.getElementById("a2nav");
  if (!n){ n = document.createElement("nav"); n.id = "a2nav"; n.className = "a2-nav"; n.setAttribute("aria-label", "Admin"); document.body.appendChild(n); }
  return n;
}
function drawNav(sec){
  navEl().innerHTML = `<div class="a2-nav-in">${NAVI.map(([k, n, i]) => `<a href="#/admin${k ? "/" + k : ""}" class="${sec === k ? "on" : ""}" ${sec === k ? 'aria-current="page"' : ""}>${I(i, 22)}<span>${n}</span></a>`).join("")}</div>`;
}
function toApp(){ setMode("app"); location.hash = "#/home"; }
function toAdmin(){ setMode("admin"); location.hash = "#/admin"; }
const modeBar = () => `<div class="a2-mode"><span>In <b>${curMode() === "real" ? "Real" : "Demo"}</b> account · view:</span><div class="a2-mseg"><button data-view="demo" class="${VIEW === "demo" ? "on" : ""}">Demo</button><button data-view="real" class="${VIEW === "real" ? "on" : ""}">Real</button></div></div>`;
const head = (title, back) => `<header class="a2-top">${back ? `<a class="a2-bk" href="${back}" aria-label="Back">${I("back", 20)}</a>` : `<span class="a2-logo">${I("shield", 20)}</span>`}<div class="a2-ttl"><b>${esc(title)}</b><small>NovaTrade Admin</small></div><span class="a2-badge">ADMIN</span><button class="a2-sw" data-toapp aria-label="Switch to app">${I("swap", 16)}<span>App</span></button></header>`;
const kpi = (l, v, ic, tone, href) => `<${href ? "a href=\"" + href + "\"" : "div"} class="a2-k ${tone || ""}"><span class="a2-ki">${I(ic, 18)}</span><b class="num">${v}</b><small>${l}</small></${href ? "a" : "div"}>`;
const card = (h, body, extra) => `<section class="a2-card"><h2>${h}${extra ? `<span class="a2-x">${extra}</span>` : ""}</h2>${body}</section>`;
const empty = t => `<div class="a2-empty">${t}</div>`;
const field = (l, id, v, o = {}) => `<label class="a2-f"><span>${l}</span><input id="${id}" ${o.type ? `type="${o.type}"` : 'type="number"'} ${o.min != null ? `min="${o.min}"` : ""} ${o.step ? `step="${o.step}"` : ""} ${o.ph ? `placeholder="${o.ph}"` : ""} ${o.max != null ? `maxlength="${o.max}"` : ""} inputmode="${o.type === "text" ? "text" : "decimal"}" value="${esc(v ?? "")}"></label>`;
const tog = (id, on, l, s) => `<label class="a2-tg"><span><b>${l}</b>${s ? `<small>${s}</small>` : ""}</span><input type="checkbox" id="${id}" ${on ? "checked" : ""}><i></i></label>`;
const kv = (a, b) => `<div class="a2-kv"><span>${a}</span><b>${b}</b></div>`;

function bars(arr){
  const mx = Math.max(1, ...arr.map(x => x.v));
  return `<div class="a2-bars" role="img" aria-label="Trades in the last 7 days">${arr.map(x => `<div><i style="height:${Math.max(4, Math.round(x.v / mx * 70))}px" class="${x.v ? "" : "z"}"></i><em class="num">${x.v}</em><small>${x.l}</small></div>`).join("")}</div>`;
}
function hbars(rows){
  const mx = Math.max(1e-9, ...rows.map(r => r[1]));
  return rows.map(([l, v]) => `<div class="a2-hb"><span>${esc(l)}</span><div><i style="width:${Math.max(2, v / mx * 100)}%"></i></div><b class="num">${n2(v)}</b></div>`).join("");
}
function activity(){
  const s = S(), out = [];
  A.logins().slice(0, 12).forEach(l => { const u = A.accounts().find(x => x.id === l.uid); out.push({t:l.t, ic:"users", a:`${esc(u ? u.name : "User")} logged in`, b:esc(l.dev || "")}); });
  (s.tx || []).slice(0, 12).forEach(x => out.push({t:x.t, ic:"fin", a:`${esc(x.kind || x.type || "tx")} ${n2(x.amount ?? x.amt)} USDT`, b:esc(x.method || (x.from ? x.from + " to " + x.to : ""))}));
  (s.history || []).slice(0, 12).forEach(h => out.push({t:h.closed || h.open, ic:"trade", a:`Binary ${esc(h.sym || "")} ${esc(h.result || "")}`, b:`${n2(h.profit)} USDT`}));
  racerD().bets.slice(-8).forEach(b => out.push({t:b.t, ic:"game", a:`Racer bet ${n2(b.amount)} (${b.win ? "win" : "loss"})`, b:esc(b.mode || "")}));
  return out.filter(x => x.t).sort((a, b) => b.t - a.t).slice(0, 8);
}
const actHtml = list => list.length ? list.map(x => `<div class="a2-ac"><span class="a2-ai">${I(x.ic, 16)}</span><div><b>${x.a}</b><small>${x.b}</small></div><em>${tstr(x.t)}</em></div>`).join("") : empty("No activity yet.");

/* ---------- screens ---------- */
const V = {};
V.dash = () => {
  const k = stats(), r = k.race, p = k.pred;
  const w = S().wallets || {};
  const html = `<div class="a2-kpis">
    ${kpi("Users", n0(k.users), "users", "", "#/admin/users")}${kpi("Active today", n0(k.active), "pulse", "", "#/admin/users")}
    ${kpi("Total balance (USDT)", n2(k.total), "fin", "wide")}
    ${kpi("Deposits (USDT)", n2(k.dep), "fin", "up", "#/admin/finance")}${kpi("Withdrawals (USDT)", n2(k.wd), "out", "down", "#/admin/finance")}
    ${kpi("Trades today", n0(k.tdy), "trade", "", "#/admin/trading")}${kpi("Open positions", n0(k.openPos), "chip", "", "#/admin/trading")}
    ${kpi("Racer bets", n0(r.bets), "game", "", "#/admin/games")}${kpi("House PnL (USDT)", n2(r.house), "bolt", r.house >= 0 ? "up" : "down", "#/admin/games")}
    ${kpi("Prediction volume", n2(p.volume), "flag", "wide", "#/admin/predict")}</div>
    ${card("Trades, last 7 days", bars(days7()))}
    ${card("Balance by wallet", hbars(Object.keys(w).map(x => [x, +w[x] || 0])) || empty("No wallets"))}
    ${card("Recent activity", actHtml(activity()))}`;
  return {title:"Dashboard", html};
};

function userRow(u){
  return `<a class="a2-u" href="#/admin/user/${esc(u.id)}"><span class="a2-av">${esc((u.name || "?")[0].toUpperCase())}</span><span class="a2-um"><b>${esc(u.name)}${u.blocked ? ' <em class="a2-bl">Blocked</em>' : ""}</b><small>${esc(u.email)}</small></span><span class="a2-role ${esc(u.role)}">${esc(u.role)}</span>${I("chev", 16)}</a>`;
}
V.users = () => {
  const html = `<label class="a2-search">${I("search", 18)}<input id="a2q" placeholder="Search name or email" aria-label="Search users" autocomplete="off"></label><div class="a2-card flush" id="a2ul"></div>`;
  return {title:"Users", html, mount(r){
    const list = r.querySelector("#a2ul"), q = r.querySelector("#a2q");
    const draw = () => { const t = q.value.trim().toLowerCase(), l = A.accounts().filter(u => !t || (u.name + " " + u.email).toLowerCase().includes(t)); list.innerHTML = l.length ? l.map(userRow).join("") : empty("No users found."); };
    q.oninput = draw; draw();
  }};
};
V.user = id => {
  const u = A.accounts().find(x => x.id === id);
  if (!u) return {title:"User", back:"#/admin/users", html:empty("User not found.")};
  const w = S().wallets || {}, lg = A.logins().filter(l => l.uid === u.id).slice(0, 8), kyc = u.kyc || "verified";
  const html = `<div class="a2-card a2-ud"><span class="a2-av big">${esc((u.name || "?")[0].toUpperCase())}</span><div><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div><span class="a2-role ${esc(u.role)}">${esc(u.role)}</span></div>
    ${card("Account", kv("Joined", dstr(u.createdAt)) + kv("Referral used", esc(u.ref || "None")) + kv("Status", `<span class="${u.blocked ? "down" : "up"}">${u.blocked ? "Blocked" : "Active"}</span>`) +
      `<label class="a2-f" style="margin-top:8px"><span>KYC status</span><select id="a2kyc"><option value="verified">Verified</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></label>`)}
    ${card(`Wallets (${VIEW === "real" ? "Real" : "Demo"} account, this device)`, Object.keys(w).map(k2 => kv(`<span>${esc(UI.walletName ? UI.walletName(k2) : k2)}</span>`, `<span class="num">${n2(w[k2])} USDT</span>`)).join("") +
      `<div class="a2-adj"><select id="a2w" aria-label="Wallet">${Object.keys(w).map(k2 => `<option value="${k2}">${k2}</option>`).join("")}</select><input id="a2am" type="number" min="0" step="any" inputmode="decimal" placeholder="Amount" aria-label="Amount"></div><div class="a2-btns"><button class="a2-b pri" data-cr>Credit</button><button class="a2-b" data-db>Debit</button></div>
       <p class="a2-hint">Balances are stored per device in this demo; adjustments apply to this device.</p>`)}
    ${card("Login history", lg.length ? lg.map(l => `<div class="a2-ac"><span class="a2-ai">${I("users", 16)}</span><div><b>${esc(l.dev || "Browser")}</b><small>${esc(l.how || "Password")}</small></div><em>${tstr(l.t)}</em></div>`).join("") : empty("No logins recorded."))}
    <div class="a2-btns col">${u.role === "admin" ? "" : `<button class="a2-b ${u.blocked ? "pri" : "dng"}" data-blk>${u.blocked ? "Unblock user" : "Block user"}</button>`}<button class="a2-b" data-pw>Reset password</button><button class="a2-b" data-rst>Reset demo balance</button></div>`;
  return {title:"User", back:"#/admin/users", html, mount(r){
    const q = x => r.querySelector(x), sv = fn => { const l = A.accounts(), x = l.find(z => z.id === id); fn(x); A.saveAccounts(l); };
    q("#a2kyc").value = kyc; q("#a2kyc").onchange = e => { sv(x => x.kyc = e.target.value); toast("KYC updated", "ok"); };
    const adj = sign => { if (!live()) return toast("Switch to the " + VIEW + " account to change its balances", "bad"); const v = parseFloat(q("#a2am").value); if (!(v > 0)) return toast("Enter an amount", "bad"); const k2 = q("#a2w").value; if (sign < 0 && v > store.wb(k2)) return toast("Amount exceeds wallet balance", "bad"); store.addWallet(k2, sign * v, "admin"); store.save(); toast(`${sign > 0 ? "Credited" : "Debited"} ${n2(v)} USDT`, "ok"); App.route(); };
    q("[data-cr]").onclick = () => adj(1); q("[data-db]").onclick = () => adj(-1);
    const b = q("[data-blk]"); if (b) b.onclick = () => { sv(x => x.blocked = !x.blocked); toast("Status updated", "ok"); App.route(); };
    q("[data-pw]").onclick = async () => { if (!await U.confirmBox("Reset password?", "The password becomes Temp1234 for this user.", "Reset", true)) return; const h = await A.hash(u.email, "Temp1234"); sv(x => x.passHash = h); toast("Password reset to Temp1234", "ok"); };
    q("[data-rst]").onclick = async () => { if (!live()) return toast("Switch to the " + VIEW + " account first", "bad"); if (await U.confirmBox("Reset demo balance?", "Wallets, positions and history on this device are reset.", "Reset", true)){ store.reset(); toast("Demo balance reset", "ok"); App.route(); } };
  }};
};

V.trading = () => {
  const s = S(), a = A.adminSettings(), fut = (s.fut && s.fut.positions) || [], pos = s.positions || [];
  const recent = [...(s.history || []).slice(0, 8).map(h => ({t:h.closed || h.open, a:`Binary ${esc(h.sym || "")} ${esc(h.dir || "")}`, b:`${n2(h.amount)} USDT`, r:h.result, p:h.profit})), ...((s.fut && s.fut.history) || []).slice(0, 8).map(h => ({t:h.closed, a:`Futures ${esc(h.sym || "")} ${esc(h.side || "")} ${h.lev || ""}x`, b:esc(h.reason || "closed"), r:h.profit >= 0 ? "win" : "loss", p:h.profit}))].sort((x, y) => (y.t || 0) - (x.t || 0)).slice(0, 10);
  const pin = (g, l) => field(l + " payout %", "a2p_" + g, a.payout[g] ?? "", {min:0, step:1, ph:"Auto"});
  const html = `<div class="a2-kpis">${kpi("Binary open", n0(pos.length), "chip")}${kpi("Futures open", n0(fut.length), "trade")}</div>
    ${card("Binary options", field("Max bet (USDT per trade)", "a2max", a.maxBet, {min:1, step:1}) + `<p class="a2-hint">Payout override per market type. Leave empty for automatic payout.</p><div class="a2-g3">${pin("crypto", "Crypto")}${pin("forex", "Forex")}${pin("stocks", "Stocks")}</div><button class="a2-b pri" id="a2sv">Save trading settings</button>`)}
    ${card("Open futures positions", fut.length ? fut.slice(0, 10).map(p => `<div class="a2-ac"><span class="a2-ai">${I("trade", 16)}</span><div><b>${esc(p.sym)} ${esc(p.side || "")} ${p.lev || ""}x</b><small>Entry ${n2(p.entry)}</small></div><em>${n2(p.margin)} USDT</em></div>`).join("") : empty("No open futures positions."))}
    ${card("Recent trades", recent.length ? recent.map(x => `<div class="a2-ac"><span class="a2-ai">${I("trade", 16)}</span><div><b>${x.a}</b><small>${x.b}</small></div><em class="${x.p >= 0 ? "up" : "down"}">${x.p == null ? "" : (x.p >= 0 ? "+" : "") + n2(x.p)}</em></div>`).join("") : empty("No trades yet."))}`;
  return {title:"Trading", html, mount(r){
    r.querySelector("#a2sv").onclick = () => {
      const mx = parseFloat(r.querySelector("#a2max").value); if (!(mx >= 1)) return toast("Max bet must be at least 1", "bad");
      const pay = {}; ["crypto", "forex", "stocks"].forEach(g => { const v = parseFloat(r.querySelector("#a2p_" + g).value); pay[g] = v > 0 ? Math.min(200, v) : null; });
      A.saveAdmin({...A.adminSettings(), maxBet:mx, payout:pay}); toast("Trading settings saved", "ok");
    };
  }};
};

const gtabs = on => `<div class="a2-seg"><a href="#/admin/games" class="${on === "r" ? "on" : ""}">Money Game</a><a href="#/admin/predict" class="${on === "p" ? "on" : ""}">Prediction</a></div>`;
V.games = () => {
  const a = A.adminSettings().racer, st = racerStats(), d = racerD();
  const html = gtabs("r") + `<div class="a2-kpis">${kpi("Bets", n0(st.bets), "game")}${kpi("Races", n0(st.races), "flag")}${kpi("Wagered (real)", n2(st.wagered), "fin")}${kpi("House PnL", n2(st.house), "bolt", st.house >= 0 ? "up" : "down")}</div>
    ${card("Money Game settings", tog("a2re", a.enabled, "Game enabled", "Players can open Money Game") + `<div class="a2-g2">${field("Min bet", "a2mn", a.minBet, {min:0, step:"any"})}${field("Max bet", "a2mx", a.maxBet, {min:1, step:"any"})}${field("Odds, 2 cars (x)", "a2o2", a.odds2, {min:1, step:"any"})}${field("Odds, 3 cars (x)", "a2o3", a.odds3, {min:1, step:"any"})}</div>
      <label class="a2-f"><span>Player win chance</span><select id="a2pw"><option value="">Fair random</option>${[10, 20, 30, 40, 50, 60, 70, 80].map(v => `<option value="${v}">${v}% player wins</option>`).join("")}<option value="custom">Custom %</option></select></label><div id="a2pcw" class="hide">${field("Custom win % (0-100)", "a2pc", a.playerWinPct ?? "", {min:0, step:1})}</div>
      <button class="a2-b pri" id="a2sv">Save Money Game settings</button>`)}
    ${card("Recent bets", d.bets.length ? d.bets.slice(-12).reverse().map(b => `<div class="a2-ac"><span class="a2-ai">${I("game", 16)}</span><div><b>${n2(b.amount)} USDT, car ${esc(b.car)}/${esc(b.cars)}</b><small>${esc(b.mode || "")} x${esc(b.mult ?? "")}</small></div><em class="${b.win ? "up" : "down"}">${b.win ? "+" + n2((+b.payout || 0) - (+b.amount || 0)) : "-" + n2(b.amount)}</em></div>`).join("") : empty("No bets yet. Data appears once players race."))}
    ${card("Recent races", d.races.length ? d.races.slice(-8).reverse().map(x => `<div class="a2-ac"><span class="a2-ai">${I("flag", 16)}</span><div><b>Race ${esc(String(x.id).slice(-5))}</b><small>${esc(x.cars)} cars, winner ${esc(x.winner)}</small></div><em>${tstr(x.t)}</em></div>`).join("") : empty("No races yet."))}`;
  return {title:"Money Game", html, mount(r){
    const q = x => r.querySelector(x), sel = q("#a2pw"), pcw = q("#a2pcw");
    const v = a.playerWinPct; if (v == null) sel.value = ""; else if ([10, 20, 30, 40, 50, 60, 70, 80].includes(+v)) sel.value = String(v); else { sel.value = "custom"; pcw.classList.remove("hide"); }
    sel.onchange = () => pcw.classList.toggle("hide", sel.value !== "custom");
    q("#a2sv").onclick = () => {
      const mn = parseFloat(q("#a2mn").value), mx = parseFloat(q("#a2mx").value), o2 = parseFloat(q("#a2o2").value), o3 = parseFloat(q("#a2o3").value);
      if (!(mn >= 0) || !(mx >= 1) || mn > mx) return toast("Check min and max bet", "bad");
      if (!(o2 >= 1) || !(o3 >= 1)) return toast("Odds must be at least 1", "bad");
      let pw = null; if (sel.value === "custom"){ pw = parseFloat(q("#a2pc").value); if (!(pw >= 0 && pw <= 100)) return toast("Win % must be 0-100", "bad"); } else if (sel.value !== "") pw = +sel.value;
      const cur = A.adminSettings(); A.saveAdmin({...cur, racer:{enabled:q("#a2re").checked, minBet:mn, maxBet:mx, odds2:o2, odds3:o3, playerWinPct:pw}}); toast("Money Game settings saved", "ok");
    };
  }};
};
V.predict = () => {
  const a = A.adminSettings().predict, st = predStats(), d = predD();
  const row = (o, ic, t) => `<div class="a2-ac"><span class="a2-ai">${I(ic, 16)}</span><div><b>${esc(o.title || o.market || o.q || o.sym || o.id || t)}</b><small>${esc(o.side || o.dir || o.type || o.status || "")}</small></div><em>${n2(amt(o))}</em></div>`;
  const html = gtabs("p") + `<div class="a2-kpis">${kpi("Orders", n0(st.orders), "chip")}${kpi("Open positions", n0(st.open), "trade")}${kpi("Volume (USDT)", n2(st.volume), "fin", "wide")}</div>
    ${card("Prediction settings", tog("a2pe", a.enabled, "Prediction enabled", "Players can open Prediction markets") + `<div class="a2-g2">${field("Max bet (USDT)", "a2pm", a.maxBet, {min:1, step:"any"})}${field("Fee %", "a2pf", a.feePct, {min:0, step:"any"})}${field("Perp max leverage (x)", "a2pl", a.perpMaxLev, {min:1, step:1})}</div><button class="a2-b pri" id="a2sv">Save Prediction settings</button>` + (window.PRED ? "" : `<p class="a2-hint">Prediction module not loaded on this build; data below comes from storage.</p>`))}
    ${card("Open orders", d.orders.length ? d.orders.slice(-10).reverse().map(o => row(o, "chip", "Order")).join("") : empty("No orders."))}
    ${card("Positions", [...d.positions, ...d.perps].length ? [...d.positions, ...d.perps].slice(-10).reverse().map(o => row(o, "trade", "Position")).join("") : empty("No open positions."))}
    ${card("History", d.history.length ? d.history.slice(-10).reverse().map(o => row(o, "flag", "Trade")).join("") : empty("No history yet."))}`;
  return {title:"Prediction", html, mount(r){
    const q = x => r.querySelector(x);
    q("#a2sv").onclick = () => {
      const mx = parseFloat(q("#a2pm").value), fee = parseFloat(q("#a2pf").value), lv = parseFloat(q("#a2pl").value);
      if (!(mx >= 1)) return toast("Max bet must be at least 1", "bad"); if (!(fee >= 0 && fee <= 50)) return toast("Fee must be 0-50%", "bad"); if (!(lv >= 1)) return toast("Leverage must be at least 1", "bad");
      A.saveAdmin({...A.adminSettings(), predict:{enabled:q("#a2pe").checked, maxBet:mx, feePct:fee, perpMaxLev:lv}}); toast("Prediction settings saved", "ok");
    };
  }};
};

V.finance = () => {
  const tx = (S().tx || []).filter(x => x.kind === "deposit" || /^withdraw/.test(x.kind || ""));
  const pend = tx.filter(x => x.status === "Processing"), k = stats();
  const item = x => { const w = /^withdraw/.test(x.kind); return `<div class="a2-ac"><span class="a2-ai ${w ? "dn" : "upc"}">${I(w ? "out" : "fin", 16)}</span><div><b>${w ? "Withdrawal" : "Deposit"} ${esc(x.coin || "USDT")}</b><small>${esc(x.method || "")}${x.status ? " · " + esc(x.status) : ""}</small></div><em class="${w ? "down" : "up"}">${w ? "-" : "+"}${n2(x.amount)}</em></div>`; };
  const html = `<div class="a2-kpis">${kpi("Deposits (USDT)", n2(k.dep), "fin", "up")}${kpi("Withdrawals (USDT)", n2(k.wd), "out", "down")}</div>
    ${card("Pending withdrawals", pend.length ? pend.map(x => `<div class="a2-pw"><div class="a2-ac"><span class="a2-ai dn">${I("out", 16)}</span><div><b>${n2(x.amount)} ${esc(x.coin || "USDT")}</b><small>${esc(x.method || "")} · ${tstr(x.t)}</small></div></div><div class="a2-btns"><button class="a2-b pri" data-ap="${esc(x.id)}">Approve</button><button class="a2-b dng" data-rj="${esc(x.id)}">Reject</button></div></div>`).join("") : empty("No pending withdrawals."))}
    ${card("Deposits and withdrawals", tx.length ? tx.slice(0, 30).map(item).join("") : empty("No deposits or withdrawals yet."))}`;
  return {title:"Finance", html, mount(r){
    const set = (id, st) => { if (!live()) return toast("Switch to the " + VIEW + " account to change it", "bad"); const x = (S().tx || []).find(z => z.id === id); if (!x) return; x.status = st; if (st === "Rejected") store.addWallet("funding", +x.amount || 0, "refund"); store.save(); toast(`Withdrawal ${st.toLowerCase()}`, "ok"); App.route(); };
    r.querySelectorAll("[data-ap]").forEach(b => b.onclick = () => set(b.dataset.ap, "Completed"));
    r.querySelectorAll("[data-rj]").forEach(b => b.onclick = () => set(b.dataset.rj, "Rejected"));
  }};
};

const API_ST = () => { const u = window.CONFIG && CONFIG.API_URL; return u ? esc(u) : "Local (device only)"; };
V.settings = () => {
  const a = A.adminSettings(), maint = !!(a.banner || "").trim();
  const html = `${card("Content", field("Banner text", "a2ban", a.banner, {type:"text", max:140, ph:"Shown at the top of the app"}) + tog("a2mt", maint, "Maintenance mode", "Shows a maintenance banner to all users") + `<button class="a2-b pri" id="a2sv">Save content</button>`)}
    ${card("Announcement", field("Message", "a2an", "", {type:"text", max:200, ph:"Sent to every user's notifications"}) + `<button class="a2-b" id="a2sd">Send announcement</button>${a.announce ? `<p class="a2-hint">Last: ${esc(a.announce)}</p>` : ""}`)}
    ${card("Backend", kv("API", API_ST()) + kv("Account mode", curMode() === "real" ? "Real" : "Demo") + kv("Mode of stored data", "Demo and Real stores both on this device") + `<p class="a2-hint">Set CONFIG.API_URL to route Real account actions to the server.</p>`)}
    ${card("App", kv("Version", esc((window.CONFIG && CONFIG.APP_VERSION) || "6.8")) + kv("Signed in as", esc(A.me()?.email || "admin")) + kv("Settings updated", a.updated ? tstr(a.updated) : "Never") + `<div class="a2-btns col"><button class="a2-b pri" data-toapp>${I("swap", 16)} Switch to app</button><button class="a2-b dng" data-nt-logout>${I("out", 16)} Log out</button></div>`)}`;
  return {title:"Settings", html, mount(r){
    const q = x => r.querySelector(x);
    q("#a2mt").onchange = e => { const b = q("#a2ban"); if (e.target.checked && !b.value.trim()) b.value = "Scheduled maintenance in progress. Some features may be unavailable."; if (!e.target.checked) b.value = ""; };
    q("#a2sv").onclick = () => { A.saveAdmin({...A.adminSettings(), banner:q("#a2ban").value.trim()}); toast("Content saved", "ok"); };
    q("#a2sd").onclick = () => { const t = q("#a2an").value.trim(); if (!t) return toast("Write an announcement first", "bad"); store.notify("Announcement", t, "info"); A.saveAdmin({...A.adminSettings(), announce:t}); q("#a2an").value = ""; toast("Announcement sent", "ok"); };
  }};
};

/* ---------- router for #/admin/* ---------- */
function setAdminBody(on){ document.body.classList.toggle("adm-mode", !!on); if (!on) document.getElementById("a2nav")?.remove(); }
Pages.admin = (p = []) => {
  if (!ok()){ setTimeout(() => { location.hash = "#/home"; }, 0); return {html:"", title:"Admin"}; }
  const [a, b] = p;
  const sc = a === "users" ? V.users() : a === "user" ? V.user(b) : a === "trading" ? V.trading() : a === "games" ? V.games() : a === "predict" ? V.predict() : a === "finance" ? V.finance() : a === "settings" ? V.settings() : V.dash();
  const html = `<div class="a2">${head(sc.title, sc.back)}${modeBar()}<div class="a2-body">${sc.html}</div></div>`;
  return {html, title:"Admin · " + sc.title, mount(r){
    setAdminBody(true); setMode("admin"); drawNav(secOf(p));
    document.getElementById("ntBanner")?.remove();
    r.querySelectorAll("[data-view]").forEach(x => x.onclick = () => { setView(x.dataset.view); _oc = null; App.route(); });
    r.querySelectorAll("[data-toapp]").forEach(x => x.onclick = toApp);
    sc.mount && sc.mount(r);
  }, unmount(){ setAdminBody(false); }};
};
/* keep the admin shell in sync when the router re-renders other routes */
addEventListener("hashchange", () => { const n = location.hash.replace(/^#\/?/, "").split("/")[0]; if (n !== "admin") setAdminBody(false); });

/* ---------- switch rows in the normal app (admin accounts only) ---------- */
const swRow = cls => cls === "pf"
  ? `<button class="pf-row a2-swrow" data-toadmin><span class="pf-ic">${I("shield", 20)}</span><span class="pf-n">Admin panel</span><span class="pf-r"></span></button>`
  : `<section class="pm-sec a2-swrow"><button class="pm-row tap" data-toadmin><span class="pm-main"><span class="pm-t">Admin panel</span><span class="pm-s" style="display:block">Switch to the NovaTrade Admin app</span></span><span class="chev">${I("chev", 16)}</span></button></section>`;
function wrap(name, inject){
  const f = Pages[name]; if (!f) return;
  Pages[name] = (...args) => {
    const p = f(...args);
    if (!A.isAdmin()) return p;
    const mt = p.mount;
    p.mount = function(r){ const out = mt && mt.apply(this, arguments); try { inject(r); r.querySelectorAll("[data-toadmin]").forEach(b => b.onclick = toAdmin); } catch(e){ console.error(e); } return out; };
    return p;
  };
}
wrap("profile", r => { const lists = r.querySelectorAll(".pf-list"); const acc = lists[0]; if (acc) acc.insertAdjacentHTML("afterbegin", swRow("pf")); });
wrap("settings", r => { const pg = r.querySelector(".pm-page") || r.firstElementChild; if (pg) pg.insertAdjacentHTML("afterbegin", swRow("pm")); });

/* ---------- start in the last used mode ---------- */
if (A.isAdmin()){
  const h = location.hash.replace(/^#\/?/, "");
  if ((!h || h === "home") && getMode() === "admin") history.replaceState(null, "", "#/admin");
}
window.Admin2 = {toApp, toAdmin, stats};
})();
