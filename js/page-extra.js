/* ===== Rewards Hub, Academy, Price Alerts (Pages.assets / Pages.deposit live in page-x2.js) ===== */
(function(){
const C = window.CONFIG, {esc, ic, store, bus, money, signed, toast, spark, fmt} = U;
const S = () => store.s;
const hd = (title, right) => `<header class="px-hd"><button class="icon-btn" data-back aria-label="Back">${ic("back",20)}</button><h1>${esc(title)}</h1>${right || `<span style="width:40px"></span>`}</header>`;
const empty = (icon, text) => `<div class="px-empty">${ic(icon,28,1.5)}<p>${esc(text)}</p></div>`;

/* ---------- Rewards Hub ---------- */
const BADGE_IC = {first:"rocket", win3:"trophy", futures:"zap", tpsl:"shield", ind:"chart", alert:"ring", bot:"bot", streak:"flame"};
function taskProg(k){
  const s = S(), lessons = Object.keys(s.rewards.used).filter(x => x.startsWith("lesson:")).length;
  if (k === "win3") return [Math.min(3, s.history.filter(x => x.result === "win").length), 3];
  if (k === "ind") return [Math.min(3, (s.settings.inds || []).length), 3];
  if (k === "learn") return [Math.min(2, lessons), 2];
  return [E.taskDone(k) ? 1 : 0, 1];
}
Pages.rewards = () => {
  const html = `<div class="px-page">${hd("Rewards Hub")}
    <div class="px-lv"><div class="a">Your level</div><div class="b" id="lv"></div><div class="px-bar"><i id="xpb"></i></div><div class="c" id="xpl"></div></div>
    <div class="px-sec"><div class="px-sec-h"><h2>Daily check-in</h2><span class="px-mut" id="stk"></span></div><div class="px-strip" id="days"></div><button class="px-btn br blk" id="ci" style="margin-top:12px"></button></div>
    <div class="px-sec"><div class="px-sec-h"><h2>Tasks</h2><span class="px-mut" id="tcnt"></span></div><div id="tasks"></div></div>
    <div class="px-sec"><div class="px-sec-h"><h2>Badges</h2></div><div class="px-badges" id="bdg"></div></div></div>`;
  return {html, title:"Rewards Hub", mount(r){
    const $ = q => r.querySelector(q);
    const render = () => {
      const lv = E.level(), s = S(), st = E.streak(), done = s.rewards.checkins.includes(E.dayKey());
      $("#lv").textContent = "Lv." + lv.lvl + " Trader"; $("#xpb").style.width = (lv.cur/lv.need*100) + "%"; $("#xpl").textContent = `${lv.cur} / ${lv.need} XP to Lv.${lv.lvl+1}`;
      $("#stk").textContent = `${st}-day streak`;
      const pos = done ? (st - 1) % 7 : st % 7;
      $("#days").innerHTML = E.CHECKIN.map((a,i) => { const d = i < pos || (done && i === pos);
        return `<div class="${d ? "done" : ""} ${i === pos && !done ? "now" : ""}"><span>${d ? ic("check",14,2.6) : "D" + (i+1)}</span><b class="num">+${a}</b></div>`; }).join("");
      const ci = $("#ci"); ci.disabled = done; ci.textContent = done ? "Checked in today" : `Check in  +${E.CHECKIN[st % 7]} USDT`;
      const cl = E.TASKS.filter(t => s.rewards.claimed[t.k]).length; $("#tcnt").textContent = `${cl}/${E.TASKS.length} claimed`;
      $("#bdg").innerHTML = E.BADGES.map(b => `<div class="${E.taskDone(b.k) ? "got" : ""}"><span>${ic(BADGE_IC[b.k] || "award",18)}</span>${esc(b.n)}</div>`).join("");
      $("#tasks").innerHTML = E.TASKS.map(tk => { const ok = E.taskDone(tk.k), c = s.rewards.claimed[tk.k], [p, n] = taskProg(tk.k);
        return `<div class="px-task"><span class="px-ico ${c ? "g" : ok ? "" : "n"}">${ic(c ? "check" : "target",16)}</span><div class="grow"><b style="font-size:14px;font-weight:600">${esc(tk.n)}</b><div class="px-mut">+${tk.reward} USDT, +${tk.xp} XP</div>${n > 1 && !c ? `<div class="px-bar"><i style="width:${p/n*100}%"></i></div>` : ""}</div>
          ${c ? `<span class="px-tag up">Claimed</span>` : ok ? `<button class="px-btn br sm" data-cl="${tk.k}">Claim</button>` : `<span class="px-mut num">${p}/${n}</span>`}</div>`; }).join("");
    };
    render();
    $("#ci").onclick = () => { const x = E.checkIn(); if (x){ toast(`Day ${x.day} check-in: +${x.amt} USDT`, "ok"); U.fx("claim"); render(); } };
    $("#tasks").addEventListener("click", e => { const b = e.target.closest("[data-cl]"); if (!b) return; const tk = E.claim(b.dataset.cl); if (tk){ toast(`Claimed +${tk.reward} USDT, +${tk.xp} XP`, "ok"); U.fx("claim"); render(); } });
    this.unmount = bus.on("rewards", render);
  }};
};

/* ---------- Academy ---------- */
const thumb = (kind) => {
  const c = {up:"#12B886", dn:"#F0435A", y:"#2E6BFF", b:"#5AA9FF", p:"#5AA9FF"};
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
  const html = `<div class="px-page">${hd("Academy")}
    <div class="px-sec" style="padding-top:8px"><div class="px-sec-h"><h2>Your progress</h2><span class="px-mut" id="apl"></span></div><div class="px-bar"><i id="ap"></i></div><p class="px-t2" style="margin-top:8px">Short lessons with a quiz. Earn 25 XP for each correct answer.</p></div>
    <div id="ll"></div></div>`;
  const LV = {Beginner:"br", Intermediate:"", Advanced:"dn", "All levels":"up"};
  return {html, title:"Academy", mount(r){
    const read = k => !!S().rewards.used["lesson:" + k];
    const render = () => {
      const n = LESSONS.filter(l => read(l.k)).length;
      r.querySelector("#ap").style.width = (n/LESSONS.length*100) + "%"; r.querySelector("#apl").textContent = `${n} of ${LESSONS.length} completed`;
      r.querySelector("#ll").innerHTML = LESSONS.map(l => `<button class="px-les" data-l="${l.k}"><span class="th">${thumb(l.k)}</span><div class="grow"><b>${esc(l.t)}</b><div class="px-mut"><span class="px-tag ${LV[l.lvl] || ""}">${l.lvl}</span> &nbsp;${2 + l.body.length - 1} min read</div></div>${read(l.k) ? `<span class="up">${ic("check",18)}</span>` : `<span style="color:var(--muted)">${ic("chev",16)}</span>`}</button>`).join("");
    };
    render();
    r.querySelector("#ll").addEventListener("click", e => {
      const b = e.target.closest("[data-l]"); if (!b) return; const l = LESSONS.find(x => x.k === b.dataset.l);
      U.sheet(l.t, `<div style="display:grid;place-items:center;background:var(--card-2);border-radius:12px;padding:12px;margin-bottom:12px">${thumb(l.k).replace('width="64" height="48"','width="160" height="120"')}</div>
        ${l.body.map(p => `<p class="px-t2" style="font-size:14px;line-height:1.6;margin-bottom:10px;color:var(--text-2)">${p}</p>`).join("")}
        <div class="px-sec" style="border:0;padding-bottom:0"><div class="px-sec-h" style="margin-bottom:2px"><h2>Quick quiz</h2></div><p style="font-size:13px;color:var(--text-2)">${l.q[0]}</p><div class="px-quiz" id="qz">${l.q[1].map((o,i) => `<button data-a="${i}">${o}</button>`).join("")}</div></div>`, el => {
        el.querySelector("#qz").addEventListener("click", ev => {
          const a = ev.target.closest("[data-a]"); if (!a) return;
          if (+a.dataset.a === l.q[2]){
            a.classList.add("ok"); U.fx("win");
            if (!read(l.k)){ S().rewards.used["lesson:" + l.k] = Date.now(); S().rewards.xp += 25; store.save(); bus.emit("rewards"); toast("Correct! +25 XP", "ok"); }
            else toast("Correct!", "ok");
            render();
          } else { a.classList.add("no"); U.fx("loss"); toast("Not quite, try again", "bad"); }
        });
      });
    });
  }};
};

/* ---------- Price alerts ---------- */
Pages.alerts = () => {
  const html = `<div class="px-page">${hd("Price Alerts", `<button class="icon-btn" id="anew" aria-label="New alert" style="color:var(--brand)">${ic("plus",20,2.2)}</button>`)}
    <div class="px-sec" style="padding-top:4px"><div class="px-sec-h"><h2>Active</h2><span class="px-mut" id="acnt"></span></div><div id="al"></div></div>
    <div class="px-sec" id="hist-s"><div class="px-sec-h"><h2>Triggered</h2></div><div id="alh"></div></div></div>`;
  return {html, title:"Price Alerts", mount(r){
    const $ = q => r.querySelector(q);
    const item = x => { const p = M.get(x.sym), up = x.price >= (x.last || (p?.price || 0));
      return `<div class="px-al">${UI.pairIcon(p, 32)}<div class="grow"><b style="font-size:14px;font-weight:600">${esc(p ? M.label(p) : x.sym)}</b><div class="cond num">${x.done ? "Hit " + M.fmtPx(p || {dp:2}, x.price) + " on " + U.dateStr(x.hit) : `Price ${up ? "rises to" : "falls to"} ${M.fmtPx(p || {dp:2}, x.price)} · now ${M.fmtPx(p)}`}</div></div>${x.done ? `<span class="px-tag">Done</span>` : ""}<button class="del" data-del="${x.id}" aria-label="Delete alert">${ic("trash",16)}</button></div>`; };
    const render = () => {
      const a = S().alerts, act = a.filter(x => !x.done), dn = a.filter(x => x.done);
      $("#acnt").textContent = act.length + "/30";
      $("#al").innerHTML = act.length ? act.map(item).join("") : `${empty("ring","No active alerts")}<button class="px-btn br blk" data-new>Create alert</button>`;
      $("#hist-s").classList.toggle("hide", !dn.length); $("#alh").innerHTML = dn.slice(0, 20).map(item).join("");
      r.querySelectorAll("[data-new]").forEach(b => b.onclick = create);
    };
    function create(){
      const opts = [...M.pairs.values()].sort((a,b) => (a.rank||500) - (b.rank||500)).slice(0,120);
      U.sheet("New price alert", `<div class="px-fld"><label><span>Market</span><span id="acur"></span></label><select class="px-sel" id="as">${opts.map(p => `<option value="${p.sym}">${esc(M.label(p))}</option>`).join("")}</select></div>
        <div class="px-fld"><label><span>Alert price</span></label><div class="px-inp" id="apf"><input id="apx" type="number" inputmode="decimal"><span>USDT</span></div></div>
        <div class="px-chips" style="margin-bottom:14px">${[-5,-1,1,5].map(v => `<button data-pc="${v}">${v > 0 ? "+" : ""}${v}%</button>`).join("")}</div><div class="px-err" id="ae"></div>
        <button class="px-btn pri blk lg" id="aadd">Create alert</button>`, el => {
        const q = s => el.querySelector(s);
        const cur = () => { const p = M.get(q("#as").value); q("#acur").textContent = "Last " + M.fmtPx(p); if (!q("#apx").value && p?.price) q("#apx").value = +(p.price*1.01).toFixed(p.dp); };
        const last = sessionStorage.getItem("lastSym_binary"); if (last && opts.some(p => p.sym === last)) q("#as").value = last;
        cur();
        q("#as").onchange = () => { q("#apx").value = ""; cur(); };
        q("[data-pc]").parentNode.onclick = e => { const b = e.target.closest("[data-pc]"); const p = M.get(q("#as").value); if (b && p?.price) q("#apx").value = +(p.price * (1 + +b.dataset.pc / 100)).toFixed(p.dp); };
        q("#aadd").onclick = () => { const v = parseFloat(q("#apx").value), sym = q("#as").value, p = M.get(sym);
          const err = !(v > 0) ? "Enter a valid price." : S().alerts.filter(x => !x.done).length >= 30 ? "Maximum 30 active alerts." : "";
          q("#ae").textContent = err; q("#apf").classList.toggle("err", !!err); if (err) return;
          S().alerts.unshift({id:U.uid(), sym, price:v, t:Date.now(), last:p.price}); store.save(); E.award("alert"); U.closeLayer(); render(); toast(`Alert set for ${M.label(p)} at ${M.fmtPx(p, v)}`, "ok"); };
      });
    }
    $("#anew").onclick = create;
    render();
    r.addEventListener("click", e => { const b = e.target.closest("[data-del]"); if (!b) return; S().alerts = S().alerts.filter(x => x.id !== b.dataset.del); store.save(); render(); toast("Alert deleted", "ok"); });
    const iv = setInterval(render, 4000), off = bus.on("alerts", render);
    this.unmount = () => { clearInterval(iv); off(); };
  }};
};
})();
