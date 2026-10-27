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
  const { resultado, cargando, error } = useSimulation();
  const [catalogo, setCatalogo] = useState<CatalogoResponse | null>(null);

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
          <EpidemicMap barrios={mapa.barrios} catalogo={catalogo} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            Coordenadas del catálogo (ficticias). El tamaño y color de cada
            barrio reflejan los infectados medios de la estrategia{" "}
            <strong>{mapa.estrategia}</strong>.
          </div>
        </div>

        <div className="map-side">
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
