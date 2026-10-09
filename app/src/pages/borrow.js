import { h, numberField, kv, money, pct, healthText, healthChip, gauge, modal, toast, announce } from '../ui.js';
import { pageHead, marketSelect, priceLine, blockList, btn, pickMarket, unitsForValue, requireWallet } from '../components.js';
import { getState, setState, scenarioOf, isPaused } from '../store.js';
import { previewBorrow, openPosition, fmtNum, positionDebt, OPENING_FEE, fmtPrice } from '../engine.js';
import { getAccount, onAccount, connect } from '../wallet.js';
import { readTokenBalance, validateCollateralBalance, formatTokenUnits } from '../wallet-balances.js';

export const title = 'Borrow';

export function render(params) {
  let mId = pickMarket(params.market);
  const m = () => getState().markets[mId];
  let pv = null, pending = false;
  let balance = null, balanceStatus = 'idle', balanceError = '', balanceSeq = 0, disposed = false;
  const walletNote = h('div', { class: 'small muted', 'aria-live': 'polite' });
  const balanceRefresh = btn('Refresh balance', { onclick: () => refreshBalance() });

  const unitsF = numberField({ label: 'Collateral to deposit', suffix: m().symbol, value: params.units || (params.value ? unitsForValue(m(), +params.value) : ''), decimals: m().unitDecimals, onInput: calc, hint: 'Only this market’s memecoin is accepted.' });
  const collateralMax = h('button', { type: 'button', class: 'field-max', onclick: () => {
    if (!balance || balanceStatus !== 'ready') return;
    unitsF.set(formatTokenUnits(balance.raw, balance.decimals, Math.min(m().unitDecimals, balance.decimals)));
    calc();
  } }, 'Max');
  unitsF.el.querySelector('.field-box').append(collateralMax);
  const debtF = numberField({ label: 'Gross debt to borrow', suffix: 'USDG', value: params.debt || '', decimals: 2, onInput: calc, max: () => (pv ? pv.capacity.value : 0), hint: `Includes the ${OPENING_FEE * 100}% opening fee, which is financed, not added on top.` });
  const switchTo = (v) => { mId = v; ms.sel.value = v; unitsF.el.querySelector('.field-suffix').textContent = m().symbol; if (unitsF.input.value) unitsF.set(unitsForValue(m(), (+unitsF.input.value.replace(/,/g, '') || 0) * (prevPrice || 0) || 1000)); prevPrice = m().price; refreshBalance(); };
  let prevPrice = m().price;
  const ms = marketSelect({ value: mId, onChange: switchTo });
  const priceEl = h('div', { class: 'price-row' });
  const g = gauge(); const healthEl = h('p', { class: 'gauge-label' });
  const limitsEl = h('div'); const outEl = h('div'); const blocksEl = h('div');
  const reviewBtn = btn('Review loan', { kind: 'primary', onclick: review });

  function balanceCheck() {
    if (!balance || balanceStatus !== 'ready' || balance.account !== String(getAccount()).toLowerCase() || balance.token !== m().address.toLowerCase()) {
      return { ok: false, error: balanceError || (balanceStatus === 'loading' ? 'Reading your wallet balance…' : 'Connect your wallet and verify its collateral balance.') };
    }
    return validateCollateralBalance(balance, unitsF.input.value);
  }
  async function refreshBalance() {
    const seq = ++balanceSeq, token = m().address, account = getAccount();
    balance = null; balanceError = ''; balanceStatus = account ? 'loading' : 'idle'; calc();
    if (!account) return false;
    try {
      const next = await readTokenBalance(token);
      if (disposed || seq !== balanceSeq || getAccount() !== account || m().address !== token) return false;
      balance = next; balanceStatus = 'ready';
    } catch (error) {
      if (disposed || seq !== balanceSeq) return false;
      balanceStatus = 'error'; balanceError = error.message;
    }
    calc();
    return balanceStatus === 'ready';
  }

  function calc() {
    const mm = m();
    const u = unitsF.input.value ? unitsF.read({ decimals: mm.unitDecimals }) : (unitsF.setError(''), { ok: false });
    const d = debtF.input.value ? debtF.read() : (debtF.setError(''), { ok: false });
    const accountDebt = getState().positions.filter((p) => p.marketId === mm.id && !p.closed).reduce((a, p) => a + positionDebt(p), 0);
    const verified = balanceCheck();
    const walletUnits = balance && balanceStatus === 'ready' ? Number(formatTokenUnits(balance.raw, balance.decimals, mm.unitDecimals)) : 0;
    const collateralUnits = Math.min(u.ok ? u.value : 0, walletUnits);
    pv = previewBorrow(mm, { units: collateralUnits, gross: d.ok ? d.value : 0, scenario: scenarioOf(mm.id), paused: isPaused(mm), accountDebt });
    collateralMax.disabled = balanceStatus !== 'ready' || !getAccount();
    balanceRefresh.disabled = pending || balanceStatus === 'loading' || !getAccount();
    walletNote.textContent = !getAccount() ? `Connect your wallet to read your available ${mm.symbol} balance.`
      : balanceStatus === 'loading' ? `Reading your ${mm.symbol} balance on Robinhood Chain…`
      : balanceStatus === 'error' ? balanceError
      : balance ? `Wallet balance: ${formatTokenUnits(balance.raw, balance.decimals, 6)} ${mm.symbol}` : 'Balance not verified.';
    if (u.ok && getAccount() && !verified.ok) unitsF.setError(verified.error.replace('tokens.', `${mm.symbol}.`));
    priceEl.replaceChildren(h('span', { class: 'muted' }, 'Accepted price: '), priceLine(mm));
    limitsEl.replaceChildren(h('h3', {}, 'Borrowing capacity'),
      h('p', { class: 'cap-big' }, money(pv.capacity.value)),
      h('ul', { class: 'limits' }, pv.capacity.limits.map((l) => h('li', { class: l.key === pv.capacity.binding ? 'binding' : '' }, h('span', {}, l.label), h('span', {}, money(l.value)), l.key === pv.capacity.binding ? h('span', { class: 'chip chip-info' }, 'Lowest, applies') : null))));
    outEl.replaceChildren(kv([
      ['Collateral value', money(pv.C)],
      ['Gross debt', money(pv.gross), 'strong'],
      ['Opening fee (0.5%)', money(pv.fee)],
      ['You receive', money(Math.max(0, pv.proceeds)), 'strong'],
      ['Borrow APR now (est.)', pct(pv.apr)],
      ['Loan-to-value after', pct(pv.ltv)],
      ['Liquidation threshold', pct(mm.liqThreshold, 0)],
      ['Liquidation price', pv.liqPrice ? `${fmtPrice(pv.liqPrice)} USDG per ${mm.symbol}` : '—'],
    ]));
    g.set(pv.health);
    healthEl.replaceChildren(h('strong', {}, healthText(pv.health)), ' ', healthChip(pv.health));
    const blocks = [...pv.blocks];
    if (!verified.ok) blocks.push({ msg: verified.error });
    if (u.ok === false && unitsF.input.value === '') blocks.push({ msg: 'Enter how much collateral to deposit.' });
    if (d.ok === false && debtF.input.value === '') blocks.push({ msg: 'Enter how much to borrow.' });
    blocksEl.replaceChildren(blockList(blocks) || h('p', { class: 'ok-line' }, '✓ Ready to review'));
    reviewBtn.textContent = pending ? 'Checking wallet…' : getAccount() ? 'Review loan' : 'Connect wallet';
    reviewBtn.disabled = pending || (getAccount() ? !(u.ok && d.ok && pv.canOpen && verified.ok) : false);
  }

  async function review() {
    if (pending) return;
    pending = true; calc();
    try {
      if (!getAccount()) await connect();
      await refreshBalance();
    } catch (error) { balanceStatus = 'error'; balanceError = error.message; }
    finally { pending = false; if (!disposed) calc(); }
    if (disposed) return;
    const mm = m(); const u = unitsF.read({ decimals: mm.unitDecimals }); const d = debtF.read();
    if (!u.ok || !d.ok || !pv.canOpen || !balanceCheck().ok) return;
    const reviewAccount = getAccount(), reviewMarket = mId, reviewedUnits = unitsF.input.value, reviewedDebt = debtF.input.value;
    const confirm = btn('Confirm borrow', { kind: 'primary', 'data-autofocus': '' });
    const errEl = h('p', { class: 'field-err', role: 'alert' });
    const dlg = modal({
      title: 'Review your loan',
      body: h('div', {},
        kv([
          ['Market', `${mm.symbol} / USDG`], ['Collateral', `${fmtNum(u.value, mm.unitDecimals)} ${mm.symbol}`], ['Collateral value', money(pv.C)],
          ['Gross debt', money(pv.gross)], ['Opening fee', money(pv.fee)], ['You receive', money(pv.proceeds)], ['Borrow APR (est.)', pct(pv.apr)],
          ['Health after opening', healthText(pv.health)], ['Liquidation price', `${fmtPrice(pv.liqPrice)} USDG`],
        ]),
        h('p', { class: 'small muted' }, 'If the collateral price falls to the liquidation price, part of the collateral can be sold to repay debt.'),
        errEl),
      actions: [btn('Cancel', { onclick: () => dlg.close() }), confirm],
    });
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      await refreshBalance();
      if (disposed || getAccount() !== reviewAccount || mId !== reviewMarket || unitsF.input.value !== reviewedUnits || debtF.input.value !== reviewedDebt || !balanceCheck().ok || !pv.canOpen) {
        errEl.textContent = 'Your wallet balance or loan inputs changed. Close this review and check the updated amounts.';
        confirm.disabled = false; return;
      }
      dlg.close(); requireWallet('Borrowing');
    });
  }

  const el = h('div', { class: 'page' },
    pageHead({ title: 'Borrow', eyebrow: 'Open a loan', lead: 'Deposit a Robinhood Chain memecoin as collateral and borrow USDG against it. Fee, proceeds and health are shown before you confirm.' }),
    h('div', { class: 'split borrow' },
      h('section', { class: 'panel', 'aria-label': 'Loan inputs' }, ms.el, priceEl, walletNote, h('div', { class: 'btn-row' }, balanceRefresh), unitsF.el, debtF.el, limitsEl),
      h('section', { class: 'panel', 'aria-label': 'Loan preview' },
        h('div', { class: 'gauge-wrap' }, g.el, healthEl), outEl, blocksEl, h('div', { class: 'btn-row' }, reviewBtn))));
  const unsubscribe = onAccount(() => refreshBalance());
  const balanceTimer = setInterval(() => { if (!document.hidden && !pending && getAccount()) refreshBalance(); }, 30000);
  refreshBalance();
  return { el, update() { ms.refresh(mId); if (pickMarket(mId) !== mId) switchTo(pickMarket(null)); calc(); },
    destroy() { disposed = true; balanceSeq++; unsubscribe(); clearInterval(balanceTimer); } };
}
