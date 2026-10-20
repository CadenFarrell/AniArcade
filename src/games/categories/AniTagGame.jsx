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
      // Mode-neutral on purpose: this screen sits BEFORE the setting that
      // decides whether the hidden clause is yours or somebody else's, so
      // naming either half here would be wrong half the time.
      tagline="Everyone has a secret category. Name things until you work one out."
      onLocal={() => setMode('local')}
      onOnline={() => setMode('online')}
      onExit={onExit}
    />
  );
}
