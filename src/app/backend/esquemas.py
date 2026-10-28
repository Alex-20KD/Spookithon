"""Esquemas Pydantic (validación de entrada y forma de la salida).

Aquí se definen:

- Los PARÁMETROS EDITABLES que la API acepta, con rangos estrictos. Todo lo que
  venga fuera de rango produce un 422 automático con mensaje claro.
- Los parámetros NO editables (población, estructura de red, catálogo) NO
  aparecen aquí a propósito: la API no los expone, así nadie los cambia.
- La forma de la respuesta de ``/comparar`` y ``/parametros``.

Rangos (todos son supuestos de diseño para el escenario ficticio):
    beta                 0 < beta <= 1
    dosis_dia            >= 0 y <= 1000
    eficacia_vacuna      0 <= x <= 1
    lugar_inicio         uno de {hospital, mercado, colegio, bus}
    dias_detectar        1 <= x <= 30
    infect_portador      0 <= x <= 1
    dias                 7 <= x <= DIAS_MAX (tope por entorno, 90 por defecto)
    semilla              0 <= x <= 2**31-1
    n_corridas           1 <= x <= N_CORRIDAS_MAX (tope por entorno, 300 por defecto)
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, ConfigDict


# Tipos de lugar de inicio válidos: coinciden con los que el simulador sabe
# sembrar desde el catálogo (ver simulador/cli.py y simulador/modelo.py).
LugarInicio = Literal["hospital", "mercado", "colegio", "bus"]


class ParametrosComparar(BaseModel):
    """Parámetros editables de ``POST /comparar``.

    Todos son opcionales: si no se envían, se usan los valores por defecto del
    simulador (``simulador.params.Params``). Los rangos son estrictos; fuera de
    rango => 422. ``extra='forbid'`` rechaza campos desconocidos (p. ej. nadie
    puede colar ``poblacion`` para cambiar un parámetro no editable).
    """

    model_config = ConfigDict(extra="forbid")

    beta: float | None = Field(
        default=None, gt=0.0, le=1.0,
        description="Tasa de transmisión (calibrada a R0≈2,5). Mayor = contagia más.",
    )
    dosis_dia: int | None = Field(
        default=None, ge=0, le=1000,
        description="Dosis de vacuna aplicadas por día (capacidad logística).",
    )
    eficacia_vacuna: float | None = Field(
        default=None, ge=0.0, le=1.0,
        description="Protección de una dosis en una persona sana (0 a 1).",
    )
    lugar_inicio: LugarInicio | None = Field(
        default=None,
        description="Tipo de lugar donde empieza el brote: hospital, mercado, colegio o bus.",
    )
    dias_detectar: int | None = Field(
        default=None, ge=1, le=30,
        description="Días que tarda la vigilancia en empezar a detectar casos.",
    )
    infect_portador: float | None = Field(
        default=None, ge=0.0, le=1.0,
        description="Infectividad del portador respecto al zombi (zombi = 1,0).",
    )
    dias: int | None = Field(
        default=None, ge=7,
        description="Horizonte de la simulación en días (tope configurable, 90 por defecto).",
    )
    semilla: int | None = Field(
        default=None, ge=0, le=2**31 - 1,
        description="Semilla de aleatoriedad. Misma semilla = mismos resultados.",
    )
    n_corridas: int = Field(
        default=50, ge=1,
        description="Número de corridas a promediar (tope configurable, 300 por defecto).",
    )
    via_transmision: str | None = Field(default=None, description="mordidas, esporas o combinada")
    beta_espora: float | None = Field(default=None, ge=0.0, le=1.0)
    eventos: list[dict] | None = Field(
        default=None,
        description="Eventos de brote sorpresa opcionales.",
    )
    intervenciones: list[dict] | None = Field(
        default=None,
        description="Intervenciones adicionales con día de activación.",
    )


# ----------------------------- Respuestas ------------------------------ #


class CurvaDiaria(BaseModel):
    """Curva de zombis por día para graficar (día 0..dias)."""

    dias: list[int] = Field(description="Índice de día (0..dias).")
    media: list[float] = Field(description="Zombis promedio por día.")
    p10: list[float] = Field(description="Percentil 10 de zombis por día.")
    p90: list[float] = Field(description="Percentil 90 de zombis por día.")


class ResultadoEstrategia(BaseModel):
    """Resumen de una estrategia sobre las corridas."""

    nombre: str
    infectados_media: float
    infectados_p10: float
    infectados_p90: float
    salvados_media: float
    salvados_p10: float
    salvados_p90: float
    # % de corridas en que esta estrategia terminó con MENOS infectados que...
    pct_mejor_que_azar: float = Field(
        description="% de corridas con menos infectados que 'Azar'."
    )
    pct_mejor_que_nada: float = Field(
        description="% de corridas con menos infectados que 'Nada'."
    )
    infectados_por_barrio: list[float] | None = Field(
        default=None,
        description="Infectados medios por barrio (orden de 'mapa.barrios').",
    )
    curva_diaria: CurvaDiaria


class BarrioMapa(BaseModel):
    """Un barrio para el mapa: geografía + infectados medios de la mejor estrategia."""

    id: str
    nombre: str
    lat: float | None = Field(default=None, description="Latitud (puede faltar).")
    lng: float | None = Field(default=None, description="Longitud (puede faltar).")
    infectados_media: float | None = Field(
        default=None, description="Infectados medios en el barrio."
    )


class Mapa(BaseModel):
    """Bloque de mapa: barrios con coordenadas e infectados de la mejor estrategia."""

    aviso: str = Field(description="Aviso de que son datos simulados.")
    estrategia: str = Field(description="Estrategia usada para el desglose (la mejor).")
    barrios: list[BarrioMapa]


class RespuestaComparar(BaseModel):
    """Respuesta completa de ``POST /comparar``."""

    aviso: str = Field(description="Aviso de que son datos simulados.")
    estrategias: list[ResultadoEstrategia]
    mejor_estrategia: str = Field(
        description="Estrategia con menos infectados medios entre las activas."
    )
    recomendacion: str = Field(description="Recomendación en texto simple.")
    parametros_efectivos: dict = Field(
        description="Parámetros realmente usados, para reproducir."
    )
    semilla: int
    n_corridas: int
    mapa: Mapa = Field(description="Desglose geográfico por barrio para el mapa.")


class RangoParametro(BaseModel):
    """Descripción de un parámetro editable: valor por defecto, rango y ayuda."""

    por_defecto: object = Field(description="Valor por defecto del simulador.")
    minimo: object | None = Field(default=None, description="Mínimo permitido.")
    maximo: object | None = Field(default=None, description="Máximo permitido.")
    opciones: list[str] | None = Field(
        default=None, description="Valores válidos (para parámetros de opción)."
    )
    descripcion: str = Field(description="Explicación corta en español.")
class ParametrosTrayectoria(BaseModel):
    """Parametros para obtener una trayectoria determinista (una sola corrida)."""

    model_config = ConfigDict(extra="forbid")

    beta: float | None = Field(default=None, gt=0.0, le=1.0)
    dosis_dia: int | None = Field(default=None, ge=0, le=1000)
    eficacia_vacuna: float | None = Field(default=None, ge=0.0, le=1.0)
    lugar_inicio: LugarInicio | None = Field(default=None)
    dias_detectar: int | None = Field(default=None, ge=1, le=30)
    infect_portador: float | None = Field(default=None, ge=0.0, le=1.0)
    dias: int | None = Field(default=None, ge=7)
    semilla: int | None = Field(default=None, ge=0, le=2**31 - 1)
    estrategia: Literal["Nada", "Azar", "Centralidad", "CierresMasCentralidad", "Anillo"] = Field(
        default="Nada",
        description="Estrategia a simular en la trayectoria.",
    )
    movilidad_zombie: float | None = Field(default=None, ge=0.0, le=1.0)
    via_transmision: str | None = Field(default=None, description="mordidas, esporas o combinada")
    beta_espora: float | None = Field(default=None, ge=0.0, le=1.0)
    eventos: list[dict] | None = Field(default=None, description="Eventos de brote sorpresa.")
    intervenciones: list[dict] | None = Field(default=None, description="Intervenciones adicionales.")
