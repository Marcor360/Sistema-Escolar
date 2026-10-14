# Requisito del cliente: activación segura de cuentas nuevas

Estado: confirmado en la conversación del 14 de octubre de 2026; especificación pendiente de implementación. No declara un cambio de comportamiento, una migración creada ni un canal de entrega ya aprobado.

## Situación actual

AlumnosService.crear usa la matrícula como contraseña inicial; la confirmación masiva de ALUMNOS también genera su hash y comunica esa regla. Se exige cambio inicial, pero la credencial continúa siendo predecible antes de cambiarla. La matrícula debe conservarse como identificador académico.

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
