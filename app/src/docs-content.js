// On-site whitepaper summary (PRD: faithful summary of all 18 sections; proposed values stay labelled).
// Source: Meloan whitepaper v1.0. Content is data: [title, paragraphs[], optional table].
export const DOCS = [
  ['Executive summary', [
    'Meloan is a lending protocol that lets holders borrow stablecoins against eligible memecoins without immediately selling them.',
    'Each supported memecoin has its own market with its own borrowing limits, interest rate, liquidity cap and reserve. Lenders choose the markets they supply.',
    'Lenders make no extra reserve deposit. A share of protocol revenue builds a stablecoin reserve per market that absorbs that market’s losses first, up to its balance.',
    'Meloan is built for Robinhood Chain, with USDG (Global Dollar) as the loan asset of every market.']],
  ['The problem', [
    'Holders may want stablecoins while keeping exposure. Selling closes part of the position; borrowing against memecoins is hard because prices can fall sharply, liquidity can vanish, ownership can be concentrated, contracts can carry restrictive features, thin markets can be manipulated and collateral may not sell at its quoted value.',
    'Meloan answers with selective listing, conservative borrowing capacity, separate markets and explicit loss accounting.']],
  ['Product structure', [
    'A borrower’s collateral in one market never secures debt in another, and a lender’s deposit funds only the selected market. Reserves and lender assets cannot move to cover another market.',
    'Separation contains market-specific credit losses but not shared risks such as a bug in common contracts or a chain failure.'],
    [['Component', 'Purpose'], ['One approved memecoin', 'Collateral for borrowing'], ['One approved stablecoin', 'Supplied by lenders, borrowed by users'], ['Lending vault', 'Holds lending liquidity and lender claims'], ['Collateral contract', 'Holds borrower collateral'], ['Price oracle', 'Values collateral and the loan asset'], ['Interest model', 'Sets borrowing rates'], ['Risk parameters', 'Borrowing limits and liquidation conditions'], ['Dedicated reserve', 'Absorbs eligible losses within the market']]],
  ['Lending', [
    'Lenders supply the approved stablecoin to one market and receive vault shares. Borrowers pay interest; a disclosed portion goes to the protocol and the rest accrues to lenders. No ecosystem token is needed.',
    'Returns depend on actual borrowing: lender APR ≈ borrower APR × utilization × (1 − protocol interest share). For instance: 20% × 50% × 85% = 8.5%. Yield is never promised.',
    'Withdrawals need unborrowed liquidity. If most funds are lent out, lenders wait for repayments or new liquidity; shares do not guarantee immediate redemption. Withdrawals never draw on collateral or the reserve. The initial design is liquidity-limited: redeem what is available and retry later. Any future queue must publish its rules.']],
  ['Borrowing', [
    'Borrowing is limited by the collateral’s accepted value, the market’s maximum opening loan-to-value, available liquidity, the market borrowing cap, valid oracle data and any account limits.',
    'LTV = outstanding debt ÷ collateral value. With a 25% opening LTV, collateral worth 1,000 supports up to 250 of initial debt, including any financed opening fee. Borrowers may take less to keep a buffer.',
    'Repay partly or fully in the loan asset at any time; interest accrues on outstanding debt and full repayment releases the remaining collateral. There is no fixed maturity in the initial design.',
    'Collateral can be withdrawn only if the remaining position still meets the opening LTV. Adding collateral and repaying should stay available during ordinary risk pauses wherever safe.']],
  ['Market eligibility and borrowing capacity', [
    'There is no automatic listing. A proposed market is assessed on trading depth and execution cost, history and volatility, holder concentration, dependence on few liquidity providers, contract permissions and upgrade controls, minting/freezing/blacklist powers, price-source reliability and liquidation routes. Rebasing, transfer-tax and other tokens that break collateral accounting are excluded initially.',
    'Caps must reflect what could realistically be liquidated under stress — executable liquidity and slippage, not reported volume. A large market cap with shallow liquidity may get a small cap or be rejected.',
    'Routine limit changes are published before taking effect; emergency controls may immediately reduce new borrowing or pause new loans. Lowering opening LTV does not change an existing position’s liquidation threshold; changes to existing liquidation terms need notice and a timelock unless the market rules define an emergency procedure. Reserve funding cannot override listing requirements.']],
  ['Pricing and oracle controls', [
    'Approved pricing adapters value collateral and the loan asset, using independent feeds alongside on-chain liquidity checks where they exist. A time-weighted average price reduces sensitivity to spikes but can still be manipulated and can lag in crashes.',
    'Each market defines accepted sources, maximum price age, minimum liquidity, deviation limits, behaviour when sources disagree, and conditions for pausing borrowing and withdrawals and for valid liquidation prices.',
    'Without reliable pricing, new borrowing and collateral withdrawals stop; repayments and collateral additions remain available where safe. Liquidations must not use arbitrary or knowingly stale prices, so oracle outages can delay liquidations and increase losses.']],
  ['Interest rates', [
    'Utilization = outstanding borrowed principal ÷ total supplied lending capital. Rates rise with utilization to encourage repayment and attract lenders, but this does not guarantee liquidity.',
    'The proposed model is a kinked curve: gentle below a target utilization, steeper above it, with a disclosed maximum per market. Interest accrues with time and is recorded when users interact; frontend estimates do not replace contract accounting.']],
  ['Liquidation', [
    'Health factor = collateral value × liquidation threshold ÷ outstanding debt. Below 1 a position is eligible for liquidation.',
    'Where feasible, liquidation is partial: a liquidator repays part of the debt and receives matching collateral plus a disclosed incentive. Full liquidation may be needed for deeply distressed or small positions. The incentive must be priced into borrowing limits.',
    'Remaining collateral after debt and liquidation costs belongs to the borrower. Liquidation needs willing participants and tested routes; success is not guaranteed in extreme volatility.']],
  ['Market reserves and bad debt', [
    'Each market has a reserve in its loan asset, funded by its share of realised protocol revenue and optional, nonredeemable contributions from Meloan’s treasury or the token’s community. Lenders are not asked for extra capital.',
    'If liquidation cannot cover a loan: (1) the shortfall is recognised as bad debt, (2) that market’s reserve covers what it can, (3) the rest reduces that market’s lender assets proportionally. For instance: 8,000 bad debt, 5,000 reserve, 3,000 lender loss. Other markets are untouched.',
    'Bad debt must be reflected promptly; an unrecoverable loan must not be shown at full value. A reserve is a limited buffer, not insurance.']],
  ['Fees and revenue', [
    'Fees are proposed starting parameters that need economic testing. Opening 200 of gross principal at 0.5% pays the borrower 199 and leaves 200 owed. The interface must show gross debt, fee, net proceeds, rate and liquidation conditions before confirmation.',
    'Realised revenue — collected fees and the protocol share of interest — is split 60% to the reserve of the market that generated it and 40% to operations, security and development (proposed). Principal, collateral and unpaid interest are never revenue. Optional buybacks may only use operations surplus; none are promised.',
    'Fees may not cover early operations, so an operating budget must be funded separately before launch. User funds are never used for business expenses.'],
    [['Fee', 'Proposed rate'], ['Lending deposit', '0%'], ['Lending withdrawal', '0%'], ['Borrow opening', '0.5% of gross principal'], ['Repayment', '0%'], ['Protocol share of borrower interest', '15%'], ['Collateral deposit or withdrawal', '0%, excluding network costs']]],
  ['Ecosystem token', [
    'Meloan may introduce a token, but lending and borrowing do not depend on it. Proposed utility: borrow-fee discounts, market proposal rights, nonbinding community votes and extra analytics.',
    'Holding it does not guarantee listings, grant access to deposits or override risk controls, and fee discounts never reduce lender interest. No revenue distribution, yield or price is promised. Supply, allocation, vesting, launch method and contract address must be published before any issuance; none is implied.']],
  ['Smart contract architecture', [
    'Proposed components: market factory, lending vaults, collateral accounting, oracle adapters, interest modules, liquidation functions, reserve contracts, fee accounting and a risk controller.',
    'User assets sit in smart contracts, not team wallets. Admin powers must be explicit, and there is no function for sweeping collateral or lender principal. The first release favours a small, reviewed core; any upgrade path must disclose who controls it, its timelock and how users can exit.']],
  ['Administration and transparency', [
    'Initial administration uses a multisignature wallet with timelocked routine changes. Emergency authority is limited to protective actions such as pausing new borrowing or reducing caps; it cannot withdraw user funds or redirect reserves.',
    'Published data: market contracts, approved assets, borrowing and liquidation parameters, rate settings, available liquidity, reserve balances, recognised bad debt, fees and revenue transfers, administrative transactions and security findings. Updates must say whether they affect new activity or existing positions.']],
  ['Initial product scope', [
    'First release: wallet connection, a small number of approved markets, stablecoin lending, collateral deposits, borrowing and repayment, liquidity-limited withdrawals, position health and liquidation information, and reserve and market analytics.',
    'Excluded: cross-chain lending, automatic leverage loops, unrestricted market creation and complex reserve investment. The frontend must identify the network, exact token contracts, available liquidity and transaction costs, and never present unsupported assets as valid deposits.']],
  ['Launch requirements', [
    'Meloan\'s security standard covers: (1) verified network and assets, (2) independent security review of the contracts, (3) checks of share accounting, interest, rounding and bad debt, (4) oracle manipulation and outage checks, (5) crash and liquidity-withdrawal stress checks, (6) liquidation rehearsals and keeper deployment, (7) published admin powers and parameters, (8) funded operations and reserves, (9) conservative caps for new markets, (10) legal and compliance review.',
    'Markets launch only when their own requirements are met. A token launch does not establish that lending is ready.']],
  ['Risks', [
    'Borrowers can lose collateral through liquidation. Lenders can lose principal if collateral proceeds and reserves are insufficient.',
    'Other risks: smart contract vulnerabilities, oracle manipulation, stablecoin depegs, liquidity shortages, administrative compromise, blockchain interruptions and failure of bridged assets. Separate markets limit the spread of market-specific losses but not shared infrastructure risks.',
    'Displayed yields are estimates, reserves are finite and withdrawals depend on liquidity.']],
  ['Conclusion', [
    'Meloan gives eligible memecoin holders a way to access stablecoin liquidity while keeping a collateralised position; lenders choose the markets they fund and earn from real borrowing, with defined limits, transparent liquidation rules and a revenue-funded reserve per market.',
    'Success depends on execution: suitable collateral, limited exposure, honest loss accounting and keeping user funds separate from operating capital. Keep the meme. Unlock the liquidity.']],
];

export const FAQ = [
  ['Do I need a wallet?', 'You can browse markets, prices and the loan calculator without one. To borrow, lend, repay or withdraw, connect a wallet on Robinhood Chain. Connecting only shares your public address.'],
  ['Which tokens have markets?', 'Only curated meme-token contracts on Robinhood Chain, with a valid price and at least one USDG, ETH or WETH pool above $25k liquidity. Tokenized stocks, stablecoins, and utility tokens are excluded. Loans stay in USDG. ETH-pool USD prices are converted using the USDG reference price from USDG pools. Prices come from DexScreener and price history from GeckoTerminal. Each market\'s cap is 5% of its supported pool liquidity, and its opening LTV follows its liquidity tier.'],
  ['Which network and stablecoin?', 'Robinhood Chain (chain ID 4663). The loan asset is USDG (Global Dollar, issued by Paxos) at its official Robinhood Chain address; only pools paired with that exact contract are counted.'],
  ['Is there a token?', 'No token or contract address has been announced. Only trust the address published on this site and the official channels.'],
];
