# Imagen del backend FastAPI de la "Plaga Caracol" (datos SIMULADOS).
# - Python slim (imagen pequeña).
# - Usuario NO root (buena práctica de seguridad).
# - Solo instala requirements.txt (sin pytest/httpx: esos van en requirements-dev.txt).
# - Expone 8080 y arranca uvicorn en 0.0.0.0:8080.
FROM python:3.12-slim

# No generar .pyc y salida sin buffer (logs en vivo).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app

# Instalar dependencias primero (mejor uso de la caché de capas).
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copiar el código del simulador y del backend.
COPY src ./src

# Usuario no root.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

# Arranque: uvicorn sirviendo la app FastAPI.
CMD ["uvicorn", "app.backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
