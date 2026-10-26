import { useState } from 'react';
import Portrait from '../shared/components/Portrait';
import { readHistory } from '../shared/hooks/useRecordResult';
import { recordDetail } from '../shared/utils/history';
import { portraitFor } from '../shared/utils/portrait';
import { splitTitle } from '../shared/utils/splitTitle';
import { Button, Card, Screen } from '../shared/ui';
import { accentBg } from '../shared/ui/accents';
import RecordLine from './RecordLine';

// How many log lines show before "Show more", and how many each press adds. A
// full record is 200 lines (history.js's MAX_PER_PROFILE); all at once is a
// page nobody scrolls to the end of.
const PAGE = 20;

// One profile's whole play record: totals and streaks, a card per game, who
// they play with and how that goes, and every game logged. A full hub view
// rather than a dialog, for ListManager's reason — it is a page of its own
// length. Opened from the record strip (the main profile) and from any row of
// the profile picker, since every profile seated on this device is recorded.
//
// Read once per mount, like the strip: nothing records while the hub is on
// screen, so there is nothing to keep fresh.
export default function RecordScreen({ profile, games, onBack, backLabel }) {
  const [history] = useState(readHistory);
  const [shown, setShown] = useState(PAGE);
  const record = recordDetail(history[profile.id] ?? [], games.map((g) => g.id));
  const gameOf = (id) => games.find((g) => g.id === id);
  const rate = record.played ? Math.round((record.won / record.played) * 100) : 0;

  return (
    <Screen width="md" onBack={onBack} backLabel={backLabel}>
      <header className="mb-6 flex items-center gap-4">
        <span className="relative isolate h-20 w-20 shrink-0 overflow-hidden border-2 border-ink bg-surface-2">
          <Portrait portrait={portraitFor(profile)} name={profile.name} initialClass="text-3xl" />
        </span>
        <span className="min-w-0">
          <h1 className="truncate font-display text-3xl font-bold uppercase leading-none tracking-wide text-fg-strong">
            {profile.name}
          </h1>
          <span className="mt-1 block font-display text-lg font-bold uppercase tracking-wide text-fg-body">
            {record.played} {record.played === 1 ? 'game' : 'games'}
            <span className="text-fg-subtle"> · </span>
            <span className="text-pop-amber">{record.won} {record.won === 1 ? 'win' : 'wins'}</span>
            {record.played > 0 && <span className="text-fg-subtle"> · {rate}%</span>}
          </span>
        </span>
      </header>

      {!record.played ? (
        <Card>
          <p className="text-sm text-fg-body">No games yet. Finish one and it lands here.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {record.streak.best > 1 && (
            <p className="text-sm text-fg-body">
              {record.streak.current > 1
                ? <>On a <span className="font-bold text-fg-strong">{record.streak.current}-game</span> winning streak. </>
                : null}
              Best streak: <span className="font-bold text-fg-strong">{record.streak.best} wins</span> in a row.
            </p>
          )}

          {/* A card per game in that game's ink, menu order: the strip's chips
              grown up, so the two sort the same way. */}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {record.games.map((g) => {
              const game = gameOf(g.id);
              const title = splitTitle(game.title);
              return (
                <li key={g.id} className={`border-2 border-ink p-3 text-paper ${accentBg(game.accent)}`}>
                  <h2 className="font-display leading-none">
                    <span className="sr-only">{game.title}</span>
                    <span aria-hidden="true">
                      <span className="block text-[0.65rem] font-bold uppercase tracking-[0.3em]">{title.prefix}</span>
                      <span className="block text-xl font-bold uppercase tracking-wide">{title.word}</span>
                    </span>
                  </h2>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 text-sm tabular-nums">
                    <dt>Won</dt>
                    <dd className="font-bold">{g.won} of {g.played}</dd>
                    {g.bestPlace != null && (
                      <>
                        <dt>Best</dt>
                        <dd className="font-bold">{ordinal(g.bestPlace)}</dd>
                      </>
                    )}
                    {g.bestScore != null && (
                      <>
                        <dt>Top score</dt>
                        <dd className="font-bold">{g.bestScore}</dd>
                      </>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>

          {record.rivals.length > 0 && (
            <Card title="Head to head">
              <ul>
                {record.rivals.map((r) => (
                  <li key={r.key} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display font-bold uppercase tracking-wide text-fg-strong">
                        {r.name}
                      </span>
                      <span className="block text-sm text-fg-helper">
                        {r.together} {r.together === 1 ? 'game' : 'games'} together
                        {r.tied > 0 && ` · ${r.tied} tied`}
                      </span>
                    </span>
                    {r.you + r.them > 0 && (
                      <span className="shrink-0 font-display text-lg font-bold uppercase tabular-nums text-fg-strong">
                        <span className="sr-only">{`You ${r.you}, ${r.name} ${r.them}`}</span>
                        <span aria-hidden="true">
                          You <span className={r.you > r.them ? 'text-pop-amber' : ''}>{r.you}</span>
                          <span className="text-fg-subtle"> – </span>
                          {r.them}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Every game">
            <ol>
              {record.log.slice(0, shown).map((e) => <RecordLine key={`${e.at}:${e.game}`} entry={e} games={games} />)}
            </ol>
            {record.log.length > shown && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => setShown((n) => n + PAGE)}>
                Show more
              </Button>
            )}
          </Card>
        </div>
      )}
    </Screen>
  );
}

// "1st", "2nd", "11th". PlaceMark draws the medal in a row; a card line wants
// the word.
function ordinal(n) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
