import { Play, Pause, SkipForward, RotateCcw } from "lucide-react";
import { useSimulation } from "../../context/SimulationContext";

export default function SimulationControls() {
  const { isPlaying, setIsPlaying, day, setDay, params, runSimulation } = useSimulation();
  return (
    <div className="sim-controls">
      <button className="btn primary" onClick={() => setIsPlaying(!isPlaying)}>
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        {isPlaying ? "Pausar" : "Iniciar"}
      </button>
      <button className="btn" onClick={() => setDay(Math.min(params.days, day + 1))}>
        <SkipForward size={16} /> Avanzar
      </button>
      <button className="btn" onClick={() => { setDay(0); setIsPlaying(false); }}>
        <RotateCcw size={16} /> Reiniciar
      </button>
      <button className="btn ghost" onClick={runSimulation}>
        Recalcular
      </button>
      <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>
        Día actual: <strong style={{ color: "var(--text)" }}>{day}</strong> / {params.days}
      </div>
    </div>
  );
}