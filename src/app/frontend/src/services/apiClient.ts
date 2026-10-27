/**
 * Cliente HTTP del backend FastAPI de la "Plaga Caracol".
 *
 * La URL del backend SIEMPRE se lee de la variable de entorno VITE_API_URL
 * (nunca se escribe en el código). Si no está definida, se usa el dev server
 * local por defecto (http://localhost:8080), que es donde corre uvicorn.
 *
 * Todos los errores se transforman en un mensaje claro y en español mediante
 * ApiError, para que la interfaz pueda mostrarlos sin exponer detalles técnicos.
 */

import type {
  CatalogoResponse,
  CompararRequest,
  CompararResponse,
  ParametrosResponse,
} from "../types/api";

/** URL base del backend, leída de VITE_API_URL. */
const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8080")
  .replace(/\/+$/, ""); // sin barra final

/** Error de API con un mensaje listo para mostrar al usuario. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Forma de error que devuelve el backend (manejadores en main.py). */
interface ErrorBackend {
  error?: string;
  mensaje?: string;
  detalles?: { campo: string; mensaje: string }[];
  detail?: string;
}

async function parseError(res: Response): Promise<ApiError> {
  let cuerpo: ErrorBackend | null = null;
  try {
    cuerpo = (await res.json()) as ErrorBackend;
  } catch {
    cuerpo = null;
  }

  if (cuerpo) {
    // 422 con detalles por campo.
    if (cuerpo.detalles && cuerpo.detalles.length > 0) {
      const campos = cuerpo.detalles
        .map((d) => `${d.campo}: ${d.mensaje}`)
        .join("; ");
      return new ApiError(
        `${cuerpo.mensaje ?? "Parámetros inválidos"} (${campos})`,
        res.status,
      );
    }
    const msg = cuerpo.mensaje ?? cuerpo.detail;
    if (msg) return new ApiError(msg, res.status);
  }

  if (res.status === 503) {
    return new ApiError(
      "El servidor está ocupado. Intenta de nuevo en unos segundos.",
      503,
    );
  }
  return new ApiError(
    `Error del servidor (código ${res.status}).`,
    res.status,
  );
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    // Fallo de red / backend apagado / CORS.
    throw new ApiError(
      `No se pudo conectar con el backend en ${API_URL}. ` +
        "Verifica que el servidor esté encendido y que VITE_API_URL sea correcta.",
    );
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError("La respuesta del servidor no es válida.");
  }
}

/** GET /parametros — valores por defecto, rangos y topes. */
export function obtenerParametros(signal?: AbortSignal): Promise<ParametrosResponse> {
  return pedir<ParametrosResponse>("/parametros", { method: "GET", signal });
}

/** GET /catalogo — geografía ficticia (barrios y edificios con coordenadas). */
export function obtenerCatalogo(signal?: AbortSignal): Promise<CatalogoResponse> {
  return pedir<CatalogoResponse>("/catalogo", { method: "GET", signal });
}

/** POST /comparar — compara las 5 estrategias y devuelve métricas + curvas. */
export function compararEstrategias(
  cuerpo: CompararRequest,
  signal?: AbortSignal,
): Promise<CompararResponse> {
  return pedir<CompararResponse>("/comparar", {
    method: "POST",
    body: JSON.stringify(cuerpo),
    signal,
  });
}

/** URL base efectiva (útil para mostrarla en la UI o depurar). */
export const apiBaseUrl = API_URL;
