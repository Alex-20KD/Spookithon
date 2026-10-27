from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.backend.configuracion import Configuracion
from app.backend.main import crear_app


@pytest.fixture()
def cliente():
    cfg = Configuracion(
        cors_origins=["http://localhost:5173"],
        n_corridas_max=10,
        dias_max=15,
        max_simulaciones=2,
        max_workers=2,
    )
    app = crear_app(cfg)
    with TestClient(app) as c:
        yield c


def test_trayectoria_basica(cliente):
    cuerpo = {"dias": 8, "semilla": 42, "estrategia": "Nada"}
    r = cliente.post("/trayectoria", json=cuerpo)
    assert r.status_code == 200
    d = r.json()
    assert d["estrategia"] == "Nada"
    assert d["dias"] == 8
    assert len(d["serie_global"]) == 9
    assert len(d["serie_por_barrio"]) == 12
    for b in d["serie_por_barrio"]:
        assert len(b["puntos"]) == 9


def test_trayectoria_reproducible(cliente):
    cuerpo = {"dias": 8, "semilla": 7, "estrategia": "Centralidad"}
    r1 = cliente.post("/trayectoria", json=cuerpo)
    r2 = cliente.post("/trayectoria", json=cuerpo)
    assert r1.status_code == 200
    assert r1.json() == r2.json()


def test_trayectoria_conservacion_poblacion(cliente):
    cuerpo = {"dias": 8, "semilla": 42, "estrategia": "Nada", "poblacion" if False else "dias": 8}
    r = cliente.post("/trayectoria", json={"dias": 8, "semilla": 42, "estrategia": "Nada"})
    assert r.status_code == 200
    d = r.json()
    for punto in d["serie_global"]:
        total = punto["SANO"] + punto["INCUBANDO"] + punto["PORTADOR"] + punto["ZOMBI"] + punto["INMUNE"]
        assert total == 3000


def test_trayectoria_estrategia_cambia_resultado(cliente):
    r1 = cliente.post("/trayectoria", json={"dias": 12, "semilla": 42, "estrategia": "Nada"})
    r2 = cliente.post("/trayectoria", json={"dias": 12, "semilla": 42, "estrategia": "CierresMasCentralidad"})
    assert r1.status_code == 200 and r2.status_code == 200
    # Las series globales no deben ser idénticas entre estrategias distintas.
    assert r1.json()["serie_global"] != r2.json()["serie_global"]


def test_trayectoria_parametro_invalido(cliente):
    r = cliente.post("/trayectoria", json={"dias": 8, "semilla": 42, "estrategia": "Luna"})
    assert r.status_code == 422


def test_comparar_sigue_funcionando(cliente):
    r = cliente.post("/comparar", json={"dias": 8, "semilla": 42, "n_corridas": 3})
    assert r.status_code == 200
    d = r.json()
    assert len(d["estrategias"]) == 5
    assert "mapa" in d
