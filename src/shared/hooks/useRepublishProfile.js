import { useEffect, useRef } from 'react';
import { useProfileStore } from '../context/profileContext';
import { profileFingerprint } from '../utils/profileStats';

// Keeps your seat in the room in step with your profile, for every lobby whose
// pool is computed from the copies of everyone's lists sitting in the room.
//
// The profile store is the source of truth; the room's copy of you is derived
// from it, and `updateMyProfile` is the ONLY channel between the two —
// saveProfile writes localStorage and the provider and nothing else. Without
// this an import done anywhere but a lobby's own button (the hub's ListManager,
// another tab) never reaches Firebase, and rejoining to refresh stops working
// the moment the host starts and `open` flips false.
//
// Scoped by rendering: it runs only while a lobby is mounted, which is only
// pre-start, so there is no separate "is the room still open" check to keep in
// sync.
//
// Comparing the two fingerprints rather than tracking "did I push yet" makes
// this self-correcting and silent on join, when the copies already agree. The
// ref is still needed on top: `room` is a fresh object every render, so
// without it the effect would re-fire and re-write for the whole round trip
// between the transaction and the snapshot coming back.
//
// Every lobby calls it, AniTag's included: AniTag reads nobody's list, but the
// face each phone draws for you is read from your copy in the room, so a
// character chosen in the lobby (portraitKey, which the fingerprint counts)
// has to travel the same way an import does.
export function useRepublishProfile(room, me) {
  const { activeProfile } = useProfileStore();
  const lastPushedRef = useRef(null);
  useEffect(() => {
    // Only your own seat. Switching to a different profile mid-room must not
    // republish over the seat you claimed — claims/{playerId} is per-seat, and
    // the roster would silently change name and list under everyone else.
    if (!me || !activeProfile || activeProfile.id !== room.myPlayerId) return;
    const mine = profileFingerprint(activeProfile);
    if (mine === profileFingerprint(me) || mine === lastPushedRef.current) return;
    lastPushedRef.current = mine;
    room.updateMyProfile(activeProfile);
  }, [activeProfile, me, room]);
}
