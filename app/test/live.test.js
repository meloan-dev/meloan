// Live-data tests with synthetic DexScreener / GeckoTerminal payloads (no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as LV from '../src/live.js';
import { freshState } from '../src/fixtures.js';
import { CONFIG } from '../src/config.js';
import { previewBorrow } from '../src/engine.js';
import { MEME_TOKENS, isMemeToken } from '../src/meme-tokens.js';

const USDG = CONFIG.live.usdg.address;
const [A, B, C] = MEME_TOKENS.map(t => t.address);
const FAKE = '0x' + 'dd'.repeat(20);
const pool = (n) => '0x' + n.toString(16).padStart(64, '0');
const pair = ({ base, quote, native, usd = native, liq, id, change = 5, vol = 1000 }) => ({
  chainId: 'robinhood', dexId: 'uniswap', pairAddress: pool(id), labels: ['v4'],
  baseToken: { address: base, symbol: base === USDG ? 'USDG' : 'TK' + id, name: 'Token ' + id },
  quoteToken: { address: quote, symbol: quote === USDG ? 'USDG' : 'X', name: 'q' },
  priceNative: String(native), priceUsd: String(usd), txns: { h24: { buys: 10, sells: 4 } }, volume: { h24: vol },
  priceChange: { h1: 1, h6: 2, h24: change }, liquidity: { usd: liq }, fdv: 1e6, marketCap: 9e5, pairCreatedAt: 1.7e12,
  info: { imageUrl: 'https://cdn.dexscreener.com/x.png' },
});
const mockFetch = (body, status = 200) => { globalThis.fetch = async () => ({ ok: status < 400, status, json: async () => body }); };

test('normPair keeps only pairs against the official USDG and inverts USDG-base pairs', () => {
  const n = LV.normPair(pair({ base: A, quote: USDG, native: 0.002, liq: 50000, id: 1 }));
  assert.equal(n.token.address, A); assert.equal(n.priceUsdg, 0.002); assert.equal(n.tokenSide, 'base');
  assert.equal(LV.normPair(pair({ base: A, quote: FAKE, native: 1, liq: 50000, id: 2 })), null, 'look-alike USDG rejected');
  const inv = LV.normPair(pair({ base: USDG, quote: B, native: 500, usd: 1, liq: 50000, id: 3, change: 25 }));
  assert.equal(inv.token.address, B); assert.equal(inv.priceUsdg, 1 / 500); assert.equal(inv.tokenSide, 'quote');
  assert.ok(Math.abs(inv.change.h24 - -20) < 1e-9, 'USDG +25% means token −20%');
  assert.equal(inv.fdv, null); assert.equal(inv.image, '');
  assert.equal(LV.normPair({ ...pair({ base: A, quote: USDG, native: 1, liq: 1, id: 4 }), chainId: 'ethereum' }), null);
  assert.equal(LV.normPair({ ...pair({ base: A, quote: USDG, native: 1, liq: 1, id: 5 }), info: { imageUrl: 'https://evil.example/x.png' } }).image, '');
});

test('fetchUsdgMarkets groups pools per token, hides thin tokens and flags source disagreement', async () => {
  mockFetch([
    pair({ base: A, quote: USDG, native: 0.01, liq: 400000, id: 10, vol: 5000 }),
    pair({ base: A, quote: USDG, native: 0.0108, liq: 60000, id: 11, vol: 1000 }),
    pair({ base: B, quote: USDG, native: 2, liq: 30000, id: 12 }),
    pair({ base: C, quote: USDG, native: 1, liq: 900, id: 13 }),
    pair({ base: A, quote: FAKE, native: 9, liq: 9e6, id: 14 }),
  ]);
  const r = await LV.fetchUsdgMarkets();
  assert.equal(r.tokens.length, 2); assert.equal(r.hidden, 1);
  const a = r.tokens[0];
  assert.equal(a.address, A); assert.equal(a.priceUsdg, 0.01, 'price from deepest pool');
  assert.equal(a.liquidityUsd, 460000); assert.equal(a.volume24, 6000); assert.equal(a.pools.length, 2);
  assert.ok(Math.abs(a.deviation - 0.08) < 1e-9);
  assert.equal(LV.priceStateOf(a, Date.now()), 'conflict');
  assert.equal(LV.priceStateOf(r.tokens[1], Date.now()), 'ok');
});

test('fetch errors become readable, recoverable messages', async () => {
  mockFetch({}, 429); await assert.rejects(LV.fetchUsdgMarkets(), /rate-limiting/);
  mockFetch({}, 500); await assert.rejects(LV.fetchUsdgMarkets(), /answered 500/);
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(LV.fetchUsdgMarkets(), /could not be reached/);
});

test('fetchCandles sorts rows, drops bad ones and asks for the token by address', async () => {
  let url = '';
  globalThis.fetch = async (u) => { url = u; return { ok: true, status: 200, json: async () => ({ data: { attributes: { ohlcv_list: [[200, 1, 2, 0.5, 1.5, 9], [100, 1, 1, 1, 1, 1], [300, 1, 1, 1, null, 1]] } } }) }; };
  const r = await LV.fetchCandles(pool(10), A, '1D');
  assert.deepEqual(r.rows.map((x) => x.t), [100000, 200000]);
  assert.match(url, /ohlcv\/minute\?aggregate=15&limit=96/); assert.ok(url.includes(`token=${A}`));
  await assert.rejects(LV.fetchCandles('nope', A), /Invalid pool/);
});

test('demoParams: cap from liquidity, tiers, stable seeded balances that respect the cap', () => {
  const deep = LV.demoParams({ address: A, liquidityUsd: 2e6 }), thin = LV.demoParams({ address: B, liquidityUsd: 40000 });
  assert.equal(deep.openLTV, 0.25); assert.equal(thin.openLTV, 0.15);
  assert.equal(deep.cap, 100000); assert.ok(deep.borrowed <= deep.cap); assert.ok(deep.cash > 0);
  assert.deepEqual(LV.demoParams({ address: A, liquidityUsd: 2e6 }), deep, 'deterministic');
});

test('mergeLive replaces untouched examples, keeps used ones as retired, and ageLive marks old prices Stale', async () => {
  mockFetch([pair({ base: A, quote: USDG, native: 0.01, liq: 400000, id: 10 }), pair({ base: B, quote: USDG, native: 2, liq: 300000, id: 12 })]);
  const r = await LV.fetchUsdgMarkets();
  let s = LV.mergeLive(freshState(), r);
  assert.ok(!s.markets.spud && !s.markets.whisk, 'unused examples removed');
  assert.equal(Object.keys(s.markets).length, 2); assert.equal(s.live.status, 'ok');
  assert.equal(Object.keys(s.lender).length, 0, 'no invented holdings');
  assert.equal(s.markets[A.toLowerCase()].borrowed, 0, 'markets start empty');
  // a sample position on a live market survives a later fetch that no longer lists the token
  const m = s.markets[A.toLowerCase()];
  const pv = previewBorrow(m, { units: 100000, gross: 0, scenario: {}, paused: false });
  assert.ok(pv.capacity.value > 0);
  s.positions.push({ id: 'p1', marketId: m.id, units: 100000, closed: false });
  const s2 = LV.mergeLive(s, { tokens: r.tokens.filter((t) => t.address !== A), hidden: 0, fetchedAt: Date.now() });
  assert.equal(s2.markets[m.id].retired, true);
  const s3 = LV.mergeLive(s2, r);
  assert.equal(s3.markets[m.id].retired, false, 'returns to the live list');
  const aged = LV.ageLive(s3, Date.now() + 10 * 60000);
  assert.equal(aged.markets[B.toLowerCase()].priceState, 'stale');
});

test('bundled snapshot yields real USDG markets, never Stale, with chart candles', () => {
  const r = LV.snapshotMarkets();
  assert.ok(r.snapshot && r.tokens.length >= 5);
  const s = LV.mergeLive(freshState(), r);
  const ms = Object.values(s.markets);
  assert.ok(ms.every((m) => m.source === 'live' && m.snapshot));
  assert.equal(s.live.status, 'snapshot');
  assert.equal(LV.ageLive(s, Date.now() + 864e5), null, 'snapshot prices do not age into Stale');
});

test('stocks, utility contracts and look-alike meme symbols cannot enter markets', () => {
  const stock = pair({ base: '0xdf0992e440dd0be65bd8439b609d6d4366bf1cb5', quote: USDG, native: 82, liq: 7e6, id: 101 });
  const fake = pair({ base: FAKE, quote: USDG, native: 1, liq: 9e6, id: 102 });
  fake.baseToken.symbol = 'CASHCAT'; fake.baseToken.name = 'Cash Cat';
  const utility = pair({ base: '0x39dbed3a2bd333467115de45665cc57f813c4571', quote: USDG, native: 1, liq: 9e6, id: 103 });
  assert.equal(LV.normPair(stock), null);
  assert.equal(LV.normPair(fake), null);
  assert.equal(LV.normPair(utility), null);
  const r = LV.marketsFromPairs([stock, utility, fake, pair({ base: B, quote: USDG, native: 0.1, liq: 30000, id: 104 })], Date.now());
  assert.deepEqual(r.tokens.map(t => t.address), [B]);
});

test('ETH meme pools convert USD prices using the USDG reference, and duplicate pools are counted once', () => {
  const anchor = pair({ base: A, quote: USDG, native: 2, usd: 1.96, liq: 40000, id: 201 });
  const eth = pair({ base: B, quote: '0x0000000000000000000000000000000000000000', native: 0.001, usd: 2.45, liq: 500000, id: 202 });
  const r = LV.marketsFromPairs([anchor, anchor, eth, eth], Date.now());
  const token = r.tokens.find(t => t.address === B);
  assert.ok(Math.abs(token.priceUsdg - 2.5) < 1e-12);
  assert.equal(token.primaryQuote, 'ETH');
  assert.equal(token.liquidityUsd, 500000);
  assert.equal(token.pools.length, 1);
  assert.equal(token.usdgUsd, 0.98);
  assert.equal(LV.marketsFromPairs([eth], Date.now()).tokens.length, 0, 'no invented USDG conversion when the reference is unavailable');
});

test('every listed meme needs one sufficiently liquid pool, not an aggregate of tiny pools', () => {
  const r = LV.marketsFromPairs([
    pair({ base: A, quote: USDG, native: 1, liq: 20000, id: 301 }),
    pair({ base: A, quote: USDG, native: 1, liq: 20000, id: 302 }),
  ], Date.now());
  assert.equal(r.tokens.length, 0);
});

test('cached mixed markets are removed immediately, while existing positions retain retired records', () => {
  const s = freshState();
  const stock = '0xdf0992e440dd0be65bd8439b609d6d4366bf1cb5';
  const utility = '0x39dbed3a2bd333467115de45665cc57f813c4571';
  s.markets[stock] = { id: stock, address: stock, source: 'live' };
  s.markets[utility] = { id: utility, address: utility, source: 'live' };
  s.positions.push({ id: 'old', marketId: stock, closed: false });
  const cleaned = LV.enforceMemeMarkets(s);
  assert.equal(cleaned.markets[utility], undefined);
  assert.equal(cleaned.markets[stock].retired, true);
  assert.equal(cleaned.markets[stock].paused, true);
  const empty = LV.mergeLive(cleaned, { tokens: [], hidden: 0, fetchedAt: Date.now() });
  assert.deepEqual(Object.keys(empty.markets), [stock]);
  assert.equal(empty.positions[0].marketId, stock);
  assert.equal(isMemeToken(stock), false);
});

test('expanded feed queries curated contracts in addition to USDG pools', async () => {
  const urls = [];
  globalThis.fetch = async url => { urls.push(url); return { ok: true, status: 200, json: async () => [] }; };
  await LV.fetchUsdgMarkets();
  assert.ok(urls.some(url => url.includes('/token-pairs/v1/robinhood/')));
  assert.ok(urls.some(url => url.includes('/tokens/v1/robinhood/') && url.includes(MEME_TOKENS.find(t => t.symbol === 'BUN').address)));
});
