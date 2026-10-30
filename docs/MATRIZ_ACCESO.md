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
- El docente valida sus grupos-materia y que el grupo permanezca activo al consultar alumnos, actividades, materiales y calificaciones.
- Las operaciones globales sobre expedientes docentes se rechazan si incluyen asignaciones fuera del alcance del actor.
- La difusión administrativa filtra destinatarios por planteles asignados; el resumen financiero no está disponible para `MAESTRO`.
- La bitácora financiera se filtra por plantel; los eventos históricos sin plantel asociado solo son visibles para `SUPERADMIN`.
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

## Cuentas con varios roles (1.16.1)

La capacidad depende de la operación. SUPERADMIN es global. ADMINISTRATIVO concede gestión académica en planteles asignados, incluso combinado con MAESTRO. MAESTRO sin ADMINISTRATIVO/SUPERADMIN sigue limitado a clases asignadas aunque también tenga FINANZAS. FINANZAS no concede consulta/captura/exportación de calificaciones, gestión de inscripciones ni conducta. Concede operación financiera por planteles; `/finanzas/alumnos` es el selector mínimo financiero independiente. La analítica suma el bloque financiero a las clases propias del maestro sin ampliar el alcance académico. Calendario GET admite ALUMNO, MAESTRO, ADMINISTRATIVO, FINANZAS y SUPERADMIN; las audiencias internas quedan restringidas a personal administrativo/financiero por plantel y SUPERADMIN.


## Biblioteca y documentos

Biblioteca administrativa: ADMINISTRATIVO por planteles y SUPERADMIN global; MAESTRO, FINANZAS y ALUMNO no reciben acceso por sí solos. Mis documentos en Expo no amplía estos permisos: usa boletas propias por inscripción/ciclo y materiales de clases autorizadas. Cada enlace firmado revalida recurso, sesión y alcance; un catálogo cacheado no concede permiso de descarga.

Calendario PATCH conserva autorización por creador/plantel y valida destino si se solicita cambiar ámbito. No basta que la interfaz muestre el botón.

## Asistencias y seguimiento · 1.27.53

- **Captura de asistencias:** exige rol MAESTRO, expediente activo y asignación actual de la clase. ADMINISTRATIVO y SUPERADMIN no capturan por su rol administrativo; si además son MAESTRO, solo capturan sus clases asignadas. FINANZAS por sí solo no consulta ni captura.
- **Consulta de asistencias:** ALUMNO ve exclusivamente registros propios, incluso al alterar alumnoId; MAESTRO ve sus clases; ADMINISTRATIVO sus planteles y SUPERADMIN global. Histórico conservado, sin sanciones ni cálculo de calificaciones.
- **Trámites:** ALUMNO inicia y consulta los propios, cancela solo antes de atención; ADMINISTRATIVO por plantel y SUPERADMIN gestionan. FINANZAS/MAESTRO no reciben acceso por sí solos.
- **Calidad de datos:** ADMINISTRATIVO por plantel y SUPERADMIN global. Diagnóstico limitado, sin fusiones automáticas.
- **Movimientos bancarios:** FINANZAS por plantel y SUPERADMIN global. Vista previa y confirmación separadas; no acceden alumnos ni docentes por sí solos.
- **Preferencias/sesiones:** cada cuenta ve y modifica únicamente las propias. Revocar requiere sesión autenticada y no expone secretos.
- **Estado de respaldo:** exclusivo SUPERADMIN; la API no ejecuta tareas de sistema ni acepta rutas del cliente.

## Comparativas y correcciones · 1.27.54

Comparativas financieras para capacidad financiera y planteles autorizados; comparativas de inscripciones para capacidad académica, con MAESTRO restringido a sus grupos incluso con FINANZAS. ALUMNO no accede a la analítica institucional. Las guías no conceden permisos. Preview/confirmación de teléfono/CURP requiere ADMINISTRATIVO por plantel o SUPERADMIN global, con verificación del origen y de la revisión en ambas solicitudes.

## Apertura integral y correo posterior · 1.31.0

ADMINISTRATIVO/SUPERADMIN puede crear **alumno sin correo y cartera** en una misma confirmación desde Apertura, o asignar cartera a un alumno activo sin cartera previa. El alta tradicional de `/alumnos` conserva FINANZAS/SUPERADMIN. Las tarifas personalizadas requieren FINANZAS/SUPERADMIN además de permiso para confirmar la parte académica. PAUSA no genera cargos ni participa en agrupaciones; reanudar exige Control Escolar y motivo.

Solo ADMINISTRATIVO/SUPERADMIN dentro del plantel puede asignar por primera vez el correo institucional al alumno desde Usuarios. La invitación se solicita después de guardar la dirección. FINANZAS y MAESTRO no obtienen ese permiso por consultar el listado. ALUMNO sigue sin acceso a gestión. Listados, detalles y resúmenes de cartera para Finanzas/Control Escolar respetan el plantel histórico de la operación; el buscador de elegibles y las mutaciones de apertura siguen reservados a Control Escolar.

## Pendientes de inscripción · 1.32.0

Las categorías de alumnos sin correo, activaciones pendientes y carteras en pausa son administrativas: ADMINISTRATIVO por planteles autorizados y SUPERADMIN global. FINANZAS conserva categorías financieras filtrables; no recibe estos pendientes de acceso por su rol. MAESTRO/ALUMNO no pueden elegir otro plantel para consultar pendientes. El filtro de activación pendiente en Usuarios exige ADMINISTRATIVO/SUPERADMIN. La consulta no invita, reanuda ni cobra. [Contrato](ESTABILIZACION_1.32.0.md).

## Boletas · 1.34.0

ALUMNO firma o solicita revisión solo sobre su boleta final publicada. El firmante ALUMNO/TUTOR es declarado desde esa cuenta. MAESTRO activo consulta inscripciones de clases asignadas, ve solo las calificaciones de sus materias y comenta únicamente en ellas. ADMINISTRATIVO/DIRECTOR leen por plantel y SUPERADMIN global; no suplantan firmas familiares. FINANZAS no recibe acceso. [Contrato](BOLETAS_FIRMADAS_1.34.0.md).

## Atención y constancias de boletas (1.35.0)

ADMINISTRATIVO/DIRECTOR por plantel y SUPERADMIN global asignan responsables activos y registran atención/resolución con motivo. MAESTRO mantiene comentarios solo en sus materias y consulta revisiones de sus grupos con expediente activo; ser responsable no concede gestión ni acceso a otras materias. ALUMNO consulta sus pendientes, respuestas e historial y descarga sus aceptaciones con nombre/confirmación, incluso históricas; el tutor sigue declarado desde su cuenta. Las constancias completas corresponden a familia y gestores, sin acceso adicional para FINANZAS ni MAESTRO. Consultas y descargas vuelven a validar el alcance en servidor.
