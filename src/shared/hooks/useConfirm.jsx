import { useCallback, useMemo, useState } from 'react';
import ConfirmDialog from '../ui/ConfirmDialog';
import PauseScreen from '../ui/PauseScreen';

// What replaced `if (!window.confirm(msg)) return; doIt();` at every call site:
//
//   const { ask, dialog } = useConfirm();
//   onClick={() => ask({ title, message, confirmLabel, onConfirm: doIt })}
//   ...
//   {dialog}
//
// The question is state, so it can be drawn as part of the game (PauseScreen
// for leaving it, ConfirmDialog for everything else) instead of the browser's
// box, which blocked the page and said "OK". `kind: 'pause'` picks the full
// sheet; anything else the dialog. `tone: 'primary'` is a dialog whose confirm
// destroys nothing.
//
// Local state, no provider: every caller owns its question and draws it where
// it already renders, so a game mounted alone in a test asks exactly as it does
// in the hub. The one placement rule is PauseScreen's — never inside a top-bar
// portal (see PauseScreen.jsx).
//
// The question closes BEFORE onConfirm runs, so an onConfirm that unmounts the
// caller (leaving the game) never sets state on an unmounted hook.
//
// `scope` is what the question is ABOUT, for a question asked online while the
// room moves on underneath it. window.confirm froze the page, so nothing could
// change while it was open; this does not, and "Abandon this round?" left open
// across a reveal would abandon the NEXT round when answered. A question asked
// under one scope is dropped once the scope changes (AniWave and AniTag pass
// the round and phase). Locally nothing moves while a question is open, so the
// default — one scope forever — is right there.
export function useConfirm(scope = null) {
  const [question, setQuestion] = useState(null);

  const ask = useCallback((q) => setQuestion({ ...q, scope }), [scope]);
  const cancel = useCallback(() => setQuestion(null), []);
  const live = question != null && question.scope === scope;

  const dialog = useMemo(() => {
    if (!live) return null;
    const confirm = () => {
      setQuestion(null);
      question.onConfirm?.();
    };
    if (question.kind === 'pause') {
      return (
        <PauseScreen
          title={question.title}
          message={question.message}
          stayLabel={question.cancelLabel}
          leaveLabel={question.confirmLabel}
          onStay={cancel}
          onLeave={confirm}
        />
      );
    }
    return (
      <ConfirmDialog
        title={question.title}
        message={question.message}
        confirmLabel={question.confirmLabel}
        cancelLabel={question.cancelLabel}
        tone={question.tone}
        onConfirm={confirm}
        onCancel={cancel}
      />
    );
  }, [live, question, cancel]);

  return { ask, dialog, asking: live };
}
