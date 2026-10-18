# Logo institucional en staging: reproducción y corrección focalizada

## Implementación existente
- `web/src/pages/Configuracion.tsx`: carga `FormData` con campo `logo`, vista previa de archivo y mensajes de error.
- `backend/src/configuracion/logo-upload.config.ts`: Multer `diskStorage`, extensiones PNG/JPEG/WebP, máximo 2 MiB.
- `backend/src/configuracion/configuracion.service.ts`: validación de contenido, referencia pública y limpieza.
- `backend/src/archivos/logo-publico.controller.ts`: GET exclusivo para nombre de archivo logo.
- `scripts/windows/Test-IUA-Logo-Staging.ps1`: diagnóstico no destructivo existente.

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
