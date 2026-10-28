import { describe, it, expect, afterAll } from 'vitest';
import { device, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const HOOK = ['src/games/anichain/hooks/useChainRoom.js', 'useChainRoom'];

// Eight shows of four main characters: plenty to deal with no pack (the hook is
// mounted with none), and names with nothing banned in common with a plain
// English word.
const lists = (name) => ({
  id: name.toLowerCase(),
  name,
  animeList: Array.from({ length: 8 }, (_, i) => ({
    id: `anilist_anime_${4000 + i}`,
    title: `Smoke Show ${i}`,
    characters: Array.from({ length: 4 }, (__, j) => ({
      id: `anilist_char_${i}_${j}`,
      name: `Hero ${i} ${j}`,
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
const chainOf = (d) => d.r.game?.chain?.length ?? 0;

describe('AniChain online', () => {
  it('plays a pair game on three devices: the card, the window, the judge, the reveal', async () => {
    const devs = [mk('a'), mk('b'), mk('c')];
    await seatTable(devs, [lists('Ann'), lists('Ben'), lists('Cat')]);
    await devs[0].act((r) => r.startGame({ shape: 'pair', cap: 6, rounds: 2, pool: 'main' }));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.game?.phase === 'chain'), { what: 'dealt' });

    const [g1, g2] = devs[0].r.game.givers.map((id) => byId(devs, id));
    const guesser = devs.find((d) => d !== g1 && d !== g2);
    // The card reached both givers, the same card, and nobody else.
    await until(() => g1.r.card && g2.r.card, { what: 'both givers hold the card' });
    expect(g1.r.card.character).toEqual(g2.r.card.character);
    expect(guesser.r.card).toBeNull();
    expect(JSON.stringify(guesser.r.game)).not.toContain(g1.r.card.character.name);
    const { name } = g1.r.card.character;

    // A word from the name is refused on the giver's own device, with why.
    let refused;
    await g1.act(async (r) => { refused = await r.addWord(name.split(' ')[0]); });
    expect(refused).toMatch(/part of the name/);
    expect(chainOf(g1)).toBe(0);

    await g1.act((r) => r.addWord('ninja'));
    await until(() => devs.every((d) => chainOf(d) === 1), { what: 'first word' });
    // The window: nobody has guessed yet, so the next word waits.
    await g2.act((r) => r.addWord('orange'));
    await sleep(500);
    expect(chainOf(g1)).toBe(1);

    // A wrong guess is judged on a giver's device and marked on every phone.
    await guesser.act((r) => r.guess('Somebody Else'));
    await until(() => devs.every((d) => d.r.game.guesses[0]?.verdict === 'wrong'), { what: 'judged wrong' });
    await g2.act((r) => r.addWord('orange'));
    await until(() => devs.every((d) => chainOf(d) === 2), { what: 'second word' });

    // A right one ends the turn: 6 + 1 − 2 = 5 to the guesser, 3 to each giver.
    await guesser.act((r) => r.guess(name));
    await until(() => devs.every((d) => d.r.game.phase === 'over' && d.r.game.reveal), { what: 'got it, revealed' });
    expect(devs[0].r.game.result).toMatchObject({ kind: 'got', by: guesser.r.myPlayerId, n: 2, value: 5 });
    expect(devs[0].r.game.reveal.character.name).toBe(name);
    expect(devs[0].r.game.scores).toEqual({
      [guesser.r.myPlayerId]: 5, [g1.r.myPlayerId]: 3, [g2.r.myPlayerId]: 3,
    });

    // Round two: the guesser passes every word and the capped chain closes itself.
    await devs[2].act((r) => r.next());
    await until(() => devs.every((d) => d.r.game.round === 1 && d.r.game.phase === 'chain'), { what: 'round two' });
    const givers = devs[0].r.game.givers.map((id) => byId(devs, id));
    const watcher = devs.find((d) => !givers.includes(d));
    await until(() => givers.every((d) => d.r.card), { what: 'round two card' });
    for (let w = 0; w < 6; w++) {
      const speaker = byId(devs, devs[0].r.game.givers[w % 2]);
      await speaker.act((r) => r.addWord(['quiet', 'loud', 'storm', 'ocean', 'ghost', 'crown'][w]));
      await until(() => devs.every((d) => chainOf(d) === w + 1), { what: `word ${w + 1}` });
      await watcher.act((r) => r.pass());
      await until(() => devs.every((d) => d.r.game.guesses.length === w + 1), { what: `pass ${w + 1}` });
    }
    await until(() => devs.every((d) => d.r.game.phase === 'over'), { what: 'out of words' });
    expect(devs[0].r.game.result.kind).toBe('out');
    await devs[0].act((r) => r.next());
    await until(() => devs.every((d) => d.r.view === 'results'), { what: 'results' });
    expect(same(devs, (r) => r.game.scores)).toBe(true);
    expect(devs[0].r.game.log).toHaveLength(2);
    expect(syncErrors(devs)).toEqual([]);
  });

  it('lets only the word’s own team guess it, with rival givers', async () => {
    const devs = [mk('d'), mk('e'), mk('f'), mk('g')];
    await seatTable(devs, [lists('Dan'), lists('Eve'), lists('Fay'), lists('Gus')]);
    await devs[0].act((r) => r.startGame({ shape: 'rivals', cap: 6, rounds: 2, pool: 'main' }));
    await until(() => devs.every((d) => d.r.game?.phase === 'chain'), { what: 'dealt' });
    const { game } = devs[0].r;
    const [redGiver, blueGiver] = game.givers.map((id) => byId(devs, id));
    const red = (id) => game.teams.red.includes(id);
    const redGuesser = devs.find((d) => d !== redGiver && red(d.r.myPlayerId));
    const blueGuesser = devs.find((d) => d !== blueGiver && !red(d.r.myPlayerId));
    await until(() => redGiver.r.card, { what: 'card' });
    const { name } = redGiver.r.card.character;

    await redGiver.act((r) => r.addWord('captain'));
    await until(() => devs.every((d) => chainOf(d) === 1), { what: 'Red’s word' });
    // Blue may not guess Red's word.
    await blueGuesser.act((r) => r.guess(name));
    await sleep(500);
    expect(devs[0].r.game.guesses).toHaveLength(0);
    await redGuesser.act((r) => r.guess(name));
    await until(() => devs.every((d) => d.r.game.phase === 'over'), { what: 'Red got it' });
    expect(devs[0].r.game.teamScores).toEqual({ red: 6, blue: 0 });
    expect(syncErrors(devs)).toEqual([]);
  });

  it('voids the turn when a clue-giver closes their tab', async () => {
    const devs = [mk('h'), mk('i'), mk('j'), mk('k')];
    await seatTable(devs, [lists('Hal'), lists('Ida'), lists('Jo'), lists('Kit')]);
    await devs[0].act((r) => r.startGame({ shape: 'pair', cap: 6, rounds: 2, pool: 'main' }));
    await until(() => devs.every((d) => d.r.game?.phase === 'chain'), { what: 'dealt' });
    const second = byId(devs, devs[0].r.game.givers[1]);
    const rest = devs.filter((d) => d !== second);
    const goneId = second.r.myPlayerId;
    await second.crash();
    await sleep(GRACE_WAIT);
    await until(() => rest.every((d) => d.r.game.phase === 'over'), { what: 'voided', timeout: 15_000 });
    expect(rest[0].r.game.result).toMatchObject({ kind: 'void', by: goneId });
    // The first giver's phone still holds the card, so the table still learns who it was.
    await until(() => rest.every((d) => d.r.game.reveal), { what: 'revealed' });
    expect(syncErrors(rest)).toEqual([]);
  });
});
