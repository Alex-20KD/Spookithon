import { useSimulation } from "../context/SimulationContext";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import Button from "../components/ui/Button";

export default function Strategies() {
  const { scenario, selectedStrategyId, setSelectedStrategyId, compareIds, setCompareIds } = useSimulation();
  const strategies = scenario.strategies;

  const toggleCompare = (id: string) => {
    setCompareIds(compareIds.includes(id) ? compareIds.filter((x) => x !== id) : [...compareIds, id]);
  };

  return (
    <div>
      <PageTitle title="Estrategias de Intervención" subtitle="Comparación de enfoques demo" right={<Pill color="orange">DEMO · DATOS SIMULADOS</Pill>} />
      <div className="grid grid-3">
        {strategies.map((s) => (
          <div
            key={s.id}
            className={`strat-card ${selectedStrategyId === s.id ? "selected" : ""} ${s.recommended ? "recommended" : ""}`}
            onClick={() => setSelectedStrategyId(s.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>{s.name}</div>
              {s.recommended && <Pill color="green">Recomendada</Pill>}
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
              <div>Personas salvadas: <strong style={{ color: "var(--text)" }}>{s.saved}</strong></div>
              <div>Pico de contagio: <strong style={{ color: "var(--text)" }}>{s.peak}</strong></div>
              <div>Vacunas usadas: <strong style={{ color: "var(--text)" }}>{s.vaccinesUsed}</strong></div>
              <div>Efectividad: <strong style={{ color: "var(--text)" }}>{Math.round(s.effectiveness * 100)}%</strong></div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>
                <input type="checkbox" checked={compareIds.includes(s.id)} onChange={() => toggleCompare(s.id)} /> Comparar
              </label>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 16 }} />
      <Card title="Comparación seleccionada">
        {compareIds.length === 0 ? (
          <div className="empty">Selecciona estrategias para comparar.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Estrategia</th>
                <th>Salvadas</th>
                <th>Pico</th>
                <th>Vacunas</th>
                <th>Efectividad</th>
              </tr>
            </thead>
            <tbody>
              {strategies.filter((s) => compareIds.includes(s.id)).map((s) => (
                <tr key={s.id}>
                  <td>{s.name} {s.recommended && "⭐"}</td>
                  <td>{s.saved}</td>
                  <td>{s.peak}</td>
                  <td>{s.vaccinesUsed}</td>
                  <td>{Math.round(s.effectiveness * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => setCompareIds(["nada", "combinadas"])}>Restablecer comparación</Button>
        </div>
      </Card>
    </div>
  );
}