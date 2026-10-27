"""Aplicación FastAPI de la 'Plaga Caracol' (datos SIMULADOS).

Endpoints (sin autenticación por ahora):

- ``GET  /salud``       -> estado del servicio.
- ``GET  /catalogo``    -> barrios y edificios (geografía ficticia).
- ``GET  /parametros``  -> parámetros editables: por defecto, rango y ayuda.
- ``POST /comparar``    -> compara las 5 estrategias y devuelve métricas + curvas.

Diseño:
- Validación con Pydantic (422 claro si algo está fuera de rango).
- Simulaciones en un pool de PROCESOS (no bloquean el servidor) y reproducibles.
- Límite de simulaciones simultáneas -> 503 "servidor ocupado" si se supera.
- Caché LRU en memoria (misma entrada = misma salida al instante).
- CORS restringido (nunca "*").
- Los errores NO exponen trazas internas.
- Cada respuesta incluye el aviso "DATOS SIMULADOS".
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import asdict

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from simulador.catalogo import cargar_catalogo
from simulador.params import Params

from .configuracion import cargar_configuracion
from .ejecutor import Ejecutor, ServidorOcupado
from .esquemas import ParametrosComparar
from .parametros import describir_parametros


CONFIG = cargar_configuracion()


@asynccontextmanager
async def _ciclo_de_vida(app: FastAPI):
    """Arranca y apaga el pool de procesos junto con la app."""
    ejecutor: Ejecutor = app.state.ejecutor
    ejecutor.iniciar()
    try:
        yield
    finally:
        ejecutor.cerrar()


def crear_app(config=None) -> FastAPI:
    """Crea la aplicación FastAPI (fábrica, útil para tests)."""
    cfg = config or CONFIG

    app = FastAPI(
        title="Plaga Caracol — API de simulación (FICTICIA)",
        description="Compara estrategias de vacunación sobre una epidemia simulada. "
        "Todos los datos son SIMULADOS.",
        version="1.0.0",
        lifespan=_ciclo_de_vida,
    )
    app.state.config = cfg
    app.state.ejecutor = Ejecutor(
        max_simulaciones=cfg.max_simulaciones,
        max_workers=cfg.workers_efectivos,
    )

    # --- CORS restringido (nunca "*") ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    _registrar_manejadores_error(app)
    _registrar_rutas(app, cfg)
    return app


# ------------------------- Manejo de errores --------------------------- #

def _registrar_manejadores_error(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validacion(request: Request, exc: RequestValidationError):
        # 422 con mensaje claro, SIN trazas internas.
        detalles = []
        for err in exc.errors():
            campo = ".".join(str(x) for x in err.get("loc", []) if x != "body")
            detalles.append({"campo": campo or "(cuerpo)", "mensaje": err.get("msg", "")})
        return JSONResponse(
            status_code=422,
            content={
                "error": "parametros_invalidos",
                "mensaje": "Uno o más parámetros están fuera de rango o mal formados.",
                "detalles": detalles,
                "aviso": app.state.config.aviso_simulado,
            },
        )

    @app.exception_handler(ServidorOcupado)
    async def _ocupado(request: Request, exc: ServidorOcupado):
        return JSONResponse(
            status_code=503,
            content={
                "error": "servidor_ocupado",
                "mensaje": "Servidor ocupado, intenta de nuevo en unos segundos.",
                "aviso": app.state.config.aviso_simulado,
            },
        )

    @app.exception_handler(Exception)
    async def _generico(request: Request, exc: Exception):
        # Nunca devolvemos la traza interna al cliente.
        if isinstance(exc, HTTPException):
            raise exc
        return JSONResponse(
            status_code=500,
            content={
                "error": "error_interno",
                "mensaje": "Ocurrió un error procesando la solicitud.",
                "aviso": app.state.config.aviso_simulado,
            },
        )


# ------------------------------ Rutas ---------------------------------- #

def _registrar_rutas(app: FastAPI, cfg) -> None:

    @app.get("/salud")
    async def salud():
        """Comprobación de vida del servicio."""
        return {"estado": "ok"}

    @app.get("/catalogo")
    async def catalogo():
        """Barrios y edificios de la geografía ficticia (12 barrios, 10 edificios)."""
        cat = cargar_catalogo()
        return {
            "aviso": cfg.aviso_simulado,
            "barrios": cat["barrios"],
            "edificios": cat["edificios"],
        }

    @app.get("/parametros")
    async def parametros():
        """Parámetros editables: valor por defecto, rango permitido y descripción."""
        return {
            "aviso": cfg.aviso_simulado,
            "parametros": describir_parametros(cfg.dias_max, cfg.n_corridas_max),
            "topes": {
                "n_corridas_max": cfg.n_corridas_max,
                "dias_max": cfg.dias_max,
            },
        }

    @app.post("/comparar")
    async def comparar(entrada: ParametrosComparar):
        """Compara las 5 estrategias y devuelve métricas + curvas diarias."""
        # Topes configurables (además de los rangos estáticos de Pydantic).
        if entrada.n_corridas > cfg.n_corridas_max:
            raise HTTPException(
                status_code=422,
                detail=f"n_corridas no puede superar {cfg.n_corridas_max}.",
            )
        if entrada.dias is not None and entrada.dias > cfg.dias_max:
            raise HTTPException(
                status_code=422,
                detail=f"dias no puede superar {cfg.dias_max}.",
            )

        params = _construir_params(entrada)
        resumen = await app.state.ejecutor.comparar(params, entrada.n_corridas)
        return _armar_respuesta(resumen, params, entrada.n_corridas, cfg)


def _construir_params(entrada: ParametrosComparar) -> Params:
    """Aplica los parámetros editables sobre los valores por defecto del simulador.

    Lo NO editable (población, estructura de red, catálogo) nunca se toca aquí:
    simplemente no está en ``entrada`` y conserva su valor por defecto.
    """
    cambios = {}
    for campo in (
        "beta", "dosis_dia", "eficacia_vacuna", "lugar_inicio",
        "dias_detectar", "infect_portador", "dias", "semilla",
    ):
        valor = getattr(entrada, campo)
        if valor is not None:
            cambios[campo] = valor
    return Params().con(**cambios)


def _armar_respuesta(resumen: dict, params: Params, n_corridas: int, cfg) -> dict:
    """Construye la respuesta final: ranking, mejor estrategia y recomendación."""
    estrategias = list(resumen.values())

    # "mejor_estrategia": menos infectados medios entre las ACTIVAS (no 'Nada').
    activas = [e for e in estrategias if e["nombre"] != "Nada"]
    mejor = min(activas, key=lambda e: e["infectados_media"])

    nada = resumen.get("Nada")
    salvados_prom = mejor["salvados_media"]
    recomendacion = (
        f"La estrategia '{mejor['nombre']}' deja en promedio "
        f"{mejor['infectados_media']:.0f} infectados"
    )
    if nada is not None:
        recomendacion += (
            f", unos {salvados_prom:.0f} menos que no hacer nada "
            f"({nada['infectados_media']:.0f}). Se recomienda aplicarla."
        )
    else:
        recomendacion += ". Se recomienda aplicarla."

    # Orden de salida: 'Nada' primero, luego por menos infectados medios.
    orden = sorted(estrategias, key=lambda e: (e["nombre"] != "Nada", e["infectados_media"]))

    dias = params.dias
    lista = []
    for e in orden:
        lista.append({
            "nombre": e["nombre"],
            "infectados_media": e["infectados_media"],
            "infectados_p10": e["infectados_p10"],
            "infectados_p90": e["infectados_p90"],
            "salvados_media": e["salvados_media"],
            "salvados_p10": e["salvados_p10"],
            "salvados_p90": e["salvados_p90"],
            "pct_mejor_que_azar": e["pct_mejor_que_azar"],
            "pct_mejor_que_nada": e["pct_mejor_que_nada"],
            "infectados_por_barrio": e.get("infectados_por_barrio"),
            "curva_diaria": {
                "dias": list(range(dias + 1)),
                "media": e["curva_media"],
                "p10": e["curva_p10"],
                "p90": e["curva_p90"],
            },
        })

    return {
        "aviso": cfg.aviso_simulado,
        "estrategias": lista,
        "mejor_estrategia": mejor["nombre"],
        "recomendacion": recomendacion,
        "parametros_efectivos": asdict(params),
        "semilla": params.semilla,
        "n_corridas": n_corridas,
        "mapa": _armar_mapa(mejor, cfg),
    }


def _armar_mapa(mejor: dict, cfg) -> dict:
    """Construye el bloque de mapa: geografía de barrios + infectados por barrio.

    Combina las coordenadas del catálogo (barrios con lat/lng) con los
    infectados medios por barrio de la MEJOR estrategia. El frontend usa esto
    para pintar el mapa con datos reales en vez de datos de prueba.
    """
    cat = cargar_catalogo()
    barrios_cat = {b["id"]: b for b in cat["barrios"]}

    ids = mejor.get("barrios") or []
    por_barrio = mejor.get("infectados_por_barrio") or []

    barrios = []
    for i, bid in enumerate(ids):
        base = barrios_cat.get(bid, {})
        infectados = por_barrio[i] if i < len(por_barrio) else None
        barrios.append({
            "id": bid,
            "nombre": base.get("nombre", bid),
            "lat": base.get("lat"),
            "lng": base.get("lng"),
            "infectados_media": infectados,
        })

    return {
        "aviso": cfg.aviso_simulado,
        "estrategia": mejor["nombre"],
        "barrios": barrios,
    }


# Instancia por defecto para `uvicorn app.backend.main:app`.
app = crear_app()
