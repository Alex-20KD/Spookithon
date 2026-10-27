import React, { useEffect } from 'react';
import { useCharacterStore } from '../../store/character-store';
import { CHARACTERS } from '../../game/characters';
import { playSound } from '../../game/sound';
import { Portrait } from './shared';

/** Mensajes cortos de los personajes en una esquina (uno cada 6 segundos como máximo). */
const CharacterToast: React.FC = () => {
  const current = useCharacterStore(s => s.current);
  const tick = useCharacterStore(s => s.tick);
  const dismiss = useCharacterStore(s => s.dismiss);

  useEffect(() => {
    const id = window.setInterval(() => tick(), 400);
    return () => window.clearInterval(id);
  }, [tick]);

  useEffect(() => {
    if (current) playSound('message');
  }, [current]);

  if (!current) return null;
  const c = CHARACTERS[current.characterId];

  return (
    <div className="character-toast" key={current.id} style={{ borderColor: c.color }} role="status" aria-live="polite">
      <Portrait id={c.id} size={58} />
      <div className="character-toast-body">
        <div className="character-toast-name" style={{ color: c.color }}>
          {c.name}
        </div>
        <div className="character-toast-text">{current.text}</div>
      </div>
      <button className="character-toast-close" onClick={dismiss} aria-label="Cerrar mensaje">
        ×
      </button>
    </div>
  );
};

export default CharacterToast;
