"""Catálogo de parámetros editables: valores por defecto, rangos y descripción.

Un único lugar que describe, en español, cada parámetro que la API deja tocar.
Lo usan tanto el endpoint ``GET /parametros`` como la construcción de la
respuesta. Los rangos aquí deben coincidir con los de ``esquemas.py`` (Pydantic
es quien realmente valida; esto es la versión "legible" para el frontend).
"""

from __future__ import annotations

from typing import Any

from simulador.params import Params


def describir_parametros(dias_max: int, n_corridas_max: int) -> dict[str, dict[str, Any]]:
    """Devuelve la descripción de cada parámetro editable.

    Args:
        dias_max: tope de ``dias`` según la configuración del backend.
        n_corridas_max: tope de ``n_corridas`` según la configuración.
    """
    d = Params()  # valores por defecto del simulador
    return {
        "beta": {
            "por_defecto": d.beta,
            "minimo": 0.0,
            "maximo": 1.0,
            "descripcion": "Tasa de transmisión (calibrada a R0≈2,5). Más alta contagia más.",
        },
        "dosis_dia": {
            "por_defecto": d.dosis_dia,
            "minimo": 0,
            "maximo": 1000,
            "descripcion": "Dosis de vacuna aplicadas por día (capacidad logística).",
        },
        "eficacia_vacuna": {
            "por_defecto": d.eficacia_vacuna,
            "minimo": 0.0,
            "maximo": 1.0,
            "descripcion": "Protección que da una dosis a una persona sana (0 a 1).",
        },
        "lugar_inicio": {
            "por_defecto": d.lugar_inicio,
            "opciones": ["hospital", "mercado", "colegio", "bus"],
            "descripcion": "Tipo de lugar donde comienza el brote.",
        },
        "dias_detectar": {
            "por_defecto": d.dias_detectar,
            "minimo": 1,
            "maximo": 30,
            "descripcion": "Días hasta que la vigilancia empieza a detectar casos.",
        },
        "infect_portador": {
            "por_defecto": d.infect_portador,
            "minimo": 0.0,
            "maximo": 1.0,
            "descripcion": "Infectividad del portador respecto al zombi (zombi = 1,0).",
        },
        "movilidad_zombie": {
            "por_defecto": d.movilidad_zombie,
            "minimo": 0.0,
            "maximo": 1.0,
            "descripcion": "Probabilidad diaria de que un zombi se desplace a un barrio vecino.",
        },
        "dias": {
            "por_defecto": d.dias,
            "minimo": 7,
            "maximo": dias_max,
            "descripcion": "Horizonte de la simulación en días.",
        },
        "semilla": {
            "por_defecto": d.semilla,
            "minimo": 0,
            "maximo": 2**31 - 1,
            "descripcion": "Semilla de aleatoriedad. Misma semilla = mismos resultados.",
        },
        "n_corridas": {
            "por_defecto": 50,
            "minimo": 1,
            "maximo": n_corridas_max,
            "descripcion": "Número de corridas a promediar. Más corridas = resultado más estable, pero más lento.",
        },
    }
