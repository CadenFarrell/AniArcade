import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import QuizSettings from './QuizSettings';
import { usePoolReport } from '../hooks/usePoolReport';
import { needsLists } from '../utils/pool';
import { DEFAULT_PREFS } from '../prefs';
import { LocalRoster } from '../../../shared/components/PlayerSlots';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import descriptor from '../index';
import { Banner, Button } from '../../../shared/ui';

// Local setup. AniTuneSetup's shape: your main profile is already seated, the
// picker adds the rest of the couch, and the link button imports into a seated player.
// A single player is a real game here — a quiz is a quiz on your own.
export default function QuizSetup({ pack, onStart, error, onBack }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  const [players, setPlayers] = useState(() => (activeProfile ? [activeProfile] : []));
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniquiz', DEFAULT_PREFS);
  const [settings, setSettings] = useState(prefs);

  const report = usePoolReport(pack.pack, players, settings);
  const canStart = players.length >= 1 && pack.status === 'ready' && Boolean(report?.playable);

  const applyDefaults = () => {
    setSettings(DEFAULT_PREFS);
    resetPrefs();
  };

  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  const status = players.length === 0 ? 'Seat at least one player.'
    : pack.status === 'loading' ? 'Loading the fact pack…'
      : pack.status !== 'ready' ? 'Couldn’t load the fact pack.'
        : !report?.playable ? 'Not enough clues to fill a game.'
          : `${players.length} player${players.length === 1 ? '' : 's'} · ${report.shows} shows · ${report.characters} characters`;

  return (
    <>
      <SetupLayout
        game={descriptor}
        tagline="Anime trivia, straight from the credits"
        onBack={onBack}
        left={(
          <>
            {/* The list badge only when the pool reads lists at all; a quiz on
                the whole fact pack needs none. A single player is a real game
                here — a quiz is a quiz on your own. */}
            <LocalRoster
              players={players}
              activeId={activeId}
              badgeFor={needsLists(settings.pool) ? undefined : null}
              onAdd={() => setShowPicker(true)}
              onImport={setImportTarget}
              onRemove={(id) => setPlayers((prev) => prev.filter((x) => x.id !== id))}
              onUpdate={(p) => setPlayers((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
            />
            {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
          </>
        )}
        right={(
          <>
            <QuizSettings
              values={settings}
              local
              onChange={(key, value) => setSettings((s) => ({ ...s, [key]: value }))}
              report={report}
              packStatus={pack.status}
              onRetryPack={pack.retry}
              players={players}
            />
            <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
          </>
        )}
        start={(
          <StartBar status={status} ready={canStart}>
            <Button
              variant="primary"
              size="lg"
              disabled={!canStart}
              onClick={() => {
                savePrefs(settings);
                onStart({ players, settings });
              }}
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
