/* ===== App shell: router, nav, theme, global events ===== */
(function(){
const C = window.CONFIG, {$, ic, t, store, bus, toast, signed} = U;
const S = store.s;
let current = null, curName = "", lastHash = location.hash, guardBusy = false;
const DESC = {home:"Live crypto, forex and gold prices, binary options and futures.", markets:"Live prices for 100+ crypto pairs, forex and metals.", trade:"Trade Up or Down on live charts with 30s–5m expiries.", futures:"USDT-margined futures up to 125x with TP/SL.", assets:"Your balances, PnL and transactions.", bots:"Automated trading bots on live prices.", referral:"Invite friends and earn commission.", profile:"Your trading stats and account.", deposit:"Add USDT to your trading account instantly.", withdraw:"Move funds to your Vault and earn interest.", auto:"Activate automatic trading.", vip:"Momentum signals for every tradable pair.", community:"Chat with other traders.", about:"About NovaTrade.", support:"Contact NovaTrade support by phone, email or ticket.", settings:"Theme, language, sounds and defaults.", rewards:"Daily check-in, tasks and badges.", academy:"Learn trading, indicators and risk management.", alerts:"Price alerts for any market.", options:"Buy BTC, ETH and altcoin call & put options, cash-settled in USDT."};
const NAV = [["home","Home","nhome"],["markets","Markets","nmkt"],["trade","Binary","ntrade"],["futures","Futures","nfut"],["assets","Assets","nasset"]];

const mq = matchMedia("(prefers-color-scheme: dark)");
function setTheme(th){
  S.settings.theme = th; const r = th === "system" ? (mq.matches ? "dark" : "light") : th;
  document.documentElement.dataset.theme = r; document.documentElement.dataset.cm = S.settings.colorMode === "ru" ? "ru" : "gu";
  document.querySelector('meta[name="theme-color"]').content = r === "dark" ? "#1F2630" : "#F5F7FB"; store.save(); bus.emit("theme");
}
mq.addEventListener?.("change", () => { if (S.settings.theme === "system") setTheme("system"); });
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
  renderNav(["chart","options","spot","predict","racer","apitrade","cfd"].includes(name) ? "futures" : name);
  view.querySelectorAll("[data-back]").forEach(b => b.onclick = () => history.length > 1 ? history.back() : (location.hash = "#/home"));
  try { page.mount?.call(page, view); } catch(e){ console.error(e); toast("Something went wrong loading this page", "bad"); }
  window.scrollTo(0, 0);
  lastHash = location.hash;
}
bus.on("settled", rec => {
  if (curName === "trade") return;
  const w = rec.result === "win";
  toast(`${M.label(M.get(rec.sym))}: ${w ? "Won" : rec.result === "loss" ? "Lost" : "Refunded"} ${signed(rec.profit)} USDT`, w ? "ok" : rec.result === "loss" ? "bad" : "info", 3500);
  U.fx(w ? "win" : rec.result === "loss" ? "loss" : "notify");
});
bus.on("futClosed", ({pos, profit, reason}) => { if (curName === "futures") return; toast(`${M.label(M.get(pos.sym))} ${reason === "liquidated" ? "liquidated" : "closed"}: ${signed(profit)} USDT`, profit >= 0 ? "ok" : "bad", 3500); });
bus.on("lang", () => route());
function offline(){ $("#offline").classList.toggle("hide", navigator.onLine); }
addEventListener("online", offline); addEventListener("offline", offline);
/* v6.9 navigation guard: a page (Money Game, Prediction) may set window.NAV_GUARD = (toHash, fromHash) => bool | Promise<bool>.
   A hash change (top tab strip, bottom nav, back button) is then held: the address goes back to the current page at once,
   the guard asks ("Do you want to close this?"), and only a true answer completes the navigation. */
addEventListener("hashchange", () => {
  const g = window.NAV_GUARD, to = location.hash, from = lastHash;
  if (typeof g !== "function" || guardBusy || to === from) return route();
  guardBusy = true;
  try { history.replaceState(history.state, "", from || (location.pathname + location.search)); } catch {}
  Promise.resolve().then(() => g(to, from)).catch(() => false).then(ok => {
    guardBusy = false;
    if (ok) { window.NAV_GUARD = null; try { history.replaceState(history.state, "", to); } catch {} route(); }
  });
});
/* App.guardNav("Money Game") → installs the standard Yes / No popup as the guard; returns off() (call it in unmount). */
function guardNav(label){
  const fn = () => new Promise(res => {
    U.modal(`<div class="title" style="margin-bottom:8px">Close ${U.esc(label || "this page")}?</div><p class="sub" style="margin-bottom:20px">Do you want to close this?</p>
      <div class="row"><button class="btn btn-ghost grow" data-no>No</button><button class="btn btn-primary grow" data-yes>Yes</button></div>`, el => {
      let done = false; const fin = v => { if (done) return; done = true; clearInterval(iv); U.closeLayer(); res(v); };
      el.querySelector("[data-no]").onclick = () => fin(false); el.querySelector("[data-yes]").onclick = () => fin(true);
      const iv = setInterval(() => { if (!el.querySelector("[data-yes]")) { done = true; clearInterval(iv); res(false); } }, 250);   // dismissed by the scrim / Escape
    });
  });
  window.NAV_GUARD = fn;
  return () => { if (window.NAV_GUARD === fn) window.NAV_GUARD = null; };
}
setTheme(S.settings.theme);
offline();
M.start();
if (S.auto.on) E.runAuto();
route();
window.App = {route, setTheme, guardNav};
})();

/* v7.1: one trade tab strip everywhere (USDⓈ-M / Spot / Binary / CFD Trade / Prediction / Money Game / Copy ✓ / Options / API Trade / Bots).
   Pages keep their own strip markup; this rebuilds it in the canonical order whenever one appears in the view. */
(function(){
  const TABS = [["futures","USDⓈ-M"],["spot","Spot"],["trade","Binary"],["cfd","CFD Trade"],["predict","Prediction",1],["racer","Money Game",1],["copy","Copy",0,1],["options","Options"],["apitrade","API Trade"],["bots","Bots"]];
  const MAIN = ["futures","spot","trade","cfd","predict"];
  const ICON = {futures:"layers", spot:"chart", trade:"clock", cfd:"candle", predict:"predict", racer:"car", copy:"users", options:"target", apitrade:"zap", bots:"bot"};
  const hrefOf = (k, sym) => k === "futures" || k === "spot" || k === "trade" ? `#/${k}/${sym}` : `#/${k}`;
  const tick = '<svg class="tab-vt" viewBox="0 0 24 24" width="14" height="14" aria-label="Verified"><path fill="#2F8BFF" d="M12 1.8l2.4 1.8 3-.2.9 2.9 2.5 1.7-.9 2.9.9 2.9-2.5 1.7-.9 2.9-3-.2L12 20.2l-2.4-1.8-3 .2-.9-2.9-2.5-1.7.9-2.9-.9-2.9 2.5-1.7.9-2.9 3 .2z"/><path d="M8 12.2l2.7 2.6L16.2 9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function norm(t){
    if (t.dataset.nts) return;
    const links = [...t.children]; if (!links.some(a => /USDⓈ-M/.test(a.textContent))) return;
    t.dataset.nts = "1";
    const symOf = k => { const a = links.find(x => (x.getAttribute("href") || "").startsWith("#/" + k + "/")); return a ? a.getAttribute("href").split("/")[2] : "BTCUSDT"; };
    const sym = symOf("futures") || symOf("spot"), cur = (location.hash.split("/")[1] || "").split("?")[0];
    const act = cur === "chart" ? "futures" : cur;
    const st = (links[0] && links[0].getAttribute("style")) || "font-size:16px";
    /* v7.2: 5 main tabs + "More" (the rest open in a sheet); the current page always shows as a tab */
    const show = TABS.filter(([k]) => MAIN.includes(k) || k === act);
    t.innerHTML = show.map(([k, n, hot, vt]) => {
      const href = hrefOf(k, sym);
      const cls = "tab" + (hot ? " tab-hot" : "") + (k === act ? " on" : "");
      return k === act ? `<button class="${cls}" style="${st}" aria-current="page">${n}${vt ? tick : ""}</button>` : `<a class="${cls}" href="${href}" style="${st}">${n}${vt ? tick : ""}</a>`;
    }).join("") + `<button class="tab tab-more" style="${st}" data-tmore="${sym}" aria-haspopup="dialog">More<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`;
    const on = t.querySelector(".on"); if (on && t.scrollWidth > t.clientWidth) t.scrollLeft = Math.max(0, on.offsetLeft - 16);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-tmore]"); if (!b) return;
    const sym = b.dataset.tmore || "BTCUSDT", cur = (location.hash.split("/")[1] || "").split("?")[0];
    U.buzz && U.buzz();
    U.sheet("All products", `<div class="tmore-g">${TABS.map(([k, n, hot, vt]) => `<a class="tmore-i${k === cur || (cur === "chart" && k === "futures") ? " on" : ""}" href="${hrefOf(k, sym)}" data-tmi><span class="tmore-ic">${U.ic(ICON[k] || "grid", 20)}</span><span class="tmore-n">${n}${vt ? tick : ""}${hot ? '<i class="tmore-hot">HOT</i>' : ""}</span></a>`).join("")}</div>`,
      el => el.querySelectorAll("[data-tmi]").forEach(a => a.addEventListener("click", () => U.closeLayer())));
  });
  const scan = () => document.querySelectorAll("#view .tabs").forEach(norm);
  new MutationObserver(scan).observe(document.getElementById("view"), {childList: true, subtree: true});
  scan();
})();

/* v7.2: offline banner text, pull-to-refresh, aria-labels for icon-only controls */
(function(){
  const off = document.getElementById("offline");
  if (off){ off.textContent = "You're offline. Prices may be delayed."; const f = () => { off.classList.toggle("hide", navigator.onLine); document.body.classList.toggle("is-offline", !navigator.onLine); }; addEventListener("online", f); addEventListener("offline", f); f(); }
  /* pull to refresh */
  const view = document.getElementById("view"); if (!view) return;
  let y0 = 0, dy = 0, on = false, ind = null;
  const skip = () => /^#\/(admin|racer|chart)/.test(location.hash) || document.querySelector("#scrim.show") || document.body.classList.contains("no-pull");
  const mk = () => { if (!ind){ ind = document.createElement("div"); ind.className = "ptr"; ind.innerHTML = '<i></i>'; document.body.appendChild(ind); } return ind; };
  view.addEventListener("touchstart", e => {
    on = false; dy = 0;
    if (e.touches.length !== 1 || window.scrollY > 0 || document.scrollingElement.scrollTop > 0 || skip()) return;
    if (e.target.closest("input,textarea,select,canvas,.no-drag,.tabs,[data-nopull]")) return;
    y0 = e.touches[0].clientY; on = true;
  }, {passive: true});
  view.addEventListener("touchmove", e => {
    if (!on) return; dy = e.touches[0].clientY - y0;
    if (dy <= 8){ if (ind) ind.style.opacity = 0; return; }
    const el = mk(), d = Math.min(dy, 110) * .6;
    el.style.opacity = Math.min(1, dy / 70); el.style.transform = `translate(-50%,${d}px) rotate(${dy * 3}deg)`; el.classList.toggle("ready", dy > 70);
  }, {passive: true});
  const end = () => {
    if (!on) return; on = false;
    const go = dy > 70 && !skip(); dy = 0;
    if (ind){ if (go){ ind.classList.add("spin"); ind.style.transform = "translate(-50%,44px)"; } else ind.style.opacity = 0; }
    if (go){ U.buzz && U.buzz(); setTimeout(() => { try { App.route(); } catch {} if (ind){ ind.classList.remove("spin", "ready"); ind.style.opacity = 0; ind.style.transform = "translate(-50%,0)"; } }, 450); }
    else if (ind) ind.classList.remove("ready");
  };
  view.addEventListener("touchend", end, {passive: true}); view.addEventListener("touchcancel", end, {passive: true});
  /* aria-labels */
  const NAMES = {back:"Back", close:"Close", share:"Share", more:"More", menu:"Menu", search:"Search", star:"Favorite", fav:"Favorite", info:"Information", help:"Help", bell:"Notifications", settings:"Settings", copy:"Copy", delete:"Delete", del:"Delete", edit:"Edit", refresh:"Refresh", eye:"Show or hide balance", add:"Add", plus:"Add", minus:"Remove", filter:"Filter", sort:"Sort", scan:"Scan", chat:"Support chat", cancel:"Cancel", tip:"Help"};
  const label = el => {
    if (el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby") || el.closest("[aria-hidden=true]")) return;
    if ((el.textContent || "").trim()) return;
    if (!el.querySelector("svg,img,i,span") && !el.className) return;
    let n = el.getAttribute("title");
    if (!n){
      const keys = [...[...el.attributes].map(a => a.name.replace(/^data-/, "")), ...String(el.className && el.className.baseVal === undefined ? el.className : "").split(/\s+/)];
      for (const k of keys){ const m = k.toLowerCase().split(/[-_]/).find(w => NAMES[w]); if (m){ n = NAMES[m]; break; } }
    }
    if (n) el.setAttribute("aria-label", n);
  };
  const sweep = root => { if (root.nodeType !== 1) return; if (root.matches("button,a")) label(root); root.querySelectorAll("button,a").forEach(label); };
  let q = 0, pend = new Set();
  new MutationObserver(ms => {
    ms.forEach(m => m.addedNodes.forEach(n => pend.add(n)));
    if (q) return; q = setTimeout(() => { q = 0; const p = [...pend]; pend.clear(); p.forEach(sweep); }, 120);
  }).observe(document.body, {childList: true, subtree: true});
  sweep(document.body);
})();
