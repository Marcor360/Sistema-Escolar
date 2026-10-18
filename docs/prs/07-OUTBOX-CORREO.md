# Outbox SMTP transaccional y recuperación tras reinicio

## Diagnóstico
`backend/src/auth/activacion.service.ts:16-34` usa una cola `Promise<void>` en memoria con máximo 100 pendientes. Un reinicio pierde el trabajo. `backend/src/notificaciones/notificaciones.service.ts` envía vía Nodemailer y la aceptación SMTP no garantiza recepción.

## Arquitectura propuesta sin dependencia de nueva infraestructura
1. Outbox en base institucional mediante entidad TypeORM y **migraciones incrementales equivalentes** MySQL/SQL Server, manifiestos y `DB_SYNC=false`.
2. Registro duradero de **solicitud** sin texto de OTP ni correo completo en logs. Evitar almacenar tokens de activación en claro. Diseñar cifrado autenticado para secretos que deban persistirse, con clave fuera de la DB y política de rotación, o protocolo seguro de reemisión que jamás produzca el primer código inválido.
3. Reservar trabajos por claim atómico, lease temporal, `nextAttemptAt`, contador acotado, backoff exponencial y estado terminal inspeccionable sin filtrar datos privados.
4. Worker con concurrencia limitada que sobreviva a caídas y soporte múltiples instancias sin doble procesamiento concurrente.
5. Modelo de estados: solicitud → token listo/consistente → intento SMTP → aceptado/fallido → reintento/expirado. El token enviado y el hash aceptado deben referirse a **la misma versión**, incluso tras fallos entre commit y SMTP.
6. No indicar “enviado” a usuario si solo se encoló; no permitir enumeración de cuentas.
7. Aplicar también a recuperación de contraseña después de preservar sus contratos actuales; limpiar eventos con retención institucional.

## Pruebas obligatorias
- 100+ solicitudes con límites; SMTP simulado fallido; proceso reiniciado durante envío; workers concurrentes, reintentos y TTL; múltiples códigos y revocación de anteriores.
- Pruebas MySQL/SQL Server sin secretos en bitácora y con conservación de sesiones.

## Bloqueos
Definir retención, duración de tokens y ciclo de vida de reintentos sin generar invitaciones inválidas. Revisión de seguridad antes de fusionar. Este primer PR **documenta el diseño; no introduce una cola persistente falsa**.
