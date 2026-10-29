import { describe, it, expect, afterAll } from 'vitest';
import { device, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';
import { pickOrder } from '../src/games/anidraft/rules';

const HOOK = ['src/games/anidraft/hooks/useDraftRoom.js', 'useDraftRoom'];

// Six shows of five main characters each, per player, named after them: three
// players' lists come to 90 characters, enough for every board of a two-round
// game with nothing dealt twice.
const lists = (name) => ({
  id: name.toLowerCase(),
  name,
  animeList: Array.from({ length: 6 }, (_, i) => ({
    id: `anilist_anime_${name}_${i}`,
    title: `${name} Show ${i}`,
    characters: Array.from({ length: 5 }, (__, j) => ({
      id: `anilist_char_${name}_${i}_${j}`,
      name: `${name} Hero ${i} ${j}`,
      role: 'Main',
      gender: 'Male',
      description: '',
      favourites: 100,
      genres: ['Action'],
    })),
  })),
});

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

const same = (devs, f) => devs.every((d) => JSON.stringify(f(d.r)) === JSON.stringify(f(devs[0].r)));
const byId = (devs, id) => devs.find((d) => d.r.myPlayerId === id);
const picksOf = (d) => d.r.game?.picks?.length ?? 0;

// The picker's phone takes the first free card into its first open slot,
// and every phone sees the pick land.
async function pickOnce(devs, live = devs) {
  const g = live[0].r.game;
  const n = g.picks.length;
  const picker = byId(live, pickOrder(g.order, g.round)[n]);
  const taken = new Set(g.picks.map((p) => p.card));
  const card = g.board.find((c) => !taken.has(c.key));
  const filled = new Set(g.picks.filter((p) => p.by === picker.r.myPlayerId).map((p) => p.slot));
  const slot = [0, 1, 2, 3, 4].find((i) => !filled.has(i));
  await picker.act((r) => r.pick(card.key, slot));
  // At least: a pick that hands the turn to a departed player is followed at
  // once by the pick made for them, so exactly n + 1 may never be seen.
  await until(() => live.every((d) => picksOf(d) >= n + 1 || d.r.game.phase !== 'draft'), { what: `pick ${n + 1}` });
}

describe('AniDraft online', () => {
  it('drafts, votes and reveals on three devices, then deals a fresh board', async () => {
    const devs = [mk('a'), mk('b'), mk('c')];
    await seatTable(devs, [lists('Ann'), lists('Ben'), lists('Cat')]);
    await devs[0].act((r) => r.startGame({ rounds: 2, pool: 'main', pickClock: 0 }));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.game?.phase === 'draft'), { what: 'dealt' });
    expect(devs[0].r.game.board).toHaveLength(23);
    expect(same(devs, (r) => r.game.board)).toBe(true);

    // Only the host may reshuffle, and only before the first pick.
    const roles = devs[0].r.game.roles;
    await devs[1].act((r) => r.reshuffle());
    await sleep(300);
    expect(devs[0].r.game.roles).toEqual(roles);
    await devs[0].act((r) => r.reshuffle());
    await until(() => devs.every((d) => d.r.game.shuffles === 1), { what: 'reshuffled' });

    // Out of turn is refused: the second seat cannot take the first pick.
    const first = devs[0].r.game.order[0];
    const notFirst = devs.find((d) => d.r.myPlayerId !== first);
    await notFirst.act((r) => r.pick(devs[0].r.game.board[0].key, 0));
    await sleep(300);
    expect(picksOf(devs[0])).toBe(0);

    for (let i = 0; i < 15; i++) await pickOnce(devs);
    await until(() => devs.every((d) => d.r.game.phase === 'vote'), { what: 'vote open' });

    // A ballot for your own team is refused; then everyone votes for the next seat.
    const order = devs[0].r.game.order;
    const me0 = byId(devs, order[0]);
    await me0.act((r) => r.vote(Array(5).fill(order[0])));
    await sleep(300);
    expect(devs[0].r.game.ballots).toEqual({});
    for (const [i, id] of order.entries()) {
      const target = order[(i + 1) % order.length];
      await byId(devs, id).act((r) => r.vote(Array(5).fill(target)));
    }
    await until(() => devs.every((d) => d.r.game.phase === 'reveal'), { what: 'vote closed' });
    // One vote each, every role a three-way tie: everyone scores every role.
    expect(devs[0].r.game.scores).toEqual(Object.fromEntries(order.map((id) => [id, 5])));

    // Two phones pressing "Next role" at once turn over one role. Both presses
    // inside ONE act: two overlapping act() scopes hold React's updates.
    await devs[1].act(() => Promise.all([devs[1].r.revealNext(0), devs[2].r.revealNext(0)]));
    await until(() => devs.every((d) => d.r.game.shown === 1), { what: 'one role shown' });
    await sleep(300);
    expect(devs[0].r.game.shown).toBe(1);
    for (let i = 1; i < 5; i++) {
      await devs[i % 3].act((r) => r.revealNext(i));
      await until(() => devs.every((d) => d.r.game.shown === i + 1), { what: `role ${i + 1}` });
    }

    const firstBoard = devs[0].r.game.board.map((c) => c.key);
    await devs[0].act(() => Promise.all([devs[0].r.next(), devs[1].r.next()]));
    await until(() => devs.every((d) => d.r.game.round === 1 && d.r.game.phase === 'draft'), { what: 'round two' });
    await sleep(300);
    expect(devs[0].r.game.round).toBe(1);
    expect(devs[0].r.game.board.some((c) => firstBoard.includes(c.key))).toBe(false);
    expect(same(devs, (r) => r.game.board)).toBe(true);
    expect(syncErrors(devs)).toEqual([]);
  });

  it('picks for a picker who closed their tab, and closes the vote without them', async () => {
    const devs = [mk('d'), mk('e'), mk('f'), mk('g')];
    await seatTable(devs, [lists('Dan'), lists('Eve'), lists('Fay'), lists('Gus')]);
    await devs[0].act((r) => r.startGame({ rounds: 1, pool: 'main', pickClock: 0 }));
    await until(() => devs.every((d) => d.r.game?.phase === 'draft'), { what: 'dealt' });

    const order = devs[0].r.game.order;
    const leaver = byId(devs, order[1]);
    const rest = devs.filter((d) => d !== leaver);
    // Read before the crash: a crashed device is unmounted and has no hook value.
    const goneId = leaver.r.myPlayerId;
    await pickOnce(devs);
    await leaver.crash();
    await sleep(GRACE_WAIT);
    // The leaver's pick is made for them once their grace runs out.
    await until(() => rest.every((d) => picksOf(d) >= 2), { what: 'auto-picked', timeout: 15_000 });
    expect(rest[0].r.game.picks[1]).toMatchObject({ by: goneId, auto: true });

    // The rest of the draft: the leaver's picks keep being made for them.
    while (rest[0].r.game.phase === 'draft') {
      const g = rest[0].r.game;
      const next = pickOrder(g.order, g.round)[g.picks.length];
      if (next === goneId) {
        const n = g.picks.length;
        await until(() => rest.every((d) => picksOf(d) > n || d.r.game.phase !== 'draft'), { what: 'auto-pick', timeout: 10_000 });
      } else {
        await pickOnce(devs, rest);
      }
    }
    await until(() => rest.every((d) => d.r.game.phase === 'vote'), { what: 'vote open' });

    // Everyone here votes; the leaver's ballot is not waited for, and their team is still votable.
    for (const d of rest) await d.act((r) => r.vote(Array(5).fill(goneId)));
    await until(() => rest.every((d) => d.r.game.phase === 'reveal'), { what: 'closed without the leaver' });
    expect(rest[0].r.game.scores[goneId]).toBe(5);
    expect(syncErrors(rest)).toEqual([]);
  });
});
