param(
  [string]$OutputPath = (Join-Path (Get-Location) 'staging-host-audit.json')
)

$ErrorActionPreference = 'Stop'
$os = Get-CimInstance Win32_OperatingSystem
$computer = Get-CimInstance Win32_ComputerSystem
$disks = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object DeviceID, Size, FreeSpace)
$memory = @(Get-CimInstance Win32_Process | Sort-Object WorkingSetSize -Descending | Select-Object -First 20 Name, ProcessId, WorkingSetSize)
$services = @(Get-CimInstance Win32_Service | Where-Object { $_.StartMode -eq 'Auto' -or $_.Name -match 'mysql|mssql|w3svc|nssm|escolar' } | Select-Object Name, State, StartMode, ProcessId)
$listeners = @(Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess)
$programs = @(Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName | Select-Object DisplayName, DisplayVersion)
$iis = if (Get-Module -ListAvailable WebAdministration) {
  Import-Module WebAdministration
  @(Get-Website | Select-Object Name, State, PhysicalPath, @{Name='Bindings';Expression={@($_.Bindings.Collection | ForEach-Object bindingInformation)}})
} else { @() }
$pagefile = @(Get-CimInstance Win32_PageFileUsage | Select-Object Name, AllocatedBaseSize, CurrentUsage, PeakUsage)
$report = [ordered]@{
  CollectedAt = (Get-Date).ToString('o')
  Computer = $env:COMPUTERNAME
  OperatingSystem = $os.Caption
  TotalMemoryBytes = $computer.TotalPhysicalMemory
  FreeMemoryKilobytes = $os.FreePhysicalMemory
  CpuCount = $computer.NumberOfLogicalProcessors
  Disks = $disks
  Pagefile = $pagefile
  LargestProcesses = $memory
  AutoStartAndRelevantServices = $services
  TcpListeners = $listeners
  IisSites = $iis
  InstalledPrograms = $programs
}
$path = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $path) { throw "El reporte ya existe: $path. Usa una ruta nueva." }
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8
Write-Host "Auditoría de solo lectura guardada en $path. Revisa nombres internos y rutas antes de compartirla."
