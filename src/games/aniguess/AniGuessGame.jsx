import { useState } from 'react';
import LocalGame from './LocalGame';
import OnlineGame from './OnlineGame';
import descriptor from './index';
import ModePicker from '../../shared/components/ModePicker';

export default function AniGuessGame({ onExit }) {
  const [mode, setMode] = useState(null); // null | 'local' | 'online'

  // Same onBack OnlineGame has always had: local play could otherwise only leave
  // by the Hub button, so switching to online meant a full round-trip through it.
  if (mode === 'local') return <LocalGame onExit={onExit} onBack={() => setMode(null)} />;
  if (mode === 'online') return <OnlineGame onBack={() => setMode(null)} onExit={onExit} />;

  return (
    <ModePicker
      game={descriptor}
      tagline="The anime character guessing game"
      onLocal={() => setMode('local')}
      onOnline={() => setMode('online')}
      onExit={onExit}
    />
  );
}
