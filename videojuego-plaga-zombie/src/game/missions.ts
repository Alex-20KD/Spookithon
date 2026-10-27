// Misiones cortas con recompensa. Se evalúan al final de cada día y después de cada acción.
import type { GameMode, GameSnapshot } from './types';
import { formatMoney, formatNumber } from '../utils/format';

export type MissionStatus = 'active' | 'done' | 'failed';

export interface MissionContext extends GameSnapshot {
  counters: {
    quarantines: number;
    militaryDeployments: number;
    research: number;
    mutationsUnlocked: number;
  };
  totalZombies: number;
}

export interface MissionProgress {
  id: string;
  status: MissionStatus;
  progress: number;
  target: number;
}

export interface MissionDef {
  id: string;
  mode: GameMode;
  title: string;
  description: string;
  reward: { money?: number; points?: number };
  target: number;
  /** Texto del progreso, por ejemplo "3/5 días". */
  progressLabel(progress: number, target: number): string;
  /**
   * Calcula el nuevo progreso. Solo `endOfDay` cuenta días;
   * las acciones del jugador se evalúan con endOfDay = false.
   */
  evaluate(ctx: MissionContext, prev: MissionProgress, endOfDay: boolean): { progress: number; status: MissionStatus };
}

const canton = (ctx: MissionContext, id: string) => ctx.cantons.find(c => c.id === id);

export const MISSIONS: MissionDef[] = [
  // ---------------------------------------------------------------- Gobierno
  {
    id: 'portoviejo-bajo-20',
    mode: 'government',
    title: 'Escudo de Portoviejo',
    description: 'Cuando el virus llegue a Portoviejo, mantenlo bajo 20% durante 5 días seguidos.',
    reward: { money: 150_000 },
    target: 5,
    progressLabel: (p, t) => `${p}/${t} días`,
    evaluate: (ctx, prev, endOfDay) => {
      const c = canton(ctx, 'portoviejo');
      if (!endOfDay || !c || c.zombie < 1) return { progress: prev.progress, status: 'active' };
      const progress = c.rate < 0.2 ? prev.progress + 1 : 0;
      return { progress, status: progress >= 5 ? 'done' : 'active' };
    }
  },
  {
    id: 'cura-50-dia-30',
    mode: 'government',
    title: 'Carrera por la cura',
    description: 'Llega al 50% de cura antes del día 30.',
    reward: { money: 250_000 },
    target: 50,
    progressLabel: p => `${Math.floor(p)}% · día límite 30`,
    evaluate: ctx => {
      if (ctx.cureProgress >= 50) return { progress: 50, status: 'done' };
      return { progress: ctx.cureProgress, status: ctx.day >= 30 ? 'failed' : 'active' };
    }
  },
  {
    id: 'tres-cuarentenas',
    mode: 'government',
    title: 'Cordón sanitario',
    description: 'Aplica 3 cuarentenas.',
    reward: { money: 80_000 },
    target: 3,
    progressLabel: (p, t) => `${p}/${t}`,
    evaluate: ctx => {
      const progress = Math.min(3, ctx.counters.quarantines);
      return { progress, status: progress >= 3 ? 'done' : 'active' };
    }
  },
  {
    id: 'sin-colapso-20',
    mode: 'government',
    title: 'Ningún cantón cae',
    description: 'Que ningún cantón supere el 50% de infección hasta el día 20.',
    reward: { money: 200_000 },
    target: 20,
    progressLabel: (p, t) => `día ${p}/${t}`,
    evaluate: ctx => {
      if (ctx.cantons.some(c => c.rate > 0.5)) return { progress: ctx.day, status: 'failed' };
      const progress = Math.min(20, ctx.day);
      return { progress, status: progress >= 20 ? 'done' : 'active' };
    }
  },
  {
    id: 'dos-militares',
    mode: 'government',
    title: 'Fuerza de tarea',
    description: 'Despliega militares en 2 cantones distintos.',
    reward: { money: 70_000 },
    target: 2,
    progressLabel: (p, t) => `${p}/${t}`,
    evaluate: ctx => {
      const progress = Math.min(2, ctx.cantons.filter(c => c.military).length);
      return { progress, status: progress >= 2 ? 'done' : 'active' };
    }
  },

  // ---------------------------------------------------------------- Virus
  {
    id: 'diez-cantones',
    mode: 'virus',
    title: 'Expansión rápida',
    description: 'Infecta 10 cantones antes del día 15.',
    reward: { points: 8 },
    target: 10,
    progressLabel: (p, t) => `${p}/${t} · día límite 15`,
    evaluate: ctx => {
      const progress = Math.min(10, ctx.cantons.filter(c => c.zombie >= 1).length);
      if (progress >= 10) return { progress, status: 'done' };
      return { progress, status: ctx.day >= 15 ? 'failed' : 'active' };
    }
  },
  {
    id: 'cien-mil',
    mode: 'virus',
    title: 'Horda imparable',
    description: `Llega a ${formatNumber(100_000)} zombies activos.`,
    reward: { points: 6 },
    target: 100_000,
    progressLabel: (p, t) => `${formatNumber(p)}/${formatNumber(t)}`,
    evaluate: ctx => {
      const progress = Math.min(100_000, Math.round(ctx.totalZombies));
      return { progress, status: progress >= 100_000 ? 'done' : 'active' };
    }
  },
  {
    id: 'dos-mutaciones',
    mode: 'virus',
    title: 'Evolución',
    description: 'Desbloquea 2 mutaciones.',
    reward: { points: 5 },
    target: 2,
    progressLabel: (p, t) => `${p}/${t}`,
    evaluate: ctx => {
      const progress = Math.min(2, ctx.counters.mutationsUnlocked);
      return { progress, status: progress >= 2 ? 'done' : 'active' };
    }
  },
  {
    id: 'capital-caida',
    mode: 'virus',
    title: 'Toma de la capital',
    description: 'Supera el 50% de infección en Portoviejo.',
    reward: { points: 6 },
    target: 50,
    progressLabel: p => `${Math.floor(p)}%`,
    evaluate: ctx => {
      const c = canton(ctx, 'portoviejo');
      const progress = Math.min(50, (c?.rate ?? 0) * 100);
      return { progress, status: progress >= 50 ? 'done' : 'active' };
    }
  }
];

export const MISSIONS_BY_ID = new Map(MISSIONS.map(m => [m.id, m]));

export function initialMissions(mode: GameMode): MissionProgress[] {
  return MISSIONS.filter(m => m.mode === mode).map(m => ({ id: m.id, status: 'active', progress: 0, target: m.target }));
}

export function rewardLabel(def: MissionDef): string {
  if (def.reward.money) return formatMoney(def.reward.money);
  return `${formatNumber(def.reward.points ?? 0)} pts`;
}

/** Evalúa las misiones activas; devuelve el nuevo estado y las que se acaban de completar o fallar. */
export function evaluateMissions(
  missions: MissionProgress[],
  ctx: MissionContext,
  endOfDay: boolean
): { missions: MissionProgress[]; completed: MissionDef[]; failed: MissionDef[] } {
  const completed: MissionDef[] = [];
  const failed: MissionDef[] = [];
  const next = missions.map(m => {
    const def = MISSIONS_BY_ID.get(m.id);
    if (!def || m.status !== 'active') return m;
    const r = def.evaluate(ctx, m, endOfDay);
    if (r.status === 'done') completed.push(def);
    if (r.status === 'failed') failed.push(def);
    return { ...m, progress: r.progress, status: r.status };
  });
  return { missions: next, completed, failed };
}
