/* ===== v7.0 Prediction social: trader profile sheet + read-only event comments (Polymarket public data) =====
   PSOC.profile(addrOrHolder)      bottom sheet: avatar, name, address (copy), joined, social links, all-time PnL card, positions, activity
   PSOC.comments(container, event) read-only comments for an event (replies nested + collapsible, live refresh ~20s). Returns an unmount fn.
   Endpoints (public, CORS *, no key):
     gamma  /public-profile?address=            name, pseudonym, image, bio, created, verified, social usernames when present
     gamma  /comments?parent_entity_type=Event&parent_entity_id=<id>&limit&offset&order&ascending&holders_only&get_positions=true
     data   /v2/user-stats?user=    join date, markets traded, all-time PnL block (economic_pnl, volume_usdc)
     data   /v2/value?user=         current positions value
     data   /v2/positions?user=     open positions        data /v2/activity?user=   recent activity
   (Data API v1 + lb-api were retired on 2026-11-02; only v2 is used.) A block that fails or has no data is hidden, never filled with sample numbers.
   Classes are prefixed .ps- (css/psocial.css). */
(function(){
if (window.PSOC) return;
const U = window.U;
const esc = U.esc, fmt = U.fmt;
const GAMMA = "https://gamma-api.polymarket.com", DAPI = "https://data-api.polymarket.com/v2";
const now = () => Date.now();
const ADDR = /^0x[0-9a-fA-F]{40}$/;

/* ---------- formatting (en-US) ---------- */
const usd = (v, d = 2) => (v < 0 ? "-" : "") + "$" + fmt(Math.abs(v || 0), d);
const usdS = (v, d = 2) => (v > 0.004 ? "+" : v < -0.004 ? "-" : "") + "$" + fmt(Math.abs(v || 0), d);
const big = v => { const a = Math.abs(v); return a >= 1000 ? Math.round(v) : v; };           // whole dollars once >= $1,000
const usdB = v => usd(big(v), Math.abs(v) >= 1000 ? 0 : 2);
const usdSB = v => usdS(big(v), Math.abs(v) >= 1000 ? 0 : 2);
const cmp = v => { v = +v || 0; const a = Math.abs(v); return a >= 1e9 ? (v / 1e9).toFixed(1) + "B" : a >= 1e6 ? (v / 1e6).toFixed(1) + "M" : a >= 1e3 ? (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "K" : fmt(v, a < 10 && a % 1 ? 2 : 0); };
const cmpS = v => (v > 0.004 ? "+" : v < -0.004 ? "-" : "") + "$" + cmp(Math.abs(v));
const cents = p => { if (p == null || isNaN(p)) return "--"; const v = p * 100; return (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1)) + "¢"; };
const sgn = v => v > 0.004 ? "up" : v < -0.004 ? "down" : "";
const ago = ms => { const d = (now() - ms) / 1000; if (d < 60) return Math.max(1, Math.floor(d)) + "s ago"; if (d < 3600) return Math.floor(d / 60) + "m ago"; if (d < 86400) return Math.floor(d / 3600) + "h ago"; if (d < 86400 * 30) return Math.floor(d / 86400) + "d ago"; if (d < 86400 * 365) return Math.floor(d / 86400 / 30) + "mo ago"; return Math.floor(d / 86400 / 365) + "y ago"; };
const monYr = ms => new Date(ms).toLocaleDateString("en-US", {month: "short", year: "numeric"});
const shortAddr = a => a && a.length > 12 ? a.slice(0, 6) + "…" + a.slice(-4) : (a || "");
const nameOf = (o, a) => (o && (o.name || o.pseudonym)) || shortAddr(a) || "Trader";
const hap = (p = 6) => { try { U.buzz && U.buzz(p); } catch {} };
const SVG = {
  heart: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2 0 3.5 1.1 5.4 3.3 1.9-2.2 3.4-3.3 5.4-3.3 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z"/></svg>',
  chat: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/></svg>',
  chev: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  ext: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  x: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/></svg>',
  link: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>'
};

/* ---------- network: GET json, small concurrency gate, 5-minute memo ---------- */
async function getJ(url, ms = 10000){
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, {signal: ac.signal}); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
let active = 0; const waitQ = [];
function gate(fn){
  return new Promise((res, rej) => {
    const run = () => { active++; fn().then(res, rej).finally(() => { active--; const n = waitQ.shift(); if (n) n(); }); };
    active < 5 ? run() : waitQ.push(run);
  });
}
const MEMO = new Map();
function memo(key, fn, ttl = 300000){
  const h = MEMO.get(key); if (h && now() - h.t < ttl) return h.p;
  const p = gate(fn); MEMO.set(key, {t: now(), p});
  p.catch(() => { const c = MEMO.get(key); if (c && c.p === p) MEMO.delete(key); });
  return p;
}
const lc = a => String(a || "").toLowerCase();
const P = {
  prof: a => memo("pf" + lc(a), () => getJ(`${GAMMA}/public-profile?address=${a}`)).catch(() => null),
  stats: a => memo("st" + lc(a), () => getJ(`${DAPI}/user-stats?user=${a}`)).then(r => r && r.data ? r.data : null).catch(() => null),
  value: a => memo("vl" + lc(a), () => getJ(`${DAPI}/value?user=${a}`)).then(r => r && r.data && r.data.value != null ? +r.data.value : null).catch(() => null),
  pos: a => memo("ps" + lc(a), () => getJ(`${DAPI}/positions?user=${a}&limit=40`), 60000).then(r => Array.isArray(r && r.data) ? r.data : null).catch(() => null),
  act: a => memo("ac" + lc(a), () => getJ(`${DAPI}/activity?user=${a}&limit=30`), 60000).then(r => Array.isArray(r && r.data) ? r.data : null).catch(() => null)
};
/* all-time PnL in USD; null when the source has no figure (never coerced to 0) */
function pnlOf(st){ const p = st && st.all_time_pnl; if (!p) return null; for (const k of ["economic_pnl", "settled_pnl", "realized_pnl"]) if (p[k] != null && isFinite(p[k])) return +p[k]; return null; }

/* ---------- avatar: gradient letter underneath, image on top (removed when it fails) ---------- */
function avatar(src, seed, size){
  let h = 0; for (const ch of String(seed || "?")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const hue = h % 360;
  const l = esc((String(seed || "?").replace(/^0x/, "")[0] || "?").toUpperCase());
  return `<span class="ps-av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px;background:linear-gradient(135deg,hsl(${hue} 70% 58%),hsl(${(hue + 50) % 360} 75% 48%))">${l}${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}</span>`;
}

/* =====================================================================================================
   PROFILE SHEET
   ===================================================================================================== */
function profile(arg){
  const h = typeof arg === "string" ? {addr: arg} : (arg || {});
  const addr = h.addr || h.proxyWallet || h.proxy_wallet || h.address || "";
  if (!ADDR.test(addr)){ U.toast && U.toast("Profile unavailable for this trader", "bad"); return; }
  hap(8);
  let dead = false, tab = "pos", posD, actD;
  const body = `<div class="ps-prof" data-ps-prof>
    <div class="ps-head">${avatar(h.img || h.profileImage, h.name || addr, 60)}
      <div class="ps-hm"><b class="ps-nm" data-f="name">${esc(nameOf(h, addr))}</b><small class="ps-sub" data-f="sub"></small>
        <div class="ps-addr"><code title="${esc(addr)}">${esc(shortAddr(addr))}</code><button type="button" class="ps-cp" data-ps-copy aria-label="Copy address">${U.ic("copy", 14, 2)}</button></div></div></div>
    <div class="ps-meta" data-f="meta"></div><p class="ps-bio" data-f="bio" hidden></p><div class="ps-soc" data-f="soc"></div>
    <div class="ps-stats" data-f="stats"><span class="ps-sk"></span><span class="ps-sk"></span><span class="ps-sk"></span><span class="ps-sk"></span></div>
    <div class="ps-tabs" role="tablist"><button type="button" role="tab" data-ps-t="pos" class="on">Positions</button><button type="button" role="tab" data-ps-t="act">Activity</button></div>
    <div class="ps-list" data-f="list"><div class="ps-load"><span class="ps-spin"></span></div></div></div>`;
  U.sheet("Trader profile", body, el => {
    const q = s => el.querySelector(s), root = q("[data-ps-prof]"); if (!root) return;
    const f = k => root.querySelector(`[data-f="${k}"]`);
    root.addEventListener("click", e => {
      const t = e.target;
      if (t.closest("[data-ps-copy]")){ U.copyText(addr, "Address copied"); hap(6); return; }
      const tb = t.closest("[data-ps-t]"); if (tb){ tab = tb.dataset.psT; root.querySelectorAll("[data-ps-t]").forEach(x => x.classList.toggle("on", x === tb)); hap(4); drawList(); return; }
      const go = t.closest("[data-ps-go]"); if (go){ U.closeLayer(); location.hash = "#/predict/m/" + encodeURIComponent(go.dataset.psGo); return; }
    });
    function drawList(){
      const box = f("list"); if (!box || dead) return;
      const D = tab === "pos" ? posD : actD;
      if (D === undefined){ box.innerHTML = '<div class="ps-load"><span class="ps-spin"></span></div>'; return; }
      if (D === null){ box.innerHTML = `<div class="ps-fine">${tab === "pos" ? "Positions" : "Activity"} unavailable right now.</div>`; return; }
      if (!D.length){ box.innerHTML = UI.emptyState(tab === "pos" ? "target" : "history", tab === "pos" ? "No open positions." : "No recent activity."); return; }
      box.innerHTML = tab === "pos" ? posRows(D) : actRows(D);
    }
    const sk = f("stats");
    Promise.all([P.prof(addr), P.stats(addr), P.value(addr)]).then(([pf, st, val]) => {
      if (dead) return;
      if (pf){
        const nm = pf.name || pf.pseudonym; if (nm) f("name").textContent = nm;
        f("name").insertAdjacentHTML("beforeend", pf.verifiedBadge ? ' <i class="ps-ver" title="Verified">✓</i>' : "");
        if (pf.name && pf.pseudonym && pf.pseudonym !== pf.name) f("sub").textContent = pf.pseudonym;
        const img = pf.profileImage; const av = root.querySelector(".ps-head .ps-av"); if (img && av && !av.querySelector("img")) av.insertAdjacentHTML("beforeend", `<img src="${esc(img)}" alt="" onerror="this.remove()">`);
        if (pf.bio){ const b = f("bio"); b.textContent = pf.bio; b.hidden = false; }
      }
      const joinMs = st && st.join_date ? st.join_date * 1000 : pf && pf.createdAt ? Date.parse(pf.createdAt) : NaN;
      const meta = []; if (isFinite(joinMs)) meta.push("Joined " + monYr(joinMs)); if (st && st.views != null) meta.push(fmt(st.views, 0) + " profile views");
      f("meta").textContent = meta.join(" · ");
      const links = [], px = pf || {}, un = v => String(v || "").replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").split(/[/?]/)[0];
      const xu = un(px.xUsername || px.twitterUsername || px.twitter || px.x);
      if (xu) links.push(`<a class="ps-lk" href="https://x.com/${encodeURIComponent(xu)}" target="_blank" rel="noopener noreferrer">${SVG.x}@${esc(xu)}</a>`);
      const site = px.website || px.websiteUrl || px.url; if (/^https?:\/\//i.test(site || "")) links.push(`<a class="ps-lk" href="${esc(site)}" target="_blank" rel="noopener noreferrer">${SVG.link}Website</a>`);
      const wl = (pf && pf.proxyWallet) || addr;
      links.push(`<a class="ps-lk" href="https://polygonscan.com/address/${esc(wl)}" target="_blank" rel="noopener noreferrer">${SVG.ext}Polygonscan</a>`, `<a class="ps-lk" href="https://polymarket.com/profile/${esc(wl)}" target="_blank" rel="noopener noreferrer">${SVG.ext}Polymarket</a>`);
      f("soc").innerHTML = links.join("");
      /* stat card: only real numbers */
      const pnl = pnlOf(st), vol = st && st.all_time_pnl && st.all_time_pnl.volume_usdc != null ? +st.all_time_pnl.volume_usdc : null;
      const tiles = [];
      if (pnl != null) tiles.push(["All-time PnL", usdSB(pnl), sgn(pnl)]);
      if (val != null) tiles.push(["Positions value", usdB(val), ""]);
      if (vol != null) tiles.push(["Volume", usdB(vol), ""]);
      if (st && st.trades != null) tiles.push(["Markets traded", fmt(st.trades, 0), ""]);
      if (st && st.biggest_win > 0) tiles.push(["Biggest win", usdB(st.biggest_win), "up"]);
      if (tiles.length) sk.innerHTML = tiles.map(([k, v, c]) => `<div class="ps-tile"><small>${k}</small><b class="num ${c}">${v}</b></div>`).join(""); else sk.remove();
    });
    P.pos(addr).then(r => { if (r) r.sort((a, b) => (+b.current_value || 0) - (+a.current_value || 0)); posD = r; if (tab === "pos") drawList(); });
    P.act(addr).then(r => { actD = r; if (tab === "act") drawList(); });
  }, () => { dead = true; });
}
function posRows(L){
  return L.map(p => {
    const pct = p.percent_pnl != null ? +p.percent_pnl : null, tp = p.total_pnl != null ? +p.total_pnl : (+p.unrealized_pnl || 0);
    return `<div class="ps-row" ${p.event_slug ? `data-ps-go="${esc(p.event_slug)}" role="button" tabindex="0"` : ""}>${p.icon ? `<img class="ps-ico" src="${esc(p.icon)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="ps-ico"></span>'}
      <div class="ps-rm"><b>${esc(p.title)}</b>
        <span><em class="${+p.outcome_index === 1 ? "down" : "up"}">${esc(p.outcome || "")}</em> <span class="num">${fmt(p.current_size, 2)} @ ${cents(+p.avg_price)}</span></span></div>
      <div class="ps-rr"><b class="num">${usd(+p.current_value || 0)}</b><small class="num ${sgn(tp)}">${usdS(tp)}${pct != null && isFinite(pct) ? ` (${pct > 0 ? "+" : ""}${fmt(pct, 1)}%)` : ""}</small></div></div>`;
  }).join("");
}
const ACT = {TRADE: "Trade", REDEEM: "Redeemed", YIELD: "Yield reward", REWARD: "Reward", DEPOSIT: "Deposit", WITHDRAW: "Withdrawal", WITHDRAWAL: "Withdrawal", SPLIT: "Split", MERGE: "Merged", CONVERSION: "Converted", MAKER_REBATE: "Maker rebate", REFERRAL_REWARD: "Referral reward"};
function actRows(L){
  return L.map(a => {
    const tr = a.type === "TRADE", sell = a.side === "SELL", t = (+a.timestamp || 0) * 1000;
    const lead = tr ? (sell ? "Sold" : "Bought") : (ACT[a.type] || String(a.type || "Activity").replace(/_/g, " ").toLowerCase().replace(/^./, c => c.toUpperCase()));
    const det = tr ? `<em class="${+a.outcome_index === 1 ? "down" : "up"}">${esc(a.outcome || "")}</em> <span class="num">${fmt(a.size, 2)} @ ${cents(+a.price)}</span>` : a.outcome ? `<em>${esc(a.outcome)}</em> <span class="num">${fmt(a.size, 2)}</span>` : "";
    return `<div class="ps-row" ${a.event_slug ? `data-ps-go="${esc(a.event_slug)}" role="button" tabindex="0"` : ""}>${a.icon ? `<img class="ps-ico" src="${esc(a.icon)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="ps-ico ps-ico-t"></span>'}
      <div class="ps-rm"><b>${esc(lead)}${a.title ? " · " + esc(a.title) : ""}</b><span>${det}</span></div>
      <div class="ps-rr"><b class="num">${usd(+a.usdc_size || 0)}</b><small>${t ? ago(t) : ""}</small></div></div>`;
  }).join("");
}

/* =====================================================================================================
   COMMENTS (read-only)
   ===================================================================================================== */
const PAGE = 20, POLL = 20000;
function comments(box, ev){
  if (!box || !ev || !ev.id) return () => {};
  let dead = false, order = "createdAt", holdersOnly = false, off = 0, more = false, loading = false, failed = false, first = true;
  const items = new Map(), openReps = new Set(), seenNew = new Set();
  const tok = new Map();   // token id → {outcome, idx, label}
  (ev.markets || []).forEach(m => (m.tokens || []).forEach((t, i) => tok.set(String(t), {outcome: (m.outs && m.outs[i]) || (i ? "No" : "Yes"), idx: i, label: ev.markets.length > 1 ? (m.gt || m.q || "") : ""})));
  box.innerHTML = `<div class="ps-cm" data-ps-cm><div class="ps-cm-bar"><div class="ps-seg" role="tablist" aria-label="Sort comments"><button type="button" data-ps-sort="createdAt" class="on">Newest</button><button type="button" data-ps-sort="reactionCount">Top</button><button type="button" data-ps-sort="holders">Holders</button></div></div>
    <div class="ps-cm-list" data-ps-list aria-live="polite"></div><div class="ps-cm-foot" data-ps-foot></div><div class="ps-fine">Comments from Polymarket. Read-only.</div></div>`;
  const root = box.firstElementChild, listEl = root.querySelector("[data-ps-list]"), footEl = root.querySelector("[data-ps-foot]");
  const url = (o, n) => `${GAMMA}/comments?parent_entity_type=Event&parent_entity_id=${encodeURIComponent(ev.id)}&limit=${n}&offset=${o}&order=${order}&ascending=false&get_positions=true${holdersOnly ? "&holders_only=true" : ""}`;
  const addrOf = c => (c.profile && c.profile.proxyWallet) || c.userAddress || "";

  function sortedTop(){
    const top = [...items.values()].filter(c => !c.parentCommentID || !items.has(String(c.parentCommentID)));
    top.sort(order === "reactionCount" ? (a, b) => (b.reactionCount || 0) - (a.reactionCount || 0) || Date.parse(b.createdAt) - Date.parse(a.createdAt) : (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return top;
  }
  function rootOf(c){ let p = c, n = 0; while (p.parentCommentID && items.has(String(p.parentCommentID)) && n++ < 6) p = items.get(String(p.parentCommentID)); return p; }
  function badge(c){
    const ps = (c.profile && c.profile.positions) || []; let best = null;
    ps.forEach(p => { const t = tok.get(String(p.tokenId)), s = (+p.positionSize || 0) / 1e6; if (t && s > 0 && (!best || s > best.s)) best = {t, s}; });
    return best ? `<span class="ps-pos ${best.t.idx ? "down" : "up"}" title="${esc(best.t.label ? best.t.label + " · " : "")}Holds ${fmt(best.s, 2)} ${esc(best.t.outcome)}">${esc(cmp(best.s))} ${esc(best.t.outcome)}${best.t.label ? ` <i>${esc(best.t.label)}</i>` : ""}</span>` : "";
  }
  function mini(a){
    if (!ADDR.test(a)) return "";
    return `<button type="button" class="ps-mini" data-ps-user="${esc(a)}" data-ps-mini="${esc(lc(a))}" aria-label="Open trader profile"><small>PnL</small><b class="num">--</b><small>Portfolio</small><b class="num">--</b></button>`;
  }
  function one(c, isRep){
    const pr = c.profile || {}, a = addrOf(c), nm = nameOf(pr, a), pa = lc(pr.proxyWallet || c.userAddress);
    const t = Date.parse(c.createdAt), isNew = seenNew.has(c.id);
    const reps = isRep ? [] : (c._reps || []);
    let to = ""; if (isRep && c.replyAddress){ const tgt = [...items.values()].find(x => lc(x.userAddress) === lc(c.replyAddress)); if (tgt) to = `<span class="ps-to">↪ ${esc(nameOf(tgt.profile, tgt.userAddress))}</span>`; }
    return `<article class="ps-c${isRep ? " rep" : ""}${isNew ? " fresh" : ""}" data-cid="${esc(c.id)}">
      <div class="ps-c-h"><button type="button" class="ps-c-u" data-ps-user="${esc(a)}" aria-label="${esc(nm)} profile">${avatar(pr.profileImage, nm, isRep ? 28 : 34)}</button>
        <div class="ps-c-n"><button type="button" class="ps-c-nm" data-ps-user="${esc(a)}">${esc(nm)}</button><span class="ps-c-s">${badge(c)}<span class="ps-time">${isFinite(t) ? ago(t) : ""}</span></span></div>${mini(pa)}</div>
      ${to}<p class="ps-c-t">${esc(c.body || "")}</p>
      <div class="ps-c-f"><span class="ps-lk-n ${c.reactionCount ? "has" : ""}">${SVG.heart}<span class="num">${fmt(c.reactionCount || 0, 0)}</span></span>
        ${reps.length ? `<button type="button" class="ps-rt${openReps.has(c.id) ? " open" : ""}" data-ps-rep="${esc(c.id)}">${SVG.chev}<span>${openReps.has(c.id) ? "Hide" : "View"} ${reps.length} ${reps.length === 1 ? "reply" : "replies"}</span></button>` : ""}</div>
      ${reps.length ? `<div class="ps-reps" ${openReps.has(c.id) ? "" : "hidden"}>${reps.map(r => one(r, true)).join("")}</div>` : ""}</article>`;
  }
  let lastSig = "";
  function draw(){
    if (dead) return;
    const top = sortedTop();
    top.forEach(c => { c._reps = []; });
    [...items.values()].filter(c => c.parentCommentID && items.has(String(c.parentCommentID))).forEach(c => { const r = rootOf(c); (r._reps || (r._reps = [])).push(c); });
    top.forEach(c => c._reps.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)));
    const sig = top.map(c => c.id + ":" + (c.reactionCount || 0) + ":" + c._reps.length + ":" + c._reps.map(r => r.reactionCount || 0).join(",") + ":" + (openReps.has(c.id) ? 1 : 0)).join("|") + "|" + order + holdersOnly + loading + failed + more;
    if (!first && sig === lastSig && !draw.tick){ return; } lastSig = sig; draw.tick = false;
    if (failed && !top.length) listEl.innerHTML = `<div class="ps-err"><span>Couldn't load comments.</span><button type="button" data-ps-retry>Retry</button></div>`;
    else if (loading && !top.length) listEl.innerHTML = `<div class="ps-load"><span class="ps-spin"></span></div>`;
    else if (!top.length) listEl.innerHTML = UI.emptyState("file", holdersOnly ? "No holder comments yet." : "No comments yet.");
    else listEl.innerHTML = top.map(c => one(c, false)).join("");
    footEl.innerHTML = more && top.length ? `<button type="button" class="ps-more" data-ps-more ${loading ? "disabled" : ""}>${loading ? "Loading…" : "Load more comments"}</button>` : "";
    hydrate();
  }
  /* mini PnL cards: fetched lazily when they scroll into view */
  let io = null;
  try { io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting){ io.unobserve(e.target); load(e.target.dataset.psMini); } }), {rootMargin: "200px"}); } catch {}
  const filled = new Map();
  function paint(a, d){ root.querySelectorAll(`[data-ps-mini="${a}"]`).forEach(el => { const b = el.querySelectorAll("b"); const [p, v] = d;
    if (p == null && !v){ el.classList.add("none"); return; }   // no data and nothing held: hide the card
    el.classList.remove("none"); b[0].textContent = p == null ? "--" : cmpS(p); b[0].className = "num " + (p == null ? "" : sgn(p)); b[1].textContent = v == null ? "--" : "$" + cmp(v); }); }
  function load(a){ if (filled.has(a)) return; filled.set(a, null); Promise.all([P.stats(a), P.value(a)]).then(([st, v]) => { if (dead) return; const d = [pnlOf(st), v]; filled.set(a, d); paint(a, d); }); }
  function hydrate(){ root.querySelectorAll("[data-ps-mini]").forEach(el => { const a = el.dataset.psMini, d = filled.get(a); if (d) paint(a, d); else if (io && !filled.has(a)) io.observe(el); else if (!io) load(a); }); }

  async function fetchPage(reset){
    if (loading) return; loading = true; failed = false; if (reset){ off = 0; items.clear(); first = true; } draw();
    try {
      const arr = await getJ(url(reset ? 0 : off, PAGE), 12000); if (dead) return;
      const rows = Array.isArray(arr) ? arr : []; let topN = 0;
      rows.forEach(c => { if (!c.parentCommentID) topN++; items.set(String(c.id), Object.assign({}, c, {id: String(c.id)})); });
      off += topN; more = topN >= PAGE;
    } catch { if (dead) return; failed = true; }
    loading = false; first = false; draw.tick = true; draw();
  }
  let polls = 0;
  async function poll(){
    if (dead || loading || document.hidden || !box.isConnected) return;
    try {
      const arr = await getJ(url(0, PAGE), 12000); if (dead || !Array.isArray(arr)) return; let changed = false;
      arr.forEach(c => { const id = String(c.id), o = items.get(id); if (!o){ items.set(id, Object.assign({}, c, {id})); seenNew.add(id); changed = true; setTimeout(() => { seenNew.delete(id); const el = root.querySelector(`[data-cid="${id}"]`); if (el) el.classList.remove("fresh"); }, 4000); } else if (o.reactionCount !== c.reactionCount || o.body !== c.body){ o.reactionCount = c.reactionCount; o.body = c.body; changed = true; } });
      if (changed || ++polls % 3 === 0){ draw.tick = true; draw(); }   // repaint on change, and every ~minute so "2m ago" stays current
    } catch {}
  }
  const timer = setInterval(poll, POLL);

  root.addEventListener("click", e => {
    const t = e.target;
    const us = t.closest("[data-ps-user]"); if (us){ const art = us.closest("[data-cid]"), c = art && items.get(art.dataset.cid), pr = c && c.profile || {}; profile({addr: us.dataset.psUser, name: pr.name || pr.pseudonym, img: pr.profileImage}); return; }
    const rp = t.closest("[data-ps-rep]"); if (rp){ const id = rp.dataset.psRep; openReps.has(id) ? openReps.delete(id) : openReps.add(id); hap(4); draw.tick = true; draw(); return; }
    const so = t.closest("[data-ps-sort]"); if (so){
      const k = so.dataset.psSort;
      if (k === "holders"){ holdersOnly = !holdersOnly; so.classList.toggle("on", holdersOnly); }
      else { if (k === order) return; order = k; root.querySelectorAll("[data-ps-sort]:not([data-ps-sort=holders])").forEach(x => x.classList.toggle("on", x === so)); }
      hap(4); more = false; fetchPage(true); return;
    }
    if (t.closest("[data-ps-more]")){ hap(4); fetchPage(false); return; }
    if (t.closest("[data-ps-retry]")){ fetchPage(true); return; }
  });
  fetchPage(true);
  return function unmount(){ dead = true; clearInterval(timer); try { io && io.disconnect(); } catch {} };
}

window.PSOC = {profile, comments, _api: P};
})();
