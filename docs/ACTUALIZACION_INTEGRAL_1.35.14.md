# Actualización coordinada de staging · 1.35.14

El punto de entrada es `scripts/windows/Update-Staging.ps1`. Coordina el sistema
(API y administrativo) y el Portal Alumno Expo Web. Reutiliza los scripts
existentes de respaldo, migración, junction y health; no crea otra API ni base.
No publica un APK/IPA ni configura tiendas móviles. No se ejecutó en servidores
institucionales como parte de esta entrega.

## Configuración de una sola vez

Un operador copia `scripts/windows/deploy-staging.example.json` a
`C:\SistemaEscolar\config\deploy-staging.json` y ajusta rutas, nombres y hosts.
Es un JSON **sin secretos**. Las credenciales siguen en `backend.env` y
`backup.env`, con las ACL existentes. No agregar contraseñas al JSON ni al Git.

Requiere el sistema inicial ya instalado, respaldos/restore ensayados, IIS/ARR,
sitio y certificado del alumno configurados. Para una primera publicación seguir
`DESPLIEGUE_PORTAL_ALUMNO_STAGING.md`; el actualizador rechaza un sitio inexistente
o que apunte a otro directorio, antes de actualizar la API.

El respaldo automatizado del sistema sigue siendo **MySQL**. La API soporta
SQL Server, pero eso no equivale a disponer de un despliegue operativo SQL Server:
se necesita su procedimiento propio de backup/restore. El script lo rechaza
antes de detener servicios. `PortalAlumno` solo publica estáticos y no migra.

## Actualizar

Desde un checkout limpio del commit de main que tenga CI aprobada, en PowerShell
del VPS con permisos de operación:

```powershell
# Plan sin construir, parar servicios, migrar ni publicar.
.\scripts\windows\Update-Staging.ps1 -ValidateOnly

# Previsualización estándar de PowerShell, también sin activación.
.\scripts\windows\Update-Staging.ps1 -WhatIf

# Una operación para API/administrativo y luego Portal Alumno.
.\scripts\windows\Update-Staging.ps1
```

La versión se obtiene del código: backend, web, mobile y app.json deben coincidir.
`-Version` es opcional y, si se indica, debe coincidir. No hay un `git pull`
implícito: no se sustituye el commit validado por código más reciente sin revisar.

Opciones para actualizar un componente o rutas distintas:

```powershell
.\scripts\windows\Update-Staging.ps1 -Target Sistema
.\scripts\windows\Update-Staging.ps1 -Target PortalAlumno
.\scripts\windows\Update-Staging.ps1 `
  -Source 'C:\Builds\sistema-escolar-mvp' `
  -SettingsPath 'C:\SistemaEscolar\config\deploy-staging.json' `
  -Target Todo
```

`PORT` se lee de backend.env y se usa en el proxy del alumno. Sin PORT se conserva
3000; los puertos inválidos o duplicados se rechazan. El proxy continúa siendo
loopback y de mismo origen. No se cambia el web.config del repositorio al publicar:
solo la copia de la release del alumno. La API local y pública deben tener la
versión correcta antes de publicar el portal.

La planificación comprueba código/configuración local, pero no acredita health,
credenciales, restore, IIS o aceptación de usuarios. El modo real verifica el
sitio, toma un bloqueo exclusivo y ejecuta sistema → API lista → portal. El lock
coordina invocaciones de este actualizador; evitar invocar en paralelo los
scripts antiguos directamente. Dos instalaciones no deben compartir PortalRoot.

## GitHub Actions

El workflow manual **Deploy staging** conserva la comprobación de pertenencia a
main y CI aprobada para el SHA de push, el entorno staging y la serialización.
Elegir `commit_sha` y `target` (`Todo`, `Sistema`, `PortalAlumno`); `version` puede
quedar vacío. La variable opcional `STAGING_DEPLOY_SETTINGS_PATH` cambia la ruta
del JSON. El valor por defecto es la ruta anterior; sustituye la duplicación de
API/health URL en variables del workflow. Sigue requiriendo runner Windows
self-hosted y `STAGING_DEPLOY_ENABLED=true`. No se ha habilitado ni disparado
ese workflow desde esta tarea.

## Fallos y recuperación

- Si falla sistema, no se ejecuta Portal Alumno.
- Si falla la consulta de migraciones antes de DDL, se intenta reanudar la API
  anterior. Si falla una migración ya iniciada, **la API permanece detenida**:
  inspeccionar journal/DDL y decidir recuperación con el respaldo. No reiniciar
  ciegamente la versión anterior ni adoptar historial para ocultar el error.
- Si falla health después del intercambio de junctions, se conserva el mecanismo
  existente de rollback de aplicación. Eso no revierte DDL.
- Si la API se actualizó y falla el portal, el resultado es parcial y se comunica
  como error; no se simula rollback global de BD. Tras revisar estado/DNS/TLS/IIS,
  se puede seleccionar solo `PortalAlumno`.
- Las releases siguen siendo inmutables. Si ya existe una release de esa versión
  que no está activa, inspeccionarla con el operador; el script no borra ni
  sobrescribe carpetas para forzar un reintento. No reutilizar una versión para
  contenido distinto.

El ensayo real de actualización, rollback, restauración y tiempos de caída debe
hacerse antes del piloto, con una copia controlada y responsables designados.

## Comprobaciones automatizadas

`Test-UpdateStaging.ps1` verifica versiones, checkout limpio, JSON sin secretos,
WhatIf/ValidateOnly sin activación, orden, fallo parcial, sitio IIS incorrecto,
puerto del proxy, exclusión concurrente y código de éxito de Robocopy. Los módulos
de activación y transporte IIS se sustituyen por dobles: estas pruebas no acreditan
operación real. `Test-DeployStaging.ps1` ejecuta además los bloques reales de
validación/migración/rollback con dobles de servicio y comandos.
