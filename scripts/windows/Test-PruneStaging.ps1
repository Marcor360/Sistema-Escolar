$ErrorActionPreference = 'Stop'
$base = Join-Path ([IO.Path]::GetTempPath()) ("escolar-prune-test-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $base | Out-Null
try {
  foreach ($dir in @('releases\1.10.0', 'releases\1.9.9', 'backups\database', 'backups\uploads', 'logs')) {
    New-Item -ItemType Directory -Path (Join-Path $base $dir) -Force | Out-Null
  }
  New-Item -ItemType Junction -Path (Join-Path $base 'current') -Target (Join-Path $base 'releases\1.10.0') | Out-Null
  New-Item -ItemType Junction -Path (Join-Path $base 'previous') -Target (Join-Path $base 'releases\1.9.9') | Out-Null
  foreach ($day in 0..12) {
    $stamp = (Get-Date).AddDays(-$day).ToString('yyyy-MM-dd_HHmmss')
    New-Item -ItemType File -Path (Join-Path $base "backups\database\escolar_staging_$stamp.sql") | Out-Null
    New-Item -ItemType File -Path (Join-Path $base "backups\uploads\uploads_$stamp.zip") | Out-Null
  }
  $orphan = Join-Path $base 'backups\database\escolar_staging_2020-01-01_000000.sql'
  New-Item -ItemType File -Path $orphan | Out-Null
  & (Join-Path $PSScriptRoot 'Prune-Staging.ps1') -Root $base -KeepDaily 1 -KeepWeekly 2 -KeepMonthly 2 -KeepReleases 1 6>$null | Out-Null
  if (-not (Test-Path -LiteralPath $orphan) -or @(Get-ChildItem -LiteralPath (Join-Path $base 'backups\database') -Filter 'escolar_staging_*.sql').Count -ne 14) { throw 'La simulación de retención modificó respaldos.' }
  & (Join-Path $PSScriptRoot 'Prune-Staging.ps1') -Root $base -KeepDaily 1 -KeepWeekly 2 -KeepMonthly 2 -KeepReleases 1 -Apply 6>$null | Out-Null
  if (-not (Test-Path -LiteralPath (Join-Path $base 'current')) -or -not (Test-Path -LiteralPath (Join-Path $base 'previous')) -or -not (Test-Path -LiteralPath $orphan)) { throw 'La retención borró una ruta protegida.' }
  $remaining = @(Get-ChildItem -LiteralPath (Join-Path $base 'backups\database') -Filter 'escolar_staging_*.sql').Count
  if ($remaining -ge 14 -or $remaining -lt 3) { throw "Cantidad inesperada de respaldos: $remaining" }
  Write-Host 'Retención: simulación y aplicación en carpeta temporal correctas.'
} finally {
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
  $target = [IO.Path]::GetFullPath($base)
  if ($target.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($target) -match '^escolar-prune-test-[a-f0-9]{32}$') {
    Remove-Item -LiteralPath (Join-Path $base 'current') -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $base 'previous') -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $target -Recurse -Force
  }
}
