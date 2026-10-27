"""Interfaz de línea de comandos del simulador.

Uso::

    PYTHONPATH=src python -m simulador.cli --corridas 50 --semilla 42

Opciones adicionales: --beta, --dosis, --eficacia, --inicio.
Imprime una tabla con infectados (p10-p90) y salvados por estrategia.
"""

from __future__ import annotations

import argparse

from .params import Params
from .corridas import comparar


def _construir_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="simulador.cli",
        description="Simulación ficticia de la 'Plaga Caracol' en Manta (hackathon).",
    )
    p.add_argument("--corridas", type=int, default=300, help="número de corridas pareadas")
    p.add_argument("--semilla", type=int, default=42, help="semilla base")
    p.add_argument("--beta", type=float, default=None, help="tasa de transmisión (calibrada a R0≈2,5)")
    p.add_argument("--dosis", type=int, default=None, help="dosis por día")
    p.add_argument("--eficacia", type=float, default=None, help="eficacia de la vacuna (0..1)")
    p.add_argument(
        "--inicio",
        type=str,
        default=None,
        choices=["hospital", "mercado", "colegio", "bus"],
        help="tipo de lugar de inicio del brote",
    )
    return p


def _params_desde_args(args: argparse.Namespace) -> Params:
    cambios = {"semilla": args.semilla}
    if args.beta is not None:
        cambios["beta"] = args.beta
    if args.dosis is not None:
        cambios["dosis_dia"] = args.dosis
    if args.eficacia is not None:
        cambios["eficacia_vacuna"] = args.eficacia
    if args.inicio is not None:
        cambios["lugar_inicio"] = args.inicio
    return Params().con(**cambios)


def _imprimir_tabla(resumen: dict, n_corridas: int) -> None:
    print(f"\nResultados sobre {n_corridas} corridas (comparación pareada)")
    print(
        "Nota: simulación FICTICIA. beta está calibrado para R0≈2,5 "
        "(infecciones directas de 1 caso índice en una ventana de 14 días,\n"
        "población 100% susceptible y sin intervenciones). Ver "
        "src/simulador/data/calibracion.json.\n"
    )

    enc = f"{'Estrategia':<22} {'Infectados (p10-p90)':<28} {'Salvados (p10-p90)':<28}"
    print(enc)
    print("-" * len(enc))

    # Orden: Nada primero, luego por salvados media descendente.
    orden = sorted(
        resumen.values(),
        key=lambda r: (r.nombre != "Nada", -r.salvados_media),
    )
    for r in orden:
        inf = f"{r.infectados_media:7.1f}  ({r.infectados_p10:.0f}-{r.infectados_p90:.0f})"
        sal = f"{r.salvados_media:7.1f}  ({r.salvados_p10:.0f}-{r.salvados_p90:.0f})"
        print(f"{r.nombre:<22} {inf:<28} {sal:<28}")
    print()


def main(argv: list[str] | None = None) -> int:
    args = _construir_parser().parse_args(argv)
    params = _params_desde_args(args)
    resumen = comparar(params, n_corridas=args.corridas)
    _imprimir_tabla(resumen, args.corridas)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
