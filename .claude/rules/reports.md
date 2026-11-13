---
paths:
  - "src/shared/services/reports.js"
  - "src/shared/services/crashReport.js"
  - "src/shared/components/ErrorBoundary.jsx"
  - "src/shared/components/FeedbackModal.jsx"
  - "src/main.jsx"
  - "smoke/reports.smoke.test.js"
---

# Crash reports and feedback

Moved from the root `CLAUDE.md`, which keeps only the pointer.

`shared/services/reports.js` is the one write-only channel home: `reports/crashes/{uid}` and
`reports/feedback/{uid}` in the same RTDB, which no client can read (read them in the Firebase
console), each write rate-limited by a `reportGate/{uid}/{kind}` stamp the rules check.
Firebase is imported **dynamically** there, so the hub's bundle carries no SDK and local play
contacts Firebase only when something is actually sent. Crashes come from `ErrorBoundary`
and `main.jsx`'s window listeners (`services/crashReport.js`: never from a dev server, offline, or for a
failed game download, and never a profile or an invite's query); feedback from
`FeedbackModal.jsx` (hub footer, and each rules sheet). Rules and smoke test:
`.claude/rules/online-rooms.md` ("Outside `rooms/`: reports"), `smoke/reports.smoke.test.js`.
