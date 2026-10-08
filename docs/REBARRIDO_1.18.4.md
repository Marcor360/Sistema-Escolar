# Segunda revisión — 1.18.4

Fecha: 8 de octubre de 2026 (America/Mexico_City). Baseline: `f0c3d2e94e6952f9adcbad371741ef0f912048fb` (1.18.3). Commit: **1.18.4**.

Esta revisión busca casos que pueden quedar fuera de una ejecución normal: respuestas fuera de orden, revocación de enlaces, limpieza de datos opcionales, persistencia concurrente y recuperación financiera. Complementa el [barrido anterior](BARRIDO_GENERAL_1.18.3.md); no declara ausencia absoluta de bugs ni certificación de piloto.

## Fallos corregidos

| Área | Antes | Ahora y regresión |
| --- | --- | --- |
| Archivos y sesión | El enlace firmado seguía funcionando tras logout o revocación global mientras el usuario permanecía activo. | Firma específica FILE ligada a sid/ver; comprueba sesión, expiración, versión, cuenta y cambio inicial. Logout de una sesión no revoca otra; incrementar versión revoca ambas. Regresión HTTP con descarga real. Enlaces antiguos sin esos datos requieren generar uno nuevo. |
| Material académico | El acceso comprobaba grupo activo pero ignoraba ciclo/plantel vigente. | Maestro y alumno necesitan contexto vigente para materiales; la entrega histórica propia mantiene la autorización de lectura existente. Prueba de ciclo cerrado y suite de permisos cruzados. |
| Edición de expediente | null pasaba validación pero se ignoraba en varios campos opcionales. El PATCH podía devolver el nombre anterior del usuario relacionado. | Distingue omisión de null; DTOs describen nullable y respuesta recarga la relación dentro de la transacción. Prueba de alumno/docente, persistencia y omisión. |
| Evaluación | No se podía retirar una observación con null. Notas de actividad permitían redondeo de más de dos decimales. | Limpieza explícita con motivo/historial cuando cambia una nota oficial; comentarios de entregas nullable. Precisión de dos decimales como el almacenamiento. Regresión HTTP. |
| Actividad | Guardar una entidad leída antes de una baja podía reactivar la actividad. | Edición bajo bloqueo de fila; conserva el estado actual. Prueba unitaria con lectura antigua y carrera real repetida en ambos motores. |
| Openpay recuperado | Al recuperar una orden ambigua que el proveedor ya había completado quedaba PENDIENTE sin registrar el cobro. | Usa registro idempotente después de liberar el bloqueo de la orden; devuelve COMPLETADA y deduplica el webhook posterior. Proveedor simulado, DB real. |
| Openpay concurrente | Un rechazo tardío o respuesta incongruente podía guardar una copia antigua encima del webhook completado. | El rechazo solo cambia CREADA mediante actualización condicional; si el webhook ya completó la orden, devuelve éxito con COMPLETADA. Una respuesta incongruente no guarda el objeto antiguo. Prueba de webhook antes del rechazo, respuesta HTTP y un solo pago. |
| Consultas móviles | Una respuesta antigua podía borrar un estado recién actualizado o publicar un error al salir de pantalla. | Control de última solicitud en Inicio, Materias, Tareas, Calificaciones y EstadoCuenta; invalida al perder foco. Pruebas con respuestas Axios en orden inverso, fallo antiguo y salida. |
| Doble envío y configuración | Estados React no bloqueaban dos invocaciones inmediatas; el nombre institucional admitía espacios como contenido. | Guardas síncronas de pagos/entregas móviles y configuración web; nombres normalizados, mensajes accesibles y edición preservada tras fallo. Pruebas de formulario. |
| Contraseñas | bcrypt aceptaba contraseñas diferentes cuando compartían los primeros 72 bytes. | Nuevas contraseñas con máximo 72 bytes UTF-8 en altas, edición, cambio, recuperación y seed; límite comprobado antes de hash, incluso fuera del controlador. El formato marcado nuevo rechaza sufijos sobrantes en login y cabe en VARCHAR(100); hashes legacy conservan compatibilidad para renovar contraseña. Rechaza también Unicode mal formado sin provocar URIError en validación. Pruebas de truncamiento real, Unicode y rechazo HTTP. |
| ETL | Fallar al conectar destino dejaba abierta la conexión de origen; un fallo de cierre impedía ejecutar el otro cierre. | ExitStack garantiza cierre de conexiones abiertas incluso en errores. Drivers/dotenv se cargan al operar; CLI --help y siete pruebas con conexiones simuladas no requieren dependencias externas. |
| Calendario | Títulos vacíos tras trim e intervalo hasta anterior al inicio implícito. | Rechaza contenido vacío e intervalos invertidos, también al indicar solo hasta; pruebas de DTO y HTTP. |

## Verificaciones

| Verificación | Resultado |
| --- | --- |
| Backend | npm ci, audit sin vulnerabilidades, lint, typecheck, build y 185 pruebas en 37 suites aprobadas. |
| Web | npm ci, audit sin vulnerabilidades, lint, 25 pruebas y build aprobados. |
| Móvil | npm ci, auditoría aprobada sin excepciones, 17 pruebas de aplicación y cinco del gate, TypeScript y export Android aprobados. |
| ETL | Siete pruebas aprobadas y CLI --help sin drivers externos. |
| Consistencia | 159 consultas cliente contrastadas con 151 rutas API; versiones, README, baseline y migraciones espejo aprobados. |
| PowerShell | Nueve scripts con sintaxis válida; las pruebas nativas de estructura y retención se comprueban en el job Windows de CI. |
| MySQL 8.4 | 76 casos, incluidos tres recorridos reales en Chromium, con DB_SYNC=false. |
| SQL Server 2022 | 73 casos API con DB_SYNC=false. |

Se mantienen strict, lint y DB_SYNC=false; no se recrean bases existentes ni se relajan pruebas. Lint de producción sin avisos any; quedan 526 avisos de mocks de pruebas, sin errores. Las integraciones usan bases nuevas aisladas y directorios de uploads diferentes por motor y ejecución. La CI del SHA publicado se verifica después del push en GitHub Actions; el enlace de la ejecución y el SHA se entregan al cerrar el trabajo.

## Base, inventario y límites

No hay migraciones nuevas ni cambios de DDL. El hash marcado nuevo usa bcrypt y cabe en la columna existente de 100 caracteres; la verificación distingue hashes anteriores. Cuentas antiguas que utilizaran contraseñas de más de 72 bytes necesitan renovarlas para retirar el comportamiento legacy de truncamiento. Para revertir la versión sin bloquear cuentas que ya recibieron un hash marcado, el backend de rollback debe conservar el comparador compatible con ambos formatos. No volver directamente al comparador de 1.18.3 ni retirar marcadores automáticamente.

La revocación usa `sesiones` y `session_version` existentes. La descarga propia de entregas históricas conserva su alcance; la consulta operativa de materiales exige vigencia.

Staging Windows/IIS/HTTPS, dispositivos físicos, build firmado, recepción push, SMTP real, Openpay sandbox y restore institucional siguen sin certificación externa. Los proveedores financieros de las regresiones están simulados. El ETL histórico depende del esquema real de certweb; no se inventan mapeos. Los warnings de mocks se distinguen de los errores del código productivo. No se declara PILOTO LISTO.

## Archivos modificados

- `README.md`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/src/actividades/actividades.dto.ts`
- `backend/src/actividades/actividades.service.spec.ts`
- `backend/src/actividades/actividades.service.ts`
- `backend/src/alumnos/alumnos.dto.ts`
- `backend/src/alumnos/alumnos.service.ts`
- `backend/src/archivos/archivos.service.spec.ts`
- `backend/src/archivos/archivos.service.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/calendario/calendario.dto.ts`
- `backend/src/calendario/calendario.service.ts`
- `backend/src/calificaciones/calificaciones.dto.ts`
- `backend/src/calificaciones/calificaciones.service.ts`
- `backend/src/common/contratos-validacion.spec.ts`
- `backend/src/common/password-bcrypt.spec.ts`
- `backend/src/common/password-bcrypt.ts`
- `backend/src/configuracion/configuracion.dto.ts`
- `backend/src/docentes/docentes.dto.ts`
- `backend/src/docentes/docentes.service.ts`
- `backend/src/finanzas/ordenes.service.spec.ts`
- `backend/src/finanzas/ordenes.service.ts`
- `backend/src/seed/seed.ts`
- `backend/src/usuarios/usuarios.dto.ts`
- `backend/src/usuarios/usuarios.service.ts`
- `backend/test/critical-flows.integration-spec.ts`
- `backend/test/integration/rebarrido.cases.ts`
- `docs/API.md`
- `docs/ESTADO_IMPLEMENTACION.md`
- `docs/REBARRIDO_1.18.4.md`
- `docs/REGLAS_PILOTO.md`
- `etl/README.md`
- `etl/etl/config.py`
- `etl/etl/extract.py`
- `etl/etl/run.py`
- `etl/tests/test_run.py`
- `mobile/app.json`
- `mobile/package-lock.json`
- `mobile/package.json`
- `mobile/src/api/lectura-vigente.test.ts`
- `mobile/src/api/lectura-vigente.ts`
- `mobile/src/screens/Calificaciones.tsx`
- `mobile/src/screens/EstadoCuenta.tsx`
- `mobile/src/screens/Inicio.tsx`
- `mobile/src/screens/Materias.tsx`
- `mobile/src/screens/Tareas.tsx`
- `web/package-lock.json`
- `web/package.json`
- `web/src/pages/Configuracion.test.tsx`
- `web/src/pages/Configuracion.tsx`
