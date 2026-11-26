/* ===== In-app guide: coach-mark tours per screen ===== */
(function(){
const TOURS = {
  home: [
    {sel:".hm-search", title:"Search markets", text:"Find any crypto, forex or gold pair by name and jump straight to its chart."},
    {sel:".hm-assets", title:"Your balance", text:"Total assets and today's PnL at a glance. Tap the eye to hide the amount."},
    {sel:".hm-dep", title:"Deposit", text:"Add USDT to your account in one tap before you start trading."},
    {sel:".hm-sc", title:"Shortcuts", text:"Copy trading, rewards, earn and more are one swipe away."},
    {sel:".hm-chips", title:"Market lists", text:"Switch between Favorites, Hot, Gainers and more. Tap a row to open its chart."},
    {sel:"#strip", title:"News & Feed", text:"Headlines, announcements, events and Academy lessons live in this strip."}
  ],
  trade: [
    {sel:"[data-pick]", title:"Pick a pair", text:"Tap the pair name to switch to another market."},
    {sel:"#chart", title:"Live chart", text:"Watch the price move in real time. Pinch and drag to explore history."},
    {sel:"#af", title:"Bet amount", text:"Choose how much USDT to stake on this trade."},
    {sel:"#exps", title:"Time period", text:"Pick how long the trade runs. It settles automatically when time is up."},
    {sel:'[data-dir="up"]', title:"Up or Down", text:"Predict where the price will be at expiry. Tap Up if you expect a rise, Down if a fall."}
  ],
  futures: [
    {sel:"[data-pick]", title:"Pick a contract", text:"Tap the symbol to switch perpetual markets."},
    {sel:"[data-mode]", title:"Cross or Isolated", text:"Cross shares your whole balance as margin. Isolated limits risk to this position."},
    {sel:"[data-lev]", title:"Leverage", text:"Multiply your position size. Higher leverage means a closer liquidation price."},
    {sel:"#af", title:"Order amount", text:"Enter the size of your order in USDT."},
    {sel:".dslider", title:"Quick size", text:"Drag to use a percentage of your available balance."},
    {sel:"#tpc", title:"Take Profit / Stop Loss", text:"Tick to close automatically at a profit target or a loss limit."},
    {sel:'[data-go="long"]', title:"Open Long", text:"Go long to profit when price rises. Short is on the right to profit when it falls."},
    {sel:"#fbook", title:"Order book", text:"Live bids and asks around the current price."},
    {sel:".ptabs", title:"Positions & orders", text:"Track open positions, pending orders and history here."}
  ],
  spot: [
    {sel:".sp-seg", title:"Buy or Sell", text:"Choose a side, then pick Limit or Market order type."},
    {sel:"#spf", title:"Price", text:"Set the price you want for a limit order."},
    {sel:".sp-sl", title:"Amount", text:"Use the slider to trade a share of your available balance."},
    {sel:"#spgo", title:"Place the order", text:"Review the total and fee, then confirm to buy or sell."},
    {sel:"#spbook", title:"Order book", text:"Tap any price to copy it into the order form."}
  ],
  options: [
    {sel:"#opMode", title:"Simple or Pro", text:"Simple is a guided flow. Switch to Pro for the full option chain."},
    {sel:"#sDir", title:"Rise or fall", text:"Pick Up (call) if you expect the price to rise, Down (put) if you expect a fall."},
    {sel:"#sExps", title:"Expiry", text:"Choose when the option settles, from 15 minutes to a week."},
    {sel:"#sTgts", title:"Target price", text:"Pick the strike. Closer to the market costs more but wins more often."},
    {sel:"#sAmt", title:"Amount", text:"Your maximum loss is the premium you pay, nothing more."},
    {sel:"#sGo", title:"Confirm", text:"Review the summary, then place your option."},
    {sel:"#opExps", title:"Expiry", text:"Choose when the option settles."},
    {sel:"#opChain", title:"Option chain", text:"Each row is a strike with its premium. Tap Buy to trade it."}
  ],
  copy: [
    {sel:".px-hero", title:"Copy trading", text:"Follow top traders and mirror their trades automatically."},
    {sel:"#seg", title:"Perp or Binary", text:"Choose which kind of traders to browse."},
    {sel:".px-tabs", title:"Find traders", text:"Browse the leaderboard, smart rankings and more."},
    {sel:".px-lc .cpy", title:"Copy", text:"Tap Copy to follow a trader. Check ROI and max drawdown first."}
  ]
};
const ROUTE = {home:"home", trade:"trade", futures:"futures", spot:"spot", options:"options", copy:"copy"};
let el = null, steps = [], idx = 0, cur = null, raf = 0, tmr = 0, auto = 0, onResize = null, key = null;
const S = () => window.store?.s || window.U?.store?.s;
const routeName = () => (location.hash.replace(/^#\/?/, "").split("?")[0].split("/")[0]) || "home";
const $ = s => { try { return document.querySelector("#view " + s) || document.querySelector(s); } catch { return null; } };
const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; };

function mark(name){ const s = S(); if (!s) return; (s.tours = s.tours || {})[name] = true; (window.store || window.U.store).save(); }
function close(done){
  cancelAnimationFrame(raf); clearTimeout(tmr);
  if (onResize){ removeEventListener("resize", onResize); removeEventListener("keydown", onKey, true); onResize = null; }
  if (key && done) mark(key);
  const e = el; el = null; key = null; steps = []; cur = null;
  if (e){ e.classList.remove("on"); setTimeout(() => e.remove(), 250); }
}
function onKey(e){ if (e.key === "Escape"){ e.stopPropagation(); close(true); } else if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); next(); } }
function next(){ if (idx >= steps.length - 1) return close(true); show(idx + 1); }

function build(){
  el = document.createElement("div");
  el.className = "tr-ov";
  el.innerHTML = '<div class="tr-spot"></div><div class="tr-card" role="dialog" aria-live="polite"><i class="tr-arr"></i><div class="tr-t"></div><div class="tr-x"></div><div class="tr-f"><span class="tr-n"></span><span class="grow"></span><button class="tr-skip" type="button">Skip</button><button class="tr-next" type="button"></button></div></div>';
  document.body.appendChild(el);
  el.querySelector(".tr-skip").onclick = () => close(true);
  el.querySelector(".tr-next").onclick = next;
  el.addEventListener("click", e => { if (e.target === el) e.stopPropagation(); });
  onResize = () => place(); addEventListener("resize", onResize); addEventListener("keydown", onKey, true);
  requestAnimationFrame(() => el && el.classList.add("on"));
}
function show(i){
  idx = i; const st = steps[i]; cur = $(st.sel);
  const c = el.querySelector(".tr-card");
  c.classList.remove("in"); 
  el.querySelector(".tr-t").textContent = st.title;
  el.querySelector(".tr-x").textContent = st.text;
  el.querySelector(".tr-n").textContent = "Step " + (i + 1) + "/" + steps.length;
  const nb = el.querySelector(".tr-next"); nb.textContent = i === steps.length - 1 ? "Done" : "Next";
  el.querySelector(".tr-skip").style.visibility = i === steps.length - 1 ? "hidden" : "";
  // scroll target into view, keep out of the bottom nav / top bar
  const r = cur.getBoundingClientRect(), H = innerHeight;
  if (r.top < 70 || r.bottom > H - 90){
    const want = r.height > H * .55 ? r.top - 90 : r.top - (H - r.height) / 2 + 20;
    scrollBy({top: want, behavior: "smooth"});
  }
  clearTimeout(tmr); tmr = setTimeout(() => c.classList.add("in"), 120);
  cancelAnimationFrame(raf); loop();
}
let lastBox = "";
function loop(){ place(); raf = requestAnimationFrame(loop); }
function place(){
  if (!el || !cur) return;
  if (!document.contains(cur)){ cur = $(steps[idx].sel); if (!cur) return; }
  const r = cur.getBoundingClientRect(), pad = 6, W = innerWidth, H = innerHeight;
  const x = Math.max(4, r.left - pad), y = r.top - pad;
  const w = Math.min(W - 8 - x, r.width + pad * 2), h = Math.min(r.height + pad * 2, H * .7);
  const box = [x, y, w, h].map(Math.round).join();
  const sp = el.querySelector(".tr-spot"), c = el.querySelector(".tr-card"), ar = c.querySelector(".tr-arr");
  const rad = Math.min(14, Math.max(8, Math.min(w, h) / 3));
  if (box !== lastBox){ lastBox = box; sp.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${rad}px`; }
  const cw = Math.min(320, W - 24), ch = c.offsetHeight || 150;
  c.style.width = cw + "px";
  const below = H - (y + h) , above = y;
  let top, up = false;
  if (below >= ch + 22 || below >= above){ top = y + h + 14; } else { top = y - ch - 14; up = true; }
  top = Math.max(10, Math.min(H - ch - 10, top));
  if (top < y + h && top + ch > y) { /* overlap (tall target): float over its lower part */ top = Math.max(10, Math.min(H - ch - 10, y + h - ch - 12)); ar.style.display = "none"; } else ar.style.display = "";
  let left = Math.max(12, Math.min(W - cw - 12, x + w / 2 - cw / 2));
  c.style.left = left + "px"; c.style.top = top + "px";
  const ax = Math.max(18, Math.min(cw - 18, x + w / 2 - left));
  ar.style.left = ax + "px"; ar.className = "tr-arr " + (up ? "dn" : "up");
}
function run(name, force){
  const list = TOURS[name]; if (!list) return false;
  close(false);
  const avail = list.filter(s => vis($(s.sel)));
  if (!avail.length) return false;
  steps = avail; key = name; lastBox = ""; build(); show(0); return true;
}
function reset(){ const s = S(); if (s) s.tours = {}; (window.store || window.U.store).save(); }
function schedule(){
  clearTimeout(auto); close(false);
  const name = ROUTE[routeName()]; if (!name) return;
  const at = location.hash;
  auto = setTimeout(() => {
    const s = S(); if (!s || location.hash !== at || el) return;
    if (s.settings && s.settings.tips === false) return;
    if (s.tours && s.tours[name]) return;
    if (document.querySelector(".scrim.show,.modal.show,.sheet.show")) return;
    run(name, false);
  }, 900);
}
addEventListener("hashchange", schedule);
if (document.readyState === "complete") schedule(); else addEventListener("load", schedule);
window.TOUR = {run, reset, close: () => close(false)};
})();
