"""Verifica que agregar las curvas diarias NO cambió los resultados existentes.

``comparar_detallado`` añade percentiles diarios, pero debe producir EXACTAMENTE
los mismos números que ``comparar`` (misma semilla => mismos resultados).
"""

from __future__ import annotations

import numpy as np

from simulador.params import Params
from simulador.corridas import comparar, comparar_detallado, correr_una_corrida, resumir_corridas


def test_detallado_coincide_con_comparar():
    params = Params().con(semilla=42, dias=20)
    n = 10

    base = comparar(params, n_corridas=n)
    det = comparar_detallado(params, n_corridas=n)

    assert set(base.keys()) == set(det.keys())
    for nombre in base:
        b = base[nombre]
        d = det[nombre]
        # Escalares idénticos.
        assert b.infectados_media == d.infectados_media
        assert b.infectados_p10 == d.infectados_p10
        assert b.infectados_p90 == d.infectados_p90
        assert b.salvados_media == d.salvados_media
        assert b.salvados_p10 == d.salvados_p10
        assert b.salvados_p90 == d.salvados_p90
        # La curva media debe coincidir con la de comparar().
        np.testing.assert_allclose(b.curva_zombis, d.curva_zombis, rtol=0, atol=1e-9)
        # Y ahora sí hay percentiles diarios.
        assert d.curva_zombis_p10 is not None
        assert d.curva_zombis_p90 is not None
        assert d.curva_zombis_p10.shape == (params.dias + 1,)


def test_agregacion_por_corrida_es_orden_independiente():
    """Agregar en orden da el mismo resultado que el camino secuencial."""
    params = Params().con(semilla=99, dias=15)
    n = 7

    # Camino "paralelo": calcular cada corrida por separado y agregar en orden.
    por_corrida = [correr_una_corrida(params, i) for i in range(n)]
    resumen_par = resumir_corridas(params, por_corrida)

    # Camino secuencial de referencia.
    resumen_seq = comparar_detallado(params, n_corridas=n)

    for nombre in resumen_seq:
        a = resumen_par[nombre]
        b = resumen_seq[nombre]
        assert a.infectados_media == b.infectados_media
        np.testing.assert_array_equal(a.curva_zombis, b.curva_zombis)
        np.testing.assert_array_equal(a.curva_zombis_p10, b.curva_zombis_p10)
        np.testing.assert_array_equal(a.curva_zombis_p90, b.curva_zombis_p90)
