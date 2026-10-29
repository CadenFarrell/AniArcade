import { Checkbox, Field, NumberInput } from '../ui';
import SettingHelp from './SettingHelp';
import { MAX_MATCH_ROUNDS, isEndless } from '../utils/match';

/**
 * The "Rounds" control of a game that used to be endless (shared/utils/match.js):
 * a round count, and an Endless box beside it that keeps the old loop. One
 * component so the three games word it alike and store it alike — `rounds` of
 * 0 is endless, and unticking the box goes back to the game's default count.
 *
 * Reports through the settings card's `onChange(key, value)` like every other
 * control, since the lobby's settings object is what leaves the host's device.
 */
export default function MatchLengthSetting({ id, value, defaultRounds, onChange, unit = 'round', className = 'mb-5' }) {
  const endless = isEndless(value);
  return (
    <div className={className}>
      <Field label="Rounds" htmlFor={id} className="mb-2">
        <div className="flex flex-wrap items-center gap-4">
          {!endless && (
            // w-40: NumberInput's field is w-0 flex-1 (it takes what the two
            // buttons leave), and as a flex ITEM beside the Endless box the
            // stepper is sized to its content, which leaves the field 16px:
            // the round count was invisible on every setup screen.
            <NumberInput
              id={id}
              className="w-40"
              ariaLabel="Rounds"
              min={1}
              max={MAX_MATCH_ROUNDS}
              value={value}
              onChange={(v) => onChange('rounds', v)}
            />
          )}
          <Checkbox
            label="Endless"
            checked={endless}
            onChange={(e) => onChange('rounds', e.target.checked ? 0 : defaultRounds)}
          />
        </div>
      </Field>
      <SettingHelp
        more={`Endless plays ${unit}s until someone ends it, the way this game always used to, and the results show whatever the table had by then.`}
      >
        {endless
          ? `No set length: play ${unit}s until you choose to end.`
          : `After the last ${unit}, the final results crown a winner.`}
      </SettingHelp>
    </div>
  );
}
