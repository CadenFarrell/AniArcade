import MoreSettings from '../../../shared/components/MoreSettings';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { Card, Checkbox, Field, NumberInput } from '../../../shared/ui';
import { BOARDS_RANGE, CARDS_RANGE, DEFAULT_PREFS, ROUNDS_RANGE } from '../prefs';
import { GROUP_POINTS, REASON_POINTS } from '../rules';

// The two games, as big pressed blocks (AniQuiz's and AniTune's mode choice):
// a whole match is one or the other. The words are what the bot presses.
const MODES = [
  { id: 'odd', label: 'Odd one out', blurb: 'All but one share something. Spot who doesn’t belong.' },
  { id: 'groups', label: 'Groups of four', blurb: 'Sort a board of characters into hidden groups of four.' },
];

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
  const groups = values.mode === 'groups';
  return (
    <Card title="Settings" action={<DetailToggle />} padding="lg" className="mb-6">
      <div className="mb-5 grid gap-3 sm:grid-cols-2" role="group" aria-label="Game">
        {MODES.map((m) => {
          const on = values.mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange('mode', m.id)}
              aria-pressed={on}
              className={`focus-pop rounded-pop border-2 p-3 text-left transition-colors
                ${on ? 'border-pop-moss bg-pop-moss/15' : 'border-line-strong bg-surface hover:border-line-loud'}`}
            >
              <span className="block font-display text-lg font-extrabold text-fg-strong">{m.label}</span>
              <span className="mt-1 block text-sm text-fg-helper">{m.blurb}</span>
            </button>
          );
        })}
      </div>

      {groups ? (
        <>
          <Field label="Boards" htmlFor="aniout-boards" className="mb-2">
            <NumberInput
              id="aniout-boards"
              ariaLabel="Boards"
              min={BOARDS_RANGE.min}
              max={BOARDS_RANGE.max}
              value={values.boards}
              onChange={(v) => onChange('boards', v)}
            />
          </Field>
          <SettingHelp className="mb-5" more="Each group shares something no other character on the board has, and every board sorts exactly one way. A list too small for four groups gets a board of three.">
            Sixteen characters a board, in four hidden groups.
          </SettingHelp>
        </>
      ) : (
        <>
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
        </>
      )}

      <Checkbox
        label="Name the reason"
        checked={values.reasons}
        onChange={(e) => onChange('reasons', e.target.checked)}
        className="mb-2"
      />
      <SettingHelp
        indent
        more={groups
          ? 'A reason only pays beside a right group. The two wrong reasons on offer are true of some characters on the board — never of a whole group.'
          : 'The reason only pays beside a right pick, so it rewards knowing why over a lucky tap. The three wrong reasons are true of some of the characters — never all of the five.'}
      >
        {reasonLine(values.reasons, groups)}
      </SettingHelp>

      {host && (
        <p className="mt-4 text-sm text-fg-subtle">You&apos;re the host — your settings apply to everyone.</p>
      )}

      <MoreSettings>
        <Checkbox
          label="Shared characters first"
          checked={values.sharedOnly}
          onChange={(e) => onChange('sharedOnly', e.target.checked)}
          className="mb-2"
        />
        <SettingHelp
          indent
          more="A whole game of characters on every list is rare (a round needs five from five different shows), so when there are not enough the game deals from everyone's lists and says so. The deal leans toward characters more of you know either way."
        >
          Deal only characters on every player&apos;s list when there are enough.
        </SettingHelp>
      </MoreSettings>

      <SettingsFooter values={values} defaults={DEFAULT_PREFS} onReset={onReset} />
    </Card>
  );
}

function reasonLine(on, groups) {
  if (!on) return groups ? `Just sort the board, ${GROUP_POINTS} a group.` : 'Just pick who is out.';
  return groups ? `Pick what joins each group too, +${REASON_POINTS} a group.` : `Pick why the rest belong together too, for +${REASON_POINTS}.`;
}
