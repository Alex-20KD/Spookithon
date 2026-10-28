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

  const poblacionData = (trayectoria?.serie_global ?? []).map((p) => ({
    dia: p.dia,
    SANO: p.SANO,
    INCUBANDO: p.INCUBANDO,
    PORTADOR: p.PORTADOR,
    ZOMBI: p.ZOMBI,
    INMUNE: p.INMUNE,
  }));

  const comparacionData = [
    { nombre: "Sin intervención", infectados: nada?.infectados_media ?? 0 },
    { nombre: "Mejor estrategia", infectados: mejor?.infectados_media ?? 0 },
  ];

  const reduccion = mejor && nada ? ((nada.infectados_media - mejor.infectados_media) / nada.infectados_media) * 100 : 0;

  const barriosDia0 = trayectoria?.serie_por_barrio?.map((b) => ({
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
          {/* Sección 1: Escenario */}
          <Card title="1. El escenario">
            <div style={{ fontSize: 14, display: "grid", gap: 4 }}>
              <div>Población simulada: <strong>3000</strong></div>
              <div>Duración: <strong>{params.dias} días</strong></div>
              <div>Casos iniciales: <strong>4</strong></div>
              <div>Lugar de inicio: <strong>{params.lugar_inicio}</strong></div>
              <div>Corridas: <strong>{resultado.n_corridas}</strong> · Semilla: <strong>{resultado.semilla}</strong></div>
            </div>
          </Card>

          <div style={{ height: 16 }} />

          {/* Sección 2: Propagación territorial */}
          <Card title="2. Propagación territorial">
            <div style={{ height: 320 }}>
              <EpidemicMap
                barrios={barriosDia0 as any}
                catalogo={null}
                dia={0}
                movimientos={[]}
                brotes={[]}
                contagiosPorLugar={trayectoria?.serie_global?.[0]?.contagios_por_lugar ?? []}
                showHeatmap={true}
                showMovimientos={false}
                showEventos={true}
                variable="acumulados"
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <Link to="/mapa">Ver mapa epidemiológico completo →</Link>
            </div>
          </Card>

          <div style={{ height: 16 }} />

          {/* Sección 3: Evolución de la población */}
          <Card title="3. Evolución de la población">
            <div style={{ width: "100%", height: 320 }}>
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

          <div style={{ height: 16 }} />

          {/* Sección 4: Impacto de intervenciones */}
          <Card title="4. Impacto de las intervenciones">
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={comparacionData}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="nombre" stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                  <YAxis stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#1B2938", border: "1px solid #334155", color: "#F1F5F9" }} />
                  <Bar dataKey="infectados" fill="#FF5263" name="Infectados promedio" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
              Reducción porcentual: <strong>{reduccion.toFixed(1)}%</strong> · Infectados evitados: <strong>{num(mejor.salvados_media)}</strong>
            </div>
          </Card>

          <div style={{ height: 16 }} />

          {/* Sección 5: Historia de eventos */}
          <Card title="5. Historia de los eventos">
            <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
              <div>Día 0: Inicio del brote (paciente cero).</div>
              <div>Día 4: Activación del protocolo epidemiológico.</div>
              <div>Día 10: Disponibilidad de vacunas.</div>
              {resultado.recomendacion && <div>Conclusión: {resultado.recomendacion}</div>}
            </div>
          </Card>

          <div style={{ height: 16 }} />

          {/* Sección 6: Conclusión */}
          <Card title="6. Conclusión ejecutiva">
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
