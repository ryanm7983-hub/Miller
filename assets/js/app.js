/* ===========================================================================
   PixelForge — app shell: routing between landing and studio, mode switching,
   theme toggle, parallax and the account panel.
   =========================================================================== */
(function (global) {
  'use strict';

  const U = global.PF.util;
  const { $, $$, el, toast, confirmDialog } = U;
  const store = global.PF.store;
  const premium = global.PF.premium;

  const MODES = [
    { id: 'art', name: 'Art Assets', icon: 'sprite-knight', mount: () => global.PF.art },
    { id: 'music', name: 'Music', icon: 'sprite-banner', mount: () => global.PF.music },
    { id: 'code', name: 'Code', icon: 'sprite-crystal', mount: () => global.PF.code },
    { id: 'library', name: 'Library', icon: 'sprite-chest', mount: () => global.PF.library }
  ];

  let currentMode = null;
  const mounted = {};

  /* ── theme ─────────────────────────────────────────────────────────────── */

  /* Until the viewer picks a theme explicitly we follow the system preference,
     so the page arrives looking right rather than forcing dark on everyone. */
  function resolveTheme() {
    const saved = store.get('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return (global.matchMedia && global.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = $('#theme-toggle');
    if (btn) {
      btn.textContent = theme === 'light' ? '☾' : '☀';
      btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    }
  }

  function applySoundIcon() {
    const btn = $('#sound-toggle');
    if (!btn) return;
    const on = global.PF.sfx.enabled();
    btn.textContent = on ? '🔊' : '🔇';
    btn.setAttribute('aria-label', on ? 'Mute sound effects' : 'Unmute sound effects');
    btn.setAttribute('title', on ? 'Sound on' : 'Sound off');
    btn.classList.toggle('off', !on);
  }

  function toggleSound() {
    global.PF.sfx.setEnabled(!global.PF.sfx.enabled());
    applySoundIcon();
  }

  function toggleTheme() {
    const next = resolveTheme() === 'light' ? 'dark' : 'light';
    store.set('theme', next);
    applyTheme(next);
  }

  /* ── routing ───────────────────────────────────────────────────────────── */
  function showStudio(modeId) {
    document.body.classList.add('in-studio');
    $('#studio').classList.add('active');
    setMode(modeId || currentMode || 'art');
    window.scrollTo({ top: 0, behavior: 'auto' });
    updateHeaderCta();
  }

  function showLanding() {
    document.body.classList.remove('in-studio');
    $('#studio').classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'auto' });
    updateHeaderCta();
  }

  function setMode(id) {
    const mode = MODES.find(m => m.id === id) || MODES[0];
    currentMode = mode.id;
    store.pref('app', 'mode', mode.id);

    $$('.mode-btn').forEach(b => b.classList.toggle('on', b.dataset.mode === mode.id));
    $$('.mode-panel').forEach(p => { p.hidden = p.dataset.mode !== mode.id; });

    const panel = $('.mode-panel[data-mode="' + mode.id + '"]');
    const impl = mode.mount();
    if (panel && impl) {
      if (!mounted[mode.id]) { impl.mount(panel); mounted[mode.id] = true; }
      else if (impl.render) impl.render();
    }
  }

  /* ── header ────────────────────────────────────────────────────────────── */
  function updateHeaderCta() {
    const inStudio = document.body.classList.contains('in-studio');
    const cta = $('#head-cta');
    const planBadge = $('#head-plan');
    if (cta) {
      cta.textContent = inStudio ? 'Home' : 'Open the studio';
      /* Short label used by the compact phone header (see hero.css). */
      cta.dataset.short = inStudio ? 'Home' : 'Studio';
      cta.className = inStudio ? 'btn btn-sm btn-ghost' : 'btn btn-sm btn-primary';
    }
    if (planBadge) {
      const pro = premium.isPro();
      planBadge.textContent = pro ? 'FORGE MASTER' : 'FREE';
      planBadge.className = 'badge ' + (pro ? 'badge-pro' : '');
    }
  }

  /* ── account panel ─────────────────────────────────────────────────────── */
  function openAccount() {
    const pro = premium.isPro();
    const info = premium.planInfo();
    const q = premium.quota();
    const lib = store.get('library').length;

    const body = el('div', { class: 'modal-pad stack' }, [
      el('h3', { style: 'font-size:20px', text: 'Your account' }),

      el('div', { class: 'acct-row' }, [
        el('img', { src: 'assets/img/' + (pro ? 'sprite-banner' : 'sprite-knight') + '.svg', alt: '', class: 'px' }),
        el('div', { class: 'grow' }, [
          el('b', {}, [document.createTextNode(info.name + ' '), el('span', { class: 'badge ' + (pro ? 'badge-pro' : ''), text: pro ? 'PRO' : 'FREE' })]),
          el('span', { text: pro ? 'Every builder unlocked · unlimited prompts' : q.left + ' of ' + q.limit + ' prompts left today' })
        ]),
        pro
          ? el('button', {
              class: 'btn btn-sm btn-ghost', type: 'button', text: 'Switch to free',
              onclick: () => confirmDialog('Switch back to Apprentice?', 'Pro builders will lock again and the daily cap comes back. Your saved prompts are kept.', 'Switch to free')
                .then(ok => { if (ok) { premium.downgrade(); close(); openAccount(); } })
            })
          : el('button', { class: 'btn btn-sm btn-gold', type: 'button', text: 'Upgrade', onclick: () => { close(); premium.openWalkthrough(); } })
      ]),

      el('div', { class: 'note-strip', html:
        '<b>Everything is stored on this device.</b> Your prompts, library and settings live in this browser only — nothing is uploaded, and PixelForge makes no network requests at all.' }),

      el('div', { class: 'grid-2' }, [
        el('div', { class: 'field' }, [
          el('span', { class: 'label', text: 'Saved prompts' }),
          el('div', { class: 'row' }, [
            el('b', { text: String(lib) }),
            el('span', { class: 'spacer' }),
            el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Export JSON', onclick: () => {
              U.download('pixelforge-backup.json', store.exportJSON(), 'application/json');
              toast('Backup downloaded', 'ok');
            } })
          ])
        ]),
        el('div', { class: 'field' }, [
          el('span', { class: 'label', text: 'Prompts today' }),
          el('div', { class: 'row' }, [
            el('b', { text: String(q.used) }),
            el('span', { class: 'spacer' }),
            el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Reset counter', onclick: () => { store.resetUsage(); toast('Daily counter reset', 'ok'); close(); openAccount(); } })
          ])
        ])
      ]),

      el('hr', { class: 'divider' }),

      el('div', { class: 'row' }, [
        el('span', { class: 'card-sub', text: 'Reset PixelForge to a clean slate on this device.' }),
        el('span', { class: 'spacer' }),
        el('button', {
          class: 'btn btn-sm btn-ghost', type: 'button', text: 'Reset everything',
          onclick: () => confirmDialog('Reset everything?', 'This deletes your library, settings and plan on this device. It cannot be undone.', 'Reset everything')
            .then(ok => {
              if (!ok) return;
              store.resetAll();
              close();
              applyTheme(resolveTheme());
              Object.keys(mounted).forEach(k => delete mounted[k]);
              setMode('art');
              updateHeaderCta();
              toast('PixelForge reset', 'warn');
            })
        })
      ])
    ]);

    const close = U.modal(body, { label: 'Your account' });
  }

  /* ── parallax ──────────────────────────────────────────────────────────── */
  function initParallax() {
    const hero = $('.hero');
    if (!hero) return;
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const layers = [
      { node: $('.l-stars'), rate: 0.14 },
      { node: $('.l-moon'), rate: 0.10 },
      { node: $('.l-far'), rate: 0.20 },
      { node: $('.l-mid'), rate: 0.30 },
      { node: $('.l-castle'), rate: 0.26 },
      { node: $('.l-trees'), rate: 0.44 }
    ].filter(l => l.node);

    let ticking = false;
    function update() {
      const y = window.scrollY || 0;
      if (y < window.innerHeight * 1.4) {
        layers.forEach(l => {
          const shift = y * l.rate;
          l.node.style.transform = l.node.classList.contains('l-castle')
            ? 'translateX(-50%) translateY(' + shift + 'px)'
            : 'translateY(' + shift + 'px)';
        });
      }
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  function initStickyHeader() {
    const head = $('.site-head');
    if (!head) return;
    const onScroll = () => head.classList.toggle('stuck', (window.scrollY || 0) > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── boot ──────────────────────────────────────────────────────────────── */
  function init() {
    applyTheme(resolveTheme());
    U.paintInk(document);

    /* Track the system preference while the viewer has no explicit choice. */
    if (global.matchMedia) {
      const mq = global.matchMedia('(prefers-color-scheme: light)');
      const onScheme = () => { if (!store.get('theme')) applyTheme(resolveTheme()); };
      if (mq.addEventListener) mq.addEventListener('change', onScheme);
      else if (mq.addListener) mq.addListener(onScheme);
    }

    /* header + landing wiring */
    $$('[data-action]').forEach(node => {
      const action = node.dataset.action;
      node.addEventListener('click', e => {
        if (node.tagName === 'A') e.preventDefault();
        if (action === 'studio') showStudio(node.dataset.mode);
        else if (action === 'home') showLanding();
        else if (action === 'toggle-studio') document.body.classList.contains('in-studio') ? showLanding() : showStudio();
        else if (action === 'theme') { toggleTheme(); global.PF.sfx.play('click'); }
        else if (action === 'sound') toggleSound();
        else if (action === 'palette') global.PF.palette.open();
        else if (action === 'account') openAccount();
        else if (action === 'upgrade') premium.openWalkthrough();
      });
    });

    /* mode rail */
    $$('.mode-btn').forEach(btn => btn.addEventListener('click', () => {
      global.PF.sfx.play('click');
      setMode(btn.dataset.mode);
    }));

    /* keep header + panels in sync when the plan changes */
    document.addEventListener('pf:plan-changed', () => {
      updateHeaderCta();
      renderPlanCards();
    });

    applySoundIcon();
    initStickyHeader();
    initParallax();
    renderPlanCards();
    updateHeaderCta();

    /* Pre-select the last used mode without leaving the landing page. */
    currentMode = store.pref('app', 'mode') || 'art';

    global.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.body.classList.contains('in-studio') && !$('.modal-back')) {
        /* Escape from the studio only when no modal is open. */
      }
    });
  }

  /* ── pricing cards on the landing page ─────────────────────────────────── */
  function renderPlanCards() {
    const host = $('#plans');
    if (!host) return;
    host.innerHTML = '';
    const current = premium.plan();

    [premium.PLANS.free, premium.PLANS.pro].forEach(plan => {
      const isPro = plan.id === 'pro';
      const active = current === plan.id;

      host.appendChild(el('div', { class: 'plan' + (isPro ? ' plan-pro' : '') }, [
        isPro ? el('div', { class: 'plan-flag', text: 'FREE WHILE IN PREVIEW' }) : null,
        el('div', { class: 'plan-name' }, [
          el('img', { src: 'assets/img/' + (isPro ? 'sprite-banner' : 'sprite-knight') + '.svg', alt: '', class: 'px', style: 'height:20px' }),
          document.createTextNode(plan.name),
          active ? el('span', { class: 'badge badge-green', text: 'CURRENT' }) : null
        ]),
        el('div', { class: 'plan-price' }, [
          el('b', { text: plan.price }),
          el('span', { text: plan.cadence })
        ]),
        el('p', { class: 'plan-note', text: plan.note }),
        el('ul', {}, plan.features.map(f =>
          el('li', {}, [
            el('span', { class: f.on ? 'tick' : 'cross', text: f.on ? '✓' : '✕' }),
            el('span', { html: f.text })
          ]))),
        el('span', { class: 'spacer' }),
        isPro
          ? (active
              ? el('button', { class: 'btn btn-block', type: 'button', text: 'Already unlocked', disabled: true })
              : el('button', { class: 'btn btn-gold btn-block', type: 'button', text: 'Unlock for $0', onclick: () => premium.openWalkthrough() }))
          : el('button', { class: 'btn btn-block', type: 'button', text: active ? 'Your current plan' : 'Switch to free', disabled: active ? true : null,
              onclick: () => { if (!active) { premium.downgrade(); } } })
      ]));
    });

    const note = $('#billing-note');
    if (note) {
      note.innerHTML = 'Payments are not switched on yet. Until they are, Forge Master unlocks for free and no card details are collected anywhere.';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.PF = global.PF || {};
  global.PF.app = { showStudio, showLanding, setMode, openAccount, toggleTheme, toggleSound };
})(typeof window !== 'undefined' ? window : globalThis);
