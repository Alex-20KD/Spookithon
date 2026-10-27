import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Configuración oficial para Vite: evita "Worker failed to load".
maplibregl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis } from "recharts";
import { Play, Pause } from "lucide-react";
import { useSimulation } from "../../context/SimulationContext";
import { SECTORS } from "../../data/sectors";
import { FOCI } from "../../data/foci";
import { sectorStats } from "../../services/simulationService";
import type { RiskLevel } from "../../types";
import Card from "../ui/Card";
import Pill from "../ui/Pill";
import AlertPanel from "../ui/AlertPanel";

const riskColor: Record<RiskLevel, string> = {
  bajo: "#38E89A",
  medio: "#FF7A45",
  alto: "#FF4D5A",
  critico: "#8B1E2D",
};

const DARK_STYLE: any = {
  version: 8,
  name: "PLAGA ZERO Dark",
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    openmaptiles: {
      type: "vector",
      tiles: ["https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf"],
      minzoom: 0,
      maxzoom: 14,
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#080D13" } },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#0C1A24", "fill-opacity": 1 } },
    { id: "landcover", type: "fill", source: "openmaptiles", "source-layer": "landcover", paint: { "fill-color": "#0A1219", "fill-opacity": 0.7 } },
    { id: "landuse", type: "fill", source: "openmaptiles", "source-layer": "landuse", paint: { "fill-color": "#0E1620", "fill-opacity": 0.6 } },
    { id: "roads", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#263746", "line-width": ["interpolate", ["zoom"], 10, 0.4, 14, 1.6, 16, 3 ] } },
    { id: "buildings", type: "fill", source: "openmaptiles", "source-layer": "building", paint: { "fill-color": "#121C26", "fill-opacity": 0.75 } },
  ],
};

function getStyle(): string | any {
  const url = import.meta.env.VITE_MAP_STYLE_URL as string | undefined;
  if (url) return url;
  const key =
    (import.meta.env.VITE_MAPTILER_KEY as string | undefined) ||
    (import.meta.env.VITE_MAPTILER_API_KEY as string | undefined) ||
    (import.meta.env.VITE_MAPTILER_TOKEN as string | undefined);
  if (key) return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`;
  return DARK_STYLE;
}

export default function EpidemiologicalMap() {
  const { day, setDay, params, isPlaying, setIsPlaying, selectedSectorId, setSelectedSectorId } = useSimulation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [riskFilter, setRiskFilter] = useState<"todos" | RiskLevel>("todos");

  const stats = sectorStats(day, params);
  const statsById = Object.fromEntries(stats.map((s) => [s.sector.id, s]));
  const selected = selectedSectorId ? SECTORS.find((s) => s.id === selectedSectorId) : null;
  const selectedStats = selectedSectorId ? statsById[selectedSectorId] : null;

  // Init map
  useEffect(() => {
    if (!containerRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: getStyle(),
        center: [-80.72, -0.96],
        zoom: 12.6,
        pitch: 45,
        bearing: 0,
      });
    } catch (e) {
      setMapError(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");

    map.on("error", () => setMapError(true));

    map.on("load", () => {
      // 3D buildings
      try {
        if (!map.getLayer("buildings-3d")) {
          map.addLayer({
            id: "buildings-3d",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            paint: {
              "fill-extrusion-color": "#1A2A38",
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.7,
            },
          });
        }
      } catch {
        // ignore if source unavailable
      }

      // Sources
      map.addSource("sectors", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("foci", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("heatmap", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // Heatmap
      map.addLayer({
        id: "heatmap",
        type: "heatmap",
        source: "heatmap",
        paint: {
          "heatmap-weight": ["coalesce", ["get", "weight"], 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 15, 2 ],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.2, "rgba(255,122,69,0.4)",
            0.4, "rgba(255,77,90,0.6)",
            0.7, "rgba(255,77,90,0.85)",
            1, "rgba(139,30,45,1)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 15, 24 ],
          "heatmap-opacity": 0.85,
        },
      });

      // Sector halos
      map.addLayer({
        id: "sector-halos",
        type: "circle",
        source: "sectors",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 14, 34, 16, 50],
          "circle-color": ["match", ["get", "riskLevel"], "bajo", "#38E89A", "medio", "#FF7A45", "alto", "#FF4D5A", "critico", "#8B1E2D", "#4DA8FF"],
          "circle-opacity": 0.12,
          "circle-blur": 0.9,
        },
      });

      // Sector cores
      map.addLayer({
        id: "sectors",
        type: "circle",
        source: "sectors",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 11, 16, 16],
          "circle-color": ["match", ["get", "riskLevel"], "bajo", "#38E89A", "medio", "#FF7A45", "alto", "#FF4D5A", "critico", "#8B1E2D", "#4DA8FF"],
          "circle-stroke-width": ["case", ["get", "selected"], 3, 1.5],
          "circle-stroke-color": ["case", ["get", "selected"], "#4DA8FF", "#E6EDF3"],
          "circle-opacity": 0.9,
        },
      });

      // Foci halos
      map.addLayer({
        id: "foci-halo",
        type: "circle",
        source: "foci",
        paint: {
          "circle-radius": ["*", ["+", 6, ["*", ["get", "intensity"], 8]], 2.2],
          "circle-color": "#FF4D5A",
          "circle-opacity": 0.18,
          "circle-blur": 0.8,
        },
      });

      // Foci cores
      map.addLayer({
        id: "foci",
        type: "circle",
        source: "foci",
        paint: {
          "circle-radius": ["+", 4, ["*", ["get", "intensity"], 6]],
          "circle-color": "#FF4D5A",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#FFB3B8",
          "circle-opacity": 0.95,
        },
      });

      // Hover popup
      map.on("mouseenter", "sectors", (e: any) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as any;
        const html = `<div style="color:#E6EDF3;font-size:12px">
          <strong>${p.name}</strong><br/>Riesgo: ${p.riskLevel}<br/>Infectados est.: ${p.estimatedInfected}<br/>Focos: ${p.activeFoci}
        </div>`;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);
      });
      map.on("mouseleave", "sectors", () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
        popupRef.current = null;
      });
      map.on("click", "sectors", (e: any) => {
        const f = e.features?.[0];
        if (f?.properties?.id) setSelectedSectorId(f.properties.id);
      });

      setMapLoaded(true);
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update data when day/params/filter change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const filtered = riskFilter === "todos" ? stats : stats.filter((s) => s.riskLevel === riskFilter);

    const sectorFeatures: any[] = filtered.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.sector.lng, s.sector.lat] },
      properties: {
        id: s.sector.id,
        name: s.sector.name,
        riskLevel: s.riskLevel,
        estimatedInfected: s.estimatedInfected,
        activeFoci: s.activeFoci,
        selected: s.sector.id === selectedSectorId,
      },
    }));

    const allowedSectorIds = new Set(filtered.map((s) => s.sector.id));
    const fociFeatures: any[] = FOCI.filter((f) => allowedSectorIds.has(f.sectorId)).map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.lng, f.lat] },
      properties: { id: f.id, sectorId: f.sectorId, intensity: f.intensity },
    }));

    const heatmapFeatures: any[] = fociFeatures.map((f) => ({
      ...f,
      properties: { ...f.properties, weight: (f.properties.intensity as number) * (0.3 + day / Math.max(1, params.days)) },
    }));

    const sectorsSrc = map.getSource("sectors") as maplibregl.GeoJSONSource;
    const fociSrc = map.getSource("foci") as maplibregl.GeoJSONSource;
    const heatSrc = map.getSource("heatmap") as maplibregl.GeoJSONSource;
    sectorsSrc?.setData({ type: "FeatureCollection", features: sectorFeatures } as any);
    fociSrc?.setData({ type: "FeatureCollection", features: fociFeatures } as any);
    heatSrc?.setData({ type: "FeatureCollection", features: heatmapFeatures } as any);
  }, [mapLoaded, day, params, riskFilter, stats, selectedSectorId]);

  // Fly to selected sector
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !selectedSectorId) return;
    const sector = SECTORS.find((s) => s.id === selectedSectorId);
    if (sector) {
      map.flyTo({ center: [sector.lng, sector.lat], zoom: 14, pitch: 50, duration: 1200 });
    }
  }, [selectedSectorId, mapLoaded]);

  // Pulse animation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    let raf = 0;
    const animate = () => {
      const factor = 1 + Math.sin(Date.now() / 400) * 0.25;
      try {
        map.setPaintProperty("foci", "circle-radius", ["*", ["+", 4, ["*", ["get", "intensity"], 6]], factor]);
        map.setPaintProperty("foci-halo", "circle-radius", ["*", ["*", ["+", 6, ["*", ["get", "intensity"], 8]], 2.2], factor]);
      } catch {
        // ignore
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [mapLoaded]);

  return (
    <div className="split">
      <div>
        {mapError && (
          <div style={{ position: "absolute", zIndex: 5, top: 10, left: 10, background: "#16222E", padding: 8, borderRadius: 8, border: "1px solid #263746", fontSize: 12 }}>
            No se pudo inicializar el mapa vectorial. Verifica la conexión o la variable VITE_MAP_STYLE_URL.
          </div>
        )}
        <div ref={containerRef} className="map-container" style={{ height: 620 }} />
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
          Coordenadas de sectores aproximadas. Estilos base configurables con VITE_MAP_STYLE_URL / VITE_MAPTILER_KEY.
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
              <div style={{ marginBottom: 6 }}>
                <Pill color={selectedStats.riskLevel === "bajo" ? "green" : selectedStats.riskLevel === "medio" ? "orange" : "red"}>{selectedStats.riskLevel}</Pill>
              </div>
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
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#FF4D5A", opacity: 0.4 }} />
              Heatmap de contagio
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