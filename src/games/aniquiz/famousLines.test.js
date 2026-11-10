import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexPack, resolveShowKey, subjectKeyForCharacter, subjectKeyForShow } from '../../shared/utils/facts';
import {
  CHOICES, TOPICS, buildContext, candidatesFor, dealBoard, dealQuiz, foldAnswer, isCorrect, poolSummary, withChoices,
} from './clues';
import { FAMOUS_LINES } from './famousLines';

// Famous Lines: the hand-written list (famousLines.js) and the three clue
// shapes clues.js makes from it. The first half holds the list to its own
// rules against the REAL pack, because a typo in a title or a speaker is
// silent — the line just never deals, or deals a wrong option that is right.

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

const LINES = TOPICS.find((t) => t.id === 'lines');

const manifest = JSON.parse(readFileSync('public/facts/index.json', 'utf8'));
const real = indexPack(JSON.parse(readFileSync(`public/facts/${manifest.current}`, 'utf8')));
const keyOf = (title) => resolveShowKey(real, subjectKeyForShow(title));
const castOf = (key) => [...real.characters.values()]
  .filter((c) => [...(c.appearsIn ?? []), ...(c.supportingIn ?? [])].includes(key))
  .map((c) => c.name);

describe('the list', () => {
  it.each(FAMOUS_LINES.map((l) => [l.line, l]))('%s', (_, l) => {
    // One blank, with something in it and something around it.
    expect(l.line.match(/\[[^\]]+\]/g)).toHaveLength(1);
    // Every show it names is a pack show, or it can never be in play.
    expect(real.shows.has(keyOf(l.show)), l.show).toBe(true);
    for (const a of l.also ?? []) expect(real.shows.has(keyOf(a)), a).toBe(true);
    // Three decoys, all different, none the ending under another spelling.
    const ending = /\[([^\]]+)\]/.exec(l.line)[1];
    const folds = [ending, ...l.decoys].map((d) => foldAnswer('line', d));
    expect(l.decoys).toHaveLength(CHOICES - 1);
    expect(new Set(folds).size).toBe(CHOICES);
    expect([1, 2, 3]).toContain(l.fame);
    // A speaker the pack lists is spelt the pack's way: the options are the
    // show's pack cast, so any other spelling would put them beside themselves.
    if (l.by) {
      const cast = castOf(keyOf(l.show)).map(subjectKeyForCharacter);
      const own = [l.by, l.pack].filter(Boolean).map(subjectKeyForCharacter);
      const listed = cast.some((n) => own.includes(n));
      const elsewhere = (l.aka ?? []).some((a) => cast.includes(subjectKeyForCharacter(a)));
      expect(listed || !elsewhere, `${l.by} is in the pack under an aka`).toBe(true);
    } else {
      expect(l.pack).toBeUndefined();
      expect(l.aka).toBeUndefined();
    }
  });

  it('has no line twice', () => {
    const ctx = buildContext(real, [...real.shows.keys()]);
    expect(ctx.lines).toHaveLength(FAMOUS_LINES.length);
    expect(new Set(ctx.lines.map((l) => l.subject)).size).toBe(FAMOUS_LINES.length);
  });

  it('makes every multiple-choice clue with exactly one right option', () => {
    const ctx = buildContext(real, [...real.shows.keys()]);
    const rng = seeded(2);
    let made = 0;
    for (const clue of candidatesFor(ctx, LINES)) {
      const dealt = withChoices(ctx, clue, rng);
      if (!dealt) continue;
      made++;
      expect(dealt.options).toHaveLength(CHOICES);
      expect(dealt.options.filter((o) => isCorrect(dealt, o)), dealt.prompt).toHaveLength(1);
    }
    // Spirited Away's three-strong pack cast is the floor that makes a speaker
    // clue at all; nearly every line should make it into a deal.
    expect(made).toBeGreaterThan(FAMOUS_LINES.length * 2);
  });
});

// A synthetic pack, for the rules each shape follows.
function makePack() {
  const pack = { version: 5, shows: {}, characters: {}, aliases: { 'the sequel': 'blade quest' } };
  const show = (key, title, rank) => { pack.shows[key] = { title, popularityRank: rank, format: 'TV' }; };
  show('blade quest', 'Blade Quest', 1);
  show('blade quest remake', 'Blade Quest Remake', 2);
  show('quiet days', 'Quiet Days', 3);
  for (let i = 0; i < 6; i++) show(`filler ${i}`, `Filler ${i}`, 10 + i);
  const char = (name, shows, role = 'appearsIn') => {
    pack.characters[subjectKeyForCharacter(name)] = { name, favourites: 100, [role]: shows };
  };
  char('Kenji Arata', ['blade quest', 'blade quest remake']);
  char('Mio Sato', ['blade quest']);
  char('Rui Hana', ['blade quest']);
  char('Old Master', ['blade quest'], 'supportingIn');
  char('Yuki Mori', ['quiet days']);
  char('Aoi Mori', ['quiet days']);
  return pack;
}

const LIST = [
  {
    show: 'Blade Quest',
    also: ['Blade Quest Remake'],
    by: 'Kenji Arata',
    aka: ['Kenji'],
    line: 'I will never sheathe [this sword]!',
    decoys: ['my pride', 'my anger', 'the truth'],
    fame: 1,
  },
  // Names its own show.
  { show: 'Quiet Days', by: 'Yuki Mori', line: 'These quiet days are [all I want].', decoys: ['too short', 'over', 'a lie'], fame: 2 },
  // Names its own speaker.
  { show: 'Blade Quest', by: 'Mio Sato', line: 'Mio never [gives up]!', decoys: ['sleeps', 'loses', 'cries'], fame: 2 },
  // Narration: no speaker.
  { show: 'Blade Quest', line: 'Long ago, the world was [split in two].', decoys: ['made of glass', 'at peace', 'asleep'], fame: 3 },
  // A tell only a person sees.
  { show: 'Blade Quest', by: 'Rui Hana', line: 'Kenji, wait for [me]!', decoys: ['us', 'dawn', 'the signal'], fame: 2, noShow: true },
];

const index = indexPack(makePack());
const allKeys = [...index.shows.keys()];
const ctxFor = (keys = allKeys) => buildContext(index, keys, { lines: LIST });
const clueOf = (ctx, field, start) => candidatesFor(ctx, LINES).find((c) => c.field === field && c.prompt.includes(start));

describe('the three shapes', () => {
  it('blanks the ending, offers the list’s decoys and shows the whole line after', () => {
    const ctx = ctxFor();
    const clue = clueOf(ctx, 'lineFinish', 'sheathe');
    expect(clue.prompt).toBe('Finish Kenji Arata’s line from “Blade Quest”: “I will never sheathe ___!”');
    expect(clue.detail).toBe('“I will never sheathe this sword!” — Kenji Arata');
    const dealt = withChoices(ctx, clue, seeded(1));
    expect([...dealt.options].sort()).toEqual(['my anger', 'my pride', 'the truth', 'this sword']);
    expect(isCorrect(dealt, 'this sword')).toBe(true);
    expect(isCorrect(dealt, 'my pride')).toBe(false);
  });

  it('says “this line” when nobody in particular says it, and asks no speaker', () => {
    const ctx = ctxFor();
    expect(clueOf(ctx, 'lineFinish', 'Long ago').prompt).toMatch(/^Finish this line from “Blade Quest”/);
    expect(clueOf(ctx, 'lineSpeaker', 'Long ago')).toBeUndefined();
  });

  it('accepts a typed speaker in either order and under an aka', () => {
    const clue = clueOf(ctxFor(), 'lineSpeaker', 'sheathe');
    for (const typed of ['Kenji Arata', 'arata kenji', 'Kenji']) expect(isCorrect(clue, typed), typed).toBe(true);
    expect(isCorrect(clue, 'Mio Sato')).toBe(false);
  });

  it('draws a speaker’s wrong options from the show’s own cast, supporting cast included', () => {
    const ctx = ctxFor();
    const dealt = withChoices(ctx, clueOf(ctx, 'lineSpeaker', 'sheathe'), seeded(3));
    expect([...dealt.options].sort()).toEqual(['Kenji Arata', 'Mio Sato', 'Old Master', 'Rui Hana']);
  });

  it('deals no speaker clue as multiple choice when the cast is too small to hide them in', () => {
    const ctx = ctxFor();
    // Quiet Days has two characters: one speaker, one other.
    const raw = { show: 'Quiet Days', by: 'Aoi Mori', line: 'Tea is [ready].', decoys: ['cold', 'gone', 'late'], fame: 2 };
    const c = buildContext(index, allKeys, { lines: [raw] });
    const clue = candidatesFor(c, LINES).find((x) => x.field === 'lineSpeaker');
    expect(withChoices(c, clue, seeded(1))).toBeNull();
    expect(ctx).toBeTruthy();
  });

  it('never asks who says a line that names them, or where a line is from when it gives the show away', () => {
    const ctx = ctxFor();
    expect(clueOf(ctx, 'lineSpeaker', 'Mio never')).toBeUndefined();
    expect(clueOf(ctx, 'lineShow', 'Mio never')).toBeUndefined();
    expect(clueOf(ctx, 'lineShow', 'quiet days')).toBeUndefined();
    expect(clueOf(ctx, 'lineShow', 'Kenji, wait')).toBeUndefined();
    // …but still asks the shapes the tell does not spoil.
    expect(clueOf(ctx, 'lineSpeaker', 'quiet days')).toBeDefined();
    expect(clueOf(ctx, 'lineFinish', 'Mio never')).toBeDefined();
  });

  it('accepts every show a remade scene is from', () => {
    const clue = clueOf(ctxFor(), 'lineShow', 'sheathe');
    expect(clue.answer).toBe('Blade Quest');
    expect(isCorrect(clue, 'Blade Quest Remake')).toBe(true);
    expect(clue.alsoAccepted).toEqual(['Blade Quest Remake']);
  });

  it('puts a line in play through any show it is from, and spends that one', () => {
    const ctx = ctxFor(['blade quest remake']);
    expect(ctx.lines.map((l) => l.full)).toEqual(['I will never sheathe this sword!']);
    expect(clueOf(ctx, 'lineFinish', 'sheathe').show).toBe('blade quest remake');
    // Through the pack's aliases too, like every other topic.
    expect(ctxFor(['the sequel']).lines.length).toBeGreaterThan(0);
  });

  it('prices a famous line on a famous show below a deep cut', () => {
    const ctx = ctxFor();
    const famous = clueOf(ctx, 'lineFinish', 'sheathe');
    const deep = clueOf(ctx, 'lineFinish', 'Long ago');
    expect(deep.difficulty).toBeGreaterThan(famous.difficulty);
  });

  it('gives all three shapes one subject, so a column never asks one line twice', () => {
    const subjects = candidatesFor(ctxFor(), LINES).filter((c) => c.prompt.includes('sheathe')).map((c) => c.subject);
    expect(subjects).toHaveLength(3);
    expect(new Set(subjects).size).toBe(1);
  });
});

describe('typed answers', () => {
  it('leave the endings out and keep the other two shapes', () => {
    const typed = candidatesFor(ctxFor(), LINES, { choices: false });
    expect(typed.some((c) => c.field === 'lineFinish')).toBe(false);
    expect(typed.some((c) => c.field === 'lineSpeaker')).toBe(true);
    expect(typed.some((c) => c.field === 'lineShow')).toBe(true);
  });

  it('count only the lines a typed deal can ask', () => {
    const lines = (choices) => poolSummary(index, allKeys, [], { choices, lines: LIST }).topics.find((t) => t.id === 'lines');
    // Five lines. Typed, "Mio never" has nothing left: it names its speaker,
    // and so its show too. The narration still has its show to ask.
    expect(lines(true).clues).toBe(5);
    expect(lines(false).clues).toBe(4);
  });

  it('never deal an ending, on the real pack, in either format', () => {
    const keys = [...real.shows.keys()];
    const topics = [LINES, TOPICS.find((t) => t.id === 'cast')];
    for (let seed = 1; seed <= 5; seed++) {
      const board = dealBoard(real, keys, { categories: 2, choices: false, topics, rng: seeded(seed) });
      const quiz = dealQuiz(real, keys, { count: 20, choices: false, topics, rng: seeded(seed) });
      const clues = [...board.categories.flatMap((c) => c.clues), board.final, ...quiz.questions];
      expect(clues.some((c) => c?.field === 'lineFinish')).toBe(false);
      expect(clues.some((c) => c?.topic === 'lines')).toBe(true);
    }
  });
});

describe('on the real pack', () => {
  it('fills a Famous Lines column from the whole pack, priced 200 to 1000', () => {
    const keys = [...real.shows.keys()];
    const board = dealBoard(real, keys, { categories: 2, topics: [LINES, TOPICS.find((t) => t.id === 'cast')], rng: seeded(7) });
    const col = board.categories.find((c) => c.id === 'lines');
    expect(col.clues).toHaveLength(5);
    // Five different lines from five different shows.
    expect(new Set(col.clues.map((c) => c.subject)).size).toBe(5);
    expect(new Set(col.clues.map((c) => c.show)).size).toBe(5);
    for (const c of col.clues) expect(c.options).toHaveLength(CHOICES);
  });
});
