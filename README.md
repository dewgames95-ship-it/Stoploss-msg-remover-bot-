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

## Android app
`android/` is a small WebView shell (Java, no extra libraries) that opens the live site.
- Web changes show up in the app automatically (it always loads the live GitHub Pages site).
- Native changes: push to `main` under `android/` and the "Android APK" GitHub Action builds a signed APK and publishes it as a Release (`apk-v<build>`). The installed app checks the latest Release on start and offers a one-tap **Update**.
- Download: Releases page of this repo, file `binary-trading.apk`.
- Local build: `cd android && ./gradlew assembleRelease` (needs Android SDK 34).

## Build & deploy
Source files stay separate (open `index.html` for development).
- `npm run build` bundles all JS into `dist/app.min.js` and all CSS into `dist/app.min.css` (esbuild, minified) and writes `dist/index.html`.
- `npm run test:dist` runs the smoke tests against the bundle.
- `npm run deploy` builds and publishes `dist/` to the `gh-pages` branch (the live site). Push source to `main`.

Demo only. Not financial advice.
