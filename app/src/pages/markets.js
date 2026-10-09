import { h, select } from '../ui.js';
import { pageHead, bayCard, marketList, emptyState, btn, liveStatus } from '../components.js';
import { CONFIG } from '../config.js';
import { scenarioOf } from '../store.js';
import { acceptedPrice } from '../engine.js';

export const title = 'Markets';

export function render(params) {
  if (params.m) { location.replace(`#/market?m=${params.m}`); }   // old deep links open the market page
  let q = params.q || '', avail = 'all', risk = 'all';
  const listEl = h('div', { class: 'bays' });
  const status = liveStatus();
  const note = h('div', { 'aria-live': 'polite' });

  const search = h('input', { type: 'search', id: 'mk-q', placeholder: 'Search by name or symbol', value: q, oninput: () => { q = search.value; draw(); } });
  const availSel = select({ label: 'Liquidity tier', value: avail, options: [{ value: 'all', label: 'All' }, { value: 'deep', label: 'Deep (≥ $1M)' }, { value: 'medium', label: 'Medium ($250k–$1M)' }, { value: 'thin', label: 'Thin (< $250k)' }], onChange: (v) => { avail = v; draw(); } });
  const riskSel = select({ label: 'Risk state', value: risk, options: [{ value: 'all', label: 'All' }, { value: 'ok', label: 'Price valid' }, { value: 'issue', label: 'Price issue' }], onChange: (v) => { risk = v; draw(); } });

  function matches(m) {
    const t = q.trim().toLowerCase();
    if (t && !`${m.symbol} ${m.name}`.toLowerCase().includes(t)) return false;
    const liq = m.stats?.liquidityUsd || 0; const tier = liq >= 1e6 ? 'deep' : liq >= 25e4 ? 'medium' : 'thin';
    if (avail !== 'all' && tier !== avail) return false;
    const issue = !acceptedPrice(m, scenarioOf(m.id)).valid;
    if (risk === 'ok' && issue) return false;
    if (risk === 'issue' && !issue) return false;
    return true;
  }
  function draw() {
    const all = marketList(); const found = all.filter(matches);
    if (!all.length) listEl.replaceChildren(emptyState({ title: 'No markets loaded', body: 'Market data could not be loaded. Try Refresh above.', actions: [] }));
    else if (!found.length) {
      const t = q.trim();
      listEl.replaceChildren(emptyState({
        title: 'No market matches',
        body: t && avail === 'all' && risk === 'all' ? `“${t}” has no Meloan market. Only curated Robinhood Chain meme tokens with a valid price and a USDG, ETH or WETH pool above $${(CONFIG.live.minLiquidityUsd / 1000).toFixed(0)}k liquidity are listed.` : 'No market fits these filters.',
        actions: [btn('Clear search and filters', { kind: 'primary', onclick: () => { q = ''; search.value = ''; avail = 'all'; risk = 'all'; availSel.sel.value = 'all'; riskSel.sel.value = 'all'; draw(); } })],
      }));
    } else listEl.replaceChildren(...found.map((m) => bayCard(m)));
    note.textContent = `${found.length} of ${all.length} markets shown.`;
    status.update();
  }
  const el = h('div', { class: 'page' },
    pageHead({ title: 'Markets', eyebrow: 'Robinhood Chain memes × USDG loans', lead: 'Meme tokens from the Robinhood ecosystem only. Borrow USDG against your memes, or lend to one isolated market. Prices come from qualifying USDG, ETH or WETH pools.' }),
    status.el,
    h('div', { class: 'filters panel' }, h('div', { class: 'field' }, h('label', { for: 'mk-q' }, 'Search'), h('div', { class: 'field-box' }, search)), availSel.el, riskSel.el),
    note,
    listEl);
  draw();
  return { el, update: draw };
}
