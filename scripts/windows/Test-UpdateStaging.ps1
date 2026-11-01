$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Update-Staging.ps1')
function Assert-Fails([scriptblock]$Action, [string]$Pattern) {
  $failure = $null
  try { & $Action | Out-Null } catch { $failure = $_.Exception.Message }
  if (-not $failure -or $failure -notlike $Pattern) { throw "Se esperaba $Pattern; resultado: $failure" }
}
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('update-staging-' + [guid]::NewGuid().ToString('N'))
$sourceRoot = Join-Path $fixture 'source'
$systemRoot = Join-Path $fixture 'system'
$config = Join-Path $fixture 'deploy.json'
try {
  foreach ($name in @('backend', 'web', 'mobile')) {
    New-Item -ItemType Directory -Path (Join-Path $sourceRoot $name) -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $sourceRoot "$name/package.json") -Value '{"version":"1.2.3"}' -Encoding UTF8
  }
  Set-Content -LiteralPath (Join-Path $sourceRoot 'mobile/app.json') -Value '{"expo":{"version":"1.2.3"}}' -Encoding UTF8
  & git -C $sourceRoot init -q
  & git -C $sourceRoot add .
  & git -C $sourceRoot -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm fixture
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el checkout de prueba.' }
  New-Item -ItemType Directory -Path (Join-Path $systemRoot 'config') -Force | Out-Null
  $envPath = Join-Path $systemRoot 'config/backend.env'
  Set-Content -LiteralPath $envPath -Value 'PORT="3100"'
  Set-Content -LiteralPath (Join-Path $systemRoot 'config/backup.env') -Value '# Solo fixture, sin credenciales'
  $settings = [ordered]@{
    Root=$systemRoot; PortalRoot=(Join-Path $systemRoot 'portal-alumno'); ServiceName='FakeApi'; DatabaseName='escolar_staging'
    MysqlDump=(Join-Path $fixture 'mysqldump.exe'); ApiBaseUrl='https://api.example.invalid/api'
    PortalHost='alumno.example.invalid'; SiteName='FakePortal'
  }
  function Save-Settings { $settings | ConvertTo-Json | Set-Content -LiteralPath $config -Encoding UTF8 }
  Save-Settings
  $plan = Get-StagingUpdatePlan $sourceRoot $config 'Todo' ''
  if ($plan.Version -ne '1.2.3' -or $plan.ApiPort -ne 3100 -or $plan.Commit -notmatch '^[a-f0-9]{40}$' -or $plan.HealthUrl -ne 'https://api.example.invalid/api/health/ready') { throw 'Plan incorrecto.' }
  Assert-Fails { Get-StagingUpdatePlan $sourceRoot $config 'Todo' '1.2.4' } '*no coincide*'
  Set-Content -LiteralPath (Join-Path $sourceRoot 'web/package.json') -Value '{"version":"1.2.4"}' -Encoding UTF8
  Assert-Fails { Get-StagingUpdatePlan $sourceRoot $config 'Todo' '' } '*compartir una versión*'
  Set-Content -LiteralPath (Join-Path $sourceRoot 'web/package.json') -Value '{"version":"1.2.3"}' -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $sourceRoot 'sin-aprobar.txt') -Value 'fixture'
  Assert-Fails { Get-StagingUpdatePlan $sourceRoot $config 'Todo' '' } '*cambios pendientes*'
  Remove-Item -LiteralPath (Join-Path $sourceRoot 'sin-aprobar.txt')
  $settings.DB_PASS = 'no-se-admite'; Save-Settings
  Assert-Fails { Get-StagingUpdatePlan $sourceRoot $config 'Todo' '' } '*desconocida*'
  $settings.Remove('DB_PASS'); $settings.ApiBaseUrl='http://api.example.invalid/api'; Save-Settings
  Assert-Fails { Get-StagingUpdatePlan $sourceRoot $config 'Todo' '' } '*HTTPS*'
  $settings.ApiBaseUrl='https://api.example.invalid/api'; $settings.PortalRoot=Join-Path $systemRoot 'releases/portal'; Save-Settings
  Assert-Fails { Get-StagingUpdatePlan $sourceRoot $config 'Todo' '' } '*no puede estar dentro*'
  $settings.PortalRoot=Join-Path $systemRoot 'portal-alumno'; Save-Settings
  Set-Content -LiteralPath $envPath -Value @('PORT=3000','PORT=3100')
  Assert-Fails { Get-StagingUpdatePlan $sourceRoot $config 'Todo' '' } '*duplicado*'
  Set-Content -LiteralPath $envPath -Value 'PORT=3100'
  & (Join-Path $PSScriptRoot 'Update-Staging.ps1') -Source $sourceRoot -SettingsPath $config -ValidateOnly | Out-Null
  & (Join-Path $PSScriptRoot 'Update-Staging.ps1') -Source $sourceRoot -SettingsPath $config -WhatIf | Out-Null
  if ((Test-Path (Join-Path $systemRoot 'config/update-staging.lock')) -or (Test-Path (Join-Path $systemRoot 'releases'))) { throw 'La planificación produjo efectos de despliegue.' }

  $events = [Collections.Generic.List[string]]::new()
  function Assert-StagingPortalSite($Plan) { $events.Add('preflight') }
  function Invoke-StagingSystemUpdate($Plan) { $events.Add('sistema'); if ($failSystem) { throw 'fixture sistema' } }
  function Invoke-StagingPortalUpdate($Plan) { $events.Add("portal:$($Plan.ApiPort)"); if ($failPortal) { throw 'fixture portal' } }
  $failSystem=$false; $failPortal=$false
  Invoke-StagingUpdate $plan
  if (($events -join ',') -ne 'preflight,sistema,portal:3100') { throw 'Se alteró el orden preflight/sistema/API/portal.' }
  $events.Clear(); $failSystem=$true
  Assert-Fails { Invoke-StagingUpdate $plan } '*fixture sistema*'
  if (($events -join ',') -ne 'preflight,sistema') { throw 'Se publicó portal después de fallar el sistema.' }
  $failSystem=$false; $failPortal=$true
  Assert-Fails { Invoke-StagingUpdate $plan } '*No se revierte la base automáticamente*'
  $events.Clear(); $failPortal=$false; $plan.Target='PortalAlumno'
  Invoke-StagingUpdate $plan
  if (($events -join ',') -ne 'preflight,portal:3100') { throw 'PortalAlumno modificó el sistema.' }

  $tokens=$null; $errors=$null
  $ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'Deploy-PortalAlumno-Staging.ps1'),[ref]$tokens,[ref]$errors)
  $function=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Set-PortalApiProxy'},$true)
  . ([scriptblock]::Create($function.Extent.Text))
  $xmlPath=Join-Path $fixture 'web.config'
  Copy-Item (Join-Path $PSScriptRoot '../../mobile/public/web.config') $xmlPath
  Set-PortalApiProxy $xmlPath 3100
  [xml]$xml=Get-Content $xmlPath -Raw
  if ($xml.configuration.'system.webServer'.rewrite.rules.rule[0].action.url -ne 'http://127.0.0.1:3100/{R:0}' -or $xml.configuration.'system.webServer'.rewrite.rules.rule[1].action.url -ne '/index.html') { throw 'Proxy o fallback incorrecto.' }
  Assert-Fails { Set-PortalApiProxy $xmlPath 0 } '*'
  & {
    function Import-Module { param($Name,$ErrorAction) }
    function Get-Website { param($Name,$ErrorAction) return $siteFixture }
    # Recuperar la implementación real sustituida antes por el doble de orden.
    $t=$null; $e=$null
    $updateAst=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'Update-Staging.ps1'),[ref]$t,[ref]$e)
    $preflight=$updateAst.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Assert-StagingPortalSite'},$true)
    . ([scriptblock]::Create($preflight.Extent.Text))
    $siteFixture=$null
    Assert-Fails { Assert-StagingPortalSite $plan } '*Falta el sitio IIS*'
    $siteFixture=@{ physicalPath=(Join-Path $fixture 'otro-sitio') }
    Assert-Fails { Assert-StagingPortalSite $plan } '*no apunta*'
    $siteFixture=@{ physicalPath=(Join-Path $plan.PortalRoot 'current') }
    Assert-StagingPortalSite $plan
    # Entrada real del coordinador con módulos de activación sustituidos.
    $commands=Join-Path $fixture 'commands'
    New-Item -ItemType Directory $commands | Out-Null
    Copy-Item (Join-Path $PSScriptRoot 'Update-Staging.ps1') (Join-Path $commands 'Update-Staging.ps1')
    @'
param($Version,$Source,$Root,$ServiceName,$DatabaseName,$MysqlDump,$ApiBaseUrl,$HealthUrl)
Add-Content -LiteralPath $env:STAGING_TEST_EVENTS -Value 'sistema'
$global:LASTEXITCODE=0
'@ | Set-Content (Join-Path $commands 'Deploy-Staging.ps1')
    @'
param($Version,$Source,$Root,$PortalHost,$UpstreamApiBaseUrl,$SiteName,$ApiPort)
Add-Content -LiteralPath $env:STAGING_TEST_EVENTS -Value "portal:$ApiPort"
$global:LASTEXITCODE=1
'@ | Set-Content (Join-Path $commands 'Deploy-PortalAlumno-Staging.ps1')
    $oldOs=$env:OS; $oldEvents=$env:STAGING_TEST_EVENTS
    $env:OS='Windows_NT'; $env:STAGING_TEST_EVENTS=Join-Path $fixture 'events.txt'
    $held=$null
    try {
      $lockFile=Join-Path $systemRoot 'config/update-staging.lock'
      $held=[IO.File]::Open($lockFile,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
      Assert-Fails { & (Join-Path $commands 'Update-Staging.ps1') -Source $sourceRoot -SettingsPath $config } '*'
      if (Test-Path $env:STAGING_TEST_EVENTS) { throw 'Un actualizador concurrente modificó componentes.' }
      $held.Dispose(); $held=$null
      & (Join-Path $commands 'Update-Staging.ps1') -Source $sourceRoot -SettingsPath $config
      if ($LASTEXITCODE -ne 0 -or ((Get-Content $env:STAGING_TEST_EVENTS) -join ',') -ne 'sistema,portal:3100') {
        throw 'La entrada real no conservó el orden o interpretó el código 1 de Robocopy como fallo.'
      }
    } finally {
      if ($held) { $held.Dispose() }
      $env:OS=$oldOs; $env:STAGING_TEST_EVENTS=$oldEvents
    }
  }
} finally { if (Test-Path -LiteralPath $fixture) { Remove-Item -LiteralPath $fixture -Recurse -Force } }
Write-Host 'Actualizador: versión, configuración, WhatIf, orden, fallo parcial y puerto del proxy verificados sin IIS/BD reales.'
