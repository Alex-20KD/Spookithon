import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, useMap } from "react-leaflet";
import Card from "../ui/Card";
import Pill from "../ui/Pill";
import AlertPanel from "../ui/AlertPanel";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis } from "recharts";
import { Play, Pause } from "lucide-react";
import { useSimulation } from "../../context/SimulationContext";
import { SECTORS } from "../../data/sectors";
import { FOCI } from "../../data/foci";
import { sectorStats } from "../../services/simulationService";
import type { RiskLevel } from "../../types";

const riskColor: Record<RiskLevel, string> = {
  bajo: "#38E89A",
  medio: "#FF7A45",
  alto: "#FF4D5A",
  critico: "#8B1E2D",
};

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 14, { duration: 1.2 });
  }, [lat, lng, map]);
  return null;
}

export default function EpidemiologicalMap() {
  const { day, setDay, params, isPlaying, setIsPlaying, selectedSectorId, setSelectedSectorId } = useSimulation();
  const [tileError, setTileError] = useState(false);
  const [riskFilter, setRiskFilter] = useState<"todos" | RiskLevel>("todos");

  const stats = sectorStats(day, params);
  const statsById = Object.fromEntries(stats.map((s) => [s.sector.id, s]));
  const selected = selectedSectorId ? SECTORS.find((s) => s.id === selectedSectorId) : null;
  const selectedStats = selectedSectorId ? statsById[selectedSectorId] : null;

  const filteredSectors = stats.filter((s) => riskFilter === "todos" || s.riskLevel === riskFilter);

  const flyTarget = selected ? { lat: selected.lat, lng: selected.lng } : null;

  return (
    <div className="split">
      <div>
        <div className="map-container">
          {tileError && (
            <div style={{ position: "absolute", zIndex: 1000, top: 10, left: 10, background: "#16222E", padding: 8, borderRadius: 8, border: "1px solid #263746", fontSize: 12 }}>
              No se pudieron cargar las teselas del mapa. Se mantiene el contenedor interactivo.
            </div>
          )}
          <MapContainer center={[-0.96, -80.72]} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap &copy; CARTO'
              eventHandlers={{ tileerror: () => setTileError(true) }}
            />
            {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}

            {filteredSectors.map((s) => {
              const color = riskColor[s.riskLevel];
              return (
                <React.Fragment key={s.sector.id}>
                  <Circle
                    center={[s.sector.lat, s.sector.lng]}
                    radius={1100}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 1 }}
                  />
                  <Circle
                    center={[s.sector.lat, s.sector.lng]}
                    radius={320}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 2, className: "pulse-circle" }}
                    eventHandlers={{ click: () => setSelectedSectorId(s.sector.id) }}
                  >
                    <Tooltip>
                      <div>
                        <strong>{s.sector.name}</strong>
                        <br />Riesgo: {s.riskLevel}
                        <br />Infectados est.: {s.estimatedInfected}
                        <br />Focos: {s.activeFoci}
                      </div>
                    </Tooltip>
                  </Circle>
                </React.Fragment>
              );
            })}

            {FOCI.filter((f) => {
              const st = statsById[f.sectorId];
              if (!st) return true;
              return riskFilter === "todos" || st.riskLevel === riskFilter;
            }).map((f) => {
              const st = statsById[f.sectorId];
              const color = st ? riskColor[st.riskLevel] : "#FF4D5A";
              return (
                <CircleMarker
                  key={f.id}
                  center={[f.lat, f.lng]}
                  radius={6 + f.intensity * 6}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1, className: "pulse-circle" }}
                >
                  <Tooltip>Foco {f.id} · intensidad {f.intensity}</Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        <div className="timeline card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn" onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? "Pausar" : "Reproducir"}
            </button>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Línea temporal</span>
          </div>
          <div className="timeline">
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Día 0</span>
            <input
              type="range"
              min={0}
              max={params.days}
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Día {params.days}</span>
          </div>
          <div style={{ textAlign: "center", marginTop: 6, fontSize: 13 }}>
            Día actual: <strong>{day}</strong>
          </div>
        </div>
      </div>

      <div className="map-side">
        <Card title="Filtros de riesgo">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["todos", "bajo", "medio", "alto", "critico"] as const).map((r) => (
              <button
                key={r}
                className={`btn ${riskFilter === r ? "primary" : "ghost"}`}
                style={{ padding: "6px 10px", fontSize: 12 }}
                onClick={() => setRiskFilter(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Sector seleccionado">
          {selected && selectedStats ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{selected.name}</div>
              <div className="bar-row"><span>Riesgo</span><Pill color={selectedStats.riskLevel === "bajo" ? "green" : selectedStats.riskLevel === "medio" ? "orange" : "red"}>{selectedStats.riskLevel}</Pill></div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Infectados estimados: <strong style={{ color: "var(--text)" }}>{selectedStats.estimatedInfected}</strong></div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Focos activos: <strong style={{ color: "var(--text)" }}>{selectedStats.activeFoci}</strong></div>
              <div className="mini-chart" style={{ marginTop: 10 }}>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={selectedStats.miniSeries}>
                    <XAxis dataKey="day" hide />
                    <YAxis hide />
                    <Line type="monotone" dataKey="value" stroke="#FF4D5A" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Zombis estimados por día (sector)</div>
            </>
          ) : (
            <div className="empty">Selecciona un sector en el mapa.</div>
          )}
        </Card>

        <Card title="Leyenda">
          <div className="legend">
            {(["bajo", "medio", "alto", "critico"] as RiskLevel[]).map((r) => (
              <div key={r} className="legend-item">
                <span className="legend-dot" style={{ background: riskColor[r] }} />
                Riesgo {r}
              </div>
            ))}
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#FF4D5A", boxShadow: "0 0 8px #FF4D5A" }} />
              Foco de infección
            </div>
          </div>
        </Card>

        <Card title="Alertas">
          <AlertPanel alerts={selectedStats ? [`Sector ${selectedStats.sector.name}: riesgo ${selectedStats.riskLevel}.`, "Monitoreo continuo activo."] : ["Selecciona un sector para ver alertas."]} />
        </Card>
      </div>
    </div>
  );
}


