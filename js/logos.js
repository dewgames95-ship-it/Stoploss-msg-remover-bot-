/* ===== v6.9 logos: crafted inline SVG icons for every market (no external dependency) =====
   Used by UI.pairIcon / UI.coinImg (js/ui.js). Pure functions, no globals needed besides window.LOGOS. */
(function(){
let n = 0;
const nid = p => p + (++n);
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const svg = (size, inner, extra = "") => `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" style="display:block;flex-shrink:0;border-radius:50%;${extra}">${inner}</svg>`;
const disc = (id, c1, c2) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><circle cx="20" cy="20" r="20" fill="url(#${id})"/>`;

/* ---- Solana: official mark (three slanted bars, #14F195 -> #9945FF) on black ---- */
function sol(size = 28){
  const g = nid("sg");
  return svg(size, `<defs><linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="397" y1="0" x2="0" y2="311.7"><stop offset="0" stop-color="#14F195"/><stop offset="1" stop-color="#9945FF"/></linearGradient></defs><circle cx="20" cy="20" r="20" fill="#000"/>
  <g transform="translate(9.2 11.4) scale(.0553)" fill="url(#${g})"><path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/><path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/><path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/></g>`);
}

/* ---- Metal bars (ingots) ---- */
function bars(size, bg1, bg2, a, b, c, shine = "#fff"){
  const id = nid("mb");
  return svg(size, `${disc(id, bg1, bg2)}<path d="M8 27h11l2-6H10z" fill="${a}"/><path d="M21 27h11l-2-6H23z" fill="${b}"/><path d="M14 20h12l-2-6h-8z" fill="${c}"/><path d="M16 14h8l-.6 1.6h-6.8z" fill="${shine}" opacity=".7"/>`);
}
const METALS = {
  gold:      s => bars(s, "#4A3D14", "#2A2209", "#E8B10E", "#F5C842", "#FFD966"),
  silver:    s => bars(s, "#39414C", "#1F242B", "#9AA5B4", "#B8C1CD", "#D4DAE2"),
  platinum:  s => bars(s, "#363B44", "#1E2229", "#C9CED6", "#E3E7ED", "#F4F6F9"),
  palladium: s => bars(s, "#38363F", "#1F1E25", "#A9A3B5", "#C4BFCE", "#DCD8E3"),
  copper:    s => bars(s, "#4B2A17", "#2A160A", "#B8662E", "#D9813F", "#EDA062", "#FFE1C4"),
  aluminium: s => bars(s, "#33424F", "#1C2630", "#9FB4C6", "#BCCEDD", "#DCE8F2"),
  lead:      s => bars(s, "#33363D", "#1B1D22", "#6E7684", "#8A92A1", "#A6AEBB"),
  nickel:    s => bars(s, "#38403F", "#1E2423", "#8FA19E", "#AEBFBC", "#CBD9D6"),
  zinc:      s => bars(s, "#2F3E4A", "#192530", "#7C9BB3", "#9AB6CB", "#BDD2E1")
};

/* ---- Energy ---- */
function barrel(size, body, hi){
  const id = nid("br"), id2 = nid("bb");
  return svg(size, `${disc(id, "#343943", "#17191E")}<defs><linearGradient id="${id2}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${body}"/><stop offset=".45" stop-color="${hi}"/><stop offset="1" stop-color="${body}"/></linearGradient></defs>
  <path d="M11.5 12.5c0-1.9 3.8-3.3 8.5-3.3s8.5 1.4 8.5 3.3v15c0 1.9-3.8 3.3-8.5 3.3s-8.5-1.4-8.5-3.3z" fill="url(#${id2})"/>
  <ellipse cx="20" cy="12.5" rx="8.5" ry="3.3" fill="${hi}" opacity=".95"/><ellipse cx="20" cy="12.5" rx="6" ry="2" fill="#000" opacity=".22"/>
  <path d="M11.5 17.6c0 1.9 3.8 3.3 8.5 3.3s8.5-1.4 8.5-3.3M11.5 23.4c0 1.9 3.8 3.3 8.5 3.3s8.5-1.4 8.5-3.3" fill="none" stroke="#000" stroke-opacity=".32" stroke-width="1.3"/>
  <path d="M20 17.4c1.3 1.9 2.1 3 2.1 4.2a2.1 2.1 0 01-4.2 0c0-1.2.8-2.3 2.1-4.2z" fill="#fff" opacity=".92"/>`);
}
function flame(size){
  const id = nid("fl"), g = nid("fg");
  return svg(size, `${disc(id, "#2B3140", "#13161D")}<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7DD3FC"/><stop offset="1" stop-color="#2563EB"/></linearGradient></defs>
  <path d="M20.6 6.5c.9 4.3 6.9 7.2 6.9 14a7.5 7.5 0 01-15 0c0-3.4 1.7-5.2 3-7 .3 2.2 1.3 3.4 2.3 3.9-.6-4.7.6-8.6 2.8-10.9z" fill="url(#${g})"/>
  <path d="M20 21.2c1.7 2.2 3.2 3.4 3.2 5.5a3.2 3.2 0 01-6.4 0c0-2.1 1.5-3.3 3.2-5.5z" fill="#fff" opacity=".92"/>`);
}
function crate(size){
  const id = nid("cr");
  return svg(size, `${disc(id, "#3A3F4A", "#1A1D23")}<path d="M10 15l10-5 10 5v11l-10 5-10-5z" fill="#8B93A3"/><path d="M10 15l10 5 10-5M20 20v11" fill="none" stroke="#1A1D23" stroke-width="1.6"/>`);
}
function commodity(sym, size = 28){
  const s = String(sym).toUpperCase();
  if (/^(CL|USOIL|WTI)/.test(s)) return barrel(size, "#E58A1F", "#FFC15A");
  if (/^(BZ|UKOIL|BRENT)/.test(s)) return barrel(size, "#2F7DE1", "#7DB7FF");
  if (/NATGAS|XNG|NGAS|GAS/.test(s)) return flame(size);
  if (/COPPER|XCU/.test(s)) return METALS.copper(size);
  if (/XAL|ALU/.test(s)) return METALS.aluminium(size);
  if (/XPB|LEAD/.test(s)) return METALS.lead(size);
  if (/XNI|NICKEL/.test(s)) return METALS.nickel(size);
  if (/XZN|ZINC/.test(s)) return METALS.zinc(size);
  return crate(size);
}
function metal(key, size = 28){ return (METALS[key] || METALS.gold)(size); }

/* ---- Flags (circle-cropped, inline) ---- */
const star = (cx, cy, r, fill = "#fff") => { let d = ""; for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .4 : r; d += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(2) + " " + (cy + rr * Math.sin(a)).toFixed(2); } return `<path d="${d}Z" fill="${fill}"/>`; };
const dots = (pts, r, fill) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join("");
const FLAGS = {
  us: () => `<rect width="40" height="40" fill="#fff"/>${[0,1,2,3,4,5,6].map(i => `<rect y="${i * 5.714}" width="40" height="2.857" fill="#B22234"/>`).join("")}<rect width="19" height="22.9" fill="#3C3B6E"/>${dots([[4,4],[9,4],[14,4],[6.5,8],[11.5,8],[4,12],[9,12],[14,12],[6.5,16],[11.5,16],[4,20],[9,20],[14,20]], 1, "#fff")}`,
  eu: () => `<rect width="40" height="40" fill="#0D3CA6"/>${dots(Array.from({length:12}, (_, i) => [20 + 10 * Math.sin(i * Math.PI / 6), 20 - 10 * Math.cos(i * Math.PI / 6)]), 1.7, "#FFD60A")}`,
  gb: () => `<rect width="40" height="40" fill="#1B2F7A"/><path d="M0 0L40 40M40 0L0 40" stroke="#fff" stroke-width="7"/><path d="M0 0L40 40M40 0L0 40" stroke="#C8102E" stroke-width="2.6"/><path d="M20 0v40M0 20h40" stroke="#fff" stroke-width="11"/><path d="M20 0v40M0 20h40" stroke="#C8102E" stroke-width="6.4"/>`,
  jp: () => `<rect width="40" height="40" fill="#fff"/><circle cx="20" cy="20" r="9" fill="#BC002D"/>`,
  ch: () => `<rect width="40" height="40" fill="#D52B1E"/><path d="M17 9h6v8h8v6h-8v8h-6v-8H9v-6h8z" fill="#fff"/>`,
  au: () => `<rect width="40" height="40" fill="#012169"/><path d="M0 0L20 20M20 0L0 20" stroke="#fff" stroke-width="3.4"/><path d="M10 0v20M0 10h20" stroke="#fff" stroke-width="5"/><path d="M10 0v20M0 10h20" stroke="#C8102E" stroke-width="3"/>${star(10, 31, 4.4)}${star(28, 12, 2.4)}${star(33, 22, 2.4)}${star(28, 31, 2.4)}${star(23, 21, 2.4)}`,
  nz: () => `<rect width="40" height="40" fill="#012169"/><path d="M0 0L20 20M20 0L0 20" stroke="#fff" stroke-width="3.4"/><path d="M10 0v20M0 10h20" stroke="#fff" stroke-width="5"/><path d="M10 0v20M0 10h20" stroke="#C8102E" stroke-width="3"/>${star(29, 12, 2.8, "#CC142B")}${star(34, 20, 2.8, "#CC142B")}${star(27, 30, 2.8, "#CC142B")}${star(23, 21, 2.8, "#CC142B")}`,
  ca: () => `<rect width="40" height="40" fill="#fff"/><rect width="10" height="40" fill="#D52B1E"/><rect x="30" width="10" height="40" fill="#D52B1E"/><path d="M20 9l2.4 5 3.2-1.6-1 5.6 3.4-1.8-.6 3 2.2.8-5.6 4.6.6 2.4h-3.8l.3 4.4h-1.4l.3-4.4h-3.8l.6-2.4-5.6-4.6 2.2-.8-.6-3 3.4 1.8-1-5.6L17.6 14z" fill="#D52B1E"/>`,
  de: () => `<rect width="40" height="13.4" fill="#111"/><rect y="13.3" width="40" height="13.4" fill="#DD0000"/><rect y="26.6" width="40" height="13.4" fill="#FFCE00"/>`,
  fr: () => `<rect width="13.4" height="40" fill="#0055A4"/><rect x="13.3" width="13.4" height="40" fill="#fff"/><rect x="26.6" width="13.4" height="40" fill="#EF4135"/>`,
  hk: () => `<rect width="40" height="40" fill="#DE2910"/>${[0,1,2,3,4].map(i => `<ellipse cx="20" cy="13.5" rx="3" ry="6" fill="#fff" transform="rotate(${i * 72} 20 20)"/>`).join("")}<circle cx="20" cy="20" r="2" fill="#DE2910"/>`,
  cn: () => `<rect width="40" height="40" fill="#DE2910"/>${star(12, 13, 7, "#FFDE00")}${star(23, 6, 2, "#FFDE00")}${star(27, 11, 2, "#FFDE00")}${star(27, 17, 2, "#FFDE00")}${star(23, 22, 2, "#FFDE00")}`,
  sg: () => `<rect width="40" height="20" fill="#EF3340"/><rect y="20" width="40" height="20" fill="#fff"/><circle cx="12" cy="10" r="6.5" fill="#fff"/><circle cx="14.6" cy="10" r="6" fill="#EF3340"/>${dots([[19,5.5],[22,8.4],[21,12.4],[17.2,12.6],[16.4,7.8]].map(([x, y]) => [x + 1, y]), 1, "#fff")}`,
  mx: () => `<rect width="13.4" height="40" fill="#006847"/><rect x="13.3" width="13.4" height="40" fill="#fff"/><rect x="26.6" width="13.4" height="40" fill="#CE1126"/><circle cx="20" cy="20" r="4" fill="#8C6A3F"/>`,
  za: () => `<rect width="40" height="20" fill="#DE3831"/><rect y="20" width="40" height="20" fill="#002395"/><path d="M0 0L18 20 0 40zM0 7.5L10.5 20 0 32.5" fill="#000"/><path d="M0 0l22 20L0 40M22 20h18" fill="none" stroke="#fff" stroke-width="11"/><path d="M0 0l22 20L0 40M22 20h18" fill="none" stroke="#007A4D" stroke-width="6.5"/><path d="M0 4l12 16L0 36z" fill="#000"/><path d="M0 0v6l7.5 14L0 34v6l16-20z" fill="#FFB612" opacity=".0"/>`,
  tr: () => `<rect width="40" height="40" fill="#E30A17"/><circle cx="17" cy="20" r="9" fill="#fff"/><circle cx="20" cy="20" r="7.2" fill="#E30A17"/>${star(25, 20, 4.2)}`,
  br: () => `<rect width="40" height="40" fill="#009C3B"/><path d="M20 6L37 20 20 34 3 20z" fill="#FFDF00"/><circle cx="20" cy="20" r="7" fill="#002776"/><path d="M13.4 18.6c4.6-1 9.6.4 13 3.4" stroke="#fff" stroke-width="1.2" fill="none"/>`,
  in: () => `<rect width="40" height="13.4" fill="#FF9933"/><rect y="13.3" width="40" height="13.4" fill="#fff"/><rect y="26.6" width="40" height="13.4" fill="#138808"/><circle cx="20" cy="20" r="4.4" fill="none" stroke="#000080" stroke-width="1"/><circle cx="20" cy="20" r=".9" fill="#000080"/>`,
  kr: () => `<rect width="40" height="40" fill="#fff"/><path d="M12 20a8 8 0 0116 0z" fill="#CD2E3A"/><path d="M12 20a8 8 0 0016 0z" fill="#0047A0"/><path d="M5 8l5-3M30 5l5 3M5 32l5 3M30 35l5-3" stroke="#111" stroke-width="2.2"/>`
};
const FLAG_BUNDLED = new Set(["au","ca","ch","eu","gb","jp","nz","us"]);
function flag(cc, size = 28, extra = ""){
  const f = FLAGS[cc], id = nid("fc");
  if (!f) return svg(size, `<circle cx="20" cy="20" r="20" fill="#3B6FE0"/><circle cx="20" cy="20" r="11" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M9 20h22M20 9c-5 6-5 16 0 22M20 9c5 6 5 16 0 22" fill="none" stroke="#fff" stroke-width="1.4"/>`, extra);
  return svg(size, `<defs><clipPath id="${id}"><circle cx="20" cy="20" r="20"/></clipPath></defs><g clip-path="url(#${id})">${f()}</g>`, extra);
}

/* ---- Monogram (last resort for logo-less tickers): gradient disc + letters ---- */
const BRAND = {SAMSUNG:"#1428A0", SAMSUNGEM:"#1428A0", SKHYNIX:"#EA002C", SKHY:"#EA002C", HYUNDAI:"#002C5F", LGELECTRONICS:"#A50034", NAVER:"#03C75A", HANMI:"#0B5FA5", KODEX200:"#2F5BEA", TENCENT:"#0F7BDC", MEITUAN:"#FFC300", KUAISHOU:"#FF5000", BYD:"#C8102E", POPMART:"#E60012", MINIMAX:"#F0436A", ZHIPU:"#2D5BFF", GIGADEV:"#6C4DFF", ZHONGJI:"#1F6FEB", CXMT:"#E60012", UNITREE:"#1B8CF2", OPENAI:"#10A37F", ANTHROPIC:"#D97757", MOONSHOT:"#6C5CE7", OURA:"#C9B38A", USDEX:"#2E6BFF", QNTX:"#3B82F6", STXX:"#0EA5E9", LYTE:"#7C3AED"};
function mono(txt, size = 28, seed){
  const t = String(txt || "?").toUpperCase(), h = hash(seed || t), id = nid("mo");
  const c1 = BRAND[t] || `hsl(${h % 360} 62% 48%)`, c2 = BRAND[t] ? "rgba(0,0,0,.32)" : `hsl(${(h + 40) % 360} 62% 34%)`;
  const s = t.length <= 2 ? t : t.length === 3 ? t : t.slice(0, t.length <= 5 ? 3 : 2);
  const fs = s.length === 1 ? 20 : s.length === 2 ? 17 : 13.5;
  return svg(size, `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${BRAND[t] ? "#000" : c2}" stop-opacity="${BRAND[t] ? .38 : 1}"/></linearGradient></defs><circle cx="20" cy="20" r="20" fill="url(#${id})"/><text x="20" y="20.5" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-weight="800" font-size="${fs}" fill="#fff" letter-spacing="-.4">${esc(s)}</text>`);
}
/* a few crafted marks for names with no public logo */
function special(base, size = 28){
  const b = String(base).toUpperCase(), id = nid("sp");
  if (b === "OPENAI") return svg(size, `<circle cx="20" cy="20" r="20" fill="#0B0D10"/>${[0,1,2,3,4,5].map(i => `<rect x="14.2" y="7.6" width="11.6" height="11.6" rx="5.8" fill="none" stroke="#fff" stroke-width="1.8" transform="rotate(${i * 60} 20 20)"/>`).join("")}`);
  if (b === "ANTHROPIC") return svg(size, `<circle cx="20" cy="20" r="20" fill="#D97757"/><path d="M13 28L20 10l7 18M16 22.2h8" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`);
  if (b === "MOONSHOT") return svg(size, `${disc(id, "#241F4D", "#0F0C26")}<path d="M24.5 9a11.5 11.5 0 100 22 9.2 9.2 0 010-22z" fill="#F5F0D2"/>${dots([[27,14],[30,22],[26,28]], 1, "#fff")}`);
  return null;
}
function ticker(base, size = 28){ return special(base, size) || mono(base, size); }

/* ---- Index (circle flag + tiny chart tick so index != forex flag) ---- */
function indexIcon(flagCc, size = 28){ return flag(flagCc || "us", size); }

window.LOGOS = {sol, metal, commodity, flag, FLAG_BUNDLED, mono, ticker, special, indexIcon, hash, BRAND};
})();
