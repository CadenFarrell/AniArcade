---
paths:
  - "generateFacts.js"
  - "generateProfiles.js"
  - "animeCatalog.js"
  - "factSources/**"
  - "facts/**"
  - "public/facts/**"
  - "src/shared/utils/facts.js"
  - "src/shared/utils/outsideFacts.js"
  - "src/shared/utils/packStats.js"
  - "src/shared/services/factPack.js"
  - "src/shared/services/anilistClient.js"
  - "src/shared/hooks/usePackBackfill.js"
  - "src/games/aniquiz/**"
---

# Fact packs

Every other game derives its answer key on the device from the profile; "who directed this" is
not derivable, so **the answer ships with the question.** `generateFacts.js`
(`npm run generate:facts`) writes `public/facts/pack-vN.json` behind `index.json`;
`shared/services/factPack.js` loads it; `shared/utils/facts.js` holds every pure part. AniQuiz
is the main reader (`src/games/aniquiz/CLAUDE.md`). The pack covers ~680 shows, so a missing
entry is normal, never a failed load (`factsFor` falls closed on an empty key list).

## Keys and assembly

- **A pack key is the SAME fold a profile keys on** — `franchiseTitleKey`, `characterNameKey`,
  re-exported through `facts.js` so generator and app cannot drift. "Only shows this room
  imported" is then a Set lookup at draw time, and nothing is regenerated to change targeting.
  `anilistId` is provenance only: identity is never id-based (ListManager's old ids and
  AniList's share no space).
- **Franchises group by AniList relations, exactly as an import does** (`toListEntry` +
  `groupIntoFranchises`, keyed on the canonical season's title) — folded titles split Re:Zero,
  Komi and Food Wars. A top-level `aliases` map sends each member title to the canonical key;
  `resolveShowKey` is the lookup, used by AniQuiz's `buildContext` and `packStats.js`.
- **Assembly is first-write-wins, per field.** `collect` emits each group's canonical season
  first, then by air date, and groups best-ranked first; last-write-wins once left Attack on
  Titan saying WIT 2013 beside MAPPA 2022 facts. "Per field" lets a later season fill gaps.

## What AniList supplies

- **Staff is paged** (`allStaffEdges`, `factSources/anilist.js`) while a credit is missing, at
  the SAME 20 per page (25 would skip entries 21–25), up to 15 pages, roles matched trimmed
  (`"Music "`). Credits match through `STAFF_CREDITS`/`pickCredit` in `facts.js`: a qualified
  credit ("Director (eps 1-199)") only when no plain one exists, and "Animation Director", "ADR
  Director", "Director of Photography" never match. "Script" is not series composition.
- **`popularityRank`** (1 = most popular) is pricing data, not clue material; a show without one
  is *obscure*, never *unknown and therefore easy*.
- **Stats** (`popularity`, `averageScore`, `startYear`, `showFavourites`, folded by
  `summarizeGroupStats` so they mean what an import's do) repair old profiles via `packStats.js`:
  `usePackBackfill` runs from AniRank's, AniTune's and AniFake's setup screens and lobbies only
  (never the hub — players who never open them never fetch the pack), fills only ABSENT show
  stats, and fills character `favourites` when stored 0 too (`?? 0` makes 0 ambiguous).
  `profileFingerprint` counts both, or a repair never reaches a room. Episodes are not
  backfilled: the pack's is one season, a profile's is summed.
- **`supportingIn`** (favourites ≥ 1000, four per show) sits beside `appearsIn`, which still
  means MAIN — the cast clues say "main character".
- The catalog is the top 1000 by popularity. When a query changes, its cache files get a new
  suffix (`-v4`), so old fields can never be silently reused.

## Outside sources (v5)

Only for fields AniList lacks. Each is a file in `factSources/` handed `collect()`'s groups,
looked up **by AniList id, never title**, and appended after AniList's rows — first-write-wins
means it can only fill a gap, never create a subject. What a response MEANS lives in
`outsideFacts.js`, with tests; adapters are network and cache. Both services filter on
**User-Agent**, which Node's `fetch` does not send, so the adapters set one (and do not share
AniTune's browser client). Caches are per id (`animethemes-v2-<id>.json`,
`wikidata-origin-v1-<id>.json`, `anilist-source-<id>.json`). The generator prints its coverage
figures every run, because a quiet drop from a source that is not ours looks like success.

- **`themes`** (AnimeThemes, matched through its AniList "resource"): `{ type, song, artists? }`,
  ≤ 4 OPs and 2 EDs, canonical season first; `artists` is absent when no performer is linked,
  which rules a song out of who-sings-it clues only. A **dub** group ("English Version - 4Kids")
  is dropped; a Japanese broadcast variant ("BD Version") is kept but ranked after the main
  sequence. Versions of one song count as ONE (`songKey`) and keep the plain title, or a clue
  offers a song beside its own remix. A null `sequence` reads as 1.
- **`serializedIn`, `originalPublisher`** (Wikidata, CC0; Jikan was refused as an unlicensed MAL
  scrape): the query climbs part-of-the-series first (season items lack "based on"), and reads
  the MAGAZINE's publisher, since a manga's own list is every licensee worldwide (light novels:
  Japanese publishers only, which yields the imprint). A work attaches only when its type
  matches AniList's `source`; a value the source contradicts itself on is dropped.
- **`originalYear`** comes from the source work's own AniList entry, not Wikidata, which was
  wrong in every checked disagreement; Wikidata is a fallback, and AniQuiz refuses a source year
  later than the premiere.

The dub, variant and null-sequence rules came from a comparison against MyAnimeList's API
(2026-10-18, comparison only — nothing from MAL ships).

## Overrides, the loader, Node

- **`facts/overrides.json` is applied AFTER generation**, so a regeneration never clobbers a
  correction; a `null` suppresses a wrong fact. It holds Wikidata's wrong magazines, moved web
  serials and AnimeThemes' slips (misspelt titles, soundtrack pieces filed as OP1 — not a rule,
  since most uncredited first openings are real). Override theme arrays are built by running
  `themesFromAnimeThemes` over the cached records minus the bad entries, so caps and order match.
  The manifest's `facts` count moves only when an override fills or suppresses something.
- **The loader takes two fetches on purpose:** `index.json` is small and fetched `no-store`, the
  pack it names is immutable and cached hard, so a data fix is a new pack file plus one line of
  `index.json` — no rebuild. A bundled JSON `import()` would also be parsed by every player who
  never opens the game. Old packs are deleted: nothing asks for one by name.
- **`facts.js` carries explicit `.js` extensions** (and `franchise.js`'s import of
  `./ranking.js`), because the generator imports it under plain Node.
- **Both generators import `anilistClient.js`** (Node-safe despite its header) rather than
  hand-rolling a throttle — a copy is how a rate-limit fix reaches two callers out of three.
  AniList answers a request with **no `Referer`** with a 403 saying the API is "temporarily
  disabled due to severe stability issues": a bot filter, not an outage. `REFERER` in
  `anilistClient.js` fixes it (a no-op in the browser, which sends its own).
- A cold-cache run takes hours (staff paging on films); a warm one is quick and fully offline.
- **Wikidata** (`query.wikidata.org/sparql`, generator only): needs an identifying
  `User-Agent`, kills queries past 60s (hence 40 ids a batch — the season → series path is the
  expensive part), and is POSTed to because the query outgrows a URL.
