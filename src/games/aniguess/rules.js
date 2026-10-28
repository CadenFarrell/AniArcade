// Pure, framework- and backend-free game rules: assignment rotation, turn
// advancement, scoring/positions, round resets. Extracted from useGameFlow.js
// so the same logic can back both local (useState) and online (Firebase)
// persistence without duplicating the turn/scoring math.
//
// These functions never touch React state or storage directly — callers pass
// in whatever slice of the state bundle they need and apply the returned
// patch/values however their persistence layer works.

// One guesser and one asker at the least — a table of one has nobody to answer.
export const MIN_PLAYERS = 2;

// A match: this many rounds, then the final leaderboard (shared/utils/match.js;
// 0 is the old endless loop). Two, because a round runs ten to twenty minutes
// and one round is too few to call a winner over.
export const DEFAULT_MATCH_ROUNDS = 2;

// Final chances. Once everyone else has solved, the last player used to take
// turn after turn alone while the table, already done, only answered — the
// longest and dullest stretch of the game. Now they get as many turns as the
// slowest solver took, plus this many, and are then out of turns: unsolved,
// no points, their character shown. Enough to finish a good line of
// questioning, never an open-ended grind.
export const LAST_STANDING_TURNS = 3;

// What a lock carries about the character — the solve screen shows who you
// were, which was the punchline the game never delivered. Only the fields that
// picture: everyone but the solver already knew it, so it is safe in state/,
// and every OTHER character stays in its read-gated assignments/ node.
function characterCard(character) {
  if (!character?.name) return null;
  return {
    name: character.name,
    series: character.series ?? '',
    imageUrl: character.imageUrl ?? '',
  };
}

const isLocked = (state, id) => state.lockedPositions.some((lp) => lp.playerId === id);

/**
 * Turns the last unsolved player has left, or null when final chances do not
 * apply: only once exactly one player still here is unsolved and somebody has
 * solved. `skipIds` are players who left (online), who are neither the last
 * player nor a reason to wait.
 */
export function turnsLeft(state, skipIds = []) {
  const here = state.gameSession.players.filter((p) => !skipIds.includes(p.id));
  const open = here.filter((p) => !isLocked(state, p.id));
  const solved = state.lockedPositions.filter((lp) => !lp.unsolved);
  if (open.length !== 1 || !solved.length) return null;
  const allowed = Math.max(...solved.map((lp) => lp.turnsUsed)) + LAST_STANDING_TURNS;
  return Math.max(0, allowed - (state.turnCounts[open[0].id] || 0));
}

// The current player is out — out of final chances, or they gave up. Locked
// like a solve so the round can end, but unsolved: no place, no points.
function lockUnsolved(state, player, turnsUsed, character) {
  return {
    playerId: player.id, name: player.name, position: null, points: 0, turnsUsed,
    unsolved: true, character: characterCard(character),
  };
}

export function startGame(session) {
  return {
    gameSession: session,
    assignmentIndex: 0,
    assignments: [],
    currentPlayerIndex: 0,
    lockedPositions: [],
    peekedPlayers: [],
    questionLogs: {},
    turnCounts: Object.fromEntries(session.players.map((p) => [p.id, 0])),
    roundNumber: 1,
    totalScores: {},
  };
}

// Get next non-locked player index after fromIndex (round-robin wraparound).
// Returns -1 only when every player is locked.
//
// `skipIds` is online-only: players who have left the room. Nobody can take a
// turn on their behalf, so the rotation has to step over them or the game stops
// dead on a player who will never act. Local play passes nothing.
export function getNextPlayerIndex(players, fromIndex, locked, skipIds = []) {
  const total = players.length;
  for (let i = 1; i <= total; i++) {
    const idx = (fromIndex + i) % total;
    const player = players[idx];
    if (locked.find((lp) => lp.playerId === player.id)) continue;
    if (skipIds.includes(player.id)) continue;
    return idx;
  }
  return -1;
}

// First player who can still act, for the phase boundaries that would otherwise
// hand the opening turn to whoever happens to sit at index 0.
export function firstActiveIndex(players, skipIds = []) {
  const idx = players.findIndex((p) => !skipIds.includes(p.id));
  return idx === -1 ? 0 : idx;
}

// Every player still in the room has been placed, so the round is over. Counts
// the active roster rather than lockedPositions.length, since a player who left
// mid-round will never be locked and would hold the round open forever.
export function roundComplete(lockedPositions, activePlayers) {
  return activePlayers.length > 0
    && activePlayers.every((p) => lockedPositions.some((lp) => lp.playerId === p.id));
}

// Called when a character is assigned to the current player in assignment phase.
export function characterAssigned(state, character) {
  const player = state.gameSession.players[state.assignmentIndex];
  return { assignments: [...state.assignments, { playerId: player.id, character }] };
}

// Called after reveal — move to next player assignment or start the game.
// Steps over anyone who has left: there's no point choosing a character for a
// player who isn't there to guess it.
export function revealDone(state, skipIds = []) {
  const players = state.gameSession.players;
  let nextIndex = state.assignmentIndex + 1;
  while (nextIndex < players.length && skipIds.includes(players[nextIndex].id)) nextIndex++;
  if (nextIndex >= players.length) {
    return { patch: { currentPlayerIndex: firstActiveIndex(players, skipIds) }, next: 'game' };
  }
  return { patch: { assignmentIndex: nextIndex }, next: 'assignment' };
}

// The player being assigned a character has left mid-assignment. Jump to the
// next one who is still here — or straight into the game if there is none.
export function skipDepartedAssignment(state, departedIds) {
  const players = state.gameSession.players;
  const current = players[state.assignmentIndex];
  if (!current || !departedIds.includes(current.id)) return { patch: {}, next: null };

  let idx = state.assignmentIndex;
  while (idx < players.length && departedIds.includes(players[idx].id)) idx++;
  if (idx >= players.length) {
    return { patch: { currentPlayerIndex: firstActiveIndex(players, departedIds) }, next: 'game' };
  }
  return { patch: { assignmentIndex: idx }, next: 'assignment' };
}

// The player whose turn it is has left. Only their own device can ask or guess,
// so the turn has to move on without them; their log and turn count are left
// exactly as they were in case they come back.
export function skipDepartedTurn(state, departedIds) {
  const players = state.gameSession.players;
  const current = players[state.currentPlayerIndex];
  if (!current || !departedIds.includes(current.id)) return { patch: {} };

  const next = getNextPlayerIndex(players, state.currentPlayerIndex, state.lockedPositions, departedIds);
  if (next === -1 || next === state.currentPlayerIndex) return { patch: {} };
  // Anything they left hanging can never be answered to them now.
  return { patch: { currentPlayerIndex: next, turnState: { pendingAction: null } } };
}

// After a turn that did not solve: if that was the last player's final chance,
// lock them out (see LAST_STANDING_TURNS) and show who they were.
function afterMiss(state, patch, player, skipIds, character) {
  const next = { ...state, ...patch };
  if (turnsLeft(next, skipIds) !== 0) return { patch };
  const out = lockUnsolved(next, player, next.turnCounts[player.id] || 0, character);
  return { patch: { ...patch, lockedPositions: [...state.lockedPositions, out] }, lastLocked: out, next: 'correctGuess' };
}

// The current player gives up (confirmed on screen): out of the round,
// unsolved, at any point. The same lock as running out of final chances.
export function giveUp(state, skipIds = [], character = null) {
  const player = state.gameSession.players[state.currentPlayerIndex];
  if (!player || isLocked(state, player.id)) return { patch: {} };
  const out = lockUnsolved(state, player, state.turnCounts[player.id] || 0, character);
  const lockedPositions = [...state.lockedPositions, out];
  const next = getNextPlayerIndex(state.gameSession.players, state.currentPlayerIndex, lockedPositions, skipIds);
  const patch = { lockedPositions };
  if (next !== -1) patch.currentPlayerIndex = next;
  return { patch, lastLocked: out, next: 'correctGuess' };
}

// Called when the current player asks a question / a timer expires (turn
// passes without a guess). `character` is the current player's, when the
// caller can read it (never the guesser's own device online): it is shown if
// this turn turns out to be their last.
export function turnComplete(state, logEntry, skipIds = [], character = null) {
  const player = state.gameSession.players[state.currentPlayerIndex];
  const questionLogs = {
    ...state.questionLogs,
    [player.id]: [logEntry, ...(state.questionLogs[player.id] || [])],
  };
  const turnCounts = {
    ...state.turnCounts,
    [player.id]: (state.turnCounts[player.id] || 0) + 1,
  };
  // A player who just took a normal turn is never in lockedPositions yet, so
  // getNextPlayerIndex always finds at least themself via wraparound — it
  // can't return -1 from this call site.
  const currentPlayerIndex = getNextPlayerIndex(state.gameSession.players, state.currentPlayerIndex, state.lockedPositions, skipIds);
  const patch = { questionLogs, turnCounts };
  // -1 means everyone else has left; keep the turn where it is rather than
  // writing a nonsense index.
  if (currentPlayerIndex !== -1) patch.currentPlayerIndex = currentPlayerIndex;
  return afterMiss(state, patch, player, skipIds, character);
}

// Called when the current player guesses correctly. `character` is who they
// were, for the solve screen (see characterCard).
export function correctGuess(state, logEntry, skipIds = [], character = null) {
  const player = state.gameSession.players[state.currentPlayerIndex];
  const turnsUsed = (state.turnCounts[player.id] || 0) + 1;

  // Places count solves only: a player who ran out of turns or gave up holds
  // no place for anyone to finish behind.
  const playersWithFewerTurns = state.lockedPositions.filter(
    (lp) => !lp.unsolved && lp.turnsUsed < turnsUsed
  ).length;
  const position = playersWithFewerTurns + 1;
  const { pointsPerPosition } = state.gameSession.settings;
  const points = pointsPerPosition[Math.min(position - 1, pointsPerPosition.length - 1)] || 0;

  const lastLocked = {
    playerId: player.id, name: player.name, position, points, turnsUsed, character: characterCard(character),
  };
  const lockedPositions = [...state.lockedPositions, lastLocked];

  const questionLogs = {
    ...state.questionLogs,
    [player.id]: [logEntry, ...(state.questionLogs[player.id] || [])],
  };
  const turnCounts = { ...state.turnCounts, [player.id]: turnsUsed };

  // Always show the celebration screen — the Continue button decides
  // whether to go back to the game or finish the round.
  const next = getNextPlayerIndex(state.gameSession.players, state.currentPlayerIndex, lockedPositions, skipIds);
  const patch = { questionLogs, turnCounts, lockedPositions };
  if (next !== -1) patch.currentPlayerIndex = next;

  return { patch, lastLocked, next: 'correctGuess' };
}

// Called when the current player guesses wrong — just advance the turn (and
// lock them out if it was their final chance; see turnComplete).
export function wrongGuess(state, logEntry, skipIds = [], character = null) {
  const player = state.gameSession.players[state.currentPlayerIndex];
  const questionLogs = {
    ...state.questionLogs,
    [player.id]: [logEntry, ...(state.questionLogs[player.id] || [])],
  };
  const turnCounts = {
    ...state.turnCounts,
    [player.id]: (state.turnCounts[player.id] || 0) + 1,
  };
  const next = getNextPlayerIndex(state.gameSession.players, state.currentPlayerIndex, state.lockedPositions, skipIds);
  const patch = { questionLogs, turnCounts };
  if (next !== -1) patch.currentPlayerIndex = next;
  return afterMiss(state, patch, player, skipIds, character);
}

// Applies a completed round's points onto the running totals.
export function applyRoundScores(totalScores, locked) {
  const updated = { ...totalScores };
  locked.forEach((lp) => {
    updated[lp.playerId] = (updated[lp.playerId] || 0) + lp.points;
  });
  return updated;
}

// Resets assignment/turn state for a new round (keeps totalScores/roundNumber
// building on what came before).
export function newRound(state, skipIds = []) {
  const start = firstActiveIndex(state.gameSession.players, skipIds);
  return {
    patch: {
      assignmentIndex: start,
      assignments: [],
      currentPlayerIndex: start,
      lockedPositions: [],
      peekedPlayers: [],
      questionLogs: {},
      turnCounts: Object.fromEntries(state.gameSession.players.map((p) => [p.id, 0])),
      roundNumber: state.roundNumber + 1,
    },
    next: 'assignment',
  };
}

// Determines who (if anyone) should be credited a win at session end.
export function computeSessionEnd(totalScores, players) {
  const scores = Object.values(totalScores);
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const winners = maxScore > 0
    ? players.filter((p) => (totalScores[p.id] || 0) === maxScore).map((p) => p.name)
    : [];
  return { maxScore, winners };
}

/**
 * The final leaderboard's superlatives, from every round's locks. A clear
 * leader or nothing — a tie drops the award rather than picking by seat.
 *
 *   Sharpest     the fewest turns any single solve took
 *   Most wins    the most rounds finished in first place
 */
export function matchAwards(rounds = [], players = []) {
  const locks = rounds.flat().filter((lp) => lp && !lp.unsolved);
  const byId = (id) => players.find((p) => p.id === id) ?? null;
  const out = [];
  if (locks.length) {
    const fewest = Math.min(...locks.map((lp) => lp.turnsUsed));
    const quick = locks.filter((lp) => lp.turnsUsed === fewest);
    if (new Set(quick.map((lp) => lp.playerId)).size === 1 && byId(quick[0].playerId)) {
      const lp = quick[0];
      out.push({
        title: 'Sharpest',
        player: byId(lp.playerId),
        detail: `Worked out ${lp.character?.name ?? 'their character'} in ${fewest} ${fewest === 1 ? 'turn' : 'turns'}`,
      });
    }
  }
  if (rounds.length > 1) {
    const firsts = {};
    for (const lp of locks) if (lp.position === 1) firsts[lp.playerId] = (firsts[lp.playerId] || 0) + 1;
    const rows = Object.entries(firsts).sort((a, b) => b[1] - a[1]);
    if (rows.length && !(rows[1] && rows[1][1] === rows[0][1]) && rows[0][1] > 1 && byId(rows[0][0])) {
      out.push({ title: 'Most wins', player: byId(rows[0][0]), detail: `Solved first in ${rows[0][1]} rounds` });
    }
  }
  return out;
}
