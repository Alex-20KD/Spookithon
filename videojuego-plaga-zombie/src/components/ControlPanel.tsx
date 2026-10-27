import React from 'react';
import {
  useGameStore,
  actionCost,
  ACTION_INFO,
  MAX_RESEARCH_RATE,
  SimulationSpeed
} from '../store/game-store';
import { formatMoney, formatNumber } from '../utils/format';
import { Tooltip } from './game/shared';
import { playSound } from '../game/sound';
import './ControlPanel.css';

interface ControlPanelProps {
  mode: 'government' | 'virus';
}

const SPEEDS: { speed: SimulationSpeed; icon: string; label: string }[] = [
  { speed: 'paused', icon: '⏸', label: 'Pausa' },
  { speed: 'normal', icon: '▶', label: 'Normal · 1 día cada 2 s' },
  { speed: 'fast', icon: '⏩', label: 'Rápido · 2 días por segundo' },
  { speed: 'ultra', icon: '⏭', label: 'Ultra · 10 días por segundo' }
];

const PARAM_LABELS: Record<string, string> = {
  beta: 'contagio',
  mu: 'movilidad',
  gamma: 'eliminación',
  militaryEffectiveness: 'efectividad militar',
  quarantineEffectiveness: 'efectividad de cuarentenas',
  roadBlockEffectiveness: 'cierre de vías'
};

const ControlPanel: React.FC<ControlPanelProps> = ({ mode }) => {
  const currentDay = useGameStore(s => s.currentDay);
  const simulationSpeed = useGameStore(s => s.simulationSpeed);
  const setSimulationSpeed = useGameStore(s => s.setSimulationSpeed);
  const budget = useGameStore(s => s.budget);
  const budgetPerDay = useGameStore(s => s.budgetPerDay);
  const evolutionPoints = useGameStore(s => s.evolutionPoints);
  const cureProgress = useGameStore(s => s.cureProgress);
  const researchRate = useGameStore(s => s.researchRate);
  const mutations = useGameStore(s => s.mutations);
  const modifiers = useGameStore(s => s.modifiers);
  const difficulty = useGameStore(s => s.difficulty);
  const unlockMutation = useGameStore(s => s.unlockMutation);
  const investInResearch = useGameStore(s => s.investInResearch);
  const gameOver = useGameStore(s => s.gameOver);

  const researchCost = actionCost('research', difficulty);
  const researchMaxed = researchRate >= MAX_RESEARCH_RATE;

  return (
    <div className="control-panel gothic-panel">
      <h2 className="panel-title gothic-text">CONTROL</h2>

      <div className="day-display">
        <span className="day-label">DÍA</span>
        <span className="day-number blood-text">{formatNumber(currentDay)}</span>
      </div>

      <div className="speed-controls" data-tour="speed">
        <h3>Velocidad de simulación</h3>
        <div className="speed-buttons">
          {SPEEDS.map(btn => (
            <button
              key={btn.speed}
              className={`speed-btn ${simulationSpeed === btn.speed ? 'active' : ''}`}
              onClick={() => {
                playSound('click');
                setSimulationSpeed(btn.speed);
              }}
              disabled={!!gameOver && btn.speed !== 'paused'}
              title={btn.label}
              aria-label={btn.label}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      </div>

      {mode === 'government' && (
        <div className="resource-display">
          <div className="resource-item" data-tour="budget">
            <span className="resource-label">💰 Presupuesto</span>
            <span className={`resource-value ${budget < 100_000 ? 'low' : ''}`}>{formatMoney(budget)}</span>
            <span className="resource-sub">+{formatMoney(budgetPerDay)} por día</span>
          </div>

          <div className="resource-item" data-tour="cure">
            <span className="resource-label">🔬 Progreso de la cura</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${cureProgress}%` }}></div>
              <span className="progress-text">{Math.floor(cureProgress)}%</span>
            </div>
            <span className="resource-sub">
              {researchRate > 0 ? `+${researchRate.toFixed(1).replace('.', ',')}% por día` : 'Sin investigación activa'}
            </span>
            <Tooltip
              title={`${ACTION_INFO.research.icon} ${ACTION_INFO.research.name}`}
              lines={[
                { label: 'Costo:', text: formatMoney(researchCost) },
                { label: 'Efecto:', text: ACTION_INFO.research.effect }
              ]}
            >
              <button
                className="gothic-button research-btn"
                data-tour="research-btn"
                onClick={() => investInResearch()}
                disabled={budget < researchCost || researchMaxed || !!gameOver}
              >
                🔬 Investigar cura · {formatMoney(researchCost)}
              </button>
            </Tooltip>
            {researchMaxed && <span className="resource-sub">La investigación está al máximo.</span>}
          </div>
        </div>
      )}

      {mode === 'virus' && (
        <>
          <div className="resource-display">
            <div className="resource-item">
              <span className="resource-label">🧬 Puntos de evolución</span>
              <span className="resource-value purple-glow">{formatNumber(evolutionPoints)}</span>
            </div>
            <div className="resource-item" data-tour="cure">
              <span className="resource-label">🧪 Cura del gobierno</span>
              <div className="progress-bar danger">
                <div className="progress-fill" style={{ width: `${cureProgress}%` }}></div>
                <span className="progress-text">{Math.floor(cureProgress)}%</span>
              </div>
              <span className="resource-sub">Si llega al 100%, el virus pierde.</span>
            </div>
          </div>

          <div className="mutations-panel" data-tour="mutations">
            <h3>Mutaciones</h3>
            <div className="mutations-list">
              {mutations.map(mutation => (
                <div key={mutation.id} className={`mutation-card ${mutation.unlocked ? 'unlocked' : ''}`}>
                  <div className="mutation-header">
                    <span className="mutation-name">{mutation.name}</span>
                    <span className="mutation-cost">
                      {mutation.unlocked ? '✓ Desbloqueada' : `${formatNumber(mutation.cost)} pts`}
                    </span>
                  </div>
                  <p className="mutation-desc">{mutation.description}</p>
                  {!mutation.unlocked && (
                    <button
                      className="mutation-btn gothic-button"
                      onClick={() => unlockMutation(mutation.id)}
                      disabled={evolutionPoints < mutation.cost || !!gameOver}
                    >
                      DESBLOQUEAR
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {modifiers.length > 0 && (
        <div className="modifiers">
          <h3>Efectos activos</h3>
          <ul>
            {modifiers.map(m => (
              <li
                key={m.id}
                // Malo para los humanos = más contagio/movilidad o menos efectividad; en Modo Virus es al revés
                className={(m.factor > 1 === (m.param === 'beta' || m.param === 'mu')) === (mode === 'government') ? 'bad' : 'good'}
              >
                <span>{m.label}</span>
                <span className="modifier-detail">
                  {PARAM_LABELS[m.param] ?? m.param} {m.factor > 1 ? '+' : '−'}
                  {Math.round(Math.abs(m.factor - 1) * 100)}% · hasta el día {m.untilDay}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
