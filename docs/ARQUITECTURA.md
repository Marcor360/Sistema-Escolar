# Arquitectura

## Vista general

```
 App móvil (Expo) ─┐
 Portal web (Vite) ─┼── HTTPS/JSON ──> API NestJS ──> MySQL 8  ó  SQL Server 2019+
 Openpay (webhook) ─┘                     │
                                          ├─> /uploads (archivos de tareas y materiales)
                                          └─> SMTP (correos de cobranza / recuperación)
```

## Decisiones clave

**Motor de BD conmutable.** El contrato menciona SQL Server y el cliente pidió
también MySQL. Son motores distintos, así que las entidades TypeORM usan solo
tipos portables y `DB_TYPE` (mysql|mssql) selecciona el driver sin tocar código.
`database/` incluye ambos esquemas SQL equivalentes (23 tablas, snake_case vía
`typeorm-naming-strategies`).

**Autorización.** JWT (passport-jwt) + guard de roles declarativo
(`@Roles('FINANZAS')`). `SUPERADMIN` tiene acceso total. Reglas de dominio:
ALUMNO es excluyente con roles de personal; el maestro solo opera sobre los
grupo-materia que tiene asignados (validación de propiedad en servicios).

**Modelo académico.** `grupo_materias` es el eje: une grupo+materia+docente y
de él cuelgan actividades, materiales y calificaciones. Las calificaciones
tienen unicidad (alumno, grupo_materia, parcial) con parcial 0 = final, lo que
permite captura masiva con upsert.

**Finanzas (SOLID/SRP).** El dominio financiero está dividido en servicios de
responsabilidad única, cada uno sustituible sin tocar a los demás:
`ConceptosService` (catálogo), `CargosService` (cuentas por cobrar: cargos,
colegiaturas masivas en lote, recargos, saldos, adeudos, estado de cuenta),
`PagosService` (pagos de ventanilla y de pasarela), `OrdenesService` (órdenes en
línea + webhook), `CobranzaService` (avisos con plantilla) y
`BitacoraFinancieraService`. `FinanzasController` conserva las rutas y solo
orquesta. Los saldos se calculan con una consulta agrupada (`SUM` por cargo),
sin N+1. Estatus derivado de pagos confirmados: PENDIENTE → PARCIAL → PAGADO;
VENCIDO al aplicar recargos. Colegiaturas idempotentes por (alumno, concepto,
periodo).

**Pasarela.** `OpenpayService` crea cargos con redirección (checkout alojado por
Openpay: el sistema nunca toca datos de tarjeta). El webhook
`/finanzas/webhook/openpay` procesa `charge.succeeded/failed/cancelled` y
`transaction.expired`, registra el pago, recalcula el cargo y notifica al alumno.
Sin credenciales el servicio queda deshabilitado de forma segura (503 explicativo).

**Archivos.** Multer a disco (`UPLOADS_DIR`), nombre UUID, límite 5 MB y lista
blanca de extensiones — el alcance del contrato excluye almacenamiento ilimitado
y antivirus avanzado.

**Seguridad.** Contraseñas con bcrypt; validación con class-validator
(`whitelist: true`); `helmet` para encabezados; rate limiting global de
120 req/min y estricto de 5 req/min en login/recuperación (@nestjs/throttler);
CORS restringible con `CORS_ORIGINS`; webhook de Openpay protegible con Basic
Auth (`OPENPAY_WEBHOOK_USER/PASS`); Swagger deshabilitado con
`NODE_ENV=production`, que además exige un `JWT_SECRET` real; interceptor
global de bitácora para escrituras autenticadas; separación de ambientes por
`.env`.

**Frontend web.** React Router con carga diferida por página (code splitting) y
rutas agrupadas bajo `RutaProtegida` por rol (la API revalida en servidor).
Componentes y utilidades compartidas en `components/` y `utils/` (encabezado,
campana de notificaciones, formatos de moneda y fecha, hook `useDatos` con
carga/error/reintento); calificación en línea en la tabla de entregas; boleta
PDF descargable desde la lista de alumnos; tablas con desplazamiento horizontal
y formularios apilados en pantallas chicas. Comunicación completa: calendario
académico con interfaz, difusión de avisos por rol, recuperación de contraseña
desde el login y cambio de contraseña en Mi cuenta; la app del alumno abre en
una pestaña Inicio con resumen (tareas por entregar, saldo), avisos y próximos
eventos.

## Modelo de datos (resumen)

- Seguridad: roles, usuarios, usuario_roles, password_reset_tokens
- Personas: alumnos, docentes (1:1 con usuarios)
- Académico: ciclos_escolares, materias, grupos, grupo_materias, inscripciones
- Trabajo: actividades, entregas, materiales, calificaciones, eventos_calendario
- Finanzas: conceptos_pago, cargos, ordenes_pago, pagos, plantillas_correo
- Transversal: notificaciones, bitacora_financiera, bitacora_actividad
