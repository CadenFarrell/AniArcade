import { useMemo, useState } from 'react';
import { HostWaitCard, ListBadge, LobbyImport, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { Button } from '../../../shared/ui';
import AniNameSettings from './AniNameSettings';
import ShortBanner from './ShortBanner';
import { dealGame } from '../deal';
import { DEFAULT_PREFS } from '../prefs';
import { TAGLINE, setupStatus } from '../copy';
import descriptor from '../index';

// The online lobby: the shared lobby pieces (code, roster, import, the guest's
// wait card) and the host's settings — the same card local setup renders. Only
// the host deals, so only the host's device runs the trial deal.
export default function OnlineLobby({ room, pack }) {
  const { prefs, savePrefs, resetPrefs } = useGamePrefs(descriptor.id, DEFAULT_PREFS);
  // ONE OBJECT, because it IS what leaves the host's device at Start.
  const [settings, setSettings] = useState(prefs);

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  // Every gate counts the players actually here — a ghost left by a closed tab
  // has a list that would still count toward a pool nobody can play from.
  const active = room.activePlayers ?? players;
  useRepublishProfile(room, me);

  const trial = useMemo(
    () => (room.isHost && active.length && pack.status !== 'loading' ? dealGame(active, settings, pack.pack) : null),
    [room.isHost, active, settings, pack.status, pack.pack],
  );
  const gate = setupStatus({ count: active.length, trial, settings, packStatus: pack.status, online: true });
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
            tone="umber"
            badgeFor={(p) => <ListBadge count={(p.animeList || []).length} />}
          />
          <LobbyImport />
          {room.isHost && gate.short && <ShortBanner settings={settings} found={trial.found} online />}
        </>
      )}
      right={room.isHost ? (
        <AniNameSettings
          values={settings}
          host
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
