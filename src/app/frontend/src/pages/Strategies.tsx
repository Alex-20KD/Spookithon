import { Link } from "react-router-dom";
import { useSimulation } from "../context/SimulationContext";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import { nombreAmigable, DESCRIPCIONES_ESTRATEGIA, esLineaBase } from "../utils/estrategias";

const num = (n: number) => Math.round(n).toLocaleString("es-EC");

export default function Strategies() {
  const { resultado, cargando, error } = useSimulation();

  if (cargando) {
    return (
      <div>
        <Cabecera />
        <Card>
          <div className="loading">
            <span className="spinner" aria-hidden="true" /> Calculando estrategias…
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
            <strong>No se pudieron cargar las estrategias.</strong>
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
            Primero ejecuta una comparación en{" "}
            <Link to="/simulador">Configuración del Simulador</Link>.
          </div>
        </Card>
      </div>
    );
  }

  const estrategias = resultado.estrategias;

  return (
    <div>
      <Cabecera />
      <div className="grid grid-3">
        {estrategias.map((e) => {
          const esMejor = e.nombre === resultado.mejor_estrategia;
          return (
            <div key={e.nombre} className={`strat-card ${esMejor ? "recommended" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{nombreAmigable(e.nombre)}</div>
                {esMejor && <Pill color="green">Recomendada</Pill>}
                {esLineaBase(e.nombre) && <Pill color="orange">Línea base</Pill>}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                {DESCRIPCIONES_ESTRATEGIA[e.nombre]}
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
                <div>
                  Infectados (media):{" "}
                  <strong style={{ color: "var(--text)" }}>{num(e.infectados_media)}</strong>
                </div>
                <div>
                  Salvados (media):{" "}
                  <strong style={{ color: "var(--text)" }}>{num(e.salvados_media)}</strong>
                </div>
                <div>
                  Rango infectados p10–p90:{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {num(e.infectados_p10)} – {num(e.infectados_p90)}
                  </strong>
                </div>
                <div>
                  Mejor que “Nada”:{" "}
                  <strong style={{ color: "var(--text)" }}>{e.pct_mejor_que_nada.toFixed(0)}%</strong>
                </div>
                <div>
                  Mejor que “Azar”:{" "}
                  <strong style={{ color: "var(--text)" }}>{e.pct_mejor_que_azar.toFixed(0)}%</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height: 16 }} />
      <Card title="Recomendación">
        <p style={{ color: "var(--muted)", fontSize: 14 }}>{resultado.recomendacion}</p>
      </Card>
    </div>
  );
}

function Cabecera() {
  return (
    <PageTitle
      title="Estrategias de Intervención"
      subtitle="Comparación de las 5 estrategias según el backend"
      right={<Pill color="orange">DATOS SIMULADOS</Pill>}
    />
  );
}
