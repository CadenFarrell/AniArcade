import { useState } from 'react';
import { readHistory } from '../shared/hooks/useRecordResult';
import { summarize } from '../shared/utils/history';
import { splitTitle } from '../shared/utils/splitTitle';
import { Button, Card } from '../shared/ui';
import { accentBg } from '../shared/ui/accents';
import RecordLine from './RecordLine';

const RECENT = 5;

// The main profile's play history, under the board: how many games and wins,
// a chip per game in that game's ink (the tile's title-bar colour, so the
// chips sort the way the board does), and the last few games. The whole record
// — every game, head-to-head, streaks — is RecordScreen, one press away.
//
// Read once per mount, from storage (useRecordResult.js says why there is no
// provider): HubScreen's menu branch unmounts while a game is open, so coming
// back to the menu is a fresh read that includes the game just finished.
//
// The main profile only. Every seated profile is recorded, but the hub belongs
// to whoever's profile it is; a friend's record opens from their row in the
// profile picker.
export default function RecordStrip({ profile, games, onOpen }) {
  const [history] = useState(readHistory);
  if (!profile) return null;
  const record = summarize(history[profile.id] ?? [], games.map((g) => g.id), RECENT);
  const gameOf = (id) => games.find((g) => g.id === id);

  return (
    <Card
      title="Your record"
      className="mt-8"
      action={record.played > 0 && onOpen && (
        <Button variant="secondary" size="sm" onClick={onOpen}>See full record</Button>
      )}
    >
      {!record.played ? (
        <p className="text-sm text-fg-body">No games yet. Finish one and it lands here.</p>
      ) : (
        <>
          <p className="font-display text-2xl font-bold uppercase leading-none tracking-wide text-fg-strong">
            {record.played} {record.played === 1 ? 'game' : 'games'}
            <span className="text-fg-subtle"> · </span>
            <span className="text-pop-amber">{record.won} {record.won === 1 ? 'win' : 'wins'}</span>
          </p>

          {/* One chip per game played, in menu order. Solid game ink with paper
              type: the accent contract's fill pairing, as on the tiles. */}
          <ul className="mt-3 flex flex-wrap gap-2">
            {record.games.map((g) => {
              const game = gameOf(g.id);
              const title = splitTitle(game.title);
              return (
                <li
                  key={g.id}
                  className={`border-2 border-ink px-2 py-1 font-display text-sm font-bold uppercase leading-none
                    tracking-wide text-paper ${accentBg(game.accent)}`}
                >
                  <span className="sr-only">{`${game.title}: ${g.won} of ${g.played} won`}</span>
                  <span aria-hidden="true">
                    {title.word} <span className="tabular-nums">{g.won}/{g.played}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <h4 className="mt-4 mb-1 font-display text-xs font-bold uppercase tracking-[0.18em] text-fg-helper">
            Last games
          </h4>
          <ol>
            {record.recent.map((e) => <RecordLine key={`${e.at}:${e.game}`} entry={e} games={games} />)}
          </ol>
        </>
      )}
    </Card>
  );
}
