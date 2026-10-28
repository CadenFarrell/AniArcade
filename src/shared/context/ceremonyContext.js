import { createContext, useContext } from 'react';

// The results ceremony's timing (shared/components/Results.jsx), shared between
// its rows, its splash and any staged piece a game's results screen adds of its
// own. Null when the screen is not staged. A context module rather than an
// export of Results.jsx so that file keeps exporting components only (fast
// refresh).
export const CeremonyContext = createContext(null);

// `style(i)` for row i, `after(ms)` for anything that lands once the splash
// has, `skipped` once the table pressed through.
export const useCeremonyTiming = () => useContext(CeremonyContext);
