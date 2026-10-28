import { useState } from 'react';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button, Input } from '../../../shared/ui';
import { MAX_GUESS } from '../rules';
import { MAX_WORD, validWord } from '../chainWords';

const LABEL = 'mb-1 block font-display text-[11px] font-bold uppercase tracking-[0.2em] text-fg-helper';

// The two typed moves, each pinned to the bottom of the viewport in a StartBar
// the way AniTurf's clue form is — the sentence above it is what the player
// is reading while they type, and on a phone a box under it sat below the
// fold. The bar's status line carries the reason a move is held, read out as
// it changes and right beside the button it explains.
//
// Words the bots and tests press: the "Your word" box and "Add word"; the
// "Your guess" box, "Guess" and "Pass".

/**
 * A giver's word. Checked as it is typed against the card's banned list
 * (chainWords.validWord), so a refusal says why before anything is sent.
 * `wait` is why the word cannot go yet (the guess window), or null.
 */
export function WordBar({ banned, wait = null, onAdd }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const check = validWord(text, banned);
  const typed = text.trim().length > 0;
  const status = typed && !check.ok ? check.reason
    : wait ?? 'One word. It has to follow what’s already been said.';
  const ok = check.ok && !wait && !sending;
  const submit = async (e) => {
    e.preventDefault();
    if (!ok) return;
    setSending(true);
    const refused = await onAdd(check.word);
    setSending(false);
    if (!refused) setText('');
  };
  return (
    <StartBar status={status} ready={ok} width="md">
      <form className="flex flex-wrap items-end justify-end gap-2" onSubmit={submit}>
        <div className="w-48 sm:w-60">
          <label htmlFor="anichain-word" className={LABEL}>Your word</label>
          <Input
            id="anichain-word"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={MAX_WORD + 5}
            placeholder="One word"
            className="py-2.5"
          />
        </div>
        <Button type="submit" variant="primary" size="lg" disabled={!ok}>Add word</Button>
      </form>
    </StartBar>
  );
}

/** A guesser's one guess on the current word — or a pass, so the next word need not wait out the clock. */
export function GuessBar({ status, onGuess, onPass }) {
  const [text, setText] = useState('');
  const ok = text.trim().length > 0;
  return (
    <StartBar status={status} ready={ok} width="md">
      <form
        className="flex flex-wrap items-end justify-end gap-2"
        onSubmit={(e) => { e.preventDefault(); if (ok) onGuess(text.trim()); }}
      >
        <div className="w-48 sm:w-60">
          <label htmlFor="anichain-guess" className={LABEL}>Your guess</label>
          <Input
            id="anichain-guess"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={MAX_GUESS}
            placeholder="A character’s name"
            className="py-2.5"
          />
        </div>
        <Button type="button" variant="neutral" size="lg" onClick={onPass}>Pass</Button>
        <Button type="submit" variant="primary" size="lg" disabled={!ok}>Guess</Button>
      </form>
    </StartBar>
  );
}
