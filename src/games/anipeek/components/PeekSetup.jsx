import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import { LocalRoster } from '../../../shared/components/PlayerSlots';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useAutoSeat } from '../../../shared/hooks/useAutoSeat';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { Banner, Button } from '../../../shared/ui';
import AniPeekSettings from './AniPeekSettings';
import { portraitPool } from '../utils/pool';
import { DEFAULT_PREFS } from '../prefs';
import { MIN_PLAYERS } from '../rules';
import { TAGLINE, setupStatus } from '../copy';
import descriptor from '../index';

// Local setup: the couch, seated before anyone taps (useAutoSeat), and one
// settings card. The pool is portraits from the seated players' lists, so the
// status line counts those — the one number that decides whether a game fits.
//
// The fact pack only fills in hint cards a list does not carry, so it never
// blocks a start once it has failed; it holds Start only while it is still on
// its way and hints are on, so a fast tap does not deal a game of blank cards.
export default function PeekSetup({ pack, onStart, onBack, error }) {
  const { activeId, saveProfile } = useProfileStore();
  const { seat, remember } = useAutoSeat(descriptor.id, MIN_PLAYERS);
  const [players, setPlayers] = useState(seat);
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const { prefs, savePrefs, resetPrefs } = useGamePrefs(descriptor.id, DEFAULT_PREFS);
  const [settings, setSettings] = useState(prefs);

  const available = useMemo(
    () => portraitPool(players, { sharedOnly: settings.sharedOnly }).length,
    [players, settings.sharedOnly],
  );
  const { status, ready, short } = setupStatus({ count: players.length, available, settings, packStatus: pack.status });

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
            {players.length > 0 && short && (
              <Banner tone="warning" className="mb-4">
                {settings.rounds} rounds need {settings.rounds} characters with portraits, and these lists hold {available}.
                {settings.sharedOnly
                  ? ' Turn off “Shared characters only”, play fewer rounds, or import more lists.'
                  : ' Play fewer rounds, or import a list with the link button on a player.'}
              </Banner>
            )}
            {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
          </>
        )}
        right={(
          <AniPeekSettings
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
