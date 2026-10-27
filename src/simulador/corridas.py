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
    # Percentiles diarios de la curva de zombis (longitud dias+1). Son None
    # cuando se usa comparar() clásico y se llenan con comparar_detallado().
    curva_zombis_p10: np.ndarray | None = None
    curva_zombis_p90: np.ndarray | None = None
    # Infectados medios por barrio (orden canónico del catálogo). None cuando no
    # se calcula el desglose espacial; se llena en resumir_corridas().
    infectados_por_barrio_media: np.ndarray | None = None


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


def _normalizar_estrategias(estrategias: list | None) -> list:
    """Devuelve la lista de estrategias asegurando que 'Nada' esté presente.

    'Nada' es obligatoria porque es la referencia para calcular 'salvados'.
    """
    if estrategias is None:
        estrategias = _estrategias.todas()
    nombres = [e.nombre for e in estrategias]
    if "Nada" not in nombres:
        estrategias = [_estrategias.Nada()] + list(estrategias)
    return list(estrategias)


def correr_una_corrida(
    params: Params,
    indice: int,
    estrategias: list | None = None,
) -> dict[str, tuple[int, np.ndarray, np.ndarray]]:
    """Ejecuta UNA corrida (la ``indice``) para todas las estrategias.

    Usa la semilla ``params.semilla + indice`` y la MISMA red para todas las
    estrategias (comparación pareada), idéntico a :func:`comparar`. El resultado
    de esta corrida depende SOLO de ``params`` e ``indice``: por eso se puede
    calcular en cualquier proceso/hilo y el resultado es el mismo. Esto permite
    paralelizar por corrida sin alterar los números.

    Returns:
        ``{nombre_estrategia: (infectados_totales, curva_zombis, por_barrio)}``
        donde ``curva_zombis`` es un array de longitud ``dias+1`` y
        ``por_barrio`` es el nº de infectados por barrio (orden del catálogo).
    """
    estrategias = _normalizar_estrategias(estrategias)
    semilla = params.semilla + indice
    red = construir_red(params.poblacion, semilla)
    salida: dict[str, tuple[int, np.ndarray, np.ndarray]] = {}
    for e in estrategias:
        sim = Simulacion(params, red, e, semilla=semilla)
        res = sim.correr()
        salida[e.nombre] = (
            res.infectados_totales,
            res.curva[:, ZOMBI].copy(),
            res.infectados_por_barrio.copy(),
        )
    return salida


def barrios_orden(params: Params) -> list[str]:
    """Devuelve los ids de barrio en el orden canónico (el del catálogo).

    Útil para rotular el vector ``infectados_por_barrio_media`` que produce
    :func:`resumir_corridas`. El orden no depende de la semilla.
    """
    red = construir_red(params.poblacion, params.semilla)
    return list(red.barrios_ids)


def resumir_corridas(
    params: Params,
    por_corrida: list[dict[str, tuple[int, np.ndarray, np.ndarray]]],
    estrategias: list | None = None,
) -> dict[str, ResumenEstrategia]:
    """Agrega los resultados de varias corridas en :class:`ResumenEstrategia`.

    ``por_corrida`` debe venir EN ORDEN (corrida 0, 1, 2, ...). El orden importa
    para que la media/percentiles sean idénticos corrida a corrida; por eso el
    backend ordena por índice antes de llamar aquí.

    Cada valor es ``(infectados_totales, curva_zombis, infectados_por_barrio)``.
    """
    estrategias = _normalizar_estrategias(estrategias)
    n_corridas = len(por_corrida)

    infectados = {e.nombre: np.zeros(n_corridas) for e in estrategias}
    curvas_por_corrida = {
        e.nombre: np.zeros((n_corridas, params.dias + 1), dtype=np.float64)
        for e in estrategias
    }
    # Acumulador por barrio: se dimensiona al ver la primera corrida.
    barrios_por_corrida: dict[str, np.ndarray] = {}
    for i, corrida in enumerate(por_corrida):
        for nombre, valor in corrida.items():
            inf_tot, curva, por_barrio = valor
            infectados[nombre][i] = inf_tot
            curvas_por_corrida[nombre][i] = curva
            por_barrio = np.asarray(por_barrio, dtype=np.float64)
            if nombre not in barrios_por_corrida:
                barrios_por_corrida[nombre] = np.zeros(
                    (n_corridas, por_barrio.shape[0]), dtype=np.float64
                )
            barrios_por_corrida[nombre][i] = por_barrio

    base = infectados["Nada"]
    resumen: dict[str, ResumenEstrategia] = {}
    for e in estrategias:
        inf = infectados[e.nombre]
        salvados = base - inf
        curvas_e = curvas_por_corrida[e.nombre]
        barrios_e = barrios_por_corrida.get(e.nombre)
        resumen[e.nombre] = ResumenEstrategia(
            nombre=e.nombre,
            infectados_media=float(inf.mean()),
            infectados_p10=float(np.percentile(inf, 10)),
            infectados_p90=float(np.percentile(inf, 90)),
            salvados_media=float(salvados.mean()),
            salvados_p10=float(np.percentile(salvados, 10)),
            salvados_p90=float(np.percentile(salvados, 90)),
            curva_zombis=curvas_e.mean(axis=0),
            curva_zombis_p10=np.percentile(curvas_e, 10, axis=0),
            curva_zombis_p90=np.percentile(curvas_e, 90, axis=0),
            infectados_por_barrio_media=(
                barrios_e.mean(axis=0) if barrios_e is not None else None
            ),
        )
    return resumen


def comparar_detallado(
    params: Params,
    estrategias: list | None = None,
    n_corridas: int = 300,
) -> dict[str, ResumenEstrategia]:
    """Igual que :func:`comparar`, pero además calcula los percentiles diarios.

    Diferencias con :func:`comparar`:

    - Guarda la curva de zombis COMPLETA de cada corrida (no solo el acumulado),
      para poder calcular ``curva_zombis_p10`` y ``curva_zombis_p90`` por día.
    - La MEDIA (``curva_zombis``, ``infectados_media``, ``salvados_*``, etc.) se
      calcula EXACTAMENTE igual que en :func:`comparar`: mismo recorrido de
      corridas, misma semilla ``params.semilla + i`` y misma red por corrida.
      Con la misma semilla y parámetros, los números son idénticos.

    El único añadido son los percentiles diarios; los resultados existentes no
    cambian (hay una prueba que lo verifica contra :func:`comparar`).
    """
    por_corrida = [
        correr_una_corrida(params, i, estrategias) for i in range(n_corridas)
    ]
    return resumir_corridas(params, por_corrida, estrategias)
