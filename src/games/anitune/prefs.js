import { RACE } from './rules';
import { DEFAULT_POPULARITY_ID } from './utils/popularity';
import { DEFAULT_SAMPLE_POINT, YEAR_MIN, YEAR_MAX } from './utils/questionPool';

// Every option AniTune remembers between sessions, at its literal default.
// One module rather than a literal in each screen — AniTuneSetup and OnlineLobby
// offer an identical set and both import this, so they cannot drift. It doubles
// as the schema useGamePrefs validates a saved blob against.
//
// Two of these defaults are behaviour changes for players who already have a
// saved blob, because mergePrefs backfills missing keys on the next read. Both
// were decided rather than discovered:
//
//   timed: true      — the guess clock is the point of this release, and an
//                      untimed round is a genuinely supported path (every window
//                      stays null and scoring falls back to the flat point it
//                      always paid), so turning it on for everyone costs nothing
//                      but a visible bar and gives the feature to the people who
//                      would never have gone looking for it.
//   popularity: any  — the opposite call, for the opposite reason. A pool filter
//                      that switched itself on would quietly shrink what everyone
//                      plays, and a dial nobody asked for should do nothing until
//                      they touch it.
export const DEFAULT_PREFS = {
  mode: RACE,

  // --- the round ---
  roundSize: 10,
  clipSeconds: 10,
  timed: true,
  guessSeconds: 20,
  // Race only: how long the buzzer gets to type once they have the clip. Short,
  // because the rest of the room is waiting on a paused song.
  answerSeconds: 10,
  // Lives mode only.
  startingLives: 3,
  playbackRate: 1,
  samplePoint: DEFAULT_SAMPLE_POINT,

  // --- the song pool ---
  sharedSongsOnly: true,
  includeOpenings: true,
  includeEndings: true,
  popularity: DEFAULT_POPULARITY_ID,
  yearFrom: YEAR_MIN,
  yearTo: YEAR_MAX,
  // Caps how many of one show's themes a round may draw (see pickRound).
  maxPerAnime: 2,

  // --- one device ---
  // Race on one device: 'buzz' is a pad per player on the screen (and number
  // keys on a laptop), 'shout' is everyone shouting the answer and the table
  // tapping who was first. Both kept; buzz is the default because it is what
  // every saved table already played.
  localRace: 'buzz',
  // Everyone-guesses on one device: 'private' passes the device for each
  // answer; 'aloud' plays the clip once, everyone says their answer, and the
  // table ticks who got it — no handoffs, and no speed bonus.
  localEntry: 'private',

  // Hints while the clip plays (the year and OP/ED number at 35% of the guess
  // window, whose lists the show is on at 65%). Off by default: recognition is
  // the game, and a table that wants a lifeline turns it on.
  hints: false,
};

export const LOCAL_RACE_STYLES = [
  { id: 'buzz', label: 'Buzz pads', blurb: 'A button for each player on the screen. On a laptop, number keys 1–9 buzz too.' },
  { id: 'shout', label: 'Shout it', blurb: 'Everyone shouts the answer; tap who said it first, then check it together.' },
];

export const LOCAL_ENTRY_STYLES = [
  { id: 'private', label: 'Pass the device', blurb: 'Everyone types their answer in private, one at a time.' },
  { id: 'aloud', label: 'Say it out loud', blurb: 'Everyone says their answer, then the table ticks who got it. No speed bonus.' },
];
// Deliberately absent: allowSpoilers / allowNsfw. They gated on AnimeThemes'
// per-entry video flags, which say nothing about the audio this game plays —
// see pickAudioForTheme for the measurement that settled it.
//
// Removing a key is safe but not self-cleaning, and the two halves differ:
// mergePrefs builds its result from THIS literal, so a stored key nothing
// declares is never read again; writePrefs spreads onto the existing slice, so
// it is also never deleted. Anyone who played the old build keeps two dead
// booleans in localStorage forever. Harmless, and worth knowing before assuming
// a dropped key disappears.

// The speeds worth offering. 1.25 is the interesting one — fast enough to
// scramble a familiar vocal line, slow enough that the melody survives.
export const PLAYBACK_RATES = [1, 1.25, 1.5, 2];
