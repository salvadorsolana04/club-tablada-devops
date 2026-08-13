# Registro de Decisiones TÉCNICAS — TP1

## 1. Por qué Git no pudo resolver el conflicto automáticamente
Git aplica un algoritmo de integración de tres vías (3-way merge) comparando las dos ramas con su ancestro común. Dado que en las ramas `feature/titulo-a` y `feature/titulo-b` se modificó exactamente la misma línea del archivo `README.md` con contenido diferente, Git no puede asumir cuál versión es la correcta sin riesgo de perder cambios del equipo. Por este motivo, interrumpe el proceso automático y requiere una intervención humana para tomar la decisión de contenido.

## 2. Estrategia de Branching y Merge
Se adoptó la estrategia **GitHub Flow** utilizando la opción de **Squash and Merge** para integrar las ramas a `main`. Esto permite mantener un historial lineal y limpio en la rama principal, donde cada commit representa una funcionalidad completa e integrable.

## 3. Problemas Encontrados y Solución
- **Rechazo por desactualización local:** Al intentar realizar el primer push, se produjo un rechazo previo debido a que el repositorio remoto contenía archivos iniciales (`.gitignore`) no presentes localmente. Se resolvió sincronizando mediante `git pull origin main --rebase`.

## 4. Declaración de Uso de IA
Se utilizó asistencia de IA como copiloto para acelerar la comprensión del flujo de trabajo, la sintaxis de comandos de Git en terminal macOS y el guiado en la resolución de conflictos. El estudiante comprende y es capaz de defender de forma oral cada decisión técnica y configuración aplicada en el repositorio.
