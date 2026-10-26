// @vitest-environment jsdom
//
// Whole local games through the real screens: two players bidding, peeking,
// buying a hint and answering both ways, through to "Final Scores" — plus a
// portrait that will not load. The rules tests prove a score is right; these
// prove a couch can get from Start to the results without a screen
// dead-ending, and that nothing on screen gives the answer away.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFile } from 'node:fs/promises';
import AniPeekGame from './AniPeekGame';
import { makeProfile, renderArcade, seedProfiles } from '../../shared/testing/arcade';
import { TILES, WRONG_BONUS } from './rules';

vi.mock('../../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched in a local-only test'); },
  getFirebaseDb: () => { throw new Error('firebase touched in a local-only test'); },
  ensureSignedIn: () => { throw new Error('firebase touched in a local-only test'); },
}));

const NAMES = ['Caden', 'Ayu'];
// The portrait URL carries the character's name, so the test — and only the
// test — can tell which option is right by reading the picture's address.
const slug = (name) => name.toLowerCase().replace(/\s+/g, '-');
const nameFromSrc = (src) => decodeURIComponent(src.split('/').pop().replace(/\.jpg$/, '')).replace(/-/g, ' ');

function withPortraits(profile) {
  return {
    ...profile,
    animeList: profile.animeList.map((a) => ({
      ...a,
      studio: 'Studio Test',
      characters: a.characters.map((c) => ({ ...c, imageUrl: `https://s4.anilist.co/c/${slug(c.name)}.jpg` })),
    })),
  };
}

let errors;
beforeEach(() => {
  localStorage.clear();
  seedProfiles(NAMES.map((n) => withPortraits(makeProfile(n))));
  // The pack is the app's own static file; serve it from public/ so the real
  // loader runs. Anything else is a bug, exactly as HubScreen.test.jsx says.
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const path = String(url);
    const at = path.indexOf('/facts/');
    if (at === -1) throw new Error(`unexpected fetch: ${path}`);
    return new Response(await readFile(`public/${path.slice(at + 1).split(/[?#]/)[0]}`), { status: 200 });
  }));
  errors = vi.spyOn(console, 'error');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function seedPrefs(prefs) {
  localStorage.setItem('aniarcade_game_prefs', JSON.stringify({ anipeek: prefs }));
}

async function openSetup(user) {
  renderArcade(<AniPeekGame onExit={() => {}} />);
  await user.click(screen.getByRole('button', { name: /play on this device/i }));
  for (const name of NAMES.slice(1)) {
    if (!screen.queryByRole('button', { name: new RegExp(`remove ${name}`, 'i') })) {
      await user.click(screen.getByRole('button', { name: /add player/i }));
      await user.click(screen.getByRole('button', { name: new RegExp(`add ${name} to this game`, 'i') }));
    }
  }
  const close = screen.queryByRole('button', { name: /^close$/i });
  if (close) await user.click(close);
  const start = screen.getByRole('button', { name: /start game/i });
  await waitFor(() => expect(start.disabled).toBe(false));
  return start;
}

const portrait = () => document.querySelector('figure img');

// Whatever the screen asks for, the cheapest answer. `answer(right, options)`
// picks what to say. Returns a label for what it did.
async function step(user, { answer, hint = false }) {
  const q = (role, name) => screen.queryByRole(role, { name });
  const pass = q('button', /^pass$/i);
  const bid = q('button', /^bid \d+$/i);
  if (bid) {
    if (pass && !pass.disabled) { await user.click(pass); return 'pass'; }
    await user.click(bid);
    return 'bid';
  }
  const studio = q('button', /^hint: studio$/i);
  if (hint && studio && !studio.disabled) { await user.click(studio); return 'hint'; }
  const tiles = screen.queryAllByRole('button', { name: /^uncover tile \d+$/i });
  if (tiles.length && screen.getAllByRole('heading').some((h) => /peek$/i.test(h.textContent))) {
    // Two tiles, then name them: a bot that is sure after two.
    const open = TILES - tiles.length;
    if (open < 2) { await user.click(tiles[0]); return 'tile'; }
  }
  const nameThem = q('button', /^name them$/i);
  if (nameThem) { await user.click(nameThem); return 'name'; }
  const right = portrait() && nameFromSrc(portrait().getAttribute('src'));
  const radios = screen.queryAllByRole('radio');
  if (radios.length) {
    const pick = answer(right, radios.map((r) => r.textContent.replace(/^[A-D]/, '')));
    await user.click(radios.find((r) => r.textContent.replace(/^[A-D]/, '').toLowerCase() === pick.toLowerCase()));
    await user.click(screen.getByRole('button', { name: /^lock in$/i }));
    return 'answer';
  }
  const box = q('combobox', /your answer/i);
  if (box) {
    await user.type(box, answer(right, []));
    await user.click(screen.getByRole('button', { name: /^lock in$/i }));
    return 'answer';
  }
  const next = q('button', /^(next round|see results)$/i);
  if (next) { await user.click(next); return 'next'; }
  return null;
}

async function playToEnd(user, opts) {
  const did = [];
  for (let i = 0; i < 200 && !screen.queryByRole('heading', { name: /final scores/i }); i++) {
    const what = await step(user, opts);
    if (!what) throw new Error(`stuck on: ${screen.getAllByRole('heading').map((h) => h.textContent).join(' / ')}`);
    did.push(what);
  }
  return did;
}

// Whole games through the real screens and the real pack run 3-5s each on a
// quiet machine — right at vitest's 5s default, so a busy one failed them.
// AniTurfGame.test.jsx's allowance.
describe('AniPeek, played locally', { timeout: 60000 }, () => {
  it('plays a whole game with multiple choice, a hint, and right answers scored 16 minus the bid', async () => {
    seedPrefs({ rounds: 4, answerStyle: 'choice', hints: true });
    const user = userEvent.setup();
    await openSetup(user);
    await user.click(screen.getByRole('button', { name: /start game/i }));

    // Before anything is uncovered, nothing on the page names the character.
    const img = portrait();
    expect(img.getAttribute('alt')).toBe('');
    expect(screen.queryAllByRole('button', { name: /^uncover tile/i })).toHaveLength(0); // still bidding

    const did = await playToEnd(user, { answer: (right) => right, hint: true });
    expect(did).toContain('hint');
    expect(did.filter((d) => d === 'answer')).toHaveLength(4);

    // Every round: the opener bid the default 8 and the other passed, so each
    // right answer was worth 16 − 8, two rounds each — a shared win.
    expect(screen.getAllByText(`${2 * (TILES - 8)} pts`).length).toBeGreaterThan(0);
    expect(errors).not.toHaveBeenCalled();
  });

  it('pays the other player for a typed miss', async () => {
    seedPrefs({ rounds: 4, answerStyle: 'typed', hints: false });
    const user = userEvent.setup();
    await openSetup(user);
    await user.click(screen.getByRole('button', { name: /start game/i }));
    // Hints off: no hint cards anywhere.
    expect(screen.queryByRole('region', { name: /hint cards/i })).toBeNull();

    await playToEnd(user, { answer: () => 'Nobody At All' });
    // Four misses, each paying the other player: two rounds each way.
    expect(screen.getAllByText(`${2 * WRONG_BONUS} pts`).length).toBeGreaterThan(0);
    expect(errors).not.toHaveBeenCalled();
  });

  it('skips a portrait that will not load, before any tile is open', async () => {
    seedPrefs({ rounds: 4, answerStyle: 'choice', hints: false });
    const user = userEvent.setup();
    await openSetup(user);
    await user.click(screen.getByRole('button', { name: /start game/i }));

    const first = portrait().getAttribute('src');
    fireEvent.error(portrait());
    expect(screen.getByText(/this portrait didn.t load/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /skip this character/i }));
    expect(portrait().getAttribute('src')).not.toBe(first);
    expect(screen.queryByText(/this portrait didn.t load/i)).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });
});
