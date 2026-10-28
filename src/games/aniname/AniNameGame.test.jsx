// @vitest-environment jsdom
//
// Whole local games through the real screens: two players bidding, the top
// bidder naming against the clock (a right name, a wrong one, an unknown one),
// the table ruling, and on to "Final Scores" — plus a table of one. The rules
// and answers tests prove a verdict is right; these prove a couch gets from
// Start to the results without a screen dead-ending.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFile } from 'node:fs/promises';
import AniNameGame from './AniNameGame';
import { renderArcade, seedProfiles } from '../../shared/testing/arcade';
import { profileIdFromName } from '../../shared/utils/profileStats';

vi.mock('../../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched in a local-only test'); },
  getFirebaseDb: () => { throw new Error('firebase touched in a local-only test'); },
  ensureSignedIn: () => { throw new Error('firebase touched in a local-only test'); },
}));

// Twelve shows of eight named characters, four studios and three years: enough
// "characters from" and "animated by" categories with no pack at all, and
// character names the test can type ("Hero 3 1") without knowing the round.
const STUDIOS = ['Studio Kappa', 'Studio Lambda', 'Studio Mu', 'Studio Nu'];
function listFor() {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `s${i}`,
    title: `Show ${i}`,
    studio: STUDIOS[i % 4],
    seasonYear: 2010 + (i % 3),
    characters: Array.from({ length: 8 }, (__, j) => ({
      id: `c${i}-${j}`, name: `Hero ${i} ${j}`, role: j < 4 ? 'Main' : 'Supporting', gender: 'Male', genres: ['Action'],
    })),
  }));
}
const makeTable = (names) => names.map((n) => ({ id: profileIdFromName(n), name: n, animeList: listFor() }));

let errors;
beforeEach(() => {
  localStorage.clear();
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
  localStorage.setItem('aniarcade_game_prefs', JSON.stringify({ aniname: prefs }));
  // Seat exactly this table next time the setup opens (useAutoSeat).
  localStorage.setItem('aniarcade_last_tables', JSON.stringify({ aniname: names.map(profileIdFromName) }));
  renderArcade(<AniNameGame onExit={() => {}} />);
  await user.click(screen.getByRole('button', { name: /play on this device/i }));
  for (const name of names) {
    if (!screen.queryByRole('button', { name: new RegExp(`remove ${name}`, 'i') })) {
      await user.click(screen.getByRole('button', { name: /add player/i }));
      await user.click(screen.getByRole('button', { name: new RegExp(`add ${name} to this game`, 'i') }));
    }
  }
  for (const btn of screen.queryAllByRole('button', { name: /^remove /i })) {
    const label = btn.getAttribute('aria-label') ?? btn.textContent;
    if (!names.some((n) => label.toLowerCase().includes(n.toLowerCase()))) await user.click(btn);
  }
  const go = screen.getByRole('button', { name: /start game/i });
  await waitFor(() => expect(go.disabled).toBe(false));
  await user.click(go);
}

// Whatever the screen asks for. Bids what the stepper offers when opening,
// drops out otherwise; names
// one right answer (a character from the round's show, read off the category),
// one stranger, then stops; the table accepts every unknown name.
async function step(user, log) {
  const q = (role, name) => screen.queryByRole(role, { name });
  const bid = q('button', /^bid \d+$/i);
  if (bid) {
    const drop = q('button', /^drop out$/i);
    if (drop && !drop.disabled) { await user.click(drop); return 'drop'; }
    // The stepper opens on 3; one step down bids 2, which a right name and an
    // unknown one can only make through the table's review.
    await user.click(screen.getByRole('button', { name: /^decrease count$/i }));
    await user.click(screen.getByRole('button', { name: /^bid \d+$/i }));
    return 'bid';
  }
  const box = q('textbox', /your answer/i);
  if (box) {
    const list = screen.queryByRole('list', { name: 'Answers' });
    const named = list ? within(list).queryAllByRole('listitem').length : 0;
    if (named >= 2) { await user.click(q('button', /^i'?m done$/i)); return 'done'; }
    const category = screen.queryAllByText((t, el) => el?.tagName === 'P' && /characters from show \d+/i.test(t))[0];
    const show = category?.textContent.match(/Show (\d+)/)?.[1];
    const text = named === 0 && show ? `Hero ${show} 0` : `Stranger ${log.length}`;
    await user.type(box, `${text}{Enter}`);
    return 'name';
  }
  const accept = screen.queryAllByRole('button', { name: /^accept /i });
  if (accept.length) { await user.click(accept[0]); return 'accept'; }
  const next = q('button', /^(next round|see results)$/i);
  if (next) { await user.click(next); return 'next'; }
  return null;
}

async function playToEnd(user) {
  const log = [];
  for (let i = 0; i < 120 && !screen.queryByRole('heading', { name: /final scores/i }); i++) {
    const did = await step(user, log);
    if (!did) throw new Error(`stuck after ${log.join(',')}`);
    log.push(did);
  }
  expect(screen.getByRole('heading', { name: /final scores/i })).toBeTruthy();
  return log;
}

describe('AniName, played locally', () => {
  it('runs the auction, the naming, the table’s ruling and the reveal to the results', async () => {
    const user = userEvent.setup();
    await start(user, ['Caden', 'Ayu'], { rounds: 3, seconds: 60 });
    const log = await playToEnd(user);
    expect(log.filter((s) => s === 'bid')).toHaveLength(3);
    expect(log.filter((s) => s === 'next')).toHaveLength(3);
    expect(log).toContain('name');
    // A right name plus an unknown one meets a bid of 2 only if the table
    // accepts the unknown, so every round that named both went to review.
    expect(log).toContain('accept');
    expect(errors).not.toHaveBeenCalled();
  }, 30000);

  it('plays a table of one', async () => {
    const user = userEvent.setup();
    await start(user, ['Caden'], { rounds: 3, seconds: 30 });
    const log = await playToEnd(user);
    expect(log).not.toContain('drop');
    expect(errors).not.toHaveBeenCalled();
  }, 30000);
});
