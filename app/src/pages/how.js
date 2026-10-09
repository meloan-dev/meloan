import { h } from '../ui.js';
import { pageHead, btn } from '../components.js';

export const title = 'How it works';

const BORROWER = [
  ['Pick one market', 'Every memecoin has its own market. Collateral in one market never secures debt in another.', '#/markets', 'Compare markets'],
  ['Deposit collateral', 'Your memecoin sits in the market’s collateral contract. You keep the exposure: if it rises, the gain is yours.', '#/borrow?value=1000', 'Prefill ~1,000 USDG of collateral'],
  ['Borrow within capacity', 'You can borrow up to the lowest of: collateral × opening LTV, available liquidity, remaining cap and any account limit. A 0.5% opening fee is financed: borrow 200, receive 199, owe 200.', '#/borrow?value=1000&debt=100', 'Prefill a 100 USDG loan'],
  ['Watch health', 'Health = collateral value × liquidation threshold ÷ debt. Below 1 the position can be partly liquidated. A 50% price drop takes a loan at health 2.00 down to 1.00.', '#/borrow?value=1000&debt=200', 'See health in Borrow'],
  ['Recover or repay', 'Add collateral or repay to raise health. Full repayment releases all remaining collateral. Interest accrues while the loan is open; there is no fixed maturity.', '#/positions', 'Repay in Positions'],
];
const LENDER = [
  ['Choose a market to fund', 'Your deposit funds only the market you pick, and only that market’s losses can reach it.', '#/markets', 'Compare markets'],
  ['Supply and receive shares', 'Shares are your claim on that market’s lending assets. The value per share rises with interest and falls if lenders absorb bad debt.', '#/lend', 'Supply to a market'],
  ['Earn from real borrowing', 'Lender APR ≈ borrow APR × utilization × (1 − 15% protocol share). With 20%, 50% and 15%: about 8.5%. No borrowing, no interest.', '#/analytics', 'Move utilization'],
  ['Withdraw what is unborrowed', 'You can redeem only unborrowed liquidity. If most funds are lent out, take the available part and retry later.', '#/analytics', 'See liquidity by utilization'],
  ['Know the loss order', 'Bad debt hits the market’s reserve first, then that market’s lenders pro rata. For instance, 8,000 bad debt, 5,000 reserve → lenders lose 3,000.', '#/analytics', 'Run the waterfall'],
];

export function render(params) {
  let who = params.role === 'lender' ? 'lender' : 'borrower';
  const list = h('ol', { class: 'briefing' });
  const tabs = ['borrower', 'lender'].map((k) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === who), onclick: () => { who = k; draw(); } }, k === 'borrower' ? 'I want to borrow' : 'I want to lend'));
  function draw() {
    tabs.forEach((t, i) => t.setAttribute('aria-selected', String(['borrower', 'lender'][i] === who)));
    list.replaceChildren(...(who === 'borrower' ? BORROWER : LENDER).map(([t, b, href, cta], i) =>
      h('li', { class: 'panel brief' }, h('span', { class: 'brief-n' }, String(i + 1).padStart(2, '0')), h('div', {}, h('h3', {}, t), h('p', {}, b), h('a', { class: 'btn', href }, `${cta} →`)))));
  }
  const el = h('div', { class: 'page' },
    pageHead({ title: 'How it works', eyebrow: 'Mission briefing', lead: 'Five steps for each side. Every step links to the control that does it, prefilled where it helps.' }),
    h('div', { class: 'tabs big', role: 'tablist', 'aria-label': 'Walkthrough' }, tabs),
    list,
    h('section', { class: 'panel risks', 'aria-labelledby': 'rk-h' }, h('h2', { id: 'rk-h' }, 'What can go wrong'),
      h('ul', {},
        h('li', {}, 'Prices can fall faster than liquidations execute; oracle outages can delay them.'),
        h('li', {}, 'Liquidity can dry up, so withdrawals may be partial.'),
        h('li', {}, 'Reserves are finite. Beyond them, that market’s lenders lose principal.'),
        h('li', {}, 'Shared risks remain: contract bugs, stablecoin depegs, chain outages, admin compromise.')),
      h('div', { class: 'btn-row' }, btn('Read the risks in full', { href: '#/docs?s=17' }))));
  draw();
  return { el };
}
