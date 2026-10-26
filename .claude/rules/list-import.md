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

## Any tracker, one profile shape

A player imports from **AniList, MyAnimeList, Kitsu, or a MAL-format export file**, and every
game works from any of them, in a room where each player used a different site.
`ListImport.jsx` is the screen, `services/listSources.js` the network half,
`utils/listImport.js` the pure half.

**Another site only ever says WHICH shows; everything else comes from AniList.** Each source
reduces to AniList or MAL ids, `fetchMediaByIds` (`anilist.js`) hydrates them via `id_in` /
`idMal_in` in pages of 50, and every path builds entries with the same `toListEntry`
(`anilistFormat.js`), then the unchanged import (`groupIntoFranchises`, the checklist, the
character fetch, `mergeAnimeIntoProfile`). So **no game or room hook knows sources exist**. The
obvious alternative fails silently: every cross-player match is by fold, and MAL's data does not
fold to AniList's (other English titles, "Last, First" names, scores out of 10) — a MAL player
and an AniList player would share no shows, and nothing would look broken.

- Shows AniList has no entry for are **counted (`unmatched`) and shown**, or a shorter list reads
  as a failed import. Kitsu prefers its `anilist/anime` mapping, then `myanimelist/anime`.
- **MyAnimeList's API sends no CORS headers** (none on any response, 405 on preflight), so
  `workers/mal-proxy` — a one-route Cloudflare Worker, client id as a secret — answers with MAL
  ids and statuses only. With `VITE_MAL_PROXY_URL` unset the MAL tab asks for the export file,
  and an unreachable proxy offers the file from the error screen. Kitsu needs nothing.
- **Where a list came from is `listSource: { site, username? }`** via `listSourceOf`. Older
  profiles carry only `anilistUsername`, still read (and written for AniList), not migrated.
  `anilistImportedIds`/`anilistImportSettings` keep their names because they are still true after
  hydration. Every Refresh gates on `canRefreshList`, so a file profile or a MAL profile with no
  proxy never offers a refresh that would only open an upload box.

## Re-imports repair saved characters

**`addOrBackfillCharacter` is the only way a re-import repairs a saved character** — before it,
any already-stored folded name was skipped and frozen at its import vintage. It follows
`backfillStats`' rule (fill absent fields, never overwrite, `== null` so a real `0` counts) and
returns a NEW object, because `mergeAnimeIntoProfile`'s `[...a.characters]` is shallow and the
objects are still the ones `ProfileProvider` holds in state.

Repairs count as `updatedChars`, apart from `addedChars` — "+0 characters" reads as a failure.
`classifyImportGroups`' `'stale'` state (every member fetched, no saved character carries
`favourites`) makes the checklist suggest those shows. Key it on **none** of the cast having it,
never "any lacks it": a fetch returns MAIN plus SUPPORTING above the favourites threshold, so a
minor character can never be filled and "any" would re-suggest the show forever. After a repair,
`preferred` falls through to `favourites` only when portrait and genres tie, so an older copy can
still win across players.

## Nothing on a list is typed in by hand

A made-up character had no portrait, `favourites` or id — the tiles skipped it, AniFake's fame
ranked it unknown, the pack could not cover it, and nobody else could recognise it. So shows come
from `AnimeSearch.jsx` (AniList `searchAnime`, added through `importGroups.js`'s
`buildImportedAnime`, the same cast fetch and filter as `ListImport`) or an import. A cast is not
editable (the tracker is where a list changes, then Refresh). The one edit is **deleting a whole
show**, because a refresh only ever adds. Hand-made entries already saved stay, and so does every
reader of their shape (`CharacterReveal`'s hair and ability rows); don't add a hand-entry or
cast-editing path back.

## APIs and the proxy

- Kitsu (`kitsu.app/api/edge`, JSON:API, no auth, `Access-Control-Allow-Origin: *`):
  `filter[userId]` on `library-entries` with `include=anime.mappings`, following `links.next`.
  Users are looked up by `filter[slug]`, then `filter[name]` — plenty never set a slug.
- MyAnimeList, through the worker only: `/v2/users/{name}/animelist` with `X-MAL-CLIENT-ID`, one
  request per status (MAL's filter takes one); a 403 (private) and a 404 both become "not found".

```bash
cd workers/mal-proxy
npx wrangler dev --port 8788            # local; needs MAL_CLIENT_ID in .dev.vars
npx wrangler secret put MAL_CLIENT_ID   # one time, from myanimelist.net/apiconfig
npx wrangler deploy                     # then set VITE_MAL_PROXY_URL and rebuild
```

`wrangler` is a devDependency (like `firebase-tools`, so not bare on the PATH) and runs on
Workers' free tier, which takes no card.
