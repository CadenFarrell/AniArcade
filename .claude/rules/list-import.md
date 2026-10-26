---
paths:
  - "src/shared/components/ListImport.jsx"
  - "src/shared/components/AnimeSearch.jsx"
  - "src/shared/components/ListManager.jsx"
  - "src/shared/services/listSources.js"
  - "src/shared/services/anilist.js"
  - "src/shared/services/importGroups.js"
  - "src/shared/utils/anilistFormat.js"
  - "src/shared/utils/listImport.js"
  - "src/shared/utils/profileMerge.js"
  - "src/shared/utils/franchise.js"
  - "workers/**"
---

# List import and sources

Moved from the root `CLAUDE.md` so it loads only when Claude works on the files above. The
cross-game architecture it builds on is still there.

## Commands: the MyAnimeList proxy

MyAnimeList proxy (MAL imports by username only — see "List sources" below):

```bash
cd workers/mal-proxy
npx wrangler dev --port 8788            # local; needs MAL_CLIENT_ID in .dev.vars
npx wrangler secret put MAL_CLIENT_ID   # one time, from myanimelist.net/apiconfig
npx wrangler deploy                     # then set VITE_MAL_PROXY_URL and rebuild
```

`wrangler` is a devDependency for `firebase-tools`' reason. It runs on Cloudflare Workers'
free tier, which takes no card — the project stays off anything billable.

## Re-imports repair saved characters

**A re-import only repairs a saved character because `addOrBackfillCharacter` makes it, and
that is recent.** Until it existed the merge early-returned on any character whose folded name
was already stored, so the fetch pulled correct data and dropped it — every field of a saved
character was frozen at its import vintage forever, and profiles imported before `favourites`
existed could never gain it no matter how many times you re-imported. The backfill follows
`backfillStats`' rule (fill absent fields, never overwrite one already there, `== null` so a
real `0` counts as an answer) and returns a NEW object, because
`mergeAnimeIntoProfile`'s `characters: [...a.characters]` is shallow — the character objects
are still the ones `ProfileProvider` holds in React state.

Repairs are counted as `updatedChars`, apart from `addedChars`: a repair run on a list you
already have adds nothing, and a screen reporting "+0 characters" reads as a failed import.
`classifyImportGroups` gains a matching `'stale'` state — every member fetched, but no saved
character carries `favourites` — so the checklist suggests exactly those shows instead of
calling them `known` and hiding them. Key it on "**none** of the cast has it", never "any lacks
it": a fetch returns only MAIN plus SUPPORTING above the favourites threshold, so a supporting
character under it can never be filled and "any" would re-suggest that show forever.

A secondary effect worth knowing when coverage still looks patchy after a repair: `preferred`
only falls through to `favourites` when portrait and genres tie, so across players a
re-imported copy can still lose to an older one.

## Nothing on a list is typed in by hand

**Nothing on a list is typed in by hand any more.** ListManager used to take a free-text
show title and a character form (name, hair colour, ability, one genre). A made-up character
had no portrait, no `favourites` and no AniList id, so the hub tiles skipped it, AniFake's
fame setting ranked it unknown, the fact pack could not cover it, and nobody else at the
table could recognise it; a typed show had no cast or stats at all. Both were replaced by
`shared/components/AnimeSearch.jsx`, which searches AniList (`searchAnime`) and adds the real
show through `shared/services/importGroups.js`'s `buildImportedAnime` — the same cast fetch and
filter `ListImport` runs, so a searched show and an imported one cannot differ. A cast is not
editable either — the tracker is where a list changes, then Refresh — and the one edit left
is **deleting a whole show**, which stays because a refresh only ever adds
(`mergeAnimeIntoProfile` never removes): without it a show dropped on the tracker, a searched
show added by mistake or an old hand-made entry could never leave a profile. Hand-made
entries already saved are left in place (the `aniguess_profiles` rule) and every reader of
their shape stays, `CharacterReveal`'s hair and ability rows included; don't add a hand-entry
or cast-editing path back.

## List sources: any tracker, one profile shape


A player imports from **AniList, MyAnimeList, Kitsu, or a MAL-format export file** (which
Kitsu, Simkl and most other trackers can write), and every game works from any one of them —
including a room where each player used a different site. `shared/components/ListImport.jsx`
is the one screen; `shared/services/listSources.js` the network half; `shared/utils/listImport.js`
the pure, tested half.

**The invariant: another site only ever says WHICH shows you watched. Everything else comes
from AniList.** Each source reduces to AniList or MAL ids; `fetchMediaByIds` (`anilist.js`)
hydrates them through AniList's `id_in` / `idMal_in` in pages of 50; and every path — the
AniList list query included — builds its entries with the same `toListEntry`
(`anilistFormat.js`). From there it is the unchanged import: `groupIntoFranchises`, the
checklist, the character fetch, `mergeAnimeIntoProfile`. So a MAL player's profile is the
same shape as an AniList player's, down to the `anilist_anime_<id>` ids AniTune's exact
AnimeThemes lookup needs, and **no game or room hook knows sources exist.** That is what makes
a mixed room work, and it is worth knowing why the obvious alternative fails: every
cross-player match in the arcade is by fold (`franchiseTitleKey`, `characterNameKey`), and
MAL's own data does not fold to AniList's — different English titles, character names
written "Last, First", scores out of 10. Built from MAL's data, a MAL player and an AniList
player would share no shows at all, and nothing would look broken.

Shows a site lists that AniList has no entry for are **counted, not dropped silently**
(`unmatched`), and the screen says how many — a list that comes back shorter than the one on
the site reads as a failed import otherwise. Kitsu prefers its `anilist/anime` mapping and
falls back to `myanimelist/anime`; an entry with neither is unmatched.

**MyAnimeList's API sends no CORS headers** (measured: no `Access-Control-Allow-Origin` on
any response, a 405 on the preflight), so no page can call it. `workers/mal-proxy` is a
one-route Cloudflare Worker that does, with the client id as a secret, and answers with MAL
ids and statuses only. With `VITE_MAL_PROXY_URL` unset — a fork, or before the worker is
deployed — the MAL tab asks for the export file instead, and a proxy that cannot be reached
offers the file from the error screen. Kitsu sends `Access-Control-Allow-Origin: *` and needs
nothing.

**Where a list came from is `listSource: { site, username? }`**, read through
`listSourceOf`. Profiles from before it carry only `anilistUsername`, and that key is still
read (and still written for AniList) rather than migrated — the `aniguess_profiles` rule.
`anilistImportedIds` and `anilistImportSettings` keep their names because they are still
true whatever the source: the ids are AniList's after hydration, and the settings drive
AniList's character fetch. Every Refresh button gates on `canRefreshList`, so a file-based
profile (nothing can re-read a file the player has not chosen again) and a MAL profile with
no proxy never offer a one-tap refresh that would only open an upload box.

## External APIs

- Kitsu (`kitsu.app/api/edge`, JSON:API) — public, no auth, `Access-Control-Allow-Origin: *`.
  `filter[userId]` on `library-entries` with `include=anime.mappings`, followed by
  `links.next`. Users are looked up by `filter[slug]`, then `filter[name]`: plenty of
  accounts never set a slug.
- MyAnimeList — only through `workers/mal-proxy` (no CORS on MAL's API; see "List sources").
  The worker reads `/v2/users/{name}/animelist` with `X-MAL-CLIENT-ID`, one request per status
  (MAL's filter takes one), and maps MAL's 403 (private list) and 404 to one "not found".
