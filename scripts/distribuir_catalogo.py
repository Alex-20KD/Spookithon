"""Redistribuye las coordenadas ficticias del catálogo dentro del territorio de Manta.

Fuente territorial: src/app/frontend/public/geojson/manta_cabecera_cantonal.geojson
(límite parroquial oficial). Limitación documentada: el GeoJSON no separa suelo
urbano de suelo no urbano ni mar, así que se aplica una ventana urbana
aproximada (URBANO_BOX) y un margen costero (COSTA_LNG) sin cartografía de
suelo urbano disponible. Los puntos son ficticios.

Determinismo: secuencia de Halton (sin azar), por lo que el resultado es
idéntico en cada ejecución. Los IDs, nombres, tipos y asignaciones barrio_id
de edificios se conservan.
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
GEO = RAIZ / "src/app/frontend/public/geojson/manta_cabecera_cantonal.geojson"
CATALOGO = RAIZ / "src/simulador/data/catalogo.json"

# Ventana urbana aproximada (grados). Excluye el litoral occidental (COSTA_LNG).
URBANO_BOX = (-80.7300, -80.6780, -0.9790, -0.9330)  # lng_min, lng_max, lat_min, lat_max
COSTA_LNG = -80.7300  # no se colocan puntos al oeste de esta longitud
SEPARACION_MIN = 0.0085  # ~0,9 km entre centros de barrio


def halton(indice, base):
    f, r = 1.0, 0.0
    i = indice
    while i > 0:
        f /= base
        r += f * (i % base)
        i //= base
    return r


def dentro(lng, lat, anillo):
    x, y = lng, lat
    c = False
    j = len(anillo) - 1
    for i in range(len(anillo)):
        xi, yi = anillo[i]
        xj, yj = anillo[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            c = not c
        j = i
    return c


def punto_valido(lng, lat, anillo):
    l0, l1, t0, t1 = URBANO_BOX
    return l0 <= lng <= l1 and t0 <= lat <= t1 and lng >= COSTA_LNG and dentro(lng, lat, anillo)


def muestrear_barrios(n, anillo):
    l0, l1, t0, t1 = URBANO_BOX
    puntos = []
    k = 1
    while len(puntos) < n:
        if k > 20000:
            raise RuntimeError("No hay suficientes puntos válidos con la separación pedida")
        lng = l0 + (l1 - l0) * halton(k, 2)
        lat = t0 + (t1 - t0) * halton(k, 3)
        k += 1
        if not punto_valido(lng, lat, anillo):
            continue
        if any(((lng - a) ** 2 + (lat - b) ** 2) ** 0.5 < SEPARACION_MIN for a, b in puntos):
            continue
        puntos.append((round(lng, 5), round(lat, 5)))
    return puntos


def ubicar_edificio(cx, cy, idx, anillo):
    for paso in range(1, 400):
        ang = 2 * 3.14159265 * halton(paso, 2)
        rad = 0.0016 * halton(paso, 3)
        lng = cx + rad * __import__("math").cos(ang)
        lat = cy + rad * __import__("math").sin(ang)
        if punto_valido(lng, lat, anillo):
            return round(lng, 5), round(lat, 5)
    return cx, cy


def main():
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    anillo = geo["features"][0]["geometry"]["coordinates"][0]
    cat = json.loads(CATALOGO.read_text(encoding="utf-8"))

    centros = muestrear_barrios(len(cat["barrios"]), anillo)
    for b, (lng, lat) in zip(cat["barrios"], centros):
        b["lng"], b["lat"] = lng, lat

    centro_por_barrio = {b["id"]: (b["lng"], b["lat"]) for b in cat["barrios"]}
    for idx, e in enumerate(cat["edificios"]):
        cx, cy = centro_por_barrio[e["barrio_id"]]
        e["lng"], e["lat"] = ubicar_edificio(cx, cy, idx, anillo)

    CATALOGO.write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("barrios:", len(cat["barrios"]), "edificios:", len(cat["edificios"]))


if __name__ == "__main__":
    sys.exit(main())
