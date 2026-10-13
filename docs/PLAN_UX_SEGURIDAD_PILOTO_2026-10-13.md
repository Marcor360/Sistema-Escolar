# Auditoría UX/UI y ruta hacia piloto — corte del 13 de octubre de 2026

**Repositorio:** `Marcor360/Sistema-Escolar` · **baseline histórico:** `5826253fe84276978ef03b19b0d9a5c392b48c4f` (1.23.1).
**Estado:** revisión estática dirigida de módulos identificados y CI de ramas de trabajo. Las referencias archivo:línea de la sección 1 corresponden al baseline histórico, anterior a los PR de esta ronda. **No es una certificación exhaustiva de todas las líneas ni una prueba de la instancia VPS o de dispositivos físicos.** Los hallazgos requieren verificación de regresión después de cada merge.

## 1. Hallazgos confirmados contra main antes de los cambios

| Severidad | Área y evidencia | Impacto real | Tratamiento |
| --- | --- | --- | --- |
| Alta (UX) | `web/src/styles.css:899-915`, `web/src/layout/Shell.tsx:89-105` | Navegación móvil desplegada verticalmente ocupa la vista y tapa formularios; no entra desde el lateral. | PR #14: cajón del 50 % desde la derecha, cierre con fondo/Escape, gestión de foco, pruebas responsive. |
| Media (UX) | `web/src/layout/Shell.tsx:93-95`; imagen proporcionada por usuario | Cuando falla el origen de `logoUrl`, la UI exhibe imagen rota en vez de identidad alternativa. La causa HTTP específica no fue diagnosticada. | PR #14: monograma alternativo; investigar recurso 404/URL en staging sin exponer uploads. |
| Alta (UX) | `web/src/pages/Docentes.tsx:135-149`, `web/src/pages/Planteles.tsx:77-79`, `web/src/styles.css:795-796` | Columnas densas y acciones difíciles de encontrar en 320–700 px; scroll horizontal y lectura poco intuitiva. | PR #15 docentes y estilos; #16 planteles. |
| Alta (lógica UI) | `web/src/pages/Alumnos.tsx:82-92` | Respuestas asíncronas de filtros/páginas pueden llegar fuera de orden y reemplazar una consulta reciente. | PR #17: correlación e invalidación de respuestas tardías. |
| Media (UX y rendimiento) | `web/src/pages/Grupos.tsx:55-70` | Cada consulta de grupos vuelve a pedir ciclos, planteles y materias, incluso al paginar; además no distingue bien estados de consulta. | PR #19: separar catálogo, proteger carreras, fichas móviles. |
| Alta (UX móvil) | `mobile/src/screens/Materias.tsx:45-54,94-100` | Ante fallo de red al expandir materiales, el mensaje de carga puede permanecer indefinidamente, sin reintento específico. | PR #18: error local por materia, reintento y descarte de respuesta obsoleta. |
| Alta (operación) | `docs/STAGING_WINDOWS_IIS.md:68-74` vs. `scripts/windows/Deploy-Staging.ps1:100-101` | El comando de ejemplo usaba `/api/health`, mientras el despliegue exige `/api/health/ready`; el ejemplo falla al copiarlo. | PR #20: comando y requisitos de salud alineados con implementación. |
| Media (funcional) | `backend/src/calendario/calendario.controller.ts:17-35` | Calendario permite consultar, crear y eliminar, pero **no editar eventos** mediante PATCH. | Próximo PR específico de edición con validación, autorización del origen/destino y conflictos. |
| Brecha de producto (prioridad por definir) | `backend/src/archivos/archivos.controller.ts:13-38`, `backend/src/archivos/logo-publico.controller.ts:5-14` | Existen descargas privadas firmadas y logo público limitado, **no una biblioteca general con carpetas lógicas para fotos y calendarios**. Su ausencia no demuestra una vulnerabilidad. | Entidad y migraciones MySQL/SQL Server para carpetas/metadatos; endpoints y UX en PR separados. |
| Media (UX) | `web/src/pages/Usuarios.tsx:93-97`, `web/src/pages/Calificaciones.tsx:97-106` | Aún hay tablas extensas fuera del patrón de fichas móvil; fechas, notas y acciones requieren revisión de enfoque/lectura. | Modernización posterior sin perder tabla real ni exportación. |
| Alta (riesgo funcional) | `backend/src/auth/auth.service.ts:152-176`, `backend/src/notificaciones/notificaciones.service.ts:99-105` | Sin SMTP, la recuperación acepta solicitud sin entregar correo; comportamiento deliberado, pero **no constituye una prueba de entrega de emails**. | QA de staging simulado separado de proveedor SMTP de producción; conservar respuesta genérica anti-enumeración. |
| Alta (operación/DB) | `scripts/windows/Deploy-Staging.ps1:138-141,177-208` | El rollback de la release no revierte las migraciones ya aplicadas; si hay DDL incompatible puede requerir restauración aislada. | Cambios de esquema expand/contract y restore ensayado; no fusionar migraciones destructivas. |

## 2. Registro de PRs de esta ronda y orden de integración

| Fase | PR | Entregable | Dependencia de merge |
| --- | --- | --- | --- |
| 1 | #14 | Menú móvil derecho al 50 %, accesibilidad y fallback de logo | main |
| 2 | #15 | Listado responsive de docentes y CSS de tabla reutilizable | main |
| 3 | #16 | Planteles y personal legibles, controles visuales según rol | #15 |
| 4 | #17 | Alumnos: tarjetas móviles, filtro y paginación sin carreras | #16 |
| 5 | #19 | Grupos: tarjetas, catálogos independientes, respuesta vigente | #17 |
| 6 | #18 | Expo ALUMNO: materiales, reconexión y reintentos | main |
| 7 | #20 | Documentación operativa staging/health/rollback | main |
| 8 | Este PR | Inventario verificable y siguientes criterios de aceptación | main |

La tabla registra los entregables y las dependencias de la ronda original; no describe el estado actual de GitHub. Los PR #14–#17 ya se integraron en `main`. Consultar cada PR para conocer su estado vigente; después de integrar una dependencia, actualizar la rama y reorientar su base a `main`. El estado de CI varía por SHA: comprobar el último commit y todos los jobs antes de aprobar. Este plan no autoriza un despliegue.

## 3. Fases adicionales propuestas (10 PRs independientes, total planificado: 18)

| Fase | Objetivo | Archivos/módulos candidatos a inspeccionar | Aceptación mínima |
| --- | --- | --- | --- |
| 9 | Listas de usuarios, materias y ciclos | `web/src/pages/Usuarios.tsx`, `web/src/pages/Materias.tsx`, componente de tabla | Responsivo 320/360/768/1440, filtros y acciones accesibles, paginación conservada, estados vacío/carga/error. |
| 10 | Flujo docente y calificaciones | `web/src/pages/Calificaciones.tsx`, `web/src/features/maestro/*`, reportes | Captura/corrección/cierre/reapertura/exportación coherentes; no pérdida de datos; cambios auditados y alcance por clase. |
| 11 | Calendario editable | `backend/src/calendario/*`, `web/src/pages/Calendario.tsx`, DTO y tests | PATCH acotado, intervalo inicio/fin válido, edición propia/autorizada, conflicto por estado obsoleto, persistencia y rol. |
| 12 | Biblioteca: carpeta lógica y metadatos | Nuevo módulo SOLO si conviene frente a reutilizar `archivos`; entidades, migraciones en ambos motores | Lista/crear/renombrar carpeta; integridad por plantel/actor; acceso denegado cruzado; migraciones incrementales compatibles. |
| 13 | Biblioteca: upload y visualización segura | `backend/src/archivos/*`, `web/src/pages/Configuracion.tsx` o nueva vista web por rol | Firma MIME, límites, cuotas, rutas aleatorias y fuera de IIS; archivos privados con permiso por recurso; foto/logo/calendario sin exposición de expedientes. |
| 14 | Autenticación y recuperación verificables | `backend/src/auth/*`, `backend/src/notificaciones/*`, `web/src/pages/Login.tsx` | Rate limit, token de un uso, respuesta no enumerativa, expiración, SMTP simulado explícito y prueba real solo tras configurar proveedor. |
| 15 | Móvil: caché académica de solo lectura | `mobile/src/api/*`, `mobile/src/screens/*` | Segregación por usuario/sesión, retención mínima/cifrado, TTL, limpieza al salir, indicador de desactualización, sin fuga al cambiar de alumno. |
| 16 | Móvil: entregas fiables | `mobile/src/screens/Tareas.tsx`, `backend/src/actividades/*` | Reintentos seguros con idempotencia del servidor; evitar doble entrega ante timeout; estados pendiente/enviando/confirmado/error. |
| 17 | Seguridad, DB y rendimiento por alcance | `backend/src/planteles/scope.service.ts`, controllers/services, `database/{mysql,sqlserver}/*` | Matriz multirol/multiplantel, ALUMNO ajeno 403/404, MAESTRO ajeno, evitar N+1, índices verificados con consulta real; migraciones espejo. |
| 18 | Certificación del piloto y despliegue recuperable | `.github/workflows/*`, `scripts/windows/*`, pruebas web/móvil/integración | CI completo, pruebas reales en navegador y dispositivo, respaldo+restore aislados, migraciones reversibles por compatibilidad, smoke de API pública y rollback comprobado. |

### Criterios obligatorios para **cada PR**

1. Alcance único, archivos y contratos listados; evitar refactorizaciones no relacionadas.
2. Web: `cd web && npm run lint && npm test && npm run build && npm run test:responsive`; solo donde corresponda. Backend: lint, typecheck, build, test e integración en ambos motores. Móvil: `npm test`, `npx tsc --noEmit`, export y QA de dispositivo.
3. Revisar autorización en backend, no inferir privilegios por botón o rutas ocultas. Móvil exclusivamente ALUMNO. Nunca conectar Expo directamente a la DB.
4. Cambios de esquema con entidad TypeORM, migración MySQL y espejo SQL Server. No `DB_SYNC=true`, baseline ni destrucción de datos en ambientes existentes.
5. Comprobar estados de carga/vacío/error/éxito, WCAG AA de la marca actual, teclado, fuente ampliada, foco y anchos de 320 a 3840 px.
6. Merge ordenado con CI verde en último SHA y revisión. Despliegue de staging **manual** desde commit de main con CI aprobado, backup de datos y uploads, health live/ready, y ensayo de rollback. Sin publicación automática a producción.

## 4. Límites de esta auditoría

Esta revisión no ha ejecutado un flujo completo con usuarios reales, no valida una base de datos desplegada ni infiere la causa de un error del VPS únicamente por su guía. No confirma que el logo roto de la captura sea por 404, CORS o permisos: necesita inspección de respuesta HTTP en staging. No asegura WCAG AA para todos los colores institucionales ni certifica recuperación de contraseña sin proveedor SMTP. **Nunca confundir CI verde con autorización de salida a producción.**
