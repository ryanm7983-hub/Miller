/* Deterministic silhouette generator: guarantees paths span the full viewBox width. */
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, '..', 'assets', 'img');

// small deterministic PRNG so output is stable across runs
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** Jagged mountain ridge: alternating peaks/valleys across exactly [0,W]. */
function ridge(W, H, baseY, peaks, minH, maxH, seed) {
  const r = rng(seed);
  const step = W / peaks;
  const pts = [[0, baseY - minH * 0.5]];
  for (let i = 0; i < peaks; i++) {
    const x0 = i * step;
    pts.push([x0 + step * 0.5, baseY - (minH + r() * (maxH - minH))]); // peak
    pts.push([x0 + step, baseY - minH * (0.3 + r() * 0.5)]);           // valley
  }
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  return `${d}L${W} ${H}L0 ${H}Z`;
}

/** Treeline: tiered conifers with varied widths, marching across exactly [0,W]. */
function treeline(W, H, baseY, count, minH, maxH, seed) {
  const r = rng(seed);
  const step = W / count;
  let d = `M0 ${H}L0 ${baseY}`;
  for (let i = 0; i < count; i++) {
    const x = i * step;
    const h = minH + r() * (maxH - minH);
    const w = step * (0.85 + r() * 0.5);
    const cx = x + step / 2;
    const l = cx - w / 2, rt = cx + w / 2;
    // two-tier silhouette reads as a conifer rather than a bare spike
    const midY = baseY - h * 0.45;
    const skirt = w * 0.30;
    d += `L${l.toFixed(1)} ${baseY}`
       + `L${(l + skirt).toFixed(1)} ${midY.toFixed(1)}`
       + `L${(cx - w * 0.13).toFixed(1)} ${midY.toFixed(1)}`
       + `L${cx.toFixed(1)} ${(baseY - h).toFixed(1)}`
       + `L${(cx + w * 0.13).toFixed(1)} ${midY.toFixed(1)}`
       + `L${(rt - skirt).toFixed(1)} ${midY.toFixed(1)}`
       + `L${rt.toFixed(1)} ${baseY}`;
  }
  return d + `L${W} ${baseY}L${W} ${H}Z`;
}

fs.writeFileSync(`${OUT}/scene-far.svg`,
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 180" preserveAspectRatio="none" role="img">
  <path fill="#2b2850" d="${ridge(640, 180, 150, 7, 40, 108, 7)}"/>
  <path fill="#222043" d="${ridge(640, 180, 168, 11, 22, 62, 19)}"/>
</svg>
`);

fs.writeFileSync(`${OUT}/scene-mid.svg`,
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 140" preserveAspectRatio="none" role="img">
  <path fill="#1b1936" d="${ridge(640, 140, 128, 13, 26, 74, 41)}"/>
</svg>
`);

fs.writeFileSync(`${OUT}/scene-trees.svg`,
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" preserveAspectRatio="none" role="img">
  <path fill="#151330" d="${treeline(640, 160, 138, 30, 40, 88, 3)}"/>
  <path fill="#0d0c1f" d="${treeline(640, 160, 150, 40, 26, 58, 23)}"/>
</svg>
`);

console.log('scenery regenerated');
