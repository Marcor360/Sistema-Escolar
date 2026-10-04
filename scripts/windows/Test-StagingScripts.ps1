$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$deploy = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Deploy-Staging.ps1') -Raw
$service = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Install-ApiService.ps1') -Raw
$restore = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Restore-Staging.ps1') -Raw
$initialize = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Initialize-Staging.ps1') -Raw
$iis = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Configure-IIS-Staging.ps1') -Raw
foreach ($assertion in @(
  @($deploy, 'BACKUP_DB_USER'), @($deploy, 'BACKUP_DB_PASS'), @($deploy, '--ssl-mode=VERIFY_IDENTITY'),
  @($service, 'ObjectName'), @($service, 'ServiceCredential'),
  @($restore, 'escolar_staging_restore_'), @($restore, 'information_schema.tables'),
  @($restore, 'RESTORE_DB_USER'), @($restore, 'RESTORE_DB_PASS'),
  @($initialize, 'New-Item -ItemType Junction'), @($initialize, 'Install-ApiService.ps1'),
  @($iis, 'ApplicationRequestRouting'), @($iis, 'AddSslCertificate'), @($iis, 'DnsNameList')
)) {
  if (-not $assertion[0].Contains($assertion[1])) { throw "Falta marcador de estructura: $($assertion[1])" }
}
if ($deploy -match '\$env:MYSQL_PWD\s*=\s*\$env:DB_PASS') { throw 'El respaldo no debe usar la contraseña de la aplicación.' }
if ($restore -match '\$env:MYSQL_PWD\s*=\s*\$settings.BACKUP_DB_PASS') { throw 'La restauración no debe usar la contraseña de respaldo.' }
if ($service -match 'ObjectName\s+LocalSystem') { throw 'El servicio no debe correr como LocalSystem.' }
$interop = [regex]::Match($service, "Add-Type -TypeDefinition @'\r?\n([\s\S]*?)\r?\n'@")
if (-not $interop.Success) { throw 'Falta el helper WinAPI para identidad del servicio.' }
if (-not ('ServiceLogonConfig' -as [type])) { Add-Type -TypeDefinition $interop.Groups[1].Value }
if (-not (Test-Path -LiteralPath (Join-Path $root 'web\public\web.config'))) { throw 'Falta configuración SPA de IIS.' }
& (Join-Path $PSScriptRoot 'Test-PruneStaging.ps1')
Write-Host 'Estructura de scripts Windows válida.'
