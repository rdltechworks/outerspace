import React, { useState } from 'react';
import MainMenuUI from './MainMenuUI';
import GameScene from './GameScene';

const GameContainer = () => {
    const [isGameStarted, setIsGameStarted] = useState(false);
    const [systemId, setSystemId] = useState('sol-system');
    const [username, setUsername] = useState('Player');

    const startGame = () => {
        setIsGameStarted(true);
    };

    if (isGameStarted) {
        return <GameScene systemId={systemId} username={username} />;
    }

    return <MainMenuUI onPlay={startGame} />;
};

export default GameContainer;
