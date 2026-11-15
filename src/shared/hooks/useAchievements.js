import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { games as registry } from '../../hub/registry';
import { useHistoryScope } from '../context/historyScopeContext';
import { storage } from '../services/storage';
import {
  ACHIEVEMENTS_KEY, applyAwards, applyGame, awardsFingerprint, evaluate, milestones,
  normalizeAchievements, seedFromHistory,
} from '../utils/achievements';
import { HISTORY_KEY, normalizeHistory } from '../utils/history';

// Storage, plus a version every write bumps so the results screen's "Unlocked"
// card can hear a write made after it mounted: the writes happen in effects
// (useRecordResult's, Awards' own), and a parent's effect runs after its
// children's, so a card that read once on mount would always read too early.
//
// The registry is imported for its list of games (Tour, Grand slam, each
// game's ace). It is the menu, already in the hub's startup bundle, and its
// descriptors import no game code (lazyGame), so this pulls nothing new in.

let version = 0;
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
// The stored map as of the latest write, read once per write rather than per
// render — an online results screen re-renders on every presence tick.
let cache = { version: -1, map: {} };
const getSnapshot = () => {
  if (cache.version !== version) cache = { version, map: readAchievements() };
  return cache.map;
};

const playable = () => registry.filter((g) => g.available).map((g) => ({ id: g.id, title: g.title }));

export function readAchievements() {
  return normalizeAchievements(storage.getItem(ACHIEVEMENTS_KEY));
}

function write(map) {
  storage.setItem(ACHIEVEMENTS_KEY, map);
  version += 1;
  for (const fn of listeners) fn();
}

// A profile met for the first time is seeded from its history BEFORE this
// game is counted, every unlock dated by the old game that earned it — so none
// of them land on the results card as if they were new. `historyLines` must
// not include the game being recorded.
function recordOf(map, id, name, historyLines) {
  return map[id] ?? seedFromHistory(historyLines ?? [], name, playable());
}

/**
 * Folds one finished game into each recorded profile's achievements. Called by
 * useRecordResult's recordGame with the lines it ACTUALLY added (a duplicate
 * the history dropped is no game here either), the history from before, and
 * each player's name by id.
 */
export function recordGameAchievements(added, historyBefore, names = {}, at = Date.now()) {
  const ids = Object.keys(added);
  if (!ids.length) return;
  const map = readAchievements();
  const games = playable();
  for (const id of ids) {
    const entry = added[id];
    const name = names[id] ?? map[id]?.name ?? '';
    const rec = { ...applyGame(recordOf(map, id, name, historyBefore[id]), entry), ...(name ? { name } : {}) };
    map[id] = evaluate(rec, games, at).rec;
  }
  write(map);
}

/**
 * Counts the awards a final card SHOWED, once per mount, for the profiles this
 * device records (HistoryScopeContext: online, only its own player). `shown`
 * is pickAwards' list. History is read only to seed a profile with no record
 * yet.
 */
export function useRecordAwards(shown) {
  const scope = useHistoryScope();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !shown.length) return;
    done.current = true;
    const mine = (id) => shown.filter((a) => (a.player?.id ?? null) === id);
    const ids = [...new Set(shown.map((a) => a.player?.id).filter(Boolean))]
      .filter((id) => !scope || id === scope.onlyId);
    if (!ids.length) return;
    const fp = awardsFingerprint(shown);
    const at = Date.now();
    const map = readAchievements();
    const games = playable();
    let history = null;
    let changed = false;
    for (const id of ids) {
      const name = mine(id)[0].player.name ?? '';
      if (!map[id]) history ??= normalizeHistory(storage.getItem(HISTORY_KEY));
      const next = applyAwards(recordOf(map, id, name, history?.[id]), mine(id), fp, at);
      if (!next) continue;
      map[id] = evaluate({ ...next, ...(name ? { name } : {}) }, games, at).rec;
      changed = true;
    }
    if (changed) write(map);
  });
}

/**
 * Every unlock stamped since this component mounted, newest write included:
 * `[{ id, name, achievementId, title, detail, at }]` in unlock order. For the
 * results card.
 */
export function useFreshUnlocks() {
  const [since] = useState(() => Date.now());
  const map = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => {
    const byId = new Map(milestones(playable()).map((m) => [m.id, m]));
    const out = [];
    for (const [id, rec] of Object.entries(map)) {
      for (const [achievementId, at] of Object.entries(rec.unlocked)) {
        const m = byId.get(achievementId);
        if (m && at >= since) out.push({ id, name: rec.name, achievementId, title: m.title, detail: m.detail, at });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }, [map, since]);
}
