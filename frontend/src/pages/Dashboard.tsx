import { useSimulation } from "../context/SimulationContext";
import Card from "../components/ui/Card";
import MetricCard from "../components/ui/MetricCard";
import AlertPanel from "../components/ui/AlertPanel";
import SimulationControls from "../components/ui/SimulationControls";
import DailyEvolutionChart from "../components/charts/DailyEvolutionChart";
import PageTitle from "../components/ui/PageTitle";
import Pill from "../components/ui/Pill";

export default function Dashboard() {
  const { scenario, day, params } = useSimulation();
  const point = scenario.daily[Math.min(day, scenario.daily.length - 1)];

  return (
    <div>
      <PageTitle title="Dashboard de Vigilancia" subtitle="Centro de control epidemiológico · Plaga Caracol" right={<Pill color="orange">DEMO · DATOS SIMULADOS</Pill>} />
      <SimulationControls />
      <div style={{ height: 16 }} />
      <div className="kpi-row">
        <MetricCard label="Sanos" value={point.sanos} sub="población sana" color="green" />
        <MetricCard label="Incubando" value={point.incubando} sub="en incubación" color="orange" />
        <MetricCard label="Portadores" value={point.portadores} sub="contagiosos leves" color="blue" />
        <MetricCard label="Zombis" value={point.zombis} sub="casos críticos" color="red" />
        <MetricCard label="Inmunes" value={point.inmunes} sub="protegidos" color="muted" />
      </div>

      <div style={{ height: 16 }} />
      <div className="grid grid-2">
        <Card title="Evolución diaria">
          <DailyEvolutionChart data={scenario.daily} />
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Nivel de amenaza">
            <div className={`threat ${scenario.threatLevel.toLowerCase()}`}>{scenario.threatLevel}</div>
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
              Día {day} de {params.days} · Población {params.population.toLocaleString("es-EC")}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
              Acumulados: <strong style={{ color: "var(--text)" }}>{point.acumulados}</strong>
            </div>
          </Card>
          <Card title="Alertas críticas">
            <AlertPanel alerts={scenario.alerts} />
          </Card>
          <Card title="Estrategia recomendada">
            <div style={{ fontWeight: 700, color: "var(--green)" }}>Medidas combinadas</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
              Mejor desempeño simulado en personas salvadas y reducción del pico.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}