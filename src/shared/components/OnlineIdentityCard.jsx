import { Button, Card } from '../ui';

// "Playing online as X" — the header of both games' RoomSetup.
//
// Online is single-identity: whoever the hub's main profile is, is who the room
// sees. Both RoomSetups had hand-rolled the same card to say so, drifting only
// in accent colour and in which stat they cared about, so it lives here now.
//
// `stat` is passed pre-formatted rather than computed here: AniGuess counts
// characters and AniTune counts shows, and neither number means anything in the
// other game.
const TONES = {
  purple: 'text-pop-purple',
  blue: 'text-pop-blue',
  amber: 'text-pop-amber',
  teal: 'text-pop-teal',
  lime: 'text-pop-lime',
  red: 'text-pop-red',
  plum: 'text-pop-plum',
  slate: 'text-pop-slate',
  moss: 'text-pop-moss',
  umber: 'text-pop-umber',
};

export default function OnlineIdentityCard({ profile, stat, tone = 'purple', onSwitch, onImport }) {
  return (
    <Card className="mb-6 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-fg-subtle">Playing online as</p>
        <p className="truncate font-display text-lg font-extrabold text-fg-strong">{profile.name}</p>
        {/* A game whose default mode draws no cards passes none — an empty line
            of the right height is worse than no line, since it reads as a stat
            that failed to load. */}
        {stat && <p className="text-sm text-fg-subtle">{stat}</p>}
        {/* Player ids come from the profile name, so a room rejects a second
            person using the same one — make switching easy. min-h-6 is the
            24px tap floor (WCAG 2.5.8); the bare text-sm line was 20px. */}
        <button
          onClick={onSwitch}
          className={`focus-pop mt-1 min-h-6 rounded-pop-sm text-sm hover:text-fg-strong ${TONES[tone] ?? TONES.purple}`}
        >
          Not you? Switch profile
        </button>
      </div>
      <Button variant="neutral" size="sm" className="flex-shrink-0" onClick={onImport}>
        Import my list
      </Button>
    </Card>
  );
}
