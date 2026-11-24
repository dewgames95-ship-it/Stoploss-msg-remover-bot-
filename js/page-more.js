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
    <div class="hero">${UI.usdt(36)}<div class="label" style="margin-top:10px">Trading account balance</div><div class="bal num" id="db"></div><div class="sub" style="font-size:12px">Virtual USDT is credited instantly — no payment, card or wallet needed.</div></div>
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
    const render = () => { r.querySelector("#db").textContent = money(S().balance) + " USDT"; r.querySelector("#dl").innerHTML = txList("deposit"); };
    render();
    r.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { r.querySelector("#da").value = b.dataset.v; r.querySelector("#de").textContent = ""; });
    r.querySelector("#df").onsubmit = async e => {
      e.preventDefault();
      const a = parseFloat(r.querySelector("#da").value), err = r.querySelector("#de");
      let m = !(a > 0) ? "Enter a valid amount." : a < 10 ? "Minimum deposit is 10 USDT." : a > 100000 ? "Maximum is 100,000 USDT per deposit." : S().balance + a > 10000000 ? "Account limit is 10,000,000 USDT." : "";
      r.querySelector("#daf").classList.toggle("err", !!m); err.textContent = m;
      if (m) return toast(m, "bad");
      await processing(e.submitter || r.querySelector("[type=submit]"), 900);
      S().tx.unshift({id:U.uid(), kind:"deposit", amount:a, method:"Instant top-up", t:Date.now()});
      store.setBalance(S().balance + a, "deposit");
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
const fdate = t => new Date(t).toLocaleDateString([], {month:"short", day:"numeric", year:"numeric"});
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

/* ---------- Earn (Simple Earn: Flexible vault + locked products) ---------- */
const LOCKED = [{days:7, apr:.065}, {days:30, apr:.082}, {days:60, apr:.098}, {days:90, apr:.12}];
const earnS = () => { const s = S(); s.earn = Object.assign({locked:[], flexInt:0, lockedInt:0}, s.earn || {}); if (!Array.isArray(s.earn.locked)) s.earn.locked = []; return s.earn; };
const lockedAcc = (p, now=Date.now()) => p.amount * p.apr * Math.min(Math.max(0, now - p.start), p.days * DAY) / (365 * DAY);
const flexAcc = () => E.vaultValue() - S().vault.bal;
function flexMove(a, dir){ const acc = flexAcc(), err = E.vaultMove(a, dir); if (!err){ earnS().flexInt += acc; store.save(); } return err; }
function settleMatured(){
  const e = earnS(), now = Date.now(), done = e.locked.filter(p => now >= p.start + p.days * DAY);
  if (!done.length) return false;
  done.forEach(p => {
    const int = Math.round(p.amount * p.apr * p.days / 365 * 100) / 100;
    e.lockedInt += int; e.locked = e.locked.filter(x => x.id !== p.id);
    store.setBalance(S().balance + p.amount + int, "earn");
    store.notify("Earn position matured", `${p.days}D Locked: ${money(p.amount)} USDT + ${money(int)} USDT interest credited`, "ok");
    S().tx.unshift({id:U.uid(), kind:"deposit", amount:p.amount + int, method:"Earn maturity", t:now});
  });
  store.save(); return true;
}
const earnTotals = () => {
  const e = earnS(), vv = E.vaultValue();
  let lp = 0, la = 0, ld = 0; e.locked.forEach(p => { lp += p.amount; la += lockedAcc(p); ld += p.amount * p.apr / 365; });
  return {total: vv + lp + la, interest: e.flexInt + flexAcc() + e.lockedInt + la, today: vv * E.APR / 365 + ld, vv};
};

Pages.withdraw = () => {
  const apr = v => fmt(v * 100, 2) + "%";
  const html = pwrap("Earn", `
    <div class="pm-strip"><div class="lbl">Total Earn balance (USDT)</div><div class="big num" data-tot>0.00</div>
      <div class="pm-cols c2"><div><span>Cumulative interest</span><b class="num up" data-int>0.0000</b></div><div><span>Today's estimated earnings</span><b class="num up" data-today>0.0000</b></div></div>
      <div class="pm-acts"><button class="btn btn-primary" data-sub>Subscribe</button><button class="btn btn-ghost" data-red>Redeem</button></div></div>
    <section class="pm-sec"><h3 class="pm-st">Simple Earn products</h3>
      <div class="pm-prod" data-p="flex" style="cursor:pointer">${UI.coinImg("USDT", 28)}<div class="grow"><div class="pm-nm">USDT Flexible</div><div class="pm-s">Redeem any time</div></div>
        <div class="pm-apr"><b class="num">${apr(E.APR)}</b><span>APR</span></div><button class="pm-btn" data-p="flex">Subscribe</button></div>
      ${LOCKED.map(p => `<div class="pm-prod" data-p="${p.days}" style="cursor:pointer">${UI.coinImg("USDT", 28)}<div class="grow"><div class="pm-nm">USDT Locked <span class="pm-pill b">${p.days} Days</span></div><div class="pm-s">Interest paid at maturity</div></div>
        <div class="pm-apr"><b class="num">${apr(p.apr)}</b><span>APR</span></div><button class="pm-btn" data-p="${p.days}">Subscribe</button></div>`).join("")}</section>
    <section class="pm-sec" id="pmPos"></section>
    <p class="pm-risk">Interest is simulated on a demo balance. Early redemption of a locked product forfeits all accrued interest.</p>`);
  return {html, title:"Earn", mount(r){
    const $ = q => r.querySelector(q);
    const upd = () => { const t = earnTotals(); $("[data-tot]").textContent = money(t.total); $("[data-int]").textContent = fmt(t.interest, 4); $("[data-today]").textContent = fmt(t.today, 4);
      r.querySelectorAll("[data-acc]").forEach(el => { const id = el.dataset.acc; if (id === "flex") el.textContent = "+" + fmt(flexAcc(), 4); else { const p = earnS().locked.find(x => x.id === id); if (p) el.textContent = "+" + fmt(lockedAcc(p), 4); } });
      r.querySelectorAll("[data-pg]").forEach(el => { const p = earnS().locked.find(x => x.id === el.dataset.pg); if (p) el.style.width = Math.min(100, (Date.now() - p.start) / (p.days * DAY) * 100).toFixed(2) + "%"; }); };
    const renderPos = () => {
      const e = earnS(), t = earnTotals(); let h = "";
      if (t.vv > 0.0001) h += `<div class="pm-pos"><div class="pm-pos-h">${UI.coinImg("USDT", 28)}<div class="grow"><div class="pm-nm">USDT Flexible <span class="pm-pill g">${apr(E.APR)} APR</span></div></div><button class="pm-btn line" data-rf>Redeem</button></div>
        <div class="pm-pos-g"><div><span>Amount</span><b class="num">${fmt(t.vv, 4)}</b></div><div><span>Accrued interest</span><b class="num up" data-acc="flex">+0.0000</b></div><div><span>Est. daily</span><b class="num">${fmt(t.vv * E.APR / 365, 4)}</b></div></div></div>`;
      e.locked.slice().sort((a, b) => a.start + a.days * DAY - b.start - b.days * DAY).forEach(p => {
        const mat = p.start + p.days * DAY, left = Math.max(0, Math.ceil((mat - Date.now()) / DAY));
        h += `<div class="pm-pos"><div class="pm-pos-h">${UI.coinImg("USDT", 28)}<div class="grow"><div class="pm-nm">USDT Locked <span class="pm-pill b">${p.days} Days</span></div></div><button class="pm-btn line" data-rl="${p.id}">Redeem</button></div>
          <div class="pm-pos-g"><div><span>Amount</span><b class="num">${money(p.amount)}</b></div><div><span>APR</span><b class="num up">${apr(p.apr)}</b></div><div><span>Accrued interest</span><b class="num up" data-acc="${p.id}">+0.0000</b></div></div>
          <div class="pm-bar"><i data-pg="${p.id}" style="width:0"></i></div><div class="pm-pos-f"><span>Matures ${fdate(mat)}</span><span>${left} day${left === 1 ? "" : "s"} left</span></div></div>`;
      });
      $("#pmPos").innerHTML = `<h3 class="pm-st">My positions</h3>` + (h || pemp("No active positions", "Subscribe to a product above to start earning."));
      upd();
    };
    function openSub(initial){
      let cur = initial;
      const prods = [["flex", "Flexible", E.APR, 0], ...LOCKED.map(p => [String(p.days), p.days + "D", p.apr, p.days])];
      const body = () => {
        const pr = prods.find(x => x[0] === String(cur)), days = pr[3];
        return `<div class="pm-kv" style="padding-top:2px"><span>Product</span><b>USDT ${days ? days + "-day Locked" : "Flexible"}</b></div>
          <div class="pm-kv"><span>APR</span><b class="num up">${apr(pr[2])}</b></div>
          <span class="pm-lbl">Amount</span><div class="pm-fld" id="pmAf"><input id="pmAmt" type="number" inputmode="decimal" min="1" placeholder="Min ${days ? 10 : 1}" aria-label="Amount"><span class="u">USDT</span><button type="button" class="mx" data-max>Max</button></div>
          <div class="pm-kv" style="margin-top:8px"><span>Available</span><b class="num">${money(S().balance)} USDT</b></div>
          <div class="pm-kv"><span>${days ? "Est. interest at maturity" : "Est. daily interest"}</span><b class="num up" id="pmEi">0.0000 USDT</b></div>
          <div class="pm-kv"><span>Redemption date</span><b>${days ? fdate(Date.now() + days * DAY) : "Any time"}</b></div>
          <label class="pm-chk"><input type="checkbox" id="pmAg"><span>I have read and agree to the Simple Earn terms</span></label>
          <div class="pm-err" id="pmEr"></div><button class="btn btn-primary pm-cta" data-ok>Confirm subscription</button>`;
      };
      U.sheet("Subscribe", `<div class="pm-seg w" id="pmPs">${prods.map(p => `<button data-k="${p[0]}" class="${String(cur) === p[0] ? "on" : ""}">${p[1]}</button>`).join("")}</div><div id="pmSb" style="margin-top:8px"></div>`, el => {
        const mount = () => {
          const pr = prods.find(x => x[0] === String(cur)), days = pr[3], b = el.querySelector("#pmSb"); b.innerHTML = body();
          const inp = b.querySelector("#pmAmt"), ei = () => { const a = parseFloat(inp.value) || 0; b.querySelector("#pmEi").textContent = fmt(days ? a * pr[2] * days / 365 : a * pr[2] / 365, 4) + " USDT"; };
          inp.oninput = ei; b.querySelector("[data-max]").onclick = () => { inp.value = Math.floor(S().balance * 100) / 100; ei(); };
          b.querySelector("[data-ok]").onclick = () => {
            const a = Math.round(parseFloat(inp.value) * 100) / 100, min = days ? 10 : 1;
            const err = !(a > 0) ? "Enter a valid amount." : a < min ? `Minimum subscription is ${min} USDT.` : a > S().balance + 1e-9 ? "Amount exceeds your available balance." : !b.querySelector("#pmAg").checked ? "Please accept the Simple Earn terms." : "";
            b.querySelector("#pmEr").textContent = err; b.querySelector("#pmAf").classList.toggle("err", !!err && !(a > 0 && a >= min && a <= S().balance));
            if (err) return;
            if (days){ store.setBalance(S().balance - a, "earn"); earnS().locked.push({id:U.uid(), days, apr:pr[2], amount:a, start:Date.now()}); store.save(); }
            else { const e2 = flexMove(a, "in"); if (e2) return toast(e2, "bad"); }
            S().tx.unshift({id:U.uid(), kind:"withdraw", amount:a, method:"Earn · " + (days ? days + "D Locked" : "Flexible"), t:Date.now()}); store.save();
            U.fx("claim"); toast(`Subscribed ${money(a)} USDT`, "ok"); U.closeLayer(); renderPos();
          };
        };
        el.querySelectorAll("#pmPs [data-k]").forEach(btn => btn.onclick = () => { cur = btn.dataset.k; el.querySelectorAll("#pmPs [data-k]").forEach(x => x.classList.toggle("on", x === btn)); mount(); });
        mount();
      });
    }
    function openRedeemFlex(){
      const vv = E.vaultValue();
      if (vv < 0.01) return toast("No flexible balance to redeem.", "info");
      U.sheet("Redeem Flexible", `<div class="pm-kv" style="padding-top:2px"><span>Redeemable</span><b class="num">${fmt(vv, 4)} USDT</b></div>
        <span class="pm-lbl">Amount</span><div class="pm-fld" id="pmRf"><input id="pmRa" type="number" inputmode="decimal" min="0.01" aria-label="Amount"><span class="u">USDT</span><button type="button" class="mx" data-max>Max</button></div>
        <div class="pm-kv" style="margin-top:8px"><span>Arrives</span><b>Instantly in Trading account</b></div><div class="pm-err" id="pmRe"></div><button class="btn btn-primary pm-cta" data-ok>Confirm redemption</button>`, el => {
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
    settleMatured(); renderPos();
    $("[data-sub]").onclick = () => openSub("flex");
    $("[data-red]").onclick = openRedeemFlex;
    r.addEventListener("click", async e => {
      const rl = e.target.closest("[data-rl]");
      if (rl){
        const p = earnS().locked.find(x => x.id === rl.dataset.rl); if (!p) return;
        if (!await U.confirmBox("Redeem early?", `Early redemption forfeits all accrued interest (${fmt(lockedAcc(p), 4)} USDT). ${money(p.amount)} USDT principal returns to your Trading account now.`, "Redeem early", true)) return;
        const e2 = earnS(); e2.locked = e2.locked.filter(x => x.id !== p.id); store.setBalance(S().balance + p.amount, "earn"); store.save();
        S().tx.unshift({id:U.uid(), kind:"deposit", amount:p.amount, method:"Earn early redemption", t:Date.now()}); store.save();
        U.fx("claim"); toast(`Redeemed ${money(p.amount)} USDT, interest forfeited`, "ok"); return renderPos();
      }
      if (e.target.closest("[data-rf]")) return openRedeemFlex();
      const pr = e.target.closest("[data-p]"); if (pr) openSub(pr.dataset.p);
    });
    const iv = setInterval(() => { if (settleMatured()) renderPos(); else upd(); }, 1000);
    const offs = [bus.on("vault", renderPos)]; this.unmount = () => { clearInterval(iv); offs.forEach(f => f()); };
  }};
};
Pages.earn = Pages.withdraw;

/* ---------- Bots ---------- */
const BOT_TABS = [["spot", "Spot Grid", ["grid"]], ["futures", "Futures Grid", ["combo", "gold", "fx"]], ["dca", "DCA", ["dca"]], ["auto", "Auto Trade", []]];
const BOT_TAG = {grid:"Spot Grid", combo:"Futures Combo", gold:"Futures Grid", fx:"Futures Grid", dca:"DCA"};
const botTabs = active => `<nav class="pm-tabs" aria-label="Strategy type">${BOT_TABS.map(([k, n]) => `<a href="${k === "auto" ? "#/auto" : "#/bots/" + k}" class="${k === active ? "on" : ""}" ${k === active ? 'aria-current="page"' : ""}>${n}</a>`).join("")}</nav>`;

Pages.bots = (params) => {
  const tab = BOT_TABS.find(x => x[0] === (params && params[0])) || BOT_TABS[0];
  const defs = E.BOTS.filter(d => tab[2].includes(d.id));
  const html = pwrap("Trading Bots", botTabs(tab[0]) + `
    <div class="pm-strip"><div class="pm-cols"><div><span>Running bots</span><b class="num" data-br>0</b></div><div><span>Invested (USDT)</span><b class="num" data-bi>0.00</b></div><div><span>Total PnL (USDT)</span><b class="num" data-bp>0.00</b></div></div></div>
    <section class="pm-sec" id="pmRun"></section>
    <section class="pm-sec"><h3 class="pm-st">${esc(tab[1])} strategies</h3><div id="pmList"></div></section>
    <p class="pm-risk">Bots are simulated on live prices with demo funds. Past performance does not guarantee future results.</p>`);
  return {html, title:"Trading Bots", mount(r){
    const $ = q => r.querySelector(q);
    const pnlCls = v => v >= 0 ? "up" : "down";
    const renderLists = () => {
      const running = E.BOTS.filter(d => S().bots[d.id]?.running);
      $("#pmRun").innerHTML = `<h3 class="pm-st">Running (${running.length})</h3>` + (running.length ? running.map(d => { const b = S().bots[d.id], p = M.get(d.pair);
        return `<div class="pm-pos" data-bot="${d.id}"><div class="pm-pos-h">${UI.pairIcon(p, 30)}<div class="grow"><div class="pm-nm">${esc(d.name)}</div><div class="pm-s">${esc(M.label(p || {type:"crypto", base:d.pair}))} · <span class="pm-pill">${BOT_TAG[d.id]}</span></div></div><div class="pm-spk" data-sp></div></div>
          <div class="pm-pos-g"><div><span>PnL (USDT)</span><b class="num" data-pnl>--</b></div><div><span>Invested</span><b class="num">${money(b.invest)}</b></div><div><span>Runtime</span><b data-rt>--</b></div></div>
          <div class="pm-acts" style="margin-top:12px"><button class="pm-btn dn" style="flex:1;height:36px" data-stop>Stop bot</button></div></div>`; }).join("") : pemp("No running bots", "Create a bot from the strategies below."));
      $("#pmList").innerHTML = defs.map(d => { const b = S().bots[d.id], p = M.get(d.pair), on = b?.running;
        return `<div class="pm-prod" data-def="${d.id}">${UI.pairIcon(p, 32)}<div class="grow"><div class="pm-nm">${esc(d.name)}</div>
          <div class="pm-s">${esc(M.label(p || {type:"crypto", base:d.pair}))} · <span class="pm-pill ${d.risk === "High" ? "r" : d.risk === "Low" ? "g" : ""}">${d.risk} risk</span></div>
          <div class="pm-s" style="margin-top:3px">${esc(d.desc)}${b && !on ? ` Last run <b class="${pnlCls(b.pnl)}">${signed(b.pnl)} USDT</b>.` : ""}</div></div>
          <div class="pm-apr"><b class="num">${esc(d.apy)}</b><span>Est. APY</span>${on ? `<span class="pm-pill g" style="margin-top:6px">Running</span>` : `<button class="pm-btn" style="margin-top:6px" data-create="${d.id}">Create</button>`}</div></div>`; }).join("");
      tick();
    };
    const tick = () => {
      let run = 0, inv = 0, tot = 0;
      E.BOTS.forEach(d => { const b = S().bots[d.id]; if (!b?.running) return; run++; inv += b.invest; const v = E.botPnl(d.id); tot += v;
        const c = r.querySelector(`#pmRun [data-bot="${d.id}"]`); if (!c) return;
        const el = c.querySelector("[data-pnl]"); el.textContent = signed(v) + " (" + pct(v / b.invest * 100) + ")"; el.className = "num " + pnlCls(v);
        c.querySelector("[data-rt]").textContent = runtime(b.since); c.querySelector("[data-sp]").innerHTML = spark(b.series.concat(v), 84, 30); });
      $("[data-br]").textContent = run; $("[data-bi]").textContent = money(inv); const bp = $("[data-bp]"); bp.textContent = signed(tot); bp.className = "num " + pnlCls(tot);
    };
    renderLists();
    r.addEventListener("click", async e => {
      const cr = e.target.closest("[data-create]");
      if (cr){
        const d = E.BOTS.find(x => x.id === cr.dataset.create), p = M.get(d.pair);
        return U.sheet("Create " + d.name, `<div class="pm-kv" style="padding-top:2px"><span>Strategy</span><b>${BOT_TAG[d.id]}</b></div><div class="pm-kv"><span>Pair</span><b>${esc(M.label(p || {type:"crypto", base:d.pair}))}</b></div><div class="pm-kv"><span>Risk</span><b>${d.risk}</b></div><div class="pm-kv"><span>Est. APY</span><b class="num up">${esc(d.apy)}</b></div>
          <p class="pm-s" style="margin:6px 0 0">${esc(d.desc)}</p>
          <span class="pm-lbl">Investment</span><div class="pm-fld" id="pmBf"><input id="pmBa" type="number" inputmode="decimal" min="10" value="100" aria-label="Investment amount"><span class="u">USDT</span><button type="button" class="mx" data-max>Max</button></div>
          <div class="pm-kv" style="margin-top:8px"><span>Available</span><b class="num">${money(S().balance)} USDT</b></div><div class="pm-kv"><span>Minimum</span><b class="num">10 USDT</b></div>
          <div class="pm-err" id="pmBe"></div><button class="btn btn-primary pm-cta" data-ok>Start bot</button>`, el => {
          el.querySelector("[data-max]").onclick = () => el.querySelector("#pmBa").value = Math.floor(S().balance * 100) / 100;
          el.querySelector("[data-ok]").onclick = () => { const err = E.startBot(d.id, parseFloat(el.querySelector("#pmBa").value));
            el.querySelector("#pmBe").textContent = err || ""; el.querySelector("#pmBf").classList.toggle("err", !!err); if (err) return;
            U.closeLayer(); toast("Bot started", "ok"); renderLists(); };
        });
      }
      const st = e.target.closest("[data-stop]"), c = st && st.closest("[data-bot]");
      if (c && await U.confirmBox("Stop bot?", "Your investment plus PnL will be returned to your Trading account.", "Stop bot", true)){ const v = E.stopBot(c.dataset.bot); toast(`Bot stopped: ${signed(v)} USDT`, v >= 0 ? "ok" : "info"); renderLists(); }
    });
    const iv = setInterval(tick, 2000), off = bus.on("bots", tick);
    this.unmount = () => { clearInterval(iv); off(); };
  }};
};

/* ---------- Auto trading ---------- */
Pages.auto = () => {
  const a = S().auto;
  const tradables = [...M.pairs.values()].filter(p => p.tradable);
  const html = pwrap("Auto Trade", botTabs("auto") + `
    <div class="pm-strip"><div class="row between"><div><div class="lbl">Status</div><div class="big" id="as" style="font-size:20px"></div></div></div>
      <div class="pm-cols c3"><div><span>Trades placed</span><b class="num" id="ac">0</b></div><div><span>Auto PnL (USDT)</span><b class="num" id="ap">0.00</b></div><div><span>Win rate</span><b class="num" id="aw">0%</b></div></div></div>
    <section class="pm-sec"><h3 class="pm-st">Strategy settings</h3><form id="af" novalidate style="padding:6px 0 14px">
      <div class="form-row"><label for="ap2">Pair</label><div class="field"><select id="ap2">${tradables.map(p => `<option value="${p.sym}" ${p.sym === a.pair ? "selected" : ""}>${esc(M.label(p))}</option>`).join("")}</select></div></div>
      <div class="form-row"><label for="aa">Amount per trade (USDT)</label><div class="field" id="aaf">${UI.usdt(20)}<input id="aa" type="number" min="1" inputmode="decimal" value="${a.amount}"></div></div>
      <div class="form-row"><label>Expiry</label><div class="seg" data-g="expiry">${C.EXPIRIES.map(x => `<button type="button" data-v="${x}" class="${a.expiry === x ? "on" : ""}">${x < 60 ? x + "s" : x / 60 + "m"}</button>`).join("")}</div></div>
      <div class="form-row"><label>Strategy</label><div class="seg" data-g="strategy">${[["trend", "Trend follow"], ["reversal", "Reversal"], ["random", "Random"]].map(([k, n]) => `<button type="button" data-v="${k}" class="${a.strategy === k ? "on" : ""}">${n}</button>`).join("")}</div></div>
      <div class="form-row"><label>Trade every</label><div class="seg" data-g="interval">${[10, 20, 30, 60].map(x => `<button type="button" data-v="${x}" class="${a.interval === x ? "on" : ""}">${x}s</button>`).join("")}</div></div>
      <div class="form-row"><label for="amx">Stop after (trades)</label><div class="field"><input id="amx" type="number" min="1" max="500" value="${a.max}"></div></div>
      <div class="err-msg" id="ae"></div><button class="btn btn-block btn-lg" id="ab" type="submit" style="border-radius:10px"></button></form></section>
    <section class="pm-sec"><div class="row between" style="padding-top:2px"><h3 class="pm-st">Activity log</h3><a href="#/trade/${a.pair}" class="pm-s" style="color:var(--brand);padding-top:10px">Open chart</a></div><div id="al"></div></section>`);
  return {html, title:"Auto Trade", mount(r){
    const $ = q => r.querySelector(q); const sel = {expiry:a.expiry, strategy:a.strategy, interval:a.interval};
    r.querySelectorAll("[data-g]").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => { sel[g.dataset.g] = isNaN(b.dataset.v) ? b.dataset.v : +b.dataset.v; g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); }));
    const render = () => {
      const on = S().auto.on, h = S().history.filter(x => x.source === "auto"), w = h.filter(x => x.result === "win").length;
      $("#as").innerHTML = `<span class="pm-dot ${on ? "" : "off"}"></span>${on ? "Running" : "Stopped"}`;
      $("#ac").textContent = S().auto.count; const pnl = h.reduce((s, x) => s + x.profit, 0); const ap = $("#ap"); ap.textContent = signed(pnl); ap.className = "num " + (pnl > 0 ? "up" : pnl < 0 ? "down" : "");
      $("#aw").textContent = (h.length ? Math.round(w / h.length * 100) : 0) + "%";
      const b = $("#ab"); b.className = "btn btn-block btn-lg " + (on ? "btn-down" : "btn-primary"); b.innerHTML = on ? ic("stop", 16) + " Stop auto trading" : ic("play", 16) + " Start auto trading";
      r.querySelectorAll("#af input, #af select, #af [data-g] button").forEach(x => x.disabled = on);
      $("#al").innerHTML = S().auto.log.length ? S().auto.log.map(l => `<div class="pm-row" style="min-height:44px"><span class="pm-s mono" style="width:62px;flex-shrink:0">${U.timeStr(l.t)}</span><span class="pm-t grow" style="font-size:13px;font-weight:400">${esc(l.msg)}</span></div>`).join("") : pemp("No activity yet", "Configure the strategy and start auto trading.");
    };
    render();
    $("#af").onsubmit = e => {
      e.preventDefault();
      if (S().auto.on){ E.stopAuto(); toast("Auto trading stopped", "info"); return render(); }
      const amount = parseFloat($("#aa").value), max = parseInt($("#amx").value), pair = $("#ap2").value;
      const err = !(amount >= 1) ? "Minimum amount is 1 USDT." : amount > S().balance ? "Amount exceeds your balance." : !(max >= 1 && max <= 500) ? "Stop after must be between 1 and 500." : M.get(pair).closed ? "Market closed for this pair. Choose a crypto pair." : M.isStale(M.get(pair)) ? "Market data offline for this pair. Try again shortly." : "";
      $("#ae").textContent = err; $("#aaf").classList.toggle("err", !!err);
      if (err) return toast(err, "bad");
      E.startAuto({pair, amount, max, ...sel}); toast("Auto trading started", "ok"); render();
    };
    const offs = [bus.on("auto", render), bus.on("history", render)];
    this.unmount = () => offs.forEach(f => f());
  }};
};
/* ---------- VIP signals ---------- */
Pages.vip = () => {
  let filt = "all";
  const html = pwrap("VIP Signals", `
    <div class="pm-strip" style="padding:14px 16px"><div class="pm-t">Momentum signals</div><div class="pm-s">Generated every 5 seconds from live tick momentum. Included with your account.</div></div>
    <nav class="pm-tabs" id="vf" aria-label="Market type">${[["all", "All"], ["crypto", "Crypto"], ["forex", "Forex"], ["metal", "Metals"]].map(([k, n]) => `<a href="javascript:void 0" data-f="${k}" class="${k === "all" ? "on" : ""}">${n}</a>`).join("")}</nav>
    <section class="pm-sec" id="vl"></section>
    <p class="pm-risk">Signals are educational and are not financial advice.</p>`);
  return {html, title:"VIP Signals", mount(r){
    const render = () => {
      const list = [...M.pairs.values()].filter(p => p.tradable && (filt === "all" || p.type === filt));
      r.querySelector("#vl").innerHTML = list.map(p => {
        const m = M.momentum(p.sym, 90000), chg = p.chg || 0;
        const score = U.clamp(m * 0.7 + U.clamp(chg / 5, -1, 1) * 0.3, -1, 1);
        const dir = score >= 0 ? "up" : "down", conf = Math.round(55 + Math.abs(score) * 40);
        const expTxt = Math.abs(score) > .5 ? "30s" : Math.abs(score) > .25 ? "1m" : "5m";
        return `<div class="pm-prod">${UI.pairIcon(p, 32)}<div class="grow"><div class="pm-nm">${esc(M.label(p))} ${p.closed ? `<span class="pm-pill">Closed</span>` : `<span class="pm-pill ${dir === "up" ? "g" : "r"}">${dir === "up" ? "Up" : "Down"}</span>`}</div>
          <div class="pm-s num">${M.fmtPx(p)} · Expiry ${expTxt} · Confidence ${conf}%</div><div class="pm-prog"><i style="width:${conf}%"></i></div></div>
          <a class="pm-btn ${p.closed ? "line" : ""}" href="#/trade/${p.sym}">${p.closed ? "View" : "Trade"}</a></div>`;
      }).join("") || pemp("No signals");
    };
    render();
    r.querySelectorAll("[data-f]").forEach(b => b.onclick = e => { e.preventDefault(); filt = b.dataset.f; r.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x === b)); render(); });
    const iv = setInterval(render, 5000); this.unmount = () => clearInterval(iv);
  }};
};

/* ---------- Referral ---------- */
Pages.referral = () => {
  const p = S().profile, link = location.origin + location.pathname + "#/home?ref=" + p.ref;
  const html = pwrap("Refer and Earn", `
    <section class="pm-sec"><div class="pm-pad"><div class="pm-t" style="font-size:16px;font-weight:600">Invite friends, earn 20% commission</div><div class="pm-s">Share your link. Friends get a 100 USDT demo bonus.</div>
      <span class="pm-lbl">Referral code</span><div class="pm-copy"><code style="font-weight:700;letter-spacing:.08em;font-size:15px">${esc(p.ref)}</code><button data-cc>Copy</button></div>
      <span class="pm-lbl">Invite link</span><div class="pm-copy"><code>${esc(link)}</code><button data-cl>Copy</button></div>
      <button class="btn btn-primary pm-cta" data-share style="margin-top:14px">${ic("share", 16)} Share invite</button></div></section>
    <div class="pm-stats">${pstat("Friends invited", "0")}${pstat("Commission rate", "20%")}${pstat("Rewards earned", "0.00 USDT")}${pstat("Your tier", "Bronze")}</div>
    ${psec("How it works", [["Share your link", "Send your invite link or code to friends."], ["Friend signs up", "They join with your invite code."], ["Earn rewards", "Get 20% of their trading fees."]].map(([a, b], k) => `<div class="pm-row"><span class="pm-step-n">${k + 1}</span><div class="pm-main"><div class="pm-t">${a}</div><div class="pm-s">${b}</div></div></div>`).join(""))}
    ${psec("Reward tiers", `<table class="pm-tbl"><thead><tr><th>Tier</th><th>Friends</th><th>Commission</th></tr></thead><tbody><tr><td>Bronze</td><td>0-4</td><td>20%</td></tr><tr><td>Silver</td><td>5-19</td><td>25%</td></tr><tr><td>Gold</td><td>20-49</td><td>30%</td></tr><tr><td>Diamond</td><td>50+</td><td>40%</td></tr></tbody></table>`)}
    ${psec("FAQ", faq([["Who can I invite?", "Anyone. Share your link on any app or chat."], ["When are rewards paid?", "Commissions are credited instantly when a referred friend trades."], ["Is there a limit?", "No limit on the number of friends you can invite."]]))}`);
  return {html, title:"Referral", mount(r){
    r.querySelector("[data-cc]").onclick = () => U.copyText(p.ref, "Referral code copied");
    r.querySelector("[data-cl]").onclick = () => U.copyText(link, "Invite link copied");
    r.querySelector("[data-share]").onclick = () => navigator.share ? navigator.share({title:C.APP_NAME, text:"Trade binary options & futures on live markets. Use my code " + p.ref, url:link}).catch(() => {}) : U.copyText(link, "Invite link copied");
  }};
};

/* ---------- Profile ---------- */
Pages.profile = () => {
  const mi = (i, n, h, extra="") => { const inner = `<span class="pm-ico">${ic(i, 18)}</span><span class="pm-main pm-t">${n}</span>${extra}<span class="chev">${ic("chev", 16)}</span>`; return h.startsWith("#") ? `<a class="pm-row tap" href="${h}">${inner}</a>` : `<button class="pm-row tap" data-act="${h}">${inner}</button>`; };
  const html = pwrap("Profile", `
    <section class="pm-sec"><div class="pm-pad row" style="gap:14px"><span class="pm-av" id="pa"></span>
      <div class="grow"><div class="row" style="gap:6px"><b class="ellipsis" id="pn" style="font-size:17px;font-weight:600"></b><button class="icon-btn" data-edit aria-label="Edit name" style="width:32px;height:32px">${ic("edit", 16)}</button></div>
      <button class="row pm-s" data-uid style="gap:4px">UID <span id="pu"></span> ${ic("copy", 12)}</button></div><span class="pm-pill b">VIP 1</span></div></section>
    <div class="pm-strip"><div class="lbl">Trading balance (USDT)</div><div class="big num" id="pb"></div><div class="pm-spk" id="pbs" style="width:100%;height:44px;margin-top:8px"></div></div>
    <div class="pm-stats" id="pk"></div>
    <section class="pm-sec">${mi("deposit", "Deposit", "#/deposit")}${mi("earn", "Earn", "#/earn")}${mi("wallet", "Transactions", "tx")}${mi("history", "Trade history", "th")}${mi("gift", "Refer and Earn", "#/referral")}${mi("gear", "Settings", "#/settings")}${mi("headset", "Contact Support", "#/support")}${mi("info", "About Us", "#/about")}</section>
    <section class="pm-sec"><div class="pm-row" data-rsw><span class="pm-ico">${ic("moon", 18)}</span><div class="pm-main pm-t">Dark mode</div>${swb("theme", false)}</div>
      <button class="pm-row tap" data-reset><span class="pm-ico pm-danger">${ic("reset", 18)}</span><span class="pm-main pm-t pm-danger">Reset demo account</span><span class="pm-s">${money(C.START_BALANCE)} USDT</span></button></section>`);
  return {html, title:"Profile", mount(r){
    const $ = q => r.querySelector(q);
    const isDark = () => document.documentElement.dataset.theme === "dark";
    const syncSw = () => { const s = $("[data-sw=theme]"); s.classList.toggle("on", isDark()); s.setAttribute("aria-checked", isDark()); };
    const render = () => {
      const p = S().profile, st = E.stats();
      $("#pa").textContent = p.name[0]; $("#pn").textContent = p.name; $("#pu").textContent = p.uid;
      $("#pb").textContent = money(S().balance);
      $("#pbs").innerHTML = spark([C.START_BALANCE, ...S().balHist.map(x => x.b)].slice(-120), 300, 44, "var(--brand)");
      $("#pk").innerHTML = pstat("Total trades", st.trades) + pstat("Win rate", st.winRate.toFixed(1) + "%") + pstat("Net PnL", signed(st.net), st.net >= 0 ? "up" : "down") + pstat("Best win", "+" + money(st.best), "up") + pstat("Volume", money(st.vol)) + pstat("Wins / Losses", st.wins + " / " + st.losses) + pstat("Win streak", st.streak) + pstat("Open positions", S().positions.length);
    };
    render(); syncSw();
    $("[data-uid]").onclick = () => U.copyText(S().profile.uid, "UID copied");
    $("[data-edit]").onclick = () => U.sheet("Edit nickname", `<input class="pm-in" id="nn" maxlength="20" value="${esc(S().profile.name)}" aria-label="Nickname"><div class="pm-err" id="nne"></div><button class="btn btn-primary pm-cta" data-sv>Save</button>`, el => {
      el.querySelector("[data-sv]").onclick = () => { const v = el.querySelector("#nn").value.trim(); if (v.length < 2){ el.querySelector("#nne").textContent = "Nickname must be at least 2 characters."; return; } S().profile.name = v; store.save(); U.closeLayer(); render(); toast("Nickname updated", "ok"); };
    });
    r.querySelectorAll("[data-act]").forEach(a => { const k = a.dataset.act;
      if (k === "tx") a.onclick = () => U.sheet("Transactions", txList());
      if (k === "th") a.onclick = () => { const h = S().history.slice(0, 100); U.sheet("Trade history", h.length ? h.map(x => { const p = M.get(x.sym); return `<div class="pm-row">${UI.pairIcon(p, 28)}<div class="pm-main"><div class="pm-t">${esc(p ? M.label(p) : x.sym)} · ${x.dir === "up" ? "Up" : "Down"}</div><div class="pm-s">${U.dateStr(x.closed)} · ${money(x.amount)} USDT</div></div><b class="mono ${x.profit > 0 ? "up" : x.profit < 0 ? "down" : ""}">${signed(x.profit)}</b></div>`; }).join("") : pemp("No trades yet")); }; });
    $("[data-rsw]").onclick = () => { const to = isDark() ? "light" : "dark"; S().settings.theme = to; App.setTheme(to); syncSw(); };
    $("[data-reset]").onclick = async () => { if (await U.confirmBox("Reset demo account?", `Balance returns to ${money(C.START_BALANCE)} USDT. Open positions, history and bots are cleared. Your settings are kept.`, "Reset", true)){ if (S().auto.on) E.stopAuto("Account reset."); store.reset(); render(); toast(`Balance reset to ${money(C.START_BALANCE)} USDT`, "ok"); } };
    const offs = [bus.on("balance", render), bus.on("history", render), bus.on("theme", syncSw)]; this.unmount = () => offs.forEach(f => f());
  }};
};

/* ---------- Settings ---------- */
Pages.settings = () => {
  const st0 = S().settings;
  if (st0.colorMode == null) st0.colorMode = "gu";
  if (st0.marginMode == null) st0.marginMode = "cross";
  if (st0.hideSmall == null) st0.hideSmall = false;
  const SND_EV = [["open", "Order opened"], ["close", "Position closed"], ["win", "Trade won"], ["loss", "Trade lost"], ["alert", "Price alert"], ["notify", "Notification"], ["err", "Error"]];
  const CONF = [["market", "Market order", "Ask before placing a market order"], ["limit", "Limit order", "Ask before placing a limit order"], ["close", "Close position", "Ask before closing a position"], ["binary", "Binary trade", "Ask before opening a binary trade"], ["option", "Option trade", "Ask before opening an option trade"]];
  const CHART = [["bs", "Buy / Sell markers", "Show your fills on the chart"], ["pos", "Position lines", "Entry price and liquidation lines"], ["ord", "Order lines", "Open limit orders on the chart"], ["hilo", "High / Low labels", "Highest and lowest visible price"], ["cd", "Candle countdown", "Time left on the current candle"]];
  const sg = (attr, val, items) => `<div class="pm-seg">${items.map(([k, n]) => `<button ${attr}="${k}" class="${String(val) === String(k) ? "on" : ""}">${n}</button>`).join("")}</div>`;
  const html = pwrap("Settings", `
    ${psec("Appearance",
      prow("Theme", "", sg("data-th", st0.theme, [["light", "Light"], ["dark", "Dark"], ["system", "System"]])) +
      prow("Price colour", `<span id="pmCmS">${st0.colorMode === "ru" ? "Red up / Green down" : "Green up / Red down"}</span>`, sg("data-cm", st0.colorMode, [["gu", "Green up"], ["ru", "Red up"]])))}
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
      `<button class="pm-row tap" data-reset><span class="pm-main"><span class="pm-t pm-danger">Reset demo account</span><span class="pm-s" style="display:block">Balance back to ${money(C.START_BALANCE)} USDT, positions and history cleared. Settings are kept.</span></span><span class="chev">${ic("chev", 16)}</span></button>
       <button class="pm-row tap" data-wipe><span class="pm-main"><span class="pm-t pm-danger">Clear all app data</span><span class="pm-s" style="display:block">Delete everything stored on this device, including settings.</span></span><span class="chev">${ic("chev", 16)}</span></button>`)}
    <div class="pm-foot">Version 5.2 · ${esc(C.APP_NAME)}</div>`);
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
    <section class="pm-sec"><div class="pm-pad"><div class="row" style="gap:10px"><img src="favicon.svg" alt="" width="32" height="32"><div><div class="pm-t" style="font-size:16px;font-weight:600">${esc(C.APP_NAME)}</div><div class="pm-s">Version 5.2</div></div></div>
      <p class="sub" style="margin-top:12px;font-size:14px;line-height:1.55">A mobile-first demo trading platform for binary options and USDT futures. Practice with virtual USDT on real-time Binance and biquote.io prices, with pro charts, indicators, bots and risk tools in one app.</p></div></section>
    <div class="pm-stats">${pstat("Markets", "120+")}${pstat("Tradable pairs", "20")}${pstat("Max leverage", "125x")}${pstat("Binary payout", "+92%")}</div>
    ${psec("What you can do", [["chart", "Live charts", "Tick line and candles from 5s to 4h on real Binance and biquote.io data."], ["zap", "Binary trades", "Predict Up or Down over 30s, 1m or 5m and earn +92% on a win."], ["bot", "Bots and auto trading", "Run simulated strategy bots and an automatic trade engine."], ["crown", "VIP signals", "Momentum-based signals for every tradable pair."], ["shield", "Demo account", "Virtual USDT stored on your device. No real funds."]].map(([i, a, b]) => `<div class="pm-row" style="align-items:flex-start;padding:12px 0"><span class="pm-ico" style="margin-top:1px">${ic(i, 18)}</span><div class="pm-main"><div class="pm-t">${a}</div><div class="pm-s" style="font-size:13px">${b}</div></div></div>`).join(""))}
    ${psec("FAQ", faq([["Is my balance real money?", "No. Your account runs on virtual USDT, so you can practice binary and futures trading on live prices without financial risk."], ["Where do prices come from?", "Crypto prices stream from Binance public market data. Forex, gold and silver stream from biquote.io."], ["Why is a forex pair closed?", "Forex and metals markets close on weekends. Those pairs show Market closed until they reopen."], ["How is a trade settled?", "At expiry the live price is compared with your entry. Up wins if the price is higher, Down wins if it is lower. Equal price is a refund."], ["Can I reset my balance?", "Yes. Go to Settings, Data, Reset demo account to restore " + money(C.START_BALANCE) + " USDT."]]))}
    <p class="pm-risk">Trading involves risk. Binary options can lose 100% of the stake. This app is educational and is not financial advice.</p>`);
  return {html, title:"About Us"};
};

/* ---------- Support ---------- */
Pages.support = () => {
  const tel = C.SUPPORT_PHONE.replace(/\s/g, "");
  const html = pwrap("Contact Support", `
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
    announce:[["NovaTrade Team", "New: 4h candles and VIP signals for gold & silver are live."], ["NovaTrade Team", "Tip: use the Tick chart for 30s trades and 1m candles for 5m trades."]],
    crypto:[["Arjun", "BTC holding the range. Waiting for a breakout before going Up."], ["Mia", "SOL momentum looks strong on 15s candles."], ["Leo", "Don't over-trade. 2% of balance per trade max."]],
    forex:[["Sara", "EUR/USD quiet in the Asian session, better moves at London open."], ["Kenji", "USD/JPY respecting the high of the day."]],
    strategy:[["Priya", "Trend follow on 1m + 5m expiry has been my best combo so far."], ["Omar", "Testing reversal strategy in Auto Trading with 5 USDT size."]]
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
Pages.notfound = () => ({title:"Page not found", html:`<div class="nf"><div class="big">404</div><div class="h1" style="margin:8px 0">Page not found</div><p class="sub" style="margin-bottom:24px">The page you’re looking for doesn’t exist or was moved.</p><a class="btn btn-primary" href="#/home">${ic("home",18)} Back to Home</a></div>${UI.footer()}`});
})();
