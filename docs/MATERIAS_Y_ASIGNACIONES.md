# Materias y asignaciones docentes (#101)

La materia conserva una única identidad y su clave/créditos. `tipo` acepta OBLIGATORIA, OPTATIVA, ADICIONAL o COMPLEMENTARIA; es nullable para que la migración no invente clasificaciones de registros anteriores. La interfaz permite elegirlo y omite Descripción en altas/ediciones; su columna y contenido histórico permanecen y la API legada conserva compatibilidad.

`materia_contextos` vincula una materia con varios periodos académicos existentes sin duplicarla por plan o sede. Cada periodo determina su carrera/versión de plan, nivel, plantel y ciclo. Los vínculos son de catálogo: no trasladan alumnos, no reasignan clases y no sustituyen el contexto de GrupoMateria. Se pueden retirar lógicamente y reactivar, conservando identidad y auditoría. Los programas especiales siguen reutilizando las materias existentes.

- `GET /api/academico/materias/:materiaId/contextos`: ADMINISTRATIVO/FINANZAS y SUPERADMIN; diez por página, máximo cien, solo planteles autorizados mediante ScopeService.
- `POST` sobre esa ruta, `{periodoAcademicoId}`: ADMINISTRATIVO/SUPERADMIN, contexto activo y del alcance del actor; duplicados 409.
- `DELETE .../contextos/:id`: retira lógicamente, validando el plantel del vínculo. No borra clases ni periodos.
- `DELETE /api/academico/materias/:id` sigue reservado a SUPERADMIN. Una materia con clases en grupos/ciclos vigentes no se desactiva.

El detalle de docente devuelve por clase grupo, ciclo, plantel, nivel, carrera, versión de plan, periodo, turno y materia. Se obtiene del grupo existente y se filtra por alcance; los históricos sin esos datos se muestran como no registrados, sin asignar valores supuestos.

Antes de desplegar, aplicar `migracion_materias_contexto.sql` con el runner y DB_SYNC=false para MySQL/SQL Server. La migración no modifica descripciones, notas, inscripciones ni asignaciones. No ejecutar schema.sql completo sobre una base existente.

Verificación: regresiones de permisos y asignación, clasificación explícita, conservación de descripción, una materia en dos planteles/planes con aislamiento, doble vínculo concurrente, baja lógica/reactivación y contexto docente completo, en ambos motores. La aceptación institucional y el despliegue son pasos independientes de la integración del código.
