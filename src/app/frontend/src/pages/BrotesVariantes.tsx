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
  imagen: string;
  nivel: string;
  color: string;
  icono: React.ReactNode;
  etapa: string;
  descripcion: string;
  comportamiento: string;
  efectos: string;
  propagacion: string;
  estrategias: string;
  limitaciones: string;
  cuándo: string;
  mapa: string;
}

const BROTES: BroteInfo[] = [
  {
    id: "brote_inicial",
    nombre: "Brote inicial",
    imagen: "/images/brotes/brote_inicial.png",
    nivel: "Alto",
    color: "#FF5263",
    icono: <Skull size={28} />,
    etapa: "Día 0",
    descripcion: "Paciente cero y casos iniciales en un lugar de origen. Representa el inicio del brote en un sector específico de Manta.",
    comportamiento: "Se siembra un paciente cero más casos extra en el lugar de inicio seleccionado. A partir de ahí, la epidemia se propaga por la red de contactos.",
    efectos: "Define el foco de origen y la trayectoria inicial de la epidemia.",
    propagacion: "La propagación comienza en el sector de origen y se extiende a barrios vecinos a través de la red de contactos.",
    estrategias: "Cierres + centralidad, Anillo perimetral.",
    limitaciones: "No evita la propagación si no se detecta a tiempo.",
    cuándo: "Día 0, en el lugar de inicio configurado.",
    mapa: "Marcador en el barrio de origen.",
  },
  {
    id: "zombie_corredor",
    nombre: "Corredor zombi",
    imagen: "/images/brotes/corredor.png",
    nivel: "Crítico",
    color: "#FF5263",
    icono: <Zap size={28} />,
    etapa: "Día configurable",
    descripcion: "Variante con movilidad elevada que se desplaza entre sectores, aumentando el riesgo de propagación geográfica.",
    comportamiento: "El portador infecta con mayor eficacia y la movilidad zombie se activa, permitiendo desplazamientos entre barrios.",
    efectos: "Duplica la infectividad del portador y activa la movilidad zombie.",
    propagacion: "Acelera la propagación a barrios vecinos mediante desplazamientos reales de zombis.",
    estrategias: "Bloqueo de emergencia, Cierres + centralidad.",
    limitaciones: "Difícil de contener sin bloqueos de movilidad.",
    cuándo: "Día configurable, en el barrio seleccionado.",
    mapa: "Movimientos entre barrios.",
  },
  {
    id: "acechador",
    nombre: "Acechador",
    imagen: "/images/brotes/acechador.png",
    nivel: "Alto",
    color: "#FF7A45",
    icono: <Eye size={28} />,
    etapa: "Día configurable",
    descripcion: "Variante sigilosa con detección tardía y mayor generación de focos secundarios.",
    comportamiento: "Reduce la detección de zombis a la mitad y aumenta la movilidad, generando focos secundarios.",
    efectos: "Reduce la detección de zombis a la mitad y aumenta la movilidad.",
    propagacion: "Genera focos secundarios en sectores vecinos, dificultando la contención.",
    estrategias: "Vigilancia intensiva, Cierres + centralidad.",
    limitaciones: "Difícil de detectar a tiempo.",
    cuándo: "Día configurable, en el barrio seleccionado.",
    mapa: "Focos secundarios en sectores vecinos.",
  },
  {
    id: "chasqueador",
    nombre: "Chasqueador",
    imagen: "/images/brotes/chasqueador.png",
    nivel: "Alto",
    color: "#FF7A45",
    icono: <Zap size={28} />,
    etapa: "Día configurable",
    descripcion: "Variante con riesgo elevado en encuentros cercanos y atracción a zonas de actividad.",
    comportamiento: "Aumenta la infectividad de los zombis a 1.5 y reduce contactos en sectores afectados bajo aislamiento.",
    efectos: "Aumenta la infectividad de los zombis a 1.5.",
    propagacion: "Se concentra en sectores de actividad, aumentando el riesgo local.",
    estrategias: "Aislamiento focalizado, Cierres + centralidad.",
    limitaciones: "Puede concentrarse en sectores clave.",
    cuándo: "Día configurable, en el barrio seleccionado.",
    mapa: "Concentración en sectores de actividad.",
  },
  {
    id: "gordinflon",
    nombre: "Gordinflón",
    imagen: "/images/brotes/gordinflon.png",
    nivel: "Crítico",
    color: "#FF5263",
    icono: <Wind size={28} />,
    etapa: "Día configurable",
    descripcion: "Variante con movilidad reducida pero mayor resistencia a la contención y dispersión de esporas.",
    comportamiento: "Reduce la movilidad, compromete cierres (solo 50% de bloqueo) y aumenta las esporas.",
    efectos: "Reduce la movilidad, compromete cierres y aumenta las esporas.",
    propagacion: "Dispersión localizada de esporas en el sector afectado.",
    estrategias: "Refuerzo de contención, Control de esporas.",
    limitaciones: "Puede comprometer barreras.",
    cuándo: "Día configurable, en el barrio seleccionado.",
    mapa: "Dispersión localizada de esporas.",
  },
  {
    id: "horda_migratoria",
    nombre: "Horda migratoria",
    imagen: "/images/brotes/orda_migratoria.png",
    nivel: "Crítico",
    color: "#FF5263",
    icono: <Users size={28} />,
    etapa: "Día configurable",
    descripcion: "Concentración de zombis que se desplaza hacia un sector, generando múltiples casos en un barrio.",
    comportamiento: "Genera múltiples zombis en un barrio seleccionado.",
    efectos: "Genera múltiples zombis en un barrio.",
    propagacion: "Agrupación en el sector afectado, saturando la capacidad de respuesta.",
    estrategias: "Bloqueo de emergencia, Anillo perimetral.",
    limitaciones: "Puede saturar la capacidad de respuesta.",
    cuándo: "Día configurable, en el barrio seleccionado.",
    mapa: "Agrupación en el sector afectado.",
  },
  {
    id: "brote_secundario",
    nombre: "Brote secundario",
    imagen: "/images/brotes/brote_secundario.png",
    nivel: "Alto",
    color: "#FF7A45",
    icono: <Activity size={28} />,
    etapa: "Día configurable",
    descripcion: "Aparición de nuevos casos en un barrio distinto al foco inicial.",
    comportamiento: "Infecta personas sanas en el barrio seleccionado.",
    efectos: "Infecta personas sanas en el barrio seleccionado.",
    propagacion: "Nuevo foco en el barrio seleccionado, extendiendo la epidemia.",
    estrategias: "Aislamiento focalizado, Cierres + centralidad.",
    limitaciones: "Requiere vigilancia para detectarlo.",
    cuándo: "Día configurable, en el barrio seleccionado.",
    mapa: "Nuevo foco en el barrio seleccionado.",
  },
  {
    id: "fallo_contencion",
    nombre: "Fallo de contención",
    imagen: "/images/brotes/fallo_contension.png",
    nivel: "Alto",
    color: "#FF7A45",
    icono: <ShieldAlert size={28} />,
    etapa: "Día configurable",
    descripcion: "Compromiso temporal de las barreras de contención.",
    comportamiento: "Reduce la eficacia de la vacuna a la mitad durante la duración.",
    efectos: "Reduce la eficacia de la vacuna a la mitad durante la duración.",
    propagacion: "Aumenta la vulnerabilidad del sistema de contención.",
    estrategias: "Refuerzo de contención.",
    limitaciones: "No elimina contagios existentes.",
    cuándo: "Día configurable, en el barrio seleccionado.",
    mapa: "Indicador de fallo en el sector.",
  },
];

function ImagenBrote({ b }: { b: BroteInfo }) {
  return (
    <img
      src={b.imagen}
      alt={b.nombre}
      width={280}
      height={170}
      style={{ objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
    />
  );
}

export default function BrotesVariantes() {
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <div>
      <PageTitle title="Brotes y Variantes" subtitle="Catálogo de amenazas epidemiológicas ficticias" right={<Pill color="orange">DATOS SIMULADOS</Pill>} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {BROTES.map((b) => (
          <Card key={b.id}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <ImagenBrote b={b} />
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{b.nombre}</div>
                  <Pill color="red">{b.nivel}</Pill>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{b.etapa}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>{b.descripcion}</div>
                <div style={{ fontSize: 13, color: "var(--text)", marginTop: 6 }}><strong>Comportamiento:</strong> {b.comportamiento}</div>
                <div style={{ fontSize: 13, color: "var(--text)", marginTop: 6 }}><strong>Propagación:</strong> {b.propagacion}</div>
              </div>
              <div style={{ minWidth: 240, fontSize: 12, display: "grid", gap: 6 }}>
                <div><strong>Cuándo:</strong> {b.cuándo}</div>
                <div><strong>Efectos:</strong> {b.efectos}</div>
                <div><strong>Mapa:</strong> {b.mapa}</div>
                <div><strong>Estrategias:</strong> {b.estrategias}</div>
                <div><strong>Limitaciones:</strong> {b.limitaciones}</div>
                <button className="btn ghost" style={{ marginTop: 6, padding: "4px 8px", fontSize: 12 }} onClick={() => setAbierto(abierto === b.id ? null : b.id)}>
                  {abierto === b.id ? "Ocultar detalles" : "Ver detalles"}
                </button>
              </div>
            </div>
            {abierto === b.id && (
              <div style={{ marginTop: 10, fontSize: 12, display: "grid", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                <div><strong>Descripción narrativa:</strong> {b.descripcion}</div>
                <div><strong>Efectos implementados:</strong> {b.efectos}</div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
