import React from 'react';
import { useGameStore, snapshotOf } from '../../store/game-store';
import { EVENTS_BY_ID } from '../../game/events';
import { CHARACTERS } from '../../game/characters';
import { Portrait, useTypewriter } from './shared';

/** Evento con dos decisiones. La simulación queda en pausa hasta que el jugador elige. */
const EventModal: React.FC = () => {
  const active = useGameStore(s => s.activeEvent);
  const resolveEvent = useGameStore(s => s.resolveEvent);
  useGameStore(s => s.budget); // re-evaluar opciones disponibles si cambia el dinero
  const event = active ? EVENTS_BY_ID.get(active.id) : undefined;
  const text = event && active ? event.text(active.params) : '';
  const { shown, done } = useTypewriter(text, 18);

  if (!active || !event) return null;
  const speaker = CHARACTERS[event.speaker];
  const snap = snapshotOf(useGameStore.getState());

  return (
    <div className="modal-backdrop event-backdrop">
      <div className="event-card" role="dialog" aria-modal="true" aria-labelledby="event-title">
        <div className="event-icon" aria-hidden="true">
          {event.icon}
        </div>
        <div className="event-kicker">EVENTO · DÍA {active.day}</div>
        <h2 id="event-title" className="event-title gothic-text">
          {event.title}
        </h2>

        <div className="event-speaker">
          <Portrait id={speaker.id} size={44} />
          <span style={{ color: speaker.color }}>{speaker.name} informa:</span>
        </div>
        <p className="event-text">
          {shown}
          {!done && <span className="type-cursor">▌</span>}
        </p>

        <div className="event-options">
          {event.options.map((option, i) => {
            const index = i as 0 | 1;
            const available = !option.available || option.available(snap);
            return (
              <button
                key={option.label}
                className="event-option"
                disabled={!available}
                onClick={() => resolveEvent(index)}
              >
                <span className="event-option-label">{option.label}</span>
                <span className="event-option-effect">{available ? option.effect : 'No te alcanza'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EventModal;
