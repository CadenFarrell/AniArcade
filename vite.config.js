import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
  ],
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
  },
}))
