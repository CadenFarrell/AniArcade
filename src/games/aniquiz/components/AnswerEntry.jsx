import { useMemo, useState } from 'react';
import { domainValues } from '../clues';
import { rankSuggestions } from '../../../shared/utils/guessSuggest';
import { Button, Combobox, Input } from '../../../shared/ui';

// One player's answer to one clue, in whichever style the deal was made for.
// Owns its own draft, so the round only ever sees a submitted answer — and is
// keyed by the caller per player and per clue, so a draft can never carry over
// to the next person holding the device or the next clue on screen.
//
// Multiple choice is select-then-lock rather than tap-to-submit. A clue is
// worth up to a thousand points, and a thumb landing on the option next to the
// one it meant should not cost that.
//
// Typed answers suggest from the WHOLE domain in the pack (every studio, every
// voice actor), never from the shows in play: suggesting only the in-play
// candidates would narrow the field to a handful, which is multiple choice with
// extra steps. The suggestions are not masked on a shared device either, unlike
// AniTune's pass-and-play box, because the handoff screen puts the device in
// one player's hands before this mounts and a list of every voice actor in the
// pack tells somebody leaning over nothing.
export default function AnswerEntry({ clue, options, pack, onSubmit, disabled = false }) {
  if (options?.length) {
    return <ChoiceEntry options={options} onSubmit={onSubmit} disabled={disabled} />;
  }
  if (clue?.kind === 'number') {
    return <NumberEntry onSubmit={onSubmit} disabled={disabled} />;
  }
  return <TypedEntry clue={clue} pack={pack} onSubmit={onSubmit} disabled={disabled} />;
}

function ChoiceEntry({ options, onSubmit, disabled }) {
  const [picked, setPicked] = useState(null);
  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Answers">
        {options.map((o) => {
          const on = picked === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => setPicked(o)}
              className={`focus-pop rounded-pop border-2 px-4 py-4 text-left font-display text-lg font-extrabold
                transition-colors disabled:opacity-40
                ${on ? 'border-pop-pink bg-pop-pink/20 text-white' : 'border-line-strong bg-surface text-fg-strong hover:border-line-loud'}`}
            >
              {o}
            </button>
          );
        })}
      </div>
      <Button variant="primary" size="lg" fullWidth disabled={disabled || picked == null} onClick={() => onSubmit(picked)}>
        Lock in 🔒
      </Button>
    </div>
  );
}

function NumberEntry({ onSubmit, disabled }) {
  const [text, setText] = useState('');
  const ok = /\d/.test(text);
  return (
    <div>
      <Input
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
        onKeyDown={(e) => { if (e.key === 'Enter' && ok && !disabled) onSubmit(text); }}
        placeholder="Type a number…"
        aria-label="Your answer"
        autoFocus
        className="mb-3 text-lg"
      />
      <div className="flex gap-3">
        <Button variant="neutral" size="lg" disabled={disabled} onClick={() => onSubmit('')}>
          Pass
        </Button>
        <Button variant="primary" size="lg" fullWidth disabled={disabled || !ok} onClick={() => onSubmit(text)}>
          Lock in 🔒
        </Button>
      </div>
    </div>
  );
}

function TypedEntry({ clue, pack, onSubmit, disabled }) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  // rankSuggestions takes the character typeahead's shape; a studio or a title
  // is a name with no series, and ranks by the same tiers.
  const domainId = clue?.domain ?? null;
  const domain = useMemo(
    () => (pack && domainId ? domainValues(pack, domainId).map((name) => ({ name, series: '' })) : []),
    [pack, domainId],
  );

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
        renderOption={(s) => <p className="truncate text-base font-bold text-white">{s.name}</p>}
        placeholder="Type your answer…"
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
          Lock in 🔒
        </Button>
      </div>
    </div>
  );
}
