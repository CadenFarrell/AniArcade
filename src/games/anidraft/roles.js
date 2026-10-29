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

/** A role id back to its card — or a stand-in, so a role from a newer deck still draws. */
export const roleOf = (id) => BY_ID.get(id) ?? { id, name: 'Wildcard', hint: '' };

/** `n` different role ids, at random. Pure, with an injectable rng, so a seed is a replay. */
export function dealRoles(n, rng = Math.random, avoid = []) {
  const skip = new Set(avoid);
  // Prefer roles the last deal did not hold, so a reshuffle actually changes
  // the round; fall back to the whole deck when it is too small to.
  const fresh = ROLE_DECK.filter((r) => !skip.has(r.id));
  const deck = (fresh.length >= n ? fresh : ROLE_DECK).map((r) => r.id);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, n);
}
