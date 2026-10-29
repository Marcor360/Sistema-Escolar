# Preparación del despliegue del Portal Alumno · 1.34.0

29/oct/2026, America/Mexico_City. Lista operativa para la candidata 1.34.0; no acredita publicación, acceso al servidor ni aceptación institucional.

## Situación comprobada

La app React Native/Expo genera un sitio estático en `mobile/dist/`. La API NestJS es compartida con el administrativo, pero el alumno web entra por `/api/auth/login-alumno-web`, con refresh en cookie HttpOnly y permisos propios. Las pruebas locales y el alcance están en [Boletas y portales](BOLETAS_FIRMADAS_1.34.0.md).

El workflow `Deploy staging` es manual. Su script `scripts/windows/Deploy-Staging.ps1` prepara backend y web administrativo; **no publica el bundle de `mobile/`**. Actualizar `main` no despliega ninguno de los sistemas. Hace falta definir el alojamiento y el procedimiento de publicación/retroceso del Portal Alumno antes de operarlo.

## Antes de un piloto web

| Pendiente | Resultado que debe quedar verificable |
| --- | --- |
| Integrar la candidata y pasar CI | SHA exacto en `main`, CI aprobado, integración completa MySQL/SQL Server y recorridos de navegador. El nuevo recorrido Expo Web se incorpora a CI; usa API simulada y no sustituye la comprobación real. |
| Definir dirección y alojamiento | Dominio HTTPS para el alumno separado del administrativo. Preferir `alumnos.colegio.mx` y `api.colegio.mx` bajo el mismo sitio para la cookie SameSite Strict. Dominios de sitios distintos requieren revisar antes el diseño de autenticación; CORS por sí solo no lo resuelve. |
| Configurar API y servidor | `CORS_ORIGINS` incluye exactamente el origen del Portal Alumno, credenciales habilitadas y proxy HTTPS configurado. `DB_SYNC=false`, secretos fuera del repositorio y health/ready correcto. |
| Respaldo y migraciones | Respaldo de base/uploads y restauración ensayada. Consultar el manifiesto y registro de migraciones del servidor para aplicar solo las pendientes, incluidas cartera integral y boletas/portales. No ejecutar `schema.sql` completo sobre una base existente. |
| Construir y publicar alumno | En `mobile/`: `APP_ENV=preview EXPO_PUBLIC_API_URL=https://api.colegio.mx/api npm run build:web` para piloto. Publicar el contenido de `mobile/dist/` en su sitio, verificar rutas, fuentes, MIME y caché; guardar el artefacto y SHA para retroceso. Usar configuración de producción para la publicación definitiva. |
| Probar con API HTTPS real en staging | Alumno: acceso/activación/recuperación, renovar sesión, cerrar sesión, revocar dispositivo, boletas históricas, PDF/Excel, tutor declarado, revisión de 2000 caracteres y cambio de notas. Personal: permisos de plantel y comentarios solo por materia propia. Probar móvil y escritorio. |
| Confirmar operación | Validar correo de activación/recuperación, escaneo de adjuntos donde corresponde, monitoreo, almacenamiento privado, responsable de incidencias y plan de retroceso. Un retroceso del cliente/API no revierte DDL ni elimina respuestas. |
| Aceptación del piloto | Responsables de plantel verifican los recorridos y dejan evidencia por versión/SHA. Registrar alcance web y usuarios del piloto sin marcar aprobadas pruebas nativas que no se realizaron. |

La firma registra nombre completo, confirmación y tipo de firmante declarado desde la cuenta del alumno; no autentica por separado al tutor ni certifica una firma electrónica oficial.

## Antes de producción general

Completar las evidencias en [BETA_ACEPTACION.json](BETA_ACEPTACION.json) y [matriz UAT](UAT_MATRIZ_2026-10-15.json). Hay ocho puertas institucionales y 62 escenarios pendientes al preparar esta entrega. Las pruebas físicas Android/iOS corresponden a la aceptación del paquete completo y no se pueden dar por realizadas mediante el navegador. Un piloto exclusivamente web debe acordar su alcance y sus pruebas sin alterar esos estados por inferencia.

No se han solicitado ni utilizado credenciales de producción, no se han aplicado migraciones institucionales y no se ha ejecutado el workflow de despliegue.
