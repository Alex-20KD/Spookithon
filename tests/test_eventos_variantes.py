"""Pruebas de eventos de brote y variantes (motor)."""

from __future__ import annotations

import numpy as np

from simulador.params import Params
from simulador.red import construir_red
from simulador.catalogo import cargar_catalogo
from simulador import corridas


def _red():
    return construir_red(500, 42, cargar_catalogo())


def test_eventos_no_alteran_poblacion():
    evs = [
        {"tipo": "aparicion_acechador", "dia": 2, "barrio_id": "b01", "intensidad": 4, "duracion": 3},
        {"tipo": "aparicion_chasqueador", "dia": 3, "barrio_id": "b02", "intensidad": 3, "duracion": 3},
        {"tipo": "aparicion_gordinflon", "dia": 4, "barrio_id": "b03", "intensidad": 2, "duracion": 3},
        {"tipo": "horda_migratoria", "dia": 5, "barrio_id": "b04", "intensidad": 6, "duracion": 2},
    ]
    params = Params(poblacion=500, dias=10)
    red = _red()
    from simulador.modelo import Simulacion
    from simulador import estrategias as E
    sim = Simulacion(params, red, E.Nada(), semilla=42, registrar_trayectoria=True, eventos=evs)
    res = sim.correr()
    # Población conservada: suma de estados = población en cada día.
    for punto in res.trayectoria:
        g = punto["global"]
        total = g["SANO"] + g["INCUBANDO"] + g["PORTADOR"] + g["ZOMBI"] + g["INMUNE"]
        assert total == params.poblacion


def test_reproducibilidad_con_eventos():
    evs = [{"tipo": "aparicion_acechador", "dia": 2, "barrio_id": "b01", "intensidad": 4, "duracion": 3}]
    params = Params(poblacion=500, dias=10)
    r1 = corridas.correr_una_corrida(params, 0, eventos=evs)
    r2 = corridas.correr_una_corrida(params, 0, eventos=evs)
    assert r1["Nada"][0] == r2["Nada"][0]
    assert np.array_equal(r1["Nada"][1], r2["Nada"][1])


def test_variantes_presentes_en_trayectoria():
    evs = [{"tipo": "aparicion_acechador", "dia": 2, "barrio_id": "b01", "intensidad": 4, "duracion": 3}]
    params = Params(poblacion=500, dias=10)
    traj = corridas.correr_trayectoria(params, "Nada", 42, evs)
    dia2 = traj["trayectoria"][2]
    v = dia2["global"]["variantes"]
    assert v["acechador"] >= 4


def test_eventos_producen_efecto_distinto():
    params = Params(poblacion=500, dias=15, semilla=7)
    base = corridas.correr_una_corrida(params, 0, eventos=None)["Nada"][0]
    evs = [{"tipo": "aparicion_gordinflon", "dia": 3, "barrio_id": "b01", "intensidad": 10, "duracion": 5}]
    con = corridas.correr_una_corrida(params, 0, eventos=evs)["Nada"][0]
    assert con != base