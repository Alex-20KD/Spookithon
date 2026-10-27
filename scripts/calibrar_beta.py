"""Calibra el parámetro ``beta`` para que R0 (media) ≈ 2,5.

Procedimiento (reproducible):
  1. Verifica que R0 CREZCA con beta (monotonía) en un barrido corto; si no,
     avisa y se detiene (bisecar no tendría sentido).
  2. Busca por BISECCIÓN el beta tal que R0_media = objetivo (2,5) con
     tolerancia ±tol (0,1 por defecto).
  3. Guarda el resultado en src/simulador/data/calibracion.json.
  4. Imprime una tabla de sensibilidad de R0 para V = 7, 14 y 21 días.
  5. Reporta el % de población infectada a 30/45/60 días (sin intervención).

No toca AWS. No modifica docs/ ni infra/. Actualizar el beta por defecto en
params.py es un paso MANUAL que este script sugiere al final (y que ya dejamos
hecho con el valor calibrado).

Uso::

    PYTHONPATH=src python scripts/calibrar_beta.py --corridas 200 --semilla 42
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

_RAIZ = Path(__file__).resolve().parents[1]
_SRC = _RAIZ / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from simulador.params import Params  # noqa: E402
from simulador.r0 import medir_r0, V_POR_DEFECTO  # noqa: E402
from simulador.red import construir_red  # noqa: E402
from simulador.modelo import Simulacion  # noqa: E402
from simulador import estrategias as _estrategias  # noqa: E402

_RUTA_JSON = _SRC / "simulador" / "data" / "calibracion.json"
_OBJETIVO = 2.5


def _r0_media(beta: float, corridas: int, v: int, semilla: int) -> float:
    return medir_r0(Params().con(beta=beta), n_corridas=corridas, v=v, semilla=semilla).media


def verificar_monotonia(corridas: int, v: int, semilla: int) -> bool:
    """R0 debe crecer con beta. Revisa un barrido corto y creciente."""
    betas = [0.005, 0.01, 0.02, 0.04]
    valores = [_r0_media(b, max(40, corridas // 4), v, semilla) for b in betas]
    creciente = all(valores[i] < valores[i + 1] for i in range(len(valores) - 1))
    print("Chequeo de monotonía (R0 debe crecer con beta):")
    for b, val in zip(betas, valores):
        print(f"    beta={b:.3f} -> R0={val:.3f}")
    print(f"    monótona creciente: {creciente}\n")
    return creciente


def bisectar(corridas: int, v: int, semilla: int, tol: float) -> tuple[float, float]:
    """Bisección de beta para que R0_media = objetivo ± tol.

    Returns:
        (beta_calibrado, r0_en_ese_beta).
    """
    lo, hi = 0.0, 0.10  # R0(0)≈0 y R0(0.10)≫2,5, así que el objetivo está dentro.
    r0_lo = _r0_media(lo, corridas, v, semilla) if lo > 0 else 0.0
    r0_hi = _r0_media(hi, corridas, v, semilla)
    if not (r0_lo <= _OBJETIVO <= r0_hi):
        raise SystemExit(
            f"El objetivo {_OBJETIVO} no está dentro de [R0({lo})={r0_lo:.2f}, "
            f"R0({hi})={r0_hi:.2f}]. Ajusta el rango de bisección."
        )

    beta = hi
    r0 = r0_hi
    for _ in range(40):  # 40 iteraciones acotan el intervalo muchísimo
        beta = 0.5 * (lo + hi)
        r0 = _r0_media(beta, corridas, v, semilla)
        if abs(r0 - _OBJETIVO) <= tol:
            break
        if r0 < _OBJETIVO:
            lo = beta
        else:
            hi = beta
    return beta, r0


def tabla_sensibilidad(beta: float, corridas: int, semilla: int) -> dict[int, dict]:
    """R0 para V = 7, 14 y 21 días con el beta dado."""
    print("Sensibilidad de R0 a la ventana V (beta calibrado):")
    print(f"    {'V (días)':<10}{'R0 media':<12}{'mediana':<10}{'p10-p90'}")
    salida: dict[int, dict] = {}
    for v in (7, 14, 21):
        r = medir_r0(Params().con(beta=beta), n_corridas=corridas, v=v, semilla=semilla)
        print(f"    {v:<10}{r.media:<12.3f}{r.mediana:<10.2f}{r.p10:.2f}-{r.p90:.2f}")
        salida[v] = {"media": r.media, "mediana": r.mediana, "p10": r.p10, "p90": r.p90}
    print()
    return salida


def reporte_horizonte(beta: float, corridas: int, semilla: int) -> dict[int, dict]:
    """% de población infectada a 30/45/60 días, sin intervención.

    Usa la estrategia Nada y apaga vacuna/cierres/medidas para ver la epidemia
    "natural". Sirve para justificar el horizonte por defecto en el README.
    """
    print("Horizonte sin intervención (% población infectada):")
    print(f"    {'día':<8}{'media %':<12}{'p10-p90 %'}")
    objetivos = (30, 45, 60)
    base = Params().con(
        beta=beta,
        dias=max(objetivos),
        dia_medidas=10_000,
        dia_vacuna=10_000,
        dias_detectar=10_000,
    )
    porcentajes = {d: [] for d in objetivos}
    for i in range(corridas):
        s = semilla + i
        red = construir_red(base.poblacion, s)
        sim = Simulacion(base, red, _estrategias.Nada(), semilla=s)
        sim.correr()
        # "Infectados acumulados" hasta el día d = población - SANOS - INMUNES,
        # pero aquí no hay inmunes (sin vacuna), así que = población - SANOS.
        # La curva registra SANO en la columna 0.
        sanos_por_dia = sim.curva[:, 0]
        for d in objetivos:
            infectados = base.poblacion - int(sanos_por_dia[d])
            porcentajes[d].append(100.0 * infectados / base.poblacion)

    import numpy as np

    salida: dict[int, dict] = {}
    for d in objetivos:
        arr = np.array(porcentajes[d])
        media = float(arr.mean())
        p10 = float(np.percentile(arr, 10))
        p90 = float(np.percentile(arr, 90))
        print(f"    {d:<8}{media:<12.1f}{p10:.1f}-{p90:.1f}")
        salida[d] = {"media": media, "p10": p10, "p90": p90}
    print()
    return salida


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="calibrar_beta",
        description="Calibra beta para R0≈2,5 (definición de ventana fija V).",
    )
    p.add_argument("--corridas", type=int, default=200, help="corridas por evaluación de R0")
    p.add_argument("--semilla", type=int, default=42, help="semilla base (reproducibilidad)")
    p.add_argument("--v", type=int, default=V_POR_DEFECTO, help="ventana en días para R0")
    p.add_argument("--tol", type=float, default=0.1, help="tolerancia de R0 respecto a 2,5")
    p.add_argument("--guardar", action="store_true", help="escribe calibracion.json")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)

    print(f"Calibración de beta para R0 = {_OBJETIVO} ± {args.tol}")
    print(f"V={args.v} días, {args.corridas} corridas por evaluación, semilla={args.semilla}\n")

    if not verificar_monotonia(args.corridas, args.v, args.semilla):
        raise SystemExit("R0 NO es monótona creciente en beta: no se puede bisecar.")

    beta, r0 = bisectar(args.corridas, args.v, args.semilla, args.tol)
    r = medir_r0(Params().con(beta=beta), n_corridas=args.corridas, v=args.v, semilla=args.semilla)
    import numpy as np

    desv = float(np.std(r.muestras, ddof=1))
    err_est = float(desv / np.sqrt(len(r.muestras)))
    print(f"beta calibrado = {beta:.5f}")
    print(
        f"R0 medido: media={r.media:.3f}  mediana={r.mediana:.2f}  "
        f"p10-p90={r.p10:.2f}-{r.p90:.2f}  desv={desv:.3f}  err_est={err_est:.4f}\n"
    )

    sens = tabla_sensibilidad(beta, args.corridas, args.semilla)
    hor = reporte_horizonte(beta, args.corridas, args.semilla)

    resultado = {
        "beta": round(beta, 6),
        "r0": {
            "media": r.media,
            "mediana": r.mediana,
            "p10": r.p10,
            "p90": r.p90,
            "desv_est": desv,
            "err_est": err_est,
        },
        "v": args.v,
        "n_corridas": args.corridas,
        "semilla": args.semilla,
        "tolerancia": args.tol,
        "objetivo_r0": _OBJETIVO,
        "sensibilidad_v": sens,
        "horizonte": hor,
        "fecha": date.today().isoformat(),
        "definicion_r0": (
            "Infecciones secundarias directas de 1 caso índice al azar en una "
            "ventana fija de V días, población 100% susceptible, sin intervenciones."
        ),
    }

    if args.guardar:
        _RUTA_JSON.parent.mkdir(parents=True, exist_ok=True)
        with open(_RUTA_JSON, "w", encoding="utf-8") as fh:
            json.dump(resultado, fh, ensure_ascii=False, indent=2)
        print(f"Resultado guardado en {_RUTA_JSON}")
    else:
        print("(No se guardó JSON; usa --guardar para escribir calibracion.json.)")

    print(
        f"\nSugerencia: fija en params.py  beta = {beta:.5f}  "
        "(apuntando a data/calibracion.json)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
