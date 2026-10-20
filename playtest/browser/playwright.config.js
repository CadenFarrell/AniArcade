// The browser playtest layer: `npm run playtest -- --layer browser`.
//
// Two builds, each served by `vite preview` on its own port and each written to
// its own --outDir, never `dist`:
//
//   :4199  dist-playtest      the app as configured (.env.local), for local play
//   :4198  dist-playtest-emu  Firebase pointed at the emulator, for online play
//
// Never port 5173: that origin holds Caden's real saved profiles and is where
// his dev server runs, and localStorage is per-origin. run.js moves both ports
// up to the next free pair (PLAYTEST_PORT / PLAYTEST_EMU_PORT) when something
// else already serves there — another session's `vite preview` once sat on
// 4199, and --strictPort then failed the whole layer before a test ran. And never `dist`: an
// emulator-pointed bundle sitting there is one `firebase deploy --only
// hosting` away from shipping a build that talks to 127.0.0.1.
//
// The emulator build overrides .env.local from the process environment, which
// Vite gives priority over every .env file.
import { defineConfig, devices } from '@playwright/test';

const ROOT = `${import.meta.dirname}/../..`;
const PORT = Number(process.env.PLAYTEST_PORT) || 4199;
const EMU_PORT = Number(process.env.PLAYTEST_EMU_PORT) || 4198;
const LOCAL = `http://127.0.0.1:${PORT}`;
const EMU = `http://127.0.0.1:${EMU_PORT}`;
const EMU_ENV = {
  VITE_FIREBASE_API_KEY: 'demo-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-aniguess.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'http://127.0.0.1:9000/?ns=demo-aniguess-default-rtdb',
  VITE_FIREBASE_PROJECT_ID: 'demo-aniguess',
  VITE_FIREBASE_STORAGE_BUCKET: '',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '',
  VITE_FIREBASE_APP_ID: '',
  VITE_USE_FIREBASE_EMULATOR: 'true',
};

// Headless Chrome refuses audio playback without a user gesture; ClipPlayer
// then shows its "Play clip" fallback, which is a real state but should not
// be the only one the bots ever see.
const launchOptions = { args: ['--autoplay-policy=no-user-gesture-required'] };

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js/,
  outputDir: `${ROOT}/playtest-report/browser-artifacts`,
  timeout: 480_000,
  fullyParallel: true,
  // Each worker is a Chrome, and an online test is three contexts in it: three
  // workers beside the two preview servers ran a 16 GB machine out of memory.
  workers: Number(process.env.PLAYTEST_WORKERS) || 2,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', launchOptions },
  projects: [
    { name: 'phone', testMatch: /local\.spec\.js/, use: { ...devices['Pixel 7'], baseURL: LOCAL } },
    { name: 'desktop', testMatch: /local\.spec\.js/, use: { viewport: { width: 1280, height: 800 }, baseURL: LOCAL } },
    // Tall, so the tray and every row are on screen at once: a mouse cannot drag
    // from a card below the fold.
    { name: 'drag', testMatch: /drag\.spec\.js/, use: { viewport: { width: 1280, height: 1800 }, baseURL: LOCAL } },
    { name: 'online', testMatch: /online\.spec\.js/, use: { viewport: { width: 414, height: 860 }, baseURL: EMU } },
  ],
  webServer: [
    {
      command: `npx vite build --outDir dist-playtest --emptyOutDir && npx vite preview --outDir dist-playtest --port ${PORT} --strictPort --host 127.0.0.1`,
      cwd: ROOT,
      url: LOCAL,
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: `npx vite build --outDir dist-playtest-emu --emptyOutDir && npx vite preview --outDir dist-playtest-emu --port ${EMU_PORT} --strictPort --host 127.0.0.1`,
      cwd: ROOT,
      url: EMU,
      timeout: 180_000,
      reuseExistingServer: false,
      env: EMU_ENV,
    },
  ],
});
