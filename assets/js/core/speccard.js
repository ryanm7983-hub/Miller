/* ===========================================================================
   PixelForge — renders a prompt as a shareable spec sheet (SVG).

   Built as vector SVG rather than a canvas raster: it stays crisp at any size,
   is a fraction of the bytes, needs no fonts beyond the system stack, and is
   produced entirely offline.
   =========================================================================== */
(function (global) {
  'use strict';

  const U = global.PF.util;

  const PAD = 36;
  const WIDTH = 900;
  const LINE = 17;
  const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  const xml = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  /** Hard-wrap text to a column width, preserving deliberate line breaks. */
  function wrap(text, cols) {
    const out = [];
    String(text || '').split('\n').forEach(paragraph => {
      if (!paragraph.trim()) { out.push(''); return; }
      let line = '';
      paragraph.split(/\s+/).forEach(word => {
        if (!line) { line = word; return; }
        if ((line + ' ' + word).length > cols) { out.push(line); line = word; }
        else line += ' ' + word;
      });
      if (line) out.push(line);
    });
    return out;
  }

  /* Colour-codes the structural lines so the sheet is skimmable. */
  function lineColor(line) {
    if (/^(CRITICAL|MUST|NO )/.test(line)) return '#f87171';
    if (/^(FLAT 2D|TILESET|ANIMATED|STANDALONE)/.test(line)) return '#5ee0d0';
    if (/^(GAME |BACKGROUND|FOREGROUND|VFX|PLATFORM|TILEMAP|FLYING|Frame )/.test(line)) return '#f5c542';
    if (/^#{1,3}\s/.test(line)) return '#9b8dff';
    if (/^\s*[-*]\s/.test(line)) return '#a09cc8';
    return '#d8d4f2';
  }

  /** Pull hex colours out of a palette string so we can show real swatches. */
  function swatches(text) {
    const found = String(text || '').match(/#[0-9a-f]{6}/gi);
    return found ? found.slice(0, 6) : [];
  }

  /**
   * Build the SVG.
   * @param {{title, prompt, negative, meta, palette}} spec
   */
  function build(spec) {
    const cols = 96;
    const lines = wrap(spec.prompt, cols).slice(0, 78);
    const negLines = spec.negative ? wrap(spec.negative, cols).slice(0, 5) : [];
    const chips = swatches(spec.palette);

    const headH = 84;
    const bodyH = Math.max(lines.length * LINE + 34, 120);
    const negH = negLines.length ? negLines.length * LINE + 34 : 0;
    const footH = 44;
    const H = PAD + headH + 14 + bodyH + (negH ? 14 + negH : 0) + 14 + footH + PAD;

    const bodyY = PAD + headH + 14;
    const negY = bodyY + bodyH + 14;
    const footY = H - PAD - footH;

    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${H}" viewBox="0 0 ${WIDTH} ${H}" font-family="${SANS}">`);
    parts.push(`<rect width="${WIDTH}" height="${H}" fill="#0d0c18" rx="18"/>`);
    parts.push(`<rect x="1" y="1" width="${WIDTH - 2}" height="${H - 2}" fill="none" stroke="#2b2850" rx="17"/>`);

    /* header */
    parts.push(`<rect x="${PAD}" y="${PAD}" width="${WIDTH - PAD * 2}" height="${headH}" fill="#17162a" rx="12"/>`);
    parts.push(`<rect x="${PAD}" y="${PAD}" width="5" height="${headH}" fill="#7c6af7" rx="2.5"/>`);
    parts.push(`<text x="${PAD + 22}" y="${PAD + 30}" font-size="11" font-weight="700" fill="#9b8dff" letter-spacing="2.4">PIXELFORGE SPEC SHEET</text>`);
    parts.push(`<text x="${PAD + 22}" y="${PAD + 56}" font-size="19" font-weight="800" fill="#e9e7f8">${xml(spec.title || 'Prompt')}</text>`);
    if (spec.meta) {
      parts.push(`<text x="${PAD + 22}" y="${PAD + 74}" font-size="11.5" fill="#a09cc8">${xml(spec.meta)}</text>`);
    }
    chips.forEach((hex, i) => {
      const cx = WIDTH - PAD - 22 - (chips.length - 1 - i) * 30;
      parts.push(`<rect x="${cx - 11}" y="${PAD + 44}" width="22" height="22" fill="${xml(hex)}" stroke="#2b2850" rx="5"/>`);
    });
    if (chips.length) {
      parts.push(`<text x="${WIDTH - PAD - 22}" y="${PAD + 32}" font-size="9.5" font-weight="700" fill="#6f6b98" text-anchor="end" letter-spacing="1.6">PALETTE</text>`);
    }

    /* prompt body */
    parts.push(`<rect x="${PAD}" y="${bodyY}" width="${WIDTH - PAD * 2}" height="${bodyH}" fill="#0a0913" stroke="#221f42" rx="12"/>`);
    parts.push(`<text x="${PAD + 18}" y="${bodyY + 21}" font-size="9.5" font-weight="700" fill="#7c6af7" letter-spacing="1.8">POSITIVE PROMPT</text>`);
    lines.forEach((line, i) => {
      if (!line) return;
      parts.push(`<text x="${PAD + 18}" y="${bodyY + 40 + i * LINE}" font-family="${MONO}" font-size="11" fill="${lineColor(line)}" xml:space="preserve">${xml(line)}</text>`);
    });

    /* negative prompt */
    if (negLines.length) {
      parts.push(`<rect x="${PAD}" y="${negY}" width="${WIDTH - PAD * 2}" height="${negH}" fill="#120a0d" stroke="#3a1a1e" rx="12"/>`);
      parts.push(`<text x="${PAD + 18}" y="${negY + 21}" font-size="9.5" font-weight="700" fill="#f87171" letter-spacing="1.8">NEGATIVE PROMPT</text>`);
      negLines.forEach((line, i) => {
        parts.push(`<text x="${PAD + 18}" y="${negY + 40 + i * LINE}" font-family="${MONO}" font-size="11" fill="#9c6a6a" xml:space="preserve">${xml(line)}</text>`);
      });
    }

    /* footer */
    parts.push(`<line x1="${PAD}" y1="${footY}" x2="${WIDTH - PAD}" y2="${footY}" stroke="#221f42"/>`);
    parts.push(`<text x="${PAD}" y="${footY + 26}" font-size="11" fill="#4c4776">Forged in PixelForge — offline prompt studio for game developers</text>`);
    parts.push(`<text x="${WIDTH - PAD}" y="${footY + 26}" font-size="11" fill="#4c4776" text-anchor="end">${xml(new Date().toLocaleDateString())}</text>`);

    parts.push('</svg>');
    return parts.join('\n');
  }

  /** Build and download the sheet. */
  function download(spec) {
    const svg = build(spec);
    const name = 'pixelforge-' + String(spec.title || 'prompt')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) + '-spec.svg';
    U.download(name, svg, 'image/svg+xml;charset=utf-8');
    return name;
  }

  global.PF = global.PF || {};
  global.PF.specCard = { build, download };
})(typeof window !== 'undefined' ? window : globalThis);
