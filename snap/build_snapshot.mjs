// Bundles the fetched DexScreener + GeckoTerminal responses into app/src/snapshot.js (compact, validated).
import fs from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const fetchedAt = Math.floor(fs.statSync(dir + 'dex-memes.json').mtimeMs);
const pairs = JSON.parse(fs.readFileSync(dir + 'dex-memes.json', 'utf8')).map((p) => ({
  chainId: p.chainId, dexId: p.dexId, pairAddress: p.pairAddress, labels: p.labels, baseToken: p.baseToken, quoteToken: p.quoteToken,
  priceNative: p.priceNative, priceUsd: p.priceUsd, txns: { h24: p.txns?.h24 }, volume: { h24: p.volume?.h24 }, priceChange: p.priceChange,
  liquidity: { usd: p.liquidity?.usd }, fdv: p.fdv, marketCap: p.marketCap, pairCreatedAt: p.pairCreatedAt,
  info: { imageUrl: (p.info?.imageUrl || '').replace(/&amp;/g, '&') },
}));
const sig = (v) => (v == null ? null : Number(Number(v).toPrecision(6)));
const candles = {};
for (const f of fs.readdirSync(dir + 'ohlcv')) {
  const m = f.match(/^(0x[0-9a-f]+)_(hour|day)\.json$/); if (!m) continue;
  const list = JSON.parse(fs.readFileSync(dir + 'ohlcv/' + f, 'utf8')).data.attributes.ohlcv_list;
  (candles[m[1]] ||= {})[m[2]] = list.map((r) => [r[0], sig(r[1]), sig(r[2]), sig(r[3]), sig(r[4]), Math.round(r[5])]);
}
const out = `// Snapshot of public Robinhood Chain × USDG market data, used when this page cannot reach the live APIs
// (the hosted artifact view blocks outside requests). Sources: DexScreener (pairs) and GeckoTerminal (OHLCV).
// Taken ${new Date(fetchedAt).toISOString()}. Regenerate with meloan/snap/build_snapshot.mjs.
export const SNAPSHOT = ${JSON.stringify({ fetchedAt, pairs, candles })};
`;
fs.writeFileSync(dir + '../app/src/snapshot.js', out);
console.log('pairs', pairs.length, 'pools', Object.keys(candles).length, 'bytes', out.length, new Date(fetchedAt).toISOString());
