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

Moved from the root `CLAUDE.md` so it loads only when Claude works on the files above. The
cross-game architecture it builds on is still there.

## Fact packs: the answers a profile cannot derive


Every game above computes its own answer key on the device — `valueFor` reads a stored
field, `trueOrder` sorts it, `scoreBoard` grades against it. "Who directed this" is not a
function of anything a profile holds (see the table above for how narrow a profile actually
is), so a quiz-style game cannot work that way: **the answer has to ship with the
question.** `generateFacts.js` (Node, `npm run generate:facts`) writes a pack, `public/facts/`
serves it as a static file, `shared/services/factPack.js` loads it, and
`shared/utils/facts.js` holds every pure part of it.

**The pack is populated — 680 shows, 2948 characters, 26017 facts per `index.json` (v5) — and
AniQuiz is its main reader** (see `src/games/aniquiz/CLAUDE.md`); AniRank, AniTune and
AniFake read its stats only through the profile backfill below. A consumer must still treat
a missing entry as normal rather than as a failed load: most of what a player imports will not
be among 680 shows, and `factsFor` falls closed on an empty key list for exactly that case.

`pack-v2` added **`popularityRank`** (1 = AniList's most popular), stamped from the discovery
list's own order — the `anilist-popular-p*.json` pages already in `.facts-cache/`, so adding it
needed no fetch. It is pricing data, not clue material. A catalog show outside the top N has
no rank, and a reader must treat that as *obscure*, never as *unknown and therefore easy*.
v1 was deleted rather than kept beside it: nothing had ever read it.

`pack-v3` pages the staff list. `MEDIA_QUERY` fetches 20 staff entries by relevance, and on
a big production those are all directors and designers — Frieren's "Music" credit is entry 26
— so v2 had no composer for one show in five, Demon Slayer and Spirited Away included.
`allStaffEdges` in `factSources/anilist.js` fetches further pages only while a credit is
missing, at the **same 20 per page** (page 2 at 25 would start at entry 26 and skip 21–25), and
roles are matched trimmed, because some arrive as `"Music "`. Composer went from 79% to 98%
of shows and director from 93% to 98%, with no v2 value changed. Series composition stayed at
79%: the rest are films, or shows that credit their writer as "Script", which is a different
credit and is deliberately not read as one. That measurement is also why no outside source
was added then — the gaps it was meant to fill were ours (v5 added one for new fields). v2 was
deleted: the loader fetches `index.json` with `no-store`, so nothing asks for an old pack by
name.

`pack-v4` fixed accuracy before adding anything, because the measured problems were ours again:

- **Franchises are grouped by AniList relations, exactly as an import groups them.**
  `collect` runs every media through `toListEntry` and `groupIntoFranchises` and keys the
  group on its canonical season's title. v3 folded titles, and titles do not fold reliably:
  a trailing hyphen split Re:Zero, a curly apostrophe split Komi, and Food Wars was six
  subjects — so a sequel could speak for a franchise and a quiz could offer the answer's own
  sequel as a wrong option. A top-level **`aliases`** map sends each member title's fold to
  the canonical key, and `resolveShowKey` (`facts.js`) is the lookup; AniQuiz's
  `buildContext` and `packStats.js` both go through it.
- **Credits match through `STAFF_CREDITS` / `pickCredit` in `facts.js`**, each an ordered
  pattern list, so the matching has tests. `/^director$/` had shipped One Piece, Naruto
  Shippuden and Dragon Ball Z with no director: long-runners credit "Director (eps 1-199)". A
  qualified credit is used only when no plain one exists, and "Animation Director", "ADR
  Director" and "Director of Photography" never match. Staff paging goes to 15 pages, since
  those same long-runners spent all 5 of v3's on per-episode credits.
- **It carries the numbers an import stores** — `popularity`, `averageScore`, `startYear`
  (plus `showFavourites`), folded by `summarizeGroupStats`, so a pack value and an imported
  one mean the same thing. That is what `shared/utils/packStats.js` repairs old profiles
  from: `usePackBackfill` runs from the setup screens and lobbies of AniRank, AniTune and
  AniFake (never the hub — players who never open them never fetch the pack), fills only
  ABSENT show stats, and fills character `favourites` when the stored value is 0 too, because
  the import writes `favourites ?? 0` and a stored 0 is ambiguous. `profileFingerprint`
  counts both, or a repair would never reach a room the profile is already in. Episodes are
  deliberately not backfilled: the pack's is the canonical season (clue material), a
  profile's is summed across seasons.
- **The best-known supporting characters** (favourites ≥ 1000, four per show) arrive under
  **`supportingIn`**, beside `appearsIn`, which **still means MAIN in** — both cast clues say
  "main character", and widening it would make them state something false. See
  `src/games/aniquiz/CLAUDE.md`.
- **The catalog is the top 1000 by popularity**, against v3's 500, and the cache files for the
  changed query and the popularity pages carry a `-v4` suffix, so neither the old fields nor
  the 2026-09-08 ranking could be silently reused.

Measured on the v4 run: 1004 media grouped into 680 shows (Dragon Ball's Z, Super and GT, and
Naruto's Shippuden and Boruto, each fold into their franchise — AniList links them as sequels,
and an import folds them the same way); director 99.9% (was 98%), series composition 82%,
composer 96.8% over a pack half again as large (the newer, less-famous shows are where it
misses), and popularity, score and year 100%. 205 aliases; 239 characters are supporting-only.
A first run over a cold cache takes hours rather than minutes, nearly all of it staff paging
on films that never credit a series composition — a warm cache makes the next one quick.

`pack-v5` is the first with facts from **outside AniList**, and only for things AniList has no
field for at all — every AniList value is byte-identical to v4's. Each outside source is a file
in `factSources/` handed `collect()`'s franchise groups (`meta.groups`: key, member AniList ids
canonical-first, source), looks them up **by AniList id** — never by title — and returns rows;
`generateFacts.js` appends them after AniList's, so first-write-wins means an outside value
only ever fills a gap and can never create a subject. What a response *means* lives in
`shared/utils/outsideFacts.js`, with tests; the adapters are just network and cache.

- **`themes`** — openings and endings from **AnimeThemes** (`factSources/animethemes.js`), the
  API AniTune already plays from, matched through the AniList id it stores as a "resource".
  `{ type: 'OP'|'ED', song, artists? }`, at most 4 openings and 2 endings per franchise,
  canonical season first; `artists` is absent when AnimeThemes has no performer linked (397
  of 2022 themes), which rules a song out of the who-sings-it clues but not the which-show
  one. AnimeThemes files alternate versions as a theme `group`, numbered from 1 again: a
  **dub** ("English Version - 4Kids", "Korean Version") is left out — read as the show's own,
  it put the 4Kids "One Piece Theme" among One Piece's openings — while a Japanese broadcast
  variant ("BD Version", "Repeat Show", "Yorinuki Gintama-san") is kept but ranked after the
  main sequence. Versions of one song ("movie ver.", "-Piano ver.-", "-TEKINA remix-",
  Evangelion's per-episode "Fly Me to the Moon -B22 (A-Type)-") count as ONE song (`songKey`)
  and keep the plain title, or a "which show" clue would offer a song beside its own remix. A
  null `sequence` reads as 1: K-ON!'s real OP1 is unnumbered beside a numbered variant.
- **`serializedIn` and `originalPublisher`** — the source work's magazine, and that magazine's
  publisher (Weekly Shōnen Jump → Shueisha), or a light novel's imprint (Dengeki Bunko), from
  **Wikidata** (CC0; Jikan was turned down as an unlicensed MAL scrape). Two measured traps,
  both in the query: a season item ("Attack on Titan, season 1") carries the AniList id but
  not "based on", so the query climbs part-of-the-series first; and a manga's own publisher
  list is every licensee in every country, so the magazine's publisher is read instead (light
  novels have no magazine, so their publishers are limited to Japanese ones, which yields the
  imprint). A work only attaches when its type matches AniList's `source`, and a value the
  source disagrees with itself about (Fullmetal Alchemist: Enix *and* Square Enix) is dropped.
- **`originalYear`** — when the source began, from the **source work's own AniList entry** (the
  anime's SOURCE relation, already in the cached response; one batched query). Wikidata has
  the date too and was measured worse: it disagreed by over a year on 14 of 434 shows and
  was the wrong one in every case checked (Mob Psycho 100's manga "began" in 2018, after its
  own anime). It survives only as a fallback, and AniQuiz additionally refuses a source year
  later than the premiere.

Measured on the v5 run: themes on 96% of shows, a magazine for 74% of manga, a publisher or
imprint for 71% of manga and light novels, a source year for all of them.

**Checked against MyAnimeList** (official API, comparison only — nothing from it ships) on
2026-10-18, which is where the dub, variant and K-ON! rules above came from. After them: of
2011 themes, 1949 titles appear in MAL's lists for the franchise and the other 62 are
romanization variants ("Tenchi Geshi" / "Tenchi Gaeshi") or film themes; of those with a
performer, the 247 that "differ" are MAL crediting "Alya (CV: Sumire Uesaka)" where AnimeThemes
credits the actor. Magazines: 239 of 256 agree and the rest are the same magazine renamed or
abbreviated (Jump SQ. / Jump Square, Gessan / Monthly Shōnen Sunday) or a series that later
moved. Source years: 506 exact, 14 a year apart, 4 where the pack is the right one. Two
magazines Wikidata had wrong (WataMote, Toilet-bound Hanako-kun), three with no single right
answer (web serials that moved) are in `facts/overrides.json`, and so are AnimeThemes' own
slips: five misspelt titles where MAL and the Japanese agree against it (Love Tyrant, 天地ガエシ
"Tenchi Geshi", 眠れる本能 "Nemureru Honoo", "Utatane Shunshine", "Konpeki no Alpine"), and two
soundtrack pieces it files as a first episode's "OP1" with no performer (Made in Abyss's
"Underground River", Zombie Land Saga's "Temptation from the Hell"), which put an instrumental
ahead of the real opening. That second kind can't be a rule: of the 24 shows whose first
opening has no credited performer, nearly all are the famous one ("R★O★C★K★S",
"Makafushigi Adventure") and simply lack the link. Override arrays are built by running
`themesFromAnimeThemes` over the cached records minus the bad entries, so caps and order match
what the generator would have made. An override replaces a counted fact, so the manifest's
`facts` moves only when one fills an empty field or a suppression finds something.

The generator prints the four coverage figures every run, because these sources are not ours
and a quiet drop looks like success. The new caches are per AniList id
(`animethemes-v2-<id>.json`, `wikidata-origin-v1-<id>.json`,
`anilist-source-<id>.json`), and a full pass over cold ones is a few minutes, not hours. Both services filter on **User-Agent**, which Node's `fetch` does
not send — the adapters set one, which is why they do not share AniTune's browser client.

It shipped empty at first, and the reason is worth knowing before the next 403. AniList
answers any request carrying **no `Referer`** with a 403 claiming the API is "temporarily
disabled due to severe stability issues" — it reads as an outage and is a bot filter. The
fix is `REFERER` in `anilistClient.js`, a no-op in the browser, where `Referer` is a
forbidden header name and `fetch()` sends the page's own.

**A franchise folds to one key, so assembly is first-write-wins, per field.** All six Attack
on Titan entries emit rows against `attack on titan`; last-write-wins left the identity block
saying WIT 2013 while the facts said MAPPA 2022 — one subject wearing two seasons. `collect`
emits each group's canonical season first, then the rest by air date, and groups best-ranked
first (so of two unrelated franchises folding to one title, the better-known holds the key);
"per field" lets a later season still backfill what it had no value for.

**A pack key is the SAME fold a saved profile keys on** — `franchiseTitleKey` for shows and
`characterNameKey` for characters, exactly what `anirank/utils/deck.js` computes when it
collapses a profile into cards. That identity is the whole targeting design: "only shows
this room imported" becomes a Set lookup at draw time and "any show at all" is skipping it,
so which game asks what is not decided in the data and nothing has to be regenerated to
change the answer. The keys are re-exported through `facts.js` rather than imported
directly by the generator, so the two sides cannot drift on what a key is. `anilistId` is
carried as **provenance only** — identity in this repo is deliberately not id-based, since
the ids ListManager minted for hand-entered entries and AniList's own share no id space, so
a lookup routed through it would miss every one of those still saved.

**The loader takes two fetches and the indirection is the point.** The manifest is small and
always revalidated; the pack file it names is immutable and can be cached hard. A data fix
is then "write `pack-v5.json`, change one line of `index.json`" — no app code change, no
rebuild, no redeploy of anything but those two files. A bundled `import()` of the JSON was
rejected for that reason plus one more: it is parsed as JavaScript on every load by every
player, including everyone who never opens the game.

Everything testable lives in `shared/utils/facts.js` rather than in the generator, for the
reason `prefs.js` and `fame.js` are separate from the screens that read them — logic in a
root-level script is logic with no test. **It carries explicit `.js` extensions**, unlike the
rest of the app, because `generateFacts.js` imports it under plain Node, which does not do
Vite's extensionless resolution; `franchise.js`'s import of `./ranking.js` carries one for
the same reason. That is the price of the generator and the app sharing one definition of a
key, and sharing it is exactly the point.

`facts/overrides.json` is applied **after** generation, so a regeneration can never clobber a
hand-made correction, and a `null` value there *suppresses* a fact the source got wrong.
`generateFacts.js` and `generateProfiles.js` import `anilistClient.js` directly rather than
hand-rolling a throttle — that module is plain fetch and timers and is Node-safe despite its
"for the browser" header. `generateProfiles.js` carried its own 600ms copy until it was folded
in, and a copy is how a rate-limit fix ends up applied to two callers out of three.

## External API: Wikidata

- Wikidata (`query.wikidata.org/sparql`) — generator only, never the app. CC0. Requires an
  identifying `User-Agent`, kills queries past 60s (hence 40 ids a batch: the season → series
  property path is the expensive part), and is POSTed to because the query outgrows a URL.
