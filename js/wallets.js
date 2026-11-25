/* ===== Wallets: Binance-style Transfer sheet + insufficient-balance helper (v6.3) ===== */
(function(){
const {esc, ic, store, money, toast} = U;
const NAMES = {spot:"Spot", futures:"Futures", binary:"Binary", options:"Options", earn:"Earn"};
const ORDER = ["spot","futures","binary","options","earn"];
const nm = k => NAMES[k] || k;
const floor2 = v => Math.floor((v + 1e-9) * 100) / 100;

function pickFrom(to){
  if (to !== "spot" && store.wb("spot") >= 0.01) return "spot";
  const others = ORDER.filter(k => k !== to).sort((a, b) => store.wb(b) - store.wb(a));
  return others[0];
}
function transferSheet(o = {}){
  let to = ORDER.includes(o.to) ? o.to : "futures";
  let from = ORDER.includes(o.from) && o.from !== to ? o.from : pickFrom(to);
  const opts = sel => ORDER.map(k => `<option value="${k}" ${k === sel ? "selected" : ""}>${nm(k)}</option>`).join("");
  const row = (id, lb) => `<div class="wl-row"><span class="wl-lb">${lb}</span><div class="wl-sel"><b id="${id}n"></b><small class="num" id="${id}a"></small>${ic("chevd",16,2)}<select id="${id}" aria-label="${lb} wallet">${opts("")}</select></div></div>`;
  U.sheet("Transfer", `<div class="wl-x">
    <div class="wl-pair">
      <div class="wl-rows">${row("wf","From")}<div class="wl-sep"></div>${row("wt","To")}</div>
      <button class="wl-swap" id="ws" aria-label="Swap wallets">${ic("swap",18,2)}</button>
    </div>
    <div class="wl-coin">${UI.coinImg("USDT",24)}<b>USDT</b><span>Tether</span></div>
    <div class="wl-fld"><label for="wa">Amount</label><div class="wl-inp"><input id="wa" type="number" inputmode="decimal" placeholder="0.00" autocomplete="off"><button id="wm" class="wl-max" type="button">Max</button><span>USDT</span></div></div>
    <div class="wl-av" id="wav"></div><div class="wl-err" id="wer" role="alert"></div>
    <button class="wl-ok" id="wok">Confirm</button></div>`, el => {
    const $ = q => el.querySelector(q), A = $("#wa"), F = $("#wf"), T = $("#wt");
    const av = () => Math.max(0, floor2(store.wb(from)));
    const upd = () => {
      F.value = from; T.value = to;
      $("#wfn").textContent = nm(from); $("#wfa").textContent = money(store.wb(from)) + " USDT";
      $("#wtn").textContent = nm(to); $("#wta").textContent = money(store.wb(to)) + " USDT";
      $("#wav").innerHTML = `Available <b class="num">${money(av())}</b> USDT`;
    };
    F.onchange = () => { from = F.value; if (to === from) to = ORDER.find(k => k !== from && k === (o.to || to)) || ORDER.find(k => k !== from); upd(); };
    T.onchange = () => { to = T.value; if (to === from) from = pickFrom(to); upd(); };
    $("#ws").onclick = () => { [from, to] = [to, from]; upd(); };
    $("#wm").onclick = () => { A.value = av() || ""; $("#wer").textContent = ""; };
    A.oninput = () => { $("#wer").textContent = ""; };
    $("#wok").onclick = () => {
      const v = Math.round((+A.value) * 100) / 100;
      if (!(v > 0)) return $("#wer").textContent = "Enter an amount";
      const err = store.transfer(from, to, v);
      if (err) return $("#wer").textContent = err;
      U.fx("claim"); U.closeLayer(); toast(`Transferred ${money(v)} USDT: ${nm(from)} → ${nm(to)}`, "ok"); o.done && o.done(v, from, to);
    };
    upd(); if (o.amount) A.value = o.amount;
  });
}
/* "Insufficient Futures balance" -> offer the transfer sheet prefilled to that wallet. Returns true when handled. */
function walletErr(msg){
  const m = /^Insufficient (Spot|Futures|Binary|Options|Earn) balance/i.exec(String(msg || ""));
  if (!m) return false;
  setTimeout(() => transferSheet({to: m[1].toLowerCase()}), 250);
  return true;
}
window.UI.transferSheet = transferSheet; window.UI.walletErr = walletErr; window.UI.walletName = nm;
document.addEventListener("click", e => {
  const b = e.target.closest("[data-wlto]"); if (!b) return;
  e.preventDefault(); e.stopPropagation(); transferSheet({to: b.dataset.wlto});
}, true);
})();
