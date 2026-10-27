"""Pruebas del cargador de datos ficticios, SIN AWS ni credenciales reales.

No importa boto3 ni usa red: todo se valida sobre los ítems generados en
memoria por ``generar_items`` y sobre el flujo del CLI en modo simulación.
"""

import sys
from datetime import date
from decimal import Decimal
from pathlib import Path
from unittest import mock

# Asegura que 'scripts' y 'src' sean importables.
_RAIZ = Path(__file__).resolve().parents[1]
for sub in ("src", "scripts"):
    ruta = str(_RAIZ / sub)
    if ruta not in sys.path:
        sys.path.insert(0, ruta)

import cargar_datos  # noqa: E402
from simulador.catalogo import cargar_catalogo  # noqa: E402

FECHA_BASE = date(2026, 10, 26)


def _items():
    return cargar_datos.generar_items(semilla=42, fecha_base=FECHA_BASE)


def _recorrer_valores(obj):
    """Genera recursivamente todos los valores escalares de dicts/listas."""
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _recorrer_valores(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _recorrer_valores(v)
    else:
        yield obj


def test_ningun_float_en_los_items():
    items = _items()
    for lista in items.values():
        for it in lista:
            for v in _recorrer_valores(it):
                assert not isinstance(v, float), f"Se encontró un float: {v!r}"
                # También rechazamos tipos numpy (no deben aparecer).
                assert type(v).__module__ != "numpy", f"Tipo numpy prohibido: {v!r}"


def test_decimales_son_tipo_decimal():
    items = _items()
    for cura in items["curas"]:
        assert isinstance(cura["eficacia"], Decimal)


def test_barrios_y_edificios_existen_en_catalogo():
    catalogo = cargar_catalogo()
    ids_barrio = {b["id"] for b in catalogo["barrios"]}
    ids_edif = {e["id"] for e in catalogo["edificios"]}
    edif_a_barrio = {e["id"]: e["barrio_id"] for e in catalogo["edificios"]}

    items = _items()

    for caso in items["casos"]:
        assert caso["barrio_id"] in ids_barrio
        if "lugar_id" in caso:
            assert caso["lugar_id"] in ids_edif
            # El edificio debe pertenecer al mismo barrio del caso.
            assert edif_a_barrio[caso["lugar_id"]] == caso["barrio_id"]

    for fum in items["fumigaciones"]:
        assert fum["edificio_id"] in ids_edif
        assert fum["barrio_id"] in ids_barrio
        # Coherencia edificio-barrio.
        assert edif_a_barrio[fum["edificio_id"]] == fum["barrio_id"]


def test_ningun_caso_con_fecha_sintomas_vacia():
    items = _items()
    assert len(items["casos"]) > 0
    for caso in items["casos"]:
        assert caso["fecha_sintomas"], f"{caso['caso_id']} tiene fecha vacía"
        assert isinstance(caso["fecha_sintomas"], str)


def test_todos_los_items_son_simulados_y_autor_carga_inicial():
    items = _items()
    for lista in items.values():
        for it in lista:
            assert it.get("simulado") is True
    # Autor correcto según la tabla.
    assert all(c["registrado_por"] == "carga_inicial" for c in items["casos"])
    assert all(c["creada_por"] == "carga_inicial" for c in items["curas"])
    assert all(n["autor"] == "carga_inicial" for n in items["noticias"])


def test_modo_por_defecto_no_llama_a_aws():
    """El CLI sin --aplicar nunca debe invocar la función de escritura."""
    with mock.patch.object(cargar_datos, "escribir") as esc:
        cod = cargar_datos.main(["--semilla", "42"])
    assert cod == 0
    esc.assert_not_called()


def test_modo_aplicar_si_llama_a_escribir():
    """Con --aplicar se invoca escribir (que está mockeada, no toca AWS)."""
    with mock.patch.object(cargar_datos, "escribir") as esc:
        cargar_datos.main(["--aplicar", "--semilla", "42"])
    esc.assert_called_once()


def test_dos_corridas_misma_semilla_mismos_items():
    a = cargar_datos.generar_items(semilla=42, fecha_base=FECHA_BASE)
    b = cargar_datos.generar_items(semilla=42, fecha_base=FECHA_BASE)
    assert a == b


def test_semillas_distintas_difieren():
    a = cargar_datos.generar_items(semilla=1, fecha_base=FECHA_BASE)
    b = cargar_datos.generar_items(semilla=2, fecha_base=FECHA_BASE)
    # Al menos los casos deben variar (estados/lugares).
    assert a["casos"] != b["casos"]


def test_cantidades_esperadas():
    items = _items()
    assert len(items["casos"]) == 120
    assert len(items["curas"]) == 3
    assert len(items["inventario"]) == 9  # 3 curas x 3 centros
    assert 8 <= len(items["fumigaciones"]) <= 10
    assert len(items["noticias"]) == 4
