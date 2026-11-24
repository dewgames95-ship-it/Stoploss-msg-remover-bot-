/* ===== Assets (wallet overview), Deposit flow, Copy Trading ===== */
(function(){
const C = window.CONFIG, {esc, ic, store, bus, money, signed, toast, spark, fmt} = U;
const S = () => store.s;
const head = (title, right) => `<header class="px-hd"><button class="icon-btn" data-back aria-label="Back">${ic("back",20)}</button><h1>${esc(title)}</h1>${right || `<span style="width:40px"></span>`}</header>`;
const empty = (icon, text) => `<div class="px-empty">${ic(icon,28,1.5)}<p>${esc(text)}</p></div>`;
const PAL = ["#2E6BFF","#1F8FE5","#0E9AA7","#3E7BD9","#4C8DF0","#1C7ED6","#2A9D8F","#5B7FD1"];
const hash = s => { let h = 2166136261; for (const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const hash01 = s => hash(s) / 4294967296;
const rngFor = seed => { let a = hash(seed); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const compact = v => { const a = Math.abs(v); return a >= 1e9 ? (v/1e9).toFixed(2) + "B" : a >= 1e6 ? (v/1e6).toFixed(2) + "M" : a >= 1e3 ? (v/1e3).toFixed(1) + "K" : v.toFixed(0); };
const sgnPct = v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
const cls = v => v >= 0 ? "up" : "down";

/* ======================= ASSETS ======================= */
Pages.assets = (params) => {
  let tab = params[0] || "overview"; if (tab === "binary") tab = "spot";
  const TABS = [["overview","Overview"],["spot","Spot"],["futures","Futures"],["earn","Earn"],["funding","Funding"]];
  const html = `<div class="px-page">${head("Assets", `<a class="icon-btn" href="#/history" aria-label="History">${ic("clockh",20,1.7)}</a>`)}
    <div class="px-tabs">${TABS.map(([k,n]) => `<button data-at="${k}" class="${tab===k?"on":""}">${n}</button>`).join("")}</div><div id="ab"></div></div>`;
  function totals(){
    const s = S(), bin = s.positions.reduce((a,p) => a + p.amount, 0), fm = s.fut.positions.reduce((a,p) => a + p.margin, 0) + s.fut.orders.reduce((a,o) => a + o.margin + o.fee, 0);
    const up = s.fut.positions.reduce((a,p) => a + E.futPnl(p).pnl, 0), vault = E.earnValue();
    const d0 = new Date().setHours(0,0,0,0), tp = E.stats().todayPnl + s.fut.history.filter(x => x.closed >= d0).reduce((a,x) => a + x.profit, 0) + up;
    return {spot:s.balance, bin, fm, up, fut: fm + up, vault, total: s.balance + bin + fm + up + vault, tp};
  }
  function calendar(){
    const now = new Date(), y = now.getFullYear(), m = now.getMonth(), first = new Date(y, m, 1), days = new Date(y, m+1, 0).getDate(), off = (first.getDay() + 6) % 7;
    const all = [...S().history.map(x => ({t:x.closed, p:x.profit})), ...S().fut.history.map(x => ({t:x.closed, p:x.profit}))];
    const byDay = {}; all.forEach(x => { const d = new Date(x.t); if (d.getMonth() === m && d.getFullYear() === y) byDay[d.getDate()] = (byDay[d.getDate()] || 0) + x.p; });
    const tot = Object.values(byDay).reduce((a,b) => a + b, 0);
    let cells = ["M","T","W","T","F","S","S"].map(d => `<div class="w">${d}</div>`).join("") + Array(off).fill("<div></div>").join("");
    for (let d = 1; d <= days; d++){ const v = byDay[d];
      cells += `<div class="d ${d === now.getDate() ? "t" : ""} ${v == null ? "" : v >= 0 ? "u" : "l"}">${d}${v != null ? `<small>${v >= 0 ? "+" : ""}${Math.abs(v) >= 1000 ? (v/1000).toFixed(1) + "K" : v.toFixed(0)}</small>` : ""}</div>`; }
    return `<div class="px-sec-h"><h2>${now.toLocaleString([], {month:"long", year:"numeric"})} PnL</h2><b class="num ${cls(tot)}" style="font-size:13px">${signed(tot)} USDT</b></div><div class="px-cal">${cells}</div>`;
  }
  function txList(list){
    return list.length ? list.map(x => { const dep = x.kind === "deposit";
      return `<div class="px-row"><span class="px-ico ${dep ? "g" : "n"}">${ic(dep ? "down" : "up",16)}</span><div class="grow"><b>${dep ? "Deposit" : "Transfer"} ${esc(x.coin || "USDT")}</b><div class="px-mut">${U.dateStr(x.t)} · ${esc(x.method || "")}</div></div><div class="r"><b class="num ${dep?"up":""}">${dep?"+":""}${fmt(x.coinAmt ?? x.amount, x.coinAmt ? 6 : 2)}</b><span class="px-mut">Completed</span></div></div>`; }).join("") : empty("file","No transactions yet");
  }
  function render(r){
    const s = S(), t = totals(), hide = !!s.settings.hideBal, H = v => hide ? "******" : v, box = r.querySelector("#ab");
    const total = (label, val, pnl) => `<div class="px-total"><div class="row" style="align-items:flex-start"><div class="grow">
        <div class="lb">${label}<button data-eye aria-label="${hide ? "Show" : "Hide"} balance">${ic(hide?"eyeoff":"eye",16)}</button></div>
        <div class="big num">${H(money(val))}<small>USDT</small></div><div class="eq num">${H("≈ $" + money(val))}</div>
        ${pnl != null ? `<div class="pl">Today's PnL <span class="num ${cls(pnl)}">${H(signed(pnl) + " (" + signed(pnl / Math.max(1, t.total - pnl) * 100) + "%)")}</span></div>` : ""}</div>
        <div class="sp">${spark([C.START_BALANCE, ...s.balHist.map(x => x.b)].slice(-80), 96, 44, "var(--brand)")}</div></div></div>`;
    const acts = `<div class="px-acts"><a href="#/deposit"><span>${ic("down",20,1.8)}</span>Deposit</a><a href="#/withdraw"><span>${ic("up",20,1.8)}</span>Withdraw</a><a href="#/withdraw"><span>${ic("swap",20,1.8)}</span>Transfer</a><a href="#/history"><span>${ic("clockh",20,1.8)}</span>History</a></div>`;
    const rowOf = (name, sub, amt, val, tail) => `<div class="px-row">${UI.coinImg("USDT", 36)}<div class="grow"><b>USDT</b><div class="px-mut">${name}${sub ? " · " + sub : ""}</div></div><div class="r"><b class="num">${H(fmt(amt, 4))}</b><span class="px-mut num">${H("$" + money(val))}</span></div></div>`;
    const rows = (list) => { const l = s.settings.hideSmall ? list.filter(x => x[3] >= 1) : list; return l.length ? l.map(x => rowOf(...x)).join("") : empty("wallet", s.settings.hideSmall ? "No balances above 1 USDT" : "No assets"); };
    const small = `<label class="px-chk"><input type="checkbox" data-small ${s.settings.hideSmall ? "checked" : ""}><span>Hide small balances</span></label>`;
    if (tab === "overview"){
      const parts = [["Spot",t.spot,"#2E6BFF"],["Futures",Math.max(0,t.fut),"#5AA9FF"],["Binary",t.bin,"#0E9AA7"],["Earn",t.vault,"#A9B8D4"]], sum = parts.reduce((a,p) => a + p[1], 0) || 1;
      box.innerHTML = total("Total Balance", t.total, t.tp) + acts + `
        <div class="px-sec"><div class="px-sec-h"><h2>Allocation</h2></div><div class="px-alloc">${parts.filter(p => p[1] > 0).map(([n,v,c]) => `<i style="flex:${v/sum};background:${c}"></i>`).join("")}</div>
          <div class="px-leg">${parts.map(([n,v,c]) => `<div><i style="background:${c}"></i>${n}<b class="num">${hide ? "**" : (v/sum*100).toFixed(1) + "%"}</b></div>`).join("")}</div></div>
        <div class="px-sec"><div class="px-sec-h"><h2>Assets</h2>${small}</div>${rows([["Spot","Available",t.spot,t.spot],["Binary","Open stake",t.bin,t.bin],["Futures","Margin + PnL",t.fut,t.fut],["Earn",Math.round(E.APR*100) + "% APR",t.vault,t.vault]].filter((x,i) => i === 0 || x[2] > 0))}</div>
        <div class="px-sec">${calendar()}</div>
        <div class="px-sec"><div class="px-sec-h"><h2>Recent transactions</h2><a href="#/history">Trade history</a></div>${txList(s.tx.slice(0, 6))}</div>`;
    } else if (tab === "spot"){
      const st = E.stats();
      box.innerHTML = total("Spot Balance", t.spot + t.bin, null) + `<div class="px-sec"><div class="px-sec-h"><h2>Assets</h2>${small}</div>${rows([["Spot","Available",t.spot,t.spot],["Binary","Open stake",t.bin,t.bin]])}</div>
        <div class="px-sec"><div class="px-kpis"><div><span>Open stake</span><b class="num">${H(money(t.bin))}</b></div><div><span>Net PnL</span><b class="num ${cls(st.net)}">${signed(st.net)}</b></div><div><span>Trades</span><b class="num">${st.trades}</b></div><div><span>Win rate</span><b class="num">${st.winRate.toFixed(1)}%</b></div></div>
        <a class="px-btn pri blk" style="margin-top:14px" href="#/trade">Trade</a></div>`;
    } else if (tab === "futures"){
      const h = s.fut.history, net = h.reduce((a,x) => a + x.profit, 0), w = h.filter(x => x.profit > 0).length;
      box.innerHTML = total("Margin Balance", t.fut, t.up) + `<div class="px-sec"><div class="px-kpis"><div><span>In positions</span><b class="num">${H(money(t.fm))}</b></div><div><span>Unrealized PnL</span><b class="num ${cls(t.up)}">${H(signed(t.up))}</b></div><div><span>Realized PnL</span><b class="num ${cls(net)}">${signed(net)}</b></div><div><span>Win rate</span><b class="num">${h.length ? (w/h.length*100).toFixed(1) : "0.0"}%</b></div></div>
        <a class="px-btn pri blk" style="margin-top:14px" href="#/futures">Trade Futures</a></div>
        <div class="px-sec"><div class="px-sec-h"><h2>Position history</h2><a href="#/history">All</a></div>${h.length ? UI.historyHtml(h.slice(0, 5)) : empty("file","No closed positions")}</div>`;
    } else if (tab === "earn"){
      box.innerHTML = total("Earn Balance", t.vault, null) + `<div class="px-sec"><div class="px-row" style="border:0"><span class="px-ico">${ic("vault",18)}</span><div class="grow"><b>USDT Flexible Vault</b><div class="px-mut">Interest accrues every second, redeem anytime</div></div><b class="up num">${Math.round(E.APR*100)}% APR</b></div>
        <a class="px-btn pri blk" style="margin-top:12px" href="#/withdraw">Subscribe / Redeem</a></div>`;
    } else {
      box.innerHTML = total("Funding Balance", t.spot, null) + acts + `<div class="px-sec"><div class="px-sec-h"><h2>Deposit and transfer history</h2><span class="px-mut">${s.tx.length} total</span></div>${txList(s.tx.slice(0, 20))}</div>`;
    }
    box.querySelector("[data-eye]").onclick = () => { s.settings.hideBal = !s.settings.hideBal; store.save(); render(r); };
    const sm = box.querySelector("[data-small]"); if (sm) sm.onchange = () => { s.settings.hideSmall = sm.checked; store.save(); render(r); };
  }
  return {html, title:"Assets", mount(r){
    render(r);
    r.querySelectorAll("[data-at]").forEach(b => b.onclick = () => { tab = b.dataset.at; r.querySelectorAll("[data-at]").forEach(x => x.classList.toggle("on", x===b)); render(r); });
    const iv = setInterval(() => { if (r.isConnected) render(r); }, 4000), offs = [bus.on("balance", () => render(r))];
    this.unmount = () => { clearInterval(iv); offs.forEach(f => f()); };
  }};
};

/* ======================= DEPOSIT ======================= */
const NETS = {
  USDT:[["BSC","BNB Smart Chain (BEP20)","bnb",0.01,1],["TRX","Tron (TRC20)","trx",0.01,1],["ETH","Ethereum (ERC20)","eth",0.001,2],["POL","Polygon POS","pol",0.02,1],["SOL","Solana","sol",0.001,1],["ARBITRUM","Arbitrum One","arb",0.01,1],["OPTIMISM","Optimism","op",0.01,1]],
  BTC:[["BTC","Bitcoin","btc",0.00006,10],["BSC","BNB Smart Chain (BEP20)","bnb",0.000001,1]],
  ETH:[["ETH","Ethereum (ERC20)","eth",0.000001,2],["ARBITRUM","Arbitrum One","arb",0.000001,1],["OPTIMISM","Optimism","op",0.000001,1],["BSC","BNB Smart Chain (BEP20)","bnb",0.000001,1]],
  BNB:[["BSC","BNB Smart Chain (BEP20)","bnb",0.00001,1]], SOL:[["SOL","Solana","sol",0.001,1]], TRX:[["TRX","Tron (TRC20)","trx",0.1,1]]
};
const netsFor = c => NETS[c] || [["BSC","BNB Smart Chain (BEP20)","bnb",0.01,1],[c,(window.COIN_NAMES[c] || c) + " Network",c.toLowerCase(),0.01,2]];
const coinIcon = (c, size=36) => UI.coinImg(c, size);
function paperAddr(coin, net){ let h = 0; const seed = S().profile.uid + coin + net; for (const ch of seed) h = (h * 131 + ch.charCodeAt(0)) >>> 0; let hex = ""; for (let i=0;i<8;i++){ h = (h * 1103515245 + 12345) >>> 0; hex += h.toString(16).padStart(8,"0"); } return "PAPER" + net.slice(0,3) + hex.slice(0, 33); }
Pages.deposit = (params) => {
  const coin = (params[0] || "").toUpperCase(), net = (params[1] || "").toUpperCase();
  if (!coin) return selectCoin();
  if (!net) return chooseNet(coin);
  return depositPage(coin, net);
};
function selectCoin(){
  const trending = ["USDT","BTC","ETH","BNB"];
  const html = `<div class="px-page">${head("Select Currency")}
    <label class="px-search">${ic("search",16)}<input id="cq" placeholder="Search coins" autocomplete="off" aria-label="Search coins"></label>
    <div id="cl"></div></div>`;
  return {html, title:"Deposit", mount(r){
    const all = () => { const set = new Set(["USDT", ...M.cryptoOrder.map(s => M.get(s)?.base).filter(Boolean)]); return [...set].sort((a,b) => a.localeCompare(b)); };
    const row = c => `<a class="px-row" href="#/deposit/${c}">${coinIcon(c)}<div class="grow"><b>${c}</b><div class="px-mut">${esc(c === "USDT" ? "TetherUS" : window.COIN_NAMES[c] || c)}</div></div><span style="color:var(--muted)">${ic("chev",16)}</span></a>`;
    const render = q => {
      const box = r.querySelector("#cl"); q = (q || "").trim().toUpperCase();
      if (q){ const l = all().filter(c => c.includes(q) || (window.COIN_NAMES[c] || "").toUpperCase().includes(q)); box.innerHTML = `<div style="padding-top:8px">${l.map(row).join("") || empty("search","No coins found")}</div>`; return; }
      const groups = {}; all().forEach(c => { const k = /[0-9]/.test(c[0]) ? "#" : c[0]; (groups[k] ||= []).push(c); });
      box.innerHTML = `<div class="px-grp">Popular</div><div class="px-chips" style="padding-bottom:6px">${trending.map(c => `<button data-go="${c}" style="display:inline-flex;align-items:center;gap:6px;height:34px">${coinIcon(c,18)}${c}</button>`).join("")}</div>
        ${Object.keys(groups).map(k => `<div class="px-grp" id="g-${k === "#" ? "n" : k}">${k}</div>${groups[k].map(row).join("")}`).join("")}
        <div class="px-az">${Object.keys(groups).map(k => `<button data-az="${k === "#" ? "n" : k}">${k}</button>`).join("")}</div>`;
      box.querySelectorAll("[data-go]").forEach(b => b.onclick = () => location.hash = "#/deposit/" + b.dataset.go);
      box.querySelectorAll("[data-az]").forEach(b => b.onclick = () => document.getElementById("g-" + b.dataset.az)?.scrollIntoView({behavior:"smooth"}));
    };
    render(); r.querySelector("#cq").addEventListener("input", e => render(e.target.value));
    this.unmount = bus.on("list", () => render(r.querySelector("#cq")?.value));
  }};
}
function chooseNet(coin){
  const html = `<div class="px-page">${head("Choose Network")}
    <div class="px-row" style="border:0;padding:4px 0 8px">${coinIcon(coin, 32)}<div class="grow"><b>${esc(coin)}</b><div class="px-mut">${esc(coin === "USDT" ? "TetherUS" : window.COIN_NAMES[coin] || coin)}</div></div></div>
    ${netsFor(coin).map(([k,n,ico,min,eta]) => `<a class="px-net" href="#/deposit/${coin}/${k}">${coinIcon(ico.toUpperCase(), 32)}<div class="grow"><div class="tt">${k}<small>${esc(n)}</small></div><div class="mm">Min. deposit ${min} ${esc(coin)} · ~${eta} min</div></div><span style="color:var(--muted)">${ic("chev",16)}</span></a>`).join("")}
    <div class="px-notice">${ic("info",14)}<span>Only networks supported by ${esc(C.APP_NAME)} are listed. Deposits are credited to your paper-trading account.</span></div></div>`;
  return {html, title:"Choose Network"};
}
function depositPage(coin, net){
  const nd = netsFor(coin).find(x => x[0] === net) || netsFor(coin)[0], addr = paperAddr(coin, net);
  const html = `<div class="px-page">${head("Deposit " + coin, `<a class="icon-btn" href="#/assets/funding" aria-label="History">${ic("clockh",20,1.7)}</a>`)}
    <a class="px-net" href="#/deposit/${coin}">${coinIcon(coin, 32)}<div class="grow"><div class="px-mut">Network</div><div class="tt" style="margin-top:1px">${esc(nd[0])}<small>${esc(nd[1])}</small></div></div><span style="color:var(--muted)">${ic("chev",16)}</span></a>
    <div class="px-sec" style="text-align:center;border:0;padding-bottom:12px"><div class="px-qr" id="qr"></div>
      <div class="px-mut" style="text-align:left;margin-bottom:6px">Deposit address</div>
      <div class="px-addr"><div class="a num" style="text-align:left"><em>${addr.slice(0,8)}</em>${addr.slice(8,-6)}<em>${addr.slice(-6)}</em></div><button class="icon-btn" data-copy aria-label="Copy address" style="color:var(--brand)">${ic("copy",18)}</button></div></div>
    <div style="padding:0 0 12px;border-bottom:1px solid var(--line)">
      <div class="px-kv"><span>Deposit to</span><b>Spot account</b></div>
      <div class="px-kv"><span>Minimum deposit</span><b class="num">${nd[3]} ${esc(coin)}</b></div>
      <div class="px-kv"><span>Credited after</span><b>1 confirmation</b></div>
      <div class="px-kv"><span>Estimated arrival</span><b>~${nd[4]} min</b></div></div>
    <div class="px-notice" style="margin-top:14px">${ic("info",14)}<span>This is a paper-trading address. Use the Deposit button below to add demo funds instantly. Do not send real crypto to it.</span></div>
    <div id="pend"></div>
    <button class="px-btn pri blk lg" data-dep style="margin-top:16px">Deposit</button></div>`;
  return {html, title:"Deposit " + coin, mount(r){
    const q = r.querySelector("#qr");
    try { const qr = window.qrcode(0, "M"); qr.addData("paper:" + addr); qr.make(); q.innerHTML = `${qr.createSvgTag({cellSize:5, margin:0, scalable:true})}<span class="lg">${coinIcon(coin, 30)}</span>`; q.querySelector("svg").setAttribute("style","width:100%;height:100%"); } catch { q.innerHTML = `<div class="px-empty">${ic("qr",32,1.4)}</div>`; }
    r.querySelector("[data-copy]").onclick = () => U.copyText(addr, "Address copied");
    r.querySelector("[data-dep]").onclick = () => {
      const px = coin === "USDT" ? 1 : (M.get(coin + "USDT")?.price || 0);
      U.sheet("Deposit " + coin, `<div class="px-fld"><label><span>Amount</span><span id="dvu"></span></label><div class="px-inp"><input id="dv" type="number" inputmode="decimal" value="${coin === "USDT" ? 1000 : +(1000/(px||1)).toFixed(6)}"><span>${esc(coin)}</span></div></div>
        <div class="px-chips" style="margin-bottom:14px">${[100,500,1000,5000,10000].map(v => `<button data-u="${v}">$${fmt(v,0)}</button>`).join("")}</div><div class="px-err" id="de"></div>
        <button class="px-btn pri blk lg" data-ok>Confirm Deposit</button>`, el => {
        const upd = () => { const v = parseFloat(el.querySelector("#dv").value) || 0; el.querySelector("#dvu").textContent = `≈ ${money(v * px)} USDT`; };
        upd(); el.querySelector("#dv").oninput = upd;
        el.querySelectorAll("[data-u]").forEach(b => b.onclick = () => { el.querySelector("#dv").value = coin === "USDT" ? b.dataset.u : +(b.dataset.u / (px||1)).toFixed(6); upd(); });
        el.querySelector("[data-ok]").onclick = () => {
          const v = parseFloat(el.querySelector("#dv").value), usd = v * px;
          const e = !(v > 0) ? "Please enter the amount." : v < nd[3] ? `Minimum deposit is ${nd[3]} ${coin}.` : !px ? "Price unavailable. Try again shortly." : usd > 1000000 ? "Maximum 1,000,000 USDT per deposit." : "";
          if (e){ el.querySelector("#de").textContent = e; return; }
          U.closeLayer();
          const box = r.querySelector("#pend"), id = U.uid();
          box.innerHTML = `<div class="px-row" style="margin-top:8px"><span class="px-ico">${ic("clock",16)}</span><div class="grow"><b>Deposit pending</b><div class="px-mut" id="pc">${fmt(v,6)} ${coin} · 0/1 confirmations</div></div><div class="spin"></div></div>`;
          setTimeout(() => { const pc = r.querySelector("#pc"); if (pc) pc.textContent = `${fmt(v,6)} ${coin} · 1/1 confirmations`; }, 1800);
          setTimeout(() => {
            S().tx.unshift({id, kind:"deposit", amount:usd, coin, coinAmt:v, method: net + " network", t:Date.now()});
            store.setBalance(S().balance + usd, "deposit");
            store.notify("Deposit successful", `${fmt(v,6)} ${coin} (≈ ${money(usd)} USDT) has been credited`, "ok");
            U.fx("claim");
            if (r.isConnected) r.querySelector("#pend").innerHTML = `<div class="px-row" style="margin-top:8px"><span class="px-ico g">${ic("check",16)}</span><div class="grow"><b>Deposit successful</b><div class="px-mut">${fmt(v,6)} ${coin} · ≈ ${money(usd)} USDT credited</div></div><a class="px-btn sm" href="#/assets">View</a></div>`;
            toast("Deposit successful", "ok");
          }, 3200);
        };
      });
    };
  }};
}

/* ======================= COPY TRADING ======================= */
const CAP = 1000;
/* [id, nickname, style, symbol, roi[7D,30D,90D], pnl30, winRate, maxDD, aum, followers, tradingDays] */
const LEADS = [
  ["l1","CryptoWhale_88","BTC trend, low drawdown","BTCUSDT",[11.8,48.2,131.4],92410,68,9.4,1.2e6,872,214],
  ["l2","GoldRush Pro","Gold intraday scalper","XAUUSD",[4.1,19.7,52.3],41280,71,6.1,640e3,932,402],
  ["l3","ETH Maxi","ETH swing, 3x average","ETHUSDT",[9.6,36.9,98.5],58730,61,14.8,880e3,640,177],
  ["l4","SOL Sniper","High frequency SOL","SOLUSDT",[18.2,63.5,171.8],37210,57,21.3,310e3,614,96],
  ["l5","FX Samurai","EUR/USD and USD/JPY","EURUSD",[1.9,8.3,24.6],22150,74,3.7,420e3,388,530],
  ["l6","Meme Hunter","DOGE momentum","DOGEUSDT",[-3.4,41.8,88.2],19870,49,29.6,150e3,998,81],
  ["l7","NorthStar Capital","BNB and majors, hedged","BNBUSDT",[5.2,22.4,61.9],64300,66,7.9,1.9e6,741,356],
  ["l8","Quant Lab","XRP mean reversion","XRPUSDT",[7.3,27.6,74.1],28440,63,11.2,520e3,455,268],
  ["l9","Delta Neutral","BTC basis, market neutral","BTCUSDT",[1.2,6.8,19.9],51200,82,2.4,3.4e6,963,611],
  ["l10","SwingKing","AVAX 4h swing","AVAXUSDT",[-1.8,31.1,84.6],16920,55,18.5,240e3,327,143],
  ["l11","TrendRider","LINK breakout trend","LINKUSDT",[6.4,24.9,66.7],14380,59,13.1,198e3,276,119],
  ["l12","Basis Hunter","ETH funding arbitrage","ETHUSDT",[0.9,5.2,16.4],33660,85,1.9,2.6e6,1000,498]
].map(a => ({id:a[0], name:a[1], style:a[2], sym:a[3], roi:a[4], pnl30:a[5], wr:a[6], mdd:a[7], aum:a[8], f:a[9], days:a[10], ini:a[1].replace(/[^A-Za-z ]/g," ").split(/\s+|(?=[A-Z])/).filter(Boolean).slice(0,2).map(w => w[0]).join("").toUpperCase() || a[1].slice(0,2).toUpperCase(), col:PAL[hash(a[0]) % PAL.length]}));
const PRICE_FB = {BTC:67000, ETH:3300, SOL:160, BNB:600, XRP:.55, DOGE:.15, AVAX:35, LINK:15, XAU:2350, EUR:1.08};
const PERS = [["7D",0],["30D",1],["90D",2]];
const baseOf = sym => sym.replace(/USDT$/, "").replace(/USD$/, "");
const symIcon = (sym, size) => { const p = M.get(sym); return p ? UI.pairIcon(p, size) : UI.coinImg(baseOf(sym), size); };
const symLabel = sym => { const p = M.get(sym); return p ? M.label(p) : (sym.endsWith("USDT") ? baseOf(sym) + "/USDT" : sym); };
const symPx = (sym, v) => { const p = M.get(sym); try { return M.fmtPx(p || {dp: v < 10 ? 4 : 2}, v); } catch { return fmt(v, v < 10 ? 4 : 2); } };
const tdesc = mk => mk === "spot" ? .42 : 1;
function lstats(l, per, mk){
  const f = tdesc(mk), roi = l.roi[per] * f, pnl = l.pnl30 * (l.roi[per] / l.roi[1]) * (mk === "spot" ? .5 : 1);
  return {roi, pnl, wr: Math.min(96, l.wr + (mk === "spot" ? 3 : 0)), mdd: l.mdd * (mk === "spot" ? .55 : 1), aum: l.aum * (mk === "spot" ? .6 : 1)};
}
function curve(l, per, mk, n){
  const roi = lstats(l, per, mk).roi, r = rngFor(l.id + per + mk); let w = 0; const out = [];
  for (let k = 0; k < n; k++){ w = w * .72 + (r() - .5) * Math.abs(roi) * .09 + (r() - .5) * 1.2; const x = k / (n - 1); out.push(roi * x + w * Math.sin(Math.PI * x)); }
  return out;
}
function positionsOf(l, mk){
  const r = rngFor("pos" + l.id + mk), pool = [l.sym, l.sym, "BTCUSDT", "ETHUSDT", l.sym, "SOLUSDT"].filter((v,i,a) => mk === "spot" || true), out = [];
  for (let i = 0; i < 6; i++){
    const sym = pool[i % pool.length], p = M.get(sym), base = p?.price || PRICE_FB[baseOf(sym)] || 100, entry = base * (1 + (r() - .5) * .03), long = r() > .38, lev = mk === "spot" ? 0 : [3,5,8,10,15,20][Math.floor(r() * 6)];
    const pct = (r() - .3) * (mk === "spot" ? 6 : 14) + (l.roi[1] > 20 ? 1.2 : 0), ago = (i + 1) * (1 + Math.floor(r() * 5)) * 3.6e6;
    out.push({sym, long, lev, entry, pct, t: Date.now() - ago});
  }
  return out;
}
/* ---- copy state (v2: {v:2, active:[], history:[]}); migrates the old {leaderId:{on,amt,start,since,dir}} map ---- */
const OLD = {l1:"CryptoWhale_88", l2:"GoldRush Pro", l3:"ETH Maxi", l4:"SOL Sniper", l5:"FX Samurai", l6:"Meme Hunter"};
function newCopy(l, o){
  return Object.assign({id:U.uid(), lid:l.id, name:l.name, ini:l.ini, mk:"futures", amt:0, mode:"fixed", modeVal:0, maxOrder:0, sl:0, tp:0, since:Date.now(),
    seed:U.uid(), drift:Math.max(.003, l.roi[1] / 30 * .35 / 24), vol:1.1 + hash01(l.id) * 1.6}, o);
}
function cstate(){
  let c = S().copies;
  if (c && c.v === 2) return c;
  const n = {v:2, active:[], history:[]};
  if (c && typeof c === "object") Object.keys(c).forEach(k => { const o = c[k]; if (o && o.on && OLD[k]){ const l = LEADS.find(x => x.id === k); n.active.push(newCopy(l, {amt:o.amt, since:o.since || Date.now(), modeVal:o.amt, maxOrder:o.amt, mode:"fixed"})); } });
  S().copies = n; store.save(); return n;
}
/* deterministic, time-based random walk in percent of invested capital */
function copyPct(c, t = Date.now()){
  const ms = t - c.since; if (ms <= 0) return 0;
  const h = ms / 36e5, x = ms / 3e5, i = Math.floor(x), f = x - i, sm = f * f * (3 - 2 * f);
  const nz = k => hash01(c.seed + ":" + k) - .5, nv = nz(i) * (1 - sm) + nz(i + 1) * sm, ph = hash01(c.seed + "p") * 6.28;
  const v = c.drift * h + c.vol * 2 * (nv - nz(0)) + c.vol * 1.4 * (Math.sin(h * .9 + ph) - Math.sin(ph)) * Math.min(1, h / 2);
  return Math.max(-95, Math.min(1000, v));
}
const dur = ms => { const m = Math.floor(ms / 6e4); return m < 60 ? Math.max(1, m) + "m" : m < 1440 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : Math.floor(m / 1440) + "d " + Math.floor(m % 1440 / 60) + "h"; };
function stopCopy(c, reason){
  const st = cstate(), pct = copyPct(c), pnl = c.amt * pct / 100, val = Math.max(0, c.amt + pnl);
  st.active = st.active.filter(x => x.id !== c.id);
  st.history.unshift(Object.assign({}, c, {end:Date.now(), pct, pnl, val, reason:reason || "Manual"})); st.history = st.history.slice(0, 60);
  store.setBalance(S().balance + val, "copy");
  store.notify("Copy trading closed", `${c.name}: ${signed(pnl)} USDT${reason ? " (" + reason + ")" : ""}`, pnl >= 0 ? "ok" : "bad");
  U.fx("close"); return {pnl, pct};
}

Pages.copy = (params) => {
  let tab = params && params[0] === "my" ? "my" : params && params[0] === "spot" ? "spot" : "futures", sort = "roi", per = 1;
  const SORTS = [["roi","ROI"],["pnl","PnL"],["wr","Win rate"],["f","Followers"],["aum","AUM"]];
  const html = `<div class="px-page">${head("Copy Trading")}
    <div class="px-tabs" id="ctabs"></div>
    <div id="cbody"></div></div>`;
  const leaderCard = (l, mk) => { const s = lstats(l, per, mk), full = l.f >= CAP;
    return `<div class="px-ld" data-ld="${l.id}"><div class="row" style="gap:10px"><span class="px-av" style="background:${l.col}">${esc(l.ini)}</span>
      <div class="grow"><div class="nm"><span class="ellipsis">${esc(l.name)}</span></div><div class="px-cap"><span class="num">${fmt(l.f,0)}/${fmt(CAP,0)}</span><i><b style="width:${l.f / CAP * 100}%"></b></i></div></div>
      <button class="px-btn ol sm" data-cp="${l.id}" ${full ? "disabled" : ""}>${full ? "Full" : "Copy"}</button></div>
      <div class="mid"><div><div class="roi-l">${PERS[per][0]} ROI</div><div class="roi num ${cls(s.roi)}">${sgnPct(s.roi)}</div></div><div class="spk">${spark(curve(l, per, mk, 30), 112, 40, s.roi >= 0 ? "var(--up)" : "var(--down)")}</div></div>
      <div class="px-st"><div><span>${PERS[per][0]} PnL</span><b class="num ${cls(s.pnl)}">${s.pnl >= 0 ? "+" : "-"}$${compact(Math.abs(s.pnl))}</b></div><div><span>Win rate</span><b class="num">${s.wr.toFixed(1)}%</b></div><div><span>Max DD</span><b class="num">${s.mdd.toFixed(1)}%</b></div><div><span>AUM</span><b class="num">$${compact(s.aum)}</b></div></div></div>`; };
  return {html, title:"Copy Trading", mount(r){
    const $ = q => r.querySelector(q);
    const tabs = () => { const n = cstate().active.length; $("#ctabs").innerHTML = [["futures","Futures"],["spot","Spot"],["my","My Copy" + (n ? ` (${n})` : "")]].map(([k,t]) => `<button data-t="${k}" class="${tab===k?"on":""}">${t}</button>`).join(""); };
    function renderLeaders(){
      const mk = tab, key = {roi:l => lstats(l,per,mk).roi, pnl:l => lstats(l,per,mk).pnl, wr:l => lstats(l,per,mk).wr, f:l => l.f, aum:l => lstats(l,per,mk).aum}[sort];
      $("#cbody").innerHTML = `<div class="row between" style="padding:12px 0 10px"><div class="px-seg" id="pseg">${PERS.map(([n,i]) => `<button data-p="${i}" class="${per===i?"on":""}">${n}</button>`).join("")}</div><span class="px-mut">${LEADS.length} lead traders</span></div>
        <div class="px-chips" id="sseg" style="margin-bottom:4px">${SORTS.map(([k,n]) => `<button data-s="${k}" class="${sort===k?"on":""}">${n}</button>`).join("")}</div>
        <div id="ll">${LEADS.slice().sort((a,b) => key(b) - key(a)).map(l => leaderCard(l, mk)).join("")}</div>`;
      $("#pseg").onclick = e => { const b = e.target.closest("[data-p]"); if (b){ per = +b.dataset.p; renderLeaders(); } };
      $("#sseg").onclick = e => { const b = e.target.closest("[data-s]"); if (b){ sort = b.dataset.s; renderLeaders(); } };
      $("#ll").onclick = e => { const b = e.target.closest("[data-cp]"), c = e.target.closest("[data-ld]"); if (c) detail(LEADS.find(x => x.id === c.dataset.ld), mk, !!b); };
    }
    function renderMy(){
      const st = cstate(), now = Date.now();
      const act = st.active.map(c => ({c, pct:copyPct(c, now)})), inv = act.reduce((a,x) => a + x.c.amt, 0), pl = act.reduce((a,x) => a + x.c.amt * x.pct / 100, 0);
      const histPl = st.history.reduce((a,x) => a + x.pnl, 0);
      $("#cbody").innerHTML = `<div class="px-sum"><div><span>Invested (USDT)</span><b class="num">${money(inv)}</b></div><div><span>Current value</span><b class="num">${money(inv + pl)}</b></div><div><span>Unrealized PnL</span><b class="num ${cls(pl)}">${signed(pl)}</b></div></div>
        <div class="px-sec-h" style="margin-top:16px"><h2>Active (${act.length})</h2></div>
        ${act.length ? act.map(({c, pct}) => { const pn = c.amt * pct / 100, pts = [...Array(24)].map((_,i) => copyPct(c, c.since + (now - c.since) * i / 23));
          return `<div class="px-cp"><div class="row" style="gap:10px"><span class="px-av sm" style="background:${(LEADS.find(x => x.id === c.lid) || {}).col || PAL[0]}">${esc(c.ini)}</span><div class="grow"><div class="nm" style="font-size:14px;font-weight:700">${esc(c.name)} <span class="px-tag br">${c.mk === "spot" ? "Spot" : "Futures"}</span></div><div class="px-mut">Running ${dur(now - c.since)}</div></div><button class="px-btn dn sm" data-stop="${c.id}">Stop</button></div>
          <div class="px-ld" style="border:0;padding:0"><div class="mid"><div><div class="roi-l">PnL (USDT)</div><div class="roi num ${cls(pn)}">${signed(pn)}</div><div class="num ${cls(pn)}" style="font-size:12px">${sgnPct(pct)}</div></div><div class="spk">${spark(pts, 112, 40, pn >= 0 ? "var(--up)" : "var(--down)")}</div></div></div>
          <div class="px-st"><div><span>Invested</span><b class="num">${money(c.amt)}</b></div><div><span>Value</span><b class="num">${money(c.amt + pn)}</b></div><div><span>Stop-loss</span><b class="num">${c.sl ? "-" + c.sl + "%" : "Off"}</b></div><div><span>Take-profit</span><b class="num">${c.tp ? "+" + c.tp + "%" : "Off"}</b></div></div></div>`; }).join("") : empty("users","No active copies. Pick a lead trader to start.")}
        <div class="px-sec-h" style="margin-top:20px"><h2>History</h2>${st.history.length ? `<span class="px-mut">Realized <b class="num ${cls(histPl)}">${signed(histPl)}</b></span>` : ""}</div>
        ${st.history.length ? st.history.slice(0, 20).map(h => `<div class="px-row"><span class="px-av sm" style="background:${(LEADS.find(x => x.id === h.lid) || {}).col || PAL[0]}">${esc(h.ini)}</span><div class="grow"><b>${esc(h.name)}</b><div class="px-mut">${U.dateStr(h.end)} · ${dur(h.end - h.since)} · ${esc(h.reason)}</div></div><div class="r"><b class="num ${cls(h.pnl)}">${signed(h.pnl)}</b><span class="px-mut num">${sgnPct(h.pct)} on ${money(h.amt)}</span></div></div>`).join("") : empty("file","No history yet")}`;
      $("#cbody").querySelectorAll("[data-stop]").forEach(b => b.onclick = async () => {
        const c = cstate().active.find(x => x.id === b.dataset.stop); if (!c) return;
        if (await U.confirmBox("Stop copying?", `Your investment plus PnL (${signed(c.amt * copyPct(c) / 100)} USDT) returns to your balance and ${c.name}'s positions are no longer copied.`, "Stop", true)){
          if (!cstate().active.find(x => x.id === c.id)) return;
          const x = stopCopy(c); toast(`Copy stopped: ${signed(x.pnl)} USDT`, x.pnl >= 0 ? "ok" : "bad"); tabs(); renderMy();
        }
      });
    }
    const show = () => { tabs(); tab === "my" ? renderMy() : renderLeaders(); };
    function detail(l, mk, focus){
      let dp = per;
      const full = l.f >= CAP, bal = () => S().balance;
      const body = () => { const s = lstats(l, dp, mk);
        return `<div class="row" style="gap:12px;padding:2px 0 4px"><span class="px-av lg" style="background:${l.col}">${esc(l.ini)}</span><div class="grow"><b style="font-size:16px">${esc(l.name)}</b><div class="px-mut">${esc(l.style)}</div><div class="px-cap"><span class="num">${fmt(l.f,0)}/${fmt(CAP,0)} followers</span><i><b style="width:${l.f / CAP * 100}%"></b></i></div></div></div>
        <div class="row between" style="margin-top:10px"><div class="px-seg" id="dseg">${PERS.map(([n,i]) => `<button data-p="${i}" class="${dp===i?"on":""}">${n}</button>`).join("")}</div><span class="px-mut">${l.days} trading days</span></div>
        <div class="px-grid3"><div><span>${PERS[dp][0]} ROI</span><b class="num ${cls(s.roi)}" style="font-size:20px">${sgnPct(s.roi)}</b></div><div><span>${PERS[dp][0]} PnL</span><b class="num ${cls(s.pnl)}">${s.pnl >= 0 ? "+" : "-"}$${fmt(Math.abs(s.pnl),0)}</b></div><div><span>Win rate</span><b class="num">${s.wr.toFixed(1)}%</b></div><div><span>Max drawdown</span><b class="num">${s.mdd.toFixed(1)}%</b></div><div><span>AUM</span><b class="num">$${compact(s.aum)}</b></div><div><span>Avg. leverage</span><b class="num">${mk === "spot" ? "1x" : Math.round(3 + hash01(l.id) * 9) + "x"}</b></div></div>
        <div class="px-sec-h" style="margin-bottom:0"><h2>ROI</h2></div><div class="px-big">${spark(curve(l, dp, mk, 60), 320, 110, s.roi >= 0 ? "var(--up)" : "var(--down)")}</div>`; };
      const form = `<div class="px-sec" id="pf" style="margin-top:12px"><div class="px-sec-h"><h2>Copy settings</h2><span class="px-mut">Avbl <b class="num" style="color:var(--text)">${money(bal())}</b> USDT</span></div>
        <div class="px-fld"><label><span>Investment</span><span class="px-mut">Min 10 USDT</span></label><div class="px-inp" id="fi"><input id="inv" type="number" inputmode="decimal" value="${Math.min(500, Math.floor(bal() / 10) * 10 || 100)}"><span>USDT</span></div></div>
        <div class="px-chips" style="margin-bottom:14px">${[100,500,1000,5000].map(v => `<button data-v="${v}">${fmt(v,0)}</button>`).join("")}<button data-v="max">Max</button></div>
        <div class="px-fld"><label><span>Copy mode</span></label><div class="px-seg" id="cm" style="display:flex"><button data-m="fixed" class="on" style="flex:1">Fixed amount</button><button data-m="ratio" style="flex:1">Fixed ratio</button></div></div>
        <div class="px-2c"><div class="px-fld"><label><span id="mvl">Per order</span></label><div class="px-inp"><input id="mv" type="number" inputmode="decimal" value="50"><span id="mvu">USDT</span></div></div>
          <div class="px-fld"><label><span>Max per order</span></label><div class="px-inp"><input id="mo" type="number" inputmode="decimal" value="250"><span>USDT</span></div></div></div>
        <div class="px-2c"><div class="px-fld"><label><span>Stop-loss</span></label><div class="px-inp"><input id="sl" type="number" inputmode="decimal" value="30" placeholder="Off"><span>%</span></div></div>
          <div class="px-fld"><label><span>Take-profit</span></label><div class="px-inp"><input id="tp" type="number" inputmode="decimal" placeholder="Off"><span>%</span></div></div></div>
        <div class="px-notice" style="margin-bottom:12px">${ic("info",14)}<span>Past performance does not guarantee future results. Copying may be closed automatically when your stop-loss or take-profit is reached.</span></div>
        <div class="px-err" id="fe"></div><button class="px-btn pri blk lg" id="go" ${full ? "disabled" : ""}>${full ? "Lead trader is full" : "Start Copying"}</button></div>`;
      const pos = positionsOf(l, mk);
      const posHtml = `<div class="px-sec"><div class="px-sec-h"><h2>Recent positions</h2></div>${pos.map(p => `<div class="px-pos">${symIcon(p.sym, 28)}<div class="grow"><b>${esc(symLabel(p.sym))}</b> <span class="px-tag ${p.long ? "up" : "dn"}">${mk === "spot" ? (p.long ? "Buy" : "Sell") : (p.long ? "Long" : "Short") + " " + p.lev + "x"}</span><div class="px-mut num">Entry ${symPx(p.sym, p.entry)} · ${dur(Date.now() - p.t)} ago</div></div><b class="num ${cls(p.pct)}" style="font-size:13px">${sgnPct(p.pct)}</b></div>`).join("")}</div>`;
      U.sheet(l.name, `<div id="dbody">${body()}</div>${posHtml}${form}`, el => {
        const q = s => el.querySelector(s);
        const redraw = () => { q("#dbody").innerHTML = body(); q("#dseg").onclick = segClick; };
        const segClick = e => { const b = e.target.closest("[data-p]"); if (b){ dp = +b.dataset.p; redraw(); } };
        q("#dseg").onclick = segClick;
        let mode = "fixed";
        const sync = () => { const inv = parseFloat(q("#inv").value) || 0; if (mode === "fixed"){ q("#mvl").textContent = "Margin per order"; q("#mvu").textContent = "USDT"; } else { q("#mvl").textContent = "Copy ratio"; q("#mvu").textContent = "x"; } };
        q("#cm").onclick = e => { const b = e.target.closest("[data-m]"); if (!b) return; mode = b.dataset.m; q("#cm").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); q("#mv").value = mode === "fixed" ? Math.max(1, Math.round((parseFloat(q("#inv").value) || 100) / 10)) : 1; sync(); };
        q("#pf .px-chips").onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; const v = b.dataset.v === "max" ? Math.floor(bal()) : +b.dataset.v; q("#inv").value = v; if (mode === "fixed") q("#mv").value = Math.max(1, Math.round(v / 10)); q("#mo").value = Math.round(v / 2); };
        q("#inv").oninput = () => { const v = parseFloat(q("#inv").value) || 0; if (mode === "fixed") q("#mv").value = Math.max(1, Math.round(v / 10)); q("#mo").value = Math.round(v / 2); };
        sync();
        if (focus) setTimeout(() => q("#pf")?.scrollIntoView({block:"start"}), 360);
        q("#go").onclick = async () => {
          const inv = parseFloat(q("#inv").value), mv = parseFloat(q("#mv").value), mo = parseFloat(q("#mo").value), sl = q("#sl").value === "" ? 0 : parseFloat(q("#sl").value), tp = q("#tp").value === "" ? 0 : parseFloat(q("#tp").value);
          const err = !(inv >= 10) ? "Minimum investment is 10 USDT." : inv > bal() ? "Insufficient balance." : inv > 100000 ? "Maximum investment is 100,000 USDT." : !(mv > 0) ? "Enter the copy " + (mode === "fixed" ? "amount per order." : "ratio.") : (mode === "fixed" && mv > inv) ? "Per-order amount cannot exceed your investment." : (mode === "ratio" && mv > 10) ? "Maximum copy ratio is 10x." : !(mo > 0) ? "Enter the maximum per order." : (q("#sl").value !== "" && !(sl >= 1 && sl <= 90)) ? "Stop-loss must be between 1% and 90%." : (q("#tp").value !== "" && !(tp >= 1)) ? "Take-profit must be at least 1%." : "";
          q("#fe").textContent = err; if (err) return;
          const ok = await U.confirmTrade({kind:"market", title:"Confirm Copy Trading", okText:"Start Copying", tone:"primary", rows:[
            ["Lead trader", esc(l.name)], ["Market", mk === "spot" ? "Spot" : "Futures"], ["Investment", `${money(inv)} USDT`], ["Copy mode", mode === "fixed" ? `Fixed amount, ${fmt(mv, 2)} USDT` : `Fixed ratio, ${fmt(mv, 2)}x`],
            ["Max per order", `${money(mo)} USDT`], ["Stop-loss", sl ? `-${sl}%` : "Off"], ["Take-profit", tp ? `+${tp}%` : "Off"]]});
          if (!ok) return;
          if (inv > S().balance){ toast("Insufficient balance", "bad"); return; }
          cstate().active.unshift(newCopy(l, {mk, amt:inv, mode, modeVal:mv, maxOrder:mo, sl, tp}));
          store.setBalance(S().balance - inv, "copy"); store.save();
          store.notify("Copy trading started", `Copying ${l.name} with ${money(inv)} USDT`, "ok"); U.fx("open"); toast("Copy trading started", "ok");
          tab = "my"; show();
        };
      });
    }
    $("#ctabs").onclick = e => { const b = e.target.closest("[data-t]"); if (b){ tab = b.dataset.t; show(); } };
    show();
    const check = () => { cstate().active.slice().forEach(c => { const p = copyPct(c); if (c.sl && p <= -c.sl){ stopCopy(c, "Stop-loss"); toast(`${c.name}: stop-loss reached`, "bad"); } else if (c.tp && p >= c.tp){ stopCopy(c, "Take-profit"); toast(`${c.name}: take-profit reached`, "ok"); } }); };
    check();
    const iv = setInterval(() => { if (!r.isConnected) return; check(); if (tab === "my" && !document.querySelector("#sheet.show")){ tabs(); renderMy(); } }, 3000);
    this.unmount = () => clearInterval(iv);
  }};
};
})();
