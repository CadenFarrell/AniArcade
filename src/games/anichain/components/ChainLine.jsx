import SpeechBubble from '../../../shared/components/SpeechBubble';

// The sentence so far. Online it is the typed words, in a speech balloon
// (somebody IS talking to the whole table), each word's speaker readable from
// its underline: the first giver's words solid, the second's dashed, so two
// voices in one sentence show without leaning on colour. Locally the words
// were said out loud, so all the device has to show is how many.
export default function ChainLine({ game, players }) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const [first, second] = game.givers;
  const who = `${nameOf(first)} & ${nameOf(second)}`;
  const typed = game.chain.some((w) => w.text);

  if (!typed) {
    return (
      <p className="mb-5 text-center font-display text-lg font-bold uppercase tracking-wider text-fg-strong">
        {game.chain.length
          ? `${game.chain.length} word${game.chain.length === 1 ? '' : 's'} said`
          : 'No words yet'}
        <span className="sr-only"> by {who}</span>
      </p>
    );
  }

  return (
    <SpeechBubble who={who} verb="say">
      <span className="flex flex-wrap justify-center gap-x-2 gap-y-1">
        {game.chain.map((w, i) => (
          <span
            // A word's place in the sentence IS its identity: the same word
            // twice is two words.
            key={i}
            className={`font-display text-2xl font-bold uppercase tracking-wide text-fg-strong underline underline-offset-4
              decoration-2 ${w.by === first ? 'decoration-solid' : 'decoration-dashed'}`}
          >
            {w.text}
            <span className="sr-only"> ({nameOf(w.by)})</span>
          </span>
        ))}
        <span aria-hidden="true" className="font-display text-2xl font-bold text-fg-subtle">…</span>
      </span>
    </SpeechBubble>
  );
}
