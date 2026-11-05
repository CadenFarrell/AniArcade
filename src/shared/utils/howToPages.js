// A game's HOW_TO (its howTo.js) cut into the rules sheet's pages
// (shared/components/HowToSheet.jsx): the goal first, then one page per
// section — and a section too long for a small phone's page split across two
// or more, titled "A round (1/2)", "(2/2)". The sheet is paged precisely so
// nobody has to scroll it, and one section a page was not enough on its own:
// AniGuess's "A round" is seven bullets, which on a 360×640 phone ran past the
// panel even alone.
//
// Split by characters, not by bullet count, because the bullets differ fourfold
// in length and it is the text's height that has to fit. PAGE_CHARS was set by
// measuring every game's sheet in Chromium (2026-11): at 420 none needs its
// inner scroll at 360×640 or 390×700, and only AniGuess at 375×600, by 5px;
// at 480 four games scrolled at 375×600 for one page fewer. Every page is drawn
// as tall as the tallest, so this budget sets the whole sheet's height. The cut points
// fall at the item whose midpoint crosses each even share, so the pieces come
// out about equal rather than one full page and a stub.
export const PAGE_CHARS = 420;

export function howToPages(howTo) {
  const pages = [{ key: 'goal', goal: howTo.goal, players: howTo.players }];
  for (const section of howTo.sections) {
    const lengths = section.items.map((item) => item.length);
    const total = lengths.reduce((sum, n) => sum + n, 0);
    const count = Math.min(section.items.length, Math.max(1, Math.ceil(total / PAGE_CHARS)));
    if (count === 1) {
      pages.push({ key: section.title, title: section.title, items: section.items });
      continue;
    }
    const share = total / count;
    const chunks = Array.from({ length: count }, () => []);
    let before = 0;
    section.items.forEach((item, i) => {
      const at = Math.min(count - 1, Math.floor((before + lengths[i] / 2) / share));
      chunks[at].push(item);
      before += lengths[i];
    });
    chunks
      .filter((items) => items.length > 0)
      .forEach((items, i, kept) => {
        pages.push({
          key: `${section.title}-${i}`,
          title: `${section.title} (${i + 1}/${kept.length})`,
          items,
        });
      });
  }
  return pages;
}
