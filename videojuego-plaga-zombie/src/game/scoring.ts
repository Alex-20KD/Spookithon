// Estadísticas y calificación de la pantalla final
import type { GameMode } from './types';

export type Grade = 'S' | 'A' | 'B' | 'C';

export interface EndInput {
  mode: GameMode;
  victory: boolean;
  day: number;
  totalPopulation: number;
  susceptible: number;
  zombie: number;
  removed: number;
  /** Cantones con más de la mitad de su población perdida (zombies + eliminados). */
  cantonsLost: number;
  cantonsInfected: number;
  cureProgress: number;
  missionsDone: number;
}

export interface EndStats extends EndInput {
  livesSaved: number;
  score: number;
  grade: Grade;
}

export function gradeFor(score: number): Grade {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 55) return 'B';
  return 'C';
}

export function computeEndStats(input: EndInput): EndStats {
  const total = Math.max(1, input.totalPopulation);
  const healthyFraction = input.susceptible / total;
  const missionBonus = input.missionsDone * 2;
  let score: number;

  if (input.mode === 'government') {
    // Lo que más pesa es cuánta gente se salvó; ganar rápido suma un poco más
    score = healthyFraction * 70 + (input.victory ? 20 : 0) + Math.max(0, 10 - input.day / 10) + missionBonus;
  } else {
    // El virus gana puntos por infectar y por hacerlo rápido
    score =
      (input.victory ? 50 : 0) + (1 - healthyFraction) * 30 + (input.victory ? Math.max(0, 20 - input.day / 4) : 0) + missionBonus;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { ...input, livesSaved: Math.round(input.susceptible), score, grade: gradeFor(score) };
}
