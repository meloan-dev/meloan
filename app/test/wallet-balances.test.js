import test from 'node:test';
import assert from 'node:assert/strict';
import { readTokenBalance, validateCollateralBalance, formatTokenUnits, amountToTokenUnits } from '../src/wallet-balances.js';
import { CONFIG } from '../src/config.js';
import { MEME_TOKENS } from '../src/meme-tokens.js';

const CASHCAT = MEME_TOKENS.find(t => t.symbol === 'CASHCAT').address;
const account = '0x' + 'ab'.repeat(20), other = '0x' + 'cd'.repeat(20);
const hex = n => '0x' + BigInt(n).toString(16).padStart(64, '0');
function wallet({ amount = 10000n * 10n ** 18n, decimals = 18, chain = CONFIG.network.chainId, owner = account } = {}) {
  const calls = [];
  const provider = { calls, async request({ method, params }) {
    calls.push({ method, params });
    if (method === 'eth_chainId') return '0x' + chain.toString(16);
    if (method === 'eth_accounts') return [owner];
    if (method === 'eth_call') return params[0].data.startsWith('0x70a08231') ? hex(amount) : hex(decimals);
    throw new Error('Unexpected wallet write: ' + method);
  } };
  return provider;
}

test('10,000 CASHCAT balance allows 10,000 collateral and rejects 20,000', async () => {
  const provider = wallet();
  const balance = await readTokenBalance(CASHCAT, { provider, account });
  assert.equal(balance.amount, '10000');
  assert.equal(validateCollateralBalance(balance, '10,000').ok, true);
  assert.equal(validateCollateralBalance(balance, '20,000').ok, false);
  const call = provider.calls.find(c => c.method === 'eth_call' && c.params[0].data.startsWith('0x70a08231'));
  assert.equal(call.params[0].to, CASHCAT);
  assert.equal(call.params[0].data, '0x70a08231' + account.slice(2).padStart(64, '0'));
  assert.ok(provider.calls.every(c => ['eth_call', 'eth_chainId', 'eth_accounts'].includes(c.method)));
});

test('zero, stale and unavailable holdings block review', async () => {
  const balance = await readTokenBalance(CASHCAT, { provider: wallet({ amount: 0n }), account });
  assert.equal(validateCollateralBalance(balance, '1').ok, false);
  assert.equal(validateCollateralBalance(null, '1').ok, false);
  assert.equal(validateCollateralBalance({ ...balance, raw: 100n }, '1', balance.fetchedAt + 30001).ok, false);
});

test('raw-unit comparison never rounds up fractional balances, including high precision', async () => {
  const raw = 10000n * 10n ** 18n - 1n;
  const balance = await readTokenBalance(CASHCAT, { provider: wallet({ amount: raw }), account });
  assert.equal(validateCollateralBalance(balance, '10000').ok, false);
  assert.equal(validateCollateralBalance(balance, '9999.99').ok, true);
  assert.equal(formatTokenUnits(raw, 18, 2), '9999.99');
  assert.equal(amountToTokenUnits('9007199254740993.000001', 6), 9007199254740993000001n);
  assert.throws(() => amountToTokenUnits('1.0000001', 6), /decimal/);
});

test('wrong network and wrong account are rejected before token reads', async () => {
  const wrongChain = wallet({ chain: 1 });
  await assert.rejects(readTokenBalance(CASHCAT, { provider: wrongChain, account }), /Switch your wallet/);
  assert.ok(!wrongChain.calls.some(c => c.method === 'eth_call'));
  await assert.rejects(readTokenBalance(CASHCAT, { provider: wallet({ owner: other }), account }), /account changed/);
});

test('account/network switches during a read invalidate its result', async () => {
  const provider = wallet();
  const request = provider.request.bind(provider);
  let accountReads = 0;
  provider.request = args => args.method === 'eth_accounts' && ++accountReads === 2 ? Promise.resolve([other]) : request(args);
  await assert.rejects(readTokenBalance(CASHCAT, { provider, account }), /account changed/);
});

test('RPC errors, missing decimals and unlisted assets fail closed', async () => {
  const failing = wallet(); failing.request = async () => { throw new Error('RPC unavailable'); };
  await assert.rejects(readTokenBalance(CASHCAT, { provider: failing, account }), /RPC unavailable/);
  const invalid = wallet(); const original = invalid.request.bind(invalid);
  invalid.request = args => args.method === 'eth_call' ? Promise.resolve('0x') : original(args);
  await assert.rejects(readTokenBalance(CASHCAT, { provider: invalid, account }), /invalid balance response/);
  await assert.rejects(readTokenBalance('0x' + 'ef'.repeat(20), { provider: wallet(), account }), /not a listed/);
});

test('6-decimal and zero-decimal ERC20 balances use the contract precision', async () => {
  const six = await readTokenBalance(CASHCAT, { provider: wallet({ amount: 12345678n, decimals: 6 }), account });
  assert.equal(six.amount, '12.345678');
  assert.equal(validateCollateralBalance(six, '12.345679').ok, false);
  const zero = await readTokenBalance(CASHCAT, { provider: wallet({ amount: 17n, decimals: 0 }), account });
  assert.equal(zero.amount, '17');
  assert.equal(validateCollateralBalance(zero, '17.1').ok, false);
});

for (const token of MEME_TOKENS) {
  test(`${token.symbol}: collateral cannot exceed the selected token's actual holdings`, async () => {
    const provider = wallet();
    const balance = await readTokenBalance(token.address, { provider, account });
    assert.equal(validateCollateralBalance(balance, '10000').ok, true);
    assert.equal(validateCollateralBalance(balance, '20000').ok, false);
    assert.equal(balance.token, token.address);
    const reads = provider.calls.filter(c => c.method === 'eth_call');
    assert.ok(reads.every(c => c.params[0].to === token.address));
    assert.ok(provider.calls.every(c => ['eth_call', 'eth_chainId', 'eth_accounts'].includes(c.method)));
  });
}
