import { useState } from 'react';
import RoundHeader from '../../../shared/components/RoundHeader';
import { Button } from '../../../shared/ui';
import { TEAM_NAMES, other } from '../rules';
import TurfBoard from './TurfBoard';

// A clue-giver's first look at their key, and their traps. The ringed squares
// are the team's footing; the traps go wherever they think the OTHER team's
// route has to pass — and since both routes must cross, that is often right on
// their own footing, which is the bet the screen exists to offer.
//
// Exactly `count` traps: picking one more drops the oldest, so a change of mind
// is one tap rather than two. With traps off (`count` 0) it is just the key
// and a button to say it has been read.
export default function TrapPlanting({ board, marks, team, footing, count, onDone, busy = false }) {
  const [chosen, setChosen] = useState([]);
  const toggle = (i) => setChosen((prev) => {
    if (prev.includes(i)) return prev.filter((x) => x !== i);
    const next = [...prev, i];
    return next.length > count ? next.slice(next.length - count) : next;
  });
  const them = TEAM_NAMES[other(team)];
  return (
    <>
      <RoundHeader
        title={count ? 'Plant your traps' : 'Your key'}
        tag={`${TEAM_NAMES[team]} key`}
        hint={count
          ? `Ringed squares are your team's footing. Trap ${count} square${count === 1 ? '' : 's'} where you think ${them}'s route must cross — a trap only springs on ${them}'s footing.`
          : "Ringed squares are your team's footing — the only squares your guessers can hold."}
      />
      <TurfBoard
        board={board}
        marks={marks}
        mode={count ? 'plant' : 'view'}
        keyView={{ team, footing, traps: [] }}
        planted={chosen}
        onTogglePlant={toggle}
      />
      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={busy || chosen.length !== count}
        onClick={() => onDone(chosen)}
      >
        {count ? `Plant traps (${chosen.length}/${count})` : 'Got it'}
      </Button>
    </>
  );
}
