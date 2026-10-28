import { TEAM_NAMES } from '../../../shared/utils/teams';
import { Avatar, Card } from '../../../shared/ui';
import { giverShare, isTeamShape } from '../rules';

// What happened, and who it was. The character arrives a moment after the
// turn ends online (the giver's phone publishes it — nobody else can), so the
// card says so rather than drawing an empty panel. Below it the sentence that
// got there, word by word, and anyone the givers turned down first.
export default function RoundReveal({ game, players, youId = null, children }) {
  const { result, reveal } = game;
  const nameOf = (id) => (youId && id === youId ? 'You' : players.find((p) => p.id === id)?.name ?? 'Someone');
  const entry = game.log[game.log.length - 1];
  const character = reveal?.character ?? null;
  const [a, b] = game.givers.map(nameOf);

  let line = null;
  if (result?.kind === 'got') {
    const after = `after ${result.n} word${result.n === 1 ? '' : 's'}`;
    line = isTeamShape(game.shape)
      ? `${nameOf(result.by)} got it ${after} — +${result.value} for ${TEAM_NAMES[result.team]}.`
      : `${nameOf(result.by)} got it ${after} — +${result.value}, and ${a} and ${b} +${giverShare(result.value)} each.`;
  } else if (result?.kind === 'out') line = `Nobody got it in ${game.cap} words. No points.`;
  else if (result?.kind === 'banned') line = `${nameOf(result.by)} said a word that was off limits. No points.`;
  else if (result?.kind === 'void') {
    line = result.by ? `${nameOf(result.by)} left mid-turn. No points.` : 'Nobody was left to guess. No points.';
  }

  return (
    <>
      <Card padding="lg" className="mb-5">
        {character ? (
          <div className="flex items-center gap-4">
            <Avatar src={character.imageUrl} alt="" size="lg" />
            <div className="min-w-0">
              <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fg-helper">It was</p>
              <p className="font-display text-3xl font-bold uppercase leading-tight tracking-wide text-fg-strong [overflow-wrap:anywhere]">
                {character.name}
              </p>
              {character.series && <p className="text-fg-body [overflow-wrap:anywhere]">{character.series}</p>}
            </div>
          </div>
        ) : (
          <p className="text-center text-fg-helper">
            {result?.kind === 'void' ? 'The character left with the clue-givers.' : 'Revealing the character…'}
          </p>
        )}
        {line && <p className="mt-4 text-center text-lg text-fg-body">{line}</p>}
      </Card>
      {entry?.chain?.some(Boolean) && (
        <section className="mb-5" aria-labelledby="anichain-sentence">
          <h3 id="anichain-sentence" className="mb-1 font-display text-sm font-bold uppercase tracking-[0.2em] text-fg-helper">
            The sentence
          </h3>
          <p className="text-lg text-fg-body [overflow-wrap:anywhere]">{entry.chain.join(' ')}</p>
        </section>
      )}
      {reveal?.skipped?.length > 0 && (
        <p className="mb-5 text-sm text-fg-helper">
          Passed on first: {reveal.skipped.map((c) => c.name).join(', ')}.
        </p>
      )}
      {children}
    </>
  );
}
