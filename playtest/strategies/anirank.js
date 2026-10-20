// AniRank: ten cards, one board. The board is tap-to-place (RankBoard.jsx):
// tap a tray card to lift it, tap "Place X in slot N" to drop it, and a filled
// slot offers "Pick up", "Swap … with …" and "Take … out". Drag exists too,
// but it is pointer-only by design (TierBoard.jsx's note), so jsdom cannot do
// it; the browser layer has one real drag check instead.
//
// The bot fills every slot in a random order, now and then rearranging a
// placed card first so the swap and take-out paths are exercised, and locks
// in. Tier formats (tiers, ranked) sort the WHOLE list into rows and have no
// answer key, so they end on the compare screen rather than a scoreboard.
import { makeStrategy } from './base.js';
import { find, findAll, click, has, DENY } from '../core/generic.js';

const SLOT = /slot \d+/i;
const BOARD_CHROME = /slot|lock in|quit|hub|fill every|^←/i;

function boardAction(snap, ctx) {
  const { rng } = ctx;
  if (!has(snap, /left to place|locked in/i)) return null;

  const lock = find(snap, /lock in/i);
  if (lock) return click(lock, 'lock in board');

  // Card lifted: drop it, preferring an empty slot (the occasional swap keeps
  // that path covered without stalling the fill).
  const places = findAll(snap, /^place .* in slot \d+/i);
  if (places.length) {
    const swap = findAll(snap, /^swap /i);
    if (swap.length && rng.chance(0.1)) return click(rng.pick(swap), 'swap cards');
    return click(rng.pick(places), 'place card');
  }

  const takeOut = findAll(snap, /^take .* out of slot/i);
  if (takeOut.length && rng.chance(0.04)) return click(rng.pick(takeOut), 'take a card out');
  const pickUp = findAll(snap, /^pick up .* from slot/i);
  if (pickUp.length && rng.chance(0.04)) return click(rng.pick(pickUp), 'pick up a placed card');

  // Online the room's own Leave sits on this screen too; DENY keeps it out.
  const tray = snap.controls.filter((c) => c.role === 'button' && !c.disabled && !BOARD_CHROME.test(c.name)
    && !SLOT.test(c.name) && !DENY.test(c.name));
  if (tray.length) return click(rng.pick(tray), 'lift a card');
  return null;
}

// The tier builder (TierMode.jsx): a picker of saved lists per player, then a
// board of rows. A held card shows "＋ Place in <row>" targets; a placed card
// carries a "Return … to the tray" control, which is how tray cards are told
// apart from placed ones (both are aria-pressed tiles).
function tierAction(snap, ctx) {
  const { rng, memory, playing = ctx.scenario.names } = ctx;
  memory.lists ??= 0;

  // The new-list form: a name, a format, Create.
  const name = find(snap, /^name$/i, { role: 'textbox' });
  const create = find(snap, /^create$/i);
  if (name && create) {
    if (!name.value) return { fill: name.id, name: name.name, text: `${rng.word()} list`, why: 'name the list' };
    const fmt = findAll(snap, /^(tiers|full ranking)/i);
    if (fmt.length && !memory.formatPicked) { memory.formatPicked = true; return click(rng.pick(fmt), 'list format'); }
    memory.formatPicked = false;
    memory.lists++;
    return click(create, 'create list');
  }

  if (has(snap, /^.*tier lists/i) && find(snap, /new list for/i)) {
    if (memory.lists >= 2 || (memory.lists >= 1 && playing.length === 1)) {
      const compare = find(snap, /compare two lists/i);
      if (compare) return click(compare, 'compare lists');
    }
    const next = findAll(snap, /^new list for /i)[memory.lists % Math.max(1, playing.length)] ?? find(snap, /^new list for /i);
    return click(next, 'new list');
  }

  if (has(snap, /everything is placed/i)) {
    if (playing.length === 1 && memory.lists >= 1) { memory.tierDone = true; return null; }
    return click(find(snap, /saved lists/i), 'back to lists');
  }

  const zones = findAll(snap, /^place/i);
  if (zones.length) return click(rng.pick(zones), 'place in a row');

  if (rng.chance(0.03)) {
    const odd = findAll(snap, /use tiers|use 1–n|edit rows|done editing|^▲$|^▼$|return .* to the tray/i);
    if (odd.length) return click(rng.pick(odd), 'rearrange the board');
  }
  const placed = new Set(findAll(snap, /^return .* to the tray$/i).map((c) => c.name.replace(/^return | to the tray$/gi, '')));
  const tray = snap.controls.filter((c) => c.pressed === false && !c.disabled && !placed.has(c.name.replace(/^\d+\s*/, '')));
  if (tray.length) return click(rng.pick(tray), 'pick up a card');
  return null;
}

export default makeStrategy({
  players: [1, 4],
  axes: {
    format: ['round', 'tiers', 'ranked'],
    axisId: ['best', 'year', 'rated', 'popular', 'length', 'favourites', 'overrated', 'rewatch', 'fight'],
    sharedOnly: [true, false],
    scoring: [true, false],
    blind: [true, false],
  },
  // Tier formats rank opinion only (a fact axis has a right answer, and a
  // tier list has no answer key to hold it to), and a lone player with an
  // opinion axis has nobody to be scored against — setup refuses both, by
  // design, so the scenario does not ask for them.
  adjustPrefs(prefs, { players }) {
    const out = { ...prefs };
    if (out.format !== 'round') out.axisId = 'best';
    if (players === 1) out.scoring = false;
    return out;
  },
  isDone(snap, ctx) {
    return Boolean(ctx.memory.tierDone) || /^results$/i.test(snap.heading) && Boolean(find(snap, /new ten|play again|back to lobby/i, { enabled: false }))
      || has(snap, /where two lists agree/i);
  },
  // A stat axis (year, score, popularity) deals only cards that carry the
  // stat, and a shared-only pool can fall short of ten. Setup says so and
  // refuses; a player widens the pool, and failing that the refusal stands.
  fixBlocked(snap) {
    const shared = find(snap, /shared shows only/i, { role: 'checkbox' });
    return shared?.checked ? click(shared, 'turn off shared-only') : null;
  },
  onBlocked: () => ({ expected: true }),
  // Online, the tier formats compare lists already built in LOCAL play, which
  // a fresh online device does not have; the online bots play the round.
  onlinePrefs: (prefs) => ({ ...prefs, format: 'round' }),
  // A tier comparison is two lists, not the table.
  endRoster: (snap, ctx) => (ctx.scenario.prefs.format === 'round' ? ctx.playing : null),
  act(snap, ctx) {
    return ctx.scenario.prefs.format === 'round' ? boardAction(snap, ctx) : tierAction(snap, ctx);
  },
});
