import { useState } from 'react';
import { HostWaitCard, ListBadge, LobbyImport, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { normalizeTitle } from '../../../shared/utils/ranking';
import { DEFAULT_PREFS, POSITIONS } from '../prefs';
import { Backdrop, Banner, Button, Card, CardRow, Checkbox, NumberInput, Screen, Wordmark } from '../../../shared/ui';

export default function OnlineLobby({ room }) {
  // Shares one saved set with PlayerSetup, which offers three more options than
  // this lobby does (the timer and talk mode). savePrefs merges rather than
  // replaces precisely so hosting a room cannot wipe those.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniguess', DEFAULT_PREFS);
  const [sharedShowsOnly, setSharedShowsOnly] = useState(prefs.sharedShowsOnly);
  const [twoStepRandom, setTwoStepRandom] = useState(prefs.twoStepRandom);
  const [pointsPerPosition, setPointsPerPosition] = useState(prefs.pointsPerPosition);

  const settings = { sharedShowsOnly, twoStepRandom, pointsPerPosition };

  const applyDefaults = () => {
    setSharedShowsOnly(DEFAULT_PREFS.sharedShowsOnly);
    setTwoStepRandom(DEFAULT_PREFS.twoStepRandom);
    setPointsPerPosition([...DEFAULT_PREFS.pointsPerPosition]);
    resetPrefs();
  };

  const players = room.gameSession?.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;

  // Everything that gates Start counts only the players actually here. A ghost
  // left behind by a closed tab has no characters, and counting them would
  // block Start for everyone present with no way to clear it.
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};

  // Pushes a list imported after joining back up to the room; see the hook.
  useRepublishProfile(room, me);

  const charCount = (p) => p.animeList.reduce((s, a) => s + a.characters.length, 0);
  const allHaveChars = active.every((p) => charCount(p) > 0);
  // Same guard local setup applies: with "shared shows only" on and no
  // overlapping titles there'd be nothing assignable once the game started.
  const hasSharedAnime = active.length < 2 || active.some((p, i) =>
    active.some((other, j) => i !== j &&
      p.animeList.some((a) => other.animeList.some((o) => normalizeTitle(o.title) === normalizeTitle(a.title))))
  );
  const canStart = active.length >= 2 && allHaveChars && (!sharedShowsOnly || hasSharedAnime);

  // NumberInput hands over an already-parsed, already-clamped number, so this
  // no longer parses anything — it only writes the slot.
  const updatePoints = (i, n) => {
    const updated = [...pointsPerPosition];
    updated[i] = n;
    setPointsPerPosition(updated);
  };

  const handleStart = () => {
    savePrefs(settings);
    room.handleStartGame({
      // Deal in the players actually here — the turn rotation and the character
      // pool are both built from this list.
      players: active,
      // The timer literals are not defaults being restated: online play has no
      // timer at all, so a remembered one from local play must not leak in here.
      settings: { ...settings, timerEnabled: false, timerSeconds: 60 },
    });
  };

  return (
    <>
      <Backdrop />
      <Screen>
        <Wordmark tone="purple" size="sm" level={2} className="mb-6">
          🌐 Room Lobby
        </Wordmark>

        <RoomCode code={room.roomCode} />

        <PlayerRoster
          room={room}
          players={players}
          active={active}
          statuses={statuses}
          tone="purple"
          badgeFor={(p) => <ListBadge count={charCount(p)} unit="chars" empty="⚠️ No chars" />}
        />

        <LobbyImport />

        {!room.isHost && <HostWaitCard hostName={room.hostName} needsList />}

        {room.isHost && (<>
        <Card title="⚙️ Settings" padding="lg" className="mb-6">
          <Checkbox
            label="Shared shows only"
            checked={sharedShowsOnly}
            onChange={(e) => setSharedShowsOnly(e.target.checked)}
            className="mb-4"
          />
          <Checkbox
            label="Anime-first randomizer"
            checked={twoStepRandom}
            onChange={(e) => setTwoStepRandom(e.target.checked)}
            className="mb-5"
          />

          <p className="mb-1 text-base text-fg-strong">Points per position:</p>
          {/* One per row — see PlayerSetup, its twin. This screen is the reason:
              its Screen defaults to max-w-md, so a four-across grid left each
              cell narrower than the two buttons inside it. */}
          {POSITIONS.map(({ icon, label }, i) => (
            <CardRow key={label}>
              <span className="text-fg-strong">
                <span className="mr-2 text-lg">{icon}</span>
                {label}
              </span>
              <NumberInput
                size="sm"
                value={pointsPerPosition[i]}
                min={0}
                max={99}
                ariaLabel={`Points for ${label}`}
                onChange={(n) => updatePoints(i, n)}
                className="w-40 flex-shrink-0"
              />
            </CardRow>
          ))}
          <p className="mt-4 text-sm text-fg-subtle">
            You&apos;re the host — your settings apply to everyone.
          </p>

          <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
        </Card>

        {active.length >= 2 && !allHaveChars && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Every player needs at least one character before you can start.
          </Banner>
        )}
        {active.length >= 2 && allHaveChars && sharedShowsOnly && !hasSharedAnime && (
          <Banner tone="warning" className="mb-4">
            ⚠️ No anime titles overlap between players — turn off &quot;Shared shows only&quot; or
            import matching titles.
          </Banner>
        )}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={handleStart}
          disabled={!canStart}
        >
          🎮 Start Game
        </Button>
        </>)}
      </Screen>
    </>
  );
}
