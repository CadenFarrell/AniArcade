// Second wave: the cases CLAUDE.md records as having broken before — second
// rounds (round-keyed one-shots), timed reveals, AniWave's card modes, and a
// player coming back after the grace window.
import { describe, it, expect, afterAll } from 'vitest';
import { device, profile, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const all = [];
const mkFor = (hook) => (n) => { const d = device(n, ...hook); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

const WAVE = mkFor(['src/games/wavelength/hooks/useWavelengthRoom.js', 'useWavelengthRoom']);
const TAG = mkFor(['src/games/categories/hooks/useCategoriesRoom.js', 'useCategoriesRoom']);
const FAKE = mkFor(['src/games/anifake/hooks/useAniFakeRoom.js', 'useAniFakeRoom']);

const waveSettings = (o) => ({ rounds: 4, timed: false, guessSeconds: 45, clueMode: 'text', cardPool: 'characters', sharedOnly: true, ...o });

describe('AniWave edges', () => {
  it('timed: reveals after deadline + grace with a guesser who never dialled, and scores only placed dials', async () => {
    const devs = [WAVE('t1'), WAVE('t2'), WAVE('t3'), WAVE('t4')];
    await seatTable(devs, [profile('Ann'), profile('Ben'), profile('Cat'), profile('Dot')]);
    await devs[0].act((r) => r.startGame(waveSettings({ timed: true, guessSeconds: 4 })));
    await until(() => devs.every((d) => d.r.game?.phase === 'clue'), { what: 'clue' });
    const psy = devs.find((d) => d.r.iAmPsychic);
    await until(() => psy.r.myDealReady, { what: 'dealt' });
    await psy.act((r) => r.submitClue({ spectrum: 'demo', text: 'hot' }));
    await until(() => devs.every((d) => d.r.game?.phase === 'guess' && Number.isFinite(d.r.game?.deadline)), { what: 'guess with deadline' });
    const [g1, g2] = devs.filter((d) => d !== psy);
    await g1.act((r) => r.placeDial(50));
    await g2.act((r) => r.placeDial(10));
    // The third guesser never dials. The psychic's device must reveal on the clock.
    await until(() => devs.every((d) => d.r.game?.phase === 'reveal'), { what: 'timed reveal', timeout: 15_000 });
    expect(devs[0].r.game.abandoned).toBeFalsy();
    expect(Object.keys(devs[0].r.game.dials)).toHaveLength(2);
    await until(() => Object.keys(devs[0].r.totalScores).length > 0, { what: 'banked' });
  });

  it('readroom: deals the psychic one card, takes their own dial as the target; cards mode searches; round 2 re-deals', async () => {
    const devs = [WAVE('r1'), WAVE('r2'), WAVE('r3')];
    await seatTable(devs, [profile('Eve'), profile('Fin'), profile('Gus')]);
    await devs[0].act((r) => r.startGame(waveSettings({ clueMode: 'readroom' })));
    await until(() => devs.every((d) => d.r.game?.phase === 'clue'), { what: 'clue' });
    let psy = devs.find((d) => d.r.iAmPsychic);
    await until(() => psy.r.myDealReady && psy.r.myHand.length === 1, { what: 'readroom hand of one' });
    for (const d of devs.filter((x) => x !== psy)) expect(d.r.myHand).toEqual([]);
    const card = psy.r.myHand[0];
    await psy.act((r) => r.submitClue({ spectrum: 'filler', card, placement: 77 }));
    await until(() => devs.every((d) => d.r.game?.phase === 'guess' && d.r.card?.id === card.id), { what: 'guess with card' });
    for (const d of devs.filter((x) => x !== psy)) await d.act((r) => r.placeDial(70));
    await until(() => devs.every((d) => d.r.game?.phase === 'reveal'), { what: 'reveal' });
    expect(devs[0].r.revealedTarget).toBe(77);

    // Round 2: the one-shot keyed on the round must deal again.
    await devs[0].act((r) => r.nextRound());
    await until(() => devs.every((d) => d.r.game?.round === 1 && d.r.game?.phase === 'clue'), { what: 'round 2' });
    psy = devs.find((d) => d.r.iAmPsychic);
    await until(() => psy.r.myDealReady && psy.r.myHand.length === 1, { what: 'round 2 dealt', timeout: 10_000 });
    expect(psy.r.myHand[0].id, 'played card excluded from the next deal').not.toBe(card.id);
    expect(syncErrors(devs)).toEqual([]);
  });

  it('cards mode: psychic searches the pool, guessers get no pool', async () => {
    const devs = [WAVE('c1'), WAVE('c2'), WAVE('c3')];
    await seatTable(devs, [profile('Hal'), profile('Ivy'), profile('Jo')]);
    await devs[0].act((r) => r.startGame(waveSettings({ clueMode: 'cards', cardPool: 'shows' })));
    await until(() => devs.every((d) => d.r.game?.phase === 'clue'), { what: 'clue' });
    const psy = devs.find((d) => d.r.iAmPsychic);
    await until(() => psy.r.myDealReady, { what: 'target drawn' });
    expect(psy.r.searchCards.length).toBeGreaterThan(5);
    for (const d of devs.filter((x) => x !== psy)) expect(d.r.searchCards).toEqual([]);
    expect(psy.r.myHand).toEqual([]);
    await psy.act((r) => r.submitClue({ spectrum: 'demo', card: r.searchCards[0] }));
    await until(() => devs.every((d) => d.r.game?.phase === 'guess'), { what: 'guess' });
  });

  it('a guesser who drops past the grace window and comes back is counted again', async () => {
    const devs = [WAVE('v1'), WAVE('v2'), WAVE('v3'), WAVE('v4')];
    await seatTable(devs, [profile('Kai'), profile('Lu'), profile('Mo'), profile('Ned')]);
    await devs[0].act((r) => r.startGame(waveSettings()));
    await until(() => devs.every((d) => d.r.game?.phase === 'clue'), { what: 'clue' });
    const psy = devs.find((d) => d.r.iAmPsychic);
    const away = devs.find((d) => d !== psy && !d.r.isHost);
    const awayId = away.r.myPlayerId;
    await away.crash();
    await sleep(GRACE_WAIT);
    await until(() => devs[0].r.departedIds.includes(awayId), { what: 'marked gone' });
    await away.revive();
    await until(() => away.r.roomCode && away.r.game?.phase === 'clue', { what: 'back in the room' });
    await until(() => devs[0].r.departedIds.length === 0, { what: 'counted active again' });
    await until(() => psy.r.myDealReady, { what: 'dealt' });
    await psy.act((r) => r.submitClue({ spectrum: 'demo', text: 'x' }));
    await until(() => devs.every((d) => d.r.game?.phase === 'guess'), { what: 'guess' });
    const others = devs.filter((d) => d !== psy && d !== away);
    for (const d of others) await d.act((r) => r.placeDial(40));
    await sleep(1500);
    expect(devs[0].r.game.phase, 'must still wait for the returned guesser').toBe('guess');
    await away.act((r) => r.placeDial(60));
    await until(() => devs.every((d) => d.r.game?.phase === 'reveal'), { what: 'reveal' });
  });
});

describe('AniTag edges', () => {
  for (const categoryMode of ['chosen', 'dealt']) {
    it(`${categoryMode}: a full round ends, banks, and round 2 opens and deals`, async () => {
      const devs = [TAG(`${categoryMode}1`), TAG(`${categoryMode}2`), TAG(`${categoryMode}3`)];
      await seatTable(devs, [profile('Oz'), profile('Pip'), profile('Quin')]);
      await devs[0].act((r) => r.startGame({ rounds: 2, proposalCap: 3, categoryPool: 'characters', useCustom: true, categoryMode }));
      const pickAll = async (round) => {
        if (categoryMode !== 'chosen') return;
        await until(() => devs.every((d) => d.r.game?.round === round && d.r.game?.phase === 'picking'), { what: `picking r${round}` });
        const ids = ['glasses', 'villain', 'sword'];
        for (let i = 0; i < devs.length; i++) await devs[i].act((r) => r.pickCategory(ids[i]));
      };
      const playRound = async (round) => {
        await pickAll(round);
        await until(() => devs.every((d) => d.r.game?.round === round && d.r.dealReady && ['naming', 'judging'].includes(d.r.game?.phase)), { what: `naming r${round}`, timeout: 15_000 });
        // Everyone passes their go — cheapest route to roundEnd.
        for (let guard = 0; guard < 40 && !devs.every((d) => d.r.game?.phase === 'roundEnd'); guard++) {
          const ph = devs[0].r.game?.phase;
          if (ph === 'judging') {
            for (const d of devs.filter((x) => x.r.iMustRule)) await d.act((r) => r.rule(false));
          } else if (ph === 'naming') {
            const seat = devs.find((d) => d.r.iAmSeat);
            if (seat) await seat.act((r) => r.pass());
          } else if (ph === 'turnEnd') {
            await devs[0].act((r) => r.nextTurn());
          }
          await sleep(250);
        }
        await until(() => devs.every((d) => d.r.game?.phase === 'roundEnd'), { what: `roundEnd r${round}` });
      };
      await playRound(0);
      await until(() => devs[0].r.state?.bankedRound === 0, { what: 'banked r0' });
      await devs[0].act((r) => r.nextRound());
      await playRound(1);
      await until(() => devs[0].r.state?.bankedRound === 1, { what: 'banked r1' });
      expect(syncErrors(devs)).toEqual([]);
    });
  }
});

describe('AniFake edges', () => {
  it('round 2 in the same room deals fresh cards and banks again', async () => {
    const devs = [FAKE('f1'), FAKE('f2'), FAKE('f3')];
    await seatTable(devs, [profile('Rae'), profile('Sol'), profile('Tam')]);
    const settings = { mode: 'decoy', laps: 1, sharedOnly: true, talkMode: false, fame: 'any', allowRedeal: false };
    const play = async () => {
      await until(() => devs.every((d) => d.r.view === 'clues' && d.r.card), { what: 'clues with cards' });
      for (let i = 0; i < 12 && !devs.every((d) => d.r.view === 'vote'); i++) {
        const sp = devs.find((d) => d.r.isMyTurn);
        if (sp) await sp.act((r) => r.submitClue(`w${i}`));
        await sleep(250);
      }
      await until(() => devs.every((d) => d.r.view === 'vote'), { what: 'vote' });
      for (const d of devs) await d.act((r) => r.castVote(devs.find((x) => x !== d).r.myPlayerId));
      for (let i = 0; i < 40 && !devs.every((d) => d.r.view === 'results'); i++) {
        if (devs.some((d) => d.r.view === 'vote' && d.r.isRunoff && !d.r.myVote)) {
          for (const d of devs.filter((x) => !x.r.myVote)) await d.act((r) => r.castVote(r.runoffCandidates.find((c) => c !== r.myPlayerId) ?? r.runoffCandidates[0]));
        }
        const st = devs.find((d) => d.r.view === 'steal' && d.r.card?.isFake);
        if (st) await st.act((r) => r.submitSteal('x'));
        await sleep(250);
      }
      await until(() => devs.every((d) => d.r.view === 'results'), { what: 'results' });
    };
    await devs[0].act((r) => r.startGame(settings));
    await play();
    const t1 = { ...devs[0].r.totalScores };
    await devs[0].act((r) => r.returnToLobby());
    await until(() => devs.every((d) => d.r.view === 'lobby'), { what: 'lobby' });
    await devs[0].act((r) => r.startGame(settings));
    await play();
    const sum = (t) => Object.values(t).reduce((s, v) => s + v, 0);
    expect(sum(devs[0].r.totalScores)).toBeGreaterThanOrEqual(sum(t1));
    for (const d of devs) expect(d.r.fakeId).toBeTruthy();
    expect(syncErrors(devs)).toEqual([]);
  });
});
