import { h, numberField, kv, money, pct, range, toast, modal, announce } from '../ui.js';
import { pageHead, marketSelect, btn, pickMarket, requireWallet } from '../components.js';
import { getAccount, onAccount, connect, short } from '../wallet.js';
import { getState, setState } from '../store.js';
import { utilization, borrowAPR, lenderAPR, lenderAPRFrom, pricePerShare, redeemPreview, supply, redeem, fmtNum, PROTOCOL_INTEREST_SHARE } from '../engine.js';

export const title = 'Lend';

export function render(params) {
  let mId = pickMarket(params.market);
  let whatIf = 0.5;
  const m = () => getState().markets[mId];
  const switchTo = (v) => { mId = v; ms.sel.value = v; calc(); };
  const ms = marketSelect({ value: mId, onChange: switchTo });
  const statsEl = h('div'); const aprEl = h('div', { class: 'apr-box' }); const mineEl = h('div');
  const supplyF = numberField({ label: 'Supply amount', suffix: 'USDG', decimals: 2, onInput: calc });
  const redeemF = numberField({ label: 'Withdraw amount', suffix: 'USDG', decimals: 2, onInput: calc });
  const supplyOut = h('p', { class: 'small muted' }); const redeemOut = h('div', { 'aria-live': 'polite' });
  const supplyBtn = btn('Supply USDG', { kind: 'primary', onclick: () => supplyF.read().ok && requireWallet('Supplying') });
  const redeemBtn = btn('Withdraw', { onclick: () => redeemF.read().ok && requireWallet('Withdrawing') });
  const util = range({ label: 'What if utilization were…', min: 0, max: 100, step: 1, value: 50, format: (v) => `${v}%`, onInput: (v) => { whatIf = v / 100; calc(); } });

  function calc() {
    const mm = m(); const u = whatIf;
    statsEl.replaceChildren(kv([
      ['Borrow cap', money(mm.cap, 0)], ['Opening LTV for borrowers', pct(mm.openLTV, 0)],
      ['Rate model', `${pct(mm.rate.base, 0)} base, kink at ${pct(mm.rate.kink, 0)}, max ${pct(mm.rate.max, 0)}`],
      ['Lenders receive', `${pct(1 - PROTOCOL_INTEREST_SHARE, 0)} of borrowing interest`], ['Loss order', 'Market reserve first, then this market\'s lenders'],
    ]));
    const bApr = borrowAPR(mm, u); const lApr = lenderAPRFrom(bApr, u);
    aprEl.replaceChildren(h('span', { class: 'muted small' }, `Estimated lender APR at ${pct(u, 0)} utilization`),
      h('strong', { class: 'apr' }, pct(lApr, 2)),
      h('span', { class: 'small muted' }, `${pct(bApr)} borrow APR × ${pct(u, 0)} utilization × ${pct(1 - PROTOCOL_INTEREST_SHARE, 0)} lender share. ${u === 0 ? 'With no borrowing there is no borrowing interest.' : 'An estimate, not a promised yield; losses can reduce it.'}`));
    const acct = getAccount();
    mineEl.replaceChildren(acct
      ? kv([['Wallet', short(acct)], ['Supplied to this market', money(0)], ['Shares', fmtNum(0, 4)]])
      : h('div', {}, h('p', { class: 'small muted' }, 'Connect your wallet to see your deposits in this market.'),
        h('button', { type: 'button', class: 'btn', onclick: () => connect().catch((e) => toast(e.message, 'bad')) }, 'Connect wallet')));
    const sv = supplyF.input.value ? supplyF.read() : (supplyF.setError(''), { ok: false });
    supplyOut.textContent = sv.ok ? `You would receive ${fmtNum(sv.value, 4)} shares at 1.0000 USDG per share. No deposit fee.` : 'Shares represent your claim on this market only.';
    supplyBtn.disabled = !sv.ok;
    const r = redeemF.input.value ? redeemF.read() : (redeemF.setError(''), { ok: false });
    redeemOut.replaceChildren(h('p', { class: 'small muted' }, 'Withdrawals come only from unborrowed liquidity, never from collateral or the reserve. If too much is borrowed, you can withdraw part now and the rest later.'));
    redeemBtn.disabled = !r.ok;
  }
  const offAcct = onAccount(() => calc());

  const el = h('div', { class: 'page' },
    pageHead({ title: 'Lend', eyebrow: 'Fund one market', lead: 'Supply USDG to the market you choose. You earn only from borrowing in that market, and you can lose principal if it takes bad debt beyond its reserve.' }),
    h('div', { class: 'split' },
      h('section', { class: 'panel', 'aria-label': 'Market' }, ms.el, statsEl, h('h3', {}, 'Your position'), mineEl),
      h('section', { class: 'panel', 'aria-label': 'Supply and withdraw' },
        aprEl, util.el,
        h('div', { class: 'two' },
          h('div', {}, supplyF.el, supplyOut, h('div', { class: 'btn-row' }, supplyBtn)),
          h('div', {}, redeemF.el, redeemOut, h('div', { class: 'btn-row' }, redeemBtn))))));
  calc();
  return { el, update() { ms.refresh(mId); if (!getState().markets[mId]) switchTo(pickMarket(null)); calc(); }, destroy: () => offAcct() };
}
