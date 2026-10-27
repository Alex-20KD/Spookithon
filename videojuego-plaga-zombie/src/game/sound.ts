// Efectos de sonido cortos. Si existe public/assets/audio/sfx-<nombre>.mp3 se usa ese archivo;
// si no, se sintetiza el sonido con la Web Audio API.

export type SoundName = 'action' | 'error' | 'infect' | 'event' | 'mission' | 'message' | 'victory' | 'defeat' | 'boss' | 'click';

const MUTE_KEY = 'sound-muted';
let ctx: AudioContext | null = null;
let muted = readMuted();
const fileStatus = new Map<SoundName, 'checking' | 'yes' | 'no'>();
const lastPlayed = new Map<SoundName, number>();

function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, String(value));
  } catch {
    // sin almacenamiento: la preferencia dura solo esta sesión
  }
}

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneStep {
  freq: number;
  to?: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

const RECIPES: Record<SoundName, ToneStep[]> = {
  click: [{ freq: 660, at: 0, dur: 0.05, type: 'square', gain: 0.05 }],
  action: [
    { freq: 520, at: 0, dur: 0.08, type: 'triangle' },
    { freq: 780, at: 0.07, dur: 0.12, type: 'triangle' }
  ],
  error: [{ freq: 180, to: 120, at: 0, dur: 0.2, type: 'sawtooth', gain: 0.06 }],
  infect: [{ freq: 220, to: 70, at: 0, dur: 0.45, type: 'sawtooth', gain: 0.07 }],
  event: [
    { freq: 392, at: 0, dur: 0.15, type: 'square', gain: 0.05 },
    { freq: 311, at: 0.16, dur: 0.15, type: 'square', gain: 0.05 },
    { freq: 392, at: 0.32, dur: 0.25, type: 'square', gain: 0.05 }
  ],
  mission: [
    { freq: 523, at: 0, dur: 0.1, type: 'triangle' },
    { freq: 659, at: 0.1, dur: 0.1, type: 'triangle' },
    { freq: 784, at: 0.2, dur: 0.22, type: 'triangle' }
  ],
  message: [{ freq: 880, to: 990, at: 0, dur: 0.09, type: 'sine', gain: 0.05 }],
  victory: [
    { freq: 523, at: 0, dur: 0.18, type: 'triangle' },
    { freq: 659, at: 0.18, dur: 0.18, type: 'triangle' },
    { freq: 784, at: 0.36, dur: 0.18, type: 'triangle' },
    { freq: 1046, at: 0.54, dur: 0.5, type: 'triangle' }
  ],
  defeat: [
    { freq: 392, to: 370, at: 0, dur: 0.35, type: 'sawtooth', gain: 0.06 },
    { freq: 330, to: 310, at: 0.35, dur: 0.35, type: 'sawtooth', gain: 0.06 },
    { freq: 262, to: 196, at: 0.7, dur: 0.8, type: 'sawtooth', gain: 0.06 }
  ],
  boss: [
    { freq: 110, to: 55, at: 0, dur: 0.8, type: 'sawtooth', gain: 0.09 },
    { freq: 165, to: 82, at: 0.05, dur: 0.75, type: 'square', gain: 0.04 }
  ]
};

function synth(name: SoundName): void {
  const ac = audioContext();
  if (!ac) return;
  const start = ac.currentTime + 0.01;
  for (const step of RECIPES[name]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = step.type ?? 'sine';
    osc.frequency.setValueAtTime(step.freq, start + step.at);
    if (step.to) osc.frequency.exponentialRampToValueAtTime(step.to, start + step.at + step.dur);
    const peak = step.gain ?? 0.08;
    gain.gain.setValueAtTime(0.0001, start + step.at);
    gain.gain.exponentialRampToValueAtTime(peak, start + step.at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + step.at + step.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(start + step.at);
    osc.stop(start + step.at + step.dur + 0.02);
  }
}

function checkFile(name: SoundName): void {
  if (fileStatus.has(name) || typeof fetch === 'undefined') return;
  fileStatus.set(name, 'checking');
  fetch(`/assets/audio/sfx-${name}.mp3`, { method: 'HEAD' })
    .then(r => {
      // El servidor de Vite responde index.html para rutas inexistentes: hay que mirar el tipo
      const type = r.headers.get('content-type') ?? '';
      fileStatus.set(name, r.ok && type.startsWith('audio') ? 'yes' : 'no');
    })
    .catch(() => fileStatus.set(name, 'no'));
}

/** Reproduce un efecto. Los repetidos en menos de 150 ms se ignoran. */
export function playSound(name: SoundName): void {
  if (muted || typeof window === 'undefined') return;
  const now = Date.now();
  if (now - (lastPlayed.get(name) ?? 0) < 150) return;
  lastPlayed.set(name, now);

  checkFile(name);
  if (fileStatus.get(name) === 'yes') {
    const audio = new Audio(`/assets/audio/sfx-${name}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(() => synth(name));
    return;
  }
  try {
    synth(name);
  } catch {
    // el navegador puede bloquear el audio hasta la primera interacción
  }
}
