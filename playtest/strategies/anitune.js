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
    // One device only (online ignores them), and the hint ladder.
    localRace: ['buzz', 'shout'],
    localEntry: ['private', 'aloud'],
    hints: [false, true],
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

    // Shout it: a claimed song is checked by the table, right about half the time.
    const right = find(snap, /^right$/i);
    const wrong = find(snap, /^wrong$/i);
    if (right && wrong) return click(rng.chance(0.5) ? right : wrong, 'check the shouted answer');
    const first = findAll(snap, / said it first$/i);
    if (first.length) return click(rng.pick(first), 'who said it first');
    const someone = find(snap, /^someone got it$/i);
    if (someone && rng.chance(0.35)) return click(someone, 'someone got it');

    // Out loud: show the answer, then tick a few (or nobody).
    const show = find(snap, /^show the answer$/i);
    if (show && rng.chance(0.4)) return click(show, 'show the answer');
    const ticks = findAll(snap, / got it$/i).filter((c) => c.role === 'button' && !/^(nobody|someone)/i.test(c.name));
    if (ticks.length) {
      const done = find(snap, /^done$/i);
      const pressed = ticks.filter((c) => c.pressed);
      if (!pressed.length && rng.chance(0.25)) return click(find(snap, /^nobody got it$/i), 'nobody got it');
      const unpressed = ticks.filter((c) => !c.pressed);
      if (unpressed.length && (!pressed.length || rng.chance(0.4))) return click(rng.pick(unpressed), 'tick who got it');
      if (done && !done.disabled) return click(done, 'done ticking');
    }

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
