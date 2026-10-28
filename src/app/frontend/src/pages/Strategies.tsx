import { useState } from "react";
import {
  Shield,
  Shuffle,
  Network,
  Lock,
  CircleDot,
  Zap,
  Eye,
  Truck,
  Focus,
  ShieldCheck,
  Wind,
  Clock,
} from "lucide-react";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";

interface EstrategiaInfo {
  id: string;
  titulo: string;
  categoria: string;
  acento: string;
  icono: React.ReactNode;
  descripcion: string;
  objetivo: string;
  como: string;
  cuando: string;
  limitaciones: string;
  brotes: string[];
  duracion?: string;
}

const ORIGINALES: EstrategiaInfo[] = [
  {
    id: "Nada",
    titulo: "Sin intervención",
    categoria: "Referencia",
    acento: "#94A3B8",
    icono: <Shield size={22} />,
    descripcion: "Escenario de referencia sin medidas de control. Sirve para comparar el impacto de cualquier intervención.",
    objetivo: "Establecer la línea base de la epidemia.",
    como: "No se aplican cierres ni vacunación.",
    cuando: "Siempre como comparación.",
    limitaciones: "No reduce contagios.",
    brotes: ["Todos"],
  },
  {
    id: "Azar",
    titulo: "Vacunación al azar",
    categoria: "Prevención",
    acento: "#4DD0E1",
    icono: <Shuffle size={22} />,
    descripcion: "Inmunización aleatoria de individuos según la capacidad disponible de dosis.",
    objetivo: "Representar una respuesta no dirigida.",
    como: "Vacuna candidatos elegibles al azar.",
    cuando: "Como línea base de vacunación.",
    limitaciones: "No prioriza nodos clave.",
    brotes: ["Todos"],
  },
  {
    id: "Centralidad",
    titulo: "Por centralidad",
    categoria: "Prevención",
    acento: "#4DD0E1",
    icono: <Network size={22} />,
    descripcion: "Prioriza personas o nodos con mayor conectividad en la red de contactos.",
    objetivo: "Reducir la transmisión vacunando superpropagadores.",
    como: "Vacuna candidatos ordenados por centralidad descendente.",
    cuando: "Redes con nodos muy conectados.",
    limitaciones: "Requiere conocer la estructura de la red.",
    brotes: ["Todos"],
  },
  {
    id: "CierresMasCentralidad",
    titulo: "Cierres + centralidad",
    categoria: "Contención",
    acento: "#38E89A",
    icono: <Lock size={22} />,
    descripcion: "Combina cierres de lugares clave con vacunación dirigida por centralidad.",
    objetivo: "Reducir contactos y vacunar estratégicamente.",
    como: "Cierra mercado y buses grandes; vacuna por centralidad.",
    cuando: "Brotes en lugares concurridos.",
    limitaciones: "Costo logístico alto.",
    brotes: ["Todos"],
  },
  {
    id: "Anillo",
    titulo: "Anillo perimetral",
    categoria: "Contención",
    acento: "#38E89A",
    icono: <CircleDot size={22} />,
    descripcion: "Contención alrededor de un foco inicial mediante vacunación de contactos.",
    objetivo: "Bloquear la expansión local.",
    como: "Vacuna contactos de casos conocidos; si no hay, usa centralidad.",
    cuando: "Focos bien identificados.",
    limitaciones: "Depende de la detección.",
    brotes: ["Todos"],
  },
];

const ESPECIALES: EstrategiaInfo[] = [
  {
    id: "BloqueoEmergencia",
    titulo: "Bloqueo de emergencia",
    categoria: "Respuesta de emergencia",
    acento: "#FF5263",
    icono: <Zap size={22} />,
    descripcion: "Reduce desplazamientos entre sectores, por lo que puede ayudar a contener corredores y hordas migratorias.",
    objetivo: "Limitar la movilidad en situaciones de crisis.",
    como: "Reduce la movilidad zombie a un 20%.",
    cuando: "Hordas y corredores.",
    limitaciones: "No elimina contagios existentes.",
    brotes: ["Corredor zombi", "Horda migratoria"],
    duracion: "7 días",
  },
  {
    id: "VigilanciaIntensiva",
    titulo: "Vigilancia intensiva",
    categoria: "Vigilancia",
    acento: "#4DD0E1",
    icono: <Eye size={22} />,
    descripcion: "Mejora la detección de acechadores y brotes ocultos.",
    objetivo: "Detectar casos antes.",
    como: "Duplica la probabilidad de detección de zombis.",
    cuando: "Acechadores y brotes ocultos.",
    limitaciones: "Consume recursos.",
    brotes: ["Acechador", "Brote secundario"],
    duracion: "10 días",
  },
  {
    id: "EvacuacionPreventiva",
    titulo: "Evacuación preventiva",
    categoria: "Evacuación",
    acento: "#F2C94C",
    icono: <Truck size={22} />,
    descripcion: "Traslada población susceptible a sectores seguros, con límites de capacidad y riesgo de traslado.",
    objetivo: "Reducir la exposición.",
    como: "Reduce la infectividad global en un 20%.",
    cuando: "Sectores de alto riesgo.",
    limitaciones: "Riesgo de traslado.",
    brotes: ["Todos"],
    duracion: "7 días",
  },
  {
    id: "AislamientoFocalizado",
    titulo: "Aislamiento focalizado",
    categoria: "Contención",
    acento: "#38E89A",
    icono: <Focus size={22} />,
    descripcion: "Reduce contactos en sectores afectados por chasqueadores o brotes secundarios.",
    objetivo: "Contener focos locales.",
    como: "Reduce los contactos en un 30%.",
    cuando: "Chasqueadores y brotes secundarios.",
    limitaciones: "Afecta la movilidad.",
    brotes: ["Chasqueador", "Brote secundario"],
    duracion: "7 días",
  },
  {
    id: "RefuerzoContencion",
    titulo: "Refuerzo de contención",
    categoria: "Contención",
    acento: "#38E89A",
    icono: <ShieldCheck size={22} />,
    descripcion: "Reduce la probabilidad de fallo de barreras frente a gordinflones y eventos de ruptura.",
    objetivo: "Mantener las barreras.",
    como: "Evita que los fallos de contención reduzcan la eficacia vacunal.",
    cuando: "Gordinflones y fallos.",
    limitaciones: "No cura infectados.",
    brotes: ["Gordinflón", "Fallo de contención"],
    duracion: "10 días",
  },
  {
    id: "ControlEsporas",
    titulo: "Control de esporas",
    categoria: "Control especializado",
    acento: "#A78BFA",
    icono: <Wind size={22} />,
    descripcion: "Reduce la exposición a eventos ficticios de dispersión asociados a gordinflones.",
    objetivo: "Limitar la vía de esporas.",
    como: "Reduce beta_espora a la mitad.",
    cuando: "Gordinflones.",
    limitaciones: "Solo vía esporas.",
    brotes: ["Gordinflón"],
    duracion: "10 días",
  },
];

function Tarjeta({ e }: { e: EstrategiaInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="strat-card-v2"
      style={{ borderLeft: `3px solid ${e.acento}` }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="strat-icon" style={{ color: e.acento }}>
          {e.icono}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{e.titulo}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {e.categoria}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
        {e.descripcion}
      </div>
      <div style={{ fontSize: 12, color: "var(--text)", marginTop: 8 }}>
        <strong>Objetivo:</strong> {e.objetivo}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {e.brotes.map((b) => (
          <Pill key={b} color="blue">
            {b}
          </Pill>
        ))}
        {e.duracion && (
          <Pill color="orange">
            <Clock size={11} /> {e.duracion}
          </Pill>
        )}
      </div>
      <button
        className="btn ghost"
        style={{ marginTop: 10, padding: "6px 10px", fontSize: 12 }}
        onClick={() => setOpen(!open)}
      >
        {open ? "Ocultar detalles" : "Ver detalles"}
      </button>
      {open && (
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--text)", display: "grid", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <div><strong>Cómo funciona:</strong> {e.como}</div>
          <div><strong>Cuándo utilizarla:</strong> {e.cuando}</div>
          <div><strong>Limitaciones:</strong> {e.limitaciones}</div>
        </div>
      )}
    </div>
  );
}

export default function Strategies() {
  return (
    <div>
      <PageTitle
        title="Estrategias de Intervención"
        subtitle="Explora las medidas disponibles para prevenir, contener y responder a los brotes epidemiológicos"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <Pill color="blue">11 estrategias</Pill>
            <Pill color="green">5 originales</Pill>
            <Pill color="orange">6 especializadas</Pill>
          </div>
        }
      />

      <Card title="A. Estrategias originales">
        <div className="strat-grid">
          {ORIGINALES.map((e) => (
            <Tarjeta key={e.id} e={e} />
          ))}
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="B. Estrategias especializadas">
        <div className="strat-grid">
          {ESPECIALES.map((e) => (
            <Tarjeta key={e.id} e={e} />
          ))}
        </div>
      </Card>
    </div>
  );
}
