import { useState } from 'react';
import { normalizeCharacter } from '../../../shared/utils/character';
import { Button, Screen } from '../../../shared/ui';

// The character the table just chose, shown to everyone but the person who has
// to guess it — as a manga character sheet: the portrait panel in full colour
// (the one place in the arcade a character is NOT inked grey, because this is
// the moment everybody has to recognise them later) beside a profile column of
// labelled facts.
export default function CharacterReveal({ character, guesserName, onStartQuestioning, isLastPlayer, online = false }) {
  // Normalize defensively — a character just edited via ListManager mid-session
  // may still have the raw (unnormalized) shape until the profile is reloaded.
  const c = normalizeCharacter(character);
  const [broken, setBroken] = useState(false);

  // Series leads the sheet under the name; the rest are the profile rows.
  const facts = [
    { label: 'Role', value: c.role },
    { label: 'Gender', value: c.gender },
    { label: 'Hair Color', value: c.hairColor },
    { label: 'Ability', value: c.ability },
    { label: 'Genre', value: c.genres.join(', ') },
  ].filter((f) => f.value);

  return (
    <Screen center width="md">
      <h2 className="mb-5 text-center font-display text-sm font-bold uppercase tracking-[0.3em] text-fg-helper">
        Character Reveal
      </h2>

      <article className="mb-6 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] overflow-hidden border-[3px] border-ink bg-surface shadow-pop">
        <div className="relative min-h-56 border-r-[3px] border-ink bg-surface-2">
          {c.imageUrl && !broken ? (
            <img
              src={c.imageUrl}
              alt={c.name}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
              className="absolute inset-0 h-full w-full object-cover object-[50%_15%]"
            />
          ) : (
            <span aria-hidden="true" className="speed-lines absolute inset-0 opacity-20" />
          )}
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          <h3
            className="font-display text-3xl font-bold uppercase leading-[0.95] tracking-wide text-fg-strong
              [overflow-wrap:anywhere] sm:text-4xl"
          >
            {c.name}
          </h3>
          {c.series && <p className="mt-1.5 text-sm font-semibold text-fg-body">{c.series}</p>}
          {facts.length > 0 && (
            <dl className="mt-4 space-y-2 border-t-2 border-ink pt-3">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
                    {fact.label}
                  </dt>
                  <dd className="text-base text-fg-strong">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </article>

      {/* The description runs long, so it sits under the sheet rather than
          stretching the portrait column to match it. */}
      {c.description && (
        <p className="mb-6 max-h-40 overflow-y-auto border-l-4 border-ink bg-surface/70 px-4 py-3 text-sm text-fg-body">
          {c.description}
        </p>
      )}

      <p className="mb-6 text-center text-lg text-fg-helper">
        {online ? (
          <>Memorize this — it&apos;s <strong className="text-fg-strong">{guesserName}</strong>&apos;s character.</>
        ) : (
          <>Memorize this, then pass the device to <strong className="text-fg-strong">{guesserName}</strong></>
        )}
      </p>

      <Button variant="primary" size="xl" fullWidth onClick={onStartQuestioning}>
        {isLastPlayer ? 'Start Game!' : 'Next Player'}
      </Button>
    </Screen>
  );
}
