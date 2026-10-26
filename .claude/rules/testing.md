---
paths:
  - "src/**/*.test.js"
  - "src/**/*.test.jsx"
  - "src/shared/testing/**"
  - "vite.config.js"
---

# Unit and component tests

Vitest's config is the `test` block of `vite.config.js`: `include` is
`src/**/*.test.{js,jsx}` under a default `environment: 'node'`. A `.test.jsx` must open with a
`// @vitest-environment jsdom` docblock, or it fails on `document is not defined`.

`src/shared/testing/arcade.jsx` mounts the same providers `main.jsx` does and seeds profiles in
the stored shape; `hub/HubScreen.test.jsx` drives every registered game from its tile into local
setup and back. Two traps it hit:

- vitest 3 runs its own bundled Vite 7, so the `mode === 'test'` esbuild JSX line in
  `vite.config.js` is what makes JSX compile at all.
- vitest loads `.env.local` (production Firebase), so a component test must
  `vi.mock('shared/services/firebase')` before anything mounts.
