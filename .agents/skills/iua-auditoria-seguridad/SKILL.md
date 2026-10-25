---
name: iua-auditoria-seguridad
description: Auditar en solo lectura autenticación, autorizaciones por rol y plantel, datos personales, archivos, pagos y secretos del Sistema IUA.
---
# Auditoría de seguridad y privacidad

## Prioridades
1. Partir de `AGENTS.md`, `docs/MATRIZ_ACCESO.md`, `docs/ARQUITECTURA.md` y pruebas de autorización existentes.
2. Trazar entrada HTTP -> guards -> servicio -> `ScopeService` -> consulta. Probar negación cruzada entre planteles y entre alumnos, incluso alterando ID de URL/cuerpo. La UI no sustituye la autorización backend.
3. Verificar JWT, refresh por dispositivo, inactividad de 30 minutos, recuperación/activación, enumeración de cuentas y rate limiting.
4. Revisar subida/lectura de archivos privados, URLs firmadas, validaciones MIME/firma, permisos, caché y ausencia de `useStaticAssets` para expedientes.
5. Revisar idempotencia de pagos y webhooks, auditoría de operaciones financieras y separación del plantel de origen.
6. Comprobar que no se expongan contraseñas, OTP, tokens, certificados, direcciones personales, expedientes de menores o claves Graph/SMTP en código, diffs, logs y artefactos.
7. Ejecutar validaciones existentes de backend y motores SOLO contra entorno aislado o fixtures; no automatizar ataques sobre el dominio institucional.

## Entrega
Hallazgos ordenados por severidad (crítica/alta/media/baja), reproducción segura, impacto, ubicación exacta, prueba que falta y propuesta de corrección. Si falta acceso o evidencia, declararlo; no inventar vulnerabilidades confirmadas.

## Límites
Por defecto solo lectura. Nunca extraer secretos, usar cuentas reales de alumnos, emitir correos/pagos, cambiar permisos, alterar datos o publicar reportes con información identificable.
