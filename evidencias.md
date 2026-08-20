# Evidencias de Ejecución — TP1

## 1. Rechazo de Push Directo a main
![Push directo rechazado](./evidencia1_push_rechazado.png)
<img width="1024" height="619" alt="image" src="https://github.com/user-attachments/assets/8be3bc41-03eb-4fde-aade-d256c6001a49" />

## 2. Aviso de Conflicto en GitHub
![Aviso de conflicto](./evidencia2_aviso_conflicto.png)
<img width="1024" height="916" alt="image" src="https://github.com/user-attachments/assets/3a12b1b5-ee19-48dc-9485-35cfeb947d9a" />


## 3. Marcadores de Conflicto
![Marcadores de conflicto](./evidencia3_marcadores_conflicto.png)
<img width="3020" height="692" alt="image" src="https://github.com/user-attachments/assets/5f246a87-1f67-4d55-958c-0994e63b2475" />


## 4. Release v1.0.0 Publicada
![Release v1.0.0](./evidencia4_release.png)
<img width="1488" height="1272" alt="image" src="https://github.com/user-attachments/assets/a9b520ac-916f-4923-819a-4cf6c6abf042" />

---

# TP2 — Contenedores

## 1. `docker compose up -d --build` desde cero — sistema end-to-end

Salida real de `docker compose down -v && docker compose up -d --build`, simulando un clon limpio del repo (sin ningún volumen ni imagen previa):

```
 Image club-tablada-devops-backend Built
 Image club-tablada-devops-frontend Built
 Container club-tablada-devops-db-1 Starting
 Container club-tablada-devops-db-1 Started
 Container club-tablada-devops-db-1 Healthy
 Container club-tablada-devops-backend-1 Starting
 Container club-tablada-devops-backend-1 Started
 Container club-tablada-devops-frontend-1 Starting
 Container club-tablada-devops-frontend-1 Started
```

Log del backend mostrando que las migraciones se aplican **solas**, sin ningún paso manual (gracias a `entrypoint.sh`):

```
Operations to perform:
  Apply all migrations: admin, auth, contenttypes, core, sessions
Running migrations:
  Applying contenttypes.0001_initial... OK
  Applying contenttypes.0002_remove_content_type_name... OK
  Applying auth.0001_initial... OK
  ... (20 migraciones en total)
  Applying sessions.0001_initial... OK
[INFO] Starting gunicorn 23.0.0
[INFO] Listening at: http://0.0.0.0:8000 (1)
```

`docker compose ps` con los 3 servicios sanos:

```
NAME                             SERVICE    STATUS
club-tablada-devops-backend-1    backend    Up (0.0.0.0:8000->8000/tcp)
club-tablada-devops-db-1         db         Up (healthy)
club-tablada-devops-frontend-1   frontend   Up (0.0.0.0:3000->80/tcp)
```

Prueba end-to-end real: se creó un usuario (`admin_demo`) y se hizo login contra la API **a través del proxy de nginx** (`localhost:3000`, el mismo camino que usa el navegador — no directo al backend):

```
$ curl -X POST http://localhost:3000/api/v1/auth/token/ \
    -H "Content-Type: application/json" \
    -d '{"username":"admin_demo","password":"ClubTablada2026!"}'
HTTP 200   (devuelve access + refresh token)
```

## 2. Prueba de persistencia

Se creó un usuario de prueba (`evidencia_persistencia`) y se verificó su comportamiento frente a `down` y `down -v`:

```
-- Creando un registro de prueba --
Total usuarios: 1

-- docker compose down (SIN -v) + up: el dato debe sobrevivir --
Existe despues de down/up: True

-- docker compose down -v + up: el dato debe desaparecer --
Existe despues de down -v/up: False
Total usuarios (DB nueva): 0
```

Confirma que el volumen nombrado `db_data` sobrevive a `docker compose down`, y que `down -v` lo destruye junto con todos los datos — el comportamiento esperado según la guía.

## 3. Comparación de tamaño de imagen (final vs. etapa de build)

Medido con `docker inspect --format='{{.Size}}'` sobre las imágenes reales del proyecto:

| Imagen | Tamaño | Nota |
|---|---|---|
| `python:3.13-slim` (base) | 203 MB | Imagen base, sin dependencias del proyecto |
| Backend — etapa `build` (venv + pip install) | 363 MB | Etapa que instala las dependencias |
| Backend — imagen `final` | 363 MB | Ver `decisiones.md`: `Pillow`/`psycopg` no compilan desde fuente, no hay binarios de build que excluir |
| `node:22-alpine` (build del frontend) | 229 MB | Toolchain completo de Node/npm |
| Frontend — imagen `final` (nginx + estáticos) | 93.4 MB | El SDK de Node no viaja a producción: **~59% menos** |

## 4. Imágenes publicadas en el registry

Ambas imágenes públicas en GitHub Container Registry (`ghcr.io`), verificado en la web de GitHub (pestaña *Packages*):

- **`club-tablada-backend`** — `v0.1.1` — visibilidad **Public**
  `docker pull ghcr.io/salvadorsolana04/club-tablada-backend:v0.1.1`
- **`club-tablada-frontend`** — `v0.1.1` — visibilidad **Public**
  `docker pull ghcr.io/salvadorsolana04/club-tablada-frontend:v0.1.1`

Se verificó además que `docker-compose.registry.yml` levanta el sistema completo **descargando** estas imágenes (sin construir desde el código local), y que funciona igual que la variante de desarrollo (`docker compose ps` mostró los 3 servicios sanos, y el proxy de nginx respondió igual que con las imágenes locales).

> **Nota:** existe una versión `v0.1.0` anterior en el registry, publicada antes de corregir la filtración del `.env` (ver `decisiones.md`, sección "Problemas encontrados"). Se reemplazó por `v0.1.1` en `docker-compose.registry.yml`; `v0.1.0` queda visible en el historial del registry pero no se usa en ningún lado del repo.
