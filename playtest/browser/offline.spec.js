// Offline play: the service worker (sw/serviceWorker.template.js) has to have
// stored everything local play asks for. One visit with signal, then none —
// the arcade must still open, a game must still reach its setup screen, and
// "Play online" must say why it is off instead of failing on a press.
//
// AniQuiz, because it is the game with the most to miss: its chunk and the
// fact pack are both only ever fetched on demand.
import { test, expect } from '@playwright/test';

test('the arcade opens and a game sets up with no network', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A device with no profile meets the first-visit welcome (hub/WelcomeModal),
  // which sits over the tiles. It is not what this test is about.
  await page.addInitScript(() => localStorage.setItem('aniarcade_welcome_seen', '1'));

  await page.goto('/');
  // Installed, activated and in control of this page: the cache is full.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });

  await context.setOffline(true);
  await page.reload();

  await page.getByRole('button', { name: /press start/i }).click();
  await expect(page.locator('[data-wipe]')).toHaveCount(0);
  await page.getByRole('button', { name: /AniQuiz/ }).first().click();

  const online = page.getByRole('button', { name: /play online/i });
  await expect(online).toBeDisabled();
  await expect(online).toContainText(/offline/i);

  await page.getByRole('button', { name: /play on this device/i }).click();
  await expect(page.getByRole('button', { name: /add player/i }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
