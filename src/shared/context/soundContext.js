import { createContext, useContext } from 'react';

// Split from SoundProvider.jsx for the reason profileContext.js gives —
// react-refresh's only-export-components rule flags a hook exported alongside a
// component.
export const SoundContext = createContext(null);

// Its own key for useHelpDetail's reason: `aniarcade_game_prefs` is a
// { [gameId]: {...} } map whose slices are schemas, and this belongs to no game.
// Stored as `muted` rather than `enabled` so a device that never touched it
// reads null → unmuted, which is the chosen default. Not in resetKeys.js's
// PRESERVED_KEYS: a crash reset clearing a cosmetic preference is the right
// outcome, and what it falls back to is the default anyway.
export const MUTED_KEY = 'aniarcade_sound_muted';

/**
 * Whether UI sounds are muted on this device, and the switch that flips it.
 *
 * Falls back to "unmuted, no switch" outside a provider rather than throwing,
 * for useHelpDetail's reason: this is presentation only, and the only consumer
 * is a control in the top bar — a component test that mounts a screen without
 * the provider should get a screen with no mute button, not a crash.
 */
export function useSound() {
  return useContext(SoundContext) ?? { muted: false, setMuted: null, supported: false };
}
