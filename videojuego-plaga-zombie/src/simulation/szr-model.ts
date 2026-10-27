/**
 * Modelo matemático SZR (Sanos, Zombies, Removidos)
 * Basado en modelos epidemiológicos adaptados para zombies
 */

export interface CantonState {
  cantonId: string;
  susceptible: number; // Sanos
  zombie: number; // Zombies
  removed: number; // Muertos permanentes / eliminados
  quarantine: boolean; // ¿Está en cuarentena?
  militaryPresence: number; // 0-1, reduce la tasa de infección
  roadsBlocked: string[]; // IDs de cantones con carreteras bloqueadas
  awareness?: number; // 0-1, campañas de prevención: reduce el contagio local
}

export interface SimulationParams {
  // Parámetros del virus
  beta: number; // Tasa de transmisión (contacto sano-zombie)
  gamma: number; // Tasa de eliminación (zombies eliminados por día)
  mu: number; // Tasa de movilidad entre cantones (0-1)
  
  // Modificadores
  quarantineEffectiveness: number; // 0-1, reduce beta
  militaryEffectiveness: number; // 0-1, aumenta gamma
  roadBlockEffectiveness: number; // 0-1, reduce mu
}

export class SZRModel {
  private states: Map<string, CantonState>;
  private params: SimulationParams;
  private connections: Map<string, string[]>;
  
  constructor(
    initialStates: CantonState[],
    connections: Map<string, string[]>,
    params: SimulationParams
  ) {
    this.states = new Map(initialStates.map(s => [s.cantonId, { ...s }]));
    this.connections = connections;
    this.params = params;
  }

  /**
   * Simula un día en todos los cantones
   */
  simulateDay(): void {
    const newStates = new Map<string, CantonState>();

    // Para cada cantón, calculamos los cambios
    for (const [cantonId, state] of this.states) {
      const newState = this.simulateCantonDay(state);
      newStates.set(cantonId, newState);
    }

    // Aplicar migración de zombies entre cantones
    this.applyMigration(newStates);

    // Actualizar estados
    this.states = newStates;
  }

  /**
   * Simula un día en un cantón específico (usa decimales, no redondea)
   */
  private simulateCantonDay(state: CantonState): CantonState {
    const { susceptible, zombie, removed, quarantine, militaryPresence, awareness = 0 } = state;
    const total = susceptible + zombie + removed;

    if (total === 0) return { ...state };

    // Beta efectivo (reducido por cuarentena)
    let betaEff = this.params.beta;
    if (quarantine) {
      betaEff *= (1 - this.params.quarantineEffectiveness);
    }

    // Las campañas de prevención reducen el contacto de riesgo
    betaEff *= 1 - Math.max(0, Math.min(0.9, awareness));

    // Gamma efectivo (aumentado por militares)
    let gammaEff = this.params.gamma;
    if (militaryPresence > 0) {
      gammaEff *= (1 + militaryPresence * this.params.militaryEffectiveness);
    }

    // Nuevas infecciones: S -> Z (MANTENER DECIMALES)
    const newInfections = betaEff * susceptible * (zombie / total);

    // Zombies eliminados: Z -> R (MANTENER DECIMALES)
    const newRemovals = gammaEff * zombie;

    // Nuevos valores (NO REDONDEAR - mantener precisión decimal)
    const newSusceptible = Math.max(0, susceptible - newInfections);
    const newZombie = Math.max(0, zombie + newInfections - newRemovals);
    const newRemoved = Math.max(0, removed + newRemovals);

    return {
      ...state,
      susceptible: newSusceptible,  // Decimales
      zombie: newZombie,            // Decimales
      removed: newRemoved           // Decimales
    };
  }

  /**
   * Aplica migración de zombies entre cantones conectados
   */
  private applyMigration(states: Map<string, CantonState>): void {
    const migrations: { from: string; to: string; amount: number }[] = [];

    for (const [cantonId, state] of states) {
      const connections = this.connections.get(cantonId) || [];
      
      for (const connectedId of connections) {
        // Verificar si la carretera está bloqueada
        if (state.roadsBlocked.includes(connectedId)) continue;

        const connectedState = states.get(connectedId);
        if (!connectedState) continue;

        // Tasa de migración efectiva
        let muEff = this.params.mu;
        
        // Si el cantón destino tiene cuarentena, reducir migración
        if (connectedState.quarantine) {
          muEff *= (1 - this.params.roadBlockEffectiveness);
        }

        // Cantidad de zombies que migran (MANTENER DECIMALES)
        const migrationAmount = state.zombie * muEff * 0.1;
        
        if (migrationAmount > 0.01) { // Solo migrar si es significativo
          migrations.push({
            from: cantonId,
            to: connectedId,
            amount: migrationAmount
          });
        }
      }
    }

    // Aplicar todas las migraciones
    for (const migration of migrations) {
      const fromState = states.get(migration.from);
      const toState = states.get(migration.to);

      if (fromState && toState) {
        fromState.zombie = Math.max(0, fromState.zombie - migration.amount);
        toState.zombie += migration.amount;
        
        // Ajustar susceptibles en destino si hay sobrepoblación (MANTENER DECIMALES)
        const toTotal = toState.susceptible + toState.zombie + toState.removed;
        const fromTotal = fromState.susceptible + fromState.zombie + fromState.removed;
        
        if (toTotal > 0 && fromTotal > 0) {
          // Proporcional
          const ratio = migration.amount / fromTotal;
          const susceptibleMigration = fromState.susceptible * ratio;
          
          if (susceptibleMigration > 0.01) {
            fromState.susceptible -= susceptibleMigration;
            toState.susceptible += susceptibleMigration;
          }
        }
      }
    }
  }

  /**
   * Obtiene el estado actual de un cantón
   */
  getState(cantonId: string): CantonState | undefined {
    return this.states.get(cantonId);
  }

  /**
   * Obtiene todos los estados
   */
  getAllStates(): CantonState[] {
    return Array.from(this.states.values());
  }

  /**
   * Aplica una medida de gobierno
   */
  applyQuarantine(cantonId: string, enable: boolean): void {
    const state = this.states.get(cantonId);
    if (state) {
      state.quarantine = enable;
    }
  }

  /**
   * Convierte sanos en zombies en un cantón (eventos, jefes). Devuelve cuántos se infectaron.
   */
  addZombies(cantonId: string, amount: number): number {
    const state = this.states.get(cantonId);
    if (!state || amount <= 0) return 0;
    const infected = Math.min(state.susceptible, amount);
    state.susceptible -= infected;
    state.zombie += infected;
    return infected;
  }

  /**
   * Aumenta la conciencia (campañas) de un cantón, con tope
   */
  addAwareness(cantonId: string, amount: number, max = 0.45): void {
    const state = this.states.get(cantonId);
    if (state) state.awareness = Math.min(max, (state.awareness ?? 0) + amount);
  }

  /**
   * Despliega militares en un cantón
   */
  deployMilitary(cantonId: string, strength: number): void {
    const state = this.states.get(cantonId);
    if (state) {
      state.militaryPresence = Math.max(0, Math.min(1, strength));
    }
  }

  /**
   * Bloquea una carretera entre dos cantones
   */
  blockRoad(fromCantonId: string, toCantonId: string): void {
    const state = this.states.get(fromCantonId);
    if (state && !state.roadsBlocked.includes(toCantonId)) {
      state.roadsBlocked.push(toCantonId);
    }
  }

  /**
   * Desbloquea una carretera
   */
  unblockRoad(fromCantonId: string, toCantonId: string): void {
    const state = this.states.get(fromCantonId);
    if (state) {
      state.roadsBlocked = state.roadsBlocked.filter(id => id !== toCantonId);
    }
  }

  /**
   * Parámetros actuales del virus
   */
  getParams(): SimulationParams {
    return { ...this.params };
  }

  /**
   * Actualiza los parámetros del virus (mutaciones)
   */
  updateParams(newParams: Partial<SimulationParams>): void {
    this.params = { ...this.params, ...newParams };
  }

  /**
   * Calcula estadísticas globales
   */
  getGlobalStats() {
    let totalSusceptible = 0;
    let totalZombie = 0;
    let totalRemoved = 0;

    for (const state of this.states.values()) {
      totalSusceptible += state.susceptible;
      totalZombie += state.zombie;
      totalRemoved += state.removed;
    }

    const total = totalSusceptible + totalZombie + totalRemoved;

    return {
      susceptible: totalSusceptible,
      zombie: totalZombie,
      removed: totalRemoved,
      total,
      infectionRate: total > 0 ? totalZombie / total : 0,
      deathRate: total > 0 ? totalRemoved / total : 0
    };
  }
}
