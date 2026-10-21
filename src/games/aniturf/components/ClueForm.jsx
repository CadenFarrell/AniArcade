import { useState } from 'react';
import { Banner, Button, Field, Input, NumberInput } from '../../../shared/ui';
import { MAX_CLUE, validClue } from '../rules';

// The clue-giver's one move: a word and how many squares it is for. The
// number is also how many claims the clue allows, so it is capped at 9 and
// can never be zero.
//
// The word is checked as it is typed (rules.validClue) rather than on submit,
// so "that's part of Levi Ackerman's name" arrives before the press rather
// than as a refusal after it.
export default function ClueForm({ board, onSubmit, disabled = false }) {
  const [word, setWord] = useState('');
  const [number, setNumber] = useState(2);
  const check = validClue(word, board);
  const typed = word.trim().length > 0;
  return (
    <form
      className="mb-5 border-2 border-ink bg-surface p-4 shadow-pop-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (check.ok && !disabled) onSubmit(word.trim(), number);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field label="Clue" htmlFor="aniturf-clue">
          <Input
            id="aniturf-clue"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            autoComplete="off"
            maxLength={40}
            placeholder="One word"
          />
        </Field>
        <Field label="For how many squares" htmlFor="aniturf-number">
          {/* The aria-label repeats the visible label word for word: a
              screen reader announcing "Number" beside a field labelled "For how
              many squares" names a control nobody can see. */}
          <NumberInput id="aniturf-number" ariaLabel="For how many squares" min={1} max={MAX_CLUE} value={number} onChange={setNumber} />
        </Field>
      </div>
      {typed && !check.ok && <Banner tone="warning" className="mt-3">{check.reason}</Banner>}
      <Button type="submit" variant="primary" size="lg" fullWidth className="mt-4" disabled={!check.ok || disabled}>
        Give the clue
      </Button>
    </form>
  );
}
