---
paths:
  - "src/shared/hooks/useRoomCore.js"
  - "src/shared/hooks/usePresence.js"
  - "src/shared/hooks/useOnline.js"
  - "src/shared/utils/presence.js"
  - "src/shared/utils/inviteLink.js"
  - "src/shared/context/inviteContext.js"
  - "src/shared/components/RoomSetup.jsx"
  - "src/shared/components/RoomShell.jsx"
  - "src/shared/components/Lobby.jsx"
  - "src/games/**/hooks/use*Room.js"
  - "src/games/**/OnlineGame.jsx"
  - "src/games/**/components/Online*.jsx"
  - "src/games/**/rules.js"
  - "database.rules.json"
  - "smoke/**"
---

# Online rooms (Firebase Realtime Database)

Moved from the root `CLAUDE.md` so it loads only when Claude works on the files above. The
cross-game architecture it builds on is still there.

All games share one `rooms/{code}` namespace — codes are unique across the whole app, not
per game, so a new game cannot assume it has the code space to itself. A code is claimed by
a `runTransaction` on `rooms/{code}/createdAt`. Codes are 5 chars from an alphabet with
ambiguous `0/O/1/I` removed.

```
rooms/{code}/
  createdAt              claim marker
  open                   accepting joins
  memberUids/{uid}       → playerId   (the membership check every other rule reads)
  claims/{playerId}      → uid        (stops two devices claiming one seat)
  state/                 the subtree the whole room subscribes to (players, turn + score
                         state, presence/{playerId}, view/game phase)
  …                      a game may add its own sub-nodes alongside these
```

That last line is an extension point worth understanding before using it. AniGuess adds
`assignments/{playerId}`, whose security rules **deny** read and write to the assignee's
own device — that rule, not any client-side check, is the mechanism by which a player
cannot see their own character. Anything a player must not learn belongs in a sibling node
gated the same way, never inside `state/`, which every member reads in full.

There are two such nodes, and they are mirror images — pick by who must not see the value:

| node | read | write | for |
| --- | --- | --- | --- |
| `assignments/{playerId}` | everyone **except** the owner | everyone except the owner | a value about you that you alone must not learn |
| `secrets/{playerId}` | the owner **only** | any member | a value only you may learn |

`secrets/` is read by AniFake (the dealt card), AniWave (the hidden target, plus
`readroom`'s dealt card — see `src/games/wavelength/CLAUDE.md` for why the freshness check
is on the stamp rather than on the target), AniTag in `chosen` mode (the clause you picked) and
AniTurf (each team's key and traps, in its clue-giver's node). Write is any member,
not the host, because "the host" is a `state/` value the rules cannot cheaply check, and a
room's members are already trusted with everything in `state/`. AniTag and AniTurf are the
cases where the writer is the *owner* — nobody else could, since nobody else may read it.

**AniTurf goes one step further: the owner also DEALS it.** Each clue-giver's own device makes
its team's key, so no device ever holds a key it was not dealt — not even the host's, for an
instant, as AniFake's does. The price is that only that device can answer for the key, so a
claim is resolved across two devices (the claiming team's clue-giver says footing-or-not, the
other's says trapped-or-not), and a key-dealing effect must wait for the first `secrets/`
snapshot or it deals over the real key on every refresh. See `src/games/aniturf/CLAUDE.md`.

`assignments/` is read by AniGuess (the character you are guessing) and AniTag in `dealt` mode
(the category you are guessing).

**AniTag sits on BOTH rows, one mode each, which makes it the worked example** — and it earned
that by getting it wrong first: this note used to promise `secrets/` to "Categories' secret
category", and it named the wrong node. The question is never "is this a secret" but **who
must not see it**, and the two AniTag modes answer it in opposite directions:

- `dealt` — the clause is known to the whole table and hidden from exactly one person.
  `assignments/`. Written to `secrets/` it would have been visible to precisely the one player
  the mode is built around keeping in the dark.
- `chosen` — the clause is known to exactly one person and hidden from the whole table.
  `secrets/`. Written to `assignments/` it would have been readable by every single player it
  exists to be hidden from, and the round would look normal the entire time.

Ask "who is this hidden from" before reaching for either. Both mistakes are silent.

Three things AniFake learned the hard way, all of which the next `secrets/` consumer
inherits:

- **`secrets/` is a sibling of `state/`, so `useRoomCore`'s subscription never sees it.**
  The game hook needs its own `onValue` on `rooms/{code}/secrets/{myPlayerId}`.
  `useRoom.js`'s `readAssignment` is the precedent — same shape, opposite rule.
- **Stamp each card with the round, don't clear between rounds.** A clear is N writes that
  can half-fail and leave the previous answer readable; a `forRound` stamp makes a stale
  card invisible with no write at all. AniGuess's assignments do the same. A round can now
  be dealt more than once (the card check in `src/games/anifake/CLAUDE.md`), so cards carry `forDeal` as well and a
  device renders its card only when *both* match — the two writes that supersede a card are
  separate and arrive in either order, so one stamp would show the old character during the
  gap. Add a stamp, never a clear, for the same reason each time.
- **Whoever computes the deal learns it.** There is no server, so one device — the host's —
  holds the answer in the clear; keep it out of React state and `state/`. AniFake's bounded
  exceptions (`dealtRef`, `fakeRef`, `secretNamesRef`) are in `src/games/anifake/CLAUDE.md`.

Hidden-role patterns AniFake worked out, each argued in full in `src/games/anifake/CLAUDE.md`
— read it before building anything with a hidden role: **never hand the reveal to one
device** (each device publishes only its own card once the vote closes and the answer is
derived from the published set); **a vote nobody may be seen casting is one shared latch,
not a tally**, and an anonymous control must not change anything a hidden role has a stake
in; **when a rule cannot be enforced where the state lives, make what it protects
worthless**; and **a re-deal creates common knowledge the hidden role lacks — publish the
discard or it is a free detector**.

**A one-shot key must name whatever it is meant to happen once per.** `useRoomCore` clears
`reconciledRef` on a view *change*, so `once('runoff')` is latched for the life of the
`vote` view — which is exactly what caps the runoff at one. A phase that can repeat without
the view changing needs the repeating value in the key (`redeal:${round}:${game.deal}`), or
it fires once and leaves the room wedged. Host migration was the first exception; the card
check is the second. Ask which of the two you are writing before copying either.

Two things that bite every time:

- **Multi-location `update()` rules evaluate against the pre-update tree.** A batch that
  writes `memberUids` alongside paths whose rules depend on `memberUids` existing will
  fail. Write and `await` `memberUids` first.
- **RTDB does not store empty objects/arrays** — a `{}` or `[]` write simply doesn't exist
  on read-back. Every room hook must therefore normalize state at *every* entry point (the
  `onValue` subscription *and* inside transaction callbacks, which see raw stored values)
  before handing anything to `rules.js`, which calls `.includes`/`.every` unguarded.
- **An array with gaps comes back as one of three shapes.** RTDB drops null elements, so a
  partly-filled fixed-length array (AniRank's ten slots) reads back as a *sparse* array,
  or — once it is mostly empty — as an object keyed by index (`{ "5": … }`). Normalizing
  one shape is not enough, and `Array.map`/`forEach` silently **skip holes**, so a sparse
  array needs a plain index loop. `anirank/rules.js`'s `normalizeBoard` handles all three;
  copy it rather than rediscovering this.
- **Rebuilding a keyed collection from the *active* roster deletes departed players' data.**
  The active roster is the right input to readiness gates and the wrong input to anything
  that reconstructs stored state — a normalizer fed active ids drops the absent players'
  entries on the very next write, and their answers are gone by the reveal. Normalize
  against everyone in the room; filter to active only at the gate.

The room a device is in is remembered in localStorage under a per-game key
(`<game>_online_room` — per-game so two games' saved rooms can't clobber each other), so a
refresh rejoins instead of landing on the join screen. Firebase persists the anonymous uid,
so the membership rules still pass.

**Rooms are deleted, two ways, with no server of our own** (`useRoomCore.js`; the project
stays on the free Spark tier). Each room holds a full copy of every player's profile, so
before this they piled up in the 1 GB forever.

- **The last one out deletes it.** `leaveRoom` removes `rooms/{code}` when every *other*
  player's status is `left` (`isLastToLeave` in `utils/presence.js`). A player who is only
  `gone` or `dropping` crashed rather than left and may still refresh back in, so their room
  is kept. The delete goes after the presence write and after `exitRoom`, so the leaver's own
  subscription never reports "That room no longer exists".
- **The next create sweeps anything a day old.** Nothing may list `rooms/` (a read there
  cascades into every room's `secrets/`), so `createRoom` also writes
  `roomIndex/{createdAt}_{code} → code`, and the index's rules allow exactly one query: keys
  older than a day, `orderByKey().endAt(...)`. **The key carries the time as a 13-digit
  string because the rules cannot gate a number**: measured on the emulator, any rule
  comparing `query.endAt`/`startAt` to a number is refused (`query.endAt > 0` included), while
  string comparison works and equal-length digit strings sort like the numbers. The rules
  also check the key against `rooms/{code}/createdAt`, so a live room cannot be filed as a
  stale one to get it swept, and live codes stay unlistable. `createdAt` is stamped in
  SERVER time (`serverOffsetRef`), since the rules age it against the server's `now`.

`rooms/$code/.write` allows a DELETE only — by a member, or by anyone once the room is a day
old. Any member deleting the room is a wider permission than before, taken knowingly: any
member could already wipe `state/`. A presence `onDisconnect` that fires into a deleted room
is refused (the `state/` rule needs `memberUids`, which went with the room), so it cannot
leave a stub behind. Rooms created before the index existed have no entry and were removed
once by hand after the rules deploy. `smoke/cleanup.smoke.test.js` covers all of it.

**Invite links** (`shared/utils/inviteLink.js`): `/?game=<id>&join=<CODE>`. The game rides
along because codes are app-wide and a room does not record its game. `HubScreen` reads it
once, strips it with `replaceState` (so a refresh does not rejoin), skips the title screen and
opens that game; `shared/context/inviteContext.js` carries it in — and also carries the open
game's id, which is what the lobby's **Share invite** button (`Lobby.jsx`'s `RoomCode`;
`navigator.share`, else the clipboard) builds a link from. `ModePicker` routes straight to
online once (`routed`, so Back to the cover does not bounce forward), and `RoomSetup` joins
once there is a profile and `room.uid` is set — the point at which `useRoomCore` has already
restored any saved room, which then wins; leaving it brings the invite back. With no profile
it opens the picker first.

## Presence and the departed-player problem

`src/shared/hooks/usePresence.js` keeps one record alive at
`state/presence/{playerId}` using Firebase's `onDisconnect` (server-side, so no
`beforeunload` handler or heartbeat). `src/shared/utils/presence.js` is the pure half:
`rosterSnapshot` classifies each player as active / dropping / gone / left against a
20-second `GRACE_MS`, using *server* time (`Date.now() + serverTimeOffset`) so all devices
agree on the boundary.

This matters because every readiness gate ("everyone is ready", "everyone has answered",
"everyone is locked out") counts the roster — a closed tab would wedge the room forever.
Rules functions therefore take `skipIds` or an already-filtered *active* roster, and there
are dedicated escape hatches (`skipDepartedTurn`, `releaseBuzz`, `revealNow`,
`nextHostId` for host migration). Preserve this when adding room logic.

The commonest departure is not a closed tab but a phone that locked itself mid-round, which
drops the connection exactly as one does. `shared/hooks/useWakeLock.js` keeps the screen on
for as long as any game is open — one call in `HubScreen`, lobby and local play included — and
asks again each time the page comes back, since the browser releases it on every hide. Every
failure is silence; a browser without the API simply dims as before.
