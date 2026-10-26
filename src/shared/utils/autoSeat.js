// Who a local setup screen seats before anyone touches it. The pure half —
// hooks/useAutoSeat.js reads storage and the profile store and hands it here.
//
// Only the games that cannot start with one player call this (AniGuess, AniTag,
// AniFake, AniWave, AniTurf). AniRank, AniTune and AniQuiz play solo, so seating
// the couch for them would be a guess at who is playing, and a wrong guess there
// costs a Remove tap on every visit.
//
// The order of preference:
//
//   1. the table this device last STARTED this game with — the couch you are on
//      is usually the couch you were on, and a game night replays one game;
//   2. failing that, enough people to reach the game's minimum, picked by who the
//      main profile most recently played with (play history), then the profile
//      picker's own order.
//
// Never more than the device holds: with one profile this is just [active], as
// it always was.

import { profileIdFromName, summarizeProfiles } from './profileStats.js';

// { [gameId]: profileId[] }, seat order. A convenience that rebuilds itself on
// the next Start, so it is not in resetKeys.js's PRESERVED_KEYS.
export const LAST_TABLES_KEY = 'aniarcade_last_tables';

// Repairs whatever is stored, the way normalizeHistory does: a hand-edited or
// half-written value costs that game its remembered table, never the screen.
export function normalizeLastTables(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [game, ids] of Object.entries(raw)) {
    if (!Array.isArray(ids)) continue;
    const clean = [...new Set(ids.filter((id) => typeof id === 'string' && id !== ''))];
    if (clean.length) out[game] = clean;
  }
  return out;
}

export const rememberedIds = (players = []) => players.map((p) => p.id);

/**
 * Everyone but the main profile, best companion first. `history` is the main
 * profile's own lines (newest last). A line names the others rather than
 * holding their ids — so it still reads right after a profile is deleted — and
 * a profile id IS the folded name, so folding a name finds the profile. Names
 * that fold to nobody on this device (an online opponent) are skipped.
 */
export function rankCompanions({ profiles = {}, activeId = null, history = [] }) {
  const ranked = [];
  const seen = new Set([activeId]);
  const take = (id) => {
    if (seen.has(id) || !profiles[id]) return;
    seen.add(id);
    ranked.push(id);
  };
  for (let i = history.length - 1; i >= 0; i -= 1) {
    for (const name of history[i]?.with ?? []) take(profileIdFromName(name));
  }
  // The picker's order (most recently used, then by name), so a device with no
  // history yet seats whoever the picker would have listed first anyway.
  for (const row of summarizeProfiles(profiles, activeId)) take(row.id);
  return ranked;
}

/**
 * The seated profiles, in seat order: the main profile first, then the last
 * table (whoever of it still exists), then companions until `min` is reached.
 * No main profile means nobody — the screen's "Nobody seated yet" note explains
 * how to set one, and seating somebody else would make them "You".
 */
export function autoSeat({ profiles = {}, activeId = null, lastTable = [], history = [], min = 1 }) {
  const active = activeId ? profiles[activeId] : null;
  if (!active) return [];
  const ids = [activeId];
  for (const id of lastTable) {
    if (profiles[id] && !ids.includes(id)) ids.push(id);
  }
  if (ids.length < min) {
    for (const id of rankCompanions({ profiles, activeId, history })) {
      if (ids.length >= min) break;
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids.map((id) => profiles[id]);
}
