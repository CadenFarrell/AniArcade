import { useState } from 'react';
import Handoff from '../../../shared/components/Handoff';
import ResultImpact from '../../../shared/components/ResultImpact';
import RoundHeader from '../../../shared/components/RoundHeader';
import { StartBar } from '../../../shared/components/SetupLayout';
import { TEAM_NAMES, teamOf } from '../../../shared/utils/teams';
import { Backdrop, Button, Card, Screen } from '../../../shared/ui';
import { useChainRound } from '../hooks/useChainRound';
import {
  SKIPS, currentGuessers, currentValue, nextGiver, totalTurns, turnNo, turnsPerRound, valueAt,
} from '../rules';
import AniChainResults from './AniChainResults';
import ChainLine from './ChainLine';
import RoundReveal from './RoundReveal';
import { revealTitle } from '../copy';
import SecretCard from './SecretCard';
import TableScores from './TableScores';

// One device in the middle of the table. The words are said out loud and the
// guesses shouted, so the device is a scorekeeper more than a screen: it shows
// the givers their character (behind a "show us" handoff, everyone else
// looking away), then counts words, and is told who got it.
//
// The givers can peek again mid-turn, behind the same handoff — a sentence
// ten words long is a lot to steer without a glance at the card.
export default function LocalRound({ players, settings, teams, pack, onPlayAgain, onBack }) {
  const round = useChainRound(players, settings, teams, pack);
  const { game, card } = round;
  // Which deal the givers have looked at (the handoff is passed once per
  // card), and whether they are peeking again mid-turn.
  const [seen, setSeen] = useState(null);
  const [peek, setPeek] = useState(false);
  const [picking, setPicking] = useState(false);

  if (game.phase === 'finished') {
    return <AniChainResults game={game} players={players} onPlayAgain={onPlayAgain} onBack={onBack} />;
  }

  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const [first, second] = game.givers;
  const givers = `${nameOf(first)} and ${nameOf(second)}`;
  const tag = `Round ${game.round + 1}/${game.rounds}`;

  // The givers' look: the handoff, then the card.
  if ((game.phase === 'deal' && card) || peek) {
    const looking = peek ? `peek:${game.deal}` : game.deal;
    if (seen !== looking) {
      return (
        <Shell>
          <Handoff
            player={players.find((p) => p.id === first)}
            kicker="Clue-givers only"
            note={`Only ${givers} look — everyone else, look away.`}
            cta={`We're ${givers} — show us`}
            onReady={() => setSeen(looking)}
          />
        </Shell>
      );
    }
    const early = game.phase === 'deal';
    return (
      <Shell>
        <RoundHeader
          title="Your Character"
          tag={tag}
          hint={early
            ? `${givers}: one word each, ${nameOf(first)} first. Don’t plan it together.`
            : 'Quick look, then hide it again.'}
        />
        <SecretCard card={card}>
          {early && game.skips < SKIPS && (
            <Button
              variant="secondary"
              fullWidth
              className="mb-3"
              // Straight to the new card: the givers are already looking.
              onClick={() => { setSeen(game.deal + 1); round.skip(first); }}
            >
              Don&apos;t know them — another
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => { if (early) round.begin(); setPeek(false); setSeen(null); }}
          >
            Hide it
          </Button>
        </SecretCard>
      </Shell>
    );
  }

  if (game.phase === 'over') {
    const last = game.round + 1 >= game.rounds && game.turn + 1 >= turnsPerRound(game.shape);
    const label = last ? 'See results' : game.turn + 1 < turnsPerRound(game.shape) ? 'Next turn' : 'Next round';
    const impact = game.result?.kind === 'got' ? 'correct' : game.result?.kind === 'void' ? null : 'wrong';
    return (
      <Shell impact={impact} eventKey={`${turnNo(game)}`}>
        <TableScores game={game} players={players} />
        <RoundHeader title={revealTitle(game.result)} tag={`Turn ${turnNo(game) + 1}/${totalTurns(game)}`} />
        <RoundReveal game={game} players={players} />
        <StartBar width="md" status={last ? 'That was the last turn.' : `Next up: a new pair of clue-givers.`} ready>
          <Button variant="primary" size="lg" onClick={() => { setPicking(false); round.next(); }}>{label}</Button>
        </StartBar>
      </Shell>
    );
  }

  // The chain.
  const n = game.chain.length;
  const capped = n >= game.cap;
  const speaker = nextGiver(game);
  const guessers = currentGuessers(game);
  const forTeam = game.shape === 'rivals' && n ? TEAM_NAMES[teamOf(game, game.chain[n - 1].by)] : null;
  const hint = !n
    ? `${nameOf(speaker)}, say the first word — worth ${valueAt(game.cap, 1)} if it’s guessed straight away.`
    // Said of the word just spoken, by name: under "<next giver>'s Word" a
    // bare "this word" read as the word still to come.
    : `${forTeam ? `${nameOf(game.chain[n - 1].by)}’s word is for ${forTeam} only. ` : ''}One guess each, out loud — worth ${currentValue(game)} now.`;
  return (
    <Shell>
      <TableScores game={game} players={players} activeId={capped ? null : speaker} />
      <RoundHeader
        title={capped ? 'Last Guesses' : `${nameOf(speaker)}'s Word`}
        tag={`Word ${Math.min(n + 1, game.cap)}/${game.cap}`}
        hint={hint}
      />
      <ChainLine game={game} players={players} />

      {n > 0 && (
        <Card title="Who got it?" padding="md" className="mb-5">
          {picking ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {guessers.map((id) => (
                <Button key={id} variant="secondary" onClick={() => { setPicking(false); round.gotIt(id); }}>
                  {nameOf(id)} got it
                </Button>
              ))}
              <Button variant="neutral" onClick={() => setPicking(false)}>Nobody yet</Button>
            </div>
          ) : (
            <Button variant="secondary" fullWidth onClick={() => setPicking(true)}>Got it</Button>
          )}
        </Card>
      )}

      <div className="mb-5 flex flex-wrap justify-center gap-3">
        <Button variant="neutral" onClick={() => { setSeen(null); setPeek(true); }}>Givers: peek again</Button>
        <Button variant="neutral" onClick={() => round.banned(speaker)}>Banned word</Button>
      </div>

      <StartBar
        width="md"
        status={capped ? `That was word ${game.cap} — last guesses, then the turn is over.` : `${nameOf(speaker)} says word ${n + 1}, then press Next word.`}
        ready
      >
        {capped
          ? <Button variant="primary" size="lg" onClick={round.outOfWords}>Out of words</Button>
          : <Button variant="primary" size="lg" onClick={() => { setPicking(false); round.word(); }}>Next word</Button>}
      </StartBar>
    </Shell>
  );
}

// Every screen's frame. The impact sits at one place in the tree for the same
// reason as AniTurf's: a fresh ResultImpact per screen would replay the last
// result whenever the screen changed.
function Shell({ impact = null, eventKey = null, children }) {
  return (
    <>
      <Backdrop />
      <ResultImpact result={impact} eventKey={impact ? eventKey : null} />
      <Screen width="md" className="pb-36!">{children}</Screen>
    </>
  );
}
