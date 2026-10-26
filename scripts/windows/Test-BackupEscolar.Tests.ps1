$ErrorActionPreference='Stop'
$raiz=Join-Path ([IO.Path]::GetTempPath()) ('iua-backup-test-'+[Guid]::NewGuid().ToString('N'))
$global:BackupTestStopped=0; $global:BackupTestStarted=0; $global:BackupTestArgs=@()
function Get-Service { param($Name) $s=[PSCustomObject]@{Status='Running'}; $s|Add-Member -MemberType ScriptMethod -Name WaitForStatus -Value {param($Estado,$Timeout)}; return $s }
function Stop-Service { param($Name) $global:BackupTestStopped++ }
function Start-Service { param($Name) $global:BackupTestStarted++ }
try {
 New-Item -ItemType Directory -Path (Join-Path $raiz 'config'),(Join-Path $raiz 'data/uploads') -Force|Out-Null
 'BACKUP_DB_USER=fixture_backup','BACKUP_DB_PASS=fixture_only','BACKUP_DB_HOST=localhost'|Set-Content (Join-Path $raiz 'config/backup.env')
 'Archivo sintético'|Set-Content (Join-Path $raiz 'data/uploads/fixture.txt')
 $dump=Join-Path $raiz 'dump-fixture.ps1'
 @'
$global:BackupTestArgs=$args
foreach($a in $args){if($a -like '--result-file=*'){$destino=$a.Substring('--result-file='.Length)}}
'-- SQL sintético de prueba'|Set-Content -LiteralPath $destino
$global:LASTEXITCODE=0
'@|Set-Content $dump
 & (Join-Path $PSScriptRoot 'Backup-Escolar.ps1') -Root $raiz -DatabaseName escolar_staging -MysqlDump $dump -CopyTo (Join-Path $raiz 'external')
 $estado=Get-Content -Raw (Join-Path $raiz 'logs/backup-status.json')|ConvertFrom-Json
 if($estado.estado -ne 'OK' -or -not $estado.ultimoExito){throw 'El respaldo no dejó evidencia de éxito.'}
 if($global:BackupTestStopped -ne 1 -or $global:BackupTestStarted -ne 1){throw 'El servicio no se detuvo/reanudó una sola vez.'}
 if(($global:BackupTestArgs -join ' ') -match 'fixture_only'){throw 'Se expuso la contraseña en argumentos.'}
 $manifest=Get-ChildItem (Join-Path $raiz 'backups/manifests') -Filter '*.json'|Select-Object -First 1
 $m=Get-Content -Raw $manifest.FullName|ConvertFrom-Json
 if($m.restauracionEnsayada){throw 'Un backup no puede acreditar un restore.'}
 if(@(Get-ChildItem (Join-Path $raiz 'external') -File).Count -ne 3){throw 'La copia externa no contiene SQL, ZIP y manifest.'}
 if((Get-FileHash (Join-Path $raiz ('backups/database/'+$m.sql))).Hash -ne $m.sqlSha256){throw 'Hash SQL incorrecto.'}
 Write-Output 'BackupEscolar: detención/reanudación, SQL+uploads, manifest, copia externa y ausencia de secretos en argumentos verificados con fixtures.'
} finally {
 # Solo se retira el directorio sintético creado por esta prueba, sin bases ni archivos institucionales.
 if(Test-Path -LiteralPath $raiz){Remove-Item -LiteralPath $raiz -Recurse -Force}
 Remove-Variable BackupTestStopped,BackupTestStarted,BackupTestArgs -Scope Global -ErrorAction SilentlyContinue
}
