/* v6.6 — chart add-ons: S/R + LIQ buttons in the indicator row, clean "indicator settings" icon, Indicator Settings page */
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

/* ---- hook into CH.mount: add S/R + LIQ buttons, swap the icon, route the settings icons to the new page ---- */
const mount0 = CH.mount;
CH.mount = function(container, parts, cb){
  const r = mount0.apply(this, arguments);
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
  } catch (e) { console.warn(e); }
  return r;
};
})();
