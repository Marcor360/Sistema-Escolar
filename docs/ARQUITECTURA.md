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
`database/` incluye ambos esquemas SQL equivalentes (snake_case vía
`typeorm-naming-strategies`).

**Sesiones.** Access de 15 minutos y refresh rotativo con hash persistido, revocable por dispositivo. Cookie HttpOnly/SameSite Strict en web y SecureStore en móvil; bearer web en memoria. Cambio inicial obligatorio para altas y revocación global por versión en baja, contraseña o roles. Aplicar migración espejo de sesiones y actualizar API/clientes juntos.

**Autorización.** JWT (passport-jwt), validación del usuario activo y roles vigentes en base por solicitud, más guard de roles declarativo
(`@Roles('FINANZAS')`). `SUPERADMIN` tiene acceso total. Reglas de dominio:
ALUMNO es excluyente con roles de personal; el maestro solo opera sobre los
grupo-materia que tiene asignados (validación de propiedad en servicios).

**Modelo académico.** `grupo_materias` es el eje: une grupo+materia+docente y
de él cuelgan actividades, materiales y calificaciones. Las calificaciones
tienen unicidad (alumno, grupo_materia, parcial) con parcial 0 = final, lo que
permite captura masiva con upsert. El promedio oficial usa P1-P3 completos, redondeado a un decimal; Final es independiente. Las actividades no calculan esa nota. Véase [REGLAS_PILOTO.md](REGLAS_PILOTO.md).

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
Cada orden admite un único pago por índice único en la base y los reintentos no
duplican pago ni notificación. El pago, el recálculo del cargo y la bitácora se
confirman en una transacción. Si falla la creación externa, la orden local queda
`FALLIDA`; ante un timeout se debe conciliar `ORD-{id}` en Openpay antes de reintentar,
porque el proveedor podría haber creado el cargo aunque la respuesta no llegara.
Sin credenciales el servicio queda deshabilitado de forma segura (503 explicativo).

**Archivos.** Multer a disco (`UPLOADS_DIR`), nombre UUID, límite 5 MB y lista
blanca de extensiones y comprobación básica de firmas; reemplazo confirmado con limpieza del archivo anterior. El alcance del contrato excluye almacenamiento ilimitado
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

## Convención de zona horaria

Los servidores de aplicación y base de datos se configuran en `America/Mexico_City`.
Las fechas civiles de operación (vencimientos, colegiaturas y recargos) se calculan
con esa zona y se almacenan como `DATE`; los instantes se almacenan como fecha-hora.
Los clientes presentan fechas con locale `es-MX`. No se debe usar el día UTC obtenido
con `toISOString()` para decidir vencimientos, porque puede corresponder al día anterior
en México.

## Modelo de datos (resumen)

- Seguridad: roles, usuarios, usuario_roles, password_reset_tokens
- Personas: alumnos, docentes (1:1 con usuarios)
- Académico: ciclos_escolares, materias, grupos, grupo_materias, inscripciones
- Trabajo: actividades, entregas, materiales, calificaciones, eventos_calendario
- Finanzas: conceptos_pago, cargos, ordenes_pago, pagos, plantillas_correo
- Transversal: notificaciones, bitacora_financiera, bitacora_actividad

## Ampliación operativa 1.15.0

Los ciclos separan preparación de vigencia y cierre formal. Las operaciones de calificación bloquean primero el ciclo y después la clase para coordinarse con el cierre. Promoción e importaciones confirman lotes bajo transacción; los previews de importación son temporales en memoria del proceso (15 minutos, máximo cinco por actor), adecuados para un único servidor. Un despliegue de varias instancias requiere almacenar esos previews en un recurso compartido y compartir uploads.

Conducta es un módulo exclusivamente interno; no se importa en móvil y no genera notificaciones. Analítica reutiliza el promedio backend y devuelve indicadores agregados con scope por rol, sin expedientes ni notas internas.

Push usa Expo Push Service desde backend; dispositivos ligados a sesiones y cola persistida en ambos motores. Solo se contacta al proveedor cuando `PUSH_ENABLED=true`. El móvil obtiene permiso y ExpoPushToken con el ID público EAS; el access token del proveedor permanece en backend. Se verifica sesión y dueño justo antes de enviar, y se consultan recibos con límite temporal. Los avisos son genéricos.

La cola `archivos_limpieza` se escribe en la misma transacción que elimina/reemplaza la referencia pública. El worker elimina después de commit y reintenta fallos de almacenamiento; las referencias nunca se descartan silenciosamente. Los DTO rechazados limpian temporales mediante interceptor.

## Integridad operativa 1.16.0

El scope financiero se fija en `cargos.plantel_id`, `pagos.plantel_id` y `ordenes_pago.plantel_id`; una transferencia no modifica esas columnas. Las consultas/acciones financieras y bitácoras usan el origen. El selector financiero solo entrega identificadores y nombres dentro del alcance de expedientes actuales u operaciones propias.

La analítica agrega en DB y devuelve filas por clase; no carga todas las notas/expedientes/entregas para hacer filtros anidados en Node. La regla P1-P3 y la expresión SQL están en `common/promedio-oficial.ts`. El modo histórico depende de ciclo CERRADO y nunca omite materia por desactivación posterior.

`notificaciones.push_pendiente` es un outbox: la cola y la retirada del marcador se confirman en la misma transacción. La recuperación ocurre aun con push externo deshabilitado; no contacta al proveedor hasta habilitarlo.

`cobranza_envios` registra cada destinatario, clave diaria del saldo, actor, lease, intentos y resultado. Estado ENVIANDO con lease vencido pasa a INCIERTO; no se repite automáticamente una transmisión potencialmente aceptada. SMTP no garantiza exactly-once: Message-ID estable ayuda al diagnóstico, pero una incertidumbre se resuelve con verificación del proveedor y confirmación explícita. No se guardan destinatarios/asuntos/cuerpos en logs ni se devuelve email en el seguimiento.
