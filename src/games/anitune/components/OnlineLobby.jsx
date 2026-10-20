import { useState } from 'react';
import { HostWaitCard, ListBadge, LobbyImport, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { usePackBackfill } from '../../../shared/hooks/usePackBackfill';
import AniTuneSettings from './AniTuneSettings';
import { eligibleCount } from '../utils/questionPool';
import { DEFAULT_PREFS } from '../prefs';
import descriptor from '../index';
import { Banner, Button } from '../../../shared/ui';

// The online lobby. The room code, roster, list import and guest wait card are
// shared/components/Lobby.jsx. The settings are AniTune's, and they are the same
// component AniTuneSetup renders rather than a hand-kept copy of it — the two
// offer an identical set, and at seventeen options a copy is a promise to drift.
// Whoever presses Start prepares the round and their settings apply to everyone.
export default function OnlineLobby({ room }) {
  // One saved set shared with AniTuneSetup, which offers the same options.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anitune', DEFAULT_PREFS);
  const [settings, setSettings] = useState(prefs);

  const applyDefaults = () => {
    setSettings(DEFAULT_PREFS);
    resetPrefs();
  };

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  const hostName = players.find((p) => p.id === room.hostId)?.name ?? '';

  // Everything that gates Start counts only the players actually here. A ghost
  // left behind by a closed tab has no anime list, and counting them would
  // block Start for everyone present with no way to clear it.
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};

  // Pushes a list imported after joining back up to the room; see the hook.
  useRepublishProfile(room, me);
  // Repairs an old list's missing stats from the fact pack; the republish
  // above then carries the repair into the room.
  usePackBackfill();

  const showCount = (p) => (p.animeList || []).length;
  const everyoneHasShows = active.every((p) => showCount(p) > 0);
  const eligible = eligibleCount(active, settings);
  const noKinds = !settings.includeOpenings && !settings.includeEndings;
  const canStart = active.length >= 2 && everyoneHasShows && eligible > 0 && !noKinds;

  const handleStart = () => {
    savePrefs(settings);
    room.startGame(settings);
  };

  const status = !room.isHost ? `Waiting for ${hostName || 'the host'} to start.`
    : active.length < 2 ? 'Waiting for more players to join.'
      : !everyoneHasShows ? 'Every player needs an anime list.'
        : noKinds ? 'Pick openings, endings, or both.'
          : eligible === 0 ? 'No shows in play.'
            : `${active.length} players · ${eligible} show${eligible === 1 ? '' : 's'} in play${settings.sharedSongsOnly ? ' (shared)' : ''}`;

  return (
    <SetupLayout
      game={descriptor}
      tagline="Name the anime from its opening or ending"
      aside={<RoomCode code={room.roomCode} />}
      left={(
        <>
          <PlayerRoster
            room={room}
            players={players}
            active={active}
            statuses={statuses}
            tone="blue"
            badgeFor={(p) => <ListBadge count={showCount(p)} />}
          />
          <LobbyImport />
          {room.isHost && active.length >= 2 && !everyoneHasShows && (
            <Banner tone="warning" className="mb-4">
              Every player needs an anime list before you can start.
            </Banner>
          )}
          {room.isHost && active.length >= 2 && everyoneHasShows && settings.sharedSongsOnly && eligible === 0 && (
            <Banner tone="warning" className="mb-4">
              No anime titles overlap between players — turn off &quot;Shared songs only&quot; or
              import matching titles.
            </Banner>
          )}
        </>
      )}
      right={room.isHost ? (
        <>
          <AniTuneSettings
            players={active}
            values={settings}
            onChange={(key, value) => setSettings((s) => ({ ...s, [key]: value }))}
          />
          {noKinds && (
            <Banner tone="warning" className="mb-4">
              Pick openings, endings, or both.
            </Banner>
          )}
          <p className="text-sm text-fg-subtle">You&apos;re the host — your settings apply to everyone.</p>
          <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
        </>
      ) : (
        <HostWaitCard hostName={hostName} needsList />
      )}
      start={(
        <StartBar status={status} ready={room.isHost && canStart}>
          {room.isHost && (
            <Button variant="primary" size="lg" onClick={handleStart} disabled={!canStart}>
              Start Game
            </Button>
          )}
        </StartBar>
      )}
    />
  );
}
