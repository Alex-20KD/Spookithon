export type GameMode = 'government' | 'virus';

/** Foto de un cantón para eventos, misiones y el asesor. */
export interface CantonSnapshot {
  id: string;
  name: string;
  population: number;
  susceptible: number;
  zombie: number;
  removed: number;
  /** Fracción de zombies sobre la población del cantón (0-1). */
  rate: number;
  quarantine: boolean;
  military: boolean;
  awareness: number;
  roadsBlocked: number;
}

export interface GameSnapshot {
  mode: GameMode;
  day: number;
  budget: number;
  cureProgress: number;
  evolutionPoints: number;
  cantons: CantonSnapshot[];
}
