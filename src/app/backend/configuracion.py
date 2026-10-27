"""Configuración del backend leída de variables de entorno.

Centraliza TODO lo configurable para que no haya valores mágicos repartidos por
el código. No hay secretos aquí: solo límites y orígenes CORS.

Variables de entorno (todas opcionales, con valores por defecto seguros):

- ``CORS_ORIGINS``: orígenes permitidos separados por comas.
  Por defecto ``http://localhost:5173`` (el dev server de Vite). Nunca ``*``.
- ``N_CORRIDAS_MAX``: tope de corridas por petición (por defecto 300).
- ``DIAS_MAX``: tope de días por petición (por defecto 90).
- ``MAX_SIMULACIONES``: simulaciones simultáneas permitidas (por defecto 2).
- ``MAX_WORKERS``: procesos del pool de simulación (por defecto ``os.cpu_count()``).
- ``AVISO_SIMULADO``: texto del aviso incluido en cada respuesta.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _leer_lista(nombre: str, por_defecto: list[str]) -> list[str]:
    bruto = os.getenv(nombre)
    if not bruto:
        return list(por_defecto)
    valores = [x.strip() for x in bruto.split(",") if x.strip()]
    return valores or list(por_defecto)


def _leer_int(nombre: str, por_defecto: int, minimo: int = 1) -> int:
    bruto = os.getenv(nombre)
    if not bruto:
        return por_defecto
    try:
        valor = int(bruto)
    except ValueError:
        return por_defecto
    return max(minimo, valor)


@dataclass(frozen=True)
class Configuracion:
    """Valores de configuración efectivos del backend."""

    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:5173"])
    n_corridas_max: int = 300
    dias_max: int = 90
    max_simulaciones: int = 2
    max_workers: int = 0  # 0 => usar os.cpu_count()
    aviso_simulado: str = "DATOS SIMULADOS"

    @property
    def workers_efectivos(self) -> int:
        if self.max_workers > 0:
            return self.max_workers
        return os.cpu_count() or 1


def cargar_configuracion() -> Configuracion:
    """Construye la :class:`Configuracion` a partir del entorno actual."""
    return Configuracion(
        cors_origins=_leer_lista("CORS_ORIGINS", ["http://localhost:5173"]),
        n_corridas_max=_leer_int("N_CORRIDAS_MAX", 300),
        dias_max=_leer_int("DIAS_MAX", 90),
        max_simulaciones=_leer_int("MAX_SIMULACIONES", 2),
        max_workers=_leer_int("MAX_WORKERS", 0, minimo=0),
        aviso_simulado=os.getenv("AVISO_SIMULADO", "DATOS SIMULADOS"),
    )
