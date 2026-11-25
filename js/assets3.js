/* ===== v6.6 assets: banner carousel, coin sheet, Binance-style withdraw flow, PnL extras, route flag ===== */
(function(){
const {esc, ic, store, bus, money, fmt, toast} = U;
const S = () => store.s;

/* ---------- route flag for desktop layout (css/assets3.css) ---------- */
const flag = () => { const n = (location.hash.replace(/^#\/?/, "").split(/[/?]/)[0]) || "home"; document.documentElement.dataset.rt = n; };
flag(); addEventListener("hashchange", flag);

/* ---------- Assets banner carousel ---------- */
const SLIDES = [
  {href:"#/earn", t:"Earn up to 12% APR on USDT", s:"Flexible and locked plans, redeem anytime", art:() => (window.ART && ART.coins ? ART.coins(84) : "")},
  {href:"#/copy", t:"Copy top traders", s:"Mirror verified leaders with one tap", ico:"users", c:"#2E6BFF"},
  {href:"#/rewards", t:"Daily rewards", s:"Check in, collect XP and claim vouchers", ico:"gift", c:"#12B886"},
  {href:"#/referral", t:"Invite friends, earn together", s:"Share your code for a welcome bonus", ico:"share", c:"#7C5CFF"}
];
let car = null, carIdx = 0, carIgnore = false, carTouch = false;
function buildCar(){
  car = document.createElement("div"); car.className = "px-carw";
  car.innerHTML = `<div class="px-car">${SLIDES.map(x => `<a class="px-promo px-sl" href="${x.href}"><div class="tx"><b>${esc(x.t)}</b><span>${esc(x.s)}</span></div>${x.art ? x.art() : `<span class="px-sl-i" style="--c:${x.c}">${ic(x.ico, 34, 1.6)}</span>`}<i class="arr">${ic("chev",14,2)}</i></a>`).join("")}</div>
    <div class="px-dots">${SLIDES.map((_, i) => `<i data-i="${i}"></i>`).join("")}</div>`;
  const tr = car.firstElementChild;
  const dots = () => car.querySelectorAll(".px-dots i").forEach((d, i) => d.classList.toggle("on", i === carIdx));
  tr.addEventListener("scroll", () => { if (carIgnore) return; const w = tr.clientWidth || 1; const i = Math.round(tr.scrollLeft / w); if (i !== carIdx){ carIdx = Math.max(0, Math.min(SLIDES.length - 1, i)); dots(); } }, {passive:true});
  tr.addEventListener("touchstart", () => { carTouch = true; }, {passive:true});
  tr.addEventListener("touchend", () => setTimeout(() => { carTouch = false; }, 3000), {passive:true});
  car.querySelectorAll(".px-dots i").forEach(d => d.onclick = () => { carIdx = +d.dataset.i; tr.scrollTo({left: carIdx * tr.clientWidth, behavior:"smooth"}); dots(); });
  car._dots = dots; dots();
  setInterval(() => {
    if (!car.isConnected || carTouch || document.hidden || !tr.clientWidth) return;
    carIdx = (carIdx + 1) % SLIDES.length; tr.scrollTo({left: carIdx * tr.clientWidth, behavior:"smooth"}); dots();
  }, 4500);
}
UI.assetsCarousel = function(box){
  const ph = box.querySelector(".px-car-ph"); if (!ph) return;
  if (!car) buildCar();
  const tr = car.firstElementChild; carIgnore = true;
  ph.appendChild(car); tr.scrollLeft = carIdx * tr.clientWidth; car._dots();
  setTimeout(() => { carIgnore = false; }, 60);
};

/* ---------- Coin details sheet (list stays underneath) ---------- */
UI.coinSheet = function(coin, t, rerender){
  const hide = !!S().settings.hideBal, H = v => hide ? "******" : v, k = M.usdtUsd();
  let body;
  if (coin === "USDT"){
    const rows = ["funding","spot","futures","binary","options","earn"].map(w => [UI.walletName(w), store.wb(w)]);
    const total = rows.reduce((a, r) => a + r[1], 0);
    body = `<div class="cs-h">${UI.coinImg("USDT", 40)}<div class="grow"><b>USDT</b><span>TetherUS</span></div><div class="r"><b class="num">${H(money(total))}</b><span class="num">${H("≈ $" + money(total * k))}</span></div></div>
      <div class="cs-sec">Wallet balances</div>${rows.map(r => `<div class="cs-r"><span>${r[0]}</span><b class="num">${H(money(r[1]))}</b></div>`).join("")}
      <div class="cs-acts"><a class="btn btn-primary" href="#/deposit">Deposit</a><a class="btn btn-ghost" href="#/withdraw/USDT">Withdraw</a><button class="btn btn-ghost" data-xf>Transfer</button></div>`;
  } else {
    const h = (t && t.hold || []).find(x => x.coin === coin) || {amt:0, val:0, pnl:0};
    body = `<div class="cs-h">${UI.coinImg(coin, 40)}<div class="grow"><b>${esc(coin)}</b><span>${esc((window.COIN_NAMES && COIN_NAMES[coin]) || coin)}</span></div><div class="r"><b class="num">${H(fmt(h.amt, 6))}</b><span class="num">${H("≈ $" + money(h.val * k))}</span></div></div>
      <div class="cs-r"><span>Today's PnL</span><b class="num ${h.pnl >= 0 ? "up" : "down"}">${H((h.pnl >= 0 ? "+$" : "-$") + money(Math.abs(h.pnl)))}</b></div>
      <div class="cs-acts"><a class="btn btn-primary" href="#/spot/${esc(coin)}USDT">Trade</a><a class="btn btn-ghost" href="#/deposit/${esc(coin)}">Deposit</a></div>`;
  }
  U.sheet(coin + " details", `<div class="cs">${body}</div>`, el => {
    el.querySelectorAll("a.btn").forEach(a => a.addEventListener("click", () => U.closeLayer()));
    const x = el.querySelector("[data-xf]"); if (x) x.onclick = () => UI.transferSheet({done: rerender});
  });
};

/* ---------- Withdrawal flow ---------- */
const EVM = /^0x[a-fA-F0-9]{40}$/, B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const NETS = [
  {k:"BSC", n:"BNB Smart Chain (BEP20)", fee:0.15, min:3, eta:1, re:EVM, ex:"0x…"},
  {k:"TRX", n:"Tron (TRC20)", fee:1.5, min:1.5, eta:1, re:/^T[1-9A-HJ-NP-Za-km-z]{33}$/, ex:"T…"},
  {k:"ETH", n:"Ethereum (ERC20)", fee:1, min:5, eta:3, re:EVM, ex:"0x…"},
  {k:"APT", n:"Aptos", fee:0.01, min:5, eta:1, re:/^0x[a-fA-F0-9]{1,64}$/, ex:"0x…"},
  {k:"TON", n:"TON", fee:0.15, min:5, eta:1, re:/^[UE]Q[A-Za-z0-9_-]{46}$/, ex:"UQ…"},
  {k:"POL", n:"Polygon", fee:0.8, min:10, eta:5, re:EVM, ex:"0x…"},
  {k:"SOL", n:"Solana", fee:1, min:1, eta:1, re:B58, ex:"base58"},
  {k:"ARB", n:"Arbitrum One", fee:0.5, min:0.5, eta:2, re:EVM, ex:"0x…"},
  {k:"OP", n:"Optimism", fee:0.5, min:1, eta:2, re:EVM, ex:"0x…"}
];
const fnum = v => fmt(v, 2).replace(/\.?0+$/, m => m.includes(".") ? "" : m);
const head = (title, right) => `<header class="page-head"><button class="icon-btn" data-back aria-label="Go back">${ic("back",22)}</button><h1 class="h1 ellipsis" style="text-align:center">${esc(title)}</h1>${right || `<span style="width:40px"></span>`}</header>`;
const histBtn = `<button class="icon-btn" data-wh aria-label="Withdrawal history">${ic("history",22)}</button>`;
const wdList = () => (S().tx || []).filter(x => x.kind === "withdrawal");
function wdHistory(){
  const l = wdList();
  U.sheet("Withdrawal history", l.length ? l.map(x => `<div class="wd-h"><div class="grow"><b>${esc(x.coin)} · ${esc(x.method)}</b><span>${U.dateStr(x.t)} · ${esc((x.addr || "").slice(0, 8))}…${esc((x.addr || "").slice(-6))}</span></div><div class="r"><b class="num">-${fmt(x.amount, 2)}</b><em class="${x.status === "Completed" ? "ok" : "pr"}">${esc(x.status)}</em></div></div>`).join("") : `<div class="wd-emp">${ic("file",28,1.5)}<p>No withdrawals yet</p></div>`);
}
/* Processing -> Completed after ~10s (also settles across reloads) */
function settle(){
  let ch = 0; (S().tx || []).forEach(x => { if (x.kind === "withdrawal" && x.status === "Processing" && Date.now() >= (x.done || 0)){ x.status = "Completed"; ch++; store.notify("Withdrawal completed", `${fmt(x.receive, 2)} USDT sent via ${x.method}`, "ok"); } });
  if (ch){ store.save(); bus.emit("wdone"); }
  return ch;
}
setInterval(settle, 2000); setTimeout(settle, 500);
const fundBal = () => store.wb("funding"), spotBal = () => store.wb("spot");

function pickPage(){
  let q = "", hide0 = false;
  const list = () => {
    const hold = (() => { try { return (window.SPOT && SPOT.holdings() || []); } catch { return []; } })();
    const rows = [{c:"USDT", n:"TetherUS", a:fundBal() + spotBal(), v:(fundBal() + spotBal()) * M.usdtUsd()}];
    hold.forEach(h => { if (h.coin !== "USDT") rows.push({c:h.coin, n:(window.COIN_NAMES && COIN_NAMES[h.coin]) || h.coin, a:+h.amount || +h.qty || 0, v:+h.value || 0}); });
    ["BTC","ETH","BNB","SOL","XRP","DOGE","TRX","TON","ADA","LINK"].forEach(c => { if (!rows.some(r => r.c === c)) rows.push({c, n:(window.COIN_NAMES && COIN_NAMES[c]) || c, a:0, v:0}); });
    return rows.filter(r => (!hide0 || r.a > 0) && (!q || (r.c + r.n).toUpperCase().includes(q.toUpperCase())));
  };
  const html = head("Select Assets", histBtn) + `<div class="wd-pg"><label class="wd-search">${ic("search",16)}<input id="wq" placeholder="Search" autocomplete="off" aria-label="Search coins"></label>
    <label class="wd-chk"><input type="checkbox" id="wz"><i></i><span>Hide 0 balances</span></label><div id="wl"></div></div>`;
  return {html, title:"Withdraw", mount(r){
    const draw = () => { r.querySelector("#wl").innerHTML = list().map(x => `<button class="wd-coin" data-c="${esc(x.c)}">${UI.coinImg(x.c, 36)}<div class="grow"><b>${esc(x.c)}</b><span>${esc(x.n)}</span></div><div class="r"><b class="num">${fmt(x.a, x.c === "USDT" ? 2 : 6)}</b><span class="num">≈ $${money(x.v)}</span></div></button>`).join("") || `<div class="wd-emp">${ic("search",28,1.5)}<p>No assets found</p></div>`; };
    draw();
    r.querySelector("#wq").oninput = e => { q = e.target.value.trim(); draw(); };
    r.querySelector("#wz").onchange = e => { hide0 = e.target.checked; draw(); };
    r.querySelector("[data-wh]").onclick = wdHistory;
    r.addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; if (b.dataset.c !== "USDT") return toast("Only USDT withdrawals are available in this demo", "info"); location.hash = "#/withdraw/USDT"; });
  }};
}

function chainPage(coin){
  const st = {net:null, from:{funding:true, spot:true}};
  const avail = () => (st.from.funding ? fundBal() : 0) + (st.from.spot ? spotBal() : 0);
  const html = head(coin + " On-chain", histBtn) + `<div class="wd-pg wd-ch">
    <label class="wd-l" for="wad">${coin} address</label>
    <div class="wd-f"><input id="wad" placeholder="Enter Address" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" data-paste aria-label="Paste">${ic("copy",20,1.7)}</button><button type="button" data-scan aria-label="Scan QR">${ic("qr",20,1.7)}</button></div>
    <div class="wd-er" id="e1"></div>
    <div class="wd-l">Network</div>
    <button class="wd-f wd-sel" id="wnet" type="button"><span id="wnn" class="ph">Select Network</span>${ic("chevd",18,2)}</button>
    <div class="wd-er" id="e2"></div>
    <div class="wd-l">Withdrawal amount</div>
    <div class="wd-f"><input id="wam" type="number" inputmode="decimal" placeholder="Min. --" autocomplete="off"><span class="u">${coin}</span><i class="v"></i><button type="button" class="all" data-all>All</button></div>
    <div class="wd-er" id="e3"></div>
    <div class="wd-av"><span>Available</span><b class="num" id="wav">0.00 ${coin}</b></div>
    <label class="wd-ac"><input type="checkbox" data-a="funding" checked><i></i><span>Funding Account</span><b class="num" id="wfb">${fmt(fundBal(), 2)} ${coin}</b></label>
    <label class="wd-ac"><input type="checkbox" data-a="spot" checked><i></i><span>Spot Account</span><b class="num" id="wsb">${fmt(spotBal(), 2)} ${coin}</b></label>
    <button class="wd-rm" type="button" data-rm>Remarks ${ic("chevd",16,2)}</button><textarea id="wrm" class="wd-rt" hidden rows="2" maxlength="60" placeholder="Optional note"></textarea>
    <p class="wd-note">Demo only. No real funds are moved and nothing is sent on-chain.</p></div>
    <div class="wd-bar"><div><b class="num" id="wrc">-- ${coin}</b><span id="wfe">Fee: -- ${coin}</span></div><button class="btn btn-primary wd-go" id="wgo">Withdraw</button></div>`;
  return {html, title:coin + " On-chain", mount(r){
    document.body.classList.add("no-nav");
    const $ = q => r.querySelector(q), A = $("#wam"), AD = $("#wad");
    const upd = () => {
      const n = st.net, v = +A.value || 0;
      $("#wav").textContent = fmt(avail(), 2) + " " + coin; A.placeholder = "Min. " + (n ? fnum(n.min) : "--");
      $("#wnn").textContent = n ? n.n : "Select Network"; $("#wnn").classList.toggle("ph", !n);
      $("#wrc").textContent = n && v > 0 ? fmt(Math.max(0, v - n.fee), 2) + " " + coin : "-- " + coin;
      $("#wfe").textContent = "Fee: " + (n ? fnum(n.fee) : "--") + " " + coin;
    };
    const setErr = (id, m) => { $(id).textContent = m || ""; };
    function netSheet(){
      U.sheet("Select withdrawal network", `<div class="wd-warn">${ic("info",16,2)}<span>Please ensure you select the same network on ${esc(window.CONFIG.APP_NAME)} and the receiving platform to avoid loss of assets.</span></div>${NETS.map(n => `<button class="wd-net ${st.net && st.net.k === n.k ? "on" : ""}" data-k="${n.k}"><b>${esc(n.n)}</b><span>Fee: ${fnum(n.fee)} ${coin} (&lt; $${Math.max(1, n.fee).toFixed(2)})</span><span>Minimum withdrawal: ${fnum(n.min)} ${coin}</span><span>Est. arrival time ≈ ${n.eta} min</span></button>`).join("")}`, el => {
        el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { st.net = NETS.find(x => x.k === b.dataset.k); U.closeLayer(); setErr("#e2"); upd(); });
      });
    }
    $("#wnet").onclick = netSheet;
    $("[data-wh]").onclick = wdHistory;
    $("[data-rm]").onclick = () => { const t = $("#wrm"); t.hidden = !t.hidden; if (!t.hidden) t.focus(); };
    $("[data-all]").onclick = () => { A.value = Math.floor(avail() * 100) / 100 || ""; setErr("#e3"); upd(); };
    $("[data-paste]").onclick = async () => { try { AD.value = (await navigator.clipboard.readText()).trim(); setErr("#e1"); } catch { toast("Clipboard unavailable. Paste into the field manually.", "info"); } };
    $("[data-scan]").onclick = () => toast("QR scanning is not available in this demo", "info");
    r.querySelectorAll("[data-a]").forEach(c => c.onchange = () => { st.from[c.dataset.a] = c.checked; upd(); });
    A.oninput = () => { setErr("#e3"); upd(); }; AD.oninput = () => setErr("#e1");
    $("#wgo").onclick = () => {
      const n = st.net, v = Math.round((+A.value) * 100) / 100, ad = AD.value.trim(); let bad = false;
      if (!ad){ setErr("#e1", "Enter a withdrawal address"); bad = true; }
      if (!n){ setErr("#e2", "Select a network"); bad = true; }
      else if (ad && !n.re.test(ad)){ setErr("#e1", `Invalid ${n.n} address format`); bad = true; }
      if (!(v > 0)){ setErr("#e3", "Enter an amount"); bad = true; }
      else if (n && v < n.min){ setErr("#e3", `Minimum withdrawal is ${fnum(n.min)} ${coin}`); bad = true; }
      else if (n && v <= n.fee){ setErr("#e3", "Amount must be greater than the fee"); bad = true; }
      else if (v > avail() + 1e-9){ setErr("#e3", "Insufficient balance in the selected accounts"); bad = true; }
      if (bad) return U.fx("err");
      const rcv = Math.round((v - n.fee) * 100) / 100;
      U.sheet("Confirm withdrawal", `<div class="wd-cf"><div><span>Network</span><b>${esc(n.n)}</b></div><div><span>Address</span><b class="mono">${esc(ad)}</b></div><div><span>Amount</span><b class="num">${fmt(v, 2)} ${coin}</b></div><div><span>Fee</span><b class="num">${fnum(n.fee)} ${coin}</b></div><div><span>Receive amount</span><b class="num">${fmt(rcv, 2)} ${coin}</b></div><div><span>Est. arrival</span><b>≈ ${n.eta} min</b></div></div>
        <button class="btn btn-primary wd-cfm" data-ok>Confirm withdrawal</button>`, el => {
        el.querySelector("[data-ok]").onclick = () => {
          if (v > avail() + 1e-9) return toast("Insufficient balance", "bad");
          let rem = v; ["funding","spot"].forEach(w => { if (!st.from[w] || rem <= 0) return; const take = Math.min(store.wb(w), rem); if (take > 0){ store.addWallet(w, -take, "withdraw"); rem = Math.round((rem - take) * 100) / 100; } });
          const id = U.uid();
          (S().tx ||= []).unshift({id, kind:"withdrawal", coin, amount:v, fee:n.fee, receive:rcv, method:n.n, addr:ad, note:$("#wrm").value.trim(), status:"Processing", t:Date.now(), done:Date.now() + 10000});
          store.save(); U.fx("claim"); U.closeLayer();
          toast(`Withdrawal submitted: ${fmt(v, 2)} ${coin}`, "ok");
          setTimeout(() => { if (settle() && r.isConnected) toast("Withdrawal completed", "ok"); }, 10200);
          location.hash = "#/assets/fund";
        };
      });
    };
    upd();
    const off = bus.on("balance", () => { $("#wfb").textContent = fmt(fundBal(), 2) + " " + coin; $("#wsb").textContent = fmt(spotBal(), 2) + " " + coin; upd(); });
    this.unmount = () => { off(); document.body.classList.remove("no-nav"); };
  }};
}
Pages.withdraw = (params) => { const c = String((params && params[0]) || "").toUpperCase(); return c ? chainPage(c === "USDT" ? c : "USDT") : pickPage(); };

/* ---------- PnL Analysis: joined date, volume per product, fees, exchange comparison ---------- */
const RATES = {Binance:{fut:0.0005, spot:0.001}, Bybit:{fut:0.00055, spot:0.001}, OKX:{fut:0.0005, spot:0.001}};
function volStats(){
  const s = S(), o = {fut:0, bin:0, spot:0, opt:0, fees:0};
  ((s.fut || {}).history || []).forEach(x => { const q = x.closedVol || 0; o.fut += x.maxQty && x.entry ? x.maxQty * x.entry + q * (x.exit || x.entry) : (x.margin || 0) * (x.lev || 1) * 2; o.fees += x.rz ? (x.rz.openFee || 0) + (x.rz.closeFee || 0) : (x.fee || 0); });
  (s.history || []).forEach(x => { if (x.closed) o.bin += +x.amount || 0; });
  ((s.spot || {}).history || []).forEach(x => { o.spot += (x.qty || 0) * (x.price || 0); o.fees += x.fee || 0; });
  ((s.opt || {}).history || []).forEach(x => { o.opt += +x.cost || 0; o.fees += +x.fee || 0; });
  return o;
}
function pnlExtra(root){
  const el = root.querySelector("#pnr"); if (!el || el.querySelector(".pn-x66")) return;
  const anchor = el.querySelector(".pn-kpis"); if (!anchor) return;
  const p = S().profile || (S().profile = {}); if (!p.joined){ p.joined = S().created || Date.now(); store.save(); }
  const v = volStats(), tot = v.fut + v.bin + v.spot + v.opt, cmp = Object.entries(RATES).map(([n, r]) => [n, v.fut * r.fut + v.spot * r.spot + v.opt * 0.0003]);
  const days = Math.floor((Date.now() - p.joined) / 864e5);
  const vr = (n, x) => `<div><span>${n}</span><b class="num">$${money(x)}</b></div>`;
  anchor.insertAdjacentHTML("afterend", `<section class="pn-sec pn-x66"><h3>Account overview</h3>
    <div class="pnx-j"><span>Joined</span><b>${new Date(p.joined).toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"})}</b><em>${days < 1 ? "Today" : days + " day" + (days === 1 ? "" : "s") + " ago"}</em></div>
    <div class="pnx-g">${vr("Futures volume", v.fut)}${vr("Binary volume", v.bin)}${vr("Spot volume", v.spot)}${vr("Options volume", v.opt)}</div>
    <div class="pnx-j" style="margin-top:8px"><span>Total volume</span><b class="num">$${money(tot)}</b></div>
    <div class="pnx-g"><div><span>Total fees paid</span><b class="num">$${money(v.fees)}</b></div><div><span>Avg fee</span><b class="num">${tot > 0 ? (v.fees / (v.fut + v.spot + v.opt || 1) * 100).toFixed(3) : "0.000"}%</b></div></div>
    <div class="pnx-c"><b>Same volume elsewhere</b>${tot > 0 ? cmp.map(([n, c]) => `<div><span>${n}</span><b class="num">$${money(c)}</b></div>`).join("") + `<div class="me"><span>${esc(window.CONFIG.APP_NAME)}</span><b class="num">$${money(v.fees)}</b></div>` : `<p>Trade to see how your fees compare.</p>`}</div>
    <p class="pn-mut" style="font-size:11px;margin-top:6px">Binary trades carry no fee. Comparison uses standard taker fees: futures 0.05%, spot 0.10%.</p></section>`);
}
if (window.Pages && Pages.pnl){
  const orig = Pages.pnl;
  Pages.pnl = function(){
    const pg = orig.apply(this, arguments), om = pg.mount;
    pg.mount = function(root){
      om.call(this, root);
      const el = root.querySelector("#pnr"); if (!el) return;
      const mo = new MutationObserver(() => { try { pnlExtra(root); } catch (e) {} });
      mo.observe(el, {childList:true}); try { pnlExtra(root); } catch (e) {}
      const u = this.unmount; this.unmount = () => { mo.disconnect(); u && u.call(this); };
    };
    return pg;
  };
}
})();
