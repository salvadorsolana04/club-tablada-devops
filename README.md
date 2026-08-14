# Club La Tablada

> **Materia:** Ingeniería del Software 3 — UCC 2026
> **Alumno:** Salvador Solana Allende
> **Instructor:** Ing. Ariel Schwindt
> **Versión Actual:** `v1.0.0` (TP1 Completo)

App web del Club La Tablada — proyecto de Ingeniería de Software 3 / DevOps.

Arquitectura liviana ("Vertical Slice") con 3 módulos:

1. **Autenticación y roles** — login con JWT, roles `jugador` / `entrenador` / `admin`.
2. **Feed de noticias** — lectura para todos, publicación solo para `admin`.
3. **Mensajes de división** — cada usuario ve solo los mensajes de su deporte/división; solo el `entrenador` de esa división puede publicar.

## Stack

- **Backend:** Python 3.13, Django 6, Django REST Framework, SimpleJWT, django-environ.
- **Frontend:** React 19 + Vite, Axios, React Router DOM, TailwindCSS.

## Puesta en marcha local

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
  config/       # settings, urls raíz
  core/         # modelos, serializers, views, permisos, tests
frontend/
  src/
    api/        # cliente axios con interceptor JWT
    context/    # AuthContext (sesión)
    pages/      # Login, Feed, Division
    components/ # Navbar, ProtectedRoute
```

## 🛠️ Estado del Pipeline — TP1: Git para Equipos y Cultura DevOps

En este trabajo práctico se configuró la infraestructura base de control de versiones y políticas de integración continua para el equipo de desarrollo.

### Requisitos Implementados & Cumplimiento:

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

### 📂 Estructura de Documentación del TP1

- **[`decisiones.md`](./decisiones.md):** Contiene la justificación técnica de por qué Git no pudo resolver el conflicto de forma automática, la estrategia de branching seleccionada, los problemas solucionados y la declaración explícita de uso de IA.
- **[`evidencias.md`](./evidencias.md):** Muestra las capturas de pantalla de los 4 momentos clave (Push directo rechazado, Aviso de conflicto en GitHub, Marcadores de conflicto `<<<<<<<` y Release publicada).

### 🎓 Guía Rápida para la Defensa Oral (P1 - Clase 5)

| Pregunta de la Cátedra | Concepto / Respuesta Clave |
| :--- | :--- |
| **¿Por qué proteger `main` si trabajás solo?** | Aplica el concepto de *Policy as Code*. Los acuerdos del equipo no dependen de la memoria ni de la buena voluntad, sino de reglas automáticas de la plataforma. |
| **¿Por qué Git no pudo resolver el conflicto solo?** | Porque ambas ramas modificaron la misma línea del mismo archivo. Algorítmicamente (3-way merge), Git no puede adivinar qué versión vale sin arriesgarse a borrar trabajo; requiere una decisión humana de contenido. |
| **¿Qué es una rama en Git?** | No es una copia completa del proyecto, sino un puntero móvil ligero a un commit específico dentro del grafo del repositorio. Por eso crear ramas es instantáneo y barato. |
| **¿Por qué usaron Squash y Merge?** | Reemplaza todos los commits intermedios de una rama de feature por uno solo al integrar a `main`. Mantiene la rama principal limpia: `1 commit = 1 funcionalidad unificada`. |
| **¿Qué mide la versión `v1.0.0`?** | Aplica Versionado Semántico (`MAJOR.MINOR.PATCH`). Indica el primer hito estable y funcional del repositorio (*Baseline*). |

## Subir tus cambios a GitHub (git push)

Desde la raíz del repo:

```bash
git status
```

Revisá qué archivos cambiaron antes de subir nada. Después:

```bash
git add .
```

```bash
git commit -m "Descripción breve de lo que cambiaste"
```

```bash
git push origin main
```

Notas:

- `git status` te muestra en gris/rojo los archivos modificados o nuevos. Los archivos como `backend/.env`, `backend/db.sqlite3`, `backend/media/`, `backend/.venv/` y `frontend/node_modules/` **no van a aparecer** — están en `.gitignore` a propósito, no se suben.
- Si `git push` rechaza el push porque el remoto tiene commits que vos no tenés localmente, corré primero `git pull origin main` y resolvé conflictos si aparecen, y recién ahí repetí el `git push`.
- Si es tu primera vez configurando git en esta máquina, puede pedirte usuario/contraseña o un token de acceso personal de GitHub (no la contraseña de tu cuenta) — GitHub ya no acepta contraseña común para `git push` por HTTPS.
