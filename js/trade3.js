/* v6.6 trade layer: celebratory money animation for winning binary trades */
(function(){
const EMO = ["💵","💰","🪙","💵","🪙","💰","💸"];
function flyMoney(){
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = document.createElement("div"); box.className = "tx-fly"; box.setAttribute("aria-hidden", "true");
    const n = 22;
    for (let i = 0; i < n; i++){
      const e = document.createElement("span"), up = i % 2 === 0;
      e.textContent = EMO[(Math.random() * EMO.length) | 0];
      e.className = up ? "u" : "d";
      e.style.left = (4 + Math.random() * 90) + "%";
      e.style.fontSize = (20 + Math.random() * 18) + "px";
      e.style.animationDelay = (Math.random() * 0.9) + "s";
      e.style.animationDuration = (1.9 + Math.random() * 1.1) + "s";
      e.style.setProperty("--dx", ((Math.random() - .5) * 90) + "px");
      e.style.setProperty("--rot", ((Math.random() - .5) * 120) + "deg");
      box.appendChild(e);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 4200);
  } catch {}
}
function clearFx(){ document.querySelectorAll(".tx-fly,.confetti").forEach(e => e.remove()); }
window.TX = {flyMoney, clearFx};
})();
