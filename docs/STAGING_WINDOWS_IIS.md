# Staging en Windows Server 2019

Esta preparación cubre una instancia de staging con IIS, NestJS como servicio de Windows, MySQL aislado y almacenamiento local persistente. No instala ni configura el VPS por sí sola: dominio, DNS, certificado, usuarios y secretos dependen del servidor elegido.

## Entornos y datos

- Desarrollo usa los `.env.example` actuales y datos locales/ficticios.
- Staging usa `backend/.env.staging.example` y `web/.env.staging.example` como plantillas. El archivo real de backend vive fuera de Git en `C:\SistemaEscolar\config\backend.env`; crea secretos nuevos para staging. El archivo del frontend se usa al compilar porque Vite incrusta `VITE_API_URL` en el bundle.
- La base de pruebas se llama `escolar_staging`; producción tendrá su propia base, credenciales y almacenamiento. No apuntar staging a una base productiva.
- El ejemplo de staging conserva Openpay sandbox. No cargar credenciales productivas.
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

Concede lectura/ejecución del código y escritura solo a `data\uploads` y `logs` para la identidad del servicio. La identidad del pool IIS solo necesita lectura de `current\web\dist`. No publiques `data\uploads` en IIS; las descargas pasan por el módulo `archivos` y sus enlaces firmados.

## IIS y portal

Instala IIS, URL Rewrite y Application Request Routing (ARR). Crea un sitio HTTPS para el portal con raíz física `C:\SistemaEscolar\current\web\dist`; `web/public/web.config` se copia al build y hace fallback de rutas React a `index.html`. El certificado y bindings HTTPS se configuran en IIS.

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

Instala Node.js LTS compatible con el proyecto y NSSM en una ubicación fija como `C:\Tools\nssm\win64\nssm.exe`. Para el primer arranque, prepara manualmente una release desde el checkout: copia backend y database sin `.env`, ejecuta `npm ci` y `npm run build` en backend, copia web y ejecuta `npm ci` y `npm run build` con `VITE_API_URL` configurada. Coloca la salida en `C:\SistemaEscolar\releases\<versión>` y crea `current` como junction a esa carpeta. Crea `config\backend.env` a partir de la plantilla y concede ACL restringida. Luego, desde una consola elevada, instala el servicio:

```powershell
.\scripts\windows\Install-ApiService.ps1
```

El servicio `SistemaEscolarApi` inicia automáticamente, reinicia ante fallas, escribe logs rotativos y lee el archivo externo mediante `DOTENV_CONFIG_PATH`. La plantilla fija `HOST=127.0.0.1` para que NestJS solo escuche localmente detrás de IIS. Cambia la identidad del servicio desde Servicios de Windows a una cuenta dedicada sin privilegios administrativos y concede los permisos mínimos descritos arriba.

Inicia el servicio, valida `/api/health`, instala el sitio IIS contra `current\web\dist` y confirma el proxy antes de utilizar `Deploy-Staging.ps1` para las siguientes versiones.

## Despliegue y respaldos

`scripts/windows/Deploy-Staging.ps1` prepara una release desde un checkout con `backend/`, `web/` y `database/`, compila, detiene la API, respalda MySQL y uploads, consulta/aplica migraciones, cambia la junction y valida health. Ejemplo desde la raíz del checkout, después de configurar el servidor:

```powershell
.\scripts\windows\Deploy-Staging.ps1 `
  -Version '1.0.1' `
  -Source 'C:\Builds\sistema-escolar-mvp' `
  -ApiBaseUrl 'https://api-staging.dominio.mx/api' `
  -HealthUrl 'https://api-staging.dominio.mx/api/health'
```

El usuario que ejecuta el script necesita acceso a MySQL, `mysqldump`, NSSM/servicios, y escritura en `C:\SistemaEscolar`. El usuario del servicio debe poder leer `config\backend.env`. Protege y cifra los respaldos según la política institucional y copia periódicamente una réplica fuera del VPS. El script crea respaldos locales, pero no sustituye la copia externa ni un ensayo de restauración.

El health check es `GET /api/health`: espera HTTP 200 y `{ "status": "ok", "database": "ok" }`. Si no pasa, el script restaura la junction de código anterior y reinicia el servicio. Las migraciones de base no se revierten automáticamente; una versión anterior solo es segura si la migración es compatible hacia atrás. De otro modo, detén el servicio y restaura la base desde el respaldo siguiendo el procedimiento DBA. El runner puede dejar DDL parcial en MySQL: inspecciona el esquema antes de reintentar.

## Lista de salida de staging

- [ ] Base `escolar_staging` separada, baseline validado/adoptado y migraciones al día.
- [ ] Cuenta MySQL limitada y respaldo restaurado en una instancia aislada.
- [ ] `.env` externo con secretos exclusivos, `NODE_ENV=production`, `DB_SYNC=false` y CORS del portal.
- [ ] DNS, HTTPS, ARR y URL Rewrite comprobados; puerto 3000 no expuesto públicamente.
- [ ] Servicio automático probado tras reinicio y logs con ACL/retención.
- [ ] Carga, descarga firmada y persistencia de archivos probadas.
- [ ] Despliegue de prueba, health check, rollback de código y restauración de respaldos ensayados.
- [ ] Producción mantiene base, credenciales, URL, uploads y backups completamente separados.
