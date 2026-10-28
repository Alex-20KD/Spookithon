"""Acceso de LECTURA a las tablas DynamoDB de la Plaga Zombie (datos SIMULADOS).

Este módulo es la capa de datos real del backend: lee los ítems ficticios que
``scripts/cargar_datos.py`` cargó en las 6 tablas ``plaga-*`` (us-east-1).

Diseño:
- Solo LECTURA (scan/query/get). La simulación sigue en memoria; esto expone el
  estado del escenario (casos, curas, inventario, fumigaciones, noticias).
- boto3 se importa de forma perezosa: si no está instalado o no hay credenciales,
  se lanza :class:`DatosNoDisponibles` y la capa HTTP responde 503 claro, sin
  tumbar el servidor ni exponer trazas.
- El cliente de DynamoDB se crea una sola vez (lru_cache).
- Los ``Decimal`` de DynamoDB se convierten a int/float para que FastAPI los
  serialice a JSON sin problemas.
"""

from __future__ import annotations

import os
from decimal import Decimal
from functools import lru_cache
from typing import Any

REGION = os.getenv("AWS_REGION", "us-east-1")

TABLAS = {
    "casos": "plaga-casos",
    "curas": "plaga-curas",
    "sintomas": "plaga-sintomas",
    "inventario": "plaga-inventario",
    "fumigaciones": "plaga-fumigaciones",
    "noticias": "plaga-noticias",
}


class DatosNoDisponibles(Exception):
    """La capa de datos (DynamoDB) no está accesible ahora mismo."""


@lru_cache(maxsize=1)
def _recurso():
    """Crea el recurso DynamoDB una sola vez. Lanza DatosNoDisponibles si falla."""
    try:
        import boto3  # import perezoso
    except ImportError as exc:  # pragma: no cover
        raise DatosNoDisponibles("boto3 no está instalado") from exc
    try:
        return boto3.resource("dynamodb", region_name=REGION)
    except Exception as exc:  # pragma: no cover
        raise DatosNoDisponibles("no se pudo inicializar DynamoDB") from exc


def _normalizar(valor: Any) -> Any:
    """Convierte Decimal -> int/float y recorre listas/dicts recursivamente."""
    if isinstance(valor, Decimal):
        entero = int(valor)
        return entero if entero == valor else float(valor)
    if isinstance(valor, list):
        return [_normalizar(v) for v in valor]
    if isinstance(valor, dict):
        return {k: _normalizar(v) for k, v in valor.items()}
    return valor


def _tabla(clave: str):
    nombre = TABLAS[clave]
    try:
        return _recurso().Table(nombre)
    except DatosNoDisponibles:
        raise
    except Exception as exc:  # pragma: no cover
        raise DatosNoDisponibles(f"no se pudo abrir la tabla {nombre}") from exc


def _scan(clave: str, limite: int = 500) -> list[dict]:
    """Scan simple de una tabla (datos pequeños de demo). Devuelve items normalizados."""
    try:
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError as exc:  # pragma: no cover
        raise DatosNoDisponibles("botocore no disponible") from exc
    try:
        resp = _tabla(clave).scan(Limit=limite)
        return [_normalizar(it) for it in resp.get("Items", [])]
    except (BotoCoreError, ClientError) as exc:
        raise DatosNoDisponibles(f"error leyendo {TABLAS[clave]}") from exc


# ---------------------------- Lecturas públicas ---------------------------- #

def listar_casos(limite: int = 500) -> list[dict]:
    return _scan("casos", limite)


def listar_curas() -> list[dict]:
    return _scan("curas")


def listar_sintomas() -> list[dict]:
    return _scan("sintomas")


def listar_inventario() -> list[dict]:
    return _scan("inventario")


def listar_fumigaciones() -> list[dict]:
    return _scan("fumigaciones")


def listar_noticias() -> list[dict]:
    return _scan("noticias")


def resumen_casos() -> dict[str, Any]:
    """Agregado útil: total de casos y conteo por estado y por barrio."""
    casos = listar_casos()
    por_estado: dict[str, int] = {}
    por_barrio: dict[str, int] = {}
    for c in casos:
        por_estado[c.get("estado", "?")] = por_estado.get(c.get("estado", "?"), 0) + 1
        por_barrio[c.get("barrio_id", "?")] = por_barrio.get(c.get("barrio_id", "?"), 0) + 1
    return {
        "total": len(casos),
        "por_estado": por_estado,
        "por_barrio": por_barrio,
    }
