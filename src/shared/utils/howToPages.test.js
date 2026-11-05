import { describe, expect, it } from 'vitest';
import { PAGE_CHARS, howToPages } from './howToPages';
import { games } from '../../hub/registry';

const item = (n, c = 'x') => c.repeat(n);

describe('howToPages', () => {
  it('puts the goal first, then one page a section when each fits', () => {
    const pages = howToPages({
      goal: 'Win.',
      players: '2+ players',
      sections: [{ title: 'A round', items: ['a', 'b'] }, { title: 'Scoring', items: ['c'] }],
    });
    expect(pages.map((p) => p.title ?? p.goal)).toEqual(['Win.', 'A round', 'Scoring']);
    expect(pages[0].players).toBe('2+ players');
  });

  it('splits a long section into about-equal pages, in order, losing nothing', () => {
    const items = [item(150, 'a'), item(120, 'b'), item(70, 'c'), item(50, 'd'), item(55, 'e'), item(200, 'f'), item(75, 'g')];
    const pages = howToPages({ goal: 'g', sections: [{ title: 'A round', items }] }).slice(1);
    expect(pages.map((p) => p.title)).toEqual(['A round (1/2)', 'A round (2/2)']);
    expect(pages.flatMap((p) => p.items)).toEqual(items);
    const sizes = pages.map((p) => p.items.join('').length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(PAGE_CHARS);
  });

  it('never makes more pages than there are items, however long one is', () => {
    const pages = howToPages({ goal: 'g', sections: [{ title: 'Long', items: [item(PAGE_CHARS * 3)] }] });
    expect(pages).toHaveLength(2);
    expect(pages[1].title).toBe('Long');
  });

  it('gives every page of every game a distinct key and a title or goal', async () => {
    for (const game of games) {
      const { HOW_TO } = await game.howTo();
      const pages = howToPages(HOW_TO);
      expect(new Set(pages.map((p) => p.key)).size, game.id).toBe(pages.length);
      expect(pages.slice(1).every((p) => p.title && p.items.length > 0), game.id).toBe(true);
    }
  });
});
