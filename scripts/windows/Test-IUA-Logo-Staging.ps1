param(
  [string]$ApiBase = 'https://api-sistema-staging.iua.edu.mx/api',
  [string]$UploadsDir = '',
  [string]$EvidencePath = '',
  [string]$WebBase = ''
)

$ErrorActionPreference = 'Stop'
$base = $ApiBase.TrimEnd('/')
if ($base -notmatch '^https://[^/]+/api$') { throw 'ApiBase debe ser una URL HTTPS terminada en /api.' }
$origin = $base.Substring(0, $base.Length - 4)
$marca = $null
$evidencias = [System.Collections.Generic.List[object]]::new()
function Registrar-Respuesta($etapa, $response) {
  $evidencias.Add([ordered]@{ etapa = $etapa; utc = [DateTime]::UtcNow.ToString('o'); http = [int]$response.StatusCode; requestId = [string]$response.Headers['x-request-id']; contentType = [string]$response.Headers['Content-Type']; bytes = $response.RawContentLength })
}

function Registrar-Fallo($etapa, $fallo) {
  $status = $null
  if ($fallo.Exception.Response) { $status = [int]$fallo.Exception.Response.StatusCode }
  $evidencias.Add([ordered]@{ etapa = $etapa; utc = [DateTime]::UtcNow.ToString('o'); http = $status; fallo = $true })
  Write-Warning "$etapa : consulta fallida (HTTP $status); revisar conectividad o servidor."
}

try {
if ($WebBase) {
  if ($WebBase -notmatch '^https://[^/?#]+/?$') { throw 'WebBase debe ser el origen HTTPS del portal.' }
  try {
    $web = Invoke-WebRequest -Uri $WebBase -Method Get -TimeoutSec 15 -UseBasicParsing
    Registrar-Respuesta 'web-csp' $web
    $politicas = @($web.Headers['Content-Security-Policy'])
    $encontrada = $false; $bloquea = $false
    foreach ($valor in $politicas) { foreach ($politica in ($valor -split ',')) {
      if (-not $politica.Trim()) { continue }
      $encontrada = $true
      $imagenes = $null; $defecto = $null
      foreach ($directiva in ($politica -split ';')) {
        $tokens = $directiva.Trim() -split '\s+'
        if ($tokens[0] -eq 'img-src' -and $null -eq $imagenes) { $imagenes = @($tokens | Select-Object -Skip 1) }
        if ($tokens[0] -eq 'default-src' -and $null -eq $defecto) { $defecto = @($tokens | Select-Object -Skip 1) }
      }
      $fuentes = $imagenes
      if ($null -eq $fuentes) { $fuentes = $defecto }
      if ($null -ne $fuentes -and $fuentes -notcontains 'blob:') { $bloquea = $true }
    } }
    $meta = $web.Content -match '(?is)<meta\b[^>]*http-equiv\s*=\s*["'']?Content-Security-Policy'
    $evidencias.Add([ordered]@{ etapa = 'csp-imagenes'; encabezadoPresente = $encontrada; bloqueaBlob = $bloquea; metaCsp = $meta })
    Write-Host "CSP: encabezado=$encontrada; bloqueo blob:=$bloquea; meta CSP=$meta. Confirmar politica efectiva en navegador."
  } catch { Registrar-Fallo 'web-csp' $_ }
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
    Registrar-Fallo $endpoint $_
  }
}

if (-not $marca) { throw 'No fue posible recuperar la marca; verifica la API antes de revisar el logo.' }
if (-not $marca.logoUrl) { Write-Host 'No existe un logo configurado.'; return }
if ($marca.logoUrl -notmatch '^/uploads/marca-logo-[0-9a-f-]+\.(png|jpe?g|webp)$') {
  throw 'La referencia de logo no coincide con el patron publico permitido.'
}

$logoUrl = "$origin$($marca.logoUrl)"
try {
  $respuesta = Invoke-WebRequest -Uri $logoUrl -Method Get -TimeoutSec 20 -UseBasicParsing
  Registrar-Respuesta 'logo-publico' $respuesta
  Write-Host "Logo publico: HTTP $($respuesta.StatusCode) / Content-Type $($respuesta.Headers['Content-Type'])"
} catch {
  Registrar-Fallo 'logo-publico' $_
}
if ($UploadsDir) {
  $ruta = Join-Path $UploadsDir ([IO.Path]::GetFileName($marca.logoUrl))
  Write-Host "Existe en UPLOADS_DIR: $(Test-Path -LiteralPath $ruta -PathType Leaf)"
  Write-Host "Ruta de verificacion: $ruta"
}
Write-Host 'Comprueba que UPLOADS_DIR apunte a un directorio persistente fuera de releases/current.'

} finally {
  if ($EvidencePath) { ConvertTo-Json -InputObject @($evidencias.ToArray()) -Depth 3 | Set-Content -LiteralPath $EvidencePath -Encoding UTF8 }
}
