# Logo institucional en staging: reproducción y corrección focalizada

## Implementación existente
- `web/src/pages/Configuracion.tsx`: carga `FormData` con campo `logo`, vista previa de archivo y mensajes de error.
- `backend/src/configuracion/logo-upload.config.ts`: Multer `diskStorage`, extensiones PNG/JPEG/WebP, máximo 2 MiB.
- `backend/src/configuracion/configuracion.service.ts`: validación de contenido, referencia pública y limpieza.
- `backend/src/archivos/logo-publico.controller.ts`: GET exclusivo para nombre de archivo logo.
- `scripts/windows/Test-IUA-Logo-Staging.ps1`: diagnóstico no destructivo existente.

## Causa reproducible desde el código (20/oct/2026)

En la pantalla de Configuración institucional, `URL.createObjectURL(archivo)` produce una URL `blob:` para la vista previa. El encabezado CSP enviado por IIS, definido en `web/public/web.config`, permitía `img-src 'self' data: https:` pero no incluía `blob:`. Esto puede impedir que el navegador represente un PNG/JPG/WebP válido y activar el mensaje «La imagen seleccionada no se puede mostrar», bloqueando «Guardar cambios» **antes de realizar POST**.

Se agrega `blob:` exclusivamente a `img-src`. No se amplía `script-src`, `connect-src`, `object-src` ni el acceso público a `uploads`. La prueba automatizada impide una regresión del encabezado versionado.

**Validación obligatoria después del despliegue:** inspeccionar el CSP efectivo del documento HTML servido por IIS (debe incluir `img-src 'self' data: blob: https:`), abrir una sesión nueva y seleccionar PNG, JPG y WebP reales (menos de 2 MiB); confirmar que aparecen, se habilita Guardar, se completan PUT/POST, y el logo permanece visible tras recargar/reiniciar. Probar además archivo falso, >2 MiB, errores de acceso/ACL y lectura pública. Ninguna de estas verificaciones en staging ha sido ejecutada aquí. La incidencia #106 no se cierra hasta contar con evidencia.

## Secuencia de diagnóstico y reparación
1. Confirmar versión API/web activa y el `UPLOADS_DIR` de la configuración efectiva NSSM; **no revelar secretos**.
2. Capturar **solo** estado HTTP, `x-request-id`, tamaño, tipo de archivo y error sanitizado para `POST /api/configuracion/marca/logo` con PNG válido <2 MiB.
3. Distinguir 413 de IIS/ARR contra 413 de Multer; 403 de permisos/rol; 404 por proxy; 500 por ACL/DB. Probar Windows ACL lectura/escritura con cuenta de servicio y límite `maxAllowedContentLength` sin exponer uploads públicamente.
4. Verificar `GET /api/configuracion/marca` y `GET /uploads/marca-logo-...` desde origen web y móvil. Comprobar diferencias entre URL de build y API, caché y persistencia tras reiniciar/deploy.
5. Arreglar solo la causa reproducida y añadir prueba E2E de carga, persistencia, reemplazo y error parcial. Revisar guardado de marca y archivo como operaciones observables independientes.

## Aceptación
- SUPERADMIN: PNG/JPG/WebP válidos suben, permanecen visibles tras recargar/reiniciar.
- Archivo falso/tamaño prohibido falla con mensaje claro; un fallo del logo no destruye el anterior.
- GET público solo expone logos; documentos personales conservan enlaces firmados.
- Evidencia adjunta de prueba real staging HTTPS y scripts con resultado.

## Estado
No se dispone de la respuesta HTTP real en esta revisión, por lo que **no se modifica IIS ni se presenta una reparación no demostrada**. Ref. #106.

## Verificación automatizada añadida
La integración real comprueba carga PNG, lectura pública de bytes y MIME, sustitución, persistencia en nueva consulta, permisos exclusivos de SUPERADMIN, rechazo de imagen falsa y mayor a 2 MiB, conservación del logo previo al fallar y rechazo de documentos privados por la ruta pública. El script de Windows puede guardar evidencia HTTP acotada con `-EvidencePath`, sin tokens ni cuerpos.

No hay todavía evidencia del host staging ni permiso de red al dominio en este entorno. No se modificaron IIS, ACL ni DNS. Continúa pendiente la reproducción HTTPS y la persistencia tras reinicio en staging; las pruebas aisladas no acreditan esa operación.


## Diagnóstico de código 1.27.17

`Test-IUA-Logo-Staging.ps1` acepta `-WebBase 'https://sistema-staging.iua.edu.mx/'` para consultar el CSP del HTML. Comprueba cada política de encabezado, la primera directiva img-src (o default-src), y señala la existencia de meta CSP para revisar en navegador. No modifica IIS ni prueba una carga. Un bloqueo en cualquiera de las políticas impide blob:; la ausencia de encabezado no acredita que el navegador permita la imagen.

Con `-EvidencePath` exporta también fallos HTTP o de conectividad, incluso si falta logo o no se puede recuperar la marca. La evidencia no incluye cuerpos de error, cookies ni mensajes de excepción. Las pruebas automatizadas simulan consultas y HTTP 503; no acceden a staging. La carga HTTPS y persistencia reales siguen pendientes.
