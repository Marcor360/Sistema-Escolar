param(
  [string]$ApiBase = 'https://api-sistema-staging.iua.edu.mx/api',
  [string]$UploadsDir = '',
  [string]$EvidencePath = ''
)

$ErrorActionPreference = 'Stop'
$base = $ApiBase.TrimEnd('/')
if ($base -notmatch '^https://[^/]+/api$') { throw 'ApiBase debe ser una URL HTTPS terminada en /api.' }
$origin = $base.Substring(0, $base.Length - 4)
$evidencias = [System.Collections.Generic.List[object]]::new()
function Registrar-Respuesta($etapa, $response) {
  $evidencias.Add([ordered]@{ etapa = $etapa; utc = [DateTime]::UtcNow.ToString('o'); http = [int]$response.StatusCode; requestId = [string]$response.Headers['x-request-id']; contentType = [string]$response.Headers['Content-Type']; bytes = $response.RawContentLength })
}

Write-Host '=== Diagnostico de marca y archivos publicos ==='
foreach ($endpoint in @('/health/live', '/health/ready', '/configuracion/marca')) {
  $url = "$base$endpoint"
  try {
    $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 15 -UseBasicParsing
    Registrar-Respuesta $endpoint $response
    Write-Host "$endpoint : HTTP $($response.StatusCode)"
    if ($endpoint -eq '/configuracion/marca') { $marca = $response.Content | ConvertFrom-Json }
  } catch {
    Write-Warning "No fue posible consultar $endpoint : $($_.Exception.Message)"
  }
}

if (-not $marca) { throw 'No fue posible recuperar la marca; verifica la API antes de revisar el logo.' }
if (-not $marca.logoUrl) { Write-Host 'No existe un logo configurado.'; exit 0 }
if ($marca.logoUrl -notmatch '^/uploads/marca-logo-[0-9a-f-]+\.(png|jpe?g|webp)$') {
  throw 'La referencia de logo no coincide con el patron publico permitido.'
}

$logoUrl = "$origin$($marca.logoUrl)"
try {
  $respuesta = Invoke-WebRequest -Uri $logoUrl -Method Get -TimeoutSec 20 -UseBasicParsing
  Registrar-Respuesta 'logo-publico' $respuesta
  Write-Host "Logo publico: HTTP $($respuesta.StatusCode) / Content-Type $($respuesta.Headers['Content-Type'])"
} catch {
  Write-Warning "Logo publico no disponible: $($_.Exception.Message)"
}
if ($UploadsDir) {
  $ruta = Join-Path $UploadsDir ([IO.Path]::GetFileName($marca.logoUrl))
  Write-Host "Existe en UPLOADS_DIR: $(Test-Path -LiteralPath $ruta -PathType Leaf)"
  Write-Host "Ruta de verificacion: $ruta"
}
Write-Host 'Comprueba que UPLOADS_DIR apunte a un directorio persistente fuera de releases/current.'

if ($EvidencePath) { $evidencias | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $EvidencePath -Encoding UTF8 }
