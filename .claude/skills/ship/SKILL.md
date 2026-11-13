---
name: ship
description: Check, commit, push and deploy finished AniArcade work — lint, tests and build must pass, only this session's changes are committed (others may share the tree), CI is confirmed, and only what changed is deployed. Use when work is done and should go live, or when asked to commit, push, ship or deploy.
---

# Ship finished work

The standing permission is: when everything is green and nothing is unresolved, commit,
PUSH and deploy without asking, then report briefly. Anything red or unexplained means
stop and report instead.

## 1. Know what is yours

`git status --short`. Other sessions and the user edit and commit this tree at the same
time. List the paths THIS session changed. A path with a letter in the FIRST column that is
not yours is someone else's staged work — plain `git add` + `git commit` would sweep it in.

## 2. Green gate

```bash
npm run lint && npm test && npm run build && npm run size
```

Plus whichever the change touches: `npm run test:smoke` (room hooks, `database.rules.json`,
`smoke/`) and `npm run playtest -- --game <id>` (screens, headings, button words). Before
either, check no other session holds the emulator ports (9000/9099/4400) or playtest ports
(4198/4199); wait for their run, never kill it. AniRank/AniName smoke flakes in a full run
and passes alone — rerun that file alone before calling it a failure.

A lint error in a file someone else is mid-edit on is not yours: check `git status` first.

## 3. Commit only your hunks

If nobody else has changes in the tree, a normal `git add <your paths>` + commit is fine
(check `git diff --cached --stat` BEFORE committing). Otherwise use a temp index:

```bash
OLD=$(git rev-parse HEAD)
export GIT_INDEX_FILE=$(mktemp)          # use the scratchpad dir, not /tmp
git read-tree "$OLD"
# for each of YOUR files: blob of your version (if another session also edited the file,
# build it from `git show HEAD:<path>` with only your edit applied)
git update-index --add --cacheinfo 100644,$(git hash-object -w <path>),<path>
TREE=$(git write-tree)
NEW=$(git commit-tree "$TREE" -p "$OLD" -F <message-file>)
unset GIT_INDEX_FILE
git update-ref HEAD "$NEW" "$OLD"        # fails if someone committed meanwhile: redo on the new HEAD
git reset -q -- <your paths>             # sync the real index so they don't show as staged reverts
```

Message style: the repo's own — an imperative sentence saying what a player or developer
gets ("Let AniDraft's host write their own roles and pick the deck"), a blank line, then a
body explaining why when it isn't obvious. **No `Co-Authored-By` or "Generated with"
lines, ever.** Split unrelated work into separate commits.

## 4. Push and confirm CI

```bash
git push
SHA=$(git rev-parse HEAD)
curl -s "https://api.github.com/repos/CadenFarrell/AniArcade/actions/runs?head_sha=$SHA" \
  | grep -E '"(status|conclusion|html_url)"' | head -3
```

`gh` is not installed. CI takes a few minutes; poll with a Monitor/until-loop, not a sleep. A
red CI is a stop: read the log (`html_url`), fix, ship again. Remember CI is Linux and
case-sensitive.

## 5. Deploy only what changed

Decide from `git diff --name-only <last deployed>..HEAD` — or this ship's commits:

| changed | deploy |
| --- | --- |
| anything the built app ships (`src/`, `public/`, `index.html`, `sw/`, `vite.config.js`, `package.json` deps) | hosting |
| `database.rules.json` | `npx firebase deploy --only database` |
| `workers/mal-proxy/` | `npx wrangler deploy` from that folder |
| only docs, tests, `playtest/`, `smoke/`, `.claude/`, generators | nothing |

**Hosting is built from a clean checkout of the commit, never from the main tree** (it may
hold another session's unfinished work, and `.env.local` must be the production one):

```powershell
git worktree add --detach $wt HEAD
New-Item -ItemType Junction -Path "$wt\node_modules" -Target "$PWD\node_modules"
Copy-Item .env.local "$wt\.env.local"
# in $wt: npm run build; npx firebase deploy --only hosting
cmd /c rmdir "$wt\node_modules"          # FIRST: removes only the link
git worktree remove --force $wt          # before this, or git deletes real packages through the junction
```

If the main tree is clean and has no one else's changes, building and deploying from it is
fine. If a deploy command is blocked, tell the user; don't work around it.

Afterwards confirm the live site answers: `curl -sI https://aniarcade.web.app/ | head -1`.

## 6. Report, briefly

What changed, that the checks passed, the commit hash(es), CI's result and what was deployed.
Check every ask from the task against what shipped and say plainly that each one is done —
or name what isn't.
