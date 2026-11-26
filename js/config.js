/* App configuration. No API keys are needed. */
window.CONFIG = {
  APP_NAME: "NovaTrade",
  SUPPORT_PHONE: "+1 555 010 2030",
  SUPPORT_EMAIL: "support@novatrade.app",
  START_BALANCE: 10000,
  API_URL: "",          // v6.8: backend base URL (e.g. "https://api.example.com"). Empty = local device-only. Real-mode API.call() goes here when set.
  PAYOUT: 0.92,                      // +92% on win → ratio 1.92X
  EXPIRIES: [30, 60, 300, 900],           // seconds
  MAX_OPEN: 10,
  TRADABLE_CRYPTO: ["BTC","ETH","BNB","SOL","XRP","DOGE","ADA","TRX","AVAX","LINK","TON","DOT","SHIB","LTC","BCH","NEAR","UNI","APT","SUI","ARB","OP","PEPE","WIF","INJ","FET","RENDER","ATOM","FIL","ICP","ETC","XLM","HBAR","SEI","TIA","AAVE","POL","TAO","WLD","ENA","ONDO","JUP","BONK","FLOKI","TRUMP"],
  FOREX: [
    {s:"EURUSD", n:"Euro / US Dollar", f:["eu","us"]},
    {s:"GBPUSD", n:"British Pound / US Dollar", f:["gb","us"]},
    {s:"USDJPY", n:"US Dollar / Japanese Yen", f:["us","jp"]},
    {s:"AUDUSD", n:"Australian Dollar / US Dollar", f:["au","us"]},
    {s:"USDCAD", n:"US Dollar / Canadian Dollar", f:["us","ca"]},
    {s:"USDCHF", n:"US Dollar / Swiss Franc", f:["us","ch"]},
    {s:"NZDUSD", n:"New Zealand Dollar / US Dollar", f:["nz","us"]},
    {s:"EURJPY", n:"Euro / Japanese Yen", f:["eu","jp"]}
  ],
  METALS: [
    {s:"XAUUSD", n:"Gold Spot", m:"gold"},
    {s:"XAGUSD", n:"Silver Spot", m:"silver"}
  ],
  STABLES: ["USDC","FDUSD","TUSD","BUSD","USDP","DAI","EUR","AEUR","USDE","PYUSD","USD1","XUSD","EURI","BFUSD","RLUSD","USDS","UST","USTC","GBP","TRY","BRL","U","RWUSD","XAUT","PAXG","WBTC","WBETH","BNSOL"],
  // Tokenized stock / ETF pairs are hidden from the crypto list (base = TICKER + "B")
  STOCKS: ["NVDA","SOXL","SPCX","CRCL","MU","MSTR","SNDK","SKHY","SOXS","GOOGL","GOOG","SNXX","QQQ","KORU","TQQQ","SQQQ","INTC","NBIS","AVGO","MRVL","EWY","TSLA","AMD","AMZN","BNC","AAPL","META","MSFT","COIN","HOOD","PLTR","SPY","NFLX","ORCL","ARM","SMCI","TSM","IWM","DIA","GLD","SLV","USO","UVXY","BABA","UBER","SHOP","MARA","RIOT","CRWV","TLT","XLF","IBIT","BMNR","SBET","CRWD","PYPL","DIS","NKE","JPM","V","MA","WMT","COST","LLY","UNH","XOM","BA","GME","AMC","RDDT","APP","ASTS","OKLO","IONQ","RGTI","QBTS","SOFI","CRM","ADBE","QCOM","TXN","MCD","KO","PEP"],
  LEVERAGE_MAX: {crypto:125, forex:500, metal:200, stock:20, index:100, commodity:100},
  FEE: 0.0001, MMR: 0.004,
  BINANCE_REST: ["https://api.binance.com","https://data-api.binance.vision"],
  BINANCE_WS: ["wss://data-stream.binance.vision","wss://stream.binance.com:9443"],
  get APP_VERSION(){ return (() => { try { const m = ((document.querySelector('script[src*="update.js"],script[src*="app.min.js"]') || {}).src || "").match(/[?&]v=([\d.]+)/); return m ? m[1] : "6.7"; } catch (e) { return "6.7"; } })(); },
  BIQUOTE: "https://biquote.io"
};
