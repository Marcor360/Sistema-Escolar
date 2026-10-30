$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$webConfigPath = Join-Path $root 'mobile\public\web.config'
[xml]$config = Get-Content -LiteralPath $webConfigPath -Raw
$rules = @($config.configuration.'system.webServer'.rewrite.rules.rule)
if ($rules.Count -ne 2) { throw 'El portal debe tener proxy API primero y fallback SPA segundo.' }
if ($rules[0].match.url -ne '^(api|uploads)(/.*)?$' -or $rules[0].action.url -ne 'http://127.0.0.1:3000/{R:0}') {
  throw 'El proxy de mismo origen para API y logos no coincide con el contrato.'
}
if ($rules[1].action.url -ne '/index.html') { throw 'Falta fallback de Expo Web.' }
$deploy = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Deploy-PortalAlumno-Staging.ps1') -Raw
$configure = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Configure-IIS-PortalAlumno-Staging.ps1') -Raw
foreach ($marker in @(
  'EXPO_PUBLIC_API_URL',
  'APP_ENV',
  'npm run build:web',
  'health/ready',
  'Remove-OnlyPortalJunction',
  'Get-Website'
)) {
  if (-not $deploy.Contains($marker)) { throw "Falta control de despliegue: $marker" }
}
foreach ($marker in @('CertificateThumbprint', 'AddSslCertificate', 'DnsNameList', 'ApplicationRequestRouting')) {
  if (-not $configure.Contains($marker)) { throw "Falta control de IIS: $marker" }
}
$canonicalHost = 'stagin-portal-alumno.iua.edu.mx'
foreach ($scriptContent in @($deploy, $configure)) {
  if (-not $scriptContent.Contains("[string]`$PortalHost = '$canonicalHost'")) { throw 'El portal debe usar exactamente el hostname institucional aprobado por defecto.' }
  if ($scriptContent.Contains('stagin-portal-alumnoiua.edu.mx')) { throw 'El portal conserva una referencia al hostname incorrecto.' }
}
if ($deploy -match 'db:migrate|Stop-Service|Start-Service') { throw 'El despliegue del alumno no debe modificar la API ni la BD.' }
Write-Host 'Portal Alumno: contrato IIS, publicación aislada y controles básicos válidos.'
