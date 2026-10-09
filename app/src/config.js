// One token and link configuration for the whole site (PRD MLN 31).
// Leave a value empty until it is officially announced; every chip, tooltip and link reads from here.
export const CONFIG = {
  name: 'Meloan',
  tagline: 'Keep the meme. Unlock the liquidity.',
  ticker: '',                 // not issued
  contractAddress: '',        // CA — unset until launch
  caTooltip: 'Contract address will be announced at launch.',
  xUrl: '',                   // official X account not supplied yet
  buyUrl: '',                 // shown only once CA and destination are verified
  chartUrl: '',
  network: {
    name: 'Robinhood Chain', chainId: 4663, explorer: 'https://robinhoodchain.blockscout.com',
    verified: false,          // PRD open decision: confirm chain ID, RPC, explorer and wallets first-party
  },
  // Curated Robinhood Chain memes; loans use USDG, prices use verified USDG/ETH/WETH pools.
  live: {
    enabled: true,
    dexscreenerChain: 'robinhood',             // DexScreener chainId
    geckoNetwork: 'robinhood',                 // GeckoTerminal network id
    usdg: {
      address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',   // official USDG on Robinhood Chain (Paxos docs)
      source: 'https://docs.paxos.com/guides/stablecoin/usdg/mainnet',
    },
    minLiquidityUsd: 25000,                    // smaller pools are hidden (thin markets are easy to manipulate, WP §2, §6)
    quoteTokens: {
      '0x0000000000000000000000000000000000000000': 'ETH',
      '0x0bd7d308f8e1639fab988df18a8011f41eacad73': 'WETH',
    },
    maxMarkets: 32,
    refreshMs: 60000,                          // one DexScreener request per minute, well under its published rate limit
    maxPriceAgeSec: 300,                       // older than this = Stale (WP §7)
    maxSourceDeviation: 0.05,                  // USDG pools of one token disagreeing by >5% = Sources disagree (WP §7)
    timeoutMs: 10000,                          // PRD: a 10-second timeout ends in a recoverable error
  },
  storyUrl: 'https://claude.ai/artifact/RnrFxQVDEbAiosECZ8J3Rt',
  whitepaperUrl: '#/docs',
};
