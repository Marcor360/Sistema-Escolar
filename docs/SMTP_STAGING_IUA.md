# Correo SMTP de staging (IUA)

Remitente previsto: `plataforma-stagin@iua.edu.mx`. No debe configurarse un host SMTP por conjetura.

## Verificar proveedor

- **GoDaddy cPanel:** abrir cPanel → Cuentas de correo → Connect Devices / Configurar cliente de correo → parámetros manuales. El servidor saliente suele ser `mail.<dominio>`, 465 TLS implícito o 587 STARTTLS; usar el host que aparezca y cuyo certificado sea válido.
- **GoDaddy Professional Email / Titan:** según documentación del proveedor, `smtpout.secureserver.net`, puerto 465 SSL/TLS.
- **GoDaddy Microsoft 365:** confirmar autenticación SMTP habilitada y método admitido por el tenant. Si está deshabilitada o se requiere OAuth2, no usar contraseñas SMTP tradicionales ni desactivar controles; preparar integración específica antes de habilitar el envío.

Fuente oficial cPanel: https://www.godaddy.com/en-ca/help/configuring-mail-clients-with-cpanel-email-8861

## Configuración privada del VPS

En el `.env` **privado** efectivo de la API:

```dotenv
SMTP_HOST=SERVIDOR_CONFIRMADO_POR_EL_PROVEEDOR
SMTP_PORT=465
SMTP_USER=plataforma-stagin@iua.edu.mx
SMTP_PASS=SECRETO_EXCLUSIVO_FUERA_DEL_REPOSITORIO
SMTP_FROM="IUA Plataforma Staging <plataforma-stagin@iua.edu.mx>"
SMTP_REQUIRED=true
```

El puerto 465 es solo ejemplo; use 587 si el proveedor indica STARTTLS. Nunca copiar una contraseña real a esta documentación, a GitHub, a un ticket ni a logs. El transportador Nodemailer existente verifica certificados y exige TLS en staging.

`SMTP_REQUIRED=true` impide iniciar la API cuando falta una variable SMTP esencial. Inicialmente mantener `false` hasta completar el alta del buzón y una prueba de conectividad. Con `false`, el código aún puede simular envíos si falta el host: **no considerar entregadas invitaciones o recuperaciones hasta comprobar recepción real.**

Verificar además SPF, DKIM y DMARC de `iua.edu.mx` con quien administre DNS, sin reemplazar registros existentes a ciegas. Comprobar que el puerto de salida esté permitido por firewall/hosting Windows Server.

## Aceptación antes de fusionar/desplegar

1. `npm run typecheck && npm run lint && npm test -- --runInBand && npm run build` en backend.
2. Configurar SMTP privado en staging y comprobar conexión TLS/autenticación sin imprimir secretos.
3. Solicitar activación de cuenta de prueba pendiente y verificar llegada, vigencia y uso único; nunca enviar códigos de prueba a menores reales.
4. Solicitar recuperación de cuenta de prueba activa y verificar recepción, expiración y revocación de sesiones.
5. Confirmar que la API informa fallos de entrega en logs sin destinatarios, códigos ni contraseñas, y revisar SPF/DKIM/DMARC recibidos.
6. Validar procedimiento de rollback: restaurar `SMTP_REQUIRED=false` y configuración previa si el proveedor falla, sin revertir datos.

Este cambio no implementa OAuth2 para Microsoft 365 ni confirma una conexión SMTP real.
