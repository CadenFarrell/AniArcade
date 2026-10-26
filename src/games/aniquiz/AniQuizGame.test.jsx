// @vitest-environment jsdom
//
// Whole games, played through the real screens against the real fact pack. The
// rules tests prove a score is right; these prove a table can actually get from
// "Start" to "Final Scores" — through the handoff screens, the Daily Double's
// wager, the final, and both answer styles — without a screen dead-ending.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFile } from 'node:fs/promises';
import AniQuizGame from './AniQuizGame';
import { makeProfile, openMoreSettings, renderArcade, seedProfiles } from '../../shared/testing/arcade';

vi.mock('../../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched in a local-only test'); },
  getFirebaseDb: () => { throw new Error('firebase touched in a local-only test'); },
  ensureSignedIn: () => { throw new Error('firebase touched in a local-only test'); },
}));

// The pack is the app's own static file; serve it from public/ so the real
// loader runs. Anything else is a bug, exactly as HubScreen.test.jsx says.
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const path = String(url);
    const at = path.indexOf('/facts/');
    if (at === -1) throw new Error(`unexpected fetch: ${path}`);
    return new Response(await readFile(`public/${path.slice(at + 1).split(/[?#]/)[0]}`), { status: 200 });
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function seedPrefs(prefs) {
  localStorage.setItem('aniarcade_game_prefs', JSON.stringify({ aniquiz: prefs }));
}

// The picker may close itself after an add; close it only if it is still up.
async function closePicker(user) {
  const close = screen.queryByRole('button', { name: /^close$/i });
  if (close) await user.click(close);
}

async function openSetup(user) {
  renderArcade(<AniQuizGame onExit={() => {}} />);
  await user.click(screen.getByRole('button', { name: /play on this device/i }));
  const start = screen.getByRole('button', { name: /start game/i });
  // The pack loads asynchronously; Start opens once it has and the pool fills a game.
  await waitFor(() => expect(start.disabled).toBe(false));
  return start;
}

// Whatever the screen is asking for, give it the cheapest answer. Returns a
// label for what it did, so a test can assert which screens it passed through.
async function step(user) {
  const q = (role, name) => screen.queryByRole(role, { name });
  const ready = q('button', /— ready$/);
  if (ready) { await user.click(ready); return 'handoff'; }
  const wager = q('button', /lock wager/i);
  if (wager) { await user.click(wager); return 'wager'; }
  const radios = screen.queryAllByRole('radio');
  if (radios.length) {
    await user.click(radios[0]);
    await user.click(screen.getByRole('button', { name: /lock in/i }));
    return 'choice';
  }
  const pass = q('button', /^pass$/i);
  if (pass) { await user.click(pass); return 'typed'; }
  const cell = screen.queryAllByRole('button', { name: / for \d+$/ }).find((b) => !b.disabled);
  if (cell) { await user.click(cell); return 'pick'; }
  const next = q('button', /→$/);
  if (next) { await user.click(next); return 'next'; }
  return null;
}

async function playToEnd(user, limit = 120) {
  const seen = [];
  for (let i = 0; i < limit && !screen.queryByText(/final scores/i); i++) {
    const did = await step(user);
    if (!did) throw new Error(`stuck after: ${seen.slice(-6).join(' → ')}`);
    seen.push(did);
  }
  expect(screen.getByText(/final scores/i)).toBeTruthy();
  return seen;
}

// Whole games through the real screens and the real pack run 3-5s each on a
// quiet machine — right at vitest's 5s default, so a busy one failed them.
// AniTurfGame.test.jsx's allowance.
describe('AniQuiz, played locally', { timeout: 60000 }, () => {
  it('runs a solo quick quiz with no list at all', async () => {
    seedProfiles([{ ...makeProfile('Caden'), animeList: [] }]);
    seedPrefs({ format: 'quiz', pool: 'everything', quizLength: 5, timed: false });
    const user = userEvent.setup();
    await user.click(await openSetup(user));

    const seen = await playToEnd(user);
    expect(seen.filter((s) => s === 'choice')).toHaveLength(5);
    expect(seen).not.toContain('handoff');
  });

  it('plays a whole board — Daily Double and final included', async () => {
    seedProfiles([makeProfile('Caden')]);
    seedPrefs({ format: 'board', pool: 'everything', categories: 2, timed: false, dailyDouble: true, finalRound: true });
    const user = userEvent.setup();
    await user.click(await openSetup(user));

    const seen = await playToEnd(user);
    expect(seen.filter((s) => s === 'pick')).toHaveLength(10);
    // One for the Daily Double, one for the final.
    expect(seen.filter((s) => s === 'wager')).toHaveLength(2);
    expect(seen.filter((s) => s === 'choice')).toHaveLength(11);
  });

  it('passes the device for every typed answer when two are playing', async () => {
    seedProfiles([makeProfile('Caden'), makeProfile('Ayu')]);
    seedPrefs({ format: 'quiz', pool: 'everything', quizLength: 5, timed: false, answerStyle: 'typed' });
    const user = userEvent.setup();
    const start = await openSetup(user);
    await user.click(screen.getByRole('button', { name: /add player/i }));
    await user.click(screen.getByRole('button', { name: /add ayu to this game/i }));
    await closePicker(user);
    await user.click(start);

    const seen = await playToEnd(user);
    expect(seen.filter((s) => s === 'handoff')).toHaveLength(10);
    expect(seen.filter((s) => s === 'typed')).toHaveLength(10);
  });

  it('deals the board from only the categories left switched on, and remembers them', async () => {
    seedProfiles([makeProfile('Caden')]);
    seedPrefs({ format: 'board', pool: 'everything', categories: 6, timed: false, dailyDouble: false, finalRound: false });
    const user = userEvent.setup();
    const start = await openSetup(user);
    // The switches fold away under the Categories card (MoreSettings).
    await openMoreSettings(user);

    // Everything but Theme Songs and Studio Credits.
    const off = ['The Director’s Chair', 'Who Scored It?', 'Source Material', 'Air Dates', 'Voice Cast', 'Who’s Who'];
    for (const title of off) {
      const name = new RegExp(`^${title.replace(/[?]/g, '\\?')}`);
      await user.click(screen.getByRole('checkbox', { name }));
    }
    expect(screen.getByText(/the board will have 2 categories instead of 6/i)).toBeTruthy();
    await user.click(start);

    expect(screen.getByText('Theme Songs')).toBeTruthy();
    expect(screen.getByText('Studio Credits')).toBeTruthy();
    expect(screen.queryByText('Voice Cast')).toBeNull();
    const saved = JSON.parse(localStorage.getItem('aniarcade_game_prefs')).aniquiz;
    expect(saved.topicsOff).toEqual(['staff', 'music', 'origins', 'calendar', 'voices', 'cast']);
  });

  it('will not start with every category switched off', async () => {
    seedProfiles([makeProfile('Caden')]);
    seedPrefs({ format: 'quiz', pool: 'everything', topicsOff: ['studios', 'staff', 'music', 'origins', 'themes', 'calendar', 'voices'] });
    const user = userEvent.setup();
    const start = await openSetup(user);
    await openMoreSettings(user);
    await user.click(screen.getByRole('checkbox', { name: /^Who’s Who/ }));
    expect(screen.getByText(/every category is off/i)).toBeTruthy();
    expect(start.disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: /switch all on/i }));
    expect(start.disabled).toBe(false);
  });

  it('says so, rather than starting, when nobody shares a show', async () => {
    seedProfiles([makeProfile('Caden'), { ...makeProfile('Ayu'), animeList: [] }]);
    seedPrefs({ format: 'board', pool: 'shared' });
    const user = userEvent.setup();
    renderArcade(<AniQuizGame onExit={() => {}} />);
    await user.click(screen.getByRole('button', { name: /play on this device/i }));
    await user.click(screen.getByRole('button', { name: /add player/i }));
    await user.click(screen.getByRole('button', { name: /add ayu to this game/i }));
    await closePicker(user);
    await waitFor(() => expect(screen.getByText(/no shows in common/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /start game/i }).disabled).toBe(true);
  });
});
