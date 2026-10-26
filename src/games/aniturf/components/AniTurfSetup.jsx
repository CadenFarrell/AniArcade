import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import { LocalRoster } from '../../../shared/components/PlayerSlots';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useAutoSeat } from '../../../shared/hooks/useAutoSeat';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { Banner, Button } from '../../../shared/ui';
import AniTurfSettings from './AniTurfSettings';
import TeamsCard from './TeamsCard';
import { boardPool } from '../utils/board';
import { DEFAULT_PREFS } from '../prefs';
import { CELLS, MIN_PLAYERS, resolveGivers, splitTeams, teamsReady } from '../rules';
import descriptor from '../index';
import { TAGLINE } from './copy';

// Local setup: the couch, split into two teams. Seated the way every local
// setup is (your main profile first, the picker adds the rest); the teams card
// beneath the roster is AniTurf's own. A player nobody has moved joins the
// smaller team, so a table that ignores the card still starts even.
//
// `initial` is what Play again's "Change teams" hands back, so the teams and
// crowns a table already arranged survive a trip back to this screen.
export default function AniTurfSetup({ onStart, onBack, error, initial = null }) {
  const { activeId, saveProfile } = useProfileStore();
  // A fresh setup seats the couch already — last game's table, else the four it
  // takes to start (shared/utils/autoSeat.js); splitTeams evens them out.
  const { seat, remember } = useAutoSeat('aniturf', MIN_PLAYERS);
  const [players, setPlayers] = useState(() => initial?.players ?? seat());
  const [chosenTeam, setChosenTeam] = useState(() => initial?.chosenTeam ?? {});
  const [chosenGiver, setChosenGiver] = useState(() => initial?.clueGivers ?? {});
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniturf', DEFAULT_PREFS);
  const [settings, setSettings] = useState(() => ({ sharedOnly: prefs.sharedOnly, traps: prefs.traps }));
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const ids = players.map((p) => p.id);
  const teams = splitTeams(ids, chosenTeam);
  const givers = resolveGivers(teams, chosenGiver);
  const ready = teamsReady(teams);

  const available = useMemo(
    () => boardPool(players, { sharedOnly: settings.sharedOnly }).length,
    [players, settings.sharedOnly],
  );
  const enoughChars = available >= CELLS;
  const enoughPlayers = players.length >= MIN_PLAYERS;
  const canStart = enoughPlayers && ready.ok && enoughChars;

  const status = !enoughPlayers ? `Needs ${MIN_PLAYERS} players — two teams of two.`
    : !ready.ok ? ready.reason
      : !enoughChars ? `Not enough characters for the board — found ${available} of ${CELLS}.`
        : `Red ${teams.red.length} v Blue ${teams.blue.length} · ${available} characters to draw from`;

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
            {players.length > 0 && (
              <TeamsCard
                teams={teams}
                givers={givers}
                players={players}
                onMove={(id, team) => setChosenTeam((c) => ({ ...c, [id]: team }))}
                onCrown={(team, id) => setChosenGiver((g) => ({ ...g, [team]: id }))}
              />
            )}
            {enoughPlayers && !ready.ok && (
              <Banner tone="warning" className="mb-4">{ready.reason} Each team needs a clue-giver and a guesser.</Banner>
            )}
            {players.length > 0 && !enoughChars && (
              <Banner tone="warning" className="mb-4">
                The board needs {CELLS} characters and these lists hold {available}.
                {settings.sharedOnly ? ' Turn off “Shared characters only”, or import more lists.' : ' Import a bigger list with the link button on a player.'}
              </Banner>
            )}
            {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
          </>
        )}
        right={(
          <AniTurfSettings
            values={settings}
            onChange={change}
            onReset={() => { setSettings({ ...DEFAULT_PREFS }); resetPrefs(); }}
          />
        )}
        start={(
          <StartBar status={status} ready={canStart}>
            <Button
              variant="primary"
              size="lg"
              disabled={!canStart}
              onClick={() => {
                savePrefs(settings);
                remember(players);
                onStart({ players, teams, clueGivers: givers, chosenTeam, ...settings });
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
