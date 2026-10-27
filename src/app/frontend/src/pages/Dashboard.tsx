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
            <MetricCard label="Mejor estrategia" value={resultado.mejor_estrategia} color="green" />
            <MetricCard label="Infectados (mejor)" value={num(mejor.infectados_media)} sub="promedio" color="red" />
            <MetricCard label="Salvados (mejor)" value={num(mejor.salvados_media)} sub="promedio" color="green" />
            <MetricCard
              label="Sin intervención"
              value={nada ? num(nada.infectados_media) : "—"}
              sub="infectados 'Nada'"
              color="orange"
            />
            <MetricCard label="Corridas" value={resultado.n_corridas} sub={`semilla ${resultado.semilla}`} color="blue" />
          </div>

          <div style={{ height: 16 }} />
          <div className="grid grid-2">
            <Card title={`Curva de la mejor estrategia · ${resultado.mejor_estrategia}`}>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <ComposedChart data={curva}>
                    <CartesianGrid stroke="#263746" strokeDasharray="3 3" />
                    <XAxis dataKey="dia" stroke="#8B9BB0" />
                    <YAxis stroke="#8B9BB0" />
                    <Tooltip
                      contentStyle={{ background: "#16222E", border: "1px solid #263746", color: "#E6EDF3" }}
                      formatter={(v, n) => [num(Number(v)), String(n)]}
                      labelFormatter={(l) => `Día ${l}`}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="p10" stackId="b" stroke="none" fill="transparent" legendType="none" name="p10" />
                    <Area type="monotone" dataKey="banda" stackId="b" stroke="none" fill="rgba(77,168,255,0.18)" name="Rango p10–p90" />
                    <Line type="monotone" dataKey="media" stroke="#FF4D5A" strokeWidth={2} dot={false} name="Media" />
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
