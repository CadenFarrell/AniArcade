// Achievements: lifetime milestones and a tally of every award a profile has
// been named for. The pure half — the hook that writes them
// (hooks/useAchievements.js) and the trophy page's cards
// (hub/RecordAchievements.jsx) are thin over it.
//
// Their own key, never derived from `aniarcade_history` on read, because that
// is capped at 200 lines a profile (history.js's MAX_PER_PROFILE): a count of
// games played rebuilt from it would stop at 200 forever, and an unlock that
// depended on old lines would quietly lock again. So the lifetime numbers are
// counters kept here, folded in one game at a time.
//
//   { [profileId]: {
//       name      the newest spelling, for the results card's row
//       stats     { played, won, run, bestStreak, perGame: { [game]: { played, won } },
//                   met: [folded names], bigTableWin }
//       awards    { [title]: times named } — only awards SHOWN on a final card
//       roasts    how many of those were roasts
//       unlocked  { [achievementId]: at } — sticky: never taken back
//       awardsFp / awardsAt   the last card counted, for the duplicate check
//   } }
//
// Keyed like history (the same ids, the same HistoryScopeContext: online, each
// device writes only its own player).
//
// **The milestones backfill from history; the award tallies cannot.** A profile
// met for the first time is seeded by replaying its history line by line, each
// unlock stamped with the time of the game that earned it — so the results
// card, which shows only what unlocked since it mounted, never announces a
// dozen old milestones on the first game after this shipped. Awards were never
// stored before, so they count from the day they were.

import { DUPLICATE_WINDOW_MS } from './history.js';
import { profileIdFromName } from './profileStats.js';

export const ACHIEVEMENTS_KEY = 'aniarcade_achievements';

export const PLAYED_STEPS = [1, 10, 50, 100, 250];
export const WIN_STEPS = [1, 10, 50, 100];
export const STREAK_STEPS = [3, 5, 10];
export const CREW_STEPS = [5, 10, 25];
export const COLLECT_STEPS = [10, 50];
export const ROAST_TARGET = 10;
// A win at a table this big: half a party's worth of people beaten at once.
export const BIG_TABLE = 6;
// One game won this many times earns that game's own milestone.
export const GAME_WINS = 10;

const PLAYED_TITLES = ['First game', 'Ten down', 'Game night', 'Centurion', 'Arcade fixture'];
const WIN_TITLES = ['First win', 'Contender', 'Champion', 'Legend'];
const STREAK_TITLES = ['Heating up', 'On fire', 'Untouchable'];
const CREW_TITLES = ['Squad', 'Crew', 'Party animal'];
const COLLECT_TITLES = ['Collector', 'Curator'];

/**
 * Every milestone, in the order the trophy page shows them, for the games in
 * `games` ([{ id, title }], the registry's playable ones). Each is
 * `{ id, title, detail, progress(rec) → { n, of } }`; unlocked once n ≥ of.
 *
 * "Every game" is the games there are NOW, so a game added later widens Tour and
 * Grand slam for anyone who has not got them yet — and leaves them unlocked for
 * anyone who has, since an unlock is never taken back.
 */
export function milestones(games = []) {
  const s = (rec) => rec.stats;
  const step = (prefix, steps, titles, value, detail) => steps.map((of, i) => ({
    id: `${prefix}-${of}`,
    title: titles[i],
    detail: detail(of),
    progress: (rec) => ({ n: Math.min(value(rec), of), of }),
  }));
  const everyGame = (key) => (rec) => ({
    n: games.filter((g) => (s(rec).perGame[g.id]?.[key] ?? 0) > 0).length,
    of: games.length,
  });
  return [
    ...step('played', PLAYED_STEPS, PLAYED_TITLES, (r) => s(r).played,
      (n) => (n === 1 ? 'Finish a game' : `Finish ${n} games`)),
    ...step('won', WIN_STEPS, WIN_TITLES, (r) => s(r).won,
      (n) => (n === 1 ? 'Win a game' : `Win ${n} games`)),
    ...step('streak', STREAK_STEPS, STREAK_TITLES, (r) => s(r).bestStreak,
      (n) => `Win ${n} games in a row`),
    { id: 'tour', title: 'Grand tour', detail: 'Play every game in the arcade', progress: everyGame('played') },
    { id: 'slam', title: 'Grand slam', detail: 'Win every game in the arcade', progress: everyGame('won') },
    ...step('crew', CREW_STEPS, CREW_TITLES, (r) => s(r).met.length,
      (n) => `Play with ${n} different people`),
    {
      id: 'big-table',
      title: 'Full house',
      detail: `Win at a table of ${BIG_TABLE} or more`,
      progress: (rec) => ({ n: s(rec).bigTableWin ? 1 : 0, of: 1 }),
    },
    ...step('collect', COLLECT_STEPS, COLLECT_TITLES, (r) => Object.keys(r.awards).length,
      (n) => `Earn ${n} different awards`),
    {
      id: `roasts-${ROAST_TARGET}`,
      title: 'Well done',
      detail: `Get roasted ${ROAST_TARGET} times`,
      progress: (rec) => ({ n: Math.min(rec.roasts, ROAST_TARGET), of: ROAST_TARGET }),
    },
    // One per game, last: the long tail of the page.
    ...games.map((g) => ({
      id: `ace-${g.id}`,
      title: `${g.title} ace`,
      detail: `Win ${g.title} ${GAME_WINS} times`,
      progress: (rec) => ({ n: Math.min(s(rec).perGame[g.id]?.won ?? 0, GAME_WINS), of: GAME_WINS }),
    })),
  ];
}

export function emptyRecord(name = '') {
  return {
    name,
    stats: { played: 0, won: 0, run: 0, bestStreak: 0, perGame: {}, met: [], bigTableWin: false },
    awards: {},
    roasts: 0,
    unlocked: {},
    awardsFp: '',
    awardsAt: 0,
  };
}

const count = (n) => (Number.isInteger(n) && n > 0 ? n : 0);
const isMap = (x) => x && typeof x === 'object' && !Array.isArray(x);

// Repairs whatever is stored, on every read, like normalizeHistory: a bad
// field costs that field, never the record or the hub.
export function normalizeAchievements(raw) {
  if (!isMap(raw)) return {};
  const out = {};
  for (const [id, r] of Object.entries(raw)) {
    if (!isMap(r)) continue;
    const st = isMap(r.stats) ? r.stats : {};
    const perGame = {};
    for (const [g, v] of Object.entries(isMap(st.perGame) ? st.perGame : {})) {
      if (isMap(v)) perGame[g] = { played: count(v.played), won: count(v.won) };
    }
    const awards = {};
    for (const [t, n] of Object.entries(isMap(r.awards) ? r.awards : {})) {
      if (count(n)) awards[t] = n;
    }
    const unlocked = {};
    for (const [a, at] of Object.entries(isMap(r.unlocked) ? r.unlocked : {})) {
      if (typeof at === 'number' && Number.isFinite(at)) unlocked[a] = at;
    }
    out[id] = {
      name: typeof r.name === 'string' ? r.name : '',
      stats: {
        played: count(st.played),
        won: count(st.won),
        run: count(st.run),
        bestStreak: count(st.bestStreak),
        perGame,
        met: Array.isArray(st.met) ? [...new Set(st.met.filter((k) => typeof k === 'string' && k))] : [],
        bigTableWin: st.bigTableWin === true,
      },
      awards,
      roasts: count(r.roasts),
      unlocked,
      awardsFp: typeof r.awardsFp === 'string' ? r.awardsFp : '',
      awardsAt: typeof r.awardsAt === 'number' && Number.isFinite(r.awardsAt) ? r.awardsAt : 0,
    };
  }
  return out;
}

/**
 * Folds one history line (history.js's entry shape) into the counters. The
 * streak follows recordDetail's rule: a table of one is never a win, so it
 * neither extends nor breaks a run.
 */
export function applyGame(rec, entry) {
  const st = rec.stats;
  const g = st.perGame[entry.game] ?? { played: 0, won: 0 };
  const met = new Set(st.met);
  for (const name of entry.with ?? []) {
    const key = profileIdFromName(name);
    if (key) met.add(key);
  }
  const run = entry.size >= 2 ? (entry.won ? st.run + 1 : 0) : st.run;
  return {
    ...rec,
    stats: {
      played: st.played + 1,
      won: st.won + (entry.won ? 1 : 0),
      run,
      bestStreak: Math.max(st.bestStreak, run),
      perGame: { ...st.perGame, [entry.game]: { played: g.played + 1, won: g.won + (entry.won ? 1 : 0) } },
      met: [...met],
      bigTableWin: st.bigTableWin || (entry.won && entry.size >= BIG_TABLE),
    },
  };
}

/**
 * Stamps every milestone `rec` has newly reached with `at`. Returns the new
 * record and the ids it unlocked, in milestone order.
 */
export function evaluate(rec, games, at) {
  const fresh = [];
  for (const m of milestones(games)) {
    if (rec.unlocked[m.id] != null) continue;
    const { n, of } = m.progress(rec);
    if (n >= of) fresh.push(m.id);
  }
  if (!fresh.length) return { rec, fresh };
  return { rec: { ...rec, unlocked: { ...rec.unlocked, ...Object.fromEntries(fresh.map((id) => [id, at])) } }, fresh };
}

/**
 * A profile's record rebuilt from its history, unlocks dated by the game that
 * reached them — the backfill. Lines older than the 200-line cap are gone, so a
 * long-time player starts a little short; it never over-counts.
 */
export function seedFromHistory(entries = [], name = '', games = []) {
  let rec = emptyRecord(name);
  for (const e of entries) rec = evaluate(applyGame(rec, e), games, e.at).rec;
  return rec;
}

/**
 * The card's identity: the same awards to the same people with the same
 * details is a remount of one results screen (a refresh), not a second game —
 * the details quote characters and bets, so two real games would not match.
 */
export function awardsFingerprint(shown = []) {
  return JSON.stringify(shown.map((a) => [a.title, a.player?.id ?? a.player?.name ?? '', a.detail ?? '']));
}

/**
 * Adds the awards one profile was named for on a card. Returns null when this
 * card was already counted for them within history.js's duplicate window.
 */
export function applyAwards(rec, mine, fp, at) {
  if (rec.awardsFp === fp && at - rec.awardsAt < DUPLICATE_WINDOW_MS) return null;
  const awards = { ...rec.awards };
  for (const a of mine) awards[a.title] = (awards[a.title] ?? 0) + 1;
  return {
    ...rec,
    awards,
    roasts: rec.roasts + mine.filter((a) => a.roast).length,
    awardsFp: fp,
    awardsAt: at,
  };
}

/**
 * One profile's achievements for the trophy page: every milestone with its
 * progress and unlock time, and the award collection by game in `games` order
 * ([{ id, title, accent, awards: { good, roasts } }]).
 */
export function achievementView(rec, games = []) {
  const r = rec ?? emptyRecord();
  const list = milestones(games).map((m) => ({
    id: m.id,
    title: m.title,
    detail: m.detail,
    ...m.progress(r),
    at: r.unlocked[m.id] ?? null,
  }));
  const collection = games.map((g) => {
    const row = (title, roast) => ({ title, roast, n: r.awards[title] ?? 0 });
    return {
      id: g.id,
      awards: [...(g.awards?.good ?? []).map((t) => row(t, false)), ...(g.awards?.roasts ?? []).map((t) => row(t, true))],
    };
  });
  const titles = collection.flatMap((g) => g.awards);
  return {
    milestones: list,
    unlockedCount: list.filter((m) => m.at != null).length,
    collection,
    collected: titles.filter((a) => a.n > 0).length,
    totalAwards: titles.length,
  };
}
