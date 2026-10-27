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
    """

    infectados_totales: int
    curva: np.ndarray
    dosis_usadas: int
    dias_cierre: int


class Simulacion:
    """Una corrida de la epidemia con una estrategia dada."""

    def __init__(
        self,
        params: Params,
        red: Red,
        estrategia,
        semilla: int | None = None,
        atribuir: bool = False,
    ):
        self.params = params
        self.red = red
        self.estrategia = estrategia
        # Atribución fraccional de infector (para medir R0). Apagada por
        # defecto: cuando está apagada, el modelo produce EXACTAMENTE los mismos
        # resultados que antes porque no se consumen números aleatorios nuevos
        # ni se altera ninguna decisión.
        self.atribuir = atribuir
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
        self._registrar_curva(0)

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

    # ------------------------------------------------------------------ #
    # Dinámica diaria
    # ------------------------------------------------------------------ #
    def correr(self) -> Resultado:
        """Ejecuta la simulación completa y devuelve el :class:`Resultado`."""
        for dia in range(1, self.params.dias + 1):
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

        infectados_totales = int(self.fue_infectado.sum())
        return Resultado(
            infectados_totales=infectados_totales,
            curva=self.curva,
            dosis_usadas=self.dosis_usadas,
            dias_cierre=self.dias_cierre,
        )

    # ------------------------------------------------------------------ #
    # (a) Estrategia
    # ------------------------------------------------------------------ #
    def _aplicar_estrategia(self, dia: int) -> None:
        acciones = self.estrategia.decidir(self, dia)

        # Cierres: como máximo max_cierres lugares.
        cerrar = np.asarray(acciones.cerrar, dtype=np.int64).ravel()
        self.cerrado[:] = False
        if cerrar.size > 0:
            cerrar = cerrar[: self.params.max_cierres]
            self.cerrado[cerrar] = True
            self.dias_cierre += int(cerrar.size)

        # Vacunas: solo desde dia_vacuna y hasta dosis_dia por día.
        if dia >= self.params.dia_vacuna:
            self._vacunar(np.asarray(acciones.vacunar, dtype=np.int64).ravel())

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
            protegidos = sanos[sorteo[: sanos.size] < self.params.eficacia_vacuna]
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
        presente &= ~self.cerrado[lugar]

        # Personal del hospital protegido en el hospital desde dia_medidas.
        if dia >= self.params.dia_medidas:
            es_hospital = self.red.tipo_lugar[lugar] == self._idx_hospital
            personal = self.red.personal_hospital[persona]
            presente &= ~(es_hospital & personal)

        # Infectividad por persona (según estado real).
        infect_persona = np.zeros(self.red.n_personas, dtype=np.float64)
        infect_persona[self.estado == ZOMBI] = 1.0
        infect_persona[self.estado == PORTADOR] = self.params.infect_portador

        idx = np.where(presente)[0]
        lug_p = lugar[idx]
        per_p = persona[idx]

        # Presentes por lugar y carga por lugar.
        presentes_lugar = np.bincount(lug_p, minlength=n_lugares).astype(np.float64)
        carga_lugar = np.bincount(
            lug_p, weights=infect_persona[per_p], minlength=n_lugares
        )

        denom = np.sqrt(np.maximum(presentes_lugar, 1.0))
        peso_lugar = self._peso_lugar_tipo[self.red.tipo_lugar]
        lambda_lugar = self.params.beta * peso_lugar * carga_lugar / denom

        # Suma de lambdas por persona (solo aristas presentes).
        lambda_persona = np.bincount(
            per_p, weights=lambda_lugar[lug_p], minlength=self.red.n_personas
        )

        prob_inf = 1.0 - np.exp(-lambda_persona)
        sanos = self.estado == SANO
        sorteo = self.rng.random(self.red.n_personas)
        nuevos = np.where(sanos & (sorteo < prob_inf))[0]

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
        zombis = np.where(self.estado == ZOMBI)[0]
        if zombis.size > 0:
            sorteo = self.rng.random(zombis.size)
            detectados = zombis[sorteo < self.params.p_det_zombi]
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
