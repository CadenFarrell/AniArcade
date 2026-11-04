import { themeLabel } from '../utils/labels';
import { Icon } from '../../../shared/ui';

// When each hint turns over, as a fraction of the window HEARD.
const FIRST_AT = 0.35;
const SECOND_AT = 0.65;

// "Ann" / "Ann and Ben" / "Ann, Ben and Cy".
function nameList(names) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The hint ladder (the `hints` setting, off by default): while the clip plays
 * and nobody has it, the theme's number and year turn over a third of the way
 * through the guess window, and whose lists the show is on at two thirds.
 *
 * Never the song's title — "Gurenge" names the show for half the table, so it
 * would end the question rather than help it. And no scoring change: the speed
 * bonus already pays more for an answer before a hint than after one, which is
 * the right price without a second rule to learn.
 *
 * `fraction` is how much of the window the clip has played (ClipPlayer /
 * SyncedClipPlayer's onProgress), not the guess clock's. It used to be the
 * clock's, which meant the ladder only existed where a shared deadline ran
 * while the song played — on one device that was Race alone, so the setting
 * did nothing in Everyone guesses or Last one standing. Following the music
 * works in every mode, timed or not, and still pauses with a race buzz, since
 * the clip does.
 */
export default function SongHints({ question, players = [], fraction }) {
  if (fraction == null || fraction < FIRST_AT) return null;
  const theme = [themeLabel(question), question?.year].filter(Boolean).join(' · ');
  const owners = players.filter((p) => (question?.owners ?? []).includes(p.id)).map((p) => p.name);
  const showOwners = fraction >= SECOND_AT && owners.length > 0 && owners.length < players.length;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2" aria-live="polite">
      {theme && (
        <span className="reveal-row inline-flex items-center gap-1.5 border-2 border-ink bg-surface px-3 py-1 font-display text-sm font-bold uppercase tracking-wide text-fg-strong">
          <Icon name="help" /> {theme}
        </span>
      )}
      {showOwners && (
        <span className="reveal-row inline-flex items-center gap-1.5 border-2 border-ink bg-surface px-3 py-1 text-sm font-bold text-fg-strong">
          <Icon name="list" /> On {nameList(owners)}&apos;s list{owners.length > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
