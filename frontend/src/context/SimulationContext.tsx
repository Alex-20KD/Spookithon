import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { SimulationParams, ScenarioResult, OutbreakComparison } from "../types";
import { generateScenario } from "../services/simulationService";

const DEFAULT_PARAMS: SimulationParams = {
  seed: 42,
  population: 3000,
  days: 30,
  initialPlace: "hospital",
  contagionProbability: 0.1,
  dailyDoses: 100,
  vaccineEfficacy: 0.9,
  detectionDays: 4,
  carrierInfectivity: 0.3,
  secondaryFocus: "mercado",
};

interface SimulationContextValue {
  params: SimulationParams;
  setParams: (p: SimulationParams | ((prev: SimulationParams) => SimulationParams)) => void;
  updateParam: <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => void;
  day: number;
  setDay: (d: number) => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  scenario: ScenarioResult;
  runSimulation: () => void;
  selectedSectorId: string | null;
  setSelectedSectorId: (id: string | null) => void;
  selectedStrategyId: string;
  setSelectedStrategyId: (id: string) => void;
  compareIds: string[];
  setCompareIds: (ids: string[]) => void;
  outbreakOverrides: Partial<SimulationParams>;
  setOutbreakOverrides: (o: Partial<SimulationParams> | ((prev: Partial<SimulationParams>) => Partial<SimulationParams>)) => void;
  outbreakResult: OutbreakComparison | null;
  runOutbreak: () => void;
}

const SimulationContext = createContext<SimulationContextValue | undefined>(undefined);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [params, setParamsState] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [day, setDayState] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scenario, setScenario] = useState<ScenarioResult>(() => generateScenario(DEFAULT_PARAMS));
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>("centro");
  const [selectedStrategyId, setSelectedStrategyId] = useState("combinadas");
  const [compareIds, setCompareIds] = useState<string[]>(["nada", "combinadas"]);
  const [outbreakOverrides, setOutbreakOverrides] = useState<Partial<SimulationParams>>({
    contagionProbability: 0.18,
    dailyDoses: 80,
    vaccineEfficacy: 0.85,
    detectionDays: 6,
    initialPlace: "mercado",
    secondaryFocus: "tarqui",
  });
  const [outbreakResult, setOutbreakResult] = useState<OutbreakComparison | null>(null);

  const setParams = (p: SimulationParams | ((prev: SimulationParams) => SimulationParams)) => {
    setParamsState((prev) => (typeof p === "function" ? (p as (prev: SimulationParams) => SimulationParams)(prev) : p));
  };

  const updateParam = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    setParamsState((prev) => ({ ...prev, [key]: value }));
  };

  const setDay = (d: number) => {
    const max = params.days;
    setDayState(clampDay(d, max));
  };

  const runSimulation = () => {
    setScenario(generateScenario(params));
  };

  const runOutbreak = () => {
    const before = generateScenario(params);
    const after = generateScenario({ ...params, ...outbreakOverrides });
    setOutbreakResult({ before, after });
  };

  // Regenerate scenario when params change (demo responsiveness)
  useEffect(() => {
    setScenario(generateScenario(params));
    setDayState((d) => (d > params.days ? params.days : d));
  }, [params]);

  // Playback
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setDayState((d) => {
        if (d >= params.days) {
          setIsPlaying(false);
          return d;
        }
        return d + 1;
      });
    }, 700);
    return () => clearInterval(id);
  }, [isPlaying, params.days]);

  const value = useMemo(
    () => ({
      params,
      setParams,
      updateParam,
      day,
      setDay,
      isPlaying,
      setIsPlaying,
      scenario,
      runSimulation,
      selectedSectorId,
      setSelectedSectorId,
      selectedStrategyId,
      setSelectedStrategyId,
      compareIds,
      setCompareIds,
      outbreakOverrides,
      setOutbreakOverrides,
      outbreakResult,
      runOutbreak,
    }),
    [params, day, isPlaying, scenario, selectedSectorId, selectedStrategyId, compareIds, outbreakOverrides, outbreakResult],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

function clampDay(d: number, max: number) {
  if (Number.isNaN(d)) return 0;
  return Math.max(0, Math.min(max, Math.round(d)));
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error("useSimulation must be used within SimulationProvider");
  return ctx;
}