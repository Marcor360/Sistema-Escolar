param(
  [string]$Root = 'C:\SistemaEscolar',
  [int]$KeepReleases = 5,
  [int]$KeepDaily = 7,
  [int]$KeepWeekly = 4,
  [int]$KeepMonthly = 3,
  [int]$KeepLogsDays = 30,
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
if (@(@($KeepReleases, $KeepDaily, $KeepWeekly, $KeepMonthly, $KeepLogsDays) | Where-Object { $_ -lt 1 }).Count) { throw 'Los límites de retención deben ser positivos.' }
$rootPath = (Resolve-Path -LiteralPath $Root).Path
if (-not (Test-Path -LiteralPath (Join-Path $rootPath 'current'))) { throw 'Falta la release activa; no se aplica retención.' }

$databaseDir = Join-Path $rootPath 'backups\database'
$uploadsDir = Join-Path $rootPath 'backups\uploads'
$pairs = @()
foreach ($sql in @(Get-ChildItem -LiteralPath $databaseDir -File -Filter 'escolar_staging_*.sql')) {
  if ($sql.Name -notmatch '^escolar_staging_(\d{4}-\d{2}-\d{2}_\d{6})\.sql$') { continue }
  $stamp = $Matches[1]
  $zipPath = Join-Path $uploadsDir "uploads_$stamp.zip"
  if (-not (Test-Path -LiteralPath $zipPath -PathType Leaf)) { continue }
  $date = [datetime]::MinValue
  if (-not [datetime]::TryParseExact($stamp, 'yyyy-MM-dd_HHmmss', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$date)) { continue }
  $pairs += [pscustomobject]@{ Date = $date; Sql = $sql.FullName; Zip = $zipPath }
}
$pairs = @($pairs | Sort-Object Date -Descending)
$kept = @{}
$days = @{}
$weeks = @{}
$months = @{}
foreach ($pair in $pairs) {
  $dayKey = $pair.Date.ToString('yyyy-MM-dd')
  $weekKey = $pair.Date.Date.AddDays(-(([int]$pair.Date.DayOfWeek + 6) % 7)).ToString('yyyy-MM-dd')
  $monthKey = $pair.Date.ToString('yyyy-MM')
  if (-not $days.ContainsKey($dayKey) -and $days.Count -lt $KeepDaily) { $days[$dayKey] = $true; $kept[$pair.Sql] = $true }
  if (-not $weeks.ContainsKey($weekKey) -and $weeks.Count -lt $KeepWeekly) { $weeks[$weekKey] = $true; $kept[$pair.Sql] = $true }
  if (-not $months.ContainsKey($monthKey) -and $months.Count -lt $KeepMonthly) { $months[$monthKey] = $true; $kept[$pair.Sql] = $true }
}
$candidates = @($pairs | Where-Object { -not $kept.ContainsKey($_.Sql) } | ForEach-Object { $_.Sql; $_.Zip })

$releasesPath = Join-Path $rootPath 'releases'
$protected = @(@('current', 'previous') | ForEach-Object {
  $link = Join-Path $rootPath $_
  if (Test-Path -LiteralPath $link) { @((Get-Item -LiteralPath $link).Target) | ForEach-Object { if ($_) { [IO.Path]::GetFullPath($_) } } }
})
$releases = @(Get-ChildItem -LiteralPath $releasesPath -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+([-.][A-Za-z0-9.-]+)?$' } | Sort-Object LastWriteTime -Descending)
$protectedReleases = @($releases | Where-Object { $protected -contains $_.FullName })
$retainedReleases = @($releases | Where-Object { $protected -notcontains $_.FullName } | Select-Object -First ([Math]::Max(0, $KeepReleases - $protectedReleases.Count)))
$candidates += @($releases | Where-Object { $protected -notcontains $_.FullName -and $retainedReleases.FullName -notcontains $_.FullName } | Select-Object -ExpandProperty FullName)
$cutoff = (Get-Date).AddDays(-$KeepLogsDays)
$candidates += @(Get-ChildItem -LiteralPath (Join-Path $rootPath 'logs') -File | Where-Object { $_.LastWriteTime -lt $cutoff -and $_.LastWriteTime.Date -lt (Get-Date).Date } | Select-Object -ExpandProperty FullName)

foreach ($candidate in $candidates) {
  if ($Apply) { Remove-Item -LiteralPath $candidate -Recurse -Force; Write-Host "Eliminado: $candidate" }
  else { Write-Host "Se eliminaría: $candidate" }
}
if (-not $Apply) { Write-Host 'Simulación solamente. Usa -Apply después de verificar una copia externa y la lista de candidatos.' }
