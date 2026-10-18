# Programas especiales

Los programas DIPLOMADO, CERTIFICACION, ESPECIALIZACION y EXTRACURRICULAR se registran por plantel y ciclo con fechas dentro de este último. No se precargan programas ni se crean cuentas o roles nuevos. Solo SUPERADMIN y ADMINISTRATIVO con alcance del plantel pueden gestionarlos.

En **Programas especiales**, registra el programa, abre su detalle y crea cada grupo manualmente. Debes indicar un cupo autorizado entre 1 y 10000, una asignatura existente y un docente activo asignado al plantel. El contexto opcional de nivel, carrera/plan y periodo usa los catálogos configurables. No se aplica la capacidad automática de grupos regulares.

La inscripción selecciona alumnos existentes, activos y del mismo plantel. Puede coexistir con una inscripción regular y con otros grupos especiales del mismo ciclo. Los bloqueos transaccionales impiden exceder el cupo ante solicitudes simultáneas. Una baja previa se reactiva conservando el identificador; los duplicados activos se rechazan. No se reduce el cupo por debajo de los inscritos activos.

Las asignaturas permiten reasignar docentes existentes sin modificar las notas. La baja individual exige confirmación y motivo. Cerrar o cancelar exige confirmación y motivo, desactiva grupos e inscripciones especiales y conserva docentes, notas e historial. No se reabre un programa terminado ni se cambia su resolución. Las operaciones se registran en bitácora académica.

Este módulo no genera cargos ni abre carteras. La generación masiva de colegiaturas ordinarias solo considera grupos REGULAR. Los cobros especiales, cuando corresponda, se registran mediante los procedimientos autorizados de Finanzas.

El endpoint `GET /programas-especiales/me` devuelve únicamente las participaciones del alumno autenticado, paginadas, sin información de otros alumnos. La app móvil identifica las materias de grupos especiales y conserva su alcance de consulta propia.

## Instalación

Aplicar la migración incremental `migracion_programas_especiales.sql` del motor utilizado después de `migracion_catalogos_academicos.sql`. Los grupos existentes quedan como REGULAR con programa y cupo manual nulos. Mantener `DB_SYNC=false`; no ejecutar el esquema completo sobre bases existentes. Las migraciones están registradas en `database/baseline-manifest.json`.

## Comprobación

La integración automatizada cubre cupo concurrente, coexistencia regular/especial en ambos órdenes, duplicados, rollback de creación, alcance por plantel y rol, consulta propia, baja/reactivación y cierre conservando notas sin cargos automáticos. Se ejecuta en MySQL y SQL Server.
