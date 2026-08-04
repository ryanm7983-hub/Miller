/* Compiles hand-authored ASCII pixel grids into crisp, self-contained SVG files.
   Each glyph in a grid indexes a palette; '.' is transparent.
   Output uses one <rect> per horizontal run, so files stay small and scale cleanly. */
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'assets', 'img');
fs.mkdirSync(OUT, { recursive: true });

function toSvg(grid, pal, { scale = 1, pad = 0 } = {}) {
  const rows = grid.filter(r => r.length);
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const parts = [];
  for (let y = 0; y < h; y++) {
    const row = rows[y].padEnd(w, '.');
    let x = 0;
    while (x < w) {
      const c = row[x];
      if (c === '.' || c === ' ') { x++; continue; }
      let run = 1;
      while (x + run < w && row[x + run] === c) run++;
      const fill = pal[c];
      if (!fill) throw new Error(`Missing palette entry "${c}"`);
      parts.push(`<rect x="${x + pad}" y="${y + pad}" width="${run}" height="1" fill="${fill}"/>`);
      x += run;
    }
  }
  const W = w + pad * 2, H = h + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" role="img">\n${parts.join('\n')}\n</svg>\n`;
}

function write(name, grid, pal, opts) {
  const svg = toSvg(grid, pal, opts);
  fs.writeFileSync(path.join(OUT, name + '.svg'), svg);
  console.log(name.padEnd(20), svg.length + ' bytes');
}

/* ── shared palette ───────────────────────────────────────────── */
const P = {
  o: '#12101d', // outline
  O: '#241f38', // soft outline
  s: '#f2c9a0', // skin
  S: '#c99a72', // skin shade
  m: '#8b93b8', // metal
  M: '#5b6485', // metal shade
  l: '#d7dcf0', // metal light
  r: '#c8453f', // red
  R: '#8e2b2c', // red dark
  b: '#4a7fd4', // blue
  B: '#2b4f92', // blue dark
  g: '#5fbf62', // green
  G: '#2f7a3d', // green dark
  y: '#f5c542', // gold
  Y: '#c08a1e', // gold dark
  p: '#a874e8', // purple
  P: '#6b3fb0', // purple dark
  w: '#ffffff',
  k: '#2a2438', // dark fill
  t: '#7a5230', // wood
  T: '#4e3320', // wood dark
  c: '#5ee0d0', // cyan
  C: '#2a9e97', // cyan dark
  e: '#ff8a4c', // ember
};

/* ── knight ───────────────────────────────────────────────────── */
write('sprite-knight', [
  '......oooo......',
  '.....orrrro.....',
  '....oollllloo...',
  '...olmmmmmmmlo..',
  '...olmmmmmmmlo..',
  '...olkkkkkkklo..',
  '...olmmmmmmmlo..',
  '....olmmmmmlo...',
  '.....oooooo.....',
  '..oomlollllomoo.',
  '.omMMorrrroMMmo.',
  '.omMMorRRRoMMmo.',
  '.omMMorrrroMMmo.',
  '..ooMorrrroMoo..',
  '....ommmmmmo....',
  '....oBBBBBBo....',
  '...oBBBooBBBo...',
  '...oMMMo.oMMMo..',
  '..ooMMMo.oMMMoo.',
  '..okkkko.okkkko.',
  '...oooo...oooo..',
], P, { scale: 6 });

/* ── mage ─────────────────────────────────────────────────────── */
write('sprite-mage', [
  '......oooo......',
  '.....oPppPo.....',
  '....oPpppPo.....',
  '...oPppppPPo....',
  '..oPpppppppPo...',
  '..oPPppppPPPo...',
  '...ooosssooo....',
  '....osokkoso....',
  '....ossssso.....',
  '...opPPPPPpo....',
  '..opPPpppPPpo...',
  '.oyoPPpppPPoyo..',
  'occoPPpppPPocco.',
  '.oyoPPpppPPoyo..',
  '..opPPpppPPpo...',
  '..opPPPPPPPpo...',
  '..oppPPPPPppo...',
  '..oPPPPPPPPPo...',
  '..ooooooooooo...',
  '................',
], P, { scale: 6 });

/* ── slime ────────────────────────────────────────────────────── */
write('sprite-slime', [
  '................',
  '................',
  '......oooo......',
  '....ooggggoo....',
  '...oggggggggo...',
  '..oggwggggwggo..',
  '..ogwwgggwwggo..',
  '.oggwwggwwgggo..',
  '.oggggggggggggo.',
  'oggggoggggogggo.',
  'oggggoggggogggo.',
  'ogggggooooggggo.',
  'oGgggggggggggGo.',
  'oGGgggggggggGGo.',
  '.oGGGGGGGGGGGo..',
  '..ooooooooooo...',
], P, { scale: 6 });

/* ── bat ──────────────────────────────────────────────────────── */
write('sprite-bat', [
  '................',
  'oo...........oo.',
  'okko.......okko.',
  'okkko.ooo.okkko.',
  'okkkkokkkokkkko.',
  'okkkkkkkkkkkkko.',
  'okkkokrrrkokkko.',
  'okkkokkkkkokkko.',
  '.okkkkkwkkkkko..',
  '..okkkkkkkkko...',
  '...okkkkkkko....',
  '....okkkkko.....',
  '.....okkko......',
  '......ooo.......',
], P, { scale: 6 });

/* ── chest ────────────────────────────────────────────────────── */
write('sprite-chest', [
  '................',
  '...oooooooooo...',
  '..oyYYYYYYYYyo..',
  '.oyttttttttttyo.',
  'oyttTTttttTTttyo',
  'oyttttttttttttyo',
  'oyYYYYYYYYYYYYyo',
  'oyttttoyyottttyo',
  'oyttttoyyottttyo',
  'oyttTToyyoTTttyo',
  'oytttttyyttttyo.',
  'oyttttttttttttyo',
  'oyYYYYYYYYYYYYyo',
  '.oooooooooooooo.',
  '................',
  '................',
], P, { scale: 6 });

/* ── crystal ──────────────────────────────────────────────────── */
write('sprite-crystal', [
  '.......oo.......',
  '......occo......',
  '.....occcco.....',
  '....occwccco....',
  '...occcwcccco...',
  '..occccwccccco..',
  '..occccwccccCo..',
  '..occccwcccCCo..',
  '..oCcccwccCCCo..',
  '...oCccwcCCCo...',
  '....oCcwCCCo....',
  '.....oCwCCo.....',
  '......oCCo......',
  '.......oo.......',
  '................',
  '................',
], P, { scale: 6 });

/* ── potion ───────────────────────────────────────────────────── */
write('sprite-potion', [
  '.....oooo.......',
  '.....otto.......',
  '.....otto.......',
  '....ooooo.......',
  '....olllo.......',
  '...olrrrlo......',
  '..olrrrrrlo.....',
  '.olrwrrrrrlo....',
  'olrwrrrrrrrlo...',
  'olrrrrrrrrrlo...',
  'olRrrrrrrrRlo...',
  'olRRrrrrrRRlo...',
  '.olRRRRRRRlo....',
  '..ooooooooo.....',
  '................',
  '................',
], P, { scale: 6 });

/* ── sword ────────────────────────────────────────────────────── */
write('sprite-sword', [
  '............oo..',
  '..........oolo..',
  '.........ollmo..',
  '........ollmoo..',
  '.......ollmoo...',
  '......ollmoo....',
  '.....ollmoo.....',
  '....ollmoo......',
  '...ollmoo.......',
  '..oyyyyyyo......',
  '.oyYYYYYYyo.....',
  '..otTto.oo......',
  '..otTto.........',
  '..otTto.........',
  '..oyyyo.........',
  '...ooo..........',
], P, { scale: 6 });

/* ── coin ─────────────────────────────────────────────────────── */
write('sprite-coin', [
  '....oooo....',
  '..ooyyyyoo..',
  '.oywwyyyyyo.',
  'oywwyyyyyyyo',
  'oywyyYYYYyyo',
  'oyyyYYYYYYyo',
  'oyyyYYYYYYyo',
  'oyyyyYYYYyyo',
  'oyyyyyyyyyyo',
  '.oyYYYYYYYo.',
  '..ooYYYYoo..',
  '....oooo....',
], P, { scale: 6 });

/* ── heart ────────────────────────────────────────────────────── */
write('sprite-heart', [
  '..oooo..oooo..',
  '.orrrroorrrro.',
  'orwrrrrrrrrrro',
  'orwrrrrrrrrrro',
  'orrrrrrrrrrrro',
  'oRrrrrrrrrrrRo',
  '.oRrrrrrrrrRo.',
  '..oRrrrrrrRo..',
  '...oRrrrrRo...',
  '....oRrrRo....',
  '.....oRRo.....',
  '......oo......',
], P, { scale: 6 });

/* ── mushroom (scenery) ───────────────────────────────────────── */
write('sprite-mushroom', [
  '....oooooo....',
  '..oorrrrrroo..',
  '.orrwrrrrwrro.',
  'orrrrrrrrrrrro',
  'orwrrrrrrrrwro',
  'oRRrrrrrrrrRRo',
  '.oRRRRRRRRRRo.',
  '..ooosssooo...',
  '....ossso.....',
  '....ossso.....',
  '....oSSSo.....',
  '...ooSSSoo....',
  '..oSSSSSSSo...',
  '..ooooooooo...',
], P, { scale: 6 });

/* ── tree (scenery) ───────────────────────────────────────────── */
write('sprite-tree', [
  '......oooo......',
  '....ooggggoo....',
  '..oogggggggoo...',
  '.ogggggggggggo..',
  'oggggggggggggGo.',
  'ogggGgggggGgggo.',
  'oGggggggggggggo.',
  '.oGGgggggggGGo..',
  '..oGGGgggGGGo...',
  '...ooogggooo....',
  '.....ottto......',
  '.....otTto......',
  '.....otTto......',
  '....ootTtoo.....',
  '...oTTtttTTo....',
  '...ooooooooo....',
], P, { scale: 6 });

/* ── banner / flag ────────────────────────────────────────────── */
write('sprite-banner', [
  '..oooooooooo..',
  '.oyYYYYYYYYyo.',
  'opPPPPPPPPPPpo',
  'opPPpppppPPPpo',
  'opPppwwwppPPpo',
  'opPppwwwppPPpo',
  'opPpppwpppPPpo',
  'opPPpppppPPPpo',
  'opPPPPPPPPPPpo',
  '.opPPPPPPPPpo.',
  '..opPPPPPPpo..',
  '...opPPPPpo...',
  '....opPPpo....',
  '.....oppo.....',
  '......oo......',
], P, { scale: 6 });

console.log('\nSprites written to', OUT);
