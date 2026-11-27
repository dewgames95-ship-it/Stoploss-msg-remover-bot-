/* ===== Secondary pages ===== */
(function(){
const C = window.CONFIG, {esc, ic, t, store, bus, money, signed, pct, toast, spark, fmt} = U;
const S = () => store.s;
const wrap = (title, body, opts) => UI.pageHead(title, opts) + body + UI.footer();
const kpi = (l, v, cls="") => `<div class="kpi"><span class="label">${l}</span><b class="${cls}">${v}</b></div>`;
const faq = items => `<div class="faq">${items.map(([q,a]) => `<details><summary>${esc(q)} ${ic("chevd",16)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`;
const sw = (on, key) => `<button class="switch ${on?"on":""}" data-sw="${key}" role="switch" aria-checked="${on}" aria-label="${key}"></button>`;
function processing(btn, ms=1100){ const h = btn.innerHTML; btn.disabled = true; btn.innerHTML = "Processing…"; return new Promise(r => setTimeout(() => { btn.disabled = false; btn.innerHTML = h; r(); }, ms)); }
function txList(kind){
  const tx = S().tx.filter(x => !kind || x.kind === kind).slice(0, 20);
  if (!tx.length) return UI.emptyState("file", "No transactions yet.");
  return tx.map(x => `<div class="list-item"><span class="ic ${x.kind==="deposit"?"ic-g":"ic-y"}">${ic(x.kind==="deposit"?"deposit":"withdraw",18)}</span>
    <div class="grow"><b style="font-size:14px">${x.kind==="deposit"?"Deposit":"Withdraw"} · ${esc(x.method)}</b><div class="label">${U.dateStr(x.t)} · ${esc(x.id.slice(0,8).toUpperCase())}</div></div>
    <div style="text-align:right"><b class="mono ${x.kind==="deposit"?"up":"down"}">${x.kind==="deposit"?"+":"-"}${money(x.amount)}</b><div class="label up">Completed</div></div></div>`).join("");
}

/* ---------- Deposit (instant top-up of virtual USDT) ---------- */
Pages.deposit = () => {
  const html = wrap("Deposit", `<div class="two-col"><div class="stack">
    <div class="hero">${UI.usdt(36)}<div class="label" style="margin-top:10px">Spot wallet balance</div><div class="bal num" id="db"></div><div class="sub" style="font-size:12px">USDT is credited to your Spot wallet instantly — no payment, card or wallet needed.</div></div>
    <section class="card">
      <form id="df" novalidate>
        <div class="form-row"><label>Coin</label><div class="field" style="justify-content:space-between">${UI.usdt(22)}<b class="grow">USDT</b><span class="label">Tether USD</span></div></div>
        <div class="form-row"><label for="da">Amount</label><div class="field" id="daf"><input id="da" type="number" inputmode="decimal" min="10" max="100000" value="1000"><span class="unit">USDT</span></div>
          <div class="chips" style="margin-top:8px">${[100,500,1000,5000,10000,50000].map(v => `<button type="button" data-v="${v}">${fmt(v,0)}</button>`).join("")}</div>
          <div class="err-msg" id="de" role="alert"></div></div>
        <div class="kv"><span>Arrival</span><b>Instant</b></div><div class="kv" style="margin-bottom:14px"><span>Fee</span><b>0 USDT</b></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Deposit now</button>
      </form>
    </section></div>
    <section class="card"><div class="title" style="margin-bottom:4px">Recent deposits</div><div id="dl"></div></section></div>`);
  return {html, title:"Deposit", mount(r){
    const render = () => { r.querySelector("#db").textContent = money(store.wb("spot")) + " USDT"; r.querySelector("#dl").innerHTML = txList("deposit"); };
    render();
    r.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { r.querySelector("#da").value = b.dataset.v; r.querySelector("#de").textContent = ""; });
    r.querySelector("#df").onsubmit = async e => {
      e.preventDefault();
      const a = parseFloat(r.querySelector("#da").value), err = r.querySelector("#de");
      let m = !(a > 0) ? "Enter a valid amount." : a < 1 ? "Minimum deposit is 1 USDT." : a > 100000 ? "Maximum is 100,000 USDT per deposit." : S().balance + a > 10000000 ? "Account limit is 10,000,000 USDT." : "";
      r.querySelector("#daf").classList.toggle("err", !!m); err.textContent = m;
      if (m) return toast(m, "bad");
      await processing(e.submitter || r.querySelector("[type=submit]"), 900);
      S().tx.unshift({id:U.uid(), kind:"deposit", amount:a, method:"Instant top-up", t:Date.now()});
      store.addWallet("spot", a, "deposit");
      store.notify("Deposit successful", `+${money(a)} USDT credited to your account`, "ok");
      toast(`Deposit successful! +${money(a)} USDT`, "ok"); U.fx("claim"); render();
    };
    this.unmount = bus.on("balance", render);
  }};
};

/* ---------- Shared flat-layout helpers (css/more.css) ---------- */
const psec = (title, body, cls="") => `<section class="pm-sec ${cls}">${title ? `<h3 class="pm-st">${esc(title)}</h3>` : ""}${body}</section>`;
const prow = (title, sub, right="", attrs="", cls="") => `<div class="pm-row ${cls}" ${attrs}><div class="pm-main"><div class="pm-t">${title}</div>${sub ? `<div class="pm-s">${sub}</div>` : ""}</div>${right}</div>`;
const pwrap = (title, body, opts) => UI.pageHead(title, opts) + `<div class="pm-page">${body}</div>`;
const pstat = (l, v, cls="") => `<div class="pm-stat"><span>${l}</span><b class="num ${cls}">${v}</b></div>`;
const pemp = (t, s="") => `<div class="pm-empty"><b>${esc(t)}</b>${esc(s)}</div>`;
const DAY = 864e5;
const fdate = t => new Date(t).toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"});
const runtime = since => { const m = Math.max(0, Math.floor((Date.now() - since)/60000)); return m >= 1440 ? Math.floor(m/1440) + "d " + Math.floor(m%1440/60) + "h" : m >= 60 ? Math.floor(m/60) + "h " + (m%60) + "m" : m + "m"; };
const getP = (o, p) => p.split(".").reduce((a, k) => a == null ? a : a[k], o);
const setP = (o, p, v) => { const ks = p.split("."), l = ks.pop(); ks.reduce((a, k) => (a[k] = a[k] || {}), o)[l] = v; };
const swb = (path, on) => `<button class="switch ${on ? "on" : ""}" data-sw="${path}" role="switch" aria-checked="${!!on}" aria-label="${esc(path)}"></button>`;

/* ---------- Theme: Light / Dark / System ---------- */
const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
function applyTheme(mode){
  const res = mode === "system" ? (mq && mq.matches ? "dark" : "light") : mode;
  window.App && App.setTheme(res);
  S().settings.theme = mode; store.save();
}
if (mq){
  const onMq = () => { if (S().settings.theme === "system") applyTheme("system"); };
  mq.addEventListener ? mq.addEventListener("change", onMq) : mq.addListener && mq.addListener(onMq);
}
setTimeout(() => { if (S().settings.theme === "system") applyTheme("system"); }, 0);

/* ---------- Earn (Simple Earn: Flexible + Locked, BTC / ETH / SOL / USDT) ----------
   Rates: Binance Simple Earn reference APRs x3 (base table below, in % per year). */
const EARN_MULT = 3, EARN_COINS = ["BTC","ETH","SOL","USDT"], TERMS = [30, 60, 90, 120];
const EARN_BASE = {
  BTC:{f:.45, l:{30:.80, 60:.90, 90:1.00, 120:1.10}},
  ETH:{f:1.40, l:{30:2.00, 60:2.20, 90:2.40, 120:2.60}},
  SOL:{f:3.00, l:{30:4.60, 60:5.00, 90:5.40, 120:5.80}},
  USDT:{f:4.00, l:{30:5.20, 60:5.60, 90:6.00, 120:6.40}}
};
const eApr = (c, d) => (d ? EARN_BASE[c].l[d] : EARN_BASE[c].f) * EARN_MULT / 100;
const ePrice = c => { if (c === "USDT") return 1; const p = M.get(c + "USDT"); return p && p.price > 0 ? p.price : 0; };
const eDp = c => c === "BTC" ? 6 : c === "ETH" ? 5 : c === "SOL" ? 3 : 2;
const eFmt = (v, c) => (+v || 0).toLocaleString("en-US", {minimumFractionDigits:0, maximumFractionDigits:eDp(c)});
const eFloor = (v, c) => { const k = Math.pow(10, eDp(c)); return Math.floor(v * k + 1e-9) / k; };
const earnS = () => { const s = S(); s.earn = Object.assign({locked:[], flexInt:0, lockedInt:0}, s.earn || {}); if (!Array.isArray(s.earn.locked)) s.earn.locked = []; return s.earn; };
const lockedAcc = (p, now=Date.now()) => p.amount * p.apr * Math.min(Math.max(0, now - p.start), p.days * DAY) / (365 * DAY);
const flexAcc = () => E.vaultValue() - S().vault.bal;
function flexMove(a, dir){ const acc = flexAcc(), err = E.vaultMove(a, dir); if (!err){ earnS().flexInt += acc; store.save(); } return err; }
function settleMatured(){
  const e = earnS(), now = Date.now(), done = e.locked.filter(p => !p.flex && now >= p.start + p.days * DAY);
  if (!done.length) return false;
  done.forEach(p => {
    const int = Math.round(p.amount * p.apr * p.days / 365 * 100) / 100, c = p.coin || "USDT";
    e.lockedInt += int; e.locked = e.locked.filter(x => x.id !== p.id);
    store.addWallet("earn", p.amount + int, "earn");
    store.notify("Earn position matured", `${p.days}D Locked ${c}: ${money(p.amount)} USDT + ${money(int)} USDT interest credited`, "ok");
    S().tx.unshift({id:U.uid(), kind:"deposit", amount:p.amount + int, method:"Earn maturity", t:now});
  });
  store.save(); return true;
}
const earnTotals = () => {
  const e = earnS(), vv = E.vaultValue();
  let lp = 0, la = 0, ld = 0;   /* flexible coin positions live in e.locked with flex:true so E.earnValue() counts them */
  e.locked.forEach(p => { lp += p.amount; la += lockedAcc(p); ld += p.amount * p.apr / 365; });
  return {total: vv + lp + la, interest: e.flexInt + flexAcc() + e.lockedInt + la, today: vv * E.APR / 365 + ld, vv};
};
/* comma-formatted decimal input; returns parsed number */
function commaInput(q, dp){
  const pos = q.selectionStart, digs = q.value.slice(0, pos).replace(/[^\d.]/g, "").length;
  let raw = q.value.replace(/[^\d.]/g, ""); const dot = raw.indexOf(".");
  if (dot >= 0) raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, "").slice(0, dp);
  const [ip, dpart] = raw.split("."), f = (ip ? (+ip).toLocaleString("en-US") : (dpart != null ? "0" : "")) + (dpart != null ? "." + dpart : "");
  q.value = f; let n = 0, i = 0; for (; i < f.length && n < digs; i++) if (/[\d.]/.test(f[i])) n++; try { q.setSelectionRange(i, i); } catch {}
  return parseFloat(raw) || 0;
}
function earnYieldHelp(){
  const ex = 1000 * eApr("USDT", 30) * 30 / 365;
  const box = (x, y, w, h, t1, t2, cls) => `<rect class="ey-b ${cls || ""}" x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/><text class="ey-t ey-h" x="${x + w/2}" y="${y + (t2 ? h/2 - 2 : h/2 + 4)}" text-anchor="middle">${t1}</text>${t2 ? `<text class="ey-t" x="${x + w/2}" y="${y + h/2 + 11}" text-anchor="middle">${t2}</text>` : ""}`;
  const svg = `<svg class="ey-svg" viewBox="0 0 320 190" role="img" aria-label="How lending turns into yield: you lend into the pool, borrowers pay interest, you receive a share">
    ${box(6, 56, 74, 64, "You", "Lenders", "ey-me")}${box(118, 56, 80, 64, "Earn pool", "Pooled funds", "ey-pool")}
    ${box(236, 6, 80, 44, "Margin & P2P", "borrowers")}${box(236, 66, 80, 44, "Crypto-backed", "loans")}${box(236, 126, 80, 44, "Other", "lending")}
    <path class="ey-a" d="M80 76H112"/><path class="ey-ah" d="M118 76l-7-4v8z"/><text class="ey-t ey-s" x="99" y="68" text-anchor="middle">Lend</text>
    <path class="ey-a ey-i" d="M118 100H86"/><path class="ey-ah ey-i" d="M80 100l7-4v8z"/><text class="ey-t ey-s ey-g" x="99" y="116" text-anchor="middle">Interest</text>
    <path class="ey-a" d="M198 80C216 80 218 28 230 28M198 88H230M198 96C216 96 218 148 230 148"/><path class="ey-ah" d="M236 28l-7-4v8zM236 88l-7-4v8zM236 148l-7-4v8z"/>
    <text class="ey-t ey-s" x="217" y="186" text-anchor="middle">Borrowers pay interest</text></svg>`;
  UI.help("Where does the yield come from?", `${svg}
    <p>Earn is a <b>lending</b> product. Your coins are pooled with other users' coins and lent out. Borrowers pay interest, and that interest is shared back with you.</p>
    <ul class="ey-l"><li><b>Lending side.</b> You are the lender. The more you lend and the longer you stay, the more interest you collect.</li>
    <li><b>P2P and margin lending.</b> Traders borrow coins to trade with leverage. They pay an interest rate that changes with demand.</li>
    <li><b>Collateral-based crypto loans.</b> Borrowers lock other crypto as collateral and borrow against it. If the collateral value falls too far it is sold automatically, which protects the lenders.</li></ul>
    <p><b>Interest %.</b> APR is the yearly rate before compounding. Interest per period = amount x APR x days / 365. Example: 1,000 USDT locked for 30 days at ${(eApr("USDT", 30) * 100).toFixed(2)}% APR earns about <b>${ex.toFixed(2)} USDT</b>.</p>
    <p><b>Flexible</b> pays a lower rate and you can redeem at any time. <b>Locked</b> pays a higher rate in return for keeping the funds in for the full term. Rates are variable and may change.</p>`);
}

Pages.earn = () => {
  let tab = "flex", term = 30;
  const apr = v => fmt(v * 100, 2) + "%";
  const html = pwrap("Earn", `
    <div class="pm-strip"><div class="lbl">Total Earn balance (USDT)</div><div class="big num" data-tot>0.00</div>
      <div class="pm-cols c2"><div><span>Cumulative interest</span><b class="num up" data-int>0.00</b></div><div><span>Today's estimated earnings</span><b class="num up" data-today>0.00</b></div></div>
      <div class="pm-acts"><button class="btn btn-primary" data-sub>Subscribe</button><button class="btn btn-ghost" data-red>Redeem</button></div></div>
    <section class="pm-sec"><h3 class="pm-st">Simple Earn <button class="hq" data-yh aria-label="Where does the yield come from?" type="button">?</button></h3>
      <nav class="pm-tabs" id="ePt" aria-label="Product type"><a href="javascript:void 0" data-t="flex" class="on">Flexible</a><a href="javascript:void 0" data-t="lock">Locked</a></nav>
      <div class="ea-terms" id="eTerms" hidden>${TERMS.map(d => `<button data-term="${d}" class="${d === 30 ? "on" : ""}">${d} Days</button>`).join("")}</div>
      <div id="eList"></div></section>
    <section class="pm-sec" id="pmPos"></section>
    <p class="pm-risk">Rates are variable and may change. Early redemption of a locked product forfeits all accrued interest.</p>`, {right:`<button class="icon-btn" data-txh aria-label="History">${ic("history",22)}</button>`});
  return {html, title:"Earn", mount(r){
    const $ = q => r.querySelector(q);
    const drawList = () => {
      $("#eTerms").hidden = tab !== "lock";
      $("#eList").innerHTML = EARN_COINS.map(c => { const d = tab === "lock" ? term : 0, a = eApr(c, d);
        return `<div class="pm-prod" data-p="${c}:${d}" style="cursor:pointer">${UI.coinImg(c, 28)}<div class="grow"><div class="pm-nm">${c} ${d ? `<span class="pm-pill b">${d} Days</span>` : `<span class="pm-pill">Flexible</span>`}</div><div class="pm-s">${d ? "Interest paid at maturity" : "Redeem any time"}</div></div>
          <div class="pm-apr"><b class="num">${apr(a)}</b><span>APR</span></div><button class="pm-btn" data-p="${c}:${d}">Subscribe</button></div>`; }).join("");
    };
    const upd = () => { const t = earnTotals(); $("[data-tot]").textContent = money(t.total); $("[data-int]").textContent = fmt(t.interest, 2); $("[data-today]").textContent = fmt(t.today, 2);
      const e = earnS();
      r.querySelectorAll("[data-acc]").forEach(el => { const id = el.dataset.acc; if (id === "flex") el.textContent = "+" + fmt(flexAcc(), 2); else { const p = e.locked.find(x => x.id === id); if (p) el.textContent = "+" + fmt(lockedAcc(p), 2); } });
      r.querySelectorAll("[data-pg]").forEach(el => { const p = e.locked.find(x => x.id === el.dataset.pg); if (p) el.style.width = Math.min(100, (Date.now() - p.start) / (p.days * DAY) * 100).toFixed(2) + "%"; }); };
    const renderPos = () => {
      const e = earnS(), t = earnTotals(); let h = "";
      if (t.vv > 0.0001) h += `<div class="pm-pos"><div class="pm-pos-h">${UI.coinImg("USDT", 28)}<div class="grow"><div class="pm-nm">USDT Flexible <span class="pm-pill g">${apr(E.APR)} APR</span></div></div><button class="pm-btn line" data-rf>Redeem</button></div>
        <div class="pm-pos-g"><div><span>Amount</span><b class="num">${fmt(t.vv, 2)}</b></div><div><span>Accrued interest</span><b class="num up" data-acc="flex">+0.00</b></div><div><span>Est. daily</span><b class="num">${fmt(t.vv * E.APR / 365, 2)}</b></div></div></div>`;
      e.locked.filter(p => p.flex).forEach(p => {
        h += `<div class="pm-pos"><div class="pm-pos-h">${UI.coinImg(p.coin, 28)}<div class="grow"><div class="pm-nm">${p.coin} Flexible <span class="pm-pill g">${apr(p.apr)} APR</span></div></div><button class="pm-btn line" data-rfn="${p.id}">Redeem</button></div>
          <div class="pm-pos-g"><div><span>Amount</span><b class="num">${eFmt(p.qty, p.coin)} ${p.coin}</b></div><div><span>Accrued (USDT)</span><b class="num up" data-acc="${p.id}">+0.00</b></div><div><span>Est. daily (USDT)</span><b class="num">${fmt(p.amount * p.apr / 365, 2)}</b></div></div></div>`;
      });
      e.locked.filter(p => !p.flex).sort((a, b) => a.start + a.days * DAY - b.start - b.days * DAY).forEach(p => {
        const mat = p.start + p.days * DAY, left = Math.max(0, Math.ceil((mat - Date.now()) / DAY)), c = p.coin || "USDT";
        h += `<div class="pm-pos"><div class="pm-pos-h">${UI.coinImg(c, 28)}<div class="grow"><div class="pm-nm">${c} Locked <span class="pm-pill b">${p.days} Days</span></div></div><button class="pm-btn line" data-rl="${p.id}">Redeem</button></div>
          <div class="pm-pos-g"><div><span>Amount</span><b class="num">${eFmt(p.qty != null ? p.qty : p.amount, c)} ${c}</b></div><div><span>APR</span><b class="num up">${apr(p.apr)}</b></div><div><span>Accrued (USDT)</span><b class="num up" data-acc="${p.id}">+0.00</b></div></div>
          <div class="pm-bar"><i data-pg="${p.id}" style="width:0"></i></div><div class="pm-pos-f"><span>Matures ${fdate(mat)}</span><span>${left} day${left === 1 ? "" : "s"} left</span></div></div>`;
      });
      $("#pmPos").innerHTML = `<h3 class="pm-st">My positions</h3>` + (h || pemp("No active positions", "Subscribe to a product above to start earning."));
      upd();
    };
    function openSub(coin, days){
      let c = coin, d = days;
      const sheetBody = () => `<div class="pm-seg w" id="pmCs">${EARN_COINS.map(x => `<button data-c="${x}" class="${x === c ? "on" : ""}">${x}</button>`).join("")}</div>
        <div class="pm-seg w" id="pmPs" style="margin-top:8px">${[0, ...TERMS].map(x => `<button data-d="${x}" class="${x === d ? "on" : ""}">${x ? x + "D" : "Flexible"}</button>`).join("")}</div><div id="pmSb" style="margin-top:8px"></div>`;
      U.sheet("Subscribe", sheetBody(), el => {
        const mount = () => {
          const a = eApr(c, d), b = el.querySelector("#pmSb"), min = d ? 10 : 1, price = ePrice(c), dp = eDp(c);
          const avbl = () => store.wb("earn"), maxQ = () => price ? eFloor(avbl() / price, c) : 0;
          b.innerHTML = `<div class="pm-kv" style="padding-top:2px"><span>Product</span><b>${c} ${d ? d + "-day Locked" : "Flexible"}</b></div>
            <div class="pm-kv"><span>APR <button class="hq" data-yh type="button" aria-label="Where does the yield come from?">?</button></span><b class="num up">${apr(a)}</b></div>
            <span class="pm-lbl">Amount</span><div class="pm-fld" id="pmAf"><input id="pmAmt" type="text" inputmode="decimal" autocomplete="off" placeholder="Min ${eFmt(min / (price || 1), c)}" aria-label="Amount"><span class="u">${c}</span><button type="button" class="mx" data-max>Max</button></div>
            <div class="ea-sl"><input type="range" id="pmRng" min="0" max="100" step="1" value="0" aria-label="Share of available balance"><b class="num" id="pmPc">0%</b></div>
            <div class="pm-kv" style="margin-top:4px"><span>Avbl (Earn)</span><b class="num">${eFmt(maxQ(), c)} ${c} <button class="wl-plus" data-wlto="earn" aria-label="Transfer in">${ic("plus",13,3)}</button></b></div>
            <div class="pm-kv"><span>Value</span><b class="num" id="pmUsd">0.00 USDT</b></div>
            <div class="pm-kv"><span>${d ? "Est. interest at maturity" : "Est. daily interest"}</span><b class="num up" id="pmEi">0.00 USDT</b></div>
            <div class="pm-kv"><span>Redemption date</span><b>${d ? fdate(Date.now() + d * DAY) : "Any time"}</b></div>
            <label class="pm-chk"><input type="checkbox" id="pmAg"><span>I have read and agree to the Simple Earn terms</span></label>
            <div class="pm-err" id="pmEr"></div><button class="btn btn-primary pm-cta" data-ok>Confirm subscription</button>`;
          const inp = b.querySelector("#pmAmt"), rng = b.querySelector("#pmRng"); let qty = 0;
          const setQ = (v, fromInput) => { qty = v; const usd = v * price;
            if (!fromInput) inp.value = v > 0 ? v.toLocaleString("en-US", {maximumFractionDigits:dp}) : "";
            const mq = maxQ(), p = mq > 0 ? Math.min(100, v / mq * 100) : 0; rng.value = p; rng.style.setProperty("--p", p + "%"); b.querySelector("#pmPc").textContent = Math.round(p) + "%";
            b.querySelector("#pmUsd").textContent = fmt(usd, 2) + " USDT";
            b.querySelector("#pmEi").textContent = fmt(d ? usd * a * d / 365 : usd * a / 365, 2) + " USDT"; };
          inp.oninput = () => setQ(commaInput(inp, dp), true);
          rng.oninput = () => { const p = +rng.value; setQ(p >= 100 ? maxQ() : eFloor(maxQ() * p / 100, c)); };
          b.querySelector("[data-max]").onclick = () => setQ(maxQ());
          b.querySelector("[data-yh]").onclick = earnYieldHelp;
          b.querySelector("[data-ok]").onclick = () => {
            const usd = Math.round(qty * price * 100) / 100;
            const err = !price ? "Price unavailable. Try again shortly." : !(qty > 0) ? "Enter a valid amount." : usd < min ? `Minimum subscription is ${min} USDT (about ${eFmt(min / price, c)} ${c}).` : usd > avbl() + 1e-6 ? "Insufficient Earn balance" : !b.querySelector("#pmAg").checked ? "Please accept the Simple Earn terms." : "";
            b.querySelector("#pmEr").textContent = err; b.querySelector("#pmAf").classList.toggle("err", !!err && !(qty > 0 && usd >= min && usd <= avbl()));
            if (err){ UI.walletErr(err); return; }
            store.addWallet("earn", -usd, "earn"); const e = earnS();
            e.locked.push(d ? {id:U.uid(), coin:c, days:d, apr:a, amount:usd, qty, start:Date.now()} : {id:U.uid(), coin:c, flex:true, days:36500, apr:a, amount:usd, qty, start:Date.now()});
            store.save();
            S().tx.unshift({id:U.uid(), kind:"withdraw", amount:usd, method:"Earn · " + c + " " + (d ? d + "D Locked" : "Flexible"), t:Date.now()}); store.save();
            U.fx("claim"); toast(`Subscribed ${eFmt(qty, c)} ${c}`, "ok"); U.closeLayer(); renderPos();
          };
        };
        el.querySelectorAll("#pmCs [data-c]").forEach(btn => btn.onclick = () => { c = btn.dataset.c; el.querySelectorAll("#pmCs [data-c]").forEach(x => x.classList.toggle("on", x === btn)); mount(); });
        el.querySelectorAll("#pmPs [data-d]").forEach(btn => btn.onclick = () => { d = +btn.dataset.d; el.querySelectorAll("#pmPs [data-d]").forEach(x => x.classList.toggle("on", x === btn)); mount(); });
        mount();
      });
    }
    function openRedeem(){
      const e = earnS(), vv = E.vaultValue();
      const fl = e.locked.filter(x => x.flex);
      if (vv < 0.01 && !fl.length) return toast("No flexible balance to redeem.", "info");
      if (vv < 0.01){ if (fl.length === 1) return redeemFlexN(fl[0].id); return toast("Tap Redeem on the position you want to close.", "info"); }
      U.sheet("Redeem Flexible", `<div class="pm-kv" style="padding-top:2px"><span>Redeemable</span><b class="num">${fmt(vv, 2)} USDT</b></div>
        <span class="pm-lbl">Amount</span><div class="pm-fld" id="pmRf"><input id="pmRa" type="number" inputmode="decimal" min="0.01" aria-label="Amount"><span class="u">USDT</span><button type="button" class="mx" data-max>Max</button></div>
        <div class="pm-kv" style="margin-top:8px"><span>Arrives</span><b>Instantly in your Earn wallet</b></div><div class="pm-err" id="pmRe"></div><button class="btn btn-primary pm-cta" data-ok>Confirm redemption</button>`, el => {
        const inp = el.querySelector("#pmRa");
        el.querySelector("[data-max]").onclick = () => inp.value = Math.floor(E.vaultValue() * 100) / 100;
        el.querySelector("[data-ok]").onclick = () => {
          const a = Math.round(parseFloat(inp.value) * 100) / 100, err = !(a > 0) ? "Enter a valid amount." : a > E.vaultValue() + 1e-9 ? "Amount exceeds your Flexible balance." : "";
          el.querySelector("#pmRe").textContent = err; el.querySelector("#pmRf").classList.toggle("err", !!err); if (err) return;
          const e2 = flexMove(a, "out"); if (e2) return toast(e2, "bad");
          S().tx.unshift({id:U.uid(), kind:"deposit", amount:a, method:"Earn redemption", t:Date.now()}); store.save();
          U.fx("claim"); toast(`Redeemed ${money(a)} USDT`, "ok"); U.closeLayer(); renderPos();
        };
      });
    }
    async function redeemFlexN(id){
      const e = earnS(), p = e.locked.find(x => x.id === id && x.flex); if (!p) return;
      const acc = Math.round(lockedAcc(p) * 100) / 100;
      if (!await U.confirmBox("Redeem " + p.coin + " Flexible?", `${eFmt(p.qty, p.coin)} ${p.coin} (${money(p.amount)} USDT) plus ${fmt(acc, 2)} USDT interest returns to your Earn wallet now.`, "Redeem")) return;
      e.locked = e.locked.filter(x => x.id !== id); e.flexInt += acc; store.addWallet("earn", p.amount + acc, "earn"); store.save();
      S().tx.unshift({id:U.uid(), kind:"deposit", amount:p.amount + acc, method:"Earn redemption", t:Date.now()}); store.save();
      U.fx("claim"); toast(`Redeemed ${eFmt(p.qty, p.coin)} ${p.coin} + ${fmt(acc, 2)} USDT interest`, "ok"); renderPos();
    }
    drawList(); settleMatured(); renderPos();
    $("[data-txh]").onclick = () => U.sheet("Earn history", txList());
    $("[data-sub]").onclick = () => openSub("BTC", 0);
    $("[data-red]").onclick = openRedeem;
    $("[data-yh]").onclick = earnYieldHelp;
    $("#ePt").onclick = e => { const a = e.target.closest("[data-t]"); if (!a) return; e.preventDefault(); tab = a.dataset.t; r.querySelectorAll("#ePt [data-t]").forEach(x => x.classList.toggle("on", x === a)); drawList(); };
    $("#eTerms").onclick = e => { const b = e.target.closest("[data-term]"); if (!b) return; term = +b.dataset.term; r.querySelectorAll("#eTerms [data-term]").forEach(x => x.classList.toggle("on", x === b)); drawList(); };
    r.addEventListener("click", async e => {
      const rl = e.target.closest("[data-rl]");
      if (rl){
        const p = earnS().locked.find(x => x.id === rl.dataset.rl); if (!p) return;
        if (!await U.confirmBox("Redeem early?", `Early redemption forfeits all accrued interest (${fmt(lockedAcc(p), 2)} USDT). ${money(p.amount)} USDT principal returns to your Earn wallet now.`, "Redeem early", true)) return;
        const e2 = earnS(); e2.locked = e2.locked.filter(x => x.id !== p.id); store.addWallet("earn", p.amount, "earn"); store.save();
        S().tx.unshift({id:U.uid(), kind:"deposit", amount:p.amount, method:"Earn early redemption", t:Date.now()}); store.save();
        U.fx("claim"); toast(`Redeemed ${money(p.amount)} USDT, interest forfeited`, "ok"); return renderPos();
      }
      const rn = e.target.closest("[data-rfn]"); if (rn) return redeemFlexN(rn.dataset.rfn);
      if (e.target.closest("[data-rf]")) return openRedeem();
      const pr = e.target.closest("[data-p]"); if (pr){ const [c, d] = pr.dataset.p.split(":"); openSub(c, +d); }
    });
    const iv = setInterval(() => { if (settleMatured()) renderPos(); else upd(); }, 1000);
    const offs = [bus.on("vault", renderPos)]; this.unmount = () => { clearInterval(iv); offs.forEach(f => f()); };
  }};
};


/* ---------- Bots (BingX style) ---------- */
const BOT_TAG = {usdcgrid:"Spot Grid", grid:"Spot Grid", combo:"Futures Martingale", gold:"Futures Grid", fx:"Futures Grid", dca:"DCA Perp"};
const STRATS = [
  {k:"fgrid", g:"perp", name:"Futures Grid", def:"gold", hot:true, desc:"Profit from price swings inside a range, with leverage"},
  {k:"fmart", g:"perp", name:"Futures Martingale", def:"combo", hot:true, desc:"Scale into dips to lower your average entry price"},
  {k:"dcap", g:"perp", name:"DCA Perp", def:"dca", hot:false, desc:"Average into a perpetual position at regular intervals with safety orders"},
  {k:"auto", g:"binary", bin:true, name:"Auto Trade", hot:true, desc:"Signal bot: places binary Up / Down trades for you automatically, one at a time"},
  {k:"bmart", g:"binary", bin:true, name:"Binary Martingale", hot:false, desc:"Counter-trend entries on 60s expiries, stake doubles after a loss to recover it"},
  {k:"trend", g:"binary", bin:true, name:"Trend Follower", hot:false, desc:"Follows momentum and opens trades in the direction of the trend"},
  {k:"sgrid", g:"spot", name:"Spot Grid", def:"grid", hot:true, desc:"Buys low and sells high inside a price range, 24/7"},
  {k:"sdca", g:"spot", name:"Smart DCA", def:"dca", hot:false, desc:"Dollar-cost averages into dips with safety orders"},
  {k:"ugrid", g:"spot", name:"USDC ⇄ USDT Grid", def:"usdcgrid", hot:true, desc:"Grid-trades USDC/USDT in a tight range: buy low, sell high. 0 trading fee"},
  {k:"rebal", g:"spot", name:"Rebalancing", soon:true, desc:"Keeps your coins at target weights by trading the difference automatically"},
  {k:"twap", g:"spot", name:"TWAP / Smart Order", soon:true, desc:"Splits one big order into small slices over time to get a better average price"}
];
const demoInv = k => { const h = HM.hash(k); return fmt2(420000 + (h % 8600000) + (h % 100) / 100); };
const fmt2 = v => v.toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2});
const demoUsers = k => (640 + HM.hash(k + "u") % 8900).toLocaleString("en-US");
const avs = k => `<span class="bt-avs">${[0,1,2].map(i => `<span>${HM.avatar(k + i, 22)}</span>`).join("")}</span>`;

Pages.bots = (params) => {
  let view = "bots", tab = /[?&]t=(binary|spot|perp)/.test(location.hash) ? RegExp.$1 : (sessionStorage.getItem("btTab") || "perp");
  const html = `<div class="bt-page"><header class="bt-head"><button class="icon-btn" data-back aria-label="Go back">${ic("back",22)}</button><h1>Bots</h1><button class="icon-btn" data-dots aria-label="More">${ic("dots",22)}</button></header>
    <section class="bt-sum"><button class="bt-lbl" data-eye>Total Assets (USDT) <span data-ey>${ic(S().settings.hideBal ? "eyeoff" : "eye",15)}</span></button><div class="bt-big num" data-ta></div><div class="bt-pn"><u>Today's PnL</u> <b class="num" data-tp></b></div></section>
    <div id="btBody"></div>
    <nav class="bt-fnav" aria-label="Bots sections"><button data-v="bots" class="on">${ic("bot",18)}<span>Bots</span></button><button data-v="inv">${ic("wallet",18)}<span>My Investment</span></button></nav></div>`;
  return {html, title:"Trading Bots", mount(r){
    const $ = q => r.querySelector(q);
    const pnlCls = v => v >= 0 ? "up" : "down";
    const defOf = id => E.BOTS.find(x => x.id === id);
    const sum = () => {
      let inv = 0, tot = 0; E.BOTS.forEach(d => { const b = S().bots[d.id]; if (b?.running){ inv += b.invest; tot += E.botPnl(d.id); } });
      const hide = S().settings.hideBal;
      $("[data-ta]").textContent = hide ? "******" : money(S().balance + inv + tot);
      const tp = $("[data-tp]"); tp.textContent = hide ? "****" : signed(tot) + " USDT"; tp.className = "num " + (tot > 0 ? "up" : tot < 0 ? "down" : "");
    };
    const card = s => { const d = s.def && defOf(s.def), on = s.bin ? !!E.binCfg(s.k)?.on : d && S().bots[d.id]?.running;
      return `<div class="bt-card"><div class="bt-ch"><b>${esc(s.name)}</b>${s.hot ? `<span class="bt-hot">Hot</span>` : ""}</div><p>${esc(s.desc)}</p>
        <div class="bt-ti"><span>Total Investment</span><b class="num">${demoInv(s.k)} USDT</b></div>${s.g === "perp" || s.k === "ugrid" ? `<div class="bt-roi" data-roi="${s.k}"></div>` : ""}
        <div class="bt-cf"><div><span>Users</span><div class="bt-us">${avs(s.k)}<b class="num">${demoUsers(s.k)}</b></div></div>${s.soon ? `<button class="bt-cb" disabled aria-disabled="true">Coming soon</button>` : on ? `<span class="bt-run">Running</span>` : `<button class="bt-cb" data-create="${s.k}">${s.bin && E.binCfg(s.k)?.created ? "Edit" : "Create"}</button>`}</div></div>`; };
    const drawBots = () => {
      $("#btBody").innerHTML = `<div class="bt-tabs"><button data-t="spot" class="${tab === "spot" ? "on" : ""}">Spot</button><button data-t="perp" class="${tab === "perp" ? "on" : ""}">Perp</button><button data-t="binary" class="${tab === "binary" ? "on" : ""}">Binary</button></div>
        <div class="bt-list">${STRATS.filter(s => s.g === tab).map(card).join("")}</div>
        <p class="pm-risk" style="margin-top:12px">Bots trade on live prices. Past performance does not guarantee future results.</p>`;
      if (window.BOTX) setTimeout(() => $("#btBody") && BOTX.fill($("#btBody")), 60);
    };
    const drawInv = () => {
      const run = E.BOTS.filter(d => S().bots[d.id]?.running), hist = E.BOTS.filter(d => { const b = S().bots[d.id]; return b && !b.running && b.stopped; }).sort((a,b) => S().bots[b.id].stopped - S().bots[a.id].stopped);
      const bins = E.binBots(), binRun = bins.filter(x => x.cfg.on);
      const binCard = x => { const a = x.cfg, p = M.get(a.pair), wr = (a.wins || 0) + (a.losses || 0) ? Math.round((a.wins || 0) / ((a.wins || 0) + (a.losses || 0)) * 100) + "%" : "--";
        return `<div class="bt-card" data-binbot="${x.id}"><div class="bt-ch">${UI.pairIcon(p, 26)}<b>${esc(a.name || x.kind.name)}</b><span class="bt-pill">Binary</span><span class="bt-sp"><span class="bt-st ${a.on ? "on" : ""}">${a.on ? "Running" : "Stopped"}</span></span></div>
          <div class="bt-g"><div><span>Trades</span><b class="num">${a.count || 0}</b></div><div><span>PnL (USDT)</span><b class="num ${pnlCls(a.pnl || 0)}">${signed(a.pnl || 0)}</b></div><div><span>Win rate</span><b class="num">${wr}</b></div></div>
          <div class="bt-sub">${esc(p ? M.label(p) : a.pair)} · ${money(a.amount)} USDT · ${UI.expLabel(a.expiry)} · wait ${a.interval}s</div>
          <div class="bt-btns"><button class="bt-edit" data-binedit="${x.id}">Edit</button>${a.on ? `<button class="bt-stop" data-binstop="${x.id}">Stop</button>` : `<button class="bt-start" data-binstart="${x.id}">Start</button>`}</div></div>`; };
      $("#btBody").innerHTML = `<h3 class="bt-h">Running (${run.length + binRun.length})</h3>` + (run.length + binRun.length ? binRun.map(binCard).join("") + run.map(d => { const b = S().bots[d.id], p = M.get(d.pair);
        return `<div class="bt-card" data-bot="${d.id}"><div class="bt-ch">${UI.pairIcon(p, 26)}<b>${esc(d.name)}</b><span class="bt-pill">${BOT_TAG[d.id] || d.tag || "Bot"}</span><span class="bt-sp" data-sp></span></div>
          <div class="bt-g"><div><span>PnL (USDT)</span><b class="num" data-pnl>--</b></div><div><span>Invested</span><b class="num">${money(b.invest)}</b></div><div><span>Runtime</span><b data-rt>--</b></div></div>
          <div class="bt-btns"><button class="bt-stop" data-stop>Stop</button></div></div>`; }).join("") : pemp("No running bots", "Create a bot from the Bots tab."))
        + (bins.filter(x => !x.cfg.on).length ? `<h3 class="bt-h">Stopped binary bots</h3>` + bins.filter(x => !x.cfg.on).map(binCard).join("") : "")
        + `<h3 class="bt-h">History</h3>` + (hist.length ? hist.map(d => { const b = S().bots[d.id];
        return `<div class="bt-card"><div class="bt-ch">${UI.pairIcon(M.get(d.pair), 26)}<b>${esc(d.name)}</b><span class="bt-pill">${BOT_TAG[d.id] || d.tag || "Bot"}</span></div>
          <div class="bt-g"><div><span>PnL (USDT)</span><b class="num ${pnlCls(b.pnl)}">${signed(b.pnl)}</b></div><div><span>Invested</span><b class="num">${money(b.invest)}</b></div><div><span>Stopped</span><b>${fdate(b.stopped)}</b></div></div></div>`; }).join("") : pemp("No history yet", "Stopped bots show up here."));
      tick();
    };
    const tick = () => { sum();
      if (view !== "inv") return;
      E.BOTS.forEach(d => { const b = S().bots[d.id]; if (!b?.running) return; const c = r.querySelector(`[data-bot="${d.id}"]`); if (!c) return; const v = E.botPnl(d.id);
        const el = c.querySelector("[data-pnl]"); el.textContent = signed(v) + " (" + pct(v / b.invest * 100) + ")"; el.className = "num " + pnlCls(v);
        c.querySelector("[data-rt]").textContent = runtime(b.since); c.querySelector("[data-sp]").innerHTML = spark(b.series.concat(v), 72, 26); });
    };
    const draw = () => { r.querySelectorAll("[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === view)); view === "bots" ? drawBots() : drawInv(); sum(); };
    draw();
    $("[data-dots]").onclick = () => U.sheet("About Bots", `<p class="pm-s" style="font-size:13px;line-height:1.6;margin:0 0 12px">Trading bots follow a fixed strategy on live prices. Funds are returned to your Trading account with PnL when you stop a bot. Results depend on market conditions.</p><a class="btn btn-primary pm-cta" href="#/academy" data-x>Learn more</a>`, el => el.querySelector("[data-x]").addEventListener("click", () => U.closeLayer()));
    $("[data-eye]").onclick = () => { S().settings.hideBal = !S().settings.hideBal; store.save(); $("[data-ey]").innerHTML = ic(S().settings.hideBal ? "eyeoff" : "eye", 15); sum(); };
    r.addEventListener("click", async e => {
      const vb = e.target.closest("[data-v]"); if (vb){ view = vb.dataset.v; return draw(); }
      const tb = e.target.closest("[data-t]"); if (tb){ tab = tb.dataset.t; try { sessionStorage.setItem("btTab", tab); } catch {} return draw(); }
      const be = e.target.closest("[data-binedit]"); if (be) return UI.binBotEdit(be.dataset.binedit, () => draw());
      const bs = e.target.closest("[data-binstart]"); if (bs){ const id = bs.dataset.binstart, a = E.binCfg(id), err = UI.binBotCheck(a); if (err){ toast(err, "bad"); UI.walletErr && UI.walletErr(err); return; } E.startAuto({pair:a.pair, amount:a.amount, expiry:a.expiry, strategy:a.strategy, interval:a.interval, max:a.max}, id); toast("Bot started", "ok"); return draw(); }
      const bp = e.target.closest("[data-binstop]"); if (bp){ if (await U.confirmBox("Stop bot?", "It will not open new trades. Trades that are already open finish normally.", "Stop bot", true)){ E.stopAuto("Stopped by you.", bp.dataset.binstop); toast("Bot stopped", "info"); draw(); } return; }
      const cr = e.target.closest("[data-create]");
      if (cr){
        const s = STRATS.find(x => x.k === cr.dataset.create);
        if (s.bin) return UI.binBotEdit(s.k, () => { view = "inv"; draw(); });
        if (window.BOTX && s.k === "ugrid") return BOTX.openUgrid(() => { view = "inv"; draw(); });
        if (window.BOTX && s.g === "perp") return BOTX.open(s, () => { view = "inv"; draw(); });
        const d = defOf(s.def), p = M.get(d.pair);
        return U.sheet("Create " + s.name, `<div class="pm-kv" style="padding-top:2px"><span>Strategy</span><b>${esc(s.name)}</b></div><div class="pm-kv"><span>Pair</span><b>${esc(M.label(p || {type:"crypto", base:d.pair}))}</b></div><div class="pm-kv"><span>Risk</span><b>${d.risk}</b></div><div class="pm-kv"><span>Est. APY</span><b class="num up">${esc(d.apy)}</b></div>
          <p class="pm-s" style="margin:6px 0 0">${esc(s.desc)}</p>
          <span class="pm-lbl">Investment</span><div class="pm-fld" id="pmBf"><input id="pmBa" type="number" inputmode="decimal" min="10" value="100" aria-label="Investment amount"><span class="u">USDT</span><button type="button" class="mx" data-max>Max</button></div>
          <div class="pm-kv" style="margin-top:8px"><span>Avbl (${d.wallet === "spot" ? "Spot" : "Futures"})</span><b class="num">${money(store.wb(d.wallet))} USDT <button class="wl-plus" data-wlto="${d.wallet}" aria-label="Transfer in">${ic("plus",13,3)}</button></b></div><div class="pm-kv"><span>Minimum</span><b class="num">10 USDT</b></div>
          <div class="pm-err" id="pmBe"></div><button class="btn btn-primary pm-cta" data-ok>Start bot</button>`, el => {
          el.querySelector("[data-max]").onclick = () => el.querySelector("#pmBa").value = Math.floor(store.wb(d.wallet) * 100) / 100;
          el.querySelector("[data-ok]").onclick = () => { const err = E.startBot(d.id, parseFloat(el.querySelector("#pmBa").value));
            el.querySelector("#pmBe").textContent = err || ""; if (err) UI.walletErr(err); el.querySelector("#pmBf").classList.toggle("err", !!err); if (err) return;
            U.closeLayer(); toast("Bot started", "ok"); view = "inv"; draw(); };
        });
      }
      const st = e.target.closest("[data-stop]"), c = st && st.closest("[data-bot]");
      if (c && await U.confirmBox("Stop bot?", "Your investment plus PnL will be returned to your Trading account.", "Stop bot", true)){ const v = E.stopBot(c.dataset.bot); toast(`Bot stopped: ${signed(v)} USDT`, v >= 0 ? "ok" : "info"); draw(); }
    });
    const iv = setInterval(tick, 2000), off = bus.on("bots", tick), off2 = bus.on("balance", sum), off3 = bus.on("auto", () => { if (view === "inv" && document.body.contains(r)) drawInv(); });
    this.unmount = () => { clearInterval(iv); off(); off2(); off3(); };
  }};
};

/* ---------- Binary bots (Auto Trade lives inside Trading Bots now; #/auto redirects there) ---------- */
Pages.auto = () => ({html: `<div style="padding:40px 16px;text-align:center" class="sub">Opening Trading Bots…</div>`, title: "Trading Bots", mount(){ location.replace("#/bots?t=binary"); }});
const BCOOL = [5, 10, 30, 60, 120, 300], cdLabel = x => x < 60 ? x + "s" : x / 60 + "m";
/* validation shared by the Start buttons (Bots page and the Bots tab of the Binary page) */
UI.binBotCheck = a => { const p = M.get(a.pair);
  return !(a.amount >= 1) ? "Minimum amount is 1 USDT." : a.amount > store.wb("binary") + 1e-9 ? "Insufficient Binary balance" : !(a.max >= 1 && a.max <= 500) ? "Stop after must be between 1 and 500." : !p ? "Choose a pair." : p.closed ? "Market closed for this pair. Choose a crypto pair." : M.isStale(p) ? "Market data offline for this pair. Try again shortly." : ""; };
/* create / edit sheet for a binary bot. Editing a running bot applies the new values from its next trade. */
UI.binBotEdit = (id, done) => {
  const kind = E.BIN_KINDS[id] || E.BIN_KINDS.auto, a0 = E.binCfg(id) || {}, running = !!a0.on;
  const cfg = {pair: a0.pair || S().auto.pair || "BTCUSDT", amount: a0.amount || 10, expiry: a0.expiry || kind.expiry, strategy: a0.strategy || kind.strategy, interval: a0.interval || 20, max: a0.max || 20};
  if (!M.get(cfg.pair) || !M.get(cfg.pair).tradable) cfg.pair = "BTCUSDT";
  const exps = UI.binExps || C.EXPIRIES, seg = (g, items, cur) => `<div class="seg" data-g="${g}">${items.map(([v, n]) => `<button type="button" data-v="${v}" class="${cur === v ? "on" : ""}">${n}</button>`).join("")}</div>`;
  U.sheet((running ? "Edit " : a0.created ? "Edit " : "Create ") + kind.name, `<div class="bb-sheet"><p class="pm-s" style="margin:0 0 10px">${esc(kind.desc)} <button type="button" class="bx-q" data-info="bbot" aria-label="How bots trade">?</button></p>
    <span class="pm-lbl">Pair</span>${UI.pairField("bbPair", cfg.pair, "Pair")}
    <span class="pm-lbl">Amount per trade</span><div class="pm-fld" id="bbAf"><input id="bbAmt" type="number" inputmode="decimal" min="1" value="${cfg.amount}" aria-label="Amount per trade in USDT"><span class="u">USDT</span></div>
    <span class="pm-lbl">Expiry <button type="button" class="bx-q" data-info="bexp" aria-label="What is expiry?">?</button></span>${seg("expiry", exps.map(x => [x, UI.expLabel(x)]), cfg.expiry)}
    <span class="pm-lbl">Strategy</span>${seg("strategy", [["trend", "Trend follow"], ["reversal", "Reversal"], ["random", "Random"]], cfg.strategy)}
    <span class="pm-lbl">Wait after each trade <button type="button" class="bx-q" data-info="bwait" aria-label="Why wait?">?</button></span>${seg("interval", BCOOL.map(x => [x, cdLabel(x)]), cfg.interval)}
    <span class="pm-lbl">Stop after (trades)</span><div class="pm-fld"><input id="bbMax" type="number" inputmode="numeric" min="1" max="500" value="${cfg.max}" aria-label="Stop after trades"></div>
    <div class="pm-kv" style="margin-top:8px"><span>Avbl (Binary)</span><b class="num">${money(store.wb("binary"))} USDT <button class="wl-plus" data-wlto="binary" aria-label="Transfer in">${ic("plus", 13, 3)}</button></b></div>
    <div class="pm-err" id="bbErr"></div>
    <button class="btn btn-primary pm-cta" data-ok>${running ? "Save changes" : "Start bot"}</button>${running ? `<button class="btn btn-block bb-stop" data-stop style="margin-top:8px">Stop bot</button>` : a0.created ? `<button class="btn btn-block" data-save style="margin-top:8px">Save without starting</button>` : ""}</div>`, el => {
    const $ = q => el.querySelector(q);
    el.querySelectorAll("[data-g]").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => { cfg[g.dataset.g] = isNaN(b.dataset.v) ? b.dataset.v : +b.dataset.v; g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); }));
    $("#bbPair").onclick = () => UI.pairPopup({cur: cfg.pair, payout: true, title: "Select pair", list: [...M.pairs.values()].filter(p => p.tradable).sort((x, y) => (x.type === "crypto" ? x.rank || 999 : 500) - (y.type === "crypto" ? y.rank || 999 : 500)).slice(0, 120), onPick: sym => { cfg.pair = sym; UI.pairFieldSet($("#bbPair"), sym); }});
    const read = () => Object.assign(cfg, {amount: parseFloat($("#bbAmt").value), max: parseInt($("#bbMax").value)});
    const fail = err => { $("#bbErr").textContent = err; $("#bbAf").classList.toggle("err", !!err); if (err){ toast(err, "bad"); UI.walletErr && UI.walletErr(err); } return !!err; };
    $("[data-ok]").onclick = () => { read();
      if (running){ if (fail(!(cfg.amount >= 1) ? "Minimum amount is 1 USDT." : !(cfg.max >= 1 && cfg.max <= 500) ? "Stop after must be between 1 and 500." : "")) return; E.updateBinBot(id, cfg); U.closeLayer(); toast("Bot updated", "ok"); return done && done(); }
      if (fail(UI.binBotCheck(cfg))) return; E.startAuto(cfg, id); U.closeLayer(); toast("Bot started", "ok"); done && done(); };
    const sv = $("[data-save]"); if (sv) sv.onclick = () => { read(); if (fail(!(cfg.amount >= 1) ? "Minimum amount is 1 USDT." : "")) return; E.updateBinBot(id, cfg); U.closeLayer(); toast("Bot saved", "ok"); done && done(); };
    const st = $("[data-stop]"); if (st) st.onclick = () => { E.stopAuto("Stopped by you.", id); U.closeLayer(); toast("Bot stopped", "info"); done && done(); };
  });
};
/* ---------- VIP signals: feature removed; old links go home ---------- */
Pages.vip = () => ({html:`<div class="pm-page"></div>`, title:"Home", mount(){ location.replace("#/home"); }});

/* ---------- User avatar helper ---------- */
const initialsAv = (name, size) => `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:50%;background:var(--card-2);color:var(--text);font-weight:700;font-size:${Math.round(size * .42)}px">${esc((name || "T")[0].toUpperCase())}</span>`;
window.UserAvatar = (size = 34) => {
  const p = S().profile || {};
  if (p.avatar) return `<img src="${p.avatar}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block">`;
  return window.HM && HM.avatar ? HM.avatar(p.name || "Trader", size) : initialsAv(p.name, size);
};
const sec = () => { const s = S(); s.security = Object.assign({passkey:false, ga:false, email:true, phone:true, fund:false, password:true, trusted:true, phish:"", face:false, applock:false}, s.security || {}); return s.security; };
const maskEmail = e => { const [u, d] = String(e || "").split("@"); return d ? (u.slice(0, 2) + "***@" + d) : ""; };
const COUNTRIES = ["India","United States","United Kingdom","Canada","Australia","Singapore","United Arab Emirates","Saudi Arabia","Pakistan","Bangladesh","Sri Lanka","Nepal","Indonesia","Malaysia","Philippines","Vietnam","Thailand","Japan","South Korea","China","Hong Kong","Germany","France","Spain","Italy","Netherlands","Turkey","Brazil","Nigeria","South Africa","Kenya","Russia","Ukraine"];
const chevR = ic("chev", 16);

/* ---------- Profile edit (BingX "Personal Information") ---------- */
Pages.profileedit = () => {
  const row = (label, f, right) => `<button class="pm-row tap pe-row" data-f="${f}"><div class="pm-main"><div class="pm-t">${label}</div></div><span class="pe-v" data-v="${f}">${right}</span><span class="pe-ch">${chevR}</span></button>`;
  const vals = () => { const p = S().profile; return {
    avatar: `<span class="pe-av">${UserAvatar(44)}</span>`, name: esc(p.name), gender: esc(p.gender || "Not set"), bio: esc(p.bio ? (p.bio.length > 18 ? p.bio.slice(0, 18) + "…" : p.bio) : "Not set"),
    country: esc(p.country || "Not set"), email: esc(p.email ? maskEmail(p.email) : "Link now"), ref: esc(p.refBy || "None") }; };
  const v0 = vals();
  const html = pwrap("Personal Information", `<input type="file" accept="image/*" id="peFile" hidden>
    <section class="pm-sec pe-sec">${row("Avatar", "avatar", v0.avatar)}${row("Nickname", "name", v0.name)}${row("Gender", "gender", v0.gender)}${row("Bio / Homepage", "bio", v0.bio)}${row("Location", "country", v0.country)}</section>
    <section class="pm-sec pe-sec">${row("Link Email", "email", v0.email)}${row("My Referrer", "ref", v0.ref)}</section>
    <p class="pm-note">Your profile is stored on this device only.</p>`, {right:`<span class="icon-btn" aria-hidden="true"></span>`});
  return {html, title:"Personal Information", mount(r){
    const $ = q => r.querySelector(q), P = () => S().profile;
    const refresh = () => { const v = vals(); Object.keys(v).forEach(k => { const el = $(`[data-v="${k}"]`); if (el) el.innerHTML = v[k]; }); };
    const saved = m => { store.save(); refresh(); toast(m || "Saved", "ok"); };
    const opts = (title, list, cur, onPick) => U.sheet(title, `<div class="pe-opts">${list.map(x => `<button class="pe-opt ${x === cur ? "on" : ""}" data-o="${esc(x)}"><span>${esc(x)}</span>${x === cur ? ic("check", 18, 2) : ""}</button>`).join("")}</div>`, el => el.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { U.closeLayer(); onPick(b.dataset.o); }));
    const inputSheet = (title, val, ph, max, check, onSave, multi) => U.sheet(title, `${multi ? `<textarea class="pm-ta" id="peI" maxlength="${max}" placeholder="${esc(ph)}">${esc(val)}</textarea>` : `<input class="pm-in" id="peI" maxlength="${max}" placeholder="${esc(ph)}" value="${esc(val)}" aria-label="${esc(title)}">`}<div class="pm-err" id="peE"></div><button class="btn btn-primary pm-cta" data-sv style="margin-top:12px">Save</button>`, el => {
      el.querySelector("[data-sv]").onclick = () => { const v = el.querySelector("#peI").value.trim(), e = check(v); if (e){ el.querySelector("#peE").textContent = e; return; } U.closeLayer(); onSave(v); }; });
    const resize = file => new Promise((ok, no) => { const fr = new FileReader(); fr.onerror = no; fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      const S2 = 256, c = document.createElement("canvas"); c.width = c.height = S2; const x = c.getContext("2d"), m = Math.min(im.width, im.height);
      x.fillStyle = "#fff"; x.fillRect(0, 0, S2, S2); x.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, S2, S2); ok(c.toDataURL("image/jpeg", .86)); }; im.src = fr.result; }; fr.readAsDataURL(file); });
    $("#peFile").onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      try { P().avatar = await resize(f); saved("Photo updated"); } catch { toast("Could not read that image", "bad"); } };
    r.addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (!b) return; const f = b.dataset.f;
      if (f === "avatar") return U.sheet("Avatar", `<div style="display:flex;justify-content:center;padding:6px 0 16px">${UserAvatar(96)}</div><button class="btn btn-primary pm-cta" data-up>Choose photo</button>${P().avatar ? `<button class="btn btn-ghost pm-cta" data-rm style="margin-top:10px">Remove photo</button>` : ""}`, el => {
        el.querySelector("[data-up]").onclick = () => { U.closeLayer(); $("#peFile").click(); };
        const rm = el.querySelector("[data-rm]"); if (rm) rm.onclick = () => { delete P().avatar; U.closeLayer(); saved("Photo removed"); }; });
      if (f === "name") return inputSheet("Nickname", P().name, "2-20 characters", 20, v => v.length < 2 || v.length > 20 ? "Nickname must be 2-20 characters." : "", v => { P().name = v; saved("Nickname updated"); });
      if (f === "gender") return opts("Gender", ["Male", "Female", "Prefer not to say"], P().gender, v => { P().gender = v; saved(); });
      if (f === "bio") return inputSheet("Bio / Homepage", P().bio || "", "Tell traders about yourself", 120, () => "", v => { P().bio = v; saved(); }, true);
      if (f === "country") return opts("Location", COUNTRIES, P().country, v => { P().country = v; saved(); });
      if (f === "email") return inputSheet("Link Email", P().email || "", "name@example.com", 60, v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? "" : "Enter a valid email address.", v => { P().email = v; sec().email = true; saved("Email linked"); });
      if (f === "ref") return U.sheet("My Referrer", P().refBy ? `<div class="pm-kv"><span>Referrer code</span><b>${esc(P().refBy)}</b></div>` : `<p class="pm-s" style="font-size:13px;line-height:1.6">You did not sign up with a referral code.</p>`);
    });
  }};
};

/* ---------- Security Center (BingX style) ---------- */
Pages.security = () => {
  const ITEMS = [["passkey", "Passkeys", "key", "Sign in with your fingerprint, face or screen lock instead of a password."], ["ga", "Google Authenticator", "shield", "Generate one-time codes for login and withdrawals."], ["email", "Email", "mail", "Receive login alerts and verification codes by email."], ["phone", "Phone Number", "phone", "Receive SMS verification codes."], ["fund", "Fund Password", "lock", "A separate password to authorise withdrawals and transfers."], ["password", "Password", "lock", "The password you use to log in."]];
  const level = () => { const s = sec(); return Math.min(5, ITEMS.filter(i => s[i[0]]).length); };
  const lvName = n => n >= 4 ? "High" : n >= 3 ? "Medium" : "Low";
  const ring = n => { const R = 34, C2 = 2 * Math.PI * R, off = C2 * (1 - n / 5); return `<svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="42" cy="42" r="${R}" fill="none" stroke="${n >= 4 ? "var(--up)" : n >= 3 ? "#F7931A" : "var(--down)"}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C2.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 42 42)"/><text x="42" y="47" text-anchor="middle" font-size="18" font-weight="800" fill="var(--text)" font-family="inherit">${n}/5</text></svg>`; };
  const st = (on, a = "Enabled", b = "Not set") => `<span class="sc-st ${on ? "on" : ""}">${on ? a : b}</span>`;
  const trow = (label, f, right, sub) => `<button class="pm-row tap" data-f="${f}"><div class="pm-main"><div class="pm-t">${label}</div>${sub ? `<div class="pm-s">${sub}</div>` : ""}</div>${right}<span class="pe-ch">${chevR}</span></button>`;
  const srow = (label, f, on, sub) => `<div class="pm-row"><div class="pm-main"><div class="pm-t">${label}</div><div class="pm-s">${sub}</div></div>${swb("sec." + f, on)}</div>`;
  const draw = () => { const s = sec(), n = level();
    return `<section class="sc-hero"><div class="sc-ring" data-ring>${ring(n)}</div><div><div class="sc-lv">Security level: <b>${lvName(n)}</b></div><p>Enable more protections to keep your account safe.</p></div></section>
    ${psec("Security", ITEMS.map(i => trow(i[1], i[0], st(s[i[0]], i[0] === "password" ? "Set" : "Enabled")) ).join(""))}
    ${psec("Advanced", trow("Trusted Device", "trusted", st(s.trusted, "1 device"), "Devices that skip extra verification") + trow("Anti-Phishing Code", "phish", st(!!s.phish, "Set"), "Shown in every email from us") + srow("Facial recognition", "face", s.face, "Unlock sensitive actions with Face ID") + srow("App Lock", "applock", s.applock, "Require unlock when opening the app"))}
    ${psec("Account Management", trow("Account activities", "acts", "", "Last login " + U.dateStr(Date.now())) + trow("Lock account", "lock", "") + trow('<span class="pm-danger">Delete account</span>', "del", ""))}`; };
  return {html: pwrap("Security Center", `<div id="scBody">${draw()}</div><p class="pm-note">No credentials leave this device.</p>`, {right:`<span class="icon-btn" aria-hidden="true"></span>`}), title:"Security Center", mount(r){
    const body = r.querySelector("#scBody"), redraw = () => { body.innerHTML = draw(); };
    const setupSheet = k => { const it = ITEMS.find(i => i[0] === k), s = sec(), on = s[k], pw = k === "fund" || k === "password";
      U.sheet(it[1], `<p class="pm-s" style="font-size:13px;line-height:1.6;margin:0 0 12px">${it[3]}</p>${pw ? `<input class="pm-in" id="scP" type="password" placeholder="${on ? "New " : ""}${k === "fund" ? "fund password" : "password"} (min 6 characters)" autocomplete="off" aria-label="${it[1]}"><div class="pm-err" id="scE"></div>` : ""}
        <button class="btn btn-primary pm-cta" data-ok style="margin-top:12px">${pw ? (on ? "Change" : "Set") : (on ? "Disable" : "Enable")}</button>`, el => {
        el.querySelector("[data-ok]").onclick = () => { if (pw){ if (el.querySelector("#scP").value.length < 6){ el.querySelector("#scE").textContent = "Use at least 6 characters."; return; } s[k] = true; } else s[k] = !on;
          store.save(); U.closeLayer(); redraw(); toast(it[1] + (pw ? " updated" : s[k] ? " enabled" : " disabled"), "ok"); }; }); };
    r.addEventListener("click", async e => {
      const sw = e.target.closest("[data-sw]"); if (sw){ const k = sw.dataset.sw.split(".")[1], s = sec(); s[k] = !s[k]; store.save(); sw.classList.toggle("on", s[k]); sw.setAttribute("aria-checked", s[k]); return; }
      const b = e.target.closest("[data-f]"); if (!b) return; const f = b.dataset.f, s = sec();
      if (ITEMS.some(i => i[0] === f)) return setupSheet(f);
      if (f === "trusted") return U.sheet("Trusted Device", `<div class="pm-row"><div class="pm-main"><div class="pm-t">This device</div><div class="pm-s">Browser · active now</div></div><b class="pm-s">Current</b></div><div class="pm-row"><div class="pm-main"><div class="pm-t">Trust this device</div><div class="pm-s">Skip extra verification here</div></div>${swb("trusted", s.trusted)}</div>`, el => { const w = el.querySelector("[data-sw]"); w.onclick = () => { s.trusted = !s.trusted; store.save(); w.classList.toggle("on", s.trusted); w.setAttribute("aria-checked", s.trusted); redraw(); }; });
      if (f === "phish") return U.sheet("Anti-Phishing Code", `<p class="pm-s" style="font-size:13px;line-height:1.6;margin:0 0 12px">This code appears in every email we send, so you can spot fakes.</p><input class="pm-in" id="scA" maxlength="20" value="${esc(s.phish)}" placeholder="4-20 letters or numbers" aria-label="Anti-phishing code"><div class="pm-err" id="scE"></div><button class="btn btn-primary pm-cta" data-ok style="margin-top:12px">Save</button>`, el => { el.querySelector("[data-ok]").onclick = () => { const v = el.querySelector("#scA").value.trim(); if (!/^[A-Za-z0-9]{4,20}$/.test(v)){ el.querySelector("#scE").textContent = "Use 4-20 letters or numbers."; return; } s.phish = v; store.save(); U.closeLayer(); redraw(); toast("Anti-phishing code saved", "ok"); }; });
      if (f === "acts") { const now = Date.now(); return U.sheet("Account activities", [["Login", "This device", now], ["Trade placed", "This device", now - 36e5 * 3], ["Login", "This device", now - 864e5]].map(([a, d, t]) => `<div class="pm-row"><div class="pm-main"><div class="pm-t">${a}</div><div class="pm-s">${d}</div></div><span class="pm-s">${U.dateStr(t)}</span></div>`).join("")); }
      if (f === "lock" && await U.confirmBox("Lock account?", "You will be signed out and trading is disabled until you unlock.", "Lock account", true)) toast("Demo account", "info");
      if (f === "del" && await U.confirmBox("Delete account?", "All data and funds are permanently removed.", "Delete account", true)) toast("Demo account", "info");
    });
  }};
};

/* ---------- Referral (BingX style) ---------- */
Pages.referral = () => {
  const p = S().profile, link = location.origin + location.pathname + "#/referral?ref=" + p.ref;
  const short = u => { const x = u.replace(/^https?:\/\//, ""), h = x.split("/")[0]; return x.length > 30 ? h + "/…?ref=" + p.ref : x; };
  const invited = Array.isArray(p.invited) ? p.invited : [], n = invited.length, earned = invited.reduce((a, x) => a + (x.reward || 0), 0);
  const TIERS = [["Bronze", 0, 4, 10], ["Silver", 5, 19, 20], ["Gold", 20, 49, 30], ["Diamond", 50, 1e9, 50]];
  const tier = TIERS.find(x => n >= x[1] && n <= x[2]) || TIERS[0];
  const sv = d => `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const steps = [
    [sv('<circle cx="12" cy="20" r="4"/><circle cx="29" cy="11" r="4"/><circle cx="29" cy="29" r="4"/><path d="M15.5 18l10-5M15.5 22l10 5"/>'), "Share your link", "Send your invite link or code to friends."],
    [sv('<circle cx="20" cy="14" r="6"/><path d="M8 33c1-7 6-10 12-10s11 3 12 10"/><path d="M30 6v6M27 9h6"/>'), "Friend signs up", "They join NovaTrade with your invite code and get a 100 USDT welcome bonus."],
    [sv('<circle cx="20" cy="20" r="13"/><path d="M20 12v16M24 15.5c-1-1.2-2.600-1.700-4-1.700-2.500 0-4 1.200-4 2.900 0 4.200 8.200 2 8.200 6.400 0 1.700-1.700 3-4.200 3-1.700 0-3.400-.6-4.400-1.800"/>'), "Earn commission", "Receive a share of their trading fees, credited instantly."]];
  const art = `<svg class="rf-art" viewBox="0 0 150 150" aria-hidden="true"><defs>
    <radialGradient id="rs1" cx=".32" cy=".28" r=".8"><stop offset="0" stop-color="#f4f7fb"/><stop offset=".5" stop-color="#a9b7cc"/><stop offset="1" stop-color="#4b5a73"/></radialGradient>
    <radialGradient id="rs2" cx=".3" cy=".25" r=".85"><stop offset="0" stop-color="#e3ecff"/><stop offset=".55" stop-color="#7f9bc9"/><stop offset="1" stop-color="#33456b"/></radialGradient>
    <radialGradient id="rs3" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".6" stop-color="#b7c4d8" stop-opacity=".7"/><stop offset="1" stop-color="#6b7b96" stop-opacity=".6"/></radialGradient>
    <linearGradient id="rd1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfd9e8"/><stop offset=".5" stop-color="#7c8ca6"/><stop offset="1" stop-color="#3a475e"/></linearGradient>
    <linearGradient id="rd2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8eef8"/><stop offset="1" stop-color="#8d9db7"/></linearGradient>
    <radialGradient id="rsh"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="78" cy="132" rx="52" ry="9" fill="url(#rsh)"/>
    <ellipse cx="78" cy="108" rx="50" ry="15" fill="url(#rd1)"/><ellipse cx="78" cy="102" rx="50" ry="15" fill="url(#rd2)"/><ellipse cx="78" cy="102" rx="38" ry="10" fill="none" stroke="#fff" stroke-opacity=".5"/>
    <circle cx="62" cy="62" r="34" fill="url(#rs1)"/><ellipse cx="52" cy="48" rx="12" ry="7" fill="#fff" opacity=".45" transform="rotate(-30 52 48)"/>
    <circle cx="112" cy="46" r="20" fill="url(#rs2)"/><ellipse cx="106" cy="38" rx="7" ry="4" fill="#fff" opacity=".5" transform="rotate(-30 106 38)"/>
    <circle cx="112" cy="88" r="13" fill="url(#rs3)" stroke="#fff" stroke-opacity=".5"/><circle cx="26" cy="96" r="8" fill="url(#rs3)" stroke="#fff" stroke-opacity=".4"/></svg>`;
  const shareTxt = "Trade on live markets with NovaTrade. Use my code " + p.ref + " " + link;
  const ico = {
    contacts: ic("users", 22, 1.7), more: ic("dots", 22, 1.7), qr: ic("qr", 22, 1.7),
    x: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.300 21H2.200l7.300-8.300L2 3h6.300l4.400 5.800zm-1.100 16.200h1.700L7.400 4.700H5.600z"/></svg>`,
    tg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M21 4 3 11l5.500 2L10 19l3-3.500 4.500 3.300z"/><path d="m8.500 13 8-6"/></svg>`};
  const sh = (k, label, i) => `<button class="rf-sb" data-sh="${k}"><span>${i}</span><em>${label}</em></button>`;
  const html = pwrap("Refer and Earn", `
    <section class="rf-dark"><div class="rf-top"><div class="rf-tx"><h2>Refer Friends, Earn Up to <i>50%</i> Commission</h2>
      <button class="rf-mng" data-mng>Referral Code Management ${ic("chev", 14)}</button></div>${art}</div>
      <div class="rf-glass">
        <div class="rf-gr"><span>My Commission</span><b>${tier[3]}%</b><button class="rf-up" data-up>Upgrade</button></div>
        <div class="rf-gr"><span>Referral Code</span><b class="rf-mono">${esc(p.ref)}</b><button class="rf-ci" data-cc aria-label="Copy referral code">${ic("copy", 16)}</button></div>
        <div class="rf-gr"><span>Referral Link</span><b class="rf-lk">${esc(short(link))}</b><button class="rf-ci" data-cl aria-label="Copy referral link">${ic("copy", 16)}</button></div>
        <div class="rf-shr">${sh("contacts", "Contacts", ico.contacts)}${sh("x", "X", ico.x)}${sh("tg", "Telegram", ico.tg)}${sh("qr", "QR Code", ico.qr)}${sh("more", "More", ico.more)}</div>
      </div></section>
    <div class="pm-stats">${pstat("Friends invited", n)}${pstat("Rewards earned", fmt(earned, 2) + " USDT")}${pstat("Your tier", tier[0])}${pstat("Commission rate", tier[3] + "%")}</div>
    ${psec("How it works", steps.map(([i, a, b], k) => `<div class="rf-step">${i}<div class="pm-main"><div class="pm-t">${k + 1}. ${a}</div><div class="pm-s">${b}</div></div></div>`).join(""))}
    ${psec("Invite history", n ? invited.slice(0, 30).map(x => prow(esc(x.name || "Friend"), fdate(x.t || Date.now()), `<b class="num up">+${fmt(x.reward || 0, 2)}</b>`)).join("") : `<div class="rf-hist">${pemp("No invites yet", "Friends who join with your code will show up here.")}</div>`)}
    ${psec("FAQ", faq([["Who can I invite?", "Anyone. Share your link on any app or chat."], ["When are rewards paid?", "Commissions are credited instantly when a referred friend trades."], ["How do I move up a tier?", "Invite more friends. Your tier and commission rate rise automatically."], ["Is there a limit?", "No limit on the number of friends you can invite."], ["Is this real money?", "No. NovaTrade is a demo platform, rewards are virtual USDT."]]))}`, {right:`<span class="icon-btn" aria-hidden="true"></span>`});
  return {html, title:"Referral", mount(r){
    const $ = q => r.querySelector(q);
    const nativeShare = () => navigator.share ? navigator.share({title:C.APP_NAME, text:"Trade on live markets with NovaTrade. Use my code " + p.ref, url:link}).catch(() => {}) : U.copyText(link, "Invite link copied");
    const qrSvg = () => { try { if (typeof window.qrcode !== "function") return ""; const q = window.qrcode(0, "M"); q.addData(link); q.make(); const c = q.getModuleCount(); let d = "";
      for (let y = 0; y < c; y++) for (let x = 0; x < c; x++) if (q.isDark(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
      return `<svg viewBox="0 0 ${c + 4} ${c + 4}" width="220" height="220" shape-rendering="crispEdges" role="img" aria-label="Referral QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#111"/></svg>`; } catch { return ""; } };
    $("[data-cc]").onclick = () => U.copyText(p.ref, "Referral code copied");
    $("[data-cl]").onclick = () => U.copyText(link, "Referral link copied");
    $("[data-mng]").onclick = () => U.sheet("Referral Code Management", `<div class="pm-row"><div class="pm-main"><div class="pm-t rf-mono">${esc(p.ref)}</div><div class="pm-s">Default code · ${tier[3]}% commission</div></div><button class="pm-btn" data-c>Copy</button></div><p class="pm-s" style="margin-top:10px">Additional codes are not available in the demo.</p>`, el => el.querySelector("[data-c]").onclick = () => U.copyText(p.ref, "Referral code copied"));
    $("[data-up]").onclick = () => U.sheet("Commission tiers", `<table class="pm-tbl"><thead><tr><th>Tier</th><th>Friends</th><th>Commission</th></tr></thead><tbody>${TIERS.map(x => `<tr class="${x === tier ? "rf-tier-on" : ""}"><td>${x[0]}${x === tier ? ' <span class="pm-pill g">You</span>' : ""}</td><td>${x[2] > 1e8 ? x[1] + "+" : x[1] + "-" + x[2]}</td><td>${x[3]}%</td></tr>`).join("")}</tbody></table><p class="pm-s" style="margin-top:10px">You have invited ${n} friend${n === 1 ? "" : "s"}. Invite more to move up a tier automatically.</p>`);
    r.querySelectorAll("[data-sh]").forEach(b => b.onclick = () => { const k = b.dataset.sh;
      if (k === "contacts" || k === "more") return nativeShare();
      if (k === "x") return window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent("Trade on live markets with NovaTrade. Use my code " + p.ref) + "&url=" + encodeURIComponent(link), "_blank", "noopener");
      if (k === "tg") return window.open("https://t.me/share/url?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent("Trade on live markets with NovaTrade. Use my code " + p.ref), "_blank", "noopener");
      if (k === "qr") { const q = qrSvg(); U.sheet("QR Code", `<div class="rf-qr">${q || '<p class="pm-s">QR code is not available.</p>'}</div><p class="pm-s" style="text-align:center">Scan to open your invite link</p><button class="btn btn-primary pm-cta" data-c style="margin-top:12px">Copy link</button>`, el => el.querySelector("[data-c]").onclick = () => U.copyText(link, "Referral link copied")); } });
  }};
};
Pages.invite = Pages.referral; Pages.refer = Pages.referral;

/* ---------- Profile (BingX style) ---------- */
Pages.profile = () => {
  const L = (icon, name, right, attrs) => `<${attrs.startsWith("href") ? "a" : "button"} class="pf-row" ${attrs}><span class="pf-ic">${ic(icon, 20, 1.7)}</span><span class="pf-n">${name}</span>${right ? `<span class="pf-r">${right}</span>` : ""}${ic("chev", 16)}</${attrs.startsWith("href") ? "a" : "button"}>`;
  const scan = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/></svg>`;
  const tile = (icon, n, attrs) => `<${attrs.startsWith("href") ? "a" : "button"} class="pf-tile" ${attrs}>${ic(icon, 22, 1.7)}<span>${n}</span></${attrs.startsWith("href") ? "a" : "button"}>`;
  const dark = () => document.documentElement.dataset.theme === "dark";
  const G = items => `<div class="pf-grid">${items.map(([i, n, h]) => `<a class="pf-gi" href="${h}">${ic(i, 24, 1.6)}<span>${n}</span></a>`).join("")}</div>`;
  const html = `<div class="pf-page"><header class="pf-top"><button class="pf-circ" data-back aria-label="Go back">${ic("back",20)}</button><span class="grow"></span><button class="pf-ib" data-scan aria-label="Scan">${scan}</button><button class="pf-ib" data-th aria-label="Toggle theme"></button><a class="pf-ib" href="#/settings" aria-label="Settings">${ic("gear",22,1.7)}</a></header>
    <section class="pf-id"><a class="pf-av" id="pa" href="#/profileedit" aria-label="Edit profile"></a><div class="grow" style="min-width:0"><div class="row" style="gap:8px;flex-wrap:nowrap"><button class="pf-nm ellipsis" id="pn" data-edit></button><button class="pf-lv vip-l0" data-lv>VIP0 ${ic("chev",12)}</button></div>
      <div class="row pf-r2" style="gap:6px 8px;margin-top:6px"><button class="pf-uid" data-uid>UID:<span id="pu"></span> ${ic("copy",13)}</button><span class="pf-main">Main Account</span></div></div><a class="pf-go" href="#/profileedit" aria-label="Open profile">${ic("chev",22,2)}</a></section>
    <div class="pf-tiles">${tile("share","Refer",'href="#/referral"')}${tile("gift","Vouchers",'data-vou')}${tile("cal","Events",'href="#/rewards"')}</div>
    <section class="pf-card"><h3 class="pf-h">Trade</h3>
    ${G([["chart","Markets","#/markets"],["swap","Spot","#/spot"],["candle","Futures","#/futures"],["clock","Binary","#/trade"],["layers","Options","#/options"],["users","Copy Trading","#/copy"],["bot","Trading Bots","#/bots"]])}</section>
    <section class="pf-card"><h3 class="pf-h">Earn &amp; Rewards</h3>
    ${G([["earn","Earn","#/earn"],["wallet","Assets","#/assets"],["pie","PnL Analysis","#/pnl"],["trophy","Rewards Hub","#/rewards"],["share","Referral","#/referral"],["ring","Price Alerts","#/alerts"],["book","Academy","#/academy"]])}</section>
    <h3 class="pf-h">Account</h3>
    <section class="pf-list">${L("shield","Verification",'<span class="pf-ok">Verified</span>',"data-ver")}${L("lock","Security Center","",'href="#/security"')}${L("history","Trade History","",'href="#/history"')}${L("gear","Settings & Preferences","",'href="#/settings"')}${L("grid","Practical Functions","","data-prac")}</section>
    <h3 class="pf-h">Help</h3>
    <section class="pf-list">${L("headset","Support","",'href="#/support"')}${L("users","Community","",'href="#/community"')}${L("chat","Feedback","","data-fb")}${L("info","About NovaTrade","",'href="#/about"')}</section>
    <button class="pf-sw" data-switch>Switch Account</button><button class="pf-sw pf-adm" data-adm-switch>Switch to Admin Panel</button></div>`;
  return {html, title:"Profile", mount(r){
    const $ = q => r.querySelector(q);
    const render = () => { const p = S().profile; $("#pa").innerHTML = UserAvatar(64); $("#pn").textContent = p.name; $("#pu").textContent = p.uid; if (window.VIPX){ const t = VIPX.tier(); const lv = $("[data-lv]"); lv.className = "pf-lv vip-l" + t.i; lv.innerHTML = "VIP" + t.i + " " + ic("chev",12); } };
    const syncTh = () => { $("[data-th]").innerHTML = ic(dark() ? "sun" : "moon", 22, 1.7); };
    render(); syncTh();
    $("[data-th]").onclick = () => { App.setTheme(dark() ? "light" : "dark"); syncTh(); };
    $("[data-scan]").onclick = () => window.WDSCAN ? WDSCAN.open() : toast("Scanner is loading, try again", "info");
    $("[data-uid]").onclick = () => U.copyText(S().profile.uid, "UID copied");
    $("[data-switch]").onclick = () => toast("Demo account", "info");
    $("[data-lv]").onclick = () => { if (window.VIPX) return VIPX.open(); const lv = E.level(); U.sheet("Account level", `<div class="pm-kv"><span>Level</span><b>Lv.${lv.lvl}</b></div><div class="pm-kv"><span>XP to next level</span><b class="num">${Math.max(0, lv.need - lv.cur)}</b></div><div class="pm-bar"><i style="width:${Math.min(100, lv.cur / lv.need * 100)}%"></i></div><p class="pm-s" style="margin-top:12px">Trade, complete tasks and check in daily to level up.</p>`); };
    $("[data-edit]").onclick = () => { location.hash = "#/profileedit"; };
    $("[data-vou]").onclick = () => U.sheet("Vouchers", [["Trading fee coupon","5 USDT","Valid for 30 days"],["Futures bonus voucher","20 USDT","Valid for 14 days"]].map(([n,v,e]) => `<div class="pf-vou"><div><b>${n}</b><span>${e}</span></div><b class="num">${v}</b></div>`).join("") + `<p class="pm-s" style="margin-top:10px">Demo vouchers. They cannot be redeemed.</p>`);
    $("[data-ver]").onclick = () => U.sheet("Verification", `<div class="pm-kv" style="padding-top:2px"><span>Identity (KYC)</span><b class="up">Verified</b></div><div class="pm-kv"><span>Address proof</span><b class="up">Verified</b></div><div class="pm-kv"><span>Withdrawal limit</span><b>Unlimited (demo)</b></div>`);
    $("[data-fb]").onclick = () => U.sheet("Feedback", `<textarea class="pm-ta" id="fbt" placeholder="Tell us what to improve" aria-label="Feedback"></textarea><div class="pm-err" id="fbe"></div><button class="btn btn-primary pm-cta" data-sv>Submit</button>`, el => {
      el.querySelector("[data-sv]").onclick = () => { if (el.querySelector("#fbt").value.trim().length < 3){ el.querySelector("#fbe").textContent = "Please write a few words."; return; } U.closeLayer(); toast("Thanks for your feedback", "ok"); };
    });
    $("[data-prac]").onclick = () => { U.sheet("Practical Functions", `<div class="pf-list" style="margin:0">${L("ring","Price alerts","",'href="#/alerts" data-x')}${L("history","Trade history","","data-th2")}${L("wallet","Transactions","","data-tx")}${L("trophy","Rewards Hub","",'href="#/rewards" data-x')}${window.ACCT && ACCT.isReal() ? "" : L("reset","Reset demo account","","data-reset")}</div>`, el => {
      el.querySelectorAll("[data-x]").forEach(a => a.addEventListener("click", () => U.closeLayer()));
      el.querySelector("[data-tx]").onclick = () => U.sheet("Transactions", txList());
      el.querySelector("[data-th2]").onclick = () => { const h = S().history.slice(0, 100); U.sheet("Trade history", h.length ? h.map(x => { const p = M.get(x.sym); return `<div class="pm-row">${UI.pairIcon(p, 28)}<div class="pm-main"><div class="pm-t">${esc(p ? M.label(p) : x.sym)} · ${x.dir === "up" ? "Up" : "Down"}</div><div class="pm-s">${U.dateStr(x.closed)} · ${money(x.amount)} USDT</div></div><b class="mono ${x.profit > 0 ? "up" : x.profit < 0 ? "down" : ""}">${signed(x.profit)}</b></div>`; }).join("") : pemp("No trades yet")); };
      if (el.querySelector("[data-reset]")) el.querySelector("[data-reset]").onclick = async () => { if (await U.confirmBox("Reset demo account?", `Balance returns to ${money(C.START_BALANCE)} USDT. Open positions, history and bots are cleared. Your settings are kept.`, "Reset", true)){ if (S().auto.on) E.stopAuto("Account reset."); store.reset(); render(); toast(`Balance reset to ${money(C.START_BALANCE)} USDT`, "ok"); } };
    }); };
    const offs = [bus.on("theme", syncTh)]; this.unmount = () => offs.forEach(f => f());
  }};
};

/* ---------- Settings ---------- */
Pages.settings = () => {
  const st0 = S().settings;
  if (st0.colorMode == null) st0.colorMode = "gu";
  if (st0.marginMode == null) st0.marginMode = "cross";
  if (st0.hideSmall == null) st0.hideSmall = false;
  if (st0.tips == null) st0.tips = true;
  const SND_EV = [["open", "Order opened"], ["close", "Position closed"], ["win", "Trade won"], ["loss", "Trade lost"], ["alert", "Price alert"], ["notify", "Notification"], ["err", "Error"]];
  const CONF = [["market", "Market order", "Ask before placing a market order"], ["limit", "Limit order", "Ask before placing a limit order"], ["close", "Close position", "Ask before closing a position"], ["binary", "Binary trade", "Ask before opening a binary trade"], ["option", "Option trade", "Ask before opening an option trade"]];
  const CHART = [["bs", "Buy / Sell markers", "Show your fills on the chart"], ["pos", "Position lines", "Entry price and liquidation lines"], ["ord", "Order lines", "Open limit orders on the chart"], ["hilo", "High / Low labels", "Highest and lowest visible price"], ["cd", "Candle countdown", "Time left on the current candle"]];
  const sg = (attr, val, items) => `<div class="pm-seg">${items.map(([k, n]) => `<button ${attr}="${k}" class="${String(val) === String(k) ? "on" : ""}">${n}</button>`).join("")}</div>`;
  const html = pwrap("Settings", `
    ${psec("Appearance",
      prow("Theme", "", sg("data-th", st0.theme, [["light", "Light"], ["dark", "Dark"], ["system", "System"]])) +
      prow("Price colour", `<span id="pmCmS">${st0.colorMode === "ru" ? "Red up / Green down" : "Green up / Red down"}</span>`, sg("data-cm", st0.colorMode, [["gu", "Green up"], ["ru", "Red up"]])))}
    ${psec("Guide & tips",
      prow("Show tips on new screens", "A short walkthrough the first time you open a screen", swb("tips", st0.tips !== false), "data-rsw") +
      [["home", "Home"], ["trade", "Binary"], ["futures", "Futures"], ["spot", "Spot"], ["options", "Options"], ["copy", "Copy trading"]].map(([k, n]) => `<button class="pm-row tap" data-guide="${k}"><span class="pm-main"><span class="pm-t">Replay guide: ${n}</span></span><span class="chev">${ic("chev", 16)}</span></button>`).join("") +
      `<button class="pm-row tap" data-tipsreset><span class="pm-main"><span class="pm-t">Reset all tips</span><span class="pm-s" style="display:block">Show every screen's guide again on your next visit.</span></span><span class="chev">${ic("chev", 16)}</span></button>`)}
    ${psec("Order confirmation", CONF.map(([k, n, s]) => prow(n, s, swb("confirm." + k, st0.confirm[k] !== false), "data-rsw")).join(""))}
    ${psec("Sounds", prow("Sounds", "Master switch for all event sounds", swb("sound", st0.sound), "data-rsw") +
      `<div id="pmSnd" class="${st0.sound ? "" : "dimmed"}">${SND_EV.map(([k, n]) => `<div class="pm-row ${st0.sound ? "" : "dim"}" data-rsw data-snd><div class="pm-main"><div class="pm-t">${n}</div></div><button class="pm-pv" data-pv="${k}" aria-label="Preview ${n}">${ic("play", 14)}</button>${swb("snd." + k, st0.snd[k] !== false)}</div>`).join("")}</div>`)}
    ${psec("Haptics", prow("Vibration", "Vibrates on order fills, results and alerts, never on taps (Android only)", swb("haptic", st0.haptic), "data-rsw"))}
    ${psec("Trading defaults",
      prow("Default leverage", "Applied to new futures orders", `<div class="pm-step"><button data-lv="-1" aria-label="Decrease">${ic("minus", 16)}</button><input id="pmLev" type="number" inputmode="numeric" min="1" max="125" value="${st0.lev}" aria-label="Default leverage"><button data-lv="1" aria-label="Increase">${ic("plus", 16)}</button></div>`) +
      prow("Margin mode", "", sg("data-mm", st0.marginMode, [["cross", "Cross"], ["isolated", "Isolated"]])) +
      prow("Default binary amount", "USDT per trade", `<input class="pm-num" id="pmAmt" type="number" inputmode="decimal" min="1" value="${st0.defAmt}" aria-label="Default binary amount">`) +
      prow("Default binary expiry", "", sg("data-de", st0.defExp, C.EXPIRIES.map(x => [x, x < 60 ? x + "s" : x / 60 + "m"]))) +
      prow("Hide small balances", "Hide assets worth less than 1 USDT", swb("hideSmall", st0.hideSmall), "data-rsw"))}
    ${psec("Chart", CHART.map(([k, n, s]) => prow(n, s, swb("chart." + k, st0.chart[k] !== false), "data-rsw")).join(""))}
    ${psec("Privacy", prow("Hide balances", "Mask balances across the app", swb("hideBal", st0.hideBal), "data-rsw"))}
    ${psec("Data",
      `${window.ACCT && ACCT.isReal() ? "" : `<button class="pm-row tap" data-reset><span class="pm-main"><span class="pm-t pm-danger">Reset demo account</span><span class="pm-s" style="display:block">Balance back to ${money(C.START_BALANCE)} USDT, positions and history cleared. Settings are kept.</span></span><span class="chev">${ic("chev", 16)}</span></button>`}
       <button class="pm-row tap" data-wipe><span class="pm-main"><span class="pm-t pm-danger">Clear all app data</span><span class="pm-s" style="display:block">Delete everything stored on this device, including settings.</span></span><span class="chev">${ic("chev", 16)}</span></button>`)}
    <div class="pm-foot">Version ${esc(C.APP_VERSION)} · ${esc(C.APP_NAME)}</div>`, {right:`<span class="icon-btn" aria-hidden="true"></span>`});
  return {html, title:"Settings", mount(r){
    const st = () => S().settings, saved = () => { store.save(); toast("Saved", "ok", 1000); };
    const seg = (attr, fn) => r.querySelectorAll(`[${attr}]`).forEach(b => b.onclick = () => { fn(b.getAttribute(attr)); r.querySelectorAll(`[${attr}]`).forEach(x => x.classList.toggle("on", x === b)); saved(); });
    seg("data-th", v => applyTheme(v));
    seg("data-cm", v => { st().colorMode = v; document.documentElement.dataset.cm = v; U.bus.emit("theme"); r.querySelector("#pmCmS").textContent = v === "ru" ? "Red up / Green down" : "Green up / Red down"; });
    seg("data-mm", v => { st().marginMode = v; });
    seg("data-de", v => { st().defExp = +v; });
    const setLev = v => { v = Math.max(1, Math.min(125, Math.round(v) || st().lev || 1)); st().lev = v; r.querySelector("#pmLev").value = v; saved(); };
    r.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => setLev((parseInt(r.querySelector("#pmLev").value) || 1) + +b.dataset.lv));
    r.querySelector("#pmLev").onchange = e => setLev(parseFloat(e.target.value));
    r.querySelector("#pmAmt").onchange = e => { const v = parseFloat(e.target.value); if (!(v >= 1)){ toast("Default amount must be at least 1 USDT", "bad"); e.target.value = st().defAmt; return; } st().defAmt = v; saved(); };
    r.addEventListener("click", async e => {
      const pv = e.target.closest("[data-pv]");
      if (pv){ if (!st().sound) return toast("Turn on Sounds to preview", "info"); if (st().snd[pv.dataset.pv] === false) return toast("Turn this sound on to preview it", "info"); return U.beep(pv.dataset.pv); }
      const gd = e.target.closest("[data-guide]");
      if (gd){ const k = gd.dataset.guide, rt = {home:"#/home", trade:"#/trade/BTCUSDT", futures:"#/futures/BTCUSDT", spot:"#/spot/BTCUSDT", options:"#/options", copy:"#/copy"}[k]; location.hash = rt; setTimeout(() => window.TOUR?.run(k, true), 700); return; }
      if (e.target.closest("[data-tipsreset]")){ window.TOUR?.reset(); return toast("All tips will show again", "ok"); }
      const row = e.target.closest(".pm-row[data-rsw]");
      if (row){
        const b = row.querySelector("[data-sw]"), path = b.dataset.sw, v = !getP(st(), path);
        setP(st(), path, v); b.classList.toggle("on", v); b.setAttribute("aria-checked", v);
        if (path === "sound"){ r.querySelectorAll("[data-snd]").forEach(x => x.classList.toggle("dim", !v)); }
        if (path === "haptic" && v && navigator.vibrate) { /* no vibration on toggle by design */ }
        return saved();
      }
      if (e.target.closest("[data-reset]") && await U.confirmBox("Reset demo account?", `Balance returns to ${money(C.START_BALANCE)} USDT. Open positions, history, bots and Earn positions are cleared. Your settings are kept.`, "Reset account", true)){
        if (S().auto.on) E.stopAuto("Account reset."); store.reset(); toast(`Account reset to ${money(C.START_BALANCE)} USDT`, "ok");
      }
      if (e.target.closest("[data-wipe]") && await U.confirmBox("Clear all data?", "This deletes balance, history, bots and settings from this device.", "Delete everything", true)) store.wipe();
    });
  }};
};

/* ---------- About ---------- */
Pages.about = () => {
  const html = pwrap("About Us", `
    <section class="pm-sec"><div class="pm-pad"><div class="row" style="gap:10px"><img src="favicon.svg" alt="" width="32" height="32"><div><div class="pm-t" style="font-size:16px;font-weight:600">${esc(C.APP_NAME)}</div><div class="pm-s">Version ${esc(C.APP_VERSION)}</div></div></div>
      <p class="sub" style="margin-top:12px;font-size:14px;line-height:1.55">A mobile-first trading platform for binary options, futures, spot, options and prediction markets, with real-time prices, pro charts, indicators, bots and risk tools in one app.</p></div></section>
    <div class="pm-stats">${pstat("Markets", "120+")}${pstat("Tradable pairs", "20")}${pstat("Max leverage", "125x")}${pstat("Binary payout", "+92%")}</div>
    ${psec("What you can do", [["chart", "Live charts", "Tick line and candles from 5s to 4h on real Binance and biquote.io data."], ["zap", "Binary trades", "Predict Up or Down over 30s, 1m or 5m and earn +92% on a win."], ["bot", "Bots and auto trading", "Run strategy bots and an automatic trade engine."], ["shield", "Secure account", "Your data is stored on your device and protected by your security settings."]].map(([i, a, b]) => `<div class="pm-row" style="align-items:flex-start;padding:12px 0"><span class="pm-ico" style="margin-top:1px">${ic(i, 18)}</span><div class="pm-main"><div class="pm-t">${a}</div><div class="pm-s" style="font-size:13px">${b}</div></div></div>`).join(""))}
    ${psec("Market data sources", [["chart", "Crypto spot and perpetuals", "Live prices, order flow and candles come from the Binance public market data API (REST and WebSocket)."], ["layers", "TradFi 24/7 perpetuals", "Round-the-clock perpetual contracts on traditional assets use Binance Futures TradFi market data."], ["globe", "Stocks, forex, metals, indices and commodities", "Quotes and charts for these markets are provided by biquote.io."], ["target", "Prediction markets", "Event markets, odds and order books come from Polymarket (Gamma and CLOB APIs)."], ["clock", "Update and fallback", "Prices refresh in real time. If a feed is unavailable the app shows the last known quote and marks the market as offline instead of guessing."]].map(([i, a, b]) => `<div class="pm-row" style="align-items:flex-start;padding:12px 0"><span class="pm-ico" style="margin-top:1px">${ic(i, 18)}</span><div class="pm-main"><div class="pm-t">${a}</div><div class="pm-s" style="font-size:13px">${b}</div></div></div>`).join(""))}
    ${psec("FAQ", faq([["How does my balance work?", "Your balance is held in USDT across separate wallets for Funding, Spot, Futures, Binary, Options and Earn. Move funds between them any time with Transfer."], ["Where do prices come from?", "Crypto prices stream from Binance public market data. Forex, gold and silver stream from biquote.io."], ["Why is a forex pair closed?", "Forex and metals markets close on weekends. Those pairs show Market closed until they reopen."], ["How is a trade settled?", "At expiry the live price is compared with your entry. Up wins if the price is higher, Down wins if it is lower. Equal price is a refund."], ["Can I reset my balance?", "Yes. Go to Settings, Data, Reset demo account to restore " + money(C.START_BALANCE) + " USDT."]]))}
    <p class="pm-risk">Trading involves risk. Binary options can lose 100% of the stake. This app is educational and is not financial advice.</p>`);
  return {html, title:"About Us"};
};

/* ---------- Support ---------- */
Pages.support = () => {
  const tel = C.SUPPORT_PHONE.replace(/\s/g, "");
  const html = pwrap("Contact Support", `
    ${window.AICHAT ? AICHAT.supportHtml() : ""}
    <section class="pm-sec"><h3 class="pm-st">Get in touch</h3>
      <a class="pm-row tap" href="tel:${tel}"><span class="pm-ico">${ic("phone", 18)}</span><span class="pm-main"><span class="pm-t">Call us</span><span class="pm-s" style="display:block">${esc(C.SUPPORT_PHONE)}</span></span><span class="chev">${ic("chev", 16)}</span></a>
      <a class="pm-row tap" href="mailto:${C.SUPPORT_EMAIL}?subject=${encodeURIComponent(C.APP_NAME + " support")}"><span class="pm-ico">${ic("mail", 18)}</span><span class="pm-main"><span class="pm-t">Email us</span><span class="pm-s" style="display:block">${esc(C.SUPPORT_EMAIL)}</span></span><span class="chev">${ic("chev", 16)}</span></a>
      <div class="pm-row"><span class="pm-ico">${ic("clock", 18)}</span><span class="pm-main"><span class="pm-t">Support hours</span><span class="pm-s" style="display:block">24/7, average reply under 2 hours</span></span></div></section>
    <section class="pm-sec"><h3 class="pm-st">Submit a ticket</h3><form id="tf" novalidate style="padding:4px 0 14px">
      <span class="pm-lbl" style="margin-top:4px">Topic</span><select id="ts" class="pm-sel"><option value="">Choose a topic</option><option>Trading</option><option>Deposit / Withdraw</option><option>Earn</option><option>Bots &amp; Auto trading</option><option>Account</option><option>Other</option></select>
      <span class="pm-lbl">Your email</span><input id="te" class="pm-in" type="email" autocomplete="email" placeholder="name@example.com">
      <span class="pm-lbl">Message</span><textarea id="tm" class="pm-ta" rows="4" placeholder="Describe your issue (min. 10 characters)"></textarea>
      <div class="pm-err" id="tee"></div><button class="btn btn-primary pm-cta" type="submit">Submit ticket</button></form></section>
    <section class="pm-sec"><h3 class="pm-st">Your tickets</h3><div id="tl"></div></section>
    ${psec("Quick help", faq([["My trade shows Market closed", "Forex and metals close on weekends. Trade top crypto pairs 24/7."], ["Up/Down buttons are disabled", "That pair is chart only or the market is closed. Pick a tradable pair."], ["I ran out of balance", "Use Deposit for an instant top-up, or reset the demo account in Settings."], ["Prices stopped updating", "The app reconnects automatically. Check your internet connection."]]))}`);
  return {html, title:"Contact Support", mount(r){
    const $ = q => r.querySelector(q);
    try { window.AICHAT && AICHAT.supportMount(r); } catch (e) { console.error(e); }
    const render = () => { $("#tl").innerHTML = S().tickets.length ? S().tickets.map(x => `<div class="pm-row" style="padding:10px 0"><span class="pm-ico">${ic("file", 18)}</span><div class="pm-main"><div class="pm-t">#${x.id.slice(0, 6).toUpperCase()} · ${esc(x.topic)}</div><div class="pm-s ellipsis">${esc(x.msg)}</div><div class="pm-s">${U.dateStr(x.t)}</div></div><span class="pm-pill g">Received</span></div>`).join("") : pemp("No tickets yet"); };
    render();
    $("#tf").onsubmit = async e => {
      e.preventDefault();
      const topic = $("#ts").value, em = $("#te").value.trim(), msg = $("#tm").value.trim();
      const err = !topic ? "Please choose a topic." : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em) ? "Please enter a valid email address." : msg.length < 10 ? "Message must be at least 10 characters." : "";
      $("#tee").textContent = err; if (err) return;
      await processing(e.submitter || $("[type=submit]"), 800);
      S().tickets.unshift({id:U.uid(), topic, em, msg, t:Date.now()}); store.save();
      $("#tf").reset(); render(); toast("Ticket submitted. We'll reply by email.", "ok");
    };
  }};
};

/* ---------- Community ---------- */
Pages.community = () => {
  const CH = [["announce", "Announcements", "Product news and updates", "12.4k"], ["crypto", "Crypto traders", "BTC, ETH, SOL setups", "48.1k"], ["forex", "Forex desk", "Majors and sessions", "21.7k"], ["strategy", "Strategy lab", "Share and test ideas", "9.8k"]];
  const SEED = {
    announce:[["NovaTrade Team", "New: 4h candles for gold & silver are live."], ["NovaTrade Team", "Tip: use the Tick chart for 30s trades and 1m candles for 5m trades."]],
    crypto:[["Arjun", "BTC holding the range. Waiting for a breakout before going Up."], ["Mia", "SOL momentum looks strong on 15s candles."], ["Leo", "Don't over-trade. 2% of balance per trade max."]],
    forex:[["Sara", "EUR/USD quiet in the Asian session, better moves at London open."], ["Kenji", "USD/JPY respecting the high of the day."]],
    strategy:[["Priya", "Trend follow on 1m + 5m expiry has been my best combo so far."], ["Omar", "Testing reversal strategy with a binary bot with 5 USDT size."]]
  };
  const LEAD = [["CryptoQueen", 18420], ["PipHunter", 12960], ["Satoshi_Jr", 9875], ["GoldBug", 7340], ["TrendRider", 6210]];
  const html = pwrap("Community", `
    <section class="pm-sec"><div class="pm-pad row" style="gap:12px"><div class="grow"><div class="pm-t" style="font-size:16px;font-weight:600">${esc(C.APP_NAME)} Community</div><div class="pm-s">Discuss setups with other traders</div></div><button class="pm-btn" data-join></button></div></section>
    ${psec("Channels", CH.map(([k, n, d, m]) => `<button class="pm-row tap" data-ch="${k}"><span class="pm-main"><span class="pm-t">${n}</span><span class="pm-s" style="display:block">${d} · ${m} members</span></span><span class="chev">${ic("chev", 16)}</span></button>`).join(""))}
    ${psec("Weekly leaderboard", `<div id="lb"></div>`)}
    ${psec("Community rules", `<p class="pm-note" style="padding:8px 0 12px">Be respectful. No spam or promotions. No requests for financial advice. Share results honestly.</p>`)}`);
  return {html, title:"Community", mount(r){
    const s = S(), $ = q => r.querySelector(q);
    const renderJoin = () => { const b = $("[data-join]"); b.innerHTML = s.joined ? ic("check", 14) + " Joined" : "Join"; b.classList.toggle("line", !!s.joined); };
    renderJoin();
    $("[data-join]").onclick = () => { s.joined = !s.joined; store.save(); renderJoin(); toast(s.joined ? "You joined the community" : "You left the community", s.joined ? "ok" : "info"); };
    const net = E.stats().net;
    const rows = [...LEAD, [s.profile.name + " (You)", Math.round(net)]].sort((a, b) => b[1] - a[1]);
    $("#lb").innerHTML = rows.map(([n, v], i) => `<div class="pm-row" style="min-height:46px"><span class="pm-rank ${i < 3 ? "t" : ""}">${i + 1}</span><span class="pm-main pm-t ellipsis" style="font-weight:${n.includes("(You)") ? 700 : 500}">${esc(n)}</span><b class="mono ${v >= 0 ? "up" : "down"}">${signed(v, 0)}</b></div>`).join("");
    r.querySelectorAll("[data-ch]").forEach(b => b.onclick = () => {
      const k = b.dataset.ch, name = CH.find(c => c[0] === k)[1];
      const msgs = () => [...SEED[k].map(([a, m]) => ({a, m, t:null})), ...s.posts.filter(p => p.ch === k)].map(x => `<div class="pm-row" style="align-items:flex-start;padding:10px 0"><span class="pm-av" style="width:32px;height:32px;font-size:13px">${esc(x.a[0])}</span><div class="pm-main"><div class="pm-t">${esc(x.a)} ${x.t ? `<span class="pm-s">${U.timeStr(x.t)}</span>` : ""}</div><div class="pm-s" style="font-size:13px;color:var(--text-2)">${esc(x.m)}</div></div></div>`).join("");
      U.sheet(name, `<div id="cm">${msgs()}</div><form class="row" id="cf" style="margin-top:12px;position:sticky;bottom:0;background:var(--card);padding-top:8px"><input class="pm-in grow" id="ci" maxlength="200" placeholder="Write a message" aria-label="Message"><button class="btn btn-primary" style="height:46px;border-radius:10px" aria-label="Send">${ic("send", 18)}</button></form>`, el => {
        el.querySelector("#cf").onsubmit = e => { e.preventDefault(); const v = el.querySelector("#ci").value.trim(); if (!v) return toast("Message can't be empty", "bad");
          if (!s.joined){ s.joined = true; renderJoin(); }
          s.posts.push({ch:k, a:s.profile.name, m:v, t:Date.now()}); s.posts = s.posts.slice(-100); store.save();
          el.querySelector("#cm").innerHTML = msgs(); el.querySelector("#ci").value = ""; toast("Message posted", "ok", 1400); };
      });
    });
  }};
};

/* ---------- 404 ---------- */
/* ---------- route aliases: no link may reach the 404 page ---------- */
[["transfer","assets"],["notifications","profile"],["notifs","profile"],["me","profile"],["menu","profile"],["account","profile"],["pnl-analysis","pnl"],["analysis","pnl"],["wallet","assets"],["funds","assets"],["portfolio","assets"],["perp","futures"],["perpetual","futures"],["binary","trade"],["bot","bots"],["copytrading","copy"],["copy-trading","copy"],["reward","rewards"],["tasks","rewards"],["alert","alerts"],["learn","academy"],["help","support"],["faq","support"],["signals","vip"],["preferences","settings"],["trades","history"],["orders","history"],["staking","earn"],["savings","earn"],["market","markets"],["exchange","spot"]].forEach(([a, b]) => { if (!Pages[a]) Pages[a] = (p) => Pages[b](p); });
Pages.notfound = () => ({title:"Page not found", html:`<div class="nf"><div class="big">404</div><div class="h1" style="margin:8px 0">Page not found</div><p class="sub" style="margin-bottom:24px">The page you’re looking for doesn’t exist or was moved.</p><a class="btn btn-primary" href="#/home">${ic("home",18)} Back to Home</a></div>${UI.footer()}`});
})();

/* ---------- Preferences (Binance-style: Trading Mode / Layout / Notifications) ---------- */
(function(){
const {esc, ic, store, toast} = U;
const S = () => store.s;
Pages.preferences = Pages.prefs = () => {
  let tab = "mode", sub = "general";
  const st = () => S().settings;
  const F = () => st().futp, L = () => st().layout;
  const save = () => store.save();
  const chev = `<span class="pr-chev">${ic("chev", 16)}</span>`;
  const info = k => `<button class="pr-i" data-info="${k}" aria-label="More info">${ic("info", 15)}</button>`;
  const INFO = {
    protect:["Price Protection", "Price Protection prevents orders from being filled at a price that deviates too far from the mark price. Orders that would fill beyond the allowed range are rejected instead of executed at a bad price."],
    tapFill:["Tap to fill in Price", "When on, tapping a price in the order book or a recent trade automatically fills it into the Price field of your order form."],
    trig:["Trigger Type", "Choose which price triggers your conditional orders and TP/SL: Last Price follows the latest trade, Mark Price follows the fair index-based price and is harder to manipulate."]
  };
  const sw = (path, on) => `<button class="switch ${on ? "on" : ""}" data-sw="${path}" role="switch" aria-checked="${!!on}" aria-label="${esc(path)}"></button>`;
  const trow = (title, subt, path, on, i) => `<div class="pr-row pr-tg" data-rsw><div class="pr-main"><div class="pr-t">${title}${i ? " " + info(i) : ""}</div>${subt ? `<div class="pr-s">${subt}</div>` : ""}</div>${sw(path, on)}</div>`;
  const vrow = (k, title, val, i) => `<button class="pr-row pr-v" data-open="${k}"><div class="pr-main"><div class="pr-t">${title}${i ? ` <span class="pr-i" data-info="${i}" role="button" aria-label="More info">${ic("info", 15)}</span>` : ""}</div></div><span class="pr-val">${val}</span>${chev}</button>`;
  const seg = (attr, val, items) => `<div class="pr-seg">${items.map(([k, n]) => `<button ${attr}="${k}" class="${val === k ? "on" : ""}">${n}</button>`).join("")}</div>`;

  const nameOf = {oneway:"One-way Mode", hedge:"Hedge Mode", USDT:"USDT (Order Size)", COIN:"Coin", last:"Last Price", mark:"Mark Price", single:"Single-Asset Mode", multi:"Multi-Assets Mode"};
  const levVal = () => F().levSet ? `${st().lev}x ${st().marginMode === "isolated" ? "Isolated" : "Cross"}` : "Disabled";

  /* ---- illustrations ---- */
  const lineSvg = (x, y, w, c = "var(--line-2)") => `<rect x="${x}" y="${y}" width="${w}" height="3" rx="1.5" fill="${c}"/>`;
  const chartBlk = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="var(--input)"/><path d="M${x + 4} ${y + h - 5} L${x + w * .3} ${y + h * .5} L${x + w * .5} ${y + h * .65} L${x + w * .75} ${y + 5} L${x + w - 4} ${y + h * .4}" fill="none" stroke="var(--muted)" stroke-width="1.4"/>`;
  const bookBlk = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="var(--input)"/>${[0, 1, 2, 3].map(i => lineSvg(x + 4, y + 5 + i * 6, w - 8, i < 2 ? "var(--down)" : "var(--up)")).join("").replace(/<rect/g, '<rect opacity=".55"')}`;
  const formBlk = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="var(--input)"/>${lineSvg(x + 4, y + 5, w - 8)}${lineSvg(x + 4, y + 12, w - 8)}<rect x="${x + 4}" y="${y + h - 9}" width="${w - 8}" height="5" rx="2.5" fill="var(--up)" opacity=".8"/>`;
  const klSvg = k => {
    const W = 84, H = 70;
    let body = "";
    if (k === "top") body = chartBlk(6, 6, W - 12, 24) + bookBlk(6, 34, 36, 30) + formBlk(46, 34, 32, 30);
    else if (k === "bottom") body = bookBlk(6, 6, 36, 30) + formBlk(46, 6, 32, 30) + chartBlk(6, 40, W - 12, 24);
    else body = bookBlk(6, 6, 36, 58) + formBlk(46, 6, 32, 58);
    return `<svg viewBox="0 0 ${W} ${H}" class="pr-ill" aria-hidden="true"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="7" fill="var(--card)" stroke="var(--line)"/>${body}</svg>`;
  };
  const ordSvg = k => {
    const a = k === "left" ? [6, 42] : [46, 6];
    return `<svg viewBox="0 0 84 70" class="pr-ill" aria-hidden="true"><rect x=".5" y=".5" width="83" height="69" rx="7" fill="var(--card)" stroke="var(--line)"/>${chartBlk(6, 6, 72, 18)}${formBlk(a[0] === 6 ? 6 : 46, 28, 32, 36)}${bookBlk(a[0] === 6 ? 44 : 6, 28, 34, 36)}</svg>`;
  };
  const card = (attr, val, cur, label, ill) => `<button class="pr-card ${cur === val ? "on" : ""}" ${attr}="${val}" aria-pressed="${cur === val}">${ill}<span>${label}</span></button>`;

  /* ---- tab bodies ---- */
  const bodyMode = () => `
    <div class="pr-sec">
      <div class="pr-row"><div class="pr-main"><div class="pr-t">Futures Mode</div></div>${seg("data-fm", F().mode, [["classic", "Classic"], ["easy", "Easy"]])}</div>
      ${vrow("acct", "Account Mode", "Classic Trading")}
      ${vrow("pos", "Position Mode", nameOf[F().posMode])}
      ${vrow("asset", "Asset Mode", nameOf[F().asset || "single"])}
      ${vrow("unit", "Unit Preference", nameOf[F().unit])}
      ${vrow("lev", "Default Leverage & Margin Mode", levVal())}
      ${vrow("trig", "Default Trigger Type", nameOf[F().trig], "trig")}
    </div>
    <div class="pr-sec">
      ${trow("Price Protection", "Rejects orders that would fill too far from the mark price.", "futp.protect", F().protect !== false, "protect")}
      ${trow("Tap to fill in Price", "Tap an order book price to fill it into your order.", "futp.tapFill", !!F().tapFill, "tapFill")}
    </div>`;

  const preview = () => {
    const on = L().bstab !== false;
    const bk = (c, w) => `<div class="pr-bk"><i style="background:var(${c});width:${w}%"></i><b>***</b></div>`;
    return `<div class="pr-prev"><div class="pr-prev-h">Preview</div><div class="pr-prev-b">
      <div class="pr-pf">
        ${on ? `<div class="pr-bs"><span class="b">Buy</span><span>Sell</span></div>` : ""}
        <div class="pr-fl"><span>Cross 20x S</span></div>
        <div class="pr-fi">Limit <em>${ic("chevd", 10)}</em></div>
        <div class="pr-fi"><span>Price</span><b>***</b><u>BBO</u></div>
        <div class="pr-fi"><span>Amount</span><b>***</b><u>USDT</u></div>
        <div class="pr-sl"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="pr-av">Avbl <b>***</b></div>
        <div class="pr-btn">${on ? "Buy / Long" : "Buy | Sell"}</div>
      </div>
      <div class="pr-ob">${[1, 2, 3, 4].map(i => bk("--down", 40 + i * 12)).join("")}<div class="pr-mid">***</div>${[1, 2, 3, 4].map(i => bk("--up", 90 - i * 12)).join("")}</div>
    </div></div></div>`;
  };

  const bodyLayout = () => {
    const pills = `<div class="pr-pills">${[["general", "General"], ["trade", "Trade Panel"], ["pos", "Positions"]].map(([k, n]) => `<button data-sub="${k}" class="${sub === k ? "on" : ""}">${n}</button>`).join("")}</div>`;
    if (sub === "general") return pills + `
      <p class="pr-note">* General settings apply to Spot, Futures and Options</p>
      <div class="pr-h">K-Line in Trading Page</div>
      <div class="pr-cards">${[["top", "Top"], ["bottom", "Bottom"], ["none", "None"]].map(([k, n]) => card("data-kl", k, L().kline, n, klSvg(k))).join("")}</div>
      <div class="pr-h">Place Order Layout</div>
      <div class="pr-cards two">${[["left", "Left"], ["right", "Right"]].map(([k, n]) => card("data-ol", k, L().order, n, ordSvg(k))).join("")}</div>`;
    if (sub === "trade") return pills + `${preview()}
      <div class="pr-h">Buy/Sell Tab Setting</div>
      <div class="pr-cards two">${card("data-bs", "1", L().bstab !== false ? "1" : "0", "Display Buy/Sell tab", `<svg viewBox="0 0 84 40" class="pr-ill"><rect x=".5" y=".5" width="83" height="39" rx="7" fill="var(--card)" stroke="var(--line)"/><rect x="8" y="8" width="30" height="9" rx="4.5" fill="var(--up)" opacity=".85"/><rect x="42" y="8" width="30" height="9" rx="4.5" fill="var(--input)"/>${lineSvg(8, 24, 64)}${lineSvg(8, 30, 40)}</svg>`)}${card("data-bs", "0", L().bstab !== false ? "1" : "0", "Hide Buy/Sell tab", `<svg viewBox="0 0 84 40" class="pr-ill"><rect x=".5" y=".5" width="83" height="39" rx="7" fill="var(--card)" stroke="var(--line)"/>${lineSvg(8, 10, 64)}${lineSvg(8, 17, 40)}<rect x="8" y="25" width="30" height="8" rx="4" fill="var(--up)" opacity=".85"/><rect x="42" y="25" width="30" height="8" rx="4" fill="var(--down)" opacity=".85"/></svg>`)}</div>
      <div class="pr-sec">
        ${trow("Input Step Increment", "Show +/- steppers on the price and amount fields.", "layout.step", !!L().step)}
        ${trow("Slider Vibration", "Vibrate lightly as the order slider passes each mark (Android only).", "layout.slideVib", L().slideVib !== false)}
      </div>`;
    const CH = [["bs", "Buy / Sell markers", "Show your fills on the chart"], ["pos", "Position lines", "Entry price and liquidation lines"], ["ord", "Order lines", "Open limit orders on the chart"], ["hilo", "High / Low labels", "Highest and lowest visible price"], ["cd", "Candle countdown", "Time left on the current candle"]];
    return pills + `<div class="pr-sec">${trow("Display realized PNL in positions", "Show realized PNL on each position card.", "futp.showRz", F().showRz !== false)}</div>
      <div class="pr-h">Chart</div><div class="pr-sec">${CH.map(([k, n, s]) => trow(n, s, "chart." + k, st().chart[k] !== false)).join("")}</div>`;
  };

  const bodyNotif = () => {
    const N = [["fill", "Order filled", "When a limit or conditional order is filled"], ["tpsl", "TP/SL triggered", "When take profit or stop loss closes a position"], ["liq", "Liquidation warning", "When a position gets close to liquidation"], ["funding", "Funding fee", "When a funding fee is charged or received"], ["binary", "Binary result", "When a binary trade settles"], ["news", "Announcements", "Product news and platform updates"]];
    const SND = [["open", "Order opened"], ["close", "Position closed"], ["win", "Trade won"], ["loss", "Trade lost"], ["alert", "Price alert"], ["notify", "Notification"], ["err", "Error"]];
    return `<div class="pr-sec">${N.map(([k, n, s]) => trow(n, s, "notif." + k, st().notif[k] !== false)).join("")}</div>
      <div class="pr-h">Sounds</div><div class="pr-sec">${trow("Sounds", "Master switch for all event sounds", "sound", st().sound !== false)}
      ${SND.map(([k, n]) => trow(n, "", "snd." + k, st().snd[k] !== false)).join("")}</div>`;
  };

  const tabs = [["mode", "Trading Mode"], ["layout", "Layout"], ["notif", "Notifications"]];
  const html = UI.pageHead("Preferences", {right: `<span class="icon-btn" aria-hidden="true"></span>`}) +
    `<div class="pr-page"><div class="pr-tabs" id="prTabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}"><span>${n}</span></button>`).join("")}</div><div id="prBody"></div></div>`;

  return {html, title: "Preferences", mount(r){
    const body = r.querySelector("#prBody");
    const render = () => {
      body.innerHTML = tab === "mode" ? bodyMode() : tab === "layout" ? bodyLayout() : bodyNotif();
      r.querySelectorAll("#prTabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
    };
    const opt = (attr, val, cur, title, subt, ico) => `<button class="pr-opt ${val === cur ? "on" : ""}" ${attr}="${val}"><div class="pr-opt-h">${ico || ""}<b>${title}</b><span class="pr-rad"></span></div>${subt || ""}</button>`;
    const bullets = a => `<ul class="pr-ul">${a.map(x => `<li>${x}</li>`).join("")}</ul>`;
    const pick = (title, rows, onPick) => U.sheet(title, `<div class="pr-opts">${rows}</div>`, el => {
      el.querySelectorAll(".pr-opt").forEach(b => b.onclick = () => { const a = [...b.attributes].find(x => x.name.startsWith("data-")); onPick(a.value); save(); U.closeLayer(); render(); });
    });
    const sheets = {
      acct: () => U.sheet("Account Mode", `<div class="pr-opts">${opt("data-x", "c", "c", "Classic Trading", `<p class="pr-p">Trade Spot, Futures and Options with separate balances and the full set of order types.</p>`)}</div>`),
      pos: () => pick("Position Mode", opt("data-v", "oneway", F().posMode, "One-way Mode", `<p class="pr-p">Hold a single position per contract, in one direction only.</p>`) + opt("data-v", "hedge", F().posMode, "Hedge Mode", `<p class="pr-p">Hold long and short positions on the same contract at the same time.</p>`), v => F().posMode = v),
      asset: () => { const a = F().asset || "single"; pick("Asset Mode",
        opt("data-v", "single", a, "Single-Asset Mode", bullets(["Margin is the contract's own settlement asset", "Profit and loss from one contract does not offset another", "Simple and predictable risk per position"]), `<span class="pr-oi">${ic("wallet", 20)}</span>`) +
        opt("data-v", "multi", a, "Multi-Assets Mode", bullets(["Use several assets as shared margin", "Unrealized profits from one position can support others", "Cross-margin only, higher liquidation interdependence"]), `<span class="pr-oi">${ic("layers", 20)}</span>`), v => F().asset = v); },
      unit: () => pick("Unit Preference", opt("data-v", "USDT", F().unit, "USDT (Order Size)", `<p class="pr-p">Enter order size in USDT value.</p>`) + opt("data-v", "COIN", F().unit, "Coin", `<p class="pr-p">Enter order size in the base coin, e.g. BTC.</p>`), v => F().unit = v),
      trig: () => pick("Default Trigger Type", opt("data-v", "last", F().trig, "Last Price", `<p class="pr-p">Triggers on the latest traded price.</p>`) + opt("data-v", "mark", F().trig, "Mark Price", `<p class="pr-p">Triggers on the fair mark price, less prone to wicks.</p>`), v => F().trig = v),
      lev: () => {
        let lv = Math.max(1, Math.min(125, st().lev || 20)), mm = st().marginMode || "cross";
        U.sheet("Default Leverage & Margin Mode", `<div class="pr-lv"><div class="pr-lv-v"><b id="prLv">${lv}x</b></div><input type="range" id="prLvR" min="1" max="125" value="${lv}" aria-label="Leverage"><div class="pr-lv-m"><span>1x</span><span>25x</span><span>50x</span><span>75x</span><span>100x</span><span>125x</span></div>
          ${seg("data-mm", mm, [["cross", "Cross"], ["isolated", "Isolated"]])}<p class="pr-p">Applied to new futures orders. Higher leverage increases liquidation risk.</p><button class="btn btn-primary btn-block" id="prLvOk" style="margin-top:14px">Confirm</button></div>`, el => {
          const rg = el.querySelector("#prLvR"), paint = () => { rg.style.setProperty("--p", (rg.value - 1) / 124 * 100 + "%"); el.querySelector("#prLv").textContent = rg.value + "x"; };
          paint(); rg.oninput = () => { lv = +rg.value; paint(); };
          el.querySelectorAll("[data-mm]").forEach(b => b.onclick = () => { mm = b.dataset.mm; el.querySelectorAll("[data-mm]").forEach(x => x.classList.toggle("on", x === b)); });
          el.querySelector("#prLvOk").onclick = () => { st().lev = lv; st().marginMode = mm; F().levSet = true; save(); U.closeLayer(); render(); };
        });
      }
    };
    r.addEventListener("click", e => {
      const t = e.target;
      const inf = t.closest("[data-info]");
      if (inf){ e.stopPropagation(); const [h, p] = INFO[inf.dataset.info]; return U.sheet(h, `<p class="pr-p" style="margin:0 0 12px">${esc(p)}</p><button class="btn btn-primary btn-block" data-close2>Got it</button>`, el => el.querySelector("[data-close2]").onclick = U.closeLayer); }
      let b;
      if ((b = t.closest("[data-tab]"))){ tab = b.dataset.tab; return render(); }
      if ((b = t.closest("[data-sub]"))){ sub = b.dataset.sub; return render(); }
      if ((b = t.closest("[data-open]"))) return sheets[b.dataset.open]();
      if ((b = t.closest("[data-fm]"))){ F().mode = b.dataset.fm; save(); return render(); }
      if ((b = t.closest("[data-kl]"))){ L().kline = b.dataset.kl; save(); return render(); }
      if ((b = t.closest("[data-ol]"))){ L().order = b.dataset.ol; save(); return render(); }
      if ((b = t.closest("[data-bs]"))){ L().bstab = b.dataset.bs === "1"; save(); return render(); }
      if ((b = t.closest("[data-rsw]"))){
        const s = b.querySelector("[data-sw]"); if (!s) return;
        const p = s.dataset.sw, cur = p.split(".").reduce((a, k) => a == null ? a : a[k], st()); const on = !(cur !== false && !!cur);
        const ks = p.split("."), l = ks.pop(); ks.reduce((a, k) => a[k] = a[k] || {}, st())[l] = on; save();
        s.classList.toggle("on", on); s.setAttribute("aria-checked", on);
      }
    });
    render();
  }};
};
/* entry row in Settings */
const _st = Pages.settings;
Pages.settings = (...a) => { const p = _st(...a); p.html = p.html.replace('<div class="pm-page">', `<div class="pm-page"><section class="pm-sec"><a class="pm-row tap" href="#/preferences"><span class="pm-main"><span class="pm-t">Preferences</span><span class="pm-s" style="display:block">Trading mode, layout and notifications</span></span><span class="chev">${ic("chev", 16)}</span></a></section>`); return p; };
})();

/* ---------- Android app: version + one-tap update (inside APK) or download link (in browser) ---------- */
{
  const _st2 = Pages.settings, APK = "https://github.com/dewgames95-ship-it/Stoploss-msg-remover-bot-/releases/latest/download/binary-trading.apk";
  Pages.settings = (...a) => {
    const p = _st2(...a), app = window.IS_APP && window.NativeApp;
    const row = app
      ? `<button class="pm-row tap" data-appupd style="width:100%;text-align:left"><span class="pm-main"><span class="pm-t">App update</span><span class="pm-s" style="display:block">Build ${NativeApp.version()} · tap to check for a new version</span></span><span class="chev">${U.ic("chev", 16)}</span></button>`
      : `<a class="pm-row tap" href="${APK}" target="_blank" rel="noopener"><span class="pm-main"><span class="pm-t">Android app</span><span class="pm-s" style="display:block">Download the APK · updates itself</span></span><span class="chev">${U.ic("chev", 16)}</span></a>`;
    p.html = p.html.replace('<div class="pm-page">', `<div class="pm-page"><section class="pm-sec">${row}</section>`);
    const m = p.mount;
    p.mount = function(r){ const out = m && m.apply(this, arguments); const b = r.querySelector("[data-appupd]"); if (b) b.onclick = () => { NativeApp.checkUpdate(); U.toast("Checking for updates…", "info"); }; return out; };
    return p;
  };
}
