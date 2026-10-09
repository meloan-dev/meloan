# Getting started

Use Node.js 22 or 24 and Python 3.11+. No npm dependencies or secrets are needed for the existing builders and unit tests.

```sh
npm run build
npm run dev
```

Open http://localhost:4173 for Stories and http://localhost:4173/app/index.html for the lending interface. Tapping the ready loader starts the story and enables audio; the story's sound control remains available afterward.

The build pipeline runs `build_story.py`, `build_app.py`, then `build_merged.py`. The output is `dist/merged/`. You can host that directory with any static HTTP server. Edit `src/` and `app/`, rather than generated `dist/` files.

Markets, borrowing, lending, positions, analytics, how-it-works and docs use hash routes under the app path. Wallet balance reads require an injected EVM wallet on the configured network. Missing or stale balances block collateral review. Live loan execution is disabled.

Public RPC/network settings are in `app/src/config.js`. Its network verification flag is currently false; verify first-party chain configuration before enabling execution. Market snapshots and logos are bundled; external data, Three.js modules and fonts need runtime network access.
