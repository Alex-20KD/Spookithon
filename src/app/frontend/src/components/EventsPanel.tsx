import type { CompararResponse } from "../types/api";
import Card from "./ui/Card";
import Pill from "./ui/Pill";

interface Evento {
  dia: number | string;
  categoria: "escenario" | "calculado" | "ilustrativo";
  titulo: string;
  detalle: string;
}

const COLOR_CAT: Record<Evento["categoria"], string> = {
  escenario: "blue",
  calculado: "green",
  ilustrativo: "orange",
};

const ETIQUETA_CAT: Record<Evento["categoria"], string> = {
  escenario: "EVENTO DEL ESCENARIO",
  calculado: "EVENTO CALCULADO",
  ilustrativo: "EVENTO ILUSTRATIVO",
};

function construirEventos(resultado: CompararResponse): Evento[] {
  const ev: Evento[] = [];

  // --- Eventos del escenario base (fijos, no afirmaciones de cierre real) ---
  ev.push({ dia: 0, categoria: "escenario", titulo: "Paciente cero infectado", detalle: "Inicio del brote simulado." });
  ev.push({ dia: "1–3", categoria: "escenario", titulo: "Contagios iniciales", detalle: "Propagación inicial en el foco de origen." });
  ev.push({ dia: 4, categoria: "escenario", titulo: "Activación del protocolo epidemiológico", detalle: "Se activa la vigilancia y la respuesta." });
  ev.push({ dia: "4–9", categoria: "escenario", titulo: "Investigación y desarrollo de vacuna", detalle: "Periodo de desarrollo del biológico." });
  ev.push({ dia: 10, categoria: "escenario", titulo: "Disponibilidad inicial de vacunas", detalle: "Comienza la aplicación de dosis." });

  // --- Eventos calculados a partir de datos reales ---
  const mejor = resultado.estrategias.find((e) => e.nombre === resultado.mejor_estrategia);
  if (mejor) {
    const curva = mejor.curva_diaria;
    let picoDia = 0;
    let picoVal = -1;
    curva.media.forEach((v, i) => {
      if (v > picoVal) {
        picoVal = v;
        picoDia = curva.dias[i];
      }
    });
    ev.push({
      dia: picoDia,
      categoria: "calculado",
      titulo: "Pico de contagios (mejor estrategia)",
      detalle: `Zombis promedio en el pico: ${Math.round(picoVal).toLocaleString("es-EC")}.`,
    });

    const nada = resultado.estrategias.find((e) => e.nombre === "Nada");
    if (nada) {
      const evitados = Math.max(0, nada.infectados_media - mejor.infectados_media);
      ev.push({
        dia: "Final",
        categoria: "calculado",
        titulo: "Reducción frente a no intervenir",
        detalle: `${Math.round(evitados).toLocaleString("es-EC")} infectados evitados en promedio.`,
      });
    }

    // Sector de mayor riesgo (mapa real de la mejor estrategia).
    const barrios = resultado.mapa?.barrios ?? [];
    const conDatos = barrios.filter((b) => b.infectados_media != null);
    if (conDatos.length > 0) {
      const peor = conDatos.reduce((a, b) =>
        (b.infectados_media as number) > (a.infectados_media as number) ? b : a,
      );
      ev.push({
        dia: "Final",
        categoria: "calculado",
        titulo: "Sector de mayor riesgo",
        detalle: `${peor.nombre}: ${Math.round(peor.infectados_media as number).toLocaleString("es-EC")} infectados medios.`,
      });
    }

    ev.push({
      dia: "Final",
      categoria: "calculado",
      titulo: "Estrategia recomendada",
      detalle: `${resultado.mejor_estrategia} (${nombreAmigable(resultado.mejor_estrategia)}) — ${resultado.recomendacion}`,
    });

    const dosis = (resultado.parametros_efectivos?.dosis_dia as number) ?? null;
    if (dosis != null) {
      ev.push({
        dia: "—",
        categoria: "calculado",
        titulo: "Recursos utilizados",
        detalle: `Capacidad de ${dosis} dosis/día según los parámetros efectivos.`,
      });
    }
  }

  // --- Evento ilustrativo (no es resultado real geográfico por día) ---
  ev.push({
    dia: "—",
    categoria: "ilustrativo",
    titulo: "Animación de propagación por barrio",
    detalle:
      "La API no devuelve estados individuales ni series geográficas por día; la propagación espacial mostrada es una demostración ilustrativa, no un resultado real.",
  });

  return ev;
}

function nombreAmigable(nombre: string): string {
  const mapa: Record<string, string> = {
    Nada: "Sin intervención",
    Azar: "Vacunación al azar",
    Centralidad: "Por centralidad",
    CierresMasCentralidad: "Cierres + centralidad",
    Anillo: "Anillo",
  };
  return mapa[nombre] ?? nombre;
}

interface Props {
  resultado: CompararResponse | null;
}

export default function EventsPanel({ resultado }: Props) {
  if (!resultado) {
    return (
      <Card title="Eventos epidemiológicos">
        <div className="empty">Ejecuta una simulación para ver la línea temporal de eventos.</div>
      </Card>
    );
  }

  const eventos = construirEventos(resultado);

  return (
    <Card title="Eventos epidemiológicos">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {eventos.map((e, i) => (
          <div key={i} className="alert-item" style={{ background: "rgba(255,255,255,0.03)", borderColor: "var(--border)" }}>
            <div style={{ minWidth: 46, fontWeight: 700, color: "var(--muted)", fontSize: 12 }}>
              Día {e.dia}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{e.titulo}</strong>
                <Pill color={COLOR_CAT[e.categoria] as "green" | "blue" | "orange"}>{ETIQUETA_CAT[e.categoria]}</Pill>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{e.detalle}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}