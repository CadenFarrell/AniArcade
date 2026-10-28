# AniArcade

Party games built from your anime list. Import your list from AniList, MyAnimeList or Kitsu
(or upload a MyAnimeList export file), and every game deals from the shows and characters
you've actually watched. Play pass-and-play on one phone, or each on your own device in an
online room. Once it has loaded, it also works offline as an installable app.

Play it at **https://aniguess-a08f7.web.app/**.

## Games

| Game | What it is |
| --- | --- |
| **AniGuess** | Guess the anime character you were assigned by asking yes/no questions. |
| **AniTune** | Guess the anime from the sound of its opening or ending. |
| **AniRank** | Ten cards, one board. Rank them on facts, or on how someone else would. |
| **AniFake** | Everyone knows the character. One of you is faking it: find the fake. |
| **AniWave** | One of you knows where the target is. Say the right words. No list needed. |
| **AniTag** | Everyone picks a secret category. Name things until you work out somebody else's. No list needed. |
| **AniQuiz** | A trivia board built from the credits of the shows you've watched. Bet big on the Daily Double. |
| **AniTurf** | Two teams race to claim a route across a board of characters, led by one-word clues. |
| **AniPeek** | A face hides under sixteen tiles. Bid how few you need to name them, then prove it. |

Every game has a local mode and an online mode, and every finished game goes into each
player's play record. Online, the host can take the whole room on to another game from the
results screen, with no new code to share. Each game's rules are one press away under "How to
play" in the top bar, and open by themselves the first time you play it.

## Running it

```bash
npm install
npm run dev
```

Local play needs nothing else. Online rooms need Firebase: copy `.env.local.example` to
`.env.local` and fill in your Firebase web-app config (Realtime Database + anonymous auth).
With no `.env.local`, online play is switched off and local play makes no third-party
requests.

To develop online play without touching a real project, run the emulators:

```bash
npx firebase emulators:start --only database,auth --project demo-aniguess
```

When pointing `.env.local` at the emulator, `VITE_FIREBASE_DATABASE_URL` must use the
`-default-rtdb` suffixed namespace, or you get a database without your rules.
`firebase-tools` is a dev dependency, so run it as `npx firebase`, not a bare `firebase`.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint |
| `npm test` | Unit and component tests (vitest) |
| `npm run test:smoke` | Online hooks against the Firebase emulator (starts and stops it) |
| `npm run playtest` | Bots play every game start to finish in jsdom (`--game <id> --seed <n>` replays one run) |
| `npm run playtest -- --layer online` | The same, with one device per player in a room on the emulator |
| `npm run playtest -- --layer browser` | Playwright on phone and desktop sizes, with axe and layout checks |
| `npm run playtest:all` | All three layers, then the report in `playtest-report/` |
| `npm run generate` | Regenerate `seedProfiles.js` from AniList |
| `npm run generate:facts` | Regenerate the fact pack in `public/facts/` |
| `npm run generate:casts` | Regenerate the cast pack in `public/casts/` (a few minutes) |

CI runs lint, tests and the build on every push and pull request.

Deploying:

```bash
npx firebase deploy --only database   # database.rules.json
npm run build && npx firebase deploy --only hosting
```

Crash reports and player feedback are written to `reports/` in the Realtime Database, which
no client can read: read them in the Firebase console. Deploy the database rules before a
build that sends them, or every send is refused.

## Generated files

Don't edit these by hand. Regenerate them with the commands above: `seedProfiles.js`,
`public/facts/pack-*.json` and `public/casts/`. The hand-edited inputs beside them are
`animeCatalog.js` (the show list both generators read) and `facts/overrides.json`.

## Layout

```
src/
  hub/          the arcade menu; registry.js is the whole list of games
  games/<game>/ one folder per game: rules.js (pure logic), local and online hooks, screens
  shared/       UI kit, AniList and Firebase services, hooks used by every game
  index.css     design tokens (colours, type, textures)
playtest/       the bot players
smoke/          online tests against the emulator
workers/        the MyAnimeList proxy (Cloudflare Worker)
```

`CLAUDE.md` holds the architecture and the reasoning behind it.
