import React, { useState, useEffect, useRef } from 'react';
import CinematicScene, { SceneData } from './CinematicScene';
import { assetUrl } from '../../utils/assetUrl';
import './CinematicPlayer.css';

interface CinematicPlayerProps {
  onComplete: () => void;
}

// Datos de las 5 escenas
// Usa .png si existe, fallback a .svg
const CINEMATIC_SCENES: SceneData[] = [
  {
    id: 1,
    image: assetUrl('assets/cinematica/escena1.svg'), // Cambiar a .png cuando tengas la imagen
    text: 'Noche en el puerto de Manta. Un barco carguero se acerca lentamente a la costa. Algo no está bien...',
    cameraEffect: 'zoom-in',
    duration: 8
  },
  {
    id: 2,
    image: assetUrl('assets/cinematica/escena2.svg'), // Cambiar a .png cuando tengas la imagen
    text: 'Un marinero enfermo desciende del barco. Sus ojos brillan con una luz antinatural. La infección ha llegado.',
    cameraEffect: 'pan-right',
    duration: 8
  },
  {
    id: 3,
    image: assetUrl('assets/cinematica/escena3.svg'), // Cambiar a .png cuando tengas la imagen
    text: '⚠️ ÚLTIMA HORA: Brote desconocido en Manta. Las autoridades piden calma mientras investigan los primeros casos.',
    cameraEffect: 'zoom-out',
    duration: 8
  },
  {
    id: 4,
    image: assetUrl('assets/cinematica/escena4.svg'), // Cambiar a .png cuando tengas la imagen
    text: 'Portoviejo cae en el caos. Las calles se llenan de sombras. El virus se expande más rápido de lo esperado.',
    cameraEffect: 'pan-left',
    duration: 8
  },
  {
    id: 5,
    image: assetUrl('assets/cinematica/escena5.svg'), // Cambiar a .png cuando tengas la imagen
    text: 'Sala de emergencias del gobierno. El mapa de Manabí se tiñe de rojo. La provincia te necesita. ¿Podrás salvarla?',
    cameraEffect: 'zoom-in',
    duration: 8
  }
];

const CinematicPlayer: React.FC<CinematicPlayerProps> = ({ onComplete }) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [showTransition, setShowTransition] = useState(false);
  const [showFinalTitle, setShowFinalTitle] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Intentar cargar y reproducir música de fondo
    const audio = new Audio(assetUrl('assets/audio/intro-music.mp3'));
    audio.volume = 0.3;
    audio.loop = false;
    
    audio.play().catch(err => {
      console.log('Audio playback failed:', err);
    });
    
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleSceneComplete = () => {
    if (currentSceneIndex < CINEMATIC_SCENES.length - 1) {
      // Transición a la siguiente escena
      setShowTransition(true);
      
      setTimeout(() => {
        setCurrentSceneIndex(currentSceneIndex + 1);
        setShowTransition(false);
      }, 1000);
    } else {
      // Última escena completada, mostrar título final
      setShowTransition(true);
      
      setTimeout(() => {
        setShowFinalTitle(true);
        
        // Después de 5 segundos, ir al menú principal
        setTimeout(() => {
          finishCinematic();
        }, 5000);
      }, 1000);
    }
  };

  const handleSkip = () => {
    setIsPlaying(false);
    finishCinematic();
  };

  const finishCinematic = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onComplete();
  };

  return (
    <div className="cinematic-player">
      {/* Botón de saltar siempre visible */}
      <button className="skip-button" onClick={handleSkip}>
        ⏭ SALTAR
      </button>

      {/* Visualizador de audio */}
      <div className="audio-visualizer">
        <div className="audio-bar"></div>
        <div className="audio-bar"></div>
        <div className="audio-bar"></div>
        <div className="audio-bar"></div>
        <div className="audio-bar"></div>
      </div>

      {/* Escenas cinemáticas */}
      {isPlaying && !showFinalTitle && CINEMATIC_SCENES.map((scene, index) => (
        <CinematicScene
          key={scene.id}
          scene={scene}
          isActive={index === currentSceneIndex}
          onComplete={handleSceneComplete}
        />
      ))}

      {/* Transición entre escenas */}
      {showTransition && !showFinalTitle && (
        <div className={`scene-transition ${showTransition ? 'fade-in' : 'fade-out'}`}></div>
      )}

      {/* Pantalla del título final */}
      {showFinalTitle && (
        <div className="final-title-screen">
          <div className="fog-overlay"></div>
          
          <h1 className="game-title-cinematic">
            PLAGA ZOMBIE
          </h1>
          
          <h2 className="game-subtitle-cinematic">
            MANABÍ
          </h2>

          {/* Efecto de gotas de sangre */}
          <div className="blood-effect">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="blood-drop"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1.5 + Math.random()}s`
                }}
              ></div>
            ))}
          </div>

          <p className="continue-prompt">
            Presiona cualquier tecla para continuar...
          </p>
        </div>
      )}
    </div>
  );
};

export default CinematicPlayer;
