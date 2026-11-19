/* App configuration — edit freely. No API keys are needed. */
window.CONFIG = {
  APP_NAME: "NovaTrade",
  SUPPORT_PHONE: "+1 555 010 2030",
  SUPPORT_EMAIL: "support@novatrade-demo.app",
  START_BALANCE: 10000,
  PAYOUT: 0.92,                      // +92% on win → ratio 1.92X
  EXPIRIES: [30, 60, 300],           // seconds
  MAX_OPEN: 10,
  TRADABLE_CRYPTO: ["BTC","ETH","BNB","SOL","XRP","DOGE","ADA","TRX","AVAX","LINK"],
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
  BINANCE_REST: ["https://api.binance.com","https://data-api.binance.vision"],
  BINANCE_WS: ["wss://stream.binance.com:9443","wss://data-stream.binance.vision"],
  BIQUOTE: "https://biquote.io"
};
