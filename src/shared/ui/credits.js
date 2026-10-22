// Where every piece of artwork, sound and type in the app came from, and what
// was done to it. Two jobs: it feeds the Credits dialog on the hub and the line
// under the title screen, and it is the reproduction record — there is no
// generator script for these files, because each was processed exactly once, so
// this is how somebody re-fetches a print or swaps a sound without guessing.
//
// The licence matters more than the credit. Every entry here is public domain
// (CC0) or OFL, and the art direction was chosen around that: real prints, not
// generated imagery, at no cost and with no attribution strings that could be
// got wrong. Keep it that way — a new asset whose licence is not one of these
// two needs a decision, not just a line here.
//
// The hub tiles are NOT in this file because they are not assets: they are
// portraits from each player's own imported list (hub/tileCharacters.js),
// loaded from AniList the same way every in-game Avatar already is. Nothing of
// theirs ships with the app.

// The prints. Met Open Access objects, each confirmed `isPublicDomain: true` on
// its API record (collectionapi.metmuseum.org/public/collection/v1/objects/<id>).
// Processing, in a scratch Pillow script: trim ~1.5% of mount off each edge,
// grayscale, a 1.2px blur to drop the scanned paper fibre (it was most of the
// bytes and none of the picture), autocontrast, a light unsharp, then WebP.
// The red on screen is never in the file — the sun disc and slashes are CSS.
//
// Two derived files, not entries here because they credit nothing new:
// public/og.png, the link preview, is the rooftop print laid over the sun disc
// beside the wordmark in Oswald, Archivo and the kana cut — the hub hero's
// trick, rendered once to 1200×630 with Playwright from a scratch page; and
// public/icons/, favicon.svg rendered on paper at the manifest's sizes (the
// maskable one inside the 80% safe zone). Redo both by hand if either source
// changes.
export const ART = {
  wave: {
    src: '/art/great-wave.webp',
    title: 'Under the Wave off Kanagawa (The Great Wave)',
    artist: 'Katsushika Hokusai',
    date: 'ca. 1830–32',
    source: 'The Metropolitan Museum of Art',
    url: 'https://www.metmuseum.org/art/collection/search/45434',
    licence: 'Public domain (CC0)',
  },
  rooftop: {
    src: '/art/horyukaku.webp',
    title: 'The Hōryūkaku, from Hakkenden (Tale of Eight Dogs)',
    artist: 'Utagawa Kuniyoshi',
    date: '1840',
    source: 'The Metropolitan Museum of Art',
    url: 'https://www.metmuseum.org/art/collection/search/893332',
    licence: 'Public domain (CC0)',
  },
  shower: {
    src: '/art/shono-shower.webp',
    title: 'Sudden Shower at Shōno, from the Fifty-three Stations of the Tōkaidō',
    artist: 'Utagawa Hiroshige',
    date: '1834–35',
    source: 'The Metropolitan Museum of Art',
    url: 'https://www.metmuseum.org/art/collection/search/36521',
    licence: 'Public domain (CC0)',
  },
};

// The sounds: Kenney's "Interface Sounds" 1.0, converted .ogg → mono 96 kbps
// .mp3 with a throwaway ffmpeg. The source file for each published name:
//   tap ← click_001     back ← back_001      select ← select_002
//   start ← confirmation_002   open ← open_001   close ← close_001
//   toggle ← toggle_001
// and the games' own, added with the same tool (picked by length and by pitch
// direction — a rising confirmation for right, a falling error for wrong, the
// pack's lowest-pitched error as the time's-up buzzer):
//   correct ← confirmation_004   wrong ← error_003    yes ← confirmation_001
//   no ← error_008      turn ← question_003    buzz ← bong_001
//   tick ← tick_002     timeup ← error_006     reveal ← maximize_004
//   stamp ← drop_004
export const SOUND_PACK = {
  title: 'Interface Sounds',
  artist: 'Kenney',
  source: 'kenney.nl',
  url: 'https://kenney.nl/assets/interface-sounds',
  licence: 'Public domain (CC0)',
};

// Downloaded from Google Fonts as woff2. Dela Gothic One is a cut — see kanaText.js.
export const FONTS = [
  { title: 'Oswald', artist: 'Vernon Adams and contributors', licence: 'SIL Open Font License' },
  { title: 'Archivo', artist: 'Omnibus-Type', licence: 'SIL Open Font License' },
  { title: 'Dela Gothic One', artist: 'artakana', licence: 'SIL Open Font License' },
];
