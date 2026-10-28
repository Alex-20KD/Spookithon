import type { CSSProperties } from "react";
import { useSimulation } from "../context/SimulationContext";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Pill from "../components/ui/Pill";
import RangeControl from "../components/ui/RangeControl";
import BrotesEditor from "../components/BrotesEditor";
import { obtenerCatalogo } from "../services/apiClient";
import type { CatalogoResponse } from "../types/api";
import { useEffect, useState } from "react";
import type { LugarInicio } from "../types/api";

/** Lugares de inicio que acepta el backend (LugarInicio). */
const LUGARES: { value: LugarInicio; label: string }[] = [
  { value: "hospital", label: "Hospital" },
  { value: "mercado", label: "Mercado" },
  { value: "colegio", label: "Colegio" },
  { value: "bus", label: "Transporte público" },
];

/** Lee min/max de un parámetro desde los metadatos del backend, con respaldo. */
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

export default function SimulatorConfig() {
  const {
    params,
    updateParam,
    restaurarDefaults,
    comparar,
    cargando,
    error,
    meta,
    resultado,
    viaTransmision,
    setViaTransmision,
    brotes,
    setBrotes,
  } = useSimulation();

  const [catalogo, setCatalogo] = useState<CatalogoResponse | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    obtenerCatalogo(ctrl.signal).then(setCatalogo).catch(() => setCatalogo(null));
    return () => ctrl.abort();
  }, []);

  const rBeta = rango(meta, "beta", { min: 0.01, max: 1 });
  const rDosis = rango(meta, "dosis_dia", { min: 0, max: 1000 });
  const rEfic = rango(meta, "eficacia_vacuna", { min: 0, max: 1 });
  const rDetect = rango(meta, "dias_detectar", { min: 1, max: 30 });
  const rPort = rango(meta, "infect_portador", { min: 0, max: 1 });
  const rDias = rango(meta, "dias", { min: 7, max: meta?.topes?.dias_max ?? 90 });
  const corridasMax = meta?.topes?.n_corridas_max ?? 300;

  return (
    <div>
      <PageTitle
        title="Configuración del Simulador"
        subtitle="Ajusta los parámetros y ejecuta la comparación en el backend real"
        right={<Pill color="orange">DATOS SIMULADOS</Pill>}
      />

      <div className="grid grid-2">
        <Card title="Parámetros de transmisión">
          <RangeControl
            label="Contagio (beta)"
            value={params.beta}
            min={rBeta.min}
            max={rBeta.max}
            step={0.01}
            onChange={(v) => updateParam("beta", v)}
            format={(v) => v.toFixed(2)}
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
          <RangeControl
            label="Días hasta detectar"
            value={params.dias_detectar}
            min={rDetect.min}
            max={rDetect.max}
            step={1}
            onChange={(v) => updateParam("dias_detectar", v)}
          />
          <div className="range-control">
            <label>
              <span>Vía de transmisión</span>
            </label>
            <select value={viaTransmision} onChange={(e) => setViaTransmision(e.target.value)} style={selectStyle}>
              <option value="mordidas">Mordidas</option>
              <option value="esporas">Esporas</option>
              <option value="combinada">Combinada</option>
            </select>
          </div>
          <div className="range-control">
            <label>
              <span>Lugar de inicio del brote</span>
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

        <Card title="Intervención y simulación">
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
            label="Horizonte (días)"
            value={params.dias}
            min={rDias.min}
            max={rDias.max}
            step={1}
            onChange={(v) => updateParam("dias", v)}
          />
          <RangeControl
            label="Corridas a promediar"
            value={params.n_corridas}
            min={1}
            max={corridasMax}
            step={1}
            onChange={(v) => updateParam("n_corridas", v)}
          />
          <div className="range-control">
            <label>
              <span>Semilla (reproducibilidad)</span>
            </label>
            <input
              type="number"
              min={0}
              value={params.semilla}
              onChange={(e) => updateParam("semilla", Number(e.target.value))}
              style={selectStyle}
            />
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              Misma semilla = mismos resultados.
            </div>
          </div>
        </Card>
      </div>

      <div style={{ height: 16 }} />
      <BrotesEditor brotes={brotes} onChange={setBrotes} catalogo={catalogo} diasMax={meta?.topes?.dias_max ?? 100} />
      <div style={{ height: 16 }} />
      <Card title="Ejecución">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button variant="primary" onClick={() => comparar()} disabled={cargando}>
            {cargando ? "Simulando…" : "Comparar estrategias"}
          </Button>
          <Button onClick={restaurarDefaults} disabled={cargando}>
            Restaurar valores
          </Button>

          {cargando && (
            <span className="loading-inline" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              Ejecutando simulación en el backend…
            </span>
          )}
          {!cargando && resultado && !error && (
            <Pill color="green">
              Listo · {resultado.n_corridas} corridas · semilla {resultado.semilla}
            </Pill>
          )}
        </div>

        {error && (
          <div className="error-box" role="alert">
            <strong>No se pudo completar la simulación.</strong>
            <div style={{ marginTop: 4 }}>{error}</div>
          </div>
        )}

        {resultado && !error && (
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
            Resultado disponible. Abre la pestaña <strong>Resultados</strong> para ver las
            curvas con rango p10–p90 y la tabla por estrategia.
          </p>
        )}
      </Card>
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
