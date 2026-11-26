/* v6.7 misc agent: desktop trading layout helper, display currency, quick actions, KYC, export */
(function(){
"use strict";
const DESK = window.matchMedia("(min-width:1100px)");

/* ---- desktop: docked charts (futures/spot) become part of the grid, so open + bind them once ---- */
function openDocks(){
  if (!DESK.matches) return;
  const v = document.getElementById("view"); if (!v) return;
  const sec = v.querySelector(".fxr > section.fxc, .sp > section.sp-chart");
  if (!sec || sec.classList.contains("open") || sec.dataset.deskOpened) return;
  sec.dataset.deskOpened = "1";
  const bar = sec.querySelector("[data-cch]"); if (!bar) return;
  let keep = null; try { keep = sessionStorage.getItem("fx_chart"); } catch(e){}
  bar.click();
  try { if (keep == null) sessionStorage.removeItem("fx_chart"); else sessionStorage.setItem("fx_chart", keep); } catch(e){}
  setTimeout(() => window.CH && CH.resize && CH.resize(), 120);
}
const later = () => { clearTimeout(later.t); later.t = setTimeout(openDocks, 160); };
window.addEventListener("hashchange", later);
window.addEventListener("resize", later);
const startObs = () => { const v = document.getElementById("view"); if (v) new MutationObserver(later).observe(v, {childList:true}); later(); };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startObs); else startObs();
})();

/* ===== Trade history export (CSV / PDF) ===== */
(function(){
"use strict";
const U = window.U, esc = U.esc, S = () => U.store.s;
const r2 = v => Math.round((+v || 0) * 1e8) / 1e8;
const num = (v, d = 2) => v == null || v === "" || isNaN(v) ? "" : (+v).toFixed(d);
const lbl = s => { try { const p = M.get(s); return p ? M.label(p) : s; } catch(e){ return s; } };
const pad = n => String(n).padStart(2, "0");
const stamp = t => { const d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); };
const COLS = ["Date", "Type", "Symbol", "Side", "Entry / Price", "Exit", "Size", "Fee (USDT)", "PnL (USDT)", "Result"];

function collect(range, type){
  const s = S(), from = range === "all" ? 0 : Date.now() - range * 864e5, out = [];
  (s.fut && s.fut.history || []).forEach(x => out.push({t:x.closed, c:["", "Futures", lbl(x.sym) + " Perp", (x.side === "long" ? "Long " : "Short ") + (x.lev || "") + "x", num(x.entry, 4), num(x.exit, 4), num(x.closedVol || x.maxQty, 6), num(x.fee, 4), num(x.profit, 2), x.reason || "Closed"]}));
  (s.history || []).forEach(x => out.push({t:x.closed, c:["", "Binary", lbl(x.sym), (x.dir === "up" ? "Up " : "Down ") + (x.expiry < 60 ? x.expiry + "s" : x.expiry / 60 + "m"), num(x.entry, 4), num(x.exit, 4), num(x.amount, 2), "", num(x.profit, 2), x.result || ""]}));
  (s.spot && s.spot.history || []).forEach(x => out.push({t:x.ts, c:["", "Spot", lbl(x.sym), x.side === "buy" ? "Buy" : "Sell", num(x.price, 4), "", num(x.qty, 6), num(x.fee, 4), "", x.type || ""]}));
  (s.opt && s.opt.history || []).forEach(x => out.push({t:x.closed, c:["", "Options", (x.base || "") + " " + (x.strike || "") + " " + (x.type || ""), x.type || "", num(x.cost && x.qty ? x.cost / x.qty : "", 4), num(x.settle, 2), num(x.qty, 4), "", num(x.pnl, 2), x.result || ""]}));
  const want = type === "all" ? null : type;
  return out.filter(r => r.t && r.t >= from && (!want || r.c[1].toLowerCase() === want)).sort((a, b) => b.t - a.t).map(r => { r.c[0] = stamp(r.t); return r.c; });
}
const csv = rows => "﻿" + [COLS, ...rows].map(r => r.map(v => { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(",")).join("\r\n");

/* minimal PDF writer: A4 landscape, Helvetica table */
function pdf(rows, title){
  const W = 842, H = 595, M0 = 36, RH = 17, widths = [112, 56, 118, 78, 82, 72, 70, 62, 62, 60];
  const enc = t => String(t == null ? "" : t).replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
  const per = Math.floor((H - 2 * M0 - 64) / RH) - 1, pages = Math.max(1, Math.ceil(rows.length / per));
  const objs = [];
  const add = s => (objs.push(s), objs.length);
  const catalog = add(""), tree = add(""), f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"), f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids = [];
  const sum = rows.reduce((a, r) => a + (parseFloat(r[8]) || 0), 0);
  for (let pg = 0; pg < pages; pg++){
    let c = "";
    const T = (x, y, t, bold, sz, col) => { c += `BT /F${bold ? 2 : 1} ${sz || 8} Tf ${col || "0.1 0.12 0.16"} rg ${x} ${y} Td (${enc(t)}) Tj ET\n`; };
    T(M0, H - M0 - 8, title, true, 15);
    T(M0, H - M0 - 24, `Generated ${stamp(Date.now())}  |  ${rows.length} records  |  Net PnL ${(sum >= 0 ? "+" : "") + sum.toFixed(2)} USDT  |  Page ${pg + 1}/${pages}`, false, 8, "0.4 0.45 0.5");
    let y = H - M0 - 52, x = M0;
    c += "0.93 0.94 0.96 rg " + M0 + " " + (y - 5) + " " + (W - 2 * M0) + " " + RH + " re f\n";
    COLS.forEach((h, i) => { T(x + 3, y, h, true, 7.5); x += widths[i]; });
    rows.slice(pg * per, pg * per + per).forEach((r, k) => {
      y -= RH; x = M0;
      if (k % 2) c += "0.975 0.98 0.985 rg " + M0 + " " + (y - 5) + " " + (W - 2 * M0) + " " + RH + " re f\n";
      r.forEach((v, i) => { const maxc = Math.floor(widths[i] / 3.9); let t = String(v); if (t.length > maxc) t = t.slice(0, maxc - 1) + "."; const p = i === 8 ? parseFloat(v) : NaN; T(x + 3, y, t, false, 7.5, i === 8 && !isNaN(p) ? (p >= 0 ? "0.05 0.6 0.4" : "0.85 0.2 0.28") : null); x += widths[i]; });
    });
    if (!rows.length) T(M0, y - 24, "No records for the selected filters.", false, 10);
    const cs = add(`<< /Length ${c.length} >>\nstream\n${c}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${cs} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objs[tree - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n"; const off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xr = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xr}\n%%EOF`;
  const u = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u[i] = out.charCodeAt(i) & 255;
  return new Blob([u], {type:"application/pdf"});
}
function save(blob, name){
  const nat = window.NativeApp;
  if (nat && typeof nat.saveFile === "function"){
    const rd = new FileReader();
    rd.onload = () => { try { const r = nat.saveFile(String(rd.result).split(",")[1] || "", name, blob.type || "application/octet-stream"); if (r === false) throw 0; U.toast("Saved to Downloads", "ok"); } catch(e){ U.toast("Could not save the file", "bad"); } };
    rd.onerror = () => U.toast("Could not save the file", "bad");
    rd.readAsDataURL(blob); return "native";
  }
  const a = document.createElement("a"), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function open(){
  const st = {range:30, type:"all", fmt:"csv"};
  const seg = (k, items) => `<div class="hx-seg" data-k="${k}">${items.map(([v, n]) => `<button type="button" data-v="${v}" class="${String(st[k]) === String(v) ? "on" : ""}">${n}</button>`).join("")}</div>`;
  U.sheet("Export trade history", `<div class="hx">
    <h4>Time range</h4>${seg("range", [[7, "7D"], [30, "30D"], [90, "90D"], ["all", "All"]])}
    <h4>Type</h4>${seg("type", [["all", "All"], ["futures", "Futures"], ["binary", "Binary"], ["spot", "Spot"], ["options", "Options"]])}
    <h4>Format</h4>${seg("fmt", [["csv", "CSV"], ["pdf", "PDF"]])}
    <p class="hx-n" id="hxn"></p>
    <button type="button" class="btn btn-primary hx-go" id="hxgo">Download</button></div>`, el => {
    const upd = () => { const n = collect(st.range === "all" ? "all" : +st.range, st.type).length; el.querySelector("#hxn").textContent = n ? `${n} record${n > 1 ? "s" : ""} will be exported.` : "No records for these filters yet."; };
    el.querySelectorAll(".hx-seg").forEach(g => g.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; st[g.dataset.k] = b.dataset.v; g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); upd(); }));
    el.querySelector("#hxgo").onclick = () => {
      const rows = collect(st.range === "all" ? "all" : +st.range, st.type), d = new Date(), nm = `novatrade-history-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const rl = st.range === "all" ? "All time" : "Last " + st.range + " days", tl = st.type === "all" ? "All products" : st.type[0].toUpperCase() + st.type.slice(1);
      try {
        if (st.fmt === "csv") save(new Blob([csv(rows)], {type:"text/csv;charset=utf-8"}), nm + ".csv");
        else save(pdf(rows, `NovaTrade trade history  (${rl}, ${tl})`), nm + ".pdf");
        if (!(window.NativeApp && typeof window.NativeApp.saveFile === "function")) U.toast((st.fmt === "csv" ? "CSV" : "PDF") + " exported", "ok");
        U.closeLayer();
      } catch(e){ U.toast("Export failed", "bad"); }
    };
    upd();
  });
}
window.TradeExport = {open, collect, csv, pdf};
document.addEventListener("click", e => { if (e.target.closest("[data-exp]")) open(); });
})();

/* ===== Display currency (USD / INR / EUR) ===== */
(function(){
"use strict";
const U = window.U, S = () => U.store.s;
const KFX = "nt_fx", FALL = {INR:88, EUR:0.92};
const CUR = {USD:{sym:"$", loc:"en-US", n:"US Dollar"}, INR:{sym:"₹", loc:"en-IN", n:"Indian Rupee"}, EUR:{sym:"€", loc:"en-US", n:"Euro"}};
let rates = Object.assign({}, FALL), fxT = 0;
try { const c = JSON.parse(localStorage.getItem(KFX) || "null"); if (c && c.INR > 0){ rates = {INR:c.INR, EUR:c.EUR || FALL.EUR}; fxT = c.t || 0; } } catch(e){}
function loadRates(){
  if (Date.now() - fxT < 864e5) return;
  fetch("https://open.er-api.com/v6/latest/USD").then(r => r.ok ? r.json() : Promise.reject()).then(j => {
    const r = j && j.rates; if (!r || !(r.INR > 0)) return;
    rates = {INR:r.INR, EUR:r.EUR > 0 ? r.EUR : FALL.EUR}; fxT = Date.now();
    try { localStorage.setItem(KFX, JSON.stringify({t:fxT, INR:rates.INR, EUR:rates.EUR})); } catch(e){}
    rescan();
  }).catch(() => {});
}
const code = () => { try { const c = S().settings.currency; return CUR[c] ? c : "USD"; } catch(e){ return "USD"; } };
const rate = c => c === "USD" ? 1 : rates[c] || FALL[c];
const nf = {};
function fmtCur(usd, dec, c){
  c = c || code(); const v = usd * rate(c), a = Math.abs(v);
  const md = a >= 1 ? 2 : Math.min(8, Math.max(2, dec || 4)), key = c + md;
  const f = nf[key] || (nf[key] = new Intl.NumberFormat(CUR[c].loc, {minimumFractionDigits:2, maximumFractionDigits:md}));
  return CUR[c].sym + f.format(v);
}
/* U.fiat(usdAmount [, withApprox=true]) -> "≈ ₹5,23,000.12" */
U.fiat = (usd, approx) => (approx === false ? "" : "≈ ") + fmtCur(+usd || 0, 2);
U.cur = {code, rate, fmt: v => fmtCur(+v || 0, 2), symbol: () => CUR[code()].sym, list: () => Object.keys(CUR), refresh: loadRates};

const RX = /^(≈ )?\$(-?[\d,]+(?:\.(\d+))?)$/;
const SEL = '[data-usd], #lusd, .pk-p small, .px-coin .px-mut, .wd-coin .r span, .px-acc small, .sp-book .mid small';
function fix(n){
  const v = n.nodeValue; if (v == null || v.length > 40) return;
  const cc = code();
  if (n.__out === v && n.__cur === cc) return;
  let orig, usd, pre, dec;
  const m = RX.exec(v.trim());
  if (m && (m[1] || (n.parentElement && n.parentElement.matches(SEL)))){ orig = v; usd = parseFloat(m[2].replace(/,/g, "")); pre = m[1] || ""; dec = m[3] ? m[3].length : 2; if (isNaN(usd)) return; }
  else if (n.__usd != null && n.__out === v){ orig = n.__orig; usd = n.__usd; pre = n.__pre; dec = n.__dec; }
  else return;
  const out = cc === "USD" ? orig : pre + fmtCur(usd, dec, cc);
  n.__orig = orig; n.__usd = usd; n.__pre = pre; n.__dec = dec; n.__out = out; n.__cur = cc;
  if (n.nodeValue !== out) n.nodeValue = out;
}
function walk(root){
  if (root.nodeType === 3) return fix(root);
  if (root.nodeType !== 1 || /^(SCRIPT|STYLE|CANVAS|SVG)$/i.test(root.tagName)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = tw.nextNode())) fix(n);
}
function homeFiat(){
  const b = document.getElementById("bal"); let f = document.getElementById("balfiat");
  if (!b){ return; }
  const cc = code(), txt = b.textContent || "", val = parseFloat(txt.replace(/,/g, ""));
  if (cc === "USD" || isNaN(val) || /\*/.test(txt)){ if (f) f.remove(); return; }
  const out = "≈ " + fmtCur(val * (window.M && M.usdtUsd ? M.usdtUsd() : 1), 2, cc);
  if (!f){ f = document.createElement("div"); f.id = "balfiat"; f.className = "hm-fiat num"; b.insertAdjacentElement("afterend", f); }
  if (f.textContent !== out) f.textContent = out;
}
function rescan(){ walk(document.body); homeFiat(); }
const obs = new MutationObserver(ms => {
  const seen = new Set();
  for (const m of ms){
    if (m.type === "characterData") seen.add(m.target);
    else m.addedNodes.forEach(n => seen.add(n));
  }
  seen.forEach(n => { if (n.isConnected) walk(n); });
  homeFiat();
});
function start(){ obs.observe(document.body, {childList:true, subtree:true, characterData:true}); loadRates(); rescan(); }
if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);

/* Settings row */
function wrapSettings(){
  const _s = window.Pages && Pages.settings; if (!_s) return;
  Pages.settings = function(){
    const p = _s.apply(this, arguments);
    const row = `<section class="pm-sec"><h3 class="pm-st">Currency</h3><div class="pm-row"><div class="pm-main"><div class="pm-t">Display currency</div><div class="pm-s">Fiat values next to balances and prices (rate updates daily)</div></div><div class="pm-seg" id="dcSeg">${Object.keys(CUR).map(k => `<button data-cur="${k}" class="${k === code() ? "on" : ""}">${k === "USD" ? "USD" : k + " " + CUR[k].sym}</button>`).join("")}</div></div></section>`;
    const re = /<section class="pm-sec [^"]*"><h3 class="pm-st">Guide/;
    p.html = re.test(p.html) ? p.html.replace(re, m => row + m) : p.html.replace('<div class="pm-page">', '<div class="pm-page">' + row);
    const mt = p.mount;
    p.mount = function(r){
      const out = mt && mt.apply(this, arguments);
      r.querySelectorAll("[data-cur]").forEach(b => b.onclick = () => {
        S().settings.currency = b.dataset.cur; U.store.save();
        r.querySelectorAll("[data-cur]").forEach(x => x.classList.toggle("on", x === b));
        loadRates(); rescan(); U.toast("Display currency: " + b.dataset.cur, "ok", 1200);
      });
      return out;
    };
    return p;
  };
}
wrapSettings();
})();

/* ===== KYC demo flow, login history and devices ===== */
(function(){
"use strict";
const U = window.U, esc = U.esc, ic = U.ic, S = () => U.store.s;
const KK = "nt_kyc", REVIEW_MS = 20000;
const rd = () => { try { return JSON.parse(localStorage.getItem(KK) || "null") || {status:"none"}; } catch(e){ return {status:"none"}; } };
const wr = v => { try { localStorage.setItem(KK, JSON.stringify(v)); } catch(e){} };
function kyc(){
  const k = rd();
  if (k.status === "review" && Date.now() >= k.at + REVIEW_MS){ k.status = "verified"; k.done = Date.now(); wr(k); try { U.store.notify("Identity verified", "Your identity verification was approved.", "ok"); } catch(e){} U.bus.emit("kyc"); }
  return k;
}
const label = k => ({none:"Unverified", review:"Under review", verified:"Verified"})[k.status];
setInterval(() => { const was = rd().status; const k = kyc(); if (k.status !== was) refreshBadges(); }, 2000);
function refreshBadges(){
  const k = kyc();
  document.querySelectorAll(".pf-ok,[data-kycst]").forEach(el => { el.textContent = label(k); el.className = (el.hasAttribute("data-kycst") ? "sc-st " : "pf-ok ") + "kyc-" + k.status; if (el.hasAttribute("data-kycst") && k.status === "verified") el.classList.add("on"); });
}
const COUNTRIES = ["India","United States","United Kingdom","Canada","Australia","Singapore","United Arab Emirates","Saudi Arabia","Pakistan","Bangladesh","Sri Lanka","Nepal","Indonesia","Malaysia","Philippines","Vietnam","Thailand","Japan","South Korea","Germany","France","Spain","Italy","Netherlands","Brazil","Mexico","Nigeria","South Africa","Turkey","Other"];
const DOCS = [["aadhaar","Aadhaar Card",true,"Front and back"],["pan","PAN Card",false,"Front only"],["passport","Passport",false,"Photo page"],["dl","Driving Licence",true,"Front and back"]];

function openKyc(){
  const cur = kyc();
  if (cur.status !== "none") return statusSheet(cur);
  const st = {step:0, country:(S().profile && S().profile.country) || "India", name:"", dob:"", doc:"aadhaar", front:null, back:null, selfie:null};
  const TITLES = ["Personal information", "Choose ID document", "Upload your document", "Take a selfie"];
  const o = document.createElement("div"); o.className = "kyc"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  document.body.appendChild(o); document.body.classList.add("kyc-open");
  let stream = null;
  const stopCam = () => { if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; } };
  const close = () => { stopCam(); [st.front, st.back, st.selfie].forEach(f => f && f.url && URL.revokeObjectURL(f.url)); o.remove(); document.body.classList.remove("kyc-open"); };
  const prev = (f, lbl, key) => `<label class="kyc-up ${f ? "has" : ""}" data-up="${key}">${f ? `<img src="${f.url}" alt="${lbl}">` : `<span class="kyc-ui">${ic("plus", 22, 2)}</span><b>${lbl}</b><small>JPG or PNG, preview only</small>`}<input type="file" accept="image/*" hidden data-file="${key}"></label>`;
  function draw(){
    stopCam();
    const d = DOCS.find(x => x[0] === st.doc), s = st.step;
    let body = "", ok = true;
    if (s === 0){
      body = `<p class="kyc-p">Enter your details exactly as they appear on your ID.</p>
        <label class="kyc-l">Country / region<select id="kc">${COUNTRIES.map(c => `<option ${c === st.country ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        <label class="kyc-l">Full name<input id="kn" type="text" autocomplete="off" placeholder="As on your document" value="${esc(st.name)}"></label>
        <label class="kyc-l">Date of birth<input id="kd" type="date" max="${new Date(Date.now() - 18 * 365.25 * 864e5).toISOString().slice(0, 10)}" value="${st.dob}"></label>`;
      ok = st.name.trim().length >= 2 && !!st.dob;
    } else if (s === 1){
      body = `<p class="kyc-p">Select a government-issued document.</p>` + DOCS.map(x => `<button type="button" class="kyc-doc ${x[0] === st.doc ? "on" : ""}" data-doc="${x[0]}"><span><b>${x[1]}</b><small>${x[3]}</small></span><i></i></button>`).join("");
    } else if (s === 2){
      body = `<p class="kyc-p">Make sure all four corners are visible and the text is readable. Files stay on this device.</p>${prev(st.front, d[1] + (d[2] ? " (front)" : ""), "front")}${d[2] ? prev(st.back, d[1] + " (back)", "back") : ""}`;
      ok = !!st.front && (!d[2] || !!st.back);
    } else if (s === 3){
      body = `<p class="kyc-p">Take a clear photo of your face, in good light, without a hat or glasses.</p>
        <div class="kyc-self ${st.selfie ? "has" : ""}" id="ksf">${st.selfie ? `<img src="${st.selfie.url}" alt="Selfie">` : `<span class="kyc-face">${ic("users", 54, 1.2)}</span>`}</div>
        <div class="kyc-row"><button type="button" class="btn btn-ghost" id="kcam">Use camera</button><label class="btn btn-ghost kyc-fl">Choose photo<input type="file" accept="image/*" capture="user" hidden data-file="selfie"></label></div><p class="kyc-err" id="kce"></p>`;
      ok = !!st.selfie;
    }
    o.innerHTML = `<header class="kyc-h"><button type="button" class="icon-btn" data-kb aria-label="${s ? "Back" : "Close"}">${ic(s ? "back" : "close", 22)}</button><b>${TITLES[s]}</b><span class="kyc-n">${s + 1}/4</span></header>
      <div class="kyc-bar"><i style="width:${(s + 1) * 25}%"></i></div><div class="kyc-b">${body}</div>
      <footer class="kyc-f"><button type="button" class="btn btn-primary kyc-go" data-next ${ok ? "" : "disabled"}>${s === 3 ? "Submit" : "Continue"}</button></footer>`;
    const nx = o.querySelector("[data-next]"), chk = () => { nx.disabled = !(s === 0 ? st.name.trim().length >= 2 && !!st.dob : true); };
    o.querySelector("[data-kb]").onclick = () => s ? (st.step--, draw()) : close();
    if (s === 0){ o.querySelector("#kc").onchange = e => st.country = e.target.value; o.querySelector("#kn").oninput = e => { st.name = e.target.value; chk(); }; o.querySelector("#kd").oninput = e => { st.dob = e.target.value; chk(); }; }
    if (s === 1) o.querySelectorAll("[data-doc]").forEach(b => b.onclick = () => { st.doc = b.dataset.doc; st.front = st.back = null; draw(); });
    o.querySelectorAll("[data-file]").forEach(i => i.onchange = () => { const f = i.files && i.files[0]; if (!f) return; if (!/^image\//.test(f.type)){ U.toast("Please choose an image", "bad"); return; } const k = i.dataset.file; if (st[k] && st[k].url) URL.revokeObjectURL(st[k].url); st[k] = {url:URL.createObjectURL(f), name:f.name}; draw(); });
    if (s === 3){
      o.querySelector("#kcam").onclick = async () => {
        const box = o.querySelector("#ksf"), err = o.querySelector("#kce");
        if (stream){ const v = box.querySelector("video"), c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0); stopCam(); c.toBlob(b => { st.selfie = {url:URL.createObjectURL(b), name:"selfie.jpg"}; draw(); }, "image/jpeg", .85); return; }
        try { stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}, audio:false}); box.classList.remove("has"); box.innerHTML = '<video autoplay playsinline muted></video>'; box.firstChild.srcObject = stream; o.querySelector("#kcam").textContent = "Capture"; }
        catch(e){ err.textContent = "Camera is not available. Choose a photo instead."; }
      };
    }
    nx.onclick = () => {
      if (s < 3){ st.step++; draw(); return; }
      wr({status:"review", at:Date.now(), country:st.country, name:st.name.trim(), doc:d[1]}); close(); U.buzz && U.buzz("open");
      refreshBadges(); statusSheet(kyc());
    };
  }
  draw();
}
function statusSheet(k){
  const left = Math.max(0, Math.ceil((k.at + REVIEW_MS - Date.now()) / 1000));
  if (k.status === "review"){
    U.sheet("Verification", `<div class="kyc-rv"><span class="kyc-spin"></span><h3>Under review</h3><p>We are checking your documents. This usually takes a few minutes; in this demo it finishes in about 20 seconds.</p><b class="num" id="kcd">${left}s</b></div>`, el => {
      const t = setInterval(() => { const c = kyc(), n = Math.max(0, Math.ceil((c.at + REVIEW_MS - Date.now()) / 1000)), e = el.querySelector("#kcd");
        if (!e || !document.body.contains(el)){ clearInterval(t); return; }
        if (c.status === "verified"){ clearInterval(t); statusSheet(c); refreshBadges(); } else e.textContent = n + "s"; }, 500);
    });
  } else {
    U.sheet("Verification", `<div class="kyc-ok"><span>${ic("check", 28, 2.4)}</span><h3>Identity verified</h3></div>
      <div class="pm-kv"><span>Identity (KYC)</span><b class="up">Verified</b></div><div class="pm-kv"><span>Name</span><b>${esc(k.name || "")}</b></div><div class="pm-kv"><span>Country</span><b>${esc(k.country || "")}</b></div><div class="pm-kv"><span>Document</span><b>${esc(k.doc || "")}</b></div><div class="pm-kv"><span>Withdrawal limit</span><b>Unlimited (demo)</b></div>
      <p class="pm-s" style="margin-top:12px">No documents are uploaded or stored.</p>`);
  }
}

/* ---- login history + devices ---- */
const A = () => window.Auth || {};
function logins(){
  let l = []; try { l = (A().logins && A().logins()) || []; } catch(e){}
  if (!l.length) l = [{t:Date.now(), dev:(A().devName ? A().devName() : "This browser"), how:"Current session", cur:true}];
  return l;
}
const ds = t => { try { return U.dateStr(t); } catch(e){ return new Date(t).toLocaleString("en-US"); } };
function loginSheet(){
  U.sheet("Login history", logins().map(x => `<div class="pm-row"><div class="pm-main"><div class="pm-t">${esc(x.dev)}${x.cur ? ' <span class="lg-cur">This device</span>' : ""}</div><div class="pm-s">${esc(x.how || "Password")}</div></div><span class="pm-s">${ds(x.t)}</span></div>`).join("") + `<p class="pm-s" style="margin-top:10px">Only sign-ins on this device are recorded.</p>`);
}
function devicesSheet(){
  const l = logins(), me = l[0], first = l[l.length - 1];
  U.sheet("Devices", `<div class="pm-row"><div class="pm-main"><div class="pm-t">${esc(me.dev)} <span class="lg-cur">This device</span></div><div class="pm-s">Active now · last sign-in ${ds(me.t)}</div></div></div><div class="pm-row"><div class="pm-main"><div class="pm-s">First seen ${ds(first.t)}</div></div></div><p class="pm-s" style="margin-top:10px">Demo accounts are stored on this device only.</p>`);
}

/* ---- Profile + Security hooks ---- */
function wrap(name, fn){ const o = window.Pages && Pages[name]; if (!o) return; Pages[name] = function(){ const p = o.apply(this, arguments); return fn(p) || p; }; }
const mnt = (p, f) => { const m = p.mount; p.mount = function(r){ const out = m && m.apply(this, arguments); try { f(r); } catch(e){ console.error(e); } return out; }; };
wrap("profile", p => { mnt(p, r => { const b = r.querySelector("[data-ver]"); if (b){ b.onclick = openKyc; } refreshBadges(); }); });
wrap("security", p => {
  const k = kyc();
  const rows = `<section class="pm-sec"><h3 class="pm-st">Identity &amp; devices</h3>
    <button class="pm-row tap" data-kycrow><div class="pm-main"><div class="pm-t">Verification</div><div class="pm-s">Identity verification (KYC)</div></div><span class="sc-st kyc-${k.status} ${k.status === "verified" ? "on" : ""}" data-kycst>${label(k)}</span><span class="pe-ch">${ic("chev", 16)}</span></button>
    <button class="pm-row tap" data-lgrow><div class="pm-main"><div class="pm-t">Login history</div><div class="pm-s">Recent sign-ins on this device</div></div><span class="pe-ch">${ic("chev", 16)}</span></button>
    <button class="pm-row tap" data-dvrow><div class="pm-main"><div class="pm-t">Devices</div><div class="pm-s">Where you are signed in</div></div><span class="pe-ch">${ic("chev", 16)}</span></button></section>`;
  p.html = p.html.replace('<p class="pm-note">', rows + '<p class="pm-note">');
  mnt(p, r => { r.querySelector("[data-kycrow]").onclick = openKyc; r.querySelector("[data-lgrow]").onclick = loginSheet; r.querySelector("[data-dvrow]").onclick = devicesSheet; });
});
window.KYC = {open:openKyc, status:() => kyc().status, reset:() => { wr({status:"none"}); refreshBadges(); }};
})();
