import { useMemo, useState } from 'react';
import { filterAnimeList } from '../utils/characterPool';
import { Avatar, Button, GhostButton, Icon, Input } from '../../../shared/ui';

// Expandable anime list for hand-picking a character. Local assignment and
// online assignment had near-identical copies of this — the only real
// difference was the action button's label ("Pick" vs "Propose"), so the
// search box below lands in both flows without either caller changing.
export default function AnimeBrowser({
  animeList,
  guesserName,
  sharedShowsOnly,
  actionLabel,
  onSelect,
  onBack,
  emptyMessage,
}) {
  const [expandedAnime, setExpandedAnime] = useState(null);
  const [query, setQuery] = useState('');

  const searching = query.trim().length > 0;
  const shown = useMemo(() => filterAnimeList(animeList, query), [animeList, query]);

  return (
    <>
      <div className="mb-5 flex items-center gap-4">
        <GhostButton onClick={onBack}>← Back</GhostButton>
        <h4 className="font-display text-2xl font-extrabold text-fg-strong">
          {guesserName}&apos;s Characters
        </h4>
        {sharedShowsOnly && (
          <span className="ml-auto text-sm text-fg-subtle">Shared shows only</span>
        )}
      </div>

      {/* Nothing to search when the pool is empty, and emptyMessage below
          already explains why it is. */}
      {animeList.length > 0 && (
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shows or characters…"
          aria-label="Search shows or characters"
          className="mb-5"
        />
      )}

      {animeList.length === 0 && (
        <p className="py-10 text-center text-lg text-fg-helper">{emptyMessage}</p>
      )}

      {/* Distinct from emptyMessage: that one is about having no shared shows
          at all and carries setup advice that would be wrong here. */}
      {animeList.length > 0 && shown.length === 0 && (
        <p className="py-10 text-center text-lg text-fg-helper">
          No shows or characters match “{query.trim()}”.
        </p>
      )}

      {shown.map((anime) => (
        <div key={anime.id} className="mb-4">
          {/* While searching every result is already open, so the header drops
              the chevron and stops being a button rather than sitting there as
              a control that visibly does nothing. */}
          {searching ? (
            <div className="w-full rounded-pop-sm border-2 border-line-strong bg-surface px-5 py-4 text-left text-lg text-fg-strong">
              {anime.title}
              <span className="ml-2 font-sans font-normal text-fg-subtle">
                ({anime.characters.length})
              </span>
            </div>
          ) : (
            <button
              onClick={() => setExpandedAnime(expandedAnime === anime.id ? null : anime.id)}
              className="btn-pop focus-pop w-full border-line-strong bg-surface px-5 py-4 text-left text-lg text-fg-strong"
            >
              <Icon name="chevron" className={`mr-1 transition-transform ${expandedAnime === anime.id ? 'rotate-90' : ''}`} />
              {anime.title}
              <span className="ml-2 font-sans font-normal text-fg-subtle">
                ({anime.characters.length})
              </span>
            </button>
          )}

          {(searching || expandedAnime === anime.id) && (
            <div className="mt-3 space-y-3 pl-2">
              {anime.characters.map((char) => (
                <div key={char.id} className="card-pop flex items-center gap-4 p-4">
                  <Avatar src={char.imageUrl} alt={char.name} size="md" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-display text-lg font-extrabold text-fg-strong">
                      {char.name}
                    </p>
                    <p className="text-base text-fg-helper">
                      {[char.gender, char.role].filter(Boolean).join(' · ')}
                    </p>
                    {char.ability && (
                      <p className="truncate text-sm text-fg-subtle">{char.ability}</p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => onSelect({ ...char, series: anime.title })}
                  >
                    {/* One per character, so it names whom: a cast of "Pick,
                        Pick, Pick" tells a screen reader nothing. */}
                    {actionLabel}<span className="sr-only"> {char.name}</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
