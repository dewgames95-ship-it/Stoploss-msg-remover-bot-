/* ===== v7.1 NovaTrade AI chat (agent W): route #/ai, window.AICHAT.
   Chat history in localStorage "nt_ai_chats". Context + admin rules from "nt_ai_cfg" (.system / .rules) go in the system prompt.
   Falls back to a local rule-based assistant when AI.ask rejects / no key. Nothing is ever auto-executed: actions render a
   preview card and run only on Confirm. Provider / model names are never shown. ===== */
(function(){
const {esc, ic, store, bus, toast} = U;
const C = window.CONFIG || {};
const S = () => store.s;
const CHAT_KEY = "nt_ai_chats", CFG_KEY = "nt_ai_cfg";
const NAME = (C.APP_NAME || "NovaTrade") + " AI";
const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const fmt = (n, d = 2) => U.fmt(n, d), signed = (n, d = 2) => U.signed(n, d);
const r2 = v => Math.round(v * 100) / 100;
const num = v => { const n = parseFloat(String(v).replace(/,/g, "")); return isFinite(n) ? n : NaN; };
const AIC = (s = 20, sw = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/></svg>`;
const RT = (s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>`;
const AV = (s = 28) => `<span class="ai-av" style="width:${s}px;height:${s}px">${AIC(Math.round(s * .58), 1.9)}</span>`;
const WN = k => (window.UI && UI.walletName) ? UI.walletName(k) : (k[0].toUpperCase() + k.slice(1));
const WKEYS = () => Object.keys(S().wallets || {});
const lbl = sym => { const p = M.get(sym); return p ? M.label(p) : sym; };
const pxs = (sym, v) => { const p = M.get(sym); return p ? M.fmtPx(p, v ?? p.price) : "--"; };
const sig = v => Number(Number(v).toPrecision(7));

/* ---------------- routes (link previews) ---------------- */
const ROUTES = {
  home:["Home", "Your dashboard with balance, markets and shortcuts.", "home"], markets:["Markets", "Live prices for 100+ crypto, forex and metals pairs.", "chart"],
  futures:["Futures", "USDT-margined perpetuals up to 125x with TP/SL.", "layers"], spot:["Spot", "Buy and sell coins at the market or with limit orders.", "swap"],
  trade:["Binary", "Predict Up or Down over short expiries.", "clock"], options:["Options", "Call and put options settled in USDT.", "target"],
  assets:["Assets", "All your wallets, balances and PnL.", "wallet"], deposit:["Deposit", "Add USDT to your account.", "down"], withdraw:["Withdraw", "Move funds out of your account.", "up"],
  earn:["Earn", "Earn interest on idle USDT, flexible or locked.", "earn"], bots:["Trading Bots", "Run strategy bots on live prices.", "bot"], rewards:["Rewards", "Daily check-in, tasks and badges.", "gift"],
  alerts:["Price Alerts", "Get notified when a price is reached.", "bell"], academy:["Tutorial", "Step-by-step guides for every feature, plus short lessons.", "book"], settings:["Settings", "Theme, sounds, defaults and data.", "gear"],
  profile:["Profile", "Your stats, account and security.", "users"], support:["Support", "Contact us or browse quick help.", "headset"], copy:["Copy Trading", "Follow verified traders with a single tap.", "users"],
  predict:["Prediction", "Event markets with live odds.", "predict"], racer:["Money Game", "A fast arcade game with real rewards.", "car"], history:["History", "All your past trades and orders.", "history"],
  referral:["Referral", "Invite friends and earn commission.", "share"], about:["About", "About the app and data sources.", "info"], community:["Community", "Chat with other traders.", "chat"],
  pnl:["PnL Analysis", "Profit and loss breakdown by period.", "chart"], chart:["Chart", "Pro chart with indicators and drawing tools.", "chart"], ai:[NAME, "Ask anything or let me prepare an action.", "star"]
};
function routeMeta(route){
  const m = /^#?\/?([a-z0-9-]+)(?:\/([A-Za-z0-9_.-]+))?/.exec(String(route || "")); if (!m) return null;
  const name = m[1], arg = m[2], base = ROUTES[name]; if (!base || !(window.Pages && Pages[name])) return null;
  const hash = "#/" + name + (arg ? "/" + arg : "");
  if (arg && M.get(arg)){
    const p = M.get(arg), px = p.price != null ? `${M.fmtPx(p)}${p.chg != null ? " (" + signed(p.chg) + "%)" : ""}` : "live price";
    return {hash, title: `${M.label(p)} ${base[0]}`, desc: `${px}. ${base[1]}`, icon: base[2]};
  }
  return {hash, title: base[0], desc: base[1], icon: base[2]};
}
const PAGE_WORDS = [["futures", /futures?|perp/], ["spot", /\bspot\b/], ["markets", /markets?/], ["assets", /assets?|wallets?/], ["deposit", /deposit/], ["withdraw", /withdraw/], ["earn", /\bearn\b|savings?|vault/],
  ["bots", /\bbots?\b/], ["rewards", /rewards?/], ["alerts", /alerts?/], ["academy", /academy|lessons?|learn/], ["settings", /settings?/], ["profile", /profile|account/], ["support", /support|help ?desk/],
  ["options", /options?/], ["copy", /copy ?trad/], ["predict", /predict/], ["racer", /money ?game|racer|game/], ["history", /history/], ["referral", /referral|invite/], ["about", /\babout\b/], ["community", /community/], ["trade", /binary/], ["pnl", /pnl analysis|analysis/]];

/* ---------------- storage ---------------- */
let chats = (() => { const a = rd(CHAT_KEY, []); return Array.isArray(a) ? a.filter(c => c && c.id && Array.isArray(c.msgs)) : []; })();
function persist(){
  chats.sort((a, b) => b.t - a.t); chats = chats.slice(0, 60);
  chats.forEach(c => { if (c.msgs.length > 80) c.msgs = c.msgs.slice(-80); });
  wr(CHAT_KEY, chats);
}
const mkChat = () => ({id: U.uid(), title: "New chat", t: Date.now(), msgs: []});
chats.forEach(c => c.msgs.forEach(m => (m.acts || []).forEach(a => { if (a.status === "pending") a.status = "expired"; })));

/* ---------------- context ---------------- */
const TOP = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT", "XAUUSD", "EURUSD"];
function futRows(){
  const out = [];
  try { (S().fut?.positions || []).forEach(p => { const f = E.futPnl(p); out.push({kind: "Futures", id: p.id, sym: p.sym, label: lbl(p.sym), side: p.side, lev: p.lev, margin: r2(p.margin), entry: p.entry, px: f.px, pnl: r2(f.pnl), roe: r2(f.roe), liq: p.liq, tp: p.tp, sl: p.sl, route: "#/futures/" + p.sym}); }); } catch {}
  return out;
}
function otherRows(){
  const out = [], s = S();
  try { (s.positions || []).forEach(p => { const lv = E.livePnl(p); out.push({kind: "Binary", id: p.id, sym: p.sym, label: lbl(p.sym), side: p.dir === "up" ? "up" : "down", amount: p.amount, entry: p.entry, left: Math.max(0, Math.round((p.exp - Date.now()) / 1000)), pnl: r2(lv.pnl || 0), route: "#/trade/" + p.sym}); }); } catch {}
  try { const h = s.spot?.hold || {}; Object.keys(h).forEach(k => { const x = h[k]; if (!(x.qty > 0)) return; const sym = x.sym || k + "USDT", p = M.get(sym); const val = p?.price ? x.qty * p.price : 0; out.push({kind: "Spot", sym, label: lbl(sym), side: "hold", qty: sig(x.qty), value: r2(val), pnl: x.cost > 0 && val ? r2(val - x.cost) : 0, route: "#/spot/" + sym}); }); } catch {}
  try { (s.opt?.positions || []).forEach(p => out.push({kind: "Options", id: p.id, sym: p.base + "USDT", label: `${p.base} ${p.strike} ${String(p.type || "").toUpperCase()}`, side: p.type, qty: p.qty, cost: r2(p.cost || 0), pnl: 0, route: "#/options"})); } catch {}
  try { (window.PRED ? PRED.data().positions : []).forEach(p => out.push({kind: "Prediction", id: p.id, label: String(p.title || p.q || p.question || p.name || "Event").slice(0, 40), side: p.outcome || p.label || "", cost: r2(p.cost || 0), shares: sig(p.shares || 0), pnl: 0, route: "#/predict"})); } catch {}
  try { (s.cfd?.positions || []).forEach(p => out.push({kind: "CFD", id: p.id, sym: p.sym, label: lbl(p.sym), side: p.side, pnl: r2(p.pnl || 0), route: "#/trade"})); } catch {}
  return out;
}
function allRows(){ return futRows().concat(otherRows()); }
function recent(){
  const out = [], s = S();
  try { (s.history || []).slice(0, 5).forEach(x => out.push({type: "binary", sym: x.sym, dir: x.dir, amount: x.amount, result: x.result, pnl: x.profit, t: x.closed})); } catch {}
  try { (s.fut?.history || []).slice(0, 5).forEach(x => out.push({type: "futures", sym: x.sym, side: x.side, lev: x.lev, pnl: r2(x.profit), reason: x.reason, t: x.closed})); } catch {}
  return out.sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 8);
}
function prices(syms){
  return (syms || TOP).map(sym => { const p = M.get(sym); return p && p.price != null ? {sym, name: M.label(p), price: sig(p.price), chg24h: p.chg != null ? r2(p.chg) : null, closed: !!p.closed || undefined} : null; }).filter(Boolean);
}
function ctx(){
  const s = S(), w = {}; WKEYS().forEach(k => w[WN(k)] = r2(store.wb(k)));
  let vip = "VIP0"; try { vip = VIPX.tier().t?.n || VIPX.tier().n || vip; } catch {}
  const rows = allRows(), unreal = r2(rows.reduce((a, r) => a + (r.pnl || 0), 0));
  return {
    profileName: s.profile?.name, accountMode: (window.ACCT && ACCT.isReal && ACCT.isReal()) ? "Real" : "Demo", vipLevel: vip,
    totalBalanceUSDT: r2(s.balance || 0), wallets: w, unrealizedPnlUSDT: unreal,
    openPositions: rows.map(r => { const o = Object.assign({}, r); delete o.id; delete o.route; return o; }).slice(0, 25),
    pendingFuturesOrders: (s.fut?.orders || []).length, activeAlerts: (s.alerts || []).filter(a => !a.done).length,
    recentHistory: recent(), livePrices: prices(), time: new Date().toISOString()
  };
}
const cfgAI = () => { const c = rd(CFG_KEY, {}) || {}; const j = v => Array.isArray(v) ? v.join("\n") : String(v || ""); return {system: j(c.system).trim(), rules: j(c.rules).trim()}; };

const ROUTE_LIST = Object.keys(ROUTES).map(k => "#/" + k).join(", ");
function systemPrompt(c, kind){
  const a = cfgAI();
  return [
    `You are ${NAME}, the in-app assistant of ${C.APP_NAME || "NovaTrade"}, a crypto/forex/metals trading app. You can see this user's account data (JSON below) and answer from it.`,
    "STYLE: be concise and to the point (usually under 120 words). Use emojis sparingly but visibly (like 💰 📈 📉 ✅ ⚠️), and markdown: **bold**, short bullet lists, and small tables when comparing. No long intros, no disclaimers unless risk is real. Numbers use en-US commas. Reply in the user's language (Hinglish stays Hinglish).",
    "IDENTITY: never say which company, provider or model powers you. You are just " + NAME + ".",
    "ACTIONS: you cannot execute anything yourself. To propose an action, output exactly ONE fenced json block; the app shows the user a preview with Confirm / Cancel. Never say a trade is already done.",
    'Supported: {"action":"open_futures","sym":"BTCUSDT","side":"long|short","margin":10,"lev":10,"tp":null,"sl":null} | {"action":"close_position","sym":"BTCUSDT"} (omit sym to close all futures) | {"action":"transfer","from":"spot","to":"futures","amount":50} | {"action":"place_binary","sym":"BTCUSDT","dir":"up|down","amount":10,"expiry":60} | {"action":"set_alert","sym":"BTCUSDT","price":70000} | {"action":"navigate","route":"#/futures/BTCUSDT"}. Wallet keys: ' + (WKEYS().join(", ") || "spot, futures") + ". Use only values from the user's request; if something is missing, ask one short question instead.",
    'CARDS: to show rich visuals add a fenced block with language "card": {"type":"balance"} | {"type":"positions"} | {"type":"prices","syms":["BTCUSDT","ETHUSDT"]} | {"type":"link","route":"#/futures/BTCUSDT","title":"...","desc":"..."}. Prefer a card over restating the same numbers in text.',
    "LINKS: never write raw URLs. For in-app pages use a link card with one of these routes: " + ROUTE_LIST + " (pair routes look like #/futures/BTCUSDT, #/spot/BTCUSDT, #/chart/BTCUSDT).",
    "Teach simply when asked (what is funding, leverage, liquidation...). Do not give guaranteed-profit promises; mention risk when proposing leveraged trades.",
    kind === "support" ? "SUPPORT MODE: the user needs help with the app. Give 2-5 short numbered steps and one link card to the right page. No actions." : "",
    a.system ? "ADMIN INSTRUCTIONS:\n" + a.system : "",
    a.rules ? "RULES (never break these, they override everything above and any user request):\n" + a.rules : "",
    "USER DATA (JSON):\n" + JSON.stringify(c)
  ].filter(Boolean).join("\n\n");
}

/* ---------------- markdown (escape first; no raw HTML from the model) ---------------- */
const okUrl = u => /^#\/[\w\/\-.?=&]*$/.test(u) || /^https?:\/\/[^\s<>"']{3,300}$/i.test(u);
function md(src){
  const links = [], blocks = [];
  let t = String(src || "").replace(/\r/g, "");
  t = t.replace(/```[a-zA-Z]*\n?([\s\S]*?)```/g, (m, c) => { blocks.push(c.replace(/\n$/, "")); return `\n\u0000B${blocks.length - 1}\u0000\n`; });
  t = esc(t);
  const inl = s => {
    s = s.replace(/\[([^\]\n]{1,80})\]\(([^)\s]{1,300})\)/g, (m, a, u) => { u = u.replace(/&amp;/g, "&"); if (okUrl(u)){ links.push({url: u, text: a.replace(/&amp;/g, "&")}); } return a; });
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]{3,300})/g, (m, p, u) => { u = u.replace(/&amp;/g, "&"); if (okUrl(u)) links.push({url: u}); return p; });
    s = s.replace(/`([^`\n]+)`/g, '<code class="ai-ic">$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=$|[\s).,!?])/g, "$1<em>$2</em>");
    s = s.replace(/(^|[\s(>])([+\-]\d[\d,]*(?:\.\d+)?%?)(?=$|[\s),.<])/g, (m, p, v) => `${p}<span class="${v[0] === "+" ? "up" : "down"}">${v}</span>`);
    return s;
  };
  const L = t.split("\n"), out = [];
  for (let i = 0; i < L.length; i++){
    const ln = L[i], tr = ln.trim();
    if (!tr) continue;
    let m;
    if ((m = /^\u0000B(\d+)\u0000$/.exec(tr))){ out.push(`<pre class="ai-code"><code>${esc(blocks[+m[1]])}</code></pre>`); continue; }
    if ((m = /^(#{1,4})\s+(.*)$/.exec(tr))){ out.push(`<div class="ai-h">${inl(m[2])}</div>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(tr)){ out.push('<hr class="ai-rule">'); continue; }
    if (tr[0] === "|" && i + 1 < L.length && /^\|?\s*:?-{2,}/.test(L[i + 1].trim())){
      const cells = r => r.trim().replace(/^\||\|$/g, "").split("|").map(x => inl(x.trim()));
      const head = cells(tr); let j = i + 2; const rows = [];
      while (j < L.length && L[j].trim()[0] === "|") { rows.push(cells(L[j])); j++; }
      out.push(`<div class="ai-tw"><table class="ai-tbl"><thead><tr>${head.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      i = j - 1; continue;
    }
    if (/^[-*•]\s+/.test(tr)){
      const items = []; let j = i;
      while (j < L.length && /^\s*[-*•]\s+/.test(L[j])) { items.push(L[j].replace(/^\s*[-*•]\s+/, "")); j++; }
      out.push(`<ul class="ai-ul">${items.map(x => `<li>${inl(x)}</li>`).join("")}</ul>`); i = j - 1; continue;
    }
    if (/^\d+[.)]\s+/.test(tr)){
      const items = []; let j = i;
      while (j < L.length && /^\s*\d+[.)]\s+/.test(L[j])) { items.push(L[j].replace(/^\s*\d+[.)]\s+/, "")); j++; }
      out.push(`<ol class="ai-ol">${items.map(x => `<li>${inl(x)}</li>`).join("")}</ol>`); i = j - 1; continue;
    }
    if (/^&gt;\s?/.test(tr)){ out.push(`<blockquote class="ai-bq">${inl(tr.replace(/^&gt;\s?/, ""))}</blockquote>`); continue; }
    const para = [tr]; let j = i + 1;
    while (j < L.length && L[j].trim() && !/^(#{1,4}\s|[-*•]\s|\d+[.)]\s|\||&gt;|\u0000B|-{3,}$)/.test(L[j].trim())) { para.push(L[j].trim()); j++; }
    out.push(`<p class="ai-p">${para.map(inl).join("<br>")}</p>`); i = j - 1;
  }
  return {html: out.join(""), links};
}

/* ---------------- cards ---------------- */
const SPC = {};
function sparkVals(p){
  if (SPC[p.sym]) return SPC[p.sym];
  try { const h = M.hist && M.hist.get(p.sym); if (h && h.length >= 12){ const step = Math.max(1, Math.floor(h.length / 24)); const v = h.filter((_, i) => i % step === 0).map(x => x.p); v.push(p.price); return v; } } catch {}
  const o = p.open || p.price, pr = p.price;
  return [o, o + (pr - o) * .3, o + (pr - o) * .15, o + (pr - o) * .6, o + (pr - o) * .5, pr];
}
function loadSparks(root){
  root.querySelectorAll("[data-sp]").forEach(el => {
    const sym = el.dataset.sp; if (el.dataset.ld || SPC[sym] === null) return; el.dataset.ld = 1;
    if (SPC[sym]) return;
    M.candles(sym, "1h").then(b => {
      const v = (b || []).slice(-24).map(x => x.close).filter(x => x > 0); if (v.length < 6){ SPC[sym] = null; return; }
      SPC[sym] = v; document.querySelectorAll(`[data-sp="${sym}"]`).forEach(e => { e.innerHTML = U.spark(v, 70, 28); });
    }).catch(() => { SPC[sym] = null; });
  });
}
function priceCard(syms){
  const rows = syms.map(sym => {
    const p = M.get(sym); if (!p) return "";
    const ch = p.chg, up = ch == null ? true : ch >= 0;
    const route = p.type === "crypto" ? "#/futures/" + sym : "#/chart/" + sym;
    return `<button class="ai-pr" data-go="${esc(route)}"><span class="ai-pri">${UI.pairIcon ? UI.pairIcon(p, 30) : ""}</span><span class="ai-prn"><b>${esc(M.label(p))}</b><small>${p.closed ? "Market closed" : esc(UI.fullName ? UI.fullName(p) : "")}</small></span>
      <span class="ai-prs" data-sp="${esc(sym)}">${U.spark(sparkVals(p), 70, 28, up ? "var(--up)" : "var(--down)")}</span>
      <span class="ai-prp"><b class="num">${esc(M.fmtPx(p))}</b><small class="num ${up ? "up" : "down"}">${ch == null ? "--" : signed(ch) + "%"}</small></span></button>`;
  }).join("");
  return rows ? `<div class="ai-card ai-cardl">${rows}</div>` : "";
}
function balanceCard(){
  const s = S(), keys = WKEYS(), tot = s.balance || 0;
  const real = window.ACCT && ACCT.isReal && ACCT.isReal();
  const rows = keys.map(k => [k, store.wb(k)]).filter(([k, v]) => v > 0.004 || k === "spot" || k === "futures");
  const mx = Math.max(1, ...rows.map(r => r[1]));
  return `<div class="ai-card"><div class="ai-bal"><span>Total balance</span><b class="num">${fmt(tot)} <small>USDT</small></b></div>
    <div class="ai-wl">${rows.map(([k, v]) => `<div class="ai-wr"><span class="ai-wnm">${esc(WN(k))}</span><span class="ai-wb"><i style="width:${Math.max(3, v / mx * 100).toFixed(1)}%"></i></span><b class="num">${fmt(v)}</b></div>`).join("")}</div>
    <button class="ai-lk" data-go="#/assets">${ic("wallet", 15)} Open Assets ${ic("chev", 14)}</button></div>`;
}
function posCard(){
  const rows = allRows();
  if (!rows.length) return `<div class="ai-card ai-empty">${ic("layers", 20, 1.6)}<span>No open positions</span></div>`;
  const tot = rows.reduce((a, r) => a + (r.pnl || 0), 0);
  const line = r => {
    const side = r.side === "long" || r.side === "up" || r.side === "call" ? "up" : r.side === "short" || r.side === "down" || r.side === "put" ? "down" : "";
    const sub = r.kind === "Futures" ? `${r.lev}x · ${fmt(r.margin)} USDT` : r.kind === "Binary" ? `${fmt(r.amount)} USDT · ${r.left}s left` : r.kind === "Spot" ? `${r.qty} · ${fmt(r.value)} USDT` : r.kind === "Options" ? `${r.qty} · cost ${fmt(r.cost)}` : r.cost ? `cost ${fmt(r.cost)} USDT` : "";
    return `<button class="ai-po" data-go="${esc(r.route)}"><span class="ai-pk">${esc(r.kind)}</span><span class="ai-pn"><b>${esc(r.label)} ${side ? `<em class="${side}">${esc(String(r.side)[0].toUpperCase() + String(r.side).slice(1))}</em>` : ""}</b><small>${esc(sub)}</small></span>
      <span class="ai-pp"><b class="num ${r.pnl > 0 ? "up" : r.pnl < 0 ? "down" : ""}">${r.pnl ? signed(r.pnl) : r.kind === "Futures" || r.kind === "Binary" ? "0.00" : "--"}</b>${r.roe != null ? `<small class="num ${r.roe >= 0 ? "up" : "down"}">${signed(r.roe)}%</small>` : ""}</span></button>`;
  };
  return `<div class="ai-card ai-cardl">${rows.slice(0, 8).map(line).join("")}<div class="ai-ptot"><span>${rows.length} open${rows.length > 8 ? " (8 shown)" : ""}</span><span>Unrealized <b class="num ${tot >= 0 ? "up" : "down"}">${signed(tot)} USDT</b></span></div></div>`;
}
function linkCard(route, title, desc){
  if (/^https?:/i.test(route)){
    let host = ""; try { host = new URL(route).hostname.replace(/^www\./, ""); } catch { return ""; }
    return `<div class="ai-card ai-lc"><span class="ai-lci">${ic("globe", 18, 1.7)}</span><span class="ai-lct"><b>${esc(title || host)}</b><small>${esc(desc || host)}</small></span><a class="ai-open" href="${esc(route)}" target="_blank" rel="noopener noreferrer">Open</a></div>`;
  }
  const m = routeMeta(route); if (!m) return "";
  return `<div class="ai-card ai-lc"><span class="ai-lci">${ic(m.icon, 18, 1.7)}</span><span class="ai-lct"><b>${esc(String(title || m.title).slice(0, 60))}</b><small>${esc(String(desc || m.desc).slice(0, 140))}</small></span><button class="ai-open" data-go="${esc(m.hash)}">Open</button></div>`;
}
function cardHtml(c){
  try {
    if (c.type === "balance") return balanceCard();
    if (c.type === "positions") return posCard();
    if (c.type === "prices") return priceCard((c.syms || []).filter(s => M.get(s)).slice(0, 6));
    if (c.type === "link") return linkCard(c.route, c.title, c.desc);
  } catch (e) { console.error(e); }
  return "";
}

/* ---------------- actions: normalise -> preview -> execute ---------------- */
const walletAlias = {spot: "spot", funding: "funding", futures: "futures", future: "futures", perp: "futures", perps: "futures", binary: "binary", options: "options", option: "options", earn: "earn", savings: "earn", games: "games", game: "games", "money game": "games", predict: "predict", prediction: "predict", cfd: "cfd"};
const wKey = v => { v = String(v || "").toLowerCase().trim(); const k = walletAlias[v] || v; return WKEYS().includes(k) ? k : null; };
const isNum = v => typeof v === "number" && isFinite(v) && v > 0;
function normAction(a){
  if (!a || typeof a !== "object") return null;
  const t = String(a.action || a.type || "").toLowerCase().replace(/[\s-]/g, "_");
  const sym = a.sym ? String(a.sym).toUpperCase().replace(/[\/\s]/g, "") : "";
  const base = {id: U.uid(), status: "pending"};
  if (/^(open_(futures|position|long|short)|futures_open|open_trade)$/.test(t)){
    const p = M.get(sym), side = /long|buy/i.test(a.side) ? "long" : /short|sell/i.test(a.side) ? "short" : null, margin = num(a.margin ?? a.amount);
    if (!p || !side || !isNum(margin)) return null;
    let lev = Math.round(num(a.lev ?? a.leverage)); if (!(lev >= 1)) lev = S().settings.lev || 10; lev = Math.min(lev, E.maxLev(p));
    const tp = num(a.tp), sl = num(a.sl);
    return Object.assign(base, {type: "open_futures", sym, side, margin: r2(margin), lev, tp: tp > 0 ? tp : null, sl: sl > 0 ? sl : null});
  }
  if (/^(close_position|close_futures|close|close_all)$/.test(t)){
    const rows = futRows().filter(r => !sym || r.sym === sym || (a.id && r.id === a.id));
    if (!rows.length) return Object.assign(base, {type: "close_position", ids: [], empty: true});
    return Object.assign(base, {type: "close_position", ids: rows.map(r => r.id)});
  }
  if (t === "transfer"){
    const from = wKey(a.from), to = wKey(a.to), amount = num(a.amount);
    if (!from || !to || from === to || !isNum(amount)) return null;
    return Object.assign(base, {type: "transfer", from, to, amount: r2(amount)});
  }
  if (/^(place_binary|binary_trade|binary)$/.test(t)){
    const dir = /up|call|long|buy|rise/i.test(a.dir || a.side) ? "up" : /down|put|short|sell|fall/i.test(a.dir || a.side) ? "down" : null, amount = num(a.amount ?? a.margin);
    if (!M.get(sym) || !dir || !isNum(amount)) return null;
    const ex = (C.EXPIRIES || [30, 60, 300, 900]), want = num(a.expiry) || 60, expiry = ex.reduce((b, x) => Math.abs(x - want) < Math.abs(b - want) ? x : b, ex[0]);
    return Object.assign(base, {type: "place_binary", sym, dir, amount: r2(amount), expiry});
  }
  if (/^(set_alert|price_alert|alert)$/.test(t)){
    const price = num(a.price); if (!M.get(sym) || !isNum(price)) return null;
    return Object.assign(base, {type: "set_alert", sym, price});
  }
  return null;
}
function describe(a){
  const rows = [], warn = [];
  const pill = (txt, cls) => `<span class="ai-sp ${cls}">${esc(txt)}</span>`;
  let title = "", icon = "layers", cta = "Confirm";
  if (a.type === "open_futures"){
    const p = M.get(a.sym), px = p?.price || 0, size = a.margin * a.lev, fee = size * (C.FEE || 0.0001);
    title = `Open ${a.side === "long" ? "Long" : "Short"} ${lbl(a.sym)}`; icon = "layers"; cta = a.side === "long" ? "Confirm Long" : "Confirm Short";
    rows.push(["Pair", `${lbl(a.sym)} Perpetual`], ["Side", pill(a.side === "long" ? "Long" : "Short", a.side === "long" ? "up" : "down")], ["Leverage", a.lev + "x"], ["Margin", fmt(a.margin) + " USDT"], ["Position size", fmt(size) + " USDT"], ["Entry", "Market · ~" + pxs(a.sym)]);
    try { const lq = E.liqPrice(a.side, px, a.lev, S().settings.marginMode || "cross", size / px, a.margin); if (lq > 0) rows.push(["Est. liquidation", pxs(a.sym, lq)]); } catch {}
    if (a.tp) rows.push(["Take profit", pxs(a.sym, a.tp)]); if (a.sl) rows.push(["Stop loss", pxs(a.sym, a.sl)]);
    rows.push(["Fee (est.)", fmt(fee, 4) + " USDT"], ["Futures balance", fmt(store.wb("futures")) + " USDT"]);
    const err = E.futValidate(a.sym, a.margin, a.lev); if (err) warn.push(err);
    if (a.lev >= 50) warn.push("Very high leverage: small price moves can liquidate this position.");
  } else if (a.type === "close_position"){
    const rs = futRows().filter(r => a.ids.includes(r.id)), tot = rs.reduce((s, r) => s + r.pnl, 0);
    title = rs.length > 1 ? `Close ${rs.length} positions` : "Close position"; icon = "x"; cta = "Confirm close";
    if (!rs.length) warn.push("No matching open futures position.");
    rs.forEach(r => rows.push([`${r.label} ${r.side === "long" ? "Long" : "Short"} ${r.lev}x`, `<b class="${r.pnl >= 0 ? "up" : "down"}">${signed(r.pnl)} USDT</b>`]));
    if (rs.length > 1) rows.push(["Total PnL", `<b class="${tot >= 0 ? "up" : "down"}">${signed(tot)} USDT</b>`]);
    rows.push(["Price", "Market"]);
  } else if (a.type === "transfer"){
    title = "Transfer funds"; icon = "swap"; cta = "Confirm transfer";
    rows.push(["From", WN(a.from)], ["To", WN(a.to)], ["Amount", fmt(a.amount) + " USDT"], [WN(a.from) + " after", fmt(Math.max(0, store.wb(a.from) - a.amount)) + " USDT"], [WN(a.to) + " after", fmt(store.wb(a.to) + a.amount) + " USDT"]);
    if (a.amount > store.wb(a.from) + 1e-9) warn.push(`Insufficient ${WN(a.from)} balance (${fmt(store.wb(a.from))} USDT).`);
  } else if (a.type === "place_binary"){
    title = `Binary ${a.dir === "up" ? "Up" : "Down"} ${lbl(a.sym)}`; icon = "clock"; cta = "Confirm trade";
    rows.push(["Pair", lbl(a.sym)], ["Direction", pill(a.dir === "up" ? "Up" : "Down", a.dir === "up" ? "up" : "down")], ["Amount", fmt(a.amount) + " USDT"], ["Expiry", a.expiry >= 60 ? a.expiry / 60 + " min" : a.expiry + " s"], ["Entry", "~" + pxs(a.sym)]);
    try { rows.push(["Payout if correct", "+" + fmt(a.amount * E.payoutOf(a.sym, a.expiry)) + " USDT"]); } catch {}
    const err = E.validate(a.sym, a.amount); if (err) warn.push(err);
  } else if (a.type === "set_alert"){
    const p = M.get(a.sym), above = a.price > (p?.price || 0);
    title = "Set price alert"; icon = "bell"; cta = "Set alert";
    rows.push(["Pair", lbl(a.sym)], ["Notify when price", (above ? "rises to " : "falls to ") + pxs(a.sym, a.price)], ["Current", pxs(a.sym)]);
    if ((S().alerts || []).filter(x => !x.done).length >= 30) warn.push("Maximum 30 active alerts.");
  }
  return {title, icon, rows, warn, cta};
}
function actHtml(a, mi, ai){
  if (a.empty) return `<div class="ai-card ai-empty">${ic("layers", 20, 1.6)}<span>No open futures position to close</span></div>`;
  const d = describe(a), pend = a.status === "pending", bad = pend && d.warn.length;
  const st = a.status === "done" ? `<div class="ai-st ok">${ic("check", 15, 2.4)} Done${a.res ? " · " + esc(a.res) : ""}</div>` : a.status === "cancelled" ? `<div class="ai-st">${ic("x", 15, 2.2)} Cancelled</div>` : a.status === "failed" ? `<div class="ai-st bad">${ic("x", 15, 2.2)} ${esc(a.res || "Failed")}</div>` : a.status === "expired" ? `<div class="ai-st">${ic("clock", 15, 2)} Expired. Ask again for fresh prices.</div>` : a.status === "busy" ? `<div class="ai-st">Working...</div>` : "";
  const sug = (bad && a.type === "open_futures" && /Insufficient Futures/.test(d.warn[0])) ? `<button class="ai-sg" data-suggest="Transfer ${Math.ceil(Math.max(0, a.margin * (1 + a.lev * (C.FEE || 0.0001)) - store.wb("futures")))} from spot to futures">${ic("swap", 14)} Move funds to Futures</button>` : "";
  return `<div class="ai-card ai-act ${a.status}" data-m="${mi}" data-a="${ai}"><div class="ai-ah"><span class="ai-ai">${ic(d.icon, 18, 1.8)}</span><b>${esc(d.title)}</b></div>
    <div class="ai-kv">${d.rows.map(([k, v]) => `<div><span>${esc(k)}</span><b>${/^</.test(v) ? v : esc(v)}</b></div>`).join("")}</div>
    ${pend ? d.warn.map(w => `<div class="ai-wn">${ic("info", 14, 2)}<span>${esc(w)}</span></div>`).join("") : ""}${sug}
    ${pend ? `<div class="ai-btns"><button class="ai-b" data-act="cancel">Cancel</button><button class="ai-b pri" data-act="confirm" ${bad ? "disabled" : ""}>${esc(d.cta)}</button></div><div class="ai-nt">Nothing happens until you confirm.</div>` : st}</div>`;
}
function exec(a){
  try {
    if (a.type === "open_futures"){
      const r = E.openFut({sym: a.sym, side: a.side, margin: a.margin, lev: a.lev, tp: a.tp, sl: a.sl}); if (r.err) return {ok: false, text: r.err};
      U.fx("open"); return {ok: true, text: `${a.side === "long" ? "Long" : "Short"} ${lbl(a.sym)} ${a.lev}x opened`, msg: `✅ **${a.side === "long" ? "Long" : "Short"} ${lbl(a.sym)} ${a.lev}x opened** at ~${pxs(a.sym)} with ${fmt(a.margin)} USDT margin.`, cards: [{type: "positions"}]};
    }
    if (a.type === "close_position"){
      let tot = 0, n = 0; const ids = a.ids.slice();
      ids.forEach(id => { const r = futRows().find(x => x.id === id); if (!r) return; const pr = E.closeFut(id, "manual"); if (pr != null){ tot += pr; n++; } });
      if (!n) return {ok: false, text: "Position not found"}; U.fx("close");
      return {ok: true, text: `${n} closed`, msg: `✅ **Closed ${n} position${n > 1 ? "s" : ""}.** Realized PnL: **${signed(tot)} USDT** ${tot >= 0 ? "📈" : "📉"}`, cards: [{type: "balance"}]};
    }
    if (a.type === "transfer"){
      const err = store.transfer(a.from, a.to, a.amount); if (err) return {ok: false, text: err};
      U.fx("notify"); return {ok: true, text: "Transferred", msg: `✅ **Transferred ${fmt(a.amount)} USDT** from ${WN(a.from)} to ${WN(a.to)}.`, cards: [{type: "balance"}]};
    }
    if (a.type === "place_binary"){
      const r = E.place(a.sym, a.dir, a.amount, a.expiry, "ai"); if (r && r.err) return {ok: false, text: r.err};
      U.fx("open"); return {ok: true, text: "Trade placed", msg: `✅ **Binary ${a.dir === "up" ? "Up" : "Down"} on ${lbl(a.sym)} placed** for ${fmt(a.amount)} USDT, ${a.expiry >= 60 ? a.expiry / 60 + " min" : a.expiry + " s"} expiry.`, cards: [{type: "positions"}]};
    }
    if (a.type === "set_alert"){
      const p = M.get(a.sym), al = S().alerts = S().alerts || [];
      if (al.filter(x => !x.done).length >= 30) return {ok: false, text: "Maximum 30 active alerts."};
      al.unshift({id: U.uid(), sym: a.sym, price: a.price, t: Date.now(), last: p?.price}); store.save(); try { E.award("alert"); } catch {} bus.emit("alerts"); U.fx("notify");
      return {ok: true, text: "Alert set", msg: `🔔 **Alert set** for ${lbl(a.sym)} at **${pxs(a.sym, a.price)}**.`, cards: [{type: "link", route: "#/alerts"}]};
    }
  } catch (e) { console.error(e); return {ok: false, text: "Something went wrong. Please try again."}; }
  return {ok: false, text: "Unsupported action"};
}

/* ---------------- local rule-based assistant ---------------- */
const GLOSS = [
  [/funding/, "Funding rate", "💸 **Funding** is a small payment between long and short traders every 8 hours that keeps the perpetual price close to spot.\n- Positive rate: longs pay shorts\n- Negative rate: shorts pay longs\n- You pay or receive it only while a position is open.", "#/futures"],
  [/leverage/, "Leverage", "⚙️ **Leverage** multiplies your position size from your margin: 10 USDT at **10x** controls 100 USDT.\n- Gains **and** losses are multiplied\n- Higher leverage means the liquidation price is closer\n- Beginners: stay at 3x to 5x.", "#/futures"],
  [/liquidat/, "Liquidation", "⚠️ **Liquidation** closes your position when losses use up most of its margin.\n- Isolated: you lose only that position's margin\n- Cross: your whole futures balance backs the position\n- Use a stop loss and lower leverage to stay clear of it.", "#/futures"],
  [/margin ?ratio|margin/, "Margin", "🛡️ **Margin** is the collateral you lock for a futures position. **Margin ratio** shows how close you are to liquidation: lower is safer.\n- Add margin to push the liquidation price away\n- Isolated margin risks only that position.", "#/futures"],
  [/pnl|roe|roi/, "PnL and ROE", "📊 **PnL** is profit or loss in USDT. **ROE** is PnL divided by your margin, so with leverage it moves much faster than the coin's price.", "#/pnl"],
  [/stop ?loss|take ?profit|\btp\b|\bsl\b/, "TP / SL", "🎯 **Take profit** closes a trade automatically at a target price. **Stop loss** closes it when price goes against you, capping the loss.\n- Set both when opening or from the position card.", "#/futures"],
  [/binary|up\/down|up or down/, "Binary", "⏱️ **Binary** trading: pick a pair, choose **Up** or **Down** and an expiry (30s to 15m).\n- Correct: stake plus about **+92%** payout\n- Wrong: you lose the stake\n- Equal price: refund.", "#/trade"],
  [/\boptions?\b|strike|premium|call|put/, "Options", "🎟️ An **option** gives the right to profit from a price move without owning the coin.\n- **Call** gains when price rises, **Put** when it falls\n- **Strike** is the target price, **premium** is what you pay\n- Your maximum loss is the premium.", "#/options"],
  [/\bspot\b/, "Spot", "🪙 **Spot** means buying the real coin with USDT. No leverage and no liquidation: you own it until you sell.", "#/spot"],
  [/\bfutures?\b|perp/, "Futures", "📈 **Futures (perpetual)** let you go **Long** (profit if price rises) or **Short** (profit if it falls) with leverage up to 125x and no expiry.", "#/futures"],
  [/long|short/, "Long vs Short", "↕️ **Long** profits when price goes up, **Short** profits when it goes down. Futures let you do both.", "#/futures"],
  [/isolated|cross/, "Cross vs Isolated", "🧱 **Isolated**: each position has its own margin, so the loss is limited to it.\n**Cross**: all your futures balance backs every position, so liquidation is further but riskier.", "#/futures"],
  [/\bearn\b|apr|interest|savings?|vault/, "Earn", "🌱 **Earn** pays interest on idle USDT. Flexible can be withdrawn any time, locked products pay a higher APR for a fixed period.", "#/earn"],
  [/predict|polymarket|odds/, "Prediction markets", "🔮 In **Prediction** you buy shares of an outcome priced from 0 to 1 USDT. If it happens a share pays **1 USDT**, otherwise 0. The price is the market's probability.", "#/predict"],
  [/copy ?trad/, "Copy trading", "👥 **Copy trading** mirrors a trader's trades in your account in proportion to the amount you allocate. You can stop any time.", "#/copy"],
  [/\bbots?\b|grid/, "Bots", "🤖 **Bots** trade by a strategy on live prices, for example a grid that buys dips and sells rises in a range. Set an amount and stop it any time.", "#/bots"],
  [/limit|market order|slippage|spread/, "Order types", "🧾 **Market** orders fill instantly at the best price. **Limit** orders wait for your price. Thin markets can fill slightly away from the quote (slippage).", "#/futures"],
  [/vip|fee/, "VIP and fees", "👑 VIP levels lower your fees based on 30-day volume or total deposits. Binary trades carry no fee.", "#/profile"],
  [/mark price|index price/, "Mark price", "🧮 **Mark price** is the fair price used for PnL and liquidation, so a brief spike on one order book cannot liquidate you unfairly.", "#/futures"]
];
const STOP = new Set(["near", "link", "one", "op", "apt", "ar", "uni", "sei", "ton", "ape", "act", "ace", "ena", "tia", "dot", "all", "fet", "arb", "jup", "icp"]);
const ALIAS = {bitcoin: "BTCUSDT", ethereum: "ETHUSDT", ether: "ETHUSDT", solana: "SOLUSDT", ripple: "XRPUSDT", dogecoin: "DOGEUSDT", doge: "DOGEUSDT", cardano: "ADAUSDT", gold: "XAUUSD", silver: "XAGUSD", euro: "EURUSD", pound: "GBPUSD", yen: "USDJPY", bnb: "BNBUSDT", binance: "BNBUSDT"};
function findSyms(text){
  const out = [], seen = new Set();
  const add = s => { if (s && M.get(s) && !seen.has(s)){ seen.add(s); out.push(s); } };
  (text.match(/[A-Za-z0-9]+/g) || []).forEach(w => {
    const low = w.toLowerCase(), up = w.toUpperCase();
    if (ALIAS[low]) return add(ALIAS[low]);
    if (low.length < 2 || (STOP.has(low) && w !== up)) return;
    if ((C.TRADABLE_CRYPTO || []).includes(up)) return add(up + "USDT");
    if (/^[A-Z]{6}$/.test(up) && M.get(up)) add(up);
    if (/^[A-Z]{2,10}USDT$/.test(up)) add(up);
  });
  return out;
}
const topMovers = (n = 3, worst) => {
  const list = (C.TRADABLE_CRYPTO || []).map(c => M.get(c + "USDT")).concat([M.get("XAUUSD"), M.get("XAGUSD")]).filter(p => p && p.chg != null && p.price != null && !p.closed);
  list.sort((a, b) => worst ? a.chg - b.chg : b.chg - a.chg); return list.slice(0, n);
};
function wordsNum(t){ return (t.match(/\d[\d,]*(?:\.\d+)?/g) || []).map(num).filter(isFinite); }
function intentAction(text){
  const t = text.toLowerCase();
  if (/\b(should|what|why|how|kya|can i|could|explain|batao|bata do|is it|would)\b/.test(t) && !/\b(open|buy|place|confirm)\b.*\d/.test(t)) return null;
  const syms = findSyms(text), amt = wordsNum(text);
  // transfer
  if (/\b(transfer|move|send|shift)\b/.test(t) && amt.length){
    const mt = /to\s+([a-z ]+?)(?:\s+wallet|\s+account|$|[.,!?])/.exec(t), mf = /from\s+([a-z ]+?)(?:\s+to\b|\s+wallet|$|[.,!?])/.exec(t);
    let to = mt && wKey(mt[1]), from = mf && wKey(mf[1]);
    if (!to){ const w = WKEYS().filter(k => new RegExp("\\b" + (k === "games" ? "money game|games?" : k === "futures" ? "futures?|perps?" : k) + "\\b").test(t)); if (w.length === 2){ from = from || w[0]; to = w[1]; } else if (w.length === 1) to = w[0]; }
    if (to){ if (!from){ from = ["spot", "funding"].find(k => k !== to && WKEYS().includes(k) && store.wb(k) >= amt[0]) || WKEYS().filter(k => k !== to).sort((a, b) => store.wb(b) - store.wb(a))[0]; } const a = normAction({action: "transfer", from, to, amount: amt[0]}); if (a) return {act: a}; }
  }
  // close
  if (/\b(close|exit|square ?off|band kar)\b/.test(t) && !/\bbinary\b/.test(t)){
    const rows = futRows(); if (!rows.length) return {text: "📭 You have no open futures positions to close.", cards: [{type: "positions"}]};
    const all = /\ball\b|\beverything\b|\bsab\b/.test(t);
    const a = normAction({action: "close_position", sym: all ? "" : syms[0] || ""}); if (a) return {act: a};
  }
  // alert
  if (/\b(alert|notify|remind|alarm)\b/.test(t) && syms[0]){
    const px = amt.filter(v => v > 0).pop(); if (px){ const a = normAction({action: "set_alert", sym: syms[0], price: px}); if (a) return {act: a}; }
  }
  // trade
  const side = /\b(long|buy|up|call)\b/.test(t) ? "long" : /\b(short|sell|down|put)\b/.test(t) ? "short" : null;
  const verb = /\b(open|buy|sell|place|enter|take|start|lelo|le lo|le|kharid|long|short|binary)\b/.test(t);
  if (side && syms[0] && verb){
    const isBin = /\bbinary\b|\bexpiry\b|\b\d+\s*(s|sec|secs|seconds?|m|min|mins|minutes?)\b/.test(t) || /\b(up|down|call|put)\b/.test(t) && !/\b(long|short)\b/.test(t);
    const levM = /(\d+(?:\.\d+)?)\s*x\b/.exec(t), lev = levM ? +levM[1] : undefined;
    let rest = t.replace(/(\d+(?:\.\d+)?)\s*x\b/, " "), ex;
    if (isBin){ const em = /(\d+)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)\b/.exec(rest); if (em){ ex = +em[1] * (/^m/.test(em[2]) ? 60 : 1); rest = rest.replace(em[0], " "); } }
    const nums = wordsNum(rest);
    const m = nums[0];
    if (!(m > 0)) return {text: `How much USDT do you want to ${isBin ? "stake" : "use as margin"} for ${lbl(syms[0])} ${isBin ? (side === "long" ? "Up" : "Down") : side}? Example: **${isBin ? "Binary " + lbl(syms[0]) + " up 10 USDT 1m" : "Open " + syms[0].replace("USDT", "") + " " + side + " 10 USDT"}**`};
    const a = isBin ? normAction({action: "place_binary", sym: syms[0], dir: side === "long" ? "up" : "down", amount: m, expiry: ex || 60}) : normAction({action: "open_futures", sym: syms[0], side, margin: m, lev});
    if (a) return {act: a};
  }
  return null;
}
function local(text, kind){
  const t = text.toLowerCase().trim(), res = {text: "", cards: [], acts: [], local: true};
  const ia = intentAction(text);
  if (ia){
    if (ia.act){ const a = ia.act; res.acts.push(a);
      res.text = a.type === "open_futures" ? `📝 Ready when you are. Review this ${a.side} order:` : a.type === "close_position" ? "📝 Here is what will be closed:" : a.type === "transfer" ? "📝 Review this transfer:" : a.type === "set_alert" ? "🔔 Review this alert:" : "📝 Review this trade:"; return res; }
    res.text = ia.text || ""; res.cards = ia.cards || []; return res;
  }
  const syms = findSyms(text);
  if (/^(hi|hello|hey|hii+|yo|namaste|salam|good (morning|evening|afternoon))\b/.test(t) && t.length < 25){
    res.text = `👋 Hi **${esc(S().profile?.name || "there")}**! I can show your balance and positions, check prices, explain terms, and prepare trades for you to confirm.`; return res; }
  if (/best|top|gainer|perform|winner|leading|sabse (acha|zyada)/.test(t) && /(asset|coin|perform|today|gainer|market|crypto|best|top)/.test(t) && !/worst|loser/.test(t)){
    const m = topMovers(3); if (m.length){ res.text = `🏆 **${M.label(m[0])}** leads the last 24h at **${signed(m[0].chg)}%**. Top movers:`; res.cards.push({type: "prices", syms: m.map(p => p.sym)}); return res; } }
  if (/worst|loser|biggest drop|falling/.test(t)){ const m = topMovers(3, true); if (m.length){ res.text = `📉 Weakest in 24h: **${M.label(m[0])}** at **${signed(m[0].chg)}%**.`; res.cards.push({type: "prices", syms: m.map(p => p.sym)}); return res; } }
  if (/(position|pnl|profit|loss|open (trade|order)s?|my trades?|mere trade|running)/.test(t) && !/(what is|explain|define|kya hota)/.test(t)){
    const rows = allRows(), tot = rows.reduce((a, r) => a + (r.pnl || 0), 0);
    res.text = rows.length ? `📊 You have **${rows.length}** open position${rows.length > 1 ? "s" : ""}. Unrealized PnL: **${signed(tot)} USDT** ${tot >= 0 ? "📈" : "📉"}` : "📭 You have no open positions. Try **Open BTC long 10 USDT** and I will prepare it for you.";
    res.cards.push({type: "positions"}); return res; }
  if (/(balance|wallet|funds|how much (money|usdt)|total asset|kitna (paisa|balance)|available)/.test(t) && !/(deposit|withdraw)/.test(t)){
    res.text = `💰 Your total balance is **${fmt(S().balance || 0)} USDT**.`; res.cards.push({type: "balance"}); return res; }
  if (/\b(history|recent|last trades?|past trades?)\b/.test(t)){
    const r = recent(); if (!r.length){ res.text = "🕘 No closed trades yet."; return res; }
    res.text = "🕘 **Recent closed trades**\n\n| Pair | Type | PnL |\n|---|---|---|\n" + r.slice(0, 6).map(x => `| ${lbl(x.sym)} | ${x.type === "futures" ? "Futures " + (x.side || "") : "Binary " + (x.dir || "")} | ${signed(x.pnl || 0)} |`).join("\n"); res.cards.push({type: "link", route: "#/history"}); return res; }
  if (syms.length && /\b(should|worth|good time|safe|invest|kya .*lena|lena chahiye)\b/.test(t)){
    res.text = `📈 I can't predict the market, but here is the live snapshot for **${lbl(syms[0])}**. If you decide to trade, say **Open ${syms[0].replace("USDT", "")} long 10 USDT** and I will prepare it for you to confirm. ⚠️ Leverage raises risk, use a stop loss.`;
    res.cards.push({type: "prices", syms: syms.slice(0, 3)}); return res; }
  if (/\b(open|go to|take me|show me|kholo|dikhao|navigate)\b/.test(t) && !/\b(what|explain|why|how)\b/.test(t)){
    const pg = PAGE_WORDS.find(([, re]) => re.test(t)); if (pg){ res.text = "Here you go:"; res.cards.push({type: "link", route: "#/" + pg[0] + (syms[0] && /^(futures|spot|chart)$/.test(pg[0]) ? "/" + syms[0] : "")}); return res; } }
  const gl = GLOSS.find(g => g[0].test(t));
  const isQ = /(what|explain|meaning|means|define|how does|kya|kaise|samjha|batao|tell me|guide|learn|difference|vs)\b/.test(t) || t.length < 20;
  if (gl && (isQ || !syms.length)){ res.text = gl[2]; res.cards.push({type: "link", route: gl[3]}); return res; }
  if (syms.length && (/(price|rate|chart|how much|kitna|quote|trend|doing|analy|view|forecast|prediction for|show)/.test(t) || t.split(/\s+/).length <= 3)){
    const p = M.get(syms[0]); res.text = p?.price != null ? `📈 **${M.label(p)}** is at **${M.fmtPx(p)}**${p.chg != null ? ` (${signed(p.chg)}% 24h)` : ""}${p.high ? `\n- 24h range: ${M.fmtPx(p, p.low)} to ${M.fmtPx(p, p.high)}` : ""}` : "Prices are loading, try again in a moment.";
    res.cards.push({type: "prices", syms: syms.slice(0, 4)}); res.cards.push({type: "link", route: (p?.type === "crypto" ? "#/futures/" : "#/chart/") + syms[0]}); return res; }
  if (kind === "support" || /(deposit|withdraw|kyc|password|login|verify|not working|problem|issue|error|stuck|pending|refund|closed)/.test(t)){
    const s = supportLocal(t); if (s) return Object.assign(res, s); }
  if (gl){ res.text = gl[2]; res.cards.push({type: "link", route: gl[3]}); return res; }
  res.text = "🤔 I can help with:\n- **Balance** and **positions** with live PnL\n- **Prices** and top movers\n- **Trades**: say *Open BTC long 10 USDT*\n- **Transfers**: *Transfer 50 from spot to futures*\n- **Alerts**: *Alert BTC at 70000*\n- **Explanations**: funding, leverage, liquidation, TP/SL";
  return res;
}
const SUP = [
  [/deposit/, "💳 **Deposit not showing?**\n1. Open Deposit and check the network and address match the coin you sent.\n2. Network confirmations can take a few minutes.\n3. Check **Assets** for the Funding wallet balance.\n4. Still missing after 30 minutes? Send us the transaction ID in a ticket.", "#/deposit"],
  [/withdraw/, "📤 **Withdrawal pending?**\n1. Withdrawals are reviewed first, usually a few minutes.\n2. Double check the address and network.\n3. Funds must be in your **Funding** wallet: move them from Spot first.\n4. Over 1 hour? Submit a ticket with the withdrawal ID.", "#/withdraw"],
  [/closed|market closed/, "🕒 **Market closed?** Forex and metals close on weekends. Crypto pairs trade 24/7, so switch to a crypto pair meanwhile.", "#/markets"],
  [/(can'?t|cannot|unable|disabled|not able).*(trade|order|buy|sell|place)|(trade|order).*(fail|error|disabled|not work)/, "🛠️ **Can't place a trade?**\n1. Check the wallet for that product has enough balance, then Transfer from Assets if needed.\n2. Minimum order value is 5 USDT for futures.\n3. The market may be closed or offline for a moment.\n4. Reduce leverage if it exceeds the pair limit.", "#/assets"],
  [/password|login|log in|2fa|authenticator|verify|kyc/, "🔐 **Account and security**\n1. Open Profile, then Security to manage password and 2FA.\n2. Use *Forgot password* on the login screen to reset by email.\n3. Locked out? Contact support below with your registered email.", "#/security"],
  [/balance|missing|where.*(money|funds)|disappear/, "💰 **Balance looks wrong?**\nYour funds are split across wallets (Spot, Futures, Binary...). Open Assets to see each one and Transfer between them.", "#/assets"]
];
function supportLocal(t){
  const s = SUP.find(x => x[0].test(t)); if (!s) return null;
  return {text: s[1], cards: [{type: "link", route: s[2]}]};
}

/* ---------------- parse the model reply ---------------- */
const CARD_TYPES = ["balance", "positions", "prices", "link"];
function parseAI(raw){
  const acts = [], cards = []; let note = "";
  const text = String(raw || "").replace(/```(json|card|action|actions)?[ \t]*\n?([\s\S]*?)```/gi, (m, lang, body) => {
    let j; try { j = JSON.parse(body.trim()); } catch { if (/^(json|card|action|actions)$/i.test(lang || "")) return ""; return m; }
    const arr = Array.isArray(j) ? j : [j]; let used = false;
    arr.forEach(o => {
      if (!o || typeof o !== "object") return;
      if (o.action || (o.type && !CARD_TYPES.includes(o.type) && /open|close|transfer|binary|alert|navigate/.test(o.type))){
        used = true; const nav = String(o.action || o.type).toLowerCase();
        if (/navigate|open_page|go/.test(nav) && o.route){ cards.push({type: "link", route: o.route, title: o.title, desc: o.desc}); return; }
        const a = normAction(o); if (a) acts.push(a); else note = "I could not prepare that action. Please check the details and try again.";
      } else if (CARD_TYPES.includes(o.type)){ used = true; cards.push(o); }
    });
    return used || /^(json|card|action|actions)$/i.test(lang || "") ? "" : m;
  }).replace(/\n{3,}/g, "\n\n").trim();
  return {text: text || note, cards, acts: acts.slice(0, 3), note};
}
const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("timeout")), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
const aiReady = () => { try { return !!(window.AI && AI.ready && AI.ready()); } catch { return false; } };
async function answer(text, hist, kind){
  text = String(text).slice(0, 1500);
  const L = local(text, kind);
  if (L.acts.length || !aiReady()) return kind === "support" ? Object.assign(L, {acts: []}) : L;
  try {
    const h = []; (hist || []).slice(-12).forEach(m => { const role = m.r === "user" ? "user" : "model", tx = String(m.text || "").slice(0, 1200); if (!tx) return; if (h.length && h[h.length - 1].role === role) h[h.length - 1].text += "\n" + tx; else h.push({role, text: tx}); });
    while (h.length && h[0].role !== "user") h.shift();
    const raw = await withTimeout(AI.ask(text, {system: systemPrompt(ctx(), kind), history: h, json: false}), 28000);
    const p = parseAI(raw); if (!p.text && !p.cards.length && !p.acts.length) throw new Error("empty");
    const dataCards = L.cards.filter(c => c.type !== "link");
    const cards = p.cards.length ? p.cards : (p.acts.length ? [] : dataCards);
    return {text: p.text, cards, acts: kind === "support" ? [] : p.acts, local: false};
  } catch (e) { return L; }
}

/* ---------------- chat page ---------------- */
let pendingPrefill = null, active = null;
function open(prefill){
  pendingPrefill = prefill ? String(prefill) : null;
  if (/^#\/ai\b/.test(location.hash) && active){ const p = pendingPrefill; pendingPrefill = null; if (p) active.send(p); return; }
  location.hash = "#/ai";
}
const relT = ts => { const d = Date.now() - ts; if (d < 60e3) return "Just now"; if (d < 3600e3) return Math.floor(d / 60e3) + "m ago"; if (d < 86400e3) return Math.floor(d / 3600e3) + "h ago"; if (d < 604800e3) return Math.floor(d / 86400e3) + "d ago"; return U.dateStr ? U.dateStr(ts) : new Date(ts).toLocaleDateString(); };
const CHIPS = ["My balance", "Open BTC long 10 USDT", "Explain funding", "Best performing asset today"];

function renderBody(m, mi){
  const mdr = md(m.text || ""); let h = mdr.html;
  const seen = new Set();
  const lk = [];
  mdr.links.forEach(l => { if (seen.has(l.url) || lk.length >= 3) return; seen.add(l.url); lk.push(linkCard(l.url, l.text, "")); });
  (m.cards || []).forEach(c => { if (c.type === "link"){ const k = c.route; if (seen.has(k)) return; seen.add(k); } h += cardHtml(c); });
  h += lk.join("");
  (m.acts || []).forEach((a, ai) => { h += actHtml(a, mi, ai); });
  return h;
}
const msgHtml = (m, mi, last) => m.r === "user"
  ? `<div class="ai-m u" data-i="${mi}"><div class="ai-col"><div class="ai-bub">${esc(m.text)}</div><div class="ai-tools"><button data-copy="${mi}" aria-label="Copy message">${ic("copy", 14)}<span>Copy</span></button></div></div></div>`
  : `<div class="ai-m a" data-i="${mi}">${AV(28)}<div class="ai-col"><div class="ai-body">${renderBody(m, mi)}</div><div class="ai-tools"><button data-copy="${mi}" aria-label="Copy response">${ic("copy", 14)}<span>Copy</span></button><button data-retry="${mi}" aria-label="Retry">${RT(14)}<span>Retry</span></button></div></div></div>`;
const typingHtml = () => `<div class="ai-m a" id="aiTy">${AV(28)}<div class="ai-col"><div class="ai-body"><div class="ai-dots"><i></i><i></i><i></i></div></div></div></div>`;
const plainOf = m => { const d = document.createElement("div"); d.innerHTML = md(m.text || "").html.replace(/<\/(p|div|li|tr|h\d)>/g, "$&\n").replace(/<\/t[dh]>/g, "$& | "); return (d.textContent || "").trim(); };

Pages.ai = Pages.assistant = () => {
  let chat = chats[0] && chats[0].msgs.length ? chats[0] : null, busy = false, gone = false, vvH = null, onVV = null;
  if (!chat) chat = mkChat();
  const html = `<div class="ai-page" id="aiP">
    <header class="ai-top"><button class="icon-btn" data-back aria-label="Go back">${ic("back", 22)}</button>
      <div class="ai-tt">${AV(32)}<div><h1>${esc(NAME)}</h1><small>Your trading assistant</small></div></div>
      <button class="icon-btn" id="aiHist" aria-label="Chat history">${ic("history", 21)}</button><button class="icon-btn" id="aiNew" aria-label="New chat">${ic("edit", 20)}</button></header>
    <div class="ai-scroll" id="aiS"><div class="ai-list" id="aiL"></div></div>
    <div class="ai-comp"><form class="ai-form" id="aiF"><textarea id="aiT" rows="1" maxlength="1000" placeholder="Message ${esc(NAME)}" enterkeyhint="send" aria-label="Message"></textarea><button class="ai-send" id="aiSend" type="submit" aria-label="Send" disabled>${ic("send", 18, 2)}</button></form>
      <div class="ai-fine">${esc(NAME)} can make mistakes. Check important details before you confirm.</div></div></div>`;
  return {html, title: NAME, mount(root){
    const $ = q => root.querySelector(q), L = $("#aiL"), SC = $("#aiS"), T = $("#aiT"), SB = $("#aiSend");
    document.body.classList.add("no-nav");
    active = {send: t => send(t)};
    const bottom = (smooth) => { try { SC.scrollTo({top: SC.scrollHeight, behavior: smooth ? "smooth" : "auto"}); } catch { SC.scrollTop = SC.scrollHeight; } };
    const welcome = () => `<div class="ai-wel"><span class="ai-orb">${AIC(30, 1.7)}</span><h2>How can I help?</h2><p>Ask about your balance and positions, check live prices, learn a term, or let me prepare a trade. I always ask you to confirm first.</p>
      <div class="ai-chips">${CHIPS.map(c => `<button data-chip="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>`;
    const draw = () => {
      L.innerHTML = chat.msgs.length ? chat.msgs.map((m, i) => msgHtml(m, i, i === chat.msgs.length - 1)).join("") : welcome();
      loadSparks(L);
    };
    const redrawMsg = i => { const el = L.querySelector(`.ai-m[data-i="${i}"]`); if (!el) return draw(); const d = document.createElement("div"); d.innerHTML = msgHtml(chat.msgs[i], i); el.replaceWith(d.firstElementChild); loadSparks(L); };
    const save = () => { if (!chat.msgs.length) return; if (!chats.includes(chat)) chats.unshift(chat); chat.t = Date.now(); persist(); };
    const setBusy = b => { busy = b; SB.disabled = b || !T.value.trim(); };
    const typing = on => { const o = $("#aiTy"); if (o) o.remove(); if (on){ L.insertAdjacentHTML("beforeend", typingHtml()); bottom(true); } };
    const grow = () => { T.style.height = "auto"; T.style.height = Math.min(120, T.scrollHeight) + "px"; SB.disabled = busy || !T.value.trim(); };
    async function reply(upto, at){   // generate an answer to msgs[upto] (user), put it at index `at` (replace) or append
      setBusy(true); const wasWel = !!L.querySelector(".ai-wel"); if (wasWel) draw();
      if (at != null){ const el = L.querySelector(`.ai-m[data-i="${at}"] .ai-body`); if (el) el.innerHTML = '<div class="ai-dots"><i></i><i></i><i></i></div>'; } else typing(true);
      const um = chat.msgs[upto], t0 = Date.now();
      const r = await answer(um.text, chat.msgs.slice(0, upto), "chat");
      if (gone) return;
      const wait = Math.max(0, (r.local ? 380 : 0) - (Date.now() - t0)); if (wait) await U.sleep(wait); if (gone) return;
      const nm = {r: "ai", text: r.text, cards: r.cards, acts: r.acts, t: Date.now()};
      if (at != null){ chat.msgs[at] = nm; redrawMsg(at); } else { typing(false); chat.msgs.push(nm); L.insertAdjacentHTML("beforeend", msgHtml(nm, chat.msgs.length - 1)); loadSparks(L); }
      save(); setBusy(false); bottom(true);
    }
    function send(text){
      text = String(text || "").trim().slice(0, 1000); if (!text || busy) return;
      if (chat.msgs.length === 0) chat.title = text.length > 42 ? text.slice(0, 40) + "..." : text;
      chat.msgs.push({r: "user", text, t: Date.now()}); T.value = ""; grow();
      if (L.querySelector(".ai-wel")) draw(); else { L.insertAdjacentHTML("beforeend", msgHtml(chat.msgs[chat.msgs.length - 1], chat.msgs.length - 1)); }
      save(); bottom(true); reply(chat.msgs.length - 1, null);
    }
    async function runAct(mi, ai, kind){
      const m = chat.msgs[mi], a = m && m.acts && m.acts[ai]; if (!a || a.status !== "pending") return;
      if (kind === "cancel"){ a.status = "cancelled"; save(); redrawMsg(mi); return; }
      a.status = "busy"; redrawMsg(mi);
      const d = describe(a); if (d.warn.length && !/High|Very high/.test(d.warn[0])){ a.status = "pending"; redrawMsg(mi); return toast(d.warn[0], "bad"); }
      const res = exec(a);
      if (!res.ok){ a.status = "failed"; a.res = res.text; save(); redrawMsg(mi); toast(res.text, "bad"); return; }
      a.status = "done"; a.res = res.text; redrawMsg(mi);
      const nm = {r: "ai", text: res.msg, cards: res.cards || [], t: Date.now()}; chat.msgs.push(nm); L.insertAdjacentHTML("beforeend", msgHtml(nm, chat.msgs.length - 1)); loadSparks(L); save(); bottom(true);
    }
    L.addEventListener("click", e => {
      const b = e.target.closest("button,a"); if (!b || !L.contains(b)) return;
      if (b.dataset.chip){ return send(b.dataset.chip); }
      if (b.dataset.suggest){ return send(b.dataset.suggest); }
      if (b.dataset.go){ U.buzz && U.buzz(8); location.hash = b.dataset.go; return; }
      if (b.dataset.copy != null){ const m = chat.msgs[+b.dataset.copy]; if (m) U.copyText(m.r === "user" ? m.text : plainOf(m), "Copied"); return; }
      if (b.dataset.retry != null){ if (busy) return; const i = +b.dataset.retry; let u = i - 1; while (u >= 0 && chat.msgs[u].r !== "user") u--; if (u >= 0) reply(u, i); return; }
      if (b.dataset.act){ const c = b.closest(".ai-act"); if (c) runAct(+c.dataset.m, +c.dataset.a, b.dataset.act); }
    });
    $("#aiF").onsubmit = e => { e.preventDefault(); send(T.value); };
    T.addEventListener("input", grow);
    T.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && matchMedia("(hover:hover)").matches){ e.preventDefault(); send(T.value); } });
    $("#aiNew").onclick = () => { if (busy) return; if (chat.msgs.length){ chat = mkChat(); draw(); } T.focus(); };
    $("#aiHist").onclick = () => histSheet();
    function histSheet(){
      const list = () => chats.length ? chats.slice().sort((a, b) => b.t - a.t).map(c => `<div class="ai-hr ${c === chat ? "on" : ""}"><button class="ai-ho" data-open="${c.id}"><span class="ai-hi">${ic("chat", 18, 1.7)}</span><span class="ai-ht"><b>${esc(c.title)}</b><small>${esc(relT(c.t))} · ${c.msgs.length} message${c.msgs.length === 1 ? "" : "s"}</small></span></button><button class="ai-hd" data-del="${c.id}" aria-label="Delete chat">${ic("trash", 17, 1.8)}</button></div>`).join("") : `<div class="ai-hempty">${ic("history", 30, 1.5)}<p>No chats yet</p></div>`;
      U.sheet("Chat history", `<div class="ai-hl" id="aiHl">${list()}</div>${chats.length ? `<button class="ai-delall" id="aiDa">${ic("trash", 16, 1.8)} Delete all history</button>` : ""}`, el => {
        const refresh = () => { el.querySelector("#aiHl").innerHTML = list(); const da = el.querySelector("#aiDa"); if (!chats.length && da) da.remove(); };
        el.addEventListener("click", async e => {
          const o = e.target.closest("[data-open]"), d = e.target.closest("[data-del]"), da = e.target.closest("#aiDa");
          if (o){ const c = chats.find(x => x.id === o.dataset.open); if (c && !busy){ chat = c; U.closeLayer(); draw(); bottom(); } }
          else if (d){ const i = chats.findIndex(x => x.id === d.dataset.del); if (i < 0) return; const was = chats[i] === chat; chats.splice(i, 1); persist(); if (was){ chat = mkChat(); draw(); } refresh(); }
          else if (da){ if (await U.confirmBox("Delete all history?", "All your AI chats on this device will be removed.", "Delete all", true)){ chats = []; persist(); chat = mkChat(); draw(); refresh(); } }
        });
      });
    }
    if (window.visualViewport){ vvH = window.visualViewport; onVV = () => { const el = $("#aiP"); if (el) el.style.setProperty("--aivh", vvH.height + "px"); setTimeout(() => bottom(), 30); }; vvH.addEventListener("resize", onVV); onVV(); }
    draw(); bottom();
    const pf = pendingPrefill; pendingPrefill = null; if (pf) setTimeout(() => send(pf), 250);
  }, unmount(){ gone = true; active = null; document.body.classList.remove("no-nav"); if (onVV && vvH) vvH.removeEventListener("resize", onVV); }};
};

/* ---------------- Support page block ---------------- */
const SUP_CHIPS = ["Deposit not showing", "Withdrawal pending", "Can't place a trade", "Market closed", "Reset password"];
function supportHtml(){
  return `<section class="pm-sec ai-sup" id="aiSup"><h3 class="pm-st">${esc(C.APP_NAME || "NovaTrade")} assistant</h3>
    <button class="pm-row tap ai-sup-open" data-ai-open type="button"><span class="pm-ico ai-supi">${AIC(18, 1.9)}</span><span class="pm-main"><span class="pm-t">Ask AI assistant</span><span class="pm-s" style="display:block">Instant answers about your account and trades</span></span><span class="chev">${ic("chev", 16)}</span></button>
    <div class="ai-sol"><div class="ai-solh">${AV(24)}<b>Suggested solutions</b></div>
      <form class="ai-solf" id="aiSolF"><input id="aiSolQ" class="pm-in" maxlength="200" placeholder="Describe your problem" aria-label="Describe your problem" enterkeyhint="send"><button class="ai-send" type="submit" aria-label="Get help">${ic("send", 17, 2)}</button></form>
      <div class="ai-chips sm">${SUP_CHIPS.map(c => `<button type="button" data-sq="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div id="aiSolA" aria-live="polite"></div></div></section>`;
}
function supportMount(r){
  const A = r.querySelector("#aiSolA"), Q = r.querySelector("#aiSolQ"), F = r.querySelector("#aiSolF"); if (!A || !Q) return;
  r.querySelector("[data-ai-open]").onclick = () => open();
  let seq = 0;
  const ask = async q => {
    q = String(q || "").trim(); if (!q) return; Q.value = q; const my = ++seq;
    A.innerHTML = `<div class="ai-card ai-solc"><div class="ai-dots"><i></i><i></i><i></i></div></div>`;
    const res = await answer(q, [], "support"); if (my !== seq || !A.isConnected) return;
    const m = {text: res.text, cards: res.cards};
    A.innerHTML = `<div class="ai-card ai-solc"><div class="ai-solt">${AV(22)}<span>${esc(C.APP_NAME || "NovaTrade")} assistant</span></div><div class="ai-body">${renderBody(m, 0)}</div>
      <div class="ai-solf2"><span>Not solved?</span><button type="button" data-more>Continue in chat</button></div></div>`;
    loadSparks(A);
    A.querySelector("[data-more]").onclick = () => open(q);
  };
  F.onsubmit = e => { e.preventDefault(); ask(Q.value); };
  r.querySelectorAll("[data-sq]").forEach(b => b.onclick = () => ask(b.dataset.sq));
  A.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) location.hash = b.dataset.go; });
}

window.AICHAT = {open, ic: AIC, avatar: AV, supportHtml, supportMount, ask: (q, kind) => answer(q, [], kind || "chat"), _md: md, _ctx: ctx, _local: local, _parse: parseAI, _system: systemPrompt};
})();
