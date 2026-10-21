// Every option AniTurf remembers between sessions, at its literal default.
// It doubles as the schema useGamePrefs validates a saved blob against.
//
// Teams and clue-givers are deliberately not here: they are who is sitting at
// the table tonight, not a preference, and a remembered split would seat last
// week's teams over this week's players.
export const DEFAULT_PREFS = {
  // Off: the board needs 25 characters, and a "characters everyone holds" pool
  // rarely reaches that at a table of four. The draw already leans toward
  // shared characters (utils/board.js), which is most of what the option is for.
  sharedOnly: false,
  traps: 2,
};
