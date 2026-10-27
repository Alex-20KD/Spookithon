import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { useSimulation } from "../context/SimulationContext";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import MetricCard from "../components/ui/MetricCard";

export default function Results() {
  const { scenario } = useSimulation();
  const daily = scenario.daily;
  const strategies = scenario.strategies;

  // Mock comparative curves per strategy
  const compareCurves = daily.map((p) => {
    const base = p.zombis;
    return {
      day: p.day,
      "Sin intervención": Math.round(base * 1.25),
      "Vacunación aleatoria": Math.round(base * 0.95),
      "Por centralidad": Math.round(base * 0.82),
      "En anillo": Math.round(base * 0.75),
      "Combinadas": Math.round(base * 0.6),
    };
  });

  const savedData = strategies.map((s) => ({ name: s.name, salvadas: s.saved }));
  const accumulated = daily.map((p) => ({ day: p.day, acumulados: p.acumulados }));

  const avgPeak = Math.round(strategies.reduce((a, s) => a + s.peak, 0) / strategies.length);
  const best = strategies.reduce((a, b) => (a.saved > b.saved ? a : b));

  return (
    <div>
      <PageTitle title="Resultados y Análisis" subtitle="Análisis demo del escenario" right={<Pill color="orange">DEMO · DATOS SIMULADOS</Pill>} />
      <div className="kpi-row">
        <MetricCard label="Mejor estrategia" value={best.name} sub="mayor personas salvadas" color="green" />
        <MetricCard label="Pico promedio" value={avgPeak} sub="zombis en pico" color="red" />
        <MetricCard label="Acumulados" value={daily[daily.length - 1].acumulados} sub="contagios totales" color="orange" />
        <MetricCard label="Percentil 10" value={Math.round(avgPeak * 0.7)} sub="estimado" color="blue" />
        <MetricCard label="Percentil 90" value={Math.round(avgPeak * 1.3)} sub="estimado" color="blue" />
      </div>

      <div style={{ height: 16 }} />
      <div className="grid grid-2">
        <Card title="Curvas de contagio por estrategia">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={compareCurves}>
                <CartesianGrid stroke="#263746" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#8B9BB0" />
                <YAxis stroke="#8B9BB0" />
                <Tooltip contentStyle={{ background: "#16222E", border: "1px solid #263746", color: "#E6EDF3" }} />
                <Legend />
                <Line dataKey="Sin intervención" stroke="#8B1E2D" dot={false} />
                <Line dataKey="Vacunación aleatoria" stroke="#FF7A45" dot={false} />
                <Line dataKey="Por centralidad" stroke="#4DA8FF" dot={false} />
                <Line dataKey="En anillo" stroke="#38E89A" dot={false} />
                <Line dataKey="Combinadas" stroke="#FF4D5A" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Contagios acumulados">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={accumulated}>
                <CartesianGrid stroke="#263746" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#8B9BB0" />
                <YAxis stroke="#8B9BB0" />
                <Tooltip contentStyle={{ background: "#16222E", border: "1px solid #263746", color: "#E6EDF3" }} />
                <Area type="monotone" dataKey="acumulados" stroke="#FF4D5A" fill="rgba(255,77,90,0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div style={{ height: 16 }} />
      <div className="grid grid-2">
        <Card title="Personas salvadas por estrategia">
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={savedData}>
                <CartesianGrid stroke="#263746" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#8B9BB0" tick={{ fontSize: 10 }} />
                <YAxis stroke="#8B9BB0" />
                <Tooltip contentStyle={{ background: "#16222E", border: "1px solid #263746", color: "#E6EDF3" }} />
                <Bar dataKey="salvadas" fill="#38E89A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Tabla de resultados">
          <table className="table">
            <thead>
              <tr><th>Estrategia</th><th>Salvadas</th><th>Pico</th><th>Vacunas</th><th>Efect.</th></tr>
            </thead>
            <tbody>
              {strategies.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.saved}</td>
                  <td>{s.peak}</td>
                  <td>{s.vaccinesUsed}</td>
                  <td>{Math.round(s.effectiveness * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div style={{ height: 16 }} />
      <Card title="Recomendación final">
        <div style={{ fontWeight: 700, color: "var(--green)", fontSize: 18 }}>Medidas combinadas</div>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Bajo los parámetros actuales, las medidas combinadas presentan el mejor desempeño simulado en reducción del pico y personas salvadas.
          Los valores son demostrativos y no representan resultados científicos reales.
        </p>
      </Card>
    </div>
  );
}