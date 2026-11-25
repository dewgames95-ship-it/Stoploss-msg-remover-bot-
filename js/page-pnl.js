/* ===== PnL Analysis (#/pnl, #/pnl/7d|30d|90d|all) ===== */
(function(){
const {esc, ic, store, money, signed, fmt, toast} = U;
const S = () => store.s, DAY = 864e5, C = window.CONFIG;
const PERIODS = [["7d","7D",7],["30d","30D",30],["90d","90D",90],["all","All",0]];
const PRODS = [["fut","Futures","candle"],["bin","Binary","clock"],["opt","Options","layers"],["spot","Spot","swap"],["copy","Copy","users"],["bot","Bots","bot"]];
const PN = Object.fromEntries(PRODS.map(p => [p[0], p[1]]));
const sod = t => { const d = new Date(t); d.setHours(0,0,0,0); return d.getTime(); };
const dkey = t => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); };
const cls = v => v > 0 ? "up" : v < 0 ? "down" : "";
const sym2 = s => { try { const p = M.get(s); return p ? M.label(p) : s; } catch { return s; } };

/* realized spot PnL: replay history oldest-first with average cost */
function spotTrades(){
  const h = (S().spot && S().spot.history || []).slice().reverse(), pos = {}, out = [];
  let fees = 0, n = h.length;
  h.forEach(x => {
    const coin = x.sym.replace(/USDT$/, ""), p = pos[coin] ||= {q:0, c:0}; fees += x.fee || 0;
    if (x.side === "buy"){ p.q += x.qty * .999; p.c += x.qty * x.price; }
    else { const ac = p.q > 0 ? p.c / p.q : x.price, pnl = x.qty * x.price * .999 - ac * x.qty;
      p.c = Math.max(0, p.c - ac * x.qty); p.q = Math.max(0, p.q - x.qty);
      out.push({prod:"spot", sym:x.sym.replace("USDT","/USDT"), t:x.ts, pnl, inv:ac * x.qty}); }
  });
  return {trades: out, fees, count: n};
}
function allTrades(){
  const s = S(), T = [];
  (s.history || []).forEach(x => { if (x.closed) T.push({prod:"bin", sym:sym2(x.sym), t:x.closed, pnl:+x.profit || 0, inv:x.amount || 0}); });
  ((s.fut || {}).history || []).forEach(x => T.push({prod:"fut", sym:sym2(x.sym) + " " + (x.side === "long" ? "Long" : "Short"), t:x.closed, pnl:+x.profit || 0, inv:x.margin || 0}));
  ((s.opt || {}).history || []).forEach(x => T.push({prod:"opt", sym:(x.base || "") + " " + (x.type || "") + (x.strike ? " " + x.strike : ""), t:x.closed, pnl:+x.pnl || 0, inv:x.cost || 0}));
  const sp = spotTrades(); sp.trades.forEach(x => T.push(x));
  ((s.copies || {}).history || []).forEach(x => T.push({prod:"copy", sym:x.name || "Copy trader", t:x.end, pnl:+x.pnl || 0, inv:x.amt || 0}));
  Object.entries(s.bots || {}).forEach(([id, b]) => { if (b && !b.running && b.stopped){ T.push({prod:"bot", sym:(window.E && E.BOTS ? (E.BOTS.find(d => d.id === id) || {}).name : 0) || id + " bot", t:b.stopped, pnl:+b.pnl || 0, inv:b.invest || 0}); } });
  return {T: T.filter(x => x.t).sort((a, b) => b.t - a.t), spot: sp};
}

/* ---------- SVG charts ---------- */
function niceTicks(lo, hi, n){ if (hi - lo < 1e-9){ hi += 1; lo -= 1; } const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag, st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, a = Math.floor(lo / st) * st, r = []; for (let v = a; v <= hi + st * .5; v += st) r.push(+v.toFixed(8)); return r; }
const ax = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(Math.round(v * 100) / 100);
const lbl = t => new Date(t).toLocaleDateString("en-US", {month:"short", day:"numeric"});
function chartFrame(days, vals, W, H, kind){
  const L = 38, R = 8, T = 10, B = 22, w = W - L - R, h = H - T - B;
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const ticks = niceTicks(lo, hi, 4); lo = ticks[0]; hi = ticks[ticks.length - 1];
  const y = v => T + h - (v - lo) / (hi - lo) * h, n = days.length;
  let g = "";
  ticks.forEach(v => { g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="pn-g${v === 0 ? " z" : ""}"/><text x="${L - 5}" y="${y(v) + 3.5}" text-anchor="end" class="pn-ax">${ax(v)}</text>`; });
  const step = Math.max(1, Math.ceil(n / 5));
  const x = kind === "bar" ? i => L + w * (i + .5) / n : i => L + (n > 1 ? w * i / (n - 1) : w / 2);
  for (let i = 0; i < n; i += step) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="pn-ax">${lbl(days[i])}</text>`;
  return {g, x, y, L, R, T, B, w, h, n};
}
function barChart(days, vals){
  const W = 340, H = 190, f = chartFrame(days, vals, W, H, "bar"), bw = Math.max(1.5, Math.min(18, f.w / f.n * .66));
  let bars = "";
  vals.forEach((v, i) => { const y0 = f.y(0), y1 = f.y(v), hh = Math.max(Math.abs(y1 - y0), v ? 1.5 : 0);
    bars += `<rect x="${f.x(i) - bw / 2}" y="${Math.min(y0, y1)}" width="${bw}" height="${hh}" rx="1.5" class="pn-b ${v >= 0 ? "u" : "d"}"/>`;
    bars += `<rect x="${f.x(i) - f.w / f.n / 2}" y="${f.T}" width="${f.w / f.n}" height="${f.h}" fill="transparent" data-i="${i}"/>`; });
  return `<svg viewBox="0 0 ${W} ${H}" class="pn-svg" role="img" aria-label="Daily PnL bar chart">${f.g}${bars}</svg>`;
}
function lineChart(days, vals){
  const W = 340, H = 190, f = chartFrame(days, vals, W, H, "line");
  const pts = vals.map((v, i) => [f.x(i), f.y(v)]), end = vals[vals.length - 1] || 0, c = end >= 0 ? "var(--up)" : "var(--down)";
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + ` L${pts[pts.length - 1][0].toFixed(1)} ${f.y(0)} L${pts[0][0].toFixed(1)} ${f.y(0)} Z`;
  let hit = ""; vals.forEach((v, i) => hit += `<rect x="${f.x(i) - f.w / f.n / 2}" y="${f.T}" width="${f.w / f.n}" height="${f.h}" fill="transparent" data-i="${i}"/>`);
  return `<svg viewBox="0 0 ${W} ${H}" class="pn-svg" role="img" aria-label="Cumulative PnL line chart">${f.g}<path d="${area}" fill="${c}" opacity=".10"/><path d="${d}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle class="pn-dot" r="3.5" cx="-10" cy="-10" fill="${c}"/>${hit}</svg>`;
}

Pages.pnl = (params) => {
  let per = (params && params[0] || "30d").toLowerCase(); if (!PERIODS.some(p => p[0] === per)) per = "30d";
  let prod = "", calOff = 0;
  const html = UI.pageHead("PnL Analysis", {right:`<button class="icon-btn" data-share aria-label="Share PnL">${ic("share",20)}</button>`}) + `<div class="pn-page" id="pnr"></div>`;
  return {html, title:"PnL Analysis", mount(root){
    const el = root.querySelector("#pnr");
    function calc(){
      const {T, spot} = allTrades(), p = PERIODS.find(x => x[0] === per), now = Date.now();
      const first = T.length ? sod(T[T.length - 1].t) : sod(now);
      const start = p[2] ? sod(now) - (p[2] - 1) * DAY : first;
      const inP = T.filter(x => x.t >= start), cur = prod ? inP.filter(x => x.prod === prod) : inP;
      const days = []; for (let t = start; t <= sod(now); t += DAY) days.push(t);
      const dayPnl = Object.create(null); cur.forEach(x => { const k = dkey(x.t); dayPnl[k] = (dayPnl[k] || 0) + x.pnl; });
      const daily = days.map(t => dayPnl[dkey(t)] || 0); let acc = 0; const cum = daily.map(v => acc += v);
      return {T, spot, inP, cur, days, daily, cum, start};
    }
    function stats(arr){
      const w = arr.filter(x => x.pnl > 0), l = arr.filter(x => x.pnl < 0), gp = w.reduce((a, x) => a + x.pnl, 0), gl = -l.reduce((a, x) => a + x.pnl, 0);
      const tot = arr.reduce((a, x) => a + x.pnl, 0), dec = w.length + l.length;
      return {tot, n: arr.length, wr: dec ? w.length / dec * 100 : null, pf: gl > 0 ? gp / gl : (gp > 0 ? Infinity : null), aw: w.length ? gp / w.length : 0, al: l.length ? -gl / l.length : 0,
        best: arr.length ? arr.reduce((a, x) => x.pnl > a.pnl ? x : a) : null, worst: arr.length ? arr.reduce((a, x) => x.pnl < a.pnl ? x : a) : null};
    }
    const trow = (x, big) => `<div class="pn-tr"><span class="pn-tag">${PN[x.prod]}</span><div class="grow"><b>${esc(x.sym)}</b><span>${U.dateStr(x.t)}</span></div><b class="num ${cls(x.pnl)}">${signed(x.pnl)}</b></div>`;
    function render(){
      const d = calc(), st = stats(d.cur), all = stats(d.inP), pctv = st.tot / C.START_BALANCE * 100;
      const kv = (l, v, c = "") => `<div><span>${l}</span><b class="num ${c}">${v}</b></div>`;
      const rows = PRODS.map(([k, n, i]) => {
        const a = d.inP.filter(x => x.prod === k), s = stats(a), extra = k === "spot" ? ` · fees ${fmt(d.spot.fees, 2)}` : "";
        return `<button class="pn-pr${prod === k ? " on" : ""}" data-pr="${k}"><span class="pn-pi">${ic(i, 20, 1.7)}</span><div class="grow"><b>${n}</b><span>${k === "spot" && !a.length ? d.spot.count + " fills" + extra : s.n + " trade" + (s.n === 1 ? "" : "s") + (s.wr == null ? "" : " · " + s.wr.toFixed(0) + "% win") + (k === "spot" ? extra : "")}</span></div><b class="num ${cls(s.tot)}">${signed(s.tot)}</b></button>`;
      }).join("");
      const cal = calHtml(d.T.filter(x => !prod || x.prod === prod));
      el.innerHTML = `
      <div class="pn-tabs" role="tablist">${PERIODS.map(p => `<button role="tab" aria-selected="${p[0] === per}" class="${p[0] === per ? "on" : ""}" data-per="${p[0]}">${p[1]}</button>`).join("")}</div>
      <section class="pn-hero"><span class="pn-l">${prod ? PN[prod] : "Total"} PnL (USDT) <i class="pn-pulse"></i></span><div class="pn-big num ${cls(st.tot)}">${signed(st.tot)}</div>
        <div class="num ${cls(pctv)}" style="font-size:14px;font-weight:600">${pctv >= 0 ? "+" : ""}${pctv.toFixed(2)}% <span class="pn-mut" style="font-weight:400">of ${fmt(C.START_BALANCE, 0)} USDT start balance</span></div></section>
      <section class="pn-kpis">${kv("Win rate", st.wr == null ? "--" : st.wr.toFixed(1) + "%")}${kv("Trades", st.n)}${kv("Profit factor", st.pf == null ? "--" : st.pf === Infinity ? "∞" : st.pf.toFixed(2))}
        ${kv("Avg win", st.aw ? signed(st.aw) : "--", st.aw ? "up" : "")}${kv("Avg loss", st.al ? signed(st.al) : "--", st.al ? "down" : "")}
        ${kv("Best trade", st.best && st.best.pnl > 0 ? signed(st.best.pnl) : "--", st.best && st.best.pnl > 0 ? "up" : "")}${kv("Worst trade", st.worst && st.worst.pnl < 0 ? signed(st.worst.pnl) : "--", st.worst && st.worst.pnl < 0 ? "down" : "")}${kv("Avg PnL / trade", st.n ? signed(st.tot / st.n) : "--", cls(st.tot))}</section>
      <section class="pn-sec"><h3>Cumulative PnL</h3><div class="pn-ch" data-ch="cum">${lineChart(d.days, d.cum)}<div class="pn-tip" hidden></div></div></section>
      <section class="pn-sec"><h3>Daily PnL</h3><div class="pn-ch" data-ch="day">${barChart(d.days, d.daily)}<div class="pn-tip" hidden></div></div>
        ${d.cur.length ? "" : `<p class="pn-mut" style="text-align:center;margin:0 0 8px">No closed trades in this period.</p>`}</section>
      <section class="pn-sec"><h3>By product ${prod ? `<button class="pn-clr" data-clr>Show all</button>` : ""}</h3>${rows}</section>
      <section class="pn-sec"><h3>Calendar</h3>${cal}</section>
      <section class="pn-sec"><h3>Recent closed trades${prod ? " · " + PN[prod] : ""}</h3>${d.cur.length ? d.cur.slice(0, 30).map(x => trow(x)).join("") : `<div class="pn-empty"><b>No trades yet</b>Closed positions will appear here.</div>`}</section>
      <p class="pn-mut" style="padding:0 0 18px;font-size:11.5px">Realized PnL only, net of fees where recorded. Spot PnL uses average cost. Demo data.</p>`;
      el.querySelectorAll("[data-per]").forEach(b => b.onclick = () => { per = b.dataset.per; history.replaceState(null, "", "#/pnl/" + per); render(); });
      el.querySelectorAll("[data-pr]").forEach(b => b.onclick = () => { prod = prod === b.dataset.pr ? "" : b.dataset.pr; render(); });
      const clr = el.querySelector("[data-clr]"); if (clr) clr.onclick = () => { prod = ""; render(); };
      el.querySelectorAll(".pn-ch").forEach(box => {
        const tip = box.querySelector(".pn-tip"), kind = box.dataset.ch, svg = box.querySelector("svg");
        box.querySelectorAll("[data-i]").forEach(r => r.addEventListener("click", () => {
          const i = +r.dataset.i, v = (kind === "cum" ? d.cum : d.daily)[i];
          tip.hidden = false; tip.innerHTML = `${new Date(d.days[i]).toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric", year:"numeric"})}<b class="num ${cls(v)}">${signed(v)} USDT</b>`;
          const bx = r.getBBox(), pc = (bx.x + bx.width / 2) / 340 * 100; tip.style.left = Math.min(Math.max(pc, 26), 74) + "%";
          box.querySelectorAll("rect.sel").forEach(q => q.classList.remove("sel")); if (kind === "day"){ const bar = r.previousElementSibling; bar && bar.classList.add("sel"); }
          const dot = svg.querySelector(".pn-dot"); if (dot){ const f = svg.viewBox.baseVal; dot.setAttribute("cx", bx.x + bx.width / 2); const ys = svg.querySelectorAll("path")[1]; const len = ys.getTotalLength(), n = d.days.length; const pt = ys.getPointAtLength(n > 1 ? len * i / (n - 1) : 0); dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y); }
        }));
      });
      el.querySelectorAll("[data-cm]").forEach(b => b.onclick = () => { calOff += +b.dataset.cm; if (calOff > 0) calOff = 0; render(); });
      root._pnl = {d, st, pctv};
    }
    function calHtml(T){
      const ref = new Date(); ref.setDate(1); ref.setMonth(ref.getMonth() + calOff); const y = ref.getFullYear(), m = ref.getMonth();
      const dim = new Date(y, m + 1, 0).getDate(), off = new Date(y, m, 1).getDay(), by = Object.create(null); let mt = 0;
      T.forEach(x => { const dd = new Date(x.t); if (dd.getFullYear() === y && dd.getMonth() === m){ const k = dd.getDate(); by[k] = (by[k] || 0) + x.pnl; mt += x.pnl; } });
      const mx = Math.max(1e-9, ...Object.values(by).map(Math.abs)), today = new Date();
      let c = ["S","M","T","W","T","F","S"].map(x => `<i class="pn-wd">${x}</i>`).join("") + '<i></i>'.repeat(off);
      for (let k = 1; k <= dim; k++){ const v = by[k], a = v == null ? 0 : Math.min(85, 22 + Math.abs(v) / mx * 63), isT = calOff === 0 && k === today.getDate();
        c += `<div class="pn-d${isT ? " t" : ""}" ${v != null ? `style="background:color-mix(in srgb, var(${v >= 0 ? "--up" : "--down"}) ${a}%, transparent)" title="${signed(v)}"` : ""}><span>${k}</span>${v != null ? `<em class="num">${Math.abs(v) >= 1000 ? ax(v) : (v >= 0 ? "+" : "") + Math.round(v)}</em>` : ""}</div>`; }
      return `<div class="pn-cm"><button data-cm="-1" aria-label="Previous month">${ic("back",16)}</button><b>${ref.toLocaleDateString("en-US", {month:"long", year:"numeric"})}</b><button data-cm="1" aria-label="Next month" ${calOff >= 0 ? "disabled" : ""}>${ic("chev",16)}</button><span class="num ${cls(mt)}">${signed(mt)}</span></div><div class="pn-cal">${c}</div>`;
    }
    render();
    root.querySelector("[data-share]").onclick = () => {
      const x = el.parentNode && root._pnl || {}; if (!x.st) return;
      const pl = PERIODS.find(p => p[0] === per)[1], pr = prod ? PN[prod] : "All products", txt = `NovaTrade PnL (${pl}, ${pr}): ${signed(x.st.tot)} USDT (${x.pctv >= 0 ? "+" : ""}${x.pctv.toFixed(2)}%) · ${x.st.n} trades · win rate ${x.st.wr == null ? "--" : x.st.wr.toFixed(1) + "%"}`;
      U.sheet("Share PnL", `<div class="pn-card"><div class="pn-ch-h">${UI.logo(26)}<b>NovaTrade</b><span>${pl} · ${esc(pr)}</span></div>
        <div class="pn-ci">ROI</div><div class="pn-croi num ${cls(x.pctv)}">${x.pctv >= 0 ? "+" : ""}${x.pctv.toFixed(2)}%</div><div class="num ${cls(x.st.tot)}" style="font-size:18px;font-weight:700">${signed(x.st.tot)} USDT</div>
        <div class="pn-cg"><div><span>Trades</span><b class="num">${x.st.n}</b></div><div><span>Win rate</span><b class="num">${x.st.wr == null ? "--" : x.st.wr.toFixed(1) + "%"}</b></div><div><span>Profit factor</span><b class="num">${x.st.pf == null ? "--" : x.st.pf === Infinity ? "∞" : x.st.pf.toFixed(2)}</b></div></div>
        <div class="pn-cf">Demo trading · ${new Date().toLocaleDateString()}</div></div><button class="btn btn-primary pm-cta" data-cp style="margin-top:14px">Copy text</button>`, e => { e.querySelector("[data-cp]").onclick = () => U.copyText(txt, "PnL summary copied"); });
    };
    const off = U.bus.on("history", () => render()); this.unmount = () => off && off();
  }};
};
})();
