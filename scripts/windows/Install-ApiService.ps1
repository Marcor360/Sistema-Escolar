param(
  [string]$Root = 'C:\SistemaEscolar',
  [string]$Nssm = 'C:\Tools\nssm\win64\nssm.exe',
  [string]$ServiceName = 'SistemaEscolarApi'
)

$ErrorActionPreference = 'Stop'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$envFile = Join-Path $Root 'config\backend.env'
if (-not (Test-Path -LiteralPath $Nssm)) { throw "No se encontró NSSM: $Nssm" }
if (-not (Test-Path -LiteralPath $envFile)) { throw "Crea primero $envFile a partir de backend/.env.staging.example" }
if (-not (Test-Path -LiteralPath (Join-Path $Root 'current\backend\dist\main.js'))) {
  throw "No existe el backend compilado en $Root\current\backend. Despliega primero una release."
}

& $Nssm install $ServiceName $node
if ($LASTEXITCODE -ne 0) { throw 'NSSM no pudo instalar el servicio.' }
& $Nssm set $ServiceName AppDirectory (Join-Path $Root 'current\backend')
& $Nssm set $ServiceName AppParameters "-r dotenv/config dist/main.js"
& $Nssm set $ServiceName AppEnvironmentExtra "DOTENV_CONFIG_PATH=$envFile" "NODE_ENV=production"
& $Nssm set $ServiceName Start SERVICE_AUTO_START
& $Nssm set $ServiceName AppExit Default Restart
& $Nssm set $ServiceName AppRestartDelay 5000
& $Nssm set $ServiceName AppStdout (Join-Path $Root 'logs\api-out.log')
& $Nssm set $ServiceName AppStderr (Join-Path $Root 'logs\api-error.log')
& $Nssm set $ServiceName AppRotateFiles 1
& $Nssm set $ServiceName AppRotateOnline 1
& $Nssm set $ServiceName AppRotateBytes 10485760
if ($LASTEXITCODE -ne 0) { throw 'NSSM no pudo completar la configuración.' }
Write-Host "Servicio $ServiceName instalado. Inícialo después de revisar permisos y backend.env."
