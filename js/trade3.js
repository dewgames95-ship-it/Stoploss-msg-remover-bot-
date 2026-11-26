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
function unitSheet(coin, cur, onPick){
  const o = (k, n, d) => `<button class="un-o${cur === k ? " on" : ""}" data-un="${k}"><b>${n}</b><p>${d}</p></button>`;
  U.sheet("Unit Preference", o("coin", esc(coin), "Based on asset (BTC, ETH, BNB etc.) quantity, the order will execute as per quantity selected multiplied by the best available price for the current pair.") + o("usdt", "USDT", "The order will execute based on the total amount you want to spend, regardless of asset (BTC, ETH, BNB etc.) quantity."),
    el => el.querySelectorAll("[data-un]").forEach(b => b.onclick = () => { U.closeLayer(); onPick(b.dataset.un); }));
}
function feeNote(label, ours, theirs){
  const n = esc((window.CONFIG && CONFIG.APP_NAME) || "NovaTrade");
  return `<div class="fee-n"><div class="fee-r"><span>${label}</span><b class="num">${ours}</b></div><div class="fee-r"><span>Binance</span><s class="num">${theirs}</s></div><div class="fee-5x">${n} charges 5x less than others</div></div>`;
}
window.TX = {flyMoney, clearFx, sweep, tapPrice, tpCalc, unitSheet, feeNote, buzz, sgn};
})();
