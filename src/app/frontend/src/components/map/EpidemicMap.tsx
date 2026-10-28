import { useEffect, useRef, useState } from "react";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BarrioMapa, CatalogoResponse } from "../../types/api";
import type { Brote } from "../../types/brotes";

// Config oficial para Vite: evita "Worker failed to load".
maplibregl.setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

/** Estilo base AUTÓNOMO: fondo de color sólido, sin tiles ni glyphs externos.
 *
 * Así el mapa funciona siempre (incluso sin internet y sin depender de servidores
 * de tiles públicos que pueden caer o dar 404). Los barrios, edificios y el
 * territorio de Manta se dibujan encima como capas GeoJSON locales. Para ver
 * calles/edificios reales de base, define VITE_MAP_STYLE_URL o VITE_MAPTILER_KEY.
 */
const DARK_STYLE = {
  version: 8 as const,
  name: "PLAGA ZERO Base",
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#0F172A" } },
  ],
};

const OPENFREEMAP_DARK = "https://tiles.openfreemap.org/styles/dark";

function getStyle(): string | typeof DARK_STYLE {
  const url = import.meta.env.VITE_MAP_STYLE_URL as string | undefined;
  if (url) return url;
  const key =
    (import.meta.env.VITE_MAPTILER_KEY as string | undefined) ||
    (import.meta.env.VITE_MAPTILER_API_KEY as string | undefined) ||
    (import.meta.env.VITE_MAPTILER_TOKEN as string | undefined);
  if (key) return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`;
  if (typeof navigator !== "undefined" && !navigator.onLine) return DARK_STYLE;
  return OPENFREEMAP_DARK;
}





function paddingMapa(el: HTMLElement | null): number {
  const lado = el ? Math.min(el.clientWidth, el.clientHeight) : 520;
  return Math.max(24, Math.round(lado * 0.08));
}

interface Props {
  barrios: BarrioMapa[];
  catalogo?: CatalogoResponse | null;
  dia?: number;
  movimientos?: { origen: string; destino: string; cantidad: number }[];
  brotes?: Brote[];
  contagiosPorLugar?: { lugar_id: number; lng: number; lat: number; nuevos: number; acumulados: number; zombis: number }[];
  variable?: "nuevos" | "acumulados" | "zombis";
  showHeatmap?: boolean;
  showMovimientos?: boolean;
  showEventos?: boolean;
}

export default function EpidemicMap({ barrios, catalogo, dia, movimientos, brotes, contagiosPorLugar, showHeatmap = true, showMovimientos = false, showEventos = true, variable = "nuevos" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const limitesRef = useRef<[[number, number], [number, number]] | null>(null);
  const encuadreHechoRef = useRef(false);

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
        pitch: 0,
        bearing: 0,
        maxPitch: 85,
      });
    } catch {
      setMapError(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    const ro = new ResizeObserver(() => map.resize());
    if (containerRef.current) ro.observe(containerRef.current);
    // Un fallo de los tiles del estilo base externo (p. ej. el tile server
    // público) NO debe ocultar el mapa: los barrios, edificios y el territorio
    // de Manta se dibujan como capas GeoJSON locales encima. Solo lo registramos.
    map.on("error", (e) => {
      console.warn("MapLibre:", (e as { error?: { message?: string } })?.error?.message ?? e);
    });

    map.on("load", () => {
      const baseStyleLayerIds = new Set((map.getStyle().layers || []).map((l) => l.id));
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
          "heatmap-weight": ["interpolate", ["linear"], ["get", variable === "nuevos" ? "nuevos" : variable === "acumulados" ? "acumulados" : "zombis"], 0, 0, 10, 1],
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
          "fill-color": "#0B1620",
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
          "fill-color": "#111827",
          "fill-opacity": 0.12,
        },
      });
      map.addLayer({
        id: "manta-line",
        type: "line",
        source: "manta",
        paint: {
          "line-color": "#5B9BD5",
          "line-width": 1.2,
          "line-opacity": 0.7,
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

      // Mantener calles/etiquetas del mapa base visibles también fuera del
      // límite territorial: las capas de línea/símbolo del estilo base se
      // suben por encima de la máscara (que sigue recortando el heatmap).
      for (const l of map.getStyle().layers || []) {
        if (baseStyleLayerIds.has(l.id) && (l.type === "line" || l.type === "symbol")) {
          try { map.moveLayer(l.id); } catch { /* ignore */ }
        }
      }
      // Restaurar nuestras capas epidemiológicas por encima de las del base.
      for (const id of ["edificios", "contagios-points", "movimientos", "eventos", "manta-line", "manta-fill"]) {
        if (map.getLayer(id)) {
          try { map.moveLayer(id); } catch { /* ignore */ }
        }
      }

      setMapLoaded(true);
    });

    return () => {
      ro.disconnect();
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

  // Actualizar el peso del heatmap cuando cambia la variable seleccionada.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!map.getLayer("contagios-heat")) return;
    const prop = variable === "nuevos" ? "nuevos" : variable === "acumulados" ? "acumulados" : "zombis";
    map.setPaintProperty("contagios-heat", "heatmap-weight", [
      "interpolate", ["linear"], ["get", prop], 0, 0, 10, 1,
    ]);
  }, [mapLoaded, variable]);

  // Encuadre: ajusta la cámara a las coordenadas reales (barrios y edificios).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const puntos: [number, number][] = [];
    for (const b of barrios) {
      if (b.lat != null && b.lng != null) puntos.push([b.lng as number, b.lat as number]);
    }
    for (const e of catalogo?.edificios ?? []) puntos.push([e.lng, e.lat]);
    if (puntos.length === 0) return;
    const lngs = puntos.map((p) => p[0]);
    const lats = puntos.map((p) => p[1]);
    const limites: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
    limitesRef.current = limites;
    if (!encuadreHechoRef.current) {
      encuadreHechoRef.current = true;
      map.fitBounds(limites, { padding: paddingMapa(containerRef.current), pitch: 0, bearing: 0, duration: 0 });
    }
  }, [mapLoaded, barrios, catalogo]);

  // Actualizar los datos cuando cambian barrios/catalogo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const contagiosFeatures = (contagiosPorLugar ?? []).map((c) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
      properties: { nuevos: c.nuevos, acumulados: c.acumulados, zombis: c.zombis },
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
  }, [mapLoaded, barrios, catalogo, movimientos, brotes, contagiosPorLugar, variable]);

  const moverCamara = (pitch: number, bearing: number, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ pitch, bearing, ...(zoom != null ? { zoom } : {}), duration: 900 });
  };

  const centrarManta = () => {
    const map = mapRef.current;
    if (!map) return;
    const lim = limitesRef.current;
    if (lim) {
      map.fitBounds(lim, { padding: paddingMapa(containerRef.current), pitch: 0, bearing: 0, duration: 900 });
      return;
    }
    map.flyTo({ center: [-80.72, -0.96], zoom: 12.4, pitch: 0, bearing: 0, duration: 1200 });
  };

  return (
    <div>
      {mapError && (
        <div className="error-box" role="alert">
          No se pudo inicializar el mapa. Es posible que tu navegador no soporte
          WebGL. Los barrios y su nivel de riesgo también se muestran en la tabla
          “Barrios más afectados”.
        </div>
      )}
      <div style={{ position: "relative" }}>
        <div ref={containerRef} className="map-container" style={{ height: 620, width: "100%" }} />
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
