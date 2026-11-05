import { useId } from 'react';
import Button from './Button';
import Modal from './Modal';

// The arcade's "are you sure?" for anything short of leaving the game — a
// delete, a reset, a host ending somebody's round. It replaced window.confirm,
// whose grey OK/Cancel box looked pasted in, answered "OK" rather than what
// happens, and on a phone held the room's updates while it sat open. Leaving a
// game is PauseScreen instead (the bigger question gets the bigger screen).
//
// Both buttons say what they do. The confirm is `danger` (crimson ink) by
// default, since most of these destroy something; `tone="primary"` is for one
// that only moves the game on ("Reveal now"). Cancel comes first and takes
// focus, so a stray Enter keeps things as they were; Escape and the backdrop
// cancel too. Escape reaches only this dialog when it opens over another
// (the profile picker, an editor): useDialogLayer answers the topmost.
export default function ConfirmDialog({
  title,
  message = null,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  return (
    <Modal onClose={onCancel} width="sm" labelledBy={titleId}>
      <h2 id={titleId} className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-fg-strong">
        {title}
      </h2>
      {message && <p className="mt-3 text-base leading-snug text-fg-body">{message}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" sound="back" autoFocus onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={tone === 'primary' ? 'primary' : 'danger'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
