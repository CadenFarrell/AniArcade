import { describe, expect, it } from 'vitest';

// The end-of-game awards' house rules (shared/utils/awards.js), checked across
// the arcade from each game's own source: five good and five roasts a game, so
// the card's two-and-two always has both sides to draw from, and no title in
// two games, so an award names a moment of THAT game. Read from the text
// because a title only exists at run time once someone earns it.
const sources = import.meta.glob('../games/*/rules.js', { query: '?raw', import: 'default', eager: true });

// Every `award('Title', …)` call, and whether it carries `roast: true` before
// the next one starts.
function awardsIn(source) {
  const chunks = source.split("award('").slice(1);
  return chunks.map((chunk) => ({ title: chunk.slice(0, chunk.indexOf("'")), roast: chunk.includes('roast: true') }));
}

const games = Object.entries(sources).map(([path, source]) => ({
  game: path.split('/').at(-2),
  awards: awardsIn(source),
}));

describe('end-of-game awards', () => {
  it('finds every game', () => {
    expect(games.length).toBeGreaterThanOrEqual(13);
  });

  it.each(games)('$game has five good awards and five roasts', ({ awards }) => {
    expect(awards.filter((a) => !a.roast).map((a) => a.title)).toHaveLength(5);
    expect(awards.filter((a) => a.roast).map((a) => a.title)).toHaveLength(5);
  });

  it('never gives two games the same title', () => {
    const seen = new Map();
    for (const { game, awards } of games) {
      for (const { title } of awards) {
        expect(seen.get(title) ?? game, `"${title}" is in ${seen.get(title)} and ${game}`).toBe(game);
        seen.set(title, game);
      }
    }
  });
});
