import { useState } from 'react';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { HostWaitCard, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { Banner, Button } from '../../../shared/ui';
import AniTagSettings from './AniTagSettings';
import CategoryEditor from './CategoryEditor';
import { useCustomCategories } from '../hooks/useCustomCategories';
import { NO_LIST_NEEDED } from '../help';
import { DEFAULT_PREFS, POOL_LABELS } from '../prefs';
import { MIN_PLAYERS } from '../rules';
import descriptor from '../index';

// The online lobby. The room code, roster and guest wait card are
// shared/components/Lobby.jsx; what lives here is AniTag's own banner, settings
// and Start.
//
// THE SETTINGS CARD IS NOT HERE — it is AniTagSettings, shared with the local
// setup screen. It used to be a hundred lines duplicated between the two files,
// which is precisely the near-twin drift CLAUDE.md warns about: every change had
// to be made twice, and a missed one is invisible until somebody plays the other
// half of the game.
//
// THE PROFILE-REPUBLISHING EFFECT runs here too, though AniTag reads nobody's
// list for its rounds. It went without one until players could choose their
// character: the face every phone draws for you comes from your profile's copy
// in the room, so a character picked in this lobby has to be pushed up like any
// other lobby's import, or only your own phone would ever see it.
//
// THE CATEGORY EDITOR IS SHOWN TO EVERYONE, not just the host, and both modes
// give the same reason. What a player writes stays on their own device: in
// chosen mode it heads the list they pick their own clause from, and in dealt
// mode it is drawn from when that device is one of the two dealers (see
// useCategoriesRoom). Either way a guest writing a clause is not a setting they
// cannot apply — it is content that reaches the table through them. The
// host-only gate belongs on the settings card and nowhere else.
export default function OnlineLobby({ room }) {
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anitag', DEFAULT_PREFS);
  const { categories, saveCategory, deleteCategory } = useCustomCategories();

  // ONE OBJECT RATHER THAN FIVE useStates, because this object IS what leaves
  // the host's device: a key missing from it never reaches the room at all, and
  // assembling it from five separate pieces at the call site is how one goes
  // missing. `customCategories` is deliberately not among them — see
  // useCategoriesRoom.
  const [settings, setSettings] = useState(() => ({
    rounds: prefs.rounds,
    proposalCap: prefs.proposalCap,
    categoryPool: prefs.categoryPool,
    categoryMode: prefs.categoryMode,
    useCustom: prefs.useCustom,
  }));
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  useRepublishProfile(room, me);
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};
  const pool = POOL_LABELS[settings.categoryPool] ?? POOL_LABELS.characters;
  // Counts only the players actually here: a ghost left by a closed tab would
  // otherwise satisfy the minimum and hand somebody absent the opening go.
  const enoughPlayers = active.length >= MIN_PLAYERS;

  const status = !room.isHost ? `Waiting for ${room.hostName || 'the host'} to start.`
    : enoughPlayers ? `${active.length} players · no list needed`
      : `Waiting for players — this game needs ${MIN_PLAYERS}.`;

  return (
    <SetupLayout
      game={descriptor}
      tagline="Everyone has a secret category. Name things until you work one out."
      aside={<RoomCode code={room.roomCode} />}
      left={(
        <>
          <Banner tone="info" className="mb-6">{NO_LIST_NEEDED}</Banner>
          {/* No badgeFor, unlike every other lobby in the arcade — nothing here
              reads an anime list, so a list badge would be a warning about
              nothing and would contradict the banner above. */}
          <PlayerRoster
            room={room}
            players={players}
            active={active}
            statuses={statuses}
            tone="lime"
            minPlayers={MIN_PLAYERS}
          />
          {room.isHost && !enoughPlayers && (
            <Banner tone="warning" className="mb-6">
              Needs {MIN_PLAYERS} players — somebody has to be able to answer.
            </Banner>
          )}
        </>
      )}
      right={(
        <>
          {room.isHost ? (
            <AniTagSettings
              values={settings}
              onChange={change}
              playerCount={active.length}
              customCategories={categories}
              onReset={() => { setSettings({ ...DEFAULT_PREFS }); resetPrefs(); }}
            />
          ) : (
            <HostWaitCard hostName={room.hostName} />
          )}
          {/* For everyone, host or not — see the note at the top of the file. */}
          <CategoryEditor
            categories={categories}
            onSave={saveCategory}
            onDelete={deleteCategory}
            noun={pool.noun}
          />
        </>
      )}
      start={(
        <StartBar status={status} ready={room.isHost && enoughPlayers}>
          {room.isHost && (
            <Button
              variant="primary"
              size="lg"
              disabled={!enoughPlayers}
              onClick={() => {
                savePrefs(settings);
                room.startGame(settings);
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
