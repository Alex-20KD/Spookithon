"""Red de contactos como pares (persona, lugar) en arrays planos de numpy.

La red es "bipartita": nodos-persona conectados a nodos-lugar. Cada pertenencia
de una persona a un lugar es una arista. Todo se guarda en arrays planos para
poder vectorizar el contagio sin bucles por persona.

Tipos de lugar: hogar, colegio, bus, mercado, hospital, barrio.

Fuentes de las proporciones (todas supuesto de diseño, escenario ficticio):
  - hogares de 2 a 6 personas,
  - 25% de la población asiste a uno de los 8 colegios,
  - 45% usa uno de 25 buses,
  - 35% visita el único mercado,
  - 60 trabajadores del hospital (marcados como personal).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .catalogo import cargar_catalogo

TIPOS_LUGAR = ("hogar", "colegio", "bus", "mercado", "hospital", "barrio")

# Parámetros estructurales de la red (supuesto de diseño).
_HOGAR_MIN = 2
_HOGAR_MAX = 6
_FRAC_COLEGIO = 0.25
_FRAC_BUS = 0.45
_FRAC_MERCADO = 0.35
_N_BUSES = 25
_TRABAJADORES_HOSPITAL = 60


@dataclass
class Red:
    """Red de contactos lista para la simulación.

    Attributes:
        n_personas: número total de personas.
        n_lugares: número total de lugares.
        persona: array de aristas; ``persona[k]`` es la persona de la arista k.
        lugar: array de aristas; ``lugar[k]`` es el lugar de la arista k.
        tipo_lugar: array de longitud ``n_lugares`` con el índice de tipo
            (según ``TIPOS_LUGAR``) de cada lugar.
        barrio_persona: barrio (índice de lugar tipo barrio) de cada persona.
        personal_hospital: máscara booleana de personas que son personal del hospital.
        ids_lugar: id textual de cada lugar (barrio/edificio del catálogo o
            etiqueta generada como "bus00", "hogar000").
        centralidad: grado ponderado por persona (ver :func:`construir_red`).
    """

    n_personas: int
    n_lugares: int
    persona: np.ndarray
    lugar: np.ndarray
    tipo_lugar: np.ndarray
    barrio_persona: np.ndarray
    personal_hospital: np.ndarray
    ids_lugar: list[str]
    centralidad: np.ndarray
    # Barrios en orden del catálogo: id textual y su índice de lugar asociado.
    # Permiten agregar métricas por barrio (p. ej. infectados por barrio) y
    # traducir el índice de lugar-barrio a su id textual del catálogo.
    barrios_ids: list[str] = field(default_factory=list)
    barrios_lugar_idx: np.ndarray = field(
        default_factory=lambda: np.empty(0, dtype=np.int64)
    )
    # Vecinos geográficos de cada barrio (índices de posición), para movilidad.
    barrios_vecinos: list[list[int]] = field(default_factory=list)

    # --- Consultas útiles ---

    def miembros(self, lugar: int) -> np.ndarray:
        """Devuelve las personas que pertenecen a un ``lugar`` dado."""
        return self.persona[self.lugar == lugar]

    def lugares_de_tipo(self, tipo: str) -> np.ndarray:
        """Devuelve los índices de lugar de un ``tipo`` dado."""
        idx_tipo = TIPOS_LUGAR.index(tipo)
        return np.where(self.tipo_lugar == idx_tipo)[0]

    def tamano_lugar(self) -> np.ndarray:
        """Número de miembros de cada lugar (array de longitud ``n_lugares``)."""
        return np.bincount(self.lugar, minlength=self.n_lugares)


def construir_red(poblacion: int, semilla: int, catalogo: dict | None = None) -> Red:
    """Construye la red de contactos de forma reproducible.

    Usa un generador numpy sembrado para que, a igual semilla y población, la
    red sea idéntica. La centralidad de cada persona es la suma, sobre sus
    lugares, del tamaño esperado del lugar multiplicado por la asistencia de su
    tipo; aproxima cuántos contactos esperados tiene al día.

    Args:
        poblacion: número de personas a generar.
        semilla: semilla del generador (reproducibilidad).
        catalogo: catálogo ya cargado; si es ``None`` se carga el por defecto.

    Returns:
        Una instancia de :class:`Red`.
    """
    if catalogo is None:
        catalogo = cargar_catalogo()

    rng = np.random.default_rng(semilla)

    barrios = catalogo["barrios"]
    edificios = catalogo["edificios"]
    colegios = [e for e in edificios if e["tipo"] == "colegio"]
    mercados = [e for e in edificios if e["tipo"] == "mercado"]
    hospitales = [e for e in edificios if e["tipo"] == "hospital"]

    # --- Asignación de índices de lugar ---
    # Orden: barrios, colegios, buses, mercado, hospital, hogares.
    ids_lugar: list[str] = []
    tipos: list[int] = []

    def _agregar(id_txt: str, tipo: str) -> int:
        idx = len(ids_lugar)
        ids_lugar.append(id_txt)
        tipos.append(TIPOS_LUGAR.index(tipo))
        return idx

    idx_barrio = {b["id"]: _agregar(b["id"], "barrio") for b in barrios}
    idx_colegios = [_agregar(c["id"], "colegio") for c in colegios]
    idx_buses = [_agregar(f"bus{i:02d}", "bus") for i in range(_N_BUSES)]
    idx_mercado = [_agregar(m["id"], "mercado") for m in mercados]
    idx_hospital = [_agregar(h["id"], "hospital") for h in hospitales]

    # --- Hogares: particionar la población en hogares de 2..6 personas ---
    # Generamos tamaños hasta cubrir la población (el último se recorta).
    tamanos: list[int] = []
    acumulado = 0
    while acumulado < poblacion:
        t = int(rng.integers(_HOGAR_MIN, _HOGAR_MAX + 1))
        t = min(t, poblacion - acumulado)
        tamanos.append(t)
        acumulado += t

    n_hogares = len(tamanos)
    idx_hogares = [_agregar(f"hogar{i:04d}", "hogar") for i in range(n_hogares)]

    # Barrio de cada hogar (al azar) -> define el barrio de sus miembros.
    lista_idx_barrio = [idx_barrio[b["id"]] for b in barrios]
    barrio_de_hogar = rng.choice(lista_idx_barrio, size=n_hogares)

    # --- Aristas persona-lugar ---
    aristas_persona: list[np.ndarray] = []
    aristas_lugar: list[np.ndarray] = []

    barrio_persona = np.empty(poblacion, dtype=np.int64)

    # Hogar + barrio por persona (una arista a cada uno).
    persona_actual = 0
    for h, t in enumerate(tamanos):
        pers = np.arange(persona_actual, persona_actual + t)
        # arista al hogar
        aristas_persona.append(pers)
        aristas_lugar.append(np.full(t, idx_hogares[h]))
        # arista al barrio
        aristas_persona.append(pers)
        aristas_lugar.append(np.full(t, barrio_de_hogar[h]))
        barrio_persona[pers] = barrio_de_hogar[h]
        persona_actual += t

    todas = np.arange(poblacion)

    def _subconjunto(fraccion: float) -> np.ndarray:
        """Elige una fracción de la población, sin repetición."""
        n = int(round(fraccion * poblacion))
        return rng.choice(todas, size=n, replace=False)

    # Colegios: 25% repartido entre los 8 colegios.
    en_colegio = _subconjunto(_FRAC_COLEGIO)
    asign_colegio = rng.choice(idx_colegios, size=en_colegio.size)
    aristas_persona.append(en_colegio)
    aristas_lugar.append(asign_colegio)

    # Buses: 45% repartido entre 25 buses.
    en_bus = _subconjunto(_FRAC_BUS)
    asign_bus = rng.choice(idx_buses, size=en_bus.size)
    aristas_persona.append(en_bus)
    aristas_lugar.append(asign_bus)

    # Mercado: 35% al único mercado.
    personal_hospital = np.zeros(poblacion, dtype=bool)
    if idx_mercado:
        en_mercado = _subconjunto(_FRAC_MERCADO)
        aristas_persona.append(en_mercado)
        aristas_lugar.append(np.full(en_mercado.size, idx_mercado[0]))

    # Hospital: 60 trabajadores (marcados como personal).
    if idx_hospital:
        n_trab = min(_TRABAJADORES_HOSPITAL, poblacion)
        trabajadores = rng.choice(todas, size=n_trab, replace=False)
        aristas_persona.append(trabajadores)
        aristas_lugar.append(np.full(trabajadores.size, idx_hospital[0]))
        personal_hospital[trabajadores] = True

    persona = np.concatenate(aristas_persona).astype(np.int64)
    lugar = np.concatenate(aristas_lugar).astype(np.int64)
    tipo_lugar = np.array(tipos, dtype=np.int64)
    n_lugares = len(ids_lugar)

    # --- Centralidad (grado ponderado) ---
    # Para cada arista, "peso" = tamaño esperado del lugar * asistencia del tipo.
    # Tamaño del lugar = nº de miembros; asistencia según tabla por defecto.
    from .params import _asistencia_por_defecto

    asistencia = _asistencia_por_defecto()
    tamano = np.bincount(lugar, minlength=n_lugares).astype(np.float64)
    asist_por_tipo = np.array([asistencia[t] for t in TIPOS_LUGAR])
    asist_lugar = asist_por_tipo[tipo_lugar]
    peso_arista = tamano[lugar] * asist_lugar[lugar]
    centralidad = np.bincount(persona, weights=peso_arista, minlength=poblacion)

    # Orden canónico de barrios (el del catálogo) y sus índices de lugar.
    barrios_ids = [b["id"] for b in barrios]
    barrios_lugar_idx = np.array(
        [idx_barrio[bid] for bid in barrios_ids], dtype=np.int64
    )

    # Vecinos geográficos (3 más cercanos por distancia euclidiana en lat/lng).
    n_barrios = len(barrios)
    vecinos: list[list[int]] = [[] for _ in range(n_barrios)]
    for i in range(n_barrios):
        dists = []
        for j in range(n_barrios):
            if i == j:
                continue
            d = (barrios[i]["lat"] - barrios[j]["lat"]) ** 2 + (barrios[i]["lng"] - barrios[j]["lng"]) ** 2
            dists.append((d, j))
        dists.sort()
        vecinos[i] = [j for _, j in dists[:3]]

    return Red(
        n_personas=poblacion,
        n_lugares=n_lugares,
        persona=persona,
        lugar=lugar,
        tipo_lugar=tipo_lugar,
        barrio_persona=barrio_persona,
        personal_hospital=personal_hospital,
        ids_lugar=ids_lugar,
        centralidad=centralidad,
        barrios_ids=barrios_ids,
        barrios_lugar_idx=barrios_lugar_idx,
        barrios_vecinos=vecinos,
    )
