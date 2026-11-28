/* ===== v7.4 Tutorial: feature cards + full-screen step-by-step tutorials with small mock screens =====
   window.TUT = { cardsHtml(), bind(root), open(key) }.  Loaded lazily by page-home.js / page-extra.js if index.html has no tag. */
(function(){
if (window.TUT) return;
const U = window.U, esc = U.esc, ic = U.ic;
if (!document.querySelector('link[href*="css/tutorial.css"]')){ const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "css/tutorial.css?v=7.4"; document.head.appendChild(l); }

/* ---------- mini mock-screen builder: elements stacked top to bottom inside a phone frame ---------- */
const W = 232, PAD = 10, IW = W - PAD * 2, GAP = 7;
const T = (x, y, s, cls, a) => `<text x="${x}" y="${y}" class="${cls}" font-size="${s}"${a ? ` text-anchor="${a}"` : ""}>`;
const HL = (x, y, w, h) => `<rect class="tt-ring" x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="9"/><circle class="tt-tap" cx="${x + w - 12}" cy="${y + h - 2}" r="6"/>`;
const E = {
  bar: ([t, hl]) => [24, y => `<rect x="${PAD}" y="${y}" width="${IW}" height="24" rx="7" class="tm-card"/>${T(PAD + 9, y + 16, 11, "tm-tx b")}${esc(t)}</text>${T(W - PAD - 9, y + 16, 10, "tm-mu", "end")}▾</text>${hl ? HL(PAD, y, IW, 24) : ""}`],
  chart: ([dir]) => [56, y => { const u = dir !== "dn", pts = u ? [44, 38, 40, 30, 32, 24, 14, 6] : [8, 14, 12, 22, 30, 28, 40, 48]; const c = u ? "tm-upS" : "tm-dnS", d = pts.map((v, i) => (i ? "L" : "M") + (PAD + 8 + i * (IW - 16) / 7).toFixed(1) + " " + (y + 4 + v).toFixed(1)).join("");
    return `<rect x="${PAD}" y="${y}" width="${IW}" height="56" rx="8" class="tm-card"/><path d="${d}" class="${c}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M${PAD + 8} ${y + 28}H${W - PAD - 8}" class="tm-ln" stroke-dasharray="3 3"/>`; }],
  tabs: ([labels, hl]) => [22, y => { const n = labels.length, w = IW / n; return `<rect x="${PAD}" y="${y}" width="${IW}" height="22" rx="7" class="tm-card"/>` + labels.map((l, i) => `${i === (hl ?? 0) ? `<rect x="${PAD + i * w + 2}" y="${y + 2}" width="${w - 4}" height="18" rx="6" class="tm-sel"/>` : ""}${T(PAD + i * w + w / 2, y + 15, 10, i === (hl ?? 0) ? "tm-tx b" : "tm-mu", "middle")}${esc(l)}</text>`).join("") + (hl != null ? HL(PAD + hl * w + 2, y + 2, w - 4, 18) : ""); }],
  chips: ([labels, hl]) => [22, y => { let x = PAD, o = ""; labels.forEach((l, i) => { const w = 14 + l.length * 6.2; o += `<rect x="${x}" y="${y}" width="${w}" height="22" rx="11" class="${i === hl ? "tm-sel" : "tm-card"}"/>${T(x + w / 2, y + 15, 10, i === hl ? "tm-tx b" : "tm-mu", "middle")}${esc(l)}</text>`; if (i === hl) o += HL(x, y, w, 22); x += w + 6; }); return o; }],
  field: ([l, v, hl]) => [26, y => `<rect x="${PAD}" y="${y}" width="${IW}" height="26" rx="7" class="tm-card"/>${T(PAD + 9, y + 17, 10, "tm-mu")}${esc(l)}</text>${T(W - PAD - 9, y + 17, 11, "tm-tx b", "end")}${esc(v)}</text>${hl ? HL(PAD, y, IW, 26) : ""}`],
  slider: ([p, hl]) => [18, y => { const x = PAD + 6 + (IW - 12) * p; return `<path d="M${PAD + 6} ${y + 9}H${W - PAD - 6}" class="tm-ln" stroke-width="4" stroke-linecap="round"/><path d="M${PAD + 6} ${y + 9}H${x}" class="tm-blS" stroke-width="4" stroke-linecap="round"/><circle cx="${x}" cy="${y + 9}" r="7" class="tm-bl"/>${hl ? HL(x - 9, y, 18, 18) : ""}`; }],
  toggle: ([l, on, hl]) => [24, y => `<rect x="${PAD}" y="${y}" width="${IW}" height="24" rx="7" class="tm-card"/>${T(PAD + 9, y + 16, 10.5, "tm-tx")}${esc(l)}</text><rect x="${W - PAD - 36}" y="${y + 5}" width="28" height="14" rx="7" class="${on ? "tm-bl" : "tm-ln2"}"/><circle cx="${W - PAD - (on ? 15 : 29)}" cy="${y + 12}" r="5" fill="#fff"/>${hl ? HL(W - PAD - 40, y + 2, 36, 20) : ""}`],
  btns: ([list, hl]) => [30, y => { const n = list.length, w = (IW - (n - 1) * 8) / n; return list.map(([l, c], i) => { const x = PAD + i * (w + 8); return `<rect x="${x}" y="${y}" width="${w}" height="30" rx="8" class="tm-${c}"/>${T(x + w / 2, y + 20, 11.5, "tm-wh b", "middle")}${esc(l)}</text>${i === hl ? HL(x, y, w, 30) : ""}`; }).join(""); }],
  rows: ([n, hl, labels]) => [n * 22, y => Array.from({length: n}, (_, i) => { const yy = y + i * 22; return `<rect x="${PAD}" y="${yy}" width="${IW}" height="19" rx="6" class="tm-card"/><circle cx="${PAD + 11}" cy="${yy + 9.5}" r="5" class="tm-blS2"/>${labels && labels[i] ? `${T(PAD + 22, yy + 13, 9.5, "tm-tx")}${esc(labels[i][0])}</text>${T(W - PAD - 8, yy + 13, 9.5, labels[i][2] || "tm-mu", "end")}${esc(labels[i][1])}</text>` : `<rect x="${PAD + 22}" y="${yy + 6}" width="56" height="3.5" rx="2" class="tm-ln2"/><rect x="${W - PAD - 40}" y="${yy + 6}" width="30" height="3.5" rx="2" class="tm-ln2"/>`}${i === hl ? HL(PAD, yy, IW, 19) : ""}`; }).join("")],
  cards: ([list, hl]) => [44, y => { const n = list.length, w = (IW - (n - 1) * 8) / n; return list.map(([a, b, c], i) => { const x = PAD + i * (w + 8); return `<rect x="${x}" y="${y}" width="${w}" height="44" rx="9" class="tm-card"/>${T(x + 8, y + 16, 9.5, "tm-mu")}${esc(a)}</text>${T(x + 8, y + 34, 13, "tm-tx b " + (c || ""))}${esc(b)}</text>${i === hl ? HL(x, y, w, 44) : ""}`; }).join(""); }],
  race: ([hl]) => [58, y => [0, 1, 2].map(i => { const yy = y + i * 20, cx = [150, 112, 74][i], col = ["tm-bl", "tm-dn", "tm-up"][i]; return `<rect x="${PAD}" y="${yy}" width="${IW}" height="17" rx="6" class="tm-card"/><path d="M${PAD + 8} ${yy + 8.5}H${W - PAD - 24}" class="tm-ln" stroke-dasharray="2 4"/><rect x="${cx}" y="${yy + 3}" width="22" height="11" rx="4" class="${col}"/><path d="M${W - PAD - 14} ${yy + 3}v11" class="tm-ln2" stroke-width="2"/>${hl === i ? HL(PAD, yy, IW, 17) : ""}`; }).join("")],
  note: ([t]) => [16, y => `${T(W / 2, y + 11, 10, "tm-mu", "middle")}${esc(t)}</text>`],
  win: ([t, v]) => [40, y => `<rect x="${PAD}" y="${y}" width="${IW}" height="40" rx="9" class="tm-upBg"/>${T(W / 2, y + 16, 10, "tm-up", "middle")}${esc(t)}</text>${T(W / 2, y + 33, 15, "tm-up b", "middle")}${esc(v)}</text>`]
};
function mock(els){
  let y = PAD, body = "";
  els.forEach(([k, ...a]) => { const [h, f] = E[k](a[0]); body += f(y); y += h + GAP; });
  const H = y - GAP + PAD;
  return `<svg class="tt-mock" viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" class="tm-bg"/>${body}</svg>`;
}

/* ---------- content ---------- */
const S = (t, d, els) => ({t, d, els});
const FEATURES = [
  {k:"futures", n:"Futures / Perp", s:"Long or short with leverage", i:"layers", h:215, go:"#/futures", steps:[
    S("Pick a contract", "Tap the symbol to choose a market.", [["bar", ["BTCUSDT", 1]], ["chart", ["up"]], ["tabs", [["Cross", "Isolated"]]]]),
    S("Choose leverage", "Higher leverage means bigger gains and bigger losses.", [["tabs", [["Cross", "Isolated"], 0]], ["chips", [["5x", "10x", "20x", "50x"], 1]], ["note", ["Liquidation moves closer"]]]),
    S("Enter the amount", "Type a size or drag the slider.", [["field", ["Amount", "100 USDT"]], ["slider", [0.5, 1]], ["field", ["Available", "1,000 USDT"]]]),
    S("Add TP and SL", "Close automatically at a profit or loss level.", [["toggle", ["Take profit / Stop loss", 1, 1]], ["field", ["Take profit", "62,000"]], ["field", ["Stop loss", "58,000"]]]),
    S("Open Long or Short", "Long if you expect a rise, Short if a fall.", [["chart", ["up"]], ["btns", [[["Long", "up"], ["Short", "dn"]], 0]]])]},
  {k:"spot", n:"Spot", s:"Buy and hold real coins", i:"chart", h:160, go:"#/spot", steps:[
    S("Pick a coin", "Choose the pair you want to trade.", [["bar", ["ETH / USDT", 1]], ["chart", ["up"]]]),
    S("Buy or Sell", "Switch the side at the top of the order panel.", [["tabs", [["Buy", "Sell"], 0]], ["field", ["Price", "Market"]]]),
    S("Set the amount", "Use the slider for a share of your balance.", [["field", ["Amount", "250 USDT"]], ["slider", [0.25, 1]]]),
    S("Tap Buy", "The coin lands in your Spot wallet at once.", [["btns", [[["Buy ETH", "up"]], 0]], ["note", ["Fees are shown before you confirm"]]]),
    S("See Holdings", "Your coins and PnL are listed under Holdings.", [["tabs", [["Orders", "Holdings", "History"], 1]], ["rows", [2, 0, [["ETH", "0.082", "tm-up"], ["USDT", "750.00"]]]]])]},
  {k:"binary", n:"Binary", s:"Up or Down in 30s to 5m", i:"clock", h:200, go:"#/trade", steps:[
    S("Pick a pair", "Choose crypto, forex or gold.", [["bar", ["BTCUSDT", 1]], ["chart", ["up"]]]),
    S("Set your stake", "Choose how much USDT to risk.", [["field", ["Amount", "10 USDT", 1]], ["chips", [["10", "50", "100", "Max"], 0]]]),
    S("Choose the time", "The trade settles when the timer ends.", [["chips", [["30s", "1m", "5m"], 0]], ["note", ["Payout up to 1.92x"]]]),
    S("Tap Up or Down", "Up if price will be higher, Down if lower.", [["chart", ["up"]], ["btns", [[["Up", "up"], ["Down", "dn"]], 0]]]),
    S("Get the result", "A correct call pays the stake times 1.92.", [["win", ["You won", "+9.20 USDT"]], ["note", ["Equal price refunds the stake"]]])]},
  {k:"cfd", n:"CFD Trade", s:"Forex, gold and stocks", i:"candle", h:35, go:"#/cfd", steps:[
    S("Pick an instrument", "Forex, metals, stocks and indices.", [["bar", ["XAUUSD", 1]], ["chart", ["up"]]]),
    S("Set the lot size", "Position size and margin update live.", [["field", ["Size", "0.10 lot", 1]], ["field", ["Margin", "24.00 USDT"]]]),
    S("Add SL and TP", "Protect the trade before you enter.", [["field", ["Take profit", "2,680", 1]], ["field", ["Stop loss", "2,630", 1]]]),
    S("Buy or Sell", "Buy if you expect a rise, Sell if a fall.", [["btns", [[["Buy", "up"], ["Sell", "dn"]], 1]]]),
    S("Manage the trade", "Close it or edit TP/SL from your positions.", [["rows", [1, 0, [["XAUUSD", "+12.40", "tm-up"]]]], ["btns", [[["Modify TP/SL", "bl"], ["Close", "dn"]], 1]]])]},
  {k:"options", n:"Options", s:"Calls and puts, limited loss", i:"target", h:265, go:"#/options", steps:[
    S("Pick an asset", "Choose the coin and an expiry date.", [["bar", ["BTC options", 1]], ["chips", [["Today", "Tomorrow", "Weekly"], 0]]]),
    S("Call or Put", "Call gains if price rises, Put if it falls.", [["tabs", [["Call", "Put"], 0]], ["chart", ["up"]]]),
    S("Choose a strike", "The strike is the price you bet on.", [["rows", [3, 1, [["60,000", "1,240", "tm-up"], ["62,000", "620"], ["64,000", "260"]]]]]),
    S("Pay the premium", "Your maximum loss is only the premium.", [["field", ["Premium", "620 USDT"]], ["btns", [[["Buy Call", "up"]], 0]]])]},
  {k:"predict", n:"Prediction", s:"Yes or No on real events", i:"predict", h:150, go:"#/predict", steps:[
    S("Find an event", "Browse politics, sports, crypto and more.", [["tabs", [["Trending", "Crypto", "Sports"], 0]], ["rows", [3, 0, [["Will BTC pass 100k?", "62¢"], ["Rate cut in Dec?", "38¢"], ["Team A wins?", "71¢"]]]]]),
    S("Read the price", "62¢ means the crowd sees a 62% chance.", [["cards", [[["Yes", "62¢", "tm-up"], ["No", "38¢", "tm-dn"]], 0]]]),
    S("Choose Yes or No", "Pick the outcome you believe in.", [["btns", [[["Yes 62¢", "up"], ["No 38¢", "dn"]], 0]]]),
    S("Set your stake", "Each share pays 1 USDT if you are right.", [["field", ["Amount", "20 USDT", 1]], ["field", ["Payout if right", "32.26 USDT"]]]),
    S("Collect the payout", "When the event ends, winners are paid out.", [["win", ["Event settled", "+12.26 USDT"]]])]},
  {k:"racer", n:"Money Game", s:"Pick a car and win the race", i:"car", h:20, go:"#/racer", steps:[
    S("Open the game", "It uses your Money Game wallet.", [["cards", [[["Balance", "1,000", ""], ["Wallet", "Money Game", ""]], 0]]]),
    S("Pick a car", "Tap the car you think will win.", [["race", [1]]]),
    S("Place your bet", "Choose a stake and confirm.", [["field", ["Bet", "10 USDT", 1]], ["btns", [[["Place bet", "bl"]], 0]]]),
    S("Watch the race", "The 3D race runs live. First car home wins.", [["race", []], ["note", ["Good luck"]]]),
    S("Get paid", "Winning bets are credited right away.", [["win", ["You won", "+18.00 USDT"]]])]},
  {k:"copy", n:"Copy Trading", s:"Follow top traders", i:"users", h:300, go:"#/copy", steps:[
    S("Browse traders", "Compare ROI, win rate and risk.", [["rows", [3, 0, [["Trader A", "+82% ROI", "tm-up"], ["Trader B", "+41% ROI", "tm-up"], ["Trader C", "+27% ROI", "tm-up"]]]]]),
    S("Open a profile", "Check history, drawdown and open trades.", [["cards", [[["30D ROI", "+82%", "tm-up"], ["Win rate", "71%", ""]], 0]], ["chart", ["up"]]]),
    S("Tap Copy", "Choose how much USDT to follow with.", [["field", ["Copy amount", "200 USDT", 1]], ["btns", [[["Copy", "bl"]], 0]]]),
    S("Stay in control", "Stop copying any time from the same screen.", [["btns", [[["Stop copying", "dn"]], 0]]])]},
  {k:"bots", n:"Trading Bots", s:"Auto trade a fixed plan", i:"bot", h:262, go:"#/bots", steps:[
    S("Choose a bot", "Spot Grid, Futures Grid or DCA.", [["cards", [[["Spot Grid", "+18%", "tm-up"], ["DCA Bot", "+9%", "tm-up"]], 0]]]),
    S("Set the range", "The bot buys low and sells high inside it.", [["field", ["Lower price", "58,000"]], ["field", ["Upper price", "66,000", 1]], ["field", ["Grids", "20"]]]),
    S("Add investment", "Funds return to your account when you stop.", [["field", ["Invest", "300 USDT", 1]], ["slider", [0.3]]]),
    S("Start the bot", "It runs on live prices around the clock.", [["btns", [[["Create bot", "bl"]], 0]], ["note", ["Stop it any time"]]])]},
  {k:"apitrade", n:"API Trade", s:"Connect exchange, follow signals", i:"zap", h:200, go:"#/apitrade", steps:[
    S("Create an API key", "Make a key on your exchange. Never enable Withdraw.", [["toggle", ["Read", 1]], ["toggle", ["Trade", 1]], ["toggle", ["Withdraw", 0, 1]]]),
    S("Connect it", "Paste the key and secret, then connect.", [["field", ["API Key", "k3F9...a1", 1]], ["field", ["Secret", "••••••"]], ["btns", [[["Connect", "bl"]], 0]]]),
    S("Follow a channel", "Pick a Telegram signals channel to follow.", [["rows", [3, 1, [["Signals Pro", "Follow"], ["Gold Desk", "Follow"], ["Swing Hub", "Following", "tm-up"]]]]]),
    S("Trades run for you", "New signals open trades on your exchange.", [["rows", [2, 0, [["BTC long", "+3.2%", "tm-up"], ["ETH short", "+1.1%", "tm-up"]]]]])]},
  {k:"earn", n:"Earn", s:"Grow idle USDT", i:"earn", h:152, go:"#/earn", steps:[
    S("Pick a product", "Flexible can be redeemed any time.", [["tabs", [["Flexible", "Locked"], 0]], ["rows", [2, 0, [["USDT Flexible", "5.2% APR", "tm-up"], ["USDT 30D", "9.6% APR", "tm-up"]]]]]),
    S("Enter the amount", "See your estimated earnings first.", [["field", ["Amount", "500 USDT", 1]], ["field", ["Est. daily", "+0.07 USDT"]]]),
    S("Subscribe", "Interest is credited to your Earn wallet.", [["btns", [[["Subscribe", "bl"]], 0]]])]},
  {k:"wallet", n:"Deposit and Withdraw", s:"Move money in and out", i:"wallet", h:190, go:"#/deposit", steps:[
    S("Tap Deposit", "It is the button next to your balance.", [["cards", [[["Total (USDT)", "1,000.00", ""]], 0]], ["btns", [[["Deposit", "bl"]], 0]]]),
    S("Pick coin and network", "Send only on the network shown.", [["chips", [["USDT", "BTC", "ETH"], 0]], ["chips", [["TRC20", "BEP20"], 1]]]),
    S("Move between wallets", "Transfer is instant between your wallets.", [["field", ["From", "Trading", 1]], ["field", ["To", "Futures"]], ["btns", [[["Transfer", "bl"]], 0]]]),
    S("Withdraw", "Enter the address and amount, then confirm.", [["field", ["Address", "T9x...4Qe", 1]], ["btns", [[["Withdraw", "bl"]], 0]]])]}
];
FEATURES.forEach(f => f.i = ({wallet:"wallet"})[f.k] || f.i);
const byK = k => FEATURES.find(f => f.k === k);

/* ---------- card art ---------- */
const art = f => `<span class="tt-art" style="--h:${f.h}"><svg viewBox="0 0 120 56" aria-hidden="true"><path d="M2 46 L22 36 L40 42 L62 20 L82 30 L118 8" class="tt-sp"/><circle cx="118" cy="8" r="3" class="tt-spd"/></svg><span class="tt-ico">${ic(f.i, 26, 1.7)}</span></span>`;
function cardsHtml(){
  return `<div class="tt-grid">${FEATURES.map(f => `<button type="button" class="tt-card" data-tt="${f.k}">${art(f)}<b>${esc(f.n)}</b><small>${esc(f.s)}</small><em>${f.steps.length} steps</em></button>`).join("")}</div>`;
}
function bind(root){ root.querySelectorAll("[data-tt]").forEach(b => { b.onclick = () => open(b.dataset.tt); }); }

/* ---------- full-screen tutorial (X in the top-right corner) ---------- */
let cur = null;
function close(){ if (!cur) return; const c = cur; cur = null; c.classList.add("out"); removeEventListener("keydown", c._k); removeEventListener("hashchange", c._h); setTimeout(() => c.remove(), 180); document.documentElement.classList.remove("tt-lock"); }
function open(key){
  const f = byK(key); if (!f) return; if (cur) { cur.remove(); cur = null; }
  try { U.buzz && U.buzz(); } catch {}
  const el = document.createElement("div"); el.className = "tt-full"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", f.n + " tutorial");
  el.innerHTML = `<header class="tt-fh"><span class="tt-fi" style="--h:${f.h}">${ic(f.i, 20, 1.8)}</span><div><h2>${esc(f.n)}</h2><small>${f.steps.length} quick steps</small></div><button type="button" class="tt-x" data-ttx aria-label="Close tutorial">${ic("close", 20, 2)}</button></header>
  <div class="tt-fb">${f.steps.map((s, i) => `<section class="tt-step"><div class="tt-sn"><i>${i + 1}</i><div><b>${esc(s.t)}</b><p>${esc(s.d)}</p></div></div>${mock(s.els)}</section>`).join("")}
  <a class="tt-go" href="${f.go}" data-ttgo>Open ${esc(f.n)}</a></div>`;
  document.body.appendChild(el); document.documentElement.classList.add("tt-lock"); cur = el;
  el.querySelector("[data-ttx]").onclick = close;
  el.querySelector("[data-ttgo]").addEventListener("click", close);
  el._k = e => { if (e.key === "Escape") close(); }; el._h = close;
  addEventListener("keydown", el._k); addEventListener("hashchange", el._h);
  requestAnimationFrame(() => el.classList.add("in")); el.querySelector("[data-ttx]").focus({preventScroll:true});
}
window.TUT = {features: FEATURES, cardsHtml, bind, open, close};
})();
