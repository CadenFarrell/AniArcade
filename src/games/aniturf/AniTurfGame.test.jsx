// @vitest-environment jsdom
//
// Whole local games through the real screens: four players split into teams,
// both clue-givers planting traps behind their handoffs, clues given, squares
// claimed, through to the results — and a second game with the crown moved on.
// The rules tests prove a claim resolves correctly; this proves a couch can get
// from Start to "Final Board" without a screen dead-ending.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AniTurfGame from './AniTurfGame';
import { makeProfile, renderArcade, seedProfiles } from '../../shared/testing/arcade';

vi.mock('../../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched in a local-only test'); },
  getFirebaseDb: () => { throw new Error('firebase touched in a local-only test'); },
  ensureSignedIn: () => { throw new Error('firebase touched in a local-only test'); },
}));

const NAMES = ['Caden', 'Ayu', 'Ben', 'Dee'];
let errors;

beforeEach(() => {
  localStorage.clear();
  // Every makeProfile holds the same 28 characters, so four of them deal a board.
  seedProfiles(NAMES.map((n) => makeProfile(n)));
  errors = vi.spyOn(console, 'error');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function seedPrefs(prefs) {
  localStorage.setItem('aniarcade_game_prefs', JSON.stringify({ aniturf: prefs }));
}

async function seatTable(user) {
  renderArcade(<AniTurfGame onExit={() => {}} />);
  await user.click(screen.getByRole('button', { name: /play on this device/i }));
  for (const name of NAMES.slice(1)) {
    if (!screen.queryByRole('button', { name: new RegExp(`add ${name} to this game`, 'i') })) {
      await user.click(screen.getByRole('button', { name: /add player/i }));
    }
    await user.click(screen.getByRole('button', { name: new RegExp(`add ${name} to this game`, 'i') }));
  }
  const close = screen.queryByRole('button', { name: /^close$/i });
  if (close) await user.click(close);
}

// Whatever the screen asks for, the cheapest answer. Returns what it did.
let clueNo = 0;
async function step(user) {
  const q = (role, name) => screen.queryByRole(role, { name });
  const show = q('button', /— show me$/);
  if (show) { await user.click(show); return 'handoff'; }
  const plant = q('button', /^plant traps/i);
  if (plant) {
    if (plant.disabled) {
      const open = screen.getAllByRole('button', { name: /^Trap / }).find((b) => b.getAttribute('aria-pressed') !== 'true');
      await user.click(open);
      return 'trap';
    }
    await user.click(plant);
    return 'plant';
  }
  const gotIt = q('button', /^got it$/i);
  if (gotIt) { await user.click(gotIt); return 'key'; }
  const clue = q('textbox', /^clue$/i);
  if (clue) {
    clueNo += 1;
    await user.clear(clue);
    await user.type(clue, `zeta${clueNo}`);
    await user.click(screen.getByRole('button', { name: /give the clue/i }));
    return 'clue';
  }
  const picks = screen.queryAllByRole('button', { name: /^Pick / });
  if (picks.length) {
    await user.click(picks[0]);
    await user.click(screen.getByRole('button', { name: /^Claim / }));
    return 'claim';
  }
  const end = q('button', /^end turn$/i);
  if (end && !end.disabled) { await user.click(end); return 'stop'; }
  const results = q('button', /^see results$/i);
  if (results) { await user.click(results); return 'over'; }
  return null;
}

async function playToResults(user) {
  const seen = [];
  for (let i = 0; i < 600; i++) {
    if (screen.queryByRole('heading', { level: 1, name: /final board/i })) return seen;
    const did = await step(user);
    if (!did) throw new Error(`stuck after ${seen.slice(-6).join(', ')}:\n${document.body.textContent.slice(0, 600)}`);
    seen.push(did);
  }
  throw new Error('game never ended');
}

// A whole game is a few hundred presses through jsdom; five seconds is not enough.
describe('AniTurf, played locally', { timeout: 60000 }, () => {
  it('splits the table evenly into teams and needs four players', async () => {
    const user = userEvent.setup();
    renderArcade(<AniTurfGame onExit={() => {}} />);
    await user.click(screen.getByRole('button', { name: /play on this device/i }));
    // The four profiles on this device are seated already (shared/utils/autoSeat.js).
    expect(screen.getAllByRole('button', { name: /^remove /i })).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: /^remove dee$/i }));
    expect(screen.getByRole('button', { name: /start game/i }).disabled).toBe(true);
    expect(screen.getByText(/needs 4 players/i)).toBeTruthy();
  });

  it('plays a whole game with traps, then a second with the crown moved on', async () => {
    seedPrefs({ sharedOnly: false, traps: 1 });
    const user = userEvent.setup();
    await seatTable(user);
    // Seats alternate, so Caden and Ben are Red, Ayu and Dee Blue; the first
    // seat of each is its clue-giver.
    expect(screen.getByRole('button', { name: /make caden clue-giver/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /make ayu clue-giver/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /move ben to blue/i })).toBeTruthy();
    const start = screen.getByRole('button', { name: /start game/i });
    await waitFor(() => expect(start.disabled).toBe(false));
    await user.click(start);

    const seen = await playToResults(user);
    // Both clue-givers saw their key and planted one trap each: the same for
    // both teams, since the opening clue's cap pays back moving first.
    expect(seen.filter((s) => s === 'plant')).toHaveLength(2);
    expect(seen.filter((s) => s === 'trap')).toHaveLength(2);
    expect(seen).toContain('clue');
    expect(seen).toContain('claim');
    expect(screen.getByRole('region', { name: /^winner:/i })).toBeTruthy();
    expect(screen.getByText(/takes the turf/i)).toBeTruthy();
    // Both keys are revealed on the final board.
    const squares = screen.getAllByRole('img').map((el) => el.getAttribute('aria-label') ?? '');
    expect(squares.some((l) => /Red's footing/.test(l))).toBe(true);
    expect(squares.some((l) => /Blue's footing/.test(l))).toBe(true);

    // Play again: the same teams, the crown on each team's next seat.
    await user.click(screen.getByRole('button', { name: /^play again$/i }));
    const first = await screen.findByRole('button', { name: /— show me$/ });
    expect(first.textContent).toMatch(/I'm (Ben|Dee) — show me/);
    expect(errors).not.toHaveBeenCalled();
  });

  it('opens on the first clue when traps are off', async () => {
    seedPrefs({ sharedOnly: false, traps: 0 });
    const user = userEvent.setup();
    await seatTable(user);
    await user.click(screen.getByRole('button', { name: /start game/i }));
    await user.click(await screen.findByRole('button', { name: /— show me$/ }));
    expect(screen.getByRole('heading', { name: /your clue/i })).toBeTruthy();
    // A board name is refused as a clue, with the reason.
    await user.type(screen.getByRole('textbox', { name: /^clue$/i }), 'HeroA');
    expect(screen.getByText(/part of heroa/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /give the clue/i }).disabled).toBe(true);
    const seen = await playToResults(user);
    expect(seen).not.toContain('plant');
    expect(errors).not.toHaveBeenCalled();
  });

  it('keeps the teams a table arranged when it goes back to change them', async () => {
    seedPrefs({ sharedOnly: false, traps: 0 });
    const user = userEvent.setup();
    await seatTable(user);
    await user.click(screen.getByRole('button', { name: /move ben to blue/i }));
    await user.click(screen.getByRole('button', { name: /move ayu to red/i }));
    await user.click(screen.getByRole('button', { name: /make ben clue-giver/i }));
    await user.click(screen.getByRole('button', { name: /start game/i }));
    await playToResults(user);
    await user.click(screen.getByRole('button', { name: /change teams/i }));
    expect(screen.getByRole('button', { name: /make ben clue-giver/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /move ayu to blue/i })).toBeTruthy();
  });
});
