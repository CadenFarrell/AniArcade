// A canned AnimeThemes API, so AniTune can be played by bots with no network.
//
// Answers the routes animethemesClient.js calls, in the shapes it reads:
//
//   /search?q=…                          → { search: { anime: [{ slug, name, media_format, year }] } }
//   /anime?filter[external_id]=…         → { anime: [], links: { next: null } }  (fixture
//                                          ids are not AniList's, so the AniList batch
//                                          always misses and the title search does the
//                                          work — the hand-entered path)
//   /anime?filter[anime][slug]=a,b&…     → { anime: [{ slug, name, animethemes: [...] }], links }
//
// Shared by both layers: the jsdom runner's fetch stub calls `respondAnimeThemes`,
// and Playwright's page.route calls `animethemesJson` and fulfils with it. The
// audio links point at AUDIO_HOST, which jsdom's media stub never loads and the
// browser layer routes to a silent WAV.
//
// Deterministic by title, not random: the same show always resolves the same
// way, so a seed replays. A few titles are deliberately broken — one in eleven
// has no search hit, one in nine has no themes — because "some of your shows
// have no music" is a real setup-screen state the bots should pass through.

export const API_HOST = 'api.animethemes.moe';
export const AUDIO_HOST = 'a.animethemes.moe';

export const isAnimeThemes = (url) => url.includes(API_HOST);
export const isThemeAudio = (url) => url.includes(AUDIO_HOST);

const hash = (s) => [...s].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0), 2166136261);
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'untitled';
// slugs round-trip back to a display name for the slug list route.
const nameFor = new Map();

function theme(slug, type, sequence, i) {
  return {
    slug: `${type}${sequence}`,
    type,
    sequence,
    song: { title: `${type === 'OP' ? 'Opening' : 'Ending'} ${sequence} of ${slug}`, artists: i % 3 ? [{ name: `Band ${hash(slug) % 97}` }] : [] },
    animethemeentries: [{
      version: 1,
      videos: [{ audio: { link: `https://${AUDIO_HOST}/${slug}-${type}${sequence}.ogg` } }],
    }],
  };
}

function animeRecord(slug) {
  const h = hash(slug);
  const themes = h % 9 === 0 ? [] : [
    theme(slug, 'OP', 1, h), theme(slug, 'ED', 1, h + 1),
    ...(h % 2 ? [theme(slug, 'OP', 2, h + 2)] : []),
  ];
  return { slug, name: nameFor.get(slug) ?? slug, animethemes: themes };
}

export function animethemesJson(rawUrl) {
  const url = new URL(rawUrl);
  if (url.pathname === '/search') {
    const q = url.searchParams.get('q') ?? '';
    if (hash(q) % 11 === 0) return { search: { anime: [] } };
    const slug = slugify(q);
    nameFor.set(slug, q);
    return {
      search: {
        anime: [
          // A decoy ranked first, the way the real API puts a spin-off ahead of
          // the series — scoreCandidate is meant to see past it.
          { slug: `${slug}_movie`, name: `${q} Movie`, media_format: 'Movie', year: 2010 },
          { slug, name: q, media_format: 'TV', year: 2000 + (hash(q) % 24) },
        ],
      },
    };
  }
  if (url.pathname === '/anime') {
    const slugs = url.searchParams.get('filter[anime][slug]');
    // Anything else on this route is the AniList-id batch, which never matches.
    if (!slugs) return { anime: [], links: { next: null } };
    return { anime: slugs.split(',').map(animeRecord), links: { next: null } };
  }
  return null;
}

export function respondAnimeThemes(rawUrl) {
  const json = animethemesJson(rawUrl);
  return json
    ? new Response(JSON.stringify(json), { status: 200, headers: { 'content-type': 'application/json', 'x-ratelimit-limit': '600' } })
    : new Response('not found', { status: 404 });
}
