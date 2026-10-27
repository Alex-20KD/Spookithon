import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BarrioMapa, CatalogoResponse } from "../../types/api";

// Config oficial para Vite: evita "Worker failed to load".
maplibregl.setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

/** Estilo oscuro mínimo sin claves externas (fallback). */
const DARK_STYLE = {
  version: 8 as const,
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
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#0C1A24" } },
    { id: "roads", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#263746", "line-width": ["interpolate", ["zoom"], 10, 0.4, 14, 1.6] } },
    { id: "buildings", type: "fill", source: "openmaptiles", "source-layer": "building", paint: { "fill-color": "#121C26", "fill-opacity": 0.7 } },
  ],
};

function getStyle(): string | typeof DARK_STYLE {
  const url = import.meta.env.VITE_MAP_STYLE_URL as string | undefined;
  if (url) return url;
  const key =
    (import.meta.env.VITE_MAPTILER_KEY as string | undefined) ||
    (import.meta.env.VITE_MAPTILER_API_KEY as string | undefined) ||
    (import.meta.env.VITE_MAPTILER_TOKEN as string | undefined);
  if (key) return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`;
  return DARK_STYLE;
}

/** Color por nivel de riesgo relativo (0..1 respecto al barrio más afectado). */
function colorRiesgo(ratio: number): string {
  if (ratio < 0.25) return "#38E89A"; // bajo
  if (ratio < 0.5) return "#FF7A45"; // medio
  if (ratio < 0.75) return "#FF4D5A"; // alto
  return "#8B1E2D"; // crítico
}

interface Props {
  barrios: BarrioMapa[];
  catalogo?: CatalogoResponse | null;
}

export default function EpidemicMap({ barrios, catalogo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Centro: promedio de coordenadas de los barrios con geo válida, o Manta.
  const conGeo = barrios.filter((b) => b.lat != null && b.lng != null);
  const centro: [number, number] = conGeo.length
    ? [
        conGeo.reduce((a, b) => a + (b.lng as number), 0) / conGeo.length,
        conGeo.reduce((a, b) => a + (b.lat as number), 0) / conGeo.length,
      ]
    : [-80.72, -0.96];

  // Inicializar el mapa una vez.
  useEffect(() => {
    if (!containerRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: getStyle() as maplibregl.StyleSpecification | string,
        center: centro,
        zoom: 12.4,
      });
    } catch {
      setMapError(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("error", () => setMapError(true));

    map.on("load", () => {
      map.addSource("barrios", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("edificios", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // Halo de barrio (tamaño/color por riesgo).
      map.addLayer({
        id: "barrios-halo",
        type: "circle",
        source: "barrios",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "ratio"], 0, 14, 1, 42],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.18,
          "circle-blur": 0.8,
        },
      });
      // Núcleo del barrio.
      map.addLayer({
        id: "barrios",
        type: "circle",
        source: "barrios",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "ratio"], 0, 6, 1, 16],
          "circle-color": ["get", "color"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#E6EDF3",
          "circle-opacity": 0.9,
        },
      });
      // Edificios de referencia (hospital/mercado/colegios).
      map.addLayer({
        id: "edificios",
        type: "circle",
        source: "edificios",
        paint: {
          "circle-radius": 4,
          "circle-color": "#4DA8FF",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0C141D",
          "circle-opacity": 0.9,
        },
      });

      map.on("mouseenter", "barrios", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 12 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="color:#E6EDF3;font-size:12px">
               <strong>${p.nombre}</strong><br/>
               Infectados (media): ${p.infectados}
             </div>`,
          )
          .addTo(map);
      });
      map.on("mouseleave", "barrios", () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
        popupRef.current = null;
      });

      setMapLoaded(true);
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // Solo al montar: el resto de updates van en el otro efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actualizar los datos cuando cambian barrios/catalogo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const maxInf = Math.max(
      1,
      ...barrios.map((b) => b.infectados_media ?? 0),
    );

    const features = conGeo.map((b) => {
      const inf = b.infectados_media ?? 0;
      const ratio = inf / maxInf;
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [b.lng as number, b.lat as number] },
        properties: {
          nombre: b.nombre,
          infectados: Math.round(inf),
          ratio,
          color: colorRiesgo(ratio),
        },
      };
    });
    (map.getSource("barrios") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features,
    });

    const edificios = (catalogo?.edificios ?? []).map((e) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [e.lng, e.lat] },
      properties: { nombre: e.nombre, tipo: e.tipo },
    }));
    (map.getSource("edificios") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: edificios,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, barrios, catalogo]);

  return (
    <div>
      {mapError && (
        <div className="error-box" role="alert">
          No se pudo inicializar el mapa vectorial. Revisa tu conexión o define
          <code> VITE_MAP_STYLE_URL</code> / <code>VITE_MAPTILER_KEY</code>.
        </div>
      )}
      <div ref={containerRef} className="map-container" style={{ height: 520 }} />
    </div>
  );
}
