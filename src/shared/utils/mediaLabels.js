// How AniList's enum values read on screen. Lifted out of AniQuiz's clues.js
// when AniPeek's hint cards needed the same words: a show's source said
// "Light novel" in one game and something else in another would be two
// spellings of one fact.
//
// `OTHER` (and AniList's rarer sources) are deliberately absent from
// SOURCE_LABELS — "Other" is not a fact anyone can use, so a caller treats a
// missing label as "nothing to say".
export const SOURCE_LABELS = {
  MANGA: 'Manga',
  LIGHT_NOVEL: 'Light novel',
  ORIGINAL: 'Original (no source)',
  VISUAL_NOVEL: 'Visual novel',
  VIDEO_GAME: 'Video game',
};

export const SEASON_LABELS = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' };

// A format as the noun a sentence uses ("Bones animated this TV series").
// AniPeek capitalises the first letter for a card; MUSIC has no noun worth
// saying, so it falls through to the caller's default.
export const FORMAT_NOUNS = {
  TV: 'TV series',
  TV_SHORT: 'short series',
  MOVIE: 'film',
  ONA: 'web series',
  OVA: 'OVA',
  SPECIAL: 'special',
};
