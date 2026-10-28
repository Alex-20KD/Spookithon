import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useSimulation } from "../context/SimulationContext";
import { compararEstrategias } from "../services/apiClient";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import MetricCard from "../components/ui/MetricCard";
import EventsPanel from "../components/EventsPanel";
import CurveTooltip from "../components/charts/CurveTooltip";
import { nombreAmigable } from "../utils/estrategias";
import type { CompararResponse } from "../types/api";
import type { Brote } from "../types/brotes";

const num = (n: number) => Math.round(n).toLocaleString("es-EC");

const ESCENARIOS: { value: string; label: string }[] = [
  { value: "base", label: "Sin brotes especiales" },
  { value: "brote_secundario", label: "Brote secundario" },
  { value: "zombie_corredor", label: "Corredor zombi" },
  { value: "horda_migratoria", label: "Horda migratoria" },
  { value: "fallo_contencion", label: "Fallo de contención" },
  { value: "acechador", label: "Acechador" },
  { value: "chasqueador", label: "Chasqueador" },
  { value: "gordinflon", label: "Gordinflón" },
  { value: "combined", label: "Brotes combinados" },
];

const BROTES_COMPARAR = [
  "base",
  "zombie_corredor",
  "horda_migratoria",
  "fallo_contencion",
  "acechador",
  "chasqueador",
  "gordinflon",
];

function brotesAEventos(brotes: Brote[]) {
  return brotes
    .filter((b) => b.activo)
    .map((b) => ({
      tipo: b.tipo,
      dia: b.dia,
      barrio_id: b.barrio_id,
      intensidad: b.intensidad,
      duracion: b.duracion,
      nombre: b.tipo,
    }));
}

function eventosParaEscenario(scenario: string, brotes: Brote[]) {
  const dia = 5;
  const barrio = "b01";
  switch (scenario) {
    case "base":
      return [];
    case "brote_secundario":
      return [{ tipo: "brote_secundario", dia, barrio_id: barrio, intensidad: 5, duracion: 5, nombre: "brote_secundario" }];
    case "zombie_corredor":
      return [{ tipo: "zombie_corredor", dia, barrio_id: barrio, intensidad: 1, duracion: 5, nombre: "zombie_corredor" }];
    case "horda_migratoria":
      return [{ tipo: "horda_migratoria", dia, barrio_id: barrio, intensidad: 5, duracion: 5, nombre: "horda_migratoria" }];
    case "fallo_contencion":
      return [{ tipo: "fallo_contencion", dia, barrio_id: barrio, intensidad: 1, duracion: 5, nombre: "fallo_contencion" }];
    case "acechador":
      return [{ tipo: "aparicion_acechador", dia, barrio_id: barrio, intensidad: 3, duracion: 7, nombre: "aparicion_acechador" }];
    case "chasqueador":
      return [{ tipo: "aparicion_chasqueador", dia, barrio_id: barrio, intensidad: 3, duracion: 7, nombre: "aparicion_chasqueador" }];
    case "gordinflon":
      return [{ tipo: "aparicion_gordinflon", dia, barrio_id: barrio, intensidad: 2, duracion: 7, nombre: "aparicion_gordinflon" }];
    case "combined":
      return brotesAEventos(brotes);
    default:
      return [];
  }
}

function datosCurva(e: any) {
  const { dias, media, p10, p90 } = e.curva_diaria;
  return dias.map((d: number, i: number) => ({
    dia: d,
    media: media[i],
    p10: p10[i],
    banda: Math.max(0, (p90[i] ?? 0) - (p10[i] ?? 0)),
    p90: p90[i],
  }));
}

export default function Results() {
  const {
    resultado,
    cargando,
    error,
    brotes,
    params,
    viaTransmision,
    comparar,
  } = useSimulation();

  const [scenario, setScenario] = useState("base");
  const [comparison, setComparison] = useState<"strategies" | "brotes">("strategies");
  const [strategy, setStrategy] = useState("Nada");
  const [intervencionAdicional, setIntervencionAdicional] = useState("none");
  const [estrategiaSel, setEstrategiaSel] = useState<string | null>(null);

  const [brotesResultados, setBrotesResultados] = useState<Record<string, CompararResponse>>({});
  const [cargandoLocal, setCargandoLocal] = useState(false);
  const calcularMatriz = async () => {
    setCargandoLocal(true);
    setErrorLocal(null);
    const res: Record<string, CompararResponse> = {};
    await Promise.all(
      BROTES_COMPARAR.map(async (sc) => {
        const ev = eventosParaEscenario(sc, brotes);
        const cuerpo = {
          ...params,
          via_transmision: viaTransmision,
          eventos: ev,
          n_corridas: params.n_corridas,
        };
        try {
          const r = await compararEstrategias(cuerpo as any);
          res[sc] = r;
        } catch (e) {
          // ignore
        }
      }),
    );
    setBrotesResultados(res);
    setCargandoLocal(false);
  };
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Modo estrategias: reutiliza el flujo global.
  useEffect(() => {
    if (comparison !== "strategies") return;
    const ev = eventosParaEscenario(scenario, brotes);
    const iv = intervencionAdicional !== "none"
      ? [{ dia: 30, estrategia: intervencionAdicional, duracion: 10 }]
      : undefined;
    comparar(ev as any, iv as any);
  }, [scenario, comparison, brotes, intervencionAdicional]);

  // Modo brotes: ejecuta un comparar por escenario bajo la estrategia elegida.
  useEffect(() => {
    if (comparison !== "brotes") return;
    let cancelled = false;
    async function run() {
      setCargandoLocal(true);
      setErrorLocal(null);
      const res: Record<string, CompararResponse> = {};
      await Promise.all(
        BROTES_COMPARAR.map(async (sc) => {
          const ev = eventosParaEscenario(sc, brotes);
          const cuerpo = {
            ...params,
            via_transmision: viaTransmision,
            eventos: ev,
            n_corridas: params.n_corridas,
          };
          try {
            const r = await compararEstrategias(cuerpo as any);
            res[sc] = r;
          } catch (e) {
            // ignore per-scenario errors
          }
        }),
      );
      if (!cancelled) setBrotesResultados(res);
      setCargandoLocal(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [comparison, strategy, brotes, params, viaTransmision]);

  const estrategias = resultado?.estrategias ?? [];
  const seleccionada = useMemo(() => {
    const lista = resultado?.estrategias ?? [];
    if (lista.length === 0) return null;
    const porNombre = lista.find((e) => e.nombre === estrategiaSel);
    return porNombre ?? lista.find((e) => e.nombre === resultado?.mejor_estrategia) ?? lista[0];
  }, [resultado, estrategiaSel]);

  const curva = seleccionada ? datosCurva(seleccionada) : [];

  const brotesChartData = useMemo(() => {
    const dias = params.dias;
    const arr: any[] = Array.from({ length: dias + 1 }, (_, i) => ({ dia: i }));
    BROTES_COMPARAR.forEach((sc) => {
      const r = brotesResultados[sc];
      const est = r?.estrategias?.find((e) => e.nombre === strategy);
      if (!est) return;
      const curva = datosCurva(est);
      curva.forEach((p: any, i: number) => {
        if (arr[i]) arr[i][sc] = p.media;
      });
    });
    return arr;
  }, [brotesResultados, strategy, params.dias]);

  // --- Estados de carga / error / vacío --- //
  if (cargando || cargandoLocal) {
    return (
      <div>
        <Cabecera />
        <Card>
          <div className="loading">
            <span className="spinner" aria-hidden="true" /> Ejecutando la simulación en el
            backend…
          </div>
        </Card>
      </div>
    );
  }

  if (error || errorLocal) {
    return (
      <div>
        <Cabecera />
        <Card>
          <div className="error-box" role="alert">
            <strong>No se pudieron cargar los resultados.</strong>
            <div style={{ marginTop: 4 }}>{error || errorLocal}</div>
          </div>
        </Card>
      </div>
    );
  }

  if (!resultado && comparison === "strategies") {
    return (
      <div>
        <Cabecera />
        <Card>
          <div className="empty">
            Aún no hay resultados. Ve a{" "}
            <Link to="/simulador">Configuración del Simulador</Link> y pulsa{" "}
            <strong>“Comparar estrategias”</strong>.
          </div>
        </Card>
      </div>
    );
  }

  const nada = estrategias.find((e) => e.nombre === "Nada");
  const mejor = estrategias.find((e) => e.nombre === resultado?.mejor_estrategia);
  const salvadasMejor = mejor ? mejor.salvados_media : 0;

  return (
    <div>
      <Cabecera />

      {/* Filtros compactos */}
      <Card>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Brote o variante</label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              style={selectStyle}
            >
              {ESCENARIOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Comparación</label>
            <select
              value={comparison}
              onChange={(e) => setComparison(e.target.value as "strategies" | "brotes")}
              style={selectStyle}
            >
              <option value="strategies">Comparar estrategias para el brote</option>
              <option value="brotes">Comparar brotes bajo la misma estrategia</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Intervención adicional</label>
            <select
              value={intervencionAdicional}
              onChange={(e) => setIntervencionAdicional(e.target.value)}
              style={selectStyle}
            >
              <option value="none">Ninguna</option>
              <option value="BloqueoEmergencia">Bloqueo de emergencia</option>
              <option value="VigilanciaIntensiva">Vigilancia intensiva</option>
              <option value="EvacuacionPreventiva">Evacuación preventiva</option>
              <option value="AislamientoFocalizado">Aislamiento focalizado</option>
              <option value="RefuerzoContencion">Refuerzo de contención</option>
              <option value="ControlEsporas">Control de esporas</option>
            </select>
          </div>
          {comparison === "brotes" && (
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Estrategia</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                style={selectStyle}
              >
                <option value="Nada">Sin intervención</option>
                <option value="CierresMasCentralidad">Cierres + centralidad</option>
                <option value="Anillo">Anillo perimetral</option>
                <option value="Centralidad">Por centralidad</option>
                <option value="Azar">Vacunación al azar</option>
              </select>
            </div>
          )}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      {comparison === "strategies" && resultado && (
        <>
          <div className="kpi-row">
            <MetricCard label="Mejor estrategia" value={nombreAmigable(resultado.mejor_estrategia)} color="green" />
            <MetricCard
              label="Infectados (mejor)"
              value={mejor ? num(mejor.infectados_media) : "—"}
              sub="promedio"
              color="red"
            />
            <MetricCard label="Salvados (mejor)" value={num(salvadasMejor)} sub="promedio" color="green" />
            <MetricCard
              label="Sin intervención"
              value={nada ? num(nada.infectados_media) : "—"}
              sub="infectados 'Nada'"
              color="orange"
            />
            <MetricCard label="Corridas" value={resultado.n_corridas} sub={`semilla ${resultado.semilla}`} color="blue" />
          </div>

          <div style={{ height: 16 }} />

          <Card title={`Curva de zombis por día · banda p10–p90 — ${seleccionada?.nombre ?? ""}`}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {estrategias.map((e) => (
                <button
                  key={e.nombre}
                  className={`btn ${seleccionada?.nombre === e.nombre ? "primary" : "ghost"}`}
                  style={{ padding: "6px 10px", fontSize: 12 }}
                  onClick={() => setEstrategiaSel(e.nombre)}
                >
                  {nombreAmigable(e.nombre)}
                </button>
              ))}
            </div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <ComposedChart data={curva}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="dia" stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                  <YAxis stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                  <Tooltip content={<CurveTooltip estrategia={seleccionada?.nombre} />} cursor={{ stroke: "#60A5FA", strokeWidth: 1 }} />
                  <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: 12 }} />
                  <Area type="monotone" dataKey="p10" stackId="banda" stroke="none" fill="transparent" name="p10" legendType="none" />
                  <Area type="monotone" dataKey="banda" stackId="banda" stroke="none" fill="rgba(96,165,250,0.20)" name="Rango p10–p90" />
                  <Line type="monotone" dataKey="media" stroke="#FF5263" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: "#FF5263", stroke: "#F1F5F9" }} name="Media" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
              La franja azul representa la incertidumbre entre el percentil 10 y el 90 de las{" "}
              {resultado.n_corridas} corridas.
            </div>
          </Card>

          <div style={{ height: 16 }} />

          <Card title="Infectados y salvados por estrategia">
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Estrategia</th>
                    <th>Infectados (media)</th>
                    <th>Infectados p10–p90</th>
                    <th>Salvados (media)</th>
                    <th>Salvados p10–p90</th>
                    <th>% mejor que Nada</th>
                    <th>% mejor que Azar</th>
                  </tr>
                </thead>
                <tbody>
                  {estrategias.map((e) => {
                    const base = e.nombre === "Nada" || e.nombre === "Azar";
                    const esMejor = e.nombre === resultado.mejor_estrategia;
                    return (
                      <tr key={e.nombre} style={base ? { color: "var(--muted)" } : undefined}>
                        <td>
                          {nombreAmigable(e.nombre)}
                          {esMejor && " ⭐"}
                          {base && <Pill color="orange">línea base</Pill>}
                        </td>
                        <td>{num(e.infectados_media)}</td>
                        <td>
                          {num(e.infectados_p10)} – {num(e.infectados_p90)}
                        </td>
                        <td>{num(e.salvados_media)}</td>
                        <td>
                          {num(e.salvados_p10)} – {num(e.salvados_p90)}
                        </td>
                        <td>{e.pct_mejor_que_nada.toFixed(0)}%</td>
                        <td>{e.pct_mejor_que_azar.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ height: 16 }} />

          <Card title="Recomendación">
            <div style={{ fontWeight: 700, color: "var(--green)", fontSize: 18, overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {resultado.mejor_estrategia}
            </div>
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
              {resultado.recomendacion}
            </p>
          </Card>
        </>
      )}

      {comparison === "brotes" && (
        <>
          <Card title={`Comparación de brotes — estrategia ${strategy}`}>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <ComposedChart data={brotesChartData}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="dia" stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                  <YAxis stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#1B2938", border: "1px solid #334155", color: "#F1F5F9" }} />
                  <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: 12 }} />
                  {BROTES_COMPARAR.map((sc, idx) => {
                    const colors = ["#4DD0E1", "#FF5263", "#FF7A45", "#F2C94C", "#38E89A", "#60A5FA", "#CBD5E1"];
                    return (
                      <Line
                        key={sc}
                        type="monotone"
                        dataKey={sc}
                        stroke={colors[idx % colors.length]}
                        name={ESCENARIOS.find((e) => e.value === sc)?.label ?? sc}
                        dot={false}
                      />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div style={{ height: 16 }} />

          <Card title="Infectados por brote (misma estrategia)">
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Brote</th>
                    <th>Infectados (media)</th>
                    <th>Infectados p10–p90</th>
                    <th>Salvados (media)</th>
                  </tr>
                </thead>
                <tbody>
                  {BROTES_COMPARAR.map((sc) => {
                    const r = brotesResultados[sc];
                    const est = r?.estrategias?.find((e) => e.nombre === strategy);
                    if (!est) return null;
                    return (
                      <tr key={sc}>
                        <td>{ESCENARIOS.find((e) => e.value === sc)?.label ?? sc}</td>
                        <td>{num(est.infectados_media)}</td>
                        <td>
                          {num(est.infectados_p10)} – {num(est.infectados_p90)}
                        </td>
                        <td>{num(est.salvados_media)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ height: 16 }} />

          <Card title="Recomendación">
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              Comparación de brotes bajo la estrategia seleccionada. Los resultados provienen de simulaciones reales del backend.
            </p>
          </Card>
        </>
      )}

      <div style={{ height: 16 }} />

      <Card title="Impacto de brotes por estrategia">
        {Object.keys(brotesResultados).length === 0 ? (
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
              Calcula la matriz completa de brotes × estrategias (puede tardar).
            </div>
            <button className="btn primary" onClick={calcularMatriz} disabled={cargandoLocal}>
              {cargandoLocal ? "Calculando…" : "Calcular matriz"}
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Brote o escenario</th>
                  <th>Estrategia</th>
                  <th>Infectados (media)</th>
                  <th>Infectados p10–p90</th>
                  <th>Salvados (media)</th>
                  <th>Salvados p10–p90</th>
                  <th>Zombis finales</th>
                  <th>Mejora vs no intervenir</th>
                </tr>
              </thead>
              <tbody>
                {BROTES_COMPARAR.map((sc) => {
                  const r = brotesResultados[sc];
                  if (!r) return null;
                  return r.estrategias.map((e) => {
                    const zombisFinales = e.curva_diaria?.media?.[e.curva_diaria.media.length - 1] ?? 0;
                    return (
                      <tr key={`${sc}-${e.nombre}`}>
                        <td>{ESCENARIOS.find((x) => x.value === sc)?.label ?? sc}</td>
                        <td>{nombreAmigable(e.nombre)}</td>
                        <td>{num(e.infectados_media)}</td>
                        <td>
                          {num(e.infectados_p10)} – {num(e.infectados_p90)}
                        </td>
                        <td>{num(e.salvados_media)}</td>
                        <td>
                          {num(e.salvados_p10)} – {num(e.salvados_p90)}
                        </td>
                        <td>{num(zombisFinales)}</td>
                        <td>{e.pct_mejor_que_nada.toFixed(0)}%</td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div style={{ height: 16 }} />
      <EventsPanel resultado={resultado} />
    </div>
  );
}

function Cabecera() {
  return (
    <PageTitle
      title="Resultados y Análisis"
      subtitle="Comparación de estrategias calculada por el backend"
      right={<Pill color="orange">DATOS SIMULADOS</Pill>}
    />
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  background: "#0C141D",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 8,
};
