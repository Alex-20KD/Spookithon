"""Validación territorial con el GeoJSON oficial de Manta.

Única fuente: src/app/frontend/public/geojson/manta_cabecera_cantonal.geojson
(límite parroquial). El polígono excluye el agua de la bahía, por lo que sirve
para descartar coordenadas en el mar. No separa suelo urbano de rural.
"""

from __future__ import annotations

import json
from pathlib import Path

_RUTA = Path(__file__).resolve().parents[1] / "app" / "frontend" / "public" / "geojson" / "manta_cabecera_cantonal.geojson"
_anillo: list | None = None


def _cargar() -> list:
    global _anillo
    if _anillo is None:
        geo = json.loads(_RUTA.read_text(encoding="utf-8"))
        _anillo = geo["features"][0]["geometry"]["coordinates"][0]
    return _anillo


def dentro(lng: float, lat: float) -> bool:
    """Ray casting sobre el anillo exterior del polígono oficial."""
    poly = _cargar()
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi:
            c = not c
        j = i
    return c
