/* ===========================================================================
   PixelForge — Library panel: everything you saved, stored locally.
   =========================================================================== */
(function (global) {
  'use strict';

  const U = global.PF.util;
  const { el, toast, copyToast, confirmDialog } = U;
  const store = global.PF.store;
  const premium = global.PF.premium;

  let host = null;
  let filter = 'all';
  let query = '';

  const KINDS = [
    { id: 'all', name: 'Everything' },
    { id: 'art', name: 'Art' },
    { id: 'music', name: 'Music' },
    { id: 'code', name: 'Code' }
  ];

  const ICON = { art: 'sprite-knight', music: 'sprite-banner', code: 'sprite-crystal' };
  const BADGE = { art: '', music: 'badge-pink', code: 'badge-green' };

  function items() {
    const q = query.trim().toLowerCase();
    return store.get('library').filter(x => {
      if (filter !== 'all' && x.kind !== filter) return false;
      if (!q) return true;
      return ((x.title || '') + ' ' + (x.text || '')).toLowerCase().indexOf(q) > -1;
    });
  }

  function exportAll() {
    const all = store.get('library');
    if (!all.length) { toast('Library is empty', 'warn'); return; }
    if (!premium.has('batchExport')) { premium.showPaywall('feature', 'batchExport'); return; }
    const body = all.map(x =>
      '=== ' + (x.title || 'Untitled') + ' [' + x.kind + '] · ' + U.fmtDate(x.createdAt) + ' ===\n\n' +
      x.text + (x.negative ? '\n\nNEGATIVE:\n' + x.negative : '')
    ).join('\n\n' + '-'.repeat(70) + '\n\n');
    U.download('pixelforge-library.txt', body);
    toast('Exported ' + all.length + ' prompts', 'ok');
  }

  function render() {
    if (!host) return;
    host.innerHTML = '';

    const all = store.get('library');
    const shown = items();
    const cap = premium.libraryCap();

    /* toolbar */
    const search = el('input', {
      class: 'input', type: 'search', value: query, placeholder: 'Search your prompts…',
      style: 'max-width:280px',
      oninput: U.debounce(e => { query = e.target.value; paintGrid(); }, 150)
    });

    host.appendChild(el('div', { class: 'card', style: 'margin-bottom:18px' }, [
      el('div', { class: 'row' }, [
        el('div', { class: 'chip-row' }, KINDS.map(k =>
          el('button', {
            type: 'button', class: 'chip' + (k.id === filter ? ' on' : ''),
            text: k.name + (k.id === 'all' ? ' (' + all.length + ')' : ''),
            onclick: () => { filter = k.id; render(); }
          }))),
        el('span', { class: 'spacer' }),
        search,
        el('button', { class: 'btn btn-sm', type: 'button', text: 'Export all', onclick: exportAll }),
        el('button', {
          class: 'btn btn-sm btn-ghost', type: 'button', text: 'Clear library',
          onclick: () => {
            if (!all.length) { toast('Library is already empty', 'warn'); return; }
            confirmDialog('Clear your library?', 'This permanently deletes all ' + all.length + ' saved prompts on this device. It cannot be undone.', 'Delete everything')
              .then(ok => { if (ok) { store.clearLibrary(); render(); toast('Library cleared', 'warn'); } });
          }
        })
      ]),
      cap !== Infinity ? el('div', { class: 'note-strip', style: 'margin-top:12px', html:
        'Apprentice plan stores your last <b>' + cap + '</b> prompts — <b>' + all.length + '</b> used. Forge Master stores an unlimited library.' }) : null
    ]));

    const grid = el('div', { class: 'lib-grid', id: 'lib-grid' });
    host.appendChild(grid);
    paintGrid();

    function paintGrid() {
      const list = items();
      const g = document.getElementById('lib-grid');
      if (!g) return;
      g.innerHTML = '';

      if (!list.length) {
        g.style.display = 'block';
        g.appendChild(el('div', { class: 'empty-state' }, [
          el('img', { src: 'assets/img/sprite-chest.svg', alt: '', class: 'px' }),
          el('h3', { text: all.length ? 'Nothing matches that' : 'Your library is empty' }),
          el('p', { text: all.length
            ? 'Try a different search or filter.'
            : 'Generate a prompt in any builder and hit “Save to library” — it is stored on this device and stays available offline.' })
        ]));
        return;
      }
      g.style.display = '';

      list.forEach(item => {
        g.appendChild(el('div', { class: 'lib-item' }, [
          el('div', { class: 'lib-head' }, [
            el('img', { src: 'assets/img/' + (ICON[item.kind] || 'sprite-coin') + '.svg', alt: '', class: 'px', style: 'height:20px' }),
            el('span', { class: 'lib-title', title: item.title, text: item.title || 'Untitled' }),
            el('span', { class: 'spacer' }),
            el('span', { class: 'badge ' + (BADGE[item.kind] || ''), text: item.kind })
          ]),
          el('div', { class: 'lib-body scroll-y', text: item.text }),
          el('div', { class: 'lib-foot' }, [
            el('button', { class: 'btn btn-sm', type: 'button', text: 'Copy', onclick: () => copyToast(item.text, 'Copied') }),
            item.negative ? el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Copy negative', onclick: () => copyToast(item.negative, 'Negative copied') }) : null,
            el('span', { class: 'spacer' }),
            el('span', { class: 'lib-meta', text: U.fmtDate(item.createdAt) }),
            el('button', {
              class: 'btn btn-sm btn-ghost', type: 'button', text: '✕', 'aria-label': 'Delete',
              onclick: () => { store.removeFromLibrary(item.id); render(); toast('Deleted', 'warn'); }
            })
          ])
        ]));
      });
    }
  }

  function mount(node) { host = node; render(); }

  document.addEventListener('pf:plan-changed', () => { if (host && host.offsetParent !== null) render(); });

  global.PF = global.PF || {};
  global.PF.library = { mount, render };
})(typeof window !== 'undefined' ? window : globalThis);
