// Which shows a clue may be ABOUT — the targeting half of the fact pack, which
// shared/utils/facts.js deliberately leaves to the game ("a Set lookup at draw
// time").
//
// A WRAPPER OVER anirank/utils/deck.js, for wavelength/utils/cards.js's reason:
// a card's id there IS franchiseTitleKey, which is exactly the fold the pack is
// keyed on, so the deck's franchise collapse and its shared-only filter give
// this game its subject keys for free. A second copy of those rules is how one
// show would read as "in play" in one game and not in another on the same
// device.
import { eligibleItems } from '../../anirank/utils/deck';
import { allSubjectKeys } from '../../../shared/utils/facts';

// The probe deck.js reads: an opinion kind applies no value filter, so every
// show on a list is eligible.
const SHOWS = { kind: 'opinion', items: 'shows' };

export const POOLS = [
  {
    id: 'shared',
    label: 'Shows everyone has',
    blurb: 'Only shows on every player’s list, so nobody is asked about something they never watched.',
  },
  {
    id: 'anyList',
    label: 'Shows anyone has',
    blurb: 'Any show on anybody’s list. More to draw from; some clues will be somebody else’s show.',
  },
  {
    id: 'everything',
    label: 'The whole fact pack',
    blurb: 'Hundreds of popular shows, whether or not anyone has imported them. No list needed.',
  },
];

export const DEFAULT_POOL = 'shared';

export const needsLists = (pool) => pool !== 'everything';

/**
 * The subject keys for a pool. `index` is only consulted for 'everything'.
 *
 * Returns [] rather than everything when there is nothing to go on, because
 * facts.js's factsFor falls closed on an empty list for a stated reason: falling
 * open would silently turn "shows we share" into "every show" for exactly the
 * table whose lists failed to load.
 */
export function showKeysFor(players, pool, index) {
  if (pool === 'everything') return allSubjectKeys(index, 'show');
  if (!players?.length) return [];
  return eligibleItems(players, { axis: SHOWS, sharedOnly: pool !== 'anyList' }).map((c) => c.id);
}
