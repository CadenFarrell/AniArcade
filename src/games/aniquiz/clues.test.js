import { describe, it, expect } from 'vitest';
import { indexPack } from '../../shared/utils/facts';
import {
  BOARD_VALUES, CHOICES, ROWS, buildContext, candidatesFor, dealBoard, dealQuiz, dealableTopics, domainValues, enabledTopics,
  foldAnswer, isCorrect, normalizeClue, parseCell, poolSummary, showOf, TOPICS, trails, withChoices,
} from './clues';
import { portraitsFrom } from './utils/portraits';
import { DEFAULT_PREFS } from './prefs';

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
      // Distinct, and spread wide enough that Fan Favourites' margins leave
      // every show something it clearly beats or trails.
      averageScore: 50 + ((i * 7) % 40),
      popularity: 400000 - i * 9000,
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

// Ten shows, the first with a 30-strong main cast — pack-v5's JoJo has 35
// against a median show's 4, which is what let one show crowd the deal.
function bigCastIndex() {
  const raw = makePack({ shows: 10 });
  for (let c = 3; c < 30; c++) {
    raw.characters[`hero 0 ${c}`] = {
      name: `Hero 0 ${c}`, voiceActorJp: `Actor 0 ${c}`, favourites: 500 - c, appearsIn: ['show 0'],
    };
  }
  return indexPack(raw);
}

describe('spread across shows', () => {
  const boardClues = (b) => [...b.categories.flatMap((c) => c.clues), ...(b.final ? [b.final] : [])];

  it('counts a character clue against its show', () => {
    const ctx = buildContext(index, ['show 3']);
    const voice = candidatesFor(ctx, TOPICS.find((t) => t.id === 'voices'));
    expect(voice.length).toBeGreaterThan(0);
    for (const c of voice) expect(showOf(c)).toBe('show 3');
    const cast = candidatesFor(ctx, TOPICS.find((t) => t.id === 'cast'));
    for (const c of cast) expect(showOf(c)).toBe('show 3');
  });

  it('gives a big cast no more chances than a small one', () => {
    // A five-question voice quiz over ten shows: even, each show is in about
    // half of them. Drawn per character, the 30-strong show was in nearly all.
    const big = bigCastIndex();
    const keys = [...big.shows.keys()];
    const voices = TOPICS.filter((t) => t.id === 'voices');
    let withBig = 0;
    const N = 200;
    for (let seed = 1; seed <= N; seed++) {
      const { questions } = dealQuiz(big, keys, { count: 5, topics: voices, rng: seeded(seed) });
      expect(questions).toHaveLength(5);
      if (questions.some((q) => showOf(q) === 'show 0')) withBig++;
    }
    expect(withBig / N).toBeLessThan(0.65);
    expect(withBig / N).toBeGreaterThan(0.35);
  });

  it('uses each show once on a board while the pool has shows to spare', () => {
    const wide = indexPack(makePack({ shows: 40 }));
    const keys = [...wide.shows.keys()];
    for (let seed = 1; seed <= 10; seed++) {
      const clues = boardClues(dealBoard(wide, keys, { categories: 5, rng: seeded(seed) }));
      expect(clues).toHaveLength(26);
      expect(new Set(clues.map(showOf)).size).toBe(26);
    }
  });

  it('still deals when the pool is too small for every show to be fresh', () => {
    const small = [...index.shows.keys()].slice(0, 6);
    const board = dealBoard(index, small, { categories: 5, rng: seeded(3) });
    expect(board.categories).toHaveLength(5);
    expect(new Set(boardClues(board).map(showOf)).size).toBe(6);
  });
});

describe('recent games', () => {
  const boardClues = (b) => [...b.categories.flatMap((c) => c.clues), ...(b.final ? [b.final] : [])];
  const ctx = buildContext(index, allKeys);
  const ids = TOPICS.flatMap((t) => candidatesFor(ctx, t)).map((c) => c.id);
  const half = new Set(ids.filter((_, i) => i % 2 === 0));
  // Forty shows, so a 26-clue board can find a fresh show AND an unseen clue;
  // on twenty, every show is spent anyway and the board's preference for a
  // fresh show over an unseen clue decides most picks.
  const wide = indexPack(makePack({ shows: 40 }));
  const wideKeys = [...wide.shows.keys()];
  const wideIds = TOPICS.flatMap((t) => candidatesFor(buildContext(wide, wideKeys), t)).map((c) => c.id);
  const wideHalf = new Set(wideIds.filter((_, i) => i % 2 === 0));

  it('avoids clues dealt lately when the rest can fill the game', () => {
    const recent = { ids: half, shows: new Set() };
    let dealt = 0;
    let repeats = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { questions } = dealQuiz(index, allKeys, { count: 10, rng: seeded(seed), recent });
      expect(questions).toHaveLength(10);
      for (const q of questions) expect(half.has(q.id), q.id).toBe(false);
      // A board may take a recent clue rather than spend a show twice — a fresh
      // show outranks an unseen clue — so it is held to a rate, not a ban.
      // Blind to memory, half of these would be repeats.
      const clues = boardClues(dealBoard(wide, wideKeys, { categories: 5, rng: seeded(seed), recent: { ids: wideHalf, shows: new Set() } }));
      dealt += clues.length;
      repeats += clues.filter((c) => wideHalf.has(c.id)).length;
    }
    expect(repeats / dealt).toBeLessThan(0.15);
  });

  it('still deals when everything was dealt lately', () => {
    const recent = { ids: new Set(ids), shows: new Set(allKeys) };
    expect(dealQuiz(index, allKeys, { count: 10, rng: seeded(2), recent }).questions).toHaveLength(10);
    expect(dealBoard(index, allKeys, { categories: 5, rng: seeded(2), recent }).categories).toHaveLength(5);
  });
});

describe('recent games, the old twenty-show check', () => {
  // Kept for the quiz, which never repeats a subject and so honours memory
  // strictly on the smaller pack too.
  const boardClues = (b) => [...b.categories.flatMap((c) => c.clues), ...(b.final ? [b.final] : [])];
  const ctx = buildContext(index, allKeys);
  const half = new Set(TOPICS.flatMap((t) => candidatesFor(ctx, t)).map((c) => c.id).filter((_, i) => i % 2 === 0));

  it('still does better than chance on a board', () => {
    const recent = { ids: half, shows: new Set() };
    let dealt = 0;
    let repeats = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const clues = boardClues(dealBoard(index, allKeys, { categories: 5, rng: seeded(seed), recent }));
      dealt += clues.length;
      repeats += clues.filter((c) => half.has(c.id)).length;
    }
    expect(repeats / dealt).toBeLessThan(0.4);
  });
});

describe('wrong options across a deal', () => {
  it('does not repeat a wrong option while the domain has fresh ones', () => {
    // These domains hold 60–80 values in the synthetic pack, more than a board
    // asks of them. Show titles (20, and most clues on a board answer with a
    // show), studios (six) and the closed sets must repeat, so are left out.
    const spread = ['character', 'staff', 'voiceActor'];
    for (let seed = 1; seed <= 10; seed++) {
      const board = dealBoard(index, allKeys, { categories: 6, rng: seeded(seed) });
      const clues = [...board.categories.flatMap((c) => c.clues), board.final];
      const shown = new Map();
      for (const c of clues.filter((x) => spread.includes(x.domain))) {
        for (const o of c.options.filter((x) => x !== c.answer)) {
          const k = `${c.domain}|${foldAnswer(c.kind, o)}`;
          expect(shown.has(k), `${k} (seed ${seed})`).toBe(false);
          shown.set(k, true);
        }
      }
    }
  });

  it('draws character options show by show, not character by character', () => {
    const big = bigCastIndex();
    const keys = [...big.shows.keys()];
    const fromBig = (name) => /^Hero 0 /.test(name);
    let total = 0;
    let big0 = 0;
    for (let seed = 1; seed <= 100; seed++) {
      // A fresh context each time, so the deal-wide "already shown" record
      // does not steer the sample.
      const c = buildContext(big, keys);
      const clue = candidatesFor(c, TOPICS.find((t) => t.id === 'cast')).find((x) => x.field === 'mainCast' && x.subject === 'show 5');
      const mc = withChoices(c, clue, seeded(seed));
      for (const o of mc.options.filter((x) => x !== mc.answer)) { total++; if (fromBig(o)) big0++; }
    }
    // Even by show: about one in nine. Flat over characters it was 30 in 54.
    expect(big0 / total).toBeLessThan(0.25);
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
    const off = ['squad', 'portraits', 'cast', 'firsts', 'favourites', 'voices', 'calendar', 'music', 'staff'];
    const board = dealBoard(index, allKeys, { categories: 6, topics: enabledTopics(off), rng: seeded(4) });
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

// ── The casual topics ──────────────────────────────────────────────────────

describe('The Squad', () => {
  const squadOf = (pack, key) => {
    const ix = indexPack(pack);
    return candidatesFor(buildContext(ix, [key]), TOPICS.find((t) => t.id === 'squad'))[0] ?? null;
  };

  it('names the show from its three best-known leads, accepting only shows they all lead', () => {
    const c = squadOf(makePack(), 'show 4');
    expect(c.prompt).toBe('Hero 4 0, Hero 4 1 and Hero 4 2 are main characters in which show?');
    expect(c.accept).toEqual(['show 4']);
    expect(c.domain).toBe('show');
  });

  it('never names a lead whose name gives the title away', () => {
    const raw = makePack();
    raw.shows['show 2'].title = 'The Saga of Hero';
    const c = squadOf(raw, 'show 2');
    // All three leads are "Hero 2 …": every one shares a word with the title.
    expect(c).toBeNull();
    raw.characters['hero 2 0'].name = 'Mika Tanaka';
    raw.characters['hero 2 1'].name = 'Ren Sato';
    const two = squadOf(raw, 'show 2');
    expect(two.prompt).toBe('Mika Tanaka and Ren Sato are main characters in which show?');
  });
});

describe('Which Came First? and Fan Favourites', () => {
  const ctx = buildContext(index, allKeys);
  const compareClues = TOPICS.filter((t) => t.choiceOnly).flatMap((t) => candidatesFor(ctx, t));

  it('makes every wrong option clearly trail the answer, and shows the values in the reveal', () => {
    expect(new Set(compareClues.map((c) => c.field))).toEqual(new Set(['firstAired', 'lastAired', 'topScore', 'mostPopular']));
    const rng = seeded(12);
    for (const clue of compareClues) {
      const mc = withChoices(buildContext(index, allKeys), clue, rng);
      expect(mc, clue.id).not.toBeNull();
      const answer = index.shows.get(clue.subject);
      for (const o of mc.options.filter((x) => x !== mc.answer)) {
        const other = [...index.shows.values()].find((s) => s.title === o);
        expect(trails(clue.field, answer, other), `${clue.id}: ${o}`).toBe(true);
      }
      expect(mc.options.filter((o) => isCorrect(mc, o))).toHaveLength(1);
      expect(mc.detail.split(' · ')).toHaveLength(CHOICES);
      expect(mc.detail.startsWith(answer.title)).toBe(true);
    }
  });

  it('never asks about the show with nothing to beat', () => {
    // The newest show has no later one, so it cannot be "first" — but can be "newest".
    const ids = compareClues.map((c) => c.id);
    expect(ids).not.toContain('firstAired:show 19');
    expect(ids).toContain('lastAired:show 19');
    expect(ids).not.toContain('lastAired:show 0');
  });

  it('reads a margin, not just an order', () => {
    const a = { seasonYear: 2010, averageScore: 80, popularity: 1000 };
    expect(trails('firstAired', a, { seasonYear: 2010 })).toBe(false);
    expect(trails('firstAired', a, { seasonYear: 2011 })).toBe(true);
    expect(trails('topScore', a, { averageScore: 78 })).toBe(false);
    expect(trails('topScore', a, { averageScore: 77 })).toBe(true);
    expect(trails('mostPopular', a, { popularity: 900 })).toBe(false);
    expect(trails('mostPopular', a, { popularity: 800 })).toBe(true);
    expect(trails('topScore', a, {})).toBe(false);
  });

  it('is left out of a typed deal, and refused if one arrives anyway', () => {
    expect(dealableTopics([], { choices: false }).some((t) => t.choiceOnly)).toBe(false);
    expect(dealableTopics([], { choices: true }).filter((t) => t.choiceOnly)).toHaveLength(2);
    const firsts = TOPICS.filter((t) => t.id === 'firsts');
    expect(dealQuiz(index, allKeys, { count: 5, topics: firsts, choices: false, rng: seeded(1) })).toEqual({ error: 'not-enough' });
    expect(dealQuiz(index, allKeys, { count: 5, topics: firsts, choices: true, rng: seeded(1) }).questions).toHaveLength(5);
  });

  it('counts a choice-only topic under typed answers, but not toward Start', () => {
    const typed = poolSummary(index, allKeys, [], { choices: false });
    const chosen = poolSummary(index, allKeys, [], { choices: true });
    expect(typed.topics.find((t) => t.id === 'firsts')).toMatchObject({ typedOut: true, usable: false });
    expect(chosen.topics.find((t) => t.id === 'firsts')).toMatchObject({ typedOut: false, usable: true });
    expect(typed.playableTopics).toBe(chosen.playableTopics - 2);
  });
});

describe('Name That Character', () => {
  const portraits = new Map([['hero 3 0', 'https://img.example/hero-3-0.png'], ['hero 5 1', 'https://img.example/hero-5-1.png']]);
  const topic = TOPICS.find((t) => t.id === 'portraits');

  it('asks only about characters a list pictured, carrying the picture', () => {
    const clues = candidatesFor(buildContext(index, allKeys, { portraits }), topic);
    expect(new Set(clues.map((c) => c.subject))).toEqual(new Set(['hero 3 0', 'hero 5 1']));
    const name = clues.find((c) => c.field === 'portraitName' && c.subject === 'hero 3 0');
    expect(name).toMatchObject({ prompt: 'Who is this character?', answer: 'Hero 3 0', image: 'https://img.example/hero-3-0.png' });
    // The prompt must never name them.
    for (const c of clues) expect(c.prompt).not.toMatch(/Hero/);
    const show = clues.find((c) => c.field === 'portraitShow' && c.subject === 'hero 5 1');
    expect(show).toMatchObject({ answer: 'Show 5', accept: ['show 5'], kind: 'show' });
  });

  it('has nothing to ask without any portraits', () => {
    expect(candidatesFor(buildContext(index, allKeys), topic)).toEqual([]);
  });

  it('keeps the picture and the comparison detail through Realtime Database', () => {
    const back = normalizeClue(JSON.parse(JSON.stringify({ prompt: 'x', accept: ['a'], image: 'https://a/b.png', detail: 'A 2009 · B 2011' })));
    expect(back.image).toBe('https://a/b.png');
    expect(back.detail).toBe('A 2009 · B 2011');
    expect(normalizeClue({ prompt: 'x', accept: ['a'] })).toMatchObject({ image: null, detail: null });
  });

  it('collects portraits from every seated list, keyed as the pack keys characters', () => {
    const players = [
      { animeList: [{ characters: [{ name: 'Hero 3 0', imageUrl: 'https://img.example/a.png' }, { name: 'No Picture' }] }] },
      { animeList: [{ characters: [{ name: 'hero 3 0', imageUrl: 'https://img.example/b.png' }, { name: 'Hero 4 0', imageUrl: 'javascript:alert(1)' }] }] },
      { animeList: [] },
      {},
    ];
    const map = portraitsFrom(players);
    expect([...map.entries()]).toEqual([['hero 3 0', 'https://img.example/a.png']]);
  });
});

describe('default categories', () => {
  it('switches off exactly the topics marked hard, so casual tables start with the watchable ones', () => {
    expect(DEFAULT_PREFS.topicsOff).toEqual(TOPICS.filter((t) => t.hard).map((t) => t.id));
    expect(DEFAULT_PREFS.topicsOff.length).toBeGreaterThan(0);
  });

  it('still deals a full board from the defaults alone', () => {
    const portraits = portraitsFrom([{ animeList: [{ characters: [...index.characters.values()].map((c) => ({ name: c.name, imageUrl: `https://img.example/${c.name}.png` })) }] }]);
    const board = dealBoard(index, allKeys, { categories: 6, topics: enabledTopics(DEFAULT_PREFS.topicsOff), rng: seeded(3), portraits });
    expect(board.categories).toHaveLength(6);
    for (const col of board.categories) expect(TOPICS.find((t) => t.id === col.id).hard).toBeFalsy();
  });
});
