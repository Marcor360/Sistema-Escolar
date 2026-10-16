param(
  [Parameter(Mandatory = $true)]
  [string]$ApiUrl,
  [ValidateRange(1, 2100000000)]
  [int]$VersionCode = 1
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$mobile = Join-Path $repo 'mobile'
$android = Join-Path $mobile 'android'
$keystore = Join-Path $env:USERPROFILE 'escolar-android\escolar-release.jks'
$passwordFile = Join-Path $env:USERPROFILE 'escolar-android\escolar-release-password.txt'

try { $parsed = [Uri]$ApiUrl } catch { throw 'ApiUrl debe ser una URL HTTPS válida.' }
if ($parsed.Scheme -ne 'https' -or $parsed.AbsolutePath -ne '/api' -or $parsed.Query -or $parsed.Fragment -or $parsed.UserInfo -or $parsed.Host -match '^(localhost|127\.0\.0\.1)$') {
  throw 'ApiUrl debe ser HTTPS, accesible desde el teléfono y terminar exactamente en /api.'
}
if (-not (Test-Path -LiteralPath $keystore) -or -not (Test-Path -LiteralPath $passwordFile)) {
  throw "Falta la clave local o su contraseña en $($env:USERPROFILE)\escolar-android. Consulte docs/COMPILAR_APK_WINDOWS.md."
}
if (-not $env:ANDROID_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:ANDROID_HOME 'build-tools\36.0.0\apksigner.bat'))) {
  throw 'Falta ANDROID_HOME o Android Build Tools 36.0.0.'
}

$previousAppEnv = $env:APP_ENV
$previousApiUrl = $env:EXPO_PUBLIC_API_URL
$previousNodeEnv = $env:NODE_ENV
try {
  $env:APP_ENV = 'preview'
  $env:EXPO_PUBLIC_API_URL = $ApiUrl
  $env:NODE_ENV = 'production'
  $env:ESCOLAR_KEYSTORE_PATH = $keystore
  $env:ESCOLAR_KEYSTORE_PASSWORD = [System.IO.File]::ReadAllText($passwordFile)
  $env:ESCOLAR_KEY_PASSWORD = $env:ESCOLAR_KEYSTORE_PASSWORD

  Push-Location $mobile
  try {
    if (-not (Test-Path 'node_modules')) { & npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci falló.' } }
    if (-not (Test-Path (Join-Path $android 'gradlew.bat'))) {
      & npx expo prebuild --platform android --no-install
      if ($LASTEXITCODE -ne 0) { throw 'expo prebuild falló.' }
    }

    # Expo cambia estos scripts al generar el proyecto nativo; conservar el flujo del repositorio.
    $packagePath = Join-Path $mobile 'package.json'
    $package = [System.IO.File]::ReadAllText($packagePath)
    $package = $package.Replace('"android": "expo run:android"', '"android": "expo start --android"').Replace('"ios": "expo run:ios"', '"ios": "expo start --ios"')
    [System.IO.File]::WriteAllText($packagePath, $package)

    $gradlePath = Join-Path $android 'app\build.gradle'
    $gradle = [System.IO.File]::ReadAllText($gradlePath)
    $signing = @'
        release {
            storeFile file(System.getenv('ESCOLAR_KEYSTORE_PATH'))
            storePassword System.getenv('ESCOLAR_KEYSTORE_PASSWORD')
            keyAlias 'escolar'
            keyPassword System.getenv('ESCOLAR_KEY_PASSWORD')
        }
'@
    $signingMarker = '    signingConfigs {'
    if (-not $gradle.Contains($signingMarker)) { throw 'No se encontró signingConfigs en build.gradle.' }
    if (-not $gradle.Contains('ESCOLAR_KEYSTORE_PATH')) {
      $gradle = $gradle.Replace($signingMarker, "$signingMarker`n$signing")
    }
    $releaseMarker = '            signingConfig signingConfigs.debug'
    $buildTypesBlock = $gradle.IndexOf('    buildTypes {')
    if ($buildTypesBlock -lt 0) { throw 'No se encontró buildTypes en build.gradle.' }
    $releaseBlock = $gradle.IndexOf('        release {', $buildTypesBlock)
    if ($releaseBlock -lt 0) { throw 'No se encontró buildTypes.release en build.gradle.' }
    if ($gradle.IndexOf('            signingConfig signingConfigs.release', $releaseBlock) -lt 0) {
      $releaseSigning = $gradle.IndexOf($releaseMarker, $releaseBlock)
      if ($releaseSigning -lt 0) { throw 'No se encontró la firma de release esperada.' }
      $gradle = $gradle.Remove($releaseSigning, $releaseMarker.Length).Insert($releaseSigning, '            signingConfig signingConfigs.release')
    }
    $versionMatch = [regex]::Match($gradle, '(?m)^\s*versionCode\s+\d+')
    if (-not $versionMatch.Success) { throw 'No se encontró versionCode en build.gradle.' }
    $gradle = $gradle.Remove($versionMatch.Index, $versionMatch.Length).Insert($versionMatch.Index, "        versionCode $VersionCode")
    [System.IO.File]::WriteAllText($gradlePath, $gradle)

    Push-Location $android
    try {
      & .\gradlew.bat ':app:assembleRelease'
      if ($LASTEXITCODE -ne 0) { throw 'Gradle assembleRelease falló.' }
      $apk = Join-Path $android 'app\build\outputs\apk\release\app-release.apk'
      if (-not (Test-Path -LiteralPath $apk)) { throw 'Gradle terminó sin crear el APK.' }
      & (Join-Path $env:ANDROID_HOME 'build-tools\36.0.0\apksigner.bat') verify --verbose --print-certs $apk
      if ($LASTEXITCODE -ne 0) { throw 'La verificación de firma del APK falló.' }
      $artifactDir = Join-Path $mobile 'apk'
      New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
      $artifact = Join-Path $artifactDir "Sistema-Escolar-vc$VersionCode.apk"
      Copy-Item -LiteralPath $apk -Destination $artifact -Force
      Get-FileHash -LiteralPath $artifact -Algorithm SHA256 | Format-List
      Write-Output "APK: $artifact"
    } finally { Pop-Location }
  } finally { Pop-Location }
} finally {
  $env:APP_ENV = $previousAppEnv
  $env:EXPO_PUBLIC_API_URL = $previousApiUrl
  $env:NODE_ENV = $previousNodeEnv
  Remove-Item Env:ESCOLAR_KEYSTORE_PATH,Env:ESCOLAR_KEYSTORE_PASSWORD,Env:ESCOLAR_KEY_PASSWORD -ErrorAction SilentlyContinue
}
