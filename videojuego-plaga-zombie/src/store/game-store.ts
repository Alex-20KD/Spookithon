import { create } from 'zustand';
import { SZRModel, CantonState, SimulationParams } from '../simulation/szr-model';
import { MANABI_CANTONS, CANTONS_MAP } from '../data/manabi-data';
import { formatMoney, formatNumber } from '../utils/format';
import { DIFFICULTIES, Difficulty } from '../game/difficulty';
import { EVENTS_BY_ID, EventApi, EventParams, pickEvent } from '../game/events';
import { MISSIONS_BY_ID, MissionContext, MissionProgress, evaluateMissions, initialMissions } from '../game/missions';
import { computeEndStats, EndStats } from '../game/scoring';
import type { CantonSnapshot, GameMode, GameSnapshot } from '../game/types';
import type { AdvisorState } from '../game/advisor';
import type { BarkTrigger } from '../game/barks';
import { playSound } from '../game/sound';
import { useCharacterStore } from './character-store';

export type { GameMode };
export type SimulationSpeed = 'paused' | 'normal' | 'fast' | 'ultra';

/** Brote inicial en dificultad Normal (cada dificultad define el suyo). */
export const INITIAL_OUTBREAK = DIFFICULTIES.normal.outbreak;

/** Parámetros base del virus en dificultad Normal. Las mutaciones y eventos los multiplican. */
export const BASE_PARAMS: SimulationParams = {
  beta: DIFFICULTIES.normal.beta, // tasa de contagio diaria por contacto sano-zombie
  gamma: 0.1, // 10% de zombies eliminados por día
  mu: 0.05, // movilidad base entre cantones vecinos
  quarantineEffectiveness: 0.7,
  militaryEffectiveness: 0.8,
  roadBlockEffectiveness: 0.9
};

export type ActionId = 'quarantine' | 'military' | 'roadBlock' | 'campaign' | 'research';

export const ACTION_COSTS: Record<ActionId, number> = {
  quarantine: 50_000,
  military: 100_000,
  roadBlock: 30_000,
  campaign: 20_000,
  research: 50_000
};

/** Texto de los tooltips: qué hace cada acción. */
export const ACTION_INFO: Record<ActionId, { icon: string; name: string; effect: string }> = {
  quarantine: { icon: '🔒', name: 'Cuarentena', effect: 'Reduce el contagio del cantón un 70% y frena la llegada de zombies desde sus vecinos.' },
  military: { icon: '⚔️', name: 'Desplegar militares', effect: 'Los zombies del cantón se eliminan un 64% más rápido.' },
  roadBlock: { icon: '🚧', name: 'Cerrar vías', effect: 'Corta todas las carreteras del cantón: ningún zombie entra ni sale por ellas.' },
  campaign: { icon: '📢', name: 'Campaña', effect: 'La población toma precauciones: −15% de contagio en el cantón (acumulable hasta −45%).' },
  research: { icon: '🔬', name: 'Investigar cura', effect: '+0,5% de cura al instante y +0,2% de cura por día de forma permanente (máx. 3% por día).' }
};

/** Costo de una acción según la dificultad. */
export function actionCost(action: ActionId, difficulty: Difficulty): number {
  return Math.round((ACTION_COSTS[action] * DIFFICULTIES[difficulty].costMultiplier) / 1000) * 1000;
}

export const RESEARCH_RATE_STEP = 0.2;
export const RESEARCH_IMMEDIATE = 0.5;
export const MAX_RESEARCH_RATE = 3;
const FIRST_EVENT_DAY = 8;
const BOSS_INTERVAL = 15;
export const BOSSES = ['La Reina del Luto', 'La Matriarca Viral', 'La Abominación'];

export interface NewsItem {
  id: string;
  day: number;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'danger';
}

export interface VirusMutation {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: {
    betaMultiplier?: number;
    gammaMultiplier?: number;
    muMultiplier?: number;
    quarantineMultiplier?: number;
    cureSlowdown?: number;
  };
  unlocked: boolean;
}

export interface Modifier {
  id: number;
  param: keyof SimulationParams;
  factor: number;
  untilDay: number;
  label: string;
}

export interface ActiveEvent {
  id: string;
  params: EventParams;
  day: number;
}

export interface GameOverInfo {
  victory: boolean;
  reason: string;
  stats: EndStats;
}

export interface Counters {
  quarantines: number;
  militaryDeployments: number;
  roadBlocks: number;
  campaigns: number;
  research: number;
  mutationsUnlocked: number;
  eventsResolved: number;
}

interface HistoryPoint {
  day: number;
  susceptible: number;
  zombie: number;
  removed: number;
}

export interface GameState {
  mode: GameMode;
  difficulty: Difficulty;
  currentDay: number;
  simulationSpeed: SimulationSpeed;
  model: SZRModel | null;

  budget: number;
  budgetPerDay: number;
  cureProgress: number;
  researchRate: number;

  evolutionPoints: number;
  mutations: VirusMutation[];

  /** Parámetros permanentes (dificultad + mutaciones); los modificadores temporales se aplican encima. */
  virusParams: SimulationParams;
  modifiers: Modifier[];

  history: HistoryPoint[];
  news: NewsItem[];
  selectedCantonId: string | null;

  activeEvent: ActiveEvent | null;
  nextEventDay: number;
  usedEventIds: string[];

  missions: MissionProgress[];
  counters: Counters;

  infectedCantons: string[];
  criticalCantons: string[];
  cureMilestones: number[];
  budgetLowWarned: boolean;
  nextBossDay: number;
  bossesSpawned: number;

  gameOver: GameOverInfo | null;
  tutorialActive: boolean;

  initializeGame: (mode: GameMode, patientZeroCantonId: string, difficulty?: Difficulty) => void;
  simulateDay: () => void;
  setSimulationSpeed: (speed: SimulationSpeed) => void;
  selectCanton: (cantonId: string | null) => void;
  setTutorialActive: (active: boolean) => void;
  resolveEvent: (optionIndex: 0 | 1) => void;

  applyQuarantine: (cantonId: string) => boolean;
  deployMilitary: (cantonId: string) => boolean;
  blockRoads: (cantonId: string) => boolean;
  launchCampaign: (cantonId: string) => boolean;
  investInResearch: () => boolean;

  unlockMutation: (mutationId: string) => boolean;
}

const INITIAL_MUTATIONS: VirusMutation[] = [
  {
    id: 'fast-infection',
    name: 'Infección Rápida',
    description: 'Aumenta la velocidad de transmisión del virus (+50% de contagio).',
    cost: 10,
    effect: { betaMultiplier: 1.5 },
    unlocked: false
  },
  {
    id: 'resilient',
    name: 'Resistencia',
    description: 'Los zombies son más difíciles de eliminar (−30% de eliminación).',
    cost: 15,
    effect: { gammaMultiplier: 0.7 },
    unlocked: false
  },
  {
    id: 'wanderer',
    name: 'Vagabundo',
    description: 'Los zombies migran más rápido entre cantones (+80% de movilidad).',
    cost: 12,
    effect: { muMultiplier: 1.8 },
    unlocked: false
  },
  {
    id: 'stealthy',
    name: 'Sigiloso',
    description: 'Más difícil de detectar: cuarentenas menos efectivas y la cura avanza 30% más lento.',
    cost: 20,
    effect: { betaMultiplier: 1.1, quarantineMultiplier: 0.75, cureSlowdown: 0.7 },
    unlocked: false
  }
];

const EMPTY_COUNTERS: Counters = {
  quarantines: 0,
  militaryDeployments: 0,
  roadBlocks: 0,
  campaigns: 0,
  research: 0,
  mutationsUnlocked: 0,
  eventsResolved: 0
};

/** Conexiones simétricas a partir de los "vecinos" del GeoJSON. */
export function buildConnections(): Map<string, string[]> {
  const map = new Map<string, Set<string>>(MANABI_CANTONS.map(c => [c.id, new Set<string>()]));
  for (const canton of MANABI_CANTONS) {
    for (const other of canton.connections) {
      if (!map.has(other)) continue;
      map.get(canton.id)!.add(other);
      map.get(other)!.add(canton.id);
    }
  }
  return new Map([...map].map(([id, set]) => [id, [...set]]));
}

const CONNECTIONS = buildConnections();

// ----------------------------------------------------------------------------
// Ayudantes
// ----------------------------------------------------------------------------

function pickTotals(model: SZRModel) {
  const { susceptible, zombie, removed } = model.getGlobalStats();
  return { susceptible, zombie, removed };
}

function effectiveParams(base: SimulationParams, modifiers: Modifier[]): SimulationParams {
  const p = { ...base };
  for (const m of modifiers) p[m.param] *= m.factor;
  p.quarantineEffectiveness = Math.min(0.95, p.quarantineEffectiveness);
  return p;
}

function cantonSnapshots(model: SZRModel): CantonSnapshot[] {
  return MANABI_CANTONS.map(c => {
    const st = model.getState(c.id) as CantonState;
    const total = st.susceptible + st.zombie + st.removed;
    return {
      id: c.id,
      name: c.name,
      population: total,
      susceptible: st.susceptible,
      zombie: st.zombie,
      removed: st.removed,
      rate: total > 0 ? st.zombie / total : 0,
      quarantine: st.quarantine,
      military: st.militaryPresence > 0,
      awareness: st.awareness ?? 0,
      roadsBlocked: st.roadsBlocked.length
    };
  });
}

export function snapshotOf(s: GameState): GameSnapshot {
  return {
    mode: s.mode,
    day: s.currentDay,
    budget: s.budget,
    cureProgress: s.cureProgress,
    evolutionPoints: s.evolutionPoints,
    cantons: s.model ? cantonSnapshots(s.model) : []
  };
}

function missionContext(s: GameState): MissionContext {
  return {
    ...snapshotOf(s),
    counters: {
      quarantines: s.counters.quarantines,
      militaryDeployments: s.counters.militaryDeployments,
      research: s.counters.research,
      mutationsUnlocked: s.counters.mutationsUnlocked
    },
    totalZombies: s.model ? s.model.getGlobalStats().zombie : 0
  };
}

/** Resumen del estado para el asesor (IA o reglas). */
export function buildAdvisorState(s: GameState): AdvisorState {
  const cantons = s.model ? cantonSnapshots(s.model) : [];
  const stats = s.model?.getGlobalStats();
  const names = (pred: (c: CantonSnapshot) => boolean) => cantons.filter(pred).map(c => c.name);
  return {
    mode: s.mode,
    difficulty: DIFFICULTIES[s.difficulty].label,
    day: s.currentDay,
    budget: Math.round(s.budget),
    budgetPerDay: s.budgetPerDay,
    cureProgress: Math.round(s.cureProgress * 10) / 10,
    researchRate: Math.round(s.researchRate * 100) / 100,
    evolutionPoints: s.evolutionPoints,
    totals: {
      healthy: Math.round(stats?.susceptible ?? 0),
      zombies: Math.round(stats?.zombie ?? 0),
      removed: Math.round(stats?.removed ?? 0),
      infectionRate: stats?.infectionRate ?? 0
    },
    infectedCantons: cantons.filter(c => c.zombie >= 1).length,
    topCantons: [...cantons]
      .filter(c => c.zombie >= 1)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5)
      .map(c => ({ name: c.name, infectionRate: c.rate, zombies: Math.round(c.zombie), quarantine: c.quarantine, military: c.military })),
    activeActions: {
      quarantines: names(c => c.quarantine),
      military: names(c => c.military),
      campaigns: names(c => c.awareness > 0),
      roadsClosed: names(c => c.roadsBlocked > 0)
    },
    unlockedMutations: s.mutations.filter(m => m.unlocked).map(m => m.name),
    availableMutations: s.mutations.filter(m => !m.unlocked).map(m => ({ name: m.name, cost: m.cost })),
    activeMissions: s.missions
      .filter(m => m.status === 'active')
      .map(m => m.id)
      .map(id => missionTitle(id)),
    activeModifiers: s.modifiers.map(m => m.label)
  };
}

const missionTitle = (id: string) => MISSIONS_BY_ID.get(id)?.title ?? id;

let newsSeq = 0;
function makeNews(day: number, title: string, description: string, type: NewsItem['type']): NewsItem {
  return { id: `${day}-${++newsSeq}`, day, title, description, type };
}
const MAX_NEWS = 14;
const trimNews = (news: NewsItem[]) => news.slice(-MAX_NEWS);

function say(trigger: BarkTrigger, vars?: Record<string, string | number>) {
  useCharacterStore.getState().say(trigger, vars);
}

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

export const useGameStore = create<GameState>((set, get) => {
  const addNews = (title: string, description: string, type: NewsItem['type']) =>
    set(s => ({ news: trimNews([...s.news, makeNews(s.currentDay, title, description, type)]) }));

  const syncParams = () => {
    const s = get();
    s.model?.updateParams(effectiveParams(s.virusParams, s.modifiers));
  };

  /** Evalúa misiones y paga recompensas. */
  const runMissions = (endOfDay: boolean) => {
    const s = get();
    if (!s.model) return;
    const result = evaluateMissions(s.missions, missionContext(s), endOfDay);
    let budget = s.budget;
    let points = s.evolutionPoints;
    const news = [...s.news];
    for (const def of result.completed) {
      budget += def.reward.money ?? 0;
      points += def.reward.points ?? 0;
      const reward = def.reward.money ? formatMoney(def.reward.money) : `${def.reward.points} puntos de evolución`;
      news.push(makeNews(s.currentDay, `🏅 Misión cumplida: ${def.title}`, `Recompensa: ${reward}.`, 'info'));
      say('missionDone', { mission: def.title });
      playSound('mission');
    }
    for (const def of result.failed) {
      news.push(makeNews(s.currentDay, `❌ Misión fallida: ${def.title}`, def.description, 'warning'));
    }
    set({ missions: result.missions, budget, evolutionPoints: points, news: trimNews(news) });
  };

  const checkEnd = () => {
    const s = get();
    if (!s.model || s.gameOver) return;
    const cfg = DIFFICULTIES[s.difficulty];
    const stats = s.model.getGlobalStats();
    const healthyFraction = stats.susceptible / Math.max(1, stats.total);
    let victory: boolean | null = null;
    let reason = '';

    if (s.mode === 'government') {
      if (s.cureProgress >= 100) {
        victory = true;
        reason = '¡La cura está lista! Las brigadas vacunan a toda la provincia.';
      } else if (s.currentDay >= 5 && stats.zombie < 0.5) {
        victory = true;
        reason = 'El brote fue contenido: no queda ningún zombie activo en Manabí.';
      } else if (healthyFraction < cfg.defeatHealthyFraction) {
        victory = false;
        reason = 'Manabí ha caído: ya casi no quedan personas sanas.';
      }
    } else if (healthyFraction < 0.02) {
      victory = true;
      reason = 'El virus conquistó Manabí: menos del 2% de la población sigue sana.';
    } else if (s.cureProgress >= 100) {
      victory = false;
      reason = 'El gobierno terminó la cura y el virus fue erradicado.';
    } else if (s.currentDay >= 3 && stats.zombie < 0.5) {
      victory = false;
      reason = 'Los últimos zombies fueron eliminados. El virus se extinguió.';
    }

    if (victory === null) return;
    const cantons = cantonSnapshots(s.model);
    const endStats = computeEndStats({
      mode: s.mode,
      victory,
      day: s.currentDay,
      totalPopulation: stats.total,
      susceptible: stats.susceptible,
      zombie: stats.zombie,
      removed: stats.removed,
      cantonsLost: cantons.filter(c => (c.zombie + c.removed) / Math.max(1, c.population) > 0.5).length,
      cantonsInfected: s.infectedCantons.length,
      cureProgress: s.cureProgress,
      missionsDone: s.missions.filter(m => m.status === 'done').length
    });
    set({ gameOver: { victory, reason, stats: endStats }, simulationSpeed: 'paused', activeEvent: null });
    playSound(victory ? 'victory' : 'defeat');
  };

  const eventApi = (): EventApi => ({
    addBudget: n => set(s => ({ budget: Math.max(0, s.budget + n) })),
    addBudgetPerDay: n => set(s => ({ budgetPerDay: Math.max(0, s.budgetPerDay + n) })),
    addCure: n => set(s => ({ cureProgress: Math.max(0, Math.min(100, s.cureProgress + n)) })),
    addResearchRate: n => set(s => ({ researchRate: Math.min(MAX_RESEARCH_RATE, s.researchRate + n) })),
    addZombies: (id, n) => {
      get().model?.addZombies(id, n);
    },
    setQuarantine: (id, on) => get().model?.applyQuarantine(id, on),
    setMilitary: (id, strength) => {
      const st = get().model?.getState(id);
      if (st) get().model?.deployMilitary(id, Math.max(st.militaryPresence, strength));
    },
    addModifier: (param, factor, days, label) => {
      set(s => ({ modifiers: [...s.modifiers, { id: ++newsSeq, param, factor, untilDay: s.currentDay + days, label }] }));
      syncParams();
    },
    addEvolution: n => set(s => ({ evolutionPoints: Math.max(0, s.evolutionPoints + n) }))
  });

  /** Cobra una acción de gobierno; devuelve false (y suena error) si no alcanza el dinero. */
  const charge = (action: ActionId): boolean => {
    const s = get();
    const cost = actionCost(action, s.difficulty);
    if (!s.model || s.gameOver || s.budget < cost) {
      playSound('error');
      return false;
    }
    set({ budget: s.budget - cost });
    return true;
  };

  const afterAction = (counter: keyof Counters, title: string, description: string) => {
    set(s => ({ counters: { ...s.counters, [counter]: s.counters[counter] + 1 } }));
    addNews(title, description, 'info');
    playSound('action');
    runMissions(false);
  };

  return {
    mode: 'government',
    difficulty: 'normal',
    currentDay: 0,
    simulationSpeed: 'paused',
    model: null,
    budget: DIFFICULTIES.normal.budget,
    budgetPerDay: DIFFICULTIES.normal.budgetPerDay,
    cureProgress: 0,
    researchRate: 0,
    evolutionPoints: 0,
    mutations: INITIAL_MUTATIONS.map(m => ({ ...m })),
    virusParams: { ...BASE_PARAMS },
    modifiers: [],
    history: [],
    news: [],
    selectedCantonId: null,
    activeEvent: null,
    nextEventDay: FIRST_EVENT_DAY,
    usedEventIds: [],
    missions: [],
    counters: { ...EMPTY_COUNTERS },
    infectedCantons: [],
    criticalCantons: [],
    cureMilestones: [],
    budgetLowWarned: false,
    nextBossDay: DIFFICULTIES.normal.firstBossDay,
    bossesSpawned: 0,
    gameOver: null,
    tutorialActive: false,

    initializeGame: (mode, patientZeroCantonId, difficulty = 'normal') => {
      const cfg = DIFFICULTIES[difficulty];
      const outbreak = cfg.outbreak;
      const initialStates: CantonState[] = MANABI_CANTONS.map(canton => ({
        cantonId: canton.id,
        // El brote inicial sale de la población del cantón, así el total no cambia
        susceptible: canton.id === patientZeroCantonId ? canton.population - outbreak : canton.population,
        zombie: canton.id === patientZeroCantonId ? outbreak : 0,
        removed: 0,
        quarantine: false,
        militaryPresence: 0,
        roadsBlocked: [],
        awareness: 0
      }));

      const virusParams: SimulationParams = { ...BASE_PARAMS, beta: cfg.beta, quarantineEffectiveness: cfg.quarantineEffectiveness };
      const model = new SZRModel(initialStates, CONNECTIONS, { ...virusParams });
      const cantonName = CANTONS_MAP.get(patientZeroCantonId)?.name || 'desconocido';
      useCharacterStore.getState().clear();

      set({
        mode,
        difficulty,
        model,
        currentDay: 0,
        simulationSpeed: 'paused',
        budget: mode === 'government' ? cfg.budget : 0,
        budgetPerDay: mode === 'government' ? cfg.budgetPerDay : 0,
        cureProgress: 0,
        researchRate: 0,
        evolutionPoints: mode === 'virus' ? 5 : 0,
        mutations: INITIAL_MUTATIONS.map(m => ({ ...m })),
        virusParams,
        modifiers: [],
        history: [{ day: 0, ...pickTotals(model) }],
        news: [
          makeNews(
            0,
            '🚨 ALERTA: Brote confirmado',
            `Se ha detectado un brote de ${formatNumber(outbreak)} infectados en ${cantonName}. Las autoridades investigan el origen.`,
            'danger'
          )
        ],
        selectedCantonId: patientZeroCantonId,
        activeEvent: null,
        nextEventDay: FIRST_EVENT_DAY,
        usedEventIds: [],
        missions: initialMissions(mode),
        counters: { ...EMPTY_COUNTERS },
        infectedCantons: [patientZeroCantonId],
        criticalCantons: [],
        cureMilestones: [],
        budgetLowWarned: false,
        nextBossDay: cfg.firstBossDay,
        bossesSpawned: 0,
        gameOver: null
      });
    },

    simulateDay: () => {
      const s = get();
      const { model } = s;
      if (!model || s.gameOver || s.activeEvent) return;
      const cfg = DIFFICULTIES[s.difficulty];
      const day = s.currentDay + 1;

      // Modificadores temporales que siguen vigentes
      const modifiers = s.modifiers.filter(m => m.untilDay >= day);
      model.updateParams(effectiveParams(s.virusParams, modifiers));
      model.simulateDay();
      const stats = model.getGlobalStats();

      // Cura: el gobierno investiga; en Modo Virus el gobierno la desarrolla solo
      let cure = s.cureProgress;
      if (s.mode === 'government') {
        cure += s.researchRate;
      } else {
        const slowdown = s.mutations.filter(m => m.unlocked).reduce((f, m) => f * (m.effect.cureSlowdown ?? 1), 1);
        cure += cfg.virusCureRate * (1 + 3 * stats.infectionRate) * slowdown;
      }
      cure = Math.min(100, cure);

      const budget = s.mode === 'government' ? s.budget + s.budgetPerDay : s.budget;
      const evolutionPoints =
        s.mode === 'virus'
          ? s.evolutionPoints + Math.floor((stats.zombie / 10_000) * cfg.evolutionMultiplier) + (day % 2 === 0 ? 1 : 0)
          : s.evolutionPoints;

      const news = [...s.news];
      const push = (title: string, description: string, type: NewsItem['type']) => news.push(makeNews(day, title, description, type));

      // Cantones nuevos y cantones que superan el 50%
      const infected = new Set(s.infectedCantons);
      const critical = new Set(s.criticalCantons);
      const newlyInfected: string[] = [];
      const newlyCritical: string[] = [];
      for (const st of model.getAllStates()) {
        const total = st.susceptible + st.zombie + st.removed;
        const name = CANTONS_MAP.get(st.cantonId)?.name ?? st.cantonId;
        if (st.zombie >= 1 && !infected.has(st.cantonId)) {
          infected.add(st.cantonId);
          newlyInfected.push(name);
        }
        if (total > 0 && st.zombie / total > 0.5 && !critical.has(st.cantonId)) {
          critical.add(st.cantonId);
          newlyCritical.push(name);
        }
      }
      if (newlyInfected.length) {
        const list = newlyInfected.join(', ');
        push(`🦠 El virus llega a ${list}`, `Se confirman los primeros casos en ${list}.`, 'warning');
        say('newCanton', { canton: newlyInfected.length > 1 ? `${newlyInfected[0]} y ${newlyInfected.length - 1} más` : newlyInfected[0] });
        playSound('infect');
      }
      for (const name of newlyCritical) {
        push(`☣️ ${name} supera el 50%`, `Más de la mitad de la población de ${name} está infectada.`, 'danger');
      }
      if (newlyCritical.length) {
        say('cantonOver50', { canton: newlyCritical[0] });
        playSound('infect');
      }

      // Presupuesto bajo (se rearma cuando vuelve a superar $150.000)
      let budgetLowWarned = s.budgetLowWarned;
      if (s.mode === 'government') {
        if (budget < 100_000 && !budgetLowWarned) {
          budgetLowWarned = true;
          say('budgetLow');
        } else if (budget > 150_000) {
          budgetLowWarned = false;
        }
      }

      // Hitos de la cura
      const cureMilestones = [...s.cureMilestones];
      for (const m of [25, 50, 75] as const) {
        if (cure >= m && !cureMilestones.includes(m)) {
          cureMilestones.push(m);
          push(`🧪 Cura al ${m}%`, 'Los laboratorios reportan un avance importante.', 'info');
          say(`cure${m}`);
        }
      }

      // Jefes
      let { nextBossDay, bossesSpawned } = s;
      if (day >= nextBossDay && bossesSpawned < BOSSES.length) {
        const target = cantonSnapshots(model)
          .filter(c => c.zombie >= 1 && c.susceptible > 1000)
          .sort((a, b) => b.rate - a.rate)[0];
        if (target) {
          const boss = BOSSES[bossesSpawned];
          const amount = model.addZombies(target.id, Math.round(target.population * 0.015));
          push(`👑 ${boss} aparece en ${target.name}`, `Un jefe infectado arrasa ${target.name}: ${formatNumber(amount)} nuevos zombies.`, 'danger');
          say('boss', { boss, canton: target.name });
          playSound('boss');
          bossesSpawned += 1;
          nextBossDay = day + BOSS_INTERVAL;
        }
      }

      // Modo Virus: el gobierno (IA) responde con cuarentenas y militares
      if (s.mode === 'virus' && day % cfg.aiEvery === 0) {
        const hot = cantonSnapshots(model)
          .filter(c => c.rate > 0.03)
          .sort((a, b) => b.rate - a.rate);
        const toQuarantine = hot.find(c => !c.quarantine);
        const toMilitary = hot.find(c => !c.military);
        if (toQuarantine) {
          model.applyQuarantine(toQuarantine.id, true);
          push(`🔒 El gobierno aísla ${toQuarantine.name}`, 'Se declara cuarentena para frenar al virus.', 'warning');
        } else if (toMilitary) {
          model.deployMilitary(toMilitary.id, 0.8);
          push(`⚔️ Militares llegan a ${toMilitary.name}`, 'El ejército empieza a eliminar zombies.', 'warning');
        }
      }

      // Noticia de situación cada 5 días
      if (day % 5 === 0) {
        const hot = cantonSnapshots(model).filter(c => c.zombie >= 1).sort((a, b) => b.zombie - a.zombie)[0];
        if (hot) push(`📰 Situación crítica en ${hot.name}`, `Se reportan ${formatNumber(hot.zombie)} infectados activos.`, 'warning');
      }

      set({
        currentDay: day,
        modifiers,
        cureProgress: cure,
        budget,
        evolutionPoints,
        news: trimNews(news),
        infectedCantons: [...infected],
        criticalCantons: [...critical],
        cureMilestones,
        budgetLowWarned,
        nextBossDay,
        bossesSpawned,
        history: [...s.history, { day, ...pickTotals(model) }].slice(-200)
      });

      runMissions(true);
      checkEnd();

      // Evento con decisión
      const after = get();
      if (!after.gameOver && day >= after.nextEventDay) {
        const picked = pickEvent(snapshotOf(after), after.usedEventIds);
        const [min, max] = cfg.eventEvery;
        if (picked) {
          set({
            activeEvent: { id: picked.event.id, params: picked.params, day },
            usedEventIds: [...after.usedEventIds, picked.event.id],
            nextEventDay: day + randInt(min, max)
          });
          playSound('event');
        } else {
          set({ nextEventDay: day + 2 });
        }
      }
    },

    setSimulationSpeed: speed => {
      if (get().gameOver && speed !== 'paused') return;
      set({ simulationSpeed: speed });
    },

    selectCanton: cantonId => set({ selectedCantonId: cantonId }),

    setTutorialActive: active => set(active ? { tutorialActive: true, simulationSpeed: 'paused' } : { tutorialActive: false }),

    resolveEvent: optionIndex => {
      const s = get();
      const active = s.activeEvent;
      if (!active) return;
      const event = EVENTS_BY_ID.get(active.id);
      if (!event) {
        set({ activeEvent: null });
        return;
      }
      const option = event.options[optionIndex];
      const snap = snapshotOf(s);
      if (option.available && !option.available(snap)) {
        playSound('error');
        return;
      }
      const summary = option.apply(eventApi(), active.params, snap);
      set(st => ({
        activeEvent: null,
        counters: { ...st.counters, eventsResolved: st.counters.eventsResolved + 1 }
      }));
      addNews(`${event.icon} ${event.title}`, `${option.label}: ${summary}`, 'info');
      playSound('click');
      runMissions(false);
      checkEnd();
    },

    applyQuarantine: cantonId => {
      const st = get().model?.getState(cantonId);
      if (!st || st.quarantine || !charge('quarantine')) return false;
      get().model!.applyQuarantine(cantonId, true);
      const name = CANTONS_MAP.get(cantonId)?.name ?? cantonId;
      afterAction('quarantines', `🔒 Cuarentena activada en ${name}`, 'Se ha declarado cuarentena total. Los movimientos están restringidos.');
      return true;
    },

    deployMilitary: cantonId => {
      const st = get().model?.getState(cantonId);
      if (!st || st.militaryPresence > 0.5 || !charge('military')) return false;
      get().model!.deployMilitary(cantonId, 0.8);
      const name = CANTONS_MAP.get(cantonId)?.name ?? cantonId;
      afterAction('militaryDeployments', `⚔️ Militares desplegados en ${name}`, 'Las fuerzas armadas llegan para controlar la situación.');
      return true;
    },

    blockRoads: cantonId => {
      const model = get().model;
      const st = model?.getState(cantonId);
      const neighbors = CONNECTIONS.get(cantonId) ?? [];
      if (!model || !st || neighbors.every(n => st.roadsBlocked.includes(n)) || !charge('roadBlock')) return false;
      for (const n of neighbors) {
        model.blockRoad(cantonId, n);
        model.blockRoad(n, cantonId); // en ambas direcciones
      }
      const name = CANTONS_MAP.get(cantonId)?.name ?? cantonId;
      afterAction('roadBlocks', `🚧 Vías cerradas en ${name}`, `Se cortan las ${neighbors.length} carreteras que conectan ${name} con sus vecinos.`);
      return true;
    },

    launchCampaign: cantonId => {
      const st = get().model?.getState(cantonId);
      if (!st || (st.awareness ?? 0) >= 0.45 || !charge('campaign')) return false;
      get().model!.addAwareness(cantonId, 0.15);
      const name = CANTONS_MAP.get(cantonId)?.name ?? cantonId;
      afterAction('campaigns', `📢 Campaña de prevención en ${name}`, 'La población aprende a protegerse: baja el contagio en el cantón.');
      return true;
    },

    investInResearch: () => {
      if (get().researchRate >= MAX_RESEARCH_RATE || !charge('research')) return false;
      set(s => ({
        researchRate: Math.min(MAX_RESEARCH_RATE, s.researchRate + RESEARCH_RATE_STEP),
        cureProgress: Math.min(100, s.cureProgress + RESEARCH_IMMEDIATE)
      }));
      afterAction('research', '🔬 Inversión en investigación', `La cura avanza ahora a ${get().researchRate.toFixed(1).replace('.', ',')}% por día.`);
      checkEnd();
      return true;
    },

    unlockMutation: mutationId => {
      const s = get();
      const mutation = s.mutations.find(m => m.id === mutationId);
      if (!mutation || mutation.unlocked || s.evolutionPoints < mutation.cost || !s.model || s.gameOver) {
        playSound('error');
        return false;
      }
      const e = mutation.effect;
      const virusParams: SimulationParams = {
        ...s.virusParams,
        beta: s.virusParams.beta * (e.betaMultiplier ?? 1),
        gamma: s.virusParams.gamma * (e.gammaMultiplier ?? 1),
        mu: s.virusParams.mu * (e.muMultiplier ?? 1),
        quarantineEffectiveness: s.virusParams.quarantineEffectiveness * (e.quarantineMultiplier ?? 1)
      };
      set({
        virusParams,
        evolutionPoints: s.evolutionPoints - mutation.cost,
        mutations: s.mutations.map(m => (m.id === mutationId ? { ...m, unlocked: true } : m)),
        counters: { ...s.counters, mutationsUnlocked: s.counters.mutationsUnlocked + 1 },
        news: trimNews([...s.news, makeNews(s.currentDay, `🧬 Nueva mutación: ${mutation.name}`, mutation.description, 'danger')])
      });
      syncParams();
      playSound('action');
      runMissions(false);
      return true;
    }
  };
});
