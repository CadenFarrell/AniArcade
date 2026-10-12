import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import QuizSettings from './QuizSettings';
import { usePoolReport } from '../hooks/usePoolReport';
import { needsLists } from '../utils/pool';
import { DEFAULT_PREFS } from '../prefs';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Screen, Wordmark,
} from '../../../shared/ui';

// Local setup. AniTuneSetup's shape: your main profile is already seated, the
// picker adds the rest of the couch, and 🔗 imports into a seated player.
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

  return (
    <>
      <Backdrop />
      <Screen width="md" onBack={onBack}>
        <Wordmark tone="red" subtitle="Anime trivia, straight from the credits" className="mb-10">
          AniQuiz
        </Wordmark>

        <Button variant="secondary" size="lg" fullWidth className="mb-5" onClick={() => setShowPicker(true)}>
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
            Nobody seated yet — set your main profile with the 👤 button at the hub, or add a player above.
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
                  {/* Only worth flagging when the pool reads lists at all. */}
                  {needsLists(settings.pool) && (
                    <Badge tone={shows ? 'lime' : 'amber'}>{shows ? `${shows} shows` : '⚠️ No list'}</Badge>
                  )}
                  <Button
                    variant="neutral"
                    size="sm"
                    className="flex-shrink-0"
                    aria-label={`Import ${p.name}'s list from AniList`}
                    onClick={() => setImportTarget(p)}
                  >
                    🔗
                  </Button>
                  <button
                    type="button"
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

        <QuizSettings
          values={settings}
          onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          report={report}
          packStatus={pack.status}
          onRetryPack={pack.retry}
          players={players}
        />

        <div className="mb-6">
          <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
        </div>

        {importTarget && (
          <AniListImport profile={importTarget} onClose={() => setImportTarget(null)} onImported={handleImported} />
        )}

        {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={!canStart}
          onClick={() => {
            savePrefs(settings);
            onStart({ players, settings });
          }}
        >
          🎮 Start Game
        </Button>
      </Screen>
    </>
  );
}
