# Activación sin SMTP dentro de transacciones (#122)

## Corrección entregada mediante #121
`ActivacionService.solicitar` confirma una solicitud durable y responde sin SMTP. `CorreoAccesoOutboxService.preparar` usa READ COMMITTED y bloqueos cortos sobre usuario/trabajo para confirmar el hash y el identificador de clave. `enviar` llama a Nodemailer después de resolver esa transacción. No existe una llamada de red dentro de la transacción de emisión.

La recuperación de contraseña usa el mismo protocolo. La activación, el restablecimiento y el cambio de contraseña conservan los bloqueos y comprobaciones de uso único y revocación; un código consumido nunca se reactiva por reintentar. Repetir una solicitud vigente no genera una nueva versión del código.

## Evidencia de concurrencia
`backend/test/integration/outbox.cases.ts` mantiene SMTP detenido, comprueba que el token ya es visible desde otra conexión y confirma una transacción que adquiere el bloqueo de usuario y modifica la versión. Tiene un límite de cinco segundos para detectar locks retenidos, sin afirmar cifras de rendimiento de producción. Pruebas adicionales cubren dos workers, leases, reinicios, códigos/hashes consistentes y cambio de estado/versión; `beta.cases.ts` comprueba consumo concurrente, caducidad y aislamiento entre activación/restablecimiento.

Las transacciones se limitan a DB; SMTP conserva sus timeouts y el worker usa claim/lease. Una caída entre aceptación SMTP y confirmación puede repetir el mensaje con el mismo código: entrega al menos una vez, sin promesa de exactamente una vez ni de Inbox.

## Operación
La migración y las claves externas se configuran según [07-OUTBOX-CORREO.md](07-OUTBOX-CORREO.md) antes del despliegue. Este PR cierra la dependencia técnica y deja documentada su verificación; no duplica el worker ni inventa otro mecanismo de tokens. La incidencia externa #107 y la configuración de staging siguen abiertas.
