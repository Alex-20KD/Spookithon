"""Ejecución de simulaciones sin bloquear el servidor.

Problemas que resuelve este módulo:

1. Las simulaciones son pesadas de CPU. Si se ejecutaran en el hilo del servidor,
   la API se congelaría. Por eso se corren en un POOL DE PROCESOS
   (``ProcessPoolExecutor``) fuera del hilo principal.

2. Reproducibilidad con paralelismo. Cada corrida ``i`` depende SOLO de
   ``params`` e ``i`` (semilla = ``params.semilla + i``). Repartimos las corridas
   entre procesos, pero al final las ORDENAMOS por índice antes de agregarlas.
   Resultado: el número es idéntico con 1 proceso o con muchos.

3. Protección de costo/tiempo. Un SEMÁFORO limita cuántas simulaciones corren a
   la vez (``MAX_SIMULACIONES``). Si ya hay demasiadas en curso, la nueva
   petición NO se encola indefinidamente: se rechaza con un error "ocupado"
   (que la capa HTTP traduce a 503).

4. Caché LRU en memoria. Si llegan los mismos parámetros + semilla + n_corridas,
   devolvemos el resultado ya calculado al instante. Sin DynamoDB.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor
from typing import Any

from simulador.params import Params
from simulador import corridas as _corridas


class ServidorOcupado(Exception):
    """Se lanza cuando ya hay demasiadas simulaciones en curso."""


# ------------------------- Worker de proceso --------------------------- #
# Esta función corre en un PROCESO hijo. Debe ser importable a nivel de módulo
# (no una lambda ni un closure) para que ProcessPoolExecutor pueda serializarla.

def _worker_corrida(
    params: Params, indice: int, eventos: list | None = None
) -> dict[str, tuple[int, list[float], list[int]]]:
    """Ejecuta una sola corrida y devuelve datos serializables (listas, no arrays)."""
    bruto = _corridas.correr_una_corrida(params, indice, eventos=eventos)
    # Convertir numpy -> tipos nativos para pasar entre procesos sin sorpresas.
    return {
        nombre: (int(inf), curva.tolist(), por_barrio.tolist())
        for nombre, (inf, curva, por_barrio) in bruto.items()
    }


def _worker_trayectoria(params: Params, estrategia_nombre: str, semilla: int, eventos: list | None = None) -> dict:
    """Ejecuta una sola corrida con registro diario por barrio."""
    from simulador import corridas as _corridas_sim

    return _corridas_sim.correr_trayectoria(params, estrategia_nombre, semilla, eventos)


class Ejecutor:
    """Coordina el pool de procesos, el semáforo y la caché."""

    def __init__(self, max_simulaciones: int, max_workers: int, tam_cache: int = 64):
        self._max_simulaciones = max_simulaciones
        self._max_workers = max(1, max_workers)
        self._pool: ProcessPoolExecutor | None = None
        # Semáforo que cuenta "simulaciones completas en curso" (no corridas).
        self._semaforo = asyncio.Semaphore(max_simulaciones)
        self._en_curso = 0
        self._cache: "_CacheLRU" = _CacheLRU(tam_cache)

    def iniciar(self) -> None:
        if self._pool is None:
            # El servidor es multi-hilo (uvicorn). Hacer fork() de un proceso
            # con varios hilos puede provocar deadlocks, así que preferimos
            # 'forkserver' (arranca procesos limpios desde un servidor de forks)
            # y, si no está disponible, caemos a 'fork' y luego al contexto por
            # defecto. 'forkserver'/'spawn' re-importan el módulo del worker,
            # por eso _worker_corrida es una función a nivel de módulo.
            contexto = None
            for metodo in ("forkserver", "fork"):
                try:
                    contexto = mp.get_context(metodo)
                    break
                except ValueError:  # pragma: no cover - método no disponible
                    contexto = None
            if contexto is None:  # pragma: no cover
                contexto = mp.get_context()
            self._pool = ProcessPoolExecutor(
                max_workers=self._max_workers, mp_context=contexto
            )

    def cerrar(self) -> None:
        if self._pool is not None:
            self._pool.shutdown(wait=False, cancel_futures=True)
            self._pool = None

    async def comparar(self, params: Params, n_corridas: int, eventos: list | None = None) -> dict[str, Any]:
        """Devuelve el resumen (como dict JSON-serializable) de la comparación.

        Lanza :class:`ServidorOcupado` si no hay cupo libre AHORA mismo (no
        espera): así el cliente recibe un 503 inmediato en vez de quedar colgado.
        """
        clave = _clave_cache(params, n_corridas)
        en_cache = self._cache.get(clave)
        if en_cache is not None:
            return en_cache

        # Rechazo inmediato si no hay cupo (no bloquear/encolar).
        if self._en_curso >= self._max_simulaciones:
            raise ServidorOcupado()

        await self._semaforo.acquire()
        self._en_curso += 1
        try:
            # Revisa la caché otra vez: otra petición idéntica pudo terminar
            # mientras esperábamos el semáforo.
            en_cache = self._cache.get(clave)
            if en_cache is not None:
                return en_cache

            resumen = await self._ejecutar(params, n_corridas, eventos)
            self._cache.put(clave, resumen)
            return resumen
        finally:
            self._en_curso -= 1
            self._semaforo.release()

    async def trayectoria(self, params: Params, estrategia_nombre: str, semilla: int, eventos: list | None = None) -> dict:
        """Ejecuta una corrida determinista con trayectoria diaria."""
        if self._en_curso >= self._max_simulaciones:
            raise ServidorOcupado()
        await self._semaforo.acquire()
        self._en_curso += 1
        try:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(
                self._pool, _worker_trayectoria, params, estrategia_nombre, semilla, eventos
            )
        finally:
            self._en_curso -= 1
            self._semaforo.release()

    async def _ejecutar(self, params: Params, n_corridas: int, eventos: list | None = None) -> dict[str, Any]:
        assert self._pool is not None, "El pool no está iniciado."
        loop = asyncio.get_running_loop()

        # Lanzar una tarea por corrida al pool de procesos.
        futuros = [
            loop.run_in_executor(self._pool, _worker_corrida, params, i, eventos)
            for i in range(n_corridas)
        ]
        resultados = await asyncio.gather(*futuros)

        # Reconstruir arrays y AGREGAR EN ORDEN (resultados[i] es la corrida i).
        import numpy as np

        por_corrida = [
            {
                nombre: (inf, np.asarray(curva, dtype=np.float64),
                         np.asarray(por_barrio, dtype=np.float64))
                for nombre, (inf, curva, por_barrio) in corrida.items()
            }
            for corrida in resultados
        ]
        resumen = _corridas.resumir_corridas(params, por_corrida)
        pct = _porcentajes_mejor_que(por_corrida)
        barrios = _corridas.barrios_orden(params)
        return _serializar_resumen(resumen, pct, barrios)


# ------------------------------ Caché LRU ------------------------------ #

class _CacheLRU:
    """Caché LRU pequeña y simple (dict con orden de inserción)."""

    def __init__(self, capacidad: int):
        self._capacidad = capacidad
        self._datos: dict[str, Any] = {}

    def get(self, clave: str) -> Any | None:
        if clave not in self._datos:
            return None
        valor = self._datos.pop(clave)
        self._datos[clave] = valor  # mover al final (más reciente)
        return valor

    def put(self, clave: str, valor: Any) -> None:
        if clave in self._datos:
            self._datos.pop(clave)
        self._datos[clave] = valor
        while len(self._datos) > self._capacidad:
            self._datos.pop(next(iter(self._datos)))  # saca el más antiguo


def _clave_cache(params: Params, n_corridas: int) -> str:
    """Hash estable de los parámetros efectivos + n_corridas.

    Incluye la semilla (está dentro de ``params``). Dos peticiones con los mismos
    parámetros efectivos y n_corridas comparten clave y, por tanto, resultado.
    """
    datos = {
        "params": _params_a_dict(params),
        "n_corridas": n_corridas,
    }
    bruto = json.dumps(datos, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(bruto).hexdigest()


def _params_a_dict(params: Params) -> dict[str, Any]:
    """Convierte Params (dataclass frozen) a dict ordenable para el hash."""
    from dataclasses import asdict

    return asdict(params)


def _porcentajes_mejor_que(
    por_corrida: list[dict[str, tuple[int, Any]]],
) -> dict[str, dict[str, float]]:
    """% de corridas en que cada estrategia tuvo MENOS infectados que Azar/Nada.

    Comparación PAREADA: en cada corrida ``i`` se comparan los infectados de la
    estrategia contra los de 'Azar' y 'Nada' en ESA MISMA corrida.
    """
    n = len(por_corrida)
    if n == 0:
        return {}
    nombres = list(por_corrida[0].keys())
    pct: dict[str, dict[str, float]] = {}
    for nombre in nombres:
        gana_azar = 0
        gana_nada = 0
        for corrida in por_corrida:
            inf = corrida[nombre][0]
            if "Azar" in corrida and inf < corrida["Azar"][0]:
                gana_azar += 1
            if "Nada" in corrida and inf < corrida["Nada"][0]:
                gana_nada += 1
        pct[nombre] = {
            "pct_mejor_que_azar": round(100.0 * gana_azar / n, 1),
            "pct_mejor_que_nada": round(100.0 * gana_nada / n, 1),
        }
    return pct


def _serializar_resumen(
    resumen: dict,
    pct: dict[str, dict[str, float]],
    barrios: list[str],
) -> dict[str, Any]:
    """Convierte ResumenEstrategia (con arrays numpy) a dict JSON-serializable."""
    salida: dict[str, Any] = {}
    for nombre, r in resumen.items():
        p = pct.get(nombre, {"pct_mejor_que_azar": 0.0, "pct_mejor_que_nada": 0.0})
        por_barrio = (
            r.infectados_por_barrio_media.tolist()
            if r.infectados_por_barrio_media is not None
            else None
        )
        salida[nombre] = {
            "nombre": r.nombre,
            "infectados_media": r.infectados_media,
            "infectados_p10": r.infectados_p10,
            "infectados_p90": r.infectados_p90,
            "salvados_media": r.salvados_media,
            "salvados_p10": r.salvados_p10,
            "salvados_p90": r.salvados_p90,
            "pct_mejor_que_azar": p["pct_mejor_que_azar"],
            "pct_mejor_que_nada": p["pct_mejor_que_nada"],
            "curva_media": r.curva_zombis.tolist(),
            "curva_p10": (
                r.curva_zombis_p10.tolist() if r.curva_zombis_p10 is not None else None
            ),
            "curva_p90": (
                r.curva_zombis_p90.tolist() if r.curva_zombis_p90 is not None else None
            ),
            # Infectados medios por barrio, alineados con ``barrios`` (mismo orden).
            "infectados_por_barrio": por_barrio,
            "barrios": list(barrios),
        }
    return salida
