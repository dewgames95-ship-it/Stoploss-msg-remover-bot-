/* v6.8 Account mode (Demo / Real) + backend adapter.
   ── Demo: virtual balance (10,000 USDT), store key novatrade_v1.
   ── Real: separate store (novatrade_real_v1, starts at 0). Today it is still kept on this device;
      when the server is ready set CONFIG.API_URL and every API.call() in real mode goes to the backend.
   Feature modules (Money Racer, Prediction, ...) must:
      ‑ keep their own data under ACCT.key("nt_xxx")  (demo and real never mix)
      ‑ move money only through API.call(...) handlers they register with API.register(name, fn)
        (local implementation now; the same names become POST /api/<name> on the server later). */
(function(){
const {store, esc, ic, toast} = U;
const MODE = store.mode || "demo";

const ACCT = {
  mode: () => MODE,
  isReal: () => MODE === "real",
  isDemo: () => MODE !== "real",
  label: m => (m || MODE) === "real" ? "Real" : "Demo",
  /* per-mode localStorage key for feature data */
  key: name => MODE === "real" ? name + "_real" : name,
  async setMode(m, ask = true){
    m = m === "real" ? "real" : "demo";
    if (m === MODE) return;
    if (ask && !(await U.confirmBox(m === "real" ? "Switch to Real account?" : "Switch to Demo account?",
      m === "real" ? "Real account has its own balance, positions and history (starts at 0 USDT, fund it with Deposit). Your demo account stays as it is."
                   : "Demo account uses virtual funds (10,000 USDT) to practice. Your real account stays as it is.", "Switch"))) return;
    try {
      store.saveNow();
      const target = m === "real" ? "novatrade_real_v1" : "novatrade_v1";
      if (!localStorage.getItem(target)){            // first switch: carry settings, profile and favourites over
        const s = store.s;
        localStorage.setItem(target, JSON.stringify({settings: s.settings, profile: s.profile, favs: s.favs, tours: s.tours, created: s.created}));
      }
      localStorage.setItem("nt_mode", m);
    } catch {}
    U.buzz && U.buzz(20);
    location.reload();
  },
  sheet(){
    const row = (m, t, d) => `<button class="ac-opt ${m === MODE ? "on" : ""}" data-m="${m}"><span class="ac-ico ${m}">${ic(m === "real" ? "wallet" : "target", 20)}</span><span class="ac-tx"><b>${t}</b><small>${d}</small></span><span class="ac-rd"></span></button>`;
    U.sheet("Account", `<div class="ac-list">${row("demo", "Demo account", "Virtual 10,000 USDT. Practice with live prices, no risk.")}${row("real", "Real account", "Your own balance. Deposits and withdrawals, synced with the server when it is connected.")}</div>`, el => {
      el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { U.closeLayer(); ACCT.setMode(b.dataset.m); });
    });
  }
};

/* ---- Backend adapter ----
   API.call("racer.bet", {...})  → local handler now; POST {API_URL}/api/racer.bet with the session token later. */
const LOCAL = {};
const API = {
  get base(){ return (window.CONFIG && CONFIG.API_URL) || ""; },
  remote(){ return ACCT.isReal() && !!this.base; },
  register(name, fn){ LOCAL[name] = fn; },
  has: name => !!LOCAL[name],
  async call(name, data = {}){
    if (this.remote()){
      let tok = ""; try { tok = (JSON.parse(localStorage.getItem("nt_session") || "{}").token) || ""; } catch {}
      const r = await fetch(this.base.replace(/\/$/, "") + "/api/" + name, {method: "POST", headers: {"Content-Type": "application/json", ...(tok ? {Authorization: "Bearer " + tok} : {})}, body: JSON.stringify(data)});
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || "Server error " + r.status);
      return j;
    }
    if (!LOCAL[name]) throw new Error("No handler for " + name);
    return LOCAL[name](data);
  }
};
/* wallet primitives every feature uses (same names on the server later) */
API.register("wallet.balance", ({wallet}) => ({balance: store.wb(wallet)}));
API.register("wallet.debit", ({wallet, amount, reason}) => {
  amount = +amount; if (!(amount > 0)) throw new Error("Enter a valid amount.");
  if (store.wb(wallet) + 1e-9 < amount) throw new Error("Insufficient balance");
  store.addWallet(wallet, -amount, reason || "debit"); return {balance: store.wb(wallet)};
});
API.register("wallet.credit", ({wallet, amount, reason}) => {
  amount = +amount; if (!(amount >= 0)) throw new Error("Invalid amount");
  if (amount) store.addWallet(wallet, amount, reason || "credit"); return {balance: store.wb(wallet)};
});
API.register("wallet.transfer", ({from, to, amount}) => { const e = store.transfer(from, to, amount); if (e) throw new Error(e); return {ok: true}; });

window.ACCT = ACCT; window.API = API;

/* ---- UI: mode pill on Home + Assets, body class, real-mode cleanup ---- */
document.body.classList.toggle("mode-real", MODE === "real");
document.body.classList.toggle("mode-demo", MODE !== "real");
const pill = () => `<button type="button" class="ac-pill ${MODE}" data-acct aria-label="Account: ${ACCT.label()}. Tap to switch">${ACCT.label()}${ic("chevd", 12, 2.4)}</button>`;
function inject(){
  const v = document.getElementById("view"); if (!v || v.querySelector("[data-acct]")) return;
  const at = v.querySelector(".hm-al, [data-acct-slot]");
  if (!at) return;
  at.insertAdjacentHTML("afterend", pill());
  v.querySelector("[data-acct]").onclick = e => { e.stopPropagation(); ACCT.sheet(); };
}
const run = () => setTimeout(inject, 0);
addEventListener("hashchange", run);
if (document.readyState === "loading") addEventListener("DOMContentLoaded", run); else run();
const view = document.getElementById("view"); if (view) new MutationObserver(inject).observe(view, {childList: true});   // pages render by replacing #view children
})();
