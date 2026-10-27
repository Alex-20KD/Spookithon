// Cola de mensajes de los personajes: como máximo uno cada 6 segundos, sin amontonarse.
import { create } from 'zustand';
import type { Bark, BarkTrigger } from '../game/barks';
import { barkFor } from '../game/barks';

export const MESSAGE_GAP_MS = 6000;
export const MESSAGE_DURATION_MS = 5500;
const MAX_AGE_MS = 20000;
const MAX_QUEUE = 4;

export interface CharacterMessage extends Bark {
  id: number;
  trigger: BarkTrigger;
  createdAt: number;
  shownAt?: number;
}

export interface QueueState {
  queue: CharacterMessage[];
  current: CharacterMessage | null;
  lastShownAt: number;
}

/** Lógica pura de la cola, separada para poder probarla con tiempos simulados. */
export function enqueue(state: QueueState, msg: CharacterMessage): QueueState {
  // Un solo mensaje pendiente por tipo de disparador: el nuevo reemplaza al viejo
  const queue = state.queue.filter(m => m.trigger !== msg.trigger);
  queue.push(msg);
  return { ...state, queue: queue.slice(-MAX_QUEUE) };
}

export function tickQueue(state: QueueState, now: number): QueueState {
  let { current } = state;
  if (current && now - (current.shownAt ?? now) >= MESSAGE_DURATION_MS) current = null;
  const queue = state.queue.filter(m => now - m.createdAt <= MAX_AGE_MS);
  if (!current && queue.length > 0 && now - state.lastShownAt >= MESSAGE_GAP_MS) {
    const [next, ...rest] = queue;
    return { queue: rest, current: { ...next, shownAt: now }, lastShownAt: now };
  }
  return { ...state, queue, current };
}

interface CharacterStore extends QueueState {
  say(trigger: BarkTrigger, vars?: Record<string, string | number>): void;
  tick(now?: number): void;
  dismiss(): void;
  clear(): void;
}

let nextId = 1;

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  queue: [],
  current: null,
  lastShownAt: -Infinity,

  say: (trigger, vars) => {
    const msg: CharacterMessage = { ...barkFor(trigger, vars), id: nextId++, trigger, createdAt: Date.now() };
    set(enqueue(get(), msg));
    get().tick();
  },

  tick: (now = Date.now()) => {
    const s = get();
    const next = tickQueue(s, now);
    if (next.current !== s.current || next.queue.length !== s.queue.length) set(next);
  },

  dismiss: () => set({ current: null }),

  clear: () => set({ queue: [], current: null, lastShownAt: -Infinity })
}));
