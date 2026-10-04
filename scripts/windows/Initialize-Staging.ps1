param(
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][pscredential]$ServiceCredential,
  [string]$Root = 'C:\SistemaEscolar',
  [string]$ServiceName = 'SistemaEscolarApi',
  [string]$Nssm = 'C:\Tools\nssm\win64\nssm.exe',
  [string]$ApiBaseUrl = 'https://api-staging.dominio.mx/api'
)

$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+([-.][A-Za-z0-9.-]+)?$') { throw 'Version debe ser semver.' }
$Source = (Resolve-Path -LiteralPath $Source).Path
$release = Join-Path $Root "releases\$Version"
$current = Join-Path $Root 'current'
if (Test-Path -LiteralPath $current) { throw "Ya existe $current; usa Deploy-Staging.ps1." }
if (Test-Path -LiteralPath $release) { throw "Ya existe $release." }
if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) { throw "Ya existe $ServiceName." }
foreach ($dir in @('releases', 'config', 'data\uploads', 'logs', 'backups\database', 'backups\uploads')) {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root $dir) | Out-Null
}
$envFile = Join-Path $Root 'config\backend.env'
if (-not (Test-Path -LiteralPath $envFile)) { throw "Prepara $envFile antes del bootstrap." }
if (-not (Test-Path -LiteralPath (Join-Path $Root 'config\backup.env'))) { throw 'Prepara config\backup.env con una cuenta MySQL de respaldo separada.' }
foreach ($line in Get-Content -LiteralPath $envFile) {
  if ($line -match '^\s*([^#\s][^=]*)=(.*)$') {
    $value = $Matches[2].Trim().Trim('"', "'")
    [Environment]::SetEnvironmentVariable($Matches[1].Trim(), $value, 'Process')
  }
}
if ($env:NODE_ENV -ne 'production' -or $env:APP_ENV -ne 'staging' -or $env:DB_SYNC -ne 'false' -or $env:DB_NAME -ne 'escolar_staging' -or $env:DB_TYPE -ne 'mysql') {
  throw 'backend.env debe declarar NODE_ENV=production, APP_ENV=staging, DB_SYNC=false, DB_TYPE=mysql y DB_NAME=escolar_staging.'
}
if (-not $env:DB_PASS -or $env:DB_PASS -like 'REEMPLAZAR*' -or -not $env:JWT_SECRET -or $env:JWT_SECRET -like 'REEMPLAZAR*') {
  throw 'Completa DB_PASS y JWT_SECRET con secretos propios de staging.'
}
$backupSettings = @{}
foreach ($line in Get-Content -LiteralPath (Join-Path $Root 'config\backup.env')) {
  if ($line -match '^\s*(BACKUP_DB_USER|BACKUP_DB_PASS)=(.*)$') { $backupSettings[$Matches[1]] = $Matches[2].Trim().Trim('"', "'") }
}
if (-not $backupSettings.BACKUP_DB_USER -or $backupSettings.BACKUP_DB_USER -eq $env:DB_USER -or -not $backupSettings.BACKUP_DB_PASS -or $backupSettings.BACKUP_DB_PASS -like 'REEMPLAZAR*') {
  throw 'Configura un usuario MySQL de backup distinto del usuario de aplicación.'
}
$account = $ServiceCredential.UserName
if ($account -notmatch '^\.\\[^\\]+$') { throw 'El bootstrap requiere una cuenta local dedicada con formato .\usuario.' }
$name = $account.Substring(2)
if (-not (Get-LocalUser -Name $name -ErrorAction SilentlyContinue)) {
  New-LocalUser -Name $name -Password $ServiceCredential.Password -PasswordNeverExpires -Description 'API Sistema Escolar staging' | Out-Null
}
$admins = Get-LocalGroupMember -Group (Get-LocalGroup -SID 'S-1-5-32-544') -ErrorAction Stop
if ($admins.Name -contains "$env:COMPUTERNAME\$name") { throw 'La cuenta del servicio pertenece a Administrators.' }
New-Item -ItemType Directory -Path $release | Out-Null
foreach ($name in @('backend', 'web', 'database')) {
  $from = Join-Path $Source $name
  if (-not (Test-Path -LiteralPath $from)) { throw "Falta $from." }
  $to = Join-Path $release $name
  New-Item -ItemType Directory -Path $to | Out-Null
  $excludeDirs = @('node_modules', 'dist', 'coverage', 'uploads', '.git')
  & robocopy $from $to /E /NFL /NDL /NJH /NJS /NC /NS /XD $excludeDirs /XF '.env*'
  if ($LASTEXITCODE -ge 8) { throw "Robocopy falló para ${name}: $LASTEXITCODE" }
}
Push-Location (Join-Path $release 'backend')
try {
  npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci backend falló.' }
  npm run build; if ($LASTEXITCODE -ne 0) { throw 'Build backend falló.' }
  Write-Host 'Verifica manualmente baseline/adopt antes de ejecutar migraciones sobre una base nueva.'
  npm run db:migrate:status; if ($LASTEXITCODE -ne 0) { throw 'La base no tiene un historial de migraciones válido.' }
  npm run db:migrate; if ($LASTEXITCODE -ne 0) { throw 'Migraciones fallidas; revisa la base antes de continuar.' }
} finally { Pop-Location }
Push-Location (Join-Path $release 'web')
try {
  npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci web falló.' }
  $env:VITE_API_URL = $ApiBaseUrl
  npm run build; if ($LASTEXITCODE -ne 0) { throw 'Build web falló.' }
} finally { Pop-Location }

foreach ($entry in @(@($Root, '(RX)'), @((Join-Path $Root 'releases'), '(OI)(CI)RX'), @((Join-Path $Root 'data\uploads'), '(OI)(CI)M'), @((Join-Path $Root 'logs'), '(OI)(CI)M'), @($envFile, 'R'))) {
  & icacls.exe $entry[0] /grant "${account}:$($entry[1])" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudo otorgar ACL en $($entry[0])." }
}
foreach ($protectedFile in @($envFile, (Join-Path $Root 'config\backup.env'))) {
  & icacls.exe $protectedFile /inheritance:r /grant '*S-1-5-18:F' '*S-1-5-32-544:F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudo proteger $protectedFile." }
}
& icacls.exe $envFile /grant "${account}:R" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo dar lectura de backend.env al servicio.' }
New-Item -ItemType Junction -Path $current -Target $release | Out-Null
try {
  & (Join-Path $Source 'scripts\windows\Install-ApiService.ps1') -Root $Root -Nssm $Nssm -ServiceName $ServiceName -ServiceCredential $ServiceCredential
} catch {
  Remove-Item -LiteralPath $current -Force -ErrorAction SilentlyContinue
  throw
}
Write-Host "Bootstrap preparado en $current. Configura IIS y TLS; luego inicia $ServiceName y comprueba health."
