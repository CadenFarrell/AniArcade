import { useState } from 'react';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button, Input, NumberInput } from '../../../shared/ui';
import { MAX_CLUE, validClue } from '../rules';

// The clue-giver's one move: a word and how many squares it is for. The
// number is also how many claims the clue allows, so it is capped at 9 and
// can never be zero.
//
// Pinned to the bottom of the viewport in the setup screens' StartBar, the way
// the guessers' Claim is: under the board it sat ~960px down a phone, the one
// main action left below the fold. The board stays the whole screen above it,
// which is what the clue-giver is reading while they think. The screen around
// it needs `pb-48!` to clear the bar, which wraps to two rows on a phone.
//
// The word is checked as it is typed (rules.validClue), and the reason a word
// is refused ("part of Levi Ackerman's name") is the bar's status line — read
// out as it changes, and right beside the disabled button it explains.
//
// `max` is rules.clueLimit: 1 on the game's opening clue, which pays back the
// head start of moving first — and the status line says so, or a stepper stuck
// at 1 reads as broken.
export default function ClueForm({ board, onSubmit, disabled = false, max = MAX_CLUE }) {
  const [word, setWord] = useState('');
  const [number, setNumber] = useState(Math.min(2, max));
  const check = validClue(word, board);
  const typed = word.trim().length > 0;
  const idle = max === 1
    ? 'Opening clue: one square. Moving first is the head start.'
    : 'One word, and how many squares it points to.';
  const status = typed && !check.ok ? check.reason : idle;
  const label = 'mb-1 block font-display text-[11px] font-bold uppercase tracking-[0.2em] text-fg-helper';
  return (
    <StartBar status={status} ready={check.ok} width="md">
      <form
        className="flex flex-wrap items-end justify-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (check.ok && !disabled) onSubmit(word.trim(), Math.min(number, max));
        }}
      >
        <div className="w-40 sm:w-52">
          <label htmlFor="aniturf-clue" className={label}>Clue</label>
          <Input
            id="aniturf-clue"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            autoComplete="off"
            maxLength={40}
            placeholder="One word"
            className="py-2.5"
          />
        </div>
        <div className="w-36">
          {/* A visible word for the stepper, and the same word as its name —
              a name that differs from the label on screen announces a control
              nobody can see. */}
          <span aria-hidden="true" className={label}>Squares</span>
          <NumberInput id="aniturf-number" ariaLabel="Squares" size="sm" min={1} max={max} value={Math.min(number, max)} onChange={setNumber} />
        </div>
        <Button type="submit" variant="primary" size="lg" disabled={!check.ok || disabled}>
          Give the clue
        </Button>
      </form>
    </StartBar>
  );
}
