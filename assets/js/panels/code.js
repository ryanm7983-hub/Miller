/* ===========================================================================
   PixelForge — Code panel.

   This panel writes *prompts* that ask an AI to produce game code. It does not
   generate, run, evaluate or ship code itself, and it makes no network calls.
   Copy the prompt into whichever coding assistant you use.
   =========================================================================== */
(function (global) {
  'use strict';

  const U = global.PF.util;
  const { el, esc, val, toast, copyToast } = U;
  const store = global.PF.store;
  const premium = global.PF.premium;
  const C = global.PF.codeData;

  let host = null;
  let engineId = 'unity';
  let gameTypeId = 'metroidvania';
  let systemIds = ['player-controller'];
  let last = { text: '', title: '' };

  const engine = () => C.ENGINES.find(e => e.id === engineId) || C.ENGINES[0];
  const gameType = () => C.GAME_TYPES.find(g => g.id === gameTypeId) || C.GAME_TYPES[0];

  function allSystems() {
    const out = [];
    Object.keys(C.SYSTEMS).forEach(cat => C.SYSTEMS[cat].forEach(s => out.push(Object.assign({ cat }, s))));
    return out;
  }

  const chosenSystems = () => allSystems().filter(s => systemIds.indexOf(s.id) > -1);

  /* ── prompt assembly ───────────────────────────────────────────────────── */
  function build() {
    const eng = engine();
    const gt = gameType();
    const systems = chosenSystems();
    const complexity = C.COMPLEXITY.find(c => c.id === val('cd_complexity')) || C.COMPLEXITY[1];
    const audience = val('cd_audience');
    const context = val('cd_context');
    const constraints = val('cd_constraints');
    const pro = premium.has('codePro');

    const L = [];

    L.push('# Task');
    L.push('Write ' + eng.lang + ' code for ' + eng.name + ' implementing the following for a ' + gt.name.toLowerCase() + '.');
    L.push('');

    L.push('# What to build');
    if (systems.length) {
      systems.forEach(s => L.push('- **' + s.name + '** — ' + s.detail));
    } else {
      L.push('- (no system selected — describe what you need in the context section below)');
    }
    L.push('');

    if (context) {
      L.push('# Project context');
      L.push(context);
      L.push('');
    }

    L.push('# Target');
    L.push('- Engine: ' + eng.name + ' (' + eng.lang + ')');
    L.push('- ' + eng.note);
    L.push('- Genre: ' + gt.name + ' — ' + gt.note);
    L.push('- Depth: ' + complexity.name + ' — ' + complexity.note);
    L.push('');

    L.push('# Conventions');
    L.push(eng.conventions);
    L.push('');

    if (constraints) {
      L.push('# Constraints');
      L.push(constraints);
      L.push('');
    }

    L.push('# Requirements');
    L.push('- Give me complete, runnable code — no `// TODO` stubs and no omitted method bodies.');
    L.push('- Expose the tuning values (speeds, timings, forces) as inspector-editable fields with sensible defaults already dialled in to feel good.');
    L.push('- Comment the *why* behind non-obvious choices, not the *what*.');
    L.push('- Say explicitly where each file goes and what it attaches to.');

    if (pro) {
      L.push('');
      L.push('# Architecture');
      L.push('- Keep each class to a single responsibility; if a system needs to talk to another, do it through events or an interface rather than a direct reference.');
      L.push('- No singletons unless there is genuinely one instance for the lifetime of the game, and say why if you use one.');
      L.push('- Avoid per-frame allocation on hot paths — no LINQ, string concatenation or new collections inside update loops.');
      L.push('- Make the code testable: keep pure logic separate from engine lifecycle callbacks.');
      L.push('');
      L.push('# Edge cases to handle');
      L.push('- What happens when the object is disabled or destroyed mid-action.');
      L.push('- Simultaneous or conflicting inputs, and inputs arriving during a transition.');
      L.push('- Very low and very high frame rates — the behaviour must not change with frame time.');
      L.push('- Values at their limits: zero health, empty inventory, null references from the scene not being wired up.');
      L.push('');
      L.push('# Testing');
      L.push('- List the manual test steps that prove each system works, with the expected result for each.');
      L.push('- Where logic is pure, include unit tests for it.');
      L.push('');
      L.push('# Final pass');
      L.push('- After writing the code, re-read it and call out anything you would change, any assumption you had to make, and anything that will not scale.');
    }

    L.push('');
    L.push('# Output format');
    L.push('- One clearly labelled code block per file, with the file path as the heading.');
    L.push('- After the code, a short setup checklist: what to create in the scene, what to assign, what to press to test it.');
    if (audience) {
      L.push('- Audience: ' + audience + '.');
    }

    return L.join('\n');
  }

  function generate() {
    if (!systemIds.length) { toast('Pick at least one system to build', 'warn'); return; }
    if (!premium.consume(1)) return;
    const text = build();
    const systems = chosenSystems();
    last = {
      text,
      title: engine().name + ' · ' + (systems.length === 1 ? systems[0].name : systems.length + ' systems')
    };
    renderOutput();
    toast('Code prompt ready', 'ok');
  }

  /* ── rendering ─────────────────────────────────────────────────────────── */
  function engineCard() {
    const eng = engine();
    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Engine' }),
        el('span', { class: 'badge badge-green', text: eng.lang })
      ]),
      el('div', { class: 'engine-row' }, C.ENGINES.map(e =>
        el('button', {
          type: 'button', class: 'engine' + (e.id === engineId ? ' on' : ''),
          dataset: { engine: e.id }, text: e.name,
          onclick: () => { engineId = e.id; store.pref('code', 'engine', e.id); render(); }
        }))),
      el('div', { class: 'note-strip', style: 'margin-top:12px', text: eng.note })
    ]);
  }

  function gameTypeCard() {
    const gt = gameType();
    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, el('span', { class: 'card-title', text: 'Genre' })),
      el('div', { class: 'chip-row' }, C.GAME_TYPES.map(g =>
        el('button', {
          type: 'button', class: 'chip' + (g.id === gameTypeId ? ' on' : ''), text: g.name,
          onclick: () => { gameTypeId = g.id; store.pref('code', 'gameType', g.id); render(); }
        }))),
      el('div', { class: 'note-strip', style: 'margin-top:12px', text: gt.note })
    ]);
  }

  function systemsCard() {
    const list = el('div', { class: 'preset-list scroll-y', style: 'max-height:330px' });
    const search = el('input', { class: 'input', type: 'search', placeholder: 'Search systems…' });

    function paint() {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      let shown = 0;
      Object.keys(C.SYSTEMS).forEach(cat => {
        const items = C.SYSTEMS[cat].filter(s => !q || (s.name + ' ' + s.detail).toLowerCase().indexOf(q) > -1);
        if (!items.length) return;
        list.appendChild(el('div', { class: 'preset-group', text: cat }));
        items.forEach(s => {
          shown++;
          const on = systemIds.indexOf(s.id) > -1;
          list.appendChild(el('div', {
            class: 'preset-item', role: 'button', tabindex: '0',
            style: on ? 'background:var(--violet-dim);color:var(--tx)' : '',
            html: (on ? '✓ ' : '') + '<b>' + esc(s.name) + '</b> — ' + esc(s.detail),
            onclick: () => toggle(s.id),
            onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(s.id); } }
          }));
        });
      });
      if (!shown) list.appendChild(el('div', { class: 'preset-empty', text: 'No systems match “' + search.value + '”' }));
    }

    function toggle(id) {
      const i = systemIds.indexOf(id);
      if (i > -1) systemIds.splice(i, 1); else systemIds.push(id);
      store.pref('code', 'systems', systemIds.slice());
      paint();
      const count = document.getElementById('cd-sys-count');
      if (count) count.textContent = systemIds.length + ' selected';
    }

    search.addEventListener('input', U.debounce(paint, 120));
    paint();

    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Systems to build' }),
        el('span', { class: 'badge badge-green', id: 'cd-sys-count', text: systemIds.length + ' selected' }),
        el('span', { class: 'spacer' }),
        el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Clear', onclick: () => { systemIds = []; store.pref('code', 'systems', []); render(); } })
      ]),
      el('p', { class: 'card-sub', style: 'margin-bottom:12px', text: 'Pick one for a focused prompt, or several to ask for a whole feature slice at once.' }),
      el('div', { class: 'preset-box' }, [el('div', { class: 'preset-search' }, search), list])
    ]);
  }

  function briefCard() {
    const complexity = el('select', { class: 'select', id: 'cd_complexity' },
      C.COMPLEXITY.map(c => el('option', { value: c.id, text: c.name + ' — ' + c.note })));
    complexity.value = 'production';

    const audience = el('select', { class: 'select', id: 'cd_audience' },
      C.AUDIENCES.map(a => el('option', { value: a, text: a })));
    audience.value = C.AUDIENCES[1];

    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('img', { src: 'assets/img/sprite-crystal.svg', alt: '', class: 'px', style: 'height:24px' }),
        el('span', { class: 'card-title', text: 'The brief' })
      ]),
      el('div', { class: 'grid-2' }, [
        el('div', { class: 'field' }, [el('label', { class: 'label', for: 'cd_complexity', text: 'Depth' }), complexity]),
        el('div', { class: 'field' }, [el('label', { class: 'label', for: 'cd_audience', text: 'Explain for' }), audience]),
        el('div', { class: 'field', style: 'grid-column:1/-1' }, [
          el('label', { class: 'label', for: 'cd_context', text: 'Project context' }),
          el('textarea', { class: 'textarea', id: 'cd_context', rows: 3, placeholder: 'e.g. I already have a PlayerController with move and jump. This needs to slot into it without rewriting movement.' })
        ]),
        el('div', { class: 'field', style: 'grid-column:1/-1' }, [
          el('label', { class: 'label', for: 'cd_constraints', text: 'Constraints' }),
          el('textarea', { class: 'textarea', id: 'cd_constraints', rows: 2, placeholder: 'e.g. no third-party packages; must run on mobile; keep it under 200 lines.' })
        ])
      ])
    ]);
  }

  function proCard() {
    const card = el('div', { class: 'card' });
    card.appendChild(el('div', {}, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Studio depth' }),
        el('span', { class: 'badge badge-pro', text: 'PRO' })
      ]),
      el('p', { class: 'card-sub', text: 'Appends four extra sections to every prompt — architecture rules, an edge-case checklist, testing requirements and a self-review pass. This is the difference between code that runs and code that survives contact with a real project.' }),
      el('ul', { class: 'wt-list', style: 'margin-top:12px' }, [
        el('li', {}, [el('span', { class: 'tick', text: '✦' }), el('span', { html: '<b>Architecture</b> — single responsibility, event-based decoupling, no hot-path allocation' })]),
        el('li', {}, [el('span', { class: 'tick', text: '✦' }), el('span', { html: '<b>Edge cases</b> — destruction mid-action, conflicting input, frame-rate independence, limit values' })]),
        el('li', {}, [el('span', { class: 'tick', text: '✦' }), el('span', { html: '<b>Testing</b> — manual test steps with expected results, unit tests for pure logic' })]),
        el('li', {}, [el('span', { class: 'tick', text: '✦' }), el('span', { html: '<b>Review pass</b> — the model critiques its own output and surfaces its assumptions' })])
      ])
    ]));
    premium.gate(card, 'codePro');
    return card;
  }

  function outputCard() {
    const empty = !last.text;
    return el('div', { class: 'card out-card', style: 'border-top-color:var(--green)' }, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Code prompt' }),
        last.title ? el('span', { class: 'badge badge-green', text: last.title }) : null
      ]),
      el('div', { class: 'out-block' + (empty ? ' empty' : ''), style: 'max-height:520px', text: empty ? 'Choose an engine, a genre and the systems you need, then hit Generate — a complete, structured prompt appears here.' : last.text }),
      el('div', { class: 'out-actions' }, [
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Copy prompt', onclick: () => last.text ? copyToast(last.text, 'Code prompt copied') : toast('Generate a prompt first', 'warn') }),
        el('button', { class: 'btn btn-sm', type: 'button', text: 'Save to library', onclick: save }),
        el('button', { class: 'btn btn-sm', type: 'button', text: 'Download .md', onclick: () => {
          if (!last.text) { toast('Generate a prompt first', 'warn'); return; }
          U.download('pixelforge-code-prompt.md', last.text, 'text/markdown;charset=utf-8');
          toast('Downloaded', 'ok');
        } })
      ]),
      el('div', { class: 'note-strip', style: 'margin-top:12px', html: 'Paste this into any coding assistant. PixelForge writes the brief — it does not write or run the code itself.' })
    ]);
  }

  function save() {
    if (!last.text) { toast('Generate a prompt first', 'warn'); return; }
    if (!premium.canSaveMore()) { premium.showPaywall('library'); return; }
    store.addToLibrary({ kind: 'code', title: last.title || 'Code prompt', text: last.text, meta: engine().name });
    toast('Saved to library', 'ok');
  }

  function renderOutput() {
    const pane = document.getElementById('code-output');
    if (!pane) return;
    pane.innerHTML = '';
    pane.appendChild(outputCard());
  }

  function render() {
    if (!host) return;
    const keep = {};
    U.$$('#code-form input, #code-form select, #code-form textarea', host).forEach(n => { if (n.id) keep[n.id] = n.value; });

    host.innerHTML = '';

    const quotaHost = el('div', { style: 'margin-bottom:16px' });
    premium.renderQuota(quotaHost);
    host.appendChild(quotaHost);

    const form = el('div', { class: 'stack', id: 'code-form' }, [
      engineCard(), gameTypeCard(), systemsCard(), briefCard(), proCard(),
      el('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', text: 'Generate code prompt', onclick: generate })
    ]);

    host.appendChild(el('div', { class: 'split' }, [
      form,
      el('div', { class: 'pane-out', id: 'code-output' }, outputCard())
    ]));

    Object.keys(keep).forEach(id => {
      const n = document.getElementById(id);
      if (n && keep[id] !== undefined && keep[id] !== '') n.value = keep[id];
    });
  }

  function mount(node) {
    host = node;
    engineId = store.pref('code', 'engine') || 'unity';
    gameTypeId = store.pref('code', 'gameType') || 'metroidvania';
    const saved = store.pref('code', 'systems');
    if (Array.isArray(saved) && saved.length) systemIds = saved.slice();
    render();
  }

  document.addEventListener('pf:plan-changed', () => { if (host && host.offsetParent !== null) render(); });

  global.PF = global.PF || {};
  global.PF.code = { mount, render };
})(typeof window !== 'undefined' ? window : globalThis);
