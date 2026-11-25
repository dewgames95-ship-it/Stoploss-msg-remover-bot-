/* v6.6 auth: local accounts, login/sign-up, admin panel (demo, localStorage only, no backend yet) */
(function(){
const {$, esc, ic, store, toast, bus} = U;
const S = () => store.s;
const KA = "nt_accounts", KS = "nt_session", KM = "nt_admin";
const ADMIN = {email:"admin@gmail.com", pass:"admin123"};
const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const accounts = () => rd(KA, []);
const saveAcc = a => wr(KA, a);
const norm = e => String(e || "").trim().toLowerCase();

async function hash(email, pass){
  const s = "nt1:" + norm(email) + ":" + pass;
  try {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  } catch { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return "f" + h.toString(16); }
}
/* seed admin */
const ready = (async () => {
  const a = accounts();
  if (!a.some(x => norm(x.email) === ADMIN.email)){
    a.unshift({id:"adm_0001", name:"Admin", email:ADMIN.email, passHash: await hash(ADMIN.email, ADMIN.pass), ref:"", createdAt:Date.now(), role:"admin"});
    saveAcc(a);
  }
})();

/* ---------- session ---------- */
const sess = () => rd(KS, null);
function me(){ const s = sess(); if (!s) return null; const a = accounts().find(x => x.id === s.id); return a && !a.blocked ? a : null; }
const isAdmin = () => me()?.role === "admin";
/* automation (webdriver) bypasses the gate so other test scripts keep working, unless nt_authtest is set */
const bypass = () => navigator.webdriver && !localStorage.getItem("nt_authtest");

/* ---------- admin settings (canonical in localStorage, mirrored to U.store.s.admin) ---------- */
const defAdmin = () => ({maxBet:5000, payout:{crypto:null, forex:null, stocks:null}, banner:"", announce:"", updated:0});
function adm(){ return Object.assign(defAdmin(), rd(KM, {}), {}); }
function saveAdm(a){ a.updated = Date.now(); wr(KM, a); S().admin = a; store.save(); bus.emit("admin"); banner(); }
function mirror(){ S().admin = adm(); }

/* ---------- login history (v6.7): time + short device name, kept on this device ---------- */
const KL = "nt_logins";
function devName(){
  const u = navigator.userAgent || "", b = /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "Browser";
  const o = /Android/.test(u) ? "Android" : /iPhone|iPad|iPod/.test(u) ? "iOS" : /Windows/.test(u) ? "Windows" : /Mac OS/.test(u) ? "macOS" : /Linux/.test(u) ? "Linux" : "";
  return b + (o ? " on " + o : "");
}
function recLogin(acc, how){
  const l = rd(KL, []); l.unshift({t:Date.now(), dev:devName(), uid:acc && acc.id, how:how || "Password", cur:true});
  l.slice(1).forEach(x => x.cur = false); wr(KL, l.slice(0, 50));
}
const logins = () => rd(KL, []);

/* ---------- routing gate ---------- */
const pub = n => n === "login" || n === "register";
function gate(){
  if (bypass()) return;
  const name = (location.hash.replace(/^#\/?/, "") || "home").split("?")[0].split("/")[0];
  const u = me();
  let to = null;
  if (!u && !pub(name)) to = "#/login";
  else if (u && pub(name)) to = u.role === "admin" ? "#/admin" : "#/home";
  else if (name === "admin" && u?.role !== "admin") to = "#/home";
  if (to) history.replaceState(null, "", to);
}
gate();
addEventListener("hashchange", () => { gate(); banner(); }, true);

/* ---------- icons ---------- */
const SV = {
  eye: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeoff: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5.6 19 2 12 2 12a18 18 0 0 1 5.1-5.9M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22M14.1 14.1a3 3 0 1 1-4.2-4.2"/></svg>',
  google: '<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.4-4.7 3.4-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.3 1.7l3.1-3.1A11 11 0 0 0 2 7.1l3.7 2.8C6.6 7.400 9.100 5.400 12 5.400z"/></svg>',
  wallet: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H5a2 2 0 0 1 0-4h13v4z"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><circle cx="16.500" cy="14" r="1.200" fill="currentColor"/></svg>',
  chev: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  out: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>'
};
const logo = (n=44) => `<img src="favicon.svg" alt="" width="${n}" height="${n}" class="au-logo">`;

/* ---------- helpers ---------- */
function setBody(on){ document.body.classList.toggle("auth-mode", !!on); }
function strength(p){
  let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, Math.max(p ? 1 : 0, s - (p.length < 8 ? 1 : 0)));
}
const SLAB = ["", "Weak", "Fair", "Good", "Strong"];
function setErr(f, msg){
  const w = f.closest(".au-field"); if (!w) return;
  w.classList.toggle("err", !!msg); const e = w.querySelector(".au-err"); if (e) e.textContent = msg || "";
}
function demoSheet(what){
  U.sheet(what, `<div class="au-demo"><div class="au-demo-i">${what === "Google login" ? SV.google : SV.wallet}</div><p>${esc(what)} will be enabled when the server is connected.</p><button class="btn btn-primary au-btn" data-close2>Got it</button></div>`, el => { el.querySelector("[data-close2]").onclick = U.closeLayer; });
}

/* ---------- login / register page ---------- */
function authPage(mode){
  const reg = mode === "register";
  const pw = (id, ph, ac) => `<div class="au-input"><input id="${id}" type="password" placeholder="${ph}" autocomplete="${ac}" aria-label="${ph}"><button type="button" class="au-eye" data-eye aria-label="Show password">${SV.eye}</button></div>`;
  const html = `<div class="au-wrap"><div class="au-card">
    <div class="au-brand">${logo()}<div><h1>Welcome to NovaTrade</h1><p>${reg ? "Create your account to start trading" : "Log in to continue trading"}</p></div></div>
    <div class="au-tabs" role="tablist"><a href="#/login" class="${reg ? "" : "on"}" role="tab">Log In</a><a href="#/register" class="${reg ? "on" : ""}" role="tab">Sign Up</a></div>
    <form id="auF" novalidate autocomplete="on">
      ${reg ? `<div class="au-field"><label for="auN">Nickname</label><div class="au-input"><input id="auN" maxlength="20" placeholder="Your name" autocomplete="nickname"></div><div class="au-err"></div></div>` : ""}
      <div class="au-field"><label for="auE">Email</label><div class="au-input"><input id="auE" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email" autocapitalize="off"></div><div class="au-err"></div></div>
      <div class="au-field"><label for="auP">Password</label>${pw("auP", reg ? "At least 8 characters" : "Password", reg ? "new-password" : "current-password")}${reg ? `<div class="au-str" id="auS"><i></i><i></i><i></i><i></i><span></span></div>` : ""}<div class="au-err"></div></div>
      ${reg ? `<div class="au-field"><label for="auC">Confirm password</label>${pw("auC", "Re-enter password", "new-password")}<div class="au-err"></div></div>
      <div class="au-ref" id="auRef"><button type="button" class="au-reft" data-ref>Referral ID (Optional) <span>${SV.chev}</span></button><div class="au-refb"><div class="au-input"><input id="auR" maxlength="16" placeholder="Enter referral code" autocapitalize="characters"></div></div></div>
      <div class="au-field au-agree"><label class="au-chk"><input type="checkbox" id="auA"><i></i><span>I agree to the <a href="#/about" data-terms>Terms of Use</a> &amp; <a href="#/about" data-terms>Privacy Notice</a></span></label><div class="au-err"></div></div>` : `<div class="au-forgot"><button type="button" data-forgot>Forgot password?</button></div>`}
      <div class="au-err au-form-err" id="auFE" role="alert"></div>
      <button class="btn btn-primary au-btn au-main" type="submit"><span>${reg ? "Create Account" : "Log In"}</span></button>
    </form>
    <div class="au-or"><span>or</span></div>
    <button class="au-alt" data-g>${SV.google}<span>Continue with Google</span></button>
    <button class="au-alt" data-w>${SV.wallet}<span>Connect Wallet</span></button>
    <p class="au-sw">${reg ? 'Already have an account? <a href="#/login">Log In</a>' : 'New to NovaTrade? <a href="#/register">Create an account</a>'}</p>
  </div><p class="au-foot">Demo account stored on this device only. Trading involves risk.</p></div>`;
  return {html, title: reg ? "Sign Up" : "Log In", mount(r){
    setBody(true);
    const f = r.querySelector("#auF"), q = s => r.querySelector(s);
    r.querySelectorAll("[data-eye]").forEach(b => b.onclick = () => { const i = b.parentNode.querySelector("input"), sh = i.type === "password"; i.type = sh ? "text" : "password"; b.innerHTML = sh ? SV.eyeoff : SV.eye; b.setAttribute("aria-label", sh ? "Hide password" : "Show password"); });
    r.querySelector("[data-g]").onclick = () => demoSheet("Google login");
    r.querySelector("[data-w]").onclick = () => demoSheet("Wallet connect");
    r.querySelectorAll("[data-terms]").forEach(a => a.onclick = e => { e.preventDefault(); U.sheet("Terms & Privacy", `<p class="au-p">NovaTrade is a demo trading platform. Balances are virtual and no real funds are involved. Your account details are stored on this device only until the server is connected. Trading involves risk.</p>`); });
    const fg = q("[data-forgot]"); if (fg) fg.onclick = () => U.sheet("Forgot password?", `<div class="au-demo"><div class="au-demo-i">${ic("lock", 22)}</div><p>Password reset will be available soon.</p><button class="btn btn-primary au-btn" data-c>OK</button></div>`, el => el.querySelector("[data-c]").onclick = U.closeLayer);
    const ids = {n:q("#auN"), e:q("#auE"), p:q("#auP"), c:q("#auC"), a:q("#auA"), r:q("#auR")};
    const V = {
      n: () => { const v = ids.n.value.trim(); return v.length < 2 ? "Enter a nickname (2-20 characters)" : ""; },
      e: () => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ids.e.value.trim()) ? "" : "Enter a valid email address",
      p: () => !ids.p.value ? "Enter your password" : reg && ids.p.value.length < 8 ? "Password must be at least 8 characters" : "",
      c: () => ids.c.value !== ids.p.value ? "Passwords do not match" : "",
      a: () => ids.a.checked ? "" : "Please accept the Terms of Use & Privacy Notice"
    };
    const keys = reg ? ["n", "e", "p", "c", "a"] : ["e", "p"];
    keys.forEach(k => { const el = ids[k]; const ev = k === "a" ? "change" : "blur"; el.addEventListener(ev, () => setErr(el, V[k]())); el.addEventListener("input", () => { if (el.closest(".au-field").classList.contains("err")) setErr(el, V[k]()); q("#auFE").textContent = ""; }); });
    if (reg){
      ids.p.addEventListener("input", () => { const s = strength(ids.p.value), b = q("#auS"); b.dataset.s = ids.p.value ? s : 0; b.querySelector("span").textContent = ids.p.value ? SLAB[s] : ""; if (ids.c.value) setErr(ids.c, V.c()); });
      q("[data-ref]").onclick = () => q("#auRef").classList.toggle("open");
      const m = (location.hash.match(/ref=([\w-]+)/) || [])[1] || sessionStorage.getItem("ntRef"); if (m){ ids.r.value = m.toUpperCase(); q("#auRef").classList.add("open"); }
    }
    f.onsubmit = async e => {
      e.preventDefault(); let bad = null;
      keys.forEach(k => { const m = V[k](); setErr(ids[k], m); if (m && !bad) bad = ids[k]; });
      if (bad){ bad.focus?.(); U.buzz?.("err"); return; }
      const btn = q(".au-main"); btn.disabled = true; btn.classList.add("busy");
      await ready; const email = norm(ids.e.value), list = accounts(), ph = await hash(email, ids.p.value), fe = q("#auFE");
      const fail = (m, el) => { btn.disabled = false; btn.classList.remove("busy"); if (el) setErr(el, m); else fe.textContent = m; U.buzz?.("err"); };
      if (reg){
        if (list.some(x => norm(x.email) === email)) return fail("An account with this email already exists. Log in instead.", ids.e);
        const acc = {id:"u_" + U.uid(), name:ids.n.value.trim(), email, passHash:ph, ref:(ids.r.value || "").trim().toUpperCase(), createdAt:Date.now(), role:"user"};
        list.push(acc); saveAcc(list); wr(KS, {id:acc.id, t:Date.now()}); recLogin(acc, "Sign up");
        const p = S().profile; p.name = acc.name; p.email = acc.email; p.joined = acc.createdAt; if (acc.ref) p.refBy = acc.ref; store.saveNow();
        toast("Welcome to NovaTrade, " + acc.name, "ok");
        location.hash = "#/home";
      } else {
        const acc = list.find(x => norm(x.email) === email);
        if (!acc || acc.passHash !== ph) return fail("Incorrect email or password.");
        if (acc.blocked) return fail("This account has been suspended. Please contact support.");
        wr(KS, {id:acc.id, t:Date.now()}); recLogin(acc);
        if (acc.role !== "admin"){ S().profile.name = acc.name; S().profile.email = acc.email; store.saveNow(); }
        location.hash = acc.role === "admin" ? "#/admin" : "#/home";
      }
    };
    setTimeout(() => (ids.n || ids.e).focus?.({preventScroll:true}), 250);
  }, unmount(){ setBody(false); }};
}
Pages.login = () => authPage("login");
Pages.register = () => authPage("register");

/* ---------- logout ---------- */
async function logout(){
  if (!await U.confirmBox("Log out?", "You will need to log in again. Your data stays on this device.", "Log out", true)) return;
  try { localStorage.removeItem(KS); } catch {}
  store.saveNow(); location.hash = "#/login"; banner();
}
document.addEventListener("click", e => { if (e.target.closest("[data-nt-logout]")){ e.preventDefault(); logout(); } });
const row = `<section class="pm-sec"><button class="pm-row tap" data-nt-logout><span class="pm-main"><span class="pm-t pm-danger">Log out</span><span class="pm-s" style="display:block">Signed in as <span class="au-who"></span></span></span><span class="chev">${ic("chev", 16)}</span></button></section>`;
const _set = Pages.settings;
if (_set) Pages.settings = (...a) => { const p = _set(...a); const u = me(); p.html = p.html.replace('<div class="pm-foot">', row.replace('<span class="au-who"></span>', esc(u ? u.email : "guest")) + '<div class="pm-foot">'); return p; };
const _prof = Pages.profile;
if (_prof) Pages.profile = (...a) => { const p = _prof(...a); p.html = p.html.replace('<button class="pf-sw" data-switch>Switch Account</button>', '<button class="pf-sw" data-switch>Switch Account</button><button class="pf-sw au-lo" data-nt-logout>Log out</button>'); return p; };

/* ---------- maintenance banner ---------- */
function banner(){
  let b = document.getElementById("ntBanner"); const t = (adm().banner || "").trim(), name = (location.hash.replace(/^#\/?/, "") || "").split("/")[0];
  if (!t || pub(name) || name === "admin"){ b?.remove(); return; }
  if (!b){ b = document.createElement("div"); b.id = "ntBanner"; b.className = "au-banner"; b.setAttribute("role", "status"); document.body.insertBefore(b, document.body.firstChild); }
  if (b.dataset.t !== t){ b.dataset.t = t; b.innerHTML = `${ic("info", 14)}<span>${esc(t)}</span>`; }
}

/* ---------- wire admin settings into the engine (wrap, no edits to engine.js) ---------- */
const GRP = {crypto:"crypto", forex:"forex", metal:"forex", stock:"stocks", index:"stocks", commodity:"forex"};
function ovr(sym){ const p = M.get(sym); const g = p && GRP[p.type]; const v = g && adm().payout[g]; return v > 0 ? v / 100 : null; }
if (window.E){
  const place0 = E.place, pay0 = E.payoutOf, val0 = E.validate;
  E.place = function(sym, dir, amount, ...r){
    const mx = +adm().maxBet || 5000;
    if (amount > mx) return {err:`Maximum trade amount is ${mx.toLocaleString("en-US")} USDT.`};
    const out = place0.call(this, sym, dir, amount, ...r);
    const o = out && out.pos && ovr(sym); if (o){ out.pos.payout = o; store.save(); }
    return out;
  };
  E.payoutOf = function(sym, ...r){ return ovr(sym) ?? pay0.call(this, sym, ...r); };
  E.validate = function(sym, amount, ...r){ const mx = +adm().maxBet || 5000; if (amount > mx) return `Maximum trade amount is ${mx.toLocaleString("en-US")} USDT.`; return val0.call(this, sym, amount, ...r); };
}
mirror(); banner();

/* ---------- admin panel ---------- */
const n2 = v => (+v || 0).toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2});
const dstr = t => new Date(t).toLocaleDateString("en-US", {year:"numeric", month:"short", day:"numeric"});
Pages.admin = () => {
  const s = S(), a = accounts(), A = adm();
  const today = new Date().setHours(0, 0, 0, 0);
  const bin = (s.history || []).filter(h => (h.closed || h.open || 0) >= today).length + (s.positions || []).filter(p => p.open >= today).length;
  const openPos = (s.positions || []).length + ((s.fut && s.fut.positions) || []).length;
  const total = Object.values(s.wallets || {}).reduce((x, y) => x + (+y || 0), 0);
  const kpi = (l, v, ic2) => `<div class="ad-k"><span class="ad-ki">${ic(ic2, 18, 1.7)}</span><div><b class="num">${v}</b><small>${l}</small></div></div>`;
  const users = a.map(u => `<button class="ad-u" data-u="${esc(u.id)}"><span class="ad-av">${esc((u.name || "?")[0].toUpperCase())}</span><span class="ad-um"><b>${esc(u.name)}${u.blocked ? ' <em class="blk">Blocked</em>' : ""}</b><small>${esc(u.email)}</small></span><span class="ad-ud">${dstr(u.createdAt)}</span><span class="ad-role ${u.role}">${u.role}</span></button>`).join("");
  const tk = s.tickets || [];
  const tickets = tk.length ? tk.map(x => `<div class="ad-t"><div><b>#${esc(String(x.id).slice(0, 6).toUpperCase())} · ${esc(x.topic || "Ticket")}</b><small>${esc(x.em || "")} · ${dstr(x.t)}</small></div><p>${esc(x.msg || "")}</p></div>`).join("") : `<div class="ad-empty">No support tickets yet.</div>`;
  const pin = (g, l) => `<label class="ad-f"><span>${l} payout %</span><input type="number" min="0" max="200" step="1" data-pay="${g}" placeholder="Auto" value="${A.payout[g] ?? ""}"></label>`;
  const html = `<div class="ad"><header class="ad-top"><div class="ad-h">${logo(30)}<div><h1>Admin Panel</h1><small>${esc(me()?.email || "")}</small></div></div><div class="ad-act"><a class="ad-btn ghost" href="#/home">Open app</a><button class="ad-btn" data-nt-logout>${SV.out}<span>Log out</span></button></div></header>
    <div class="ad-note">${ic("info", 16)}<span>Demo admin: data is local to this device until the backend is connected.</span></div>
    <section class="ad-kpis">${kpi("Total users", a.length, "users")}${kpi("Total balance (USDT)", n2(total), "wallet")}${kpi("Open positions", openPos, "layers")}${kpi("Binary trades today", bin, "clock")}${kpi("Tickets", tk.length, "headset")}</section>
    <div class="ad-cols"><section class="ad-card"><h2>Users <small>${a.length}</small></h2><div class="ad-ul">${users}</div></section>
    <section class="ad-card"><h2>Settings</h2>
      <div class="ad-sg"><h3>Binary payout override</h3><p>Leave empty to use the automatic payout.</p><div class="ad-grid">${pin("crypto", "Crypto")}${pin("forex", "Forex")}${pin("stocks", "Stocks")}</div></div>
      <div class="ad-sg"><h3>Binary max bet</h3><label class="ad-f"><span>USDT per trade</span><input type="number" min="1" step="1" id="adMax" value="${A.maxBet}"></label></div>
      <div class="ad-sg"><h3>Maintenance banner</h3><label class="ad-f"><span>Shown at the top of the app when set</span><input id="adBan" maxlength="140" placeholder="e.g. Scheduled maintenance tonight 02:00 UTC" value="${esc(A.banner)}"></label></div>
      <button class="btn btn-primary au-btn" id="adSave">Save settings</button>
      <div class="ad-sg" style="margin-top:18px"><h3>Announcement</h3><label class="ad-f"><span>Sent to the notifications list</span><input id="adAnn" maxlength="200" placeholder="Write an announcement"></label><button class="btn btn-ghost au-btn" id="adSend">Send announcement</button></div>
    </section></div>
    <section class="ad-card"><h2>Support tickets <small>${tk.length}</small></h2>${tickets}</section></div>`;
  return {html, title:"Admin Panel", mount(r){
    setBody(true); const q = x => r.querySelector(x);
    q("#adSave").onclick = () => {
      const mx = parseFloat(q("#adMax").value); if (!(mx >= 1)) return toast("Max bet must be at least 1", "bad");
      const pay = {}; r.querySelectorAll("[data-pay]").forEach(i => { const v = parseFloat(i.value); pay[i.dataset.pay] = v > 0 ? Math.min(200, v) : null; });
      saveAdm({...adm(), maxBet:mx, payout:pay, banner:q("#adBan").value.trim()}); toast("Settings saved", "ok");
    };
    q("#adSend").onclick = () => { const t = q("#adAnn").value.trim(); if (!t) return toast("Write an announcement first", "bad"); store.notify("Announcement", t, "info"); saveAdm({...adm(), announce:t}); q("#adAnn").value = ""; toast("Announcement sent", "ok"); };
    r.querySelectorAll("[data-u]").forEach(b => b.onclick = () => userSheet(b.dataset.u));
  }, unmount(){ setBody(false); }};
};
function userSheet(id){
  const u = accounts().find(x => x.id === id); if (!u) return;
  const w = S().wallets || {};
  const body = `<div class="ad-ud2"><span class="ad-av big">${esc((u.name || "?")[0].toUpperCase())}</span><div><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div><span class="ad-role ${u.role}">${u.role}</span></div>
    <div class="pm-kv"><span>Joined</span><b>${dstr(u.createdAt)}</b></div><div class="pm-kv"><span>Referral used</span><b>${esc(u.ref || "None")}</b></div><div class="pm-kv"><span>Status</span><b class="${u.blocked ? "down" : "up"}">${u.blocked ? "Blocked" : "Active"}</b></div>
    <h3 class="ad-wh">Wallets (this device)</h3>${Object.keys(w).map(k => `<div class="pm-kv"><span style="text-transform:capitalize">${k}</span><b class="num">${n2(w[k])} USDT</b></div>`).join("")}
    <div class="ad-addrow"><input type="number" id="adAmt" min="1" placeholder="Amount" inputmode="decimal"><button class="btn btn-primary" data-add>Add balance</button></div>
    <div class="ad-btns"><button class="btn btn-ghost" data-rst>Reset demo balance</button>${u.role === "admin" ? "" : `<button class="btn ${u.blocked ? "btn-primary" : "btn-down"}" data-blk>${u.blocked ? "Unblock user" : "Block user"}</button>`}</div>
    <p class="pm-s" style="margin-top:10px">Balances come from this device's data. Per-user wallets arrive with the backend.</p>`;
  U.sheet("User details", body, el => {
    el.querySelector("[data-add]").onclick = () => { const v = parseFloat(el.querySelector("#adAmt").value); if (!(v > 0)) return toast("Enter an amount", "bad"); store.addWallet("spot", v, "admin"); toast(`Added ${n2(v)} USDT`, "ok"); U.closeLayer(); setTimeout(() => App.route(), 320); };
    el.querySelector("[data-rst]").onclick = async () => { if (await U.confirmBox("Reset demo balance?", `Balance returns to ${n2(CONFIG.START_BALANCE)} USDT. Positions and history are cleared.`, "Reset", true)){ store.reset(); toast("Demo balance reset", "ok"); App.route(); } };
    const b = el.querySelector("[data-blk]"); if (b) b.onclick = () => { const l = accounts(), x = l.find(z => z.id === id); x.blocked = !x.blocked; saveAcc(l); toast(x.blocked ? "User blocked" : "User unblocked", "ok"); U.closeLayer(); setTimeout(() => App.route(), 320); };
  });
}
window.Auth = {logins, devName, me, isAdmin, logout, accounts, adminSettings: adm};
})();
