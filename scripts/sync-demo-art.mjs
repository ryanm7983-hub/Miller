#!/usr/bin/env node
/**
 * Copies the product-art module into the standalone demo.
 *
 *   node scripts/sync-demo-art.mjs
 *
 * `demo/index.html` has to be a single self-contained file, so it can't import
 * anything. Rather than maintain two copies of the drawings by hand, the module
 * is inlined here between markers — run this after editing
 * `web/src/lib/productArt.js`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'web/src/lib/productArt.js');
const DEMO = path.join(ROOT, 'demo/index.html');

const START = '  /* ==== PRODUCT ART — generated, do not edit here ==== */';
const END = '  /* ==== END PRODUCT ART ==== */';

const module_ = await fs.readFile(SOURCE, 'utf8');

// ESM → plain statements, and drop the re-export tail.
const inlined = module_
  .replace(/^export\s+(const|function)\s/gm, '$1 ')
  .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')
  .trimEnd()
  .split('\n')
  .map((line) => (line ? `  ${line}` : line))
  .join('\n');

const demo = await fs.readFile(DEMO, 'utf8');
const startIndex = demo.indexOf(START);
const endIndex = demo.indexOf(END);

if (startIndex === -1 || endIndex === -1) {
  console.error(`Markers not found in ${path.relative(ROOT, DEMO)}. Expected:\n${START}\n${END}`);
  process.exit(1);
}

const next =
  demo.slice(0, startIndex + START.length) + '\n' + inlined + '\n' + demo.slice(endIndex);

await fs.writeFile(DEMO, next);
console.log(
  `Synced product art into ${path.relative(ROOT, DEMO)} (${inlined.split('\n').length} lines).`,
);
