import { useState } from 'react';
import { Button, Icon } from '../../../shared/ui';
import { MAX_GUESS } from '../rules';

/**
 * Online guessing: the box and the feed.
 *
 * The feed shows every WRONG guess as typed — half the fun of a drawing game
 * is the table's wrong answers — and a right one only as "<name> got it": its
 * text is the answer (and the drawer's judge blanks it in state anyway). A
 * guess waiting on the drawer's phone shows as "checking…" to its own sender
 * only. Newest first, so the latest is beside the box on a phone.
 */
export function GuessFeed({ game, players, youId = null }) {
  const nameOf = (id) => (id === youId ? 'You' : players.find((p) => p.id === id)?.name ?? 'Someone');
  const rows = [...game.guesses].reverse().filter((g) => g.verdict !== 'pending' || g.by === youId);
  if (!rows.length) return null;
  return (
    <ul className="mb-4 max-h-56 overflow-y-auto border-2 border-ink bg-surface" aria-label="Guesses">
      {rows.map((g) => (
        <li key={g.n} className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-sm last:border-0">
          <span className="font-bold text-fg-strong">{nameOf(g.by)}</span>
          {g.verdict === 'right' && (
            <span className="ml-auto inline-flex items-center gap-1 font-display font-bold uppercase text-pop-lime">
              <Icon name="check" /> got it
            </span>
          )}
          {g.verdict === 'wrong' && <span className="min-w-0 flex-1 text-fg-body [overflow-wrap:anywhere]">{g.text}</span>}
          {g.verdict === 'pending' && <span className="min-w-0 flex-1 text-fg-helper">{g.text} — checking…</span>}
        </li>
      ))}
    </ul>
  );
}

/** The guess box: one line, sent with Enter or "Guess". Disabled while one is waiting. */
export function GuessBar({ onGuess, waiting = false }) {
  const [text, setText] = useState('');
  const send = (e) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || waiting) return;
    onGuess(clean);
    setText('');
  };
  return (
    <form onSubmit={send} className="mb-4 flex gap-2">
      <label htmlFor="anisketch-guess" className="sr-only">Your guess</label>
      <input
        id="anisketch-guess"
        type="text"
        value={text}
        maxLength={MAX_GUESS}
        autoComplete="off"
        placeholder="Who is it?"
        onChange={(e) => setText(e.target.value)}
        className="focus-pop field-lit min-w-0 flex-1 rounded-pop-sm border-2 border-ink bg-surface px-3 py-2 text-fg-strong"
      />
      <Button type="submit" variant="primary" disabled={!text.trim() || waiting}>Guess</Button>
    </form>
  );
}
