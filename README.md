# Binary Trading App (NovaTrade)

A demo (paper-trading) web app that feels like a real exchange. No real money, no backend, no database.

## Features
- Binary options with 30s / 1m / 5m / 15m periods. Expiry lands on the candle close. Payout is 80-95% per asset.
- Futures (perp) with leverage, TP/SL, order book and realized PnL.
- Spot for crypto, stocks, indices, forex, metals and commodities.
- Options (Simple and Pro mode), Copy Trading, Bots, Earn, PnL Analysis.
- Light and dark theme, guided tour, sounds and haptics for events.

## Data sources
Binance public REST/WebSocket (crypto), biquote.io (stocks, forex, metals), CoinGecko (coin info). Free third-party services, so they can rate-limit.

## Run
Static site. Open `index.html` through any static server, for example `npx serve .`

## Test
```
npm install playwright
npm test
```

## Deploy
GitHub Pages serves the `gh-pages` branch. Push to `main` and `gh-pages` to update.

Demo only. Not financial advice.
