// Live market data for curated Robinhood Chain memes; loans are denominated in USDG.
//   Market stats: DexScreener public API  — GET /token-pairs/v1/{chain}/{USDG}
//   Price history: GeckoTerminal public API — GET /networks/{net}/pools/{pool}/ohlcv/{timeframe}
// Both are keyless. Everything returned is untrusted third-party data: it is validated, clamped and rendered as text only.
// Market parameters (LTV, liquidation threshold, cap, per-wallet limit) come from the listing rule below, which ties them
// to live pool liquidity. No supplied, borrowed or reserve balances are invented: markets start empty until launch.
import { CONFIG } from './config.js';
import { SNAPSHOT } from './snapshot.js';
import { MEME_TOKENS, memeToken, isMemeToken } from './meme-tokens.js';

const L = CONFIG.live;
const USDG = L.usdg.address.toLowerCase();
export const DEX_SOURCE = { name: 'DexScreener', url: 'https://dexscreener.com/robinhood' };
export const CHART_SOURCE = { name: 'GeckoTerminal', url: 'https://www.geckoterminal.com/robinhood/pools' };

async function getJSON(url, { headers } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), L.timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers, cache: 'no-store' });
    if (r.status === 429) throw Object.assign(new Error('The data provider is rate-limiting requests. Try again in a minute.'), { code: 'RATE' });
    if (!r.ok) throw Object.assign(new Error(`The data provider answered ${r.status}.`), { code: 'HTTP' });
    return await r.json();
  } catch (e) {
    if (e.name === 'AbortError') throw Object.assign(new Error('The data provider did not answer within 10 seconds.'), { code: 'TIMEOUT' });
    if (e.code) throw e;
    throw Object.assign(new Error('Live data could not be reached from this browser (network or browser blocking).'), { code: 'NETWORK' });
  } finally { clearTimeout(timer); }
}

const num = (v) => { const n = typeof v === 'string' ? Number(v) : v; return Number.isFinite(n) ? n : null; };
const txt = (v, max = 40) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, max);
const isAddr = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
const isPool = (a) => typeof a === 'string' && /^0x([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/.test(a);
const safeImg = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)dexscreener\.com$/.test(x.hostname) ? x.href : ''; } catch (e) { return ''; } };

// Normalise one DexScreener pair so the memecoin is always "token" and USDG always the quote side.
function normPair(p, usdgUsd = null) {
  if (!p || p.chainId !== L.dexscreenerChain || !isPool(p.pairAddress)) return null;
  const b = p.baseToken || {}, q = p.quoteToken || {};
  let token, inverted = false, quoteSymbol = 'USDG';
  if (String(q.address).toLowerCase() === USDG) token = b;
  else if (String(b.address).toLowerCase() === USDG) { token = q; inverted = true; }
  else if (isMemeToken(b.address) && L.quoteTokens[String(q.address).toLowerCase()]) {
    token = b; quoteSymbol = L.quoteTokens[String(q.address).toLowerCase()];
  } else return null;
  if (!isAddr(token.address) || !isMemeToken(token.address)) return null;
  const identity = memeToken(token.address);
  const native = num(p.priceNative);
  const usdBase = num(p.priceUsd);
  const priceUsdg = quoteSymbol === 'USDG'
    ? native == null || native <= 0 ? null : inverted ? 1 / native : native
    : usdBase > 0 && usdgUsd > 0 ? usdBase / usdgUsd : null;
  // DexScreener reports change, FDV, market cap and image for the BASE token; when USDG is the base, convert or drop them
  const pc = (c) => { const v = num(c); return v == null ? null : inverted ? (v <= -100 ? null : (100 / (100 + v) - 1) * 100) : v; };
  return {
    pairAddress: p.pairAddress, dexId: txt(p.dexId, 20), labels: Array.isArray(p.labels) ? p.labels.map((x) => txt(x, 8)) : [],
    token: { address: token.address, symbol: identity.symbol, name: identity.name },
    quoteSymbol, usdgUsd,
    tokenSide: inverted ? 'quote' : 'base',
    priceUsdg, priceUsd: usdBase == null || priceUsdg == null ? null : inverted ? priceUsdg * usdBase : usdBase,
    liquidityUsd: num(p.liquidity?.usd) ?? 0, volume24: num(p.volume?.h24) ?? 0,
    change: { m5: pc(p.priceChange?.m5), h1: pc(p.priceChange?.h1), h6: pc(p.priceChange?.h6), h24: pc(p.priceChange?.h24) },
    fdv: inverted ? null : num(p.fdv), marketCap: inverted ? null : num(p.marketCap),
    buys24: num(p.txns?.h24?.buys) ?? 0, sells24: num(p.txns?.h24?.sells) ?? 0,
    createdAt: num(p.pairCreatedAt), image: inverted ? '' : safeImg(p.info?.imageUrl),
  };
}

// One market per meme: price from its deepest supported pool, deduplicated pool stats.
export async function fetchUsdgMarkets() {
  // USDG's endpoint is capped at 30 pools. Fetch curated contracts too so memes
  // cannot be crowded out by stocks/utility tokens or multiple pools of one token.
  const batches = [];
  for (let i = 0; i < MEME_TOKENS.length; i += 30) batches.push(MEME_TOKENS.slice(i, i + 30).map(t => t.address).join(','));
  const results = await Promise.all([
    getJSON(`https://api.dexscreener.com/token-pairs/v1/${L.dexscreenerChain}/${L.usdg.address}`),
    ...batches.map(addresses => getJSON(`https://api.dexscreener.com/tokens/v1/${L.dexscreenerChain}/${addresses}`)),
  ]);
  return marketsFromPairs(results.flatMap(raw => Array.isArray(raw) ? raw : Array.isArray(raw?.pairs) ? raw.pairs : []), Date.now());
}

// The bundled snapshot: same rules, same sources, but fixed in time and labelled as such.
export const snapshotMarkets = () => ({ ...marketsFromPairs(SNAPSHOT.pairs, SNAPSHOT.fetchedAt), snapshot: true });
export const SNAPSHOT_AT = SNAPSHOT.fetchedAt;

export function marketsFromPairs(arr, fetchedAt) {
  arr = [...new Map(arr.filter(p => p?.chainId === L.dexscreenerChain && isPool(p.pairAddress)).map(p => [p.pairAddress.toLowerCase(), p])).values()];
  // Derive USDG's USD exchange rate from real USDG pools before converting ETH-pool prices.
  const anchors = arr.filter(p => p?.chainId === L.dexscreenerChain).flatMap(p => {
    const b = String(p.baseToken?.address).toLowerCase(), q = String(p.quoteToken?.address).toLowerCase();
    const usd = num(p.priceUsd), native = num(p.priceNative);
    const rate = b === USDG ? usd : q === USDG && native > 0 ? usd / native : null;
    return rate >= 0.5 && rate <= 1.5 && (num(p.liquidity?.usd) || 0) >= L.minLiquidityUsd ? [rate] : [];
  }).sort((a, b) => a - b);
  const mid = Math.floor(anchors.length / 2);
  const usdgUsd = anchors.length ? anchors.length % 2 ? anchors[mid] : (anchors[mid - 1] + anchors[mid]) / 2 : null;
  const unique = new Map();
  for (const raw of arr) {
    const p = normPair(raw, usdgUsd);
    if (p) unique.set(p.pairAddress.toLowerCase(), p);
  }
  const pairs = [...unique.values()];
  const groups = new Map();
  for (const p of pairs) {
    const k = p.token.address.toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const all = [...groups.values()].map((ps) => {
    ps.sort((a, b) => b.liquidityUsd - a.liquidityUsd);
    const top = ps[0];
    const liquid = ps.filter((p) => p.liquidityUsd >= L.minLiquidityUsd && p.priceUsdg);
    const prices = liquid.map((p) => p.priceUsdg);
    const deviation = prices.length > 1 ? (Math.max(...prices) - Math.min(...prices)) / Math.min(...prices) : 0;
    return {
      address: top.token.address, symbol: top.token.symbol, name: top.token.name, image: ps.find((p) => p.image)?.image || '',
      priceUsdg: top.priceUsdg, priceUsd: top.priceUsd, change: top.change,
      liquidityUsd: ps.reduce((a, p) => a + p.liquidityUsd, 0), volume24: ps.reduce((a, p) => a + p.volume24, 0),
      buys24: ps.reduce((a, p) => a + p.buys24, 0), sells24: ps.reduce((a, p) => a + p.sells24, 0),
      fdv: top.fdv ?? ps.find((p) => p.fdv != null)?.fdv ?? null, marketCap: top.marketCap ?? ps.find((p) => p.marketCap != null)?.marketCap ?? null,
      createdAt: ps.some((p) => p.createdAt) ? Math.min(...ps.filter((p) => p.createdAt).map((p) => p.createdAt)) : null,
      deviation, pools: ps.map((p) => ({ address: p.pairAddress, dex: p.dexId, version: p.labels[0] || '', liquidityUsd: p.liquidityUsd, side: p.tokenSide, quote: p.quoteSymbol })),
      primaryPool: top.pairAddress, primarySide: top.tokenSide, primaryQuote: top.quoteSymbol, usdgUsd,
      primaryLiquidityUsd: top.liquidityUsd,
    };
  });
  const kept = all.filter((t) => t.primaryLiquidityUsd >= L.minLiquidityUsd && t.priceUsdg > 0).sort((a, b) => b.liquidityUsd - a.liquidityUsd).slice(0, L.maxMarkets);
  return { tokens: kept, hidden: all.length - kept.length, fetchedAt };
}

// Price history (USD; USDG tracks USD). timeframe: '1D' | '7D' | '30D' | '90D'
const TF = { '1D': ['minute', 15, 96], '7D': ['hour', 1, 168], '30D': ['hour', 4, 180], '90D': ['day', 1, 90] };
// `token` is the memecoin's address (GeckoTerminal accepts base | quote | token address), so the chart is always that token's price.
export async function fetchCandles(pool, token, timeframe = '7D') {
  if (!isPool(pool)) throw new Error('Invalid pool address.');
  const [unit, agg, limit] = TF[timeframe] || TF['7D'];
  const url = `https://api.geckoterminal.com/api/v2/networks/${L.geckoNetwork}/pools/${pool}/ohlcv/${unit}?aggregate=${agg}&limit=${limit}&currency=usd&token=${isAddr(token) ? token : token === 'quote' ? 'quote' : 'base'}`;
  let j, fetchedAt = Date.now(), snapshot = false;
  try { j = await getJSON(url, { headers: { Accept: 'application/json;version=20230302' } }); }
  catch (e) {
    // live history blocked: use the bundled snapshot (1D/7D from hourly candles, 30D/90D from daily)
    const c = SNAPSHOT.candles[pool.toLowerCase()];
    const src = c && (timeframe === '1D' || timeframe === '7D' ? c.hour : c.day);
    if (!src) throw e;
    const keep = timeframe === '1D' ? 24 : timeframe === '30D' ? 30 : src.length;
    j = { data: { attributes: { ohlcv_list: [...src].sort((a, b) => a[0] - b[0]).slice(-keep) } } };
    fetchedAt = SNAPSHOT.fetchedAt; snapshot = true;
  }
  const list = j?.data?.attributes?.ohlcv_list;
  if (!Array.isArray(list)) throw Object.assign(new Error('No price history is available for this pool yet.'), { code: 'EMPTY' });
  const rows = list.map((r) => ({ t: num(r[0]) * 1000, o: num(r[1]), h: num(r[2]), l: num(r[3]), c: num(r[4]), v: num(r[5]) }))
    .filter((r) => r.t && r.c != null && r.c > 0).sort((a, b) => a.t - b.t);
  if (!rows.length) throw Object.assign(new Error('No price history is available for this pool yet.'), { code: 'EMPTY' });
  return { rows, fetchedAt, timeframe, snapshot };
}

// ---------- turning a live token into a Meloan market ----------
const roundNice = (v) => { if (v <= 0) return 0; const p = 10 ** Math.floor(Math.log10(v)); return Math.round(v / p * 2) / 2 * p; };

// Listing rule: cap = 5% of live pool liquidity (WP §6.1 ties caps to executable liquidity); LTV tier by liquidity depth.
// Balances start at zero; `cash` is set to the cap only so the borrow calculator's limit equals the market cap.
export function launchParams(t) {
  const liq = t.liquidityUsd;
  const tier = liq >= 1_000_000 ? { openLTV: 0.25, liqThreshold: 0.40, tier: 'Deep (≥ $1M pool liquidity)' }
    : liq >= 250_000 ? { openLTV: 0.20, liqThreshold: 0.35, tier: 'Medium ($250k–$1M)' }
      : { openLTV: 0.15, liqThreshold: 0.30, tier: 'Thin (< $250k)' };
  const cap = Math.max(1000, roundNice(liq * 0.05));
  return {
    ...tier, cap, accountLimit: roundNice(cap * 0.2), cash: cap, borrowed: 0, shares: cap,
    reserve: 0, lossRecognized: 0,
    rate: { base: 0.03, slope1: 0.2, slope2: 0.6, kink: 0.7, max: 0.9 },
  };
}

export { normPair };
export const demoParams = launchParams;   // old name, kept for tests

export function priceStateOf(t, fetchedAt, now = Date.now(), snapshot = false) {
  if (!t.priceUsdg || !Number.isFinite(t.priceUsdg)) return 'missing';
  if (!snapshot && (now - fetchedAt) / 1000 > L.maxPriceAgeSec) return 'stale';
  if (t.deviation > L.maxSourceDeviation) return 'conflict';
  return 'ok';
}

export function marketFromLive(t, fetchedAt, prev, snapshot = false) {
  const live = {
    source: 'live', id: t.address.toLowerCase(), address: t.address, symbol: t.symbol, name: t.name || t.symbol, image: t.image,
    price: t.priceUsdg, priceState: priceStateOf(t, fetchedAt, Date.now(), snapshot), fetchedAt, snapshot, maxPriceAgeSec: L.maxPriceAgeSec,
    stats: { priceUsd: t.priceUsd, change: t.change, liquidityUsd: t.liquidityUsd, volume24: t.volume24, buys24: t.buys24, sells24: t.sells24, fdv: t.fdv, marketCap: t.marketCap, createdAt: t.createdAt, deviation: t.deviation, pools: t.pools },
    primaryPool: t.primaryPool, primarySide: t.primarySide, primaryQuote: t.primaryQuote || 'USDG', usdgUsd: t.usdgUsd,
    unitDecimals: 2, paused: false, retired: false, category: 'meme',
    blurb: `Robinhood Chain meme · priced from its deepest ${t.primaryQuote || 'USDG'} pool.`,
  };
  return { ...launchParams(t), ...live, priceAgeSec: 0, revenue: { total: 0, reserve: 0, operations: 0 } };
}

// Merge a fresh fetch into the saved state: markets refresh in place; fallback markets leave once real data exists.
export function mergeLive(state, { tokens, hidden, fetchedAt, snapshot = false }, error = '') {
  const s = JSON.parse(JSON.stringify(state));
  const used = new Set([...s.positions.filter((p) => !p.closed).map((p) => p.marketId), ...Object.entries(s.lender).filter(([, v]) => v > 1e-9).map(([k]) => k)]);
  const ids = new Set();
  for (const t of tokens) { if (!isMemeToken(t.address)) continue; const id = t.address.toLowerCase(); ids.add(id); s.markets[id] = marketFromLive(t, fetchedAt, s.markets[id], snapshot); }
  for (const [id, m] of Object.entries(s.markets)) {
    if (ids.has(id)) continue;
    if (used.has(id)) { m.retired = true; m.paused = true; continue; }
    delete s.markets[id];
  }
  s.live = { status: snapshot ? 'snapshot' : 'ok', fetchedAt, error, hidden };
  return s;
}

// Remove legacy mixed listings immediately, even when the next API refresh fails.
// Keep records backing existing positions for repayment/withdrawal, outside new-market lists.
export function enforceMemeMarkets(state) {
  const s = JSON.parse(JSON.stringify(state));
  const used = new Set([...s.positions.filter(p => !p.closed).map(p => p.marketId), ...Object.entries(s.lender).filter(([, v]) => v > 1e-9).map(([id]) => id)]);
  for (const [id, m] of Object.entries(s.markets)) {
    if (m.source === 'live' && isMemeToken(m.address)) continue;
    if (used.has(id)) { m.retired = true; m.paused = true; }
    else delete s.markets[id];
  }
  return s;
}

// Called periodically: live prices age into Stale without a new fetch (never shown as live when old — MLN 32)
export function ageLive(state, now = Date.now()) {
  let changed = false;
  const s = JSON.parse(JSON.stringify(state));
  for (const m of Object.values(s.markets)) {
    if (m.source !== 'live' || m.snapshot) continue;
    const age = Math.round((now - m.fetchedAt) / 1000);
    const st = age > L.maxPriceAgeSec ? 'stale' : m.stats.deviation > L.maxSourceDeviation ? 'conflict' : m.price ? 'ok' : 'missing';
    if (st !== m.priceState || age !== m.priceAgeSec) { m.priceState = st; m.priceAgeSec = age; changed = true; }
  }
  return changed ? s : null;
}
