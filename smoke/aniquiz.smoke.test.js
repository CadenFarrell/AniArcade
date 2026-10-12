import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import { device, profile, seatTable, until, sleep, GRACE_WAIT, syncErrors, REPO } from './harness';

const HOOK = ['src/games/aniquiz/hooks/useQuizRoom.js', 'useQuizRoom'];
const { indexPack } = await import(/* @vite-ignore */ `${REPO}/src/shared/utils/facts.js`);
// Whichever pack the manifest names, so a regeneration is tested rather than
// the file it replaced.
const readFacts = (file) => JSON.parse(fs.readFileSync(`${REPO}/public/facts/${file}`, 'utf8'));
const PACK = indexPack(readFacts(readFacts('index.json').current));

const BASE = {
  format: 'board', answerStyle: 'choice', pool: 'everything', categories: 2, quizLength: 5,
  dailyDouble: true, finalRound: true, timed: false, answerSeconds: 30,
};

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

const parse = (cell) => cell.split('-').map(Number);
function clueOf(r) {
  const { game, deal } = r;
  if (game.round === 'final') return deal.final;
  if (deal.format === 'quiz') return deal.questions[game.index];
  const [c, row] = parse(game.cell);
  return deal.categories[c].clues[row];
}
const unused = (r) => {
  for (let c = 0; c < r.deal.categories.length; c++) {
    for (let row = 0; row < 5; row++) if (!r.game.used[`${c}-${row}`]) return `${c}-${row}`;
  }
  return null;
};
const same = (devs, f) => devs.every((d) => JSON.stringify(f(d.r)) === JSON.stringify(f(devs[0].r)));

describe('AniQuiz online', () => {
  it('plays a whole board with three devices, Daily Double and final included', async () => {
    const devs = [mk('a'), mk('b'), mk('c')];
    const [A] = devs;
    await seatTable(devs, [profile('Ann'), profile('Ben'), profile('Cat')]);
    await A.act((r) => r.startGame(BASE, PACK));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.game?.phase === 'board'), { what: 'board dealt' });

    // Ann answers everything right, Ben everything wrong, Cat passes.
    const expected = { ann: 0, ben: 0, cat: 0 };
    let sawDD = false;
    let sawFinal = false;
    for (let guard = 0; guard < 80; guard++) {
      const g = A.r.game;
      if (g.phase === 'finished' || A.r.view === 'results') break;
      if (g.phase === 'board') {
        const picker = devs.find((d) => d.r.myPlayerId === g.pickerId);
        const cell = unused(picker.r);
        await picker.act((r) => r.pick(cell));
        await until(() => devs.every((d) => d.r.game.phase !== 'board' || d.r.game.used[cell]), { what: `picked ${cell}` });
        await until(() => devs.every((d) => d.r.game.phase !== 'board'), { what: 'clue open' });
      } else if (g.phase === 'wager') {
        if (g.round === 'final') sawFinal = true; else sawDD = true;
        for (const d of devs) {
          const need = g.solo ? d.r.myPlayerId === g.solo : true;
          if (need && d.r.game.wagers[d.r.myPlayerId] == null) await d.act((r) => r.wager(100));
        }
        await until(() => devs.every((d) => d.r.game.phase === 'answering'), { what: 'wagers in' });
      } else if (g.phase === 'answering') {
        const clue = clueOf(A.r);
        const wagered = g.round === 'final' || g.cell === A.r.deal.dailyDouble;
        for (const d of devs) {
          const id = d.r.myPlayerId;
          if (g.solo && g.solo !== id) continue;
          const text = id === 'ann' ? clue.answer : id === 'ben' ? 'definitely wrong' : '';
          const stake = wagered ? (A.r.game.wagers[id] ?? 0) : clue.value;
          expected[id] += id === 'ann' ? stake : (wagered ? -stake : 0);
          await d.act((r) => r.answer(text));
        }
        await until(() => devs.every((d) => d.r.game.phase === 'revealed'), { what: 'revealed' });
        expect(A.r.game.scores).toEqual(expected);
      } else if (g.phase === 'revealed') {
        // Everybody presses Next; only the first advance may land.
        const before = A.r.game.picks;
        for (const d of devs) await d.act((r) => r.next());
        await until(() => devs.every((d) => d.r.game.phase !== 'revealed'), { what: 'advanced' });
        if (A.r.game.phase === 'board') expect(A.r.game.picks).toBe(before + 1);
      }
    }
    await until(() => devs.every((d) => d.r.view === 'results'), { what: 'results' });
    expect(sawDD).toBe(true);
    expect(sawFinal).toBe(true);
    expect(Object.keys(A.r.game.used)).toHaveLength(10);
    expect(same(devs, (r) => r.game.scores)).toBe(true);
    expect(A.r.game.scores).toEqual(expected);
    expect(syncErrors(devs)).toEqual([]);
  });

  it('reveals without a player who closed their tab, and hands their pick on', async () => {
    const devs = [mk('d'), mk('e'), mk('f')];
    const [A, B, C] = devs;
    await seatTable(devs, [profile('Dan'), profile('Eve'), profile('Fay')]);
    await A.act((r) => r.startGame({ ...BASE, dailyDouble: false }, PACK));
    await until(() => devs.every((d) => d.r.game?.phase === 'board'), { what: 'board' });

    // Dan picks; Eve answers; Fay vanishes before answering.
    await A.act((r) => r.pick('0-0'));
    await until(() => devs.every((d) => d.r.game.phase === 'answering'), { what: 'open' });
    await A.act((r) => r.answer('x'));
    await B.act((r) => r.answer('x'));
    await C.crash();
    await sleep(GRACE_WAIT);
    await until(() => [A, B].every((d) => d.r.game.phase === 'revealed'), { what: 'revealed without Fay', timeout: 15_000 });

    // Next pick would be Eve's; she leaves too — the room ends rather than wedging.
    await A.act((r) => r.next());
    await until(() => A.r.game.phase === 'board' && A.r.game.pickerId === 'eve', { what: 'Eve to pick' });
    await B.crash();
    await sleep(GRACE_WAIT);
    await until(() => A.r.view === 'results', { what: 'room ends below two players', timeout: 15_000 });
    expect(syncErrors([A])).toEqual([]);
  });

  it('a timed quiz question closes itself when nobody answers', async () => {
    const devs = [mk('g'), mk('h')];
    const [A] = devs;
    await seatTable(devs, [profile('Gus'), profile('Hal')]);
    await A.act((r) => r.startGame({ ...BASE, format: 'quiz', timed: true, answerSeconds: 2 }, PACK));
    await until(() => devs.every((d) => d.r.game?.phase === 'answering' && d.r.game.deadlineAt != null), { what: 'quiz open' });
    await until(() => devs.every((d) => d.r.game.phase === 'revealed'), { what: 'expired', timeout: 10_000 });
    expect(A.r.game.answers.gus).toEqual({ text: '', correct: false, delta: 0 });
    await A.act((r) => r.next());
    await until(() => devs.every((d) => d.r.game.index === 1 && d.r.game.phase === 'answering'), { what: 'q2' });
    expect(syncErrors(devs)).toEqual([]);
  });

  it('a Daily Double whose finder leaves is voided, not stuck', async () => {
    const devs = [mk('i'), mk('j'), mk('k')];
    const [A, B] = devs;
    await seatTable(devs, [profile('Ivy'), profile('Jo'), profile('Kai')]);
    await A.act((r) => r.startGame(BASE, PACK));
    await until(() => devs.every((d) => d.r.game?.phase === 'board'), { what: 'board' });
    // Ivy plays a normal cell so the pick passes to Jo, who then finds the DD.
    const dd = A.r.deal.dailyDouble;
    const other = ['0-0', '1-0'].find((c) => c !== dd);
    await A.act((r) => r.pick(other));
    for (const d of devs) await d.act((r) => r.answer('x'));
    await until(() => devs.every((d) => d.r.game.phase === 'revealed'), { what: 'r1' });
    await A.act((r) => r.next());
    await until(() => B.r.game.phase === 'board' && B.r.game.pickerId === 'jo', { what: 'Jo picks' });
    await B.act((r) => r.pick(dd));
    await until(() => devs.every((d) => d.r.game.phase === 'wager'), { what: 'DD wager' });
    await B.crash();
    await sleep(GRACE_WAIT);
    const rest = devs.filter((d) => d !== B);
    await until(() => rest.every((d) => d.r.game.phase === 'revealed'), { what: 'DD voided', timeout: 15_000 });
    expect(A.r.game.scores.jo).toBe(0);
    expect(syncErrors(rest)).toEqual([]);
  });
});
