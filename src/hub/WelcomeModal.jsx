import { useState } from 'react';
import BackupPanel from '../shared/components/BackupPanel';
import ListImport from '../shared/components/ListImport';
import { useProfileStore } from '../shared/context/profileContext';
import { Button, Modal } from '../shared/ui';
import { markWelcomeSeen } from './welcomeSeen';

// The first thing a brand-new player meets after PRESS START, and only while
// this device has no profiles at all: the arcade is built from your anime list,
// so the list is the first step, and the setup used to be a hint pointing at
// the top bar, a picker, a name box and then the import. Here it is one press
// to the import (which names the profile after the account), or a backup code
// for someone who has played on another device.
export default function WelcomeModal({ onClose, onRestored }) {
  const { saveProfile, selectProfile } = useProfileStore();
  const [importing, setImporting] = useState(false);

  const close = () => {
    markWelcomeSeen();
    onClose();
  };

  // Replaces this dialog rather than stacking on it, as ProfilePicker does.
  if (importing) {
    return (
      <ListImport
        profile={null}
        offerBackup
        onClose={() => setImporting(false)}
        onImported={(merged) => {
          saveProfile(merged);
          selectProfile(merged.id);
          close();
        }}
      />
    );
  }

  return (
    <Modal onClose={close} width="sm">
      <h2 className="mb-2 font-display text-2xl font-extrabold text-fg-strong">Welcome to AniArcade</h2>
      <p className="mb-6 text-fg-body">
        Every game here is played with the shows you&rsquo;ve watched and their characters. Bring your list
        from AniList, MyAnimeList or Kitsu once, and every game uses it.
      </p>
      <Button variant="primary" size="lg" fullWidth onClick={() => setImporting(true)}>
        Bring my anime list
      </Button>
      <BackupPanel
        showEnable={false}
        className="mt-6 border-t-2 border-line pt-5"
        onRestored={(result) => { close(); onRestored?.(result); }}
      />
      <button
        type="button"
        onClick={close}
        className="focus-pop mt-5 min-h-6 w-full rounded-pop-sm text-sm text-fg-subtle hover:text-fg-strong"
      >
        Not now
      </button>
    </Modal>
  );
}
