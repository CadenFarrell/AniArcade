import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { normalizeTitle } from '../../../shared/utils/ranking';
import { DEFAULT_PREFS, POSITIONS } from '../prefs';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, NumberInput, Screen, Wordmark,
} from '../../../shared/ui';

export default function OnlineLobby({ room }) {
  const { activeProfile, saveProfile } = useProfileStore();
  // Shares one saved set with PlayerSetup, which offers three more options than
  // this lobby does (the timer and talk mode). savePrefs merges rather than
  // replaces precisely so hosting a room cannot wipe those.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniguess', DEFAULT_PREFS);
  const [sharedShowsOnly, setSharedShowsOnly] = useState(prefs.sharedShowsOnly);
  const [twoStepRandom, setTwoStepRandom] = useState(prefs.twoStepRandom);
  const [pointsPerPosition, setPointsPerPosition] = useState(prefs.pointsPerPosition);
  // null | 'pick' | 'refresh' — same shape ListManager uses, so the one-tap
  // refresh path behaves identically wherever you reach it from.
  const [importMode, setImportMode] = useState(null);

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

        <div className="mb-8 text-center">
          <p className="mb-3 text-fg-helper">Share this code with the other players:</p>
          <span className="sticker inline-block bg-pop-lime px-6 py-3 text-4xl text-ink tracking-[0.3em]">
            {room.roomCode}
          </span>
        </div>

        <Card title={`Players (${active.length})`} padding="lg" className="mb-6">
          {players.map((p) => {
            const chars = charCount(p);
            const status = statuses[p.id] ?? 'active';
            const here = status === 'active' || status === 'dropping';
            return (
              <CardRow key={p.id} className={here ? '' : 'opacity-40'}>
                <span className="text-white">
                  {p.id === room.hostId && <span title="Host">👑 </span>}
                  {p.name}{' '}
                  {p.id === room.myPlayerId && <span className="text-pop-purple">(you)</span>}
                </span>
                {status === 'dropping' && <Badge tone="amber">🔌 Reconnecting…</Badge>}
                {!here && <Badge tone="red">Left</Badge>}
                {status === 'active' && (
                  <Badge tone={chars > 0 ? 'lime' : 'amber'}>
                    {chars > 0 ? `${chars} chars` : '⚠️ No chars'}
                  </Badge>
                )}
              </CardRow>
            );
          })}
          {active.length < 2 && (
            <p className="mt-3 text-sm text-fg-subtle">Waiting for more players to join…</p>
          )}
        </Card>

        {/* Kept here even though the hub can import too: the lobby is where you
            find out you have a problem — the ⚠️ No chars badge and the "every
            player needs a character" banner both render on this screen. */}
        <div className="mb-6 flex gap-3">
          <Button
            variant="neutral"
            size="md"
            fullWidth
            onClick={() => setImportMode('pick')}
            disabled={!activeProfile}
          >
            🔗 Import my list from AniList
          </Button>
          {activeProfile?.anilistUsername && (
            <Button
              variant="neutral"
              size="md"
              className="flex-shrink-0 whitespace-nowrap"
              onClick={() => setImportMode('refresh')}
            >
              🔄 Refresh
            </Button>
          )}
        </div>

        {/* Only the host picks the settings and starts the game. Everyone else
            gets a read-only wait: the settings were per-device before, which
            read as a free-for-all — whoever hit Start first silently imposed
            their point values on the whole table. */}
        {!room.isHost && (
          <Card padding="lg" className="mb-6 text-center">
            <div className="mb-2 text-4xl">👑</div>
            <p className="font-display text-lg font-extrabold text-white">
              {room.hostName ? `${room.hostName} is the host` : 'Waiting for the host'}
            </p>
            <p className="mt-1 text-fg-helper">
              The host picks the settings, then starts the game. Import your list above so
              you&apos;re ready.
            </p>
          </Card>
        )}

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

        {/* Imports into the profile, never into `me`: the room copy is a
            join-time snapshot that has been through RTDB, and merging out of it
            would roll back any hub-side edit made since and drop the
            anilistImportedIds/anilistImportSettings the checklist reads. The
            effect above republishes it. */}
        {importMode && activeProfile && (
          <AniListImport
            profile={activeProfile}
            autoRefresh={importMode === 'refresh'}
            onClose={() => setImportMode(null)}
            onImported={(merged) => {
              saveProfile(merged);
              setImportMode(null);
            }}
          />
        )}
      </Screen>
    </>
  );
}
