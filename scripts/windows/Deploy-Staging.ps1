param(
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][string]$Source,
  [string]$Root = 'C:\SistemaEscolar',
  [string]$ServiceName = 'SistemaEscolarApi',
  [string]$DatabaseName = 'escolar_staging',
  [string]$MysqlDump = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe',
  [string]$ApiBaseUrl = 'https://api-staging.dominio.mx/api',
  [string]$HealthUrl = 'https://api-staging.dominio.mx/api/health/ready'
)

$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+([-.][A-Za-z0-9.-]+)?$') { throw 'Version debe ser semver, por ejemplo 1.9.4.' }
$Source = (Resolve-Path -LiteralPath $Source).Path
$configFile = Join-Path $Root 'config\backend.env'
$backupConfigFile = Join-Path $Root 'config\backup.env'
$release = Join-Path $Root "releases\$Version"
$current = Join-Path $Root 'current'
$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$ErrorActionPreference = 'Stop'

foreach ($dir in @('releases', 'backups\database', 'backups\uploads', 'data\uploads', 'logs', 'config')) {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root $dir) | Out-Null
}
if (-not (Test-Path -LiteralPath $configFile)) { throw "Falta $configFile. Copia y completa backend/.env.staging.example." }
if (-not (Test-Path -LiteralPath $backupConfigFile)) { throw "Falta $backupConfigFile con BACKUP_DB_USER y BACKUP_DB_PASS." }
if (-not (Test-Path -LiteralPath $MysqlDump)) { throw "No se encontró mysqldump: $MysqlDump" }
if (Test-Path -LiteralPath $release) { throw "La release ya existe: $release. Usa una versión nueva." }
if (-not (Test-Path -LiteralPath $current)) { throw 'Primero instala y valida una release inicial, crea la junction current e instala el servicio.' }
if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) { throw "No existe el servicio $ServiceName. Instálalo con Install-ApiService.ps1 antes de actualizar." }

# Carga solo pares KEY=VALUE simples desde el archivo protegido del servidor.
foreach ($line in Get-Content -LiteralPath $configFile) {
  if ($line -match '^\s*([^#\s][^=]*)=(.*)$') {
    $key = $Matches[1].Trim(); $value = $Matches[2].Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1, $value.Length - 2) }
    [Environment]::SetEnvironmentVariable($key, $value, 'Process')
  }
}
if ($env:NODE_ENV -ne 'production' -or $env:APP_ENV -ne 'staging' -or $env:DB_SYNC -ne 'false' -or $env:DB_NAME -ne $DatabaseName) {
  throw "El archivo de entorno debe declarar NODE_ENV=production, APP_ENV=staging, DB_SYNC=false y DB_NAME=$DatabaseName."
}
if (-not $env:DB_PASS -or $env:DB_PASS -like 'REEMPLAZAR*' -or -not $env:JWT_SECRET -or $env:JWT_SECRET -like 'REEMPLAZAR*') {
  throw 'Completa DB_PASS y JWT_SECRET con secretos propios de staging.'
}
foreach ($line in Get-Content -LiteralPath $backupConfigFile) {
  if ($line -match '^\s*(BACKUP_DB_USER|BACKUP_DB_PASS|BACKUP_DB_HOST|BACKUP_DB_PORT|BACKUP_DB_SSL_CA_PATH)=(.*)$') {
    $value = $Matches[2].Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1, $value.Length - 2) }
    [Environment]::SetEnvironmentVariable($Matches[1], $value, 'Process')
  }
}
if (-not $env:BACKUP_DB_USER -or -not $env:BACKUP_DB_PASS -or $env:BACKUP_DB_PASS -like 'REEMPLAZAR*' -or $env:BACKUP_DB_USER -eq $env:DB_USER) {
  throw 'Configura un usuario de respaldo distinto al de la aplicación en config\backup.env.'
}

# Preparar y compilar sin tocar la versión que está atendiendo usuarios. Excluye
# dependencias, builds locales, uploads locales y cualquier .env del checkout.
New-Item -ItemType Directory -Path $release | Out-Null
foreach ($name in @('backend', 'web', 'database')) {
  $from = Join-Path $Source $name
  if (-not (Test-Path -LiteralPath $from)) { throw "Falta $from en el checkout." }
  $to = Join-Path $release $name
  New-Item -ItemType Directory -Path $to | Out-Null
  $excludeDirs = if ($name -eq 'backend') { @('node_modules', 'dist', 'coverage', 'uploads', '.git') } else { @('node_modules', 'dist', 'coverage', '.git') }
  & robocopy $from $to /E /NFL /NDL /NJH /NJS /NC /NS /XD $excludeDirs /XF '.env*'
  if ($LASTEXITCODE -ge 8) { throw "No se pudo preparar $name (robocopy $LASTEXITCODE)." }
}
Push-Location (Join-Path $release 'backend')
try {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci backend falló.' }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Build del backend falló.' }
} finally { Pop-Location }
Push-Location (Join-Path $release 'web')
try {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci web falló.' }
  $env:VITE_API_URL = $ApiBaseUrl
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Build web falló.' }
} finally { Pop-Location }

# Pausa escrituras antes de generar copias consistentes y migrar.
$service = Get-Service -Name $ServiceName -ErrorAction Stop
if ($service.Status -eq 'Running') { Stop-Service -Name $ServiceName -Force; $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30)) }

# Respaldar antes del runner. MYSQL_PWD evita poner la contraseña en la línea de comandos.
$env:MYSQL_PWD = $env:BACKUP_DB_PASS
try {
  $backupHost = if ($env:BACKUP_DB_HOST) { $env:BACKUP_DB_HOST } else { $env:DB_HOST }
  $backupPort = if ($env:BACKUP_DB_PORT) { $env:BACKUP_DB_PORT } else { $env:DB_PORT }
  $backupCa = if ($env:BACKUP_DB_SSL_CA_PATH) { $env:BACKUP_DB_SSL_CA_PATH } else { $env:DB_SSL_CA_PATH }
  $dumpArgs = @("--host=$backupHost", "--port=$backupPort", "--user=$env:BACKUP_DB_USER", '--single-transaction', '--routines', '--events', '--triggers', '--set-gtid-purged=OFF', '--ssl-mode=VERIFY_IDENTITY')
  if ($backupCa) { $dumpArgs += "--ssl-ca=$backupCa" }
  $dumpArgs += @("--result-file=$(Join-Path $Root "backups\database\${DatabaseName}_$timestamp.sql")", $DatabaseName)
  & $MysqlDump @dumpArgs
  if ($LASTEXITCODE -ne 0) { throw 'Falló mysqldump; no se ejecutaron migraciones.' }
} catch {
  Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
  throw
} finally {
  Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
  Remove-Item Env:\BACKUP_DB_PASS -ErrorAction SilentlyContinue
}
$uploadsBackup = Join-Path $Root "backups\uploads\uploads_$timestamp.zip"
try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $Root 'data\uploads'), $uploadsBackup)
} catch {
  Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
  throw
}

# El runner aplica únicamente las entradas pendientes del manifest y exige DB_SYNC=false.
Push-Location (Join-Path $release 'backend')
try {
  npm run db:migrate:status
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el estado de migraciones.' }
  npm run db:migrate
  if ($LASTEXITCODE -ne 0) { throw 'Migración fallida. La release activa no se cambió; inspecciona la base antes de reintentar.' }
} catch {
  Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
  throw
} finally { Pop-Location }

$previous = Join-Path $Root 'previous'
if (Test-Path -LiteralPath $previous) { Remove-Item -LiteralPath $previous -Force }
if (Test-Path -LiteralPath $current) { Move-Item -LiteralPath $current -Destination $previous }
New-Item -ItemType Junction -Path $current -Target $release | Out-Null
try {
  Start-Service -Name $ServiceName
  (Get-Service -Name $ServiceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
  $health = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 20 -UseBasicParsing
  if ($health.StatusCode -ne 200) { throw "Health check devolvió HTTP $($health.StatusCode)." }
  Write-Host "Release $Version activa. Health: HTTP $($health.StatusCode). Respaldos: $timestamp"
} catch {
  Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $current -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $previous) { Move-Item -LiteralPath $previous -Destination $current }
  Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
  throw "Despliegue revertido a la release anterior. La base conserva las migraciones aplicadas; revisa compatibilidad/restauración manual. Error: $_"
}
