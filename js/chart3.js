/* v6.7 — chart add-ons: S/R + LIQ buttons, Indicator Settings page, indicator row on every chart, editable drawing tools, landscape / full-screen chart

   PUBLIC API (for any page, e.g. the Options page):
     CH.mount(hostEl, {sym:"BTCUSDT", tf:"15m", indicators:true, compact:true, tfbar:true, mode:"none", height:"300px", tfs:[...]}, detailCb?)
       hostEl      any empty <div>; it is wrapped automatically (interval bar + chart + indicator row + drawing/fullscreen buttons)
       sym         if given the chart loads it right away (CH.load(sym, tf)); the interval bar switches it. Without sym you call CH.load yourself.
       tf          start interval (default "15m", remembered per page in sessionStorage "tf_ch3")
       indicators  true -> indicator row (MA EMA BOLL SAR VWAP SUPER S/R LIQ | VOL RSI MACD + settings icon). Mini charts of the
                   app (futures dock, spot) always get it. false -> none.
       tfbar       true (default when sym is given) -> interval bar with pencil (drawing tools) + expand (landscape full screen) buttons
       compact     true -> fewer intervals (1m 5m 15m 1h 4h 1D) and a lower chart (240px)
       mode        "none" (default for generic hosts: no trade lines/markers) | "fut" | "bin"
       height      chart height css value (default 300px, 240px compact); ignored when the host already sits in a .chart-wrap
     CH.mount returns undefined as before; CH.destroy() (call in page unmount) also closes the full screen view.
     CH.openFS() opens the landscape full-screen view of the mounted chart; CH.closeFS() closes it.
   Drawings: store.s.drawings[SYM] = [{id,k:"trend"|"ray"|"hline"|"rect",a:{t,p},b:{t,p},p}] (t = candle time, p = price). */
(function(){
if (!window.CH || !window.U) return;
const {store, esc} = U;
const ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/></svg>`;

/* ---- schema of the settings page: [field, label, type] ---- */
const N = (f, l) => [f, l, "n"], C = (f, l) => [f, l, "c"];
const SCH = [
  {k:"MA", n:"MA", main:1, f:[N("p1","Period 1"), N("p2","Period 2"), N("p3","Period 3"), C("c1","Colour 1"), C("c2","Colour 2"), C("c3","Colour 3")]},
  {k:"EMA", n:"EMA", main:1, f:[N("p1","Period 1"), N("p2","Period 2"), N("p3","Period 3"), C("c1","Colour 1"), C("c2","Colour 2"), C("c3","Colour 3")]},
  {k:"BOLL", n:"BOLL", main:1, f:[N("n","Period"), N("m","Multiplier"), C("c","Band colour"), C("cm","Middle colour")]},
  {k:"SAR", n:"SAR", main:1, f:[N("step","Step"), N("max","Max step"), C("c","Colour")]},
  {k:"SUPER", n:"SuperTrend", main:1, f:[N("n","ATR period"), N("m","Multiplier"), N("conf","Confirm (x ATR)")]},
  {k:"VWAP", n:"VWAP", main:1, f:[C("c","Colour")]},
  {k:"SR", n:"S/R", main:1, f:[N("lv","Levels per side"), N("k","Pivot strength")]},
  {k:"LIQ", n:"LIQ", main:1, f:[["lev","Leverages (comma list)","t"], N("bins","Resolution (bins)")]},
  {k:"VOL", n:"VOL", f:[]},
  {k:"RSI", n:"RSI", f:[N("n","Period"), C("c","Colour")]},
  {k:"MACD", n:"MACD", f:[N("f","Fast"), N("s","Slow"), N("g","Signal"), C("c","MACD colour"), C("cs","Signal colour")]}
];
const hex = v => /^#[0-9a-f]{6}$/i.test(v) ? v : "#2e6bff";
let tmr = 0;
const syncRow = () => document.querySelectorAll("[data-ind]").forEach(b => b.classList.toggle("on", CH.inds.includes(b.dataset.ind)));

function open(){
  if (document.getElementById("indPage")) return;
  const pg = document.createElement("div"); pg.id = "indPage"; pg.className = "indpage";
  const openK = new Set();
  const val = (k, f) => { const d = CH.IDEF[k]; const o = store.s.indSettings && store.s.indSettings[k]; return o && o[f] != null ? o[f] : d[f]; };
  const body = () => {
    const sec = (title, list) => `<div class="ip-sec">${title}</div>` + list.map(x => {
      const on = CH.inds.includes(x.k), ex = openK.has(x.k) && x.f.length;
      return `<div class="ip-row${ex ? " open" : ""}" data-k="${x.k}"><div class="ip-h" data-tg="${x.k}"><b>${esc(x.n)}</b><span class="ip-sp"></span><button class="switch ${on ? "on" : ""}" data-sw="${x.k}" aria-label="${esc(x.n)}"></button>${x.f.length ? `<span class="ip-chev">${U.ic("chevd", 14)}</span>` : `<span class="ip-chev" style="visibility:hidden"></span>`}</div>
        ${ex ? `<div class="ip-b">${x.f.map(([f, l, t]) => `<label><span>${l}</span>${t === "c" ? `<input type="color" data-f="${x.k}.${f}" value="${hex(val(x.k, f))}">` : `<input class="ip-in" ${t === "n" ? 'type="number" inputmode="decimal" step="any"' : 'type="text"'} data-f="${x.k}.${f}" value="${esc(String(val(x.k, f)))}">`}</label>`).join("")}<button class="ip-reset" data-rs="${x.k}">Reset</button></div>` : ""}</div>`;
    }).join("");
    return sec("Main chart", SCH.filter(x => x.main)) + sec("Sub chart", SCH.filter(x => !x.main)) + `<div class="ip-note">Up to ${CH.MAXI} indicators at a time (VOL not counted). Values are saved on this device.</div>`;
  };
  const render = () => { const sc = pg.querySelector(".ip-body"), y = sc ? sc.scrollTop : 0; pg.querySelector(".ip-body").innerHTML = body(); pg.querySelector(".ip-body").scrollTop = y; };
  pg.innerHTML = `<div class="ip-head"><button class="icon-btn" data-ipx aria-label="Back">${U.ic("back", 20)}</button><b>Indicator Settings</b><span class="ip-sp"></span><button class="ip-resetall" data-rsall>Reset</button></div><div class="ip-body"></div>`;
  document.body.appendChild(pg); render();
  requestAnimationFrame(() => pg.classList.add("show"));
  const close = () => { pg.classList.remove("show"); setTimeout(() => pg.remove(), 180); document.body.style.overflow = ""; };
  document.body.style.overflow = "hidden";
  const apply = () => { clearTimeout(tmr); tmr = setTimeout(() => CH.refresh(), 220); };
  pg.addEventListener("click", e => {
    if (e.target.closest("[data-ipx]")) return close();
    if (e.target.closest("[data-rsall]")){ store.s.indSettings = {}; store.save(); render(); CH.refresh(); U.toast("Indicator settings reset", "ok", 1300); return; }
    const rs = e.target.closest("[data-rs]"); if (rs){ if (store.s.indSettings) delete store.s.indSettings[rs.dataset.rs]; store.save(); render(); CH.refresh(); return; }
    const sw = e.target.closest("[data-sw]"); if (sw){ e.stopPropagation(); const k = sw.dataset.sw, l = CH.inds.includes(k) ? CH.inds.filter(x => x !== k) : [...CH.inds, k]; CH.setInds(l); syncRow(); render(); return; }
    const tg = e.target.closest("[data-tg]"); if (tg){ const k = tg.dataset.tg; if (!SCH.find(x => x.k === k).f.length) return; openK.has(k) ? openK.delete(k) : openK.add(k); render(); }
  });
  pg.addEventListener("input", e => {
    const i = e.target.closest("[data-f]"); if (!i) return; const [k, f] = i.dataset.f.split("."), t = i.type;
    let v = i.value; if (t === "number"){ v = parseFloat(v); if (!isFinite(v) || v <= 0) return; } else if (t === "text"){ if (!/^\s*\d+(\s*,\s*\d+)*\s*$/.test(v)) return; v = v.replace(/\s/g, ""); }
    const o = store.s.indSettings = store.s.indSettings || {}; (o[k] = o[k] || {})[f] = v; store.save(); apply();
  });
}
window.CH.openSettings = open;

/* ================= mount wrapper: indicator row + tools on every chart ================= */
const IND_MAIN = ["MA","EMA","BOLL","SAR","VWAP","SUPER"], IND_SUB = ["VOL","RSI","MACD"];
const TFLAB = {"1s":"1s","5s":"5s","30s":"30s","1m":"1m","5m":"5m","15m":"15m","1h":"1H","4h":"4H","1d":"1D"};
const rowHTML = () => `<div class="il" id="inds">${IND_MAIN.map(k => `<button data-ind="${k}">${k}</button>`).join("")}<span style="color:var(--line)">|</span>${IND_SUB.map(k => `<button data-ind="${k}">${k}</button>`).join("")}</div><button class="ti" data-indinfo aria-label="Indicator settings">${U.ic("ind", 18)}</button>`;
const penBtn = () => `<button class="ti" data-drawt aria-label="Drawing tools">${U.ic("pen", 15)}</button>`;
const fsBtn = () => `<button class="ti" data-fs aria-label="Full screen">${U.ic("expand", 15)}</button>`;
let cur = null;   // {svg, bar, wrap, box}

function wrapHost(container, parts){
  const compact = !!parts.compact, withTf = parts.tfbar != null ? !!parts.tfbar : !!parts.sym;
  const tfs = parts.tfs || (compact ? ["1m","5m","15m","1h","4h","1d"] : ["1s","1m","5m","15m","1h","4h","1d"]);
  const box = document.createElement("div"); box.className = "ch3-box" + (compact ? " compact" : "");
  container.parentNode.insertBefore(box, container);
  const h = parts.height || container.style.height || (compact ? "240px" : "300px");
  box.innerHTML = (withTf ? `<div class="tfbar x3"><div class="tfs">${tfs.map(x => `<button data-x3tf="${x}">${TFLAB[x] || x}</button>`).join("")}</div>${penBtn()}${fsBtn()}</div>` : "") +
    `<div class="cp-chart"><div class="chart-wrap" style="height:${h};min-height:0;max-height:none"><div class="legend"></div><div class="chart-msg"></div></div></div>`;
  const wrap = box.querySelector(".chart-wrap"); wrap.insertBefore(container, wrap.firstChild);
  container.style.cssText += ";position:absolute;inset:0;height:auto;width:auto";
  parts.legend = parts.legend || wrap.querySelector(".legend"); parts.msg = parts.msg || wrap.querySelector(".chart-msg");
  return box;
}
function toggleInd(k){ const l = CH.inds.includes(k) ? CH.inds.filter(x => x !== k) : [...CH.inds, k]; CH.setInds(l); syncRow(); }

const mount0 = CH.mount, setInds0 = CH.setInds, destroy0 = CH.destroy;
CH.setInds = function(){ const r = setInds0.apply(this, arguments); try { syncRow(); } catch {} return r; };
CH.destroy = function(){ try { closeFS(true); } catch {} cur = null; return destroy0.apply(this, arguments); };
CH.mount = function(container, parts, cb){
  parts = Object.assign({}, parts || {});
  let box = null, injected = null;
  try {
    if (!container.parentElement || !container.parentElement.classList.contains("chart-wrap")) box = wrapHost(container, parts);
    const cc = container.closest(".cp-chart"), par = cc && cc.parentElement;
    if (par && parts.indicators !== false){
      parts.noInd = false;
      if (!par.querySelector("#inds")){ injected = document.createElement("div"); injected.className = "indbar x3"; injected.innerHTML = rowHTML(); cc.after(injected);
        injected.addEventListener("click", e => { const b = e.target.closest("[data-ind]"); if (b && !b.onclick) toggleInd(b.dataset.ind); }); }
    }
    const tb = par && par.querySelector(":scope > .tfbar");
    if (tb && !tb.querySelector("[data-drawt]")){ const ct = tb.querySelector("[data-ctype]"); ct ? ct.insertAdjacentHTML("beforebegin", penBtn()) : tb.insertAdjacentHTML("beforeend", penBtn()); }
  } catch (e) { console.warn(e); }
  const r = mount0.call(this, container, parts, cb);
  try {
    let root = container; while (root && !root.querySelector("#inds")) root = root.parentElement;
    if (root){
      const row = root.querySelector("#inds");
      if (!row.querySelector('[data-ind="SR"]')){
        const su = row.querySelector('[data-ind="SUPER"]');
        const html = `<button data-ind="SR">S/R</button><button data-ind="LIQ">LIQ</button>`;
        su ? su.insertAdjacentHTML("afterend", html) : row.insertAdjacentHTML("afterbegin", html);
      }
      const ib = root.querySelector("[data-indinfo]"); if (ib){ ib.innerHTML = ICON; ib.classList.add("ind-set"); ib.setAttribute("aria-label", "Indicator settings"); }
      if (!root._ch3){ root._ch3 = 1; root.addEventListener("click", e => { if (e.target.closest("[data-indinfo],[data-indset]")){ e.stopPropagation(); e.preventDefault(); open(); } }, true); }
    }
    syncRow();
    initDraw(container);
    if (box && parts.sym){ const tfsEl = box.querySelectorAll("[data-x3tf]"); let tf = parts.tf || sessionStorage.getItem("tf_ch3") || "15m";
      if (tfsEl.length && ![...tfsEl].some(b => b.dataset.x3tf === tf)) tf = tfsEl[Math.min(2, tfsEl.length - 1)].dataset.x3tf;
      const go = x => { tf = x; try { sessionStorage.setItem("tf_ch3", x); } catch {} tfsEl.forEach(b => b.classList.toggle("on", b.dataset.x3tf === x)); CH.load(parts.sym, x); };
      tfsEl.forEach(b => b.onclick = () => go(b.dataset.x3tf)); go(tf); }
    else if (parts.sym && !box) CH.load(parts.sym, parts.tf || "15m");
  } catch (e) { console.warn(e); }
  return r;
};

/* ================= drawing tools ================= */
const NS = "http://www.w3.org/2000/svg", BLUE = "#2E6BFF";
const dstore = sym => { const s = store.s; s.drawings = s.drawings || {}; if (!s.drawings[sym]){ let a = []; try { a = (JSON.parse(localStorage.getItem("draw_" + sym) || "[]") || []).filter(d => ["trend","ray","hline","rect"].includes(d.k)).map((d, i) => Object.assign({id:"m" + i + Date.now()}, d)); } catch {} s.drawings[sym] = a; } return s.drawings[sym]; };
const dsave = () => store.save();
const did = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
let D = {tool:null, sel:null, temp:null, st:null, els:new Map(), clipId:"dwc" + Math.random().toString(36).slice(2, 6)};
const svgEl = (t, c) => { const e = document.createElementNS(NS, t); if (c) e.setAttribute("class", c); return e; };
const setA = (e, o) => { for (const k in o) if (e._a == null || e._a[k] !== o[k]){ e.setAttribute(k, o[k]); } e._a = Object.assign(e._a || {}, o); };

function initDraw(container){
  const wrap = container.parentElement; if (!wrap) return;
  wrap.querySelector(".dw3")?.remove();
  const svg = svgEl("svg", "dw3"); svg.innerHTML = `<defs><clipPath id="${D.clipId}"><rect x="0" y="0" width="0" height="0"/></clipPath></defs><g class="dwr" clip-path="url(#${D.clipId})"></g>`;
  wrap.appendChild(svg);
  const cc = wrap.closest(".cp-chart");
  cc.querySelector(".dw3-bar")?.remove();
  const bar = document.createElement("div"); bar.className = "dw3-bar hide";
  bar.innerHTML = [["trend","Trend line"],["hline","H-line"],["ray","Ray"],["rect","Rect"]].map(([k, n]) => `<button data-dt="${k}">${n}</button>`).join("") +
    `<button data-dsel class="dis">${U.ic("trash", 13)} Delete</button><button data-dclr>Clear all</button><span class="dw3-hint"></span><button data-dx class="dw3-x" aria-label="Close tools">${U.ic("close", 14)}</button>`;
  cc.insertBefore(bar, wrap);
  cur = {svg, bar, wrap, cc, g:svg.querySelector(".dwr"), clip:svg.querySelector("rect")};
  D = Object.assign(D, {tool:null, sel:null, temp:null, st:null}); D.els = new Map();
  bar.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.dt){ setTool(D.tool === b.dataset.dt ? null : b.dataset.dt); return; }
    if (b.hasAttribute("data-dsel")){ if (D.sel){ const g = CH.geo(); if (g){ const a = dstore(g.sym), i = a.findIndex(d => d.id === D.sel); if (i >= 0){ a.splice(i, 1); dsave(); } } select(null); } return; }
    if (b.hasAttribute("data-dclr")){ const g = CH.geo(); if (g){ store.s.drawings[g.sym] = []; dsave(); select(null); U.toast("Drawings cleared", "ok", 1200); } return; }
    if (b.hasAttribute("data-dx")) showBar(false);
  });
  svg.addEventListener("pointerdown", onDown); svg.addEventListener("pointermove", onMove); svg.addEventListener("pointerup", onUp); svg.addEventListener("pointercancel", () => { D.st = null; });
  svg.addEventListener("touchstart", e => { if (D.tool || e.target.closest(".hit,.hd")) e.preventDefault(); }, {passive:false});
  wrap.addEventListener("pointerdown", e => { if (D.sel && !e.target.closest(".dw3")) select(null); }, true);
  CH.frame = renderDW;
}
function showBar(on){ if (!cur) return; cur.bar.classList.toggle("hide", !on); (FS ? FS.ov : cur.cc.parentElement).querySelectorAll("[data-drawt]").forEach(b => b.classList.toggle("on", on)); if (!on){ setTool(null); select(null); } }
function setTool(t){ D.tool = t; D.temp = null; if (cur){ cur.svg.classList.toggle("on", !!t); cur.bar.querySelectorAll("[data-dt]").forEach(b => b.classList.toggle("on", b.dataset.dt === t)); hint(t ? (t === "hline" ? "Tap the chart to place the line" : "Tap the first point") : ""); } if (t) select(null); }
function hint(t){ const h = cur && cur.bar.querySelector(".dw3-hint"); if (h) h.textContent = FS ? (t || "") : ""; if (t && !FS) U.toast(t, "info", 1400); }
function select(id){ D.sel = id; if (cur) cur.bar.querySelector("[data-dsel]").classList.toggle("dis", !id); D.els.forEach(e => e.g.classList.toggle("sel", e.id === id)); }
/* pointer position inside the svg (the full-screen view may be rotated with CSS; remapped events already carry unrotated coordinates) */
const loc = e => { const r = cur.svg.getBoundingClientRect(); return {x:e.clientX - r.left, y:e.clientY - r.top}; };
const P = (g, x, y) => { const t = g.x2t(x), p = g.y2p(y); return t == null || p == null ? null : {t, p}; };
function onDown(e){
  if (!cur) return; const g = CH.geo(); if (!g) return; const l = loc(e);
  if (D.tool){ e.preventDefault(); D.st = {mode:"new", x:l.x, y:l.y, moved:false}; return; }
  const h = e.target.closest("[data-id]"); if (!h) return;
  const id = h.dataset.id, part = e.target.dataset.part || "body", d = dstore(g.sym).find(x => x.id === id); if (!d) return;
  e.preventDefault(); e.stopPropagation(); select(id);
  D.st = {mode:"edit", id, part, x:l.x, y:l.y, p0:P(g, l.x, l.y), a:Object.assign({}, d.a), b:Object.assign({}, d.b), hp:d.p, moved:false};
  window.addEventListener("pointermove", onWinMove); window.addEventListener("pointerup", onWinUp); window.addEventListener("pointercancel", onWinUp);
}
function onMove(e){
  if (!cur || !D.tool) return; const g = CH.geo(); if (!g) return; const l = loc(e);
  if (D.st && D.st.mode === "new" && Math.hypot(l.x - D.st.x, l.y - D.st.y) > 6) D.st.moved = true;
  if (D.temp){ const q = P(g, l.x, l.y); if (q) D.temp.b = q; }
}
function finish(d){ const g = CH.geo(); const a = dstore(g.sym); d.id = did(); a.push(d); dsave(); D.temp = null; setTool(null); select(d.id); }
function onUp(e){
  if (!cur || !D.tool || !D.st || D.st.mode !== "new") return; const g = CH.geo(); const s0 = D.st; D.st = null; if (!g) return; const l = loc(e), q = P(g, l.x, l.y); if (!q) return;
  if (D.tool === "hline") return finish({k:"hline", p:q.p, a:q, b:q});
  if (!D.temp){
    if (s0.moved){ const a0 = P(g, s0.x, s0.y); if (a0) return finish({k:D.tool, a:a0, b:q}); }
    D.temp = {k:D.tool, a:q, b:q}; hint("Tap the second point"); return;
  }
  if (Math.hypot(l.x - s0.x, l.y - s0.y) < 0.5 && D.temp && D.temp.a.t === q.t && D.temp.a.p === q.p) return;
  const t = D.temp; t.b = q; delete t.id; finish({k:t.k, a:t.a, b:t.b});
}
function onWinMove(e){
  const s = D.st; if (!s || s.mode !== "edit" || !cur) return; const g = CH.geo(); if (!g) return; e.preventDefault();
  const d = dstore(g.sym).find(x => x.id === s.id); if (!d) return; const l = loc(e), q = P(g, l.x, l.y); if (!q) return; s.moved = true;
  if (d.k === "hline"){ d.p = q.p - (s.p0.p - s.hp); return; }
  if (s.part === "a") d.a = q; else if (s.part === "b") d.b = q;
  else { const dt = q.t - s.p0.t, dp = q.p - s.p0.p; d.a = {t:s.a.t + dt, p:s.a.p + dp}; d.b = {t:s.b.t + dt, p:s.b.p + dp}; }
}
function onWinUp(){ window.removeEventListener("pointermove", onWinMove); window.removeEventListener("pointerup", onWinUp); window.removeEventListener("pointercancel", onWinUp); if (D.st && D.st.moved) dsave(); D.st = null; }

function group(d){
  const g = svgEl("g", "dg"); g.dataset.id = d.id;
  const mk = (t, c, part) => { const e = svgEl(t, c); if (part) e.dataset.part = part; g.appendChild(e); return e; };
  const o = {g, id:d.id, k:d.k};
  if (d.k === "rect"){ o.fill = mk("rect", "fillr"); o.hit = mk("rect", "hit"); o.vis = mk("rect", "vis"); }
  else { o.hit = mk("line", "hit"); o.vis = mk("line", "vis"); }
  if (d.k === "hline") o.txt = mk("text", "dtx");
  o.ha = mk("circle", "hd", "a"); if (d.k !== "hline") o.hb = mk("circle", "hd", "b");
  return o;
}
function renderDW(){
  if (!cur || !cur.svg.isConnected) return; const g = CH.geo(); const root = cur.g;
  if (!g){ root.style.display = "none"; return; } root.style.display = "";
  setA(cur.clip, {width:g.pw, height:g.h});
  const list = dstore(g.sym).slice(); if (D.temp) list.push(Object.assign({id:"tmp"}, D.temp));
  const ids = new Set(list.map(d => d.id));
  D.els.forEach((o, id) => { if (!ids.has(id)){ o.g.remove(); D.els.delete(id); } });
  const w = g.pw, el = g.el, fx = v => M.fmtPx(M.get(g.sym), v);
  list.forEach(d => {
    let o = D.els.get(d.id); if (o && o.k !== d.k){ o.g.remove(); o = null; }
    if (!o){ o = group(d); o.id = d.id; o.k = d.k; if (d.id === "tmp") o.g.classList.add("tmp"); D.els.set(d.id, o); root.appendChild(o.g); o.g.classList.toggle("sel", d.id === D.sel); }
    const sel = d.id === D.sel;
    if (d.k === "hline"){
      const y = g.p2y(d.p); if (y == null){ o.g.style.display = "none"; return; } o.g.style.display = "";
      const A = {x1:0, x2:w, y1:y, y2:y}; setA(o.hit, A); setA(o.vis, A); setA(o.ha, {cx:w - 14, cy:y, r:7});
      setA(o.txt, {x:w - 28, y:y - 5}); if (o.txt._v !== d.p){ o.txt._v = d.p; o.txt.textContent = fx(d.p); } return;
    }
    const ax = g.t2x(d.a.t), ay = g.p2y(d.a.p), bx = g.t2x(d.b.t), by = g.p2y(d.b.p);
    if (ax == null || ay == null || bx == null || by == null){ o.g.style.display = "none"; return; } o.g.style.display = "";
    if (d.k === "rect"){
      const R = {x:Math.min(ax, bx), y:Math.min(ay, by), width:Math.abs(bx - ax), height:Math.abs(by - ay)}; setA(o.fill, R); setA(o.hit, R); setA(o.vis, R);
    } else {
      let x2 = bx, y2 = by;
      if (d.k === "ray" && Math.abs(bx - ax) > 0.01){ const k = (by - ay) / (bx - ax); x2 = bx >= ax ? w + 40 : -40; y2 = ay + k * (x2 - ax); }
      else if (d.k === "ray"){ x2 = ax; y2 = by >= ay ? g.h + 40 : -40; }
      const A = {x1:ax, y1:ay, x2, y2}; setA(o.hit, A); setA(o.vis, A);
    }
    setA(o.ha, {cx:ax, cy:ay, r:7}); if (o.hb) setA(o.hb, {cx:bx, cy:by, r:7});
  });
}

/* ================= landscape / full-screen chart ================= */
let FS = null;
const isPhone = () => Math.min(innerWidth, innerHeight) < 700;
function fsLayout(){
  if (!FS) return; const ov = FS.ov, portrait = innerHeight > innerWidth && isPhone();
  ov.classList.toggle("rot", portrait);
  if (portrait){ ov.style.width = innerHeight + "px"; ov.style.height = innerWidth + "px"; ov.style.transform = `translateX(${innerWidth}px) rotate(90deg)`; }
  else { ov.style.width = ""; ov.style.height = ""; ov.style.transform = ""; }
  setTimeout(() => { try { CH.resize(); } catch {} }, 30); setTimeout(() => { try { CH.resize(); } catch {} }, 350);
}
/* with the CSS rotation, mouse/touch/pointer coordinates are rotated too: re-dispatch them in the element's own (unrotated) frame */
function remap(e){
  if (!FS || !FS.ov.classList.contains("rot") || e.__syn || !e.isTrusted) return;
  const t = e.target; if (!(t instanceof Element) || !t.closest(".chart-wrap")) return;
  const fr = t.closest("svg.dw3") || (t.tagName === "CANVAS" ? t : t.closest(".chart-wrap")), r = fr.getBoundingClientRect();
  const m = (cx, cy) => ({x:r.left + (cy - r.top), y:r.top + (r.right - cx)});
  let n;
  if (e.type.startsWith("touch")){
    const conv = list => Array.from(list, tt => { const q = m(tt.clientX, tt.clientY); return new Touch({identifier:tt.identifier, target:tt.target, clientX:q.x, clientY:q.y, screenX:q.x, screenY:q.y, pageX:q.x, pageY:q.y}); });
    n = new TouchEvent(e.type, {bubbles:true, cancelable:true, composed:true, touches:conv(e.touches), targetTouches:conv(e.targetTouches), changedTouches:conv(e.changedTouches)});
  } else {
    const q = m(e.clientX, e.clientY), init = {bubbles:true, cancelable:true, composed:true, view:window, clientX:q.x, clientY:q.y, screenX:q.x, screenY:q.y, button:e.button, buttons:e.buttons, detail:e.detail, ctrlKey:e.ctrlKey, shiftKey:e.shiftKey};
    if (e.type.startsWith("pointer")) Object.assign(init, {pointerId:e.pointerId, pointerType:e.pointerType, isPrimary:e.isPrimary, width:e.width, height:e.height, pressure:e.pressure});
    n = e.type.startsWith("pointer") ? new PointerEvent(e.type, init) : new MouseEvent(e.type, init);
  }
  n.__syn = true; e.stopImmediatePropagation(); t.dispatchEvent(n);
}
const RE = ["mousedown","mousemove","mouseup","touchstart","touchmove","touchend","touchcancel","pointerdown","pointermove","pointerup","pointercancel"];
function openFS(){
  if (FS || !cur) return; const cc = cur.cc, par = cc.parentElement; if (!par) return;
  const ov = document.createElement("div"); ov.className = "fs3";
  const g = CH.geo(), sym = g ? g.sym : "", p = M.get(sym);
  ov.innerHTML = `<div class="fs3-h"><button class="fs3-x" aria-label="Close full screen">${U.ic("close", 18)}</button><b>${esc(p ? M.label ? M.label(p) : sym : sym)}</b><span class="grow"></span><b class="num fs3-px"></b></div>`;
  const nodes = [par.querySelector(":scope > .tfbar"), cc, par.querySelector(":scope > .indbar")].filter(Boolean), marks = [];
  nodes.forEach(n => { const m = document.createElement("span"); m.hidden = true; n.before(m); marks.push(m); });
  nodes.forEach(n => ov.appendChild(n));
  document.body.appendChild(ov); document.body.classList.add("fs-on");
  FS = {ov, nodes, marks, entered:false};
  RE.forEach(t => ov.addEventListener(t, remap, true));
  ov.querySelector(".fs3-x").onclick = () => closeFS();
  const upd = () => { const q = M.get(sym), e = ov.querySelector(".fs3-px"); if (e && q && q.price) e.textContent = M.fmtPx(q, q.price); }; upd(); FS.tm = setInterval(upd, 1000);
  FS.onRs = () => fsLayout(); window.addEventListener("resize", FS.onRs); window.addEventListener("orientationchange", FS.onRs);
  FS.onKey = e => { if (e.key === "Escape") closeFS(); }; document.addEventListener("keydown", FS.onKey);
  FS.onHash = () => closeFS(true); window.addEventListener("hashchange", FS.onHash);
  fsLayout();
  if (isPhone()){ try { const r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); (r || Promise.resolve()).then(() => { FS && (FS.entered = true); return screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape"); }).then(() => fsLayout()).catch(() => fsLayout()); } catch {} }
  setTimeout(() => { try { CH.resize(); } catch {} }, 60);
}
function closeFS(quiet){
  if (!FS) return; const f = FS; FS = null; clearInterval(f.tm);
  window.removeEventListener("resize", f.onRs); window.removeEventListener("orientationchange", f.onRs); document.removeEventListener("keydown", f.onKey); window.removeEventListener("hashchange", f.onHash);
  f.nodes.forEach((n, i) => { const m = f.marks[i]; if (m.isConnected) m.replaceWith(n); else n.remove(); f.marks[i].remove(); });
  f.ov.remove(); document.body.classList.remove("fs-on");
  try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch {}
  if (f.entered && document.fullscreenElement){ try { document.exitFullscreen(); } catch {} }
  setTimeout(() => { try { CH.resize(); } catch {} }, 60); setTimeout(() => { try { CH.resize(); } catch {} }, 350);
}
CH.openFS = openFS; CH.closeFS = closeFS;
document.addEventListener("fullscreenchange", () => { if (FS && FS.entered && !document.fullscreenElement) closeFS(); });

/* header buttons (pencil / expand / the mini chart's expand link) — captured before the page's own handlers */
document.addEventListener("click", e => {
  const dt = e.target.closest("[data-drawt]"); if (dt && cur){ e.stopImmediatePropagation(); e.preventDefault(); showBar(cur.bar.classList.contains("hide")); return; }
  const fs = e.target.closest("[data-fs],.tfbar a.ti[href^='#/chart']"); if (fs && cur){ e.stopImmediatePropagation(); e.preventDefault(); FS ? closeFS() : openFS(); }
}, true);
})();
