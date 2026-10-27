import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, INITIAL_OUTBREAK, buildConnections } from './game-store';
import { MANABI_CANTONS } from '../data/manabi-data';
import { formatNumber, formatPercent } from '../utils/format';

const totalPopulation = MANABI_CANTONS.reduce((sum, c) => sum + c.population, 0);

describe('Brote en el juego (configuración real del store)', () => {
  beforeEach(() => {
    useGameStore.getState().initializeGame('government', 'manta');
  });

  it('arranca con el brote inicial y conserva la población total', () => {
    const stats = useGameStore.getState().model!.getGlobalStats();
    expect(stats.zombie).toBe(INITIAL_OUTBREAK);
    expect(stats.total).toBe(totalPopulation);
  });

  it('el brote crece visiblemente desde el primer día', () => {
    const { model } = useGameStore.getState();
    const before = model!.getGlobalStats();

    useGameStore.getState().simulateDay();
    const after = model!.getGlobalStats();

    // Lo que ve el jugador (valores redondeados) debe cambiar el día 1
    expect(formatNumber(after.zombie)).not.toBe(formatNumber(before.zombie));
    expect(Math.round(after.zombie)).toBeGreaterThan(Math.round(before.zombie));
    expect(formatPercent(after.infectionRate)).not.toBe('0%');
    expect(formatPercent(after.infectionRate)).not.toMatch(/^0,0+%$/);
    expect(useGameStore.getState().currentDay).toBe(1);
  });

  it('sigue creciendo día a día y se extiende a otros cantones', () => {
    const { model } = useGameStore.getState();
    let previous = model!.getGlobalStats().zombie;

    for (let day = 1; day <= 10; day++) {
      // Los eventos con decisión pausan el día: se elige la opción B para seguir
      if (useGameStore.getState().activeEvent) useGameStore.getState().resolveEvent(1);
      useGameStore.getState().simulateDay();
      const current = model!.getGlobalStats().zombie;
      expect(Math.round(current)).toBeGreaterThan(Math.round(previous));
      previous = current;
    }

    const infectedCantons = model!.getAllStates().filter(s => s.zombie >= 1);
    expect(infectedCantons.length).toBeGreaterThan(1);
    // La población total no cambia (solo se mueve entre S, Z y R)
    expect(model!.getGlobalStats().total).toBeCloseTo(totalPopulation, 3);
  });

  it('las conexiones del modelo son simétricas y cubren los 22 cantones', () => {
    const connections = buildConnections();
    expect(connections.size).toBe(22);
    for (const [id, neighbors] of connections) {
      expect(neighbors.length).toBeGreaterThan(0);
      for (const n of neighbors) expect(connections.get(n)).toContain(id);
    }
  });
});
