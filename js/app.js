/* ===== App shell: router, nav, theme, global events ===== */
(function(){
const C = window.CONFIG, {$, ic, t, store, bus, toast, money, signed} = U;
const S = store.s;
let current = null, curName = "";
const DESC = {home:"Live crypto, forex and gold prices with a 10,000 USDT demo balance.", trade:"Trade Up or Down on live charts with demo money.", bots:"Run simulated trading bots on live prices.", referral:"Invite friends and earn demo rewards.", profile:"Your demo trading stats and settings.", deposit:"Top up your demo balance.", withdraw:"Simulate a USDT withdrawal.", auto:"Activate automatic demo trading.", vip:"Momentum signals for every tradable pair.", community:"Chat with other demo traders.", about:"About the NovaTrade demo trading simulator.", support:"Contact NovaTrade support by phone, email or ticket.", settings:"Theme, language, sounds and defaults."};
const NAV = [["home","Home","home"],["bots","Bots","bot"],["trade","Trade","chart"],["referral","Referral","gift"],["profile","Profile","user"]];

function setTheme(th){ S.settings.theme = th; document.documentElement.dataset.theme = th; document.querySelector('meta[name="theme-color"]').content = th === "dark" ? "#0A0F1C" : "#F5F7FA"; store.save(); bus.emit("theme"); }

function renderNav(active){
  $("#bnav").innerHTML = `<div class="bnav-in">${NAV.map(([k,n,i]) => k === "trade"
    ? `<a href="#/trade" class="trade-fab ${active===k?"on":""}" aria-label="${t(n)}"><span class="fab">${ic(i,22)}</span>${t(n)}</a>`
    : `<a href="#/${k}" class="${active===k?"on":""}" ${active===k?'aria-current="page"':""}>${ic(i,22)}<span>${t(n)}</span></a>`).join("")}</div>`;
}

function route(){
  const raw = location.hash.replace(/^#\/?/, "") || "home";
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  let name = parts[0] || "home";
  if (query && /ref=/.test(query) && !sessionStorage.getItem("refShown")){ sessionStorage.setItem("refShown", 1); setTimeout(() => toast("Referral code applied — welcome bonus unlocked!", "ok"), 600); }
  const factory = Pages[name] || Pages.notfound;
  if (!Pages[name]) name = "notfound";
  try { current?.unmount?.(); } catch(e){ console.error(e); }
  U.closeLayer();
  const page = factory(parts.slice(1));
  const view = $("#view");
  view.innerHTML = `<div class="view">${page.html}</div>`;
  current = page; curName = name;
  document.title = (page.title || "Page") + " · " + C.APP_NAME + " Demo";
  document.querySelector('meta[name="description"]').content = DESC[name] || "Mobile binary trading demo app for learning — no real money.";
  renderNav(name);
  view.querySelectorAll("[data-back]").forEach(b => b.onclick = () => history.length > 1 ? history.back() : (location.hash = "#/home"));
  try { page.mount?.call(page, view); } catch(e){ console.error(e); toast("Something went wrong loading this page", "bad"); }
  window.scrollTo(0, 0);
}

// Results toast when user is not on the trade screen
bus.on("settled", rec => {
  if (curName === "trade") return;
  const w = rec.result === "win";
  toast(`${M.label(M.get(rec.sym))}: ${w ? "Won" : rec.result === "loss" ? "Lost" : "Refunded"} ${signed(rec.profit)} USDT`, w ? "ok" : rec.result === "loss" ? "bad" : "info", 3500);
  U.beep(w ? "win" : rec.result === "loss" ? "loss" : "tick");
});
bus.on("lang", () => route());

function offline(){ $("#offline").classList.toggle("hide", navigator.onLine); }
addEventListener("online", offline); addEventListener("offline", offline);
addEventListener("hashchange", route);

document.documentElement.dataset.theme = S.settings.theme;
setTheme(S.settings.theme);
offline();
M.start();
if (S.auto.on) E.runAuto();
route();
window.App = {route, setTheme};
})();
