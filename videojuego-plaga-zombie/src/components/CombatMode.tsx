import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CombatInput,
  CombatState,
  createCombatState,
  drainEvents,
  resizeCombat,
  stepCombat,
  zombiesInWave,
  SPECIAL_COOLDOWN
} from '../combat/combat-engine';
import { renderCombat, ZOMBIE_COLORS } from '../combat/combat-render';
import { DIFFICULTIES, Difficulty } from '../game/difficulty';
import { hasSeenTutorial, markTutorialSeen } from '../game/tutorial';
import { playSound } from '../game/sound';
import { useCharacterStore } from '../store/character-store';
import { CHARACTERS } from '../game/characters';
import { formatNumber } from '../utils/format';
import CharacterToast from './game/CharacterToast';
import { usePreloadPortraits, useTypewriter } from './game/shared';
import './CombatMode.css';

interface CombatModeProps {
  difficulty: Difficulty;
  forceTutorial?: boolean;
  onBackToMenu: () => void;
}

interface Hud {
  hp: number;
  maxHp: number;
  wave: number;
  kills: number;
  score: number;
  remaining: number;
  waveBreak: boolean;
  special: number; // 0 = lista, 1 = recién usada
  boss: { name: string; hp: number; maxHp: number } | null;
}

type Phase = 'intro' | 'playing' | 'paused' | 'over';

const BEST_KEY = 'combat-best-score';

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // sin almacenamiento: solo se pierde el récord
  }
}


/** Sonidos y mensajes de los personajes según lo que pasó en el cuadro. */
function handleCombatEvents(state: CombatState, lowHealthWarned: React.MutableRefObject<boolean>) {
  const say = useCharacterStore.getState().say;
  for (const ev of drainEvents(state)) {
    switch (ev) {
      case 'special':
        playSound('action');
        break;
      case 'hit':
        playSound('error');
        break;
      case 'boss':
        playSound('boss');
        say('bossCombat');
        break;
      case 'bossKilled':
        playSound('victory');
        break;
      case 'waveCleared':
        playSound('mission');
        say('waveCleared', { wave: state.wave });
        lowHealthWarned.current = false;
        break;
    }
  }
  if (!lowHealthWarned.current && state.player.hp > 0 && state.player.hp <= 30) {
    lowHealthWarned.current = true;
    say('lowHealth');
  }
}

function buildHud(state: CombatState): Hud {
  const p = state.player;
  const boss = state.zombies.find(z => z.kind === 'boss');
  return {
    hp: p.hp,
    maxHp: p.maxHp,
    wave: state.wave,
    kills: state.kills,
    score: state.score,
    remaining: state.toSpawn + state.zombies.length,
    waveBreak: state.waveBreak > 0,
    special: state.specialCooldown / SPECIAL_COOLDOWN,
    boss: boss ? { name: boss.name ?? 'Jefe', hp: boss.hp, maxHp: boss.maxHp } : null
  };
}

const CONTROLS: [string, string][] = [
  ['W A S D', 'Moverse (también con las flechas)'],
  ['🖱️ Mouse', 'Apuntar'],
  ['Clic', 'Disparar (o barra espaciadora)'],
  ['Q', `Habilidad especial: onda de choque (recarga ${SPECIAL_COOLDOWN} s)`],
  ['Esc', 'Pausa']
];

const COACH_TEXT =
  'Primera vez en combate, ¿eh? Tranquilo: la primera oleada son solo cinco caminantes lentos. Muévete sin parar, dispara y guarda la Q para cuando te rodeen.';

const CombatMode: React.FC<CombatModeProps> = ({ difficulty, forceTutorial, onBackToMenu }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<CombatState | null>(null);
  const inputRef = useRef<CombatInput>({ up: false, down: false, left: false, right: false, shooting: false, aimX: 0, aimY: 0 });
  const phaseRef = useRef<Phase>('intro');
  const lowHealthWarned = useRef(false);
  const [phase, setPhaseState] = useState<Phase>('intro');
  const [hud, setHud] = useState<Hud | null>(null);
  const [best, setBest] = useState(readBest);
  const firstTime = useRef(forceTutorial || !hasSeenTutorial('combat')).current;
  const coach = useTypewriter(firstTime ? COACH_TEXT : '', 22);
  const diff = DIFFICULTIES[difficulty];
  usePreloadPortraits();

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const startGame = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    markTutorialSeen('combat');
    stateRef.current = createCombatState(stage.clientWidth, stage.clientHeight, {
      speedMultiplier: diff.combatSpeed,
      damageMultiplier: diff.combatDamage
    });
    inputRef.current.aimX = stage.clientWidth / 2 + 100;
    inputRef.current.aimY = stage.clientHeight / 2;
    lowHealthWarned.current = false;
    useCharacterStore.getState().clear();
    playSound('action');
    setPhase('playing');
  }, [setPhase, diff]);

  useEffect(() => () => useCharacterStore.getState().clear(), []);

  // Tamaño del lienzo
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(stage.clientWidth * dpr);
      canvas.height = Math.round(stage.clientHeight * dpr);
      if (stateRef.current) resizeCombat(stateRef.current, stage.clientWidth, stage.clientHeight);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Teclado
  useEffect(() => {
    const keyMap: Record<string, 'up' | 'down' | 'left' | 'right' | 'shooting'> = {
      KeyW: 'up',
      ArrowUp: 'up',
      KeyS: 'down',
      ArrowDown: 'down',
      KeyA: 'left',
      ArrowLeft: 'left',
      KeyD: 'right',
      ArrowRight: 'right',
      Space: 'shooting'
    };
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (down && (e.code === 'Escape' || e.code === 'KeyP')) {
        if (phaseRef.current === 'playing') setPhase('paused');
        else if (phaseRef.current === 'paused') setPhase('playing');
        return;
      }
      if (down && e.code === 'KeyQ' && phaseRef.current === 'playing') {
        inputRef.current.special = true;
        return;
      }
      const key = keyMap[e.code];
      if (!key) return;
      e.preventDefault();
      inputRef.current[key] = down;
    };
    const kd = onKey(true);
    const ku = onKey(false);
    const blur = () => Object.assign(inputRef.current, { up: false, down: false, left: false, right: false, shooting: false });
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, [setPhase]);

  // Bucle principal: simula, reacciona a los sucesos y dibuja
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0;
    let last = performance.now();
    let hudTimer = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const state = stateRef.current;
      const dpr = window.devicePixelRatio || 1;

      if (state && phaseRef.current === 'playing') {
        stepCombat(state, inputRef.current, dt);
        inputRef.current.special = false;
        handleCombatEvents(state, lowHealthWarned);
        if (state.over) {
          setPhase('over');
          playSound('defeat');
          if (state.score > readBest()) {
            saveBest(state.score);
            setBest(state.score);
          }
        }
      }

      const { aimX, aimY } = inputRef.current;
      renderCombat(ctx, state, { w: canvas.width / dpr, h: canvas.height / dpr, dpr }, { x: aimX, y: aimY }, now);

      hudTimer -= dt;
      if (state && hudTimer <= 0) {
        hudTimer = 0.1;
        setHud(buildHud(state));
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [setPhase]);

  // Ratón: apuntar y disparar
  const updateAim = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    inputRef.current.aimX = e.clientX - rect.left;
    inputRef.current.aimY = e.clientY - rect.top;
  };

  const lider = CHARACTERS.lider;

  return (
    <div className="combat-mode">
      <header className="combat-header">
        <button className="gothic-button combat-back" onClick={onBackToMenu}>
          ← MENÚ
        </button>
        <h1 className="gothic-text">⚔️ MODO COMBATE</h1>
        <div className="combat-best">
          {diff.icon} {diff.label} · Récord: {formatNumber(best)}
        </div>
      </header>

      <div
        className="combat-stage"
        ref={stageRef}
        onPointerMove={updateAim}
        onPointerDown={e => {
          updateAim(e);
          if (e.button === 0 && phaseRef.current === 'playing') inputRef.current.shooting = true;
        }}
        onPointerUp={() => {
          inputRef.current.shooting = false;
        }}
        onPointerLeave={() => {
          inputRef.current.shooting = false;
        }}
        onContextMenu={e => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="combat-canvas" />

        {hud && phase !== 'intro' && (
          <>
            <div className="combat-hud">
              <div className="combat-hp">
                <span>VIDA</span>
                <div className="combat-hp-bar">
                  <div className="combat-hp-fill" style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} />
                </div>
                <span>{formatNumber(hud.hp)}</span>
              </div>
              <div className={`combat-special ${hud.special === 0 ? 'ready' : ''}`}>
                <span className="combat-key">Q</span>
                <div className="combat-special-bar">
                  <div className="combat-special-fill" style={{ width: `${(1 - hud.special) * 100}%` }} />
                </div>
                <span>{hud.special === 0 ? '¡LISTA!' : `${Math.ceil(hud.special * SPECIAL_COOLDOWN)} s`}</span>
              </div>
              <div className="combat-stat">
                OLEADA <strong>{formatNumber(hud.wave)}</strong>
              </div>
              <div className="combat-stat">
                BAJAS <strong>{formatNumber(hud.kills)}</strong>
              </div>
              <div className="combat-stat">
                PUNTOS <strong>{formatNumber(hud.score)}</strong>
              </div>
              <div className="combat-stat">
                {hud.waveBreak ? (
                  'SIGUIENTE OLEADA…'
                ) : (
                  <>
                    QUEDAN <strong>{formatNumber(hud.remaining)}</strong>
                  </>
                )}
              </div>
            </div>
            {hud.boss && (
              <div className="combat-boss">
                <div className="combat-boss-name">👑 {hud.boss.name}</div>
                <div className="combat-boss-bar">
                  <div className="combat-boss-fill" style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }} />
                </div>
              </div>
            )}
          </>
        )}

        {phase === 'intro' && (
          <div className="combat-overlay">
            <h2 className="gothic-text">SOBREVIVE A LA HORDA</h2>
            <p>Los infectados llegan por oleadas desde todos los bordes. Cada {5} oleadas aparece un jefe.</p>

            <div className="combat-controls" aria-label="Controles">
              {CONTROLS.map(([key, action]) => (
                <div key={key} className="combat-control">
                  <span className="combat-key">{key}</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>

            <p className="combat-legend">
              <span style={{ color: ZOMBIE_COLORS.walker }}>● Caminante</span>
              <span style={{ color: ZOMBIE_COLORS.runner }}>● Corredor</span>
              <span style={{ color: ZOMBIE_COLORS.tank }}>● Tanque</span>
              <span style={{ color: ZOMBIE_COLORS.boss }}>● Jefe</span>
            </p>

            {firstTime && (
              <div className="combat-coach" style={{ borderColor: lider.color }}>
                <img src={lider.portrait} alt={lider.name} />
                <div>
                  <div className="combat-coach-name" style={{ color: lider.color }}>
                    {lider.name}
                  </div>
                  <p>{coach.shown}</p>
                </div>
              </div>
            )}

            <p className="combat-first-wave">Primera oleada: {formatNumber(zombiesInWave(1))} caminantes lentos.</p>
            <button className="gothic-button" onClick={startGame}>
              ¡A LUCHAR!
            </button>
          </div>
        )}

        {phase === 'paused' && (
          <div className="combat-overlay">
            <h2 className="gothic-text">PAUSA</h2>
            <button className="gothic-button" onClick={() => setPhase('playing')}>
              CONTINUAR
            </button>
            <button className="gothic-button" onClick={onBackToMenu}>
              MENÚ
            </button>
          </div>
        )}

        {phase === 'over' && hud && (
          <div className="combat-overlay">
            <h2 className="gothic-text blood-text">TE HAN INFECTADO</h2>
            <p>
              Llegaste a la oleada {formatNumber(hud.wave)} con {formatNumber(hud.kills)} bajas.
            </p>
            <p className="combat-final-score">{formatNumber(hud.score)} puntos</p>
            <button className="gothic-button" onClick={startGame}>
              JUGAR OTRA VEZ
            </button>
            <button className="gothic-button" onClick={onBackToMenu}>
              MENÚ
            </button>
          </div>
        )}
      </div>

      {phase === 'playing' && <CharacterToast />}
    </div>
  );
};

export default CombatMode;
