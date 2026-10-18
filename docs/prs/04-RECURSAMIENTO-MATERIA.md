# Recursamiento por asignatura

## Problema existente
`backend/src/entities/inscripcion.entity.ts` vincula un alumno a grupo completo. `backend/src/academico/inscripciones.service.ts:38-40` rechaza otra inscripción activa del alumno dentro del ciclo. Reutilizar ese flujo para recursar inscribiría materias ajenas o desplazaría su grupo principal.

## Modelo a diseñar
Una participación académica ligada a `GrupoMateria`, alumno e intento, con inscripción original intacta, historial de evaluación, estatus y bitácora. Debe permitir conservar más de un intento histórico de la misma asignatura sin duplicados **activos** en el mismo destino.

## Archivos a modificar cuando #97 establezca el contexto
- `backend/src/entities/`, `database/mysql/`, `database/sqlserver/`: entidad y migraciones aditivas; sin alterar notas históricas.
- `backend/src/academico/inscripciones.service.ts`: operación manual propia, verificación por plantel, materia, periodo, estado de grupo, cupo e idempotencia.
- `backend/src/calificaciones/`, `backend/src/actividades/`, `backend/src/reportes/`, `backend/src/alumnos/`: lectura y captura exclusivamente de la asignatura de recursamiento.
- Web: recorrido de “Recursar materia” desde el expediente; Expo: consulta de la materia propia, sin gestión.

## Prueba de aceptación clave
Alumno de 3A recursa Matemáticas en 2B: sigue en 3A, aparece solo en Matemáticas 2B, no en Inglés 2B, y mantiene su nota original e historial. Probar docentes de otro plantel, clases llenas, doble clic, bajas y descargas privadas.

## Decisiones pendientes
Autoridad para aprobar, regla de cupo extraordinario, nota que acredita, periodo y tarifa (si existe). **No inferir** la excepción 51–54 de grupos automáticos para recursantes.

## Estado
Especificación en borrador; no añade ruta de recursamiento hasta validar datos y permisos.
