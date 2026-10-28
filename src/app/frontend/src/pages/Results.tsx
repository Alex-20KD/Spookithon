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
  ReferenceLine,
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
import type { ResultadoEstrategia } from "../types/api";

const ESPECIALES = ["BloqueoEmergencia", "VigilanciaIntensiva", "EvacuacionPreventiva", "AislamientoFocalizado", "RefuerzoContencion", "ControlEsporas"];

const num = (n: number) => Math.round(n).toLocaleString("es-EC");

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  background: "#0C141D",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 8,
};

/** Construye los puntos de la curva con la banda p10-p90 para recharts. */
function datosCurva(e: ResultadoEstrategia) {
  const { dias, media, p10, p90 } = e.curva_diaria;
  return dias.map((d, i) => ({
    dia: d,
    media: media[i],
    p10: p10[i],
    banda: Math.max(0, (p90[i] ?? 0) - (p10[i] ?? 0)),
    p90: p90[i],
  }));
}

export default function Results() {
  const { resultado, cargando, error, params, viaTransmision } = useSimulation();
  const [estrategiaGrafico, setEstrategiaGrafico] = useState<string>("Nada");
  const [resultadoGrafico, setResultadoGrafico] = useState<any>(null);
  const [cargandoGrafico, setCargandoGrafico] = useState(false);
  const [brotesResultados, setBrotesResultados] = useState<Record<string, any>>({});
  const [cargandoMatriz, setCargandoMatriz] = useState(false);

  const estrategias = resultado?.estrategias ?? [];



  const seleccionadaGrafico = useMemo(() => {
    const lista = resultadoGrafico?.estrategias ?? [];
    if (!lista.length) return null;
    if (ESPECIALES.indexOf(estrategiaGrafico) !== -1) {
      return lista.find((e: any) => e.nombre === "Nada") ?? lista[0];
    }
    return lista.find((e: any) => e.nombre === estrategiaGrafico) ?? lista[0];
  }, [resultadoGrafico, estrategiaGrafico]);

  const curvaGrafico = seleccionadaGrafico ? datosCurva(seleccionadaGrafico) : [];

  useEffect(() => {
    if (ESPECIALES.indexOf(estrategiaGrafico) === -1) {
      setResultadoGrafico(resultado);
      return;
    }
    let cancelled = false;
    async function run() {
      setCargandoGrafico(true);
      const cuerpo = {
        ...params,
        via_transmision: viaTransmision,
        eventos: [],
        intervenciones: [{ dia: 0, estrategia: estrategiaGrafico, duracion: 60 }],
        n_corridas: params.n_corridas,
      };
      try {
        const r = await compararEstrategias(cuerpo as any);
        if (!cancelled) setResultadoGrafico(r);
      } catch (e) {
        if (!cancelled) setResultadoGrafico(null);
      } finally {
        if (!cancelled) setCargandoGrafico(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [resultado, estrategiaGrafico, params, viaTransmision]);

  const ESCENARIOS_BROTES = ["base", "brote_secundario", "zombie_corredor", "horda_migratoria", "fallo_contencion", "acechador", "chasqueador", "gordinflon"];
  const eventosParaEscenario = (sc: string) => {
    const dia = 5; const barrio = "b01";
    switch (sc) {
      case "base": return [];
      case "brote_secundario": return [{ tipo: "brote_secundario", dia, barrio_id: barrio, intensidad: 5, duracion: 5, nombre: "brote_secundario" }];
      case "zombie_corredor": return [{ tipo: "zombie_corredor", dia, barrio_id: barrio, intensidad: 1, duracion: 5, nombre: "zombie_corredor" }];
      case "horda_migratoria": return [{ tipo: "horda_migratoria", dia, barrio_id: barrio, intensidad: 5, duracion: 5, nombre: "horda_migratoria" }];
      case "fallo_contencion": return [{ tipo: "fallo_contencion", dia, barrio_id: barrio, intensidad: 1, duracion: 5, nombre: "fallo_contencion" }];
      case "acechador": return [{ tipo: "aparicion_acechador", dia, barrio_id: barrio, intensidad: 3, duracion: 7, nombre: "aparicion_acechador" }];
      case "chasqueador": return [{ tipo: "aparicion_chasqueador", dia, barrio_id: barrio, intensidad: 3, duracion: 7, nombre: "aparicion_chasqueador" }];
      case "gordinflon": return [{ tipo: "aparicion_gordinflon", dia, barrio_id: barrio, intensidad: 2, duracion: 7, nombre: "aparicion_gordinflon" }];
      default: return [];
    }
  };

  const calcularMatriz = async () => {
    setCargandoMatriz(true);
    const res: Record<string, any> = {};
    await Promise.all(
      ESCENARIOS_BROTES.map(async (sc) => {
        const ev = eventosParaEscenario(sc);
        const cuerpo = { ...params, via_transmision: viaTransmision, eventos: ev, n_corridas: params.n_corridas };
        try {
          const r = await compararEstrategias(cuerpo as any);
          res[sc] = r;
        } catch (e) {
          // ignore
        }
      }),
    );
    setBrotesResultados(res);
    setCargandoMatriz(false);
  };

  // --- Estados de carga / error / vacío --- //
  if (cargando) {
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

  if (error) {
    return (
      <div>
        <Cabecera />
        <Card>
          <div className="error-box" role="alert">
            <strong>No se pudieron cargar los resultados.</strong>
            <div style={{ marginTop: 4 }}>{error}</div>
          </div>
        </Card>
      </div>
    );
  }

  if (!resultado) {
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
  const mejor = estrategias.find((e) => e.nombre === resultado.mejor_estrategia);
  const salvadasMejor = mejor ? mejor.salvados_media : 0;

  return (
    <div>
      <Cabecera />

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

      <Card title={`Curva de zombis por día · banda p10–p90 — ${estrategiaGrafico}`}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
          <select value={estrategiaGrafico} onChange={(e) => setEstrategiaGrafico(e.target.value)} style={{ ...selectStyle, width: 220 }} disabled={cargandoGrafico}>
            <optgroup label="Originales">
              <option value="Nada">Sin intervención</option>
              <option value="CierresMasCentralidad">Cierres + centralidad</option>
              <option value="Anillo">Anillo perimetral</option>
              <option value="Centralidad">Por centralidad</option>
              <option value="Azar">Vacunación al azar</option>
            </optgroup>
            <optgroup label="Especiales">
              <option value="BloqueoEmergencia">Bloqueo de emergencia</option>
              <option value="VigilanciaIntensiva">Vigilancia intensiva</option>
              <option value="EvacuacionPreventiva">Evacuación preventiva</option>
              <option value="AislamientoFocalizado">Aislamiento focalizado</option>
              <option value="RefuerzoContencion">Refuerzo de contención</option>
              <option value="ControlEsporas">Control de esporas</option>
            </optgroup>
          </select>
          {cargandoGrafico && <span className="loading-inline"><span className="spinner" /> Cargando…</span>}
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <ComposedChart data={curvaGrafico}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="dia" stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
              <YAxis stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
              <Tooltip content={<CurveTooltip estrategia={estrategiaGrafico} />} cursor={{ stroke: "#60A5FA", strokeWidth: 1 }} />
              <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: 12 }} />
              <Area type="monotone" dataKey="p10" stackId="banda" stroke="none" fill="transparent" name="p10" legendType="none" />
              <Area type="monotone" dataKey="banda" stackId="banda" stroke="none" fill="rgba(96,165,250,0.20)" name="Rango p10–p90" />
              <Line type="monotone" dataKey="media" stroke="#FF5263" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: "#FF5263", stroke: "#F1F5F9" }} name="Media" />
              {ESPECIALES.indexOf(estrategiaGrafico) !== -1 && (
                <>
                  <ReferenceLine x={0} stroke="#38E89A" strokeDasharray="4 4" label={{ value: "Inicio", fill: "#38E89A", fontSize: 11 }} />
                  <ReferenceLine x={60} stroke="#FF7A45" strokeDasharray="4 4" label={{ value: "Fin", fill: "#FF7A45", fontSize: 11 }} />
                </>
              )}
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
          {nombreAmigable(resultado.mejor_estrategia)}
        </div>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
          {resultado.recomendacion}
        </p>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Impacto de brotes y estrategias">
        {Object.keys(brotesResultados).length === 0 ? (
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
              Calcula la matriz de brotes × estrategias (puede tardar).
            </div>
            <button className="btn primary" onClick={calcularMatriz} disabled={cargandoMatriz}>
              {cargandoMatriz ? "Calculando…" : "Calcular matriz"}
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Brote</th>
                  <th>Estrategia</th>
                  <th>Infectados (media)</th>
                  <th>P10–P90</th>
                  <th>Salvados (media)</th>
                  <th>Mejora vs sin intervención</th>
                </tr>
              </thead>
              <tbody>
                {ESCENARIOS_BROTES.map((sc) => {
                  const r = brotesResultados[sc];
                  if (!r) return null;
                  return r.estrategias.map((e: any) => (
                    <tr key={`${sc}-${e.nombre}`}>
                      <td>{sc}</td>
                      <td>{nombreAmigable(e.nombre)}</td>
                      <td>{num(e.infectados_media)}</td>
                      <td>
                        {num(e.infectados_p10)} – {num(e.infectados_p90)}
                      </td>
                      <td>{num(e.salvados_media)}</td>
                      <td>{e.pct_mejor_que_nada.toFixed(0)}%</td>
                    </tr>
                  ));
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

