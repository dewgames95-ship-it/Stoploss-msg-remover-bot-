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
  {k:"BSC", n:"BNB Smart Chain (BEP20)", fee:0.15, min:1, eta:1, re:EVM, ex:"0x…"},
  {k:"TRX", n:"Tron (TRC20)", fee:0.5, min:1, eta:1, re:/^T[1-9A-HJ-NP-Za-km-z]{33}$/, ex:"T…"},
  {k:"ETH", n:"Ethereum (ERC20)", fee:0.8, min:1, eta:3, re:EVM, ex:"0x…"},
  {k:"APT", n:"Aptos", fee:0.01, min:1, eta:1, re:/^0x[a-fA-F0-9]{1,64}$/, ex:"0x…"},
  {k:"TON", n:"TON", fee:0.15, min:1, eta:1, re:/^[UE]Q[A-Za-z0-9_-]{46}$/, ex:"UQ…"},
  {k:"POL", n:"Polygon", fee:0.5, min:1, eta:5, re:EVM, ex:"0x…"},
  {k:"SOL", n:"Solana", fee:0.5, min:1, eta:1, re:B58, ex:"base58"},
  {k:"ARB", n:"Arbitrum One", fee:0.3, min:1, eta:2, re:EVM, ex:"0x…"},
  {k:"OP", n:"Optimism", fee:0.3, min:1, eta:2, re:EVM, ex:"0x…"}
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
  const minOf = n => { if (isU) return 1; const p = (window.M && M.get(coin + "USDT") || {}).price; return p > 0 ? Math.ceil(1 / p * Math.pow(10, DP)) / Math.pow(10, DP) : n.min; };   /* v7.1: minimum = 1 USDT value */
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
      $("#wav").textContent = fmt(avail(), DP) + " " + coin; A.placeholder = "Min. " + (n ? fnum(minOf(n)) : "--");
      $("#wnn").textContent = n ? n.n : "Select Network"; $("#wnn").classList.toggle("ph", !n);
      $("#wrc").textContent = n && v > 0 ? fmt(Math.max(0, v - n.fee), DP) + " " + coin : "-- " + coin;
      $("#wfe").textContent = "Fee: " + (n ? fnum(n.fee) : "--") + " " + coin;
    };
    const setErr = (id, m) => { $(id).textContent = m || ""; };
    function netSheet(){
      U.sheet("Select withdrawal network", `<div class="wd-warn">${ic("info",16,2)}<span>Please ensure you select the same network on ${esc(window.CONFIG.APP_NAME)} and the receiving platform to avoid loss of assets.</span></div>${nets.map(n => `<button class="wd-net ${st.net && st.net.k === n.k ? "on" : ""}" data-k="${n.k}"><b>${esc(n.n)}</b><span>Fee: ${fnum(n.fee)} ${coin} (&lt; $${Math.max(1, n.fee).toFixed(2)})</span><span>Minimum withdrawal: ${fnum(minOf(n))} ${coin}${isU ? "" : " (≈ 1 USDT)"}</span><span>Est. arrival time ≈ ${n.eta} min</span></button>`).join("")}`, el => {
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
      else if (n && v < minOf(n) - 1e-9){ setErr("#e3", `Minimum withdrawal is ${fnum(minOf(n))} ${coin}` + (isU ? "" : " (≈ 1 USDT)")); bad = true; }
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
    <div class="pnx-g"><div><span>Total fees paid</span><b class="num">${money(v.fees)} USDT</b></div><div><span>Avg fee</span><b class="num">${tot > 0 ? (v.fees / (v.fut + v.spot + v.opt || 1) * 100).toFixed(3) : "0.000"}%</b></div></div>
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

/* ===== v7.1 Assets extras: AI action icon, dust -> USDT sheet, Prediction / Money Game / CFD tabs ===== */
(function(){
const {esc, ic, store, bus, money, fmt, toast} = U;
const S = () => store.s;
const cls = v => v >= 0 ? "up" : "down";
const sg = v => (v >= 0 ? "+$" : "-$") + money(Math.abs(v));
const sp = v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
const z0 = v => Math.abs(v) < .005 ? 0 : v;
const cents = p => { const v = (+p || 0) * 100; return (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1)) + "¢"; };

UI.aiIcon = (z = 20) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5l1.9 5.4 5.4 1.9-5.4 1.9L10 18.1l-1.9-5.4L2.7 10.8l5.4-1.9z"/><path d="M18.5 3v4M16.5 5h4M18.5 15.5v4M16.5 17.5h4"/></svg>`;

/* ---------- Convert crypto dust (< 1 USDT) into USDT ---------- */
UI.dustSheet = function(done){
  const dust = () => { try { return (window.SPOT && SPOT.holdings() || []).filter(h => h.price > 0 && h.value > 0 && h.value < 1 && h.avail > 0); } catch { return []; } };
  let list = dust(); const sel = new Set(list.map(h => h.coin));
  const FEE = .001;
  U.sheet("Convert dust to USDT", `<div class="as-dust-sh" id="dsb"></div>`, el => {
    const draw = () => {
      const box = el.querySelector("#dsb"); if (!box) return;
      if (!list.length){ box.innerHTML = `<div class="px-empty">${ic("check",28,1.5)}<p>No small balances to convert.<br>Coins worth less than 1 USDT show up here.</p></div>`; return; }
      const tot = list.filter(h => sel.has(h.coin)).reduce((a, h) => a + h.avail * h.price * (1 - FEE), 0);
      box.innerHTML = `<div class="ds-note">Balances under 1 USDT, converted at the live price (0.1% fee).</div>
        ${list.map(h => `<label class="ds-r"><input type="checkbox" data-c="${esc(h.coin)}" ${sel.has(h.coin) ? "checked" : ""}><i></i>${UI.coinImg(h.coin, 30)}<div class="grow"><b>${esc(h.coin)}</b><span class="num">${fmt(h.avail, 6)}</span></div><div class="r"><b class="num">≈ ${money(h.avail * h.price)}</b><span>USDT</span></div></label>`).join("")}
        <div class="ds-tot"><span>You receive</span><b class="num">≈ ${money(tot)} USDT</b></div>
        <button class="px-btn pri blk lg" data-ok ${sel.size ? "" : "disabled"}>Convert ${sel.size ? sel.size + " coin" + (sel.size > 1 ? "s" : "") : ""}</button>`;
      box.querySelectorAll("[data-c]").forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.c) : sel.delete(c.dataset.c); draw(); });
      box.querySelector("[data-ok]").onclick = () => {
        const s = S(), spot = s.spot || (s.spot = {hold:{}, orders:[], history:[]}); spot.hold ||= {}; spot.history ||= [];
        let got = 0, n = 0;
        list.filter(h => sel.has(h.coin)).forEach(h => {
          const hd = spot.hold[h.coin]; if (!hd) return;
          const px = (window.M && M.get(h.sym)?.price) || h.price, q = Math.min(h.avail, hd.qty);
          if (!(px > 0) || !(q > 0)) return;
          const ac = hd.cost / hd.qty; hd.cost = Math.max(0, hd.cost - ac * q); hd.qty -= q; if (hd.qty < 1e-9) delete spot.hold[h.coin];
          got += q * px * (1 - FEE); n++;
          spot.history.unshift({id:U.uid(), sym:h.sym, side:"sell", price:px, qty:q, fee:q * px * FEE, ts:Date.now(), type:"dust"});
        });
        if (!n) return toast("Price unavailable, try again", "bad");
        spot.history = spot.history.slice(0, 200);
        store.addWallet("spot", Math.round(got * 1e6) / 1e6, "dust");
        store.save(); bus.emit("spot"); U.fx("claim"); U.closeLayer();
        toast(`Converted ${n} coin${n > 1 ? "s" : ""} to ${money(got)} USDT`, "ok"); done && done();
      };
    };
    draw();
  });
};

/* ---------- Prediction / Money Game / CFD tabs ---------- */
const PRODS = {
  pred:{label:"Prediction Account", wallet:"predict", name:"Prediction", href:"#/predict"},
  game:{label:"Money Game Account", wallet:"games", name:"Money Game", href:"#/racer"},
  cfd:{label:"CFD Trade Account", wallet:"cfd", name:"CFD Trade", href:"#/cfd"}
};
let lastBooks = 0;
function predData(){ try { if (window.PRED){ PRED.stats(); return PRED._data(); } } catch {} return {positions:[], orders:[], history:[]}; }
const pVal = p => (+p.shares || 0) * (+(p.last ?? p.avg) || 0);
function cfdData(){
  try {
    const C = window.CFD; if (!C) return {positions:[], history:[]};
    const d = (typeof C.data === "function" ? C.data() : null) || {};
    const pos = typeof C.positions === "function" ? C.positions() : (d.positions || d.open || []);
    const hist = typeof C.history === "function" ? C.history() : (d.history || d.closed || []);
    return {positions: Array.isArray(pos) ? pos : [], history: Array.isArray(hist) ? hist : []};
  } catch { return {positions:[], history:[]}; }
}
const cfdPnl = p => +(p.pnl ?? p.upnl ?? p.unrealized ?? 0) || 0;
const racerData = () => { try { return window.RACER ? RACER.data() : {bets:[], pending:null}; } catch { return {bets:[], pending:null}; } };

UI.assetsProdInfo = function(tab){
  const P = PRODS[tab]; if (!P) return null;
  const w = store.wb(P.wallet); let val = w, pnl = 0;
  if (tab === "pred"){ const d = predData(); val += d.positions.reduce((a, p) => a + pVal(p), 0); pnl = d.positions.reduce((a, p) => a + pVal(p) - p.cost, 0); }
  if (tab === "game"){ const pe = racerData().pending; if (pe && +pe.amount) val += +pe.amount; }
  if (tab === "cfd"){ const d = cfdData(); pnl = d.positions.reduce((a, p) => a + cfdPnl(p), 0); val += pnl; }
  return {label:P.label, val, pnl: tab === "game" ? null : pnl, cost: val - pnl};
};

UI.assetsProd = function(tab, H){
  const P = PRODS[tab], w = store.wb(P.wallet);
  const head = `<div class="as-pw"><div><span>${P.name} wallet</span><b class="num">${H(money(w))} <small>USDT</small></b></div><div class="as-pb"><button class="px-btn sm" data-wl="${P.wallet}">Transfer</button><a class="px-btn sm pri" href="${P.href}">Trade</a></div></div>`;
  const sec = (t, right) => `<div class="px-sec-h" style="margin-top:16px"><h2>${t}</h2>${right || ""}</div>`;
  const empty = (i, t) => `<div class="px-empty">${ic(i, 28, 1.5)}<p>${esc(t)}</p></div>`;
  let body = "";
  if (tab === "pred"){
    const d = predData();
    body = sec(`Live positions (${d.positions.length})`, `<a href="#/predict/portfolio">Portfolio</a>`) + (d.positions.length ? d.positions.map(p => {
      const v = pVal(p), pn = z0(v - p.cost), pc = p.cost ? pn / p.cost * 100 : 0, free = Math.max(0, (p.shares || 0) - (p.locked || 0));
      return `<div class="as-pc"><div class="t"><b>${esc(p.q || p.title || "Market")}</b><em class="${p.oi ? "no" : "yes"}">${esc(p.outcome || "")}</em></div>
        <div class="g"><div><span>Shares</span><b class="num">${fmt(p.shares, 2)}</b></div><div><span>Avg / Now</span><b class="num">${cents(p.avg)} / ${cents(p.shares ? v / p.shares : 0)}</b></div><div><span>Value</span><b class="num">${H("$" + money(v))}</b></div><div><span>PnL</span><b class="num ${cls(pn)}">${H(sg(pn) + " (" + sp(pc) + ")")}</b></div></div>
        <div class="b"><button class="px-btn sm dn" data-psell="${esc(p.token)}" ${free > 0 ? "" : "disabled"}>Sell</button><a class="px-btn sm" href="#/predict/m/${encodeURIComponent(p.slug || p.eid || "")}/${encodeURIComponent(p.mid || "")}">Modify</a></div></div>`; }).join("") : empty("predict", "No open positions"));
    if (d.orders.length) body += sec(`Open orders (${d.orders.length})`) + d.orders.map(o => `<div class="as-pc"><div class="t"><b>${esc(o.q || o.title || "Market")}</b><em class="${o.oi ? "no" : "yes"}">${esc(o.side || "")} ${esc(o.outcome || "")}</em></div><div class="g"><div><span>Shares</span><b class="num">${fmt(o.shares, 2)}</b></div><div><span>Limit</span><b class="num">${cents(o.price)}</b></div></div><div class="b"><button class="px-btn sm" data-pcancel="${esc(o.id)}">Cancel</button></div></div>`).join("");
    const hs = d.history.slice(0, 8);
    body += sec("History", `<a href="#/predict/portfolio">All</a>`) + (hs.length ? hs.map(h => `<div class="px-row"><span class="px-ico n">${ic(h.kind === "won" ? "check" : "predict", 16)}</span><div class="grow"><b>${esc(String(h.kind || "").replace(/^./, c => c.toUpperCase()))} ${esc(h.outcome || "")}</b><div class="px-mut as-ell">${esc(h.q || h.title || "")}</div></div><div class="r"><b class="num ${h.pnl != null ? cls(h.pnl) : ""}">${h.pnl != null ? H(sg(h.pnl)) : H("$" + money(h.amount || 0))}</b><span class="px-mut">${U.dateStr ? U.dateStr(h.t) : ""}</span></div></div>`).join("") : empty("file", "No history yet"));
  } else if (tab === "game"){
    const d = racerData(), pe = d.pending, bets = (d.bets || []).slice().reverse().slice(0, 12);
    body = sec("Active bet") + (pe && +pe.amount ? `<div class="as-pc"><div class="t"><b>Race in progress</b><em class="yes">Live</em></div><div class="g"><div><span>Stake</span><b class="num">${H("$" + money(+pe.amount))}</b></div><div><span>Multiplier</span><b class="num">${pe.mult ? "x" + (+pe.mult).toFixed(2) : "--"}</b></div></div><div class="b"><a class="px-btn sm pri" href="#/racer">Open Money Game</a></div></div>` : empty("car", "No active bet"));
    body += sec("History", `<a href="#/racer">Open game</a>`) + (bets.length ? bets.map(b => { const pn = (b.win ? +b.payout || 0 : b.refunded ? 0 : 0) - (b.refunded ? 0 : +b.amount || 0);
      return `<div class="px-row"><span class="px-ico n">${ic("car", 16)}</span><div class="grow"><b>${b.win ? "Won" : b.refunded ? "Refunded" : "Lost"}${b.mult ? " · x" + (+b.mult).toFixed(2) : ""}</b><div class="px-mut">Stake ${H("$" + money(+b.amount || 0))}</div></div><div class="r"><b class="num ${cls(pn)}">${H(sg(pn))}</b><span class="px-mut">${U.dateStr && b.t ? U.dateStr(b.t) : ""}</span></div></div>`; }).join("") : empty("file", "No bets yet"));
  } else {
    const d = cfdData();
    body = sec(`Live positions (${d.positions.length})`) + (d.positions.length ? d.positions.map(p => { const pn = cfdPnl(p), sym = p.sym || p.symbol || p.pair || "CFD", side = String(p.side || p.dir || "").toLowerCase();
      return `<div class="as-pc"><div class="t"><b>${esc(sym)}</b><em class="${/sell|short/.test(side) ? "no" : "yes"}">${esc(side || "position")}</em></div><div class="g"><div><span>Size</span><b class="num">${esc(String(p.size ?? p.qty ?? p.lots ?? p.units ?? "--"))}</b></div><div><span>Entry</span><b class="num">${esc(String(p.entry ?? p.open ?? p.price ?? "--"))}</b></div><div><span>PnL</span><b class="num ${cls(pn)}">${H(sg(pn))}</b></div></div><div class="b">${window.CFD && typeof CFD.close === "function" ? `<button class="px-btn sm dn" data-cclose="${esc(p.id)}">Close</button>` : ""}<a class="px-btn sm" href="#/cfd">Modify</a></div></div>`; }).join("") : empty("candle", "No open positions"));
    const hs = d.history.slice(0, 8);
    body += sec("History") + (hs.length ? hs.map(h => { const pn = +(h.pnl ?? h.profit ?? 0) || 0; return `<div class="px-row"><span class="px-ico n">${ic("candle", 16)}</span><div class="grow"><b>${esc(h.sym || h.symbol || "CFD")}</b><div class="px-mut">${esc(String(h.side || ""))}</div></div><div class="r"><b class="num ${cls(pn)}">${H(sg(pn))}</b><span class="px-mut">${U.dateStr && (h.closed || h.t) ? U.dateStr(h.closed || h.t) : ""}</span></div></div>`; }).join("") : empty("file", "No history yet"));
  }
  return head + body;
};

UI.assetsProdBind = function(box, tab, rerender){
  if (tab === "pred"){
    box.querySelectorAll("[data-psell]").forEach(b => b.onclick = async () => {
      const p = (predData().positions || []).find(x => x.token === b.dataset.psell); if (!p) return;
      const free = Math.max(0, (p.shares || 0) - (p.locked || 0)), px = +(p.last ?? p.avg) || .5;
      const ok = await U.confirmBox("Sell position", `Sell ${fmt(free, 2)} ${p.outcome || ""} shares at about ${cents(px)}?`, "Sell"); if (!ok) return;
      try { const r = await API.call("predict.sell", {token:p.token, shares:free, price:px}); U.fx("close"); toast(`Sold for $${money((r.fill || {}).amount || 0)}`, "ok"); }
      catch (e) { toast(e.message || "Could not sell", "bad"); }
      rerender();
    });
    box.querySelectorAll("[data-pcancel]").forEach(b => b.onclick = async () => {
      try { const r = await API.call("predict.cancel", {id:b.dataset.pcancel}); U.fx("close"); toast("Order cancelled" + (r.refund ? ": $" + money(r.refund) + " returned" : ""), "ok"); }
      catch (e) { toast(e.message || "Could not cancel", "bad"); }
      rerender();
    });
    /* refresh live prices once in a while (order books of the held tokens) */
    if (Date.now() - lastBooks > 20000){ lastBooks = Date.now(); try { const tk = predData().positions.map(p => p.token); if (tk.length) PRED._internal.loadBooks(tk).then(() => { if (box.isConnected) rerender(); }).catch(() => {}); } catch {} }
  }
  if (tab === "cfd") box.querySelectorAll("[data-cclose]").forEach(b => b.onclick = async () => {
    try { await CFD.close(b.dataset.cclose); U.fx("close"); toast("Position closed", "ok"); } catch (e) { toast((e && e.message) || "Could not close", "bad"); }
    rerender();
  });
};
})();
