# Enlaces de este TP6 — CD: environments, aprobaciones y deployment patterns

**a) Los dos paquetes públicos del registry** (se bajan sin credenciales):

- Backend: https://github.com/users/salvadorsolana04/packages/container/package/club-tablada-devops-backend
- Frontend: https://github.com/users/salvadorsolana04/packages/container/package/club-tablada-devops-frontend

Los dos están etiquetados con el commit de cada merge a `main`. Por ejemplo, con el commit `bc1551f` (merge del PR #40):

```bash
docker pull --platform linux/amd64 ghcr.io/salvadorsolana04/club-tablada-devops-backend:sha-bc1551f704a6335e2eb3d5d415371e4c8a450685
docker pull --platform linux/amd64 ghcr.io/salvadorsolana04/club-tablada-devops-frontend:sha-bc1551f704a6335e2eb3d5d415371e4c8a450685
```

**b) Los dos enlaces de la cadena** (Tarea 1):

1. Corrida del PR #36 con los tests en verde, abierta en el job que publica, donde «Entrar al registry» aparece **salteado**: https://github.com/salvadorsolana04/club-tablada-devops/actions/runs/36732522267/job/109945613875
2. Lista de pasos de la corrida de `main` de ese mismo merge, donde «Construir y publicar la imagen del backend» es el **último** de mis pasos, después de los tests: https://github.com/salvadorsolana04/club-tablada-devops/actions/runs/36732694695/job/109946216756

**c) Las URLs de los dos entornos:**

| | Front (la app) | API (`/api/v1/health/` dice qué commit corre) |
|---|---|---|
| **QA** | https://club-tablada-front-qa.onrender.com | https://club-tablada-api-qa.onrender.com/api/v1/health/ |
| **PROD** | https://club-tablada-front-prod.onrender.com | https://club-tablada-api-prod.onrender.com/api/v1/health/ |

Están en el plan gratuito de Render: si llevan más de 15 minutos sin tráfico, el primer pedido tarda unos 40 segundos en despertarlos (ver TP6 §6).

**Corridas del gate hacia producción:**

- Flujo completo aprobado (QA verde → *Waiting for review* → aprobación → PROD verde), con el cambio visible del subtítulo del login: https://github.com/salvadorsolana04/club-tablada-devops/actions/runs/36929258613
- Corrida **rechazada**, con su motivo: https://github.com/salvadorsolana04/club-tablada-devops/actions/runs/36927235474

---



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

En ambos casos, el código y los comandos generados fueron revisados y ejecutados, verificando su funcionamiento antes de commitear (corriendo la app localmente y comprobando el resultado de cada comando de Git contra lo esperado).

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

---

## TP3 — Planificación y trazabilidad

### 1. Duración del sprint

Se eligió un sprint de **2 semanas (14 días)**. Trabajando solo y con los TPs de la materia entregándose cada 1-2 semanas, un sprint semanal generaría casi tanto overhead de planificación como trabajo real hecho; uno de un mes diluye demasiado el objetivo del sprint y tapa señales de atraso hasta muy tarde. Dos semanas da margen para terminar una historia completa (historia + 2 tareas) sin que el sprint quede vacío de contenido, y se alinea razonablemente con el ritmo de entregas quincenal/semanal de la cursada.

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
- **Editar la configuración del campo Sprint (Iteration) vía API reasigna un ID interno nuevo a la iteración.** Se descubrió al revisar distintas duraciones de sprint antes de confirmar la definitiva: cada vez que se edita `iterationConfiguration`, la iteración "Sprint 1" queda con un ID nuevo, y los items que apuntaban al ID anterior pierden la asignación (se confirmó con `gh project item-list`, que mostraba `sprint: None`). Se resolvió reasignando la historia y sus dos tareas a la iteración vigente con `gh project item-edit --iteration-id` cada vez.

### 5. Declaración de uso de IA (TP3)

Se utilizó **Claude Code** (Anthropic) como herramienta asistente y copiloto en la gestión de proyectos y trazabilidad:

- **Configuración y CLI**: asistencia en la formulación de comandos de GitHub CLI (`gh project` y `gh issue`) para automatizar la creación de etiquetas, issues jerárquicos y vinculación de sub-issues desde la terminal, asegurando la consistencia con las convenciones de la plataforma.
- **Validación del paso a paso**: se utilizó como guía de control y auditoría en tiempo real para verificar que cada paso de la consigna se ejecutara en el orden correcto (creación de jerarquía, configuración de vistas y automatizaciones en GitHub Projects, y estructura del workflow inicial de CI).
- **Revisión de trazabilidad**: verificación de la sintaxis y alcance de la directiva `Closes #<tarea>` en la descripción del Pull Request, asegurando que cerrara de forma efectiva únicamente la tarea técnica correspondiente sin transicionar prematuramente la historia de usuario padre.

**Verificación propia**:
Cada comando, issue y configuración fue ejecutado, auditado y probado manualmente. Se comprobó en modo incógnito la visibilidad pública del tablero de GitHub Projects, se navegó la jerarquía padre-hijo (Épica → Historia → Tareas) para constatar que los sub-issues reflejaran el progreso real, y se validó en la interfaz web de GitHub que el merge del Pull Request cerrara automáticamente el issue en el tablero moviéndolo a *Done*.

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

### Declaración de uso de IA (TP4)

Se usó Claude Code para la asistencia de ejecucion en los pasos TP4 completo. Hoy el pipeline solo construye las dos imágenes — no corre tests ni lint ni publica artefactos, porque eso es explícitamente el TP5.

Verificación propia: revisé el diff de cada Pull Request antes de autorizar el merge (cada uno requirió mi confirmación explícita antes de aplicarse), miré correr el pipeline en la pestaña Actions, y confirmé el cache buscando la palabra CACHED en el log de la segunda corrida. Puedo reproducir en vivo, en la defensa, la secuencia rojo→bloqueado→fix→verde sobre el PR que rompió el build, y explicar por qué el gate exige esos dos checks puntuales.

## TP5 — Calidad automatizada: tests, coverage y el umbral que frena un merge

### 1. Qué lógica elegí testear y por qué ESA

Donde duele un bug en esta app no es en mostrar una noticia, es en **quién puede hacer qué** y **quién ve qué**: un jugador que publica como entrenador, un comunicado de rugby M19 que le llega a hockey Primera, o alguien que borra el mensaje de otro. Por eso la suite del backend se concentra en cuatro reglas:

1. **Permisos por rol** — solo `admin` publica noticias, solo `entrenador` publica comunicados; cualquiera autenticado lee, y un anónimo no.
2. **Visibilidad por división** — cada usuario ve únicamente los comunicados de su deporte y división.
3. **Límite diario** — un entrenador manda como máximo 3 comunicados por día.
4. **Borrado** — solo el emisor borra su comunicado, y solo dentro de las 24 hs.

Más la validación del modelo (`Usuario.clean`): jugador y entrenador requieren deporte y división; admin no (caso borde).

La app ya traía 16 tests en `core/tests.py` escritos cuando se reimplementó, pero **el pipeline del TP4 no los corría**. Además, casi todos pasan por HTTP y por la base (`APITestCase`): en la pirámide son de **integración**, no unitarios. Los unitarios de verdad son los 7 nuevos de `core/test_reglas.py`, que no tocan base ni red y corren en centésimas de segundo.

**Frontend** (la app tiene frontend separado, así que los mínimos del front aplican): el componente `Division.jsx` decide si mostrar el botón de borrar (`sePuedeBorrar`, espejo de la regla 4 del backend) y arma el envío del comunicado (título, mensaje y foto opcional). Son las dos piezas con lógica de verdad del front; el resto es presentación. Los 12 tests de `src/lib/comunicados.test.js` corren en Node, sin DOM (17 después de la demo del §8, que sumó `tiempoParaBorrar` con sus 5 tests).

### 2. Refactor para poder mockear

Las reglas de límite diario y de borrado estaban escritas **adentro de las views**, llamando directamente a `MensajeDivision.objects.filter(...).count()` y a `timezone.now()`. No había por dónde meter un doble: para testearlas había que levantar la base, crear mensajes reales y, para el borde de las 24 hs, manipular fechas con un `update()`.

Las saqué a `core/reglas.py` y las dependencias entran desde afuera:

- `validar_limite_diario(usuario, contar_mensajes_hoy)` — el contador es un parámetro. En producción la view le pasa la función real que consulta la base (`contar_mensajes_hoy` en `views.py`); en el test le paso un `Mock(return_value=3)`.
- `validar_borrado(mensaje, usuario, ahora)` — la hora actual es un parámetro, así el test fija "exactamente 24 hs después" sin depender del reloj.

Las views quedaron como cableado (`validar_borrado(instance, self.request.user, timezone.now())`). Los 16 tests existentes, que pasan por HTTP, siguieron en verde después del refactor: el comportamiento de la API no cambió.

**En el frontend, el mismo problema:** `sePuedeBorrar` llamaba adentro a `Date.now()`, y el armado del `FormData` + `api.post(...)` vivía dentro del `handleSubmit` del componente — para probarlo había que renderizar la pantalla y tener la API levantada. Lo saqué a `src/lib/comunicados.js`:

- `sePuedeBorrar(mensaje, usuario, ahora = Date.now())` — la hora entra por parámetro.
- `enviarComunicado({ titulo, mensaje, foto }, cliente)` — el cliente HTTP entra por parámetro. `Division.jsx` le pasa la instancia real de axios (`enviarComunicado({ titulo, mensaje, foto }, api)`); el test le pasa `{ post: vi.fn().mockResolvedValue(...) }` y verifica **qué le pidió** (la ruta, que el `FormData` lleve título y mensaje, y que no lleve foto si no hay).

Como los unit tests no ven el cableado (si `Division.jsx` llamara mal a la función, la suite seguiría verde), lo verifiqué además en la app levantada en local: enviar un comunicado (POST `201`), ver que aparece con el botón de borrar, y borrarlo (DELETE `204`).

**Mock vs stub en mi suite:** el mensaje y el usuario de `test_reglas.py` son *stubs* (`SimpleNamespace` con los atributos justos: solo devuelven datos). El contador es un *mock*: en `test_limite_diario_permite_por_debajo_del_maximo_y_consulta_por_ese_usuario` además de devolver un valor, verifico **cómo lo usaron** (`assert_called_once_with(EMISOR)`: la regla le preguntó por ese usuario, una sola vez).

### 3. ¿Los tests verifican algo? Invertí las reglas a propósito

Criterio de la consigna: si cambio la regla, algún test tiene que ponerse en rojo. Lo comprobé mutando `reglas.py` a mano, de a un cambio por vez:

| Mutación | Tests en rojo | Quién la atrapa |
|---|---|---|
| Borrado: `>` → `>=` | 1 | **solo** el nuevo `[justo-24h]` |
| Límite: `>=` → `>` | 2 | uno viejo y uno nuevo |
| Emisor: `!=` → `==` | 8 | viejos y nuevos |

La primera fila es el hallazgo: **con los 16 tests originales, correr el borde de `>` a `>=` pasaba en verde.** Probaban un mensaje reciente y uno de 25 hs, pero nadie miraba el borde exacto de 24 hs. El test parametrizado lo cubre explícitamente (1h, 23h59m, justo 24h, 24h+1s).

**En el frontend, los tests encontraron dos bugs reales antes de mutar nada.** Escribí los tests contra `sePuedeBorrar` copiada tal cual del componente, y dos quedaron en rojo:

1. **Borde de 24 hs inconsistente con el backend**: el front usaba `< 24h` (a las 24 hs exactas esconde el botón) y el backend rechaza recién con `> 24h` (a las 24 hs exactas deja borrar). La misma regla, aplicada distinto en cada lado. Alineé el front al backend (`<=`), que es la fuente de verdad.
2. **Sin usuario y sin emisor, mostraba el botón**: `undefined?.username !== null?.username` es `undefined !== undefined` → `false`, así que el chequeo de "es tuyo" no frenaba y decidía solo por la fecha. Hoy no se da en la práctica (`ProtectedRoute` no deja entrar sin usuario), pero la función, sola, estaba mal. Se agregó `!usuario ||` al principio.

Después, las mutaciones sobre el código ya corregido:

| Mutación (frontend) | Tests en rojo |
|---|---|
| Borde: `<=` → `<` | 1 (`justo 24h`) |
| Quitar el chequeo `!usuario \|\|` | 1 (`sin emisor y sin usuario`) |
| Emisor: `!==` → `===` | 5 |
| Adjuntar la foto siempre (sin el `if`) | 1 (el del mock: `has('foto')`) |
| Ruta del POST equivocada | 1 (el del mock: verifica la ruta) |

Las dos últimas solo las atrapa el test con mock: son errores en **qué se le pide a la API**, que no cambian nada de lo que la función devuelve.

### 4. Herramientas (mi stack no es el de la cátedra)

El backend es **Django (Python)**, no .NET; el frontend es React + Vite (JS), así que ahí sí aplica vitest como en la guía. Lo que usé para cada fila de la tabla «Tu stack, de un vistazo»:

| Lo que pide la tabla | Backend (Django) | Frontend (React + Vite) |
|---|---|---|
| Dónde viven los tests | `core/tests.py` (integración, ya existían) y `core/test_reglas.py` (unitarios) | al lado del código: `src/lib/comunicados.test.js` |
| Runner | `pytest` + `pytest-django` (corre también los `TestCase` de Django sin reescribirlos), configurado en `backend/pytest.ini` | `vitest` 5 (`npm test`), entorno Node, sin DOM |
| Test parametrizado | `@pytest.mark.parametrize` | `it.each` |
| Que la dependencia entre desde afuera | parámetro de la función (`contar_mensajes_hoy`, `ahora`) | parámetro de la función (`cliente`, `ahora`) |
| Fabricar el doble | `unittest.mock.Mock` | `vi.fn()` |
| Medir la cobertura | `pytest-cov` (coverage.py) con `branch = True` | `@vitest/coverage-v8` (5.0.2, la misma versión que vitest) |
| 🔴 Un umbral que ROMPE el build | `fail_under = 90` en `backend/.coveragerc` (pytest sale con error) | `coverage.thresholds: { lines: 90, branches: 90 }` en `vite.config.js` |
| 🔴 Qué ENTRA en la cuenta | `omit =` en `backend/.coveragerc` (se excluye; lo nuevo entra solo) | `include: ['src/lib/**']` en `vite.config.js` |
| Reporte legible | `--cov-report=html` + `json` (el pipeline arma la tabla del Summary desde el JSON) | reporters `html`, `lcov` y `json-summary` (el Summary sale de `coverage-summary.json`) |
| 🔴 Que las herramientas de test ENTREN a la etapa de tests | la etapa `test` instala `requirements-dev.txt`; `final` copia el venv desde `build`, así pytest no llega a producción | `npm ci` sin `--omit=dev` en `build`; la imagen final es nginx con los estáticos, no lleva `node_modules` |

### 5. Cobertura: qué entra en la cuenta y el umbral

**Qué dejé afuera de la cuenta, y por qué.** En los dos lados se **excluye** (y no se incluye) lo que no es lógica mía, para que un archivo nuevo entre a la cuenta solo: si mañana alguien agrega `core/algo.py` sin tests, el número baja y el gate avisa. Lo verifiqué agregando un archivo temporal sin tests de cada lado: los dos entraron a la medición y los dos frenaron.

- **Backend** (`backend/.coveragerc`, `omit`):
  - **el arranque**: `config/*` (settings, rutas raíz, wsgi/asgi) y `manage.py`;
  - **lo generado**: `*/migrations/*`, que escribe `makemigrations`;
  - **los tests**, que no se miden a sí mismos;
  - **lo declarativo sin reglas**: `admin.py` (registro en el admin), `apps.py` (AppConfig), `core/urls.py` (rutas) y `serializers.py` (mapeo de campos, el equivalente a los DTOs). `models.py` **queda adentro** porque tiene una regla (`Usuario.clean`).
- **Frontend** (`vite.config.js`, `include: ['src/lib/**']`): entra la lógica extraída; los componentes React (presentación) quedan afuera — la UI se verifica end-to-end en el TP7. Con `include`, todo archivo de `src/lib` cuenta aunque ningún test lo importe.

**En Django, medir todo *infla* el número en vez de hundirlo.** Sin exclusiones daba 92 %, pero porque `settings.py`, las migraciones, `admin.py` y `urls.py` se ejecutan solos al arrancar Django y salen al 100 % sin que ningún test los verifique (el caso inverso al ejemplo .NET de la guía, donde el arranque sin tests arrastraba el número al 30 %). Con las exclusiones mide 4 archivos con lógica: `models`, `permissions`, `reglas` y `views`.

**Los números** (el umbral lo elegí sobre la primera fila de cada lado):

| | Líneas | Ramas | Líneas + ramas | Umbral |
|---|---|---|---|---|
| Backend, suite de la Tarea 1 | 95,19 % (99/104) | **92,86 % (13/14)** | 94,92 % (112/118) | 90 sobre líneas + ramas juntas |
| Backend, **hoy** (con el test del camino sin cubrir, §7) | 96,15 % (100/104) | **100 % (14/14)** | 96,61 % (114/118) | ídem |
| Frontend, suite de la Tarea 1 | 100 % (8/8) | **100 % (7/7)** | — | 90 en líneas y 90 en ramas |
| Frontend, **hoy** (con `tiempoParaBorrar` y sus tests, §8) | 100 % (19/19) | **100 % (16/16)** | — | ídem |

Lo que sigue sin cubrir en el backend son los `__str__` de los tres modelos y `PerfilView.get` (`/perfil/`): líneas sin decisiones adentro, que no suman ramas.

**Por qué 90 en el backend, y sobre qué métrica.** Con `branch = True`, el `fail_under` de coverage.py no mira las líneas solas: evalúa `(líneas cubiertas + ramas cubiertas) / (líneas + ramas)`. O sea, el umbral ya incluye las ramas, que es la métrica más honesta; en el Summary igual muestro líneas y ramas por separado. Cuando lo elegí medía 94,92 %: el 90 deja ~5 puntos de margen para el día a día, pero una función nueva sin tests de unas 7 líneas/ramas ya lo pone en rojo (lo probé: una función de 8 líneas y 6 ramas sin tests lo bajó a 84,85 % y frenó). Un umbral pegado a la medición (94) frenaría por cualquier cambio mínimo; uno lejano (70) dejaría entrar funciones enteras sin tests. **Para subirlo** a 95 sin que quede pegado habría que testear `/perfil/` y los `__str__`, y aun así sería un umbral que frena por dos líneas: con una base de 118 unidades, cada punto son ~1,2 líneas o ramas.

**Por qué 90 en el frontend, y qué mide de verdad.** El 100 % es real pero chico: mide **un solo archivo** (`comunicados.js`, 8 líneas y 7 ramas). Con una base tan chica, cualquier archivo nuevo en `src/lib` sin tests lo hunde (lo probé: uno de 5 líneas lo bajó a 66,66 % de líneas y 53,84 % de ramas). **Lo que no mide**: en `src/api/axios.js` queda lógica sin testear — el interceptor que ante un 401 borra los tokens y redirige a `/login`. Si incluyo `src/api/**`, el front baja a 34,78 % de líneas y 46,66 % de ramas. **Para ampliar la medición** habría que sacar esa lógica a `src/lib` recibiendo `localStorage` y `window.location` por parámetro (el mismo refactor que `enviarComunicado`), testearla con dobles, e incluirla. Lo dejé documentado en vez de esconderlo: el 100 % del front dice "la lógica extraída está verificada", no "el front está verificado".

**Cómo frena.** La cobertura corre **adentro de los mismos jobs** del TP4 (`build-backend` y `build-frontend`), que ya son required checks de `main`: una etapa `test` en cada Dockerfile (`FROM build AS test`) que el job construye y corre. Si el número no llega, pytest/vitest salen con error → el `docker run` también → el job queda rojo → el merge se bloquea. La etapa `final` de cada imagen no se lleva nada de test: el backend copia el venv desde `build` (no desde `test`), y el frontend sigue siendo nginx con los estáticos.

**Dónde verlo** — el resumen de cobertura (Summary de la corrida, tablas de backend y frontend) y los reportes descargables (artefactos `coverage-backend` y `coverage-frontend`, con el HTML navegable, el JSON y el resultado de los tests): la corrida verde del PR de las Tareas 1 y 2, https://github.com/salvadorsolana04/club-tablada-devops/actions/runs/36255877311 ([PR #31](https://github.com/salvadorsolana04/club-tablada-devops/pull/31)).

### 6. Por qué coverage alto no garantiza calidad (mi ejemplo)

**Con solo los 16 tests que traía la app, `core/reglas.py` da 100 % de líneas y 100 % de ramas (6/6)** — la regla de borrado tiene un test con un mensaje reciente (rama "se puede") y otro con uno de 25 hs (rama "vencido"). Y sin embargo, si cambio `ahora - mensaje.fecha > VENTANA_BORRADO` por `>=`, **los 16 siguen en verde y la cobertura sigue en 100 %**: nadie prueba el borde exacto de 24 hs. Lo medí: el total del backend da exactamente lo mismo (95 %) con y sin mis 7 tests nuevos de `test_reglas.py`. Esos 7 **no suman ni un punto de cobertura**, y son los únicos que atrapan ese mutante (el `[justo-24h]` del parametrizado).

La cobertura mide que la línea **se ejecutó**, no que alguien **verificó** lo que hace en el caso que importa. Un 100 % dice "no hay código que ningún test toque"; no dice "no hay comportamiento que ningún test compruebe". Por eso la cobertura baja es una señal confiable (hay agujeros), y la alta no lo es.

El mismo efecto, del otro lado: en Django, medir todo sin exclusiones daba 92 % porque la configuración y las migraciones se ejecutan solas al arrancar (§5). Cobertura sin un solo assert.

### 7. El ejercicio del camino sin cubrir

- **Qué línea es**: `backend/core/views.py`, en `MensajeDivisionListCreateView.get_queryset`, el `return MensajeDivision.objects.none()` del `if not usuario.deporte or not usuario.division:`. El reporte de coverage la marcaba como línea sin cubrir y la rama del `if` como parcial (13 de 14 ramas).
- **Qué entrada la recorre**: un usuario autenticado **sin deporte ni división** — por ejemplo un admin (`admin_demo`, rol `admin`, deporte y división vacíos) — que hace `GET /api/v1/divisiones/mensajes/` (entrar a "Mi División").
- **Qué decidí**: **agregué el test** (`test_usuario_sin_deporte_ni_division_recibe_lista_vacia`, en `core/tests.py`): un admin recibe `200` y una lista vacía, no un error ni los comunicados de otros. Las ramas del backend pasaron de 13/14 a 14/14.

**Lo que encontré al mutar esa guarda**, y es lo más interesante del ejercicio:

| Mutante en la guarda | Resultado |
|---|---|
| `or` → `and` | sobrevive |
| sacar la guarda (siempre filtra) | sobrevive |
| devolver **todos** los mensajes en vez de ninguno | **muere**: el test nuevo se pone rojo |

Los dos primeros sobreviven porque, sin la guarda, la query queda `filter(deporte=None, division=None)`, y como en `MensajeDivision` deporte y división son obligatorios, también devuelve vacío. **La guarda no es una regla: es una optimización** (evita ir a la base). El test protege el comportamiento que importa —que un usuario sin división no vea comunicados ajenos—, que es lo que rompería un bug de verdad (el tercer mutante). Podría verificar también la optimización (con `assertNumQueries`), pero eso sería testear cómo está implementado, no qué hace.

### 8. El umbral bloqueando un merge

**El Pull Request bloqueado (y después mergeado)**: https://github.com/salvadorsolana04/club-tablada-devops/pull/32 — «Muestra cuánto le queda al emisor para borrar un comunicado». Agrega `tiempoParaBorrar` en `src/lib/comunicados.js` (cuánto le queda al emisor para borrar su comunicado: "quedan 3 h", "quedan 12 min"…) y la usa en el tooltip del botón de borrar. Lo subí **a propósito sin tests**.

- **Qué check se puso en rojo**: `build-frontend` (required), en el paso *Correr los tests del frontend con coverage*. `build-backend` quedó verde: el cambio no tocaba el backend. Con uno solo en rojo, el merge ya quedó bloqueado.
- **En qué métrica**: en las **dos**. El log de la corrida roja (https://github.com/salvadorsolana04/club-tablada-devops/actions/runs/36450348241) dice:

  ```
  RUN  v5.0.2 /app
        Tests  12 passed (12)
  ERROR: Coverage for lines (52.63%) does not meet global threshold (90%)
  ERROR: Coverage for branches (43.75%) does not meet global threshold (90%)
  ```

  Con vitest 5 las ramas de una función que ningún test llama **cuentan desde el principio**, por eso cae también en ramas (en vitest 3 habría frenado solo por líneas).
- **Por qué**: compilaba, el build de la imagen pasaba y **los 12 tests pasaban todos**. Pero la función nueva sumó 11 líneas y 9 ramas que ningún test recorría: `src/lib` pasó de 8/8 líneas y 7/7 ramas a 10/19 y 7/16. El número que elegí en §5 lo frenó.
- **Qué escribí para arreglarlo**: 5 tests, **uno por cada camino** que declara la función — fecha inválida (`null`), ventana vencida (`null`), "quedan N h", "quedan N min" y "queda menos de un minuto" (que incluye el borde exacto de 24 hs, coherente con `sePuedeBorrar`). `ahora` entra por parámetro, así los tests no dependen del reloj. Con eso volvió a 100 % / 100 %, el check pasó a verde (https://github.com/salvadorsolana04/club-tablada-devops/actions/runs/36450612220) y se mergeó. La conversación del PR muestra la secuencia entera: el commit sin tests con su check rojo, el commit de los tests con su check verde, y el merge.

**El freno vigente, en rojo (queda abierto hasta la defensa)**: https://github.com/salvadorsolana04/club-tablada-devops/pull/33 — «Valida qué divisiones corresponden a cada deporte». Un solo archivo, `backend/core/divisiones.py` (`validar_division`: 9 líneas y 6 ramas), **sin tests y sin arreglar**. Compila y los 23 tests pasan, pero la cobertura del backend cae a 84,21 % contra el umbral de 90 (`FAIL Required test coverage of 90.0% not reached. Total coverage: 84.21%`, en la corrida https://github.com/salvadorsolana04/club-tablada-devops/actions/runs/36451014210): `build-backend` queda en rojo. Frena el **backend**, y el #32 frenó el **frontend**: los dos umbrales quedan demostrados en un Pull Request real.

**Por qué este freno es distinto del del TP4.** El del TP4 frenaba cuando el código **no construía** (una dependencia inexistente: la máquina diciendo "esto no anda"). Este frena código que **anda**: compila, construye y pasa todos sus tests. Lo que lo frena es un criterio de calidad que elegí yo — el umbral —, no un error.

**Qué clase de error deja pasar igual:**
- **Tests que ejecutan sin verificar**: la cobertura cuenta ejecución, no asserts (§6). Cinco tests sin un solo `expect` que llamaran a `tiempoParaBorrar` con las mismas cinco entradas habrían dejado el check igual de verde.
- **Lo que está fuera de la cuenta**: un bug en un componente React, en el interceptor de `api/axios.js` o en `admin.py` no mueve ningún número.
- **Errores de integración**: si el backend cambia el formato de un comunicado, el test con mock sigue verde porque el doble contesta lo de siempre. Eso se verifica end-to-end (TP7).
- **Código nuevo chico en el backend**: con el umbral en 90 y la medición en 96,61 %, una función nueva de menos de ~9 líneas/ramas sin tests todavía pasa.

### 9. Problemas encontrados y cómo los resolví

- **`npm i -D vitest` instaló la versión 3, con un `vite@7` anidado aparte del `vite@8` de la app.** Causa: mi Node local es el 23 (versión impar) y vitest 4 y 5 declaran soporte solo para Node 20/22/24+, así que npm cayó a la última que lo aceptaba. El Dockerfile (y por lo tanto el CI) usa `node:22`, donde vitest 5 es compatible, así que fijé `vitest@^5.0.2`: comparte el mismo `vite@8.2.1` de la app, sin copias.
- **Al instalar vitest 5, npm 10 falló con `Cannot read properties of null (reading 'edgesOut')`**, un bug del resolvedor de npm 10 con las dependencias opcionales de vitest 5 — incluso partiendo de un `npm ci` limpio. Lo instalé con npm 11 (`npx npm@11 i -D vitest@^5.0.2`) y después verifiqué que el lockfile resultante lo acepte `npm ci` con npm 10 (el que trae `node:22`), porque es el que va a correr en el Docker del pipeline.
- **El nombre del test parametrizado del front salía con los milisegundos** (`→ 86400000`): en `it.each` con arrays, cada `%s` toma el siguiente valor de la fila en orden. Reordené las columnas para que el título muestre el caso y el resultado esperado.
- **El `.dockerignore` del backend no terminaba en salto de línea**: al agregarle las carpetas de reportes de cobertura, la primera línea nueva quedó pegada a `staticfiles/` (`staticfiles/# reportes…`), y esa exclusión dejaba de funcionar sin ningún error. Es la misma trampa del `requirements.txt` del TP4; lo detecté revisando el archivo con `cat -e` y lo corregí.
- **`@vitest/coverage-v8` tiene que ser la misma versión que `vitest`** (5.0.2 los dos); lo instalé con el número exacto y lo comprobé con `npm ls vitest @vitest/coverage-v8`.
- **La tabla de cobertura de vitest 5 salía vacía**: el reporter `text` esconde por default los archivos al 100 %. Le puse `skipFull: false` para que el log del pipeline liste qué archivos se midieron — si no, un `include` que no matchea nada y uno que mide todo al 100 % se ven igual.


### 10. Declaración de uso de IA (TP5)

Se utilizó **Claude Code** (Anthropic) como herramienta asistente y copiloto técnico durante el diseño de la suite de pruebas, la refactorización para testeabilidad y la configuración de los gates de cobertura:

- **Refactorización y diseño de pruebas**: asistencia en la extracción de dependencias acopladas en `core/reglas.py` y `src/lib/comunicados.js` (inyección de funciones contadoras, fechas y clientes HTTP), facilitando la escritura de pruebas unitarias puras con dobles de prueba (`unittest.mock.Mock` en Python y `vi.fn()` en Vitest).
- **Configuración de herramientas y runners de cobertura**: soporte en la sintaxis de configuración para medir ramas y líneas (`backend/.coveragerc` con `branch = True` y `fail_under = 90`, y `vite.config.js` con `@vitest/coverage-v8`), así como en la estructuración de la etapa `test` dentro de los Dockerfiles multi-stage para que las dependencias de desarrollo no viajen a la imagen final.
- **Resolución de conflictos de tooling**: asistencia en el diagnóstico del error de dependencias de npm 10 al instalar Vitest 5 y en el formateo de los reportes JSON para alimentar el Summary de GitHub Actions.

**Verificación propia**:
- Revisé cada cambio antes de pasar al siguiente paso y leí los logs de cada corrida roja y verde en Actions.
- Hallazgos que la IA reportó y comprobé en el código: con los 16 tests originales el borde `>` → `>=` de la regla de borrado pasaba en verde con `reglas.py` al 100 % de cobertura; los tests del front encontraron dos bugs reales en `sePuedeBorrar`; y en `views.py` la guarda del usuario sin división es una optimización, no una regla (dos mutantes sobreviven).
- Para la defensa: puedo mostrar en cada test el Arrange, el Act y el Assert, explicar qué verifica cada assert y qué caso **no** cubre, y reproducir en vivo una mutación (por ejemplo `<=` → `<` en `sePuedeBorrar`, que pone en rojo el caso `justo 24h`).


---

## TP6 — CD: environments, aprobaciones y deployment patterns

### 1. El artefacto: por qué se publica solo con la verificación en verde

Hasta el TP5 el pipeline verificaba y no dejaba nada: la imagen nacía y moría adentro del runner. Ahora cada merge a `main` deja **dos imágenes en `ghcr.io`** (`club-tablada-devops-backend` y `club-tablada-devops-frontend`), etiquetadas con el commit que las produjo (`sha-<commit>`), y públicas.

Que en el registry solo haya imágenes verificadas no depende de un control nuevo: sale de encadenar **tres** cosas.

1. **Nada entra a `main` sin el pipeline en verde**: el gate del TP4 (los dos checks requeridos) más el umbral de cobertura del TP5.
2. **Solo lo que entra a `main` se publica**: el paso lleva `push: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}`. Puse las dos condiciones y no solo la del evento, porque si mañana agrego otra rama al disparador, un push a esa rama publicaría sin haber pasado por un Pull Request.
3. **El paso que publica es el ÚLTIMO del mismo job que corrió los tests.** No hay ningún `if` que diga «si los tests pasaron»: los pasos corren en orden y el job se corta al primer error, así que si los tests fallan, nunca se llega a publicar. Por eso moví el build de la imagen final de arriba (donde estaba en el TP4) hacia abajo. Si lo dejaba arriba, todo seguía en verde, pero se publicaba una imagen construida antes de saber si los tests pasaban.

Las dos evidencias están en «Enlaces de este TP»: en la corrida del PR #36 «Entrar al registry» sale salteado aunque los tests pasaron (segundo eslabón), y en la corrida de `main` «Construir y publicar la imagen» es el paso 10, después de los tests (tercer eslabón).

**Qué dejaría de significar el registry si se publicara igual.** Hoy «está publicado» quiere decir «pasó la verificación». Si se publicara con los tests en rojo, el registry pasaría a ser un depósito de cosas que alguien construyó alguna vez, y antes de desplegar una imagen habría que ir a averiguar si esa en particular era buena.

**Qué NO garantiza la cadena.** Garantiza lo que publica **el pipeline**, no lo que físicamente puede entrar: yo podría subir una imagen a mano con `docker push` desde mi máquina y nadie me lo impide. Tampoco garantiza que la etiqueta apunte siempre a lo mismo: un tag es un nombre que se puede mover. Lo que identifica de verdad el contenido es el **digest** (el `sha256:…` que devuelve el `docker pull`): si alguien pisara el tag con otra imagen, el digest cambiaría.

El permiso `packages: write` va **adentro de cada job** y no a nivel del workflow: arriba de todo reemplazaría el default de todos los jobs, y los de deploy no necesitan escribir paquetes (mínimo privilegio). No hizo falta ningún secret nuevo: se usa el `GITHUB_TOKEN` que GitHub le entrega a cada corrida.

### 2. Continuous Delivery, no Continuous Deployment

- **Continuous Integration**: cada cambio se integra y se verifica solo. Es lo que tenía hasta el TP5.
- **Continuous Delivery**: cada cambio verificado queda listo para ir a producción, pero el último paso lo autoriza una persona.
- **Continuous Deployment**: se saca a la persona; todo lo que pasa las verificaciones llega solo a producción.

Implementé **Continuous Delivery**: QA se despliega solo en cada merge y PROD espera mi aprobación. Es lo que corresponde a mi contexto, porque mi red de seguridad todavía no alcanza para sacar al humano: los tests cubren las reglas de negocio del backend y la lógica de `src/lib` del front, pero no hay tests de integración ni end-to-end (el TP5 §8 ya lo decía), y no tengo monitoreo que me avise si producción se rompe después de un deploy. Con eso, Continuous Deployment sería automatizar la propagación de errores.

Para pasar a Continuous Deployment me faltaría: tests end-to-end que prueben el circuito completo, monitoreo con alertas, y un rollback automático cuando el smoke o las métricas fallan. Para una app de un club, con pocos deploys y sin equipo de guardia, tampoco la querría hoy: la aprobación me cuesta un clic y me deja elegir el momento.

### 3. El diseño de la cadena y el alcance de cada secret

El workflow tiene cuatro jobs:

```
build-backend    (sin needs)                               tests + publica la imagen
build-frontend   (sin needs)                               tests + publica la imagen
deploy-qa        needs: [build-backend, build-frontend]    if: main · environment: qa
deploy-prod      needs: deploy-qa                          environment: production · concurrency
```

- **`needs`** arma la cadena con compuertas: `deploy-qa` no arranca si alguno de los dos builds falló, y `deploy-prod` no arranca si QA no se desplegó y pasó su smoke test.
- **`if: github.ref == 'refs/heads/main'`** en `deploy-qa`: los Pull Requests verifican pero no despliegan. En cada PR de este TP el job sale *skipped*.
- **`deploy-prod` no repite ese `if`, a propósito**: depende de `deploy-qa`, que ya lo tiene. En un PR `deploy-qa` se saltea y entonces `deploy-prod` también. La condición se hereda por la cadena.
- **`environment:`** conecta el job a un environment de GitHub, que le da tres cosas: sus secrets, sus reglas de protección y el historial de deployments. `qa` no tiene reglas (es automático a propósito); `production` tiene *required reviewers* conmigo como revisor y *Prevent self-review* desactivado, porque trabajo solo.
- **`concurrency: deploy-prod`** evita dos deploys a PROD pisándose. No ordena la cola de aprobaciones: si quedan dos corridas esperando, la vieja la tengo que rechazar yo a mano, porque aprobarla después de la nueva haría retroceder a PROD.

**El `&ref=$GITHUB_SHA`.** El deploy hook de Render, pelado, despliega la punta de la rama. Con `&ref=` le digo qué commit desplegar: el que el pipeline acaba de verificar. Importa con dos merges seguidos: sin el `ref`, la corrida del primero desplegaría el segundo, que todavía no pasó por nada. Y en PROD importa más, porque entre que la corrida queda esperando y que la apruebo pueden pasar horas y `main` se mueve: sin el `ref` estaría aprobando el commit A y subiendo lo último que haya.

**Alcance de los secrets:**

| Secret | Dónde vive | Quién lo puede leer |
|---|---|---|
| `GITHUB_TOKEN` | lo genera GitHub en cada corrida | cada job, con los permisos que declara |
| `RENDER_HOOK_API_QA`, `RENDER_HOOK_FRONT_QA` | environment `qa` | solo un job con `environment: qa` |
| `RENDER_HOOK_API_PROD`, `RENDER_HOOK_FRONT_PROD` | environment `production` | solo un job con `environment: production`, **después de aprobado** |

Los hooks son URLs secretas: quien las tiene despliega la app. Por eso los de PROD viven en su environment y no en el repositorio: si fueran secrets del repo, cualquier job de cualquier workflow (incluido uno de un PR) podría leerlos y desplegar a producción sin pasar por la aprobación. Así, sin aprobación no los lee nadie. La cadena de conexión a la base y la `SECRET_KEY` de Django no están en GitHub: viven como variables de entorno en cada servicio de Render.

### 4. Dos entornos reales: qué quedó por variable y qué quedó adentro de la imagen

**Qué usé.** Render para la app (cuatro *web services* con runtime Docker, plan gratuito: `club-tablada-api-qa`, `club-tablada-front-qa`, `club-tablada-api-prod`, `club-tablada-front-prod`) y Neon para la base (un proyecto con dos databases: `app_qa` y `app_prod`). No usé el Postgres de Render porque el gratuito expira a los 30 días; el de Neon es permanente.

**Cómo cumplo los cinco puntos del contrato:**

1. **Dos entornos separados, cada uno con su URL pública**: las cuatro URLs están en «Enlaces de este TP».
2. **Una base por entorno**: `app_qa` y `app_prod`. Lo comprobé creando una noticia `PRUEBA QA` desde el front de QA y otra `SOY PROD` desde el de PROD: en el SQL Editor de Neon, `select id, titulo from core_noticia;` devuelve solo `PRUEBA QA` en `app_qa` y solo `SOY PROD` en `app_prod`, y cada front muestra únicamente la suya.
3. **Front y back corriendo como contenedores**, construidos con mis Dockerfiles del TP2 (Root Directory `backend` y `frontend`, runtime Docker en los cuatro).
4. **El deploy lo dispara mi pipeline**: Auto-Deploy está en **Off** en los cuatro servicios. En *Deploys* de Render, todos los deploys figuran con trigger «Deploy Hook», salvo el primero de cada servicio («First Deploy», al crearlo).
5. **Producción detrás de la aprobación** del environment `production` (§5).

**La dirección del backend salió de la imagen del front.** En el TP2, `nginx.conf` tenía escrito `http://backend:8000`, el nombre del servicio en compose. En Render ese nombre no existe, y la api es otra URL distinta en QA y en PROD. Renombré el archivo a `default.conf.template` y lo copio en `/etc/nginx/templates/`: la imagen oficial de nginx reemplaza `${BACKEND_URL}` y `${DNS_RESOLVER}` por los valores del entorno al arrancar.

| | Por variable de entorno (cambia por entorno) | Adentro de la imagen (igual en todos lados) |
|---|---|---|
| **Front** | `BACKEND_URL` (la api de su entorno), `DNS_RESOLVER` | el build de Vite, que llama a `/api/v1` relativo a su mismo origen; la plantilla de nginx; los valores por defecto de compose (`http://backend:8000`, `127.0.0.11`) |
| **Back** | `DATABASE_URL`, `SECRET_KEY`, `DEBUG`, `PORT` | el código, las dependencias y el `entrypoint.sh` que corre `migrate` y levanta gunicorn en `0.0.0.0:8000` |

La prueba de que es la misma imagen la hice en mi máquina antes de subirla: con `docker run` sin variables, el `default.conf` generado dice `resolver 127.0.0.11` y `set $backend_api http://backend:8000;` (compose sigue andando sin tocarlo); con `-e BACKEND_URL=https://club-tablada-api-qa.onrender.com -e DNS_RESOLVER=8.8.8.8`, la misma imagen genera `resolver 8.8.8.8` y la api de QA. Es lo que hace posible el TP7: desplegar una única imagen en los dos entornos.

**Un cambio propio de mi app: saqué `proxy_set_header Host $host`.** Render enruta cada pedido según el header `Host`. Mi nginx del TP2 le mandaba al backend el `Host` del front, y en Render eso hace que el pedido nunca llegue a la api. Sin esa línea, nginx manda el host de la api.

**El esquema se crea solo.** Las dos bases nacen vacías. Mi `entrypoint.sh` corre `python manage.py migrate` antes de levantar gunicorn, así que las tablas aparecieron la primera vez que cada backend arrancó en Render. Lo comprobé con `select count(*) from core_noticia;`, que devolvió `0` en las dos bases en vez de *relation does not exist*.

**Los usuarios.** El plan gratuito de Render no da consola, y las bases no tenían ningún usuario para iniciar sesión. Creé el administrador de cada entorno desde mi máquina, corriendo `manage.py createsuperuser` adentro de la imagen del backend **publicada por el pipeline**, con `DATABASE_URL` apuntando a la base de Neon de ese entorno.

**Limitaciones que conozco:**

- Las fotos de las noticias se guardan en el disco del contenedor (`MEDIA_ROOT`), que en Render se pierde en cada deploy. Los datos de Neon persisten; las fotos no. Es la misma limitación que anoté en el TP2, ahora más visible.
- Los servicios de Render quedaron en la región Oregon y la base de Neon en N. Virginia: cada consulta cruza Estados Unidos. Para el práctico no molesta; en una app real los pondría en la misma región.

### 5. El gate humano: qué miro antes de aprobar

El environment `production` tiene *required reviewers* conmigo como revisor. El job `deploy-prod` no es un botón de deploy: es un job que **no arranca** hasta que alguien aprueba. Mientras tanto la corrida queda en *Waiting for review* y los secrets de PROD no los lee nadie.

**Qué compra la aprobación**: elegir el momento, que una persona mire la evidencia antes de que el cambio llegue a los usuarios, y que quede registrado quién autorizó cada deploy y con qué comentario.

**Mis criterios antes de aprobar:**

1. `deploy-qa` está en verde y el smoke respondió **con el commit de esta corrida**, no con uno anterior.
2. Abro el front de QA y veo el cambio funcionando con mis ojos.
3. Sé qué trae el deploy: reviso qué commits entran desde el último deploy a PROD (en *Deployments* veo cuál está corriendo) y si alguno toca la base o la configuración.
4. No hay otra corrida más vieja esperando aprobación. Si la hay, la rechazo primero.
5. Vale la pena el deploy: cada deploy a PROD son dos builds de Render, de un cupo de 500 minutos por mes.

**Las tres corridas que pasaron por el gate:**

- **Primera, aprobada por error**: https://github.com/salvadorsolana04/club-tablada-devops/actions/runs/36913564542 — mi intención era rechazarla, porque era el primer deploy a PROD y todavía no había comprobado que las bases estuvieran separadas. Escribí ese motivo en el comentario y apreté *Approve and deploy* en vez de *Reject*. El deploy salió bien, pero quedó registrada una aprobación con un comentario de rechazo. Lo dejo contado porque muestra el riesgo que describe la guía: una aprobación hecha por reflejo no agrega seguridad, solo latencia. La comprobación de las bases la hice inmediatamente después (§4).
- **Rechazada**: https://github.com/salvadorsolana04/club-tablada-devops/actions/runs/36927235474 — el commit `6002a55` solo agregaba dos líneas al `.gitignore`. Mi motivo: «este commit solo toca el .gitignore, no cambia lo que corre, y no vale gastar builds de Render; sube con el próximo cambio real». El job `deploy-prod` quedó en *failure*, QA avanzó a ese commit y PROD siguió en el anterior. En *Deploys* de Render ese commit no aparece en los servicios de PROD: nunca llegó.
- **Aprobada con criterio**: https://github.com/salvadorsolana04/club-tablada-devops/actions/runs/36929258613 — el commit `bc1551f` agrega «· Córdoba» al subtítulo del login. Antes de aprobar abrí el front de QA y vi el texto nuevo, y el front de PROD todavía mostraba el viejo. Después de aprobar, PROD mostró el cambio. Ese deploy llevó también el cambio del `.gitignore` que había rechazado antes.

**Qué NO puede ver mi aprobador.** Solo ve lo que el pipeline le muestra: que QA contesta y con qué commit. No ve si el cambio se comporta bien con datos reales (la base de QA tiene una sola noticia), ni cómo rinde bajo carga, ni si rompió algo que el smoke no toca (por ejemplo, publicar un comunicado). Para decidir mejor me falta observabilidad: logs centralizados, tasa de errores y tiempos de respuesta de QA después del deploy.

**Cuándo la aprobación no agregaría valor**: si aprobara siempre sin mirar nada, o si tuviera tests end-to-end y monitoreo suficientes como para confiar en la automatización. En ese caso el gate sería solo demora.

### 6. La letra chica del free tier y cómo la maneja mi pipeline

**Render (plan gratuito):**

- **Los servicios se duermen a los 15 minutos sin tráfico.** El primer pedido los despierta con un *cold start* que medí en unos **35 a 40 segundos** para el backend.
- **750 horas de instancia por mes, por workspace** (no por servicio), repartidas entre mis cuatro servicios. Un servicio despierto las 24 horas consume 720 él solo. No tengo nada haciendo ping para mantenerlos despiertos, a propósito: solo gastan horas cuando alguien los usa o cuando el pipeline los despliega.
- **500 minutos de build por mes.** Cada build mío tarda entre 30 segundos y 1 minuto (lo que muestra *Deploys* en Render: 30 a 65 s). Una promoción completa son cuatro builds (back y front, en QA y en PROD), unos 2 a 4 minutos. Con eso el cupo alcanza para más de cien promociones al mes. Igual lo cuido: fue el motivo del rechazo de la §5. Si el cupo se acabara, Render dejaría de construir hasta fin de mes y el hook respondería igual; mi smoke lo detectaría, porque compara el commit (§8).
- **El disco es efímero**: lo que se sube a `MEDIA_ROOT` se pierde en cada deploy (§4).

**Neon (plan gratuito):** el cómputo se suspende a los 5 minutos sin uso y se despierta solo, mucho más rápido que Render. Tiene límite de 0,5 GB de almacenamiento y de horas de cómputo mensuales. Mis dos bases tienen un puñado de filas.

**Cómo lo maneja el pipeline.** El smoke test **reintenta**: hasta 30 vueltas con 20 segundos de espera, y cada `curl` lleva `--max-time 10`. Un `curl` seco daría rojos falsos, porque entre el hook y el servicio listo pasan el build de Render y el cold start. El `--max-time` va en cada pedido porque un servicio despertando acepta la conexión y no contesta: sin tope, el `curl` se quedaría colgado. En las corridas reales el smoke de QA pasó en el intento 4 y el de PROD en el 3.

**Cómo se ve el cold start desde la app** (me pasó dos veces durante el práctico). Cuando la api está dormida y entro por el front, Render le devuelve un **502 inmediato** al nginx del front en vez de hacerlo esperar. Mi pantalla de login muestra cualquier error como «Usuario o contraseña incorrectos», así que el cold start parece un problema de credenciales. Lo diagnostiqué pegándole al endpoint de login con un usuario inventado: el primer pedido dio 502 y, con la api ya despierta, 401. Para la defensa abro primero `/api/v1/health/` de la api y espero el JSON antes de iniciar sesión. La mejora pendiente es que el front distinga un error de servidor de un 401.

### 7. Qué garantía pierdo porque Render reconstruye desde el repositorio

Mi pipeline publica en `ghcr.io` la imagen que pasó los tests. Pero lo que corre en QA y en PROD **no es esa imagen**: el deploy hook le pide a Render que **vuelva a construir** el commit desde el repositorio. Con `&ref=$GITHUB_SHA` garantizo que se despliega el mismo **commit** que se verificó, pero no la misma **imagen**.

La garantía que pierdo es «se promueve lo mismo que se verificó». Son tres construcciones distintas del mismo código (la del pipeline, la de Render para QA y la de Render para PROD), y pueden salir distintas:

- **Una dependencia sin versión fija.** En `backend/requirements.txt` tengo `psycopg[binary]>=3.2.0`: si sale una versión nueva entre el build del pipeline y el de Render, los tests corrieron con una y producción corre con otra.
- **Las imágenes base.** `python:3.13-slim`, `node:22-alpine` y `nginx:alpine` son etiquetas que se mueven: el build de Render puede partir de una base más nueva que la del pipeline.
- En el front el riesgo es menor: `npm ci` instala exactamente lo que dice el `package-lock.json`.

Hoy las imágenes publicadas quedan guardadas y etiquetadas, pero no son las que corren (las usé, eso sí, para crear los usuarios administradores, §4). Convertirlas en lo que efectivamente se despliega es lo que resuelve el TP7: que Render deje de construir y ejecute la imagen del registry, la misma en QA y en PROD. La plantilla de nginx de la §4 es lo que lo hace posible del lado del front.

### 8. Qué prueba mi smoke test y qué no

Después de disparar los hooks, el job hace tres pedidos y solo pasa si los tres salen bien:

1. **`$URL_API/api/v1/health/`**, directo a la api. Es un endpoint que agregué para esto, porque todos los demás piden login. Prueba tres cosas: que el proceso está vivo; que **la base responde y tiene mis tablas** (devuelve `Noticia.objects.count()`: con la cadena de conexión rota o la base sin migrar, da error); y que **el commit que corre es el de esta corrida**: el endpoint devuelve la variable `RENDER_GIT_COMMIT`, que Render define sola, y el smoke la compara con `$GITHUB_SHA`.
2. **`$URL_FRONT/`**: que el front sirve la página.
3. **`$URL_FRONT/api/v1/health/`**, a través del front: que la plantilla de nginx apunta a la api de **su** entorno.

**Por qué compara el commit.** El hook responde al instante y Render construye en segundo plano; mientras construye, o si el build falla, sigue sirviendo la versión anterior. Un smoke que solo mira «¿contesta?» puede dar verde contra la versión vieja. Se ve en el log del primer deploy a QA: los intentos 1 a 3 no pasaron (la versión vieja ni siquiera tenía `/health`) y el 4 pasó cuando la api ya respondía con el commit nuevo.

**Qué NO prueba:**

- **La versión del front.** El commit lo informa la api; el front no tiene un endpoint equivalente. El smoke puede pasar con la api nueva y el front todavía construyéndose. En la corrida del subtítulo lo comprobé a mano, abriendo el front.
- **Que la app funcione**: no inicia sesión, no publica una noticia ni un comunicado, no prueba los permisos por rol. Dice «contesta», no «funciona bien».
- **Que la base sea la correcta.** Si PROD apuntara por error a `app_qa`, el smoke daría verde igual. Eso lo comprobé a mano una vez (§4), no en cada deploy.
- **Las escrituras y los archivos**: solo hace lecturas, y no toca `MEDIA_ROOT`.

### 9. Deployment pattern para una producción real y plan de rollback

**Qué patrón usaría: blue-green, con feature flags para las funcionalidades riesgosas.**

- **Por qué blue-green.** Mi app es un monolito Django más un front estático, con una sola instancia de cada uno y pocos usuarios (los socios de un club). Blue-green son dos entornos completos y un cambio de ruta: la versión nueva se levanta al lado de la vieja, se prueba, y el router cambia de una a otra. El **rollback es instantáneo** (volver el cambio de ruta), que es lo que más me importa sin equipo de guardia.
- **Costo.** El doble de infraestructura mientras conviven las dos versiones. A la escala de esta app son dos servicios chicos más: es un costo que se puede pagar.
- **Riesgo.** Las dos versiones comparten la base de datos. Una migración que borra o renombra una columna rompe a la versión vieja, y con eso se pierde el rollback. Las migraciones tendrían que ser compatibles hacia atrás: primero agregar, y borrar recién en un deploy posterior.
- **Por qué no canary.** Canary manda un porcentaje chico del tráfico real a la versión nueva y decide mirando métricas. Me faltan las dos cosas: con el tráfico de un club, el 5 % de los pedidos son muy pocos como para concluir algo, y no tengo métricas que digan «el canario está fallando». Sin observabilidad, canary es una ruleta.
- **Por qué no rolling.** Rolling reemplaza instancias de a tandas, y yo tengo una sola de cada servicio.
- **Para qué usaría un flag.** Para separar el deploy del release: desplegar el código apagado y prenderlo después, sin otro deploy. Por ejemplo, una funcionalidad nueva de comunicados la prendería primero para una sola división, y después para todas. Volver atrás es apagar el flag. El costo es la complejidad en el código y la disciplina de borrar el flag cuando la funcionalidad queda firme. Una variable de entorno no sirve como flag, porque para cambiarla hay que reiniciar el servicio.
- **Qué observabilidad me falta hoy**: tasa de errores y tiempos de respuesta por versión, logs centralizados y alertas. Hoy lo único que mira a producción es el smoke del deploy, una sola vez.

**Mi plan de rollback actual**, si un deploy aprobado sale mal:

1. En *Deployments* → `production` (o en *Deploys* de Render) busco el commit del último deploy bueno anterior.
2. Copio de Render los dos Deploy Hooks de PROD. El secret de GitHub no se puede volver a leer.
3. Disparo los dos hooks con ese commit: `curl "$HOOK_API_PROD&ref=<sha>"` y `curl "$HOOK_FRONT_PROD&ref=<sha>"`. Es el mismo mecanismo del deploy: como cada deploy lleva el commit explícito, volver atrás es pedir un commit anterior.
4. Verifico en `/api/v1/health/` que el commit que contesta es el anterior, y en *Deploys* de Render que figura como *live* en los dos servicios.

**Lo medí de verdad** (1 de octubre de 2026), volviendo PROD de `bc1551f` (el subtítulo «· Córdoba») a `10f70f2`:

- Disparé los hooks a las **18:42:59**.
- A las **18:43:47** la api de PROD ya contestaba con el commit `10f70f2`: **48 segundos como máximo**.
- En *Deploys* de Render, los dos servicios de PROD muestran ese deploy con trigger «Deploy Hook» y una duración de **34,6 s** y **30,1 s**.
- El front de PROD volvió a mostrar el subtítulo sin «· Córdoba».

**Mi número: menos de un minuto.** Es rápido porque Render ya había construido ese commit y reutiliza las capas. Un rollback a un commit que nunca se construyó tardaría lo que un deploy normal. La métrica DORA que estoy ejercitando es el tiempo de recuperación ante un deploy fallido.

Otra vía es re-correr solo el job `deploy-prod` de una corrida anterior desde *Actions*: vuelve a pedir la aprobación (es un deploy a producción) y GitHub solo lo permite en corridas de hasta 30 días. El hook con el commit funciona siempre.

**Lo que el rollback de código NO deshace: los datos.** Durante mi rollback, `/api/v1/health/` siguió devolviendo `"noticias":1`: la noticia `SOY PROD` no se borró. Volver el código no vuelve la base. Si el deploy fallido hubiera corrido una migración que borra una columna, el código viejo arrancaría contra un esquema que ya no entiende y los datos borrados no vuelven. Para eso harían falta migraciones compatibles hacia atrás y una copia de la base anterior al deploy (Neon ofrece restauración a un punto en el tiempo). Otro límite: no puedo volver a un commit anterior a `4b0bdd3`, porque no tiene la plantilla de nginx ni el endpoint `/health`, y en Render dejaría al front sin backend.

**La release.** Después del rollback PROD quedó en `10f70f2`. Vuelve adelante con el deploy del commit que incluye este documento, que apruebo como cualquier otro, y ese commit —el que queda corriendo en PROD— es el que etiqueto como `v6.0.0` y publico como release. El número lo fija el práctico (TP6); no es SemVer, que numera releases de producto según lo que cambió.

### 10. Problemas encontrados y cómo los resolví

- **Mi app no tenía un endpoint que el smoke pudiera usar.** Todos piden login y devuelven 401, que no prueba que la base ande. Agregué `/api/v1/health/` (público, cuenta noticias y devuelve el commit) con su test, para no bajar del umbral de cobertura del TP5.
- **El `Host` del proxy.** Mi `nginx.conf` del TP2 mandaba `proxy_set_header Host $host`. En compose no molestaba; en Render hace que el pedido no llegue a la api (§4). Lo saqué al armar la plantilla.
- **Un error de sangría en el YAML.** Al agregar `permissions:` en `build-backend` quedó con 8 espacios en vez de 4, lo que dejaba el workflow inválido. Se detectó revisando el diff antes del commit.
- **Me olvidé de apagar el Auto-Deploy** al crear el primer servicio. Se cambia sin recrearlo: *Settings → Build & Deploy → Auto-Deploy → Off*. Lo revisé en los cuatro.
- **`git add` falló entero por un archivo que ya no existía.** Después de `git mv frontend/nginx.conf frontend/default.conf.template`, incluí `frontend/nginx.conf` en el `git add`: git cortó con `pathspec did not match` y no agregó ninguno de los otros archivos. El renombre ya estaba en stage por el `git mv`; repetí el comando sin esa ruta.
- **La cadena de conexión llegaba vacía al contenedor.** Cargaba la variable con `read -rs DB_QA` en una pestaña de la terminal y corría el `docker run` en otra, y las variables no pasan de una pestaña a otra. El síntoma fue el aviso `Engine not recognized from url` de django-environ, con todos los campos vacíos. Lo resolví encadenando todo en un solo comando: `read -rs DB_QA && docker run … -e DATABASE_URL="$DB_QA" …`.
- **El cold start se veía como contraseña incorrecta** (§6).
- **Aprobé una corrida que quería rechazar** (§5).
- **Correr los tests en local dejó una carpeta `backend-coverage/` sin ignorar.** La agregué al `.gitignore` en el PR #39, que es el commit del rechazo.
- **Docker no respondía** al hacer el primer `docker pull`: mi CLI usa OrbStack y estaba cerrado. Y en una Mac con chip Apple el `pull` necesita `--platform linux/amd64`, porque el pipeline construye para la arquitectura del runner.


### 11. Declaración de uso de IA (TP6)

Se utilizó **Claude Code** (Anthropic) como herramienta asistente, copiloto de arquitectura y guía de control durante la configuración del despliegue continuo multi-entorno, se uso como supervisor constante ya que claudecode se conecta directo a el repo antes de cada cambio revisaba que etsa bien realizado:

- **Estructura y sintaxis del pipeline de CD**: asistencia en la extensión de `.github/workflows/ci.yml` para incorporar la publicación de imágenes en GitHub Packages y la definición de los jobs `deploy-qa` y `deploy-prod`, asegurando el orden de dependencias (`needs`), el uso correcto de environments de GitHub y la invocación de deploy hooks mediante `curl`.
- **Adaptación arquitectónica a Django y SPA**: soporte en la traducción de las pautas de la guía (pensadas originalmente para .NET) a mi stack: adaptación de la conexión a Postgres vía `DATABASE_URL` (dj-database-url / psycopg), parametrización de `nginx.conf` con `envsubst` (`default.conf.template`) para resolver dinámicamente el proxy inverso hacia el backend en Render sin acoplar la URL en el build, y diseño del endpoint `/api/v1/health/` con verificación de base de datos para el smoke test.
- **Auditoría y troubleshooting de infraestructura**: apoyo en la revisión de diffs de configuración YAML (previniendo errores de indentación) y diagnóstico de comportamiento en runtime de la nube gratuita (manejo de cold starts en Render simulando timeouts y validación de variables de entorno entre entornos de ejecución).

**Verificación propia**:
Toda la configuración, aprovisionamiento y validación fue ejecutada, auditada y probada manualmente por mí:
- **Aprovisionamiento y secrets**: configuré personalmente los cuatro servicios web en Render, las instancias de Postgres independientes en Neon y los environments (`qa` y `production`) con sus respectivas variables y secretos en GitHub.
- **Validación local previa**: verifiqué en mi máquina el comportamiento de `default.conf.template` levantando contenedores con y sin variables para constatar que la sustitución generara los upstreams correctos antes de commitear, y corrí localmente la suite de tests del backend en Docker (25 tests pasando, 96,77 % de cobertura).
- **Aislamiento real de datos**: comprobé visual y funcionalmente ambos ambientes creando datos de prueba diferenciados (una noticia en QA y otra en PROD), y confirmé mediante queries directas en el SQL Editor de Neon que las bases estaban completamente desacopladas y no compartían registros.
- **Control de despliegue y gates**: gestioné manualmente el ciclo de vida de los deploys en GitHub Actions, aprobando y rechazando las promociones hacia `production` tras revisar el smoke test de QA, y ejecuté la prueba de rollback en Render midiendo el tiempo de recuperación. Comprendo y soy capaz de defender en la instancia oral el recorrido completo desde el merge a `main` hasta la verificación final en producción.