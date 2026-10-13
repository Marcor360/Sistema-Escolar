# Ejecuta los bloques reales con dobles de servicio/junction: nunca toca el host.
$ErrorActionPreference = 'Stop'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $PSScriptRoot 'Deploy-Staging.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Deploy-Staging.ps1 no se puede parsear.' }
$transaction = @($ast.EndBlock.Statements | Where-Object {
  $_ -is [System.Management.Automation.Language.TryStatementAst]
})[-1]
$source = Get-Content (Join-Path $PSScriptRoot 'Deploy-Staging.ps1') -Raw
$start = $source.IndexOf('# Validar la recuperacion')
$end = $source.IndexOf('# Pausa escrituras')
$preflight = [scriptblock]::Create($source.Substring($start, $end - $start))

$originalPort = $env:PORT
try {
& {
  $Root = 'TestDrive'; $current = 'current'; $previous = 'previous'; $release = 'release'
  $Version = '1.23.1'; $oldVersion = '1.23.0'; $ServiceName = 'FakeApi'
  $localBase = 'http://127.0.0.1:3000/api/health'
  $ApiBaseUrl = 'https://staging.example/api'; $HealthUrl = "$ApiBaseUrl/health/ready"
  $timestamp = 'test'
  function Test-Path { param($LiteralPath) return $true }
  function Get-Item {
    param($LiteralPath, [switch]$Force, $ErrorAction)
    if ($scenario -eq 'bad-junction') { return @{ LinkType = $null } }
    return @{ LinkType = 'Junction'; Target = @('old-release') }
  }
  function Get-Content { param($LiteralPath, [switch]$Raw) return '{"version":"1.23.0"}' }
  foreach ($scenario in @('bad-junction', 'bad-port', 'bad-health')) {
    $env:PORT = if ($scenario -eq 'bad-port') { 'invalid' } else { '3000' }
    $HealthUrl = if ($scenario -eq 'bad-health') { "$ApiBaseUrl/health" } else { "$ApiBaseUrl/health/ready" }
    $failed = $false
    try { & $preflight } catch { $failed = $true }
    if (-not $failed) { throw "Preflight acepto $scenario." }
  }

  function Move-Item {
    param($LiteralPath, $Destination, $ErrorAction)
    if ($LiteralPath -eq $previous) { $script:events.Add('restore') }
  }
  function New-Item { param($ItemType, $Path, $Target, $ErrorAction) }
  function Stop-Service {
    param($Name, [switch]$Force, $ErrorAction)
    $script:events.Add('stop')
    if ($scenario -eq 'stop-fails') { throw 'stop failed' }
  }
  function Get-Service {
    param($Name, $ErrorAction)
    $service = [pscustomobject]@{ Status = 'Stopped' }
    $service | Add-Member ScriptMethod WaitForStatus {
      param($status, $timeout)
      $script:events.Add("wait:$status")
      if ($status -eq 'Stopped' -and $scenario -eq 'stop-timeout') { throw 'stop timeout' }
    }
    return $service
  }
  function Start-Service {
    param($Name, $ErrorAction)
    $script:events.Add('start')
    if ($scenario -eq 'restart-fails' -and $switched) { throw 'restart failed' }
  }
  function Remove-OnlyJunction { param($Path) $script:events.Add('remove') }
  function Wait-ApiHealth {
    param($Uri, $ExpectedVersion)
    if ($ExpectedVersion -eq $Version) { throw 'new health failed' }
    $script:events.Add("health:$ExpectedVersion")
  }
  foreach ($scenario in @('healthy-rollback', 'stop-fails', 'stop-timeout', 'restart-fails')) {
    $script:events = [Collections.Generic.List[string]]::new()
    $switched = $false
    $failure = $null
    try { . ([scriptblock]::Create($transaction.Extent.Text)) } catch { $failure = $_.Exception.Message }
    if (-not $failure) { throw "Se oculto el fallo de $scenario." }
    if ($scenario -eq 'healthy-rollback') {
      if ($failure -notlike '*rollback a 1.23.0 verificado*') { throw $failure }
      if ($events.IndexOf('wait:Stopped') -ge $events.IndexOf('restore')) { throw 'Restauro antes de detener el servicio.' }
      if (@($events | Where-Object { $_ -eq 'health:1.23.0' }).Count -ne 2) { throw 'Falta verificar rollback local/publico.' }
    } else {
      if ($failure -notlike 'CRITICO:*Fallo inicial:*Fallo de recuperacion:*') { throw $failure }
      if ($scenario -in @('stop-fails', 'stop-timeout') -and $events.Contains('restore')) { throw 'Restauro mientras el servicio seguia activo.' }
    }
  }
}
} finally { $env:PORT = $originalPort }
Write-Host 'Deploy: preflight y recuperacion ante fallos correctos.'
