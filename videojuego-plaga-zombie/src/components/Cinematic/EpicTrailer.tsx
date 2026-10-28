import React, { useState, useEffect, useRef, useCallback } from 'react';
import './EpicTrailer.css';
import { formatNumber } from '../../utils/format';
import { assetUrl } from '../../utils/assetUrl';

interface EpicTrailerProps {
  onComplete: () => void;
}

// Datos de los personajes
const PERSONAJES = [
  { img: assetUrl('assets/personajes/hacker.png'), name: 'EL HACKER', subtitle: 'Ing. Sistemas', frase: '"Puedo entrar a cualquier sistema..."' },
  { img: assetUrl('assets/personajes/lider.png'), name: 'EL LÍDER', subtitle: 'Administración', frase: '"No dejaré que nadie más muera"' },
  { img: assetUrl('assets/personajes/medico.png'), name: 'EL MÉDICO', subtitle: 'Medicina', frase: '"Encontraré la cura"' },
  { img: assetUrl('assets/personajes/gotica.png'), name: 'LA GÓTICA', subtitle: 'Artes', frase: '"La oscuridad es mi aliada"' },
  { img: assetUrl('assets/personajes/egirl.png'), name: 'LA E-GIRL', subtitle: 'Comunicación', frase: '"Mis seguidores me ayudarán"' }
];

// Zombies especiales
const ZOMBIES = [
  { img: assetUrl('assets/zombies/zombie-corredor.png'), name: 'CORREDOR' },
  { img: assetUrl('assets/zombies/zombie-gotica.png'), name: 'GÓTICA' },
  { img: assetUrl('assets/zombies/zombie-egirl.png'), name: 'E-GIRL VIRAL' },
  { img: assetUrl('assets/zombies/zombie-escupidor.png'), name: 'ESCUPIDOR' },
  { img: assetUrl('assets/zombies/zombie-tanque.png'), name: 'TANQUE' }
];

// Jefes
const JEFES = [
  { img: assetUrl('assets/zombies/jefe-reina.png'), name: 'LA REINA DEL LUTO', hp: 100 },
  { img: assetUrl('assets/zombies/jefe-matriarca.png'), name: 'LA MATRIARCA VIRAL', hp: 100 },
  { img: assetUrl('assets/zombies/jefe-abominacion.png'), name: 'LA ABOMINACIÓN', hp: 100 }
];

// Duración (ms) de cada escena, en el mismo orden que renderScene()
const SCENE_DURATIONS = [
  3000, 3000, 2000, // Acto 1: ULEAM, alerta, "Nadie estaba preparado"
  4000, 4000, 4000, 4000, 4000, // Acto 2: personajes
  4000, // Acto 3: juntos
  2500, 2500, 2500, 2500, 2500, 2000, // Acto 4: zombies y transición
  4000, 4000, 4000, // Jefes
  3000, 5000, // Acto 5: PUCE
  15000, // Acto 6: mapa de infección
  5000 // Final: paciente cero
];

const EpicTrailer: React.FC<EpicTrailerProps> = ({ onComplete }) => {
  const [scene, setScene] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  // Avisar una sola vez aunque coincidan el final y el botón SALTAR
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (audioRef.current) audioRef.current.pause();
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    // Cargar música
    const audio = new Audio(assetUrl('assets/audio/intro-music.mp3'));
    audio.volume = 0.4;
    audio.loop = false;
    audio.play().catch(() => console.log('Audio no disponible'));
    audioRef.current = audio;

    return () => {
      audio.pause();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Línea de tiempo: cada escena se dibuja en renderScene() y dura lo indicado aquí
  useEffect(() => {
    if (scene >= SCENE_DURATIONS.length) {
      finish();
      return;
    }
    timeoutRef.current = setTimeout(() => setScene(scene + 1), SCENE_DURATIONS[scene]);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [scene, finish]);

  const handleSkip = () => finish();

  // Renderizado basado en la escena actual
  const renderScene = () => {
    // ACTO 1
    if (scene === 0) {
      return <div className="black-screen"><TypewriterText text="ULEAM, Manta. Jueves, 19:47" /></div>;
    }
    if (scene === 1) {
      return (
        <div className="alert-screen">
          <div className="alarm-flash"></div>
          <div className="alert-box glitch">
            <div className="alert-icon">⚠️</div>
            <div className="alert-text">BROTE DETECTADO EN EL CAMPUS</div>
            <div className="alert-subtext">CÓDIGO ROJO - EVACUACIÓN INMEDIATA</div>
          </div>
        </div>
      );
    }
    if (scene === 2) {
      return <div className="black-screen"><TypewriterText text="Nadie estaba preparado..." /></div>;
    }

    // ACTO 2 - Personajes
    if (scene >= 3 && scene <= 7) {
      const personajeIndex = scene - 3;
      const p = PERSONAJES[personajeIndex];
      return (
        <div className="personaje-scene">
          <div className="vignette-dark"></div>
          <div className="film-grain"></div>
          <img src={p.img} alt={p.name} className="personaje-img zoom-slow" 
               onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="600"%3E%3Crect width="400" height="600" fill="%23000"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23fff" font-size="24"%3E' + p.name + '%3C/text%3E%3C/svg%3E'; }} 
          />
          <div className="zombie-silhouettes">
            <div className="silhouette silhouette-1"></div>
            <div className="silhouette silhouette-2"></div>
            <div className="silhouette silhouette-3"></div>
          </div>
          <div className="personaje-info">
            <div className="personaje-name">{p.name}</div>
            <div className="personaje-subtitle">{p.subtitle}</div>
            <div className="personaje-frase"><TypewriterText text={p.frase} speed={30} /></div>
          </div>
        </div>
      );
    }

    // ACTO 3 - Juntos
    if (scene === 8) {
      return (
        <div className="personajes-juntos-scene">
          <div className="personajes-grid">
            {PERSONAJES.map((p, i) => (
              <div key={i} className="personaje-mini flash-in" style={{ animationDelay: `${i * 0.3}s` }}>
                <img src={p.img} alt={p.name} 
                     onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect width="200" height="300" fill="%23000"/%3E%3C/svg%3E'; }}
                />
              </div>
            ))}
          </div>
          <div className="uniting-text"><TypewriterText text="Solos no iban a sobrevivir." /></div>
        </div>
      );
    }

    // ACTO 4 - Zombies
    if (scene >= 9 && scene <= 13) {
      const zombieIndex = scene - 9;
      const z = ZOMBIES[zombieIndex];
      return (
        <div className="zombie-scene shake">
          <div className="red-flash"></div>
          <img src={z.img} alt={z.name} className="zombie-img pan-fast"
               onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="600"%3E%3Crect width="400" height="600" fill="%23300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23f00" font-size="32"%3E' + z.name + '%3C/text%3E%3C/svg%3E'; }}
          />
          <div className="zombie-name-big">{z.name}</div>
        </div>
      );
    }

    if (scene === 14) {
      return <div className="black-screen red-tint"><TypewriterText text="Y entonces llegaron ellas..." /></div>;
    }

    // Jefes
    if (scene >= 15 && scene <= 17) {
      const jefeIndex = scene - 15;
      const j = JEFES[jefeIndex];
      return (
        <div className="jefe-scene">
          <div className="lightning-effect"></div>
          <img src={j.img} alt={j.name} className="jefe-img zoom-dramatic"
               onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="500" height="700"%3E%3Crect width="500" height="700" fill="%23000"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%238b0000" font-size="36" font-weight="bold"%3E' + j.name + '%3C/text%3E%3C/svg%3E'; }}
          />
          <div className="jefe-name-epic">{j.name}</div>
          <div className="boss-health-bar">
            <div className="boss-hp-fill"></div>
            <div className="boss-hp-text">HP: {j.hp}%</div>
          </div>
        </div>
      );
    }

    // ACTO 5 - PUCE
    if (scene === 18) {
      return <div className="black-screen"><TypewriterText text="Pero la PUCE no los iba a dejar solos." /></div>;
    }

    if (scene === 19) {
      return (
        <div className="puce-scene">
          <div className="blue-particles"></div>
          <img src={assetUrl('assets/personajes/estratega.png')} alt="Estratega PUCE" className="estratega-img flash-blue"
               onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="600"%3E%3Crect width="400" height="600" fill="%23001a33"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%2300bfff" font-size="28" font-weight="bold"%3EESTRATEGAPUCE%3C/text%3E%3C/svg%3E'; }}
          />
          <div className="drones">
            <div className="drone drone-1"></div>
            <div className="drone drone-2"></div>
            <div className="drone drone-3"></div>
            <div className="drone drone-4"></div>
          </div>
          <div className="estratega-name">EL ESTRATEGA DE LA PUCE</div>
        </div>
      );
    }

    // ACTO 6 - Mapa
    if (scene === 20) {
      return <MapaInfeccionScene />;
    }

    // Final
    if (scene === 21) {
      return (
        <div className="paciente-cero-scene">
          <img src={assetUrl('assets/zombies/jefe-paciente-cero.png')} alt="Paciente Cero" className="paciente-cero-img"
               onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="500" height="700"%3E%3Crect width="500" height="700" fill="%23000"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23ff0000" font-size="48" font-weight="bold"%3EPACIENTECERO%3C/text%3E%3C/svg%3E'; }}
          />
          <div className="glowing-eyes"></div>
          <div className="paciente-cero-text"><TypewriterText text="Todo empezó con él." /></div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="epic-trailer">
      <button className="skip-button-epic" onClick={handleSkip}>⏭ SALTAR</button>
      {renderScene()}
    </div>
  );
};

// Componente de texto con efecto typewriter
const TypewriterText: React.FC<{ text: string; speed?: number }> = ({ text, speed = 50 }) => {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.substring(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return <span className="typewriter">{displayText}<span className="cursor">|</span></span>;
};

// Componente del mapa con infección animada
const MapaInfeccionScene: React.FC = () => {
  const [infectados, setInfectados] = useState(0);
  const [cantonActual, setCantonActual] = useState(0);

  const CANTONES_ORDEN = [
    'Manta', 'Jaramijó', 'Montecristi', 'Portoviejo', 'Rocafuerte',
    'Jipijapa', 'Puerto López', 'Santa Ana', '24 de Mayo', 'Olmedo',
    'Chone', 'Sucre', 'San Vicente', 'Jama', 'Pedernales',
    'El Carmen', 'Flavio Alfaro', 'Tosagua', 'Junín', 'Bolívar', 'Pichincha', 'Paján'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      if (cantonActual < CANTONES_ORDEN.length) {
        setCantonActual(prev => prev + 1);
        setInfectados(prev => prev + Math.floor(Math.random() * 50000) + 10000);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [cantonActual]);

  return (
    <div className="mapa-infeccion-scene">
      <div className="mapa-container-epic">
        <svg viewBox="-81 -2 3 4" className="mapa-svg">
          {/* Aquí se renderizaría el GeoJSON real */}
          <text x="-80" y="0" fill="#fff" fontSize="0.3">MAPA DE MANABÍ</text>
        </svg>
        <div className="infection-overlay pulse-red"></div>
      </div>
      <div className="mapa-info">
        <div className="infected-counter">
          <div className="counter-label">INFECTADOS</div>
          <div className="counter-number">{formatNumber(infectados)}</div>
        </div>
        {cantonActual < CANTONES_ORDEN.length && (
          <div className="canton-alert flash-in">
            🚨 {CANTONES_ORDEN[cantonActual]} INFECTADO
          </div>
        )}
        <div className="news-ticker">
          <div className="ticker-text">
            ESTADO DE EMERGENCIA • EVITAR CONTACTO CON INFECTADOS • MANTENERSE EN CASA • PROVINCIA EN CUARENTENA TOTAL
          </div>
        </div>
      </div>
      {cantonActual >= CANTONES_ORDEN.length && (
        <div className="final-map-text"><TypewriterText text="Manabí está cayendo." speed={80} /></div>
      )}
    </div>
  );
};

export default EpicTrailer;
