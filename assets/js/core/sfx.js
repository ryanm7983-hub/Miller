/* ===========================================================================
   PixelForge — chiptune sound effects, synthesised in the browser.

   No audio files: every sound is built from oscillators and a noise buffer at
   call time, so this costs nothing to ship and keeps the offline guarantee.
   Sounds only ever fire in response to a user action — nothing is ambient,
   nothing autoplays.
   =========================================================================== */
(function (global) {
  'use strict';

  const store = global.PF.store;

  let ctx = null;
  let master = null;

  /* Browsers require a user gesture before audio starts, which suits us —
     the first sound is always triggered by a click. */
  function audio() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.18;          // deliberately quiet
      master.connect(ctx.destination);
    } catch (_) { ctx = null; }
    return ctx;
  }

  function enabled() { return store.get('sound') !== false; }

  function setEnabled(on) {
    store.set('sound', !!on);
    if (on) play('toggle');
  }

  /** One oscillator note with an envelope, optionally pitch-sliding. */
  function note(opts) {
    const c = audio();
    if (!c) return;
    const t0 = c.currentTime + (opts.delay || 0);
    const dur = opts.dur == null ? 0.08 : opts.dur;

    const osc = c.createOscillator();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);

    const gain = c.createGain();
    const vol = opts.vol == null ? 0.5 : opts.vol;
    /* Fast attack, exponential decay — the classic chiptune envelope. */
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Filtered noise burst — used for the anvil strike. */
  function noise(opts) {
    const c = audio();
    if (!c) return;
    const t0 = c.currentTime + (opts.delay || 0);
    const dur = opts.dur == null ? 0.09 : opts.dur;

    const frames = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = opts.freq || 2200;
    filter.Q.value = opts.q || 1.2;

    const gain = c.createGain();
    gain.gain.setValueAtTime(opts.vol == null ? 0.35 : opts.vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ── the kit ───────────────────────────────────────────────────────────── */
  const SOUNDS = {
    click:  () => note({ freq: 620, dur: 0.035, vol: 0.28 }),
    toggle: () => note({ freq: 880, dur: 0.05, vol: 0.3, type: 'triangle' }),

    /* Anvil: a dull body thud with a bright metallic ring on top. */
    forge: () => {
      noise({ freq: 1800, dur: 0.07, vol: 0.4, q: 0.8 });
      note({ freq: 180, slideTo: 90, dur: 0.13, vol: 0.5, type: 'triangle' });
      note({ freq: 2100, slideTo: 1500, dur: 0.22, vol: 0.16, type: 'triangle', delay: 0.02 });
    },

    /* Two-note coin pickup. */
    coin: () => {
      note({ freq: 988, dur: 0.06, vol: 0.32 });
      note({ freq: 1319, dur: 0.13, vol: 0.32, delay: 0.06 });
    },

    /* Rising arpeggio for unlocking Forge Master. */
    fanfare: () => {
      [523, 659, 784, 1047].forEach((f, i) =>
        note({ freq: f, dur: i === 3 ? 0.3 : 0.11, vol: 0.3, delay: i * 0.085 }));
    },

    /* Dice tumble. */
    roll: () => {
      for (let i = 0; i < 5; i++) {
        noise({ freq: 900 + Math.random() * 1400, dur: 0.035, vol: 0.22, delay: i * 0.045 });
      }
      note({ freq: 740, dur: 0.1, vol: 0.26, delay: 0.24, type: 'triangle' });
    },

    error: () => note({ freq: 240, slideTo: 110, dur: 0.2, vol: 0.3, type: 'sawtooth' }),
    open:  () => note({ freq: 440, slideTo: 660, dur: 0.09, vol: 0.24, type: 'triangle' }),
    close: () => note({ freq: 660, slideTo: 400, dur: 0.08, vol: 0.2, type: 'triangle' })
  };

  let nudged = false;

  function play(name) {
    if (!enabled()) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try { fn(); } catch (_) { /* audio is never worth breaking the app over */ }

    /* The very first sound explains itself, so nobody has to hunt for a mute. */
    if (!nudged && name !== 'toggle') {
      nudged = true;
      if (!store.get('soundNudged')) {
        store.set('soundNudged', true);
        setTimeout(() => global.PF.util.toast('Sound on — click 🔊 in the header to mute', 'ok'), 260);
      }
    }
  }

  global.PF = global.PF || {};
  global.PF.sfx = { play, enabled, setEnabled };
})(typeof window !== 'undefined' ? window : globalThis);
