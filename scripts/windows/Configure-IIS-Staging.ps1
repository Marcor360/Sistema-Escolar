param(
  [string]$Root = 'C:\SistemaEscolar',
  [Parameter(Mandatory = $true)][string]$PortalHost,
  [Parameter(Mandatory = $true)][string]$ApiHost,
  [Parameter(Mandatory = $true)][string]$CertificateThumbprint,
  [int]$ApiPort = 3000,
  [int]$MaxUploadMb = 5,
  [string]$PortalSite = 'SistemaEscolar-Staging-Web',
  [string]$ApiSite = 'SistemaEscolar-Staging-Api'
)

$ErrorActionPreference = 'Stop'
Import-Module WebAdministration -ErrorAction Stop
if ($ApiPort -lt 1 -or $ApiPort -gt 65535 -or $MaxUploadMb -lt 1) { throw 'Puerto o límite de carga inválido.' }
if ($PortalHost -eq $ApiHost -or $PortalHost -notmatch '^[a-zA-Z0-9.-]+$' -or $ApiHost -notmatch '^[a-zA-Z0-9.-]+$') { throw 'Usa dos hostnames DNS distintos.' }
$thumbprint = $CertificateThumbprint.Replace(' ', '').ToUpperInvariant()
$cert = Get-Item -LiteralPath "Cert:\LocalMachine\My\$thumbprint" -ErrorAction SilentlyContinue
if (-not $cert -or -not $cert.HasPrivateKey -or $cert.NotAfter -le (Get-Date)) { throw 'El certificado HTTPS no existe, no tiene clave privada o está vencido.' }
$webRoot = Join-Path $Root 'current\web\dist'
if (-not (Test-Path -LiteralPath (Join-Path $webRoot 'web.config'))) { throw "Falta el build web en $webRoot." }
$rewrite = Get-WebGlobalModule | Where-Object Name -eq 'RewriteModule'
$proxy = Get-WebGlobalModule | Where-Object Name -eq 'ApplicationRequestRouting'
if (-not $rewrite -or -not $proxy) { throw 'Instala IIS URL Rewrite y Application Request Routing antes de configurar los sitios.' }
$proxySection = 'system.webServer/proxy'
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter $proxySection -Name enabled -Value $true
$apiRoot = Join-Path $Root 'iis-api'
New-Item -ItemType Directory -Force -Path $apiRoot | Out-Null
$maxBytes = [long]$MaxUploadMb * 1024 * 1024 + 1048576
$apiConfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration><system.webServer>
  <rewrite><rules><rule name="API reverse proxy" stopProcessing="true">
    <match url="(.*)" />
    <action type="Rewrite" url="http://127.0.0.1:$ApiPort/{R:1}" />
  </rule></rules></rewrite>
  <security><requestFiltering><requestLimits maxAllowedContentLength="$maxBytes" /></requestFiltering></security>
</system.webServer></configuration>
"@
[IO.File]::WriteAllText((Join-Path $apiRoot 'web.config'), $apiConfig, [Text.UTF8Encoding]::new($false))
foreach ($site in @(@($PortalSite, $PortalHost, $webRoot), @($ApiSite, $ApiHost, $apiRoot))) {
  if (Get-Website -Name $site[0] -ErrorAction SilentlyContinue) { throw "El sitio $($site[0]) ya existe; revisa su configuración antes de ejecutar." }
  if (-not (Test-Path -LiteralPath "IIS:\AppPools\$($site[0])")) { New-WebAppPool -Name $site[0] | Out-Null }
  Set-ItemProperty -Path "IIS:\AppPools\$($site[0])" -Name managedRuntimeVersion -Value ''
  & icacls.exe $site[2] /grant "IIS AppPool\$($site[0]):(OI)(CI)RX" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudo configurar lectura IIS en $($site[2])." }
  New-Website -Name $site[0] -PhysicalPath $site[2] -ApplicationPool $site[0] -Port 443 -HostHeader $site[1] -Ssl -SslFlags 1 | Out-Null
  $binding = Get-WebBinding -Name $site[0] -Protocol https -Port 443 -HostHeader $site[1]
  $binding.AddSslCertificate($thumbprint, 'My')
}
Set-WebConfigurationProperty -PSPath "IIS:\Sites\$PortalSite" -Filter 'system.webServer/security/requestFiltering/requestLimits' -Name maxAllowedContentLength -Value $maxBytes
Write-Host "IIS configurado para https://$PortalHost y https://$ApiHost; revisa DNS, cadena TLS y GET /api/health."
