"""Estrategias de intervención.

REGLA DE RIGOR: una estrategia SOLO puede mirar el estado CONOCIDO de la
simulación (``sim.conocido``), jamás el estado real. Así se evita "hacer trampa"
usando información que un equipo de respuesta real no tendría.

Interfaz: ``decidir(sim, dia) -> Acciones(vacunar=ids, cerrar=ids_de_lugares)``.

Candidatos a vacunar = personas no vacunadas y no conocidas como infectadas.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .modelo import ZOMBI, PORTADOR


@dataclass
class Acciones:
    """Decisión de una estrategia para un día.

    Attributes:
        vacunar: índices de persona a los que aplicar dosis.
        cerrar: índices de lugar a cerrar.
    """

    vacunar: np.ndarray = field(default_factory=lambda: np.array([], dtype=np.int64))
    cerrar: np.ndarray = field(default_factory=lambda: np.array([], dtype=np.int64))


def _candidatos(sim) -> np.ndarray:
    """Personas elegibles para vacuna: no vacunadas y no conocidas como infectadas."""
    conocido_infectado = (sim.conocido == ZOMBI) | (sim.conocido == PORTADOR)
    elegibles = (~sim.vacunado) & (~conocido_infectado)
    return np.where(elegibles)[0]


class Nada:
    """Línea base: no hace nada."""

    nombre = "Nada"

    def decidir(self, sim, dia: int) -> Acciones:
        return Acciones()


class Azar:
    """Línea base: reparte dosis a candidatos elegidos al azar."""

    nombre = "Azar"

    def decidir(self, sim, dia: int) -> Acciones:
        if dia < sim.params.dia_vacuna:
            return Acciones()
        cand = _candidatos(sim)
        if cand.size == 0:
            return Acciones()
        n = min(sim.params.dosis_dia, cand.size)
        elegidos = sim.rng_estrategia.choice(cand, size=n, replace=False)
        return Acciones(vacunar=elegidos)


class Centralidad:
    """Vacuna a los candidatos de mayor grado (centralidad)."""

    nombre = "Centralidad"

    def decidir(self, sim, dia: int) -> Acciones:
        if dia < sim.params.dia_vacuna:
            return Acciones()
        cand = _candidatos(sim)
        if cand.size == 0:
            return Acciones()
        n = min(sim.params.dosis_dia, cand.size)
        # Ordena candidatos por centralidad descendente y toma los n primeros.
        orden = np.argsort(-sim.red.centralidad[cand], kind="stable")
        elegidos = cand[orden[:n]]
        return Acciones(vacunar=elegidos)


class CierresMasCentralidad:
    """Cierra el mercado y los buses más grandes (hasta max_cierres) y vacuna por centralidad."""

    nombre = "CierresMasCentralidad"

    def decidir(self, sim, dia: int) -> Acciones:
        # --- Cierres: mercado + buses más grandes ---
        tamanos = sim.red.tamano_lugar()
        a_cerrar: list[int] = []

        mercados = sim.red.lugares_de_tipo("mercado")
        for m in mercados:
            if len(a_cerrar) < sim.params.max_cierres:
                a_cerrar.append(int(m))

        buses = sim.red.lugares_de_tipo("bus")
        buses_ordenados = buses[np.argsort(-tamanos[buses], kind="stable")]
        for b in buses_ordenados:
            if len(a_cerrar) < sim.params.max_cierres:
                a_cerrar.append(int(b))

        cerrar = np.array(a_cerrar, dtype=np.int64)

        # --- Vacunación por centralidad ---
        vacunar = np.array([], dtype=np.int64)
        if dia >= sim.params.dia_vacuna:
            cand = _candidatos(sim)
            if cand.size > 0:
                n = min(sim.params.dosis_dia, cand.size)
                orden = np.argsort(-sim.red.centralidad[cand], kind="stable")
                vacunar = cand[orden[:n]]

        return Acciones(vacunar=vacunar, cerrar=cerrar)


class Anillo:
    """Vacunación en anillo: prioriza a quienes comparten lugar con casos conocidos.

    Si no hay casos conocidos, cae en la estrategia de centralidad.
    """

    nombre = "Anillo"

    def __init__(self) -> None:
        self._centralidad = Centralidad()

    def decidir(self, sim, dia: int) -> Acciones:
        if dia < sim.params.dia_vacuna:
            return Acciones()

        cand = _candidatos(sim)
        if cand.size == 0:
            return Acciones()

        # Casos conocidos (zombi o portador detectados).
        conocidos = np.where((sim.conocido == ZOMBI) | (sim.conocido == PORTADOR))[0]
        if conocidos.size == 0:
            return self._centralidad.decidir(sim, dia)

        # Lugares que tocan los casos conocidos.
        mask_casos = np.isin(sim.red.persona, conocidos)
        lugares_calientes = np.unique(sim.red.lugar[mask_casos])

        # Personas que comparten alguno de esos lugares.
        mask_contacto = np.isin(sim.red.lugar, lugares_calientes)
        personas_anillo = np.unique(sim.red.persona[mask_contacto])

        # Intersección con candidatos.
        en_anillo = np.intersect1d(personas_anillo, cand, assume_unique=False)

        n = sim.params.dosis_dia
        if en_anillo.size >= n:
            # Prioriza por centralidad dentro del anillo.
            orden = np.argsort(-sim.red.centralidad[en_anillo], kind="stable")
            elegidos = en_anillo[orden[:n]]
        else:
            # Completa con el resto de candidatos por centralidad.
            resto = np.setdiff1d(cand, en_anillo, assume_unique=False)
            orden = np.argsort(-sim.red.centralidad[resto], kind="stable")
            faltan = n - en_anillo.size
            elegidos = np.concatenate([en_anillo, resto[orden[:faltan]]])

        return Acciones(vacunar=elegidos)


def todas() -> list:
    """Devuelve una instancia de cada una de las cinco estrategias."""
    return [Nada(), Azar(), Centralidad(), CierresMasCentralidad(), Anillo()]
