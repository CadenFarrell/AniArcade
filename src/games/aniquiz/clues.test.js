import { describe, it, expect } from 'vitest';
import { indexPack } from '../../shared/utils/facts';
import {
  BOARD_VALUES, CHOICES, ROWS, buildContext, candidatesFor, dealBoard, dealQuiz, domainValues,
  foldAnswer, isCorrect, normalizeClue, parseCell, poolSummary, TOPICS, withChoices,
} from './clues';

// Deterministic, so a failure reproduces.
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STUDIOS = ['Bones', 'MAPPA', 'Kyoto Animation', 'Madhouse', 'WIT STUDIO', 'Production I.G'];
const SOURCES = ['MANGA', 'LIGHT_NOVEL', 'ORIGINAL', 'VISUAL_NOVEL'];
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

// Twenty shows, three main characters each, every field filled — enough for a
// six-column board with honest distractors in every domain.
function makePack({ shows = 20 } = {}) {
  const pack = { version: 2, shows: {}, characters: {} };
  for (let i = 0; i < shows; i++) {
    const key = `show ${i}`;
    pack.shows[key] = {
      title: `Show ${i}`,
      studio: STUDIOS[i % STUDIOS.length],
      director: `Director ${i}`,
      seriesComposition: `Writer ${i}`,
      originalCreator: `Creator ${i}`,
      composer: `Composer ${i}`,
      source: SOURCES[i % SOURCES.length],
      format: 'TV',
      season: SEASONS[i % 4],
      seasonYear: 2000 + i,
      episodes: 12 + (i % 3),
      genres: ['Action'],
      popularityRank: i + 1,
    };
    for (let c = 0; c < 3; c++) {
      pack.characters[`hero ${i} ${c}`] = {
        name: `Hero ${i} ${c}`,
        voiceActorJp: `Actor ${i} ${c}`,
        favourites: 1000 - i * 10 - c,
        appearsIn: [key],
      };
    }
  }
  return pack;
}

const index = indexPack(makePack());
const allKeys = [...index.shows.keys()];

describe('folding', () => {
  it('ignores case, accents, punctuation and name order for people', () => {
    expect(foldAnswer('name', 'Makoto Shinkai')).toBe(foldAnswer('name', 'shinkai, MAKOTO'));
    expect(foldAnswer('name', 'Ōkubo Rumi')).toBe(foldAnswer('name', 'rumi okubo'));
  });

  it('reads a number out of whatever was typed around it', () => {
    expect(foldAnswer('number', ' 2016 ')).toBe('2016');
    expect(foldAnswer('number', '24 episodes')).toBe('24');
    expect(foldAnswer('number', 'none')).toBe('');
  });

  it('folds shows the way a saved profile keys them', () => {
    expect(foldAnswer('show', 'Show 3 Season 2')).toBe('show 3');
  });
});

describe('clues', () => {
  const ctx = buildContext(index, allKeys);
  const byField = (field) => TOPICS.flatMap((t) => candidatesFor(ctx, t)).filter((c) => c.field === field);

  it('grades a forward clue on its one answer', () => {
    const clue = byField('studio').find((c) => c.subject === 'show 1');
    expect(clue.answer).toBe('MAPPA');
    expect(isCorrect(clue, 'mappa')).toBe(true);
    expect(isCorrect(clue, 'Bones')).toBe(false);
    expect(isCorrect(clue, '')).toBe(false);
  });

  it('accepts every show in the whole pack that fits a reverse clue', () => {
    // A second Bones show from 2000, which is NOT in play.
    const raw = makePack();
    raw.shows['outsider'] = { title: 'Outsider', studio: 'Bones', seasonYear: 2000, format: 'TV' };
    const ix = indexPack(raw);
    const c = buildContext(ix, ['show 0']);
    const clue = candidatesFor(c, TOPICS.find((t) => t.id === 'studios')).find((x) => x.field === 'studioYear');
    expect(clue.answer).toBe('Show 0');
    expect(isCorrect(clue, 'Show 0')).toBe(true);
    expect(isCorrect(clue, 'Outsider')).toBe(true);
    expect(clue.alsoAccepted).toEqual(['Outsider']);
    expect(isCorrect(clue, 'Show 6')).toBe(false); // Bones too, but 2006
  });

  it('only asks about shows in play, and characters from them', () => {
    const c = buildContext(index, ['show 2', 'show 5']);
    const subjects = new Set(TOPICS.flatMap((t) => candidatesFor(c, t)).map((x) => x.subject));
    for (const s of subjects) expect(s).toMatch(/^(show [25]|hero [25] \d)$/);
  });

  it('ignores keys the pack does not know', () => {
    expect(buildContext(index, ['not a real show']).shows).toEqual([]);
  });

  it('prices an obscure subject above a famous one in the same field', () => {
    const famous = byField('director').find((c) => c.subject === 'show 0');
    const obscure = byField('director').find((c) => c.subject === 'show 19');
    expect(obscure.difficulty).toBeGreaterThan(famous.difficulty);
  });

  it('treats a show with no popularity rank as obscure, not easy', () => {
    const raw = makePack();
    delete raw.shows['show 0'].popularityRank;
    const c = buildContext(indexPack(raw), allKeys);
    expect(c.showObscurity.get('show 0')).toBe(1);
  });

  it('prices a hard field above an easy one on the same show', () => {
    const source = byField('source').find((c) => c.subject === 'show 4');
    const comp = byField('seriesComposition').find((c) => c.subject === 'show 4');
    expect(comp.difficulty).toBeGreaterThan(source.difficulty);
  });

  it('skips a source it cannot name', () => {
    const raw = makePack();
    raw.shows['show 0'].source = 'OTHER';
    const c = buildContext(indexPack(raw), ['show 0']);
    const clues = TOPICS.flatMap((t) => candidatesFor(c, t));
    expect(clues.some((x) => x.field === 'source')).toBe(false);
  });
});

describe('multiple choice', () => {
  const ctx = buildContext(index, allKeys);
  const all = TOPICS.flatMap((t) => candidatesFor(ctx, t));

  it('offers four distinct options, exactly one of which is accepted', () => {
    const rng = seeded(3);
    for (const clue of all) {
      const mc = withChoices(ctx, clue, rng);
      expect(mc, clue.id).not.toBeNull();
      expect(mc.options).toHaveLength(CHOICES);
      expect(new Set(mc.options.map((o) => foldAnswer(clue.kind, o))).size).toBe(CHOICES);
      expect(mc.options.filter((o) => isCorrect(mc, o))).toHaveLength(1);
    }
  });

  it('never offers a year newer than the newest show', () => {
    const rng = seeded(9);
    const newest = all.find((c) => c.field === 'seasonYear' && c.answer === '2019');
    for (let i = 0; i < 20; i++) {
      for (const o of withChoices(ctx, newest, rng).options) expect(Number(o)).toBeLessThanOrEqual(2019);
    }
  });

  it('returns null rather than a short list when honest options run out', () => {
    const tiny = indexPack(makePack({ shows: 1 }));
    const c = buildContext(tiny, ['show 0']);
    const clue = candidatesFor(c, TOPICS.find((t) => t.id === 'studios')).find((x) => x.field === 'studio');
    expect(withChoices(c, clue, seeded(1))).toBeNull();
  });
});

describe('dealBoard', () => {
  it('deals ladders of five, cheapest first, with the Daily Double off the top row', () => {
    const board = dealBoard(index, allKeys, { categories: 5, rng: seeded(7) });
    expect(board.categories).toHaveLength(5);
    for (const col of board.categories) {
      expect(col.clues.map((c) => c.value)).toEqual(BOARD_VALUES);
      const diffs = col.clues.map((c) => c.difficulty);
      expect([...diffs].sort((a, b) => a - b)).toEqual(diffs);
      expect(new Set(col.clues.map((c) => c.subject)).size).toBe(ROWS);
      for (const c of col.clues) expect(c.options).toHaveLength(CHOICES);
    }
    const dd = parseCell(board.dailyDouble);
    expect(dd.row).toBeGreaterThan(0);
    expect(dd.col).toBeLessThan(5);
  });

  it('draws the final from a subject the board did not use', () => {
    const board = dealBoard(index, allKeys, { categories: 3, rng: seeded(11) });
    const onBoard = new Set(board.categories.flatMap((c) => c.clues.map((x) => x.subject)));
    expect(board.final).toBeTruthy();
    expect(onBoard.has(board.final.subject)).toBe(false);
  });

  it('honours the switches', () => {
    const board = dealBoard(index, allKeys, { dailyDouble: false, finalRound: false, choices: false, rng: seeded(2) });
    expect(board.dailyDouble).toBeNull();
    expect(board.final).toBeNull();
    expect(board.categories[0].clues[0].options).toBeUndefined();
  });

  it('refuses a pool too small to make a board', () => {
    // One show and its three leads: no topic reaches five distinct subjects.
    // (Two shows is already enough for two character columns.)
    expect(dealBoard(index, ['show 0'], { rng: seeded(1) })).toEqual({ error: 'not-enough' });
    expect(dealBoard(index, [], { rng: seeded(1) })).toEqual({ error: 'not-enough' });
  });
});

describe('dealQuiz', () => {
  it('deals distinct subjects, easiest first, priced by difficulty', () => {
    const { questions } = dealQuiz(index, allKeys, { count: 12, rng: seeded(5) });
    expect(questions).toHaveLength(12);
    expect(new Set(questions.map((q) => q.subject)).size).toBe(12);
    const diffs = questions.map((q) => q.difficulty);
    expect([...diffs].sort((a, b) => a - b)).toEqual(diffs);
    for (const q of questions) expect(q.value).toBeGreaterThan(0);
  });

  it('spreads across topics rather than drawing the biggest one dry', () => {
    const { questions } = dealQuiz(index, allKeys, { count: 7, rng: seeded(8) });
    expect(new Set(questions.map((q) => q.topic)).size).toBe(7);
  });

  it('errors on an empty pool', () => {
    expect(dealQuiz(index, [], {})).toEqual({ error: 'not-enough' });
  });
});

describe('poolSummary and domains', () => {
  it('reports how much of the requested pool the pack covers', () => {
    const s = poolSummary(index, ['show 0', 'show 1', 'nobody has heard of this']);
    expect(s.requested).toBe(3);
    expect(s.shows).toBe(2);
    expect(s.characters).toBe(6);
  });

  it('lists the closed domains whole and the open ones from the pack', () => {
    expect(domainValues(index, 'season')).toHaveLength(4);
    expect(domainValues(index, 'studio')).toHaveLength(STUDIOS.length);
    expect(domainValues(index, 'show')).toContain('Show 7');
  });
});

describe('normalizeClue', () => {
  it('survives the trip through Realtime Database', () => {
    const [clue] = dealQuiz(index, allKeys, { count: 1, rng: seeded(4) }).questions;
    // RTDB drops empty arrays entirely and returns sparse ones as objects.
    const stored = JSON.parse(JSON.stringify({ ...clue, alsoAccepted: undefined }));
    stored.options = Object.fromEntries(clue.options.map((o, i) => [String(i), o]));
    const back = normalizeClue(stored);
    expect(back.alsoAccepted).toEqual([]);
    expect(back.options).toEqual(clue.options);
    expect(isCorrect(back, clue.answer)).toBe(true);
  });

  it('keeps a typed clue optionless', () => {
    expect(normalizeClue({ prompt: 'x', accept: ['a'] }).options).toBeNull();
    expect(normalizeClue(null)).toBeNull();
  });
});
