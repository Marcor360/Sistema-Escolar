# API — Sistema Escolar MVP

Base: `http://localhost:3000/api` · Autenticación: `Authorization: Bearer <token>` ·
Documentación interactiva: `/api/docs` (Swagger), solo fuera de producción. Los DTO anotados con validadores generan sus esquemas al compilar mediante el plugin oficial `@nestjs/swagger`. `SUPERADMIN` accede a todo.

Para el resumen por rol y las decisiones que requieren validación institucional, consulta
[MATRIZ_ACCESO.md](MATRIZ_ACCESO.md).

## Disponibilidad

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | /health | público | Consulta la conexión de base de datos; devuelve `200` si responde o `503` si no está disponible |

## Autenticación
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | /auth/login | público | Devuelve `accessToken` y la sesión |
| POST | /auth/refresh | público con refresh válido | Rotación controlada por sesión; web usa cookie HttpOnly y móvil envía refreshToken |
| GET | /auth/me | autenticado | Perfil del usuario |
| POST | /auth/logout | autenticado | Revoca la sesión/dispositivo actual y limpia su cookie; baja/cambio de contraseña invalidan todas las sesiones por versión |
| POST | /auth/forgot-password | público | Genera token de recuperación (1 h; se persiste solo su hash sha256) |
| POST | /auth/reset-password | público | Cambia contraseña con el token en claro recibido por correo |
| POST | /auth/cambiar-password | autenticado | Cambio propio (exige la contraseña actual) |

Encabezado `x-portal: WEB|MOVIL` (default `WEB`): decide qué roles pueden iniciar sesión
en `/auth/login` (`WEB` → MAESTRO/ADMINISTRATIVO/FINANZAS/SUPERADMIN; `MOVIL` → ALUMNO) y
la sesión de renovación. Access de 15 minutos en ambos portales; refresh rotativo con
vencimiento máximo de 30 días. Web conserva bearer en memoria y refresh en cookie
HttpOnly/SameSite Strict/Secure en producción; móvil conserva tokens en SecureStore.
No existen JWT_EXPIRES/JWT_EXPIRES_MOVIL como parámetros de vigencia. Errores temporales
al renovar no borran la sesión; un rechazo 401/403 sí exige iniciar sesión nuevamente.
Los intentos fallidos se registran sin almacenar contraseñas ni tokens.

## Paginación
Los listados paginados responden `{ datos, total, pagina, porPagina }` (`pagina` inicia
en 1, `porPagina` por defecto 20, máximo 100). Aplica a: `GET /usuarios`, `GET /usuarios/listado`,
`GET /alumnos`, `GET /academico/grupos`, `GET /docentes`, `GET /finanzas/cargos` y
`GET /finanzas/pagos`, `GET /finanzas/adeudos` y `GET /academico/clases-seleccion`. No aplica a `/calendario` (acotado por rango de fechas), a
los endpoints móviles; el dashboard calcula su resumen en servidor. Conciliación y envíos de cobranza también responden con páginas.

## Usuarios (SUPERADMIN)
CRUD en `/usuarios`. Regla de dominio: `ALUMNO` no se combina con roles de personal.

- GET `/usuarios` (SUPERADMIN) — paginado; parámetros `pagina` y `porPagina`.
- GET `/usuarios/listado` (ADMINISTRATIVO, FINANZAS, MAESTRO, SUPERADMIN) — paginado por tipo.
  Parámetros: `tipo` (`ALUMNO`|`DOCENTE`|`ADMINISTRATIVO`, requerido), `plantelId`,
  `buscar`, `pagina`, `porPagina`. Un `MAESTRO` sin rol de personal solo puede
  consultar `tipo=ALUMNO`, acotado a los alumnos inscritos en sus grupos.

## Planteles
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | /planteles/mios | autenticado | Planteles asignados al usuario (`SUPERADMIN`: todos) |
| GET | /planteles | ADMINISTRATIVO, FINANZAS, MAESTRO | Listado con alcance del usuario |
| GET | /planteles/:id | ADMINISTRATIVO, FINANZAS | Detalle de un plantel dentro del alcance |
| POST | /planteles | SUPERADMIN | Alta de plantel |
| PATCH | /planteles/:id | SUPERADMIN | Edición de datos del plantel |
| PUT | /planteles/:id/director | ADMINISTRATIVO | Asigna director por correo |
| POST | /planteles/:id/personal | ADMINISTRATIVO | Asigna personal existente al plantel |
| DELETE | /planteles/:id/personal/:usuarioId | ADMINISTRATIVO | Retira la asignación |

## Alumnos
| Método | Ruta | Rol |
|---|---|---|
| GET | /alumnos?buscar=&plantelId=&pagina=&porPagina= | ADMINISTRATIVO, FINANZAS, MAESTRO |
| POST /PATCH /DELETE | /alumnos[/:id] | ADMINISTRATIVO |
| GET | /alumnos/me/perfil · /alumnos/me/materias · /alumnos/me/tareas | ALUMNO |

`GET /alumnos` está paginado (ver [Paginación](#paginación)).

## Docentes (ADMINISTRATIVO)
CRUD en `/docentes`. `GET /docentes?plantelId=&pagina=&porPagina=` está paginado.

## Académico
- `/academico/ciclos`, `/academico/materias`: catálogos (escritura: ADMINISTRATIVO).
- `/academico/grupos` (+ `/:id/materias`, `/:id/alumnos`): grupos, asignación de
  materias/docentes e inscripciones. `GET /academico/grupos?cicloId=&plantelId=&pagina=&porPagina=&inactivos=`
  está paginado; excluye grupos dados de baja (`activo=false`) salvo que se pida
  `inactivos=true`, permitido solo a ADMINISTRATIVO/SUPERADMIN. `mis-grupos` aplica la
  misma exclusión. Las consultas directas de actividades, materiales y calificaciones
  de MAESTRO también requieren que el grupo siga activo.
- `PATCH /academico/grupos/:id` (ADMINISTRATIVO): edita `nombre`, `grado`, `turno`; ciclo y plantel son inmutables. Valida alcance por plantel.
- `DELETE /academico/grupos/:id` (ADMINISTRATIVO): baja lógica (`activo=false`).
  Rechaza con 409 si el grupo tiene inscripciones con `estatus=ACTIVA`.
- `DELETE /academico/grupo-materias/:id` (ADMINISTRATIVO): quita una materia asignada
  por error (baja física). Rechaza con 409 si ya existen calificaciones, actividades o
  materiales ligados a esa asignación.
- `/academico/grupo-materias` (ADMINISTRATIVO, FINANZAS): todas las asignaciones.
- `/academico/mis-grupos` (MAESTRO): clases asignadas al docente autenticado.

## Archivos
Los archivos de `uploads/` (materiales de clase y entregas) ya no se sirven como
estáticos públicos: se descargan con un enlace firmado de 5 minutos.

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | /archivos/materiales/:id/enlace | autenticado | Valida la pertenencia y devuelve `{ url }` |
| GET | /archivos/entregas/:id/enlace | autenticado | Ídem para la entrega de un alumno |
| GET | /archivos/materiales/:id?t=&lt;token&gt; | público* | Streaming del archivo (*requiere el token firmado) |
| GET | /archivos/entregas/:id?t=&lt;token&gt; | público* | Ídem para entregas |

El cliente (web/móvil) primero pide el `/enlace` con su sesión normal, y abre la `url`
resultante con `<a>`/`Linking.openURL` — el token vuelve a validarse (firma, expiración
y pertenencia) en el propio streaming.

## Actividades y entregas
- POST `/actividades`, PATCH/DELETE `/actividades/:id` (MAESTRO dueño o ADMINISTRATIVO dentro de su alcance).
- GET `/grupo-materias/:id/actividades` · `/grupo-materias/:id/materiales`.
- POST `/actividades/:id/entrega` (ALUMNO, multipart `archivo`, límite MAX_UPLOAD_MB (5 MB por defecto), formatos permitidos).
- GET `/actividades/:id/entregas` y PATCH `/entregas/:id/calificar` (docente dueño).
- POST `/grupo-materias/:id/materiales` (multipart) para subir material de clase.

## Calificaciones
Actividades son seguimiento independiente; no calculan la nota oficial. El promedio
oficial usa P1-P3 completos; final (parcial 0) es independiente. Corregir una nota
existente exige motivo; una captura idéntica no crea historial ni modifica el registro.
Los periodos cerrados rechazan captura; control escolar puede reabrir dentro de su alcance.
GET/PATCH `/calificaciones/periodos/:grupoMateriaId/:parcial`, GET del mismo prefijo
`/historial` paginado. Cierre requiere todas las notas de inscritos vigentes.
`/calificaciones/mias` usa el ciclo vigente; `cicloId` explícito consulta historial.

- POST `/calificaciones/captura`: captura masiva `{grupoMateriaId, parcial (0=final,1..3), items[]}` con upsert.
- GET `/calificaciones/grupo-materia/:id?parcial=` · `/calificaciones/alumno/:id` · `/calificaciones/mias`.

## Calendario
GET `/calendario?desde=&hasta=&plantelId=` (ALUMNO, MAESTRO, ADMINISTRATIVO; FINANZAS solo recibe 403) · POST/DELETE (MAESTRO, ADMINISTRATIVO).
El MAESTRO recibe eventos globales y de planteles/grupos donde conserva grupos activos; sin
grupos activos solo recibe los eventos globales. No puede crear eventos en grupos inactivos ni ciclos cerrados; las altas de grupo requieren contexto configurable. Un evento de grupo no se muestra a otro grupo del mismo plantel. Los intervalos usan instantes ISO e incluyen los eventos que se solapan; máximo un año.

## Notificaciones
GET `/notificaciones/mias` · PATCH `/notificaciones/:id/leer` ·
POST `/notificaciones/difundir` (ADMINISTRATIVO; por `usuarioIds` o `rol`, limitado a destinatarios de sus planteles). Título 150 y mensaje 600 caracteres; IDs enteros positivos, máximo 500 destinatarios explícitos.

## Finanzas
| Método | Ruta | Rol | Notas |
|---|---|---|---|
| GET | /finanzas/conceptos | FINANZAS, ADMINISTRATIVO, ALUMNO | Catálogo activo |
| POST / PATCH | /finanzas/conceptos[/:id] | FINANZAS | Conceptos de cobro; beca/descuento/recargo siguen su flujo específico |
| GET/POST | /finanzas/cargos | FINANZAS, ADMINISTRATIVO (solo GET) | Filtros `alumnoId`, `estatus`, `periodo`; GET paginado |
| POST | /finanzas/cargos/generar-colegiaturas | FINANZAS | Masivo por ciclo+periodo, idempotente |
| POST | /finanzas/cargos/aplicar-recargos | FINANZAS | % a vencidos, una vez por cargo |
| GET | /finanzas/alumnos/:id/estado-cuenta | FINANZAS, ADMINISTRATIVO | Totales, pagado y saldo por cargo |
| GET | /finanzas/me/estado-cuenta | ALUMNO | Estado de cuenta propio |
| GET/POST | /finanzas/pagos | FINANZAS, ADMINISTRATIVO (solo GET) | Pago manual actualiza estatus del cargo; GET paginado |
| POST | /finanzas/ordenes | ALUMNO, FINANZAS | Crea cargo Openpay y devuelve `urlPago`; los timeouts ambiguos conservan la orden local para conciliación y los reintentos no crean un segundo cargo |
| POST | /finanzas/webhook/openpay | público* | Confirma `order_id`, monto, moneda y tipo; el procesamiento es idempotente (*Basic Auth opcional en desarrollo; requerida en producción*) |
| GET | /finanzas/adeudos | FINANZAS, ADMINISTRATIVO | Cargos con saldo, paginados |
| POST | /finanzas/avisos-cobranza | FINANZAS | Correo con plantilla + notificación in-app |
| GET | /finanzas/bitacora | FINANZAS | Bitácora financiera limitada a los planteles asignados |

`POST /finanzas/pagos` exige `claveIdempotencia` (UUID v4). Un reintento con la misma clave y los mismos datos devuelve el pago original; reutilizarla con datos distintos responde 409. El portal conserva la clave al reintentar el mismo formulario después de un error de red. La columna y su índice único se instalan con `migracion_pagos_manual_idempotencia.sql` antes de desplegar esta versión.

## Reportes
- GET `/reportes/resumen` (ADMINISTRATIVO, FINANZAS): KPIs académicos y financieros de los planteles asignados.
- GET `/reportes/boleta/:alumnoId?cicloId=&inscripcionId=`: boleta PDF propia de alumno o control escolar dentro de scope. Maestro no obtiene boleta institucional completa. Varias inscripciones del ciclo exigen seleccionar una. Nombre institucional viene de configuración de marca, compartido con los clientes.
- GET `/reportes/grupo-materias/:id/calificaciones.xlsx`: concentrado de la clase
  (parciales, final, promedio); el maestro solo descarga sus clases.
- GET `/reportes/adeudos.xlsx`: reporte de adeudos en Excel.

## Operación ampliada y errores de contrato

- Alumnos: POST `/:id/baja`, `/:id/egreso`, `/:id/transferencia`, `/:id/reactivacion`; PATCH solo datos. Altas ALUMNO/MAESTRO se realizan desde expedientes, nunca desde alta genérica de personal.
- Ciclos: POST `/academico/ciclos/:id/activar`, `/iniciar-cierre`, `/cerrar`, reservado a SUPERADMIN con `confirmado=true`; GET `/cierre` resume faltantes.
- Importaciones: POST `/importaciones/preview` multipart y `/confirmar`, plantillas por tipo; previews cifrados persistentes por actor, expiran en 15 minutos y sobreviven reinicios. Promoción `/academico/promocion/preview` y `/confirmar` conserva historial.
- Conducta: `/conducta/incidencias`, interno de maestro/control escolar; no se expone al alumno. Analítica `/analitica`, capacidades académicas y financieras independientes.
- Finanzas: POST `/finanzas/cargos/:id/cancelacion`, `/pagos/:id/anulacion` con motivo. Operaciones masivas requieren plantel, preview y confirmación. GET `/conciliacion/ordenes`, `/conciliacion/pagos`; resolución auditable `/finanzas/ordenes/:id/conciliacion` y `/finanzas/pagos/:id/aplicacion`. Cargos/pagos/órdenes conservan plantel de origen tras transferencias.
- PATCH de materia/concepto/ciclo/grupo exige al menos un campo válido. Omisión conserva valor; null se admite solo donde el dominio lo permite. Fechas DATE usan YYYY-MM-DD; importes respetan DECIMAL(12,2), sin redondear entradas de más de dos decimales. Claves duplicadas producen 409 y recursos inexistentes 404.

Swagger y los DTO/controladores son el contrato detallado por endpoint; esta guía es un resumen operativo.

## Precisiones de 1.18.4

- Enlaces de `/archivos/*/:id/enlace`: JWT de tipo FILE de cinco minutos, ligado a la sesión y versión del usuario. Logout revoca los enlaces de ese dispositivo; cambio de contraseña/estado revoca por versión. Un enlace antiguo sin sid/ver se debe regenerar. Materiales operativos requieren ciclo/grupo/plantel vigente; alumno mantiene lectura de sus entregas históricas.
- PATCH nullable: omitir conserva el dato; null elimina apellido materno, teléfono y campos opcionales del expediente, descripción de actividad y comentarios de entrega. Las respuestas de alumno/docente incluyen el nombre recién actualizado.
- Captura oficial: retirar `observaciones` con null es una corrección real y requiere motivo; guarda historial. Nota y ponderación de actividad admiten como máximo dos decimales.
- Recuperación de una orden CREADA que Openpay confirma completed aplica el pago idempotentemente y devuelve COMPLETADA. Móvil comunica el pago confirmado y recarga el estado de cuenta.
- Eventos: título con contenido después de trim e intervalo no invertido, incluso al indicar solo hasta. Configuración institucional normaliza nombres antes de validar longitud.

Contraseñas nuevas: mínimo ocho caracteres y máximo 72 bytes UTF-8 en altas, edición, cambio y recuperación. El límite cuenta bytes, no caracteres; el login de una cuenta existente mantiene compatibilidad.

El formato nuevo de hash conserva bcrypt y marca que el límite fue validado. El login rechaza entradas con bytes sobrantes para esos hashes. Hashes anteriores conservan compatibilidad para permitir renovar contraseñas; una contraseña legacy excesiva debe renovarse para retirar su truncamiento. La columna de hash existente no cambia.
