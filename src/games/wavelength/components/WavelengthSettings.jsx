import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Button, Card, Checkbox, Field, NumberInput } from '../../../shared/ui';
import { SETTING_HELP, sharedOnlyHelp } from '../help';
import { DEFAULT_PREFS, MAX_GUESS_SECONDS, MAX_ROUNDS, MIN_GUESS_SECONDS, MIN_ROUNDS } from '../prefs';
import { needsCardPool } from '../rules';
import { CARD_POOLS, poolNoun } from '../utils/cards';

/**
 * AniWave's ⚙️ Settings card, rendered by both WavelengthSetup and the online
 * lobby. AniTagSettings and AniTuneSettings are the precedent. The two copies
 * had already drifted: local play's reset link sat outside the card, under
 * Start, while the lobby's sat inside it.
 *
 * `online` adds the timer. It only makes sense where everyone dials at once,
 * not on a hot seat being passed round a table, so the lobby offers a SUPERSET
 * of local play's options — which is why each screen's savePrefs merges rather
 * than replaces, and why the footer compares only the keys the caller holds:
 * `values` is exactly that set on both screens.
 *
 * Everything about the card pool renders only in the modes that deal
 * (`needsCardPool`), so the default typed-clue path stays the shortest settings
 * card in the arcade. See CLAUDE.md on why that default is load-bearing.
 *
 * ONE `onChange(key, value)` for AniTagSettings' reason: the lobby's object IS
 * what leaves the host's device.
 */
export default function WavelengthSettings({
  values, onChange, eligible, playerCount, online = false, onReset,
}) {
  const { rounds, clueMode, cardPool, sharedOnly, timed, guessSeconds } = values;
  const needsCards = needsCardPool(clueMode);
  const noun = poolNoun(cardPool);
  const sharedHelp = sharedOnlyHelp({ noun });
  const defaults = Object.fromEntries(Object.keys(values).map((k) => [k, DEFAULT_PREFS[k]]));

  return (
    <Card title="⚙️ Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <Field label="Rounds" htmlFor="aniwave-rounds" className="mb-2">
        <NumberInput
          id="aniwave-rounds"
          ariaLabel="Rounds"
          min={MIN_ROUNDS}
          max={MAX_ROUNDS}
          value={rounds}
          onChange={(v) => onChange('rounds', v)}
        />
      </Field>
      <SettingHelp className="mb-5" more={SETTING_HELP.rounds.more}>
        {SETTING_HELP.rounds.short}
      </SettingHelp>

      {needsCards && (
        <>
          <Field label="Cards" className="mb-2">
            <div className="flex gap-3">
              {CARD_POOLS.map((pool) => (
                <Button
                  key={pool}
                  variant={cardPool === pool ? 'secondary' : 'neutral'}
                  size="md"
                  fullWidth
                  aria-pressed={cardPool === pool}
                  onClick={() => onChange('cardPool', pool)}
                >
                  {pool === 'shows' ? 'Shows' : 'Characters'}
                </Button>
              ))}
            </div>
          </Field>
          <SettingHelp className="mb-5" more={SETTING_HELP.cardPool.more}>
            {SETTING_HELP.cardPool.short}
          </SettingHelp>

          <Checkbox
            label="Shared cards only"
            checked={sharedOnly}
            onChange={(e) => onChange('sharedOnly', e.target.checked)}
            className="mb-2"
          />
          <SettingHelp indent more={sharedHelp.more}>
            {sharedHelp.short}
          </SettingHelp>

          {/* The count itself, not only the warning: a mode can be perfectly
              playable and still narrow a small shared list more than anyone
              expected, and seeing the number is what makes the shared-only
              checkbox above it legible. */}
          <p className={`mt-3 text-sm text-fg-helper ${online ? 'mb-5' : ''}`}>
            {eligible} {noun} to draw from
            {sharedOnly && playerCount > 1 && ' (shared by everyone)'}
          </p>
        </>
      )}

      {online && (
        <>
          <Checkbox
            label="Time the guessing"
            checked={timed}
            onChange={(e) => onChange('timed', e.target.checked)}
            className="mb-2"
          />
          <SettingHelp indent className="mb-5" more={SETTING_HELP.timed.more}>
            {SETTING_HELP.timed.short}
          </SettingHelp>

          {timed && (
            <Field label="Seconds to dial" htmlFor="aniwave-seconds">
              <NumberInput
                id="aniwave-seconds"
                ariaLabel="Seconds to dial"
                min={MIN_GUESS_SECONDS}
                max={MAX_GUESS_SECONDS}
                step={5}
                value={guessSeconds}
                onChange={(v) => onChange('guessSeconds', v)}
              />
            </Field>
          )}
        </>
      )}

      <SettingsFooter values={values} defaults={defaults} onReset={onReset} />
    </Card>
  );
}
