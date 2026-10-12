import { useMemo, useState } from 'react';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { HostWaitCard, ListBadge, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import { Backdrop, Banner, Button, Screen, Wordmark } from '../../../shared/ui';
import ClueModePicker from './ClueModePicker';
import WavelengthSettings from './WavelengthSettings';
import { poolTooSmall } from '../help';
import { DEFAULT_PREFS } from '../prefs';
import { MIN_PLAYERS, needsCardPool } from '../rules';
import { MIN_CARD_POOL, eligibleCards, poolNoun } from '../utils/cards';

// The online lobby. The room code, roster and guest wait card are
// shared/components/Lobby.jsx; what lives here is AniWave's own host-only
// settings, its Start gates and Start.
//
// This lobby offers a SUPERSET of the local setup screen — the timer only makes
// sense here, where everyone dials at once, rather than on a hot seat being
// passed around a table. savePrefs merges rather than replaces, which is what
// lets the two screens own different subsets without either wiping the other's.
export default function OnlineLobby({ room }) {
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniwave', DEFAULT_PREFS);

  // Everything reaching startGame has to be in here: this object IS what leaves
  // the host's device, so a key missing from it never reaches the room at all.
  // clueMode in particular — without it every room would play a typed clue
  // whatever the host chose, and nothing on any screen would look wrong.
  const [settings, setSettings] = useState(() => ({
    rounds: prefs.rounds,
    timed: prefs.timed,
    guessSeconds: prefs.guessSeconds,
    clueMode: prefs.clueMode,
    cardPool: prefs.cardPool,
    sharedOnly: prefs.sharedOnly,
  }));
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  const { clueMode, cardPool, sharedOnly } = settings;

  const applyDefaults = () => {
    setSettings({ ...DEFAULT_PREFS });
    resetPrefs();
  };

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};
  const needsCards = needsCardPool(clueMode);

  // Pushes a list imported after joining back up to the room; see the hook.
  useRepublishProfile(room, me);

  // Against the ACTIVE roster, not everyone who ever joined: a ghost left by a
  // closed tab would otherwise count toward a shared pool nobody can draw from.
  const eligible = useMemo(
    () => (needsCards ? eligibleCards(active, { pool: cardPool, sharedOnly }).length : 0),
    [needsCards, active, cardPool, sharedOnly],
  );

  const noun = poolNoun(cardPool);
  // Counts only the players actually here: a ghost left by a closed tab would
  // otherwise satisfy the minimum and hand somebody absent the psychic role.
  const enoughPlayers = active.length >= MIN_PLAYERS;
  const everyoneHasList = !needsCards || active.every((p) => (p.animeList || []).length > 0);
  const canStart = enoughPlayers && everyoneHasList && (!needsCards || eligible >= MIN_CARD_POOL);

  return (
    <>
      <Backdrop />
      <Screen>
        <Wordmark tone="purple" size="md" className="mb-8">AniWave</Wordmark>

        <RoomCode code={room.roomCode} />

        <PlayerRoster
          room={room}
          players={players}
          active={active}
          statuses={statuses}
          tone="purple"
          minPlayers={MIN_PLAYERS}
          // Only in the modes that deal — a list badge on a typed-clue round is
          // a warning about nothing. Whoever it names is the person who has to
          // go and import, so it has to be per-row.
          badgeFor={needsCards ? (p) => <ListBadge count={(p.animeList || []).length} /> : undefined}
        />

        {room.isHost ? (
          <>
            <ClueModePicker value={clueMode} onChange={(m) => change('clueMode', m)} />

            <WavelengthSettings
              values={settings}
              onChange={change}
              eligible={eligible}
              playerCount={active.length}
              online
              onReset={applyDefaults}
            />

            {!enoughPlayers && (
              <Banner tone="warning" className="mb-6">
                ⚠️ Needs {MIN_PLAYERS} players — with one guesser there is no
                spread for the psychic to be read against.
              </Banner>
            )}

            {/* Two different problems, and conflating them sends the wrong
                person to go and import: one player with no list at all is not
                the same as everyone having one and the overlap being thin. */}
            {enoughPlayers && needsCards && !everyoneHasList && (
              <Banner tone="warning" className="mb-6">
                ⚠️ Everyone needs an anime list for this mode — whoever is marked
                ⚠️ above can import one from the hub, or you can switch back to a
                typed clue.
              </Banner>
            )}

            {enoughPlayers && needsCards && everyoneHasList && eligible < MIN_CARD_POOL && (
              <Banner tone="warning" className="mb-6">
                ⚠️ {poolTooSmall({ eligible, noun, sharedOnly, players: active.length })}
              </Banner>
            )}

            <Button
              variant="primary"
              size="xl"
              fullWidth
              disabled={!canStart}
              onClick={() => {
                savePrefs(settings);
                room.startGame(settings);
              }}
            >
              🎮 Start Game
            </Button>
          </>
        ) : (
          <HostWaitCard hostName={room.hostName} />
        )}
      </Screen>
    </>
  );
}
