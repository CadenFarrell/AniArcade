// AniGuess: everyone else picks a character for you while you look away, then
// you take turns asking yes/no questions or guessing who you are.
//
// The bot plays the table, not one player: it sees every screen, so it
// remembers each player's character from the confirm screen (the screen the
// assignee is looking away from) and, on that player's turn, guesses it right
// now and then. Without that a round could only end by every turn timing out,
// and the scoring screens would never be reached.
//
// Talk mode replaces typed questions with one "what happened" screen; the
// timer, when on, is sometimes left to run out so expiry gets played too.
import { makeStrategy } from './base.js';
import { FIXTURE_PROFILES } from '../core/scenarios.js';
import { find, findAll, click, fill, has, wait } from '../core/generic.js';

// Longest first, so "Sword Art Online II" is not split as "Sword Art Online".
const SHOWS = [...new Set(FIXTURE_PROFILES.flatMap((p) => p.animeList.map((a) => a.title)))].sort((a, b) => b.length - a.length);

const QUESTIONS = ['Am I human?', 'Am I a main character?', 'Do I use a sword?', 'Am I from a school show?', 'Do I have powers?'];

// The seated name, whatever case the heading is set in: Chrome's innerText
// reads a display-caps heading as "GABE'S TURN", and memory is keyed "Gabe" —
// read as written, no guess in a real browser was ever the right one.
const seatedName = (raw, names) => names.find((n) => n.toLowerCase() === raw.trim().toLowerCase()) ?? raw.trim();
function turnOf(snap, names) {
  const m = snap.heading.match(/^(.+?)['’]s Turn/i);
  return m ? seatedName(m[1], names) : null;
}

export default makeStrategy({
  players: [2, 5],
  axes: {
    sharedShowsOnly: [true, false],
    twoStepRandom: [true, false],
    talkMode: [false, true],
    timerEnabled: [false, true],
    timerSeconds: [30, 60],
    // A match's length; 0 is endless (the bot ends it after one or two).
    rounds: [1, 2, 0],
  },
  isDone: (snap) => has(snap, /final results/i) && Boolean(find(snap, /play again|back to lobby/i, { enabled: false })),

  act(snap, ctx) {
    const { rng, memory, scenario } = ctx;
    // Online each seat is blind to its own character, but the answerers are
    // shown the guesser's ("Caden is <name><series>") so they can answer
    // honestly. Pooled across seats in ctx.table.known, as AniTag pools
    // categories; locally one memory sees every assignment anyway.
    memory.assign = ctx.table?.known ?? (memory.assign ?? {});
    // Case-blind: the card's "<name> is" is CSS-uppercased, and a real browser's
    // innerText reads it as "GABE IS" — matched as written, Chrome never learned
    // a single character and every AniGuess run there timed out guessing.
    const lower = snap.text.toLowerCase();
    for (const name of scenario.names) {
      const at = lower.indexOf(`${name.toLowerCase()} is`);
      // Latest sighting wins: a re-roll during assignment changes a character
      // after it was first seen, and the answerer view is always current.
      if (at === -1) continue;
      const from = at + name.length + 3;
      const rest = lower.slice(from);
      const show = SHOWS.find((t) => { const j = rest.indexOf(t.toLowerCase()); return j > 1 && j < 60; });
      if (show) memory.assign[name] = snap.text.slice(from, from + rest.indexOf(show.toLowerCase())).trim();
    }

    // A saved game from before a chaos exit: resume it, as a player would.
    const resume = find(snap, /resume game/i);
    if (resume) return click(resume, 'resume saved game');

    // Assignment: whose character is being picked.
    const away = snap.text.match(/Pick a character for\s*(.+?)(Pick Random|$)/i);
    // The name is a display-caps wordmark: map Chrome's "GAVIN" back to the
    // seated "Gavin", or what is learned here is filed under a name no turn has.
    if (away) memory.assigning = seatedName(away[1], scenario.names);
    const random = find(snap, /^pick random/i);
    const manual = find(snap, /^pick manually/i);
    if (random && manual) return click(rng.chance(0.75) ? random : manual, 'how to pick');

    // Online, a pick is a proposal everyone else approves.
    const approve = find(snap, /^approve this pick/i);
    if (approve) return click(approve, 'approve the pick');
    const lockIn = find(snap, /^lock (it )?in/i);
    if (lockIn && has(snap, /approvals/i)) return click(lockIn, 'lock in the pick');

    // Manual browse: open a show, then pick (online: propose) a character. A
    // show's row is named "<title>(<cast count>)" — the disclosure chevron is aria-hidden.
    // Each button is named "Pick <character>"; the lookahead keeps the two
    // how-to-pick buttons and the confirm screen's "← Pick Again" out (find
    // also matches a name with its arrows stripped, so that one reads "Pick Again").
    const pick = findAll(snap, /^(pick|propose) (?!random|manually|again$)/i);
    if (pick.length) return click(rng.pick(pick), 'pick a character');
    const shows = findAll(snap, /\(\d+\)$/);
    if (shows.length && has(snap, /'s characters/i)) return click(rng.pick(shows), 'open a show');

    const confirm = find(snap, /^confirm$/i);
    if (confirm) {
      if (rng.chance(0.15)) return click(find(snap, /re-roll/i) ?? confirm, 're-roll');
      const who = snap.text.match(/Confirm this character\?\s*(.+?)from /i);
      if (who && memory.assigning) memory.assign[memory.assigning] = who[1].trim();
      return click(confirm, 'confirm character');
    }

    // A game resumed after a chaos exit skips the assignment screens, so the
    // bot never saw who is who. The table's own panel answers it: pick the
    // player, confirm they look away, and the card reads "<name> is …", which
    // the scan above already learns from.
    const looking = memory.lookingFor;
    if (looking && !memory.assign[looking]) {
      const ready = find(snap, new RegExp(`^${looking} is looking away`, 'i'));
      if (ready) return click(ready, 'who is who: they look away');
      const row = snap.controls.find((c) => c.role === 'button' && !c.disabled && c.name.toLowerCase().startsWith(looking.toLowerCase()) && /look away first|already guessed/i.test(c.name));
      if (row) return click(row, 'who is who: pick the player');
    }
    if (looking && memory.assign[looking]) memory.lookingFor = null;

    // The peek and who-is-who panels are modals over the turn's buttons, and
    // a real browser will not click through one (jsdom did): close one before
    // anything below it. Online, answering under an open panel sent every Yes
    // to the modal for seven minutes and the guesser waited forever.
    const closePanel = find(snap, /— close$/i);
    if (closePanel) return click(closePanel, 'close the panel');

    // The match's last round: its one way on is the final leaderboard.
    const finalResults = find(snap, /^final results/i);
    if (finalResults) return click(finalResults, 'final results');

    // Round over: play one or two, then end the session.
    const newRound = find(snap, /new round/i);
    const end = find(snap, /end & see leaderboard/i);
    if (newRound && end) {
      memory.rounds = (memory.rounds ?? 0) + 1;
      return click(memory.rounds < (scenario.seed % 2) + 1 ? newRound : end, 'after the round');
    }

    // Answering someone's question.
    const yes = find(snap, /^yes$/i);
    const no = find(snap, /^no$/i);
    const gotIt = find(snap, /^got it!?$/i);
    if (gotIt) {
      // Talk mode: the table judged it aloud. Late in a turn sequence, call it.
      memory.talk = (memory.talk ?? 0) + 1;
      if (rng.chance(Math.min(0.6, 0.08 * memory.talk))) return click(gotIt, 'they guessed it');
      return click(rng.pick([yes, no, find(snap, /^wrong$/i)].filter(Boolean)), 'talk-mode outcome');
    }
    if (yes && no) return click(rng.chance(0.5) ? yes : no, 'answer the question');

    // A turn that has ended leaves the guess box (and, in the current build,
    // an enabled Guess button) on screen above the hand-off; the hand-off wins.
    const pass = find(snap, /^pass the device/i);
    if (pass) return click(pass, 'pass the device');

    const player = turnOf(snap, scenario.names) ?? (/your turn/i.test(snap.heading) ? ctx.seat?.name : null);
    const guessBox = find(snap, /^your guess$/i);
    if (guessBox) {
      if (!guessBox.value) {
        const right = memory.assign[player];
        const text = right && rng.chance(0.45) ? right : rng.pick(['Naruto Uzumaki', 'Levi', rng.word()]);
        return fill(guessBox, text, right === text ? 'guess (right)' : 'guess');
      }
      return click(find(snap, /^guess$/i), 'submit guess');
    }
    const qBox = find(snap, /^your question$/i);
    if (qBox) {
      // Online the question box stays open turn after turn; back out of it
      // now and then, or a guesser never gets to guess.
      const back = find(snap, /^back$/i);
      if (!qBox.value && back && ctx.seat && rng.chance(0.4)) return click(back, 'back to choose');
      if (!qBox.value) return fill(qBox, rng.pick(QUESTIONS), 'ask');
      return click(find(snap, /^ask$/i), 'submit question');
    }

    if (player && find(snap, /ask a question/i)) {
      memory.whoTried ??= {};
      const who = find(snap, /^who is who\?$/i);
      if (!memory.assign[player] && !memory.whoTried[player] && who && !ctx.seat) {
        memory.whoTried[player] = true;
        memory.lookingFor = player;
        return click(who, 'who is who: open');
      }
      // Let the timer run out now and then, so expiry is played too.
      if (scenario.prefs.timerEnabled && rng.chance(0.08)) return wait(scenario.prefs.timerSeconds * 1000 + 1500, 'let the timer run out');
      if (rng.chance(0.04)) return click(find(snap, /peek at my anime list/i) ?? find(snap, /who is who/i), 'peek');
      return click(find(snap, rng.chance(0.6) ? /ask a question/i : /submit guess/i), 'turn action');
    }
    return null;
  },
});
