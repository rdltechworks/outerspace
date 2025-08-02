
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Home from './components/Home';
import GameScene from './components/Game';

const App = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleLaunchGame = () => {
    setIsPlaying(true);
  };

  if (isPlaying) {
    // For now, we'll hardcode the system and username.
    // In the future, this will come from a login/selection screen.
    return <GameScene systemId="sol-system" username="Player" />;
  }

  return <Home onLaunchGame={handleLaunchGame} />;
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
