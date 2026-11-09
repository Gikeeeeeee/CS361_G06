# React + TypeScript + Vite

## V5 offline verification

Use Node 22.17.0 and the committed frontend lockfile:

```sh
npm ci
npm run lint
npm run test:svg
npx playwright install --with-deps chromium
npm run test:corridors
npm run build
cd ..
python scripts/verify_svg_assets.py --build-dir frontend/dist
```

CI supplies fixture `VITE_*` values; see [.github/workflows/ci.yml](../.github/workflows/ci.yml).
For a local verification build, override `.env` with those same fixture values
so the output is not confused with a deployable build. The corridor suite mocks
APIs and aborts external requests. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can point
to an existing Chromium executable. The SVG checker parses all committed public
and floor-plan SVGs, checks case-sensitive JSON floor-plan references, detects
unreferenced plans and missing literal public SVG URLs, and compares fresh built
SVG copies with source files.

There is no generic `npm test` script. The existing `test:auth`, `test:bookmarks`,
`test:checkpoints` and `test:us4` commands include live-service requests and are
excluded from offline CI. They require separate authorization and a suitable test
environment. No assets are uploaded by these checks. See the
[V5 evidence matrix](../V5FinalVerification.md) for results and limitations.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
