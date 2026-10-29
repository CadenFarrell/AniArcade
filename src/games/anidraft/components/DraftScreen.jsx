import { useState } from 'react';
import PlayerRow from '../../../shared/components/PlayerRow';
import RoundHeader from '../../../shared/components/RoundHeader';
import { StartBar } from '../../../shared/components/SetupLayout';
import { Button, TimerBar } from '../../../shared/ui';
import { roleOf } from '../roles';
import { currentPicker, openSlots, pickNo, pickOrder } from '../rules';
import DraftBoard from './DraftBoard';
import { AllTeams, TeamSheet } from './TeamSheet';

// The draft, one pick at a time — the same screen on the table's one device
// and on every phone online; only `canPick` (is this device holding the pick?)
// and the clock differ.
//
// Two taps a pick: a card on the board, then the role in the bar ("Draft as
// Captain"). The role buttons live in the pinned bar because the board is a
// long scroll on a phone, and the sheet of roles above it would be off screen
// by the time a card near the bottom was chosen.
//
// The selection is keyed to the pick it was made in, so it cannot outlive the
// pick: online, a clock running out picks for you while a card is selected.
export default function DraftScreen({
  game, players, youId = null, canPick, onPick, onReshuffle = null, clock = null,
}) {
  const at = `${game.round}:${game.picks.length}`;
  const [sel, setSel] = useState({ at: null, key: null });
  const selected = sel.at === at ? sel.key : null;

  const picker = currentPicker(game);
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const mine = picker === youId;
  const { n, of } = pickNo(game);
  const open = openSlots(game, picker);
  const card = game.board.find((c) => c.key === selected) ?? null;
  const after = pickOrder(game.order, game.round)[game.picks.length + 1];
  const roleNames = (slots) => slots.map((i) => roleOf(game.roles[i]).name).join(', ');

  const hint = [
    `Round ${game.round + 1}/${game.rounds}.`,
    after ? `${after === youId ? 'You' : nameOf(after)} next${after === picker ? ' — the snake turns' : ''}.` : 'Last pick of the round.',
  ].join(' ');

  let status;
  if (!canPick) status = `Waiting for ${nameOf(picker)}’s pick.`;
  else if (card) status = `Draft ${card.name} as…`;
  else status = open.length < game.roles.length ? `Tap a character on the board. Still to fill: ${roleNames(open)}.` : 'Tap a character on the board.';

  return (
    <>
      <PlayerRow
        players={game.order.map((id) => players.find((p) => p.id === id)).filter(Boolean)}
        activeId={picker}
        youId={youId}
        label="Teams"
        score={(p) => String(game.scores?.[p.id] ?? 0)}
      />
      <RoundHeader title={mine ? 'Your Pick' : `${nameOf(picker)}'s Pick`} tag={`Pick ${n}/${of}`} hint={hint}>
        {clock && <TimerBar secondsLeft={clock.secondsLeft} fraction={clock.fraction} label="Time to pick" />}
      </RoundHeader>
      {onReshuffle && game.picks.length === 0 && (
        <div className="mb-5 flex justify-center">
          <Button variant="neutral" onClick={onReshuffle}>Shuffle roles</Button>
        </div>
      )}
      <TeamSheet game={game} playerId={picker} title={mine ? 'Your Team' : `${nameOf(picker)}'s Team`} />
      <DraftBoard
        game={game}
        players={players}
        youId={youId}
        selected={selected}
        onSelect={canPick ? (key) => setSel({ at, key }) : null}
      />
      <AllTeams game={game} players={players} youId={youId} activeId={picker} />
      <StartBar width="md" status={status} ready={canPick}>
        {/* Only the role on the button, small: the status line already says
            "Draft <name> as…", and five full "Draft as Agent of Chaos"
            buttons stacked five rows deep over half a phone. The accessible
            name keeps the whole phrase (it contains the visible words), and it
            is what the bots press. */}
        {canPick && card && open.map((i) => {
          const role = roleOf(game.roles[i]).name;
          return (
            <Button
              key={game.roles[i]}
              variant="primary"
              size="sm"
              aria-label={`Draft as ${role}`}
              onClick={() => { setSel({ at: null, key: null }); onPick(card.key, i); }}
            >
              {role}
            </Button>
          );
        })}
      </StartBar>
    </>
  );
}
