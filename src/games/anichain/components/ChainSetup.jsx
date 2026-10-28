import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import { LocalRoster } from '../../../shared/components/PlayerSlots';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import TeamsCard from '../../../shared/components/teams/TeamsCard';
import { useAutoSeat } from '../../../shared/hooks/useAutoSeat';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { splitTeams } from '../../../shared/utils/teams';
import { Banner, Button } from '../../../shared/ui';
import AniChainSettings from './AniChainSettings';
import { chainPool } from '../deal';
import { DEFAULT_PREFS, cleanPrefs } from '../prefs';
import { MIN_PLAYERS, MIN_TEAM, isTeamShape } from '../rules';
import { TAGLINE, setupStatus } from '../copy';
import descriptor from '../index';

// Local setup: the couch, seated before anyone taps (useAutoSeat), one
// settings card, and — for the two team shapes — the shared teams card under
// the roster. A player nobody has moved joins the smaller team, so a table
// that ignores the card still starts even.
export default function ChainSetup({ pack, onStart, onBack, error }) {
  const { activeId, saveProfile } = useProfileStore();
  const { seat, remember } = useAutoSeat(descriptor.id, MIN_PLAYERS.pair);
  const [players, setPlayers] = useState(seat);
  const [chosenTeam, setChosenTeam] = useState({});
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const { prefs, savePrefs, resetPrefs } = useGamePrefs(descriptor.id, DEFAULT_PREFS);
  const [settings, setSettings] = useState(() => cleanPrefs(prefs));

  const ids = players.map((p) => p.id);
  const teamShape = isTeamShape(settings.shape);
  const teams = splitTeams(ids, chosenTeam);
  const poolSize = useMemo(() => chainPool(players, settings.pool).length, [players, settings.pool]);
  const { status, ready } = setupStatus({ count: players.length, teams, settings, poolSize, packStatus: pack.status });

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
            {teamShape && players.length > 0 && (
              <TeamsCard
                teams={teams}
                players={players}
                onMove={(id, team) => setChosenTeam((c) => ({ ...c, [id]: team }))}
                note={`Each team needs ${MIN_TEAM[settings.shape]} players.`}
              />
            )}
            {players.length >= MIN_PLAYERS[settings.shape] && poolSize < 3 && (
              <Banner tone="warning" className="mb-4">
                These lists hold too few characters for a game. Import a bigger list with the link button on a player
                {settings.pool === 'main' ? ', or let anyone on the lists come up (More settings).' : '.'}
              </Banner>
            )}
            {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
          </>
        )}
        right={(
          <AniChainSettings
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
                onStart({ players, settings, teams: teamShape ? teams : null });
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
