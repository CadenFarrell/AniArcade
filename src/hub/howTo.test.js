import { describe, expect, it } from 'vitest';
import { games } from './registry';

// Every game on the menu ships a rules sheet (its descriptor's `howTo`, opened
// from the top bar and on a first visit). A game added without one would open
// a sheet that never finishes loading, and nothing else would say so — the
// same reason a new game without a playtest strategy fails on purpose.
//
// The sheets interpolate their numbers from rules.js and prefs.js, so a renamed
// constant would print "undefined" into the rules a new player reads. That is
// checked here too.
describe.each(games.map((g) => [g.id, g]))('%s rules sheet', (_id, game) => {
  it('loads, with a goal and at least one section of rules', async () => {
    expect(typeof game.howTo).toBe('function');
    const { HOW_TO } = await game.howTo();
    expect(typeof HOW_TO.goal).toBe('string');
    expect(HOW_TO.goal.length).toBeGreaterThan(10);
    expect(HOW_TO.sections.length).toBeGreaterThan(0);
    for (const section of HOW_TO.sections) {
      expect(typeof section.title).toBe('string');
      expect(section.items.length, section.title).toBeGreaterThan(0);
    }
  });

  it('prints no missing value into its text', async () => {
    const { HOW_TO } = await game.howTo();
    const lines = [
      HOW_TO.goal,
      HOW_TO.players ?? '',
      ...HOW_TO.sections.flatMap((s) => [s.title, ...s.items]),
    ];
    for (const line of lines) {
      expect(typeof line).toBe('string');
      expect(line, line).not.toMatch(/undefined|NaN|null|\[object/);
    }
    // Section titles key the list on screen, so two the same would collide.
    const titles = HOW_TO.sections.map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
