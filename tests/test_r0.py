"""Pruebas de la medición de R0 y de la calibración de beta (sin AWS)."""

import numpy as np

from simulador.params import Params
from simulador.red import construir_red
from simulador import estrategias
from simulador.modelo import Simulacion
from simulador.r0 import medir_r0


def test_r0_reproducible_misma_semilla():
    """Misma semilla y parámetros -> exactamente el mismo R0."""
    p = Params()
    r1 = medir_r0(p, n_corridas=40, v=14, semilla=42)
    r2 = medir_r0(p, n_corridas=40, v=14, semilla=42)
    assert r1.media == r2.media
    assert np.array_equal(r1.muestras, r2.muestras)


def test_r0_monotono_respecto_a_beta():
    """R0 debe crecer con beta."""
    valores = [
        medir_r0(Params().con(beta=b), n_corridas=40, v=14, semilla=42).media
        for b in (0.005, 0.01, 0.02, 0.04)
    ]
    assert all(valores[i] < valores[i + 1] for i in range(len(valores) - 1))


def test_flag_atribuir_apagado_da_resultados_identicos():
    """Con atribuir=False el modelo produce EXACTAMENTE lo mismo que la referencia.

    La atribución no debe consumir azar nuevo ni alterar la dinámica: una
    corrida de referencia (sin flag) y una con el flag encendido deben coincidir
    en todos los resultados observables.
    """
    p = Params().con(poblacion=1000, dias=20)

    red_ref = construir_red(p.poblacion, 123)
    ref = Simulacion(p, red_ref, estrategias.Nada(), semilla=123, atribuir=False)
    r_ref = ref.correr()

    # Encender la atribución NO debe cambiar nada observable.
    red_cmp = construir_red(p.poblacion, 123)
    con_flag = Simulacion(p, red_cmp, estrategias.Nada(), semilla=123, atribuir=True)
    r_cmp = con_flag.correr()

    assert r_cmp.infectados_totales == r_ref.infectados_totales
    assert r_cmp.dosis_usadas == r_ref.dosis_usadas
    assert r_cmp.dias_cierre == r_ref.dias_cierre
    assert np.array_equal(r_cmp.curva, r_ref.curva)


def test_atribucion_total_no_supera_nuevas_infecciones():
    """La suma de infecciones atribuidas no puede exceder los infectados secundarios.

    Cada infección se reparte fraccionalmente y suma 1 en total, así que el
    total atribuido debe igualar (salvo redondeo) a los infectados menos el
    caso índice.
    """
    p = Params().con(poblacion=1500, dias=14, casos_extra=0,
                      dia_medidas=99, dia_vacuna=99, dias_detectar=99)
    red = construir_red(p.poblacion, 7)
    sim = Simulacion(p, red, estrategias.Nada(), semilla=7, atribuir=True)
    r = sim.correr()
    secundarios = r.infectados_totales - 1  # menos el caso índice
    total_atribuido = float(sim.infecciones_causadas.sum())
    assert abs(total_atribuido - secundarios) < 1e-6


def test_beta_por_defecto_da_r0_en_rango():
    """El beta por defecto (calibrado) produce R0 dentro de [2,3; 2,7].

    Se usan pocas corridas y tolerancia amplia para que la prueba sea rápida
    pero significativa.
    """
    r = medir_r0(Params(), n_corridas=200, v=14, semilla=42)
    assert 2.3 <= r.media <= 2.7, f"R0 fuera de rango: {r.media:.3f}"
