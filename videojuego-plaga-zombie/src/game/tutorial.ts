// Guiones del tutorial interactivo y su registro en localStorage
import type { CharacterId } from './characters';
import type { GameState } from '../store/game-store';

export type TutorialMode = 'government' | 'virus' | 'combat';

export interface TutorialStep {
  speaker: CharacterId;
  text: string;
  /** Valor de data-tour del elemento a resaltar (sin valor: pantalla completa). */
  target?: string;
  /** Tarea real: el paso solo avanza cuando `done` se cumple. */
  task?: { label: string; done: (s: GameState) => boolean };
  /** Se ejecuta al entrar al paso (por ejemplo, quitar la selección del mapa). */
  onEnter?: (s: GameState) => void;
}

const KEY = (mode: TutorialMode) => `tutorial-seen-${mode}`;

export function hasSeenTutorial(mode: TutorialMode): boolean {
  try {
    return localStorage.getItem(KEY(mode)) === 'true';
  } catch {
    return false;
  }
}

export function markTutorialSeen(mode: TutorialMode): void {
  try {
    localStorage.setItem(KEY(mode), 'true');
  } catch {
    // sin almacenamiento el tutorial volverá a salir la próxima vez
  }
}

const selectManta: TutorialStep['task'] = {
  label: 'Haz clic en Manta',
  done: s => s.selectedCantonId === 'manta'
};

const startSimulation: TutorialStep['task'] = {
  label: 'Pon la simulación en marcha',
  done: s => s.simulationSpeed !== 'paused'
};

export const GOVERNMENT_TUTORIAL: TutorialStep[] = [
  {
    speaker: 'lider',
    text: 'Bienvenido al centro de mando. Soy el Líder. El brote empezó en Manta y toda la provincia depende de nosotros. Te presento al equipo: cada uno te enseñará lo suyo.'
  },
  {
    speaker: 'hacker',
    target: 'map',
    text: 'Hackeé los satélites, de nada. Este es Manabí: el rojo es infección y cada punto es un foco. Usa la rueda para hacer zoom y arrastra para moverte.'
  },
  {
    speaker: 'hacker',
    target: 'map',
    text: 'Primera prueba de inteligencia: haz clic en Manta. Es el cantón de la costa oeste que está, literalmente, en llamas.',
    task: selectManta,
    onEnter: s => s.selectCanton(null)
  },
  {
    speaker: 'hacker',
    target: 'stats',
    text: 'Aquí van los números globales: sanos, zombies, eliminados y la tasa de infección. Si la gráfica roja sube, no es un bug, es un problema.'
  },
  {
    speaker: 'medico',
    target: 'actions',
    text: 'Soy el Médico. Estas son tus acciones en el cantón seleccionado. La gente de Manta no puede esperar: aplica una cuarentena, por favor.',
    task: { label: 'Aplica una cuarentena', done: s => s.counters.quarantines > 0 }
  },
  {
    speaker: 'medico',
    target: 'actions',
    text: 'Los militares eliminan zombies más rápido, las campañas reducen el contagio y cerrar vías aísla al cantón. Pasa el mouse sobre cada acción para ver su costo y su efecto.'
  },
  {
    speaker: 'quimica',
    target: 'cure',
    text: 'Química. Esta barra es la cura. Al 100% ganamos. Cada inversión suma 0,5% inmediato y 0,2% por día, de forma permanente. Es matemática simple.'
  },
  {
    speaker: 'quimica',
    target: 'research-btn',
    text: 'Invierte en investigación. Ahora. Cada día sin financiamiento es tiempo perdido.',
    task: { label: 'Invierte en investigación', done: s => s.counters.research > 0 }
  },
  {
    speaker: 'streamer',
    target: 'news',
    text: '¡Holaaa, chat! Aquí verás las noticias en vivo. Y ojo: a veces pasan cosas y tendrás que decidir entre dos opciones. ¡Cada decisión tiene consecuencias!'
  },
  {
    speaker: 'estratega',
    target: 'budget',
    text: 'Estratega de la PUCE. Este es tu presupuesto: entra dinero cada día y cada acción cuesta. Si baja de $100.000, piensa dos veces antes de mover una pieza.'
  },
  {
    speaker: 'estratega',
    target: 'missions',
    text: 'Las misiones dan dinero extra. Cúmplelas y financias la siguiente jugada.'
  },
  {
    speaker: 'lider',
    target: 'advisor',
    text: 'Si dudas, pide consejo. Cualquiera de nosotros analizará la partida y te dirá qué haría.'
  },
  {
    speaker: 'estratega',
    target: 'speed',
    text: 'Último paso: el tiempo. Pausa cuando necesites pensar y acelera cuando todo esté bajo control. Pon la simulación en marcha.',
    task: startSimulation
  }
];

export const VIRUS_TUTORIAL: TutorialStep[] = [
  {
    speaker: 'lider',
    text: 'Así que hoy juegas del otro lado. Soy el Líder: tú eres el virus y nosotros la resistencia. Te enseñaremos cómo funciona... para que la pelea sea justa.'
  },
  {
    speaker: 'hacker',
    target: 'map',
    text: 'Este es tu territorio de caza, aunque me duela decirlo. Rojo = infección. Rueda para zoom, arrastrar para moverte.'
  },
  {
    speaker: 'hacker',
    target: 'map',
    text: 'Haz clic en Manta, tu paciente cero. Sí, ese cantón que ya estás arruinando.',
    task: selectManta,
    onEnter: s => s.selectCanton(null)
  },
  {
    speaker: 'hacker',
    target: 'stats',
    text: 'Tus números: sanos, zombies, eliminados y tasa de infección. Para ti, que suban es bueno. Qué mundo tan raro.'
  },
  {
    speaker: 'medico',
    target: 'mutations',
    text: 'Estas son tus mutaciones... por favor no las compres todas. Cuestan puntos de evolución: ganas más mientras más zombies hay.'
  },
  {
    speaker: 'quimica',
    target: 'cure',
    text: 'Química. Mientras tanto, nosotros investigamos la cura. Si llega al 100%, pierdes. Probabilidad actual de que lo logremos: alta.'
  },
  {
    speaker: 'streamer',
    target: 'news',
    text: '¡Chat, el virus está en el stream! Aquí salen las noticias y los eventos: elige bien, que cada decisión cambia la partida.'
  },
  {
    speaker: 'estratega',
    target: 'missions',
    text: 'Tus misiones dan puntos de evolución. El gobierno también responde: pondrá cuarentenas y enviará militares.'
  },
  {
    speaker: 'lider',
    target: 'advisor',
    text: 'Puedes pedirnos consejo. Te diremos la verdad... aunque nos duela.'
  },
  {
    speaker: 'estratega',
    target: 'speed',
    text: 'El tiempo corre a favor de la cura. Pon la simulación en marcha y veamos de qué eres capaz.',
    task: startSimulation
  }
];
