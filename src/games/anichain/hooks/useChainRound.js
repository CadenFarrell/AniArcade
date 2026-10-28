import { useCallback, useMemo, useState } from 'react';
import { castIndex } from '../chainWords';
import { dealCard, drawCharacter } from '../deal';
import * as rules from '../rules';

// Local persistence for one AniChain game: the rules decide, this only holds
// the state. The online twin (useChainRoom) keeps the same handler names.
//
// The card lives BESIDE the game, never in it, exactly as online it lives in
// the givers' secrets/ nodes: the game only ever learns that a turn was dealt,
// and who it was once the turn is over (publishReveal). Everyone is on one
// device, so the "active" roster is the whole table and nothing settles.
//
// Words are said out loud, so `word` only counts one (text null), and there is
// no clock: a table guessing aloud sets its own pace.

// Who the draw should look for a shared character with: everyone the turn's
// words could be for.
function drawGuessers(game) {
  if (game.shape === 'rivals') return game.order.filter((id) => !game.givers.includes(id));
  return rules.guessersFor(game, game.givers[0]);
}

export function useChainRound(players, settings, teams, pack) {
  const index = useMemo(() => castIndex(players, pack), [players, pack]);

  // One state object, so a move and the card it calls for (a skip's redraw, a
  // new turn's deal, the reveal at its end) land in the same update.
  const [s, setS] = useState(() => {
    const game = rules.startGame({ ids: players.map((p) => p.id), ...settings, teams });
    return settle({ game, card: null, used: [], skipped: [] });
  });

  // After every move: a turn waiting on a card gets one, and a turn just over
  // publishes the card it was played with.
  function settle(next) {
    let { game, card, used, skipped } = next;
    if (game.phase === 'deal' && card?.deal !== game.deal) {
      // A skip: this turn's card goes on the skipped list the reveal shows.
      if (card && card.turn === rules.turnNo(game)) skipped = [...skipped, card.character];
      else skipped = [];
      const character = drawCharacter(players, {
        givers: game.givers, guessers: drawGuessers(game), used, pool: settings.pool,
      });
      if (!character) {
        // The lists are spent: end the game rather than deal a blank.
        return { game: { ...game, phase: 'finished' }, card: null, used, skipped };
      }
      card = { ...dealCard(index, character), deal: game.deal, turn: rules.turnNo(game) };
      used = [...used, character.key];
    }
    if (game.phase === 'over' && !game.reveal && card) {
      game = { ...game, ...rules.publishReveal(game, rules.turnNo(game), { character: card.character, skipped }).patch };
    }
    return { game, card, used, skipped };
  }

  // Rules run inside the updater so two quick taps both see current state.
  const apply = useCallback((fn) => {
    setS((prev) => {
      const { patch } = fn(prev.game);
      if (!patch || !Object.keys(patch).length) return prev;
      return settle({ ...prev, game: { ...prev.game, ...patch } });
    });
  // settle reads only `players`, `settings` and `index`, fixed for a game.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    game: s.game,
    card: s.game.phase === 'deal' || s.game.phase === 'chain' ? s.card : null,
    index,
    begin: useCallback(() => apply((g) => rules.markDealt(g, g.deal)), [apply]),
    skip: useCallback((id) => apply((g) => rules.skip(g, id)), [apply]),
    word: useCallback(() => apply((g) => rules.addWord(g, rules.nextGiver(g))), [apply]),
    gotIt: useCallback((id) => apply((g) => rules.gotIt(g, id)), [apply]),
    outOfWords: useCallback(() => apply((g) => rules.outOfWords(g)), [apply]),
    banned: useCallback((id) => apply((g) => rules.bannedWord(g, id)), [apply]),
    next: useCallback(() => apply((g) => rules.nextTurn(g)), [apply]),
  };
}
