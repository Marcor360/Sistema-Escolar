# API — Sistema Escolar MVP

Base: `http://localhost:3000/api` · Autenticación: `Authorization: Bearer <token>` ·
Documentación interactiva: `/api/docs` (Swagger). `SUPERADMIN` accede a todo.

## Autenticación
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | /auth/login | público | Devuelve `accessToken` y la sesión |
| GET | /auth/me | autenticado | Perfil del usuario |
| POST | /auth/forgot-password | público | Genera token de recuperación (1 h) |
| POST | /auth/reset-password | público | Cambia contraseña con token |
| POST | /auth/cambiar-password | autenticado | Cambio propio (exige la contraseña actual) |

## Usuarios (SUPERADMIN)
CRUD en `/usuarios`. Regla de dominio: `ALUMNO` no se combina con roles de personal.

## Alumnos
| Método | Ruta | Rol |
|---|---|---|
| GET | /alumnos?buscar= | ADMINISTRATIVO, FINANZAS, MAESTRO |
| POST /PATCH /DELETE | /alumnos[/:id] | ADMINISTRATIVO |
| GET | /alumnos/me/perfil · /alumnos/me/materias · /alumnos/me/tareas | ALUMNO |

## Docentes (ADMINISTRATIVO)
CRUD en `/docentes`.

## Académico
- `/academico/ciclos`, `/academico/materias`: catálogos (escritura: ADMINISTRATIVO).
- `/academico/grupos` (+ `/:id/materias`, `/:id/alumnos`): grupos, asignación de
  materias/docentes e inscripciones.
- `/academico/grupo-materias` (ADMINISTRATIVO, FINANZAS): todas las asignaciones.
- `/academico/mis-grupos` (MAESTRO): clases asignadas al docente autenticado.

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
| GET/POST | /finanzas/cargos | FINANZAS | Filtros `alumnoId`, `estatus`, `periodo` |
| POST | /finanzas/cargos/generar-colegiaturas | FINANZAS | Masivo por ciclo+periodo, idempotente |
| POST | /finanzas/cargos/aplicar-recargos | FINANZAS | % a vencidos, una vez por cargo |
| GET | /finanzas/alumnos/:id/estado-cuenta | FINANZAS, ADMINISTRATIVO | Totales, pagado y saldo por cargo |
| GET | /finanzas/me/estado-cuenta | ALUMNO | Estado de cuenta propio |
| GET/POST | /finanzas/pagos | FINANZAS | Pago manual actualiza estatus del cargo |
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
