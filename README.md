# PixelForge

A local-first prompt studio for game developers. It turns a few clicks into the
long, precise prompts that actually produce usable game assets — sprites,
tilesets, music briefs and engine code — and keeps one art direction across all
of them.

**Open `index.html` in a browser. That's it.** No build step, no install, no
server, no account.

Need a single portable file — to host it, email it, or drop it on a USB stick?
`npm run bundle` writes `dist/pixelforge.html`: the whole app in one file with
every stylesheet, script and sprite inlined.

---

## Works completely offline

This is a hard requirement of the project, not a nice-to-have:

- No CDN, no webfonts, no external stylesheets or scripts.
- No `fetch`, `XMLHttpRequest`, WebSocket or API calls of any kind.
- No analytics, telemetry, or error reporting.
- All artwork is original SVG authored for this project and stored in the repo.
- Everything you create is saved to `localStorage` on your own device.

Scripts are plain classic `<script>` tags rather than ES modules, specifically
so the app runs from a `file://` URL without a web server. The automated check
(below) fails the build if anything tries to reach the network.

---

## What's in it

### Art Assets
Ten builders — Character, Enemy/Boss, Platform, Biome tilemap, Prop, Background,
Foreground, UI/HUD, VFX and the Weapon forge. Roughly 900 curated presets behind
a search box. Six art styles (8-bit through to scratchy ink horror), three
perspectives, a full negative-prompt panel, and animation sprite-sheet
breakdowns that emit one prompt per frame with a shared consistency anchor.

### Music
Writes **prompts, not audio.** Fill in the brief — purpose, mood, genre,
instrumentation, tempo, key, length — and the panel formats it for Suno, Udio,
Stable Audio, MusicGen, or as a plain structured brief for a human composer.
Each target gets the format it actually responds to. Nothing is synthesised,
streamed or played.

### Code
Writes **prompts, not code.** Pick an engine (Unity, Godot, Unreal, Web), a
genre, and the systems you need from a catalog of 40+ — jump feel, dash, hit-stop,
behaviour trees, pathfinding, save/load, inventory, object pooling, and more.
The output is a structured brief with engine conventions, constraints, explicit
requirements and an output format, ready for any coding assistant.

### Theme Lock
Set your world, palette and style reference once. Every prompt from every
builder inherits it, plus an explicit consistency instruction. This is the
feature that makes a folder of assets look like one game.

### Library
Save any prompt, search it, copy it back out, or export everything to a file.
Stored in your browser.

### Flair that earns its place
- **Command palette** — `Ctrl`/`Cmd`+`K` searches every builder, action and
  preset (~1,000 entries) with fuzzy matching. Enter jumps straight there.
- **Roll** — randomises the entire builder from the preset library and forges
  the result. Good for breaking a blank-page stall.
- **Spec sheet** — exports the current prompt as a shareable SVG card with
  colour-coded clauses and real palette swatches.
- **Chiptune sound** — anvil strike on forge, coin on save, fanfare on unlock.
  Synthesised from oscillators at call time, so it ships no audio files. Only
  ever fires on a user action; mute from the header, and the first sound tells
  you where the mute is.

---

## Membership

Two plans, defined in `assets/js/core/premium.js`:

| | Apprentice (free) | Forge Master (pro) |
|---|---|---|
| Prompts per day | 20 | Unlimited |
| Core art builders | ✓ | ✓ |
| Music & Code builders | Standard depth | Studio depth |
| Library | 25 saved prompts | Unlimited + batch export |
| Theme Lock | — | ✓ |
| Biome tilemaps, Weapon forge | — | ✓ |
| Animation sprite sheets | — | ✓ |

### Payments are not wired up yet

Until a processor is added, the upgrade flow runs end to end and activates Pro
**for free**, as a "Founder's Preview". This is stated plainly in the
walkthrough — no card details are requested or collected anywhere, and the
confirmation step shows `Due today: $0.00 · Card: not required`.

**To add real payments later, change one function.** Everything routes through:

```js
// assets/js/core/premium.js
function startCheckout() {
  activatePro('checkout-preview');   // ← replace with your checkout redirect
}
```

Call `premium.activatePro()` on a successful payment callback and the rest of
the app — gating, quotas, badges, panel re-rendering — already works.

Pro can be toggled back off at any time from **Account → Switch to free**, which
is useful for checking how the free tier behaves.

---

## Project layout

```
index.html                    page shell: landing + studio
assets/
  css/
    theme.css                 design tokens, reset, UI primitives
    hero.css                  landing page and parallax hero
    studio.css                the workspace
  js/
    core/
      util.js                 DOM helpers, clipboard, toast, modal, ink accents
      store.js                localStorage state (defensive; falls back to memory)
      sfx.js                  chiptune SFX synthesised from oscillators
      speccard.js             renders a prompt as a shareable SVG spec sheet
      premium.js              plans, entitlements, quota, upgrade walkthrough
      palette.js              Ctrl+K command palette over everything
    data/
      presets.js              ~900 art presets, themes, biomes, weapons, music styles
      fields.js               form schemas for the art builders
      code-data.js            engines, genres, system catalog
    panels/
      art.js                  art prompt engine
      music.js                music prompt engine
      code.js                 code prompt engine
      library.js              saved prompts
    app.js                    routing, theme, parallax, account panel
  img/
    sprite-*.svg              original pixel-art sprites
    scene-*.svg               parallax hero layers
scripts/
  bundle.js                   inlines everything into dist/ as one file
  gen-sprites.js              compiles ASCII grids to sprite SVGs
  gen-scenery.js              generates the parallax silhouettes
  verify.js                   headless end-to-end check
```

The hand-drawn ink accents are inlined from `util.js` rather than loaded as
files, because `file://` blocks external SVG in CSS `mask-image` — inlining
means they inherit `currentColor` and follow the theme.

---

## Verifying it

`index.html` is checked with a headless-browser suite that drives every panel
and fails on any console error, any failed local request, or any attempt to
reach the network:

```
npm install      # only dependency is playwright, and only for this check
npm run verify
```

The app itself has zero dependencies — `npm install` is needed for the test
harness only, never to run PixelForge.

Pass a path to check a build instead of the source tree:

```
npm run bundle && node scripts/verify.js dist/pixelforge.html
```

The 26 checks cover: landing render, theme resolution and toggle, art prompt
generation and content, quota enforcement, Pro gating and the paywall, the full
upgrade walkthrough, biome batches, Theme Lock injection, animation frames, all
three music output formats, code prompts across engines, library save/search,
the command palette, roll, spec-sheet export, the sound toggle, the account
panel, and state persistence across a reload.

---

## Regenerating the artwork

The pixel sprites are compiled from ASCII grids and the scenery from a
deterministic silhouette generator:

```
npm run art                     # both, or run them individually:
node scripts/gen-sprites.js     # sprite-*.svg from ASCII grids
node scripts/gen-scenery.js     # scene-far/mid/trees.svg
```

Edit the grids or the parameters and re-run — output is stable across runs.

---

## Browser support

Any current version of Chrome, Edge, Firefox or Safari. `localStorage` being
unavailable (private mode, disabled storage) degrades to an in-memory store for
the session rather than breaking. Clipboard falls back to `execCommand` where
the async Clipboard API is unavailable, which is the common case on `file://`.
Reduced-motion preferences disable the parallax and all animation.
