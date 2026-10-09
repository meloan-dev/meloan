// usage: node pools.mjs dex.json  -> prints "pool tokenAddress symbol" for each kept token (same rule as the app)
import fs from 'node:fs';
const USDG = '0x5fc5360d0400a0fd4f2af552add042d716f1d168';
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const g = new Map();
for (const p of raw) {
  const b = p.baseToken, q = p.quoteToken; let t, inv = false;
  if (q.address.toLowerCase() === USDG) t = b; else if (b.address.toLowerCase() === USDG) { t = q; inv = true; } else continue;
  const k = t.address.toLowerCase(); if (!g.has(k)) g.set(k, []); g.get(k).push({ p, t, liq: p.liquidity?.usd || 0 });
}
const kept = [...g.values()].map((ps) => { ps.sort((a, b) => b.liq - a.liq); return { top: ps[0], liq: ps.reduce((a, x) => a + x.liq, 0) }; })
  .filter((x) => x.liq >= 25000).sort((a, b) => b.liq - a.liq).slice(0, 16);
for (const x of kept) console.log(x.top.p.pairAddress, x.top.t.address, x.top.t.symbol);
