import LastOutcomeBanner from './LastOutcomeBanner';
import QuestionLog from './QuestionLog';
import WhoIsWhoPanel from './WhoIsWhoPanel';
import { Avatar, Button, Card, Icon, Screen } from '../../../shared/ui';
import SpeechBubble from '../../../shared/components/SpeechBubble';

// Shown on every device during 'game' phase except the current guesser's.
// Resolves pending questions via a button click (guesses are auto-resolved
// by OnlineGame, since there's nothing for a human to decide).
//
// Carries the context a remote answerer can't get by looking across the table:
// the guesser's assigned character (safe here — database.rules.json denies only
// the guesser's own device that read) and everything already asked this round.
export default function OnlineAnswererView({
  guesser, guesserCharacter, whoIsWho = [], questionLog = [], turnCount = 0,
  pendingAction, lastOutcome, onAnswer, resolving,
}) {
  const live = pendingAction && !pendingAction.resolved;

  return (
    <Screen width="md">
      <LastOutcomeBanner outcome={lastOutcome} />

      <div className="mb-6 text-center">
        <h2 className="font-display text-3xl font-extrabold text-fg-strong">
          {guesser?.name}&apos;s Turn
        </h2>
        <p className="mt-1 text-base text-fg-helper">
          Turn {turnCount + 1} · You answer, they guess
        </p>
      </div>

      {/* The character they're trying to work out — their own device never
          receives this. */}
      <Card padding="sm" className="mb-6 flex items-center gap-4">
        {guesserCharacter ? (
          <>
            <Avatar src={guesserCharacter.imageUrl} size="md" />
            <div className="min-w-0">
              <p className="font-display text-xs uppercase tracking-widest text-fg-subtle">
                {guesser?.name} is
              </p>
              <p className="truncate font-display text-xl font-extrabold text-fg-strong">
                {guesserCharacter.name}
              </p>
              <p className="truncate text-sm text-fg-helper">{guesserCharacter.series}</p>
            </div>
          </>
        ) : (
          <p className="text-base text-fg-subtle">Loading their character…</p>
        )}
      </Card>

      {/* The pinned card above covers the player being answered right now; this
          is for the ones whose turn will come back around. */}
      <WhoIsWhoPanel entries={whoIsWho} className="mb-6" />

      {!live && (
        <div className="py-8 text-center">
          <div className="mb-3 text-6xl text-fg-icon"><Icon name="hourglass" /></div>
          <p className="text-lg text-fg-helper">Waiting for a question or guess…</p>
        </div>
      )}

      {live && pendingAction.kind === 'question' && (
        <div className="mb-8 text-center">
          <SpeechBubble who={guesser?.name}>{pendingAction.text}</SpeechBubble>
          <div className="flex gap-4">
            <Button
              variant="success"
              size="xl"
              sound="yes"
              className="flex-1"
              onClick={() => onAnswer('Yes')}
              disabled={resolving}
            >
              <Icon name="check" /> Yes
            </Button>
            <Button
              variant="danger"
              size="xl"
              sound="no"
              className="flex-1"
              onClick={() => onAnswer('No')}
              disabled={resolving}
            >
              <Icon name="cross" /> No
            </Button>
          </div>
          <p className="mt-3 text-sm text-fg-subtle">
            Any player can answer — first one through wins.
          </p>
        </div>
      )}

      {live && pendingAction.kind === 'guess' && (
        <p className="mb-8 text-center text-lg text-fg-body">
          Checking guess: &quot;{pendingAction.text}&quot;…
        </p>
      )}

      <QuestionLog title={`${guesser?.name}'s Question Log`} entries={questionLog} />
    </Screen>
  );
}
