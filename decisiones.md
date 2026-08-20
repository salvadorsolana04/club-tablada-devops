# Registro de Decisiones TÉCNICAS — TP1

## 1. Por qué Git no pudo resolver el conflicto automáticamente
Git aplica un algoritmo de integración de tres vías (3-way merge) comparando las dos ramas con su ancestro común. Dado que en las ramas `feature/titulo-a` y `feature/titulo-b` se modificó exactamente la misma línea del archivo `README.md` con contenido diferente, Git no puede asumir cuál versión es la correcta sin riesgo de perder cambios del equipo. Por este motivo, interrumpe el proceso automático y requiere una intervención humana para tomar la decisión de contenido.

## 2. Estrategia de Branching y Merge
Se adoptó la estrategia **GitHub Flow** utilizando la opción de **Squash and Merge** para integrar las ramas a `main`. Esto permite mantener un historial lineal y limpio en la rama principal, donde cada commit representa una funcionalidad completa e integrable.

## 3. Problemas Encontrados y Solución
- **Rechazo por desactualización local:** Al intentar realizar el primer push, se produjo un rechazo previo debido a que el repositorio remoto contenía archivos iniciales (`.gitignore`) no presentes localmente. Se resolvió sincronizando mediante `git pull origin main --rebase`.

## 4. Declaración de Uso de IA
Se utilizó **Claude Code** (Anthropic) como asistente de IA en dos frentes:

- **Desarrollo de la aplicación**: se usó Claude Code para generar y modificar código del backend (Django) y frontend (React) del proyecto Club La Tablada, incluyendo la reimplementación de la app y ajustes posteriores.
- **Proceso de resolución del TP1**: se usó Claude Code como copiloto para acelerar la comprensión del flujo de trabajo de Git/GitHub, la sintaxis de comandos en terminal macOS, el guiado en la creación y protección de ramas, y la resolución del conflicto de merge provocado a propósito.

En ambos casos, el código y los comandos generados fueron revisados y ejecutados por el estudiante, verificando su funcionamiento antes de commitear (corriendo la app localmente y comprobando el resultado de cada comando de Git contra lo esperado). El estudiante comprende y es capaz de defender de forma oral cada decisión técnica y configuración aplicada en el repositorio.

---

## TP2 — Contenedores

### 1. Elección de la app del semestre

La app usada es esta misma: **Club La Tablada**, un sistema de gestión para el club (autenticación con roles, feed de noticias, mensajería por división), con backend en Django REST Framework y frontend en React. Ya estaba elegida y en uso desde el TP1, así que el TP2 se resolvió contenerizando esta misma aplicación.

Contra los criterios de la guía:
- **¿Buildea y corre localmente hoy, sin magia?** Sí — corre tanto sin Docker (venv + npm, ver `README.md`) como con Docker.
- **¿Tiene o puede tener tests?** Sí, ya tiene tests en `core/tests.py` (`python manage.py test core`), necesarios para el TP5.
- **¿Se entiende el código lo suficiente para modificarlo?** Sí, es código propio escrito para la materia.
- **Tamaño:** 3 módulos (autenticación/roles, noticias, mensajes de división) — alcanza con CRUD + pantallas chicas, no sobra.

### 2. Decisiones de contenerización

- **Imágenes base:** `python:3.13-slim` para el backend, `node:22-alpine` (etapa de build) + `nginx:alpine` (etapa final) para el frontend, `postgres:16-alpine` para la base de datos. Se usaron variantes `slim`/`alpine` para minimizar tamaño y superficie de ataque.
- **Multi-stage del backend:** una etapa `build` instala las dependencias en un virtualenv (`/opt/venv`) con `pip install`; la etapa `final` solo copia ese venv y el código, sin dejar el índice/caché de pip. A diferencia de .NET (donde el SDK pesa mucho más que el runtime), en este caso la etapa `build` y la `final` terminan pesando casi lo mismo (~363 MB las dos, medido con `docker inspect --format='{{.Size}}'`), porque ni `Pillow` ni `psycopg[binary]` necesitaron compilar nada desde código fuente — ya vienen como *wheels* precompiladas, así que no hubo herramientas de compilación (gcc, etc.) que excluir en la etapa final. El multi-stage se mantiene igual porque aísla el paso de instalación (mejor cacheo: solo se reinstalan dependencias si cambia `requirements.txt`) y es la práctica correcta, aunque en este caso puntual no reduzca el tamaño final.
- **Multi-stage del frontend:** acá sí hay una diferencia real y grande: la etapa de build (`node:22-alpine`, con el toolchain completo de Node/npm) pesa 229 MB, y la imagen final (`nginx:alpine` + los estáticos de `npm run build`) pesa 93.4 MB — el SDK de Node no viaja a producción (~59% menos).
- **Qué persiste y qué no:** solo los datos de Postgres persisten, en el volumen nombrado `db_data` (montado en `/var/lib/postgresql/data`). Los contenedores de `backend` y `frontend` son descartables y se pueden recrear sin perder nada de lo que importa, porque no guardan estado propio. Limitación conocida y no resuelta en este TP: las imágenes que se suben a `MEDIA_ROOT` (fotos de noticias/mensajes) se perderían si se recrea el contenedor del backend, porque esa carpeta no está en un volumen — se resolvería agregando `backend/media:/app/media` a `docker-compose.yml`.
- **Comunicación entre servicios:** el backend se conecta a la base con `Host=db` (nombre del servicio en la red de compose), no con una IP fija — Docker resuelve ese nombre con su DNS interno. El frontend, en cambio, NO le habla directo al backend por nombre: el navegador ejecuta el JS del lado del cliente y no vive dentro de la red de compose. Por eso se usó **rutas relativas + proxy en nginx** (opción (a) de la guía, la recomendada): la SPA pide `/api/v1/...` sin host ni puerto, y es `frontend/nginx.conf` el que reenvía esas rutas a `http://backend:8000` (ahí sí vale el nombre de servicio, porque el que hace la petición es nginx, que corre dentro de la red de compose). Esto evita tener que configurar CORS para el flujo normal del navegador.
- **Servidor de aplicación:** se reemplazó `runserver` (servidor de desarrollo de Django) por `gunicorn` en el contenedor — es lo que recomienda la guía para el stack Python en producción.
- **Secretos:** viven en `.env` (raíz del repo, no versionado) y se leen en `docker-compose.yml` como `${VARIABLE}`. Se commitea solo `.env.example`, con los nombres de las variables y valores de ejemplo, nunca reales.

### 3. Problemas encontrados y cómo los resolví

- **El `.env` del backend terminó adentro de la imagen publicada.** El primer `backend/.dockerignore` no excluía `.env`, así que el `COPY . .` del Dockerfile copiaba el archivo (con `SECRET_KEY` incluido) adentro de la imagen — y esa imagen ya estaba publicada como pública en `ghcr.io`. Se comprobó corriendo `docker run --entrypoint sh <imagen> -c "cat /app/.env"`, y efectivamente devolvía el archivo completo. Se corrigió agregando `.env` a `backend/.dockerignore` (y a `frontend/.dockerignore`, por las dudas, aunque ahí no había filtración), y se republicaron las imágenes corregidas con el tag `v0.1.1`.
- **El backend no era multi-stage.** La primera versión del Dockerfile tenía todo en una sola etapa (`FROM python:3.13-slim` de punta a punta), lo cual no cumple el requisito explícito del TP2. Se separó en una etapa `build` (instala dependencias) y una etapa `final` (solo runtime).
- **Las migraciones no se aplicaban solas.** El `CMD` original solo corría `python manage.py runserver`; con una base de Postgres recién creada (vacía, como la que crea el compose en un clon limpio), el contenedor arrancaba sin tablas. Se detectó mirando los logs del backend (`You have 20 unapplied migration(s)`) y confirmando con `psql -c "\dt"` que las tablas de la app no existían. Se resolvió con `backend/entrypoint.sh`, que corre `python manage.py migrate --noinput` antes de arrancar el servidor — así, cualquiera que clone el repo y haga `docker compose up -d` tiene el sistema funcionando con un solo comando, tal como pide el TP.
- **Al cambiar de `runserver` a `gunicorn`, el admin de Django se quedó sin estilos.** `runserver` sirve los archivos estáticos automáticamente en modo `DEBUG`; `gunicorn` no sirve nada por su cuenta. Se agregó `whitenoise` (middleware + `collectstatic` durante el build de la imagen) para que el admin y el navegable de DRF se sigan viendo bien.
- **Un `docker build` falló una vez por timeout de red** al chequear la metadata de las imágenes base (`context deadline exceeded`) — no era un error del Dockerfile, sino de conectividad momentánea contra Docker Hub. Se resolvió reintentando el build.

### 4. Declaración de uso de IA (TP2)

Se usó **Claude Code** en todo el proceso de contenerización:
- Escritura inicial de los Dockerfiles, `.dockerignore`, `nginx.conf`, `docker-compose.yml` y `docker-compose.registry.yml`.
- **Auditoría posterior**: se le pidió a Claude Code que revisara lo ya resuelto por el estudiante contra el enunciado del TP2. Encontró los tres problemas detallados en la sección 3, verificándolos con comandos reales contra el sistema levantado (no una revisión solo teórica del código): corrió `docker run` para extraer el `.env` filtrado, leyó los logs de migraciones pendientes, e hizo la prueba de persistencia completa (`down`/`up` conserva datos, `down -v` los borra) antes y después de aplicar la corrección.
- Verificación propia del estudiante: se repitió a mano la prueba de persistencia y el login de los usuarios de prueba contra `http://localhost:3000` (a través del proxy de nginx, el mismo camino que usa la app real en el navegador) para confirmar que el sistema funciona de punta a punta, no solo que los comandos no tiraban error.
