import { useState } from 'react';
import LocalGame from './LocalGame';
import OnlineGame from './OnlineGame';
import descriptor from './index';
import ModePicker from '../../shared/components/ModePicker';

export default function WavelengthGame({ onExit }) {
  const [mode, setMode] = useState(null); // null | 'local' | 'online'

  if (mode === 'local') return <LocalGame onExit={onExit} onBack={() => setMode(null)} />;
  if (mode === 'online') return <OnlineGame onBack={() => setMode(null)} onExit={onExit} />;

  return (
    <ModePicker
      game={descriptor}
      tagline="One of you knows where the target is. Say the right words."
      onLocal={() => setMode('local')}
      onOnline={() => setMode('online')}
      onExit={onExit}
    />
  );
}
