import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useSimulation } from "../context/SimulationContext";
import type { ParametrosEditables } from "../context/SimulationContext";
import type { CompararResponse } from "../types/api";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Pill from "../components/ui/Pill";
import RangeControl from "../components/ui/RangeControl";
import MetricCard from "../components/ui/MetricCard";
import { nombreAmigable } from "../utils/estrategias";
import type { LugarInicio } from "../types/api";

const LUGARES: { value: LugarInicio; label: string }[] = [
  { value: "hospital", label: "Hospital" },
  { value: "mercado", label: "Mercado" },
  { value: "colegio", label: "Colegio" },
  { value: "bus", label: "Transporte público" },
];

const num = (n: number) => Math.round(n).toLocaleString("es-EC");

function rango(
  meta: ReturnType<typeof useSimulation>["meta"],
  clave: string,
  resp: { min: number; max: number },
) {
  const p = meta?.parametros?.[clave];
  return {
    min: typeof p?.minimo === "number" ? p.minimo : resp.min,
    max: typeof p?.maximo === "number" ? p.maximo : resp.max,
  };
}

interface Escenario {
  params: ParametrosEditables;
  resultado: CompararResponse;
}

export default function Outbreak() {
  const {
    params,
    updateParam,
    comparar,
    cargando,
    error,
    resultado,
    meta,
  } = useSimulation();

  const [base, setBase] = useState<Escenario | null>(null);
  const [despues, setDespues] = useState<CompararResponse | null>(null);

  // Captura el escenario base existente al entrar, si lo hay.
  useEffect(() => {
    if (!base && resultado) {
      setBase({ params: { ...params }, resultado });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rBeta = rango(meta, "beta", { min: 0.01, max: 1 });
  const rDosis = rango(meta, "dosis_dia", { min: 0, max: 1000 });
  const rEfic = rango(meta, "eficacia_vacuna", { min: 0, max: 1 });
  const rDetect = rango(meta, "dias_detectar", { min: 1, max: 30 });
  const rPort = rango(meta, "infect_portador", { min: 0, max: 1 });

  const establecerBase = async () => {
    const res = await comparar();
    if (res) setBase({ params: { ...params }, resultado: res });
    setDespues(null);
  };

  const recalcular = async () => {
    if (!base) {
      await establecerBase();
      return;
    }
    const res = await comparar();
    if (res) setDespues(res);
  };

  const antes = base?.resultado ?? null;
  const actual = despues ?? (base && resultado !== base.resultado ? resultado : null);

  const mejorAntes = antes?.estrategias.find((e) => e.nombre === antes.mejor_estrategia) ?? null;
  const mejorDespues = actual?.estrategias.find((e) => e.nombre === actual.mejor_estrategia) ?? null;

  return (
    <div>
      <PageTitle
        title="Brote Sorpresa"
        subtitle="Modifica parámetros y recalcula la estrategia recomendada"
        right={<Pill color="orange">DATOS SIMULADOS</Pill>}
      />

      <div className="grid grid-2">
        <Card title="Parámetros del brote">
          <RangeControl
            label="Transmisibilidad (beta)"
            value={params.beta}
            min={rBeta.min}
            max={rBeta.max}
            step={0.01}
            onChange={(v) => updateParam("beta", v)}
            format={(v) => v.toFixed(2)}
          />
          <RangeControl
            label="Dosis por día"
            value={params.dosis_dia}
            min={rDosis.min}
            max={rDosis.max}
            step={10}
            onChange={(v) => updateParam("dosis_dia", v)}
          />
          <RangeControl
            label="Eficacia de la vacuna"
            value={params.eficacia_vacuna}
            min={rEfic.min}
            max={rEfic.max}
            step={0.05}
            onChange={(v) => updateParam("eficacia_vacuna", v)}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <RangeControl
            label="Días hasta detectar"
            value={params.dias_detectar}
            min={rDetect.min}
            max={rDetect.max}
            step={1}
            onChange={(v) => updateParam("dias_detectar", v)}
          />
          <RangeControl
            label="Infectividad del portador"
            value={params.infect_portador}
            min={rPort.min}
            max={rPort.max}
            step={0.05}
            onChange={(v) => updateParam("infect_portador", v)}
            format={(v) => v.toFixed(2)}
          />
          <div className="range-control">
            <label>
              <span>Lugar inicial del brote</span>
            </label>
            <select
              value={params.lugar_inicio}
              onChange={(e) => updateParam("lugar_inicio", e.target.value as LugarInicio)}
              style={selectStyle}
            >
              {LUGARES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card title="Ejecución">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="primary" onClick={establecerBase} disabled={cargando}>
              {cargando ? "Calculando…" : "Establecer escenario base"}
            </Button>
            <Button variant="success" onClick={recalcular} disabled={cargando || !base}>
              {cargando ? "Recalculando…" : "RECALCULAR ESTRATEGIA"}
            </Button>
          </div>
          {error && (
            <div className="error-box" role="alert" style={{ marginTop: 12 }}>
              <strong>No se pudo completar.</strong>
              <div style={{ marginTop: 4 }}>{error}</div>
            </div>
          )}
          {base && (
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
              Escenario base establecido. Modifica parámetros y pulsa “RECALCULAR ESTRATEGIA”.
            </p>
          )}
        </Card>
      </div>

      {antes && (
        <>
          <div style={{ height: 16 }} />
          <Card title="Comparación antes / después">
            <div className="compare-grid">
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--muted)" }}>Antes</div>
                {antes && mejorAntes && (
                  <div className="kpi-row" style={{ gridTemplateColumns: "1fr" }}>
                    <MetricCard label="Mejor estrategia" value={nombreAmigable(antes.mejor_estrategia)} color="blue" />
                    <MetricCard label="Infectados (mejor)" value={num(mejorAntes.infectados_media)} sub="promedio" color="red" />
                    <MetricCard label="Salvados (mejor)" value={num(mejorAntes.salvados_media)} sub="promedio" color="green" />
                    <MetricCard label="Sin intervención" value={num(antes.estrategias.find((e) => e.nombre === "Nada")?.infectados_media ?? 0)} sub="infectados 'Nada'" color="orange" />
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--muted)" }}>Después</div>
                {actual && mejorDespues ? (
                  <div className="kpi-row" style={{ gridTemplateColumns: "1fr" }}>
                    <MetricCard label="Mejor estrategia" value={nombreAmigable(actual.mejor_estrategia)} color="green" />
                    <MetricCard label="Infectados (mejor)" value={num(mejorDespues.infectados_media)} sub="promedio" color="red" />
                    <MetricCard label="Salvados (mejor)" value={num(mejorDespues.salvados_media)} sub="promedio" color="green" />
                    <MetricCard label="Sin intervención" value={num(actual.estrategias.find((e) => e.nombre === "Nada")?.infectados_media ?? 0)} sub="infectados 'Nada'" color="orange" />
                  </div>
                ) : (
                  <div className="empty">Pulsa “RECALCULAR ESTRATEGIA” para ver el resultado.</div>
                )}
              </div>
            </div>

            {actual && (
              <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
                {actual.recomendacion}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

const selectStyle: CSSProperties = {
  width: "100%",
  padding: 8,
  background: "#0C141D",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 8,
};