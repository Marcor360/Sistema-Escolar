# Publicar en el servidor que ya tienen

No hace falta contratar otro hosting si el servidor permite ejecutar Windows Server, IIS y Node, cuenta con recursos suficientes y tiene salida a Internet. Tener un servidor todavía no determina si es accesible desde fuera: primero hay que conocer su sistema operativo, IP pública y quién administra el router/firewall.

## Datos necesarios para configurar

Registrar sistema operativo, IP pública o dirección del proveedor, acceso administrativo, dominio disponible y responsable. Las contraseñas van en configuración segura, nunca en README, Git ni chat. Si el servidor está dentro de la escuela, el administrador de red debe confirmar si tiene IP pública y abrir/redirigir HTTPS; con CGNAT se necesita una solución del proveedor o túnel administrado. Si es VPS, comprobar firewall del proveedor y de Windows.

## Ruta de publicación Windows

1. Ejecutar `scripts/windows/Audit-StagingHost.ps1` en el servidor y revisar el resultado. Confirmar almacenamiento para base, uploads y backups.
2. Preparar dos nombres DNS, por ejemplo `escolar.dominio.mx` y `api-escolar.dominio.mx`, apuntando al servidor; configurar certificado válido que cubra ambos y puerto HTTPS 443.
3. Instalar los componentes descritos en [STAGING_WINDOWS_IIS.md](STAGING_WINDOWS_IIS.md): Node 24, MySQL 8.4, IIS, ARR, URL Rewrite y NSSM. La API escucha en `127.0.0.1` detrás de IIS; no abrir MySQL ni el puerto interno de Node a Internet.
4. Preparar `.env` externo al repositorio, usuario DB con permisos mínimos y TLS, `DB_SYNC=false`, `NODE_ENV=production`, `CORS_ORIGINS=https://escolar.dominio.mx`, `JWT_SECRET` real y directorio persistente de uploads. Compilar web con `VITE_API_URL=https://api-escolar.dominio.mx/api`; móvil con `EXPO_PUBLIC_API_URL` correspondiente. Los nombres web/API deben compartir el dominio para la cookie SameSite Strict.
5. Base nueva: instalar el baseline versionado y adoptarlo según la guía; base histórica: ensayar copia aislada y validar esquema antes de adopción. Consultar/aplicar migraciones con `db:migrate:status` y `db:migrate`. No ejecutar `schema.sql` completo sobre una base existente.
6. Inicializar la estructura de releases y servicio con `Initialize-Staging.ps1`; configurar IIS con `Configure-IIS-Staging.ps1`. Revisar sus parámetros antes de ejecutar. Despliegues siguientes con `Deploy-Staging.ps1`, cuya comprobación final usa `/api/health/ready` para exigir migraciones aplicadas.
7. Desde una red externa comprobar portal, login, `/api/health/live` y `/api/health/ready`. Verificar TLS y que ni DB ni API interna sean accesibles directamente. Configurar monitoreo externo de readiness, espacio libre, backup y vencimiento TLS con responsables.
8. Respaldar DB y uploads, cifrar copia fuera del servidor y restaurar realmente en `escolar_staging_restore_*` con `Restore-Staging.ps1`. Comparar conteos y descargas; registrar RPO/RTO observado sin datos personales.
9. Certificar SMTP y Openpay sandbox, QA de dos planteles y roles, Chrome/Edge y Android físico. `mobile/eas.json` permite APK interno en preview; `eas build --platform android --profile preview` requiere cuenta Expo y firma. No sustituir la prueba física por `expo export`.

## Prueba de consultas con carga

`scripts/performance/consultas.cjs` mide consultas GET sin imprimir tokens, cuerpos ni datos personales. Definir `PERF_API_URL` (terminado en `/api`), `PERF_PATHS` (por ejemplo `/auth/me,/academico/grupos`), `PERF_ACCESS_TOKEN` de una cuenta QA, `PERF_PORTAL`, `PERF_REQUESTS` y `PERF_CONCURRENCY`; ejecutar con Node. Usar cuentas de cada rol para sus rutas autorizadas. Devuelve p50/p95/p99 y códigos HTTP; incluye 429 como fallo, sin desactivar rate limiting. Empezar con 20 solicitudes y concurrencia 2. Captura y pagos tienen pruebas transaccionales, pero esta herramienta no simula escrituras masivas ni certifica capacidad del servidor.

## Gate de salida

Servidor existente no equivale a piloto listo. La Fase 5 requiere evidencia real de HTTPS, permisos cruzados, restore, SMTP, Openpay certificado o deshabilitado, dispositivos, navegadores, privacidad y responsable de operación. El acta final se emite después de esas pruebas, indicando versión/SHA, resultados, incidencias, alcance y rollback. Actualmente no existe esa certificación.

Rollback: conservar release previa y backups verificados. Cambiar código no revierte automáticamente migraciones ni datos. La migración de sesiones es aditiva; volver al cliente/API anterior requiere evaluar compatibilidad y reiniciar sesiones. No restaurar producción sin un plan que considere operaciones posteriores al backup.
