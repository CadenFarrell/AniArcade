import { describe, expect, it } from 'vitest';
import {
  DRAWER_PER_GUESSER, GRACE_MS, GUESS_MAX, GUESS_MIN, endGame, enoughPlayers, giveUp, guess, markDealt, markGot,
  nextTurn, normalizeGame, pointsAt, publishReveal, settleGuesses, settleIfComplete, sketchAwards, standings,
  startDrawing, startGame, timeUp, usedKeys,
} from './rules';

const IDS = ['a', 'b', 'c'];
const T0 = 1_000_000;
const apply = (game, { patch }) => ({ ...game, ...patch });
const CHAR = { key: 'kakashi hatake', name: 'Kakashi Hatake', series: 'Naruto', imageUrl: 'https://x/k.jpg' };

// A game on its first drawing, the clock started at T0.
function drawing(ids = IDS) {
  let g = startGame({ ids, laps: 1, drawSeconds: 80 });
  g = apply(g, markDealt(g, 0));
  return apply(g, startDrawing(g, ids[0], T0));
}
const isKakashi = (text) => /kakashi/i.test(text);

describe('a turn', () => {
  it('rotates the drawer once round the table per lap', () => {
    const g = startGame({ ids: IDS, laps: 2, drawSeconds: 60 });
    expect(g.turns).toBe(6);
    expect(g.drawer).toBe('a');
    expect(g.drawMs).toBe(60000);
  });

  it('starts the clock only for the drawer, and only once the offer is out', () => {
    const g = startGame({ ids: IDS });
    expect(startDrawing(g, 'a', T0).patch).toEqual({});
    const dealt = apply(g, markDealt(g, 0));
    expect(markDealt(dealt, 0).patch).toEqual({});
    expect(startDrawing(dealt, 'b', T0).patch).toEqual({});
    expect(startDrawing(dealt, 'a', T0).patch).toMatchObject({ phase: 'drawing', deadlineAt: T0 + 80000 });
  });

  it('pays a guess more the sooner it lands, never under the floor', () => {
    const g = drawing();
    expect(pointsAt(g, T0)).toBe(GUESS_MAX);
    expect(pointsAt(g, T0 + 40000)).toBe(GUESS_MAX / 2);
    expect(pointsAt(g, T0 + 79000)).toBe(GUESS_MIN);
  });
});

describe('typed guesses (online)', () => {
  it('waits for the drawer’s judge, blanks a right guess, and pays both sides', () => {
    let g = drawing();
    g = apply(g, guess(g, 'b', 'naruto', { now: T0 + 1000 }));
    g = apply(g, guess(g, 'c', 'Kakashi', { now: T0 + 2000 }));
    expect(g.guesses.map((x) => x.verdict)).toEqual(['pending', 'pending']);
    g = apply(g, settleGuesses(g, isKakashi, IDS));
    expect(g.guesses.map((x) => x.verdict)).toEqual(['wrong', 'right']);
    expect(g.guesses[1].text).toBe('');
    expect(g.scores.c).toBe(pointsAt(g, T0 + 2000));
    expect(g.scores.a).toBe(DRAWER_PER_GUESSER);
    expect(g.phase).toBe('drawing');
    g = apply(g, guess(g, 'b', 'kakashi sensei', { now: T0 + 3000 }));
    g = apply(g, settleGuesses(g, isKakashi, IDS));
    expect(g.phase).toBe('revealed');
    expect(g.scores.a).toBe(2 * DRAWER_PER_GUESSER);
  });

  it('refuses the drawer, a second guess waiting, one who has it, and a late one', () => {
    let g = drawing();
    expect(guess(g, 'a', 'x', { now: T0 }).patch).toEqual({});
    g = apply(g, guess(g, 'b', 'one', { now: T0 }));
    expect(guess(g, 'b', 'two', { now: T0 }).patch).toEqual({});
    expect(guess(g, 'c', '   ', { now: T0 }).patch).toEqual({});
    expect(guess(g, 'c', 'late', { now: g.deadlineAt + GRACE_MS + 1 }).patch).toEqual({});
    // Inside the grace, it counts as sent at the deadline: the floor's points.
    g = apply(g, guess(g, 'c', 'kakashi', { now: g.deadlineAt + 500 }));
    g = apply(g, settleGuesses(g, isKakashi, IDS));
    expect(g.got.c.points).toBe(GUESS_MIN);
    expect(guess(g, 'c', 'again', { now: T0 }).patch).toEqual({});
  });

  it('closes on time only past the grace, and never over a guess still waiting', () => {
    let g = drawing();
    expect(timeUp(g, g.deadlineAt).patch).toEqual({});
    g = apply(g, guess(g, 'b', 'x', { now: g.deadlineAt }));
    expect(timeUp(g, g.deadlineAt + GRACE_MS).patch).toEqual({});
    g = apply(g, settleGuesses(g, () => false, IDS));
    expect(timeUp(g, g.deadlineAt + GRACE_MS).patch).toEqual({ phase: 'revealed' });
  });
});

describe('the couch (local)', () => {
  it('credits whoever the drawer taps, at the moment they tap', () => {
    let g = drawing();
    g = apply(g, markGot(g, 'b', T0 + 20000, IDS));
    expect(g.got.b).toMatchObject({ points: Math.ceil(GUESS_MAX * 0.75), left: 60 });
    expect(markGot(g, 'b', T0, IDS).patch).toEqual({});
    expect(markGot(g, 'a', T0, IDS).patch).toEqual({});
    g = apply(g, markGot(g, 'c', T0 + 30000, IDS));
    expect(g.phase).toBe('revealed');
  });
});

describe('ending a turn', () => {
  it('lets the drawer give up, and publishes the character once', () => {
    let g = drawing();
    expect(giveUp(g, 'b').patch).toEqual({});
    g = apply(g, giveUp(g, 'a'));
    expect(g).toMatchObject({ phase: 'revealed', gaveUp: true });
    expect(publishReveal(g, 1, CHAR).patch).toEqual({});
    g = apply(g, publishReveal(g, 0, CHAR));
    expect(g.reveal.name).toBe('Kakashi Hatake');
    expect(publishReveal(g, 0, CHAR).patch).toEqual({});
  });

  it('logs each turn, skips a departed drawer, and finishes', () => {
    let g = apply(drawing(), giveUp(drawing(), 'a'));
    g = apply(g, publishReveal(g, 0, CHAR));
    // b has left: their turn to draw is skipped.
    g = apply(g, nextTurn(g, ['a', 'c']));
    expect(g).toMatchObject({ turn: 2, drawer: 'c', phase: 'choosing', deal: 1, dealt: false, got: {}, reveal: null });
    expect(g.log[0]).toMatchObject({ turn: 0, drawer: 'a', character: { name: 'Kakashi Hatake' }, gaveUp: true });
    expect(usedKeys(g)).toEqual(['kakashi hatake']);
    g = apply(g, giveUp(g, 'c'));
    g = apply(g, nextTurn(g, ['a', 'c']));
    expect(g.phase).toBe('finished');
    expect(endGame(g).patch).toEqual({});
  });
});

describe('departures', () => {
  it('voids a turn whose drawer left, or that nobody is left to guess', () => {
    const g = drawing();
    expect(settleIfComplete(g, ['b', 'c']).patch).toEqual({ phase: 'revealed', void: true });
    expect(settleIfComplete(g, ['a']).patch).toEqual({ phase: 'revealed', void: true });
    expect(settleIfComplete(g, IDS).patch).toEqual({});
    // Everyone still here has it: the turn is simply over.
    const got = apply(g, markGot(g, 'b', T0, IDS));
    expect(settleIfComplete(got, ['a', 'b']).patch).toEqual({ phase: 'revealed' });
    expect(enoughPlayers(g, ['a'])).toBe(false);
    expect(enoughPlayers(g, ['a', 'c'])).toBe(true);
  });
});

describe('repair', () => {
  it('rebuilds what RTDB drops', () => {
    const g = normalizeGame({ order: { 0: 'a', 1: 'b' }, phase: 'drawing', drawer: 'a', deadlineAt: 5, turns: 2 });
    expect(g).toMatchObject({ order: ['a', 'b'], got: {}, guesses: [], log: [], scores: {}, reveal: null, deadlineAt: 5 });
    expect(normalizeGame(null)).toBeNull();
  });

  it('ranks ties together', () => {
    const r = standings([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { a: 5, b: 5, c: 1 });
    expect(r.map((p) => p.position)).toEqual([1, 1, 3]);
  });
});

describe('awards', () => {
  const players = IDS.map((id) => ({ id, name: id.toUpperCase() }));
  const line = (over) => ({ turn: 0, drawer: 'a', character: CHAR, got: {}, wrong: {}, guessers: ['b', 'c'], void: false, gaveUp: false, ...over });

  it('names the snap judgement, the masterpiece and the art critic', () => {
    const log = [
      line({ got: { b: { left: 70, points: 9 }, c: { left: 20, points: 3 } } }),
      line({ drawer: 'b', guessers: ['a', 'c'], got: { a: { left: 30, points: 4 } } }),
    ];
    const titles = Object.fromEntries(sketchAwards(log, players).map((a) => [a.title, a]));
    expect(titles['Snap judgement'].player.id).toBe('b');
    expect(titles['Snap judgement'].detail).toBe('Named Kakashi Hatake with 70s to go');
    expect(titles.Masterpiece.player.id).toBe('a');
    expect(titles['Art critic'].player.id).toBe('a');
  });

  it('roasts the abstract, the blank canvas and the spray', () => {
    const log = [
      line({}),
      line({ drawer: 'b', guessers: ['a', 'c'], gaveUp: true, wrong: { c: 6 } }),
    ];
    const titles = Object.fromEntries(sketchAwards(log, players).map((a) => [a.title, a]));
    expect(titles['Abstract art'].player.id).toBe('a');
    expect(titles['Blank canvas'].player.id).toBe('b');
    expect(titles['Spray and pray'].detail).toBe('6 wrong guesses');
  });

  it('says nothing about a void turn', () => {
    expect(sketchAwards([line({ void: true })], players)).toEqual([]);
  });
});
