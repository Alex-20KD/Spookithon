"""Modelo de simulación de la "Plaga Caracol" (ficticio).

Estados (enteros para vectorizar):
    SANO, INCUBANDO, PORTADOR, ZOMBI, INMUNE.

Mantiene dos vistas del mundo:
    - estado REAL (``self.estado``): la verdad de la simulación,
    - estado CONOCIDO (``self.conocido``): lo que el sistema de vigilancia sabe;
      es lo único que pueden mirar las estrategias.

Dos RNG independientes derivados de la semilla: uno para la epidemia y otro para
la estrategia, de modo que decisiones y dinámica no se "pisen" entre sí y las
estrategias queden sincronizadas con la misma semilla.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .params import Params
from .red import Red, TIPOS_LUGAR

# --- Estados ---
SANO = 0
INCUBANDO = 1
PORTADOR = 2
ZOMBI = 3
INMUNE = 4

N_ESTADOS = 5
NOMBRES_ESTADO = ["SANO", "INCUBANDO", "PORTADOR", "ZOMBI", "INMUNE"]


@dataclass
class Resultado:
    """Resultado agregado de una corrida.

    Attributes:
        infectados_totales: personas alguna vez infectadas (incubando/portador/zombi).
        curva: array (dias+1, N_ESTADOS) con conteos por estado por día (incluye día 0).
        dosis_usadas: total de dosis aplicadas (incluye desperdiciadas).
        dias_cierre: suma acumulada de lugares-cerrados por día.
        infectados_por_barrio: nº de personas alguna vez infectadas por barrio,
            en el orden canónico ``red.barrios_ids`` (longitud = nº de barrios).
            Se deriva del estado final sin consumir aleatoriedad: no altera
            ningún otro resultado de la corrida.
    """

    infectados_totales: int
    curva: np.ndarray
    dosis_usadas: int
    dias_cierre: int
    infectados_por_barrio: np.ndarray
    # Trayectoria diaria (solo si registrar_trayectoria=True). Lista de dicts
    # con conteos globales y por barrio por día. None si no se registró.
    trayectoria: list | None = None


class Simulacion:
    """Una corrida de la epidemia con una estrategia dada."""

    def __init__(
        self,
        params: Params,
        red: Red,
        estrategia,
        semilla: int | None = None,
        atribuir: bool = False,
        registrar_trayectoria: bool = False,
        eventos: list | None = None,
        intervenciones: list | None = None,
    ):
        self.params = params
        self.red = red
        self.estrategia = estrategia
        self.intervenciones = list(intervenciones or [])
        # Atribución fraccional de infector (para medir R0). Apagada por
        # defecto: cuando está apagada, el modelo produce EXACTAMENTE los mismos
        # resultados que antes porque no se consumen números aleatorios nuevos
        # ni se altera ninguna decisión.
        self.atribuir = atribuir
        self.registrar_trayectoria = registrar_trayectoria
        self.eventos = sorted(list(eventos or []), key=lambda e: int(e.get("dia", 0)))
        self._eventos_por_dia: dict[int, list[dict]] = {}
        for ev in self.eventos:
            self._eventos_por_dia.setdefault(int(ev.get("dia", 0)), []).append(ev)
        self.trayectoria: list | None = [] if registrar_trayectoria else None
        # infecciones_causadas[j] = nº (fraccional) de infecciones directas que
        # causó la persona j. Solo se llena si atribuir=True.
        self.infecciones_causadas = np.zeros(red.n_personas, dtype=np.float64)

        base = params.semilla if semilla is None else semilla
        # Dos streams independientes derivados de la misma semilla base.
        ss = np.random.SeedSequence(base)
        hijo_epidemia, hijo_estrategia = ss.spawn(2)
        self.rng = np.random.default_rng(hijo_epidemia)  # epidemia
        self.rng_estrategia = np.random.default_rng(hijo_estrategia)  # estrategia

        n = red.n_personas
        self.estado = np.full(n, SANO, dtype=np.int8)
        self.conocido = np.full(n, SANO, dtype=np.int8)  # lo que ve la estrategia
        self.vacunado = np.zeros(n, dtype=bool)
        self.fue_infectado = np.zeros(n, dtype=bool)
        self.variante = np.zeros(n, dtype=np.int8)  # 0 normal,1 acechador,2 chasqueador,3 gordinflón

        # Día de infección y tiempo de conversión (incubando -> zombi).
        self.dia_infeccion = np.full(n, -1, dtype=np.int32)
        self.tiempo_conversion = np.zeros(n, dtype=np.int32)

        # Lugares cerrados (máscara booleana por lugar).
        self.cerrado = np.zeros(red.n_lugares, dtype=bool)

        # Precálculos por tipo de lugar.
        self._peso_lugar_tipo = np.array(
            [params.peso_lugar[t] for t in TIPOS_LUGAR], dtype=np.float64
        )
        self._asist_tipo = np.array(
            [params.asistencia[t] for t in TIPOS_LUGAR], dtype=np.float64
        )
        self._idx_hospital = TIPOS_LUGAR.index("hospital")

        # Contadores de salida.
        self.dosis_usadas = 0
        self.dias_cierre = 0
        self.curva = np.zeros((params.dias + 1, N_ESTADOS), dtype=np.int64)

        # Mapeo persona -> posición de barrio (para conteos espaciales).
        n_barrios = len(red.barrios_ids)
        self._n_barrios = n_barrios
        self._pos_barrio = np.zeros(red.n_personas, dtype=np.int64)
        self._lugares_contagio_hoy: list[int] = []
        for pos, lugar_idx in enumerate(red.barrios_lugar_idx):
            self._pos_barrio[red.barrio_persona == lugar_idx] = pos
        self.poblacion_por_barrio = np.bincount(self._pos_barrio, minlength=n_barrios)
        self._ids_barrio = list(red.barrios_ids)
        self._dosis_prev = 0
        self._barrios_con_contagio: set[str] = set()
        self._primer_dia_barrio: dict[str, int] = {}
        self._movimientos_hoy: list[dict] = []
        self._zombie_corredor_activo = False
        self._fallo_contencion_activo = False
        self._bloqueo_activo = False
        self._vigilancia_intensiva_activa = False
        self._evacuacion_activa = False
        self._aislamiento_focalizado_activo = False
        self._refuerzo_contencion_activo = False
        self._control_esporas_activo = False
        self._acechador_activo = False
        self._chasqueador_activo = False
        self._gordinflon_activo = False
        self._gordinflon_barrio = None
        self._horda_activa = False

        self._sembrar()

    # ------------------------------------------------------------------ #
    # Siembra
    # ------------------------------------------------------------------ #
    def _sembrar(self) -> None:
        """Coloca el paciente cero y ``casos_extra`` en el lugar de inicio."""
        tipo = self.params.lugar_inicio
        lugares = self.red.lugares_de_tipo(tipo)
        if lugares.size == 0:
            raise ValueError(f"No hay lugares de tipo '{tipo}' para sembrar.")

        # Elige un lugar de inicio y toma personas de ahí.
        lugar0 = int(self.rng.choice(lugares))
        candidatos = self.red.miembros(lugar0)
        n_sembrar = 1 + self.params.casos_extra
        if candidatos.size < n_sembrar:
            # Completa con personas al azar de toda la población.
            extra = self.rng.choice(
                np.arange(self.red.n_personas),
                size=n_sembrar - candidatos.size,
                replace=False,
            )
            sembrados = np.concatenate([candidatos, extra])
        else:
            sembrados = self.rng.choice(candidatos, size=n_sembrar, replace=False)

        self._infectar(sembrados, dia=0)
        # Registrar lugar de contagio para el brote inicial.
        self._lugares_contagio_hoy = []
        for persona in np.asarray(sembrados, dtype=np.int64).ravel():
            pos = int(self._pos_barrio[persona])
            if pos < len(self.red.barrios_lugar_idx):
                self._lugares_contagio_hoy.append(int(self.red.barrios_lugar_idx[pos]))
        if self.registrar_trayectoria:
            self._registrar_trayectoria(0, np.asarray(sembrados, dtype=np.int64))
        self._registrar_curva(0)

    def _aplicar_evento(self, ev: dict, dia: int) -> None:
        tipo = ev.get("tipo")
        if tipo == "brote_secundario":
            barrio_id = ev.get("barrio_id")
            n = int(ev.get("intensidad", 1))
            if barrio_id in self._ids_barrio:
                pos = self._ids_barrio.index(barrio_id)
                candidatos = np.where((self._pos_barrio == pos) & (self.estado == SANO))[0]
                if candidatos.size > 0:
                    elegidos = self.rng.choice(candidatos, size=min(n, candidatos.size), replace=False)
                    self._infectar(elegidos, dia)
        elif tipo == "zombie_corredor":
            self._zombie_corredor_activo = True
            self._zombie_corredor_fin = dia + int(ev.get("duracion", 5))
        elif tipo == "fallo_contencion":
            self._fallo_contencion_activo = True
            self._fallo_contencion_fin = dia + int(ev.get("duracion", 5))
        elif tipo == "horda_migratoria":
            self._spawn_variantes(ev, dia, variante=0, cantidad=int(ev.get("intensidad", 5)))
            self._horda_activa = True
            self._horda_fin = dia + int(ev.get("duracion", 5))
        elif tipo == "aparicion_acechador":
            self._spawn_variantes(ev, dia, variante=1, cantidad=int(ev.get("intensidad", 3)))
            self._acechador_activo = True
            self._acechador_fin = dia + int(ev.get("duracion", 7))
        elif tipo == "aparicion_chasqueador":
            self._spawn_variantes(ev, dia, variante=2, cantidad=int(ev.get("intensidad", 3)))
            self._chasqueador_activo = True
            self._chasqueador_fin = dia + int(ev.get("duracion", 7))
        elif tipo == "aparicion_gordinflon":
            self._spawn_variantes(ev, dia, variante=3, cantidad=int(ev.get("intensidad", 2)))
            self._gordinflon_activo = True
            self._gordinflon_fin = dia + int(ev.get("duracion", 7))
            self._gordinflon_barrio = ev.get("barrio_id")

    def _spawn_variantes(self, ev: dict, dia: int, variante: int, cantidad: int) -> None:
        """Convierte personas sanas/incubando/portadoras en zombis de una variante."""
        barrio_id = ev.get("barrio_id")
        if barrio_id not in self._ids_barrio:
            return
        pos = self._ids_barrio.index(barrio_id)
        candidatos = np.where(
            (self._pos_barrio == pos)
            & (self.estado != ZOMBI)
            & (self.estado != INMUNE)
        )[0]
        if candidatos.size == 0:
            candidatos = np.where((self.estado != ZOMBI) & (self.estado != INMUNE))[0]
        if candidatos.size == 0:
            return
        elegidos = self.rng.choice(candidatos, size=min(cantidad, candidatos.size), replace=False)
        self.estado[elegidos] = ZOMBI
        self.fue_infectado[elegidos] = True
        self.dia_infeccion[elegidos] = dia
        self.tiempo_conversion[elegidos] = 0
        self.variante[elegidos] = variante

    def _infectar(self, personas: np.ndarray, dia: int) -> None:
        """Marca a ``personas`` como INCUBANDO y les asigna su tiempo de conversión."""
        if personas.size == 0:
            return
        self.estado[personas] = INCUBANDO
        self.fue_infectado[personas] = True
        self.dia_infeccion[personas] = dia
        # Tiempo de conversión aleatorio en [incub_min, incub_max].
        self.tiempo_conversion[personas] = self.rng.integers(
            self.params.incub_min, self.params.incub_max + 1, size=personas.size
        )

    def _registrar_trayectoria(self, dia: int, nuevos: np.ndarray) -> None:
        if not self.registrar_trayectoria or self.trayectoria is None:
            return
        red = self.red
        estado = self.estado
        nuevos = np.asarray(nuevos, dtype=np.int64).ravel()

        # Conteos globales por estado.
        conteo_global = np.bincount(estado, minlength=N_ESTADOS)
        nombres = NOMBRES_ESTADO
        global_dict = {nombres[i]: int(conteo_global[i]) for i in range(N_ESTADOS)}
        global_dict["nuevos_contagios"] = int(nuevos.size)
        dosis_hoy = int(self.dosis_usadas - self._dosis_prev)
        global_dict["dosis_dia"] = dosis_hoy
        global_dict["lugares_cerrados"] = int(self.cerrado.sum())
        global_dict["variantes"] = {
            "normal": int(((self.estado == ZOMBI) & (self.variante == 0)).sum()),
            "acechador": int(((self.estado == ZOMBI) & (self.variante == 1)).sum()),
            "chasqueador": int(((self.estado == ZOMBI) & (self.variante == 2)).sum()),
            "gordinflon": int(((self.estado == ZOMBI) & (self.variante == 3)).sum()),
        }

        # Conteos por barrio.
        pos_nuevos = self._pos_barrio[nuevos] if nuevos.size else np.array([], dtype=np.int64)
        nuevos_por_barrio = np.bincount(pos_nuevos, minlength=self._n_barrios)
        pos_zombis = self._pos_barrio[estado == ZOMBI]
        zombis_por_barrio = np.bincount(pos_zombis, minlength=self._n_barrios)
        pos_infectados = self._pos_barrio[self.fue_infectado]
        acum_por_barrio = np.bincount(pos_infectados, minlength=self._n_barrios)
        pos_inmunes = self._pos_barrio[estado == INMUNE]
        inmunes_por_barrio = np.bincount(pos_inmunes, minlength=self._n_barrios)

        por_barrio = []
        for i, bid in enumerate(self._ids_barrio):
            por_barrio.append({
                "barrio_id": bid,
                "zombis_activos": int(zombis_por_barrio[i]),
                "infectados_acumulados": int(acum_por_barrio[i]),
                "nuevos_contagios": int(nuevos_por_barrio[i]),
                "inmunes": int(inmunes_por_barrio[i]),
            })

        eventos = []
        if dia == 0:
            eventos.append({"dia": 0, "tipo": "escenario", "titulo": "Paciente cero infectado"})
        if dia == self.params.dia_medidas:
            eventos.append({"dia": dia, "tipo": "medidas", "titulo": "Activación del protocolo epidemiológico"})
        if dia == self.params.dia_vacuna:
            eventos.append({"dia": dia, "tipo": "vacuna", "titulo": "Disponibilidad inicial de vacunas"})
        if nuevos.size > 0:
            eventos.append({"dia": dia, "tipo": "contagio", "titulo": "Nuevos contagios", "cantidad": int(nuevos.size)})
        if dosis_hoy > 0:
            eventos.append({"dia": dia, "tipo": "vacunacion", "titulo": "Vacunación", "dosis": dosis_hoy})
        if int(self.cerrado.sum()) > 0:
            eventos.append({"dia": dia, "tipo": "cierre", "titulo": "Cierres aplicados", "lugares": int(self.cerrado.sum())})

        for ev in self._eventos_por_dia.get(dia, []):
            eventos.append({"dia": dia, "tipo": ev.get("tipo", "evento"), "titulo": ev.get("nombre", ev.get("tipo", "evento")), "intensidad": ev.get("intensidad")})

        # Contagios por barrio (ubicación territorial), con todas las variables.
        contagios_por_lugar = []
        for i, pbarrio in enumerate(por_barrio):
            if pbarrio["infectados_acumulados"] <= 0:
                continue
            lugar_idx = int(self.red.barrios_lugar_idx[i]) if i < len(self.red.barrios_lugar_idx) else -1
            coord = self.red.coords_lugar[lugar_idx] if 0 <= lugar_idx < len(self.red.coords_lugar) else (-80.72, -0.95)
            contagios_por_lugar.append({
                "lugar_id": int(lugar_idx),
                "lng": float(coord[0]),
                "lat": float(coord[1]),
                "nuevos": int(pbarrio["nuevos_contagios"]),
                "acumulados": int(pbarrio["infectados_acumulados"]),
                "zombis": int(pbarrio["zombis_activos"]),
            })

        nuevos_focos = []
        for pbarrio in por_barrio:
            bid = pbarrio["barrio_id"]
            if pbarrio["infectados_acumulados"] > 0 and bid not in self._primer_dia_barrio:
                self._primer_dia_barrio[bid] = int(dia)
            pbarrio["primer_dia_infeccion"] = self._primer_dia_barrio.get(bid)
            if pbarrio["infectados_acumulados"] > 0 and bid not in self._barrios_con_contagio:
                self._barrios_con_contagio.add(bid)
                nuevos_focos.append({
                    "dia": int(dia),
                    "barrio_id": bid,
                    "nuevos_contagios": pbarrio["nuevos_contagios"],
                    "infectados_acumulados": pbarrio["infectados_acumulados"],
                    "zombis_activos": pbarrio["zombis_activos"],
                })

        self.trayectoria.append({
            "dia": int(dia),
            "estrategia": self.estrategia.nombre,
            "global": global_dict,
            "por_barrio": por_barrio,
            "movimientos": list(self._movimientos_hoy),
            "nuevos_focos": nuevos_focos,
            "contagios_por_lugar": contagios_por_lugar,
            "eventos": eventos,
        })

    # ------------------------------------------------------------------ #
    # Dinámica diaria
    # ------------------------------------------------------------------ #
    def correr(self) -> Resultado:
        """Ejecuta la simulación completa y devuelve el :class:`Resultado`."""
        for dia in range(1, self.params.dias + 1):
            # Aplicar eventos de brote sorpresa para este día.
            for ev in self._eventos_por_dia.get(dia, []):
                self._aplicar_evento(ev, dia)

            # (a) estrategia y aplicación de medidas
            if dia >= self.params.dia_medidas:
                self._aplicar_estrategia(dia)

            # (b) contagio -> nuevos infectados
            nuevos = self._contagio(dia)

            # (c) progresión de estados
            self._progresion(dia)

            # (d) los recién infectados pasan a INCUBANDO
            self._infectar(nuevos, dia)

            # (e) detección
            if dia >= self.params.dias_detectar:
                self._detectar()

            # (f) registro de la curva
            self._registrar_curva(dia)

            # Desactivar eventos temporales.
            if getattr(self, "_zombie_corredor_activo", False) and dia >= getattr(self, "_zombie_corredor_fin", dia + 1):
                self._zombie_corredor_activo = False
            if getattr(self, "_fallo_contencion_activo", False) and dia >= getattr(self, "_fallo_contencion_fin", dia + 1):
                self._fallo_contencion_activo = False
            if getattr(self, "_acechador_activo", False) and dia >= getattr(self, "_acechador_fin", dia + 1):
                self._acechador_activo = False
            if getattr(self, "_chasqueador_activo", False) and dia >= getattr(self, "_chasqueador_fin", dia + 1):
                self._chasqueador_activo = False
            if getattr(self, "_gordinflon_activo", False) and dia >= getattr(self, "_gordinflon_fin", dia + 1):
                self._gordinflon_activo = False
                self._gordinflon_barrio = None
            if getattr(self, "_horda_activa", False) and dia >= getattr(self, "_horda_fin", dia + 1):
                self._horda_activa = False

            for flag in ("_bloqueo_activo", "_vigilancia_intensiva_activa", "_evacuacion_activa", "_aislamiento_focalizado_activo", "_refuerzo_contencion_activo", "_control_esporas_activo"):
                fin_attr = flag + "_fin"
                if getattr(self, flag, False) and dia >= getattr(self, fin_attr, dia + 1):
                    setattr(self, flag, False)

            if self.registrar_trayectoria:
                self._registrar_trayectoria(dia, nuevos)
                self._dosis_prev = self.dosis_usadas

        infectados_totales = int(self.fue_infectado.sum())
        return Resultado(
            infectados_totales=infectados_totales,
            curva=self.curva,
            dosis_usadas=self.dosis_usadas,
            dias_cierre=self.dias_cierre,
            infectados_por_barrio=self._infectados_por_barrio(),
            trayectoria=self.trayectoria,
        )

    # ------------------------------------------------------------------ #
    # Agregación por barrio (derivada, sin azar)
    # ------------------------------------------------------------------ #
    def _infectados_por_barrio(self) -> np.ndarray:
        """Cuenta personas alguna vez infectadas por barrio (orden del catálogo).

        No consume aleatoriedad ni altera la dinámica: es una lectura del estado
        final (``fue_infectado``) agrupada por el barrio de cada persona.
        """
        red = self.red
        # Conteo de infectados por índice de lugar (solo tendrán valor los
        # índices que sean barrios, el resto queda en 0).
        por_lugar = np.bincount(
            red.barrio_persona,
            weights=self.fue_infectado.astype(np.float64),
            minlength=red.n_lugares,
        )
        # Reordenar al orden canónico de barrios del catálogo.
        return por_lugar[red.barrios_lugar_idx].astype(np.int64)

    # ------------------------------------------------------------------ #
    # (a) Estrategia
    # ------------------------------------------------------------------ #
    def _resolver_estrategia(self, nombre):
        from . import estrategias as _e
        if hasattr(nombre, "decidir"):
            return nombre
        return _e.por_nombre(nombre)

    def _aplicar_estrategia(self, dia: int) -> None:
        activas = [self._resolver_estrategia(self.estrategia)]
        for iv in self.intervenciones:
            d0 = int(iv.get("dia", 0))
            dur = int(iv.get("duracion", 10**9))
            if d0 <= dia <= d0 + dur:
                activas.append(self._resolver_estrategia(iv.get("estrategia")))

        vacunar_list = []
        cerrar_list = []
        for st in activas:
            acciones = st.decidir(self, dia)
            if getattr(acciones, "vacunar", None) is not None and np.asarray(acciones.vacunar).size > 0:
                vacunar_list.append(np.asarray(acciones.vacunar, dtype=np.int64).ravel())
            if getattr(acciones, "cerrar", None) is not None and np.asarray(acciones.cerrar).size > 0:
                cerrar_list.append(np.asarray(acciones.cerrar, dtype=np.int64).ravel())

        if cerrar_list:
            cerrar = np.unique(np.concatenate(cerrar_list))
        else:
            cerrar = np.array([], dtype=np.int64)
        self.cerrado[:] = False
        if cerrar.size > 0:
            cerrar = cerrar[: self.params.max_cierres]
            self.cerrado[cerrar] = True
            self.dias_cierre += int(cerrar.size)

        vacunar = np.unique(np.concatenate(vacunar_list)) if vacunar_list else np.array([], dtype=np.int64)
        if dia >= self.params.dia_vacuna and vacunar.size > 0:
            self._vacunar(vacunar)

    def _vacunar(self, elegidos: np.ndarray) -> None:
        """Aplica dosis a ``elegidos``.

        La dosis se gasta en todos los elegidos válidos (no vacunados), pero solo
        PROTEGE (pasa a INMUNE con prob. eficacia) a quien esté realmente SANO.
        A un infectado aún no detectado se le desperdicia la dosis.

        Para que las estrategias queden sincronizadas con la misma semilla, se
        consumen números aleatorios de tamaño fijo ``dosis_dia`` siempre.
        """
        # Números aleatorios de tamaño fijo (sincronización entre estrategias).
        sorteo = self.rng_estrategia.random(self.params.dosis_dia)

        if elegidos.size == 0:
            return

        # Filtra no vacunados y respeta el tope diario.
        elegidos = elegidos[~self.vacunado[elegidos]]
        elegidos = elegidos[: self.params.dosis_dia]
        if elegidos.size == 0:
            return

        self.vacunado[elegidos] = True
        self.dosis_usadas += int(elegidos.size)

        # Solo protege a los realmente SANOS, con prob. eficacia.
        sanos = elegidos[self.estado[elegidos] == SANO]
        if sanos.size > 0:
            eficacia = self.params.eficacia_vacuna
            if getattr(self, "_fallo_contencion_activo", False) and not getattr(self, "_refuerzo_contencion_activo", False):
                eficacia *= 0.5
            protegidos = sanos[sorteo[: sanos.size] < eficacia]
            self.estado[protegidos] = INMUNE

    # ------------------------------------------------------------------ #
    # (b) Contagio (vectorizado, sin bucles por persona)
    # ------------------------------------------------------------------ #
    def _contagio(self, dia: int) -> np.ndarray:
        """Calcula los SANOS que se infectan hoy y los devuelve.

        Modelo por lugar:
          - cada arista (persona, lugar) está "presente" con prob. = asistencia
            del tipo, y solo si el lugar no está cerrado,
          - carga del lugar = suma de infectividad de los presentes
            (ZOMBI=1.0, PORTADOR=infect_portador, otros=0),
          - lambda_lugar = beta * peso_lugar * carga / sqrt(max(presentes, 1)),
          - prob. de infección de un SANO = 1 - exp(-suma de lambdas de sus
            pertenencias presentes).

        El factor 1/sqrt(presentes) es un SUPUESTO DE DISEÑO (escala la
        frecuencia de contacto entre densidad lineal y de masa-acción).
        """
        persona = self.red.persona
        lugar = self.red.lugar
        n_lugares = self.red.n_lugares

        # Presencia por arista.
        asist_arista = self._asist_tipo[self.red.tipo_lugar[lugar]]
        presente = self.rng.random(persona.size) < asist_arista
        # Lugares cerrados: nadie presente.
        if getattr(self, "_gordinflon_activo", False):
            bloqueo = self.cerrado[lugar] & (self.rng.random(persona.size) < 0.5)
            presente &= ~bloqueo
        else:
            presente &= ~self.cerrado[lugar]
        if getattr(self, "_aislamiento_focalizado_activo", False):
            presente &= self.rng.random(persona.size) < 0.7

        # Personal del hospital protegido en el hospital desde dia_medidas.
        if dia >= self.params.dia_medidas:
            es_hospital = self.red.tipo_lugar[lugar] == self._idx_hospital
            personal = self.red.personal_hospital[persona]
            presente &= ~(es_hospital & personal)

        # Infectividad por persona (según estado real).
        infect_persona = np.zeros(self.red.n_personas, dtype=np.float64)
        infect_persona[self.estado == ZOMBI] = 1.0
        # Chasqueador: mayor riesgo en encuentros cercanos.
        if getattr(self, "_chasqueador_activo", False):
            infect_persona[(self.estado == ZOMBI) & (self.variante == 2)] = 1.5
        factor_portador = self.params.infect_portador
        if getattr(self, "_zombie_corredor_activo", False):
            factor_portador *= 2.0
        infect_persona[self.estado == PORTADOR] = factor_portador

        idx = np.where(presente)[0]
        lug_p = lugar[idx]
        per_p = persona[idx]

        # Presentes por lugar y carga por lugar.
        presentes_lugar = np.bincount(lug_p, minlength=n_lugares).astype(np.float64)
        carga_lugar = np.bincount(
            lug_p, weights=infect_persona[per_p], minlength=n_lugares
        )

        # --- Movilidad zombie (reproducible, agregada) ---
        self._movimientos_hoy = []
        mv = float(self.params.movilidad_zombie)
        if getattr(self, "_acechador_activo", False):
            mv = max(mv, 0.05) * 1.5
        if getattr(self, "_gordinflon_activo", False):
            mv *= 0.5
        if getattr(self, "_bloqueo_activo", False):
            mv *= 0.2
        if mv > 0:
            zombis = np.where(self.estado == ZOMBI)[0]
            if zombis.size > 0:
                mover = self.rng.random(zombis.size) < mv
                zombis_mov = zombis[mover]
                if zombis_mov.size > 0:
                    origenes = self._pos_barrio[zombis_mov]
                    destinos = np.empty(zombis_mov.size, dtype=np.int64)
                    for k, o in enumerate(origenes):
                        vs = self.red.barrios_vecinos[o] if o < len(self.red.barrios_vecinos) else []
                        if vs:
                            destinos[k] = int(self.rng.choice(vs))
                        else:
                            destinos[k] = int(o)
                    pares: dict[tuple[int, int], int] = {}
                    for o, d in zip(origenes.tolist(), destinos.tolist()):
                        if o != d:
                            pares[(o, d)] = pares.get((o, d), 0) + 1
                    ids = self._ids_barrio
                    for (o, d), c in pares.items():
                        self._movimientos_hoy.append({
                            "origen": ids[o],
                            "destino": ids[d],
                            "cantidad": int(c),
                        })
                    for d in set(destinos.tolist()):
                        if d < 0:
                            continue
                        place_idx = int(self.red.barrios_lugar_idx[d])
                        n_mov = int((destinos == d).sum())
                        carga_lugar[place_idx] += float(n_mov) * 1.0

        denom = np.sqrt(np.maximum(presentes_lugar, 1.0))
        peso_lugar = self._peso_lugar_tipo[self.red.tipo_lugar]
        via = getattr(self.params, "via_transmision", "combinada")
        beta_mordida = self.params.beta if via in ("mordidas", "combinada") else 0.0
        beta_espora = getattr(self.params, "beta_espora", self.params.beta) if via in ("esporas", "combinada") else 0.0
        if getattr(self, "_gordinflon_activo", False):
            beta_espora += 0.01
        if getattr(self, "_control_esporas_activo", False):
            beta_espora *= 0.5
        lambda_lugar = (beta_mordida + beta_espora) * peso_lugar * carga_lugar / denom

        # Suma de lambdas por persona (solo aristas presentes).
        lambda_persona = np.bincount(
            per_p, weights=lambda_lugar[lug_p], minlength=self.red.n_personas
        )

        prob_inf = 1.0 - np.exp(-lambda_persona)
        sanos = self.estado == SANO
        sorteo = self.rng.random(self.red.n_personas)
        nuevos = np.where(sanos & (sorteo < prob_inf))[0]

        # Registrar el barrio (lugar territorial) de cada nuevo infectado.
        self._lugares_contagio_hoy = []
        if nuevos.size > 0:
            for persona in nuevos:
                pos = int(self._pos_barrio[persona])
                if pos < len(self.red.barrios_lugar_idx):
                    self._lugares_contagio_hoy.append(int(self.red.barrios_lugar_idx[pos]))

        # Atribución fraccional de infector (opcional, sin azar nuevo).
        if self.atribuir and nuevos.size > 0:
            self._atribuir_infectores(
                nuevos, idx, lug_p, per_p, infect_persona, carga_lugar,
                lambda_lugar, lambda_persona,
            )

        return nuevos

    def _atribuir_infectores(
        self, nuevos, idx, lug_p, per_p, infect_persona, carga_lugar,
        lambda_lugar, lambda_persona,
    ) -> None:
        """Reparte cada infección de forma fraccional entre sus posibles infectores.

        Idea: una persona recién infectada ``s`` recibió una "fuerza de
        infección" ``lambda_persona[s]`` compuesta por el aporte de cada lugar
        donde estuvo presente. Dentro de un lugar, ese aporte se debe a los
        infecciosos presentes, en proporción a su infectividad. Repartimos 1.0
        infección (la de ``s``) entre todos esos infecciosos usando esas
        proporciones. No se usan números aleatorios: es pura aritmética sobre
        cantidades ya calculadas, por eso no altera la dinámica.
        """
        # Trabajamos solo con las aristas (persona presente, lugar) cuya persona
        # es una recién infectada: son las que "reciben" la infección.
        es_nuevo = np.zeros(self.red.n_personas, dtype=bool)
        es_nuevo[nuevos] = True
        mask_rx = es_nuevo[per_p]  # aristas de personas recién infectadas
        if not np.any(mask_rx):
            return

        s_arista = per_p[mask_rx]          # persona recién infectada
        l_arista = lug_p[mask_rx]          # lugar de esa arista

        # Peso de la arista = aporte del lugar a la fuerza total de s:
        #   lambda_lugar[l] / lambda_persona[s]
        lam_s = lambda_persona[s_arista]
        lam_s = np.where(lam_s > 0, lam_s, 1.0)  # evita 0/0 (no debería pasar)
        peso_lugar_para_s = lambda_lugar[l_arista] / lam_s

        # Ahora, dentro de cada lugar, repartimos ese peso entre los infecciosos
        # presentes proporcional a su infectividad / carga_lugar[l].
        # Iteramos sobre las aristas-infecciosas presentes del mismo lugar.
        infect_arista_pres = infect_persona[per_p]  # infectividad por arista presente
        mask_inf = infect_arista_pres > 0           # aristas de infecciosos presentes
        j_arista = per_p[mask_inf]
        lj_arista = lug_p[mask_inf]
        infj = infect_arista_pres[mask_inf]

        # Agrupamos los "receptores" por lugar para combinar con los infecciosos.
        # Para cada lugar l: total_rx_peso[l] = suma de peso_lugar_para_s sobre
        # receptores en l. Cada infeccioso j en l recibe:
        #   total_rx_peso[l] * (infj / carga_lugar[l])
        n_lug = self.red.n_lugares
        total_rx_peso = np.bincount(l_arista, weights=peso_lugar_para_s, minlength=n_lug)
        carga_segura = np.where(carga_lugar > 0, carga_lugar, 1.0)
        aporte_j = total_rx_peso[lj_arista] * (infj / carga_segura[lj_arista])
        np.add.at(self.infecciones_causadas, j_arista, aporte_j)

    # ------------------------------------------------------------------ #
    # (c) Progresión de estados
    # ------------------------------------------------------------------ #
    def _progresion(self, dia: int) -> None:
        """Avanza INCUBANDO -> PORTADOR -> ZOMBI según el tiempo transcurrido."""
        dias_desde = dia - self.dia_infeccion  # válido solo para infectados

        infectando = self.estado == INCUBANDO
        portador = self.estado == PORTADOR

        # INCUBANDO -> ZOMBI al cumplirse su tiempo de conversión.
        a_zombi = (
            (infectando | portador)
            & (dias_desde >= self.tiempo_conversion)
            & (self.dia_infeccion >= 0)
        )
        # INCUBANDO -> PORTADOR desde portador_desde (si aún no es zombi).
        a_portador = (
            infectando
            & (dias_desde >= self.params.portador_desde)
            & (~a_zombi)
            & (self.dia_infeccion >= 0)
        )

        self.estado[a_portador] = PORTADOR
        self.estado[a_zombi] = ZOMBI

    # ------------------------------------------------------------------ #
    # (e) Detección
    # ------------------------------------------------------------------ #
    def _detectar(self) -> None:
        """Marca como conocidos a algunos zombis y portadores (prob. diaria)."""
        p_zombi = self.params.p_det_zombi
        if getattr(self, "_acechador_activo", False):
            p_zombi *= 0.5
        if getattr(self, "_vigilancia_intensiva_activa", False):
            p_zombi = min(1.0, p_zombi * 2.0)
        zombis = np.where(self.estado == ZOMBI)[0]
        if zombis.size > 0:
            sorteo = self.rng.random(zombis.size)
            detectados = zombis[sorteo < p_zombi]
            self.conocido[detectados] = ZOMBI

        portadores = np.where(self.estado == PORTADOR)[0]
        if portadores.size > 0:
            sorteo = self.rng.random(portadores.size)
            detectados = portadores[sorteo < self.params.p_det_portador]
            self.conocido[detectados] = PORTADOR

    # ------------------------------------------------------------------ #
    # (f) Registro
    # ------------------------------------------------------------------ #
    def _registrar_curva(self, dia: int) -> None:
        conteo = np.bincount(self.estado, minlength=N_ESTADOS)
        self.curva[dia] = conteo
