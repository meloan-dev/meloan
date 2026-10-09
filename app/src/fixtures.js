// Example markets. Every value is illustrative (PRD MLN 02): no production market, asset or parameter exists yet.
// SPUD reproduces the PRD fixture: 25,000 units × 0.04 = 1,000 collateral value, opening LTV 25%, threshold 40%.
export const STABLE = { symbol: 'USDG', name: 'Global Dollar (USDG)', decimals: 2, note: 'Global Dollar by Paxos, the loan asset of every market.' };

const rate = (base, slope1, slope2, kink, max) => ({ base, slope1, slope2, kink, max });

export const MARKETS = [
  {
    id: 'spud', symbol: 'SPUD', name: 'Spud', face: 'potato', unitDecimals: 2,
    price: 0.04, priceState: 'ok', priceAgeSec: 42, maxPriceAgeSec: 300, paused: false,
    openLTV: 0.25, liqThreshold: 0.40, cap: 250000, accountLimit: 50000,
    cash: 220000, borrowed: 180000, shares: 400000, lossRecognized: 0, reserve: 12000,
    rate: rate(0.02, 0.18, 0.6, 0.7, 0.8),
    blurb: 'Deepest example market. Conservative 25% opening LTV.',
  },
  {
    id: 'whisk', symbol: 'WHISK', name: 'Whisk', face: 'cat', unitDecimals: 0,
    price: 0.0085, priceState: 'ok', priceAgeSec: 75, maxPriceAgeSec: 300, paused: false,
    openLTV: 0.20, liqThreshold: 0.35, cap: 120000, accountLimit: 25000,
    cash: 30000, borrowed: 120000, shares: 150000, lossRecognized: 0, reserve: 4000,
    rate: rate(0.03, 0.2, 0.45, 0.7, 0.8),
    blurb: 'Highly utilised: borrowing costs more and withdrawals are limited.',
  },
  {
    id: 'boost', symbol: 'BOOST', name: 'Boost', face: 'rocket', unitDecimals: 2,
    price: 1.37, priceState: 'ok', priceAgeSec: 18, maxPriceAgeSec: 300, paused: false,
    openLTV: 0.30, liqThreshold: 0.45, cap: 300000, accountLimit: 60000,
    cash: 400000, borrowed: 100000, shares: 500000, lossRecognized: 0, reserve: 20000,
    rate: rate(0.02, 0.16, 0.6, 0.75, 0.75),
    blurb: 'Plenty of liquidity and a larger reserve.',
  },
  {
    id: 'peel', symbol: 'PEEL', name: 'Peel', face: 'banana', unitDecimals: 0,
    price: 0.21, priceState: 'stale', priceAgeSec: 940, maxPriceAgeSec: 300, paused: true,
    openLTV: 0.20, liqThreshold: 0.35, cap: 80000, accountLimit: 20000,
    cash: 30000, borrowed: 60000, shares: 90000, lossRecognized: 0, reserve: 2500,
    rate: rate(0.03, 0.2, 0.9, 0.7, 1.0),
    blurb: 'Shows a paused market with a stale price.',
  },
];

export function freshState() {
  const markets = {};
  for (const m of MARKETS) markets[m.id] = { ...JSON.parse(JSON.stringify(m)), source: 'example', revenue: { total: 0, reserve: 0, operations: 0 } };
  // a sample lender holding in the busy WHISK market (part of its existing shares) so a partial withdrawal can be tried
  return { v: 3, seq: 0, markets, positions: [], lender: {}, history: [], scenario: {}, live: { status: 'idle', fetchedAt: 0, error: '', hidden: 0 } };
}

// PRD fixture position: C = 1,000, debt 200 → LTV 20%, health 2
export const SAMPLE_POSITION = { marketId: 'spud', units: 25000, gross: 200 };
