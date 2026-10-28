# Backend — Plaga Caracol (API de simulación)

API HTTP con **FastAPI** que expone el simulador ficticio (`src/simulador`) para
comparar estrategias de vacunación, y que **lee los datos del escenario desde
DynamoDB** (tablas `plaga-*`). **Todos los datos son SIMULADOS.** No contiene
credenciales: en AWS usa el rol de la tarea de ECS; en local, la cadena de
credenciales por defecto de boto3 (`aws configure`).

## Correr en local

Desde la raíz del repo (necesitas `PYTHONPATH=src` para que Python encuentre los
paquetes `app` y `simulador`):

```bash
# 1) Instalar dependencias de desarrollo (incluye las de runtime + pytest + httpx)
pip install -r requirements-dev.txt

# 2) Levantar el servidor (recarga automática en desarrollo)
PYTHONPATH=src uvicorn app.backend.main:app --reload --port 8080
```

Abre la documentación interactiva en http://localhost:8080/docs

### Con Docker

```bash
docker build -t plaga-backend .
docker run --rm -p 8080:8080 plaga-backend
# CORS configurable:
docker run --rm -p 8080:8080 -e CORS_ORIGINS="http://localhost:5173,https://mi-front" plaga-backend
```

## Variables de entorno

| Variable           | Por defecto               | Para qué sirve                                   |
|--------------------|---------------------------|--------------------------------------------------|
| `CORS_ORIGINS`     | `http://localhost:5173`   | Orígenes permitidos (coma-separados). Nunca `*`. |
| `N_CORRIDAS_MAX`   | `300`                     | Tope de corridas por petición.                   |
| `DIAS_MAX`         | `100`                     | Tope de días por petición.                       |
| `MAX_SIMULACIONES` | `2`                       | Simulaciones simultáneas (si se supera → 503).   |
| `MAX_WORKERS`      | `os.cpu_count()`          | Procesos del pool de simulación.                 |
| `EJECUTOR_MODO`    | `procesos`                | `procesos` o `hilos` (hilos: contenedores con muy poca CPU). |
| `AWS_REGION`       | `us-east-1`               | Región de las tablas DynamoDB `plaga-*`.         |
| `AVISO_SIMULADO`   | `DATOS SIMULADOS`         | Texto de aviso incluido en cada respuesta.       |

## Endpoints

| Método | Ruta          | Qué devuelve                                                        |
|--------|---------------|--------------------------------------------------------------------|
| GET    | `/salud`      | `{"estado": "ok"}`                                                 |
| GET    | `/catalogo`   | Barrios (12) y edificios (10) de la geografía ficticia.            |
| GET    | `/parametros` | Parámetros editables: valor por defecto, rango y descripción.      |
| POST   | `/comparar`   | Compara las 5 estrategias: medias, p10/p90, curvas, mejor, R0.     |
| POST   | `/trayectoria`| Una corrida con registro diario por barrio.                        |
| GET    | `/datos/casos`, `/datos/casos/resumen` | Casos del brote (DynamoDB `plaga-casos`). |
| GET    | `/datos/curas`, `/datos/sintomas`, `/datos/inventario` | Curas, síntomas e inventario (DynamoDB). |
| GET    | `/datos/fumigaciones`, `/datos/noticias` | Fumigaciones y noticias (DynamoDB). |

Los endpoints `/datos/*` leen las tablas con `src/app/backend/datos.py`. Si
DynamoDB no está disponible (sin credenciales o sin permisos), responden **503**
con un mensaje claro y el resto de la API sigue funcionando.

### Ejemplo `POST /comparar`

Petición (todos los campos son opcionales salvo que quieras cambiarlos):

```json
{ "semilla": 42, "dias": 60, "n_corridas": 30, "dosis_dia": 100 }
```

Respuesta (resumida):

```json
{
  "aviso": "DATOS SIMULADOS",
  "estrategias": [
    {
      "nombre": "Nada",
      "infectados_media": 1900.0,
      "infectados_p10": 1700.0, "infectados_p90": 2100.0,
      "salvados_media": 0.0, "salvados_p10": 0.0, "salvados_p90": 0.0,
      "pct_mejor_que_azar": 0.0, "pct_mejor_que_nada": 0.0,
      "curva_diaria": { "dias": [0,1,2,"..."], "media": ["..."], "p10": ["..."], "p90": ["..."] }
    }
  ],
  "mejor_estrategia": "CierresMasCentralidad",
  "recomendacion": "La estrategia 'CierresMasCentralidad' deja en promedio ...",
  "parametros_efectivos": { "semilla": 42, "dias": 60, "...": "..." },
  "semilla": 42,
  "n_corridas": 30
}
```

Las 5 estrategias son: `Nada`, `Azar`, `Centralidad`, `CierresMasCentralidad`, `Anillo`.

## Pruebas

```bash
PYTHONPATH=src pytest tests/test_backend_api.py tests/test_corridas_detallado.py -q
```

## Notas de diseño

- **Reproducibilidad:** misma semilla + mismos parámetros → misma respuesta
  exacta, aunque corra en 1 o en varios procesos (cada corrida depende solo de
  `semilla + índice` y se agregan en orden).
- **No bloquea el servidor:** las simulaciones corren en un pool de procesos.
- **Protección:** semáforo de simulaciones simultáneas (503 si se satura) y
  topes de `n_corridas`/`dias`.
- **Caché** LRU en memoria por (parámetros efectivos + semilla + n_corridas).
- **Parámetros NO editables** (población, estructura de la red, catálogo) no se
  exponen: la API los mantiene fijos.
```
