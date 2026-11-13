// @vitest-environment jsdom
//
// A whole local game through the real screens: the drawer takes the device
// behind a handoff, picks in private, starts the clock, draws on the SVG pad
// (jsdom has no <canvas>, which is why the pad is SVG), and taps who named it;
// a second turn is given up. Through every reveal to "Final Scores". The rules
// tests prove the points; this proves a couch gets from Start to the results.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AniSketchGame from './AniSketchGame';
import { renderArcade, seedProfiles } from '../../shared/testing/arcade';
import { profileIdFromName } from '../../shared/utils/profileStats';

vi.mock('../../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched in a local-only test'); },
  getFirebaseDb: () => { throw new Error('firebase touched in a local-only test'); },
  ensureSignedIn: () => { throw new Error('firebase touched in a local-only test'); },
}));

const listFor = (name) => Array.from({ length: 6 }, (_, i) => ({
  id: `${name}_s${i}`,
  title: `Show ${i}`,
  characters: [{ id: `c${i}`, name: `Hero ${i}`, role: 'Main', imageUrl: `https://s4.anilist.co/c/${i}.jpg`, favourites: 10 }],
}));
const makeTable = (names) => names.map((n) => ({ id: profileIdFromName(n), name: n, animeList: listFor(n) }));

let errors;
beforeEach(() => {
  localStorage.clear();
  // Local play fetches nothing (root CLAUDE.md, "Network").
  vi.stubGlobal('fetch', vi.fn(async (url) => { throw new Error(`unexpected fetch: ${url}`); }));
  errors = vi.spyOn(console, 'error');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AniSketch, played locally', { timeout: 60000 }, () => {
  it('draws, names, gives up and finishes', async () => {
    const user = userEvent.setup();
    seedProfiles(makeTable(['Caden', 'Ayu']));
    renderArcade(<AniSketchGame onExit={() => {}} />);
    await user.click(screen.getByRole('button', { name: /play on this device/i }));
    if (!screen.queryByRole('button', { name: /remove ayu/i })) {
      await user.click(screen.getByRole('button', { name: /add player/i }));
      await user.click(screen.getByRole('button', { name: /add ayu to this game/i }));
      const close = screen.queryByRole('button', { name: /^close$/i });
      if (close) await user.click(close);
    }
    const go = screen.getByRole('button', { name: /start game/i });
    await waitFor(() => expect(go.disabled).toBe(false));
    await user.click(go);

    for (let turn = 0; turn < 2; turn++) {
      // The handoff, then the private pick: three choices off the lists.
      await user.click(await screen.findByRole('button', { name: /— ready$/i }));
      expect(screen.getByRole('heading', { name: /pick what to draw/i })).toBeTruthy();
      const choices = screen.getAllByRole('button', { name: /^draw /i });
      expect(choices).toHaveLength(3);
      await user.click(choices[0]);
      await user.click(screen.getByRole('button', { name: /^start drawing$/i }));

      // Draw a line, then either a guesser names it or the drawer gives up.
      expect(screen.getByRole('heading', { name: /^draw!$/i })).toBeTruthy();
      const pad = document.querySelector('[data-sketch="pad"]');
      fireEvent.pointerDown(pad, { clientX: 1, clientY: 1, pointerId: 1 });
      fireEvent.pointerMove(pad, { clientX: 5, clientY: 5, pointerId: 1 });
      fireEvent.pointerUp(pad, { pointerId: 1 });
      expect(screen.getByRole('img', { name: /your drawing, 1 stroke$/i })).toBeTruthy();
      if (turn === 0) await user.click(screen.getByRole('button', { name: / got it$/i }));
      else await user.click(screen.getByRole('button', { name: /^give up$/i }));

      // The reveal names the character and keeps the drawing.
      expect(await screen.findByRole('heading', { name: /it was…/i })).toBeTruthy();
      expect(screen.getByRole('img', { name: /drawing, 1 stroke$/i })).toBeTruthy();
      expect(screen.getByRole('list', { name: /who named it/i })).toBeTruthy();
      await user.click(screen.getByRole('button', { name: turn === 0 ? /^next turn$/i : /^see results$/i }));
    }

    expect(await screen.findByRole('heading', { name: /final scores/i })).toBeTruthy();
    expect(screen.getByText(/the drawings/i)).toBeTruthy();
    expect(errors).not.toHaveBeenCalled();
  }, 30000);

  it('holds Start for a table of one', async () => {
    const user = userEvent.setup();
    seedProfiles(makeTable(['Caden']));
    renderArcade(<AniSketchGame onExit={() => {}} />);
    await user.click(screen.getByRole('button', { name: /play on this device/i }));
    for (const b of screen.queryAllByRole('button', { name: /^remove (?!caden)/i })) await user.click(b);
    expect(screen.getByRole('button', { name: /start game/i }).disabled).toBe(true);
    expect(screen.getByText(/needs 2 players/i)).toBeTruthy();
  });
});
