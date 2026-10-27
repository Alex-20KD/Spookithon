// Asesor: pide consejo al backend (Amazon Bedrock) y, si no está disponible, usa reglas locales.
import { CHARACTERS, CharacterId } from './characters';
import type { GameMode } from './types';
import { formatMoney, formatNumber, formatPercent } from '../utils/format';

export interface AdvisorCanton {
  name: string;
  infectionRate: number;
  zombies: number;
  quarantine: boolean;
  military: boolean;
}

/** Resumen del estado que se envía al asesor. Solo datos del juego, nada personal. */
export interface AdvisorState {
  mode: GameMode;
  difficulty: string;
  day: number;
  budget: number;
  budgetPerDay: number;
  cureProgress: number;
  researchRate: number;
  evolutionPoints: number;
  totals: { healthy: number; zombies: number; removed: number; infectionRate: number };
  infectedCantons: number;
  topCantons: AdvisorCanton[];
  activeActions: { quarantines: string[]; military: string[]; campaigns: string[]; roadsClosed: string[] };
  unlockedMutations: string[];
  availableMutations: { name: string; cost: number }[];
  activeMissions: string[];
  activeModifiers: string[];
}

export interface AdviceResult {
  text: string;
  source: 'bedrock' | 'local';
  /** Motivo por el que se usó el asesor local (para mostrarlo discretamente). */
  note?: string;
}

const pct = (rate: number) => formatPercent(rate);

// ----------------------------------------------------------------------------
// Asesor por reglas: analiza el estado y cada personaje lo dice a su manera
// ----------------------------------------------------------------------------

interface Analysis {
  hottest?: AdvisorCanton;
  unprotected?: AdvisorCanton; // el más infectado sin cuarentena
  noMilitary?: AdvisorCanton;
  lowBudget: boolean;
  canAfford: { quarantine: boolean; military: boolean; research: boolean };
  cureSlow: boolean;
  late: boolean;
  affordableMutation?: { name: string; cost: number };
}

function analyze(s: AdvisorState): Analysis {
  const hottest = s.topCantons[0];
  return {
    hottest,
    unprotected: s.topCantons.find(c => !c.quarantine && c.zombies >= 1),
    noMilitary: s.topCantons.find(c => !c.military && c.infectionRate > 0.05),
    lowBudget: s.budget < 100_000,
    canAfford: { quarantine: s.budget >= 50_000, military: s.budget >= 100_000, research: s.budget >= 50_000 },
    cureSlow: s.researchRate < 1,
    late: s.totals.infectionRate > 0.15,
    affordableMutation: s.availableMutations.filter(m => m.cost <= s.evolutionPoints).sort((a, b) => a.cost - b.cost)[0]
  };
}

function governmentAdvice(id: CharacterId, s: AdvisorState, a: Analysis): string[] {
  const hot = a.hottest;
  const target = a.unprotected ?? hot;
  switch (id) {
    case 'lider':
      return [
        `Día ${s.day}: el brote está en ${formatNumber(s.totals.zombies)} zombies y ${hot ? `${hot.name} es el frente más duro con ${pct(hot.infectionRate)}` : 'todavía estamos a tiempo'}.`,
        target && a.canAfford.quarantine
          ? `Nuestra prioridad es cerrar ${target.name} con una cuarentena y no soltar la investigación.`
          : `Ahorremos para la próxima jugada y no perdamos de vista la cura (${pct(s.cureProgress / 100)}).`,
        '¡Vamos, equipo, Manabí cuenta con nosotros!'
      ];
    case 'hacker':
      return [
        `Los datos no mienten: ${s.infectedCantons} cantones infectados y ${hot ? `${hot.name} lidera el ranking con ${pct(hot.infectionRate)}` : 'el mapa casi limpio'}.`,
        target
          ? `Si no aíslas ${target.name}, el virus salta a sus vecinos como malware en red abierta; cuarentena o cierre de vías ahí.`
          : 'Vigila los cantones vecinos de Manta: el virus siempre busca el puerto abierto.',
        'De nada, por cierto.'
      ];
    case 'medico':
      return [
        hot ? `Me preocupa mucho ${hot.name}: ${formatNumber(hot.zombies)} infectados y subiendo.` : 'Por ahora los hospitales aguantan, pero no por mucho.',
        a.noMilitary && a.canAfford.military
          ? `Despliega militares en ${a.noMilitary.name} para eliminar zombies más rápido, y pon cuarentena donde aún no la haya.`
          : target && a.canAfford.quarantine
            ? `Pon cuarentena en ${target.name} cuanto antes; cada día cuenta para esa gente.`
            : 'Lanza campañas de prevención en los cantones vecinos; son baratas y salvan vidas.'
      ];
    case 'quimica':
      return [
        `Progreso de la cura: ${Math.floor(s.cureProgress)}%, a ${s.researchRate.toFixed(1).replace('.', ',')}% por día.`,
        a.cureSlow && a.canAfford.research
          ? `Recomiendo invertir en investigación ahora: cada ${formatMoney(50_000)} suma velocidad de forma permanente.`
          : a.lowBudget
            ? 'Con este presupuesto, priorizar contención es lo racional; la investigación ya está en marcha.'
            : 'La velocidad actual es suficiente si contenemos el brote; invertir más acorta el plazo de forma lineal.'
      ];
    case 'streamer':
      return [
        `¡Hola chat! Reporte en vivo del día ${s.day}: ${pct(s.totals.infectionRate)} de Manabí infectado 😱`,
        s.activeModifiers.length
          ? `Ojo que ahora mismo pesa "${s.activeModifiers[0]}"; en los próximos eventos elige lo que calme a la gente aunque cueste algo.`
          : 'Cuando salga un evento, lee bien las consecuencias: los bulos y las fiestas disparan los contagios.',
        target ? `Y el chat pide cuarentena en ${target.name}, ¡dale like a esa decisión!` : '¡No se vayan, que esto se pone bueno!'
      ];
    case 'estratega':
      return [
        `Tienes ${formatMoney(s.budget)} y entran ${formatMoney(s.budgetPerDay)} por día.`,
        a.lowBudget
          ? 'Pausa la simulación, espera ingresos y gasta solo en el cantón que más se propaga.'
          : s.activeMissions.length
            ? `Apunta a la misión "${s.activeMissions[0]}": su recompensa financia tu siguiente movimiento.`
            : 'Reparte el gasto: una cuarentena en el foco principal y el resto en investigación.',
        a.late ? 'Usa la velocidad normal para reaccionar a tiempo; en ultra pierdes jugadas.' : 'Puedes acelerar hasta que aparezca el próximo foco.'
      ];
  }
}

function virusAdvice(id: CharacterId, s: AdvisorState, a: Analysis): string[] {
  const hot = a.hottest;
  switch (id) {
    case 'lider':
      return [
        `Te lo admito, virus: ${s.infectedCantons} cantones caídos en ${s.day} días.`,
        `Pero la cura va por ${Math.floor(s.cureProgress)}% y no vamos a rendirnos.`,
        a.affordableMutation ? `Si fuera tú, compraría "${a.affordableMutation.name}" antes de que lleguemos.` : 'Acumula puntos, porque vamos por ti.'
      ];
    case 'hacker':
      return [
        `Análisis de red: ${formatNumber(s.totals.zombies)} nodos infectados.`,
        hot ? `${hot.name} está al ${pct(hot.infectionRate)}; desde ahí saltas a los vecinos sin pedir permiso.` : 'Todavía hay rutas sin explotar.',
        'Las cuarentenas son tu firewall enemigo; la movilidad es tu exploit.'
      ];
    case 'medico':
      return [
        `Hay ${formatNumber(s.totals.healthy)} personas sanas todavía... por favor, déjalas en paz.`,
        a.affordableMutation
          ? `Aunque, siendo honesto, con ${s.evolutionPoints} puntos podrías mutar a "${a.affordableMutation.name}" y no podríamos frenarte.`
          : 'Los militares eliminan zombies cada día; sin resistencia no vas a durar.'
      ];
    case 'quimica':
      return [
        `La cura está al ${Math.floor(s.cureProgress)}%. A este ritmo, la terminamos antes de que caigan todos.`,
        'Matemáticamente, tu mejor opción es aumentar el contagio ahora, cuando la población sana aún es alta.'
      ];
    case 'streamer':
      return [
        `¡Chat, el virus nos está viendo! Día ${s.day}, ${pct(s.totals.infectionRate)} infectado 😱`,
        'En los eventos, los brotes grandes dan infectados pero aceleran la cura: elige con estilo.'
      ];
    case 'estratega':
      return [
        `Tienes ${formatNumber(s.evolutionPoints)} puntos de evolución.`,
        a.affordableMutation
          ? `La jugada óptima es "${a.affordableMutation.name}" (${a.affordableMutation.cost} pts).`
          : 'Ahorra para la siguiente mutación y completa misiones para ganar puntos extra.',
        'El tiempo corre a favor de la cura, no a tu favor.'
      ];
  }
}

export function ruleBasedAdvice(characterId: CharacterId, state: AdvisorState): string {
  const a = analyze(state);
  const sentences = state.mode === 'government' ? governmentAdvice(characterId, state, a) : virusAdvice(characterId, state, a);
  return sentences.slice(0, 3).join(' ');
}

// ----------------------------------------------------------------------------
// Cliente del backend
// ----------------------------------------------------------------------------

export const ADVICE_ENDPOINT = '/api/advice';

export async function requestAdvice(
  characterId: CharacterId,
  state: AdvisorState,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<AdviceResult> {
  const { timeoutMs = 25000, fetchImpl = typeof fetch !== 'undefined' ? fetch : undefined } = options;
  const local = (note: string): AdviceResult => ({ text: ruleBasedAdvice(characterId, state), source: 'local', note });
  if (!fetchImpl) return local('Sin conexión al servidor');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(ADVICE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character: characterId, state }),
      signal: controller.signal
    });
    if (!res.ok) return local(`El servidor respondió ${res.status}`);
    const data = (await res.json()) as { advice?: unknown };
    if (typeof data.advice !== 'string' || data.advice.trim() === '') return local('Respuesta vacía del servidor');
    return { text: data.advice.trim(), source: 'bedrock' };
  } catch (err) {
    return local((err as Error).name === 'AbortError' ? 'El servidor tardó demasiado' : 'Servidor de IA no disponible');
  } finally {
    clearTimeout(timer);
  }
}

export const characterName = (id: CharacterId) => CHARACTERS[id].name;
