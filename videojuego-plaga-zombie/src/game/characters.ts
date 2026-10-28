// Los seis personajes que acompañan al jugador (retratos en public/assets/personajes/)

import { assetUrl } from '../utils/assetUrl';

export type CharacterId = 'lider' | 'hacker' | 'medico' | 'quimica' | 'streamer' | 'estratega';

export interface Character {
  id: CharacterId;
  name: string;
  role: string;
  portrait: string;
  color: string;
  /** Cómo habla: se usa en los diálogos y como instrucción para el asesor con IA. */
  personality: string;
  /** De qué sabe: orienta los consejos del asesor. */
  focus: string;
}

export const CHARACTERS: Record<CharacterId, Character> = {
  lider: {
    id: 'lider',
    name: 'El Líder',
    role: 'Coordinador de la resistencia',
    portrait: assetUrl('assets/personajes/lider.png'),
    color: '#ffb347',
    personality: 'Motivador, firme y cercano. Habla en plural ("vamos", "podemos") y siempre cierra con ánimo.',
    focus: 'la prioridad general del momento y la moral del equipo'
  },
  hacker: {
    id: 'hacker',
    name: 'El Hacker',
    role: 'Ing. de Sistemas · mapas y datos',
    portrait: assetUrl('assets/personajes/hacker.png'),
    color: '#4dd2ff',
    personality: 'Sarcástico y rápido. Usa jerga informática y bromas secas, pero sus datos siempre son exactos.',
    focus: 'el mapa, cómo se propaga el brote entre cantones vecinos y dónde cortar las rutas'
  },
  medico: {
    id: 'medico',
    name: 'El Médico',
    role: 'Medicina · acciones sanitarias',
    portrait: assetUrl('assets/personajes/medico.png'),
    color: '#7dff9a',
    personality: 'Preocupado y humano. Piensa primero en los pacientes y transmite urgencia sin perder la calma.',
    focus: 'cuarentenas, militares, campañas y cierre de vías en los cantones más afectados'
  },
  quimica: {
    id: 'quimica',
    name: 'La Química',
    role: 'Investigación de la cura',
    portrait: assetUrl('assets/personajes/gotica.png'),
    color: '#c78bff',
    personality: 'Fría, precisa y científica. Habla con cifras, tasas y probabilidades; nada de emociones.',
    focus: 'el progreso de la cura, la velocidad de investigación y cuánto conviene invertir'
  },
  streamer: {
    id: 'streamer',
    name: 'La Streamer',
    role: 'Comunicación · noticias en vivo',
    portrait: assetUrl('assets/personajes/egirl.png'),
    color: '#ff6ec7',
    personality: 'Habla como si transmitiera en vivo: saluda al chat, usa expresiones de streaming y mucha energía.',
    focus: 'las noticias, la opinión pública y los eventos con decisiones'
  },
  estratega: {
    id: 'estratega',
    name: 'El Estratega',
    role: 'PUCE · presupuesto y tiempos',
    portrait: assetUrl('assets/personajes/estratega.png'),
    color: '#5c9dff',
    personality: 'Calculador y metódico. Piensa en costos, plazos y probabilidades, como en una partida de ajedrez.',
    focus: 'el presupuesto, el ritmo de la simulación y las misiones'
  }
};

export const CHARACTER_LIST: Character[] = Object.values(CHARACTERS);
