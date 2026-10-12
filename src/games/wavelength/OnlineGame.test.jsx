// @vitest-environment jsdom
//
// The half of a timed AniWave round that lives in the view-router rather than in
// the hook, and so is out of reach of both rules.test.js and the smoke suite:
// the AUTO-LOCK (a dial placed but never locked still goes in when the clock
// runs out) and the DRAFT RESET (that dial must not ride into the next round).
// Both failures are silent: one scores as "no dial" a guess the player can see
// on screen; the other has the game supply someone's answer.
//
// The room hook is replaced by a plain object the test edits between renders,
// so every case is one exact room state rather than a timing race.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OnlineGame from './OnlineGame';
import { SPECTRA } from './spectra';

// RoomSetup and friends reach the firebase service, and vitest loads .env.local,
// which is production — see hub/HubScreen.test.jsx.
vi.mock('../../shared/services/firebase', () => ({
  firebaseEnabled: false,
  getFirebaseAuth: () => { throw new Error('firebase touched'); },
  getFirebaseDb: () => { throw new Error('firebase touched'); },
  ensureSignedIn: () => { throw new Error('firebase touched'); },
}));

let room;
vi.mock('./hooks/useWavelengthRoom', () => ({ useWavelengthRoom: () => room }));

const players = [
  { id: 'ann', name: 'Ann' },
  { id: 'ben', name: 'Ben' },
  { id: 'cat', name: 'Cat' },
];

// Ben is guessing in a timed text round that Ann is the psychic for.
function guessRoom({ round = 0, expired = false, ...rest } = {}) {
  return {
    roomCode: 'ABCDE',
    view: 'round',
    game: { round, phase: 'guess', psychicId: 'ann', mode: 'text', clue: 'hot' },
    players,
    psychic: players[0],
    pending: ['ben', 'cat'],
    dropping: [],
    spectrum: SPECTRA[0],
    timer: { expired, secondsLeft: expired ? 0 : 10, fraction: expired ? 0 : 0.5 },
    iAmPsychic: false,
    iHaveDialled: false,
    isHost: false,
    placeDial: vi.fn(),
    ...rest,
  };
}

const dial = () => screen.getByRole('slider');
const setDial = (value) => fireEvent.change(dial(), { target: { value: String(value) } });

let view;
const draw = (next) => {
  room = { ...room, ...next };
  if (view) view.rerender(<OnlineGame onBack={() => {}} onExit={() => {}} />);
  else view = render(<OnlineGame onBack={() => {}} onExit={() => {}} />);
};

beforeEach(() => {
  room = guessRoom();
  view = null;
});
afterEach(cleanup);

describe('AniWave online auto-lock', () => {
  it('submits a placed-but-unlocked dial when the clock runs out, exactly once', () => {
    draw();
    setDial(63);
    expect(room.placeDial).not.toHaveBeenCalled();

    const { placeDial } = room;
    draw({ timer: { expired: true, secondsLeft: 0, fraction: 0 } });
    expect(placeDial).toHaveBeenCalledTimes(1);
    expect(placeDial).toHaveBeenCalledWith(63);
    // The draft is kept on purpose, so the screen still says where it went.
    expect(screen.getByText(/your dial went in where you left it/i)).toBeTruthy();

    // The write lands: iHaveDialled is the guard, and nothing fires again.
    draw({ iHaveDialled: true, pending: ['cat'] });
    expect(screen.getByText(/dial locked in/i)).toBeTruthy();
    expect(placeDial).toHaveBeenCalledTimes(1);
  });

  it('writes nothing for a guesser who never touched the dial', () => {
    draw();
    draw({ timer: { expired: true, secondsLeft: 0, fraction: 0 } });
    expect(room.placeDial).not.toHaveBeenCalled();
    expect(screen.getByText(/no dial to score/i)).toBeTruthy();
  });

  it('never fires for a guesser whose dial is already in', () => {
    room = guessRoom({ iHaveDialled: true });
    draw({ timer: { expired: true, secondsLeft: 0, fraction: 0 } });
    expect(room.placeDial).not.toHaveBeenCalled();
  });

  it('a manual lock sends the draft and leaves it on screen', () => {
    draw();
    setDial(22);
    fireEvent.click(screen.getByRole('button', { name: /lock it in/i }));
    expect(room.placeDial).toHaveBeenCalledWith(22);
    expect(dial().getAttribute('aria-valuetext')).toMatch(/^22 of/);
  });
});

describe('AniWave online draft reset', () => {
  it("does not carry one round's dial into the next", () => {
    draw();
    setDial(40);
    expect(dial().getAttribute('aria-valuetext')).toMatch(/^40 of/);

    // "Next round" is a host-only button, so a guest's draft is never cleared
    // by anything they pressed — only by the round number moving.
    draw({ game: { ...room.game, round: 1 } });
    expect(dial().getAttribute('aria-valuetext')).toMatch(/^— of/);

    // And so the clock running out in round two has nothing to submit.
    const { placeDial } = room;
    draw({ timer: { expired: true, secondsLeft: 0, fraction: 0 } });
    expect(placeDial).not.toHaveBeenCalled();
  });
});
