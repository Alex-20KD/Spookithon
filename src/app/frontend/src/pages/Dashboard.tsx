import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ComposedChart,
  Area,
  BarChart,
  Bar,
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
import EpidemicMap from "../components/map/EpidemicMap";
import { nombreAmigable } from "../utils/estrategias";

const num = (n: number) => Math.round(n).toLocaleString("es-EC");

export default function Dashboard() {
  const { resultado, cargando, error, params, trayectoria, cargarTrayectoria } = useSimulation();

  useEffect(() => {
    if (resultado && !trayectoria) {
      cargarTrayectoria(resultado.mejor_estrategia).catch(() => {});
    }
  }, [resultado]);

  const mejor = resultado?.estrategias.find((e) => e.nombre === resultado.mejor_estrategia) ?? null;
  const nada = resultado?.estrategias.find((e) => e.nombre === "Nada") ?? null;

  const poblacion = Number(resultado?.parametros_efectivos?.poblacion ?? 3000);
  const casosIniciales = 4;

  const poblacionData = (trayectoria?.serie_global ?? []).map((p) => ({
    dia: p.dia,
    SANO: p.SANO,
    INCUBANDO: p.INCUBANDO,
    PORTADOR: p.PORTADOR,
    ZOMBI: p.ZOMBI,
    INMUNE: p.INMUNE,
  }));

  const reduccion = mejor && nada ? ((nada.infectados_media - mejor.infectados_media) / nada.infectados_media) * 100 : 0;

  const barriosMapa = trayectoria?.serie_por_barrio?.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    lat: b.lat,
    lng: b.lng,
    infectados_media: b.puntos?.[0]?.infectados_acumulados ?? 0,
  })) ?? resultado?.mapa?.barrios ?? [];

  return (
    <div>
      <PageTitle
        title="Centro de Vigilancia Epidemiológica"
        subtitle="PLAGA CERO | Simulación epidemiológica ficticia en Manta, Ecuador"
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
          {/* Fila 1: Encabezado ya arriba */}

          {/* Fila 2: KPIs */}
          <div className="kpi-row" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            <MetricCard label="Población" value={num(poblacion)} sub="simulada" color="blue" />
            <MetricCard label="Duración" value={`${params.dias} días`} sub="horizonte" color="blue" />
            <MetricCard label="Casos iniciales" value={casosIniciales} sub="paciente cero + 3" color="orange" />
            <MetricCard label="Infectados evitados" value={num(mejor.salvados_media)} sub="mejor estrategia" color="green" />
            <MetricCard label="Reducción" value={`${reduccion.toFixed(1)}%`} sub="frente a no intervenir" color="blue" />
          </div>

          <div style={{ height: 16 }} />

          {/* Fila 3: Mapa + Evolución */}
          <div className="grid grid-2">
            <Card title="Propagación territorial">
              <div style={{ height: 360 }}>
                <EpidemicMap
                  barrios={barriosMapa as any}
                  catalogo={null}
                  dia={0}
                  movimientos={[]}
                  brotes={[]}
                  contagiosPorLugar={trayectoria?.serie_global?.[0]?.contagios_por_lugar ?? []}
                  showHeatmap={true}
                  showMovimientos={false}
                  showEventos={true}
                  variable="acumulados"
                  height={360}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <Link to="/mapa">Ver mapa epidemiológico completo →</Link>
              </div>
            </Card>

            <Card title="Evolución de la población">
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                  <ComposedChart data={poblacionData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="dia" stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                    <YAxis stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#1B2938", border: "1px solid #334155", color: "#F1F5F9" }} />
                    <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: 12 }} />
                    <Area type="monotone" dataKey="SANO" stackId="1" stroke="none" fill="#38E89A" fillOpacity={0.3} name="Sanos" />
                    <Area type="monotone" dataKey="INCUBANDO" stackId="1" stroke="none" fill="#F2C94C" fillOpacity={0.4} name="Incubando" />
                    <Area type="monotone" dataKey="PORTADOR" stackId="1" stroke="none" fill="#FF7A45" fillOpacity={0.4} name="Portadores" />
                    <Area type="monotone" dataKey="ZOMBI" stackId="1" stroke="none" fill="#FF5263" fillOpacity={0.5} name="Zombis" />
                    <Area type="monotone" dataKey="INMUNE" stackId="1" stroke="none" fill="#4DD0E1" fillOpacity={0.3} name="Inmunes" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div style={{ height: 16 }} />

          {/* Fila 4: Impacto + Eventos */}
          <div className="grid grid-2">
            <Card title="Impacto de las intervenciones">
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={[
                    { nombre: "Sin intervención", infectados: nada?.infectados_media ?? 0 },
                    { nombre: "Mejor estrategia", infectados: mejor?.infectados_media ?? 0 },
                  ]}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="nombre" stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                    <YAxis stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#1B2938", border: "1px solid #334155", color: "#F1F5F9" }} />
                    <Bar dataKey="infectados" fill="#FF5263" name="Infectados promedio" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                Reducción: <strong>{reduccion.toFixed(1)}%</strong> · Infectados evitados: <strong>{num(mejor.salvados_media)}</strong>
              </div>
            </Card>

            <Card title="Historia de los eventos">
              <div style={{ fontSize: 14, display: "grid", gap: 6 }}>
                <div>Día 0: Inicio del brote (paciente cero).</div>
                <div>Día 4: Activación del protocolo epidemiológico.</div>
                <div>Día 10: Disponibilidad de vacunas.</div>
                <div>Estrategia recomendada: <strong>{nombreAmigable(resultado.mejor_estrategia)}</strong></div>
              </div>
            </Card>
          </div>

          <div style={{ height: 16 }} />

          {/* Fila 5: Conclusión */}
          <Card title="Conclusión ejecutiva">
            <div style={{ fontWeight: 700, color: "var(--green)", fontSize: 18 }}>
              {nombreAmigable(resultado.mejor_estrategia)}
            </div>
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
              {resultado.recomendacion}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 13 }}>
              <Link to="/resultados">Ver análisis completo →</Link>
              <Link to="/estrategias">Ver estrategias →</Link>
              <Link to="/brotes">Ver brotes y variantes →</Link>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
