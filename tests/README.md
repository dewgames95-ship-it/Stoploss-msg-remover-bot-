# Smoke tests

Headless Playwright (Chromium, Pixel 7 viewport) smoke suite. It starts its own static server on a random port.

    npm test              # run all checks
    npm run test:shots    # also save screenshots to tests/shots/

Requires a globally available `playwright` with Chromium installed (not installed by this repo).

Checks: every route (found by scanning `js/*.js` and `href="#/..."`) in light and dark themes (no page errors, no 404 page, `#view` non-empty), plus flows: futures market long + close, binary Up trade, spot market buy, options buy (best effort, skipped if unavailable).

Results go to the console and `tests/results.json`; exit code is non-zero on any failure. Sandbox note: if Binance is blocked, prices are injected via `M.get(sym).price`.
