# Referencias institucionales: ciclos, materias, temarios, docentes y cartera

**Fuente:** las seis capturas que compartió el solicitante el 18/oct/2026. Son ejemplos de **datos y recorridos**, no diseños a copiar. Se conserva la interfaz actual (Onest, tokens, paneles por acción, formulario enfocado, estados, búsqueda y 10 registros por página).

## Qué existe y qué falta en el repositorio (main `19f611c`)

| Referencia | Ya disponible | Diferencia o pendiente |
| --- | --- | --- |
| Ciclo escolar | `CicloEscolar`: clave, nombre, fechas, estado PREPARACION/ACTIVO/EN_CIERRE/CERRADO; consulta y cambio de estado. | No hay una ficha curricular única con vista de sedes, planes, grupos, materias, docentes y avances. |
| Catálogo de materias | `Materia`: clave única, nombre, créditos enteros, tipo OBLIGATORIA/OPTATIVA/ADICIONAL/COMPLEMENTARIA, activo, búsqueda con diez resultados. | El periodo no es un atributo fijo de materia: `materia_contextos` la vincula a `PeriodoAcademico` según plan/sede/ciclo. No existen prerrequisitos entre materias. |
| Materias por docente | `GrupoMateria`: grupo + materia + docente, con permisos y detalle de las clases del profesor. | Puede mejorarse la asignación por docente/plantel sin duplicar la asignación real. |
| Contenido temático | Actividades de clase (título, descripción, tipo, parcial, ponderación de seguimiento y entrega) y materiales privados. | **No existe** temario independiente con índice, fechas de publicación, límite, parcial opcional, adjuntos y cancelación. No reutilizar actividades para simular temarios. |
| Apertura de cartera | API `/cartera` y web: alumno, sede, nivel, carrera, periodo, ciclo, turno, grupo opcional, conceptos, periodo de cargo, vencimiento, cotización, idempotencia y agrupación ordinaria. | Faltan mejora visual del desglose/estado y aceptación con datos reales; los montos se toman de Finanzas, no se introducen manualmente. |
| Expediente de alumno | Alumnos, matrícula, contactos, cuentas por invitación y expediente. | Los datos personales deben mostrarse en lectura durante una apertura, sin duplicar capturas. |

## 1. Ciclo escolar y su contenido

**Datos propios del ciclo:** clave, nombre, fecha inicio, fecha fin, estado y activo. **Configuración asociada:** plantel → nivel → carrera/versión de plan → periodo académico (anual/semestral/cuatrimestral y ordinal) → grupo/turno → materias → docente → alumno/inscripción → cargos. Son relaciones, **no nuevas columnas globales de `CicloEscolar`**. El parcial (P1/P2/P3) de calificación **no es** el periodo académico ni el rango de meses de cobro.

**Pantallas web:** panel de Ciclos con Preparar / Consultar / Editar autorizadas; ficha contextual con resumen de datos, estado y enlaces reales a Catálogos, Materias, Grupos y Apertura de cartera. En una fase posterior, resúmenes agregados desde API sin inventar contadores. SUPERADMIN activa/cierra; ADMINISTRATIVO prepara; FINANZAS consulta contexto; MAESTRO solo sus clases.

## 2. Catálogo y requisitos de materia

Campos: clave, nombre, créditos >= 0, tipo académico y activo/inactivo. La imagen llamada «Requisito de materia» se refiere a **atributos**, no demuestra una relación de seriación o materia prerrequisito. Las asociaciones a plantel/plan/periodo se realizan con `materia_contextos`; las asignaciones de docencia corresponden a `GrupoMateria`, no al catálogo base. Desactivar conserva historial y verifica usos vigentes. UX: consulta paginada → ficha/edición → planes/periodos → grupos/maestros.

## 3. Contenido temático pendiente, independiente de tareas

La referencia muestra: índice/orden, título, texto del tema, fecha/hora inicial y límite, opción sin límite, turno, parcial opcional, cancelado, archivos y enlaces.

**Contrato funcional propuesto (para futura 1.27.0):** tema por `GrupoMateria`; índice positivo y único dentro de la clase, título, contenido, disponibilidad desde/hasta (opcional), parcial informativo opcional, estado de publicación y archivo privado/enlace seguro. Turno y plantel **se derivan de grupo**; el docente no selecciona uno ajeno. Autorización de lectura/escritura y plantel verificada en la API; baja lógica e historial. Validación de fechas y zona horaria, saneamiento de contenido, URLs y adjuntos reutilizando el módulo seguro de archivos.

**No** crear una tarea, entrega, examen, cobro o peso de calificación al registrar un tema. La casilla «evaluación parcial» de la imagen requiere una regla explícita institucional antes de tocar calificaciones. La app Expo permanece solo para ALUMNO y no se incorpora un editor ni se añaden tareas como pantalla nueva. Este módulo requiere entidad, DTOs, API Swagger, migraciones espejo MySQL/SQL Server, web, pruebas de roles, concurrencia y UAT; **no está implementado en este PR**.

## 4. Apertura de cartera: ficha y datos

Recorrido web: localizar alumno por matrícula/nombre con alcance autorizado → mostrar expediente en lectura → elegir plantel, ciclo, nivel, plan/carrera, periodo académico y turno → grupo compatible o agrupación automática ordinaria → seleccionar conceptos **existentes en Finanzas**, periodo de cargo y vencimiento → previsualizar desglose, total y estado de cohorte → confirmar con UUID y cotización → consultar resultado ABIERTA o PENDIENTE y cargos asociados.

La pantalla antigua incluye inscripción y mensualidad como campos libres. Aquí sus importes provienen **exclusivamente de la API** y del catálogo de conceptos. No pedir montos manuales ni guardar cobros sin inscripción; la operación es transaccional y con idempotencia. Agrupación: 1–4 pendientes sin grupo; 5–50 regulares; remanentes 1–4 pueden producir 51–54 solo en grupo compatible. Nunca incorporar recursamiento/programas especiales a la cartera ordinaria. No permitir duplicados alumno/ciclo ni acceso cruzado de plantel.

**Decisión pendiente:** la captura enseña turno `Sabatino`, mientras el DTO actual de cartera admite solo `MATUTINO`/`VESPERTINO`. No añadir un `<option>` sin ampliar consistentemente DTO, grupo, catálogos, controles y pruebas.

## 5. Barrido restante después de PR integrados

| Prioridad | Pendiente comprobado | Acción recomendada |
| --- | --- | --- |
| Alta | Ficha y navegación curricular de Ciclos poco explícitas | PR web incremental de enlaces contextuales y guía, sin inventar endpoint. |
| Alta | Temario distinto de Actividades no existe | PR funcional grande 1.27.0 con modelo, permisos, API, web y pruebas de ambos motores. |
| Media | Selección por docente mejorable | PR UX acotado sobre asignaciones existentes en Grupos; no recrear datos. |
| Media | Cartera opera pero falta UAT institucional y visibilidad de cotización/pending | PR de experiencia y pruebas; no rehacer transacción #116/#117. |
| Alta operativa | Logo del staging sigue en incidente #106 | Diagnóstico IIS/ACL/tamaño y verificación real; pruebas integradas no acreditan staging. |
| Alta operativa | M365 no recibe SMTP, incidente #107 | Message Trace, Track Delivery, DNS/ruteo y pruebas con buzones consentidos. |
| Alta operativa | main sin regla activa (`protected=false`) | Activar protección real tras conseguir revisor; #115 solo versionó su política. |
| Media | #105 UX secundarios, #102 calificaciones, #103 permisos y #96 épica | Cerrar mediante aceptación puntual y PR separados, sin duplicar lo ya fusionado. |
| Media | PR #126 ETL legado abierto | Revisión independiente; no mezclar con ciclo/cartera. |

## 6. Criterios de aceptación futura

Autorización por roles y planteles desde API, no solo botones; las notas de alumnos son sensibles. Estados de carga/vacío/error/éxito; contraste AA, teclado, foco y zoom al 200%; formularios sin pérdida de cambios, responsive y búsqueda remota de diez en diez. Regresiones MySQL/SQL Server, aislamiento de alumnos, doble confirmación, rollback, históricos, vencimientos y control de ciclos cerrados. Versionado por PR, CI verificable y despliegue de staging **independiente del merge**.
