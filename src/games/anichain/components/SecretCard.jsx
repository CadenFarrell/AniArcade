import { Avatar, Card } from '../../../shared/ui';

const GROUPS = [
  { from: 'name', title: 'Their name' },
  { from: 'show', title: 'The show' },
  { from: 'cast', title: 'Anyone else in it' },
];

// The givers' card: who they are steering the table towards, and the words
// they may not say. Only ever drawn on a giver's screen (locally behind the
// "show us" handoff; online from their own secrets/ node), so nothing here
// worries about being seen.
//
// `compact` is the online in-round version: the giver keeps it on screen
// while typing, so the portrait shrinks and the cast's words fold away.
export default function SecretCard({ card, compact = false, children }) {
  const { character, banned = [] } = card;
  return (
    <Card padding="lg" className="mb-5">
      <div className="flex items-center gap-4">
        <Avatar src={character.imageUrl} alt="" size={compact ? 'md' : 'lg'} />
        <div className="min-w-0">
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fg-helper">Your character</p>
          <p
            className={`font-display font-bold uppercase leading-tight tracking-wide text-fg-strong [overflow-wrap:anywhere]
              ${compact ? 'text-2xl' : 'text-3xl'}`}
          >
            {character.name}
          </p>
          {character.series && <p className="text-fg-body [overflow-wrap:anywhere]">{character.series}</p>}
        </div>
      </div>
      {banned.length > 0 && (
        <section aria-label="Off limits" className="mt-4 border-t-2 border-line pt-3">
          <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-fg-helper">Off limits</h3>
          {GROUPS.map(({ from, title }) => {
            const list = banned.filter((b) => b.from === from).map((b) => b.word);
            if (!list.length) return null;
            const body = <p className="text-sm text-fg-body [overflow-wrap:anywhere]">{list.join(' · ')}</p>;
            // The cast's words can run to dozens; online they fold, since the
            // word box refuses one anyway and says why.
            if (compact && from === 'cast') {
              return (
                <details key={from} className="mb-1">
                  <summary className="cursor-pointer text-sm font-bold text-fg-strong">{title} ({list.length})</summary>
                  {body}
                </details>
              );
            }
            return (
              <div key={from} className="mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-fg-helper">{title}</p>
                {body}
              </div>
            );
          })}
        </section>
      )}
      {children && <div className="mt-4">{children}</div>}
    </Card>
  );
}
