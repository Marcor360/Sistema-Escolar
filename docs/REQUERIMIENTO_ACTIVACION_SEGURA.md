# Requisito del cliente: activación segura de cuentas nuevas

Estado: #60–#66 incorporan estructura, API, altas individuales/masivas y pantallas web/Expo. El requisito de eliminar la contraseña derivada de matrícula está implementado para cuentas ALUMNO nuevas. La aceptación operativa sigue pendiente: migración previa al código, SMTP institucional, despliegue coordinado y pruebas físicas. No se considera un servicio desplegado por haber aprobado CI.

## Situación actual

AlumnosService.crear y la importación ALUMNOS generan una contraseña aleatoria no mostrada y guardan activacionPendiente=true. La matrícula queda solo como identificador. El titular elige «Activar mi cuenta» en web o Expo, solicita el código privado y establece su contraseña. La cuenta no puede iniciar sesión antes de activarse y no recibe acceso alternativo si SMTP no funciona. Cuentas históricas conservan su estado; no hay bloqueo masivo ni cambio retroactivo de sus contraseñas.

Auth ya ofrece recuperación con token de un uso y expiración; reutilizar sus reglas y mecanismos cuando proceda, sin presentar recuperación y activación como el mismo estado de negocio. DOCENTES/PERSONAL tienen flujos distintos y deben comprobarse al coordinar la entrega.

## Resultado exigido

Ninguna cuenta ALUMNO nueva, individual o importada, recibe una contraseña derivada de matrícula, nombre, fecha o datos públicos. La persona establece su contraseña mediante una invitación segura.

- Token aleatorio de un uso, guardado mediante hash; nunca en logs, bitácora, XLSX, preview o respuesta pública.
- Caducidad, límites de intentos, invalidación al reemitir y consumo atómico.
- Respuesta uniforme ante solicitudes públicas; no revelar si existe la cuenta.
- Sin acceso académico/financiero antes de completar la activación.
- Auditoría sin credenciales: actor, cuenta, operación y resultado.
- Entrega fallida o incierta no se anuncia como recibida; operación dispone de diagnóstico y reemisión controlada.
- Contraseña establecida conforme a la política vigente y revocación de sesiones cuando corresponda.

## Decisiones necesarias antes de implementar

| Decisión | Criterio |
|---|---|
| Canal de entrega | Acordar correo institucional u otro mecanismo supervisado; no asumir SMTP disponible ni inventar destinatarios |
| Vigencia y reintentos | Definir valores y responsables; no sustituirlos por un número arbitrario en documentación |
| Cuentas existentes | Identificar cuentas sin cambio inicial; definir transición gradual y recuperación sin bloquear masivamente |
| Modelo y despliegue | Determinar si requiere entidad/estado nuevo; si hay esquema, migración aditiva MySQL y espejo SQL Server |
| Reemisión administrada | Validar identidad, permisos, motivo y trazabilidad sin mostrar la contraseña al operador |

## Alcance de la entrega

Actualizar alta individual, importación/confirmación masiva, instrucciones de plantillas, mensajes web/móvil y documentación. Conservar permisos y expedientes existentes. No borrar cuentas, notas, pagos ni matrículas para realizar la transición.

Pruebas necesarias: activación válida, expiración, token usado/reemitido, dos consumos concurrentes, límite de intentos, fallo de entrega, cuenta inexistente, alcance ajeno, alta individual/lote, rollback y recuperación de cuenta existente. Probar persistencia en ambos motores y el canal acordado en staging.

## Criterio de aceptación

Se crean e importan cuentas sin contraseña basada en matrícula; solo el titular con invitación válida establece su contraseña. Tokens vencidos, consumidos o sustituidos se rechazan. Las cohortes existentes tienen un camino de acceso/recuperación comprobado y la documentación describe el comportamiento implementado.

No marcar este requisito como terminado por escribir esta especificación o por aprobar CI sin sus regresiones.

## Estructura y API incorporadas en #60–#61

`usuarios.activacion_pendiente` tiene default false para conservar las cuentas históricas. `activacion_tokens` almacena únicamente SHA-256 de códigos aleatorios de 256 bits, vigencia de una hora y consumo único. La columna `intentos` queda reservada; no existe un contador por cuenta implementado. Los endpoints públicos `POST /auth/solicitar-activacion` y `POST /auth/activar-cuenta` tienen límite por IP (5 por minuto); la solicitud responde de forma genérica. El token viaja solo al correo del titular y no aparece en la respuesta ni en logs. Sin SMTP o con error de envío se conserva el estado pendiente y el titular puede solicitar otro código.

Reemitir invalida códigos anteriores bajo bloqueo por usuario. Activar establece la contraseña validada, elimina el estado pendiente y aumenta `session_version`, invalidando sesiones previas. Login, refresh, JWT, restablecimiento y enlaces firmados bloquean cuentas pendientes. Las pruebas en ambos motores cubren reemisión, consumo concurrente, expiración, contraseña inválida, respuesta genérica y SMTP no disponible. La contraseña derivada de matrícula aún debe eliminarse al conectar las altas; no desplegar la serie como función completa antes de esa etapa y sus clientes.

### Correcciones de revisión de #61

La solicitud encola el correo sin consultar la cuenta ni esperar SMTP antes de responder. La cola en memoria está limitada a 100 trabajos por proceso y no es duradera: un reinicio o saturación puede requerir una nueva solicitud. No se acredita entrega a partir de la respuesta HTTP. La generación, invalidación y aceptación SMTP se serializan bajo bloqueo por usuario, incluso entre instancias. El bloqueo dura hasta la aceptación o timeout SMTP; un fallo revierte la emisión y conserva la invitación previa. El orden garantiza la aceptación por el proveedor; la llegada final al buzón depende de ese proveedor.

Al completar la activación también se invalidan los códigos de recuperación pendientes, en la misma transacción. La emisión de recuperación revalida estado y versión bajo el mismo bloqueo para no introducir un código después de una activación concurrente. Se prueban respuesta independiente de SMTP, reenvíos simultáneos y rechazo de un código de recuperación anterior después de activar.

## Cierre de la conexión de altas y clientes (#62–#66)

La etapa pendiente indicada en los apartados históricos #60–#61 queda incorporada en el código. Alta individual y lote se mantienen atómicos, sin revelar credenciales en respuestas, preview o XLSX. Las pruebas de ambos motores activan alumnos nuevos con códigos capturados por un doble SMTP sintético; esto no acredita entrega institucional. Los clientes evitan envíos duplicados y mantienen errores recuperables sin declarar entrega. Expo sigue siendo exclusivo de ALUMNO.

Se mantienen los límites documentados de cola efímera y rate limit por IP; no existe un contador de intentos por cuenta implementado. Continúan pendientes la limpieza física de copias del selector y las pruebas en Android/iOS, TalkBack y VoiceOver.
