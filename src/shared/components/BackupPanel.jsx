import { useState } from 'react';
import { useCloudSave } from '../context/cloudSaveContext';
import { buildRestoreUrl, formatCode, syncedLabel } from '../utils/cloudSave';
import { Button, Icon, Input, Label } from '../ui';

// What the status line says, by the provider's status. "It will try again" is
// true of both failures: the next change, focus or reconnect syncs.
const STATUS = {
  syncing: () => 'Backing up…',
  ok: (at) => `Backed up ${syncedLabel(at) ?? 'just now'}`,
  offline: () => 'Offline — it backs up when you’re connected again.',
  error: () => 'Couldn’t reach the backup just now. It will try again.',
};

const RESTORE_ERRORS = {
  invalid: 'That isn’t a backup code — it’s 16 letters and numbers.',
  'not-found': 'There’s no backup under that code.',
  offline: 'You’re offline. Connect and try again.',
  error: 'Couldn’t reach the backup. Try again.',
};

/**
 * The backup code, in the three places a player meets it: the profile picker
 * (all of it), the end of a first import (`showRestore={false}`: someone who
 * just imported is not about to restore), and the first-visit welcome
 * (`showEnable={false}`: someone with no profiles has nothing to back up yet).
 *
 * Renders nothing in a build with no Firebase — there is nowhere to keep a
 * backup, and a control that cannot work is worse than none.
 */
export default function BackupPanel({ showEnable = true, showRestore = true, onRestored, className = '' }) {
  const cloud = useCloudSave();
  const [codeInput, setCodeInput] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreNote, setRestoreNote] = useState(null); // { tone: 'ok' | 'error', text }
  const [copyNote, setCopyNote] = useState('');

  if (!cloud.available) return null;

  const restore = async () => {
    setRestoring(true);
    setRestoreNote(null);
    const result = await cloud.restore(codeInput);
    setRestoring(false);
    if (result.status !== 'ok') {
      setRestoreNote({ tone: 'error', text: RESTORE_ERRORS[result.status] ?? RESTORE_ERRORS.error });
      return;
    }
    setCodeInput('');
    setRestoreNote({
      tone: 'ok',
      text: result.restored > 0
        ? `Restored — ${result.restored} profile${result.restored === 1 ? '' : 's'} added.`
        : 'Restored — this device is in step with your backup.',
    });
    onRestored?.(result);
  };

  // The share sheet where there is one — on a phone that is how a link reaches
  // your own laptop — and the clipboard everywhere else (Lobby.jsx's
  // ShareInvite does the same for room links).
  const shareLink = async () => {
    const url = buildRestoreUrl(window.location.href, cloud.code);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'My AniArcade backup', url });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    copy(url, 'Link copied — open it on your other device');
  };

  const copy = async (text, done) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote(done);
    } catch {
      setCopyNote('Couldn’t copy — write the code down instead');
    }
  };

  if (cloud.code) {
    return (
      <div className={className}>
        {/* A restore lands here, on the linked view, so its result has to be
            said here too. */}
        {restoreNote?.tone === 'ok' && (
          <p role="status" className="mb-3 font-bold text-fg-strong">{restoreNote.text}</p>
        )}
        <p className="mb-1 font-display text-xs font-bold uppercase tracking-widest text-fg-subtle">
          Your backup code
        </p>
        {/* Grouped in fours and set in the display face, so it can be copied by
            hand off another screen; select-all so a long-press takes all of it. */}
        <p className="mb-2 select-all font-display text-2xl font-extrabold tracking-wider text-fg-strong">
          {formatCode(cloud.code)}
        </p>
        <p className="mb-3 text-sm text-fg-helper">
          Enter it on another device, or open its link there, to play with your profiles and record. Keep it
          somewhere safe: it is the only key to your backup.
        </p>
        <div className="mb-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => copy(formatCode(cloud.code), 'Code copied')}>
            Copy code
          </Button>
          <Button variant="secondary" size="sm" onClick={shareLink}>
            <Icon name="link" /> Send link
          </Button>
        </div>
        {/* Announced: the press changes nothing else on screen. */}
        <p role="status" className="min-h-5 text-sm text-fg-body">{copyNote}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-fg-subtle">{STATUS[cloud.status]?.(cloud.lastSyncedAt) ?? ''}</p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Stop backing up this device? Everything stays here, and the code still works on your other devices.')) {
                cloud.disconnect();
              }
            }}
            className="focus-pop min-h-6 rounded-pop-sm text-sm text-fg-subtle underline hover:text-fg-strong"
          >
            Stop syncing on this device
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {showEnable && (
        <>
          <p className="mb-3 text-sm text-fg-helper">
            Back up your profiles and play record to use them on another device — or get them back if this
            browser ever forgets them. No account: you get a code.
          </p>
          <Button variant="secondary" fullWidth onClick={cloud.enable} disabled={cloud.status === 'syncing'}>
            {cloud.status === 'syncing' ? 'Turning on…' : 'Turn on backup'}
          </Button>
        </>
      )}
      {showRestore && (
        <div className={showEnable ? 'mt-4' : ''}>
          <Label htmlFor="backup-code">Have a backup code?</Label>
          <div className="flex gap-2">
            <Input
              id="backup-code"
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && codeInput.trim() && !restoring && restore()}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={restoring}
              className="min-w-0 flex-1"
            />
            <Button variant="neutral" onClick={restore} disabled={!codeInput.trim() || restoring}>
              {restoring ? 'Restoring…' : 'Restore'}
            </Button>
          </div>
          {restoreNote && (
            <p
              role={restoreNote.tone === 'error' ? 'alert' : 'status'}
              className={`mt-2 text-sm ${restoreNote.tone === 'error' ? 'text-pop-red' : 'text-fg-body'}`}
            >
              {restoreNote.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
