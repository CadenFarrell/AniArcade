// @vitest-environment jsdom
//
// Whole local games through the real screens: a table of two passing the
// device (each pick behind a handoff) and a table of one (no handoff at all),
// through every reveal to "Final Scores". The rules and deal tests prove a
// score and a round are right; these prove a couch gets from Start to the
// results without a screen dead-ending, and that nothing gives a pick away.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFile } from 'node:fs/promises';
import AniOutGame from './AniOutGame';
import { renderArcade, seedProfiles } from '../../shared/testing/arcade';
import { profileIdFromName } from '../../shared/utils/profileStats';

vi.mock('../../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched in a local-only test'); },
  getFirebaseDb: () => { throw new Error('firebase touched in a local-only test'); },
  ensureSignedIn: () => { throw new Error('firebase touched in a local-only test'); },
}));

// Forty pictured shows whose studios, years and sources cycle at different
// periods, so the deal finds clean rounds with no pack at all.
const STUDIOS = ['MAPPA', 'Bones', 'Madhouse', 'Kyoto Animation'];
function listFor(name) {
  return Array.from({ length: 40 }, (_, i) => ({
    id: `${name}_s${i}`,
    title: `Show ${i}`,
    studio: STUDIOS[i % 4],
    seasonYear: 2010 + (i % 5),
    source: ['MANGA', 'LIGHT_NOVEL', 'ORIGINAL'][i % 3],
    format: 'TV',
    characters: [{
      id: `c${i}`,
      name: `Hero ${i}`,
      role: 'Main',
      gender: 'Male',
      imageUrl: `https://s4.anilist.co/c/${i}.jpg`,
      genres: ['Action'],
      favourites: 100 + i,
    }],
  }));
}
const makeTable = (names) => names.map((n) => ({ id: profileIdFromName(n), name: n, animeList: listFor(n) }));

let errors;
beforeEach(() => {
  localStorage.clear();
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

async function start(user, names, prefs) {
  seedProfiles(makeTable(names));
  localStorage.setItem('aniarcade_game_prefs', JSON.stringify({ aniout: prefs }));
  renderArcade(<AniOutGame onExit={() => {}} />);
  await user.click(screen.getByRole('button', { name: /play on this device/i }));
  for (const name of names.slice(1)) {
    if (!screen.queryByRole('button', { name: new RegExp(`remove ${name}`, 'i') })) {
      await user.click(screen.getByRole('button', { name: /add player/i }));
      await user.click(screen.getByRole('button', { name: new RegExp(`add ${name} to this game`, 'i') }));
    }
  }
  const close = screen.queryByRole('button', { name: /^close$/i });
  if (close) await user.click(close);
  for (const name of screen.queryAllByRole('button', { name: /^remove /i }).map((b) => b.getAttribute('aria-label') ?? b.textContent)) {
    if (!names.some((n) => new RegExp(n, 'i').test(name))) await user.click(screen.getByRole('button', { name }));
  }
  const go = screen.getByRole('button', { name: /start game/i });
  await waitFor(() => expect(go.disabled).toBe(false));
  await user.click(go);
}

// Whatever the screen asks for: ready, a pick (first character, first
// reason), Lock in, Next. Returns what it did.
async function step(user) {
  const q = (role, name) => screen.queryByRole(role, { name });
  const ready = q('button', /— ready$/i);
  if (ready) { await user.click(ready); return 'ready'; }
  const characters = screen.queryByRole('radiogroup', { name: 'Characters' });
  if (characters) {
    // Nothing is stamped OUT before a pick.
    expect(within(characters).queryByText(/^out$/i)).toBeNull();
    await user.click(within(characters).getAllByRole('radio')[0]);
    const reasons = screen.queryAllByRole('radio', { name: /^reason: /i });
    if (reasons.length) await user.click(reasons[0]);
    await user.click(screen.getByRole('button', { name: /^lock in$/i }));
    return 'pick';
  }
  const next = q('button', /^(next round|see results)$/i);
  if (next) {
    // The reveal names the connection and the one who broke it.
    expect(screen.getByRole('heading', { name: /who was out/i })).toBeTruthy();
    expect(screen.getByText(/^…except /)).toBeTruthy();
    await user.click(next);
    return 'next';
  }
  return null;
}

async function playToEnd(user) {
  const log = [];
  for (let i = 0; i < 80 && !screen.queryByRole('heading', { name: /final scores/i }); i++) {
    const did = await step(user);
    if (!did) throw new Error(`stuck after ${log.join(',')}`);
    log.push(did);
  }
  expect(screen.getByRole('heading', { name: /final scores/i })).toBeTruthy();
  return log;
}

describe('AniOut, played locally', () => {
  it('passes the device for every pick, then reveals, through to the results', async () => {
    const user = userEvent.setup();
    await start(user, ['Caden', 'Ayu'], { rounds: 4, cards: 6, reasons: true, sharedOnly: false });
    const log = await playToEnd(user);
    expect(log.filter((s) => s === 'ready')).toHaveLength(8);
    expect(log.filter((s) => s === 'pick')).toHaveLength(8);
    expect(log.filter((s) => s === 'next')).toHaveLength(4);
    expect(errors).not.toHaveBeenCalled();
  }, 30000);

  it('plays a table of one with no handoff and no reasons', async () => {
    const user = userEvent.setup();
    await start(user, ['Caden'], { rounds: 4, cards: 5, reasons: false, sharedOnly: false });
    const log = await playToEnd(user);
    expect(log).not.toContain('ready');
    expect(log.filter((s) => s === 'pick')).toHaveLength(4);
    expect(errors).not.toHaveBeenCalled();
  }, 30000);
});
