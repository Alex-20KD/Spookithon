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
  ApiError,
} from "../services/apiClient";
import type {
  CompararRequest,
  CompararResponse,
  LugarInicio,
  ParametrosResponse,
} from "../types/api";

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
  updateParam: <K extends keyof ParametrosEditables>(
    key: K,
    value: ParametrosEditables[K],
  ) => void;
  restaurarDefaults: () => void;

  /** Metadatos del backend: rangos, topes y defaults (GET /parametros). */
  meta: ParametrosResponse | null;

  /** Último resultado de POST /comparar. */
  resultado: CompararResponse | null;

  /** Estado de la petición en curso. */
  cargando: boolean;
  error: string | null;

  /** Ejecuta POST /comparar con los parámetros actuales. Devuelve el resultado o null si falla. */
  comparar: () => Promise<CompararResponse | null>;

  /** Día seleccionado para recorrer las curvas (0..dias). */
  dia: number;
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

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useState<ParametrosEditables>(PARAMS_FALLBACK);
  const [meta, setMeta] = useState<ParametrosResponse | null>(null);
  const [resultado, setResultado] = useState<CompararResponse | null>(null);
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

  const setDia = (d: number | ((prev: number) => number)) => {
    setDiaState((prev) => {
      const next = typeof d === "function" ? (d as (p: number) => number)(prev) : d;
      const max = params.dias;
      if (Number.isNaN(next)) return 0;
      return Math.max(0, Math.min(max, Math.round(next)));
    });
  };

  const comparar = async (): Promise<CompararResponse | null> => {
    // Cancela una comparación anterior aún en vuelo.
    comparaEnCurso.current?.abort();
    const ctrl = new AbortController();
    comparaEnCurso.current = ctrl;

    setCargando(true);
    setError(null);
    try {
      const cuerpo: CompararRequest = { ...params };
      const res = await compararEstrategias(cuerpo, ctrl.signal);
      setResultado(res);
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

  const value = useMemo(
    () => ({
      params,
      updateParam,
      restaurarDefaults,
      meta,
      resultado,
      cargando,
      error,
      comparar,
      dia,
      setDia,
    }),
    [params, meta, resultado, cargando, error, dia],
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
