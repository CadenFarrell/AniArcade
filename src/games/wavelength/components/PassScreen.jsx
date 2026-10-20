import Handoff from '../../../shared/components/Handoff';
import { Backdrop, Screen } from '../../../shared/ui';

// The hand-off gate, as the arcade's shared pass-the-device panel (Handoff):
// name who the device is for, require a deliberate tap, and NEVER auto-advance
// on a timer — the whole mechanism is that the screen stays useless until the
// right person is holding it, and a screen that moves on by itself defeats that
// while somebody is still passing it across the table.
//
// `note` is what the next person is about to do, not a warning to the current
// one. Everyone can see this screen; nothing secret may appear on it.
export default function PassScreen({ player, note, cta = "I'm ready", onReady }) {
  return (
    <>
      <Backdrop />
      <Screen center>
        <Handoff player={player} note={note} cta={cta} onReady={onReady} />
      </Screen>
    </>
  );
}
