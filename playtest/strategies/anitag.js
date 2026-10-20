// AniTag: everyone holds a secret category ("Wears glasses"); on your go you
// name a character, everyone answers yes or no against their OWN category, and
// you try to work out somebody else's. A guess is judged by its owner, who is
// shown their category privately first.
//
// The bot is every seat at once, so it knows every category from the pick
// phase (chosen mode) and judges guesses the way the owner would: yes when the
// guess IS their category, otherwise usually no. Guessers aim at a real
// category about half the time, so solved rows, scoring and the round end all
// get played — a bot that only ever named random characters would run the
// clock out on every round and never see a solve.
import { makeStrategy } from './base.js';
import { find, click, fill, has, DENY } from '../core/generic.js';
import { FIXTURE_PROFILES } from '../core/scenarios.js';

const NAMES = FIXTURE_PROFILES.flatMap((p) => p.animeList.flatMap((a) => a.characters.map((c) => c.name)));
const SHOWS = FIXTURE_PROFILES.flatMap((p) => p.animeList.map((a) => a.title));

export default makeStrategy({
  players: [2, 6],
  axes: {
    rounds: [1, 2, 3],
    categoryMode: ['chosen', 'dealt'],
    proposalCap: [3, 10],
    categoryPool: ['characters', 'shows'],
    useCustom: [true, false],
  },
  act(snap, ctx) {
    const { rng, memory, scenario } = ctx;
    // Locally one memory sees every seat; online each seat has its own, and
    // what the table can see between them (a dealt category is shown to all
    // but its owner) is pooled in ctx.table.known.
    memory.cat = ctx.table?.known ?? (memory.cat ?? {});
    for (const [, who, cat] of snap.text.matchAll(/([A-Z][a-z]+)'s category(?!Hide)(.+?)(?=Your names|[A-Z][a-z]+'s names|$)/g)) {
      if (cat.trim() && cat.length < 60) memory.cat[who] = cat.trim();
    }

    // Pick phase (chosen mode): claim the device, choose or write a category.
    const claim = find(snap, /^I'm (.+) — show me the list$/);
    if (claim) { memory.picking = claim.name.match(/^I'm (.+) — show me/)[1]; return click(claim, 'claim the device'); }
    const lockCat = find(snap, /^lock in “/i);
    if (lockCat) {
      if (memory.picking) memory.cat[memory.picking] = lockCat.name.match(/“(.+)”/)?.[1];
      return click(lockCat, 'lock in category');
    }
    // The pick box only — online, "Your category — everyone else looks away"
    // is a BUTTON with the same opening words.
    const catBox = find(snap, /^your category/i, { role: 'combobox' }) ?? find(snap, /^your category/i, { role: 'textbox' });
    if (catBox) {
      const listed = snap.controls.filter((c) => c.role === 'button' && !c.disabled && /^[A-Z]/.test(c.name)
        && !DENY.test(c.name) && !/lock it in|quit|hub|^your |^end |^give up|names\d/i.test(c.name) && c.name.length < 50);
      if (listed.length && rng.chance(0.8)) return click(rng.pick(listed), 'pick a category');
      return fill(catBox, rng.pick(['Has a pet', 'Wears a hat', 'Can fly', 'Is a teacher']), 'write a category');
    }

    // Judging. A guess at MY category: yes only when it is my category.
    const yes = find(snap, /^yes$/i);
    const no = find(snap, /^no$/i);
    if (yes && no) {
      const show = find(snap, /only — everyone else looks away/i);
      if (show && rng.chance(0.5)) return click(show, 'owner peeks at their category');
      const guess = snap.text.match(/Their guess at the category(.+?)(?:[A-Z][a-z]+ only —|[A-Z][a-z]+'s category)/);
      const owner = snap.text.match(/([A-Z][a-z]+)(?: only — everyone else looks away|'s category)/)?.[1];
      if (guess && owner) {
        const right = memory.cat[owner] && guess[1].trim().toLowerCase() === memory.cat[owner].toLowerCase();
        return click(right || rng.chance(0.1) ? yes : no, right ? 'judge: that is my category' : 'judge a guess');
      }
      return click(rng.chance(0.5) ? yes : no, 'answer against my category');
    }

    // Guessing: whose (online dealt mode has no "whose" — it is your own),
    // then what.
    const guessBox = find(snap, /your guess at the category/i);
    if (guessBox && !has(snap, /whose category\?/i)) {
      if (!guessBox.value) {
        const right = memory.cat[ctx.seat?.name];
        return fill(guessBox, right && rng.chance(0.5) ? right : rng.pick(['Is blond', 'Aired before you were born', rng.word()]), 'guess my category');
      }
      return click(find(snap, /^that is /i), 'submit guess');
    }
    if (has(snap, /whose category\?/i)) {
      const seats = scenario.names.filter((n) => find(snap, new RegExp(`^${n}$`)));
      // Online, a dealt-mode guesser is guessing their OWN category.
      const self = ctx.seat?.name;
      if (self && !seats.length && memory.cat[self]) memory.target = self;
      memory.target = memory.target && seats.includes(memory.target) ? memory.target : rng.pick(seats);
      const box = find(snap, /your guess at the category/i);
      if (box && !box.value) {
        const right = memory.cat[memory.target];
        return fill(box, right && rng.chance(0.5) ? right : rng.pick(['Is blond', 'Is a villain', 'Is loud', rng.word()]), 'guess a category');
      }
      const go = find(snap, /^that is /i);
      if (go) { memory.target = null; return click(go, 'submit guess'); }
      return click(find(snap, new RegExp(`^${memory.target}$`)), 'whose category');
    }

    // My go: name something, or try a guess once a few names are out.
    const try_ = find(snap, /^a (character|show) to try$/i);
    if (try_) {
      memory.named = (memory.named ?? 0) + 1;
      const know = find(snap, /i know (someone|the category)/i);
      if (know && memory.named > 3 && rng.chance(0.3)) return click(know, 'I know a category');
      if (rng.chance(0.02)) return click(find(snap, /^give up/i) ?? know, 'give up');
      if (!try_.value) return fill(try_, rng.pick(/show/i.test(try_.name) ? SHOWS : NAMES), 'name one');
      return click(find(snap, /^ask — then pass/i), 'ask and pass');
    }
    const ask = find(snap, /^ask — then pass/i);
    if (ask) return click(ask, 'ask and pass');
    // "Nobody left to claim": every other row is solved or already missed, so
    // the only ways on are back to naming or sitting the round out.
    const back = find(snap, /^back to naming/i);
    if (back) return click(rng.chance(0.8) ? back : find(snap, /^give up/i) ?? back, 'nobody left to claim');
    return null;
  },
});
