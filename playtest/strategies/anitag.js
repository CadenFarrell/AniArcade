// AniTag: everyone holds a secret category ("Wears glasses") that everyone can
// see except them. On your go you name a character, one judge — the next player
// round — answers yes or no against YOUR category, and you try to work out your
// own. Before the round the table picks each player's category while that
// player looks away (or, with the random source, the game deals them).
//
// The bot is every seat at once, so it knows every category from the pick (or
// from the strip a judge reads) and judges guesses the way the table would: yes
// when the guess IS the seat's category, otherwise usually no. Guessers aim at
// the real category about half the time, so solved rows, scoring and the round
// end all get played — a bot that only ever named random characters would run
// the clock out on every round and never see a solve.
import { makeStrategy } from './base.js';
import { find, click, fill, has, DENY } from '../core/generic.js';
import { FIXTURE_PROFILES } from '../core/scenarios.js';

const NAMES = FIXTURE_PROFILES.flatMap((p) => p.animeList.flatMap((a) => a.characters.map((c) => c.name)));
const SHOWS = FIXTURE_PROFILES.flatMap((p) => p.animeList.map((a) => a.title));

export default makeStrategy({
  players: [2, 6],
  axes: {
    rounds: [1, 2, 3],
    categorySource: ['table', 'random'],
    proposalCap: [3, 10],
    categoryPool: ['characters', 'shows'],
    useCustom: [true, false],
  },
  act(snap, ctx) {
    const { rng, memory } = ctx;
    // Locally one memory sees every seat; online each seat has its own, and
    // what the table can see between them (a category is shown to all but its
    // owner) is pooled in ctx.table.known.
    memory.cat = ctx.table?.known ?? (memory.cat ?? {});
    for (const [, who, cat] of snap.text.matchAll(/([A-Z][a-z]+)'s category(?!Hide)(.+?)(?=Your names|[A-Z][a-z]+'s names|$)/g)) {
      if (cat.trim() && cat.length < 60) memory.cat[who] = cat.trim();
    }

    // --- the table picks ------------------------------------------------------
    // Local: the target looks away, then everyone else picks.
    const ready = find(snap, /is looking away — Ready!$/);
    if (ready) return click(ready, 'target looks away');
    // Online, on the target's own device: nothing to do but wait.
    if (has(snap, /Everyone else is choosing your category/)) return null;
    const pickingFor = snap.text.match(/Pick a category for ([A-Z][a-z]+)/)?.[1] ?? null;
    if (pickingFor) {
      // Online: a proposal on the table. Usually approve; sometimes counter.
      const approve = find(snap, /^approve$/i);
      if (approve && rng.chance(0.85)) return click(approve, 'approve the proposal');
      // Already approved: wait for the rest of the table.
      if (!approve && has(snap, /Take back my approval/)) return null;
      const commit = find(snap, /^(lock in|propose) “/i);
      if (commit && !commit.disabled) {
        memory.cat[pickingFor] = commit.name.match(/“(.+)”/)?.[1];
        return click(commit, 'commit a category');
      }
      const box = find(snap, /'s category — type one|^propose a different one/i, { role: 'combobox' })
        ?? find(snap, /'s category — type one|^propose a different one/i, { role: 'textbox' });
      if (box) {
        const random = find(snap, /^deal one at random$/i);
        if (random && rng.chance(0.3)) return click(random, 'deal one at random');
        const listed = snap.controls.filter((c) => c.role === 'button' && !c.disabled && /^[A-Z]/.test(c.name)
          && !DENY.test(c.name) && !/lock in|propose|approve|take back|deal one|quit|hub|^your |^end |^give up|names\d/i.test(c.name)
          && c.name.length < 50);
        if (listed.length && rng.chance(0.7)) return click(rng.pick(listed), 'pick a category');
        return fill(box, rng.pick(['Has a pet', 'Wears a hat', 'Can fly', 'Is a teacher']), 'write a category');
      }
    }

    // --- judging ----------------------------------------------------------------
    // The seat is named by the round's heading ("Liam's go"); online on the
    // seat's own phone it is "Your go", and ctx.seat says who that is.
    const seatName = snap.text.match(/([A-Z][a-z]+)'s go/)?.[1] ?? ctx.seat?.name ?? null;
    const yes = find(snap, /^yes$/i);
    const no = find(snap, /^no$/i);
    if (yes && no) {
      // Locally the seat's category is behind a peek the judge may open.
      const peek = find(snap, /looks away$/i);
      if (peek && rng.chance(0.5)) return click(peek, 'judge peeks at the category');
      const guess = snap.text.match(/Their guess at the category(.+?)(?:Judging —|[A-Z][a-z]+, your answer|[A-Z][a-z]+'s category|Yes)/);
      if (guess && seatName) {
        const right = memory.cat[seatName] && guess[1].trim().toLowerCase().includes(memory.cat[seatName].toLowerCase());
        return click(right || rng.chance(0.1) ? yes : no, right ? 'judge: that is the category' : 'judge a guess');
      }
      return click(rng.chance(0.5) ? yes : no, 'answer against the category');
    }

    // --- my go: declare, or name ---------------------------------------------------
    const guessBox = find(snap, /your guess at the category/i);
    if (guessBox) {
      if (!guessBox.value) {
        const right = seatName && memory.cat[seatName];
        return fill(guessBox, right && rng.chance(0.5) ? right : rng.pick(['Is blond', 'Aired before you were born', rng.word()]), 'guess my category');
      }
      return click(find(snap, /^that is my category/i), 'submit guess');
    }
    const try_ = find(snap, /^a (character|show) to try$/i);
    if (try_) {
      memory.named = (memory.named ?? 0) + 1;
      const know = find(snap, /^i know the category/i);
      if (know && memory.named > 3 && rng.chance(0.3)) return click(know, 'I know the category');
      if (rng.chance(0.02)) return click(find(snap, /^give up/i) ?? know, 'give up');
      if (!try_.value) return fill(try_, rng.pick(/show/i.test(try_.name) ? SHOWS : NAMES), 'name one');
      return click(find(snap, /^ask — then pass/i), 'ask and pass');
    }
    const ask = find(snap, /^ask — then pass/i);
    if (ask) return click(ask, 'ask and pass');
    return null;
  },
});
