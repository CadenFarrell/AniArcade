// AniChain: two clue-givers build one sentence, a word each, towards a secret
// character; the guessers it is for get one guess a word.
//
// What the bot has to get right that the generic fallback would not:
//   - locally the device only COUNTS words: "Next word" until somebody "Got
//     it" (then "<name> got it"), or the cap's "Out of words" — the fallback
//     would press "Banned word" and "peek again" as often as anything;
//   - online a word is the "Your word" box then "Add word", refused while it
//     is banned (replaced, not retried) and held while the guess window runs
//     (waited out, not refilled forever);
//   - a guess is the "Your guess" box then "Guess", or "Pass".
// The bot cannot know the character, so online its guesses are made-up names
// and every turn runs its window — the path that most needs exercising: the
// window, the judge marking wrongs, and the capped close. Locally it credits
// a random guesser now and then, so every scoring branch is reached.
import { makeStrategy } from './base.js';
import { find, findAll, click, fill, has, choose, wait } from '../core/generic.js';

const WORDS = ['ninja', 'ramen', 'rival', 'mecha', 'ghost', 'idol', 'ocean', 'storm', 'crown', 'magic', 'robot', 'blade',
  'orange', 'sword', 'school', 'captain', 'quiet', 'loud', 'hungry', 'pirate'];
const GUESSES = ['Hero One', 'Rival Two', 'Captain Three', 'Sensei Four', 'Ghost Five'];
const MIN = { pair: 3, rivals: 4, teams: 6 };

export default makeStrategy({
  players: [3, 6],
  onlinePlayers: [3, 4],
  axes: {
    shape: ['pair', 'rivals', 'teams'],
    // Online a bot can never name the character, so every turn runs to the
    // cap: short caps keep a run to a couple of minutes.
    cap: [6, 8],
    rounds: [4],
  },
  // A shape the table is too small for would only ever be refused at Start:
  // seed the biggest one this many players can play instead. And a table big
  // enough for team pairs plays them in place of a pair game, or the one
  // shape that needs six would hardly ever be drawn with six seated.
  adjustPrefs(prefs, { players }) {
    let shape = prefs.shape;
    if (players < MIN[shape]) shape = players >= MIN.rivals ? 'rivals' : 'pair';
    else if (players >= MIN.teams && shape === 'pair') shape = 'teams';
    return { ...prefs, shape };
  },
  // The same, when the settings card picked the shape: back to a pair game.
  fixBlocked(snap) {
    const table = find(snap, /^table$/i, { role: 'combobox' });
    if (table && table.value !== 'pair' && has(snap, /needs \d+ players|waiting for players/i)) return choose(table, 'pair', 'a shape this table can play');
    return null;
  },
  onBlocked: () => ({ expected: true }),

  act(snap, ctx) {
    const { rng, memory } = ctx;

    const show = find(snap, /— show us$/);
    if (show) return click(show, 'the givers look at the card');
    const another = find(snap, /^don.t know them/i);
    if (another && rng.chance(0.15)) return click(another, 'ask for another character');
    const hide = find(snap, /^hide it$/i);
    if (hide) return click(hide, 'hide the card');

    // Online: a giver's word.
    const word = find(snap, /^your word$/i, { role: 'textbox' });
    if (word) {
      const add = find(snap, /^add word$/i);
      if (word.value && add) return click(add, 'add the word');
      if (word.value && has(snap, /waiting for guesses|checking a guess/i)) return wait(500, 'the guess window');
      return fill(word, rng.pick(WORDS), 'think of a word');
    }
    // Online: a guess.
    const guess = find(snap, /^your guess$/i, { role: 'textbox' });
    if (guess) {
      const go = find(snap, /^guess$/i);
      if (guess.value && go) return click(go, 'guess');
      const pass = find(snap, /^pass$/i);
      if (pass && rng.chance(0.4)) return click(pass, 'pass on this word');
      return fill(guess, rng.pick(GUESSES), 'guess a name');
    }

    // Locally: who got it, once the card is open.
    const credits = findAll(snap, / got it$/i);
    if (credits.length) return click(rng.pick(credits), 'credit a guesser');
    const gotIt = find(snap, /^got it$/i);
    const next = find(snap, /^next word$/i);
    const out = find(snap, /^out of words$/i);
    if (gotIt && rng.chance(0.3)) return click(gotIt, 'somebody shouted it');
    const banned = find(snap, /^banned word$/i);
    if (banned && rng.chance(0.03)) return click(banned, 'a giver slipped');
    const peek = find(snap, /^givers: peek again$/i);
    if (peek && !memory.peeked && rng.chance(0.05)) { memory.peeked = true; return click(peek, 'the givers peek again'); }
    if (next) return click(next, 'the next word is said');
    if (out) return click(out, 'out of words');

    const move = find(snap, /^(next round|next turn|see results)$/i);
    if (move) return click(move, 'move on');
    // Online, everyone else waits on a giver or the window.
    if (has(snap, /waiting for|is guessing .*’s word|guess in|watching|on its way|dealing/i)) return wait(500, 'waiting on the table');
    return null;
  },
});
