# Smoke tests — the online half

Loaded when Claude works on files in this folder. Moved from the root `CLAUDE.md`, which
still holds the cross-game architecture these notes build on.

`smoke/` is the online half, and it is kept out of `npm test` on purpose: it needs an
emulator and sits out the 20s `GRACE_MS` again and again. It has its own
`smoke/vitest.config.js`, and `test:smoke` wraps it in `firebase emulators:exec`, so each
run gets a fresh database. `harness.js` mounts the game's REAL online hook once per
simulated device with `renderHook`. Before each mount it runs `vi.resetModules` and
`doMock`s the firebase service, giving every device its own named app and anonymous uid.
It also gives each device in-memory storage. So the security rules see N separate
members, and a refresh restores that one device's saved room. `crash()` is a closed tab:
`goOffline`, so the server runs the `onDisconnect` write, then an unmount that runs no
exits. Write scenarios against the hook's return value, the way `OnlineGame.jsx` drives
it. Never `await` an `act()` that might not resolve: it holds every React update in the
process.
