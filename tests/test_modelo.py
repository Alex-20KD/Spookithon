"""Pruebas de las reglas clave del modelo de simulación."""

import numpy as np

from simulador.params import Params
from simulador.red import construir_red
from simulador import estrategias
from simulador.modelo import Simulacion, SANO, INMUNE, ZOMBI, PORTADOR


def _red(poblacion=800, semilla=42):
    return construir_red(poblacion, semilla)


def test_vacuna_solo_inmuniza_a_sanos():
    """La vacuna solo convierte en INMUNE a quien estaba SANO."""
    params = Params().con(poblacion=800, dia_vacuna=1, eficacia_vacuna=1.0, dosis_dia=200)
    red = _red()
    sim = Simulacion(params, red, estrategias.Nada(), semilla=1)

    # Forzamos un estado mixto conocido.
    sim.estado[:] = SANO
    sim.estado[0:50] = PORTADOR  # infectados no detectados
    # Elegimos vacunar a personas sanas y a portadores.
    elegidos = np.arange(0, 100)  # 50 portadores + 50 sanos
    estado_antes = sim.estado.copy()
    sim._vacunar(elegidos)

    # Ningún portador pasó a INMUNE.
    portadores = np.where(estado_antes == PORTADOR)[0]
    assert np.all(sim.estado[portadores] == PORTADOR)
    # Con eficacia 1.0, todos los sanos vacunados pasaron a INMUNE.
    sanos = np.where(estado_antes == SANO)[0][:50]
    assert np.all(sim.estado[sanos] == INMUNE)


def test_nunca_mas_dosis_que_el_tope_diario():
    """No se gastan más de dosis_dia dosis en un día."""
    params = Params().con(poblacion=1500, dia_vacuna=1, dosis_dia=100, dia_medidas=1, dias=5)
    red = construir_red(1500, 7)
    sim = Simulacion(params, red, estrategias.Centralidad(), semilla=7)
    sim._aplicar_estrategia(dia=1)
    assert sim.dosis_usadas <= params.dosis_dia


def test_sin_vacunas_antes_de_dia_vacuna():
    """No hay vacunas antes de dia_vacuna."""
    params = Params().con(poblacion=800, dia_vacuna=10, dia_medidas=1, dias=9)
    red = _red()
    sim = Simulacion(params, red, estrategias.Azar(), semilla=3)
    sim.correr()
    assert sim.dosis_usadas == 0


def test_nada_conocido_antes_de_dias_detectar():
    """Nada se marca como conocido antes de dias_detectar."""
    params = Params().con(poblacion=800, dias_detectar=6, dias=5, dia_medidas=99, dia_vacuna=99)
    red = _red()
    sim = Simulacion(params, red, estrategias.Nada(), semilla=5)
    sim.correr()
    assert np.all(sim.conocido == SANO)


def test_reproducibilidad_exacta():
    """Misma semilla y parámetros -> exactamente el mismo resultado."""
    params = Params().con(poblacion=1000, dias=20)
    red1 = construir_red(params.poblacion, 123)
    red2 = construir_red(params.poblacion, 123)

    r1 = Simulacion(params, red1, estrategias.Anillo(), semilla=123).correr()
    r2 = Simulacion(params, red2, estrategias.Anillo(), semilla=123).correr()

    assert r1.infectados_totales == r2.infectados_totales
    assert r1.dosis_usadas == r2.dosis_usadas
    assert r1.dias_cierre == r2.dias_cierre
    assert np.array_equal(r1.curva, r2.curva)


def test_estrategias_solo_miran_estado_conocido():
    """Las estrategias no deben romperse ni usar el estado real; devuelven acciones válidas."""
    params = Params().con(poblacion=600, dia_vacuna=1)
    red = construir_red(600, 9)
    sim = Simulacion(params, red, estrategias.Nada(), semilla=9)
    for e in estrategias.todas():
        acc = e.decidir(sim, dia=15)
        # Los índices de vacuna deben ser personas válidas y no conocidas infectadas.
        if acc.vacunar.size:
            conocido_inf = (sim.conocido == ZOMBI) | (sim.conocido == PORTADOR)
            assert not np.any(conocido_inf[acc.vacunar])
