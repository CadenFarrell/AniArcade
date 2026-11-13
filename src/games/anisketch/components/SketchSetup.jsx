import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import { LocalRoster } from '../../../shared/components/PlayerSlots';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useAutoSeat } from '../../../shared/hooks/useAutoSeat';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { Banner, Button } from '../../../shared/ui';
import AniSketchSettings from './AniSketchSettings';
import { sketchPool } from '../deal';
import { DEFAULT_PREFS, cleanPrefs } from '../prefs';
import { MIN_PLAYERS } from '../rules';
import { TAGLINE, setupStatus } from '../copy';
import descriptor from '../index';

// Local setup: the couch, seated before anyone taps (useAutoSeat), and one
// settings card.
export default function SketchSetup({ onStart, onBack }) {
  const { activeId, saveProfile } = useProfileStore();
  const { seat, remember } = useAutoSeat(descriptor.id, MIN_PLAYERS);
  const [players, setPlayers] = useState(seat);
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const { prefs, savePrefs, resetPrefs } = useGamePrefs(descriptor.id, DEFAULT_PREFS);
  const [settings, setSettings] = useState(() => cleanPrefs(prefs));

  const poolSize = useMemo(() => sketchPool(players).length, [players]);
  const { status, ready, short } = setupStatus({ count: players.length, settings, poolSize });

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
            {short && (
              <Banner tone="warning" className="mb-4">
                Every drawing is a different character with a portrait, and these lists are short of them. Play fewer
                times round the table, offer fewer to choose from, or import a bigger list with the link button on a player.
              </Banner>
            )}
          </>
        )}
        right={(
          <AniSketchSettings
            values={settings}
            playerCount={players.length}
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
