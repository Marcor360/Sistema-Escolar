# 1.27.32 — Correo GoDaddy y Microsoft 365 por usuario

## Contrato funcional

- Por defecto, **ALUMNO → Correo Microsoft 365**; **MAESTRO, ADMINISTRATIVO, FINANZAS y SUPERADMIN → Correo GoDaddy**.
- En **alta** y **edición web** de alumno, docente y personal, el operador autorizado puede cambiar a cualquiera de los dos proveedores. La preferencia se guarda en `usuarios.correo_proveedor`, no en el navegador.
- Todos los correos dirigidos a una **cuenta registrada** (activación, recuperación, avisos de cobranza y solicitudes de apoyo) usan su preferencia actual.
- Las importaciones DOCENTES/PERSONAL permiten escoger `correoProveedor` opcional por fila en XLSX/CSV; su ausencia mantiene GoDaddy. En ALUMNOS sigue siendo obligatorio.
- Los correos destinados a direcciones **no registradas** conservan el SMTP GoDaddy existente. Nunca cambiar automáticamente de un proveedor a otro si falla: podría usar el buzón incorrecto o duplicar mensajes.
- Solo se selecciona el **remitente**, no se crea un buzón. La dirección del destinatario sigue siendo `usuarios.email`. En un dominio compartido, si el remitente y destino están en proveedores diferentes, **la entrega puede fallar**, aunque la API acepte el envío. Se debe elegir manualmente el proveedor que entrega a ese destinatario y resolver la coexistencia de dominio con los administradores de correo.
- Expo permanece exclusivamente para ALUMNO y **no** recibe credenciales Graph ni configuración SMTP. Las operaciones de gestión están solo en web.

## Operación previa obligatoria

1. **Respaldo** y ejecución de `npm run db:migrate` en el backend desplegado. Migraciones espejo para MySQL y SQL Server, ambas añadidas al manifiesto. Se conserva correo existente. Backfill: los usuarios con rol ALUMNO pasan a `MICROSOFT365`; los demás a `GODADDY`. Revisar cuentas con alojamiento atípico **antes de activar** Graph.
2. Verificar en Microsoft Entra que la aplicación `5b3f8e82-64fe-470e-af46-e9a15b97921a` NO tenga una concesión global **de aplicación** `Mail.Send`. Exchange Application RBAC limita `Application Mail.Send` mediante el ámbito `IUA-Graph-Plataforma365-SoloEnvio` al buzón `plataforma365@iua.edu.mx`. Probar `InScope=True` para ese buzón y `False` para otro; las pruebas RBAC **no prueban permisos globales concedidos en Entra**.
3. En servidor Windows, configurar y verificar **Windows Time/NTP**; el certificado del primer intento quedó con `NotBefore` futuro por un reloj adelantado. **Utilizar el certificado nuevo** (huella `3086607F157559B5F28EF143539B8053640A7AC0`) validado con `AuthType: AppOnly`. Verificar vencimiento/rotación.
4. Transferir **de manera autorizada y cifrada** la identidad del certificado a la cuenta de servicio que ejecuta NestJS. El `.cer` público no basta: el proceso Node necesita clave privada RSA **PEM** que corresponda al certificado público registrado en Entra. El módulo valida coincidencia criptográfica y periodo de vigencia en el arranque. Exportar de Windows en formato PFX **con contraseña fuerte** mediante herramientas administrativas de certificados; extraer la clave PEM solo en el servidor seguro con herramienta aprobada, borrar intermediarios después de verificar y aplicar ACL NTFS exclusivamente a la identidad de la API y administradores operativos. No usar directorio de IIS, `uploads/`, carpeta pública ni GitHub. Evitar archivos PEM sin cifrar si existe un almacén de secretos/certificados de la organización que pueda integrarse.
5. Completar **en el entorno del backend**, no web ni móvil:
   ```env
   SMTP_HOST=mail.iua.edu.mx
   SMTP_PORT=465
   SMTP_USER=plataforma-stagin@iua.edu.mx
   SMTP_PASS=<configurar fuera del repositorio>
   SMTP_FROM="IUA Plataforma <plataforma-stagin@iua.edu.mx>"
   SMTP_REQUIRED=true

   GRAPH_CORREO_HABILITADO=false
   GRAPH_TENANT_ID=14732010-1f66-4994-85c0-2a5f5ee32d60
   GRAPH_CLIENT_ID=5b3f8e82-64fe-470e-af46-e9a15b97921a
   GRAPH_CORREO_REMITENTE=plataforma365@iua.edu.mx
   GRAPH_CERTIFICATE_PATH=C:\\IUA\\secrets\\graph-public.cer
   GRAPH_PRIVATE_KEY_PATH=C:\\IUA\\secrets\\graph-private.pem
   ```
   Iniciar con `GRAPH_CORREO_HABILITADO=false`. Habilitar solo cuando API pueda leer ambos archivos, las cuentas de prueba tengan correctamente configurada su preferencia y el SMTP esté operativo. Si Graph no está habilitado y una cuenta lo tiene seleccionado, la cola conserva el fallo **sin redirigirlo a GoDaddy**.
6. Pruebas manuales limitadas: alta de alumno (Microsoft), alta de personal (GoDaddy), docente predeterminado (GoDaddy) y docente cambiado a Microsoft, recuperación y cobranza, reintentos, proveedores caídos. Verificar bandeja y Spam, SPF/DKIM/DMARC, trazabilidad y que jamás se filtren códigos o contraseñas en los registros. Respuesta `202` de Graph = **aceptación, no entrega**.
7. Retirar el rol temporal **Administrador de Exchange** de la cuenta emisora si se concedió exclusivamente para configurar la aplicación. No alterar MX, Cloudflare ni Email Routing de cPanel sin estrategia de coexistencia.

## API y seguridad

- No se añaden endpoints de correo públicos. Se reutilizan las rutas protegidas de creación/actualización de alumnos, docentes y personal, extendiendo sus DTO con `correoProveedor?: 'GODADDY' | 'MICROSOFT365'`.
- La API es la única autoridad sobre la preferencia. La lectura para la edición de alumnos sigue respetando alcance de plantel; para docentes se respetan sus planteles y para personal se exige SUPERADMIN.
- Se usa la capa `NotificacionesService` para los flujos existentes, sin modificar el esquema de outbox: se conserva la referencia para correlación y la lógica de reintentos.
- No se registran direcciones de correo, códigos, cuerpos, tokens, claves privadas ni respuestas completas de Graph. Nunca se registra `Authorization` o `client_assertion`.
- El cliente Graph implementa OAuth 2.0 client credentials con assertion RSA SHA-256, sin nuevas dependencias. Requiere Node compatible con `fetch`, `AbortSignal.timeout` y `base64url` (Node 20+). El resultado de un fallo de red puede ser **incierto**: comprobar proveedor antes de reintentar manualmente.

## Reversión no destructiva

Deshabilitar Graph con `GRAPH_CORREO_HABILITADO=false` **no redirige** mensajes seleccionados para Microsoft a GoDaddy: las colas muestran fallo hasta restaurar el proveedor. Reconfigurar preferencias puntuales por usuario desde web si se ha verificado que GoDaddy entrega a ese buzón. Conservar la migración y su historial. No borrar la columna ni secretos antiguos hasta finalizar la rotación y los reintentos.

## Validaciones del PR

Ejecutar en CI o equipo con dependencias completas:
`cd backend && npm run lint && npm run typecheck && npm test && npm run build`
`cd web && npm run lint && npm test && npm run build`.
Las pruebas de envío Graph/SMTP se hacen solamente en staging con destinatarios autorizados, no desde los tests automatizados.
