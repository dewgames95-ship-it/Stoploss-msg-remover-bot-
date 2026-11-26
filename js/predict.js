/* ===== v6.8 Prediction market (Polymarket-style) — live Polymarket data, trading against the NovaTrade `predict` wallet =====
   Routes: #/predict (markets) · #/predict/m/<event slug|id>[/<market id>] (detail) · #/predict/book/<slug>/<market id> (order book)
           #/predict/portfolio · #/predict/profile   (#/predict/perps was removed in v6.8 → redirects to #/predict)
   Market data: Gamma (events/markets), CLOB (/book, /books, /prices-history), Data API v2 (trades, holders) and the CLOB market
   websocket — all public, CORS *, no key. Money moves only through API.call(...) (js/acct.js), so a server can take over later.

   ── Backend contract (same names become POST /api/<name> on the server) ──────────────────────────────────────────
   predict.order      {mid, eid, slug, q, title, img, end, outcome, oi, token, tokens:[yes,no], side:"buy"|"sell",
                       type:"market"|"limit", amount? (USDC, market buy), shares? (sell / limit), price? (0-1, limit),
                       levels?:[[price,size],...] (client quote of the book side it hits; the server uses its own book)}
                      → {order?:Order, fill?:{shares, avg, amount, fee}, position?:Position|null, balance}
   predict.fill       {id, price}                      resting limit order crossed by the live book → {fill, balance}
   predict.cancel     {id}                             → {ok:true, refund, balance}
   predict.sell       {token, shares, levels?}         market-sell (close) a position → same as predict.order sell
   predict.settle     {mid, prices:[p0,p1]}            market resolved (pays 1 per winning share) → {payout, settled, balance}
   predict.portfolio  {}                               → {positions, orders, history, balance}
   Shapes: Position {id, token, tokens, mid, eid, slug, q, title, img, end, outcome, oi, shares, locked, cost, avg, t, last}
           Order    {id, token, tokens, mid, slug, q, title, img, outcome, oi, side, price, shares, reserved, t}
           History  {id, kind:"buy"|"sell"|"limit"|"cancel"|"fill"|"won"|"lost"|"refund", q, title, outcome,
                     shares, price, amount, fee, pnl, slug, img, t}
   Data: localStorage ACCT.key("nt_predict") = {orders, positions, history, perps:[] (always empty, kept for the contract), pnl:[{t,v}], realized, vol, seeded, joined}
   Admin: U.store.s.admin.predict = {enabled, maxBet, feePct} (perpMaxLev is ignored: Perps removed). Admin panel reads window.PRED.data() / .stats(). */
(function(){
const {esc, ic, store, fmt, toast, bus} = U;
const GAMMA = "https://gamma-api.polymarket.com", CLOB = "https://clob.polymarket.com", DAPI = "https://data-api.polymarket.com/v2", WSS = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const W = "predict", PAGE = 12;
const KEY = () => window.ACCT ? ACCT.key("nt_predict") : "nt_predict";
const CKEY = "nt_predict_cache";
const cfg = () => { const a = Object.assign({enabled:true, maxBet:5000, feePct:0, perpMaxLev:10}, (store.s.admin || {}).predict || {}); a.maxBet = +a.maxBet || 5000; a.feePct = Math.max(0, +a.feePct || 0); a.perpMaxLev = Math.max(1, Math.min(100, +a.perpMaxLev || 10)); return a; };
const isDemo = () => !window.ACCT || ACCT.isDemo();
const modeLabel = () => isDemo() ? "Demo" : "Real";
const bal = () => store.wb(W);
const r2 = v => Math.round(v * 100) / 100, r4 = v => Math.round(v * 1e4) / 1e4;
const now = () => Date.now();

/* ---------- formatting (en-US, $ amounts, ¢ prices) ---------- */
const usd = (v, d = 2) => (v < 0 ? "-" : "") + "$" + fmt(Math.abs(v || 0), d);
const usdS = v => (v > 0.004 ? "+" : v < -0.004 ? "-" : "") + "$" + fmt(Math.abs(v || 0), 2);
const cmp = v => { v = +v || 0; const a = Math.abs(v); return a >= 1e9 ? (v/1e9).toFixed(1) + "B" : a >= 1e6 ? (v/1e6).toFixed(1) + "M" : a >= 1e3 ? (v/1e3).toFixed(a >= 1e4 ? 0 : 1) + "K" : fmt(v, 0); };
const cents = p => { if (p == null || isNaN(p)) return "--"; const v = p * 100; if (v > 0 && v < .1) return "<0.1¢"; return (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1)) + "¢"; };
const chancePct = p => p == null || isNaN(p) ? "--" : p * 100 < 1 && p > 0 ? "<1%" : p * 100 > 99 && p < 1 ? ">99%" : Math.round(p * 100) + "%";
const shr = v => fmt(v, 2);
const dShort = iso => { const t = Date.parse(iso); return isNaN(t) ? "" : new Date(t).toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"}); };
const ago = t => { const d = (now() - t) / 1000; if (d < 60) return Math.max(1, Math.floor(d)) + "s ago"; if (d < 3600) return Math.floor(d/60) + "m ago"; if (d < 86400) return Math.floor(d/3600) + "h ago"; return Math.floor(d/86400) + "d ago"; };
const endsIn = iso => { const t = Date.parse(iso); if (isNaN(t)) return ""; const d = t - now(); if (d <= 0) return "Ended"; if (d < 3600e3) return Math.ceil(d/60e3) + "m left"; if (d < 86400e3) return Math.floor(d/3600e3) + "h left"; return dShort(iso); };
const img = (src, cls = "pd-img", alt = "") => src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">` : `<span class="${cls} pd-img-ph">${ic("target", 18)}</span>`;
const raf = fn => { let q = false; return () => { if (q) return; q = true; requestAnimationFrame(() => { q = false; fn(); }); }; };
const hap = (p = 8) => U.buzz && U.buzz(p);
const notif = (title, body, tone = "info") => { try { if (U.pushNotif) U.pushNotif("predict", title, body, tone); else store.notify && store.notify(title, body, tone); } catch {} };

/* ---------- comma-formatted numeric inputs (v6.9) ---------- */
const unc = v => String(v == null ? "" : v).replace(/,/g, "");
const cin = v => { v = unc(v); if (v === "") return ""; const k = v.indexOf("."), i = (k < 0 ? v : v.slice(0, k)).replace(/^0+(?=\d)/, ""), d = k < 0 ? null : v.slice(k + 1); return (i === "" ? "0" : i).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (d != null ? "." + d : ""); };
function numInput(el, dec, onCh){
  if (!el) return;
  el.addEventListener("input", () => {
    const pos = el.selectionStart == null ? el.value.length : el.selectionStart, raw = el.value; let before = 0; for (let i = 0; i < pos; i++) if (/[\d.]/.test(raw[i])) before++;
    let v = raw.replace(/[^\d.]/g, ""); const dot = v.indexOf(".");
    if (dec <= 0) v = v.replace(/\./g, ""); else if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, dec);
    const out = cin(v); el.value = out;
    let c = 0, i = 0; while (i < out.length && c < before){ if (/[\d.]/.test(out[i])) c++; i++; }
    try { el.setSelectionRange(i, i); } catch {}
    onCh(unc(out));
  });
}

/* ---------- own overlay layer (confirm + help popups; never replaces the open sheet) ---------- */
function pdOverlay(cls, html){ const el = document.createElement("div"); el.className = "pd-ovl " + cls; el.innerHTML = html; document.body.appendChild(el); requestAnimationFrame(() => el.classList.add("show")); return el; }
function closeOvl(el){ if (!el) return; el.classList.remove("show"); setTimeout(() => el.remove(), 200); }
const closeAllOvl = () => document.querySelectorAll(".pd-ovl").forEach(e => e.remove());
/* confirmation with details; resolves true only on Confirm */
function pdConfirm({title, sub = "", rows = [], ok = "Confirm", tone = "yes"}){
  return new Promise(res => {
    const el = pdOverlay("pd-cfw", `<div class="pd-cf" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="pd-cf-h"><b>${esc(title)}</b><button type="button" data-x aria-label="Close">${ic("close", 18)}</button></div>${sub ? `<div class="pd-cf-sub">${sub}</div>` : ""}
      <div class="pd-cf-rows">${rows.map(([k, v, c]) => `<div class="${c || ""}"><span>${k}</span><b class="num">${v}</b></div>`).join("")}</div>
      <div class="pd-cf-btns"><button type="button" class="pd-cf-no" data-no>Cancel</button><button type="button" class="pd-cf-ok ${tone}" data-yes>${esc(ok)}</button></div></div>`);
    let done = false; const fin = v => { if (done) return; done = true; closeOvl(el); res(v); };
    el.querySelector("[data-yes]").onclick = () => fin(true);
    el.querySelector("[data-no]").onclick = el.querySelector("[data-x]").onclick = () => fin(false);
    el.addEventListener("click", e => { if (e.target === el) fin(false); });
  });
}
/* small help popup: title, short text, optional graphic, X close */
function pdPop(title, html, onMount){
  const el = pdOverlay("pd-popw", `<div class="pd-pop" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="pd-pop-h"><b>${esc(title)}</b><button type="button" data-x aria-label="Close">${ic("close", 18)}</button></div><div class="pd-pop-b">${html}</div></div>`);
  const close = () => closeOvl(el);
  el.querySelector("[data-x]").onclick = close; el.addEventListener("click", e => { if (e.target === el) close(); });
  onMount && onMount(el, close); return el;
}
const qIcon = (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.3-2.8 4"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/></svg>`;

/* ---------- persistent data (per account mode) ---------- */
let D = null, svT = 0;
function data(){
  if (!D){
    let x = {}; try { x = JSON.parse(localStorage.getItem(KEY()) || "{}") || {}; } catch {}
    D = Object.assign({orders:[], positions:[], history:[], perps:[], pnl:[], realized:0, vol:0, seeded:false, joined:now()}, x);
    ["orders","positions","history","perps","pnl"].forEach(k => { if (!Array.isArray(D[k])) D[k] = []; });
  }
  return D;
}
function save(){ clearTimeout(svT); svT = setTimeout(saveNow, 120); }
function saveNow(){ clearTimeout(svT); try { localStorage.setItem(KEY(), JSON.stringify(D)); } catch {} }
const emit = () => bus.emit("predict");
function hist(h){ const d = data(); d.history.unshift(Object.assign({id: U.uid(), t: now()}, h)); if (d.history.length > 300) d.history.length = 300; }
function realize(p){ const d = data(); d.realized = r2((d.realized || 0) + p); d.pnl.push({t: now(), v: d.realized}); if (d.pnl.length > 500) d.pnl.splice(0, d.pnl.length - 500); }
const meta = r => ({mid: String(r.mid), eid: r.eid, slug: r.slug, q: r.q, title: r.title || "", img: r.img, end: r.end, outcome: r.outcome, oi: +r.oi || 0, token: r.token, tokens: r.tokens, outs: r.outs});

/* ---------- money (only through API.call, js/acct.js) ---------- */
async function debit(amount, reason){
  amount = r2(amount); if (!(amount > 0)) return;
  if (window.API) return API.call("wallet.debit", {wallet: W, amount, reason});
  if (bal() + 1e-9 < amount) throw new Error("Insufficient balance"); store.addWallet(W, -amount, reason);
}
async function credit(amount, reason){
  amount = r2(amount); if (!(amount > 0)) return;
  if (window.API) return API.call("wallet.credit", {wallet: W, amount, reason});
  store.addWallet(W, amount, reason);
}

/* ---------- live market state ---------- */
const EV = new Map();          // slug|id -> normalized event
const PX = {};                 // token -> {bid, ask, last, t}
const BOOK = {};               // token -> {b: Map(price->size), a: Map}
const TRADES = {};             // token -> [{p, s, side, t}]
const pxListeners = new Set(); // fn(token)
const tradeListeners = new Set();
const J = s => { try { return typeof s === "string" ? JSON.parse(s) : (s || []); } catch { return []; } };
function normM(m){
  const tokens = J(m.clobTokenIds).map(String), outs = J(m.outcomes), prices = J(m.outcomePrices).map(Number);
  return {id: String(m.id), q: m.question || "", gt: m.groupItemTitle || "", cid: m.conditionId, slug: m.slug, img: m.icon || m.image || "",
    tokens, outs: outs.length === 2 ? outs : ["Yes","No"], prices: prices.length === 2 ? prices : [.5,.5],
    bid: +m.bestBid || 0, ask: +m.bestAsk || 0, last: +m.lastTradePrice || 0, closed: !!m.closed, active: m.active !== false,
    accepting: m.acceptingOrders !== false, vol: +m.volumeNum || +m.volume || 0, vol24: +m.volume24hr || 0, chg: +m.oneDayPriceChange || 0,
    end: m.endDate || "", tick: +m.orderPriceMinTickSize || .01, desc: m.description || "", start: m.startDate || ""};
}
function normE(e){
  let ms = (e.markets || []).map(normM).filter(m => m.tokens.length === 2);
  const open = ms.filter(m => !m.closed && m.active);
  if (open.length) ms = open;
  ms.sort((a, b) => chance(b) - chance(a));
  return {id: String(e.id), slug: e.slug || String(e.id), title: e.title || (ms[0] && ms[0].q) || "", img: e.icon || e.image || (ms[0] && ms[0].img) || "",
    vol: +e.volume || 0, vol24: +e.volume24hr || 0, liq: +e.liquidity || 0, end: e.endDate || (ms[0] && ms[0].end) || "", start: e.startDate || "",
    created: e.creationDate || e.createdAt || "", desc: e.description || (ms[0] && ms[0].desc) || "", res: e.resolutionSource || "",
    tags: (e.tags || []).map(t => t.slug).filter(Boolean).slice(0, 6), closed: !!e.closed, markets: ms, full: !!e.description};
}
const slim = e => Object.assign({}, e, {desc: "", full: false, markets: e.markets.slice(0, 4).map(m => Object.assign({}, m, {desc: ""}))});
function remember(e){ const old = EV.get(e.slug); if (old && old.full && !e.full) return old; EV.set(e.slug, e); EV.set(e.id, e); return e; }
const mPx = m => PX[m.tokens[0]] || {};
function chance(m){
  const px = mPx(m), bid = px.bid ?? m.bid, ask = px.ask ?? m.ask, last = px.last ?? m.last;
  if (m.closed) return m.prices[0];
  if (bid > 0 && ask > 0 && ask - bid <= .1 + 1e-9) return (bid + ask) / 2;
  return last || m.prices[0] || 0;
}
/* best price to BUY outcome oi (its ask) / to SELL it (its bid) */
function buyPx(m, oi){ const L = levels(m, oi, "ask"); if (L.length) return L[0][0]; const px = mPx(m), bid = px.bid ?? m.bid, ask = px.ask ?? m.ask; return oi ? (bid > 0 ? r4(1 - bid) : m.prices[1]) : (ask > 0 ? ask : m.prices[0]); }
function sellPx(m, oi){ const L = levels(m, oi, "bid"); if (L.length) return L[0][0]; const px = mPx(m), bid = px.bid ?? m.bid, ask = px.ask ?? m.ask; return oi ? (ask > 0 ? r4(1 - ask) : m.prices[1]) : (bid > 0 ? bid : m.prices[0]); }
function outPx(m, oi){ const c = chance(m); return oi ? r4(1 - c) : c; }
function sideLv(B, side){ const src = side === "ask" ? B.a : B.b, out = []; src.forEach((s, p) => { if (s > 0) out.push([p, s]); }); return out.sort((x, y) => side === "ask" ? x[0] - y[0] : y[0] - x[0]); }
/* ask = ascending (best first), bid = descending; No-side derived from the Yes book when its own book is missing */
function levels(m, oi, side){
  const B = BOOK[m.tokens[oi]]; if (B){ const L = sideLv(B, side); if (L.length) return L; }
  const O = BOOK[m.tokens[1 - oi]]; if (O){ const L = sideLv(O, side === "ask" ? "bid" : "ask"); if (L.length) return L.map(([p, s]) => [r4(1 - p), s]); }
  return [];
}
function setBest(tk){ const B = BOOK[tk]; if (!B) return; const a = sideLv(B, "ask"), b = sideLv(B, "bid"), px = PX[tk] || (PX[tk] = {}); if (a.length) px.ask = a[0][0]; if (b.length) px.bid = b[0][0]; px.t = now(); }
function snap(tk, bids, asks){
  const B = BOOK[tk] = {b: new Map(), a: new Map(), t: now()};
  (bids || []).forEach(l => B.b.set(+l.price, +l.size)); (asks || []).forEach(l => B.a.set(+l.price, +l.size)); setBest(tk);
}
function notifyPx(tk){ pxListeners.forEach(f => { try { f(tk); } catch (e) { console.error(e); } }); checkOrders(tk); }
function handleWS(x){
  if (!x || typeof x !== "object") return;
  if (x.asset_id && Array.isArray(x.bids) && Array.isArray(x.asks)){ snap(x.asset_id, x.bids, x.asks); notifyPx(x.asset_id); return; }
  const ch = x.price_changes || (x.changes && x.asset_id ? x.changes.map(c => Object.assign({asset_id: x.asset_id}, c)) : null);
  if (ch){ const seen = new Set();
    ch.forEach(c => { const tk = c.asset_id, B = BOOK[tk];
      if (B){ const side = String(c.side).toUpperCase() === "BUY" ? B.b : B.a, p = +c.price, s = +c.size; if (s > 0) side.set(p, s); else side.delete(p); }
      const px = PX[tk] || (PX[tk] = {}); if (c.best_bid != null && +c.best_bid > 0) px.bid = +c.best_bid; if (c.best_ask != null && +c.best_ask > 0) px.ask = +c.best_ask;
      if (B && c.best_bid == null) setBest(tk); px.t = now(); seen.add(tk); });
    seen.forEach(notifyPx); return; }
  if (x.event_type === "last_trade_price" && x.asset_id){
    const px = PX[x.asset_id] || (PX[x.asset_id] = {}); px.last = +x.price;
    const tr = {p: +x.price, s: +x.size || 0, side: x.side, t: +x.timestamp > 1e12 ? +x.timestamp : now(), tk: x.asset_id};
    (TRADES[x.asset_id] ||= []).unshift(tr); if (TRADES[x.asset_id].length > 60) TRADES[x.asset_id].length = 60;
    tradeListeners.forEach(f => { try { f(tr); } catch {} }); notifyPx(x.asset_id);
  }
}
/* one socket per screen; returns close() */
let WSN = 0;   // open market sockets (drives the "Live" dot)
function openWS(assets){
  assets = [...new Set(assets.filter(Boolean))].slice(0, 120);
  let ws = null, alive = true, ping = 0, tries = 0, rt = 0, on = false;
  const mark = v => { if (v === on) return; on = v; WSN += v ? 1 : -1; };
  const connect = () => {
    if (!alive || !assets.length || typeof WebSocket === "undefined") return;
    try { ws = new WebSocket(WSS); } catch { return; }
    ws.onopen = () => { tries = 0; mark(true); try { ws.send(JSON.stringify({assets_ids: assets, type: "market"})); } catch {} clearInterval(ping); ping = setInterval(() => { try { ws.readyState === 1 && ws.send("PING"); } catch {} }, 10000); };
    ws.onmessage = e => { if (typeof e.data !== "string" || e.data[0] !== "{" && e.data[0] !== "[") return; let d; try { d = JSON.parse(e.data); } catch { return; } (Array.isArray(d) ? d : [d]).forEach(handleWS); };
    ws.onclose = () => { mark(false); clearInterval(ping); if (alive){ clearTimeout(rt); rt = setTimeout(connect, Math.min(20000, 1000 * 2 ** tries++)); } };
    ws.onerror = () => { try { ws.close(); } catch {} };
  };
  connect();
  return () => { alive = false; mark(false); clearInterval(ping); clearTimeout(rt); try { ws && ws.close(); } catch {} };
}

/* ---------- REST ---------- */
async function getJ(url, opt = {}, ms = 10000){
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, Object.assign({signal: ac.signal}, opt)); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function loadBooks(tokens){
  tokens = [...new Set(tokens.filter(Boolean))]; if (!tokens.length) return;
  for (let i = 0; i < tokens.length; i += 40){
    const part = tokens.slice(i, i + 40);
    try {
      const r = await getJ(CLOB + "/books", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(part.map(t => ({token_id: t})))}, 8000);
      (Array.isArray(r) ? r : []).forEach(b => { if (b && b.asset_id){ snap(b.asset_id, b.bids, b.asks); } });
    } catch {
      await Promise.all(part.map(t => getJ(`${CLOB}/book?token_id=${t}`, {}, 8000).then(b => snap(t, b.bids, b.asks)).catch(() => {})));
    }
    part.forEach(notifyPx);
  }
}
const CATS = [["hot","Hot",""],["live","Live",""],["end1h","Ending in 1h",""],["end24h","Ending in 24h",""],["new","New",""],["politics","Politics","politics"],["sports","Sports","sports"],["crypto","Crypto","crypto"],["economy","Economy","economy"],["tech","Tech","tech"],["culture","Culture","pop-culture"],["geopolitics","World","geopolitics"],["finance","Finance","finance"]];
const SORTS = [["vol","Volume"],["liq","Liquidity"],["end","Ending soon"],["new","Newest"],["trend","Trending"]];
const WINS = [[0,"Any time"],[1,"Within 1 hour"],[24,"Within 24 hours"],[168,"Within 7 days"],[720,"Within 30 days"]];
const DEFF = {sort: "trend", status: "open", win: 0};
const isoT = ms => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
function listUrl(cat, offset, f = DEFF){
  const c = CATS.find(x => x[0] === cat) || CATS[0]; let sort = f.sort, win = f.win;
  if (cat === "end1h"){ win = 1; sort = "end"; } else if (cat === "end24h"){ win = 24; sort = "end"; } else if (cat === "new") sort = "new";
  const order = {vol: "volume", liq: "liquidity", end: "endDate", new: "startDate", trend: "volume24hr"}[sort] || "volume24hr", asc = sort === "end";
  const resolved = f.status === "resolved";
  let u = `${GAMMA}/events?limit=${PAGE}&offset=${offset}&` + (resolved ? "closed=true" : "active=true&closed=false&archived=false") + `&order=${order}&ascending=${asc}&exclude_tag_id=102127`;
  if (!resolved){ u += "&end_date_min=" + encodeURIComponent(isoT(now())); if (win) u += "&end_date_max=" + encodeURIComponent(isoT(now() + win * 3600e3)); }
  return u + (c[2] ? "&tag_slug=" + c[2] : "");
}
async function fetchEvent(key){
  key = String(key);
  let arr = /^\d+$/.test(key) ? [await getJ(`${GAMMA}/events/${key}`).catch(() => null)].filter(Boolean) : await getJ(`${GAMMA}/events?slug=${encodeURIComponent(key)}`);
  if (!arr.length){   // maybe a market slug
    const ms = await getJ(`${GAMMA}/markets?slug=${encodeURIComponent(key)}`).catch(() => []);
    const es = ms[0] && ms[0].events && ms[0].events[0]; if (es) arr = await getJ(`${GAMMA}/events?slug=${encodeURIComponent(es.slug)}`);
  }
  if (!arr.length) throw new Error("Market not found");
  const e = normE(arr[0]); e.full = true; EV.set(e.slug, e); EV.set(e.id, e); if (key !== e.slug) EV.set(key, e); return e;
}
const cache = {
  get(k){ try { return (JSON.parse(localStorage.getItem(CKEY) || "{}") || {})[k] || null; } catch { return null; } },
  set(k, v){ try { const all = JSON.parse(localStorage.getItem(CKEY) || "{}") || {}; all[k] = {t: now(), v}; const keys = Object.keys(all).sort((a, b) => all[b].t - all[a].t); keys.slice(8).forEach(x => delete all[x]); localStorage.setItem(CKEY, JSON.stringify(all)); } catch {} }
};

/* ---------- order matching (walk the book) ---------- */
function walkBuy(L, usdAmt, fb){
  let left = usdAmt, sh = 0, worst = 0;
  for (const [p, s] of L || []){ if (left <= 1e-9) break; if (!(p > 0 && p < 1)) continue; const take = Math.min(s, left / p); sh += take; left -= take * p; worst = p; }
  if (left > 1e-9){ const p = Math.min(.999, worst || fb || .5); sh += left / p; worst = p; }
  return {shares: sh, avg: sh ? usdAmt / sh : 0, worst};
}
function walkSell(L, shares, fb){
  let left = shares, got = 0, worst = 0;
  for (const [p, s] of L || []){ if (left <= 1e-9) break; if (!(p > 0)) continue; const take = Math.min(s, left); got += take * p; left -= take; worst = p; }
  if (left > 1e-9){ const p = Math.max(.001, worst || fb || .5); got += left * p; worst = p; }
  return {proceeds: got, avg: shares ? got / shares : 0, worst};
}
function addPos(r, shares, cost){
  const d = data(); let p = d.positions.find(x => x.token === r.token);
  if (!p){ p = Object.assign(meta(r), {id: r.token, shares: 0, locked: 0, cost: 0, avg: 0, t: now()}); d.positions.unshift(p); }
  p.shares = r4(p.shares + shares); p.cost = r4(p.cost + cost); p.avg = p.shares ? p.cost / p.shares : 0; p.last = p.avg; return p;
}
function reducePos(p, shares){
  const d = data(), basis = p.avg * shares;
  p.shares = r4(p.shares - shares); p.cost = r4(Math.max(0, p.cost - basis));
  if (p.shares < .005){ d.positions = d.positions.filter(x => x !== p); }
  return basis;
}

/* ---------- API handlers (local implementation of the backend contract) ---------- */
function reg(name, fn){ if (window.API) API.register(name, fn); }
async function order(r){
  const c = cfg(), d = data(), fee = c.feePct / 100;
  if (!c.enabled) throw new Error("Prediction market is under maintenance");
  if (r.side === "buy"){
    if (r.type === "market"){
      const amt = r2(+r.amount); if (!(amt >= 1)) throw new Error("Minimum order is $1");
      if (amt > c.maxBet) throw new Error(`Max per order is $${fmt(c.maxBet, 0)}`);
      if (amt > bal() + 1e-9) throw new Error("Insufficient balance");
      const f = r2(amt * fee), w = walkBuy(r.levels, amt - f, r.price);
      await debit(amt, "predict");
      const pos = addPos(r, w.shares, amt);
      hist(Object.assign(meta(r), {kind: "buy", shares: w.shares, price: w.avg, amount: amt, fee: f}));
      d.vol = r2((d.vol || 0) + amt); save(); emit();
      return {fill: {shares: w.shares, avg: w.avg, amount: amt, fee: f}, position: pos, balance: bal()};
    }
    const p = r4(+r.price), sh = r2(+r.shares);
    if (!(p >= .001 && p <= .999)) throw new Error("Limit price must be between 0.1¢ and 99.9¢");
    if (!(sh >= 1)) throw new Error("Order too small: increase the amount");
    const total = r2(p * sh * (1 + fee)); if (total < 1) throw new Error("Minimum order is $1");
    if (total > c.maxBet) throw new Error(`Max per order is $${fmt(c.maxBet, 0)}`);
    if (total > bal() + 1e-9) throw new Error("Insufficient balance");
    await debit(total, "predict");
    const o = Object.assign(meta(r), {id: U.uid(), side: "buy", price: p, shares: sh, reserved: total, t: now()});
    const ask = r.levels && r.levels[0] ? r.levels[0][0] : null;
    if (ask != null && ask <= p + 1e-9){   // marketable limit → fills now at the better price
      const cost = r2(ask * sh * (1 + fee)), pos = addPos(r, sh, cost), refund = r2(total - cost);
      if (refund > 0) await credit(refund, "predict");
      hist(Object.assign(meta(r), {kind: "buy", shares: sh, price: ask, amount: cost, fee: r2(ask * sh * fee)}));
      d.vol = r2((d.vol || 0) + cost); save(); emit();
      return {fill: {shares: sh, avg: ask, amount: cost, fee: r2(ask * sh * fee)}, position: pos, balance: bal()};
    }
    d.orders.unshift(o); hist(Object.assign(meta(r), {kind: "limit", side: "buy", shares: sh, price: p, amount: total})); save(); emit();
    return {order: o, balance: bal()};
  }
  /* sell */
  const pos = d.positions.find(x => x.token === r.token); if (!pos) throw new Error("You have no shares to sell");
  const free = r4(pos.shares - (pos.locked || 0)); let sh = r4(Math.min(+r.shares || 0, free));
  if (free - sh < .01) sh = free;   // never leave dust shares behind
  if (!(sh > 0)) throw new Error(free > 0 ? "Enter shares to sell" : "Shares are locked in open sell orders");
  if (r.type === "market"){
    const w = walkSell(r.levels, sh, r.price), gross = r2(w.proceeds), f = r2(gross * fee), net = r2(gross - f);
    const basis = reducePos(pos, sh), pnl = r2(net - basis);
    await credit(net, "predict"); realize(pnl);
    hist(Object.assign(meta(Object.assign({}, pos, r)), {kind: "sell", shares: sh, price: w.avg, amount: net, fee: f, pnl}));
    d.vol = r2((d.vol || 0) + gross); save(); emit();
    return {fill: {shares: sh, avg: w.avg, amount: net, fee: f, pnl}, position: d.positions.includes(pos) ? pos : null, balance: bal()};
  }
  const p = r4(+r.price); if (!(p >= .001 && p <= .999)) throw new Error("Limit price must be between 0.1¢ and 99.9¢");
  const bid = r.levels && r.levels[0] ? r.levels[0][0] : null;
  if (bid != null && bid >= p - 1e-9) return order(Object.assign({}, r, {type: "market", shares: sh, levels: [[bid, sh]]}));
  pos.locked = r4((pos.locked || 0) + sh);
  const o = Object.assign(meta(Object.assign({}, pos, r)), {id: U.uid(), side: "sell", price: p, shares: sh, reserved: 0, t: now()});
  d.orders.unshift(o); hist(Object.assign(meta(Object.assign({}, pos, r)), {kind: "limit", side: "sell", shares: sh, price: p, amount: r2(p * sh)})); save(); emit();
  return {order: o, balance: bal()};
}
reg("predict.order", order);
reg("predict.sell", r => { const pos = data().positions.find(x => x.token === r.token); if (!pos) throw new Error("No position"); return order(Object.assign(meta(pos), {side: "sell", type: "market", shares: r.shares, levels: r.levels, price: r.price})); });
reg("predict.fill", async ({id, price}) => {
  const d = data(), o = d.orders.find(x => x.id === id); if (!o) throw new Error("Order not found");
  const fee = cfg().feePct / 100; d.orders = d.orders.filter(x => x !== o);
  if (o.side === "buy"){
    addPos(o, o.shares, o.reserved); d.vol = r2((d.vol || 0) + o.reserved);
    hist(Object.assign(meta(o), {kind: "fill", side: "buy", shares: o.shares, price: o.price, amount: o.reserved}));
  } else {
    const pos = d.positions.find(x => x.token === o.token);
    const sh = pos ? Math.min(o.shares, pos.shares) : 0, gross = r2(o.price * sh), net = r2(gross * (1 - fee));
    let pnl = 0; if (pos){ pos.locked = r4(Math.max(0, (pos.locked || 0) - o.shares)); pnl = r2(net - reducePos(pos, sh)); }
    await credit(net, "predict"); realize(pnl); d.vol = r2((d.vol || 0) + gross);
    hist(Object.assign(meta(o), {kind: "fill", side: "sell", shares: sh, price: o.price, amount: net, pnl}));
  }
  save(); emit(); return {fill: {shares: o.shares, price: o.price, side: o.side}, balance: bal()};
});
reg("predict.cancel", async ({id}) => {
  const d = data(), o = d.orders.find(x => x.id === id); if (!o) throw new Error("Order not found");
  d.orders = d.orders.filter(x => x !== o); let refund = 0;
  if (o.side === "buy"){ refund = o.reserved; await credit(refund, "predict"); }
  else { const pos = d.positions.find(x => x.token === o.token); if (pos) pos.locked = r4(Math.max(0, (pos.locked || 0) - o.shares)); }
  hist(Object.assign(meta(o), {kind: "cancel", side: o.side, shares: o.shares, price: o.price, amount: refund})); save(); emit();
  return {ok: true, refund, balance: bal()};
});
reg("predict.settle", async ({mid, prices}) => {
  const d = data(); let payout = 0, n = 0;
  for (const o of d.orders.filter(x => x.mid === String(mid))){ d.orders = d.orders.filter(x => x !== o); if (o.side === "buy"){ await credit(o.reserved, "predict"); } }
  for (const p of d.positions.filter(x => x.mid === String(mid))){
    const won = +prices[p.oi] || 0, pay = r2(p.shares * won), pnl = r2(pay - p.cost);
    d.positions = d.positions.filter(x => x !== p); if (pay > 0) await credit(pay, "predict"); realize(pnl); payout += pay; n++;
    hist(Object.assign(meta(p), {kind: pay > 0 ? "won" : "lost", shares: p.shares, price: won, amount: pay, pnl}));
  }
  save(); emit(); return {payout, settled: n, balance: bal()};
});
reg("predict.portfolio", () => { const d = data(); return {positions: d.positions, orders: d.orders, history: d.history, perps: [], balance: bal()}; });

/* ---------- legacy perps (feature removed in v6.8): refund margin + unrealized PnL once, then drop them ---------- */
async function refundPerps(tries = 0){
  const d = data(); if (!d.perps.length) return;
  const markOf = sym => { const p = window.M && M.get(sym); return p && p.price > 0 ? p.price : null; };
  if (tries < 6 && d.perps.some(x => markOf(x.sym) == null)) return void setTimeout(() => refundPerps(tries + 1), 5000);   // wait for live prices (max ~30s)
  const list = d.perps.slice(); d.perps = []; let total = 0;
  for (const x of list){
    const m = markOf(x.sym), pnl = m ? (x.side === "long" ? 1 : -1) * (m - x.entry) * (x.qty || 0) - (x.fund || 0) : 0, pay = r2(Math.max(0, (+x.margin || 0) + pnl));
    total += pay; realize(r2(pay - (+x.margin || 0)));
    hist({kind: "refund", q: `${x.name || x.sym} perp (closed)`, title: "Margin + PnL returned", outcome: x.side, shares: x.qty || 0, price: m || x.entry || 0, amount: pay, pnl: r2(pay - (+x.margin || 0))});
  }
  saveNow();
  try { if (total > 0) await credit(total, "predict-perp-refund"); } catch {}
  emit(); if (total > 0) toast(`Perps closed: ${usd(total)} returned to your Prediction wallet`, "info", 3600);
}
setTimeout(() => { try { refundPerps(); } catch {} }, 4000);

/* ---------- background engine: limit fills, settlement ---------- */
const busy = new Set();
function checkOrders(tk){
  const d = D; if (!d || !d.orders.length) return;
  d.orders.forEach(o => {
    if (busy.has(o.id) || (tk && o.token !== tk && !(o.tokens || []).includes(tk))) return;
    const m = {tokens: o.tokens || [o.token], prices: [.5,.5]};
    if (!o.tokens || o.tokens.length < 2) return;
    const L = levels(m, o.oi, o.side === "buy" ? "ask" : "bid"); if (!L.length) return;
    const best = L[0][0], hit = o.side === "buy" ? best <= o.price + 1e-9 : best >= o.price - 1e-9;
    if (!hit) return;
    busy.add(o.id);
    API.call("predict.fill", {id: o.id, price: o.price}).then(() => {
      U.fx("open"); toast(`Limit order filled: ${o.side === "buy" ? "Bought" : "Sold"} ${shr(o.shares)} ${o.outcome} at ${cents(o.price)}`, "ok", 3200);
      notif("Limit order filled", `${o.side === "buy" ? "Bought" : "Sold"} ${shr(o.shares)} ${o.outcome} at ${cents(o.price)} · ${o.q}`, "ok");
    }).catch(() => {}).finally(() => busy.delete(o.id));
  });
}
let settling = false;
async function checkSettle(){
  const d = data(); if (settling) return; const mids = [...new Set(d.positions.map(p => p.mid).concat(d.orders.map(o => o.mid)))].filter(Boolean);
  if (!mids.length) return; settling = true;
  try {
    for (let i = 0; i < mids.length; i += 20){
      const ms = await getJ(`${GAMMA}/markets?closed=true&limit=20&` + mids.slice(i, i + 20).map(id => "id=" + id).join("&")).catch(() => []);
      for (const raw of ms || []){
        const m = normM(raw); if (!m.closed) continue;
        const pr = m.prices; if (!(pr.some(v => v >= .99) || pr.every(v => v === .5))) continue;   // resolved (1/0) or 50/50
        const before = d.positions.filter(p => p.mid === m.id);
        const r = await API.call("predict.settle", {mid: m.id, prices: pr});
        if (r.settled){
          const won = r.payout > 0; U.fx(won ? "win" : "loss"); if (won && U.confetti) U.confetti();
          toast(`Market resolved: ${String(before[0] ? before[0].q : m.q).slice(0, 60)} · ${won ? "You won " + usd(r.payout) : "Position expired at $0"}`, won ? "ok" : "info", 4200);
          notif(won ? "Prediction won" : "Prediction lost", `${before[0] ? before[0].q : m.q} · ${won ? "You won " + usd(r.payout) : "Position expired at $0"}`, won ? "ok" : "bad");
        }
      }
    }
  } finally { settling = false; }
}
let bgN = 0;
function bgLoop(){
  if (document.hidden) return; const d = data(); bgN++;
  if (d.orders.length && !curScreen) loadBooks(d.orders.flatMap(o => o.tokens || [o.token])).catch(() => {});
  if ((d.positions.length || d.orders.length) && bgN % 4 === 1) checkSettle().catch(() => {});
}
setTimeout(() => { try { bgLoop(); } catch {} setInterval(() => { try { bgLoop(); } catch {} }, 30000); }, 7000);

/* ---------- admin contract ---------- */
function posValue(p){ const px = p.tokens && p.tokens.length === 2 ? outPxTok(p) : null; return p.shares * (px ?? p.last ?? p.avg); }
function outPxTok(p){
  const B = BOOK[p.token]; let bid = null, ask = null;
  if (B){ const b = sideLv(B, "bid"), a = sideLv(B, "ask"); if (b.length) bid = b[0][0]; if (a.length) ask = a[0][0]; }
  else { const o = PX[p.tokens[1 - p.oi]], s = PX[p.token]; if (s && s.bid != null){ bid = s.bid; ask = s.ask; } else if (o && o.bid != null){ bid = o.ask ? r4(1 - o.ask) : null; ask = o.bid ? r4(1 - o.bid) : null; } }
  let v = null; if (bid != null && ask != null && ask - bid <= .1 + 1e-9) v = (bid + ask) / 2; else if (PX[p.token] && PX[p.token].last) v = PX[p.token].last; else if (bid != null) v = bid;
  if (v != null) p.last = v; return v;
}
function stats(){
  const d = data(), pv = d.positions.reduce((a, p) => a + posValue(p), 0), cost = d.positions.reduce((a, p) => a + p.cost, 0);
  const wins = d.history.filter(h => h.pnl > 0).map(h => h.pnl);
  return {mode: modeLabel().toLowerCase(), balance: bal(), positions: d.positions.length, positionsValue: r2(pv), unrealized: r2(pv - cost), openOrders: d.orders.length,
    orderReserved: r2(d.orders.reduce((a, o) => a + (o.reserved || 0), 0)), perps: 0, perpEquity: 0, volume: r2(d.vol || 0), realized: r2(d.realized || 0),
    trades: d.history.filter(h => /^(buy|sell|fill)$/.test(h.kind)).length, marketsTraded: new Set(d.history.filter(h => h.mid).map(h => h.mid)).size,
    biggestWin: wins.length ? Math.max(...wins) : 0, won: d.history.filter(h => h.kind === "won").length, lost: d.history.filter(h => h.kind === "lost").length, enabled: cfg().enabled};
}
window.PRED = {data: () => JSON.parse(JSON.stringify(data())), stats, cfg, settle: checkSettle, _data: data, _internal: {PX, BOOK, EV, levels, loadBooks, handleWS}};
let curScreen = null;

/* =====================================================================================================
   Live crypto rounds — Polymarket's real "Bitcoin/Ethereum Up or Down" 5-minute and 15-minute markets
   Gamma slug: <btc|eth>-updown-<5|15>m-<round start unix seconds>; resolves by Chainlink; chart reference from Binance spot.
   ===================================================================================================== */
const RA = [{k: "btc", n: "BTC", sym: "BTCUSDT", name: "Bitcoin"}, {k: "eth", n: "ETH", sym: "ETHUSDT", name: "Ethereum"}], RIV = [5, 15];
const rStart = (iv, t = now()) => Math.floor(t / 1000 / (iv * 60)) * iv * 60;
function roundOf(ev){ const x = /^(btc|eth)-updown-(5|15)m-(\d+)$/.exec(ev && ev.slug || ""); if (!x) return null; const a = RA.find(r => r.k === x[1]), iv = +x[2], t0 = +x[3]; return {a, iv, t0, t1: t0 + iv * 60, sym: a.sym}; }
const rTitle = r => `${r.a.n} Up or Down · ${r.iv}m`;
const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); };
const clockET = sec => new Date(sec * 1000).toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit", timeZone: "America/New_York"});
const ROUNDS = {};
function loadRound(a, iv){
  const t0 = rStart(iv), key = a.k + iv, c = ROUNDS[key];
  if (c && c.t0 === t0) return c.p;
  const p = fetchEvent(`${a.k}-updown-${iv}m-${t0}`).then(e => { e.round = true; return e; });
  ROUNDS[key] = {t0, p}; p.catch(() => { if (ROUNDS[key] && ROUNDS[key].p === p) delete ROUNDS[key]; });
  return p;
}
const roundEnded = ev => { const r = roundOf(ev); return !!r && now() >= r.t1 * 1000; };
/* round start price: Binance 1-minute candle open at the round start (reference for the chart line) */
const SP = {};
async function startPrice(r){
  const k = r.sym + r.t0; if (SP[k] != null) return SP[k];
  const hosts = (window.CONFIG && CONFIG.BINANCE_REST) || ["https://data-api.binance.vision"];
  for (const h of hosts){
    try { const d = await getJ(`${h}/api/v3/klines?symbol=${r.sym}&interval=1m&startTime=${r.t0 * 1000}&limit=1`, {}, 6000); if (d && d[0] && +d[0][1] > 0 && Math.abs(d[0][0] - r.t0 * 1000) < 120e3){ SP[k] = +d[0][1]; return SP[k]; } } catch {}
  }
  return null;
}
const livePx = sym => { const q = window.M && M.get(sym); return q && q.price > 0 ? q.price : null; };
/* faster settlement polling for rounds that just ended */
setInterval(() => { try {
  if (document.hidden || !D) return;
  if (D.positions.concat(D.orders).some(x => { const r = roundOf({slug: x.slug}); return r && now() > r.t1 * 1000 + 20e3; })) checkSettle().catch(() => {});
} catch {} }, 8000);

/* =====================================================================================================
   Quick guide (4 steps) + data-source info popup
   ===================================================================================================== */
const TUT_KEY = "nt_pd_tut";
const tutOff = () => { try { return localStorage.getItem(TUT_KEY) === "1"; } catch { return false; } };
const G = (b) => `<svg viewBox="0 0 220 84" width="100%" height="84" role="img" aria-hidden="true" class="pd-tg">${b}</svg>`;
const TUT = [
  {k: "Transfer", t: "Move funds in", d: "Transfer USDT from Spot or Funding into your Prediction wallet. Your balance is available instantly.", cta: "Transfer now", a: "xf",
    g: G(`<rect x="12" y="20" width="72" height="44" rx="9" class="g-box"/><text x="48" y="40" text-anchor="middle" class="g-t">Spot</text><text x="48" y="55" text-anchor="middle" class="g-s">USDT</text><rect x="136" y="20" width="72" height="44" rx="9" class="g-box on"/><text x="172" y="40" text-anchor="middle" class="g-t">Prediction</text><text x="172" y="55" text-anchor="middle" class="g-s">wallet</text><path d="M92 42h36m-8-7 8 7-8 7" class="g-ar"/>`)},
  {k: "Trade", t: "Open a trade", d: "Pick a market, tap Yes or No, enter an amount and confirm. Price in cents = chance of that outcome; each share pays $1 if it wins.", cta: "Browse markets", a: "list",
    g: G(`<rect x="10" y="8" width="200" height="68" rx="10" class="g-box"/><text x="22" y="28" class="g-t">Will BTC close above 60K?</text><rect x="22" y="40" width="82" height="26" rx="7" class="g-yes"/><text x="63" y="57" text-anchor="middle" class="g-yt">Yes 42¢</text><rect x="116" y="40" width="82" height="26" rx="7" class="g-no"/><text x="157" y="57" text-anchor="middle" class="g-nt">No 60¢</text>`)},
  {k: "Position", t: "Watch your position", d: "Portfolio shows how much you invested, what it is worth right now and your profit or loss, updating live.", cta: "Open portfolio", a: "portfolio",
    g: G(`<rect x="10" y="8" width="200" height="68" rx="10" class="g-box"/><text x="24" y="30" class="g-s">Invested</text><text x="24" y="52" class="g-t big">$50.00</text><text x="116" y="30" class="g-s">Value now</text><text x="116" y="52" class="g-t big up">$62.40</text><path d="M24 66l24-8 22 4 26-12" class="g-ln"/>`)},
  {k: "Close", t: "Cash out or sell", d: "Cash out sells your whole position at the current price in one tap. Or sell part of it, or hold to the end: winning shares pay $1 each.", cta: "", a: "",
    g: G(`<rect x="14" y="18" width="86" height="48" rx="10" class="g-box"/><text x="57" y="39" text-anchor="middle" class="g-t">120 shares</text><text x="57" y="55" text-anchor="middle" class="g-s">Cash out</text><path d="M108 42h28m-8-7 8 7-8 7" class="g-ar"/><rect x="144" y="18" width="62" height="48" rx="10" class="g-box on"/><text x="175" y="47" text-anchor="middle" class="g-t big up">$62.40</text>`)}
];
function tutPop(i){
  const T = TUT[i];
  pdPop("Quick guide", "", (el, close) => {
    const b = el.querySelector(".pd-pop-b");
    const draw = n => { const x = TUT[n];
      b.innerHTML = `<div class="pd-tut-steps">${TUT.map((y, j) => `<button type="button" class="${j === n ? "on" : j < n ? "done" : ""}" data-ts="${j}" aria-label="Step ${j + 1}: ${esc(y.k)}">${j + 1}</button>`).join("<i></i>")}</div>
        <div class="pd-tut-g">${x.g}</div><h4>${n + 1}. ${esc(x.t)}</h4><p>${esc(x.d)}</p>
        <div class="pd-pop-btns">${n > 0 ? `<button type="button" class="pd-pb" data-pv>Back</button>` : ""}${x.cta ? `<button type="button" class="pd-pb" data-cta>${esc(x.cta)}</button>` : ""}<button type="button" class="pd-pb pri" data-nx>${n < TUT.length - 1 ? "Next" : "Done"}</button></div>`;
      b.querySelectorAll("[data-ts]").forEach(z => z.onclick = () => { hap(6); draw(+z.dataset.ts); });
      b.querySelector("[data-pv]") && (b.querySelector("[data-pv]").onclick = () => { hap(6); draw(n - 1); });
      b.querySelector("[data-nx]").onclick = () => { if (n < TUT.length - 1){ hap(6); draw(n + 1); } else close(); };
      const c = b.querySelector("[data-cta]"); if (c) c.onclick = () => { close(); hap(8); if (x.a === "xf") UI.transferSheet({to: W}); else location.hash = "#/predict" + (x.a === "portfolio" ? "/portfolio" : ""); };
    };
    draw(i);
  });
}
function tutHtml(){
  if (tutOff()) return "";
  return `<div class="pd-tut" id="pdTut"><span class="pd-tut-l" role="img" aria-label="Quick guide">${ic("zap", 15, 2.2)}</span><div class="pd-tut-s">${TUT.map((x, i) => `<button type="button" data-tut="${i}"><b>${i + 1}</b>${esc(x.k)}</button>`).join("")}</div><button type="button" class="pd-tut-x" data-tutx aria-label="Dismiss quick guide">${ic("close", 14)}</button></div>`;
}
function infoPop(){
  pdPop("Where the data comes from", `<div class="pd-flow" aria-hidden="true"><span><b>Polymarket</b><small>markets &amp; order books</small></span><i>&rarr;</i><span class="on"><b>NovaTrade</b><small>live feed</small></span><i>&rarr;</i><span><b>You</b><small>${WSN > 0 ? "live now" : "connecting"}</small></span></div>
    <ul class="pd-info">
      <li><b>Markets and volume</b> come from the Polymarket Gamma API.</li>
      <li><b>Prices</b> are live order-book midpoints (between the best bid and best ask) from the Polymarket CLOB. Order books load first, then every change is pushed over a WebSocket in real time.</li>
      <li><b>Your fills</b> walk the live order book: best asks first when you buy, best bids first when you sell.</li>
      <li><b>BTC and ETH Up or Down</b> rounds are Polymarket's real 5-minute and 15-minute markets. The chart uses Binance spot prices.</li>
      <li><b>Settlement</b> follows each market's Polymarket resolution source. Winning shares pay $1, losing shares $0, credited to your Prediction wallet automatically.</li>
    </ul>${tutOff() ? `<div class="pd-pop-btns"><button type="button" class="pd-pb" data-tutshow>Show quick guide again</button></div>` : ""}`, (el, close) => {
    const b = el.querySelector("[data-tutshow]"); if (b) b.onclick = () => { try { localStorage.removeItem(TUT_KEY); } catch {} close(); if (curScreen === "list") location.reload ? (location.hash = "#/predict", bus.emit("pd-tut")) : 0; };
  });
}

/* =====================================================================================================
   UI building blocks
   ===================================================================================================== */
const STRIP = `<div class="tabs pd-strip" style="gap:20px;margin:0 -16px;padding:4px 16px 0;border:0"><a class="tab" href="#/futures/BTCUSDT" style="font-size:17px">USDⓈ-M</a><a class="tab" href="#/spot/BTCUSDT" style="font-size:17px">Spot</a><a class="tab" href="#/trade/BTCUSDT" style="font-size:17px">Binary</a><button class="tab tab-hot on" style="font-size:17px">Prediction</button><a class="tab tab-hot" href="#/racer" style="font-size:17px">Money Game</a><a class="tab" href="#/options" style="font-size:17px">Options</a><a class="tab" href="#/copy" style="font-size:17px">Copy</a><a class="tab" href="#/bots" style="font-size:17px">Bots</a></div>`;
const SUB = [["", "Markets"], ["portfolio", "Portfolio"], ["profile", "Profile"]];
const subnav = on => `<nav class="pd-sub" aria-label="Prediction sections">${SUB.map(([k, l]) => `<a href="#/predict${k ? "/" + k : ""}" class="${on === k ? "on" : ""}" ${on === k ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
const balBar = () => `<div class="pd-bal"><div class="pd-bal-l"><span class="pd-bal-k">Prediction balance<span class="pd-lv" data-lv><i></i>Live</span></span><b class="num" data-pd-bal>${usd(bal())}</b></div>
  <button class="pd-mode ${isDemo() ? "demo" : "real"}" data-acct type="button" aria-label="Account: ${modeLabel()}. Tap to switch">${modeLabel()}${ic("chevd", 12, 2.4)}</button>
  <button class="pd-xf" data-pd-xf type="button" aria-label="Transfer to Prediction wallet">${ic("plus", 18, 2.4)}</button></div>`;
const backHead = (title, right = "") => `<header class="pd-head"><button class="pd-ib" data-back aria-label="Go back">${ic("back", 22)}</button><h1>${esc(title)}</h1>${right || '<span class="pd-ib"></span>'}</header>`;
function bindCommon(root, offs){
  /* v6.9: leaving Prediction (tab strip / bottom nav / back) asks first; moving between Prediction screens does not */
  if (window.App && App.guardNav){
    App.guardNav("Prediction"); const ask = window.NAV_GUARD;
    const g = (to, from) => /^#\/predict/.test(to || "") ? true : ask(to, from);
    window.NAV_GUARD = g; offs.push(() => { if (window.NAV_GUARD === g) window.NAV_GUARD = null; });
  }
  root.querySelectorAll("[data-acct]").forEach(b => b.onclick = e => { e.stopPropagation(); if (window.ACCT) ACCT.sheet(); else toast("Demo account", "info"); });
  root.addEventListener("click", e => { if (e.target.closest("[data-pd-xf]")){ hap(10); UI.transferSheet({to: W}); } });
  const upd = () => root.querySelectorAll("[data-pd-bal]").forEach(b => b.textContent = usd(bal()));
  offs.push(bus.on("balance", upd)); upd();
  const lv = () => root.querySelectorAll("[data-lv]").forEach(b => b.classList.toggle("off", WSN <= 0)); lv();
  const lvT = setInterval(lv, 2000); offs.push(() => clearInterval(lvT));
}
function seed(){
  const d = data(); if (d.seeded) return; d.seeded = true;
  if (isDemo() && bal() <= 0){
    const amt = Math.min(1000, Math.floor(store.wb("spot") * 100) / 100);
    if (amt > 0 && !store.transfer("spot", W, amt)) setTimeout(() => toast(`Prediction wallet funded: ${fmt(amt, 2)} USDT moved from Spot`, "ok", 3400), 500);
  }
  saveNow();
}
const maint = () => `<div class="pd-maint">${ic("gear", 40, 1.4)}<b>Prediction market is under maintenance</b><span>Trading is paused by the admin. Your positions and balance are safe. Please check back soon.</span><a class="btn btn-ghost" href="#/home">Back to Home</a></div>`;
const gcol = c => c >= .5 ? "var(--up)" : c >= .2 ? "var(--warn)" : "var(--down)";
const gauge = (c, mid) => `<div class="pd-gauge" data-g="${mid}"><svg viewBox="0 0 60 34" aria-hidden="true"><path d="M5 31A25 25 0 0 1 55 31" class="pd-g-bg"/><path d="M5 31A25 25 0 0 1 55 31" class="pd-g-fg" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${(100 - c * 100).toFixed(1)}" style="stroke:${gcol(c)}"/></svg><b class="num" data-ch="${mid}">${chancePct(c)}</b><small>chance</small></div>`;
function flash(el, up){ if (!el) return; el.classList.remove("pd-fu", "pd-fd"); void el.offsetWidth; el.classList.add(up ? "pd-fu" : "pd-fd"); }
function setTxt(el, txt){ if (!el || el.textContent === txt) return false; const old = parseFloat(el.textContent); el.textContent = txt; const nw = parseFloat(txt); if (!isNaN(old) && !isNaN(nw) && old !== nw) flash(el, nw > old); return true; }
const setTxt2 = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
const short = s => String(s || "").length > 14 ? String(s).slice(0, 13) + "…" : String(s || "");
const reqMeta = (ev, m, oi) => ({mid: m.id, eid: ev.id, slug: ev.slug, q: m.q || ev.title, title: ev.markets.length > 1 ? (m.gt || m.q) : "", img: m.img || ev.img, end: m.end || ev.end, outcome: m.outs[oi], oi, token: m.tokens[oi], tokens: m.tokens, outs: m.outs});
const findPos = tk => data().positions.find(p => p.token === tk);
const z0 = v => Math.abs(v) < .005 ? 0 : v;
const pctN = (v, cost) => { const x = cost ? v / cost * 100 : 0; return fmt(Math.abs(x) < .05 ? 0 : x, 1); };
/* invested vs current value, live */
function posGrid(p){
  const v = posValue(p), pnl = z0(v - p.cost), cur = p.shares ? v / p.shares : 0;
  return `<div class="pd-pg"><div><span>Invested</span><b class="num">${usd(p.cost)}</b></div><div><span>Current value</span><b class="num" data-pv>${usd(v)}</b></div><div><span>PnL</span><b class="num ${pnl >= 0 ? "up" : "down"}" data-pp>${usdS(pnl)}<small>${pctN(pnl, p.cost)}%</small></b></div><div><span>Now</span><b class="num" data-pc>${cents(cur)}</b></div></div>`;
}
function posGridTick(r, p){
  const v = posValue(p), pnl = z0(v - p.cost);
  setTxt(r.querySelector("[data-pv]"), usd(v)); setTxt(r.querySelector("[data-pc]"), cents(p.shares ? v / p.shares : 0));
  const e = r.querySelector("[data-pp]"); if (e){ e.innerHTML = `${usdS(pnl)}<small>${pctN(pnl, p.cost)}%</small>`; e.className = "num " + (pnl >= 0 ? "up" : "down"); }
}
const posBtns = p => `<button type="button" class="pd-cash" data-cash="${p.token}">Cashout</button><button type="button" class="pd-sell" data-sellp="${p.token}">Sell</button>`;

/* ---------- SVG line chart with touch crosshair ---------- */
const COLS = ["var(--brand)", "#F59E0B", "#20B26C", "#A855F7"];
function drawChart(box, series, o = {}){
  if (!box) return;
  const W0 = Math.max(240, box.clientWidth || 340), H = o.h || 190, pr = o.padR ?? 42, pt = 12, pb = 22;
  series = series.filter(s => s.pts && s.pts.length);
  const all = series.flatMap(s => s.pts);
  if (all.length < 2){ box.innerHTML = `<div class="pd-ch-empty" style="height:${H}px">${esc(o.empty || "No price history yet")}</div>`; box._pd = null; return; }
  const t0 = Math.min(...all.map(p => p[0])), t1 = Math.max(...all.map(p => p[0]));
  let v0 = Math.min(...all.map(p => p[1])), v1 = Math.max(...all.map(p => p[1]));
  if (o.pct){ const pad = Math.max(.02, (v1 - v0) * .18); v0 = Math.max(0, v0 - pad); v1 = Math.min(1, v1 + pad); }
  else { const pad = Math.max(Math.abs(v1) * .02, (v1 - v0) * .15, 1e-6); v0 -= pad; v1 += pad; if (o.zero){ v0 = Math.min(v0, 0); v1 = Math.max(v1, 0); } }
  const X = t => (t - t0) / (t1 - t0 || 1) * (W0 - pr), Y = v => pt + (v1 - v) / (v1 - v0 || 1) * (H - pt - pb);
  const fmtV = o.fmt || (v => Math.round(v * 100) + "%");
  let g = ""; for (let i = 0; i <= 3; i++){ const v = v0 + (v1 - v0) * i / 3, y = Y(v).toFixed(1); g += `<line x1="0" x2="${W0 - pr + 4}" y1="${y}" y2="${y}" class="pd-ch-g"/><text x="${W0 - 2}" y="${(+y + 4).toFixed(1)}" text-anchor="end" class="pd-ch-t">${esc(fmtV(v))}</text>`; }
  const span = (t1 - t0) / 1000, tf = t => { const d = new Date(t); return span < 600 ? d.toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit", second: "2-digit"}) : span < 2 * 86400 ? d.toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit"}) : span < 400 * 86400 ? d.toLocaleDateString("en-US", {month: "short", day: "numeric"}) : d.toLocaleDateString("en-US", {month: "short", year: "2-digit"}); };
  for (let i = 0; i < 3; i++){ const t = t0 + (t1 - t0) * (i * 2 + 1) / 6; g += `<text x="${X(t).toFixed(1)}" y="${H - 5}" text-anchor="middle" class="pd-ch-t">${esc(tf(t))}</text>`; }
  let paths = "", dots = "", defs = "";
  series.forEach((s, i) => {
    const col = s.color || COLS[i % COLS.length], d = s.pts.map((p, j) => (j ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join("");
    if (series.length === 1 && o.area !== false){ const id = "pdg" + U.uid(); defs += `<linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient>`;
      const l = s.pts[s.pts.length - 1]; paths += `<path d="${d}L${X(l[0]).toFixed(1)} ${H - pb}L${X(s.pts[0][0]).toFixed(1)} ${H - pb}Z" fill="url(#${id})"/>`; }
    paths += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const l = s.pts[s.pts.length - 1]; dots += `<circle cx="${X(l[0]).toFixed(1)}" cy="${Y(l[1]).toFixed(1)}" r="7" fill="${col}" class="pd-ch-pulse"/><circle cx="${X(l[0]).toFixed(1)}" cy="${Y(l[1]).toFixed(1)}" r="3.5" fill="${col}"/>`;
  });
  box.innerHTML = `<svg class="pd-ch-svg" viewBox="0 0 ${W0} ${H}" width="${W0}" height="${H}" role="img" aria-label="${esc(o.label || "Price chart")}"><defs>${defs}</defs>${g}${paths}${dots}<g class="pd-ch-x" style="display:none"><line y1="${pt}" y2="${H - pb}" class="pd-ch-xl"/></g></svg><div class="pd-ch-tip" style="display:none"></div>`;
  const svg = box.firstChild, xg = svg.querySelector(".pd-ch-x"), tip = box.querySelector(".pd-ch-tip");
  let lastIdx = -1, lastBuzz = 0;
  const near = (pts, t) => { let lo = 0, hi = pts.length - 1; while (hi - lo > 1){ const mid = (lo + hi) >> 1; if (pts[mid][0] < t) lo = mid; else hi = mid; } return Math.abs(pts[lo][0] - t) < Math.abs(pts[hi][0] - t) ? pts[lo] : pts[hi]; };
  const move = e => {
    const r = svg.getBoundingClientRect(), x = Math.max(0, Math.min(W0 - pr, (e.clientX - r.left) * W0 / r.width)), t = t0 + x / (W0 - pr) * (t1 - t0);
    const pts = series.map(s => near(s.pts, t)), xx = X(pts[0][0]);
    xg.style.display = ""; xg.querySelector("line").setAttribute("x1", xx); xg.querySelector("line").setAttribute("x2", xx);
    xg.querySelectorAll("circle").forEach(c => c.remove());
    pts.forEach((p, i) => { const c = document.createElementNS("http://www.w3.org/2000/svg", "circle"); c.setAttribute("cx", X(p[0])); c.setAttribute("cy", Y(p[1])); c.setAttribute("r", 4.5); c.setAttribute("fill", series[i].color || COLS[i % COLS.length]); c.setAttribute("class", "pd-ch-hd"); xg.appendChild(c); });
    tip.style.display = ""; tip.innerHTML = `<small>${esc(new Date(pts[0][0]).toLocaleString("en-US", {month: "short", day: "numeric", hour: "numeric", minute: "2-digit"}))}</small>` + pts.map((p, i) => `<span><i style="background:${series[i].color || COLS[i % COLS.length]}"></i>${series.length > 1 ? esc(short(series[i].name)) + " " : ""}<b class="num">${esc(fmtV(p[1]))}</b></span>`).join("");
    const px = xx / W0 * r.width; tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, px - tip.offsetWidth / 2)) + "px";
    const idx = Math.round(x); if (Math.abs(idx - lastIdx) > 6 && now() - lastBuzz > 45){ lastIdx = idx; lastBuzz = now(); hap(4); }
  };
  const leave = () => { xg.style.display = "none"; tip.style.display = "none"; };
  svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move); svg.addEventListener("pointerleave", leave); svg.addEventListener("pointercancel", leave);
  box._pd = {series, o};
}

/* ---------- Trade panel (detail page + quick sheet) — v6.9: cards, $ or shares, % chips, confirmation ---------- */
function walkBuySh(L, shares, fb){
  let left = shares, cost = 0, worst = 0;
  for (const [p, s] of L || []){ if (left <= 1e-9) break; if (!(p > 0 && p < 1)) continue; const take = Math.min(s, left); cost += take * p; left -= take; worst = p; }
  if (left > 1e-9){ const p = Math.min(.999, worst || fb || .5); cost += left * p; }
  return {cost, avg: shares ? cost / shares : 0};
}
function sharesForProceeds(L, target, fb, cap){
  let left = target, sh = 0;
  for (const [p, s] of L || []){ if (left <= 1e-9 || sh >= cap) break; if (!(p > 0)) continue; const take = Math.min(s, left / p, cap - sh); sh += take; left -= take * p; }
  if (left > 1e-9 && sh < cap) sh = Math.min(cap, sh + left / Math.max(.001, fb || .5));
  return sh;
}
const fl2 = v => Math.floor((v + 1e-9) * 100) / 100;
function tradePanel(host, st, opts = {}){
  const uid = "t" + U.uid().slice(0, 6); let busyGo = false;
  if (!st.unit) st.unit = "usd";
  const P = {st, render, tick, host};
  const q = s => host.querySelector(s);
  const px = i => st.side === "buy" ? buyPx(st.m, i) : sellPx(st.m, i);
  const posNow = () => findPos(st.m.tokens[st.oi]);
  const freeSh = () => { const p = posNow(); return p ? r4(p.shares - (p.locked || 0)) : 0; };
  const feeR = () => cfg().feePct / 100;
  /* what the user typed → {sh, usd, avg}; usd = total cost (buy) or net proceeds (sell) */
  function quote(){
    const {m, oi, side, type, unit} = st, f = feeR(), a = +st.amt || 0, s0 = +st.sh || 0;
    if (type === "limit"){
      const p = (+st.lp || 0) / 100; if (!(p > 0)) return {sh: 0, usd: 0, avg: 0};
      if (side === "buy"){ const sh = unit === "sh" ? s0 : fl2(a / (p * (1 + f))); return {sh, usd: p * sh * (1 + f), avg: p}; }
      const sh = Math.min(st.exact || (unit === "sh" ? s0 : fl2(a / (p * (1 - f)))), freeSh()); return {sh, usd: p * sh * (1 - f), avg: p};
    }
    if (side === "buy"){
      const L = levels(m, oi, "ask"), fb = buyPx(m, oi);
      if (unit === "usd"){ const w = walkBuy(L, a * (1 - f), fb); return {sh: a ? w.shares : 0, usd: a, avg: a ? w.avg : fb}; }
      const w = walkBuySh(L, s0, fb); return {sh: s0, usd: s0 ? w.cost / (1 - f) : 0, avg: s0 ? w.avg : fb};
    }
    const L = levels(m, oi, "bid"), fb = sellPx(m, oi), free = freeSh();
    let sh = st.exact ? Math.min(st.exact, free) : unit === "sh" ? Math.min(s0, free) : Math.min(sharesForProceeds(L, a / (1 - f), fb, free), free);
    if (free - sh < .01) sh = free && sh > 0 ? free : sh;
    const w = walkSell(L, sh, fb); return {sh, usd: sh ? w.proceeds * (1 - f) : 0, avg: sh ? w.avg : fb};
  }
  function render(){
    const {ev, m, oi, side, type, unit} = st, multi = ev.markets.length > 1, closed = m.closed || !m.accepting || roundEnded(ev);
    const pos = posNow();
    if (st.lp == null) st.lp = Math.round(Math.min(99, Math.max(1, outPx(m, oi) * 100)));
    const inp = unit === "sh"
      ? `<div class="pd-amt big"><input id="${uid}a" data-ssh ${type === "limit" ? "data-lsh " : ""}inputmode="decimal" size="1" placeholder="0" value="${esc(cin(st.sh))}" autocomplete="off" aria-label="Shares"></div>`
      : `<div class="pd-amt big"><span>$</span><input id="${uid}a" data-amt inputmode="decimal" size="1" placeholder="0" value="${esc(cin(st.amt))}" autocomplete="off" aria-label="Amount in dollars"></div>`;
    const addRow = (unit === "sh" ? [10, 50, 100] : [1, 10, 100]).map(n => `<button type="button" data-add="${n}">+${unit === "sh" ? "" : "$"}${n}</button>`).join("");
    const pctRow = [10, 25, 50, 75].map(n => `<button type="button" data-pct="${n / 100}">${n}%</button>`).join("") + `<button type="button" data-pct="1">Max</button>`;
    const lpf = type === "limit" ? `<div class="pd-field"><label for="${uid}p">Limit price</label><div class="pd-step"><button type="button" data-lp="-1" aria-label="Lower price">${ic("minus", 16, 2.4)}</button><div class="pd-amt pd-cents"><input id="${uid}p" data-lpv inputmode="decimal" size="1" value="${esc(String(st.lp))}" autocomplete="off" aria-label="Limit price in cents"><span>¢</span></div><button type="button" data-lp="1" aria-label="Raise price">${ic("plus", 16, 2.4)}</button></div></div>` : "";
    const entry = `${lpf}<div class="pd-field"><div class="pd-fl"><label for="${uid}a">${unit === "sh" ? "Shares" : "Amount"}</label><button type="button" class="pd-unit" data-unit aria-label="Switch between amount and shares">${ic("swap", 16, 2)}</button></div>${inp}</div>
      <div class="pd-chips">${addRow}</div><div class="pd-chips pct">${pctRow}</div>`;
    const own = pos ? `<div class="pd-own">In position: invested <b class="num">${usd(pos.cost)}</b> · value <b class="num">${usd(posValue(pos))}</b></div>` : side === "sell" ? `<div class="pd-own muted">You have no ${esc(m.outs[oi])} position in this market.</div>` : "";
    host.innerHTML = `${opts.showQ ? `<div class="pd-tp-q">${img(m.img || ev.img, "pd-img sm")}<div><b>${esc(multi ? (m.gt || m.q) : ev.title)}</b>${multi ? `<small>${esc(ev.title)}</small>` : ""}</div></div>` : ""}
      <div class="pd-c"><div class="pd-tp-top"><div class="pd-bs" role="tablist" aria-label="Buy or sell"><button type="button" role="tab" data-side="buy" class="${side === "buy" ? "on" : ""}" aria-selected="${side === "buy"}">Buy</button><button type="button" role="tab" data-side="sell" class="${side === "sell" ? "on" : ""}" aria-selected="${side === "sell"}">Sell</button></div>
        <div class="pd-ty" role="tablist" aria-label="Order type"><button type="button" data-type="market" class="${type === "market" ? "on" : ""}">Market</button><button type="button" data-type="limit" class="${type === "limit" ? "on" : ""}">Limit</button></div></div>
        <div class="pd-oc">${[0, 1].map(i => `<button type="button" class="pd-ocb ${i ? "no" : "yes"} ${oi === i ? "on" : ""}" data-oi="${i}" aria-pressed="${oi === i}"><span>${esc(short(m.outs[i]))}</span><b class="num" data-tpx="${i}">${cents(px(i))}</b></button>`).join("")}</div>${own}</div>
      ${closed ? `<div class="pd-c"><div class="pd-closed">${ic("lock", 16)}<span>${roundEnded(ev) && !m.closed ? "Round ended · result pending" : m.closed ? "This market is closed" + (m.prices.some(v => v >= .99) ? ` · resolved <b>${esc(m.outs[m.prices[0] >= .99 ? 0 : 1])}</b>` : " · awaiting resolution") : "Trading is paused for this market"}</span></div></div>` : `<div class="pd-c pd-c-in">${entry}</div>`}
      <div class="pd-c pd-c-sum" data-sumc><div class="pd-sum" data-sum></div></div>
      <button type="button" class="pd-go ${side === "sell" ? "sell" : oi ? "no" : "yes"}" data-go ${closed ? "disabled" : ""}>${goLabel()}</button>
      <div class="pd-tp-bal"><span>Balance <b class="num" data-pd-bal>${usd(bal())}</b> · <span class="pd-modetag">${modeLabel()}</span></span><button type="button" data-pd-xf2>${ic("plus", 14, 2.4)}Add funds</button></div>`;
    bind(); calc();
  }
  function goLabel(){ const {m, oi, side, type} = st; return type === "limit" ? `${side === "buy" ? "Buy" : "Sell"} ${esc(short(m.outs[oi]))} · Limit` : `${side === "buy" ? "Buy" : "Sell"} ${esc(short(m.outs[oi]))}`; }
  const setVal = (key, v, inputSel) => { st[key] = v; const el = q(inputSel); if (el) el.value = cin(v); };
  /* write a USD budget into whichever unit is active (buy) */
  function setBudget(v){
    v = fl2(Math.max(0, v)); st.exact = null;
    if (st.unit === "usd"){ setVal("amt", v ? String(v) : "", "[data-amt]"); return; }
    const m = st.m, oi = st.oi, f = feeR(), lim = st.type === "limit", p = (+st.lp || 0) / 100;
    const sh = lim ? (p > 0 ? fl2(v / (p * (1 + f))) : 0) : fl2(walkBuy(levels(m, oi, "ask"), v * (1 - f), buyPx(m, oi)).shares);
    setVal("sh", sh ? String(sh) : "", "[data-ssh]");
  }
  function bind(){
    host.querySelectorAll("[data-side]").forEach(b => b.onclick = () => { if (st.side === b.dataset.side) return; st.side = b.dataset.side; st.exact = null; st.amt = ""; st.sh = ""; hap(8); render(); });
    host.querySelectorAll("[data-type]").forEach(b => b.onclick = () => { if (st.type === b.dataset.type) return; st.type = b.dataset.type; st.lp = null; st.exact = null; hap(8); render(); });
    host.querySelectorAll("[data-oi]").forEach(b => b.onclick = () => { const i = +b.dataset.oi; if (st.oi === i) return; st.oi = i; st.lp = null; st.exact = null; hap(8); render(); opts.onOi && opts.onOi(i); });
    const A = q("[data-amt]"), S = q("[data-ssh]"), LP = q("[data-lpv]");
    numInput(A, 2, v => { st.amt = v; st.exact = null; calc(); });
    numInput(S, 2, v => { st.sh = v; st.exact = null; calc(); });
    numInput(LP, 1, v => { st.lp = v; calc(); });
    const sw = q("[data-unit]"); if (sw) sw.onclick = () => {
      const Q = quote(); hap(6); st.exact = null;
      if (st.unit === "usd"){ st.unit = "sh"; st.sh = Q.sh ? String(fl2(Q.sh)) : ""; } else { st.unit = "usd"; st.amt = Q.usd ? String(r2(Q.usd)) : ""; }
      render();
    };
    host.querySelectorAll("[data-add]").forEach(b => b.onclick = () => {
      const n = +b.dataset.add; st.exact = null; hap(6);
      if (st.unit === "usd"){ let v = r2((+st.amt || 0) + n); if (st.side === "sell"){ const mx = fl2(quote().usd || 0), pos = posNow(); if (pos) v = Math.min(v, fl2(sellValue())); } setVal("amt", String(v), "[data-amt]"); }
      else { let v = r2((+st.sh || 0) + n); if (st.side === "sell") v = Math.min(v, freeSh()); setVal("sh", String(v), "[data-ssh]"); }
      calc();
    });
    host.querySelectorAll("[data-pct]").forEach(b => b.onclick = () => {
      const k = +b.dataset.pct; hap(k === 1 ? 10 : 8);
      if (st.side === "buy"){ setBudget(Math.min(bal(), cfg().maxBet) * k); }
      else {
        const free = freeSh(); if (!(free > 0)){ toast("You have no position to sell", "info"); return; }
        const sh = k === 1 ? free : fl2(free * k); st.exact = sh;
        if (st.unit === "sh") setVal("sh", String(sh), "[data-ssh]");
        else { const f = feeR(), v = st.type === "limit" ? (+st.lp || 0) / 100 * sh * (1 - f) : walkSell(levels(st.m, st.oi, "bid"), sh, sellPx(st.m, st.oi)).proceeds * (1 - f); setVal("amt", String(r2(v)), "[data-amt]"); st.exact = sh; }
      }
      calc();
    });
    host.querySelectorAll("[data-lp]").forEach(b => b.onclick = () => { const step = st.m.tick < .01 ? .1 : 1; st.lp = String(Math.round(Math.min(99.9, Math.max(.1, (+st.lp || 50) + step * +b.dataset.lp)) * 10) / 10); if (LP) LP.value = st.lp; hap(6); calc(); });
    q("[data-go]").onclick = go;
    const xf = q("[data-pd-xf2]"); if (xf) xf.onclick = () => { hap(10); UI.transferSheet({to: W}); };
  }
  function sellValue(){ const pos = posNow(); if (!pos) return 0; const f = feeR(); return walkSell(levels(st.m, st.oi, "bid"), freeSh(), sellPx(st.m, st.oi)).proceeds * (1 - f); }
  function calc(){
    const box = q("[data-sum]"); if (!box) return;
    const {m, oi, side, type, unit} = st, f = feeR(); let rows = [], btn = q("[data-go]");
    if (m.closed || !m.accepting || roundEnded(st.ev)){ box.innerHTML = ""; box.parentElement.hidden = true; return; }
    const Q = quote(), pos = posNow();
    if (type === "limit"){
      const p = (+st.lp || 0) / 100;
      rows = side === "buy" ? [["Total", usd(Q.usd)]].concat(unit === "usd" ? [] : []).concat([["To win", `<em class="up">${usd(Q.sh)}</em>`, "big"]]) : [["You'll receive", `<em class="up">${usd(Q.usd)}</em>`, "big"]];
      if (p > 0){ const best = side === "buy" ? buyPx(m, oi) : sellPx(m, oi), cross = side === "buy" ? best <= p : best >= p; rows.unshift(["Fills", cross ? "Instantly" : `When price ${side === "buy" ? "drops to" : "rises to"} ${cents(p)}`]); }
      if (side === "buy" && f) rows.splice(1, 0, ["Fee", usd(Q.sh * p * f)]);
    } else if (side === "buy"){
      rows = [["Avg price", Q.sh ? cents(Q.avg) : cents(buyPx(m, oi))]];
      if (unit === "sh") rows.push(["Total cost", usd(Q.usd)]);
      if (f && Q.usd) rows.push(["Fee", usd(Q.usd * f)]);
      rows.push(["To win", `<em class="up">${usd(Q.sh)}</em>${Q.usd ? ` <small class="up">(+${fmt((Q.sh / Q.usd - 1) * 100, 0)}%)</small>` : ""}`, "big"]);
    } else {
      rows = [["Avg price", Q.sh ? cents(Q.avg) : cents(sellPx(m, oi))]];
      if (pos && Q.sh){ const pnl = Q.usd - pos.avg * Q.sh; rows.push(["Est. PnL", `<span class="${pnl >= 0 ? "up" : "down"}">${usdS(pnl)}</span>`]); }
      rows.push(["You'll receive", `<em class="up">${usd(Q.usd)}</em>`, "big"]);
    }
    box.parentElement.hidden = false;
    box.innerHTML = rows.map(([k, v, c]) => `<div class="${c || ""}"><span>${k}</span><b class="num">${v}</b></div>`).join("");
    if (btn && !btn.classList.contains("done") && !btn.classList.contains("loading")) btn.innerHTML = goLabel() + (Q.usd ? ` <small class="num">· ${usd(Q.usd)}</small>` : "");
  }
  function tick(){
    if (!host.isConnected) return;
    [0, 1].forEach(i => { const el = q(`[data-tpx="${i}"]`); if (el) setTxt(el, cents(px(i))); });
    calc(); const b = q("[data-pd-bal]"); if (b) b.textContent = usd(bal());
  }
  async function go(){
    if (busyGo) return; const {ev, m, oi, side, type} = st, btn = q("[data-go]");
    const bad = msg => { U.fx("err"); toast(msg, "bad"); btn.classList.remove("pd-shake"); void btn.offsetWidth; btn.classList.add("pd-shake"); };
    if (roundEnded(ev)) return bad("This round has ended");
    if (!BOOK[m.tokens[0]] && !BOOK[m.tokens[1]]) await loadBooks(m.tokens).catch(() => {});
    const Q = quote(), req = Object.assign(reqMeta(ev, m, oi), {side, type}), pos = posNow();
    if (type === "limit"){
      req.price = (+st.lp || 0) / 100; req.shares = r2(Q.sh);
      if (!(req.price > 0 && req.price < 1)) return bad("Enter a limit price between 1¢ and 99¢");
      if (!(req.shares > 0)) return bad("Enter an amount");
      if (side === "buy" && Q.usd > bal() + 1e-9){ bad("Insufficient balance: Add funds to your Prediction wallet"); setTimeout(() => UI.transferSheet({to: W, amount: r2(Q.usd - bal())}), 400); return; }
    } else if (side === "buy"){
      req.amount = Math.ceil(Q.usd * 100 - 1e-6) / 100; if (!(req.amount > 0)) return bad("Enter an amount");
      if (req.amount > bal() + 1e-9){ bad("Insufficient balance: Add funds to your Prediction wallet"); setTimeout(() => UI.transferSheet({to: W, amount: r2(req.amount - bal())}), 400); return; }
    } else { req.shares = Q.sh; if (!(req.shares > 0)) return bad(pos ? "Enter an amount" : "You have no position to sell"); }
    /* confirmation with details — executes only on Confirm */
    const out = `<span class="pd-pill ${oi ? "no" : "yes"}">${esc(short(m.outs[oi]))}</span>`, f = feeR(), rows = [["Outcome", out], ["Order type", type === "limit" ? "Limit" : "Market"]];
    if (side === "buy"){ rows.push([type === "limit" ? "Limit price" : "Avg price", cents(type === "limit" ? req.price : Q.avg)], ["Shares", shr(Q.sh)], ["Total", usd(Q.usd)]); if (f) rows.push(["Fee", usd(Q.usd * f / (1 + (type === "limit" ? f : 0)))]); rows.push(["To win", usd(Q.sh), "big up"]); }
    else { const basis = pos ? pos.avg * Q.sh : 0; rows.push([type === "limit" ? "Limit price" : "Avg price", cents(type === "limit" ? req.price : Q.avg)], ["Shares", shr(Q.sh)], ["Invested", usd(basis)], ["Est. PnL", `<span class="${Q.usd - basis >= 0 ? "up" : "down"}">${usdS(Q.usd - basis)}</span>`], ["You'll receive", usd(Q.usd), "big up"]); }
    const ok = await pdConfirm({title: side === "buy" ? "Confirm buy" : "Confirm sell", sub: esc(ev.markets.length > 1 ? (m.gt || m.q) + " · " + ev.title : ev.title), rows, ok: `${side === "buy" ? "Buy" : "Sell"} ${short(m.outs[oi])}`, tone: side === "sell" ? "sell" : oi ? "no" : "yes"});
    if (!ok || !host.isConnected) return;
    busyGo = true; btn.classList.add("loading"); btn.setAttribute("aria-busy", "true");
    try {
      req.levels = levels(m, oi, side === "buy" ? "ask" : "bid").slice(0, 60);
      if (type === "market") req.price = side === "buy" ? buyPx(m, oi) : sellPx(m, oi);
      const r = await API.call("predict.order", req);
      if (r.fill){
        const fi = r.fill;
        if (side === "buy"){ U.fx("open"); toast(`Order filled: Bought ${shr(fi.shares)} ${m.outs[oi]} at ${cents(fi.avg)} avg · ${usd(fi.amount)}`, "ok", 3000); notif("Order filled", `Bought ${shr(fi.shares)} ${m.outs[oi]} at ${cents(fi.avg)} · ${usd(fi.amount)} · ${ev.title}`, "ok"); }
        else { U.fx(fi.pnl >= 0 ? "claim" : "close"); toast(`Sold ${shr(fi.shares)} ${m.outs[oi]}: ${usd(fi.amount)} received · PnL ${usdS(fi.pnl || 0)}`, fi.pnl >= 0 ? "ok" : "info", 3000); notif("Position closed", `Sold ${shr(fi.shares)} ${m.outs[oi]} · ${usd(fi.amount)} received · PnL ${usdS(fi.pnl || 0)}`, fi.pnl >= 0 ? "ok" : "bad"); }
        st.amt = ""; st.sh = ""; st.exact = null;
      } else if (r.order){ U.fx("notify"); toast(`Limit order placed: ${side === "buy" ? "Buy" : "Sell"} ${shr(r.order.shares)} ${m.outs[oi]} at ${cents(r.order.price)}`, "ok", 3000); notif("Limit order placed", `${side === "buy" ? "Buy" : "Sell"} ${shr(r.order.shares)} ${m.outs[oi]} at ${cents(r.order.price)} · ${ev.title}`, "info"); st.amt = ""; st.sh = ""; st.exact = null; }
      btn.classList.remove("loading"); btn.classList.add("done"); btn.innerHTML = ic("check", 18, 3) + (r.fill ? " Filled" : " Placed");
      setTimeout(() => { busyGo = false; if (host.isConnected) render(); }, 750);
      opts.onDone && opts.onDone(r);
    } catch (e){
      busyGo = false; btn.classList.remove("loading"); btn.removeAttribute("aria-busy");
      bad(e.message || "Order failed"); if (/insufficient/i.test(e.message || "")) setTimeout(() => UI.transferSheet({to: W}), 400);
    }
  }
  return P;
}
/* Cashout: sell the whole free position at the current book price — details, then one confirm */
async function cashout(p){
  if (roundEnded({slug: p.slug}) && Date.parse(p.end) < now()) return toast("Round ended. The result is being confirmed", "info");
  const {ev, m} = posMarket(p), free = r4(p.shares - (p.locked || 0));
  if (!(free > 0)) return toast("This position is locked in open sell orders", "info");
  if (!BOOK[m.tokens[0]] && !BOOK[m.tokens[1]]) await loadBooks(m.tokens).catch(() => {});
  const f = cfg().feePct / 100, calc = () => { const L = levels(m, p.oi, "bid"), w = walkSell(L, free, sellPx(m, p.oi)), net = w.proceeds * (1 - f); return {L, w, net, pnl: net - p.avg * free}; };
  const c = calc();
  const ok = await pdConfirm({title: "Cash out", sub: esc(p.q + (p.title ? " · " + p.title : "")), tone: "sell", ok: "Cash out " + usd(c.net),
    rows: [["Outcome", `<span class="pd-pill ${p.oi ? "no" : "yes"}">${esc(short(p.outcome))}</span>`], ["Invested", usd(p.cost)], ["Cash-out price", cents(c.w.avg)], ["Profit / loss", `<span class="${c.pnl >= 0 ? "up" : "down"}">${usdS(c.pnl)} (${fmt(p.cost ? c.pnl / p.cost * 100 : 0, 1)}%)</span>`], ["You'll receive", usd(c.net), "big up"]]});
  if (!ok) return;
  try {
    const n = calc(), r = await API.call("predict.sell", {token: p.token, shares: free, levels: n.L.slice(0, 60), price: sellPx(m, p.oi)}), fi = r.fill || {};
    const pnl = fi.pnl != null ? fi.pnl : n.pnl; U.fx(pnl >= 0 ? "claim" : "close");
    toast(`Cashed out ${usd(fi.amount != null ? fi.amount : n.net)} · PnL ${usdS(pnl)}`, pnl >= 0 ? "ok" : "info", 3200);
    notif("Cashed out", `${p.q} · ${usd(fi.amount != null ? fi.amount : n.net)} received · PnL ${usdS(pnl)}`, pnl >= 0 ? "ok" : "bad");
  } catch (e){ U.fx("err"); toast(e.message || "Could not cash out", "bad"); }
}
function quickTrade(ev, m, oi, side = "buy"){
  if (!cfg().enabled) return toast("Prediction market is under maintenance", "info");
  const st = {ev, m, oi, side, type: "market", unit: "usd", amt: "", sh: "", lp: null};
  let off = null, close = null, panel = null;
  hap(10);
  U.sheet(side === "buy" ? "Buy" : "Sell", `<div class="pd-qs" data-tp></div><a class="pd-qs-more" href="#/predict/m/${encodeURIComponent(ev.slug)}/${m.id}">Open market ${ic("chev", 14)}</a>`, el => {
    el.style.maxHeight = "calc(100vh - 88px)";
    panel = tradePanel(el.querySelector("[data-tp]"), st, {showQ: true, onDone: r => { if (r.fill) setTimeout(() => U.closeLayer(), 800); }});
    panel.render();
    const tk = raf(() => panel.tick());
    const f = t => { if (m.tokens.includes(t)) tk(); }; pxListeners.add(f); off = () => pxListeners.delete(f);
    loadBooks(m.tokens).then(tk).catch(() => {}); close = openWS(m.tokens);
    el.querySelector(".pd-qs-more").onclick = () => U.closeLayer();
    setTimeout(() => { const a = el.querySelector("[data-amt],[data-ssh]"); if (a && matchMedia("(pointer:fine)").matches) a.focus(); }, 320);
    const ob = bus.on("balance", () => panel && panel.tick()); const o0 = off; off = () => { o0 && o0(); ob(); };
  }, () => { off && off(); close && close(); const sh = document.getElementById("sheet"); if (sh) sh.style.maxHeight = ""; });
}

/* =====================================================================================================
   Screen 1: Markets list  (#/predict)
   ===================================================================================================== */
function ynBtn(m, i){ return `<button type="button" class="pd-ynb ${i ? "no" : "yes"}" data-buy="${m.id}" data-oi="${i}"><span>${esc(short(m.outs[i]))}</span><b class="num" data-${i ? "nb" : "yb"}="${m.id}">${cents(buyPx(m, i))}</b></button>`; }
function card(e){
  const href = `#/predict/m/${encodeURIComponent(e.slug)}`, live = Date.parse(e.end) - now() < 86400e3 && Date.parse(e.end) > now();
  const foot = `<div class="pd-card-f"><span class="num">${live ? '<i class="pd-live"></i>' : ""}$${cmp(e.vol)} Vol.</span><span>${ic("clock", 12)}${esc(endsIn(e.end))}</span></div>`;
  if (e.markets.length === 1){
    const m = e.markets[0];
    return `<article class="pd-card" data-ev="${esc(e.slug)}"><div class="pd-card-h">${img(e.img)}<a class="pd-card-q" href="${href}">${esc(e.title)}</a>${gauge(chance(m), m.id)}</div>
      <div class="pd-yn">${ynBtn(m, 0)}${ynBtn(m, 1)}</div>${foot}</article>`;
  }
  const rows = e.markets.slice(0, 3).map(m => `<div class="pd-orow"><span class="pd-on">${esc(m.gt || m.q)}</span><b class="num" data-ch="${m.id}">${chancePct(chance(m))}</b><button type="button" class="pd-mini yes" data-buy="${m.id}" data-oi="0" aria-label="Buy ${esc(m.outs[0])} on ${esc(m.gt || m.q)}">${esc(short(m.outs[0]))}</button><button type="button" class="pd-mini no" data-buy="${m.id}" data-oi="1" aria-label="Buy ${esc(m.outs[1])} on ${esc(m.gt || m.q)}">${esc(short(m.outs[1]))}</button></div>`).join("");
  return `<article class="pd-card" data-ev="${esc(e.slug)}"><div class="pd-card-h">${img(e.img)}<a class="pd-card-q" href="${href}">${esc(e.title)}</a></div>
    <div class="pd-orows">${rows}</div>${e.markets.length > 3 ? `<div class="pd-more-o">+${e.markets.length - 3} more outcomes</div>` : ""}${foot}</article>`;
}
const skel = n => Array.from({length: n}, () => `<div class="pd-card pd-skel"><div class="pd-card-h"><span class="pd-img sk"></span><span class="sk sk-t"></span><span class="sk sk-g"></span></div><div class="pd-yn"><span class="sk sk-b"></span><span class="sk sk-b"></span></div><span class="sk sk-f"></span></div>`).join("");

const catBtn = ([k, l], cat) => `<button type="button" role="tab" data-cat="${k}" class="${k === cat ? "on" : ""}" aria-selected="${k === cat}">${k === "hot" ? `<span class="pd-fire">${ic("fire", 14, 2)}</span>` : k === "live" ? '<i class="pd-live"></i>' : k.startsWith("end") ? ic("clock", 13, 2.2) : ""}${l}</button>`;
/* live round card (real Polymarket 5m / 15m Up-or-Down market) */
function rcard(e){
  const m = e.markets[0], r = roundOf(e), href = `#/predict/m/${encodeURIComponent(e.slug)}`;
  return `<article class="pd-card pd-rc" data-ev="${esc(e.slug)}" data-rc="${r.a.k}${r.iv}"><div class="pd-card-h">${img(e.img, "pd-img sm")}<a class="pd-card-q" href="${href}">${esc(rTitle(r))}<small>${clockET(r.t0)} – ${clockET(r.t1)} ET</small></a><span class="pd-rc-t num" data-rct="${r.t1}">${mmss(r.t1 * 1000 - now())}</span></div>
    <div class="pd-rc-bar"><i data-rcbar="${r.t0},${r.t1}"></i></div><div class="pd-yn">${ynBtn(m, 0)}${ynBtn(m, 1)}</div></article>`;
}
const rskel = () => Array.from({length: 4}, () => `<div class="pd-card pd-rc pd-skel"><div class="pd-card-h"><span class="pd-img sm sk"></span><span class="sk sk-t" style="height:30px"></span></div><div class="pd-yn"><span class="sk sk-b"></span><span class="sk sk-b"></span></div></div>`).join("");

function listScreen(){
  let root, cat = sessionStorage.getItem("pd_cat") || "hot", qs = "", events = [], offset = 0, loading = false, done = false, err = null, stale = false, reqId = 0;
  let closeWS = null, io = null, offs = [], st = 0, timers = [], rounds = [], rReq = 0, rLoaded = false;
  if (cat === "trending") cat = "hot";
  if (!CATS.some(c => c[0] === cat)) cat = "hot";
  let F = Object.assign({}, DEFF); try { Object.assign(F, JSON.parse(sessionStorage.getItem("pd_f") || "{}")); } catch {}
  const defF = () => F.sort === DEFF.sort && F.status === DEFF.status && F.win === DEFF.win;
  const html = `${STRIP}${subnav("")}<div class="pd-page">${balBar()}<div id="pdTutBox">${tutHtml()}</div>
    <div class="pd-srow"><div class="pd-search">${ic("search", 18)}<input type="search" id="pdQ" placeholder="Search markets" autocomplete="off" enterkeyhint="search" aria-label="Search markets"><button type="button" class="pd-qx" data-qx aria-label="Clear search" hidden>${ic("close", 16)}</button></div>
      <button type="button" class="pd-ibx" data-filt aria-label="Sort and filter">${ic("sort", 18, 1.9)}<i class="pd-dot" hidden></i></button><button type="button" class="pd-ibx" data-info aria-label="Where does the data come from?">${qIcon(18)}</button></div>
    <div class="pd-chips-row" id="pdCats" role="tablist">${CATS.map(c => catBtn(c, cat)).join("")}</div>
    <div id="pdNote"></div><div id="pdRounds"></div><div class="pd-list" id="pdList"></div><div class="pd-foot" id="pdMore"></div></div>`;
  const $ = s => root ? root.querySelector(s) : null;
  const tokMap = new Map();
  function indexTokens(){ tokMap.clear(); events.forEach(e => e.markets.slice(0, 3).forEach(m => tokMap.set(m.tokens[0], m))); rounds.forEach(e => tokMap.set(e.markets[0].tokens[0], e.markets[0])); }
  function subscribe(){ closeWS && closeWS(); indexTokens(); closeWS = openWS([...tokMap.keys()].slice(0, 100)); }
  const dirty = new Set();
  const flush = raf(() => { dirty.forEach(tk => { const m = tokMap.get(tk); if (!m) return; const c = chance(m);
    root.querySelectorAll(`[data-ch="${m.id}"]`).forEach(el => setTxt(el, chancePct(c)));
    const g = root.querySelector(`[data-g="${m.id}"] .pd-g-fg`); if (g){ g.setAttribute("stroke-dashoffset", (100 - c * 100).toFixed(1)); g.style.stroke = gcol(c); }
    root.querySelectorAll(`[data-yb="${m.id}"]`).forEach(el => setTxt(el, cents(buyPx(m, 0)))); root.querySelectorAll(`[data-nb="${m.id}"]`).forEach(el => setTxt(el, cents(buyPx(m, 1)))); }); dirty.clear(); });
  const onPx = tk => { if (tokMap.has(tk)){ dirty.add(tk); flush(); } };
  const showRounds = () => (cat === "hot" || cat === "live") && !qs && (cat === "live" || defF());
  function renderRounds(){
    const b = $("#pdRounds"); if (!b) return;
    if (!showRounds()){ b.innerHTML = ""; b.className = ""; return; }
    b.className = "pd-rounds " + (cat === "live" ? "grid" : "strip");
    const head = cat === "live" ? "" : `<div class="pd-rhd"><b>${ic("zap", 14, 2.2)}Live crypto rounds</b><a href="#/predict" data-rall>BTC &amp; ETH · 5m / 15m</a></div>`;
    b.innerHTML = head + `<div class="pd-rcs">${rounds.length ? rounds.map(rcard).join("") : rLoaded ? `<div class="pd-err" style="grid-column:1/-1"><b>Live rounds unavailable</b><span>Couldn't reach Polymarket. Try again shortly.</span><button type="button" class="btn btn-primary" data-rretry>Retry</button></div>` : rskel()}</div>`;
    const ra = b.querySelector("[data-rall]"); if (ra) ra.onclick = e => { e.preventDefault(); switchCat("live"); };
  }
  async function loadRounds(){
    const my = ++rReq;
    const res = await Promise.all(RA.flatMap(a => RIV.map(iv => loadRound(a, iv).catch(() => null))));
    if (my !== rReq || !root) return;
    rounds = res.filter(Boolean); rLoaded = true; rounds.forEach(remember);
    renderRounds(); if (rounds.length){ loadBooks(rounds.flatMap(e => e.markets[0].tokens)).catch(() => {}); subscribe(); }
  }
  function tickRounds(){
    if (!root) return; let expired = false; const t = now();
    root.querySelectorAll("[data-rct]").forEach(el => { const e = +el.dataset.rct * 1000; setTxt2(el, mmss(e - t)); if (e - t <= 0) expired = true; });
    root.querySelectorAll("[data-rcbar]").forEach(el => { const [a, b] = el.dataset.rcbar.split(",").map(Number); el.style.width = Math.max(0, Math.min(100, (t / 1000 - a) / (b - a) * 100)).toFixed(1) + "%"; });
    if (expired && !loading && rounds.length && !tickRounds.busy){ tickRounds.busy = true; loadRounds().finally(() => setTimeout(() => { tickRounds.busy = false; }, 2500)); }
  }
  function renderNote(){ const n = $("#pdNote"); if (!n) return; n.innerHTML = stale && events.length ? `<div class="pd-note">${ic("info", 14)}<span>Showing saved markets. Live data unavailable.</span><button type="button" data-retry>Retry</button></div>` : ""; }
  function renderMore(){
    const f = $("#pdMore"); if (!f) return;
    if (cat === "live" && !qs){ f.innerHTML = ""; return; }
    if (!events.length){ f.innerHTML = ""; return; }
    f.innerHTML = loading ? `<div class="pd-spin" role="status" aria-label="Loading"></div>` : err && !stale ? `<button type="button" class="pd-more-b" data-more>Couldn't load more · Retry</button>` : done ? `<div class="pd-end">You're all caught up</div>` : `<button type="button" class="pd-more-b" data-more>Load more</button>`;
  }
  function renderList(){
    const box = $("#pdList"); if (!box) return;
    if (cat === "live" && !qs){ box.innerHTML = ""; renderMore(); renderNote(); return; }
    if (!events.length){
      box.innerHTML = loading ? skel(4) : err ? `<div class="pd-err">${ic("info", 34, 1.4)}<b>Couldn't load markets</b><span>Check your connection and try again.</span><button type="button" class="btn btn-primary" data-retry>Retry</button></div>`
        : `<div class="pd-err">${ic("search", 34, 1.4)}<b>No markets found</b><span>${qs ? "Try a different search." : !defF() || cat !== "hot" ? "Nothing matches these filters right now." : "Nothing here right now."}</span></div>`;
    } else box.innerHTML = events.map(card).join("");
    renderMore(); renderNote();
  }
  const ckey = () => "list_" + cat + (defF() ? "" : "_f");
  async function load(reset){
    renderRounds();
    if (cat === "live" && !qs){ events = []; renderList(); if (!rounds.length || reset) loadRounds(); return; }
    if (loading && !reset) return; const my = ++reqId; loading = true;
    if (reset){ offset = 0; done = false; if (!events.length) renderList(); else renderMore(); } else renderMore();
    try {
      let raw, evs;
      if (qs){ const d = await getJ(`${GAMMA}/public-search?q=${encodeURIComponent(qs)}&limit_per_type=20&events_status=${F.status === "resolved" ? "closed" : "active"}&page=${Math.floor(offset / 20) + 1}`); raw = d.events || []; done = !(d.pagination && d.pagination.hasMore) || raw.length < 20; }
      else { raw = await getJ(listUrl(cat, offset, F)); done = raw.length < PAGE; }
      if (my !== reqId) return;
      evs = raw.map(normE).filter(e => e.markets.length && (F.status === "resolved" || !e.closed) && !roundOf(e)).map(remember);
      if (reset){ events = evs; } else { const have = new Set(events.map(e => e.id)); const add = evs.filter(e => !have.has(e.id)); events = events.concat(add);
        loading = false; err = null; const box = $("#pdList"); if (box){ box.insertAdjacentHTML("beforeend", add.map(card).join("")); } offset += raw.length; renderMore(); subscribe(); return; }
      offset = raw.length; err = null; stale = false; loading = false;
      if (!qs) cache.set(ckey(), events.slice(0, 24).map(slim));
      renderList(); subscribe();
    } catch (e){
      if (my !== reqId) return; loading = false; err = e;
      if (reset && !events.length){ const c = !qs && cache.get(ckey()); if (c){ events = c.v.map(remember); stale = true; } }
      else if (reset) stale = true;
      renderList(); if (events.length) subscribe();
    }
  }
  function showCached(){ if (cat === "live" && !qs){ events = []; renderList(); return; } const c = cache.get(ckey()); events = c ? c.v.map(remember) : []; renderList(); if (events.length) subscribe(); }
  function filtDot(){ const d = $(".pd-dot"); if (d) d.hidden = defF(); }
  function switchCat(k){
    if (qs){ const Q = $("#pdQ"); Q.value = ""; $("[data-qx]").hidden = true; qs = ""; root.querySelectorAll("[data-cat]").forEach(x => x.classList.remove("dim")); }
    cat = k; try { sessionStorage.setItem("pd_cat", cat); } catch {}
    root.querySelectorAll("[data-cat]").forEach(x => { const on = x.dataset.cat === k; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); if (on) x.scrollIntoView({inline: "center", block: "nearest", behavior: "smooth"}); });
    showCached(); load(true);
  }
  function filterSheet(){
    const w = Object.assign({}, F, {cat}); hap(8);
    const cats = CATS.filter(c => c[0] === "hot" || c[2]);
    const chips = (items, key) => items.map(([k, l]) => `<button type="button" data-w="${key}" data-v="${k}" class="${String(w[key]) === String(k) ? "on" : ""}">${k === "hot" && key === "cat" ? "All" : l}</button>`).join("");
    U.sheet("Sort & filter", `<div class="pd-fs"><section><h4>Sort by</h4><div class="pd-fchips">${chips(SORTS, "sort")}</div></section>
      <section><h4>Category</h4><div class="pd-fchips">${chips(cats, "cat")}</div></section>
      <section><h4>Status</h4><div class="pd-fchips">${chips([["open", "Open"], ["resolved", "Resolved"]], "status")}</div></section>
      <section><h4>Ending</h4><div class="pd-fchips">${chips(WINS, "win")}</div></section>
      <div class="pd-fs-btns"><button type="button" class="pd-pb" data-reset>Reset</button><button type="button" class="pd-pb pri" data-apply>Show results</button></div></div>`, el => {
      el.querySelector(".pd-fs").addEventListener("click", e => {
        const b = e.target.closest("[data-w]"); if (b){ w[b.dataset.w] = b.dataset.w === "win" ? +b.dataset.v : b.dataset.v; hap(6); el.querySelectorAll(`[data-w="${b.dataset.w}"]`).forEach(x => x.classList.toggle("on", x === b)); return; }
        if (e.target.closest("[data-reset]")){ Object.assign(w, DEFF, {cat: "hot"}); hap(6); el.querySelectorAll("[data-w]").forEach(x => x.classList.toggle("on", String(w[x.dataset.w]) === x.dataset.v)); return; }
        if (e.target.closest("[data-apply]")){
          hap(10); F = {sort: w.sort, status: w.status, win: w.win}; try { sessionStorage.setItem("pd_f", JSON.stringify(F)); } catch {}
          U.closeLayer(); filtDot();
          if (w.cat !== cat || true){ cat = w.cat === "live" ? "hot" : w.cat; if (!CATS.some(c => c[0] === cat)) cat = "hot"; try { sessionStorage.setItem("pd_cat", cat); } catch {}
            root.querySelectorAll("[data-cat]").forEach(x => { const on = x.dataset.cat === cat; x.classList.toggle("on", on); if (on) x.scrollIntoView({inline: "center", block: "nearest"}); }); }
          if (qs){ $("#pdQ").value = ""; $("[data-qx]").hidden = true; qs = ""; }
          events = []; renderList(); load(true);
        }
      });
    });
  }
  function mount(r){
    root = r; curScreen = "list"; seed(); bindCommon(root, offs);
    pxListeners.add(onPx); offs.push(() => pxListeners.delete(onPx));
    offs.push(bus.on("pd-tut", () => { const b = $("#pdTutBox"); if (b) b.innerHTML = tutHtml(); }));
    const Q = $("#pdQ"), X = root.querySelector("[data-qx]"); filtDot();
    Q.oninput = () => { X.hidden = !Q.value; clearTimeout(st); st = setTimeout(() => { const v = Q.value.trim(); if (v === qs) return; qs = v; root.querySelectorAll("[data-cat]").forEach(b => b.classList.toggle("dim", !!qs)); events = []; renderRounds(); load(true); }, 380); };
    Q.onkeydown = e => { if (e.key === "Enter"){ Q.blur(); } };
    X.onclick = () => { Q.value = ""; X.hidden = true; qs = ""; root.querySelectorAll("[data-cat]").forEach(b => b.classList.remove("dim")); showCached(); load(true); };
    $("#pdCats").onclick = e => { const b = e.target.closest("[data-cat]"); if (!b) return; hap(6);
      if (b.dataset.cat === cat && !qs){ load(true); return; }
      switchCat(b.dataset.cat); };
    root.addEventListener("click", e => {
      const T = e.target;
      if (T.closest("[data-filt]")){ filterSheet(); return; }
      if (T.closest("[data-info]")){ hap(6); infoPop(); return; }
      const tb = T.closest("[data-tut]"); if (tb){ hap(6); tutPop(+tb.dataset.tut); return; }
      if (T.closest("[data-tutx]")){ hap(6); try { localStorage.setItem(TUT_KEY, "1"); } catch {} const b = $("#pdTutBox"); if (b) b.innerHTML = ""; return; }
      if (T.closest("[data-rretry]")){ rLoaded = false; renderRounds(); loadRounds(); return; }
      if (T.closest("[data-retry]")){ hap(8); load(true); return; }
      if (T.closest("[data-more]")){ load(false); return; }
      const b = T.closest("[data-buy]");
      if (b){ e.preventDefault(); const c = b.closest("[data-ev]"), ev = EV.get(c.dataset.ev), m = ev && ev.markets.find(x => x.id === b.dataset.buy); if (m) quickTrade(ev, m, +b.dataset.oi); return; }
      const c = T.closest(".pd-card[data-ev]"); if (c && !T.closest("a")) location.hash = `#/predict/m/${encodeURIComponent(c.dataset.ev)}`;
    });
    if ("IntersectionObserver" in window){ io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting) && events.length && !loading && !done && !err) load(false); }, {rootMargin: "600px"}); io.observe($("#pdMore")); }
    if (!cfg().enabled) return;
    timers.push(setInterval(() => { if (!document.hidden) tickRounds(); }, 1000));
    renderRounds(); if (showRounds()) loadRounds();
    showCached(); if (!events.length && !(cat === "live" && !qs)){ loading = true; renderList(); loading = false; }
    load(true);
  }
  function unmount(){ curScreen = null; closeWS && closeWS(); io && io.disconnect(); clearTimeout(st); timers.forEach(clearInterval); offs.forEach(f => f()); reqId++; rReq++; closeAllOvl(); }
  return {html: cfg().enabled ? html : STRIP + subnav("") + maint(), title: "Prediction", mount: cfg().enabled ? mount : () => {}, unmount};
}

/* =====================================================================================================
   Screen 2: Market detail  (#/predict/m/<slug>[/<market id>])
   ===================================================================================================== */
const TFS = [["1h", "1H", "1h", 1], ["6h", "6H", "6h", 2], ["1d", "1D", "1d", 5], ["1w", "1W", "1w", 30], ["1m", "1M", "1m", 180], ["max", "ALL", "max", 720]];
const HI = {};
async function history(tk, tf){
  const k = tk + tf, c = HI[k]; if (c && now() - c.t < 60e3) return c.v;
  const T = TFS.find(x => x[0] === tf) || TFS[2];
  const d = await getJ(`${CLOB}/prices-history?market=${tk}&interval=${T[2]}&fidelity=${T[3]}`);
  const v = (d.history || []).map(p => [p.t * 1000, +p.p]).filter(p => p[1] >= 0);
  HI[k] = {t: now(), v}; return v;
}
const nm = s => /^0x[0-9a-f]{12,}$/i.test(s || "") ? s.slice(0, 6) + "…" + s.slice(-4) : (s || "Trader");
const nameAv = (seed, size = 30) => { let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const hue = h % 360; return `<span class="pd-av" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,hsl(${hue} 70% 58%),hsl(${(hue + 50) % 360} 75% 48%))">${esc(String(seed || "?").replace(/^0x/, "")[0] || "?").toUpperCase()}</span>`; };
const SIMN = ["Theo4","Fredi9999","PrincessCaro","zxgngl","Domer","50pence","JustKen","CigarettesAfterSex","WindWalk3","kch123","gopfan2","RepTrump","sargallot","bobe2","HyperLiquid0xb","Erasmus","Car","BrokenStrategy"];
function simTrades(m, n = 14){ const out = [], c = chance(m); for (let i = 0; i < n; i++){ const yes = Math.random() < c + .1, p = Math.max(.01, Math.min(.99, (yes ? c : 1 - c) + (Math.random() - .5) * .02)); out.push({name: SIMN[(i * 7 + m.id.length) % SIMN.length], side: Math.random() < .78 ? "BUY" : "SELL", outcome: m.outs[yes ? 0 : 1], size: Math.round(5 + Math.random() ** 2 * 3000), price: p, t: now() - i * (40e3 + Math.random() * 200e3), sim: true}); } return out; }
function simHolders(m){ return [0, 1].map(oi => SIMN.slice(oi * 6, oi * 6 + 8).map((n, i) => ({name: n, amount: Math.round(250000 / (i + 1.3) * (oi ? 1 - chance(m) : chance(m)) + 900), sim: true}))); }

function detailScreen(key, mid){
  let root, ev = EV.get(key) || null, sel = 0, tf = sessionStorage.getItem("pd_tf") || "1d", tab = "book", panel = null, closeWS = null, offs = [], timers = [], loadErr = null;
  let trades = [], holders = null, related = null, chartTok = "", series = [];
  let rd = null, roundDone = false, startPx = null, slEl = null, svEl = null, rPoll = 0;
  const st = {ev, m: null, oi: 0, side: "buy", type: "market", unit: "usd", amt: "", sh: "", lp: null};
  const $ = s => root ? root.querySelector(s) : null;
  const html = `<div class="pd-page pd-det">${backHead("Market", `<button class="pd-ib" data-share aria-label="Share market">${ic("share", 20)}</button>`)}<div id="pdDet">${skelDet()}</div></div>`;
  function skelDet(){ return `<div class="pd-skel"><div class="pd-dh"><span class="pd-img lg sk"></span><span class="sk sk-t" style="height:44px"></span></div><span class="sk" style="display:block;height:34px;width:40%;margin:14px 0"></span><span class="sk" style="display:block;height:190px"></span></div>`; }
  function selM(){ return ev.markets[sel] || ev.markets[0]; }
  function pickInitial(){
    sel = 0; if (mid){ const i = ev.markets.findIndex(m => m.id === String(mid)); if (i >= 0) sel = i; }
    try { const pf = JSON.parse(sessionStorage.getItem("pd_prefill") || "null"); if (pf && ev.markets.some(m => m.id === pf.mid)){ sel = ev.markets.findIndex(m => m.id === pf.mid); st.oi = pf.oi; st.type = "limit"; st.lp = Math.round(pf.price * 1000) / 10; st.side = pf.side || "buy"; } sessionStorage.removeItem("pd_prefill"); } catch {}
    st.ev = ev; st.m = selM();
  }
  function render(){
    const box = $("#pdDet"); if (!box) return;
    if (!ev){ box.innerHTML = loadErr ? `<div class="pd-err">${ic("info", 34, 1.4)}<b>Couldn't load this market</b><span>${esc(/fetch|network|abort/i.test(loadErr.message || "") ? "Network error. Check your connection and try again." : loadErr.message || "Network error")}</span><button type="button" class="btn btn-primary" data-retry>Retry</button></div>` : skelDet(); return; }
    const m = selM(), multi = ev.markets.length > 1, c = chance(m); rd = roundOf(ev); roundDone = false;
    const hero = rd ? roundHeroHtml(m, c) : `<section class="pd-sec pd-hero"><div class="pd-chance">${multi ? `<span class="pd-chname">${esc(m.gt || m.q)}</span>` : ""}<b class="num" data-dch>${chancePct(c)}</b><span>chance</span><em class="num ${m.chg >= 0 ? "up" : "down"}" data-dchg>${m.chg ? (m.chg >= 0 ? "▲" : "▼") + " " + Math.abs(Math.round(m.chg * 100)) + "%" : ""}</em></div>
      <div class="pd-chart" id="pdChart"><div class="pd-ch-empty" style="height:190px"><span class="pd-spin"></span></div></div>
      ${multi ? `<div class="pd-legend" id="pdLeg"></div>` : ""}
      <div class="pd-tfs" role="tablist">${TFS.map(([k, l]) => `<button type="button" role="tab" data-tf="${k}" class="${k === tf ? "on" : ""}">${l}</button>`).join("")}</div></section>`;
    box.innerHTML = `<div class="pd-dh">${img(ev.img, "pd-img lg")}<div><h2 class="pd-dt">${esc(rd ? rTitle(rd) : ev.title)}</h2>${rd ? `<div class="pd-dmeta"><span>${clockET(rd.t0)} – ${clockET(rd.t1)} ET</span><span class="pd-tag live" data-rtag><i class="pd-live"></i>Live</span></div>` : `<div class="pd-dmeta"><span class="num">$${cmp(ev.vol)} Vol.</span><span>${ic("clock", 12)}${esc(dShort(m.end || ev.end))}</span>${ev.closed || m.closed ? '<span class="pd-tag">Closed</span>' : '<span class="pd-tag live"><i class="pd-live"></i>Live</span>'}</div>`}</div></div>
      ${hero}
      ${multi ? `<section class="pd-sec"><h3 class="pd-h3">Outcomes <small>${ev.markets.length}</small></h3><div class="pd-outs" id="pdOuts">${outsHtml()}</div></section>` : ""}
      <section class="pd-sec pd-trade" id="pdTrade"></section>
      <div id="pdMine"></div>
      <section class="pd-sec"><div class="pd-tabs" role="tablist">${[["book", "Order Book"], ["activity", "Activity"], ["holders", "Top Holders"], ["rules", "Rules"]].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}</div><div id="pdTab"></div></section>
      <section class="pd-sec"><h3 class="pd-h3">Related markets</h3><div id="pdRel"><div class="pd-spin"></div></div></section>
      <div class="pd-sticky" id="pdSticky">${[0, 1].map(i => `<button type="button" class="pd-ynb ${i ? "no" : "yes"}" data-stk="${i}"><span>Buy ${esc(short(m.outs[i]))}</span><b class="num" data-stp="${i}">${cents(buyPx(m, i))}</b></button>`).join("")}</div>`;
    panel = tradePanel($("#pdTrade"), st, {onOi: () => { renderTab(); }}); panel.render();
    renderMine(); renderTab(); renderRel();
    if (rd) mountRoundChart(); else loadChart();
  }
  /* ---- live round hero: live price, start price, countdown, app chart (timeframes + indicators) ---- */
  function roundHeroHtml(m, c){
    return `<section class="pd-sec pd-rh"><div class="pd-rh-top"><div class="pd-rh-p"><span>${esc(rd.a.name)} price</span><b class="num" data-rpx>--</b><em class="num" data-rdl></em></div><div class="pd-rh-cd"><span data-rcl>Ends in</span><b class="num" data-rcd>${mmss(rd.t1 * 1000 - now())}</b></div></div>
      <div class="pd-rc-bar"><i data-rcbar="${rd.t0},${rd.t1}"></i></div>
      <div class="pd-rh-meta"><span>Start price <b class="num" data-rsp>--</b></span><span>${esc(m.outs[0])} <b class="num up" data-dch>${chancePct(c)}</b></span></div>
      <div class="pd-rh-chart"><div id="pdRC" style="height:280px"></div></div>
      <div class="pd-fine" data-rres></div></section>`;
  }
  function mountRoundChart(){
    const host = $("#pdRC"); if (!host || !window.CH) return;
    try { CH.mount(host, {sym: rd.sym, tf: sessionStorage.getItem("tf_ch3") || "1m", indicators: true, compact: true, tfbar: true, mode: "none", height: "280px", tfs: ["1s", "1m", "5m", "15m", "1h"]}); } catch (e){ console.warn(e); }
    startPrice(rd).then(v => { startPx = v != null ? v : livePx(rd.sym); updateRound(); });
    updateRound();
  }
  const nextLink = txt => `${txt} <a class="pd-link" href="#/predict/m/${rd.a.k}-updown-${rd.iv}m-${rd.t1}">Go to the next round ${ic("chev", 14)}</a>`;
  const fp = v => v == null ? "--" : window.M && M.fmtPx ? M.fmtPx(M.get(rd.sym), v) : fmt(v, 2);
  function placeLines(){
    const g = window.CH && CH.geo && CH.geo(); const wrap = g && g.el && g.el.parentElement;
    if (!wrap || startPx == null){ if (slEl) slEl.style.display = "none"; if (svEl) svEl.style.display = "none"; return; }
    if (!slEl || !slEl.isConnected){ slEl = document.createElement("div"); slEl.className = "pd-sl"; slEl.innerHTML = "<i></i><span></span>"; wrap.appendChild(slEl); svEl = document.createElement("div"); svEl.className = "pd-sv"; wrap.appendChild(svEl); }
    const y = g.p2y(startPx);
    if (y == null || isNaN(y) || y < 0 || y > g.h){ slEl.style.display = "none"; } else { slEl.style.display = ""; slEl.style.top = y.toFixed(1) + "px"; slEl.lastChild.textContent = "Start " + fp(startPx); }
    let x = null; try { x = g.t2x(rd.t0); } catch {}
    if (x == null || isNaN(x) || x < 0 || x > g.pw){ svEl.style.display = "none"; } else { svEl.style.display = ""; svEl.style.left = x.toFixed(1) + "px"; }
  }
  function updateRound(){
    if (!rd || !root) return; const t = now(), left = rd.t1 * 1000 - t, px = livePx(rd.sym);
    setTxt2($("[data-rcd]"), mmss(left));
    const bar = $("[data-rcbar]"); if (bar) bar.style.width = Math.max(0, Math.min(100, (t / 1000 - rd.t0) / (rd.t1 - rd.t0) * 100)).toFixed(1) + "%";
    if (px != null){ setTxt($("[data-rpx]"), fp(px)); if (startPx != null){ const d = px - startPx, e = $("[data-rdl]"); if (e){ e.textContent = (d >= 0 ? "+" : "-") + fp(Math.abs(d)) + " (" + (d >= 0 ? "+" : "-") + fmt(Math.abs(d / startPx * 100), 3) + "%)"; e.className = "num " + (d >= 0 ? "up" : "down"); } } }
    setTxt2($("[data-rsp]"), fp(startPx));
    placeLines();
    if (left <= 0 && !roundDone){ roundDone = true; const l = $("[data-rcl]"); if (l) l.textContent = "Round ended"; const tg = $("[data-rtag]"); if (tg){ tg.classList.remove("live"); tg.textContent = "Resolving"; } panel && panel.render(); rPoll = 0; const rs = $("[data-rres]"); if (rs) rs.innerHTML = nextLink("Waiting for the final result."); pollRound(); }
    if (roundDone) { const l = $("[data-rcl]"); if (l && ev.markets[0].closed) l.textContent = "Result"; }
  }
  async function pollRound(){
    if (!root || !rd || !roundDone) return;
    try {
      const e = await fetchEvent(ev.slug), nm0 = e.markets[0], m = ev.markets[0];
      if (nm0 && nm0.closed){ Object.assign(m, {closed: true, prices: nm0.prices, active: nm0.active, accepting: false});
        const up = nm0.prices[0] >= .99, dn = nm0.prices[1] >= .99, tg = $("[data-rtag]");
        if (tg) tg.textContent = "Resolved"; const rs = $("[data-rres]"); if (rs) rs.innerHTML = up || dn ? nextLink(`Result: <b class="${up ? "up" : "down"}">${esc(m.outs[up ? 0 : 1])}</b>. Winning shares pay $1 each.`) : nextLink("Round resolved.");
        panel && panel.render(); renderMine(); checkSettle().catch(() => {}); return; }
    } catch {}
    rPoll++; if (root && rPoll < 90) setTimeout(pollRound, 4000);
  }
  function outsHtml(){
    return ev.markets.map((m, i) => `<div class="pd-out ${i === sel ? "on" : ""}" data-sel="${i}" role="button" tabindex="0"><div class="pd-out-l">${ev.markets.length > 1 && m.img && m.img !== ev.img ? img(m.img, "pd-img xs") : ""}<div><b>${esc(m.gt || m.q)}</b><small class="num">$${cmp(m.vol)} Vol.</small></div></div>
      <b class="num pd-out-c" data-och="${m.id}">${chancePct(chance(m))}</b><div class="pd-out-b"><button type="button" class="pd-mini yes" data-ob="${i}" data-oi="0"><span>${esc(short(m.outs[0]))}</span> <b class="num" data-oyb="${m.id}">${cents(buyPx(m, 0))}</b></button><button type="button" class="pd-mini no" data-ob="${i}" data-oi="1"><span>${esc(short(m.outs[1]))}</span> <b class="num" data-onb="${m.id}">${cents(buyPx(m, 1))}</b></button></div></div>`).join("");
  }
  function select(i, oi){
    if (i !== sel){ sel = i; st.m = selM(); st.lp = null; trades = []; holders = null; hap(8);
      root.querySelectorAll("[data-sel]").forEach(x => x.classList.toggle("on", +x.dataset.sel === sel));
      const m = selM(); const cn = $(".pd-chname"); if (cn) cn.textContent = m.gt || m.q; loadBooks(m.tokens).catch(() => {}); loadTabData(); }
    if (oi != null) st.oi = oi;
    panel.render(); renderMine(); renderTab(); updateHead(); if (!rd) loadChart(true);
  }
  function updateHead(){
    if (!ev) return; const m = selM(), c = chance(m);
    setTxt($("[data-dch]"), chancePct(c));
    [0, 1].forEach(i => { setTxt(root.querySelector(`[data-stp="${i}"]`), cents(buyPx(m, i))); const b = root.querySelector(`[data-stk="${i}"] span`); if (b) b.textContent = "Buy " + short(m.outs[i]); });
    ev.markets.forEach(x => { setTxt(root.querySelector(`[data-och="${x.id}"]`), chancePct(chance(x))); setTxt(root.querySelector(`[data-oyb="${x.id}"]`), cents(buyPx(x, 0))); setTxt(root.querySelector(`[data-onb="${x.id}"]`), cents(buyPx(x, 1))); });
  }
  /* chart: selected market (binary) or top 4 outcomes (multi) */
  let chartReq = 0, lastChartDraw = 0;
  async function loadChart(force){
    const box = $("#pdChart"); if (!box || !ev) return; const my = ++chartReq;
    const ms = ev.markets.length > 1 ? [selM()].concat(ev.markets.filter(x => x !== selM()).slice(0, 3)) : [selM()];
    try {
      const hs = await Promise.all(ms.map(m => history(m.tokens[0], tf).catch(() => [])));
      if (my !== chartReq || !root) return;
      series = ms.map((m, i) => ({name: m.gt || m.outs[0], color: COLS[i], pts: hs[i].concat([[now(), chance(m)]]), m}));
      drawSeries();
      const leg = $("#pdLeg"); if (leg) leg.innerHTML = series.map(s => `<span><i style="background:${s.color}"></i>${esc(short(s.name))} <b class="num" data-leg="${s.m.id}">${chancePct(chance(s.m))}</b></span>`).join("");
    } catch { box.innerHTML = `<div class="pd-ch-empty" style="height:190px">Chart unavailable <button type="button" data-chretry>Retry</button></div>`; }
  }
  function drawSeries(){ lastChartDraw = now(); drawChart($("#pdChart"), series, {pct: true, h: 190, label: "Chance over time"}); }
  function liveChart(){
    if (rd || !series.length || now() - lastChartDraw < 1500) return;
    let ch = false; series.forEach(s => { const c = chance(s.m), l = s.pts[s.pts.length - 1]; if (l && Math.abs(l[1] - c) > 1e-6){ s.pts.push([now(), c]); ch = true; } else if (l) l[0] = now(); });
    const tip = $("#pdChart .pd-ch-tip"); if (ch && (!tip || tip.style.display === "none")) drawSeries();
    series.forEach(s => setTxt(root.querySelector(`[data-leg="${s.m.id}"]`), chancePct(chance(s.m))));
  }
  /* your position + open orders in this event */
  function renderMine(){
    const box = $("#pdMine"); if (!box || !ev) return; const d = data(), ids = new Set(ev.markets.map(m => m.id));
    const ps = d.positions.filter(p => ids.has(p.mid)), os = d.orders.filter(o => ids.has(o.mid));
    if (!ps.length && !os.length){ box.innerHTML = ""; return; }
    box.innerHTML = `<section class="pd-sec"><h3 class="pd-h3">Your positions</h3>${ps.map(p => `<div class="pd-mine pd-mp" data-ptk="${p.token}"><div class="pd-mp-h"><span class="pd-pill ${p.oi ? "no" : "yes"}">${esc(short(p.outcome))}</span>${p.title ? `<small>${esc(p.title)}</small>` : ""}<span class="pd-mine-s num">${shr(p.shares)} shares · avg ${cents(p.avg)}</span></div>${posGrid(p)}<div class="pd-mp-b">${posBtns(p)}</div></div>`).join("")}
      ${os.length ? `<h3 class="pd-h3" style="margin-top:12px">Open orders</h3>` + os.map(o => `<div class="pd-mine"><div><span class="pd-pill ${o.side === "buy" ? "yes" : "no"}">${o.side === "buy" ? "Buy" : "Sell"} ${esc(short(o.outcome))}</span>${o.title ? `<small>${esc(o.title)}</small>` : ""}<div class="pd-mine-s num">${shr(o.shares)} shares @ ${cents(o.price)}</div></div><div class="pd-mine-r"><b class="num">${usd(o.price * o.shares)}</b><small>${ago(o.t)}</small></div><button type="button" class="pd-cancel" data-cancel="${o.id}">Cancel</button></div>`).join("") : ""}</section>`;
  }
  function tickMine(){ const box = $("#pdMine"); if (!box) return; box.querySelectorAll("[data-ptk]").forEach(r => { const p = findPos(r.dataset.ptk); if (p) posGridTick(r, p); }); }
  /* tabs */
  function bookHtml(m, oi, n){
    const asks = levels(m, oi, "ask").slice(0, n), bids = levels(m, oi, "bid").slice(0, n);
    if (!asks.length && !bids.length) return `<div class="pd-ch-empty" style="height:120px">${BOOK[m.tokens[0]] ? "No orders in the book" : '<span class="pd-spin"></span>'}</div>`;
    const cum = L => { let a = 0; return L.map(([p, s]) => (a += p * s, [p, s, a])); }, A = cum(asks), B = cum(bids), mx = Math.max(A.length ? A[A.length - 1][2] : 0, B.length ? B[B.length - 1][2] : 0) || 1;
    const row = (cls, [p, s, a]) => `<div class="pd-bk-r ${cls}" data-bkp="${p}"><i style="width:${(a / mx * 100).toFixed(1)}%"></i><span class="num">${cents(p)}</span><span class="num">${fmt(s, 2)}</span><span class="num">${usd(a, 2)}</span></div>`;
    const sp = asks.length && bids.length ? asks[0][0] - bids[0][0] : null, l0 = (PX[m.tokens[oi]] || {}).last, l1 = (PX[m.tokens[1 - oi]] || {}).last, last = l0 != null ? l0 : l1 != null ? r4(1 - l1) : outPx(m, oi);
    return `<div class="pd-bk"><div class="pd-bk-h"><span>Price</span><span>Shares</span><span>Total</span></div>
      ${A.slice().reverse().map(x => row("ask", x)).join("")}
      <div class="pd-bk-mid"><span>Last <b class="num">${cents(last)}</b></span><span>Spread <b class="num">${sp != null ? cents(Math.max(0, sp)) : "--"}</b></span></div>
      ${B.map(x => row("bid", x)).join("")}</div>`;
  }
  function renderTab(){
    const box = $("#pdTab"); if (!box || !ev) return; const m = selM();
    if (tab === "book"){
      box.innerHTML = `<div class="pd-bk-oc">${[0, 1].map(i => `<button type="button" data-bkoi="${i}" class="${st.oi === i ? "on" : ""}">Trade ${esc(short(m.outs[i]))}</button>`).join("")}</div><div id="pdBk">${bookHtml(m, st.oi, 6)}</div><a class="pd-link" href="#/predict/book/${encodeURIComponent(ev.slug)}/${m.id}">Full order book ${ic("chev", 14)}</a>`;
    } else if (tab === "activity"){
      const live = (TRADES[m.tokens[0]] || []).concat(TRADES[m.tokens[1]] || []).filter(t => t.t > now() - 3600e3).map(t => ({name: "Trader", side: t.side, outcome: m.outs[t.tk === m.tokens[0] ? 0 : 1], size: t.s, price: t.p, t: t.t, live: true}));
      const list = live.concat(trades).sort((a, b) => b.t - a.t).slice(0, 30);
      box.innerHTML = list.length ? `<div class="pd-acts">${list.map(t => `<div class="pd-act">${t.img ? `<img class="pd-av" src="${esc(t.img)}" alt="" loading="lazy" onerror="this.replaceWith(document.createElement('span'))">` : nameAv(t.name)}<div><b>${esc(t.name)}</b><span>${t.side === "SELL" ? "sold" : "bought"} <em class="num ${t.outcome === m.outs[0] ? "up" : "down"}">${shr(t.size)} ${esc(short(t.outcome))}</em> at <span class="num">${cents(t.price)}</span></span></div><div class="pd-act-r"><b class="num">${usd(t.size * t.price)}</b><small>${ago(t.t)}</small></div></div>`).join("")}</div>${trades[0] && trades[0].sim ? '<div class="pd-fine">Sample activity (live feed unavailable)</div>' : ""}` : `<div class="pd-ch-empty" style="height:100px"><span class="pd-spin"></span></div>`;
    } else if (tab === "holders"){
      box.innerHTML = holders ? `<div class="pd-hold">${[0, 1].map(oi => `<div><h4 class="${oi ? "down" : "up"}">${esc(short(m.outs[oi]))} holders</h4>${(holders[oi] || []).slice(0, 8).map((h, i) => `<div class="pd-hr"><span class="pd-hn">${i + 1}</span>${h.img ? `<img class="pd-av" src="${esc(h.img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : nameAv(h.name, 24)}<span class="pd-hname">${esc(h.name)}</span><b class="num">${cmp(h.amount)}</b></div>`).join("") || '<div class="pd-fine">No holders</div>'}</div>`).join("")}</div>${holders.sim ? '<div class="pd-fine">Sample holders (live data unavailable)</div>' : ""}` : `<div class="pd-ch-empty" style="height:100px"><span class="pd-spin"></span></div>`;
    } else {
      const desc = (m.desc || ev.desc || "").trim();
      box.innerHTML = `<div class="pd-rules"><p>${esc(desc || "No rules provided.").replace(/\n+/g, "<br><br>")}</p><div class="pd-kv"><div><span>Market opened</span><b>${esc(dShort(m.start || ev.start) || "--")}</b></div><div><span>End date</span><b>${esc(dShort(m.end || ev.end) || "--")}</b></div><div><span>Resolver</span><b>UMA optimistic oracle</b></div>${ev.res ? `<div><span>Source</span><b><a href="${esc(ev.res)}" target="_blank" rel="noopener noreferrer">${esc(ev.res.replace(/^https?:\/\//, "").slice(0, 40))}</a></b></div>` : ""}</div></div>`;
    }
  }
  const tickBook = raf(() => { if (tab === "book"){ const b = $("#pdBk"); if (b) b.innerHTML = bookHtml(selM(), st.oi, 6); } });
  async function loadTabData(){
    const m = selM(); if (!m || !m.cid) return;
    if (!trades.length) getJ(`${DAPI}/trades?condition=${m.cid}&limit=30`).then(d => { if (selM() !== m) return; trades = (d.data || []).map(t => ({name: nm(t.name || t.pseudonym || t.proxy_wallet), img: t.profile_image_optimized || t.profile_image || "", side: t.side, outcome: t.outcome, size: +t.size, price: +t.price, t: t.timestamp * 1000})); if (!trades.length) trades = simTrades(m); if (tab === "activity") renderTab(); })
      .catch(() => { trades = simTrades(m); if (tab === "activity") renderTab(); });
    if (!holders) getJ(`${DAPI}/holders?condition=${m.cid}&limit=10`).then(d => { if (selM() !== m) return; const rows = d.data || []; holders = [0, 1].map(oi => { const g = rows.find(r => r.token_id === m.tokens[oi]); return ((g && g.holders) || []).map(h => ({name: nm(h.name || h.pseudonym || h.proxy_wallet), img: h.profile_image_optimized || h.profile_image || "", amount: +h.amount})); }); if (!holders[0].length && !holders[1].length){ holders = simHolders(m); holders.sim = true; } if (tab === "holders") renderTab(); })
      .catch(() => { holders = simHolders(m); holders.sim = true; if (tab === "holders") renderTab(); });
  }
  async function renderRel(){
    const box = $("#pdRel"); if (!box || !ev) return;
    if (rd){
      const hd = box.parentElement.querySelector(".pd-h3"); if (hd) hd.textContent = "More live rounds";
      const res = await Promise.all(RA.flatMap(a => RIV.map(iv => loadRound(a, iv).catch(() => null)))); const b2 = $("#pdRel"); if (!b2) return;
      b2.innerHTML = res.filter(e => e && e.slug !== ev.slug).map(e => { const r = roundOf(e); return `<a class="pd-rel" href="#/predict/m/${encodeURIComponent(e.slug)}">${img(e.img, "pd-img sm")}<span>${esc(rTitle(r))}<small class="pd-rel-s">ends ${clockET(r.t1)} ET</small></span><b class="num">${chancePct(chance(e.markets[0]))}</b></a>`; }).join("") || `<div class="pd-fine">No other rounds right now.</div>`;
      return;
    }
    if (!related){
      try { const tag = ev.tags.find(t => !/^(all|recurring|hide|featured)/i.test(t)) || "";
        const raw = await getJ(`${GAMMA}/events?active=true&closed=false&order=volume24hr&ascending=false&limit=8` + (tag ? "&tag_slug=" + encodeURIComponent(tag) : ""));
        related = raw.map(normE).filter(e => e.markets.length && e.id !== ev.id).slice(0, 5).map(remember);
      } catch { related = []; }
    }
    const b = $("#pdRel"); if (!b) return;
    b.innerHTML = related.length ? related.map(e => `<a class="pd-rel" href="#/predict/m/${encodeURIComponent(e.slug)}">${img(e.img, "pd-img sm")}<span>${esc(e.title)}</span><b class="num">${chancePct(chance(e.markets[0]))}</b></a>`).join("") : `<div class="pd-fine">No related markets right now.</div>`;
  }
  const onPx = raf(() => { if (!root || !ev) return; updateHead(); panel && panel.tick(); tickBook(); tickMine(); liveChart(); });
  const onTrade = tr => { if (tab === "activity" && ev && selM().tokens.includes(tr.tk)) renderTab(); };
  async function boot(){
    try {
      if (!ev || !ev.full){ const e = await fetchEvent(key); if (!root) return; ev = e; }
      loadErr = null; pickInitial(); render();
      const toks = ev.markets.slice(0, 40).flatMap(m => m.tokens);
      loadBooks(selM().tokens).then(() => { onPx(); }).catch(() => {});
      closeWS && closeWS(); closeWS = openWS(toks);
      loadTabData();
      if (ev.markets.some(m => m.closed)) checkSettle().catch(() => {});
    } catch (e){ loadErr = e; if (!ev) render(); else { pickInitial(); render(); } }
  }
  function mount(r){
    root = r; curScreen = "detail"; bindCommon(root, offs);
    pxListeners.add(onPx); tradeListeners.add(onTrade); offs.push(() => { pxListeners.delete(onPx); tradeListeners.delete(onTrade); });
    offs.push(bus.on("predict", () => { renderMine(); panel && panel.render(); }));
    if (ev){ pickInitial(); render(); }
    root.addEventListener("click", e => {
      const t = e.target;
      if (t.closest("[data-retry]")){ ev = null; render(); boot(); return; }
      if (t.closest("[data-chretry]")){ loadChart(true); return; }
      if (t.closest("[data-share]")){ const url = location.href.split("#")[0] + `#/predict/m/${encodeURIComponent(ev ? ev.slug : key)}`; if (navigator.share) navigator.share({title: ev ? ev.title : "Prediction", url}).catch(() => {}); else U.copyText(url, "Link copied"); return; }
      const tfb = t.closest("[data-tf]"); if (tfb){ tf = tfb.dataset.tf; try { sessionStorage.setItem("pd_tf", tf); } catch {} root.querySelectorAll("[data-tf]").forEach(x => x.classList.toggle("on", x === tfb)); hap(6); loadChart(true); return; }
      const ob = t.closest("[data-ob]"); if (ob){ select(+ob.dataset.ob, +ob.dataset.oi); st.side = "buy"; panel.render(); $("#pdTrade").scrollIntoView({behavior: "smooth", block: "center"}); return; }
      const so = t.closest("[data-sel]"); if (so){ select(+so.dataset.sel); return; }
      const sk = t.closest("[data-stk]"); if (sk){ st.oi = +sk.dataset.stk; st.side = "buy"; hap(10); panel.render(); renderTab(); const tp = $("#pdTrade"); tp.scrollIntoView({behavior: "smooth", block: "center"}); setTimeout(() => { const a = tp.querySelector("[data-amt]"); a && a.focus({preventScroll: true}); }, 350); return; }
      const tb = t.closest("[data-tab]"); if (tb){ tab = tb.dataset.tab; root.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x === tb)); hap(6); renderTab(); return; }
      const bo = t.closest("[data-bkoi]"); if (bo){ st.oi = +bo.dataset.bkoi; st.lp = null; panel.render(); renderTab(); return; }
      const bp = t.closest("[data-bkp]"); if (bp){ st.type = "limit"; st.lp = Math.round(+bp.dataset.bkp * 1000) / 10; st.side = bp.classList.contains("ask") ? "buy" : "sell"; if (st.side === "sell" && !findPos(selM().tokens[st.oi])) st.side = "buy"; hap(8); panel.render(); $("#pdTrade").scrollIntoView({behavior: "smooth", block: "center"}); return; }
      const ch = t.closest("[data-cash]"); if (ch){ const p = findPos(ch.dataset.cash); if (p) cashout(p); return; }
      const sp = t.closest("[data-sellp]"); if (sp){ const p = findPos(sp.dataset.sellp); if (p){ st.oi = p.oi; const i = ev.markets.findIndex(x => x.id === p.mid); if (i >= 0 && i !== sel) select(i, p.oi); st.side = "sell"; st.type = "market"; st.unit = "usd"; st.amt = ""; st.sh = ""; st.exact = null; panel.render(); $("#pdTrade").scrollIntoView({behavior: "smooth", block: "center"}); } return; }
      const cc = t.closest("[data-cancel]"); if (cc){ cancelOrder(cc.dataset.cancel); return; }
    });
    timers.push(setInterval(() => { if (!document.hidden) liveChart(); }, 5000));
    timers.push(setInterval(() => { if (!document.hidden && rd) updateRound(); }, 500));
    timers.push(setInterval(() => { if (!document.hidden && ev && WSN <= 0) loadBooks(selM().tokens).then(onPx).catch(() => {}); else if (!document.hidden && ev && now() - ((PX[selM().tokens[0]] || {}).t || 0) > 8000) loadBooks(selM().tokens).then(onPx).catch(() => {}); }, 6000));
    timers.push(setInterval(() => { if (!document.hidden && ev && ev.markets.some(m => Date.parse(m.end) < now())) checkSettle().catch(() => {}); }, 90000));
    let rz = 0; const onRz = () => { clearTimeout(rz); rz = setTimeout(() => series.length && drawSeries(), 200); }; addEventListener("resize", onRz); offs.push(() => removeEventListener("resize", onRz));
    boot();
  }
  function unmount(){ curScreen = null; root = null; closeWS && closeWS(); timers.forEach(clearInterval); offs.forEach(f => f()); closeAllOvl(); if (rd){ try { CH.destroy(); } catch {} } }
  return {html: cfg().enabled ? html : backHead("Market") + maint(), title: ev ? ev.title : "Prediction market", mount: cfg().enabled ? mount : () => {}, unmount};
}
async function cancelOrder(id){
  try { const r = await API.call("predict.cancel", {id}); U.fx("close"); toast(`Order cancelled${r.refund ? ": " + usd(r.refund) + " returned" : ""}`, "ok"); }
  catch (e){ U.fx("err"); toast(e.message || "Could not cancel", "bad"); }
}

/* =====================================================================================================
   Screen 2b: Full order book  (#/predict/book/<slug>/<market id>)
   ===================================================================================================== */
function bookScreen(key, mid){
  let root, ev = EV.get(key) || null, m = null, oi = 0, closeWS = null, offs = [], err = null;
  const $ = s => root ? root.querySelector(s) : null;
  const html = `<div class="pd-page">${backHead("Order Book")}<div id="pdOB"><div class="pd-ch-empty" style="height:240px"><span class="pd-spin"></span></div></div></div>`;
  function frame(){
    const box = $("#pdOB"); if (!box) return;
    if (!m){ box.innerHTML = err ? `<div class="pd-err">${ic("info", 34, 1.4)}<b>Couldn't load the order book</b><button type="button" class="btn btn-primary" data-retry>Retry</button></div>` : `<div class="pd-ch-empty" style="height:240px"><span class="pd-spin"></span></div>`; return; }
    box.innerHTML = `<section class="pd-sec pd-obtop"><a class="pd-obq" href="#/predict/m/${encodeURIComponent(ev.slug)}/${m.id}">${img(m.img || ev.img, "pd-img sm")}<span><b>${esc(ev.markets.length > 1 ? (m.gt || m.q) : ev.title)}</b>${ev.markets.length > 1 ? `<small>${esc(ev.title)}</small>` : ""}</span>${ic("chev", 16)}</a>
      <div class="pd-bk-oc">${[0, 1].map(i => `<button type="button" data-oi="${i}" class="${oi === i ? "on" : ""}">Trade ${esc(short(m.outs[i]))}</button>`).join("")}</div>
      <div class="pd-obs" id="pdObs"></div></section><section class="pd-sec" id="pdObB"></section>
      <section class="pd-sec"><h3 class="pd-h3">Recent trades <span class="pd-tag live"><i class="pd-live"></i>Live</span></h3><div id="pdObT"></div></section>
      <p class="pd-fine">Tap a price to place a limit order at that level.</p>`;
    tick(); trades();
  }
  const tick = raf(() => {
    if (!root || !m) return; const b = $("#pdObB"), s = $("#pdObs"); if (!b) return;
    const asks = levels(m, oi, "ask").slice(0, 14), bids = levels(m, oi, "bid").slice(0, 14);
    const sp = asks.length && bids.length ? asks[0][0] - bids[0][0] : null, mid2 = asks.length && bids.length ? (asks[0][0] + bids[0][0]) / 2 : outPx(m, oi);
    s.innerHTML = `<div><span>Best bid</span><b class="num up">${bids.length ? cents(bids[0][0]) : "--"}</b></div><div><span>Mid</span><b class="num">${cents(mid2)}</b></div><div><span>Best ask</span><b class="num down">${asks.length ? cents(asks[0][0]) : "--"}</b></div><div><span>Spread</span><b class="num">${sp != null ? cents(Math.max(0, sp)) : "--"}</b></div>`;
    if (!asks.length && !bids.length){ b.innerHTML = `<div class="pd-ch-empty" style="height:160px">No orders in the book</div>`; return; }
    const cum = L => { let a = 0; return L.map(([p, q]) => (a += p * q, [p, q, a])); }, A = cum(asks), B = cum(bids), mx = Math.max(A.length ? A[A.length - 1][2] : 0, B.length ? B[B.length - 1][2] : 0) || 1;
    const row = (cls, [p, q, a]) => `<div class="pd-bk-r ${cls}" data-bkp="${p}"><i style="width:${(a / mx * 100).toFixed(1)}%"></i><span class="num">${cents(p)}</span><span class="num">${fmt(q, 2)}</span><span class="num">${usd(a, 2)}</span></div>`;
    const l0 = (PX[m.tokens[oi]] || {}).last, l1 = (PX[m.tokens[1 - oi]] || {}).last, last = l0 != null ? l0 : l1 != null ? r4(1 - l1) : m.last ? (oi ? r4(1 - m.last) : m.last) : null;
    b.innerHTML = `<div class="pd-bk big"><div class="pd-bk-h"><span>Price</span><span>Shares</span><span>Total</span></div><div class="pd-bk-lbl down">Asks</div>${A.slice().reverse().map(x => row("ask", x)).join("")}
      <div class="pd-bk-mid"><span>Last <b class="num">${last != null ? cents(last) : "--"}</b></span><span>Spread <b class="num">${sp != null ? cents(Math.max(0, sp)) : "--"}</b></span></div><div class="pd-bk-lbl up">Bids</div>${B.map(x => row("bid", x)).join("")}</div>`;
  });
  function trades(){
    const box = $("#pdObT"); if (!box || !m) return;
    const list = (TRADES[m.tokens[0]] || []).concat(TRADES[m.tokens[1]] || []).sort((a, b) => b.t - a.t).slice(0, 20);
    box.innerHTML = list.length ? `<div class="pd-trs"><div class="pd-tr h"><span>Outcome</span><span>Price</span><span>Shares</span><span>Time</span></div>${list.map(t => { const o = t.tk === m.tokens[0] ? 0 : 1; return `<div class="pd-tr"><span class="${o ? "down" : "up"}">${esc(short(m.outs[o]))}</span><span class="num">${cents(t.p)}</span><span class="num">${fmt(t.s, 2)}</span><span>${new Date(t.t).toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit", second: "2-digit"})}</span></div>`; }).join("")}</div>` : `<div class="pd-fine">Waiting for trades…</div>`;
  }
  async function boot(){
    try { if (!ev || !ev.full) ev = await fetchEvent(key); if (!root) return; m = ev.markets.find(x => x.id === String(mid)) || ev.markets[0]; err = null; frame();
      await loadBooks(m.tokens); closeWS && closeWS(); closeWS = openWS(m.tokens); tick();
    } catch (e){ err = e; frame(); }
  }
  function mount(r){
    root = r; curScreen = "book";
    const onPx = tk => { if (m && m.tokens.includes(tk)) tick(); }, onTr = tr => { if (m && m.tokens.includes(tr.tk)) trades(); };
    pxListeners.add(onPx); tradeListeners.add(onTr); offs.push(() => { pxListeners.delete(onPx); tradeListeners.delete(onTr); });
    root.addEventListener("click", e => {
      if (e.target.closest("[data-retry]")){ boot(); return; }
      const o = e.target.closest("[data-oi]"); if (o){ oi = +o.dataset.oi; root.querySelectorAll("[data-oi]").forEach(x => x.classList.toggle("on", x === o)); hap(6); tick(); return; }
      const p = e.target.closest("[data-bkp]"); if (p && m){ hap(10); try { sessionStorage.setItem("pd_prefill", JSON.stringify({mid: m.id, oi, price: +p.dataset.bkp, side: p.classList.contains("ask") ? "buy" : (findPos(m.tokens[oi]) ? "sell" : "buy")})); } catch {} location.hash = `#/predict/m/${encodeURIComponent(ev.slug)}/${m.id}`; }
    });
    if (ev){ m = ev.markets.find(x => x.id === String(mid)) || ev.markets[0]; frame(); }
    boot();
  }
  function unmount(){ curScreen = null; root = null; closeWS && closeWS(); offs.forEach(f => f()); }
  return {html, title: "Order Book", mount, unmount};
}

/* =====================================================================================================
   Screen 3: Portfolio  (#/predict/portfolio)
   ===================================================================================================== */
function posMarket(p){
  const outs = p.outs && p.outs.length === 2 ? p.outs : p.oi ? ["Yes", p.outcome] : [p.outcome, "No"];
  const m = {id: p.mid, q: p.q, gt: p.title || "", tokens: p.tokens || [p.token], outs, prices: [.5, .5], bid: 0, ask: 0, last: 0, closed: false, accepting: true, tick: .01, img: p.img, end: p.end, desc: ""};
  const live = EV.get(p.slug); const lm = live && live.markets.find(x => x.id === p.mid);
  return lm ? {ev: live, m: lm} : {ev: {id: p.eid, slug: p.slug, title: p.q, img: p.img, end: p.end, markets: [m]}, m};
}
const KIND = {buy: "Bought", sell: "Sold", limit: "Limit order", fill: "Limit filled", cancel: "Cancelled", won: "Won", lost: "Lost", "perp-open": "Opened perp", "perp-close": "Closed perp", liq: "Liquidated", refund: "Perp refund"};
function histRow(h){
  const pnl = h.pnl != null && h.kind !== "buy" ? `<small class="num ${h.pnl >= 0 ? "up" : "down"}">${usdS(h.pnl)}</small>` : "";
  const what = /perp|liq|refund/.test(h.kind) ? `${esc(h.title || "")} · ${fmt(h.shares || 0, 4)} @ ${fmt(h.price || 0, 2)}` : `${h.side ? (h.side === "buy" ? "Buy " : "Sell ") : ""}<span class="${h.oi ? "down" : "up"}">${esc(short(h.outcome || ""))}</span> · ${shr(h.shares || 0)} @ ${cents(h.price || 0)}`;
  const href = h.slug ? `href="#/predict/m/${encodeURIComponent(h.slug)}"` : "";
  return `<a class="pd-hrow" ${href}><span class="pd-hk ${h.kind}">${esc(KIND[h.kind] || h.kind)}</span><div class="pd-hrow-m"><b>${esc(h.q || "")}${h.title && !/perp|liq/.test(h.kind) ? " · " + esc(h.title) : ""}</b><span class="num">${what}</span></div><div class="pd-hrow-r"><b class="num">${usd(h.amount || 0)}</b>${pnl}<small>${ago(h.t)}</small></div></a>`;
}
function portfolioScreen(){
  let root, tab = sessionStorage.getItem("pd_ptab") || "pos", closeWS = null, offs = [], timers = [];
  const $ = s => root ? root.querySelector(s) : null;
  const html = `${STRIP}${subnav("portfolio")}<div class="pd-page">${balBar()}<div class="pd-sum-card" id="pdPS"></div>
    <section class="pd-sec"><div class="pd-tabs" role="tablist" id="pdPT"></div><div id="pdPL"></div></section></div>`;
  function totals(){ const d = data(), pv = d.positions.reduce((a, p) => a + posValue(p), 0), cost = d.positions.reduce((a, p) => a + p.cost, 0), res = d.orders.reduce((a, o) => a + (o.reserved || 0), 0);
    return {pv, cost, res, un: pv - cost, total: bal() + pv + res, real: d.realized || 0}; }
  function renderSum(){
    const t = totals(), box = $("#pdPS"); if (!box) return;
    box.innerHTML = `<div class="pd-sum-top"><span>Portfolio value</span><b class="num" data-tv>${usd(t.total)}</b><small class="num ${t.un > -.005 ? "up" : "down"}" data-tu>${usdS(t.un)} unrealized</small></div>
      <div class="pd-sum-g"><div><span>Cash</span><b class="num" data-pd-bal>${usd(bal())}</b></div><div><span>Positions</span><b class="num" data-tp>${usd(t.pv)}</b></div><div><span>In orders</span><b class="num">${usd(t.res)}</b></div><div><span>Realized PnL</span><b class="num ${t.real >= 0 ? "up" : "down"}">${usdS(t.real)}</b></div></div>`;
  }
  function renderTabs(){ const d = data(); $("#pdPT").innerHTML = [["pos", `Positions (${d.positions.length})`], ["ord", `Open orders (${d.orders.length})`], ["hist", "History"]].map(([k, l]) => `<button type="button" role="tab" data-pt="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join(""); }
  function renderList(){
    const d = data(), box = $("#pdPL"); if (!box) return;
    if (tab === "pos"){
      box.innerHTML = d.positions.length ? d.positions.map(p => { const ended = Date.parse(p.end) < now();
        return `<div class="pd-prow" data-ptk="${p.token}"><a class="pd-prow-t" href="#/predict/m/${encodeURIComponent(p.slug)}/${p.mid}">${img(p.img, "pd-img sm")}<div><b>${esc(p.q)}</b><span><span class="pd-pill ${p.oi ? "no" : "yes"}">${esc(short(p.outcome))}</span>${p.title ? esc(p.title) + " · " : ""}<span class="num">${shr(p.shares)} shares · avg ${cents(p.avg)}</span></span></div></a>
          ${posGrid(p)}
          <div class="pd-prow-f"><span>${ended ? `${ic("clock", 12)}Awaiting resolution` : `${ic("clock", 12)}Ends ${esc(dShort(p.end))}`}${p.locked ? ` · <span class="num">${shr(p.locked)}</span> in orders` : ""}</span><span class="pd-prow-b">${posBtns(p)}</span></div></div>`; }).join("")
        : `<div class="pd-err">${ic("pie", 34, 1.4)}<b>No positions yet</b><span>Buy Yes or No on any market and it shows up here.</span><a class="btn btn-primary" href="#/predict">Browse markets</a></div>`;
    } else if (tab === "ord"){
      box.innerHTML = d.orders.length ? d.orders.map(o => `<div class="pd-prow"><a class="pd-prow-t" href="#/predict/m/${encodeURIComponent(o.slug)}/${o.mid}">${img(o.img, "pd-img sm")}<div><b>${esc(o.q)}</b><span><span class="pd-pill ${o.side === "buy" ? "yes" : "no"}">${o.side === "buy" ? "Buy" : "Sell"}</span>${esc(short(o.outcome))}${o.title ? " · " + esc(o.title) : ""}</span></div></a>
        <div class="pd-prow-g"><div><span>Price</span><b class="num">${cents(o.price)}</b></div><div><span>Shares</span><b class="num">${shr(o.shares)}</b></div><div><span>Total</span><b class="num">${usd(o.price * o.shares)}</b></div><div><span>Filled</span><b class="num">0%</b></div></div>
        <div class="pd-prow-f"><span>${ic("clock", 12)}Placed ${ago(o.t)} · GTC</span><button type="button" class="pd-cancel" data-cancel="${o.id}">Cancel</button></div></div>`).join("")
        : `<div class="pd-err">${ic("file", 34, 1.4)}<b>No open orders</b><span>Limit orders waiting to fill appear here.</span></div>`;
    } else {
      box.innerHTML = d.history.length ? `<div class="pd-hlist">${d.history.slice(0, 80).map(histRow).join("")}</div>` : `<div class="pd-err">${ic("history", 34, 1.4)}<b>No history</b></div>`;
    }
  }
  const tick = raf(() => { if (!root) return; const t = totals(); setTxt($("[data-tv]"), usd(t.total)); const u = $("[data-tu]"); if (u){ u.textContent = usdS(t.un) + " unrealized"; u.className = "num " + (t.un > -.005 ? "up" : "down"); } setTxt($("[data-tp]"), usd(t.pv));
    if (tab === "pos") root.querySelectorAll("[data-ptk]").forEach(r => { const p = findPos(r.dataset.ptk); if (p) posGridTick(r, p); }); });
  function live(){ const d = data(), toks = d.positions.flatMap(p => p.tokens || [p.token]).concat(d.orders.flatMap(o => o.tokens || [o.token])); closeWS && closeWS(); closeWS = toks.length ? openWS(toks) : null; loadBooks(toks).then(tick).catch(() => {}); }
  function all(){ renderSum(); renderTabs(); renderList(); }
  function mount(r){
    root = r; curScreen = "portfolio"; seed(); bindCommon(root, offs); all();
    const onPx = () => tick(); pxListeners.add(onPx); offs.push(() => pxListeners.delete(onPx));
    offs.push(bus.on("predict", () => { all(); }));
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-pt]"); if (t){ tab = t.dataset.pt; try { sessionStorage.setItem("pd_ptab", tab); } catch {} hap(6); renderTabs(); renderList(); return; }
      const ch = e.target.closest("[data-cash]"); if (ch){ const p = findPos(ch.dataset.cash); if (p) cashout(p); return; }
      const s = e.target.closest("[data-sellp]"); if (s){ const p = findPos(s.dataset.sellp); if (p){ const {ev, m} = posMarket(p); quickTrade(ev, m, p.oi, "sell"); } return; }
      const c = e.target.closest("[data-cancel]"); if (c) cancelOrder(c.dataset.cancel);
    });
    live(); checkSettle().catch(() => {});
    timers.push(setInterval(() => { if (!document.hidden){ const d = data(); loadBooks(d.positions.flatMap(p => p.tokens || [p.token])).then(tick).catch(() => {}); } }, 20000));
  }
  function unmount(){ curScreen = null; root = null; closeWS && closeWS(); timers.forEach(clearInterval); offs.forEach(f => f()); closeAllOvl(); }
  return {html, title: "Prediction portfolio", mount, unmount};
}

/* =====================================================================================================
   Screen 4: Prediction profile  (#/predict/profile)
   ===================================================================================================== */
function profileScreen(){
  let root, tf = "all", offs = [], timers = [];
  const $ = s => root ? root.querySelector(s) : null, p = store.s.profile || {};
  const html = `${STRIP}${subnav("profile")}<div class="pd-page"><section class="pd-sec pd-prof-card"><div class="pd-prof" id="pdPrH"></div><div class="pd-stats" id="pdPrS"></div></section>
    <section class="pd-sec pd-pnl"><div class="pd-pnl-h"><div><span>Profit/Loss</span><b class="num" id="pdPnlV">--</b><small id="pdPnlT"></small></div><div class="pd-tfs sm">${[["1d", "1D"], ["1w", "1W"], ["1m", "1M"], ["all", "ALL"]].map(([k, l]) => `<button type="button" data-ptf="${k}" class="${k === tf ? "on" : ""}">${l}</button>`).join("")}</div></div><div class="pd-chart" id="pdPnlC"></div></section>
    <section class="pd-sec"><h3 class="pd-h3">Activity</h3><div id="pdPrA"></div></section></div>`;
  function head(){
    const d = data(), joined = Math.min(d.joined || now(), p.joined || now());
    $("#pdPrH").innerHTML = `<div class="pd-prof-av">${window.UserAvatar ? UserAvatar(64) : nameAv(p.name, 64)}</div><div class="pd-prof-m"><h2>${esc(p.name || "Trader")}</h2><span>Joined ${new Date(joined).toLocaleDateString("en-US", {month: "short", year: "numeric"})} · <span class="pd-modetag">${modeLabel()}</span></span>${p.uid ? `<small class="num">UID ${esc(p.uid)}</small>` : ""}</div><a class="pd-ib" href="#/profile" aria-label="Edit profile">${ic("edit", 18)}</a>`;
  }
  function statsHtml(){
    const s = stats(), pl = s.realized + s.unrealized;
    $("#pdPrS").innerHTML = [["Positions value", usd(s.positionsValue)], ["Profit/Loss", `<span class="${pl >= 0 ? "up" : "down"}">${usdS(pl)}</span>`], ["Volume traded", "$" + cmp(s.volume)], ["Markets traded", fmt(s.marketsTraded, 0)], ["Biggest win", s.biggestWin > 0 ? `<span class="up">${usdS(s.biggestWin)}</span>` : "—"], ["Predictions", fmt(s.trades, 0)]]
      .map(([k, v]) => `<div><span>${k}</span><b class="num">${v}</b></div>`).join("");
    return pl;
  }
  function chart(){
    const d = data(), s = stats(), cur = s.realized + s.unrealized, start = {"1d": now() - 864e5, "1w": now() - 7 * 864e5, "1m": now() - 30 * 864e5, all: Math.min(d.joined || now(), d.pnl[0] ? d.pnl[0].t : now()) - 1}[tf];
    let base = 0; const pts = []; d.pnl.forEach(x => { if (x.t < start) base = x.v; else pts.push([x.t, x.v]); });
    const series = [[start, base]].concat(pts, [[now(), cur]]);
    const v = $("#pdPnlV"); v.textContent = usdS(cur - (tf === "all" ? 0 : base)); v.className = "num " + (cur - base >= 0 ? "up" : "down");
    $("#pdPnlT").textContent = {"1d": "Past day", "1w": "Past week", "1m": "Past month", all: "All time"}[tf];
    drawChart($("#pdPnlC"), [{pts: series, color: cur - base >= 0 ? "var(--up)" : "var(--down)", name: "PnL"}], {h: 150, fmt: v => usdS(v).replace("+", ""), zero: true, label: "Profit and loss", padR: 56});
  }
  function acts(){ const d = data(); $("#pdPrA").innerHTML = d.history.length ? `<div class="pd-hlist">${d.history.slice(0, 40).map(histRow).join("")}</div>` : `<div class="pd-err">${ic("target", 34, 1.4)}<b>No predictions yet</b><span>Your trades, wins and losses show up here.</span><a class="btn btn-primary" href="#/predict">Make a prediction</a></div>`; }
  function all(){ head(); statsHtml(); chart(); acts(); }
  function mount(r){
    root = r; curScreen = "profile"; seed(); all();
    offs.push(bus.on("predict", all));
    root.addEventListener("click", e => { const b = e.target.closest("[data-ptf]"); if (b){ tf = b.dataset.ptf; root.querySelectorAll("[data-ptf]").forEach(x => x.classList.toggle("on", x === b)); hap(6); chart(); } });
    const d = data(), toks = d.positions.flatMap(p => p.tokens || [p.token]);
    if (toks.length) loadBooks(toks).then(() => { if (root){ statsHtml(); chart(); } }).catch(() => {});
    timers.push(setInterval(() => { if (!document.hidden && root){ statsHtml(); } }, 5000));
  }
  function unmount(){ curScreen = null; root = null; timers.forEach(clearInterval); offs.forEach(f => f()); }
  return {html, title: "Prediction profile", mount, unmount};
}

/* =====================================================================================================
   Router
   ===================================================================================================== */
window.Pages = window.Pages || {};
Pages.predict = (params = []) => {
  const [a, b, c] = params, dec = s => { try { return decodeURIComponent(s); } catch { return s; } };
  const scr = a === "m" && b ? detailScreen(dec(b), c) : a === "book" && b ? bookScreen(dec(b), c) : a === "portfolio" ? portfolioScreen()
    : a === "profile" ? profileScreen() : listScreen();
  if (a === "perps") setTimeout(() => { if (/^#\/predict\/perps/.test(location.hash)) location.replace("#/predict"); }, 0);   // Perps removed (duplicated USDⓈ-M futures)
  /* the router reuses #view, so every screen gets its own root element (listeners die with it on navigation) */
  return {html: `<div class="pd-root">${scr.html}</div>`, title: scr.title, mount(view){ const r = view.querySelector(".pd-root") || view; return scr.mount(r); }, unmount(){ return scr.unmount && scr.unmount(); }};
};
})();
