/* ===== Market data: Binance (crypto) + biquote.io (forex/metals) ===== */
(function(){
const C = window.CONFIG, {bus} = U;
const pairs = new Map();          // sym -> pair
const hist = new Map();           // sym -> [{t,p}] recent ticks (for signals, short-tf candles)
let cryptoOrder = [];             // top 100 by quote volume
let restHost = 0, wsHost = 0;
const status = {crypto:"loading", fx:"loading", tradfi:"loading"};

function decimalsFor(p){ if (p >= 1000) return 2; if (p >= 10) return 3; if (p >= 1) return 4; if (p >= 0.01) return 5; if (p >= 0.0001) return 6; return 8; }

/* ---- Pair factory ---- */
function addPair(o){
  const p = Object.assign({price:null, chg:null, high:null, low:null, qv:null, closed:false, updated:0, dir:0}, o);
  pairs.set(p.sym, p); return p;
}
C.FOREX.forEach(f => addPair({fixed:true, sym:f.s, type:"forex", base:f.s.slice(0,3), quote:f.s.slice(3), name:f.n, flags:f.f, tradable:true, dp:f.s.includes("JPY")?3:5}));
C.METALS.forEach(m => addPair({fixed:true, sym:m.s, type:"metal", base:m.s.slice(0,3), quote:"USD", name:m.n, metal:m.m, tradable:true, dp:m.s==="XAUUSD"?2:3}));

(C.INDICES || []).forEach(x => addPair({fixed:true, sym:x.s, type:"index", base:x.s, quote:"", name:x.n, flag:x.f, tradable:true, dp:2}));

function pushHist(sym, price, t=Date.now()){
  let h = hist.get(sym); if (!h) hist.set(sym, h = []);
  const last = h[h.length-1];
  if (last && t - last.t < 250){ last.p = price; return; }
  h.push({t, p:price}); if (h.length > 2400) h.splice(0, h.length - 2400);
}
function setPrice(sym, price, extra){
  const p = pairs.get(sym); if (!p || !(price > 0)) return;
  const prev = p.price;
  p.price = price; p.updated = Date.now();
  if (prev != null && price !== prev) p.dir = price > prev ? 1 : -1;
  if (extra) Object.assign(p, extra);
  pushHist(sym, price);
  bus.emit("tick", sym, price, prev);
}

/* ---- HTTP with host fallback + backoff ---- */
async function getJSON(url, tries=3){
  let err;
  for (let i=0;i<tries;i++){
    try { const r = await fetch(url, {cache:"no-store"}); if (!r.ok) throw new Error("HTTP "+r.status); return await r.json(); }
    catch(e){ err = e; await U.sleep(400 * 2**i); }
  }
  throw err;
}
async function binance(path){
  for (let k=0;k<C.BINANCE_REST.length;k++){
    const h = C.BINANCE_REST[(restHost + k) % C.BINANCE_REST.length];
    try { const r = await fetch(h + path, {cache:"no-store"}); if (!r.ok) throw new Error(r.status); restHost = (restHost + k) % C.BINANCE_REST.length; return await r.json(); }
    catch(e){ /* try next host */ }
  }
  throw new Error("binance unreachable");
}

/* ---- Crypto list: ALL Binance USDT pairs, auto-refreshed (new listings appear, delisted ones disappear) ---- */
const MIN_QV = 1e6, BINARY_QV = 1e6;   // only actively traded pairs (>= $1M 24h volume) — binary on all of them
let wsOpen = false, cryptoTimer;
const inUse = sym => { const s = U.store.s; return s.positions.some(x => x.sym === sym) || s.fut.positions.some(x => x.sym === sym) || s.fut.orders.some(x => x.sym === sym) || (s.favs || []).includes(sym); };
async function loadCrypto(attempt=0){
  clearTimeout(cryptoTimer);
  try {
    const all = await binance("/api/v3/ticker/24hr");
    const st = new Set(C.STABLES), stocks = new Set(C.STOCKS);
    const isStock = b => b.length > 2 && b.endsWith("B") && stocks.has(b.slice(0,-1));
    const rows = all.filter(x => x.symbol.endsWith("USDT") && !st.has(x.symbol.slice(0,-4)) && !/(UP|DOWN|BULL|BEAR)$/.test(x.symbol.slice(0,-4)) && /^[A-Z0-9]+$/.test(x.symbol.slice(0,-4)) && +x.count > 0 && !isStock(x.symbol.slice(0,-4))
        && (+x.quoteVolume >= MIN_QV || C.TRADABLE_CRYPTO.includes(x.symbol.slice(0,-4)))
        && (window.LOCAL_ICONS || {})[x.symbol.slice(0,-4).toLowerCase()])   // only coins with an official logo
      .sort((a,b) => b.quoteVolume - a.quoteVolume);
    const live = new Set(rows.map(r => r.symbol));
    // delisted / dead pairs drop out automatically (kept only while you still hold or watch them)
    [...pairs.values()].filter(p => p.type === "crypto" && !live.has(p.sym) && !inUse(p.sym)).forEach(p => pairs.delete(p.sym));
    cryptoOrder = rows.map(r => r.symbol);
    rows.forEach((r, i) => {
      const base = r.symbol.slice(0,-4), price = +r.lastPrice, qv = +r.quoteVolume;
      const p = pairs.get(r.symbol) || addPair({sym:r.symbol, type:"crypto", base, quote:"USDT", name:base, listed:Date.now()});
      Object.assign(p, {rank:i+1, chg:+r.priceChangePercent, high:+r.highPrice, low:+r.lowPrice, qv, open:+r.openPrice, dp:p.dp ?? decimalsFor(price),
        tradable: C.TRADABLE_CRYPTO.includes(base) || qv >= BINARY_QV});
      if (p.price == null){ p.price = price; p.updated = Date.now(); pushHist(r.symbol, price); }
    });
    status.crypto = "live"; bus.emit("list"); bus.emit("status");
    if (!wsOpen){ wsOpen = true; openCryptoWS(); }
    cryptoTimer = setTimeout(() => loadCrypto(0), 10 * 60e3);   // re-sync listings every 10 min
  } catch(e){
    status.crypto = "retry"; bus.emit("status");
    cryptoTimer = setTimeout(() => loadCrypto(attempt+1), Math.min(30000, 2000 * 2**attempt));
  }
}

/* ---- Crypto websocket: all mini tickers ---- */
let ws, wsRetry = 0, wsTimer;
function openCryptoWS(){
  try { ws?.close(); } catch {}
  const url = C.BINANCE_WS[wsHost % C.BINANCE_WS.length] + "/ws/!miniTicker@arr";
  ws = new WebSocket(url);
  let gotMsg = false;
  ws.onmessage = ev => {
    gotMsg = true; wsRetry = 0;
    let arr; try { arr = JSON.parse(ev.data); } catch { return; }
    for (const m of arr){
      const p = pairs.get(m.s); if (!p) continue;
      const c = +m.c, o = +m.o;
      if (p.sym === chartSym && Date.now() - tradeLast < 5000) { p.chg = o ? (c-o)/o*100 : p.chg; p.high=+m.h; p.low=+m.l; continue; } // chart pair priced by trade stream
      setPrice(m.s, c, {chg: o ? (c-o)/o*100 : p.chg, high:+m.h, low:+m.l, qv:+m.q});
    }
    status.crypto = "live";
  };
  ws.onclose = () => {
    if (!gotMsg) wsHost++;
    clearTimeout(wsTimer); wsTimer = setTimeout(openCryptoWS, Math.min(30000, 1000 * 2**(wsRetry++)));
  };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

/* ---- Per-chart fast streams (crypto): trades + order book ---- */
let tradeLast = 0;
let tws, chartSym = null, twsRetry = 0, twsTimer;
const book = {bids:[], asks:[], sym:null}, trades = [];
function watchTrades(sym){
  chartSym = sym; clearTimeout(twsTimer); unwatchTradfi();
  try { tws && (tws.onclose = null, tws.close()); } catch {}
  tws = null; trades.length = 0; book.bids = []; book.asks = []; book.sym = sym;
  const p = pairs.get(sym); if (p && p.src === "bnf"){ chartSym = null; return watchTradfi(sym); }
  if (!p || p.type !== "crypto") { chartSym = null; return; }
  binance(`/api/v3/depth?symbol=${sym}&limit=20`).then(d => { if (book.sym === sym && !book.bids.length){ book.bids = d.bids; book.asks = d.asks; bus.emit("depth", sym); } }).catch(() => {});
  const s = sym.toLowerCase();
  const url = C.BINANCE_WS[wsHost % C.BINANCE_WS.length] + `/stream?streams=${s}@aggTrade/${s}@depth20@100ms`;
  const sock = tws = new WebSocket(url);
  let lastEmit = 0, pending = null, lastDepth = 0;
  sock.onmessage = ev => {
    twsRetry = 0;
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    const d = m.data; if (!d) return;
    if (m.stream.endsWith("@aggTrade")){
      tradeLast = Date.now();
      const tr = {p:+d.p, q:+d.q, buy:!d.m, t:d.T};
      trades.unshift(tr); if (trades.length > 40) trades.length = 40;
      bus.emit("trade", sym, tr);
      pending = tr.p;
      const now = Date.now();
      if (now - lastEmit > 200){ lastEmit = now; setPrice(sym, pending); pending = null; }
    } else {
      const now = Date.now(); if (now - lastDepth < 300) return; lastDepth = now;
      book.bids = d.bids; book.asks = d.asks; bus.emit("depth", sym);
    }
  };
  const flush = setInterval(() => { if (pending != null){ setPrice(sym, pending); pending = null; } }, 300);
  sock.onclose = () => { clearInterval(flush); if (tws !== sock) return; twsTimer = setTimeout(() => watchTrades(sym), Math.min(20000, 1000 * 2**(twsRetry++))); };
  sock.onerror = () => { try { sock.close(); } catch {} };
}
function unwatchTrades(){ unwatchTradfi(); chartSym = null; book.sym = null; clearTimeout(twsTimer); if (tws){ tws.onclose = null; try{ tws.close(); }catch{} tws = null; } }

/* ---- biquote.io: stocks, indices, forex, metals, commodities (auto catalogue) ---- */
let FX_SYMS = [...C.FOREX.map(f => f.s), ...C.METALS.map(m => m.s)];
const CCY = {USD:"us",EUR:"eu",GBP:"gb",JPY:"jp",CHF:"ch",AUD:"au",NZD:"nz",CAD:"ca",SGD:"sg",HKD:"hk",NOK:"no",SEK:"se",DKK:"dk",MXN:"mx",ZAR:"za",TRY:"tr",PLN:"pl",CNH:"cn",HUF:"hu",CZK:"cz",INR:"in"};
const IDX_FLAG = {US30:"us",USTEC:"us",US500:"us",SPX500:"us",NAS100:"us",US2000:"us",DXY:"us",VIX:"us",UK100:"gb",DE30:"de",GER40:"de",FR40:"fr",FRA40:"fr",JP225:"jp",JPN225:"jp",AUS200:"au",HK50:"hk",STOXX50:"eu",ESTX50:"eu",CHINA50:"cn"};
const IDX_NAME = {US500:"S&P 500 (SPX)", USTEC:"Nasdaq 100 (NAS100)", US30:"Dow Jones 30", DE30:"DAX 40 (GER40)", UK100:"FTSE 100", JP225:"Nikkei 225", HK50:"Hang Seng 50", AUS200:"ASX 200", FR40:"CAC 40", STOXX50:"Euro Stoxx 50", DXY:"US Dollar Index (DXY)"};
const METAL = {XAUUSD:"gold",XAGUSD:"silver",XPTUSD:"platinum",XPDUSD:"palladium"};
const COMMOD = {USOIL:"WTI Crude Oil",UKOIL:"Brent Crude Oil",XNGUSD:"Natural Gas",NATGASUSDT:"Natural Gas",COPPERUSDT:"Copper",XALUSD:"Aluminium",XPBUSD:"Lead"};
const POP_STOCKS = new Set("AAPL MSFT NVDA AMZN GOOGL META TSLA AVGO AMD NFLX ORCL CRM ADBE INTC QCOM TXN MU ARM TSM ASML PLTR COIN MSTR HOOD UBER SHOP PYPL BABA JPM GS V MA BAC WMT COST KO PEP MCD DIS NKE LLY UNH XOM CVX BA IBM SPY QQQ IWM DIA".split(" "));
const POP_FX = new Set("EURUSD GBPUSD USDJPY AUDUSD USDCAD USDCHF NZDUSD EURJPY GBPJPY EURGBP EURCHF AUDJPY EURAUD GBPCHF CADJPY CHFJPY AUDCAD AUDNZD EURCAD GBPAUD USDSGD USDHKD USDMXN USDZAR USDTRY USDCNH".split(" "));
const POP_COMMOD = new Set(["USOIL","UKOIL","XNGUSD","COPPERUSDT","XALUSD","XPBUSD"]);
function classify(x){
  const n = x.name; if (!x.isActive || !x.hasData || n.includes("_")) return null;
  if (x.type === "Stock" && n.endsWith("USDT") && !POP_STOCKS.has(n.slice(0,-4))) return null;
  if (x.type === "Forex" && !POP_FX.has(n)) return null;
  if (COMMOD[n] && !POP_COMMOD.has(n)) return null;
  if (x.type === "Stock" && n.endsWith("USDT") && n.length > 4) return {sym:n, type:"stock", base:n.slice(0,-4), quote:"USDT", name:x.description || n.slice(0,-4)};
  if (x.type === "Index" && IDX_FLAG[n]) return {sym:n, type:"index", base:n, quote:"", name:IDX_NAME[n] || x.description || n, flag:IDX_FLAG[n]};
  if (METAL[n]) return {sym:n, type:"metal", base:n.slice(0,3), quote:"USD", name:x.description || n, metal:METAL[n]};
  if (COMMOD[n]) return {sym:n, type:"commodity", base:n, quote:"", name:COMMOD[n]};
  if (x.type === "Forex" && /^[A-Z]{6}$/.test(n) && CCY[n.slice(0,3)] && CCY[n.slice(3)]) return {sym:n, type:"forex", base:n.slice(0,3), quote:n.slice(3), name:x.description || n, flags:[CCY[n.slice(0,3)], CCY[n.slice(3)]]};
  return null;
}
async function loadCatalog(){
  try {
    let list; const key = "bq_cat_v3";
    try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 6 * 3600e3) list = c.d; } catch {}
    if (!list){ const r = await fetch(C.BIQUOTE + "/api/symbols"); if (!r.ok) throw 0; list = (await r.json()).map(classify).filter(Boolean); try { localStorage.setItem(key, JSON.stringify({t:Date.now(), d:list})); } catch {} }
    const live = new Set(list.map(x => x.sym));
    [...pairs.values()].filter(p => ["stock","index","commodity","forex","metal"].includes(p.type) && !p.fixed && !live.has(p.sym) && !inUse(p.sym)).forEach(p => pairs.delete(p.sym));
    list.forEach(x => { if (!pairs.has(x.sym)) addPair(Object.assign({tradable:true, dp:5, listed:Date.now()}, x)); });
    FX_SYMS = [...pairs.values()].filter(p => p.type !== "crypto" && p.src !== "bnf").map(p => p.sym);
    bus.emit("list"); pollFx();
    if (hub && hubLive) try { await hub.invoke("Subscribe", FX_SYMS); } catch {}
  } catch {}
  setTimeout(loadCatalog, 6 * 3600e3);
}
function applyQuote(q){
  if (!q || !q.symbol) return;
  const p = pairs.get(q.symbol); if (!p || p.src === "bnf") return;   // Binance 24/7 feed owns these symbols
  if (!p.dpSet && q.mid){ const t = String(q.bid ?? q.mid).split(".")[1]; if (t){ p.dp = Math.min(6, Math.max(2, t.replace(/0+$/, "").length || 2)); p.dpSet = true; } }
  const closed = String(q.marketState || "").toLowerCase() === "closed";
  const mid = +q.mid || ((+q.bid + +q.ask) / 2);
  const extra = {closed, high: +q.high || p.high, low: +q.low || p.low};
  if (q.dayDiffPercent != null) extra.chg = +q.dayDiffPercent;
  if (mid > 0 && mid !== p.price) setPrice(q.symbol, mid, extra);
  else { Object.assign(p, extra); if (mid > 0) p.updated = Date.now(); bus.emit("meta", q.symbol); }
}
let pollTimer, pollFails = 0, hub = null, hubLive = false, lastHubTick = 0;
async function pollFx(){
  clearTimeout(pollTimer);
  try {
    for (let i = 0; i < FX_SYMS.length; i += 80){
      const qs = FX_SYMS.slice(i, i + 80).map(s => "symbols=" + encodeURIComponent(s)).join("&");
      const r = await fetch(C.BIQUOTE + "/api/latest?" + qs, {cache:"no-store"});
      if (!r.ok) throw new Error(r.status);
      Object.values(await r.json()).forEach(applyQuote);
    }
    pollFails = 0; status.fx = "live"; bus.emit("status");
  } catch { pollFails++; }
  const hubFresh = hubLive && Date.now() - lastHubTick < 10000;
  const delay = hubFresh ? 15000 : pollFails ? Math.min(30000, 2000 * 2**Math.min(pollFails,4)) : 2000;
  pollTimer = setTimeout(pollFx, delay);
}
let hubRetry = 0;
async function startHub(){
  if (!window.signalR) return;
  try {
    hub = new signalR.HubConnectionBuilder().withUrl(C.BIQUOTE + "/hubs/tick", hubRetry % 2 === 0 ? {skipNegotiation:true, transport:signalR.HttpTransportType.WebSockets} : {withCredentials:false}).withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000]).configureLogging(signalR.LogLevel.None).build();
    hub.on("ReceiveTick", tk => { lastHubTick = Date.now(); applyQuote(tk); });
    hub.onreconnected(async () => { hubLive = true; try { await hub.invoke("Subscribe", FX_SYMS); } catch {} });
    hub.onreconnecting(() => { hubLive = false; });
    hub.onclose(() => { hubLive = false; setTimeout(startHub, Math.min(60000, 3000 * 2**(hubRetry++))); });
    await hub.start(); await hub.invoke("Subscribe", FX_SYMS); hubLive = true; hubRetry = 0; status.fx = "live";
  } catch { hubLive = false; setTimeout(startHub, Math.min(60000, 3000 * 2**(hubRetry++))); }
}

/* ---- v6.9: Binance USD-M TradFi perpetuals (stocks, ETFs, gold/silver/oil/gas/copper, FX) - trade 24/7 ----
   REST: fapi.binance.com -> www.binance.com/fapi (CORS ok)  |  WS: fstream.binance.com (aggTrade) with REST price polling fallback */
let fHost = 0, tfTimer, tfLoaded = false, tfNames = {}, tfMeta = new Map();
async function fapi(path){
  const H = C.BINANCE_FAPI;
  for (let k = 0; k < H.length; k++){
    const i = (fHost + k) % H.length;
    try { const r = await fetch(H[i] + path, {cache:"no-store"}); if (!r.ok) throw new Error(r.status); const j = await r.json(); fHost = i; return j; } catch(e){ /* next host */ }
  }
  throw new Error("fapi unreachable");
}
const TF_TWIN = {XAUUSDT:"XAUUSD", XAGUSDT:"XAGUSD", XPTUSDT:"XPTUSD", XPDUSDT:"XPDUSD", CLUSDT:"USOIL", BZUSDT:"UKOIL", NATGASUSDT:"XNGUSD"};
const TF_REGION = {KR_EQUITY:"KR", HK_EQUITY:"HK", CN_EQUITY:"CN"};
function tfClassify(sym, base, ut, pp){
  const N = window.TF_NAMES || {}, K = window.TF_COMMOD || {};
  const o = {src:"bnf", h247:true, closed:false, tradable:true, dp:pp, quote:"USDT", tfType:ut};
  if (ut === "COMMODITY"){
    const k = K[base] || [base];
    return k[1] ? Object.assign(o, {type:"metal", base, name:k[0], metal:k[1]}) : Object.assign(o, {type:"commodity", base:sym, quote:"", name:k[0]});
  }
  if (ut === "FX"){ const a = base.slice(0,3), b = base.slice(3); return Object.assign(o, {type:"forex", base:a, quote:b, name:a + " / " + b, flags:[CCY[a] || "us", b === "BRL" ? "br" : CCY[b] || "us"]}); }
  const pre = ut === "PREMARKET";
  return Object.assign(o, {type:"stock", base, name:N[base] || base, pre, region:TF_REGION[ut] || ""});
}
/* v7.0 TradFi session: "open" (regular hours) | "off" (Off-Hours: still trades on Binance) | "closed" (Binance itself is closed).
   1) Binance trading schedule when the endpoint answers (REGULAR = open, NO_TRADING = closed, anything else = off-hours)
   2) fallback: the exchange's local regular hours by underlying type (commodity/FX: Sun 22:00 - Fri 21:00 UTC with a 21:00-22:00 break; equities: local exchange hours)
   3) closed only if Binance reports no trade for 6h while it is outside regular hours */
let tfSched = null, tfSchedAt = 0;
const TF_LOCAL = {EQUITY:["America/New_York", 570, 960], KR_EQUITY:["Asia/Seoul", 540, 930], HK_EQUITY:["Asia/Hong_Kong", 570, 960], CN_EQUITY:["Asia/Shanghai", 570, 900]};
function tzParts(tz, ms){
  try {
    const f = new Intl.DateTimeFormat("en-US", {timeZone:tz, weekday:"short", hour:"numeric", minute:"numeric", hourCycle:"h23"}).formatToParts(new Date(ms)), g = k => (f.find(x => x.type === k) || {}).value;
    return {d:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(g("weekday")), m:(+g("hour") % 24) * 60 + +g("minute")};
  } catch { const d = new Date(ms); return {d:d.getUTCDay(), m:d.getUTCHours() * 60 + d.getUTCMinutes()}; }
}
function tfHeuristic(p, now){
  const ut = p.tfType;
  if (ut === "PREMARKET") return "open";
  if (ut === "COMMODITY" || ut === "FX"){
    const u = tzParts("UTC", now), m = u.m;
    if (u.d === 6 || (u.d === 5 && m >= 21 * 60) || (u.d === 0 && m < 22 * 60)) return "off";
    return m >= 21 * 60 && m < 22 * 60 ? "off" : "open";
  }
  const z = TF_LOCAL[ut] || TF_LOCAL.EQUITY, l = tzParts(z[0], now);
  return l.d >= 1 && l.d <= 5 && l.m >= z[1] && l.m < z[2] ? "open" : "off";
}
function tfSessionOf(p, lastTrade, now){
  let st = null;
  if (tfSched){
    const key = tfSched[p.tfType] ? p.tfType : (/EQUITY$/.test(p.tfType || "") || !p.tfType ? "EQUITY" : p.tfType), grp = tfSched[key] || (key === "FX" ? tfSched.COMMODITY : null);
    const ss = grp && (grp.sessions || grp);
    if (Array.isArray(ss)){
      const hit = ss.find(x => +x.startTime <= now && now < +x.endTime);
      if (hit){ const ty = String(hit.type || "").toUpperCase(); st = ty === "REGULAR" ? "open" : ty === "NO_TRADING" || ty === "CLOSED" ? "closed" : "off"; }
    }
  }
  if (!st) st = tfHeuristic(p, now);
  if (st === "off" && lastTrade > 0 && now - lastTrade > 6 * 3600e3 && now - lastTrade < 30 * 864e5) st = "closed";
  return st;
}
async function loadTfSchedule(){
  if (Date.now() - tfSchedAt < 30 * 60e3) return; tfSchedAt = Date.now();
  try { const j = await fapi("/fapi/v1/tradingSchedule"), ms = j && (j.marketSchedules || j); if (ms && typeof ms === "object") tfSched = ms; } catch { /* endpoint not available: heuristic */ }
}
function tfApply(t){
  const p = pairs.get(t.symbol); if (!p || p.src !== "bnf") return;
  const price = +t.lastPrice, extra = {chg:+t.priceChangePercent, high:+t.highPrice, low:+t.lowPrice, qv:+t.quoteVolume, open:+t.openPrice};
  { const st = tfSessionOf(p, +t.closeTime, Date.now()); extra.session = st; extra.offHours = st === "off"; extra.closed = st === "closed"; }
  if (price > 0 && price !== p.price) setPrice(t.symbol, price, extra);
  else { Object.assign(p, extra); if (price > 0){ p.updated = Date.now(); if (p.price == null) p.price = price; } }
}
async function loadTradfi(){
  clearTimeout(tfTimer);
  try {
    if (!tfLoaded){
      let info; const key = "bnf_tf_v2";
      try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 12 * 3600e3) info = c.d; } catch {}
      if (!info){
        const ei = await fapi("/fapi/v1/exchangeInfo");
        info = ei.symbols.filter(x => x.contractType === "TRADIFI_PERPETUAL" && x.status === "TRADING" && x.quoteAsset === "USDT" && /^[A-Z0-9]+USDT$/.test(x.symbol)).map(x => { const f = (x.filters || []).find(y => y.filterType === "PRICE_FILTER"), tk = f ? String(+f.tickSize) : "", dp = tk.includes("e-") ? +tk.split("e-")[1] : (tk.split(".")[1] || "").length;
          return [x.symbol, x.baseAsset, x.underlyingType, dp > 0 || tk ? Math.min(x.pricePrecision, dp) : x.pricePrecision]; });
        try { localStorage.setItem(key, JSON.stringify({t:Date.now(), d:info})); } catch {}
      }
      info.forEach(([sym, base, ut, pp]) => {
        const o = tfClassify(sym, base, ut, pp), ex = pairs.get(sym);
        if (ex){ Object.assign(ex, o, {synthetic:false}); }
        else addPair(Object.assign({sym}, o));
        const twin = TF_TWIN[sym] && pairs.get(TF_TWIN[sym]);
        if (twin){ twin.fdup = true; pairs.get(sym).perpOnly = true; pairs.get(sym).twin = twin.sym; }
      });
      tfLoaded = true;
      FX_SYMS = [...pairs.values()].filter(p => p.type !== "crypto" && p.src !== "bnf").map(p => p.sym);
      bus.emit("list");
    }
    await loadTfSchedule();
    (await fapi("/fapi/v1/ticker/24hr")).forEach(tfApply);
    status.tradfi = "live"; bus.emit("status");
  } catch(e){ status.tradfi = "retry"; }
  tfTimer = setTimeout(loadTradfi, document.hidden ? 60e3 : tfLoaded ? 30e3 : 8e3);
}
/* per-chart live stream for a TradFi pair: aggTrade over fstream, REST price poll as fallback */
let ftws, ftTimer, ftPoll, ftSym = null, ftRetry = 0;
function watchTradfi(sym){
  unwatchTradfi(); ftSym = sym; if (book.sym !== sym){ book.bids = []; book.asks = []; } book.sym = sym;
  const s = sym.toLowerCase();
  let gotWs = false;
  let nPoll = 0;
  const pollOnce = async () => {
    if (ftSym !== sym) return;
    try {
      const j = await fapi(`/fapi/v1/ticker/price?symbol=${sym}`); if (ftSym !== sym) return;
      if (+j.price > 0) setPrice(sym, +j.price);
      if (!gotWs && nPoll++ % 2 === 0){ const d = await fapi(`/fapi/v1/depth?symbol=${sym}&limit=20`); if (ftSym === sym && !gotWs){ if ((d.bids || []).length || (d.asks || []).length || !book.bids.length){ book.bids = d.bids; book.asks = d.asks; } bus.emit("depth", sym); } }
    } catch {}
  };
  pollOnce(); ftPoll = setInterval(() => { if (!gotWs && !document.hidden) pollOnce(); }, 1500);
  const open = () => {
    if (ftSym !== sym) return;
    let sock; try { sock = ftws = new WebSocket(C.BINANCE_FWS[0] + `/stream?streams=${s}@aggTrade/${s}@depth20@500ms`); } catch { return; }
    let lastEmit = 0, lastDepth = 0;
    sock.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; } const d = m.data; if (!d) return;
      gotWs = true; ftRetry = 0;
      if (String(m.stream).endsWith("@aggTrade")){
        const tr = {p:+d.p, q:+d.q, buy:!d.m, t:d.T}; trades.unshift(tr); if (trades.length > 40) trades.length = 40; bus.emit("trade", sym, tr);
        const now = Date.now(); if (now - lastEmit > 200){ lastEmit = now; setPrice(sym, tr.p); }
      } else { const now = Date.now(); if (now - lastDepth < 300) return; lastDepth = now; const nb = d.b || d.bids || [], na = d.a || d.asks || []; if (nb.length || na.length || !book.bids.length){ book.bids = nb; book.asks = na; } bus.emit("depth", sym); }   /* off-hours: keep the last snapshot if Binance sends an empty book */
    };
    sock.onclose = () => { gotWs = false; if (ftws !== sock || ftSym !== sym) return; ftTimer = setTimeout(open, Math.min(20000, 2000 * 2 ** (ftRetry++))); };
    sock.onerror = () => { try { sock.close(); } catch {} };
  };
  open();
}
function unwatchTradfi(){ ftSym = null; clearTimeout(ftTimer); clearInterval(ftPoll); if (ftws){ ftws.onclose = null; try { ftws.close(); } catch {} ftws = null; } }

/* ---- Candles (OHLCV) ---- */
const TF_SEC = {tick:1, "1s":1, "5s":5, "15s":15, "30s":30, "1m":60, "5m":300, "15m":900, "1h":3600, "4h":14400, "1d":86400, "3d":259200, "1w":604800, "1M":2592000};
function aggregate(bars, sec){
  const out = [];
  for (const b of bars){
    const t = Math.floor(b.time / sec) * sec, l = out[out.length-1];
    if (l && l.time === t){ l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; l.volume += b.volume || 0; }
    else out.push({time:t, open:b.open, high:b.high, low:b.low, close:b.close, volume:b.volume || 0});
  }
  return out;
}
async function candles(sym, tf){
  const p = pairs.get(sym); const sec = TF_SEC[tf];
  if (p.type === "crypto"){
    const k = r => ({time: Math.floor(r[0]/1000), open:+r[1], high:+r[2], low:+r[3], close:+r[4], volume:+r[5]});
    if (sec < 60){
      const pages = tf === "tick" || tf === "1s" || tf === "5s" ? 1 : tf === "15s" ? 2 : 3;
      let end = null, all = [];
      for (let i=0;i<pages;i++){
        const rows = await binance(`/api/v3/klines?symbol=${sym}&interval=1s&limit=1000` + (end ? `&endTime=${end}` : ""));
        all = rows.map(k).concat(all); if (!rows.length) break; end = rows[0][0] - 1;
      }
      return aggregate(tf === "tick" ? all.slice(-600) : tf === "1s" ? all.slice(-900) : all, sec);
    }
    const rows = await binance(`/api/v3/klines?symbol=${sym}&interval=${tf}&limit=500`);
    return rows.map(k);
  }
  if (p.src === "bnf"){
    const iv = sec < 60 ? "1m" : tf, k = r => ({time: Math.floor(r[0]/1000), open:+r[1], high:+r[2], low:+r[3], close:+r[4], volume:+r[5]});
    let bars = (await fapi(`/fapi/v1/klines?symbol=${sym}&interval=${iv}&limit=500`)).map(k).filter(b => b.open > 0);
    if (sec < 60){
      const ticks = (hist.get(sym) || []).map(x => ({time:Math.floor(x.t/1000), open:x.p, high:x.p, low:x.p, close:x.p, volume:1}));
      const cut = ticks.length ? ticks[0].time : Infinity;
      bars = bars.filter(b => b.time + 60 <= cut).concat(aggregate(ticks, sec));
    }
    return bars;
  }
  const iv = sec < 60 ? "1m" : sec > 86400 ? "1d" : tf;
  const d = await getJSON(`${C.BIQUOTE}/api/${sym}/ohlc?interval=${iv}&limit=300`, 3);
  let bars = (d.bars || []).map(b => ({time: Math.floor(Date.parse(b.openTime)/1000), open:+b.open, high:+b.high, low:+b.low, close:+b.close, volume:+b.tickVolume || 0}))
    .filter(b => b.open > 0).sort((a,b) => a.time - b.time);
  if (sec > 86400) bars = aggregate(bars, sec);
  if (sec < 60){
    const ticks = (hist.get(sym) || []).map(x => ({time:Math.floor(x.t/1000), open:x.p, high:x.p, low:x.p, close:x.p, volume:1}));
    const cut = ticks.length ? ticks[0].time : Infinity;
    bars = bars.filter(b => b.time + 60 <= cut).concat(aggregate(ticks, sec));
  }
  return bars;
}

/* ---- Sentiment / signals from recent ticks ---- */
function momentum(sym, windowMs=60000){
  const h = hist.get(sym); if (!h || h.length < 3) return 0;
  const now = Date.now(); const pts = h.filter(x => now - x.t <= windowMs); if (pts.length < 3) return 0;
  let up=0, dn=0; for (let i=1;i<pts.length;i++){ const d = pts[i].p - pts[i-1].p; if (d>0) up++; else if (d<0) dn++; }
  const drift = (pts[pts.length-1].p - pts[0].p) / pts[0].p;
  const tot = up + dn || 1;
  return U.clamp(((up - dn)/tot) * 0.6 + Math.sign(drift) * Math.min(1, Math.abs(drift)*400) * 0.4, -1, 1);
}

function isStale(p){ return !p || p.price == null || (Date.now() - p.updated > (p.type==="crypto" ? 30000 : 120000)); }
function label(p){ return p.type === "crypto" ? p.base + "/USDT" : p.quote ? p.base + "/" + p.quote : p.base; }
function fmtPx(p, v=p?.price){ return v == null ? "--" : U.fmt(v, p.dp ?? decimalsFor(v)); }

/* ---- v6.6: USDT/USD rate (stablecoin wobble, 0.9995-1.0002) ---- */
function usdtUsd(){ const t = Date.now(); return 0.99985 + 0.00025 * Math.sin(t / 41000) + 0.0001 * Math.sin(t / 7300 + 1.3); }

/* ---- v6.6: popular stock tickers with no live feed -> synthetic random walk (silent, never throws) ---- */
const SYNTH = {NVDA:[180,"NVIDIA Corp"], GOOGL:[280,"Alphabet Inc"], TSLA:[430,"Tesla Inc"], MSTR:[300,"Strategy Inc"], STRC:[100,"Strategy Variable Rate Pref."], AAPL:[270,"Apple Inc"], META:[640,"Meta Platforms"], AMZN:[230,"Amazon.com Inc"], ANTHROPIC:[250,"Anthropic (Pre-IPO)"]};
let synthOn = false;
function addSynthetic(){
  if (synthOn) return; synthOn = true;
  try {
    let saved = {}; try { saved = JSON.parse(localStorage.getItem("synth_px_v1") || "{}"); } catch {}
    const list = [];
    for (const T in SYNTH){
      const sym = T + "USDT"; if (pairs.has(sym)) continue;
      const [base, nm] = SYNTH[T], px0 = saved[T] > 0 ? saved[T] : base * (0.97 + Math.random() * 0.06), open = base * (0.985 + Math.random() * 0.03);
      const p = addPair({fixed:true, sym, type:"stock", base:T, quote:"USDT", name: nm + (T === "ANTHROPIC" ? " · Pre-market · Synthetic" : " · Synthetic"), tradable:true, dp:2, synthetic:true, pre:T === "ANTHROPIC", listed:Date.now(),
        price:px0, open, high:px0, low:px0, chg:(px0 - open) / open * 100, updated:Date.now()});
      pushHist(sym, px0); list.push(p);
    }
    if (!list.length) return;
    bus.emit("list");
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
    let n = 0;
    setInterval(() => {
      try {
        list.forEach(p => {
          if (p.src === "bnf") return;   // real Binance TradFi feed took over
          const prev = p.price, vol = p.pre ? 0.0007 : 0.0004, np = Math.max(1, prev * (1 + gauss() * vol + (p.open - prev) / p.open * 0.0008));
          p.price = np; p.updated = Date.now(); p.dir = np >= prev ? 1 : -1; p.high = Math.max(p.high, np); p.low = Math.min(p.low, np); p.chg = (np - p.open) / p.open * 100;
          pushHist(p.sym, np); bus.emit("tick", p.sym, np, prev);
        });
        if (++n % 10 === 0){ const o = {}; list.forEach(p => o[p.base] = p.price); try { localStorage.setItem("synth_px_v1", JSON.stringify(o)); } catch {} }
      } catch {}
    }, 1500);
  } catch {}
}
function start(){ loadCrypto(); pollFx(); startHub(); loadCatalog(); setTimeout(loadTradfi, 1200); setTimeout(addSynthetic, 9000); }
window.addEventListener("online", () => { loadCrypto(); pollFx(); });

window.M = {loadTradfi, usdtUsd, addSynthetic, pairs, hist, status, book, trades, get cryptoOrder(){ return cryptoOrder; }, start, candles, watchTrades, unwatchTrades, momentum, isStale, label, fmtPx, TF_SEC, get: s => pairs.get(s)};
})();
