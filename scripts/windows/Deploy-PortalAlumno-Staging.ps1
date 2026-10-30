param(
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][string]$Source,
  [string]$Root = 'C:\SistemaEscolar\portal-alumno',
  [string]$PortalHost = 'stagin-portal-alumnoiua.edu.mx',
  [string]$UpstreamApiBaseUrl = 'https://api-sistema-staging.iua.edu.mx/api',
  [string]$SiteName = 'SistemaEscolar-Staging-PortalAlumno'
)

$ErrorActionPreference = 'Stop'

function Remove-OnlyPortalJunction([string]$Path) {
  if ($Path -notin @($current, $previous)) { throw "No se permite retirar la ruta $Path." }
  $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  if ($item.LinkType -ne 'Junction') { throw "La ruta $Path no es Junction. No se modificará." }
  & cmd.exe /d /c "rmdir `"$Path`""
  if ($LASTEXITCODE -ne 0 -or (Test-Path -LiteralPath $Path)) { throw "No se pudo retirar la Junction $Path." }
}

if ($Version -notmatch '^\d+\.\d+\.\d+([-.][A-Za-z0-9.-]+)?$') { throw 'Version debe ser semver.' }
if ($PortalHost -notmatch '^[a-zA-Z0-9.-]+$' -or $PortalHost.Contains('/')) { throw 'PortalHost inválido.' }
if ($UpstreamApiBaseUrl -notmatch '^https://[^/]+/api$') { throw 'UpstreamApiBaseUrl debe ser HTTPS y terminar exactamente en /api.' }

$Source = (Resolve-Path -LiteralPath $Source -ErrorAction Stop).Path
$mobile = Join-Path $Source 'mobile'
$packagePath = Join-Path $mobile 'package.json'
$webConfig = Join-Path $mobile 'public\web.config'
if (-not (Test-Path -LiteralPath $packagePath) -or -not (Test-Path -LiteralPath $webConfig)) {
  throw 'El checkout debe contener mobile/package.json y mobile/public/web.config.'
}
$packageVersion = (Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json).version
if ($packageVersion -ne $Version) { throw "mobile/package.json ($packageVersion) no coincide con $Version." }

# La API debe estar desplegada y lista ANTES del portal; no migrar ni tocar su servicio desde aquí.
$ready = Invoke-RestMethod -Uri "$UpstreamApiBaseUrl/health/ready" -TimeoutSec 15 -ErrorAction Stop
if ($ready.status -ne 'ok' -or $ready.version -ne $Version) {
  throw "La API no está lista en versión $Version. Respuesta: status=$($ready.status), version=$($ready.version)."
}

$releases = Join-Path $Root 'releases'
$current = Join-Path $Root 'current'
$previous = Join-Path $Root 'previous'
$release = Join-Path $releases $Version
if (Test-Path -LiteralPath $release) { throw "La release $Version ya existe. No se sobrescribe." }
if (Test-Path -LiteralPath $current) {
  if ((Get-Item -LiteralPath $current -Force).LinkType -ne 'Junction') { throw 'current existe pero no es Junction. No se modificará.' }
}
if (Test-Path -LiteralPath $previous) {
  if ((Get-Item -LiteralPath $previous -Force).LinkType -ne 'Junction') { throw 'previous existe pero no es Junction. No se modificará.' }
}

$portalUrl = "https://$PortalHost"
$env:APP_ENV = 'preview'
$env:EXPO_PUBLIC_API_URL = "$portalUrl/api"
Push-Location $mobile
try {
  & npm ci --include=dev
  if ($LASTEXITCODE -ne 0) { throw 'npm ci de mobile falló.' }
  & npm run build:web
  if ($LASTEXITCODE -ne 0) { throw 'La exportación Expo Web falló.' }
} finally { Pop-Location }

$dist = Join-Path $mobile 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) { throw 'Expo no generó mobile/dist/index.html.' }
if (-not @(Get-ChildItem -LiteralPath $dist -Recurse -File -Filter '*.js').Count) { throw 'La exportación no contiene JavaScript.' }
New-Item -ItemType Directory -Force -Path $releases | Out-Null
$stagingRelease = Join-Path $releases ('.preparacion-' + $Version + '-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stagingRelease | Out-Null
& robocopy.exe $dist $stagingRelease /E /NFL /NDL /NJH /NJS /NC /NS
if ($LASTEXITCODE -ge 8) { throw "Robocopy falló ($LASTEXITCODE); no se cambió current." }
Copy-Item -LiteralPath $webConfig -Destination (Join-Path $stagingRelease 'web.config') -Force
if (-not (Test-Path -LiteralPath (Join-Path $stagingRelease 'index.html'))) { throw 'La release preparada no contiene index.html.' }
Rename-Item -LiteralPath $stagingRelease -NewName $Version -ErrorAction Stop

# IIS usa una Junction estable; no se detiene API ni web administrativo.
$oldTarget = $null
if (Test-Path -LiteralPath $current) {
  $oldTarget = @((Get-Item -LiteralPath $current -Force).Target)[0]
  if (-not (Test-Path -LiteralPath $oldTarget)) { throw 'La release anterior no existe.' }
}

$siteExists = $false
if (Get-Module -ListAvailable -Name WebAdministration) {
  Import-Module WebAdministration -ErrorAction Stop
  $siteExists = [bool](Get-Website -Name $SiteName -ErrorAction SilentlyContinue)
}

$movedOld = $false
$createdCurrent = $false
try {
  if ($oldTarget) {
    if (Test-Path -LiteralPath $previous) { Remove-OnlyPortalJunction $previous }
    Move-Item -LiteralPath $current -Destination $previous -ErrorAction Stop
    $movedOld = $true
  }
  New-Item -ItemType Junction -Path $current -Target $release -ErrorAction Stop | Out-Null
  $createdCurrent = $true
  if ($siteExists) {
    $page = Invoke-WebRequest -Uri "$portalUrl/" -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch '<html') { throw 'La portada pública no devuelve HTML válido.' }
    $proxyReady = Invoke-RestMethod -Uri "$portalUrl/api/health/ready" -TimeoutSec 20 -ErrorAction Stop
    if ($proxyReady.status -ne 'ok' -or $proxyReady.version -ne $Version) {
      throw 'El proxy público /api no devuelve el estado/version esperados.'
    }
  }
} catch {
  $failure = $_.Exception.Message
  try {
    if ($createdCurrent) { Remove-OnlyPortalJunction $current }
    if ($movedOld) { Move-Item -LiteralPath $previous -Destination $current -ErrorAction Stop }
  } catch {
    throw "CRITICO: el portal no pudo recuperar su Junction. Error inicial: $failure. Error de recuperación: $($_.Exception.Message)"
  }
  throw "No se activó Portal Alumno ${Version}: $failure"
}

Write-Host "Portal Alumno $Version preparado en $release"
Write-Host "API incorporada al bundle: $portalUrl/api (mismo origen)"
if ($siteExists) {
  Write-Host "Portal y proxy públicos verificados en $portalUrl/"
} else {
  Write-Warning "No existe el sitio IIS $SiteName. Ejecuta Configure-IIS-PortalAlumno-Staging.ps1 y valida el acceso HTTPS."
}
