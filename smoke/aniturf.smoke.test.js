import { describe, it, expect, afterAll } from 'vitest';
import { ref, get } from 'firebase/database';
import { device, profile, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';
import * as rules from '../src/games/aniturf/rules.js';

const HOOK = ['src/games/aniturf/hooks/useAniTurfRoom.js', 'useAniTurfRoom'];

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

const giverOf = (devs, team) => devs.find((d) => d.r.amGiver && d.r.myTeam === team);
const guesserOf = (devs, team) => devs.find((d) => !d.r.amGiver && d.r.myTeam === team);
const game = (devs) => devs[0].r.game;

// One claim, start to finish: ask, then wait for the two clue-giver devices to
// answer it and the room to see the result.
async function claim(devs, team, cell) {
  const before = game(devs).log.length;
  await guesserOf(devs, team).act((r) => r.requestClaim(cell));
  await until(() => devs.every((d) => d.r.game.log.length > before && !d.r.game.pending), { what: `claim on ${cell} resolved` });
  return game(devs).log.at(-1);
}

async function clue(devs, number = 9) {
  const team = game(devs).turn;
  await giverOf(devs, team).act((r) => r.giveClue(`zeta${game(devs).log.length}`, number));
  await until(() => devs.every((d) => d.r.game.phase === 'guess'), { what: 'guessing open' });
  return team;
}

async function startAndPlant(devs, traps, pickTraps) {
  await devs[0].act((r) => r.startGame({ sharedOnly: false, traps }));
  await until(() => devs.every((d) => d.r.view === 'play'), { what: 'play view' });
  for (const team of rules.TEAMS) {
    await until(() => Boolean(giverOf(devs, team)?.r.key), { what: `${team} key dealt` });
  }
  for (const team of rules.TEAMS) {
    const g = game(devs);
    const count = rules.trapsFor(g.traps, team, g.startTeam);
    if (count) await giverOf(devs, team).act((r) => r.plantTraps(pickTraps(team, count)));
  }
  await until(() => devs.every((d) => d.r.game.phase === 'clue'), { what: 'first clue' });
}

describe('AniTurf online', () => {
  it('keys stay with their owners; a hit, a miss and a sprung trap each resolve; a win banks', async () => {
    const devs = [mk('h'), mk('b'), mk('c'), mk('d')];
    await seatTable(devs, [profile('Ann'), profile('Ben'), profile('Cat'), profile('Dot')]);

    // Each team's traps are planted on the OTHER team's footing along that
    // team's own starting edge — so the test can spring one on purpose. The
    // test may read both keys; no device can.
    const keyOf = (team) => giverOf(devs, team).r.key.footing;
    const planted = { red: [], blue: [] };
    await startAndPlant(devs, 1, (team, count) => {
      const them = rules.other(team);
      // ONE trap on their edge footing, so they keep an untrapped edge square
      // for the hit below; the rest on squares that are not their footing.
      const edge = keyOf(them).filter((i) => rules.onEdge(them, i) && !keyOf(team).includes(i)).slice(0, 1);
      const filler = [...Array(25).keys()].filter((i) => !keyOf(them).includes(i) && !edge.includes(i));
      planted[team] = [...edge, ...filler].slice(0, count);
      return planted[team];
    });

    // Only a clue-giver can read their own key — not a teammate, not a rival.
    const redGiver = giverOf(devs, 'red');
    for (const d of devs.filter((x) => x !== redGiver)) {
      const peek = await get(ref(d.db, `rooms/${devs[0].r.roomCode}/secrets/${redGiver.r.myPlayerId}`))
        .then(() => 'READ', (e) => String(e.message));
      expect(peek, `${d.label} reading the red key`).toMatch(/permission/i);
    }
    // And no key is anywhere in the shared state.
    expect(JSON.stringify(game(devs))).not.toMatch(/footing"\s*:\s*\[/);

    // A hit: footing, on the team's edge, untrapped.
    let team = await clue(devs);
    const hitCell = keyOf(team).find((i) => rules.onEdge(team, i) && !planted[rules.other(team)].includes(i)
      && rules.canClaim(game(devs), team, i));
    expect((await claim(devs, team, hitCell)).kind).toBe('claim');
    expect(game(devs).marks[hitCell]).toBe(team);

    // A miss: an edge square that is not footing — scorched, turn over.
    const missCell = [...Array(25).keys()].find((i) => rules.canClaim(game(devs), team, i) && !keyOf(team).includes(i));
    expect((await claim(devs, team, missCell)).kind).toBe('miss');
    expect(game(devs).marks[missCell]).toBe('miss');
    expect(game(devs).turn).toBe(rules.other(team));

    // A sprung trap: the other team claims the square planted against it.
    team = await clue(devs);
    const trapCell = planted[rules.other(team)].find((i) => keyOf(team).includes(i) && rules.canClaim(game(devs), team, i));
    if (trapCell != null) {
      const ev = await claim(devs, team, trapCell);
      expect(ev.kind).toBe('trap');
      expect(game(devs).marks[trapCell]).toBe('trap');
    } else {
      // Already claimed or scorched: any claim keeps the game moving — and if
      // it lands on footing the turn goes on, so end it.
      await claim(devs, team, [...Array(25).keys()].find((i) => rules.canClaim(game(devs), team, i)));
      if (game(devs).phase === 'guess') await guesserOf(devs, team).act((r) => r.stop());
    }

    // Now play it out: each team claims footing it can reach, dodging the
    // traps it knows about (only the test knows), until somebody wins.
    for (let turn = 0; turn < 60 && game(devs).phase !== 'over'; turn++) {
      await until(() => devs.every((d) => ['clue', 'over'].includes(d.r.game.phase)), { what: 'next clue' });
      if (game(devs).phase === 'over') break;
      team = await clue(devs);
      for (let n = 0; n < 9 && game(devs).phase === 'guess' && game(devs).turn === team; n++) {
        const g = game(devs);
        const safe = keyOf(team).find((i) => rules.canClaim(g, team, i) && !planted[rules.other(team)].includes(i));
        if (safe == null && rules.canStop(g, team)) { await guesserOf(devs, team).act((r) => r.stop()); break; }
        // A clue is worth at least one claim, so a team whose only reachable
        // footing is trapped has to claim something — any square will do.
        const cell = safe ?? [...Array(25).keys()].find((i) => rules.canClaim(g, team, i));
        await claim(devs, team, cell);
      }
      if (game(devs).phase === 'guess') await guesserOf(devs, team).act((r) => r.stop());
    }
    await until(() => devs.every((d) => d.r.game.phase === 'over'), { what: 'game over' });
    const g = game(devs);
    expect(['connect', 'cut']).toContain(g.winBy);
    if (g.winBy === 'connect') expect(rules.connected(g.marks, g.winner)).toBe(true);

    await devs[1].act((r) => r.finishGame());
    await until(() => devs.every((d) => d.r.view === 'results'), { what: 'results' });
    for (const id of g.teams[g.winner]) expect(devs[0].r.totalScores[id]).toBe(1);
    expect(syncErrors(devs)).toEqual([]);

    // Back to the lobby: same sides, the crown moved on (a team of two swaps).
    await devs[0].act((r) => r.returnToLobby());
    await until(() => devs.every((d) => d.r.view === 'lobby'), { what: 'lobby again' });
    expect(devs[0].r.lobby.givers.red).not.toBe(g.clueGivers.red);
  });

  it('a clue-giver who leaves is replaced with a key that agrees with the board; a team with no guesser forfeits', async () => {
    const devs = [mk('h2'), mk('b2'), mk('c2'), mk('d2'), mk('e2')];
    await seatTable(devs, [profile('Eve'), profile('Fin'), profile('Gus'), profile('Hal'), profile('Ivy')]);
    // Seats alternate, so Red is Eve, Gus, Ivy and Blue is Fin, Hal; traps off.
    await startAndPlant(devs, 0, () => []);
    expect(game(devs).teams.red).toHaveLength(3);

    // Red claims one square of its footing, whoever's turn it is first.
    if (game(devs).turn !== 'red') {
      await clue(devs, 1);
      const blueKey = giverOf(devs, 'blue').r.key.footing;
      const cell = blueKey.find((i) => rules.canClaim(game(devs), 'blue', i));
      await claim(devs, 'blue', cell);
      await until(() => game(devs).turn === 'red' && game(devs).phase === 'clue', { what: "red's turn" });
    }
    await clue(devs, 1);
    const oldGiver = giverOf(devs, 'red');
    const redCell = oldGiver.r.key.footing.find((i) => rules.canClaim(game(devs), 'red', i));
    await claim(devs, 'red', redCell);
    expect(game(devs).marks[redCell]).toBe('red');

    // The red clue-giver closes the tab.
    const live = devs.filter((d) => d !== oldGiver);
    const oldId = oldGiver.r.myPlayerId; // a crashed device has no hook left to ask
    await oldGiver.crash();
    await sleep(GRACE_WAIT);
    await until(() => live.every((d) => d.r.game.clueGivers.red !== oldId), { what: 'crown moved', timeout: 30_000 });
    const heir = giverOf(live, 'red');
    await until(() => Boolean(heir.r.key), { what: 'heir dealt a key' });
    expect(heir.r.key.footing).toContain(redCell);
    expect(rules.routeAlive(heir.r.key.footing, game(live).marks, 'red')).toBe(true);
    expect(game(live).log.at(-1)).toMatchObject({ kind: 'migrate', team: 'red' });

    // A Blue player leaves: Blue has a clue-giver and nobody to guess.
    const blueGuesser = guesserOf(live, 'blue');
    await blueGuesser.crash();
    const rest = live.filter((d) => d !== blueGuesser);
    await sleep(GRACE_WAIT);
    await until(() => rest.every((d) => d.r.game.phase === 'over'), { what: 'forfeit', timeout: 30_000 });
    expect(game(rest)).toMatchObject({ winner: 'red', winBy: 'forfeit', loser: 'blue' });
    expect(syncErrors(rest)).toEqual([]);
  });
});
