import { describe, it, expect, afterAll } from 'vitest';
import { ref, get } from 'firebase/database';
import { device, profile, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const HOOK = ['src/games/wavelength/hooks/useWavelengthRoom.js', 'useWavelengthRoom'];
const SETTINGS = { rounds: 3, timed: false, guessSeconds: 45, clueMode: 'text', cardPool: 'shows', sharedOnly: true };

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

describe('AniWave online', () => {
  it('plays a full round, survives a guest refresh, and voids on a departed psychic', async () => {
    const devs = [mk('host'), mk('b'), mk('c')];
    const [A, B, C] = devs;
    const P = [profile('Ann'), profile('Ben'), profile('Cat')];
    await seatTable(devs, P);

    // Rules sanity: a non-owner cannot read another player's secret node.
    await A.act((r) => r.startGame(SETTINGS));
    await until(() => devs.every((d) => d.r.view === 'round' && d.r.game?.phase === 'clue'), { what: 'round 1 clue phase' });
    const psy = devs.find((d) => d.r.iAmPsychic);
    const guessers = devs.filter((d) => d !== psy);
    await until(() => psy.r.myDealReady, { what: 'psychic dealt a target' });
    const peek = await get(ref(guessers[0].db, `rooms/${A.r.roomCode}/secrets/${psy.r.myPlayerId}`)).then(() => 'READ', (e) => String(e.message));
    expect(peek).toMatch(/permission/i);

    await psy.act((r) => r.submitClue({ spectrum: 'demo', text: 'smoke' }));
    await until(() => devs.every((d) => d.r.game?.phase === 'guess'), { what: 'guess phase on all devices' });

    // A guest refreshes mid-guess: must come back into the same seat.
    const g0 = guessers[0];
    await g0.reload();
    await until(() => g0.r.roomCode && g0.r.game?.phase === 'guess', { what: 'refreshed guest rejoined mid-round' });

    for (const g of guessers) await g.act((r) => r.placeDial(30));
    await until(() => devs.every((d) => d.r.game?.phase === 'reveal'), { what: 'auto reveal once all dialled' });
    await until(() => Object.keys(A.r.totalScores).length > 0, { what: 'host banked round 1' });

    // Round 2, then the psychic's tab closes mid-guess → round voids, totals kept.
    const totalsAfter1 = { ...A.r.totalScores };
    await A.act((r) => r.nextRound());
    await until(() => devs.every((d) => d.r.game?.round === 1 && d.r.game?.phase === 'clue'), { what: 'round 2 clue phase' });
    const psy2 = devs.find((d) => d.r.iAmPsychic);
    await until(() => psy2.r.myDealReady, { what: 'round 2 dealt' });
    await psy2.act((r) => r.submitClue({ spectrum: 'burn', text: 'smoke two' }));
    const watchers = devs.filter((d) => d !== psy2);
    await until(() => watchers.every((d) => d.r.game?.phase === 'guess'), { what: 'round 2 guess' });
    await psy2.crash();
    await sleep(GRACE_WAIT);
    await until(() => watchers.every((d) => d.r.game?.phase === 'reveal' && d.r.game?.abandoned), { what: 'round 2 voided after psychic left', timeout: 15_000 });
    const host = watchers.find((d) => d.r.isHost);
    expect(host, 'someone still holds the crown').toBeTruthy();
    expect(host.r.totalScores).toEqual(totalsAfter1);
    expect(syncErrors(watchers)).toEqual([]);
  });

  it('migrates the crown when the host closes the tab in the lobby', async () => {
    const devs = [mk('h2'), mk('b2'), mk('c2')];
    await seatTable(devs, [profile('Dan'), profile('Eve'), profile('Fay')]);
    const [A, B, C] = devs;
    expect(A.r.isHost).toBe(true);
    await A.crash();
    await sleep(GRACE_WAIT);
    await until(() => B.r.hostId === 'eve' && C.r.hostId === 'eve', { what: 'crown moved to Eve' });
    await B.act((r) => r.startGame(SETTINGS));
    await until(() => [B, C].every((d) => d.r.view === 'round'), { what: 'new host can start' });
    // The departed host must not be dealt the psychic role.
    expect(B.r.game.psychicId).not.toBe('dan');
  });
});
