import { describe, it, expect } from 'vitest';
import { indexPack } from '../../shared/utils/facts';
import {
  BOARD_VALUES, CHOICES, ROWS, buildContext, candidatesFor, dealBoard, dealQuiz, domainValues, enabledTopics,
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
      // pack-v5's outside fields. Every manga gets its own magazine and every
      // source its own publisher, so each domain has honest distractors.
      themes: [
        { type: 'OP', song: `Opening ${i}`, artists: [`Singer ${i}`] },
        { type: 'ED', song: `Ending ${i}`, artists: [`Singer ${(i + 1) % shows}`] },
      ],
      ...(SOURCES[i % SOURCES.length] === 'MANGA' ? { serializedIn: `Magazine ${i}` } : {}),
      ...(['MANGA', 'LIGHT_NOVEL'].includes(SOURCES[i % SOURCES.length])
        ? { originalPublisher: `Publisher ${i}`, originalYear: 1990 + i }
        : {}),
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

describe('topic switches', () => {
  it('reads the off list, ignoring ids it does not know', () => {
    expect(enabledTopics([]).map((t) => t.id)).toEqual(TOPICS.map((t) => t.id));
    expect(enabledTopics(undefined)).toHaveLength(TOPICS.length);
    expect(enabledTopics(['voices', 'no-such-topic']).map((t) => t.id)).not.toContain('voices');
    expect(enabledTopics(['voices', 'no-such-topic'])).toHaveLength(TOPICS.length - 1);
  });

  it('deals a board and its final only from the topics left on', () => {
    const topics = enabledTopics(['voices', 'cast', 'calendar']);
    for (let seed = 1; seed <= 10; seed++) {
      const board = dealBoard(index, allKeys, { categories: 6, topics, rng: seeded(seed) });
      const used = [...board.categories.map((c) => c.id), board.final.topic];
      for (const id of used) expect(['voices', 'cast', 'calendar']).not.toContain(id);
    }
  });

  it('deals a narrower board when fewer topics are on than columns asked for', () => {
    const board = dealBoard(index, allKeys, { categories: 6, topics: enabledTopics(['voices', 'cast', 'calendar', 'music', 'staff']), rng: seeded(4) });
    expect(board.categories.map((c) => c.id).sort()).toEqual(['origins', 'studios', 'themes']);
  });

  it('refuses a board with only one topic left on', () => {
    const one = TOPICS.filter((t) => t.id !== 'studios').map((t) => t.id);
    expect(dealBoard(index, allKeys, { topics: enabledTopics(one), rng: seeded(1) })).toEqual({ error: 'not-enough' });
  });

  it('keeps a quick quiz to the topics left on', () => {
    const { questions } = dealQuiz(index, allKeys, { count: 12, topics: enabledTopics(['voices']), rng: seeded(6) });
    expect(questions.some((q) => q.topic === 'voices')).toBe(false);
  });

  it('reports every topic with its show count, and totals only the ones on', () => {
    const all = poolSummary(index, allKeys);
    const some = poolSummary(index, allKeys, ['voices', 'studios']);
    expect(some.topics).toHaveLength(TOPICS.length);
    expect(some.topics.find((t) => t.id === 'voices')).toMatchObject({ enabled: false, clues: 60 });
    expect(some.playableTopics).toBe(all.playableTopics - 2);
    expect(some.clues).toBeLessThan(all.clues);
  });
});

describe('theme songs', () => {
  const clueFor = (pack, field, subject) => {
    const ix = indexPack(pack);
    const c = buildContext(ix, [subject]);
    return TOPICS.flatMap((t) => candidatesFor(c, t)).find((x) => x.field === field && x.subject === subject);
  };

  it('names the show from its first opening, and accepts every show that used the same song', () => {
    const raw = makePack();
    raw.shows['show 0'].themes = [
      { type: 'ED', song: 'Ending 0', artists: ['Singer 0'] },
      { type: 'OP', song: 'Gurenge', artists: ['LiSA'] },
    ];
    raw.shows['same song'] = { title: 'Same Song', format: 'TV', themes: [{ type: 'OP', song: 'gurenge', artists: ['LiSA'] }] };
    raw.shows['unknown singer'] = { title: 'Unknown Singer', format: 'TV', themes: [{ type: 'OP', song: 'Gurenge' }] };
    raw.shows['other gurenge'] = { title: 'Other Gurenge', format: 'TV', themes: [{ type: 'OP', song: 'Gurenge', artists: ['Somebody Else'] }] };
    raw.shows['as an ending'] = { title: 'As An Ending', format: 'TV', themes: [{ type: 'ED', song: 'Gurenge', artists: ['LiSA'] }] };
    const clue = clueFor(raw, 'themeShow', 'show 0');
    expect(clue.prompt).toBe('“Gurenge” by LiSA is an opening theme of which show?');
    expect(isCorrect(clue, 'Show 0')).toBe(true);
    expect(isCorrect(clue, 'Same Song')).toBe(true);
    // No performer on record: possibly the same song, so not ruled out.
    expect(isCorrect(clue, 'Unknown Singer')).toBe(true);
    // A different song with the same title, and the same song as an ending.
    expect(isCorrect(clue, 'Other Gurenge')).toBe(false);
    expect(isCorrect(clue, 'As An Ending')).toBe(false);
  });

  it('accepts any performer of a song, and the full credit, but asks about a solo one when it can', () => {
    const raw = makePack();
    raw.shows['show 0'].themes = [
      { type: 'OP', song: 'Duet', artists: ['FictionJunction', 'LiSA'] },
      { type: 'ED', song: 'Solo', artists: ['Aimer'] },
    ];
    expect(clueFor(raw, 'themeArtist', 'show 0').answer).toBe('Aimer');

    raw.shows['show 0'].themes = [{ type: 'OP', song: 'Duet', artists: ['FictionJunction', 'LiSA'] }];
    const duet = clueFor(raw, 'themeArtist', 'show 0');
    expect(duet.answer).toBe('FictionJunction & LiSA');
    expect(isCorrect(duet, 'LiSA')).toBe(true);
    expect(isCorrect(duet, 'fictionjunction')).toBe(true);
    expect(isCorrect(duet, 'FictionJunction & LiSA')).toBe(true);
    expect(isCorrect(duet, 'Aimer')).toBe(false);
  });

  it('never quotes a song named after its own show', () => {
    const raw = makePack();
    raw.shows['show 0'].title = 'Date A Live';
    raw.shows['show 0'].themes = [
      { type: 'OP', song: 'Date A Live', artists: ['sweet ARMS'] },
      { type: 'OP', song: 'Trust in you', artists: ['sweet ARMS'] },
    ];
    expect(clueFor(raw, 'themeShow', 'show 0').prompt).toBe('“Trust in you” by sweet ARMS is an opening theme of which show?');
    // The other way round: the show's title inside the song's.
    raw.shows['show 0'].title = 'Pokémon';
    raw.shows['show 0'].themes = [{ type: 'OP', song: 'Mezase Pokemon Master', artists: ['Rica Matsumoto'] }];
    expect(clueFor(raw, 'themeShow', 'show 0')).toBeUndefined();
    // Whole words only: "Be" is not in "Believe".
    raw.shows['show 0'].title = 'Be';
    raw.shows['show 0'].themes = [{ type: 'OP', song: 'Believe', artists: ['Folder5'] }];
    expect(clueFor(raw, 'themeShow', 'show 0')).toBeDefined();
  });

  it('asks nothing about who sings a song with no performer on record', () => {
    const raw = makePack();
    raw.shows['show 0'].themes = [{ type: 'OP', song: 'R★O★C★K★S' }];
    expect(clueFor(raw, 'themeArtist', 'show 0')).toBeUndefined();
    expect(clueFor(raw, 'artistReverse', 'show 0')).toBeUndefined();
    expect(clueFor(raw, 'themeShow', 'show 0').prompt).toBe('“R★O★C★K★S” is an opening theme of which show?');
  });

  it('accepts every show a performer sang the same kind of theme for', () => {
    const raw = makePack();
    raw.shows['also lisa'] = { title: 'Also LiSA', format: 'TV', themes: [{ type: 'OP', song: 'crossing field', artists: ['LiSA'] }] };
    raw.shows['lisa ending'] = { title: 'LiSA Ending', format: 'TV', themes: [{ type: 'ED', song: 'x', artists: ['LiSA'] }] };
    raw.shows['show 0'].themes = [{ type: 'OP', song: 'Gurenge', artists: ['LiSA'] }];
    const clue = clueFor(raw, 'artistReverse', 'show 0');
    expect(clue.prompt).toBe('LiSA performed an opening theme for this TV series. Name it.');
    expect(clue.alsoAccepted).toEqual(['Also LiSA']);
    expect(isCorrect(clue, 'LiSA Ending')).toBe(false);
  });
});

describe('source works', () => {
  const clueFor = (pack, field, subject) => {
    const c = buildContext(indexPack(pack), [subject]);
    return TOPICS.flatMap((t) => candidatesFor(c, t)).find((x) => x.field === field && x.subject === subject);
  };

  it("asks a manga's magazine, and a light novel's imprint — never one in the other's list", () => {
    // show 0 is a manga and show 1 a light novel (SOURCES order).
    const manga = clueFor(makePack(), 'originalPublisher', 'show 0');
    const novel = clueFor(makePack(), 'originalPublisher', 'show 1');
    expect(manga.domain).toBe('publisher');
    expect(novel.domain).toBe('imprint');
    expect(novel.prompt).toMatch(/imprint/);
    expect(domainValues(index, 'publisher')).not.toContain('Publisher 1');
    expect(domainValues(index, 'imprint')).toEqual(expect.arrayContaining(['Publisher 1', 'Publisher 5']));
    expect(clueFor(makePack(), 'magazine', 'show 0').answer).toBe('Magazine 0');
    expect(clueFor(makePack(), 'magazine', 'show 1')).toBeUndefined();
  });

  it('distrusts a source year later than the premiere', () => {
    const raw = makePack();
    raw.shows['show 0'].originalYear = 2030; // show 0 premiered in 2000
    expect(clueFor(raw, 'originalYear', 'show 0')).toBeUndefined();
    expect(clueFor(raw, 'magazineReverse', 'show 0')).toBeUndefined();
    expect(clueFor(makePack(), 'originalYear', 'show 0').answer).toBe('1990');
  });

  it('accepts every manga that began in the same magazine the same year', () => {
    const raw = makePack();
    raw.shows['jump twin'] = { title: 'Jump Twin', source: 'MANGA', serializedIn: 'Magazine 0', originalYear: 1990, format: 'TV' };
    const clue = clueFor(raw, 'magazineReverse', 'show 0');
    expect(clue.prompt).toBe('This TV series adapts a manga first serialized in Magazine 0 in 1990. Name it.');
    expect(clue.alsoAccepted).toEqual(['Jump Twin']);
  });
});

describe('supporting cast', () => {
  // Show 0's three leads, plus one supporting character who is main nowhere.
  const pack = makePack({ shows: 20 });
  pack.characters['side 0'] = {
    name: 'Side Zero', voiceActorJp: 'Actor 0 0', favourites: 5000, supportingIn: ['show 0'],
  };
  pack.aliases = { 'show zero the movie': 'show 0' };
  const idx = indexPack(pack);
  const ctx = buildContext(idx, [...idx.shows.keys()]);
  const all = TOPICS.flatMap((t) => candidatesFor(ctx, t));
  const about = (key) => all.filter((c) => c.subject === key);

  it('asks which show a supporting character is FROM, never which they are a main character in', () => {
    const clue = about('side 0').find((c) => c.field === 'appearsIn');
    expect(clue.prompt).toBe('Which show is Side Zero from?');
    expect(clue.accept).toEqual(['show 0']);
  });

  it('never offers a supporting character as a lead', () => {
    expect(about('side 0').some((c) => c.field === 'voiceActorReverse')).toBe(false);
    const mainCast = all.find((c) => c.field === 'mainCast' && c.subject === 'show 0');
    expect([mainCast.answer, ...mainCast.alsoAccepted]).not.toContain('Side Zero');
  });

  it('still asks who voices them', () => {
    expect(about('side 0').some((c) => c.field === 'voiceActor')).toBe(true);
  });

  it('puts a show in play through its alias', () => {
    expect(buildContext(idx, ['show zero the movie']).shows.map((s) => s.key)).toEqual(['show 0']);
  });
});
