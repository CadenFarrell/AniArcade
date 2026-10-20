import { KANA } from '../ui/kanaText';

// A final standings list split for the results splash: who gets the panel, who
// goes in the list under it, and what the stamp says.
//
// Everyone sharing first place shares the panel. computeRankedPlayers (and
// AniQuiz's `standings`) give tied players the same position, so position 1 is
// the whole tie — the first name in seat order winning the splash would be the
// screen quietly breaking a tie the rules call a tie.
//
// A table of one is a quiz on your own (AniQuiz allows it), where "Winner"
// over the only player reads as a joke at their expense.
export function splitPodium(ranked = []) {
  const winners = ranked.filter((p) => p.position === 1);
  const rest = ranked.filter((p) => p.position !== 1);
  if (ranked.length === 1) return { winners, rest, stamp: 'Finished', kana: KANA.results };
  if (winners.length > 1) return { winners, rest, stamp: 'Tied', kana: KANA.draw };
  return { winners, rest, stamp: 'Winner', kana: KANA.winner };
}
