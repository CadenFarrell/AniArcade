import aniguess from '../games/aniguess';
import anitune from '../games/anitune';
import anirank from '../games/anirank';
import anifake from '../games/anifake';
import aniwave from '../games/wavelength';
import anitag from '../games/categories';
import aniquiz from '../games/aniquiz';
import aniturf from '../games/aniturf';
import anipeek from '../games/anipeek';
import aniout from '../games/aniout';
import aniname from '../games/aniname';

// The hub renders this list and nothing else — adding a game means adding a
// folder under src/games/ and one line here. Keep the order stable; it is the
// order players see on the menu.
export const games = [aniguess, anitune, anirank, anifake, aniwave, anitag, aniquiz, aniturf, anipeek, aniout, aniname];
