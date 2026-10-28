import { describe, expect, it } from 'vitest';
import { dealGame, decoysFor, sharedValues, validRound } from './deal';
import { KINDS } from './connections';
import { cardPool } from './utils/pool';
import { indexPack } from '../../shared/utils/facts';

// A seeded rng, so every failure is a replay.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// One show per entry, one pictured main character each. Studios, years and
// sources cycle at different periods, so plenty of five-show groups share one
// value and differ on the others.
const STUDIOS = ['MAPPA', 'Bones', 'Madhouse', 'Kyoto Animation'];
const SOURCES = ['MANGA', 'LIGHT_NOVEL', 'ORIGINAL'];
function show(i, over = {}) {
  return {
    id: `s${i}`,
    title: `Show ${i}`,
    studio: STUDIOS[i % 4],
    seasonYear: 2010 + (i % 5),
    source: SOURCES[i % 3],
    format: 'TV',
    characters: [{
      id: `c${i}`,
      name: `Hero ${i}`,
      role: 'Main',
      gender: 'Male',
      imageUrl: `https://img.test/${i}.jpg`,
      genres: ['Action'],
      favourites: 100 + i,
    }],
    ...over,
  };
}
const profile = (name, shows) => ({ id: name.toLowerCase(), name, animeList: shows });
const bigList = (n = 40, over = () => ({})) => Array.from({ length: n }, (_, i) => show(i, over(i)));

const SETTINGS = { rounds: 8, cards: 6, reasons: true, sharedOnly: false };

// The independent check: which cards stand out on SOMETHING the rest share —
// written from the rules' text, not from deal.js, so the two can disagree. An
// unknown where the rest agree counts as standing out (it might).
function cardsOut(cards) {
  return cards.filter((c) => {
    const rest = cards.filter((x) => x !== c);
    return KINDS.some(({ id }) => {
      if (rest.some((r) => !r.vals[id])) return false;
      const keysOf = (card) => new Set(card.vals[id].map((v) => v.key));
      const shared = [...keysOf(rest[0])].filter((k) => rest.every((r) => keysOf(r).has(k)));
      return shared.some((k) => !c.vals[id] || !keysOf(c).has(k));
    });
  });
}

describe('dealGame', () => {
  it('deals the asked-for rounds, each with exactly one card out', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const players = [profile('Ada', bigList())];
      const pool = new Map(cardPool(players).map((c) => [c.key, c]));
      const { deal } = dealGame(players, SETTINGS, null, seeded(seed));
      expect(deal.sets).toHaveLength(8);
      for (const set of deal.sets) {
        expect(set.cards).toHaveLength(6);
        const out = cardsOut(set.cards.map((c) => pool.get(c.key)));
        // Exactly one stands out, ignoring what a same-show round entails.
        if (set.kind !== 'show') expect(out.map((c) => c.key)).toEqual([set.odd]);
        else expect(out.map((c) => c.key)).toContain(set.odd);
      }
    }
  });

  it('offers the true reason among distinct ones, and remembers which', () => {
    const { deal } = dealGame([profile('Ada', bigList())], SETTINGS, null, seeded(9));
    for (const set of deal.sets) {
      expect(set.reasons[set.reason]).toBe(set.sentence);
      expect(new Set(set.reasons).size).toBe(set.reasons.length);
      expect(set.reasons.length).toBeGreaterThanOrEqual(2);
      expect(set.reasons.every((r) => r.startsWith('All '))).toBe(true);
    }
  });

  it('deals no reasons with reasons off', () => {
    const { deal } = dealGame([profile('Ada', bigList())], { ...SETTINGS, reasons: false }, null, seeded(3));
    expect(deal.reasonsOn).toBe(false);
    expect(deal.sets.every((s) => s.reasons.length === 0 && s.reason === -1)).toBe(true);
  });

  it('never repeats an odd one, nor the same kind twice running', () => {
    for (const seed of [11, 12, 13]) {
      const { deal } = dealGame([profile('Ada', bigList(60))], { ...SETTINGS, rounds: 12 }, null, seeded(seed));
      const odds = deal.sets.map((s) => s.odd);
      expect(new Set(odds).size).toBe(odds.length);
      deal.sets.slice(1).forEach((s, i) => expect(s.kind).not.toBe(deal.sets[i].kind));
    }
  });

  it('draws a show-level rule’s five from five different shows', () => {
    // Two characters per show, so a lazy draw could take both.
    const shows = bigList(40).map((s, i) => ({
      ...s,
      characters: [...s.characters, { ...s.characters[0], id: `d${i}`, name: `Sidekick ${i}` }],
    }));
    const players = [profile('Ada', shows)];
    const pool = new Map(cardPool(players).map((c) => [c.key, c]));
    const { deal } = dealGame(players, SETTINGS, null, seeded(4));
    for (const set of deal.sets.filter((s) => s.kind !== 'show')) {
      const group = set.cards.filter((c) => c.key !== set.odd);
      expect(new Set(group.map((c) => pool.get(c.key).vals.show[0].key)).size).toBe(group.length);
    }
  });

  it('says how many rounds a small list holds rather than dealing short', () => {
    const res = dealGame([profile('Ada', bigList(6))], SETTINGS, null, seeded(1));
    expect(res.deal).toBeUndefined();
    expect(res.error).toMatch(/need 8/);
    expect(res.found).toBeLessThan(8);
  });

  it('only deals characters with a real portrait', () => {
    const shows = bigList(40, (i) => (i % 2 ? {} : { characters: [{ ...show(i).characters[0], imageUrl: 'https://x/default.jpg' }] }));
    const { deal, found } = dealGame([profile('Ada', shows)], { ...SETTINGS, rounds: 4 }, null, seeded(2));
    const cards = (deal?.sets ?? []).flatMap((s) => s.cards);
    expect(cards.every((c) => !c.imageUrl.endsWith('default.jpg'))).toBe(true);
    expect(deal || found >= 0).toBeTruthy();
  });

  it('fills a list’s missing studio from the fact pack', () => {
    const shows = bigList(40, () => ({ studio: undefined, seasonYear: undefined, source: undefined }));
    const players = [profile('Ada', shows)];
    expect(dealGame(players, SETTINGS, null, seeded(1)).error).toBeTruthy();
    const pack = indexPack({
      version: 5,
      shows: Object.fromEntries(shows.map((s, i) => [`show ${i}`, { studio: STUDIOS[i % 4], startYear: 2010 + (i % 5) }])),
      characters: {},
    });
    const { deal } = dealGame(players, SETTINGS, pack, seeded(1));
    expect(deal.sets.some((s) => s.kind === 'studio' || s.kind === 'year')).toBe(true);
  });

  it('with sharedOnly, deals only characters on every list', () => {
    const shared = bigList(40);
    const players = [profile('Ada', shared), profile('Bo', [...shared.slice(0, 30), ...bigList(50).slice(40)])];
    const keys = new Set(cardPool(players, { sharedOnly: true }).map((c) => c.key));
    const { deal } = dealGame(players, { ...SETTINGS, rounds: 4, sharedOnly: true }, null, seeded(6));
    for (const set of deal.sets) for (const c of set.cards) expect(keys.has(c.key)).toBe(true);
  });
});

// Hand-built cards for the three checks. `vals` defaults to all-unknown.
const card = (key, vals = {}) => ({
  key,
  vals: Object.fromEntries(KINDS.map(({ id }) => [id, vals[id] ? vals[id].map((k) => ({ key: k, label: k })) : null])),
});
const base = (key, over = {}) => card(key, {
  show: [key], studio: ['mappa'], year: ['2020'], source: ['MANGA'], genre: ['action'],
  gender: ['male'], role: ['main'], format: ['TV'], ...over,
});
const MAPPA = { kind: 'studio', key: 'mappa' };

describe('validRound', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map((k, i) => base(k, { year: [String(2010 + i)] }));

  it('accepts one outsider who differs on the rule alone', () => {
    const odd = base('z', { studio: ['bones'], year: ['2019'] });
    expect(validRound([...five, odd], 'z', MAPPA)).toBe(true);
  });

  it('refuses an odd one who is also the only woman', () => {
    const odd = base('z', { studio: ['bones'], year: ['2019'], gender: ['female'] });
    expect(validRound([...five, odd], 'z', MAPPA)).toBe(false);
  });

  it('refuses a round where a second card is out on something', () => {
    const odd = base('z', { studio: ['bones'], year: ['2019'] });
    const cards = [...five.slice(1), base('a', { year: ['2010'], gender: ['female'] }), odd];
    expect(validRound(cards, 'z', MAPPA)).toBe(false);
  });

  it('refuses an odd one whose rule value is unknown', () => {
    const odd = base('z', { studio: null, year: ['2019'] });
    expect(validRound([...five, odd], 'z', MAPPA)).toBe(false);
  });

  it('refuses a card unknown where the other five agree', () => {
    const odd = base('z', { studio: ['bones'], year: ['2019'] });
    const cards = [...five.slice(1), base('a', { year: ['2010'], gender: null }), odd];
    expect(validRound(cards, 'z', MAPPA)).toBe(false);
  });

  it('lets a same-show round differ on everything the show entails', () => {
    const naruto = ['a', 'b', 'c', 'd', 'e'].map((k) => base(k, { show: ['naruto'], studio: ['pierrot'], year: ['2002'] }));
    const odd = base('z', { show: ['bleach'], studio: ['pierrot'], year: ['2004'] });
    expect(validRound([...naruto, odd], 'z', { kind: 'show', key: 'naruto' })).toBe(true);
  });

  it('treats genres as a set: shared means held by all', () => {
    const cards = [base('a', { genre: ['action', 'drama'] }), base('b', { genre: ['action'] })];
    expect([...sharedValues('genre', cards).keys()]).toEqual(['action']);
    expect(sharedValues('genre', [...cards, base('c', { genre: null })]).size).toBe(0);
  });
});

describe('decoysFor', () => {
  it('only offers reasons at least one of the five is known to fail', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((k, i) => base(k, { year: [String(2010 + (i % 2))] }));
    const odd = base('z', { studio: ['bones'], year: ['2010'] });
    const cards = [...five, odd];
    const decoys = decoysFor(cards, odd, { ...MAPPA, label: 'MAPPA' }, seeded(1));
    expect(decoys.length).toBeGreaterThan(0);
    expect(decoys).not.toContain('All animated by MAPPA');
    // True of all five: never a decoy.
    expect(decoys).not.toContain('All adapted from manga');
    expect(decoys).not.toContain('All male characters');
  });
});
