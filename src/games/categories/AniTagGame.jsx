import { useState } from 'react';
import LocalGame from './LocalGame';
import OnlineGame from './OnlineGame';
import descriptor from './index';
import ModePicker from '../../shared/components/ModePicker';

export default function AniTagGame({ onExit }) {
  const [mode, setMode] = useState(null); // null | 'local' | 'online'

  if (mode === 'local') return <LocalGame onExit={onExit} onBack={() => setMode(null)} />;
  if (mode === 'online') return <OnlineGame onBack={() => setMode(null)} onExit={onExit} />;

  return (
    <ModePicker
      game={descriptor}
      // Source-neutral on purpose: this screen sits BEFORE the setting that
      // decides whether the table picks the clauses or the game deals them.
      tagline="Everyone can see your secret category but you. Name things until you work it out."
      onLocal={() => setMode('local')}
      onOnline={() => setMode('online')}
      onExit={onExit}
    />
  );
}
