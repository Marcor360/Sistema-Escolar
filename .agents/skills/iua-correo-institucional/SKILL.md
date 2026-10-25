---
name: iua-correo-institucional
description: Auditar enrutamiento de activación, recuperación y notificaciones GoDaddy/Microsoft 365 por usuario en IUA sin enviar correos reales.
---
# Correo dual y activación

## Fuentes
Leer `docs/CORREO_DUAL_GRAPH_GODADDY.md`, `docs/SMTP_STAGING_IUA.md`, servicios de notificaciones/autenticación, rutas de importación y pruebas.

## Comprobar
1. `usuarios.correo_proveedor` decide el remitente: ALUMNO Microsoft 365 por defecto y personal GoDaddy por defecto; override explícito autorizado, alumno importado exige proveedor.
2. Cada activación, recuperación, invitación y aviso de una cuenta registrada debe usar su preferencia; destinatarios no registrados siguen ruta documentada.
3. Reintentos/outbox y resultado incierto: Graph `202` o aceptación SMTP no demuestra entrega; no cambiar automáticamente al otro proveedor.
4. Validar caducidad OTP, respuesta genérica que no enumere cuentas, reenvío restringido, rate limiting, enlaces y trazabilidad sin PII en logs.
5. Las credenciales, certificado privado y secretos Graph/SMTP viven SOLO en backend seguro, nunca en Expo/web/repositorio.
6. Verificar pruebas unitarias con mocks; recepción real, configuración Exchange/Entra y coexistencia del dominio requieren UAT externa autorizada.

## Resultado
Matriz evento -> destinatario -> proveedor -> cola -> error/reintento -> prueba, con lagunas verificables. No enviar mensajes a cuentas reales por la sola petición de auditar.
