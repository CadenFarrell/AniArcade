import { describe, it, expect, afterAll } from 'vitest';
import { ref, get, set } from 'firebase/database';
import { device, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const HOOK = ['src/games/anisketch/hooks/useSketchRoom.js', 'useSketchRoom'];
const BASE = { laps: 1, drawSeconds: 60, choices: 3, sharedFirst: true };

// The harness's profiles carry no portraits, and AniSketch offers only
// pictured characters (the reveal is the portrait). Twelve shows each, the
// same on every list.
const pictured = (name) => ({
  id: name.toLowerCase(),
  name,
  animeList: Array.from({ length: 12 }, (_, i) => ({
    id: `anilist_anime_${3000 + i}`,
    title: `Sketch Show ${i}`,
    characters: [{
      id: `anilist_char_${i}`,
      name: `Painter ${['Aoi', 'Kenji', 'Rin', 'Sora', 'Taku', 'Yui', 'Haru', 'Mio', 'Ren', 'Nao', 'Kai', 'Emi'][i]} ${i}`,
      role: 'Main',
      imageUrl: `https://s4.anilist.co/c/${i}.jpg`,
      favourites: 10,
    }],
  })),
});

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

const same = (devs, f) => devs.every((d) => JSON.stringify(f(d.r)) === JSON.stringify(f(devs[0].r)));
// The drawer's pen through the hook's own handlers, inside the device's act
// so their state updates land.
const draw = (d, pts) => d.act((r) => {
  r.sketch.begin(0, 1, pts.slice(0, 2));
  for (let i = 2; i < pts.length; i += 2) r.sketch.extend(pts.slice(i, i + 2));
  r.sketch.end();
});
// until() takes a plain predicate; a database read needs its own poll.
async function eventually(check, what, timeout = 10_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for: ${what}`);
}

describe('AniSketch online', () => {
  it('deals the drawer alone their choices, syncs the drawing, and judges typed guesses', async () => {
    const devs = [mk('a'), mk('b'), mk('c')];
    const [A, B, C] = devs;
    await seatTable(devs, [pictured('Ann'), pictured('Ben'), pictured('Cat')]);
    await A.act((r) => r.startGame(BASE));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.game?.dealt), { what: 'first offer dealt' });

    // Ann draws first. Only her phone holds the offer, and nobody else can read it.
    expect(A.r.game.drawer).toBe('ann');
    expect(A.r.choices).toHaveLength(3);
    expect(B.r.choices).toEqual([]);
    const peek = await get(ref(B.db, `rooms/${A.r.roomCode}/secrets/ann`)).then(() => 'READ', (e) => String(e.message));
    expect(peek).toMatch(/permission/i);
    expect(JSON.stringify(A.r.game)).not.toContain(A.r.choices[0].name);

    await A.act((r) => r.choose(r.choices[1].key));
    await until(() => devs.every((d) => d.r.game.phase === 'drawing'), { what: 'drawing' });
    const name = A.r.character.name;
    expect(name).toBe(A.r.choices[1].name);

    // Two strokes reach the guessers; an undo takes one back everywhere.
    await draw(A, [100, 100, 300, 200, 500, 100]);
    await draw(A, [50, 600, 900, 600]);
    await until(() => [B, C].every((d) => d.r.sketch.strokes.length === 2 && d.r.sketch.strokes[0].pts.length === 6), { what: 'strokes synced' });
    await A.act((r) => r.sketch.undo());
    await until(() => [B, C].every((d) => d.r.sketch.strokes.length === 1), { what: 'undo synced' });

    // A wrong guess, then a right first name: judged on Ann's phone, the right
    // one blanked as it is credited.
    await B.act((r) => r.guess('Nobody At All'));
    await until(() => A.r.game.guesses[0]?.verdict === 'wrong', { what: 'wrong judged' });
    await C.act((r) => r.guess(name.split(' ')[1]));
    await until(() => devs.every((d) => d.r.game.got?.cat), { what: 'Cat credited' });
    expect(A.r.game.guesses.find((g) => g.by === 'cat').text).toBe('');
    await B.act((r) => r.guess(name));
    await until(() => devs.every((d) => d.r.game.phase === 'revealed' && d.r.game.reveal), { what: 'revealed' });
    expect(B.r.game.reveal.name).toBe(name);
    expect(A.r.game.scores.ann).toBe(6);
    expect(A.r.game.scores.cat).toBeGreaterThan(0);

    // On to Ben: his phone deals, and the last turn's drawing is cleared.
    await C.act((r) => r.next());
    await until(() => devs.every((d) => d.r.game.drawer === 'ben' && d.r.game.dealt), { what: 'Ben dealt' });
    expect(B.r.choices).toHaveLength(3);
    expect(B.r.choices.map((c) => c.name)).not.toContain(name);
    await eventually(async () => !(await get(ref(A.db, `rooms/${A.r.roomCode}/sketch/${A.r.gameNo}-0`))).exists(), 'old drawing gone');
    expect(same(devs, (r) => r.game.scores)).toBe(true);
    expect(syncErrors(devs)).toEqual([]);
  });

  it('refuses a drawing write that breaks the caps, and one from outside the room', async () => {
    const devs = [mk('d'), mk('e')];
    const [D, E] = devs;
    await seatTable(devs, [pictured('Dan'), pictured('Eve')]);
    // Signed in, but never in the room.
    const outsider = await mk('x').mount();
    const base = `rooms/${D.r.roomCode}/sketch/9-0`;
    const tried = (d, path, value) => set(ref(d.db, path), value).then(() => 'OK', (e) => String(e.message));
    expect(await tried(D, `${base}/s0`, { c: 0, w: 1 })).toBe('OK');
    expect(await tried(D, `${base}/s0/p/0`, '1,2,3,4')).toBe('OK');
    expect(await tried(D, `${base}/s0/p/1`, 'x'.repeat(1201))).toMatch(/permission/i);
    expect(await tried(D, `${base}/s1`, { c: 9, w: 1 })).toMatch(/permission/i);
    expect(await tried(D, `${base}/s2`, { c: 0, w: 1, extra: true })).toMatch(/permission/i);
    expect(await tried(D, `rooms/${D.r.roomCode}/sketch/not-a-turn/s0`, { c: 0, w: 1 })).toMatch(/permission/i);
    expect(await tried(outsider, `${base}/s3`, { c: 0, w: 1 })).toMatch(/permission/i);
    const read = await get(ref(outsider.db, base)).then(() => 'READ', (e) => String(e.message));
    expect(read).toMatch(/permission/i);
    expect(syncErrors(devs)).toEqual([]);
  });

  it('voids the turn when the drawer closes their tab, and moves on', async () => {
    const devs = [mk('f'), mk('g'), mk('h')];
    const [F, G, H] = devs;
    await seatTable(devs, [pictured('Fay'), pictured('Gus'), pictured('Hal')]);
    await F.act((r) => r.startGame(BASE));
    await until(() => F.r.game?.dealt, { what: 'dealt' });
    await F.act((r) => r.choose(r.choices[0].key));
    await until(() => [G, H].every((d) => d.r.game.phase === 'drawing'), { what: 'drawing' });
    await F.crash();
    await sleep(GRACE_WAIT);
    await until(() => [G, H].every((d) => d.r.game.phase === 'revealed' && d.r.game.void), { what: 'void', timeout: 15_000 });
    expect(G.r.game.reveal).toBeNull();
    await G.act((r) => r.next());
    await until(() => [G, H].every((d) => d.r.game.drawer === 'gus' && d.r.game.dealt), { what: 'Gus draws' });
    expect(syncErrors([G, H])).toEqual([]);
  });

  it('ends the game when the room drops below two', async () => {
    const devs = [mk('i'), mk('j')];
    const [I, J] = devs;
    await seatTable(devs, [pictured('Ivy'), pictured('Jo')]);
    await I.act((r) => r.startGame(BASE));
    await until(() => devs.every((d) => d.r.game?.dealt), { what: 'dealt' });
    await J.crash();
    await sleep(GRACE_WAIT);
    await until(() => I.r.view === 'results' && I.r.game.phase === 'finished', { what: 'ended', timeout: 15_000 });
    expect(syncErrors([I])).toEqual([]);
  });
});
