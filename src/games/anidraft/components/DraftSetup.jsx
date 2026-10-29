import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import { LocalRoster } from '../../../shared/components/PlayerSlots';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useAutoSeat } from '../../../shared/hooks/useAutoSeat';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { Banner, Button } from '../../../shared/ui';
import AniDraftSettings from './AniDraftSettings';
import { draftPool } from '../deal';
import { DEFAULT_PREFS, cleanPrefs } from '../prefs';
import { MIN_PLAYERS } from '../rules';
import { TAGLINE, cardsNeeded, setupStatus } from '../copy';
import descriptor from '../index';

// Local setup: the couch, seated before anyone taps (useAutoSeat), and one
// settings card. Every player is a team, so there is nothing else to arrange.
export default function DraftSetup({ onStart, onBack }) {
  const { activeId, saveProfile } = useProfileStore();
  const { seat, remember } = useAutoSeat(descriptor.id, MIN_PLAYERS);
  const [players, setPlayers] = useState(seat);
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const { prefs, savePrefs, resetPrefs } = useGamePrefs(descriptor.id, DEFAULT_PREFS);
  const [settings, setSettings] = useState(() => cleanPrefs(prefs));

  const ids = players.map((p) => p.id);
  const poolSize = useMemo(() => draftPool(players, settings.pool).length, [players, settings.pool]);
  const { status, ready } = setupStatus({ count: players.length, settings, poolSize });
  const short = players.length >= MIN_PLAYERS && poolSize < cardsNeeded(players.length, settings.rounds);

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
                These lists hold too few characters for this many rounds. Import a bigger list with the link button on
                a player, play fewer rounds{settings.pool === 'main' ? ', or let anyone on the lists come up (More settings)' : ''}.
              </Banner>
            )}
          </>
        )}
        right={(
          <AniDraftSettings
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
                // writePrefs merges, so the online-only clock survives a local save.
                savePrefs({ rounds: settings.rounds, pool: settings.pool });
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
          excludeIds={ids}
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
