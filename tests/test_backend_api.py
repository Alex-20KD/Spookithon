"""Pruebas del backend FastAPI (sin AWS), usando TestClient.

Cubre:
- /salud responde {"estado": "ok"}.
- /catalogo devuelve 12 barrios y 10 edificios.
- /parametros devuelve los parámetros editables con rangos.
- /comparar: misma semilla + parámetros => respuesta IDÉNTICA (reproducible).
- Parámetros fuera de rango => 422.
- n_corridas por encima del tope => 422.
- La respuesta incluye las 5 estrategias, las curvas y mejor_estrategia.
- Reproducibilidad con distinto número de procesos (1 vs varios).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.backend.configuracion import Configuracion
from app.backend.main import crear_app


@pytest.fixture()
def cliente():
    # Config de prueba: pocos procesos, topes bajos para ir rápido.
    cfg = Configuracion(
        cors_origins=["http://localhost:5173"],
        n_corridas_max=300,
        dias_max=90,
        max_simulaciones=2,
        max_workers=2,
    )
    app = crear_app(cfg)
    with TestClient(app) as c:
        yield c


def test_salud_ok(cliente):
    r = cliente.get("/salud")
    assert r.status_code == 200
    assert r.json() == {"estado": "ok"}


def test_catalogo_12_barrios_10_edificios(cliente):
    r = cliente.get("/catalogo")
    assert r.status_code == 200
    datos = r.json()
    assert len(datos["barrios"]) == 12
    assert len(datos["edificios"]) == 10
    assert datos["aviso"] == "DATOS SIMULADOS"


def test_parametros_incluye_editables(cliente):
    r = cliente.get("/parametros")
    assert r.status_code == 200
    datos = r.json()
    p = datos["parametros"]
    for campo in [
        "beta", "dosis_dia", "eficacia_vacuna", "lugar_inicio",
        "dias_detectar", "infect_portador", "dias", "semilla", "n_corridas",
    ]:
        assert campo in p
        assert "descripcion" in p[campo]
    assert datos["topes"]["n_corridas_max"] == 300
    assert datos["topes"]["dias_max"] == 90


def test_comparar_reproducible(cliente):
    cuerpo = {"semilla": 42, "dias": 20, "n_corridas": 6}
    r1 = cliente.post("/comparar", json=cuerpo)
    r2 = cliente.post("/comparar", json=cuerpo)
    assert r1.status_code == 200
    assert r2.status_code == 200
    # Misma semilla + parámetros => misma respuesta exacta.
    assert r1.json() == r2.json()


def test_comparar_cinco_estrategias_curvas_y_mejor(cliente):
    cuerpo = {"semilla": 7, "dias": 15, "n_corridas": 5}
    r = cliente.post("/comparar", json=cuerpo)
    assert r.status_code == 200
    datos = r.json()

    nombres = {e["nombre"] for e in datos["estrategias"]}
    assert nombres == {"Nada", "Azar", "Centralidad", "CierresMasCentralidad", "Anillo"}
    assert len(datos["estrategias"]) == 5

    # Cada estrategia trae su curva diaria (longitud dias+1).
    for e in datos["estrategias"]:
        curva = e["curva_diaria"]
        assert len(curva["dias"]) == 16
        assert len(curva["media"]) == 16
        assert len(curva["p10"]) == 16
        assert len(curva["p90"]) == 16

    assert datos["mejor_estrategia"] in nombres
    assert datos["mejor_estrategia"] != "Nada"  # mejor entre las activas
    assert datos["aviso"] == "DATOS SIMULADOS"
    assert "recomendacion" in datos
    assert datos["semilla"] == 7
    assert datos["n_corridas"] == 5
    # % mejor que Nada/Azar presentes.
    for e in datos["estrategias"]:
        assert "pct_mejor_que_nada" in e
        assert "pct_mejor_que_azar" in e


def test_parametro_fuera_de_rango_422(cliente):
    # eficacia_vacuna debe estar en [0, 1].
    r = cliente.post("/comparar", json={"eficacia_vacuna": 2.0, "n_corridas": 3})
    assert r.status_code == 422
    datos = r.json()
    assert datos["error"] == "parametros_invalidos"


def test_lugar_inicio_invalido_422(cliente):
    r = cliente.post("/comparar", json={"lugar_inicio": "luna", "n_corridas": 3})
    assert r.status_code == 422


def test_n_corridas_sobre_tope_422(cliente):
    # El tope de la config de prueba es 300.
    r = cliente.post("/comparar", json={"n_corridas": 301})
    assert r.status_code == 422


def test_campo_desconocido_rechazado_422(cliente):
    # 'poblacion' NO es editable: debe rechazarse (extra='forbid').
    r = cliente.post("/comparar", json={"poblacion": 5000, "n_corridas": 3})
    assert r.status_code == 422


def test_reproducible_con_distinto_numero_de_procesos():
    """El resultado es IDÉNTICO con 1 proceso o con varios (misma semilla)."""
    cuerpo = {"semilla": 123, "dias": 18, "n_corridas": 8}

    cfg1 = Configuracion(max_simulaciones=1, max_workers=1, dias_max=90, n_corridas_max=300)
    cfg4 = Configuracion(max_simulaciones=2, max_workers=4, dias_max=90, n_corridas_max=300)

    with TestClient(crear_app(cfg1)) as c1:
        r1 = c1.post("/comparar", json=cuerpo).json()
    with TestClient(crear_app(cfg4)) as c4:
        r4 = c4.post("/comparar", json=cuerpo).json()

    assert r1 == r4
