/* ===== Assets (overview), Deposit flow, Copy Trading ===== */
(function(){
const C = window.CONFIG, {esc, ic, store, bus, money, signed, toast, spark, fmt, pct} = U;
const S = () => store.s;

/* ---------- Assets ---------- */
Pages.assets = (params) => {
  let tab = params[0] || "overview";
  const html = `<div class="as-tabs">${[["overview","Overview"],["futures","Futures"],["earn","Earn"],["binary","Binary"]].map(([k,n]) => `<button data-at="${k}" class="${tab===k?"on":""}">${n}</button>`).join("")}</div><div id="ab"></div>`;
  function totals(){
    const s = S(), bin = s.positions.reduce((a,p) => a + p.amount, 0), fm = s.fut.positions.reduce((a,p) => a + p.margin, 0) + s.fut.orders.reduce((a,o) => a + o.margin + o.fee, 0);
    const up = s.fut.positions.reduce((a,p) => a + E.futPnl(p).pnl, 0), vault = E.vaultValue();
    const d0 = new Date().setHours(0,0,0,0), tp = E.stats().todayPnl + s.fut.history.filter(x => x.closed >= d0).reduce((a,x) => a + x.profit, 0) + up;
    return {spot:s.balance, bin, fm, up, fut: fm + up, vault, total: s.balance + bin + fm + up + vault, tp};
  }
  function calendar(){
    const now = new Date(), y = now.getFullYear(), m = now.getMonth(), first = new Date(y, m, 1), days = new Date(y, m+1, 0).getDate(), off = (first.getDay() + 6) % 7;
    const all = [...S().history.map(x => ({t:x.closed, p:x.profit})), ...S().fut.history.map(x => ({t:x.closed, p:x.profit}))];
    const byDay = {}; all.forEach(x => { const d = new Date(x.t); if (d.getMonth() === m && d.getFullYear() === y){ byDay[d.getDate()] = (byDay[d.getDate()] || 0) + x.p; } });
    const mx = Math.max(1, ...Object.values(byDay).map(Math.abs)), tot = Object.values(byDay).reduce((a,b) => a + b, 0);
    let cells = ["M","T","W","T","F","S","S"].map(d => `<div class="dw">${d}</div>`).join("") + Array(off).fill("<div></div>").join("");
    for (let d = 1; d <= days; d++){ const v = byDay[d], a = v == null ? 0 : .18 + Math.min(1, Math.abs(v)/mx) * .62;
      cells += `<div class="d ${d === now.getDate() ? "today" : ""}" style="${v == null ? "" : `background:${v >= 0 ? `rgba(46,189,133,${a})` : `rgba(246,70,93,${a})`};color:#fff`}">${d}${v != null ? `<small>${v >= 0 ? "+" : ""}${Math.abs(v) >= 1000 ? (v/1000).toFixed(1) + "K" : v.toFixed(0)}</small>` : ""}</div>`; }
    return `<div class="row between" style="margin-bottom:10px"><b>${now.toLocaleString([], {month:"long", year:"numeric"})} PNL</b><b class="num ${tot>=0?"up":"down"}">${signed(tot)} USDT</b></div><div class="cal2">${cells}</div>`;
  }
  function render(r){
    const s = S(), t = totals(), hide = s.settings.hideBal, H = v => hide ? "******" : v, box = r.querySelector("#ab");
    const head = (label, val, pnl) => `<div class="row" style="align-items:flex-start"><div class="grow"><div class="row label" style="font-size:14px;gap:6px">${label} <button class="eye" data-eye>${ic(hide?"eyeoff":"eye",16)}</button></div>
      <div style="font-size:32px;font-weight:600;margin:4px 0" class="num">${H("$" + money(val))} <span style="font-size:15px;font-weight:500">USD ▾</span></div>
      ${pnl != null ? `<div class="label" style="font-size:14px"><span style="text-decoration:underline dotted">Today's PNL</span> <span class="num ${pnl>=0?"up":"down"}">${H(signed(pnl) + " (" + signed(pnl / Math.max(1, t.total - pnl) * 100) + "%)")}</span></div>` : ""}</div>
      <div style="width:110px;height:56px">${spark([C.START_BALANCE, ...s.balHist.map(x => x.b)].slice(-80), 110, 56, "#F0B90B")}</div></div>`;
    if (tab === "overview"){
      const parts = [["Trading",t.spot,"#1E80FF"],["Futures",Math.max(0,t.fut),"#F0B90B"],["Binary",t.bin,"#2EBD85"],["Earn",t.vault,"#9B6BFF"]], sum = parts.reduce((a,p) => a + p[1], 0) || 1;
      box.innerHTML = head("Est. Total Value", t.total, t.tp) + `
        <div class="as-acts"><a href="#/deposit"><span>${ic("down",22,1.8)}</span>Add Funds</a><a href="#/withdraw"><span>${ic("up",22,1.8)}</span>Send</a><a href="#/withdraw"><span>${ic("swap",22,1.8)}</span>Transfer</a><a href="#/withdraw"><span>${ic("earn",22,1.8)}</span>Earn</a></div>
        <section class="card" style="margin-bottom:12px"><div class="row between"><span class="label" style="font-size:15px">Allocation</span></div><div class="alloc">${parts.filter(p => p[1] > 0).map(([n,v,c]) => `<i style="flex:${v/sum};background:${c}"></i>`).join("")}</div>
          <div class="legend-l" style="display:grid;grid-template-columns:1fr 1fr;margin-top:10px">${parts.map(([n,v,c]) => `<div><i style="background:${c}"></i>${n} <b class="num" style="margin-left:auto;padding-right:8px">${hide ? "**" : (v/sum*100).toFixed(1) + "%"}</b></div>`).join("")}</div></section>
        <section class="card" style="margin-bottom:12px"><div class="label" style="font-size:15px;margin-bottom:4px">Balance</div>
          <div class="coin-row"><div class="row">${UI.usdt(34)}<div class="grow"><b style="font-size:16px">USDT</b><div class="label">TetherUS</div></div><div style="text-align:right"><b class="num" style="font-size:16px;font-weight:500">${H(fmt(t.spot, 8))}</b><div class="label num">${H("$" + money(t.spot))}</div></div></div>
            <div class="row" style="justify-content:flex-end;margin-top:10px"><a class="btn btn-ghost btn-sm" style="width:90px" href="#/withdraw">Earn</a><a class="btn btn-ghost btn-sm" style="width:90px" href="#/futures">Trade</a></div></div>
          ${t.fut > 0 ? `<div class="coin-row"><div class="row"><span class="ic ic-y" style="width:34px;height:34px;border-radius:50%;background:var(--input);display:grid;place-items:center">${ic("nfut",18)}</span><div class="grow"><b style="font-size:16px">Futures (USDⓈ-M)</b><div class="label">Margin + unrealized PNL</div></div><div style="text-align:right"><b class="num" style="font-size:16px;font-weight:500">${H(money(t.fut))}</b><div class="label num ${t.up>=0?"up":"down"}">${H("Unrealized " + signed(t.up))}</div></div></div></div>` : ""}
          ${t.vault > 0 ? `<div class="coin-row"><div class="row"><span class="ic" style="width:34px;height:34px;border-radius:50%;background:var(--input);display:grid;place-items:center;color:#9B6BFF">${ic("vault",18)}</span><div class="grow"><b style="font-size:16px">Earn Vault</b><div class="label">${Math.round(E.APR*100)}% APR · accruing</div></div><div style="text-align:right"><b class="num" style="font-size:16px;font-weight:500">${H(fmt(t.vault, 4))}</b></div></div></div>` : ""}
        </section>
        <section class="card" style="margin-bottom:12px">${calendar()}</section>
        <section class="card"><div class="row between" style="margin-bottom:4px"><span class="label" style="font-size:15px">Transactions</span><a class="link" href="#/history">Trade history</a></div>${txList()}</section>`;
    } else if (tab === "futures"){
      const h = s.fut.history, net = h.reduce((a,x) => a + x.profit, 0), w = h.filter(x => x.profit > 0).length;
      box.innerHTML = head("Margin Balance", t.fut + t.spot, t.up) + `<div class="kpis" style="margin:16px 0"><div class="kpi"><span class="label">Wallet balance</span><b class="num">${H(money(t.spot + s.fut.positions.reduce((a,p) => a + p.margin, 0)))}</b></div><div class="kpi"><span class="label">Unrealized PNL</span><b class="num ${t.up>=0?"up":"down"}">${H(signed(t.up))}</b></div><div class="kpi"><span class="label">Realized PNL</span><b class="num ${net>=0?"up":"down"}">${signed(net)}</b></div><div class="kpi"><span class="label">Win rate</span><b class="num">${h.length ? (w/h.length*100).toFixed(1) : "0.0"}%</b></div></div>
        <a class="btn btn-primary btn-block" href="#/futures">Trade USDⓈ-M Futures</a><div class="sec-h"><span class="title">Position history</span><a href="#/history">All</a></div>${UI.historyHtml(h.slice(0, 5))}`;
    } else if (tab === "earn"){
      box.innerHTML = head("Earn Balance", t.vault, null) + `<section class="card" style="margin:16px 0"><div class="row"><span class="ic" style="width:40px;height:40px;border-radius:50%;background:var(--input);display:grid;place-items:center;color:#9B6BFF">${ic("vault",20)}</span><div class="grow"><b>USDT Flexible Vault</b><div class="label">Interest accrues every second · redeem anytime</div></div><b class="up">${Math.round(E.APR*100)}% APR</b></div><a class="btn btn-primary btn-block" href="#/withdraw" style="margin-top:14px">Subscribe / Redeem</a></section>`;
    } else {
      const st = E.stats();
      box.innerHTML = head("Binary Options", t.bin + st.net * 0, null) + `<div class="kpis" style="margin:16px 0"><div class="kpi"><span class="label">Open stake</span><b class="num">${money(t.bin)}</b></div><div class="kpi"><span class="label">Net PNL</span><b class="num ${st.net>=0?"up":"down"}">${signed(st.net)}</b></div><div class="kpi"><span class="label">Trades</span><b class="num">${st.trades}</b></div><div class="kpi"><span class="label">Win rate</span><b class="num">${st.winRate.toFixed(1)}%</b></div></div><a class="btn btn-primary btn-block" href="#/trade">Trade Binary Options</a>`;
    }
    box.querySelector("[data-eye]").onclick = () => { s.settings.hideBal = !s.settings.hideBal; store.save(); render(r); };
  }
  function txList(){
    const tx = S().tx.slice(0, 12);
    return tx.length ? tx.map(x => `<div class="list-item"><span class="ic" style="border-radius:50%;background:var(--input)">${ic(x.kind === "deposit" ? "down" : "swap",16)}</span><div class="grow"><b style="font-size:14px">${x.kind === "deposit" ? "Deposit" : "Transfer"} ${esc(x.coin || "USDT")}</b><div class="label">${U.dateStr(x.t)} · ${esc(x.method)}</div></div><div style="text-align:right"><b class="num ${x.kind==="deposit"?"up":""}">${x.kind==="deposit"?"+":""}${fmt(x.coinAmt ?? x.amount, x.coinAmt ? 6 : 2)}</b><div class="label up">Completed</div></div></div>`).join("") : UI.emptyState("file","No transactions yet.");
  }
  return {html, title:"Assets", mount(r){
    render(r);
    r.querySelectorAll("[data-at]").forEach(b => b.onclick = () => { tab = b.dataset.at; r.querySelectorAll("[data-at]").forEach(x => x.classList.toggle("on", x===b)); render(r); });
    const iv = setInterval(() => render(r), 4000), offs = [bus.on("balance", () => render(r))];
    this.unmount = () => { clearInterval(iv); offs.forEach(f => f()); };
  }};
};

/* ---------- Deposit flow (paper funds) ---------- */
const NETS = {
  USDT:[["BSC","BNB Smart Chain (BEP20)","bnb",0.01,1],["TRX","Tron (TRC20)","trx",0.01,1],["ETH","Ethereum (ERC20)","eth",0.001,2],["POL","Polygon POS","pol",0.02,1],["SOL","Solana","sol",0.001,1],["ARBITRUM","Arbitrum One","arb",0.01,1],["OPTIMISM","Optimism","op",0.01,1]],
  BTC:[["BTC","Bitcoin","btc",0.00006,10],["BSC","BNB Smart Chain (BEP20)","bnb",0.000001,1]],
  ETH:[["ETH","Ethereum (ERC20)","eth",0.000001,2],["ARBITRUM","Arbitrum One","arb",0.000001,1],["OPTIMISM","Optimism","op",0.000001,1],["BSC","BNB Smart Chain (BEP20)","bnb",0.000001,1]],
  BNB:[["BSC","BNB Smart Chain (BEP20)","bnb",0.00001,1]], SOL:[["SOL","Solana","sol",0.001,1]], TRX:[["TRX","Tron (TRC20)","trx",0.1,1]]
};
const netsFor = c => NETS[c] || [["BSC","BNB Smart Chain (BEP20)","bnb",0.01,1],[c,(window.COIN_NAMES[c] || c) + " Network",c.toLowerCase(),0.01,2]];
const coinIcon = (c, size=36) => { const k = c.toLowerCase(), ext = (window.LOCAL_ICONS || {})[k]; return ext ? `<img class="coin" src="assets/coins/${k}.${ext}" alt="" style="width:${size}px;height:${size}px">` : UI.letter(c, size); };
function paperAddr(coin, net){ let h = 0; const seed = S().profile.uid + coin + net; for (const ch of seed) h = (h * 131 + ch.charCodeAt(0)) >>> 0; let hex = ""; for (let i=0;i<8;i++){ h = (h * 1103515245 + 12345) >>> 0; hex += h.toString(16).padStart(8,"0"); } return "PAPER" + net.slice(0,3) + hex.slice(0, 33); }
Pages.deposit = (params) => {
  const coin = (params[0] || "").toUpperCase(), net = (params[1] || "").toUpperCase();
  if (!coin) return selectCoin();
  if (!net) return chooseNet(coin);
  return depositPage(coin, net);
};
function selectCoin(){
  const trending = ["BTC","ETH","USDT","BNB"];
  const html = `<header class="page-head"><button class="icon-btn" data-back aria-label="Back">${ic("back",22)}</button><h1 class="h1" style="text-align:center">Select Currency</h1><span style="width:34px"></span></header>
    <label class="search" style="height:44px;border-radius:10px;margin-bottom:16px"><span>${ic("search",18)}</span><input id="cq" placeholder="Search Coins" autocomplete="off"></label>
    <div id="cl"></div>`;
  return {html, title:"Deposit", mount(r){
    const all = () => { const set = new Set(["USDT", ...M.cryptoOrder.map(s => M.get(s)?.base).filter(Boolean)]); return [...set].sort((a,b) => a.localeCompare(b)); };
    const row = c => `<a class="list-item" style="border:0;padding:12px 0" href="#/deposit/${c}">${coinIcon(c)}<div class="grow"><b style="font-size:16px">${c}</b><div class="label" style="font-size:14px">${esc(c === "USDT" ? "TetherUS" : window.COIN_NAMES[c] || c)}</div></div></a>`;
    const render = q => {
      const box = r.querySelector("#cl"); q = (q || "").toUpperCase();
      if (q){ const l = all().filter(c => c.includes(q) || (window.COIN_NAMES[c] || "").toUpperCase().includes(q)); box.innerHTML = l.map(row).join("") || UI.emptyState("search","No coins found"); return; }
      const groups = {}; all().forEach(c => { const k = /[0-9]/.test(c[0]) ? "1" : c[0]; (groups[k] ||= []).push(c); });
      box.innerHTML = `<div class="title" style="margin-bottom:10px">Last Used</div><div class="card row" style="margin-bottom:20px">${coinIcon("USDT")}<div class="grow"><b style="font-size:16px">USDT</b><div class="label" style="font-size:14px">TetherUS</div></div><a class="btn btn-ghost btn-sm" href="#/deposit/USDT">Deposit</a></div>
        <div class="title" style="margin-bottom:4px">Trending</div>${trending.map(row).join("")}
        ${Object.keys(groups).map(k => `<div class="label" style="margin:16px 0 4px;font-size:14px" id="g-${k}">${k}</div>${groups[k].map(row).join("")}`).join("")}
        <div class="az">${Object.keys(groups).map(k => `<button data-az="${k}">${k}</button>`).join("")}</div>`;
      box.querySelectorAll("[data-az]").forEach(b => b.onclick = () => document.getElementById("g-" + b.dataset.az)?.scrollIntoView({behavior:"smooth"}));
    };
    render(); r.querySelector("#cq").addEventListener("input", e => render(e.target.value));
    this.unmount = bus.on("list", () => render(r.querySelector("#cq").value));
  }};
}
function chooseNet(coin){
  const html = `<header class="page-head"><button class="icon-btn" data-back aria-label="Back">${ic("back",22)}</button><h1 class="h1" style="text-align:center">Choose Network</h1><span style="width:34px"></span></header>
    <p class="label" style="font-size:13px;margin:6px 0 18px;line-height:1.6">Please note that only supported networks on ${esc(C.APP_NAME)} are shown. Deposits are credited to your paper-trading account.</p>
    ${netsFor(coin).map(([k,n,ico,min,eta], i) => `<a class="dep-card ${i===0?"on":""}" href="#/deposit/${coin}/${k}"><div class="row" style="gap:12px;align-items:flex-start">${coinIcon(ico.toUpperCase(), 34)}<div><div class="t">${k}<small>${esc(n)}</small></div><div class="m">Min. deposit &gt;${min} ${coin}</div><div class="m">Est. arrival ${eta} mins</div></div></div></a>`).join("")}`;
  return {html, title:"Choose Network"};
}
function depositPage(coin, net){
  const nd = netsFor(coin).find(x => x[0] === net) || netsFor(coin)[0], addr = paperAddr(coin, net);
  const html = `<header class="page-head"><button class="icon-btn" data-back aria-label="Back">${ic("back",22)}</button><h1 class="h1" style="text-align:center">Deposit ${esc(coin)}</h1><a class="icon-btn" href="#/assets" aria-label="History">${ic("clockh",22,1.6)}</a></header>
    <a class="card row" href="#/deposit/${coin}" style="margin:8px 0 12px;padding:18px"><div class="grow"><div class="label" style="font-size:14px">Network</div><div style="font-size:20px;font-weight:600;margin-top:4px">${nd[0]} <span style="font-size:15px;font-weight:400;color:var(--text-2)">${esc(nd[1])}</span></div><div class="label" style="font-size:13px;margin-top:4px">Paper trading network</div></div><span class="chev">${ic("chev",20)}</span></a>
    <section class="card" style="padding:22px 18px"><div id="qr"></div>
      <div class="label" style="font-size:14px;margin-bottom:6px">Deposit Address ›</div>
      <div class="row" style="align-items:center;gap:12px"><div class="addr grow num"><em>${addr.slice(0,8)}</em>${addr.slice(8,-6)}<em>${addr.slice(-6)}</em></div><button class="icon-btn boxed" style="width:52px;height:52px" data-copy aria-label="Copy address">${ic("copy",22)}</button></div></section>
    <div style="padding:8px 0">
      <div class="kvl"><span>Deposit to</span><b>Trading Account</b></div>
      <div class="kvl"><span>Minimum deposit</span><b>&gt;${nd[3]} ${esc(coin)}</b></div>
      <div class="kvl"><span style="text-decoration:underline dotted">Credited (Trading enabled)</span><b>1 Confirmation(s)</b></div>
      <div class="kvl"><span style="text-decoration:underline dotted">Unlocked (Withdrawal enabled)</span><b>1 Confirmation(s)</b></div>
      <p class="label" style="font-size:13px;line-height:1.7;margin-top:6px">• This is a paper-trading address. Use “Deposit” below to add funds instantly.<br>• Do not send real crypto to this address.</p>
    </div>
    <div id="pend"></div>
    <button class="btn btn-primary btn-block btn-lg" data-dep style="margin-top:12px">Deposit</button><div style="height:20px"></div>`;
  return {html, title:"Deposit " + coin, mount(r){
    const q = r.querySelector("#qr");
    try { const qr = window.qrcode(0, "M"); qr.addData("paper:" + addr); qr.make(); q.innerHTML = `<div class="qr" style="position:relative">${qr.createSvgTag({cellSize:5, margin:0, scalable:true})}<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:50%;padding:4px">${coinIcon(coin, 34)}</span></div>`; q.querySelector("svg").setAttribute("style","width:100%;height:100%"); } catch { q.innerHTML = ""; }
    r.querySelector("[data-copy]").onclick = () => U.copyText(addr, "Address copied");
    r.querySelector("[data-dep]").onclick = () => {
      const px = coin === "USDT" ? 1 : (M.get(coin + "USDT")?.price || 0);
      U.sheet("Deposit " + coin, `<div class="form-row"><label>Amount</label><div class="famt" id="dfa"><input id="dv" type="number" inputmode="decimal" value="${coin === "USDT" ? 1000 : +(1000/(px||1)).toFixed(6)}"><span>${esc(coin)}</span></div><div class="label" id="dvu"></div></div>
        <div class="chips" style="margin-bottom:14px">${[100,500,1000,5000,10000].map(v => `<button data-u="${v}">$${fmt(v,0)}</button>`).join("")}</div><div class="err-msg" id="de"></div>
        <button class="btn btn-primary btn-block btn-lg" data-ok>Confirm Deposit</button>`, el => {
        const upd = () => { const v = parseFloat(el.querySelector("#dv").value) || 0; el.querySelector("#dvu").textContent = `≈ ${money(v * px)} USDT will be credited`; };
        upd(); el.querySelector("#dv").oninput = upd;
        el.querySelectorAll("[data-u]").forEach(b => b.onclick = () => { el.querySelector("#dv").value = coin === "USDT" ? b.dataset.u : +(b.dataset.u / (px||1)).toFixed(6); upd(); });
        el.querySelector("[data-ok]").onclick = () => {
          const v = parseFloat(el.querySelector("#dv").value), usd = v * px;
          const e = !(v > 0) ? "Please enter the amount." : v < nd[3] ? `Minimum deposit is ${nd[3]} ${coin}.` : !px ? "Price unavailable. Try again shortly." : usd > 1000000 ? "Maximum 1,000,000 USDT per deposit." : "";
          if (e){ el.querySelector("#de").textContent = e; return; }
          U.closeLayer();
          const box = r.querySelector("#pend"), id = U.uid();
          box.innerHTML = `<div class="card row" style="margin-top:8px"><span class="ic ic-y" style="border-radius:50%;background:var(--brand-soft)">${ic("clock",18)}</span><div class="grow"><b>Deposit pending</b><div class="label" id="pc">${fmt(v,6)} ${coin} · 0/1 confirmations</div></div><div class="spin"></div></div>`;
          setTimeout(() => { const pc = r.querySelector("#pc"); if (pc) pc.textContent = `${fmt(v,6)} ${coin} · 1/1 confirmations`; }, 1800);
          setTimeout(() => {
            S().tx.unshift({id, kind:"deposit", amount:usd, coin, coinAmt:v, method: net + " network", t:Date.now()});
            store.setBalance(S().balance + usd, "deposit");
            store.notify("Deposit successful", `${fmt(v,6)} ${coin} (≈ ${money(usd)} USDT) has been credited`, "ok");
            U.beep("claim"); U.buzz([20,40,20]);
            if (r.isConnected) r.querySelector("#pend").innerHTML = `<div class="card row" style="margin-top:8px"><span class="ic ic-g" style="border-radius:50%;background:var(--up-bg)">${ic("check",18)}</span><div class="grow"><b>Deposit successful</b><div class="label">${fmt(v,6)} ${coin} · ≈ ${money(usd)} USDT credited</div></div><a class="btn btn-ghost btn-sm" href="#/assets">View</a></div>`;
            toast("Deposit successful", "ok");
          }, 3200);
        };
      });
    };
  }};
}

/* ---------- Copy Trading ---------- */
const LEADS = [
  {id:"l1", n:"CryptoWhale_88", style:"BTC trend · low DD", roi:184.2, pnl:92410, wr:68, aum:1.2e6, f:1872, pair:"BTCUSDT", beta:3},
  {id:"l2", n:"GoldRush Pro", style:"XAUUSD scalper", roi:96.7, pnl:41280, wr:71, aum:640e3, f:932, pair:"XAUUSD", beta:12},
  {id:"l3", n:"ETH Maxi", style:"ETH swing", roi:142.9, pnl:58730, wr:61, aum:880e3, f:1240, pair:"ETHUSDT", beta:2.5},
  {id:"l4", n:"SOL Sniper", style:"High-frequency SOL", roi:233.5, pnl:37210, wr:57, aum:310e3, f:614, pair:"SOLUSDT", beta:2},
  {id:"l5", n:"FX Samurai", style:"EUR/USD, USD/JPY", roi:48.3, pnl:22150, wr:74, aum:420e3, f:388, pair:"EURUSD", beta:40},
  {id:"l6", n:"Meme Hunter", style:"DOGE momentum", roi:311.8, pnl:19870, wr:49, aum:150e3, f:2210, pair:"DOGEUSDT", beta:1.5}
];
Pages.copy = () => {
  let sort = "roi";
  const html = `<header class="page-head"><button class="icon-btn" data-back aria-label="Back">${ic("back",22)}</button><h1 class="h1">Copy Trading</h1><a class="icon-btn" href="#/futures">${ic("nfut",20,1.6)}</a></header>
    <div class="hero" style="margin-bottom:12px"><div class="title">Copy top traders automatically</div><div class="sub" style="margin:4px 0 10px">Allocate USDT to a lead trader. Your copy follows their live positions on real prices.</div><div class="row" style="gap:16px"><div><div class="label">Copying</div><b class="num" id="cc">0</b></div><div><div class="label">Allocated</div><b class="num" id="ca">0</b></div><div><div class="label">Copy PNL</div><b class="num" id="cp">0.00</b></div></div></div>
    <div class="tabs" style="margin-bottom:6px">${[["roi","ROI"],["pnl","PNL"],["wr","Win rate"],["f","Copiers"]].map(([k,n]) => `<button class="tab ${k==="roi"?"on":""}" data-sort="${k}">${n}</button>`).join("")}</div><div id="ll"></div>`;
  const S2 = () => (S().copies ||= {});
  const cpnl = (l, c) => { const p = M.get(l.pair), px = p?.price || c.start, raw = (px - c.start) / c.start * l.beta * c.amt * c.dir; return Math.max(-c.amt * .9, raw + c.amt * 0.00002 * (Date.now() - c.since) / 60000); };
  return {html, title:"Copy Trading", mount(r){
    const render = () => {
      const cps = S2(); let n = 0, a = 0, pl = 0;
      LEADS.forEach(l => { const c = cps[l.id]; if (c?.on){ n++; a += c.amt; pl += cpnl(l, c); } });
      r.querySelector("#cc").textContent = n; r.querySelector("#ca").textContent = money(a); const cp = r.querySelector("#cp"); cp.textContent = signed(pl); cp.className = "num " + (pl >= 0 ? "up" : "down");
      r.querySelector("#ll").innerHTML = LEADS.slice().sort((x,y) => y[sort] - x[sort]).map((l,i) => { const c = cps[l.id], seed = [...l.n].reduce((a,ch) => a + ch.charCodeAt(0), 0);
        const curve = [...Array(30)].map((_,k) => 100 + l.roi * (k/29) + Math.sin(k*1.3 + seed) * l.roi * 0.06);
        return `<div class="lead"><div class="row"><span class="avatar" style="background:${["#F0B90B","#2EBD85","#1E80FF","#9B6BFF","#F6465D","#14B8C9"][i%6]};color:#fff">${esc(l.n[0])}</span><div class="grow"><b>${esc(l.n)}</b><div class="label">${esc(l.style)} · ${fmt(l.f,0)} copiers</div></div>
          ${c?.on ? `<button class="btn btn-ghost btn-sm" data-stop="${l.id}">Stop</button>` : `<button class="btn btn-primary btn-sm" data-copy="${l.id}">Copy</button>`}</div>
          <div class="row" style="margin-top:10px;align-items:flex-end"><div class="grow"><div class="label">30D ROI</div><b class="num up" style="font-size:20px">+${l.roi.toFixed(2)}%</b><div class="label num">PNL +${fmt(l.pnl,0)} · Win ${l.wr}% · AUM $${CH.fmtVol(l.aum)}</div></div><div style="width:110px;height:44px">${spark(curve, 110, 44, "#2EBD85")}</div></div>
          ${c?.on ? `<div class="fkv" style="margin-top:8px"><span>Your copy · ${money(c.amt)} USDT</span><b class="num ${cpnl(l,c)>=0?"up":"down"}">${signed(cpnl(l,c))} USDT</b></div>` : ""}</div>`; }).join("");
    };
    render();
    r.querySelectorAll("[data-sort]").forEach(b => b.onclick = () => { sort = b.dataset.sort; r.querySelectorAll("[data-sort]").forEach(x => x.classList.toggle("on", x===b)); render(); });
    r.querySelector("#ll").addEventListener("click", async e => {
      const cb = e.target.closest("[data-copy]"), sb = e.target.closest("[data-stop]");
      if (cb){ const l = LEADS.find(x => x.id === cb.dataset.copy);
        U.sheet("Copy " + l.n, `<div class="kv"><span>Strategy</span><b>${esc(l.style)}</b></div><div class="kv" style="margin-bottom:12px"><span>Avbl</span><b class="num">${money(S().balance)} USDT</b></div>
          <div class="famt" id="cpf"><input id="cpa" type="number" inputmode="decimal" value="200"><span>USDT</span></div><div class="chips" style="margin-bottom:14px">${[50,100,200,500,1000].map(v => `<button data-v="${v}">${v}</button>`).join("")}</div><div class="err-msg" id="cpe"></div><button class="btn btn-primary btn-block btn-lg" data-ok>Start copying</button>`, el => {
          el.querySelectorAll("[data-v]").forEach(b => b.onclick = () => el.querySelector("#cpa").value = b.dataset.v);
          el.querySelector("[data-ok]").onclick = () => { const v = parseFloat(el.querySelector("#cpa").value), p = M.get(l.pair);
            const err = !(v >= 10) ? "Minimum 10 USDT." : v > S().balance ? "Insufficient balance." : !p?.price || M.isStale(p) ? "Market data offline. Try again shortly." : p.closed ? "Lead trader's market is closed now." : "";
            if (err){ el.querySelector("#cpe").textContent = err; return; }
            S2()[l.id] = {on:true, amt:v, start:p.price, since:Date.now(), dir: M.momentum(l.pair) >= 0 ? 1 : -1};
            store.setBalance(S().balance - v, "copy"); store.notify("Copy trading started", `Copying ${l.n} with ${money(v)} USDT`, "ok"); U.closeLayer(); U.beep("open"); toast("Copy trading started", "ok"); render(); };
        }); }
      if (sb && await U.confirmBox("Stop copying?", "Your allocation plus PNL returns to your balance.", "Stop", true)){
        const l = LEADS.find(x => x.id === sb.dataset.stop), c = S2()[l.id], pl = cpnl(l, c);
        c.on = false; store.setBalance(S().balance + c.amt + pl, "copy"); store.notify("Copy stopped", `${l.n}: ${signed(pl)} USDT`, pl >= 0 ? "ok" : "bad"); toast(`Copy stopped: ${signed(pl)} USDT`, pl >= 0 ? "ok" : "bad"); render(); }
    });
    const iv = setInterval(render, 3000); this.unmount = () => clearInterval(iv);
  }};
};
})();
