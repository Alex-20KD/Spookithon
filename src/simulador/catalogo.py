"""Carga y validación del catálogo de barrios y edificios.

El catálogo describe la geografía ficticia de Manta usada por la simulación:
12 barrios y 10 edificios (8 colegios, 1 mercado, 1 hospital).
Los buses NO forman parte del catálogo (se generan en la red de contactos).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Ruta al JSON, relativa a este archivo (no al directorio de ejecución).
_RUTA_CATALOGO = Path(__file__).parent / "data" / "catalogo.json"


def cargar_catalogo(ruta: str | Path | None = None) -> dict[str, Any]:
    """Lee el catálogo JSON y valida su consistencia.

    Validaciones:
      - ids de barrios únicos,
      - ids de edificios únicos,
      - cada ``barrio_id`` de un edificio debe existir entre los barrios.

    Args:
        ruta: ruta opcional a un JSON alternativo (para tests). Por defecto
            usa el catálogo empaquetado junto a este módulo.

    Returns:
        El diccionario del catálogo con claves ``barrios`` y ``edificios``.

    Raises:
        ValueError: si hay ids duplicados o un ``barrio_id`` inexistente.
    """
    ruta_final = Path(ruta) if ruta is not None else _RUTA_CATALOGO
    with open(ruta_final, "r", encoding="utf-8") as fh:
        catalogo = json.load(fh)

    barrios = catalogo.get("barrios", [])
    edificios = catalogo.get("edificios", [])

    ids_barrios = [b["id"] for b in barrios]
    if len(ids_barrios) != len(set(ids_barrios)):
        raise ValueError("Hay ids de barrio duplicados en el catálogo.")

    ids_edificios = [e["id"] for e in edificios]
    if len(ids_edificios) != len(set(ids_edificios)):
        raise ValueError("Hay ids de edificio duplicados en el catálogo.")

    conjunto_barrios = set(ids_barrios)
    for e in edificios:
        if e["barrio_id"] not in conjunto_barrios:
            raise ValueError(
                f"El edificio {e['id']} referencia un barrio_id inexistente: "
                f"{e['barrio_id']}."
            )

    return catalogo
