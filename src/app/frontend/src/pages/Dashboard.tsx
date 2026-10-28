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
import Card from "../components/ui/Card";
import MetricCard from "../components/ui/MetricCard";
import PageTitle from "../components/ui/PageTitle";
import Pill from "../components/ui/Pill";
import EventsPanel from "../components/EventsPanel";
import CurveTooltip from "../components/charts/CurveTooltip";
import { nombreAmigable } from "../utils/estrategias";

const num = (n: number) => Math.round(n).toLocaleString("es-EC");

export default function Dashboard() {
  const { resultado, cargando, error } = useSimulation();

  const mejor =
    resultado?.estrategias.find((e) => e.nombre === resultado.mejor_estrategia) ?? null;
  const nada = resultado?.estrategias.find((e) => e.nombre === "Nada") ?? null;

  const curva =
    mejor?.curva_diaria.dias.map((d, i) => ({
      dia: d,
      media: mejor.curva_diaria.media[i],
      p10: mejor.curva_diaria.p10[i],
      banda: Math.max(0, (mejor.curva_diaria.p90[i] ?? 0) - (mejor.curva_diaria.p10[i] ?? 0)),
    })) ?? [];

  const reduccion = mejor && nada ? ((nada.infectados_media - mejor.infectados_media) / nada.infectados_media) * 100 : 0;

  return (
    <div>
      <PageTitle
        title="Centro de Vigilancia Epidemiológica"
        subtitle="Simulación ficticia en Manta, Ecuador"
        right={<Pill color="orange">DATOS SIMULADOS</Pill>}
      />

      {cargando && (
        <Card>
          <div className="loading">
            <span className="spinner" aria-hidden="true" /> Ejecutando simulación…
          </div>
        </Card>
      )}

      {!cargando && error && (
        <Card>
          <div className="error-box" role="alert">
            <strong>Error al conectar con el backend.</strong>
            <div style={{ marginTop: 4 }}>{error}</div>
          </div>
        </Card>
      )}

      {!cargando && !error && !resultado && (
        <Card>
          <div className="empty">
            No hay simulación todavía. Ve a{" "}
            <Link to="/simulador">Configuración del Simulador</Link> y pulsa{" "}
            <strong>“Comparar estrategias”</strong>.
          </div>
        </Card>
      )}

      {!cargando && !error && resultado && mejor && (
        <>
          <div className="kpi-row">
            <MetricCard label="Mejor estrategia" value={nombreAmigable(resultado.mejor_estrategia)} color="green" />
            <MetricCard label="Infectados (mejor)" value={num(mejor.infectados_media)} sub="promedio" color="red" />
            <MetricCard label="Personas salvadas" value={num(mejor.salvados_media)} sub="promedio" color="green" />
            <MetricCard label="Sin intervención" value={nada ? num(nada.infectados_media) : "—"} sub="infectados 'Nada'" color="orange" />
            <MetricCard label="Reducción" value={`${reduccion.toFixed(1)}%`} sub="frente a no intervenir" color="blue" />
            <MetricCard label="Corridas" value={resultado.n_corridas} sub={`semilla ${resultado.semilla}`} color="blue" />
          </div>

          <div style={{ height: 16 }} />

          <div className="grid grid-2">
            <Card title={`Comparación epidemiológica · ${resultado.mejor_estrategia}`}>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <ComposedChart data={curva}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="dia" stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                    <YAxis stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                    <Tooltip content={<CurveTooltip estrategia={resultado.mejor_estrategia} />} cursor={{ stroke: "#60A5FA", strokeWidth: 1 }} />
                    <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: 12 }} />
                    <Area type="monotone" dataKey="p10" stackId="b" stroke="none" fill="transparent" legendType="none" name="p10" />
                    <Area type="monotone" dataKey="banda" stackId="b" stroke="none" fill="rgba(96,165,250,0.20)" name="Rango p10–p90" />
                    <Line type="monotone" dataKey="media" stroke="#FF5263" strokeWidth={2} dot={false} name="Mejor estrategia" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card title="Resumen de amenazas">
                <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
                  <div>Brotes configurados: <strong>{resultado.n_corridas > 0 ? "Ver en simulador" : "—"}</strong></div>
                  <div>Variantes: <strong>8 tipos</strong></div>
                  <div>Eventos críticos: <strong>Ver en mapa</strong></div>
                  <Link to="/brotes">Ver catálogo de brotes →</Link>
                </div>
              </Card>
              <Card title="Explorar">
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
                  <Link to="/resultados">Ver análisis completo →</Link>
                  <Link to="/mapa">Ver mapa epidemiológico →</Link>
                  <Link to="/estrategias">Ver estrategias →</Link>
                </div>
              </Card>
            </div>
          </div>

          <div style={{ height: 16 }} />
          <Card title="Conclusión ejecutiva">
            <div style={{ fontWeight: 700, color: "var(--green)", fontSize: 16 }}>
              {nombreAmigable(resultado.mejor_estrategia)}
            </div>
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
              {resultado.recomendacion}
            </p>
          </Card>

          <div style={{ height: 16 }} />
          <EventsPanel resultado={resultado} />
        </>
      )}
    </div>
  );
}
