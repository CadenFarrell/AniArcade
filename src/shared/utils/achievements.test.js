import { describe, expect, it } from 'vitest';
import {
  achievementView, applyAwards, applyGame, awardsFingerprint, emptyRecord, evaluate, milestones,
  normalizeAchievements, seedFromHistory, BIG_TABLE, GAME_WINS,
} from './achievements';
import { DUPLICATE_WINDOW_MS } from './history';

const games = [{ id: 'aniguess', title: 'AniGuess' }, { id: 'aniquiz', title: 'AniQuiz' }];
const line = (over = {}) => ({ at: 1, game: 'aniguess', won: false, place: 2, size: 2, with: ['Ayu'], ...over });

// Folds lines in and evaluates after each, the way the writes do.
function play(lines, rec = emptyRecord('Caden')) {
  let r = rec;
  const unlocked = [];
  lines.forEach((l, i) => {
    const out = evaluate(applyGame(r, l), games, l.at ?? i);
    r = out.rec;
    unlocked.push(...out.fresh);
  });
  return { rec: r, unlocked };
}

describe('milestones', () => {
  it('have unique ids, one ace per game', () => {
    const ids = milestones(games).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.startsWith('ace-'))).toEqual(['ace-aniguess', 'ace-aniquiz']);
  });

  it('unlock the first game and the first win', () => {
    expect(play([line()]).unlocked).toEqual(['played-1']);
    expect(play([line({ won: true, place: 1 })]).unlocked).toEqual(['played-1', 'won-1']);
  });

  it('count a win streak the way the record does: a table of one never breaks it', () => {
    const win = line({ won: true, place: 1 });
    const solo = line({ size: 1, with: [] });
    const { rec, unlocked } = play([win, solo, win, solo, win]);
    expect(rec.stats.bestStreak).toBe(3);
    expect(unlocked).toContain('streak-3');
    expect(play([win, line(), win, win]).rec.stats.bestStreak).toBe(2);
  });

  it('Grand tour and Grand slam need every game', () => {
    const one = play([line({ won: true })]);
    expect(one.rec.unlocked.tour).toBeUndefined();
    const both = play([line({ game: 'aniquiz', won: true })], one.rec);
    expect(both.unlocked).toEqual(expect.arrayContaining(['tour', 'slam']));
  });

  it('meets people by folded name, so one friend is one person', () => {
    const { rec } = play([line({ with: ['Ayu', 'Mia'] }), line({ with: ['ayu ', 'Rin'] })]);
    expect(rec.stats.met.sort()).toEqual(['ayu', 'mia', 'rin']);
  });

  it(`Full house is a win at a table of ${BIG_TABLE}`, () => {
    expect(play([line({ size: BIG_TABLE - 1, won: true })]).rec.unlocked['big-table']).toBeUndefined();
    expect(play([line({ size: BIG_TABLE })]).rec.unlocked['big-table']).toBeUndefined();
    expect(play([line({ size: BIG_TABLE, won: true })]).unlocked).toContain('big-table');
  });

  it(`a game's ace takes ${GAME_WINS} wins of it`, () => {
    const wins = Array.from({ length: GAME_WINS }, () => line({ game: 'aniquiz', won: true }));
    const { unlocked } = play(wins);
    expect(unlocked.filter((id) => id.startsWith('ace-'))).toEqual(['ace-aniquiz']);
    expect(unlocked).toContain('won-10');
  });

  it('never takes an unlock back', () => {
    const { rec } = play([line({ won: true })]);
    const at = rec.unlocked['won-1'];
    expect(evaluate(rec, games, 999).rec.unlocked['won-1']).toBe(at);
  });
});

describe('seedFromHistory', () => {
  it('dates each backfilled unlock by the game that earned it', () => {
    const rec = seedFromHistory([line({ at: 100 }), line({ at: 200, won: true })], 'Caden', games);
    expect(rec.stats).toMatchObject({ played: 2, won: 1 });
    expect(rec.unlocked).toMatchObject({ 'played-1': 100, 'won-1': 200 });
  });
});

describe('applyAwards', () => {
  const ann = { id: 'ann', name: 'Ann' };
  const shown = [
    { title: 'Lucky shot', player: ann, detail: 'Guessed Rem' },
    { title: 'Rage quit', player: ann, detail: 'Gave up', roast: true },
  ];

  it('tallies the shown awards and the roasts among them', () => {
    const rec = applyAwards(emptyRecord('Ann'), shown, awardsFingerprint(shown), 1000);
    expect(rec.awards).toEqual({ 'Lucky shot': 1, 'Rage quit': 1 });
    expect(rec.roasts).toBe(1);
  });

  it('skips the same card again inside the duplicate window, not after it', () => {
    const fp = awardsFingerprint(shown);
    const once = applyAwards(emptyRecord('Ann'), shown, fp, 1000);
    expect(applyAwards(once, shown, fp, 1000 + 60_000)).toBeNull();
    expect(applyAwards(once, shown, fp, 1000 + DUPLICATE_WINDOW_MS).awards['Lucky shot']).toBe(2);
  });

  it('unlocks Collector at ten different awards', () => {
    let rec = emptyRecord('Ann');
    for (let i = 0; i < 10; i++) {
      const card = [{ title: `T${i}`, player: ann, detail: '' }];
      rec = applyAwards(rec, card, awardsFingerprint(card), i);
    }
    expect(evaluate(rec, games, 5).fresh).toEqual(['collect-10']);
  });
});

describe('normalizeAchievements', () => {
  it('repairs a bad record field by field', () => {
    const out = normalizeAchievements({
      caden: { name: 'Caden', stats: { played: 3, won: -1, perGame: { x: 'no' }, met: ['ayu', 4, 'ayu'] }, awards: { A: 2, B: 'x' }, unlocked: { 'played-1': 5, bad: 'x' } },
      broken: 'nope',
    });
    expect(Object.keys(out)).toEqual(['caden']);
    expect(out.caden.stats).toMatchObject({ played: 3, won: 0, perGame: {}, met: ['ayu'] });
    expect(out.caden.awards).toEqual({ A: 2 });
    expect(out.caden.unlocked).toEqual({ 'played-1': 5 });
    expect(normalizeAchievements(null)).toEqual({});
  });
});

describe('achievementView', () => {
  it('lists every catalogue title per game with its count', () => {
    const rec = { ...emptyRecord('Ann'), awards: { Sharpest: 3 } };
    const view = achievementView(rec, [{ id: 'aniguess', title: 'AniGuess', awards: { good: ['Sharpest', 'Cold read'], roasts: ['Rage quit'] } }]);
    expect(view.collection[0].awards).toEqual([
      { title: 'Sharpest', roast: false, n: 3 },
      { title: 'Cold read', roast: false, n: 0 },
      { title: 'Rage quit', roast: true, n: 0 },
    ]);
    expect(view).toMatchObject({ collected: 1, totalAwards: 3, unlockedCount: 0 });
  });
});
