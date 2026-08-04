/* ===========================================================================
   PixelForge — persisted application state.

   Everything lives in localStorage under a single namespaced key so the app is
   fully offline and portable. Every read is defensive: corrupt or missing data
   falls back to defaults rather than throwing, and a browser with storage
   disabled degrades to an in-memory store for the session.
   =========================================================================== */
(function (global) {
  'use strict';

  const KEY = 'pixelforge.v4';

  const DEFAULTS = {
    version: 4,
    theme: null,               // null = follow the viewer's system preference
    sound: true,               // chiptune SFX on user actions
    soundNudged: false,        // whether we've explained the mute control
    seenLanding: false,
    plan: 'free',              // 'free' | 'pro'
    trialStartedAt: null,
    usage: { day: '', prompts: 0 },
    themeLock: null,           // active theme-lock object
    library: [],               // saved prompts
    prefs: {}                  // per-panel sticky settings
  };

  /* A memory shim keeps the app working when localStorage is unavailable
     (private mode, disabled storage, some file:// configurations). */
  const memory = {};
  const backing = (function () {
    try {
      const probe = '__pf_probe__';
      global.localStorage.setItem(probe, '1');
      global.localStorage.removeItem(probe);
      return global.localStorage;
    } catch (_) {
      return {
        getItem: k => (k in memory ? memory[k] : null),
        setItem: (k, v) => { memory[k] = String(v); },
        removeItem: k => { delete memory[k]; }
      };
    }
  })();

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  let state = load();

  function load() {
    let raw = null;
    try { raw = backing.getItem(KEY); } catch (_) { /* ignore */ }
    if (!raw) return clone(DEFAULTS);
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { return clone(DEFAULTS); }
    if (!parsed || typeof parsed !== 'object') return clone(DEFAULTS);

    // Shallow-merge over defaults so new keys appear for existing users.
    const merged = clone(DEFAULTS);
    Object.keys(DEFAULTS).forEach(k => {
      if (parsed[k] !== undefined && parsed[k] !== null) merged[k] = parsed[k];
    });
    if (!Array.isArray(merged.library)) merged.library = [];
    if (typeof merged.usage !== 'object' || !merged.usage) merged.usage = clone(DEFAULTS.usage);
    if (typeof merged.prefs !== 'object' || !merged.prefs) merged.prefs = {};
    if (merged.plan !== 'pro' && merged.plan !== 'free') merged.plan = 'free';
    return merged;
  }

  function save() {
    try { backing.setItem(KEY, JSON.stringify(state)); }
    catch (_) { /* quota or disabled storage — state stays in memory */ }
    emit();
  }

  /* ── change notification ───────────────────────────────────────────────── */
  const listeners = [];
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }
  function emit() { listeners.slice().forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

  /* ── accessors ─────────────────────────────────────────────────────────── */
  function get(key) { return state[key]; }

  function set(key, value) { state[key] = value; save(); }

  function pref(namespace, key, value) {
    if (!state.prefs[namespace]) state.prefs[namespace] = {};
    if (value === undefined) return state.prefs[namespace][key];
    state.prefs[namespace][key] = value;
    save();
  }

  /* ── library ───────────────────────────────────────────────────────────── */
  function addToLibrary(entry) {
    const item = Object.assign({
      id: 'pf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      createdAt: Date.now()
    }, entry);
    state.library.unshift(item);
    if (state.library.length > 500) state.library.length = 500;
    save();
    return item;
  }

  function removeFromLibrary(id) {
    const i = state.library.findIndex(x => x.id === id);
    if (i > -1) { state.library.splice(i, 1); save(); return true; }
    return false;
  }

  function clearLibrary() { state.library = []; save(); }

  /* ── usage counter (resets each local day) ─────────────────────────────── */
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function usageToday() {
    if (state.usage.day !== today()) {
      state.usage = { day: today(), prompts: 0 };
      save();
    }
    return state.usage.prompts;
  }

  function bumpUsage(n) {
    usageToday();
    state.usage.prompts += (n == null ? 1 : n);
    save();
    return state.usage.prompts;
  }

  function resetUsage() { state.usage = { day: today(), prompts: 0 }; save(); }

  /* ── wholesale reset (used by the account panel) ───────────────────────── */
  function resetAll() {
    state = clone(DEFAULTS);
    try { backing.removeItem(KEY); } catch (_) { /* ignore */ }
    save();
  }

  function exportJSON() { return JSON.stringify(state, null, 2); }

  global.PF = global.PF || {};
  global.PF.store = {
    get, set, pref, onChange,
    addToLibrary, removeFromLibrary, clearLibrary,
    usageToday, bumpUsage, resetUsage,
    resetAll, exportJSON,
    get raw() { return state; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
