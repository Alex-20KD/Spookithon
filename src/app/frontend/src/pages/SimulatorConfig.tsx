import { useSimulation } from "../context/SimulationContext";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Pill from "../components/ui/Pill";
import RangeControl from "../components/ui/RangeControl";
import { PLACE_OPTIONS } from "../data/sectors";
import type { SimulationParams } from "../types";

const DEFAULTS: SimulationParams = {
  seed: 42,
  population: 3000,
  days: 30,
  initialPlace: "hospital",
  contagionProbability: 0.1,
  dailyDoses: 100,
  vaccineEfficacy: 0.9,
  detectionDays: 4,
  carrierInfectivity: 0.3,
  secondaryFocus: "mercado",
};

export default function SimulatorConfig() {
  const { params, updateParam, setParams, runSimulation } = useSimulation();

  const restore = () => setParams({ ...DEFAULTS });

  return (
    <div>
      <PageTitle title="Configuración del Simulador" subtitle="Ajusta parámetros del escenario demo" right={<Pill color="orange">DEMO · DATOS SIMULADOS</Pill>} />
      <div className="grid grid-2">
        <Card title="Parámetros de transmisión">
          <RangeControl label="Probabilidad de contagio" value={params.contagionProbability} min={0.01} max={0.4} step={0.01} onChange={(v) => updateParam("contagionProbability", v)} format={(v) => v.toFixed(2)} />
          <RangeControl label="Infectividad del portador" value={params.carrierInfectivity} min={0.05} max={1} step={0.05} onChange={(v) => updateParam("carrierInfectivity", v)} format={(v) => v.toFixed(2)} />
          <RangeControl label="Días hasta detección" value={params.detectionDays} min={1} max={10} step={1} onChange={(v) => updateParam("detectionDays", v)} />
          <div className="range-control">
            <label>
              <span>Lugar inicial</span>
            </label>
            <select value={params.initialPlace} onChange={(e) => updateParam("initialPlace", e.target.value)} style={{ width: "100%", padding: 8, background: "#0C141D", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8 }}>
              {PLACE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </Card>

        <Card title="Intervenciones">
          <RangeControl label="Dosis diarias" value={params.dailyDoses} min={0} max={300} step={10} onChange={(v) => updateParam("dailyDoses", v)} />
          <RangeControl label="Eficacia de vacuna" value={params.vaccineEfficacy} min={0.5} max={1} step={0.05} onChange={(v) => updateParam("vaccineEfficacy", v)} format={(v) => `${Math.round(v * 100)}%`} />
          <RangeControl label="Duración del escenario (días)" value={params.days} min={7} max={60} step={1} onChange={(v) => updateParam("days", v)} />
          <div className="range-control">
            <label><span>Semilla</span></label>
            <input type="number" value={params.seed} onChange={(e) => updateParam("seed", Number(e.target.value))} style={{ width: "100%", padding: 8, background: "#0C141D", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8 }} />
          </div>
          <div className="range-control">
            <label><span>Foco secundario</span></label>
            <select value={params.secondaryFocus || ""} onChange={(e) => updateParam("secondaryFocus", e.target.value)} style={{ width: "100%", padding: 8, background: "#0C141D", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8 }}>
              {PLACE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </Card>
      </div>

      <div style={{ height: 16 }} />
      <Card title="Resumen de parámetros">
        <div className="grid grid-3" style={{ fontSize: 13 }}>
          <div>Contagio: <strong>{params.contagionProbability.toFixed(2)}</strong></div>
          <div>Dosis/día: <strong>{params.dailyDoses}</strong></div>
          <div>Eficacia: <strong>{Math.round(params.vaccineEfficacy * 100)}%</strong></div>
          <div>Detección: <strong>{params.detectionDays} días</strong></div>
          <div>Infectividad portador: <strong>{params.carrierInfectivity.toFixed(2)}</strong></div>
          <div>Duración: <strong>{params.days} días</strong></div>
          <div>Lugar inicial: <strong>{params.initialPlace}</strong></div>
          <div>Semilla: <strong>{params.seed}</strong></div>
          <div>Población: <strong>{params.population}</strong></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Button variant="primary" onClick={runSimulation}>Ejecutar simulación</Button>
          <Button onClick={restore}>Restaurar valores</Button>
        </div>
      </Card>
    </div>
  );
}