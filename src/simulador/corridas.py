"""Comparación pareada de estrategias sobre múltiples corridas.

Cada corrida ``i`` usa la semilla ``params.semilla + i`` y la MISMA red para
todas las estrategias (comparación pareada): así las diferencias entre
estrategias no se deben al azar de la red, sino a sus decisiones.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .params import Params
from .red import construir_red
from .modelo import Simulacion, ZOMBI
from . import estrategias as _estrategias


@dataclass
class ResumenEstrategia:
    """Resumen de una estrategia sobre ``n_corridas``.

    Attributes:
        nombre: nombre de la estrategia.
        infectados_media / infectados_p10 / infectados_p90: estadísticos de
            infectados totales.
        salvados_media / salvados_p10 / salvados_p90: estadísticos de
            "salvados" = infectados(Nada) - infectados(estrategia), pareado.
        curva_zombis: curva promedio de zombis por día (longitud dias+1).
    """

    nombre: str
    infectados_media: float
    infectados_p10: float
    infectados_p90: float
    salvados_media: float
    salvados_p10: float
    salvados_p90: float
    curva_zombis: np.ndarray


def comparar(
    params: Params,
    estrategias: list | None = None,
    n_corridas: int = 300,
) -> dict[str, ResumenEstrategia]:
    """Compara estrategias de forma pareada.

    Args:
        params: parámetros base de la simulación.
        estrategias: lista de estrategias; por defecto, las cinco de
            :func:`simulador.estrategias.todas`. "Nada" es obligatoria porque
            es la referencia para calcular "salvados"; si falta, se agrega.
        n_corridas: número de corridas (cada una con semilla distinta).

    Returns:
        Diccionario {nombre_estrategia: :class:`ResumenEstrategia`}.
    """
    if estrategias is None:
        estrategias = _estrategias.todas()

    nombres = [e.nombre for e in estrategias]
    if "Nada" not in nombres:
        estrategias = [_estrategias.Nada()] + list(estrategias)
        nombres = [e.nombre for e in estrategias]

    # Acumuladores por estrategia.
    infectados = {e.nombre: np.zeros(n_corridas) for e in estrategias}
    curvas = {
        e.nombre: np.zeros(params.dias + 1, dtype=np.float64) for e in estrategias
    }

    for i in range(n_corridas):
        semilla = params.semilla + i
        # MISMA red para todas las estrategias de esta corrida.
        red = construir_red(params.poblacion, semilla)
        for e in estrategias:
            sim = Simulacion(params, red, e, semilla=semilla)
            res = sim.correr()
            infectados[e.nombre][i] = res.infectados_totales
            curvas[e.nombre] += res.curva[:, ZOMBI]

    base = infectados["Nada"]

    resumen: dict[str, ResumenEstrategia] = {}
    for e in estrategias:
        inf = infectados[e.nombre]
        salvados = base - inf
        resumen[e.nombre] = ResumenEstrategia(
            nombre=e.nombre,
            infectados_media=float(inf.mean()),
            infectados_p10=float(np.percentile(inf, 10)),
            infectados_p90=float(np.percentile(inf, 90)),
            salvados_media=float(salvados.mean()),
            salvados_p10=float(np.percentile(salvados, 10)),
            salvados_p90=float(np.percentile(salvados, 90)),
            curva_zombis=curvas[e.nombre] / n_corridas,
        )

    return resumen
