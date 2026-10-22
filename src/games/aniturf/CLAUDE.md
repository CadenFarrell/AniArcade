# AniTurf — design notes

Loaded when Claude works on files in this folder. The cross-game architecture these notes
build on (rules.js, online rooms, `secrets/`, presence, settings) is in the root `CLAUDE.md`.

## The game

`games/aniturf/` (id `aniturf`) is two teams claiming a route across a 5×5 board of
characters drawn from the seated players' lists. Each team's clue-giver alone sees its
**footing** — the squares the team may hold — and gives one-word clues with a number; the
team's guessers claim up to that many squares, each touching their territory or one of their
own edges. Footing sticks; anything else is scorched to rubble for **both** teams and ends the
turn. Each clue-giver also plants traps against the other team before the first clue; a trap
springs only on the other team's footing, scorches it and takes back that team's newest claim.

It is an original design, settled in a question round: the request was a word-association
team game whose rules were an existing commercial game's, card for card, so the brief became
a game in that genre with its own core loop. Keep it that way — no 9/8/7/1 key, no
instant-loss card, no "number plus one" guesses.

**Red crosses left to right, Blue top to bottom, and squares connect orthogonally.** On a
square grid with 4-way adjacency any left-right route and any top-bottom route share a square,
so every board has crossroads both teams need. That property is the game; don't add diagonal
adjacency (it breaks it — both teams could cross without meeting).

**A footing is one winding route plus `DECOYS` lone squares** (`makeFooting`). It was two
near-straight routes with no square in common, filled to twelve, and that made the clues nearly
pointless: half the board was footing, the square straight ahead of a footing square was footing
82% of the time, 85% of keys held a whole straight row, and a team that ignored every clue and
pushed in a straight line crossed in about 3 turns. Now: a route bends at least every
`MAX_RUN` (2) steps, a bend that fills a whole row is re-dealt, and decoys touch nothing else on
the key — so a lone hit says nothing about which way the route runs. Measured: ~9.7 squares,
straight-ahead 54%, no straight rows, and the clue-blind push takes ~10.6 turns, against ~11.8
for guessing at random. `rules.test.js`'s 'guessability' block simulates that push against the
real generator and pins it, so a generator change that brings the tell back fails a test.

**A cut team takes a detour; only a team with no way across at all loses** (`rerouteFooting`,
then `declareCut`). Two routes had existed so that losing a crossroads was not the game: with
one route each, whoever took the first shared square cut the other team off. Now the cut team's
key gains the cheapest route through open squares, reusing its claims and its existing footing
at no cost — it only ever ADDS squares, since a clue already given may point at one still there.
The clue-giver is told on their next clue screen (`nextDetour`, merged across detours they have
not seen; the new squares are marked NEW), and nobody else is: a public "Blue was cut" would tell
Red it had just taken a Blue square. One move can only ever cut one team — a claim or a scorch
hurts the other side, a sprung trap hurts the mover — so "both cut" never happens.

**Moving first is paid back by the opening clue, which allows one claim** (`clueLimit`,
`OPENING_CLUE`); both teams plant the same number of traps. The keys themselves are even —
Blue's is Red's generator transposed, and a gap in route length decided nothing (the shorter
route won 49–52% at every gap) because games turn on the crossroads. Who moves first did. A
simulation copying the real generator, 20,000 games a setting, perfect and 60–75% guessing:

| rule | first team wins |
| --- | --- |
| nothing (traps off, so no extra trap either) | 54–59% |
| second team plants one extra trap (the old rule) | 46–48% — overshot |
| opening clue capped at one claim, equal traps | 48–51%, traps on or off |

"Opening" means no clue in the log yet, not an empty log: a clue-giver handing over during
planting logs first. `ClueForm` takes the limit as `max` and its status line says why, or a
stepper stuck at 1 reads as broken.

## Online: nobody deals a key but its owner

Each key is known to one person and hidden from everyone else, the owner's own guessers
included, so it lives in `secrets/{clueGiverId}` (owner-read). Unlike AniFake, where the host
computes every card, **each clue-giver's own device makes its team's footing** and writes its
own node, so no other device — the host's included — ever holds it. Traps go into the same
node.

The cost is that only that device can answer for it, so **a claim is resolved across two
devices**: a guesser's transaction puts it in `state/game/pending` (one at a time); the
claiming team's clue-giver device answers footing-or-not (a miss resolves there); on footing,
the other clue-giver's device answers trapped-or-not and resolves. Each clue-giver device also
runs `routeAlive` on its own key after every move: a cut it can route around becomes a detour
written to its own `secrets/` node (no `state/` write at all), and only a cut with no way across
is declared to the room. The one-shots
are keyed on what they happen once per — `foot:${round}:${seq}`, `cut:…:${marks}` — because the
view stays `play` for the whole game and `useRoomCore` only re-arms on a view change.

**The key-dealing effect waits for the first `secrets/` snapshot** (`secret.loaded`). It
writes a key whenever it finds none, so acting on the empty pre-snapshot value would deal a
second key over the real one on every refresh.

**A clue-giver who leaves is replaced, and their key with them.** `promoteGiver` hands the
crown to the next teammate still here and bumps `keyStamp[team]`; the stale key fails the stamp
check, and the heir's device deals `rebuildFooting` — a key that agrees with everything the
table has seen (every claim is footing, every scorch is not). The departed giver's traps are
lost: they lived on a device that is gone, and the screen says so. A team left with no guesser
forfeits.

## Screens

`TurfBoard` is every screen's board, in `view`, `pick` ("Pick <name>" buttons for squares the
team can reach) or `plant` ("Trap <name>") mode, with `keyView` only ever on the clue-giver's
own screen. A claim is pick-then-Claim, so a stray tap on a phone highlights rather than
scorches. **The guessing screen puts the board straight under its heading and pins Claim / End
turn, with the clue, in a `StartBar`** — with the team rows and clue bubble above the board, a
phone had the board ~680px down and Claim ~1,200px down, so every claim meant scrolling twice.
The team rows sit under the board now, on every screen, and the clue form (word, squares, Give
the clue) is pinned the same way, its refusal reason the bar's status line. A square the team
cannot reach this turn takes a dashed rule — a shape, since without portraits a lighter border
was the only difference. Wherever a key is shown, a legend under the board says what the ring,
the skull and NEW mean. The board is `max-w-md`: at `max-w-xl` it ran past an 800px laptop
window. Text on a team header sits on a solid
patch of the team's ink, never straight on its texture (the stripes took it to ~3.4:1, and axe
cannot measure text over a background image). Teams have their own tokens (`team-red`, `team-blue` — not pop-red/pop-blue, which
mean wrong and asking) and each also carries a texture (hatch / screentone) and letter, so a
claim is never colour alone. The game's accent is the decorative `plum`.

Locally the impact frame sits at one fixed place in `LocalRound`'s tree across every screen:
the claim that ends a turn is followed straight away by the next handoff, and a fresh
`ResultImpact` per screen would replay the last result whenever the screen changed. Online,
each phone stamps its own team's results and hears the other team's as `reveal`.

**The results reveal both keys** (`publishKey`, `TurfBoard`'s `reveal`): each team's footing as an
outlined letter, each planted trap as a skull in its ink — where the routes really ran is the
recap a table argues over. Locally `LocalRound` hands the keys over with the game; online each
clue-giver's phone publishes its own once the phase is `over` (only the owner can read it — the
`publishCard` pattern), and a team whose clue-giver has left stays unrevealed, which the screen
says only for a giver who has actually gone, since a reveal lands a moment after it opens.

Words the playtest strategy (`playtest/strategies/aniturf.js`) and `AniTurfGame.test.jsx`
press: "I'm <name> — show me", "Trap …", "Plant traps (n/n)", "Got it", the "Clue" textbox,
"Give the clue", "Pick …", "Claim …", "End turn", "See results", "Move <name> to Red/Blue",
"Make <name> clue-giver".
