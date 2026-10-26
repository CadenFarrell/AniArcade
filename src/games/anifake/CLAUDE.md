# AniFake — design notes

Loaded when Claude works on files in this folder. Moved from the root `CLAUDE.md`, which
still holds the cross-game architecture these notes build on.

## The deal, and what the host may hold

- **Whoever computes the deal learns it.** There is no server, so one device — the host's —
  holds the answer in the clear. `dealRoles` returns it and `startGame` destructures only
  what the check phase needs, so the secret character never reaches React state or the room.
  There are **two** exceptions, both deliberate, both bounded the same way — host device
  only, never React state, never `state/`, cleared the moment the view leaves `check`, lost
  entirely by an incoming host on migration — and both gated on `allowRedeal`, so a table
  with the card check off keeps the one-function-call ceiling:

  | ref | holds | so that |
  | --- | --- | --- |
  | `dealtRef` | the folded names dealt this round | a re-deal can't hand back the card the table just rejected |
  | `fakeRef` | **who the fake is** | a re-deal keeps them in the role (`dealRoles`' `pinFake`) |
  | `secretNamesRef` | each secret in display casing | the next deal can publish the discards (see below) |

  `secretNamesRef` is not a third concession: `dealtRef` already holds the same characters
  folded, and a folded name *is* the name. It is separate only because `dealtRef` also carries
  decoys and feeds an id comparison.

  `fakeRef` is the larger concession and should be read as one: `dealtRef` holds a character
  that in blind mode is already printed on the host's own card, while this holds a fact no
  player is ever meant to learn. It is taken because without it the re-deal answered two
  different things — a bad draw, and *a role you didn't want* — and since nobody is told who
  asked, a fake could veto their way out undetectably. Every serverless alternative was
  worse: `secrets/{playerId}` is read-gated to its owner so the host can't recover last
  deal's fake from the room; a public seed or a `state/` field publishes it to everybody;
  per-device role bits still leave the host deciding who gets a null character; and choosing
  the fake only when the check ends means the fake spent the check holding the secret.
  Moving the deal into a Cloud Function is the real fix, and it is the fix for both.

**Do not hand the reveal to one device.** The obvious design makes the host publish the
answer key at the end; it breaks when the host *is* the hidden role and breaks worse when
they leave mid-round. AniFake instead has every device publish only *its own* card once the
vote closes (`state/game/reveal/{playerId}`) and derives the answer from the published set —
so nothing about the secret exists in `state/` until it is over, no device is trusted with
more than it was dealt, and a player who left is identified by elimination rather than
wedging the room. See `anifake/rules.js`'s `publishCard` / `deriveTruth`.

**A vote nobody may be seen casting is one shared flag, not a tally.** AniFake's pre-clue
card check lets anyone ask for a fresh character, and the fake — who in blind mode holds no
character at all — must not be forced to bluff about a card they cannot see. So `state/`
records only *that* someone responded (`check/responded/{playerId}`, identical for a
confirmer and an asker) plus one owner-less `check/asked` boolean every asker writes the
same `true` to. There is no count, no array, no per-player value: the property is that the
information does not exist, not that no screen renders it. The hook then returns a phase
*string* rather than `asked`, so a component cannot leak the correlation by accident. Copy
all three parts — no per-player record, one shared latch, a derived phase at the hook
boundary — for any hidden-role decision the room has to make collectively. Two limits worth
stating out loud rather than papering over: a member watching raw RTDB can correlate the
latch flipping with whoever responded just before it, and at three players a confirmer who
sees a re-deal knows one of the other two asked. Say "nobody is *told* who asked".

And note what that anonymity costs on the other side, because it is the half that got missed
first: a control nobody can be seen using is a control nobody can be held to, so it must not
change anything the presser has a stake in. The re-deal used to pick a new fake as well as a
new secret, which made one anonymous button answer both "this card is unplayable" and "I
don't want this role" — so the fake could veto their way out, undetectably, for free. Hence
`dealRoles`' `pinFake`. Give any anonymous action the same audit: list what it changes, and
check that none of it is something a hidden role would want changed.

**The blind fake cannot ask at all, and that gate is client-side by necessity.** They hold no
character, so there is nothing for them to fail to recognise, and a fake who pressed it could
be asked afterwards to justify not knowing a card they never saw — the very thing the shared
latch exists to prevent. `state/` never records who the fake is, so `rules.js` cannot enforce
this and `respondToCheck` still accepts `asked: true` from anyone; both screens gate on
`card.isFake` instead (only ever true in blind — the decoy fake keeps the button, since a
missing control on a card they are never told differs would be the tell that mode forbids).
**`pinFake` is what makes a presentational gate sufficient**: a hacked client that asks anyway
is re-dealt and is still the fake, so defeating the check wins nothing. When a rule cannot be
enforced where the state lives, make the thing it protects worthless instead.

One consequence, recorded rather than designed around: once the fake cannot ask, "I asked for
the re-deal" becomes a claim of innocence — and an unfalsifiable one, since several players
can ask and the latch merely ORs them, so two people claiming it contradicts nothing. Expect
every fake to claim it, which is why it is worth nothing.

**A re-deal creates common knowledge the hidden role does not share — publish it or it is a
free detector.** The crew all saw the discarded character; the blind fake never did. So
"everyone name the one we threw out" catches them with certainty, costs the table nothing, and
has nothing to do with how they played — a detector the card check *invented*, absent from any
round with no re-deal, and one `pinFake` sharpened (before it, a re-deal re-rolled roles, so
the new fake had often seen the discard). The fix is to stop it being secret: `dealRoles`
stamps every card with `discarded`, the fake's included, and `SecretCard` renders it in both
branches and in `compact`, since the clue phase is when a table would ask. Giving it away costs
nothing — a character that is definitively *not* the answer, out of hundreds. Decoy mode cannot
have this: its fake discarded a *different* character, so one shared list would tell them their
card differs. That mode keeps the detector and only copy can help it. Whenever a hidden-role
game lets state be replaced mid-round, ask what the discard proves.

## Fame: favourites coverage

Character `favourites` needs more care than the show-level stats, and AniFake's
`utils/pool.js` is the worked example. `collapseCharacters` writes `favourites ?? 0`, so
missing and genuinely-zero are the *same value* by the time anything reads it. **An
unmeasured character therefore reads as "nobody has heard of them" rather than "we don't
know", and there are three coverage cases, not two:**

| coverage | what a naive quantile does |
| --- | --- |
| none | median is 0, `fav >= 0` admits everybody — the setting does nothing |
| **partial** | ranks the measured few, so "top 15%" becomes 15% *of the imported fifth* — the round deals the same three characters forever, and nothing looks wrong |
| full | correct |

The partial case is the dangerous one because a signal technically exists, so any
`some(fav > 0)` check reports healthy. `fameFloor` handles all three in one place: it ranks
**only the entries carrying a positive count**, and returns `null` both when none do and when
fewer than `MIN_FAME_COVERAGE` of the pool do. One null, one degraded path — the fame term
zeroes out and the role ladder runs, which is why the bias must stay a *preference* (a
weighted score, never a filter). `hasFameSignal` is defined as `fameFloor(pool, 0) != null` so
the screens and the pick cannot drift about what "no data" means.

Two things the screens must then say, because neither is inferable from the pick:
`hasAnyFameData` (ungated) separates "never fetched" from "fetched patchily" — only the second
is worth importing for — and `famousCount` reports what the level actually leaves, since a
level can be perfectly valid and still narrow a small shared list to two characters. Warn,
never gate: a small famous set is a real answer to what the user asked for, and silently
overriding a setting someone just picked is what makes one feel broken.
