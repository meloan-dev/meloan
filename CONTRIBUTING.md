# Contributing

Keep changes scoped and preserve the story/app separation. Use Conventional Commits such as `fix(wallet): reject stale balances` or `docs: clarify loan execution boundaries`.

Run the checks in the README before submitting a pull request. Include the behavior changed, relevant checks and any unresolved limitation. Add regression tests when fixing behavior that can affect wallet balances, market eligibility or lending calculations.

Do not change contract addresses, network parameters or collateral eligibility without documented sources. Keep claims aligned with actual implementation and preserve upstream notices.
