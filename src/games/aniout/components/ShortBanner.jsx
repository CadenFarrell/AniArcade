import { Banner } from '../../../shared/ui';

// "These lists hold fewer rounds than you asked for", and what to do about it —
// one component, so setup and the lobby give the same advice. It stays outside
// the More settings fold (a banner about a hidden setting is a problem with no
// visible cause), so it names the folded option in words.
export default function ShortBanner({ settings, found, online = false }) {
  const fixes = [
    settings.sharedOnly && 'turn off “Shared characters only”',
    settings.cards > 5 && 'deal fewer characters per round',
    'play fewer rounds',
    online ? 'or someone imports a bigger list' : 'or import a bigger list with the link button on a player',
  ].filter(Boolean);
  return (
    <Banner tone="warning" className="mb-4">
      A round needs five characters from different shows that share something, and these lists hold {found} of
      the {settings.rounds} asked for. To fix it, {fixes.join(', ')}.
    </Banner>
  );
}
