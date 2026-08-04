/* ===========================================================================
   PixelForge — command palette (Ctrl/Cmd+K).

   Indexes every mode, builder tab, action and preset in one searchable list,
   so nothing in the studio is more than a few keystrokes away.
   =========================================================================== */
(function (global) {
  'use strict';

  const U = global.PF.util;
  const { el, esc } = U;
  const D = global.PF_DATA;
  const F = global.PF.fields;

  let closeFn = null;

  /* ── index ─────────────────────────────────────────────────────────────── */

  /* Built lazily on first open — the preset lists are large and most sessions
     never need them indexed. */
  let index = null;

  function build() {
    const items = [];
    const app = global.PF.app;

    const push = (kind, label, hint, run) => items.push({ kind, label, hint, run, hay: (label + ' ' + hint).toLowerCase() });

    /* modes */
    [['art', 'Art Assets'], ['music', 'Music'], ['code', 'Code'], ['library', 'Library']].forEach(([id, name]) => {
      push('Go to', name, 'studio mode', () => { app.showStudio(id); });
    });

    /* art builder tabs */
    F.TABS.forEach(tab => {
      push('Builder', tab.name, 'art asset builder', () => {
        app.showStudio('art');
        global.PF.art.setTab(tab.id);
      });
    });

    /* actions */
    push('Action', 'Toggle theme', 'light / dark', () => app.toggleTheme());
    push('Action', 'Toggle sound', 'chiptune effects', () => global.PF.sfx.setEnabled(!global.PF.sfx.enabled()));
    push('Action', 'Your account', 'plan, backup, reset', () => app.openAccount());
    push('Action', 'Upgrade to Forge Master', 'unlock every builder', () => global.PF.premium.openWalkthrough());
    push('Action', 'Back to home page', 'landing', () => app.showLanding());
    push('Action', 'Roll random asset', 'randomise the whole builder', () => {
      app.showStudio('art');
      global.PF.art.roll();
    });

    /* art presets — the bulk of the index */
    F.TABS.forEach(tab => {
      if (!tab.presetKey) return;
      const raw = D[tab.presetKey];
      const groups = Array.isArray(raw) ? { '': raw } : raw;
      Object.keys(groups).forEach(group => {
        groups[group].forEach(text => {
          const dash = text.indexOf(' — ');
          const name = dash > -1 ? text.slice(0, dash) : text.slice(0, 60);
          push(tab.name, name, group || 'preset', () => {
            app.showStudio('art');
            global.PF.art.setTab(tab.id);
            global.PF.art.applyPreset(text);
          });
        });
      });
    });

    /* music presets */
    Object.keys(D.MUSIC_PRESETS).forEach(group => {
      D.MUSIC_PRESETS[group].forEach(preset => {
        push('Music', preset.name, group, () => {
          app.showStudio('music');
          global.PF.music.applyPreset(preset);
        });
      });
    });

    return items;
  }

  /* ── matching ──────────────────────────────────────────────────────────── */

  /* Subsequence match, then rank: earlier and more contiguous hits win. */
  function score(item, query) {
    const hay = item.hay;
    if (!query) return 0;
    if (hay.indexOf(query) > -1) return 1000 - hay.indexOf(query);

    let qi = 0, last = -1, gaps = 0;
    for (let i = 0; i < hay.length && qi < query.length; i++) {
      if (hay[i] === query[qi]) {
        if (last > -1) gaps += i - last - 1;
        last = i;
        qi++;
      }
    }
    return qi === query.length ? 400 - gaps : -1;
  }

  function search(query) {
    if (!index) index = build();
    const q = query.trim().toLowerCase();
    if (!q) {
      return index.filter(i => i.kind === 'Go to' || i.kind === 'Action' || i.kind === 'Builder').slice(0, 24);
    }
    const hits = [];
    for (let i = 0; i < index.length; i++) {
      const s = score(index[i], q);
      if (s >= 0) hits.push({ item: index[i], s });
    }
    hits.sort((a, b) => b.s - a.s);
    return hits.slice(0, 40).map(h => h.item);
  }

  /* ── ui ────────────────────────────────────────────────────────────────── */
  function open() {
    if (closeFn) return;

    let results = [];
    let active = 0;

    const input = el('input', {
      class: 'cp-input', type: 'text', placeholder: 'Search builders, presets and actions…',
      'aria-label': 'Command palette', autocomplete: 'off', spellcheck: 'false'
    });
    const list = el('div', { class: 'cp-list scroll-y', role: 'listbox' });

    function paint() {
      results = search(input.value);
      active = 0;
      list.innerHTML = '';
      if (!results.length) {
        list.appendChild(el('div', { class: 'preset-empty', text: 'Nothing matches “' + input.value + '”' }));
        return;
      }
      results.forEach((item, i) => {
        list.appendChild(el('div', {
          class: 'cp-item' + (i === 0 ? ' on' : ''), role: 'option', dataset: { i: String(i) },
          html: '<span class="cp-kind">' + esc(item.kind) + '</span>' +
                '<span class="cp-label">' + esc(item.label) + '</span>' +
                '<span class="cp-hint">' + esc(item.hint) + '</span>',
          onclick: () => choose(i)
        }));
      });
    }

    function move(delta) {
      if (!results.length) return;
      const nodes = list.querySelectorAll('.cp-item');
      if (nodes[active]) nodes[active].classList.remove('on');
      active = (active + delta + results.length) % results.length;
      const next = nodes[active];
      if (next) { next.classList.add('on'); next.scrollIntoView({ block: 'nearest' }); }
    }

    function choose(i) {
      const item = results[i == null ? active : i];
      if (!item) return;
      close();
      global.PF.sfx.play('click');
      try { item.run(); } catch (e) { console.error(e); U.toast('Could not run that', 'err'); }
    }

    input.addEventListener('input', U.debounce(paint, 90));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(); }
    });

    const pane = el('div', { class: 'cp' }, [
      el('div', { class: 'cp-head' }, [input]),
      list,
      el('div', { class: 'cp-foot' }, [
        el('span', { html: '<kbd>↑</kbd><kbd>↓</kbd> navigate' }),
        el('span', { html: '<kbd>enter</kbd> select' }),
        el('span', { html: '<kbd>esc</kbd> close' }),
        el('span', { class: 'spacer' }),
        el('span', { text: 'PixelForge' })
      ])
    ]);

    paint();
    global.PF.sfx.play('open');
    const close = U.modal(pane, {
      label: 'Command palette',
      onClose: () => { closeFn = null; }
    });
    closeFn = close;
    setTimeout(() => input.focus(), 20);
  }

  function toggle() { closeFn ? closeFn() : open(); }

  /** Discard the cached index — call when the underlying data changes. */
  function invalidate() { index = null; }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      toggle();
    }
  });

  global.PF = global.PF || {};
  global.PF.palette = { open, toggle, invalidate };
})(typeof window !== 'undefined' ? window : globalThis);
