import { describe, it, expect } from 'vitest';
import { SZRModel, CantonState, SimulationParams } from './szr-model';

describe('SZRModel', () => {
  const createTestModel = () => {
    const initialStates: CantonState[] = [
      {
        cantonId: 'canton-a',
        susceptible: 10000,
        zombie: 100,
        removed: 0,
        quarantine: false,
        militaryPresence: 0,
        roadsBlocked: []
      },
      {
        cantonId: 'canton-b',
        susceptible: 5000,
        zombie: 0,
        removed: 0,
        quarantine: false,
        militaryPresence: 0,
        roadsBlocked: []
      }
    ];

    const connections = new Map<string, string[]>([
      ['canton-a', ['canton-b']],
      ['canton-b', ['canton-a']]
    ]);

    const params: SimulationParams = {
      beta: 0.3,
      gamma: 0.1,
      mu: 0.05,
      quarantineEffectiveness: 0.7,
      militaryEffectiveness: 0.8,
      roadBlockEffectiveness: 0.9
    };

    return new SZRModel(initialStates, connections, params);
  };

  it('debería crear un modelo correctamente', () => {
    const model = createTestModel();
    const state = model.getState('canton-a');
    
    expect(state).toBeDefined();
    expect(state?.susceptible).toBe(10000);
    expect(state?.zombie).toBe(100);
    expect(state?.removed).toBe(0);
  });

  it('debería simular un día sin pérdida de población total', () => {
    const model = createTestModel();
    const initialStats = model.getGlobalStats();
    const initialTotal = initialStats.total;

    model.simulateDay();

    const finalStats = model.getGlobalStats();
    const finalTotal = finalStats.total;

    // La población total debe mantenerse (con margen de error por redondeo)
    expect(Math.abs(finalTotal - initialTotal)).toBeLessThan(100);
  });

  it('debería aumentar los zombies con infección activa', () => {
    const model = createTestModel();
    const initialState = model.getState('canton-a');
    const initialZombies = initialState?.zombie || 0;

    model.simulateDay();

    const finalState = model.getState('canton-a');
    const finalZombies = finalState?.zombie || 0;

    // Con beta (0,3) > gamma (0,1) y casi toda la población sana, el brote crece
    expect(finalZombies).toBeGreaterThan(initialZombies);
  });

  it('debería reducir la infección con cuarentena', () => {
    const model1 = createTestModel();
    const model2 = createTestModel();

    // Aplicar cuarentena en el segundo modelo
    model2.applyQuarantine('canton-a', true);

    // Simular varios días
    for (let i = 0; i < 10; i++) {
      model1.simulateDay();
      model2.simulateDay();
    }

    const stats1 = model1.getGlobalStats();
    const stats2 = model2.getGlobalStats();

    // El modelo con cuarentena debería tener menos zombies
    expect(stats2.zombie).toBeLessThan(stats1.zombie);
  });

  it('debería aumentar la eliminación con militares', () => {
    const model = createTestModel();
    
    model.deployMilitary('canton-a', 0.8);
    
    // Simular varios días
    for (let i = 0; i < 5; i++) {
      model.simulateDay();
    }

    const stateAfter = model.getState('canton-a');
    const removedAfter = stateAfter?.removed || 0;

    // Debería haber eliminados
    expect(removedAfter).toBeGreaterThan(0);
  });

  it('debería permitir migración entre cantones conectados', () => {
    const model = createTestModel();

    // Canton A tiene zombies, Canton B no
    const stateBBefore = model.getState('canton-b');
    expect(stateBBefore?.zombie).toBe(0);

    // Simular muchos días para permitir migración
    for (let i = 0; i < 50; i++) {
      model.simulateDay();
    }

    const stateBAfter = model.getState('canton-b');
    
    // Canton B debería tener zombies por migración o infección
    expect(stateBAfter?.zombie).toBeGreaterThan(0);
  });

  it('debería bloquear migración con carreteras bloqueadas', () => {
    const model = createTestModel();

    // Bloquear la carretera
    model.blockRoad('canton-a', 'canton-b');
    model.blockRoad('canton-b', 'canton-a');

    // Simular muchos días
    for (let i = 0; i < 50; i++) {
      model.simulateDay();
    }

    const stateB = model.getState('canton-b');
    
    // Canton B debería seguir sin zombies (o muy pocos)
    expect(stateB?.zombie).toBeLessThan(10);
  });

  it('no debería tener valores negativos', () => {
    const model = createTestModel();

    // Simular muchos días
    for (let i = 0; i < 100; i++) {
      model.simulateDay();

      const states = model.getAllStates();
      
      for (const state of states) {
        expect(state.susceptible).toBeGreaterThanOrEqual(0);
        expect(state.zombie).toBeGreaterThanOrEqual(0);
        expect(state.removed).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('debería calcular estadísticas globales correctamente', () => {
    const model = createTestModel();
    const stats = model.getGlobalStats();

    expect(stats.susceptible).toBe(15000);
    expect(stats.zombie).toBe(100);
    expect(stats.removed).toBe(0);
    expect(stats.total).toBe(15100);
    expect(stats.infectionRate).toBeCloseTo(100 / 15100, 4);
  });

  it('debería mostrar crecimiento visible desde el primer día', () => {
    const model = createTestModel();
    
    const initialState = model.getState('canton-a');
    const initialZombies = initialState?.zombie || 0;
    
    expect(initialZombies).toBe(100);
    
    // Simular 1 día
    model.simulateDay();
    
    const day1State = model.getState('canton-a');
    const day1Zombies = day1State?.zombie || 0;
    
    // Los zombies deben haber crecido (aunque sea en decimales)
    expect(day1Zombies).toBeGreaterThan(initialZombies);
    
    // Verificar que hay crecimiento continuo en los primeros 10 días
    let previousZombies = day1Zombies;
    for (let day = 2; day <= 10; day++) {
      model.simulateDay();
      const currentState = model.getState('canton-a');
      const currentZombies = currentState?.zombie || 0;
      
      // Debe seguir creciendo
      expect(currentZombies).toBeGreaterThan(previousZombies);
      previousZombies = currentZombies;
    }
  });

  it('debería aplicar mutaciones correctamente', () => {
    const model = createTestModel();

    // Mutar para aumentar beta
    model.updateParams({ beta: 0.6 });

    const initialZombies = model.getState('canton-a')?.zombie || 0;

    // Simular días
    for (let i = 0; i < 10; i++) {
      model.simulateDay();
    }

    const finalZombies = model.getState('canton-a')?.zombie || 0;

    // Con beta más alto, deberían haber más zombies
    expect(finalZombies).toBeGreaterThan(initialZombies);
  });
});
