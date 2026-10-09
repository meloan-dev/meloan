// Positions: loans and deposits of the connected wallet.
import { h, toast } from '../ui.js';
import { pageHead, btn } from '../components.js';
import { getAccount, onAccount, connect, short } from '../wallet.js';
import { CONFIG } from '../config.js';

export const title = 'Positions';

export function render() {
  const body = h('div');
  function draw() {
    const a = getAccount();
    if (!a) {
      const go = h('button', { type: 'button', class: 'btn primary' }, 'Connect wallet');
      go.addEventListener('click', async () => {
        go.disabled = true; go.textContent = 'Waiting for wallet…';
        try { await connect(); toast(`Connected ${short(getAccount())}.`); }
        catch (e) { toast(e.message, 'bad'); go.disabled = false; go.textContent = 'Connect wallet'; }
      });
      body.replaceChildren(h('section', { class: 'panel empty' },
        h('h2', {}, 'Connect your wallet'),
        h('p', { class: 'muted' }, `Your loans, collateral and deposits on ${CONFIG.network.name} appear here once your wallet is connected. Meloan only reads your public address.`),
        h('div', { class: 'btn-row' }, go)));
      return;
    }
    body.replaceChildren(h('section', { class: 'panel empty' },
      h('h2', {}, 'No open positions'),
      h('p', { class: 'muted' }, `${short(a)} has no Meloan loans or deposits yet. Open a loan against a memecoin, or supply USDG to one market.`),
      h('div', { class: 'btn-row' }, btn('Borrow', { kind: 'primary', href: '#/borrow' }), btn('Lend', { href: '#/lend' }))),
    h('section', { class: 'panel' },
      h('h2', {}, 'What you can do with a loan'),
      h('ul', { class: 'plain-list' },
        h('li', {}, h('strong', {}, 'Repay'), ' any amount at any time. Interest is paid first; full repayment releases your collateral.'),
        h('li', {}, h('strong', {}, 'Add collateral'), ' to raise your health and move your liquidation price away.'),
        h('li', {}, h('strong', {}, 'Withdraw collateral'), ' while the loan stays within the opening LTV.'))));
  }
  const off = onAccount(draw);
  draw();
  return {
    el: h('div', { class: 'page' }, pageHead({ title: 'Positions', eyebrow: 'Your loans and deposits', lead: 'Track health, debt and collateral for every loan, and your share of each market you lend to.' }), body),
    destroy: off,
  };
}
