"""Pruebas de carga y validación del catálogo."""

import json

import pytest

from simulador.catalogo import cargar_catalogo


def test_catalogo_por_defecto_es_valido():
    cat = cargar_catalogo()
    assert len(cat["barrios"]) == 12
    assert len(cat["edificios"]) == 10
    tipos = [e["tipo"] for e in cat["edificios"]]
    assert tipos.count("colegio") == 8
    assert tipos.count("mercado") == 1
    assert tipos.count("hospital") == 1


def test_rechaza_ids_de_barrio_duplicados(tmp_path):
    cat = {
        "barrios": [
            {"id": "b01", "nombre": "x", "lat": 0, "lng": 0},
            {"id": "b01", "nombre": "y", "lat": 0, "lng": 0},
        ],
        "edificios": [],
    }
    ruta = tmp_path / "cat.json"
    ruta.write_text(json.dumps(cat), encoding="utf-8")
    with pytest.raises(ValueError):
        cargar_catalogo(ruta)


def test_rechaza_ids_de_edificio_duplicados(tmp_path):
    cat = {
        "barrios": [{"id": "b01", "nombre": "x", "lat": 0, "lng": 0}],
        "edificios": [
            {"id": "e01", "nombre": "c", "tipo": "colegio", "barrio_id": "b01", "lat": 0, "lng": 0},
            {"id": "e01", "nombre": "d", "tipo": "colegio", "barrio_id": "b01", "lat": 0, "lng": 0},
        ],
    }
    ruta = tmp_path / "cat.json"
    ruta.write_text(json.dumps(cat), encoding="utf-8")
    with pytest.raises(ValueError):
        cargar_catalogo(ruta)


def test_rechaza_barrio_id_inexistente(tmp_path):
    cat = {
        "barrios": [{"id": "b01", "nombre": "x", "lat": 0, "lng": 0}],
        "edificios": [
            {"id": "e01", "nombre": "c", "tipo": "colegio", "barrio_id": "b99", "lat": 0, "lng": 0},
        ],
    }
    ruta = tmp_path / "cat.json"
    ruta.write_text(json.dumps(cat), encoding="utf-8")
    with pytest.raises(ValueError):
        cargar_catalogo(ruta)
