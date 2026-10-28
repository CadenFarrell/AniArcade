import { useState } from 'react';
import { Button, Card, Icon } from '../ui';
import PlayerFace from './PlayerFace';

/**
 * "Who got it?" — the honour-system answer step for a table playing on ONE
 * device, where everyone says their answer out loud and then the table ticks
 * who was right.
 *
 * It exists because private answers on a shared device cost a handoff per
 * player per question: AniQuiz passed the phone about a hundred times a game,
 * AniTune's everyone-guesses N times a song. A couch that answers out loud and
 * is honest about it trades that privacy for pace, and each game offers it as
 * a choice, never instead of private entry.
 *
 * Shown AFTER the answer is on screen, so the table marks against the answer
 * rather than arguing from memory. `onDone(ids)` gets the players ticked;
 * "Nobody got it" is its own button because "Done" with nothing ticked reads as
 * a mis-tap. The words "<name> got it", "Nobody got it" and "Done" are what the
 * playtest strategies press.
 */
export default function SelfReport({ players, onDone, title = 'Who got it?', hint = 'Tick everyone who said the right answer.' }) {
  const [got, setGot] = useState(() => new Set());
  const toggle = (id) => setGot((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <Card title={title} padding="md" className="mb-6">
      <p className="mb-4 text-sm text-fg-helper">{hint}</p>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {players.map((p) => {
          const on = got.has(p.id);
          return (
            <Button
              key={p.id}
              variant={on ? 'success' : 'neutral'}
              size="md"
              aria-pressed={on}
              aria-label={`${p.name} got it`}
              sound="select"
              onClick={() => toggle(p.id)}
              className="justify-start gap-2"
            >
              <PlayerFace player={p} />
              <span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
              {on && <Icon name="check" />}
            </Button>
          );
        })}
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" size="lg" fullWidth onClick={() => onDone([])}>
          Nobody got it
        </Button>
        <Button variant="primary" size="lg" fullWidth disabled={got.size === 0} onClick={() => onDone([...got])}>
          Done
        </Button>
      </div>
    </Card>
  );
}
