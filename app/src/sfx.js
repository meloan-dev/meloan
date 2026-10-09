// Interface sound for the whole app, synthesized with the Web Audio API (no audio files).
// On by default (Sound toggle in the header turns it off and remembers). Browsers only allow audio
// after the first tap or key press, so the engine unlocks itself on that first gesture.
let ctx = null, master = null, noiseBuf = null, enabled = true, lastHover = 0;

function boot() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = window.__audioCtx || new AC(); } catch (e) { return null; }
  window.__audioCtx = ctx;
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
function unlock() {
  if (!enabled || !boot()) return;
  if (ctx.state !== 'running') { try { const p = ctx.resume(); p?.catch?.(() => {}); } catch (e) { /* retried on the next gesture */ } }
}
const ready = () => enabled && ctx && ctx.state === 'running';
const t0 = () => ctx.currentTime;

function env(peak, a, d, at) {
  const g = ctx.createGain(); g.connect(master);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
  return g;
}
function tone(type, f0, f1, dur, peak, { at = t0(), a = 0.005, lp } = {}) {
  let out = env(peak, a, dur, at);
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.connect(out); out = f; }
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, at);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + a + dur);
  o.connect(out); o.start(at); o.stop(at + a + dur + 0.05);
}
function noise(ftype, f0, f1, dur, peak, { at = t0(), a = 0.004, q = 1 } = {}) {
  const g = env(peak, a, dur, at);
  const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(f0, at); f.Q.value = q; f.connect(g);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, at + a + dur);
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.connect(f); s.start(at, Math.random() * 0.5); s.stop(at + a + dur + 0.05);
}

const SOUNDS = {
  hover() { tone('sine', 2300, 2300, 0.035, 0.012, { a: 0.002 }); },
  click() { tone('sine', 620, 980, 0.06, 0.07); noise('highpass', 3000, 3000, 0.02, 0.03); },
  nav() { noise('bandpass', 300, 2400, 0.32, 0.07, { a: 0.12, q: 1.2 }); tone('sine', 523, 523, 0.12, 0.04, { at: t0() + 0.12 }); tone('sine', 784, 784, 0.18, 0.04, { at: t0() + 0.2 }); },
  toggleOn() { tone('sine', 660, 660, 0.07, 0.07); tone('sine', 990, 990, 0.12, 0.07, { at: t0() + 0.07 }); },
  toggleOff() { tone('sine', 880, 880, 0.07, 0.06); tone('sine', 520, 520, 0.12, 0.06, { at: t0() + 0.07 }); },
  success() { [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone('sine', f, f, 0.35, 0.06, { at: t0() + i * 0.07 })); },
  error() { tone('square', 196, 180, 0.12, 0.05, { lp: 1200 }); tone('square', 156, 140, 0.18, 0.05, { at: t0() + 0.14, lp: 1200 }); },
  warn() { tone('triangle', 988, 988, 0.08, 0.06); tone('triangle', 988, 988, 0.08, 0.06, { at: t0() + 0.14 }); },
  tick(v = 0.5) { const f = 500 + v * 900; tone('sine', f, f, 0.03, 0.035, { a: 0.002 }); },
  type() { noise('bandpass', 2400 + Math.random() * 1600, 1800, 0.025, 0.05, { a: 0.001, q: 2 }); },
  count() { const f = 1400 + Math.random() * 400; tone('sine', f, f, 0.02, 0.015, { a: 0.001 }); },
  coin() { noise('bandpass', 2500, 2500, 0.03, 0.12, { q: 3 }); tone('sine', 988, 988, 0.15, 0.07, { at: t0() + 0.04 }); tone('sine', 1319, 1319, 0.35, 0.07, { at: t0() + 0.12 }); },
  open() { tone('sine', 300, 700, 0.18, 0.04); noise('highpass', 2000, 6000, 0.18, 0.02, { a: 0.05 }); },
  close() { tone('sine', 700, 300, 0.15, 0.035); },
  shutter() { noise('highpass', 1800, 900, 0.06, 0.12); noise('bandpass', 900, 600, 0.08, 0.08, { at: t0() + 0.08 }); },
  wake() { tone('sawtooth', 220, 660, 0.45, 0.035, { lp: 1600 }); [784, 1175].forEach((f, i) => tone('sine', f, f, 0.3, 0.05, { at: t0() + 0.42 + i * 0.09 })); },
  warp() {
    tone('sawtooth', 80, 320, 1.0, 0.06, { a: 0.2, lp: 700 });
    noise('bandpass', 200, 3600, 0.8, 0.16, { a: 0.35, q: 1.1 });
    tone('sine', 523, 1047, 0.4, 0.04, { at: t0() + 0.7 });
  },
  // Buddy's robot voice: a few square-wave chirps with a mood
  voice(mood = 'happy') {
    const sets = { happy: [880, 1175, 1568], curious: [660, 990, 880, 1320], sleepy: [523, 440, 330], alarm: [1320, 990, 1320, 990], proud: [784, 988, 1175, 1568] };
    const ns = sets[mood] || sets.happy; const len = mood === 'sleepy' ? 0.16 : 0.07;
    ns.forEach((f, i) => { const j = f * (0.97 + Math.random() * 0.06); tone('square', j, j * (mood === 'curious' && i === ns.length - 1 ? 1.25 : 1), len, 0.03, { at: t0() + i * (len + 0.025), lp: 2600 }); });
  },
  boop() { tone('sine', 300, 140, 0.18, 0.12); noise('lowpass', 800, 300, 0.08, 0.06); },
};

export function play(name, ...args) {
  if (!ready()) return;
  if (name === 'hover') { const n = performance.now(); if (n - lastHover < 45) return; lastHover = n; }
  try { SOUNDS[name]?.(...args); } catch (e) { /* audio is decoration; never break the page */ }
}
export const soundOn = () => enabled;
export function setSound(on) { enabled = on; if (on) unlock(); }

// Delegated interface sounds for every page: hover, press, toggles, sliders, selects.
export function installUiSounds() {
  const opts = { capture: true, passive: true };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, unlock, opts);
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const target = (e) => e.target.closest?.('a[href], button, [role="tab"], summary, select, .bay, .orb');
  if (fine) addEventListener('pointerover', (e) => {
    const el = target(e); if (!el || el.contains(e.relatedTarget)) return;
    if (!el.disabled && el.getAttribute('aria-disabled') !== 'true') play('hover');
  }, opts);
  addEventListener('click', (e) => {
    const el = target(e); if (!el || el.dataset.sfx === 'none' || el.tagName === 'SELECT') return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return play('error');
    if (el.dataset.sfx) return;            // the component plays its own sound
    if (el.getAttribute('role') === 'tab' || el.closest('.tabs')) return play('tick', 0.7);
    if (el.tagName === 'SUMMARY') return play(el.parentElement.open ? 'close' : 'open');
    play('click');
  }, opts);
  addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') play('tick', 0.6); }, opts);
  // sliders: a tick per step, pitched by position
  addEventListener('input', (e) => {
    const r = e.target; if (r.type !== 'range') return;
    const v = (r.value - r.min) / ((r.max - r.min) || 1); play('tick', v);
  }, opts);
}
