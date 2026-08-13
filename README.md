# Club La Tablada — Sistema de Gestión (DevOps Pipeline)

> **Materia:** Ingeniería del Software 3 — UCC 2026  
> **Alumno:** Salvador Solana Allende  
> **Instructor:** Ing. Ariel Schwindt  
> **Versión Actual:** `v1.0.0` (TP1 Completo)

---

## 📌 Descripción del Proyecto

Aplicación web pensada para centralizar la gestión de información, noticias y actividades deportivas del **Club La Tablada (Córdoba)**. Para el desarrollo del ciclo DevOps de la materia, se trabaja sobre una arquitectura multicapa reducida (*Vertical Slice*):

- **Backend:** Python 3.13 + Django REST Framework (Autenticación JWT).
- **Frontend:** React 19 + Vite (SPA).
- **Base de Datos:** SQLite (desarrollo) / PostgreSQL (producción).

---

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

---

## 📂 Estructura de Documentación del TP1

- **[`decisiones.md`](./decisiones.md):** Contiene la justificación técnica de por qué Git no pudo resolver el conflicto de forma automática, la estrategia de branching seleccionada, los problemas solucionados y la declaración explícita de uso de IA.
- **[`evidencias.md`](./evidencias.md):** Muestra las capturas de pantalla de los 4 momentos clave (Push directo rechazado, Aviso de conflicto en GitHub, Marcadores de conflicto `<<<<<<<` y Release publicada).

---

## 🎓 Guía Rápida para la Defensa Oral (P1 - Clase 5)

| Pregunta de la Cátedra | Concepto / Respuesta Clave |
| :--- | :--- |
| **¿Por qué proteger `main` si trabajás solo?** | Aplica el concepto de *Policy as Code*. Los acuerdos del equipo no dependen de la memoria ni de la buena voluntad, sino de reglas automáticas de la plataforma. |
| **¿Por qué Git no pudo resolver el conflicto solo?** | Porque ambas ramas modificaron la misma línea del mismo archivo. Algorítmicamente (3-way merge), Git no puede adivinar qué versión vale sin arriesgarse a borrar trabajo; requiere una decisión humana de contenido. |
| **¿Qué es una rama en Git?** | No es una copia completa del proyecto, sino un puntero móvil ligero a un commit específico dentro del grafo del repositorio. Por eso crear ramas es instantáneo y barato. |
| **¿Por qué usaron Squash y Merge?** | Reemplaza todos los commits intermedios de una rama de feature por uno solo al integrar a `main`. Mantiene la rama principal limpia: `1 commit = 1 funcionalidad unificada`. |
| **¿Qué mide la versión `v1.0.0`?** | Aplica Versionado Semántico (`MAJOR.MINOR.PATCH`). Indica el primer hito estable y funcional del repositorio (*Baseline*). |
