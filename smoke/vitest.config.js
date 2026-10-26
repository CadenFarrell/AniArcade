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
    // …but four at a time, not all twelve. Each file is a jsdom holding a
    // Firebase app per simulated device, and twelve at once beside the
    // emulator's JVM left 0.04 GB of a 16 GB machine free (2026-10-26). Four:
    // 147s against 97s, peak ~2 GB against ~3.1. The files mostly sit out
    // GRACE_MS, which is why the slowdown is far less than threefold.
    maxWorkers: 4,
  },
});
