import { describe, expect, it } from 'vitest';
import { answersFor, buildIndex, categoriesFor, categoryText, judgeName } from './answers';
import { dealGame } from './deal';
import { indexPack } from '../../shared/utils/facts';

const char = (name, role = 'Main') => ({ id: name, name, role, gender: 'Male', genres: ['Action'] });
const show = (title, studio, year, cast) => ({ id: title, title, studio, seasonYear: year, characters: cast.map((c) => char(...[].concat(c))) });

const NARUTO = show('Naruto', 'Pierrot', 2002, ['Naruto Uzumaki', 'Sasuke Uchiha', 'Sakura Haruno', ['Kakashi Hatake', 'Supporting'], ['Itachi Uchiha', 'Supporting'], ['Jiraiya', 'Supporting']]);
const BLEACH = show('Bleach', 'Pierrot', 2004, ['Ichigo Kurosaki', 'Rukia Kuchiki', ['Byakuya Kuchiki', 'Supporting']]);
const JJK = show('Jujutsu Kaisen', 'MAPPA', 2020, ['Yuji Itadori', 'Megumi Fushiguro']);
const players = [{ id: 'ada', name: 'Ada', animeList: [NARUTO, BLEACH, JJK] }];

// The pack adds a show nobody imported and a character's other appearance.
const pack = indexPack({
  version: 5,
  shows: {
    'chainsaw man': { title: 'Chainsaw Man', studio: 'MAPPA', startYear: 2022, tags: ['Gore', 'Heterosexual'] },
    'frieren beyond journey s end': { title: "Frieren: Beyond Journey's End", studio: 'Madhouse', startYear: 2023 },
  },
  characters: { 'rock lee': { name: 'Rock Lee', appearsIn: ['naruto'] } },
});

const index = buildIndex(players, pack);
const CAST = { kind: 'cast', key: 'naruto', label: 'Naruto' };
const MAINS = { kind: 'mains', key: 'naruto', label: 'Naruto' };
const MAPPA = { kind: 'studio', key: 'mappa', label: 'MAPPA' };

describe('answersFor', () => {
  it('joins the lists and the pack', () => {
    expect([...answersFor(index, CAST).values()]).toContain('Rock Lee');
    expect([...answersFor(index, MAPPA).values()].sort()).toEqual(['Chainsaw Man', 'Jujutsu Kaisen']);
    expect(answersFor(index, MAINS).has('kakashi hatake')).toBe(false);
  });

  it('drops census tags', () => {
    expect(index.shows.get('chainsaw man').tags.has('heterosexual')).toBe(false);
  });
});

describe('judgeName', () => {
  it('takes a full name in either order, or a unique part of one', () => {
    expect(judgeName(index, CAST, 'Uzumaki Naruto')).toMatchObject({ verdict: 'right', key: 'naruto uzumaki' });
    expect(judgeName(index, CAST, 'kakashi')).toMatchObject({ verdict: 'right', label: 'Kakashi Hatake' });
  });

  it('will not guess between two people who share a word', () => {
    expect(judgeName(index, CAST, 'Uchiha').verdict).toBe('pending');
  });

  it('marks a known full name from another show wrong, and leaves strangers to the table', () => {
    expect(judgeName(index, CAST, 'Ichigo Kurosaki')).toMatchObject({ verdict: 'wrong', why: 'not in this show' });
    expect(judgeName(index, CAST, 'Ichigo').verdict).toBe('pending');
    expect(judgeName(index, CAST, 'Neji Hyuga').verdict).toBe('pending');
  });

  it('tells a supporting character from a main one', () => {
    expect(judgeName(index, MAINS, 'Kakashi Hatake')).toMatchObject({ verdict: 'wrong', why: 'not a main character' });
  });

  it('judges a known show on the category’s own fact', () => {
    expect(judgeName(index, MAPPA, 'chainsaw man').verdict).toBe('right');
    expect(judgeName(index, MAPPA, 'Bleach')).toMatchObject({ verdict: 'wrong', why: 'animated by Pierrot' });
    expect(judgeName(index, MAPPA, 'Frieren')).toMatchObject({ verdict: 'wrong', label: "Frieren: Beyond Journey's End" });
    expect(judgeName(index, MAPPA, 'Made Up Show').verdict).toBe('pending');
  });

  it('never says no on a tag, which the pack only keeps the top few of', () => {
    expect(judgeName(index, { kind: 'tag', key: 'gore', label: 'Gore' }, 'Bleach').verdict).toBe('pending');
  });
});

describe('categories and the deal', () => {
  it('offers only categories rooted in the table’s own shows, with enough answers', () => {
    const cats = categoriesFor(index);
    expect(cats.some((c) => c.kind === 'cast' && c.key === 'naruto')).toBe(true);
    // Chainsaw Man is in the pack, not on a list: no "characters from" it.
    expect(cats.some((c) => c.key === 'chainsaw man')).toBe(false);
    expect(categoryText({ kind: 'studio', label: 'MAPPA' })).toBe('anime animated by MAPPA');
  });

  it('says how many categories a small list holds rather than dealing short', () => {
    const res = dealGame(players, { rounds: 6, seconds: 60 }, pack, () => 0.5);
    expect(res.error).toMatch(/need 6/);
    expect(res.found).toBeGreaterThan(0);
  });

  it('deals distinct categories, never the same cast twice', () => {
    const big = Array.from({ length: 30 }, (_, i) => show(`Show ${i}`, `Studio ${i % 3}`, 2000 + (i % 4),
      Array.from({ length: 7 }, (__, j) => `Hero ${i}-${j}`)));
    const res = dealGame([{ id: 'ada', name: 'Ada', animeList: big }], { rounds: 8, seconds: 45 }, null, Math.random);
    expect(res.deal.cats).toHaveLength(8);
    expect(res.deal.namingMs).toBe(45_000);
    const ids = res.deal.cats.map((c) => `${c.kind}:${c.key}`);
    expect(new Set(ids).size).toBe(8);
    const casts = res.deal.cats.filter((c) => c.kind === 'cast' || c.kind === 'mains').map((c) => c.key);
    expect(new Set(casts).size).toBe(casts.length);
    res.deal.cats.slice(1).forEach((c, i) => {
      const kinds = new Set(res.deal.cats.map((x) => x.kind));
      if (kinds.size > 1) expect(c.kind).not.toBe(res.deal.cats[i].kind);
    });
  });
});
