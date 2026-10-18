import { useState, useMemo, useEffect, useRef } from 'react';
import { fetchManyAnimeCharacters } from '../services/anilist';
import { fetchListEntries, LIST_SITES, malProxyEnabled, siteLabel } from '../services/listSources';
import { filterAndMapCharacterEdges, mergeCharacterEdges, summarizeGroupStats } from '../utils/anilistFormat';
import { groupIntoFranchises } from '../utils/franchise';
import { kitsuSlugFrom, listSourceOf } from '../utils/listImport';
import {
  mergeAnimeIntoProfile,
  classifyImportGroups,
  mergeImportedAnilistIds,
} from '../utils/profileMerge';
import { Badge, Button, Card, Checkbox, Input, Label, Modal, NumberInput } from '../ui';

const MAX_CHARACTERS_PER_SHOW = 60;

const MAL_EXPORT_URL = 'https://myanimelist.net/panel.php?go=export';

// What the box under the site picker asks for, per site.
const USERNAME_COPY = {
  anilist: { label: 'AniList username', placeholder: 'e.g. YourAniListName' },
  mal: { label: 'MyAnimeList username', placeholder: 'e.g. YourMALName' },
  kitsu: { label: 'Kitsu username or profile link', placeholder: 'e.g. kitsu.app/users/yourname' },
};

// One import screen for every site. Whichever site a list comes from, it is
// turned into AniList ids and looked up on AniList (see
// shared/utils/listImport.js), so everything after the fetch — the franchise
// grouping, the checklist, the character import, the merge — is the same code
// the AniList-only screen always ran, and a profile built from MyAnimeList is
// indistinguishable from one built from AniList.
export default function ListImport({ profile, onClose, onImported, autoRefresh = false }) {
  const [step, setStep] = useState('username'); // username | loading-list | list | importing | done | error
  // Where this profile imported from last time. Prefilled so a re-import is one
  // tap. Re-importing is the common case, not the rare one: the page cache in
  // anilist.js is in-memory only, so every refresh means paying the full
  // ~2.2s-per-request throttle again, and nobody wants to also retype their
  // username to do it.
  const source = listSourceOf(profile);
  const [site, setSite] = useState(source.site);
  const [username, setUsername] = useState(source.username);
  const [file, setFile] = useState(null);
  // MAL takes a username only through the proxy (MAL's own API sends no CORS
  // headers). Without the proxy, or after it failed, MAL asks for its export
  // file instead — the same file the 'file' site reads.
  const [malByFile, setMalByFile] = useState(!malProxyEnabled());
  const usesFile = site === 'file' || (site === 'mal' && malByFile);
  // Remembered from the last successful import, so a one-tap refresh applies the
  // same filters the existing list was built with rather than silently reverting
  // to the defaults and pulling in characters the user had filtered out.
  const savedSettings = profile?.anilistImportSettings;
  const [includeCurrent, setIncludeCurrent] = useState(savedSettings?.includeCurrent ?? false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minSupportingFavourites, setMinSupportingFavourites] = useState(
    savedSettings?.minSupportingFavourites ?? 100
  );
  const [mainOnly, setMainOnly] = useState(savedSettings?.mainOnly ?? false);

  // One row per show, not per season: each option is a franchise group
  // { key, title, coverImageUrl, memberIds, members }. `selected` holds keys.
  const [animeOptions, setAnimeOptions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [hideImported, setHideImported] = useState(false);
  // Shows on the other site's list that AniList has no entry for. Counted, and
  // said out loud, because a list that silently comes back shorter than the one
  // on the site reads as a broken import.
  const [unmatched, setUnmatched] = useState(0);

  // What a re-import would actually buy: which groups are new, which gained a
  // season, and which are already paid for. Memoized because it is O(groups ×
  // animeList) with a regex in the inner loop — fine once per fetch, wasteful
  // on every keystroke in the filter box.
  const { byKey: importStates, counts, suggested } = useMemo(
    () => classifyImportGroups(profile, animeOptions),
    [profile, animeOptions]
  );
  // A first-ever import has nothing to compare against, so the whole feature
  // stays invisible: no summary, no badges, no toggle, everything preselected —
  // exactly the screen that shipped before this existed.
  //
  // `stale` counts here too, and forgetting it is a live trap: a profile
  // imported before character `favourites` existed classifies EVERY show stale
  // and none known, which would read as a first import and hide the summary on
  // the one profile that most needs it explained.
  const isFirstImport = counts.known === 0 && counts.stale === 0;

  // Only offer the skip-the-checklist button while the picker and the field
  // still name the account this profile was built from — typing someone else's
  // name is not a refresh, and should land on the checklist like any first
  // import. A file has no "same account" to compare, so it never refreshes.
  const canRefresh = !usesFile
    && site === source.site
    && Boolean(source.username)
    && username.trim().toLowerCase() === source.username.toLowerCase();

  const ready = usesFile ? Boolean(file) : Boolean(username.trim());

  const [progress, setProgress] = useState({ index: 0, total: 0 });
  const [abortController, setAbortController] = useState(null);
  const [mergedProfile, setMergedProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  // Set when MAL's proxy could not be reached, so the error step can offer the
  // file instead of only "Try Again" against a server that is down.
  const [offerFile, setOfferFile] = useState(false);

  // `auto` is the one-tap refresh path: fetch the list and go straight into
  // importing whatever is new, without stopping at the checklist.
  const fetchList = async ({ auto = false } = {}) => {
    if (!ready) return;
    setStep('loading-list');
    setOfferFile(false);
    try {
      const statusIn = includeCurrent ? ['COMPLETED', 'CURRENT'] : ['COMPLETED'];
      const { entries: list, unmatched: missing } = await fetchListEntries(
        usesFile ? 'file' : site,
        usesFile ? file : username.trim(),
        { statusIn },
      );
      setUnmatched(missing);
      if (list.length === 0) {
        setErrorMessage(missing > 0
          ? `None of the ${missing} shows on that list could be found on AniList.`
          : 'That list has no anime in the selected list status(es).');
        setStep('error');
        return;
      }
      const groups = groupIntoFranchises(list);
      // Preselect only what costs something: shows not in the profile, plus
      // franchises that gained a season. Selecting all 200 shows to discover
      // three new ones is ~14 throttled round-trips against AniList's real
      // ~30 req/min limit, every time. Select All is still one tap away.
      const { suggested: toImport } = classifyImportGroups(profile, groups);
      setAnimeOptions(groups);
      setSelected(toImport);
      // Default the toggle on only when there is something left to look at —
      // hiding every row would leave an empty list.
      setHideImported(toImport.size > 0 && toImport.size < groups.length);

      if (auto && toImport.size > 0) {
        runImport(groups.filter((g) => toImport.has(g.key)));
        return;
      }
      // Nothing new on the auto path lands here too: the checklist's up-to-date
      // card explains why, and keeps Select All reachable.
      setStep('list');
    } catch (err) {
      setErrorMessage(err.message);
      setOfferFile(site === 'mal' && !usesFile && Boolean(err.network));
      setStep('error');
    }
  };

  // Fires once, only when a caller explicitly asked for the one-tap path and the
  // profile actually has a username to refresh from; otherwise the dialog opens
  // on the normal first step (a file-based profile always lands there, since
  // nothing can re-read a file the player has not chosen again).
  const autoRunRef = useRef(false);
  useEffect(() => {
    if (!autoRefresh || autoRunRef.current || !canRefresh) return;
    autoRunRef.current = true;
    fetchList({ auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, canRefresh]);

  const pickSite = (id) => {
    setSite(id);
    // The saved username belongs to the saved site only — carrying an AniList
    // name into the Kitsu box would fetch a stranger's list.
    setUsername(id === source.site ? source.username : '');
  };

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return animeOptions;
    // Match the shown title or any season's title, so typing "Season 2" still
    // finds the group it was folded into.
    return animeOptions.filter((g) =>
      g.title.toLowerCase().includes(q) ||
      g.members.some((m) => m.title.toLowerCase().includes(q))
    );
  }, [animeOptions, search]);

  const visibleOptions = useMemo(
    () => (hideImported
      ? filteredOptions.filter((g) => importStates.get(g.key) !== 'known')
      : filteredOptions),
    [filteredOptions, hideImported, importStates]
  );

  const startImport = () => runImport(animeOptions.filter((g) => selected.has(g.key)));

  async function runImport(selectedGroups) {
    if (selectedGroups.length === 0) return;

    // Characters are still fetched per AniList media id — the progress bar
    // counts those fetches, so its total is the flattened member count.
    //
    // Every member of a selected group is fetched, including ones already
    // covered: filterAndMapCharacterEdges applies the favourites filter and the
    // per-show cap across the WHOLE franchise cast below, so a group that only
    // gained a season still needs its earlier seasons' edges to filter against.
    const memberIds = selectedGroups.flatMap((g) => g.memberIds);

    const controller = new AbortController();
    setAbortController(controller);
    setStep('importing');
    setProgress({ index: 0, total: memberIds.length });

    let charactersById;
    try {
      charactersById = await fetchManyAnimeCharacters(memberIds, {
        signal: controller.signal,
        minSupportingFavourites,
        mainOnly,
        onProgress: (resolved) => setProgress({ index: resolved, total: memberIds.length }),
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        // Cancelled — discard partial results, return to the checklist.
        setStep('list');
        setAbortController(null);
        return;
      }
      setErrorMessage(err.message);
      setStep('error');
      setAbortController(null);
      return;
    }

    const importedAnimeList = selectedGroups.map((group) => {
      const memberResults = group.memberIds.map((id) => charactersById.get(id) ?? { genres: [], edges: [] });
      // Merge every season's cast, then apply the favourites/main filters and
      // the per-show cap once across the whole franchise.
      const edges = mergeCharacterEdges(memberResults.map((r) => r.edges));
      const genres = [...new Set(memberResults.flatMap((r) => r.genres))];
      const characters = filterAndMapCharacterEdges(edges, {
        minSupportingFavourites,
        mainOnly,
        maxCharacters: MAX_CHARACTERS_PER_SHOW,
        genres,
      });
      // The per-show facts ride along with the cast. Without them a saved entry
      // is only { id, title, characters }, which is why every ranking axis but
      // "opinion" had no data to sort by.
      return {
        animeId: group.key,
        memberIds: group.memberIds,
        title: group.title,
        ...summarizeGroupStats(group),
        characters,
      };
    });

    const {
      profile: merged, addedAnime, addedChars, updatedChars,
    } = mergeAnimeIntoProfile(profile, importedAnimeList);
    // All three are remembered only on a successful import, so a typo'd username
    // never sticks, and a cancelled run never claims coverage it doesn't have.
    setMergedProfile({
      ...merged,
      // Which site and account the list came from, so the next import opens on
      // it. A file records its site and no username: there is nothing to
      // refresh from. `anilistUsername` is still written for AniList, because
      // every profile before listSource carries it and listSourceOf reads it.
      // A pasted Kitsu profile link is stored as its slug: the link works for a
      // refresh either way, but the slug is what the box should show next time.
      listSource: usesFile
        ? { site: site === 'mal' ? 'mal' : 'file' }
        : { site, username: site === 'kitsu' ? kitsuSlugFrom(username) : username.trim() },
      ...(site === 'anilist' && !usesFile ? { anilistUsername: username.trim() } : {}),
      // AniList ids whichever site the list came from — every site's list is
      // resolved to AniList before it gets here.
      //
      // Recorded rather than inferred: mergeAnimeIntoProfile collapses a
      // franchise's seasons into ONE entry, so the surviving entry id cannot say
      // which seasons were fetched — and that is exactly what the next import's
      // checklist has to answer to spot a newly aired season.
      anilistImportedIds: mergeImportedAnilistIds(profile?.anilistImportedIds, memberIds),
      anilistImportSettings: { includeCurrent, mainOnly, minSupportingFavourites },
    });
    setStats({ addedAnime, addedChars, updatedChars, unmatched });
    setStep('done');
    setAbortController(null);
  }

  const finishImport = () => {
    onImported(mergedProfile, stats);
  };

  const cancelImport = () => {
    abortController?.abort();
  };

  const pct = `${(progress.index / Math.max(progress.total, 1)) * 100}%`;

  return (
    // The import is cancellable but not dismissable mid-flight — closing the
    // dialog would strand the in-progress fetch, so lock it during 'importing'.
    <Modal onClose={onClose} dismissible={step !== 'importing'}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl font-extrabold text-white">🔗 Import your list</h2>
        {step !== 'importing' && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="focus-pop -mr-2 grid h-11 w-11 place-items-center rounded-pop-sm text-xl font-black text-fg-icon hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {(step === 'username' || step === 'loading-list') && (
        <div>
          {/* A <p>, not Field.jsx's Label: that renders a <label>, and a group of
              buttons is not a control one can point at (AxisPicker's SectionLabel). */}
          <p
            id="list-site-label"
            className="mb-1.5 font-display text-xs font-extrabold uppercase tracking-widest text-fg-helper"
          >
            Where is your list?
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-labelledby="list-site-label">
            {LIST_SITES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={site === s.id}
                disabled={step === 'loading-list'}
                onClick={() => pickSite(s.id)}
                className={`focus-pop rounded-pop-sm border-2 px-3 py-2.5 text-center font-display
                  text-base font-extrabold transition-colors disabled:opacity-40
                  ${site === s.id
                    ? 'border-pop-purple bg-pop-purple/20 text-white'
                    : 'border-line bg-surface-2/40 text-fg-helper hover:border-line-loud'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {usesFile ? (
            <div className="mb-4">
              <Label htmlFor="list-file">
                {site === 'mal' ? 'Your MyAnimeList export' : 'Your exported list'}
              </Label>
              <Input
                id="list-file"
                type="file"
                accept=".xml,.gz,application/xml,text/xml,application/gzip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={step === 'loading-list'}
                className="mb-2 file:mr-3 file:rounded-pop-sm file:border-0 file:bg-pop-purple
                  file:px-3 file:py-1 file:font-display file:font-extrabold file:text-ink"
              />
              {/* Where the file comes from, because "upload your export" is
                  useless to someone who has never seen the export page. */}
              <p className="text-sm text-fg-helper">
                On MyAnimeList, open{' '}
                <a
                  href={MAL_EXPORT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-pop rounded-sm text-pop-purple underline hover:text-white"
                >
                  Export My List
                </a>
                , export your anime list and choose the downloaded file here (.xml.gz is fine).
                {site === 'file' && ' Kitsu, Simkl and most other trackers can export the same MyAnimeList format.'}
              </p>
              {site === 'mal' && malProxyEnabled() && (
                <button
                  type="button"
                  onClick={() => setMalByFile(false)}
                  className="focus-pop mt-2 rounded-pop-sm text-sm text-fg-subtle hover:text-white"
                >
                  or use my username instead
                </button>
              )}
            </div>
          ) : (
            <>
              <Label htmlFor="list-username">{USERNAME_COPY[site]?.label}</Label>
              <Input
                id="list-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ready && fetchList({ auto: canRefresh })}
                placeholder={USERNAME_COPY[site]?.placeholder}
                autoFocus
                disabled={step === 'loading-list'}
                className="mb-4"
              />
            </>
          )}
          <Checkbox
            label="Also include shows I'm currently watching"
            checked={includeCurrent}
            onChange={(e) => setIncludeCurrent(e.target.checked)}
            className="mb-4"
          />

          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="focus-pop mb-3 rounded-pop-sm text-sm text-fg-subtle hover:text-white"
          >
            {showAdvanced ? '▼' : '▶'} Advanced
          </button>
          {showAdvanced && (
            <Card padding="sm" className="mb-4 space-y-3">
              <Checkbox
                label="Main characters only"
                checked={mainOnly}
                onChange={(e) => setMainOnly(e.target.checked)}
              />
              {!mainOnly && (
                <div className="flex flex-wrap items-center gap-3 text-fg-strong">
                  <span>Min. favourites for supporting characters:</span>
                  {/* Steps by 25 — the useful range here is tens, not ones. */}
                  <NumberInput
                    size="sm"
                    min={0}
                    max={10000}
                    step={25}
                    value={minSupportingFavourites}
                    ariaLabel="Minimum favourites"
                    onChange={setMinSupportingFavourites}
                    className="w-44"
                  />
                </div>
              )}
            </Card>
          )}

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => fetchList({ auto: canRefresh })}
            disabled={!ready || step === 'loading-list'}
          >
            {step === 'loading-list'
              ? 'Fetching your list…'
              : canRefresh ? '🔄 Refresh my list' : usesFile ? 'Read My List' : 'Fetch My List'}
          </Button>
          {/* The checklist is still one tap away — needed to re-fetch a show
              whose cast has grown, or to import with different settings. */}
          {canRefresh && step !== 'loading-list' && (
            <button
              onClick={() => fetchList()}
              className="focus-pop mt-3 w-full rounded-pop-sm text-sm text-fg-subtle hover:text-white"
            >
              or choose what to import…
            </button>
          )}
        </div>
      )}

      {step === 'list' && (
        <div>
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            aria-label="Filter anime"
            className="mb-3"
          />
          {!isFirstImport && suggested.size === 0 && (
            <Card padding="sm" className="mb-3 text-center">
              <p className="font-display font-extrabold text-white">✅ You&rsquo;re up to date</p>
              <p className="mt-1 text-sm text-fg-helper">
                All {counts.known} shows on your {siteLabel(site)} list are already in your profile, with nothing
                left to fill in. Use <strong className="text-fg-strong">Select All</strong> to
                re-fetch them anyway — handy if a show has gained characters, or you changed
                the Advanced settings.
              </p>
            </Card>
          )}

          <div className="mb-1 flex items-center gap-3">
            {!isFirstImport && (
              <button
                onClick={() => setSelected(new Set(suggested))}
                className="focus-pop rounded-pop-sm text-sm text-fg-body hover:text-white"
              >
                Select New
              </button>
            )}
            <button
              onClick={() => setSelected(new Set(animeOptions.map((g) => g.key)))}
              className="focus-pop rounded-pop-sm text-sm text-fg-body hover:text-white"
            >
              Select All
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="focus-pop rounded-pop-sm text-sm text-fg-body hover:text-white"
            >
              Select None
            </button>
            <span className="ml-auto text-sm text-fg-subtle">{selected.size} selected</span>
          </div>

          {/* Only once there is a re-import to describe. On a first import
              "0 already imported" is noise at best and alarming at worst. */}
          {!isFirstImport && (
            <p className="mb-2 text-xs text-fg-subtle">
              {counts.new} new
              {counts.partial > 0 && ` · ${counts.partial} with a new season`}
              {counts.stale > 0 && ` · ${counts.stale} missing character details`}
              {` · ${counts.known} already imported`}
            </p>
          )}

          {unmatched > 0 && (
            <p className="mb-2 text-xs text-fg-subtle">
              {unmatched} show{unmatched === 1 ? '' : 's'} on your list {unmatched === 1 ? 'isn’t' : 'aren’t'} on
              AniList, which every game gets its shows from, so {unmatched === 1 ? 'it was' : 'they were'} left out.
            </p>
          )}

          {!isFirstImport && (
            <Checkbox
              label="Hide already imported"
              checked={hideImported}
              onChange={(e) => setHideImported(e.target.checked)}
              className="mb-3"
            />
          )}

          <div className="mb-4 max-h-72 space-y-2 overflow-y-auto">
            {visibleOptions.map((group) => {
              const state = importStates.get(group.key) ?? 'new';
              return (
                <label
                  key={group.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-pop-sm border-2
                    border-line bg-surface-2 p-3 ${state === 'known' ? 'opacity-50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(group.key)}
                    onChange={() => toggleSelected(group.key)}
                    className="h-5 w-5 flex-shrink-0 accent-pop-lime"
                  />
                  {group.coverImageUrl ? (
                    <img src={group.coverImageUrl} alt="" loading="lazy" className="h-14 w-10 flex-shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-10 flex-shrink-0 rounded bg-wash" />
                  )}
                  <span className="min-w-0 flex-1 text-sm text-white">{group.title}</span>
                  {/* 'new' is already the checked majority and 'known' is dimmed
                      and unchecked, so badging either would be 200 rows of
                      decoration. The two that earn one are the states a user
                      would otherwise not know to act on: a newly aired season,
                      and a show whose saved cast predates the details the games
                      now read. */}
                  {state === 'partial' && <Badge tone="amber">New season</Badge>}
                  {state === 'stale' && <Badge tone="amber">Missing details</Badge>}
                  {state === 'known' && (
                    <span className="flex-shrink-0 text-xs text-fg-subtle">Imported</span>
                  )}
                  {group.memberIds.length > 1 && (
                    <span className="flex-shrink-0 text-xs text-fg-subtle">{group.memberIds.length} entries</span>
                  )}
                </label>
              );
            })}
          </div>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={startImport}
            disabled={selected.size === 0}
          >
            Import Selected ({selected.size})
          </Button>
        </div>
      )}

      {step === 'importing' && (
        <div className="py-6 text-center">
          <div className="mb-4 text-5xl">📥</div>
          <p className="mb-1 font-display text-lg font-extrabold text-white">Importing characters…</p>
          <p className="mb-6 text-fg-helper">{progress.index} of {progress.total} shows</p>
          <div className="mb-6 h-3 w-full overflow-hidden rounded-pop-sm border-2 border-ink bg-surface-2">
            <div className="h-full bg-pop-pink transition-all" style={{ width: pct }} />
          </div>
          <Button variant="neutral" onClick={cancelImport}>Cancel</Button>
        </div>
      )}

      {step === 'done' && (
        <div className="py-6 text-center">
          <div className="mb-4 text-5xl">✅</div>
          <p className="mb-2 font-display text-lg font-extrabold text-white">Import complete!</p>
          <p className="mb-6 text-fg-body">
            +{stats?.addedAnime ?? 0} anime, +{stats?.addedChars ?? 0} characters
            {/* Repairs are reported separately from additions, because a
                re-import of a list you already have adds nothing and can still
                have done the thing you ran it for — without this line that run
                reads as "+0 anime, +0 characters" and looks like a failure. */}
            {stats?.unmatched > 0 && (
              <>
                <br />
                <span className="text-fg-subtle">
                  {stats.unmatched} show{stats.unmatched === 1 ? '' : 's'} not found on AniList, skipped
                </span>
              </>
            )}
            {stats?.updatedChars > 0 && (
              <>
                <br />
                <span className="text-pop-lime">
                  {stats.updatedChars} existing character
                  {stats.updatedChars === 1 ? '' : 's'} filled in with missing details
                </span>
              </>
            )}
          </p>
          <Button variant="success" size="lg" fullWidth onClick={finishImport}>Done</Button>
        </div>
      )}

      {step === 'error' && (
        <div className="py-6 text-center">
          <div className="mb-4 text-5xl">⚠️</div>
          <p className="mb-6 font-display font-extrabold text-pop-red">{errorMessage}</p>
          {/* MAL by username rides on a proxy; when that is unreachable the
              export file still works, so offer it rather than a retry loop. */}
          {offerFile && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              className="mb-3"
              onClick={() => { setMalByFile(true); setStep('username'); }}
            >
              Upload my MyAnimeList file instead
            </Button>
          )}
          <Button variant="neutral" size="lg" fullWidth onClick={() => setStep('username')}>Try Again</Button>
        </div>
      )}
    </Modal>
  );
}
