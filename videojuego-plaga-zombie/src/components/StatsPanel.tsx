import React from 'react';
import { useGameStore } from '../store/game-store';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCompact, formatNumber, formatPercent } from '../utils/format';
import './StatsPanel.css';

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  className?: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, className, color }) => (
  <div className="stat-card">
    <div className="stat-header">
      <span className="stat-icon" aria-hidden="true">{icon}</span>
      <span className="stat-label">{label}</span>
    </div>
    <div className={`stat-value ${className ?? ''}`} style={color ? { color } : undefined} title={value}>
      {value}
    </div>
  </div>
);

const StatsPanel: React.FC = () => {
  // currentDay hace que el panel se actualice cada día (el modelo cambia internamente)
  const { model, history } = useGameStore();
  useGameStore(state => state.currentDay);

  if (!model) return null;

  const stats = model.getGlobalStats();
  const data = history.slice(-30); // Últimos 30 días

  return (
    <div className="stats-panel gothic-panel" data-tour="stats">
      <h2 className="panel-title gothic-text">ESTADÍSTICAS GLOBALES</h2>

      <div className="stats-grid">
        <StatCard icon="👥" label="Población sana" value={formatNumber(stats.susceptible)} color="#4a8c2a" />
        <StatCard icon="🧟" label="Zombies activos" value={formatNumber(stats.zombie)} className="blood-text" />
        <StatCard icon="💀" label="Eliminados" value={formatNumber(stats.removed)} color="#888" />
        <StatCard icon="📊" label="Tasa de infección" value={formatPercent(stats.infectionRate)} color="#ff6b6b" />
      </div>

      {data.length > 1 && (
        <div className="chart-container">
          <h3 className="chart-title">EVOLUCIÓN (últimos 30 días)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" stroke="#666" style={{ fontSize: '11px' }} />
              <YAxis stroke="#666" style={{ fontSize: '11px' }} width={52} tickFormatter={formatCompact} />
              <Tooltip
                formatter={(value: number) => formatNumber(value)}
                labelFormatter={(day: number) => `Día ${day}`}
                contentStyle={{
                  backgroundColor: 'rgba(20, 10, 25, 0.95)',
                  border: '2px solid #4a1f4f',
                  borderRadius: '4px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="susceptible" stroke="#4a8c2a" name="Sanos" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="zombie" stroke="#ff0000" name="Zombies" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="removed" stroke="#888" name="Eliminados" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default StatsPanel;
