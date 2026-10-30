param(
  [string]$Root = 'C:\SistemaEscolar\portal-alumno',
  [string]$PortalHost = 'stagin-portal-alumnoiua.edu.mx',
  [string]$SiteName = 'SistemaEscolar-Staging-PortalAlumno',
  [Parameter(Mandatory = $true)][string]$CertificateThumbprint
)

$ErrorActionPreference = 'Stop'
Import-Module WebAdministration -ErrorAction Stop

if ($PortalHost -notmatch '^[a-zA-Z0-9.-]+$') { throw 'PortalHost debe ser un hostname DNS válido.' }
$webRoot = Join-Path $Root 'current'
$currentEntry = Get-Item -LiteralPath $webRoot -Force -ErrorAction Stop
if ($currentEntry.LinkType -ne 'Junction') { throw 'current debe ser Junction de release, no directorio físico.' }
foreach ($name in @('index.html', 'web.config')) {
  if (-not (Test-Path -LiteralPath (Join-Path $webRoot $name))) { throw "Falta $name en $webRoot. Primero publica Expo Web." }
}
if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) { throw "Ya existe ${SiteName}: revisa el binding sin recrear el sitio." }
$collision = @(Get-WebBinding -Protocol https | Where-Object {
  $_.bindingInformation -match ('(?i):443:' + [regex]::Escape($PortalHost) + '$')
})
if ($collision.Count -gt 0) { throw "Ya existe un binding HTTPS 443 para $PortalHost. No se modificará." }

$thumbprint = $CertificateThumbprint.Replace(' ', '').ToUpperInvariant()
if ($thumbprint -notmatch '^[A-F0-9]{40}$') { throw 'CertificateThumbprint debe ser SHA-1 de 40 caracteres hexadecimales.' }
$cert = Get-Item -LiteralPath "Cert:\LocalMachine\My\$thumbprint" -ErrorAction SilentlyContinue
if (-not $cert -or -not $cert.HasPrivateKey -or $cert.NotBefore -gt (Get-Date) -or $cert.NotAfter -le (Get-Date)) {
  throw 'El certificado no está vigente o no tiene clave privada en LocalMachine/My.'
}
$names = @($cert.DnsNameList | ForEach-Object { $_.Unicode.ToLowerInvariant() })
$hostname = $PortalHost.ToLowerInvariant()
$covered = @($names | Where-Object {
  $_ -eq $hostname -or ($_.StartsWith('*.') -and $hostname.EndsWith($_.Substring(1)) -and
    $hostname.Substring(0, $hostname.Length - $_.Length + 1) -notmatch '\.')
}).Count -gt 0
if (-not $covered) {
  throw "El certificado no cubre $PortalHost. Un comodín *.iua.edu.mx NO cubre este dominio independiente."
}

if (-not (Get-WebGlobalModule | Where-Object Name -eq 'RewriteModule')) { throw 'Falta IIS URL Rewrite.' }
if (-not (Get-WebGlobalModule | Where-Object Name -eq 'ApplicationRequestRouting')) { throw 'Falta Application Request Routing (ARR).' }
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name enabled -Value $true

if (-not (Test-Path -LiteralPath "IIS:\AppPools\$SiteName")) { New-WebAppPool -Name $SiteName | Out-Null }
Set-ItemProperty -Path "IIS:\AppPools\$SiteName" -Name managedRuntimeVersion -Value ''
& icacls.exe $Root /grant "IIS AppPool\${SiteName}:(OI)(CI)RX" /T /Q | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron configurar permisos de lectura al directorio del portal.' }

New-Website -Name $SiteName -PhysicalPath $webRoot -ApplicationPool $SiteName -Port 443 -HostHeader $PortalHost -Ssl -SslFlags 1 | Out-Null
$binding = Get-WebBinding -Name $SiteName -Protocol https -Port 443 -HostHeader $PortalHost
if (-not $binding) { throw 'No se creó el binding HTTPS esperado.' }
$binding.AddSslCertificate($thumbprint, 'My')
Write-Host "Sitio IIS preparado: https://$PortalHost/"
Write-Host 'Verifica DNS público, certificado, /api/health/ready, autenticación ALUMNO y navegación SPA.'
