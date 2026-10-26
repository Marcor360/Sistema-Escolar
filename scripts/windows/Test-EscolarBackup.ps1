param(
 [string]$Root='C:\SistemaEscolar',
 [string]$Manifest='',
 [ValidatePattern('^escolar_staging_restore_[A-Za-z0-9_]+$')][string]$TargetDatabase=('escolar_staging_restore_'+(Get-Date -Format 'yyyyMMdd_HHmmss')),
 [string]$Mysql='C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe'
)
$ErrorActionPreference='Stop'
$mutex=[Threading.Mutex]::new($false,'Global\IUA_BackupEscolar')
if(-not $mutex.WaitOne(0)) { throw 'Hay otro respaldo o ensayo en curso.' }
try {
 $base=[IO.Path]::GetFullPath((Join-Path $Root 'backups\manifests')).TrimEnd('\')+'\'
 if(-not $Manifest) { $Manifest=(Get-ChildItem -LiteralPath $base -Filter 'backup_*.json' | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).FullName }
 if(-not $Manifest) { throw 'No hay respaldo para ensayar.' }
 $Manifest=(Resolve-Path -LiteralPath $Manifest).Path
 if(-not $Manifest.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)) { throw 'El manifest debe estar en backups\manifests.' }
 $m=Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
 foreach($nombre in @($m.sql,$m.uploads)) { if([IO.Path]::GetFileName($nombre) -ne $nombre) { throw 'Nombre de respaldo inválido.' } }
 if($m.motor -notin @('mysql','mssql')) { throw 'Motor no admitido.' }
 $sql=Join-Path $Root "backups\database\$($m.sql)"; $zip=Join-Path $Root "backups\uploads\$($m.uploads)"
 if((Get-FileHash $sql -Algorithm SHA256).Hash -ne $m.sqlSha256 -or (Get-FileHash $zip -Algorithm SHA256).Hash -ne $m.uploadsSha256) { throw 'El respaldo no coincide con sus hashes.' }
 $destino=Join-Path $Root "restore-check\$TargetDatabase"
 if(Test-Path -LiteralPath $destino) { throw 'El directorio de ensayo debe ser nuevo.' }
 $settings=@{}
 foreach($line in Get-Content -LiteralPath (Join-Path $Root 'config\backup.env')) {
  if($line -match '^\s*(RESTORE_DB_USER|RESTORE_DB_PASS|BACKUP_DB_HOST|BACKUP_DB_PORT|BACKUP_DB_SSL_CA_PATH)=(.*)$') { $settings[$Matches[1]]=$Matches[2].Trim().Trim('"',"'") }
 }
 foreach($key in @('RESTORE_DB_USER','RESTORE_DB_PASS','BACKUP_DB_HOST')) { if(-not $settings[$key] -or $settings[$key] -like 'REEMPLAZAR*') { throw 'Falta configuración privada del usuario de restore.' } }
 if($m.motor -eq 'mysql') {
  if($sql -notmatch '^[A-Za-z]:[\\/][A-Za-z0-9_ .\\/-]+\.sql$') { throw 'Ruta SQL no válida para el cliente mysql.' }
  $port=if($settings.BACKUP_DB_PORT){$settings.BACKUP_DB_PORT}else{'3306'}
  $argumentos=@("--host=$($settings.BACKUP_DB_HOST)","--port=$port","--user=$($settings.RESTORE_DB_USER)",'--ssl-mode=VERIFY_IDENTITY','--batch','--skip-column-names')
  if($settings.BACKUP_DB_SSL_CA_PATH) { $argumentos += "--ssl-ca=$($settings.BACKUP_DB_SSL_CA_PATH)" }
  $env:MYSQL_PWD=$settings.RESTORE_DB_PASS
  $existe=& $Mysql @argumentos "--execute=SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='$TargetDatabase'"
  if($LASTEXITCODE -ne 0 -or ($existe|Select-Object -Last 1) -ne '0') { throw 'La base destino ya existe o no se pudo verificar; no se sobrescribe.' }
  & $Mysql @argumentos "--execute=CREATE DATABASE $TargetDatabase"
  if($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base aislada de ensayo.' }
  $source=$sql.Replace('\','/')
  & $Mysql @argumentos "--database=$TargetDatabase" "--execute=source $source"
  if($LASTEXITCODE -ne 0) { throw 'Falló el restore; se conserva la base parcial para inspección.' }
  $usuarios=& $Mysql @argumentos "--database=$TargetDatabase" '--execute=SELECT COUNT(*) FROM usuarios'
  if($LASTEXITCODE -ne 0) { throw 'No se pudieron comprobar las tablas restauradas.' }
 } else {
  if($settings.BACKUP_DB_HOST -notin @('localhost','127.0.0.1',$env:COMPUTERNAME)) { throw 'Ejecuta el ensayo en el host SQL Server con rutas locales.' }
  $builder=[System.Data.SqlClient.SqlConnectionStringBuilder]::new()
  $puertoSql=if($settings.BACKUP_DB_PORT){$settings.BACKUP_DB_PORT}else{'1433'}
   if($puertoSql -notmatch '^\d+$' -or [int]$puertoSql -lt 1 -or [int]$puertoSql -gt 65535){throw 'Puerto SQL Server inválido.'}
   $builder.DataSource="$($settings.BACKUP_DB_HOST),$puertoSql"; $builder.UserID=$settings.RESTORE_DB_USER; $builder.Password=$settings.RESTORE_DB_PASS; $builder.Encrypt=$true; $builder.TrustServerCertificate=$false; $builder.InitialCatalog='master'
  $conexion=[System.Data.SqlClient.SqlConnection]::new($builder.ConnectionString)
  try {
   $conexion.Open(); $cmd=$conexion.CreateCommand(); $cmd.CommandTimeout=1800
   $cmd.CommandText="SELECT COUNT(*) FROM sys.databases WHERE name=N'$TargetDatabase'"
   if([int]$cmd.ExecuteScalar() -ne 0) { throw 'La base destino ya existe; no se sobrescribe.' }
   $ruta=$sql.Replace("'","''")
   $cmd.CommandText="RESTORE FILELISTONLY FROM DISK=N'$ruta'"
   $reader=$cmd.ExecuteReader(); $archivos=[System.Data.DataTable]::new(); $archivos.Load($reader); $reader.Close()
   New-Item -ItemType Directory -Force -Path (Join-Path $Root 'restore-check') | Out-Null
   $moves=@(); $i=0
   foreach($archivo in $archivos.Rows) {
    if($archivo.Type -notin @('D','L')) { throw 'El ensayo automático solo admite archivos de datos y log; revisar otros tipos manualmente.' }
    $i++; $extension=if($archivo.Type -eq 'L'){'ldf'}else{'mdf'}
    $fisico=(Join-Path $Root "restore-check\${TargetDatabase}_$i.$extension").Replace("'","''")
    if(Test-Path -LiteralPath $fisico) { throw 'Ya existe un archivo de base de ensayo.' }
    $logico=([string]$archivo.LogicalName).Replace("'","''")
    $moves += "MOVE N'$logico' TO N'$fisico'"
   }
   if($moves.Count -lt 1) { throw 'El respaldo no contiene archivos restaurables.' }
   $cmd.CommandText="RESTORE DATABASE [$TargetDatabase] FROM DISK=N'$ruta' WITH CHECKSUM, "+($moves -join ', ')
   $cmd.ExecuteNonQuery() | Out-Null
   $cmd.CommandText="DBCC CHECKDB ([$TargetDatabase]) WITH NO_INFOMSGS, ALL_ERRORMSGS"; $cmd.ExecuteNonQuery() | Out-Null
   $cmd.CommandText="SELECT COUNT(*) FROM [$TargetDatabase].dbo.usuarios"; $usuarios=$cmd.ExecuteScalar()
  } finally { $conexion.Dispose() }
 }
 New-Item -ItemType Directory -Path $destino | Out-Null
 Expand-Archive -LiteralPath $zip -DestinationPath $destino
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $archive=[IO.Compression.ZipFile]::OpenRead($zip)
 try { $esperados=@($archive.Entries | Where-Object {$_.Name}).Count } finally { $archive.Dispose() }
 $restaurados=@(Get-ChildItem -LiteralPath $destino -File -Recurse -Force).Count
 if($esperados -ne $restaurados) { throw 'La cantidad de archivos restaurados no coincide con el ZIP.' }
 @{estado='RESTAURADO_PENDIENTE_UAT';fechaUtc=[DateTime]::UtcNow.ToString('o');target=$TargetDatabase;usuarios=[string]($usuarios|Select-Object -Last 1);archivos=$restaurados} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Root 'logs\restore-status.json') -Encoding UTF8
 Write-Output 'Restore técnico ensayado en base nueva. Revisar conteos, descargas privadas y conciliación antes de acreditar recuperación institucional.'
} catch {
 New-Item -ItemType Directory -Force -Path (Join-Path $Root 'logs') | Out-Null
 @{estado='ERROR';fechaUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Root 'logs\restore-status.json') -Encoding UTF8
 Write-Error 'El ensayo de restore falló; no se sobrescribió una base existente. Revisar permisos, certificados, espacio y respaldo.'
 exit 1
} finally { Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue; $mutex.ReleaseMutex(); $mutex.Dispose() }
