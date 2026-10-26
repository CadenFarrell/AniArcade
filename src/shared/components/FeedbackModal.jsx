import { useEffect, useId, useState } from 'react';
import { useOnline } from '../hooks/useOnline';
import { LIMITS, reportsConfigured, sendReport } from '../services/reports';
import { Banner, Button, Field, Label, Modal, Select, Textarea } from '../ui';

// A short note from a player to whoever runs the arcade, about one game or the
// whole thing. Saved write-only through services/reports.js and read in the
// Firebase console, so it needs no account and publishes nobody's address.
//
// Opened from the hub's footer (beside Credits) and from the bottom of a game's
// How to play sheet, where "something unclear?" is exactly the moment a player
// has something to say — that route arrives with the game already chosen.
//
// It says up front when it cannot send — no Firebase in this build, or no
// signal — rather than letting a player write a paragraph into a box that will
// refuse it. A failed send keeps the draft.
export default function FeedbackModal({ games = [], gameId = '', onClose }) {
  const online = useOnline();
  const [configured, setConfigured] = useState(null); // null while checking
  const [about, setAbout] = useState(gameId ?? '');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const textId = useId();
  const aboutId = useId();

  // Whether this build has Firebase at all. Asked by loading the Firebase chunk,
  // which a send needs anyway; null while asking, and left null when the chunk
  // cannot load (offline), so the check runs again once the signal is back.
  useEffect(() => {
    if (!online || configured !== null) return undefined;
    let live = true;
    reportsConfigured().then((ok) => { if (live) setConfigured(ok); });
    return () => { live = false; };
  }, [online, configured]);

  const trimmed = text.trim();
  const canSend = online && configured === true && trimmed.length > 0 && status !== 'sending';

  const send = async () => {
    if (!canSend) return;
    setStatus('sending');
    try {
      await sendReport('feedback', { text: trimmed, gameId: about || undefined });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <Modal onClose={onClose} width="sm">
        <h2 className="mb-2 font-display text-3xl font-bold uppercase text-fg-strong">Thanks — sent</h2>
        <p className="mb-6 text-fg-body">It goes straight to the person who makes the arcade.</p>
        <Button variant="primary" fullWidth onClick={onClose}>Close</Button>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} width="md" closeOnBackdrop={!trimmed}>
      <h2 className="mb-2 font-display text-3xl font-bold uppercase text-fg-strong">Send feedback</h2>
      <p className="mb-5 text-fg-body">
        A bug, a rule that didn’t make sense, an idea. No name or account is attached.
      </p>

      {!online && (
        <Banner tone="warning" className="mb-4">You’re offline. Feedback can be sent once you have signal again.</Banner>
      )}
      {online && configured === false && (
        <Banner tone="warning" className="mb-4">This copy of the arcade isn’t set up to receive feedback.</Banner>
      )}
      {status === 'error' && (
        <Banner tone="danger" className="mb-4">
          That didn’t send. Wait a minute and try again — your message is still here.
        </Banner>
      )}

      <Field label="About" htmlFor={aboutId} className="mb-4">
        <Select id={aboutId} value={about} onChange={(e) => setAbout(e.target.value)}>
          <option value="">The arcade</option>
          {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </Select>
      </Field>

      <Label htmlFor={textId}>Your message</Label>
      <Textarea
        id={textId}
        rows={5}
        maxLength={LIMITS.text}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="mt-1 mb-5 text-right text-xs text-fg-subtle">
        {text.length} / {LIMITS.text}
      </p>

      <Button variant="primary" fullWidth disabled={!canSend} onClick={send} className="mb-3">
        {status === 'sending' ? 'Sending…' : 'Send'}
      </Button>
      <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
    </Modal>
  );
}
