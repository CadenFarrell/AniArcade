// "AniGuess" → { prefix: 'Ani', word: 'Guess' }. Every title on the board
// starts with the same three letters, which is exactly what made seven tiles
// hard to tell apart at a glance — so the tile sets the shared prefix small and
// the word that differs large. Split only where a capital follows "Ani", so a
// future title that merely begins with those letters ("Animal Crossing Quiz")
// stays whole, as does any title without the prefix.
export function splitTitle(title = '') {
  return /^Ani(?=\p{Lu})/u.test(title)
    ? { prefix: title.slice(0, 3), word: title.slice(3) }
    : { prefix: '', word: title };
}
