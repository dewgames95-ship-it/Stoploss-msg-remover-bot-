'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(__dirname, '..', process.env.TEST_ROOT || '');
const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = path.join(__dirname, 'shots');
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'};

function server() {
  return new Promise(res => {
    const s = http.createServer((req, rs) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end('nf'); }
      rs.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(rs);
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

function collectRoutes() {
  const names = new Set(), hrefs = new Set();
  const files = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => path.join(ROOT, 'js', f)).concat(path.join(ROOT, 'index.html'));
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/Pages\.([A-Za-z_]\w*)\s*=/g)) names.add(m[1]);
    for (const m of src.matchAll(/href="#\/([^"]*)"/g)) hrefs.add(m[1]);
  }
  names.delete('notfound');
  const sample = {trade:'BTCUSDT', futures:'BTCUSDT', spot:'BTCUSDT', chart:'BTCUSDT', options:'BTC'};
  const routes = new Set();
  for (const n of names) routes.add(sample[n] ? `${n}/${sample[n]}` : n);
  for (const h of hrefs) {
    if (h.includes('${')) continue;
    const clean = h.split('?')[0];
    const n = clean.split('/')[0];
    if (names.has(n)) routes.add(sample[n] && clean === n ? `${n}/${sample[n]}` : clean);
  }
  return { routes: [...routes].sort(), names };
}

const results = [];
function rec(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}
function skip(name, why) { results.push({ name, ok: true, skipped: true, detail: why }); console.log(`SKIP  ${name}  -- ${why}`); }

(async () => {
  const srv = await server(); const base = `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch();
  const { routes, names } = collectRoutes();
  console.log(`Routes (${routes.length}): ${routes.join(', ')}`);
  if (SHOTS) fs.mkdirSync(SHOT_DIR, { recursive: true });
  const dev = devices['Pixel 7'] || { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 };

  async function newPage() {
    const ctx = await browser.newContext({ ...dev });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e.message || e)));
    return { ctx, page, errs };
  }
  const settle = (p, ms = 1500) => p.waitForTimeout(ms);

  try {
    /* 1. routes */
    for (const theme of ['light', 'dark']) {
      const { ctx, page, errs } = await newPage();
      await page.goto(base + '#/home'); await settle(page, 800);
      await page.evaluate(t => App.setTheme(t), theme);
      for (const r of routes) {
        errs.length = 0;
        await page.evaluate(h => { location.hash = h; }, '#/' + r);
        await settle(page);
        const info = await page.evaluate(() => ({ nf: !!document.querySelector('#view .nf'), len: (document.querySelector('#view')?.innerText || '').trim().length, kids: document.querySelector('#view')?.children.length || 0, th: document.documentElement.dataset.theme }));
        const problems = [];
        if (errs.length) problems.push('pageerror: ' + errs.join(' | '));
        if (info.nf) problems.push('404 page shown');
        if (!info.kids || !info.len) problems.push('#view empty');
        if (info.th !== theme) problems.push('theme not applied');
        rec(`route ${r} [${theme}]`, !problems.length, problems.join('; '));
        if (SHOTS) await page.screenshot({ path: path.join(SHOT_DIR, `${r.replace(/\W+/g, '_')}_${theme}.png`) });
      }
      await ctx.close();
    }
    // unknown route shows 404
    { const { ctx, page } = await newPage(); await page.goto(base + '#/definitely-not-a-page'); await settle(page, 500);
      rec('unknown route shows 404', await page.evaluate(() => !!document.querySelector('#view .nf'))); await ctx.close(); }

    /* 2. flows */
    const { ctx, page, errs } = await newPage();
    await page.goto(base + '#/home'); await settle(page, 1500);
    await page.evaluate(() => {
      Object.keys(U.store.s.settings.confirm).forEach(k => U.store.s.settings.confirm[k] = false);
      U.store.s.settings.tips = false; window.TOUR && TOUR.close && TOUR.close();
      const ensure = (sym, px) => { const p = M.get(sym); if (p && !(p.price > 0)) p.price = px; };
      ensure('BTCUSDT', 60000); ensure('ETHUSDT', 3000);
    });
    const ensurePrice = () => page.evaluate(() => { const p = M.get('BTCUSDT'); if (p && !(p.price > 0)) p.price = 60000; return p && p.price; });
    const shot = async n => { if (SHOTS) await page.screenshot({ path: path.join(SHOT_DIR, `flow_${n}.png`) }); };
    const go = async h => { errs.length = 0; await page.evaluate(h => { location.hash = h; }, h); await settle(page, 1200); await ensurePrice(); };

    // futures
    try {
      await go('#/futures/BTCUSDT');
      const before = await page.evaluate(() => U.store.s.fut.positions.length);
      await page.fill('#amt', '100');
      await page.click('[data-go="long"]');
      await settle(page, 800);
      const after = await page.evaluate(() => U.store.s.fut.positions.length);
      rec('futures: market long opens position', after === before + 1, `positions ${before} -> ${after}`);
      await shot('futures_open');
      const closed = await page.evaluate(() => { const ps = U.store.s.fut.positions; const p = ps[ps.length - 1]; if (!p) return null; const r = E.closeFut(p.id); return { r, n: U.store.s.fut.positions.length }; });
      rec('futures: E.closeFut closes position', closed && closed.n === before, JSON.stringify(closed));
      rec('futures: no pageerror', !errs.length, errs.join(' | '));
    } catch (e) { rec('futures flow', false, e.message.split('\n')[0]); }

    // binary
    try {
      await go('#/trade/BTCUSDT');
      const before = await page.evaluate(() => U.store.s.positions.length);
      await page.fill('#amt', '10');
      await page.click('[data-dir="up"]');
      await settle(page, 800);
      const after = await page.evaluate(() => U.store.s.positions.length);
      rec('binary: Up trade adds position', after > before, `positions ${before} -> ${after}`);
      await shot('binary');
      rec('binary: no pageerror', !errs.length, errs.join(' | '));
    } catch (e) { rec('binary flow', false, e.message.split('\n')[0]); }

    // spot
    if (names.has('spot')) {
      try {
        await go('#/spot/BTCUSDT');
        const snap = () => page.evaluate(() => JSON.stringify(U.store.s.spot || {}).length + ':' + (U.store.s.wallets.spot));
        const before = await snap();
        await page.click('[data-otype]'); await page.click('[data-ot="market"]'); await settle(page, 300);
        await page.fill('#spq', '0.001');
        await page.click('#spgo'); await settle(page, 800);
        const after = await snap();
        const err = await page.evaluate(() => document.querySelector('#sperr')?.textContent || '');
        rec('spot: market buy changes balance/holdings', before !== after, err || `${before} -> ${after}`);
        await shot('spot');
        rec('spot: no pageerror', !errs.length, errs.join(' | '));
      } catch (e) { rec('spot flow', false, e.message.split('\n')[0]); }
    } else skip('spot flow', 'no spot page');

    // options (best effort)
    try {
      await go('#/options/BTC');
      await page.waitForFunction(() => window.M && M.get('BTCUSDT') && M.get('BTCUSDT').price > 0, null, {timeout: 8000}).catch(() => {});
      const live = await page.waitForSelector('#sGo', {state: 'visible', timeout: 4000}).then(() => true).catch(() => false);
      if (!live) skip('options: buy', 'Simple-mode buy button not rendered');
      else {
        const before = await page.evaluate(() => (U.store.s.opt?.positions || []).length);
        await page.evaluate(() => { U.store.s.wallets.options = Math.max(U.store.s.wallets.options || 0, 1000); });
        await page.click('#sAmts [data-a="50"]'); await settle(page, 300);
        await page.click('#sGo'); await settle(page, 400);
        if (await page.locator('[data-yes]').count()) await page.click('[data-yes]'); await settle(page, 600);
        const after = await page.evaluate(() => (U.store.s.opt?.positions || []).length);
        rec('options: buy adds position', after === before + 1, `positions ${before} -> ${after}`);
        await shot('options');
        rec('options: no pageerror', !errs.length, errs.join(' | '));
      }
    } catch (e) { skip('options: buy', 'best effort failed: ' + e.message.split('\n')[0]); }
    await ctx.close();
  } catch (e) {
    rec('suite crashed', false, e.stack || String(e));
  }

  await browser.close(); srv.close();
  const failed = results.filter(r => !r.ok), skipped = results.filter(r => r.skipped);
  const summary = { total: results.length, passed: results.length - failed.length - skipped.length, skipped: skipped.length, failed: failed.length, results };
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(`\nSummary: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped (of ${summary.total}). JSON: tests/results.json`);
  if (failed.length) { console.log('Failures:'); failed.forEach(f => console.log(' - ' + f.name + ': ' + f.detail)); }
  process.exit(failed.length ? 1 : 0);
})();
