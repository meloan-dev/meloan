// Run: node --test app/test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import { freshState, SAMPLE_POSITION } from '../src/fixtures.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('PRD fixture: capacity 250, LTV 20%, health 2, price −50% gives health 1 (At threshold)', () => {
  const s = freshState(); const m = s.markets.spud;
  const pv = E.previewBorrow(m, { units: 25000, gross: 200 });
  close(pv.C, 1000); close(pv.capacity.value, 250); assert.equal(pv.capacity.binding, 'ltv');
  close(pv.ltv, 0.2); close(pv.health.value, 2);
  const h = E.health(500, 0.4, 200); close(h.value, 1); assert.equal(h.label, 'At threshold');
  assert.equal(E.health(499, 0.4, 200).label, 'Liquidation eligible');
  assert.equal(E.health(1000, 0.4, 0).label, 'No debt');
});

test('MLN 08: gross 200 → fee 1, proceeds 199, debt stays 200', () => {
  const { state } = E.openPosition(freshState(), SAMPLE_POSITION);
  const p = state.positions[0];
  close(E.openingFee(200), 1); close(E.positionDebt(p), 200);
  assert.match(state.history[0].result, /Received 199\.00; owes 200\.00/);
});

test('lender APR example: 20% × 50% × 85% = 8.5%', () => close(E.lenderAPRFrom(0.2, 0.5), 0.085));
test('zero utilization gives zero lender interest', () => {
  const m = { ...freshState().markets.boost, borrowed: 0 };
  close(E.lenderAPR(m), 0);
});

test('MLN 18: bad debt 8,000 with reserve 5,000 → lenders lose 3,000', () => {
  const w = E.lossWaterfall({ badDebt: 8000, reserve: 5000, lenderAssets: 400000 });
  close(w.fromReserve, 5000); close(w.toLenders, 3000); close(w.reserveAfter, 0);
});

test('MLN 19: revenue splits 60/40', () => { const r = E.revenueSplit(100); close(r.reserve, 60); close(r.operations, 40); });

test('MLN 03: invalid inputs rejected', () => {
  for (const bad of ['', '0', '-5', 'abc', '1e5', '1.234', '.']) assert.equal(E.parseAmount(bad, { decimals: 2 }).ok, false, bad);
  assert.equal(E.parseAmount('250.50', { decimals: 2 }).value, 250.5);
  assert.equal(E.parseAmount('10', { decimals: 0, max: 5 }).ok, false);
});

test('MLN 07: each limit can bind', () => {
  const s = freshState();
  assert.equal(E.capacity(s.markets.whisk, 1e9).binding, 'cap');           // cap fully used
  const m = { ...s.markets.boost, cash: 10 }; assert.equal(E.capacity(m, 1e9).binding, 'liquidity');
  assert.equal(E.capacity(s.markets.spud, 1e9).binding, 'account');
  const pv = E.previewBorrow(s.markets.spud, { units: 25000, gross: 251 });
  assert.equal(pv.canOpen, false); assert.ok(pv.blocks.some((b) => b.code === 'capacity'));
});

test('MLN 11: invalid price or pause blocks borrowing with distinct messages', () => {
  const s = freshState(); const m = s.markets.spud;
  const msgs = new Set();
  for (const st of ['stale', 'missing', 'conflict', 'invalid']) {
    const pv = E.previewBorrow(m, { units: 25000, gross: 100, scenario: { priceState: st } });
    assert.equal(pv.canOpen, false); msgs.add(pv.blocks[0].msg);
  }
  assert.equal(msgs.size, 4);
  assert.equal(E.previewBorrow(m, { units: 25000, gross: 100, paused: true }).canOpen, false);
});

test('MLN 12: actions in one market leave others untouched', () => {
  const s0 = freshState();
  let { state } = E.openPosition(s0, SAMPLE_POSITION);
  ({ state } = E.supply(state, { marketId: 'spud', amount: 500 }));
  for (const id of ['whisk', 'boost', 'peel']) assert.deepEqual(state.markets[id], s0.markets[id]);
});

test('MLN 13: partial, full and over repayment', () => {
  let { state, positionId } = E.openPosition(freshState(), SAMPLE_POSITION);
  ({ state } = E.accrue(state, { positionId, days: 30 }));
  const debt = E.positionDebt(state.positions[0]);
  ({ state } = E.repay(state, { positionId, amount: 50 }));
  close(E.positionDebt(state.positions[0]), debt - 50);
  ({ state } = E.repay(state, { positionId, amount: 10000 }));
  const p = state.positions[0];
  assert.equal(p.closed, true); assert.ok(E.positionDebt(p) >= 0);
  assert.match(state.history[0].result, /released/);
});

test('MLN 15: collateral withdrawal respects opening LTV and invalid prices', () => {
  let { state, positionId } = E.openPosition(freshState(), SAMPLE_POSITION);
  const v = E.positionView(state, state.positions[0]);
  close(v.maxWithdraw.units, 5000);          // keep 200 / (0.25 × 0.04) = 20,000 units
  assert.throws(() => E.withdrawCollateral(state, { positionId, units: 5001 }));
  ({ state } = E.withdrawCollateral(state, { positionId, units: 5000 }));
  state.scenario.spud = { priceState: 'stale' };
  assert.throws(() => E.withdrawCollateral(state, { positionId, units: 1 }));
});

test('MLN 04, 06: shares at exchange rate; redemption limited to unborrowed liquidity', () => {
  const s0 = freshState(); s0.lender = {};
  let { state } = E.supply(s0, { marketId: 'whisk', amount: 1000 });
  close(state.lender.whisk, 1000);
  const w = state.markets.whisk; w.borrowed += w.cash - 400; w.cash = 400;   // most funds borrowed, value per share unchanged
  const r = E.redeem(state, { marketId: 'whisk', amount: 1000 });
  close(r.paid, 400); close(r.remainder, 600);
  assert.equal(r.state.markets.whisk.reserve, state.markets.whisk.reserve); // reserve untouched
});

test('interest share: 15% of paid interest becomes revenue, split 60/40', () => {
  let { state, positionId } = E.openPosition(freshState(), SAMPLE_POSITION);
  const before = state.markets.spud.revenue.total;
  ({ state } = E.accrue(state, { positionId, days: 365 }));
  const i = state.positions[0].interest;
  ({ state } = E.repay(state, { positionId, amount: i }));
  close(state.markets.spud.revenue.total - before, i * 0.15);
});
