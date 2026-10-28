import { useEffect, useState } from 'react';
import { HostWaitCard, ListBadge, LobbyImport, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import TeamsCard from '../../../shared/components/teams/TeamsCard';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { splitTeams } from '../../../shared/utils/teams';
import { Button } from '../../../shared/ui';
import AniChainSettings from './AniChainSettings';
import { chainPool } from '../deal';
import { DEFAULT_PREFS, cleanPrefs } from '../prefs';
import { MIN_PLAYERS, MIN_TEAM, isTeamShape } from '../rules';
import { TAGLINE, setupStatus } from '../copy';
import descriptor from '../index';

// The online lobby: the shared lobby pieces (code, roster, import, the guest's
// wait card), the teams card when the host picks a team shape, the host's
// settings and Start. Each player moves themselves between teams; the host may
// move anyone.
export default function OnlineLobby({ room, pack }) {
  const { prefs, savePrefs, resetPrefs } = useGamePrefs(descriptor.id, DEFAULT_PREFS);
  // ONE OBJECT, because it IS what leaves the host's device at Start.
  const [settings, setSettings] = useState(() => cleanPrefs(prefs));

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  // Every gate counts the players actually here — a ghost left by a closed tab
  // would hold a seat on a team nobody can fill.
  const active = room.activePlayers ?? players;
  useRepublishProfile(room, me);

  // The host's shape, published to the lobby so a guest's phone shows the
  // teams card exactly when a team game is coming.
  const { setLobbyShape } = room;
  const published = room.lobby.shape;
  useEffect(() => {
    if (room.isHost && published !== settings.shape) setLobbyShape(settings.shape);
  }, [room.isHost, published, settings.shape, setLobbyShape]);
  const teamShape = isTeamShape(room.isHost ? settings.shape : published);
  const teams = splitTeams(active.map((p) => p.id), room.lobby.teams);
  // Unmemoized: a few thousand characters folded once a render, and the
  // compiler cannot keep a memo over `active` (it comes off the room object).
  const poolSize = chainPool(active, settings.pool).length;
  const gate = setupStatus({ count: active.length, teams, settings, poolSize, packStatus: pack.status, online: true });
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
            tone="violet"
            badgeFor={(p) => <ListBadge count={(p.animeList || []).length} />}
            minPlayers={MIN_PLAYERS[settings.shape]}
          />
          <LobbyImport />
          {teamShape && active.length > 0 && (
            <TeamsCard
              teams={teams}
              players={active}
              youId={room.myPlayerId}
              canMove={(p) => room.isHost || p.id === room.myPlayerId}
              onMove={(id, team) => room.chooseTeam(id, team)}
              note={`Each team needs ${MIN_TEAM[room.isHost ? settings.shape : published]} players.`}
            />
          )}
        </>
      )}
      right={room.isHost ? (
        <AniChainSettings
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
