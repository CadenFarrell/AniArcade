// The browser layer's half of the bot adapter: the same driver, strategies and
// snapshot as the jsdom runners, pointed at real Chrome through Playwright.
//
// What only a real browser can say, and so what this layer is for: layout
// (CSS is applied — jsdom applies none), sizes and overflow at a phone's
// width, contrast and the rest of axe's WCAG rules, a real audio element, real
// pointer drags, and the production BUILD rather than Vite's dev transform.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { snapshotDom } from '../core/snapshot.js';
import { isAnimeThemes, isThemeAudio, animethemesJson } from '../fakes/animethemes.js';
import { silentWav } from '../fakes/media.js';
import { mulberry32, gameSeed } from '../core/rng.js';
import { REPORT_DIR } from '../report.js';

const ROOT = `${import.meta.dirname}/../..`;

// Every registered game as { id, title, folder }, read off registry.js and
// each folder's index.js. Parsed rather than imported: those are app modules
// (JSX, Vite's extensionless imports) and this file runs in plain Node. The
// registry's import order is the menu order.
export const GAMES = (() => {
  const reg = readFileSync(`${ROOT}/src/hub/registry.js`, 'utf8');
  return [...reg.matchAll(/^import \w+ from '\.\.\/games\/([\w-]+)';/gm)].map(([, folder]) => {
    const idx = readFileSync(`${ROOT}/src/games/${folder}/index.js`, 'utf8');
    return { folder, id: idx.match(/id:\s*'([^']+)'/)[1], title: idx.match(/title:\s*'([^']+)'/)[1] };
  });
})();

const WAV = silentWav();
// A 1×1 transparent PNG for AniList's image CDN: the fixture carries real
// cover and portrait URLs, and the bots must not fetch them.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/**
 * Seeds a context's localStorage before the app's first script runs, and
 * replaces Math.random with the seeded stream. Seeding happens once per tab
 * (a sessionStorage flag), so a chaos reload keeps whatever the game saved.
 */
export async function seedContext(context, { storage, seed }) {
  await context.addInitScript(([entries, rngSeed, src]) => {
    if (!sessionStorage.getItem('__playtest_seeded')) {
      localStorage.clear();
      for (const [k, v] of entries) localStorage.setItem(k, v);
      sessionStorage.setItem('__playtest_seeded', '1');
    }
    const make = new Function(`return (${src})`)();
    Math.random = make(rngSeed);
  }, [Object.entries(storage).map(([k, v]) => [k, JSON.stringify(v)]), gameSeed(seed), mulberry32.toString()]);
}

/**
 * Lets through the app itself (and, online, the emulator), fakes the two
 * AnimeThemes hosts and AniList's images, and refuses everything else —
 * recording each refusal, since local play must reach no third party.
 */
export async function routeNetwork(context, { origin, offsite, allow = [] }) {
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:') || allow.some((a) => url.includes(a))) return route.continue();
    if (isAnimeThemes(url)) {
      const json = animethemesJson(url);
      return route.fulfill({ status: json ? 200 : 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'x-ratelimit-limit': '600' }, body: JSON.stringify(json ?? {}) });
    }
    if (isThemeAudio(url)) return route.fulfill({ status: 200, contentType: 'audio/wav', body: WAV });
    if (/anilistcdn|s4\.anilist\.co|img\.anili\.st/.test(url)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    offsite.push(`unexpected network request: ${url}`);
    return route.abort();
  });
}

// Layout problems a screen reader or a phone would meet, measured in the page.
// Self-contained for page.evaluate's reason (see snapshot.js).
function measureLayout() {
  const out = [];
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) {
    out.push({ kind: 'overflow-x', message: `page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport` });
  }
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 50);
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role=button]')) {
    if (!el.checkVisibility?.()) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // A 1px box is an sr-only input under a styled label (every settings
    // toggle): the label is what a finger presses, and it is measured on its own.
    if (r.width <= 1 && r.height <= 1 && el.labels?.length) continue;
    // WCAG 2.5.8 (AA): 24×24 CSS px. Inline links inside a sentence are exempt.
    if ((r.width < 24 || r.height < 24) && !(el.tagName === 'A' && el.closest('p'))) {
      out.push({ kind: 'target-size', message: `"${label(el)}" is ${Math.round(r.width)}×${Math.round(r.height)}px` });
    }
    if (r.right > vw + 1 || r.left < -1) out.push({ kind: 'offscreen', message: `"${label(el)}" sits outside the viewport (${Math.round(r.left)}–${Math.round(r.right)}px)` });
  }
  // Text cut off without an ellipsis: a box narrower than its content that
  // hides the rest. `truncate` (text-overflow: ellipsis) is deliberate.
  for (const el of document.querySelectorAll('h1, h2, h3, p, span, button, label')) {
    if (!el.checkVisibility?.() || el.children.length > 2) continue;
    const cs = getComputedStyle(el);
    if (cs.overflow !== 'hidden' && cs.overflowX !== 'hidden') continue;
    if (cs.textOverflow === 'ellipsis') continue;
    // sr-only text is a 1px clipped box on purpose.
    if (el.clientWidth <= 1 || cs.position === 'absolute' && cs.clip !== 'auto') continue;
    if (el.scrollWidth > el.clientWidth + 2) out.push({ kind: 'clipped-text', message: `"${label(el)}" is cut off` });
  }
  return out;
}

/**
 * The Playwright adapter for driver.js / table.js. `audit` is called once per
 * new screen (see onScreen) for the screenshot and the layout and axe checks.
 */
export function pageAdapter(page, { errors, prefix }) {
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 600)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`.slice(0, 600)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const loc = (id) => page.locator(`[data-bot-id="${id}"]`).first();
  const adapter = {
    alive: true,
    refused: [],
    snapshot: () => page.evaluate(snapshotDom, prefix ? { prefix } : {}),
    errors: () => errors.splice(0),
    async perform(a) {
      // Real time, not a fake page clock: Playwright's own actionability
      // checks wait on requestAnimationFrame, which a fake clock holds back,
      // so every click timed out. Think time is capped so a run stays quick
      // but still clears AniFake's 400ms tap guard; long waits (a turn timer
      // running out) are capped too — the jsdom layer, which owns its clock,
      // is where expiry gets played in full.
      if (a.think) await page.waitForTimeout(Math.min(a.think, 450));
      const id = a.click ?? a.fill ?? a.select ?? a.slide;
      const opts = { timeout: 3000 };
      if (a.click) {
        // A click Playwright will not make (it waits for the element to be
        // stable, visible and unobscured) is retried by force and recorded:
        // either something covers the control — a real finding — or an
        // animation that never settles.
        await loc(id).click(opts).catch(async (e) => {
          // A visually hidden checkbox is covered by its own styled label, and
          // a person presses the label — so does the bot, before calling it refused.
          const label = page.locator(`label:has([data-bot-id="${id}"])`).first();
          if (await label.count() && await label.click(opts).then(() => true, () => false)) return;
          adapter.refused.push(`${a.name ?? id}: ${e.message.split('\n')[0].slice(0, 160)}`);
          await loc(id).click({ ...opts, force: true }).catch(() => {});
        });
      }
      else if (a.fill) await loc(id).fill(a.text ?? '', opts).catch(() => {});
      else if (a.select) await loc(id).selectOption(a.value, opts).catch(() => {});
      else if (a.wait) await page.waitForTimeout(Math.min(a.wait, 3000));
      await page.waitForTimeout(60);
      // Let the hub's panel wipe (useWipe.js) finish before the next snapshot.
      // The screen being left stays mounted under the wipe until its midpoint,
      // so a snapshot taken during one reads the OLD screen and presses its
      // button again, into a wipe that ignores presses on purpose — every
      // report's "Press start" and hub-tile click-refused. Waiting before the
      // click instead does not help: by the time the wipe clears, the button it
      // was aimed at is gone. HubScreen.test's afterWipe is the same wait.
      await page.locator('[data-wipe]').waitFor({ state: 'detached', timeout: 1500 }).catch(() => {});
    },
    async reload() { await page.reload(); await page.waitForTimeout(200); },
    async exitToHub() {
      await page.getByRole('button', { name: /^\s*hub\s*$/i }).first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(100);
    },
    async crash() { adapter.alive = false; await page.context().close().catch(() => {}); },
  };
  return adapter;
}

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40).toLowerCase() || 'screen';

// Screens that share a heading are not one screen. Keyed on the heading alone,
// AniGuess's "<name>'s Turn" was audited at its Ask/Guess choice and never
// again at the question box or the guess box under the same heading, and a
// later screen would have overwritten the shot anyway. The controls on offer
// tell the stops apart; digits fold so a timer or a score ticking over is not
// a new screen. The cap keeps a heading whose buttons carry player names
// ("Accuse <name>") from filling the report with one shot per seat.
const MAX_SHOTS_PER_HEADING = 4;
const layoutOf = (snap) => [...new Set((snap.controls ?? [])
  .map((c) => `${c.role}:${String(c.name ?? '').replace(/\d+/g, '#')}`))].sort().join('|');
// Per-heading shot counts, kept beside each spec's `seen` set (which outlives
// one seed's auditor, so the counts must too).
const shotCounts = new WeakMap();

/** Screenshot + layout + axe, once per distinct layout, up to MAX_SHOTS_PER_HEADING per (game, viewport, screen). */
export function auditor(page, { game, project, seen }) {
  mkdirSync(`${REPORT_DIR}/shots`, { recursive: true });
  if (!shotCounts.has(seen)) shotCounts.set(seen, new Map());
  const counts = shotCounts.get(seen);
  return async function audit(snap, screen, ctx, record) {
    const heading = `${game}|${project}|${screen}`;
    const key = `${heading}|${layoutOf(snap)}`;
    if (seen.has(key)) return;
    const nth = (counts.get(heading) ?? 0) + 1;
    if (nth > MAX_SHOTS_PER_HEADING) return;
    seen.add(key);
    counts.set(heading, nth);
    const file = `shots/${game}-${project}-${slug(screen)}${nth > 1 ? `-${nth}` : ''}.png`;
    // Measure the settled screen, not a frame of a transition: a hub caption
    // caught halfway through its hover fade read as ink on amber at 1.98:1,
    // which is a colour no resting screen ever paints. Infinite animations
    // (PRESS START's blink) cannot finish and are left alone.
    //
    // Finishing once was not enough: the pointer stays wherever the last click
    // left it, and the full-page screenshot resizes the page under it, so a hub
    // tile that slid beneath it started a NEW hover fade while axe measured —
    // AniRank's caption at 3.61:1 on a run after the fix. So park the pointer
    // off the page first, and settle again after the screenshot.
    const settle = () => page.evaluate(() => {
      for (const a of document.getAnimations()) { try { a.finish(); } catch { /* infinite */ } }
    }).catch(() => {});
    await page.mouse.move(-1, -1).catch(() => {});
    await settle();
    await page.screenshot({ path: `${REPORT_DIR}/${file}`, fullPage: true }).catch(() => {});
    await settle();
    (record.shots ??= []).push(file);
    // Settling cannot hold a screen still that the NETWORK replaces: online,
    // "Creating…" became the lobby while axe ran, and the lobby's banner was
    // measured mid screen-in — paper on AniOut's moss at 2.96:1, a colour no
    // resting screen paints — and filed under "Play Online". If the heading the
    // bots name a screen by (snapshot.js) moved under the audit, its results
    // belong to neither screen; the new one is audited on its own when the bot
    // reaches it.
    const liveHeading = () => page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, [role=heading]')]
      .find((h) => h.checkVisibility())?.textContent ?? '').catch(() => null);
    const before = await liveHeading();
    for (const f of await page.evaluate(measureLayout).catch(() => [])) {
      record.findings.push({ ...f, severity: f.kind === 'overflow-x' || f.kind === 'offscreen' ? 'warn' : 'info', screen, shot: file });
    }
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze().catch((e) => {
      record.findings.push({ kind: 'audit-error', severity: 'info', message: `axe could not run: ${e.message.slice(0, 200)}`, screen });
      return null;
    });
    if (await liveHeading() !== before) return;
    for (const v of axe?.violations ?? []) {
      // A contrast miss says which colours and how far off, because a bare
      // selector (".mb-1") sent every one of these to a code search first.
      const d = v.nodes[0]?.any?.[0]?.data;
      const why = d?.contrastRatio ? ` (${d.fgColor} on ${d.bgColor}: ${d.contrastRatio}:1, needs ${d.expectedContrastRatio})` : '';
      record.findings.push({
        kind: `axe:${v.id}`, severity: v.impact === 'critical' || v.impact === 'serious' ? 'warn' : 'info',
        message: `${v.help} — ${v.nodes.length} element(s), e.g. ${v.nodes[0]?.target?.join(' ')}${why}`, screen, shot: file,
      });
    }
  };
}

// Playwright runs tests in parallel workers, so each run writes its own file
// and report.js groups them by layer and game.
export function writeRun(layer, record) {
  const dir = `${REPORT_DIR}/${layer}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${record.game}.seed${record.seed}.run.json`, JSON.stringify(record, null, 1));
}
