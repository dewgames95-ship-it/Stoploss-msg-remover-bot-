/* Production build: one minified JS + one minified CSS.
   Source stays as separate files (index.html works unbundled for development).
   Output: dist/ = full copy of the site with index.html pointing at app.min.js / app.min.css.
   Usage: npm run build            (then: npm run deploy  -> publishes dist/ to the gh-pages branch) */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SKIP = new Set(["dist", "node_modules", ".git", "android", "tests", "scripts", ".github"]);

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const ver = (html.match(/js\/update\.js\?v=([\d.]+)/) || [])[1] || String(Date.now());

const cssRe = /<link rel="stylesheet" href="(css\/[^"?]+)(?:\?[^"]*)?">\n?/g;
const jsRe = /<script src="(js\/[^"?]+)(?:\?[^"]*)?"><\/script>\n?/g;
const cssFiles = [...html.matchAll(cssRe)].map(m => m[1]);
const jsFiles = [...html.matchAll(jsRe)].map(m => m[1]);

// JS: concatenated in page order as ONE classic script (same global scope as separate <script> tags).
const js = jsFiles.map(f => `/* ${f} */\n` + fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n;\n");
const jsOut = esbuild.transformSync(js, { minify: true, target: "es2020", legalComments: "none" }).code;
const css = cssFiles.map(f => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
const cssOut = esbuild.transformSync(css, { loader: "css", minify: true, target: ["chrome90", "safari14"] }).code;

// fresh dist = copy of the site
fs.rmSync(DIST, { recursive: true, force: true });
(function copy(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith(".")) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copy(s, d) : fs.copyFileSync(s, d);
  }
})(ROOT, DIST);

fs.writeFileSync(path.join(DIST, "app.min.js"), jsOut);
fs.writeFileSync(path.join(DIST, "app.min.css"), cssOut);

let out = html;
let firstCss = true, firstJs = true;
out = out.replace(cssRe, () => firstCss ? (firstCss = false, `<link rel="stylesheet" href="app.min.css?v=${ver}">\n`) : "");
out = out.replace(jsRe, () => firstJs ? (firstJs = false, `<script src="app.min.js?v=${ver}"></script>\n`) : "");
fs.writeFileSync(path.join(DIST, "index.html"), out);

const kb = n => (n / 1024).toFixed(0) + " KB";
const srcJs = jsFiles.reduce((a, f) => a + fs.statSync(path.join(ROOT, f)).size, 0);
const srcCss = cssFiles.reduce((a, f) => a + fs.statSync(path.join(ROOT, f)).size, 0);
console.log(`v${ver}: ${jsFiles.length} JS files ${kb(srcJs)} -> app.min.js ${kb(jsOut.length)} | ${cssFiles.length} CSS files ${kb(srcCss)} -> app.min.css ${kb(cssOut.length)}`);
