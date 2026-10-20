import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import { LocalRoster } from '../../../shared/components/PlayerSlots';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SetupLayout, { StartBar } from '../../../shared/components/SetupLayout';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { Banner, Button } from '../../../shared/ui';
import ClueModePicker from './ClueModePicker';
import WavelengthSettings from './WavelengthSettings';
import { poolTooSmall } from '../help';
import { DEFAULT_PREFS } from '../prefs';
import { MIN_PLAYERS, needsCardPool } from '../rules';
import { MIN_CARD_POOL, eligibleCards, poolNoun } from '../utils/cards';
import descriptor from '../index';

// Local setup.
//
// Still the shortest setup screen in the arcade WHEN THE MODE IS 'text' — no
// pool to count, no shared-only toggle, and no reason to nag anyone about
// importing. That is not laziness: a player arriving from AniGuess assumes an
// anime list is required and will go and import one before starting if nothing
// tells them otherwise, so the absence is the thing worth saying out loud.
//
// The two card modes need a pool, and everything about them is gated behind
// that one choice — the toggles, the counts, the list badges and the import
// button all appear only once a mode that deals cards is selected, so the
// default path is unchanged.
export default function WavelengthSetup({ onStart, onBack }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniwave', DEFAULT_PREFS);

  const [players, setPlayers] = useState(() => (activeProfile ? [activeProfile] : []));
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  // Only the keys this screen owns — the timer is online-only. writePrefs merges
  // a partial, so saving this set leaves those untouched; see prefs.js.
  const [settings, setSettings] = useState(() => ({
    rounds: prefs.rounds,
    clueMode: prefs.clueMode,
    cardPool: prefs.cardPool,
    sharedOnly: prefs.sharedOnly,
  }));
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  const { rounds, clueMode, cardPool, sharedOnly } = settings;

  const needsCards = needsCardPool(clueMode);

  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  // Skipped entirely in the default mode: with no cards to deal there is nothing
  // to count, and walking every player's whole list to reach zero is work done
  // to display nothing.
  const eligible = useMemo(
    () => (needsCards ? eligibleCards(players, { pool: cardPool, sharedOnly }).length : 0),
    [needsCards, players, cardPool, sharedOnly],
  );

  const noun = poolNoun(cardPool);
  const enoughPlayers = players.length >= MIN_PLAYERS;
  const enoughCards = !needsCards || eligible >= MIN_CARD_POOL;
  const canStart = enoughPlayers && enoughCards;

  // resetPrefs drops the whole slice regardless, which is what "reset to
  // defaults" has to mean — the online-only timer options have no other way back.
  const applyDefaults = () => {
    resetPrefs();
    setSettings({
      rounds: DEFAULT_PREFS.rounds,
      clueMode: DEFAULT_PREFS.clueMode,
      cardPool: DEFAULT_PREFS.cardPool,
      sharedOnly: DEFAULT_PREFS.sharedOnly,
    });
  };

  const start = () => {
    savePrefs(settings);
    onStart({ players, rounds, mode: clueMode, cardPool, sharedOnly });
  };

  const status = !enoughPlayers ? `Needs ${MIN_PLAYERS} players.`
    : !enoughCards ? `Not enough ${noun} to deal — found ${eligible}.`
      : needsCards ? `${players.length} players · ${eligible} ${noun} to draw from`
        : `${players.length} players · no list needed`;

  return (
    <>
      <SetupLayout
        game={descriptor}
        tagline="One of you knows where the target is. Say the right words."
        onBack={onBack}
        left={(
          <>
            {!needsCards && (
              <Banner tone="info" className="mb-6">
                No anime list needed — a typed clue is played on the spectrums alone,
                so everyone can join straight away.
              </Banner>
            )}

            {/* The list badge and import only in the modes that deal: on a
                typed-clue round they are a warning about nothing, and undo the
                banner above. */}
            <LocalRoster
              players={players}
              activeId={activeId}
              onAdd={() => setShowPicker(true)}
              onImport={needsCards ? setImportTarget : undefined}
              badgeFor={needsCards ? undefined : null}
              onRemove={(id) => setPlayers((prev) => prev.filter((x) => x.id !== id))}
            />

            {players.length > 0 && !enoughPlayers && (
              <Banner tone="warning" className="mb-6">
                Needs {MIN_PLAYERS} players — with one guesser there is no spread for
                the psychic to be read against.
              </Banner>
            )}

            {/* A reason rather than a dead Start button: with a short shared list
                this is the ordinary outcome, not an edge case, and the remedy
                depends on which cause it is. */}
            {needsCards && enoughPlayers && !enoughCards && (
              <Banner tone="warning" className="mb-6">
                {poolTooSmall({ eligible, noun, sharedOnly, players: players.length })}
              </Banner>
            )}
          </>
        )}
        right={(
          <>
            <ClueModePicker value={clueMode} onChange={(m) => change('clueMode', m)} />
            <WavelengthSettings
              values={settings}
              onChange={change}
              eligible={eligible}
              playerCount={players.length}
              onReset={applyDefaults}
            />
          </>
        )}
        start={(
          <StartBar status={status} ready={canStart}>
            <Button variant="primary" size="lg" disabled={!canStart} onClick={start}>
              Start
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
