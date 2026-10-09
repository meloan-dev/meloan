// Small DOM helpers and shared components (no framework).
import { fmtNum, parseAmount } from './engine.js';
import { play } from './sfx.js';
import { LOGOS } from './logos.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  setProps(el, props);
  append(el, kids);
  return el;
}
const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag, props, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(props || {})) if (v != null && v !== false) el.setAttribute(k, v);
  append(el, kids);
  return el;
}
function setProps(el, props) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
}
export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

// ---------- formatting ----------
export const money = (v, d = 2) => `${fmtNum(v, d)} USDG`;
export const pct = (v, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—');
export const units = (v, sym, d = 2) => `${fmtNum(v, d)} ${sym}`;
export const healthText = (hv) => (hv.state === 'none' ? 'No debt' : `${Number.isFinite(hv.value) ? hv.value.toFixed(2) : '—'} · ${hv.label}`);
export const ageText = (sec) => (sec < 60 ? `${sec}s ago` : `${Math.round(sec / 60)} min ago`);

// ---------- chips ----------
export const stateChip = (state, label) => h('span', { class: `chip chip-${state}` }, label);
export function healthChip(hv) {
  const st = { none: 'info', ok: 'ok', warn: 'warn', edge: 'warn', liq: 'bad' }[hv.state];
  return stateChip(st, hv.state === 'none' ? 'No debt' : hv.label);
}

// ---------- live announcements + toasts ----------
let live;
export function announce(msg) {
  live ??= document.getElementById('live');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = msg; }, 30);
}
export function toast(msg, kind = 'ok', action) {
  const host = document.getElementById('toasts');
  const t = h('div', { class: `toast toast-${kind}`, role: 'status' }, h('span', {}, msg), action ? h('a', { href: action.href, class: 'toast-link' }, action.label) : null,
    h('button', { class: 'toast-x', 'aria-label': 'Dismiss', onclick: () => t.remove() }, '×'));
  host.append(t);
  play(kind === 'bad' ? 'error' : kind === 'warn' ? 'warn' : 'success');
  announce(msg);
  setTimeout(() => t.classList.add('out'), 6000);
  setTimeout(() => t.remove(), 6600);
}

// ---------- number field with validation beside the field (MLN 03) ----------
let fieldSeq = 0;
export function numberField({ label, suffix, decimals = 2, value = '', max, hint, onInput, allowZero = false, placeholder = '0.00' }) {
  const id = `f${++fieldSeq}`;
  const err = h('p', { class: 'field-err', id: `${id}-err`, 'aria-live': 'polite' });
  const hintEl = hint ? h('p', { class: 'field-hint', id: `${id}-hint` }, hint) : null;
  const input = h('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', value: String(value), placeholder, 'aria-describedby': `${id}-err${hint ? ` ${id}-hint` : ''}` });
  const maxBtn = max ? h('button', { type: 'button', class: 'field-max', onclick: () => { const m = max(); input.value = m > 0 ? String(Math.floor(m * 10 ** decimals) / 10 ** decimals) : '0'; input.dispatchEvent(new Event('input')); } }, 'Max') : null;
  const wrap = h('div', { class: 'field' },
    h('label', { for: id }, label),
    h('div', { class: 'field-box' }, input, suffix ? h('span', { class: 'field-suffix' }, suffix) : null, maxBtn),
    hintEl, err);
  const api = {
    el: wrap, input,
    read(extra = {}) {
      const r = parseAmount(input.value, { decimals, allowZero, ...extra });
      api.setError(r.ok ? '' : r.error);
      return r;
    },
    setError(msg) { err.textContent = msg; wrap.classList.toggle('invalid', !!msg); input.setAttribute('aria-invalid', msg ? 'true' : 'false'); },
    set(v) { input.value = v; },
  };
  input.addEventListener('input', () => onInput && onInput(api));
  return api;
}

export function select({ label, options, value, onChange }) {
  const id = `f${++fieldSeq}`;
  const sel = h('select', { id, onchange: () => onChange && onChange(sel.value) }, options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  return { el: h('div', { class: 'field' }, h('label', { for: id }, label), h('div', { class: 'field-box select' }, sel)), sel };
}
export function range({ label, min, max, step, value, format, onInput }) {
  const id = `f${++fieldSeq}`;
  const out = h('output', { for: id, class: 'range-out' }, format(value));
  const inp = h('input', { id, type: 'range', min, max, step, value, oninput: () => { out.textContent = format(Number(inp.value)); onInput && onInput(Number(inp.value)); } });
  return { el: h('div', { class: 'field range' }, h('div', { class: 'range-top' }, h('label', { for: id }, label), out), inp), input: inp, set(v) { inp.value = v; out.textContent = format(v); } };
}

// ---------- modal with focus trap, Escape to close, focus restore (MLN 34) ----------
export function modal({ title, body, actions }) {
  const opener = document.activeElement;
  const titleId = `m${++fieldSeq}`;
  const dlg = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('div', { class: 'modal-card panel' }, h('h2', { id: titleId }, title), body, h('div', { class: 'modal-actions' }, actions)));
  const close = () => { play('close'); dlg.remove(); document.removeEventListener('keydown', onKey); opener && opener.focus && opener.focus(); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...dlg.querySelectorAll('button, a[href], input, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  };
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(dlg);
  play('open');
  (dlg.querySelector('[data-autofocus]') || dlg.querySelector('button')).focus();
  return { close, el: dlg };
}

// ---------- health gauge ----------
export function gauge() {
  const W = 260, R = 84, cx = 130, cy = 112;
  const pt = (a, r) => [cx + r * Math.cos(Math.PI * (1 - a)), cy - r * Math.sin(Math.PI * (1 - a))];
  const arc = (a0, a1) => { const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R); return `M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}`; };
  // scale: health 0 … 3 mapped to 0 … 1
  const f = (hv) => Math.min(1, Math.max(0, hv / 3));
  // a tick every 0.5; labels at 0, 1.0 (liquidation), 2.0 and 3.0+, set just outside the arc
  const ticks = [0, 0.5, 1, 1.5, 2, 2.5, 3].map((v) => { const [x0, y0] = pt(f(v), R - 9), [x1, y1] = pt(f(v), R - (v % 1 ? 13 : 16)); return s('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: `g-mark ${v === 1 ? 'key' : ''}` }); });
  const labels = [[0, '0'], [1, '1.0'], [2, '2.0'], [3, '3.0+']].map(([v, t]) => {
    const a = f(v); const [x, y] = pt(a, R + 16);
    return s('text', { x, y, class: `g-tick ${v === 1 ? 'key' : ''}`, 'text-anchor': a < 0.3 ? 'end' : a > 0.7 ? 'start' : 'middle', 'dominant-baseline': 'middle' }, t);
  });
  const needle = s('line', { x1: cx, y1: cy, x2: cx, y2: cy - R + 16, class: 'g-needle' });
  const svg = s('svg', { viewBox: `0 0 ${W} 124`, class: 'gauge', 'aria-hidden': 'true' },
    s('path', { d: arc(0, f(1)), class: 'g-bad' }), s('path', { d: arc(f(1), f(1.2)), class: 'g-warn' }), s('path', { d: arc(f(1.2), 1), class: 'g-ok' }),
    ...ticks, ...labels, needle, s('circle', { cx, cy, r: 6, class: 'g-hub' }));
  return {
    el: svg,
    set(hv) {
      const v = hv.state === 'none' ? 1 : f(hv.value);
      needle.style.transform = `rotate(${(v - 0.5) * 180}deg)`;
      svg.dataset.state = hv.state;
    },
  };
}

// ---------- key/value telemetry rows ----------
export function kv(rows) {
  return h('dl', { class: 'kv' }, rows.filter(Boolean).map(([k, v, cls]) => h('div', { class: `kv-row ${cls || ''}` }, h('dt', {}, k), h('dd', {}, v))));
}
export const coinImg = (m, size = 40) => {
  if (m.face) return h('img', { class: 'coin', src: `assets/coin-${m.face}.webp`, alt: '', width: size, height: size });
  const letter = h('span', { class: 'coin coin-letter', style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.42)}px` }, 'aria-hidden': 'true' }, (m.symbol || '?').slice(0, 2));
  const local = m.id && LOGOS.has(m.id) ? `assets/tokens/${m.id}.webp` : '';
  if (!local && !m.image) return letter;
  const img = h('img', { class: 'coin', src: local || m.image, alt: '', width: size, height: size, loading: 'lazy', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => img.replaceWith(letter));
  return img;
};
export const qs = (params) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.set(k, v); const q = u.toString(); return q ? `?${q}` : ''; };
