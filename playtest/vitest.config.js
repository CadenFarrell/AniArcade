// The playtest bots' own vitest config, apart from vite.config.js's `test`
// block for smoke/vitest.config.js's reason: these runs are long (twenty games
// per title by default), so `npm test` never reaches them. Run through
// `npm run playtest`, which goes via playtest/run.js for the --game/--seed flags.
//
// PLAYTEST_LAYER picks the file: `local` is jsdom and needs nothing running;
// `online` needs the Firebase emulator, which run.js starts around it.
import { defineConfig } from 'vitest/config';

const layer = process.env.PLAYTEST_LAYER || 'local';

export default defineConfig({
  root: `${import.meta.dirname}/..`,
  // The same vitest-3-on-Vite-7 JSX gap vite.config.js explains.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: [layer === 'online' ? 'playtest/online.playtest.test.jsx' : 'playtest/local.playtest.test.jsx'],
    testTimeout: layer === 'online' ? 480_000 : 120_000,
    hookTimeout: 120_000,
    // One file, seeds in sequence: each run owns the whole document, and two
    // runs sharing one jsdom would read each other's screens.
    fileParallelism: false,
    // A playtest is a report, not a gate: every seed runs even after a failure.
    bail: 0,
  },
});
