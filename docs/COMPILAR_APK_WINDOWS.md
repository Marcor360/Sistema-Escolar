# Compilar el APK en Windows, sin EAS Build

## Qué se compila

`mobile/` es la app del **alumno** (Expo SDK 57 / React Native 0.86). Consume la API de `backend/` por HTTPS; `web/` es el portal y no se incluye en el APK. `npx expo export` solo genera recursos JavaScript y **no** un APK. La compilación local usa Node, Java, Android SDK y Gradle en esta computadora; Gradle puede descargar dependencias durante la primera ejecución.

El APK de `assembleDebug` necesita Metro en ejecución y sirve para desarrollar. El de `assembleRelease` incorpora JavaScript y se puede instalar sin Metro, pero requiere URL de API alcanzable y firma propia. El perfil `preview` de `mobile/eas.json` produce APK en EAS Build; los pasos aquí usan Gradle local y no necesitan cuenta de Expo para compilar. Las notificaciones push sí requieren un `EXPO_PUBLIC_EAS_PROJECT_ID` real, FCM y prueba en teléfono.

## Requisitos

En PowerShell, comprobar:

```powershell
node --version
npm --version
java -version
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --list_installed
```

Se requiere Node 24, JDK 21, Android SDK Platform 36, Build Tools 36.0.0, NDK 27.1.12297006 y Android SDK Command-line Tools. Definir `ANDROID_HOME` y `JAVA_HOME` en Windows si no existen. En esta computadora están en `C:\Android\Sdk` y `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`. Si faltan componentes:

```powershell
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" 'platforms;android-36' 'build-tools;36.0.0' 'ndk;27.1.12297006' 'platform-tools'
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
```

## Preparar el proyecto

Desde `A:\Sistema-Escolar`:

```powershell
cd mobile
npm ci
npx expo-doctor
npm test
npx tsc --noEmit
npx expo prebuild --platform android --no-install
```

`prebuild` genera `mobile/android/` localmente. Está excluido de Git porque Expo lo puede regenerar. También puede cambiar los scripts `android`/`ios` de `package.json`; antes de confirmar cambios, revisar `git diff` y conservar los scripts del proyecto. Si se modifican plugins, identificador o permisos, regenerar el proyecto nativo antes de compilar de nuevo.

## URL de la API

La URL se incorpora al APK durante `assembleRelease`. Debe ser la dirección **HTTPS pública o accesible desde el teléfono** y terminar exactamente en `/api`. `localhost` del teléfono no apunta a la computadora. Verificar en el teléfono la conectividad y el certificado antes de distribuir el APK.

```powershell
$env:APP_ENV = 'preview'
$env:EXPO_PUBLIC_API_URL = 'https://TU-DOMINIO/api'
```

La configuración rechaza HTTP, credenciales, parámetros y fragmentos para `preview` y `production`. Si la API aún no está disponible, se puede compilar un APK de depuración, pero no validar login ni funciones conectadas. No incluir contraseñas o tokens en `EXPO_PUBLIC_*`: son visibles en el APK.

Con la clave ya creada en esta computadora, el comando de compilación repetible es:

```powershell
cd A:\Sistema-Escolar
.\scripts\windows\Build-MobileApk.ps1 -ApiUrl 'https://TU-DOMINIO/api' -VersionCode 1
```

El script genera `android/` si falta y lo reutiliza en las compilaciones siguientes. Configura la firma local, compila, verifica la firma y copia el resultado a `mobile/apk/Sistema-Escolar-vc1.apk` (o el código indicado). Imprime el SHA-256 y la ruta. Cambiar `VersionCode` a 2, 3, etc. en cada actualización distribuida. Las secciones siguientes explican cada paso por si se prefiere ejecutarlo manualmente o usar otra computadora.

## Firma de instalación

Si ya se distribuyó una app con `mx.escuela.alumnos`, **reutilizar su keystore**. Una firma nueva impide instalar este APK como actualización de la app anterior. Para la primera distribución, crear un keystore fuera del repositorio con `keytool` (pedirá contraseñas); guardar el archivo y sus contraseñas en un respaldo seguro:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\escolar-android" | Out-Null
keytool -genkeypair -v -storetype PKCS12 -keystore "$env:USERPROFILE\escolar-android\escolar-release.jks" -alias escolar -keyalg RSA -keysize 3072 -validity 10000
```

En el archivo generado `mobile/android/app/build.gradle`, agregar dentro de `signingConfigs`, después de `debug`:

```groovy
release {
    storeFile file(System.getenv('ESCOLAR_KEYSTORE_PATH') ?: 'missing-release-keystore.jks')
    storePassword System.getenv('ESCOLAR_KEYSTORE_PASSWORD') ?: ''
    keyAlias 'escolar'
    keyPassword System.getenv('ESCOLAR_KEY_PASSWORD') ?: ''
}
```

En `buildTypes.release`, cambiar `signingConfig signingConfigs.debug` por `signingConfig signingConfigs.release`. Estas ediciones al proyecto generado se deben repetir si se regenera `android/` desde cero. Nunca confirmar el keystore ni las contraseñas en Git.

En la misma sesión de PowerShell, establecer las variables sin escribir las contraseñas en el historial:

```powershell
$env:ESCOLAR_KEYSTORE_PATH = "$env:USERPROFILE\escolar-android\escolar-release.jks"
$env:ESCOLAR_KEYSTORE_PASSWORD = Read-Host 'Contraseña del keystore'
$env:ESCOLAR_KEY_PASSWORD = Read-Host 'Contraseña de la clave escolar'
```

En esta computadora ya se creó la primera clave en `C:\Users\Marco\escolar-android\escolar-release.jks`. Su contraseña está en `C:\Users\Marco\escolar-android\escolar-release-password.txt`, con acceso restringido al usuario de Windows. Para usarla sin volver a escribirla:

```powershell
$env:ESCOLAR_KEYSTORE_PATH = "$env:USERPROFILE\escolar-android\escolar-release.jks"
$env:ESCOLAR_KEYSTORE_PASSWORD = [System.IO.File]::ReadAllText("$env:USERPROFILE\escolar-android\escolar-release-password.txt")
$env:ESCOLAR_KEY_PASSWORD = $env:ESCOLAR_KEYSTORE_PASSWORD
```

Respaldar ambos archivos por separado de forma segura. Si se pierden, los APK futuros no podrán actualizar los ya instalados con esta firma.

## Compilar y verificar

```powershell
cd A:\Sistema-Escolar\mobile\android
.\gradlew.bat :app:assembleRelease
$apk = 'app\build\outputs\apk\release\app-release.apk'
Test-Path $apk
& "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --verbose --print-certs $apk
Get-FileHash $apk -Algorithm SHA256
```

El APK queda en `mobile/android/app/build/outputs/apk/release/app-release.apk`. Para instalarlo por USB con depuración USB autorizada:

```powershell
adb devices
adb install -r $apk
```

`-r` actualiza una instalación anterior **solo si la firma coincide**. Aumentar `android.defaultConfig.versionCode` antes de cada nueva distribución. Para publicar en Google Play se requiere un `.aab` (`.\gradlew.bat :app:bundleRelease`) y completar sus requisitos de publicación. El APK local no certifica por sí solo login, red, archivos, pagos ni notificaciones en un teléfono físico.

## Desarrollo con teléfono conectado

```powershell
cd A:\Sistema-Escolar\mobile
$env:APP_ENV = 'development'
$env:EXPO_PUBLIC_API_URL = 'http://IP-DE-LA-COMPUTADORA:3000/api'
npx expo run:android
```

Esto instala una build de desarrollo y usa Metro. Para pruebas por Wi-Fi, el teléfono y la computadora deben estar en la misma red y el backend debe escuchar en una interfaz alcanzable. No confundir esta build con el APK autónomo de `assembleRelease`.
