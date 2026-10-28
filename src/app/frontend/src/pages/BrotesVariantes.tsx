import { useState } from "react";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import {
  Zap,
  Users,
  ShieldAlert,
  Eye,
  Wind,
  Skull,
  Activity,
} from "lucide-react";

interface BroteInfo {
  id: string;
  nombre: string;
  nivel: string;
  color: string;
  icono: React.ReactNode;
  descripcion: string;
  cuando: string;
  efectos: string;
  mapa: string;
  estrategias: string;
  limitaciones: string;
}

const BROTES: BroteInfo[] = [
  {
    id: "brote_inicial",
    nombre: "Brote inicial",
    nivel: "Alto",
    color: "#FF5263",
    icono: <Skull size={28} />,
    descripcion: "Paciente cero y casos iniciales en un lugar de origen.",
    cuando: "Día 0.",
    efectos: "Siembra inicial de infectados; define el foco de origen.",
    mapa: "Marcador en el barrio de origen.",
    estrategias: "Cierres + centralidad, Anillo.",
    limitaciones: "No evita la propagación si no se detecta a tiempo.",
  },
  {
    id: "brote_secundario",
    nombre: "Brote secundario",
    nivel: "Alto",
    color: "#FF7A45",
    icono: <Activity size={28} />,
    descripcion: "Aparición de nuevos casos en un barrio distinto al foco inicial.",
    cuando: "Día configurable.",
    efectos: "Infecta personas sanas en el barrio seleccionado.",
    mapa: "Nuevo foco en el barrio seleccionado.",
    estrategias: "Aislamiento focalizado, Cierres + centralidad.",
    limitaciones: "Requiere vigilancia para detectarlo.",
  },
  {
    id: "zombie_corredor",
    nombre: "Corredor zombi",
    nivel: "Crítico",
    color: "#FF5263",
    icono: <Zap size={28} />,
    descripcion: "Zombi con movilidad elevada que se desplaza entre sectores.",
    cuando: "Día configurable.",
    efectos: "Duplica la infectividad del portador y aumenta la propagación.",
    mapa: "Movimientos entre barrios.",
    estrategias: "Bloqueo de emergencia, Cierres + centralidad.",
    limitaciones: "Difícil de contener sin bloqueos.",
  },
  {
    id: "horda_migratoria",
    nombre: "Horda migratoria",
    nivel: "Crítico",
    color: "#FF5263",
    icono: <Users size={28} />,
    descripcion: "Concentración de zombis que se desplaza hacia un sector.",
    cuando: "Día configurable.",
    efectos: "Genera múltiples zombis en un barrio.",
    mapa: "Agrupación en el sector afectado.",
    estrategias: "Bloqueo de emergencia, Anillo.",
    limitaciones: "Puede saturar la capacidad de respuesta.",
  },
  {
    id: "fallo_contencion",
    nombre: "Fallo de contención",
    nivel: "Alto",
    color: "#FF7A45",
    icono: <ShieldAlert size={28} />,
    descripcion: "Compromiso temporal de las barreras de contención.",
    cuando: "Día configurable.",
    efectos: "Reduce la eficacia de la vacuna a la mitad durante la duración.",
    mapa: "Indicador de fallo en el sector.",
    estrategias: "Refuerzo de contención.",
    limitaciones: "No elimina contagios existentes.",
  },
  {
    id: "acechador",
    nombre: "Acechador",
    nivel: "Alto",
    color: "#FF7A45",
    icono: <Eye size={28} />,
    descripcion: "Variante sigilosa con detección tardía y mayor generación de focos secundarios.",
    cuando: "Día configurable.",
    efectos: "Reduce la detección de zombis a la mitad y aumenta la movilidad.",
    mapa: "Focos secundarios en sectores vecinos.",
    estrategias: "Vigilancia intensiva, Cierres + centralidad.",
    limitaciones: "Difícil de detectar a tiempo.",
  },
  {
    id: "chasqueador",
    nombre: "Chasqueador",
    nivel: "Alto",
    color: "#FF7A45",
    icono: <Zap size={28} />,
    descripcion: "Variante con riesgo elevado en encuentros cercanos y atracción a zonas de actividad.",
    cuando: "Día configurable.",
    efectos: "Aumenta la infectividad de los zombis a 1.5.",
    mapa: "Concentración en sectores de actividad.",
    estrategias: "Aislamiento focalizado, Cierres + centralidad.",
    limitaciones: "Puede concentrarse en sectores clave.",
  },
  {
    id: "gordinflon",
    nombre: "Gordinflón",
    nivel: "Crítico",
    color: "#FF5263",
    icono: <Wind size={28} />,
    descripcion: "Variante con movilidad reducida pero mayor resistencia a la contención y dispersión de esporas.",
    cuando: "Día configurable.",
    efectos: "Reduce la movilidad, compromete cierres y aumenta las esporas.",
    mapa: "Dispersión localizada de esporas.",
    estrategias: "Refuerzo de contención, Control de esporas.",
    limitaciones: "Puede comprometer barreras.",
  },
];

export default function BrotesVariantes() {
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <div>
      <PageTitle
        title="Brotes y Variantes"
        subtitle="Catálogo de amenazas epidemiológicas ficticias"
        right={<Pill color="orange">DATOS SIMULADOS</Pill>}
      />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {BROTES.map((b) => (
          <Card key={b.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ color: b.color }}>{b.icono}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{b.nombre}</div>
                <Pill color="red">{b.nivel}</Pill>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>{b.descripcion}</div>
            <button className="btn ghost" style={{ marginTop: 8, padding: "4px 8px", fontSize: 12 }} onClick={() => setAbierto(abierto === b.id ? null : b.id)}>
              {abierto === b.id ? "Ocultar detalles" : "Ver detalles"}
            </button>
            {abierto === b.id && (
              <div style={{ marginTop: 8, fontSize: 12, display: "grid", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                <div><strong>Cuándo:</strong> {b.cuando}</div>
                <div><strong>Efectos:</strong> {b.efectos}</div>
                <div><strong>Mapa:</strong> {b.mapa}</div>
                <div><strong>Estrategias:</strong> {b.estrategias}</div>
                <div><strong>Limitaciones:</strong> {b.limitaciones}</div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
