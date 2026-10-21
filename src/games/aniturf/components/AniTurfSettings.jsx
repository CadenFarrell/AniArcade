import MoreSettings from '../../../shared/components/MoreSettings';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, Checkbox, Field, NumberInput } from '../../../shared/ui';
import { DEFAULT_PREFS } from '../prefs';
import { MAX_TRAPS } from '../rules';

/**
 * AniTurf's Settings card, rendered by both the local setup screen and the
 * online lobby. Nothing in it is local- or online-only, so it takes no
 * `local` prop; `host` adds the lobby's "your settings apply to everyone".
 *
 * One `onChange(key, value)`, because the lobby's settings object is what
 * leaves the host's device — a setter per option puts the drift between the
 * two screens back one level down.
 */
export default function AniTurfSettings({ values, onChange, onReset, host = false }) {
  const { sharedOnly, traps } = values;
  return (
    <Card title="Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <Checkbox
        label="Shared characters only"
        checked={sharedOnly}
        onChange={(e) => onChange('sharedOnly', e.target.checked)}
        className="mb-2"
      />
      <SettingHelp
        indent
        more="The board needs 25 characters, which a list everyone shares rarely reaches. With this off, the draw still leans toward characters more of you know."
      >
        Only deal characters on every player&apos;s list.
      </SettingHelp>

      {host && (
        <p className="mt-4 text-sm text-fg-subtle">You&apos;re the host — your settings apply to everyone.</p>
      )}

      <MoreSettings>
        <Field label="Traps per team" htmlFor="aniturf-traps" className="mb-2">
          <NumberInput
            id="aniturf-traps"
            ariaLabel="Traps per team"
            min={0}
            max={MAX_TRAPS}
            value={traps}
            onChange={(v) => onChange('traps', v)}
          />
        </Field>
        <SettingHelp
          className="mb-2"
          more="A trap springs only on the other team's footing: the square is scorched and that team loses its newest claim. Each clue-giver plants theirs before the first clue, without seeing the other key — the team that moves second plants one extra."
        >
          {traps ? 'Planted against the other team before the first clue.' : 'No traps — only misses and blocked routes.'}
        </SettingHelp>
      </MoreSettings>

      <SettingsFooter values={values} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}
