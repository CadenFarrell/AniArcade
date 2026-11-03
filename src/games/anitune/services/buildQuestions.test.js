// prepareQuestions against a canned AnimeThemes: how many requests a deal costs,
// what it caches, and the two API shapes that would fail silently if broken.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prepareQuestions, slimThemes } from './buildQuestions';
import { buildQuestionPool, pickAudioForTheme } from '../utils/questionPool';

// A Map-backed localStorage: the node environment has none, and storage.js
// swallows its absence, which would make every cache assertion vacuous.
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
    data,
  };
}

// A raw theme as the API sends it: two versions, the later one first, and a
// video carrying far more than AniTune reads — so the slim cache has something
// to drop and pickAudioForTheme's version order something to get right.
const rawTheme = (slug, type, sequence) => ({
  id: 9, slug: `${type}${sequence}`, type, sequence, group: null,
  song: { id: 3, title: `${slug} ${type}${sequence}`, artists: [{ id: 1, name: 'Band', as: null }] },
  animethemeentries: [
    { version: 2, episodes: '13-24', videos: [{ basename: 'x', size: 1, audio: { link: `https://a.animethemes.moe/${slug}-${type}${sequence}v2.ogg`, size: 9 } }] },
    { version: 1, episodes: '1-12', nsfw: false, videos: [{ basename: 'y', resolution: 1080, audio: { link: `https://a.animethemes.moe/${slug}-${type}${sequence}.ogg`, size: 9 } }] },
  ],
});
const rawAnime = (slug, anilistId) => ({
  slug, name: slug.toUpperCase(), media_format: 'TV', year: 2010,
  resources: anilistId == null ? [] : [{ site: 'AniList', external_id: anilistId }],
  animethemes: [rawTheme(slug, 'OP', 1), rawTheme(slug, 'ED', 1)],
});

const imported = (n, from = 1) => Array.from({ length: n }, (_, i) => ({
  id: `anilist_anime_${from + i}`, title: `Show ${from + i}`,
}));
const handAdded = (title) => ({ id: `p_anime_${title}`, title });
const table = (animeList) => [{ id: 'p1', animeList }];

// The API as a function of the URL. `missing` ids have no AniList link on
// AnimeThemes; titles in `searchable` are found by the title search.
function fakeApi({ missing = new Set(), searchable = new Set(), latencyMs = 0 } = {}) {
  const calls = [];
  const startedAt = [];
  const fetch = vi.fn(async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    startedAt.push(Date.now());
    let body;
    if (url.pathname === '/anime' && url.searchParams.has('filter[external_id]')) {
      const ids = url.searchParams.get('filter[external_id]').split(',').map(Number);
      body = { anime: ids.filter((id) => !missing.has(id)).map((id) => rawAnime(`show_${id}`, id)), links: { next: null } };
    } else if (url.pathname === '/anime' && url.searchParams.has('filter[anime][slug]')) {
      const slugs = url.searchParams.get('filter[anime][slug]').split(',');
      body = { anime: slugs.map((s) => rawAnime(s, null)), links: { next: null } };
    } else if (url.pathname === '/search') {
      const q = url.searchParams.get('q');
      body = { search: { anime: searchable.has(q) ? [{ slug: q.toLowerCase().replace(/\W+/g, '_'), name: q, media_format: 'TV', year: 2001 }] : [] } };
    } else {
      return new Response('not found', { status: 404 });
    }
    // A generous limit keeps the client's throttle at its 300ms floor.
    // Slow enough that sequential batches would visibly queue behind each other.
    await new Promise((r) => setTimeout(r, latencyMs));
    return new Response(JSON.stringify(body), { status: 200, headers: { 'x-ratelimit-limit': '6000' } });
  });
  return { fetch, calls, startedAt };
}

let store;
beforeEach(() => {
  store = memoryStorage();
  vi.stubGlobal('localStorage', store);
});
afterEach(() => vi.unstubAllGlobals());

describe('prepareQuestions', () => {
  it('deals a cold 120-show pool in five requests, not two per show', async () => {
    const api = fakeApi();
    vi.stubGlobal('fetch', api.fetch);
    const out = await prepareQuestions(table(imported(120)), { roundSize: 10 });

    expect(api.calls).toHaveLength(5);
    expect(api.calls.every((u) => u.pathname === '/anime')).toBe(true);
    expect(out.questions).toHaveLength(240);
    expect(out.round).toHaveLength(10);
    expect(out.unresolved).toEqual([]);
    expect(out.themeless).toEqual([]);
    // The original version's audio, not the first entry listed.
    expect(out.questions[0].audioUrl).toBe('https://a.animethemes.moe/show_1-OP1.ogg');
    expect(out.questions[0].artists).toEqual(['Band']);
  }, 15000);

  it('keeps batches in flight together, with their starts still spaced', async () => {
    // Each answer takes 1s. One after another, four batches would take ~4s;
    // overlapped, the last starts ~0.9s in and lands ~1s later.
    const api = fakeApi({ latencyMs: 1000 });
    vi.stubGlobal('fetch', api.fetch);
    const t = Date.now();
    await prepareQuestions(table(imported(100)));
    const elapsed = Date.now() - t;

    expect(api.calls).toHaveLength(4);
    expect(elapsed).toBeLessThan(3000);
    const gaps = api.startedAt.slice(1).map((at, i) => at - api.startedAt[i]);
    // The client's 300ms floor, less timer slop.
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(280);
  }, 15000);

  it('asks only for the fields AniTune reads', async () => {
    const api = fakeApi();
    vi.stubGlobal('fetch', api.fetch);
    await prepareQuestions(table(imported(1)));
    const params = api.calls[0].searchParams;
    expect(params.get('fields[audio]')).toBe('link');
    expect(params.get('fields[animetheme]')).toBe('type,slug,sequence');
  });

  it('makes no request at all on a warm cache', async () => {
    const first = fakeApi();
    vi.stubGlobal('fetch', first.fetch);
    const cold = await prepareQuestions(table(imported(5)));

    const second = fakeApi();
    vi.stubGlobal('fetch', second.fetch);
    const warm = await prepareQuestions(table(imported(5)));

    expect(second.calls).toHaveLength(0);
    expect(warm.questions.map((q) => q.id)).toEqual(cold.questions.map((q) => q.id));
  });

  it('searches an id-less show by title, then batches its themes by slug', async () => {
    const api = fakeApi({ searchable: new Set(['Cowboy Bebop', 'Trigun']) });
    vi.stubGlobal('fetch', api.fetch);
    const out = await prepareQuestions(table([handAdded('Cowboy Bebop'), handAdded('Trigun')]));

    expect(api.calls.map((u) => u.pathname)).toEqual(['/search', '/search', '/anime']);
    expect(out.questions.map((q) => q.animeTitle)).toEqual(['Cowboy Bebop', 'Cowboy Bebop', 'Trigun', 'Trigun']);
  });

  it('scopes the slug filter to the anime type', async () => {
    // A bare filter[slug] also filters the INCLUDED themes by slug, and the API
    // answers with every show and zero themes — verified live.
    const api = fakeApi({ searchable: new Set(['Trigun']) });
    vi.stubGlobal('fetch', api.fetch);
    await prepareQuestions(table([handAdded('Trigun')]));

    const slugCall = api.calls.find((u) => u.pathname === '/anime');
    expect(slugCall.searchParams.get('filter[anime][slug]')).toBe('trigun');
    expect(slugCall.searchParams.has('filter[slug]')).toBe(false);
  });

  it('falls back to the title search when AnimeThemes has no AniList link', async () => {
    const api = fakeApi({ missing: new Set([2]), searchable: new Set(['Show 2']) });
    vi.stubGlobal('fetch', api.fetch);
    const out = await prepareQuestions(table(imported(3)));

    expect(api.calls.map((u) => u.pathname)).toEqual(['/anime', '/search', '/anime']);
    expect(out.unresolved).toEqual([]);
    expect(new Set(out.questions.map((q) => q.animeTitle))).toEqual(new Set(['Show 1', 'Show 2', 'Show 3']));
  });

  it('does not repeat a title search that already came up empty', async () => {
    vi.stubGlobal('fetch', fakeApi().fetch);
    const first = await prepareQuestions(table([handAdded('Nothing Here')]));
    expect(first.unresolved.map((a) => a.title)).toEqual(['Nothing Here']);

    const again = fakeApi();
    vi.stubGlobal('fetch', again.fetch);
    const second = await prepareQuestions(table([handAdded('Nothing Here')]));
    expect(again.calls).toHaveLength(0);
    expect(second.unresolved.map((a) => a.title)).toEqual(['Nothing Here']);
  });

  it('caches nothing for a dropped request, so the next game tries again', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 404 })));
    const out = await prepareQuestions(table(imported(2)));
    expect(out.unresolved).toHaveLength(2);
    expect(JSON.parse(store.getItem('anitune_animethemes_map') ?? '{}')).toEqual({});

    const api = fakeApi();
    vi.stubGlobal('fetch', api.fetch);
    const retry = await prepareQuestions(table(imported(2)));
    expect(api.calls).toHaveLength(1);
    expect(retry.unresolved).toEqual([]);
  });

  it('deletes the oversized v2 theme cache', async () => {
    store.setItem('anitune_theme_cache_v2', JSON.stringify({ big: { themes: [], cachedAt: 0 } }));
    vi.stubGlobal('fetch', fakeApi().fetch);
    await prepareQuestions(table(imported(1)));
    expect(store.getItem('anitune_theme_cache_v2')).toBeNull();
    expect(store.getItem('anitune_theme_cache_v3')).not.toBeNull();
  });
});

describe('slimThemes', () => {
  it('keeps exactly what the pool builder reads, choosing the same audio', () => {
    const raw = rawAnime('bebop', 1).animethemes;
    const slim = slimThemes(raw);
    const resolved = { slug: 'bebop', name: 'Bebop', year: 1998 };
    const entry = { title: 'Cowboy Bebop' };

    expect(buildQuestionPool([{ entry, resolved, themes: slim, owners: [] }]))
      .toEqual(buildQuestionPool([{ entry, resolved, themes: raw, owners: [] }]));
    expect(pickAudioForTheme(slim[0]).link).toBe(pickAudioForTheme(raw[0]).link);
    expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(raw).length / 2);
  });

  it('drops a theme with no playable audio', () => {
    expect(slimThemes([{ type: 'OP', slug: 'OP1', animethemeentries: [{ videos: [{}] }] }])).toEqual([]);
    expect(slimThemes(undefined)).toEqual([]);
  });
});
