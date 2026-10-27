// Niveles de dificultad para los modos de simulación y de combate

export type Difficulty = 'facil' | 'normal' | 'pesadilla';

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  icon: string;
  description: string;
  // Simulación
  budget: number;
  budgetPerDay: number;
  beta: number;
  outbreak: number;
  /** Fracción de población sana bajo la cual el gobierno pierde. */
  defeatHealthyFraction: number;
  /** % diario base con el que el gobierno investiga la cura en Modo Virus. */
  virusCureRate: number;
  evolutionMultiplier: number;
  eventEvery: [number, number];
  firstBossDay: number;
  /** Multiplica el costo de las acciones de gobierno. */
  costMultiplier: number;
  quarantineEffectiveness: number;
  /** En Modo Virus, cada cuántos días el gobierno (IA) toma una medida. */
  aiEvery: number;
  // Combate
  combatSpeed: number;
  combatDamage: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  facil: {
    id: 'facil',
    label: 'Fácil',
    icon: '🌱',
    description: 'Más presupuesto, un virus más lento y zombies menos agresivos.',
    budget: 1_500_000,
    budgetPerDay: 70_000,
    beta: 0.5,
    outbreak: 60,
    defeatHealthyFraction: 0.15,
    virusCureRate: 1.0,
    evolutionMultiplier: 1.5,
    eventEvery: [9, 12],
    firstBossDay: 22,
    costMultiplier: 0.8,
    quarantineEffectiveness: 0.75,
    aiEvery: 6,
    combatSpeed: 0.8,
    combatDamage: 0.7
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    icon: '⚖️',
    description: 'La experiencia pensada para el juego.',
    budget: 1_000_000,
    budgetPerDay: 50_000,
    beta: 0.6,
    outbreak: 100,
    defeatHealthyFraction: 0.25,
    virusCureRate: 1.4,
    evolutionMultiplier: 1,
    eventEvery: [7, 10],
    firstBossDay: 16,
    costMultiplier: 1,
    quarantineEffectiveness: 0.7,
    aiEvery: 4,
    combatSpeed: 1,
    combatDamage: 1
  },
  pesadilla: {
    id: 'pesadilla',
    label: 'Pesadilla',
    icon: '💀',
    description: 'Poco dinero, un virus feroz y eventos constantes.',
    budget: 700_000,
    budgetPerDay: 35_000,
    beta: 0.75,
    outbreak: 200,
    defeatHealthyFraction: 0.35,
    virusCureRate: 1.9,
    evolutionMultiplier: 0.8,
    eventEvery: [5, 8],
    firstBossDay: 12,
    costMultiplier: 1.5,
    quarantineEffectiveness: 0.55,
    aiEvery: 3,
    combatSpeed: 1.2,
    combatDamage: 1.4
  }
};

export const DIFFICULTY_LIST: DifficultyConfig[] = Object.values(DIFFICULTIES);
