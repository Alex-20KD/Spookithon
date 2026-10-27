import React from 'react';
import { useGameStore } from '../../store/game-store';
import { MISSIONS_BY_ID, rewardLabel } from '../../game/missions';

const STATUS_ICON = { active: '🎯', done: '✅', failed: '❌' } as const;

const MissionsPanel: React.FC = () => {
  const missions = useGameStore(s => s.missions);
  if (missions.length === 0) return null;
  const done = missions.filter(m => m.status === 'done').length;

  return (
    <div className="missions-panel gothic-panel" data-tour="missions">
      <h2 className="panel-title gothic-text">MISIONES</h2>
      <div className="missions-summary">
        {done}/{missions.length} completadas
      </div>
      <ul className="missions-list">
        {missions.map(m => {
          const def = MISSIONS_BY_ID.get(m.id);
          if (!def) return null;
          const pct = Math.max(0, Math.min(100, (m.progress / m.target) * 100));
          return (
            <li key={m.id} className={`mission mission-${m.status}`}>
              <div className="mission-header">
                <span className="mission-icon" aria-hidden="true">
                  {STATUS_ICON[m.status]}
                </span>
                <span className="mission-title">{def.title}</span>
                <span className="mission-reward">{rewardLabel(def)}</span>
              </div>
              <div className="mission-desc">{def.description}</div>
              {m.status === 'active' && (
                <div className="mission-progress">
                  <div className="mission-bar">
                    <div className="mission-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="mission-progress-label">{def.progressLabel(Math.floor(m.progress), m.target)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default MissionsPanel;
