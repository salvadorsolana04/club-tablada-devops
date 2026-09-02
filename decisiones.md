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

---

## TP3 — Planificación y trazabilidad

### 1. Duración del sprint

Se eligió un sprint de **1 semana (7 días)**. Cada TP de la materia se entrega aproximadamente cada semana, y en este repositorio cada sprint mapea a un TP: el Sprint Goal es "cerrar el TP de la semana", así que la duración del sprint sigue directamente el ritmo real de entregas en vez de un número arbitrario. Un sprint más largo (dos semanas o un mes) desalinearía el sprint del calendario real de la cursada — el TP quedaría a mitad de un sprint que todavía no cerró.

### 2. Límite de trabajo en progreso

Se configuró un **límite de 2** en la columna *In Progress*. Es la regla de arranque de la guía (personas + 1) aplicada a trabajar solo: 1 persona + 1 de margen para no bloquearse cuando algo queda esperando (una revisión, una respuesta, un `docker build` corriendo) y hay que poder avanzar en otra cosa sin que eso signifique tener tres o cuatro tareas a medio terminar en simultáneo. Señal para subirlo: si la columna nunca llega a 2, es porque en la práctica ya estoy trabajando de a una — bajarlo a 1 sería más honesto con el flujo real; para subirlo haría falta evidencia de que 2 frena trabajo real y no elección apurada.

### 3. Diagnóstico de la historia mal escrita

`Como desarrollador quiero crear la tabla usuarios para guardar los datos` **no es una historia, es una tarea disfrazada**: el "quiero" describe una acción técnica de implementación (crear una tabla), no una capacidad observable por un usuario real — ningún stakeholder pide una tabla, la pide como medio para algo. Tampoco es *Valuable* ni *Testeable* en el sentido de la guía: no hay forma de escribir un criterio de aceptación verificable por alguien ajeno al código ("¿la tabla quedó bien creada?" no es una pregunta que le importe al cliente).

Reescrita como historia de verdad: *Como usuario del club quiero registrarme con usuario y contraseña para poder acceder a las noticias y mensajes de mi división.* Ahí sí hay rol, capacidad observable (puedo registrarme y entrar) y beneficio (acceso al contenido de mi división) — y "crear la tabla usuarios" pasa a ser una de las **tareas técnicas** dentro de esa historia, no la historia en sí.

### 4. Problemas encontrados y cómo los resolví

- **`gh` (GitHub CLI) no estaba instalado y Homebrew estaba roto** en esta máquina (`brew` no reconoce la versión de macOS instalada, `unknown or unsupported macOS version: "26.2"`, y falla antes de poder instalar nada). Se resolvió descargando el binario de `gh` directo desde los releases de GitHub (`gh_2.99.0_macOS_arm64.zip`) y copiándolo a `~/.local/bin`, que ya estaba en el `PATH`.
- **El token de `gh` no tenía el scope `project`.** `gh auth login` pide explícitamente los scopes al loguearse (`--scopes "project,repo,read:org"`); se autenticó con el flujo por navegador (device code), como indica la guía.
- **El CLI de `gh` no cubre todo lo que pide el TP.** `gh project` no tiene forma de crear una vista Board, agrupar por `Status`, ni configurar el límite de WIP de una columna — esas operaciones no están expuestas ni por el CLI ni por la API GraphQL pública de Projects (se confirmó introspeccionando el schema: no existe mutación para límites de columna, y `updateProjectV2View` no acepta un campo de agrupamiento). Se resolvió a medias: la vista Board y el campo Sprint (Iteration) sí se pudieron crear llamando directo a la API GraphQL (`gh api graphql`, mutaciones `createProjectV2View` y `createProjectV2Field`); el límite de WIP de la columna *In Progress* y la confirmación visual del agrupamiento por `Status` quedaron como el único paso manual, hecho una vez desde la web del proyecto.
- **Mergear el PR de trazabilidad requirió confirmación explícita.** El modo automático de Claude Code bloquea por política cualquier acción que modifique estado compartido/visible (como mergear a `main`), aunque el resto del TP se hizo sin supervisión — se pidió confirmación antes de ese paso puntual.
- **Cambiar la duración del sprint de 2 a 1 semana desasignó la historia y sus tareas del sprint.** El campo Sprint es un campo *Iteration*, y su configuración (duración, iteraciones) se reemplaza entera al editarla vía API — la iteración "Sprint 1" quedó con un ID interno nuevo, y los items que apuntaban al ID viejo perdieron la asignación (se confirmó con `gh project item-list`, que mostraba `sprint: None` en los tres). Se resolvió reasignando la historia y sus dos tareas a la iteración nueva con `gh project item-edit --iteration-id`.

### 5. Declaración de uso de IA (TP3)

Se usó **Claude Code** para resolver el TP3 de punta a punta, de forma autónoma (el estudiante dio el objetivo y se ausentó durante la ejecución): instalación y autenticación de `gh` CLI, creación de las tres labels (`epic`/`story`/`task`), creación de la épica, la historia (con sus 4 criterios de aceptación), las 2 tareas, el bug y su jerarquía como sub-issues; creación del Project público, el campo Sprint (Iteration, vía API GraphQL porque el CLI no lo soporta) y la asignación de la historia y sus tareas a `Sprint 1`; la vista Board; y el workflow `ci.yml` esqueleto + el Pull Request (#20) que cierra la tarea #17 con `Closes #17`.

Verificación: se revisó el diff del PR antes de mergear (`gh pr diff`), se confirmó por API que la jerarquía quedó bien enlazada (`subIssuesSummary` de la épica y la historia) y que el Project quedó en visibilidad pública (`gh project view --format json`). El estudiante debe poder explicar en la defensa por qué eligió esa duración de sprint y ese límite de WIP (puntos 1 y 2 de arriba, redactados por el estudiante en base a la regla de la guía, no generados por la IA), y diagnosticar en vivo una historia mal escrita como se hizo en el punto 3.

---

## TP4 — CI: Pipelines as Code

### 1. Estructura del pipeline

Dos jobs (`build-backend`, `build-frontend`) en paralelo, uno por cada Dockerfile del TP2 — la app ya está partida en dos servicios independientes, con su propio contexto de build, así que un solo job mezclando ambos no aportaría nada y sería más lento (los jobs de GitHub Actions corren en runners separados sin compartir filesystem: no hay forma de "compartir trabajo" entre un build de backend y uno de frontend, son builds independientes de entrada). El pipeline dispara en `pull_request` hacia `main` (la corrida que importa: verifica *antes* de mergear) y en `push` a `main` (la que le da estado al badge y deja el cache disponible para el próximo PR). Todavía no corre tests — eso es el TP5 — así que hoy el pipeline verifica una sola cosa: que las dos imágenes se construyan sin errores en una máquina limpia.

### 2. Qué cachea el pipeline y qué pasa si el cache desaparece

Se cachean las **capas de Docker** de cada imagen (`cache-from`/`cache-to: type=gha`), con un `scope` distinto por job (`backend` / `frontend`) para que no se pisen entre sí — sin ese scope los dos jobs comparten el mismo estante y el que termina último borra el cache del otro. Se verificó en una segunda corrida del mismo PR (después de que la primera terminara de subir su cache): el log mostró `CACHED` en las capas de dependencias de los dos jobs (`docker/build-push-action`, pasos de `pip install` y `npm ci`), que no habían cambiado entre una corrida y la otra.

El cache es una optimización, no una dependencia: GitHub puede desalojarlo en cualquier momento (tiene límite de tamaño y antigüedad), y el pipeline tiene que funcionar exactamente igual sin él — solo más lento, reconstruyendo esas capas desde cero. Si el build fallara por la sola ausencia de cache, no era un cache: era una dependencia escondida.

### 3. Por qué el pipeline construye con el Dockerfile en vez de compilar por su cuenta

Porque el Dockerfile del TP2 **ya es** la definición de build de la app — es lo que corre en desarrollo y lo que correría en un despliegue real. Si el workflow compilara aparte (por ejemplo corriendo `pip install` y `npm run build` directo en el runner, sin pasar por las imágenes), habría dos definiciones de "cómo se construye la app" que tarde o temprano divergen, y el pipeline estaría verificando algo distinto de lo que después se ejecuta. Usando el mismo Dockerfile, lo que se verifica en el PR es exactamente lo mismo que se va a correr — no una aproximación.

### 4. Problemas encontrados y cómo los resolví

- **El `ci.yml` del TP3 ya no servía de base.** Era un esqueleto con un solo job `build` que solo hacía `checkout`; se reemplazó entero por los dos jobs reales (`build-backend`/`build-frontend`), tal como avisa la guía — nada del TP3 se reutilizó del archivo, solo la ruta.
- **Activar el gate (`required_status_checks`) requirió confirmación explícita**, igual que mergear a `main`: el modo automático de Claude Code bloquea cambios a la configuración del repositorio (branch protection) sin autorización puntual del estudiante, aunque el resto del TP se hizo sin supervisión.
- **La demo del gate necesitaba el workflow real ya mergeado en `main`.** Si se abre el PR de "romper el build" antes de mergear el PR con los jobs reales, el PR de la demo corre contra el `ci.yml` viejo del TP3 (el que solo hace checkout) y da verde con código que no construye — exactamente la advertencia de la guía. Se ordenó la secuencia para mergear primero el pipeline real.
- **Ver el efecto de `strict: true` (rama desactualizada) necesitó dos PRs abiertos a la vez.** Con uno solo no se puede observar: al mergear el primero, el segundo pasó a `mergeStateStatus: BEHIND` recién ahí — confirmado por API (`gh pr view --json mergeable,mergeStateStatus`) antes y después de actualizar la rama (`gh api --method PUT .../pulls/25/update-branch`), sin necesidad de captura de pantalla porque el TP no pide `evidencias.md` (el repo es público).
- **La dependencia falsa para romper el build** (`paquete-que-no-existe-xyz123` en `requirements.txt`) se agregó primero sin salto de línea al final del archivo, lo que la fusionaba con la línea anterior en un único requirement inválido — rompía igual, pero por una razón distinta a la buscada (línea malformada, no paquete inexistente). Se corrigió el formato antes de pushear, para que el fallo real sea el que pide la consigna (falla la resolución de la dependencia, no un requirements.txt mal armado).

### 5. Declaración de uso de IA (TP4)

Se usó **Claude Code** para resolver el TP4 de punta a punta, de forma autónoma: reemplazo completo del `ci.yml`, apertura y seguimiento de los 4 Pull Requests (jobs + cache, gate de branch protection vía API, demo del build roto con su PR de relleno, y el badge), y la verificación de cada checkpoint por API/CLI en vez de mirar la web a mano — `gh pr checks` para el estado de cada corrida, `gh run view --log | grep CACHED` para confirmar el cache, y `gh pr view --json mergeable,mergeStateStatus` para confirmar `BLOCKED` con el build roto y `BEHIND`→`CLEAN` con el gate y `strict: true`.

Verificación del estudiante: revisó el diff de cada PR antes de autorizar el merge (pedido explícitamente en cada uno, ver problema 2 de arriba) y puede reproducir en vivo, en la defensa, la secuencia completa rojo→bloqueado→fix→verde sobre el PR #24 y explicar por qué el gate exige esos dos checks puntuales y no otros.
