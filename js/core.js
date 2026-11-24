/* ===== Core: utils, store, bus, UI primitives, i18n ===== */
(function(){
const C = window.CONFIG;
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const fmt = (n, d=2) => (n==null||isNaN(n)) ? "--" : Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const money = n => fmt(n, 2);
const signed = (n,d=2) => (n>0?"+":n<0?"-":"") + fmt(Math.abs(n), d);
const pct = n => (n>0?"+":"") + fmt(n, 2) + "%";
const mmss = s => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0"); };
const timeStr = t => new Date(t).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
const dateStr = t => new Date(t).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ----- Icons (inline SVG, stroke-based) ----- */
const P = {
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  bell:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="M17.9 17.9A10 10 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 5.1-5.9M9.9 5.2A9 9 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>',
  home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  bot:'<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 14h.01M15 14h.01M2 13v3M22 13v3"/><circle cx="12" cy="3.5" r="1"/>',
  chart:'<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
  gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  down:'<path d="M12 5v14M5 12l7 7 7-7"/>', up:'<path d="M12 19V5M5 12l7-7 7 7"/>',
  deposit:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  withdraw:'<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  auto:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-4-6.3"/>',
  crown:'<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5z"/>',
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  headset:'<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="2" y="14" width="5" height="7" rx="2"/><rect x="17" y="14" width="5" height="7" rx="2"/>',
  back:'<path d="M15 18 9 12l6-6"/>', chev:'<path d="m9 18 6-6-6-6"/>', chevd:'<path d="m6 9 6 6 6-6"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>', copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  check:'<path d="M20 6 9 17l-5-5"/>', x:'<path d="M18 6 6 18M6 6l12 12"/>', minus:'<path d="M5 12h14"/>', plus:'<path d="M12 5v14M5 12h14"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>', wallet:'<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><circle cx="16" cy="14" r="1.5"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  star:'<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>', send:'<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  zap:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  play:'<path d="m6 4 14 8-14 8z"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>', trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', volume:'<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  vibrate:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 8v8M21 8v8"/>', edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  expand:'<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>', shrink:'<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M8 7h8M8 11h6"/>', award:'<circle cx="12" cy="9" r="6"/><path d="m8.2 13.8-1.7 7.2 5.5-3 5.5 3-1.7-7.2"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', vault:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5V7M15.5 12H17M7 20v1M17 20v1"/>',
  layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>', candle:'<path d="M7 3v4M7 17v4M17 3v6M17 19v2"/><rect x="5" y="7" width="4" height="10" rx="1"/><rect x="15" y="9" width="4" height="10" rx="1"/>',
  ring:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0M2 4l2 2M22 4l-2 2"/>', flame:'<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8 0 4 3 7 7 7z"/>',
  rocket:'<path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-4A13 13 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/><path d="M9 12H4s.5-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.5 4-2c1.1-1.6 0-5 0-5"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  swap:'<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>', percent:'<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  trend:'<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>', pie:'<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  nhome:'<path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z"/>',
  nmkt:'<path d="M3 17.5 9 11l4 4 8-8.5"/><path d="M15.5 6.5H21V12"/>',
  ntrade:'<path d="M20 11A8 8 0 0 0 5.5 6.3L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.5 4.7L20 16"/><path d="M20 20.5V16h-4.5"/><circle cx="12" cy="12" r="2.2"/>',
  nfut:'<path d="M5 3h10l4 4v14H5z"/><path d="M8.5 9h7M8.5 12.5h4"/><path d="m16 14.5 2.5 2.5-2.5 2.5-2.5-2.5z" fill="currentColor"/>',
  nasset:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="m15.5 13 2 2-2 2-2-2z" fill="currentColor"/><path d="M7 6V4.5h10V6"/>',
  pen:'<path d="m3 21 3.8-1 11.4-11.4a2 2 0 0 0-2.8-2.8L4 17.2z"/><path d="m14 7 3 3"/>', more:'<circle cx="12" cy="12" r="9"/><circle cx="8" cy="12" r=".8" fill="currentColor"/><circle cx="12" cy="12" r=".8" fill="currentColor"/><circle cx="16" cy="12" r=".8" fill="currentColor"/>',
  dots:'<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>', sort:'<path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/>',
  ind:'<path d="M3 3v18h18"/><path d="m6 16 4-6 4 3 5-8"/>', clockh:'<rect x="4" y="3" width="13" height="16" rx="1.5"/><circle cx="17" cy="17" r="4.2" fill="var(--bg)"/><path d="M17 15v2.2l1.4 1"/>',
  qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/>', send2:'<path d="M12 19V5M5 12l7-7 7 7"/>', earn:'<path d="M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/><path d="M12 6v2.2"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'
};
const ic = (n, s=20, sw=2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||""}</svg>`;

/* ----- Event bus ----- */
const handlers = {};
const bus = {
  on(e, f){ (handlers[e] ||= new Set()).add(f); return () => handlers[e].delete(f); },
  emit(e, ...a){ handlers[e]?.forEach(f => { try{ f(...a); }catch(err){ console.error(err); } }); }
};

/* ----- Store (localStorage) ----- */
const KEY = "novatrade_v1";
const defaults = () => ({
  balance: C.START_BALANCE, positions: [], history: [], tx: [], notifs: [], unread: 0,
  settings: {theme: "light", lang:"en", sound:true, haptic:true, hideBal:false, defAmt:10, defExp:30, lev:20, inds:["EMA","VOL"], chartType:"candle"},
  fut: {positions:[], orders:[], history:[]}, alerts: [], favs: ["BTCUSDT","ETHUSDT","XAUUSD"], rewards: {checkins:[], claimed:{}, xp:0, used:{}}, vault: {bal:0, since:Date.now()},
  balHist: [], bots: {}, auto: {on:false, pair:"BTCUSDT", amount:10, expiry:30, strategy:"trend", interval:20, max:20, count:0, log:[]},
  profile: {name:"Trader" + Math.floor(1000 + Math.random()*9000), uid: String(Math.floor(10000000 + Math.random()*89999999)), ref: Math.random().toString(36).slice(2,8).toUpperCase(), joined: Date.now()},
  tickets: [], posts: [], likes: {}, created: Date.now()
});
let S;
try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { S = defaults(); }
S.settings = Object.assign(defaults().settings, S.settings || {});
if (!S.settings.v5){ Object.assign(S.settings, {v5:true, theme:"light", sound:true, haptic:true}); }
if (S.profile && S.profile.name === "Demo Trader") S.profile.name = "Trader" + Math.floor(1000 + Math.random()*9000);
["fut","rewards","vault"].forEach(k => S[k] = Object.assign(defaults()[k], S[k] || {}));
let saveT;
const store = {
  get s(){ return S; },
  save(){ clearTimeout(saveT); saveT = setTimeout(() => { try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch{} }, 120); },
  saveNow(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch{} },
  setBalance(v, reason){
    S.balance = Math.round(v*100)/100;
    S.balHist.push({t: Date.now(), b: S.balance});
    if (S.balHist.length > 400) S.balHist.splice(0, S.balHist.length - 400);
    this.save(); bus.emit("balance", S.balance, reason);
  },
  reset(){ const keep = {settings:S.settings, profile:S.profile}; S = Object.assign(defaults(), keep); this.saveNow(); bus.emit("balance", S.balance); bus.emit("positions"); bus.emit("history"); },
  wipe(){ localStorage.removeItem(KEY); location.reload(); },
  notify(title, body, kind="info"){
    S.notifs.unshift({id:uid(), t:Date.now(), title, body, kind}); S.notifs = S.notifs.slice(0, 60);
    S.unread++; this.save(); bus.emit("notifs");
  }
};

/* ----- i18n ----- */
const I18N = {
  hi: {"Home":"होम","Bots":"बॉट्स","Trade":"ट्रेड","Referral":"रेफ़रल","Profile":"प्रोफ़ाइल","Deposit":"जमा करें","Withdraw":"निकासी",
    "Activate Auto Trading":"ऑटो ट्रेडिंग चालू करें","Refer and Earn":"रेफ़र करें और कमाएँ","Get VIP Signals":"VIP सिग्नल पाएँ","Join Community":"कम्युनिटी से जुड़ें",
    "About Us":"हमारे बारे में","Contact Support":"सपोर्ट से संपर्क","Total Assets":"कुल संपत्ति","Today's PnL":"आज का PnL","Markets":"मार्केट्स",
    "Popular":"लोकप्रिय","Crypto":"क्रिप्टो","Forex":"फ़ॉरेक्स","Commodities":"कमोडिटी","Name":"नाम","Last Price":"अंतिम मूल्य","24h Chg%":"24घं बदलाव%",
    "Up":"ऊपर","Down":"नीचे","Amount":"राशि","Balance":"बैलेंस","Live Positions":"लाइव पोज़ीशन","History":"इतिहास","Settings":"सेटिंग्स",
    "Search e.g., SOL":"खोजें जैसे SOL","Market closed":"बाज़ार बंद","Chart only":"केवल चार्ट","Notifications":"सूचनाएँ","Language":"भाषा","Payout (if win)":"भुगतान (जीत पर)","Payout Ratio":"भुगतान अनुपात"}
};
const t = k => (I18N[S.settings.lang]?.[k]) || k;

/* ----- Toast ----- */
function toast(msg, kind="info", ms=2600){
  const box = $("#toasts"); const el = document.createElement("div");
  const icn = {ok:"check", bad:"x", warn:"info", info:"info"}[kind];
  el.className = "toast " + kind; el.setAttribute("role","status");
  if (kind === "bad") fx("err");
  el.innerHTML = `<span class="ti">${ic(icn,12,3.5)}</span><span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, ms);
  while (box.children.length > 3) box.firstChild.remove();
}

/* ----- Scrim / sheet / drawer / modal ----- */
let openLayer = null;
function scrim(show, onClick){
  let s = $("#scrim");
  if (show){ s.classList.remove("hide"); requestAnimationFrame(() => s.classList.add("show")); s.onclick = onClick; }
  else { s.classList.remove("show"); setTimeout(() => s.classList.add("hide"), 250); }
}
function closeLayer(){ if (!openLayer) return; const l = openLayer; openLayer = null; l.el.classList.remove("show"); scrim(false); setTimeout(() => { l.el.innerHTML=""; l.onClose?.(); }, 300); document.body.style.overflow=""; }
function sheet(title, html, onMount, onClose){
  closeLayerNow();
  const el = $("#sheet");
  el.innerHTML = `<div class="grab"></div><div class="sheet-h"><div class="title">${esc(title)}</div><button class="icon-btn" data-close aria-label="Close">${ic("close",18)}</button></div><div class="sheet-b">${html}</div>`;
  el.querySelector("[data-close]").onclick = closeLayer;
  openLayer = {el, onClose}; scrim(true, closeLayer); document.body.style.overflow="hidden";
  requestAnimationFrame(() => el.classList.add("show"));
  onMount?.(el);
  return el;
}
function closeLayerNow(){ if (openLayer){ openLayer.el.classList.remove("show"); openLayer.el.innerHTML=""; openLayer=null; } }
function drawer(html, onMount){
  closeLayerNow();
  const el = $("#drawer"); el.innerHTML = html; openLayer = {el}; scrim(true, closeLayer);
  requestAnimationFrame(() => el.classList.add("show")); onMount?.(el);
}
function modal(html, onMount){
  closeLayerNow();
  const el = $("#modal"); el.innerHTML = html; openLayer = {el}; scrim(true, closeLayer);
  requestAnimationFrame(() => el.classList.add("show")); onMount?.(el);
  return el;
}
function confirmBox(title, body, okText="Confirm", danger=false){
  return new Promise(res => {
    modal(`<div class="title" style="margin-bottom:8px">${esc(title)}</div><p class="sub" style="margin-bottom:20px">${esc(body)}</p>
      <div class="row"><button class="btn btn-ghost grow" data-no>Cancel</button><button class="btn ${danger?"btn-down":"btn-primary"} grow" data-yes>${esc(okText)}</button></div>`, el => {
      el.querySelector("[data-no]").onclick = () => { closeLayer(); res(false); };
      el.querySelector("[data-yes]").onclick = () => { closeLayer(); res(true); };
    });
  });
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeLayer(); });

/* ----- Feedback: sound + haptics + confetti ----- */
/* Premium event feedback — NO sound / vibration on plain taps (like real exchange apps).
   Each event has its own short, soft sound + its own haptic pattern. */
let actx, master;
function ac(){
  if (!actx){
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = actx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    master = actx.createGain(); master.gain.value = 0.9;
    // short airy echo for a polished "chime" tail
    const dl = actx.createDelay(), fb = actx.createGain(), wet = actx.createGain();
    dl.delayTime.value = 0.11; fb.gain.value = 0.22; wet.gain.value = 0.18;
    master.connect(comp); master.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(comp); comp.connect(actx.destination);
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}
// [freq, start, duration, volume, wave]
const SND = {
  open:   [[880,0,.09,.11,"sine"],[1318.5,.055,.14,.10,"sine"]],                                   // crisp rising blip
  close:  [[1046.5,0,.08,.09,"sine"],[784,.05,.14,.09,"sine"]],                                    // soft falling blip
  win:    [[1046.5,0,.12,.10,"sine"],[1318.5,.08,.12,.10,"sine"],[1568,.16,.14,.10,"sine"],[2093,.24,.34,.09,"sine"]], // bright chime
  loss:   [[392,0,.16,.12,"triangle"],[329.6,.12,.28,.11,"triangle"]],                            // low, gentle descend
  notify: [[1318.5,0,.12,.08,"sine"],[987.8,.11,.22,.08,"sine"]],                                   // ding-dong
  alert:  [[1760,0,.07,.08,"sine"],[1760,.14,.07,.08,"sine"],[2349,.28,.18,.08,"sine"]],           // triple ping
  claim:  [[1975.5,0,.06,.07,"sine"],[2637,.05,.22,.07,"sine"]],                                    // coin
  err:    [[196,0,.09,.10,"triangle"],[185,.1,.12,.10,"triangle"]],                                  // short low double
  tick:   [[1500,0,.035,.045,"sine"]]                                                              // countdown tick (last 5s)
};
function beep(kind="notify"){
  if (!S.settings.sound || !SND[kind]) return;
  try {
    const A = ac();
    SND[kind].forEach(([f, d, dur, vol, wave]) => {
      const o = A.createOscillator(), g = A.createGain(), o2 = A.createOscillator(), g2 = A.createGain();
      o.type = wave; o.frequency.value = f; o2.type = "sine"; o2.frequency.value = f * 2; g2.gain.value = 0.12; // soft overtone
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
      const t0 = A.currentTime + d;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.03); o2.stop(t0 + dur + 0.03);
    });
  } catch {}
}
const HAP = {open:[14], close:[10,40,10], win:[18,70,18,70,40], loss:[70], err:[22,45,22], alert:[30,90,30,90,30], notify:[16,60,16], claim:[12,50,24], tick:[6]};
const buzz = p => { if (!S.settings.haptic || !navigator.vibrate) return; try { navigator.vibrate(typeof p === "string" ? (HAP[p] || 0) : p); } catch {} };
/* one call per event: matching sound + haptic */
const fx = kind => { beep(kind); buzz(kind); };
function confetti(){
  const box = document.createElement("div"); box.className = "confetti";
  const cols = ["#12B886","#2E6BFF","#5AA9FF","#5AA9FF","#F0435A","#B9C8FF"];
  for (let i=0;i<60;i++){ const d=document.createElement("i"); d.style.left=Math.random()*100+"%"; d.style.background=cols[i%cols.length]; d.style.animationDelay=Math.random()*0.5+"s"; d.style.animationDuration=(1.2+Math.random())+"s"; box.appendChild(d); }
  document.body.appendChild(box); setTimeout(() => box.remove(), 2800);
}

/* ----- Sparkline SVG ----- */
function spark(vals, w=120, h=40, color){
  if (!vals || vals.length < 2) vals = [0,0];
  const mn = Math.min(...vals), mx = Math.max(...vals), r = (mx-mn) || 1;
  const pts = vals.map((v,i) => [(i/(vals.length-1))*w, h-3-((v-mn)/r)*(h-6)]);
  const d = pts.map((p,i) => (i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  const c = color || (vals[vals.length-1] >= vals[0] ? "var(--up)" : "var(--down)");
  const gid = "g"+uid();
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${w} ${h} L0 ${h}Z" fill="url(#${gid})"/><path d="${d}" fill="none" stroke="${c}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

function copyText(txt, msg="Copied to clipboard"){
  const done = () => toast(msg, "ok");
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  function fallback(){ const ta=document.createElement("textarea"); ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); done(); }catch{ toast("Copy failed — long-press to copy","bad"); } ta.remove(); }
}

// No global tap feedback by design: sounds & haptics fire only on real events via U.fx().
// Page zoom is disabled; only the chart handles pinch / wheel zoom.
document.addEventListener("gesturestart", e => { if (!e.target.closest?.("#chart")) e.preventDefault(); });
addEventListener("wheel", e => { if (e.ctrlKey && !e.target.closest?.("#chart")) e.preventDefault(); }, {passive:false});
window.U = {$, $$, esc, clamp, fmt, money, signed, pct, mmss, timeStr, dateStr, uid, sleep, ic, bus, store, t, toast, sheet, drawer, modal, closeLayer, confirmBox, beep, buzz, confetti, spark, copyText, fx};
})();
