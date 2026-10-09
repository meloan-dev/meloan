// Motion and interaction helpers (no libraries). Everything checks the Motion setting:
// with Motion off, content appears in place and nothing moves on its own.
import { play } from './sfx.js';

export const motionOn = () => document.documentElement.classList.contains('motion');
const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

// ---------- scroll reveal ----------
let io = null;
function observer() {
  io ??= new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); e.target.dispatchEvent(new CustomEvent('reveal')); }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
  return io;
}
export function reveal(el, delay = 0) {
  el.classList.add('rv'); el.style.setProperty('--rv-d', `${delay}ms`);
  if (!motionOn()) { el.classList.add('in'); queueMicrotask(() => el.dispatchEvent(new CustomEvent('reveal'))); return el; }
  observer().observe(el); return el;
}
export const onReveal = (el, fn) => { if (el.classList.contains('in')) fn(); else el.addEventListener('reveal', fn, { once: true }); };

// Applied after every route render: panels and cards rise in, cards tilt, primary buttons are magnetic.
export function enhance(root) {
  const seen = new Map();
  for (const el of root.querySelectorAll('.page > section, .page > .split > *, .page > .two > *, .bay, .step, [data-reveal]')) {
    if (el.classList.contains('rv') || el.closest('.no-rv')) continue;
    const parent = el.parentElement; const i = seen.get(parent) || 0; seen.set(parent, i + 1);
    reveal(el, Math.min(i, 8) * 70);
  }
  for (const el of root.querySelectorAll('.bay, [data-tilt]')) tilt(el);
  for (const el of root.querySelectorAll('.btn.primary, [data-magnetic]')) magnetic(el);
}

// ---------- 3D tilt with a moving glare ----------
export function tilt(el, max = 7) {
  if (el.dataset.tiltOn) return; el.dataset.tiltOn = '1';
  el.addEventListener('pointermove', (e) => {
    if (!motionOn() || !finePointer()) return;
    const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - y) * max}deg`); el.style.setProperty('--ry', `${(x - 0.5) * max}deg`);
    el.style.setProperty('--gx', `${x * 100}%`); el.style.setProperty('--gy', `${y * 100}%`);
    el.classList.add('tilting');
  });
  el.addEventListener('pointerleave', () => { el.classList.remove('tilting'); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); });
}

// ---------- magnetic buttons ----------
export function magnetic(el, pull = 0.28) {
  if (el.dataset.magOn) return; el.dataset.magOn = '1';
  el.addEventListener('pointermove', (e) => {
    if (!motionOn() || !finePointer()) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${(e.clientX - (r.left + r.width / 2)) * pull}px`);
    el.style.setProperty('--my', `${(e.clientY - (r.top + r.height / 2)) * pull}px`);
  });
  el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
}

// ---------- number count-up ----------
export function countUp(el, to, fmt, dur = 1400) {
  if (!motionOn() || !Number.isFinite(to)) { el.textContent = fmt(to); return; }
  const start = performance.now(); let lastTick = 0;
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur); const e = 1 - Math.pow(1 - k, 4);
    el.textContent = fmt(to * e);
    if (k < 1) { if (now - lastTick > 70) { play('count'); lastTick = now; } requestAnimationFrame(step); }
  };
  requestAnimationFrame(step);
}

// ---------- decode / scramble text ----------
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/\\';
export function scramble(el, text, dur = 900) {
  if (!motionOn()) { el.textContent = text; return; }
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur); const n = Math.floor(k * text.length);
    el.textContent = text.slice(0, n) + [...text.slice(n)].map((c) => (c === ' ' || c === '·' ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- headline split into words that fly in ----------
export function splitWords(text, cls = '') {
  return text.split(' ').map((w, i) => [i ? ' ' : '', Object.assign(document.createElement('span'), { className: `w ${cls}`, textContent: w, style: `--wi:${i}` })]).flat();
}

// ---------- terminal typewriter ----------
export async function typeLines(pre, lines, { speed = 14, sound = true } = {}) {
  pre.textContent = '';
  if (!motionOn()) { pre.textContent = lines.join('\n'); return; }
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      pre.textContent += line[i];
      if (sound && i % 3 === 0 && line[i] !== ' ') play('type');
      await new Promise((r) => setTimeout(r, line.startsWith('$') ? speed * 2.4 : speed));
    }
    pre.textContent += '\n';
    await new Promise((r) => setTimeout(r, line.startsWith('$') ? 260 : 40));
  }
}

// ---------- starfield canvas (hero) ----------
export function starfield(canvas) {
  const cx = canvas.getContext('2d'); let w = 0, hgt = 0, dpr = 1, raf = 0, visible = true;
  const stars = Array.from({ length: 260 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), c: Math.random() < 0.15 ? '#EE916E' : Math.random() < 0.3 ? '#7D8BFF' : '#FFF4DF' }));
  let px = 0, py = 0, tx = 0, ty = 0, warp = 0, warpTo = 0, scrollV = 0;
  const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); w = canvas.clientWidth; hgt = canvas.clientHeight; canvas.width = w * dpr; canvas.height = hgt * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(0); };
  function draw(dt) {
    cx.clearRect(0, 0, w, hgt);
    px += (tx - px) * 0.05; py += (ty - py) * 0.05; warp += (warpTo - warp) * 0.06;
    const speed = (0.025 + warp * 0.9 + scrollV * 0.25) * dt; scrollV *= 0.92;
    const f = Math.max(w, hgt) * 0.6;
    for (const s of stars) {
      s.z -= speed; if (s.z <= 0.02) { s.z = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; }
      const k = f / (s.z * 4 + 0.2);
      const x = w / 2 + (s.x + px * (1 - s.z) * 0.15) * k, y = hgt / 2 + (s.y + py * (1 - s.z) * 0.15) * k;
      if (x < -20 || x > w + 20 || y < -20 || y > hgt + 20) continue;
      const a = Math.min(1, (1 - s.z) * 1.4); const r = (1 - s.z) * 1.8 + 0.2;
      cx.globalAlpha = a; cx.strokeStyle = cx.fillStyle = s.c;
      if (warp > 0.05) { const k2 = f / ((s.z + speed * 6) * 4 + 0.2); cx.lineWidth = r; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(w / 2 + (s.x + px * (1 - s.z) * 0.15) * k2, hgt / 2 + (s.y + py * (1 - s.z) * 0.15) * k2); cx.stroke(); }
      else { cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }
    }
    cx.globalAlpha = 1;
  }
  let last = performance.now();
  const loop = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; draw(dt * 2); raf = visible && motionOn() ? requestAnimationFrame(loop) : 0; };
  const kick = () => { if (!raf && visible && motionOn()) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const vis = new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); });
  vis.observe(canvas);
  const onMove = (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; };
  let lastY = scrollY; const onScroll = () => { scrollV = Math.min(0.6, scrollV + Math.abs(scrollY - lastY) * 0.0006); lastY = scrollY; };
  addEventListener('pointermove', onMove, { passive: true }); addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', resize);
  const mo = new MutationObserver(kick); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  requestAnimationFrame(() => { resize(); kick(); });
  return {
    warp(on) { warpTo = on ? 1 : 0; kick(); },
    destroy() { cancelAnimationFrame(raf); vis.disconnect(); mo.disconnect(); removeEventListener('pointermove', onMove); removeEventListener('scroll', onScroll); removeEventListener('resize', resize); },
  };
}

// ---------- cursor glow (desktop) ----------
export function cursorGlow() {
  if (!finePointer()) return;
  const g = Object.assign(document.createElement('div'), { className: 'cursor-glow' }); g.setAttribute('aria-hidden', 'true');
  document.body.append(g);
  let x = innerWidth / 2, y = innerHeight / 2, gx = x, gy = y, raf = 0;
  const loop = () => { gx += (x - gx) * 0.18; gy += (y - gy) * 0.18; g.style.transform = `translate(${gx}px, ${gy}px)`; raf = Math.abs(x - gx) + Math.abs(y - gy) > 0.5 ? requestAnimationFrame(loop) : 0; };
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; g.classList.toggle('hot', !!e.target.closest?.('a[href], button, .bay, .orb, [data-buddy]')); if (!raf && motionOn()) raf = requestAnimationFrame(loop); }, { passive: true });
}
