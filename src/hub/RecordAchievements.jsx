import { useId, useState } from 'react';
import { achievementView } from '../shared/utils/achievements';
import { whenLabel } from '../shared/utils/history';
import { splitTitle } from '../shared/utils/splitTitle';
import { Button, Card, Icon } from '../shared/ui';
import { accentBg } from '../shared/ui/accents';

// Each game's own "ace" milestone waits behind "Show all": the lifetime
// ladders and the arcade-wide ones come first, and fourteen aces at once
// buried the rest of the page.
const isAce = (m) => m.id.startsWith('ace-');

// The trophy page's two achievement cards (shared/utils/achievements.js):
// every milestone, unlocked or with its progress, and the award collection —
// every title each game's final card can give, earned ones with their count.
// Locked things are shown on purpose: they are what there is to go for.
//
// Locked reads quieter by ROLE (fg-helper text, an outline rather than a
// fill), never by opacity, which axe flags under 4.5:1 and which the styling
// rules forbid.
export default function RecordAchievements({ rec, games }) {
  const playable = games.filter((g) => g.available);
  const view = achievementView(rec, playable);
  const [allMilestones, setAllMilestones] = useState(false);
  const milestones = allMilestones ? view.milestones : view.milestones.filter((m) => !isAce(m));
  const gameOf = (id) => games.find((g) => g.id === id);

  return (
    <>
      <Card title="Achievements">
        <p className="mb-3 text-sm text-fg-body">
          <span className="font-bold text-fg-strong">{view.unlockedCount}</span> of {view.milestones.length} unlocked
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {milestones.map((m) => <Milestone key={m.id} m={m} />)}
        </ul>
        {view.milestones.length > milestones.length && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAllMilestones(true)}>
            Show all
          </Button>
        )}
      </Card>

      <Card title="Award collection">
        <p className="mb-3 text-sm text-fg-body">
          <span className="font-bold text-fg-strong">{view.collected}</span> of {view.totalAwards} collected.
          Awards count once they are on a game&apos;s final card.
        </p>
        <ul className="flex flex-col gap-3">
          {view.collection.map((g) => <GameAwards key={g.id} game={gameOf(g.id)} awards={g.awards} />)}
        </ul>
      </Card>
    </>
  );
}

// One game's ten titles, folded behind its title bar. Open, fourteen games
// were ~4,300px on a phone (about 285px each at 375 wide, measured 2026-11-16)
// and with the milestones put eight screens between the header and Head to
// head. Closed, the bar still says the thing a glance wants, how many of the
// ten are earned, and the page is the fourteen bars. MoreSettings' fold, minus
// the remembering: `hidden` rather than unmounted, so the titles stay in the
// page for find-in-page and for the tests.
function GameAwards({ game, awards }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const title = splitTitle(game.title);
  const earned = awards.filter((a) => a.n > 0).length;
  return (
    <li className="border-2 border-ink">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className={`focus-pop flex min-h-11 w-full items-center gap-2 px-2 py-1 text-left font-display leading-none
          text-paper ${accentBg(game.accent)}`}
      >
        <Icon name="chevron" className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="min-w-0 flex-1">
          <span className="sr-only">{game.title}</span>
          <span aria-hidden="true">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em]">{title.prefix}</span>
            <span className="text-base font-bold uppercase tracking-wide">{title.word}</span>
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums">
          <span aria-hidden="true">{earned} / {awards.length}</span>
          <span className="sr-only">, {earned} of {awards.length} awards collected</span>
        </span>
      </button>
      <div id={id} hidden={!open} className="flex flex-col gap-2 p-2">
        <Chips label="Good" awards={awards.filter((a) => !a.roast)} />
        <Chips label="Roasts" awards={awards.filter((a) => a.roast)} />
      </div>
    </li>
  );
}

function Milestone({ m }) {
  const unlocked = m.at != null;
  return (
    <li className={`flex items-center gap-3 p-2 ${unlocked ? 'border-2 border-ink' : 'border border-line-strong'}`}>
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center text-lg ${
          unlocked ? 'bg-pop-amber text-paper' : 'bg-surface-2 text-fg-icon'
        }`}
      >
        <Icon name={unlocked ? 'trophy' : 'lock'} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-display font-bold uppercase leading-tight tracking-wide ${
          unlocked ? 'text-fg-strong' : 'text-fg-body'
        }`}
        >
          {m.title}
        </span>
        <span className="block text-sm text-fg-helper">{m.detail}</span>
        <span className="block text-xs text-fg-subtle tabular-nums">
          {unlocked ? `Unlocked ${when(m.at)}` : (
            <>
              <span className="sr-only">Locked. </span>
              {m.n} / {m.of}
            </>
          )}
        </span>
      </span>
    </li>
  );
}

// "Unlocked today", "Unlocked Monday", "Unlocked Nov 3".
function when(at) {
  const label = whenLabel(at);
  return label === 'Today' || label === 'Yesterday' ? label.toLowerCase() : label;
}

function Chips({ label, awards }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-fg-helper">{label}</span>
      <ul className="flex flex-wrap gap-1.5">
        {awards.map((a) => (
          <li
            key={a.title}
            className={`px-2 py-0.5 text-sm ${
              a.n > 0 ? 'border-2 border-ink bg-ink font-bold text-paper' : 'border border-line-strong text-fg-helper'
            }`}
          >
            {a.n > 0 ? (
              <>
                {a.title}
                <span className="tabular-nums"> ×{a.n}</span>
                <span className="sr-only">{a.n === 1 ? ' (once)' : ` (${a.n} times)`}</span>
              </>
            ) : (
              <>
                <Icon name="lock" className="mr-1 text-fg-icon" />
                {a.title}
                <span className="sr-only"> (not yet)</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
