import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { usePackBackfill } from '../../../shared/hooks/usePackBackfill';
import ModePicker from './ModePicker';
import AniFakeSettings from './AniFakeSettings';
import { eligibleCharacters, fameReport } from '../utils/pool';
import { getFame } from '../fame';
import { DEFAULT_PREFS } from '../prefs';
import { minPool, MIN_PLAYERS } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Screen, Wordmark,
} from '../../../shared/ui';

// Local setup. Same shape as AniRankSetup — your main profile is already
// seated, the picker adds the rest of the couch, and nobody types a name.
export default function AniFakeSetup({ onStart, error, onBack }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  const [players, setPlayers] = useState(() => (activeProfile ? [activeProfile] : []));
  // A list imported before the stats existed is repaired from the fact pack,
  // and the seated copy follows it the way it follows an import.
  usePackBackfill((p) => setPlayers((prev) => prev.map((x) => (x.id === p.id ? p : x))));
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  // Seeded from whatever this device last started a game with, not from the
  // literal defaults — see shared/hooks/useGamePrefs.js.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anifake', DEFAULT_PREFS);
  // ONE OBJECT, and it is exactly what Start saves and hands on: every option
  // local play offers. AniFakeSettings renders all of them but the mode.
  const [settings, setSettings] = useState(() => ({
    mode: prefs.mode,
    laps: prefs.laps,
    sharedOnly: prefs.sharedOnly,
    talkMode: prefs.talkMode,
    fame: prefs.fame,
    allowRedeal: prefs.allowRedeal,
  }));
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  const { mode, sharedOnly, fame } = settings;

  const applyDefaults = () => {
    setSettings({ ...DEFAULT_PREFS });
    resetPrefs();
  };

  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  // The entries, not just the count: the fame warning below has to ask the same
  // array whether it carries any popularity data, and building the pool twice to
  // answer that would be a second walk over everyone's whole list.
  const poolEntries = useMemo(
    () => eligibleCharacters(players, { sharedOnly }),
    [players, sharedOnly]
  );
  const eligible = poolEntries.length;
  // How much the level is actually narrowing the draw. utils/pool.js's
  // fameReport is the one definition; the settings card reads it for its
  // warnings, this screen for the count under the card.
  const { famous } = fameReport(poolEntries, fame);
  // Nothing fills a grid anymore, so the bar is what the *mode* needs to deal:
  // one character for blind, two for decoy. That is the whole reason the old
  // sixteen-character minimum is gone — it was a board size, and under "shared
  // characters only" it locked out most tables.
  const needed = minPool(mode);
  const enough = eligible >= needed;
  const enoughPlayers = players.length >= MIN_PLAYERS;
  const canStart = enoughPlayers && enough;

  return (
    <>
      <Backdrop />
      <Screen width="md" onBack={onBack}>
        <Wordmark
          tone="teal"
          subtitle="Everyone knows the character. One of you is faking it."
          className="mb-10"
        >
          AniFake
        </Wordmark>

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          className="mb-5"
          onClick={() => setShowPicker(true)}
        >
          ➕ Add player
        </Button>

        {showPicker && (
          <ProfilePicker
            mode="add"
            excludeIds={players.map((p) => p.id)}
            onPick={(profile) => setPlayers((prev) => [...prev, profile])}
            onClose={() => setShowPicker(false)}
          />
        )}

        {players.length === 0 && (
          <p className="mb-6 text-center text-base text-fg-subtle">
            Nobody seated yet — set your main profile with the 👤 button at the hub,
            or add a player above. Profiles and anime lists are shared with every game.
          </p>
        )}

        {players.length > 0 && (
          <Card padding="sm" className="mb-6">
            {players.map((p) => {
              const shows = (p.animeList || []).length;
              return (
                <CardRow key={p.id}>
                  <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
                    {p.name}
                  </span>
                  {p.id === activeId && <Badge tone="purple">You</Badge>}
                  <Badge tone={shows ? 'lime' : 'amber'}>
                    {shows ? `${shows} shows` : '⚠️ No list'}
                  </Badge>
                  <Button
                    variant="neutral"
                    size="sm"
                    className="flex-shrink-0"
                    aria-label={`Import ${p.name}'s list`}
                    onClick={() => setImportTarget(p)}
                  >
                    🔗
                  </Button>
                  <button
                    onClick={() => setPlayers(players.filter((x) => x.id !== p.id))}
                    aria-label={`Remove ${p.name}`}
                    className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                      text-lg font-black text-pop-red hover:text-white disabled:opacity-30"
                  >
                    ✕
                  </button>
                </CardRow>
              );
            })}
          </Card>
        )}

        <ModePicker value={mode} onChange={(m) => change('mode', m)} />

        <AniFakeSettings
          values={settings}
          onChange={change}
          poolEntries={poolEntries}
          local
          onReset={applyDefaults}
        />

        {players.length > 0 && (
          <p className="mb-4 text-center text-base text-fg-helper">
            {eligible} character{eligible === 1 ? '' : 's'} to draw from
            {sharedOnly && players.length > 1 && ' (shared by everyone)'}
            {/* What the level leaves after narrowing. Worth showing even when
                the number is healthy: it is the only place the difference
                between the levels is a concrete number rather than a word. */}
            {famous > 0 && ` · “${getFame(fame).label}” narrows this to ${famous}`}
          </p>
        )}

        {players.length > 0 && players.length < MIN_PLAYERS && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Needs {MIN_PLAYERS} players — with fewer, spotting the odd one out is a
            coin toss.
          </Banner>
        )}

        {/* With a small shared list this is the ordinary outcome, not an edge
            case, so it gets a reason rather than a dead Start button. */}
        {players.length > 0 && !enough && (
          <Banner tone="warning" className="mb-4">
            ⚠️ {needed === 1
              ? 'Nobody has a character in common — found none.'
              : `Decoy mode needs ${needed} characters, so the fake can be handed a different
                 one — found ${eligible}.`}
            {sharedOnly && players.length > 1
              ? ' Turn off “Shared characters only”, or import more lists.'
              : ' Import a bigger list with the 🔗 button.'}
          </Banner>
        )}

        {importTarget && (
          <ListImport
            profile={importTarget}
            onClose={() => setImportTarget(null)}
            onImported={handleImported}
          />
        )}

        {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={() => {
            savePrefs(settings);
            onStart({ players, ...settings });
          }}
          disabled={!canStart}
        >
          🎮 Start Game
        </Button>
      </Screen>
    </>
  );
}
