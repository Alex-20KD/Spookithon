export interface PuntoGlobal {
  dia: number;
  SANO: number;
  INCUBANDO: number;
  PORTADOR: number;
  ZOMBI: number;
  INMUNE: number;
  nuevos_contagios: number;
  dosis_dia: number;
  lugares_cerrados: number;
  eventos: { dia: number; tipo: string; titulo: string; cantidad?: number; dosis?: number; lugares?: number }[];
}

export interface PuntoBarrio {
  dia: number;
  zombis_activos: number;
  infectados_acumulados: number;
  nuevos_contagios: number;
  inmunes: number;
}

export interface SerieBarrio {
  id: string;
  nombre: string;
  lat: number | null;
  lng: number | null;
  puntos: PuntoBarrio[];
}

import type { LugarInicio } from "./api";

export interface TrayectoriaRequest {
  beta?: number;
  dosis_dia?: number;
  eficacia_vacuna?: number;
  lugar_inicio?: LugarInicio;
  dias_detectar?: number;
  infect_portador?: number;
  dias?: number;
  semilla?: number;
  estrategia: string;
}

export interface TrayectoriaResponse {
  aviso: string;
  estrategia: string;
  semilla: number;
  dias: number;
  parametros_efectivos: Record<string, unknown>;
  serie_global: PuntoGlobal[];
  serie_por_barrio: SerieBarrio[];
  eventos: { dia: number; tipo: string; titulo: string; cantidad?: number; dosis?: number; lugares?: number }[];
  infectados_totales: number;
}
