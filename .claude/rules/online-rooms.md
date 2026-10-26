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

`useRoomCore` and its options are in the root `CLAUDE.md`.

## The tree, and where a hidden value goes

Codes are app-wide — every game shares `rooms/{code}` — claimed by a `runTransaction` on
`rooms/{code}/createdAt`; 5 chars, no `0/O/1/I`.

```
rooms/{code}/
  createdAt              claim marker
  open                   accepting joins
  memberUids/{uid}       → playerId   (the membership check every other rule reads)
  claims/{playerId}      → uid        (stops two devices claiming one seat)
  state/                 what the whole room subscribes to (players, turn + score
                         state, presence/{playerId}, view/game phase)
  …                      a game may add its own sub-nodes alongside these
```

Every member reads `state/` in full, so anything a player must not learn goes in a sibling
node whose **security rule** — not a client check — hides it. Pick by who must not see it:

| node | read | write | for | used by |
| --- | --- | --- | --- | --- |
| `assignments/{playerId}` | everyone **except** the owner | everyone except the owner | a value about you that you alone must not learn | AniGuess (your character), AniTag `dealt` |
| `secrets/{playerId}` | the owner **only** | any member | a value only you may learn | AniFake (your card), AniWave (target, `readroom`'s card — see its CLAUDE.md), AniTag `chosen`, AniTurf (each team's key, in its clue-giver's node) |

`secrets/` write is any member, not "the host", because the host is a `state/` value the rules
cannot cheaply check and members are already trusted with `state/`. AniTag and AniTurf write
their own node; **AniTurf's owner also DEALS it**, so no device ever holds a key it was not
dealt — at the price that a claim resolves across two devices, and the dealing effect must wait
for the first `secrets/` snapshot or it deals over the real key on every refresh
(`src/games/aniturf/CLAUDE.md`).

**AniTag is the worked example, on both rows:** `dealt` (known to the table, hidden from one) is
`assignments/`; `chosen` (known to one, hidden from the table) is `secrets/`. Each in the other
node would expose it to exactly the people it is hidden from, and the round would look normal.
Ask "who is this hidden from" before reaching for either — both mistakes are silent.

What every `secrets/` consumer inherits from AniFake:

- **`useRoomCore`'s subscription never sees `secrets/`** (a sibling of `state/`): the game hook
  needs its own `onValue` on `rooms/{code}/secrets/{myPlayerId}` (`useRoom.js`'s
  `readAssignment` is the same shape).
- **Stamp each card, never clear between rounds.** A clear is N writes that can half-fail and
  leave the old answer readable; a stamp makes a stale card invisible with no write. Cards carry
  `forRound` and `forDeal` (a round can be re-dealt) and render only when BOTH match, because the
  two superseding writes arrive in either order.
- **Whoever computes the deal learns it.** With no server the host holds the answer in the
  clear; keep it out of React state and `state/` (AniFake's bounded `dealtRef`, `fakeRef`,
  `secretNamesRef` are in `src/games/anifake/CLAUDE.md`).

Hidden-role patterns, each argued in `src/games/anifake/CLAUDE.md` — read it before building
one: never hand the reveal to one device (each publishes only its own card once the vote
closes); a vote nobody may be seen casting is one shared latch, not a tally; when a rule cannot
be enforced where the state lives, make what it protects worthless; a re-deal creates common
knowledge the hidden role lacks, so publish the discard.

**A one-shot key must name whatever it happens once per.** `useRoomCore` clears
`reconciledRef` on a view *change*, so `once('runoff')` latches for the life of the `vote` view
— which is what caps the runoff at one. A phase that repeats without the view changing needs
the repeating value in the key (`redeal:${round}:${game.deal}`) or it fires once and wedges the
room. Host migration and the card check are the two such cases so far.

## RTDB traps

- **Multi-location `update()` rules evaluate against the pre-update tree**, so a batch writing
  `memberUids` beside paths whose rules need it fails. Write and `await` `memberUids` first.
- **Empty objects/arrays are not stored**, so every room hook normalizes at EVERY entry point —
  the `onValue` subscription *and* inside transaction callbacks (raw stored values) — before
  `rules.js`, which calls `.includes`/`.every` unguarded.
- **An array with gaps comes back sparse, or as an object keyed by index** once mostly empty,
  and `map`/`forEach` skip holes. Copy `anirank/rules.js`'s `normalizeBoard`, which handles all
  three shapes with a plain index loop.
- **Normalize against everyone in the room, never the active roster.** Fed active ids, a
  normalizer drops departed players' entries on the next write and their answers are gone by
  the reveal. Filter to active only at the gate.

## Saved rooms, deletion and invites

The room a device is in is saved under `<game>_online_room`, so a refresh rejoins; Firebase
persists the anonymous uid, so the membership rules still pass.

**Rooms are deleted with no server of our own** (free Spark tier; each room copies every
player's profile):

- **The last one out deletes it** — `leaveRoom`, when every OTHER player is `left`
  (`isLastToLeave`). `gone`/`dropping` players crashed and may refresh back, so their room is
  kept. The delete runs after the presence write and `exitRoom`, so the leaver never sees "That
  room no longer exists".
- **The next create sweeps anything a day old.** Nothing may list `rooms/` (it would cascade
  into every `secrets/`), so `createRoom` also writes `roomIndex/{createdAt}_{code} → code`,
  whose rules allow exactly `orderByKey().endAt(...)` over keys older than a day. The time is a
  13-digit STRING because the rules refuse any comparison of `query.endAt`/`startAt` to a number
  (measured), while equal-length digit strings sort like numbers. The rules check the key against
  `rooms/{code}/createdAt`, so a live room cannot be filed as stale, and `createdAt` is SERVER
  time (`serverOffsetRef`) because the rules age it against the server's `now`.

`rooms/$code/.write` allows only a DELETE — by a member, or anyone once a day old (a member could
already wipe `state/`). A presence `onDisconnect` into a deleted room is refused, since
`memberUids` went with it, so no stub is left. `smoke/cleanup.smoke.test.js` covers this.

**Invite links** (`inviteLink.js`): `/?game=<id>&join=<CODE>` — the game rides along because a
room does not record it. `HubScreen` reads it once, strips it with `replaceState`, skips the
title and opens the game; `inviteContext.js` carries it in, plus the open game's id that the
lobby's **Share invite** (`navigator.share`, else clipboard) builds from. `ModePicker` routes to
online once (`routed`, so Back does not bounce forward); `RoomSetup` joins once there is a
profile and `room.uid` is set — after `useRoomCore` restored any saved room, which wins. With no
profile it opens the picker first.

## Presence and the departed-player problem

`usePresence.js` keeps `state/presence/{playerId}` alive with `onDisconnect` (server-side: no
`beforeunload`, no heartbeat). `utils/presence.js`'s `rosterSnapshot` classifies each player
active / dropping / gone / left against a 20s `GRACE_MS` in SERVER time
(`Date.now() + serverTimeOffset`), so every device agrees on the boundary.

Every readiness gate counts the roster, so a closed tab would wedge the room forever: rules
functions take `skipIds` or an already-active roster, with escape hatches `skipDepartedTurn`,
`releaseBuzz`, `revealNow` and `nextHostId` (host migration). Preserve this in new room logic.
