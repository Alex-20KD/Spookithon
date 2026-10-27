import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useSimulation } from "../context/SimulationContext";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Pill from "../components/ui/Pill";
import RangeControl from "../components/ui/RangeControl";
import { PLACE_OPTIONS } from "../data/sectors";
import MetricCard from "../components/ui/MetricCard";

export default function SurpriseOutbreak() {
  const { outbreakOverrides, setOutbreakOverrides, runOutbreak, outbreakResult, params } = useSimulation();

  const setOv = (key: keyof typeof outbreakOverrides, value: any) => {
    setOutbreakOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const before = outbreakResult?.before;
  const after = outbreakResult?.after;

  const beforePeak = before ? Math.max(...before.daily.map((p) => p.zombis)) : 0;
  const afterPeak = after ? Math.max(...after.daily.map((p) => p.zombis)) : 0;
  const peakDelta = beforePeak ? Math.round(((afterPeak - beforePeak) / beforePeak) * 100) : 0;

  const beforeCum = before ? before.daily[before.daily.length - 1].acumulados : 0;
  const afterCum = after ? after.daily[after.daily.length - 1].acumulados : 0;
  const cumDelta = beforeCum ? Math.round(((afterCum - beforeCum) / beforeCum) * 100) : 0;

  const chartData = before && after
    ? before.daily.map((p, i) => ({
        day: p.day,
        antes: p.zombis,
        despues: after.daily[i]?.zombis ?? 0,
      }))
    : [];

  return (
    <div>
      <PageTitle title="Brote Sorpresa" subtitle="Reconfiguración rápida de escenario" right={<Pill color="orange">DEMO · DATOS SIMULADOS</Pill>} />
      <div className="grid grid-2">
        <Card title="Parámetros del brote">
          <RangeControl label="Transmisibilidad" value={outbreakOverrides.contagionProbability ?? params.contagionProbability} min={0.01} max={0.4} step={0.01} onChange={(v) => setOv("contagionProbability", v)} format={(v) => v.toFixed(2)} />
          <RangeControl label="Dosis diarias" value={outbreakOverrides.dailyDoses ?? params.dailyDoses} min={0} max={300} step={10} onChange={(v) => setOv("dailyDoses", v)} />
          <RangeControl label="Eficacia de vacuna" value={outbreakOverrides.vaccineEfficacy ?? params.vaccineEfficacy} min={0.5} max={1} step={0.05} onChange={(v) => setOv("vaccineEfficacy", v)} format={(v) => `${Math.round(v * 100)}%`} />
          <RangeControl label="Retraso de detección" value={outbreakOverrides.detectionDays ?? params.detectionDays} min={1} max={10} step={1} onChange={(v) => setOv("detectionDays", v)} />
          <div className="range-control">
            <label><span>Lugar del brote</span></label>
            <select value={outbreakOverrides.initialPlace ?? params.initialPlace} onChange={(e) => setOv("initialPlace", e.target.value)} style={{ width: "100%", padding: 8, background: "#0C141D", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8 }}>
              {PLACE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="range-control">
            <label><span>Foco secundario</span></label>
            <select value={outbreakOverrides.secondaryFocus ?? params.secondaryFocus} onChange={(e) => setOv("secondaryFocus", e.target.value)} style={{ width: "100%", padding: 8, background: "#0C141D", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8 }}>
              {PLACE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 12 }}>
            <Button variant="primary" onClick={runOutbreak}>Recalcular escenario</Button>
          </div>
        </Card>

        <Card title="Comparación ANTES / DESPUÉS">
          {!outbreakResult ? (
            <div className="empty">Presiona "Recalcular escenario" para generar la comparación.</div>
          ) : (
            <>
              <div className="grid grid-2">
                <MetricCard label="Pico antes" value={beforePeak} color="red" />
                <MetricCard label="Pico después" value={afterPeak} sub={`${peakDelta > 0 ? "+" : ""}${peakDelta}%`} color="orange" />
                <MetricCard label="Acumulados antes" value={beforeCum} color="red" />
                <MetricCard label="Acumulados después" value={afterCum} sub={`${cumDelta > 0 ? "+" : ""}${cumDelta}%`} color="orange" />
              </div>
              <div style={{ height: 12 }} />
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#263746" strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke="#8B9BB0" />
                    <YAxis stroke="#8B9BB0" />
                    <Tooltip contentStyle={{ background: "#16222E", border: "1px solid #263746", color: "#E6EDF3" }} />
                    <Legend />
                    <Line dataKey="antes" stroke="#8B1E2D" name="Antes" dot={false} />
                    <Line dataKey="despues" stroke="#FF4D5A" name="Después" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
                Nivel de amenaza: antes <strong>{before?.threatLevel}</strong> · después <strong>{after?.threatLevel}</strong>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}