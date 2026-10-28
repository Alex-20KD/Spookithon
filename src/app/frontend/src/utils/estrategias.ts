/** Nombres amigables y descripciones de las estrategias del backend. */

export const NOMBRES_AMIGABLES: Record<string, string> = {
  Nada: "Sin intervención",
  Azar: "Vacunación al azar",
  Centralidad: "Por centralidad (nodos clave)",
  CierresMasCentralidad: "Cierres + centralidad",
  Anillo: "Anillo (barrera perimetral)",
  BloqueoEmergencia: "Bloqueo de emergencia",
  VigilanciaIntensiva: "Vigilancia intensiva",
  EvacuacionPreventiva: "Evacuación preventiva",
  AislamientoFocalizado: "Aislamiento focalizado",
  RefuerzoContencion: "Refuerzo de contención",
  ControlEsporas: "Control de esporas",
};

export function nombreAmigable(nombre: string): string {
  return NOMBRES_AMIGABLES[nombre] ?? nombre;
}

export const DESCRIPCIONES_ESTRATEGIA: Record<string, string> = {
  Nada: "Línea base: no se interviene. Sirve de referencia para medir el beneficio.",
  Azar: "Línea base: vacunación aleatoria con la misma capacidad diaria.",
  Centralidad: "Vacuna primero las personas con mayor centralidad en la red de contactos.",
  CierresMasCentralidad: "Combina cierre de espacios clave con vacunación por centralidad.",
  Anillo: "Crea una barrera perimetral alrededor del foco inicial del brote.",
};

export function esLineaBase(nombre: string): boolean {
  return nombre === "Nada" || nombre === "Azar";
}