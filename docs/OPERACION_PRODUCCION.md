# Preparación de operación productiva

Este documento separa lo configurable en el repositorio de lo que depende del hosting, dominio, institución o proveedor. La configuración local actual no es una instalación productiva.

## Estado observado del entorno de desarrollo

- `backend/.env` selecciona `DB_TYPE=mysql`, host `localhost`, puerto `3306` y base `escolar`.
- En la revisión no hubo servicio TCP en `localhost:3306` ni en `localhost:1433`, y Docker no está instalado. No se pudo consultar ni respaldar una base activa.
- `docker-compose.yml` define persistencia local con el volumen nombrado `mysql_data`. Docker administra su ubicación; no se crea como archivo de datos dentro de `backend/`.
- `backend/uploads/` es una carpeta local vacía para cargas. No tiene almacenamiento externo o replicado configurado.

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

El repositorio no configura un servicio administrado de base de datos, programación de respaldos ni restauración. Esos elementos deben configurarse en el proveedor elegido.

## Archivos subidos

La API escribe en `UPLOADS_DIR` y los entrega mediante el módulo `archivos` con enlaces firmados de corta vida. En una sola instancia, montar almacenamiento persistente y respaldarlo. En varias instancias, usar un almacenamiento compartido duradero y adaptar `ArchivosService`; el disco efímero del contenedor no sirve como almacenamiento final. No publicar `uploads/` como ruta estática.

## Dominio, TLS y disponibilidad

- Publicar API y portal bajo dominios aprobados y certificados TLS válidos.
- Configurar proxy, límites de tamaño y tiempos de espera para cargas, PDF y Excel.
- Restringir `CORS_ORIGINS` a los dominios reales.
- Configurar reinicio del proceso, comprobación de disponibilidad y alertas desde el hosting.
- Centralizar logs con retención y acceso restringido. Evitar tokens, contraseñas, CURP y datos financieros en logs.

No hay configuración de hosting, DNS, certificados, métricas ni alertas versionada en el proyecto. El proveedor aún debe elegirse.

La API ofrece `GET /api/health` sin autenticación; responde `200` cuando la consulta de base funciona y `503` cuando falla. Usar esa ruta como comprobación de disponibilidad del proceso y la dependencia de datos.

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
