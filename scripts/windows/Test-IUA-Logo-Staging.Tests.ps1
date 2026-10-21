$ErrorActionPreference = 'Stop'
$diagnostico = Join-Path $PSScriptRoot 'Test-IUA-Logo-Staging.ps1'
$archivo = Join-Path ([IO.Path]::GetTempPath()) ('logo-qa-' + [guid]::NewGuid() + '.json')
$script:modo = 'sin-logo'
function Invoke-WebRequest {
  param($Uri, $Method, $TimeoutSec, [switch]$UseBasicParsing)
  if ($script:modo -eq 'fallo' -and $Uri -like '*/configuracion/marca') {
    throw [Microsoft.PowerShell.Commands.HttpResponseException]::new('Detalle privado que no debe exportarse', [Net.Http.HttpResponseMessage]::new([Net.HttpStatusCode]::ServiceUnavailable))
  }
  $headers = @{ 'Content-Type' = 'application/json' }
  $content = '{}'
  if ($Uri -eq 'https://portal.example.invalid/') {
    $headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' blob:, img-src 'self'"
    $content = '<html></html>'
  }
  if ($Uri -like '*/configuracion/marca') { $content = '{"logoUrl":null}' }
  [pscustomobject]@{ StatusCode = 200; Headers = $headers; Content = $content; RawContentLength = $content.Length }
}
try {
  & $diagnostico -ApiBase 'https://api.example.invalid/api' -WebBase 'https://portal.example.invalid/' -EvidencePath $archivo
  $evidencia = @(Get-Content -LiteralPath $archivo -Raw | ConvertFrom-Json)
  $csp = @($evidencia | Where-Object etapa -eq 'csp-imagenes')
  if ($csp.Count -ne 1 -or -not $csp[0].bloqueaBlob) { throw 'No detecta la segunda politica CSP restrictiva.' }
  if (-not ($evidencia | Where-Object etapa -eq '/configuracion/marca')) { throw 'Se pierde evidencia cuando no hay logo.' }
  $script:modo = 'fallo'
  $fallo = $false
  try { & $diagnostico -ApiBase 'https://api.example.invalid/api' -EvidencePath $archivo } catch { $fallo = $true }
  if (-not $fallo) { throw 'Debe indicar que no pudo recuperar la marca.' }
  $json = Get-Content -LiteralPath $archivo -Raw
  $evidencia = @($json | ConvertFrom-Json)
  if (-not ($evidencia | Where-Object { $_.etapa -eq '/configuracion/marca' -and $_.http -eq 503 -and $_.fallo })) { throw 'No exporta HTTP fallido antes de terminar.' }
  if ($json -match 'Detalle privado') { throw 'Se exporto informacion privada del error.' }
  Write-Host 'Diagnostico de logo: pruebas sin red aprobadas.'
} finally { Remove-Item -LiteralPath $archivo -ErrorAction SilentlyContinue }
