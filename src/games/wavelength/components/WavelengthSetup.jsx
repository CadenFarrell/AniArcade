import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ListImport from '../../../shared/components/ListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Screen, Wordmark,
} from '../../../shared/ui';
import ClueModePicker from './ClueModePicker';
import WavelengthSettings from './WavelengthSettings';
import { poolTooSmall } from '../help';
import { DEFAULT_PREFS } from '../prefs';
import { MIN_PLAYERS, needsCardPool } from '../rules';
import { MIN_CARD_POOL, eligibleCards, poolNoun } from '../utils/cards';

// Local setup.
//
// Still the shortest setup screen in the arcade WHEN THE MODE IS 'text' — no
// pool to count, no shared-only toggle, and no reason to nag anyone about
// importing. That is not laziness: a player arriving from AniGuess assumes an
// anime list is required and will go and import one before starting if nothing
// tells them otherwise, so the absence is the thing worth saying out loud.
//
// The two card modes need a pool, and everything about them is gated behind
// that one choice — the toggles, the counts and the warnings all appear only
// once a mode that deals cards is selected, so the default path is unchanged.
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

  return (
    <>
      <Backdrop />
      <Screen onBack={onBack}>
        <Wordmark tone="purple" size="md" className="mb-8">AniWave</Wordmark>

        {!needsCards && (
          <Banner tone="info" className="mb-6">
            No anime list needed — a typed clue is played on the spectrums alone,
            so everyone can join straight away.
          </Banner>
        )}

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          className="mb-5"
          onClick={() => setShowPicker(true)}
        >
          ➕ Add player
        </Button>

        {showPicker && (
          <ProfilePicker
            mode="add"
            excludeIds={players.map((p) => p.id)}
            onPick={(profile) => setPlayers((prev) => [...prev, profile])}
            onClose={() => setShowPicker(false)}
          />
        )}

        {players.length === 0 && (
          <p className="mb-6 text-center text-base text-fg-subtle">
            Nobody seated yet — set your main profile with the 👤 button at the hub,
            or add a player above.
          </p>
        )}

        {players.length > 0 && (
          <Card padding="sm" className="mb-6">
            {players.map((p) => {
              const shows = (p.animeList || []).length;
              return (
                <CardRow key={p.id}>
                  <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
                    {p.name}
                  </span>
                  {p.id === activeId && <Badge tone="purple">You</Badge>}
                  {/* Only in the modes that deal: a list badge on a typed-clue
                      round is a warning about nothing, and undoes the banner
                      above it. */}
                  {needsCards && (
                    <>
                      <Badge tone={shows ? 'lime' : 'amber'}>
                        {shows ? `${shows} shows` : '⚠️ No list'}
                      </Badge>
                      <Button
                        variant="neutral"
                        size="sm"
                        className="flex-shrink-0"
                        aria-label={`Import ${p.name}'s list`}
                        onClick={() => setImportTarget(p)}
                      >
                        🔗
                      </Button>
                    </>
                  )}
                  <button
                    onClick={() => setPlayers(players.filter((x) => x.id !== p.id))}
                    aria-label={`Remove ${p.name}`}
                    className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                      text-lg font-black text-pop-red hover:text-white"
                  >
                    ✕
                  </button>
                </CardRow>
              );
            })}
          </Card>
        )}

        <ClueModePicker value={clueMode} onChange={(m) => change('clueMode', m)} />

        <WavelengthSettings
          values={settings}
          onChange={change}
          eligible={eligible}
          playerCount={players.length}
          onReset={applyDefaults}
        />

        {players.length > 0 && !enoughPlayers && (
          <Banner tone="warning" className="mb-6">
            ⚠️ Needs {MIN_PLAYERS} players — with one guesser there is no spread for
            the psychic to be read against.
          </Banner>
        )}

        {/* A reason rather than a dead Start button: with a short shared list
            this is the ordinary outcome, not an edge case, and the remedy
            depends on which cause it is. */}
        {needsCards && enoughPlayers && !enoughCards && (
          <Banner tone="warning" className="mb-6">
            ⚠️ {poolTooSmall({ eligible, noun, sharedOnly, players: players.length })}
          </Banner>
        )}

        {importTarget && (
          <ListImport
            profile={importTarget}
            onClose={() => setImportTarget(null)}
            onImported={handleImported}
          />
        )}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={!canStart}
          onClick={start}
        >
          Start
        </Button>
      </Screen>
    </>
  );
}
