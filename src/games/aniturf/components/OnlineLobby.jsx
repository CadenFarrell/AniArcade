import { useMemo, useState } from 'react';
import { HostWaitCard, ListBadge, LobbyImport, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { Banner, Button } from '../../../shared/ui';
import AniTurfSettings from './AniTurfSettings';
import TeamsCard from './TeamsCard';
import { TAGLINE } from './copy';
import { boardPool } from '../utils/board';
import { DEFAULT_PREFS } from '../prefs';
import { CELLS, MIN_PLAYERS, resolveGivers, splitTeams, teamsReady } from '../rules';
import descriptor from '../index';

// The online lobby: the shared lobby pieces (code, roster, import, the guest's
// wait card), the teams card, the host's settings and Start. Each player moves
// themselves between teams; the host may move anyone and hands out the crowns.
export default function OnlineLobby({ room }) {
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniturf', DEFAULT_PREFS);
  // ONE OBJECT, because it IS what leaves the host's device at Start.
  const [settings, setSettings] = useState(() => ({ sharedOnly: prefs.sharedOnly, traps: prefs.traps }));
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  // Every gate counts only the players here: a ghost left by a closed tab
  // would otherwise hold a seat on a team nobody can fill.
  const active = room.activePlayers ?? players;
  useRepublishProfile(room, me);

  const teams = splitTeams(active.map((p) => p.id), room.lobby.teams);
  const givers = resolveGivers(teams, room.lobby.givers);
  const ready = teamsReady(teams);
  const available = useMemo(
    () => boardPool(active, { sharedOnly: settings.sharedOnly }).length,
    [active, settings.sharedOnly],
  );
  const enoughChars = available >= CELLS;
  const canStart = active.length >= MIN_PLAYERS && ready.ok && enoughChars;

  const status = !room.isHost ? `Waiting for ${room.hostName || 'the host'} to start.`
    : active.length < MIN_PLAYERS ? `Waiting for players — this game needs ${MIN_PLAYERS}.`
      : !ready.ok ? ready.reason
        : !enoughChars ? `Not enough characters for the board — found ${available} of ${CELLS}.`
          : `Red ${teams.red.length} v Blue ${teams.blue.length} · ${available} characters to draw from`;

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
            tone="plum"
            badgeFor={(p) => <ListBadge count={(p.animeList || []).length} />}
            minPlayers={MIN_PLAYERS}
          />
          <LobbyImport />
          {active.length > 0 && (
            <TeamsCard
              teams={teams}
              givers={givers}
              players={active}
              youId={room.myPlayerId}
              canMove={(p) => room.isHost || p.id === room.myPlayerId}
              canCrown={room.isHost}
              onMove={(id, team) => room.chooseTeam(id, team)}
              onCrown={(team, id) => room.setGiver(team, id)}
            />
          )}
          {room.isHost && active.length >= MIN_PLAYERS && !enoughChars && (
            <Banner tone="warning" className="mb-4">
              The board needs {CELLS} characters and these lists hold {available}.
              {settings.sharedOnly ? ' Turn off “Shared characters only”, or import more lists.' : ' Import bigger lists.'}
            </Banner>
          )}
        </>
      )}
      right={room.isHost ? (
        <AniTurfSettings
          values={settings}
          onChange={change}
          host
          onReset={() => { setSettings({ ...DEFAULT_PREFS }); resetPrefs(); }}
        />
      ) : (
        <HostWaitCard hostName={room.hostName} needsList />
      )}
      start={(
        <StartBar status={status} ready={room.isHost && canStart}>
          {room.isHost && (
            <Button
              variant="primary"
              size="lg"
              disabled={!canStart}
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
