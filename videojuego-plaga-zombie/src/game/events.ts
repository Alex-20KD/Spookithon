// Eventos con decisiones (estilo Plague Inc). Cada evento ofrece dos opciones con consecuencias.
import type { SimulationParams } from '../simulation/szr-model';
import type { CharacterId } from './characters';
import type { GameMode, GameSnapshot } from './types';
import { formatMoney, formatNumber } from '../utils/format';

export type EventParams = Record<string, string | number>;

/** Operaciones que un evento puede hacer sobre la partida. */
export interface EventApi {
  addBudget(amount: number): void;
  addBudgetPerDay(amount: number): void;
  addCure(points: number): void;
  addResearchRate(pointsPerDay: number): void;
  addZombies(cantonId: string, amount: number): void;
  setQuarantine(cantonId: string, on: boolean): void;
  setMilitary(cantonId: string, strength: number): void;
  addModifier(param: keyof SimulationParams, factor: number, days: number, label: string): void;
  addEvolution(points: number): void;
}

export interface EventOption {
  label: string;
  /** Consecuencia que ve el jugador antes de elegir. */
  effect: string;
  /** Si devuelve false la opción se muestra deshabilitada (por ejemplo, sin dinero). */
  available?: (snap: GameSnapshot) => boolean;
  /** Aplica la decisión y devuelve un resumen para las noticias. */
  apply(api: EventApi, params: EventParams, snap: GameSnapshot): string;
}

export interface GameEvent {
  id: string;
  icon: string;
  title: string;
  speaker: CharacterId;
  modes: GameMode[];
  /** Devuelve los parámetros del evento, o null si ahora no tiene sentido. */
  prepare(snap: GameSnapshot): EventParams | null;
  text(params: EventParams): string;
  options: [EventOption, EventOption];
}

const byId = (snap: GameSnapshot, id: string) => snap.cantons.find(c => c.id === id);
const mostInfected = (snap: GameSnapshot) =>
  [...snap.cantons].sort((a, b) => b.rate - a.rate || b.zombie - a.zombie)[0];

export const GAME_EVENTS: GameEvent[] = [
  // ---------------------------------------------------------------- Gobierno
  {
    id: 'barco-manta',
    icon: '🚢',
    title: 'Un barco pide atracar en Manta',
    speaker: 'estratega',
    modes: ['government'],
    prepare: () => ({ cantonId: 'manta' }),
    text: () =>
      'Un carguero con 300 tripulantes pide atracar en el puerto de Manta. Trae mercancía urgente... y nadie sabe si hay infectados a bordo.',
    options: [
      {
        label: 'Permitir',
        effect: `+${formatMoney(150_000)} · llegan 60 infectados a Manta`,
        apply: api => {
          api.addBudget(150_000);
          api.addZombies('manta', 60);
          return 'El barco atracó: entró dinero, pero también 60 infectados.';
        }
      },
      {
        label: 'Rechazar',
        effect: `−${formatMoney(40_000)} en comercio perdido`,
        apply: api => {
          api.addBudget(-40_000);
          return 'El barco fue rechazado. El puerto pierde ingresos.';
        }
      }
    ]
  },
  {
    id: 'laboratorio-utm',
    icon: '🔬',
    title: 'La UTM ofrece su laboratorio',
    speaker: 'quimica',
    modes: ['government'],
    prepare: () => ({}),
    text: () =>
      'La Universidad Técnica de Manabí ofrece su laboratorio de biología molecular para acelerar la cura. Necesitan financiamiento para operar las 24 horas.',
    options: [
      {
        label: `Aceptar (${formatMoney(200_000)})`,
        effect: '+8% de cura y +0,3% de investigación por día',
        available: snap => snap.budget >= 200_000,
        apply: api => {
          api.addBudget(-200_000);
          api.addCure(8);
          api.addResearchRate(0.3);
          return 'El laboratorio de la UTM trabaja día y noche en la cura.';
        }
      },
      {
        label: 'Rechazar',
        effect: 'Sin cambios',
        apply: () => 'La UTM sigue con sus propios recursos.'
      }
    ]
  },
  {
    id: 'protestas-portoviejo',
    icon: '📢',
    title: 'Protestas en Portoviejo',
    speaker: 'streamer',
    modes: ['government'],
    prepare: snap => (byId(snap, 'portoviejo')?.quarantine ? { cantonId: 'portoviejo' } : null),
    text: () =>
      'Miles de personas protestan en Portoviejo contra la cuarentena: los negocios están cerrados y la gente no tiene cómo comer.',
    options: [
      {
        label: 'Levantar la cuarentena',
        effect: `Se calman las protestas · +${formatMoney(30_000)} · Portoviejo sin cuarentena`,
        apply: api => {
          api.setQuarantine('portoviejo', false);
          api.addBudget(30_000);
          return 'Portoviejo levanta la cuarentena y reabre el comercio.';
        }
      },
      {
        label: 'Mantenerla',
        effect: `−${formatMoney(60_000)} en seguridad · contagio +10% por 3 días`,
        apply: api => {
          api.addBudget(-60_000);
          api.addModifier('beta', 1.1, 3, 'Disturbios en Portoviejo');
          return 'La cuarentena se mantiene. Hay disturbios en las calles.';
        }
      }
    ]
  },
  {
    id: 'streamer-fake',
    icon: '📱',
    title: 'Un streamer difunde noticias falsas',
    speaker: 'streamer',
    modes: ['government'],
    prepare: () => ({}),
    text: () =>
      'Un streamer con dos millones de seguidores asegura que el virus se cura con agua de coco y llama a ignorar las medidas sanitarias.',
    options: [
      {
        label: 'Desmentir en cadena nacional',
        effect: `−${formatMoney(40_000)}`,
        apply: api => {
          api.addBudget(-40_000);
          return 'El gobierno desmiente el bulo en cadena nacional.';
        }
      },
      {
        label: 'Ignorarlo',
        effect: 'Contagio +20% durante 5 días',
        apply: api => {
          api.addModifier('beta', 1.2, 5, 'Bulo viral');
          return 'El bulo se hace viral y la gente relaja las precauciones.';
        }
      }
    ]
  },
  {
    id: 'donacion-ops',
    icon: '🤝',
    title: 'Ayuda internacional con condiciones',
    speaker: 'estratega',
    modes: ['government'],
    prepare: () => ({}),
    text: () =>
      `La Organización Panamericana de la Salud ofrece ${formatMoney(300_000)} de ayuda inmediata, pero exige auditar cada gasto, lo que reduce tu ingreso diario.`,
    options: [
      {
        label: 'Aceptar',
        effect: `+${formatMoney(300_000)} ahora · −${formatMoney(10_000)} por día`,
        apply: api => {
          api.addBudget(300_000);
          api.addBudgetPerDay(-10_000);
          return 'Llega la ayuda internacional, con auditoría incluida.';
        }
      },
      {
        label: 'Rechazar',
        effect: 'Sin cambios',
        apply: () => 'Manabí rechaza la ayuda condicionada.'
      }
    ]
  },
  {
    id: 'fiestas-patronales',
    icon: '🎉',
    title: 'Fiestas patronales',
    speaker: 'lider',
    modes: ['government'],
    prepare: snap => {
      const target = snap.cantons
        .filter(c => c.zombie >= 1 && c.rate < 0.3)
        .sort((a, b) => b.population - a.population)[0];
      if (!target) return null;
      return { cantonId: target.id, canton: target.name, amount: Math.max(80, Math.round(target.zombie * 0.25)) };
    },
    text: p => `Se acercan las fiestas patronales de ${p.canton} y miles de personas quieren celebrar como cada año.`,
    options: [
      {
        label: 'Cancelar las fiestas',
        effect: `−${formatMoney(30_000)} en indemnizaciones`,
        apply: (api, p) => {
          api.addBudget(-30_000);
          return `Se cancelan las fiestas de ${p.canton}.`;
        }
      },
      {
        label: 'Permitirlas',
        effect: `+${formatMoney(60_000)} en turismo · nuevos infectados en el cantón`,
        apply: (api, p) => {
          api.addBudget(60_000);
          api.addZombies(String(p.cantonId), Number(p.amount));
          return `Las fiestas de ${p.canton} dejan ${formatNumber(Number(p.amount))} nuevos infectados.`;
        }
      }
    ]
  },
  {
    id: 'fuga-hospital',
    icon: '🏥',
    title: 'Fuga en el hospital',
    speaker: 'medico',
    modes: ['government'],
    prepare: snap => {
      const c = mostInfected(snap);
      if (!c || c.rate < 0.01) return null;
      return { cantonId: c.id, canton: c.name, amount: Math.round(c.population * 0.02) };
    },
    text: p => `Pacientes infectados escaparon del hospital de ${p.canton} y se dispersan por la ciudad.`,
    options: [
      {
        label: `Enviar militares (${formatMoney(50_000)})`,
        effect: 'Militares al 60% en el cantón',
        available: snap => snap.budget >= 50_000,
        apply: (api, p) => {
          api.addBudget(-50_000);
          api.setMilitary(String(p.cantonId), 0.6);
          return `Militares rodean el hospital de ${p.canton}.`;
        }
      },
      {
        label: 'Dejarlo a la policía local',
        effect: 'Más infectados en el cantón (2% de la población)',
        apply: (api, p) => {
          api.addZombies(String(p.cantonId), Number(p.amount));
          return `La policía de ${p.canton} no logra contener la fuga.`;
        }
      }
    ]
  },
  {
    id: 'pescadores-jaramijo',
    icon: '🎣',
    title: 'Los pescadores de Jaramijó',
    speaker: 'medico',
    modes: ['government'],
    prepare: () => ({}),
    text: () =>
      'Los pescadores artesanales de Jaramijó necesitan salir al mar o sus familias pasarán hambre esta semana.',
    options: [
      {
        label: 'Permitir la pesca',
        effect: `+${formatMoney(50_000)} · movilidad +25% por 4 días`,
        apply: api => {
          api.addBudget(50_000);
          api.addModifier('mu', 1.25, 4, 'Pesca artesanal');
          return 'La flota de Jaramijó vuelve al mar.';
        }
      },
      {
        label: 'Prohibirla y dar bonos',
        effect: `−${formatMoney(70_000)}`,
        apply: api => {
          api.addBudget(-70_000);
          return 'El gobierno entrega bonos a los pescadores.';
        }
      }
    ]
  },
  {
    id: 'vacuna-experimental',
    icon: '💉',
    title: 'Vacuna experimental',
    speaker: 'quimica',
    modes: ['government'],
    prepare: () => ({}),
    text: () =>
      'Una investigadora independiente ofrece una vacuna experimental. Los datos son prometedores, pero la muestra es pequeña.',
    options: [
      {
        label: `Probarla (${formatMoney(100_000)})`,
        effect: '50%: +15% de cura · 50%: no funciona',
        available: snap => snap.budget >= 100_000,
        apply: api => {
          api.addBudget(-100_000);
          if (Math.random() < 0.5) {
            api.addCure(15);
            return '¡La vacuna experimental funcionó! La cura avanza un 15%.';
          }
          return 'La vacuna experimental no tuvo efecto.';
        }
      },
      {
        label: 'Rechazar',
        effect: 'Sin cambios',
        apply: () => 'Se descarta la vacuna experimental.'
      }
    ]
  },
  {
    id: 'bono-militar',
    icon: '🪖',
    title: 'Las tropas piden un bono',
    speaker: 'estratega',
    modes: ['government'],
    prepare: snap => (snap.cantons.some(c => c.military) ? {} : null),
    text: () => 'Las tropas desplegadas exigen un bono de riesgo. Sin él, la moral se desploma.',
    options: [
      {
        label: `Pagar (${formatMoney(80_000)})`,
        effect: 'Militares 20% más efectivos durante 10 días',
        available: snap => snap.budget >= 80_000,
        apply: api => {
          api.addBudget(-80_000);
          api.addModifier('militaryEffectiveness', 1.2, 10, 'Bono de riesgo');
          return 'Las tropas reciben su bono y redoblan esfuerzos.';
        }
      },
      {
        label: 'Negarse',
        effect: 'Militares 30% menos efectivos durante 7 días',
        apply: api => {
          api.addModifier('militaryEffectiveness', 0.7, 7, 'Tropas desmoralizadas');
          return 'Las tropas, desmoralizadas, bajan el ritmo.';
        }
      }
    ]
  },

  // ---------------------------------------------------------------- Virus
  {
    id: 'bus-el-carmen',
    icon: '🚌',
    title: 'Un bus hacia El Carmen',
    speaker: 'hacker',
    modes: ['virus'],
    prepare: () => ({}),
    text: () => 'Un vendedor ambulante infectado sube a un bus lleno rumbo a El Carmen.',
    options: [
      {
        label: 'Contagiar a los pasajeros',
        effect: '+150 infectados en El Carmen · la cura avanza +3% por la alarma',
        apply: api => {
          api.addZombies('el-carmen', 150);
          api.addCure(3);
          return 'Brote en el bus: El Carmen recibe 150 infectados.';
        }
      },
      {
        label: 'Pasar desapercibido',
        effect: '+3 puntos de evolución',
        apply: api => {
          api.addEvolution(3);
          return 'El virus viaja en silencio.';
        }
      }
    ]
  },
  {
    id: 'camaras-termicas',
    icon: '🌡️',
    title: 'Cámaras térmicas en las terminales',
    speaker: 'estratega',
    modes: ['virus'],
    prepare: () => ({}),
    text: () => 'El gobierno instala cámaras térmicas en todas las terminales terrestres para detectar la fiebre.',
    options: [
      {
        label: 'Mutar para bajar la fiebre (−4 pts)',
        effect: 'La movilidad no se ve afectada',
        available: snap => snap.evolutionPoints >= 4,
        apply: api => {
          api.addEvolution(-4);
          return 'El virus muta y la fiebre deja de delatarlo.';
        }
      },
      {
        label: 'Ignorarlas',
        effect: 'Movilidad −40% durante 8 días',
        apply: api => {
          api.addModifier('mu', 0.6, 8, 'Cámaras térmicas');
          return 'Las cámaras detectan a los infectados en las terminales.';
        }
      }
    ]
  },
  {
    id: 'lluvias-chone',
    icon: '🌧️',
    title: 'Inundaciones en Chone',
    speaker: 'medico',
    modes: ['virus'],
    prepare: snap => {
      const chone = byId(snap, 'chone');
      return chone ? { amount: Math.round(chone.population * 0.03) } : null;
    },
    text: () => 'Lluvias torrenciales inundan Chone y miles de personas se refugian en albergues abarrotados.',
    options: [
      {
        label: 'Atacar los albergues',
        effect: '+3% de Chone infectado · la cura avanza +2%',
        apply: (api, p) => {
          api.addZombies('chone', Number(p.amount));
          api.addCure(2);
          return 'El virus llega a los albergues de Chone.';
        }
      },
      {
        label: 'Esperar',
        effect: '+2 puntos de evolución',
        apply: api => {
          api.addEvolution(2);
          return 'El virus espera su momento.';
        }
      }
    ]
  },
  {
    id: 'concierto-portoviejo',
    icon: '🎤',
    title: 'Concierto masivo en Portoviejo',
    speaker: 'streamer',
    modes: ['virus'],
    prepare: () => ({}),
    text: () => 'Un concierto gratuito reúne a 20.000 personas en Portoviejo. ¡Todo el chat va a estar ahí!',
    options: [
      {
        label: 'Infiltrarse',
        effect: '+400 infectados en Portoviejo',
        apply: api => {
          api.addZombies('portoviejo', 400);
          return 'El concierto se convierte en un foco de contagio.';
        }
      },
      {
        label: 'Mutar en silencio',
        effect: 'Contagio +15% durante 5 días',
        apply: api => {
          api.addModifier('beta', 1.15, 5, 'Mutación silenciosa');
          return 'El virus aprovecha la multitud para mutar.';
        }
      }
    ]
  }
];

export const EVENTS_BY_ID = new Map(GAME_EVENTS.map(e => [e.id, e]));

/** Elige un evento aplicable que no se haya usado (si ya salieron todos, se reinicia la lista). */
export function pickEvent(
  snap: GameSnapshot,
  usedIds: string[],
  rand: () => number = Math.random
): { event: GameEvent; params: EventParams } | null {
  const candidates = (pool: GameEvent[]) =>
    pool
      .filter(e => e.modes.includes(snap.mode))
      .map(event => ({ event, params: event.prepare(snap) }))
      .filter((c): c is { event: GameEvent; params: EventParams } => c.params !== null);

  let options = candidates(GAME_EVENTS.filter(e => !usedIds.includes(e.id)));
  if (options.length === 0) options = candidates(GAME_EVENTS);
  if (options.length === 0) return null;
  return options[Math.floor(rand() * options.length)];
}
