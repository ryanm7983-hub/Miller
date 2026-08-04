/* ===========================================================================
   PixelForge — Music panel.

   This panel writes *prompts*. It never synthesises, streams, downloads or
   plays audio, and it makes no network calls of any kind. You take the prompt
   it produces and paste it into whichever music tool you prefer.
   =========================================================================== */
(function (global) {
  'use strict';

  const U = global.PF.util;
  const { el, esc, val, setVal, toast, copyToast } = U;
  const store = global.PF.store;
  const premium = global.PF.premium;
  const D = global.PF_DATA;

  let host = null;
  let platformId = 'suno';
  let last = { text: '', title: '', platform: '' };

  /* Platform list, plus a tool-agnostic option. */
  const PLATFORMS = D.MUSIC_PLATFORMS.concat([{
    id: 'generic', name: 'Any tool / plain brief',
    url: '', note: 'A structured, human-readable brief. Good for a composer, a different AI tool, or your own notes.'
  }]);

  const platform = () => PLATFORMS.find(p => p.id === platformId) || PLATFORMS[0];

  const PURPOSES = ['Main theme / title screen', 'Exploration loop', 'Combat / battle', 'Boss fight', 'Ambient background', 'Town / safe zone', 'Cutscene / story beat', 'Victory sting', 'Game over / defeat', 'Menu / pause screen', 'Shop / merchant', 'Puzzle / thinking'];
  const TEMPOS = ['very slow 50-60 BPM', 'slow 60-75 BPM', 'moderate 85-100 BPM', 'upbeat 110-125 BPM', 'fast 130-150 BPM', 'very fast 160-180 BPM', 'ambient — no fixed tempo'];
  const KEYS = ['A minor — melancholy', 'D minor — dark and serious', 'E minor — driving and tense', 'B minor — sorrowful', 'F minor — oppressive', 'C major — bright and open', 'G major — warm and folk', 'D major — triumphant', 'A major — heroic', 'atonal / modal — unsettling'];
  const LENGTHS = ['short loop 30-45 seconds', 'standard loop 60-90 seconds', 'full track 2-3 minutes', 'sting 5-10 seconds', 'extended ambient 4+ minutes'];
  const STRUCTURES = ['seamless single-section loop', 'intro → main loop', 'intro → A section → B section → loop back to A', 'build → drop → sustain → resolve', 'through-composed, no repeats', 'layered stems that can be added and removed dynamically'];
  const MIXES = ['clean modern game mix, wide stereo', 'lo-fi and tape-saturated', 'dry and close, minimal reverb', 'cavernous reverb, distant and huge', 'retro console-authentic, narrow stereo', 'orchestral hall, natural room tone'];

  /* ── prompt assembly ───────────────────────────────────────────────────── */
  function build() {
    const p = platform();
    const purpose = val('mu_purpose');
    const genre = val('mu_genre');
    const mood = val('mu_mood');
    const instr = val('mu_instr');
    const tempo = val('mu_tempo');
    const key = val('mu_key');
    const len = val('mu_len');
    const extra = val('mu_ex');

    const lock = premium.has('themeLock') ? store.get('themeLock') : null;
    const worldNote = lock && lock.world ? ' — set in ' + lock.world : '';
    const atmoNote = lock && lock.atmo ? 'Atmosphere: ' + lock.atmo + '. ' : '';

    /* Pro-only depth */
    const pro = premium.has('musicPro');
    const structure = pro ? val('mu_struct') : '';
    const mix = pro ? val('mu_mix') : '';
    const stems = pro && document.getElementById('mu_stems') && document.getElementById('mu_stems').checked;
    const loopNote = pro && document.getElementById('mu_loop') && document.getElementById('mu_loop').checked;
    const noVocals = document.getElementById('mu_novox') && document.getElementById('mu_novox').checked;

    if (platformId === 'suno' || platformId === 'udio') {
      /* Tag-forward format these tools respond to best. */
      const tags = [genre, mood, tempo.split(' ')[0], key.split(' — ')[0], instr, 'game music']
        .filter(Boolean).join(', ');
      const lines = [tags, '', '[Purpose: ' + purpose + worldNote + ']'];
      if (mood) lines.push('[Mood: ' + mood + ']');
      if (instr) lines.push('[Instruments: ' + instr + ']');
      lines.push('[Tempo: ' + tempo + ']', '[Key: ' + key + ']', '[Length: ' + len + ']');
      if (structure) lines.push('[Structure: ' + structure + ']');
      if (mix) lines.push('[Mix: ' + mix + ']');
      if (atmoNote) lines.push('[' + atmoNote.trim() + ']');
      if (extra) lines.push('[Direction: ' + extra + ']');
      if (loopNote) lines.push('[Loop: must loop seamlessly — final bar flows back into the first with no gap or tail]');
      if (stems) lines.push('[Stems: keep melody, harmony, bass and percussion clearly separable]');
      lines.push('[Game music, cinematic quality' + (noVocals ? ', instrumental only, no vocals' : '') + ']');
      return lines.join('\n');
    }

    if (platformId === 'generic') {
      /* Structured brief for a human or any other tool. */
      const rows = [
        ['Track purpose', purpose + worldNote],
        ['Genre', genre],
        ['Mood', mood || '—'],
        ['Instrumentation', instr || '—'],
        ['Tempo', tempo],
        ['Key / tonality', key],
        ['Length', len]
      ];
      if (structure) rows.push(['Structure', structure]);
      if (mix) rows.push(['Mix character', mix]);
      if (atmoNote) rows.push(['World atmosphere', atmoNote.trim()]);
      if (extra) rows.push(['Extra direction', extra]);
      rows.push(['Vocals', noVocals ? 'Instrumental only — no vocals' : 'Vocals allowed if they suit the piece']);
      if (loopNote) rows.push(['Looping', 'Must loop seamlessly — the final bar flows back into the first with no gap or reverb tail']);
      if (stems) rows.push(['Stems', 'Deliver melody, harmony, bass and percussion as separable layers']);

      const width = Math.max.apply(null, rows.map(r => r[0].length));
      return 'GAME MUSIC BRIEF\n' + '='.repeat(16) + '\n\n' +
        rows.map(r => r[0].padEnd(width) + ' : ' + r[1]).join('\n') +
        '\n\nDeliver a game-ready track that fits the brief above.';
    }

    /* Stable Audio / MusicGen prefer concise descriptive prose. */
    let text = genre + ' game music, ' + purpose.toLowerCase() + ' track' + worldNote + '. ' +
      (mood ? mood + ' mood. ' : '') + atmoNote +
      (instr ? 'Featuring ' + instr + '. ' : '') +
      tempo + '. ' + key + '. ' + len + '. ' +
      (structure ? structure + '. ' : '') +
      (mix ? mix + '. ' : '') +
      (extra ? extra + '. ' : '') +
      (noVocals ? 'Instrumental only, no vocals. ' : '') +
      (loopNote ? 'Seamlessly loopable. ' : '') +
      'Game-ready, high quality.';
    return text.replace(/\s+/g, ' ').trim();
  }

  function generate() {
    if (!premium.consume(1)) return;
    const text = build();
    last = { text, title: val('mu_purpose'), platform: platform().name };
    renderOutput();
    toast('Music prompt ready for ' + platform().name, 'ok');
  }

  /* ── rendering ─────────────────────────────────────────────────────────── */
  function field(id, label, type, options, extra) {
    let control;
    if (type === 'select') {
      control = el('select', { class: 'select', id }, options.map(o => el('option', { value: o, text: o })));
      if (extra && extra.value) control.value = extra.value;
    } else if (type === 'textarea') {
      control = el('textarea', { class: 'textarea', id, rows: 2, placeholder: (extra && extra.placeholder) || '' });
    } else {
      control = el('input', { class: 'input', type: 'text', id, placeholder: (extra && extra.placeholder) || '' });
    }
    const w = el('div', { class: 'field' }, [el('label', { class: 'label', for: id, text: label }), control]);
    if (extra && extra.span === 2) w.style.gridColumn = '1 / -1';
    return w;
  }

  function checkbox(id, label, checked) {
    return el('label', { class: 'chip', style: 'cursor:pointer' }, [
      el('input', { type: 'checkbox', id, checked: checked ? true : null, style: 'margin:0' }),
      el('span', { text: label })
    ]);
  }

  function platformCard() {
    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Target tool' }),
        el('span', { class: 'badge badge-pink', text: 'prompt only' })
      ]),
      el('p', { class: 'card-sub', style: 'margin-bottom:12px', text: 'PixelForge formats the prompt for whichever tool you use. It writes the brief — you generate the audio wherever you like.' }),
      el('div', { class: 'target-grid' }, PLATFORMS.map(p =>
        el('button', {
          type: 'button', class: 'target' + (p.id === platformId ? ' on' : ''),
          onclick: () => { platformId = p.id; store.pref('music', 'platform', p.id); render(); }
        }, [el('b', { text: p.name }), el('span', { text: p.note })])))
    ]);
  }

  function presetCard() {
    const list = el('div', { class: 'preset-list scroll-y' });
    const search = el('input', { class: 'input', type: 'search', placeholder: 'Search music presets…' });

    function paint() {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      let shown = 0;
      Object.keys(D.MUSIC_PRESETS).forEach(group => {
        const items = D.MUSIC_PRESETS[group].filter(x =>
          !q || (x.name + ' ' + x.mood + ' ' + x.genre + ' ' + x.tags).toLowerCase().indexOf(q) > -1);
        if (!items.length) return;
        list.appendChild(el('div', { class: 'preset-group', text: group }));
        items.forEach(x => {
          shown++;
          list.appendChild(el('div', {
            class: 'preset-item', role: 'button', tabindex: '0',
            html: '<b>' + esc(x.name) + '</b> — ' + esc(x.genre) + ' · ' + esc(x.mood),
            onclick: () => apply(x),
            onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply(x); } }
          }));
        });
      });
      if (!shown) list.appendChild(el('div', { class: 'preset-empty', text: 'No presets match “' + search.value + '”' }));
    }

    function apply(x) {
      setVal('mu_genre', x.genre);
      setVal('mu_mood', x.mood);
      setVal('mu_instr', x.instr);
      const tempoSel = document.getElementById('mu_tempo');
      const keySel = document.getElementById('mu_key');
      if (tempoSel) tempoSel.value = nearest(TEMPOS, x.tempo);
      if (keySel) keySel.value = nearest(KEYS, x.key);
      setVal('mu_ex', x.tags ? 'Reference feel: ' + x.tags : '');
      toast('Loaded “' + x.name + '”', 'ok');
    }

    /* Preset tempo/key strings are free-form; snap them onto our option list. */
    function nearest(options, value) {
      const v = String(value || '').toLowerCase();
      const num = (v.match(/(\d{2,3})/) || [])[1];
      let best = options[0], bestScore = -1;
      options.forEach(o => {
        const lo = o.toLowerCase();
        let score = 0;
        lo.split(/[^a-z]+/).forEach(w => { if (w.length > 3 && v.indexOf(w) > -1) score += 2; });
        if (num) {
          const range = lo.match(/(\d{2,3})-?(\d{2,3})?/);
          if (range) {
            const a = +range[1], b = range[2] ? +range[2] : a;
            if (+num >= a - 8 && +num <= b + 8) score += 3;
          }
        }
        if (score > bestScore) { bestScore = score; best = o; }
      });
      return best;
    }

    search.addEventListener('input', U.debounce(paint, 120));
    paint();

    const total = Object.keys(D.MUSIC_PRESETS).reduce((n, g) => n + D.MUSIC_PRESETS[g].length, 0);
    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Presets' }),
        el('span', { class: 'badge badge-pink', text: total + ' styles' })
      ]),
      el('div', { class: 'preset-box' }, [el('div', { class: 'preset-search' }, search), list])
    ]);
  }

  function proCard() {
    const card = el('div', { class: 'card' });
    card.appendChild(el('div', {}, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Studio depth' }),
        el('span', { class: 'badge badge-pro', text: 'PRO' })
      ]),
      el('p', { class: 'card-sub', style: 'margin-bottom:12px', text: 'Adds song structure, mix character, stem separation and seamless-loop instructions to the prompt.' }),
      el('div', { class: 'grid-2' }, [
        field('mu_struct', 'Structure', 'select', STRUCTURES),
        field('mu_mix', 'Mix character', 'select', MIXES)
      ]),
      el('div', { class: 'chip-row', style: 'margin-top:12px' }, [
        checkbox('mu_loop', 'Seamless loop', true),
        checkbox('mu_stems', 'Separable stems', false)
      ])
    ]));
    premium.gate(card, 'musicPro');
    return card;
  }

  function outputCard() {
    const empty = !last.text;
    const block = el('div', { class: 'out-block' + (empty ? ' empty' : ''), text: empty ? 'Set the brief and hit Generate — your music prompt appears here, ready to paste.' : last.text });

    const p = platform();
    return el('div', { class: 'card out-card', style: 'border-top-color:var(--pink)' }, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Music prompt' }),
        last.platform ? el('span', { class: 'badge badge-pink', text: last.platform }) : null
      ]),
      block,
      el('div', { class: 'out-actions' }, [
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Copy prompt', onclick: () => last.text ? copyToast(last.text, 'Music prompt copied') : toast('Generate a prompt first', 'warn') }),
        el('button', { class: 'btn btn-sm', type: 'button', text: 'Save to library', onclick: save }),
        el('button', { class: 'btn btn-sm', type: 'button', text: 'Download .txt', onclick: () => {
          if (!last.text) { toast('Generate a prompt first', 'warn'); return; }
          U.download('pixelforge-music.txt', last.text); toast('Downloaded', 'ok');
        } })
      ]),
      p.url ? el('div', { class: 'note-strip', style: 'margin-top:12px', html: 'Paste it into <b>' + esc(p.name) + '</b> — ' + esc(p.note) + '<br><span class="tiny muted">' + esc(p.url) + '</span>' }) : null
    ]);
  }

  function save() {
    if (!last.text) { toast('Generate a prompt first', 'warn'); return; }
    if (!premium.canSaveMore()) { premium.showPaywall('library'); return; }
    store.addToLibrary({ kind: 'music', title: last.title || 'Music prompt', text: last.text, meta: last.platform });
    toast('Saved to library', 'ok');
  }

  function renderOutput() {
    const pane = document.getElementById('music-output');
    if (!pane) return;
    pane.innerHTML = '';
    pane.appendChild(outputCard());
  }

  function render() {
    if (!host) return;
    const keep = {};
    U.$$('#music-form input, #music-form select, #music-form textarea', host).forEach(n => {
      if (n.id) keep[n.id] = n.type === 'checkbox' ? n.checked : n.value;
    });

    host.innerHTML = '';

    const quotaHost = el('div', { style: 'margin-bottom:16px' });
    premium.renderQuota(quotaHost);
    host.appendChild(quotaHost);

    const form = el('div', { class: 'stack', id: 'music-form' }, [
      platformCard(),
      el('div', { class: 'card' }, [
        el('div', { class: 'card-head' }, [
          el('img', { src: 'assets/img/sprite-banner.svg', alt: '', class: 'px', style: 'height:26px' }),
          el('span', { class: 'card-title', text: 'The brief' })
        ]),
        el('div', { class: 'grid-2' }, [
          field('mu_purpose', 'Purpose', 'select', PURPOSES),
          field('mu_genre', 'Genre', 'text', null, { placeholder: 'e.g. orchestral fantasy, chiptune, synthwave' }),
          field('mu_mood', 'Mood', 'text', null, { placeholder: 'e.g. ominous, brooding, ancient evil' }),
          field('mu_instr', 'Instruments', 'text', null, { placeholder: 'e.g. pipe organ, cello section, distant bells' }),
          field('mu_tempo', 'Tempo', 'select', TEMPOS, { value: TEMPOS[2] }),
          field('mu_key', 'Key / tonality', 'select', KEYS),
          field('mu_len', 'Length', 'select', LENGTHS, { value: LENGTHS[1] }),
          field('mu_ex', 'Extra direction', 'textarea', null, { placeholder: 'anything else the track must do', span: 2 })
        ]),
        el('div', { class: 'chip-row', style: 'margin-top:12px' }, [checkbox('mu_novox', 'Instrumental only', true)])
      ]),
      presetCard(),
      proCard(),
      el('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', text: 'Generate music prompt', onclick: generate })
    ]);

    host.appendChild(el('div', { class: 'split' }, [
      form,
      el('div', { class: 'pane-out', id: 'music-output' }, outputCard())
    ]));

    Object.keys(keep).forEach(id => {
      const n = document.getElementById(id);
      if (!n) return;
      if (n.type === 'checkbox') n.checked = keep[id];
      else if (keep[id] !== '') n.value = keep[id];
    });
  }

  function mount(node) {
    host = node;
    platformId = store.pref('music', 'platform') || 'suno';
    if (!PLATFORMS.some(p => p.id === platformId)) platformId = 'suno';
    render();
  }

  document.addEventListener('pf:plan-changed', () => { if (host && host.offsetParent !== null) render(); });

  global.PF = global.PF || {};
  global.PF.music = { mount, render };
})(typeof window !== 'undefined' ? window : globalThis);
