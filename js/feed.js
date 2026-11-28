/* v6.9 Live withdrawals card on Home. Deterministic from wall-clock time only, so every device shows the same feed. */
(function(){
const SLOT = 7000, LATEST = 5, PROB = 0.3;
/* v7.4: amounts are random in the $1 - $100,000 range (log-skewed: many small, few big); every non-USDT coin stays at or above its Binance minimum withdrawal (BN_STD in names.js).
   [coin, network, weight, decimals, reference price used only when the live price is not loaded yet] */
const COINS = [["USDT","BEP20",60,2,1],["USDT","TRC20",10,2,1],["BTC","",5,6,95000],["ETH","ERC20",5,5,3400],["SOL","",4,3,190],["BNB","BEP20",4,3,650],["XRP","",3,2,2.3],["TRX","TRC20",3,2,0.27],["USDC","ERC20",3,2,1],["DOGE","",2,2,0.38],["LTC","",1,3,100]];
const WSUM = COINS.reduce((a, c) => a + c[2], 0);
const STD = () => window.BN_STD || {};
function hash(n, salt){
  let h = (n * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
const live = s => hash(s, 1) < PROB;
const priceOf = c => { if (c[0] === "USDT" || c[0] === "USDC") return 1; try { const p = window.M && M.get(c[0] + "USDT"); if (p && p.price > 0) return p.price; } catch (e) {} return c[4]; };
function evt(s){
  const t = s * SLOT + SLOT * (0.05 + 0.9 * hash(s, 2));
  let w = hash(s, 6) * WSUM, c = COINS[0]; for (const x of COINS){ if ((w -= x[2]) < 0){ c = x; break; } }
  const d = c[3], px = priceOf(c), min = c[0] === "USDT" ? 1 : ((STD()[c[0]] || {}).min || 0);
  let usd = Math.pow(10, 5 * Math.pow(hash(s, 4), 2.2));          // $1 .. $100,000, most of the mass at the small end
  if (hash(s, 5) < 0.4){ const st = usd >= 5000 ? 1000 : usd >= 1000 ? 500 : usd >= 200 ? 100 : usd >= 50 ? 50 : usd >= 10 ? 10 : 1; usd = Math.max(st, Math.round(usd / st) * st); }
  usd = Math.min(100000, Math.max(1, usd));
  let amt = usd / px;
  if (hash(s, 5) >= 0.4 || c[0] !== "USDT" && c[0] !== "USDC") amt = +amt.toFixed(d); else amt = +amt.toFixed(2);
  if (c[0] !== "USDT" && c[0] !== "USDC" && hash(s, 5) < 0.4){ const sig = Math.pow(10, Math.floor(Math.log10(amt)) - 1); amt = +(Math.round(amt / sig) * sig).toFixed(d); }
  if (min > 0 && amt < min) amt = +(min * (1 + hash(s, 9) * 0.6)).toFixed(Math.max(d, 6));   // never below the real minimum withdrawal
  if (amt * px < 1) amt = +Math.max(c[0] === "USDT" ? 1 : 0, Math.ceil(1.0001 / px * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
  if (Math.abs(amt - Math.round(amt)) < 1e-9 && hash(s, 5) >= 0.4) amt += Math.pow(10, -d) * (1 + Math.floor(hash(s, 8) * 80));
  amt = +amt.toFixed(Math.max(d, amt < min * 1.0001 ? 6 : d));
  const uid = ((((s % 9000) + 9000) % 9000) * 7919 + 1234) % 9000 + 1000;
  return {s, t, amt, coin: c[0], net: c[1], uid};
}
function latest(now){
  const out = []; let s = Math.floor(now / SLOT) + 1, guard = 0;
  while (out.length < LATEST && s > 0 && guard++ < 400){ s--; if (!live(s)) continue; const e = evt(s); if (e.t <= now) out.push(e); }
  return out;
}
const fmt = (n, coin) => n.toLocaleString("en-US", {minimumFractionDigits: 0, maximumFractionDigits: 6});
const ago = ms => { const sec = Math.max(0, Math.floor(ms / 1000)); return sec < 5 ? "Just now" : sec < 60 ? sec + " sec ago" : Math.floor(sec / 60) + " min ago"; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const row = (e, now, fresh) => `<div class="wf-row${fresh ? " wf-in" : ""}" data-s="${e.s}"><span class="wf-ic">${window.UI && UI.coinImg ? UI.coinImg(e.coin, 34) : esc(e.coin)}</span><div class="wf-tx"><b class="num">${fmt(e.amt, e.coin)} ${esc(e.coin)}${e.net ? ` <em class="wf-net">${esc(e.net)}</em>` : ""}</b><small>Withdrawal completed · *****${e.uid}</small></div><time class="wf-t" data-t="${e.t}">${ago(now - e.t)}</time></div>`;


/* v7.0 Why NovaTrade: graphics-heavy trust section under the live card. Modest, verifiable wording only. */
const I = (d, c) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const CMP = [
  ["Price display", "Often widened", "0% slippage display", `<path d="M3 12h4l3-7 4 14 3-7h4"/>`],
  ["Fees", "Hidden in the spread", "Clear fees shown before you trade", `<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1 1.3-1.7 3-1.7s3 .7 3 1.7-1.3 1.5-3 2-3 .9-3 2 1.3 1.7 3 1.7 3-.7 3-1.7"/>`],
  ["Instant auto withdrawals", "Can take hours", "Instant auto withdraw in 10 sec to 1 min", `<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>`],
  ["Support", "Ticket queues", "24/7 support chat", `<path d="M4 13v-1a8 8 0 0116 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.5-2 2.5-5 2.5"/>`]
];
const SAFE = [
  ["Your funds stay in your account wallet", "Balances sit in your own Trading, Spot and Earn wallets. You decide when to move them.", `<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M3 11h18M16 15.5h2"/><path d="M7 7V6a3 3 0 013-3h4"/>`],
  ["Every trade has a confirmation", "Open, close and withdraw actions show a clear summary first, so nothing happens by accident.", `<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>`],
  ["Clear fees, always in USDT", "Fees and estimated results are shown before you confirm, with no surprise charges afterwards.", `<path d="M7 3h10v18l-2.5-1.8L12 21l-2.5-1.8L7 21z"/><path d="M10 8h4M10 12h4"/>`],
  ["Protect your login", "Review your sign-in and security options any time from your Profile settings.", `<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>`]
];
const STEPS = [["Deposit", "Add USDT to your account", `<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>`], ["Trade", "Pick a market and confirm", `<path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/>`], ["Withdraw", "Send to your own address", `<path d="M12 20V9M7.5 13.5L12 9l4.5 4.5M5 4h14"/>`]];
/* v7.4 premium indicators + everything-in-one-app grid */
const IND = [
  ["Liquidation indicator", "See where leveraged positions get wiped out, right on the chart.",
   `<svg viewBox="0 0 160 70" aria-hidden="true"><path d="M4 50 L24 40 L42 46 L64 24 L86 32 L104 14" class="wi-l"/><g class="wi-b">${[[112,8,40],[112,18,26],[112,28,52],[112,38,18],[112,48,34],[112,58,22]].map(([x,y,w]) => `<rect x="${x}" y="${y}" width="${w}" height="6" rx="2" opacity="${(.35 + w / 90).toFixed(2)}"/>`).join("")}</g><path d="M4 22H108" class="wi-d"/><text x="6" y="19" class="wi-t">Liq. zone</text></svg>`],
  ["AI Forecast", "A projected price range from the model, drawn ahead of the last candle.",
   `<svg viewBox="0 0 160 70" aria-hidden="true"><path d="M4 52 L22 44 L40 48 L60 30 L78 36 L92 24" class="wi-l"/><path d="M92 24 L156 6 L156 40 Z" class="wi-f"/><path d="M92 24 L156 20" class="wi-d2"/><circle cx="92" cy="24" r="3.5" class="wi-dot"/><text x="100" y="60" class="wi-t">Forecast</text></svg>`]
];
const PRODS = [
  ["Binary", "Up or Down in 30s to 5m", `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`],
  ["CFD", "Forex, gold, stocks, indices", `<path d="M7 4v16M7 8h-2v6h2M17 3v14M17 6h-2v8h2"/><path d="M12 8v10M12 11h-2v4h2"/>`],
  ["Perp", "Long or short with leverage", `<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>`],
  ["Spot", "Buy and hold real coins", `<path d="M4 20V4M4 20h16"/><path d="M8 15l4-4 3 3 5-6"/>`],
  ["Money Game", "Play and chill while making money", `<path d="M5 15l1.5-5h11L19 15"/><rect x="3" y="15" width="18" height="4" rx="2"/><circle cx="7.5" cy="19" r="1.6"/><circle cx="16.5" cy="19" r="1.6"/>`],
  ["Trading bots", "Auto trade a fixed plan", `<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16.5h6"/>`],
  ["API Trade", "Connect your exchange API, follow Telegram channel signals", `<path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13.5 6l-3 12"/>`],
  ["Prediction", "Yes or No on real events", `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>`]
];
function moreHtml(){
  return `<h3 class="wy-t">Premium indicators</h3>
  <div class="wi-grid">${IND.map(([t, p, g]) => `<div class="wi-c"><div class="wi-g">${g}</div><b>${t}</b><p>${p}</p></div>`).join("")}</div>
  <h3 class="wy-t">Everything in one app</h3>
  <div class="wp-grid">${PRODS.map(([t, p, d]) => `<div class="wp-c"><span class="wy-i">${I(d)}</span><div><b>${t}</b><small>${p}</small></div></div>`).join("")}</div>
  <div class="wp-free"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12v8H4v-8M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg><b>All free</b><span>Every feature above costs nothing to use.</span></div>`;
}
function whyHtml(){
  return `<div class="wy-h"><h2>Why NovaTrade</h2><p>What you can expect when you trade here.</p></div>
  <div class="wy-hero" aria-hidden="true"><svg viewBox="0 0 320 96" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="wyg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2E6BFF" stop-opacity=".35"/><stop offset="1" stop-color="#5AA9FF" stop-opacity=".06"/></linearGradient></defs><rect width="320" height="96" fill="url(#wyg)"/><path d="M0 70 C40 60 60 80 100 62 S170 30 210 44 280 18 320 24 V96 H0z" fill="#2E6BFF" fill-opacity=".14"/><path d="M0 70 C40 60 60 80 100 62 S170 30 210 44 280 18 320 24" fill="none" stroke="#5AA9FF" stroke-width="2.4" stroke-linecap="round"/><circle cx="210" cy="44" r="4.5" fill="#5AA9FF"/><circle cx="210" cy="44" r="9" fill="#5AA9FF" fill-opacity=".25"/></svg><div><b>Trade with clarity</b><span>Simple tools, clear numbers, quick withdrawals.</span></div></div>
  <h3 class="wy-t">NovaTrade vs typical exchanges</h3>
  <div class="wy-cmp">${CMP.map(([n, o, y, d]) => `<div class="wy-c"><span class="wy-i">${I(d)}</span><div><small>${n}</small><s>${o}</s><b>${y}</b></div></div>`).join("")}</div>
  <h3 class="wy-t">How we keep it safe</h3>
  <div class="wy-safe">${SAFE.map(([t, p, d]) => `<div class="wy-s"><span class="wy-i">${I(d)}</span><b>${t}</b><p>${p}</p></div>`).join("")}</div>
  ${moreHtml()}
  <h3 class="wy-t">How it works</h3>
  <div class="wy-steps">${STEPS.map(([t, p, d], i) => `<div class="wy-st"><span class="wy-i wy-lg">${I(d)}<em>${i + 1}</em></span><b>${t}</b><small>${p}</small></div>${i < 2 ? '<i class="wy-ar" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></i>' : ""}`).join("")}</div>`;
}

let timer = 0;
function stop(){ if (timer){ clearInterval(timer); timer = 0; } }
function tick(card){
  if (!card.isConnected){ stop(); return; }
  const now = Date.now(), list = latest(now), box = card.querySelector(".wf-list");
  const have = [...box.children].map(x => +x.dataset.s), want = list.map(e => e.s);
  if (have.join() !== want.join()){
    want.forEach((s, i) => { if (!have.includes(s)){
      const tmp = document.createElement("div"); tmp.innerHTML = row(list[i], now, have.length > 0);
      const el = tmp.firstChild, ref = box.children[i] || null; box.insertBefore(el, ref);
    } });
    [...box.children].forEach(x => { if (!want.includes(+x.dataset.s)) x.classList.add("wf-out"), setTimeout(() => x.remove(), 380); });
  }
  card.querySelectorAll(".wf-t").forEach(t => { t.textContent = ago(now - (+t.dataset.t)); });
}
function inject(){
  const v = document.getElementById("view"); if (!v) return;
  const home = v.querySelector(".hm-assets") && v.querySelector(".hm-strip-sp");
  const ex = v.querySelector(".wf-card");
  if (!home){ if (!ex) stop(); return; }
  if (ex) return;
  const now = Date.now();
  const card = document.createElement("section");
  card.className = "wf-card"; card.setAttribute("aria-label", "Live withdrawals");
  card.innerHTML = `<header class="wf-h"><h2>Live withdrawals</h2><span class="wf-live"><i></i>Live</span></header><div class="wf-list">${U.skel ? U.skel(3, "row") : ""}</div>`;
  setTimeout(() => { const l = card.querySelector(".wf-list"); if (l && card.isConnected) l.innerHTML = latest(Date.now()).map(e => row(e, Date.now(), false)).join(""); }, 450);
  v.querySelector(".hm-strip-sp").before(card);
  const wy = document.createElement("section"); wy.className = "wy-sec"; wy.setAttribute("aria-label", "Why NovaTrade"); wy.innerHTML = whyHtml(); card.after(wy);
  stop(); timer = setInterval(() => tick(card), 1000);
}
const run = () => setTimeout(inject, 0);
addEventListener("hashchange", run);
if (document.readyState === "loading") addEventListener("DOMContentLoaded", run); else run();
const view = document.getElementById("view"); if (view) new MutationObserver(inject).observe(view, {childList: true});
window.WFEED = {latest};
})();
