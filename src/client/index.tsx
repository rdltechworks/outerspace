
import React from 'react';
import { createRoot } from 'react-dom/client';
import GameContainer from './components/GameContainer';

const App = () => {
  return <GameContainer />;
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
