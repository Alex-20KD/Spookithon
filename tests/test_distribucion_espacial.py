"""Validación geográfica del catálogo frente al GeoJSON oficial de Manta."""

from __future__ import annotations

import json
import math
from pathlib import Path

import importlib.util

RAIZ = Path(__file__).resolve().parent.parent
GEO = RAIZ / "src/app/frontend/public/geojson/manta_cabecera_cantonal.geojson"
CATALOGO = RAIZ / "src/simulador/data/catalogo.json"
SCRIPT = RAIZ / "scripts/distribuir_catalogo.py"


def _anillo():
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    return geo["features"][0]["geometry"]["coordinates"][0]


def _cargar_script():
    spec = importlib.util.spec_from_file_location("distribuir_catalogo", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _puntos():
    cat = json.loads(CATALOGO.read_text(encoding="utf-8"))
    pts = [("barrio", b["id"], b["lng"], b["lat"]) for b in cat["barrios"]]
    pts += [("edificio", e["id"], e["lng"], e["lat"]) for e in cat["edificios"]]
    return cat, pts


def _km(lng1, lat1, lng2, lat2):
    dy = (lat2 - lat1) * 110.574
    dx = (lng2 - lng1) * 111.320 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dx, dy)


def test_todas_las_coordenadas_estan_dentro_del_geojson():
    mod = _cargar_script()
    _, pts = _puntos()
    anillo = _anillo()
    fuera = [(t, i) for t, i, x, y in pts if not mod.dentro(x, y, anillo)]
    assert fuera == [], f"Puntos fuera del territorio oficial: {fuera}"


def test_ningun_punto_en_la_costa_occidental():
    mod = _cargar_script()
    _, pts = _puntos()
    en_costa = [(t, i) for t, i, x, _ in pts if x < mod.COSTA_LNG]
    assert en_costa == []


def test_coordenadas_unicas_y_centros_separados():
    mod = _cargar_script()
    cat, pts = _puntos()
    unicas = {(round(x, 5), round(y, 5)) for _, _, x, y in pts}
    assert len(unicas) == len(pts), "Hay coordenadas duplicadas"
    centros = [(b["lng"], b["lat"]) for b in cat["barrios"]]
    for i in range(len(centros)):
        for j in range(i + 1, len(centros)):
            d = math.hypot(centros[i][0] - centros[j][0], centros[i][1] - centros[j][1])
            assert d >= mod.SEPARACION_MIN - 1e-9, f"Centros demasiado cercanos: {i} {j}"


def test_extension_espacial_cubre_varios_sectores():
    cat, _ = _puntos()
    xs = [b["lng"] for b in cat["barrios"]]
    ys = [b["lat"] for b in cat["barrios"]]
    ancho = _km(min(xs), min(ys), max(xs), min(ys))
    alto = _km(min(xs), min(ys), min(xs), max(ys))
    assert ancho >= 3.5 and alto >= 3.5, f"Extensión insuficiente: {ancho:.2f} x {alto:.2f} km"


def test_ids_y_relaciones_conservadas():
    import subprocess

    cat, _ = _puntos()
    antes_txt = subprocess.run(
        ["git", "show", "HEAD:src/simulador/data/catalogo.json"],
        cwd=RAIZ, capture_output=True, text=True, check=True,
    ).stdout
    antes = json.loads(antes_txt)
    assert [b["id"] for b in cat["barrios"]] == [b["id"] for b in antes["barrios"]]
    assert [e["id"] for e in cat["edificios"]] == [e["id"] for e in antes["edificios"]]
    assert [e["barrio_id"] for e in cat["edificios"]] == [e["barrio_id"] for e in antes["edificios"]]
    assert len(cat["barrios"]) == 12 and len(cat["edificios"]) == 10


def test_generador_es_determinista():
    mod = _cargar_script()
    anillo = _anillo()
    a = mod.muestrear_barrios(12, anillo)
    b = mod.muestrear_barrios(12, anillo)
    assert a == b
