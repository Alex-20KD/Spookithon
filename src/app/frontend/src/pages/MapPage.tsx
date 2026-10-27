import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSimulation } from "../context/SimulationContext";
import { obtenerCatalogo } from "../services/apiClient";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import EpidemicMap from "../components/map/EpidemicMap";
import EventsPanel from "../components/EventsPanel";
import type { CatalogoResponse } from "../types/api";
import type { BarrioMapa } from "../types/api";

const num = (n: number) => Math.round(n).toLocaleString("es-EC");

const NIVELES: { color: string; etiqueta: string }[] = [
  { color: "#38E89A", etiqueta: "Bajo" },
  { color: "#FF7A45", etiqueta: "Medio" },
  { color: "#FF4D5A", etiqueta: "Alto" },
  { color: "#8B1E2D", etiqueta: "Crítico" },
];

const ESTRATEGIAS = ["Nada", "Azar", "Centralidad", "CierresMasCentralidad", "Anillo"];
const NOMBRES: Record<string, string> = {
  Nada: "Sin intervención",
  Azar: "Vacunación al azar",
  Centralidad: "Por centralidad",
  CierresMasCentralidad: "Cierres + centralidad",
  Anillo: "Anillo",
};

export default function MapPage() {
  const {
    resultado,
    cargando,
    error,
    dia,
    setDia,
    params,
    paramsEjecutados,
    trayectoria,
    estrategiaSeleccionada,
    setEstrategiaSeleccionada,
    cargarTrayectoria,
    paramsModificados,
  } = useSimulation();
  const [catalogo, setCatalogo] = useState<CatalogoResponse | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [cargandoTray, setCargandoTray] = useState(false);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    obtenerCatalogo(ctrl.signal)
      .then(setCatalogo)
      .catch(() => setCatalogo(null));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!reproduciendo) {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = window.setInterval(() => {
      setDia((prev) => {
        if (prev >= params.dias) {
          setReproduciendo(false);
          return 0;
        }
        return prev + 1;
      });
    }, 1000 / velocidad);
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [reproduciendo, velocidad, params.dias, setDia]);

  // Cargar trayectoria inicial cuando hay simulación y no hay trayectoria.
  useEffect(() => {
    if (resultado && !trayectoria && !cargandoTray && paramsEjecutados) {
      setCargandoTray(true);
      cargarTrayectoria(estrategiaSeleccionada).finally(() => setCargandoTray(false));
    }
  }, [resultado, trayectoria, paramsEjecutados]);

  const cambiarEstrategia = async (e: string) => {
    setEstrategiaSeleccionada(e);
    if (paramsEjecutados) {
      setCargandoTray(true);
      await cargarTrayectoria(e);
      setCargandoTray(false);
    }
  };

  // Barrios para el día seleccionado.
  let barriosDia: BarrioMapa[] = [];
  let diaGlobal = trayectoria?.serie_global?.[dia] ?? null;

  if (trayectoria) {

    barriosDia = trayectoria.serie_por_barrio.map((b) => {
      const punto = b.puntos[dia] ?? b.puntos[b.puntos.length - 1];
      const acum = punto?.infectados_acumulados ?? 0;
      return {
        id: b.id,
        nombre: b.nombre,
        lat: b.lat,
        lng: b.lng,
        infectados_media: acum,
      } as BarrioMapa;
    });
  } else if (resultado?.mapa) {
    barriosDia = resultado.mapa.barrios;
  }

  const mapa = barriosDia.length ? { barrios: barriosDia, estrategia: trayectoria?.estrategia ?? resultado?.mapa?.estrategia ?? "" } : null;

  const cabecera = (
    <PageTitle
      title="Mapa Epidemiológico"
      subtitle="Evolución diaria por barrio según la trayectoria seleccionada"
      right={<Pill color="orange">DATOS SIMULADOS</Pill>}
    />
  );

  if (cargando) {
    return (
      <div>
        {cabecera}
        <Card>
          <div className="loading">
            <span className="spinner" aria-hidden="true" /> Calculando el mapa…
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {cabecera}
        <Card>
          <div className="error-box" role="alert">
            <strong>No se pudo cargar el mapa.</strong>
            <div style={{ marginTop: 4 }}>{error}</div>
          </div>
        </Card>
      </div>
    );
  }

  if (!resultado) {
    return (
      <div>
        {cabecera}
        <Card>
          <div className="empty">
            Aún no hay simulación. Ve a{" "}
            <Link to="/simulador">Configuración del Simulador</Link> y pulsa{" "}
            <strong>“Comparar estrategias”</strong> para ver el mapa.
          </div>
        </Card>
      </div>
    );
  }

  const ranking = [...barriosDia]
    .filter((b) => b.infectados_media != null)
    .sort((a, b) => (b.infectados_media as number) - (a.infectados_media as number));

  return (
    <div>
      {cabecera}

      {paramsModificados && (
        <Card>
          <div className="error-box" role="alert">
            Los parámetros cambiaron. Ejecuta nuevamente la simulación para actualizar la trayectoria.
          </div>
        </Card>
      )}

      <div style={{ height: 12 }} />

      <Card title="Estrategia de la trayectoria">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={estrategiaSeleccionada}
            onChange={(e) => cambiarEstrategia(e.target.value)}
            style={selectStyle}
          >
            {ESTRATEGIAS.map((e) => (
              <option key={e} value={e}>
                {NOMBRES[e]}
              </option>
            ))}
          </select>
          {cargandoTray && <span className="loading-inline"><span className="spinner" /> Cargando trayectoria…</span>}
        </div>
      </Card>

      <div style={{ height: 12 }} />

      <div className="split">
        <div>
          {mapa && <EpidemicMap barrios={mapa.barrios} catalogo={catalogo} dia={dia} />}
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            {trayectoria
              ? "La evolución por día proviene de una trayectoria real del simulador (una corrida determinista)."
              : "Modo agregado: ejecuta una simulación para obtener una trayectoria diaria."}
          </div>
        </div>

        <div className="map-side">
          <Card title="Controles de reproducción">
            <div className="sim-controls">
              <button className="btn primary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setReproduciendo((v) => !v)}>
                {reproduciendo ? "Pausar" : "Reproducir"}
              </button>
              <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setDia(Math.min(params.dias, dia + 1))}>
                Avanzar día
              </button>
              <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setDia(Math.max(0, dia - 1))}>
                Retroceder
              </button>
              <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => { setReproduciendo(false); setDia(0); }}>
                Reiniciar
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
              Día actual: {dia} / {params.dias}
            </div>
            <div className="range-control" style={{ marginTop: 8, marginBottom: 0 }}>
              <label>
                <span>Línea temporal</span>
                <span className="val">{dia}</span>
              </label>
              <input
                type="range"
                min={0}
                max={params.dias}
                step={1}
                value={dia}
                onChange={(e) => { setReproduciendo(false); setDia(Number(e.target.value)); }}
              />
            </div>
            <div className="range-control" style={{ marginTop: 8, marginBottom: 0 }}>
              <label>
                <span>Velocidad</span>
                <span className="val">{velocidad.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.5}
                value={velocidad}
                onChange={(e) => setVelocidad(Number(e.target.value))}
              />
            </div>
          </Card>

          {diaGlobal && (
            <Card title="Estado del día">
              <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
                <div>Zombis activos: <strong>{num(diaGlobal.ZOMBI)}</strong></div>
                <div>Nuevos contagios: <strong>{num(diaGlobal.nuevos_contagios)}</strong></div>
                <div>Inmunes: <strong>{num(diaGlobal.INMUNE)}</strong></div>
                <div>Infectados acumulados: <strong>{num(trayectoria?.infectados_totales ?? 0)}</strong></div>
              </div>
            </Card>
          )}

          <Card title="Nivel de riesgo">
            <div className="legend">
              {NIVELES.map((n) => (
                <div key={n.etiqueta} className="legend-item">
                  <span className="legend-dot" style={{ background: n.color }} />
                  {n.etiqueta}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Barrios más afectados">
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Barrio</th>
                    <th>Infectados acum.</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((b) => (
                    <tr key={b.id}>
                      <td>{b.nombre}</td>
                      <td>{num(b.infectados_media as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <div style={{ height: 16 }} />
      <EventsPanel resultado={resultado} dia={dia} />
    </div>
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
