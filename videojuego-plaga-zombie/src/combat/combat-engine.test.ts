import { describe, it, expect } from 'vitest';
import {
  createCombatState,
  spawnZombie,
  stepCombat,
  zombiesInWave,
  drainEvents,
  CombatInput,
  WAVE_BREAK,
  SPECIAL_COOLDOWN,
  BOSS_EVERY
} from './combat-engine';

const idle = (aimX = 0, aimY = 0): CombatInput => ({ up: false, down: false, left: false, right: false, shooting: false, aimX, aimY });

describe('Motor del Modo Combate', () => {
  it('el jugador se mueve y no sale del área', () => {
    const s = createCombatState(400, 300);
    for (let i = 0; i < 200; i++) stepCombat(s, { ...idle(), left: true }, 0.05);
    expect(s.player.x).toBe(s.player.r);
  });

  it('las balas eliminan zombies y suman puntos', () => {
    const s = createCombatState(800, 600);
    s.toSpawn = 0;
    const z = spawnZombie(s, () => 0.5, 'runner');
    z.x = s.player.x + 150;
    z.y = s.player.y;
    z.speed = 0;
    for (let i = 0; i < 30 && s.kills === 0; i++) stepCombat(s, { ...idle(z.x, z.y), shooting: true }, 0.03);
    expect(s.kills).toBe(1);
    expect(s.score).toBeGreaterThan(0);
  });

  it('el contacto con un zombie quita vida y termina la partida', () => {
    const s = createCombatState(800, 600);
    s.toSpawn = 0;
    const z = spawnZombie(s, () => 0.5, 'tank');
    z.x = s.player.x;
    z.y = s.player.y;
    for (let i = 0; i < 200 && !s.over; i++) stepCombat(s, idle(), 0.05);
    expect(s.player.hp).toBe(0);
    expect(s.over).toBe(true);
  });

  it('la Q (onda de choque) daña y empuja a los zombies cercanos y luego se recarga', () => {
    const s = createCombatState(800, 600);
    s.toSpawn = 0;
    const near = spawnZombie(s, () => 0.5, 'runner');
    near.x = s.player.x + 60;
    near.y = s.player.y;
    const far = spawnZombie(s, () => 0.5, 'tank');
    far.x = s.player.x + 400;
    far.y = s.player.y;
    far.speed = 0;
    stepCombat(s, { ...idle(), special: true }, 0.016);
    expect(s.kills).toBe(1);
    expect(far.hp).toBe(far.maxHp);
    expect(s.specialCooldown).toBeCloseTo(SPECIAL_COOLDOWN, 1);
    expect(drainEvents(s)).toContain('special');
    // En recarga no vuelve a dispararse
    far.x = s.player.x + 50;
    stepCombat(s, { ...idle(), special: true }, 0.016);
    expect(far.hp).toBe(far.maxHp);
  });

  it('la primera oleada es fácil: pocos caminantes lentos', () => {
    const s = createCombatState(800, 600);
    for (let i = 0; i < 200; i++) stepCombat(s, idle(), 0.05);
    expect(zombiesInWave(1)).toBe(5);
    expect(s.zombies.every(z => z.kind === 'walker')).toBe(true);
    expect(s.zombies.every(z => z.speed < 60)).toBe(true);
  });

  it(`cada ${BOSS_EVERY} oleadas aparece un jefe`, () => {
    const s = createCombatState(800, 600);
    s.wave = BOSS_EVERY - 1;
    s.toSpawn = 0;
    stepCombat(s, idle(), 0.016); // limpia la oleada y empieza el respiro
    for (let t = 0; t <= WAVE_BREAK + 0.1; t += 0.1) stepCombat(s, idle(), 0.1);
    expect(s.wave).toBe(BOSS_EVERY);
    expect(s.zombies.some(z => z.kind === 'boss' && z.name)).toBe(true);
    expect(drainEvents(s)).toContain('boss');
  });

  it('la dificultad cambia velocidad y daño de los zombies', () => {
    const hard = createCombatState(800, 600, { speedMultiplier: 1.2, damageMultiplier: 1.4 });
    const easy = createCombatState(800, 600, { speedMultiplier: 0.8, damageMultiplier: 0.7 });
    const zh = spawnZombie(hard, () => 0.5, 'walker');
    const ze = spawnZombie(easy, () => 0.5, 'walker');
    expect(zh.speed).toBeGreaterThan(ze.speed);
    expect(zh.damage).toBeGreaterThan(ze.damage);
  });

  it('al limpiar la oleada empieza la siguiente con más zombies', () => {
    const s = createCombatState(800, 600);
    s.toSpawn = 0;
    stepCombat(s, idle(), 0.016);
    expect(s.waveBreak).toBeGreaterThan(0);
    for (let t = 0; t <= WAVE_BREAK + 0.1; t += 0.1) stepCombat(s, idle(), 0.1);
    expect(s.wave).toBe(2);
    expect(zombiesInWave(2)).toBeGreaterThan(zombiesInWave(1));
  });
});
