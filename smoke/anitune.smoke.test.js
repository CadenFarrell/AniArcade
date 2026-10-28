import { describe, it, expect, afterAll } from 'vitest';
import { device, profile, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const HOOK = ['src/games/anitune/hooks/useAniTuneRoom.js', 'useAniTuneRoom'];
const QUESTIONS = ['Smoke Show A', 'Smoke Show B', 'Smoke Show C'].map((t, i) => ({
  id: `q${i}`, animeTitle: t, displayTitle: t, audioUrl: `https://example.invalid/${i}.ogg`,
  themeType: 'OP', themeLabel: 'OP1', songTitle: `Song ${i}`, artists: [], clipFraction: 0.3,
}));
// The real prepareQuestions talks to AnimeThemes; the room logic is what's under test.
let hang = false;
const mocks = {
  'src/games/anitune/services/buildQuestions.js': () => ({
    prepareQuestions: () => (hang ? new Promise(() => {}) : Promise.resolve({ round: QUESTIONS, unresolved: [], themeless: [] })),
  }),
};
const BASE = {
  roundSize: 3, clipSeconds: 10, timed: false, guessSeconds: 20, answerSeconds: 10, startingLives: 3,
  playbackRate: 1, samplePoint: 'middle', sharedSongsOnly: true, includeOpenings: true, includeEndings: true,
  popularity: 'any', yearFrom: 1960, yearTo: 2030, maxPerAnime: 2,
};

const all = [];
const mk = (n) => { const d = device(n, ...HOOK, { extraMocks: mocks }); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));
const q = (r) => r.round?.[r.game?.index ?? 0];

async function startClip(devs) {
  for (const d of devs) await d.act((r) => r.markReady());
  await until(() => devs.every((d) => d.r.allReady), { what: 'all ready' });
  await devs[0].act((r) => r.setClipStart());
  await until(() => devs.every((d) => d.r.game?.clipStartAt != null), { what: 'clip start stamped' });
}

describe('AniTune online', () => {
  it('simultaneous: reveals once everyone still here answers, even after a departure', async () => {
    const devs = [mk('h'), mk('b'), mk('c')];
    const [A] = devs;
    await seatTable(devs, [profile('Ann'), profile('Ben'), profile('Cat')]);
    await A.act((r) => r.startGame({ ...BASE, mode: 'simultaneous' }));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.round?.length === 3), { what: 'round dealt' });
    await startClip(devs);
    for (const d of devs) await d.act((r) => r.submitAnswer(q(r), 'Smoke Show A'));
    await until(() => devs.every((d) => d.r.game.phase === 'revealed'), { what: 'q1 revealed' });
    await A.act((r) => r.advance());
    await until(() => devs.every((d) => d.r.game.index === 1), { what: 'q2' });

    // Cat closes the tab before answering q2; the other two answer.
    const [, B, C] = devs;
    await startClip(devs);
    await C.crash();
    for (const d of [A, B]) await d.act((r) => r.submitAnswer(q(r), 'wrong'));
    await sleep(GRACE_WAIT);
    await until(() => [A, B].every((d) => d.r.game.phase === 'revealed'), { what: 'q2 revealed without Cat', timeout: 15_000 });
    // The song log survives the database: q2's line, which nobody got, comes
    // back with no `got` at all (an empty object is not stored) and is repaired.
    expect(A.r.game.log.map((l) => l.i)).toEqual([0, 1]);
    expect(A.r.game.log[1].got).toEqual({});
    expect(Object.keys(A.r.game.log[0].got).length).toBeGreaterThan(0);
    expect(syncErrors([A, B])).toEqual([]);
  });

  it('race: a buzzer who walks away hands the question back', async () => {
    const devs = [mk('h2'), mk('b2'), mk('c2')];
    const [A, B] = devs;
    await seatTable(devs, [profile('Dan'), profile('Eve'), profile('Fay')]);
    await A.act((r) => r.startGame({ ...BASE, mode: 'race' }));
    await until(() => devs.every((d) => d.r.view === 'round'), { what: 'round' });
    await startClip(devs);
    await B.act((r) => r.buzz());
    await until(() => devs.every((d) => d.r.game.phase === 'buzzed'), { what: 'buzzed' });
    await B.crash();
    await sleep(GRACE_WAIT);
    const rest = devs.filter((d) => d !== B);
    await until(() => rest.every((d) => d.r.game.phase === 'listening' && d.r.game.buzzedBy == null), { what: 'buzz released', timeout: 15_000 });
    await A.act((r) => r.buzz());
    await until(() => A.r.isMyBuzz, { what: 'A holds the buzz' });
    await A.act((r) => r.resolveBuzz(q(r), 'Smoke Show A'));
    await until(() => rest.every((d) => d.r.game.phase === 'revealed'), { what: 'revealed after a correct buzz' });
    expect(syncErrors(rest)).toEqual([]);
  });

  it('a host who vanishes while finding songs does not strand the room', async () => {
    hang = true;
    const devs = [mk('h3'), mk('b3'), mk('c3')];
    const [A, B, C] = devs;
    await seatTable(devs, [profile('Gil'), profile('Hana'), profile('Ivo')]);
    // Not inside act(): a scope that never resolves would hold every React update in the process.
    A.r.startGame({ ...BASE, mode: 'race' });
    await until(() => [B, C].every((d) => d.r.view === 'preparing'), { what: 'preparing' });
    await A.crash();
    await sleep(GRACE_WAIT);
    await until(() => [B, C].every((d) => d.r.view === 'lobby'), { what: 'back in the lobby under the new host', timeout: 15_000 });
    hang = false;
  });
});
