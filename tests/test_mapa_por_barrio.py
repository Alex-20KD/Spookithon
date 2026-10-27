"""Pruebas del desglose por barrio (issue del mapa).

Verifican que:
- El modelo cuenta infectados por barrio de forma consistente (la suma por
  barrio == infectados totales) y sin alterar la reproducibilidad.
- El resumen de corridas promedia el vector por barrio con la longitud correcta.
- El endpoint /comparar devuelve el bloque 'mapa' con los 12 barrios, sus
  coordenadas y los infectados medios de la mejor estrategia.
"""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from simulador.params import Params
from simulador.red import construir_red
from simulador import estrategias
from simulador.modelo import Simulacion
from simulador.corridas import barrios_orden, comparar_detallado

from app.backend.configuracion import Configuracion
from app.backend.main import crear_app


def test_infectados_por_barrio_suma_coincide_con_total():
    """La suma de infectados por barrio == infectados totales de la corrida."""
    params = Params().con(poblacion=1000, dias=20, semilla=42)
    red = construir_red(params.poblacion, 42)
    res = Simulacion(params, red, estrategias.Nada(), semilla=42).correr()

    # Un valor por barrio del catálogo.
    assert res.infectados_por_barrio.shape[0] == len(red.barrios_ids)
    # La geografía ficticia tiene 12 barrios.
    assert len(red.barrios_ids) == 12
    # Consistencia: cada persona pertenece a un solo barrio, así que la suma
    # por barrio debe ser exactamente el total de infectados.
    assert int(res.infectados_por_barrio.sum()) == res.infectados_totales


def test_barrios_orden_es_estable_e_independiente_de_semilla():
    p1 = Params().con(poblacion=800, semilla=1)
    p2 = Params().con(poblacion=800, semilla=999)
    assert barrios_orden(p1) == barrios_orden(p2)


def test_resumen_promedia_por_barrio():
    params = Params().con(poblacion=800, dias=15, semilla=7)
    resumen = comparar_detallado(params, n_corridas=5)
    ids = barrios_orden(params)
    for r in resumen.values():
        assert r.infectados_por_barrio_media is not None
        assert r.infectados_por_barrio_media.shape[0] == len(ids)
        assert np.all(r.infectados_por_barrio_media >= 0)


@pytest.fixture()
def cliente():
    cfg = Configuracion(
        cors_origins=["http://localhost:5173"],
        n_corridas_max=300,
        dias_max=90,
        max_simulaciones=2,
        max_workers=2,
    )
    with TestClient(crear_app(cfg)) as c:
        yield c


def test_comparar_incluye_bloque_mapa(cliente):
    r = cliente.post("/comparar", json={"semilla": 7, "dias": 15, "n_corridas": 5})
    assert r.status_code == 200
    datos = r.json()

    assert "mapa" in datos
    mapa = datos["mapa"]
    assert mapa["aviso"] == "DATOS SIMULADOS"
    assert mapa["estrategia"] == datos["mejor_estrategia"]
    assert len(mapa["barrios"]) == 12

    for b in mapa["barrios"]:
        assert "id" in b and "nombre" in b
        assert b["lat"] is not None and b["lng"] is not None
        assert b["infectados_media"] is not None and b["infectados_media"] >= 0

    # Cada estrategia también trae su propio vector por barrio (12 valores).
    for e in datos["estrategias"]:
        assert e["infectados_por_barrio"] is not None
        assert len(e["infectados_por_barrio"]) == 12
