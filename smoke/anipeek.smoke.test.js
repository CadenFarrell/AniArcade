import { describe, it, expect, afterAll } from 'vitest';
import { device, profile, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const HOOK = ['src/games/anipeek/hooks/usePeekRoom.js', 'usePeekRoom'];
const BASE = { rounds: 4, answerStyle: 'choice', hints: true, sharedOnly: false };

// The harness's profiles carry no portraits, and AniPeek deals only
// characters that have one.
const pictured = (name) => {
  const p = profile(name);
  return {
    ...p,
    animeList: p.animeList.map((a) => ({
      ...a,
      studio: 'Smoke Studio',
      characters: a.characters.map((c) => ({ ...c, imageUrl: `https://s4.anilist.co/c/${c.id}.jpg` })),
    })),
  };
};

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

const same = (devs, f) => devs.every((d) => JSON.stringify(f(d.r)) === JSON.stringify(f(devs[0].r)));
const byId = (devs, id) => devs.find((d) => d.r.myPlayerId === id);
const card = (r) => r.deal.cards[r.game.cardIndex];

describe('AniPeek online', () => {
  it('plays a whole game on three devices, every move agreed', async () => {
    const devs = [mk('a'), mk('b'), mk('c')];
    const [A] = devs;
    await seatTable(devs, [pictured('Ann'), pictured('Ben'), pictured('Cat')]);
    await A.act((r) => r.startGame(BASE, null));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.game?.phase === 'bidding'), { what: 'dealt' });
    // Nothing secret in this game, but the deal must be the same everywhere.
    expect(same(devs, (r) => r.deal)).toBe(true);

    // Each round: the opener bids 6, the next player undercuts to 5, the third
    // passes, the opener passes. Ann names hers right; Ben and Cat miss.
    const expected = { ann: 0, ben: 0, cat: 0 };
    for (let guard = 0; guard < 120; guard++) {
      const g = A.r.game;
      if (g.phase === 'finished' || A.r.view === 'results') break;
      if (g.phase === 'bidding') {
        const turn = byId(devs, g.turnId);
        const before = JSON.stringify([g.bid, g.passed]);
        if (!g.bid) await turn.act((r) => r.bid(null, 6));
        else if (g.bid.n === 6) await turn.act((r) => r.bid(null, 5));
        else await turn.act((r) => r.pass());
        await until(() => devs.every((d) => JSON.stringify([d.r.game.bid, d.r.game.passed]) !== before || d.r.game.phase !== 'bidding'), { what: 'bid landed' });
      } else if (g.phase === 'peeking') {
        const bidder = byId(devs, g.bid.by);
        // A hint, then a tile, then name them with budget to spare.
        await bidder.act((r) => r.hint(null, 'studio'));
        await until(() => devs.every((d) => d.r.game.hintsTaken.includes('studio')), { what: 'hint bought' });
        await bidder.act((r) => r.uncover(null, 5));
        await until(() => devs.every((d) => d.r.game.uncovered.includes(5)), { what: 'tile open' });
        await bidder.act((r) => r.nameNow());
        await until(() => devs.every((d) => d.r.game.phase === 'answering'), { what: 'answering' });
      } else if (g.phase === 'answering') {
        const by = g.bid.by;
        const right = by === 'ann';
        const text = right ? card(A.r).name : 'definitely wrong';
        if (right) expected.ann += 16 - g.bid.n;
        else for (const id of Object.keys(expected)) if (id !== by) expected[id] += 3;
        await byId(devs, by).act((r) => r.answer(null, text));
        await until(() => devs.every((d) => d.r.game.phase === 'revealed'), { what: 'revealed' });
        expect(A.r.game.scores).toEqual(expected);
      } else if (g.phase === 'revealed') {
        // Everybody presses Next; only the first may land.
        const round = g.round;
        for (const d of devs) await d.act((r) => r.next());
        await until(() => devs.every((d) => d.r.game.phase !== 'revealed'), { what: 'advanced' });
        if (A.r.game.phase === 'bidding') expect(A.r.game.round).toBe(round + 1);
      }
    }
    await until(() => devs.every((d) => d.r.view === 'results'), { what: 'results' });
    expect(same(devs, (r) => r.game.scores)).toBe(true);
    expect(A.r.game.scores).toEqual(expected);
    expect(syncErrors(devs)).toEqual([]);
  });

  it('passes for a bidder who closed their tab, so the bidding still closes', async () => {
    const devs = [mk('d'), mk('e'), mk('f')];
    const [A, B, C] = devs;
    await seatTable(devs, [pictured('Dan'), pictured('Eve'), pictured('Fay')]);
    await A.act((r) => r.startGame(BASE, null));
    await until(() => devs.every((d) => d.r.game?.phase === 'bidding'), { what: 'dealt' });

    await A.act((r) => r.bid(null, 8));
    await until(() => devs.every((d) => d.r.game.turnId === 'eve'), { what: "Eve's turn" });
    await B.crash();
    await sleep(GRACE_WAIT);
    await until(() => [A, C].every((d) => d.r.game.turnId === 'fay' && d.r.game.passed.eve), { what: 'Eve passed for', timeout: 15_000 });
    await C.act((r) => r.pass());
    await until(() => [A, C].every((d) => d.r.game.phase === 'peeking' && d.r.game.bid.by === 'dan'), { what: 'Dan peeks' });
    expect(syncErrors([A, C])).toEqual([]);
  });

  it('voids the round when the winning bidder leaves mid-peek', async () => {
    const devs = [mk('g'), mk('h'), mk('i')];
    const [A, B, C] = devs;
    await seatTable(devs, [pictured('Gus'), pictured('Hal'), pictured('Ivy')]);
    await A.act((r) => r.startGame(BASE, null));
    await until(() => devs.every((d) => d.r.game?.phase === 'bidding'), { what: 'dealt' });

    // Gus wins the bid with a 1 — nobody can go lower — and then vanishes.
    await A.act((r) => r.bid(null, 1));
    await until(() => devs.every((d) => d.r.game.phase === 'peeking'), { what: 'Gus peeks' });
    await A.crash();
    await sleep(GRACE_WAIT);
    await until(() => [B, C].every((d) => d.r.game.phase === 'revealed'), { what: 'voided', timeout: 15_000 });
    expect(B.r.game.result).toMatchObject({ by: 'gus', void: 'left', points: 0 });
    expect(B.r.game.scores).toEqual({ gus: 0, hal: 0, ivy: 0 });

    // The game goes on without him: round two opens with Hal.
    await B.act((r) => r.next());
    await until(() => [B, C].every((d) => d.r.game.round === 1 && d.r.game.turnId === 'hal'), { what: 'round two' });
    expect(syncErrors([B, C])).toEqual([]);
  });
});
