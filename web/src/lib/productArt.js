/**
 * Product illustrations.
 *
 * Sample-data products have no photograph, and a two-letter monogram tells you
 * nothing about what you're buying. These are hand-drawn SVGs — one per product
 * shape, in matched colourways — so a search result reads as *headphones* or *a
 * robot vacuum* at a glance.
 *
 * Real photographs always win: when a live provider returns a thumbnail, the UI
 * shows that and never reaches for these.
 *
 * Everything is a plain string so the same source can be inlined in the
 * standalone demo (`demo/index.html`), which has no build step.
 * Colours are literal, not themed — a black headphone is black in both themes.
 */

/** Colourways, roughly matching each product's real finish. */
const PALETTES = {
  charcoal: { body: '#33363d', dark: '#1e2025', light: '#4d515a', trim: '#8e939c' },
  silver: { body: '#c6cad1', dark: '#9aa0a9', light: '#e6e9ee', trim: '#7c828c' },
  /* Deliberately a shade darker than the real finish: pure white disappears
     against the light image tile. */
  white: { body: '#d7dbe2', dark: '#a8aeb8', light: '#fbfcfd', trim: '#7c828c' },
  slate: { body: '#4a5160', dark: '#2f3542', light: '#68707f', trim: '#a8aeb9' },
  violet: { body: '#6d5aa8', dark: '#4d3f7d', light: '#8a78c4', trim: '#c9c0e4' },
  steel: { body: '#b3b9c2', dark: '#868d97', light: '#d9dde2', trim: '#5c626b' },
  ink: { body: '#25272c', dark: '#141519', light: '#3a3d44', trim: '#6f747d' },
  copper: { body: '#3b3d44', dark: '#25272c', light: '#54575f', trim: '#c98a5b' },
  teal: { body: '#2b6b6b', dark: '#1d4c4c', light: '#3d8a8a', trim: '#9fd0cc' },
};

const shell = (children) =>
  `<svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${children}</svg>`;

/**
 * Each drawing is a function of its palette, so the same shape ships in
 * several finishes (matte-black and silver headphones, for instance).
 */
const SHAPES = {
  headphones: (c) => shell(`
    <path d="M22 62V47a26 26 0 0 1 52 0v15" stroke="${c.body}" stroke-width="9" stroke-linecap="round"/>
    <rect x="10" y="52" width="22" height="32" rx="10" fill="${c.body}"/>
    <rect x="64" y="52" width="22" height="32" rx="10" fill="${c.dark}"/>
    <rect x="15" y="58" width="12" height="20" rx="6" fill="${c.light}"/>
    <rect x="69" y="58" width="12" height="20" rx="6" fill="${c.light}" opacity=".7"/>
  `),

  earbuds: (c) => shell(`
    <rect x="22" y="48" width="52" height="36" rx="14" fill="${c.body}"/>
    <path d="M22 62a14 14 0 0 1 0-14v14z" fill="${c.dark}" opacity=".25"/>
    <path d="M23 60h50" stroke="${c.trim}" stroke-width="2" opacity=".55"/>
    <circle cx="48" cy="71" r="3" fill="${c.trim}" opacity=".5"/>
    <g>
      <circle cx="36" cy="26" r="10" fill="${c.light}"/>
      <path d="M32 34h8v10a4 4 0 0 1-8 0z" fill="${c.light}"/>
      <circle cx="36" cy="26" r="4" fill="${c.trim}" opacity=".45"/>
      <path d="M32 34h8v3h-8z" fill="${c.dark}" opacity=".18"/>
    </g>
    <g>
      <circle cx="61" cy="30" r="8.5" fill="${c.light}"/>
      <path d="M57.5 37h7v8.5a3.5 3.5 0 0 1-7 0z" fill="${c.light}"/>
      <circle cx="61" cy="30" r="3.4" fill="${c.trim}" opacity=".45"/>
      <path d="M57.5 37h7v2.6h-7z" fill="${c.dark}" opacity=".18"/>
    </g>
  `),

  console: (c) => shell(`
    <rect x="12" y="24" width="16" height="48" rx="8" fill="${c.trim}"/>
    <rect x="68" y="24" width="16" height="48" rx="8" fill="${c.trim}"/>
    <rect x="26" y="26" width="44" height="44" rx="5" fill="${c.dark}"/>
    <rect x="30" y="30" width="36" height="36" rx="3" fill="${c.light}" opacity=".55"/>
    <circle cx="20" cy="38" r="4" fill="${c.body}"/>
    <circle cx="76" cy="58" r="4" fill="${c.body}"/>
    <circle cx="76" cy="38" r="2.6" fill="${c.body}"/>
    <circle cx="20" cy="58" r="2.6" fill="${c.body}"/>
  `),

  tv: (c) => shell(`
    <rect x="8" y="20" width="80" height="48" rx="4" fill="${c.body}"/>
    <rect x="11" y="23" width="74" height="40" rx="2" fill="${c.dark}"/>
    <path d="M11 55 32 38l14 11 16-14 23 18v6a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2z" fill="${c.light}" opacity=".5"/>
    <circle cx="66" cy="32" r="5" fill="${c.trim}" opacity=".5"/>
    <rect x="42" y="68" width="12" height="8" fill="${c.trim}"/>
    <rect x="30" y="76" width="36" height="5" rx="2.5" fill="${c.body}"/>
  `),

  vacuum: (c) => shell(`
    <rect x="52" y="14" width="30" height="22" rx="11" fill="${c.body}"/>
    <circle cx="67" cy="25" r="7" fill="${c.trim}" opacity=".6"/>
    <path d="M56 34 34 66" stroke="${c.dark}" stroke-width="8" stroke-linecap="round"/>
    <path d="M45 22h10v10H45z" fill="${c.dark}" opacity=".8"/>
    <path d="M14 72a6 6 0 0 1 6-6h22a6 6 0 0 1 6 6v6a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="${c.light}"/>
    <rect x="18" y="76" width="26" height="4" rx="2" fill="${c.dark}" opacity=".55"/>
  `),

  cooker: (c) => shell(`
    <rect x="22" y="34" width="52" height="42" rx="8" fill="${c.body}"/>
    <path d="M22 60h52v8a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8z" fill="${c.dark}" opacity=".75"/>
    <rect x="18" y="76" width="60" height="6" rx="3" fill="${c.dark}"/>
    <rect x="26" y="40" width="44" height="15" rx="4" fill="${c.dark}"/>
    <rect x="30" y="45" width="20" height="5" rx="2.5" fill="${c.trim}" opacity=".85"/>
    <circle cx="62" cy="47.5" r="3" fill="${c.trim}" opacity=".7"/>
    <rect x="20" y="24" width="56" height="10" rx="5" fill="${c.light}"/>
    <rect x="41" y="14" width="14" height="11" rx="5.5" fill="${c.dark}"/>
    <path d="M48 8v7" stroke="${c.trim}" stroke-width="3" stroke-linecap="round"/>
  `),

  powerbank: (c) => shell(`
    <rect x="28" y="14" width="40" height="68" rx="10" fill="${c.body}"/>
    <rect x="35" y="24" width="26" height="18" rx="4" fill="${c.dark}"/>
    <rect x="39" y="30" width="18" height="6" rx="3" fill="${c.trim}"/>
    <rect x="36" y="52" width="10" height="6" rx="2" fill="${c.dark}"/>
    <rect x="50" y="52" width="10" height="6" rx="2" fill="${c.dark}"/>
    <rect x="38" y="66" width="20" height="3" rx="1.5" fill="${c.light}" opacity=".6"/>
  `),

  dessert: (c) => shell(`
    <rect x="18" y="74" width="60" height="8" rx="4" fill="${c.dark}"/>
    <rect x="20" y="16" width="20" height="58" rx="7" fill="${c.body}"/>
    <rect x="24" y="24" width="12" height="16" rx="3" fill="${c.trim}" opacity=".55"/>
    <path d="M38 18h30a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5H38z" fill="${c.body}"/>
    <rect x="52" y="37" width="6" height="8" fill="${c.dark}" opacity=".8"/>
    <path d="M44 52h32l-4 20a4 4 0 0 1-4 3H52a4 4 0 0 1-4-3z" fill="${c.light}"/>
    <path d="M55 52c0-4 2-6 5-6s5 2 5 6z" fill="${c.trim}"/>
    <path d="M50 52c1-7 5-11 10-11s9 4 10 11z" fill="${c.light}" opacity=".9"/>
    <circle cx="60" cy="40" r="4" fill="${c.trim}" opacity=".85"/>
  `),

  ssd: (c) => shell(`
    <rect x="8" y="40" width="80" height="18" rx="3" fill="${c.body}"/>
    <rect x="8" y="43" width="12" height="12" rx="2" fill="${c.trim}"/>
    <path d="M14 43v12M17 43v12M11 43v12" stroke="${c.dark}" stroke-width="1.2" opacity=".6"/>
    <rect x="26" y="44" width="16" height="10" rx="1.5" fill="${c.light}" opacity=".7"/>
    <rect x="46" y="44" width="16" height="10" rx="1.5" fill="${c.light}" opacity=".7"/>
    <rect x="66" y="44" width="14" height="10" rx="1.5" fill="${c.dark}"/>
  `),

  ereader: (c) => shell(`
    <rect x="26" y="12" width="44" height="72" rx="6" fill="${c.body}"/>
    <rect x="31" y="18" width="34" height="54" rx="2" fill="${c.light}"/>
    <path d="M36 28h24M36 35h24M36 42h18M36 49h24M36 56h14" stroke="${c.trim}" stroke-width="2.5" stroke-linecap="round" opacity=".65"/>
    <rect x="42" y="76" width="12" height="3" rx="1.5" fill="${c.dark}" opacity=".5"/>
  `),

  robot: (c) => shell(`
    <circle cx="48" cy="50" r="34" fill="${c.body}"/>
    <path d="M14 50a34 34 0 0 1 68 0z" fill="${c.light}" opacity=".35"/>
    <path d="M17 62a34 34 0 0 0 62 0z" fill="${c.dark}" opacity=".45"/>
    <circle cx="48" cy="40" r="9" fill="${c.dark}"/>
    <circle cx="48" cy="40" r="4" fill="${c.trim}"/>
    <rect x="30" y="64" width="36" height="6" rx="3" fill="${c.dark}" opacity=".7"/>
  `),

  /** Fallback for anything we can't classify. */
  box: (c) => shell(`
    <path d="M48 14 82 30v36L48 82 14 66V30z" fill="${c.body}"/>
    <path d="M48 14 82 30 48 46 14 30z" fill="${c.light}"/>
    <path d="M48 46v36L14 66V30z" fill="${c.dark}" opacity=".55"/>
    <path d="M31 22 65 38v12" stroke="${c.trim}" stroke-width="3" stroke-linecap="round" opacity=".6"/>
  `),
};

/** Keyword → shape, used when a product has no explicit art assigned. */
const KEYWORD_SHAPES = [
  // Earbuds first: they are usually filed under a "Headphones" category, so the
  // broader rule below would otherwise claim them.
  [/earbud|airpod|in-ear|\bbuds\b/i, ['earbuds', 'white']],
  [/headphone|headset|over-ear|noise.?cancel/i, ['headphones', 'charcoal']],
  [/switch|console|handheld|gaming|playstation|xbox|steam deck/i, ['console', 'slate']],
  [/\btv\b|television|oled|qled|smart tv|monitor|display/i, ['tv', 'ink']],
  [/robot vacuum|roomba|robovac/i, ['robot', 'copper']],
  [/vacuum|cleaner|dyson/i, ['vacuum', 'violet']],
  [/pressure cooker|instant pot|air fryer|slow cooker|rice cooker/i, ['cooker', 'steel']],
  [/ice cream|creami|blender|mixer|frozen dessert/i, ['dessert', 'ink']],
  [/ssd|nvme|hard drive|storage|m\.2|memory/i, ['ssd', 'ink']],
  [/kindle|e-?reader|paperwhite|tablet|ipad/i, ['ereader', 'slate']],
  [/power bank|powercore|battery|charger/i, ['powerbank', 'ink']],
  [/speaker|soundbar|audio/i, ['headphones', 'ink']],
];

/**
 * Brand-led finishes, so two products of the same shape don't come out
 * identical — Bose headphones are silver where Sony's are matte black.
 */
const PALETTE_HINTS = [
  [/\bbose\b|\bsilver\b|\bwhite\b/i, 'silver'],
  [/\bapple\b|airpods/i, 'white'],
  [/\bsony\b|matte black|\bblack\b/i, 'charcoal'],
];

/**
 * Picks a drawing for a product. An explicit `artKind` wins; otherwise the
 * title and category are matched on keywords, which is what live provider
 * results (no art fields, but a descriptive title) rely on.
 *
 * @param {{ artKind?: string, artPalette?: string, title?: string, category?: string, brand?: string }} product
 * @returns {{ kind: string, palette: string }}
 */
export function resolveArt(product = {}) {
  const haystack = `${product.brand ?? ''} ${product.title ?? ''} ${product.category ?? ''}`;

  if (product.artKind && SHAPES[product.artKind]) {
    return { kind: product.artKind, palette: product.artPalette ?? 'slate' };
  }

  for (const [pattern, [kind, palette]] of KEYWORD_SHAPES) {
    if (!pattern.test(haystack)) continue;
    const hinted = PALETTE_HINTS.find(([hint]) => hint.test(haystack));
    return { kind, palette: hinted ? hinted[1] : palette };
  }

  return { kind: 'box', palette: 'slate' };
}

/**
 * @param {object} product
 * @returns {string} Inline SVG markup, sized by its container.
 */
export function productArtSvg(product) {
  const { kind, palette } = resolveArt(product);
  const draw = SHAPES[kind] ?? SHAPES.box;
  return draw(PALETTES[palette] ?? PALETTES.slate);
}

export { PALETTES, SHAPES };
