# PLAGA ZOMBIE: MANABÍ — Simulador de epidemia y estrategias de contención

> **SpookyThon 2026 · Track B · La Plaga Zombie** — Equipo Plaga Zombie
> (escenario de origen: "Plaga Caracol")
>
> ⚠️ **TODOS LOS DATOS SON SIMULADOS.** Escenario ficticio sobre Manta (Ecuador).
> No usa datos reales de personas ni de salud pública.

Simulador de un brote zombie ("Plaga Caracol") en Manta que, sobre una red de contactos de
3.000 personas ficticias, **compara estrategias de vacunación y contención** y
recomienda cuál deja a menos gente infectada frente a *no hacer nada* o *actuar
al azar*. Incluye un panel web (dashboard) y un videojuego de estrategia.

<!-- TODO (equipo): añadir aquí una captura del dashboard (docs/captura-dashboard.png). -->

---

## 1. Qué hace

- Simula día a día una epidemia tipo **SEIR sobre un grafo de contactos** (estados
  Sano · Incubando · Portador · Zombi · Inmune).
- Ejecuta **múltiples corridas** y agrega resultados con **media y banda p10–p90**.
- Compara **5 estrategias** y devuelve la mejor con una recomendación legible.
- Permite cambiar parámetros en caliente (sliders) para el **"Brote Sorpresa"**.
- Es **reproducible**: misma semilla + mismos parámetros → mismo resultado.

### Estrategias comparadas

| Estrategia | Descripción |
|---|---|
| `Nada` | Línea base: no se interviene. |
| `Azar` | Línea base: se usan las dosis al azar. |
| `Centralidad` | Vacuna a los más conectados de la red. |
| `CierresMasCentralidad` | Cierra lugares clave + vacuna por centralidad. |
| `Anillo` | Vacunación en anillo alrededor de portadores detectados. |

---

## 2. Arquitectura

```
Usuario ──HTTPS──► [ CloudFront  d2n10k2c1hlb54.cloudfront.net ]
                      │  /          → S3 (dashboard React/Vite)
                      │  /juego/    → S3 (videojuego React/Phaser)
                      ▼
   Dashboard ──HTTPS + CORS──► [ ECS Express · contenedor FastAPI :8080 ]
                                    │  simulador SEIR en memoria (pool de procesos)
                                    │  lectura de datos del escenario
                                    ▼
            DynamoDB (plaga-*) · IAM (mínimo privilegio) · CloudWatch Logs
```

- **Backend:** FastAPI + uvicorn en un contenedor (ver `Dockerfile`), desplegado en
  **Amazon ECS Express Mode** (us-east-1). Imagen en **Amazon ECR**. El simulador
  vive en `src/simulador`.
- **Datos:** 6 tablas **DynamoDB** `plaga-*` (bajo demanda) con datos ficticios del
  escenario, que el backend lee en los endpoints `/datos/*` (ver §6).
- **Frontend (dashboard):** React + TypeScript + Vite (`src/app/frontend`), en S3.
- **Videojuego:** React + Phaser + Vite (`videojuego-plaga-zombie`), app aparte en S3.
- El dashboard llama **directamente** a la URL de ECS (CORS restringido al dominio
  de CloudFront); CloudFront solo sirve los estáticos.
- Diagrama completo (Mermaid, público vs. privado): [`docs/arquitectura.md`](docs/arquitectura.md).

---

## 3. Cómo probarlo

### URLs públicas

| Servicio | URL |
|---|---|
| **Dashboard (demo)** | <https://d2n10k2c1hlb54.cloudfront.net/> |
| Videojuego | <https://d2n10k2c1hlb54.cloudfront.net/juego/index.html> |
| Backend (API) | <https://pl-12ea63fa7ffd4e47974b58d488d89159.ecs.us-east-1.on.aws> |
| Documentación interactiva de la API | <https://pl-12ea63fa7ffd4e47974b58d488d89159.ecs.us-east-1.on.aws/docs> |

Comprobación rápida de la API:

```bash
curl https://pl-12ea63fa7ffd4e47974b58d488d89159.ecs.us-east-1.on.aws/salud
# -> {"estado":"ok"}
```

### Correr en local

**Backend** (desde la raíz; necesita `PYTHONPATH=src`):

```bash
pip install -r requirements-dev.txt
PYTHONPATH=src uvicorn app.backend.main:app --reload --port 8080
# docs interactivas: http://localhost:8080/docs
```

> En fish (shell por defecto de algunos equipos): `env PYTHONPATH=src uvicorn app.backend.main:app --reload --port 8080`

**Dashboard:**

```bash
cd src/app/frontend
cp .env.example .env     # ajusta VITE_API_URL y VITE_GAME_URL
npm install
npm run dev              # http://localhost:5173
```

**Videojuego:**

```bash
cd videojuego-plaga-zombie
cp .env.example .env     # ajusta VITE_DASHBOARD_URL
npm install
npm run dev              # http://localhost:3000
```

El dashboard tiene un botón **"Jugar"** (barra lateral) que lleva al videojuego, y
el juego un botón **"Volver al panel"**. Las URLs se leen de variables de entorno
(`VITE_GAME_URL`, `VITE_DASHBOARD_URL`), así funcionan igual en local y en AWS.

---

## 4. Parámetros por defecto y semilla (Track B)

Reproducibilidad: **semilla por defecto = 42**. Misma semilla + mismos parámetros
→ mismo resultado exacto.

| Parámetro | Valor | Justificación / nota |
|---|---|---|
| Semilla | `42` | Reproducibilidad (supuesto de diseño). |
| Población | `3.000` | Escala manejable para la demo (supuesto de diseño). |
| Horizonte (días) | `60` | A 60 días las estrategias marcan diferencia clara (ver `data/calibracion.json`). |
| Casos iniciales | paciente cero + `3` | Primeros médicos atendieron sin protección (supuesto). |
| Lugar de inicio | `hospital` | Editable: hospital · mercado · colegio · bus. |
| Incubación | `4–5` días (aleatorio) | Supuesto de diseño. |
| Portador contagia desde | día `2` | Supuesto de diseño. |
| Infectividad del portador | `0.30` (vs zombi = 1.0) | Supuesto de diseño, editable. |
| β (tasa de transmisión) | `0.015625` | **Calibrado** para R₀≈2,5 (ver `scripts/calibrar_beta.py`, `src/simulador/r0.py`). |
| Vía de transmisión | `mordidas` | Opciones: mordidas · esporas · combinada. |
| Medidas activas desde | día `4` | Editable (Brote Sorpresa). |
| Vacuna lista desde | día `10`, `100` dosis/día | Recurso limitado por días. |
| Eficacia de la vacuna | `0.90` | Supuesto de diseño (45% en el brote sorpresa). |
| Máx. cierres simultáneos | `3` | Supuesto de diseño. |
| Días hasta detectar | `4` | Editable (Brote Sorpresa). |
| Corridas por defecto | `50` | Ver nota de rendimiento en §6. |

> Los valores marcados como "supuesto de diseño" son puntos de partida del equipo,
> no datos reales. La plaga es ficticia.

Parámetros editables en la interfaz para el **Brote Sorpresa**: β (contagio),
dosis/día, eficacia de vacuna, días hasta detectar, infectividad del portador y
lugar de inicio.

---

## 5. Decisiones de diseño

- **SEIR sobre grafo (basado en agentes):** cada persona pertenece a varios lugares
  (hogar, colegio, bus, mercado, hospital, barrio) y el contagio ocurre por lugar.
- **Dos fases de contagio (Portador y Zombi):** el contagio empieza *antes* de la
  conversión completa, por eso se separa "Incubando" (no contagia) de "Portador"
  (contagia con infectividad reducida).
- **Estado real vs. estado conocido:** la estrategia solo usa lo que la vigilancia
  *detecta*, no el estado real de cada persona (rigor epidemiológico).
- **La vacuna solo se aplica a SANOS** (no a infectados ni inmunes). Cubierto por
  pruebas automáticas en `tests/`.
- **Reproducibilidad con paralelismo:** cada corrida `i` depende solo de
  `semilla + i`; los resultados se agregan en orden, así el número es idéntico
  con 1 o con varios procesos.

---

## 6. Despliegue en AWS y notas técnicas

### Configuración del backend en ECS Express (us-east-1)

- Imagen: repositorio ECR privado `plaga-backend` (construida desde `Dockerfile`).
- Cómputo: **TODO (equipo): vCPU / GB configurados en ECS** — se amplió desde
  1 vCPU / 2 GB para llegar a 300 corridas (ver tabla de tiempos). 1 tarea (min=max=1).
- Puerto del contenedor: `8080` · Health check: `/salud`.
- Rol de infraestructura: política inline con permisos de red + balanceo
  (`ec2:*NetworkInterface*`, `elasticloadbalancing:*`) — se añadió porque el rol
  por defecto de Express venía sin permisos suficientes (fallaba el PROVISIONING).
- Rol de tarea (`ecsTaskExecutionRole`): con la política `plaga-dynamodb-acceso`
  (lectura/escritura solo en tablas `plaga-*` y sus índices).

### Variables de entorno del backend

| Variable | Valor en AWS | Para qué |
|---|---|---|
| `EJECUTOR_MODO` | `procesos` | Pool de procesos (paraleliza en varias vCPU). `hilos` disponible para entornos con muy poca CPU. |
| `MAX_WORKERS` | `TODO (equipo)` | Procesos del pool (acorde a las vCPU). |
| `N_CORRIDAS_MAX` | `300` | Tope de corridas por petición. |
| `CORS_ORIGINS` | `https://d2n10k2c1hlb54.cloudfront.net` | Orígenes permitidos (nunca `*`). |

### Rendimiento: 300 corridas bajo el límite de 60 s

El balanceador gestionado de **ECS Express corta las respuestas a los 60 s**, así
que `POST /comparar` tiene que terminar antes. Tiempos **medidos en producción**:

| Escenario | 1 vCPU / 2 GB (inicial) | Cómputo ampliado (actual) |
|---|---|---|
| 100 corridas, 60 días | ~32 s | **~11 s** ✅ |
| 150 corridas, 60 días | ~54 s | — |
| **300 corridas, 60 días** (semilla 42) | >60 s ❌ 504 | **~29 s** ✅ |
| **Peor caso:** 300 corridas, 100 días, contagio ×2, inicio en mercado | — | **~42 s** ✅ |

Con 1 vCPU el tope tuvo que fijarse en 150 corridas; al ampliar el cómputo se
subió a **300** (`N_CORRIDAS_MAX=300`), lo que cumple el requisito de "300 o más
corridas" incluso en el peor caso del Brote Sorpresa, con ~18 s de margen. El
frontend lee el tope de `GET /parametros`, así que el slider se ajusta solo.

**Mejora futura:** para miles de corridas, convertir `POST /comparar` en ejecución
**asíncrona** (job id + polling) o precálculo (Lambda/Step Functions), eliminando
el límite de respuesta síncrona.

### Endpoints de la API

| Método | Ruta | Fuente | Qué devuelve |
|---|---|---|---|
| GET | `/salud` | — | `{"estado": "ok"}` |
| GET | `/catalogo` | simulador | Barrios y edificios de Manta (ficticios). |
| GET | `/parametros` | simulador | Parámetros editables: por defecto, rango y topes. |
| POST | `/comparar` | simulador (memoria) | Compara las 5 estrategias: media, p10/p90, curvas, mejor estrategia, recomendación y **R0 calibrado**. |
| POST | `/trayectoria` | simulador (memoria) | Una corrida con registro diario por barrio (mapa animado). |
| GET | `/datos/casos` | **DynamoDB** `plaga-casos` | Casos registrados del brote. |
| GET | `/datos/casos/resumen` | **DynamoDB** `plaga-casos` | Total de casos y conteo por estado y por barrio. |
| GET | `/datos/curas` | **DynamoDB** `plaga-curas` | Curas/antivirales y su eficacia. |
| GET | `/datos/sintomas` | **DynamoDB** `plaga-sintomas` | Síntomas por fase de la enfermedad. |
| GET | `/datos/inventario` | **DynamoDB** `plaga-inventario` | Inventario de curas por centro. |
| GET | `/datos/fumigaciones` | **DynamoDB** `plaga-fumigaciones` | Fumigaciones programadas/hechas. |
| GET | `/datos/noticias` | **DynamoDB** `plaga-noticias` | Noticias del brote. |

La simulación corre **en memoria** para ser rápida y reproducible; los datos del
escenario se **persisten en DynamoDB** (cargados con `scripts/cargar_datos.py`) y
se leen en los endpoints `/datos/*` (`src/app/backend/datos.py`). Si DynamoDB no
está disponible, esos endpoints responden **503** claro sin tumbar el servidor.

### Seguridad

- Sin credenciales en el código ni en el historial (`.gitignore` incluye `.env`).
- IAM con **mínimo privilegio** (política `plaga-dynamodb-acceso` restringida a
  tablas `plaga-*`; rol de infraestructura acotado a red/balanceo).
- Credenciales de AWS por roles, no escritas en el código.
- **Limitación declarada:** los usuarios IAM del equipo se crearon **sin MFA**
  (decisión del equipo por el plazo del hackathon).

---

## 7. Costos

Ver [`docs/costos.md`](docs/costos.md): costo mensual estimado por servicio con el
cálculo visible y el gasto real del evento.

- **AWS Budget** `spookython-plaga`: $17/mes, alertas por correo al 50%, 80% y
  100% más una de pronóstico.
- Captura del Budget: [`docs/budget.jpeg`](docs/budget.jpeg).
- El contenedor ECS es casi todo el costo; **se borra después del pitch**.

---

## 8. Pruebas

```bash
PYTHONPATH=src pytest tests/ -q
```

Incluye, entre otras, la prueba de rigor **"la vacuna solo va a sanos"**.

---

## 9. Estructura del repositorio

```
README.md
docs/            arquitectura.md (Mermaid) · costos.md · budget.jpeg · tablas-dynamodb.jpeg
src/
  simulador/     modelo SEIR, estrategias, líneas base, red, territorio, R0
  app/
    backend/     API FastAPI (main, ejecutor, configuración, esquemas, parámetros, datos DynamoDB)
    frontend/    dashboard React + Vite
videojuego-plaga-zombie/   juego React + Phaser + Vite (app aparte)
scripts/         carga de datos a DynamoDB, calibración de beta
tests/           pruebas del simulador y de la API
infra/           (pendiente) IaC / notas de despliegue
Dockerfile       imagen del backend
```

---

## 10. Limitaciones conocidas

- Población **ficticia**, no calibrada con datos reales (la plaga es inventada).
- Valores de mascarilla, control de fiebre e infectividad del portador son
  **supuestos de diseño**, no datos reales.
- Los zombis no desaparecen en el nivel base.
- `POST /comparar` es **síncrono**: el balanceador de ECS Express corta a los 60 s.
  Con el cómputo actual, 300 corridas tardan ~29–42 s; muchas más corridas
  requerirían ejecución asíncrona (ver §6).
- La simulación no lee DynamoDB: los datos del escenario se sirven aparte en
  `/datos/*`; el motor de simulación genera su propia red en memoria.
- Usuarios IAM **sin MFA** (ver §6).

---

<!-- TODO (equipo): enlace al video demo (opcional) y a la presentación del pitch. -->
