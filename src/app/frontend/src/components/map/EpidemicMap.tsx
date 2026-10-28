import { useEffect, useMemo, useRef, useState } from "react";
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

/** Color por nivel de riesgo relativo (0..1 respecto al barrio más afectado). */
function colorRiesgo(ratio: number): string {
  if (ratio < 0.25) return "#38E89A"; // bajo
  if (ratio < 0.5) return "#FF7A45"; // medio
  if (ratio < 0.75) return "#FF4D5A"; // alto
  return "#8B1E2D"; // crítico
}

function nivelRiesgo(ratio: number): string {
  if (ratio < 0.25) return "Bajo";
  if (ratio < 0.5) return "Medio";
  if (ratio < 0.75) return "Alto";
  return "Crítico";
}


function generarHexGrid(barrios: BarrioMapa[], sizeDeg = 0.0045): { id: string; lng: number; lat: number; polygon: [number, number][] }[] {
  if (!barrios.length) return [];
  const lngs = barrios.map((b) => b.lng as number).filter((v) => v != null);
  const lats = barrios.map((b) => b.lat as number).filter((v) => v != null);
  const minLng = Math.min(...lngs) - 0.02;
  const maxLng = Math.max(...lngs) + 0.02;
  const minLat = Math.min(...lats) - 0.02;
  const maxLat = Math.max(...lats) + 0.02;

  const hexes: { id: string; lng: number; lat: number; polygon: [number, number][] }[] = [];
  let idx = 0;
  const hexW = sizeDeg * Math.sqrt(3);
  const hexH = sizeDeg * 1.5;
  for (let lat = minLat; lat <= maxLat; lat += hexH * 0.75) {
    const row = Math.round((lat - minLat) / (hexH * 0.75));
    const offset = row % 2 === 0 ? 0 : hexW / 2;
    for (let lng = minLng + offset; lng <= maxLng; lng += hexW) {
      const poly: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        const x = lng + sizeDeg * Math.cos(angle);
        const y = lat + sizeDeg * Math.sin(angle);
        poly.push([x, y]);
      }
      poly.push(poly[0]);
      hexes.push({ id: `hex-${idx++}`, lng, lat, polygon: poly });
    }
  }
  return hexes;
}

function hexNearestBarrio(lng: number, lat: number, barrios: BarrioMapa[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const b of barrios) {
    if (b.lat == null || b.lng == null) continue;
    const d = (b.lng - lng) ** 2 + (b.lat - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = b.id;
    }
  }
  return best;
}

interface Props {
  barrios: BarrioMapa[];
  catalogo?: CatalogoResponse | null;
  dia?: number;
  movimientos?: { origen: string; destino: string; cantidad: number }[];
  brotes?: Brote[];
}

export default function EpidemicMap({ barrios, catalogo, dia, movimientos, brotes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Centro: promedio de coordenadas de los barrios con geo válida, o Manta.
  const conGeo = barrios.filter((b) => b.lat != null && b.lng != null);

  const hexGrid = useMemo(() => generarHexGrid(conGeo.length ? conGeo : barrios, 0.004), [barrios]);
  const hexesPorBarrio = useMemo(() => {
    const map = new Map<string, typeof hexGrid>();
    for (const h of hexGrid) {
      const bid = hexNearestBarrio(h.lng, h.lat, conGeo.length ? conGeo : barrios);
      if (!bid) continue;
      if (!map.has(bid)) map.set(bid, []);
      map.get(bid)!.push(h);
    }
    for (const [bid, hs] of map) {
      const b = (conGeo.length ? conGeo : barrios).find((x) => x.id === bid);
      if (!b) continue;
      hs.sort((a, c) => (a.lng - (b.lng as number)) ** 2 + (a.lat - (b.lat as number)) ** 2 - ((c.lng - (b.lng as number)) ** 2 + (c.lat - (b.lat as number)) ** 2));
    }
    return map;
  }, [hexGrid, barrios]);
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
      map.addSource("barrios", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("edificios", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("movimientos", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("hexes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("eventos", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // Heatmap de contagios (agregado por barrio).
      map.addLayer({
        id: "barrios-heat",
        type: "heatmap",
        source: "barrios",
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "ratio"], 0, 0, 1, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 14, 3],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.2, "#38E89A",
            0.4, "#FF7A45",
            0.6, "#FF4D5A",
            1, "#8B1E2D",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 14, 40],
          "heatmap-opacity": 0.55,
        },
      });

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
        id: "hexes-fill",
        type: "fill",
        source: "hexes",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["get", "opacity"],
        },
      });
      map.addLayer({
        id: "hexes-line",
        type: "line",
        source: "hexes",
        paint: {
          "line-color": "#263746",
          "line-width": 0.5,
          "line-opacity": 0.4,
        },
      });

      map.on("mouseenter", "barrios", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as Record<string, unknown>;
        const ratio = Number(props.ratio ?? 0);
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 12, className: "map-popup-dark" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="color:#F1F5F9;font-size:13px;min-width:160px">
               <div style="font-weight:700;font-size:14px;margin-bottom:4px">${props.nombre}</div>
               <div>Infectados (media): <strong>${Number(props.infectados).toLocaleString("es-EC")}</strong></div>
               <div>Nivel de riesgo: <strong style="color:${props.color}">${nivelRiesgo(ratio)}</strong></div>
               <div>Día de simulación: <strong>${dia ?? 0}</strong></div>
               <div style="font-size:11px;color:#8B9BB0;margin-top:4px">Datos agregados (real) · animación por día ilustrativa</div>
             </div>`,
          )
          .addTo(map);
      });
      map.on("mouseleave", "barrios", () => {
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

    const maxInfHex = Math.max(1, ...barrios.map((b) => b.infectados_media ?? 0));
    const hexFeatures: any[] = [];
    for (const b of barrios) {
      const acum = b.infectados_media ?? 0;
      if (acum <= 0) continue;
      const hs = hexesPorBarrio.get(b.id) ?? [];
      const ratio = acum / maxInfHex;
      const k = Math.min(hs.length, Math.max(1, Math.ceil(ratio * hs.length)));
      for (let i = 0; i < k; i++) {
        const h = hs[i];
        hexFeatures.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [h.polygon] },
          properties: {
            barrio: b.id,
            color: colorRiesgo(ratio),
            opacity: 0.35 + 0.45 * ratio,
          },
        });
      }
    }
    (map.getSource("hexes") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: hexFeatures,
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
  }, [mapLoaded, barrios, catalogo, movimientos, brotes, hexGrid, hexesPorBarrio]);

  const moverCamara = (pitch: number, bearing: number, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ pitch, bearing, ...(zoom != null ? { zoom } : {}), duration: 900 });
  };

  const centrarManta = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [-80.72, -0.96], zoom: 12.4, pitch: 60, bearing: -15, duration: 1200 });
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
          <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => moverCamara(60, -20)}>
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
