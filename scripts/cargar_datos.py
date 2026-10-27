"""Carga DATOS FICTICIOS en las 6 tablas DynamoDB del proyecto "Plaga Caracol".

TODO lo que genera este script es FICTICIO (hackathon). No usa ni produce datos
reales de salud. El script NO crea ni borra tablas: solo escribe ítems.

Seguridad:
  - No contiene llaves ni credenciales. Usa la cadena de credenciales por
    defecto de boto3 (``aws configure`` o variables de entorno). Región fija
    ``us-east-1``.
  - Por defecto corre en modo SIMULACIÓN (dry-run): no toca AWS, solo reporta
    cuántos ítems escribiría y muestra 2 ejemplos por tabla. Para escribir de
    verdad hay que pasar ``--aplicar``.
  - Todos los ítems llevan ``simulado=True`` y el autor "carga_inicial".

Uso típico::

    # Simulación (no toca AWS):
    PYTHONPATH=src python scripts/cargar_datos.py

    # Escritura real (requiere credenciales configuradas):
    PYTHONPATH=src python scripts/cargar_datos.py --aplicar
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

# Permite importar simulador.catalogo aunque no se pase PYTHONPATH=src.
_RAIZ = Path(__file__).resolve().parents[1]
_SRC = _RAIZ / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from simulador.catalogo import cargar_catalogo  # noqa: E402

REGION = "us-east-1"
AUTOR = "carga_inicial"

# Nombres de las 6 tablas (ya existen; NO se crean ni borran).
TABLAS = {
    "casos": "plaga-casos",
    "curas": "plaga-curas",
    "sintomas": "plaga-sintomas",
    "inventario": "plaga-inventario",
    "fumigaciones": "plaga-fumigaciones",
    "noticias": "plaga-noticias",
}

# Estados de caso (más incubando/portador que curado).
_ESTADOS_CASO = (
    ["incubando"] * 5
    + ["portador"] * 4
    + ["zombi"] * 2
    + ["curado"] * 2
    + ["mutado"] * 1
)


# --------------------------------------------------------------------------- #
# Utilidades
# --------------------------------------------------------------------------- #
def _iso_fecha(base: date, dias: int) -> str:
    """Fecha base desplazada ``dias`` días, como ISO 8601 (solo fecha)."""
    return (base + timedelta(days=dias)).isoformat()


def _iso_datetime(base: date, dias: int, hora: int = 9, minuto: int = 0) -> str:
    """Instante ISO 8601 (fecha + hora) relativo a la fecha base."""
    d = base + timedelta(days=dias)
    return datetime(d.year, d.month, d.day, hora, minuto).isoformat()


def _dist2(a: dict, b: dict) -> float:
    """Distancia euclídea al cuadrado entre dos puntos lat/lng.

    Solo se usa para ORDENAR barrios por cercanía al brote; no es geodésica
    real, basta para repartir más casos cerca del hospital.
    """
    return (float(a["lat"]) - float(b["lat"])) ** 2 + (
        float(a["lng"]) - float(b["lng"])
    ) ** 2


# --------------------------------------------------------------------------- #
# Generación de ítems (determinista por semilla; sin tocar AWS)
# --------------------------------------------------------------------------- #
def generar_items(semilla: int, fecha_base: date, catalogo: dict | None = None) -> dict[str, list[dict[str, Any]]]:
    """Construye todos los ítems para las 6 tablas.

    Es una función PURA: no habla con AWS. Dada la misma semilla, fecha base y
    catálogo, devuelve exactamente los mismos ítems (idempotencia + tests).

    Returns:
        Diccionario {clave_tabla: lista_de_items}.
    """
    if catalogo is None:
        catalogo = cargar_catalogo()

    rng = random.Random(semilla)

    barrios = catalogo["barrios"]
    edificios = catalogo["edificios"]
    ids_barrio = {b["id"] for b in barrios}
    barrios_por_id = {b["id"]: b for b in barrios}
    edificios_por_barrio: dict[str, list[dict]] = {}
    for e in edificios:
        edificios_por_barrio.setdefault(e["barrio_id"], []).append(e)

    # El brote nace donde está el hospital.
    hospital = next((e for e in edificios if e["tipo"] == "hospital"), None)
    if hospital is None:
        raise ValueError("El catálogo no tiene hospital; no se puede ubicar el brote.")
    barrio_hospital = barrios_por_id[hospital["barrio_id"]]

    # Barrios ordenados por cercanía al barrio del hospital (más casos cerca).
    barrios_ordenados = sorted(barrios, key=lambda b: _dist2(barrios_por_id[b["id"]], barrio_hospital))

    items: dict[str, list[dict[str, Any]]] = {k: [] for k in TABLAS}

    # ---------------- plaga-casos (~120) ----------------
    n_casos = 120
    # Pesos decrecientes: el barrio más cercano (el del hospital) pesa más.
    n = len(barrios_ordenados)
    pesos = [float(n - i) for i in range(n)]  # n, n-1, ..., 1
    total_peso = sum(pesos)
    # Reparto proporcional de casos por barrio (al menos 1 por barrio).
    reparto = [max(1, round(n_casos * p / total_peso)) for p in pesos]

    contador = 0
    for barrio, cuantos in zip(barrios_ordenados, reparto):
        edifs = edificios_por_barrio.get(barrio["id"], [])
        for _ in range(cuantos):
            if contador >= n_casos:
                break
            contador += 1
            caso_id = f"caso_{contador:04d}"
            estado = rng.choice(_ESTADOS_CASO)

            # Día de síntomas relativo al inicio del brote (0..6).
            dia_sintoma = rng.randint(0, 6)
            fecha_registro = _iso_datetime(fecha_base, dia_sintoma, 8, rng.randint(0, 59))

            # fecha_sintomas NUNCA vacía: si está incubando, usa la de registro.
            if estado == "incubando":
                fecha_sintomas = fecha_registro
            else:
                fecha_sintomas = _iso_fecha(fecha_base, dia_sintoma)

            # lugar_id: un edificio del mismo barrio cuando exista; si no, "".
            # (Para evitar claves vacías, dejamos lugar_id ausente si no hay edificio.)
            item = {
                "caso_id": caso_id,
                "estado": estado,
                "barrio_id": barrio["id"],
                "fecha_sintomas": fecha_sintomas,
                "cura_aplicada": "cura_01" if estado == "curado" else "ninguna",
                "registrado_por": AUTOR,
                "actualizado_en": fecha_registro,
                "simulado": True,
            }
            if edifs:
                item["lugar_id"] = rng.choice(edifs)["id"]
            items["casos"].append(item)

    # ---------------- plaga-curas (3) ----------------
    items["curas"] = [
        {
            "cura_id": "cura_01",
            "nombre": "Suero Base",
            "eficacia": Decimal("0.90"),
            "mejora_a": "curado",
            "efectos_secundarios": "leves: fatiga",
            "estado": "aprobada",
            "creada_por": AUTOR,
            "creado_en": _iso_datetime(fecha_base, 0),
            "simulado": True,
        },
        {
            "cura_id": "cura_02",
            "nombre": "Antiviral Variante",
            "eficacia": Decimal("0.45"),
            "mejora_a": "portador",
            "efectos_secundarios": "moderados: nausea, mareo",
            "estado": "en_pruebas",
            "creada_por": AUTOR,
            "creado_en": _iso_datetime(fecha_base, 1),
            "simulado": True,
        },
        {
            "cura_id": "cura_03",
            "nombre": "Compuesto Experimental",
            "eficacia": Decimal("0.20"),
            "mejora_a": "incubando",
            "efectos_secundarios": "desconocidos",
            "estado": "en_pruebas",
            "creada_por": AUTOR,
            "creado_en": _iso_datetime(fecha_base, 2),
            "simulado": True,
        },
    ]

    # ---------------- plaga-sintomas (3 por fase = 7 nombres en 3 fases) ----
    # El enunciado define 3 fases; registramos un ítem por síntoma con su fase.
    sintomas_def = [
        ("sintoma_01", "Escalofríos", "fase_0_1", "dia 0-1"),
        ("sintoma_02", "Fiebre alta", "fase_2_3", "dia 2-3"),
        ("sintoma_03", "Temblores", "fase_2_3", "dia 2-3"),
        ("sintoma_04", "Llagas", "fase_4_5", "dia 4-5"),
        ("sintoma_05", "Piel amarilla", "fase_4_5", "dia 4-5"),
        ("sintoma_06", "Vómito de sangre", "fase_4_5", "dia 4-5"),
    ]
    for sid, nombre, fase, desc in sintomas_def:
        items["sintomas"].append(
            {
                "sintoma_id": sid,
                "nombre": nombre,
                "descripcion": f"Síntoma ficticio ({desc}).",
                "fase": fase,
                "registrado_por": AUTOR,
                "creado_en": _iso_datetime(fecha_base, 0),
                "simulado": True,
            }
        )

    # ---------------- plaga-inventario (3 curas x 3 centros) ----------------
    for cura in items["curas"]:
        for c in range(1, 4):
            centro_id = f"centro_{c:02d}"
            items["inventario"].append(
                {
                    "cura_id": cura["cura_id"],
                    "centro_id": centro_id,
                    "cantidad": int(rng.randint(10, 500)),
                    "actualizado_por": AUTOR,
                    "actualizado_en": _iso_datetime(fecha_base, 0),
                    "simulado": True,
                }
            )

    # ---------------- plaga-fumigaciones (8-10) ----------------
    n_fum = rng.randint(8, 10)
    edifs_barajados = list(edificios)
    rng.shuffle(edifs_barajados)
    for i in range(n_fum):
        edif = edifs_barajados[i % len(edifs_barajados)]
        estado = rng.choice(["programada", "hecha"])
        dia = rng.randint(0, 6)
        items["fumigaciones"].append(
            {
                "fumigacion_id": f"fum_{i + 1:04d}",
                "edificio_id": edif["id"],
                "barrio_id": edif["barrio_id"],
                "estado": estado,
                "fecha": _iso_fecha(fecha_base, dia),
                "registrado_por": AUTOR,
                "simulado": True,
            }
        )

    # ---------------- plaga-noticias (4) ----------------
    noticias_def = [
        (0, 9, 0, "Brote detectado cerca del hospital", "baja", "Autoridades reportan casos aislados."),
        (1, 12, 0, "Aumentan los contagios", "media", "Se activan protocolos de vigilancia."),
        (3, 18, 30, "Variante en estudio", "alta", "Laboratorio analiza una cura en pruebas."),
        (5, 8, 15, "Cierres y fumigaciones", "critica", "Se cierran mercados y buses más concurridos."),
    ]
    for dia, h, m, titulo, severidad, cuerpo in noticias_def:
        items["noticias"].append(
            {
                "canal": "general",
                "publicado_en": _iso_datetime(fecha_base, dia, h, m),
                "titulo": titulo,
                "cuerpo": cuerpo,
                "severidad": severidad,
                "autor": AUTOR,
                "simulado": True,
            }
        )

    # Validación defensiva: ninguna clave string vacía en claves importantes.
    _validar_claves_no_vacias(items)
    return items


def _validar_claves_no_vacias(items: dict[str, list[dict]]) -> None:
    """Falla ruidosamente si algún ítem tiene una clave crítica vacía."""
    for caso in items["casos"]:
        if not caso["fecha_sintomas"]:
            raise ValueError(f"Caso {caso['caso_id']} con fecha_sintomas vacía.")
        if not caso["barrio_id"]:
            raise ValueError(f"Caso {caso['caso_id']} con barrio_id vacío.")
    for fum in items["fumigaciones"]:
        if not fum["barrio_id"] or not fum["fecha"]:
            raise ValueError(f"Fumigación {fum['fumigacion_id']} con clave vacía.")
    for n in items["noticias"]:
        if not n["canal"] or not n["publicado_en"]:
            raise ValueError("Noticia con canal/publicado_en vacío.")


# --------------------------------------------------------------------------- #
# Reporte (dry-run) y escritura (AWS)
# --------------------------------------------------------------------------- #
def reportar(items: dict[str, list[dict]]) -> None:
    """Imprime, por tabla, cuántos ítems se escribirían y 2 ejemplos."""
    print("MODO SIMULACIÓN (dry-run): no se tocó AWS. Usa --aplicar para escribir.\n")
    for clave, nombre in TABLAS.items():
        lista = items[clave]
        print(f"[{nombre}] escribiría {len(lista)} ítems. Ejemplos:")
        for ejemplo in lista[:2]:
            print(f"    {ejemplo}")
        print()


def escribir(items: dict[str, list[dict]]) -> None:
    """Escribe los ítems en DynamoDB usando batch_writer (idempotente por PK/SK).

    Importa boto3 aquí dentro para que el modo simulación y los tests funcionen
    sin tener boto3 ni credenciales.
    """
    try:
        import boto3
        from botocore.exceptions import (
            NoCredentialsError,
            PartialCredentialsError,
            ClientError,
        )
    except ImportError:
        raise SystemExit(
            "Falta boto3. Instálalo con: pip install boto3 (o agrega requirements.txt)."
        )

    dynamo = boto3.resource("dynamodb", region_name=REGION)

    for clave, nombre in TABLAS.items():
        lista = items[clave]
        try:
            tabla = dynamo.Table(nombre)
            with tabla.batch_writer() as bw:
                for it in lista:
                    bw.put_item(Item=it)
            print(f"[{nombre}] {len(lista)} ítems escritos.")
        except NoCredentialsError:
            raise SystemExit(
                "No se encontraron credenciales de AWS. Configura 'aws configure' "
                "o variables de entorno. (No se muestran secretos.)"
            )
        except PartialCredentialsError:
            raise SystemExit(
                "Credenciales de AWS incompletas. Revisa tu configuración."
            )
        except ClientError as err:
            codigo = err.response.get("Error", {}).get("Code", "Desconocido")
            if codigo == "ResourceNotFoundException":
                raise SystemExit(
                    f"La tabla '{nombre}' no existe en {REGION}. El script NO crea "
                    "tablas; créala antes de cargar datos."
                )
            if codigo in ("AccessDeniedException", "UnauthorizedOperation"):
                raise SystemExit(
                    f"Acceso denegado al escribir en '{nombre}'. Revisa los permisos "
                    "IAM. (No se muestran secretos.)"
                )
            raise SystemExit(f"Error de AWS al escribir en '{nombre}': {codigo}.")


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="cargar_datos",
        description="Carga datos FICTICIOS en las tablas DynamoDB de la Plaga Caracol.",
    )
    p.add_argument("--aplicar", action="store_true", help="escribe de verdad en AWS (si no, dry-run)")
    p.add_argument("--semilla", type=int, default=42, help="semilla del azar (reproducibilidad)")
    p.add_argument("--fecha-base", type=str, default="2026-10-26", help="fecha base ISO (YYYY-MM-DD)")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        fecha_base = date.fromisoformat(args.fecha_base)
    except ValueError:
        raise SystemExit(f"--fecha-base inválida: {args.fecha_base!r} (usa YYYY-MM-DD).")

    items = generar_items(args.semilla, fecha_base)

    if args.aplicar:
        escribir(items)
        print("\nCarga completada.")
    else:
        reportar(items)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
