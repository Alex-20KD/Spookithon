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
  estrategias: string;
  limitaciones: string;
  cuándo: string;
  mapa: string;
}

const BROTES: BroteInfo[] = [
  { id: "brote_inicial", nombre: "Brote inicial", imagen: "/images/brotes/brote_inicial.png", nivel: "Alto", color: "#FF5263", icono: <Skull size={28} />, etapa: "Día 0", descripcion: "Paciente cero y casos iniciales en un lugar de origen.", comportamiento: "Siembra inicial de infectados; define el foco de origen.", efectos: "Siembra inicial de infectados; define el foco de origen.", estrategias: "Cierres + centralidad, Anillo.", limitaciones: "No evita la propagación si no se detecta a tiempo.", cuándo: "Día 0.", mapa: "Marcador en el barrio de origen." },
  { id: "zombie_corredor", nombre: "Corredor zombi", imagen: "/images/brotes/corredor.png", nivel: "Crítico", color: "#FF5263", icono: <Zap size={28} />, etapa: "Día configurable", descripcion: "Zombi con movilidad elevada que se desplaza entre sectores.", comportamiento: "Duplica la infectividad del portador y aumenta la propagación.", efectos: "Duplica la infectividad del portador y aumenta la propagación.", estrategias: "Bloqueo de emergencia, Cierres + centralidad.", limitaciones: "Difícil de contener sin bloqueos.", cuándo: "Día configurable.", mapa: "Movimientos entre barrios." },
  { id: "acechador", nombre: "Acechador", imagen: "/images/brotes/acechador.png", nivel: "Alto", color: "#FF7A45", icono: <Eye size={28} />, etapa: "Día configurable", descripcion: "Variante sigilosa con detección tardía y mayor generación de focos secundarios.", comportamiento: "Reduce la detección de zombis a la mitad y aumenta la movilidad.", efectos: "Reduce la detección de zombis a la mitad y aumenta la movilidad.", estrategias: "Vigilancia intensiva, Cierres + centralidad.", limitaciones: "Difícil de detectar a tiempo.", cuándo: "Día configurable.", mapa: "Focos secundarios en sectores vecinos." },
  { id: "chasqueador", nombre: "Chasqueador", imagen: "/images/brotes/chasqueador.png", nivel: "Alto", color: "#FF7A45", icono: <Zap size={28} />, etapa: "Día configurable", descripcion: "Variante con riesgo elevado en encuentros cercanos y atracción a zonas de actividad.", comportamiento: "Aumenta la infectividad de los zombis a 1.5.", efectos: "Aumenta la infectividad de los zombis a 1.5.", estrategias: "Aislamiento focalizado, Cierres + centralidad.", limitaciones: "Puede concentrarse en sectores clave.", cuándo: "Día configurable.", mapa: "Concentración en sectores de actividad." },
  { id: "gordinflon", nombre: "Gordinflón", imagen: "/images/brotes/gordinflon.png", nivel: "Crítico", color: "#FF5263", icono: <Wind size={28} />, etapa: "Día configurable", descripcion: "Variante con movilidad reducida pero mayor resistencia a la contención y dispersión de esporas.", comportamiento: "Reduce la movilidad, compromete cierres y aumenta las esporas.", efectos: "Reduce la movilidad, compromete cierres y aumenta las esporas.", estrategias: "Refuerzo de contención, Control de esporas.", limitaciones: "Puede comprometer barreras.", cuándo: "Día configurable.", mapa: "Dispersión localizada de esporas." },
  { id: "horda_migratoria", nombre: "Horda migratoria", imagen: "/images/brotes/orda_migratoria.png", nivel: "Crítico", color: "#FF5263", icono: <Users size={28} />, etapa: "Día configurable", descripcion: "Concentración de zombis que se desplaza hacia un sector.", comportamiento: "Genera múltiples zombis en un barrio.", efectos: "Genera múltiples zombis en un barrio.", estrategias: "Bloqueo de emergencia, Anillo.", limitaciones: "Puede saturar la capacidad de respuesta.", cuándo: "Día configurable.", mapa: "Agrupación en el sector afectado." },
  { id: "brote_secundario", nombre: "Brote secundario", imagen: "/images/brotes/brote_secundario.png", nivel: "Alto", color: "#FF7A45", icono: <Activity size={28} />, etapa: "Día configurable", descripcion: "Aparición de nuevos casos en un barrio distinto al foco inicial.", comportamiento: "Infecta personas sanas en el barrio seleccionado.", efectos: "Infecta personas sanas en el barrio seleccionado.", estrategias: "Aislamiento focalizado, Cierres + centralidad.", limitaciones: "Requiere vigilancia para detectarlo.", cuándo: "Día configurable.", mapa: "Nuevo foco en el barrio seleccionado." },
  { id: "fallo_contencion", nombre: "Fallo de contención", imagen: "/images/brotes/fallo_contension.png", nivel: "Alto", color: "#FF7A45", icono: <ShieldAlert size={28} />, etapa: "Día configurable", descripcion: "Compromiso temporal de las barreras de contención.", comportamiento: "Reduce la eficacia de la vacuna a la mitad durante la duración.", efectos: "Reduce la eficacia de la vacuna a la mitad durante la duración.", estrategias: "Refuerzo de contención.", limitaciones: "No elimina contagios existentes.", cuándo: "Día configurable.", mapa: "Indicador de fallo en el sector." },
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
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{b.nombre}</div>
                  <Pill color="red">{b.nivel}</Pill>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{b.etapa}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>{b.descripcion}</div>
                <div style={{ fontSize: 13, color: "var(--text)", marginTop: 6 }}><strong>Comportamiento:</strong> {b.comportamiento}</div>
              </div>
              <div style={{ minWidth: 220, fontSize: 12, display: "grid", gap: 4 }}>
                <div><strong>Efectos:</strong> {b.efectos}</div>
                <div><strong>Estrategias:</strong> {b.estrategias}</div>
                <div><strong>Limitaciones:</strong> {b.limitaciones}</div>
                <button className="btn ghost" style={{ marginTop: 6, padding: "4px 8px", fontSize: 12 }} onClick={() => setAbierto(abierto === b.id ? null : b.id)}>
                  {abierto === b.id ? "Ocultar detalles" : "Ver detalles"}
                </button>
              </div>
            </div>
            {abierto === b.id && (
              <div style={{ marginTop: 10, fontSize: 12, display: "grid", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                <div><strong>Cuándo:</strong> {b.cuándo}</div>
                <div><strong>Mapa:</strong> {b.mapa}</div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
