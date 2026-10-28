import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, Field, NumberInput, Select } from '../../../shared/ui';
import { DEFAULT_PREFS, ROUNDS_RANGE, SECONDS_OPTIONS } from '../prefs';

/**
 * AniName's Settings card, rendered by both the local setup screen and the
 * online lobby. Nothing in it is local- or online-only; `host` adds the
 * lobby's "your settings apply to everyone".
 *
 * One `onChange(key, value)`, because the lobby's settings object is what
 * leaves the host's device. Both options reach only the deal (the naming time
 * is copied onto the game from it), so nothing in the room hook copies them.
 */
export default function AniNameSettings({ values, onChange, onReset, host = false }) {
  return (
    <Card title="Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <Field label="Rounds" htmlFor="aniname-rounds" className="mb-2">
        <NumberInput
          id="aniname-rounds"
          ariaLabel="Rounds"
          min={ROUNDS_RANGE.min}
          max={ROUNDS_RANGE.max}
          value={values.rounds}
          onChange={(v) => onChange('rounds', v)}
        />
      </Field>
      <SettingHelp className="mb-5" more="The opener moves one seat every round, so a round count that is a multiple of the table lets everyone open equally often.">
        One category a round.
      </SettingHelp>

      <Field label="Time to name" htmlFor="aniname-seconds" className="mb-2">
        <Select
          id="aniname-seconds"
          value={String(values.seconds)}
          onChange={(e) => onChange('seconds', Number(e.target.value))}
        >
          {SECONDS_OPTIONS.map((s) => <option key={s} value={String(s)}>{s} seconds</option>)}
        </Select>
      </Field>
      <SettingHelp className="mb-2" more="The clock is the same whatever the bid, so a big bid is a race. Typing on a phone is slower than saying it, so a minute is a fair start.">
        How long the top bidder has to type their answers.
      </SettingHelp>

      {host && (
        <p className="mt-4 text-sm text-fg-subtle">You&apos;re the host — your settings apply to everyone.</p>
      )}

      <SettingsFooter values={values} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}
