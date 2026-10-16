# Preparación de operación productiva

Este documento separa lo configurable en el repositorio de lo que depende del hosting, dominio, institución o proveedor. La configuración local actual no es una instalación productiva.

## Alcance y punto de partida

El repositorio dispone de scripts Windows/IIS y workflow manual de staging, pero su presencia no acredita instalación, tareas programadas ni operación del servidor institucional. Los datos de una máquina local antigua no describen el entorno actual.

Antes de intervenir: auditar el host con Audit-StagingHost.ps1, identificar motor/versión, consultar migraciones, verificar almacenamiento y responsables.

Para comprobar de forma **no destructiva** que una API de staging responde con la versión prevista, ejecutar desde PowerShell (sin escribir credenciales ni consultas institucionales):

```powershell
.\scripts\windows\Test-PilotReadiness.ps1 -ApiBaseUrl 'https://api.staging.ejemplo.mx' -ExpectedVersion '1.25.0-beta.1' -OutputPath '.\pilot-readiness.json'
```

Este diagnóstico consulta únicamente `/api/health/live` y `/api/health/ready`; no valida antivirus, pagos, correo, respaldo o UAT. Nunca se aceptan certificados TLS sin validación y no sobrescribe el informe existente.
 No leer ni copiar secretos de .env a un reporte. Usar [staging Windows](STAGING_WINDOWS_IIS.md) y [servidor existente](PUBLICAR_SERVIDOR_EXISTENTE.md) para la configuración específica.

## Secretos y variables

En producción, inyectar las variables desde el gestor de secretos del proveedor; no copiar `.env` al repositorio, imagen o logs. Como mínimo definir y comprobar:

- Base: `DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` y `DB_SYNC=false`.
- Sesión y red: `JWT_SECRET` aleatorio y exclusivo del entorno, `NODE_ENV=production`, `CORS_ORIGINS` con los orígenes reales y `PORT`.
- Archivos: `UPLOADS_DIR` persistente y límites de carga revisados.
- Correo: host, puerto, usuario, contraseña y remitente SMTP.
- Openpay: credenciales de producción, URL base productiva, URL de retorno y credenciales de autenticación del webhook.

La aplicación apaga Swagger y rechaza el secreto JWT de ejemplo en producción. El webhook admite autenticación Basic opcional; para producción debe configurarse y validarse con la cuenta real de Openpay antes de recibir pagos.

Cada petición autenticada comprueba que la cuenta siga activa y tenga los roles vigentes. Cambiar o restablecer una contraseña incrementa `session_version` y revoca los JWT anteriores; las bases existentes deben aplicar `migracion_version_sesion.sql`. El rate limit actual usa almacenamiento en memoria del proceso; con varias réplicas se debe configurar almacenamiento compartido para mantener límites globales.

La API exige TLS para la base cuando `NODE_ENV=production`: MySQL usa `DB_SSL=true` y valida el certificado (se puede indicar `DB_SSL_CA_PATH` para una CA privada); SQL Server requiere `DB_ENCRYPT=true` y `DB_TRUST_SERVER_CERTIFICATE=false`. La configuración de ejemplo conserva valores para desarrollo local.

## Base de datos y recuperación

1. Elegir formalmente MySQL o SQL Server y fijar las versiones soportadas.
2. Crear una base y un usuario de aplicación con los permisos mínimos requeridos.
3. Para una base vacía, aplicar el baseline versionado correspondiente (`database/mysql/baseline_v1.sql` o `database/sqlserver/baseline_v1.sql`). Nunca aplicar un baseline a una base existente; `schema.sql` sigue siendo documental.
4. En bases existentes, aplicar solo las migraciones pendientes mediante el procedimiento de [MIGRACIONES.md](MIGRACIONES.md), después de un respaldo verificado.
5. Programar respaldos cifrados, retención y copia fuera del servidor principal.
6. Probar restauraciones periódicas en un entorno aislado y registrar duración y resultado.
7. Alertar por errores de conexión, espacio, crecimiento, respaldos fallidos y latencia.

El repositorio incluye Deploy-Staging.ps1, Restore-Staging.ps1 y Prune-Staging.ps1. No configura por sí solo tareas de respaldo, copias externas ni un servicio administrado. Restore exige un destino aislado y vacío; su ejecución institucional, duración y resultado deben comprobarse.

## Archivos subidos

La API escribe en `UPLOADS_DIR` y los entrega mediante el módulo `archivos` con enlaces firmados de corta vida. En una sola instancia, montar almacenamiento persistente y respaldarlo. En varias instancias, usar un almacenamiento compartido duradero y adaptar `ArchivosService`; el disco efímero del contenedor no sirve como almacenamiento final. No publicar `uploads/` como ruta estática.

## Dominio, TLS y disponibilidad

- Publicar API y portal bajo dominios aprobados y certificados TLS válidos.
- Configurar proxy, límites de tamaño y tiempos de espera para cargas, PDF y Excel.
- Restringir `CORS_ORIGINS` a los dominios reales.
- Configurar reinicio del proceso, comprobación de disponibilidad y alertas desde el hosting.
- Centralizar logs con retención y acceso restringido. Evitar tokens, contraseñas, CURP y datos financieros en logs.

Existen ejemplos y scripts IIS/ARR, servicio y despliegue manual. No acreditan DNS/certificados instalados, monitoreo ni alertas operativas en el servidor existente. Verificar capacidad y configuración real antes de habilitar el piloto.

La API ofrece /api/health/live (proceso/versión), /api/health (consulta básica de DB) y /api/health/ready (DB, historial de migraciones y permisos R/W de uploads). El deploy exige live/ready y la versión esperada; /health básico no sustituye readiness. Un ready correcto tampoco certifica SMTP, Openpay, ClamAV, espacio disponible ni restore.

## Servicios externos

- Validar entrega SMTP, rebotes y recuperación de contraseña con buzones de prueba.
- Ejecutar el flujo Openpay en sandbox, probar webhooks repetidos y fallidos, y conciliar un pago de extremo a extremo antes de habilitar producción.
- Cambiar a credenciales productivas solo en el gestor de secretos y con autorización del titular de la cuenta.
- No considerar una URL de retorno como confirmación del pago; el estado debe proceder del webhook autenticado.

## Lista de salida

- [ ] Hosting, regiones, dominios y responsables definidos.
- [ ] Aviso de privacidad y textos legales aprobados por la institución.
- [ ] Base creada, migraciones aplicadas y recuperación ensayada.
- [ ] Secretos de producción cargados fuera del repositorio.
- [ ] Archivos persistentes con respaldo y acceso validado.
- [ ] SMTP probado y Openpay conciliado con webhooks.
- [ ] Roles y alcance por plantel revisados con personal autorizado.
- [ ] Portal y aplicación probados en dispositivos y navegadores objetivo.
- [ ] Alertas y procedimiento de incidentes asignados a responsables.
- [ ] Publicación móvil configurada con cuentas de la institución.

## Builds móviles con EAS

`mobile/eas.json` define perfiles `development`, `preview` y `production`. Antes de compilar, vincular el proyecto a la cuenta EAS institucional y registrar `EXPO_PUBLIC_API_URL` en los entornos correspondientes. Esta variable se incorpora al bundle y debe ser una URL HTTPS accesible desde el dispositivo; nunca incluir credenciales en variables `EXPO_PUBLIC_*`.

```sh
cd mobile
npx eas build --profile preview --platform android
npx eas build --profile production --platform android
```

El perfil de producción incrementa automáticamente el número de build. La firma, las cuentas de tiendas, la URL API definitiva y la aceptación del build siguen pendientes de la institución.


## Biblioteca y activación antes del piloto

Aplicar migracion_biblioteca_privada.sql mediante el runner y verificar ClamAV real, cuarentena y ACL. BIBLIOTECA_CUOTA_MB es 100 por defecto (1–2000); hasta 10 MB por archivo. Sin scanner disponible se bloquean cargas. Esa cuota no cubre otros módulos. Respaldar y restaurar también archivos y referencias de biblioteca.

La [activación segura](REQUERIMIENTO_ACTIVACION_SEGURA.md) está implementada en altas nuevas y clientes desde #60–#66. Antes de habilitar el piloto, aplicar la migración previa al código, confirmar entrega/recuperación con SMTP institucional y ensayar las cuentas existentes. CI no acredita entrega ni despliegue.

Puertas y evidencia institucional: [BETA_ACEPTACION.json](BETA_ACEPTACION.json). Los registros siguen pendientes hasta tener evidencia y responsables; CI no equivale a aceptar el despliegue.

### Evidencia UAT y límites del diagnóstico

`node scripts/check-uat-matrix.cjs` valida la estructura de los doce escenarios institucionales, roles y canales. Para una aprobación se exigen responsable designado, aprobadoPor, fecha UTC ISO exacta no futura, SHA completo del build y referencias de evidencia no vacías. El validador no autentica la identidad del firmante ni verifica el contenido de esas referencias: esa revisión corresponde a la institución. `--release` rechaza escenarios pendientes; ejecutar también `node scripts/check-beta-gates.cjs --release`. Los doce escenarios permanecen pendientes.

`Test-PilotReadiness.ps1` verifica el contrato JSON de live/ready, la versión de ambos endpoints cuando se indica ExpectedVersion y los indicadores database/schema/storage. No sigue redirecciones y admite únicamente el origen o /api; HTTP solo se permite en loopback para pruebas locales. Un informe se crea de forma exclusiva y nunca sobrescribe uno existente. Las pruebas Windows usan transporte simulado, no acreditan disponibilidad institucional.
