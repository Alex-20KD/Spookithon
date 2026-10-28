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
    brotes,
  } = useSimulation();
  const [catalogo, setCatalogo] = useState<CatalogoResponse | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [cargandoTray, setCargandoTray] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMovimientos, setShowMovimientos] = useState(false);
  const [showEventos, setShowEventos] = useState(true);
  const [variable, setVariable] = useState<"nuevos" | "acumulados" | "zombis">("nuevos");
  const [intervenciones, setIntervenciones] = useState<{ dia: number; estrategia: string; duracion: number }[]>([
    { dia: 0, estrategia: "CierresMasCentralidad", duracion: 60 },
    { dia: 30, estrategia: "BloqueoEmergencia", duracion: 10 },
  ]);

  const cargaIniciadaRef = useRef(false);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    obtenerCatalogo(ctrl.signal)
      .then(setCatalogo)
      .catch(() => setCatalogo(null));
    return () => ctrl.abort();
  }, []);

  const setDiaRef = useRef(setDia);
  const maxDiasRef = useRef(paramsEjecutados?.dias ?? params.dias);
  setDiaRef.current = setDia;
  maxDiasRef.current = paramsEjecutados?.dias ?? params.dias;

  useEffect(() => {
    if (!reproduciendo) {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = window.setInterval(() => {
      const maxDias = maxDiasRef.current;
      setDiaRef.current((prev) => {
        if (prev >= maxDias) {
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
  }, [reproduciendo, velocidad]);

  useEffect(() => {
    if (resultado && !trayectoria && !cargandoTray && paramsEjecutados && !cargaIniciadaRef.current) {
      cargaIniciadaRef.current = true;
      setCargandoTray(true);
      cargarTrayectoria(estrategiaSeleccionada).finally(() => setCargandoTray(false));
    }
    if (trayectoria) cargaIniciadaRef.current = false;
  }, [resultado, trayectoria, paramsEjecutados, cargandoTray, estrategiaSeleccionada, cargarTrayectoria]);

  const cambiarEstrategia = async (e: string) => {
    setEstrategiaSeleccionada(e);
    setDia(0);
    if (paramsEjecutados) {
      setCargandoTray(true);
      await cargarTrayectoria(e);
      setCargandoTray(false);
    }
  };

  let barriosDia: BarrioMapa[] = [];

  if (trayectoria) {
    barriosDia = trayectoria.serie_por_barrio
      .filter((b) => b.primer_dia_infeccion == null || b.primer_dia_infeccion <= dia)
      .map((b) => {
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
      subtitle="Centro de operaciones epidemiológicas"
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

  const zombisActivos = trayectoria?.serie_global?.[dia]?.ZOMBI ?? 0;
  const nuevosContagios = trayectoria?.serie_global?.[dia]?.nuevos_contagios ?? 0;
  const infectadosAcum = barriosDia.reduce((a, b) => a + (b.infectados_media ?? 0), 0);
  const estrategiasActivas = intervenciones
    .filter((iv) => iv.dia <= dia && iv.dia + iv.duracion >= dia)
    .map((iv) => iv.estrategia);

  return (
    <div>
      {cabecera}

      {/* Barra de indicadores */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
        <Card><div style={{ fontSize: 12, color: "var(--muted)" }}>Día</div><div style={{ fontSize: 18, fontWeight: 700 }}>{dia} / {paramsEjecutados?.dias ?? params.dias}</div></Card>
        <Card><div style={{ fontSize: 12, color: "var(--muted)" }}>Zombis activos</div><div style={{ fontSize: 18, fontWeight: 700 }}>{num(zombisActivos)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "var(--muted)" }}>Nuevos contagios</div><div style={{ fontSize: 18, fontWeight: 700 }}>{num(nuevosContagios)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "var(--muted)" }}>Infectados acum.</div><div style={{ fontSize: 18, fontWeight: 700 }}>{num(infectadosAcum)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "var(--muted)" }}>Estrategias activas</div><div style={{ fontSize: 14, fontWeight: 700 }}>{estrategiasActivas.length ? estrategiasActivas.join(", ") : estrategiaSeleccionada}</div></Card>
      </div>

      {paramsModificados && (
        <Card>
          <div className="error-box" role="alert">
            Los parámetros cambiaron. Ejecuta nuevamente la simulación para actualizar la trayectoria.
          </div>
        </Card>
      )}

      <div className="map-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 12 }}>
        <div>
        <div>
          {mapa && (
            <div className="map-container" style={{ height: 620 }}>
              <EpidemicMap
                barrios={mapa.barrios}
                catalogo={catalogo}
                dia={dia}
                movimientos={trayectoria?.serie_global?.[dia]?.movimientos ?? []}
                brotes={brotes}
                contagiosPorLugar={trayectoria?.serie_global?.[dia]?.contagios_por_lugar ?? []}
                showHeatmap={showHeatmap}
                showMovimientos={showMovimientos}
                showEventos={showEventos}
                variable={variable}
              />
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            {trayectoria
              ? "La evolución por día proviene de una trayectoria real del simulador (una corrida determinista)."
              : "Modo agregado: ejecuta una simulación para obtener una trayectoria diaria."}
          </div>

          <div style={{ height: 12 }} />
          <Card title="Centro de decisiones">
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Escenario de referencia</label>
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
              {cargandoTray && <span className="loading-inline"><span className="spinner" /> Cargando…</span>}
            </div>

            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
              Estrategias activas: {estrategiasActivas.length ? estrategiasActivas.join(", ") : estrategiaSeleccionada}
            </div>

            {intervenciones.map((iv, idx) => (
              <div key={idx} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6, padding: 6, border: "1px solid var(--border)", borderRadius: 8 }}>
                <span style={{ minWidth: 40, fontSize: 12 }}>Día {iv.dia}</span>
                <select
                  value={iv.estrategia}
                  onChange={(e) => {
                    const n = [...intervenciones];
                    n[idx].estrategia = e.target.value;
                    setIntervenciones(n);
                  }}
                  style={{ ...selectStyle, width: 160 }}
                >
                  <option value="CierresMasCentralidad">Cierres + centralidad</option>
                  <option value="BloqueoEmergencia">Bloqueo de emergencia</option>
                  <option value="VigilanciaIntensiva">Vigilancia intensiva</option>
                  <option value="EvacuacionPreventiva">Evacuación preventiva</option>
                  <option value="AislamientoFocalizado">Aislamiento focalizado</option>
                  <option value="RefuerzoContencion">Refuerzo de contención</option>
                  <option value="ControlEsporas">Control de esporas</option>
                </select>
                <input
                  type="number"
                  value={iv.dia}
                  onChange={(e) => {
                    const n = [...intervenciones];
                    n[idx].dia = Number(e.target.value);
                    setIntervenciones(n);
                  }}
                  style={{ ...selectStyle, width: 60 }}
                />
                <input
                  type="number"
                  value={iv.duracion}
                  onChange={(e) => {
                    const n = [...intervenciones];
                    n[idx].duracion = Number(e.target.value);
                    setIntervenciones(n);
                  }}
                  style={{ ...selectStyle, width: 60 }}
                />
                <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setIntervenciones(intervenciones.filter((_, i) => i !== idx))}>
                  Quitar
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setIntervenciones([...intervenciones, { dia: 30, estrategia: "BloqueoEmergencia", duracion: 10 }])}>
                Agregar
              </button>
              <button
                className="btn primary"
                style={{ padding: "4px 8px", fontSize: 11 }}
                onClick={() => {
                  setCargandoTray(true);
                  cargarTrayectoria(estrategiaSeleccionada, intervenciones).finally(() => setCargandoTray(false));
                }}
                disabled={cargandoTray}
              >
                {cargandoTray ? "Aplicando…" : "Aplicar plan"}
              </button>
            </div>
          </Card>

        </div>
        <div className="map-side">
          <Card title="Controles de reproducción">
            <div className="sim-controls">
              <button className="btn primary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setReproduciendo((v) => !v)}>
                {reproduciendo ? "Pausar" : "Reproducir"}
              </button>
              <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setDia(Math.min(params.dias, dia + 1))}>
                Avanzar
              </button>
              <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setDia(Math.max(0, dia - 1))}>
                Retroceder
              </button>
              <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => { setReproduciendo(false); setDia(0); }}>
                Reiniciar
              </button>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
              <label><input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} /> Heatmap</label>
              <label><input type="checkbox" checked={showMovimientos} onChange={(e) => setShowMovimientos(e.target.checked)} /> Movimientos</label>
              <label><input type="checkbox" checked={showEventos} onChange={(e) => setShowEventos(e.target.checked)} /> Eventos</label>
            </div>
            <div className="range-control" style={{ marginTop: 8, marginBottom: 0 }}>
              <label>
                <span>Línea temporal</span>
                <span className="val">{dia}</span>
              </label>
              <input
                type="range"
                min={0}
                max={paramsEjecutados?.dias ?? params.dias}
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
            <div className="range-control" style={{ marginTop: 8, marginBottom: 0 }}>
              <label>
                <span>Variable</span>
              </label>
              <select value={variable} onChange={(e) => setVariable(e.target.value as any)} style={selectStyle}>
                <option value="nuevos">Nuevos contagios</option>
                <option value="acumulados">Infectados acumulados</option>
                <option value="zombis">Zombis activos</option>
              </select>
            </div>
          </Card>
        </div>

          <div style={{ height: 12 }} />
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

          <div style={{ height: 12 }} />
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
