# Architecture

Meloan has two source applications and a merged static build. The story is a Three.js scene with an inline WebGL loader and synthesized Web Audio effects. The app consists of native JavaScript modules, route components, a deterministic lending engine, browser-local state, public market APIs and a read-only wallet adapter.

| Responsibility | Source |
| --- | --- |
| Pricing/pool normalization | `app/src/live.js` |
| Contract allowlist | `app/src/meme-tokens.js` |
| Wallet account/provider events | `app/src/wallet.js` |
| Balance RPC and integer validation | `app/src/wallet-balances.js` |
| Capacity, health, fees and accounting | `app/src/engine.js` |
| Review and refresh coordination | `app/src/pages/borrow.js` |
| Stored UI state | `app/src/store.js` |
| Loading and start gesture | `src/story.template.html` |
| Sound preference/readiness | `src/story-sound.js`, `src/sfx.js` |

Data flows from public market responses or the bundled snapshot into normalized markets, then through the lending engine into route views. The exact token address controls eligibility. Wallet responses use integer units and are discarded after account/network changes. Borrow confirmation refreshes the balance again; the final action currently opens a launch notice rather than broadcasting a transaction.

Each proposed market separates collateral, lender liquidity, exposure limits and reserves. This repository describes and calculates those rules, but does not implement deployed vaults, liquidation keepers or an audited oracle. Browser-local records are not blockchain positions.

There is no server secret required by this static source. A future execution layer needs independent onchain validation, authenticated oracle rules, approvals, transaction simulation, receipt tracking and contract security review before funds move.
