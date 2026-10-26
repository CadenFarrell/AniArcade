import { Button, Kana, Modal, SheetSection as Section } from '../shared/ui';
import { ART, FONTS, SOUND_PACK } from '../shared/ui/credits';
import { KANA } from '../shared/ui/kanaText';

// Who made the prints, the sounds and the type. Nothing here legally requires a
// credit — the art and sounds are CC0 and the fonts are OFL — but a page built on
// other people's work should say whose it is, and the reproduction record in
// credits.js is only useful if somebody can see it exists. The game tiles get a
// line of their own: they are the player's own characters, not the app's art.
export default function CreditsModal({ onClose }) {
  return (
    <Modal onClose={onClose} width="md">
      <Kana className="block text-sm text-pop-pink">{KANA.credits}</Kana>
      <h2 className="mb-5 font-display text-3xl font-bold uppercase text-fg-strong">Credits</h2>

      <Section title="Game tiles">
        <li className="text-fg-body">
          The characters on the game tiles come from your own anime list, drawn fresh each visit.
          Portraits are loaded from AniList and belong to their creators.
        </li>
      </Section>

      <Section title="Prints">
        {Object.values(ART).map((a) => <ArtCredit key={a.src} art={a} />)}
      </Section>

      <Section title="Sounds">
        <li>
          <a href={SOUND_PACK.url} target="_blank" rel="noreferrer" className="focus-pop font-bold underline decoration-2 underline-offset-2">
            {SOUND_PACK.title}
          </a>
          <span className="text-fg-body"> — {SOUND_PACK.artist}. {SOUND_PACK.licence}.</span>
        </li>
      </Section>

      <Section title="Type">
        {FONTS.map((f) => (
          <li key={f.title}>
            <span className="font-bold">{f.title}</span>
            <span className="text-fg-body"> — {f.artist}. {f.licence}.</span>
          </li>
        ))}
      </Section>

      <Button variant="secondary" fullWidth onClick={onClose} className="mt-2">
        Close
      </Button>
    </Modal>
  );
}

const LINK = 'focus-pop font-bold underline decoration-2 underline-offset-2';

function ArtCredit({ art }) {
  return (
    <li>
      <a href={art.url} target="_blank" rel="noreferrer" className={LINK}>
        {art.title}
      </a>
      <span className="text-fg-body"> — {art.artist}, {art.date}. {art.source}. {art.licence}.</span>
    </li>
  );
}
