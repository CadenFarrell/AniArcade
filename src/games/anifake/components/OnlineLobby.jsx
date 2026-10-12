import { useMemo, useState } from 'react';
import { HostWaitCard, ListBadge, LobbyImport, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { usePackBackfill } from '../../../shared/hooks/usePackBackfill';
import ModePicker from './ModePicker';
import AniFakeSettings from './AniFakeSettings';
import { eligibleCharacters, fameReport } from '../utils/pool';
import { getFame } from '../fame';
import { DEFAULT_PREFS } from '../prefs';
import { minPool, MIN_PLAYERS } from '../rules';
import { Backdrop, Banner, Button, Screen, Wordmark } from '../../../shared/ui';

// The online lobby. The room code, roster, list import and guest wait card are
// shared/components/Lobby.jsx; what lives here is AniFake's own host-only
// settings, its Start gates and Start.
export default function OnlineLobby({ room }) {
  // Shares one saved set with the local setup screen. This lobby offers a subset
  // of it (no talk mode), which is why savePrefs merges rather than replaces —
  // hosting a room must not wipe the settings only local play can reach.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anifake', DEFAULT_PREFS);
  // ONE OBJECT, because it IS what leaves the host's device: a key missing from
  // it never reaches the room. No talkMode — see AniFakeSettings' `local`.
  const [settings, setSettings] = useState(() => ({
    mode: prefs.mode,
    laps: prefs.laps,
    sharedOnly: prefs.sharedOnly,
    fame: prefs.fame,
    allowRedeal: prefs.allowRedeal,
  }));
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  const { mode, sharedOnly, fame } = settings;

  const applyDefaults = () => {
    const { talkMode: _LOCAL_ONLY, ...online } = DEFAULT_PREFS;
    setSettings(online);
    resetPrefs();
  };

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;

  // Everything that gates Start counts only the players actually here: a ghost
  // left by a closed tab has no anime list, and counting it would block Start
  // for everyone present with no way to clear it.
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};

  // Pushes a list imported after joining back up to the room; see the hook.
  useRepublishProfile(room, me);
  // Repairs an old list's missing stats from the fact pack; the republish
  // above then carries the repair into the room.
  usePackBackfill();

  const showCount = (p) => (p.animeList || []).length;
  const everyoneHasShows = active.every((p) => showCount(p) > 0);

  // The entries, not just the count — the fame warning asks the same array
  // whether it carries any popularity data. See AniFakeSetup, its twin.
  const poolEntries = useMemo(
    () => eligibleCharacters(active, { sharedOnly }),
    [active, sharedOnly]
  );
  const eligible = poolEntries.length;
  const { famous } = fameReport(poolEntries, fame);
  // The bar is what the mode needs to deal, not a board size — see the note on
  // rules.minPool. Keyed on `mode` because switching to decoy raises it.
  const needed = minPool(mode);
  const enough = eligible >= needed;
  const canStart = active.length >= MIN_PLAYERS && everyoneHasShows && enough;

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark tone="teal" size="sm" level={2} className="mb-6">
          🌐 AniFake Lobby
        </Wordmark>

        <RoomCode code={room.roomCode} />

        <PlayerRoster
          room={room}
          players={players}
          active={active}
          statuses={statuses}
          tone="teal"
          badgeFor={(p) => <ListBadge count={showCount(p)} />}
          minPlayers={MIN_PLAYERS}
        />

        <LobbyImport />

        {!room.isHost && <HostWaitCard hostName={room.hostName} needsList />}

        {room.isHost && (
          <>
            <ModePicker value={mode} onChange={(m) => change('mode', m)} />

            <AniFakeSettings
              values={settings}
              onChange={change}
              poolEntries={poolEntries}
              local={false}
              onReset={applyDefaults}
            />

            {/* The host picks the level for the whole room, so the host is who
                needs to see what it costs. Only when the term is live — there is
                no count worth reading when it is not narrowing anything. */}
            {famous > 0 && (
              <p className="mb-4 text-center text-base text-fg-helper">
                {eligible} shared character{eligible === 1 ? '' : 's'} · “{getFame(fame).label}”
                narrows this to {famous}
              </p>
            )}

            {active.length >= MIN_PLAYERS && !everyoneHasShows && (
              <Banner tone="warning" className="mb-4">
                ⚠️ Every player needs an anime list before you can start.
              </Banner>
            )}
            {active.length >= MIN_PLAYERS && everyoneHasShows && !enough && (
              <Banner tone="warning" className="mb-4">
                ⚠️ {needed === 1
                  ? 'Nobody has a character in common — found none.'
                  : `Decoy mode needs ${needed} characters, so the fake can be handed a
                     different one — found ${eligible}.`}
                {sharedOnly ? ' Turn off “Shared characters only”, or import matching titles.' : ''}
              </Banner>
            )}

            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={() => {
                savePrefs(settings);
                room.startGame(settings);
              }}
              disabled={!canStart}
            >
              🎮 Start Game
            </Button>
          </>
        )}
      </Screen>
    </>
  );
}
