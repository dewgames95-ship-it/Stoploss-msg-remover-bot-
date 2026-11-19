/* ===== App shell: router, nav, theme, global events ===== */
(function(){
const C = window.CONFIG, {$, ic, t, store, bus, toast, signed} = U;
const S = store.s;
let current = null, curName = "";
const DESC = {home:"Live crypto, forex and gold prices, binary options and futures.", markets:"Live prices for 100+ crypto pairs, forex and metals.", trade:"Trade Up or Down on live charts with 30s–5m expiries.", futures:"USDT-margined futures up to 125x with TP/SL.", assets:"Your balances, PnL and transactions.", bots:"Automated trading bots on live prices.", referral:"Invite friends and earn commission.", profile:"Your trading stats and account.", deposit:"Add USDT to your trading account instantly.", withdraw:"Move funds to your Vault and earn interest.", auto:"Activate automatic trading.", vip:"Momentum signals for every tradable pair.", community:"Chat with other traders.", about:"About NovaTrade.", support:"Contact NovaTrade support by phone, email or ticket.", settings:"Theme, language, sounds and defaults.", rewards:"Daily check-in, tasks and badges.", academy:"Learn trading, indicators and risk management.", alerts:"Price alerts for any market."};
const NAV = [["home","Home","nhome"],["markets","Markets","nmkt"],["trade","Trade","ntrade"],["futures","Futures","nfut"],["assets","Assets","nasset"]];

function setTheme(th){ S.settings.theme = th; document.documentElement.dataset.theme = th; document.querySelector('meta[name="theme-color"]').content = th === "dark" ? "#0B0E11" : "#FFFFFF"; store.save(); bus.emit("theme"); }
function renderNav(active){
  $("#bnav").innerHTML = `<div class="bnav-in">${NAV.map(([k,n,i]) => `<a href="#/${k}" class="${active===k?"on":""}" ${active===k?'aria-current="page"':""}><span class="ni">${ic(i,24,1.6)}</span><span>${t(n)}</span></a>`).join("")}</div>`;
}
function route(){
  const raw = location.hash.replace(/^#\/?/, "") || "home";
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  let name = parts[0] || "home";
  if (query && /ref=/.test(query) && !sessionStorage.getItem("refShown")){ sessionStorage.setItem("refShown", 1); setTimeout(() => toast("Invite code applied — welcome bonus unlocked!", "ok"), 600); }
  const factory = Pages[name] || Pages.notfound;
  if (!Pages[name]) name = "notfound";
  try { current?.unmount?.(); } catch(e){ console.error(e); }
  U.closeLayer();
  const page = factory(parts.slice(1));
  const view = $("#view");
  view.innerHTML = `<div class="view">${page.html}</div>`;
  current = page; curName = name;
  document.title = (page.title || "Page") + " · " + C.APP_NAME;
  document.querySelector('meta[name="description"]').content = DESC[name] || "Binary options and futures trading on live markets.";
  document.body.classList.remove("no-nav");
  renderNav(name === "chart" ? "futures" : name);
  view.querySelectorAll("[data-back]").forEach(b => b.onclick = () => history.length > 1 ? history.back() : (location.hash = "#/home"));
  try { page.mount?.call(page, view); } catch(e){ console.error(e); toast("Something went wrong loading this page", "bad"); }
  window.scrollTo(0, 0);
}
bus.on("settled", rec => {
  if (curName === "trade") return;
  const w = rec.result === "win";
  toast(`${M.label(M.get(rec.sym))}: ${w ? "Won" : rec.result === "loss" ? "Lost" : "Refunded"} ${signed(rec.profit)} USDT`, w ? "ok" : rec.result === "loss" ? "bad" : "info", 3500);
  U.beep(w ? "win" : rec.result === "loss" ? "loss" : "tick");
});
bus.on("futClosed", ({pos, profit, reason}) => { if (curName === "futures") return; toast(`${M.label(M.get(pos.sym))} ${reason === "liquidated" ? "liquidated" : "closed"}: ${signed(profit)} USDT`, profit >= 0 ? "ok" : "bad", 3500); });
bus.on("lang", () => route());
function offline(){ $("#offline").classList.toggle("hide", navigator.onLine); }
addEventListener("online", offline); addEventListener("offline", offline);
addEventListener("hashchange", route);
setTheme(S.settings.theme);
offline();
M.start();
if (S.auto.on) E.runAuto();
route();
window.App = {route, setTheme};
})();
