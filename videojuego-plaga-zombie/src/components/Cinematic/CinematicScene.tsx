import React, { useEffect, useState, useRef } from 'react';
import './CinematicScene.css';

export interface SceneData {
  id: number;
  image: string;
  text: string;
  cameraEffect: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down';
  duration: number; // segundos
}

interface CinematicSceneProps {
  scene: SceneData;
  isActive: boolean;
  onComplete: () => void;
}

const CinematicScene: React.FC<CinematicSceneProps> = ({ scene, isActive, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [textComplete, setTextComplete] = useState(false);
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive) {
      setDisplayedText('');
      setTextComplete(false);
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
      if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
      return;
    }

    // Efecto de máquina de escribir
    let currentIndex = 0;
    const typeSpeed = 50; // ms por letra

    const typeNextChar = () => {
      if (currentIndex < scene.text.length) {
        setDisplayedText(scene.text.substring(0, currentIndex + 1));
        currentIndex++;
        typewriterRef.current = setTimeout(typeNextChar, typeSpeed);
      } else {
        setTextComplete(true);
      }
    };

    // Iniciar escritura después de un pequeño delay
    typewriterRef.current = setTimeout(typeNextChar, 500);

    // Timer para completar la escena
    sceneTimerRef.current = setTimeout(() => {
      onComplete();
    }, scene.duration * 1000);

    return () => {
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
      if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
    };
  }, [isActive, scene, onComplete]);

  if (!isActive) return null;

  return (
    <div className="cinematic-scene">
      <div className={`scene-image ${scene.cameraEffect}`}>
        <img 
          src={scene.image} 
          alt={`Escena ${scene.id}`}
          onError={(e) => {
            // Fallback: imagen de placeholder si no existe
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"%3E%3Crect width="1920" height="1080" fill="%23000"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%238b0000" font-size="48" font-family="Arial"%3EEscena ' + scene.id + '%3C/text%3E%3C/svg%3E';
          }}
        />
        <div className="scene-vignette"></div>
      </div>

      <div className="scene-text-container">
        <div className={`scene-text ${textComplete ? 'complete' : ''}`}>
          {displayedText}
          {!textComplete && <span className="cursor">|</span>}
        </div>
      </div>

      <div className="scene-progress">
        <div 
          className="scene-progress-bar" 
          style={{ 
            animation: `progress ${scene.duration}s linear` 
          }}
        ></div>
      </div>
    </div>
  );
};

export default CinematicScene;
