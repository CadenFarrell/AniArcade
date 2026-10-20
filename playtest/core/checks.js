// The generic per-screen checks every run applies, whatever the game. Each
// returns findings rather than throwing, so the driver can record ALL of what
// was wrong on a screen and keep the trace that led there.
//
// These are the bugs that look fine to every rules test: a value that renders
// as "NaN pts", a template that printed `undefined`'s name, a score object
// interpolated whole. A rules test asserts the number; nothing asserted the
// TEXT the number became.

// Word-bounded so "Undefined Fantastic Object" (a real anime title) cannot trip
// it — only the bare JavaScript spellings, as they come out of a template.
const BAD_TEXT = [
  { re: /\bNaN\b/, what: 'NaN in visible text' },
  { re: /(^|[\s(:=])undefined([\s),.]|$)/, what: '"undefined" in visible text' },
  { re: /\[object Object\]/, what: '[object Object] in visible text' },
  // Only Infinity in a number's position — a unit after it, or `=`/`:` before
  // it. "SK8 the Infinity" is a real show, and the quiz deals it as a clue.
  { re: /-?Infinity\s*(pts|points|%|s\b|seconds|×)|[=:]\s*-?Infinity\b/, what: 'Infinity in visible text' },
  // No shipped copy uses the bare word, so a `null` on screen is a value that
  // fell through a template.
  { re: /(^|[\s(:=])null([\s),.]|$)/, what: '"null" in visible text' },
];

export const CRASH = /something went wrong/i;

export function screenChecks(snap) {
  const out = [];
  if (CRASH.test(snap.text)) out.push({ kind: 'crash', severity: 'fail', message: 'ErrorBoundary is showing' });
  for (const { re, what } of BAD_TEXT) {
    const m = snap.text.match(re);
    if (m) {
      const at = Math.max(0, m.index - 40);
      out.push({ kind: 'bad-text', severity: 'fail', message: `${what}: …${snap.text.slice(at, m.index + 40)}…` });
    }
  }
  // A control with no accessible name is a real bug (a screen reader announces
  // "button") and it also blinds the bots, which find everything by name.
  for (const c of snap.controls) {
    if (!c.name && ['button', 'link', 'radio', 'checkbox', 'textbox'].includes(c.role)) {
      out.push({ kind: 'a11y-name', severity: 'warn', message: `unnamed ${c.role}` });
    }
  }
  // Several enabled controls sharing one name are indistinguishable to a
  // screen reader ("Accuse, button. Accuse, button.") — the name has to carry
  // what makes each one different, usually the player or row it acts on.
  const counts = new Map();
  for (const c of snap.controls) {
    if (c.disabled || !c.name || !['button', 'link', 'radio', 'option'].includes(c.role)) continue;
    counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  }
  for (const [name, n] of counts) {
    if (n > 1) out.push({ kind: 'a11y-duplicate-name', severity: 'warn', message: `several controls named "${name.slice(0, 60)}"` });
  }
  return out;
}

// Results screens are where a departed or mis-keyed player silently vanishes,
// so every seated name must appear on the last screen a run reaches.
//
// Case-insensitive: Chrome's innerText applies CSS text-transform, so a name
// set in display caps (the results screens' standings and splash) reads as
// "CADEN". jsdom's textContent does not, which is why only the browser layer
// ever tripped on it. The name is on screen either way.
export function rosterCheck(snap, names) {
  const text = snap.text.toLowerCase();
  const missing = names.filter((n) => !text.includes(n.toLowerCase()));
  return missing.length
    ? [{ kind: 'roster', severity: 'fail', message: `results screen is missing: ${missing.join(', ')}` }]
    : [];
}
