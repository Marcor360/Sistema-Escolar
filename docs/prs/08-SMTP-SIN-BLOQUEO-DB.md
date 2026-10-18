# Acortar bloqueo transaccional de activación

## Evidencia
En `backend/src/auth/activacion.service.ts:37-56`, `this.notificaciones.enviarEmail` se ejecuta dentro de `this.ds.transaction` y después de un `pessimistic_write` sobre Usuario. Con SMTP lento, el bloqueo permanece activo hasta su timeout.

## Corrección propuesta
1. Implementar primero el protocolo de outbox duradero del PR de invitaciones. No sustituir directamente con `await enviarEmail` fuera de transacción: una falla intermedia podría invalidar códigos aceptables o emitir códigos no persistidos.
2. Dentro de una transacción **corta**, verificar versión/estado, preparar token + hash y un trabajo de outbox de forma consistente; finalizar commit sin acceso a red.
3. Enviar en worker después del commit y registrar resultado; respetar idempotencia y token de un solo uso. Diseñar reintentos y expiración sin invalidar códigos anteriores por mero retraso SMTP.
4. Medir duración de transacciones antes/después y añadir timeouts y trazas sanitizadas por `x-request-id`/trabajo interno, sin destinatario/OTP.
5. Simular simultaneidad de invitación, recuperación, cambio de contraseña y activación: los tokens antiguos nunca se reactivan.

## Aceptación
No hay llamadas SMTP dentro de transacciones; locks cortos y testados en MySQL/SQL Server; un reinicio nunca deja código recibido inútil ni duplica envíos sin control.

## Estado / dependencia
**Bloqueado por el PR de outbox persistente.** Mantener la implementación actual hasta tener modelo y pruebas coherentes: sacar la llamada a ciegas sería una regresión de seguridad.
