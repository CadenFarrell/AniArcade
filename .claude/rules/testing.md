---
paths:
  - "src/**/*.test.js"
  - "src/**/*.test.jsx"
  - "src/shared/testing/**"
  - "vite.config.js"
---

# Unit and component tests

Moved from the root `CLAUDE.md` so it loads only when Claude works on the files above. The
cross-game architecture it builds on is still there.

The vitest config lives in the `test` block of `vite.config.js`. Its `include` is
`src/**/*.test.{js,jsx}` under a default `environment: 'node'`: a `.test.js` is a pure
module, and a `.test.jsx` is a component test that must open with a
`// @vitest-environment jsdom` docblock (forget it and the file fails on `document is not
defined`, rather than silently never running as `.test.jsx` files used to).
`src/shared/testing/arcade.jsx` mounts the same providers `main.jsx` does and seeds
profiles in the stored shape; `hub/HubScreen.test.jsx` drives every registered game from
its hub tile into local setup and back. Two traps it already hit: vitest 3 runs on its
own bundled Vite 7, so the `mode === 'test'` esbuild JSX line in `vite.config.js` is what
makes JSX compile at all, and vitest loads `.env.local` (production Firebase), so a
component test must `vi.mock('shared/services/firebase')` before anything mounts.
