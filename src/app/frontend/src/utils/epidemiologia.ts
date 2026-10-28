import type { TrayectoriaResponse } from "../types/trayectoria";

/** Variables epidemiológicas que puede mostrar el mapa (todas vienen de /trayectoria). */
export type VariableEpi = "nuevos" | "acumulados" | "zombis";

export const VARIABLES: { value: VariableEpi; label: string; descripcion: string }[] = [
  { value: "nuevos", label: "Nuevos contagios", descripcion: "Contagios registrados en el día seleccionado." },
  { value: "acumulados", label: "Infectados acumulados", descripcion: "Personas infectadas desde el día 0 hasta el día seleccionado." },
  { value: "zombis", label: "Zombis activos", descripcion: "Personas en estado ZOMBI el día seleccionado." },
];

export type NivelRiesgo = "sin" | "bajo" | "medio" | "alto" | "critico";

/**
 * Riesgo = zombis activos por cada 1.000 habitantes del sector (métrica explícita).
 * Umbrales de presentación, no estándares epidemiológicos oficiales.
 * Un sector sin infectados acumulados es "sin" (sin halo).
 */
export const UMBRALES_RIESGO_POR_MIL = { medio: 25, alto: 50, critico: 100 } as const;

/** Colores y etiquetas usados por el mapa y por la leyenda (una sola fuente). */
export const RIESGO: Record<NivelRiesgo, { color: string; etiqueta: string }> = {
  sin: { color: "#263746", etiqueta: "Sin infección" },
  bajo: { color: "#38E89A", etiqueta: "Bajo" },
  medio: { color: "#F2C94C", etiqueta: "Medio" },
  alto: { color: "#FF7A45", etiqueta: "Alto" },
  critico: { color: "#FF4D5A", etiqueta: "Crítico" },
};

export function tasaPorMil(zombis: number, poblacion: number): number {
  return poblacion > 0 ? (zombis / poblacion) * 1000 : 0;
}

export function nivelRiesgo(acumulados: number, zombis: number, poblacion: number): NivelRiesgo {
  if (acumulados <= 0) return "sin";
  const tasa = tasaPorMil(zombis, poblacion);
  if (tasa >= UMBRALES_RIESGO_POR_MIL.critico) return "critico";
  if (tasa >= UMBRALES_RIESGO_POR_MIL.alto) return "alto";
  if (tasa >= UMBRALES_RIESGO_POR_MIL.medio) return "medio";
  return "bajo";
}

export function clampDia(dia: number, maxDia: number): number {
  if (!Number.isFinite(dia)) return 0;
  return Math.max(0, Math.min(maxDia, Math.round(dia)));
}

export interface SectorDia {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  poblacion: number;
  zombis: number;
  acumulados: number;
  nuevos: number;
  tasa: number;
  riesgo: NivelRiesgo;
  primerDia: number | null;
  /** Valor de la variable seleccionada en el día seleccionado. */
  valor: number;
  /** Indica que el sector tuvo contagios nuevos ese día. */
  nuevo: boolean;
}

function valorDe(variable: VariableEpi, nuevos: number, acumulados: number, zombis: number): number {
  if (variable === "nuevos") return nuevos;
  if (variable === "acumulados") return acumulados;
  return zombis;
}

/** Estado de todos los sectores en un día, leído de la trayectoria. */
export function sectoresDelDia(t: TrayectoriaResponse, dia: number, variable: VariableEpi): SectorDia[] {
  const d = clampDia(dia, t.dias);
  return t.serie_por_barrio.map((b) => {
    const p = b.puntos[d];
    const zombis = p?.zombis_activos ?? 0;
    const acumulados = p?.infectados_acumulados ?? 0;
    const nuevos = p?.nuevos_contagios ?? 0;
    const poblacion = b.poblacion ?? 0;
    return {
      id: b.id,
      nombre: b.nombre,
      lat: b.lat as number,
      lng: b.lng as number,
      poblacion,
      zombis,
      acumulados,
      nuevos,
      tasa: tasaPorMil(zombis, poblacion),
      riesgo: nivelRiesgo(acumulados, zombis, poblacion),
      primerDia: b.primer_dia_infeccion,
      valor: valorDe(variable, nuevos, acumulados, zombis),
      nuevo: nuevos > 0,
    };
  });
}

/** Máximo de la variable en toda la trayectoria: escala fija para comparar días. */
export function escalaVariable(t: TrayectoriaResponse, variable: VariableEpi): number {
  let max = 1;
  for (let d = 0; d <= t.dias; d++) {
    for (const s of sectoresDelDia(t, d, variable)) max = Math.max(max, s.valor);
  }
  return max;
}

export interface TotalesDia {
  zombis: number;
  acumulados: number;
  nuevos: number;
  zonasInfectadas: number;
  zonasConZombis: number;
}

export function totalesDelDia(sectores: SectorDia[]): TotalesDia {
  return sectores.reduce<TotalesDia>(
    (acc, s) => ({
      zombis: acc.zombis + s.zombis,
      acumulados: acc.acumulados + s.acumulados,
      nuevos: acc.nuevos + s.nuevos,
      zonasInfectadas: acc.zonasInfectadas + (s.acumulados > 0 ? 1 : 0),
      zonasConZombis: acc.zonasConZombis + (s.zombis > 0 ? 1 : 0),
    }),
    { zombis: 0, acumulados: 0, nuevos: 0, zonasInfectadas: 0, zonasConZombis: 0 },
  );
}
