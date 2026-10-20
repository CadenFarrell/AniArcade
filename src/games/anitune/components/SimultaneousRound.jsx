import GuessInput from './GuessInput';
import { Badge, Button, Card, Icon } from '../../../shared/ui';
import Lives from './Lives';
import Handoff from '../../../shared/components/Handoff';

// Simultaneous mode: one clip, then the device goes round the table and each
// player types their own answer. Verdicts are withheld until everyone is in, so
// the person entering fourth learns nothing from the first three.
export default function SimultaneousRound({
  players, questions, phase, entryOrder, entryIndex, answers,
  lives = null, eliminated = [],
  onStartGuessing, onReady, onSubmit,
}) {
  const currentId = entryOrder[entryIndex];
  const current = players.find((p) => p.id === currentId);

  // Order the strip by the pass order so it doubles as "who's up next".
  const strip = (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      {entryOrder.map((id) => {
        const player = players.find((p) => p.id === id);
        const locked = Boolean(answers[id]);
        const out = eliminated.includes(id);
        const tone = out ? 'red' : locked ? 'lime' : id === currentId ? 'purple' : 'neutral';
        return (
          <Badge key={id} tone={tone} className={out ? 'opacity-60' : ''}>
            <Icon
              name={out ? 'skull' : locked ? 'lock' : id === currentId ? 'pencil' : 'hourglass'}
              label={out ? 'Out' : locked ? 'Locked in' : id === currentId ? 'Answering' : 'Waiting'}
            />{' '}
            {player?.name}
            {lives && !out && (
              <Lives count={lives[id]} className="ml-1" />
            )}
          </Badge>
        );
      })}
    </div>
  );

  if (phase === 'listening') {
    return (
      <div className="mt-6">
        <p className="mb-4 text-center text-base text-fg-body">
          Everyone listen — you&apos;ll each get to answer.
        </p>
        {/* No clock in this phase, deliberately. The table is still listening
            together and deciding when to start passing the device; a countdown
            here would be timing a conversation. Each player's clock starts when
            the device reaches their hands. */}
        <Button variant="primary" size="lg" fullWidth onClick={onStartGuessing}>
          Start guessing →
        </Button>
        {strip}
      </div>
    );
  }

  if (phase === 'handoff') {
    return (
      <div className="mt-6">
        <Handoff
          player={current}
          note="Answers stay hidden until everyone is in."
          cta={`I'm ${current?.name} — ready`}
          onReady={onReady}
        />
        {strip}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-1 text-center font-display text-xl font-extrabold text-fg-strong">
        {current?.name}, which anime?
      </p>
      <p className="mb-4 text-center text-sm text-fg-subtle">
        Hidden as you type — everyone else, no peeking at the keyboard.
      </p>
      <GuessInput
        key={currentId}
        questions={questions}
        masked
        placeholder="Type your answer…"
        submitLabel="Lock in"
        skipLabel="Pass"
        onSubmit={(text) => onSubmit(text)}
        onSkip={() => onSubmit('')}
      />
      {strip}
    </div>
  );
}
