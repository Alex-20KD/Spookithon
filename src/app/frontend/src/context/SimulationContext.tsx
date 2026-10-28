import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  compararEstrategias,
  obtenerParametros,
  obtenerTrayectoria,
  ApiError,
} from "../services/apiClient";
import type {
  CompararRequest,
  CompararResponse,
  LugarInicio,
  ParametrosResponse,
} from "../types/api";
import type { TrayectoriaRequest, TrayectoriaResponse } from "../types/trayectoria";
import type { Brote } from "../types/brotes";
import { clampDia } from "../utils/epidemiologia";

/**
 * Parámetros editables que la interfaz envía al backend. Usan los MISMOS
 * nombres que el esquema del backend (beta, dosis_dia, ...) para evitar mapeos
 * confusos y errores silenciosos.
 */
export interface ParametrosEditables {
  beta: number;
  dosis_dia: number;
  eficacia_vacuna: number;
  lugar_inicio: LugarInicio;
  dias_detectar: number;
  infect_portador: number;
  dias: number;
  semilla: number;
  n_corridas: number;
}

/** Valores por defecto de respaldo (se sobrescriben con GET /parametros). */
const PARAMS_FALLBACK: ParametrosEditables = {
  beta: 0.3,
  dosis_dia: 100,
  eficacia_vacuna: 0.9,
  lugar_inicio: "hospital",
  dias_detectar: 4,
  infect_portador: 0.3,
  dias: 30,
  semilla: 42,
  n_corridas: 50,
};

interface SimulationContextValue {
  /** Parámetros actuales del formulario. */
  params: ParametrosEditables;
  /** Vía de transmisión seleccionada. */
  viaTransmision: string;
  setViaTransmision: (v: string) => void;

  /** Brotes programados. */
  brotes: Brote[];
  setBrotes: (b: Brote[]) => void;
  updateParam: <K extends keyof ParametrosEditables>(
    key: K,
    value: ParametrosEditables[K],
  ) => void;
  restaurarDefaults: () => void;

  /** Metadatos del backend: rangos, topes y defaults (GET /parametros). */
  meta: ParametrosResponse | null;

  /** Último resultado de POST /comparar. */
  resultado: CompararResponse | null;

  /** Eventos de brote sorpresa activos. */
  eventos: CompararRequest["eventos"];
  setEventos: (e: CompararRequest["eventos"]) => void;

  /** Parámetros con los que se ejecutó la última simulación. */
  paramsEjecutados: ParametrosEditables | null;

  /** Trayectoria determinista cargada. */
  trayectoria: TrayectoriaResponse | null;

  /** Estrategia seleccionada para la trayectoria. */
  estrategiaSeleccionada: string;
  setEstrategiaSeleccionada: (e: string) => void;

  /** Indica si los parámetros actuales difieren de los ejecutados. */
  paramsModificados: boolean;

  /** Estado de la petición en curso. */
  cargando: boolean;
  error: string | null;

  /** Ejecuta POST /comparar con los parámetros actuales. Devuelve el resultado o null si falla. */
  comparar: (eventosOverride?: CompararRequest["eventos"], intervencionesOverride?: CompararRequest["intervenciones"]) => Promise<CompararResponse | null>;

  /** Carga una trayectoria determinista para la estrategia indicada. */
  cargarTrayectoria: (estrategia?: string, intervencionesOverride?: CompararRequest["intervenciones"]) => Promise<void>;

  /** Día seleccionado para recorrer las curvas (0..dias). */
  dia: number;
  /** Último día válido: horizonte de la trayectoria cargada (o del escenario ejecutado). */
  maxDia: number;
  setDia: (d: number | ((prev: number) => number)) => void;
}

const SimulationContext = createContext<SimulationContextValue | undefined>(
  undefined,
);

/** Extrae un número del rango del backend o usa el de respaldo. */
function defDe(
  meta: ParametrosResponse | null,
  clave: string,
  respaldo: number,
): number {
  const p = meta?.parametros?.[clave];
  if (p && typeof p.por_defecto === "number") return p.por_defecto;
  return respaldo;
}

function construirDefaults(meta: ParametrosResponse | null): ParametrosEditables {
  if (!meta) return { ...PARAMS_FALLBACK };
  const lugar = meta.parametros?.lugar_inicio?.por_defecto;
  return {
    beta: defDe(meta, "beta", PARAMS_FALLBACK.beta),
    dosis_dia: defDe(meta, "dosis_dia", PARAMS_FALLBACK.dosis_dia),
    eficacia_vacuna: defDe(meta, "eficacia_vacuna", PARAMS_FALLBACK.eficacia_vacuna),
    lugar_inicio: (typeof lugar === "string"
      ? lugar
      : PARAMS_FALLBACK.lugar_inicio) as LugarInicio,
    dias_detectar: defDe(meta, "dias_detectar", PARAMS_FALLBACK.dias_detectar),
    infect_portador: defDe(meta, "infect_portador", PARAMS_FALLBACK.infect_portador),
    dias: defDe(meta, "dias", PARAMS_FALLBACK.dias),
    semilla: defDe(meta, "semilla", PARAMS_FALLBACK.semilla),
    n_corridas: defDe(meta, "n_corridas", PARAMS_FALLBACK.n_corridas),
  };
}

function brotesAEventos(brotes: Brote[]): CompararRequest["eventos"] {
  return brotes
    .filter((b) => b.activo)
    .map((b) => ({
      tipo: b.tipo,
      dia: b.dia,
      barrio_id: b.barrio_id,
      intensidad: b.intensidad,
      duracion: b.duracion,
      nombre: b.tipo,
    }));
}

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useState<ParametrosEditables>(PARAMS_FALLBACK);
  const [viaTransmision, setViaTransmision] = useState<string>("mordidas");
  const [brotes, setBrotes] = useState<Brote[]>([]);
  const [meta, setMeta] = useState<ParametrosResponse | null>(null);
  const [resultado, setResultado] = useState<CompararResponse | null>(null);
  const [eventos, setEventos] = useState<CompararRequest["eventos"]>(null);
  const [paramsEjecutados, setParamsEjecutados] = useState<ParametrosEditables | null>(null);
  const [trayectoria, setTrayectoria] = useState<TrayectoriaResponse | null>(null);
  const [estrategiaSeleccionada, setEstrategiaSeleccionada] = useState<string>("Nada");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dia, setDiaState] = useState(0);

  // Evita pisar valores que el usuario ya tocó cuando llegan los defaults.
  const usuarioEdito = useRef(false);
  const comparaEnCurso = useRef<AbortController | null>(null);

  const updateParam = <K extends keyof ParametrosEditables>(
    key: K,
    value: ParametrosEditables[K],
  ) => {
    usuarioEdito.current = true;
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const restaurarDefaults = () => {
    usuarioEdito.current = false;
    setParams(construirDefaults(meta));
  };

  const cargarTrayectoria = async (estrategia?: string, intervencionesOverride?: CompararRequest["intervenciones"]) => {
    const baseParams = paramsEjecutados ?? params;
    const estr = estrategia ?? estrategiaSeleccionada;
    setCargando(true);
    setError(null);
    try {
      const ev = brotes.length > 0 ? (brotesAEventos(brotes) ?? undefined) : undefined;
      const iv = intervencionesOverride !== undefined ? (intervencionesOverride ?? undefined) : undefined;
      const cuerpo: TrayectoriaRequest = {
        beta: baseParams.beta,
        dosis_dia: baseParams.dosis_dia,
        eficacia_vacuna: baseParams.eficacia_vacuna,
        lugar_inicio: baseParams.lugar_inicio,
        dias_detectar: baseParams.dias_detectar,
        infect_portador: baseParams.infect_portador,
        dias: baseParams.dias,
        semilla: baseParams.semilla,
        movilidad_zombie: 0.05,
        via_transmision: viaTransmision,
        eventos: ev,
        intervenciones: iv,
        estrategia: estr,
      };
      const res = await obtenerTrayectoria(cuerpo);
      setTrayectoria(res);
      setDiaState((prev) => clampDia(prev, res.dias));
      setEstrategiaSeleccionada(estr);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Ocurrió un error inesperado al cargar la trayectoria.",
      );
    } finally {
      setCargando(false);
    }
  };

  const maxDia = trayectoria?.dias ?? paramsEjecutados?.dias ?? params.dias;

  const setDia = (d: number | ((prev: number) => number)) => {
    setDiaState((prev) => {
      const next = typeof d === "function" ? (d as (p: number) => number)(prev) : d;
      return clampDia(Number.isNaN(next) ? 0 : next, maxDia);
    });
  };

  const comparar = async (eventosOverride?: CompararRequest["eventos"], intervencionesOverride?: CompararRequest["intervenciones"]): Promise<CompararResponse | null> => {
    // Cancela una comparación anterior aún en vuelo.
    comparaEnCurso.current?.abort();
    const ctrl = new AbortController();
    comparaEnCurso.current = ctrl;

    setCargando(true);
    setError(null);
    try {
      const ev = eventosOverride !== undefined ? eventosOverride : (brotes.length > 0 ? brotesAEventos(brotes) : eventos);
      const iv = intervencionesOverride !== undefined ? (intervencionesOverride ?? undefined) : undefined;
      const cuerpo: CompararRequest = { ...params, via_transmision: viaTransmision, eventos: ev, intervenciones: iv };
      const res = await compararEstrategias(cuerpo, ctrl.signal);
      setResultado(res);
      setParamsEjecutados({ ...params });
      setTrayectoria(null);
      setDiaState(0);
      return res;
    } catch (e) {
      if (ctrl.signal.aborted) return null; // cancelada a propósito
      setError(
        e instanceof ApiError
          ? e.message
          : "Ocurrió un error inesperado al comparar estrategias.",
      );
      return null;
    } finally {
      if (!ctrl.signal.aborted) setCargando(false);
    }
  };

  // Carga los metadatos (rangos/defaults) una vez al montar.
  useEffect(() => {
    const ctrl = new AbortController();
    obtenerParametros(ctrl.signal)
      .then((m) => {
        setMeta(m);
        if (!usuarioEdito.current) setParams(construirDefaults(m));
      })
      .catch(() => {
        // Si falla, seguimos con los valores de respaldo; el error real
        // aparecerá cuando el usuario intente comparar.
      });
    return () => ctrl.abort();
  }, []);

  const paramsModificados =
    paramsEjecutados !== null &&
    JSON.stringify(params) !== JSON.stringify(paramsEjecutados);

  const value = useMemo(
    () => ({
      params,
      viaTransmision,
      setViaTransmision,
      brotes,
      setBrotes,
      updateParam,
      restaurarDefaults,
      meta,
      resultado,
      eventos,
      setEventos,
      paramsEjecutados,
      trayectoria,
      estrategiaSeleccionada,
      setEstrategiaSeleccionada,
      paramsModificados,
      cargando,
      error,
      comparar,
      cargarTrayectoria,
      dia,
      maxDia,
      setDia,
    }),
    [params, meta, resultado, eventos, viaTransmision, brotes, paramsEjecutados, trayectoria, estrategiaSeleccionada, paramsModificados, cargando, error, dia, maxDia],
  );

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx)
    throw new Error("useSimulation debe usarse dentro de SimulationProvider");
  return ctx;
}
