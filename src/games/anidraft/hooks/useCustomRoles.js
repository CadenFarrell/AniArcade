import { useCallback, useState } from 'react';
import { storage } from '../../../shared/services/storage';
import { normalizeCustomRole } from '../roles';

// The roles a player has written, kept on this device. A port of AniTag's
// useCustomCategories (itself from AniWave's useCustomSpectra and AniRank's
// useCustomPrompts): one key holding the whole list, every read normalized so
// an entry an older build saved is repaired without a migration flag, and
// nothing touching localStorage except shared/services.
//
// Per-game key, the `<game>_*` convention for anything not shared across the
// arcade. Only the host's list is ever dealt (a game copies it in at Start —
// see roles.js, "Written roles"), so a guest's list stays on their phone.
const ROLES_KEY = 'anidraft_custom_roles';

function load() {
  const raw = storage.getItem(ROLES_KEY);
  if (!Array.isArray(raw)) return [];
  // A nameless entry is dropped here, which is the repair; the next write
  // persists it. Duplicate ids keep the first, so an edit cannot fork a role.
  const seen = new Set();
  return raw.map(normalizeCustomRole).filter((r) => r && !seen.has(r.id) && seen.add(r.id));
}

/**
 * { roles, saveRole, deleteRole } over that key.
 *
 * Not a context provider, for the reason useCustomPrompts documents: its
 * consumers — the setup screen and the online lobby — are never mounted at the
 * same time, so there is no second live copy to drift.
 */
export function useCustomRoles() {
  const [roles, setRoles] = useState(load);

  // Upsert by id, so the editor's save is the same whether it creates or
  // edits. Returns the stored shape, which normalize may have changed.
  const saveRole = useCallback((draft) => {
    const saved = normalizeCustomRole(draft);
    if (!saved) return null;
    setRoles((prev) => {
      const i = prev.findIndex((r) => r.id === saved.id);
      const next = i >= 0 ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved];
      // Inside the updater, so what persists is the same array React commits.
      storage.setItem(ROLES_KEY, next);
      return next;
    });
    return saved;
  }, []);

  const deleteRole = useCallback((id) => {
    setRoles((prev) => {
      const next = prev.filter((r) => r.id !== id);
      storage.setItem(ROLES_KEY, next);
      return next;
    });
  }, []);

  return { roles, saveRole, deleteRole };
}
