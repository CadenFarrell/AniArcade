import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import { LocalRoster } from '../../../shared/components/PlayerSlots';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { usePackBackfill } from '../../../shared/hooks/usePackBackfill';
import AniTuneSettings from './AniTuneSettings';
import { eligibleCount } from '../utils/questionPool';
import { DEFAULT_PREFS } from '../prefs';
import descriptor from '../index';
import { Banner, Button } from '../../../shared/ui';

export default function AniTuneSetup({ onStart, preparing, progress, error, onBack }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  // Your main profile is already seated; the picker adds the rest of the couch.
  const [players, setPlayers] = useState(() => activeProfile ? [activeProfile] : []);
  // A list imported before the stats existed is repaired from the fact pack,
  // and the seated copy follows it the way it follows an import.
  usePackBackfill((p) => setPlayers((prev) => prev.map((x) => (x.id === p.id ? p : x))));
  const [showPicker, setShowPicker] = useState(false);
  // Which player's list we're importing into. Until now this screen had no
  // import path at all — it told you to go and do it in AniGuess, which is a
  // dead end for anyone who only wants to play AniTune.
  const [importTarget, setImportTarget] = useState(null);
  // Seeded from whatever this device last started a game with, not from the
  // literal defaults — see shared/hooks/useGamePrefs.js.
  //
  // One object rather than a useState per key. At six settings the split was
  // fine; at seventeen it is a list nobody keeps in sync with the lobby's copy,
  // which is exactly the drift AniTuneSettings was extracted to stop.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anitune', DEFAULT_PREFS);
  const [settings, setSettings] = useState(prefs);

  const applyDefaults = () => {
    setSettings(DEFAULT_PREFS);
    resetPrefs();
  };

  // Persist to the shared profile store *and* to this screen's roster, so the
  // "N shows in play" line and the Start gate update without a remount.
  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  const eligible = eligibleCount(players, settings);
  const everyoneHasShows = players.every((p) => (p.animeList || []).length > 0);
  const noKinds = !settings.includeOpenings && !settings.includeEndings;
  const canStart =
    players.length >= 1 && everyoneHasShows && eligible > 0 && !noKinds && !preparing;

  // The Start bar's one line: what is ready, or the first thing that is not.
  const status = preparing && progress
    ? `${progress.phase === 'resolving' ? 'Matching your shows…' : 'Loading themes…'} ${progress.done}/${progress.total}`
    : players.length === 0 ? 'Seat at least one player.'
      : !everyoneHasShows ? 'Everyone needs an anime list.'
        : noKinds ? 'Pick openings, endings, or both.'
          : eligible === 0 ? 'No shows in play.'
            : `${players.length} player${players.length === 1 ? '' : 's'} · ${eligible} show${eligible === 1 ? '' : 's'} in play${
              settings.sharedSongsOnly && players.length > 1 ? ' (shared)' : ''}`;

  const left = (
    <>
      {/* A picker, not a name box: a saved profile, not a retyped name, so
          nobody gets seated as a fresh empty duplicate. */}
      <LocalRoster
        players={players}
        activeId={activeId}
        disabled={preparing}
        onAdd={() => setShowPicker(true)}
        onImport={setImportTarget}
        onRemove={(id) => setPlayers((prev) => prev.filter((x) => x.id !== id))}
      />

      {players.length > 1 && settings.sharedSongsOnly && eligible === 0 && (
        <Banner tone="warning" className="mb-4">
          No shows in common — turn off &ldquo;Shared songs only&rdquo; or import more lists.
        </Banner>
      )}
      {!everyoneHasShows && players.length > 0 && (
        <Banner tone="warning" className="mb-4">
          Everyone needs an anime list — tap the link button on a player to import theirs.
        </Banner>
      )}
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
      {preparing && progress && (
        <div className="mb-4">
          <div
            className="h-4 w-full overflow-hidden rounded-pop-sm border-2 border-ink bg-surface-2"
            role="progressbar"
            aria-valuenow={progress.done}
            aria-valuemin={0}
            aria-valuemax={progress.total}
          >
            <div
              className="h-full bg-pop-blue transition-[width]"
              style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-fg-subtle">First time takes a moment; after that it&apos;s cached.</p>
        </div>
      )}
    </>
  );

  return (
    <>
      <SetupLayout
        game={descriptor}
        tagline="Name the anime from its opening or ending"
        onBack={onBack}
        left={left}
        right={(
          <>
            <AniTuneSettings
              players={players}
              values={settings}
              disabled={preparing}
              onChange={(key, value) => setSettings((s) => ({ ...s, [key]: value }))}
            />
            <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
          </>
        )}
        start={(
          <StartBar status={status} ready={canStart}>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                savePrefs(settings);
                onStart({ players, ...settings });
              }}
              disabled={!canStart}
            >
              {preparing ? 'Preparing…' : 'Start Game'}
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
