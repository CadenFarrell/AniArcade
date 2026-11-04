// `npm run playtest` — the one entry point for every playtest layer.
//
//   npm run playtest                                  local bots, every game, 20 seeds
//   npm run playtest -- --game anitag                 one game
//   npm run playtest -- --game anitag --seed 7        replay one run exactly
//   npm run playtest -- --runs 50                     a longer sweep
//   npm run playtest -- --debug                       log every action (--debug screens: and each screen)
//   npm run playtest -- --layer online                emulator bots (starts the emulator itself)
//   npm run playtest -- --layer browser               Playwright: phone + desktop, the drag check, online in Chrome
//   npm run playtest -- --layer browser --workers 1   …in less memory (automatic under 4 GB free)
//   npm run playtest -- --shards 2                    local/online games split over 2 processes (automatic by free RAM)
//   npm run playtest -- --layer all                   local, online, browser, then the report
//
// Flags rather than env vars because env-var prefixes (`PLAYTEST_GAME=x npm …`)
// are a POSIX-shell feature and this repo is developed in PowerShell. This file
// turns the flags into the env vars the runners read, and spawns them.
//
// The report (playtest-report/summary.md and index.html) is rebuilt after
// every layer, from whatever per-game JSON is on disk.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { buildReport, REPORT_DIR } from './report.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : 'true';
};

const layer = flag('layer') ?? 'local';
// Set when run.js has re-entered itself under `emulators:exec` (see online()):
// the outer process owns the report and the summary line.
const INSIDE_EMULATOR = args.includes('--inside-emulator');
const env = { ...process.env };
if (flag('game')) env.PLAYTEST_GAME = flag('game');
if (flag('seed')) env.PLAYTEST_SEED = flag('seed');
if (flag('runs')) env.PLAYTEST_RUNS = flag('runs');
if (flag('debug')) env.PLAYTEST_DEBUG = flag('debug') === 'true' ? '1' : flag('debug');
if (flag('shards')) env.PLAYTEST_SHARDS = flag('shards');

const GB = 1024 ** 3;
const freeGB = () => (os.freemem() / GB).toFixed(1);

// Every line of a child's output, tagged with its shard, so three games
// playing at once can be told apart. Partial lines wait for their newline.
function tagLines(from, to, tag) {
  let rest = '';
  from.setEncoding('utf8');
  from.on('data', (chunk) => {
    const lines = (rest + chunk).split(/\r?\n/);
    rest = lines.pop();
    for (const l of lines) to.write(`${tag}${l}\n`);
  });
  from.on('end', () => { if (rest) to.write(`${tag}${rest}\n`); });
}

// npx, through a shell, because on Windows `npx` is npx.cmd and spawn without
// a shell cannot run a .cmd file. Asynchronous — not spawnSync — so shards
// run side by side and the RAM sampler below keeps ticking while they do.
const run = (cmd, extraEnv = {}, tag = null) => new Promise((resolve) => {
  const child = spawn(cmd, {
    shell: true,
    stdio: tag ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    // Piped output is no TTY, and vitest would drop its colours for it.
    env: { ...env, ...(tag && process.stdout.isTTY ? { FORCE_COLOR: '1' } : {}), ...extraEnv },
  });
  if (tag) {
    tagLines(child.stdout, process.stdout, tag);
    tagLines(child.stderr, process.stderr, tag);
  }
  child.on('error', (e) => { console.error(e); resolve(1); });
  child.on('close', (code) => resolve(code ?? 1));
});

const vitest = 'npx vitest run --config playtest/vitest.config.js';

// How many processes split a layer's games (playtest/core/shard.js): each is
// one vitest process with its own jsdom, so N shards are about N times the
// memory for about an Nth of the time. Picked from the RAM free at the start,
// keeping a reserve for the dev browser and the Claude sessions beside it on a
// 16 GB machine — the same reasoning as the browser layer's worker count.
// Measured 2026-11-04 on the 16 GB machine, quiet: local 11m55s in one
// process (lowest free 3.4 GB) against 6m01s in two (2.0 GB); online in two,
// beside the emulator's JVM, never went under 2.6 GB from 4.6 and took ~18½
// minutes of play against ~36 in one. The ■ line each layer prints is the
// number to retune these by.
const SHARD_COST = { local: 1 * GB, online: 1 * GB };
const RESERVE = 2 * GB;
const MAX_SHARDS = 3;
function shardCount(name) {
  // One game is one process: there is nothing to split.
  if (env.PLAYTEST_GAME) return 1;
  if (env.PLAYTEST_SHARDS) return Math.max(1, Math.floor(Number(env.PLAYTEST_SHARDS)) || 1);
  const n = Math.max(1, Math.min(MAX_SHARDS, Math.floor((os.freemem() - RESERVE) / SHARD_COST[name])));
  console.log(`${freeGB()} GB of RAM free: ${name} games split over ${n} process${n === 1 ? '' : 'es'} (--shards N to override).`);
  return n;
}

async function shards(name, extraEnv) {
  const n = shardCount(name);
  if (n === 1) return run(vitest, extraEnv);
  const codes = await Promise.all(Array.from({ length: n }, (_, i) => run(
    vitest,
    { ...extraEnv, PLAYTEST_SHARD: `${i + 1}/${n}` },
    `[${i + 1}/${n}] `,
  )));
  return codes.find((c) => c) ?? 0;
}

// The online layer needs an emulator. `emulators:exec` starts one, runs the
// command, and tears it down — the same wrapper `npm run test:smoke` uses, so
// every run gets a fresh, empty database. The command it runs is this file
// again: one emulator for all the shards, which share it the way two tables
// share a server — rooms claim fresh codes.
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
  const onlineEnv = { PLAYTEST_LAYER: 'online' };
  if (INSIDE_EMULATOR) return shards('online', onlineEnv);
  if (await portOpen(9000) && await portOpen(9099)) {
    console.log('Using the Firebase emulator already running on :9000/:9099.');
    return shards('online', onlineEnv);
  }
  return run(`npx firebase emulators:exec --only database,auth --project demo-aniguess "node playtest/run.js --layer online --inside-emulator"`);
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
// Below this much free RAM the browser layer runs one Chrome, not two. Each
// worker is a Chrome (an online test is three contexts in it), beside two
// preview servers and the emulator's JVM — and on a 16 GB machine already
// holding a dev browser and a second Claude session, two workers starved it
// badly enough that Claude Code killed idle background shells (the dev server)
// to stay alive. Checked once, at the start: the layer's own Chromes are what
// would drain it afterwards. An explicit --workers or PLAYTEST_WORKERS wins.
const LOW_MEMORY_BYTES = 4 * GB;
const browser = async () => {
  if (flag('runs')) env.PLAYTEST_BROWSER_RUNS = flag('runs');
  if (flag('workers')) env.PLAYTEST_WORKERS = flag('workers');
  if (!env.PLAYTEST_WORKERS && os.freemem() < LOW_MEMORY_BYTES) {
    env.PLAYTEST_WORKERS = '1';
    console.log(`Only ${freeGB()} GB of RAM free; running 1 browser worker instead of 2 `
      + '(--workers 2 to override).');
  }
  const port = await freePair(4199);
  if (port !== 4199) console.log(`Port 4198/4199 is in use; serving the playtest builds on ${port - 1}/${port}.`);
  env.PLAYTEST_PORT = String(port);
  env.PLAYTEST_EMU_PORT = String(port - 1);
  if (await portOpen(9000) && await portOpen(9099)) return run(PW);
  return run(`npx firebase emulators:exec --only database,auth --project demo-aniguess "${PW}"`);
};

const layers = {
  local: () => shards('local', { PLAYTEST_LAYER: 'local' }),
  online,
  browser,
};

// The biggest heap any one run left behind in this layer, from the heapMB the
// jsdom layers record per run: a number that climbs run after run within a
// game is a leak, long before it is a crash.
function peakHeap(name, since) {
  const dir = `${REPORT_DIR}/${name}`;
  if (!existsSync(dir)) return null;
  let peak = null;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
      if (!(Date.parse(data.at) >= since)) continue;
      for (const r of data.runs ?? []) {
        // A one-seed replay appends to the game's file: only its own run counts.
        if (env.PLAYTEST_SEED && String(r.seed) !== env.PLAYTEST_SEED) continue;
        if (r.heapMB > (peak?.mb ?? 0)) peak = { mb: r.heapMB, game: data.game, seed: r.seed };
      }
    } catch { /* not this layer's per-game shape */ }
  }
  return peak;
}

// Each layer timed, with the lowest free RAM seen while it ran (sampled every
// 2s). These are what the shard and worker counts above should be tuned by.
async function measured(name, fn) {
  const started = Date.now();
  let low = os.freemem();
  const sampler = setInterval(() => { low = Math.min(low, os.freemem()); }, 2000);
  try {
    return await fn();
  } finally {
    clearInterval(sampler);
    const s = Math.round((Date.now() - started) / 1000);
    const heap = peakHeap(name, started);
    console.log(`\n■ playtest ${name}: ${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s, `
      + `lowest free RAM ${(low / GB).toFixed(1)} GB`
      + (heap ? `, biggest heap after a run ${heap.mb} MB (${heap.game} seed ${heap.seed})` : ''));
  }
}

// The PC kept awake for the whole run. On 2026-11-04 every "hang" was the
// laptop going into Modern Standby while nobody touched it: a 47-minute
// AniGuess seed, then a 75-minute stall that froze both online shards and
// failed them, since standby drops the emulator's sockets. Nothing in the
// runner looks like a hang to Windows, so it slept.
//
// SetThreadExecutionState from a helper PowerShell: SYSTEM and DISPLAY
// required, CONTINUOUS until the thread ends. Display as well, because a
// Modern Standby machine sleeps when the screen times out whatever else is
// asked — so the screen stays on while a playtest runs. The helper watches
// this process and exits with it, which releases the request even if run.js
// is killed. A closed lid still sleeps the machine: nothing overrides that.
// Windows only; elsewhere (CI never runs this) a no-op. The inner run.js
// under emulators:exec leaves it to the outer one.
function keepAwake() {
  if (process.platform !== 'win32' || INSIDE_EMULATOR) return () => {};
  const script = [
    'Add-Type -Namespace AniArcade -Name Power -MemberDefinition \'[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);\'',
    // ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED = 0x80000003,
    // written in decimal: PowerShell 5.1 reads 0x80000003 as a NEGATIVE
    // Int32, which the uint parameter then refuses.
    '[AniArcade.Power]::SetThreadExecutionState([uint32]2147483651) | Out-Null',
    `while (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 5 }`,
  ].join('; ');
  // -EncodedCommand (UTF-16LE base64) so no quote in the script has to
  // survive Windows command-line escaping.
  const helper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    stdio: 'ignore',
    windowsHide: true,
  });
  helper.on('error', () => { /* no PowerShell: run as before, sleep and all */ });
  return () => { try { helper.kill(); } catch { /* already gone */ } };
}
const releaseAwake = keepAwake();

let status = 0;
const order = layer === 'all' ? ['local', 'online', 'browser'] : [layer];
for (const l of order) {
  if (!layers[l]) {
    console.error(`unknown --layer ${l} (local | online | browser | all)`);
    process.exit(2);
  }
  if (INSIDE_EMULATOR) {
    status = (await layers[l]()) || status;
    continue;
  }
  console.log(`\n▶ playtest: ${l}\n`);
  status = (await measured(l, layers[l])) || status;
}
if (!INSIDE_EMULATOR) {
  buildReport();
  console.log('\nReport: playtest-report/summary.md  ·  playtest-report/index.html');
}
releaseAwake();
process.exit(status);
