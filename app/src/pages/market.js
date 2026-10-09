// Market detail: one token's market on its own page (#/market?m=<token address>).
import { h, kv, money, pct, coinImg } from '../ui.js';
import { pageHead, bayCard, marketList, priceLine, btn, marketStatus, isLive, usd, chg, liveStatus } from '../components.js';
import { priceChart } from '../chart.js';
import { CONFIG } from '../config.js';
import { getState } from '../store.js';
import { fmtPrice } from '../engine.js';

export const title = (p) => { const m = getState().markets[(p.m || '').toLowerCase()]; return m ? `${m.symbol} / USDG` : 'Market'; };
const when = (t) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function render(params) {
  const id = (params.m || '').toLowerCase();
  const head = h('div'); const tiles = h('div', { class: 'md-tiles' }); const chartHost = h('div', { class: 'md-chart' });
  const params2 = h('div'); const onchain = h('div'); const others = h('div', { class: 'bays' });
  const status = liveStatus();
  let chartFor = null;

  function draw() {
    const m = getState().markets[id];
    if (!m || m.retired || !marketList().some(token => token.id === id)) {
      head.replaceChildren(pageHead({ title: 'Market not found', eyebrow: 'Markets', lead: 'Meloan lists curated Robinhood Chain meme tokens with a valid price and at least one qualifying USDG, ETH or WETH pool above $25k liquidity.' }),
        h('div', { class: 'btn-row' }, btn('Browse all markets', { kind: 'primary', href: '#/markets' })));
      [tiles, chartHost, params2, onchain, others].forEach((x) => x.replaceChildren());
      return;
    }
    const st = m.stats || {}; const ms = marketStatus(m); const ex = CONFIG.network.explorer;
    head.replaceChildren(
      h('a', { class: 'md-back', href: '#/markets' }, '← All markets'),
      h('div', { class: 'md-head' },
        coinImg(m, 72),
        h('div', { class: 'md-id' },
          h('div', { class: 'eyebrow-row' }, h('span', { class: 'eyebrow' }, 'Robinhood Chain × USDG'), h('span', { class: `chip chip-${ms.kind}` }, ms.label)),
          h('h1', {}, `${m.symbol} `, h('span', { class: 'md-pair' }, '/ USDG')),
          h('p', { class: 'muted' }, m.name, ' · ', h('a', { class: 'mono', href: `${ex}/token/${m.address}`, target: '_blank', rel: 'noopener' }, `${m.address.slice(0, 8)}…${m.address.slice(-6)} ↗`))),
        h('div', { class: 'md-price' },
          h('strong', {}, `${fmtPrice(m.price)} USDG`),
          h('span', {}, chg(st.change?.h24), h('span', { class: 'muted small' }, ' 24h')),
          h('span', { class: 'muted small' }, m.snapshot ? `As of ${when(m.fetchedAt)}` : 'Live'))),
      h('div', { class: 'btn-row md-actions' }, btn(`Borrow against ${m.symbol}`, { kind: 'primary', href: `#/borrow?market=${m.id}` }), btn(`Lend to ${m.symbol}`, { href: `#/lend?market=${m.id}` })));
    const tile = (k, v) => h('div', { class: 'md-tile' }, h('span', {}, k), h('strong', {}, v));
    tiles.replaceChildren(
      tile('Pool liquidity', usd(st.liquidityUsd)), tile('24h volume', usd(st.volume24)), tile('FDV', usd(st.fdv)),
      tile('Opening LTV', pct(m.openLTV, 0)), tile('Borrow cap', money(m.cap, 0)));
    if (chartFor !== m.id) { chartHost.replaceChildren(isLive(m) && m.primaryPool ? priceChart(m).el : ''); chartFor = m.id; }

    params2.replaceChildren(h('section', { class: 'panel', 'aria-labelledby': 'mp-h' },
      h('div', { class: 'panel-head' }, h('h2', { id: 'mp-h' }, 'Market parameters')),
      h('p', { class: 'muted small' }, `Borrow cap is 5% of the token's supported pool liquidity; opening LTV and liquidation threshold follow its liquidity tier (${m.tier || 'n/a'}).`),
      kv([
        ['Collateral', m.symbol], ['Loan asset', 'USDG (Global Dollar)'],
        ['Opening LTV', pct(m.openLTV, 0)], ['Liquidation threshold', pct(m.liqThreshold, 0)],
        ['Borrow cap', money(m.cap, 0)], ['Per-wallet limit', money(m.accountLimit, 0)],
        ['Opening fee', '0.5% of gross debt'], ['Protocol interest share', '15% · 60% to this reserve'],
        ['Rate model', `${pct(m.rate.base, 0)} base, kink ${pct(m.rate.kink, 0)}, max ${pct(m.rate.max, 0)}`],
        ['Price source', `Deepest ${m.primaryQuote || 'USDG'} pool · stale after ${Math.round(m.maxPriceAgeSec / 60)} min`],
        ...(m.primaryQuote && m.primaryQuote !== 'USDG' ? [['USDG conversion', `USD price ÷ USDG reference price ($${fmtPrice(m.usdgUsd)})`]] : []),
        ['Loss order', 'This market\'s reserve, then its lenders'],
      ])));

    const ageDays = st.createdAt ? Math.max(0, Math.floor((Date.now() - st.createdAt) / 864e5)) : null;
    onchain.replaceChildren(h('section', { class: 'panel', 'aria-labelledby': 'oc-h' },
      h('div', { class: 'panel-head' }, h('h2', { id: 'oc-h' }, 'On-chain market data')),
      h('div', { class: 'telemetry' },
        kv([
          ['Price', priceLine(m)], ['Price in USD', st.priceUsd != null ? `$${fmtPrice(st.priceUsd)}` : '—'],
          ['Change 1h / 6h / 24h', h('span', {}, chg(st.change?.h1), ' / ', chg(st.change?.h6), ' / ', chg(st.change?.h24))],
          ['Market cap', usd(st.marketCap)],
        ]),
        kv([
          ['24h trades', `${(st.buys24 || 0).toLocaleString()} buys · ${(st.sells24 || 0).toLocaleString()} sells`],
          ['Oldest supported pool', ageDays == null ? '—' : `${ageDays} day${ageDays === 1 ? '' : 's'}`],
          ['Supported pools', `${(st.pools || []).length}${(st.pools || []).length > 1 ? ` · price spread ${(st.deviation * 100).toFixed(2)}%` : ''}`],
        ])),
      (st.pools || []).length ? h('table', { class: 'md-pools' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Pool'), h('th', {}, 'DEX'), h('th', { class: 'num' }, 'Liquidity'))),
        h('tbody', {}, st.pools.map((p) => h('tr', {},
          h('td', {}, h('a', { class: 'mono', href: `https://dexscreener.com/robinhood/${p.address}`, target: '_blank', rel: 'noopener' }, `${p.address.slice(0, 8)}…${p.address.slice(-6)} ↗`)),
          h('td', {}, `${p.dex}${p.version ? ` ${p.version}` : ''} · ${p.quote || 'USDG'}`), h('td', { class: 'num' }, usd(p.liquidityUsd)))))) : '',
      h('div', { class: 'btn-row' },
        h('a', { class: 'btn ghost', href: `https://dexscreener.com/robinhood/${m.primaryPool}`, target: '_blank', rel: 'noopener' }, 'DexScreener ↗'),
        h('a', { class: 'btn ghost', href: `https://www.geckoterminal.com/robinhood/pools/${m.primaryPool}`, target: '_blank', rel: 'noopener' }, 'GeckoTerminal ↗'),
        h('a', { class: 'btn ghost', href: `${ex}/token/${m.address}`, target: '_blank', rel: 'noopener' }, 'Explorer ↗')),
      h('p', { class: 'small muted' }, 'Market data as reported by DexScreener and GeckoTerminal. Memecoin prices and liquidity can move or vanish quickly; nothing here is financial advice.')));

    others.replaceChildren(...marketList().filter((x) => x.id !== m.id).slice(0, 4).map((x) => bayCard(x)));
    status.update();
  }

  const el = h('div', { class: 'page market-page' },
    head, status.el, tiles,
    h('div', { class: 'md-grid' }, chartHost, params2),
    onchain,
    h('section', { 'aria-labelledby': 'mo-h' }, h('div', { class: 'section-head' }, h('h2', { id: 'mo-h' }, 'Other markets'), h('a', { href: '#/markets' }, 'All markets →')), others));
  draw();
  return { el, update: draw };
}
