import { useState } from "react";
import { useSimulation } from "../context/SimulationContext";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";

const ESPECIALES = [
  { nombre: "Bloqueo de emergencia", id: "BloqueoEmergencia", util: "Hordas y corredores", efecto: "Reduce desplazamientos entre sectores", duracion: "7 días", limitacion: "No elimina contagios existentes" },
  { nombre: "Vigilancia intensiva", id: "VigilanciaIntensiva", util: "Acechadores y brotes ocultos", efecto: "Mejora detección", duracion: "10 días", limitacion: "Consume recursos" },
  { nombre: "Evacuación preventiva", id: "EvacuacionPreventiva", util: "Sectores de alto riesgo", efecto: "Traslada susceptibles", duracion: "7 días", limitacion: "Riesgo de traslado" },
  { nombre: "Aislamiento focalizado", id: "AislamientoFocalizado", util: "Chasqueadores y brotes secundarios", efecto: "Reduce contactos en sectores", duracion: "7 días", limitacion: "Afecta movilidad" },
  { nombre: "Refuerzo de contención", id: "RefuerzoContencion", util: "Gordinflones y fallos", efecto: "Reduce fallo de barreras", duracion: "10 días", limitacion: "No cura infectados" },
  { nombre: "Control de esporas", id: "ControlEsporas", util: "Gordinflones", efecto: "Reduce exposición a esporas", duracion: "10 días", limitacion: "Solo vía esporas" },
];

export default function Strategies() {
  const { comparar } = useSimulation();
  const [decisiones, setDecisiones] = useState([
    { dia: 0, estrategia: "CierresMasCentralidad", duracion: 60 },
    { dia: 30, estrategia: "BloqueoEmergencia", duracion: 10 },
  ]);
  const [ejecutando, setEjecutando] = useState(false);

  const simularPlan = async () => {
    setEjecutando(true);
    const intervenciones = decisiones.map((d) => ({ dia: d.dia, estrategia: d.estrategia, duracion: d.duracion }));
    await comparar(undefined, intervenciones);
    setEjecutando(false);
  };

  return (
    <div>
      <PageTitle title="Estrategias de Intervención" subtitle="Planificación y comparación" right={<Pill color="orange">DATOS SIMULADOS</Pill>} />

      <Card title="Estrategias originales">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {["Nada", "Azar", "Centralidad", "CierresMasCentralidad", "Anillo"].map((e) => (
            <div key={e} className="strat-card">
              <strong>{e}</strong>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Estrategias especiales">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {ESPECIALES.map((e) => (
            <div key={e.id} className="strat-card">
              <strong>{e.nombre}</strong>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Útil contra: {e.util}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Efecto: {e.efecto}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Duración: {e.duracion}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Limitación: {e.limitacion}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Planificador estratégico">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {decisiones.map((d, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ minWidth: 50, fontWeight: 700 }}>Día {d.dia}</span>
              <select
                value={d.estrategia}
                onChange={(e) => {
                  const nd = [...decisiones];
                  nd[idx].estrategia = e.target.value;
                  setDecisiones(nd);
                }}
                style={selectStyle}
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
                value={d.dia}
                onChange={(e) => {
                  const nd = [...decisiones];
                  nd[idx].dia = Number(e.target.value);
                  setDecisiones(nd);
                }}
                style={{ ...selectStyle, width: 80 }}
              />
              <input
                type="number"
                value={d.duracion}
                onChange={(e) => {
                  const nd = [...decisiones];
                  nd[idx].duracion = Number(e.target.value);
                  setDecisiones(nd);
                }}
                style={{ ...selectStyle, width: 80 }}
              />
            </div>
          ))}
          <button
            className="btn ghost"
            onClick={() => setDecisiones([...decisiones, { dia: 30, estrategia: "BloqueoEmergencia", duracion: 10 }])}
          >
            Agregar decisión
          </button>
          <button className="btn primary" onClick={simularPlan} disabled={ejecutando}>
            {ejecutando ? "Simulando…" : "Simular plan"}
          </button>
        </div>
      </Card>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: 8,
  background: "#0C141D",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 8,
};
