"""Parámetros de la simulación.

Cada parámetro numérico lleva su fuente. Al no disponer de datos reales de la
"Plaga Caracol" (es ficticia), casi todos son "supuesto de diseño": valores
plausibles elegidos para que la dinámica sea interesante y comparable entre
estrategias. ``beta`` es PROVISIONAL y se calibrará en una etapa posterior.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any


def _peso_lugar_por_defecto() -> dict[str, float]:
    """Peso de contacto por tipo de lugar (supuesto de diseño).

    Los lugares más concurridos y con mezcla intensa (bus, mercado) pesan más;
    el barrio (contacto difuso al aire libre) pesa poco.
    """
    return {
        "hogar": 1.0,
        "colegio": 1.2,
        "bus": 1.5,
        "mercado": 1.5,
        "hospital": 1.0,
        "barrio": 0.4,
    }


def _asistencia_por_defecto() -> dict[str, float]:
    """Probabilidad diaria de que una persona "asista" a un lugar (supuesto de diseño)."""
    return {
        "hogar": 1.0,
        "colegio": 0.9,
        "bus": 0.7,
        "mercado": 0.3,
        "hospital": 0.7,
        "barrio": 0.5,
    }


@dataclass(frozen=True)
class Params:
    """Configuración inmutable de una corrida.

    Es ``frozen`` para evitar mutaciones accidentales; usa :meth:`con` para
    obtener una copia con cambios.
    """

    # --- Aleatoriedad ---
    semilla: int = 42  # supuesto de diseño (reproducibilidad)

    # --- Población y horizonte ---
    poblacion: int = 3000  # supuesto de diseño (tamaño manejable para el demo)
    dias: int = 60  # horizonte justificado por el % infectado SIN intervención
    # a 30/45/60 días (≈4,3% / 24,1% / 63,8% en 'Nada'): a 30 días la epidemia
    # apenas arranca y a 60 ya hay saturación, por eso 60 da margen para que las
    # estrategias marquen diferencia (ver data/calibracion.json).

    # --- Siembra inicial ---
    casos_extra: int = 3  # supuesto de diseño (paciente cero + 3)
    lugar_inicio: str = "hospital"  # supuesto de diseño (hospital|mercado|colegio|bus)

    # --- Historia natural de la enfermedad (ficticia) ---
    incub_min: int = 4  # supuesto de diseño (días mínimos de incubación)
    incub_max: int = 5  # supuesto de diseño (días máximos de incubación)
    portador_desde: int = 2  # supuesto de diseño (día desde infección en que ya contagia)
    infect_portador: float = 0.30  # supuesto de diseño (infectividad relativa del portador vs zombi=1.0)

    # --- Transmisión ---
    # beta CALIBRADO para R0≈2,5 (media) con la definición de ventana fija V=14
    # días. Procedimiento y métricas en src/simulador/data/calibracion.json
    # (ver también scripts/calibrar_beta.py y src/simulador/r0.py).
    beta: float = 0.015625

    # --- Intervenciones ---
    dia_medidas: int = 4  # supuesto de diseño (día en que empiezan las medidas)
    dia_vacuna: int = 10  # supuesto de diseño (llegada de la vacuna)
    dosis_dia: int = 100  # supuesto de diseño (capacidad logística diaria)
    eficacia_vacuna: float = 0.90  # supuesto de diseño (protección por dosis en un SANO)
    max_cierres: int = 3  # supuesto de diseño (tope de lugares cerrados simultáneos)

    # --- Vigilancia / detección ---
    dias_detectar: int = 4  # supuesto de diseño (latencia del sistema de vigilancia)
    p_det_zombi: float = 0.50  # supuesto de diseño (prob. diaria de detectar un zombi)
    p_det_portador: float = 0.15  # supuesto de diseño (prob. diaria de detectar un portador)

    # --- Tablas por tipo de lugar ---
    peso_lugar: dict[str, float] = field(default_factory=_peso_lugar_por_defecto)
    asistencia: dict[str, float] = field(default_factory=_asistencia_por_defecto)

    def con(self, **cambios: Any) -> "Params":
        """Devuelve una copia de estos parámetros con los ``cambios`` aplicados.

        Ejemplo::

            p2 = params.con(beta=0.2, dias=45)
        """
        return replace(self, **cambios)
