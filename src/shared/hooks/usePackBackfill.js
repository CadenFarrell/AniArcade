import { useEffect, useRef } from 'react';
import { loadFactPack } from '../services/factPack';
import { useProfileStore } from '../context/profileContext';
import { backfillProfileFromPack } from '../utils/packStats';

// Profile ids already repaired this session. Module-level, so the pass runs
// once per profile per page load however many setup screens and lobbies mount —
// a repaired profile stays repaired, since the result is saved.
const repaired = new Set();

/**
 * Fills the stats an old profile is missing from the fact pack, and saves them.
 * See packStats.js for what is filled and why it is a repair rather than a
 * guess.
 *
 * Called from the screens of the games that READ those stats (AniRank, AniTune,
 * AniFake), never from the hub: the pack is a few hundred KB, and a player who
 * only ever opens AniTag should never fetch it.
 *
 * Every saved profile, not just yours, because local play seats the whole couch.
 * Writes go through useProfileStore, never useProfile directly — the provider
 * is the only thing that re-renders the other screens holding a profile, and
 * its profilesRef is what keeps two writes in one pass from clobbering each
 * other.
 *
 * `onRepaired(profile)` is for a screen that seated COPIES of profiles in its
 * own state (every local setup screen does), so its roster picks up the repair
 * the way it picks up an import. An online lobby needs no callback: the store
 * update moves profileFingerprint, and useRepublishProfile carries it into the
 * room.
 */
export function usePackBackfill(onRepaired) {
  const { profiles, saveProfile } = useProfileStore();
  // Latest values for the async pass below, which must not restart (and
  // re-fetch) every time the map or a caller's inline callback changes.
  const profilesRef = useRef(profiles);
  const onRepairedRef = useRef(onRepaired);
  useEffect(() => {
    profilesRef.current = profiles;
    onRepairedRef.current = onRepaired;
  });

  useEffect(() => {
    let live = true;
    loadFactPack().then((pack) => {
      // Resolves null on a failed load (see loadFactPack), and a failed load
      // costs nothing here: the profile just keeps the gaps it already had.
      if (!live || !pack) return;
      for (const profile of Object.values(profilesRef.current ?? {})) {
        if (!profile?.id || repaired.has(profile.id)) continue;
        repaired.add(profile.id);
        const { profile: next, changed } = backfillProfileFromPack(profile, pack);
        if (!changed) continue;
        saveProfile(next);
        onRepairedRef.current?.(next);
      }
    });
    return () => { live = false; };
  }, [saveProfile]);
}
