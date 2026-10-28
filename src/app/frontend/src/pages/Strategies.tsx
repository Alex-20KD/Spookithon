import { useState } from "react";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";

interface EstrategiaInfo {
  nombre: string;
  titulo: string;
  descripcion: string;
  objetivo: string;
  como: string;
  cuando: string;
  limitaciones: string;
  brotes: string[];
}

const ORIGINALES: EstrategiaInfo[] = [
  {
    nombre: "Nada",
    titulo: "Sin intervención",
    descripcion: "Escenario de referencia sin medidas de control.",
    objetivo: "Establecer línea base de la epidemia.",
    como: "No se aplican cierres ni vacunación.",
    cuando: "Siempre como comparación.",
    limitaciones: "No reduce contagios.",
    brotes: ["Todos"],
  },
  {
    nombre: "Azar",
    titulo: "Vacunación al azar",
    descripcion: "Inmunización aleatoria de individuos según capacidad disponible.",
    objetivo: "Representar una respuesta no dirigida.",
    como: "Vacuna candidatos elegibles al azar.",
    cuando: "Como línea base de vacunación.",
    limitaciones: "No prioriza nodos clave.",
    brotes: ["Todos"],
  },
  {
    nombre: "Centralidad",
    titulo: "Por centralidad",
    descripcion: "Priorización de personas o nodos con mayor conectividad.",
    objetivo: "Reducir transmisión vacunando superpropagadores.",
    como: "Vacuna candidatos ordenados por centralidad.",
    cuando: "Redes con nodos muy conectados.",
    limitaciones: "Requiere conocer la red.",
    brotes: ["Todos"],
  },
  {
    nombre: "CierresMasCentralidad",
    titulo: "Cierres + centralidad",
    descripcion: "Combinación de cierres de lugares clave y vacunación dirigida.",
    objetivo: "Reducir contactos y vacunar estratégicamente.",
    como: "Cierra mercado y buses grandes; vacuna por centralidad.",
    cuando: "Brotes en lugares concurridos.",
    limitaciones: "Costo logístico alto.",
    brotes: ["Todos"],
  },
  {
    nombre: "Anillo",
    titulo: "Anillo perimetral",
    descripcion: "Contención alrededor de un foco inicial.",
    objetivo: "Bloquear expansión local.",
    como: "Vacuna contactos de casos conocidos; si no hay, centralidad.",
    cuando: "Focos bien identificados.",
    limitaciones: "Depende de detección.",
    brotes: ["Todos"],
  },
];

const ESPECIALES: EstrategiaInfo[] = [
  {
    nombre: "BloqueoEmergencia",
    titulo: "Bloqueo de emergencia",
    descripcion: "Reduce desplazamientos entre sectores, por lo que puede ayudar a contener corredores y hordas migratorias.",
    objetivo: "Limitar movilidad en crisis.",
    como: "Reduce movilidad zombie a 20%.",
    cuando: "Hordas y corredores.",
    limitaciones: "No elimina contagios existentes.",
    brotes: ["Corredor zombi", "Horda migratoria"],
  },
  {
    nombre: "VigilanciaIntensiva",
    titulo: "Vigilancia intensiva",
    descripcion: "Mejora la detección de acechadores y brotes ocultos.",
    objetivo: "Detectar casos antes.",
    como: "Duplica probabilidad de detección de zombis.",
    cuando: "Acechadores y brotes ocultos.",
    limitaciones: "Consume recursos.",
    brotes: ["Acechador", "Brote secundario"],
  },
  {
    nombre: "EvacuacionPreventiva",
    titulo: "Evacuación preventiva",
    descripcion: "Traslada población susceptible a sectores seguros, con límites de capacidad y riesgo de traslado.",
    objetivo: "Reducir exposición.",
    como: "Reduce infectividad global en 20%.",
    cuando: "Sectores de alto riesgo.",
    limitaciones: "Riesgo de traslado.",
    brotes: ["Todos"],
  },
  {
    nombre: "AislamientoFocalizado",
    titulo: "Aislamiento focalizado",
    descripcion: "Reduce contactos en sectores afectados por chasqueadores o brotes secundarios.",
    objetivo: "Contener focos locales.",
    como: "Reduce contactos en 30%.",
    cuando: "Chasqueadores y brotes secundarios.",
    limitaciones: "Afecta movilidad.",
    brotes: ["Chasqueador", "Brote secundario"],
  },
  {
    nombre: "RefuerzoContencion",
    titulo: "Refuerzo de contención",
    descripcion: "Reduce la probabilidad de fallo de barreras frente a gordinflones y eventos de ruptura.",
    objetivo: "Mantener barreras.",
    como: "Evita que fallos de contención reduzcan eficacia vacunal.",
    cuando: "Gordinflones y fallos.",
    limitaciones: "No cura infectados.",
    brotes: ["Gordinflón", "Fallo de contención"],
  },
  {
    nombre: "ControlEsporas",
    titulo: "Control de esporas",
    descripcion: "Reduce la exposición a eventos ficticios de dispersión asociados a gordinflones.",
    objetivo: "Limitar vía esporas.",
    como: "Reduce beta_espora a la mitad.",
    cuando: "Gordinflones.",
    limitaciones: "Solo vía esporas.",
    brotes: ["Gordinflón"],
  },
];

function Tarjeta({ e }: { e: EstrategiaInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 16 }}>{e.titulo}</strong>
        <Pill color="blue">{e.brotes.join(", ")}</Pill>
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>{e.descripcion}</div>
      <button className="btn ghost" style={{ marginTop: 8, padding: "4px 8px", fontSize: 12 }} onClick={() => setOpen(!open)}>
        {open ? "Ocultar detalles" : "Ver detalles"}
      </button>
      {open && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text)", display: "grid", gap: 4 }}>
          <div><strong>Objetivo:</strong> {e.objetivo}</div>
          <div><strong>Cómo funciona:</strong> {e.como}</div>
          <div><strong>Cuándo:</strong> {e.cuando}</div>
          <div><strong>Limitaciones:</strong> {e.limitaciones}</div>
        </div>
      )}
    </Card>
  );
}

export default function Strategies() {
  return (
    <div>
      <PageTitle title="Estrategias de Intervención" subtitle="Catálogo de medidas" right={<Pill color="orange">DATOS SIMULADOS</Pill>} />

      <Card title="A. Estrategias originales">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {ORIGINALES.map((e) => (
            <Tarjeta key={e.nombre} e={e} />
          ))}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="B. Estrategias especiales">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {ESPECIALES.map((e) => (
            <Tarjeta key={e.nombre} e={e} />
          ))}
        </div>
      </Card>
    </div>
  );
}
