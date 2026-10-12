import { describe, it, expect, afterAll } from 'vitest';
import { ref, get } from 'firebase/database';
import { device, profile, seatTable, until, sleep, GRACE_WAIT, syncErrors } from './harness';

const HOOK = ['src/games/aniguess/hooks/useRoom.js', 'useRoom'];
const SETTINGS = { sharedShowsOnly: true, twoStepRandom: false, talkMode: false, pointsPerPosition: [3, 2, 1, 0], timerEnabled: false, timerSeconds: 60 };

const all = [];
const mk = (n) => { const d = device(n, ...HOOK); all.push(d); return d; };
afterAll(() => all.forEach((d) => d.unmount()));

// OnlineGame.jsx's orchestration, replayed: propose → everyone approves →
// lockInAssignment → a non-assignee presses "start questioning".
async function assignEveryone(devs, P) {
  for (let guard = 0; guard < 12; guard++) {
    await until(() => devs.every((d) => ['assignment', 'reveal', 'game'].includes(d.r.view)), { what: 'assignment/reveal/game' });
    const v = devs[0].r.view;
    if (v === 'game') return;
    const assignee = devs.find((d) => d.r.isMyAssignmentTurn);
    const others = devs.filter((d) => d !== assignee);
    if (v === 'assignment') {
      const idx = devs[0].r.assignmentIndex;
      const char = P[0].animeList[idx].characters[0];
      await others[0].act((r) => r.proposeCharacter(char));
      await until(() => others.every((d) => d.r.currentProposal?.character), { what: 'proposal visible to non-assignees' });
      expect(assignee.r.currentProposal, 'assignee must not see their proposal').toBeNull();
      for (const d of others) await d.act((r) => r.setMyApproval(true));
      await until(() => others.every((d) => Object.keys(d.r.currentProposal?.approvals ?? {}).length === others.length), { what: 'approvals in' });
      await others[0].act((r) => r.lockInAssignment());
      await until(() => devs.every((d) => d.r.view === 'reveal'), { what: 'reveal' });
      // The assignee's own slot is unreadable from their device.
      const own = await get(ref(assignee.db, `rooms/${devs[0].r.roomCode}/assignments/${assignee.r.myPlayerId}`)).then(() => 'READ', (e) => String(e.message));
      expect(own).toMatch(/permission/i);
      await others[0].act((r) => r.handleRevealDone());
      await until(() => devs.every((d) => d.r.view !== 'reveal'), { what: 'past reveal' });
    }
  }
}

async function askOne(devs) {
  const g = devs.find((d) => d.r.isMyTurn);
  const before = devs[0].r.currentPlayerIndex;
  await g.act((r) => r.submitPendingAction('question', 'Is it a lead?'));
  const answerer = devs.find((d) => d !== g);
  await until(() => answerer.r.pendingAction?.text, { what: 'pending visible' });
  await answerer.act(async (r) => {
    const claimed = await r.resolvePendingAction();
    expect(claimed).toBeTruthy();
    await r.clearPendingAction();
    await r.handleTurnComplete({ id: `q${Date.now()}`, type: 'question', text: claimed.text, answer: 'yes' });
  });
  await until(() => devs.every((d) => d.r.currentPlayerIndex !== before), { what: 'turn moved on' });
}

describe('AniGuess online', () => {
  it('assigns secretly, takes turns, skips a departed guesser, and ends the session at one player', async () => {
    const devs = [mk('h'), mk('b'), mk('c')];
    const P = [profile('Ann'), profile('Ben'), profile('Cat')];
    await seatTable(devs, P);
    const [A] = devs;
    await A.act((r) => r.handleStartGame({ players: r.activePlayers, settings: SETTINGS }));
    await assignEveryone(devs, P);
    await until(() => devs.every((d) => d.r.view === 'game'), { what: 'game view' });

    await askOne(devs);

    // Whoever is up next closes their tab: the turn must pass without them.
    const g = devs.find((d) => d.r.isMyTurn);
    const gid = g.r.myPlayerId;
    const live = devs.filter((d) => d !== g);
    await g.crash();
    await sleep(GRACE_WAIT);
    await until(() => live.every((d) => d.r.currentGuesser && d.r.currentGuesser.id !== gid), { what: 'departed guesser skipped', timeout: 15_000 });
    await askOne(live);

    // Down to one: the session ends on the leaderboard.
    const last = live[0];
    await live[1].crash();
    await sleep(GRACE_WAIT);
    await until(() => last.r.view === 'leaderboard', { what: 'leaderboard when one player is left', timeout: 15_000 });
    expect(syncErrors([last])).toEqual([]);
  });
});
