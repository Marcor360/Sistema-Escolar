# SMTP institucional de IUA (staging)

## Configuración confirmada en cPanel

El titular proporcionó los ajustes de **Secure SSL/TLS Settings (Recommended)** desde cPanel para `plataforma-stagin@iua.edu.mx`:

| Campo | Valor |
| --- | --- |
| SMTP host | `mail.iua.edu.mx` |
| SMTP puerto | `465` |
| Seguridad | TLS implícito (SSL/TLS) |
| Autenticación | Requerida, cuenta completa |
| Usuario | `plataforma-stagin@iua.edu.mx` |

Servidor IMAP `mail.iua.edu.mx:993` y POP3 `mail.iua.edu.mx:995` aparecen también en cPanel, pero **no se utilizan** para enviar correos desde la API.

## Variables del entorno privado del VPS

```dotenv
SMTP_HOST=mail.iua.edu.mx
SMTP_PORT=465
SMTP_USER=plataforma-stagin@iua.edu.mx
SMTP_PASS=CONTRASENA_CONFIGURADA_SOLO_EN_VPS
SMTP_FROM="IUA Plataforma Staging <plataforma-stagin@iua.edu.mx>"
SMTP_REQUIRED=true
```

En la plantilla versionada, `SMTP_REQUIRED=false` y `SMTP_PASS` vacío evitan distribuir secretos o impedir el arranque antes de la configuración. Cambiar ambas variables **solo en el archivo .env real del servidor**. Usar una contraseña de aplicación si el servidor la ofrece. Nunca incluir credenciales en GitHub, logs, issues o chats.

El transporte Nodemailer existente interpreta el puerto 465 como TLS implícito (`secure: true`) y exige validación del certificado (`rejectUnauthorized: true`). No deshabilitar TLS para resolver fallas de nombre o certificado.

## Verificación de conexión y entrega

1. Comprobar desde el servidor Windows acceso TCP de salida: `Test-NetConnection mail.iua.edu.mx -Port 465`. Esto solo demuestra conectividad, no autenticación ni entrega.
2. Confirmar que el certificado TLS del servidor sea válido para `mail.iua.edu.mx`.
3. Establecer credenciales privadas y `SMTP_REQUIRED=true` en el entorno efectivo de la API. Reiniciar el servicio de manera controlada.
4. Enviar invitación a una cuenta de prueba pendiente mediante el flujo existente; verificar llegada, caducidad de una hora y consumo único.
5. Solicitar recuperación de una cuenta de prueba activa; verificar entrega del código, uso único y revocación de sesiones.
6. Comprobar SPF, DKIM y DMARC con el administrador DNS sin sobrescribir entradas existentes.
7. Verificar errores de transporte y rebotes sin almacenar ni registrar contraseña, códigos o información personal sensible.

**No se ha confirmado la conectividad del VPS, autenticación SMTP, firma DNS ni recepción efectiva de mensajes.** El proveedor configurado puede aplicar límites de envío y restricciones de conexiones desde un VPS externo.

## Validación y despliegue

Antes de fusionar, ejecutar en `backend/`: `npm run lint`, `npm run typecheck`, `npm test -- --runInBand` y `npm run build`. Las pruebas automatizadas de configuración no equivalen a una prueba de correo real.

La falla SMTP se comunica en los flujos existentes según cada servicio; se debe supervisar operativamente. No habilitar envíos masivos sin observar entregas, rate limiting y disponibilidad.
