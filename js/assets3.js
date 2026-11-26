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
const fnum = v => fmt(v, v > 0 && v < 1 ? 6 : 2).replace(/\.?0+$/, m => m.includes(".") ? "" : m);
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

/* ---------- Other coins (network lists) + QR scanner for deposit addresses ---------- */
const mk = (k, n, fam, fee, min, eta, re, ex) => ({k, n, fam, fee, min, eta, re, ex});
const RE = {evm:EVM, trx:/^T[1-9A-HJ-NP-Za-km-z]{33}$/, sol:B58, ton:/^[UE]Q[A-Za-z0-9_-]{46}$/, btc:/^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/, ltc:/^(ltc1[a-z0-9]{25,60}|[LM][a-km-zA-HJ-NP-Z1-9]{26,33})$/, doge:/^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/, xrp:/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/};
const FAM = {BSC:"evm", TRX:"trx", ETH:"evm", APT:"apt", TON:"ton", POL:"evm", SOL:"sol", ARB:"evm", OP:"evm"};
NETS.forEach(n => { n.fam = FAM[n.k]; });
const COIN_NETS = {
  BTC:[mk("BTC", "Bitcoin", "btc", .0002, .001, 20, RE.btc, "bc1…")],
  ETH:[mk("ETH", "Ethereum (ERC20)", "evm", .002, .01, 3, EVM, "0x…"), mk("ARB", "Arbitrum One", "evm", .0001, .005, 2, EVM, "0x…"), mk("OP", "Optimism", "evm", .0001, .005, 2, EVM, "0x…"), mk("BSC", "BNB Smart Chain (BEP20)", "evm", .0005, .005, 1, EVM, "0x…")],
  BNB:[mk("BSC", "BNB Smart Chain (BEP20)", "evm", .0005, .01, 1, EVM, "0x…")],
  SOL:[mk("SOL", "Solana", "sol", .01, .05, 1, B58, "base58")],
  XRP:[mk("XRP", "XRP Ledger", "xrp", .25, 1, 1, RE.xrp, "r…")],
  TRX:[mk("TRX", "Tron (TRC20)", "trx", 1, 5, 1, RE.trx, "T…")],
  DOGE:[mk("DOGE", "Dogecoin", "doge", 4, 20, 10, RE.doge, "D…")],
  LTC:[mk("LTC", "Litecoin", "ltc", .001, .01, 10, RE.ltc, "ltc1…")],
  TON:[mk("TON", "TON", "ton", .05, .5, 1, RE.ton, "UQ…")]
};
const netsOf = c => c === "USDT" ? NETS : (COIN_NETS[c] || []);
const WD_COINS = ["USDT", ...Object.keys(COIN_NETS)];
const dpOf = c => c === "USDT" ? 2 : c === "BTC" ? 6 : c === "ETH" ? 5 : c === "DOGE" || c === "XRP" || c === "TRX" ? 2 : 4;
const coinAvail = c => { try { const h = (window.SPOT && SPOT.holdings() || []).find(x => x.coin === c); return h ? (+h.avail || 0) : 0; } catch { return 0; } };
const FAM_DEFAULT = {btc:"BTC", ltc:"LTC", doge:"DOGE", xrp:"XRP", trx:"TRX", evm:"ETH", sol:"SOL", ton:"TON"};
const SCHEMES = {bitcoin:["BTC","btc"], litecoin:["LTC","ltc"], dogecoin:["DOGE","doge"], ripple:["XRP","xrp"], xrp:["XRP","xrp"], solana:["SOL","sol"], tron:["TRX","trx"], ton:["TON","ton"], ethereum:[null,"evm"], binancesmartchain:["BNB","evm"], bnb:["BNB","evm"]};
const CHAIN_ID = {1:"ETH", 56:"BSC", 137:"POL", 42161:"ARB", 10:"OP"};
/* text -> {fam, coin?, net?, addr} or null (only crypto deposit addresses are accepted) */
function detectAddr(raw){
  let t = String(raw || "").trim(); if (!t || t.length > 600) return null;
  let coin = null, net = null, fam = null, addr = t;
  const m = t.match(/^([a-z]{3,20}):(?:\/\/)?([^?]*)(?:\?(.*))?$/i);
  if (m && SCHEMES[m[1].toLowerCase()]){
    const sc = SCHEMES[m[1].toLowerCase()]; coin = sc[0]; fam = sc[1]; addr = m[2]; const q = new URLSearchParams(m[3] || "");
    const at = addr.match(/^(.+?)@(\d+)(?:\/.*)?$/); if (at){ addr = at[1]; net = CHAIN_ID[at[2]] || null; }
    addr = addr.replace(/\/.*$/, "");
    if (q.get("address") && /^0x/i.test(q.get("address"))) addr = q.get("address");
  } else if (/^[a-z]+:/i.test(t)) return null;
  addr = addr.trim();
  if (!fam){ fam = RE.ton.test(addr) ? "ton" : RE.trx.test(addr) ? "trx" : RE.btc.test(addr) ? "btc" : RE.ltc.test(addr) ? "ltc" : RE.doge.test(addr) ? "doge" : RE.xrp.test(addr) ? "xrp" : EVM.test(addr) ? "evm" : B58.test(addr) ? "sol" : null; }
  if (!fam || !RE[fam] || !RE[fam].test(addr)) return null;
  return {fam, coin, net, addr};
}
let qrLib = null;
function loadQR(){
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (qrLib) return qrLib;
  const urls = ["https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js", "https://unpkg.com/jsqr@1.4.0/dist/jsQR.js"];
  const tryUrl = i => new Promise((res, rej) => { if (i >= urls.length) return rej(new Error("qr lib")); const s = document.createElement("script"); s.src = urls[i]; s.async = true; s.onload = () => window.jsQR ? res(window.jsQR) : tryUrl(i + 1).then(res, rej); s.onerror = () => { s.remove(); tryUrl(i + 1).then(res, rej); }; document.head.appendChild(s); });
  qrLib = tryUrl(0).catch(e => { qrLib = null; throw e; });
  return qrLib;
}
function scanHelp(title, lead){
  U.sheet(title || "This QR code cannot be used", `<div class="sc-help"><p>${esc(lead || "The scanner only reads crypto deposit addresses.")}</p>
    <ul><li><b>Bitcoin</b> address or <code>bitcoin:</code> link</li><li><b>Ethereum / EVM</b> (ERC20, BEP20, Arbitrum, Optimism, Polygon) <code>0x…</code> address or <code>ethereum:</code> link</li><li><b>Tron</b> (TRC20) address starting with <code>T</code></li><li><b>Solana</b>, <b>XRP</b>, <b>TON</b>, <b>Litecoin</b>, <b>Dogecoin</b> addresses</li></ul>
    <p>Websites, payment requests, contacts and other QR codes are not supported.</p><button class="btn btn-primary sc-ok" data-ok type="button">Got it</button></div>`, el => { el.querySelector("[data-ok]").onclick = () => U.closeLayer(); });
}
function openScanner(onAddr){
  let stream = null, raf = 0, alive = true, busy = false, qr = null;
  const stop = () => { alive = false; cancelAnimationFrame(raf); if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; } };
  const done = txt => { const d = detectAddr(txt); stop(); U.closeLayer(); if (!d) return setTimeout(() => scanHelp(), 260); U.buzz && U.buzz(); setTimeout(() => onAddr(d), 120); };
  U.sheet("Scan QR code", `<div class="sc"><div class="sc-v"><video id="scV" playsinline muted></video><div class="sc-fr"><i></i><i></i><i></i><i></i></div><div class="sc-ph" id="scP">${ic("qr", 40, 1.4)}<span>Camera is off</span></div></div>
    <p class="sc-m" id="scM">Point the camera at a crypto deposit address QR code.</p>
    <div class="sc-a"><button class="btn btn-primary" data-cam type="button">Open camera</button><button class="btn btn-ghost" data-gal type="button">Upload from gallery</button></div>
    <input type="file" id="scF" accept="image/*" hidden><p class="sc-n">Only crypto deposit addresses can be scanned: BTC, ETH and EVM networks, TRON, SOL, XRP, TON, LTC, DOGE.</p></div>`, el => {
    const msg = (t, bad) => { const m = el.querySelector("#scM"); m.textContent = t; m.classList.toggle("bad", !!bad); };
    const decode = (img, w, h, both) => { const r = qr(img, w, h, {inversionAttempts: both ? "attemptBoth" : "dontInvert"}); return r && r.data; };
    async function startCam(){
      msg("Opening camera…");
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error("nocam"), {name:"NotSupportedError"});
        qr = await loadQR();
        stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}, audio:false});
        if (!alive){ stop(); return; }
        const v = el.querySelector("#scV"); v.srcObject = stream; await v.play().catch(() => {});
        el.querySelector("#scP").hidden = true; el.querySelector("[data-cam]").hidden = true; msg("Scanning… hold the code inside the frame.");
        const c = document.createElement("canvas"), x = c.getContext("2d", {willReadFrequently:true}); let last = 0;
        const loop = ts => { if (!alive) return; raf = requestAnimationFrame(loop);
          if (ts - last < 130 || !v.videoWidth || busy) return; last = ts;
          const sc = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight)); c.width = Math.round(v.videoWidth * sc); c.height = Math.round(v.videoHeight * sc);
          x.drawImage(v, 0, 0, c.width, c.height); const t = decode(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height, false); if (t){ busy = true; done(t); } };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        stop(); alive = true;
        const n = e && e.name;
        msg(n === "NotAllowedError" || n === "SecurityError" ? "Camera permission was denied. Allow camera access in your device settings, or upload a QR image from your gallery." : n === "NotFoundError" || n === "NotSupportedError" ? "No camera is available. Upload a QR image from your gallery instead." : /qr lib/.test(String(e && e.message)) ? "The scanner could not load. Check your connection and try again." : "Could not open the camera. Upload a QR image from your gallery instead.", true);
      }
    }
    el.querySelector("[data-cam]").onclick = startCam;
    el.querySelector("[data-gal]").onclick = () => el.querySelector("#scF").click();
    el.querySelector("#scF").onchange = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      msg("Reading image…");
      try {
        qr = await loadQR();
        const bm = await (window.createImageBitmap ? createImageBitmap(f) : new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(f); }));
        const W = bm.width || bm.naturalWidth, H = bm.height || bm.naturalHeight, sc = Math.min(1, 1400 / Math.max(W, H)), c = document.createElement("canvas"); c.width = Math.round(W * sc); c.height = Math.round(H * sc);
        const x = c.getContext("2d", {willReadFrequently:true}); x.drawImage(bm, 0, 0, c.width, c.height);
        const t = decode(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height, true);
        if (!t) return msg("No QR code was found in this image. Try a sharper, closer picture.", true);
        done(t);
      } catch (err) { msg("Could not read this image. Try a different one.", true); }
    };
    setTimeout(() => { if (alive) startCam(); }, 150);
  }, stop);
}

function scanToWithdraw(d){
  const c = d.coin && WD_COINS.includes(d.coin) ? d.coin : (["trx","evm","sol","ton"].includes(d.fam) ? "USDT" : FAM_DEFAULT[d.fam]);
  const list = netsOf(c).filter(n => n.fam === d.fam), hint = d.net && list.find(n => n.k === d.net), pick = hint || (list.length === 1 ? list[0] : null);
  try { sessionStorage.setItem("wd_scan", JSON.stringify({addr:d.addr, net:pick ? pick.k : "", coin:c, fam:d.fam, t:Date.now()})); } catch {}
  location.hash = "#/withdraw/" + c;
}
window.WDSCAN = {open: cb => openScanner(cb || scanToWithdraw), detect: detectAddr};
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
    r.addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; if (!WD_COINS.includes(b.dataset.c)) return toast(b.dataset.c + " withdrawals are not available yet", "info"); location.hash = "#/withdraw/" + b.dataset.c; });
  }};
}

function chainPage(coin){
  const isU = coin === "USDT", nets = netsOf(coin), DP = dpOf(coin), K = Math.pow(10, DP), st = {net:null, from:{funding:isU, spot:true}};
  const fundB = () => isU ? fundBal() : 0, spotB = () => isU ? spotBal() : coinAvail(coin);
  const avail = () => (st.from.funding ? fundB() : 0) + (st.from.spot ? spotB() : 0);
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
    <label class="wd-ac" ${isU ? "" : "hidden"}><input type="checkbox" data-a="funding" checked><i></i><span>Funding Account</span><b class="num" id="wfb">${fmt(fundB(), DP)} ${coin}</b></label>
    <label class="wd-ac"><input type="checkbox" data-a="spot" checked><i></i><span>Spot Account</span><b class="num" id="wsb">${fmt(spotB(), DP)} ${coin}</b></label>
    <button class="wd-rm" type="button" data-rm>Remarks ${ic("chevd",16,2)}</button><textarea id="wrm" class="wd-rt" hidden rows="2" maxlength="60" placeholder="Optional note"></textarea>
    <p class="wd-note">Always check the address and network before you confirm. Withdrawals to a wrong network cannot be recovered.</p></div>
    <div class="wd-bar"><div><b class="num" id="wrc">-- ${coin}</b><span id="wfe">Fee: -- ${coin}</span></div><button class="btn btn-primary wd-go" id="wgo">Withdraw</button></div>`;
  return {html, title:coin + " On-chain", mount(r){
    document.body.classList.add("no-nav");
    const $ = q => r.querySelector(q), A = $("#wam"), AD = $("#wad");
    const upd = () => {
      const n = st.net, v = +A.value || 0;
      $("#wav").textContent = fmt(avail(), DP) + " " + coin; A.placeholder = "Min. " + (n ? fnum(n.min) : "--");
      $("#wnn").textContent = n ? n.n : "Select Network"; $("#wnn").classList.toggle("ph", !n);
      $("#wrc").textContent = n && v > 0 ? fmt(Math.max(0, v - n.fee), DP) + " " + coin : "-- " + coin;
      $("#wfe").textContent = "Fee: " + (n ? fnum(n.fee) : "--") + " " + coin;
    };
    const setErr = (id, m) => { $(id).textContent = m || ""; };
    function netSheet(){
      U.sheet("Select withdrawal network", `<div class="wd-warn">${ic("info",16,2)}<span>Please ensure you select the same network on ${esc(window.CONFIG.APP_NAME)} and the receiving platform to avoid loss of assets.</span></div>${nets.map(n => `<button class="wd-net ${st.net && st.net.k === n.k ? "on" : ""}" data-k="${n.k}"><b>${esc(n.n)}</b><span>Fee: ${fnum(n.fee)} ${coin} (&lt; $${Math.max(1, n.fee).toFixed(2)})</span><span>Minimum withdrawal: ${fnum(n.min)} ${coin}</span><span>Est. arrival time ≈ ${n.eta} min</span></button>`).join("")}`, el => {
        el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { st.net = nets.find(x => x.k === b.dataset.k); U.closeLayer(); setErr("#e2"); upd(); });
      });
    }
    $("#wnet").onclick = netSheet;
    $("[data-wh]").onclick = wdHistory;
    $("[data-rm]").onclick = () => { const t = $("#wrm"); t.hidden = !t.hidden; if (!t.hidden) t.focus(); };
    $("[data-all]").onclick = () => { A.value = Math.floor(avail() * K) / K || ""; setErr("#e3"); upd(); };
    $("[data-paste]").onclick = async () => { try { AD.value = (await navigator.clipboard.readText()).trim(); setErr("#e1"); } catch { toast("Clipboard unavailable. Paste into the field manually.", "info"); } };
    const chooseNet = (list, cb) => U.sheet("Select network", `<div class="wd-warn">${ic("info",16,2)}<span>This address format works on several networks. Select the network the sender uses.</span></div>${list.map(n => `<button class="wd-net" data-k="${n.k}"><b>${esc(n.n)}</b><span>Fee: ${fnum(n.fee)} ${coin}</span></button>`).join("")}`, el => el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { U.closeLayer(); cb(list.find(x => x.k === b.dataset.k)); }));
    const applyScan = d => {
      let c = d.coin && WD_COINS.includes(d.coin) ? d.coin : null;
      const fits = cc => netsOf(cc).filter(n => n.fam === d.fam);
      if (!c) c = fits(coin).length ? coin : (fits("USDT").length && coin === "USDT" ? "USDT" : (FAM_DEFAULT[d.fam] || "USDT"));
      let list = fits(c); if (!list.length){ c = FAM_DEFAULT[d.fam]; list = c ? fits(c) : []; }
      if (!list.length) return scanHelp();
      const hint = d.net && list.find(n => n.k === d.net), pick = hint || (list.length === 1 ? list[0] : null);
      if (c !== coin){ try { sessionStorage.setItem("wd_scan", JSON.stringify({addr:d.addr, net:pick ? pick.k : "", coin:c, fam:d.fam, t:Date.now()})); } catch {} toast("Switched to " + c + " from the scanned address", "ok"); location.hash = "#/withdraw/" + c; return; }
      AD.value = d.addr; setErr("#e1"); toast("Address scanned", "ok");
      if (pick){ st.net = pick; setErr("#e2"); upd(); } else chooseNet(list, n => { st.net = n; setErr("#e2"); upd(); });
    };
    $("[data-scan]").onclick = () => openScanner(applyScan);
    try { const pd = JSON.parse(sessionStorage.getItem("wd_scan") || "null"); sessionStorage.removeItem("wd_scan"); if (pd && pd.coin === coin && Date.now() - pd.t < 15000) setTimeout(() => applyScan({addr:pd.addr, fam:pd.fam, coin:pd.coin, net:pd.net || null}), 60); } catch {}
    r.querySelectorAll("[data-a]").forEach(c => c.onchange = () => { st.from[c.dataset.a] = c.checked; upd(); });
    A.oninput = () => { setErr("#e3"); upd(); }; AD.oninput = () => setErr("#e1");
    $("#wgo").onclick = () => {
      const n = st.net, v = Math.round((+A.value) * K) / K, ad = AD.value.trim(); let bad = false;
      if (!ad){ setErr("#e1", "Enter a withdrawal address"); bad = true; }
      if (!n){ setErr("#e2", "Select a network"); bad = true; }
      else if (ad && !n.re.test(ad)){ setErr("#e1", `Invalid ${n.n} address format`); bad = true; }
      if (!(v > 0)){ setErr("#e3", "Enter an amount"); bad = true; }
      else if (n && v < n.min){ setErr("#e3", `Minimum withdrawal is ${fnum(n.min)} ${coin}`); bad = true; }
      else if (n && v <= n.fee){ setErr("#e3", "Amount must be greater than the fee"); bad = true; }
      else if (v > avail() + 1e-9){ setErr("#e3", "Insufficient balance in the selected accounts"); bad = true; }
      if (bad) return U.fx("err");
      const rcv = Math.round((v - n.fee) * K) / K;
      U.sheet("Confirm withdrawal", `<div class="wd-cf"><div><span>Network</span><b>${esc(n.n)}</b></div><div><span>Address</span><b class="mono">${esc(ad)}</b></div><div><span>Amount</span><b class="num">${fmt(v, DP)} ${coin}</b></div><div><span>Fee</span><b class="num">${fnum(n.fee)} ${coin}</b></div><div><span>Receive amount</span><b class="num">${fmt(rcv, DP)} ${coin}</b></div><div><span>Est. arrival</span><b>≈ ${n.eta} min</b></div></div>
        <button class="btn btn-primary wd-cfm" data-ok>Confirm withdrawal</button>`, el => {
        el.querySelector("[data-ok]").onclick = () => {
          if (v > avail() + 1e-9) return toast("Insufficient balance", "bad");
          if (!isU){ const hs = S().spot && S().spot.hold && S().spot.hold[coin]; if (hs){ const fr = Math.min(1, v / (hs.qty || 1)); hs.cost = (hs.cost || 0) * (1 - fr); hs.qty = Math.max(0, hs.qty - v); if (hs.qty < 1e-9) delete S().spot.hold[coin]; store.save(); bus.emit("balance"); } }
          let rem = isU ? v : 0; ["funding","spot"].forEach(w => { if (!st.from[w] || rem <= 0) return; const take = Math.min(store.wb(w), rem); if (take > 0){ store.addWallet(w, -take, "withdraw"); rem = Math.round((rem - take) * K) / K; } });
          const id = U.uid();
          (S().tx ||= []).unshift({id, kind:"withdrawal", coin, amount:v, fee:n.fee, receive:rcv, method:n.n, addr:ad, note:$("#wrm").value.trim(), status:"Processing", t:Date.now(), done:Date.now() + 10000});
          store.save(); U.fx("claim"); U.closeLayer();
          toast(`Withdrawal submitted: ${fmt(v, DP)} ${coin}`, "ok");
          setTimeout(() => { if (settle() && r.isConnected) toast("Withdrawal completed", "ok"); }, 10200);
          location.hash = "#/assets/fund";
        };
      });
    };
    upd();
    const off = bus.on("balance", () => { $("#wfb").textContent = fmt(fundB(), DP) + " " + coin; $("#wsb").textContent = fmt(spotB(), DP) + " " + coin; upd(); });
    this.unmount = () => { off(); document.body.classList.remove("no-nav"); };
  }};
}
Pages.withdraw = (params) => { const c = String((params && params[0]) || "").toUpperCase(); return c ? chainPage(WD_COINS.includes(c) ? c : "USDT") : pickPage(); };

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
