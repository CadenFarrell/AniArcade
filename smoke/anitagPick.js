import { until } from './harness';

// Shared by anitag.smoke.test.js and edges.smoke.test.js. A plain module rather
// than an export from a test file, which would register that file's tests a
// second time inside whichever file imported it.

/**
 * The table picks every clause, the way OnlineGame drives it: whoever is not
 * the target proposes, everyone else not the target approves, the pick locks,
 * and the next target comes up — until the round opens.
 */
export async function pickAll(devs, round, ids = ['glasses', 'villain', 'sword', 'hat']) {
  await until(() => devs.every((d) => d.r.game?.round === round && d.r.game?.phase === 'picking'), { what: `picking r${round}` });
  for (let i = 0; i < 12; i++) {
    if (devs.every((d) => d.r.game?.phase !== 'picking')) return;
    const watcher = devs.find((d) => !d.r.iAmPickTarget && d.r.pickTarget);
    const targetId = watcher.r.pickTarget.id;
    const pickers = devs.filter((d) => d.r.myPlayerId !== targetId);
    await pickers[0].act((r) => r.proposeCategory(ids[i % ids.length]));
    await until(() => pickers.every((d) => d.r.proposal), { what: `proposal for ${targetId} visible` });
    for (const d of pickers.slice(1)) await d.act((r) => r.approveProposal(true));
    await until(
      () => devs.every((d) => d.r.game?.phase !== 'picking' || d.r.pickTarget?.id !== targetId),
      { what: `pick locked for ${targetId}` },
    );
  }
}
