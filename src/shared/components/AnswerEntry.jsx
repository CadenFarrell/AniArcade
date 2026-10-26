import { useState } from 'react';
import { rankSuggestions } from '../utils/guessSuggest';
import { Button, Combobox } from '../ui';

// The two ways a player answers in the arcade's quiz-style games: pick one of
// a few lettered options, or type with suggestions. Lifted out of AniQuiz's
// AnswerEntry when AniPeek needed both — a second copy of the lettered panels
// would have drifted the way the rosters did.
//
// Each owns its own draft, so a round only ever sees a submitted answer. The
// caller keys them per player and per question, so a draft can never carry
// over to the next person or the next question.
//
// Words the playtest bots press: the "Answers" radio group, "Lock in", "Pass".

/**
 * Multiple choice, select-then-lock rather than tap-to-submit: a thumb landing
 * on the option beside the one it meant should not cost the answer.
 */
export function ChoiceEntry({ options, onSubmit, disabled = false }) {
  const [picked, setPicked] = useState(null);
  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Answers">
        {/* Lettered answer panels, quiz-show style. The pick fills with ink —
            the arcade's "chosen" fill, the same ink as every primary button —
            rather than a tint of the brand red, which beside a red "wrong" a
            moment later would say two things in one colour. The letter is
            decoration (aria-hidden); the answer text is the radio's name. */}
        {options.map((o, i) => {
          const on = picked === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => setPicked(o)}
              className={`btn-pop focus-pop flex items-center gap-3 rounded-pop-sm! px-3 py-3 text-left text-lg
                disabled:opacity-40 ${on ? 'border-ink bg-ink text-paper' : 'border-ink bg-surface text-fg-strong hover:bg-surface-2'}`}
            >
              <span
                aria-hidden="true"
                className={`grid h-8 w-8 shrink-0 place-items-center border-2 font-display text-base
                  ${on ? 'border-paper bg-paper text-ink' : 'border-ink bg-ink text-paper'}`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{o}</span>
            </button>
          );
        })}
      </div>
      <Button variant="primary" size="lg" fullWidth disabled={disabled || picked == null} onClick={() => onSubmit(picked)}>
        Lock in
      </Button>
    </div>
  );
}

/**
 * A typed answer. `suggestions` is the typeahead's whole domain, in
 * rankSuggestions' `{ name, series }` shape (a studio or a title is a name
 * with no series, and ranks by the same tiers). Pass submits a blank.
 */
export function TypedEntry({ suggestions: domain = [], onSubmit, disabled = false, placeholder = 'Type your answer…' }) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const update = (value) => {
    setText(value);
    setSuggestions(rankSuggestions(domain, value, 6));
  };
  const submit = () => {
    if (!text.trim() || disabled) return;
    setSuggestions([]);
    onSubmit(text);
  };

  return (
    <div>
      <Combobox
        value={text}
        onChange={update}
        suggestions={suggestions}
        onSelect={(s) => { setText(s.name); setSuggestions([]); }}
        onSubmit={submit}
        optionKey={(s) => s.name}
        renderOption={(s) => <p className="truncate text-base font-bold text-fg-strong">{s.name}</p>}
        placeholder={placeholder}
        ariaLabel="Your answer"
        maxLength={120}
        autoFocus
        className="mb-3"
      />
      <div className="flex gap-3">
        <Button variant="neutral" size="lg" disabled={disabled} onClick={() => { setSuggestions([]); onSubmit(''); }}>
          Pass
        </Button>
        <Button variant="primary" size="lg" fullWidth disabled={disabled || !text.trim()} onClick={submit}>
          Lock in
        </Button>
      </div>
    </div>
  );
}
