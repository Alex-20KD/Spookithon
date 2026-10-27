import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/game-store';
import { useCharacterStore } from '../store/character-store';
import { DIFFICULTIES, Difficulty } from '../game/difficulty';
import { hasSeenTutorial } from '../game/tutorial';
import { isMuted, setMuted, playSound } from '../game/sound';
import MapCanvas from './MapCanvas';
import ControlPanel from './ControlPanel';
import StatsPanel from './StatsPanel';
import NewsPanel from './NewsPanel';
import CantonDetailPanel from './CantonDetailPanel';
import MissionsPanel from './game/MissionsPanel';
import CharacterToast from './game/CharacterToast';
import EventModal from './game/EventModal';
import AdvisorModal from './game/AdvisorModal';
import EndScreen from './game/EndScreen';
import Tutorial from './game/Tutorial';
import { usePreloadPortraits } from './game/shared';
import './SimulatorGame.css';

interface SimulatorGameProps {
  mode: 'government' | 'virus';
  difficulty: Difficulty;
  forceTutorial?: boolean;
  onBackToMenu: () => void;
  onPlayAgain: () => void;
}

const SPEED_MS = { normal: 2000, fast: 500, ultra: 100 } as const;

const SimulatorGame: React.FC<SimulatorGameProps> = ({ mode, difficulty, forceTutorial, onBackToMenu, onPlayAgain }) => {
  const initializeGame = useGameStore(s => s.initializeGame);
  const simulateDay = useGameStore(s => s.simulateDay);
  const simulationSpeed = useGameStore(s => s.simulationSpeed);
  const tutorialActive = useGameStore(s => s.tutorialActive);
  const activeEvent = useGameStore(s => s.activeEvent);
  const gameOver = useGameStore(s => s.gameOver);
  const [ready, setReady] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => forceTutorial || !hasSeenTutorial(mode));
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  const intervalRef = useRef<number | null>(null);
  usePreloadPortraits();

  useEffect(() => {
    // Paciente cero en Manta, con la dificultad elegida
    initializeGame(mode, 'manta', difficulty);
    setReady(true);
    return () => {
      useGameStore.getState().setSimulationSpeed('paused');
      useCharacterStore.getState().clear();
    };
  }, [mode, difficulty, initializeGame]);

  // Bucle de simulación: se detiene durante el tutorial, los eventos, el asesor y al terminar
  const running = simulationSpeed !== 'paused' && !tutorialActive && !activeEvent && !gameOver && !advisorOpen;
  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => simulateDay(), SPEED_MS[simulationSpeed]);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running, simulationSpeed, simulateDay]);

  const closeTutorial = useCallback(() => setShowTutorial(false), []);
  const closeAdvisor = useCallback(() => setAdvisorOpen(false), []);

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
    if (muted) playSound('click');
  };

  const diff = DIFFICULTIES[difficulty];

  return (
    <div className="simulator-game">
      <header className="game-header">
        <div className="header-left">
          <button className="back-button gothic-button" onClick={onBackToMenu}>
            ← MENÚ
          </button>
        </div>
        <div className="header-center">
          <h1 className="gothic-text">{mode === 'government' ? '🏛️ MODO GOBIERNO' : '🦠 MODO VIRUS'}</h1>
          <span className="difficulty-badge" title={diff.description}>
            {diff.icon} {diff.label}
          </span>
        </div>
        <div className="header-right">
          <button
            className="gothic-button advisor-button"
            data-tour="advisor"
            onClick={() => {
              playSound('click');
              setAdvisorOpen(true);
            }}
            disabled={!!gameOver}
          >
            🧠 Pedir consejo
          </button>
          <button className="icon-button" onClick={toggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'} title={muted ? 'Activar sonido' : 'Silenciar'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      <div className="game-layout">
        <aside className="left-panel">
          <StatsPanel />
          <CantonDetailPanel />
        </aside>

        <main className="game-main">
          <MapCanvas />
        </main>

        <aside className="right-panel">
          <ControlPanel mode={mode} />
          <MissionsPanel />
          <NewsPanel />
        </aside>
      </div>

      {ready && showTutorial && <Tutorial mode={mode} onFinish={closeTutorial} />}
      {!showTutorial && <CharacterToast />}
      <EventModal />
      {advisorOpen && <AdvisorModal onClose={closeAdvisor} />}
      <EndScreen onPlayAgain={onPlayAgain} onMenu={onBackToMenu} />
    </div>
  );
};

export default SimulatorGame;
