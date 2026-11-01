[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
  [string]$Source = (Join-Path $PSScriptRoot '..\..'),
  [string]$SettingsPath = 'C:\SistemaEscolar\config\deploy-staging.json',
  [ValidateSet('Todo', 'Sistema', 'PortalAlumno')][string]$Target = 'Todo',
  [string]$Version,
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'

function Get-UpdateSourceCommit([string]$SourcePath) {
  $sha = & git -C $SourcePath rev-parse HEAD
  if ($LASTEXITCODE -ne 0 -or $sha -notmatch '^[a-f0-9]{40}$') { throw 'Source debe ser un checkout Git con un commit identificado.' }
  $changes = & git -C $SourcePath status --porcelain --untracked-files=normal
  if ($LASTEXITCODE -ne 0 -or $changes) { throw 'El checkout tiene cambios pendientes; usa un commit limpio y validado por CI.' }
  return [string]$sha
}

function Get-StagingUpdatePlan {
  param([string]$SourcePath, [string]$ConfigPath, [string]$Component, [string]$ExpectedVersion)
  $sourceRoot = (Resolve-Path -LiteralPath $SourcePath -ErrorAction Stop).Path
  $settings = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  $allowed = @('Root', 'PortalRoot', 'ServiceName', 'DatabaseName', 'MysqlDump', 'ApiBaseUrl', 'PortalHost', 'SiteName')
  foreach ($key in $settings.PSObject.Properties.Name) {
    if ($key -notin $allowed) { throw "Configuración desconocida: $key. No guardes secretos en este JSON." }
  }
  foreach ($key in $allowed) {
    if (-not ($settings.$key -is [string]) -or [string]::IsNullOrWhiteSpace($settings.$key)) { throw "Falta $key en la configuración de despliegue." }
  }
  $api = $null
  if (-not [uri]::TryCreate($settings.ApiBaseUrl, [UriKind]::Absolute, [ref]$api) -or
      $api.Scheme -ne 'https' -or $api.AbsolutePath -ne '/api' -or $api.Query -or $api.Fragment -or $api.UserInfo -or
      $settings.ApiBaseUrl -ne $settings.ApiBaseUrl.Trim()) {
    throw 'ApiBaseUrl debe ser HTTPS y terminar en /api, sin credenciales, consulta ni fragmento.'
  }
  if ([uri]::CheckHostName($settings.PortalHost) -ne [UriHostNameType]::Dns -or $settings.PortalHost.Contains(':')) {
    throw 'PortalHost debe ser un hostname DNS, sin protocolo ni puerto.'
  }
  foreach ($key in @('Root', 'PortalRoot', 'MysqlDump')) {
    if (-not [IO.Path]::IsPathRooted($settings.$key)) { throw "$key debe ser una ruta absoluta." }
  }
  $systemRoot = [IO.Path]::GetFullPath($settings.Root).TrimEnd('\', '/')
  $portalRoot = [IO.Path]::GetFullPath($settings.PortalRoot).TrimEnd('\', '/')
  if ($systemRoot -eq $portalRoot) { throw 'Root y PortalRoot deben ser distintos.' }
  foreach ($folder in @('current', 'previous', 'releases', 'data', 'config')) {
    $reserved = (Join-Path $systemRoot $folder).TrimEnd('\', '/')
    if ($portalRoot -eq $reserved -or $portalRoot.StartsWith($reserved + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'PortalRoot no puede estar dentro de releases, datos, configuración ni junctions de la API.'
    }
  }
  $versions = @('backend', 'web', 'mobile') | ForEach-Object {
    (Get-Content -LiteralPath (Join-Path $sourceRoot "$_/package.json") -Raw | ConvertFrom-Json).version
  }
  $versions += (Get-Content -LiteralPath (Join-Path $sourceRoot 'mobile/app.json') -Raw | ConvertFrom-Json).expo.version
  $candidate = $versions[0]
  if ($candidate -notmatch '^\d+\.\d+\.\d+$' -or @($versions | Where-Object { $_ -ne $candidate }).Count) {
    throw 'Backend, web, mobile y app.json deben compartir una versión semver estable.'
  }
  if ($ExpectedVersion -and $ExpectedVersion -ne $candidate) { throw "La versión solicitada $ExpectedVersion no coincide con $candidate." }
  $sha = Get-UpdateSourceCommit $sourceRoot
  $envPath = Join-Path $systemRoot 'config/backend.env'
  if (-not (Test-Path -LiteralPath $envPath)) { throw 'Falta config/backend.env; no se modificará ningún componente.' }
  # Solo se lee el puerto; los secretos permanecen en el archivo protegido.
  $portLines = @(Select-String -LiteralPath $envPath -Pattern '^\s*PORT\s*=' | ForEach-Object { $_.Line })
  if ($portLines.Count -gt 1) { throw 'PORT está duplicado en backend.env.' }
  $port = 3000
  if ($portLines.Count) {
    $rawPort = ($portLines[0] -split '=', 2)[1].Trim().Trim('"', "'")
    if (-not [int]::TryParse($rawPort, [ref]$port) -or $port -lt 1 -or $port -gt 65535) { throw 'PORT inválido en backend.env.' }
  }
  if ($Component -in @('Todo', 'Sistema') -and -not (Test-Path -LiteralPath (Join-Path $systemRoot 'config/backup.env'))) {
    throw 'Falta config/backup.env para respaldar antes de actualizar el sistema.'
  }
  return [pscustomobject]@{
    Version = $candidate; Commit = $sha; Target = $Component; Source = $sourceRoot
    Root = $systemRoot; PortalRoot = $portalRoot; ServiceName = $settings.ServiceName
    DatabaseName = $settings.DatabaseName; MysqlDump = $settings.MysqlDump
    ApiBaseUrl = $settings.ApiBaseUrl; HealthUrl = $settings.ApiBaseUrl + '/health/ready'
    PortalHost = $settings.PortalHost; SiteName = $settings.SiteName; ApiPort = $port
  }
}

function Invoke-StagingSystemUpdate($Plan) {
  & (Join-Path $PSScriptRoot 'Deploy-Staging.ps1') -Version $Plan.Version -Source $Plan.Source -Root $Plan.Root `
    -ServiceName $Plan.ServiceName -DatabaseName $Plan.DatabaseName -MysqlDump $Plan.MysqlDump `
    -ApiBaseUrl $Plan.ApiBaseUrl -HealthUrl $Plan.HealthUrl
}

function Invoke-StagingPortalUpdate($Plan) {
  & (Join-Path $PSScriptRoot 'Deploy-PortalAlumno-Staging.ps1') -Version $Plan.Version -Source $Plan.Source `
    -Root $Plan.PortalRoot -PortalHost $Plan.PortalHost -UpstreamApiBaseUrl $Plan.ApiBaseUrl `
    -SiteName $Plan.SiteName -ApiPort $Plan.ApiPort
}

function Assert-StagingPortalSite($Plan) {
  Import-Module WebAdministration -ErrorAction Stop
  $site = Get-Website -Name $Plan.SiteName -ErrorAction Stop
  if (-not $site) { throw 'Falta el sitio IIS del alumno. Completa primero la publicación inicial y su certificado.' }
  $expected = Join-Path $Plan.PortalRoot 'current'
  if ([IO.Path]::GetFullPath($site.physicalPath).TrimEnd('\', '/') -ne [IO.Path]::GetFullPath($expected).TrimEnd('\', '/')) {
    throw 'El sitio IIS no apunta al current del PortalRoot configurado; no se actualizará el sistema.'
  }
}

function Invoke-StagingUpdate($Plan) {
  if ($Plan.Target -in @('Todo', 'PortalAlumno')) { Assert-StagingPortalSite $Plan }
  if ($Plan.Target -in @('Todo', 'Sistema')) { Invoke-StagingSystemUpdate $Plan }
  if ($Plan.Target -in @('Todo', 'PortalAlumno')) {
    try { Invoke-StagingPortalUpdate $Plan } catch {
      throw "Portal Alumno no actualizado. Verifica el estado de la API y el portal antes de reintentar solo PortalAlumno. No se revierte la base automáticamente. Detalle: $($_.Exception.Message)"
    }
  }
}

# Dot-source permite probar planificación y orden con dobles, sin tocar IIS/BD.
if ($MyInvocation.InvocationName -eq '.') { return }
$plan = Get-StagingUpdatePlan -SourcePath $Source -ConfigPath $SettingsPath -Component $Target -ExpectedVersion $Version
if ($ValidateOnly) { $plan; return }
if (-not $PSCmdlet.ShouldProcess("$Target $($plan.Version), commit $($plan.Commit)", 'Respaldar y actualizar staging')) { $plan; return }
if ($env:OS -ne 'Windows_NT') { throw 'La activación requiere Windows/IIS. Usa -ValidateOnly o -WhatIf para consultar el plan.' }
$lockPath = Join-Path $plan.Root 'config/update-staging.lock'
$lock = $null
try {
  # Un segundo actualizador falla antes de llamar a los scripts de activación.
  $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  Write-Host "Actualizando $($plan.Version), commit $($plan.Commit), componente $Target"
  Invoke-StagingUpdate $plan
  Write-Host "Actualización de $Target completada."
} finally { if ($lock) { $lock.Dispose() } }
# Robocopy puede devolver 1 al copiar correctamente. No propagar ese código
# aceptado por los módulos como fallo de todo el workflow PowerShell.
exit 0
