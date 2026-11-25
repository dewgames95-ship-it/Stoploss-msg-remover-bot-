/* ===== Shareable PnL card: UI.sharePnl({...}) — poster drawn on a 2D canvas (preview + PNG export) ===== */
(function(){
const {esc, ic, store, toast} = U;
const W = 720, H = 1040;
const THEMES = [
  {n:"Night",  bg:["#050B1A","#0A1C3A","#06101F"], ray:"90,169,255", acc:"#5AA9FF", coin:["#BFD9FF","#4F8DFF"], line:"#5AA9FF"},
  {n:"Carbon", bg:["#0A0A0A","#1B1710","#0A0A0A"], ray:"247,181,0",  acc:"#F7B500", coin:["#FFE08A","#E0A100"], line:"#F7B500"},
  {n:"Aurora", bg:["#03100F","#073A38","#04100F"], ray:"34,211,190", acc:"#22D3BE", coin:["#B8FFF2","#1CB5A3"], line:"#22D3BE"}
];
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const rng = seed => { let a = 0; for (const ch of String(seed)) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const num = (v, d = 2) => Number(v).toLocaleString("en-US", {minimumFractionDigits: d, maximumFractionDigits: d});
const px = v => { v = Number(v); if (!isFinite(v)) return "-"; return num(v, v >= 1000 ? 2 : v >= 10 ? 3 : v >= 1 ? 4 : 6); };
const FONT = '"Manrope", system-ui, -apple-system, "Segoe UI", sans-serif';

function qrMatrix(text){
  try { if (typeof window.qrcode !== "function") return null; const q = window.qrcode(0, "M"); q.addData(text); q.make(); const n = q.getModuleCount(), m = [];
    for (let r = 0; r < n; r++){ m.push([]); for (let c = 0; c < n; c++) m[r].push(q.isDark(r, c)); } return m; } catch { return null; }
}
function logo(c, x, y, s){
  const g = c.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, "#2E6BFF"); g.addColorStop(1, "#5AA9FF");
  rr(c, x, y, s, s, s * .28); c.fillStyle = g; c.fill();
  c.strokeStyle = "#fff"; c.lineWidth = s * .095; c.lineCap = c.lineJoin = "round"; c.beginPath();
  c.moveTo(x + s * .234, y + s * .656); c.lineTo(x + s * .39, y + s * .484); c.lineTo(x + s * .516, y + s * .594); c.lineTo(x + s * .75, y + s * .328); c.stroke();
  c.beginPath(); c.arc(x + s * .75, y + s * .312, s * .078, 0, 7); c.fillStyle = "#fff"; c.fill();
}
function art(c, th, seed, up){
  const r = rng(seed);
  // light rays from the top-right
  const ox = W * .88, oy = -40;
  for (let i = 0; i < 9; i++){
    const a = Math.PI * (.58 + r() * .42), w = .035 + r() * .07, len = 1100;
    const g = c.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
    g.addColorStop(0, `rgba(${th.ray},${.20 + r() * .16})`); g.addColorStop(1, `rgba(${th.ray},0)`);
    c.fillStyle = g; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(a - w) * len, oy + Math.sin(a - w) * len); c.lineTo(ox + Math.cos(a + w) * len, oy + Math.sin(a + w) * len); c.closePath(); c.fill();
  }
  const glow = c.createRadialGradient(ox, 60, 0, ox, 60, 520); glow.addColorStop(0, `rgba(${th.ray},.28)`); glow.addColorStop(1, `rgba(${th.ray},0)`); c.fillStyle = glow; c.fillRect(0, 0, W, 700);
  // faint grid
  c.strokeStyle = "rgba(255,255,255,.035)"; c.lineWidth = 1;
  for (let x = 0; x <= W; x += 60){ c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  // chart line + area across the lower part
  const pts = []; let v = up ? 0 : 1;
  for (let i = 0; i <= 28; i++){ v += (r() - (up ? .38 : .62)) * .16; v = Math.max(-.2, Math.min(1.2, v)); pts.push([i / 28 * W, 760 - v * 170 - (up ? i * 4 : -i * 2)]); }
  c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.lineTo(W, 830); c.lineTo(0, 830); c.closePath();
  const ag = c.createLinearGradient(0, 560, 0, 830); ag.addColorStop(0, `rgba(${th.ray},.22)`); ag.addColorStop(1, `rgba(${th.ray},0)`); c.fillStyle = ag; c.fill();
  c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.strokeStyle = th.line; c.globalAlpha = .75; c.lineWidth = 3; c.lineJoin = "round"; c.stroke(); c.globalAlpha = 1;
  const last = pts[pts.length - 1]; c.beginPath(); c.arc(last[0] - 14, last[1], 7, 0, 7); c.fillStyle = "#fff"; c.fill();
  // coins
  [[600, 255, 62, .95], [655, 372, 36, .7], [540, 150, 30, .6], [96, 905, 40, .35]].forEach(([x, y, rad, al]) => {
    c.save(); c.globalAlpha = al; const g = c.createRadialGradient(x - rad * .35, y - rad * .4, rad * .1, x, y, rad); g.addColorStop(0, th.coin[0]); g.addColorStop(1, th.coin[1]);
    c.beginPath(); c.arc(x, y, rad, 0, 7); c.fillStyle = g; c.shadowColor = `rgba(${th.ray},.5)`; c.shadowBlur = 30; c.fill(); c.shadowBlur = 0;
    c.beginPath(); c.arc(x, y, rad * .78, 0, 7); c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = Math.max(2, rad * .06); c.stroke();
    c.fillStyle = "rgba(255,255,255,.75)"; c.font = `800 ${rad * .9}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", x, y + rad * .04); c.restore();
  });
}
function drawCard(cv, d, ti){
  const th = THEMES[ti], c = cv.getContext("2d"), pos = Number(d.roi) >= 0, G = pos ? "#2EE6A6" : "#FF5C70", short = d.side === "short" || d.side === "down";
  cv.width = W; cv.height = H; c.clearRect(0, 0, W, H);
  const bg = c.createLinearGradient(0, 0, W * .6, H); bg.addColorStop(0, th.bg[0]); bg.addColorStop(.5, th.bg[1]); bg.addColorStop(1, th.bg[2]);
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  art(c, th, (d.sym || "x") + ti + (d.roi | 0), pos);
  c.textBaseline = "alphabetic"; c.textAlign = "left";
  // header
  logo(c, 48, 48, 52); c.fillStyle = "#fff"; c.font = `800 30px ${FONT}`; c.fillText((window.CONFIG && CONFIG.APP_NAME) || "NovaTrade", 112, 84);
  c.fillStyle = "rgba(255,255,255,.5)"; c.font = `600 18px ${FONT}`; c.fillText(d.product ? d.product + " PnL" : "PnL", 112, 108 + 0);
  // pair + side
  const label = d.label || d.sym || "-"; c.fillStyle = "#fff"; c.font = `800 44px ${FONT}`; c.fillText(label, 48, 220);
  let x = 48 + c.measureText(label).width + 18;
  const sideTxt = ({long:"Long", short:"Short", up:"Up", down:"Down"})[d.side] || "", sc = (d.side === "long" || d.side === "up") ? "#2EE6A6" : "#FF5C70";
  if (sideTxt){ c.font = `800 22px ${FONT}`; const tw = c.measureText(sideTxt).width + 28; rr(c, x, 186, tw, 44, 10); c.fillStyle = sc + "26"; c.fill(); c.strokeStyle = sc + "99"; c.lineWidth = 1.5; c.stroke(); c.fillStyle = sc; c.fillText(sideTxt, x + 14, 217); x += tw + 12; }
  const meta = [d.lev ? d.lev + "x" : "", d.mode || ""].filter(Boolean).join("  |  ");
  if (meta){ c.font = `700 22px ${FONT}`; c.fillStyle = "rgba(255,255,255,.62)"; c.fillText(meta, x, 217); }
  // ROI
  c.fillStyle = "rgba(255,255,255,.55)"; c.font = `600 24px ${FONT}`; c.fillText(d.product === "Binary" || d.product === "Options" ? "Return" : "ROI", 48, 330);
  const roiTxt = (pos ? "+" : "") + num(d.roi, 2) + "%";
  let fs = 150; c.font = `800 ${fs}px ${FONT}`; while (c.measureText(roiTxt).width > W - 96 && fs > 60){ fs -= 6; c.font = `800 ${fs}px ${FONT}`; }
  c.save(); c.shadowColor = G + "88"; c.shadowBlur = 40; c.fillStyle = G; c.fillText(roiTxt, 46, 330 + fs * .86); c.restore();
  const y0 = 330 + fs * .86 + 52;
  c.fillStyle = "rgba(255,255,255,.55)"; c.font = `600 24px ${FONT}`; c.fillText("PnL (USDT)", 48, y0);
  c.fillStyle = G; c.font = `800 52px ${FONT}`; c.fillText((Number(d.pnl) >= 0 ? "+" : "") + num(d.pnl, 2), 48, y0 + 62);
  // price rows
  const ry = 700; rr(c, 40, ry, W - 80, 150, 22); c.fillStyle = "rgba(6,14,32,.72)"; c.fill(); c.strokeStyle = "rgba(255,255,255,.14)"; c.lineWidth = 1.5; c.stroke();
  [["Entry price", d.entry], ["Mark price", d.mark]].forEach(([k, v], i) => { const yy = ry + 56 + i * 56; c.font = `600 24px ${FONT}`; c.fillStyle = "rgba(255,255,255,.58)"; c.textAlign = "left"; c.fillText(k, 72, yy); c.font = `800 28px ${FONT}`; c.fillStyle = "#fff"; c.textAlign = "right"; c.fillText(px(v), W - 72, yy); });
  c.textAlign = "left";
  // footer: invite + QR
  const fy = 890, code = (store.s.profile && store.s.profile.ref) || "NOVA", url = location.origin + location.pathname + "#/referral?ref=" + code;
  rr(c, 40, fy, W - 80, 118, 22); c.fillStyle = "rgba(255,255,255,.96)"; c.fill();
  c.fillStyle = "#6B7280"; c.font = `600 18px ${FONT}`; c.fillText(new Date(d.time || Date.now()).toLocaleString("en-GB", {day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"}), 68, fy + 38);
  c.fillStyle = "#6B7280"; c.font = `600 20px ${FONT}`; c.fillText("Invite code", 68, fy + 72);
  c.fillStyle = "#0B0E14"; c.font = `800 34px ${FONT}`; c.fillText(code, 68, fy + 104);
  const qs = 86, qx = W - 40 - 16 - qs, qy = fy + 16, m = qrMatrix(url);
  if (m){ const cs = qs / m.length; c.fillStyle = "#0B0E14"; for (let r = 0; r < m.length; r++) for (let k = 0; k < m.length; k++) if (m[r][k]) c.fillRect(Math.floor(qx + k * cs), Math.floor(qy + r * cs), Math.ceil(cs), Math.ceil(cs)); }
  else { rr(c, qx, qy, qs, qs, 10); c.strokeStyle = "#0B0E14"; c.lineWidth = 3; c.stroke(); c.fillStyle = "#0B0E14"; const r = rng(code); for (let i = 0; i < 7; i++) for (let k = 0; k < 7; k++) if (r() > .5) c.fillRect(qx + 12 + k * 9, qy + 12 + i * 9, 8, 8); }
  return url;
}
function shareText(d){ const code = (store.s.profile && store.s.profile.ref) || ""; return `${d.label || d.sym} ${({long:"Long", short:"Short", up:"Up", down:"Down"})[d.side] || ""}${d.lev ? " " + d.lev + "x" : ""}: ROI ${Number(d.roi) >= 0 ? "+" : ""}${num(d.roi)}%, PnL ${Number(d.pnl) >= 0 ? "+" : ""}${num(d.pnl)} USDT. Entry ${px(d.entry)}, Mark ${px(d.mark)}. Trade with me on NovaTrade, invite code ${code}: ${location.origin + location.pathname}#/referral?ref=${code}`; }

UI.sharePnl = function(d){
  d = d || {}; let ti = 0;
  const el = U.modal(`<div class="shr"><div class="shr-top"><b>Share your PnL</b><button class="icon-btn" data-close aria-label="Close">${ic("close",18)}</button></div>
    <div class="shr-cv"><canvas id="shcv" aria-label="PnL share card"></canvas></div>
    <div class="shr-dots" role="radiogroup" aria-label="Card style">${THEMES.map((t, i) => `<button data-th="${i}" role="radio" aria-label="${t.n}" class="${i === 0 ? "on" : ""}" style="--c:${t.acc};background:linear-gradient(135deg,${t.bg[1]},${t.acc})"></button>`).join("")}</div>
    <div class="shr-act"><button class="shr-b pri" data-save>${ic("down",16)} Save image</button><button class="shr-b" data-copy>${ic("copy",16)} Copy</button><button class="shr-b" data-share>${ic("share",16)} Share</button></div></div>`, el => {
    const cv = el.querySelector("#shcv"), draw = () => drawCard(cv, d, ti);
    draw();
    (document.fonts && document.fonts.ready || Promise.resolve()).then(() => { if (el.isConnected && el.querySelector("#shcv")) draw(); });
    el.querySelector("[data-close]").onclick = () => U.closeLayer();
    el.querySelectorAll("[data-th]").forEach(b => b.onclick = () => { ti = +b.dataset.th; el.querySelectorAll("[data-th]").forEach(x => x.classList.toggle("on", x === b)); draw(); });
    el.querySelector("[data-copy]").onclick = () => U.copyText(shareText(d), "Text copied");
    el.querySelector("[data-share]").onclick = async () => {
      const text = shareText(d);
      try { if (navigator.share){ await navigator.share({title: (window.CONFIG && CONFIG.APP_NAME) || "NovaTrade", text}); return; } } catch (e) { if (e && e.name === "AbortError") return; }
      U.copyText(text, "Text copied");
    };
    el.querySelector("[data-save]").onclick = () => {
      draw();
      cv.toBlob(async blob => {
        if (!blob){ toast("Could not create image", "bad"); return; }
        const name = `novatrade-pnl-${(d.sym || "card")}-${Date.now()}.png`, file = (typeof File === "function") ? new File([blob], name, {type:"image/png"}) : null;
        UI._lastShare = {size: blob.size, name};
        try { if (file && navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], text:shareText(d)}); return; } } catch (e) { if (e && e.name === "AbortError") return; }
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast("Image saved", "ok");
      }, "image/png");
    };
  });
  return el;
};
})();
