import { useState } from 'react';
import { useProfileStore } from '../context/profileContext';
import AnimeSearch from './AnimeSearch';
import ListImport from './ListImport';
import { canRefreshList } from '../services/listSources';
import { Button, Icon } from '../ui';

// `className` carries the top padding, because the two callers genuinely differ:
// AniGuess renders its own back/player-switcher header above this and needs only
// a small gap (`pt-4`), while the hub renders nothing above it but the fixed top
// bar and needs to clear that. It is a prop rather than a baked-in default
// plus an override because two conflicting Tailwind `pt-` utilities on one element
// resolve by CSS source order, not by the order they appear in the attribute.
export default function ListManager({ profile, onProfileUpdated, className = '' }) {
  // Through the store, not useProfile directly: an edit here has to reach the
  // hub's profile chip and any game holding the same profile, which a bare
  // localStorage write does not do.
  const { saveProfile } = useProfileStore();
  const hasProfile = Boolean(profile);
  const [expandedAnime, setExpandedAnime] = useState(null);
  // 'pick' opens the checklist; 'refresh' skips straight to importing whatever
  // is new. null means closed.
  const [importMode, setImportMode] = useState(null);

  // A show's contents are AniList's, not the player's: there is no way to type
  // a show or a character in by hand (see AnimeSearch for why), and none to
  // trim a cast either — the place to change a list is the tracker, then
  // Refresh. What stays is deleting a whole show, because a refresh only ever
  // ADDS: a show dropped on the tracker, a searched show added by mistake, or a
  // hand-made entry from before all this would otherwise be there for good.
  // Hand-made entries saved before the change are still listed; nothing
  // migrates them.
  const saveUpdatedProfile = (updatedProfile) => {
    saveProfile(updatedProfile);
    onProfileUpdated(updatedProfile);
  };

  const deleteAnime = (animeId) => {
    if (!window.confirm('Delete this anime and all its characters?')) return;
    saveUpdatedProfile({ ...profile, animeList: profile.animeList.filter((a) => a.id !== animeId) });
  };

  // Reachable if a caller navigates here without picking a player first —
  // render an empty state rather than crashing on profile.animeList.
  if (!hasProfile) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <p className="text-center text-lg text-fg-helper">Pick a player to edit their list.</p>
      </div>
    );
  }

  return (
    // Not a <Screen>: the head-room above this body is the caller's call — see
    // the note on `className` at the top of the file.
    <div className={`mx-auto min-h-dvh max-w-2xl px-5 pb-8 sm:px-6 ${className}`}>
      <h2 className="font-display text-3xl font-extrabold text-fg-strong">{profile.name}&apos;s Anime List</h2>
      <p className="mb-6 text-sm text-fg-subtle">
        {profile.animeList.length} anime · {profile.animeList.reduce((n, a) => n + a.characters.length, 0)} characters
      </p>

      {/* Whole list from a tracker */}
      <div className="mb-4 flex gap-3">
        <Button variant="neutral" onClick={() => setImportMode('pick')} className="whitespace-nowrap">
          Import list
        </Button>
        {/* Only once there is an account to refresh from. This is the screen
            dedicated to managing a list, so the one-tap path belongs here. */}
        {canRefreshList(profile) && (
          <Button variant="neutral" onClick={() => setImportMode('refresh')} className="whitespace-nowrap">
            Refresh
          </Button>
        )}
      </div>

      {/* One show at a time */}
      <AnimeSearch profile={profile} onAdded={saveUpdatedProfile} />

      {importMode && (
        <ListImport
          profile={profile}
          autoRefresh={importMode === 'refresh'}
          onClose={() => setImportMode(null)}
          onImported={(mergedProfile) => {
            saveUpdatedProfile(mergedProfile);
            setImportMode(null);
          }}
        />
      )}

      {/* Anime List */}
      {profile.animeList.length === 0 ? (
        <div className="py-16 text-center text-fg-subtle">
          <p className="text-lg">No anime yet — search or import above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profile.animeList.map((anime) => (
            <div key={anime.id} className="card-pop overflow-hidden">
              {/* Anime Header */}
              <div className="flex items-center justify-between px-5 py-4">
                <button
                  onClick={() => setExpandedAnime(expandedAnime === anime.id ? null : anime.id)}
                  className="focus-pop flex-1 rounded-pop-sm text-left"
                >
                  <span className="font-display text-lg font-extrabold text-fg-strong">{anime.title}</span>
                  <span className="ml-2 text-sm text-fg-subtle">
                    {anime.characters.length === 0 ? 'No characters' : `${anime.characters.length} character${anime.characters.length !== 1 ? 's' : ''}`}
                  </span>
                  <span className="ml-2 text-fg-subtle">{expandedAnime === anime.id ? '▲' : '▼'}</span>
                </button>
                <button
                  onClick={() => deleteAnime(anime.id)}
                  aria-label={`Delete ${anime.title}`}
                  className="focus-pop ml-4 grid h-11 w-11 place-items-center rounded-pop-sm text-fg-icon hover:text-pop-red"
                >
                  <Icon name="trash" />
                </button>
              </div>

              {/* Expanded: Characters */}
              {expandedAnime === anime.id && (
                <div className="space-y-2 border-t border-line px-5 py-4">
                  {anime.characters.length === 0 && (
                    <p className="py-2 text-center text-sm text-fg-subtle">No characters yet</p>
                  )}

                  {anime.characters.length > 0 && (
                    <ul>
                      {anime.characters.map((char) => (
                        <li key={char.id} className="border-b border-line-soft py-2 text-fg-strong last:border-0">
                          {char.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
