import { useState } from 'react';
import { Icon } from '../../../shared/ui';
import { TEAM_STYLE } from './teamStyle';

// The 5×5 board, framed by each team's goal: Red's rails down both sides (it
// crosses left to right), Blue's along the top and bottom. Every screen of the
// game draws it, in one of three modes:
//
//   view   nothing to press — the table watching, the results recap
//   pick   the team on turn choosing a square: the squares it may claim are
//          buttons named "Pick <name>", everything else is a picture
//   plant  a clue-giver choosing trap squares, buttons named "Trap <name>"
//
// `keyView` ({ team, footing, traps }) overlays a clue-giver's secret — their
// footing ringed in the team's ink and the traps they planted — and is passed
// ONLY on that clue-giver's own screen. Locally that means between a handoff
// and its "hide"; online, on their own phone.
//
// A claimed square takes its team's ink AND texture AND letter, rubble is
// greyed with a ✗ (a miss) or a skull (a sprung trap), and each square's
// accessible name says all of it, so nothing on the board is colour alone.
export default function TurfBoard({
  board, marks, mode = 'view', canPick, selected = null, onSelect, keyView = null,
  planted = null, onTogglePlant, className = '',
}) {
  const footing = keyView ? new Set(keyView.footing ?? []) : null;
  const fresh = new Set(keyView?.fresh ?? []);
  const traps = new Set(planted ?? keyView?.traps ?? []);
  return (
    <div className={`mx-auto mb-5 w-full max-w-xl ${className}`}>
      <div className="grid grid-cols-[0.6rem_minmax(0,1fr)_0.6rem] grid-rows-[0.6rem_auto_0.6rem] gap-1.5">
        <span />
        <Rail team="blue" />
        <span />
        <Rail team="red" />
        <ol aria-label="Board" className="grid grid-cols-5 gap-1 sm:gap-1.5">
          {board.map((ch, i) => (
            <li key={ch.id ?? i} className="min-w-0">
              <Cell
                ch={ch}
                mark={marks[i]}
                mode={mode}
                pickable={mode === 'pick' && marks[i] == null && Boolean(canPick?.(i))}
                plantable={mode === 'plant' && marks[i] == null}
                selected={selected === i}
                keyTeam={keyView?.team ?? null}
                footing={footing?.has(i) ?? false}
                fresh={fresh.has(i)}
                trapped={traps.has(i)}
                onPress={() => (mode === 'plant' ? onTogglePlant?.(i) : onSelect?.(i))}
              />
            </li>
          ))}
        </ol>
        <Rail team="red" />
        <span />
        <Rail team="blue" />
        <span />
      </div>
      <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-fg-helper">
        <span><strong className={TEAM_STYLE.red.text}>Red</strong> crosses left to right</span>
        <span><strong className={TEAM_STYLE.blue.text}>Blue</strong> crosses top to bottom</span>
      </p>
    </div>
  );
}

function Rail({ team }) {
  const s = TEAM_STYLE[team];
  return <span aria-hidden="true" className={`block border-2 border-ink ${s.fill} ${s.texture}`} />;
}

function describe(ch, mark, { footing, trapped, fresh }) {
  const parts = [ch.name];
  if (mark === 'red' || mark === 'blue') parts.push(`claimed by ${TEAM_STYLE[mark].name}`);
  else if (mark === 'miss') parts.push('scorched');
  else if (mark === 'trap') parts.push('trap sprung');
  else {
    if (footing) parts.push(fresh ? 'your footing, new' : 'your footing');
    if (trapped) parts.push('trap planted');
  }
  return parts.join(', ');
}

function Cell({ ch, mark, mode, pickable, plantable, selected, keyTeam, footing, fresh, trapped, onPress }) {
  const claimed = mark === 'red' || mark === 'blue' ? TEAM_STYLE[mark] : null;
  const rubble = mark === 'miss' || mark === 'trap';
  const keyed = keyTeam && mark == null;
  const interactive = pickable || plantable;
  const label = describe(ch, mark, { footing: keyed && footing, trapped: mark == null && trapped, fresh });

  // An open square the team cannot reach this turn takes a softer rule, so the
  // ones it can reach read as the pressable blocks they are.
  const unreachable = mode === 'pick' && !pickable && mark == null;
  const frame = `relative flex w-full flex-col overflow-hidden border-2 bg-surface text-left
    ${unreachable ? 'border-line-loud' : 'border-ink'}
    ${selected ? 'ring-3 ring-ink ring-offset-2 ring-offset-canvas' : ''}
    ${interactive ? 'btn-pop focus-pop cursor-pointer shadow-pop-sm' : ''}`;

  const body = (
    <>
      <span className="relative isolate block aspect-square w-full overflow-hidden border-b-2 border-ink bg-surface-2">
        <CardArt
          ch={ch}
          // Pictures dim, never text: an opacity over the name would take it
          // under 4.5:1. A clue-giver's non-footing squares dim so their route
          // stands out; so do squares a team cannot reach this turn.
          dim={rubble || (keyed && !footing) || unreachable}
          grey={Boolean(claimed) || rubble}
        />
        {claimed && (
          <>
            <span aria-hidden="true" className={`absolute inset-0 ${claimed.fill} opacity-75 mix-blend-multiply`} />
            <span aria-hidden="true" className={`absolute inset-0 ${claimed.texture}`} />
            <span
              aria-hidden="true"
              className={`absolute top-1 left-1 grid h-6 w-6 place-items-center border-2 border-ink ${claimed.fill}
                font-display text-sm font-bold leading-none text-paper`}
            >
              {claimed.letter}
            </span>
          </>
        )}
        {rubble && (
          <span aria-hidden="true" className="plus-grid absolute inset-0 grid place-items-center bg-surface-2/70">
            <span className="grid h-8 w-8 place-items-center border-2 border-ink bg-ink text-lg text-paper sm:h-10 sm:w-10 sm:text-2xl">
              <Icon name={mark === 'trap' ? 'skull' : 'cross'} />
            </span>
          </span>
        )}
        {keyed && footing && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 ring-4 ring-inset ${TEAM_STYLE[keyTeam].ring}`}
          />
        )}
        {keyed && footing && (
          <span
            aria-hidden="true"
            className={`absolute right-1 bottom-1 grid h-5 w-5 place-items-center border-2 border-ink
              ${TEAM_STYLE[keyTeam].fill} text-xs text-paper`}
          >
            <Icon name="check" />
          </span>
        )}
        {keyed && footing && fresh && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 border-2 border-ink bg-surface px-1 font-display text-[10px] font-bold
              uppercase leading-tight tracking-wider text-fg-strong"
          >
            New
          </span>
        )}
        {mark == null && trapped && (
          <span
            aria-hidden="true"
            className="absolute top-1 left-1 grid h-6 w-6 place-items-center border-2 border-ink bg-ink text-sm text-paper"
          >
            <Icon name="skull" />
          </span>
        )}
      </span>
      <span
        className={`min-h-[2.4em] px-1 py-0.5 text-[10px] font-bold leading-tight [overflow-wrap:anywhere]
          line-clamp-2 sm:text-xs ${claimed ? `${claimed.fill} text-paper` : rubble ? 'text-fg-subtle' : 'text-fg-strong'}`}
      >
        {ch.name}
      </span>
    </>
  );

  if (!interactive) {
    return <div role="img" aria-label={label} className={frame}>{body}</div>;
  }
  // A pickable square is always open, so its name needs no status; a square
  // being trapped says whether it is the planter's own footing, the one thing
  // the clue-giver weighs when choosing.
  const name = plantable ? `Trap ${ch.name}${keyed && footing ? ', your footing' : ''}` : `Pick ${ch.name}`;
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={selected || (plantable && trapped)}
      onClick={onPress}
      className={frame}
    >
      {body}
    </button>
  );
}

// The character's portrait, or their initial over registration crosses when
// the list carried no portrait or it failed to load — remembered per URL, so a
// re-render does not retry a dead link.
function CardArt({ ch, dim, grey }) {
  const [failed, setFailed] = useState(null);
  const tone = `${dim ? 'opacity-40' : ''} ${grey ? 'grayscale' : ''}`;
  if (!ch.imageUrl || failed === ch.imageUrl) {
    return (
      <span aria-hidden="true" className={`plus-grid absolute inset-0 grid place-items-center ${tone}`}>
        <span className="font-display text-3xl font-bold text-fg-subtle sm:text-4xl">
          {(ch.name || '?').slice(0, 1).toUpperCase()}
        </span>
      </span>
    );
  }
  return (
    <img
      src={ch.imageUrl}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(ch.imageUrl)}
      className={`absolute inset-0 h-full w-full object-cover object-[50%_15%] ${tone}`}
    />
  );
}
