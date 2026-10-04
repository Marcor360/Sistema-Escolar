param(
  [Parameter(Mandatory = $true)][string]$SqlBackup,
  [Parameter(Mandatory = $true)][string]$UploadsBackup,
  [Parameter(Mandatory = $true)][string]$TargetDatabase,
  [Parameter(Mandatory = $true)][string]$UploadsTarget,
  [string]$Root = 'C:\SistemaEscolar',
  [string]$Mysql = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe'
)

$ErrorActionPreference = 'Stop'
if ($TargetDatabase -notmatch '^escolar_staging_restore_[A-Za-z0-9_]+$') { throw 'TargetDatabase debe ser una base aislada escolar_staging_restore_*.' }
$SqlBackup = (Resolve-Path -LiteralPath $SqlBackup).Path
$UploadsBackup = (Resolve-Path -LiteralPath $UploadsBackup).Path
if ($SqlBackup -notmatch '^[A-Za-z]:[\\/][A-Za-z0-9_ .\\/-]+\.sql$') { throw 'Ruta SQL no válida para el cliente mysql.' }
if (-not $UploadsBackup.EndsWith('.zip', [StringComparison]::OrdinalIgnoreCase)) { throw 'UploadsBackup debe ser ZIP.' }
if ([IO.Path]::GetFileName($SqlBackup) -notmatch '^escolar_staging_(\d{4}-\d{2}-\d{2}_\d{6})\.sql$') { throw 'Nombre de respaldo SQL no reconocido.' }
$backupStamp = $Matches[1]
if ([IO.Path]::GetFileName($UploadsBackup) -ne "uploads_$backupStamp.zip") { throw 'El ZIP y el SQL deben pertenecer al mismo respaldo.' }
$sqlDirectory = [IO.Path]::GetFullPath((Join-Path $Root 'backups\database')).TrimEnd('\') + '\'
$zipDirectory = [IO.Path]::GetFullPath((Join-Path $Root 'backups\uploads')).TrimEnd('\') + '\'
if (-not $SqlBackup.StartsWith($sqlDirectory, [StringComparison]::OrdinalIgnoreCase) -or -not $UploadsBackup.StartsWith($zipDirectory, [StringComparison]::OrdinalIgnoreCase)) { throw 'Los respaldos deben estar en las carpetas de backup del staging.' }
if (-not (Test-Path -LiteralPath $Mysql)) { throw "Falta mysql.exe: $Mysql" }
$uploadsPath = [IO.Path]::GetFullPath($UploadsTarget)
$liveUploads = [IO.Path]::GetFullPath((Join-Path $Root 'data\uploads'))
$restoreRoot = [IO.Path]::GetFullPath((Join-Path $Root 'restore-check')).TrimEnd('\') + '\'
if (-not $uploadsPath.StartsWith($restoreRoot, [StringComparison]::OrdinalIgnoreCase) -or $uploadsPath.TrimEnd('\') -eq $liveUploads.TrimEnd('\') -or (Test-Path -LiteralPath $uploadsPath)) { throw 'UploadsTarget debe ser una ruta nueva dentro de restore-check.' }
$backupConfig = Join-Path $Root 'config\backup.env'
if (-not (Test-Path -LiteralPath $backupConfig)) { throw "Falta $backupConfig." }
$settings = @{}
foreach ($line in Get-Content -LiteralPath $backupConfig) {
  if ($line -match '^\s*(BACKUP_DB_USER|BACKUP_DB_PASS|BACKUP_DB_HOST|BACKUP_DB_PORT|BACKUP_DB_SSL_CA_PATH)=(.*)$') {
    $settings[$Matches[1]] = $Matches[2].Trim().Trim('"', "'")
  }
}
foreach ($key in @('BACKUP_DB_USER', 'BACKUP_DB_PASS')) { if (-not $settings[$key]) { throw "Falta $key en backup.env." } }
$hostName = if ($settings.BACKUP_DB_HOST) { $settings.BACKUP_DB_HOST } else { '127.0.0.1' }
$port = if ($settings.BACKUP_DB_PORT) { $settings.BACKUP_DB_PORT } else { '3306' }
$mysqlArgs = @("--host=$hostName", "--port=$port", "--user=$($settings.BACKUP_DB_USER)", '--ssl-mode=VERIFY_IDENTITY', '--batch', '--skip-column-names')
if ($settings.BACKUP_DB_SSL_CA_PATH) { $mysqlArgs += "--ssl-ca=$($settings.BACKUP_DB_SSL_CA_PATH)" }
$env:MYSQL_PWD = $settings.BACKUP_DB_PASS
try {
  $exists = & $Mysql @mysqlArgs "--execute=SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$TargetDatabase'"
  if ($LASTEXITCODE -ne 0 -or ($exists | Select-Object -Last 1) -ne '1') { throw 'La base aislada debe existir previamente.' }
  $tables = & $Mysql @mysqlArgs "--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$TargetDatabase'"
  if ($LASTEXITCODE -ne 0 -or ($tables | Select-Object -Last 1) -ne '0') { throw 'La base aislada debe estar vacía.' }
  $sqlPath = $SqlBackup.Replace('\', '/')
  & $Mysql @mysqlArgs "--database=$TargetDatabase" "--execute=source $sqlPath"
  if ($LASTEXITCODE -ne 0) { throw 'Importación SQL fallida. Inspecciona la base aislada antes de reintentar.' }
} finally { Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $uploadsPath | Out-Null
Expand-Archive -LiteralPath $UploadsBackup -DestinationPath $uploadsPath
Write-Host "Restauración aislada completada: $TargetDatabase y $uploadsPath. Verifica conteos y descargas antes de considerar el backup válido."
