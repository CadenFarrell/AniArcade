import { useState } from 'react';
import LocalGame from './LocalGame';
import OnlineGame from './OnlineGame';
import descriptor from './index';
import { TAGLINE } from './copy';
import ModePicker from '../../shared/components/ModePicker';

export default function AniNameGame({ onExit }) {
  const [mode, setMode] = useState(null); // null | 'local' | 'online'

  if (mode === 'local') return <LocalGame onExit={onExit} onBack={() => setMode(null)} />;
  if (mode === 'online') return <OnlineGame onBack={() => setMode(null)} onExit={onExit} />;

  return (
    <ModePicker
      game={descriptor}
      tagline={TAGLINE}
      onLocal={() => setMode('local')}
      onOnline={() => setMode('online')}
      onExit={onExit}
    />
  );
}
