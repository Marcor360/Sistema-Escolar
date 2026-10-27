# Expedientes, tareas y egresos · 1.27.57 (entrega inicial)

## Diagnóstico del repositorio

La creación de tareas por grupo-materia, entregas de alumno, evaluación 0–100 y comentario del docente **ya existe**: `backend/src/actividades`, `web/src/features/maestro` y `mobile/src/screens/Tareas.tsx`. Los archivos de entrega y material ya se guardan en `UPLOADS_DIR` privado, con UUID, firma/validación y descarga autorizada; **no** están organizados en subdirectorios físicos por materia. La asociación a materia, grupo, alumno y ciclo es relacional. Un cambio a directorios físicos exige actualizar conjuntamente subida, descarga, cola de limpieza y respaldos.

El historial académico ya usa `inscripciones`, `calificaciones`, `historial_calificaciones`, recursamientos y boletas. `EGRESADO` existía, pero no había ciclo/fecha de egreso inmutables ni mecanismo de archivo. `PAUSA` **no** es un estado soportado por `Alumno` (solo ACTIVO, BAJA, EGRESADO), por lo que no es seguro tratarla como baja.

## Entrega de este PR

- Tabla `egresos_alumnos` con FK a alumno y ciclo, única por alumno **y por CURP**. El egreso ocurre dentro de la transacción existente, con bloqueo del alumno, únicamente si el ciclo más reciente es inequívoco, está `CERRADO` y el alumno tiene CURP válida. Ante dos ciclos finales con fecha de fin idéntica, se bloquea para revisión humana, sin elegir al azar. Es una restricción de negocio nueva.
- `fecha_egreso` efectiva y `archivar_desde` a cinco años calendario. Las inscripciones, calificaciones, revisiones y registros financieros originales **se conservan**.
- Vista **Alumnos egresados** separada del listado regular. El historial muestra fecha/ciclo de egreso y fecha a partir de la cual puede archivarse. Los egresos antiguos muestran explícitamente «sin conciliar»; no se inventan fechas ni se autocargan desde el estado legado.
- Servicio opcional `ArchivoEgresosService`: diariamente identifica, en lotes de diez, egresos con cinco años cumplidos y genera **un solo archivo académico `.json.gz` por registro de egreso** en `EGRESOS_ARCHIVE_DIR/ciclo_<id>_<clave>/egreso_<id>.json.gz`. Contiene identidad mínima, inscripciones, notas/revisiones y recursamientos. Tras escribir y releer, verifica SHA-256 y registra la ruta y la huella. La FK/índices únicos impiden registrar el mismo alumno/CURP en dos ciclos. Si falla, permanece pendiente y se reintenta. No incorpora archivos físicos ni registros financieros al .gz.
- No se crean rutas o vistas de gestión en Expo. La aplicación de alumno conserva sus flujos actuales.

## Requisitos previos para habilitar compresión programada

Por defecto, `EGRESOS_ARCHIVO_AUTOMATICO=false`. No encender hasta: aprobación institucional de plazos de conservación y expediente íntegro, mapeo de egresos legados, respaldo y recuperación aislada, directorio persistente **fuera de IIS y de UPLOADS_DIR** con ACL exclusiva del servicio/administradores, revisión de cifrado en reposo y restauración de al menos dos archivos .gz, validación SQL Server/MySQL y consulta legal sobre datos de menores. Definir `EGRESOS_ARCHIVE_DIR` absoluto fuera de releases/junction para evitar pérdida al desplegar. Mantener copias y control de acceso del respaldo fuera del mismo disco.

La compresión automática genera una **instantánea secundaria**, no mueve ni elimina el registro histórico de la base de datos. No es copia SQL restaurable de la base completa ni sustituto del respaldo verificado. No se puede usar el .gz como única copia del expediente.

## Depuración pendiente: no activada por seguridad

Solicitud: eliminar archivos temporales de entregas cuando se haya cerrado académicamente el ciclo y el alumno haya salido, pasado de ciclo, recursado o quedado en pausa. **No** eliminar `calificaciones`, `historial_calificaciones`, boletas, comentarios de evaluación, pagos, inscripciones ni trazabilidad.

La operación requiere una siguiente fase con **cola persistente idempotente** y criterio estricto de elegibilidad:
1. Validar, desde la API y la base, el cierre **CERRADO** de ciclo y de evaluaciones afectadas; «subieron notas» no equivale por sí solo a cierre validado.
2. Identificar por alumno, actividad y ciclo los adjuntos temporales y excluir archivos compartidos, legales o requeridos por una reclamación; distinguir baja, promoción real, recursamiento y pausa (hoy inexistente).
3. Previsualizar conteos/rutas y evidencias por plantel; registrar un lote auditable, con doble aprobación institucional y ventana de recuperación; no ejecutar eliminación irreversible inmediatamente.
4. Registrar en transacción la liberación de referencias y encolar `archivos_limpieza`; ejecutar borrado físico únicamente después de commit, con reintentos, backup restaurable y pruebas MySQL/SQL Server. Conservar calificaciones y comentarios.
5. Validar revocación de enlaces firmados de archivos ya retirados, comprobación de cuotas y consultas del alumno.

## UAT antes de fusionar/desplegar

- Dos egresos concurrentes del mismo alumno → solo uno, sin duplicación.
- Matrícula diferente y misma CURP → el segundo egreso rechazado por índice único (incluidas carreras/planteles distintos).
- Alumno sin inscripción, sin CURP válida, ciclo no cerrado o ciclos finales ambiguos → rechazo sin cambiar alumno/cuenta/inscripciones.
- Egreso legítimo → ciclo correcto, fecha de retención, baja de sesiones, vista web por plantel, historial/boleta disponibles para Control Escolar.
- Egresado anterior sin registro en `egresos_alumnos` → visible pero sin fechas inventadas.
- Dos motores: migración incremental, idempotencia, rollback operativo y restauración aislada.
- Con archivo habilitado en **pruebas** y fecha simulada: archivo por ciclo, gzip legible, hash igual, colisiones/concurrencia, fallo de disco, reintento y ausencia de registros duplicados. No habilitar en staging/productivo sin autorización.

## Estado de implementación

Esta entrega habilita registro único de egreso, consulta y herramienta de archivo segura **deshabilitada por defecto**. La automatización de eliminación de entregas, archivado legal completo, gestión de PAUSA y verificación de adeudos/materias pendientes son **trabajo pendiente**, no se consideran implementados. El Reglamento de Evaluación aún no define qué calificación implica deber una materia, por lo cual el historial evita inferir «aprobado/reprobado» mediante un umbral inventado.
