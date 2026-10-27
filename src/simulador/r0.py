"""Medición de R0 con una definición fija, medible y reproducible.

DEFINICIÓN DE R0 (la que implementamos):
    R0 = número promedio de infecciones secundarias DIRECTAS que causa UNA
    persona infectada elegida al azar (el "caso índice"), durante una ventana
    fija de ``V`` días contados desde su propia infección, en una población
    100% susceptible, sin intervenciones (sin vacuna, sin cierres, y con una
    detección que no cambia nada), partiendo de 1 solo caso inicial.

¿Por qué una ventana V? En esta plaga el estado ZOMBI no termina: un zombi
seguiría contagiando para siempre, así que el "número de infecciones que causa
una persona en toda su vida infecciosa" no está acotado y R0 crecería sin tope
con el horizonte. Fijar una ventana (V=14 días por defecto) acota el conteo a
un periodo comparable y hace que R0 sea un número estable y reportable.

Para atribuir "quién infectó a quién" usamos el reparto FRACCIONAL del modelo
(``Simulacion(atribuir=True)``), que no usa azar nuevo: por eso medir R0 no
altera la dinámica.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .params import Params
from .red import construir_red
from .modelo import Simulacion
from . import estrategias as _estrategias

# Ventana por defecto, en días, para contar infecciones secundarias.
V_POR_DEFECTO = 14


@dataclass
class ResultadoR0:
    """Estadísticos de R0 sobre muchas corridas."""

    media: float
    mediana: float
    p10: float
    p90: float
    v: int
    n_corridas: int
    muestras: np.ndarray  # R0 individual de cada corrida


def _params_sin_intervencion(params: Params, v: int) -> Params:
    """Devuelve una copia de params configurada para medir R0 limpiamente.

    - 1 solo caso inicial (casos_extra=0),
    - horizonte = V días (basta para la ventana),
    - intervenciones efectivamente apagadas (vacuna/cierres/medidas nunca
      llegan dentro de la ventana), y población 100% susceptible al inicio
      (lo está por construcción: todos empiezan SANO salvo el índice).
    """
    return params.con(
        casos_extra=0,
        dias=v,
        dia_medidas=v + 1,   # las medidas nunca entran en la ventana
        dia_vacuna=v + 1,    # la vacuna nunca entra en la ventana
        dias_detectar=v + 1,  # la detección no cambia nada dentro de la ventana
    )


def medir_r0(
    params: Params,
    n_corridas: int = 200,
    v: int = V_POR_DEFECTO,
    semilla: int | None = None,
) -> ResultadoR0:
    """Mide R0 sobre ``n_corridas`` corridas independientes y reproducibles.

    Cada corrida usa semilla ``semilla + i`` (y una red generada con esa misma
    semilla), siembra 1 caso índice al azar y cuenta, de forma fraccional, las
    infecciones directas que causa durante ``v`` días.

    Returns:
        :class:`ResultadoR0` con media, mediana, p10 y p90.
    """
    base = params.semilla if semilla is None else semilla
    p = _params_sin_intervencion(params, v)
    estrategia = _estrategias.Nada()

    muestras = np.zeros(n_corridas, dtype=np.float64)
    for i in range(n_corridas):
        s = base + i
        red = construir_red(p.poblacion, s)
        sim = Simulacion(p, red, estrategia, semilla=s, atribuir=True)
        # El caso índice es la única persona infectada en el día 0.
        indice = int(np.where(sim.fue_infectado)[0][0])
        sim.correr()
        muestras[i] = float(sim.infecciones_causadas[indice])

    return ResultadoR0(
        media=float(muestras.mean()),
        mediana=float(np.median(muestras)),
        p10=float(np.percentile(muestras, 10)),
        p90=float(np.percentile(muestras, 90)),
        v=v,
        n_corridas=n_corridas,
        muestras=muestras,
    )
