// Dibujo del Modo Combate en canvas 2D (separado del componente para mantenerlo simple)
import type { CombatState, Player, Zombie } from './combat-engine';
import { SPECIAL_RADIUS } from './combat-engine';

export const ZOMBIE_COLORS = { walker: '#5f8f3a', runner: '#a83a3a', tank: '#6b3fa0', boss: '#d4145a' } as const;

const SHOCKWAVE_DURATION = 0.45;

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0b0910';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(157, 78, 221, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += 48) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y < h; y += 48) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
}

function drawShockwave(ctx: CanvasRenderingContext2D, state: CombatState) {
  if (state.shockwave <= 0) return;
  const t = 1 - state.shockwave / SHOCKWAVE_DURATION;
  ctx.strokeStyle = `rgba(180, 108, 255, ${1 - t})`;
  ctx.lineWidth = 6 * (1 - t) + 1;
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, SPECIAL_RADIUS * (0.3 + 0.7 * t), 0, Math.PI * 2);
  ctx.stroke();
}

function drawBullets(ctx: CanvasRenderingContext2D, state: CombatState) {
  ctx.strokeStyle = '#ffd36b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const b of state.bullets) {
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.015, b.y - b.vy * 0.015);
  }
  ctx.stroke();
}

function drawZombie(ctx: CanvasRenderingContext2D, z: Zombie, p: Player) {
  const isBoss = z.kind === 'boss';
  ctx.save();
  ctx.shadowColor = isBoss ? 'rgba(255, 0, 90, 0.9)' : 'rgba(255, 0, 0, 0.6)';
  ctx.shadowBlur = isBoss ? 24 : 10;
  ctx.fillStyle = z.hitFlash > 0 ? '#ffffff' : ZOMBIE_COLORS[z.kind];
  ctx.beginPath();
  ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Ojos mirando al jugador
  const a = Math.atan2(p.y - z.y, p.x - z.x);
  ctx.fillStyle = isBoss ? '#ffe600' : '#ff2020';
  for (const side of [-0.45, 0.45]) {
    ctx.beginPath();
    ctx.arc(z.x + Math.cos(a + side) * z.r * 0.55, z.y + Math.sin(a + side) * z.r * 0.55, Math.max(2, z.r * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }

  // Barra de vida (los jefes la tienen arriba en la interfaz)
  if (!isBoss && z.maxHp > 1 && z.hp < z.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(z.x - z.r, z.y - z.r - 8, z.r * 2, 4);
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(z.x - z.r, z.y - z.r - 8, (z.r * 2 * z.hp) / z.maxHp, 4);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: CombatState, now: number) {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(p.r - 4, -3, 16, 6);
  if (state.muzzleFlash > 0) {
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath();
    ctx.arc(p.r + 14, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowColor = '#b46cff';
  ctx.shadowBlur = 14;
  const blinking = p.invulnerable > 0 && Math.floor(now / 80) % 2 === 0;
  ctx.globalAlpha = blinking ? 0.45 : 1;
  ctx.fillStyle = '#9d4edd';
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    ctx.moveTo(x + dx * 4, y + dy * 4);
    ctx.lineTo(x + dx * 13, y + dy * 13);
  }
  ctx.stroke();
}

/** Dibuja un cuadro completo. */
export function renderCombat(
  ctx: CanvasRenderingContext2D,
  state: CombatState | null,
  size: { w: number; h: number; dpr: number },
  aim: { x: number; y: number },
  now: number
): void {
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  drawFloor(ctx, size.w, size.h);
  if (!state) return;

  drawShockwave(ctx, state);
  drawBullets(ctx, state);
  for (const z of state.zombies) drawZombie(ctx, z, state.player);
  drawPlayer(ctx, state, now);

  // Viñeta roja al recibir daño
  if (state.player.invulnerable > 0.3) {
    ctx.fillStyle = 'rgba(160, 0, 0, 0.18)';
    ctx.fillRect(0, 0, size.w, size.h);
  }
  drawCrosshair(ctx, aim.x, aim.y);
}
