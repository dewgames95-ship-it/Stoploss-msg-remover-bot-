/* v6.6 trade layer: celebratory money animation for winning binary trades */
(function(){
const EMO = ["💵","💰","🪙","💵","🪙","💰","💸"];
function flyMoney(){
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = document.createElement("div"); box.className = "tx-fly"; box.setAttribute("aria-hidden", "true");
    const n = 22;
    for (let i = 0; i < n; i++){
      const e = document.createElement("span"), up = i % 2 === 0;
      e.textContent = EMO[(Math.random() * EMO.length) | 0];
      e.className = up ? "u" : "d";
      e.style.left = (4 + Math.random() * 90) + "%";
      e.style.fontSize = (20 + Math.random() * 18) + "px";
      e.style.animationDelay = (Math.random() * 0.9) + "s";
      e.style.animationDuration = (1.9 + Math.random() * 1.1) + "s";
      e.style.setProperty("--dx", ((Math.random() - .5) * 90) + "px");
      e.style.setProperty("--rot", ((Math.random() - .5) * 120) + "deg");
      box.appendChild(e);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 4200);
  } catch {}
}
function clearFx(){ document.querySelectorAll(".tx-fly,.confetti").forEach(e => e.remove()); }
/* ---- v6.8 shared trade-form helpers ---- */
const esc = s => U.esc(s);
const buzz = ms => { try { U.buzz(ms); } catch {} };
const sgn = v => (v >= 0 ? "+" : "-") + Math.abs(v).toFixed(2);
/* Remove a stray, empty result layer (a closed layer whose delayed clear raced with the next popup) */
function sweep(){
  try {
    clearIfIdle();
    const m = document.getElementById("modal");
    if (m && m.classList.contains("show") && !m.children.length){
      m.classList.remove("show");
      const sc = document.getElementById("scrim");
      if (sc && !document.querySelector("#sheet.show,#drawer.show,#modal.show")){ sc.classList.remove("show"); sc.classList.add("hide"); }
      document.body.style.overflow = "";
    }
  } catch {}
}
function clearIfIdle(){ if (document.hidden) clearFx(); }
document.addEventListener("visibilitychange", () => { clearFx(); setTimeout(sweep, 350); });
window.addEventListener("hashchange", () => { clearFx(); setTimeout(sweep, 450); });
/* Tap a price in an order book / live price: robust against the list re-rendering between press and release */
function tapPrice(box, cb){
  let d = null;
  const up = e => { document.removeEventListener("pointerup", up, true); if (!d) return; const t = d; d = null; if (Math.abs(e.clientX - t.x) + Math.abs(e.clientY - t.y) < 14) cb(+t.p); };
  box.addEventListener("pointerdown", e => { const r = e.target.closest("[data-bp]"); if (!r) return; d = {p:r.dataset.bp, x:e.clientX, y:e.clientY}; document.addEventListener("pointerup", up, true); });
  box.addEventListener("pointercancel", () => { d = null; });
}
/* TP/SL maths. mode "roi": val = ROI % magnitude (profit for tp, loss for sl); mode "price": val = trigger price. */
function tpCalc({k, mode, val, ep, lev = 1, notional = 0, side}){
  const up = k === "tp";
  if (mode === "roi"){
    const roi = (up ? 1 : -1) * val, d = roi / 100 / lev, price = ep * (1 + (side === "short" ? -d : d));
    return {price, roi, pnl: notional ? roi / 100 * notional / lev : 0, side};
  }
  const sd = side || (up ? (val >= ep ? "long" : "short") : (val <= ep ? "long" : "short")), mv = (val - ep) / ep * (sd === "long" ? 1 : -1);
  return {price: val, roi: mv * lev * 100, pnl: notional ? mv * notional : 0, side: sd};
}
/* v7.4: how many order-book rows fit next to the order form. st = {a, b, min, max} (asks / bids rows). Returns true when st changed (caller re-renders). */
function fitBook(box, form, st){
  try {
    if (!box || !form || !box.isConnected) return false;
    const r = box.querySelector(".r"); if (!r) return false;
    const rh = r.getBoundingClientRect().height, fh = form.getBoundingClientRect().height, bh = box.getBoundingClientRect().height;
    if (!(rh > 8) || !(fh > 60) || !(bh > 0)) return false;
    const extra = Math.floor((fh - bh) / rh); if (!extra) return false;
    const T = Math.max(2 * st.min, Math.min(2 * st.max, st.a + st.b + extra)), a = Math.ceil(T / 2), b = T - a;
    if (a === st.a && b === st.b) return false;
    st.a = a; st.b = b; return true;
  } catch { return false; }
}
function unitSheet(coin, cur, onPick){
  const o = (k, n, d) => `<button class="un-o${cur === k ? " on" : ""}" data-un="${k}"><b>${n}</b><p>${d}</p></button>`;
  U.sheet("Unit Preference", o("coin", esc(coin), "Based on asset (BTC, ETH, BNB etc.) quantity, the order will execute as per quantity selected multiplied by the best available price for the current pair.") + o("usdt", "USDT", "The order will execute based on the total amount you want to spend, regardless of asset (BTC, ETH, BNB etc.) quantity."),
    el => el.querySelectorAll("[data-un]").forEach(b => b.onclick = () => { U.closeLayer(); onPick(b.dataset.un); }));
}
function feeNote(ours, theirs){
  return `<div class="fee-l">Fee <b class="num">${ours}</b> <s class="num">${theirs}</s> <i class="fee-b">5x less</i><button class="hq fee-q" type="button" data-info="fee" aria-label="Fee details">?</button></div>`;
}
/* ---- v6.9 shared numeric input: thousands separators while typing (34,706.24), caret kept, every reader still gets a plain number.
   The element's .value getter returns the comma-free string and the setter formats, so parseFloat(el.value) / +el.value keep working everywhere.
   Auto-applied to every input[inputmode=decimal] (opt out: data-num="off"); data-num / data-dp="n" also opt in / cap decimals. ---- */
const NV = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
const NSEL = 'input[inputmode="decimal"]:not([data-num="off"]),input[data-num]:not([data-num="off"])';
function numFmt(v, dp){
  v = String(v == null ? "" : v).trim();
  if (/e/i.test(v) && isFinite(+v)) v = (+v).toFixed(8).replace(/\.?0+$/, "");
  const neg = v[0] === "-"; v = v.replace(/[^0-9.]/g, "");
  let [i, ...r] = v.split("."), d = r.join(""), hasDot = v.indexOf(".") >= 0;
  if (dp != null && d.length > dp) d = d.slice(0, dp);
  i = i.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (hasDot && dp === 0) hasDot = false;
  return (neg ? "-" : "") + i + (hasDot ? "." + d : "");
}
function numInput(el, o = {}){
  if (!el || el.__num || el.tagName !== "INPUT") return el;
  el.__num = 1;
  const dp = o.dp != null ? o.dp : (el.dataset.dp != null && el.dataset.dp !== "" ? +el.dataset.dp : null);
  el.__dp = dp;
  try { if (el.type === "number") el.type = "text"; } catch {}
  el.setAttribute("inputmode", "decimal"); el.setAttribute("autocomplete", "off");
  Object.defineProperty(el, "value", {configurable: true,
    get(){ return NV.get.call(el).replace(/,/g, ""); },
    set(v){ NV.set.call(el, numFmt(v, null)); }});
  const cur = NV.get.call(el); if (cur) NV.set.call(el, numFmt(cur, dp));
  return el;
}
document.addEventListener("input", e => {
  const el = e.target; if (!el || !el.__num) return;
  let raw = NV.get.call(el), c = el.selectionStart == null ? raw.length : el.selectionStart;
  if (e.data === "," && raw[c - 1] === "," && raw.indexOf(".") === -1) raw = raw.slice(0, c - 1) + "." + raw.slice(c);   // comma-decimal keyboards
  const sig = x => (x.match(/[0-9.]/g) || []).length;
  const n = sig(raw.slice(0, c)), f = numFmt(raw, el.__dp);
  if (f !== NV.get.call(el)){
    NV.set.call(el, f);
    let k = 0, pos = f[0] === "-" ? 1 : 0;
    if (n > 0){ pos = 0; while (pos < f.length && k < n){ if (/[0-9.]/.test(f[pos])) k++; pos++; } }
    try { el.setSelectionRange(pos, pos); } catch {}
  }
}, true);
{
  const scan = n => { if (n.nodeType !== 1) return; if (n.matches && n.matches(NSEL)) numInput(n); if (n.querySelectorAll) n.querySelectorAll(NSEL).forEach(i => numInput(i)); };
  const start = () => { scan(document.body); new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(scan); }).observe(document.body, {childList: true, subtree: true}); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
}
/* ---- v6.9 beginner "?" help on trade-form terms (reuses UI.help from page-options.js) ---- */
const FH = {
  lev: ["Leverage", "<p><b>Leverage</b> multiplies your position size. With 10x and 100 USDT margin you control 1,000 USDT.</p><p>Profits and losses are multiplied too, and the liquidation price moves closer to the entry price. Higher leverage means higher risk.</p>"],
  mode: ["Margin mode", "<p><b>Cross</b>: your whole futures balance backs the position. Liquidation is further away, but you can lose the whole balance.</p><p><b>Isolated</b>: only the margin assigned to the position is at risk. You can add or remove margin on an open isolated position.</p>"],
  cost: ["Cost", "<p><b>Cost</b> is what the order takes from your balance: the margin (size / leverage) plus the opening fee.</p>"],
  maxopen: ["Max open", "<p>The largest position size you can open now with your available balance at the selected leverage, after the opening fee.</p>"],
  liq: ["Liq. Price", "<p>The <b>liquidation price</b> is the price at which your margin is used up and the position is closed automatically. The first value is for a Long, the second for a Short.</p><p>Lower leverage or isolated margin with extra margin moves it further away.</p>"],
  fee: ["Maker / taker", "<p>A <b>taker</b> order (Market) fills immediately and removes liquidity: higher fee. A <b>maker</b> order (Limit resting in the book) adds liquidity: lower fee.</p>"],
  avbl: ["Available balance", "<p>Funds in this wallet that are free to open new orders. Tap the + button to transfer funds in.</p>"],
  otype: ["Order type", "<p><b>Market</b> executes at once at the best price. <b>Limit</b> waits until the market reaches the price you set (or better).</p>"],
  total: ["Total", "<p>Order value = price x quantity. For a Market order the live price is used.</p>"],
  est: ["ROI and PnL", "<p><b>ROI</b> is the return on your margin. <b>PnL</b> is the profit or loss in USDT if the price reaches your trigger.</p>"]
};
const hq = k => `<button type="button" class="hq" data-fh="${k}" aria-label="Help: ${FH[k] ? FH[k][0] : k}">?</button>`;
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-fh]"); if (!t) return;
  e.preventDefault(); e.stopPropagation(); const f = FH[t.dataset.fh]; if (!f) return;
  if (window.UI && UI.tip) UI.tip(f[0], f[1]); else if (window.UI && UI.help) UI.help(f[0], f[1]); else U.sheet(f[0], f[1]);
}, true);
window.TX = {fitBook, flyMoney, clearFx, sweep, tapPrice, tpCalc, unitSheet, feeNote, buzz, sgn, numInput, numFmt, hq};
window.U.numInput = numInput;
})();
