import { useMemo, useState } from 'react';
import { HostWaitCard, ListBadge, LobbyImport, PlayerRoster, RoomCode } from '../../../shared/components/Lobby';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { useRepublishProfile } from '../../../shared/hooks/useRepublishProfile';
import { usePackBackfill } from '../../../shared/hooks/usePackBackfill';
import AniRankSettings from './AniRankSettings';
import AxisPicker from './AxisPicker';
import FormatOption from './FormatOption';
import { useCustomPrompts } from '../hooks/useCustomPrompts';
import { eligibleItems, opinionPoolCounts } from '../utils/deck';
import { DEFAULT_PREFS, axisIdOf, resolveSavedAxis } from '../prefs';
import { AXES, getAxis } from '../axes';
import { BOARD_SIZE } from '../rules';
import { Backdrop, Banner, Button, Card, Screen, Wordmark } from '../../../shared/ui';

// The online lobby. The room code, roster, list import and guest wait card are
// shared/components/Lobby.jsx; what lives here is AniRank's own host-only
// settings, its Start gates and Start.
export default function OnlineLobby({ room }) {
  // Prompts before the axis state: only an id is remembered, and turning that
  // back into a spec means looking it up among them. Same order as AniRankSetup.
  const { prompts, savePrompt, deletePrompt } = useCustomPrompts();
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anirank', DEFAULT_PREFS);
  const [sharedOnly, setSharedOnly] = useState(prefs.sharedOnly);
  // An axis SPEC — a string for a built-in, the stored prompt object for a
  // custom one. The object is the whole point online: a guest has never seen the
  // host's prompt text, so the definition has to ride into the room with it.
  const savedAxis = resolveSavedAxis(prefs.axisId, prompts);
  const [axis, setAxis] = useState(savedAxis);
  const [scoring, setScoring] = useState(prefs.scoring);
  // Saved `blind` only counts if the axis came back too — see AniRankSetup.
  const [blind, setBlind] = useState(
    () => (axisIdOf(savedAxis) === prefs.axisId ? prefs.blind : getAxis(savedAxis).defaultBlind)
  );
  const [format, setFormat] = useState(prefs.format);

  // Picking a mode resets how it is dealt to that mode's default — see the same
  // handler in AniRankSetup.
  const handleAxisChange = (spec) => {
    setAxis(spec);
    setBlind(getAxis(spec).defaultBlind);
  };

  // Online offers TWO formats where local offers three. Building a list is solo
  // and takes an hour, so the room's version of the tier half is publish-and-
  // compare rather than a builder — which means the S–D-vs-1..N choice has
  // nothing to act on here. Flipping into this half therefore restores whichever
  // tier format is remembered rather than picking one, so using the lobby never
  // silently rewrites a choice only the local builder can express.
  const comparing = format !== 'round';
  const savedTierFormat = prefs.format !== 'round' ? prefs.format : 'tiers';

  const remembered = { sharedOnly, scoring, blind, format, axisId: axisIdOf(axis) };

  // The settings card reports every change as (key, value); the axis-coupled
  // state stays here, because an axis change resets `blind`.
  const changeSetting = (key, value) => {
    if (key === 'sharedOnly') setSharedOnly(value);
    else if (key === 'blind') setBlind(value);
    else if (key === 'scoring') setScoring(value);
  };

  const applyDefaults = () => {
    setSharedOnly(DEFAULT_PREFS.sharedOnly);
    setScoring(DEFAULT_PREFS.scoring);
    setFormat(DEFAULT_PREFS.format);
    handleAxisChange(DEFAULT_PREFS.axisId);
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

  const resolved = getAxis(axis);
  const noun = resolved.items === 'characters' ? 'characters' : 'shows';
  // Counted for every axis so the picker can show which modes this room can
  // actually play — a fact axis reads 0 until someone re-imports their list.
  // Custom prompts share two pool counts; see the same memo in AniRankSetup.
  const counts = useMemo(() => {
    const pools = opinionPoolCounts(active, { sharedOnly });
    return {
      ...Object.fromEntries(
        AXES.map((a) => [a.id, eligibleItems(active, { axis: a, sharedOnly }).length])
      ),
      ...Object.fromEntries(prompts.map((p) => [p.id, pools[p.items]])),
    };
  }, [active, sharedOnly, prompts]);

  const eligible = counts[resolved.id] ?? 0;
  const enough = eligible >= BOARD_SIZE;
  // Comparing has no deck to fill and no answer key, so the only requirement is
  // somebody to compare with. It does not gate on anyone having a list either:
  // publishing happens after Start, and a lobby that refused to open because
  // nobody had built one yet would be unopenable for a room where everyone
  // intends to build one.
  const canStart = comparing
    ? active.length >= 2
    : active.length >= 2 && everyoneHasShows && enough;

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark tone="amber" size="sm" level={2} className="mb-6">
          🌐 AniRank Lobby
        </Wordmark>

        <RoomCode code={room.roomCode} />

        <PlayerRoster
          room={room}
          players={players}
          active={active}
          statuses={statuses}
          tone="amber"
          badgeFor={(p) => <ListBadge count={showCount(p)} />}
        />

        <LobbyImport />

        {!room.isHost && <HostWaitCard hostName={room.hostName} needsList />}

        {room.isHost && (
          <>
            {/* Above the mode picker because it decides how much of the picker
                applies — the same order and the same reason as AniRankSetup. */}
            <Card title="🎲 Format" padding="lg" className="mb-6">
              <div className="flex flex-col gap-2">
                <FormatOption
                  active={!comparing}
                  onClick={() => setFormat('round')}
                  title="🎲 Round of ten"
                  hint="Ten random cards, everyone ranks the same board, scored against an answer key."
                />
                <FormatOption
                  active={comparing}
                  onClick={() => setFormat(savedTierFormat)}
                  title="📊 Compare tier lists"
                  hint="Everyone sends a list they already built, and the room sees where you agree."
                />
              </div>
            </Card>

            {/* None of the round options mean anything to a comparison: there is
                no deal to make blind, no answer key to score against, and each
                published list already carries the axis it was built with. An
                inert control is worse than an absent one — see AniRankSetup. */}
            {comparing ? (
              <Card padding="lg" className="mb-6">
                <p className="text-base text-fg-body">
                  Lists are built in local play and saved to each player&rsquo;s own device.
                  Start, and everyone picks one to send.
                </p>
                <p className="mt-3 text-sm text-fg-subtle">
                  You&apos;re the host — your settings apply to everyone.
                </p>
                <SettingsFooter
                  values={remembered}
                  defaults={DEFAULT_PREFS}
                  onReset={applyDefaults}
                />
              </Card>
            ) : (
              <>
            <AxisPicker
              value={axis}
              onChange={handleAxisChange}
              counts={active.length ? counts : undefined}
              prompts={prompts}
              onSavePrompt={savePrompt}
              onDeletePrompt={deletePrompt}
            />

            {/* Never `tiering` here: this card renders only for a round, so it
                always takes the round wording — a comparison has no board to
                share a pool for. */}
            <AniRankSettings
              values={{ sharedOnly, blind, scoring }}
              onChange={changeSetting}
              noun={noun}
              remembered={remembered}
              onReset={applyDefaults}
              hostNote
            />

            {active.length >= 2 && !everyoneHasShows && (
              <Banner tone="warning" className="mb-4">
                ⚠️ Every player needs an anime list before you can start.
              </Banner>
            )}
            {active.length >= 2 && everyoneHasShows && !enough && (
              <Banner tone="warning" className="mb-4">
                ⚠️ Need {BOARD_SIZE} {noun} to fill a board — found {eligible}.
                {resolved.kind === 'fact'
                  ? ' This mode needs AniList stats that older saved profiles don’t carry — everyone should refresh their list above.'
                  : sharedOnly ? ` Turn off “Shared ${noun} only”, or import matching titles.` : ''}
              </Banner>
            )}
              </>
            )}

            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={() => {
                savePrefs(remembered);
                const settings = { sharedOnly, axis, scoring, blind, format };
                if (comparing) room.startCompare(settings);
                else room.startGame(settings);
              }}
              disabled={!canStart}
            >
              {comparing ? '📊 Open the comparison' : '🎮 Start Game'}
            </Button>
          </>
        )}
      </Screen>
    </>
  );
}
