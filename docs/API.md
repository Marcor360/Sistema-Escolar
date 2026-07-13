# API — Sistema Escolar MVP

Base: `http://localhost:3000/api` · Autenticación: `Authorization: Bearer <token>` ·
Documentación interactiva: `/api/docs` (Swagger). `SUPERADMIN` accede a todo.

## Autenticación
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | /auth/login | público | Devuelve `accessToken` y la sesión |
| GET | /auth/me | autenticado | Perfil del usuario |
| POST | /auth/forgot-password | público | Genera token de recuperación (1 h; se persiste solo su hash sha256) |
| POST | /auth/reset-password | público | Cambia contraseña con el token en claro recibido por correo |
| POST | /auth/cambiar-password | autenticado | Cambio propio (exige la contraseña actual) |

Encabezado `x-portal: WEB|MOVIL` (default `WEB`): decide qué roles pueden iniciar sesión
en `/auth/login` (`WEB` → MAESTRO/ADMINISTRATIVO/FINANZAS/SUPERADMIN; `MOVIL` → ALUMNO) y
la vigencia del token — la app móvil usa `JWT_EXPIRES_MOVIL` si está definido (por
defecto, más larga que `JWT_EXPIRES` del portal web). Los intentos de login fallidos
(credenciales inválidas o portal incorrecto) se registran en la bitácora de actividad.

## Paginación
Los listados paginados responden `{ datos, total, pagina, porPagina }` (`pagina` inicia
en 1, `porPagina` por defecto 20, máximo 100). Aplica a: `GET /usuarios/listado`,
`GET /alumnos`, `GET /academico/grupos`, `GET /docentes`, `GET /finanzas/cargos` y
`GET /finanzas/pagos`. No aplica a `/calendario` (acotado por rango de fechas), a
`/finanzas/adeudos` (alimenta el resumen del dashboard) ni a los endpoints móviles.

## Usuarios (SUPERADMIN)
CRUD en `/usuarios`. Regla de dominio: `ALUMNO` no se combina con roles de personal.

- GET `/usuarios/listado` (ADMINISTRATIVO, FINANZAS, MAESTRO, SUPERADMIN) — paginado.
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
  misma exclusión.
- `PATCH /academico/grupos/:id` (ADMINISTRATIVO): edita `nombre`, `grado`, `turno`,
  `cicloId`; no permite cambiar el plantel del grupo. Valida alcance por plantel.
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
- POST `/actividades`, PATCH/DELETE `/actividades/:id` (MAESTRO dueño o ADMINISTRATIVO).
- GET `/grupo-materias/:id/actividades` · `/grupo-materias/:id/materiales`.
- POST `/actividades/:id/entrega` (ALUMNO, multipart `archivo` ≤ 5 MB, formatos permitidos).
- GET `/actividades/:id/entregas` y PATCH `/entregas/:id/calificar` (docente dueño).
- POST `/grupo-materias/:id/materiales` (multipart) para subir material de clase.

## Calificaciones
- POST `/calificaciones/captura`: captura masiva `{grupoMateriaId, parcial (0=final,1..3), items[]}` con upsert.
- GET `/calificaciones/grupo-materia/:id?parcial=` · `/calificaciones/alumno/:id` · `/calificaciones/mias`.

## Calendario
GET `/calendario?desde&hasta` (autenticado) · POST/DELETE (MAESTRO, ADMINISTRATIVO).

## Notificaciones
GET `/notificaciones/mias` · PATCH `/notificaciones/:id/leer` ·
POST `/notificaciones/difundir` (ADMINISTRATIVO; por `usuarioIds` o `rol`).

## Finanzas
| Método | Ruta | Rol | Notas |
|---|---|---|---|
| GET/POST/PATCH | /finanzas/conceptos | FINANZAS | Inscripción, colegiatura, recargo, descuento, beca |
| GET/POST | /finanzas/cargos | FINANZAS, ADMINISTRATIVO (solo GET) | Filtros `alumnoId`, `estatus`, `periodo`; GET paginado |
| POST | /finanzas/cargos/generar-colegiaturas | FINANZAS | Masivo por ciclo+periodo, idempotente |
| POST | /finanzas/cargos/aplicar-recargos | FINANZAS | % a vencidos, una vez por cargo |
| GET | /finanzas/alumnos/:id/estado-cuenta | FINANZAS, ADMINISTRATIVO | Totales, pagado y saldo por cargo |
| GET | /finanzas/me/estado-cuenta | ALUMNO | Estado de cuenta propio |
| GET/POST | /finanzas/pagos | FINANZAS, ADMINISTRATIVO (solo GET) | Pago manual actualiza estatus del cargo; GET paginado |
| POST | /finanzas/ordenes | ALUMNO, FINANZAS | Crea cargo Openpay y devuelve `urlPago` |
| POST | /finanzas/webhook/openpay | público* | Confirmación de la pasarela (*Basic Auth si se configura `OPENPAY_WEBHOOK_USER/PASS`) |
| GET | /finanzas/adeudos | FINANZAS, ADMINISTRATIVO | Cargos con saldo |
| POST | /finanzas/avisos-cobranza | FINANZAS | Correo con plantilla + notificación in-app |
| GET | /finanzas/bitacora | FINANZAS | Bitácora de movimientos financieros |

## Reportes
- GET `/reportes/resumen`: KPIs del panel.
- GET `/reportes/boleta/:alumnoId`: boleta PDF (parciales y promedios).
- GET `/reportes/grupo-materias/:id/calificaciones.xlsx`: concentrado de la clase
  (parciales, final, promedio); el maestro solo descarga sus clases.
- GET `/reportes/adeudos.xlsx`: reporte de adeudos en Excel.
