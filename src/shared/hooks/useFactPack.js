import { useCallback, useEffect, useState } from 'react';
import { loadFactPack } from '../services/factPack';

// The pack, with a status a setup screen can say out loud. loadFactPack
// resolves null rather than throwing (see its header) precisely so that this —
// the first screen that needs it — reports "could not load" instead of a crash.
//
// Every device in a room loads its own copy. The host needs it to deal; a guest
// needs it only for the typed-answer suggestions, which is why a guest whose
// pack failed can still play — grading reads the clue, never the pack.
export function useFactPack() {
  const [state, setState] = useState({ pack: null, status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadFactPack().then((pack) => {
      if (live) setState(pack ? { pack, status: 'ready' } : { pack: null, status: 'failed' });
    });
    return () => { live = false; };
  }, [attempt]);

  // loadFactPack drops a failed promise, so asking again genuinely refetches.
  const retry = useCallback(() => {
    setState({ pack: null, status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
