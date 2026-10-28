import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import { LocalRoster } from '../../../shared/components/PlayerSlots';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useAutoSeat } from '../../../shared/hooks/useAutoSeat';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { usePackBackfill } from '../../../shared/hooks/usePackBackfill';
import ModePicker from './ModePicker';
import AniFakeSettings from './AniFakeSettings';
import { eligibleCharacters, fameReport } from '../utils/pool';
import { getFame } from '../fame';
import { DEFAULT_PREFS } from '../prefs';
import { minPool, MIN_PLAYERS } from '../rules';
import descriptor from '../index';
import { Banner, Button } from '../../../shared/ui';

// Local setup. Same shape as AniRankSetup, except that the couch is seated
// already — last game's table, else the three it takes to start (see
// shared/utils/autoSeat.js). The picker adds anyone else, and nobody types a name.
export default function AniFakeSetup({ onStart, error, onBack }) {
  const { activeId, saveProfile } = useProfileStore();
  const { seat, remember } = useAutoSeat('anifake', MIN_PLAYERS);
  const [players, setPlayers] = useState(seat);
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
    rounds: prefs.rounds,
    clueSeconds: prefs.clueSeconds,
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

  // The entries, not just the count: the fame warning has to ask the same
  // array whether it carries any popularity data, and building the pool twice to
  // answer that would be a second walk over everyone's whole list.
  const poolEntries = useMemo(
    () => eligibleCharacters(players, { sharedOnly }),
    [players, sharedOnly]
  );
  const eligible = poolEntries.length;
  // How much the level is actually narrowing the draw. utils/pool.js's
  // fameReport is the one definition; the settings card reads it for its
  // warnings, this screen for the Start bar's count.
  const { famous } = fameReport(poolEntries, fame);
  // Nothing fills a grid anymore, so the bar is what the *mode* needs to deal:
  // one character for blind, two for decoy. That is the whole reason the old
  // sixteen-character minimum is gone — it was a board size, and under "shared
  // characters only" it locked out most tables.
  const needed = minPool(mode);
  const enough = eligible >= needed;
  const enoughPlayers = players.length >= MIN_PLAYERS;
  const canStart = enoughPlayers && enough;

  // What the level leaves after narrowing is worth showing even when the number
  // is healthy: it is the only place the difference between the levels is a
  // concrete number rather than a word.
  const status = !enoughPlayers ? `Needs ${MIN_PLAYERS} players.`
    : !enough ? `Not enough characters to deal — found ${eligible}.`
      : `${players.length} players · ${eligible} character${eligible === 1 ? '' : 's'} to draw from${
        famous > 0 ? ` · “${getFame(fame).label}” narrows it to ${famous}` : ''}`;

  return (
    <>
      <SetupLayout
        game={descriptor}
        tagline="Everyone knows the character. One of you is faking it."
        onBack={onBack}
        left={(
          <>
            <LocalRoster
              players={players}
              activeId={activeId}
              onAdd={() => setShowPicker(true)}
              onImport={setImportTarget}
              onRemove={(id) => setPlayers((prev) => prev.filter((x) => x.id !== id))}
              onUpdate={(p) => setPlayers((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
            />

            {players.length > 0 && players.length < MIN_PLAYERS && (
              <Banner tone="warning" className="mb-4">
                Needs {MIN_PLAYERS} players — with fewer, spotting the odd one out is a
                coin toss.
              </Banner>
            )}

            {/* With a small shared list this is the ordinary outcome, not an edge
                case, so it gets a reason rather than a dead Start button. */}
            {players.length > 0 && !enough && (
              <Banner tone="warning" className="mb-4">
                {needed === 1
                  ? 'Nobody has a character in common — found none.'
                  : `Decoy mode needs ${needed} characters, so the fake can be handed a different
                     one — found ${eligible}.`}
                {sharedOnly && players.length > 1
                  ? ' Turn off “Shared characters only”, or import more lists.'
                  : ' Import a bigger list with the link button on a player.'}
              </Banner>
            )}

            {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
          </>
        )}
        right={(
          <>
            <ModePicker value={mode} onChange={(m) => change('mode', m)} />
            <AniFakeSettings
              values={settings}
              onChange={change}
              poolEntries={poolEntries}
              local
              onReset={applyDefaults}
            />
          </>
        )}
        start={(
          <StartBar status={status} ready={canStart}>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                savePrefs(settings);
                remember(players);
                onStart({ players, ...settings });
              }}
              disabled={!canStart}
            >
              Start Game
            </Button>
          </StartBar>
        )}
      />

      {showPicker && (
        <ProfilePicker
          mode="add"
          excludeIds={players.map((p) => p.id)}
          onPick={(profile) => setPlayers((prev) => [...prev, profile])}
          onClose={() => setShowPicker(false)}
        />
      )}
      {importTarget && (
        <ListImport profile={importTarget} onClose={() => setImportTarget(null)} onImported={handleImported} />
      )}
    </>
  );
}
