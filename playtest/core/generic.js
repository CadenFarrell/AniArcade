// Screen helpers every strategy uses, plus the fallback the driver reaches for
// when a strategy has no opinion about the current screen.
//
// The fallback is deliberately a little reckless: it presses the most
// progress-looking button, fills empty boxes, and otherwise presses ANY enabled
// button that is not on the deny list. A strategy only has to understand the
// screens where a random press would be wrong or wasteful (a guess, a vote, a
// placement); every handoff, interstitial and "got it" is covered here, which
// is what keeps seven strategies short — and is also how a new screen nobody
// wrote a strategy for still gets clicked through instead of reported stuck.

// Names are matched as written AND with any leading emoji or symbols
// stripped, so a pattern names the words on a control, not its decoration —
// the arcade's restyle dropped most of the emoji ("🎲 Pick Random" became
// "Pick Random") and every pattern anchored on one went blind at once.
const bare = (name) => name.replace(/^[^\p{L}\p{N}]+/u, '');
const named = (c, re) => re.test(c.name) || re.test(bare(c.name));

export const find = (snap, re, { role, enabled = true } = {}) =>
  snap.controls.find((c) => named(c, re) && (!role || c.role === role) && (!enabled || !c.disabled));

export const findAll = (snap, re, { role, enabled = true } = {}) =>
  snap.controls.filter((c) => named(c, re) && (!role || c.role === role) && (!enabled || !c.disabled));

export const has = (snap, re) => re.test(snap.text);

export const click = (c, why) => (c ? { click: c.id, name: c.name, why } : null);
export const fill = (c, text, why) => (c ? { fill: c.id, name: c.name, text, why } : null);
export const choose = (c, value, why) => (c ? { select: c.id, name: c.name, value, why } : null);
export const wait = (ms, why) => ({ wait: ms, why });

// Never pressed by the fallback. These leave the game, destroy data, or open
// an editor the bot would wander around in forever; a strategy (or a chaos
// event) presses them on purpose when it means to.
//
// Matched against the START of a control's name, after any leading emoji or
// arrow — never anywhere in it. Show and character titles are button names
// all over the arcade, and an unanchored "online" refused every card for
// "Sword Art Online" until the bot reported the board stuck.
const DENY_START = [
  'hub', 'quit', 'leave', '←', 'back$', 'go back', 'reset', 'delete', 'remove', 'sign out',
  'cancel', 'edit', 'rename', 'import', 'refresh', 'manage', 'restore', '✕', '×', 'clear',
  'exit', 'new game', 'play again', 'change', 'create', 'join', 'my lists', 'list manager',
  'swap', 'replace', 'custom', 'add player', 'set as main', 'more detail', 'ⓘ', 'show detail',
  'hide detail', 'play online', 'peek', 'skip', 'give up', 'report', 'copy', 'share', 'new profile',
  'all-time leaderboard', 'close', 'sound on', 'sound off', 'credits', 'back to lobby',
  // The profile picker's create paths and its backup code: device housekeeping,
  // never a step in a game, and "Turn on backup" would write to the database.
  'new player', 'just a name', 'bring my', 'turn on backup', 'stop syncing', 'send link', 'not now',
];
// A name ending in a disclosure triangle opens or closes a panel and never
// moves a game on; pressed at random it is the commonest way to look busy. And
// the record screen's two ways in (the hub strip, a profile row's trophy) lead
// off to a page with no game on it.
const DENY_ANYWHERE = [/add .* to this game/i, /^take .* out of/i, /import .*'s list/i, /[▸▾]$/, /^see full record$/i, /'s record$/i];
const lead = /^[^\p{L}\p{N}←✕×ⓘ]+/u;

export const DENY = {
  test(name) {
    const n = String(name).replace(lead, '').toLowerCase();
    return DENY_START.some((w) => (w.endsWith('$') ? n === w.slice(0, -1) : n.startsWith(w)))
      || DENY_ANYWHERE.some((re) => re.test(name));
  },
};

// Pressed first, in this order, when present: the buttons that move a screen on.
const PROGRESS = [
  /— ready$/i, /^i'?m ready/i, /ready/i, /^got it/i, /^(ok|okay)\b/i,
  /continue/i, /^next/i, /→\s*$/, /reveal/i, /see (the )?results/i, /results/i,
  // `^show\b`, not `^show`: "Shows" is a card-pool option, not a way forward.
  /lock (it )?in/i, /^lock\b/i, /^submit/i, /^confirm/i, /^done/i, /finish/i, /^show\b/i,
  /^start (the )?(round|turn|game)/i, /^begin/i, /^go\b/i,
];

export function progressButton(snap) {
  for (const re of PROGRESS) {
    const c = snap.controls.find((x) => x.role === 'button' && !x.disabled && re.test(x.name) && !DENY.test(x.name));
    if (c) return c;
  }
  return null;
}

export function genericAction(snap, ctx) {
  const { rng } = ctx;
  const prog = progressButton(snap);
  if (prog) return click(prog, 'progress');

  // A <select> is a combobox too; it is told apart by carrying its options.
  const typeable = (c) => (c.role === 'textbox' || (c.role === 'combobox' && !c.options)) && !c.disabled;
  // A box the last step already filled, on a screen that did not change, threw
  // the text away (a numeric field rejecting letters): don't type into it again.
  const refused = (c) => ctx.last?.action.fill && ctx.last.action.name === c.name && ctx.last.signature === snap.signature;
  // A search box is optional — typing a random word into one usually just
  // empties the list under it — so it is filled only now and then.
  const search = (c) => /search|filter/i.test(c.name);
  const empty = snap.controls.find((c) => typeable(c) && !c.value && !DENY.test(c.name) && !refused(c)
    && (!search(c) || rng.chance(0.15)));
  if (empty) {
    return empty.numeric
      ? fill(empty, String(rng.int(1, 60)), 'fill a number')
      : fill(empty, rng.word(), 'fill an empty box');
  }
  const number = snap.controls.find((c) => c.role === 'spinbutton' && !c.disabled && c.value === '');
  if (number) return fill(number, String(rng.int(number.min ?? 0, Math.min(number.max ?? 100, 100))), 'fill a number');

  const radios = snap.controls.filter((c) => c.role === 'radio' && !c.disabled);
  if (radios.length && !radios.some((r) => r.checked)) return click(rng.pick(radios), 'pick an option');

  const any = snap.controls.filter((c) =>
    (c.role === 'button' || c.role === 'radio' || c.role === 'option') && !c.disabled && !DENY.test(c.name));
  if (any.length) return click(rng.pick(any), 'random press');

  // A search that matched nothing leaves a screen with no other way on; a
  // person clears the box, so the bot does too.
  const searched = snap.controls.find((c) => typeable(c) && c.value && search(c));
  if (searched) return fill(searched, '', 'clear the search');
  return null;
}

// ---- the arcade's shared screens -----------------------------------------
//
// Hub → mode picker → local setup → profile picker is the same path in every
// game (HubScreen.test.jsx pins it), so it is handled once here. Returns an
// action, or null when the current screen is not one of these.
export function arcadeAction(snap, ctx) {
  const { game, scenario, memory } = ctx;

  // The profile picker in 'add' mode: seat the next fixture player we want, or
  // close it once the table is full. Seated players drop out of its list, so
  // "the first wanted name still offered" is always the next one.
  if (snap.dialog) {
    const want = scenario.names.slice(1);
    const offer = want.map((n) => find(snap, new RegExp(`^add ${escape(n)} to this game`, 'i'))).find(Boolean);
    if (offer && seatedCount(memory) < scenario.names.length) {
      memory.seated = (memory.seated ?? 1) + 1;
      return click(offer, `seat ${offer.name.replace(/^add | to this game.*$/gi, '')}`);
    }
    const close = find(snap, /^close$/i) ?? find(snap, /^done$/i);
    if (close && /to this game/i.test(snap.text)) return click(close, 'close picker');
  }

  // On the hub (no phase yet, or back from a chaos exit): open this game.
  if (!memory.phase) {
    const tile = snap.controls.find((c) => c.role === 'button' && !c.disabled && c.name.includes(game.title));
    if (tile) return click(tile, 'open game tile');
  }

  const local = find(snap, /play on this device/i);
  if (local) {
    memory.seated = 1;
    memory.phase = 'setup';
    return click(local, 'local play');
  }

  // A saved game offered back (AniGuess's "Resume Game?", AniTune's resume)
  // sits OVER the setup screen in a real browser and swallows its clicks —
  // jsdom, with no layout, let them through. The strategy answers it first.
  if (find(snap, /^\W*resume/i)) return null;

  if (memory.phase === 'setup') {
    // Re-read off the screen rather than trusted from the count of picks: the
    // games that need a crowd seat the couch before the bot touches anything
    // (shared/hooks/useAutoSeat.js), and a counter that started at 1 would keep
    // opening the picker for players already sitting there.
    if (ctx.seated != null) memory.seated = ctx.seated;
    const add = find(snap, /^add player/i);
    if (add && seatedCount(memory) < scenario.names.length) return click(add, 'add player');
  }
  return null;
}

const seatedCount = (memory) => memory.seated ?? 1;
export const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A Start button on a setup screen. Kept apart from the progress list so it is
// only pressed once the table is seated and the settings are applied.
// Found enabled or not: a greyed-out Start on a full table is itself a verdict.
export const startButton = (snap) =>
  find(snap, /start game|^start$|open tier lists/i, { enabled: false });

// For the fifth of runs that reach their settings through the settings card:
// up to three presses on the card's own controls (toggles, steppers, radio
// rows, selects) before Start. Which controls are "settings" is read off the
// roles — nothing in a setup screen's roster or picker is a checkbox or a
// select — so this needs no per-game list.
export function settingsTweak(snap, ctx) {
  const { memory, rng } = ctx;
  memory.tweaks ??= 0;
  if (memory.tweaks >= 3) return null;
  const knobs = snap.controls.filter((c) => !c.disabled && (
    c.role === 'checkbox' || c.role === 'switch'
    || (c.role === 'combobox' && c.options?.length > 1)
    || (c.role === 'button' && /^(increase|decrease) /i.test(c.name))
  ));
  if (!knobs.length) return null;
  memory.tweaks++;
  const k = rng.pick(knobs);
  if (k.role === 'combobox') return choose(k, rng.pick(k.options.filter((o) => o !== k.value)) ?? k.value, 'tweak setting');
  return click(k, 'tweak setting');
}
