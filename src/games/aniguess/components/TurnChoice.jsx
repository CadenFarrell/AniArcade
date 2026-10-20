import { Button, Icon } from '../../../shared/ui';

// The turn's one decision, as two tall panels: ask (blue, the palette's asking
// ink) or guess (ink, the primary action). Equal height, each with its mark, so
// the choice reads as a choice rather than as a button and its afterthought.
// The accessible names — "Ask a Question", "Submit Guess" — are what the
// playtest bots press; the icons are decoration and add nothing to them.
export default function TurnChoice({ onAsk, onGuess }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4">
      <Button variant="info" size="xl" className="h-full py-5!" onClick={onAsk}>
        <span className="flex flex-col items-center gap-2">
          <span className="text-4xl leading-none"><Icon name="speech" /></span>
          Ask a Question
        </span>
      </Button>
      <Button variant="primary" size="xl" className="h-full py-5!" onClick={onGuess}>
        <span className="flex flex-col items-center gap-2">
          <span className="text-4xl leading-none"><Icon name="target" /></span>
          Submit Guess
        </span>
      </Button>
    </div>
  );
}
