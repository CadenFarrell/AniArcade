import { useState } from 'react';
import { HostWaitCard, ListBadge, LobbyImport, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { Button } from '../../../shared/ui';
import AniDraftSettings from './AniDraftSettings';
import { draftPool } from '../deal';
import { DEFAULT_PREFS, cleanPrefs } from '../prefs';
import { MIN_PLAYERS } from '../rules';
import { TAGLINE, setupStatus } from '../copy';
import descriptor from '../index';

// The online lobby: the shared lobby pieces (code, roster, import, the guest's
// wait card), the host's settings and Start. Every board is dealt from the
// room's copies of the lists, so a guest's list counts the moment it lands.
export default function OnlineLobby({ room }) {
  const { prefs, savePrefs, resetPrefs } = useGamePrefs(descriptor.id, DEFAULT_PREFS);
  // ONE OBJECT, because it IS what leaves the host's device at Start.
  const [settings, setSettings] = useState(() => cleanPrefs(prefs));

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  // Every gate counts the players actually here — a ghost left by a closed tab
  // would be dealt a team nobody drafts.
  const active = room.activePlayers ?? players;
  useRepublishProfile(room, me);

  // Unmemoized: a few thousand characters folded once a render, and the
  // compiler cannot keep a memo over `active` (it comes off the room object).
  const poolSize = draftPool(active, settings.pool).length;
  const gate = setupStatus({ count: active.length, settings, poolSize, online: true });
  const status = room.isHost ? gate.status : `Waiting for ${room.hostName || 'the host'} to start.`;

  return (
    <SetupLayout
      game={descriptor}
      tagline={TAGLINE}
      aside={<RoomCode code={room.roomCode} />}
      left={(
        <>
          <PlayerRoster
            room={room}
            players={players}
            active={active}
            statuses={room.playerStatuses ?? {}}
            tone="magenta"
            badgeFor={(p) => <ListBadge count={(p.animeList || []).length} />}
            minPlayers={MIN_PLAYERS}
          />
          <LobbyImport />
        </>
      )}
      right={room.isHost ? (
        <AniDraftSettings
          values={settings}
          host
          online
          onChange={(key, value) => setSettings((s) => ({ ...s, [key]: value }))}
          onReset={() => { setSettings({ ...DEFAULT_PREFS }); resetPrefs(); }}
        />
      ) : (
        <HostWaitCard hostName={room.hostName} needsList />
      )}
      start={(
        <StartBar status={status} ready={room.isHost && gate.ready}>
          {room.isHost && (
            <Button
              variant="primary"
              size="lg"
              disabled={!gate.ready}
              onClick={() => { savePrefs(settings); room.startGame(settings); }}
            >
              Start Game
            </Button>
          )}
        </StartBar>
      )}
    />
  );
}
