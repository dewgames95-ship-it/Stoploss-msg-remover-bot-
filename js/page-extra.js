/* ===== Assets, Rewards, Academy, Alerts ===== */
(function(){
const C = window.CONFIG, {esc, ic, store, bus, money, signed, toast, spark, fmt} = U;
const S = () => store.s;
const wrap = (title, body, opts) => UI.pageHead(title, opts) + body + UI.footer();

/* ---------- Assets ---------- */
Pages.assets = () => {
  const html = `<header class="page-head"><h1 class="h1">Assets</h1><a class="icon-btn" href="#/profile" aria-label="Profile">${ic("user",20)}</a></header>
  <div class="two-col"><div class="stack">
    <section class="card"><div class="row label">Est. Total Value <button class="eye" data-eye aria-label="Hide balance">${ic("eye",14)}</button></div>
      <div class="bal num" id="at"></div><div class="row label" style="gap:6px">Today's PnL <b class="num" id="atp"></b></div>
      <div class="row" style="margin-top:14px"><a class="btn btn-primary grow" href="#/deposit">Deposit</a><a class="btn btn-ghost grow" href="#/withdraw">Withdraw</a><a class="btn btn-ghost grow" href="#/withdraw">Transfer</a></div></section>
    <section class="card"><div class="title" style="margin-bottom:10px">Allocation</div><div class="row" style="gap:18px"><div id="donut"></div><div class="legend-l grow" id="lgd"></div></div></section>
    <section class="card"><div class="row between"><span class="title">Balance history</span><span class="label">Last ${Math.min(120, S().balHist.length)} changes</span></div><div class="spark" id="bh" style="height:90px;margin-top:10px"></div></section>
  </div><div class="stack">
    <section class="card"><div class="title" style="margin-bottom:10px">PnL analysis · 7 days</div><div id="bars"></div><div class="kpis" id="pk" style="margin-top:12px"></div></section>
    <section class="card"><div class="title" style="margin-bottom:4px">Accounts</div><div id="acc"></div></section>
    <section class="card"><div class="row between"><span class="title">Transactions</span><span class="label" id="txc"></span></div><div id="tx"></div></section>
  </div></div>${UI.footer()}`;
  return {html, title:"Assets", mount(r){
    const $ = q => r.querySelector(q);
    const render = () => {
      const s = S(), hide = s.settings.hideBal;
      const bin = s.positions.reduce((a,p) => a + p.amount, 0), fm = s.fut.positions.reduce((a,p) => a + p.margin, 0) + s.fut.orders.reduce((a,o) => a + o.margin, 0);
      const up = s.fut.positions.reduce((a,p) => a + E.futPnl(p).pnl, 0), vault = E.vaultValue(), total = s.balance + bin + fm + up + vault;
      const day0 = new Date().setHours(0,0,0,0), tp = E.stats().todayPnl + s.fut.history.filter(x => x.closed >= day0).reduce((a,x) => a + x.profit, 0);
      $("#at").innerHTML = hide ? "******" : `${money(total)}<small>USDT</small>`;
      const t = $("#atp"); t.textContent = hide ? "****" : signed(tp) + " USDT"; t.className = "num " + (tp >= 0 ? "up" : "down");
      const parts = [["Trading (available)", s.balance, "#2E6BFF"], ["Binary positions", bin, "#5AA9FF"], ["Futures margin + PnL", Math.max(0, fm + up), "#7B61FF"], ["Vault", vault, "#12B886"]];
      const sum = parts.reduce((a,p) => a + p[1], 0) || 1; let acc = 0;
      const R = 46, Cc = 2*Math.PI*R;
      $("#donut").innerHTML = `<svg class="donut" viewBox="0 0 120 120"><circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--input)" stroke-width="14"/>${parts.map(([,v,c]) => { const len = v/sum*Cc, el = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${c}" stroke-width="14" stroke-dasharray="${len} ${Cc-len}" stroke-dashoffset="${-acc}" transform="rotate(-90 60 60)"/>`; acc += len; return el; }).join("")}<text x="60" y="58" text-anchor="middle" font-size="10" fill="var(--muted)">Total</text><text x="60" y="73" text-anchor="middle" font-size="12" font-weight="600" fill="var(--text)">${hide ? "***" : CH.fmtVol(total)}</text></svg>`;
      $("#lgd").innerHTML = parts.map(([n,v,c]) => `<div><i style="background:${c}"></i><span class="grow">${n}</span><b class="num">${hide ? "***" : (v/sum*100).toFixed(1) + "%"}</b></div>`).join("");
      $("#bh").innerHTML = spark([C.START_BALANCE, ...s.balHist.map(x => x.b)].slice(-120), 320, 90);
      // 7-day PnL bars
      const days = [...Array(7)].map((_,i) => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6-i)); return d.getTime(); });
      const all = [...s.history.map(x => ({t:x.closed, p:x.profit})), ...s.fut.history.map(x => ({t:x.closed, p:x.profit}))];
      const vals = days.map((d,i) => all.filter(x => x.t >= d && x.t < (days[i+1] || Infinity)).reduce((a,x) => a + x.p, 0));
      const mx = Math.max(1, ...vals.map(Math.abs));
      $("#bars").innerHTML = `<svg viewBox="0 0 280 110" style="width:100%;height:110px"><line x1="0" x2="280" y1="55" y2="55" stroke="var(--line)"/>${vals.map((v,i) => { const h = Math.abs(v)/mx*48, x = 12 + i*38; return `<rect x="${x}" y="${v>=0?55-h:55}" width="22" height="${Math.max(1,h)}" rx="3" fill="${v>=0?"var(--up)":"var(--down)"}"/><text x="${x+11}" y="108" text-anchor="middle" font-size="9" fill="var(--muted)">${new Date(days[i]).toLocaleDateString([], {weekday:"short"})}</text>`; }).join("")}</svg>`;
      const st = E.stats(), fnet = s.fut.history.reduce((a,x) => a + x.profit, 0);
      $("#pk").innerHTML = `<div class="kpi"><span class="label">7-day PnL</span><b class="num ${vals.reduce((a,b)=>a+b,0)>=0?"up":"down"}">${signed(vals.reduce((a,b)=>a+b,0))}</b></div><div class="kpi"><span class="label">Binary net</span><b class="num ${st.net>=0?"up":"down"}">${signed(st.net)}</b></div><div class="kpi"><span class="label">Futures net</span><b class="num ${fnet>=0?"up":"down"}">${signed(fnet)}</b></div><div class="kpi"><span class="label">Win rate</span><b class="num">${st.winRate.toFixed(1)}%</b></div>`;
      $("#acc").innerHTML = [["wallet","Trading account",s.balance,"#/deposit","ic-y"],["candle","Binary options",bin,"#/trade","ic-b"],["layers","Futures (USDT-M)",fm+up,"#/futures","ic-p"],["vault","Vault · "+Math.round(E.APR*100)+"% APR",vault,"#/withdraw","ic-g"]].map(([i,n,v,h,c]) => `<a class="list-item" href="${h}"><span class="ic ${c}">${ic(i,18)}</span><span class="grow" style="font-weight:500">${n}</span><b class="num">${hide ? "***" : money(v)}</b><span class="chev">${ic("chev",16)}</span></a>`).join("");
      const tx = s.tx.slice(0, 15); $("#txc").textContent = s.tx.length + " total";
      $("#tx").innerHTML = tx.length ? tx.map(x => `<div class="list-item"><span class="ic ${x.kind==="deposit"?"ic-g":"ic-y"}">${ic(x.kind==="deposit"?"deposit":"swap",16)}</span><div class="grow"><b style="font-size:14px">${x.kind==="deposit"?"Deposit":"Transfer"} · ${esc(x.method)}</b><div class="label">${U.dateStr(x.t)}</div></div><b class="num ${x.kind==="deposit"?"up":""}">${x.kind==="deposit"?"+":""}${money(x.amount)}</b></div>`).join("") : UI.emptyState("file","No transactions yet.");
    };
    render();
    $("[data-eye]").onclick = () => { S().settings.hideBal = !S().settings.hideBal; store.save(); render(); };
    const iv = setInterval(render, 3000), offs = [bus.on("balance", render), bus.on("positions", render)];
    this.unmount = () => { clearInterval(iv); offs.forEach(f => f()); };
  }};
};

/* ---------- Rewards Hub ---------- */
Pages.rewards = () => {
  const html = wrap("Rewards Hub", `<div class="two-col"><div class="stack">
    <div class="hero"><svg class="deco" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" fill="rgba(46,107,255,.18)"/><path d="M60 22l11 22 24 4-17 17 4 24-22-11-22 11 4-24-17-17 24-4z" fill="#7B61FF"/></svg>
      <div class="label">Your level</div><div class="h1" id="lv"></div><div class="xp" style="margin:10px 0 6px;max-width:220px"><i id="xpb"></i></div><div class="label" id="xpl"></div></div>
    <section class="card"><div class="row between" style="margin-bottom:10px"><span class="title">Daily check-in</span><span class="label" id="stk"></span></div><div class="days" id="days"></div><button class="btn btn-primary btn-block" id="ci" style="margin-top:12px"></button></section>
    <section class="card"><div class="title" style="margin-bottom:10px">Badges</div><div class="badges" id="bdg"></div></section>
  </div>
  <section class="card"><div class="title" style="margin-bottom:4px">Tasks</div><div id="tasks"></div></section></div>`);
  return {html, title:"Rewards Hub", mount(r){
    const $ = q => r.querySelector(q);
    const render = () => {
      const lv = E.level(), s = S(), st = E.streak(), done = s.rewards.checkins.includes(E.dayKey());
      $("#lv").textContent = "Lv." + lv.lvl + " Trader"; $("#xpb").style.width = (lv.cur/lv.need*100) + "%"; $("#xpl").textContent = `${lv.cur} / ${lv.need} XP to Lv.${lv.lvl+1} · ${lv.xp} XP total`;
      $("#stk").textContent = `🔥 ${st}-day streak`;
      const pos = done ? (st - 1) % 7 : st % 7;
      $("#days").innerHTML = E.CHECKIN.map((a,i) => `<div class="day ${i < pos || (done && i === pos) ? "done" : ""} ${i === pos ? "today" : ""}">Day ${i+1}<b>+${a}</b>${i < pos || (done && i === pos) ? "✓" : i === 6 ? "🎁" : "USDT"}</div>`).join("");
      const ci = $("#ci"); ci.disabled = done; ci.textContent = done ? "Checked in today ✓" : `Check in · +${E.CHECKIN[st % 7]} USDT`;
      $("#bdg").innerHTML = E.BADGES.map(b => `<div class="badge ${E.taskDone(b.k) ? "got" : ""}"><span>${b.e}</span>${b.n}</div>`).join("");
      $("#tasks").innerHTML = E.TASKS.map(tk => { const ok = E.taskDone(tk.k), cl = s.rewards.claimed[tk.k];
        return `<div class="list-item"><span class="ic ${cl ? "ic-g" : ok ? "ic-y" : ""}">${ic(cl ? "check" : "target",16)}</span><div class="grow"><b style="font-size:14px">${tk.n}</b><div class="label">+${tk.reward} USDT · +${tk.xp} XP</div></div>
          ${cl ? `<span class="pill-s run">Claimed</span>` : ok ? `<button class="btn btn-primary btn-sm" data-cl="${tk.k}">Claim</button>` : `<span class="pill-s stop">To do</span>`}</div>`; }).join("");
    };
    render();
    $("#ci").onclick = () => { const x = E.checkIn(); if (x){ toast(`Day ${x.day} check-in: +${x.amt} USDT`, "ok"); U.beep("claim"); U.confetti(); render(); } };
    $("#tasks").addEventListener("click", e => { const b = e.target.closest("[data-cl]"); if (!b) return; const tk = E.claim(b.dataset.cl); if (tk){ toast(`Claimed +${tk.reward} USDT · +${tk.xp} XP`, "ok"); U.beep("claim"); U.confetti(); render(); } });
    this.unmount = bus.on("rewards", render);
  }};
};

/* ---------- Academy ---------- */
const thumb = (kind) => {
  const c = {up:"#12B886", dn:"#F0435A", y:"#2E6BFF", b:"#5AA9FF", p:"#7B61FF"};
  const candles = `<g>${[[8,22,14,c.up],[18,18,12,c.dn],[28,14,16,c.up],[38,20,10,c.dn],[48,10,18,c.up]].map(([x,y,h,col]) => `<line x1="${x+3}" x2="${x+3}" y1="${y-4}" y2="${y+h+4}" stroke="${col}"/><rect x="${x}" y="${y}" width="6" height="${h}" rx="1" fill="${col}"/>`).join("")}</g>`;
  const m = {
    binary:`<path d="M6 30l10-6 8 4 10-12 10 6 10-10" stroke="${c.y}" stroke-width="2" fill="none"/><path d="M32 6v36" stroke="${c.y}" stroke-dasharray="3 2"/><text x="44" y="12" font-size="8" fill="${c.up}">▲</text><text x="44" y="40" font-size="8" fill="${c.dn}">▼</text>`,
    candles, ema:`${candles}<path d="M4 34 C20 30 30 22 60 14" stroke="${c.y}" stroke-width="1.5" fill="none"/><path d="M4 30 C20 32 34 26 60 22" stroke="${c.p}" stroke-width="1.5" fill="none"/>`,
    boll:`<path d="M4 14 C20 8 40 10 60 6" stroke="${c.b}" fill="none"/><path d="M4 26 C20 22 40 24 60 18" stroke="${c.y}" stroke-dasharray="2 2" fill="none"/><path d="M4 38 C20 34 40 38 60 30" stroke="${c.b}" fill="none"/>${candles}`,
    super:`${candles}<path d="M4 40 L24 38 L24 36 L44 32" stroke="${c.up}" stroke-width="2" fill="none"/><path d="M44 8 L60 10" stroke="${c.dn}" stroke-width="2" fill="none"/>`,
    rsi:`<rect x="4" y="8" width="56" height="10" fill="rgba(240,67,90,.15)"/><rect x="4" y="30" width="56" height="10" fill="rgba(14,203,129,.15)"/><path d="M4 26 L14 14 L24 22 L34 34 L44 20 L60 12" stroke="${c.p}" stroke-width="2" fill="none"/>`,
    macd:`${[8,14,20,26,32,38,44,50,56].map((x,i) => { const v = [4,7,9,6,2,-3,-6,-4,-1][i]; return `<rect x="${x-2}" y="${v>=0?24-v:24}" width="4" height="${Math.abs(v)}" fill="${v>=0?c.up:c.dn}"/>`; }).join("")}<path d="M4 18 C20 10 34 26 60 28" stroke="${c.b}" fill="none"/><path d="M4 22 C20 14 34 22 60 30" stroke="${c.y}" fill="none"/>`,
    lev:`<text x="32" y="30" text-anchor="middle" font-size="18" font-weight="700" fill="${c.y}">50x</text><path d="M6 40h52" stroke="#F7931A" stroke-dasharray="3 2"/>`,
    risk:`<path d="M32 6 L54 14 V26 C54 36 32 44 32 44 C32 44 10 36 10 26 V14 Z" fill="rgba(46,107,255,.2)" stroke="${c.y}" stroke-width="2"/><path d="M24 25l6 6 10-12" stroke="${c.up}" stroke-width="2.5" fill="none"/>`
  };
  return `<svg viewBox="0 0 64 48" width="64" height="48" aria-hidden="true">${m[kind]}</svg>`;
};
const LESSONS = [
  {k:"binary", t:"Binary options in 3 minutes", lvl:"Beginner", body:["A binary option asks one question: will the price be higher or lower when the timer ends?","Pick an amount, choose an expiry (30s, 1m or 5m) and tap Up or Down. If you are right you receive 1.92× your stake (+92% profit). If you are wrong the stake is lost. Equal price = refund.","Tip: short expiries are noisy. Use the Tick chart for 30s trades and 1m candles for 5m trades."], q:["You stake 10 USDT and win. How much is credited?",["19.20 USDT","10.92 USDT","20 USDT"],0]},
  {k:"candles", t:"Reading candlesticks", lvl:"Beginner", body:["Each candle shows Open, High, Low and Close for one time period. Green = closed higher than it opened; red = closed lower.","The body is the open–close range, the wicks show the extremes. Long wicks mean rejection; tiny bodies (doji) mean indecision.","Long-press any candle on the chart to see its full details."], q:["A candle with a tiny body and long wicks usually means…",["Indecision","Strong trend","High volume"],0]},
  {k:"ema", t:"EMA: trend at a glance", lvl:"Beginner", body:["The Exponential Moving Average weights recent prices more. EMA 7 reacts fast, EMA 25 is medium and EMA 99 is the long trend.","Price above a rising EMA 25 = uptrend. A fast EMA crossing above a slow one (golden cross) signals strengthening momentum."], q:["EMA 7 crosses above EMA 25. This suggests…",["Bullish momentum","Bearish momentum","Nothing"],0]},
  {k:"boll", t:"Bollinger Bands & volatility", lvl:"Intermediate", body:["Bollinger Bands plot ±2 standard deviations around a 20-period average.","When bands squeeze, volatility is low and a breakout often follows. Touching a band is not a signal on its own — combine with RSI or volume."], q:["Narrow (squeezed) bands usually come before…",["A big move","A market close","Lower spreads"],0]},
  {k:"super", t:"SuperTrend strategy", lvl:"Intermediate", body:["SuperTrend uses ATR to draw a trailing trend line. Green below price = uptrend, red above price = downtrend.","A flip from red to green is a classic long signal; use the line itself as a stop-loss level in Futures."], q:["SuperTrend line turns green below price. Trend is…",["Up","Down","Sideways"],0]},
  {k:"rsi", t:"RSI: overbought & oversold", lvl:"Intermediate", body:["RSI measures momentum from 0 to 100. Above 70 is overbought, below 30 is oversold.","In strong trends RSI can stay overbought for long. Look for divergence: price makes a new high but RSI does not."], q:["RSI at 24 is considered…",["Oversold","Overbought","Neutral"],0]},
  {k:"macd", t:"MACD momentum", lvl:"Advanced", body:["MACD = EMA 12 − EMA 26, with a 9-period signal line. The histogram shows their difference.","Histogram crossing above zero = momentum turning bullish. Works best on 5m+ timeframes."], q:["MACD histogram turns positive. Momentum is…",["Turning bullish","Turning bearish","Unchanged"],0]},
  {k:"lev", t:"Leverage & liquidation", lvl:"Advanced", body:["Leverage multiplies both profit and loss. At 50x a 2% move against you wipes the margin.","Liquidation price ≈ entry × (1 − 1/leverage) for longs. Always check the Est. liq. price before opening."], q:["Higher leverage moves the liquidation price…",["Closer to entry","Further from entry","Nowhere"],0]},
  {k:"risk", t:"Risk management rules", lvl:"All levels", body:["Risk 1–2% of your balance per trade. Always use a stop loss on Futures.","Don't chase losses. Keep a journal: your Assets page shows 7-day PnL and win rate to review your edge."], q:["A sensible risk per trade is…",["1–2% of balance","25% of balance","All-in"],0]}
];
Pages.academy = () => {
  const html = wrap("Academy", `<div class="hero" style="margin-bottom:12px"><svg class="deco" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" fill="rgba(155,107,255,.2)"/><path d="M30 50l30-14 30 14-30 14z" fill="#7B61FF"/><path d="M42 56v14c0 6 36 6 36 0V56" fill="none" stroke="#7B61FF" stroke-width="4"/></svg>
    <div class="title">Learn to trade like a pro</div><div class="sub" style="margin:4px 0 10px">Short lessons with a quiz. Earn XP for each one.</div><div class="xp" style="max-width:220px"><i id="ap"></i></div><div class="label" id="apl" style="margin-top:6px"></div></div>
    <section class="card"><div id="ll"></div></section>`);
  return {html, title:"Academy", mount(r){
    const read = k => !!S().rewards.used["lesson:" + k];
    const render = () => {
      const n = LESSONS.filter(l => read(l.k)).length;
      r.querySelector("#ap").style.width = (n/LESSONS.length*100) + "%"; r.querySelector("#apl").textContent = `${n} of ${LESSONS.length} lessons completed`;
      r.querySelector("#ll").innerHTML = LESSONS.map(l => `<button class="lesson" data-l="${l.k}"><span class="th">${thumb(l.k)}</span><div class="grow"><b style="font-size:14px">${l.t}</b><div class="label">${l.lvl} · 2 min read</div></div>${read(l.k) ? `<span class="up">${ic("check",18)}</span>` : `<span class="chev">${ic("chev",16)}</span>`}</button>`).join("");
    };
    render();
    r.querySelector("#ll").addEventListener("click", e => {
      const b = e.target.closest("[data-l]"); if (!b) return; const l = LESSONS.find(x => x.k === b.dataset.l);
      U.sheet(l.t, `<div style="display:grid;place-items:center;background:var(--card-2);border-radius:12px;padding:16px;margin-bottom:12px">${thumb(l.k).replace('width="64" height="48"','width="192" height="144"')}</div>
        ${l.body.map(p => `<p class="sub" style="margin-bottom:10px;font-size:14px">${p}</p>`).join("")}
        <div class="card" style="background:var(--card-2);margin-top:8px"><b style="font-size:14px">Quick quiz</b><p class="sub" style="margin:6px 0 10px;font-size:13px">${l.q[0]}</p><div class="stack" id="qz">${l.q[1].map((o,i) => `<button class="btn btn-ghost btn-block" data-a="${i}" style="justify-content:flex-start;background:var(--card)">${o}</button>`).join("")}</div></div>`, el => {
        el.querySelector("#qz").addEventListener("click", ev => {
          const a = ev.target.closest("[data-a]"); if (!a) return;
          if (+a.dataset.a === l.q[2]){
            a.style.background = "var(--up)"; a.style.color = "#fff"; U.beep("win");
            if (!read(l.k)){ S().rewards.used["lesson:" + l.k] = Date.now(); S().rewards.xp += 25; store.save(); bus.emit("rewards"); toast("Correct! +25 XP", "ok"); }
            else toast("Correct!", "ok");
            render();
          } else { a.style.background = "var(--down)"; a.style.color = "#fff"; U.beep("loss"); U.buzz(80); toast("Not quite — try again", "bad"); }
        });
      });
    });
  }};
};

/* ---------- Price alerts ---------- */
Pages.alerts = () => {
  const html = wrap("Price Alerts", `<section class="card" style="margin-bottom:12px"><div class="title" style="margin-bottom:10px">New alert</div>
      <div class="form-row"><label for="as">Market</label><div class="field"><select id="as">${[...M.pairs.values()].sort((a,b) => (a.rank||500) - (b.rank||500)).slice(0,120).map(p => `<option value="${p.sym}">${esc(M.label(p))}</option>`).join("")}</select></div><div class="label" id="acur" style="margin-top:6px"></div></div>
      <div class="form-row"><label for="apx">Alert price</label><div class="field" id="apf"><input id="apx" type="number" inputmode="decimal"></div><div class="err-msg" id="ae"></div></div>
      <button class="btn btn-primary btn-block" id="aadd">${ic("ring",16)} Create alert</button></section>
    <section class="card"><div class="row between"><span class="title">Your alerts</span><span class="label" id="acnt"></span></div><div id="al"></div></section>`);
  return {html, title:"Price Alerts", mount(r){
    const $ = q => r.querySelector(q);
    const cur = () => { const p = M.get($("#as").value); $("#acur").textContent = "Current price: " + M.fmtPx(p); if (!$("#apx").value && p?.price) $("#apx").value = +(p.price*1.01).toFixed(p.dp); };
    const render = () => {
      const a = S().alerts; $("#acnt").textContent = a.filter(x => !x.done).length + " active";
      $("#al").innerHTML = a.length ? a.map(x => { const p = M.get(x.sym); return `<div class="list-item">${UI.pairIcon(p,28)}<div class="grow"><b style="font-size:14px">${esc(p ? M.label(p) : x.sym)}</b><div class="label">${x.done ? "Triggered " + U.dateStr(x.hit) : "Notify at " + M.fmtPx(p || {dp:2}, x.price) + " · now " + M.fmtPx(p)}</div></div><span class="pill-s ${x.done?"stop":"run"}">${x.done?"Done":"Active"}</span><button class="icon-btn" data-del="${x.id}" aria-label="Delete alert">${ic("trash",16)}</button></div>`; }).join("") : UI.emptyState("ring","No alerts yet. Create one above or tap the bell on any chart.");
    };
    if (sessionStorage.getItem("lastSym_binary")) $("#as").value = sessionStorage.getItem("lastSym_binary");
    cur(); render();
    $("#as").onchange = () => { $("#apx").value = ""; cur(); };
    $("#aadd").onclick = () => { const v = parseFloat($("#apx").value), sym = $("#as").value, p = M.get(sym);
      const err = !(v > 0) ? "Enter a valid price." : S().alerts.filter(x => !x.done).length >= 30 ? "Maximum 30 active alerts." : "";
      $("#ae").textContent = err; $("#apf").classList.toggle("err", !!err); if (err) return toast(err, "bad");
      S().alerts.unshift({id:U.uid(), sym, price:v, t:Date.now(), last:p.price}); store.save(); E.award("alert"); render(); toast(`Alert set for ${M.label(p)} at ${M.fmtPx(p, v)}`, "ok"); $("#apx").value = ""; cur(); };
    $("#al").addEventListener("click", e => { const b = e.target.closest("[data-del]"); if (!b) return; S().alerts = S().alerts.filter(x => x.id !== b.dataset.del); store.save(); render(); toast("Alert deleted", "ok"); });
    const iv = setInterval(render, 4000), off = bus.on("alerts", render);
    this.unmount = () => { clearInterval(iv); off(); };
  }};
};
})();
