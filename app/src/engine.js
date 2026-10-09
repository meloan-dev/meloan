// Meloan simulation engine — pure functions, no DOM.
// Every rule cites the whitepaper (WP §) or the website PRD (MLN nn). Screens only display these outputs.

export const PROTOCOL_INTEREST_SHARE = 0.15; // WP §11, proposed
export const OPENING_FEE = 0.005;            // WP §11, proposed: 0.5% of gross principal
export const REVENUE_TO_RESERVE = 0.6;       // WP §11.1, proposed
export const EPS = 1e-9;

const round = (x, d = 2) => Math.round((x + Number.EPSILON) * 10 ** d) / 10 ** d;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---------- input validation (MLN 03) ----------
export function parseAmount(raw, { decimals = 2, max = Infinity, allowZero = false } = {}) {
  const s = String(raw ?? '').trim().replace(/,/g, '');
  if (s === '') return { ok: false, error: 'Enter an amount.' };
  if (!/^-?\d*\.?\d*$/.test(s) || s === '.' || s === '-') return { ok: false, error: 'Use digits only, for example 250 or 250.50.' };
  const v = Number(s);
  if (!Number.isFinite(v)) return { ok: false, error: 'That number is not valid.' };
  if (v < 0) return { ok: false, error: 'Amounts cannot be negative.' };
  if (v === 0 && !allowZero) return { ok: false, error: 'Enter an amount above zero.' };
  const frac = s.includes('.') ? s.split('.')[1].length : 0;
  if (frac > decimals) return { ok: false, error: `Use at most ${decimals} decimal place${decimals === 1 ? '' : 's'}.` };
  if (v > max + EPS) return { ok: false, error: `The most allowed here is ${fmtNum(max, decimals)}.` };
  return { ok: true, value: v };
}
// prices of memecoins span many orders of magnitude: keep 4 significant digits, never exponent notation
export function fmtPrice(v) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  if (Math.abs(v) >= 1) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const dec = Math.min(12, Math.max(4, 3 - Math.floor(Math.log10(Math.abs(v)))));
  return v.toFixed(dec).replace(/0+$/, '').replace(/\.$/, '');
}
export const fmtNum = (v, d = 2) => (Number.isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

// ---------- prices (WP §7, MLN 11) ----------
export const PRICE_STATES = {
  ok: { valid: true, label: 'Valid', msg: '' },
  stale: { valid: false, label: 'Stale', msg: 'The price is older than this market allows, so new borrowing and collateral withdrawals are paused until a fresh price arrives.' },
  missing: { valid: false, label: 'Missing', msg: 'No price is available for this market, so new borrowing and collateral withdrawals are paused.' },
  conflict: { valid: false, label: 'Sources disagree', msg: 'The approved price sources disagree by more than the allowed deviation, so new borrowing and collateral withdrawals are paused.' },
  invalid: { valid: false, label: 'Invalid', msg: 'The price failed validation (for example zero or out of range), so new borrowing and collateral withdrawals are paused.' },
};
export function acceptedPrice(m, scenario = {}) {
  const st = scenario.priceState || m.priceState;
  const shock = scenario.priceShock ?? 0; // −0.9 … +1.0
  return { price: m.price * (1 + shock), state: st, valid: PRICE_STATES[st].valid, shock };
}

// ---------- market maths ----------
export const supplied = (m) => m.cash + m.borrowed;                       // lender assets before losses
export const lenderAssets = (m) => Math.max(0, m.cash + m.borrowed - m.lossRecognized);
export const utilization = (m) => (supplied(m) > 0 ? m.borrowed / supplied(m) : 0); // WP §8
export function borrowAPR(m, u = utilization(m)) {                         // WP §8 kinked curve (example parameters)
  const r = m.rate;
  const v = u <= r.kink ? r.base + r.slope1 * (u / r.kink) : r.base + r.slope1 + r.slope2 * ((u - r.kink) / (1 - r.kink));
  return Math.min(v, r.max);
}
export const lenderAPR = (m, u = utilization(m)) => borrowAPR(m, u) * u * (1 - PROTOCOL_INTEREST_SHARE); // WP §4.1
export const lenderAPRFrom = (borrowApr, u, share = PROTOCOL_INTEREST_SHARE) => borrowApr * u * (1 - share);
export const pricePerShare = (m) => (m.shares > 0 ? lenderAssets(m) / m.shares : 1);

// ---------- borrowing (WP §5, MLN 07–09) ----------
export function health(C, threshold, D) {
  if (D <= EPS) return { value: Infinity, label: 'No debt', state: 'none' };
  const v = (C * threshold) / D;
  if (Math.abs(v - 1) < 1e-9) return { value: 1, label: 'At threshold', state: 'edge' };
  if (v < 1) return { value: v, label: 'Liquidation eligible', state: 'liq' };
  return { value: v, label: v < 1.2 ? 'Healthy, thin buffer' : 'Healthy', state: v < 1.2 ? 'warn' : 'ok' };
}
export const ltv = (C, D) => (D <= EPS ? 0 : C > 0 ? D / C : Infinity);
// price at which health reaches 1 for a given position
export const liquidationPrice = (units, threshold, D) => (D <= EPS || units <= 0 ? null : D / (units * threshold));

// accountDebt = this account's existing debt in the market; existingDebt = debt already on the position being extended
export function capacity(m, C, { accountDebt = 0, existingDebt = 0 } = {}) {
  const limits = [
    { key: 'ltv', label: 'Collateral limit (opening LTV)', value: Math.max(0, C * m.openLTV - existingDebt) },
    { key: 'liquidity', label: 'Available lending liquidity', value: Math.max(0, m.cash) },
    { key: 'cap', label: 'Remaining market cap', value: Math.max(0, m.cap - m.borrowed) },
  ];
  if (m.accountLimit != null) limits.push({ key: 'account', label: 'Account limit', value: Math.max(0, m.accountLimit - accountDebt) });
  const min = limits.reduce((a, b) => (b.value < a.value ? b : a));
  return { value: min.value, binding: min.key, limits };
}
export const openingFee = (gross) => round(gross * OPENING_FEE, 6);

export function previewBorrow(m, { units, gross, scenario = {}, paused = m.paused, accountDebt = 0 }) {
  const p = acceptedPrice(m, scenario);
  const C = units * p.price;
  const cap = capacity(m, C, { accountDebt });
  const fee = openingFee(gross);
  const after = health(C, m.liqThreshold, gross);
  const blocks = [];
  if (!p.valid) blocks.push({ code: `price-${p.state}`, msg: PRICE_STATES[p.state].msg });
  if (paused) blocks.push({ code: 'paused', msg: 'New borrowing is paused in this market. Repayments and collateral additions still work.' });
  if (gross > cap.value + EPS) {
    const lim = cap.limits.filter((l) => gross > l.value + EPS).map((l) => l.label.toLowerCase());
    blocks.push({ code: 'capacity', msg: `This is more than you can borrow here. It exceeds: ${lim.join(', ')}.` });
  }
  return {
    price: p, C, capacity: cap, gross, fee, proceeds: gross - fee, apr: borrowAPR(m),
    ltv: ltv(C, gross), health: after, liqPrice: liquidationPrice(units, m.liqThreshold, gross), blocks, canOpen: blocks.length === 0 && gross > 0,
  };
}

// ---------- loss waterfall & revenue (WP §10–11, MLN 18–19) ----------
export function lossWaterfall({ badDebt, reserve, lenderAssets: LA }) {
  const fromReserve = Math.min(Math.max(0, badDebt), Math.max(0, reserve));
  const toLenders = Math.min(Math.max(0, badDebt - fromReserve), Math.max(0, LA));
  return { fromReserve, toLenders, reserveAfter: reserve - fromReserve, lenderAssetsAfter: LA - toLenders, lenderLossPct: LA > 0 ? toLenders / LA : 0, uncovered: Math.max(0, badDebt - fromReserve - toLenders) };
}
export const revenueSplit = (revenue) => ({ reserve: revenue * REVENUE_TO_RESERVE, operations: revenue * (1 - REVENUE_TO_RESERVE) });
export const simpleInterest = (principal, apr, days) => (principal * apr * days) / 365; // MLN 16 illustrative method

// ---------- state transitions (immutable; each touches only one market — MLN 12) ----------
const clone = (o) => JSON.parse(JSON.stringify(o));
const now = () => Date.now();
function logEntry(s, e) { s.history.unshift({ id: ++s.seq, t: now(), ...e }); }
function bookRevenue(m, amount) { const r = revenueSplit(amount); m.reserve += r.reserve; m.revenue.reserve += r.reserve; m.revenue.operations += r.operations; m.revenue.total += amount; }

export function openPosition(state, { marketId, units, gross }) {
  const s = clone(state); const m = s.markets[marketId];
  if (!m) throw new Error('Unknown market.');
  const sc = s.scenario[marketId] || {};
  const accountDebt = s.positions.filter((p) => p.marketId === marketId && !p.closed).reduce((a, p) => a + p.principal + p.interest, 0);
  const pv = previewBorrow(m, { units, gross, scenario: sc, paused: sc.paused ?? m.paused, accountDebt });
  if (!pv.canOpen) throw new Error(pv.blocks[0]?.msg || 'This position cannot be opened.');
  m.cash -= gross; m.borrowed += gross;           // gross principal leaves the vault
  bookRevenue(m, pv.fee);                          // the fee is realised protocol revenue
  const id = `P${++s.seq}`;
  s.positions.unshift({ id, marketId, units, principal: gross, interest: 0, days: 0, closed: false, openedAt: now() });
  logEntry(s, { market: marketId, action: 'Open position', amount: gross, fee: pv.fee, result: `Received ${fmtNum(pv.proceeds)}; owes ${fmtNum(gross)}`, position: id });
  return { state: s, positionId: id };
}
export function positionDebt(p) { return p.principal + p.interest; }

export function accrue(state, { positionId, days }) {
  const s = clone(state); const p = s.positions.find((x) => x.id === positionId); const m = s.markets[p.marketId];
  const add = simpleInterest(p.principal, borrowAPR(m), days);
  p.interest += add; p.days += days;
  logEntry(s, { market: p.marketId, action: `Advance ${days} day${days === 1 ? '' : 's'}`, amount: add, fee: 0, result: `Interest +${fmtNum(add)} (illustrative simple interest)`, position: p.id });
  return { state: s, added: add };
}

export function repay(state, { positionId, amount }) {
  const s = clone(state); const p = s.positions.find((x) => x.id === positionId); const m = s.markets[p.marketId];
  const debt = positionDebt(p);
  const pay = Math.min(amount, debt);              // MLN 13: no negative debt
  const toInterest = Math.min(pay, p.interest), toPrincipal = pay - toInterest;
  const protocolCut = toInterest * PROTOCOL_INTEREST_SHARE;
  p.interest -= toInterest; p.principal -= toPrincipal;
  m.cash += toPrincipal + (toInterest - protocolCut); m.borrowed -= toPrincipal;
  bookRevenue(m, protocolCut);
  let result = `Debt ${fmtNum(debt)} → ${fmtNum(positionDebt(p))}`;
  if (amount > debt + EPS) result += `; ${fmtNum(amount - debt)} not needed, nothing overpaid`;
  if (positionDebt(p) <= 1e-6) { p.principal = 0; p.interest = 0; p.closed = true; result += `; ${fmtNum(p.units)} collateral units released`; }
  logEntry(s, { market: p.marketId, action: positionDebt(p) <= 1e-6 ? 'Full repayment' : 'Partial repayment', amount: pay, fee: 0, result, position: p.id });
  return { state: s, paid: pay };
}

export function addCollateral(state, { positionId, units }) {
  const s = clone(state); const p = s.positions.find((x) => x.id === positionId);
  p.units += units;
  logEntry(s, { market: p.marketId, action: 'Add collateral', amount: units, fee: 0, result: `Collateral ${fmtNum(p.units - units)} → ${fmtNum(p.units)} units`, position: p.id, unit: 'units' });
  return { state: s };
}

export function maxCollateralWithdraw(m, p, scenario = {}) {
  const D = positionDebt(p);
  if (D <= EPS) return { units: p.units, reason: null };
  const pr = acceptedPrice(m, scenario);
  if (!pr.valid) return { units: 0, reason: PRICE_STATES[pr.state].msg };
  if (pr.price <= 0) return { units: 0, reason: 'The price is zero.' };
  const keep = D / (m.openLTV * pr.price);         // MLN 15: remaining collateral must meet opening LTV
  return { units: Math.max(0, Math.floor((p.units - keep) * 100) / 100), reason: null };
}
export function withdrawCollateral(state, { positionId, units }) {
  const s = clone(state); const p = s.positions.find((x) => x.id === positionId); const m = s.markets[p.marketId];
  const lim = maxCollateralWithdraw(m, p, s.scenario[p.marketId] || {});
  if (lim.reason) throw new Error(lim.reason);
  if (units > lim.units + EPS) throw new Error(`At most ${fmtNum(lim.units)} units can leave while the position keeps its opening LTV.`);
  p.units -= units;
  if (positionDebt(p) <= EPS && p.units <= EPS) p.closed = true;
  logEntry(s, { market: p.marketId, action: 'Withdraw collateral', amount: units, fee: 0, result: `Collateral now ${fmtNum(p.units)} units`, position: p.id, unit: 'units' });
  return { state: s };
}

// ---------- lending (WP §4, MLN 04–06) ----------
export function supply(state, { marketId, amount }) {
  const s = clone(state); const m = s.markets[marketId];
  const pps = pricePerShare(m); const shares = amount / pps;
  m.cash += amount; m.shares += shares;
  s.lender[marketId] = (s.lender[marketId] || 0) + shares;
  logEntry(s, { market: marketId, action: 'Supply', amount, fee: 0, result: `${fmtNum(shares, 4)} shares at ${fmtNum(pps, 4)} per share` });
  return { state: s, shares };
}
export function redeemPreview(m, shares) {
  const want = shares * pricePerShare(m);
  const available = Math.min(want, Math.max(0, m.cash));
  return { want, available, remainder: want - available, full: want - available <= EPS };
}
export function redeem(state, { marketId, amount }) {
  const s = clone(state); const m = s.markets[marketId];
  const owned = s.lender[marketId] || 0; const pps = pricePerShare(m);
  const ownedValue = owned * pps;
  const req = Math.min(amount, ownedValue);
  const paid = Math.min(req, Math.max(0, m.cash));           // only unborrowed liquidity (WP §4.2)
  const burned = paid / pps;
  m.cash -= paid; m.shares -= burned; s.lender[marketId] = owned - burned;
  const remainder = req - paid;
  logEntry(s, { market: marketId, action: remainder > EPS ? 'Partial withdrawal' : 'Withdrawal', amount: paid, fee: 0, result: remainder > EPS ? `Paid ${fmtNum(paid)}; ${fmtNum(remainder)} waits for repayments or new liquidity — retry later` : `Paid ${fmtNum(paid)}` });
  return { state: s, paid, remainder };
}

// ---------- position view ----------
export function positionView(state, p) {
  const m = state.markets[p.marketId]; const sc = state.scenario[p.marketId] || {};
  const pr = acceptedPrice(m, sc); const C = p.units * pr.price; const D = positionDebt(p);
  return { m, price: pr, C, D, ltv: ltv(C, D), health: health(C, m.liqThreshold, D), liqPrice: liquidationPrice(p.units, m.liqThreshold, D), maxWithdraw: maxCollateralWithdraw(m, p, sc) };
}
