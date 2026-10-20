import { useEffect, useRef, useState } from 'react';
import { searchAnime } from '../services/anilist';
import { buildImportedAnime } from '../services/importGroups';
import { groupIntoFranchises } from '../utils/franchise';
import { classifyImportGroups, mergeAnimeIntoProfile, mergeImportedAnilistIds } from '../utils/profileMerge';
import { Banner, Button, Input } from '../ui';

const FORMAT_LABEL = {
  TV: 'TV', TV_SHORT: 'TV short', MOVIE: 'Movie', SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music',
};

// Adds one show to a list by searching AniList for it. This replaced a free-text
// title box and a hand-made character form: a show typed in had no id, no stats
// and no cast, and a character made up on the spot had no portrait, no
// favourites and nobody at the table who could recognise them — so every game
// but AniGuess either skipped them or dealt something unplayable. A searched
// show arrives the way an imported one does, cast and all.
//
// Each hit is one AniList entry, so one season: adding two seasons folds them
// into one franchise entry through mergeAnimeIntoProfile's usual matching, and
// a whole franchise in one go is still what the full import is for.
export default function AnimeSearch({ profile, onAdded }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null until a search lands
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const controllerRef = useRef(null);

  // A search or an add still in flight when the editor closes would land on an
  // unmounted screen; abort it instead.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const busy = searching || addingId != null;

  const freshSignal = () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  };

  // Submitted, never search-as-you-type: AniList allows ~30 requests a minute
  // and anilistClient spaces them ~2s apart, so a request per keystroke would
  // queue a dozen stale searches behind the one the player wanted.
  const runSearch = async () => {
    const q = query.trim();
    if (!q || busy) return;
    setSearching(true);
    setError('');
    setNotice('');
    try {
      setResults(await searchAnime(q, { signal: freshSignal() }));
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const add = async (hit) => {
    if (busy) return;
    setAddingId(hit.id);
    setError('');
    setNotice('');
    // The settings the player's last import used, so a searched show carries
    // the same cast filter as the rest of their list.
    const settings = profile.anilistImportSettings;
    try {
      const { importedAnimeList, memberIds } = await buildImportedAnime(groupIntoFranchises([hit]), {
        signal: freshSignal(),
        minSupportingFavourites: settings?.minSupportingFavourites ?? 100,
        mainOnly: settings?.mainOnly ?? false,
      });
      const { profile: merged, addedChars, updatedChars } = mergeAnimeIntoProfile(profile, importedAnimeList);
      // Recorded so the next full import's checklist knows this show is paid
      // for. listSource and the import settings are left alone: one show added
      // by hand says nothing about where the rest of the list comes from.
      onAdded({ ...merged, anilistImportedIds: mergeImportedAnilistIds(profile.anilistImportedIds, memberIds) });
      setNotice(addedChars > 0 || updatedChars === 0
        ? `Added ${hit.title} with ${addedChars} character${addedChars === 1 ? '' : 's'}.`
        : `Updated ${updatedChars} character${updatedChars === 1 ? '' : 's'} in ${hit.title}.`);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="Search AniList for an anime..."
          aria-label="Search for an anime"
          className="flex-1"
        />
        <Button variant="secondary" onClick={runSearch} disabled={!query.trim() || busy} className="whitespace-nowrap">
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {error && <Banner tone="danger" className="mt-3">{error}</Banner>}
      {notice && <Banner tone="success" className="mt-3">{notice}</Banner>}

      {results && results.length === 0 && (
        <p className="mt-3 text-sm text-fg-subtle">No shows found on AniList for that title.</p>
      )}

      {results && results.length > 0 && (
        <ul aria-label="Search results" className="mt-3 divide-y divide-line-soft rounded-pop border-2 border-line bg-surface">
          {results.map((hit) => {
            // One group per hit, classified on its own: two seasons can share a
            // franchise key and still differ in whether their cast is fetched.
            const [group] = groupIntoFranchises([hit]);
            const state = classifyImportGroups(profile, [group]).byKey.get(group.key);
            const year = hit.startDate?.year ?? hit.seasonYear;
            const meta = [FORMAT_LABEL[hit.format] ?? hit.format, year].filter(Boolean).join(' · ');
            return (
              <li key={hit.id} className="flex items-center gap-3 px-3 py-2">
                {hit.coverImageUrl ? (
                  <img src={hit.coverImageUrl} alt="" loading="lazy" className="h-14 w-10 flex-shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-14 w-10 flex-shrink-0 rounded bg-wash" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-fg-strong">{hit.title}</p>
                  {meta && <p className="text-sm text-fg-subtle">{meta}</p>}
                </div>
                {state === 'known' ? (
                  <span className="whitespace-nowrap text-sm text-fg-subtle">In your list</span>
                ) : (
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => add(hit)}
                    disabled={busy}
                    aria-label={`Add ${hit.title}`}
                  >
                    {addingId === hit.id ? 'Adding…' : 'Add'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
