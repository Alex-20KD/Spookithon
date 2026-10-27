import { useState, useCallback } from 'react';
import './App.css';
import EpicTrailer from './components/Cinematic/EpicTrailer';
import MainMenu, { StartOptions } from './components/MainMenu';
import SimulatorGame from './components/SimulatorGame';
import CombatMode from './components/CombatMode';

type GameScreen = 'cinematic' | 'menu' | 'game';

const CINEMATIC_SEEN_KEY = 'cinematic-seen';

function cinematicSeen(): boolean {
  try {
    return sessionStorage.getItem(CINEMATIC_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function App() {
  // El tráiler se reproduce solo la primera vez en la sesión; después se puede ver desde el menú
  const [currentScreen, setCurrentScreen] = useState<GameScreen>(() => (cinematicSeen() ? 'menu' : 'cinematic'));
  const [trailerRun, setTrailerRun] = useState(0); // fuerza a reiniciar el tráiler en cada reproducción
  const [game, setGame] = useState<StartOptions>({ mode: 'government', difficulty: 'normal', forceTutorial: false });
  const [gameRun, setGameRun] = useState(0); // "Jugar otra vez" monta una partida nueva

  const handleCinematicComplete = useCallback(() => {
    try {
      sessionStorage.setItem(CINEMATIC_SEEN_KEY, 'true');
    } catch {
      // sin sessionStorage el tráiler simplemente vuelve a salir al recargar
    }
    setCurrentScreen('menu');
  }, []);

  const handlePlayTrailer = useCallback(() => {
    setTrailerRun(n => n + 1);
    setCurrentScreen('cinematic');
  }, []);

  const handleStart = useCallback((options: StartOptions) => {
    setGame(options);
    setGameRun(n => n + 1);
    setCurrentScreen('game');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGame(g => ({ ...g, forceTutorial: false }));
    setGameRun(n => n + 1);
  }, []);

  const handleBackToMenu = useCallback(() => setCurrentScreen('menu'), []);

  return (
    <div className="app">
      {currentScreen === 'cinematic' && <EpicTrailer key={trailerRun} onComplete={handleCinematicComplete} />}

      {currentScreen === 'menu' && <MainMenu onStart={handleStart} onPlayTrailer={handlePlayTrailer} />}

      {currentScreen === 'game' && game.mode !== 'combat' && (
        <SimulatorGame
          key={gameRun}
          mode={game.mode}
          difficulty={game.difficulty}
          forceTutorial={game.forceTutorial}
          onBackToMenu={handleBackToMenu}
          onPlayAgain={handlePlayAgain}
        />
      )}

      {currentScreen === 'game' && game.mode === 'combat' && (
        <CombatMode
          key={gameRun}
          difficulty={game.difficulty}
          forceTutorial={game.forceTutorial}
          onBackToMenu={handleBackToMenu}
        />
      )}
    </div>
  );
}

export default App;
