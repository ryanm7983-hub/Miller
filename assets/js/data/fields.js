/* ===========================================================================
   PixelForge — form schemas for the art builders.
   Each tab declares its fields declaratively; art.js renders and reads them.
   Field: { id, label, type, options?, value?, placeholder?, rows?, span? }
   =========================================================================== */
(function (global) {
  'use strict';

  const sel = (id, label, options, extra) =>
    Object.assign({ id, label, type: 'select', options, value: options[0] }, extra || {});
  const txt = (id, label, placeholder, extra) =>
    Object.assign({ id, label, type: 'text', placeholder: placeholder || '' }, extra || {});
  const area = (id, label, placeholder, rows) =>
    ({ id, label, type: 'textarea', placeholder: placeholder || '', rows: rows || 3, span: 2 });

  /* ── style-mode option sets ────────────────────────────────────────────── */
  const STYLE_MODES = [
    {
      id: 'pixel', name: 'Pixel art',
      fields: [
        sel('g_era', 'Era', ['16-bit SNES-style', '8-bit NES-style', '32-bit PS1-era', 'GBA-style', 'modern indie pixel art', 'hyper-detailed pixel art']),
        sel('g_sz', 'Sprite size', ['16x16px', '32x32px', '48x48px', '64x64px', '96x96px', '128x128px'], { value: '32x32px' }),
        sel('g_sh', 'Shading', ['flat no shading', '2-tone cel shading', '3-tone shading', 'high contrast dramatic'], { value: '2-tone cel shading' }),
        sel('g_ol', 'Outline', ['clean 1px dark outline', 'no outline', 'selective outline', 'double outline'])
      ]
    },
    { id: 'hand', name: 'Hand-drawn', fields: [] },
    {
      id: 'paint', name: 'Painterly',
      fields: [
        sel('pt_m', 'Medium', ['watercolor, soft blooms', 'gouache, opaque flat', 'oil painting, rich impasto', 'digital painterly, loose brush strokes', 'acrylic, bold strokes']),
        sel('pt_d', 'Detail', ['loose impressionistic', 'semi-detailed', 'highly detailed, near realism'], { value: 'semi-detailed' }),
        sel('pt_l', 'Lighting', ['soft diffuse', 'dramatic rim lighting', 'warm backlit glow', 'cool moonlit'])
      ]
    },
    {
      id: 'vector', name: 'Vector',
      fields: [
        sel('vc_s', 'Style', ['flat vector, bold fills, no gradients', 'cel-shaded vector, 2-tone fills', 'geometric minimal']),
        sel('vc_o', 'Outline', ['bold uniform outline', 'thin uniform outline', 'no outline']),
        sel('vc_c', 'Color', ['vibrant saturated', 'muted flat tones', 'monochromatic'])
      ]
    },
    {
      id: 'ink', name: 'Ink horror',
      fields: [
        sel('sk_tx', 'Line texture', ['heavily scratched ink crosshatch, chaotic line density', 'loose spidery ink lines, thin and trembling', 'dense scribbled ink, near-black masses with scratch highlights', 'stipple and scratch mix, pointillist dark masses', 'smeared ink wash with scratch marks over top']),
        sel('sk_tn', 'Tone', ['black and white ink only, extreme contrast', 'black ink with sickly yellow-sepia wash', 'black ink with muted blood-red accent', 'black ink with pale blue-grey wash, cold and ghostly', 'black ink with muted earthy brown tones']),
        sel('sk_hi', 'Horror level', ['unsettling — wrong proportions, eerie atmosphere', 'deeply disturbing — body horror, wrong anatomy, nightmare logic', 'full nightmare — cosmic horror, impossible forms, pure dread']),
        sel('sk_dl', 'Detail', ['loose gestural sketch, rough and frantic', 'medium detail, recognizable but deeply wrong', 'highly detailed, every surface scratched and textured'], { value: 'medium detail, recognizable but deeply wrong' }),
        txt('sk_ex', 'Extra detail', 'e.g. too many eyes, elongated fingers…', { span: 2 })
      ]
    },
    {
      id: 'voxel', name: 'Voxel',
      fields: [
        sel('vx_ref', 'Reference', ['Magica Voxel style', 'Minecraft style', '3D Dot Game Heroes style', 'Crossy Road style', 'Trove style']),
        sel('vx_sz', 'Voxel size', ['micro voxel — very tiny cubes, high detail count', 'standard voxel — clearly visible cubes, game-ready', 'chunky voxel — large obvious cubes, low-fi charm', 'mega voxel — enormous cubes, very minimal geometry'], { value: 'standard voxel — clearly visible cubes, game-ready' }),
        sel('vx_rs', 'Render', ['clean voxel render, sharp cube edges, flat lit faces', 'ambient occlusion voxel, subtle face shading in corners', 'stylized voxel, slight bevel on cube edges, polished', 'raw voxel export look, no lighting, pure flat colors']),
        sel('vx_va', 'View angle', ['isometric 3/4 voxel view, classic game angle', 'front-facing voxel, slight 3/4 tilt', 'top-down voxel overhead view', 'side-view voxel, 2.5D platformer angle']),
        sel('vx_cp', 'Palette', ['vibrant saturated voxel colors', 'muted earthy voxel tones', 'dark gothic voxel palette', 'pastel soft voxel colors', 'neon cyberpunk voxel palette', 'natural realistic voxel tones'])
      ]
    }
  ];

  const PALETTES = ['strictly 16-color palette', '24-color palette', '32-color palette', '64-color palette', 'dark gothic muted palette', 'vibrant saturated palette', 'warm earthy fantasy palette'];

  /* ── perspective options ───────────────────────────────────────────────── */
  const PERSPECTIVES = [
    { id: 'iso', name: 'Isometric 3/4', desc: 'isometric 3/4 top-down view, classic game sprite perspective', neg: '', note: 'Classic RPG / top-down look. Good default for character portraits and props.' },
    { id: 'flat', name: 'Flat 2D side-view', desc: null /* filled from PF_DATA.F2DS at runtime */, neg: null, note: 'Strict orthographic side view for side-scrollers — no perspective tilt at all.' },
    { id: 'front', name: 'Front-facing', desc: 'strict front-facing view, character facing the viewer directly, symmetrical composition, no perspective tilt', neg: 'side view, profile view, three-quarter turn', note: 'Straight-on view. Good for portraits, shop icons and menu art.' }
  ];

  /* ── per-tab schemas ───────────────────────────────────────────────────── */
  const TABS = [
    {
      id: 'char', name: 'Character', accent: '', icon: 'sprite-knight',
      title: 'Character', presetKey: 'CHAR_PRE', presetTarget: 'c_desc',
      hint: 'Describe your hero. Pick a preset to fill the description, then tune the details.',
      pose: true, imageRef: true, animation: 'char',
      fields: [
        area('c_desc', 'Character description', 'e.g. Warrior — heavily armored battle-scarred fighter, two-handed sword…'),
        sel('c_pose', 'Pose', ['standing idle — UPRIGHT on both feet (NOT sitting)', 'walking mid-stride, upright posture', 'running full sprint, forward lean', 'attack windup, weapon drawn back', 'attack follow-through, weapon at impact', 'casting, arms raised, energy in hands', 'jump apex, airborne', 'landing crouch, knees bent', 'death collapsed on ground', 'victory standing tall arms raised', 'hurt flinching jolted from impact', 'guard block weapon raised defensive']),
        sel('c_ar', 'Armour tier', ['starter worn gear', 'common adventurer', 'uncommon hero gear', 'rare elite ornate', 'epic tier set glowing', 'legendary artifact armor', 'cloth robes caster', 'leather armor rogue', 'plate armor tank', 'corrupted demonic armor', 'holy divine armor'], { value: 'uncommon hero gear' }),
        sel('c_wp', 'Weapon', ['unarmed fists', 'one-handed sword', 'two-handed greatsword', 'dual daggers', 'bow and quiver', 'magical staff with orb', 'warhammer', 'battle axe', 'spear or halberd', 'shield raised', 'spellbook tome', 'orb focus crystal'], { value: 'one-handed sword' }),
        sel('c_bd', 'Build', ['slender lithe', 'average athletic', 'stocky muscular', 'heavyset broad', 'small compact', 'tall imposing', 'hunched elderly'], { value: 'average athletic' }),
        sel('c_sp', 'Special trait', ['none', 'glowing eyes', 'wings spread', 'visible aura or halo', 'spell energy in hands', 'floating off ground', 'battle scars', 'demonic corruption marks', 'holy light emanating', 'shadow tendrils', 'mechanical cyborg parts']),
        sel('c_ac', 'Accessory', ['none', 'flowing cape', 'horned helmet', 'war paint markings', 'glowing skin runes', 'spiked shoulder armor', 'trophy belt', 'arcane crystal in chest']),
        txt('c_col', 'Colour direction', 'e.g. deep crimson and tarnished gold'),
        txt('c_ex', 'Extra details', 'anything else to force into the prompt', { span: 2 })
      ]
    },
    {
      id: 'enemy', name: 'Enemy / Boss', accent: 'red', icon: 'sprite-bat',
      title: 'Enemy', presetKey: 'ENEMY_PRE', presetTarget: 'e_desc',
      hint: 'Pick from 15 creature families, then dial the size and menace.',
      pose: true, imageRef: true, animation: 'enemy',
      fields: [
        area('e_desc', 'Enemy description', 'e.g. Skeleton Warrior — reanimated soldier, yellowed cracked bones…'),
        sel('e_sz', 'Size', ['tiny ~0.5x player', 'small goblin-sized', 'medium human-sized', 'large ogre-sized 2x', 'huge giant-sized 4x', 'boss 5-6x player height', 'world boss fills screen'], { value: 'medium human-sized' }),
        sel('e_ev', 'Menace', ['menacing — clearly a threat', 'frightening — grotesque disturbing design', 'truly terrifying — body horror wrong proportions', 'absolute nightmare — cosmic horror defies nature', 'purely malevolent — darkness incarnate']),
        sel('e_sp', 'Special trait', ['none', 'burning hellfire aura', 'fel corruption green glow spreading', 'shadow void energy consuming the form', 'lightning crackling across entire body', 'blood-soaked dripping fresh wounds', 'necrotic decay flesh rotting in real time', 'multiple screaming faces in body or shadow', 'spines and bone growths erupting through skin', 'bioluminescent organs through translucent skin', 'void rift behind it tearing reality open']),
        txt('e_col', 'Colour direction', 'e.g. bone white and necrotic green'),
        txt('e_ex', 'Extra details', '', { span: 2 })
      ]
    },
    {
      id: 'plat', name: 'Platform', accent: 'green', icon: 'sprite-chest',
      title: 'Platform', presetKey: 'PLAT_PRE', presetTarget: 'pl_desc',
      hint: 'Ground and platform tiles for side-scrollers and top-down maps.',
      fields: [
        area('pl_desc', 'Tile description', 'e.g. mossy cobblestone floor with cracked edges…'),
        sel('pl_type', 'Tile type', ['floor tile — flat walkable ground surface', 'floating platform — thin ledge, walkable top', 'one-way thin platform — jump through from below', 'platform top edge tile', 'platform left edge cap', 'platform right edge cap', 'platform underside tile', 'slope / ramp — 30 degrees', 'slope / ramp — 45 degrees', 'ground left transition edge', 'ground right transition edge', 'wall tile — vertical surface', 'ceiling tile — underside of ceiling']),
        sel('pl_mat', 'Material', ['stone cobblestone', 'grass and earth', 'rough hewn stone', 'polished marble', 'weathered wood planks', 'dark iron grating', 'ancient bone compressed', 'arcane crystal', 'volcanic basalt', 'ice crystal', 'earth and soil', 'living overgrown wood']),
        sel('pl_sz', 'Tile size', ['16x16px tile', '32x32px tile', '48x48px tile', '64x64px tile'], { value: '32x32px tile' }),
        sel('pl_edge', 'Tiling', ['seamlessly tileable horizontally', 'seamlessly tileable all 4 edges', 'single hero tile, no repeat']),
        sel('pl_dec', 'Weathering', ['clean minimal', 'medium: natural wear, cracks', 'heavy: full weathering, growth', 'ruined: maximum decay'], { value: 'medium: natural wear, cracks' }),
        sel('pl_theme', 'Theme', ['dark gothic dungeon', 'volcanic infernal', 'swamp organic', 'lush forest natural', 'arcane magical', 'undead necromantic', 'mechanical steampunk', 'ice tundra', 'desert ancient ruins', 'void cosmic', 'bright sunny meadow', 'autumn forest']),
        txt('pl_ex', 'Extra details', '', { span: 2 })
      ]
    },
    {
      id: 'biome', name: 'Biome tilemap', accent: 'green', icon: 'sprite-tree',
      title: 'Biome', gated: 'biome', batch: true,
      hint: 'Generates a complete tileset for one biome — every tile prompt at once.',
      fields: [
        sel('bm_b', 'Biome', [], { dynamic: 'biomes' }),
        sel('bm_sz', 'Tile size', ['16x16', '32x32', '48x48', '64x64'], { value: '32x32' }),
        sel('bm_d', 'Decoration', ['clean minimal', 'medium: wear cracks growth', 'heavy: full weathering', 'ruined: maximum decay'], { value: 'medium: wear cracks growth' }),
        sel('bm_e', 'Tiling', ['seamlessly tileable horizontally', 'seamlessly tileable all 4 edges', 'single hero tile']),
        sel('bm_l', 'Layout', ['single isolated tile sprite', '2x2 cluster, 4 tiles one image', '4x4 grid, 16 tiles']),
        txt('bm_ex', 'Extra details', '', { span: 2 })
      ]
    },
    {
      id: 'prop', name: 'Prop', accent: '', icon: 'sprite-potion',
      title: 'Prop', presetKey: 'PROP_PRE', presetTarget: 'pr_desc',
      hint: 'Chests, torches, levers, barrels — the objects that fill a level.',
      imageRef: true,
      fields: [
        area('pr_desc', 'Prop description', 'e.g. ornate treasure chest with iron banding…'),
        sel('pr_st', 'State', ['pristine mint condition', 'lightly worn and used', 'battle damaged cracked', 'half destroyed crumbling', 'broken open and looted', 'on fire burning', 'frozen in ice', 'glowing enchanted active', 'dormant powered down', 'corrupted demonic', 'overgrown with vines'], { value: 'lightly worn and used' }),
        sel('pr_mat', 'Material', ['rough hewn stone', 'polished marble', 'weathered wood', 'dark iron', 'brass copper bronze', 'ancient bone', 'arcane crystal', 'rune-etched metal', 'rusted iron', 'demon-forged infernal metal', 'ice crystal', 'volcanic rock']),
        sel('pr_sz', 'Size', ['tiny (8-16px area)', 'small (16-32px area)', 'medium (32-48px area)', 'large (64px+ area)', 'full tile piece (32x32)'], { value: 'medium (32-48px area)' }),
        txt('pr_ex', 'Extra details', '', { span: 2 })
      ]
    },
    {
      id: 'bg', name: 'Background', accent: '', icon: 'sprite-mushroom',
      title: 'Background', presetKey: 'BG_PRE', presetTarget: 'bg_desc',
      hint: 'Parallax-ready scene layers. No characters, no UI, no text.',
      fields: [
        area('bg_desc', 'Scene description', 'e.g. crumbling gothic cathedral interior, shattered stained glass…'),
        sel('bg_dep', 'Parallax depth', ['far background (sky + horizon, highest parallax)', 'mid background (terrain + structures, medium parallax)', 'near background (immediate backdrop, low parallax)', 'all three layers described together', 'single flat layer, no parallax'], { value: 'all three layers described together' }),
        sel('bg_tm', 'Time / sky', ['bright midday clear sky', 'golden hour warm sunset', 'full night starfield', 'moonlit silver night', 'overcast flat grey sky', 'stormy dramatic dark clouds', 'volcanic hellish red sky', 'magical twilight aurora', 'foggy misty morning', 'apocalyptic smoke-filled sky', 'bioluminescent cave glow', 'eternal twilight wrong-colored sun']),
        sel('bg_w', 'Canvas', ['screen width 320px', 'wide 640px', 'seamlessly looping horizontal strip', 'panoramic 960px+'], { value: 'seamlessly looping horizontal strip' }),
        txt('bg_ex', 'Extra details', '', { span: 2 })
      ]
    },
    {
      id: 'fg', name: 'Foreground', accent: '', icon: 'sprite-tree',
      title: 'Foreground', presetKey: 'FG_PRE', presetTarget: 'fg_desc',
      hint: 'Overlay layers that frame the playspace and sell depth.',
      fields: [
        area('fg_desc', 'Overlay description', 'e.g. hanging vines and gnarled branch silhouettes…'),
        sel('fg_sty', 'Render style', ['dark silhouette fully opaque', 'semi-transparent dark overlay', 'fully detailed opaque foreground', 'light misty foggy overlay']),
        sel('fg_pos', 'Screen position', ['bottom edge only', 'top edge only', 'left column only', 'right column only', 'top and bottom borders', 'full frame all four edges', 'bottom corners only', 'top corners only']),
        sel('fg_an', 'Animation hint', ['static no movement', 'subtle sway: dead vegetation', 'dripping: blood slime ichor', 'flickering: torch dark flame', 'drifting: fog spores ash', 'pulsing: dark arcane glow']),
        txt('fg_ex', 'Extra details', '', { span: 2 })
      ]
    },
    {
      id: 'ui', name: 'UI / HUD', accent: 'cyan', icon: 'sprite-heart',
      title: 'UI Element', presetKey: 'UI_PRE', presetTarget: 'ui_desc',
      hint: 'Health bars, buttons, panels and icons that match your art direction.',
      fields: [
        area('ui_desc', 'Element description', 'e.g. segmented health bar with ornate iron frame…'),
        sel('ui_th', 'UI theme', ['dark gothic stone and iron', 'arcane magical glowing runes', 'nature organic wood and bone', 'demonic fel corrupted metal', 'holy divine gold and white', 'undead necromantic bone shadow', 'mechanical steampunk brass gears', 'eldritch cosmic unsettling', 'minimal clean simple frames']),
        sel('ui_st', 'State', ['default idle', 'hover mouseover', 'pressed active', 'disabled grayed out', 'full max value', 'empty critical depleted', 'notification glow active', 'all states on one sheet']),
        sel('ui_sc', 'Scale', ['1x native pixel scale', '2x upscaled for clarity', 'icon size (16x16 equivalent)', 'panel size (128x96 equivalent)', 'full screen overlay']),
        txt('ui_ex', 'Extra details', '', { span: 2 })
      ]
    },
    {
      id: 'vfx', name: 'VFX', accent: 'gold', icon: 'sprite-crystal',
      title: 'VFX', presetKey: 'VFX_PRE', presetTarget: 'vfx_desc',
      hint: 'Impact sparks, spell bursts and status effects on transparent alpha.',
      animation: 'vfx',
      fields: [
        area('vfx_desc', 'Effect description', 'e.g. radial explosion burst with debris and embers…'),
        sel('vfx_el', 'Element', ['fire: orange red yellow', 'ice frost: blue white cyan', 'shadow void: dark purple black', 'arcane: magenta purple sparkling', 'holy divine: gold white radiant', 'poison: green toxic lime', 'lightning: electric blue yellow', 'earth stone: brown orange debris', 'water: teal blue transparent', 'dark soul energy: deep indigo pulsing', 'blood: crimson dark red', 'necrotic: grey-green death energy', 'void corruption: black tendrils purple core']),
        sel('vfx_fr', 'Frame', ['single peak intensity keyframe', 'startup charge frame', 'mid-animation frame', 'end dissipating frame', 'looping ambient frame', 'full 4-frame strip', 'full 8-frame strip', 'impact contact frame only']),
        sel('vfx_sc', 'Scale', ['tiny hit spark (8-12px)', 'small effect (16-24px)', 'medium effect (32-48px)', 'large effect (64-96px)', 'screen-filling massive effect (128px+)'], { value: 'medium effect (32-48px)' }),
        txt('vfx_ex', 'Extra details', '', { span: 2 })
      ]
    },
    {
      id: 'weapon', name: 'Weapon forge', accent: 'gold', icon: 'sprite-sword',
      title: 'Weapon/Item', presetKey: 'WEAPON_PRE', presetTarget: 'wp_desc',
      gated: 'weapon',
      hint: 'Isolated weapon and item sprites with rarity, material and element.',
      fields: [
        area('wp_desc', 'Item description', 'e.g. Longsword — classic double-edged straight blade…'),
        sel('wp_rar', 'Rarity', ['common — plain, worn, practical', 'uncommon — well-crafted, some detail', 'rare — ornate, magical details, glowing trim', 'epic — elaborate, clearly powerful, glowing effects', 'legendary — over-the-top, unmistakably legendary, intense magical aura', 'cursed — dark, corrupted, wrong energy, disturbing', 'divine — holy light, angelic, pure divine power'], { value: 'rare — ornate, magical details, glowing trim' }),
        sel('wp_mat', 'Material', ['iron and steel', 'dark iron, blackened', 'bronze, ancient', 'silver, polished', 'gold-trimmed', 'bone and sinew', 'crystal and glass', 'living wood and vine', 'void energy, crystallized', 'divine light, solidified', 'ice and frost', 'magma and volcanic rock']),
        sel('wp_el', 'Element', ['none — purely physical', 'fire — flames and embers', 'ice — frost and cold', 'lightning — crackling arcs', 'arcane — purple-blue magical energy', 'holy — golden divine light', 'shadow — dark void energy', 'poison — toxic green glow', 'nature — living vines and leaves', 'blood — crimson energy', 'necrotic — death energy, green-black', 'time — clock imagery, temporal distortion']),
        sel('wp_view', 'View', ['flat side profile view, facing right', 'slight 3/4 angle showing depth', 'diagonal hero pose angle', 'top-down view']),
        txt('wp_ex', 'Extra details', '', { span: 2 })
      ]
    }
  ];

  /* ── pose overrides offered on character / enemy tabs ──────────────────── */
  const POSES = [
    { id: '', name: 'Standing' },
    { id: 'fly', name: 'Flying' },
    { id: 'atk', name: 'Attacking' },
    { id: 'boss', name: 'Boss roar' },
    { id: 'swim', name: 'Swimming' }
  ];

  global.PF = global.PF || {};
  global.PF.fields = { STYLE_MODES, PALETTES, PERSPECTIVES, TABS, POSES };
})(typeof window !== 'undefined' ? window : globalThis);
