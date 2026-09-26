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

**Frontend** (la app tiene frontend separado, así que los mínimos del front aplican): el componente `Division.jsx` decide si mostrar el botón de borrar (`sePuedeBorrar`, espejo de la regla 4 del backend) y arma el envío del comunicado (título, mensaje y foto opcional). Son las dos piezas con lógica de verdad del front; el resto es presentación. Los 12 tests de `src/lib/comunicados.test.js` corren en Node, sin DOM.

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
| Frontend | 100 % (8/8) | **100 % (7/7)** | — | 90 en líneas y 90 en ramas |

Lo que sigue sin cubrir en el backend son los `__str__` de los tres modelos y `PerfilView.get` (`/perfil/`): líneas sin decisiones adentro, que no suman ramas.

**Por qué 90 en el backend, y sobre qué métrica.** Con `branch = True`, el `fail_under` de coverage.py no mira las líneas solas: evalúa `(líneas cubiertas + ramas cubiertas) / (líneas + ramas)`. O sea, el umbral ya incluye las ramas, que es la métrica más honesta; en el Summary igual muestro líneas y ramas por separado. Cuando lo elegí medía 94,92 %: el 90 deja ~5 puntos de margen para el día a día, pero una función nueva sin tests de unas 7 líneas/ramas ya lo pone en rojo (lo probé: una función de 8 líneas y 6 ramas sin tests lo bajó a 84,85 % y frenó). Un umbral pegado a la medición (94) frenaría por cualquier cambio mínimo; uno lejano (70) dejaría entrar funciones enteras sin tests. **Para subirlo** a 95 sin que quede pegado habría que testear `/perfil/` y los `__str__`, y aun así sería un umbral que frena por dos líneas: con una base de 118 unidades, cada punto son ~1,2 líneas o ramas.

**Por qué 90 en el frontend, y qué mide de verdad.** El 100 % es real pero chico: mide **un solo archivo** (`comunicados.js`, 8 líneas y 7 ramas). Con una base tan chica, cualquier archivo nuevo en `src/lib` sin tests lo hunde (lo probé: uno de 5 líneas lo bajó a 66,66 % de líneas y 53,84 % de ramas). **Lo que no mide**: en `src/api/axios.js` queda lógica sin testear — el interceptor que ante un 401 borra los tokens y redirige a `/login`. Si incluyo `src/api/**`, el front baja a 34,78 % de líneas y 46,66 % de ramas. **Para ampliar la medición** habría que sacar esa lógica a `src/lib` recibiendo `localStorage` y `window.location` por parámetro (el mismo refactor que `enviarComunicado`), testearla con dobles, e incluirla. Lo dejé documentado en vez de esconderlo: el 100 % del front dice "la lógica extraída está verificada", no "el front está verificado".

**Cómo frena.** La cobertura corre **adentro de los mismos jobs** del TP4 (`build-backend` y `build-frontend`), que ya son required checks de `main`: una etapa `test` en cada Dockerfile (`FROM build AS test`) que el job construye y corre. Si el número no llega, pytest/vitest salen con error → el `docker run` también → el job queda rojo → el merge se bloquea. La etapa `final` de cada imagen no se lleva nada de test: el backend copia el venv desde `build` (no desde `test`), y el frontend sigue siendo nginx con los estáticos.

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

### 8. Problemas encontrados y cómo los resolví

- **`npm i -D vitest` instaló la versión 3, con un `vite@7` anidado aparte del `vite@8` de la app.** Causa: mi Node local es el 23 (versión impar) y vitest 4 y 5 declaran soporte solo para Node 20/22/24+, así que npm cayó a la última que lo aceptaba. El Dockerfile (y por lo tanto el CI) usa `node:22`, donde vitest 5 es compatible, así que fijé `vitest@^5.0.2`: comparte el mismo `vite@8.2.1` de la app, sin copias.
- **Al instalar vitest 5, npm 10 falló con `Cannot read properties of null (reading 'edgesOut')`**, un bug del resolvedor de npm 10 con las dependencias opcionales de vitest 5 — incluso partiendo de un `npm ci` limpio. Lo instalé con npm 11 (`npx npm@11 i -D vitest@^5.0.2`) y después verifiqué que el lockfile resultante lo acepte `npm ci` con npm 10 (el que trae `node:22`), porque es el que va a correr en el Docker del pipeline.
- **El nombre del test parametrizado del front salía con los milisegundos** (`→ 86400000`): en `it.each` con arrays, cada `%s` toma el siguiente valor de la fila en orden. Reordené las columnas para que el título muestre el caso y el resultado esperado.
- **El `.dockerignore` del backend no terminaba en salto de línea**: al agregarle las carpetas de reportes de cobertura, la primera línea nueva quedó pegada a `staticfiles/` (`staticfiles/# reportes…`), y esa exclusión dejaba de funcionar sin ningún error. Es la misma trampa del `requirements.txt` del TP4; lo detecté revisando el archivo con `cat -e` y lo corregí.
- **`@vitest/coverage-v8` tiene que ser la misma versión que `vitest`** (5.0.2 los dos); lo instalé con el número exacto y lo comprobé con `npm ls vitest @vitest/coverage-v8`.
- **La tabla de cobertura de vitest 5 salía vacía**: el reporter `text` esconde por default los archivos al 100 %. Le puse `skipFull: false` para que el log del pipeline liste qué archivos se midieron — si no, un `include` que no matchea nada y uno que mide todo al 100 % se ven igual.
