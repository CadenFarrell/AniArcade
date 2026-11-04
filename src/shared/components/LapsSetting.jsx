import { Field, NumberInput } from '../ui';
import SettingHelp from './SettingHelp';
import { MAX_LAPS, MIN_LAPS, roundsFor } from '../utils/match';

/**
 * The length control of a game that hands one role round the table a round at
 * a time (shared/utils/match.js's laps): how many times round, and what that
 * comes to at this table, so "2" is never a mystery number. `role` names what
 * goes round ("the psychic", "the opener") for the note.
 *
 * Reports `onChange('laps', n)` like every other control, since the lobby's
 * settings object is what leaves the host's device.
 */
export default function LapsSetting({ id, value, playerCount, role, onChange, minRounds = 1, className = 'mb-5' }) {
  const seats = Math.max(1, playerCount || 0);
  const rounds = roundsFor(value, seats, { minRounds });
  // From the rounds, not `value`: a short game lifted to minRounds goes round more often.
  const times = rounds / seats;
  return (
    <div className={className}>
      <Field label="Times round the table" htmlFor={id} className="mb-2">
        <NumberInput
          id={id}
          ariaLabel="Times round the table"
          min={MIN_LAPS}
          max={MAX_LAPS}
          value={value}
          onChange={(v) => onChange('laps', v)}
        />
      </Field>
      <SettingHelp
        more={`Counted in turns round the table rather than in rounds, so every player gets ${role} equally often at any table size.`}
      >
        {`${rounds} round${rounds === 1 ? '' : 's'} at ${seats} player${seats === 1 ? '' : 's'}: everyone is ${role} ${times === 1 ? 'once' : times === 2 ? 'twice' : `${times} times`}.`}
      </SettingHelp>
    </div>
  );
}
