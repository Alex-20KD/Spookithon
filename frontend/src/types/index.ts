export type HealthState = "sano" | "incubando" | "portador" | "zombi" | "inmune";

export interface DailyPoint {
  day: number;
  sanos: number;
  incubando: number;
  portadores: number;
  zombis: number;
  inmunes: number;
  acumulados: number;
}

export interface SimulationParams {
  seed: number;
  population: number;
  days: number;
  initialPlace: string;
  contagionProbability: number;
  dailyDoses: number;
  vaccineEfficacy: number;
  detectionDays: number;
  carrierInfectivity: number;
  secondaryFocus?: string;
}

export interface StrategyResult {
  id: string;
  name: string;
  saved: number;
  peak: number;
  vaccinesUsed: number;
  effectiveness: number;
  recommended?: boolean;
}

export interface Sector {
  id: string;
  name: string;
  lat: number;
  lng: number;
  baseRisk: number;
  populationShare: number;
}

export type RiskLevel = "bajo" | "medio" | "alto" | "critico";

export interface Focus {
  id: string;
  sectorId: string;
  lat: number;
  lng: number;
  intensity: number;
}

export interface SectorStats {
  sector: Sector;
  riskLevel: RiskLevel;
  estimatedInfected: number;
  activeFoci: number;
  miniSeries: { day: number; value: number }[];
}

export interface ScenarioResult {
  daily: DailyPoint[];
  totals: {
    sanos: number;
    incubando: number;
    portadores: number;
    zombis: number;
    inmunes: number;
  };
  threatLevel: string;
  alerts: string[];
  recommendedStrategyId: string;
  strategies: StrategyResult[];
}

export interface OutbreakComparison {
  before: ScenarioResult;
  after: ScenarioResult;
}