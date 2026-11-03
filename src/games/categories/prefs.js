import { CATEGORY_SOURCES } from './rules';

// Every option AniTag remembers between sessions, at its literal default. One
// module rather than a literal in each screen — AniTagSetup and OnlineLobby
// offer overlapping sets and both import this — and it doubles as the schema
// useGamePrefs validates a saved blob against (see shared/utils/gamePrefs.js).
//
// THIS GAME NEEDS NO ANILIST IMPORT, AND NOTHING HERE MAY QUIETLY CHANGE THAT.
// A proposal is free text judged by a person, so no pool is ever drawn from
// anybody's list — which makes AniTag the second game in the arcade (after
// AniWave's default clue mode) that a brand-new player can open and play. There
// is deliberately no `sharedOnly`, no card pool and no minimum list size in this
// file, and adding one would be adding the requirement itself. AniWave's prefs.js
// carries the same warning about `clueMode`; decide it out loud rather than
// discover it.
//
// `categoryPool` is NOT that requirement sneaking back in. It picks which
// built-in clauses get dealt — ones about shows, or ones about characters — and
// both lists ship in categories.js. It reaches nobody's profile.
export const DEFAULT_PREFS = {
  rounds: 3,
  // 'table' | 'random' — where each player's hidden category comes from.
  // Copied onto the round node, because rules.js ACTS on it (startRound opens a
  // `picking` phase for one and not the other), which is CLAUDE.md's stated
  // test for which prefs reach round state.
  //
  // A NEW KEY RATHER THAN A RETYPED `categoryMode`, on purpose. The old key
  // chose between this game and "pick your own", which is gone; a saved
  // `categoryMode` is now an unknown key that mergePrefs drops on the next
  // read, so everyone lands on the table pick without a stale value meaning
  // something it no longer does. rules.js's own fallback is the opposite
  // ('random'), which is not a contradiction — see toSource there.
  categorySource: 'table',
  // Names per player, per ROUND — spent one at a time, because the seat moves
  // after every single name. Copied onto the round node, unlike everything else
  // here, because rules.js ACTS on it (see settlePending and proposalsUsed),
  // which is CLAUDE.md's stated test for which prefs reach round state. A
  // mid-session change would otherwise re-cap a round already half-spent.
  //
  // It is not simply "how long your turn is" any more: a missed declaration is
  // charged against it at WRONG_DECLARATION_COST, so the cap is also the price
  // list for guessing early.
  proposalCap: 10,
  // 'shows' | 'characters'. One pool per session, not one per player: the hot
  // seat cannot see their clause, so the prompt telling them what to name is the
  // only thing that says which pool it is about, and a per-player pool would
  // turn that prompt into a clue. See the note on CATEGORIES.
  categoryPool: 'characters',
  // Whether the player's own written categories are in play. When the table
  // picks, they head the list of suggestions on this device and can come up
  // from "Deal one at random"; in a random deal they join the built-ins. On by
  // default: somebody who has written one wrote it to play it, and a table with
  // none is unaffected either way.
  useCustom: true,
};

// Where a session's clauses come from, in the order the screens render them.
// Defined in rules.js, which acts on it, and re-exported here beside the other
// option lists so a screen cannot invent a third.
export { CATEGORY_SOURCES };

// What each source is called on screen, and the one line that says how it
// differs. Both blurbs say the same second half on purpose: once the round
// starts the game is identical, and that is the thing a player coming from the
// removed "pick your own" needs to read.
export const SOURCE_LABELS = {
  table: {
    label: 'The table picks',
    blurb: 'Everyone else picks your category while you look away. One judge answers, and you work out your own.',
  },
  random: {
    label: 'Dealt at random',
    blurb: 'You are handed a random category you cannot see. One judge answers, and you work out your own.',
  },
};

// Bounds for the round-count field. A session of one is a legitimate warm-up;
// the upper bound only exists to stop a typo producing a game the leaderboard
// cannot show.
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 20;

// The pools a session can draw from, in the order the setup screen renders
// them. Exported so a screen cannot invent a third that categories.js has never
// heard of.
export const CATEGORY_POOLS = ['characters', 'shows'];

// What each pool is called on screen, and what a turn in it asks you to name.
// `noun` is singular because it lands in "Name a character" — the prompt the
// hot seat spends the whole turn looking at.
export const POOL_LABELS = {
  characters: { label: 'Characters', noun: 'character', plural: 'characters' },
  shows: { label: 'Shows', noun: 'show', plural: 'shows' },
};
