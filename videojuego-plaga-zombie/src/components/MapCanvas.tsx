import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/game-store';
import { CANTONS_MAP } from '../data/manabi-data';
import { formatNumber, formatPercent } from '../utils/format';
import './MapCanvas.css';

// ---------------------------------------------------------------------------
// Datos geográficos
// ---------------------------------------------------------------------------

type Ring = [number, number][];
type Polygon = Ring[];

interface GeoFeature {
  properties: { id: string; nombre: string; centro?: [number, number] };
  geometry: { type: 'Polygon'; coordinates: Polygon } | { type: 'MultiPolygon'; coordinates: Polygon[] };
}

interface MapData {
  cantons: GeoFeature[];
  context: GeoFeature[];
}

const CANTONS_URL = '/assets/mapa/manabi-cantones.geojson';
const CONTEXT_URL = '/assets/mapa/provincias-contexto.geojson';

let mapDataPromise: Promise<MapData> | null = null;

function loadMapData(): Promise<MapData> {
  if (!mapDataPromise) {
    const get = (url: string) =>
      fetch(url).then(r => {
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return r.json() as Promise<{ features: GeoFeature[] }>;
      });
    mapDataPromise = Promise.all([
      get(CANTONS_URL),
      get(CONTEXT_URL).catch(() => ({ features: [] as GeoFeature[] })) // el contexto es opcional
    ]).then(([c, ctx]) => ({ cantons: c.features, context: ctx.features }));
    mapDataPromise.catch(() => { mapDataPromise = null; }); // permitir reintento
  }
  return mapDataPromise;
}

const polygonsOf = (f: GeoFeature): Polygon[] =>
  f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;

function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const pointInPolygons = (x: number, y: number, polys: Polygon[]) =>
  polys.some(p => pointInRing(x, y, p[0]) && !p.slice(1).some(h => pointInRing(x, y, h)));

/** PRNG determinista para que los puntos de cada cantón no cambien entre partidas. */
function seededRandom(seedText: string) {
  let seed = 2166136261;
  for (const ch of seedText) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
  };
}

/** Puntos aleatorios (lon/lat) dentro del cantón, en orden fijo: aparecen poco a poco. */
function scatterPoints(id: string, polys: Polygon[], count: number): [number, number][] {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of polys) for (const [x, y] of p[0]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const rand = seededRandom(id);
  const pts: [number, number][] = [];
  for (let tries = 0; pts.length < count && tries < count * 200; tries++) {
    const x = minX + rand() * (maxX - minX);
    const y = minY + rand() * (maxY - minY);
    if (pointInPolygons(x, y, polys)) pts.push([x, y]);
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Estilo
// ---------------------------------------------------------------------------

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 12;

/** Intensidad visual (0-1) a partir de la fracción de zombies del cantón. */
function infectionIntensity(zombie: number, total: number): number {
  if (zombie < 1 || total <= 0) return 0;
  return Math.min(1, 0.12 + Math.sqrt(zombie / total) * 1.6);
}

function cantonFill(intensity: number): string {
  const from = [38, 20, 52]; // morado oscuro (sano)
  const to = [196, 12, 32]; // rojo sangre (infectado)
  const c = from.map((v, i) => Math.round(v + (to[i] - v) * intensity));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Cuántos de los puntos del cantón se encienden, en escala logarítmica para que el brote se vea desde el día 1. */
function visibleDots(zombie: number, population: number, maxDots: number): number {
  if (zombie < 1) return 0;
  const ratio = Math.log10(1 + zombie) / Math.log10(1 + Math.max(population, 10));
  return Math.max(1, Math.min(maxDots, Math.round(maxDots * Math.min(1, ratio * ratio))));
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface CantonShape {
  id: string;
  name: string;
  polys: Polygon[];
  path: Path2D; // en coordenadas base (zoom 1)
  label: [number, number]; // base
  dotsGeo: [number, number][];
  dots: [number, number][]; // base
}

interface View {
  zoom: number;
  panX: number;
  panY: number;
}

const MapCanvas: React.FC = () => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const dataRef = useRef<MapData | null>(null);
  const shapesRef = useRef<CantonShape[]>([]);
  const contextPathRef = useRef<Path2D | null>(null);
  const viewRef = useRef<View>({ zoom: 1, panX: 0, panY: 0 });
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const hoverRef = useRef<string | null>(null);

  // Carga del GeoJSON
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadMapData()
      .then(data => {
        if (cancelled) return;
        dataRef.current = data;
        setStatus('ready');
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setErrorText(err.message);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  /** Proyecta lon/lat a píxeles base, encuadrando Manabí en el lienzo. */
  const rebuildGeometry = useCallback(() => {
    const data = dataRef.current;
    const { width, height } = sizeRef.current;
    if (!data || width === 0 || height === 0) return;

    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const f of data.cantons) for (const p of polygonsOf(f)) for (const [x, y] of p[0]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const pad = 28;
    const k = Math.min((width - pad * 2) / (maxX - minX), (height - pad * 2) / (maxY - minY));
    const offX = (width - (maxX - minX) * k) / 2;
    const offY = (height - (maxY - minY) * k) / 2;
    const project = ([lon, lat]: [number, number]): [number, number] => [offX + (lon - minX) * k, offY + (maxY - lat) * k];

    const buildPath = (polys: Polygon[]) => {
      const path = new Path2D();
      for (const poly of polys) for (const ring of poly) {
        ring.forEach((pt, i) => {
          const [x, y] = project(pt);
          if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
        });
        path.closePath();
      }
      return path;
    };

    const ctxPath = new Path2D();
    for (const f of data.context) ctxPath.addPath(buildPath(polygonsOf(f)));
    contextPathRef.current = ctxPath;

    const previous = new Map(shapesRef.current.map(s => [s.id, s]));
    shapesRef.current = data.cantons.map(f => {
      const id = f.properties.id;
      const polys = polygonsOf(f);
      const area = CANTONS_MAP.get(id)?.area_km2 ?? 300;
      const maxDots = Math.max(10, Math.min(90, Math.round(8 + area / 40)));
      const dotsGeo = previous.get(id)?.dotsGeo ?? scatterPoints(id, polys, maxDots);
      const centro = f.properties.centro ?? CANTONS_MAP.get(id)?.centro ?? polys[0][0][0];
      return {
        id,
        name: CANTONS_MAP.get(id)?.name ?? f.properties.nombre,
        polys,
        path: buildPath(polys),
        label: project(centro),
        dotsGeo,
        dots: dotsGeo.map(project)
      };
    });
  }, []);

  /** Devuelve el id del cantón bajo el punto (coordenadas CSS del lienzo). */
  const hitTest = useCallback((x: number, y: number): string | null => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return null;
    const { dpr } = sizeRef.current;
    const { zoom, panX, panY } = viewRef.current;
    ctx.save();
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * panX, dpr * panY);
    let found: string | null = null;
    // Recorrido inverso: los cantones dibujados al final quedan encima
    for (let i = shapesRef.current.length - 1; i >= 0 && !found; i--) {
      if (ctx.isPointInPath(shapesRef.current[i].path, x * dpr, y * dpr, 'evenodd')) found = shapesRef.current[i].id;
    }
    ctx.restore();
    return found;
  }, []);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const v = viewRef.current;
    const { width, height } = sizeRef.current;
    const x = cx ?? width / 2;
    const y = cy ?? height / 2;
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * factor));
    const ratio = next / v.zoom;
    v.panX = x - (x - v.panX) * ratio;
    v.panY = y - (y - v.panY) * ratio;
    v.zoom = next;
  }, []);

  const resetView = useCallback(() => {
    viewRef.current = { zoom: 1, panX: 0, panY: 0 };
  }, []);

  // Tamaño del lienzo (nítido en pantallas de alta densidad)
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      sizeRef.current = { width, height, dpr };
      rebuildGeometry();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [rebuildGeometry]);

  useEffect(() => {
    if (status === 'ready') rebuildGeometry();
  }, [status, rebuildGeometry]);

  // Bucle de dibujo: lee el estado del store en cada cuadro, así refleja cada día simulado
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0;

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      const { width, height, dpr } = sizeRef.current;
      if (width === 0) return;
      const { model, selectedCantonId } = useGameStore.getState();
      const { zoom, panX, panY } = viewRef.current;
      const pulse = 0.55 + 0.45 * Math.sin(time / 380);

      // Océano
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ocean = ctx.createLinearGradient(0, 0, width, 0);
      ocean.addColorStop(0, '#02060f');
      ocean.addColorStop(1, '#070b18');
      ctx.fillStyle = ocean;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(80, 110, 180, 0.06)';
      ctx.lineWidth = 1;
      const grid = 36 * zoom;
      if (grid > 8) {
        ctx.beginPath();
        for (let x = ((panX % grid) + grid) % grid; x < width; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = ((panY % grid) + grid) % grid; y < height; y += grid) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();
      }

      const shapes = shapesRef.current;
      if (shapes.length === 0) return;

      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * panX, dpr * panY);
      ctx.lineJoin = 'round';

      // Provincias vecinas (tierra de fondo)
      if (contextPathRef.current) {
        ctx.fillStyle = '#100c16';
        ctx.fill(contextPathRef.current, 'evenodd');
        ctx.strokeStyle = '#261d31';
        ctx.lineWidth = 1 / zoom;
        ctx.stroke(contextPathRef.current);
      }

      // Cantones teñidos según la infección
      for (const s of shapes) {
        const st = model?.getState(s.id);
        const total = st ? st.susceptible + st.zombie + st.removed : 0;
        ctx.fillStyle = cantonFill(st ? infectionIntensity(st.zombie, total) : 0);
        ctx.fill(s.path, 'evenodd');
        if (s.id === hoverRef.current && s.id !== selectedCantonId) {
          ctx.fillStyle = 'rgba(200, 150, 255, 0.12)';
          ctx.fill(s.path, 'evenodd');
        }
      }

      // Bordes morados brillantes
      ctx.save();
      ctx.shadowColor = 'rgba(190, 110, 255, 0.9)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#b46cff';
      ctx.lineWidth = 1.3 / zoom;
      for (const s of shapes) ctx.stroke(s.path);
      ctx.restore();

      // Puntos rojos de infección
      ctx.save();
      ctx.shadowColor = '#ff1a1a';
      ctx.shadowBlur = 6;
      const r = 2.4 / Math.sqrt(zoom);
      for (const s of shapes) {
        const st = model?.getState(s.id);
        if (!st) continue;
        const n = visibleDots(st.zombie, st.susceptible + st.zombie + st.removed, s.dots.length);
        if (n === 0) continue;
        ctx.fillStyle = `rgba(255, ${Math.round(40 + 40 * pulse)}, 40, ${0.75 + 0.25 * pulse})`;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const [x, y] = s.dots[i];
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.restore();

      // Carreteras bloqueadas
      if (model) {
        ctx.save();
        ctx.strokeStyle = '#ff3030';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([5 / zoom, 4 / zoom]);
        const byId = new Map(shapes.map(s => [s.id, s]));
        for (const s of shapes) {
          for (const other of model.getState(s.id)?.roadsBlocked ?? []) {
            const o = byId.get(other);
            if (!o || other < s.id) continue;
            ctx.beginPath();
            ctx.moveTo(s.label[0], s.label[1]);
            ctx.lineTo(o.label[0], o.label[1]);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Cantón seleccionado
      const selected = shapes.find(s => s.id === selectedCantonId);
      if (selected) {
        ctx.save();
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 16;
        ctx.strokeStyle = '#f4e6ff';
        ctx.lineWidth = 2.6 / zoom;
        ctx.stroke(selected.path);
        ctx.restore();
      }

      // Nombres (tamaño fijo en pantalla)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      const fontSize = Math.max(10, Math.min(15, 10 + zoom));
      // El seleccionado se dibuja al final para que quede encima de los demás nombres
      const ordered = [...shapes].sort((a, b) => Number(a.id === selectedCantonId) - Number(b.id === selectedCantonId));
      for (const s of ordered) {
        const x = s.label[0] * zoom + panX;
        const y = s.label[1] * zoom + panY;
        if (x < -60 || y < -20 || x > width + 60 || y > height + 20) continue;
        const st = model?.getState(s.id);
        const isSelected = s.id === selectedCantonId;
        const icons = `${st?.quarantine ? ' 🔒' : ''}${st && st.militaryPresence > 0 ? ' ⚔️' : ''}`;
        const text = s.name + icons;

        ctx.font = `${isSelected ? 'bold ' : '600 '}${fontSize}px Arial, sans-serif`;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = 3.5;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = isSelected ? '#ffffff' : '#ece0ff';
        ctx.fillText(text, x, y);

        if (st && (isSelected || zoom >= 2.2) && st.zombie >= 1) {
          const total = st.susceptible + st.zombie + st.removed;
          const detail = `🧟 ${formatNumber(st.zombie)} · ${formatPercent(st.zombie / total)}`;
          ctx.font = `bold ${fontSize - 1}px Arial, sans-serif`;
          const dy = y + fontSize + 3;
          const w = ctx.measureText(detail).width + 10;
          ctx.fillStyle = 'rgba(8, 4, 12, 0.85)';
          ctx.beginPath();
          ctx.roundRect(x - w / 2, dy - fontSize / 2 - 2, w, fontSize + 4, 4);
          ctx.fill();
          ctx.fillStyle = '#ff6b6b';
          ctx.fillText(detail, x, dy);
        }
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Interacción: rueda = zoom, arrastre = mover, clic = seleccionar
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let drag: { id: number; x: number; y: number; panX: number; panY: number; moved: boolean } | null = null;

    const local = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top] as const;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [x, y] = local(e);
      zoomAt(Math.exp(-e.deltaY * 0.0015), x, y);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const [x, y] = local(e);
      const v = viewRef.current;
      drag = { id: e.pointerId, x, y, panX: v.panX, panY: v.panY, moved: false };
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const [x, y] = local(e);
      if (drag && drag.id === e.pointerId) {
        const dx = x - drag.x;
        const dy = y - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
        if (drag.moved) {
          viewRef.current.panX = drag.panX + dx;
          viewRef.current.panY = drag.panY + dy;
          canvas.style.cursor = 'grabbing';
          return;
        }
      }
      hoverRef.current = hitTest(x, y);
      canvas.style.cursor = hoverRef.current ? 'pointer' : 'grab';
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const wasDrag = drag.moved;
      drag = null;
      canvas.releasePointerCapture(e.pointerId);
      const [x, y] = local(e);
      const hit = hitTest(x, y);
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      if (!wasDrag) useGameStore.getState().selectCanton(hit);
    };

    const onLeave = () => { hoverRef.current = null; };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onLeave);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [hitTest, zoomAt]);

  return (
    <div className="map-container gothic-panel" data-tour="map">
      <h2 className="map-title gothic-text">MAPA DE MANABÍ</h2>
      <div className="map-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="map-canvas" />

        <div className="map-zoom-controls">
          <button type="button" onClick={() => zoomAt(1.4)} aria-label="Acercar">+</button>
          <button type="button" onClick={() => zoomAt(1 / 1.4)} aria-label="Alejar">−</button>
          <button type="button" onClick={resetView} aria-label="Restablecer vista" title="Restablecer vista">⟲</button>
        </div>

        <div className="map-legend">
          <div className="map-legend-title">INFECCIÓN</div>
          <div className="map-legend-bar" />
          <div className="map-legend-scale"><span>0%</span><span>100%</span></div>
          <div className="map-legend-hint">Rueda: zoom · Arrastrar: mover · Clic: seleccionar</div>
        </div>

        {status === 'loading' && <div className="map-status">Cargando mapa…</div>}
        {status === 'error' && (
          <div className="map-status map-status-error">
            <p>No se pudo cargar el mapa.</p>
            <p className="map-status-detail">{errorText}</p>
            <button type="button" className="gothic-button" onClick={() => setReloadKey(k => k + 1)}>
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapCanvas;
