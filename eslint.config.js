import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist-playtest', 'dist-playtest-emu', 'playtest-report', 'seedProfiles.js', '**/.wrangler']),
  {
    files: ['generateProfiles.js', 'generateFacts.js', 'animeCatalog.js', 'factSources/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // The playtest bots run in Node (vitest, Playwright, the CLI) while also
  // touching the DOM they drive, so they get both sets of globals.
  {
    files: ['playtest/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  // The offline worker's template is a service worker (caches, clients, self);
  // its build plugin beside it runs in Node.
  {
    files: ['sw/serviceWorker.template.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ['sw/plugin.js'],
    languageOptions: { globals: globals.node },
  },
  // The MAL proxy runs on Cloudflare Workers: fetch, Response and caches are
  // service-worker globals there, not browser ones.
  {
    files: ['workers/**/*.js'],
    languageOptions: { globals: globals.serviceworker },
  },
])
