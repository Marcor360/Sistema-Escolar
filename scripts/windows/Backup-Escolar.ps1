param(
 [string]$Root = 'C:\SistemaEscolar',
 [ValidateSet('mysql','mssql')][string]$Motor = 'mysql',
 [Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_]+$')][string]$DatabaseName,
 [string]$ServiceName = 'SistemaEscolarApi',
 [string]$MysqlDump = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe',
 [string]$CopyTo = ''
)
$ErrorActionPreference = 'Stop'
$mutex = [Threading.Mutex]::new($false, 'Global\IUA_BackupEscolar')
if (-not $mutex.WaitOne(0)) { throw 'Ya hay un respaldo en curso.' }
$service = $null; $reanudar = $false
$statusPath = Join-Path $Root 'logs\backup-status.json'
$ultimoExito = $null
if (Test-Path $statusPath) { try { $ultimoExito = (Get-Content -Raw $statusPath | ConvertFrom-Json).ultimoExito } catch {} }
function GuardarEstado([string]$Estado, $Exito) {
 $s = @{ estado=$Estado; actualizadoEn=[DateTime]::UtcNow.ToString('o'); ultimoExito=$Exito; motor=$Motor }
 $temporal = "$statusPath.tmp"
 $s | ConvertTo-Json | Set-Content -LiteralPath $temporal -Encoding UTF8
 Move-Item -LiteralPath $temporal -Destination $statusPath -Force
}
try {
 foreach ($d in @('logs','backups\database','backups\uploads','backups\manifests')) { New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null }
 $settings = @{}
 foreach ($line in Get-Content -LiteralPath (Join-Path $Root 'config\backup.env')) {
  if ($line -match '^\s*(BACKUP_DB_USER|BACKUP_DB_PASS|BACKUP_DB_HOST|BACKUP_DB_PORT|BACKUP_DB_SSL_CA_PATH)=(.*)$') { $settings[$Matches[1]]=$Matches[2].Trim().Trim('"', "'") }
 }
 foreach ($key in @('BACKUP_DB_USER','BACKUP_DB_PASS','BACKUP_DB_HOST')) { if (-not $settings[$key] -or $settings[$key] -like 'REEMPLAZAR*') { throw 'Falta configuración privada de respaldo.' } }
 $stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
 $extension = if ($Motor -eq 'mysql') { 'sql' } else { 'bak' }
 $sql = Join-Path $Root "backups\database\${DatabaseName}_$stamp.$extension"
 $zip = Join-Path $Root "backups\uploads\uploads_$stamp.zip"
 if ((Test-Path $sql) -or (Test-Path $zip)) { throw 'Ya existe un respaldo con este identificador.' }
 GuardarEstado 'EN_CURSO' $ultimoExito
 $service = Get-Service -Name $ServiceName
 $reanudar = $service.Status -eq 'Running'
 if ($reanudar) { Stop-Service -Name $ServiceName; $service.WaitForStatus('Stopped',[TimeSpan]::FromSeconds(60)) }
 if ($Motor -eq 'mysql') {
  $env:MYSQL_PWD=$settings.BACKUP_DB_PASS
  $puerto = if ($settings.BACKUP_DB_PORT) { $settings.BACKUP_DB_PORT } else { '3306' }
  $argumentos = @("--host=$($settings.BACKUP_DB_HOST)","--port=$puerto","--user=$($settings.BACKUP_DB_USER)",'--single-transaction','--routines','--events','--triggers','--set-gtid-purged=OFF','--ssl-mode=VERIFY_IDENTITY',"--result-file=$sql")
  if ($settings.BACKUP_DB_SSL_CA_PATH) { $argumentos += "--ssl-ca=$($settings.BACKUP_DB_SSL_CA_PATH)" }
  & $MysqlDump @argumentos $DatabaseName
  if ($LASTEXITCODE -ne 0) { throw 'No se completó el respaldo SQL.' }
 } else {
  if ($settings.BACKUP_DB_HOST -notin @('localhost','127.0.0.1',$env:COMPUTERNAME)) { throw 'El respaldo SQL Server requiere rutas locales al servidor; ejecuta esta tarea en el host de SQL Server.' }
  $builder = [System.Data.SqlClient.SqlConnectionStringBuilder]::new()
  $puertoSql=if($settings.BACKUP_DB_PORT){$settings.BACKUP_DB_PORT}else{'1433'}
   if($puertoSql -notmatch '^\d+$' -or [int]$puertoSql -lt 1 -or [int]$puertoSql -gt 65535){throw 'Puerto SQL Server inválido.'}
   $builder.DataSource="$($settings.BACKUP_DB_HOST),$puertoSql"; $builder.UserID=$settings.BACKUP_DB_USER; $builder.Password=$settings.BACKUP_DB_PASS
  $builder.Encrypt=$true; $builder.TrustServerCertificate=$false; $builder.InitialCatalog='master'
  $connection = [System.Data.SqlClient.SqlConnection]::new($builder.ConnectionString)
  try {
   $connection.Open(); $command=$connection.CreateCommand(); $command.CommandTimeout=1800
   $pathSql=$sql.Replace("'","''")
   $command.CommandText="BACKUP DATABASE [$DatabaseName] TO DISK=N'$pathSql' WITH COPY_ONLY, CHECKSUM"
   $command.ExecuteNonQuery() | Out-Null
   $command.CommandText="RESTORE VERIFYONLY FROM DISK=N'$pathSql' WITH CHECKSUM"; $command.ExecuteNonQuery() | Out-Null
  } finally { $connection.Dispose() }
 }
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 [IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $Root 'data\uploads'),$zip)
 if ((Get-Item $sql).Length -le 0) { throw 'Respaldo SQL vacío.' }
 $manifest = @{ fechaUtc=[DateTime]::UtcNow.ToString('o'); motor=$Motor; database=$DatabaseName; sql=[IO.Path]::GetFileName($sql); uploads=[IO.Path]::GetFileName($zip); sqlSha256=(Get-FileHash $sql -Algorithm SHA256).Hash; uploadsSha256=(Get-FileHash $zip -Algorithm SHA256).Hash; restauracionEnsayada=$false }
 $manifestPath = Join-Path $Root "backups\manifests\backup_$stamp.json"
 $manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8
 if ($CopyTo) { New-Item -ItemType Directory -Force -Path $CopyTo | Out-Null; Copy-Item -LiteralPath $sql,$zip,$manifestPath -Destination $CopyTo -ErrorAction Stop }
 $ultimoExito=[DateTime]::UtcNow.ToString('o')
 GuardarEstado 'OK' $ultimoExito
 Write-Output 'Respaldo de base y uploads completado. Falta ensayo de restauración para acreditar recuperación.'
} catch {
 try { GuardarEstado 'ERROR' $ultimoExito } catch {}
 Write-Error 'El respaldo falló. Revisar servicio, espacio, permisos y configuración privada; no se acredita un respaldo válido.'
 exit 1
} finally {
 Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
 try { if ($reanudar) { Start-Service -Name $ServiceName -ErrorAction Stop } } catch { GuardarEstado 'ERROR' $ultimoExito; throw 'El respaldo terminó pero no se pudo reanudar la API.' } finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
}
