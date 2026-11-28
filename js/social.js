/* ===== SOCIAL: working like / comment / share for post lists (window.SOCIAL) ===== */
(() => {
const {esc, ic} = U;
const KEY = "nt_social";
const load = () => { try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && typeof j === "object") return {likes:j.likes || {}, cm:j.cm || {}, cl:j.cl || {}}; } catch {} return {likes:{}, cm:{}, cl:{}}; };
let st = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
const hash = s => { let h = 2166136261; for (const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => { let a = hash(seed); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const NAMES = ["Aiden_K","luna.trades","CryptoMax","SatoshiFan88","nora_fx","BlockBill","ZenTrader","kai_hodl","Marta.W","DeltaDave","orbit_ray","PipHunter","Sana_Eth","RiskFirst","tomo_chart","VegaVic","Lina.btc","AlphaOwl","GridGuy","NightScalper"];
const TEXTS = ["Solid setup, thanks for sharing.","Been watching the same level all week.","Risk management is what keeps you in the game.","Followed this one, entry looks clean.","What is your stop on this?","Agree, the funding is getting stretched.","Nice call earlier, took partial profit.","I would wait for a retest first.","Sizing small until it confirms.","This is why I trade with a plan.","Volume is picking up, good sign.","Thanks, learning a lot from your posts.","Choppy market, patience pays.","Same view here, staying cautious.","Great breakdown.","Did you add on the dip?","Liquidity above the highs looks tempting.","Respect the discipline.","Keeping this on my watchlist.","Clean levels, clear invalidation."];
const ago = m => m < 1 ? "Just now" : m < 60 ? m + "m ago" : m < 1440 ? Math.floor(m / 60) + "h ago" : Math.floor(m / 1440) + "d ago";
const initials = n => esc(String(n).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "U");
const avatar = (seed, size) => window.ART && ART.avatar ? ART.avatar("c_" + seed, size) : `<span class="sc-ini" style="width:${size}px;height:${size}px">${initials(seed)}</span>`;
const seeded = (pid, n, postTs) => { const r = rng("cm_" + pid), out = [], maxM = postTs ? Math.max(0, Math.floor((Date.now() - postTs) / 60000)) : 0, raw = [];
  /* v7.4: a comment can never be older than its post (age <= post age) */
  for (let i = 0; i < n; i++) raw.push([NAMES[Math.floor(r() * NAMES.length)], TEXTS[Math.floor(r() * TEXTS.length)], Math.floor(r() * r() * 40), r()]);
  let m = 3 + Math.floor(r() * 20);
  const fr = raw.map(x => x[3]).sort((a, b) => a - b);
  raw.forEach((x, i) => { let a; if (postTs) a = Math.min(maxM, Math.floor(fr[i] * maxM)); else { a = m; m += 4 + Math.floor(r() * 90); }
    out.push({id:pid + "#" + i, name:x[0], text:x[1], ago:a, likes:x[2]}); });
  return out; };
const isLiked = id => !!st.likes[id];
const likeCount = (id, base) => base + (isLiked(id) ? 1 : 0);
const cmCount = (id, base) => base + (st.cm[id] ? st.cm[id].length : 0);

function bar(id, likes, cm, meta){
  meta = meta || {};
  const on = isLiked(id);
  return `<div class="sc-bar" data-sid="${esc(id)}" data-bl="${likes}" data-bc="${cm}" data-pts="${+meta.ts || 0}" data-who="${esc(meta.who || "")}" data-text="${esc(meta.text || "")}" data-url="${esc(meta.url || "")}">
    <button class="sc-b sc-like${on ? " on" : ""}" data-sa="like" aria-pressed="${on}" aria-label="Like"><span class="sc-ic">${ic("heart", 15, 1.7)}</span><span class="sc-n num">${likeCount(id, likes)}</span></button>
    <button class="sc-b" data-sa="cm" aria-label="Comments">${ic("chat", 15, 1.7)}<span class="sc-c num">${cmCount(id, cm)}</span></button>
    <button class="sc-b" data-sa="share" aria-label="Share">${ic("share", 15, 1.7)}</button></div>`;
}

function share(b){
  const text = (b.dataset.who ? b.dataset.who + ": " : "") + (b.dataset.text || "NovaTrade");
  const url = b.dataset.url || (location.origin + location.pathname);
  if (navigator.share){ navigator.share({title:"NovaTrade", text, url}).catch(e => { if (!e || e.name !== "AbortError") U.copyText(text + " " + url, "Link copied"); }); return; }
  U.copyText(text + " " + url, "Link copied");
}

function comments(b){
  const id = b.dataset.sid, base = +b.dataset.bc;
  const seed = seeded(id, base, +b.dataset.pts || 0);
  const row = c => `<div class="sc-r">${avatar(c.name, 32)}<div class="g"><div class="t"><b>${esc(c.name)}</b><span>${ago(c.ago)}</span></div><p>${esc(c.text)}</p></div><button class="sc-cl${st.cl[c.id] ? " on" : ""}" data-cl="${esc(c.id)}" aria-label="Like comment">${ic("heart", 13, 1.7)}<span class="num">${c.likes + (st.cl[c.id] ? 1 : 0)}</span></button></div>`;
  const mine = () => (st.cm[id] || []).map((m, i) => ({id:id + "@" + i, name:"You", text:m.t, ago:Math.floor((Date.now() - m.ts) / 60000), likes:0})).reverse();
  const all = () => mine().concat(seed);
  U.sheet(`Comments (${all().length})`, `<div class="sc-list" id="scl"></div><div class="sc-in"><input id="sci" maxlength="280" placeholder="Add a comment…" autocomplete="off" aria-label="Add a comment"><button id="scs" disabled>Send</button></div>`, el => {
    const list = el.querySelector("#scl"), inp = el.querySelector("#sci"), btn = el.querySelector("#scs"), ttl = el.querySelector(".title");
    const draw = () => { const a = all(); ttl.textContent = `Comments (${a.length})`; list.innerHTML = a.length ? a.map(row).join("") : '<div class="sc-empty">No comments yet. Be the first.</div>'; };
    draw();
    const upd = () => { btn.disabled = !inp.value.trim(); };
    inp.addEventListener("input", upd);
    const send = () => { const t = inp.value.trim(); if (!t) return; (st.cm[id] = st.cm[id] || []).push({t, ts:Date.now()}); save(); inp.value = ""; upd(); draw(); list.scrollTop = 0;
      document.querySelectorAll(".sc-bar").forEach(x => { if (x.dataset.sid === id){ const c = x.querySelector(".sc-c"); if (c) c.textContent = cmCount(id, base); } }); };
    btn.onclick = send; inp.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); send(); } });
    list.addEventListener("click", e => { const l = e.target.closest("[data-cl]"); if (!l) return; const k = l.dataset.cl; if (st.cl[k]) delete st.cl[k]; else st.cl[k] = 1; save(); const f = all().find(x => x.id === k); l.classList.toggle("on", !!st.cl[k]); l.querySelector(".num").textContent = (f ? f.likes : 0) + (st.cl[k] ? 1 : 0); });
  });
}

function bind(root){
  if (!root || root._scb) return; root._scb = 1;
  root.addEventListener("click", e => {
    const btn = e.target.closest("[data-sa]"); if (!btn || !root.contains(btn)) return;
    const b = btn.closest(".sc-bar"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const a = btn.dataset.sa, id = b.dataset.sid;
    if (a === "like"){ const on = !isLiked(id); if (on) st.likes[id] = 1; else delete st.likes[id]; save();
      btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", on); btn.querySelector(".sc-n").textContent = likeCount(id, +b.dataset.bl);
      if (on){ btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); } }
    else if (a === "cm") comments(b);
    else share(b);
  }, true);
}

window.SOCIAL = {bar, bind, comments, share, hash};
})();
