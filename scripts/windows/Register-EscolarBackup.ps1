param(
 [string]$Root='C:\SistemaEscolar',
 [Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_]+$')][string]$DatabaseName,
 [ValidateSet('mysql','mssql')][string]$Motor='mysql',
 [string]$At='03:00',
 [string]$CopyTo='',
 [switch]$IncludeWeeklyRestore
)
$ErrorActionPreference='Stop'
foreach($ruta in @($Root,$CopyTo)) { if($ruta.Contains('"')) { throw 'Ruta inválida.' } }
$script=Join-Path $Root 'current\scripts\windows\Backup-Escolar.ps1'
if(-not(Test-Path -LiteralPath $script)) { throw 'Falta Backup-Escolar.ps1 en la release activa.' }
# Se registra solo al invocar este script como administrador. No se instala desde el build ni desde la API.
$argumentos="-NoProfile -NonInteractive -File `"$script`" -Root `"$Root`" -DatabaseName $DatabaseName -Motor $Motor"
if($CopyTo) { $argumentos += " -CopyTo `"$CopyTo`"" }
$accion=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumentos
$disparador=New-ScheduledTaskTrigger -Daily -At ([DateTime]::ParseExact($At,'HH:mm',[Globalization.CultureInfo]::InvariantCulture))
$principal=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$opciones=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName 'IUA-RespaldoDiario' -Action $accion -Trigger $disparador -Principal $principal -Settings $opciones -Description 'Respaldo diario SQL y uploads con estado verificable. Requiere ACL y credenciales exclusivas configuradas.'

if ($IncludeWeeklyRestore) {
 $restore=Join-Path $Root 'current\scripts\windows\Test-EscolarBackup.ps1'
 if(-not(Test-Path -LiteralPath $restore)) { throw 'Falta el script de ensayo de restore.' }
 $accionRestore=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -File `"$restore`" -Root `"$Root`""
 $semanal=New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At '05:00'
 Register-ScheduledTask -TaskName 'IUA-EnsayoRestoreSemanal' -Action $accionRestore -Trigger $semanal -Principal $principal -Settings $opciones -Description 'Ensayo en base nueva escolar_staging_restore_*; conserva base y archivos para revisar. Requiere cuenta restore y capacidad de disco.'
}
