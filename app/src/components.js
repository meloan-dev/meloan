// Shared page pieces.
import { h, select, range, pct, money, coinImg, stateChip, ageText, modal, toast } from './ui.js';
import { getAccount, connect, short } from './wallet.js';
import { getState, setScenario, scenarioOf, isPaused, refreshLive } from './store.js';
import { CONFIG } from './config.js';
import { DEX_SOURCE } from './live.js';
import { isMemeToken } from './meme-tokens.js';
import { PRICE_STATES, acceptedPrice, utilization, borrowAPR, lenderAPR, fmtNum, fmtPrice } from './engine.js';

export function pageHead({ eyebrow, title, lead, extra }) {
  return h('div', { class: 'page-head' },
    h('div', { class: 'eyebrow-row' }, eyebrow ? h('span', { class: 'eyebrow' }, eyebrow) : null),
    h('h1', {}, title), lead ? h('p', { class: 'lead' }, lead) : null, extra);
}

const rank = (m) => (m.source === 'live' && !m.retired ? 0 : m.source === 'live' ? 1 : 2);
export const marketList = () => Object.values(getState().markets).filter(m => !m.retired && m.source === 'live' && isMemeToken(m.address)).sort((a, b) => rank(a) - rank(b) || (b.stats?.liquidityUsd || 0) - (a.stats?.liquidityUsd || 0));
export const firstMarketId = () => marketList()[0]?.id;
export const isLive = (m) => m && m.source === 'live';
// a market id that still exists (live data can replace the examples while a page is open)
export const pickMarket = (id) => (id && marketList().some(m => m.id === id) ? id : firstMarketId());
// collateral units worth about `value` USDG at the market's current price, rounded to 2 significant figures
export function unitsForValue(m, value = 1000) {
  const p = m?.price; if (!(p > 0)) return '';
  const u = value / p;
  if (u < 10) return String(Math.round(u * 100) / 100);
  const mag = 10 ** (Math.floor(Math.log10(u)) - 1);
  return String(Math.round(u / mag) * mag);
}
const usd = (v) => (v == null ? '—' : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}k` : `$${v.toFixed(0)}`);
export { usd };
export const chg = (v) => (v == null ? h('span', { class: 'muted' }, '—') : h('span', { class: v >= 0 ? 'up' : 'down' }, `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`));
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const optLabel = (m) => `${m.symbol} / USDG`;
export function marketSelect({ value, onChange, label = 'Market' }) {
  const api = select({ label, value, onChange, options: marketList().map((m) => ({ value: m.id, label: optLabel(m) })) });
  let sig = '';
  api.refresh = (cur) => {
    const list = marketList(); const nsig = list.map((m) => m.id + optLabel(m)).join('|');
    if (nsig === sig) return; sig = nsig;
    api.sel.replaceChildren(...list.map((m) => h('option', { value: m.id, selected: m.id === cur }, optLabel(m))));
  };
  api.refresh(value);
  return api;
}

// Live data status: source, time, refresh, errors (PRD MLN 32: never silently show stale data as live)
export function liveStatus() {
  const el = h('div', { class: 'live-status panel', role: 'status' });
  const draw = () => {
    const L = getState().live || {}; const any = marketList().some(isLive);
    const dot = h('span', { class: `live-dot ${marketList().some((m) => m.snapshot) ? 'snap' : L.status === 'ok' ? 'on' : L.status === 'error' ? 'bad' : ''}`, 'aria-hidden': 'true' });
    const src = h('a', { href: DEX_SOURCE.url, target: '_blank', rel: 'noopener' }, DEX_SOURCE.name);
    let msg;
    const at = new Date(L.fetchedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const hidden = L.hidden ? ` · ${L.hidden} meme token${L.hidden === 1 ? '' : 's'} without a qualifying price/pool not listed` : '';
    if (L.status === 'loading' && !any) msg = ['Loading Robinhood Chain × USDG markets from ', src, '…'];
    else if (marketList().some((m) => m.snapshot)) msg = ['Market data from ', src, ` · as of ${at}`, hidden, L.status === 'loading' ? ' · updating…' : ''];
    else if (L.status === 'error' && !any) msg = [h('strong', {}, 'Market data is unavailable. '), L.error];
    else if (L.status === 'error') msg = [h('strong', {}, 'Update failed. '), L.error, ` Showing data from ${clock(L.fetchedAt)}; prices older than ${CONFIG.live.maxPriceAgeSec / 60} minutes are marked Stale.`];
    else if (any) msg = ['Live prices and pool stats from ', src, ` · updated ${clock(L.fetchedAt)}`, hidden, L.status === 'loading' ? ' · refreshing…' : ''];
    else msg = ['Market data is loading.'];
    el.replaceChildren(h('div', { class: 'live-row' }, dot, h('p', {}, ...msg),
      h('button', { type: 'button', class: 'btn ghost small-btn', disabled: L.status === 'loading', onclick: () => refreshLive() }, L.status === 'error' ? 'Retry' : 'Refresh')));
  };
  draw();
  return { el, update: draw };
}

export function priceLine(m) {
  const p = acceptedPrice(m, scenarioOf(m.id));
  const st = PRICE_STATES[p.state];
  const age = p.state === 'stale' ? `${ageText(m.priceAgeSec)} (max ${ageText(m.maxPriceAgeSec).replace(' ago', '')})` : ageText(m.priceAgeSec);
  return h('span', { class: 'price-line' }, `${fmtPrice(p.price)} USDG`, ' ', stateChip(p.valid ? 'ok' : 'bad', st.label), ' ',
    h('span', { class: 'muted' }, m.snapshot ? `as of ${new Date(m.fetchedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${DEX_SOURCE.name}` : `${age} · ${DEX_SOURCE.name}`));
}

// Card status: price health first, then the market's liquidity tier (which sets its LTV).
export function marketStatus(m) {
  const p = acceptedPrice(m, scenarioOf(m.id));
  if (!p.valid) return { kind: 'bad', label: `Price ${PRICE_STATES[p.state].label.toLowerCase()}` };
  const liq = m.stats?.liquidityUsd || 0;
  return liq >= 1e6 ? { kind: 'ok', label: 'Deep liquidity' } : liq >= 25e4 ? { kind: 'info', label: 'Medium liquidity' } : { kind: 'warn', label: 'Thin liquidity' };
}

// Every transaction goes through here: connect a wallet first, then the launch notice.
export async function requireWallet(action) {
  if (!getAccount()) {
    const ok = await new Promise((resolve) => {
      const err = h('p', { class: 'field-err', role: 'alert' });
      const go = h('button', { type: 'button', class: 'btn primary', 'data-autofocus': '' }, 'Connect wallet');
      let done = false;
      const dlg = modal({
        title: 'Connect your wallet',
        body: h('div', {}, h('p', {}, `To continue, connect a wallet on ${CONFIG.network.name}. Meloan reads your public address and token balances; nothing is signed when you connect.`), err),
        actions: [h('button', { type: 'button', class: 'btn', onclick: () => { dlg.close(); if (!done) resolve(false); } }, 'Cancel'), go],
      });
      go.addEventListener('click', async () => {
        go.disabled = true; go.textContent = 'Waiting for wallet…'; err.textContent = '';
        try { await connect(); done = true; dlg.close(); toast(`Connected ${short(getAccount())}.`); resolve(true); }
        catch (e) { err.textContent = e.message; go.disabled = false; go.textContent = 'Try again'; }
      });
    });
    if (!ok) return false;
  }
  const gotIt = h('button', { type: 'button', class: 'btn primary', 'data-autofocus': '' }, 'Got it');
  const note = modal({
    title: `${action} opens at launch`,
    body: h('div', {},
      h('p', {}, `Your wallet ${short(getAccount())} is connected. ${action} on Meloan opens when the ${CONFIG.network.name} markets go live.`),
      h('p', { class: 'small muted' }, 'Nothing was signed or sent. Your inputs stay on this page so you can come back to them.')),
    actions: [gotIt],
  });
  gotIt.addEventListener('click', () => note.close());
  return true;
}

export function bayCard(m, { href, selected } = {}) {
  const st = marketStatus(m);
  return h('a', { class: `bay panel ${selected ? 'selected' : ''}`, href: href || `#/market?m=${m.id}`, 'aria-current': selected ? 'true' : null },
    h('div', { class: 'bay-top' }, coinImg(m, 44), h('div', {}, h('strong', {}, m.symbol), h('span', { class: 'muted small' }, m.name)), stateChip(st.kind, st.label)),
    isLive(m) ? h('div', { class: 'bay-live' },
      h('div', { class: 'bay-price' }, h('span', { class: 'stat-v' }, `${fmtPrice(m.price)} USDG`), chg(m.stats.change?.h24), h('span', { class: 'muted small' }, '24h')),
      h('div', { class: 'bay-stats' }, stat('Pool liquidity', usd(m.stats.liquidityUsd)), stat('24h volume', usd(m.stats.volume24)), stat('FDV', usd(m.stats.fdv)))) : null,
    h('div', { class: 'bay-stats sim-stats' },
      stat('Opening LTV', pct(m.openLTV, 0)),
      stat('Liquidation at', pct(m.liqThreshold, 0)),
      stat('Borrow cap', money(m.cap, 0))));
}
const stat = (k, v) => h('div', { class: 'stat' }, h('span', { class: 'stat-k' }, k), h('span', { class: 'stat-v' }, v));

export function blockList(blocks) {
  if (!blocks.length) return null;
  return h('ul', { class: 'blocks', role: 'alert' }, blocks.map((b) => h('li', {}, b.msg)));
}

export function emptyState({ title, body, actions }) {
  return h('div', { class: 'empty panel' }, h('img', { src: 'assets/buddy-face.webp', alt: '', width: 72, height: 72 }), h('h2', {}, title), h('p', {}, body), h('div', { class: 'btn-row' }, actions));
}
export const btn = (label, props = {}) => h(props.href ? 'a' : 'button', { class: `btn ${props.kind || ''}`, type: props.href ? null : 'button', ...props, kind: null }, label);
