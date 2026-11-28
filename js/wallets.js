/* ===== Wallets: Binance-style Transfer sheet + insufficient-balance helper (v6.3) ===== */
(function(){
const {esc, ic, store, money, toast} = U;
const NAMES = {spot:"Spot", funding:"Funding", futures:"Futures", binary:"Binary", options:"Options", earn:"Earn", games:"Money Game", predict:"Prediction", cfd:"CFD Trade"};
const LONG = {spot:"Spot Wallet", funding:"Funding Wallet", futures:"Futures", binary:"Binary", options:"Options", earn:"Earn", games:"Money Game", predict:"Prediction", cfd:"CFD Trade"};
const ORDER = ["spot","funding","futures","binary","options","earn","games","predict","cfd"];
const nm = k => NAMES[k] || k;
/* same icon names the Home screen uses for each product (Spot "chart", Futures "layers", Options "target", Earn "earn", Money Game "car", Prediction "predict"; Binary "clock", Funding "wallet" from the all-shortcuts sheet) */
const WIC = {spot:"chart", funding:"wallet", futures:"layers", binary:"clock", options:"target", earn:"earn", games:"car", predict:"predict", cfd:"candle"};
const wi = (k, z = 18) => `<span class="wl-ic" aria-hidden="true">${ic(WIC[k] || "wallet", z, 1.8)}</span>`;
const floor2 = v => Math.floor((v + 1e-9) * 100) / 100;

/* v6.6: Funding wallet. store.WALLETS is the same array core.js sums over, so pushing is enough. */
(function(){
  const S0 = () => store.s;
  ["funding","games","predict","cfd"].forEach(k => { if (!store.WALLETS.includes(k)) store.WALLETS.push(k); });   // v6.8: games = Money Racer, predict = Prediction market
  const fix = () => { const S = S0(); if (S.wallets) ["funding","games","predict","cfd"].forEach(k => { if (!(S.wallets[k] >= 0)) S.wallets[k] = 0; }); S.balance = Math.round(store.WALLETS.reduce((a, k) => a + (S.wallets[k] || 0), 0) * 100) / 100; };
  /* v7.0: demo account = 1,000 USDT in every wallet (new accounts, resets, and a one-time top-up of existing demo accounts) */
  const isDemo = () => { try { return (localStorage.getItem("nt_mode") || "demo") !== "real"; } catch { return true; } };
  const fill = force => { const S = S0(); if (!isDemo() || !S.wallets || (S.w1000 && !force)) return; const first = !S.w1000; store.WALLETS.forEach(k => { if (force || first || !(S.wallets[k] >= 1000)) S.wallets[k] = 1000; }); S.w1000 = 1; }; /* v7.2: a new demo account starts at exactly 1,000 in every wallet */
  fix(); fill(false); fix(); try { store.save(); } catch {}
  const rs = store.reset; store.reset = function(){ const r = rs.apply(this, arguments); fix(); fill(true); fix(); try { store.save(); } catch {} return r; };
})();

function pickFrom(to){
  if (to !== "spot" && store.wb("spot") >= 0.01) return "spot";
  const others = ORDER.filter(k => k !== to).sort((a, b) => store.wb(b) - store.wb(a));
  return others[0];
}
function walletPicker(title, cur, other, onPick, back){
  U.sheet(title, `<div class="wl-pk">${ORDER.map(k => `<button class="wl-pi ${k === cur ? "on" : ""}" data-k="${k}"><span class="wl-pn">${wi(k, 20)}<span><b>${LONG[k]}</b><small>${k === other ? "Selected on the other side" : ""}</small></span></span><em class="num">${money(store.wb(k))} USDT</em>${k === cur ? ic("check", 18, 2.4) : ""}</button>`).join("")}</div>`, el => {
    el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => onPick(b.dataset.k));
  }, back);
}
function transferSheet(o = {}){
  const st = {to: ORDER.includes(o.to) ? o.to : "futures", from: null, amount: o.amount || ""};
  st.from = ORDER.includes(o.from) && o.from !== st.to ? o.from : pickFrom(st.to);
  const open = () => {
    U.sheet("Transfer", `<div class="wl-x">
      <div class="wl-pair">
        <div class="wl-rows">
          <button class="wl-row" id="wfb" type="button"><span class="wl-lb">From</span><b id="wfn"></b>${ic("chev",18,2)}</button>
          <button class="wl-row" id="wtb" type="button"><span class="wl-lb">To</span><b id="wtn"></b>${ic("chev",18,2)}</button>
        </div>
        <button class="wl-swap" id="ws" aria-label="Swap wallets" type="button">${ic("sort",20,2)}</button>
      </div>
      <div class="wl-fld"><label>Coin</label><button class="wl-coin" id="wc" type="button">${UI.coinImg("USDT",26)}<b>USDT</b><span>TetherUS</span><i>${ic("chev",18,2)}</i></button></div>
      <div class="wl-err" id="wer" role="alert"></div>
      <div class="wl-fld"><label for="wa">Amount</label><div class="wl-inp"><input id="wa" type="number" inputmode="decimal" placeholder="0.00" autocomplete="off"><span>USDT</span><button id="wm" class="wl-max" type="button">Max</button></div></div>
      <div class="wl-av" id="wav"></div>
      <button class="wl-ok" id="wok" type="button">Confirm Transfer</button></div>`, el => {
      const $ = q => el.querySelector(q), A = $("#wa");
      const av = () => Math.max(0, floor2(store.wb(st.from)));
      const upd = () => {
        $("#wfn").innerHTML = wi(st.from) + `<span>${esc(LONG[st.from])}</span>`; $("#wtn").innerHTML = wi(st.to) + `<span>${esc(LONG[st.to])}</span>`;
        $("#wav").innerHTML = `Available <b class="num">${money(av())}</b> USDT`;
        $("#wer").textContent = av() > 0 ? "" : "No amount available to transfer, please select another coin.";
        $("#wok").classList.toggle("dis", !(av() > 0));
      };
      A.value = st.amount; A.oninput = () => { st.amount = A.value; if (av() > 0) $("#wer").textContent = ""; };
      $("#wfb").onclick = () => walletPicker("Transfer from", st.from, st.to, k => { st.from = k; if (st.to === k) st.to = ORDER.find(x => x !== k && x === o.to) || ORDER.find(x => x !== k); open(); }, null);
      $("#wtb").onclick = () => walletPicker("Transfer to", st.to, st.from, k => { st.to = k; if (st.from === k) st.from = pickFrom(k); open(); }, null);
      $("#ws").onclick = () => { [st.from, st.to] = [st.to, st.from]; upd(); };
      $("#wc").onclick = () => toast("Only USDT can be transferred between wallets", "info");
      $("#wm").onclick = () => { A.value = st.amount = av() || ""; };
      $("#wok").onclick = () => {
        const v = Math.round((+A.value) * 100) / 100;
        if (!(av() > 0)) return $("#wer").textContent = "No amount available to transfer, please select another coin.";
        if (!(v > 0)) return $("#wer").textContent = "Enter an amount";
        const err = store.transfer(st.from, st.to, v);
        if (err) return $("#wer").textContent = err;
        U.fx("claim"); U.closeLayer(); toast(`Transferred ${money(v)} USDT: ${nm(st.from)} → ${nm(st.to)}`, "ok"); o.done && o.done(v, st.from, st.to);
      };
      upd();
    });
  };
  open();
}
/* "Insufficient Futures balance" -> offer the transfer sheet prefilled to that wallet. Returns true when handled. */
function walletErr(msg){
  const m = /^Insufficient (Spot|Funding|Futures|Binary|Options|Earn) balance/i.exec(String(msg || ""));
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
