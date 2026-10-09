<p align="center"><a href="https://meloan.xyz"><img src="docs/assets/meloan-banner.jpg" width="1280" alt="Meloan Soft Buddy overlooking a galactic world of floating castles" /></a></p>
<h1 align="center">Meloan</h1>
<p align="center"><strong>Keep the meme. Unlock the liquidity.</strong></p>
<p align="center">A meme-backed lending interface for Robinhood Chain, with USDG as the proposed loan asset.</p>
<p align="center"><a href="https://meloan.xyz">Open Meloan</a> · <a href="https://meloan.xyz/app/index.html#/docs">Whitepaper</a> · <a href="docs/GETTING_STARTED.md">Get started</a> · <a href="docs/ARCHITECTURE.md">Architecture</a></p>

<!-- WORKFLOW_BADGES -->
<p align="center"><a href="https://github.com/meloan-dev/meloan/actions/workflows/audio.yml"><img src="https://github.com/meloan-dev/meloan/actions/workflows/audio.yml/badge.svg?branch=main" alt="Story audio" /></a> <a href="https://github.com/meloan-dev/meloan/actions/workflows/build.yml"><img src="https://github.com/meloan-dev/meloan/actions/workflows/build.yml/badge.svg?branch=main" alt="Production build" /></a> <a href="https://github.com/meloan-dev/meloan/actions/workflows/engine.yml"><img src="https://github.com/meloan-dev/meloan/actions/workflows/engine.yml/badge.svg?branch=main" alt="Lending engine" /></a> <a href="https://github.com/meloan-dev/meloan/actions/workflows/integrity.yml"><img src="https://github.com/meloan-dev/meloan/actions/workflows/integrity.yml/badge.svg?branch=main" alt="Repository integrity" /></a> <a href="https://github.com/meloan-dev/meloan/actions/workflows/loader.yml"><img src="https://github.com/meloan-dev/meloan/actions/workflows/loader.yml/badge.svg?branch=main" alt="Story loader" /></a> <a href="https://github.com/meloan-dev/meloan/actions/workflows/markets.yml"><img src="https://github.com/meloan-dev/meloan/actions/workflows/markets.yml/badge.svg?branch=main" alt="Market data" /></a> <a href="https://github.com/meloan-dev/meloan/actions/workflows/syntax.yml"><img src="https://github.com/meloan-dev/meloan/actions/workflows/syntax.yml/badge.svg?branch=main" alt="Source syntax" /></a> <a href="https://github.com/meloan-dev/meloan/actions/workflows/wallet.yml"><img src="https://github.com/meloan-dev/meloan/actions/workflows/wallet.yml/badge.svg?branch=main" alt="Wallet balances" /></a></p>
<!-- END_WORKFLOW_BADGES -->

Meloan is building a way for holders to access stablecoin liquidity against eligible memecoins without immediately selling them. This repository contains the current website, curated market-data integration, wallet balance validation, and lending calculations. The interface reads balances and prepares reviews; lending transactions are disabled until the execution contracts are deployed and integrated.

## One connected experience

| Surface | Included in this source |
| --- | --- |
| Markets | Curated meme contracts on Robinhood Chain, USDG/ETH/WETH pricing pools, liquidity filters, search and price history. |
| Borrow | Collateral value, LTV, health, borrowing capacity, opening fee and liquidation-price calculations. |
| Wallet | Public account connection, token balances and decimals, account/network checks, and fresh balance validation before review and confirmation. |
| Lend and positions | Market-specific liquidity, lender shares, position calculations and browser-local state. Live execution is disabled. |
| Analytics | Market utilization, estimated rates and risk readouts. |
| Stories | Three.js scenes, a Blackhole loader, tap-to-start audio, and reduced-motion handling. |
| Documentation | An on-site whitepaper summary explaining market separation, eligibility, reserves, liquidation and risk. |

## How collateral is checked

1. The selected token must be in the contract-address-based meme registry.
2. Meloan verifies the wallet account and configured chain, then reads the token's `balanceOf` and `decimals` through the wallet provider.
3. Collateral amounts are compared as integer token units; holdings cannot be exceeded.
4. Borrowing capacity also respects collateral value, opening LTV, market limits, available liquidity and price validity.
5. Balances are refreshed before review and confirmation; an account or network change invalidates the reading.

Connecting a wallet does not sign a message or transfer funds. These client-side checks are interface safeguards; future contracts must enforce their own independent limits.

## Market data

Tokens are admitted by exact contract address, never by ticker alone. A market needs a supported USDG, ETH or WETH pool with at least $25,000 of liquidity and usable pricing. Market lists, selectors, homepage assets and restored browser data use the same eligibility rules. DexScreener supplies current pool data and GeckoTerminal supplies candle history; a bundled snapshot supports unavailable live responses. Market admission can change as liquidity and data change.

## Explore the code

| Area | Location |
| --- | --- |
| Market eligibility | `app/src/meme-tokens.js` |
| Pool data and candles | `app/src/live.js`, `app/src/snapshot.js` |
| Wallet holdings | `app/src/wallet.js`, `app/src/wallet-balances.js` |
| Lending calculations | `app/src/engine.js` |
| Borrow flow | `app/src/pages/borrow.js` |
| UI routes | `app/src/pages/` |
| Story and audio | `src/story.js`, `src/story-sound.js`, `src/sfx.js` |
| Blackhole loader | `src/story.template.html` |
| Builds | `build_story.py`, `build_app.py`, `build_merged.py` |
| Checks | `app/test/`, `test/`, `scripts/`, `.github/workflows/` |

## Run locally

Use Node.js 22 or 24 and Python 3.11 or newer. The builders and tests require no package installation.

```sh
npm run build
npm run dev
```

Open `http://localhost:4173`. The platform lives at `/app/index.html` and uses hash routes, including `#/markets`, `#/borrow`, `#/lend` and `#/docs`. The story fetches pinned Three.js modules and fonts from external CDNs at runtime; live market data also needs network access.

## Checks and GitHub Actions

```sh
npm test
npm run check:syntax
npm run build
npm run check:integrity
```

Eight workflows run on pushes, pull requests and manual dispatch:

| Workflow | Actual check |
| --- | --- |
| Lending engine | Capacity, LTV, health, interest, liquidity, reserves and position calculations. |
| Market data | Pool normalization, approved tokens, stale data and candle handling with deterministic fixtures. |
| Wallet balances | Integer precision, insufficient holdings, network/account changes and every approved token contract. |
| Story audio | Delayed startup, explicit mute, touch retries, opening effects and tab interruptions. |
| Story loader | No automatic launch at 100%, tap enables audio once, and reduced-motion behavior. |
| Source syntax | JavaScript modules, inline loader scripts and Python builders parse successfully. |
| Production build | The standalone story, standalone app and merged site build on Node.js 22 and 24. |
| Repository integrity | Documentation links, assets, build output and rewritten application routes. |

Badges report GitHub's executed results once this source is published and the repository name is configured. Local checks are not represented as completed GitHub runs. See [CI setup](docs/CI.md).

## Implementation boundaries

The project currently has no deployed lending contracts, transaction broadcaster or production oracle integration in this source. LTV, liquidity caps, reserve accounting and liquidations are modeled by the interface; no funded borrowing, lending, repayment or withdrawal is claimed. Market prices are third-party readings rather than contract-enforced oracle prices. Wallet reads do not establish protocol solvency or audited security. No Meloan token address or ticker is configured.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). Never commit private keys, recovery phrases or API secrets. No project-wide open-source license has been selected; publication for review does not grant an MIT license. Third-party dependencies retain their own licenses, as described in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
