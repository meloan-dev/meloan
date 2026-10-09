// Mission patch maker: Buddy on a round crew patch with your callsign. Saves a PNG.
import { h } from './ui.js';
import { play } from './sfx.js';
import { toast } from './ui.js';

const STYLES = {
  nebula: { label: 'Nebula', bg: ['#2a2f8f', '#0d1130'], accent: '#EE916E', ring: '#7D8BFF' },
  grid: { label: 'Hyper grid', bg: ['#151a52', '#05071a'], accent: '#7D8BFF', ring: '#6FE3A5' },
  sun: { label: 'Coral sun', bg: ['#3a1f4a', '#0d1130'], accent: '#EE916E', ring: '#FFF4DF' },
};

export function patchMaker() {
  let style = 'nebula', callsign = 'HODL PILOT', seed = 7;
  const img = new Image(); img.src = 'assets/buddy.webp';
  const cv = h('canvas', { class: 'patch-cv', width: 640, height: 640, role: 'img', 'aria-label': 'Mission patch preview' });
  const input = h('input', { type: 'text', id: 'patch-name', maxlength: 14, value: callsign, autocomplete: 'off', spellcheck: 'false', oninput: () => { callsign = input.value.toUpperCase().replace(/[^A-Z0-9 .\-]/g, '').slice(0, 14) || 'CREW'; play('type'); draw(); } });
  const chips = Object.entries(STYLES).map(([k, v]) => h('button', { type: 'button', class: 'pill', 'aria-pressed': String(k === style), 'data-sfx': 'own', onclick: () => { style = k; chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.k === k))); play('tick', 0.8); draw(); }, 'data-k': k }, v.label));
  const shuffle = h('button', { type: 'button', class: 'btn ghost', 'data-sfx': 'own', onclick: () => { seed = (Math.random() * 1e6) | 0; play('coin'); cv.classList.remove('flip'); void cv.offsetWidth; cv.classList.add('flip'); draw(); } }, 'Shuffle stars');
  const save = h('button', { type: 'button', class: 'btn primary', 'data-sfx': 'own', onclick: doSave }, 'Save patch (PNG)');

  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function draw() {
    const c = cv.getContext('2d'); const W = cv.width, R = W / 2, st = STYLES[style]; const keep = seed;
    c.clearRect(0, 0, W, W);
    c.save(); c.beginPath(); c.arc(R, R, R - 6, 0, Math.PI * 2); c.clip();
    const g = c.createRadialGradient(R * 0.8, R * 0.6, 20, R, R, R); g.addColorStop(0, st.bg[0]); g.addColorStop(1, st.bg[1]); c.fillStyle = g; c.fillRect(0, 0, W, W);
    if (style === 'grid') {
      c.strokeStyle = 'rgba(125,139,255,.45)'; c.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const y = R * 1.1 + Math.pow(i / 13, 2) * R; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      for (let i = -10; i <= 10; i++) { c.beginPath(); c.moveTo(R + i * 14, R * 1.1); c.lineTo(R + i * 120, W); c.stroke(); }
    }
    if (style === 'sun') {
      const sg = c.createLinearGradient(0, R * 0.2, 0, R * 1.3); sg.addColorStop(0, '#FFD3B8'); sg.addColorStop(1, '#EE916E');
      c.fillStyle = sg; c.beginPath(); c.arc(R, R * 0.95, R * 0.62, 0, Math.PI * 2); c.fill();
      c.fillStyle = st.bg[1]; for (let i = 0; i < 6; i++) c.fillRect(0, R * 1.0 + i * 26, W, 6 + i * 2.5);
    }
    if (style === 'nebula') {
      for (let i = 0; i < 4; i++) { const ng = c.createRadialGradient(rnd() * W, rnd() * W, 0, R, R, R * 0.9); ng.addColorStop(0, i % 2 ? 'rgba(238,145,110,.35)' : 'rgba(125,139,255,.35)'); ng.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = ng; c.fillRect(0, 0, W, W); }
    }
    for (let i = 0; i < 90; i++) { c.globalAlpha = 0.3 + rnd() * 0.7; c.fillStyle = rnd() < 0.2 ? st.accent : '#FFF4DF'; c.beginPath(); c.arc(rnd() * W, rnd() * W * 0.75, rnd() * 2.2 + 0.4, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    if (img.complete && img.naturalWidth) { const bw = W * 0.56; c.shadowColor = 'rgba(125,139,255,.6)'; c.shadowBlur = 40; c.drawImage(img, R - bw / 2, R * 0.5, bw, bw * 508 / 520); c.shadowBlur = 0; }
    c.restore();
    // rims and ring text
    c.lineWidth = 16; c.strokeStyle = st.bg[1]; c.beginPath(); c.arc(R, R, R - 14, 0, 7); c.stroke();
    c.lineWidth = 5; c.strokeStyle = st.ring; c.beginPath(); c.arc(R, R, R - 8, 0, 7); c.stroke();
    c.lineWidth = 3; c.strokeStyle = st.accent; c.beginPath(); c.arc(R, R, R - 66, 0, 7); c.stroke();
    ringText(c, `MELOAN · KEEP THE MEME · UNLOCK THE LIQUIDITY ·`, R, R - 40, -Math.PI / 2 - 1.95, 3.9, st.ring, 24);
    c.fillStyle = st.accent; c.font = '700 44px "Chakra Petch", Arial, sans-serif'; c.textAlign = 'center';
    const bw = c.measureText(callsign).width + 48; c.fillStyle = st.bg[1]; roundRect(c, R - bw / 2, W - 150, bw, 64, 32); c.fill();
    c.strokeStyle = st.accent; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#FFF4DF'; c.fillText(callsign, R, W - 103);
    seed = keep;
  }
  function ringText(c, text, cx, r, start, span, color, size) {
    c.save(); c.fillStyle = color; c.font = `700 ${size}px "JetBrains Mono", monospace`; c.textAlign = 'center';
    const step = span / text.length;
    [...text].forEach((ch, i) => { const a = start + i * step; c.save(); c.translate(cx + r * Math.cos(a), cx + r * Math.sin(a)); c.rotate(a + Math.PI / 2); c.fillText(ch, 0, size / 3); c.restore(); });
    c.restore();
  }
  const roundRect = (c, x, y, w, hh, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

  async function doSave() {
    play('shutter');
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    if (!blob) return toast('The patch could not be rendered.', 'bad');
    const name = `meloan-patch-${callsign.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    let dl = null;
    try { dl = window.claude?.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({ filename: name, data: blob }); toast('Patch saved. Welcome to the crew.'); }
      catch (e) { if (e?.code !== 'declined') toast('Saving is not available here. Right-click the patch to copy it instead.', 'bad'); }
      return;
    }
    const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove();
    toast('Patch saved. Welcome to the crew.');
  }

  img.onload = draw; draw();
  document.fonts?.ready?.then(draw);
  return h('div', { class: 'patch' },
    h('div', { class: 'patch-stage' }, cv),
    h('div', { class: 'patch-ctl' },
      h('div', { class: 'field' }, h('label', { for: 'patch-name' }, 'Your callsign'), h('div', { class: 'field-box' }, input)),
      h('p', { class: 'small muted' }, 'Backdrop'), h('div', { class: 'pill-row' }, chips),
      h('div', { class: 'btn-row' }, save, shuffle)));
}
