/* ===========================================================================
   PixelForge — membership, entitlements and the upgrade walkthrough.

   Payments are not wired up yet. Until they are, the upgrade flow runs end to
   end and activates Pro for free as a "Founder's Preview". The copy says so
   plainly — nothing here pretends to take a payment or collect card details.
   When a real processor is added, only `startCheckout()` needs to change.
   =========================================================================== */
(function (global) {
  'use strict';

  const { el, modal, toast } = global.PF.util;
  const store = global.PF.store;

  /* ── plan definitions ──────────────────────────────────────────────────── */
  const FREE_DAILY_PROMPTS = 20;
  const FREE_LIBRARY_CAP = 25;

  const PLANS = {
    free: {
      id: 'free',
      name: 'Apprentice',
      price: '$0',
      cadence: 'forever',
      note: 'Everything you need to prototype a look and ship your first sprites.',
      features: [
        { text: '<b>' + FREE_DAILY_PROMPTS + ' prompts</b> per day', on: true },
        { text: 'Character, Enemy, Prop, Platform, Background, Foreground, UI &amp; VFX builders', on: true },
        { text: 'Music &amp; Code prompt builders — <b>standard</b> depth', on: true },
        { text: 'Save up to <b>' + FREE_LIBRARY_CAP + '</b> prompts to your library', on: true },
        { text: 'Theme Lock for consistent art direction', on: false },
        { text: 'Biome tilemap batches &amp; Weapon forge', on: false },
        { text: 'Animation sprite-sheet frame breakdowns', on: false },
        { text: 'Studio-depth Music &amp; Code prompts, batch export', on: false }
      ]
    },
    pro: {
      id: 'pro',
      name: 'Forge Master',
      price: '$9',
      cadence: 'per month',
      note: 'The whole workshop. Built for people shipping a real game.',
      features: [
        { text: '<b>Unlimited</b> prompts, every day', on: true },
        { text: 'Every asset builder, including <b>Biome tilemaps</b> and the <b>Weapon forge</b>', on: true },
        { text: '<b>Theme Lock</b> — one art direction injected into every prompt', on: true },
        { text: '<b>Animation sprite sheets</b> — per-frame prompts with a consistency anchor', on: true },
        { text: 'Studio-depth <b>Music</b> prompts: structure, mix notes, stems, loop points', on: true },
        { text: 'Studio-depth <b>Code</b> prompts: architecture, edge cases, tests, review pass', on: true },
        { text: '<b>Unlimited library</b> + batch copy and export to file', on: true },
        { text: 'Every future builder, included', on: true }
      ]
    }
  };

  /* Feature id → the plan required to use it. */
  const GATED = {
    themeLock:   'pro',
    biome:       'pro',
    weapon:      'pro',
    animation:   'pro',
    musicPro:    'pro',
    codePro:     'pro',
    batchExport: 'pro'
  };

  const LABELS = {
    themeLock:   ['Theme Lock', 'Lock one art direction — world, palette and reference — and every prompt you generate inherits it. This is what makes a set of assets look like one game.'],
    biome:       ['Biome Tilemaps', 'Generate a complete, seamlessly tileable tileset for a biome in one pass — floors, edges, corners, slopes and decoration.'],
    weapon:      ['Weapon Forge', 'Build weapon and item sprites with rarity tiers, materials and magical elements baked into the prompt.'],
    animation:   ['Animation Sprite Sheets', 'Turn any character into a frame-by-frame animation prompt set with a shared consistency anchor, so frames actually match.'],
    musicPro:    ['Studio Music Prompts', 'Adds song structure, mix and mastering notes, stem breakdowns and seamless loop instructions to every music prompt.'],
    codePro:     ['Studio Code Prompts', 'Adds architecture constraints, edge cases, testing requirements and a self-review pass to every code prompt.'],
    batchExport: ['Batch Export', 'Copy or download every prompt in a batch at once, as a single ready-to-use file.']
  };

  /* ── state ─────────────────────────────────────────────────────────────── */
  function plan() { return store.get('plan') === 'pro' ? 'pro' : 'free'; }
  function isPro() { return plan() === 'pro'; }
  function planInfo() { return PLANS[plan()]; }

  /** True when the current plan unlocks `feature`. */
  function has(feature) {
    const need = GATED[feature];
    if (!need) return true;            // ungated
    return need === 'pro' ? isPro() : true;
  }

  /* ── quota ─────────────────────────────────────────────────────────────── */
  function quota() {
    if (isPro()) return { unlimited: true, used: store.usageToday(), limit: Infinity, left: Infinity };
    const used = store.usageToday();
    return { unlimited: false, used, limit: FREE_DAILY_PROMPTS, left: Math.max(0, FREE_DAILY_PROMPTS - used) };
  }

  /**
   * Consume one generation from the daily quota.
   * Returns true when the caller may proceed; shows the paywall and returns
   * false when the free plan is out for the day.
   */
  function consume(n) {
    if (isPro()) { store.bumpUsage(n == null ? 1 : n); return true; }
    const q = quota();
    if (q.left <= 0) {
      showPaywall('quota');
      return false;
    }
    store.bumpUsage(n == null ? 1 : n);
    return true;
  }

  function libraryCap() { return isPro() ? Infinity : FREE_LIBRARY_CAP; }

  function canSaveMore() { return store.get('library').length < libraryCap(); }

  /* ── activation ────────────────────────────────────────────────────────── */
  function activatePro(source) {
    store.set('plan', 'pro');
    if (!store.get('trialStartedAt')) store.set('trialStartedAt', Date.now());
    if (global.PF.sfx) global.PF.sfx.play('fanfare');
    toast('Forge Master unlocked — every builder is open', 'ok');
    document.dispatchEvent(new CustomEvent('pf:plan-changed', { detail: { plan: 'pro', source: source || 'walkthrough' } }));
  }

  function downgrade() {
    store.set('plan', 'free');
    toast('Switched back to the Apprentice plan', 'warn');
    document.dispatchEvent(new CustomEvent('pf:plan-changed', { detail: { plan: 'free' } }));
  }

  /**
   * Placeholder for real checkout. When a processor is wired up, this is the
   * only function that should change — everything else already routes here.
   */
  function startCheckout() {
    activatePro('checkout-preview');
  }

  /* ── paywall / upgrade walkthrough ─────────────────────────────────────── */

  /** Small nudge shown when a locked control is used. */
  function showPaywall(reason, feature) {
    const info = LABELS[feature];
    let title, body;
    if (reason === 'quota') {
      title = "You've used today's " + FREE_DAILY_PROMPTS + ' free prompts';
      body = 'Your quota resets tomorrow. Forge Master removes the cap entirely and opens every builder.';
    } else if (reason === 'library') {
      title = 'Library is full';
      body = 'The Apprentice plan keeps your last ' + FREE_LIBRARY_CAP + ' prompts. Forge Master stores an unlimited library, or you can delete a few to make room.';
    } else if (info) {
      title = info[0] + ' is a Forge Master feature';
      body = info[1];
    } else {
      title = 'That’s a Forge Master feature';
      body = 'Upgrade to open every builder in the studio.';
    }

    const pane = el('div', { class: 'modal-pad' }, [
      el('div', { class: 'wt-hero' }, [
        el('img', { src: 'assets/img/sprite-chest.svg', alt: '', class: 'px' }),
        el('h3', { text: title }),
        el('p', { text: body })
      ]),
      el('div', { class: 'row', style: 'justify-content:center;gap:10px' }, [
        el('button', { class: 'btn btn-gold', type: 'button', text: 'See what’s included', onclick: () => { close(); openWalkthrough(feature); } }),
        el('button', { class: 'btn btn-ghost', type: 'button', text: 'Not now', onclick: () => close() })
      ])
    ]);
    const close = modal(pane, { label: title });
  }

  /**
   * The full upgrade walkthrough. Four steps, all free to complete —
   * step 3 is explicit that no payment is being taken yet.
   */
  function openWalkthrough(highlight) {
    let step = 0;
    const TOTAL = 4;

    const dots = el('div', { class: 'wt-steps' },
      Array.from({ length: TOTAL }, () => el('div', { class: 'wt-dot' })));

    const body = el('div');
    const backBtn = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Back', onclick: () => go(step - 1) });
    const nextBtn = el('button', { class: 'btn btn-gold', type: 'button', text: 'Next', onclick: () => go(step + 1) });
    const foot = el('div', { class: 'wt-foot' }, [backBtn, el('div', { class: 'spacer' }), nextBtn]);

    const pane = el('div', { class: 'modal-pad' }, [dots, body, foot]);
    const close = modal(pane, { label: 'Upgrade to Forge Master', wide: false });

    function panes() {
      const hl = highlight && LABELS[highlight];
      return [
        /* 1 — what it is */
        el('div', {}, [
          el('div', { class: 'wt-hero' }, [
            el('img', { src: 'assets/img/sprite-banner.svg', alt: '', class: 'px' }),
            el('h3', { text: 'Forge Master' }),
            el('p', { html: hl
              ? '<b>' + hl[0] + '</b> — ' + hl[1]
              : 'One plan that opens every builder in the studio and takes the daily cap off.' })
          ]),
          el('ul', { class: 'wt-list' }, PLANS.pro.features.slice(0, 5).map(f =>
            el('li', {}, [el('span', { class: 'tick', text: '✦' }), el('span', { html: f.text })])))
        ]),

        /* 2 — the plan */
        el('div', {}, [
          el('div', { class: 'wt-hero' }, [
            el('img', { src: 'assets/img/sprite-coin.svg', alt: '', class: 'px' }),
            el('h3', { text: 'The plan' }),
            el('p', { text: 'Simple and flat. No seats, no credits, no per-prompt metering.' })
          ]),
          el('div', { class: 'fake-card' }, [
            el('div', { class: 'row', style: 'margin-bottom:8px' }, [
              el('b', { style: 'font-size:26px;color:var(--gold)', text: PLANS.pro.price }),
              el('span', { class: 'muted', text: '/ ' + PLANS.pro.cadence })
            ]),
            el('div', { html: 'Unlimited prompts · every builder · Theme Lock · animation sheets · unlimited library · batch export' })
          ]),
          el('p', { class: 'card-sub', style: 'margin-top:14px', text: 'Everything runs locally in your browser. Your prompts and library never leave this device.' })
        ]),

        /* 3 — the honest bit */
        el('div', {}, [
          el('div', { class: 'wt-hero' }, [
            el('img', { src: 'assets/img/sprite-crystal.svg', alt: '', class: 'px' }),
            el('h3', { text: 'Founder’s Preview — free for now' }),
            el('p', { text: 'Payments are not switched on yet. Until they are, this upgrade is genuinely free and you will not be asked for a card.' })
          ]),
          el('ul', { class: 'wt-list' }, [
            el('li', {}, [el('span', { class: 'tick', text: '✦' }), el('span', { html: '<b>No payment details</b> are collected anywhere in this flow.' })]),
            el('li', {}, [el('span', { class: 'tick', text: '✦' }), el('span', { html: 'Pro stays unlocked on this device until you turn it off in <b>Account</b>.' })]),
            el('li', {}, [el('span', { class: 'tick', text: '✦' }), el('span', { html: 'When billing does go live, you’ll be told before anything changes.' })])
          ])
        ]),

        /* 4 — confirm */
        el('div', {}, [
          el('div', { class: 'wt-hero' }, [
            el('img', { src: 'assets/img/sprite-knight.svg', alt: '', class: 'px' }),
            el('h3', { text: 'Ready to open the forge' }),
            el('p', { text: 'Activate Forge Master on this device. It takes effect immediately.' })
          ]),
          el('div', { class: 'fake-card' }, [
            el('div', { html: '<b>Plan:</b> Forge Master · <b>Due today:</b> $0.00 · <b>Card:</b> not required' })
          ])
        ])
      ];
    }

    const built = panes();

    function go(next) {
      if (next < 0) return;
      if (next >= TOTAL) { close(); startCheckout(); return; }
      step = next;
      body.innerHTML = '';
      body.appendChild(built[step]);
      Array.prototype.forEach.call(dots.children, (d, i) => d.classList.toggle('on', i <= step));
      backBtn.style.visibility = step === 0 ? 'hidden' : '';
      nextBtn.textContent = step === TOTAL - 1 ? 'Activate Forge Master — $0' : 'Next';
      const focusable = body.querySelector('button, a[href]');
      if (focusable) focusable.focus();
    }

    go(0);
  }

  /* ── gate rendering ────────────────────────────────────────────────────── */

  /**
   * Wrap `node`'s content behind a blur + unlock veil when `feature` is locked.
   * Returns true when the gate was applied.
   */
  function gate(node, feature) {
    if (has(feature)) return false;
    const info = LABELS[feature] || ['Forge Master feature', 'Upgrade to unlock this builder.'];

    const inner = el('div', { class: 'locked-inner' });
    while (node.firstChild) inner.appendChild(node.firstChild);

    node.classList.add('locked');
    node.appendChild(inner);
    node.appendChild(el('div', { class: 'lock-veil' }, [
      el('img', { src: 'assets/img/sprite-chest.svg', alt: '', class: 'px' }),
      el('h4', { text: info[0] }),
      el('p', { text: info[1] }),
      el('button', { class: 'btn btn-gold', type: 'button', text: 'Unlock with Forge Master', onclick: () => openWalkthrough(feature) })
    ]));
    return true;
  }

  /** Render the daily-quota strip into a container. */
  function renderQuota(host) {
    const q = quota();
    host.innerHTML = '';
    if (q.unlimited) {
      host.appendChild(el('div', { class: 'quota' }, [
        el('span', { class: 'badge badge-pro', text: 'PRO' }),
        el('span', { text: 'Unlimited prompts' }),
        el('div', { class: 'spacer' }),
        el('span', { class: 'tiny muted', text: q.used + ' generated today' })
      ]));
      return;
    }
    const pct = Math.min(100, (q.used / q.limit) * 100);
    const level = q.left === 0 ? 'out' : q.left <= 5 ? 'low' : '';
    host.appendChild(el('div', { class: 'quota ' + level }, [
      el('span', { text: q.left + ' of ' + q.limit + ' left today' }),
      el('div', { class: 'quota-bar' }, el('div', { class: 'quota-fill', style: 'width:' + pct + '%' })),
      el('button', { class: 'btn btn-sm btn-gold', type: 'button', text: 'Upgrade', onclick: () => openWalkthrough() })
    ]));
  }

  global.PF = global.PF || {};
  global.PF.premium = {
    PLANS, GATED, LABELS,
    FREE_DAILY_PROMPTS, FREE_LIBRARY_CAP,
    plan, isPro, planInfo, has,
    quota, consume, libraryCap, canSaveMore,
    activatePro, downgrade, startCheckout,
    showPaywall, openWalkthrough, gate, renderQuota
  };
})(typeof window !== 'undefined' ? window : globalThis);
