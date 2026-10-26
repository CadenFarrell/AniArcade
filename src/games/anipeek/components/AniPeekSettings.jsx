import MoreSettings from '../../../shared/components/MoreSettings';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, Checkbox, Field, NumberInput, Select } from '../../../shared/ui';
import { ANSWER_STYLES, DEFAULT_PREFS, ROUNDS_RANGE } from '../prefs';
import { HINT_COST } from '../rules';

/**
 * AniPeek's Settings card, rendered by both the local setup screen and the
 * online lobby. Nothing in it is local- or online-only; `host` adds the
 * lobby's "your settings apply to everyone".
 *
 * One `onChange(key, value)`, because the lobby's settings object is what
 * leaves the host's device. Every option here reaches only the deal — none of
 * them is round state — so nothing in the room hook copies them.
 */
export default function AniPeekSettings({ values, onChange, onReset, host = false }) {
  return (
    <Card title="Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <Field label="Rounds" htmlFor="anipeek-rounds" className="mb-2">
        <NumberInput
          id="anipeek-rounds"
          ariaLabel="Rounds"
          min={ROUNDS_RANGE.min}
          max={ROUNDS_RANGE.max}
          value={values.rounds}
          onChange={(v) => onChange('rounds', v)}
        />
      </Field>
      <SettingHelp className="mb-5" more="The opener moves one seat on every round, so a round count that is a multiple of the table lets everyone open equally often.">
        One portrait a round.
      </SettingHelp>

      <Field label="Answers" htmlFor="anipeek-answer-style" className="mb-2">
        <Select
          id="anipeek-answer-style"
          value={values.answerStyle}
          onChange={(e) => onChange('answerStyle', e.target.value)}
        >
          {ANSWER_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </Field>
      <SettingHelp className="mb-5">
        {ANSWER_STYLES.find((s) => s.id === values.answerStyle)?.blurb}
      </SettingHelp>

      <Checkbox
        label="Hint cards"
        checked={values.hints}
        onChange={(e) => onChange('hints', e.target.checked)}
        className="mb-2"
      />
      <SettingHelp
        indent
        more="Each one tells you something about the character's show — its studio, the year it first aired, its format and what it was adapted from. A fact nobody's list or the fact pack has is shown, switched off, so you know what you are missing."
      >
        {values.hints
          ? `The bidder can spend ${HINT_COST} tiles of their bid on a fact about the show.`
          : 'Pictures only — the bid buys tiles and nothing else.'}
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
          more="Off, a character only one of you has seen can come up, and they have the edge on it. The deal leans toward characters more of you know either way."
        >
          Only deal characters on every player&apos;s list.
        </SettingHelp>
      </MoreSettings>

      <SettingsFooter values={values} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}
