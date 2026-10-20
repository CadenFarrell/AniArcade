// AniTune: name the anime from a clip of its opening or ending. Runs against
// fakes/animethemes.js (canned API) and fakes/media.js (an audio element whose
// clock is the fake clock), so a ten-second clip is ten seconds of fake time.
//
// Two ways in, alternating by seed: a cold start that resolves every show
// through the (fake) API at its real 750ms throttle — the "Preparing…" screen
// the bot waits out — and a warm one with both of AniTune's caches already
// filled, which is what every later game on a device looks like.
import { makeStrategy } from './base.js';
import { find, findAll, click, fill, wait, has } from '../core/generic.js';
import { animethemesJson } from '../fakes/animethemes.js';

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export default makeStrategy({
  players: [1, 4],
  axes: {
    mode: ['race', 'simultaneous', 'lives'],
    roundSize: [3, 5],
    timed: [true, false],
    guessSeconds: [10, 20],
    playbackRate: [1, 1.5],
    samplePoint: ['random', 'start', 'middle'],
    sharedSongsOnly: [true, false],
    includeEndings: [true, false],
    popularity: ['any', 'known', 'popular'],
  },
  // Pre-fills resolveAnime's and buildQuestions' caches the way a finished
  // first game leaves them, from the same canned API the cold path calls.
  seedStorage(storage, scenario, profiles) {
    if (scenario.seed % 2) return;
    const map = {};
    const themes = {};
    for (const p of profiles) {
      for (const a of p.animeList) {
        const hit = animethemesJson(`https://api.animethemes.moe/search?q=${encodeURIComponent(a.title)}`)?.search?.anime?.[1];
        if (!hit) { map[`title:${norm(a.title)}`] = null; continue; }
        map[`title:${norm(a.title)}`] = { slug: hit.slug, name: hit.name, mediaFormat: hit.media_format, year: hit.year, matchType: 'exact', confidence: 1 };
        const anime = animethemesJson(`https://api.animethemes.moe/anime/${hit.slug}`)?.anime;
        themes[hit.slug] = { themes: anime?.animethemes ?? [], cachedAt: Date.now() };
      }
    }
    storage.setItem('anitune_animethemes_map', JSON.stringify(map));
    storage.setItem('anitune_theme_cache_v2', JSON.stringify(themes));
  },
  act(snap, ctx) {
    const { rng, scenario } = ctx;
    const resume = find(snap, /resume/i);
    if (resume && has(snap, /saved game|resume/i)) return click(rng.chance(0.7) ? resume : find(snap, /start fresh|discard|new game/i) ?? resume, 'saved game');

    // Fetching (fake) themes at the real throttle.
    if (has(snap, /preparing/i)) return wait(2000, 'wait for questions');
    if (has(snap, /loading clip/i)) return wait(300, 'wait for the clip');

    const play = find(snap, /^play clip$/i);
    if (play) return click(play, 'play the clip');

    // An answer box: a show off somebody's list (a suggestion when offered,
    // which is right about as often as a real table is), or a random word.
    const box = find(snap, /which anime is this/i);
    if (box) {
      const lock = find(snap, /^lock it in/i);
      if (box.value && lock) return click(lock, 'lock in answer');
      const options = snap.controls.filter((c) => c.role === 'option' && !c.disabled);
      if (options.length) return click(rng.pick(options), 'pick a suggestion');
      if (scenario.prefs.timed && rng.chance(0.06)) return wait(scenario.prefs.guessSeconds * 1000 + 1000, 'let the clock run out');
      return fill(box, rng.chance(0.7) ? rng.pick(['a', 'the', 'o', 'ka']) : rng.word(), 'type an answer');
    }

    // Race mode: someone buzzes. Waiting a while first lets the clip play.
    const buzz = findAll(snap, /^buzz /i);
    if (buzz.length) {
      if (rng.chance(0.25)) return wait(rng.int(1000, 6000), 'listen a little longer');
      return click(rng.pick(buzz), 'buzz in');
    }
    return null;
  },
});
