$ErrorActionPreference = 'Stop'
$comando = (Get-Process -Id $PID).Path
$objetivo = (Join-Path $PSScriptRoot 'Test-PilotReadiness.ps1').Replace("'", "''")
$carpeta = Join-Path ([IO.Path]::GetTempPath()) ('escolar-readiness-' + [guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $carpeta)
$informe = (Join-Path $carpeta 'informe.json').Replace("'", "''")
try {
  foreach ($caso in @(
    @{ Nombre = 'valido'; Url = 'http://localhost:3000/api'; Codigo = 0 },
    @{ Nombre = 'version'; Url = 'http://localhost:3000/api'; Codigo = 1 },
    @{ Nombre = 'ready-incompleto'; Url = 'http://localhost:3000/api'; Codigo = 1 },
    @{ Nombre = 'html'; Url = 'http://localhost:3000/api'; Codigo = 1 },
    @{ Nombre = 'ruta'; Url = 'https://example.invalid/otra'; Codigo = 1 },
    @{ Nombre = 'credenciales'; Url = 'https://user:password@example.invalid/api'; Codigo = 1 },
    @{ Nombre = 'informe'; Url = 'http://localhost:3000/api'; Codigo = 0 },
    @{ Nombre = 'colision'; Url = 'http://localhost:3000/api'; Codigo = 1 }
  )) {
    # Proceso aislado y transporte simulado; nunca consulta servidores institucionales.
    $fuente = @"
`$ErrorActionPreference = 'Stop'
function Invoke-RestMethod {
  param(`$Uri, `$Method, `$TimeoutSec, `$MaximumRedirection, `$ErrorAction)
  if (`$MaximumRedirection -ne 0) { throw 'No se deben seguir redirecciones.' }
  if ('$($caso.Nombre)' -eq 'html') { return 'Pagina de login' }
  `$version = '1.24.0-beta.2'
  if ('$($caso.Nombre)' -eq 'version') { `$version = 'otra' }
  `$resultado = @{ status = 'ok'; version = `$version; database = 'ok'; schema = 'ok'; storage = 'ok' }
  if ('$($caso.Nombre)' -eq 'ready-incompleto' -and `$Uri.EndsWith('/ready')) { `$resultado.Remove('storage') }
  return `$resultado
}
`$salida = ''
if ('$($caso.Nombre)' -in @('informe', 'colision')) { `$salida = '$informe' }
& '$objetivo' -ApiBaseUrl '$($caso.Url)' -ExpectedVersion '1.24.0-beta.2' -OutputPath `$salida
"@
    $codificado = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($fuente))
    $mensajes = & $comando -NoProfile -NonInteractive -EncodedCommand $codificado 2>&1
    if ($LASTEXITCODE -ne $caso.Codigo) { throw "Resultado incorrecto en $($caso.Nombre): $mensajes" }
    if ($caso.Nombre -eq 'informe') { $previo = [IO.File]::ReadAllText($informe) }
    if ($caso.Nombre -eq 'colision' -and [IO.File]::ReadAllText($informe) -ne $previo) { throw 'Se sobrescribió un informe.' }
  }
  $global:LASTEXITCODE = 0
  Write-Host 'Diagnóstico HTTP: contrato, versión y no sobrescritura comprobados con transporte simulado.'
} finally { Remove-Item -LiteralPath $carpeta -Recurse -Force }
