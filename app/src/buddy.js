// Interactive Buddy: his eye follows the pointer, he blinks, sleeps until woken, answers taps,
// and shows a mood (calm / nervous / panic) that the loan preview drives from position health.
import { h, s } from './ui.js';
import { play } from './sfx.js';
import { motionOn } from './fx.js';

let seq = 0;
const QUIPS = [
  'Beep. I never sell my memes. I borrow against them.',
  'Health above 1.0 keeps my bolts on.',
  'Every market is its own bay. Leaks stay put.',
  'Repay any time. Collateral comes home.',
  'Opening fee: 0.5%. Shown before you sign. Always.',
  'No auto-listing. I check every token at the airlock.',
  'Lenders earn from real borrowing, not from magic.',
  'Not financial advice. I am a robot.',
  'Tap faster and I might do a barrel roll.',
];

export function buddy({ size = 320, sleeping = false, label = 'Buddy, the Meloan mascot. Tap him.' } = {}) {
  const id = `bd${++seq}`;
  // Cover the raster visor completely with one smooth, shared SVG contour.
  const screen = { x: 155, y: 83, width: 228, height: 136, rx: 43 };
  const C = { x: 269, y: 151 };              // iris centre in the artwork (520 × 508)
  const lid = s('g', { class: 'bd-lid' },
    s('circle', { cx: C.x, cy: C.y, r: 62, fill: `url(#${id}-iris)` }),
    s('circle', { cx: C.x, cy: C.y, r: 60, fill: 'none', stroke: '#2a3fc0', 'stroke-width': 5, opacity: 0.7 }),
    s('circle', { class: 'bd-pupil', cx: C.x + 6, cy: C.y, r: 33, fill: '#0a1238' }),
    s('circle', { cx: C.x + 37, cy: C.y - 24, r: 12, fill: '#fff' }),
    s('circle', { cx: C.x + 20, cy: C.y + 24, r: 5, fill: '#fff', opacity: 0.55 }));
  const eye = s('g', { class: 'bd-eye' }, lid);
  const sleepLine = s('path', { class: 'bd-sleep', d: `M${C.x - 58} ${C.y + 4} Q${C.x} ${C.y + 38} ${C.x + 58} ${C.y + 4}`, fill: 'none', stroke: '#5b78ff', 'stroke-width': 9, 'stroke-linecap': 'round' });
  const svg = s('svg', { class: 'bd-face', viewBox: '0 0 520 508', 'aria-hidden': 'true' },
    s('defs', {},
      s('radialGradient', { id: `${id}-iris`, cx: '0.42', cy: '0.38', r: '0.7' }, s('stop', { offset: '0', 'stop-color': '#6f8dff' }), s('stop', { offset: '0.55', 'stop-color': '#3256ee' }), s('stop', { offset: '1', 'stop-color': '#2238b8' })),
      s('clipPath', { id: `${id}-scr` }, s('rect', screen))),
    // The inset bezel masks the irregular painted edge behind the live eye.
    s('rect', { x: 151, y: 79, width: 236, height: 144, rx: 47, fill: '#e8d1b5' }),
    s('rect', { ...screen, fill: '#101a3b' }),
    s('g', { 'clip-path': `url(#${id}-scr)` }, eye, sleepLine, s('rect', { class: 'bd-alarm', ...screen, fill: '#ff4d6a' })),
    s('path', { class: 'bd-sweat', d: 'M402 70 q14 22 0 30 q-14 -8 0 -30z', fill: '#9fd8ff' }));
  const bubble = h('p', { class: 'bd-bubble', role: 'status', 'aria-live': 'polite' });
  const zzz = h('span', { class: 'bd-zzz', 'aria-hidden': 'true' }, h('i', {}, 'z'), h('i', {}, 'z'), h('i', {}, 'Z'));
  const body = h('button', { type: 'button', class: 'bd-body', 'data-buddy': '', 'data-sfx': 'own', 'aria-label': label, style: { width: `${size}px` } },
    h('img', { src: 'assets/buddy.webp', alt: '', width: 520, height: 508, draggable: 'false' }), svg);
  const el = h('div', { class: `bd ${sleeping ? 'asleep' : ''}` }, zzz, bubble, body, h('span', { class: 'bd-shadow', 'aria-hidden': 'true' }));

  let awake = !sleeping, taps = 0, tapTimer = 0, bubbleTimer = 0, quip = 0, mood = 'calm', destroyed = false;
  const say = (text, ms = 3200) => { bubble.textContent = text; bubble.classList.add('show'); clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms); };
  const look = (dx, dy) => { eye.style.transform = `translate(${dx}px, ${dy}px)`; };

  // eye tracking
  const onMove = (e) => {
    if (!awake || destroyed) return;
    const r = body.getBoundingClientRect(); if (!r.width) return;
    const ex = r.left + r.width * (C.x / 520), ey = r.top + r.height * (C.y / 508);
    const ang = Math.atan2(e.clientY - ey, e.clientX - ex); const dist = Math.min(1, Math.hypot(e.clientX - ex, e.clientY - ey) / 260);
    look(Math.cos(ang) * 40 * dist, Math.sin(ang) * 20 * dist);
  };
  addEventListener('pointermove', onMove, { passive: true });

  // blinking
  let blinkT = 0;
  const blink = () => { if (destroyed) return; if (awake && mood !== 'panic') { lid.classList.add('blink'); setTimeout(() => lid.classList.remove('blink'), 140); } blinkT = setTimeout(blink, 2600 + Math.random() * 3600); };
  blinkT = setTimeout(blink, 2000);

  function wake(quiet = false) {
    if (awake) return; awake = true; el.classList.remove('asleep'); el.dispatchEvent(new Event('wake')); el.classList.add('waking');
    setTimeout(() => el.classList.remove('waking'), 900);
    if (!quiet) { play('wake'); setTimeout(() => play('voice', 'happy'), 450); }
    say('Systems online. Hi, I’m Buddy. Tap me, I talk.');
  }
  function sleep() { awake = false; el.classList.add('asleep'); look(0, 0); }

  body.addEventListener('click', () => {
    if (!awake) return wake();
    taps++; clearTimeout(tapTimer); tapTimer = setTimeout(() => { taps = 0; }, 900);
    el.classList.remove('boing', 'roll'); void el.offsetWidth;
    if (taps >= 5) { taps = 0; el.classList.add('roll'); play('warp'); setTimeout(() => play('voice', 'proud'), 500); say('Barrel roll complete. Now go read the risks.'); return; }
    el.classList.add('boing'); play('boop'); setTimeout(() => play('voice', ['happy', 'curious', 'proud'][quip % 3]), 120);
    say(QUIPS[quip++ % QUIPS.length]);
  });

  return {
    el, wake, sleep, say, get awake() { return awake; },
    setMood(m) {
      if (m === mood) return; const prev = mood; mood = m;
      el.dataset.mood = m;
      if (m === 'panic' && prev !== 'panic') { play('voice', 'alarm'); say('Health below 1.0! This loan could be liquidated.', 3600); }
      else if (m === 'nervous' && prev === 'calm') { play('voice', 'curious'); say('Thin buffer. A small price drop could hurt.', 3000); }
      else if (m === 'calm' && prev !== 'calm') { play('voice', 'happy'); say('Phew. Healthy again.', 2200); }
    },
    destroy() { destroyed = true; clearTimeout(blinkT); clearTimeout(bubbleTimer); removeEventListener('pointermove', onMove); },
  };
}
export const motionAllowed = motionOn;
