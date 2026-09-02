# Club La Tablada

> **Materia:** Ingeniería del Software 3 — UCC 2026
> **Alumno:** Salvador Solana Allende
> **Instructor:** Ing. Ariel Schwindt
> **Versión Actual:** `v3.0.0` (TP1 Git, TP2 Contenedores y TP3 Planificación y trazabilidad completos)

App web del Club La Tablada — proyecto de Ingeniería de Software 3 / DevOps.

Arquitectura liviana ("Vertical Slice") con 3 módulos:

1. **Autenticación y roles** — login con JWT, roles `jugador` / `entrenador` / `admin`.
2. **Feed de noticias** — lectura para todos, publicación solo para `admin`.
3. **Mensajes de división** — cada usuario ve solo los mensajes de su deporte/división; solo el `entrenador` de esa división puede publicar.

## Stack

- **Backend:** Python 3.13, Django 6, Django REST Framework, SimpleJWT, django-environ, gunicorn + whitenoise (en contenedor).
- **Frontend:** React 19 + Vite, Axios, React Router DOM, TailwindCSS.
- **Base de datos:** SQLite (local, sin Docker) o PostgreSQL 16 (contenedor, ver abajo).
- **Contenedores:** Docker multi-stage para backend y frontend, orquestados con Docker Compose; imágenes publicadas en GitHub Container Registry.

## Levantar con Docker (recomendado)

Requisito único: **Docker Desktop** instalado y corriendo (`docker compose version` tiene que responder — si dice `Cannot connect to the Docker daemon`, abrí Docker Desktop y esperá a que arranque). No hace falta instalar Python, Node ni Postgres en tu máquina: todo corre en contenedores.

### Primera vez (o después de clonar el repo)

```bash
cp .env.example .env
docker compose up -d --build
```

`cp .env.example .env` copia la plantilla de variables de entorno — el `.env` real no se versiona (tiene la contraseña de la base). **Este paso va primero**: sin él, Postgres arranca sin contraseña y se niega a levantar.

El primer `up --build` construye las tres imágenes (backend, frontend, y descarga Postgres) y puede tardar un par de minutos. Al arrancar, el backend **aplica las migraciones de Django automáticamente** — no hace falta correr `migrate` a mano, es parte del arranque del contenedor.

Esperá a que los tres servicios estén arriba:

```bash
docker compose ps      # db "healthy", backend y frontend "running"
```

Con todo arriba:

- **Frontend** (React, servido por nginx): http://localhost:3000
- **API** (Django, vía gunicorn): http://localhost:8000/api/v1/
- **Admin de Django**: http://localhost:8000/admin/ (también accesible en `http://localhost:3000/admin/`, vía el proxy de nginx)

### Usuarios para probar

La base arranca vacía. Para crear los mismos usuarios de prueba que en la puesta en marcha sin Docker, ejecutá el comando dentro del contenedor del backend:

```bash
docker compose exec backend python manage.py shell -c "
from core.models import Usuario
Usuario.objects.create_user(username='admin_demo', password='ClubTablada2026!', rol='admin')
Usuario.objects.create_user(username='entrenador_demo', password='ClubTablada2026!', rol='entrenador', deporte='rugby', division='M19')
Usuario.objects.create_user(username='jugador_demo', password='ClubTablada2026!', rol='jugador', deporte='rugby', division='M19')
"
```

O creá un superusuario para entrar a `/admin/`:

```bash
docker compose exec backend python manage.py createsuperuser
```

### Día a día

```bash
docker compose up -d              # levanta lo que ya está construido
docker compose logs -f backend    # ver logs del backend en vivo (Ctrl+C para salir)
docker compose down               # apaga los contenedores, CONSERVA los datos de la BD
docker compose down -v            # apaga todo y BORRA también los datos de la BD
```

La diferencia entre esos dos últimos comandos importa: los datos de Postgres viven en un volumen nombrado (`db_data`) que sobrevive a `down`, pero no a `down -v`.

### Levantar el sistema sin el código (imágenes publicadas)

Las imágenes de backend y frontend están publicadas y son públicas en GitHub Container Registry. Para levantar el sistema **descargándolas** en vez de compilarlas desde este repo:

```bash
cp .env.example .env
docker compose -f docker-compose.registry.yml up -d
```

- `ghcr.io/salvadorsolana04/club-tablada-backend:v0.1.1`
- `ghcr.io/salvadorsolana04/club-tablada-frontend:v0.1.1`

## Puesta en marcha sin Docker (alternativa)

Requisitos: **Python 3.13+**, **Node 20+** y **npm**. No hace falta Docker ni ninguna base de datos externa — por defecto todo corre contra SQLite.

Se necesitan dos terminales abiertas en paralelo (una para el backend, otra para el frontend).

### Inicio rápido (día a día)

Para cuando ya instalaste todo una vez (ver "Instalación completa" más abajo) y solo querés levantar los servidores.

**Terminal 1 — Backend:**

```bash
cd backend
source .venv/bin/activate      # en Windows: .venv\Scripts\activate
python manage.py runserver
```

Dejala corriendo. La API queda en `http://127.0.0.1:8000/api/v1/`.

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Dejala corriendo. La SPA queda en `http://localhost:5173`.

Con los dos servidores arriba, abrí `http://localhost:5173` en el navegador. Para parar cualquiera de los dos, `Ctrl + C` en su terminal.

### Instalación completa (primera vez)

Si es la primera vez que corrés el proyecto en esta máquina (o cloonaste el repo de nuevo), hacé esto una sola vez antes del "Inicio rápido".

#### 1. Backend (Django + DRF)

```bash
cd backend
python3 -m venv .venv          # crea el entorno virtual (una sola vez)
source .venv/bin/activate      # en Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # variables de entorno locales (no se versiona)
python manage.py migrate       # crea db.sqlite3 y aplica las migraciones
python manage.py createsuperuser   # opcional: para entrar a /admin/
python manage.py runserver
```

Con esto la API queda arriba en `http://127.0.0.1:8000/api/v1/`. Dejá esta terminal corriendo.

Sin `DATABASE_URL` definida en `.env`, se usa SQLite local (`db.sqlite3`, ignorado por git). Para apuntar a Postgres u otra base, seteá `DATABASE_URL` en `.env` (ej. `postgres://usuario:password@localhost:5432/club_tablada`) — no hace falta tocar código.

**Compilar/ejecutar, en una línea:** no hay paso de "compilación" en Django (Python es interpretado); el comando que arranca el servidor de desarrollo es `python manage.py runserver`. Las dependencias se instalan con `pip install -r requirements.txt`.

#### 2. Frontend (React + Vite)

En otra terminal, desde la raíz del repo:

```bash
cd frontend
npm install
cp .env.example .env           # VITE_API_URL apuntando al backend
npm run dev
```

La SPA queda arriba en `http://localhost:5173` y ya consume la API del paso anterior.

**Compilar/ejecutar, en una línea:** `npm run dev` levanta el servidor de desarrollo con hot-reload; `npm run build` genera el build de producción optimizado en `frontend/dist/`; `npm run preview` sirve ese build ya compilado para probarlo localmente.

#### 3. Usuarios para probar

La base arranca vacía. Para crear usuarios de prueba con los 3 roles, con el backend activado:

```bash
cd backend
python manage.py shell -c "
from core.models import Usuario
Usuario.objects.create_user(username='admin_demo', password='ClubTablada2026!', rol='admin')
Usuario.objects.create_user(username='entrenador_demo', password='ClubTablada2026!', rol='entrenador', deporte='rugby', division='M19')
Usuario.objects.create_user(username='jugador_demo', password='ClubTablada2026!', rol='jugador', deporte='rugby', division='M19')
"
```

O entrá a `http://127.0.0.1:8000/admin/` con el superusuario del paso 1 y gestionalos ahí.

### Tests

```bash
cd backend
python manage.py test core
```

### Compilar el frontend para producción

```bash
cd frontend
npm run build       # genera frontend/dist/
npm run preview     # sirve ese build para verificarlo local
```

## Estructura

```
backend/
  config/           # settings, urls raíz
  core/             # modelos, serializers, views, permisos, tests
  Dockerfile        # multi-stage: build (venv) + final (runtime)
  entrypoint.sh      # migrate automático + arranque de gunicorn
  .dockerignore
frontend/
  src/
    api/            # cliente axios con interceptor JWT
    context/        # AuthContext (sesión)
    pages/          # Login, Feed, Division
    components/     # Navbar, ProtectedRoute
  Dockerfile        # multi-stage: build (Node) + final (nginx)
  nginx.conf        # proxy /api, /admin, /media hacia el backend
  .dockerignore
docker-compose.yml            # sistema completo, construyendo desde el código
docker-compose.registry.yml   # igual, pero descargando las imágenes publicadas
.env.example                  # plantilla de variables (el .env real no se versiona)
```

---

## Trabajos Prácticos

Todo lo de arriba es la documentación de la app en sí. Lo que sigue es el resumen de qué se hizo en cada Trabajo Práctico de la materia, en orden cronológico — para eso están `decisiones.md` y `evidencias.md`, que se van completando TP por TP en el mismo archivo (no uno nuevo por TP).

### TP1 — Git para Equipos y Cultura DevOps

En este trabajo práctico se configuró la infraestructura base de control de versiones y políticas de integración continua para el equipo de desarrollo.

#### Requisitos Implementados & Cumplimiento

1. **Política de Protección de Rama (`Policy as Code`):**
   - Se configuró la rama `main` en GitHub requiriendo Pull Request obligatorio antes de integrar cualquier cambio.
   - Configuración de **0 aprobaciones (*approvals*)** requeridas (adaptado para trabajo individual) y activación innegociable de `enforce_admins` (se rechaza el push directo incluso al administrador del repo).
2. **Estrategia de Branching (GitHub Flow):**
   - Integración mediante ramas cortas de funcionalidad (`feature/`).
   - Merges integrados obligatoriamente con la modalidad **Squash and Merge** para mantener un historial lineal y limpio en `main`.
3. **Resolución de Conflictos Integrada:**
   - Simulación y resolución manual de conflicto de integración de tres vías (3-way merge) entre ramas divergentes (`feature/titulo-a` y `feature/titulo-b`).
4. **Versionado Semántico & Release:**
   - Creación y publicación del tag anotado **`v1.0.0`** y Release asociada con notas de cambios.

#### Cómo se suben los cambios (flujo de Pull Request)

Como `main` está protegida (punto 1 de arriba), **nunca se pushea directo** — todo cambio, de cualquier TP, entra por una rama y un PR:

```bash
git checkout -b feature/lo-que-cambiaste
git status                                 # revisá qué se modificó antes de agregarlo
git add archivo1 archivo2                  # evitar "git add ." a ciegas
git commit -m "Descripción breve de lo que cambiaste"
git push -u origin feature/lo-que-cambiaste
```

Después, desde GitHub (o `gh pr create`): abrí un Pull Request de tu rama hacia `main`, revisalo, y mergealo con **Squash and Merge**. Por último, traé el cambio a tu rama local:

```bash
git checkout main
git pull
```

Notas:

- Un `git push origin main` directo va a ser **rechazado** por la protección de rama — es la prueba del punto 1, no un error tuyo (ver `evidencias.md`).
- Los archivos como `backend/.env`, `.env`, `backend/db.sqlite3`, `backend/media/`, `backend/.venv/`, `node_modules/` **no van a aparecer** en `git status` — están en `.gitignore` a propósito, no se suben.
- Si es tu primera vez configurando git en esta máquina, puede pedirte usuario/contraseña o un token de acceso personal de GitHub (no la contraseña de tu cuenta) — GitHub ya no acepta contraseña común para `git push` por HTTPS.

#### 📂 Estructura de Documentación del TP1

- **[`decisiones.md`](./decisiones.md):** Contiene la justificación técnica de por qué Git no pudo resolver el conflicto de forma automática, la estrategia de branching seleccionada, los problemas solucionados y la declaración explícita de uso de IA.
- **[`evidencias.md`](./evidencias.md):** Muestra las capturas de pantalla de los 4 momentos clave (Push directo rechazado, Aviso de conflicto en GitHub, Marcadores de conflicto `<<<<<<<` y Release publicada).

#### 🎓 Guía Rápida para la Defensa Oral (P1 - Clase 5)

| Pregunta de la Cátedra | Concepto / Respuesta Clave |
| :--- | :--- |
| **¿Por qué proteger `main` si trabajás solo?** | Aplica el concepto de *Policy as Code*. Los acuerdos del equipo no dependen de la memoria ni de la buena voluntad, sino de reglas automáticas de la plataforma. |
| **¿Por qué Git no pudo resolver el conflicto solo?** | Porque ambas ramas modificaron la misma línea del mismo archivo. Algorítmicamente (3-way merge), Git no puede adivinar qué versión vale sin arriesgarse a borrar trabajo; requiere una decisión humana de contenido. |
| **¿Qué es una rama en Git?** | No es una copia completa del proyecto, sino un puntero móvil ligero a un commit específico dentro del grafo del repositorio. Por eso crear ramas es instantáneo y barato. |
| **¿Por qué usaron Squash y Merge?** | Reemplaza todos los commits intermedios de una rama de feature por uno solo al integrar a `main`. Mantiene la rama principal limpia: `1 commit = 1 funcionalidad unificada`. |
| **¿Qué mide la versión `v1.0.0`?** | Aplica Versionado Semántico (`MAJOR.MINOR.PATCH`). Indica el primer hito estable y funcional del repositorio (*Baseline*). |

### TP2 — Contenedores

Se contenerizó esta misma app (backend + frontend + base de datos), construida sobre el repositorio y las protecciones que dejó el TP1.

#### Requisitos Implementados & Cumplimiento

1. **Dockerfiles multi-stage:**
   - Backend: etapa `build` (instala dependencias en un venv) + etapa `final` (solo runtime, sin herramientas de compilación).
   - Frontend: etapa `build` (Node, compila la SPA) + etapa `final` (nginx sirviendo los estáticos — el toolchain de Node no viaja a producción).
2. **Orquestación con Compose:**
   - Volumen nombrado (`db_data`) para persistencia de Postgres.
   - `depends_on` con `condition: service_healthy` — el backend espera a que la base esté lista, no solo iniciada.
   - Secretos vía `.env` no versionado, con `.env.example` commiteado.
3. **Reproducibilidad:** `docker compose up -d` levanta el sistema completo end-to-end con un solo comando — las migraciones de Django se aplican automáticamente al arrancar (`entrypoint.sh`), no requieren un paso manual.
4. **Publicación:** imágenes de backend y frontend publicadas en `ghcr.io`, con tag semver (`v0.1.1`) y visibilidad pública, verificadas con `docker pull` sin sesión iniciada.

#### 📂 Estructura de Documentación del TP2

- **[`decisiones.md`](./decisiones.md):** justificación de las imágenes base elegidas, la estructura multi-stage, qué persiste y qué no, y los problemas reales encontrados durante la contenerización (incluida una filtración de secretos que se detectó y corrigió).
- **[`evidencias.md`](./evidencias.md):** salidas de `docker compose up -d --build` desde cero, la prueba de persistencia (`down` conserva datos, `down -v` los borra), comparación de tamaño de imágenes, y las imágenes publicadas en el registry.

#### 🎓 Guía Rápida para la Defensa Oral

| Pregunta de la Cátedra | Concepto / Respuesta Clave |
| :--- | :--- |
| **¿Diferencia entre imagen y contenedor?** | La imagen es el paquete inmutable (capas de solo lectura); el contenedor es una instancia en ejecución de esa imagen, con su propia capa de escritura efímera. |
| **¿`CMD` vs `ENTRYPOINT`?** | `ENTRYPOINT` define el ejecutable fijo del contenedor; acá es `["./entrypoint.sh"]`, que corre `migrate` y después `exec gunicorn ...` — reemplaza el proceso para que gunicorn reciba las señales de Docker directamente. |
| **¿Por qué multi-stage?** | Separa lo necesario para *compilar/instalar* de lo necesario para *ejecutar*. En el frontend el ahorro es grande (Node completo vs. solo nginx + estáticos); en el backend el ahorro de tamaño es chico (Python no tiene un "SDK" tan pesado como .NET), pero igual aísla el paso de instalación para mejor cacheo. |
| **¿Qué pasa con los datos si borro el contenedor de la BD?** | Nada — persisten en el volumen nombrado `db_data`, que Docker administra aparte del contenedor. Solo `docker compose down -v` borra también el volumen. |
| **¿Cómo se encuentra el backend con la BD?** | Por nombre de servicio: `Host=db` en la connection string. Compose crea una red interna con DNS embebido donde cada servicio es alcanzable por su nombre. |
| **¿Por qué `depends_on` solo no alcanza?** | Solo garantiza el orden de *arranque* del contenedor, no que el proceso adentro ya acepte conexiones. El `healthcheck` (`pg_isready`) + `condition: service_healthy` esperan a que Postgres esté realmente listo. |
| **¿Por qué el `.env` no está en el repo?** | Porque tiene la contraseña real de la base. Se commitea solo `.env.example` (sin valores reales) y cada quien crea su propio `.env` local con `cp`. |

### TP3 — Planificación y trazabilidad

Se montó la gestión del proyecto sobre este mismo repositorio en GitHub Projects: jerarquía de trabajo, sprint, tablero y trazabilidad demostrable entre requerimientos y Pull Requests, sobre la app ya contenerizada (TP2) y el flujo de Git del TP1.

#### Requisitos Implementados & Cumplimiento

1. **Jerarquía de trabajo (issues + sub-issues):**
   - 1 épica: [`EPIC: Pipeline DevOps completo para mi app` (#15)](https://github.com/salvadorsolana04/club-tablada-devops/issues/15).
   - 1 historia de usuario con 4 criterios de aceptación, colgada de la épica: [`CI: build y tests automáticos en cada PR` (#16)](https://github.com/salvadorsolana04/club-tablada-devops/issues/16).
   - 2 tareas técnicas colgadas de la historia: [#17](https://github.com/salvadorsolana04/club-tablada-devops/issues/17) y [#18](https://github.com/salvadorsolana04/club-tablada-devops/issues/18).
   - 1 bug al costado de la jerarquía (no cuelga de ninguna historia): [#19](https://github.com/salvadorsolana04/club-tablada-devops/issues/19).
2. **Sprint y tablero:**
   - Proyecto público: [`IngSoft3 - Mi App DevOps`](https://github.com/users/salvadorsolana04/projects/1).
   - Sprint de 2 semanas (`Sprint 1`, campo Iteration), con la historia y sus 2 tareas asignadas.
   - Vista Board con columnas de flujo (`Todo` / `In Progress` / `Done`) y automatización mínima (`Item closed → Status: Done`, activa por defecto en todo Project nuevo).
   - Límite de trabajo en progreso: **2**, en la columna *In Progress*.
3. **Trazabilidad:**
   - [PR #20](https://github.com/salvadorsolana04/club-tablada-devops/pull/20) agrega `.github/workflows/ci.yml` (esqueleto que se completa en el TP4) y cierra automáticamente la tarea #17 vía `Closes #17` al mergearse.
   - Desde la tarea cerrada se navega al PR y su commit, y de ahí hacia arriba a la historia (#16) y la épica (#15).

#### 📂 Estructura de Documentación del TP3

- **[`decisiones.md`](./decisiones.md):** duración del sprint y su porqué, número del límite de WIP y su porqué, diagnóstico de la historia mal escrita, problemas encontrados (incluida la falta de soporte del CLI de `gh` para vistas/límites de Project) y declaración de uso de IA.
- No hay `evidencias.md` para este TP: el entregable es el [Project público](https://github.com/users/salvadorsolana04/projects/1), verificable en vivo por quien corrige.

#### 🎓 Guía Rápida para la Defensa Oral

| Pregunta de la Cátedra | Concepto / Respuesta Clave |
| :--- | :--- |
| **¿Diferencia entre épica, historia y tarea?** | Zoom: la épica es el objetivo del semestre (semanas/meses), la historia es un incremento de valor observable por un rol (días), la tarea es trabajo técnico concreto dentro de esa historia (horas). |
| **¿Por qué el bug no cuelga de la historia?** | Porque la jerarquía representa lo que se planificó construir; un bug es un defecto de algo **ya entregado**. Si aparece antes de cerrar la historia, no es un bug — es que la historia todavía no cumple sus criterios de aceptación. |
| **¿Por qué el número de la tarea y no el de la historia en `Closes #N`?** | El PR implementa una tarea concreta, no toda la historia. Si cerrara la historia, quedaría marcada como terminada con la otra tarea sin hacer — trazabilidad mentirosa. |
| **¿Qué te da GitHub Projects que un Trello no te da?** | El enlace es de datos, no manual: un PR puede cerrar el issue que lo originó, y el issue muestra en su historial qué PR/commits lo implementaron — sin que nadie tenga que actualizar dos herramientas a mano. |
| **¿Por qué 2 semanas de sprint y por qué límite de WIP 2?** | Ver `decisiones.md`, puntos 1 y 2 — justificado contra el ritmo de entregas de la cursada y la regla "personas + 1" trabajando solo. |



