import { useState } from 'react';
import ClueLog from './ClueLog';
import {
  Backdrop,
  Badge,
  Banner,
  Button,
  Card,
  CardRow,
  Icon,
  Screen,
  Wordmark,
} from '../../../shared/ui';
import Handoff from '../../../shared/components/Handoff';
import Portrait from '../../../shared/components/Portrait';
import { usePlayerPortrait } from '../../../shared/context/tablePortraitsContext';

// The vote. Everyone picks one other player; a tie opens one sudden-death
// runoff between the tied names, and a second tie lets the fake walk.
//
// Only WHO has voted is ever shown, never who they voted for — a running tally
// would let the last voter pick the winning side, which is exactly why
// rules.castVote makes a vote final once cast. That holds for the runoff too.
//
// That marker sits in the SEAT column, as a grey tick, and the right-hand edge
// of a row is action-only. It used to be a lime "Voted" pill immediately left of
// the red Accuse button, and being in the accusation column is what made it read
// as "someone has voted FOR Ada" — the one thing this screen must never show.
// Lime beside red compounded it: the pair read as [yes] [no] on a single
// question. A status pill next to a decision button is a verdict; put anything
// about a player's own progress on the other side of the name.
//
// EVERY player is listed, including you. Filtering the voter out of their own
// ballot shifted every row beneath them, so in pass-the-device play the same
// name sat at a different position on each hand-off — most of why this screen
// was hard to follow. Your row stays put and simply has no button. `players` is
// the seated roster (rules.seating), so the seat numbers match the clue log's.
export default function VoteScreen({
  players = [],
  voter, // the player casting now: whoever holds the device locally, you online
  voted = [], // ids that have already voted — for the waiting list, no targets
  voterIds = [], // who the ballot is waiting on: the ACTIVE players, not the roster
  departedIds = [],
  clues = [],
  local = false,
  myVote = null,
  isRunoff = false,
  runoffCandidates = [],
  onVote,
  error,
}) {
  const [handedOver, setHandedOver] = useState(!local);
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? id;

  // Who may be accused on the ballot that is open: everyone on the opening
  // vote, only the tied names in a runoff — where everyone still votes.
  const accusable = (id) => !isRunoff || runoffCandidates.includes(id);

  // Local play passes the device around, so the ballot has to be claimed the
  // same way the card was.
  if (local && !handedOver) {
    return (
      <>
        <Backdrop />
        <Screen center>
          <Handoff
            player={voter}
            note="Votes are secret — everyone else, look away."
            cta={`I'm ${voter?.name} — let me vote`}
            onReady={() => setHandedOver(true)}
          />
        </Screen>
      </>
    );
  }

  const cast = (id) => {
    onVote(id);
    if (local) setHandedOver(false); // hide the ballot again before it moves on
  };

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark tone="teal" size="sm" level={2} className="mb-6">
          {isRunoff ? 'Runoff' : 'Who is the fake?'}
        </Wordmark>

        {/* The terminator has to be said out loud, or a runoff that ends with
            nobody accused reads as a bug rather than as the rule. */}
        {isRunoff && (
          <Banner tone="warning" className="mb-6">
            It tied between{' '}
            <span className="font-extrabold">{runoffCandidates.map(nameOf).join(' and ')}</span>.
            Everyone votes again on just those names — and if it ties a second time,
            nobody is accused and the fake walks.
          </Banner>
        )}

        {/* Empty in a talk-it-out round, where the clues were spoken and never
            recorded. Dropped rather than shown blank: the table is voting from
            memory, and an empty "what was said" card suggests the game lost it.
            This is the hides-it-entirely caller ClueLog's header refers to. */}
        {clues.length > 0 && (
          <Card title="What was said" padding="lg" className="mb-6">
            <ClueLog clues={clues} players={players} />
          </Card>
        )}

        {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

        {myVote ? (
          <Card padding="lg" className="mb-6 text-center">
            <div className="text-4xl text-pop-lime"><Icon name="check" /></div>
            <p className="mt-2 font-display text-lg font-extrabold text-fg-strong">
              You voted for {nameOf(myVote)}
            </p>
            <p className="mt-1 text-fg-helper">Waiting for everyone else…</p>
          </Card>
        ) : (
          <Card title={`${voter?.name ?? 'You'} — pick one`} padding="lg" className="mb-6">
            {/* The ballot as a line-up: a card per suspect wearing their face,
                in seat order, so the table reads it the way a manga sets out a
                row of suspects rather than as a form. Every card keeps the same
                frame whether it carries a button or not — that is what stops
                the grid reflowing between voters, which the row ballot's fixed
                columns were for. */}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {players.map((p) => (
                <Suspect
                  key={p.id}
                  player={p}
                  isMe={p.id === voter?.id}
                  // Someone who left is still on the ballot — walking out is
                  // exactly what a rumbled fake would do, so the table should
                  // be able to accuse them. They just have to be told, or the
                  // card reads as a player who is merely slow to vote.
                  gone={departedIds.includes(p.id)}
                  accusable={accusable(p.id)}
                  hasVoted={voted.includes(p.id)}
                  onAccuse={() => cast(p.id)}
                />
              ))}
            </ul>
            {/* A tick with no key is just a new small mystery, and the wording
                has to name whose ballot it is — "voted" alone is the ambiguity
                that moving the marker was meant to end. Only once one exists. */}
            {voted.length > 0 && (
              <p className="mt-3 text-sm text-fg-subtle">
                <Icon name="check" /> their own ballot is already in — not a vote against them
              </p>
            )}
          </Card>
        )}

        {/* Counted against the players the ballot is genuinely waiting on. The
            full roster kept reading "3 of 4 in" after a departure had already
            let the room move on. */}
        {voterIds.length > 0 && (
          <p className="text-center text-fg-helper">
            {voted.filter((id) => voterIds.includes(id)).length} of {voterIds.length} in.
          </p>
        )}
      </Screen>
    </>
  );
}

// One card in the line-up. The face dims for someone out of the vote (a
// runoff's non-candidates) or gone — the FACE, never the name, which is read
// and an opacity over it fell to about 2:1.
function Suspect({ player, isMe, gone, accusable, hasVoted, onAccuse }) {
  const portrait = usePlayerPortrait(player);
  const dimmed = gone || !accusable;
  return (
    <li className="flex flex-col border-2 border-ink bg-surface shadow-pop-sm">
      <div className="relative">
        <span
          aria-hidden="true"
          className={`relative isolate block aspect-square overflow-hidden border-b-2 border-ink bg-surface-2
            ${dimmed && !isMe ? 'opacity-40' : ''}`}
        >
          <Portrait portrait={portrait} name={player.name} />
        </span>
        {/* The seat number on an ink tab: the same seat on every screen of
            the round, which is how the table refers to people. */}
        <span
          className="absolute top-0 left-0 border-r-2 border-b-2 border-ink bg-ink px-1.5 font-display text-sm
            font-bold text-paper"
        >
          {player.seat ?? '–'}
        </span>
        {/* Their own ballot, not a vote against them — weighted like the seat
            number rather than tinted, since a colour here would be read as a
            verdict. */}
        {hasVoted && (
          <span className="absolute top-1 right-1 grid h-6 w-6 place-items-center border-2 border-ink bg-surface text-xs text-fg-strong">
            <Icon name="check" />
            <span className="sr-only">has voted</span>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <span
          className={`truncate font-display text-lg font-bold uppercase leading-none tracking-wide
            ${dimmed ? 'text-fg-subtle' : 'text-fg-strong'}`}
        >
          {player.name}
        </span>
        {/* Amber, not red: this flags a state, and red next to the red Accuse
            button made the two blur into one control. */}
        {gone && <Badge tone="amber">Left</Badge>}
        {isMe ? (
          <Badge tone="purple">You</Badge>
        ) : accusable ? (
          // Named for whom it accuses: a screen reader walking the ballot
          // otherwise hears "Accuse" once per card and nothing to tell them
          // apart. The visible word still leads the name; the playtest bots
          // find these by "Accuse <name>".
          <Button variant="danger" size="sm" fullWidth onClick={onAccuse}>
            Accuse<span className="sr-only"> {player.name}</span>
          </Button>
        ) : (
          <span className="font-display text-xs uppercase tracking-wider text-fg-subtle">Safe</span>
        )}
      </div>
    </li>
  );
}
