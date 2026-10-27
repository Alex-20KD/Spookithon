import type { Sector } from "../types";

export const SECTORS: Sector[] = [
  { id: "tarqui", name: "Tarqui", lat: -0.948, lng: -80.722, baseRisk: 0.55, populationShare: 0.24 },
  { id: "esteros", name: "Los Esteros", lat: -0.972, lng: -80.708, baseRisk: 0.45, populationShare: 0.22 },
  { id: "centro", name: "Manta Centro", lat: -0.962, lng: -80.728, baseRisk: 0.6, populationShare: 0.18 },
  { id: "barbasquillo", name: "Barbasquillo", lat: -0.94, lng: -80.738, baseRisk: 0.35, populationShare: 0.16 },
  { id: "sanmateo", name: "San Mateo", lat: -0.982, lng: -80.742, baseRisk: 0.4, populationShare: 0.2 },
];

export const SECTOR_NAMES = SECTORS.map((s) => s.name);

export const PLACE_OPTIONS = [
  { value: "hospital", label: "Hospital" },
  { value: "mercado", label: "Mercado" },
  { value: "colegio", label: "Colegio" },
  { value: "bus", label: "Transporte público" },
  { value: "barrio", label: "Barrio" },
];