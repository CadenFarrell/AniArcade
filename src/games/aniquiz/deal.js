// Settings + players + pack → the deal rules.js plays. One function so local
// play and the online host deal identically; everything it calls is pure.
import { dealBoard, dealQuiz, enabledTopics } from './clues';
import { BOARD, QUIZ, CHOICE, TYPED } from './rules';
import { showKeysFor } from './utils/pool';

/**
 * Returns { deal } or { error } — the error a sentence the setup screen can
 * show as-is, because the only failure here is "this pool cannot fill what was
 * asked for", and the fix is always a setting.
 */
export function buildDeal(index, players, settings, rng = Math.random) {
  if (!index) return { error: 'The fact pack has not loaded yet.' };
  const keys = showKeysFor(players, settings.pool, index);
  const answerStyle = settings.answerStyle === TYPED ? TYPED : CHOICE;
  const choices = answerStyle === CHOICE;
  const topics = enabledTopics(settings.topicsOff);
  if (!topics.length) return { error: NO_TOPICS };

  if (settings.format === QUIZ) {
    const res = dealQuiz(index, keys, { count: settings.quizLength, choices, topics, rng });
    if (res.error) return { error: NOT_ENOUGH };
    return {
      deal: {
        format: QUIZ, answerStyle, questions: res.questions, categories: [], dailyDouble: null, final: null,
      },
    };
  }

  const res = dealBoard(index, keys, {
    categories: settings.categories,
    choices,
    dailyDouble: settings.dailyDouble,
    finalRound: settings.finalRound,
    topics,
    rng,
  });
  if (res.error) return { error: NOT_ENOUGH };
  return {
    deal: {
      format: BOARD,
      answerStyle,
      categories: res.categories,
      dailyDouble: res.dailyDouble,
      final: res.final,
      questions: [],
    },
  };
}

const NOT_ENOUGH = 'Not enough of these shows are in the fact pack to fill a game. '
  + 'Widen the pool — “Shows anyone has” or “The whole fact pack” — or switch more categories on.';
const NO_TOPICS = 'Every category is switched off. Switch at least one back on.';
