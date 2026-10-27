/**
 * Motor del Modo Combate: supervivencia por oleadas vista desde arriba.
 * Lógica pura (sin DOM) para poder probarla; el componente CombatMode la dibuja.
 */

export type ZombieKind = 'walker' | 'runner' | 'tank' | 'boss';

export interface Zombie {
  id: number;
  kind: ZombieKind;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  hitFlash: number;
  name?: string;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface Player {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  angle: number;
  cooldown: number;
  invulnerable: number;
}

/** Sucesos que el componente usa para sonidos y mensajes de los personajes. */
export type CombatEvent = 'boss' | 'waveCleared' | 'special' | 'hit' | 'kill' | 'bossKilled';

export interface CombatOptions {
  speedMultiplier?: number;
  damageMultiplier?: number;
}

export interface CombatState {
  width: number;
  height: number;
  player: Player;
  zombies: Zombie[];
  bullets: Bullet[];
  wave: number;
  toSpawn: number;
  spawnTimer: number;
  waveBreak: number; // segundos de respiro antes de la siguiente oleada
  kills: number;
  score: number;
  over: boolean;
  nextId: number;
  muzzleFlash: number;
  specialCooldown: number;
  shockwave: number; // tiempo restante de la animación de la onda
  speedMultiplier: number;
  damageMultiplier: number;
  events: CombatEvent[];
}

export interface CombatInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shooting: boolean;
  aimX: number;
  aimY: number;
  /** Habilidad especial (Q). El componente lo pone en true un solo cuadro. */
  special?: boolean;
}

export const PLAYER_SPEED = 230;
export const FIRE_COOLDOWN = 0.16;
export const BULLET_SPEED = 680;
export const BULLET_LIFE = 1.2;
export const WAVE_BREAK = 2.5;
export const SPECIAL_COOLDOWN = 8;
export const SPECIAL_RADIUS = 170;
export const SPECIAL_DAMAGE = 3;
export const SPECIAL_KNOCKBACK = 130;
export const BOSS_EVERY = 5;
const FIRST_WAVE_SPEED = 0.7;

const KINDS: Record<ZombieKind, { r: number; hp: number; speed: number; damage: number; points: number }> = {
  walker: { r: 14, hp: 2, speed: 60, damage: 12, points: 10 },
  runner: { r: 11, hp: 1, speed: 125, damage: 8, points: 15 },
  tank: { r: 22, hp: 8, speed: 40, damage: 25, points: 50 },
  boss: { r: 34, hp: 40, speed: 48, damage: 30, points: 400 }
};

const BOSS_NAMES = ['La Reina del Luto', 'La Matriarca Viral', 'La Abominación', 'El Paciente Cero'];

/** La primera oleada es corta y lenta para aprender los controles. */
export const zombiesInWave = (wave: number) => (wave === 1 ? 5 : 6 + wave * 4);
const spawnInterval = (wave: number) => (wave === 1 ? 1.4 : Math.max(0.25, 1.1 - wave * 0.08));

export function createCombatState(width: number, height: number, options: CombatOptions = {}): CombatState {
  return {
    width,
    height,
    player: { x: width / 2, y: height / 2, r: 14, hp: 100, maxHp: 100, angle: 0, cooldown: 0, invulnerable: 0 },
    zombies: [],
    bullets: [],
    wave: 1,
    toSpawn: zombiesInWave(1),
    spawnTimer: 0.8,
    waveBreak: 0,
    kills: 0,
    score: 0,
    over: false,
    nextId: 1,
    muzzleFlash: 0,
    specialCooldown: 0,
    shockwave: 0,
    speedMultiplier: options.speedMultiplier ?? 1,
    damageMultiplier: options.damageMultiplier ?? 1,
    events: []
  };
}

/** Ajusta el área de juego (por ejemplo al cambiar el tamaño de la ventana). */
export function resizeCombat(state: CombatState, width: number, height: number): void {
  state.width = width;
  state.height = height;
  state.player.x = Math.min(Math.max(state.player.r, state.player.x), width - state.player.r);
  state.player.y = Math.min(Math.max(state.player.r, state.player.y), height - state.player.r);
}

function pickKind(wave: number, rand: () => number): ZombieKind {
  const roll = rand();
  if (wave >= 3 && roll < 0.12) return 'tank';
  if (wave >= 2 && roll < 0.42) return 'runner';
  return 'walker';
}

/** Punto de aparición en un borde aleatorio, justo fuera de la pantalla. */
function edgePosition(state: CombatState, margin: number, rand: () => number): { x: number; y: number } {
  const side = Math.floor(rand() * 4);
  const t = rand();
  switch (side) {
    case 0:
      return { x: -margin, y: t * state.height };
    case 1:
      return { x: state.width + margin, y: t * state.height };
    case 2:
      return { x: t * state.width, y: -margin };
    default:
      return { x: t * state.width, y: state.height + margin };
  }
}

export function spawnZombie(state: CombatState, rand: () => number = Math.random, kind?: ZombieKind): Zombie {
  const k = kind ?? pickKind(state.wave, rand);
  const base = KINDS[k];
  const margin = base.r + 4;
  const { x, y } = edgePosition(state, margin, rand);
  const hp = k === 'boss' ? base.hp + state.wave * 4 : base.hp + Math.floor((state.wave - 1) / 3);
  const waveSpeed = state.wave === 1 ? FIRST_WAVE_SPEED : 1;
  const zombie: Zombie = {
    id: state.nextId++,
    kind: k,
    x,
    y,
    r: base.r,
    hp,
    maxHp: hp,
    speed: (base.speed + (k === 'boss' ? 0 : state.wave * 4)) * waveSpeed * state.speedMultiplier,
    damage: Math.round(base.damage * state.damageMultiplier),
    hitFlash: 0,
    name: k === 'boss' ? bossName(state.wave) : undefined
  };
  state.zombies.push(zombie);
  return zombie;
}

function bossName(wave: number): string {
  return BOSS_NAMES[(Math.floor(wave / BOSS_EVERY) - 1) % BOSS_NAMES.length];
}

function killZombie(state: CombatState, z: Zombie) {
  state.kills += 1;
  state.score += KINDS[z.kind].points * state.wave;
  state.events.push(z.kind === 'boss' ? 'bossKilled' : 'kill');
}

/** Onda de choque alrededor del jugador: daña y empuja a los zombies cercanos. */
function useSpecial(state: CombatState) {
  const p = state.player;
  state.specialCooldown = SPECIAL_COOLDOWN;
  state.shockwave = 0.45;
  state.events.push('special');
  for (const z of state.zombies) {
    const dx = z.x - p.x;
    const dy = z.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > SPECIAL_RADIUS + z.r) continue;
    z.hp -= SPECIAL_DAMAGE;
    z.hitFlash = 0.12;
    const push = z.kind === 'boss' ? SPECIAL_KNOCKBACK * 0.3 : SPECIAL_KNOCKBACK;
    z.x += (dx / d) * push;
    z.y += (dy / d) * push;
    if (z.hp <= 0) killZombie(state, z);
  }
}

function startWave(state: CombatState, wave: number) {
  state.wave = wave;
  state.toSpawn = zombiesInWave(wave);
  state.spawnTimer = 0.3;
  if (wave % BOSS_EVERY === 0) {
    spawnZombie(state, Math.random, 'boss');
    state.events.push('boss');
  }
}

function movePlayer(state: CombatState, input: CombatInput, dt: number) {
  const p = state.player;
  let mx = Number(input.right) - Number(input.left);
  let my = Number(input.down) - Number(input.up);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
  }
  p.x = Math.min(Math.max(p.r, p.x + mx * PLAYER_SPEED * dt), state.width - p.r);
  p.y = Math.min(Math.max(p.r, p.y + my * PLAYER_SPEED * dt), state.height - p.r);
  p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
}

function tickTimers(state: CombatState, dt: number) {
  const p = state.player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  state.muzzleFlash = Math.max(0, state.muzzleFlash - dt);
  state.specialCooldown = Math.max(0, state.specialCooldown - dt);
  state.shockwave = Math.max(0, state.shockwave - dt);
}

function shoot(state: CombatState) {
  const p = state.player;
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  state.bullets.push({ x: p.x + cos * (p.r + 6), y: p.y + sin * (p.r + 6), vx: cos * BULLET_SPEED, vy: sin * BULLET_SPEED, life: BULLET_LIFE });
  p.cooldown = FIRE_COOLDOWN;
  state.muzzleFlash = 0.05;
}

function updateWaves(state: CombatState, dt: number, rand: () => number) {
  if (state.waveBreak > 0) {
    state.waveBreak -= dt;
    if (state.waveBreak <= 0) {
      state.waveBreak = 0;
      startWave(state, state.wave + 1);
    }
    return;
  }
  if (state.toSpawn <= 0) return;
  state.spawnTimer -= dt;
  while (state.spawnTimer <= 0 && state.toSpawn > 0) {
    spawnZombie(state, rand, state.wave === 1 ? 'walker' : undefined);
    state.toSpawn -= 1;
    state.spawnTimer += spawnInterval(state.wave);
  }
}

/** Los zombies persiguen al jugador y lo dañan al tocarlo. */
function moveZombies(state: CombatState, dt: number) {
  const p = state.player;
  for (const z of state.zombies) {
    if (z.hp <= 0) continue;
    const dx = p.x - z.x;
    const dy = p.y - z.y;
    const d = Math.hypot(dx, dy) || 1;
    z.x += (dx / d) * z.speed * dt;
    z.y += (dy / d) * z.speed * dt;
    z.hitFlash = Math.max(0, z.hitFlash - dt);
    if (d < z.r + p.r && p.invulnerable === 0) {
      p.hp = Math.max(0, p.hp - z.damage);
      p.invulnerable = 0.6;
      state.events.push('hit');
    }
  }
}

function bulletHits(state: CombatState, b: Bullet) {
  for (const z of state.zombies) {
    if (z.hp <= 0 || Math.hypot(b.x - z.x, b.y - z.y) > z.r + 3) continue;
    z.hp -= 1;
    z.hitFlash = 0.08;
    b.life = 0;
    if (z.hp <= 0) killZombie(state, z);
    return;
  }
}

function moveBullets(state: CombatState, dt: number) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
}

function cleanup(state: CombatState) {
  const inside = (b: Bullet) => b.x > -20 && b.y > -20 && b.x < state.width + 20 && b.y < state.height + 20;
  state.bullets = state.bullets.filter(b => b.life > 0 && inside(b));
  state.zombies = state.zombies.filter(z => z.hp > 0);
}

/** Avanza la simulación dt segundos. */
export function stepCombat(state: CombatState, input: CombatInput, dt: number, rand: () => number = Math.random): void {
  if (state.over) return;
  movePlayer(state, input, dt);
  tickTimers(state, dt);

  if (input.special && state.specialCooldown === 0) useSpecial(state);
  if (input.shooting && state.player.cooldown === 0) shoot(state);

  moveBullets(state, dt);
  updateWaves(state, dt, rand);
  moveZombies(state, dt);
  for (const b of state.bullets) {
    if (b.life > 0) bulletHits(state, b);
  }
  cleanup(state);

  // Fin de oleada: respiro y algo de vida
  if (state.waveBreak === 0 && state.toSpawn === 0 && state.zombies.length === 0) {
    state.waveBreak = WAVE_BREAK;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 15);
    state.events.push('waveCleared');
  }

  if (state.player.hp <= 0) state.over = true;
}

/** Devuelve y vacía los sucesos acumulados. */
export function drainEvents(state: CombatState): CombatEvent[] {
  const events = state.events;
  state.events = [];
  return events;
}
