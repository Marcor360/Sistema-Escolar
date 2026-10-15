[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ApiBaseUrl,
  [string]$ExpectedVersion = '',
  [string]$OutputPath = ''
)
$ErrorActionPreference = 'Stop'
try { $uri = [uri]$ApiBaseUrl } catch { throw 'ApiBaseUrl debe ser una URL absoluta.' }
if (-not $uri.IsAbsoluteUri -or $uri.UserInfo -or $uri.Query -or $uri.Fragment) { throw 'ApiBaseUrl inválida.' }
$loopback = $uri.Host -in @('localhost','127.0.0.1','::1')
if ($uri.Scheme -ne 'https' -and -not ($loopback -and $uri.Scheme -eq 'http')) {
  throw 'Solo se permite HTTPS, excepto HTTP sobre loopback local de pruebas.'
}
$base = $ApiBaseUrl.TrimEnd('/')
if ($base.EndsWith('/api')) { $base = $base.Substring(0, $base.Length - 4) }
$version = $ExpectedVersion.Trim()
$resultados = @()
foreach ($endpoint in @('/api/health/live', '/api/health/ready')) {
  $estado = 'FALLO'; $detalle = ''
  try {
    $respuesta = Invoke-RestMethod -Uri ($base + $endpoint) -Method Get -TimeoutSec 15 -ErrorAction Stop
    $estado = 'OK'
    if ($endpoint.EndsWith('/live') -and $version -and $respuesta.version -ne $version) {
      $estado = 'FALLO'
      $detalle = 'La versión no corresponde al build esperado.'
    }
  } catch {
    $estado = 'FALLO'
    $detalle = 'Endpoint inaccesible o respuesta inválida; revisar HTTPS, servicio y conectividad.'
  }
  $resultados += [pscustomobject]@{ Endpoint = $endpoint; Estado = $estado; Detalle = $detalle }
  Write-Host ('{0} {1}' -f $estado, $endpoint)
}
$salida = [pscustomobject]@{
  Fecha = (Get-Date).ToString('o')
  Origen = $uri.Scheme + '://' + $uri.Authority
  VersionEsperada = $version
  Resultados = $resultados
  Advertencia = 'Solo pruebas HTTP read-only; no acredita SMTP, ClamAV, backups ni transacciones de Openpay.'
}
if ($OutputPath) {
  $ruta = [IO.Path]::GetFullPath($OutputPath)
  if (Test-Path -LiteralPath $ruta) { throw 'No se sobrescriben informes existentes.' }
  $salida | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ruta -Encoding UTF8
}
if (@($resultados | Where-Object { $_.Estado -ne 'OK' }).Count -gt 0) { exit 1 }
Write-Host 'Health checks aprobados. Revisar el resto de puertas institucionales antes de la beta.'
