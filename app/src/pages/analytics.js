import { h, s, kv, money, pct, numberField, range } from '../ui.js';
import { pageHead, marketSelect, marketList, pickMarket } from '../components.js';
import { getState } from '../store.js';
import { borrowAPR, lenderAPRFrom, lossWaterfall, revenueSplit, lenderAssets, utilization, fmtNum } from '../engine.js';

export const title = 'Analytics';

export function render(params) {
  let mId = pickMarket(params.market);
  const m = () => getState().markets[mId];
  let u = 0.5;
  const chart = h('div', { class: 'chart' }); const rateOut = h('div');
  const wfOut = h('div'); const othersOut = h('div'); const revOut = h('div');
  const switchTo = (v) => { mId = v; ms.sel.value = v; calc(); };
  const ms = marketSelect({ value: mId, onChange: switchTo });
  const utilR = range({ label: 'Utilization', min: 0, max: 100, step: 1, value: 50, format: (v) => `${v}%`, onInput: (v) => { u = v / 100; calc(); } });
  const reserveF = numberField({ label: 'Reserve balance', suffix: 'USDG', decimals: 0, value: '5000', allowZero: true, onInput: calc });
  const depF = numberField({ label: 'Lender deposits in this market', suffix: 'USDG', decimals: 0, value: '100000', onInput: calc });
  const badF = numberField({ label: 'Bad debt (unrecoverable)', suffix: 'USDG', decimals: 0, value: '8000', allowZero: true, onInput: calc });
  const revF = numberField({ label: 'Realised protocol revenue', suffix: 'USDG', decimals: 2, value: '1000', allowZero: true, onInput: calc });

  function rateChart(mm) {
    const W = 560, H = 220, L = 44, B = 30, T = 14, R = 14;
    const X = (x) => L + x * (W - L - R), Y = (y) => H - B - (y / Math.max(mm.rate.max, 0.01)) * (H - B - T);
    const pts = Array.from({ length: 101 }, (_, i) => i / 100);
    const path = (f) => pts.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(f(x)).toFixed(1)}`).join('');
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    const yt = [0, mm.rate.max / 2, mm.rate.max];
    return s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Borrow and lender APR across utilization for ${mm.symbol}; at ${pct(u, 0)} utilization borrow APR is ${pct(borrowAPR(mm, u))}` },
      ...yt.map((y) => s('g', {}, s('line', { x1: L, x2: W - R, y1: Y(y), y2: Y(y), class: 'c-grid' }), s('text', { x: L - 6, y: Y(y) + 4, class: 'c-lab', 'text-anchor': 'end' }, pct(y, 0)))),
      ...ticks.map((x) => s('text', { x: X(x), y: H - 10, class: 'c-lab', 'text-anchor': 'middle' }, pct(x, 0))),
      s('line', { x1: X(mm.rate.kink), x2: X(mm.rate.kink), y1: T, y2: H - B, class: 'c-kink' }),
      s('text', { x: X(mm.rate.kink) + 6, y: T + 12, class: 'c-lab' }, `kink ${pct(mm.rate.kink, 0)}`),
      s('path', { d: path((x) => borrowAPR(mm, x)), class: 'c-borrow' }),
      s('path', { d: path((x) => lenderAPRFrom(borrowAPR(mm, x), x)), class: 'c-lend' }),
      s('line', { x1: X(u), x2: X(u), y1: T, y2: H - B, class: 'c-now' }),
      s('circle', { cx: X(u), cy: Y(borrowAPR(mm, u)), r: 5, class: 'c-dot-b' }),
      s('circle', { cx: X(u), cy: Y(lenderAPRFrom(borrowAPR(mm, u), u)), r: 5, class: 'c-dot-l' }));
  }

  function calc() {
    const mm = m();
    chart.replaceChildren(rateChart(mm), h('div', { class: 'legend' }, h('span', { class: 'lg-b' }, 'Borrow APR'), h('span', { class: 'lg-l' }, 'Lender APR (est.)'), h('span', { class: 'muted small' }, 'This market\'s rate model.')));
    const bApr = borrowAPR(mm, u);
    const dep = depF.read(); const supplied = dep.ok ? dep.value : 0;
    rateOut.replaceChildren(kv([
      ['Borrow APR', pct(bApr)], ['Lender APR (est.)', pct(lenderAPRFrom(bApr, u), 2)],
      ['Available liquidity at this utilization', money(supplied * (1 - u))],
      ['Lender withdrawals possible now', u >= 0.999 ? 'None until repayments arrive' : `Up to ${money(supplied * (1 - u))}`],
    ]));
    const res = reserveF.read(); const bad = badF.read(); const LA = supplied;
    if (res.ok && bad.ok) {
      const w = lossWaterfall({ badDebt: bad.value, reserve: res.value, lenderAssets: LA });
      const tot = Math.max(bad.value, 1);
      wfOut.replaceChildren(
        h('div', { class: 'wf-bar', role: 'img', 'aria-label': `Of ${money(bad.value)} bad debt, the reserve absorbs ${money(w.fromReserve)} and lenders lose ${money(w.toLenders)}` },
          h('span', { class: 'wf-res', style: { width: `${(w.fromReserve / tot) * 100}%` } }), h('span', { class: 'wf-lend', style: { width: `${(w.toLenders / tot) * 100}%` } })),
        h('ol', { class: 'wf-steps' },
          h('li', {}, h('strong', {}, `1. ${money(bad.value, 0)} recognised as bad debt`), ' in the ', mm.symbol, ' market — no longer shown as a performing loan.'),
          h('li', {}, h('strong', { class: 'res' }, `2. Reserve absorbs ${money(w.fromReserve, 0)}`), ` (reserve ${money(res.value, 0)} → ${money(w.reserveAfter, 0)}).`),
          h('li', {}, h('strong', { class: 'lend' }, `3. Lenders absorb ${money(w.toLenders, 0)}`), ` — ${pct(w.lenderLossPct, 2)} of ${mm.symbol} lender assets (${money(LA, 0)} → ${money(w.lenderAssetsAfter, 0)}), shared pro rata by value per share.`)),
        h('p', { class: 'small muted' }, 'A reserve is a limited buffer, not insurance or a guarantee of principal.'));
      othersOut.replaceChildren(h('h3', {}, 'Other markets: unaffected'),
        h('p', { class: 'small muted' }, marketList().filter((x) => x.id !== mm.id).map((x) => x.symbol).join(' · ')));
    } else { wfOut.replaceChildren(h('p', { class: 'muted' }, 'Enter a reserve and a bad-debt amount (0 or more).')); othersOut.replaceChildren(); }
    const rv = revF.read();
    revOut.replaceChildren(rv.ok ? kv([['To this market’s reserve (60%)', money(revenueSplit(rv.value).reserve)], ['To operations, security, development (40%)', money(revenueSplit(rv.value).operations)]]) : '',
      h('p', { class: 'small muted' }, 'Only collected fees and the protocol’s share of paid interest count as revenue. Lender principal, collateral and unpaid interest are never revenue.'));
  }

  const el = h('div', { class: 'page' },
    pageHead({ title: 'Market analytics', eyebrow: 'Rates and risk', lead: 'See how each market prices borrowing as utilization moves, and how its reserve absorbs bad debt before its lenders do.' }),
    h('div', { class: 'split' },
      h('section', { class: 'panel', 'aria-labelledby': 'rate-h' }, h('h2', { id: 'rate-h' }, 'Rates and liquidity'), ms.el, depF.el, utilR.el, chart, rateOut),
      h('section', { class: 'panel', 'aria-labelledby': 'wf-h' }, h('h2', { id: 'wf-h' }, 'Loss waterfall'),
        h('div', { class: 'two' }, reserveF.el, badF.el), wfOut, othersOut)),
    h('section', { class: 'panel', 'aria-labelledby': 'rev-h' }, h('h2', { id: 'rev-h' }, 'Revenue split'), h('div', { class: 'two' }, revF.el, revOut)));
  calc();
  return { el, update() { ms.refresh(mId); if (!getState().markets[mId]) switchTo(pickMarket(null)); calc(); } };
}
