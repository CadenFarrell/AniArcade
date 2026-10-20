import { useState } from 'react';
import { HostWaitCard, ListBadge, LobbyImport, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import QuizSettings from './QuizSettings';
import { usePoolReport } from '../hooks/usePoolReport';
import { needsLists } from '../utils/pool';
import { DEFAULT_PREFS } from '../prefs';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import descriptor from '../index';
import { Button } from '../../../shared/ui';

// The online lobby: the shared Lobby pieces for everything every room draws
// the same, and QuizSettings — the same card local setup renders — for the
// rest. Only the host sees the settings; their choices deal for everyone.
export default function OnlineLobby({ room, pack }) {
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniquiz', DEFAULT_PREFS);
  const [settings, setSettings] = useState(prefs);

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  // Every gate counts the players actually here — a ghost left by a closed tab
  // has no list and would hold Start shut for everyone present.
  const active = room.activePlayers ?? players;
  useRepublishProfile(room, me);

  const report = usePoolReport(pack.pack, active, settings);
  const canStart = active.length >= 2 && pack.status === 'ready' && Boolean(report?.playable);
  const lists = needsLists(settings.pool);

  const applyDefaults = () => {
    setSettings(DEFAULT_PREFS);
    resetPrefs();
  };

  const status = !room.isHost ? `Waiting for ${room.hostName || 'the host'} to start.`
    : active.length < 2 ? 'Waiting for more players to join.'
      : pack.status === 'loading' ? 'Loading the fact pack…'
        : pack.status !== 'ready' ? 'Couldn’t load the fact pack.'
          : !report?.playable ? 'Not enough clues to fill a game.'
            : `${active.length} players · ${report.shows} shows · ${report.characters} characters`;

  return (
    <SetupLayout
      game={descriptor}
      tagline="Anime trivia, straight from the credits"
      aside={<RoomCode code={room.roomCode} />}
      left={(
        <>
          <PlayerRoster
            room={room}
            players={players}
            active={active}
            statuses={room.playerStatuses ?? {}}
            tone="red"
            // A list count is a warning about nothing when the pool reads no lists.
            badgeFor={lists ? (p) => <ListBadge count={(p.animeList || []).length} /> : undefined}
          />
          {lists && <LobbyImport />}
        </>
      )}
      right={room.isHost ? (
        <>
          <QuizSettings
            values={settings}
            onChange={(key, value) => setSettings((s) => ({ ...s, [key]: value }))}
            report={report}
            packStatus={pack.status}
            onRetryPack={pack.retry}
            players={active}
          />
          <p className="text-sm text-fg-subtle">You&apos;re the host — your settings apply to everyone.</p>
          <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
        </>
      ) : (
        <HostWaitCard hostName={room.hostName} needsList={lists} />
      )}
      start={(
        <StartBar status={status} ready={room.isHost && canStart}>
          {room.isHost && (
            <Button
              variant="primary"
              size="lg"
              disabled={!canStart}
              onClick={() => {
                savePrefs(settings);
                room.startGame(settings, pack.pack);
              }}
            >
              Start Game
            </Button>
          )}
        </StartBar>
      )}
    />
  );
}
