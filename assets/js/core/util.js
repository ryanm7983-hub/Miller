/* ===========================================================================
   PixelForge — shared helpers: DOM, escaping, clipboard, toast, modal, ink.
   Classic script (no modules) so the app runs straight from file://.
   =========================================================================== */
(function (global) {
  'use strict';

  /* ── DOM ───────────────────────────────────────────────────────────────── */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  /**
   * Resolve an asset path. Normally a passthrough; when the app has been built
   * into a single self-contained file, `PF_IMG` maps sprite names to inline
   * data URIs and this swaps them in. Keeps call sites free of build concerns.
   */
  function assetUrl(p) {
    const map = global.PF_IMG;
    if (!map || typeof p !== 'string' || p.indexOf('assets/img/') !== 0) return p;
    const key = p.slice('assets/img/'.length).replace(/\.svg$/, '');
    return map[key] || p;
  }

  /** Create an element from a tag, props and children. */
  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(k => {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.keys(v).forEach(d => { node.dataset[d] = v[d]; });
        else if (k === 'src') node.setAttribute('src', assetUrl(v));
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (Array.isArray(children) ? children : children != null ? [children] : []).forEach(c => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  /** Escape text for safe interpolation into innerHTML. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Read a trimmed value from a form control by id. */
  function val(id) {
    const node = document.getElementById(id);
    return node ? String(node.value).trim() : '';
  }

  function setVal(id, v) {
    const node = document.getElementById(id);
    if (node) node.value = v;
  }

  /* ── clipboard ─────────────────────────────────────────────────────────── */
  /* navigator.clipboard is unavailable on file:// in some browsers, so this
     falls back to a hidden textarea + execCommand. Always resolves a boolean. */
  function copy(text) {
    if (!text) return Promise.resolve(false);
    const fallback = () => {
      try {
        const ta = el('textarea', { style: 'position:fixed;top:-2000px;left:-2000px;opacity:0' });
        ta.value = text;
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (_) { return false; }
    };
    if (global.navigator && navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => fallback());
    }
    return Promise.resolve(fallback());
  }

  /** Copy and surface the result as a toast. */
  function copyToast(text, okMsg) {
    return copy(text).then(ok => {
      toast(ok ? (okMsg || 'Copied to clipboard') : 'Copy failed — select the text and press Ctrl+C', ok ? 'ok' : 'err');
      return ok;
    });
  }

  /* ── toast ─────────────────────────────────────────────────────────────── */
  const TOAST_MAX = 3;

  function toast(msg, kind) {
    let host = document.getElementById('toast-host');
    if (!host) { host = el('div', { id: 'toast-host' }); document.body.appendChild(host); }

    /* Collapse a repeat of the message that is already showing. */
    const existing = host.lastElementChild;
    if (existing && existing.dataset.msg === msg && !existing.classList.contains('out')) return;

    const node = el('div', { class: 'toast ' + (kind || ''), text: msg });
    node.dataset.msg = msg;
    host.appendChild(node);

    /* Keep the stack short so it never blankets the page. */
    while (host.children.length > TOAST_MAX) host.firstElementChild.remove();

    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 220);
    }, 2400);
  }

  /* ── modal ─────────────────────────────────────────────────────────────── */
  let openModals = 0;

  /**
   * Show a modal. `content` is an element. Returns a close() function.
   * Closes on backdrop click and Escape; restores focus to the opener.
   */
  function modal(content, opts) {
    opts = opts || {};
    const opener = document.activeElement;
    const box = el('div', { class: 'modal' + (opts.wide ? ' modal-wide' : ''), role: 'dialog', 'aria-modal': 'true', style: 'position:relative' });
    if (opts.label) box.setAttribute('aria-label', opts.label);
    if (opts.closable !== false) {
      box.appendChild(el('button', { class: 'modal-x', type: 'button', 'aria-label': 'Close', text: '✕', onclick: () => close() }));
    }
    box.appendChild(content);

    const back = el('div', { class: 'modal-back' }, box);
    back.addEventListener('mousedown', e => { if (e.target === back && opts.closable !== false) close(); });

    function onKey(e) {
      if (e.key === 'Escape' && opts.closable !== false) close();
      if (e.key === 'Tab') trapFocus(e, box);
    }

    function close() {
      document.removeEventListener('keydown', onKey);
      back.remove();
      openModals = Math.max(0, openModals - 1);
      if (!openModals) document.body.style.overflow = '';
      if (opener && opener.focus) opener.focus();
      if (opts.onClose) opts.onClose();
    }

    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    openModals++;
    document.body.style.overflow = 'hidden';

    const first = box.querySelector('input, select, textarea, button:not(.modal-x), a[href]');
    (first || box.querySelector('.modal-x') || box).focus?.();

    return close;
  }

  function trapFocus(e, root) {
    const items = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
      .filter(n => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /** Confirm dialog that resolves to a boolean (replaces window.confirm). */
  function confirmDialog(title, body, confirmLabel) {
    return new Promise(resolve => {
      let done = false;
      const finish = v => { if (done) return; done = true; close(); resolve(v); };
      const pane = el('div', { class: 'modal-pad stack' }, [
        el('h3', { style: 'font-size:18px', text: title }),
        el('p', { class: 'card-sub', text: body }),
        el('div', { class: 'row', style: 'justify-content:flex-end;margin-top:6px' }, [
          el('button', { class: 'btn btn-ghost', type: 'button', text: 'Cancel', onclick: () => finish(false) }),
          el('button', { class: 'btn btn-primary', type: 'button', text: confirmLabel || 'Confirm', onclick: () => finish(true) })
        ])
      ]);
      const close = modal(pane, { label: title, onClose: () => finish(false) });
    });
  }

  /* ── ink accents (inlined so they inherit currentColor) ────────────────── */
  const INK = {
    underline: '<svg viewBox="0 0 200 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9c14-3 28 2 42-1s26-4 40-1 28 4 42 1 24-4 34-2" opacity=".9"/><path d="M12 13c18-2 30 1 46-1s30-3 44-1 26 3 40 1" opacity=".45"/></svg>',
    star: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4c.6 5.2 2.1 8.4 5.4 10.1 3.3 1.7 6.1 1.6 6.1 1.9 0 .4-3.3.4-6.4 2.2C18 20 16.6 23.1 16 28c-.7-5-2.2-8.2-5.3-9.9C7.6 16.4 4.5 16.4 4.5 16c0-.3 2.9-.2 6.2-1.9C14 12.4 15.4 9.2 16 4Z"/></svg>',
    arrow: '<svg viewBox="0 0 64 40" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 30c8-11 18-19 32-21 8-1 16 1 24 5"/><path d="M52 4c3.4 3.1 6.6 6 8 10-4.4.6-8.6 1.6-12.6 3.4"/></svg>',
    sparkles: '<svg viewBox="0 0 72 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 20c3.4-.5 5-2.2 5.6-6 .7 3.8 2.3 5.5 5.7 6-3.4.6-5 2.3-5.7 6-.6-3.7-2.2-5.4-5.6-6Z"/><path d="M36 12c2.4-.4 3.5-1.6 4-4.3.5 2.7 1.6 3.9 4 4.3-2.4.4-3.5 1.6-4 4.3-.5-2.7-1.6-3.9-4-4.3Z"/><path d="M50 30c2.8-.5 4.1-1.9 4.7-5 .6 3.1 1.9 4.5 4.7 5-2.8.5-4.1 1.9-4.7 5-.6-3.1-1.9-4.5-4.7-5Z"/></svg>',
    divider: '<svg viewBox="0 0 320 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 12c22-4 44 3 66-1s40-5 62-1 42 4 62 0 44-3 66 2" opacity=".7"/><path d="M152 6c1.3 3.4 2.6 5 6 6-3.4 1.2-4.7 2.8-6 6-1.3-3.2-2.6-4.8-6-6 3.4-1 4.7-2.6 6-6Z"/></svg>'
  };

  /** Replace every <span class="ink" data-ink="name"> with its inline SVG. */
  function paintInk(root) {
    $$('.ink[data-ink]', root || document).forEach(node => {
      const svg = INK[node.dataset.ink];
      if (svg && !node.firstChild) node.innerHTML = svg;
    });
  }

  /* ── misc ──────────────────────────────────────────────────────────────── */
  const fmtDate = ts => {
    try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (_) { return ''; }
  };

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(self, args), ms == null ? 180 : ms);
    };
  }

  /** Trigger a client-side file download from a string. No network involved. */
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  global.PF = global.PF || {};
  global.PF.util = {
    $, $$, el, esc, val, setVal, assetUrl,
    copy, copyToast, toast, modal, confirmDialog,
    paintInk, INK, fmtDate, debounce, download
  };
})(typeof window !== 'undefined' ? window : globalThis);
