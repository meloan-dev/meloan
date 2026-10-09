// Live price chart for one Robinhood Chain × USDG pool (GeckoTerminal OHLCV). Loading, error and empty states included.
import { h, s } from './ui.js';
import { fmtPrice } from './engine.js';
import { fetchCandles, CHART_SOURCE } from './live.js';

const cache = new Map();   // pool|tf → { data, at }
const TFS = ['1D', '7D', '30D', '90D'];

export function priceChart(m) {
  let tf = '7D', seq = 0;
  const body = h('div', { class: 'pchart-body', 'aria-live': 'polite' });
  const meta = h('p', { class: 'small muted pchart-meta' });
  const tabs = TFS.map((k) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === tf), onclick: () => { tf = k; load(); } }, k));
  const el = h('section', { class: 'pchart panel', 'aria-label': `${m.symbol} price chart` },
    h('div', { class: 'panel-head' }, h('h3', {}, `${m.symbol} / USD price`), h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Time range' }, tabs)),
    body, meta);

  async function load(force = false) {
    tabs.forEach((b, i) => b.setAttribute('aria-selected', String(TFS[i] === tf)));
    const key = `${m.primaryPool}|${tf}`; const my = ++seq;
    const hit = cache.get(key);
    if (hit && !force && Date.now() - hit.at < 60000) return draw(hit.data);
    body.replaceChildren(h('div', { class: 'pchart-msg' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), `Loading ${tf} price history…`));
    try {
      const data = await fetchCandles(m.primaryPool, m.address || m.primarySide, tf);
      cache.set(key, { data, at: Date.now() });
      if (my === seq) draw(data);
    } catch (e) {
      if (my !== seq) return;
      body.replaceChildren(h('div', { class: 'pchart-msg' }, h('p', {}, e.message),
        h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn', onclick: () => load(true) }, 'Retry'),
          h('a', { class: 'btn ghost', href: `https://www.geckoterminal.com/robinhood/pools/${m.primaryPool}`, target: '_blank', rel: 'noopener' }, 'Open on GeckoTerminal ↗'))));
      meta.textContent = '';
    }
  }

  function draw({ rows, fetchedAt, snapshot }) {
    const W = 640, H = 240, L = 8, R = 64, T = 14, B = 26;
    const t0 = rows[0].t, t1 = rows.at(-1).t;
    const lo = Math.min(...rows.map((r) => r.l ?? r.c)), hi = Math.max(...rows.map((r) => r.h ?? r.c));
    const pad = (hi - lo) * 0.08 || hi * 0.05;
    const y0 = lo - pad, y1 = hi + pad;
    const X = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
    const Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    const up = rows.at(-1).c >= rows[0].o;
    const line = rows.map((r, i) => `${i ? 'L' : 'M'}${X(r.t).toFixed(1)} ${Y(r.c).toFixed(1)}`).join('');
    const area = `${line}L${X(t1).toFixed(1)} ${H - B}L${X(t0).toFixed(1)} ${H - B}Z`;
    const ticksY = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15];
    const fmtT = (t) => { const d = new Date(t); return tf === '1D' ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' }); };
    const ticksX = [0, 0.25, 0.5, 0.75, 1].map((f) => t0 + (t1 - t0) * f);
    const cross = s('g', { class: 'pc-cross', visibility: 'hidden' }, s('line', { y1: T, y2: H - B, class: 'pc-cross-l' }), s('circle', { r: 4, class: up ? 'pc-dot up' : 'pc-dot down' }));
    const tip = h('div', { class: 'pc-tip', hidden: true });
    const first = rows[0].o ?? rows[0].c, last = rows.at(-1).c, change = (last - first) / first;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: `pc ${up ? 'up' : 'down'}`, role: 'img', 'aria-label': `${m.symbol} price over ${tf}: from ${fmtPrice(first)} to ${fmtPrice(last)} USD, ${(change * 100).toFixed(1)}%` },
      s('defs', {}, s('linearGradient', { id: `pcg-${m.id.slice(2, 10)}`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: '0', class: 'pc-g0' }), s('stop', { offset: '1', class: 'pc-g1' }))),
      ...ticksY.map((v) => s('g', {}, s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'c-grid' }), s('text', { x: W - R + 6, y: Y(v) + 4, class: 'c-lab' }, fmtPrice(v)))),
      ...ticksX.map((t, i) => s('text', { x: X(t), y: H - 8, class: 'c-lab', 'text-anchor': i === 0 ? 'start' : i === 4 ? 'end' : 'middle' }, fmtT(t))),
      s('path', { d: area, fill: `url(#pcg-${m.id.slice(2, 10)})` }), s('path', { d: line, class: 'pc-line' }), cross);
    const wrap = h('div', { class: 'pc-wrap' }, svg, tip);
    const move = (ev) => {
      const rect = svg.getBoundingClientRect(); const x = ((ev.clientX - rect.left) / rect.width) * W;
      const t = t0 + ((x - L) / (W - L - R)) * (t1 - t0);
      let best = rows[0]; for (const r of rows) if (Math.abs(r.t - t) < Math.abs(best.t - t)) best = r;
      cross.setAttribute('visibility', 'visible');
      cross.firstChild.setAttribute('x1', X(best.t)); cross.firstChild.setAttribute('x2', X(best.t));
      cross.lastChild.setAttribute('cx', X(best.t)); cross.lastChild.setAttribute('cy', Y(best.c));
      tip.hidden = false;
      tip.textContent = `${new Date(best.t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${fmtPrice(best.c)} USD`;
      tip.style.left = `${Math.min(70, Math.max(0, (X(best.t) / W) * 100 - 15))}%`;
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; });
    body.replaceChildren(h('div', { class: 'pc-head' }, h('strong', { class: 'pc-last' }, `${fmtPrice(last)} USD`), h('span', { class: change >= 0 ? 'up' : 'down' }, `${change >= 0 ? '+' : ''}${(change * 100).toFixed(2)}% over ${tf}`)), wrap);
    meta.replaceChildren('Price history from ', h('a', { href: `https://www.geckoterminal.com/robinhood/pools/${m.primaryPool}`, target: '_blank', rel: 'noopener' }, CHART_SOURCE.name),
      ` (deepest ${m.primaryQuote || 'USDG'} pool) · ${snapshot ? `as of ${new Date(fetchedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : `loaded ${new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} · ${rows.length} candles. Past prices say nothing about future prices.`);
  }
  load();
  return { el };
}
