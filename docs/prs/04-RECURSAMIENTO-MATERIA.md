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

## Implementación y reglas confirmadas
Se autoriza gestión por SUPERADMIN/ADMINISTRATIVO, con docente existente solo para captura en su clase y ALUMNO para sus consultas. Se reutiliza la clase receptora; no se crea otra `Inscripcion` ni se cambia la principal. Se requieren mismo plantel, ciclo, nivel y carrera/plan configurados, alumno/cuenta activos, clase regular vigente y docente activo.

El cupo total manual obligatorio cuenta regulares y recursantes de esa clase; un cambio se confirma con motivo y bitácora, nunca aplica la excepción automática 51–54. Unicidad activa e idempotencia por UUID; cada nuevo intento después de baja/finalización obtiene identificador independiente. Calificaciones 0–100/parciales 0–3 compatibles con el contrato actual, historial de correcciones y respeto del cierre del parcial. Las notas originales permanecen intactas; no se infiere una regla de acreditación ni se sustituyen promedios automáticamente. No se generan cargos.

Web: recorrido desde el expediente, formulario enfocado y lista paginada; docentes acceden desde su materia a las notas independientes de cada intento. Acta CSV autenticada por intento. Expo consulta intentos propios y notas; materias, actividades y materiales autorizan solo la clase exacta. Los documentos conservan enlaces firmados y revalidación de permisos. Baja, egreso y traslado del alumno terminan sus participaciones sin borrar notas.

Migraciones incrementales espejo y pruebas reales: 3A recursa Matemáticas 2B sin ver Inglés, cupo, doble clic, permisos, acceso a materiales privados, nota original conservada, nuevo intento sin notas heredadas y matrícula principal intacta. No desplegado en staging; acreditación y tarifas institucionales quedan fuera del automatismo.
