import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CHARACTERS, CHARACTER_LIST, CharacterId } from '../../game/characters';
import './game-ui.css';

/** Texto que se escribe letra por letra. `skip` lo completa al instante. */
export function useTypewriter(text: string, speedMs = 28): { shown: string; done: boolean; skip: () => void } {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (!text) return;
    const id = window.setInterval(() => {
      setCount(c => {
        if (c >= text.length) {
          window.clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, speedMs);
    return () => window.clearInterval(id);
  }, [text, speedMs]);
  return { shown: text.slice(0, count), done: count >= text.length, skip: () => setCount(text.length) };
}

/** Retrato recortado del personaje (los PNG son verticales, la cara está arriba). */
export const Portrait: React.FC<{ id: CharacterId; size?: number; className?: string }> = ({ id, size = 56, className }) => {
  const c = CHARACTERS[id];
  return (
    <span
      className={`portrait ${className ?? ''}`}
      style={{ width: size, height: size, borderColor: c.color, boxShadow: `0 0 12px ${c.color}66` }}
    >
      <img src={c.portrait} alt={c.name} draggable={false} />
    </span>
  );
};

/** Precarga los retratos para que los mensajes aparezcan sin parpadeo. */
export function usePreloadPortraits() {
  useEffect(() => {
    for (const c of CHARACTER_LIST) {
      const img = new Image();
      img.src = c.portrait;
    }
  }, []);
}

interface TooltipProps {
  title: string;
  lines: { label?: string; text: string }[];
  children: React.ReactNode;
  className?: string;
}

/**
 * Tooltip flotante que se dibuja en <body>, así no lo recortan los paneles con scroll.
 */
export const Tooltip: React.FC<TooltipProps> = ({ title, lines, children, className }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean }>({ left: 0, top: 0, below: false });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tipRef.current) return;
    const a = anchorRef.current.getBoundingClientRect();
    const t = tipRef.current.getBoundingClientRect();
    const margin = 8;
    let left = a.left + a.width / 2 - t.width / 2;
    left = Math.max(margin, Math.min(window.innerWidth - t.width - margin, left));
    const below = a.top - t.height - margin < 0;
    const top = below ? a.bottom + margin : a.top - t.height - margin;
    setPos({ left, top, below });
  }, [open]);

  return (
    <div
      ref={anchorRef}
      className={`tip-anchor ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <div ref={tipRef} className={`tooltip ${pos.below ? 'below' : ''}`} style={{ left: pos.left, top: pos.top }} role="tooltip">
            <div className="tooltip-title">{title}</div>
            {lines.map((l, i) => (
              <div key={i} className="tooltip-line">
                {l.label && <span className="tooltip-label">{l.label}</span>}
                {l.text}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
