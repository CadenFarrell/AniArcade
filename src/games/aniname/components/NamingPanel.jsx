import { useRef, useState } from 'react';
import { Button, Input } from '../../../shared/ui';

// The namer's box: type a name, press Enter (or Add), and it is judged on the
// spot and lands on the list. The box clears and keeps focus, so a phone's
// keyboard stays up for the next name — the clock is running.
//
// No suggestions, on purpose: a dropdown of names turns "can you name them"
// into "can you recognise them", which is a different, easier game.
//
// Words the bots and tests press: the "Your answer" box, "Add", "I'm done".
export default function NamingPanel({ onName, onDone }) {
  const [text, setText] = useState('');
  const box = useRef(null);
  const submit = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    onName(text.trim());
    setText('');
    box.current?.focus();
  };
  return (
    <form onSubmit={submit} className="mb-4">
      <label htmlFor="aniname-answer" className="sr-only">Your answer</label>
      <div className="mb-3 flex gap-2">
        <Input
          ref={box}
          id="aniname-answer"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a name…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          // The round starts with the box in hand: the clock is already running.
          autoFocus
          maxLength={80}
          className="flex-1"
        />
        <Button type="submit" variant="primary" size="lg" disabled={!text.trim()}>Add</Button>
      </div>
      <Button type="button" variant="neutral" fullWidth onClick={onDone}>I&apos;m done</Button>
    </form>
  );
}
