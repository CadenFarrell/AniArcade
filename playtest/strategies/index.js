// One strategy per registered game, keyed by the descriptor's `id` (which is
// not always the folder name: wavelength/ is `aniwave`, categories/ is `anitag`).
// A game added to hub/registry.js with no entry here fails its playtest on
// purpose, rather than being silently skipped.
import aniguess from './aniguess.js';
import anitune from './anitune.js';
import anirank from './anirank.js';
import anifake from './anifake.js';
import aniwave from './aniwave.js';
import anitag from './anitag.js';
import aniquiz from './aniquiz.js';

export const strategies = { aniguess, anitune, anirank, anifake, aniwave, anitag, aniquiz };
