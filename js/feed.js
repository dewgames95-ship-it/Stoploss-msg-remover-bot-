/* v6.9 Live withdrawals card on Home. Deterministic from wall-clock time only, so every device shows the same feed. */
(function(){
const SLOT = 45000, LATEST = 5, MIN_AGE = 10000;
const COINS = [["USDT","TRC20",30],["USDT","BEP20",18],["BTC","Bitcoin",14],["ETH","ERC20",12],["USDC","Polygon",10],["SOL","Solana",8],["USDT","ERC20",8]];
const WSUM = COINS.reduce((a, c) => a + c[2], 0);
function hash(n, salt){
  let h = (n * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
function skipped(s){ const m = ((s % 4) + 4) % 4; return (m === 1 || m === 3) && hash(s, 1) < 0.4; }   // never two empty slots in a row
function evt(s){
  const t = s * SLOT + SLOT * (0.09 + 0.82 * hash(s, 2));
  const r = hash(s, 3), q = hash(s, 4); let amt;
  if (r < 0.58) amt = 20 + Math.pow(q, 1.6) * 280;
  else if (r < 0.88) amt = 300 + Math.pow(q, 1.3) * 1700;
  else if (r < 0.97) amt = 2000 + q * 3000;
  else amt = 5000 + Math.pow(q, 1.4) * 20000;
  const style = hash(s, 5);
  amt = style < 0.35 ? Math.round(amt / (amt > 1000 ? 10 : 5)) * (amt > 1000 ? 10 : 5) : style < 0.55 ? Math.round(amt) : Math.round(amt * 100) / 100;
  if (amt < 20) amt = 20;
  let w = hash(s, 6) * WSUM, c = COINS[0]; for (const x of COINS){ if ((w -= x[2]) < 0){ c = x; break; } }
  const uid = ((((s % 9000) + 9000) % 9000) * 7919 + 1234) % 9000 + 1000;
  return {s, t, amt, coin: c[0], net: c[1], uid};
}
function latest(now){
  const out = []; let s = Math.floor(now / SLOT) + 1;
  while (out.length < LATEST && s > 0){ s--; if (skipped(s)) continue; const e = evt(s); if (now - e.t >= MIN_AGE) out.push(e); }
  return out;
}
const fmt = n => "$" + n.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const ago = ms => { const sec = Math.max(10, Math.floor(ms / 1000)); return sec < 60 ? sec + " sec ago" : Math.floor(sec / 60) + " min ago"; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const row = (e, now, fresh) => `<div class="wf-row${fresh ? " wf-in" : ""}" data-s="${e.s}"><span class="wf-ic">${window.UI && UI.coinImg ? UI.coinImg(e.coin, 34) : esc(e.coin)}</span><div class="wf-tx"><b class="num">${fmt(e.amt)} <span>withdrawn</span></b><small>by *****${e.uid} · ${esc(e.coin)} ${esc(e.net)}</small></div><time class="wf-t" data-t="${e.t}">${ago(now - e.t)}</time></div>`;

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
  card.innerHTML = `<header class="wf-h"><h2>Live withdrawals</h2><span class="wf-live"><i></i>Live</span></header><div class="wf-list">${latest(now).map(e => row(e, now, false)).join("")}</div>`;
  v.querySelector(".hm-strip-sp").before(card);
  stop(); timer = setInterval(() => tick(card), 2000);
}
const run = () => setTimeout(inject, 0);
addEventListener("hashchange", run);
if (document.readyState === "loading") addEventListener("DOMContentLoaded", run); else run();
const view = document.getElementById("view"); if (view) new MutationObserver(inject).observe(view, {childList: true});
window.WFEED = {latest};
})();
