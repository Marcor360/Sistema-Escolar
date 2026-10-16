param(
  [string]$Root = 'C:\SistemaEscolar',
  [string]$ServiceName = 'SistemaEscolarApi',
  [string]$ApiBaseUrl = 'https://api-sistema-staging.iua.edu.mx/api'
)

$ErrorActionPreference = 'Stop'
if ($ApiBaseUrl -notmatch '^https://[^/]+/api$') {
  throw 'ApiBaseUrl debe ser una URL HTTPS absoluta terminada en /api.'
}

$results = [System.Collections.Generic.List[object]]::new()
function Check([string]$Name, [bool]$Passed, [string]$Detail) {
  $results.Add([pscustomobject]@{ Check = $Name; Ok = $Passed; Detail = $Detail })
}

$activePath = Join-Path $Root 'current'
$entry = Get-Item -LiteralPath $activePath -Force -ErrorAction SilentlyContinue
Check 'Junction activa' ($null -ne $entry -and $entry.LinkType -eq 'Junction') 'current debe ser una junction'
if ($entry -and $entry.LinkType -eq 'Junction') {
  $target = @($entry.Target)[0]
  $package = Join-Path $target 'backend\package.json'
  if (Test-Path -LiteralPath $package) {
    $version = (Get-Content -LiteralPath $package -Raw | ConvertFrom-Json).version
    Check 'Version de release' (-not [string]::IsNullOrWhiteSpace($version)) "Version instalada: $version"
  } else {
    Check 'Version de release' $false 'No se encontro backend/package.json'
  }
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
Check 'Servicio API' ($null -ne $service -and $service.Status -eq 'Running') 'Debe estar Running'

foreach ($path in @('config\backend.env', 'data\uploads', 'backups\database', 'backups\uploads')) {
  Check "Ruta $path" (Test-Path -LiteralPath (Join-Path $Root $path)) 'Presencia sin inspeccionar contenido privado'
}

foreach ($endpoint in @('health/live', 'health/ready')) {
  try {
    $response = Invoke-RestMethod -Uri "$ApiBaseUrl/$endpoint" -TimeoutSec 8 -ErrorAction Stop
    Check "API $endpoint" ($response.status -eq 'ok') "Estado: $($response.status); version: $($response.version)"
  } catch {
    Check "API $endpoint" $false 'Sin respuesta valida; revisar manualmente conectividad y registros privados'
  }
}

$results | Format-Table -AutoSize
if (@($results | Where-Object { -not $_.Ok }).Count -gt 0) { exit 1 }
exit 0
