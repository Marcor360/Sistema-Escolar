# Requerimiento: biblioteca institucional, calendario, móvil y recuperación

**Estado:** especificación revisada contra `main` 1.23.0 después de fusionar el PR #11. No implementa almacenamiento, edición de eventos, caché ni cambios de autenticación; tampoco certifica producción. Este PR conserva la versión y se complementa con el [requerimiento de edición segura](REQUERIMIENTO_EDICION_INTEGRAL.md).

## 1. Estado actual y evidencia

Las rutas de API de esta sección omiten `/api`, salvo la ruta pública del logo, que está excluida expresamente del prefijo.

| Área | Comportamiento comprobado | Evidencia |
| --- | --- | --- |
| Materiales y entregas | Los enlaces se generan con autenticación y las descargas revalidan recurso, identidad, sesión y alcance. La firma dura cinco minutos. No son URLs públicas permanentes. | [Controlador](../backend/src/archivos/archivos.controller.ts#L14), [firma y sesión](../backend/src/archivos/archivos.service.ts#L152). |
| Logo institucional | Ya hay subida y eliminación para SUPERADMIN, nombres aleatorios, límite de 2 MiB, validación de firma y limpieza del logo sustituido o de una subida inválida. El logo vigente se sirve públicamente en `/uploads/:filename` mediante un patrón restringido; no se publica todo el directorio. | [Subida](../backend/src/configuracion/configuracion.controller.ts#L29), [configuración](../backend/src/configuracion/logo-upload.config.ts), [validación/limpieza](../backend/src/configuracion/configuracion.service.ts#L38), [controlador público](../backend/src/archivos/logo-publico.controller.ts#L8). |
| Almacenamiento | `uploadsPath()` resuelve `UPLOADS_DIR`; bootstrap crea el directorio. Esto no acredita ACL, symlinks, respaldo ni restauración del servidor real. No se inspeccionó su contenido. | [Resolución](../backend/src/common/uploads-path.ts), [bootstrap y excepción del logo](../backend/src/main.ts#L16). |
| Calendario | Hay GET para ALUMNO/MAESTRO/ADMINISTRATIVO y POST/DELETE para MAESTRO/ADMINISTRATIVO; SUPERADMIN tiene acceso según RolesGuard. No hay PATCH. FINANZAS puro no está incluido en esos decoradores. Web ofrece consulta, alta, eliminación y filtros, no edición. | [Controlador](../backend/src/calendario/calendario.controller.ts#L17), [servicio](../backend/src/calendario/calendario.service.ts#L29), [web](../web/src/pages/Calendario.tsx#L44). |
| Modelo del evento | Guarda título, descripción, tipo, inicio/fin, plantel, grupo y creador. No tiene `cicloId` propio. El ciclo de un evento de grupo se relaciona mediante ese grupo; los eventos globales o de plantel no adquieren ciclo por inferencia de fechas. | [Entidad](../backend/src/entities/evento-calendario.entity.ts), baselines [MySQL](../database/mysql/baseline_v1.sql#L233) / [SQL Server](../database/sqlserver/baseline_v1.sql#L231). |
| Conectividad móvil | Expo consulta API con `x-portal: MOVIL`, tokens en SecureStore y renovación coordinada de refresh. Fuera de development exige HTTPS público; en desarrollo permite HTTP/localhost. No accede directamente a MySQL/SQL Server. | [Cliente](../mobile/src/api/client.ts), [configuración URL](../mobile/src/api/config.ts). |
| Datos móviles | App cachea marca en SecureStore. Inicio usa consultas al enfocar y estados locales; el control de lectura impide publicar respuestas anteriores tras otra consulta o al salir. Eso no es caché académica persistente, ni prueba funcionamiento offline. | [Marca](../mobile/App.tsx#L84), [Inicio](../mobile/src/screens/Inicio.tsx#L28), [control de lectura](../mobile/src/api/lectura-vigente.ts). |
| Recuperación | `forgotPassword` invalida tokens anteriores, guarda hash SHA-256 de un token de una hora y llama al servicio de correo. El fallo de entrega se captura y la respuesta externa es uniforme. No implica que el mensaje haya salido o llegado al destinatario. | [Servicio](../backend/src/auth/auth.service.ts#L152), [rate limit](../backend/src/auth/auth.controller.ts#L87), [pruebas existentes](../backend/src/auth/auth.service.spec.ts#L129). |
| SMTP ausente | Sin transporte, `enviarEmail` registra únicamente que no hubo envío y devuelve `{ simulado: true }`; no lanza un fallo. Producción exige host/usuario/password/from, salvo `APP_ENV=staging`. La excepción de staging no acredita preparación de producción. | [Inicialización](../backend/src/notificaciones/notificaciones.service.ts#L29), [envío omitido](../backend/src/notificaciones/notificaciones.service.ts#L100), [pruebas de configuración](../backend/src/notificaciones/notificaciones.service.spec.ts#L45). |

La revisión comprende código y SQL versionado, no el esquema o la infraestructura desplegados. No se configura SMTP ni se envía correo real con este PR.

## 2. Biblioteca institucional propuesta

No confundir una carpeta física con autorización. Reutilizar validación, firma, descarga y limpieza existentes antes de introducir un modelo general de biblioteca. No se acredita hoy una biblioteca con carpetas lógicas de fotografías/calendarios y su interfaz; materiales, entregas, marca y cola de limpieza son capacidades específicas.

Categorías tentativas, **no rutas ni endpoints existentes**:

- Identidad institucional: marca y fotografías autorizadas.
- Plantel: logo local y fotografías.
- Calendario documental: PDF/imagen con metadatos de plantel y ciclo.
- Expediente digital de alumno: solo si se justifica el alcance, siempre privado.
- Materiales y entregas: conservar IDs, referencias y permisos actuales; no migrarlos implícitamente.

Criterios de implementación:

1. Registrar metadatos y permisos por recurso/categoría, propietario, plantel/ciclo cuando proceda, visibilidad, formato, tamaño, hash, actor y fecha. El cliente no elige rutas físicas ni cambia propietario/visibilidad por asignación masiva.
2. Generar nombres aleatorios; validar extensión y firma, límites, cuotas y errores. Reutilizar [validarContenidoArchivo](../backend/src/common/validar-archivo.ts#L6) y evaluar escaneo según el entorno. Rechazar traversal, rutas absolutas y resolución fuera del directorio autorizado; probar symlinks en los sistemas soportados.
3. Dar acceso a carga, vista previa, búsqueda, cambio de nombre lógico, versiones y archivo/borrado conforme a rol y alcance. Un nombre visible puede cambiar sin renombrar el archivo físico ni invalidar referencias.
4. Mantener privadas las categorías sensibles y descargar mediante API con autorización. No convertir los enlaces firmados en permanentes ni reactivar `useStaticAssets`. Si se crea publicación de nuevas categorías, definir quién puede aprobarla y qué datos admite. El logo actual ya es público: no prometer una visibilidad opt-in existente ni cambiar ese contrato sin evaluar consumidores y migración.
5. Coordinar escrituras de archivos, metadatos, reemplazo y eliminación; limpiar huérfanos tras fallo y no borrar un recurso aún referenciado. Definir retención, conservación de historial y recuperación.
6. Guardar bytes fuera del árbol publicado por IIS y mantener `UPLOADS_DIR` persistente. Revisar ACL de mínimo privilegio, servicio API, backup y restauración conjunta de archivos/metadatos en una copia aislada. La creación de directorios en bootstrap no prueba esos permisos.

Si hace falta esquema, preparar entidad y migración incremental MySQL con espejo SQL Server según `AGENTS.md`. No ejecutar `schema.sql` completo, recrear bases ni habilitar `DB_SYNC`. Validar continuidad de logos y archivos existentes antes de mover contenido.

## 3. Calendario editable propuesto

Añadir PATCH y edición web reutilizando el servicio, las políticas y la validación; el endpoint y la UI aún no existen.

- Para una actualización parcial validar el resultado completo contra el evento guardado, incluyendo inicio/fin. Definir omisión, vacío y `null`; no permitir cambios genéricos de ID, creador o campos internos.
- Comprobar autorización sobre el evento actual **y** plantel/grupo de destino. Mantener eventos globales para SUPERADMIN, restricciones de clases del maestro y alcance institucional del administrativo. Decidir explícitamente quién puede corregir un evento ajeno; no inferir permiso solo por poder crear uno.
- Especificar detección de formulario obsoleto, conflicto con borrado y auditoría de cambios sensibles. Responder sin sobrescribir silenciosamente otra actualización.
- Definir asociación al ciclo antes de añadir selector o protección por cierre: no existe campo de ciclo del evento. Para eventos de grupo reutilizar su contexto académico; para globales/plantel decidir si se requiere relación nueva y migración. No asignar ciclos a eventos existentes sin criterio aprobado.
- Conservar calendario documental PDF/imagen como un recurso vinculado, sin sustituir eventos estructurados. Las vistas mensual/semanal/lista y exportación siguen siendo propuestas, no capacidades acreditadas por este PR.
- ALUMNO solo consulta eventos permitidos: actualmente la lista incluye globales, su plantel y sus grupos con inscripción vigente en la ventana temporal. No afirmar que todos los eventos tienen hoy un filtro explícito por ciclo. Un histórico académico ampliado requiere política propia.
- Usar la [convención institucional America/Mexico_City](ARQUITECTURA.md#convención-de-zona-horaria). Distinguir instantes de fechas civiles y probar medianoche, eventos de varios días, calendario invertido, cambio de ciclo y visualización local. `toISOString()` en una ventana de instantes no demuestra por sí solo un fallo de fecha escolar.

Aceptación: consulta/alta/borrado siguen funcionando, edición persiste tras recargar, no se amplía alcance por cambiar plantel/grupo y los conflictos conservan el formulario. Cubrir roles simples/múltiples, ciclo cerrado cuando el modelo lo vincule y rechazo de datos internos.

## 4. Expo: inventario y resiliencia propuesta

Las seis pestañas actuales son Inicio, Materias, Tareas, Calificaciones, Estado de cuenta y Perfil. Avisos/eventos aparecen dentro de Inicio y los adjuntos dentro de los flujos de materias/tareas; no son todas pantallas independientes.

| Vista / flujo actual | API principal | Evidencia y aceptación futura |
| --- | --- | --- |
| Inicio | `/alumnos/me/tareas`, `/finanzas/me/estado-cuenta`, `/notificaciones/mias`, `/calendario` | [Inicio](../mobile/src/screens/Inicio.tsx#L28): distinguir carga inicial, datos anteriores y error; no anunciar sincronización si alguna consulta falla. |
| Materias y materiales | `/alumnos/me/materias`, `/grupo-materias/:id/materiales`, `/archivos/materiales/:id/enlace` | [Materias](../mobile/src/screens/Materias.tsx#L37): generar enlace vigente al abrir; no persistir una firma como descarga permanente. |
| Tareas y entrega | `/alumnos/me/tareas`, `POST /actividades/:id/entrega` | [Tareas](../mobile/src/screens/Tareas.tsx#L34): ya hay envío online y bloqueo local de doble envío; una cola offline/idempotencia sigue pendiente. |
| Calificaciones | `/calificaciones/mias` | [Calificaciones](../mobile/src/screens/Calificaciones.tsx#L29): mantener aislamiento por alumno y contexto académico. |
| Estado de cuenta / pago | `/finanzas/me/estado-cuenta`, `POST /finanzas/ordenes` | [Estado de cuenta](../mobile/src/screens/EstadoCuenta.tsx#L32): no tratar apertura de URL ni un valor cacheado como confirmación de pago. |
| Perfil y contraseña | `/alumnos/me/perfil`, `POST /auth/cambiar-password` | [Perfil](../mobile/src/screens/Perfil.tsx#L36): no convertir consulta y cambio de password en administración o edición genérica del expediente. |

Para una futura caché:

- Clave por usuario y sesión, rol efectivo, plantel/ciclo cuando procedan, recurso y parámetros. Definir TTL y significado de dato desactualizado, revalidación y cancelación de respuestas de una identidad anterior.
- Invalidar al salir, cambiar usuario/credenciales/contexto y tras mutaciones relevantes. No confundir marca pública cacheada con permiso para compartir datos académicos.
- Guardar secretos en SecureStore. Evaluar almacenamiento cifrado y retención mínima para datos personales/académicos/financieros; no persistirlos en texto plano ni guardar tokens dentro del payload de caché.
- Definir alcance offline de solo lectura y sus límites de autorización, especialmente tras expiración/revocación de sesión. Probar reconexión y cambio de usuario sin mostrar datos anteriores.
- Añadir cola de entregas solo con idempotencia de servidor y estados pendientes/enviando/confirmados/error. Tras una respuesta incierta no repetir automáticamente como si no hubiera sido recibida. Nunca declarar entrega o pago confirmado antes de la respuesta del servidor pertinente.
- Mantener Expo limitado al ALUMNO; no incorporar credenciales de BD ni funciones administrativas. Probar HTTPS público en preview/producción, no reutilizar localhost.
- Push continúa optativo: App no pide permiso automáticamente y el backend contacta al proveedor solo con `PUSH_ENABLED=true`. Comprobar consentimiento, token, sesión y dispositivos físicos antes de habilitarlo; mensajes de pantalla bloqueada sin información sensible. Véanse [App](../mobile/App.tsx#L113) y [servicio push](../backend/src/notificaciones/push.service.ts#L63).

## 5. Recuperación sin SMTP: comprobación y trabajo pendiente

No inventar remitente institucional ni afirmar entrega. El comportamiento actual distingue tres casos:

1. Cuenta inexistente/inactiva: respuesta genérica, sin crear token.
2. Cuenta activa y SMTP ausente en desarrollo/staging: invalida tokens anteriores y guarda otro hash en BD; el servicio de correo devuelve `simulado: true`. `forgotPassword` ignora ese resultado y sigue respondiendo **"Si el correo existe, se enviaron instrucciones"** aunque no hubo envío.
3. SMTP configurado pero con fallo: captura el fallo sin exponerlo públicamente y devuelve la misma respuesta. Producción sin configuración completa falla al construir el servicio; no asumir que se puede desplegar allí como en staging.

La uniformidad protege contra enumeración, pero no acredita entrega. El uso de la palabra `simulado` representa envío omitido, no un buzón de pruebas ni un token accesible al usuario.

**Ensayo local ejecutado para esta revisión:** servicios reales con repositorios/configuración en memoria, SMTP ausente en staging y bloqueo de creación de transporte. Se verificó envío omitido, hash y vencimiento en memoria, respuesta idéntica para cuenta registrada/no registrada, log genérico sin destinatario/token y rechazo de producción sin SMTP completo. Sin acceso a BD, red, SMTP ni correo real. No se generaron tokens de cuentas reales.

Ya existen pruebas de [hash, fallo de entrega y consumo de token](../backend/src/auth/auth.service.spec.ts#L95) y [configuración SMTP](../backend/src/notificaciones/notificaciones.service.spec.ts#L45). No confundirlas con acreditación de entrega de un proveedor real o con cobertura completa de todos los casos futuros.

Para el bloque funcional de recuperación:

- Reutilizar forgot/reset y rate limit. Cambiar mensajes y telemetría para que la misma respuesta no prometa envío no realizado; mantener uniformidad, sin devolver token ni revelar existencia de cuenta.
- Definir qué ocurre con tokens anteriores y el token nuevo si no hay transporte o hay entrega incierta; probar expiración, token usado, replay, concurrencia, revocación y longitudes de contraseña.
- Usar transporte y destinatarios simulados, con envío externo bloqueado. `enviarEmail` tiene un remitente de respaldo fuera del requisito completo de producción; no presentarlo como identidad institucional aprobada. Configurar/verificar un remitente real únicamente en la entrega operativa correspondiente.
- Si se requiere restablecimiento administrado, revisar los mecanismos SUPERADMIN existentes de usuarios/personal y el [PR #11](REQUERIMIENTO_EDICION_INTEGRAL.md). No crear rutas duplicadas; definir verificación de identidad, actor/motivo y contraseña temporal con cambio obligatorio antes de ampliar el flujo.

## 6. Hallazgos y prioridad

Estas prioridades indican impacto funcional/operativo de los requisitos; no son una clasificación de vulnerabilidades probadas.

| Código | Evidencia | Prioridad y acción |
| --- | --- | --- |
| CAL-01 | [CalendarioController](../backend/src/calendario/calendario.controller.ts#L17), [EventoCalendario](../backend/src/entities/evento-calendario.entity.ts#L5) | Media: falta edición; diseñar PATCH y política de ciclo antes de agregar selector/histórico. |
| ARC-01 | [Logo público](../backend/src/archivos/logo-publico.controller.ts#L8), [subida](../backend/src/configuracion/logo-upload.config.ts) | Media: no se acredita biblioteca general; preservar el contrato público de marca y las descargas privadas existentes. |
| MOB-01 | [Caché de marca](../mobile/App.tsx#L84), [lectura vigente](../mobile/src/api/lectura-vigente.ts) | Media: caché académica persistente/offline no acreditada; implementar aislamiento e invalidación antes de activarla. |
| AUT-01 | [forgotPassword](../backend/src/auth/auth.service.ts#L152), [SMTP ausente](../backend/src/notificaciones/notificaciones.service.ts#L100) | Media operativa: se conserva un mensaje de envío pese al no envío; corregir sin romper uniformidad. |
| OPS-01 | [Staging](STAGING_WINDOWS_IIS.md), [arquitectura](ARQUITECTURA.md) | Alta para despliegue: CI no sustituye pruebas físicas, ACL, SMTP verificado ni restauración de backups. |

## 7. Entregas A–D y dependencias

A. **Almacenamiento/biblioteca:** inventario sanitizado del servidor y metadatos; permisos, visibilidad, UI y limpieza; migraciones espejo solo si se requieren. Probar acceso ajeno, traversal, symlinks, límites, reemplazo y restauración. La decisión de publicación debe preceder a añadir categorías.

B. **Calendario:** contrato PATCH, permisos sobre origen/destino y política de ciclo; edición web y documentos vinculados cuando exista soporte de biblioteca. Probar fechas, autor, roles, concurrencia, borrado e historial.

C. **Expo:** definir alcance offline y almacenamiento antes de implementar caché segura por identidad/contexto. Probar invalidaciones, expiración, reconexión y confirmación de entregas. Idempotencia de servidor es requisito previo de una cola de mutaciones.

D. **Recuperación y despliegue:** ensayos sin SMTP y mensajes correctos; recuperación administrada conforme al #11; validación de proveedor real solo en el entorno configurado y autorizado. Completar matriz operativa de los bloques implementados.

Cada bloque requiere un PR funcional propio o una partición revisable. Coordinar los cambios de identidad, sesiones y auditoría con el requerimiento de edición integral; no implementarlos dos veces. La versión funcional se decidirá sobre la base vigente: 1.24.0 es una posibilidad MINOR si sigue disponible, no un número reservado ni una versión publicada por este documento.

## 8. Validación documental y condiciones de despliegue

Para este PR: enlaces/rutas y líneas comprobados, diff exclusivamente documental, consistencia de proyecto 1.23.0 y CI del SHA publicado. Las pruebas existentes de archivos, calendario, autenticación y configuración de correo se ejecutan como regresión; no prueban funciones aún no construidas. Los resultados del SHA se registran en el PR.

Antes de desplegar cada bloque funcional:

- CI verde del código definitivo; lint/typecheck/build y pruebas de workspaces afectados, integración MySQL/SQL Server y migraciones espejo cuando correspondan.
- Matriz de roles y cuentas multirrol, negativas de acceso fuera de plantel/grupo, persistencia y recuperación de errores. No habilitar funciones administrativas en Expo.
- Android/iOS físicos, red inestable, renovación/expiración de sesión, cambio de usuario, limpieza de caché y reintentos sin duplicación.
- IIS/ACL y ubicación de archivos, cuotas, firmas, limpieza, backups restaurados y consistencia de referencias. Verificar esquema real mediante metadatos sanitizados, sin datos personales en el reporte.
- SMTP de desarrollo/staging sin enviar correo real; para producción, configuración completa y prueba operativa autorizada. No equiparar aceptación SMTP a entrega final en buzón.
- Accesibilidad AA, teclado, lector de pantalla y mensajes en español para las funciones efectivamente implementadas; reporte de comandos, resultados, límites y reversión.

No se inspeccionaron staging, archivos institucionales, esquema vivo ni dispositivos; no se modificaron SMTP, permisos de Windows/IIS ni proveedores push. Aprobar esta documentación no habilita despliegue ni acredita los bloques A–D.
