/* v6.8 Money Game: the 3D race game (racer/index.html) inside NovaTrade at #/racer.
   - The game runs in a same-origin iframe, created on mount and removed on unmount (frees the GPU).
   - Its backend (bet, settle, history) is racer/local-server.js, loaded only when #/racer opens and registered
     on the app's API adapter (API.call("racer.bet", ...)); a real server can take over the same names later.
   - Money = the current account mode's `games` wallet (shown as "Money Game"), moved only via API wallet calls.
   - window.RACER = {data(), stats()} for Admin; data lives in localStorage ACCT.key("nt_racer"). */
(function(){
const {store, bus} = U;
const KEY = () => (window.ACCT ? ACCT.key("nt_racer") : "nt_racer");
const load = () => { try { return JSON.parse(localStorage.getItem(KEY()) || "{}") || {}; } catch { return {}; } };
const norm = o => ({bets: o.bets || [], races: o.races || [], tx: o.tx || [], seq: o.seq || 0, raceSeq: o.raceSeq || 0, pending: o.pending || null, seeded: !!o.seeded});

window.RACER = {
  data: () => norm(load()),
  stats(){ return window.MoneyRacerServer ? MoneyRacerServer.stats(this.data()) : fallbackStats(this.data()); }
};
function fallbackStats(d){
  const o = {bets: d.bets.length, wins: 0, losses: 0, wagered: 0, paid: 0, houseProfit: 0, winRate: 0, races: d.races.length, transferIn: 0, transferOut: 0};
  d.bets.forEach(b => { if (b.win) o.wins++; else if (!b.refunded) o.losses++; o.wagered += +b.amount || 0; o.paid += +b.payout || 0; });
  d.tx.forEach(x => { if (x.type === "in") o.transferIn += +x.amt || 0; else o.transferOut += +x.amt || 0; });
  const r2 = v => Math.round(v * 100) / 100;
  o.wagered = r2(o.wagered); o.paid = r2(o.paid); o.houseProfit = r2(o.wagered - o.paid); o.transferIn = r2(o.transferIn); o.transferOut = r2(o.transferOut);
  o.winRate = o.bets ? Math.round(o.wins / o.bets * 1000) / 10 : 0;
  return o;
}

/* ONE app-wide 10-digit user id (profile page, in-game labels ******1234, game settings). An older 8-digit uid is extended
   deterministically ("10" + old uid), so it never changes again; a missing one is created once. */
function ensureUid(){
  const p = store.s.profile; if (!p) return "";
  let u = String(p.uid || "").replace(/\D/g, "");
  if (u.length !== 10){
    u = u.length >= 10 ? u.slice(0, 10) : u.length ? ("10" + u).padEnd(10, "7").slice(0, 10) : String(1000000000 + Math.floor(Math.random() * 8999999999));
    p.uid = u; store.save();
  }
  return u;
}
try { ensureUid(); } catch {}

/* Every transfer into / out of the Money Game wallet (Transfer sheet, Assets page, first-open seed) goes to nt_racer.tx */
bus.on("balance", (bal, reason) => {
  if (reason !== "transfer") return;
  const x = (store.s.tx || [])[0];
  if (!x || x.type !== "transfer" || (x.from !== "games" && x.to !== "games")) return;
  const o = load(); o.tx = o.tx || [];
  if (o.tx.some(e => e.t === x.t && e.amt === x.amt)) return;
  o.tx.unshift({type: x.to === "games" ? "in" : "out", amt: x.amt, t: x.t, from: x.from, to: x.to});
  if (o.tx.length > 300) o.tx.length = 300;
  try { localStorage.setItem(KEY(), JSON.stringify(o)); } catch {}
});

/* ---- host bridge used by the game page (racer/index.html reads window.parent.MoneyRacerHost) ---- */
let subs = [], lockOn = false;
const HOST = {
  _relayout: null,
  name: "NovaTrade",
  mode: () => (window.ACCT ? ACCT.mode() : "demo"),
  key: KEY,
  admin: () => (store.s.admin && store.s.admin.racer) || {},
  call: (name, data) => API.call(name, data),
  async seed(){                       // demo only, once: a new user can play right away
    if (store.wb("games") > 0) return;
    const amt = Math.min(1000, Math.floor(store.wb("spot") * 100) / 100);
    if (amt > 0) store.transfer("spot", "games", amt);
  },
  uid: () => ensureUid(),
  avatar: size => { try { return window.UserAvatar ? window.UserAvatar(size || 30) : ""; } catch { return ""; } },
  notify(title, body, tone){ try { if (U.pushNotif) U.pushNotif("game", title, body, tone || "info"); } catch {} },
  buzz(p){ try { U.buzz(p); } catch {} },
  fx(k){ try { U.fx(k); } catch {} },
  sound: () => store.s.settings.sound !== false,
  haptic: () => store.s.settings.haptic !== false,
  transfer(done){ UI.transferSheet({to: "games", done: (v, from, to) => { done && done(v, from, to); }}); },
  switchMode(){ window.ACCT ? ACCT.sheet() : U.toast("Demo mode", "info"); },
  onBalance(fn){ const off = bus.on("balance", () => { try { fn(); } catch {} }); subs.push(off); return off; },
  lock(on){                           // freeze the app page while a race runs
    lockOn = !!on;
    document.documentElement.classList.toggle("rc-lock", lockOn);
    if (lockOn) window.scrollTo(0, 0);
    if (HOST._relayout) HOST._relayout();   // header + bottom nav hide while a race runs and the game fills the screen; back to normal after
  }
};
window.MoneyRacerHost = HOST;

let srvP = null;
function ensureServer(){
  if (window.MoneyRacerServer && API.has("racer.bet")) return Promise.resolve();
  return srvP ||= new Promise((res, rej) => {
    const done = () => { try { MoneyRacerServer.create(HOST).install(API); res(); } catch (e) { rej(e); } };
    if (window.MoneyRacerServer) return done();
    const s = document.createElement("script");
    s.src = "racer/local-server.js?v=6.9"; s.async = true;
    s.onload = done; s.onerror = () => { srvP = null; rej(new Error("Money Game failed to load")); };
    document.head.appendChild(s);
  });
}

/* ---------- page ---------- */
Pages.racer = () => {
  let root, frame = null, onRz = null, raf = 0, offGuard = null, offBg = [];
  // v6.9: the splash is shown on the very first load only; the game stores nt_racer_ready once its assets are cached
  let ready = false; try { ready = !!localStorage.getItem("nt_racer_ready"); } catch {}
  const html = `
  <div class="tabs rc-tabs" style="gap:20px;margin:0 -16px;padding:4px 16px 0;border:0"><a class="tab" href="#/futures/BTCUSDT" style="font-size:17px">USDⓈ-M</a><a class="tab" href="#/spot/BTCUSDT" style="font-size:17px">Spot</a><a class="tab" href="#/trade/BTCUSDT" style="font-size:17px">Binary</a><a class="tab tab-hot" href="#/predict" style="font-size:17px">Prediction</a><button class="tab tab-hot on" style="font-size:17px">Money Game</button><a class="tab" href="#/options" style="font-size:17px">Options</a><a class="tab" href="#/copy" style="font-size:17px">Copy</a><a class="tab" href="#/bots" style="font-size:17px">Bots</a></div>
  <div class="rc-stage" id="rcStage">
    <div class="rc-load${ready ? " hide" : ""}" id="rcLoad" role="status" aria-live="polite">
      <div class="rc-logo"><span class="rc-flag"></span>Money Game</div>
      <div class="rc-bar"><i id="rcBar"></i></div>
      <small id="rcLoadTx">Loading game…</small>
    </div>
  </div>`;
  function size(){
    const st = root && root.querySelector("#rcStage"); if (!st) return;
    if (lockOn) { st.style.height = ""; return; }   // running race: CSS makes the stage fill the screen
    const nav = document.getElementById("bnav");
    const top = st.getBoundingClientRect().top + window.scrollY;
    const bottom = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().top : window.innerHeight;
    st.style.height = Math.max(320, Math.round(bottom - top)) + "px";
  }
  function setProg(p, tx){
    const b = root && root.querySelector("#rcBar"); if (b) b.style.width = Math.round(p) + "%";
    if (tx) { const t = root.querySelector("#rcLoadTx"); if (t) t.textContent = tx; }
  }
  return {
    title: "Money Game",
    html,
    mount(r){
      root = r;
      document.body.classList.add("rc-on");
      const tabs = r.querySelector(".tabs"), on = tabs && tabs.querySelector(".tab.on");
      if (tabs && on && tabs.scrollWidth > tabs.clientWidth) tabs.scrollLeft = Math.max(0, on.offsetLeft - (tabs.clientWidth - on.offsetWidth) / 2);
      size(); requestAnimationFrame(size);
      HOST._relayout = () => { size(); requestAnimationFrame(size); };
      offGuard = window.App && App.guardNav ? App.guardNav("Money Game") : null;   // top tabs / bottom nav / back: "Do you want to close this?"
      // app in the background (visibility or the APK's native-pause / native-resume): the game keeps running, its audio + haptics stop
      const pushBg = v => { try { const w = frame && frame.contentWindow; if (w && w.MR_BG) w.MR_BG(typeof v === "boolean" ? v : !!(document.hidden || window.__appBg)); } catch {} };
      const onVis = () => pushBg(), onP = () => pushBg(true), onR = () => pushBg(false);
      document.addEventListener("visibilitychange", onVis); addEventListener("native-pause", onP); addEventListener("native-resume", onR);
      offBg = [() => document.removeEventListener("visibilitychange", onVis), () => removeEventListener("native-pause", onP), () => removeEventListener("native-resume", onR)];
      root._pushBg = pushBg;
      onRz = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(size); };
      addEventListener("resize", onRz);
      // light progress while the game page itself loads (the game shows its own asset progress after that)
      let p = 6; setProg(p);
      const tick = setInterval(() => { p = Math.min(88, p + (88 - p) * 0.12); setProg(p); }, 120);
      ensureServer().then(() => {
        if (!root || !root.isConnected) return;
        frame = document.createElement("iframe");
        frame.className = "rc-frame";
        frame.title = "Money Game";
        frame.setAttribute("allow", "autoplay; fullscreen");
        frame.src = "racer/index.html?v=6.9";
        frame.addEventListener("load", () => {
          clearInterval(tick); setProg(100); try { root._pushBg && root._pushBg(); } catch {}
          setTimeout(() => { const l = root && root.querySelector("#rcLoad"); if (l) l.classList.add("hide"); }, 180);
        }, {once: true});
        root.querySelector("#rcStage").appendChild(frame);
      }).catch(e => { clearInterval(tick); setProg(100, e.message || "Money Game failed to load"); });
      root._rcTick = tick;
    },
    unmount(){
      clearInterval(root && root._rcTick);
      removeEventListener("resize", onRz); cancelAnimationFrame(raf);
      subs.forEach(off => { try { off(); } catch {} }); subs = [];
      if (frame){ try { frame.contentWindow && frame.contentWindow.MR_STOP && frame.contentWindow.MR_STOP(); } catch {} try { frame.src = "about:blank"; } catch {} frame.remove(); frame = null; }
      HOST._relayout = null; if (offGuard) { offGuard(); offGuard = null; }
      offBg.forEach(f => { try { f(); } catch {} }); offBg = [];
      HOST.lock(false);
      document.body.classList.remove("rc-on");
      root = null;
    }
  };
};
})();
