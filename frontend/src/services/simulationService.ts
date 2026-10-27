import type {
  DailyPoint,
  SimulationParams,
  ScenarioResult,
  StrategyResult,
  SectorStats,
  RiskLevel,
} from "../types";
import { SECTORS } from "../data/sectors";
import { FOCI } from "../data/foci";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

export function generateDaily(params: SimulationParams): DailyPoint[] {
  const N = params.population;
  const days = params.days;
  const points: DailyPoint[] = [];
  const speed = clamp(
    params.contagionProbability * 8 * (1 + params.carrierInfectivity) *
      (1 + (10 - params.detectionDays) / 10),
    0.08,
    0.7,
  );
  const peakFraction = clamp(
    0.12 + params.contagionProbability * 1.5 + params.carrierInfectivity * 0.18 - (params.dailyDoses / 100) * params.vaccineEfficacy * 0.08,
    0.05,
    0.85,
  );
  const midpoint = clamp(11 - params.detectionDays / 2 + (100 - params.dailyDoses) / 80, 4, 22);

  let cumInfected = 3;
  for (let d = 0; d <= days; d++) {
    const progress = sigmoid(speed * (d - midpoint));
    const targetCum = Math.round(N * peakFraction * progress);
    cumInfected = Math.max(cumInfected, targetCum);
    cumInfected = Math.min(N, cumInfected);

    const recoveredInf = Math.round(cumInfected * clamp((d - 14) / 12, 0, 0.75));
    const vaccinated = Math.round(clamp(params.dailyDoses * params.vaccineEfficacy * d, 0, N * 0.9));
    const inmunes = clamp(recoveredInf + vaccinated, 0, N);
    const active = clamp(cumInfected - recoveredInf, 0, N - inmunes);

    const incubando = Math.round(active * 0.22);
    const portadores = Math.round(active * clamp(params.carrierInfectivity * 0.4, 0.1, 0.45));
    const zombis = clamp(active - incubando - portadores, 0, N);
    const sanos = clamp(N - incubando - portadores - zombis - inmunes, 0, N);

    points.push({
      day: d,
      sanos,
      incubando,
      portadores,
      zombis,
      inmunes,
      acumulados: cumInfected,
    });
  }
  return points;
}

export function threatLevelFrom(zombis: number, population: number): string {
  const ratio = zombis / population;
  if (ratio < 0.05) return "BAJO";
  if (ratio < 0.15) return "MEDIO";
  if (ratio < 0.3) return "ALTO";
  return "CRÍTICO";
}

export function generateScenario(params: SimulationParams): ScenarioResult {
  const daily = generateDaily(params);
  const last = daily[daily.length - 1];
  const zombis = last.zombis;
  const threat = threatLevelFrom(zombis, params.population);

  const peak = Math.max(...daily.map((p) => p.zombis));

  const baseSaved = Math.round(params.population * 0.05);
  const vaccBoost = params.dailyDoses * params.vaccineEfficacy * 0.8;
  const strategies: StrategyResult[] = [
    {
      id: "nada",
      name: "Sin intervención",
      saved: baseSaved,
      peak: Math.round(peak * 1.25),
      vaccinesUsed: 0,
      effectiveness: 0.15,
    },
    {
      id: "azar",
      name: "Vacunación aleatoria",
      saved: Math.round(baseSaved + vaccBoost * 0.6),
      peak: Math.round(peak * 0.95),
      vaccinesUsed: Math.round(params.dailyDoses * params.days * 0.8),
      effectiveness: 0.52,
    },
    {
      id: "centralidad",
      name: "Vacunación por centralidad",
      saved: Math.round(baseSaved + vaccBoost * 0.78),
      peak: Math.round(peak * 0.82),
      vaccinesUsed: Math.round(params.dailyDoses * params.days * 0.8),
      effectiveness: 0.71,
    },
    {
      id: "anillo",
      name: "Vacunación en anillo",
      saved: Math.round(baseSaved + vaccBoost * 0.85),
      peak: Math.round(peak * 0.75),
      vaccinesUsed: Math.round(params.dailyDoses * params.days * 0.75),
      effectiveness: 0.79,
    },
    {
      id: "combinadas",
      name: "Medidas combinadas",
      saved: Math.round(baseSaved + vaccBoost * 1.05),
      peak: Math.round(peak * 0.6),
      vaccinesUsed: Math.round(params.dailyDoses * params.days * 0.9),
      effectiveness: 0.9,
      recommended: true,
    },
  ];

  const alerts: string[] = [];
  if (threat === "CRÍTICO" || threat === "ALTO") {
    alerts.push("Nivel de amenaza elevado: activar protocolo de emergencia.");
  }
  if (last.zombis > params.population * 0.1) {
    alerts.push("Focos activos superan el 10% de la población.");
  }
  if (params.detectionDays > 5) {
    alerts.push("Retraso de detección alto: revisar vigilancia epidemiológica.");
  }
  if (alerts.length === 0) {
    alerts.push("Situación controlada bajo parámetros actuales.");
  }

  return {
    daily,
    totals: {
      sanos: last.sanos,
      incubando: last.incubando,
      portadores: last.portadores,
      zombis: last.zombis,
      inmunes: last.inmunes,
    },
    threatLevel: threat,
    alerts,
    recommendedStrategyId: "combinadas",
    strategies,
  };
}

export function riskLevelForSector(sector: { baseRisk: number }, day: number, params: SimulationParams): RiskLevel {
  const score = sector.baseRisk + (day / Math.max(1, params.days)) * 0.35 + params.contagionProbability * 0.5;
  if (score < 0.5) return "bajo";
  if (score < 0.75) return "medio";
  if (score < 0.95) return "alto";
  return "critico";
}

export function sectorStats(day: number, params: SimulationParams): SectorStats[] {
  const daily = generateDaily(params);
  const idx = clamp(day, 0, daily.length - 1);
  const cumFraction = daily[idx].acumulados / params.population;
  return SECTORS.map((sector) => {
    const riskLevel = riskLevelForSector(sector, day, params);
    const estimatedInfected = Math.round(params.population * sector.populationShare * cumFraction * (0.7 + sector.baseRisk * 0.6));
    const activeFoci = FOCI.filter((f) => f.sectorId === sector.id).filter((f) => f.intensity > 0.3).length;
    const miniSeries = Array.from({ length: 7 }, (_, i) => {
      const dd = clamp(day - 6 + i, 0, params.days);
      const pp = daily[dd];
      return { day: dd, value: Math.round(pp.zombis * sector.populationShare) };
    });
    return { sector, riskLevel, estimatedInfected, activeFoci, miniSeries };
  });
}

export function generateOutbreakComparison(params: SimulationParams, overrides: Partial<SimulationParams>): import("../types").OutbreakComparison {
  const before = generateScenario(params);
  const afterParams = { ...params, ...overrides };
  const after = generateScenario(afterParams);
  return { before, after };
}