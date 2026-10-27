/**
 * Tipos que reflejan EXACTAMENTE la forma de los datos del backend FastAPI
 * (ver src/app/backend/esquemas.py). No inventar campos: si el backend cambia,
 * estos tipos deben cambiar con él.
 */

/** Lugares de inicio válidos (coinciden con LugarInicio del backend). */
export type LugarInicio = "hospital" | "mercado" | "colegio" | "bus";

/** Cuerpo de POST /comparar. Todos opcionales salvo n_corridas. */
export interface CompararRequest {
  beta?: number;
  dosis_dia?: number;
  eficacia_vacuna?: number;
  lugar_inicio?: LugarInicio;
  dias_detectar?: number;
  infect_portador?: number;
  dias?: number;
  semilla?: number;
  n_corridas: number;
  eventos?: { tipo: string; dia: number; barrio_id?: string; intensidad?: number; duracion?: number; nombre?: string }[] | null;
}

/** Curva diaria de zombis para graficar (día 0..dias) con banda p10-p90. */
export interface CurvaDiaria {
  dias: number[];
  media: number[];
  p10: number[];
  p90: number[];
}

/** Resumen de una estrategia sobre las corridas. */
export interface ResultadoEstrategia {
  nombre: string;
  infectados_media: number;
  infectados_p10: number;
  infectados_p90: number;
  salvados_media: number;
  salvados_p10: number;
  salvados_p90: number;
  pct_mejor_que_azar: number;
  pct_mejor_que_nada: number;
  /** Infectados medios por barrio (orden de `mapa.barrios`). */
  infectados_por_barrio: number[] | null;
  curva_diaria: CurvaDiaria;
}

/** Un barrio del mapa: geografía + infectados medios de la mejor estrategia. */
export interface BarrioMapa {
  id: string;
  nombre: string;
  lat: number | null;
  lng: number | null;
  infectados_media: number | null;
}

/** Bloque de mapa de POST /comparar. */
export interface Mapa {
  aviso: string;
  estrategia: string;
  barrios: BarrioMapa[];
}

/** Respuesta completa de POST /comparar. */
export interface CompararResponse {
  aviso: string;
  estrategias: ResultadoEstrategia[];
  mejor_estrategia: string;
  recomendacion: string;
  parametros_efectivos: Record<string, unknown>;
  semilla: number;
  n_corridas: number;
  mapa: Mapa;
}

/** Descripción de un parámetro editable (GET /parametros). */
export interface RangoParametro {
  por_defecto: unknown;
  minimo?: number | null;
  maximo?: number | null;
  opciones?: string[] | null;
  descripcion: string;
}

/** Respuesta de GET /parametros. */
export interface ParametrosResponse {
  aviso: string;
  parametros: Record<string, RangoParametro>;
  topes: {
    n_corridas_max: number;
    dias_max: number;
  };
}

/** Barrio del catálogo (GET /catalogo). */
export interface BarrioCatalogo {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
}

/** Edificio del catálogo (GET /catalogo). */
export interface EdificioCatalogo {
  id: string;
  nombre: string;
  tipo: string;
  barrio_id: string;
  lat: number;
  lng: number;
}

/** Respuesta de GET /catalogo: geografía ficticia (barrios y edificios). */
export interface CatalogoResponse {
  aviso: string;
  barrios: BarrioCatalogo[];
  edificios: EdificioCatalogo[];
}
