import { describe, it, expect } from 'vitest';
import { CHARACTER_IDS, buildSystemPrompt, buildUserPrompt, extractAdvice, sanitizeState } from './advice-core.mjs';

const sampleState = {
  mode: 'government',
  difficulty: 'Normal',
  day: 12,
  budget: 1250000,
  budgetPerDay: 50000,
  cureProgress: 7.5,
  researchRate: 0.4,
  evolutionPoints: 0,
  totals: { healthy: 1400000, zombies: 5658, removed: 1125, infectionRate: 0.0039 },
  infectedCantons: 5,
  topCantons: [{ name: 'Manta', infectionRate: 0.02, zombies: 5000, quarantine: true, military: false }],
  activeActions: { quarantines: ['Manta'], military: [], campaigns: [], roadsClosed: [] },
  unlockedMutations: [],
  availableMutations: [],
  activeMissions: ['Escudo de Portoviejo'],
  activeModifiers: []
};

describe('Asesor (backend)', () => {
  it('tiene los seis personajes', () => {
    expect(CHARACTER_IDS.sort()).toEqual(['estratega', 'hacker', 'lider', 'medico', 'quimica', 'streamer']);
  });

  it('el prompt de sistema incluye la personalidad y pide 2 o 3 frases', () => {
    const prompt = buildSystemPrompt('hacker', 'government');
    expect(prompt).toContain('El Hacker');
    expect(prompt).toContain('Sarcástico');
    expect(prompt).toContain('2 o 3 frases');
    expect(() => buildSystemPrompt('desconocido', 'government')).toThrow();
  });

  it('el prompt de usuario resume el estado con el formato de números del juego', () => {
    const text = buildUserPrompt(sanitizeState(sampleState));
    expect(text).toContain('Día 12');
    expect(text).toContain('$1.250.000');
    expect(text).toContain('Manta');
    expect(text).toContain('en cuarentena');
    expect(text).toContain('Escudo de Portoviejo');
  });

  it('descarta campos desconocidos y acota valores', () => {
    const clean = sanitizeState({ ...sampleState, day: -5, budget: 'mucho', hack: 'x', topCantons: [{ name: 'A'.repeat(500) }] });
    expect(clean.day).toBe(0);
    expect(clean.budget).toBe(0);
    expect(clean).not.toHaveProperty('hack');
    expect(clean.topCantons[0].name.length).toBeLessThanOrEqual(40);
    expect(() => sanitizeState(null)).toThrow();
  });

  it('extrae solo el texto de la respuesta de Converse', () => {
    const advice = extractAdvice({
      output: { message: { content: [{ reasoningContent: {} }, { text: '**Cierra** Manta  ya.' }] } },
      stopReason: 'end_turn'
    });
    expect(advice).toBe('Cierra Manta ya.');
    expect(() => extractAdvice({ output: { message: { content: [] } }, stopReason: 'content_filtered' })).toThrow(/content_filtered/);
  });
});
