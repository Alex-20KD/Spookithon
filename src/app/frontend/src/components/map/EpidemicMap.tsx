import { useEffect, useRef, useState } from "react";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BarrioMapa, CatalogoResponse } from "../../types/api";
import type { Brote } from "../../types/brotes";

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
    { id: "roads", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#3B5068", "line-width": ["interpolate", ["zoom"], 10, 0.5, 14, 1.8] } },
    { id: "buildings", type: "fill", source: "openmaptiles", "source-layer": "building", paint: { "fill-color": "#1A2533", "fill-opacity": 0.85 } },
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





interface Props {
  barrios: BarrioMapa[];
  catalogo?: CatalogoResponse | null;
  dia?: number;
  movimientos?: { origen: string; destino: string; cantidad: number }[];
  brotes?: Brote[];
  contagiosPorLugar?: { lugar_id: number; lng: number; lat: number; nuevos: number }[];
  showHeatmap?: boolean;
  showMovimientos?: boolean;
  showEventos?: boolean;
}

export default function EpidemicMap({ barrios, catalogo, dia, movimientos, brotes, contagiosPorLugar, showHeatmap = true, showMovimientos = false, showEventos = true }: Props) {
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
        pitch: 60,
        bearing: -15,
        maxPitch: 85,
      });
    } catch {
      setMapError(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.on("error", () => setMapError(true));

    map.on("load", () => {
      map.addSource("edificios", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("movimientos", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("mask", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("contagios", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("manta", { type: "geojson", data: "/geojson/manta_cabecera_cantonal.geojson" });
      map.addSource("eventos", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // Heatmap de contagios por lugar.
      map.addLayer({
        id: "contagios-heat",
        type: "heatmap",
        source: "contagios",
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "nuevos"], 0, 0, 10, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 14, 3],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.2, "#38E89A",
            0.4, "#F2C94C",
            0.6, "#FF7A45",
            0.8, "#FF4D5A",
            1, "#8B1E2D",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 14, 30],
          "heatmap-opacity": 0.7,
        },
      });

      // Máscara para ocultar heatmap fuera del territorio de Manta.
      map.addLayer({
        id: "mask-fill",
        type: "fill",
        source: "mask",
        paint: {
          "fill-color": "#080D13",
          "fill-opacity": 1,
        },
      });

      // Edificios de referencia (hospital/mercado/colegios).
      map.addLayer({
        id: "edificios",
        type: "circle",
        source: "edificios",
        paint: {
          "circle-radius": 5,
          "circle-color": [
            "match", ["get", "tipo"],
            "hospital", "#FF4D5A",
            "mercado", "#FF7A45",
            "colegio", "#4DA8FF",
            "bus", "#38E89A",
            "#4DA8FF",
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0C141D",
          "circle-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "contagios-points",
        type: "circle",
        source: "contagios",
        paint: {
          "circle-radius": 4,
          "circle-color": "#FF4D5A",
          "circle-opacity": 0,
        },
      });

      // Líneas de movilidad agregada entre barrios.
      map.addLayer({
        id: "movimientos",
        type: "line",
        source: "movimientos",
        paint: {
          "line-color": "#4DA8FF",
          "line-width": ["interpolate", ["linear"], ["get", "cantidad"], 1, 1, 20, 4],
          "line-opacity": 0.7,
        },
      });

      map.addLayer({
        id: "eventos",
        type: "circle",
        source: "eventos",
        paint: {
          "circle-radius": 8,
          "circle-color": "#FF7A45",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#080D13",
        },
      });

      map.addLayer({
        id: "manta-fill",
        type: "fill",
        source: "manta",
        paint: {
          "fill-color": "#0C141D",
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "manta-line",
        type: "line",
        source: "manta",
        paint: {
          "line-color": "#4DA8FF",
          "line-width": 1.5,
        },
      });

      map.on("mouseenter", "contagios-points", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as Record<string, unknown>;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 12, className: "map-popup-dark" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="color:#F1F5F9;font-size:13px;min-width:160px">
               <div style="font-weight:700;font-size:14px;margin-bottom:4px">Contagio registrado</div>
               <div>Nuevos contagios: <strong>${Number(props.nuevos).toLocaleString("es-EC")}</strong></div>
               <div>Día de simulación: <strong>${dia ?? 0}</strong></div>
               <div style="font-size:11px;color:#8B9BB0;margin-top:4px">Datos agregados (real)</div>
             </div>`,
          )
          .addTo(map);
      });
      map.on("mouseleave", "contagios-points", () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
        popupRef.current = null;
      });

      // Edificios 3D ilustrativos (si el estilo ofrece geometrías compatibles).
      try {
        if (map.getSource("openmaptiles")) {
          map.addLayer({
            id: "edificios-3d",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            paint: {
              "fill-extrusion-color": "#16222E",
              "fill-extrusion-height": ["*", ["coalesce", ["get", "height"], 8], 2.2],
              "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
              "fill-extrusion-opacity": 0.5,
            },
          });
        }
      } catch {
        // El proveedor puede no ofrecer geometrías compatibles; se ignora.
      }

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const setVis = (id: string, v: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
    };
    setVis("contagios-heat", showHeatmap);
    setVis("movimientos", showMovimientos);
    setVis("eventos", showEventos);
  }, [mapLoaded, showHeatmap, showMovimientos, showEventos]);

  // Actualizar los datos cuando cambian barrios/catalogo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const contagiosFeatures = (contagiosPorLugar ?? []).map((c) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
      properties: { nuevos: c.nuevos },
    }));
    (map.getSource("contagios") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: contagiosFeatures,
    });

    // Máscara invertida de Manta.
    fetch("/geojson/manta_cabecera_cantonal.geojson")
      .then((r) => r.json())
      .then((g) => {
        const mantaCoords = g.features?.[0]?.geometry?.coordinates;
        if (!mantaCoords) return;
        const maskFeature = {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
              ...mantaCoords,
            ],
          },
          properties: {},
        };
        (map.getSource("mask") as maplibregl.GeoJSONSource)?.setData({
          type: "FeatureCollection",
          features: [maskFeature],
        });
      })
      .catch(() => {});

    const edificios = (catalogo?.edificios ?? []).map((e) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [e.lng, e.lat] },
      properties: { nombre: e.nombre, tipo: e.tipo },
    }));
    (map.getSource("edificios") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: edificios,
    });

    // Líneas de movilidad entre barrios (coordenadas del catálogo).
    const barrioCoord = new Map((catalogo?.barrios ?? []).map((b) => [b.id, b]));
    const coordDe = (id: string) => {
      const c = barrioCoord.get(id);
      if (c) return [c.lng, c.lat] as [number, number];
      const b = barrios.find((x) => x.id === id);
      if (b && b.lat != null && b.lng != null) return [b.lng as number, b.lat as number];
      return null;
    };
    const lineas = (movimientos ?? [])
      .map((m) => {
        const a = coordDe(m.origen);
        const de = coordDe(m.destino);
        if (!a || !de) return null;
        return {
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: [a, de] },
          properties: { cantidad: m.cantidad },
        };
      })
      .filter(Boolean);
    (map.getSource("movimientos") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: lineas as any,
    });

    const eventosFeatures = (brotes ?? [])
      .filter((b) => b.activo && (dia == null || b.dia <= dia))
      .map((b) => {
        const c = (catalogo?.barrios ?? []).find((x) => x.id === b.barrio_id);
        if (!c) return null;
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
          properties: { tipo: b.tipo, dia: b.dia },
        };
      })
      .filter(Boolean);
    (map.getSource("eventos") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: eventosFeatures as any,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, barrios, catalogo, movimientos, brotes, contagiosPorLugar]);

  const moverCamara = (pitch: number, bearing: number, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ pitch, bearing, ...(zoom != null ? { zoom } : {}), duration: 900 });
  };

  const centrarManta = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [-80.72, -0.96], zoom: 12.4, pitch: 0, bearing: 0, duration: 1200 });
  };

  return (
    <div>
      {mapError && (
        <div className="error-box" role="alert">
          No se pudo inicializar el mapa vectorial. Revisa tu conexión o define
          <code> VITE_MAP_STYLE_URL</code> / <code>VITE_MAPTILER_KEY</code>.
        </div>
      )}
      <div style={{ position: "relative" }}>
        <div ref={containerRef} className="map-container" style={{ height: 520 }} />
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            zIndex: 5,
          }}
        >
          <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => moverCamara(0, 0)}>
            Vista superior
          </button>
          <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => moverCamara(45, -15)}>
            Vista 3D
          </button>
          <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={centrarManta}>
            Centrar Manta
          </button>
        </div>
        {dia != null && (
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: 10,
              background: "rgba(8,13,19,0.7)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "4px 8px",
              fontSize: 12,
              color: "var(--muted)",
              zIndex: 5,
            }}
          >
            Día ilustrativo: {dia}
          </div>
        )}
      </div>
    </div>
  );
}
