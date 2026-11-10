import MoreSettings from '../../../shared/components/MoreSettings';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, Field, Select } from '../../../shared/ui';
import { CLOCK_OPTIONS, DEFAULT_PREFS, POOL_OPTIONS, ROLE_DECK_OPTIONS, ROUNDS_OPTIONS } from '../prefs';
import { ROLES_PER_ROUND } from '../rules';
import { ROLE_DECK } from '../roles';

const BUILT_IN_COUNT = ROLE_DECK.length;

/**
 * AniDraft's Settings card, rendered by both the local setup screen and the
 * online lobby. `host` adds the lobby's "your settings apply to everyone";
 * `online` adds the pick clock, which a table on one device has no use for —
 * everyone is watching the picker already.
 *
 * One `onChange(key, value)`, because the lobby's settings object is what
 * leaves the host's device. Every option reaches the game through
 * rules.startGame.
 *
 * `ownRoles` is how many roles this device has written (RoleEditor, under
 * this card), which the Roles note counts so the choice says what it deals.
 */
export default function AniDraftSettings({ values, onChange, onReset, host = false, online = false, ownRoles = 0 }) {
  // The footer compares against what this screen can reach: locally the clock
  // is not on the card, so a saved online clock must not read as "changed".
  const shown = online ? values : { ...values, pickClock: DEFAULT_PREFS.pickClock };
  return (
    <Card title="Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <Field label="Rounds" htmlFor="anidraft-rounds" className="mb-2">
        <Select id="anidraft-rounds" value={String(values.rounds)} onChange={(e) => onChange('rounds', Number(e.target.value))}>
          {ROUNDS_OPTIONS.map((n) => <option key={n} value={String(n)}>{n} round{n === 1 ? '' : 's'}</option>)}
        </Select>
      </Field>
      <SettingHelp
        className="mb-5"
        more="The first pick moves one seat each round, and so does the last — in a snake they are the same player’s back-to-back picks."
      >
        {`A round is one draft of ${ROLES_PER_ROUND} roles and one vote.`}
      </SettingHelp>

      <Field label="Roles" htmlFor="anidraft-roles" className="mb-2">
        <Select id="anidraft-roles" value={values.roleDeck} onChange={(e) => onChange('roleDeck', e.target.value)}>
          {ROLE_DECK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      <SettingHelp
        className="mb-5"
        more={`Write roles in “Your own roles” below. “Only mine” needs at least ${ROLES_PER_ROUND}; with fewer than ${ROLES_PER_ROUND} for each round, some come back in a later round.`}
      >
        {rolesNote(values.roleDeck, ownRoles)}
      </SettingHelp>

      {online && (
        <>
          <Field label="Pick clock" htmlFor="anidraft-clock" className="mb-2">
            <Select id="anidraft-clock" value={String(values.pickClock)} onChange={(e) => onChange('pickClock', Number(e.target.value))}>
              {CLOCK_OPTIONS.map((o) => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
            </Select>
          </Field>
          <SettingHelp className="mb-2" more="When it runs out, the first card left on the board goes into the picker’s first empty role.">
            How long each pick may take.
          </SettingHelp>
        </>
      )}

      {host && (
        <p className="mt-4 text-sm text-fg-subtle">You&apos;re the host — your settings apply to everyone.</p>
      )}

      <MoreSettings>
        <Field label="Characters" htmlFor="anidraft-pool" className="mb-2">
          <Select id="anidraft-pool" value={values.pool} onChange={(e) => onChange('pool', e.target.value)}>
            {POOL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <SettingHelp more="Either way the board favours characters more of the table has on their lists, so there is someone to argue about.">
          Who can turn up on the board.
        </SettingHelp>
      </MoreSettings>

      <SettingsFooter values={shown} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}

// What the chosen deck deals, counted, so "Built-in + mine" with nothing
// written does not read as though something of yours is in it.
function rolesNote(deck, own) {
  const yours = `${own} of your own`;
  if (deck === 'builtin') return `${BUILT_IN_COUNT} built-in roles${own ? ` — your ${own} sit this one out` : ''}.`;
  if (deck === 'mine') return own ? `Only the ${own} role${own === 1 ? '' : 's'} you wrote.` : 'Only roles you write — none yet.';
  return own ? `${BUILT_IN_COUNT} built-in roles and ${yours}.` : `${BUILT_IN_COUNT} built-in roles — write your own below to add them.`;
}
