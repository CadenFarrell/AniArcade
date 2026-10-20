// `npm run playtest` — the one entry point for every playtest layer.
//
//   npm run playtest                                  local bots, every game, 20 seeds
//   npm run playtest -- --game anitag                 one game
//   npm run playtest -- --game anitag --seed 7        replay one run exactly
//   npm run playtest -- --runs 50                     a longer sweep
//   npm run playtest -- --debug                       log every action (--debug screens: and each screen)
//   npm run playtest -- --layer online                emulator bots (starts the emulator itself)
//   npm run playtest -- --layer browser               Playwright: phone + desktop, the drag check, online in Chrome
//   npm run playtest -- --layer browser --workers 1   …in less memory
//   npm run playtest -- --layer all                   local, online, browser, then the report
//
// Flags rather than env vars because env-var prefixes (`PLAYTEST_GAME=x npm …`)
// are a POSIX-shell feature and this repo is developed in PowerShell. This file
// turns the flags into the env vars the runners read, and spawns them.
//
// The report (playtest-report/summary.md and index.html) is rebuilt after
// every layer, from whatever per-game JSON is on disk.
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { buildReport } from './report.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : 'true';
};

const layer = flag('layer') ?? 'local';
const env = { ...process.env };
if (flag('game')) env.PLAYTEST_GAME = flag('game');
if (flag('seed')) env.PLAYTEST_SEED = flag('seed');
if (flag('runs')) env.PLAYTEST_RUNS = flag('runs');
if (flag('debug')) env.PLAYTEST_DEBUG = flag('debug') === 'true' ? '1' : flag('debug');

// npx, through a shell, because on Windows `npx` is npx.cmd and spawn without
// a shell cannot run a .cmd file.
const run = (cmd, extraEnv = {}) =>
  spawnSync(cmd, { stdio: 'inherit', shell: true, env: { ...env, ...extraEnv } }).status ?? 1;

const vitest = 'npx vitest run --config playtest/vitest.config.js';

// The online layer needs an emulator. `emulators:exec` starts one, runs the
// command, and tears it down — the same wrapper `npm run test:smoke` uses, so
// every run gets a fresh, empty database.
//
// Unless one is already up: `emulators:exec` refuses to start on taken ports,
// and an emulator left running for manual testing is the usual reason they
// are taken. Rooms claim fresh codes, so sharing its database is harmless.
const portOpen = (port) => new Promise((resolve) => {
  const sock = net.connect({ host: '127.0.0.1', port });
  sock.once('connect', () => { sock.destroy(); resolve(true); });
  sock.once('error', () => resolve(false));
});
const online = async () => {
  if (await portOpen(9000) && await portOpen(9099)) {
    console.log('Using the Firebase emulator already running on :9000/:9099.');
    return run(vitest, { PLAYTEST_LAYER: 'online' });
  }
  return run(
    `npx firebase emulators:exec --only database,auth --project demo-aniguess "${vitest}"`,
    { PLAYTEST_LAYER: 'online' },
  );
};

// The browser layer's online project needs the emulator too (it skips itself
// without one); its local projects do not care either way.
const PW = 'npx playwright test --config playtest/browser/playwright.config.js';
// The two preview ports, moved together to the next free pair when either is
// taken. Never 5173, whatever is free: see playwright.config.js.
const freePair = async (from) => {
  for (let p = from; p < from + 40; p += 2) {
    if (p === 5172 || p === 5173) continue;
    if (!(await portOpen(p)) && !(await portOpen(p - 1))) return p;
  }
  return from;
};
const browser = async () => {
  if (flag('runs')) env.PLAYTEST_BROWSER_RUNS = flag('runs');
  if (flag('workers')) env.PLAYTEST_WORKERS = flag('workers');
  const port = await freePair(4199);
  if (port !== 4199) console.log(`Port 4198/4199 is in use; serving the playtest builds on ${port - 1}/${port}.`);
  env.PLAYTEST_PORT = String(port);
  env.PLAYTEST_EMU_PORT = String(port - 1);
  if (await portOpen(9000) && await portOpen(9099)) return run(PW);
  return run(`npx firebase emulators:exec --only database,auth --project demo-aniguess "${PW}"`);
};

const layers = {
  local: () => run(vitest, { PLAYTEST_LAYER: 'local' }),
  online,
  browser,
};

let status = 0;
const order = layer === 'all' ? ['local', 'online', 'browser'] : [layer];
for (const l of order) {
  if (!layers[l]) {
    console.error(`unknown --layer ${l} (local | online | browser | all)`);
    process.exit(2);
  }
  console.log(`\n▶ playtest: ${l}\n`);
  status = (await layers[l]()) || status;
}
buildReport();
console.log('\nReport: playtest-report/summary.md  ·  playtest-report/index.html');
process.exit(status);
