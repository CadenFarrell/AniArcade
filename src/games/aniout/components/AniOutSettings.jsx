import MoreSettings from '../../../shared/components/MoreSettings';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, Checkbox, Field, NumberInput } from '../../../shared/ui';
import { CARDS_RANGE, DEFAULT_PREFS, ROUNDS_RANGE } from '../prefs';
import { REASON_POINTS } from '../rules';

/**
 * AniOut's Settings card, rendered by both the local setup screen and the
 * online lobby. Nothing in it is local- or online-only; `host` adds the
 * lobby's "your settings apply to everyone".
 *
 * One `onChange(key, value)`, because the lobby's settings object is what
 * leaves the host's device. Every option here reaches only the deal — none of
 * them is round state — so nothing in the room hook copies them.
 */
export default function AniOutSettings({ values, onChange, onReset, host = false }) {
  return (
    <Card title="Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <Field label="Rounds" htmlFor="aniout-rounds" className="mb-2">
        <NumberInput
          id="aniout-rounds"
          ariaLabel="Rounds"
          min={ROUNDS_RANGE.min}
          max={ROUNDS_RANGE.max}
          value={values.rounds}
          onChange={(v) => onChange('rounds', v)}
        />
      </Field>
      <SettingHelp className="mb-5" more="No two rounds in a row are about the same kind of connection, and no character is the odd one out twice in a game.">
        One set of characters a round.
      </SettingHelp>

      <Field label="Characters per round" htmlFor="aniout-cards" className="mb-2">
        <NumberInput
          id="aniout-cards"
          ariaLabel="Characters per round"
          min={CARDS_RANGE.min}
          max={CARDS_RANGE.max}
          value={values.cards}
          onChange={(v) => onChange('cards', v)}
        />
      </Field>
      <SettingHelp className="mb-5" more="More characters make a lucky guess less likely, but every extra one is another chance for a second odd one out, so big rounds are harder to find in a small list.">
        All but one of them share the connection.
      </SettingHelp>

      <Checkbox
        label="Name the reason"
        checked={values.reasons}
        onChange={(e) => onChange('reasons', e.target.checked)}
        className="mb-2"
      />
      <SettingHelp
        indent
        more="The reason only pays beside a right pick, so it rewards knowing why over a lucky tap. The three wrong reasons are true of some of the characters — never all of the five."
      >
        {values.reasons
          ? `Pick why the rest belong together too, for +${REASON_POINTS}.`
          : 'Just pick who is out.'}
      </SettingHelp>

      {host && (
        <p className="mt-4 text-sm text-fg-subtle">You&apos;re the host — your settings apply to everyone.</p>
      )}

      <MoreSettings>
        <Checkbox
          label="Shared characters only"
          checked={values.sharedOnly}
          onChange={(e) => onChange('sharedOnly', e.target.checked)}
          className="mb-2"
        />
        <SettingHelp
          indent
          more="Off, a character only one of you has seen can come up. The deal leans toward characters more of you know either way."
        >
          Only deal characters on every player&apos;s list.
        </SettingHelp>
      </MoreSettings>

      <SettingsFooter values={values} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}
