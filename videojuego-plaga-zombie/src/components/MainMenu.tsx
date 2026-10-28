import React, { useEffect, useState } from 'react';
import { DIFFICULTY_LIST, Difficulty } from '../game/difficulty';
import { formatMoney } from '../utils/format';
import { playSound } from '../game/sound';
import '../components/game/game-ui.css';
import './MainMenu.css';

export type PlayMode = 'government' | 'virus' | 'combat';

export interface StartOptions {
  mode: PlayMode;
  difficulty: Difficulty;
  forceTutorial: boolean;
}

interface MainMenuProps {
  onStart: (options: StartOptions) => void;
  onPlayTrailer: () => void;
}

// URL del panel/dashboard (app aparte). Se lee de VITE_DASHBOARD_URL; si no, local por defecto.
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:5173';

const MODES: { id: PlayMode; icon: string; name: string; desc: string }[] = [
  { id: 'government', icon: '🏛️', name: 'MODO GOBIERNO', desc: 'Salva a Manabí del apocalipsis zombie' },
  { id: 'virus', icon: '🦠', name: 'MODO VIRUS', desc: 'Infecta todos los cantones de Manabí' },
  { id: 'combat', icon: '⚔️', name: 'MODO COMBATE', desc: 'Sobrevive a oleadas de infectados' }
];

type Dialog = { kind: 'difficulty'; mode: PlayMode } | { kind: 'tutorial' } | null;

const MainMenu: React.FC<MainMenuProps> = ({ onStart, onPlayTrailer }) => {
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDialog(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  const open = (d: Dialog) => {
    playSound('click');
    setDialog(d);
  };

  return (
    <div className="main-menu">
      <div className="fog-layer"></div>

      <div className="menu-content">
        <h1 className="game-title gothic-text">
          <span className="title-main pulse">PLAGA ZOMBIE</span>
          <span className="subtitle">MANABÍ</span>
        </h1>

        <div className="menu-description">
          <p className="purple-glow flicker">El virus ha llegado a las costas de Ecuador...</p>
          <p className="blood-text">¿Protegerás a la provincia o desatarás el apocalipsis?</p>
        </div>

        <div className="mode-buttons">
          {MODES.map(m => (
            <button key={m.id} className="gothic-button mode-button" onClick={() => open({ kind: 'difficulty', mode: m.id })}>
              <span className="mode-icon">{m.icon}</span>
              <span className="mode-name">{m.name}</span>
              <span className="mode-desc">{m.desc}</span>
            </button>
          ))}
        </div>

        <div className="menu-secondary">
          <button className="gothic-button trailer-button" onClick={onPlayTrailer}>
            🎬 Ver tráiler
          </button>
          <button className="gothic-button trailer-button" onClick={() => open({ kind: 'tutorial' })}>
            📘 Ver tutorial
          </button>
          <button
            className="gothic-button trailer-button"
            onClick={() => {
              playSound('click');
              window.location.href = DASHBOARD_URL;
            }}
          >
            ← Volver al panel
          </button>
        </div>

        <div className="credits">
          <p className="purple-glow">Modelo matemático SZR • Mapa interactivo de Manabí</p>
        </div>
      </div>

      {dialog?.kind === 'difficulty' && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <div className="choice-card" role="dialog" aria-modal="true" aria-labelledby="difficulty-title" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDialog(null)} aria-label="Cerrar">
              ×
            </button>
            <h2 id="difficulty-title" className="gothic-text">
              ELIGE LA DIFICULTAD
            </h2>
            <div className="choice-grid">
              {DIFFICULTY_LIST.map(d => (
                <button
                  key={d.id}
                  className="choice-option"
                  onClick={() => {
                    playSound('click');
                    onStart({ mode: dialog.mode, difficulty: d.id, forceTutorial: false });
                  }}
                >
                  <span className="choice-option-icon">{d.icon}</span>
                  <span className="choice-option-name">{d.label}</span>
                  <span className="choice-option-desc">{d.description}</span>
                  {dialog.mode === 'government' && (
                    <span className="choice-option-detail">
                      Presupuesto {formatMoney(d.budget)} · +{formatMoney(d.budgetPerDay)}/día
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {dialog?.kind === 'tutorial' && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <div className="choice-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDialog(null)} aria-label="Cerrar">
              ×
            </button>
            <h2 id="tutorial-title" className="gothic-text">
              ¿QUÉ TUTORIAL QUIERES VER?
            </h2>
            <div className="choice-grid">
              {MODES.map(m => (
                <button
                  key={m.id}
                  className="choice-option"
                  onClick={() => {
                    playSound('click');
                    onStart({ mode: m.id, difficulty: 'normal', forceTutorial: true });
                  }}
                >
                  <span className="choice-option-icon">{m.icon}</span>
                  <span className="choice-option-name">{m.name.replace('MODO ', '')}</span>
                  <span className="choice-option-desc">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainMenu;
