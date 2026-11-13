---
paths:
  - "firebase.json"
  - ".firebaserc"
  - "hosting/**"
  - "database.rules.json"
  - ".env.local.example"
  - "workers/**"
  - "smoke/**"
---

# Firebase: hosting, deploys, the emulator

Moved from the root `CLAUDE.md`, which keeps only the pointer. `/ship` reads this before a
hosting deploy.

```bash
npx firebase emulators:start --only database,auth --project demo-aniguess
npx firebase deploy --only database    # database.rules.json
npx firebase deploy --only hosting     # dist/ — run npm run build first
```

The CLI is `firebase-tools` in devDependencies, not a global install, so a bare `firebase`
in a shell is "command not found". npm scripts are the exception — they put
`node_modules/.bin` on the PATH, which is why `test:smoke` can call it bare.

The arcade lives at **`aniarcade.web.app`**, a second Hosting site in the Firebase project
`aniguess-a08f7` (a project ID can never change, so the console, the database
`aniguess-a08f7-default-rtdb` and `.env.local`'s `*.firebaseapp.com` auth domain keep the old
name). `firebase.json`'s `hosting` is a list of two: `aniarcade` serves `dist/`, and the
project's original site `aniguess-a08f7.web.app` 301s every path there from
`hosting/old-address/` (renamed before release, so nothing was stranded). The bare `/` needs
its own redirect rule — `/:path*` does not match it, and the placeholder page served instead
would drop an invite link's query, which a redirect keeps. One deploy updates both. A new
origin the app is served from must also be in the MyAnimeList proxy's `ALLOWED_ORIGINS`
(`workers/mal-proxy/wrangler.toml`), redeployed, or that import breaks there. The proxy's own
commands are in `.claude/rules/list-import.md`.

`.env.local` (copied from `.env.local.example`) holds the `VITE_FIREBASE_*` config. When
pointing at the emulator, `VITE_FIREBASE_DATABASE_URL` must use the `-default-rtdb`
suffixed namespace — the wrong namespace connects to a rules-less database instead of the
one your rules were deployed to.
