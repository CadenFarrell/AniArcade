import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import { LocalRoster } from '../../../shared/components/PlayerSlots';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useAutoSeat } from '../../../shared/hooks/useAutoSeat';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { Banner, Button } from '../../../shared/ui';
import AniOutSettings from './AniOutSettings';
import ShortBanner from './ShortBanner';
import { dealGame } from '../deal';
import { DEFAULT_PREFS } from '../prefs';
import { MIN_PLAYERS } from '../rules';
import { TAGLINE, setupStatus } from '../copy';
import descriptor from '../index';

// Local setup: the couch, seated before anyone taps (useAutoSeat), and one
// settings card. Whether the lists hold a game is only answered by dealing one,
// so the screen keeps a trial deal of the table as it stands (copy.js) — the
// real deal at Start is a fresh one.
export default function OutSetup({ pack, onStart, onBack, error }) {
  const { activeId, saveProfile } = useProfileStore();
  const { seat, remember } = useAutoSeat(descriptor.id, MIN_PLAYERS);
  const [players, setPlayers] = useState(seat);
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const { prefs, savePrefs, resetPrefs } = useGamePrefs(descriptor.id, DEFAULT_PREFS);
  const [settings, setSettings] = useState(prefs);

  const trial = useMemo(
    () => (players.length && pack.status !== 'loading' ? dealGame(players, settings, pack.pack) : null),
    [players, settings, pack.status, pack.pack],
  );
  const { status, ready, short } = setupStatus({ count: players.length, trial, settings, packStatus: pack.status });

  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  return (
    <>
      <SetupLayout
        game={descriptor}
        tagline={TAGLINE}
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
            {short && <ShortBanner settings={settings} found={trial.found} />}
            {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
          </>
        )}
        right={(
          <AniOutSettings
            values={settings}
            onChange={(key, value) => setSettings((s) => ({ ...s, [key]: value }))}
            onReset={() => { setSettings({ ...DEFAULT_PREFS }); resetPrefs(); }}
          />
        )}
        start={(
          <StartBar status={status} ready={ready}>
            <Button
              variant="primary"
              size="lg"
              disabled={!ready}
              onClick={() => {
                savePrefs(settings);
                remember(players);
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
