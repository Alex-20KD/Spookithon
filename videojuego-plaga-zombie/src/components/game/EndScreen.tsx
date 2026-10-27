import React from 'react';
import { useGameStore } from '../../store/game-store';
import { DIFFICULTIES } from '../../game/difficulty';
import { formatNumber, formatPercent } from '../../utils/format';

interface EndScreenProps {
  onPlayAgain: () => void;
  onMenu: () => void;
}

const GRADE_COLORS = { S: '#ffd700', A: '#7dff9a', B: '#4dd2ff', C: '#ff6b6b' } as const;

/** Pantalla de victoria o derrota con estadísticas y calificación. */
const EndScreen: React.FC<EndScreenProps> = ({ onPlayAgain, onMenu }) => {
  const gameOver = useGameStore(s => s.gameOver);
  const mode = useGameStore(s => s.mode);
  const difficulty = useGameStore(s => s.difficulty);
  if (!gameOver) return null;
  const { stats, victory, reason } = gameOver;
  const total = Math.max(1, stats.totalPopulation);

  const rows: [string, string][] =
    mode === 'government'
      ? [
          ['Días', formatNumber(stats.day)],
          ['Vidas salvadas', `${formatNumber(stats.livesSaved)} (${formatPercent(stats.susceptible / total, 1)})`],
          ['Cantones perdidos', `${formatNumber(stats.cantonsLost)} de 22`],
          ['Cantones alcanzados', `${formatNumber(stats.cantonsInfected)} de 22`],
          ['Cura', `${Math.floor(stats.cureProgress)}%`],
          ['Misiones', formatNumber(stats.missionsDone)]
        ]
      : [
          ['Días', formatNumber(stats.day)],
          ['Personas sanas restantes', `${formatNumber(stats.livesSaved)} (${formatPercent(stats.susceptible / total, 1)})`],
          ['Cantones perdidos por los humanos', `${formatNumber(stats.cantonsLost)} de 22`],
          ['Cantones infectados', `${formatNumber(stats.cantonsInfected)} de 22`],
          ['Cura del gobierno', `${Math.floor(stats.cureProgress)}%`],
          ['Misiones', formatNumber(stats.missionsDone)]
        ];

  return (
    <div className="modal-backdrop end-backdrop">
      <div className={`end-card ${victory ? 'victory' : 'defeat'}`} role="dialog" aria-modal="true" aria-labelledby="end-title">
        <div className="end-kicker">
          {mode === 'government' ? '🏛️ MODO GOBIERNO' : '🦠 MODO VIRUS'} · {DIFFICULTIES[difficulty].label.toUpperCase()}
        </div>
        <h1 id="end-title" className="end-title gothic-text">
          {victory ? 'VICTORIA' : 'DERROTA'}
        </h1>
        <p className="end-reason">{reason}</p>

        <div className="end-content">
          <div className="end-grade" style={{ color: GRADE_COLORS[stats.grade], borderColor: GRADE_COLORS[stats.grade] }}>
            <span className="end-grade-letter">{stats.grade}</span>
            <span className="end-grade-score">{stats.score} pts</span>
          </div>
          <dl className="end-stats">
            {rows.map(([label, value]) => (
              <div key={label} className="end-stat">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="end-actions">
          <button className="gothic-button" onClick={onPlayAgain}>
            Jugar otra vez
          </button>
          <button className="gothic-button" onClick={onMenu}>
            Menú
          </button>
        </div>
      </div>
    </div>
  );
};

export default EndScreen;
