// The online smoke suite's own config, deliberately apart from vite.config.js's
// `test` block: these files need a running emulator and take minutes, so the
// unit suite's `src/**` include never reaches them and `npm test` stays offline.
// Run through `npm run test:smoke`, which starts the emulator around it.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  // The same vitest-3-on-Vite-7 JSX gap vite.config.js explains.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['smoke/*.smoke.test.js'],
    // Departure cases sit out the 20s GRACE_MS on purpose, often twice.
    testTimeout: 180_000,
    hookTimeout: 60_000,
    // One file per game in parallel; rooms never collide, since every device
    // is its own uid and every room claims a fresh code.
    fileParallelism: true,
  },
});
