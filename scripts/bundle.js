/* ===========================================================================
   Builds a single self-contained HTML file from the multi-file app.

   Two outputs:
     dist/pixelforge.html   — a complete standalone page (open it anywhere)
     dist/artifact.html     — page *content* only (no doctype/html/head/body),
                              for hosts that supply their own document skeleton

   Everything is inlined: CSS, JS, and every SVG as a data URI. The result
   makes no requests at all.
   =========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ── collect sprites as data URIs ──────────────────────────────────────── */
const imgDir = path.join(ROOT, 'assets', 'img');
const images = {};
fs.readdirSync(imgDir).filter(f => f.endsWith('.svg')).forEach(file => {
  const svg = fs.readFileSync(path.join(imgDir, file), 'utf8')
    .replace(/\n\s*/g, ' ')   // collapse whitespace; SVG is whitespace-insensitive here
    .trim();
  // percent-encoding beats base64 for SVG: smaller, and stays human-greppable
  images[file.replace(/\.svg$/, '')] = 'data:image/svg+xml,' + encodeURIComponent(svg);
});

/* ── assemble CSS and JS in load order ─────────────────────────────────── */
const CSS_FILES = ['assets/css/theme.css', 'assets/css/hero.css', 'assets/css/studio.css'];
const JS_FILES = [
  'assets/js/core/util.js',
  'assets/js/core/store.js',
  'assets/js/core/premium.js',
  'assets/js/data/presets.js',
  'assets/js/data/fields.js',
  'assets/js/data/code-data.js',
  'assets/js/panels/art.js',
  'assets/js/panels/music.js',
  'assets/js/panels/code.js',
  'assets/js/panels/library.js',
  'assets/js/app.js'
];

const css = CSS_FILES.map(f => '/* ── ' + f + ' ── */\n' + read(f)).join('\n\n');

// PF_IMG must exist before any module runs, so util.assetUrl can resolve.
const imgScript = 'window.PF_IMG = ' + JSON.stringify(images) + ';';
const js = [imgScript]
  .concat(JS_FILES.map(f => '/* ── ' + f + ' ── */\n' + read(f)))
  .join('\n\n')
  // a literal </script> inside a string would end the inline block early
  .replace(/<\/script/gi, '<\\/script');

/* ── rewrite the page ──────────────────────────────────────────────────── */
let html = read('index.html');

// swap static asset paths for their data URIs
html = html.replace(/assets\/img\/([a-z0-9-]+)\.svg/gi, (m, name) =>
  images[name] ? images[name] : m);

/* Replacements are passed as functions, never strings: a string replacement
   would interpret `$$`, `$&` and `$1` as substitution patterns, and the app
   code uses `$$()` as a query helper. */
const inject = (haystack, needle, text) => haystack.replace(needle, () => text);

// replace the stylesheet links with one inline style block
html = html.replace(/<link rel="stylesheet"[^>]*>\s*/g, '');
html = inject(html, '</head>', '<style>\n' + css + '\n</style>\n</head>');

// replace the script tags with one inline script block
html = html.replace(/<!-- Classic scripts[^\n]*\n/, '');
html = html.replace(/<script src="[^"]*"><\/script>\s*/g, '');
html = inject(html, '</body>', '<script>\n' + js + '\n</script>\n</body>');

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'pixelforge.html'), html);

/* ── content-only variant for artifact hosts ───────────────────────────── */
const title = (html.match(/<title>([^<]*)<\/title>/) || [, 'PixelForge'])[1];
const bodyInner = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
const artifact = '<title>' + title + '</title>\n<style>\n' + css + '\n</style>\n' + bodyInner;
fs.writeFileSync(path.join(DIST, 'artifact.html'), artifact);

const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log('sprites inlined :', Object.keys(images).length);
console.log('dist/pixelforge.html :', kb(Buffer.byteLength(html)));
console.log('dist/artifact.html   :', kb(Buffer.byteLength(artifact)));
