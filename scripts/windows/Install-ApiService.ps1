param(
  [string]$Root = 'C:\SistemaEscolar',
  [string]$Nssm = 'C:\Tools\nssm\win64\nssm.exe',
  [string]$ServiceName = 'SistemaEscolarApi',
  [Parameter(Mandatory = $true)][pscredential]$ServiceCredential
)

$ErrorActionPreference = 'Stop'
$account = $ServiceCredential.UserName
if ($account -notmatch '^\.\\[^\\]+$') { throw 'Usa una cuenta local dedicada con formato .\usuario.' }
$localName = $account.Substring(2)
if (-not (Get-LocalUser -Name $localName -ErrorAction SilentlyContinue)) { throw "Crea primero la cuenta local $account sin privilegios administrativos." }
$admins = Get-LocalGroupMember -Group (Get-LocalGroup -SID 'S-1-5-32-544') -ErrorAction Stop
if ($admins.Name -contains "$env:COMPUTERNAME\$localName") { throw 'La cuenta del servicio pertenece a Administrators.' }
if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) { throw "El servicio $ServiceName ya existe." }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$envFile = Join-Path $Root 'config\backend.env'
if (-not (Test-Path -LiteralPath $Nssm)) { throw "No se encontró NSSM: $Nssm" }
if (-not (Test-Path -LiteralPath $envFile)) { throw "Crea primero $envFile a partir de backend/.env.staging.example" }
if (-not (Test-Path -LiteralPath (Join-Path $Root 'current\backend\dist\main.js'))) {
  throw "No existe el backend compilado en $Root\current\backend. Despliega primero una release."
}

& $Nssm install $ServiceName $node
if ($LASTEXITCODE -ne 0) { throw 'NSSM no pudo instalar el servicio.' }
try {
# ChangeServiceConfig establece ObjectName sin exponer la contraseña en argumentos de proceso.
if (-not ('ServiceLogonConfig' -as [type])) { Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class ServiceLogonConfig {
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern IntPtr OpenSCManager(string machine, string database, uint access);
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern IntPtr OpenService(IntPtr manager, string name, uint access);
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool ChangeServiceConfig(IntPtr service, uint type, uint start, uint error, string binary, string group, IntPtr tag, string dependencies, string account, string password, string display);
  [DllImport("advapi32.dll", SetLastError = true)]
  private static extern bool CloseServiceHandle(IntPtr handle);
  public static void Set(string name, string account, string password) {
    IntPtr manager = OpenSCManager(null, null, 1);
    if (manager == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
    try {
      IntPtr service = OpenService(manager, name, 2);
      if (service == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
      try {
        if (!ChangeServiceConfig(service, 0xffffffff, 0xffffffff, 0xffffffff, null, null, IntPtr.Zero, null, account, password, null))
          throw new Win32Exception(Marshal.GetLastWin32Error());
      } finally { CloseServiceHandle(service); }
    } finally { CloseServiceHandle(manager); }
  }
}
'@
}
[ServiceLogonConfig]::Set($ServiceName, $account, $ServiceCredential.GetNetworkCredential().Password)
& $Nssm set $ServiceName AppDirectory (Join-Path $Root 'current\backend')
& $Nssm set $ServiceName AppParameters "-r dotenv/config dist/main.js"
& $Nssm set $ServiceName AppEnvironmentExtra "DOTENV_CONFIG_PATH=$envFile" "NODE_ENV=production"
& $Nssm set $ServiceName Start SERVICE_AUTO_START
& $Nssm set $ServiceName AppExit Default Restart
& $Nssm set $ServiceName AppRestartDelay 5000
& $Nssm set $ServiceName AppStdout (Join-Path $Root 'logs\api-out.log')
& $Nssm set $ServiceName AppStderr (Join-Path $Root 'logs\api-error.log')
& $Nssm set $ServiceName AppRotateFiles 1
& $Nssm set $ServiceName AppRotateOnline 1
& $Nssm set $ServiceName AppRotateBytes 10485760
if ($LASTEXITCODE -ne 0) { throw 'NSSM no pudo completar la configuración.' }
} catch {
  & $Nssm remove $ServiceName confirm | Out-Null
  throw
}
Write-Host "Servicio $ServiceName instalado como $account. Inícialo después de revisar permisos y backend.env."
