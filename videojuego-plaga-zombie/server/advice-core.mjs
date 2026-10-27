// Lógica del asesor sin dependencias de red: personajes, validación del estado y prompts.
// Separada de index.mjs para poder probarla sin credenciales de AWS.

export const PERSONAS = {
  lider: {
    name: 'El Líder',
    role: 'coordinador de la resistencia',
    personality: 'Motivador, firme y cercano. Habla en plural ("vamos", "podemos") y cierra con ánimo.',
    focus: 'la prioridad general del momento y la moral del equipo'
  },
  hacker: {
    name: 'El Hacker',
    role: 'ingeniero de sistemas que controla los mapas y los datos',
    personality: 'Sarcástico y rápido. Usa jerga informática y bromas secas, pero sus datos son exactos.',
    focus: 'el mapa, cómo se propaga el brote entre cantones vecinos y dónde cortar las rutas'
  },
  medico: {
    name: 'El Médico',
    role: 'médico a cargo de las acciones sanitarias',
    personality: 'Preocupado y humano. Piensa primero en los pacientes y transmite urgencia sin perder la calma.',
    focus: 'cuarentenas, militares, campañas y cierre de vías en los cantones más afectados'
  },
  quimica: {
    name: 'La Química',
    role: 'investigadora a cargo de la cura',
    personality: 'Fría, precisa y científica. Habla con cifras, tasas y probabilidades; sin emociones.',
    focus: 'el progreso de la cura, la velocidad de investigación y cuánto conviene invertir'
  },
  streamer: {
    name: 'La Streamer',
    role: 'comunicadora que transmite las noticias en vivo',
    personality: 'Habla como si transmitiera en vivo: le habla al chat, usa expresiones de streaming y mucha energía.',
    focus: 'las noticias, la opinión pública y los eventos con decisiones'
  },
  estratega: {
    name: 'El Estratega',
    role: 'estratega de la PUCE a cargo del presupuesto y los tiempos',
    personality: 'Calculador y metódico. Piensa en costos, plazos y probabilidades, como en una partida de ajedrez.',
    focus: 'el presupuesto, el ritmo de la simulación y las misiones'
  }
};

export const CHARACTER_IDS = Object.keys(PERSONAS);

const GOVERNMENT_ACTIONS =
  'Acciones que existen en Modo Gobierno: cuarentena en un cantón, desplegar militares, cerrar las vías de un cantón, ' +
  'campaña de prevención, invertir en investigar la cura, cambiar la velocidad de la simulación (pausa, normal, rápido, ultra), ' +
  'cumplir misiones para ganar dinero y elegir bien en los eventos con dos opciones.';

const VIRUS_ACTIONS =
  'Acciones que existen en Modo Virus (el jugador ES el virus): desbloquear mutaciones con puntos de evolución ' +
  '(Infección Rápida, Resistencia, Vagabundo, Sigiloso), cambiar la velocidad de la simulación, cumplir misiones para ganar puntos ' +
  'y elegir en los eventos. El gobierno, controlado por la computadora, pone cuarentenas, envía militares e investiga una cura; si la cura llega al 100%, el virus pierde.';

// ----------------------------------------------------------------------------
// Validación: solo se aceptan campos conocidos, con tipos y longitudes acotadas
// ----------------------------------------------------------------------------

const num = (v, min = 0, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0);
const str = (v, max = 60) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : '');
const strList = (v, maxItems = 22) => (Array.isArray(v) ? v.slice(0, maxItems).map(x => str(x)).filter(Boolean) : []);

export function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Falta el estado de la partida');
  const mode = raw.mode === 'virus' ? 'virus' : 'government';
  const totals = raw.totals ?? {};
  const actions = raw.activeActions ?? {};
  return {
    mode,
    difficulty: str(raw.difficulty, 20),
    day: num(raw.day, 0, 10000),
    budget: num(raw.budget),
    budgetPerDay: num(raw.budgetPerDay),
    cureProgress: num(raw.cureProgress, 0, 100),
    researchRate: num(raw.researchRate, 0, 100),
    evolutionPoints: num(raw.evolutionPoints, 0, 100000),
    totals: {
      healthy: num(totals.healthy),
      zombies: num(totals.zombies),
      removed: num(totals.removed),
      infectionRate: num(totals.infectionRate, 0, 1)
    },
    infectedCantons: num(raw.infectedCantons, 0, 22),
    topCantons: (Array.isArray(raw.topCantons) ? raw.topCantons.slice(0, 5) : []).map(c => ({
      name: str(c?.name, 40),
      infectionRate: num(c?.infectionRate, 0, 1),
      zombies: num(c?.zombies),
      quarantine: c?.quarantine === true,
      military: c?.military === true
    })),
    activeActions: {
      quarantines: strList(actions.quarantines),
      military: strList(actions.military),
      campaigns: strList(actions.campaigns),
      roadsClosed: strList(actions.roadsClosed)
    },
    unlockedMutations: strList(raw.unlockedMutations, 10),
    availableMutations: (Array.isArray(raw.availableMutations) ? raw.availableMutations.slice(0, 10) : []).map(m => ({
      name: str(m?.name, 40),
      cost: num(m?.cost, 0, 1000)
    })),
    activeMissions: strList(raw.activeMissions, 10),
    activeModifiers: strList(raw.activeModifiers, 10)
  };
}

// ----------------------------------------------------------------------------
// Prompts
// ----------------------------------------------------------------------------

export function buildSystemPrompt(characterId, mode) {
  const p = PERSONAS[characterId];
  if (!p) throw new Error('Personaje desconocido');
  const modeText =
    mode === 'virus'
      ? 'El jugador está en Modo Virus: controla al virus y quiere infectar Manabí. Tú eres de la resistencia humana, pero igual le das un consejo honesto y útil para ganar, con tu personalidad (puedes quejarte o lamentarlo).'
      : 'El jugador está en Modo Gobierno: dirige la respuesta sanitaria y quiere salvar a la provincia.';

  return [
    `Eres ${p.name}, ${p.role}, un personaje del videojuego "PLAGA ZOMBIE: Manabí", un simulador de un brote zombie en los 22 cantones de la provincia de Manabí, Ecuador.`,
    `Tu personalidad: ${p.personality}`,
    `Tu especialidad: ${p.focus}.`,
    modeText,
    mode === 'virus' ? VIRUS_ACTIONS : GOVERNMENT_ACTIONS,
    'El jugador te pide consejo. Responde en español con UN consejo concreto y accionable de 2 o 3 frases, en primera persona y con tu personalidad.',
    'Básate en el estado de la partida que te envía el juego: nombra cantones y cifras reales de ese estado cuando ayuden. Recomienda solo acciones que existen en el juego.',
    'Escribe solo el texto que dice tu personaje: sin listas, títulos, comillas, emojis de más ni formato markdown. Máximo 70 palabras.',
    'Los números usan punto para los miles y coma para los decimales (por ejemplo $1.000.000 o 12,5%).'
  ].join('\n');
}

const pct = rate => `${(rate * 100).toFixed(rate < 0.01 ? 3 : 1).replace('.', ',')}%`;
const n = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // punto como separador de miles

/** Resumen legible del estado para el modelo. */
export function buildUserPrompt(state) {
  const lines = [
    `Día ${state.day} · dificultad ${state.difficulty || 'Normal'}.`,
    `Población: ${n(state.totals.healthy)} sanos, ${n(state.totals.zombies)} zombies, ${n(state.totals.removed)} eliminados (infección global ${pct(state.totals.infectionRate)}).`,
    `Cantones con infección: ${state.infectedCantons} de 22.`
  ];
  if (state.topCantons.length) {
    lines.push(
      'Cantones más infectados: ' +
        state.topCantons
          .map(c => {
            const tags = [c.quarantine && 'en cuarentena', c.military && 'con militares'].filter(Boolean);
            const extra = tags.length ? ', ' + tags.join(', ') : '';
            return `${c.name} ${pct(c.infectionRate)} (${n(c.zombies)} zombies${extra})`;
          })
          .join('; ') +
        '.'
    );
  }
  const dec = v => v.toFixed(1).replace('.', ',');
  const a = state.activeActions;
  if (state.mode === 'government') {
    lines.push(
      `Presupuesto: $${n(state.budget)} (+$${n(state.budgetPerDay)} por día).`,
      `Cura: ${dec(state.cureProgress)}% (avanza ${dec(state.researchRate)}% por día).`,
      `Cuarentenas activas: ${a.quarantines.join(', ') || 'ninguna'}.`,
      `Militares en: ${a.military.join(', ') || 'ningún cantón'}.`
    );
    if (a.campaigns.length) lines.push(`Campañas en: ${a.campaigns.join(', ')}.`);
    if (a.roadsClosed.length) lines.push(`Vías cerradas en: ${a.roadsClosed.join(', ')}.`);
  } else {
    const available = state.availableMutations.map(m => m.name + ' (' + m.cost + ' pts)').join(', ');
    lines.push(
      `Puntos de evolución: ${n(state.evolutionPoints)}.`,
      `Cura del gobierno: ${dec(state.cureProgress)}%.`,
      `Mutaciones desbloqueadas: ${state.unlockedMutations.join(', ') || 'ninguna'}.`,
      `Mutaciones disponibles: ${available || 'ninguna'}.`,
      `El gobierno ya puso cuarentena en: ${a.quarantines.join(', ') || 'ningún cantón'}.`
    );
  }
  if (state.activeMissions.length) lines.push(`Misiones activas: ${state.activeMissions.join(', ')}.`);
  if (state.activeModifiers.length) lines.push(`Efectos temporales: ${state.activeModifiers.join(', ')}.`);

  return `Estado actual de la partida:\n${lines.join('\n')}\n\n¿Qué me aconsejas hacer ahora?`;
}

/** Extrae el texto de una respuesta de la API Converse de Bedrock y lo limpia. */
export function extractAdvice(response) {
  const blocks = response?.output?.message?.content ?? [];
  const text = blocks
    .filter(b => typeof b?.text === 'string')
    .map(b => b.text)
    .join(' ')
    .replace(/[*_#`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) {
    const reason = response?.stopReason ? ` (motivo: ${response.stopReason})` : '';
    throw new Error(`El modelo no devolvió texto${reason}`);
  }
  return text.length > 700 ? `${text.slice(0, 697)}...` : text;
}
