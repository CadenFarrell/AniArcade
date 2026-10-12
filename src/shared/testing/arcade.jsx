// Shared harness for component tests (`*.test.jsx`, jsdom). Not itself a test:
// it does not match vitest's include glob, so it only runs when a test imports it.
//
// It mounts what main.jsx mounts — the same providers in the same order — so a
// test exercises the tree a player actually gets rather than a screen in
// isolation that happens to be missing the context it reads.
import { render } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';
import ProfileProvider from '../context/ProfileProvider';
import HelpDetailProvider from '../context/HelpDetailProvider';
import { profileIdFromName } from '../utils/profileStats';

export function renderArcade(ui) {
  return render(
    <ErrorBoundary>
      <ProfileProvider>
        <HelpDetailProvider>{ui}</HelpDetailProvider>
      </ProfileProvider>
    </ErrorBoundary>
  );
}

// A profile big enough to clear every game's minimum pool (AniRank deals ten
// cards; AniWave's card modes want MIN_CARD_POOL), written in the STORED shape
// — the one AniList import persists — so it goes through normalizeProfile on
// the way in exactly as a real one would.
export function makeProfile(name, shows = 14) {
  const id = profileIdFromName(name);
  return {
    id,
    name,
    animeList: Array.from({ length: shows }, (_, i) => ({
      id: `${id}_anime_${i}`,
      title: `Test Show ${String.fromCharCode(65 + i)}`,
      startDate: { year: 2000 + i },
      episodes: 12 + i,
      averageScore: 60 + i,
      popularity: 1000 * (i + 1),
      characters: [0, 1].map((c) => ({
        id: `${id}_char_${i}_${c}`,
        name: `Hero${String.fromCharCode(65 + i)} ${c ? 'Rival' : 'Lead'}`,
        role: c ? 'SUPPORTING' : 'MAIN',
        gender: c ? 'Female' : 'Male',
        favourites: 100 * (i + 1) + c,
        genres: ['Action'],
      })),
    })),
  };
}

// Seeds localStorage the way a returning player's device looks: saved profiles
// plus a main one picked in the hub.
export function seedProfiles(profiles, activeId = profiles[0]?.id) {
  localStorage.setItem(
    'aniguess_profiles',
    JSON.stringify(Object.fromEntries(profiles.map((p) => [p.id, p])))
  );
  if (activeId) localStorage.setItem('aniarcade_active_profile', JSON.stringify(activeId));
}
