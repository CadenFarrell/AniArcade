// The role deck: what a round asks each team to fill. Five are dealt a round
// (rules.ROLES_PER_ROUND) and every team drafts one character into each.
//
// A role is a job in a story, never a fact about a character — nothing on a
// profile says who is a healer, and that is the point: the table argues it.
// So no role may need data the arcade does not have (powers, quotes, hair),
// and none should have an obvious one-character answer, or every round is a
// race to take that character.
//
// The hint is the one line under the role's name on the board and the ballot:
// what the table is voting on. Ids are what a room stores, so never reuse one
// for a different role — a saved room would read the old id as the new job.
export const ROLE_DECK = [
  { id: 'captain', name: 'Captain', hint: 'Leads the team into the final arc' },
  { id: 'rival', name: 'Rival', hint: 'Pushes the captain to be better' },
  { id: 'healer', name: 'Healer', hint: 'Patches everyone up after the fight' },
  { id: 'comic', name: 'Comic Relief', hint: 'Keeps the mood up when things go wrong' },
  { id: 'boss', name: 'Final Boss', hint: 'Who the team would least want to face' },
  { id: 'friend', name: 'Best Friend', hint: 'Has your back, no questions asked' },
  { id: 'mentor', name: 'Mentor', hint: 'Teaches the team everything they know' },
  { id: 'strategist', name: 'Strategist', hint: 'Plans three moves ahead' },
  { id: 'wildcard', name: 'Wildcard', hint: 'Nobody knows what they’ll do next' },
  { id: 'muscle', name: 'The Muscle', hint: 'Hits hardest when it counts' },
  { id: 'cook', name: 'Team Cook', hint: 'The one you trust with dinner' },
  { id: 'traitor', name: 'Secret Traitor', hint: 'Most likely to switch sides' },
  { id: 'mascot', name: 'Mascot', hint: 'Would be on the merch' },
  { id: 'driver', name: 'Getaway Driver', hint: 'Gets everyone out alive' },
  { id: 'spy', name: 'Spy', hint: 'Gets in anywhere without being noticed' },
  { id: 'heart', name: 'Heart of the Team', hint: 'The reason everyone keeps going' },
  { id: 'lancer', name: 'Lone Wolf', hint: 'Works alone, shows up when it matters' },
  { id: 'genius', name: 'Genius', hint: 'Solves the problem nobody else can' },
  { id: 'protector', name: 'Bodyguard', hint: 'Takes the hit for everyone else' },
  { id: 'hype', name: 'Hype Man', hint: 'Loudest voice in the room' },
  { id: 'roommate', name: 'Roommate', hint: 'Easiest to live with' },
  { id: 'detective', name: 'Detective', hint: 'Spots the lie first' },
  { id: 'chaos', name: 'Agent of Chaos', hint: 'Starts the trouble, enjoys it' },
  { id: 'veteran', name: 'Veteran', hint: 'Has seen it all and survived' },
  { id: 'rookie', name: 'Rookie', hint: 'The newcomer with the most potential' },
  { id: 'diplomat', name: 'Negotiator', hint: 'Talks the team out of a fight' },
  { id: 'teacher', name: 'Homeroom Teacher', hint: 'Would keep the class in line' },
  { id: 'villain-redeemed', name: 'Redeemed Villain', hint: 'Started as the enemy, ended as family' },
  { id: 'survivor', name: 'Last One Standing', hint: 'Outlives everyone else' },
  { id: 'icon', name: 'Fan Favourite', hint: 'Who the crowd is cheering for' },
];

const BY_ID = new Map(ROLE_DECK.map((r) => [r.id, r]));
const BUILT_IN_IDS = ROLE_DECK.map((r) => r.id);

// ── Written roles ────────────────────────────────────────────────────────
//
// The host can write their own roles (RoleEditor, kept on their device by
// useCustomRoles) and pick which deck a game deals from. The "a job in a story"
// rule above holds for those only as far as the host keeps it: the app cannot
// check a role, and a table writing "Best Hair" has chosen that argument.
//
// A written role's id starts `mine-`, which no built-in id does, so the two
// can never be read as each other. It is also a legal RTDB key (no . # $ [ ] /),
// because a game stores its written roles as a map keyed by id.
//
// THE DECK RIDES IN THE GAME (rules.startGame's `customRoles`), unlike AniTag's
// written categories, which never leave their device. Online, "Next round" is
// dealt by whichever phone presses it, from the stored game, and a guest's
// phone has none of the host's roles; and every screen names a dealt role from
// the game, on every phone. So at Start the host's deck is copied in — the
// roles the chosen deck draws from, never the ones it does not.

export const MAX_ROLE_NAME = 24;
export const MAX_ROLE_HINT = 60;

// The deck a game deals from. 'both' is the default because with nothing
// written it IS the built-in deck: nobody who never opens the editor sees a
// change, and someone who writes a role sees it dealt without a second step.
export const ROLE_DECKS = [
  { value: 'builtin', label: 'Built-in deck' },
  { value: 'both', label: 'Built-in + mine' },
  { value: 'mine', label: 'Only mine' },
];
export const isOwnRoleId = (id) => typeof id === 'string' && id.startsWith('mine-');

// Trim, fold runs of whitespace, cap — and trim again, or a cut landing on a
// space stores a trailing one the editor's preview would not show.
const clean = (text, max) => (typeof text === 'string' ? text : '').trim().replace(/\s+/g, ' ').slice(0, max).trim();

/**
 * A draft into the stored shape `{ id, name, hint? }`, or null when there is no
 * name. The hint is optional and simply absent when empty: RTDB refuses a write
 * carrying `undefined`, and an empty string would render an empty line.
 * Keeping an existing id is what makes the editor's save an update.
 */
export function normalizeCustomRole(draft) {
  const name = clean(draft?.name, MAX_ROLE_NAME);
  if (!name) return null;
  const id = isOwnRoleId(draft?.id) && /^[\w-]+$/.test(draft.id)
    ? draft.id
    : `mine-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const hint = clean(draft?.hint, MAX_ROLE_HINT);
  return hint ? { id, name, hint } : { id, name };
}

/**
 * The written roles a game carries, `{ [id]: { name, hint? } }`, from a list of
 * them and the chosen deck: none for the built-in deck, so a game that does not
 * deal them does not publish them either. Duplicates by id keep the first.
 */
export function deckRoles(roleDeck, ownRoles = []) {
  if (roleDeck === 'builtin') return {};
  const out = {};
  for (const r of ownRoles) {
    const role = normalizeCustomRole(r);
    if (role && !out[role.id]) out[role.id] = role.hint ? { name: role.name, hint: role.hint } : { name: role.name };
  }
  return out;
}

/** The ids a game deals from: its deck choice over the written roles it carries. */
export function deckIds(roleDeck, customRoles = {}) {
  const mine = Object.keys(customRoles ?? {}).filter(isOwnRoleId);
  if (roleDeck === 'mine') return mine;
  if (roleDeck === 'both') return [...BUILT_IN_IDS, ...mine];
  return BUILT_IN_IDS;
}

/**
 * A role id back to its card — the game's written roles first, then the
 * built-in deck — or a stand-in, so a role from a newer deck still draws.
 */
export const roleOf = (id, customRoles = null) => {
  const own = customRoles?.[id];
  if (own?.name) return { id, name: own.name, hint: own.hint ?? '' };
  return BY_ID.get(id) ?? { id, name: 'Wildcard', hint: '' };
};

/**
 * `n` different role ids, at random, from `ids` (the built-in deck unless the
 * game deals from another). Pure, with an injectable rng, so a seed is a replay.
 */
export function dealRoles(n, rng = Math.random, avoid = [], ids = BUILT_IN_IDS) {
  const skip = new Set(avoid);
  const shuffled = (list) => {
    const deck = [...list];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };
  // Prefer roles the last deal did not hold, so a reshuffle actually changes
  // the round. A small written deck (seven roles, five a round) cannot avoid
  // all of them, so it takes every fresh one and tops up from the rest, rather
  // than dropping back to the whole deck and maybe dealing the same five.
  const fresh = ids.filter((id) => !skip.has(id));
  if (fresh.length >= n) return shuffled(fresh).slice(0, n);
  return [...shuffled(fresh), ...shuffled(ids.filter((id) => skip.has(id)))].slice(0, n);
}
