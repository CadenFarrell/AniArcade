import { useEffect } from 'react';
import GuessInput from './GuessInput';
import { Button, GhostButton, Icon } from '../../../shared/ui';
import PlayerFace from '../../../shared/components/PlayerFace';

// Race mode: the clip plays for the room and everyone is in until they miss.
// Buzzing is committing — the button is your claim on the answer — so a wrong
// guess takes you out of this question and hands the clip back to the rest.
export default function RaceRound({
  players, questions, lockedOut, buzzedBy, clipDone,
  onBuzz, onAnswer, onGiveUp,
}) {
  // A laptop on the coffee table: number keys buzz the matching pad (1 is the
  // first seat), so a table can crowd a keyboard instead of one trackpad.
  // Ignored while anyone is typing an answer, and for anyone already out.
  useEffect(() => {
    if (buzzedBy) return undefined;
    const onKey = (e) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > players.length) return;
      const p = players[n - 1];
      if (lockedOut.includes(p.id)) return;
      e.preventDefault();
      onBuzz(p.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [buzzedBy, players, lockedOut, onBuzz]);

  if (buzzedBy) {
    const player = players.find((p) => p.id === buzzedBy);
    return (
      <div className="mt-6">
        <p className="mb-4 text-center font-display text-xl font-extrabold text-fg-strong">
          {player?.name} buzzed — name the anime
        </p>
        <GuessInput
          key={buzzedBy}
          questions={questions}
          onSubmit={onAnswer}
          submitLabel="Lock it in"
        />
        <p className="mt-3 text-center text-sm text-fg-subtle">
          Miss it and you&apos;re out for this song — the clip picks back up for everyone else.
        </p>
      </div>
    );
  }

  const stillIn = players.filter((p) => !lockedOut.includes(p.id));

  return (
    <div className="mt-6">
      <p className="mb-4 text-center text-base text-fg-body">
        {stillIn.length === players.length
          ? 'First one to name it takes the point'
          : `${stillIn.length} still in`}
      </p>

      {/* Full-width pads, each with its player's face and key number, so a
          crowd round one phone finds their own pad at a glance. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((p, i) => {
          const out = lockedOut.includes(p.id);
          return (
            <Button
              key={p.id}
              variant="primary"
              size="xl"
              fullWidth
              sound="buzz"
              onClick={() => onBuzz(p.id)}
              disabled={out}
              className="min-h-20 justify-start gap-3"
            >
              <PlayerFace player={p} className={out ? 'grayscale' : ''} />
              <span className="min-w-0 flex-1 truncate text-left">
                <Icon name={out ? 'ban' : 'bell'} label={out ? 'Out' : 'Buzz'} /> {p.name}
              </span>
              {i < 9 && (
                <kbd aria-hidden="true" className="hidden border-2 border-current px-1.5 font-display text-base sm:inline">
                  {i + 1}
                </kbd>
              )}
            </Button>
          );
        })}
      </div>

      {/* Held back until the clip has finished (or failed outright) so it can't
          be tapped out of impatience three seconds in — but it must appear
          eventually, or a dead clip has no way past it. */}
      {clipDone && (
        <div className="mt-4 text-center">
          <GhostButton onClick={onGiveUp}>Nobody got it — reveal the answer</GhostButton>
        </div>
      )}
    </div>
  );
}
