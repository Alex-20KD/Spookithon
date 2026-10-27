import React from 'react';
import { useGameStore, actionCost, ACTION_INFO, ActionId } from '../store/game-store';
import { CANTONS_MAP } from '../data/manabi-data';
import { formatMoney, formatNumber, formatPercent } from '../utils/format';
import { Tooltip } from './game/shared';
import './CantonDetailPanel.css';

/** Línea extra del tooltip: ya aplicada o sin dinero. */
function availabilityLine(done: boolean, doneLabel: string, affordable: boolean): { text: string }[] {
  if (done) return [{ text: `✔ ${doneLabel}` }];
  if (!affordable) return [{ text: '✖ No alcanza el presupuesto' }];
  return [];
}

const CantonDetailPanel: React.FC = () => {
  const model = useGameStore(s => s.model);
  const selectedCantonId = useGameStore(s => s.selectedCantonId);
  const mode = useGameStore(s => s.mode);
  const budget = useGameStore(s => s.budget);
  const difficulty = useGameStore(s => s.difficulty);
  const gameOver = useGameStore(s => s.gameOver);
  const applyQuarantine = useGameStore(s => s.applyQuarantine);
  const deployMilitary = useGameStore(s => s.deployMilitary);
  const blockRoads = useGameStore(s => s.blockRoads);
  const launchCampaign = useGameStore(s => s.launchCampaign);
  useGameStore(s => s.currentDay); // refresca las cifras cada día simulado
  useGameStore(s => s.counters); // y después de cada acción

  if (!selectedCantonId || !model) {
    return (
      <div className="canton-detail-panel gothic-panel" data-tour="actions">
        <h2 className="panel-title gothic-text">CANTÓN</h2>
        <p className="no-selection">Selecciona un cantón en el mapa para ver detalles y acciones</p>
      </div>
    );
  }

  const canton = CANTONS_MAP.get(selectedCantonId);
  const state = model.getState(selectedCantonId);
  if (!canton || !state) return null;

  const total = state.susceptible + state.zombie + state.removed;
  const infectionRate = total > 0 ? state.zombie / total : 0;
  const awareness = state.awareness ?? 0;
  const allRoadsClosed = canton.connections.every(n => state.roadsBlocked.includes(n));

  const actions: { id: ActionId; done: boolean; doneLabel: string; run: () => void }[] = [
    { id: 'quarantine', done: state.quarantine, doneLabel: 'Ya está en cuarentena', run: () => applyQuarantine(selectedCantonId) },
    { id: 'military', done: state.militaryPresence > 0.5, doneLabel: 'Militares ya desplegados', run: () => deployMilitary(selectedCantonId) },
    { id: 'roadBlock', done: allRoadsClosed, doneLabel: 'Todas las vías ya están cerradas', run: () => blockRoads(selectedCantonId) },
    { id: 'campaign', done: awareness >= 0.45, doneLabel: 'La campaña ya está al máximo', run: () => launchCampaign(selectedCantonId) }
  ];

  return (
    <div className="canton-detail-panel gothic-panel">
      <h2 className="panel-title gothic-text">{canton.name}</h2>

      <div className="canton-stats">
        <div className="canton-stat">
          <span className="canton-stat-label">👥 Población total</span>
          <span className="canton-stat-value">{formatNumber(total)}</span>
        </div>
        <div className="canton-stat">
          <span className="canton-stat-label">✅ Sanos</span>
          <span className="canton-stat-value" style={{ color: '#4a8c2a' }}>
            {formatNumber(state.susceptible)}
          </span>
        </div>
        <div className="canton-stat">
          <span className="canton-stat-label">🧟 Infectados</span>
          <span className="canton-stat-value blood-text">{formatNumber(state.zombie)}</span>
        </div>
        <div className="canton-stat">
          <span className="canton-stat-label">💀 Eliminados</span>
          <span className="canton-stat-value" style={{ color: '#888' }}>
            {formatNumber(state.removed)}
          </span>
        </div>
        <div className="canton-stat">
          <span className="canton-stat-label">📊 Infección</span>
          <span className="canton-stat-value" style={{ color: '#ff6b6b' }}>
            {formatPercent(infectionRate)}
          </span>
        </div>
      </div>

      <div className="canton-status">
        <div className="status-indicator">
          <span className="status-label">Cuarentena:</span>
          <span className={`status-badge ${state.quarantine ? 'active' : 'inactive'}`}>
            {state.quarantine ? '🔒 ACTIVA' : '🔓 INACTIVA'}
          </span>
        </div>
        <div className="status-indicator">
          <span className="status-label">Presencia militar:</span>
          <span className={`status-badge ${state.militaryPresence > 0 ? 'active' : 'inactive'}`}>
            {state.militaryPresence > 0 ? `⚔️ ${formatPercent(state.militaryPresence, 0)}` : '❌ NINGUNA'}
          </span>
        </div>
        {awareness > 0 && (
          <div className="status-indicator">
            <span className="status-label">Campañas:</span>
            <span className="status-badge active">📢 −{formatPercent(awareness, 0)} contagio</span>
          </div>
        )}
        {state.roadsBlocked.length > 0 && (
          <div className="status-indicator">
            <span className="status-label">Vías cerradas:</span>
            <span className="status-badge active">🚧 {state.roadsBlocked.length}</span>
          </div>
        )}
      </div>

      {mode === 'government' && (
        <div className="canton-actions" data-tour="actions">
          <h3>Acciones disponibles</h3>
          <div className="action-buttons">
            {actions.map(a => {
              const info = ACTION_INFO[a.id];
              const cost = actionCost(a.id, difficulty);
              const affordable = budget >= cost;
              return (
                <Tooltip
                  key={a.id}
                  title={`${info.icon} ${info.name} en ${canton.name}`}
                  lines={[
                    { label: 'Costo:', text: formatMoney(cost) },
                    { label: 'Efecto:', text: info.effect },
                    ...availabilityLine(a.done, a.doneLabel, affordable)
                  ]}
                >
                  <button
                    className="action-btn gothic-button"
                    data-tour={a.id === 'quarantine' ? 'quarantine-btn' : undefined}
                    onClick={a.run}
                    disabled={!affordable || a.done || !!gameOver}
                  >
                    <span className="action-icon">{info.icon}</span>
                    <span className="action-name">{info.name}</span>
                    <span className="action-cost">{formatMoney(cost)}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CantonDetailPanel;
