import { useState } from 'react';
import SecretCard from './SecretCard';
import ClueLog from './ClueLog';
import { countWords } from '../rules';
import {
  Backdrop,
  Badge,
  Banner,
  Button,
  Card,
  GhostButton,
  Icon,
  Input,
  Screen,
  Wordmark,
} from '../../../shared/ui';
import RoundHeader from '../../../shared/components/RoundHeader';
import PlayerRow from '../../../shared/components/PlayerRow';
import LocalClock from '../../../shared/components/LocalClock';

// The clue lap, both locally and online. One screen for both because the only
// difference is who is allowed to type: locally the device passes and whoever
// is holding it types, online the input appears on one player's device and
// everyone else watches the log fill in.
//
// Turn order is the game. Going later means more clues to work from — and a
// blind fake who spoke first would have nothing at all to go on — so this is
// deliberately NOT AniRank's everyone-commits-at-once cursor.
export default function ClueRound({
  clues = [],
  players = [],
  speaker,
  isMyTurn,
  card = null, // online only: your own card, inline, since the device is private
  wordLimit = 1,
  lap = 0,
  laps = 1,
  local = false,
  // Local "talk it out": the clue is said out loud and never recorded. Defaults
  // off, so the online path through this same component is untouched.
  talkMode = false,
  turn = 0,
  total = 0,
  onSubmit,
  onPass,
  onQuit,
  error,
  // The clue clock (rules.CLUE_SECONDS_OPTIONS), 0 for none. Every device runs
  // its own copy keyed on the turn, so the whole table sees the time draining;
  // only the speaker's device acts on it (`onTimeout`), which is the one device
  // that would have typed the clue. Nothing goes in the room — a turn changes
  // within a beat on every phone, and a refresh mid-turn restarting one clock
  // is cheaper than a deadline in state that every write would have to carry.
  clueSeconds = 0,
  onTimeout,
}) {
  const [text, setText] = useState('');

  const words = countWords(text);
  const overLimit = words > wordLimit;
  const canSend = words > 0 && !overLimit;

  const send = () => {
    if (!canSend) return;
    onSubmit(text);
    setText('');
  };

  return (
    <>
      <Backdrop />
      <Screen width="md">
        {/* The tab is how far round the table the turn has got in talk mode —
            nothing is recorded there, so it is the only progress signal — and
            the clue round otherwise, hidden at one round, where "1 of 1" is
            noise. */}
        <RoundHeader
          title="Clues"
          tag={talkMode ? `Clue ${Math.min(turn + 1, total)}/${total}` : laps > 1 ? `Round ${lap + 1}/${laps}` : null}
          hint={`One ${wordLimit === 1 ? 'word' : `to ${wordLimit} words`} about the secret character. Say too little and nobody believes you; say too much and the fake learns it too.`}
        >
          {talkMode && laps > 1 && <Badge tone="neutral">Clue round {lap + 1} of {laps}</Badge>}
        </RoundHeader>

        {/* Turn order is the game, so it is on screen as the row of faces with
            whoever speaks now framed under NOW. */}
        <PlayerRow players={players} activeId={speaker?.id ?? null} label="Clue order" />

        {clueSeconds > 0 && speaker && (
          <LocalClock
            key={`${turn}:${clues.length}:${speaker.id}`}
            ms={clueSeconds * 1000}
            label={isMyTurn ? 'Time for your clue' : `Time for ${speaker.name}'s clue`}
            onExpire={() => { if (isMyTurn) { setText(''); onTimeout?.(); } }}
          />
        )}

        {card && (
          <div className="mb-5">
            <SecretCard card={card} compact />
          </div>
        )}

        {/* Nothing is recorded in talk mode, so the log is dropped rather than
            left standing empty — a permanently blank card reads as a bug. What
            replaces it is the only progress signal left: how far round the
            table the turn has got. */}
        {!talkMode && (
          <Card title={`Clues (${clues.length})`} padding="lg" className="mb-6">
            {clues.length === 0 && (
              <p className="text-fg-subtle">Nothing said yet.</p>
            )}
            <ClueLog clues={clues} players={players} />
          </Card>
        )}

        {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

        {isMyTurn && talkMode ? (
          <Card padding="lg" className="border-pop-teal text-center">
            <div className="text-5xl text-pop-teal"><Icon name="speech" /></div>
            <p className="mt-3 font-display text-2xl font-extrabold text-fg-strong">
              {speaker?.name ?? ''}, say your {wordLimit === 1 ? 'word' : 'clue'} out loud
            </p>
            <p className="mt-2 text-fg-helper">
              Everyone heard it — tap when you&apos;re done and the turn moves on.
            </p>
            <Button
              variant="success"
              size="xl"
              fullWidth
              className="mt-6"
              onClick={onPass}
            >
              Said it
            </Button>
          </Card>
        ) : isMyTurn ? (
          <Card padding="lg" className="border-pop-teal">
            <p className="mb-3 font-display text-lg font-extrabold text-fg-strong">
              {local ? `${speaker?.name ?? ''}, your clue` : 'Your clue'}
            </p>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder={wordLimit === 1 ? 'One word…' : `Up to ${wordLimit} words…`}
              maxLength={24}
              autoFocus
              aria-label="Your clue"
            />
            {overLimit && (
              <p className="mt-2 text-base text-pop-red">
                {wordLimit === 1 ? 'One word only.' : `${wordLimit} words at most.`} That&apos;s {words}.
              </p>
            )}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-4"
              onClick={send}
              disabled={!canSend}
            >
              Say it
            </Button>
          </Card>
        ) : (
          <Card padding="lg" className="text-center">
            <p className="font-display text-lg font-extrabold text-fg-strong">
              Waiting for {speaker?.name ?? 'the next player'}…
            </p>
            <p className="mt-1 text-fg-helper">Their device has the input.</p>
          </Card>
        )}

        <div className="mt-6 text-center">
          <GhostButton onClick={onQuit}>← Leave the round</GhostButton>
        </div>
      </Screen>
    </>
  );
}
