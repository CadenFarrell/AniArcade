import { useState } from 'react';
import { Button, GhostButton } from '../../../shared/ui';
import { Face } from './CardGrid';

const LETTERS = ['A', 'B', 'C', 'D'];
// A group's identity in the draft: its four keys, sorted. Reasons are keyed by
// it rather than by position, so undoing group A never hands its reason to
// the group that slides into A's place.
const sigOf = (keys) => [...keys].sort().join('|');

/**
 * One player's sort of a "Groups of four" board — PickPanel's twin. It owns
 * its draft, so a round only ever sees a locked sort; the caller keys it per
 * round and per player.
 *
 * Tap four characters, then "Make group": they leave the grid for a lettered
 * row. **The last group makes itself** — once every group but one is made, the
 * four left can only go together, and asking for a fifth tap would be a chore
 * dressed as a choice. A made row's "Undo group A" puts its cards back.
 *
 * Groups are told apart by their LETTER, never by colour alone. With reasons
 * on, every row carries its own "what joins them" radios, named "Group A
 * reason: All …" so the bot can tell them from the characters and from each
 * other's.
 *
 * Words the bots and tests press: a character (by name, a toggle), "Make
 * group", "Undo group <L>", "Group <L> reason: …", "Lock in".
 */
export default function SortBoard({ set, reasonsOn, onLock }) {
  const n = set.groups.length;
  const size = set.groups[0]?.keys.length ?? 4;
  const [made, setMade] = useState([]);
  const [picked, setPicked] = useState([]);
  const [reasons, setReasons] = useState({});

  const placed = new Set(made.flat());
  const left = set.cards.filter((c) => !placed.has(c.key));
  const lastMakesItself = made.length === n - 1 && left.length === size;
  const rows = lastMakesItself ? [...made, left.map((c) => c.key)] : made;
  const byKey = new Map(set.cards.map((c) => [c.key, c]));
  const complete = rows.length === n && (!reasonsOn || rows.every((g) => reasons[sigOf(g)] != null));

  const toggle = (key) => setPicked((p) => {
    if (p.includes(key)) return p.filter((k) => k !== key);
    return p.length < size ? [...p, key] : p;
  });
  const makeGroup = () => {
    if (picked.length !== size) return;
    setMade((m) => [...m, picked]);
    setPicked([]);
  };
  const undo = (i) => {
    setMade((m) => m.filter((_, j) => j !== i));
    setPicked([]);
  };

  return (
    <>
      {rows.length > 0 && (
        <section className="mb-5 grid gap-3" aria-label="Your groups">
          {rows.map((g, i) => {
            const auto = lastMakesItself && i === n - 1;
            const sig = sigOf(g);
            return (
              <div key={sig} className="border-2 border-ink bg-surface p-2 sm:p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-fg-strong">
                    Group {LETTERS[i]}
                  </h3>
                  {auto ? (
                    <span className="text-xs text-fg-helper">The last four go together</span>
                  ) : (
                    <GhostButton className="text-xs" aria-label={`Undo group ${LETTERS[i]}`} onClick={() => undo(i)}>
                      Undo
                    </GhostButton>
                  )}
                </div>
                <ul className="grid grid-cols-4 gap-1.5" aria-label={`Group ${LETTERS[i]}`}>
                  {g.map((k) => (
                    <li key={k} className="flex flex-col border-2 border-ink bg-surface">
                      <Face card={byKey.get(k) ?? { name: '?' }} />
                      <span className="px-1 py-1 text-xs font-bold leading-tight text-fg-strong [overflow-wrap:anywhere]">
                        {byKey.get(k)?.name}
                      </span>
                    </li>
                  ))}
                </ul>
                {reasonsOn && (
                  <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Group ${LETTERS[i]} reason`}>
                    {set.reasons.map((text, r) => {
                      const on = reasons[sig] === r;
                      return (
                        <button
                          key={text}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={`Group ${LETTERS[i]} reason: ${text}`}
                          onClick={() => setReasons((x) => ({ ...x, [sig]: r }))}
                          className={`btn-pop focus-pop rounded-pop-sm! px-2 py-1.5 text-left text-sm
                            ${on ? 'border-ink bg-ink text-paper' : 'border-ink bg-surface text-fg-strong hover:bg-surface-2'}`}
                        >
                          <span className="[overflow-wrap:anywhere]">{text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {!lastMakesItself && left.length > 0 && (
        <>
          <div className="mb-3 grid grid-cols-4 gap-1.5 sm:gap-2" role="group" aria-label="Characters">
            {left.map((c) => {
              const on = picked.includes(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  // The name alone, as in CardGrid: the tab is aria-hidden,
                  // and textContent readers would otherwise say "PickDenji".
                  aria-label={c.name}
                  onClick={() => toggle(c.key)}
                  className={`btn-pop focus-pop relative flex flex-col overflow-hidden rounded-none! p-0! text-left
                    ${on ? 'border-ink bg-ink text-paper' : 'border-ink bg-surface text-fg-strong'}`}
                >
                  <Face card={c} />
                  {on && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 border-b-2 border-r-2 border-ink bg-pop-moss px-1 py-0.5 font-display
                        text-[10px] font-bold uppercase tracking-[0.15em] text-paper"
                    >
                      {picked.indexOf(c.key) + 1}
                    </span>
                  )}
                  <span className="block px-1 py-1 text-xs font-bold leading-tight [overflow-wrap:anywhere] sm:text-sm">{c.name}</span>
                </button>
              );
            })}
          </div>
          <Button variant="secondary" size="lg" fullWidth disabled={picked.length !== size} onClick={makeGroup} className="mb-3">
            {picked.length === size ? 'Make group' : `Make group (${picked.length}/${size})`}
          </Button>
        </>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!complete}
        onClick={() => onLock({ groups: rows, reasons: reasonsOn ? rows.map((g) => reasons[sigOf(g)]) : [] })}
      >
        Lock in
      </Button>
    </>
  );
}
