// Frases cortas que dicen los personajes cuando pasa algo en la partida.
// Cada disparador tiene líneas de varios personajes, cada uno con su personalidad.
import type { CharacterId } from './characters';

export type BarkTrigger =
  | 'newCanton'
  | 'cantonOver50'
  | 'budgetLow'
  | 'cure25'
  | 'cure50'
  | 'cure75'
  | 'boss'
  | 'bossCombat'
  | 'missionDone'
  | 'waveCleared'
  | 'lowHealth';

export interface Bark {
  characterId: CharacterId;
  text: string;
}

type Line = [CharacterId, string];

// {canton}, {boss}, {mission} y {wave} se reemplazan con los datos del momento
const LINES: Record<BarkTrigger, Line[]> = {
  newCanton: [
    ['hacker', 'Nueva conexión detectada: {canton}. Lástima que sea el virus y no el wifi.'],
    ['hacker', '{canton} acaba de entrar al grupo. Nadie lo invitó.'],
    ['streamer', '¡Chat, chat! Primer caso confirmado en {canton}, esto se está poniendo feo 😱'],
    ['medico', 'Llegó a {canton}. Hay que preparar los hospitales ya.']
  ],
  cantonOver50: [
    ['medico', 'Más de la mitad de {canton} está infectada... no tenemos camas para tanta gente.'],
    ['medico', '{canton} superó el 50%. Por favor, hagamos algo antes de que sea tarde.'],
    ['hacker', '{canton} al 50%. Felicidades, el virus subió de nivel.'],
    ['streamer', 'Estamos EN VIVO desde {canton} y... chat, esto ya es zona roja total.']
  ],
  budgetLow: [
    ['estratega', 'El presupuesto bajó de $100.000. Cada dólar ahora es una pieza que no podemos perder.'],
    ['estratega', 'Fondos críticos. Calculo pocos movimientos antes de quedarnos sin opciones.'],
    ['lider', 'Nos queda poco dinero, pero no la voluntad. Gastemos con cabeza.']
  ],
  cure25: [
    ['quimica', 'Cura al 25%. Secuencia viral identificada. Margen de error aceptable.'],
    ['lider', '¡Un cuarto del camino a la cura! Sigamos así, equipo.']
  ],
  cure50: [
    ['quimica', 'Cura al 50%. La proteína de unión ya no tiene secretos. Proceder a síntesis.'],
    ['streamer', '¡Chat, la cura ya va por la MITAD! Dejen sus likes para la ciencia 💜']
  ],
  cure75: [
    ['quimica', 'Cura al 75%. Pruebas clínicas en curso. Probabilidad de éxito: alta.'],
    ['medico', '75%... ya casi. Aguanten un poco más, por favor.']
  ],
  boss: [
    ['lider', '¡{boss} apareció en {canton}! Que nadie pierda la calma: vamos a resistir.'],
    ['hacker', 'Alerta: {boss} en {canton}. Esto no estaba en el manual de usuario.'],
    ['streamer', '¡NO PUEDE SER! {boss} en {canton}, chat, esto es contenido de terror en vivo.']
  ],
  bossCombat: [
    ['lider', '¡Un jefe se acerca! Mantén la distancia y usa la Q cuando lo tengas encima.'],
    ['hacker', 'Jefe a la vista. Su barra de vida es más grande que mi lista de bugs.'],
    ['estratega', 'Jefe detectado. Dispara y retrocede: el tiempo juega a tu favor.']
  ],
  missionDone: [
    ['estratega', 'Misión "{mission}" completada. Recompensa cobrada según lo previsto.'],
    ['lider', '¡Misión "{mission}" cumplida! Así se hace, equipo.'],
    ['streamer', '¡Misión "{mission}" completada! El chat explota de emoción 🎉']
  ],
  waveCleared: [
    ['lider', '¡Oleada {wave} superada! Respira, que viene otra.'],
    ['hacker', 'Oleada {wave} eliminada. Próximo parche de zombies cargando...']
  ],
  lowHealth: [
    ['medico', '¡Estás muy herido! Aléjate de ellos un momento.'],
    ['lider', '¡No te rindas! Usa la Q para abrirte paso.']
  ]
};

export function barkFor(
  trigger: BarkTrigger,
  vars: Record<string, string | number> = {},
  rand: () => number = Math.random
): Bark {
  const lines = LINES[trigger];
  const [characterId, template] = lines[Math.floor(rand() * lines.length)];
  const text = template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
  return { characterId, text };
}
