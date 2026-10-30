# Despliegue de Expo Web · Portal Alumno IUA (staging)

**Candidata:** 1.35.7. **Dominio solicitado:** `https://stagin-portal-alumno.iua.edu.mx/`. Esta guía no acredita que el portal esté publicado ni que DNS/TLS estén configurados.

## Arquitectura y condición de seguridad

El navegador recibe la app de `mobile/` exportada por Expo Web. No publica `web/`, reservado para personal. La API NestJS y MySQL existentes continúan siendo la única fuente de datos; no se crea una base ni un servicio Node adicional.

**Importante:** `stagin-portal-alumno.iua.edu.mx` pertenece a `iua.edu.mx`. Dos subdominios HTTPS comparten sitio a efectos de `SameSite=Strict`, aunque son **orígenes diferentes**. Para mantener una sola URL de API en el navegador, `mobile/public/web.config` hace proxy inverso de `/api/*` y `/uploads/*` a `http://127.0.0.1:3000` (solo loopback) y conserva el resto como sitio estático. Expo se compila con **`EXPO_PUBLIC_API_URL=https://stagin-portal-alumno.iua.edu.mx/api`**. Así el navegador usa un origen único y la cookie HttpOnly conserva su diseño.

El certificado debe cubrir **este nombre exacto** por SAN o mediante un wildcard `*.iua.edu.mx` válido (sí cubre un subdominio de un nivel). En Cloudflare, zona `iua.edu.mx`: registro A `stagin-portal-alumno` → `72.167.134.110`, `DNS only`. El operador confirmó la resolución pública mediante `nslookup` el 30/oct/2026.

## Prerrequisitos

- Merge del PR de publicación y CI verde en el SHA aprobado. Los tres workspaces, Expo y lockfiles deben marcar 1.35.7.
- API institucional de staging **ya desplegada a 1.35.7**, `GET https://api-sistema-staging.iua.edu.mx/api/health/ready` con `status=ok` y `version=1.35.7`. Esta candidata incluye la migración `migracion_segundo_nombre_usuario.sql` de identidad 1.35.5. Aplicar migraciones mediante el procedimiento existente con respaldo y restore aislado; **no desde este script**.
- Windows Server 2019, IIS, URL Rewrite, ARR con proxy habilitado, Node 24, npm, certificado válido (clave privada) importado a `Cert:\LocalMachine\My`. API escucha en `127.0.0.1:3000`, no abierta a Internet.
- `C:\SistemaEscolar\config\backend.env`: conservar todos los orígenes actuales y añadir **`https://stagin-portal-alumno.iua.edu.mx`** a `CORS_ORIGINS`, sin slash final. Es necesario para la validación explícita de `Origin` de `POST /api/auth/refresh`, incluso con el proxy de mismo origen. Reiniciar `SistemaEscolarApi` de forma controlada tras editar el archivo privado y verificar health.
- DNS tipo A/AAAA válido hacia el VPS y TLS activo. El certificado debe cubrir el hostname por SAN o wildcard válido y tener su clave privada. Mantener `NODE_ENV=production`, `APP_ENV=staging`, `DB_SYNC=false`.

## Comprobaciones previas (PowerShell administrador del VPS)

```powershell
$PortalHost = 'stagin-portal-alumno.iua.edu.mx'
Resolve-DnsName $PortalHost -Type A
Get-Service SistemaEscolarApi
Invoke-RestMethod 'https://api-sistema-staging.iua.edu.mx/api/health/ready'
Import-Module WebAdministration
Get-Website
Get-WebBinding -Protocol https
Get-ChildItem Cert:\LocalMachine\My | Select-Object Thumbprint, NotAfter, DnsNameList
```

Seleccionar manualmente la huella del certificado que cubre exactamente el PortalHost; nunca asumir que el certificado del administrativo sirve.

## Primera publicación

Consola PowerShell **desde un checkout limpio y aprobado** de `main` en `C:\Builds\sistema-escolar-mvp`:

```powershell
cd C:\Builds\sistema-escolar-mvp
git rev-parse HEAD
git status --short
.\scripts\windows\Test-PortalAlumno-Staging.ps1
.\scripts\windows\Deploy-PortalAlumno-Staging.ps1 `
  -Version '1.35.7' `
  -Source 'C:\Builds\sistema-escolar-mvp' `
  -PortalHost 'stagin-portal-alumno.iua.edu.mx'
```

La publicación instala dependencias en `mobile/`, exporta `mobile/dist` con `APP_ENV=preview`, verifica API 1.35.7, crea una release **inmutable** en `C:\SistemaEscolar\portal-alumno\releases\1.35.7` y activa `current` como Junction. Copia `web.config` incluso si Metro no lo incluye en `dist`. No modifica `C:\SistemaEscolar\current`, servicio API, web administrativo, BD ni migraciones.

Cuando el archivo está publicado, crear **una sola vez** el sitio IIS y su binding SNI HTTPS:

```powershell
.\scripts\windows\Configure-IIS-PortalAlumno-Staging.ps1 `
  -PortalHost 'stagin-portal-alumno.iua.edu.mx' `
  -CertificateThumbprint 'PEGAR_HUELLA_REAL_CERTIFICADO'
```

No ejecutar ese comando si el sitio o binding ya existe; primero revisar la configuración. El script exige certificado vigente, SAN correcto, IIS Rewrite, ARR y carpeta `current`, y configura lectura para el pool `SistemaEscolar-Staging-PortalAlumno`. No toca los sitios existentes.

## Actualizaciones y retroceso

Una próxima versión **nueva** se publica con `Deploy-PortalAlumno-Staging.ps1 -Version '<nueva-versión>'` solo después de actualizar y verificar la API correspondiente. El script conserva el destino anterior como `previous`, valida la portada pública y el proxy `/api/health/ready`, y, si falla la comprobación, intenta restaurar la Junction previa. Nunca reutilizar un nombre de release. La primera publicación no tiene una release anterior a la cual volver.

Los cambios del portal son estáticos. El rollback de esta publicación **no revierte migraciones** ni el estado de la API; para ella se aplica por separado el procedimiento de `Deploy-Staging.ps1`.

## Verificación de aceptación

```powershell
Invoke-WebRequest 'https://stagin-portal-alumno.iua.edu.mx/' -UseBasicParsing
Invoke-RestMethod 'https://stagin-portal-alumno.iua.edu.mx/api/health/ready'
Invoke-WebRequest 'https://stagin-portal-alumno.iua.edu.mx/ruta-inexistente' -UseBasicParsing
```

En navegador real (móvil y escritorio), comprobar acceso **exclusivo ALUMNO** por `POST /api/auth/login-alumno-web`, refresh con cookie HttpOnly y `SameSite=Strict`, salida, activación y recuperación por correo, materias, tareas, calificaciones, boletas/firmas, pagos, perfil y descargas autorizadas. Verificar carga del logo (`/uploads/`), tamaños de fuente, rutas profundas, ausencia de errores JS, certificado válido, `403` en datos ajenos y que las rutas administrativas no estén presentes en la interfaz.

**No marcar como desplegado** hasta confirmar HTTP 200, API versionada y recorrido real con cuenta de prueba; las pruebas con API simulada no sustituyen esta verificación.
