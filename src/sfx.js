// Meloan scroll story — sound effects, all synthesized with the Web Audio API (no audio files).
// Sound preference and browser playback readiness are separate states.
export function createSfx({ onStateChange = () => {} } = {}) {
  let ctx = null, master = null, noiseBuf = null, enabled = false;
  const loops = {};

  function boot() {
    if (ctx && ctx.state !== 'closed') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = window.__audioCtx?.state !== 'closed' && window.__audioCtx || new AC();
    window.__audioCtx = ctx;               // ...and any later tap unlocks this same one
    ctx.addEventListener('statechange', () => onStateChange());
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    buildLoops();
  }

  // ---------- building blocks ----------
  const now = () => ctx.currentTime;
  const gainNode = (v = 0, to = master) => { const g = ctx.createGain(); g.gain.value = v; g.connect(to); return g; };
  const osc = (type, freq, to) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.connect(to); return o; };
  const noise = (to, loop = false) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop; s.connect(to); return s; };
  const filter = (type, freq, q = 0.7, to = master) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.connect(to); return f; };
  // attack/decay envelope on a fresh gain
  function env(peak, a, dcy, to = master, at = now()) {
    const g = ctx.createGain(); g.connect(to);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + dcy);
    return g;
  }
  function tone(type, f0, f1, dur, peak, { at = now(), a = 0.008, to = master } = {}) {
    const g = env(peak, a, dur, to, at);
    const o = osc(type, f0, g);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + a + dur);
    o.start(at); o.stop(at + a + dur + 0.05);
  }
  function burst(ftype, f0, f1, dur, peak, { at = now(), a = 0.01, q = 1 } = {}) {
    const g = env(peak, a, dur, master, at);
    const f = filter(ftype, f0, q, g);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, at + a + dur);
    const s = noise(f); s.start(at, Math.random()); s.stop(at + a + dur + 0.05);
  }

  // ---------- continuous beds ----------
  function buildLoops() {
    // rocket engine: low rumble + roar
    const eng = gainNode(0);
    const engF = filter('lowpass', 160, 0.8, eng);
    noise(engF, true).start();
    const sub = gainNode(0.5, eng); osc('sine', 42, sub).start();
    loops.engine = { g: eng, f: engF };
    // keeper drone rotors: two detuned buzzes through a band-pass
    const dr = gainNode(0);
    const drF = filter('bandpass', 950, 1.4, dr);
    const r1 = osc('sawtooth', 186, drF), r2 = osc('sawtooth', 191, drF);
    r1.start(); r2.start();
    loops.drone = { g: dr, oscs: [r1, r2] };
    // storm alarm: slow siren
    const al = gainNode(0);
    const alF = filter('lowpass', 1600, 0.7, al);
    const sir = osc('square', 640, alF);
    const lfo = osc('sine', 0.9, (() => { const lg = ctx.createGain(); lg.gain.value = 180; lg.connect(sir.frequency); return lg; })());
    sir.start(); lfo.start();
    loops.alarm = { g: al };
    // space: a deep, slow pad
    const sp = gainNode(0);
    const spF = filter('lowpass', 700, 0.5, sp);
    for (const f of [55, 82.4, 110.3]) osc('sine', f, spF).start();
    const shim = gainNode(0.25, sp); osc('triangle', 329.6, filter('lowpass', 900, 0.5, shim)).start();
    loops.space = { g: sp };
    // the Meloan platform: soft electric hum with a faint airy layer
    const pl = gainNode(0);
    for (const [f, v] of [[110, 0.6], [165, 0.35], [220, 0.2]]) { const g = gainNode(v, pl); osc('sine', f, g).start(); }
    const air = gainNode(0.35, pl); noise(filter('bandpass', 2400, 0.6, air), true).start();
    loops.platform = { g: pl };
    // portal: a wavering chord
    const po = gainNode(0);
    const trem = gainNode(0.5, po);
    for (const f of [261.6, 392, 523.3]) osc('sine', f, trem).start();
    const tl = ctx.createGain(); tl.gain.value = 0.35; tl.connect(trem.gain); osc('sine', 3.2, tl).start();
    loops.portal = { g: po };
  }
  function wake() {
    if (!ctx || document.hidden) return Promise.resolve(false);
    if (ctx.state === 'running') return Promise.resolve(true);
    // Call resume synchronously in the gesture; report readiness only once it finishes.
    try {
      return Promise.resolve(ctx.resume()).then(() => {
        onStateChange();
        return enabled && !document.hidden && ctx.state === 'running';
      }, () => { onStateChange(); return false; });
    } catch (e) { onStateChange(); return Promise.resolve(false); }
  }
  const set = (param, v, tc = 0.12) => param.setTargetAtTime(v, now(), tc);

  // ---------- one-shots ----------
  const shots = {
    ping() { // the signal from Meloan
      for (let i = 0; i < 3; i++) tone('sine', 1320, 1320, 0.9, 0.18 / (i + 1), { at: now() + i * 0.28 });
      tone('sine', 1980, 1980, 0.5, 0.05);
    },
    whoosh(len = 1, peak = 0.35) { burst('bandpass', 250, 2800, len * 0.55, peak, { a: len * 0.35, q: 1.2 }); },
    thud() { tone('sine', 110, 38, 0.45, 0.6); burst('lowpass', 500, 120, 0.3, 0.35); },
    hiss() { burst('highpass', 3500, 6000, 0.55, 0.12, { a: 0.03 }); tone('sine', 900, 600, 0.08, 0.05); },
    servo(up = false) {
      const g = env(0.06, 0.04, 0.55);
      const f = filter('lowpass', 1400, 1, g);
      const o = osc('sawtooth', up ? 420 : 300, f);
      o.frequency.linearRampToValueAtTime(up ? 300 : 460, now() + 0.55);
      o.start(); o.stop(now() + 0.7);
      tone('square', 1200, 1200, 0.03, 0.04, { at: now() + 0.6 });
    },
    step() { burst('lowpass', 900 + Math.random() * 300, 300, 0.07, 0.16, { a: 0.003 }); tone('sine', 150 + Math.random() * 30, 90, 0.06, 0.08, { a: 0.003 }); },
    clink() { const f = 1700 + Math.random() * 200; tone('triangle', f, f, 0.14, 0.07, { a: 0.002 }); tone('sine', f * 1.51, f * 1.51, 0.09, 0.03, { a: 0.002 }); },
    coinIn() { burst('bandpass', 2500, 2500, 0.04, 0.2, { a: 0.002, q: 3 }); tone('sine', 660, 660, 0.25, 0.12, { at: now() + 0.05 }); tone('sine', 990, 990, 0.5, 0.12, { at: now() + 0.16 }); },
    pop() { tone('sine', 380, 950, 0.14, 0.18); tone('sine', 1400, 1400, 0.3, 0.05, { at: now() + 0.1 }); },
    chime() { const scale = [784, 880, 1047, 1175, 1319, 1568]; const f = scale[(Math.random() * scale.length) | 0]; tone('sine', f, f, 0.5, 0.045, { a: 0.004 }); },
    zap() { tone('sawtooth', 1400, 180, 0.32, 0.08); burst('highpass', 1800, 900, 0.25, 0.08, { a: 0.004 }); },
    shield() { [392, 523, 659, 784, 1047].forEach((f, i) => tone('sine', f * 0.98, f, 0.9, 0.07, { at: now() + i * 0.07, a: 0.08 })); burst('bandpass', 1800, 5200, 0.8, 0.05, { a: 0.2, q: 2 }); },
    blips() { for (let i = 0; i < 5; i++) { const f = 900 + Math.random() * 900; tone('square', f, f, 0.04, 0.035, { at: now() + i * 0.09, a: 0.002 }); } },
    fuel() {
      const g = env(0.1, 0.1, 1.3);
      const o = osc('sine', 180, g); o.frequency.exponentialRampToValueAtTime(820, now() + 1.3);
      const wob = ctx.createGain(); wob.gain.value = 40; wob.connect(o.frequency); const l = osc('sine', 14, wob);
      o.start(); l.start(); o.stop(now() + 1.5); l.stop(now() + 1.5);
      tone('sine', 1046, 1046, 0.5, 0.08, { at: now() + 1.3 });
    },
    launch() { // the "Start the journey" button: ignition, a rising roar and a warp whoosh
      const g = env(0.16, 0.25, 1.3);
      const o = osc('sawtooth', 70, filter('lowpass', 500, 0.8, g)); o.frequency.exponentialRampToValueAtTime(260, now() + 1.5); o.start(); o.stop(now() + 1.7);
      burst('bandpass', 200, 3200, 0.9, 0.42, { a: 0.5, q: 1.1 });
      tone('sine', 523, 1047, 0.5, 0.06, { at: now() + 0.9 });
    },
    tick() { tone('sine', 880, 880, 0.12, 0.09, { a: 0.003 }); tone('sine', 1760, 1760, 0.08, 0.03, { a: 0.003 }); },
    plunge() { // falling into the black hole: a sub-bass that drops away, wind rushing toward the centre
      const g = env(0.3, 0.6, 1.9);
      const o = osc('sine', 90, g); o.frequency.exponentialRampToValueAtTime(28, now() + 2.4); o.start(); o.stop(now() + 2.6);
      const g2 = env(0.1, 0.4, 2.0);
      const o2 = osc('sawtooth', 220, filter('lowpass', 900, 1.2, g2)); o2.frequency.exponentialRampToValueAtTime(55, now() + 2.3); o2.start(); o2.stop(now() + 2.5);
      burst('bandpass', 3800, 160, 2.0, 0.35, { a: 0.35, q: 0.9 });
    },
    emerge() { // out of the white hole: a bright swell and a shimmering chord
      burst('highpass', 600, 5000, 1.2, 0.3, { a: 0.04 });
      [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => tone('sine', f, f, 1.6, 0.06, { at: now() + 0.05 + i * 0.05, a: 0.03 }));
      tone('sine', 65, 130, 0.9, 0.18, { a: 0.02 });
    },
    glitch() { const f = 80 + Math.random() * 600; tone('square', f, f * 0.7, 0.05, 0.035, { a: 0.002 }); },
    // Buddy's little robot voice
    voice(kind) {
      const t = now();
      const say = (notes, type = 'square', len = 0.09, peak = 0.05) => notes.forEach((f, i) => tone(type, f, f, len, peak, { at: t + i * (len + 0.02), a: 0.005, to: filter('lowpass', 2600, 0.7) }));
      switch (kind) {
        case 'happy': say([660, 880, 1175]); break;
        case 'worried': say([700, 560, 420], 'triangle', 0.13, 0.07); break;
        case 'shake': say([300, 260, 300, 260], 'square', 0.06, 0.04); break;
        case 'wave': say([523, 659, 784, 1047], 'triangle', 0.08, 0.07); break;
        case 'nod': say([600, 760], 'triangle', 0.08, 0.06); break;
        case 'hop': tone('sine', 280, 720, 0.18, 0.12); tone('sine', 720, 300, 0.2, 0.1, { at: t + 0.2 }); break;
        default: say([520, 520], 'triangle', 0.06, 0.04);
      }
    },
  };

  return {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = !!on;
      try { if (on) boot(); } catch (e) { enabled = false; }
      if (!ctx) { enabled = false; onStateChange(); return Promise.resolve(false); }
      master.gain.cancelScheduledValues(now());
      master.gain.setTargetAtTime(on ? 0.8 : 0, now(), 0.15);
      onStateChange();
      return on ? wake() : Promise.resolve(false);
    },
    // browsers keep audio paused until the visitor taps or presses a key; call this on every such gesture
    unlock() { return enabled ? wake() : Promise.resolve(false); },
    suspend(hidden) {
      if (!ctx) return;
      if (hidden) {
        try { Promise.resolve(ctx.suspend()).catch(() => {}).then(() => {
          // A fast tab switch can finish suspending after the tab is visible again.
          if (!document.hidden && enabled) wake();
          onStateChange();
        }); } catch (e) { onStateChange(); }
      } else if (enabled) wake();
      onStateChange();
    },
    // Intro/button cues may wait briefly for resume, but never replay stale effects later.
    playWhenReady(name, ...args) {
      const requestedAt = Date.now();
      return (enabled ? wake() : Promise.resolve(false)).then(ready => {
        if (ready && enabled && !document.hidden && ctx.state === 'running' && Date.now() - requestedAt < 1000 && shots[name]) shots[name](...args);
      });
    },
    // every frame: levels 0..1 for the continuous beds
    update({ engine = 0, drone = 0, droneSpeed = 0, alarm = 0, space = 0, platform = 0, portal = 0 }) {
      if (!ctx || !enabled || document.hidden || ctx.state !== 'running') return;
      set(loops.engine.g.gain, engine * 0.32); set(loops.engine.f.frequency, 140 + engine * 520);
      set(loops.drone.g.gain, drone * (0.018 + Math.min(1, droneSpeed / 4) * 0.025));
      loops.drone.oscs.forEach((o, i) => set(o.frequency, (186 + i * 5) * (1 + Math.min(1, droneSpeed / 4) * 0.25), 0.2));
      set(loops.alarm.g.gain, alarm * 0.035, 0.3);
      set(loops.space.g.gain, space * 0.07, 0.5);
      set(loops.platform.g.gain, platform * 0.022, 0.5);
      set(loops.portal.g.gain, portal * 0.018, 0.3);
    },
    play(name, ...args) { if (ctx && enabled && !document.hidden && ctx.state === 'running' && shots[name]) shots[name](...args); },
    get running() { return !!ctx && !document.hidden && ctx.state === 'running'; },
  };
}
