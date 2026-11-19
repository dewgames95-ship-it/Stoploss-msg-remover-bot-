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
  return tx.map(x => `<div class="list-item"><span class="ic ${x.kind==="deposit"?"p3":"p2"}">${ic(x.kind==="deposit"?"deposit":"withdraw",18)}</span>
    <div class="grow"><b style="font-size:14px">${x.kind==="deposit"?"Deposit":"Withdraw"} · ${esc(x.method)}</b><div class="label">${U.dateStr(x.t)} · ${esc(x.id.slice(0,8).toUpperCase())}</div></div>
    <div style="text-align:right"><b class="mono ${x.kind==="deposit"?"up":"down"}">${x.kind==="deposit"?"+":"-"}${money(x.amount)}</b><div class="label up">Completed</div></div></div>`).join("");
}

/* ---------- Deposit ---------- */
Pages.deposit = () => {
  let method = "TRC20";
  const addr = {TRC20:"TQ7f3demoNovaTradeWalletX9pLk2mR4sVw8", BEP20:"0x7d3a9cDemo4f1b2E8aNovaTrade6c5D9e0B1a2F3c4"};
  const html = wrap("Deposit", `<div class="two-col"><div class="stack">
    <div class="hero"><div class="label">Available balance</div><div class="bal mono" id="db"></div><div class="sub">Demo funds only — no real payment is taken.</div></div>
    <section class="card">
      <form id="df" novalidate>
        <div class="form-row"><label>Method</label><div class="seg" id="dm"><button type="button" class="on" data-m="TRC20">USDT · TRC20</button><button type="button" data-m="BEP20">USDT · BEP20</button><button type="button" data-m="Card">Card</button></div></div>
        <div class="form-row" id="addrRow"><label>Demo deposit address</label><div class="field" style="height:auto;padding:10px 12px"><code id="addr" class="grow" style="word-break:break-all;font-size:12px"></code><button type="button" class="btn btn-ghost btn-sm" data-copy>${ic("copy",14)} Copy</button></div></div>
        <div class="form-row"><label for="da">Amount (USDT)</label><div class="field" id="daf">${UI.usdt(22)}<input id="da" type="number" inputmode="decimal" min="10" max="100000" value="1000"></div>
          <div class="chips" style="margin-top:8px">${[100,500,1000,5000,10000].map(v => `<button type="button" data-v="${v}">${fmt(v,0)}</button>`).join("")}</div>
          <div class="err-msg" id="de" role="alert"></div></div>
        <button class="btn btn-primary btn-block" type="submit">${ic("deposit",18)} Deposit now</button>
      </form>
    </section></div>
    <section class="card"><div class="title" style="margin-bottom:4px">Recent deposits</div><div id="dl"></div></section></div>`);
  return {html, title:"Deposit", mount(r){
    const render = () => { r.querySelector("#db").textContent = money(S().balance) + " USDT"; r.querySelector("#dl").innerHTML = txList("deposit"); };
    const setM = m => { method = m; r.querySelectorAll("[data-m]").forEach(b => b.classList.toggle("on", b.dataset.m === m)); r.querySelector("#addrRow").classList.toggle("hide", m === "Card"); r.querySelector("#addr").textContent = addr[m] || ""; };
    setM(method); render();
    r.querySelectorAll("[data-m]").forEach(b => b.onclick = () => setM(b.dataset.m));
    r.querySelector("[data-copy]").onclick = () => U.copyText(addr[method], "Address copied");
    r.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { r.querySelector("#da").value = b.dataset.v; r.querySelector("#de").textContent = ""; });
    r.querySelector("#df").onsubmit = async e => {
      e.preventDefault();
      const a = parseFloat(r.querySelector("#da").value), err = r.querySelector("#de");
      let m = !(a > 0) ? "Enter a valid amount." : a < 10 ? "Minimum deposit is 10 USDT." : a > 100000 ? "Maximum deposit is 100,000 USDT per transaction." : S().balance + a > 10000000 ? "Demo balance cap is 10,000,000 USDT." : "";
      r.querySelector("#daf").classList.toggle("err", !!m); err.textContent = m;
      if (m) return toast(m, "bad");
      await processing(e.submitter || r.querySelector("[type=submit]"));
      S().tx.unshift({id:U.uid(), kind:"deposit", amount:a, method: method === "Card" ? "Card (demo)" : "USDT " + method, t:Date.now()});
      store.setBalance(S().balance + a, "deposit");
      store.notify("Deposit successful", `+${money(a)} USDT added to your demo balance`, "ok");
      toast(`Deposit successful! +${money(a)} USDT`, "ok"); U.beep("win"); render();
    };
    const off = bus.on("balance", render); this.unmount = off;
  }};
};

/* ---------- Withdraw ---------- */
Pages.withdraw = () => {
  let net = "TRC20"; const FEE = 1;
  const html = wrap("Withdraw", `<div class="two-col"><div class="stack">
    <div class="hero"><div class="label">Withdrawable balance</div><div class="bal mono" id="wb"></div><div class="sub">Demo withdrawals are simulated — nothing is sent on-chain.</div></div>
    <section class="card"><form id="wf" novalidate>
      <div class="form-row"><label>Network</label><div class="seg"><button type="button" class="on" data-n="TRC20">TRC20 (Tron)</button><button type="button" data-n="BEP20">BEP20 (BSC)</button></div></div>
      <div class="form-row"><label for="wa">Wallet address</label><div class="field" id="waf"><input id="wa" type="text" autocomplete="off" spellcheck="false" placeholder="T… (34 characters)" style="font-size:14px;font-weight:500"></div><div class="err-msg" id="wae"></div></div>
      <div class="form-row"><label for="wm">Amount (USDT)</label><div class="field" id="wmf">${UI.usdt(22)}<input id="wm" type="number" inputmode="decimal" min="10"><button type="button" class="btn btn-ghost btn-sm" data-max style="background:var(--card)">Max</button></div><div class="err-msg" id="wme"></div></div>
      <div class="row between sub"><span>Network fee</span><b class="mono">${FEE.toFixed(2)} USDT</b></div>
      <div class="row between sub" style="margin:4px 0 16px"><span>You will receive</span><b class="mono up" id="wr">0.00 USDT</b></div>
      <button class="btn btn-primary btn-block" type="submit">${ic("withdraw",18)} Withdraw</button>
    </form></section></div>
    <section class="card"><div class="title" style="margin-bottom:4px">Recent withdrawals</div><div id="wl"></div></section></div>`);
  return {html, title:"Withdraw", mount(r){
    const $ = q => r.querySelector(q);
    const render = () => { $("#wb").textContent = money(S().balance) + " USDT"; $("#wl").innerHTML = txList("withdraw"); };
    const calc = () => { const a = parseFloat($("#wm").value) || 0; $("#wr").textContent = money(Math.max(0, a - FEE)) + " USDT"; };
    render();
    r.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { net = b.dataset.n; r.querySelectorAll("[data-n]").forEach(x => x.classList.toggle("on", x===b)); $("#wa").placeholder = net === "TRC20" ? "T… (34 characters)" : "0x… (42 characters)"; });
    $("[data-max]").onclick = () => { $("#wm").value = Math.floor(S().balance*100)/100; calc(); };
    $("#wm").addEventListener("input", calc);
    $("#wf").onsubmit = async e => {
      e.preventDefault();
      const ad = $("#wa").value.trim(), a = parseFloat($("#wm").value);
      const ae = !ad ? "Enter a wallet address." : net === "TRC20" && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(ad) ? "Invalid TRC20 address (starts with T, 34 characters)." : net === "BEP20" && !/^0x[0-9a-fA-F]{40}$/.test(ad) ? "Invalid BEP20 address (0x + 40 hex characters)." : "";
      const me = !(a > 0) ? "Enter a valid amount." : a < 10 ? "Minimum withdrawal is 10 USDT." : a > S().balance ? "Amount exceeds your balance." : "";
      $("#wae").textContent = ae; $("#wme").textContent = me; $("#waf").classList.toggle("err", !!ae); $("#wmf").classList.toggle("err", !!me);
      if (ae || me) return toast(ae || me, "bad");
      await processing(e.submitter || $("[type=submit]"));
      S().tx.unshift({id:U.uid(), kind:"withdraw", amount:a, method:"USDT " + net, addr:ad, t:Date.now()});
      store.setBalance(S().balance - a, "withdraw");
      store.notify("Withdrawal complete", `-${money(a)} USDT to ${ad.slice(0,6)}…${ad.slice(-4)}`, "info");
      toast(`Withdrawal submitted! ${money(a - FEE)} USDT sent (demo)`, "ok");
      $("#wm").value = ""; calc(); render();
    };
    this.unmount = bus.on("balance", render);
  }};
};

/* ---------- Bots ---------- */
Pages.bots = () => {
  const html = wrap("Bots", `<div class="hero" style="margin-bottom:16px"><div class="row between"><div><div class="label">Running bots</div><div class="bal mono" id="br">0</div></div><div style="text-align:right"><div class="label">Total bot PnL</div><div class="mono" style="font-size:20px;font-weight:800" id="bp">0.00</div></div></div>
    <div class="sub" style="margin-top:8px">Bots run on live Binance & biquote prices. Profits are simulated with demo funds.</div></div>
    <div class="two-col" id="bl" style="display:grid;gap:16px"></div>`);
  return {html, title:"Trading Bots", mount(r){
    const render = (full) => {
      let run = 0, tot = 0;
      E.BOTS.forEach(d => { const b = S().bots[d.id]; if (b?.running){ run++; tot += E.botPnl(d.id); } });
      r.querySelector("#br").textContent = run; const bp = r.querySelector("#bp"); bp.textContent = signed(tot) + " USDT";
      if (full){
        r.querySelector("#bl").innerHTML = E.BOTS.map(d => { const b = S().bots[d.id], p = M.get(d.pair); return `<section class="card bot-card" data-bot="${d.id}">
          <div class="row"><span class="ic p${d.id==="combo"?1:d.id==="grid"?3:d.id==="dca"?4:d.id==="gold"?5:6}" style="width:44px;height:44px;border-radius:14px;display:grid;place-items:center">${ic("bot",22)}</span>
            <div class="grow"><div class="title" style="font-size:16px">${esc(d.name)}</div><div class="label">${esc(M.label(p))} · Risk ${d.risk} · Est. APY ${d.apy}</div></div>
            <span class="pill-s ${b?.running?"run":"stop"}">${b?.running?"Running":"Idle"}</span></div>
          <p class="sub">${esc(d.desc)}</p>
          ${b?.running ? `<div class="spark" data-sp></div>
            <div class="stats-mini"><div><span class="label">Invested</span><b>${money(b.invest)}</b></div><div><span class="label">PnL</span><b data-pnl>--</b></div><div><span class="label">Runtime</span><b data-rt>--</b></div></div>
            <button class="btn btn-down btn-block" data-stop>${ic("stop",16)} Stop & withdraw</button>`
          : `<div class="row"><div class="field grow" style="height:44px">${UI.usdt(18)}<input type="number" inputmode="decimal" min="10" value="100" data-inv aria-label="Investment amount"></div><button class="btn btn-primary" data-start>${ic("play",16)} Start</button></div>
            ${b && !b.running ? `<div class="label">Last run: <b class="${b.pnl>=0?"up":"down"}">${signed(b.pnl)} USDT</b></div>` : ""}`}
        </section>`; }).join("");
      }
      E.BOTS.forEach(d => { const b = S().bots[d.id]; if (!b?.running) return; const c = r.querySelector(`[data-bot="${d.id}"]`); if (!c) return;
        const v = E.botPnl(d.id); const el = c.querySelector("[data-pnl]"); el.textContent = signed(v); el.className = v >= 0 ? "up" : "down";
        const m = Math.floor((Date.now() - b.since)/60000); c.querySelector("[data-rt]").textContent = m >= 60 ? Math.floor(m/60) + "h " + (m%60) + "m" : m + "m";
        c.querySelector("[data-sp]").innerHTML = spark(b.series.concat(v), 300, 56); });
      bp.className = "mono " + (tot >= 0 ? "" : "");
    };
    render(true);
    r.querySelector("#bl").addEventListener("click", async e => {
      const c = e.target.closest("[data-bot]"); if (!c) return; const id = c.dataset.bot;
      if (e.target.closest("[data-start]")){ const err = E.startBot(id, parseFloat(c.querySelector("[data-inv]").value)); if (err) return toast(err, "bad"); toast("Bot started successfully!", "ok"); render(true); }
      if (e.target.closest("[data-stop]") && await U.confirmBox("Stop bot?", "Your investment plus PnL will be returned to your demo balance.", "Stop bot", true)){ const pnl = E.stopBot(id); toast(`Bot stopped: ${signed(pnl)} USDT`, pnl >= 0 ? "ok" : "warn"); render(true); }
    });
    const iv = setInterval(() => render(false), 2000);
    const off = bus.on("bots", () => render(false));
    this.unmount = () => { clearInterval(iv); off(); };
  }};
};

/* ---------- Auto trading ---------- */
Pages.auto = () => {
  const a = S().auto;
  const tradables = [...M.pairs.values()].filter(p => p.tradable);
  const html = wrap("Activate Auto Trading", `<div class="two-col"><div class="stack">
    <div class="hero"><div class="row between"><div><div class="label">Status</div><div class="h1" id="as" style="color:#fff"></div></div><span style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center">${ic("auto",24)}</span></div>
      <div class="row" style="gap:16px;margin-top:12px"><div><div class="label">Trades placed</div><b class="mono" id="ac">0</b></div><div><div class="label">Auto PnL</div><b class="mono" id="ap">0.00</b></div><div><div class="label">Win rate</div><b class="mono" id="aw">0%</b></div></div></div>
    <section class="card"><form id="af" novalidate>
      <div class="form-row"><label for="ap2">Pair</label><div class="field"><select id="ap2">${tradables.map(p => `<option value="${p.sym}" ${p.sym===a.pair?"selected":""}>${esc(M.label(p))}</option>`).join("")}</select></div></div>
      <div class="form-row"><label for="aa">Amount per trade (USDT)</label><div class="field" id="aaf">${UI.usdt(20)}<input id="aa" type="number" min="1" inputmode="decimal" value="${a.amount}"></div></div>
      <div class="form-row"><label>Expiry</label><div class="seg" data-g="expiry">${C.EXPIRIES.map(x => `<button type="button" data-v="${x}" class="${a.expiry===x?"on":""}">${x<60?x+"s":x/60+"m"}</button>`).join("")}</div></div>
      <div class="form-row"><label>Strategy</label><div class="seg" data-g="strategy">${[["trend","Trend follow"],["reversal","Reversal"],["random","Random"]].map(([k,n]) => `<button type="button" data-v="${k}" class="${a.strategy===k?"on":""}">${n}</button>`).join("")}</div></div>
      <div class="form-row"><label>Trade every</label><div class="seg" data-g="interval">${[10,20,30,60].map(x => `<button type="button" data-v="${x}" class="${a.interval===x?"on":""}">${x}s</button>`).join("")}</div></div>
      <div class="form-row"><label for="amx">Stop after (trades)</label><div class="field"><input id="amx" type="number" min="1" max="500" value="${a.max}"></div></div>
      <div class="err-msg" id="ae"></div>
      <button class="btn btn-block" id="ab" type="submit"></button>
    </form></section></div>
    <section class="card"><div class="row between"><div class="title">Activity log</div><a href="#/trade/${a.pair}" class="label" style="color:var(--accent)">Open chart →</a></div><div id="al"></div></section></div>`);
  return {html, title:"Auto Trading", mount(r){
    const $ = q => r.querySelector(q); const sel = {expiry:a.expiry, strategy:a.strategy, interval:a.interval};
    r.querySelectorAll("[data-g]").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => { sel[g.dataset.g] = isNaN(b.dataset.v) ? b.dataset.v : +b.dataset.v; g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x===b)); }));
    const render = () => {
      const on = S().auto.on, h = S().history.filter(x => x.source === "auto"), w = h.filter(x => x.result === "win").length;
      $("#as").textContent = on ? "● Running" : "Stopped";
      $("#ac").textContent = S().auto.count; const pnl = h.reduce((s,x) => s + x.profit, 0); $("#ap").textContent = signed(pnl);
      $("#aw").textContent = (h.length ? Math.round(w/h.length*100) : 0) + "%";
      const b = $("#ab"); b.className = "btn btn-block " + (on ? "btn-down" : "btn-primary"); b.innerHTML = on ? ic("stop",16) + " Stop auto trading" : ic("play",16) + " Start auto trading";
      r.querySelectorAll("#af input, #af select, #af [data-g] button").forEach(x => x.disabled = on);
      $("#al").innerHTML = S().auto.log.length ? S().auto.log.map(l => `<div class="list-item" style="padding:10px 0"><span class="label mono" style="width:64px;flex-shrink:0">${U.timeStr(l.t)}</span><span class="sub grow" style="font-size:13px">${esc(l.msg)}</span></div>`).join("") : UI.emptyState("auto", "No activity yet. Configure and start auto trading.");
    };
    render();
    $("#af").onsubmit = e => {
      e.preventDefault();
      if (S().auto.on){ E.stopAuto(); toast("Auto trading stopped", "warn"); return render(); }
      const amount = parseFloat($("#aa").value), max = parseInt($("#amx").value), pair = $("#ap2").value;
      const err = !(amount >= 1) ? "Minimum amount is 1 USDT." : amount > S().balance ? "Amount exceeds your balance." : !(max >= 1 && max <= 500) ? "Stop after must be between 1 and 500." : M.get(pair).closed ? "Market closed for this pair. Choose a crypto pair." : M.isStale(M.get(pair)) ? "Market data offline for this pair. Try again shortly." : "";
      $("#ae").textContent = err; $("#aaf").classList.toggle("err", !!err);
      if (err) return toast(err, "bad");
      E.startAuto({pair, amount, max, ...sel}); toast("Auto trading activated!", "ok"); render();
    };
    const offs = [bus.on("auto", render), bus.on("history", render)];
    this.unmount = () => offs.forEach(f => f());
  }};
};

/* ---------- VIP signals ---------- */
Pages.vip = () => {
  let filt = "all";
  const html = wrap("Get VIP Signals", `<div class="hero" style="margin-bottom:16px"><div class="row" style="gap:12px"><span style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.2);display:grid;place-items:center">${ic("crown",26)}</span>
      <div class="grow"><div class="title" style="color:#fff">VIP Signals · Unlocked</div><div class="sub">Generated every 5s from live tick momentum. Free in demo mode.</div></div></div></div>
    <div class="seg" style="margin-bottom:16px" id="vf">${[["all","All"],["crypto","Crypto"],["forex","Forex"],["metal","Metals"]].map(([k,n]) => `<button data-f="${k}" class="${k==="all"?"on":""}">${n}</button>`).join("")}</div>
    <section class="card"><div id="vl"></div></section>
    <p class="label" style="margin-top:12px;text-align:center">Signals are educational and not financial advice.</p>`);
  return {html, title:"VIP Signals", mount(r){
    const render = () => {
      const list = [...M.pairs.values()].filter(p => p.tradable && (filt === "all" || p.type === filt));
      r.querySelector("#vl").innerHTML = list.map(p => {
        const m = M.momentum(p.sym, 90000), chg = p.chg || 0;
        const score = U.clamp(m*0.7 + U.clamp(chg/5, -1, 1)*0.3, -1, 1);
        const dir = score >= 0 ? "up" : "down", conf = Math.round(55 + Math.abs(score)*40);
        const expTxt = Math.abs(score) > .5 ? "30s" : Math.abs(score) > .25 ? "1m" : "5m";
        return `<div class="sig"><div class="row" style="gap:10px;min-width:0">${UI.pairIcon(p,34)}<div class="grow"><div class="row" style="gap:6px"><b>${esc(M.label(p))}</b>
          ${p.closed ? `<span class="tag t-closed">Closed</span>` : `<span class="ls ${dir==="up"?"long":"short"}">${dir==="up"?"▲ UP":"▼ DOWN"}</span>`}</div>
          <div class="label">${M.fmtPx(p)} · Expiry ${expTxt} · Confidence ${conf}%</div><div class="conf"><i style="width:${conf}%"></i></div></div></div>
          <a class="btn btn-sm ${p.closed?"btn-ghost":dir==="up"?"btn-up":"btn-down"}" href="#/trade/${p.sym}">${p.closed?"View":"Trade"}</a></div>`;
      }).join("") || UI.emptyState("crown", "No signals.");
    };
    render();
    r.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filt = b.dataset.f; r.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x===b)); render(); });
    const iv = setInterval(render, 5000); this.unmount = () => clearInterval(iv);
  }};
};

/* ---------- Referral ---------- */
Pages.referral = () => {
  const p = S().profile, link = location.origin + location.pathname + "#/home?ref=" + p.ref;
  const html = wrap("Refer and Earn", `<div class="two-col"><div class="stack">
    <div class="hero"><div class="title" style="color:#fff">Invite friends, earn 20% commission</div><div class="sub" style="margin-top:4px">Share your link. Friends get a 100 USDT demo bonus.</div>
      <div class="label" style="margin-top:16px">Your referral code</div><div class="copy-box"><code style="font-size:18px;font-weight:800;letter-spacing:.1em">${esc(p.ref)}</code><button class="btn btn-sm" data-cc>${ic("copy",14)} Copy</button></div>
      <div class="label" style="margin-top:12px">Invite link</div><div class="copy-box"><code>${esc(link)}</code><button class="btn btn-sm" data-cl>${ic("copy",14)} Copy</button></div>
      <button class="btn btn-block" data-share style="background:rgba(255,255,255,.2);color:#fff;margin-top:12px">${ic("share",16)} Share invite</button></div>
    <div class="kpis">${kpi("Friends invited","0")}${kpi("Commission rate","20%")}${kpi("Rewards earned","0.00 USDT")}${kpi("Your tier","Bronze")}</div></div>
    <div class="stack"><section class="card"><div class="title" style="margin-bottom:8px">How it works</div>
      ${[["share","Share your link","Send your invite link or code to friends."],["user","Friend signs up","They open the demo app with your code."],["gift","Earn rewards","Get 20% of their demo trading fees."]].map(([i,a,b],k) => `<div class="list-item"><span class="ic p${k+1}">${ic(i,18)}</span><div><b style="font-size:14px">${a}</b><div class="sub" style="font-size:13px">${b}</div></div></div>`).join("")}</section>
    <section class="card"><div class="title" style="margin-bottom:8px">Reward tiers</div><table class="tbl"><thead><tr><th>Tier</th><th>Friends</th><th>Commission</th></tr></thead><tbody>
      <tr><td>🥉 Bronze</td><td>0–4</td><td>20%</td></tr><tr><td>🥈 Silver</td><td>5–19</td><td>25%</td></tr><tr><td>🥇 Gold</td><td>20–49</td><td>30%</td></tr><tr><td>💎 Diamond</td><td>50+</td><td>40%</td></tr></tbody></table></section>
    <section class="card">${faq([["Is this real money?","No. Everything in this app uses demo USDT for learning only."],["When are rewards paid?","Demo commissions are credited instantly when a referred friend trades."],["Is there a limit?","No limit on the number of friends you can invite."]])}</section></div></div>`);
  return {html, title:"Referral", mount(r){
    r.querySelector("[data-cc]").onclick = () => U.copyText(p.ref, "Referral code copied");
    r.querySelector("[data-cl]").onclick = () => U.copyText(link, "Invite link copied");
    r.querySelector("[data-share]").onclick = () => navigator.share ? navigator.share({title:C.APP_NAME + " Demo", text:"Practice binary trading with 10,000 demo USDT. Use my code " + p.ref, url:link}).catch(() => {}) : U.copyText(link, "Invite link copied — paste it anywhere");
  }};
};

/* ---------- Profile ---------- */
Pages.profile = () => {
  const html = wrap("Profile", `<div class="two-col"><div class="stack">
    <section class="card"><div class="row" style="gap:12px"><span class="avatar" style="width:56px;height:56px;font-size:22px" id="pa"></span>
      <div class="grow"><div class="row" style="gap:6px"><b class="title ellipsis" id="pn"></b><button class="eye" data-edit aria-label="Edit name">${ic("edit",16)}</button></div>
      <button class="label row" data-uid style="gap:4px">UID <span id="pu"></span> ${ic("copy",12)}</button><span class="tag t-bin" style="margin-top:4px">VIP 1 · Demo</span></div></div></section>
    <div class="hero"><div class="label">Demo balance</div><div class="bal mono" id="pb"></div><div class="spark" id="pbs" style="margin-top:8px"></div></div>
    <div class="kpis" id="pk"></div></div>
    <section class="card">
      ${[["deposit","Deposit","#/deposit","p1"],["withdraw","Withdraw","#/withdraw","p2"],["wallet","Transactions","tx","p3"],["history","Trade history","th","p4"],["gear","Settings","#/settings","p8"],["headset","Contact Support","#/support","p6"],["info","About Us","#/about","p7"]].map(([i,n,h,c]) => { const inner = `<span class="ic ${c}">${ic(i,18)}</span><span class="grow" style="font-weight:600;text-align:left">${n}</span><span class="chev">${ic("chev",18)}</span>`; return h.startsWith("#") ? `<a class="list-item" href="${h}">${inner}</a>` : `<button class="list-item" style="width:100%" data-act="${h}">${inner}</button>`; }).join("")}
      <div class="list-item"><span class="ic p5">${ic("moon",18)}</span><span class="grow" style="font-weight:600">Dark mode</span>${sw(S().settings.theme==="dark","theme")}</div>
      <button class="list-item" style="width:100%" data-reset><span class="ic p7">${ic("reset",18)}</span><span class="grow" style="font-weight:600;text-align:left">Reset demo balance</span><span class="label">10,000 USDT</span></button>
    </section></div>`);
  return {html, title:"Profile", mount(r){
    const $ = q => r.querySelector(q);
    const render = () => {
      const p = S().profile, st = E.stats();
      $("#pa").textContent = p.name[0]; $("#pn").textContent = p.name; $("#pu").textContent = p.uid;
      $("#pb").textContent = money(S().balance) + " USDT";
      $("#pbs").innerHTML = spark([C.START_BALANCE, ...S().balHist.map(x => x.b)].slice(-120), 300, 56, "#fff");
      $("#pk").innerHTML = kpi("Total trades", st.trades) + kpi("Win rate", st.winRate.toFixed(1) + "%") + kpi("Net PnL", signed(st.net), st.net >= 0 ? "up" : "down") + kpi("Best win", "+" + money(st.best), "up") + kpi("Volume", money(st.vol)) + kpi("Wins / Losses", st.wins + " / " + st.losses) + kpi("Win streak", st.streak) + kpi("Open positions", S().positions.length);
    };
    render();
    $("[data-uid]").onclick = () => U.copyText(S().profile.uid, "UID copied");
    $("[data-edit]").onclick = () => U.sheet("Edit nickname", `<div class="field"><input id="nn" maxlength="20" value="${esc(S().profile.name)}"></div><div class="err-msg" id="nne"></div><button class="btn btn-primary btn-block" data-sv style="margin-top:8px">Save</button>`, el => {
      el.querySelector("[data-sv]").onclick = () => { const v = el.querySelector("#nn").value.trim(); if (v.length < 2){ el.querySelector("#nne").textContent = "Nickname must be at least 2 characters."; return; } S().profile.name = v; store.save(); U.closeLayer(); render(); toast("Nickname updated", "ok"); };
    });
    r.querySelectorAll("[data-act]").forEach(a => { const k = a.dataset.act; if (k === "tx") a.onclick = () => { U.sheet("Transactions", txList()); };
      if (k === "th") a.onclick = () => { const h = S().history.slice(0, 100); U.sheet("Trade history", h.length ? h.map(x => { const p = M.get(x.sym); return `<div class="list-item">${UI.pairIcon(p,30)}<div class="grow"><b style="font-size:14px">${esc(p?M.label(p):x.sym)} · ${x.dir==="up"?"Up":"Down"}</b><div class="label">${U.dateStr(x.closed)} · ${money(x.amount)} USDT</div></div><b class="mono ${x.profit>0?"up":x.profit<0?"down":""}">${signed(x.profit)}</b></div>`; }).join("") : UI.emptyState("history","No trades yet.")); }; });
    $("[data-sw=theme]").onclick = e => { App.setTheme(S().settings.theme === "dark" ? "light" : "dark"); e.currentTarget.classList.toggle("on", S().settings.theme === "dark"); };
    $("[data-reset]").onclick = async () => { if (await U.confirmBox("Reset demo account?", "Balance returns to 10,000 USDT. Open positions, history and bots are cleared.", "Reset", true)){ E.stopAuto("Account reset."); store.reset(); render(); toast("Demo balance reset to 10,000 USDT", "ok"); } };
    const offs = [bus.on("balance", render), bus.on("history", render)]; this.unmount = () => offs.forEach(f => f());
  }};
};

/* ---------- Settings ---------- */
Pages.settings = () => {
  const st = S().settings;
  const row = (i, c, n, right, sub="") => `<div class="list-item"><span class="ic ${c}">${ic(i,18)}</span><div class="grow"><div style="font-weight:600">${n}</div>${sub?`<div class="label">${sub}</div>`:""}</div>${right}</div>`;
  const html = wrap("Settings", `<div class="two-col"><section class="card">
    <div class="title" style="margin-bottom:4px">Appearance</div>
    ${row("sun","p5","Theme",`<div class="seg" style="width:150px"><button data-th="light" class="${st.theme==="light"?"on":""}">Light</button><button data-th="dark" class="${st.theme==="dark"?"on":""}">Dark</button></div>`)}
    ${row("globe","p1","Language",`<button class="btn btn-ghost btn-sm" data-lang>${st.lang==="hi"?"हिन्दी":"English"} ${ic("chev",14)}</button>`)}
    <div class="title" style="margin:16px 0 4px">Trading</div>
    ${row("volume","p3","Sounds",sw(st.sound,"sound"),"Win / loss sound effects")}
    ${row("vibrate","p4","Vibration",sw(st.haptic,"haptic"),"Haptic feedback on supported phones")}
    ${row("wallet","p6","Default amount",`<div class="field" style="width:110px;height:40px"><input type="number" min="1" id="sda" value="${st.defAmt}" aria-label="Default amount"></div>`,"USDT per trade")}
    ${row("clock","p2","Default expiry",`<div class="seg" style="width:150px">${C.EXPIRIES.map(x => `<button data-de="${x}" class="${st.defExp===x?"on":""}">${x<60?x+"s":x/60+"m"}</button>`).join("")}</div>`)}
  </section>
  <section class="card"><div class="title" style="margin-bottom:4px">Account & data</div>
    ${row("eye","p8","Hide balance",sw(st.hideBal,"hideBal"),"Mask balances on Home")}
    ${row("shield","p3","Data storage","<span class='label'>This device</span>","Saved in your browser (localStorage)")}
    <button class="list-item" style="width:100%" data-wipe><span class="ic p7">${ic("trash",18)}</span><span class="grow down" style="font-weight:600;text-align:left">Clear all app data</span></button>
    <div class="label" style="margin-top:12px">Version 2.0 · ${esc(C.APP_NAME)} Demo</div>
  </section></div>`);
  return {html, title:"Settings", mount(r){
    r.querySelectorAll("[data-th]").forEach(b => b.onclick = () => { App.setTheme(b.dataset.th); r.querySelectorAll("[data-th]").forEach(x => x.classList.toggle("on", x===b)); toast("Theme updated", "ok"); });
    r.querySelector("[data-lang]").onclick = UI.openLang;
    r.querySelectorAll("[data-sw]").forEach(b => b.onclick = () => { const k = b.dataset.sw; st[k] = !st[k]; b.classList.toggle("on", st[k]); b.setAttribute("aria-checked", st[k]); store.save(); toast("Saved", "ok", 1200); });
    r.querySelector("#sda").onchange = e => { const v = parseFloat(e.target.value); if (!(v >= 1)){ toast("Default amount must be at least 1 USDT", "bad"); e.target.value = st.defAmt; return; } st.defAmt = v; store.save(); toast("Default amount saved", "ok"); };
    r.querySelectorAll("[data-de]").forEach(b => b.onclick = () => { st.defExp = +b.dataset.de; store.save(); r.querySelectorAll("[data-de]").forEach(x => x.classList.toggle("on", x===b)); toast("Default expiry saved", "ok", 1200); });
    r.querySelector("[data-wipe]").onclick = async () => { if (await U.confirmBox("Clear all data?", "This deletes balance, history, bots and settings from this device.", "Delete everything", true)) store.wipe(); };
    this.unmount = bus.on("lang", () => App.route());
  }};
};

/* ---------- About ---------- */
Pages.about = () => wrap0("About Us", `<div class="hero" style="margin-bottom:16px"><div class="brand" style="color:#fff;font-size:20px"><img src="favicon.svg" alt="" width="36" height="36"> ${esc(C.APP_NAME)}</div>
    <p class="sub" style="margin-top:8px">A free, mobile-first trading simulator. Learn how binary Up/Down trades, charts and risk work using live market prices and demo money.</p></div>
  <div class="kpis" style="margin-bottom:16px">${kpi("Markets","120+")}${kpi("Tradable pairs","20")}${kpi("Demo balance","10,000")}${kpi("Real money","0")}</div>
  <div class="two-col"><section class="card"><div class="title" style="margin-bottom:8px">What you can do</div>
    ${[["chart","Live charts","Tick line & candles from 5s to 4h on real Binance and biquote.io data."],["zap","Binary trades","Predict Up or Down over 30s, 1m or 5m and earn +92% on a win."],["bot","Bots & auto trading","Run simulated strategy bots and an automatic trade engine."],["crown","VIP signals","Momentum-based signals for every tradable pair."],["shield","Zero risk","Everything uses demo USDT stored only in your browser."]].map(([i,a,b],k) => `<div class="list-item"><span class="ic p${k+1}">${ic(i,18)}</span><div><b style="font-size:14px">${a}</b><div class="sub" style="font-size:13px">${b}</div></div></div>`).join("")}</section>
  <section class="card"><div class="title" style="margin-bottom:4px">FAQ</div>${faq([["Is this real trading?","No. This is a demo app for learning only. No real money is deposited, traded or withdrawn."],["Where do prices come from?","Crypto prices stream from Binance public market data. Forex, gold and silver stream from biquote.io."],["Why is a forex pair closed?","Forex and metals markets close on weekends. Those pairs show “Market closed” until they reopen."],["How is a trade settled?","At expiry the live price is compared with your entry. Up wins if the price is higher, Down wins if it is lower. Equal price is a refund."],["Can I reset my balance?","Yes — Profile → Reset demo balance restores 10,000 USDT."]])}</section></div>
  <p class="notice" style="margin-top:16px">${ic("info",16)}<span>Trading involves risk. Binary options can lose 100% of the stake. This app is educational and is not financial advice.</span></p>`);
function wrap0(title, body){ return () => ({html: wrap(title, body), title}); }

/* ---------- Support ---------- */
Pages.support = () => {
  const tel = C.SUPPORT_PHONE.replace(/\s/g, "");
  const html = wrap("Contact Support", `<div class="two-col"><div class="stack">
    <div class="kpis" style="grid-template-columns:1fr 1fr">
      <a class="kpi" href="tel:${tel}"><span class="ic p3" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;margin-bottom:8px">${ic("phone",18)}</span><span class="label">Call us</span><b style="font-size:14px">${esc(C.SUPPORT_PHONE)}</b></a>
      <a class="kpi" href="mailto:${C.SUPPORT_EMAIL}?subject=${encodeURIComponent(C.APP_NAME + " support")}"><span class="ic p1" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;margin-bottom:8px">${ic("mail",18)}</span><span class="label">Email us</span><b style="font-size:13px;word-break:break-all;white-space:normal">${esc(C.SUPPORT_EMAIL)}</b></a>
    </div>
    <div class="card row"><span class="ic p5" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center">${ic("clock",18)}</span><div><b style="font-size:14px">Support hours</b><div class="sub" style="font-size:13px">24/7 · Average reply under 2 hours</div></div></div>
    <section class="card"><div class="title" style="margin-bottom:12px">Send a ticket</div><form id="tf" novalidate>
      <div class="form-row"><label for="ts">Topic</label><div class="field"><select id="ts"><option value="">Choose a topic</option><option>Trading</option><option>Deposit / Withdraw</option><option>Bots & Auto trading</option><option>Account</option><option>Other</option></select></div></div>
      <div class="form-row"><label for="te">Your email</label><div class="field"><input id="te" type="email" autocomplete="email" placeholder="name@example.com" style="font-size:15px;font-weight:500"></div></div>
      <div class="form-row"><label for="tm">Message</label><textarea id="tm" rows="4" class="field" style="width:100%;height:auto;padding:12px;resize:vertical;border:1.5px solid transparent;outline:0" placeholder="Describe your issue (min. 10 characters)"></textarea></div>
      <div class="err-msg" id="tee"></div>
      <button class="btn btn-primary btn-block" type="submit">${ic("send",16)} Submit ticket</button></form></section></div>
    <div class="stack"><section class="card"><div class="title" style="margin-bottom:4px">Your tickets</div><div id="tl"></div></section>
    <section class="card"><div class="title" style="margin-bottom:4px">Quick help</div>${faq([["My trade shows Market closed","Forex and metals close on weekends. Trade top 10 crypto pairs 24/7."],["Up/Down buttons are disabled","That pair is Chart only or the market is closed. Pick a tradable pair."],["I ran out of balance","Use Deposit for a free demo top-up, or reset in Profile."],["Prices stopped updating","The app reconnects automatically. Check your internet connection."]])}</section></div></div>`);
  return {html, title:"Contact Support", mount(r){
    const $ = q => r.querySelector(q);
    const render = () => { $("#tl").innerHTML = S().tickets.length ? S().tickets.map(x => `<div class="list-item"><span class="ic p1">${ic("file",18)}</span><div class="grow"><b style="font-size:14px">#${x.id.slice(0,6).toUpperCase()} · ${esc(x.topic)}</b><div class="sub ellipsis" style="font-size:13px">${esc(x.msg)}</div><div class="label">${U.dateStr(x.t)}</div></div><span class="pill-s run">Received</span></div>`).join("") : UI.emptyState("headset","No tickets yet."); };
    render();
    $("#tf").onsubmit = async e => {
      e.preventDefault();
      const topic = $("#ts").value, em = $("#te").value.trim(), msg = $("#tm").value.trim();
      const err = !topic ? "Please choose a topic." : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em) ? "Please enter a valid email address." : msg.length < 10 ? "Message must be at least 10 characters." : "";
      $("#tee").textContent = err; if (err) return toast(err, "bad");
      await processing(e.submitter || $("[type=submit]"), 800);
      S().tickets.unshift({id:U.uid(), topic, em, msg, t:Date.now()}); store.save();
      $("#tf").reset(); render(); toast("Ticket submitted! We'll reply by email.", "ok");
    };
  }};
};

/* ---------- Community ---------- */
Pages.community = () => {
  const CH = [["announce","📣 Announcements","Product news & updates","12.4k"],["crypto","₿ Crypto traders","BTC, ETH, SOL setups","48.1k"],["forex","💱 Forex desk","Majors & sessions","21.7k"],["strategy","🧠 Strategy lab","Share and test ideas","9.8k"]];
  const SEED = {
    announce:[["NovaTrade Team","New: 4h candles and VIP signals for gold & silver are live."],["NovaTrade Team","Tip: use the Tick chart for 30s trades and 1m candles for 5m trades."]],
    crypto:[["Arjun","BTC holding the range — waiting for a breakout before going Up."],["Mia","SOL momentum looks strong on 15s candles 🚀"],["Leo","Don't over-trade. 2% of balance per trade max."]],
    forex:[["Sara","EUR/USD quiet in the Asian session, better moves at London open."],["Kenji","USD/JPY respecting the high of the day."]],
    strategy:[["Priya","Trend follow on 1m + 5m expiry has been my best combo in demo."],["Omar","Testing reversal strategy in Auto Trading with 5 USDT size."]]
  };
  const LEAD = [["CryptoQueen",18420],["PipHunter",12960],["Satoshi_Jr",9875],["GoldBug",7340],["TrendRider",6210]];
  const html = wrap("Join Community", `<div class="hero" style="margin-bottom:16px"><div class="row between"><div><div class="title" style="color:#fff">${esc(C.APP_NAME)} Community</div><div class="sub">92,000+ demo traders learning together</div></div><span style="font-size:36px">👥</span></div>
      <button class="btn btn-block" data-join style="background:#fff;color:var(--accent);margin-top:12px"></button></div>
    <div class="two-col"><section class="card"><div class="title" style="margin-bottom:4px">Channels</div>
      ${CH.map(([k,n,d,m]) => `<button class="list-item" style="width:100%" data-ch="${k}"><span class="grow" style="text-align:left"><b style="font-size:15px">${n}</b><div class="label">${d} · ${m} members</div></span><span class="chev">${ic("chev",18)}</span></button>`).join("")}</section>
    <section class="card"><div class="title" style="margin-bottom:4px">🏆 Weekly leaderboard</div><div id="lb"></div></section></div>
    <section class="card" style="margin-top:16px"><div class="title" style="margin-bottom:4px">Community rules</div><div class="sub">Be respectful · No spam or promotions · No financial advice requests · Demo results only.</div></section>`);
  return {html, title:"Community", mount(r){
    const s = S(), $ = q => r.querySelector(q);
    const renderJoin = () => $("[data-join]").innerHTML = s.joined ? ic("check",16) + " Joined" : ic("users",16) + " Join community";
    renderJoin();
    $("[data-join]").onclick = () => { s.joined = !s.joined; store.save(); renderJoin(); toast(s.joined ? "Welcome to the community! 🎉" : "You left the community", s.joined ? "ok" : "info"); };
    const net = E.stats().net;
    const rows = [...LEAD, [s.profile.name + " (You)", Math.round(net)]].sort((a,b) => b[1]-a[1]);
    $("#lb").innerHTML = rows.map(([n,v],i) => `<div class="list-item" style="padding:10px 0"><b style="width:24px">${i<3?["🥇","🥈","🥉"][i]:i+1}</b><span class="grow ellipsis" style="font-weight:${n.includes("(You)")?800:500}">${esc(n)}</span><b class="mono ${v>=0?"up":"down"}">${signed(v,0)}</b></div>`).join("");
    r.querySelectorAll("[data-ch]").forEach(b => b.onclick = () => {
      const k = b.dataset.ch, name = CH.find(c => c[0]===k)[1];
      const msgs = () => [...SEED[k].map(([a,m]) => ({a, m, t:null})), ...s.posts.filter(p => p.ch === k)].map(x => `<div class="post"><span class="avatar" style="width:34px;height:34px;font-size:13px">${esc(x.a[0])}</span><div class="grow"><b style="font-size:14px">${esc(x.a)}</b> ${x.t?`<span class="label">${U.timeStr(x.t)}</span>`:""}<div class="sub" style="font-size:14px">${esc(x.m)}</div></div></div>`).join("");
      U.sheet(name, `<div id="cm">${msgs()}</div><form class="row" id="cf" style="margin-top:12px;position:sticky;bottom:0;background:var(--card);padding-top:8px"><div class="field grow"><input id="ci" maxlength="200" placeholder="Write a message…" style="font-size:15px;font-weight:500" aria-label="Message"></div><button class="btn btn-primary" style="height:48px" aria-label="Send">${ic("send",18)}</button></form>`, el => {
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
