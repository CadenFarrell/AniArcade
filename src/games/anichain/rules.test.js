import { describe, expect, it } from 'vitest';
import * as rules from './rules';

const apply = (game, { patch }) => ({ ...game, ...patch });
const pairGame = (opts = {}) => rules.startGame({ ids: ['a', 'b', 'c', 'd'], cap: 10, rounds: 4, ...opts });
// Deal, then add words as the givers in turn (local: text null, no clock).
const dealt = (g) => apply(g, rules.markDealt(g, g.deal));
function words(g, count, opts) {
  let out = g;
  for (let i = 0; i < count; i++) out = apply(out, rules.addWord(out, rules.nextGiver(out), opts?.text ?? null, opts));
  return out;
}

describe('the turn', () => {
  it('rotates the pair one seat a round, and the first word alternates', () => {
    const g = pairGame();
    expect(g.givers).toEqual(['a', 'b']);
    expect(rules.pickGivers(g, 1, 0)).toEqual(['b', 'c']);
    expect(rules.pickGivers(g, 3, 0)).toEqual(['d', 'a']);
    // A departed seat is skipped.
    expect(rules.pickGivers(g, 1, 0, ['a', 'c', 'd'])).toEqual(['c', 'd']);
  });

  it('alternates the givers word by word, up to the cap', () => {
    let g = dealt(pairGame({ cap: 3 }));
    expect(rules.nextGiver(g)).toBe('a');
    expect(rules.addWord(g, 'b').patch).toEqual({});
    g = words(g, 3);
    expect(g.chain.map((w) => w.by)).toEqual(['a', 'b', 'a']);
    expect(rules.addWord(g, 'b').patch).toEqual({});
  });

  it('refuses a word before the deal, and a word that is not one word', () => {
    const g = pairGame();
    expect(rules.addWord(g, 'a').patch).toEqual({});
    expect(rules.addWord(dealt(g), 'a', 'two words').patch).toEqual({});
    expect(rules.addWord(dealt(g), 'a', 'ninja').patch.chain).toEqual([{ by: 'a', text: 'ninja' }]);
  });

  it('lets a giver skip twice before the first word, never after', () => {
    let g = pairGame();
    g = apply(g, rules.skip(g, 'a'));
    expect(g.skips).toBe(1);
    expect(rules.skip(g, 'c').patch).toEqual({}); // not a giver
    g = dealt(g);
    g = apply(g, rules.skip(g, 'b'));
    expect(g.phase).toBe('deal');
    expect(rules.skip(g, 'a').patch).toEqual({}); // out of skips
    g = words(dealt(g), 1);
    expect(rules.skip({ ...g, skips: 0 }, 'a').patch).toEqual({});
  });
});

describe('scoring', () => {
  it('a pair game pays the guesser the value and each giver half, rounded up', () => {
    let g = words(dealt(pairGame()), 3);
    expect(rules.gotIt(g, 'a').patch).toEqual({}); // a giver cannot get it
    g = apply(g, rules.gotIt(g, 'c'));
    expect(g.phase).toBe('over');
    expect(g.result).toMatchObject({ kind: 'got', by: 'c', n: 3, value: 8 });
    expect(g.scores).toEqual({ a: 4, b: 4, c: 8, d: 0 });
    expect(g.log[0]).toMatchObject({ kind: 'got', words: 3, givers: ['a', 'b'] });
  });

  it('never scores less than one, and out of words or a banned word score nothing', () => {
    expect(rules.valueAt(10, 12)).toBe(1);
    let g = words(dealt(pairGame({ cap: 2 })), 2);
    g = apply(g, rules.outOfWords(g));
    expect(g.result.kind).toBe('out');
    expect(Object.values(g.scores).every((s) => s === 0)).toBe(true);
    let h = words(dealt(pairGame()), 1);
    h = apply(h, rules.bannedWord(h, 'b'));
    expect(h.result).toMatchObject({ kind: 'banned', by: 'b', value: 0 });
  });
});

describe('rival givers', () => {
  const teams = { red: ['a', 'b'], blue: ['c', 'd'] };
  it('lets only the team whose giver said the word guess it', () => {
    let g = dealt(rules.startGame({ ids: ['a', 'b', 'c', 'd'], shape: 'rivals', teams }));
    expect(g.givers).toEqual(['a', 'c']);
    g = words(g, 1); // Red's word
    expect(rules.currentGuessers(g)).toEqual(['b']);
    expect(rules.gotIt(g, 'd').patch).toEqual({});
    g = words(g, 1); // Blue's word
    expect(rules.currentGuessers(g)).toEqual(['d']);
    g = apply(g, rules.gotIt(g, 'd'));
    expect(g.teamScores).toEqual({ red: 0, blue: 9 });
    expect(g.result.team).toBe('blue');
  });

  it('starts with the other team’s giver on odd rounds', () => {
    const g = rules.startGame({ ids: ['a', 'b', 'c', 'd'], shape: 'rivals', teams });
    expect(rules.pickGivers(g, 1, 0)).toEqual(['d', 'b']);
  });
});

describe('team pairs', () => {
  const teams = { red: ['a', 'b', 'c'], blue: ['d', 'e', 'f'] };
  it('plays both teams a round, each giving to its own guessers', () => {
    let g = dealt(rules.startGame({ ids: ['a', 'b', 'c', 'd', 'e', 'f'], shape: 'teams', teams, rounds: 2 }));
    expect(g.team).toBe('red');
    expect(g.givers).toEqual(['a', 'b']);
    g = words(g, 2);
    expect(rules.currentGuessers(g)).toEqual(['c']);
    g = apply(g, rules.gotIt(g, 'c'));
    expect(g.teamScores.red).toBe(9);
    g = apply(g, rules.nextTurn(g));
    expect(g).toMatchObject({ round: 0, turn: 1, team: 'blue', givers: ['d', 'e'], phase: 'deal' });
    g = apply(g, rules.nextTurn({ ...g, phase: 'over' }));
    // Round 2: Blue first, each team's next pair.
    expect(g).toMatchObject({ round: 1, turn: 0, team: 'blue', givers: ['f', 'd'] });
    expect(rules.turnNo(g)).toBe(2);
    g = apply(g, rules.nextTurn({ ...g, phase: 'over' }));
    g = apply(g, rules.nextTurn({ ...g, phase: 'over' }));
    expect(g.phase).toBe('finished');
  });
});

describe('online: the guess window and the judge', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const t0 = 1_000_000;
  it('holds the next word until everyone has answered or the clock runs', () => {
    let g = dealt(pairGame());
    g = apply(g, rules.addWord(g, 'a', 'ninja', { now: t0, activeIds: ids }));
    expect(rules.addWord(g, 'b', 'orange', { now: t0 + 1000, activeIds: ids }).patch).toEqual({});
    g = apply(g, rules.passWord(g, 'c', { now: t0 + 2000 }));
    g = apply(g, rules.passWord(g, 'd', { now: t0 + 2500 }));
    expect(rules.windowOpen(g, t0 + 3000, ids)).toBe(true);
    // A late joiner aside, the clock opens it too.
    const h = dealt(pairGame());
    const one = apply(h, rules.addWord(h, 'a', 'ninja', { now: t0, activeIds: ids }));
    expect(rules.windowOpen(one, t0 + rules.GUESS_MS - 1, ids)).toBe(false);
    expect(rules.windowOpen(one, t0 + rules.GUESS_MS, ids)).toBe(true);
  });

  it('takes one guess a player a word, and judges the oldest first', () => {
    let g = dealt(pairGame());
    g = apply(g, rules.addWord(g, 'a', 'ninja', { now: t0, activeIds: ids }));
    expect(rules.guess(g, 'a', 'Naruto', { now: t0 }).patch).toEqual({}); // a giver
    g = apply(g, rules.guess(g, 'd', 'Naruto', { now: t0 + 900 }));
    g = apply(g, rules.guess(g, 'c', 'Naruto Uzumaki', { now: t0 + 500 }));
    expect(rules.guess(g, 'c', 'again', { now: t0 + 600 }).patch).toEqual({});
    // A guess waiting on the judge holds the next word.
    expect(rules.windowOpen(g, t0 + 99_999, ids)).toBe(false);
    g = apply(g, rules.settleGuesses(g, (text) => /naruto/i.test(text)));
    expect(g.result).toMatchObject({ kind: 'got', by: 'c', n: 1, value: 10 });
    expect(g.guesses.map((x) => x.verdict)).toEqual(['late', 'right']);
  });

  it('marks a wrong guess and carries on', () => {
    let g = dealt(pairGame());
    g = apply(g, rules.addWord(g, 'a', 'ninja', { now: t0, activeIds: ids }));
    g = apply(g, rules.guess(g, 'c', 'Sasuke', { now: t0 }));
    g = apply(g, rules.settleGuesses(g, () => false));
    expect(g.phase).toBe('chain');
    expect(g.guesses[0].verdict).toBe('wrong');
  });

  it('closes a capped chain the way the window does', () => {
    let g = dealt(pairGame({ cap: 1 }));
    g = apply(g, rules.addWord(g, 'a', 'ninja', { now: t0, activeIds: ids }));
    expect(rules.outOfWords(g, { now: t0 + 10, activeIds: ids }).patch).toEqual({});
    g = apply(g, rules.outOfWords(g, { now: t0 + rules.GUESS_MS, activeIds: ids }));
    expect(g.result.kind).toBe('out');
  });

  it('publishes the character once the turn is over, into the log too', () => {
    let g = apply(words(dealt(pairGame()), 1), rules.bannedWord(words(dealt(pairGame()), 1), 'a'));
    const character = { key: 'naruto uzumaki', name: 'Naruto Uzumaki', series: 'Naruto', imageUrl: '' };
    expect(rules.publishReveal(g, 5, { character }).patch).toEqual({});
    g = apply(g, rules.publishReveal(g, 0, { character }));
    expect(g.reveal.character.name).toBe('Naruto Uzumaki');
    expect(g.log[0].character.name).toBe('Naruto Uzumaki');
    expect(rules.publishReveal(g, 0, { character }).patch).toEqual({});
  });
});

describe('departures', () => {
  it('voids the turn when a giver leaves, or nobody is left to guess', () => {
    const g = dealt(pairGame());
    expect(rules.settleIfComplete(g, ['a', 'b', 'c', 'd']).patch).toEqual({});
    expect(rules.settleIfComplete(g, ['a', 'c', 'd']).patch.result).toMatchObject({ kind: 'void', by: 'b' });
    const three = dealt(rules.startGame({ ids: ['a', 'b', 'c'] }));
    expect(rules.settleIfComplete(three, ['a', 'b']).patch.result.kind).toBe('void');
  });

  it('knows when a shape can no longer be played', () => {
    const teams = { red: ['a', 'b'], blue: ['c', 'd'] };
    const g = rules.startGame({ ids: ['a', 'b', 'c', 'd'], shape: 'rivals', teams });
    expect(rules.enoughPlayers(g, ['a', 'b', 'c', 'd'])).toBe(true);
    expect(rules.enoughPlayers(g, ['a', 'b', 'c'])).toBe(false);
    expect(rules.enoughPlayers(pairGame(), ['a', 'b'])).toBe(false);
  });
});

describe('normalizeGame', () => {
  it('survives what RTDB drops', () => {
    const g = rules.startGame({ ids: ['a', 'b', 'c'] });
    const stored = JSON.parse(JSON.stringify({ ...g, chain: { 0: { by: 'a', text: 'ninja' } }, guesses: undefined, log: undefined }));
    const back = rules.normalizeGame(stored);
    expect(back.chain).toEqual([{ by: 'a', text: 'ninja' }]);
    expect(back.guesses).toEqual([]);
    expect(back.log).toEqual([]);
    expect(back.teams).toBeNull();
    expect(rules.normalizeGame(g)).toEqual({ ...g, dealt: null, wordAt: null });
  });
});
