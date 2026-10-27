import React, { useEffect, useRef, useState } from 'react';
import { useGameStore, buildAdvisorState, SimulationSpeed } from '../../store/game-store';
import { CHARACTER_LIST, CHARACTERS, CharacterId } from '../../game/characters';
import { AdviceResult, requestAdvice } from '../../game/advisor';
import { playSound } from '../../game/sound';
import { Portrait, useTypewriter } from './shared';

interface AdvisorModalProps {
  onClose: () => void;
}

/** "Pedir consejo": el jugador elige un personaje y recibe un consejo según el estado actual. */
const AdvisorModal: React.FC<AdvisorModalProps> = ({ onClose }) => {
  const [who, setWho] = useState<CharacterId | null>(null);
  const [result, setResult] = useState<AdviceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const previousSpeed = useRef<SimulationSpeed>(useGameStore.getState().simulationSpeed);
  const requestId = useRef(0);
  const { shown, done } = useTypewriter(result?.text ?? '', 22);

  // La partida se pausa mientras se consulta al asesor
  useEffect(() => {
    const store = useGameStore.getState();
    previousSpeed.current = store.simulationSpeed;
    store.setSimulationSpeed('paused');
    return () => {
      const s = useGameStore.getState();
      if (!s.gameOver && !s.activeEvent) s.setSimulationSpeed(previousSpeed.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ask = async (id: CharacterId) => {
    playSound('click');
    setWho(id);
    setResult(null);
    setLoading(true);
    const myRequest = ++requestId.current;
    const advice = await requestAdvice(id, buildAdvisorState(useGameStore.getState()));
    if (myRequest !== requestId.current) return; // el jugador eligió a otro mientras tanto
    setResult(advice);
    setLoading(false);
  };

  const character = who ? CHARACTERS[who] : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="advisor-card" role="dialog" aria-modal="true" aria-labelledby="advisor-title" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        {!character ? (
          <>
            <h2 id="advisor-title" className="gothic-text advisor-title">
              ¿A QUIÉN PIDES CONSEJO?
            </h2>
            <p className="advisor-subtitle">Cada uno analiza la partida desde su especialidad. El juego queda en pausa.</p>
            <div className="advisor-grid">
              {CHARACTER_LIST.map(c => (
                <button key={c.id} className="advisor-choice" style={{ borderColor: c.color }} onClick={() => ask(c.id)}>
                  <Portrait id={c.id} size={72} />
                  <span className="advisor-choice-name" style={{ color: c.color }}>
                    {c.name}
                  </span>
                  <span className="advisor-choice-role">{c.role}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="advisor-answer">
            <div className="advisor-answer-portrait">
              <img src={character.portrait} alt={character.name} style={{ borderColor: character.color }} />
            </div>
            <div className="advisor-answer-body">
              <div id="advisor-title" className="advisor-answer-name" style={{ color: character.color }}>
                {character.name}
              </div>
              <div className="advisor-answer-role">{character.role}</div>
              <p className="advisor-answer-text">
                {loading ? <span className="advisor-thinking">Analizando la situación…</span> : shown}
                {!loading && !done && <span className="type-cursor">▌</span>}
              </p>
              {result && done && (
                <div className={`advisor-source ${result.source}`}>
                  {result.source === 'bedrock'
                    ? '🤖 Consejo generado con IA (Amazon Bedrock)'
                    : `📋 Asesor local por reglas${result.note ? ` · ${result.note}` : ''}`}
                </div>
              )}
              <div className="advisor-actions">
                <button className="gothic-button small" onClick={() => { setWho(null); setResult(null); requestId.current++; setLoading(false); }}>
                  Preguntar a otro
                </button>
                <button className="gothic-button small" onClick={onClose}>
                  Volver al juego
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvisorModal;
