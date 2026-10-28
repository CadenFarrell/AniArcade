import { AXES, DEFAULT_AXIS_ID, getAxis } from './axes';
import { DEFAULT_MATCH_ROUNDS } from './rules';

// Every option AniRank remembers between sessions, at its literal default.
// One module rather than a literal in each screen — AniRankSetup and OnlineLobby
// offer an identical set and both import this. It doubles as the schema
// useGamePrefs validates a saved blob against.
//
// `blind` was left out of this list at first, on the theory that it is not an
// independent preference: each axis carries a defaultBlind and picking an axis
// resets to it. That confused the only thing it could — it is the middle of three
// checkboxes in the settings card, under a line promising the card is remembered,
// and it alone came back changed. Worse, being absent from `remembered` meant
// toggling just it showed no reset link either, so the whole game read as "AniRank
// doesn't save".
//
// The axis-change reset is a separate mechanism and survives intact: it fires on
// *interaction* (handleAxisChange), so it still stops "open" riding from an
// opinion round into a fact one. Restoring a saved pair at mount is not that case
// — the pair being restored is one the player actually started a game with.
export const DEFAULT_PREFS = {
  sharedOnly: true,
  scoring: true,
  axisId: DEFAULT_AXIS_ID,
  // Which of AniRank's two halves the Start button opens: a scored round of ten
  // ('round'), or the tier-list builder over the whole list ('tiers' for S–D
  // rows, 'ranked' for a strict 1..N).
  //
  // mergePrefs backfills a missing key from these defaults on the next read, so
  // adding this changed behaviour for everyone who has ever opened the settings
  // card — deliberately to nothing at all, because 'round' IS what they had.
  // Any other default here would have silently moved every existing player into
  // a mode they never chose.
  format: 'round',
  // Derived, never a literal: "the default deal" means whatever the default axis
  // deals. Hard-coding it here would silently diverge the first time an axis's
  // defaultBlind is retuned.
  blind: getAxis(DEFAULT_AXIS_ID).defaultBlind,
  // A match of this many rounds, then the final scoreboard; 0 is the old
  // endless "New ten" (rules.DEFAULT_MATCH_ROUNDS).
  rounds: DEFAULT_MATCH_ROUNDS,
  // One device, blind rounds: 'seat' has each player place their whole board
  // and then pass the device on; 'card' passes it after every card so the
  // table sees each card together. Seat by default — one handoff a player
  // rather than ten (rules.isSeatPace).
  pace: 'seat',
};

export const PACES = [
  { id: 'seat', label: 'Whole board each', blurb: 'Each player places all ten, then passes the device on.' },
  { id: 'card', label: 'Card by card', blurb: 'Everyone places each card before the next is shown — the device goes round every card.' },
];

/**
 * The saved axis id turned back into an axis *spec* — a string for a built-in,
 * the stored prompt object for one the player wrote (see getAxis).
 *
 * The id is what gets saved, deliberately, rather than the spec: persisting a
 * custom prompt's object would freeze a copy of something useCustomPrompts can
 * later edit or delete, and the board would then run a prompt whose text no
 * longer exists anywhere the player can see.
 *
 * Falling back matters more than it looks. getAxis never returns undefined — an
 * unknown id quietly resolves to DEFAULT_AXIS_ID — so without this check a saved
 * id pointing at a since-deleted prompt would play as "best" while AxisPicker
 * showed nothing selected at all.
 */
export function resolveSavedAxis(axisId, prompts) {
  if (AXES.some((a) => a.id === axisId)) return axisId;
  return prompts?.find((p) => p.id === axisId) ?? DEFAULT_AXIS_ID;
}

// The inverse, for the save at Start: a spec is either the id itself or an
// object carrying one.
export function axisIdOf(spec) {
  return typeof spec === 'string' ? spec : spec?.id ?? DEFAULT_AXIS_ID;
}
