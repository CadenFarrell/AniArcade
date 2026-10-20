// The one interaction the jsdom bots cannot perform: a real pointer drag.
// AniRank's tier board is drag-first (dnd-kit's PointerSensor, which needs an
// 8px move before it activates) with tap-to-place as the accessible twin; the
// bots play the twin everywhere else, so this checks the drag itself — tray
// card onto a row, then a row card back out again.
import { test, expect } from '@playwright/test';
import { seedContext, routeNetwork } from './harness.js';
import { FIXTURE_PROFILES } from '../core/scenarios.js';

test('AniRank tier board: drag a card into a row and back to the tray', async ({ page, context }, info) => {
  const profile = FIXTURE_PROFILES[0];
  await seedContext(context, {
    seed: 1,
    storage: {
      aniguess_profiles: { [profile.id]: profile },
      aniarcade_active_profile: profile.id,
      aniarcade_game_prefs: { anirank: { format: 'tiers', axisId: 'best', sharedOnly: true, scoring: false, blind: false } },
    },
  });
  const offsite = [];
  await routeNetwork(context, { origin: info.project.use.baseURL, offsite });
  await page.goto('/');
  await page.getByRole('button', { name: /press start/i }).click({ timeout: 5000 }).catch(() => {});
  await page.locator('button', { hasText: 'AniRank' }).first().click();
  await page.getByRole('button', { name: /play on this device/i }).click();
  await page.getByRole('button', { name: /open tier lists/i }).click();
  await page.getByRole('button', { name: /new list for/i }).first().click();
  await page.getByRole('textbox', { name: /^name$/i }).fill('Drag check');
  await page.getByRole('button', { name: /^create$/i }).click();

  await page.getByText(/0 \/ \d+ placed/i).waitFor();
  const card = page.locator('button[aria-pressed="false"][title]').first();
  const title = await card.getAttribute('title');
  // The S row's drop zone sits to the right of its label; aimed at by position
  // rather than by class, so a restyle of the board does not break the check.
  const label = page.getByText('S', { exact: true }).first();

  async function drag(from, to, dx = 0) {
    const a = await from.boundingBox();
    const t = await to.boundingBox();
    const b = { x: t.x + dx, y: t.y, width: dx ? 80 : t.width, height: t.height };
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    // Paced like a hand, not a script: dnd-kit measures the droppables when a
    // drag activates, and a drop that lands in the same frame races that.
    await page.waitForTimeout(80);
    // Many small steps: dnd-kit's collision detection runs per pointermove,
    // and a jump straight to the target never registers as "over" it.
    await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 4 });
    await page.mouse.move(b.x + Math.min(40, b.width / 2), b.y + b.height / 2, { steps: 20 });
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(150);
  }

  // A gesture gets a second try, and a miss on the first is recorded rather
  // than failed: in probing, the FIRST drag after the board mounts sometimes
  // never activated at all (no lane lit, nothing moved) while the same drag a
  // moment later worked every time — automation timing, not the board. Both
  // tries missing is a failure: then drag itself is broken.
  async function attempt(what, gesture, landed) {
    for (let i = 1; i <= 2; i++) {
      await gesture();
      if (await landed()) {
        if (i > 1) info.annotations.push({ type: 'drag-retry', description: `${what}: took a second drag` });
        return true;
      }
    }
    return false;
  }

  const lb = await label.boundingBox();
  const eject = page.getByRole('button', { name: `Return ${title} to the tray` });
  const placedNow = async () => (await eject.count()) > 0;
  expect(await attempt('tray → row S', () => drag(card, label, lb.width + 30), placedNow),
    `"${title}" should be placed in the first row after a drag`).toBe(true);

  // And back: the placed tile dropped in the middle of the tray's own lane.
  // Probed at the lane's top, middle and bottom: all three return the card.
  const placed = page.locator(`button[title="${title.replace(/"/g, '\\"')}"]`).first();
  const trayLane = page.getByText(/^Unplaced · \d+/).first()
    .locator('xpath=ancestor::*[.//input[@type="search"]][1]').locator('[class*="border-dashed"]').first();
  expect(await attempt('row S → tray', () => drag(placed, trayLane), async () => !(await placedNow())),
    'a placed card dragged onto the tray should go back to it').toBe(true);
  expect(offsite).toEqual([]);
});
