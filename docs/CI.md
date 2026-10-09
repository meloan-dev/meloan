# Continuous integration

The eight files in `.github/workflows/` execute actual checks on pushes, pull requests and manual dispatch. They use read-only repository permissions. No workflow transfers funds or deploys lending contracts.

The production-build workflow uses Node.js 22/Python 3.11 and Node.js 24/Python 3.12, and uploads the merged static build as an artifact. Other workflows isolate meaningful checks so a failure identifies its subsystem. Tests use deterministic fixtures and a stand-in wallet/audio context; they are not funded transaction tests or full WebGL browser coverage.

Before publishing, configure the exact repository name for README badges:

```sh
python3 scripts/configure-repository.py OWNER/meloan
```

The script rewrites only the badge block. Green badges appear only after GitHub has executed the corresponding workflows successfully. After pushing, inspect Actions and fix any failing job; do not fabricate histories or repeat empty commits to inflate run counts.

Run equivalent checks locally:

```sh
npm test
npm run check:syntax
npm run build
npm run check:integrity
```
