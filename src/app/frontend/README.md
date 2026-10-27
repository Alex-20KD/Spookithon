# Frontend — Plaga Caracol (DATOS SIMULADOS)

Interfaz React + TypeScript + Vite que consume el backend FastAPI de simulación.
Todos los datos son **SIMULADOS** (escenario ficticio).

## Configuración

La URL del backend se lee **siempre** de la variable de entorno `VITE_API_URL`
(nunca está escrita en el código). Copia el ejemplo y ajústala si hace falta:

```bash
cp .env.example .env
# VITE_API_URL=http://localhost:8080   (por defecto si no se define)
```

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo (Vite)
npm run build    # type-check + build de producción
npm run lint     # oxlint
```

El backend debe estar corriendo (por defecto en `http://localhost:8080`):

```bash
# desde la raíz del repo
PYTHONPATH=src uvicorn app.backend.main:app --port 8080
```

## Pantallas

- **Dashboard**: resumen de la última simulación (mejor estrategia, curva con
  banda p10–p90) o un aviso para ejecutar una simulación.
- **Simulador**: ajusta los parámetros y ejecuta la comparación contra el backend.
  - Sliders: contagio (beta), infectividad del portador, días hasta detectar,
    dosis por día, eficacia de la vacuna, horizonte en días y nº de corridas.
  - Semilla editable (reproducibilidad) y selector del lugar de inicio del brote.
  - Indicador de carga mientras simula y mensaje claro si hay error.
- **Estrategias**: tarjetas con las 5 estrategias (incluye las líneas base
  **Nada** y **Azar**) y la recomendación del backend.
- **Resultados**: curva de zombis por día con rango **p10–p90** y tabla de
  **infectados y salvados** por estrategia.

Los rangos y valores por defecto de los controles se obtienen de `GET /parametros`,
así que la interfaz siempre refleja los límites reales del backend.
