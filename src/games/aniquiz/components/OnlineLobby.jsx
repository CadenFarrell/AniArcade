import { useState } from 'react';
import { HostWaitCard, ListBadge, LobbyImport, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import QuizSettings from './QuizSettings';
import { usePoolReport } from '../hooks/usePoolReport';
import { needsLists } from '../utils/pool';
import { DEFAULT_PREFS } from '../prefs';
import { Backdrop, Button, Screen, Wordmark } from '../../../shared/ui';

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

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark tone="red" size="sm" level={2} className="mb-6">
          🌐 AniQuiz Lobby
        </Wordmark>

        <RoomCode code={room.roomCode} />

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

        {!room.isHost && <HostWaitCard hostName={room.hostName} needsList={lists} />}

        {room.isHost && (
          <>
            <QuizSettings
              values={settings}
              onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
              report={report}
              packStatus={pack.status}
              onRetryPack={pack.retry}
              players={active}
            />
            <div className="mb-6">
              <p className="text-sm text-fg-subtle">You&apos;re the host — your settings apply to everyone.</p>
              <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
            </div>
            <Button
              variant="primary"
              size="xl"
              fullWidth
              disabled={!canStart}
              onClick={() => {
                savePrefs(settings);
                room.startGame(settings, pack.pack);
              }}
            >
              🎮 Start Game
            </Button>
          </>
        )}
      </Screen>
    </>
  );
}
