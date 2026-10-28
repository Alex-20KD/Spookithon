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
import CurveTooltip from "../components/charts/CurveTooltip";
import EventsPanel from "../components/EventsPanel";
import { nombreAmigable } from "../utils/estrategias";

const num = (n: number) => Math.round(n).toLocaleString("es-EC");

export default function Dashboard() {
  const { resultado, cargando, error } = useSimulation();

  const mejor =
    resultado?.estrategias.find((e) => e.nombre === resultado.mejor_estrategia) ?? null;
  const nada = resultado?.estrategias.find((e) => e.nombre === "Nada") ?? null;
  const azar = resultado?.estrategias.find((e) => e.nombre === "Azar") ?? null;

  const curva =
    mejor?.curva_diaria.dias.map((d, i) => ({
      dia: d,
      media: mejor.curva_diaria.media[i],
      p10: mejor.curva_diaria.p10[i],
      banda: Math.max(0, (mejor.curva_diaria.p90[i] ?? 0) - (mejor.curva_diaria.p10[i] ?? 0)),
    })) ?? [];

  return (
    <div>
      <PageTitle
        title="Dashboard de Vigilancia"
        subtitle="Centro de control epidemiológico · Plaga Caracol"
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
            <strong>“Comparar estrategias”</strong> para traer datos del backend.
          </div>
        </Card>
      )}

      {!cargando && !error && resultado && mejor && (
        <>
          <div className="kpi-row">
            <MetricCard label="Mejor estrategia" value={nombreAmigable(resultado.mejor_estrategia)} color="green" />
            <MetricCard label="Infectados (mejor)" value={num(mejor.infectados_media)} sub="promedio" color="red" />
            <MetricCard label="Salvados (mejor)" value={num(mejor.salvados_media)} sub="promedio" color="green" />
            <MetricCard
              label="Sin intervención"
              value={nada ? num(nada.infectados_media) : "—"}
              sub="infectados 'Nada'"
              color="orange"
            />
            <MetricCard
              label="Intervención aleatoria"
              value={azar ? num(azar.infectados_media) : "—"}
              sub="infectados 'Azar'"
              color="blue"
            />
          </div>
          <div style={{ height: 12 }} />
          <div className="kpi-row">
            <MetricCard label="Corridas" value={resultado.n_corridas} sub={`semilla ${resultado.semilla}`} color="blue" />
            <MetricCard label="Mejor que 'Nada'" value={mejor ? `${mejor.pct_mejor_que_nada.toFixed(0)}%` : "—"} sub="de corridas" color="green" />
            <MetricCard label="Mejor que 'Azar'" value={mejor ? `${mejor.pct_mejor_que_azar.toFixed(0)}%` : "—"} sub="de corridas" color="green" />
            <MetricCard
              label="R0"
              value={resultado.r0 ? resultado.r0.media.toFixed(2) : "—"}
              sub={resultado.r0 ? `rango ${resultado.r0.p10}–${resultado.r0.p90} · V=${resultado.r0.v}d` : "no disponible"}
              color={resultado.r0 ? "orange" : "muted"}
            />
          </div>

          <div style={{ height: 16 }} />
          <div className="grid grid-2">
            <Card title={`Curva de la mejor estrategia · ${resultado.mejor_estrategia}`}>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <ComposedChart data={curva}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="dia" stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                    <YAxis stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                    <Tooltip
                      content={<CurveTooltip estrategia={resultado.mejor_estrategia} />}
                      cursor={{ stroke: "#60A5FA", strokeWidth: 1 }}
                    />
                    <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: 12 }} />
                    <Area type="monotone" dataKey="p10" stackId="b" stroke="none" fill="transparent" legendType="none" name="p10" />
                    <Area type="monotone" dataKey="banda" stackId="b" stroke="none" fill="rgba(96,165,250,0.20)" name="Rango p10–p90" />
                    <Line type="monotone" dataKey="media" stroke="#FF5263" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: "#FF5263", stroke: "#F1F5F9" }} name="Media" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card title="Recomendación">
                <div style={{ fontWeight: 700, color: "var(--green)" }}>{resultado.mejor_estrategia}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                  {resultado.recomendacion}
                </div>
              </Card>
              <Card title="Explorar">
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
                  <Link to="/resultados">Ver curvas y tabla completa →</Link>
                  <Link to="/estrategias">Comparar estrategias →</Link>
                  <Link to="/simulador">Ajustar parámetros →</Link>
                </div>
              </Card>
            </div>
          </div>

          <div style={{ height: 16 }} />
          <EventsPanel resultado={resultado} />
        </>
      )}
    </div>
  );
}
