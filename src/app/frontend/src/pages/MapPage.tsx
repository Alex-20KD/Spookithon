import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSimulation } from "../context/SimulationContext";
import { obtenerCatalogo } from "../services/apiClient";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import EpidemicMap from "../components/map/EpidemicMap";
import type { CatalogoResponse } from "../types/api";

const num = (n: number) => Math.round(n).toLocaleString("es-EC");

const NIVELES: { color: string; etiqueta: string }[] = [
  { color: "#38E89A", etiqueta: "Bajo" },
  { color: "#FF7A45", etiqueta: "Medio" },
  { color: "#FF4D5A", etiqueta: "Alto" },
  { color: "#8B1E2D", etiqueta: "Crítico" },
];

export default function MapPage() {
  const { resultado, cargando, error, dia, setDia, params } = useSimulation();
  const [catalogo, setCatalogo] = useState<CatalogoResponse | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);

  useEffect(() => {
    if (!reproduciendo) return;
    const id = setInterval(() => {
      if (dia >= params.dias) {
        setReproduciendo(false);
        setDia(0);
      } else {
        setDia(dia + 1);
      }
    }, 1000 / velocidad);
    return () => clearInterval(id);
  }, [reproduciendo, dia, velocidad, params.dias, setDia]);

  // El catálogo es geografía fija; se carga una vez para los edificios de
  // referencia. Si falla, el mapa igual funciona con los barrios del resultado.
  useEffect(() => {
    const ctrl = new AbortController();
    obtenerCatalogo(ctrl.signal)
      .then(setCatalogo)
      .catch(() => setCatalogo(null));
    return () => ctrl.abort();
  }, []);

  const mapa = resultado?.mapa ?? null;

  const cabecera = (
    <PageTitle
      title="Mapa Epidemiológico"
      subtitle="Infectados por barrio según la mejor estrategia"
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

  if (!mapa) {
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

  // Ranking de barrios por infectados (para la tabla lateral).
  const ranking = [...mapa.barrios]
    .filter((b) => b.infectados_media != null)
    .sort((a, b) => (b.infectados_media as number) - (a.infectados_media as number));

  return (
    <div>
      {cabecera}
      <div className="split">
        <div>
          <EpidemicMap barrios={mapa.barrios} catalogo={catalogo} dia={dia} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            La reproducción por día es una <strong>demostración ilustrativa</strong>: la API
            no devuelve series geográficas por día, por lo que el mapa agregado no cambia
            con el día.
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            Coordenadas del catálogo (ficticias). El tamaño y color de cada
            barrio reflejan los infectados medios de la estrategia{" "}
            <strong>{mapa.estrategia}</strong>.
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
              <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => { setReproduciendo(false); setDia(0); }}>
                Reiniciar
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
              Día actual: {dia} / {params.dias}
            </div>
            <div className="range-control" style={{ marginTop: 8, marginBottom: 0 }}>
              <label>
                <span>Velocidad</span>
                <span className="val">{velocidad.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.5}
                value={velocidad}
                onChange={(e) => setVelocidad(Number(e.target.value))}
              />
            </div>
          </Card>
          <Card title="Nivel de riesgo">
            <div className="legend">
              {NIVELES.map((n) => (
                <div key={n.etiqueta} className="legend-item">
                  <span className="legend-dot" style={{ background: n.color }} />
                  {n.etiqueta}
                </div>
              ))}
              <div className="legend-item">
                <span className="legend-dot" style={{ background: "#4DA8FF" }} />
                Edificio (hospital, mercado, colegio)
              </div>
            </div>
          </Card>

          <Card title="Barrios más afectados">
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Barrio</th>
                    <th>Infectados (media)</th>
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
    </div>
  );
}
