/* End-to-end verification: loads the app from file://, exercises every panel,
   and fails loudly on console errors, page errors, failed requests or any
   attempt to reach the network. */
const path = require('path');
const { chromium } = require('playwright');
/* Defaults to the multi-file app; pass a path to check a build instead:
     node scripts/verify.js dist/pixelforge.html                              */
const TARGET = process.argv[2] || 'index.html';
const PAGE = 'file://' + path.resolve(__dirname, '..', TARGET);

const errors = [];
const external = [];
const failed = [];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });

  // Any request that is not a local file:// read is a violation of "offline".
  await ctx.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith('file://') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      external.push(url);
      return route.abort();
    }
    return route.continue();
  });

  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => {
    const u = r.url();
    if (u.startsWith('file://')) failed.push(u + ' — ' + (r.failure() && r.failure().errorText));
  });

  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const step = async (name, fn) => {
    const before = errors.length;
    try { await fn(); } catch (e) { errors.push('STEP "' + name + '" threw: ' + e.message); }
    await page.waitForTimeout(220);
    console.log((errors.length === before ? '  ok  ' : ' FAIL ') + name);
  };

  // ── landing ──────────────────────────────────────────────────────────
  await step('landing renders hero + plans', async () => {
    const h1 = await page.textContent('h1');
    if (!h1 || !h1.includes('Forge')) throw new Error('hero headline missing');
    const plans = await page.$$('#plans .plan');
    if (plans.length !== 2) throw new Error('expected 2 plan cards, got ' + plans.length);
    const ink = await page.$('.hl .ink svg');
    if (!ink) throw new Error('inline ink accent not painted');
  });


  await step('theme resolves from system preference and toggles both ways', async () => {
    // The starting theme follows the OS preference, so assert the flip, not a
    // fixed starting value.
    const start = await page.getAttribute('html', 'data-theme');
    if (start !== 'light' && start !== 'dark') throw new Error('no theme resolved, got ' + start);
    const other = start === 'dark' ? 'light' : 'dark';

    await page.click('#theme-toggle');
    if (await page.getAttribute('html', 'data-theme') !== other) throw new Error('did not switch to ' + other);

    await page.click('#theme-toggle');
    if (await page.getAttribute('html', 'data-theme') !== start) throw new Error('did not switch back to ' + start);
  });

  // ── studio: art ──────────────────────────────────────────────────────
  await step('open studio → art panel builds', async () => {
    await page.click('[data-action="studio"]');
    await page.waitForSelector('.mode-panel[data-mode="art"] .tab-rail');
    const tabs = await page.$$('.mode-panel[data-mode="art"] .tab');
    if (tabs.length < 10) throw new Error('expected 10 art tabs, got ' + tabs.length);
  });

  await step('art: generate a character prompt', async () => {
    await page.click('.mode-panel[data-mode="art"] .preset-item');
    await page.click('.mode-panel[data-mode="art"] button:has-text("Generate prompt")');
    const out = await page.textContent('#art-out-pos');
    if (!out || out.length < 400) throw new Error('prompt too short: ' + (out || '').length);
    if (!out.includes('CRITICAL')) throw new Error('missing transparency lock clause');
    if (!out.includes('pixel art')) throw new Error('missing style mode block');
  });


  await step('art: quota decrements on free plan', async () => {
    const q = await page.textContent('.quota');
    if (!/of 20 left today/.test(q)) throw new Error('quota strip wrong: ' + q);
  });

  await step('art: theme lock is gated behind Pro', async () => {
    const veil = await page.$('.lock-card .lock-veil');
    if (!veil) throw new Error('theme lock should be gated on free plan');
  });

  await step('art: gated biome tab shows lock', async () => {
    await page.click('.tab:has-text("Biome tilemap")');
    await page.waitForTimeout(200);
    const badge = await page.$('.mode-panel[data-mode="art"] .badge-pro');
    if (!badge) throw new Error('biome tab should show PRO badge');
    await page.click('.mode-panel[data-mode="art"] button:has-text("Generate tileset prompts")');
    await page.waitForTimeout(250);
    if (!(await page.$('.modal-back'))) throw new Error('paywall did not open');
    await page.click('.modal-x');
  });

  // ── premium walkthrough ──────────────────────────────────────────────
  await step('premium: walkthrough completes and unlocks Pro', async () => {
    await page.click('.studio-bar button:has-text("Upgrade")');
    await page.waitForSelector('.modal-back .wt-steps');
    for (let i = 0; i < 3; i++) {
      await page.click('.modal-back button:has-text("Next")');
      await page.waitForTimeout(140);
    }
    await page.click('.modal-back button:has-text("Activate")');
    await page.waitForTimeout(350);
    const plan = await page.textContent('#head-plan');
    if (plan.trim() !== 'FORGE MASTER') throw new Error('plan badge is ' + plan);
  });


  await step('pro: biome tileset batch generates', async () => {
    await page.click('.tab:has-text("Biome tilemap")');
    await page.waitForTimeout(200);
    await page.click('.mode-panel[data-mode="art"] button:has-text("Generate tileset prompts")');
    await page.waitForTimeout(300);
    const cards = await page.$$('#art-output .res-card');
    if (cards.length < 8) throw new Error('expected a full tileset batch, got ' + cards.length);
  });

  await step('pro: theme lock now usable and injects into prompt', async () => {
    await page.click('.tab:has-text("Character")');
    await page.waitForTimeout(200);
    if (await page.$('.lock-card .lock-veil')) throw new Error('theme lock still gated');
    await page.click('.lock-card .chip');
    await page.waitForTimeout(250);
    await page.click('.mode-panel[data-mode="art"] button:has-text("Generate prompt")');
    await page.waitForTimeout(200);
    const out = await page.textContent('#art-out-pos');
    if (!out.includes('CONSISTENCY')) throw new Error('theme lock not injected into prompt');
  });

  await step('pro: animation sheet produces per-frame prompts', async () => {
    await page.click('.mode-panel[data-mode="art"] .chip:has-text("Walk")');
    await page.waitForTimeout(200);
    await page.click('.mode-panel[data-mode="art"] button:has-text("Generate prompt")');
    await page.waitForTimeout(250);
    const frames = await page.$$('#art-output .res-card');
    if (frames.length !== 4) throw new Error('expected 4 walk frames, got ' + frames.length);
    const out = await page.textContent('#art-out-pos');
    if (!out.includes('CONSISTENCY ANCHOR') && !out.includes('Consistency anchor')) throw new Error('no consistency anchor');
  });

  // ── music ────────────────────────────────────────────────────────────
  await step('music: generates a Suno-formatted prompt', async () => {
    await page.click('.mode-btn[data-mode="music"]');
    await page.waitForSelector('#music-form');
    await page.fill('#mu_genre', 'dark orchestral');
    await page.fill('#mu_mood', 'ominous, brooding');
    await page.click('#music-form button:has-text("Generate music prompt")');
    await page.waitForTimeout(250);
    const out = await page.textContent('#music-output .out-block');
    if (!out.includes('[Purpose:')) throw new Error('not Suno tag format: ' + out.slice(0, 120));
    if (!out.includes('dark orchestral')) throw new Error('genre missing');
  });

  await step('music: preset fills the brief', async () => {
    await page.click('#music-form .preset-item');
    await page.waitForTimeout(200);
    const genre = await page.inputValue('#mu_genre');
    if (!genre) throw new Error('preset did not fill genre');
  });

  await step('music: plain-brief target reformats output', async () => {
    await page.click('#music-form .target:has-text("Any tool")');
    await page.waitForTimeout(200);
    await page.click('#music-form button:has-text("Generate music prompt")');
    await page.waitForTimeout(250);
    const out = await page.textContent('#music-output .out-block');
    if (!out.includes('GAME MUSIC BRIEF')) throw new Error('brief format not applied');
  });


  // ── code ─────────────────────────────────────────────────────────────
  await step('code: generates a structured prompt', async () => {
    await page.click('.mode-btn[data-mode="code"]');
    await page.waitForSelector('#code-form');
    await page.click('#code-form button:has-text("Generate code prompt")');
    await page.waitForTimeout(250);
    const out = await page.textContent('#code-output .out-block');
    if (!out.includes('# Task')) throw new Error('missing Task section');
    if (!out.includes('# Requirements')) throw new Error('missing Requirements section');
    if (!out.includes('Player controller')) throw new Error('selected system missing');
    if (!out.includes('# Architecture')) throw new Error('pro sections missing while on Pro');
  });

  await step('code: switching engine changes conventions', async () => {
    await page.click('#code-form .engine:has-text("Godot")');
    await page.waitForTimeout(200);
    await page.click('#code-form button:has-text("Generate code prompt")');
    await page.waitForTimeout(250);
    const out = await page.textContent('#code-output .out-block');
    if (!out.includes('GDScript')) throw new Error('engine switch not reflected');
    if (!out.includes('move_and_slide')) throw new Error('godot conventions missing');
  });

  await step('code: multi-system selection', async () => {
    await page.click('#code-form .preset-item:has-text("Dash")');
    await page.waitForTimeout(150);
    await page.click('#code-form button:has-text("Generate code prompt")');
    await page.waitForTimeout(250);
    const out = await page.textContent('#code-output .out-block');
    if (!out.includes('Dash / dodge')) throw new Error('second system not included');
  });


  // ── library ──────────────────────────────────────────────────────────
  await step('library: save then appears in library', async () => {
    await page.click('#code-output button:has-text("Save to library")');
    await page.waitForTimeout(200);
    await page.click('.mode-btn[data-mode="library"]');
    await page.waitForTimeout(250);
    const items = await page.$$('.lib-item');
    if (!items.length) throw new Error('library empty after save');
  });

  await step('library: search filters', async () => {
    await page.fill('.mode-panel[data-mode="library"] input[type=search]', 'zzzznotfound');
    await page.waitForTimeout(320);
    if (!(await page.$('.empty-state'))) throw new Error('empty state not shown');
    await page.fill('.mode-panel[data-mode="library"] input[type=search]', '');
    await page.waitForTimeout(320);
  });


  // ── account + persistence ────────────────────────────────────────────
  await step('account panel opens and reports Pro', async () => {
    await page.click('[data-action="account"]');
    await page.waitForSelector('.modal-back');
    const t = await page.textContent('.modal-back');
    if (!t.includes('Forge Master')) throw new Error('account does not show plan');
    await page.click('.modal-x');
  });

  await step('state survives a reload', async () => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    const plan = await page.textContent('#head-plan');
    if (plan.trim() !== 'FORGE MASTER') throw new Error('plan not persisted: ' + plan);
    await page.click('[data-action="studio"]');
    await page.click('.mode-btn[data-mode="library"]');
    await page.waitForTimeout(300);
    if (!(await page.$$('.lib-item')).length) throw new Error('library not persisted');
  });

  await browser.close();

  console.log('\n── results ──');
  console.log('console errors/warnings :', errors.length);
  errors.forEach(e => console.log('   ' + e));
  console.log('external requests       :', external.length);
  external.forEach(u => console.log('   ' + u));
  console.log('failed file:// requests :', failed.length);
  failed.forEach(u => console.log('   ' + u));
  process.exit(errors.length || external.length || failed.length ? 1 : 0);
})();
