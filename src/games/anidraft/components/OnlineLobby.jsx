import { useState } from 'react';
import { HostWaitCard, ListBadge, LobbyImport, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { Button } from '../../../shared/ui';
import AniDraftSettings from './AniDraftSettings';
import RoleEditor, { OwnRolesBanner } from './RoleEditor';
import { useCustomRoles } from '../hooks/useCustomRoles';
import { deckRoles } from '../roles';
import { draftPool } from '../deal';
import { DEFAULT_PREFS, cleanPrefs } from '../prefs';
import { MIN_PLAYERS } from '../rules';
import { MIN_OWN_ROLES, TAGLINE, setupStatus } from '../copy';
import descriptor from '../index';

// The online lobby: the shared lobby pieces (code, roster, import, the guest's
// wait card), the host's settings and Start. Every board is dealt from the
// room's copies of the lists, so a guest's list counts the moment it lands.
export default function OnlineLobby({ room }) {
  const { prefs, savePrefs, resetPrefs } = useGamePrefs(descriptor.id, DEFAULT_PREFS);
  // ONE OBJECT, because it IS what leaves the host's device at Start.
  const [settings, setSettings] = useState(() => cleanPrefs(prefs));
  // Only the host's are ever dealt, so only the host is shown the editor; a
  // guest's written roles wait on their phone for a game they host.
  const { roles: ownRoles, saveRole, deleteRole } = useCustomRoles();

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  // Every gate counts the players actually here — a ghost left by a closed tab
  // would be dealt a team nobody drafts.
  const active = room.activePlayers ?? players;
  useRepublishProfile(room, me);

  // Unmemoized: a few thousand characters folded once a render, and the
  // compiler cannot keep a memo over `active` (it comes off the room object).
  const poolSize = draftPool(active, settings.pool).length;
  const gate = setupStatus({ count: active.length, settings, poolSize, ownRoles: ownRoles.length, online: true });
  const fewOwn = settings.roleDeck === 'mine' && ownRoles.length < MIN_OWN_ROLES;
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
        <>
          <AniDraftSettings
            values={settings}
            host
            online
            ownRoles={ownRoles.length}
            onChange={(key, value) => setSettings((s) => ({ ...s, [key]: value }))}
            onReset={() => { setSettings({ ...DEFAULT_PREFS }); resetPrefs(); }}
          />
          {fewOwn && <OwnRolesBanner count={ownRoles.length} />}
          <RoleEditor roles={ownRoles} onSave={saveRole} onDelete={deleteRole} />
        </>
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
                // The deck goes into the game at Start: any phone may deal the
                // next round, and only this one holds these roles.
                room.startGame({ ...settings, customRoles: deckRoles(settings.roleDeck, ownRoles) });
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
