#!/usr/bin/env node
/**
 * Downloads real product photographs for the sample catalog.
 *
 *   node scripts/fetch-product-images.mjs                 # Openverse, no key
 *   SERPAPI_KEY=… node scripts/fetch-product-images.mjs   # real retailer photos
 *   node scripts/fetch-product-images.mjs --force         # re-fetch everything
 *
 * Why a script instead of committed images: product photographs belong to the
 * retailers and manufacturers who shot them. Fetching them on your machine, at
 * your discretion, keeps that decision yours — and keeps copyrighted images out
 * of the repository.
 *
 * Sources, in preference order:
 *   serpapi   — Google Shopping thumbnails. The actual listing photos, and the
 *               same source the live app uses at runtime. Needs SERPAPI_KEY.
 *   openverse — openly-licensed photos (CC / public domain), no key required.
 *               Quality varies; every image is recorded with its creator and
 *               licence in the manifest so you can credit it.
 *
 * Writes:
 *   web/public/products/<slug>.<ext>
 *   server/src/providers/mock/images.json   (manifest the mock provider reads)
 *
 * Anything already downloaded is skipped unless --force is passed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'web/public/products');
const MANIFEST = path.join(ROOT, 'server/src/providers/mock/images.json');

const force = process.argv.includes('--force');
const requested = process.argv.find((arg) => arg.startsWith('--source='))?.split('=')[1];
const serpApiKey = process.env.SERPAPI_KEY ?? '';
const source = requested ?? (serpApiKey ? 'serpapi' : 'openverse');

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

async function loadCatalog() {
  const { SAMPLE_PRODUCTS } = await import(
    path.join(ROOT, 'server/src/providers/mock/catalog.js')
  );
  return SAMPLE_PRODUCTS;
}

/** The real listing photo Google Shopping shows for this product. */
async function findViaSerpApi(entry) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', entry.title);
  url.searchParams.set('api_key', serpApiKey);
  url.searchParams.set('num', '5');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`serpapi responded ${response.status}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(`serpapi: ${data.error}`);

  const hit = (data.shopping_results ?? []).find((result) => result.thumbnail);
  if (!hit) return null;
  return {
    imageUrl: hit.thumbnail,
    credit: `Product image via Google Shopping${hit.source ? ` (${hit.source})` : ''}`,
    sourceUrl: hit.product_link ?? hit.link ?? null,
    licence: 'Retailer / manufacturer image, shown as a product thumbnail',
  };
}

/** Openly-licensed photo — no key, but expect a looser match. */
async function findViaOpenverse(entry) {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q', [entry.brand, entry.model || entry.category].filter(Boolean).join(' '));
  url.searchParams.set('license_type', 'commercial,modification');
  url.searchParams.set('page_size', '5');

  const response = await fetch(url, {
    headers: { 'user-agent': 'PriceScout sample-image fetcher' },
  });
  if (!response.ok) throw new Error(`openverse responded ${response.status}`);

  const data = await response.json();
  const hit = (data.results ?? []).find((result) => result.url);
  if (!hit) return null;
  return {
    imageUrl: hit.url,
    credit: `${hit.title ?? 'Untitled'} by ${hit.creator ?? 'unknown'} (${hit.license?.toUpperCase() ?? 'CC'})`,
    sourceUrl: hit.foreign_landing_url ?? null,
    licence: hit.license_url ?? hit.license ?? 'see source',
  };
}

async function download(imageUrl, slug) {
  const response = await fetch(imageUrl, { headers: { accept: 'image/*' } });
  if (!response.ok) throw new Error(`image responded ${response.status}`);

  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim();
  const ext = EXT_BY_TYPE[type] ?? 'jpg';
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) throw new Error('image looks empty');

  const file = `${slug}.${ext}`;
  await fs.writeFile(path.join(OUT_DIR, file), bytes);
  return { file: `/products/${file}`, bytes: bytes.length };
}

async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  } catch {
    return { images: {} };
  }
}

async function main() {
  if (source === 'serpapi' && !serpApiKey) {
    console.error('SERPAPI_KEY is not set — either export it, or use --source=openverse.');
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const catalog = await loadCatalog();
  const manifest = await readManifest();
  const find = source === 'serpapi' ? findViaSerpApi : findViaOpenverse;

  console.log(`Fetching product images from ${source} for ${catalog.length} products…\n`);

  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of catalog) {
    const existing = manifest.images[entry.slug];
    if (existing && !force) {
      console.log(`  · ${entry.slug} — already have it`);
      skipped += 1;
      continue;
    }

    try {
      const found = await find(entry);
      if (!found) {
        console.warn(`  ! ${entry.slug} — no image found`);
        failed += 1;
        continue;
      }
      const saved = await download(found.imageUrl, entry.slug);
      manifest.images[entry.slug] = {
        file: saved.file,
        credit: found.credit,
        sourceUrl: found.sourceUrl,
        licence: found.licence,
        fetchedAt: new Date().toISOString(),
      };
      console.log(`  ✓ ${entry.slug} — ${(saved.bytes / 1024).toFixed(0)} kB · ${found.credit}`);
      fetched += 1;
    } catch (error) {
      console.warn(`  ! ${entry.slug} — ${error.message}`);
      failed += 1;
    }

    // Be a good citizen with a free API tier.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  manifest.source = source;
  manifest.generatedAt = new Date().toISOString();
  await fs.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nDone: ${fetched} fetched, ${skipped} kept, ${failed} failed.`);
  console.log(`Manifest: ${path.relative(ROOT, MANIFEST)}`);
  if (fetched > 0) {
    console.log('Restart the server (or rebuild) and the sample catalog will show real photos.');
    if (source === 'openverse') {
      console.log('These are openly-licensed images — credits are in the manifest and shown in the app.');
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
