# ---- Etapa 1: build (instala dependencias en un venv) ----
FROM python:3.13-slim AS build

WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Etapa 2: tests (parte de build: mismo Python y mismas dependencias, más las de test) ----
# final copia el venv desde build, no desde acá: pytest y compañía no llegan a la imagen de producción.
FROM build AS test
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY . .
# El umbral (fail_under) y lo que entra en la cuenta viven en .coveragerc: si no se llega, pytest sale con error.
ENTRYPOINT ["pytest", "--cov", \
            "--cov-report=term", \
            "--cov-report=json:/out/coverage.json", \
            "--cov-report=html:/out/htmlcov", \
            "--junitxml=/out/tests.xml"]

# ---- Etapa 3: runtime (sin herramientas de build) ----
FROM python:3.13-slim AS final

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

COPY --from=build /opt/venv /opt/venv
COPY . .
RUN chmod +x entrypoint.sh && python manage.py collectstatic --noinput

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
