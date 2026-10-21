# Logo institucional · WebP y persistencia (1.27.18)

## Contrato
- Entrada desde web SUPERADMIN: PNG/JPEG/WebP de hasta **20 MiB**; preview local `blob:`.
- El portal decodifica y convierte automáticamente a WebP, reescalando a un máximo de 2048 px por lado y ajustando calidad/resolución hasta un máximo de **10 MiB** de salida (normalmente mucho menos). Se rechazan fuentes vacías, con más de 50 megapíxeles o navegadores sin conversión WebP.
- `POST /api/configuracion/marca/logo`: acepta **solo WebP convertido ≤10 MiB**. Los clientes directos de API deben transformar antes de subir. La conversión se realiza en el portal, no en NestJS. Se evita agregar decodificadores nativos de imágenes al servidor, con mayor superficie de ataque y dependencias.
- Multer escribe con nombre temporal fuera del patrón público; tras validar firma de WebP se renombra a `marca-logo-UUID.webp`, se verifica lectura local y se confirma la URL en la base. Ante fallo de BD/almacenamiento, se conserva la referencia anterior y se limpia el archivo nuevo.
- Los logos antiguos PNG/JPG/WebP siguen siendo legibles: sin migración destructiva, sin cambios SQL y sin modificar `MAX_UPLOAD_MB` de otros archivos.

## Problema observado y pruebas para aislarlo
La vista previa local de la pantalla de Configuración funciona, pero tras guardar puede fallar la imagen remota al recargar. Sin respuesta HTTP y comprobación de existencia en el host no podemos asegurar si es un fallo de permisos, ruta, proxy o archivo faltante. El nuevo portal verifica un GET de la URL pública inmediatamente después de publicar el logo, de modo que no anuncia éxito falso cuando el archivo no se puede consultar.

Con PowerShell administrativo en el Windows Server, desde el checkout aprobado:
```powershell
.\scripts\windows\Test-IUA-Logo-Staging.ps1 `
  -ApiBase 'https://api-sistema-staging.iua.edu.mx/api' `
  -WebBase 'https://sistema-staging.iua.edu.mx/' `
  -UploadsDir 'C:\SistemaEscolar\data\uploads' `
  -EvidencePath 'C:\SistemaEscolar\logs\logo-diagnostico.json'
.\scripts\windows\Set-IISLogoLimit-Staging.ps1
```

Si el archivo indicado por `GET /api/configuracion/marca` **no existe** en `UPLOADS_DIR`: comparar con el valor efectivo de `C:\SistemaEscolar\config\backend.env` y la carpeta de trabajo de NSSM, y revisar ACL de lectura/escritura de `SistemaEscolarApi`; no borrar `current`, bases ni respaldos. Si **existe** pero el GET público falla: verificar la ruta `https://api-sistema-staging.iua.edu.mx/uploads/marca-logo-...` (sin `/api`), IIS/ARR, CSP del portal y ACL de la cuenta del servicio. Si el POST devuelve 413, comprobar el límite HTTP del sitio API además del límite Multer (10 MiB).

Para habilitar solicitudes de WebP de 10 MiB más margen multipart en un sitio IIS **existente** (revisar salida primero):
```powershell
.\scripts\windows\Set-IISLogoLimit-Staging.ps1 -Apply
```

Este comando cambia únicamente el máximo de cuerpo HTTP de `SistemaEscolar-Staging-Api` a un mínimo de 11 MiB. Las restricciones de los demás endpoints siguen en backend. Para instalaciones nuevas, `Configure-IIS-Staging.ps1` usa por defecto 10 MiB más 1 MiB de margen; **no volver a ejecutarlo para recrear sitios existentes**.

## UAT de staging pendiente
- Imagen PNG/JPG/WebP original de 20 MiB aceptada y convertida; 20 MiB+1 rechazada en portal.
- Salida WebP con transparencia y buena nitidez; tamaño final menor o igual a 10 MiB.
- GET remoto del logo nuevo devuelve 200 `image/webp`; persiste después de recargar, cerrar sesión, reiniciar API y redeploy.
- Documento privado no accesible desde `/uploads`; roles distintos de SUPERADMIN no pueden POST.
- WebP inválido y mayor de 10 MiB rechazados; si falla BD/ACL se conserva el logo anterior.
- Guardar evidencia segura de código HTTP, tamaño, tipo, existencia y permisos sin secretos ni contenidos privados.
La incidencia #106 no se cierra hasta contar con evidencias reales del servidor. La CI prueba el código pero no prueba IIS/ACL ni restauración.
