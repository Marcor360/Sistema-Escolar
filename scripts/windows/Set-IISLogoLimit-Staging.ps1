param(
  [string]$ApiSite = 'SistemaEscolar-Staging-Api',
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
Import-Module WebAdministration -ErrorAction Stop
if (-not (Get-Website -Name $ApiSite -ErrorAction SilentlyContinue)) { throw "No se encontró el sitio IIS $ApiSite." }
$filter = 'system.webServer/security/requestFiltering/requestLimits'
$path = "IIS:\Sites\$ApiSite"
$actual = [long](Get-WebConfigurationProperty -PSPath $path -Filter $filter -Name maxAllowedContentLength -ErrorAction Stop).Value
# 10 MiB de WebP más 1 MiB de margen para multipart.
$objetivo = [long]11 * 1024 * 1024
Write-Host "IIS $ApiSite : límite actual=$actual bytes; requerido=$objetivo bytes"
if ($Apply) {
  if ($actual -lt $objetivo) {
    Set-WebConfigurationProperty -PSPath $path -Filter $filter -Name maxAllowedContentLength -Value $objetivo
  }
  $vigente = [long](Get-WebConfigurationProperty -PSPath $path -Filter $filter -Name maxAllowedContentLength).Value
  if ($vigente -lt $objetivo) { throw 'No se pudo habilitar el límite HTTP para logos WebP.' }
  Write-Host "Límite IIS validado: $vigente bytes"
} else {
  Write-Host 'Modo lectura. Para aplicar: .\scripts\windows\Set-IISLogoLimit-Staging.ps1 -Apply'
}
