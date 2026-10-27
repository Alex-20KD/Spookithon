export interface Brote {
  id: string;
  tipo: "brote_inicial" | "brote_secundario" | "zombie_corredor" | "horda_migratoria" | "fallo_contencion";
  dia: number;
  barrio_id: string;
  intensidad: number;
  duracion: number;
  activo: boolean;
}
