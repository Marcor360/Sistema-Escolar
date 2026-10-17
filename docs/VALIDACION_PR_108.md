# Validación del logo institucional — PR 108

El cliente rechaza extensiones no admitidas, archivos vacíos y más de 2 MiB sin
hacer PUT ni POST. Una vista previa local dañada bloquea su envío y tiene un
mensaje distinto al de un logo remoto no disponible. Se revocan las object URLs.
Los errores HTTP 413 del endpoint de logo tienen mensaje en español. El límite
sigue siendo 2,097,152 bytes, sin ampliar otros uploads ni publicar archivos privados.

Las pruebas multipart usan Express/Multer reales y un directorio temporal aislado:
aceptan 2 MiB − 1 y 2 MiB; rechazan 2 MiB + 1, contenido falsificado y extensión
no permitida, sin eliminar archivos anteriores. Las pruebas web cubren rechazo
local, sustitución, vista dañada, guardado parcial y reintento. Una recarga fallida
después de POST exitoso se comunica como fallo de actualización de vista.

## Verificación externa de la incidencia 106

La integración de este PR no acredita la reparación del servidor de staging.
No hay acceso configurado al Windows Server ni evidencia HTTP autenticada de la
carga reportada. Sigue pendiente ejecutar `scripts/windows/Test-IUA-Logo-Staging.ps1`
y el recorrido HTTPS con SUPERADMIN, registrar versión, estado HTTP y request-id,
y comprobar persistencia tras reinicio/deploy y visualización desde app ALUMNO.
No se atribuye el fallo remoto a IIS, ACL ni UPLOADS_DIR sin esa evidencia.

Refs #106; este documento no cierra la incidencia de staging.
