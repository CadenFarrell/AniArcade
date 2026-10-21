import PlayerFace from '../../../shared/components/PlayerFace';
import { Badge, Card, Mark } from '../../../shared/ui';
import { TEAM_STYLE } from './teamStyle';

// Every clue so far, newest first, each with what its claims turned up: the
// table's memory of which word was meant for which squares — worth having when
// a later clue says "Ninja: 2" again and a guesser wonders whether one of those
// was already found.
export default function ClueLog({ game, players, limit = null }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const name = (cell) => game.board[cell]?.name ?? '?';
  const turns = [];
  for (const entry of game.log) {
    if (entry.kind === 'clue') turns.push({ clue: entry, events: [] });
    else if (turns.length && entry.kind !== 'migrate') turns.at(-1).events.push(entry);
  }
  const shown = turns.reverse().slice(0, limit ?? turns.length);
  if (!shown.length) return null;
  return (
    <Card title="Clues" padding="sm" className="mb-6">
      <ol>
        {shown.map(({ clue, events }, idx) => {
          const giver = byId.get(clue.by);
          return (
            <li key={`${turns.length - idx}`} className="border-b border-line px-1 py-2.5 last:border-0">
              <div className="flex items-center gap-2">
                {giver && <PlayerFace player={giver} />}
                <Badge tone={TEAM_STYLE[clue.team].tone}>{TEAM_STYLE[clue.team].name}</Badge>
                <span className="min-w-0 flex-1 truncate font-display text-lg font-bold uppercase tracking-wide text-fg-strong">
                  {clue.word} · {clue.number}
                </span>
                {giver && <span className="shrink-0 text-sm text-fg-helper">{giver.name}</span>}
              </div>
              {events.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-1 text-sm text-fg-body">
                  {events.map((e, j) => (
                    <li key={j} className="flex items-center gap-1">
                      {e.kind === 'claim' && <><Mark yes label="claimed" /> {name(e.cell)}</>}
                      {e.kind === 'miss' && <><Mark yes={false} label="scorched" /> {name(e.cell)}</>}
                      {e.kind === 'trap' && (
                        <>
                          <Mark yes={false} label="trap" /> {name(e.cell)}
                          {e.undone != null && <> — lost {name(e.undone)}</>}
                        </>
                      )}
                      {e.kind === 'stop' && <span className="text-fg-helper">Stopped</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
