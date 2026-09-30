# Matriz actual de acceso

Resume lo que la API implementa hoy. No sustituye la autorización del servidor: cada operación sensible debe seguir validando rol y plantel/grupo en backend. La institución debe confirmar esta matriz antes de producción.

| Rol | Alcance en servidor | Operaciones principales |
|---|---|---|
| `SUPERADMIN` | Global; omite el filtro de planteles | Administra usuarios y planteles, configuración institucional y puede operar los demás módulos |
| `ADMINISTRATIVO` | Planteles asignados en `usuario_planteles` | Gestiona expedientes académicos, grupos, inscripciones, docentes, calendario y avisos; consulta información financiera permitida |
| `FINANZAS` | Planteles asignados en `usuario_planteles` | Administra conceptos, cargos, colegiaturas, recargos, pagos, adeudos y cobranza; consulta alumnos/planteles necesarios para esas operaciones |
| `MAESTRO` | Grupos-materia asignados al docente | Publica actividades/materiales, consulta alumnos inscritos y captura calificaciones de sus grupos |
| `ALUMNO` | Su expediente y recursos de grupos donde tiene inscripción activa | Consulta materias, tareas, calificaciones y cuenta; entrega trabajos y solicita pagos de cargos propios |

## Reglas implementadas

- `RolesGuard` permite todos los endpoints requeridos a `SUPERADMIN`.
- `ScopeService` resuelve planteles asignados y rechaza IDs fuera de alcance en servidor.
- El docente valida propiedad de sus asignaciones de grupo-materia.
- Las descargas de alumno validan inscripción; las entregas de alumno son propias.
- `ALUMNO` es excluyente con roles de personal. Los roles de personal sí pueden combinarse.
- La protección de rutas web solo refleja la matriz; la API vuelve a aplicar las reglas.

## Confirmaciones institucionales pendientes

- ¿Finanzas debe consultar calificaciones o información académica adicional?
- ¿El personal administrativo puede registrar pagos manuales o solo consultarlos? Actualmente solo `FINANZAS` registra pagos.
- ¿Maestros pueden difundir avisos o consultar calendario institucional global? El código actual limita avisos a `ADMINISTRATIVO` y valida calendario por rol/alcance.
- ¿Se necesita que madres, padres o tutores tengan cuentas separadas? Hoy `ALUMNO` representa al estudiante.
- ¿Los permisos deben variar por nivel escolar, turno o periodo además del plantel/grupo?

Rutas y roles por endpoint: [API.md](API.md). La decisión final debe documentarse por la institución y validarse con cuentas de prueba por rol y plantel.
