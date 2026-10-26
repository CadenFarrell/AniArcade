import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { serviceWorker } from './sw/plugin.js'
import { execSync } from 'node:child_process'

// The commit a build was made from, stamped into every crash report and piece
// of feedback (shared/services/reports.js) so a report can be read against the
// code that produced it. 'dev' when git is not there to ask, which a build
// must survive rather than fail on.
function buildId() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'
  } catch {
    return 'dev'
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // dist/sw.js, for offline local play: see sw/serviceWorker.template.js.
    serviceWorker(),
  ],
  define: { 'import.meta.env.VITE_APP_BUILD': JSON.stringify(buildId()) },
  // The playtest bots write reports and builds while a dev server may be up;
  // none of it is source, and a watched write would reload the open app.
  server: { watch: { ignored: ['**/playtest-report/**', '**/dist-playtest/**', '**/dist-playtest-emu/**'] } },
  // Test-only, and needed only until vitest moves to Vite 8. vitest 3 runs on
  // its OWN bundled Vite 7, which transforms with esbuild — while plugin-react
  // v6 configures JSX through `oxc`, a Vite 8 option Vite 7 never reads. So the
  // app builds with the automatic runtime and every `.test.jsx` compiled
  // classic, failing on `React is not defined`. Gated on mode because Vite 8
  // treats `esbuild` as deprecated and the real build must not see it.
  ...(mode === 'test' && { esbuild: { jsx: 'automatic' } }),
  // `.test.js` is a pure module under node; `.test.jsx` is a component test and
  // must open with a `// @vitest-environment jsdom` docblock. Per file rather
  // than a global jsdom so the forty-odd rules suites keep running without a
  // DOM — and a component test that forgets the docblock fails loudly on
  // `document is not defined` instead of silently never running, which is what
  // the old `*.test.js`-only glob did to any `.test.jsx`.
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    // Vitest's default is one worker per core minus one: 13 on the 14-thread
    // dev machine, each its own Node process with its own jsdom. That run
    // peaked at ~3 GB and left 0.26 GB of 16 GB free, enough for Claude Code to
    // kill idle background shells. Measured 2026-10-26: 4 workers ran the
    // suite in 45s against the default's 41s and left 1.4 GB free; 6 took 52s
    // because the workers fought for memory. CI's runners have 4 cores anyway.
    maxWorkers: 4,
  },
}))
