# Staging en Windows Server 2019

Esta preparación cubre una instancia de staging con IIS, NestJS como servicio de Windows, MySQL aislado y almacenamiento local persistente. No instala ni configura el VPS por sí sola: dominio, DNS, certificado, usuarios y secretos dependen del servidor elegido.

## Entornos y datos

- Desarrollo usa los `.env.example` actuales y datos locales/ficticios.
- Staging usa `backend/.env.staging.example` y `web/.env.staging.example` como plantillas. El archivo real de backend vive fuera de Git en `C:\SistemaEscolar\config\backend.env`; crea secretos nuevos para staging. El archivo del frontend se usa al compilar porque Vite incrusta `VITE_API_URL` en el bundle.
- La base de pruebas se llama `escolar_staging`; producción tendrá su propia base, credenciales y almacenamiento. No apuntar staging a una base productiva.
- El ejemplo de staging conserva Openpay sandbox. No cargar credenciales productivas.
- Usa `NODE_ENV=production` y `APP_ENV=staging`: se mantienen las protecciones de NestJS y se admiten Openpay sandbox y SMTP pendiente. Instala MySQL 8.4 con TLS, `require_secure_transport=ON` y un certificado cuyo SAN incluya `DB_HOST`. Exporta la CA en PEM a una ruta legible por el servicio y configura `DB_SSL_CA_PATH`; verifica conexión de la app y de `mysql.exe`/`mysqldump.exe` con validación de identidad antes del primer deploy.
- En todo entorno compartido: `DB_SYNC=false`. Nunca usar `schema.sql` como instalador.

Para una base de staging nueva, crea una base vacía `escolar_staging`, configura el usuario limitado de la aplicación, instala una sola vez `database/mysql/baseline_v1.sql`, y después ejecuta `db:migrate:adopt`, `db:migrate:status` y `db:migrate` siguiendo [MIGRACIONES.md](MIGRACIONES.md). No ejecutar el baseline ni `adopt` sobre bases existentes. Respaldar antes de migrar.

## Carpetas y permisos

El despliegue usa esta estructura:

```text
C:\SistemaEscolar\
  config\backend.env       # secreto, ACL solo para administradores y servicio
  current\                 # junction a la release activa
  previous\                # release de código anterior durante el cambio
  releases\<versión>\
  data\uploads\            # persistente, fuera de releases y de IIS
  backups\database\
  backups\uploads\
  logs\
```

`Initialize-Staging.ps1` crea una cuenta local dedicada si hace falta y concede lectura/ejecución de releases, lectura del archivo de entorno y escritura en `data\uploads` y `logs`. Revisa las ACL heredadas del directorio raíz y restringe `config\backup.env` y `backups` a administradores/operadores de respaldo. La identidad del pool IIS solo necesita lectura de `current\web\dist`. No publiques `data\uploads` en IIS; las descargas pasan por el módulo `archivos` y sus enlaces firmados.

## IIS y portal

Instala IIS, URL Rewrite y Application Request Routing (ARR), e importa el certificado HTTPS con clave privada en `Cert:\LocalMachine\My`. Después del bootstrap, ejecuta `Configure-IIS-Staging.ps1 -PortalHost sistema-staging.dominio.mx -ApiHost api-staging.dominio.mx -CertificateThumbprint <huella>`. El script crea los dos sitios con SNI, habilita ARR, configura el proxy local y el límite de carga. `web/public/web.config` hace fallback de rutas React a `index.html`. Comprueba en el servidor la cadena del certificado, el proxy y los bindings antes de abrir acceso externo.

Configura otro sitio HTTPS para `api-staging.dominio.mx` como proxy inverso a `http://127.0.0.1:3000`. En ARR habilita proxy y conserva la ruta `/api/...`. No abras el puerto 3000 en el firewall externo. Establece el límite de solicitud de IIS por encima de `MAX_UPLOAD_MB` considerando el multipart/form-data. El CORS del backend debe incluir el origen HTTPS exacto del portal.

El build del portal requiere la URL final:

```powershell
cd web
$env:VITE_API_URL = 'https://api-staging.dominio.mx/api'
npm ci
npm run build
```

Cambiar la URL después del build no altera el bundle; se debe volver a compilar.

## Servicio de API

Instala **Node.js 24 LTS** y NSSM en una ubicación fija como `C:\Tools\nssm\win64\nssm.exe`. Crea `config\backend.env` desde la plantilla y `config\backup.env` con credenciales de respaldo separadas. Instala el baseline y adopta el historial exclusivamente en una base de staging nueva y vacía, según [MIGRACIONES.md](MIGRACIONES.md). Desde una consola administrativa privada, ejecuta:

```powershell
$credential = Get-Credential '.\svc_escolar_api'
.\scripts\windows\Initialize-Staging.ps1 -Version '1.10.0' -Source 'C:\Builds\sistema-escolar-mvp' -ServiceCredential $credential -ApiBaseUrl 'https://api-staging.dominio.mx/api'
```

El servicio `SistemaEscolarApi` queda configurado con esa cuenta local, inicio automático, reinicio ante fallas y logs rotativos. Lee el archivo externo mediante `DOTENV_CONFIG_PATH`. La plantilla fija `HOST=127.0.0.1` para que NestJS solo escuche localmente detrás de IIS. El script establece la identidad mediante la API de servicios de Windows, sin poner la contraseña en la línea de comandos.

Configura IIS, inicia el servicio y valida `/api/health` antes de utilizar `Deploy-Staging.ps1` para las siguientes versiones.

## Despliegue y respaldos

`scripts/windows/Deploy-Staging.ps1` prepara una release desde un checkout con `backend/`, `web/` y `database/`, compila, detiene la API, respalda MySQL y uploads, consulta/aplica migraciones, cambia la junction y valida health. Ejemplo desde la raíz del checkout, después de configurar el servidor:

```powershell
.\scripts\windows\Deploy-Staging.ps1 `
  -Version '1.10.1' `
  -Source 'C:\Builds\sistema-escolar-mvp' `
  -ApiBaseUrl 'https://api-staging.dominio.mx/api' `
  -HealthUrl 'https://api-staging.dominio.mx/api/health'
```

El usuario que ejecuta el script necesita acceso a MySQL, `mysqldump`, NSSM/servicios, y escritura en `C:\SistemaEscolar`. `config\backup.env` contiene `BACKUP_DB_USER`, `BACKUP_DB_PASS` y, para restauración, opcionalmente `BACKUP_DB_HOST`, `BACKUP_DB_PORT`, `BACKUP_DB_SSL_CA_PATH`. La cuenta MySQL de respaldo debe ser distinta de `DB_USER` y disponer de los permisos necesarios para tablas, vistas, rutinas, eventos y triggers; prueba el dump con la concesión mínima efectiva en MySQL 8.4. El usuario del servicio solo lee `config\backend.env`. Protege y cifra los respaldos según la política institucional; programa una copia diaria con retención y réplica cifrada fuera del VPS.

Ensaya cada formato de respaldo con una base **precreada y vacía** `escolar_staging_restore_<fecha>` y un directorio nuevo para uploads, nunca contra la base o directorio activos:

```powershell
.\scripts\windows\Restore-Staging.ps1 -SqlBackup 'C:\SistemaEscolar\backups\database\escolar_staging_2026-10-03_120000.sql' -UploadsBackup 'C:\SistemaEscolar\backups\uploads\uploads_2026-10-03_120000.zip' -TargetDatabase 'escolar_staging_restore_20261003' -UploadsTarget 'C:\SistemaEscolar\restore-check\uploads_20261003'
```

Compara conteos, rutinas, eventos y archivos con el origen. El script se niega a importar sobre una base no vacía y no cambia el servicio ni la release activa. La prueba requiere credenciales con permiso de escritura en la base aislada; una cuenta dedicada de restauración puede sustituir la de respaldo en una copia protegida de `backup.env` durante el ensayo.

El health check es `GET /api/health`: espera HTTP 200 y `{ "status": "ok", "database": "ok" }`. Si no pasa, el script restaura la junction de código anterior y reinicia el servicio. Las migraciones de base no se revierten automáticamente; una versión anterior solo es segura si la migración es compatible hacia atrás. De otro modo, detén el servicio y restaura la base desde el respaldo siguiendo el procedimiento DBA. El runner puede dejar DDL parcial en MySQL: inspecciona el esquema antes de reintentar.

## Lista de salida de staging

- [ ] Base `escolar_staging` separada, baseline validado/adoptado y migraciones al día.
- [ ] Cuenta MySQL limitada y respaldo restaurado en una instancia aislada.
- [ ] `.env` externo con secretos exclusivos, `NODE_ENV=production`, `APP_ENV=staging`, `DB_SYNC=false` y CORS del portal. `APP_ENV=staging` permite Openpay sandbox y SMTP pendiente sin habilitar las opciones de desarrollo de NestJS.
- [ ] DNS, HTTPS, ARR y URL Rewrite comprobados; puerto 3000 no expuesto públicamente.
- [ ] Servicio automático probado tras reinicio y logs con ACL/retención.
- [ ] Carga, descarga firmada y persistencia de archivos probadas.
- [ ] Despliegue de prueba, health check, rollback de código y restauración de respaldos ensayados.
- [ ] Producción mantiene base, credenciales, URL, uploads y backups completamente separados.
