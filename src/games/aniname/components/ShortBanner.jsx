import { Banner } from '../../../shared/ui';

// "These lists hold fewer categories than rounds", and what to do about it —
// one component, so setup and the lobby give the same advice.
export default function ShortBanner({ settings, found, online = false }) {
  return (
    <Banner tone="warning" className="mb-4">
      A category needs a few answers on record (six characters from a show, five shows by a studio), and these
      lists hold {found} for the {settings.rounds} rounds asked for. Play fewer rounds,
      {online ? ' or someone imports a bigger list.' : ' or import a bigger list with the link button on a player.'}
    </Banner>
  );
}
