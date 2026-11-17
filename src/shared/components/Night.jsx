import { useMemo, useState } from 'react';
import { useConfirm } from '../hooks/useConfirm';
import { accentBg } from '../ui/accents';
import { Banner, Button, Card } from '../ui';
import { lineWinners, nightStandings } from '../utils/night';
import { splitPodium } from '../utils/podium';
import { profileIdFromName } from '../utils/profileStats';
import { splitTitle } from '../utils/splitTitle';
import ResultsLayout, { Splash, Standings } from './Results';
import { StartBar } from './SetupLayout';

// Game night on the screens (shared/utils/night.js): the running table under a
// room's final results, and the champion screen the host ends the night on.
// Both read `room.handoff.night`, which every game's room hook passes through
// from useRoomCore, so no game knows either exists.

// The card is worth showing from the second game: after one, it would only
// repeat the standings printed just above it.
export const NIGHT_MIN_GAMES = 2;

// The brand, where a results banner prints its game: the night belongs to the
// arcade, not to whichever game happened to be last.
const ARCADE = { id: 'night', title: 'AniArcade', accent: 'pink' };

const gamesLabel = (n) => `${n} game${n === 1 ? '' : 's'}`;

// The night's rows wearing this room's seats. A night row is a folded name;
// the room's roster is what has the faces (TablePortraits shares them by room
// id). Someone who played earlier tonight and is not in this room keeps their
// row, tagged "left" like any departed player's.
function useNightTable(room) {
  const night = room.handoff?.night ?? null;
  const roster = room.players ?? room.gameSession?.players;
  return useMemo(() => {
    const seats = new Map((roster ?? []).map((p) => [profileIdFromName(p.name), p.id]));
    const ranked = nightStandings(night).map((row) => ({
      ...row, id: seats.get(row.id) ?? `night:${row.id}`, here: seats.has(row.id),
    }));
    return { night, ranked, goneIds: ranked.filter((r) => !r.here).map((r) => r.id) };
  }, [night, roster]);
}

const playedTag = (p) => <span className="shrink-0 text-sm text-fg-helper">{gamesLabel(p.played)}</span>;
const points = (p) => `${p.total} pt${p.total === 1 ? '' : 's'}`;

/**
 * Every game of the night in the order played, each in its own ink with the
 * hub tile's big word, and who took it. A game is told from its neighbours by
 * its WORD, never its colour alone.
 */
function NightGames({ night, title = 'Games so far' }) {
  return (
    <Card title={title} padding="sm" className="mb-6">
      <ol>
        {night.games.map((line, i) => {
          const winners = lineWinners(line);
          return (
            // The list only grows, and a game's place in it is its identity.
            <li key={i} className="flex items-center gap-3 border-b border-line px-1 py-2 last:border-0">
              <span
                className={`w-24 shrink-0 border-2 border-ink px-2 py-1 text-center font-display text-sm font-bold
                  uppercase tracking-wide text-paper ${line.accent ? accentBg(line.accent) : 'bg-ink'}`}
              >
                <span className="sr-only">{line.title}</span>
                <span aria-hidden="true">{splitTitle(line.title).word}</span>
              </span>
              <span className="min-w-0 flex-1 text-fg-body [overflow-wrap:anywhere]">
                {winners.length ? winners.join(' & ') : 'Nobody ahead'}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/**
 * The running table, under a room's FINAL results and above the "Next game"
 * card (RoomShell slots both in). Everyone sees it; the host also gets "End
 * the night", which puts the champion screen on every device.
 */
export function TonightCard({ room }) {
  const { night, ranked, goneIds } = useNightTable(room);
  const [error, setError] = useState('');
  const count = night?.games.length ?? 0;
  // Scoped to the night as it stands: a question left open while another game
  // finishes is about a table that has since changed.
  const { ask, dialog } = useConfirm(`${room.roomCode}:${count}`);
  if (count < NIGHT_MIN_GAMES) return null;

  const end = () => ask({
    title: 'End the night?',
    message: 'Everyone sees the final table and tonight\'s champion. You can carry on playing afterwards.',
    confirmLabel: 'End the night',
    cancelLabel: 'Not yet',
    tone: 'primary',
    onConfirm: () => {
      setError('');
      room.handoff.endNight().catch((e) => {
        setError(e?.message || 'Could not reach the room. Check your connection and try again.');
      });
    },
  });

  return (
    <section aria-label="Tonight">
      {dialog}
      <Standings
        title={`Tonight · ${gamesLabel(count)}`}
        ranked={ranked}
        departedIds={goneIds}
        score={points}
        extra={playedTag}
        className="mb-3!"
      />
      <p className="mb-4 px-1 text-sm text-fg-helper">
        A point for every player you finish above, in every game this table plays.
      </p>
      <NightGames night={night} />
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
      {room.isHost && (
        <Button variant="secondary" fullWidth className="mb-6" onClick={end}>End the night</Button>
      )}
    </section>
  );
}

/**
 * What every device shows once the host has ended the night: the champion (a
 * tie shares it, as a tie at the top does in every game), the whole table and
 * the games that made it. It replaces whatever the room was on, like the
 * follow screen. The host may take it back down and carry on — the night's
 * lines are untouched by ending it.
 */
export function NightChampion({ room }) {
  const { night, ranked, goneIds } = useNightTable(room);
  const [error, setError] = useState('');
  const { winners, rest } = splitPodium(ranked);
  const top = winners[0];
  const who = night.ended?.byName || 'The host';

  const resume = () => {
    setError('');
    room.handoff.resumeNight().catch((e) => {
      setError(e?.message || 'Could not reach the room. Check your connection and try again.');
    });
  };

  return (
    <ResultsLayout
      ceremony={rest.length}
      game={ARCADE}
      title="Night Champion"
      subtitle={`${gamesLabel(night.games.length)} played. A point for every player finished above.`}
      players={room.players ?? room.gameSession?.players ?? []}
      splash={winners.length > 0 && (
        <Splash
          players={winners}
          stamp={winners.length > 1 ? 'Tied' : 'Champion'}
          score={top ? points(top) : null}
        />
      )}
      bar={(
        <StartBar
          width="md"
          status={room.isHost ? 'The night is over, unless you say otherwise.' : `${who} ended the night.`}
          ready
        >
          {room.isHost && (
            <Button variant="primary" size="lg" onClick={resume}>Keep the night going</Button>
          )}
        </StartBar>
      )}
    >
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
      <Standings build ranked={rest} departedIds={goneIds} score={points} extra={playedTag} />
      <NightGames night={night} title="The night" />
    </ResultsLayout>
  );
}
