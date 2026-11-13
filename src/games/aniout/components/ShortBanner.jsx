import { Banner } from '../../../shared/ui';
import { matchLength } from '../copy';

// "These lists hold fewer rounds than you asked for", and what to do about it —
// one component, so setup and the lobby give the same advice. It stays outside
// the More settings fold (a banner about a hidden setting is a problem with no
// visible cause), so it names the folded option in words.
export default function ShortBanner({ settings, found, online = false }) {
  const groups = settings.mode === 'groups';
  const fixes = [
    !groups && settings.cards > 5 && 'deal fewer characters per round',
    groups ? 'sort fewer boards' : 'play fewer rounds',
    online ? 'or someone imports a bigger list' : 'or import a bigger list with the link button on a player',
  ].filter(Boolean);
  return (
    <Banner tone="warning" className="mb-4">
      {groups
        ? 'A board needs groups of four characters that share something no one else on it has'
        : 'A round needs five characters from different shows that share something'}
      , and these lists hold {found} of the {matchLength(settings)} asked for. To fix it, {fixes.join(', ')}.
    </Banner>
  );
}
