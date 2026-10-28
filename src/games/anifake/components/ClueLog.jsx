import { cluesByLap } from '../rules';
import PlayerFace from '../../../shared/components/PlayerFace';

// The clue log, grouped by round. Used by both ClueRound and VoteScreen so the
// two can't drift — they rendered byte-identical chip markup from separate
// copies before this, and the vote screen's copy is the one people actually
// read when deciding who to accuse.
//
// The caller owns the Card around it: the two screens title it differently
// ("Clues (7)" vs "What was said") and one of them hides it entirely when empty.
//
// `players` is the SEATED roster (rules.seating), so each chip can carry its
// speaker's seat number. That number is the whole reason the log and the ballot
// are now readable as one list: the log used to run in speaking order while the
// ballot ran in roster order, and nothing on either screen said so.
export default function ClueLog({ clues = [], players = [] }) {
  const speakerOf = (id) => players.find((p) => p.id === id) ?? null;
  const rounds = cluesByLap(clues);

  // A round header only earns its place once there are two rounds to tell
  // apart. At one round — which is every round of a one-round game, and the
  // whole of round one in any game — it is a label on the only thing in the box.
  const labelled = rounds.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {rounds.map(({ lap, clues: said }) => (
        <div key={lap}>
          {labelled && (
            <p className="mb-2 font-display text-xs uppercase tracking-wider text-fg-subtle">
              Round {lap + 1}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {said.map((clue, i) => {
              const speaker = speakerOf(clue.by);
              return (
                <span
                  key={`${lap}-${clue.by}-${i}`}
                  className="rounded-pop-sm border-2 border-line-strong bg-surface-2 px-3 py-2"
                >
                  <PlayerFace player={speaker ?? { id: clue.by, name: clue.by }} size="sm" className="mr-1.5 -mt-0.5" />
                  {speaker?.seat && (
                    <span className="mr-1.5 font-display text-xs font-extrabold text-pop-teal">
                      {speaker.seat}
                    </span>
                  )}
                  <span className="font-display text-xs uppercase tracking-wider text-fg-subtle">
                    {speaker?.name ?? clue.by}
                  </span>
                  {/* A clue the clock ran out on (rules.timeOutClue) says so in
                      words — a bare ellipsis reads as a clue someone chose. */}
                  {clue.timedOut ? (
                    <span className="ml-2 text-sm font-bold uppercase tracking-wide text-pop-amber">
                      out of time
                    </span>
                  ) : (
                    <span className="ml-2 font-display text-lg font-extrabold text-fg-strong">
                      {clue.text}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
