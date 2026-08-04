/* ===========================================================================
   PixelForge — Art Assets panel.

   Renders the tab rail, style-mode controls, theme lock, per-tab form and the
   prompt output. Prompt assembly mirrors the original generator so existing
   prompts keep working; the UI around it is rebuilt.
   =========================================================================== */
(function (global) {
  'use strict';

  const U = global.PF.util;
  const { el, esc, val, setVal, toast, copyToast } = U;
  const store = global.PF.store;
  const premium = global.PF.premium;
  const D = global.PF_DATA;
  const F = global.PF.fields;
  const sfx = () => global.PF.sfx;

  /* ── panel state ───────────────────────────────────────────────────────── */
  let host = null;
  let tabId = 'char';
  let styleMode = 'pixel';
  let perspId = 'iso';
  let poseId = '';
  let animId = '';
  let negSet = new Set(['sitting', 'seated', 'chair', 'ground surface', 'floor', 'dirt patch', 'background scenery', 'cast shadow on ground', 'drop shadow', 'contact shadow', 'shadow beneath sprite', 'ground shadow', 'ambient occlusion', 'blurry', '3D render', 'photorealistic', 'watermark', 'extra limbs', 'deformed anatomy', 'bad proportions']);
  let imageRef = { loaded: false, name: '', desc: '' };
  let last = { pos: '', neg: '', title: '', batch: null };

  const tabById = id => F.TABS.find(t => t.id === id) || F.TABS[0];

  function perspective() {
    const p = F.PERSPECTIVES.find(x => x.id === perspId) || F.PERSPECTIVES[0];
    return {
      id: p.id,
      desc: p.id === 'flat' ? D.F2DS : (p.desc || D.ISO),
      neg: p.id === 'flat' ? D.NEG_FLAT : (p.neg || ''),
      note: p.note
    };
  }

  /* ── style-mode string (mirrors the original buildMode) ────────────────── */
  function buildMode() {
    if (styleMode === 'pixel') {
      return [val('g_era') + ' pixel art', val('g_sz') + ' sprite', val('g_sh'), val('g_ol'),
        'strictly NO anti-aliasing', 'hard pixel edges only', 'pixel-perfect rendering'].join(', ');
    }
    if (styleMode === 'hand') {
      return 'hand-drawn illustration, variable-weight ink outlines, cell-shaded clean shadow shapes, full color hand-painted feel, NOT pixel art, NOT 3D, traditional hand-crafted illustration';
    }
    if (styleMode === 'paint') {
      return ['painterly illustration', val('pt_m'), val('pt_d'), val('pt_l'), 'visible brushwork', 'NOT pixel art, NOT 3D'].join(', ');
    }
    if (styleMode === 'ink') {
      const extra = val('sk_ex') ? ', additional detail: ' + val('sk_ex') : '';
      return [
        'scratchy nightmare ink illustration in the style of Stephen Gammell and Scary Stories to Tell in the Dark',
        val('sk_tx'), val('sk_tn'), val('sk_hi'), val('sk_dl'),
        'deeply unsettling wrong anatomy, nightmare logic proportions, nothing looks quite right',
        'visceral body horror ink art, organic wrongness in every line',
        'NOT pixel art, NOT 3D render, NOT clean illustration, NOT cute',
        'traditional ink on paper feel, aged paper texture implied' + extra
      ].filter(Boolean).join(', ');
    }
    if (styleMode === 'voxel') {
      return [
        'voxel art', val('vx_ref'), val('vx_sz'), val('vx_rs'), val('vx_va'), val('vx_cp'),
        'all geometry composed of visible colored cubes',
        'no smooth surfaces — every form blocky and cube-based',
        'NOT pixel art, NOT 2D sprite, NOT smooth 3D render',
        'game-ready voxel model on transparent background'
      ].filter(Boolean).join(', ');
    }
    return [val('vc_s'), val('vc_o'), val('vc_c'), 'clean digital art', 'NOT pixel art'].filter(Boolean).join(', ');
  }

  /* ── theme lock ────────────────────────────────────────────────────────── */
  function activeLock() { return premium.has('themeLock') ? store.get('themeLock') : null; }

  function themeLockString() {
    const lock = activeLock();
    if (!lock) return '';
    const parts = [];
    if (lock.atmo) parts.push(lock.atmo);
    if (lock.world) parts.push('visual world: ' + lock.world);
    if (lock.ref) parts.push('style reference: ' + lock.ref);
    if (lock.hex) parts.push('shared palette: ' + lock.hex);
    if (lock.pal) parts.push(lock.pal);
    parts.push('CONSISTENCY: this asset must share the same visual language, color palette, outline weight, and atmosphere as all other assets in this set');
    return parts.join(', ');
  }

  /** The trailing global token appended to every prompt. */
  function globalToken(perspDesc) {
    const NO_SHADOW = 'NO drop shadow, NO ground shadow, NO shadow under sprite, NO ambient occlusion, pure transparent background';
    const lock = activeLock();
    const world = lock ? lock.world : val('g_world');
    const ref = lock ? lock.ref : val('g_ref');
    const hex = lock ? lock.hex : val('g_hex');
    const pal = lock ? lock.pal : val('g_pal');
    return [
      buildMode(), pal, perspDesc || D.ISO,
      world ? 'game world: ' + world : '',
      ref ? 'style reference: ' + ref : '',
      hex ? 'shared palette: ' + hex : '',
      themeLockString(), NO_SHADOW, D.LOCK
    ].filter(Boolean).join(', ');
  }

  function imageRefString() {
    if (!imageRef.loaded) return '';
    const d = val('img_desc');
    return d
      ? '\n\nREFERENCE IMAGE PROVIDED: ' + d + ' — use the uploaded reference image to match the character design, color palette, proportions, and visual style exactly, changing only what is described above'
      : '\n\nREFERENCE IMAGE PROVIDED: recreate this character design in the pose and style described above, maintaining exact color palette, proportions, costume design, and visual identity from the reference image — only the pose changes';
  }

  /* ── animation sheets ──────────────────────────────────────────────────── */
  function animsFor(kind) { return D.AS.filter(a => a.t === kind); }

  function buildAnim(subject, neg, gtok) {
    if (!animId) return null;
    const spec = D.AS.find(a => a.id === animId);
    if (!spec) return null;
    const anchor = (subject.split('\n')[0] || subject).slice(0, 190);
    const frames = spec.f;
    const count = frames.length;
    const perFrame = frames.map((f, i) => ({
      idx: i, neg,
      prompt: subject + ' — "' + spec.n + '" animation FRAME ' + (i + 1) + ' of ' + count +
        '\nThis frame: ' + f +
        '\nCONSISTENCY ANCHOR: ' + anchor + '. Frame ' + (i + 1) + ' of ' + count + '. ONLY the pose changes.\n\n' + gtok
    }));
    const sheetStr = '\n\nANIMATED SPRITE SHEET: "' + spec.n + '" — ' + count + ' frames @ ' + spec.fps +
      '\nLayout: horizontal sprite strip, frames left to right, no gaps' +
      '\nConsistency anchor: ' + anchor +
      '\nFrames:\n' + frames.map((f, i) => '  Frame ' + (i + 1) + ': ' + f).join('\n') +
      '\nAll ' + count + ' frames share identical palette, shading, outline weight, and proportions — only pose changes.';
    return { spec, frames: perFrame, count, sheetStr };
  }

  /* ── prompt assembly ───────────────────────────────────────────────────── */
  function poseLine() {
    if (poseId === 'fly') return '\n' + D.FLY;
    if (poseId === 'atk') return '\n' + D.ATK;
    if (poseId === 'boss') return '\n' + D.BOSS_SCREAM;
    if (poseId === 'swim') return '\n' + D.SWIM;
    return '\n' + D.STAND;
  }

  function generate() {
    const tab = tabById(tabId);
    if (tab.gated && !premium.has(tab.gated)) { premium.showPaywall('feature', tab.gated); return; }
    if (tab.id === 'biome') { generateBiome(); return; }
    if (!premium.consume(1)) return;

    const p = perspective();
    const fullNeg = Array.from(negSet).concat(p.neg ? [p.neg] : []).join(', ');
    let subj = '';

    if (tab.id === 'char') {
      subj = [
        val('c_desc'), val('c_pose'), val('c_ar'),
        val('c_wp') !== 'unarmed fists' ? 'wielding ' + val('c_wp') : '',
        val('c_bd'),
        val('c_sp') !== 'none' ? val('c_sp') : '',
        val('c_ac') !== 'none' ? val('c_ac') : '',
        val('c_col') ? 'colors: ' + val('c_col') : '',
        val('c_ex')
      ].filter(Boolean).join(', ');
      subj += poseLine() + '\n' + p.desc + imageRefString();
    } else if (tab.id === 'enemy') {
      subj = [
        val('e_desc') || 'dark fantasy enemy creature',
        'size: ' + val('e_sz'),
        'evil intensity: ' + val('e_ev') + ', designed to look genuinely terrifying',
        val('e_sp') !== 'none' ? 'special trait: ' + val('e_sp') : '',
        val('e_col') ? 'colors: ' + val('e_col') : '',
        val('e_ex')
      ].filter(Boolean).join('\n');
      subj += poseLine() + '\n' + p.desc + imageRefString();
    } else if (tab.id === 'plat') {
      subj = [
        'PLATFORM / GROUND TILE',
        'Type: ' + val('pl_type'), 'Material: ' + val('pl_mat'), 'Tile size: ' + val('pl_sz'),
        'Edge behavior: ' + val('pl_edge'), 'Decoration: ' + val('pl_dec'), 'Theme: ' + val('pl_theme'),
        val('pl_desc'), val('pl_ex') ? 'Extra: ' + val('pl_ex') : '',
        p.id === 'flat' ? D.F2DT : D.ISO, D.BMEQ
      ].filter(Boolean).join('\n');
    } else if (tab.id === 'prop') {
      subj = [val('pr_desc') || 'game prop object', val('pr_st'), val('pr_mat'), val('pr_sz'), val('pr_ex'), p.desc]
        .filter(Boolean).join(', ') + imageRefString();
    } else if (tab.id === 'bg') {
      subj = ['GAME BACKGROUND SCENE: ' + (val('bg_desc') || 'dark fantasy environment'),
        val('bg_dep'), val('bg_tm'), val('bg_w'), val('bg_ex'), D.BGQ].filter(Boolean).join('\n');
    } else if (tab.id === 'fg') {
      subj = ['GAME FOREGROUND OVERLAY: ' + (val('fg_desc') || 'architectural frame overlay'),
        'Render style: ' + val('fg_sty'), 'Screen position: ' + val('fg_pos'), 'Animation hint: ' + val('fg_an'),
        val('fg_ex') ? 'Extra: ' + val('fg_ex') : '', D.FGQ].filter(Boolean).join('\n');
    } else if (tab.id === 'ui') {
      subj = ['GAME UI / HUD ELEMENT: ' + (val('ui_desc') || 'HUD component'),
        'UI theme: ' + val('ui_th'), 'State: ' + val('ui_st'), 'Scale: ' + val('ui_sc'),
        val('ui_ex') ? 'Extra: ' + val('ui_ex') : ''].filter(Boolean).join('\n');
    } else if (tab.id === 'vfx') {
      subj = ['GAME VFX SPRITE: ' + (val('vfx_desc') || 'game visual effect'),
        'Energy element: ' + val('vfx_el'), 'Frame: ' + val('vfx_fr'), 'Scale: ' + val('vfx_sc'),
        val('vfx_ex') ? 'Extra: ' + val('vfx_ex') : '', D.VFXQ].filter(Boolean).join('\n');
    } else if (tab.id === 'weapon') {
      const element = val('wp_el');
      subj = [
        'GAME WEAPON / ITEM SPRITE: ' + (val('wp_desc') || 'game weapon or item'),
        'Quality: ' + val('wp_rar'), 'Material: ' + val('wp_mat'),
        element && element.indexOf('none') !== 0 ? 'Magical element: ' + element + ' — incorporate these visual effects into the weapon design' : '',
        'View: ' + val('wp_view'),
        val('wp_ex') ? 'Extra details: ' + val('wp_ex') : '',
        'STANDALONE ISOLATED WEAPON SPRITE: single item centered in frame, no hands holding it, no character, no environment',
        'sharp focused detail on the weapon itself, game-ready item sprite'
      ].filter(Boolean).join('\n');
    }

    const gtok = globalToken(tab.id === 'bg' || tab.id === 'fg' ? null : p.desc);
    const anim = buildAnim(subj, fullNeg, gtok);
    const pos = subj + (anim ? anim.sheetStr : '') + '\n\n' + gtok;

    last = { pos, neg: fullNeg, title: tab.title, batch: anim ? anim.frames.map((f, i) => ({ name: 'Frame ' + (i + 1) + ' / ' + anim.count, text: f.prompt })) : null };
    renderOutput();
    sfx().play('forge');
    toast(anim ? anim.count + ' frame prompts ready' : 'Prompt generated', 'ok');
  }

  function generateBiome() {
    const name = val('bm_b');
    const biome = D.BIOME_DATA[name];
    if (!biome) { toast('Pick a biome first', 'warn'); return; }
    if (!premium.consume(1)) return;

    const p = perspective();
    const neg = Array.from(negSet).concat(p.id === 'flat' ? [D.NEG_FLAT] : []).join(', ');
    const pal = val('g_hex') || biome.pal;
    const tileView = p.id === 'flat'
      ? 'FLAT 2D SIDE-VIEW TILE: strictly orthographic side view, zero perspective, top surface horizontal, front face perfectly vertical, NO isometric angle — tile designed for side-scrolling 2D platformer'
      : 'isometric 3/4 top-down view';
    const base = [buildMode(), val('bm_sz') + ' tile', val('g_pal'), tileView, 'shared palette: ' + pal, themeLockString(), D.LOCK].filter(Boolean).join(', ');
    const atmo = 'Biome: ' + name + ' — ' + biome.atmo;

    const batch = biome.tiles.map(t => ({
      name: t.n,
      text: 'TILEMAP TILE [' + t.n + '] — ' + name + '\n' + t.d +
        '\nDecoration level: ' + val('bm_d') +
        '\nEdge behavior: ' + val('bm_e') +
        '\nLayout: ' + val('bm_l') + '\n' + atmo +
        (val('bm_ex') ? '\nExtra: ' + val('bm_ex') : '') + '\n\n' + base
    }));

    last = {
      pos: name + ' — ' + batch.length + ' tile prompts generated. Copy them individually below, or grab the whole set at once.',
      neg, title: 'Biome: ' + name, batch
    };
    renderOutput();
    sfx().play('forge');
    toast(batch.length + ' tile prompts ready', 'ok');
  }

  /* ── rendering ─────────────────────────────────────────────────────────── */
  function fieldNode(f) {
    let control;
    if (f.type === 'select') {
      let opts = f.options;
      if (f.dynamic === 'biomes') opts = Object.keys(D.BIOME_DATA);
      control = el('select', { class: 'select', id: f.id }, opts.map(o => el('option', { value: o, text: o })));
      const want = f.value != null ? f.value : opts[0];
      control.value = opts.indexOf(want) > -1 ? want : opts[0];
    } else if (f.type === 'textarea') {
      control = el('textarea', { class: 'textarea', id: f.id, rows: f.rows || 3, placeholder: f.placeholder || '' });
    } else {
      control = el('input', { class: 'input', type: 'text', id: f.id, placeholder: f.placeholder || '' });
    }
    const wrap = el('div', { class: 'field' }, [el('label', { class: 'label', for: f.id, text: f.label }), control]);
    if (f.span === 2) wrap.style.gridColumn = '1 / -1';
    return wrap;
  }

  function styleModeCard() {
    const mode = F.STYLE_MODES.find(m => m.id === styleMode) || F.STYLE_MODES[0];
    const pills = el('div', { class: 'mode-pills' }, F.STYLE_MODES.map(m =>
      el('button', {
        type: 'button', class: 'mode-pill' + (m.id === styleMode ? ' on' : ''), text: m.name,
        onclick: () => { styleMode = m.id; store.pref('art', 'styleMode', m.id); render(); }
      })));

    const body = el('div', { class: 'grid-3', style: 'margin-top:14px' }, mode.fields.map(fieldNode));
    if (!mode.fields.length) {
      body.className = '';
      body.appendChild(el('div', { class: 'note-strip', html: '<b>Hand-drawn mode</b> needs no extra settings — it uses a fixed illustration style block.' }));
    }

    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Art style' }),
        el('span', { class: 'spacer' })
      ]),
      pills, body,
      el('div', { class: 'grid-3', style: 'margin-top:12px' }, [
        fieldNode({ id: 'g_pal', label: 'Palette', type: 'select', options: F.PALETTES, value: store.pref('art', 'g_pal') || F.PALETTES[0] }),
        fieldNode({ id: 'g_world', label: 'World / setting', type: 'text', placeholder: 'e.g. Sunken Kingdom of Arath' }),
        fieldNode({ id: 'g_ref', label: 'Style reference', type: 'text', placeholder: 'e.g. Hollow Knight, Dead Cells' }),
        fieldNode({ id: 'g_hex', label: 'Shared hex palette', type: 'text', placeholder: '#0a0008, #3a1a2a, #8a4a6a', span: 2 })
      ])
    ]);
  }

  function themeLockCard() {
    const lock = store.get('themeLock');
    const on = !!lock && premium.has('themeLock');

    const card = el('div', { class: 'card lock-card' });
    const inner = el('div', {}, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: '🔒 Theme Lock' }),
        el('span', { class: 'lock-state ' + (on ? 'on' : 'off'), text: on ? 'Locked: ' + (lock.name || lock.world || 'custom') : 'No theme locked' }),
        el('span', { class: 'spacer' }),
        on ? el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Clear', onclick: () => { store.set('themeLock', null); render(); toast('Theme lock cleared', 'warn'); } }) : null
      ]),
      el('p', { class: 'card-sub', style: 'margin-bottom:12px', text: 'Pick a direction and every prompt you generate inherits the same world, palette and reference — that is what makes a set of assets look like one game.' }),
      el('div', { class: 'chip-row' }, D.THEMES.map(t =>
        el('button', {
          type: 'button',
          class: 'chip gold' + (lock && lock.id === t.id ? ' on' : ''),
          text: (t.emoji || '') + ' ' + t.name,
          onclick: () => { store.set('themeLock', Object.assign({}, t)); render(); toast('Theme locked: ' + t.name, 'ok'); }
        })))
    ]);
    card.appendChild(inner);
    premium.gate(card, 'themeLock');
    return card;
  }

  function perspectiveCard() {
    const p = perspective();
    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, el('span', { class: 'card-title', text: 'Perspective' })),
      el('div', { class: 'persp' }, F.PERSPECTIVES.map(x =>
        el('button', {
          type: 'button', class: 'persp-btn' + (x.id === perspId ? ' on' : ''), text: x.name,
          onclick: () => { perspId = x.id; store.pref('art', 'persp', x.id); render(); }
        }))),
      el('div', { class: 'persp-note', text: p.note })
    ]);
  }

  function poseCard() {
    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, el('span', { class: 'card-title', text: 'Pose override' })),
      el('div', { class: 'chip-row' }, F.POSES.map(x =>
        el('button', {
          type: 'button', class: 'chip' + (x.id === poseId ? ' on' : ''), text: x.name,
          onclick: () => { poseId = x.id; render(); }
        })))
    ]);
  }

  function animationCard(kind) {
    const list = animsFor(kind);
    if (!list.length) return null;
    const card = el('div', { class: 'card' });
    const inner = el('div', {}, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Animation sprite sheet' }),
        el('span', { class: 'badge badge-pro', text: 'PRO' })
      ]),
      el('p', { class: 'card-sub', style: 'margin-bottom:10px', text: 'Produces one prompt per frame plus a shared consistency anchor, so the frames actually match each other.' }),
      el('div', { class: 'chip-row' }, [{ id: '', n: 'None' }].concat(list).map(a =>
        el('button', {
          type: 'button', class: 'chip' + ((a.id || '') === animId ? ' on' : ''),
          text: a.n + (a.f ? ' (' + a.f.length + 'f)' : ''),
          onclick: () => { animId = a.id || ''; render(); }
        })))
    ]);
    card.appendChild(inner);
    premium.gate(card, 'animation');
    return card;
  }

  function presetCard(tab) {
    if (!tab.presetKey) return null;
    const raw = D[tab.presetKey];
    const groups = Array.isArray(raw) ? { All: raw } : raw;

    const list = el('div', { class: 'preset-list scroll-y' });
    const search = el('input', { class: 'input', type: 'search', placeholder: 'Search ' + tab.name.toLowerCase() + ' presets…' });

    function paint() {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      let shown = 0;
      Object.keys(groups).forEach(group => {
        const items = groups[group].filter(item => !q || item.toLowerCase().indexOf(q) > -1);
        if (!items.length) return;
        if (Object.keys(groups).length > 1) list.appendChild(el('div', { class: 'preset-group', text: group }));
        items.forEach(item => {
          shown++;
          const dash = item.indexOf(' — ');
          const html = dash > -1
            ? '<b>' + esc(item.slice(0, dash)) + '</b>' + esc(item.slice(dash))
            : esc(item);
          list.appendChild(el('div', {
            class: 'preset-item', html, role: 'button', tabindex: '0',
            onclick: () => apply(item),
            onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply(item); } }
          }));
        });
      });
      if (!shown) list.appendChild(el('div', { class: 'preset-empty', text: 'No presets match “' + search.value + '”' }));
    }

    function apply(item) {
      setVal(tab.presetTarget, item);
      const node = document.getElementById(tab.presetTarget);
      if (node) { node.focus(); node.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      toast('Preset applied', 'ok');
    }

    search.addEventListener('input', U.debounce(paint, 120));
    paint();

    const total = Object.keys(groups).reduce((n, g) => n + groups[g].length, 0);
    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Presets' }),
        el('span', { class: 'badge', text: total + ' ready-made' })
      ]),
      el('div', { class: 'preset-box' }, [el('div', { class: 'preset-search' }, search), list])
    ]);
  }

  function negativeCard() {
    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Negative prompt' }),
        el('span', { class: 'spacer' }),
        el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Select all', onclick: () => { D.NEG_BASE.forEach(n => negSet.add(n)); render(); } }),
        el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Clear', onclick: () => { negSet.clear(); render(); } })
      ]),
      el('div', { class: 'chip-row' }, D.NEG_BASE.map(n =>
        el('button', {
          type: 'button', class: 'chip neg' + (negSet.has(n) ? ' on' : ''), text: n,
          onclick: () => { negSet.has(n) ? negSet.delete(n) : negSet.add(n); render(); }
        })))
    ]);
  }

  function imageRefCard() {
    const status = el('p', { class: 'card-sub', text: imageRef.loaded ? 'Loaded: ' + imageRef.name : 'Optional — describe an existing design to keep it consistent.' });
    const input = el('input', {
      class: 'input', type: 'file', accept: 'image/*',
      onchange: e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        imageRef.loaded = true;
        imageRef.name = file.name;
        status.textContent = 'Loaded: ' + file.name;
        document.getElementById('img_desc_wrap').style.display = '';
        toast('Reference noted — it is described in the prompt, never uploaded', 'ok');
      }
    });
    const descWrap = el('div', { id: 'img_desc_wrap', style: imageRef.loaded ? '' : 'display:none' },
      fieldNode({ id: 'img_desc', label: 'What should change vs the reference?', type: 'text', placeholder: 'e.g. same character, now mid-attack' }));

    return el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, el('span', { class: 'card-title', text: 'Reference image' })),
      status, el('div', { style: 'margin-top:10px' }, input), descWrap,
      el('div', { class: 'note-strip', style: 'margin-top:10px', html: 'Your file never leaves this device. PixelForge only adds a line to the prompt telling the image model to match a reference — attach the actual image in whichever tool you paste into.' })
    ]);
  }

  function outputCard() {
    const empty = !last.pos;
    const posBlock = el('div', { class: 'out-block' + (empty ? ' empty' : ''), id: 'art-out-pos', text: empty ? 'Configure the builder and hit Generate — your prompt appears here.' : last.pos });
    const negBlock = el('div', { class: 'out-block neg', id: 'art-out-neg', text: last.neg || '—' });

    const actions = el('div', { class: 'out-actions' }, [
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Copy prompt', onclick: () => last.pos ? copyToast(last.pos, 'Prompt copied') : toast('Generate a prompt first', 'warn') }),
      el('button', { class: 'btn btn-sm', type: 'button', text: 'Copy negative', onclick: () => last.neg ? copyToast(last.neg, 'Negative copied') : toast('Nothing to copy', 'warn') }),
      el('button', { class: 'btn btn-sm', type: 'button', text: 'Save to library', onclick: saveCurrent }),
      el('button', { class: 'btn btn-sm', type: 'button', text: 'Download .txt', onclick: downloadCurrent }),
      el('button', { class: 'btn btn-sm btn-cyan', type: 'button', text: 'Spec sheet', onclick: downloadSpecSheet })
    ]);

    const kids = [
      el('div', { class: 'card-head' }, [
        el('span', { class: 'card-title', text: 'Output' }),
        last.title ? el('span', { class: 'badge', text: last.title }) : null,
        last.batch ? el('span', { class: 'badge badge-green', text: last.batch.length + ' prompts' }) : null
      ]),
      el('div', { class: 'out-label', text: 'Positive prompt' }), posBlock,
      el('div', { class: 'out-label', text: 'Negative prompt' }), negBlock,
      actions
    ];

    if (last.batch && last.batch.length) kids.push(batchSection());
    return el('div', { class: 'card out-card' }, kids);
  }

  function batchSection() {
    const wrap = el('div', { style: 'margin-top:18px' }, [
      el('div', { class: 'out-label' }, [
        el('span', { text: 'Batch' }),
        el('span', { class: 'badge badge-green', text: last.batch.length + ' items' })
      ])
    ]);

    last.batch.forEach(item => {
      wrap.appendChild(el('div', { class: 'res-card' }, [
        el('div', { class: 'res-head' }, [
          el('span', { class: 'res-name', text: item.name }),
          el('span', { class: 'spacer' }),
          el('button', { class: 'btn btn-sm', type: 'button', text: 'Copy', onclick: () => copyToast(item.text, 'Copied ' + item.name) })
        ]),
        el('div', { class: 'res-body scroll-y', text: item.text })
      ]));
    });

    const all = () => last.batch.map(i => '=== ' + i.name + ' ===\n' + i.text).join('\n\n---\n\n');
    const bar = el('div', { class: 'out-actions' }, [
      el('button', {
        class: 'btn btn-green', type: 'button', text: 'Copy all ' + last.batch.length,
        onclick: () => premium.has('batchExport') ? copyToast(all(), 'All ' + last.batch.length + ' prompts copied') : premium.showPaywall('feature', 'batchExport')
      }),
      el('button', {
        class: 'btn btn-sm', type: 'button', text: 'Download all',
        onclick: () => premium.has('batchExport')
          ? (U.download('pixelforge-' + tabId + '-batch.txt', all()), toast('Downloaded', 'ok'))
          : premium.showPaywall('feature', 'batchExport')
      })
    ]);
    wrap.appendChild(bar);
    return wrap;
  }

  function saveCurrent() {
    if (!last.pos) { toast('Generate a prompt first', 'warn'); return; }
    if (!premium.canSaveMore()) { premium.showPaywall('library'); return; }
    store.addToLibrary({ kind: 'art', title: last.title || 'Art prompt', text: last.pos, negative: last.neg, tab: tabId });
    toast('Saved to library', 'ok');
  }

  function downloadCurrent() {
    if (!last.pos) { toast('Generate a prompt first', 'warn'); return; }
    const body = 'POSITIVE PROMPT\n===============\n' + last.pos + '\n\nNEGATIVE PROMPT\n===============\n' + (last.neg || '—') + '\n';
    U.download('pixelforge-' + tabId + '.txt', body);
    toast('Downloaded', 'ok');
  }

  /** Export the current prompt as a shareable SVG spec sheet. */
  function downloadSpecSheet() {
    if (!last.pos) { toast('Generate a prompt first', 'warn'); return; }
    const lock = activeLock();
    global.PF.specCard.download({
      title: last.title || 'Art prompt',
      prompt: last.pos,
      negative: last.neg,
      meta: [buildMode().split(',')[0], perspective().id === 'flat' ? 'flat 2D side-view' : perspective().id + ' view',
        lock ? 'theme: ' + (lock.name || lock.world) : null].filter(Boolean).join('  ·  '),
      palette: (lock && lock.hex) || val('g_hex')
    });
    sfx().play('coin');
    toast('Spec sheet downloaded', 'ok');
  }

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /**
   * Randomise the whole builder from the preset library, then forge it.
   * Turns the form into something you can play with when you are stuck.
   */
  function roll() {
    const tab = tabById(tabId);
    if (tab.gated && !premium.has(tab.gated)) { premium.showPaywall('feature', tab.gated); return; }

    sfx().play('roll');

    // every select on the tab gets a random option
    tab.fields.forEach(f => {
      const node = document.getElementById(f.id);
      if (!node) return;
      if (f.type === 'select' && node.options.length) {
        node.selectedIndex = Math.floor(Math.random() * node.options.length);
      }
    });

    // and the description comes from the tab's own preset list
    if (tab.presetKey && tab.presetTarget) {
      const raw = D[tab.presetKey];
      const all = Array.isArray(raw) ? raw : Object.keys(raw).reduce((acc, g) => acc.concat(raw[g]), []);
      if (all.length) setVal(tab.presetTarget, pick(all));
    }

    if (tab.pose) poseId = pick(F.POSES).id;

    // let the roll animation land before the forge sound
    setTimeout(generate, 320);
  }

  function renderOutput() {
    const pane = document.getElementById('art-output');
    if (!pane) return;
    pane.innerHTML = '';
    pane.appendChild(outputCard());
  }

  /* ── main render ───────────────────────────────────────────────────────── */
  function render() {
    if (!host) return;
    const tab = tabById(tabId);

    /* preserve typed values across re-renders */
    const keep = {};
    U.$$('#art-form input, #art-form select, #art-form textarea', host).forEach(n => { if (n.id) keep[n.id] = n.value; });

    host.innerHTML = '';

    /* tab rail */
    host.appendChild(el('div', { class: 'tab-rail' }, F.TABS.map(t =>
      el('button', {
        type: 'button',
        class: 'tab' + (t.id === tabId ? ' on' : ''),
        dataset: { accent: t.accent || '' },
        onclick: () => { tabId = t.id; animId = ''; store.pref('art', 'tab', t.id); render(); }
      }, [
        document.createTextNode(t.name),
        t.gated && !premium.has(t.gated) ? el('span', { class: 'lock', text: ' 🔒' }) : null
      ]))));

    const quotaHost = el('div', { style: 'margin-bottom:16px' });
    premium.renderQuota(quotaHost);
    host.appendChild(quotaHost);

    /* left column */
    const form = el('div', { class: 'stack', id: 'art-form' });
    form.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('img', { src: 'assets/img/' + (tab.icon || 'sprite-knight') + '.svg', alt: '', class: 'px', style: 'height:26px' }),
        el('span', { class: 'card-title', text: tab.name }),
        tab.gated && !premium.has(tab.gated) ? el('span', { class: 'badge badge-pro', text: 'PRO' }) : null
      ]),
      el('p', { class: 'card-sub', text: tab.hint || '' }),
      el('div', { class: 'grid-2', style: 'margin-top:14px' }, tab.fields.map(fieldNode))
    ]));

    const presets = presetCard(tab);
    if (presets) form.appendChild(presets);
    form.appendChild(themeLockCard());
    form.appendChild(styleModeCard());
    if (!tab.batch) form.appendChild(perspectiveCard()); else form.appendChild(perspectiveCard());
    if (tab.pose) form.appendChild(poseCard());
    if (tab.animation) { const a = animationCard(tab.animation); if (a) form.appendChild(a); }
    if (tab.imageRef) form.appendChild(imageRefCard());
    form.appendChild(negativeCard());

    /* Build the roll button first so its handler closes over the node — the
       form is not in the document yet, so a querySelector here would miss. */
    const rollBtn = el('button', {
      class: 'btn btn-lg btn-cyan roll-btn', type: 'button',
      title: 'Roll a random asset', 'aria-label': 'Roll a random asset',
      html: '<span class="die">\u2680</span> Roll'
    });
    rollBtn.addEventListener('click', () => {
      rollBtn.classList.remove('rolling');
      void rollBtn.offsetWidth;      // reflow, so the animation restarts
      rollBtn.classList.add('rolling');
      roll();
    });

    form.appendChild(el('div', { class: 'forge-bar' }, [
      el('button', {
        class: 'btn btn-primary btn-lg', type: 'button', id: 'art-generate',
        text: tab.batch ? 'Generate tileset prompts' : 'Generate prompt',
        onclick: generate
      }),
      rollBtn
    ]));

    /* right column */
    const outPane = el('div', { class: 'pane-out', id: 'art-output' }, outputCard());

    host.appendChild(el('div', { class: 'split' }, [form, outPane]));

    /* restore values */
    Object.keys(keep).forEach(id => {
      const n = document.getElementById(id);
      if (n && keep[id] !== undefined && keep[id] !== '') n.value = keep[id];
    });

    /* remember palette choice */
    const pal = document.getElementById('g_pal');
    if (pal) pal.addEventListener('change', () => store.pref('art', 'g_pal', pal.value));
  }

  function mount(node) {
    host = node;
    tabId = store.pref('art', 'tab') || 'char';
    styleMode = store.pref('art', 'styleMode') || 'pixel';
    perspId = store.pref('art', 'persp') || 'iso';
    if (!F.TABS.some(t => t.id === tabId)) tabId = 'char';
    render();
  }

  document.addEventListener('pf:plan-changed', () => { if (host && host.offsetParent !== null) render(); });

  global.PF = global.PF || {};
  /** Switch builder tab from outside the panel (command palette). */
  function setTab(id) {
    if (!F.TABS.some(t => t.id === id)) return;
    tabId = id;
    animId = '';
    store.pref('art', 'tab', id);
    render();
  }

  /** Drop a preset string into the current tab's description field. */
  function applyPreset(text) {
    const tab = tabById(tabId);
    if (!tab.presetTarget) return;
    setVal(tab.presetTarget, text);
    const node = document.getElementById(tab.presetTarget);
    if (node) { node.focus(); node.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    toast('Preset applied', 'ok');
  }

  global.PF.art = { mount, render, setTab, applyPreset, roll };
})(typeof window !== 'undefined' ? window : globalThis);
