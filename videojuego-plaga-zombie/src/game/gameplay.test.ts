import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, ACTION_COSTS, buildAdvisorState, snapshotOf, BOSSES } from '../store/game-store';
import { enqueue, tickQueue, MESSAGE_GAP_MS, QueueState, CharacterMessage } from '../store/character-store';
import { GAME_EVENTS, pickEvent } from './events';
import { MISSIONS, evaluateMissions, initialMissions, MissionContext } from './missions';
import { computeEndStats, gradeFor } from './scoring';
import { ruleBasedAdvice, requestAdvice } from './advisor';
import { CHARACTER_LIST } from './characters';
import { DIFFICULTIES } from './difficulty';
import { barkFor } from './barks';

const store = () => useGameStore.getState();

/** Avanza n días resolviendo los eventos con la opción indicada. */
function advance(days: number, option: 0 | 1 = 1) {
  for (let i = 0; i < days && !store().gameOver; i++) {
    if (store().activeEvent) store().resolveEvent(option);
    store().simulateDay();
  }
}

describe('Eventos con decisiones', () => {
  it('hay al menos 8 eventos de gobierno y todos tienen dos opciones', () => {
    const gov = GAME_EVENTS.filter(e => e.modes.includes('government'));
    expect(gov.length).toBeGreaterThanOrEqual(8);
    for (const e of GAME_EVENTS) {
      expect(e.options).toHaveLength(2);
      for (const o of e.options) expect(o.effect.length).toBeGreaterThan(0);
    }
    expect(GAME_EVENTS.some(e => e.modes.includes('virus'))).toBe(true);
  });

  it('cada opción de cada evento se aplica sin dejar valores inválidos', () => {
    for (const event of GAME_EVENTS) {
      for (const optionIndex of [0, 1] as const) {
        const mode = event.modes[0];
        store().initializeGame(mode, 'manta');
        // Preparar condiciones: Portoviejo en cuarentena, militares y algo de brote
        store().model!.applyQuarantine('portoviejo', true);
        store().model!.deployMilitary('manta', 0.8);
        store().model!.addZombies('manta', 5000);
        if (mode === 'virus') useGameStore.setState({ evolutionPoints: 10 });
        const params = event.prepare(snapshotOf(store()));
        expect(params, event.id).not.toBeNull();
        useGameStore.setState({ activeEvent: { id: event.id, params: params!, day: 1 } });

        store().resolveEvent(optionIndex);

        const s = store();
        expect(s.activeEvent).toBeNull();
        expect(Number.isFinite(s.budget) && s.budget >= 0).toBe(true);
        expect(s.cureProgress).toBeGreaterThanOrEqual(0);
        const stats = s.model!.getGlobalStats();
        expect(Number.isFinite(stats.zombie)).toBe(true);
      }
    }
  });

  it('un evento pausa la simulación hasta que el jugador decide', () => {
    store().initializeGame('government', 'manta');
    for (let i = 0; i < 8; i++) store().simulateDay();
    expect(store().activeEvent).not.toBeNull();
    const day = store().currentDay;
    store().simulateDay();
    expect(store().currentDay).toBe(day);
    store().resolveEvent(1);
    store().simulateDay();
    expect(store().currentDay).toBe(day + 1);
  });

  it('no repite eventos hasta agotar la lista', () => {
    store().initializeGame('government', 'manta');
    const snap = snapshotOf(store());
    const used: string[] = [];
    for (let i = 0; i < 6; i++) {
      const picked = pickEvent(snap, used)!;
      expect(used).not.toContain(picked.event.id);
      used.push(picked.event.id);
    }
  });
});

describe('Acciones de gobierno', () => {
  beforeEach(() => store().initializeGame('government', 'manta'));

  it('la cuarentena cobra su costo, cuenta para las misiones y no se repite', () => {
    const before = store().budget;
    expect(store().applyQuarantine('manta')).toBe(true);
    expect(store().budget).toBe(before - ACTION_COSTS.quarantine);
    expect(store().counters.quarantines).toBe(1);
    expect(store().applyQuarantine('manta')).toBe(false);
  });

  it('investigar sube la cura al instante y su velocidad diaria', () => {
    store().investInResearch();
    expect(store().cureProgress).toBeGreaterThan(0);
    expect(store().researchRate).toBeGreaterThan(0);
    const cure = store().cureProgress;
    store().simulateDay();
    expect(store().cureProgress).toBeGreaterThan(cure);
  });

  it('sin dinero las acciones fallan', () => {
    useGameStore.setState({ budget: 10_000 });
    expect(store().deployMilitary('manta')).toBe(false);
    expect(store().budget).toBe(10_000);
  });

  it('cerrar vías bloquea todas las carreteras del cantón en ambos sentidos', () => {
    store().blockRoads('manta');
    const st = store().model!.getState('manta')!;
    expect(st.roadsBlocked.sort()).toEqual(['jaramijo', 'montecristi']);
    expect(store().model!.getState('montecristi')!.roadsBlocked).toContain('manta');
  });

  it('la campaña reduce el contagio del cantón', () => {
    store().launchCampaign('manta');
    expect(store().model!.getState('manta')!.awareness).toBeCloseTo(0.15);
  });
});

describe('Misiones', () => {
  it('la misión de cuarentenas paga su recompensa al cumplirse', () => {
    store().initializeGame('government', 'manta');
    const budget0 = store().budget;
    store().applyQuarantine('manta');
    store().applyQuarantine('montecristi');
    store().applyQuarantine('jaramijo');
    const m = store().missions.find(x => x.id === 'tres-cuarentenas')!;
    expect(m.status).toBe('done');
    expect(store().budget).toBe(budget0 - 3 * ACTION_COSTS.quarantine + 80_000);
  });

  it('Portoviejo bajo 20% cuenta días seguidos y se reinicia si sube', () => {
    const def = MISSIONS.find(x => x.id === 'portoviejo-bajo-20')!;
    const ctx = (rate: number): MissionContext => ({
      mode: 'government',
      day: 10,
      budget: 0,
      cureProgress: 0,
      evolutionPoints: 0,
      cantons: [{ id: 'portoviejo', name: 'Portoviejo', population: 1000, susceptible: 1000, zombie: rate * 1000, removed: 0, rate, quarantine: false, military: false, awareness: 0, roadsBlocked: 0 }],
      counters: { quarantines: 0, militaryDeployments: 0, research: 0, mutationsUnlocked: 0 },
      totalZombies: 0
    });
    let missions = initialMissions('government');
    for (let i = 0; i < 4; i++) missions = evaluateMissions(missions, ctx(0.1), true).missions;
    expect(missions.find(x => x.id === def.id)!.progress).toBe(4);
    missions = evaluateMissions(missions, ctx(0.3), true).missions;
    expect(missions.find(x => x.id === def.id)!.progress).toBe(0);
    for (let i = 0; i < 5; i++) missions = evaluateMissions(missions, ctx(0.1), true).missions;
    expect(missions.find(x => x.id === def.id)!.status).toBe('done');
  });

  it('la cura al 50% falla si pasa el día 30', () => {
    store().initializeGame('government', 'manta');
    advance(30);
    expect(store().missions.find(x => x.id === 'cura-50-dia-30')!.status).toBe('failed');
  });
});

describe('Dificultad, jefes y final', () => {
  it('Pesadilla da menos dinero y un brote más grande que Fácil', () => {
    store().initializeGame('government', 'manta', 'facil');
    const easy = { budget: store().budget, zombies: store().model!.getGlobalStats().zombie };
    store().initializeGame('government', 'manta', 'pesadilla');
    expect(store().budget).toBeLessThan(easy.budget);
    expect(store().model!.getGlobalStats().zombie).toBeGreaterThan(easy.zombies);
  });

  it('aparece un jefe en la fecha de la dificultad', () => {
    store().initializeGame('government', 'manta');
    advance(DIFFICULTIES.normal.firstBossDay);
    expect(store().bossesSpawned).toBe(1);
    expect(store().news.some(n => n.title.includes(BOSSES[0]))).toBe(true);
  });

  it('sin hacer nada el gobierno pierde, con estadísticas y calificación', () => {
    store().initializeGame('government', 'manta');
    advance(200);
    const over = store().gameOver!;
    expect(over).not.toBeNull();
    expect(over.victory).toBe(false);
    expect(['S', 'A', 'B', 'C']).toContain(over.stats.grade);
    expect(over.stats.cantonsLost).toBeGreaterThan(0);
    expect(store().simulationSpeed).toBe('paused');
  });

  it('con una buena estrategia el gobierno puede ganar', () => {
    store().initializeGame('government', 'manta');
    for (let day = 0; day < 120 && !store().gameOver; day++) {
      if (store().activeEvent) store().resolveEvent(1);
      // Estrategia simple: cuarentena y militares en los focos, el resto a investigación
      const hot = snapshotOf(store()).cantons.filter(c => c.zombie >= 1).sort((a, b) => b.rate - a.rate);
      for (const c of hot.slice(0, 4)) {
        if (!c.quarantine) store().applyQuarantine(c.id);
        if (!c.military && c.rate > 0.01) store().deployMilitary(c.id);
      }
      while (store().budget > 200_000 && store().investInResearch()) {
        /* invertir el excedente */
      }
      store().simulateDay();
    }
    expect(store().gameOver?.victory).toBe(true);
  });

  it('el virus puede ganar en su modo', () => {
    store().initializeGame('virus', 'manta');
    for (let day = 0; day < 200 && !store().gameOver; day++) {
      if (store().activeEvent) store().resolveEvent(0);
      for (const m of store().mutations) store().unlockMutation(m.id);
      store().simulateDay();
    }
    expect(store().gameOver?.victory).toBe(true);
  });

  it('las calificaciones siguen los umbrales', () => {
    expect(gradeFor(90)).toBe('S');
    expect(gradeFor(75)).toBe('A');
    expect(gradeFor(55)).toBe('B');
    expect(gradeFor(10)).toBe('C');
    const stats = computeEndStats({
      mode: 'government', victory: true, day: 30, totalPopulation: 100, susceptible: 95, zombie: 0, removed: 5,
      cantonsLost: 0, cantonsInfected: 3, cureProgress: 100, missionsDone: 3
    });
    expect(stats.grade).toBe('S');
    expect(stats.livesSaved).toBe(95);
  });
});

describe('Mensajes de los personajes', () => {
  const msg = (id: number, trigger: CharacterMessage['trigger'], createdAt: number): CharacterMessage => ({
    id, trigger, createdAt, characterId: 'lider', text: 'hola'
  });

  it('muestra como máximo un mensaje cada 6 segundos', () => {
    let q: QueueState = { queue: [], current: null, lastShownAt: -Infinity };
    q = enqueue(q, msg(1, 'newCanton', 0));
    q = enqueue(q, msg(2, 'budgetLow', 0));
    q = tickQueue(q, 0);
    expect(q.current?.id).toBe(1);
    q = tickQueue(q, 5600); // el primero ya expiró, pero no han pasado 6 s
    expect(q.current).toBeNull();
    q = tickQueue(q, MESSAGE_GAP_MS);
    expect(q.current?.id).toBe(2);
  });

  it('no amontona mensajes del mismo tipo', () => {
    let q: QueueState = { queue: [], current: null, lastShownAt: 0 };
    q = enqueue(q, msg(1, 'newCanton', 0));
    q = enqueue(q, msg(2, 'newCanton', 1));
    expect(q.queue).toHaveLength(1);
    expect(q.queue[0].id).toBe(2);
  });

  it('las frases rellenan los datos del momento', () => {
    const bark = barkFor('cantonOver50', { canton: 'Chone' }, () => 0);
    expect(bark.text).toContain('Chone');
  });
});

describe('Asesor', () => {
  it('el asesor por reglas da 2 o 3 frases coherentes con el estado para cada personaje', () => {
    store().initializeGame('government', 'manta');
    advance(6);
    const state = buildAdvisorState(store());
    expect(state.topCantons[0].name).toBe('Manta');
    for (const c of CHARACTER_LIST) {
      const text = ruleBasedAdvice(c.id, state);
      const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
      expect(sentences.length, c.id).toBeGreaterThanOrEqual(2);
      expect(sentences.length, c.id).toBeLessThanOrEqual(4);
    }
    expect(ruleBasedAdvice('medico', state)).toMatch(/Manta|Montecristi|Jaramijó/);
  });

  it('si el backend falla usa el asesor local', async () => {
    store().initializeGame('virus', 'manta');
    const state = buildAdvisorState(store());
    const failing = (() => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch;
    const result = await requestAdvice('hacker', state, { fetchImpl: failing });
    expect(result.source).toBe('local');
    expect(result.text.length).toBeGreaterThan(20);
  });

  it('usa la respuesta del backend cuando existe', async () => {
    store().initializeGame('government', 'manta');
    const ok = (() => Promise.resolve(new Response(JSON.stringify({ advice: 'Cierra Manta ya.' }), { status: 200 }))) as unknown as typeof fetch;
    const result = await requestAdvice('lider', buildAdvisorState(store()), { fetchImpl: ok });
    expect(result).toEqual({ text: 'Cierra Manta ya.', source: 'bedrock' });
  });
});
