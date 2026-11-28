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
  {k:"SR", n:"Support/Resistance", main:1, f:[N("lv","Zones per side (1-3)"), N("k","Pivot strength")]},
  {k:"LIQ", n:"Liquidation", main:1, f:[["lev","Leverages (comma list)","t"], N("bins","Resolution (bins)")]},
  {k:"AI", n:"AI Forecast", main:1, bin:1, f:[]},
  {k:"VOL", n:"VOL", f:[]},
  {k:"RSI", n:"RSI", f:[N("n","Period"), C("c","Colour")]},
  {k:"MACD", n:"MACD", f:[N("f","Fast"), N("s","Slow"), N("g","Signal"), C("c","MACD colour"), C("cs","Signal colour")]}
];
const hex = v => /^#[0-9a-f]{6}$/i.test(v) ? v : "#2e6bff";
let tmr = 0;
/* indicator chips: full names; SuperTrend + Liquidation get a faint "hot" background, glow and a flame icon */
const CHIP = {SR:["Support/Resistance", 0], LIQ:["Liquidation", 1], SUPER:["SuperTrend", 1], AI:["AI Forecast", 2]};
const spark = `<svg class="aispark" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><defs><linearGradient id="aisgc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4FC3F7"/><stop offset=".55" stop-color="#6C7BFF"/><stop offset="1" stop-color="#B15CFF"/></linearGradient></defs><path fill="url(#aisgc)" d="M12 2C12.6 7.5 16.5 11.4 22 12C16.5 12.6 12.6 16.5 12 22C11.4 16.5 7.5 12.6 2 12C7.5 11.4 11.4 7.5 12 2Z"/></svg>`;
const flame = k => `<svg class="flame" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><defs><linearGradient id="flg${k}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF3B1D"/><stop offset=".55" stop-color="#FF8A00"/><stop offset="1" stop-color="#FFD24A"/></linearGradient></defs><path fill="url(#flg${k})" d="M12.5 2c.5 3.4-1.3 5-2.8 6.9C8.1 10.8 6.4 12.7 6.4 15.5 6.4 19 9 22 12.4 22s6-3 6-6.6c0-2.3-1-4-2.3-5.4-.2 1.3-.9 2.3-1.9 2.7.7-3.6-.3-7.7-2.1-10.7z"/></svg>`;
function decorate(){ document.querySelectorAll("[data-ind]").forEach(b => { const c = CHIP[b.dataset.ind]; if (!c || b.dataset.dec) return; b.dataset.dec = "1"; b.innerHTML = (c[1] === 2 ? spark : c[1] ? flame(b.dataset.ind) : "") + `<span>${c[0]}</span>`; if (c[1]) b.classList.add("hot"); b.setAttribute("aria-label", c[0]); }); }
const syncRow = () => { decorate(); document.querySelectorAll("[data-ind]").forEach(b => b.classList.toggle("on", CH.inds.includes(b.dataset.ind))); };

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
    return sec("Main chart", SCH.filter(x => x.main && (!x.bin || CH.mode === "bin"))) + sec("Sub chart", SCH.filter(x => !x.main)) + `<div class="ip-note">Up to ${CH.MAXI} indicators at a time (VOL not counted). Values are saved on this device.</div>`;
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
/* v7.4 toolbar icons: ruler (measure) + chart settings (lines + gear hexagon) */
const IC_RULER = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 16.5 16.5 3.5l4 4-13 13z"/><path d="M7 13l1.8 1.8M10 10l2.6 2.6M13 7l1.8 1.8M16 4.5l1.2 1.2"/></svg>`;
const IC_CSET = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18M3 11h6M3 17h6"/><path d="M16 9.2l4.2 2.4v4.8L16 18.8l-4.2-2.4v-4.8z"/><circle cx="16" cy="14" r="1.6"/></svg>`;
const msrBtn = () => `<button class="ti" data-measure aria-label="Measure">${IC_RULER}</button>`;
const csetBtn = () => `<button class="ti" data-chset aria-label="Chart settings">${IC_CSET}</button>`;
/* toolbar order on every chart: intervals … | measure | pencil | chart settings | full screen (corner). The candle/line toggle and the grid icon are gone. */
function arrangeBar(tb){
  if (!tb) return;
  tb.querySelectorAll(":scope > [data-ctype], :scope > [data-indset]").forEach(b => b.remove());
  if (!tb.querySelector("[data-measure]")) tb.insertAdjacentHTML("beforeend", msrBtn());
  if (!tb.querySelector("[data-drawt]")) tb.insertAdjacentHTML("beforeend", penBtn());
  if (!tb.querySelector("[data-chset]")) tb.insertAdjacentHTML("beforeend", csetBtn());
  if (!tb.querySelector("[data-fs],a.ti[href^='#/chart']")) tb.insertAdjacentHTML("beforeend", fsBtn());
  [tb.querySelector("[data-measure]"), tb.querySelector("[data-drawt]"), tb.querySelector("[data-chset]"), tb.querySelector("[data-fs],a.ti[href^='#/chart']")].forEach(b => b && tb.appendChild(b));
}
let cur = null;   // {svg, bar, wrap, box}

function wrapHost(container, parts){
  const compact = !!parts.compact, withTf = parts.tfbar != null ? !!parts.tfbar : !!parts.sym;
  const tfs = parts.tfs || (compact ? ["1m","5m","15m","1h","4h","1d"] : ["1s","1m","5m","15m","1h","4h","1d"]);
  const box = document.createElement("div"); box.className = "ch3-box" + (compact ? " compact" : "");
  container.parentNode.insertBefore(box, container);
  const h = parts.height || container.style.height || (compact ? "240px" : "300px");
  box.innerHTML = (withTf ? `<div class="tfbar x3"><div class="tfs">${tfs.map(x => `<button data-x3tf="${x}">${TFLAB[x] || x}</button>`).join("")}</div>${msrBtn()}${penBtn()}${csetBtn()}${fsBtn()}</div>` : "") +
    `<div class="cp-chart"><div class="chart-wrap" style="height:${h};min-height:0;max-height:none"><div class="legend"></div><div class="chart-msg"></div></div></div>`;
  const wrap = box.querySelector(".chart-wrap"); wrap.insertBefore(container, wrap.firstChild);
  container.style.cssText += ";position:absolute;inset:0;height:auto;width:auto";
  parts.legend = parts.legend || wrap.querySelector(".legend"); parts.msg = parts.msg || wrap.querySelector(".chart-msg");
  return box;
}
function toggleInd(k){ const l = CH.inds.includes(k) ? CH.inds.filter(x => x !== k) : [...CH.inds, k]; CH.setInds(l); syncRow(); }

const mount0 = CH.mount, setInds0 = CH.setInds, destroy0 = CH.destroy;
CH.setInds = function(){ const r = setInds0.apply(this, arguments); try { syncRow(); } catch {} return r; };
CH.destroy = function(){ try { closeFS(true); } catch {} try { tfPopClose(); } catch {} try { styleClose(); msClear(); MS.layer = null; } catch {} cur = null; return destroy0.apply(this, arguments); };
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
    arrangeBar(tb);   // every chart: measure, drawing, chart settings, full screen (options too)
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
      if (parts.mode === "bin" && !parts.noInd && !row.querySelector('[data-ind="AI"]')){   // v7.1 AI Forecast: last in the main-chart group, after Support/Resistance, SuperTrend, Liquidation
        const anchor = row.querySelector('[data-ind="LIQ"]') || row.querySelector('[data-ind="SR"]'); if (anchor) anchor.insertAdjacentHTML("afterend", `<button data-ind="AI">AI</button>`);
      }
      const ib = root.querySelector("[data-indinfo]"); if (ib){ ib.innerHTML = ICON; ib.classList.add("ind-set"); ib.setAttribute("aria-label", "Indicator settings"); }
      if (!root._ch3){ root._ch3 = 1; root.addEventListener("click", e => { if (e.target.closest("[data-indinfo],[data-indset]")){ e.stopPropagation(); e.preventDefault(); open(); } }, true); }
    }
    syncRow();
    initDraw(container);
    if (box && parts.sym){ const tfsEl = box.querySelectorAll("[data-x3tf]"); let tf = parts.tf || sessionStorage.getItem("tf_ch3") || "1m";
      if (tfsEl.length && ![...tfsEl].some(b => b.dataset.x3tf === tf)) tf = tfsEl[Math.min(2, tfsEl.length - 1)].dataset.x3tf;
      const go = x => { tf = x; try { sessionStorage.setItem("tf_ch3", x); } catch {} tfsEl.forEach(b => b.classList.toggle("on", b.dataset.x3tf === x)); CH.load(parts.sym, x); };
      tfsEl.forEach(b => b.onclick = () => go(b.dataset.x3tf)); go(tf); }
    else if (parts.sym && !box) CH.load(parts.sym, parts.tf || "1m");
  } catch (e) { console.warn(e); }
  return r;
};

/* ================= drawing tools ================= */
const NS = "http://www.w3.org/2000/svg", BLUE = "#2E6BFF";
const dstore = sym => { const s = store.s; s.drawings = s.drawings || {}; if (!s.drawings[sym]){ let a = []; try { a = (JSON.parse(localStorage.getItem("draw_" + sym) || "[]") || []).filter(d => ["trend","ray","hline","vline","rect"].includes(d.k)).map((d, i) => Object.assign({id:"m" + i + Date.now()}, d)); } catch {} s.drawings[sym] = a; } return s.drawings[sym]; };
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
  bar.innerHTML = [["trend","Trend line"],["hline","H-line"],["vline","V-line"],["ray","Ray"],["rect","Rect"]].map(([k, n]) => `<button data-dt="${k}">${n}</button>`).join("") +
    `<button data-dsty class="dw3-sty" aria-label="Line colour and style"><i class="dw3-sw"></i><i class="dw3-ln"></i></button><button data-dsel class="dis">${U.ic("trash", 13)} Delete</button><button data-dclr>Clear all</button><span class="dw3-hint"></span><button data-dx class="dw3-x" aria-label="Close tools">${U.ic("close", 14)}</button>`;
  cc.insertBefore(bar, wrap); styBtn(bar);
  cur = {svg, bar, wrap, cc, g:svg.querySelector(".dwr"), clip:svg.querySelector("rect")};
  D = Object.assign(D, {tool:null, sel:null, temp:null, st:null}); D.els = new Map();
  bar.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.dt){ U.buzz(8); setTool(D.tool === b.dataset.dt ? null : b.dataset.dt); return; }
    if (b.hasAttribute("data-dsty")){ U.buzz(8); stylePop(b); return; }
    if (b.hasAttribute("data-dsel")){ if (D.sel){ const g = CH.geo(); if (g){ const a = dstore(g.sym), i = a.findIndex(d => d.id === D.sel); if (i >= 0){ a.splice(i, 1); dsave(); } } select(null); } return; }
    if (b.hasAttribute("data-dclr")){ const g = CH.geo(); if (g){ store.s.drawings[g.sym] = []; dsave(); select(null); U.toast("Drawings cleared", "ok", 1200); } return; }
    if (b.hasAttribute("data-dx")) showBar(false);
  });
  svg.addEventListener("pointerdown", onDown); svg.addEventListener("pointermove", onMove); svg.addEventListener("pointerup", onUp); svg.addEventListener("pointercancel", () => { D.st = null; });
  svg.addEventListener("touchstart", e => { if (D.tool || e.target.closest(".hit,.hd")) e.preventDefault(); }, {passive:false});
  wrap.addEventListener("pointerdown", e => { if (D.sel && !e.target.closest(".dw3")) select(null); }, true);
  /* v7.4: while the drawing tools are open, a plain tap on the chart hides the tool row; the next tap brings it back */
  let tp = null;
  wrap.addEventListener("pointerdown", e => { tp = cur && !cur.bar.classList.contains("hide") && !D.tool && !MS.phase && !e.target.closest(".hit,.hd,[data-mk],[data-drag],[data-qo],.mkpop,.lqbox,.lqpop,.aibox,.auto-btn") ? {x:e.clientX, y:e.clientY, t:Date.now()} : null; }, true);
  wrap.addEventListener("pointerup", e => { const s0 = tp; tp = null; if (!s0 || D.tool || MS.phase || !cur || Math.hypot(e.clientX - s0.x, e.clientY - s0.y) > 8 || Date.now() - s0.t > 450) return;
    styleClose(); cur.bar.classList.toggle("peek"); }, true);
  initMeasure(wrap);
  CH.frame = () => { renderDW(); renderMeasure(); };
}
function showBar(on){ if (!cur) return; cur.bar.classList.toggle("hide", !on); cur.bar.classList.remove("peek"); styleClose(); if (on) msClear(); (FS ? FS.ov : cur.cc.parentElement).querySelectorAll("[data-drawt]").forEach(b => b.classList.toggle("on", on)); if (!on){ setTool(null); select(null); } }
function setTool(t){ D.tool = t; D.temp = null; if (cur){ cur.svg.classList.toggle("on", !!t); cur.bar.querySelectorAll("[data-dt]").forEach(b => b.classList.toggle("on", b.dataset.dt === t)); hint(t ? (t === "hline" || t === "vline" ? "Tap the chart to place the line" : "Tap the first point") : ""); } if (t) select(null); }
function hint(t){ const h = cur && cur.bar.querySelector(".dw3-hint"); if (h) h.textContent = FS ? (t || "") : ""; if (t && !FS) U.toast(t, "info", 1400); }
function select(id){ D.sel = id; if (cur) cur.bar.querySelector("[data-dsel]").classList.toggle("dis", !id); D.els.forEach(e => e.g.classList.toggle("sel", e.id === id)); try { styBtn(); } catch {} }
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
function finish(d){ const g = CH.geo(); const a = dstore(g.sym); d.id = did(); const st = dsty(); d.c = st.c; d.ls = st.ls; a.push(d); dsave(); D.temp = null; setTool(null); select(d.id); }
function onUp(e){
  if (!cur || !D.tool || !D.st || D.st.mode !== "new") return; const g = CH.geo(); const s0 = D.st; D.st = null; if (!g) return; const l = loc(e), q = P(g, l.x, l.y); if (!q) return;
  if (D.tool === "hline") return finish({k:"hline", p:q.p, a:q, b:q});
  if (D.tool === "vline") return finish({k:"vline", a:q, b:q});
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
  if (d.k === "vline"){ d.a = {t:s.a.t + (q.t - s.p0.t), p:s.a.p}; d.b = d.a; return; }
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
  if (d.k === "hline" || d.k === "vline") o.txt = mk("text", "dtx" + (d.k === "vline" ? " v" : ""));
  o.ha = mk("circle", "hd", "a"); if (d.k !== "hline" && d.k !== "vline") o.hb = mk("circle", "hd", "b");
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
    paint(o, d);
    if (d.k === "vline"){
      const x = g.t2x(d.a.t); if (x == null){ o.g.style.display = "none"; return; } o.g.style.display = "";
      const A = {x1:x, x2:x, y1:0, y2:g.h}; setA(o.hit, A); setA(o.vis, A); setA(o.ha, {cx:x, cy:g.h / 2, r:7});
      setA(o.txt, {x:x + 4, y:g.h - 6}); const lb = tlab(d.a.t); if (o.txt._v !== lb){ o.txt._v = lb; o.txt.textContent = lb; } return;
    }
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

/* ---- v7.4 drawing colour + line style (6 swatches, solid / dashed / dotted) — applies to the selected drawing and to new ones ---- */
const SWATCH = ["#2E6BFF", "#F6465D", "#2EBD85", "#F7931A", "#A855F7", "#94A3B8"];
const DASH = {solid:"", dash:"6 4", dot:"0.5 3.5"};
const dsty = () => { const o = store.s.settings.drawStyle || {}; return {c: SWATCH.includes(o.c) ? o.c : SWATCH[0], ls: DASH[o.ls] != null ? o.ls : "solid"}; };
const rgba = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
function styBtn(bar){ const b = (bar || cur && cur.bar)?.querySelector("[data-dsty]"); if (!b) return; const g = CH.geo(), d = D.sel && g ? dstore(g.sym).find(x => x.id === D.sel) : null, st = d ? {c:d.c || SWATCH[0], ls:d.ls || "solid"} : dsty();
  b.style.setProperty("--dc", st.c); b.dataset.ls = st.ls; }
function paint(o, d){ const c = d.c || null, ls = DASH[d.ls || "solid"] || "", k = (c || "") + "|" + ls; if (o._p === k) return; o._p = k;
  o.vis.style.stroke = c || ""; o.vis.style.strokeDasharray = ls; o.vis.style.strokeLinecap = d.ls === "dot" ? "round" : "";
  if (o.fill) o.fill.style.fill = c ? rgba(c, .12) : ""; if (o.txt) o.txt.style.fill = c || ""; if (o.ha) o.ha.style.stroke = c || ""; if (o.hb) o.hb.style.stroke = c || ""; }
const tlab = t => { const d = new Date(t * 1000), z = n => String(n).padStart(2, "0"), MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], sc = CH.sec || 60;
  return sc >= 86400 ? `${d.getDate()} ${MO[d.getMonth()]} '${String(d.getFullYear()).slice(2)}` : `${d.getDate()} ${MO[d.getMonth()]} ${z(d.getHours())}:${z(d.getMinutes())}${sc < 60 ? ":" + z(d.getSeconds()) : ""}`; };
let SP = null;
function styleClose(){ if (!SP) return; SP.el.remove(); document.removeEventListener("pointerdown", SP.out, true); SP.btn.classList.remove("on"); SP = null; }
function stylePop(btn){
  if (SP){ styleClose(); return; } if (!cur) return;
  const g = CH.geo(), sel = D.sel && g ? dstore(g.sym).find(x => x.id === D.sel) : null, st = sel ? {c:sel.c || SWATCH[0], ls:sel.ls || "solid"} : dsty();
  const el = document.createElement("div"); el.className = "dw3-pop"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Line colour and style");
  el.innerHTML = `<div class="dsp-c">${SWATCH.map(c => `<button data-dc="${c}" class="${c === st.c ? "on" : ""}" style="--dc:${c}" aria-label="Colour ${c}"></button>`).join("")}</div>
    <div class="dsp-l">${[["solid","Solid"],["dash","Dashed"],["dot","Dotted"]].map(([k, n]) => `<button data-dl="${k}" class="${k === st.ls ? "on" : ""}" aria-label="${n}"><i class="ln-${k}"></i></button>`).join("")}</div>`;
  cur.cc.appendChild(el);
  const r = btn.getBoundingClientRect(), rc = cur.cc.getBoundingClientRect(), w = el.offsetWidth;
  el.style.left = Math.max(6, Math.min(r.left - rc.left + r.width / 2 - w / 2, cur.cc.clientWidth - w - 6)) + "px"; el.style.top = (r.bottom - rc.top + 6) + "px";
  btn.classList.add("on");
  el.addEventListener("click", e => { const c = e.target.closest("[data-dc]"), l = e.target.closest("[data-dl]"); if (!c && !l) return; U.buzz(8);
    const o = store.s.settings.drawStyle = dsty(); if (c) o.c = c.dataset.dc; if (l) o.ls = l.dataset.dl;
    const g2 = CH.geo(), d = D.sel && g2 ? dstore(g2.sym).find(x => x.id === D.sel) : null; if (d){ if (c) d.c = o.c; if (l) d.ls = o.ls; if (!d.c) d.c = o.c; }
    store.save(); el.querySelectorAll("[data-dc]").forEach(b => b.classList.toggle("on", b.dataset.dc === o.c)); el.querySelectorAll("[data-dl]").forEach(b => b.classList.toggle("on", b.dataset.dl === o.ls)); styBtn(); });
  SP = {el, btn, out: e => { if (!el.contains(e.target) && !btn.contains(e.target)) styleClose(); }};
  setTimeout(() => SP && SP.el === el && document.addEventListener("pointerdown", SP.out, true), 0);
}

/* ================= v7.4 measure tool (TradingView-style) =================
   ruler icon → tap the start point → drag / move to the end point (live box + dashed crosshair) → tap again = final box →
   the next tap anywhere on the chart removes it. Box: Δprice (Δ%) ticks / N bars, duration / Vol (USDT quote volume). */
const MS = {phase:0, a:null, b:null, layer:null, st:null, key:""};   // phase 0 off · 1 armed (no start yet) · 2 drawing · 3 final
function msBtns(){ document.querySelectorAll("[data-measure]").forEach(b => b.classList.toggle("on", MS.phase > 0)); }
function msClear(){ MS.phase = 0; MS.a = MS.b = null; MS.st = null; MS.key = ""; if (MS.layer){ MS.layer.classList.remove("armed"); MS.layer.innerHTML = ""; } msBtns(); }
function armMeasure(){
  if (!MS.layer || !CH.geo()) return; if (MS.phase){ msClear(); return; }
  if (cur){ setTool(null); select(null); if (!cur.bar.classList.contains("hide")) showBar(false); }
  MS.phase = 1; MS.layer.classList.add("armed"); msBtns(); U.toast("Tap the start point, then the end point", "info", 1500);
}
function snapT(t){ const bs = CH.bars, sc = CH.sec || 60; if (!bs || !bs.length) return t; const L = bs.length - 1, lt = bs[L].time;
  if (t >= lt) return lt + Math.round((t - lt) / sc) * sc; let lo = 0, hi = L; while (lo < hi){ const m = (lo + hi) >> 1; if (bs[m].time < t) lo = m + 1; else hi = m; }
  return lo > 0 && t - bs[lo - 1].time < bs[lo].time - t ? bs[lo - 1].time : bs[lo].time; }
function msPt(e){ const g = CH.geo(); if (!g || !MS.layer) return null; const r = MS.layer.getBoundingClientRect(), x = Math.min(e.clientX - r.left, g.pw - 1), y = Math.max(0, Math.min(e.clientY - r.top, g.h - 1));
  const t = g.x2t(x), p = g.y2p(y); return t == null || p == null ? null : {t:snapT(t), p}; }
function initMeasure(wrap){
  wrap.querySelector(".msr")?.remove(); msClear();
  const L = MS.layer = document.createElement("div"); L.className = "msr"; wrap.appendChild(L);
  L.addEventListener("pointerdown", e => { if (MS.phase !== 1 && MS.phase !== 2) return; e.preventDefault(); e.stopPropagation(); const q = msPt(e); if (!q) return;
    try { L.setPointerCapture(e.pointerId); } catch {}
    MS.st = {x:e.clientX, y:e.clientY, moved:false};
    if (MS.phase === 1){ MS.a = q; MS.b = q; MS.phase = 2; MS.st.start = true; U.buzz(10); } else MS.b = q; });
  L.addEventListener("pointermove", e => { if (MS.phase !== 2) return; if (MS.st && Math.hypot(e.clientX - MS.st.x, e.clientY - MS.st.y) > 8) MS.st.moved = true;
    if (MS.st || e.pointerType === "mouse"){ const q = msPt(e); if (q) MS.b = q; } });
  L.addEventListener("pointerup", e => { if (MS.phase !== 2 || !MS.st) return; e.stopPropagation(); const s0 = MS.st; MS.st = null; const q = msPt(e); if (q) MS.b = q;
    if (s0.start && !s0.moved) return;   // first tap only set the start point: wait for the end point
    MS.phase = 3; L.classList.remove("armed"); U.buzz(14); msBtns(); });
  L.addEventListener("pointercancel", () => { MS.st = null; });
  L.addEventListener("touchstart", e => { if (MS.phase === 1 || MS.phase === 2) e.preventDefault(); }, {passive:false});
  // final box: the next plain tap anywhere on the chart removes it (panning still works)
  let tp = null;
  wrap.addEventListener("pointerdown", e => { tp = MS.phase === 3 ? {x:e.clientX, y:e.clientY, t:Date.now()} : null; }, true);
  wrap.addEventListener("pointerup", e => { const s0 = tp; tp = null; if (!s0 || MS.phase !== 3) return; if (Math.hypot(e.clientX - s0.x, e.clientY - s0.y) < 9 && Date.now() - s0.t < 500){ U.buzz(8); msClear(); } }, true);
}
const DUR = s => { s = Math.abs(Math.round(s)); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return d ? (h ? `${d}d ${h}h` : `${d}d`) : h ? (m ? `${h}h ${m}m` : `${h}h`) : m ? (x ? `${m}m ${x}s` : `${m}m`) : `${x}s`; };
const msT = t => { const d = new Date(t * 1000), z = n => String(n).padStart(2, "0"), MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], WD = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], sc = CH.sec || 60;
  return sc >= 86400 ? `${WD[d.getDay()]} ${z(d.getDate())} ${MO[d.getMonth()]} '${String(d.getFullYear()).slice(2)}` : `${z(d.getDate())} ${MO[d.getMonth()]} ${z(d.getHours())}:${z(d.getMinutes())}${sc < 60 ? ":" + z(d.getSeconds()) : ""}`; };
function renderMeasure(){
  const L = MS.layer; if (!L || !L.isConnected) return;
  if (MS.phase < 2 || !MS.a || !MS.b){ if (MS.key){ MS.key = ""; L.innerHTML = ""; } return; }
  const g = CH.geo(); if (!g){ return; }
  const xa = g.t2x(MS.a.t), xb = g.t2x(MS.b.t), ya = g.p2y(MS.a.p), yb = g.p2y(MS.b.p);
  if (xa == null || xb == null || ya == null || yb == null){ if (MS.key){ MS.key = ""; L.innerHTML = ""; } return; }
  const W = g.el.clientWidth, Hc = g.el.clientHeight, pw = g.pw, H = g.h, P = M.get(g.sym), dp = P?.dp ?? 2;
  const key = [xa, xb, ya, yb, MS.phase, W, Hc, document.documentElement.dataset.theme].map(v => typeof v === "number" ? Math.round(v * 2) / 2 : v).join("|");
  if (key === MS.key) return; MS.key = key;
  const up = MS.b.p >= MS.a.p, col = up ? "#2E6BFF" : "#F6465D", fill = up ? "rgba(46,107,255,.17)" : "rgba(246,70,93,.15)";
  const dP = MS.b.p - MS.a.p, pc = MS.a.p ? dP / MS.a.p * 100 : 0, ticks = Math.round(dP * Math.pow(10, dp));
  const sc = CH.sec || 60, t0 = Math.min(MS.a.t, MS.b.t), t1 = Math.max(MS.a.t, MS.b.t), nb = Math.round((MS.b.t - MS.a.t) / sc);
  let vol = 0, usd = false; (CH.bars || []).forEach(b => { if (b.time >= t0 && b.time <= t1){ if (b.qv != null){ vol += b.qv; usd = true; } else vol += b.volume || 0; } });
  const fv = CH.fmtVol ? CH.fmtVol(vol) : vol.toFixed(2);
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), y0 = Math.min(ya, yb), y1 = Math.max(ya, yb), xm = (xa + xb) / 2, ym = (ya + yb) / 2;
  const hd = 5, vy = yb, vdir = yb < ya ? 1 : -1, hdir = xb >= xa ? -1 : 1;
  let svg = `<rect x="${x0}" y="${y0}" width="${Math.max(1, x1 - x0)}" height="${Math.max(1, y1 - y0)}" fill="${fill}"/>`;
  if (Math.abs(yb - ya) > 2) svg += `<path d="M${xm} ${ya}V${yb}M${xm - hd} ${vy + vdir * hd}L${xm} ${vy}L${xm + hd} ${vy + vdir * hd}" stroke="${col}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (Math.abs(xb - xa) > 2) svg += `<path d="M${xa} ${ym}H${xb}M${xb + hdir * hd} ${ym - hd}L${xb} ${ym}L${xb + hdir * hd} ${ym + hd}" stroke="${col}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (MS.phase === 2) svg += `<path d="M${xb} 0V${Hc}M0 ${yb}H${pw}" stroke="${col}" stroke-width="1" stroke-dasharray="4 4" fill="none"/><circle cx="${xb}" cy="${yb}" r="4.5" fill="${col}" stroke="var(--cbg,#fff)" stroke-width="1.5"/>`;
  // axis bands
  svg += `<rect x="${pw}" y="${y0}" width="${W - pw}" height="${Math.max(1, y1 - y0)}" fill="${fill}"/>`;
  const ax = Hc - 24; if (ax > H) svg += `<rect x="${x0}" y="${ax}" width="${Math.max(1, x1 - x0)}" height="24" fill="${fill}"/>`;
  const fx = v => M.fmtPx(P, v), sg = v => v > 0 ? "+" : v < 0 ? "-" : "";
  const l1 = `${sg(dP)}${fx(Math.abs(dP))} (${sg(pc)}${Math.abs(pc).toFixed(2)}%) ${sg(ticks)}${Math.abs(ticks).toLocaleString("en-US")}`, l2 = `${Math.abs(nb).toLocaleString("en-US")} bar${Math.abs(nb) === 1 ? "" : "s"}, ${DUR(MS.b.t - MS.a.t)}`, l3 = `Vol ${fv}${usd ? " USDT" : ""}`;
  let html = `<svg class="msr-svg" width="${W}" height="${Hc}" viewBox="0 0 ${W} ${Hc}" aria-hidden="true">${svg}</svg>`;
  const plab = (y, v) => `<div class="msr-pl" style="top:${y}px;left:${pw}px;background:${col}">${fx(v)}</div>`;
  html += plab(yb, MS.b.p); if (Math.abs(yb - ya) >= 17) html += plab(ya, MS.a.p);
  if (ax > H){ const tl = (x, t) => `<div class="msr-tl" style="left:${x}px;top:${ax + 12}px;background:${col}">${msT(t)}</div>`; html += tl(xb, MS.b.t); if (Math.abs(xb - xa) >= 104) html += tl(xa, MS.a.t); }
  html += `<div class="msr-info" style="background:${col}" data-up="${up ? 1 : 0}"><div class="num">${l1}</div><div class="num">${l2}</div><div class="num">${l3}</div></div>`;
  L.innerHTML = html;
  const info = L.querySelector(".msr-info"), iw = info.offsetWidth, ih = info.offsetHeight;
  let top = up ? y0 - ih - 8 : y1 + 8; if (top < 2) top = y1 + 8; if (top + ih > H - 2) top = Math.max(2, y0 - ih - 8);
  info.style.left = Math.max(4, Math.min(xm - iw / 2, pw - iw - 4)) + "px"; info.style.top = Math.max(2, Math.min(top, H - ih - 2)) + "px";
}

/* ================= v7.4 chart settings sheet (toolbar icon: lines + gear) — only what this chart really supports =================
   store.s.settings.chart: ord, pos, tpsl, liq, bs, cd, hilo, pl (default ON = what the chart showed before) + al (price alerts, default OFF) */
const ICS = {
  ind:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m6 15 4-5 3 3 6-7"/></svg>`,
  draw:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>`,
  msr: IC_RULER
};
function chartSettings(){
  const md = CH.mode, cp0 = () => store.s.settings.chart || {}, on = k => k === "al" ? cp0()[k] === true : cp0()[k] !== false;
  const ORD = md === "bin" ? [["pos","Positions"],["bs","Order history"]] : md === "none" ? [] : [["ord","Open orders"],["pos","Positions"],["tpsl","TP / SL"],["liq","Liquidation price"],["bs","Order history"]];
  const DISP = [["cd","Countdown"],["hilo","High / Low"],["pl","Last price line"], ...(md === "none" ? [] : [["al","Price alerts"]])];
  const chip = ([k, n]) => `<button class="cs-chip${on(k) ? " on" : ""}" data-cs="${k}" aria-pressed="${on(k)}">${n}<i class="cs-ck" aria-hidden="true"><svg viewBox="0 0 12 12" width="9" height="9"><path d="M2.5 6.2 5 8.6 9.6 3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></i></button>`;
  U.sheet("Chart settings", `<div class="cs">
    <div class="cs-top"><button data-csa="ind">${ICS.ind}<span>Indicators</span></button><button data-csa="draw">${ICS.draw}<span>Drawing</span></button><button data-csa="msr">${ICS.msr}<span>Measure</span></button></div>
    ${ORD.length ? `<div class="cs-sec">Order display</div><div class="cs-grid">${ORD.map(chip).join("")}</div>` : ""}
    <div class="cs-sec">Chart display</div><div class="cs-grid">${DISP.map(chip).join("")}</div></div>`, el => {
    el.addEventListener("click", e => {
      const a = e.target.closest("[data-csa]"); if (a){ U.buzz(8); U.closeLayer(); const k = a.dataset.csa; setTimeout(() => { if (k === "ind") open(); else if (k === "draw") showBar(true); else if (!MS.phase) armMeasure(); }, 60); return; }
      const c = e.target.closest("[data-cs]"); if (!c) return; const k = c.dataset.cs, v = !on(k);
      store.s.settings.chart = Object.assign({}, cp0(), {[k]: v}); store.save(); c.classList.toggle("on", v); c.setAttribute("aria-pressed", v); U.buzz(8);
      U.bus.emit("chartprefs");
    });
  });
}
CH.chartSettings = chartSettings; CH.measure = armMeasure;

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

/* ================= interval picker: compact popover card under the interval row (replaces the bottom sheet) =================
   CH.tfPop(anchorBtn, [[key,label],...], currentKey, onPick) — tap outside / Esc / scroll closes it; tapping the anchor again toggles it */
let TFP = null;
function tfPopClose(){ if (!TFP) return; const t = TFP; TFP = null; t.el.remove(); t.anchor.classList.remove("open"); t.anchor.setAttribute("aria-expanded", "false");
  document.removeEventListener("pointerdown", t.out, true); window.removeEventListener("resize", t.cl); window.removeEventListener("hashchange", t.cl); document.removeEventListener("scroll", t.sc, true); document.removeEventListener("keydown", t.key); }
function tfPop(anchor, items, cur, pick){
  if (TFP && TFP.anchor === anchor){ tfPopClose(); return; } tfPopClose(); if (!anchor) return;
  const el = document.createElement("div"); el.className = "tfpop"; el.setAttribute("role", "listbox"); el.setAttribute("aria-label", "Interval");
  el.innerHTML = items.map(([k, l]) => `<button type="button" data-tfp="${esc(k)}" role="option" aria-selected="${k === cur}" class="${k === cur ? "on" : ""}">${esc(l)}</button>`).join("");
  const fs = anchor.closest(".fs3"), row = anchor.closest(".tfbar") || anchor;
  if (fs){ fs.appendChild(el); el.style.position = "absolute"; el.style.right = "8px"; el.style.top = (row.offsetTop + row.offsetHeight + 4) + "px"; }
  else { document.body.appendChild(el); const r = row.getBoundingClientRect(), a = anchor.getBoundingClientRect(), w = el.offsetWidth;
    el.style.top = Math.round(r.bottom + 4) + "px"; el.style.left = Math.round(Math.max(12, Math.min(a.right - w, innerWidth - w - 12))) + "px"; }
  anchor.classList.add("open"); anchor.setAttribute("aria-expanded", "true");
  const t = TFP = {el, anchor, cl: () => tfPopClose(), key: e => { if (e.key === "Escape") tfPopClose(); },
    sc: e => { if (!el.contains(e.target)) tfPopClose(); },
    out: e => { if (!el.contains(e.target) && !anchor.contains(e.target)) tfPopClose(); }};
  el.addEventListener("click", e => { const b = e.target.closest("[data-tfp]"); if (!b) return; U.buzz(8); tfPopClose(); pick(b.dataset.tfp); });
  setTimeout(() => { if (TFP !== t) return; document.addEventListener("pointerdown", t.out, true); window.addEventListener("resize", t.cl); window.addEventListener("hashchange", t.cl); document.addEventListener("scroll", t.sc, true); document.addEventListener("keydown", t.key); }, 0);
}
CH.tfPop = tfPop; CH.tfPopClose = tfPopClose;
document.addEventListener("fullscreenchange", () => { if (FS && FS.entered && !document.fullscreenElement) closeFS(); });

/* header buttons (pencil / expand / the mini chart's expand link) — captured before the page's own handlers */
document.addEventListener("click", e => {
  const dt = e.target.closest("[data-drawt]"); if (dt && cur){ e.stopImmediatePropagation(); e.preventDefault(); U.buzz(8); showBar(cur.bar.classList.contains("hide")); return; }
  const ms = e.target.closest("[data-measure]"); if (ms && cur){ e.stopImmediatePropagation(); e.preventDefault(); U.buzz(8); armMeasure(); return; }
  const cs = e.target.closest("[data-chset]"); if (cs && cur){ e.stopImmediatePropagation(); e.preventDefault(); U.buzz(8); chartSettings(); return; }
  const fs = e.target.closest("[data-fs],.tfbar a.ti[href^='#/chart']"); if (fs && cur){ e.stopImmediatePropagation(); e.preventDefault(); FS ? closeFS() : openFS(); }
}, true);

/* ================= quick order sheet (the "+" on the live price tag): Long/Short on futures, Buy/Sell on spot ================= */
const FEE_F = () => (window.C && C.FEE) || 0.0001;
function qoOpen(sym, side){
  sym = sym || (CH.geo() && CH.geo().sym); const p = sym && M.get(sym); if (!p || !p.price) return U.toast("Price unavailable", "bad");
  (/^#\/spot\b/.test(location.hash) || /^#\/chart\b.*[?&]spot\b/.test(location.hash) ? qoSpot : qoFut)(sym, p, side);
}
const SEG = (attr, items, cur) => `<div class="oc qo-seg">${items.map(([v, l]) => `<button ${attr}="${v}" class="${v === cur ? "on" : ""}">${l}</button>`).join("")}</div>`;
function qoFut(sym, p){
  const s = store.s; let side = "long", ot = "market", lev = Math.min(s.settings.lev || 20, E.maxLev(p)), mode = s.settings.marginMode || "cross", ts = false;
  const levs = [3, 5, 10, 20, 50, 75, 100, 125].filter(x => x <= E.maxLev(p)); if (!levs.includes(lev)) levs.push(lev); levs.sort((a, b) => a - b);
  U.sheet(`Quick order · ${esc(M.label ? M.label(p) : sym)} Perp`, `<div class="qo">
    ${SEG("data-sd", [["long", "Long"], ["short", "Short"]], side)}
    ${SEG("data-ot", [["market", "Market"], ["limit", "Limit"]], ot)}
    <div class="famt qo-px hide"><input id="qopx" type="number" inputmode="decimal" placeholder="Limit price"><span>USDT</span></div>
    <div class="famt"><input id="qoa" type="number" inputmode="decimal" placeholder="Cost (margin)"><span>USDT</span></div>
    <div class="chips qo-pc">${[10, 25, 50, 75, 100].map(v => `<button data-qp="${v}">${v}%</button>`).join("")}</div>
    <div class="qo-lab">Leverage</div><div class="chips qo-lv">${levs.map(x => `<button data-lv="${x}" class="${x === lev ? "on" : ""}">${x}x</button>`).join("")}</div>
    <div class="qo-lab">Margin mode</div>${SEG("data-qm", [["cross", "Cross"], ["isolated", "Isolated"]], mode)}
    <label class="qo-tp"><input type="checkbox" id="qots"> <span>TP / SL</span></label>
    <div class="qo-tpsl hide"><div class="famt"><input id="qotp" type="number" inputmode="decimal" placeholder="Take profit price"></div><div class="famt"><input id="qosl" type="number" inputmode="decimal" placeholder="Stop loss price"></div></div>
    <div class="fkv"><span>Avbl</span><b class="num">${U.money(store.wb("futures"))} USDT <button class="wl-plus" data-wlto="futures" aria-label="Transfer in">${U.ic("plus", 13, 3)}</button></b></div>
    <div class="fkv"><span>Position size</span><b class="num" id="qosz">--</b></div><div class="fkv"><span>Est. liq. price</span><b class="num" id="qolq">--</b></div><div class="fkv"><span>Fee (est.)</span><b class="num" id="qofee">--</b></div>
    <button class="fbtn2 l" id="qogo"><span>Open Long</span></button></div>`, el => {
    const $ = q => el.querySelector(q), px = () => ot === "limit" ? (parseFloat($("#qopx").value) || 0) : p.price;
    const upd = () => { const c = parseFloat($("#qoa").value) || 0, ep = px() || p.price, sz = c * lev, q = sz / ep, lq = c ? E.liqPrice(side, ep, lev, mode, q, c) : 0;
      $("#qosz").textContent = c ? U.money(sz) + " USDT" : "--"; $("#qolq").textContent = lq > 0 ? M.fmtPx(p, lq) : "--"; $("#qofee").textContent = c ? U.money(sz * FEE_F()) + " USDT" : "--";
      const g = $("#qogo"); g.className = "fbtn2 " + (side === "long" ? "l" : "s"); g.querySelector("span").textContent = (ot === "limit" ? "Limit " : "") + (side === "long" ? "Open Long" : "Open Short"); };
    el.querySelectorAll("[data-sd]").forEach(b => b.onclick = () => { side = b.dataset.sd; el.querySelectorAll("[data-sd]").forEach(x => x.classList.toggle("on", x === b)); U.buzz(8); upd(); });
    el.querySelectorAll("[data-ot]").forEach(b => b.onclick = () => { ot = b.dataset.ot; el.querySelectorAll("[data-ot]").forEach(x => x.classList.toggle("on", x === b)); $(".qo-px").classList.toggle("hide", ot !== "limit"); if (ot === "limit" && !$("#qopx").value) $("#qopx").value = M.fmtPx(p, p.price).replace(/,/g, ""); U.buzz(8); upd(); });
    el.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { lev = +b.dataset.lv; el.querySelectorAll("[data-lv]").forEach(x => x.classList.toggle("on", x === b)); U.buzz(8); upd(); });
    el.querySelectorAll("[data-qm]").forEach(b => b.onclick = () => { mode = b.dataset.qm; el.querySelectorAll("[data-qm]").forEach(x => x.classList.toggle("on", x === b)); U.buzz(8); upd(); });
    $("#qots").onchange = e => { ts = e.target.checked; $(".qo-tpsl").classList.toggle("hide", !ts); };
    el.querySelectorAll("[data-qp]").forEach(b => b.onclick = () => { $("#qoa").value = Math.floor(store.wb("futures") / (1 + lev * FEE_F()) * +b.dataset.qp) / 100; upd(); });
    $("#qoa").oninput = upd; $("#qopx").oninput = upd;
    $("#qogo").onclick = () => {
      const c = parseFloat($("#qoa").value) || 0, lp = ot === "limit" ? parseFloat($("#qopx").value) || 0 : null;
      if (ot === "limit" && !(lp > 0)) return U.toast("Please enter the price", "bad");
      if (!(c > 0)) return U.toast("Please enter the cost", "bad");
      const tp = ts ? parseFloat($("#qotp").value) || null : null, sl = ts ? parseFloat($("#qosl").value) || null : null;
      const r = E.openFut({sym, side, margin:c, lev, type:ot, price:lp, tp, sl, mode});
      if (r.err){ U.toast(r.err, "bad"); window.UI && UI.walletErr && UI.walletErr(r.err); return; }
      if (tp || sl) E.award && E.award("tpsl");
      s.settings.lev = lev; store.save(); U.closeLayer(); U.fx("open");
      U.toast(r.order ? `Limit order placed: ${side === "long" ? "Long" : "Short"} ${M.label(p)} ${lev}x` : `Order filled: ${side === "long" ? "Long" : "Short"} ${M.label(p)} ${lev}x`, "ok");
    };
    upd();
  });
}
function qoSpot(sym, p, side0){
  if (!store.s.spot) store.s.spot = {hold:{}, orders:[], history:[]}; const sp0 = store.s.spot; sp0.hold ||= {}; sp0.orders ||= []; sp0.history ||= [];
  let side = side0 === "sell" ? "sell" : "buy", ot = "market";
  const key = (p.type === "crypto" || p.type === "stock") ? p.base : p.sym, unit = key;
  const avail = () => Math.max(0, ((store.s.spot.hold || {})[key]?.qty || 0) - (store.s.spot.orders || []).filter(o => o.side === "sell" && o.sym === sym).reduce((a, o) => a + o.qty, 0));
  const qd = px => p.type !== "crypto" ? (p.type === "stock" ? 3 : 2) : (px >= 1000 ? 5 : px >= 10 ? 4 : px >= 1 ? 2 : 0);
  U.sheet(`Quick order · ${esc(M.label ? M.label(p) : sym)} Spot`, `<div class="qo">
    ${SEG("data-sd", [["buy", "Buy"], ["sell", "Sell"]], side)}
    ${SEG("data-ot", [["market", "Market"], ["limit", "Limit"]], ot)}
    <div class="famt qo-px hide"><input id="qopx" type="number" inputmode="decimal" placeholder="Limit price"><span>USDT</span></div>
    <div class="famt"><input id="qoa" type="number" inputmode="decimal" placeholder="Total"><span>USDT</span></div>
    <div class="chips qo-pc">${[25, 50, 75, 100].map(v => `<button data-qp="${v}">${v}%</button>`).join("")}</div>
    <div class="fkv"><span id="qoav">Avbl</span><b class="num" id="qoavv">--</b></div>
    <div class="fkv"><span>Quantity</span><b class="num" id="qoq">--</b></div><div class="fkv"><span>Fee (est.)</span><b class="num" id="qofee">--</b></div>
    <button class="fbtn2 l" id="qogo"><span>Buy</span></button></div>`, el => {
    const $ = q => el.querySelector(q), px = () => ot === "limit" ? (parseFloat($("#qopx").value) || 0) : p.price;
    const upd = () => { const t = parseFloat($("#qoa").value) || 0, ep = px() || p.price, q = t / ep;
      $("#qoav").textContent = side === "buy" ? "Avbl" : "Avbl " + unit; $("#qoavv").textContent = side === "buy" ? U.money(store.wb("spot")) + " USDT" : U.fmt(avail(), qd(ep)) + " " + unit;
      $("#qoq").textContent = t ? U.fmt(q, qd(ep)) + " " + unit : "--"; $("#qofee").textContent = t ? U.money(t * 0.0002) + " USDT" : "--";
      const g = $("#qogo"); g.className = "fbtn2 " + (side === "buy" ? "l" : "s"); g.querySelector("span").textContent = (side === "buy" ? "Buy " : "Sell ") + unit; };
    el.querySelectorAll("[data-sd]").forEach(b => b.onclick = () => { side = b.dataset.sd; el.querySelectorAll("[data-sd]").forEach(x => x.classList.toggle("on", x === b)); $("#qoa").value = ""; U.buzz(8); upd(); });
    el.querySelectorAll("[data-ot]").forEach(b => b.onclick = () => { ot = b.dataset.ot; el.querySelectorAll("[data-ot]").forEach(x => x.classList.toggle("on", x === b)); $(".qo-px").classList.toggle("hide", ot !== "limit"); if (ot === "limit" && !$("#qopx").value) $("#qopx").value = M.fmtPx(p, p.price).replace(/,/g, ""); U.buzz(8); upd(); });
    el.querySelectorAll("[data-qp]").forEach(b => b.onclick = () => { const f = +b.dataset.qp / 100, ep = px() || p.price; $("#qoa").value = side === "buy" ? Math.floor(store.wb("spot") * f * 100) / 100 : Math.floor(avail() * ep * f * 100) / 100; upd(); });
    $("#qoa").oninput = upd; $("#qopx").oninput = upd;
    $("#qogo").onclick = () => {
      const t = parseFloat($("#qoa").value) || 0, lp = ot === "limit" ? parseFloat($("#qopx").value) || 0 : 0, ep = ot === "limit" ? lp : p.price;
      if (ot === "limit" && !(lp > 0)) return U.toast("Please enter the price", "bad");
      if (!(t > 0)) return U.toast("Please enter the amount", "bad");
      const k = Math.pow(10, qd(ep)), q = side === "sell" && t >= avail() * ep - 1e-9 ? avail() : Math.floor(t / ep * k + 1e-9) / k;
      const r = qoSpotPlace({sym, side, type:ot, price:lp, qty:q});
      if (r.err){ U.toast(r.err, "bad"); window.UI && UI.walletErr && UI.walletErr(r.err); return; }
      U.closeLayer(); if (!r.filled){ U.fx("open"); U.toast("Order placed", "ok"); }
    };
    upd();
  });
}
/* same engine as the Spot page: SPOT.place when the page exposes it, otherwise an identical local copy working on the same store (store.s.spot + spot wallet) */
function qoSpotPlace(o){
  if (window.SPOT && SPOT.place) return SPOT.place(o);
  const {sym, side, type, price, qty} = o, p = M.get(sym), sp = store.s.spot, key = (p.type === "crypto" || p.type === "stock") ? p.base : p.sym, FEE = 0.0002;
  if (!p || !p.price) return {err:"Price unavailable"}; if (p.closed) return {err:"Market closed — reopens with the next session"};
  if (!(qty > 0)) return {err:"Please enter the amount"}; const px = type === "market" ? p.price : price; if (!(px > 0)) return {err:"Please enter the price"};
  if (qty * px < 1) return {err:"Minimum order value is 1 USDT"};
  const locked = sp.orders.filter(x => x.side === "sell" && x.sym === sym).reduce((a, x) => a + x.qty, 0), av = Math.max(0, (sp.hold[key]?.qty || 0) - locked);
  if (side === "buy"){ if (qty * px > store.wb("spot") + 1e-9) return {err:"Insufficient Spot balance"}; } else if (qty > av + 1e-9) return {err:`Insufficient ${key} balance`};
  const fill = (px2, fromLimit) => { const h = sp.hold[key] ||= {qty:0, cost:0};
    if (side === "buy"){ h.sym = sym; h.qty += qty * (1 - FEE); h.cost += qty * px2; if (!fromLimit) store.addWallet("spot", -qty * px2, "spot"); }
    else { const ac = h.qty > 0 ? h.cost / h.qty : 0; h.cost = Math.max(0, h.cost - ac * qty); h.qty = Math.max(0, h.qty - qty); store.addWallet("spot", qty * px2 * (1 - FEE), "spot"); }
    if (h.qty < 1e-9) delete sp.hold[key];
    sp.history.unshift({id:U.uid(), sym, side, price:px2, qty, fee:qty * px2 * FEE, ts:Date.now(), type: fromLimit ? "limit" : "market"}); store.save(); U.fx("open");
    U.toast(`${side === "buy" ? "Bought" : "Sold"} ${U.fmt(qty, 4)} ${key} @ ${M.fmtPx(p, px2)}`, "ok"); U.bus.emit("spot"); };
  if (type === "market"){ fill(px, false); return {ok:true, filled:true}; }
  const ord = {id:U.uid(), sym, side, price:px, qty, ts:Date.now()}; if (side === "buy") store.addWallet("spot", -qty * px, "spot");
  sp.orders.push(ord); store.save(); U.bus.emit("spot"); return {ok:true, order:ord};
}
CH.quickOrder = qoOpen;
})();
