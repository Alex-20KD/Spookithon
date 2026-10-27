import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/game-store';
import { CHARACTERS } from '../../game/characters';
import { GOVERNMENT_TUTORIAL, VIRUS_TUTORIAL, markTutorialSeen } from '../../game/tutorial';
import type { GameMode } from '../../game/types';
import { playSound } from '../../game/sound';
import { useTypewriter } from './shared';

interface TutorialProps {
  mode: GameMode;
  onFinish: () => void;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Tutorial estilo novela visual: oscurece la pantalla, resalta el elemento del que se habla
 * y solo avanza en los pasos con tarea cuando el jugador la cumple. La simulación queda en pausa.
 */
const Tutorial: React.FC<TutorialProps> = ({ mode, onFinish }) => {
  const steps = mode === 'government' ? GOVERNMENT_TUTORIAL : VIRUS_TUTORIAL;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [taskDone, setTaskDone] = useState(false);
  const step = steps[index];
  const speaker = CHARACTERS[step.speaker];
  const { shown, done: typed, skip } = useTypewriter(step.text, 24);
  const setTutorialActive = useGameStore(s => s.setTutorialActive);

  const finish = useCallback(() => {
    markTutorialSeen(mode);
    setTutorialActive(false);
    onFinish();
  }, [mode, onFinish, setTutorialActive]);

  // Pausa la simulación mientras dure el tutorial
  useEffect(() => {
    setTutorialActive(true);
    return () => setTutorialActive(false);
  }, [setTutorialActive]);

  const next = useCallback(() => {
    playSound('click');
    if (index >= steps.length - 1) finish();
    else setIndex(i => i + 1);
  }, [index, steps.length, finish]);

  // Al entrar a cada paso
  useEffect(() => {
    setTaskDone(false);
    step.onEnter?.(useGameStore.getState());
    if (step.target) {
      document.querySelector(`[data-tour="${step.target}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [step]);

  // Pasos con tarea: avanzar cuando el jugador la cumple
  useEffect(() => {
    if (!step.task) return;
    const check = (s: ReturnType<typeof useGameStore.getState>) => {
      if (step.task!.done(s)) setTaskDone(true);
    };
    check(useGameStore.getState());
    return useGameStore.subscribe(check);
  }, [step]);

  // El temporizador usa siempre la última versión de `next` sin reiniciarse en cada render
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    if (!taskDone) return;
    playSound('mission');
    const id = window.setTimeout(() => nextRef.current(), 1100);
    return () => window.clearTimeout(id);
  }, [taskDone]);

  // Sigue la posición del elemento resaltado (puede moverse con el scroll o el tamaño de la ventana)
  useLayoutEffect(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) return setRect(null);
      const r = el.getBoundingClientRect();
      setRect(prev =>
        prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height
          ? prev
          : { left: r.left, top: r.top, width: r.width, height: r.height }
      );
    };
    update();
    const id = window.setInterval(update, 150);
    window.addEventListener('resize', update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', update);
    };
  }, [step]);

  const pad = 6;

  return (
    <div className="tutorial-layer">
      {rect ? (
        <div
          className="tutorial-spotlight"
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderColor: speaker.color,
            color: speaker.color
          }}
        />
      ) : (
        <div className="tutorial-dim" />
      )}

      <div className="tutorial-dialog" style={{ borderColor: speaker.color }} role="dialog" aria-label="Tutorial">
        <div className="tutorial-portrait" style={{ borderColor: speaker.color }}>
          <img src={speaker.portrait} alt={speaker.name} draggable={false} />
        </div>
        <div className="tutorial-body">
          <div className="tutorial-header">
            <span className="tutorial-name" style={{ color: speaker.color }}>
              {speaker.name}
            </span>
            <span className="tutorial-role">{speaker.role}</span>
            <span className="tutorial-step">
              {index + 1}/{steps.length}
            </span>
          </div>
          <p className="tutorial-text">
            {shown}
            {!typed && <span className="type-cursor">▌</span>}
          </p>
          <div className="tutorial-footer">
            {step.task ? (
              <div className={`tutorial-task ${taskDone ? 'done' : ''}`}>
                {taskDone ? '✅ ¡Bien hecho!' : `🎯 Tarea: ${step.task.label}`}
              </div>
            ) : (
              <span />
            )}
            <div className="tutorial-buttons">
              <button className="tutorial-skip" onClick={finish}>
                Saltar tutorial
              </button>
              {!step.task && (
                <button className="gothic-button small" onClick={typed ? next : skip}>
                  {typed ? (index === steps.length - 1 ? 'Empezar' : 'Siguiente ▶') : 'Mostrar todo'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tutorial;
